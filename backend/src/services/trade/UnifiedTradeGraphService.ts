import { UnifiedTradeGraph, GraphEdgeData, TradeGraphBuilder, CollectionExpansionResult } from './interfaces/UnifiedTradeGraph';
import { CollectionAbstractionService } from './CollectionAbstractionService';
import { LocalCollectionService } from '../nft/LocalCollectionService';
import { SmartCollectionExpansionService } from './SmartCollectionExpansionService';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { performance } from 'perf_hooks';

/**
 * Concrete implementation of UnifiedTradeGraph
 * 
 * This is the core of our Graph Abstraction Layer that allows existing
 * algorithms to work with collection-enhanced graphs without modification.
 */
class UnifiedTradeGraphImpl implements UnifiedTradeGraph {
  private nodes: Set<string> = new Set();
  private edges: Map<string, Map<string, GraphEdgeData>> = new Map();
  private nftToWanters: Map<string, Set<string>> = new Map();
  private nftOwnership: Map<string, string> = new Map();
  private allNfts: Set<string> = new Set();
  private hasCollections: boolean = false;
  
  // Statistics
  private stats = {
    nodeCount: 0,
    edgeCount: 0,
    collectionDerivedEdges: 0,
    directEdges: 0,
    avgConnectionsPerNode: 0
  };

  constructor(
    nodes: Set<string>,
    edges: Map<string, Map<string, GraphEdgeData>>,
    nftToWanters: Map<string, Set<string>>,
    nftOwnership: Map<string, string>,
    hasCollections: boolean = false
  ) {
    this.nodes = nodes;
    this.edges = edges;
    this.nftToWanters = nftToWanters;
    this.nftOwnership = nftOwnership;
    this.hasCollections = hasCollections;
    this.allNfts = new Set(nftOwnership.keys());
    this.calculateStats();
  }

  private calculateStats(): void {
    this.stats.nodeCount = this.nodes.size;
    let totalEdges = 0;
    let collectionEdges = 0;
    
    for (const [_, edgeMap] of this.edges) {
      totalEdges += edgeMap.size;
      for (const [_, edgeData] of edgeMap) {
        if (edgeData.isCollectionDerived) {
          collectionEdges++;
        }
      }
    }
    
    this.stats.edgeCount = totalEdges;
    this.stats.collectionDerivedEdges = collectionEdges;
    this.stats.directEdges = totalEdges - collectionEdges;
    this.stats.avgConnectionsPerNode = this.stats.nodeCount > 0 ? totalEdges / this.stats.nodeCount : 0;
  }

  getNodes(): string[] {
    return Array.from(this.nodes);
  }

  getEdges(from: string): Map<string, GraphEdgeData> {
    return this.edges.get(from) || new Map();
  }

  getWanters(nft: string): Set<string> {
    return this.nftToWanters.get(nft) || new Set();
  }

  getOwner(nft: string): string | null {
    return this.nftOwnership.get(nft) || null;
  }

  hasEdge(from: string, to: string): GraphEdgeData | null {
    const fromEdges = this.edges.get(from);
    if (!fromEdges) return null;
    return fromEdges.get(to) || null;
  }

  getStats() {
    return { ...this.stats };
  }

  getAllNFTs(): Set<string> {
    return new Set(this.allNfts);
  }

  hasCollectionSupport(): boolean {
    return this.hasCollections;
  }
}

/**
 * Service that builds UnifiedTradeGraph instances with collection awareness
 * 
 * This is the bridge between the existing algorithm architecture and
 * our new collection-aware capabilities.
 */
export class UnifiedTradeGraphService implements TradeGraphBuilder {
  private static instance: UnifiedTradeGraphService;
  private logger: Logger;
  private collectionService: CollectionAbstractionService;
  private localCollectionService: LocalCollectionService;
  private smartExpansionService: SmartCollectionExpansionService;
  
