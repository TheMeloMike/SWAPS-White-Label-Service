import { NFTMetadata } from '../nft/types';
import { TestWallet } from '../wallet/types';

export interface TestEnvironmentData {
  wallets: TestWallet[];
  nfts: NFTMetadata[];
  timestamp: string;
  network: string;
}

export interface StorageConfig {
  outputDir: string;
  filename: string;
} 