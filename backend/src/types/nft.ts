/**
 * NFT-related type definitions
 */

/**
 * Represents NFT collection data
 */
export interface NFTCollectionData {
  name: string;
  description?: string;
  address?: string;
}

/**
 * Basic NFT metadata interface
 */
export interface NFTMetadata {
  address: string;
  name: string;
  symbol: string;
  image: string;
  collection: string | { name: string; family: string };
  description: string;
  owner?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  floorPrice?: number;
  usedRealPrice?: boolean;
  hasFloorPrice?: boolean;
  priceSource?: string;
  isMagicEdenBadged?: boolean;
}

/**
 * NFT Collection data
 */
export interface NFTCollection {
  name: string;
  symbol: string;
  imageUrl?: string;
  description?: string;
  address?: string;
  floorPrice?: number;
  volume24h?: number;
  itemCount?: number;
  ownerCount?: number;
}

/**
 * Price history point for an NFT
 */
export interface NFTPricePoint {
  timestamp: number;
  price: number;
  marketplace?: string;
}

/**
 * NFT ownership data
 */
export interface NFTOwnership {
  nftAddress: string;
  ownerAddress: string;
  acquiredAt?: Date;
  previousOwner?: string;
}

/**
 * NFT collection information
 */
export interface CollectionInfo {
  name: string;
  family?: string;
  floorPrice?: number;
  volume24hr?: number;
  totalListings?: number;
  lastUpdated?: Date;
  symbol?: string;
}

/**
 * Marketplace data for NFTs
 */
export interface NFTMarketplaceData {
  floorPrice?: number;
  source: string;
  url?: string;
  volumeAll?: number;
  volume24hr?: number;
  lastUpdated: Date;
}

/**
 * NFT price estimation result
 */
export interface PriceEstimationResult {
  estimatedPrice: number;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  source: string;
  lastUpdated: Date;
}

/**
 * NFT rarity data
 */
export interface NFTRarityData {
  rank?: number;
  score?: number;
  totalSupply?: number;
  method?: string;
} 