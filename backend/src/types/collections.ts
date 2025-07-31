/**
 * Collection-related type definitions for SWAPS White Label API
 */

export interface CollectionMetadata {
  id: string;
  name: string;
  symbol: string;
  description: string;
  totalSupply: number;
  floorPrice: number;
  verified: boolean;
  image?: string;
  website?: string;
  discord?: string;
  twitter?: string;
}

export interface CollectionSummary {
  id: string;
  name: string;
  symbol: string;
  totalSupply: number;
  floorPrice: number;
  verified: boolean;
  volume24h?: number;
  volumeTotal?: number;
} 