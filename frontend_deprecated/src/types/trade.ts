import { NFTMetadata } from './nft';

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
 * Represents a complete trade loop involving multiple parties
 */
export interface TradeLoop {
  id: string;
  steps: TradeStep[];
  totalParticipants: number;
  efficiency: number;
  estimatedValue: number;
  createdAt?: string | Date;
  expiresAt?: string | Date;
}

/**
 * Represents a request for a trade
 */
export interface TradeRequest {
  walletAddress: string;
  desiredNft: string;
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
  }[];
  targetNft: {
    address: string;
    name: string;
    image?: string;
  };
  efficiency: number; // How good the match is (0-100%)
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
  error?: string;
} 