  // Caching for performance
  private graphCache = new Map<string, {
    graph: UnifiedTradeGraph;
    timestamp: number;
  }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('UnifiedTradeGraph');
    this.collectionService = CollectionAbstractionService.getInstance();
    this.localCollectionService = LocalCollectionService.getInstance();
    this.smartExpansionService = SmartCollectionExpansionService.getInstance();
  }

  public static getInstance(): UnifiedTradeGraphService {
    if (!UnifiedTradeGraphService.instance) {
      UnifiedTradeGraphService.instance = new UnifiedTradeGraphService();
    }
    return UnifiedTradeGraphService.instance;
  }

  /**
   * Build a standard graph without collection expansion
   * This maintains backwards compatibility with existing code
   */
  public async buildGraph(
    wallets: Map<string, any>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences?: Map<string, any>
  ): Promise<UnifiedTradeGraph> {
    const operation = this.logger.operation('buildGraph');
    const startTime = performance.now();
    
    operation.info('Building standard trade graph', {
      wallets: wallets.size,
      nfts: nftOwnership.size,
      wants: wantedNfts.size
    });

    try {
      // Create cache key
      const cacheKey = this.createCacheKey('standard', wallets, wantedNfts);
      
      // Check cache
      const cached = this.graphCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        operation.info('Serving cached graph');
        operation.end();
        return cached.graph;
      }

      // Build graph structures
      const nodes = new Set<string>(wallets.keys());
      const edges = new Map<string, Map<string, GraphEdgeData>>();
      const nftToWanters = new Map<string, Set<string>>();

      // Initialize edge maps for all nodes
      for (const wallet of nodes) {
        edges.set(wallet, new Map<string, GraphEdgeData>());
      }

      // Build nft-to-wanters mapping
      for (const [nft, wanters] of wantedNfts) {
        nftToWanters.set(nft, new Set(wanters));
      }

      // Build edges based on wants
      for (const [nft, wanters] of wantedNfts) {
        const owner = nftOwnership.get(nft);
        if (!owner || !nodes.has(owner)) continue;

        for (const wanter of wanters) {
          if (!nodes.has(wanter) || wanter === owner) continue;
          
          // Check rejection preferences
          if (this.isRejected(owner, wanter, nft, rejectionPreferences)) continue;

          // Add edge from owner to wanter (NFT flow direction)
          const ownerEdges = edges.get(owner)!;
          ownerEdges.set(wanter, {
            nft,
            isCollectionDerived: false,
            weight: 1.0
          });
        }
      }

      const graph = new UnifiedTradeGraphImpl(
        nodes,
        edges,
        nftToWanters,
        nftOwnership,
        false // No collection support
      );

      // Cache the result
      this.graphCache.set(cacheKey, {
        graph,
        timestamp: Date.now()
      });

      const endTime = performance.now();
      operation.info('Standard graph built successfully', {
        duration: `${(endTime - startTime).toFixed(2)}ms`,
        stats: graph.getStats()
      });

      operation.end();
      return graph;
    } catch (error) {
      operation.error('Error building standard graph', {
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Build a collection-aware graph with expansion
   * This is the main enhancement that adds collection support
   */
  public async buildCollectionAwareGraph(
    wallets: Map<string, any>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    collectionWants: Map<string, Set<string>>,
    rejectionPreferences?: Map<string, any>
  ): Promise<UnifiedTradeGraph> {
    const operation = this.logger.operation('buildCollectionAwareGraph');
    const startTime = performance.now();
    
    operation.info('Building collection-aware trade graph', {
      wallets: wallets.size,
      nfts: nftOwnership.size,
      directWants: wantedNfts.size,
      collectionWants: collectionWants.size
    });

    try {
      // Create cache key
      const cacheKey = this.createCacheKey('collection', wallets, wantedNfts, collectionWants);
      
      // Check cache
      const cached = this.graphCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        operation.info('Serving cached collection-aware graph');
        operation.end();
        return cached.graph;
      }

      // Step 1: Expand collection wants to specific NFTs
      const expansionStartTime = performance.now();
      const expansionResult = await this.expandCollectionWants(
        collectionWants,
        nftOwnership,
        rejectionPreferences
      );
      const expansionTime = performance.now() - expansionStartTime;

      operation.info('Collection expansion completed', {
        expansionTime: `${expansionTime.toFixed(2)}ms`,
        originalWants: expansionResult.originalWants.size,
        expandedWants: expansionResult.expandedWants.size,
        combinedWants: expansionResult.combinedWants.size
      });

      // Step 2: Combine original wants with expanded wants
      const allWants = new Map<string, Set<string>>();
      
      // Add original direct wants
      for (const [nft, wanters] of wantedNfts) {
        allWants.set(nft, new Set(wanters));
      }
      
      // Add expanded collection wants
      for (const [nft, wanters] of expansionResult.combinedWants) {
        if (allWants.has(nft)) {
          // Merge with existing wants
          const existing = allWants.get(nft)!;
          for (const wanter of wanters) {
            existing.add(wanter);
          }
        } else {
          allWants.set(nft, new Set(wanters));
        }
      }

      // Step 3: Build graph structures
      const nodes = new Set<string>(wallets.keys());
      const edges = new Map<string, Map<string, GraphEdgeData>>();
      const nftToWanters = new Map<string, Set<string>>();

      // Initialize edge maps for all nodes
      for (const wallet of nodes) {
        edges.set(wallet, new Map<string, GraphEdgeData>());
      }

      // Build nft-to-wanters mapping
      for (const [nft, wanters] of allWants) {
        nftToWanters.set(nft, new Set(wanters));
      }

      // Step 4: Build edges with collection metadata
      for (const [nft, wanters] of allWants) {
        const owner = nftOwnership.get(nft);
        if (!owner || !nodes.has(owner)) continue;

        for (const wanter of wanters) {
          if (!nodes.has(wanter) || wanter === owner) continue;
          
          // Check rejection preferences
          if (this.isRejected(owner, wanter, nft, rejectionPreferences)) continue;

          // Determine if this is a collection-derived want
          const isCollectionDerived = !wantedNfts.get(nft)?.has(wanter);
          const expansionMeta = expansionResult.expansionMetadata.get(`${wanter}:${nft}`);

          // Add edge from owner to wanter
          const ownerEdges = edges.get(owner)!;
          ownerEdges.set(wanter, {
            nft,
            isCollectionDerived,
            sourceCollection: expansionMeta?.collection,
            weight: isCollectionDerived ? 0.9 : 1.0, // Slight preference for direct wants
            metadata: expansionMeta ? {
              expandedFrom: expansionMeta.expandedFrom,
              collection: expansionMeta.collection
            } : undefined
          });
        }
      }

      const graph = new UnifiedTradeGraphImpl(
        nodes,
        edges,
        nftToWanters,
        nftOwnership,
        true // Has collection support
      );

      // Cache the result
      this.graphCache.set(cacheKey, {
        graph,
        timestamp: Date.now()
      });

      const endTime = performance.now();
      operation.info('Collection-aware graph built successfully', {
        duration: `${(endTime - startTime).toFixed(2)}ms`,
        expansionTime: `${expansionTime.toFixed(2)}ms`,
        stats: graph.getStats()
      });

      operation.end();
      return graph;
    } catch (error) {
      operation.error('Error building collection-aware graph', {
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Expand collection wants to specific NFT wants
   */
  private async expandCollectionWants(
    collectionWants: Map<string, Set<string>>,
    nftOwnership: Map<string, string>,
    rejectionPreferences?: Map<string, any>
  ): Promise<CollectionExpansionResult> {
    const operation = this.logger.operation('expandCollectionWants');
    
    try {
      const originalWants = new Map<string, Set<string>>();
      const expandedWants = new Map<string, Set<string>>();
      const expansionMetadata = new Map<string, {
        collection: string;
        expandedFrom: string;
        wallet: string;
      }>();

      // Process each wallet's collection wants
      for (const [wallet, collections] of collectionWants) {
        for (const collection of collections) {
          // Use smart expansion service instead of full expansion
          const expansionResult = await this.smartExpansionService.expandCollection(
            collection,
            nftOwnership,
            {
              prioritizeAvailable: true,
              considerTradeVelocity: true
            }
          );
          
          operation.info(`Smart expansion for collection ${collection} for wallet ${wallet}`, {
            totalNFTs: expansionResult.totalNFTs,
            sampledNFTs: expansionResult.sampledNFTs.length,
            strategy: expansionResult.strategy.strategyType,
            confidence: expansionResult.confidence
          });

          for (const nft of expansionResult.sampledNFTs) {
            // Skip if NFT doesn't exist in ownership
            if (!nftOwnership.has(nft)) continue;
            
            // Skip if wallet already owns this NFT
            const owner = nftOwnership.get(nft);
            if (owner === wallet) continue;

            // Skip if rejected
            if (this.isRejected(owner!, wallet, nft, rejectionPreferences)) continue;

            // Add to expanded wants
            if (!expandedWants.has(nft)) {
              expandedWants.set(nft, new Set());
            }
            expandedWants.get(nft)!.add(wallet);

            // Store expansion metadata
            expansionMetadata.set(`${wallet}:${nft}`, {
              collection,
              expandedFrom: collection,
              wallet
            });
          }
        }
      }

      // Create combined wants
      const combinedWants = new Map<string, Set<string>>();
      for (const [nft, wanters] of expandedWants) {
        combinedWants.set(nft, new Set(wanters));
      }

      operation.info('Smart collection expansion completed', {
        totalExpanded: expandedWants.size,
        totalMetadata: expansionMetadata.size
      });

      operation.end();
      return {
        originalWants,
        expandedWants,
        combinedWants,
        expansionMetadata
      };
    } catch (error) {
      operation.error('Error expanding collection wants', {
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Check if a trade is rejected based on preferences
   */
  private isRejected(
    owner: string,
    wanter: string,
    nft: string,
    rejectionPreferences?: Map<string, any>
  ): boolean {
    if (!rejectionPreferences) return false;

    const ownerPrefs = rejectionPreferences.get(owner);
    const wanterPrefs = rejectionPreferences.get(wanter);

    // Check if owner rejects this wanter
    if (ownerPrefs?.wallets?.has(wanter)) return true;
    
    // Check if owner rejects this NFT
    if (ownerPrefs?.nfts?.has(nft)) return true;
    
    // Check if wanter rejects this owner
    if (wanterPrefs?.wallets?.has(owner)) return true;
    
    // Check if wanter rejects this NFT
    if (wanterPrefs?.nfts?.has(nft)) return true;

    return false;
  }

  /**
   * Create a cache key for graph caching
   */
  private createCacheKey(
    type: string,
    wallets: Map<string, any>,
    wantedNfts: Map<string, Set<string>>,
    collectionWants?: Map<string, Set<string>>
  ): string {
    const walletHash = Array.from(wallets.keys()).sort().join(',');
    const wantsHash = Array.from(wantedNfts.entries())
      .map(([nft, wanters]) => `${nft}:${Array.from(wanters).sort().join(',')}`)
      .sort()
      .join(';');
    
    let key = `${type}:${walletHash}:${wantsHash}`;
    
    if (collectionWants) {
      const collectionHash = Array.from(collectionWants.entries())
        .map(([wallet, collections]) => `${wallet}:${Array.from(collections).sort().join(',')}`)
        .sort()
        .join(';');
      key += `:${collectionHash}`;
    }
    
    // Use hash to keep key size manageable
    return Buffer.from(key).toString('base64').substring(0, 64);
  }

  /**
   * Clear expired cache entries
   */
  public cleanupCache(): void {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.graphCache) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.graphCache.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      this.logger.info(`Cleaned up ${removed} expired graph cache entries`);
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats() {
    return {
      size: this.graphCache.size,
      maxSize: 100, // Could be configurable
      ttl: this.CACHE_TTL
    };
  }
} 