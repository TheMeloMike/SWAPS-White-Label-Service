import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TestWallet, WalletGenerationConfig } from './types';

export class WalletGenerator {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async generateWallet(): Promise<TestWallet> {
    const keypair = Keypair.generate();
    return {
      publicKey: keypair.publicKey.toString(),
      privateKey: Array.from(keypair.secretKey),
      nfts: [],
      balance: 0,
    };
  }

  async requestAirdrop(publicKey: string, amount: number): Promise<void> {
    try {
      const signature = await this.connection.requestAirdrop(
        new Keypair(publicKey),
        amount * LAMPORTS_PER_SOL
      );
      await this.connection.confirmTransaction(signature);
    } catch (error) {
      console.error('Error requesting airdrop:', error);
      throw error;
    }
  }
} 