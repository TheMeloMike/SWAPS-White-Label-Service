import { PublicKey } from '@solana/web3.js';

/**
 * Enhanced NFT collection data with additional metadata
 */
export interface NFTCollectionData {
  name: string;
  description?: string;
  address?: string;
  id?: string;
  verified?: boolean;
  floorPrice?: number;
  volume24h?: number;
  nftCount?: number;
  imageUrl?: string;
  createdAt?: Date;
}

/**
 * Collection metadata for indexing and search
 */
export interface CollectionMetadata {
  id: string;
  name: string;
  description?: string;
  verified: boolean;
  nftCount: number;
  floorPrice: number;
  volume24h: number;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Collection search options
 */
export interface CollectionSearchOptions {
  query: string;
  limit?: number;
  verified?: boolean;
  minFloor?: number;
  maxFloor?: number;
  minVolume?: number;
}

export interface NFT {
  mint: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  image?: string;
  attributes?: NFTAttribute[];
  estimatedValue?: number; // For value matching
  collection?: NFTCollectionData;
  rarity?: {
    rank: number;
    score: number;
  };
}

export type NFTAttribute = {
  trait_type: string;
  value: string | number;
};

export interface NFTCollectionStats {
  name: string;
  floorPrice?: number; // In SOL
  totalVolume?: number;
  listedCount?: number;
  totalCount?: number;
  verified?: boolean;
  volume24h?: number;
}

export interface NFTMetadata {
  address: string;
  name: string;
  symbol: string;
  image: string;
  collection?: string | NFTCollectionData;
  description?: string;
  owner?: string;
  ownershipMismatch?: boolean;
  attributes?: Array<{
    trait_type: string;
    value: string;
  }>;
  isMagicEdenBadged?: boolean;
  floorPrice?: number; // In SOL
  createdAt?: number; // Timestamp for when the NFT was created/minted
  updatedAt?: number; // Timestamp for when the NFT was last updated
  // Enhanced collection properties
  collectionId?: string;
  collectionVerified?: boolean;
  rarity?: {
    rank: number;
    score: number;
  };
}

export interface TradeLoop {
  participants: TradeParticipant[];
  totalValue: number;
  efficiency: number; // Loop efficiency score
  status: 'pending' | 'active' | 'completed';
}

export interface TradeParticipant {
  wallet: PublicKey;
  offeredNFTs: NFT[];
  receivingNFTs: NFT[];
  solAdjustment?: number; // SOL to send/receive for value matching
} 