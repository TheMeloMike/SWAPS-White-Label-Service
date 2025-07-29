export interface NFTMetadata {
  name: string;
  symbol: string;
  description: string;
  address: string;
  uri: string;
  attributes: NFTAttribute[];
  walletOwner: string;
}

export interface NFTAttribute {
  trait_type: string;
  value: string | number;
}

export interface NFTGenerationConfig {
  totalNFTs: number;
  symbol: string;
  baseUri: string;
  sellerFeeBasisPoints: number;
} 