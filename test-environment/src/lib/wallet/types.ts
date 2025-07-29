export interface TestWallet {
  publicKey: string;
  privateKey: number[];
  nfts: string[]; // Array of NFT addresses
  balance: number;
}

export interface WalletGenerationConfig {
  totalWallets: number;
  nftsPerWallet: number;
  initialBalance: number;
} 