import { CollectionConfig, CollectionExpansionMetrics, CollectionTradeAnalytics } from '../../types/trade';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';

/**
 * Service to manage collection feature configuration and enforce limits
 * Provides centralized control over collection behavior and performance
 */
export class CollectionConfigService {
  private static instance: CollectionConfigService;
  private logger: Logger;
  
  // Default configuration
  private config: CollectionConfig = {
    enabled: true,
    maxCollectionSize: 1000,        // Max 1000 NFTs per collection expansion
    maxCollectionsPerWallet: 20,    // Max 20 collections per wallet
    cacheTimeout: 30 * 60 * 1000,   // 30 minutes
    batchSize: 100,                 // Process 100 NFTs at a time
    fallbackToSampling: true,       // Use sampling for collections > maxCollectionSize
    apiTimeout: 5000,               // 5 second API timeout
    maxExpansionPerRequest: 5000    // Max 5000 total NFT expansions per request
  };
  
  // Metrics tracking
  private expansionMetrics = new Map<string, CollectionExpansionMetrics[]>();
  private tradeAnalytics = new Map<string, CollectionTradeAnalytics>();
  
  // Rate limiting
  private apiCallCounts = new Map<string, { count: number; resetTime: number }>();
  private readonly API_RATE_LIMIT = 100; // 100 calls per minute
  private readonly RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('CollectionConfig');
    this.loadConfigFromEnvironment();
    
