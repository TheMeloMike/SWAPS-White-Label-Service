// Minimal type definitions for testing

export interface WalletState {
  address: string;
  ownedNfts: Set<string>;
  wantedNfts: Set<string>;
  lastUpdated: Date;
}

export interface RejectionPreferences {
  rejectedNfts?: Set<string>;
  rejectedWallets?: Set<string>;
}

export interface NFTMetadata {
  address: string;
  name: string;
  symbol: string;
  image: string;
  collection: string;
  description: string;
  floorPrice?: number;
  estimatedValue?: number;
  hasFloorPrice?: boolean;
  usedRealPrice?: boolean;
}

export interface TradeStep {
  from: string;
  to: string;
  nfts: NFTMetadata[];
}

export interface TradeLoop {
  id: string;
  steps: TradeStep[];
  totalParticipants: number;
  efficiency: number;
  rawEfficiency?: number;
  estimatedValue: number;
  status: string;
  progress: number;
  createdAt: Date;
  isBundle?: boolean;
  qualityScore?: number;
  qualityMetrics?: any;
} 