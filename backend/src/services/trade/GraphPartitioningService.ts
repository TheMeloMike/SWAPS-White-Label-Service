import Graph from 'graphology';
import { DirectedGraph, UndirectedGraph, MultiDirectedGraph } from 'graphology';
import louvain from 'graphology-communities-louvain';
import * as graphUtils from 'graphology-utils';
import forceAtlas2 from 'graphology-layout-forceatlas2';

import { WalletState } from '../../types/trade';
import { LoggingService } from '../../utils/logging/LoggingService';
type Operation = any; // Simplified for now

/**
 * Interface for community cache metadata
 */
interface CommunityCacheMetadata {
  timestamp: number;
  graphSize: number;
  communityCount: number;
  totalProcessingTime: number;
}

/**
 * Service for partitioning a wallet-NFT interaction graph into communities
 * This is used to scale multi-party trade discovery across large numbers of wallets.
 */
export class GraphPartitioningService {
  private readonly logger = LoggingService.getInstance().createLogger('GraphPartitioning');
  private static instance: GraphPartitioningService | null = null;
  
  // Cached community data
  private communityGroups = new Map<number, string[]>();
  private communityWalletMap = new Map<string, number>();
  private lastPartitionTime = 0; // timestamp when partitioning was last computed
  private lastGraphSize = 0; // size of the graph when last partitioned
  private lastProcessingTime = 0; // time taken to process partitioning
  
  // Parameters for community detection
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minute cache TTL
  private readonly MIN_COMMUNITY_SIZE = 2; // Minimum wallets in a community to consider
  private readonly MAX_COMMUNITY_SIZE = 1000; // Maximum wallets for optimal performance
  private readonly RESOLUTION = 1.0; // Louvain resolution parameter
  
  // Parameters for layout optimization (for larger graphs)
  private readonly LAYOUT_ITERATIONS = 100;
  private readonly SCALING_RATIO = 10.0;
  private readonly EDGE_DENSITY_THRESHOLD = 0.5; // Threshold for community subdivision
  
  private constructor() {
    // Initialize any other necessary properties
  }
  
  public static getInstance(): GraphPartitioningService {
    if (!GraphPartitioningService.instance) {
      GraphPartitioningService.instance = new GraphPartitioningService();
    }
    return GraphPartitioningService.instance;
  }
  
