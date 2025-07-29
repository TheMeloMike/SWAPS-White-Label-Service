/**
 * Unified Trade Graph Interface
 * 
 * This interface provides a standardized way to access trade graph data
 * regardless of whether it contains direct NFT wants, collection wants,
 * or a combination of both. All existing algorithms can work through
 * this interface without modification.
 */

export interface GraphEdgeData {
  /** The NFT address being traded */
  nft: string;
  /** Whether this edge was created from a collection want */
  isCollectionDerived?: boolean;
  /** Original collection want that created this edge (if applicable) */
  sourceCollection?: string;
  /** Weight/priority of this edge for pathfinding */
  weight?: number;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface UnifiedTradeGraph {
  /**
   * Get all wallet addresses in the graph
   */
  getNodes(): string[];
  
  /**
   * Get all edges from a specific wallet
   * @param from Source wallet address
   * @returns Map of target wallet -> edge data
   */
  getEdges(from: string): Map<string, GraphEdgeData>;
  
  /**
   * Get all wallets that want a specific NFT
   * This is the key method that abstracts collection wants
   * @param nft NFT address
   * @returns Set of wallet addresses that want this NFT (directly or via collection)
   */
  getWanters(nft: string): Set<string>;
  
  /**
   * Get the owner of a specific NFT
   * @param nft NFT address  
   * @returns Owner wallet address or null
   */
  getOwner(nft: string): string | null;
  
  /**
   * Check if there's a potential trade edge between two wallets
   * @param from Source wallet
   * @param to Target wallet
   * @returns Edge data if edge exists, null otherwise
   */
  hasEdge(from: string, to: string): GraphEdgeData | null;
  
  /**
   * Get graph statistics for monitoring
   */
  getStats(): {
    nodeCount: number;
    edgeCount: number;
    collectionDerivedEdges: number;
    directEdges: number;
    avgConnectionsPerNode: number;
  };
  
  /**
   * Get all NFTs in the graph
   */
  getAllNFTs(): Set<string>;
  
  /**
   * Check if this graph includes collection-derived edges
   */
  hasCollectionSupport(): boolean;
}

/**
 * Builder interface for creating UnifiedTradeGraph instances
 */
export interface TradeGraphBuilder {
  /**
   * Create a graph from wallet states and ownership data
   */
  buildGraph(
    wallets: Map<string, any>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences?: Map<string, any>
  ): Promise<UnifiedTradeGraph>;
  
  /**
   * Create a graph with collection expansion enabled
   */
  buildCollectionAwareGraph(
    wallets: Map<string, any>,
    nftOwnership: Map<string, string>, 
    wantedNfts: Map<string, Set<string>>,
    collectionWants: Map<string, Set<string>>,
    rejectionPreferences?: Map<string, any>
  ): Promise<UnifiedTradeGraph>;
}

/**
 * Collection expansion result
 */
export interface CollectionExpansionResult {
  /** Original wants preserved */
  originalWants: Map<string, Set<string>>;
  /** Collection wants expanded to specific NFTs */
  expandedWants: Map<string, Set<string>>;
  /** Combined wants (original + expanded) */
  combinedWants: Map<string, Set<string>>;
  /** Mapping of which expanded wants came from which collections */
  expansionMetadata: Map<string, {
    collection: string;
    expandedFrom: string; // original collection want
    wallet: string;
  }>;
} 