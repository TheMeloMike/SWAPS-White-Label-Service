import { PublicKey } from '@solana/web3.js';

/**
 * Represents a user's wallet state
 */
export interface WalletState {
  address: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Represents a wallet with NFT holdings and preferences
 */
export interface WalletWithPreferences {
  address: string;
  ownedNfts: string[];
  wantedNfts: string[];
} 