    // Start metrics cleanup interval
    setInterval(() => this.cleanupOldMetrics(), 60 * 60 * 1000); // Every hour
  }

  public static getInstance(): CollectionConfigService {
    if (!CollectionConfigService.instance) {
      CollectionConfigService.instance = new CollectionConfigService();
    }
    return CollectionConfigService.instance;
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfigFromEnvironment(): void {
    if (process.env.COLLECTION_ENABLED !== undefined) {
      this.config.enabled = process.env.COLLECTION_ENABLED === 'true';
    }
    
    if (process.env.MAX_COLLECTION_SIZE) {
      this.config.maxCollectionSize = parseInt(process.env.MAX_COLLECTION_SIZE, 10);
    }
    
    if (process.env.MAX_COLLECTIONS_PER_WALLET) {
      this.config.maxCollectionsPerWallet = parseInt(process.env.MAX_COLLECTIONS_PER_WALLET, 10);
    }
    
    if (process.env.COLLECTION_BATCH_SIZE) {
      this.config.batchSize = parseInt(process.env.COLLECTION_BATCH_SIZE, 10);
    }
    
    if (process.env.COLLECTION_API_TIMEOUT) {
      this.config.apiTimeout = parseInt(process.env.COLLECTION_API_TIMEOUT, 10);
    }
    
    if (process.env.MAX_EXPANSION_PER_REQUEST) {
      this.config.maxExpansionPerRequest = parseInt(process.env.MAX_EXPANSION_PER_REQUEST, 10);
    }
    
    this.logger.info('Collection configuration loaded', { ...this.config });
  }

  /**
   * Get current configuration
   */
  public getConfig(): Readonly<CollectionConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration (for testing or runtime adjustments)
   */
  public updateConfig(updates: Partial<CollectionConfig>): void {
    this.config = { ...this.config, ...updates };
    this.logger.info('Collection configuration updated', { ...this.config });
  }

  /**
   * Check if collections are enabled
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Validate collection want addition
   */
  public validateCollectionWant(walletAddress: string, currentCollectionCount: number): {
    valid: boolean;
    reason?: string;
  } {
    if (!this.config.enabled) {
      return { valid: false, reason: 'Collection wants are disabled' };
    }
    
    if (currentCollectionCount >= this.config.maxCollectionsPerWallet) {
      return { 
        valid: false, 
        reason: `Wallet has reached maximum collection wants limit (${this.config.maxCollectionsPerWallet})` 
      };
    }
    
    return { valid: true };
  }

  /**
   * Check if we should use sampling for a collection
   */
  public shouldUseSampling(collectionSize: number): boolean {
    return this.config.fallbackToSampling && collectionSize > this.config.maxCollectionSize;
  }

  /**
   * Get sample size for large collections
   */
  public getSampleSize(collectionSize: number): number {
    if (collectionSize <= this.config.maxCollectionSize) {
      return collectionSize;
    }
    
    // Use logarithmic sampling for very large collections
    if (collectionSize > 10000) {
      return Math.min(this.config.maxCollectionSize, Math.floor(Math.log10(collectionSize) * 100));
    }
    
    // Use percentage sampling for medium collections
    return Math.min(this.config.maxCollectionSize, Math.floor(collectionSize * 0.1));
  }

  /**
   * Check API rate limit
   */
  public checkRateLimit(identifier: string): {
    allowed: boolean;
    remainingCalls?: number;
    resetTime?: number;
  } {
    const now = Date.now();
    const rateInfo = this.apiCallCounts.get(identifier);
    
    if (!rateInfo || now > rateInfo.resetTime) {
      // Reset rate limit window
      this.apiCallCounts.set(identifier, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW
      });
      return { allowed: true, remainingCalls: this.API_RATE_LIMIT - 1 };
    }
    
    if (rateInfo.count >= this.API_RATE_LIMIT) {
      return { 
        allowed: false, 
        remainingCalls: 0,
        resetTime: rateInfo.resetTime
      };
    }
    
    rateInfo.count++;
    return { 
      allowed: true, 
      remainingCalls: this.API_RATE_LIMIT - rateInfo.count
    };
  }

  /**
   * Record expansion metrics
   */
  public recordExpansionMetrics(metrics: CollectionExpansionMetrics): void {
    const collectionMetrics = this.expansionMetrics.get(metrics.collectionId) || [];
    collectionMetrics.push(metrics);
    
    // Keep only last 100 metrics per collection
    if (collectionMetrics.length > 100) {
      collectionMetrics.shift();
    }
    
    this.expansionMetrics.set(metrics.collectionId, collectionMetrics);
  }

  /**
   * Update trade analytics
   */
  public updateTradeAnalytics(
    collectionId: string, 
    tradeSuccess: boolean,
    tradeSize: number,
    tradedNFTs: string[]
  ): void {
    const analytics = this.tradeAnalytics.get(collectionId) || {
      collectionId,
      totalTrades: 0,
      successfulTrades: 0,
      averageTradeSize: 0,
      popularityScore: 0,
      topTradedNFTs: []
    };
    
    analytics.totalTrades++;
    if (tradeSuccess) {
      analytics.successfulTrades++;
    }
    
    // Update average trade size
    analytics.averageTradeSize = 
      (analytics.averageTradeSize * (analytics.totalTrades - 1) + tradeSize) / analytics.totalTrades;
    
    // Update popularity score (success rate * log of total trades)
    const successRate = analytics.successfulTrades / analytics.totalTrades;
    analytics.popularityScore = successRate * Math.log10(analytics.totalTrades + 1);
    
    // Update last trade date
    analytics.lastTradeDate = new Date();
    
    // Update top traded NFTs
    const nftCounts = new Map<string, number>();
    for (const nft of [...analytics.topTradedNFTs, ...tradedNFTs]) {
      nftCounts.set(nft, (nftCounts.get(nft) || 0) + 1);
    }
    
    analytics.topTradedNFTs = Array.from(nftCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([nft]) => nft);
    
    this.tradeAnalytics.set(collectionId, analytics);
  }

  /**
   * Get collection analytics
   */
  public getCollectionAnalytics(collectionId: string): CollectionTradeAnalytics | null {
    return this.tradeAnalytics.get(collectionId) || null;
  }

  /**
   * Get all collection analytics sorted by popularity
   */
  public getTopCollections(limit: number = 10): CollectionTradeAnalytics[] {
    return Array.from(this.tradeAnalytics.values())
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, limit);
  }

  /**
   * Get expansion metrics for a collection
   */
  public getExpansionMetrics(collectionId: string): CollectionExpansionMetrics[] {
    return this.expansionMetrics.get(collectionId) || [];
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    
    // Clean expansion metrics
    for (const [collectionId, metrics] of this.expansionMetrics) {
      const filtered = metrics.filter(m => m.timestamp.getTime() > cutoffTime);
      if (filtered.length === 0) {
        this.expansionMetrics.delete(collectionId);
      } else {
        this.expansionMetrics.set(collectionId, filtered);
      }
    }
    
    // Clean rate limit counts
    const now = Date.now();
    for (const [identifier, info] of this.apiCallCounts) {
      if (now > info.resetTime) {
        this.apiCallCounts.delete(identifier);
      }
    }
    
    this.logger.info('Cleaned up old metrics', {
      remainingExpansionMetrics: this.expansionMetrics.size,
      remainingRateLimits: this.apiCallCounts.size
    });
  }

  /**
   * Get system-wide collection statistics
   */
  public getSystemStats(): {
    totalCollectionsTracked: number;
    totalExpansions: number;
    averageExpansionTime: number;
    samplingRate: number;
    topCollectionsByPopularity: string[];
  } {
    let totalExpansions = 0;
    let totalExpansionTime = 0;
    let sampledExpansions = 0;
    
    for (const metrics of this.expansionMetrics.values()) {
      for (const metric of metrics) {
        totalExpansions++;
        totalExpansionTime += metric.expansionTime;
        if (metric.usedSampling) {
          sampledExpansions++;
        }
      }
    }
    
    const topCollections = this.getTopCollections(5).map(c => c.collectionId);
    
    return {
      totalCollectionsTracked: this.tradeAnalytics.size,
      totalExpansions,
      averageExpansionTime: totalExpansions > 0 ? totalExpansionTime / totalExpansions : 0,
      samplingRate: totalExpansions > 0 ? sampledExpansions / totalExpansions : 0,
      topCollectionsByPopularity: topCollections
    };
  }
} 