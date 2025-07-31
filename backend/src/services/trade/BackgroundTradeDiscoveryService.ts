import { TradeDiscoveryService } from './TradeDiscoveryService';
import { TradeLoop } from '../../types/trade';
import { LoggingService } from '../../utils/logging/LoggingService';
import { performance } from 'perf_hooks';
import { WalletService } from './WalletService';

/**
 * Service that continuously discovers trade loops in the background
 * This keeps the trade cache warm and ensures users get instant results
 */
export class BackgroundTradeDiscoveryService {
  private static instance: BackgroundTradeDiscoveryService;
  private logger = LoggingService.getInstance().createLogger('BackgroundTradeDiscovery');
  private discoveryService: TradeDiscoveryService;
  private walletService: WalletService | null = null;
  
  // Background processing settings
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private tradeCache: Map<string, TradeLoop[]> = new Map();
  private lastRunTime: Map<string, number> = new Map();
  private priorityWallets: Set<string> = new Set();
  
  // Wallet state tracking for differential updates
  private walletNftCounts: Map<string, number> = new Map();
  private walletWantCounts: Map<string, number> = new Map();
  private walletLastChangeTime: Map<string, number> = new Map();
  
  // Statistics for monitoring
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private processingTimes: number[] = [];
  private lastScanStats = {
    walletsProcessed: 0,
    totalProcessingTime: 0,
    tradesFound: 0,
    avgWalletProcessingTime: 0
  };
  
  // Configuration
  private readonly SCAN_INTERVAL_MS: number;
  private readonly HIGH_PRIORITY_INTERVAL_MS: number;
  private readonly NORMAL_PRIORITY_INTERVAL_MS: number;
  private readonly LOW_PRIORITY_INTERVAL_MS: number;
  private readonly CACHE_TTL_MS: number;
  private readonly MAX_CACHED_TRADES: number;
  private readonly MAX_CONCURRENT_WALLETS: number;
  private readonly BATCH_SIZE: number;
  private readonly ENABLE_DIFFERENTIAL_UPDATES: boolean = true;
  