  /**
   * Partitions the graph into communities of related wallets
   * Uses the Louvain algorithm for community detection
   */
  public partitionGraph(
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>
  ): Map<number, string[]> {
    const operation = this.logger.operation('partitionGraph');
    operation.info('Starting wallet-NFT graph partitioning', {
      wallets: wallets.size,
      nfts: nftOwnership.size,
      wantedNfts: wantedNfts.size
    });
    
    // First, check if we have a fresh cached result
    const now = Date.now();
    const isCacheFresh = this.lastPartitionTime > 0 && 
      (now - this.lastPartitionTime) < this.CACHE_TTL_MS;
    
    // For debugging
    if (this.lastPartitionTime > 0) {
      const ageMs = now - this.lastPartitionTime;
      const percentTtl = (ageMs / this.CACHE_TTL_MS).toFixed(1);
      this.logger.debug('Cache is ' + (isCacheFresh ? 'fresh' : 'stale'), {
        ageMs, 
        ttlMs: this.CACHE_TTL_MS,
        percentTtl
      });
    }
    
    // Return cached result if fresh
    if (isCacheFresh && this.communityGroups.size > 0) {
      operation.info('Using cached community partitions', {
        cacheAgeSeconds: ((now - this.lastPartitionTime) / 1000).toFixed(1),
        communityCount: this.communityGroups.size,
        walletCount: wallets.size,
        timestamp: this.lastPartitionTime,
        graphSize: this.lastGraphSize,
        totalProcessingTime: this.lastProcessingTime
      });
      
      operation.end();
      return this.communityGroups;
    }
    
    const startTime = Date.now();
    
    // Build interaction graph from wallet data
    const graph = this.buildInteractionGraph(wallets, nftOwnership, wantedNfts);
    const graphBuildTime = Date.now() - startTime;
    
    operation.info('Graph created', { buildTimeMs: graphBuildTime.toFixed(2) });
    
    try {
      // Apply community detection
      const communities = this.findCommunities(graph);
      
      // Update cache
      this.communityGroups = communities;
      this.lastPartitionTime = now;
      this.lastGraphSize = graph.order;
      this.lastProcessingTime = Date.now() - startTime;
      
      // Calculate statistics about communities
      const communitySizes = Array.from(communities.values()).map(c => c.length);
      const largestCommunity = Math.max(...communitySizes);
      const avgCommunitySize = communitySizes.length > 0 
        ? (communitySizes.reduce((a, b) => a + b, 0) / communitySizes.length).toFixed(1)
        : "0";
      
      // Calculate size distribution for reporting
      const sizeDistribution: Record<string, number> = {};
      for (const size of communitySizes) {
        // Group by size ranges: 1-10, 11-50, 51-100, 101-500, 501+
        const key = size <= 10 ? '1-10' :
                   size <= 50 ? '11-50' :
                   size <= 100 ? '51-100' :
                   size <= 500 ? '101-500' : '501+';
        
        sizeDistribution[key] = (sizeDistribution[key] || 0) + 1;
      }
      
      const totalWallets = Array.from(communities.values())
        .reduce((sum, community) => sum + community.length, 0);
      
      // Log summary of partitioning results
      operation.info('Community size distribution', {
        communities: communities.size,
        totalWallets,
        largestCommunity,
        avgCommunitySize,
        distribution: sizeDistribution
      });
      
      // Calculate and store total processing time
      const endTime = Date.now();
      
      operation.info('Graph partitioning completed', {
        totalDurationMs: this.lastProcessingTime.toFixed(2),
        communities: communities.size,
        graphBuildTimeMs: graphBuildTime.toFixed(2),
        algorithmTimeMs: (endTime - startTime - graphBuildTime).toFixed(2),
        processingTimeMs: (endTime - startTime - graphBuildTime - (endTime - startTime - graphBuildTime)).toFixed(2)
      });
      
      operation.end();
      return communities;
    }
    catch (error) {
      operation.error('Error during graph partitioning', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      // If an error occurs, return an empty map which will cause the caller
      // to fall back to direct match discovery
      operation.end();
      return new Map<number, string[]>();
    }
  }
  
  /**
   * Build a graph representation for partitioning
   * This is optimized for community detection based on ownership/wants relationships
   */
  private buildInteractionGraph(
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>
  ): any {
    const operation = this.logger.operation('buildInteractionGraph');
    const startTime = Date.now();
    
    // Create a new graph object using graphology library
    const graph = new UndirectedGraph();
    
    // Keep track of stats for the graph building process
    let totalEdges = 0;
    let newEdges = 0;
    let updatedEdges = 0;
    let edgesRejectedOwnership = 0;
    let edgesRejectedWants = 0;
    let edgesWithoutReciprocalInterest = 0;
    let possibleEdgesConsidered = 0;
    
    // Create a graph structure to help us track circular relationships
    // Each NFT links the wallet that owns it to all wallets that want it
    const nftLinks = new Map<string, {owner: string, wanters: Set<string>}>();
    
    // Initialize graph with all wallets
    for (const walletAddress of wallets.keys()) {
      // Add each wallet as a node in the graph
      graph.addNode(walletAddress);
    }
    
    // Track all NFT ownership and wants to build the nftLinks map
    for (const [nftAddress, ownerAddress] of nftOwnership.entries()) {
      const wanters = wantedNfts.get(nftAddress);
      if (!wanters || wanters.size === 0) continue;
      
      nftLinks.set(nftAddress, {
        owner: ownerAddress,
        wanters: new Set(wanters)
      });
    }
    
    // Now, walk the graph to find all possible chains, including circular trades
    const processedWallets = new Set<string>();
    const queue: string[] = [];
    
    // First, add direct trade links (important for small graphs)
    for (const [nftAddress, linkData] of nftLinks.entries()) {
      const {owner, wanters} = linkData;
      
      // For each wallet that wants this NFT
      for (const wanterAddress of wanters) {
        possibleEdgesConsidered++;
        
        // Skip if the wanter is the owner
        if (wanterAddress === owner) {
          edgesRejectedOwnership++;
          continue;
        }
        
        // Skip if we can't find the wanter wallet
        const wanterWallet = wallets.get(wanterAddress);
        if (!wanterWallet) {
          edgesRejectedWants++;
          continue;
        }
        
        // Make sure both nodes exist in the graph
        if (!graph.hasNode(wanterAddress)) {
          graph.addNode(wanterAddress);
        }
        
        if (!graph.hasNode(owner)) {
          graph.addNode(owner);
        }
        
        // Add to queue to process next level connections later
        if (!processedWallets.has(owner)) {
          queue.push(owner);
          processedWallets.add(owner);
        }
        
        if (!processedWallets.has(wanterAddress)) {
          queue.push(wanterAddress);
          processedWallets.add(wanterAddress);
        }
        
        // For community detection, use undirected edges
        // Check if the edge already exists
        const hasEdge = graph.hasEdge(wanterAddress, owner) || 
                        graph.hasEdge(owner, wanterAddress);
        
        if (hasEdge) {
          // Get the existing edge
          let existingEdge;
          if (graph.hasEdge(wanterAddress, owner)) {
            existingEdge = graph.edge(wanterAddress, owner);
          } else {
            existingEdge = graph.edge(owner, wanterAddress);
          }
          
          // Update the weight
          const currentWeight = graph.getEdgeAttribute(existingEdge, 'weight') || 1;
          graph.setEdgeAttribute(existingEdge, 'weight', currentWeight + 1);
          updatedEdges++;
        } else {
          // Add a new edge
          graph.addEdge(wanterAddress, owner, { weight: 1 });
          newEdges++;
          totalEdges++;
        }
        
        edgesWithoutReciprocalInterest++;
      }
    }
    
    // Now check multi-hop paths (A->B->C->...->A) to ensure they're in the same community
    // This is especially important for longer chains like 11-party trades
    // Process a limited distance to handle larger graphs
    const MAX_PATH_LENGTH = parseInt(process.env.TRADELOOP_MAX_DEPTH || '11', 10);
    
    while (queue.length > 0) {
      const currentWallet = queue.shift()!;
      const walletState = wallets.get(currentWallet);
      if (!walletState) continue;
      
      // For each NFT this wallet wants, add links to the owners of those NFTs
      for (const wantedNft of walletState.wantedNfts) {
        const owner = nftOwnership.get(wantedNft);
        if (!owner || owner === currentWallet) continue;
        
        // Add edge between this wallet and the owner of the wanted NFT
        if (!graph.hasEdge(currentWallet, owner) && !graph.hasEdge(owner, currentWallet)) {
          graph.addEdge(currentWallet, owner, { weight: 1, isChain: true });
          totalEdges++;
        }
      }
    }
    
    // Calculate graph density (ratio of actual edges to possible edges)
    const nodeCount = graph.order;
    const maxPossibleEdges = nodeCount * (nodeCount - 1) / 2; // For undirected graph
    const density = totalEdges / (maxPossibleEdges || 1); // Avoid division by zero
    
    // Log details about the graph building process
    const endTime = Date.now();
    operation.info('Wallet interaction graph built', {
      nodes: nodeCount,
      edges: totalEdges,
      newEdges,
      updatedEdges,
      edgesRejectedOwnership,
      edgesRejectedWants,
      edgesWithoutReciprocalInterest,
      possibleEdgesConsidered,
      durationMs: (endTime - startTime).toFixed(2),
      density: density.toFixed(4)
    });
    
    operation.end();
    return graph;
  }
  
  /**
   * Process the raw community detection results into a usable format
   * and rebuild the wallet-to-community mapping for future lookups
   */
  private processCommunityResults(communities: Map<number, string[]>): void {
    // Update the wallet-to-community mapping
    this.communityWalletMap.clear();
    
    // Add each wallet to the mapping
    for (const [communityId, wallets] of communities.entries()) {
      for (const wallet of wallets) {
        this.communityWalletMap.set(wallet, communityId);
      }
    }
    
    this.logger.info('Community detection results processed', { 
      communities: communities.size,
      mappedWallets: this.communityWalletMap.size
    });
  }
  
  /**
   * Determines if we should use cached community results
   * based on elapsed time since last partitioning
   */
  private shouldUseCache(currentTime: number): boolean {
    if (this.communityGroups.size === 0 || this.communityWalletMap.size === 0) {
      return false; // No cache available
    }
    
    const cacheAge = currentTime - this.lastPartitionTime;
    
    // Check if cache is fresh enough
    if (cacheAge < this.CACHE_TTL_MS) {
      this.logger.debug('Cache is fresh', {
        ageMs: cacheAge,
        ttlMs: this.CACHE_TTL_MS,
        percentTtl: ((cacheAge / this.CACHE_TTL_MS) * 100).toFixed(1)
      });
      return true;
    }
    
    this.logger.debug('Cache expired', {
      ageMs: cacheAge,
      ttlMs: this.CACHE_TTL_MS
    });
    return false;
  }
  
  /**
   * Log a detailed distribution of community sizes for monitoring
   */
  private logCommunityDistribution(operation: Operation, communities: Map<number, string[]>): void {
    const sizes = Array.from(communities.values()).map(community => community.length);
    const sizeBuckets: Record<string, number> = {};
    
    // Count communities by size buckets
    for (const size of sizes) {
      const bucket = size <= 10 ? '1-10' :
                    size <= 50 ? '11-50' :
                    size <= 100 ? '51-100' :
                    size <= 500 ? '101-500' : '501+';
                    
      sizeBuckets[bucket] = (sizeBuckets[bucket] || 0) + 1;
    }
    
    // Log distribution summary
    operation.info('Community size distribution', {
      totalCommunities: communities.size,
      averageSize: sizes.length === 0 ? 0 : 
        (sizes.reduce((sum, size) => sum + size, 0) / sizes.length).toFixed(1),
      largestCommunity: sizes.length === 0 ? 0 : Math.max(...sizes),
      smallestCommunity: sizes.length === 0 ? 0 : Math.min(...sizes),
      distribution: sizeBuckets
    });
  }
  
  /**
   * Gets the community ID for a specific wallet address
   * (useful for incremental updates)
   */
  public getCommunityForWallet(walletAddress: string): number | null {
    return this.communityWalletMap.has(walletAddress) ? this.communityWalletMap.get(walletAddress)! : null;
  }
  
  /**
   * Gets all wallets in the same community as the given wallet
   * This is useful for targeted trade loop discovery
   */
  public getWalletsInSameCommunity(walletAddress: string): string[] {
    const communityId = this.getCommunityForWallet(walletAddress);
    if (communityId === null || !this.communityGroups.has(communityId)) {
      return [walletAddress]; // Return just this wallet if no community found
    }
    
    return this.communityGroups.get(communityId)!;
  }
  
  /**
   * Clear the community detection cache
   * (call when graph structure changes significantly)
   */
  public clearCache(): void {
    this.communityGroups.clear();
    this.communityWalletMap.clear();
    this.lastPartitionTime = 0;
    this.logger.info('Community detection cache cleared');
  }
  
  /**
   * Get statistics about the current community partitioning
   */
  public getStatistics(): any {
    const totalWallets = Array.from(this.communityGroups.values())
      .reduce((sum, community) => sum + community.length, 0);
    
    // Calculate community size distribution
    const sizes = Array.from(this.communityGroups.values()).map(c => c.length);
    const maxSize = sizes.length > 0 ? Math.max(...sizes) : 0;
    const minSize = sizes.length > 0 ? Math.min(...sizes) : 0;
    const avgSize = sizes.length > 0 ? 
      (sizes.reduce((sum, size) => sum + size, 0) / sizes.length).toFixed(1) : 
      "0";
    
    return {
      communities: this.communityGroups.size,
      totalWallets,
      minCommunitySize: minSize,
      maxCommunitySize: maxSize,
      avgCommunitySize: avgSize,
      lastUpdated: this.lastPartitionTime ? new Date(this.lastPartitionTime).toISOString() : 'never',
      cacheAge: this.lastPartitionTime ? (Date.now() - this.lastPartitionTime) / 1000 : null,
      cacheTtl: this.CACHE_TTL_MS / 1000,
      graphSize: this.lastGraphSize,
      processingTimeMs: this.lastProcessingTime 
    };
  }
  
  /**
   * Apply the Louvain community detection algorithm to partition the graph
   * For very small graphs, use a simpler approach to avoid library issues
   */
  private findCommunities(graph: any): Map<number, string[]> {
    try {
      const operation = this.logger.operation('findCommunities');
      operation.info('Running Louvain community detection', { resolution: this.RESOLUTION });
      
      const nodeCount = graph.order;
      const edgeCount = graph.size;
      
      // For very small graphs, just use one community
      // Mostly to handle test cases or edge cases where Louvain might not work well
      if (nodeCount <= 5) {
        operation.info('Using simplified community detection approach', { 
          nodes: nodeCount, 
          edges: edgeCount,
          reason: 'Very small graph'
        });
        
        // Put all nodes in the same community
        const allNodes = graph.nodes();
        const communities = new Map<number, string[]>();
        communities.set(0, allNodes);
        
        // Update the wallet-to-community mapping
        this.processCommunityResults(communities);
        
        operation.info('Simplified community detection results', { 
          communityCount: 1, 
          totalNodes: allNodes.length
        });
        
        operation.end();
        return communities;
      }
      
      // For larger graphs, use the standard Louvain algorithm
      const startTime = Date.now();
      const communities = louvain(graph, { resolution: this.RESOLUTION });
      const endTime = Date.now();
      
      // Convert from algorithm result to our Map format
      const communityMap = new Map<number, string[]>();
      
      // Group nodes by community
      for (const node of graph.nodes()) {
        const communityId = communities[node];
        
        if (!communityMap.has(communityId)) {
          communityMap.set(communityId, []);
        }
        
        communityMap.get(communityId)!.push(node);
      }
      
      // Update the wallet-to-community mapping
      this.processCommunityResults(communityMap);
      
      operation.info('Community detection algorithm completed', { 
        durationMs: (endTime - startTime).toFixed(2),
        communityCount: communityMap.size
      });
      
      operation.end();
      return communityMap;
    } catch (error) {
      this.logger.error('Error during community detection', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      // Fallback to single community containing all nodes
      const allNodes = graph.nodes();
      const communities = new Map<number, string[]>();
      communities.set(0, allNodes);
      
      // Update the wallet-to-community mapping even in error case
      this.processCommunityResults(communities);
      
      return communities;
    }
  }
  
  /**
   * Log statistics for the cached communities
   */
  public logStatistics(): void {
    if (this.communityGroups.size === 0) {
      this.logger.info('No community partitions in cache');
      return;
    }
    
    const totalWallets = Array.from(this.communityGroups.values())
      .reduce((sum, group) => sum + group.length, 0);
    
    this.logger.info('Community partitioning statistics', {
      communities: this.communityGroups.size,
      totalWallets,
      cacheAgeSecs: ((Date.now() - this.lastPartitionTime) / 1000).toFixed(1),
      graphSize: this.lastGraphSize,
      processingTimeMs: this.lastProcessingTime
    });
  }
} 