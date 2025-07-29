/**
 * Trade-related type definitions
 */

/**
 * Collection metadata interface
 */
export interface CollectionMetadata {
  id: string;
  name: string;
  symbol?: string;
  description?: string;
  image?: string;
  verified: boolean;
  floorPrice: number;
  volume24h: number;
  totalSupply: number;
  nftCount: number;
  sources: string[]; // ['magiceden', 'tensor', 'opensea']
  lastUpdated: Date;
  createdAt?: Date;
  website?: string;
  twitter?: string;
  discord?: string;
}

/**
 * Collection search result
 */
export interface CollectionSearchResult {
  collection: CollectionMetadata;
  relevanceScore: number;
  matchType: 'exact' | 'partial' | 'fuzzy';
}

/**
 * Collection resolution in trade loops
 */
export interface CollectionResolution {
  collectionId: string;
  collectionName: string;
  resolvedNFT: string;
  alternativeNFTs: string[];
  resolutionReason: 'value_match' | 'floor_price' | 'user_preference' | 'liquidity';
  confidence: number;
}

/**
 * Collection configuration and limits
 */
export interface CollectionConfig {
  enabled: boolean;
  maxCollectionSize: number;          // Maximum NFTs to expand per collection
  maxCollectionsPerWallet: number;    // Maximum collections a wallet can want
  cacheTimeout: number;               // Collection cache TTL in ms
  batchSize: number;                  // Batch processing size
  fallbackToSampling: boolean;        // Use sampling for large collections
  apiTimeout: number;                 // API call timeout in ms
  maxExpansionPerRequest: number;     // Max total NFT expansions per request
}

/**
 * Collection expansion metrics
 */
export interface CollectionExpansionMetrics {
  collectionId: string;
  originalSize: number;
  expandedSize: number;
  sampledSize?: number;
  expansionTime: number;
  hitRateLimit: boolean;
  usedSampling: boolean;
  timestamp: Date;
}

/**
 * Collection trade analytics
 */
export interface CollectionTradeAnalytics {
  collectionId: string;
  totalTrades: number;
  successfulTrades: number;
  averageTradeSize: number;
  popularityScore: number;
  lastTradeDate?: Date;
  topTradedNFTs: string[];
}

/**
 * Enhanced trade loop with collection support
 */
export interface CollectionAwareTradeLoop extends TradeLoop {
  collectionResolutions: Map<string, CollectionResolution>;
  hasCollectionTrades: boolean;
  collectionCount: number;
  crossCollectionTrade: boolean;
}

/**
 * Represents a wallet's state in the trade discovery system
 */
export interface WalletState {
  address: string;
  ownedNfts: Set<string>;
  wantedNfts: Set<string>;
  lastUpdated: Date;
  
  // Collection-level wants and ownership
  ownedCollections?: Map<string, string[]>; // collection -> owned NFTs in that collection
  wantedCollections?: Set<string>; // collections this wallet wants any NFT from
}

/**
 * Represents a trade request from a wallet
 */
export interface TradeRequest {
  walletAddress: string;
  hasNft: string;
  wantsNft: string;
  timestamp: Date;
}

/**
 * Internal representation of a discovered trade loop
 */
export interface DiscoveredTradeLoop {
  path: string[];
  nftPath: string[];
  efficiency: number;
  score?: number;
}

/**
 * Public representation of a trade loop
 */
export interface TradeLoop {
  id: string;
  steps: {
    from: string;
    to: string;
    nfts: Array<{
      address: string;
      name: string;
      symbol: string;
      image: string;
      collection: string;
      description: string;
      floorPrice?: number;          // Floor price in SOL
      owner?: string;               // Owner wallet address
      usedRealPrice?: boolean;      // Indicates if a real price was fetched
      hasFloorPrice?: boolean;      // Indicates if the NFT has a floor price
      priceSource?: string;         // Where the price data came from
    }>;
    completed?: boolean;
    completedAt?: Date;
    transactionSignature?: string;
  }[];
  totalParticipants: number;
  efficiency: number;               // Quality score based on participants, etc.
  rawEfficiency: number;            // Raw efficiency (1/participants)
  estimatedValue: number;           // Average NFT value
  qualityScore?: number;            // Enhanced quality score
  qualityMetrics?: Record<string, number>; // Detailed quality metrics
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  progress?: number;                // Completion progress (0-100)
  createdAt?: Date;                 // When the trade was discovered
  completedAt?: Date;               // When the trade was completed
  isBundle?: boolean;               // Whether this trade is a bundle of multiple NFTs
  
  // New properties for trade submission
  isExplicitlySubmitted?: boolean;
  submittedBy?: string;
  submittedAt?: string;
}

/**
 * Represents a user's rejection preferences
 */
export interface RejectionPreferences {
  wallets: Set<string>; // Wallets this wallet doesn't want to trade with
  nfts: Set<string>;    // NFTs this wallet doesn't want
}

/**
 * Stores metrics about NFT demand
 */
export interface NFTDemandMetrics {
  wantCount: number;     // How many wallets want this NFT
  supplyCount: number;   // How many of this NFT exist 
  demandRatio: number;   // wantCount / supplyCount
  requestCount: number;  // Number of requests for this NFT
  lastRequested: Date;   // When this NFT was last requested
  mint?: string;         // Legacy: The NFT mint address
}

/**
 * Interface for collection demand metrics
 */
export interface CollectionDemandMetrics {
  collectionId: string;
  wantCount: number;     // How many wallets want NFTs from this collection
  totalNfts: number;     // Total NFTs in the collection
  demandRatio: number;   // Average demand ratio across all NFTs
}

/**
 * Settings for controlling trade discovery parameters
 */
export interface TradeDiscoverySettings {
  maxDepth?: number;            // Max participants in a loop
  minEfficiency?: number;       // Minimum trade efficiency (0-1)
  maxResults?: number;          // Max trades to return
  includeDirectTrades?: boolean;// Include 2-party trades
  includeMultiPartyTrades?: boolean; // Include 3+ party trades
  considerCollections?: boolean;// Consider collection-level wants
  timeoutMs?: number;           // Timeout for the discovery process
  walletAddress?: string;     // Optional: The wallet address of the user initiating the search
  nftAddress?: string;        // Optional: The specific NFT address the user is interested in
}

/**
 * Represents value record for an NFT
 */
export interface NFTValueRecord {
  mint: string;
  estimatedValue: number;
  lastUpdated: Date;
}

/**
 * Data for a completed trade step
 */
export interface CompletedTradeStep {
  from: string;
  to: string;
  nfts: string[];
  transactionSignature: string;
  timestamp: Date;
}

/**
 * Data for prepared contract trade
 */
export interface PreparedTradeData {
  participants: string[];
  nfts: string[];
  serialized: string;
}

/**
 * Represents NFT metadata
 */
export interface NFTMetadata {
  address: string;
  name: string;
  symbol: string;
  image: string;
  collection: string;
  description: string;
  floorPrice?: number;
  owner?: string;
  usedRealPrice?: boolean;
  hasFloorPrice?: boolean;
  priceSource?: string;
  ownershipValid?: boolean;
} 