  private constructor() {
    this.discoveryService = TradeDiscoveryService.getInstance();
    
    // Load settings from environment variables or use defaults
    this.SCAN_INTERVAL_MS = parseInt(process.env.BACKGROUND_SCAN_INTERVAL_MS || '60000', 10); // 1 minute
    this.HIGH_PRIORITY_INTERVAL_MS = parseInt(process.env.HIGH_PRIORITY_INTERVAL_MS || '300000', 10); // 5 minutes
    this.NORMAL_PRIORITY_INTERVAL_MS = parseInt(process.env.NORMAL_PRIORITY_INTERVAL_MS || '900000', 10); // 15 minutes
    this.LOW_PRIORITY_INTERVAL_MS = parseInt(process.env.LOW_PRIORITY_INTERVAL_MS || '3600000', 10); // 1 hour
    this.CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS || '1800000', 10); // 30 minutes
    this.MAX_CACHED_TRADES = parseInt(process.env.MAX_CACHED_TRADES || '1000', 10);
    this.MAX_CONCURRENT_WALLETS = parseInt(process.env.MAX_CONCURRENT_WALLETS || '10', 10);
    this.BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '20', 10);
    
    this.logger.info('BackgroundTradeDiscoveryService initialized', {
      scanInterval: `${this.SCAN_INTERVAL_MS / 1000}s`,
      highPriorityInterval: `${this.HIGH_PRIORITY_INTERVAL_MS / 60000}m`,
      normalPriorityInterval: `${this.NORMAL_PRIORITY_INTERVAL_MS / 60000}m`,
      lowPriorityInterval: `${this.LOW_PRIORITY_INTERVAL_MS / 60000}m`,
      cacheTTL: `${this.CACHE_TTL_MS / 60000}m`,
      maxCachedTrades: this.MAX_CACHED_TRADES,
      maxConcurrentWallets: this.MAX_CONCURRENT_WALLETS,
      batchSize: this.BATCH_SIZE,
      differentialUpdates: this.ENABLE_DIFFERENTIAL_UPDATES
    });
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): BackgroundTradeDiscoveryService {
    if (!BackgroundTradeDiscoveryService.instance) {
      BackgroundTradeDiscoveryService.instance = new BackgroundTradeDiscoveryService();
    }
    return BackgroundTradeDiscoveryService.instance;
  }
  
  /**
   * Set the wallet service reference for tracking changes
   */
  public setWalletService(walletService: WalletService): void {
    this.walletService = walletService;
  }
  
  /**
   * Configure service options
   */
  public configure(options: { 
    enableDifferentialUpdates?: boolean
  }): void {
    if (options.enableDifferentialUpdates !== undefined) {
      (this as any).ENABLE_DIFFERENTIAL_UPDATES = options.enableDifferentialUpdates;
      this.logger.info(`Differential updates ${options.enableDifferentialUpdates ? 'enabled' : 'disabled'}`);
    }
  }
  
  /**
   * Start the background discovery process
   */
  public start(): void {
    if (this.isRunning) {
      this.logger.info('Background discovery service is already running');
      return;
    }
    
    this.logger.info('Starting background trade discovery service');
    this.isRunning = true;
    
    // Clear statistics
    this.processingTimes = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    
    // Run an initial scan immediately
    this.runBackgroundScan();
    
    // Set up the interval for regular scans
    this.intervalId = setInterval(() => {
      this.runBackgroundScan();
    }, this.SCAN_INTERVAL_MS);
  }
  
  /**
   * Stop the background discovery process
   */
  public stop(): void {
    if (!this.isRunning) {
      this.logger.info('Background discovery service is not running');
      return;
    }
    
    this.logger.info('Stopping background trade discovery service');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  /**
   * Run a background scan for trade loops
   * This is the main worker function that runs on each interval
   */
  private async runBackgroundScan(): Promise<void> {
    try {
      const startTime = performance.now();
      const operation = this.logger.operation('runBackgroundScan');
      operation.info('Starting background trade discovery scan');
      
      // Get the current time for cache TTL checks
      const now = Date.now();
      
      // Get all wallets from the discovery service
      const allWallets = this.discoveryService.getAllWallets();
      
      // First, determine which wallets need processing
      const walletsToProcess = this.ENABLE_DIFFERENTIAL_UPDATES
        ? await this.prioritizeWalletsWithDifferential(allWallets, now)
        : this.prioritizeWallets(allWallets, now);
      
      operation.info('Determined wallets to process', {
        totalWallets: allWallets.length,
        walletsToProcess: walletsToProcess.length,
        highPriorityWallets: this.priorityWallets.size,
        differentialUpdatesEnabled: this.ENABLE_DIFFERENTIAL_UPDATES
      });
      
      // Process wallets in batches to control memory usage and concurrency
      const results = await this.processWalletBatches(walletsToProcess);
      
      // Clean up the cache
      const expiredEntries = this.cleanupCache(now);
      
      // Calculate statistics
      const processingTimes = this.processingTimes.slice(-100); // Keep last 100 times
      const avgProcessingTime = processingTimes.length > 0
        ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
        : 0;
      
      this.lastScanStats = {
        walletsProcessed: results.totalProcessed,
        totalProcessingTime: results.totalTime,
        tradesFound: results.totalTrades,
        avgWalletProcessingTime: avgProcessingTime
      };
      
      const endTime = performance.now();
      operation.info('Background trade discovery scan completed', {
        durationMs: Math.round(endTime - startTime),
        walletsProcessed: results.totalProcessed,
        tradesFound: results.totalTrades,
        cachedTradeEntries: this.tradeCache.size,
        expiredEntriesRemoved: expiredEntries,
        avgProcessingTimeMs: Math.round(avgProcessingTime)
      });
      
      operation.end();
    } catch (error) {
      this.logger.error('Error in background trade discovery scan', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }
  
  /**
   * Check if a wallet has changes since the last processing
   */
  private async hasWalletChanged(wallet: string): Promise<boolean> {
    // Always process if we've never seen this wallet before
    if (!this.walletNftCounts.has(wallet) || !this.walletWantCounts.has(wallet)) {
      return true;
    }
    
    try {
      // Get wallet data using the correct method and handle Map return type
      const walletsMap = await this.discoveryService.getWallets();
      const currentWallet = walletsMap.get(wallet);
      
      if (!currentWallet) {
        return true; // Wallet not found, process it
      }
      
      // Check if the NFTs have changed
      const previousNftCount = this.walletNftCounts.get(wallet) || 0;
      if (currentWallet.ownedNfts.size !== previousNftCount) {
        return true;
      }
      
      // Check if the wants have changed
      const previousWantCount = this.walletWantCounts.get(wallet) || 0;
      if (currentWallet.wantedNfts.size !== previousWantCount) {
        return true;
      }
      
      // No changes detected
      return false;
    } catch (error) {
      // If we can't determine changes, assume something changed to be safe
      this.logger.warn(`Error checking wallet changes for ${wallet}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return true;
    }
  }
  
  /**
   * Updated prioritization that includes differential update logic
   * Only processes wallets that have likely changed since last scan
   */
  private async prioritizeWalletsWithDifferential(allWallets: string[], now: number): Promise<string[]> {
    // Sort wallets into priority groups first
    const highPriorityWallets: string[] = [];
    const normalPriorityWallets: string[] = [];
    const lowPriorityWallets: string[] = [];
    
    // First pass - categorize all wallets by priority level
    for (const wallet of allWallets) {
      const lastRun = this.lastRunTime.get(wallet) || 0;
      const timeSinceLastRun = now - lastRun;
      
      // Check if this wallet is due for processing based on its priority
      const isPriorityWallet = this.priorityWallets.has(wallet);
      
      // Always check high priority wallets frequently
      if (isPriorityWallet && timeSinceLastRun >= this.HIGH_PRIORITY_INTERVAL_MS) {
        highPriorityWallets.push(wallet);
      } else if (!isPriorityWallet && timeSinceLastRun >= this.NORMAL_PRIORITY_INTERVAL_MS) {
        normalPriorityWallets.push(wallet);
      } else if (timeSinceLastRun >= this.LOW_PRIORITY_INTERVAL_MS) {
        lowPriorityWallets.push(wallet);
      }
    }
    
    this.logger.info('Initial wallet prioritization', {
      highPriority: highPriorityWallets.length,
      normalPriority: normalPriorityWallets.length,
      lowPriority: lowPriorityWallets.length
    });
    
    // For high priority wallets, we'll process all of them
    const walletsToProcess = [...highPriorityWallets];
    
    // For normal and low priority, we'll check if they've changed
    const normalToCheck = normalPriorityWallets.slice(0, 100); // Limit check to 100 wallets
    const lowToCheck = lowPriorityWallets.slice(0, 50); // Limit check to 50 wallets
    
    // Process normal priority wallets that have changed
    const changedNormalWallets = await this.filterChangedWallets(normalToCheck);
    walletsToProcess.push(...changedNormalWallets);
    
    // Process low priority wallets that have changed
    const changedLowWallets = await this.filterChangedWallets(lowToCheck);
    walletsToProcess.push(...changedLowWallets);
    
    this.logger.info('Differential wallet prioritization results', {
      highPrioritySelected: highPriorityWallets.length,
      normalPriorityChanged: changedNormalWallets.length,
      lowPriorityChanged: changedLowWallets.length,
      totalToProcess: walletsToProcess.length
    });
    
    // Sort by time since last run (oldest first)
    const sortByLastRun = (a: string, b: string) => {
      const lastRunA = this.lastRunTime.get(a) || 0;
      const lastRunB = this.lastRunTime.get(b) || 0;
      return lastRunA - lastRunB;
    };
    
    walletsToProcess.sort(sortByLastRun);
    return walletsToProcess;
  }
  
  /**
   * Filter a list of wallets to only those that have changed
   */
  private async filterChangedWallets(wallets: string[]): Promise<string[]> {
    if (!this.walletService || wallets.length === 0) {
      return wallets; // If we can't check changes, process all
    }
    
    const changedWallets: string[] = [];
    
    // Process in small batches to avoid overloading
    for (let i = 0; i < wallets.length; i += 5) {
      const batch = wallets.slice(i, i + 5);
      
      // Check changes in parallel
      const changeChecks = await Promise.all(
        batch.map(async wallet => {
          const changed = await this.hasWalletChanged(wallet);
          return { wallet, changed };
        })
      );
      
      // Add changed wallets to the list
      for (const { wallet, changed } of changeChecks) {
        if (changed) {
          changedWallets.push(wallet);
        }
      }
    }
    
    return changedWallets;
  }
  
  /**
   * Prioritize wallets for processing based on last run time and priority status
   */
  private prioritizeWallets(allWallets: string[], now: number): string[] {
    // Sort wallets into priority groups
    const highPriorityWallets: string[] = [];
    const normalPriorityWallets: string[] = [];
    const lowPriorityWallets: string[] = [];
    
    for (const wallet of allWallets) {
      const lastRun = this.lastRunTime.get(wallet) || 0;
      const timeSinceLastRun = now - lastRun;
      
      // Check if this wallet is due for processing based on its priority
      const isPriorityWallet = this.priorityWallets.has(wallet);
      
      if (isPriorityWallet && timeSinceLastRun >= this.HIGH_PRIORITY_INTERVAL_MS) {
        // High priority wallets get processed more frequently
        highPriorityWallets.push(wallet);
      } else if (!isPriorityWallet && timeSinceLastRun >= this.NORMAL_PRIORITY_INTERVAL_MS) {
        // Normal priority wallets
        normalPriorityWallets.push(wallet);
      } else if (timeSinceLastRun >= this.LOW_PRIORITY_INTERVAL_MS) {
        // All wallets get processed eventually
        lowPriorityWallets.push(wallet);
      }
    }
    
    // Sort each group by time since last run (oldest first)
    const sortByLastRun = (a: string, b: string) => {
      const lastRunA = this.lastRunTime.get(a) || 0;
      const lastRunB = this.lastRunTime.get(b) || 0;
      return lastRunA - lastRunB;
    };
    
    highPriorityWallets.sort(sortByLastRun);
    normalPriorityWallets.sort(sortByLastRun);
    lowPriorityWallets.sort(sortByLastRun);
    
    this.logger.info('Wallet prioritization results', {
      highPriority: highPriorityWallets.length,
      normalPriority: normalPriorityWallets.length,
      lowPriority: lowPriorityWallets.length
    });
    
    // Combine the groups with high priority first
    return [...highPriorityWallets, ...normalPriorityWallets, ...lowPriorityWallets];
  }
  
  /**
   * Process wallets in batches to control memory usage and concurrency
   */
  private async processWalletBatches(wallets: string[]): Promise<{
    totalProcessed: number;
    totalTime: number;
    totalTrades: number;
  }> {
    let totalProcessed = 0;
    let totalTime = 0;
    let totalTrades = 0;
    
    // Process in batches to limit memory usage
    for (let i = 0; i < wallets.length; i += this.BATCH_SIZE) {
      const batch = wallets.slice(i, i + this.BATCH_SIZE);
      
      // Process batch with concurrency limit
      const batchStartTime = performance.now();
      this.logger.debug(`Processing wallet batch ${i / this.BATCH_SIZE + 1}/${Math.ceil(wallets.length / this.BATCH_SIZE)}`, {
        batchSize: batch.length
      });
      
      // Process concurrently but with a limit
      const results = await this.processConcurrentWallets(batch);
      
      totalProcessed += results.processed;
      totalTrades += results.trades;
      totalTime += performance.now() - batchStartTime;
      
      // Small delay between batches to allow for GC
      if (i + this.BATCH_SIZE < wallets.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return { totalProcessed, totalTime, totalTrades };
  }
  
  /**
   * Process a batch of wallets with a concurrency limit
   */
  private async processConcurrentWallets(wallets: string[]): Promise<{
    processed: number;
    trades: number;
  }> {
    let processed = 0;
    let totalTrades = 0;
    
    // Process in chunks with concurrency limit
    for (let i = 0; i < wallets.length; i += this.MAX_CONCURRENT_WALLETS) {
      const chunk = wallets.slice(i, i + this.MAX_CONCURRENT_WALLETS);
      
      // Process this chunk concurrently
      const results = await Promise.all(chunk.map(wallet => this.processWallet(wallet)));
      
      // Aggregate results
      for (const result of results) {
        if (result.processed) {
          processed++;
          totalTrades += result.trades;
        }
      }
    }
    
    return { processed, trades: totalTrades };
  }
  
  /**
   * Process an individual wallet to find and cache its trade opportunities
   */
  private async processWallet(walletAddress: string): Promise<{
    processed: boolean;
    trades: number;
  }> {
    try {
      const startTime = performance.now();
      this.logger.debug(`Processing wallet ${walletAddress} in background`);
      
      // Find trades for this wallet
      const trades = await this.discoveryService.getTradesForWallet(walletAddress);
      
      // Cache the results
      this.tradeCache.set(walletAddress, trades);
      this.lastRunTime.set(walletAddress, Date.now());
      
      // Update tracking data for differential updates
      if (this.ENABLE_DIFFERENTIAL_UPDATES) {
        try {
          const walletsMap = await this.discoveryService.getWallets();
          const walletData = walletsMap.get(walletAddress);
          
          if (walletData) {
            this.walletNftCounts.set(walletAddress, walletData.ownedNfts.size);
            this.walletWantCounts.set(walletAddress, walletData.wantedNfts.size);
            this.walletLastChangeTime.set(walletAddress, Date.now());
          }
        } catch (error) {
          this.logger.warn(`Error updating tracking data for wallet ${walletAddress}`, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      const processingTime = performance.now() - startTime;
      this.processingTimes.push(processingTime);
      
      // Trim processing times array if it gets too large
      if (this.processingTimes.length > 1000) {
        this.processingTimes = this.processingTimes.slice(-500);
      }
      
      const endTime = performance.now();
      this.logger.debug(`Wallet ${walletAddress} processing completed`, {
        tradesFound: trades.length,
        durationMs: Math.round(endTime - startTime)
      });
      
      return { processed: true, trades: trades.length };
    } catch (error) {
      this.logger.error(`Error processing wallet ${walletAddress}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return { processed: false, trades: 0 };
    }
  }
  
  /**
   * Clean up expired cache entries and keep cache size under control
   * @returns Number of entries removed
   */
  private cleanupCache(now: number): number {
    // Clean up expired cache entries
    let expiredEntries = 0;
    
    // First, clean up expired entries
    for (const [wallet, lastUpdate] of this.lastRunTime.entries()) {
      if (now - lastUpdate > this.CACHE_TTL_MS) {
        this.tradeCache.delete(wallet);
        this.lastRunTime.delete(wallet);
        // Also clean up tracking data
        this.walletNftCounts.delete(wallet);
        this.walletWantCounts.delete(wallet);
        this.walletLastChangeTime.delete(wallet);
        expiredEntries++;
      }
    }
    
    // If we still have too many cache entries, remove the oldest ones
    // Sort all entries by age - only if needed
    if (this.tradeCache.size > this.MAX_CACHED_TRADES) {
      const entriesByAge = Array.from(this.lastRunTime.entries())
        .sort((a, b) => a[1] - b[1]);
      
      const entriesToRemove = entriesByAge.slice(0, this.tradeCache.size - this.MAX_CACHED_TRADES);
      
      for (const [wallet] of entriesToRemove) {
        this.tradeCache.delete(wallet);
        this.lastRunTime.delete(wallet);
        // Also clean up tracking data
        this.walletNftCounts.delete(wallet);
        this.walletWantCounts.delete(wallet);
        this.walletLastChangeTime.delete(wallet);
        expiredEntries++;
      }
    }
    
    if (expiredEntries > 0) {
      this.logger.info(`Removed ${expiredEntries} expired cache entries, cache size now ${this.tradeCache.size}`);
    }
    
    return expiredEntries;
  }
  
  /**
   * Get cached trades for a wallet if available
   * @returns Cached trades or null if not in cache
   */
  public getCachedTradesForWallet(walletAddress: string): TradeLoop[] | null {
    // Mark this wallet as high priority for future background scans
    this.priorityWallets.add(walletAddress);
    
    // Check if we have cached trades for this wallet
    if (this.tradeCache.has(walletAddress)) {
      const now = Date.now();
      const lastUpdate = this.lastRunTime.get(walletAddress) || 0;
      
      // Check if the cache is still valid
      if (now - lastUpdate < this.CACHE_TTL_MS) {
        const cachedTrades = this.tradeCache.get(walletAddress) || [];
        
        this.logger.debug(`Serving cached trades for wallet ${walletAddress}`, {
          tradeCount: cachedTrades.length,
          cacheAgeMs: now - lastUpdate
        });
        
        // Track cache hit
        this.cacheHits++;
        
        return cachedTrades;
      }
    }
    
    // Cache miss or expired
    this.cacheMisses++;
    return null;
  }
  
  /**
   * Clear a specific wallet from the cache
   */
  public invalidateCache(walletAddress: string): void {
    this.tradeCache.delete(walletAddress);
    this.lastRunTime.delete(walletAddress);
    this.walletNftCounts.delete(walletAddress);
    this.walletWantCounts.delete(walletAddress);
    this.walletLastChangeTime.delete(walletAddress);
    this.logger.info(`Invalidated cache for wallet ${walletAddress}`);
  }
  
  /**
   * Clear the entire cache
   */
  public clearCache(): void {
    this.tradeCache.clear();
    this.lastRunTime.clear();
    this.walletNftCounts.clear();
    this.walletWantCounts.clear();
    this.walletLastChangeTime.clear();
    this.logger.info('Cleared entire trade cache');
  }
  
  /**
   * Add a wallet to the high priority list
   */
  public setPriorityWallet(walletAddress: string): void {
    this.priorityWallets.add(walletAddress);
  }
  
  /**
   * Remove a wallet from the high priority list
   */
  public removePriorityWallet(walletAddress: string): void {
    this.priorityWallets.delete(walletAddress);
  }
  
  /**
   * Get statistics about the background discovery service
   */
  public getStats(): {
    isRunning: boolean;
    cachedWallets: number;
    priorityWallets: number;
    cacheHitRate: number;
    avgProcessingTimeMs: number;
    lastScanStats: {
      walletsProcessed: number;
      totalProcessingTime: number;
      tradesFound: number;
      avgWalletProcessingTime: number;
    },
    differentialUpdatesEnabled: boolean;
  } {
    const totalCacheRequests = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalCacheRequests > 0
      ? this.cacheHits / totalCacheRequests
      : 0;
    
    const avgProcessingTime = this.processingTimes.length > 0
      ? this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length
      : 0;
    
    return {
      isRunning: this.isRunning,
      cachedWallets: this.tradeCache.size,
      priorityWallets: this.priorityWallets.size,
      cacheHitRate,
      avgProcessingTimeMs: avgProcessingTime,
      lastScanStats: this.lastScanStats,
      differentialUpdatesEnabled: this.ENABLE_DIFFERENTIAL_UPDATES
    };
  }
} 