import { NFTMetadata } from './nft';

/**
 * Collection search result interface
 */
export interface CollectionSearchResult {
  id: string;
  name: string;
  description?: string;
  verified: boolean;
  nftCount: number;
  floorPrice: number;
  volume24h: number;
  imageUrl?: string;
}

/**
 * Collection resolution metadata
 */
export interface CollectionResolution {
  collectionId: string;
  collectionName: string;
  resolvedNFT: string;
  alternativeNFTs: string[];
  resolutionReason: 'liquidity' | 'value' | 'preference' | 'availability';
  confidence: number;
}

/**
 * Enhanced NFT metadata with collection information
 */
export interface EnhancedNFTMetadata extends NFTMetadata {
  collectionId?: string;
  collectionVerified?: boolean;
  rarity?: {
    rank: number;
    score: number;
  };
}

/**
 * Represents a single step in a trading loop
 */
export interface TradeStep {
  from: string;
  to: string;
  nfts: NFTMetadata[];
  solAdjustment?: number;
}

/**
 * Enhanced trade loop with collection metadata
 */
export interface TradeLoop {
  id: string;
  steps: TradeStep[];
  totalParticipants: number;
  efficiency: number;
  estimatedValue: number;
  createdAt?: string | Date;
  expiresAt?: string | Date;
  // Collection-specific properties
  collectionResolutions?: Map<string, CollectionResolution>;
  hasCollectionTrades?: boolean;
  collectionCount?: number;
  crossCollectionTrade?: boolean;
  qualityScore?: number;
  qualityMetrics?: Record<string, number>;
  collectionMetrics?: {
    hasCollectionTrades: boolean;
    uniqueCollections: number;
    crossCollectionTrade: boolean;
    collectionDiversityRatio: number;
    averageCollectionFloor: number;
  };
  // Highlighting properties for newly discovered trades
  isNewlyDiscovered?: boolean;
  searchedNFTAddress?: string;
  searchedCollectionId?: string;
}

/**
 * Collection want preference
 */
export interface CollectionWant {
  walletAddress: string;
  collectionId: string;
  collectionName: string;
  preferences?: {
    maxPrice?: number;
    minRarity?: number;
    specificTraits?: Record<string, string[]>;
  };
  createdAt: Date;
}

/**
 * Represents a request for a trade
 */
export interface TradeRequest {
  walletAddress: string;
  desiredNft?: string;
  desiredCollection?: string;
  preferences?: {
    maxPrice?: number;
    minRarity?: number;
  };
}

/**
 * Represents a potential trade match
 */
export interface PotentialTrade {
  tradeId: string;
  userNfts: {
    address: string;
    name: string;
    image?: string;
    collection?: string;
  }[];
  targetNft: {
    address: string;
    name: string;
    image?: string;
    collection?: string;
  };
  efficiency: number; // How good the match is (0-100%)
  hasCollectionMatch?: boolean;
}

/**
 * Response from the trade discovery API
 */
export interface TradeResponse {
  success: boolean;
  trades: TradeLoop[];
  poolState?: {
    size: number;
    walletCount: number;
  };
  collectionStats?: {
    collectionsSupported: number;
    collectionWants: number;
    collectionTrades: number;
  };
  error?: string;
}

/**
 * Collection discovery settings
 */
export interface CollectionDiscoverySettings {
  includeCollectionTrades?: boolean;
  minCollectionFloor?: number;
  maxCollectionFloor?: number;
  verifiedCollectionsOnly?: boolean;
  includeRarityData?: boolean;
} 