import { UnifiedTradeGraph } from './interfaces/UnifiedTradeGraph';
import { UnifiedTradeGraphService } from './UnifiedTradeGraphService';
import { WalletState, RejectionPreferences } from '../../types/trade';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';

/**
 * Graph Abstraction Adapter
 * 
 * This adapter allows existing trade finder services (TradeLoopFinderService,
 * ScalableTradeLoopFinderService, etc.) to work with collection-enhanced graphs
 * without requiring any modifications to their sophisticated algorithms.
 * 
 * The adapter presents the familiar Map<string, Set<string>> interface while
 * internally using the UnifiedTradeGraph for collection support.
 */
export class GraphAbstractionAdapter {
  private static instance: GraphAbstractionAdapter;
  private logger: Logger;
  private graphService: UnifiedTradeGraphService;
  
  // Current graph being used
  private currentGraph: UnifiedTradeGraph | null = null;
  private graphMetadata: {
    type: 'standard' | 'collection-aware';
    buildTime: number;
    stats: any;
  } | null = null;

  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('GraphAbstractionAdapter');
    this.graphService = UnifiedTradeGraphService.getInstance();
  }

  public static getInstance(): GraphAbstractionAdapter {
    if (!GraphAbstractionAdapter.instance) {
      GraphAbstractionAdapter.instance = new GraphAbstractionAdapter();
    }
    return GraphAbstractionAdapter.instance;
  }

  /**
   * Initialize with standard graph (backwards compatible)
   * This allows existing code to work without changes
   */
  public async initializeStandardGraph(
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences?: Map<string, RejectionPreferences>
  ): Promise<void> {
    const operation = this.logger.operation('initializeStandardGraph');
    
    try {
      const startTime = Date.now();
      
      this.currentGraph = await this.graphService.buildGraph(
        wallets,
        nftOwnership,
        wantedNfts,
        rejectionPreferences
      );
      
      this.graphMetadata = {
        type: 'standard',
        buildTime: Date.now() - startTime,
        stats: this.currentGraph.getStats()
      };
      
      operation.info('Standard graph initialized', this.graphMetadata);
      operation.end();
    } catch (error) {
      operation.error('Failed to initialize standard graph', {
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Initialize with collection-aware graph
   * This enables the enhanced collection trading capabilities
   */
  public async initializeCollectionAwareGraph(
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    collectionWants: Map<string, Set<string>>,
    rejectionPreferences?: Map<string, RejectionPreferences>
  ): Promise<void> {
    const operation = this.logger.operation('initializeCollectionAwareGraph');
    
    try {
      const startTime = Date.now();
      
      this.currentGraph = await this.graphService.buildCollectionAwareGraph(
        wallets,
        nftOwnership,
        wantedNfts,
        collectionWants,
        rejectionPreferences
      );
      
      this.graphMetadata = {
        type: 'collection-aware',
        buildTime: Date.now() - startTime,
        stats: this.currentGraph.getStats()
      };
      
      operation.info('Collection-aware graph initialized', this.graphMetadata);
      operation.end();
    } catch (error) {
      operation.error('Failed to initialize collection-aware graph', {
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Get the familiar wantedNfts map that existing algorithms expect
   * This is the key compatibility method that translates the enhanced graph
   * back to the format that Johnson's Algorithm, Tarjan's, etc. can use
   */
  public getWantedNfts(): Map<string, Set<string>> {
    if (!this.currentGraph) {
      throw new Error('Graph not initialized. Call initializeStandardGraph() or initializeCollectionAwareGraph() first.');
    }

    const wantedNfts = new Map<string, Set<string>>();
    const allNfts = this.currentGraph.getAllNFTs();
    
    // Build the traditional wantedNfts map from the unified graph
    for (const nft of allNfts) {
      const wanters = this.currentGraph.getWanters(nft);
      if (wanters.size > 0) {
        wantedNfts.set(nft, new Set(wanters));
      }
    }
    
    return wantedNfts;
  }

  /**
   * Get NFT ownership map (compatible with existing algorithms)
   */
  public getNftOwnership(): Map<string, string> {
    if (!this.currentGraph) {
      throw new Error('Graph not initialized');
    }

    const ownership = new Map<string, string>();
    const allNfts = this.currentGraph.getAllNFTs();
    
    for (const nft of allNfts) {
      const owner = this.currentGraph.getOwner(nft);
      if (owner) {
        ownership.set(nft, owner);
      }
    }
    
    return ownership;
  }

  /**
   * Get all wallet nodes (compatible with existing algorithms)
   */
  public getWalletNodes(): string[] {
    if (!this.currentGraph) {
      throw new Error('Graph not initialized');
    }

    return this.currentGraph.getNodes();
  }

  /**
   * Check if there's an edge between two wallets
   * This maintains the interface that existing algorithms use for graph traversal
   */
  public hasEdge(from: string, to: string): boolean {
    if (!this.currentGraph) {
      return false;
    }

    return this.currentGraph.hasEdge(from, to) !== null;
  }

  /**
   * Get edge data between two wallets
   * Provides additional metadata for enhanced algorithms that want to use it
   */
  public getEdgeData(from: string, to: string): {
    nft: string;
    isCollectionDerived: boolean;
    sourceCollection?: string;
    weight: number;
  } | null {
    if (!this.currentGraph) {
      return null;
    }

    const edgeData = this.currentGraph.hasEdge(from, to);
    if (!edgeData) {
      return null;
    }

    return {
      nft: edgeData.nft,
      isCollectionDerived: edgeData.isCollectionDerived || false,
      sourceCollection: edgeData.sourceCollection,
      weight: edgeData.weight || 1.0
    };
  }

  /**
   * Get graph statistics for monitoring and optimization
   */
  public getGraphStats(): {
    type: 'standard' | 'collection-aware';
    buildTime: number;
    nodeCount: number;
    edgeCount: number;
    collectionDerivedEdges: number;
    directEdges: number;
    avgConnectionsPerNode: number;
    hasCollectionSupport: boolean;
  } {
    if (!this.currentGraph || !this.graphMetadata) {
      throw new Error('Graph not initialized');
    }

    const stats = this.currentGraph.getStats();
    
    return {
      type: this.graphMetadata.type,
      buildTime: this.graphMetadata.buildTime,
      nodeCount: stats.nodeCount,
      edgeCount: stats.edgeCount,
      collectionDerivedEdges: stats.collectionDerivedEdges,
      directEdges: stats.directEdges,
      avgConnectionsPerNode: stats.avgConnectionsPerNode,
      hasCollectionSupport: this.currentGraph.hasCollectionSupport()
    };
  }

  /**
   * Helper method for existing algorithms that need to traverse the graph
   * This provides the traditional adjacency list representation
   */
  public getAdjacencyList(): Map<string, Map<string, string>> {
    if (!this.currentGraph) {
      throw new Error('Graph not initialized');
    }

    const adjacencyList = new Map<string, Map<string, string>>();
    const nodes = this.currentGraph.getNodes();
    
    for (const node of nodes) {
      const edges = this.currentGraph.getEdges(node);
      const adjacentNodes = new Map<string, string>();
      
      for (const [targetNode, edgeData] of edges) {
        // Store the NFT being traded as the edge weight/label
        adjacentNodes.set(targetNode, edgeData.nft);
      }
      
      adjacencyList.set(node, adjacentNodes);
    }
    
    return adjacencyList;
  }

  /**
   * Get enhanced adjacency list with full edge metadata
   * For algorithms that want to take advantage of collection metadata
   */
  public getEnhancedAdjacencyList(): Map<string, Map<string, {
    nft: string;
    isCollectionDerived: boolean;
    sourceCollection?: string;
    weight: number;
    metadata?: Record<string, any>;
  }>> {
    if (!this.currentGraph) {
      throw new Error('Graph not initialized');
    }

    const adjacencyList = new Map();
    const nodes = this.currentGraph.getNodes();
    
    for (const node of nodes) {
      const edges = this.currentGraph.getEdges(node);
      const adjacentNodes = new Map();
      
      for (const [targetNode, edgeData] of edges) {
        adjacentNodes.set(targetNode, {
          nft: edgeData.nft,
          isCollectionDerived: edgeData.isCollectionDerived || false,
          sourceCollection: edgeData.sourceCollection,
          weight: edgeData.weight || 1.0,
          metadata: edgeData.metadata
        });
      }
      
      adjacencyList.set(node, adjacentNodes);
    }
    
    return adjacencyList;
  }

  /**
   * Check if the current graph has collection support
   */
  public hasCollectionSupport(): boolean {
    return this.currentGraph?.hasCollectionSupport() || false;
  }

  /**
   * Reset the adapter (useful for testing or switching graphs)
   */
  public reset(): void {
    this.currentGraph = null;
    this.graphMetadata = null;
    this.logger.info('Graph abstraction adapter reset');
  }

  /**
   * Get all NFTs that a specific wallet wants
   * This is a convenience method for existing algorithm compatibility
   */
  public getWalletWants(walletAddress: string): Set<string> {
    if (!this.currentGraph) {
      return new Set();
    }

    const wants = new Set<string>();
    const allNfts = this.currentGraph.getAllNFTs();
    
    for (const nft of allNfts) {
      const wanters = this.currentGraph.getWanters(nft);
      if (wanters.has(walletAddress)) {
        wants.add(nft);
      }
    }
    
    return wants;
  }

  /**
   * Get all NFTs owned by a specific wallet
   * This reconstructs ownership from the graph
   */
  public getWalletOwnedNfts(walletAddress: string): Set<string> {
    if (!this.currentGraph) {
      return new Set();
    }

    const owned = new Set<string>();
    const allNfts = this.currentGraph.getAllNFTs();
    
    for (const nft of allNfts) {
      const owner = this.currentGraph.getOwner(nft);
      if (owner === walletAddress) {
        owned.add(nft);
      }
    }
    
    return owned;
  }
} 