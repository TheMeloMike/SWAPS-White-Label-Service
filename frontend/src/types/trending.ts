import { NFTMetadata } from './nft'; // Assuming NFTMetadata is defined in frontend/src/types/nft.ts

/**
 * Represents an NFT trending based on want list frequency.
 */
export interface TrendingWantedNft {
  nftAddress: string;
  wantCount: number;
  metadata?: NFTMetadata; 
}

/**
 * Represents an NFT or Collection trending based on appearance in high-potential trade loops.
 */
export interface TrendingLoopItem {
  itemId: string; 
  itemType: 'NFT' | 'Collection';
  displayName: string;
  imageUrl?: string;
  appearanceInLoops: number;
  averageLoopScore?: number;
  nftMetadata?: NFTMetadata[]; 
}

/**
 * Combined trending data payload from the backend.
 */
export interface TrendingData {
  topWantedNfts: TrendingWantedNft[];
  topLoopItems: TrendingLoopItem[];
} 