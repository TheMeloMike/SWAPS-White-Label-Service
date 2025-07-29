import { Worker, workerData, parentPort } from 'worker_threads';
import { Connection, PublicKey } from '@solana/web3.js';
import { Metaplex } from '@metaplex-foundation/js';
import { NFTMetadata, IndexingStats } from './types';
import { chunk } from 'lodash';

export class NFTIndexer {
  private readonly BATCH_SIZE = 100;
  private readonly MAX_CONCURRENT_REQUESTS = 5;
  private readonly WORKER_POOL_SIZE = 4;
  private connection: Connection;
  private metaplex: Metaplex;
  private cache: Map<string, NFTMetadata[]>;
  private lastIndexed: Map<string, number>;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.connection = new Connection(process.env.RPC_ENDPOINT!);
    this.metaplex = new Metaplex(this.connection);
    this.cache = new Map();
    this.lastIndexed = new Map();
  }

  async indexConnectedWallets(wallets: string[]): Promise<Map<string, NFTMetadata[]>> {
    const walletChunks = chunk(wallets, this.BATCH_SIZE);
    const indexingPromises: Promise<Map<string, NFTMetadata[]>>[] = [];

    // Create worker pool
    const workerPool = Array.from({ length: this.WORKER_POOL_SIZE }, 
      () => this.createWorker()
    );

    try {
      // Distribute work among workers
      for (let i = 0; i < walletChunks.length; i++) {
        const worker = workerPool[i % this.WORKER_POOL_SIZE];
        indexingPromises.push(
          this.processWalletChunk(worker, walletChunks[i])
        );
      }

      const results = await Promise.all(indexingPromises);
      return this.mergeResults(results);

    } finally {
      workerPool.forEach(worker => worker.terminate());
    }
  }

  private createWorker(): Worker {
    return new Worker(`
      const { parentPort, workerData } = require('worker_threads');
      const { Connection } = require('@solana/web3.js');
      const { Metaplex } = require('@metaplex-foundation/js');

      parentPort.on('message', async (data) => {
        const { wallets, rpcEndpoint } = data;
        const connection = new Connection(rpcEndpoint);
        const metaplex = new Metaplex(connection);
        
        const results = new Map();
        
        for (const wallet of wallets) {
          try {
            const nfts = await metaplex.nfts().findAllByOwner({ owner: wallet });
            results.set(wallet, nfts);
          } catch (error) {
            console.error(\`Error indexing wallet \${wallet}:\`, error);
          }
        }
        
        parentPort.postMessage([...results]);
      });
    `);
  }

  private async processWalletChunk(
    worker: Worker,
    wallets: string[]
  ): Promise<Map<string, NFTMetadata[]>> {
    return new Promise((resolve, reject) => {
      worker.postMessage({
        wallets,
        rpcEndpoint: process.env.RPC_ENDPOINT
      });

      worker.on('message', (data) => {
        resolve(new Map(data));
      });

      worker.on('error', reject);
    });
  }

  private mergeResults(
    results: Map<string, NFTMetadata[]>[]
  ): Map<string, NFTMetadata[]> {
    const merged = new Map();
    results.forEach(result => {
      for (const [wallet, nfts] of result.entries()) {
        merged.set(wallet, nfts);
      }
    });
    return merged;
  }

  private async indexWalletNFTs(wallet: string): Promise<NFTMetadata[]> {
    const publicKey = new PublicKey(wallet);
    const nfts = await this.metaplex.nfts().findAllByOwner({ owner: publicKey });

    return Promise.all(
      nfts.map(async (nft) => {
        const metadata = await this.fetchNFTMetadata(nft.address);
        return {
          address: nft.address.toString(),
          name: metadata.name,
          symbol: metadata.symbol,
          image: metadata.image,
          collection: metadata.collection,
          estimatedValue: await this.estimateNFTValue(nft.address.toString()),
          owner: wallet
        };
      })
    );
  }

  private isCacheValid(wallet: string): boolean {
    const lastIndexTime = this.lastIndexed.get(wallet);
    return lastIndexTime !== undefined && 
           Date.now() - lastIndexTime < this.CACHE_DURATION;
  }

  private emitIndexingProgress(stats: IndexingStats) {
    // Emit progress for visualization
    process.emit('indexing-progress', stats);
  }
} 