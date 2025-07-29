/**
 * Service interfaces for dependency injection
 * 
 * These interfaces define the contracts that service implementations must fulfill,
 * allowing for better testability and looser coupling between components.
 */

import { NFTMetadata } from './nft';
import { TradeDiscoverySettings, TradeLoop } from './trade';

/**
 * Interface for logging service
 */
export interface ILoggingService {
  createLogger(context: string): ILogger;
}

/**
 * Interface for logger instances
 */
export interface ILogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  operation(name: string): ILoggerOperation;
}

/**
 * Interface for logger operations (spans/transactions)
 */
export interface ILoggerOperation {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  end(): void;
}

/**
 * Interface for NFT service
 */
export interface INFTService {
  /**
   * Get metadata for a single NFT
   */
  getNFTMetadata(mintAddress: string): Promise<NFTMetadata>;
  
  /**
   * Get metadata for multiple NFTs with concurrency control
   */
  batchGetNFTMetadata(mintAddresses: string[], maxConcurrency?: number): Promise<NFTMetadata[]>;
  
  /**
   * Get all NFTs owned by a wallet
   */
  getOwnedNFTs(walletAddress: string): Promise<NFTMetadata[]>;
  
  /**
   * Get NFTs for multiple wallets
   */
  batchGetOwnedNFTs(walletAddresses: string[], maxConcurrency?: number): Promise<Map<string, NFTMetadata[]>>;
  
  /**
   * Get floor price for a collection
   */
  getCollectionFloorPrice(collectionAddress: string): Promise<number>;
  
  /**
   * Clear the metadata cache
   */
  clearCache(): void;
}

/**
 * Interface for NFT pricing service
 */
export interface INFTPricingService {
  /**
   * Get floor price for a collection
   */
  getFloorPrice(collectionAddress: string): Promise<number>;
  
  /**
   * Get floor prices for multiple collections
   */
  batchGetFloorPrices(collectionAddresses: string[]): Promise<Map<string, number>>;
  
  /**
   * Estimate value of an NFT
   */
  estimateNFTValue(nftAddress: string, options?: { forceRefresh?: boolean }): Promise<number>;
  
  /**
   * Clear the price cache
   */
  clearCache(): void;
}

/**
 * Interface for wallet service
 */
export interface IWalletService {
  /**
   * Get NFTs owned by a wallet
   */
  getWalletNFTs(walletAddress: string): Promise<string[]>;
  
  /**
   * Update wallet and owned NFTs
   */
  updateWallet(walletAddress: string, ownedNFTs: string[]): Promise<void>;
  
  /**
   * Get wallets that own specific NFTs
   */
  getWalletsOwningNFTs(nftAddresses: string[]): Promise<Map<string, string>>;
}

/**
 * Interface for trade discovery service
 */
export interface ITradeDiscoveryService {
  /**
   * Find trade loops involving a specific wallet
   */
  findTradesForWallet(walletAddress: string, options?: any): Promise<any[]>;
  
  /**
   * Find all possible trade loops in the system
   */
  findAllTrades(options?: any): Promise<any[]>;
  
  /**
   * Find potential trade loops
   */
  findTradeLoops(settings?: Partial<TradeDiscoverySettings>): Promise<any[]>;
  
  /**
   * Get trades for a specific wallet
   */
  getTradesForWallet(walletAddress: string): Promise<any[]>;
  
  /**
   * Update wallet state
   */
  updateWalletState(walletAddress: string, forceRefresh?: boolean): Promise<any>;
  
  /**
   * Add a trade preference (wallet wants NFT)
   */
  addTradePreference(walletAddress: string, wantedNFT: string): Promise<void>;
  
  /**
   * Add a collection-level want preference
   */
  addCollectionWant(walletAddress: string, collectionId: string): Promise<void>;
  
  /**
   * Reject a trade
   */
  rejectTrade(walletAddress: string, nftOrWalletToReject: string, isNft: boolean): Promise<void>;
  
  /**
   * Get current system state metrics
   */
  getSystemState(): { wallets: number; nfts: number; wanted: number };
  
  /**
   * Clear all system state
   */
  clearState(): void;
  
  /**
   * Get all trade keys in the system
   */
  getAllTradeKeys(): Promise<string[]>;
  
  /**
   * Get a stored trade loop by ID
   */
  getStoredTradeLoop(tradeId: string): Promise<any | null>;
  
  /**
   * Perform a deep scan of a wallet's NFTs
   */
  deepScanWalletNFTs(walletAddress: string): Promise<string[]>;
  
  /**
   * Store a trade loop
   */
  storeTradeLoop(tradeId: string, steps: any[], metadata?: any): Promise<void>;
  
  /**
   * Get NFT ownership map
   */
  getNFTOwnershipMap(): Record<string, string>;
  
  /**
   * Get wallets map
   */
  getWallets(): Map<string, any>;
  
  /**
   * Get wanted NFTs map
   */
  getWantedNfts(): Map<string, Set<string>>;
  
  /**
   * Register manually owned NFTs
   */
  registerManualNFTs(walletAddress: string, nftAddresses: string[]): void;
  
  /**
   * Get detailed system state
   */
  getDetailedSystemState(): any;

  /**
   * Get rejection preferences for a wallet
   */
  getRejections(walletAddress: string): any;

  /**
   * Store rejection preferences for a wallet
   */
  storeRejections(walletAddress: string, rejections: any): void;

  /**
   * Record a completed trade step
   */
  recordTradeStepCompletion(tradeId: string, stepIndex: number, completionData: any): Promise<void>;

  /**
   * Check if a wallet exists in the system
   */
  walletExists(walletAddress: string): boolean;

  /**
   * Get the collection abstraction service instance
   */
  getCollectionAbstractionService(): any;
}

/**
 * Interface for persistence manager
 */
export interface IPersistenceManager {
  /**
   * Save data to storage
   */
  saveData<T>(key: string, data: T): Promise<void>;
  
  /**
   * Load data from storage
   */
  loadData<T>(key: string): Promise<T | null>;
  
  /**
   * Check if data exists
   */
  exists(key: string): Promise<boolean>;
  
  /**
   * Delete data from storage
   */
  deleteData(key: string): Promise<void>;
}

/**
 * Interface for a generic cache service.
 */
export interface ICacheService {
  set<T>(key: string, value: T, ttlMs: number): void;
  get<T>(key: string): T | null;
  delete(key: string): void;
  clear(): void;
} 