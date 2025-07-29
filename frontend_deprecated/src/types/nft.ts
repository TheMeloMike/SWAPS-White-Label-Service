import { PublicKey } from '@solana/web3.js';

/**
 * Represents NFT collection data
 */
export interface NFTCollectionData {
  name: string;
  description?: string;
  address?: string;
}

export interface NFT {
  mint: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  image?: string;
  attributes?: NFTAttribute[];
  estimatedValue?: number; // For value matching
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