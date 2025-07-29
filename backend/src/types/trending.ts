import { NFTMetadata } from './nft';

/**
 * Represents an NFT trending based on want list frequency.
 */
export interface TrendingWantedNft {
  nftAddress: string;
  wantCount: number;
  metadata?: NFTMetadata; // Enriched with metadata after fetching
}

/**
 * Represents an NFT or Collection trending based on appearance in high-potential trade loops.
 */
export interface TrendingLoopItem {
  itemId: string; // NFT address or Collection identifier
  itemType: 'NFT' | 'Collection';
  displayName: string;
  imageUrl?: string;
  appearanceInLoops: number;
  averageLoopScore?: number;
  nftMetadata?: NFTMetadata[]; // If itemType is Collection, can include sample NFTs
}

/**
 * Combined trending data payload.
 */
export interface TrendingData {
  topWantedNfts: TrendingWantedNft[];
  topLoopItems: TrendingLoopItem[];
} 