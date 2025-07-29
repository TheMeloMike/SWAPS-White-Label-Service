export interface NFTMetadata {
  address: string;
  name: string;
  symbol: string;
  image?: string;
  collection?: string;
  estimatedValue?: number;
}

export interface TradeLoop {
  id: string;
  steps: TradeStep[];
  totalParticipants: number;
  efficiency: number;
  estimatedValue: number;
}

export interface TradeStep {
  from: string;
  to: string;
  nfts: NFTMetadata[];
  solAdjustment?: number;
} 