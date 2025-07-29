/**
 * Type declarations for module imports
 */

declare module '../../lib/persistence/PersistenceManager' {
  export class PersistenceManager {
    private static instance: PersistenceManager;
    private dataDir: string;
    private isEnabled: boolean;
    
    private constructor();
    
    public static getInstance(): PersistenceManager;
    public async saveData<T>(key: string, data: T): Promise<void>;
    public async loadData<T>(key: string, defaultValue: T): Promise<T>;
    public async setData(key: string, data: any): Promise<void>;
    public async getData<T>(key: string, defaultValue: T): Promise<T>;
    public async deleteData(key: string): Promise<void>;
  }
}

declare module './WalletService' {
  import { Helius } from 'helius-sdk';
  
  export class WalletService {
    constructor(helius: Helius, manualNftRegistry: Map<string, string[]>);
    async getWalletNFTs(walletAddress: string): Promise<string[]>;
    async deepScanWalletNFTs(walletAddress: string): Promise<string[]>;
  }
}

declare module './TradeLoopFinderService' {
  import { WalletState, TradeLoop, RejectionPreferences } from './trade';
  
  export class TradeLoopFinderService {
    constructor(MAX_DEPTH: number, MIN_EFFICIENCY: number);
    
    public findAllTradeLoops(
      wallets: Map<string, WalletState>,
      nftOwnership: Map<string, string>,
      wantedNfts: Map<string, Set<string>>,
      rejectionPreferences: Map<string, RejectionPreferences>
    ): TradeLoop[];
  }
}

declare module './TradeScoreService' {
  import { TradeLoop } from './trade';
  
  export class TradeScoreService {
    public calculateTradeScore(trade: TradeLoop): number;
  }
}

declare module '../nft/NFTPricingService' {
  export class NFTPricingService {
    private static instance: NFTPricingService;
    
    public static getInstance(): NFTPricingService;
    public async getFloorPrice(collectionAddress: string): Promise<number>;
    public getAveragePriceEstimate(): number;
    public async estimateNFTPrice(nftAddress: string, collectionAddress?: string): Promise<number>;
  }
}

declare module '../services/nft/NFTService' {
  import { NFTMetadata } from '../types/nft';
  
  export class NFTService {
    private static instance: NFTService;
    
    private constructor();
    public static getInstance(): NFTService;
    public async getNFTMetadata(nftAddress: string): Promise<NFTMetadata>;
    public async getOwnedNFTs(walletAddress: string): Promise<NFTMetadata[]>;
    public async getCollectionFloorPrice(collectionAddress: string): Promise<number>;
  }
}

declare module '../services/trade/TradeDiscoveryService' {
  import { WalletState, TradeLoop, RejectionPreferences } from '../types/trade';
  
  export class TradeDiscoveryService {
    private static instance: TradeDiscoveryService;
    
    private constructor();
    
    public static getInstance(): TradeDiscoveryService;
    
    // Main trade methods
    public findTradeLoops(): TradeLoop[];
    public async updateWalletState(walletAddress: string, forceRefresh?: boolean): Promise<WalletState>;
    public async forceRefreshWalletState(walletAddress: string): Promise<WalletState>;
    public async addTradePreference(walletAddress: string, desiredNft: string): Promise<void>;
    public async rejectTrade(walletAddress: string, rejectedNftAddress: string): Promise<void>;
    
    // System state methods
    public getSystemState(): { wallets: number; nfts: number; wanted: number };
    public clearState(): void;
    public getDetailedSystemState(): { wallets: Array<{ address: string, ownedNfts: string[], wantedNfts: string[] }> };
    
    // Trade loop methods
    public async getStoredTradeLoop(tradeId: string): Promise<TradeLoop | null>;
    public async storeTradeLoop(tradeId: string, steps: any[]): Promise<void>;
    public async prepareTradeLoopForContract(tradeId: string): Promise<{ participants: string[], nfts: string[], serialized: string }>;
    
    // NFT registry methods
    public registerManualNFTs(walletAddress: string, nftAddresses: string[]): void;
    
    // Wallet methods
    public walletExists(walletAddress: string): boolean;
    public async getTradesForWallet(walletAddress: string): Promise<TradeLoop[]>;
    
    // Additional methods for deep scanning
    public async updateWalletStateDeepScan(walletAddress: string): Promise<WalletState>;
    public async deepScanWalletNFTs(walletAddress: string): Promise<string[]>;
    public getAllWallets(): string[];
    public getNFTOwnershipMap(): Record<string, string>;
    
    // Rejection methods
    public getRejections(walletAddress: string): RejectionPreferences | undefined;
    public storeRejections(walletAddress: string, rejections: RejectionPreferences): void;
    
    // Step completion methods
    public async recordTradeStepCompletion(tradeId: string, stepIndex: number, completionData: any): Promise<void>;
  }
} 