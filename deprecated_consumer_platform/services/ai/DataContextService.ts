import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { NFTMetadata, CollectionMetadata, TradeLoop } from '../../types/trade';
import { TrendingService } from '../TrendingService';
import { NFTService } from '../nft/NFTService';
import { LocalCollectionService } from '../nft/LocalCollectionService';
import { container } from '../../di-container';

export interface DataSnapshot {
  timestamp: Date;
  marketMetrics: {
    totalVolume24h: number;
    activeTraders: number;
    completedTrades24h: number;
    averageTradeSize: number;
    peakHour: number;
  };
  trendingData: {
    hotNFTs: Array<{
      address: string;
      name: string;
      collection: string;
      wantCount: number;
      priceChange24h?: number;
    }>;
    risingCollections: Array<{
      id: string;
      name: string;
      floorPrice: number;
      volumeChange24h: number;
      newListings: number;
    }>;
  };
  networkHealth: {
    avgDiscoveryTime: number;
    successRate: number;
    queuedTrades: number;
    activeLoops: number;
  };
}

/**
 * Service to provide real-time data context for AI decision making
 */
export class DataContextService {
  private static instance: DataContextService;
  private logger: Logger;
  
  private dataCache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60 * 1000; // 1 minute cache
  
  private trendingService: TrendingService;
  private nftService: NFTService;
  private collectionService: LocalCollectionService;

  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('DataContextService');
    
    // Use DI container to get TrendingService instance
    this.trendingService = container.resolve(TrendingService);
    this.nftService = NFTService.getInstance();
    this.collectionService = LocalCollectionService.getInstance();
    
    this.logger.info('DataContextService initialized');
  }

  public static getInstance(): DataContextService {
    if (!DataContextService.instance) {
      DataContextService.instance = new DataContextService();
    }
    return DataContextService.instance;
  }

  /**
   * Get comprehensive data snapshot
   */
  async getDataSnapshot(): Promise<DataSnapshot> {
    const cacheKey = 'data_snapshot';
    const cached = this.getCached(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const [marketMetrics, trendingData, networkHealth] = await Promise.all([
        this.getMarketMetrics(),
        this.getTrendingData(),
        this.getNetworkHealth()
      ]);

      const snapshot: DataSnapshot = {
        timestamp: new Date(),
        marketMetrics,
        trendingData,
        networkHealth
      };

      this.setCache(cacheKey, snapshot);
      return snapshot;
    } catch (error) {
      this.logger.error('Error getting data snapshot', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Get real-time market metrics
   */
  private async getMarketMetrics() {
    try {
      // These would connect to your real data sources
      return {
        totalVolume24h: 0,
        activeTraders: 0,
        completedTrades24h: 0,
        averageTradeSize: 3.2,
        peakHour: 14 // 2 PM
      };
    } catch (error) {
      this.logger.error('Error getting market metrics', { error: error instanceof Error ? error.message : String(error) });
      return {
        totalVolume24h: 0,
        activeTraders: 0,
        completedTrades24h: 0,
        averageTradeSize: 0,
        peakHour: 0
      };
    }
  }

  /**
   * Get trending data with enhanced metrics
   */
  private async getTrendingData() {
    try {
      // Use the actual TrendingService methods
      const [trendingNFTs, trendingLoopItems] = await Promise.all([
        this.trendingService.getTrendingWantedNfts(10),
        this.trendingService.getTrendingLoopItems(50, 10)
      ]);

      // Get all collections and sort by NFT count
      const allCollections = await this.collectionService.getAllCollections();
      const topCollections = allCollections
        .sort((a, b) => (b.nftCount || 0) - (a.nftCount || 0))
        .slice(0, 5);

      // Process trending NFTs
      const hotNFTs = trendingNFTs.map(item => ({
        address: item.nftAddress,
        name: item.metadata?.name || 'Unknown NFT',
        collection: typeof item.metadata?.collection === 'string' 
          ? item.metadata.collection 
          : item.metadata?.collection?.name || 'Unknown',
        wantCount: item.wantCount,
        priceChange24h: 0 // Would calculate from historical data
      }));

      // Process rising collections
      const risingCollections = topCollections.map((col: CollectionMetadata) => ({
        id: col.id,
        name: col.name,
        floorPrice: col.floorPrice || 0,
        volumeChange24h: 0, // Would calculate from historical data
        newListings: 0 // Would count from recent data
      }));

      return {
        hotNFTs,
        risingCollections
      };
    } catch (error) {
      this.logger.error('Error getting trending data', { error: error instanceof Error ? error.message : String(error) });
      return {
        hotNFTs: [],
        risingCollections: []
      };
    }
  }

  /**
   * Get network health metrics
   */
  private async getNetworkHealth() {
    try {
      return {
        avgDiscoveryTime: 0.8, // seconds
        successRate: 87.5, // percentage
        queuedTrades: 0,
        activeLoops: 0
      };
    } catch (error) {
      this.logger.error('Error getting network health', { error: error instanceof Error ? error.message : String(error) });
      return {
        avgDiscoveryTime: 0,
        successRate: 0,
        queuedTrades: 0,
        activeLoops: 0
      };
    }
  }

  /**
   * Get specific collection insights
   */
  async getCollectionInsights(collectionId: string) {
    const cacheKey = `collection_insights_${collectionId}`;
    const cached = this.getCached(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // Find collection by ID from all collections
      const allCollections = await this.collectionService.getAllCollections();
      const collection = allCollections.find(c => c.id === collectionId);
      
      if (!collection) {
        return null;
      }

      const insights = {
        collection,
        demandScore: this.calculateDemandScore(collection),
        liquidityScore: this.calculateLiquidityScore(collection),
        tradeVelocity: 0, // Would calculate from trade history
        priceStability: 0, // Would calculate from price history
        holderDistribution: {
          whales: 0,
          retail: 0,
          average: 0
        }
      };

      this.setCache(cacheKey, insights);
      return insights;
    } catch (error) {
      this.logger.error('Error getting collection insights', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * Calculate demand score for a collection
   */
  private calculateDemandScore(collection: CollectionMetadata): number {
    // Simple scoring based on available metrics
    let score = 0;
    
    if (collection.nftCount > 1000) score += 20;
    if (collection.floorPrice > 1) score += 30;
    if (collection.verified) score += 50;
    
    return Math.min(100, score);
  }

  /**
   * Calculate liquidity score for a collection
   */
  private calculateLiquidityScore(collection: CollectionMetadata): number {
    // Simple scoring based on trading activity
    let score = 0;
    
    if (collection.nftCount > 5000) score += 40;
    if (collection.floorPrice > 0 && collection.floorPrice < 10) score += 30;
    // Use nftCount as a proxy for listing activity
    if (collection.nftCount > 100) score += 30;
    
    return Math.min(100, score);
  }

  /**
   * Cache management
   */
  private getCached(key: string): any {
    const cached = this.dataCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.dataCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear stale cache entries
   */
  clearStaleCache(): void {
    const now = Date.now();
    for (const [key, value] of this.dataCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.dataCache.delete(key);
      }
    }
  }
} 