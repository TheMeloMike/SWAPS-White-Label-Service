import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { NFTPricingService } from '../nft/NFTPricingService';
import { LocalCollectionService } from '../nft/LocalCollectionService';

export interface MarketDataPoint {
  source: 'magiceden' | 'tensor' | 'helius' | 'internal';
  timestamp: Date;
  type: 'collection_floor' | 'nft_price' | 'volume' | 'trending';
  data: any;
  reliability: number; // 0-1 score
}

export interface RealTimeMarketData {
  collections: {
    trending: Array<{
      id: string;
      name: string;
      floorPrice: number;
      change24h: number;
      volume24h: number;
      verified: boolean;
    }>;
    topGainers: Array<{
      id: string;
      name: string;
      priceChange: number;
      timeframe: '1h' | '24h' | '7d';
    }>;
  };
  nfts: {
    hotNFTs: Array<{
      address: string;
      name: string;
      collection: string;
      currentPrice?: number;
      priceChange24h?: number;
      demandScore: number;
    }>;
  };
  market: {
    totalVolume24h: number;
    activeListings: number;
    avgSalePrice: number;
    marketSentiment: 'bullish' | 'bearish' | 'neutral';
  };
  lastUpdated: Date;
}

export interface APIRateLimiter {
  source: string;
  requestsPerMinute: number;
  currentMinute: number;
  requestCount: number;
  lastReset: Date;
}

/**
 * Aggregates real-time market data from multiple sources with intelligent caching and rate limiting
 * This service enhances the AI agent with live market intelligence without affecting core trading
 */
export class MarketDataAggregator {
  private static instance: MarketDataAggregator;
  private logger: Logger;
  private nftPricingService: NFTPricingService;
  private localCollectionService: LocalCollectionService;
  
  // Caching system
  private marketDataCache = new Map<string, { data: any; timestamp: Date; ttl: number }>();
  private readonly DEFAULT_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
  private readonly EXTENDED_CACHE_TTL = 10 * 60 * 1000; // 10 minutes for fallback data
  
  // Rate limiting
  private rateLimiters = new Map<string, APIRateLimiter>();
  private readonly RATE_LIMITS = {
    magiceden: 60,  // 60 requests per minute
    tensor: 30,     // 30 requests per minute  
    helius: 100,    // 100 requests per minute
    internal: 1000  // No practical limit for internal data
  };
  
  // Feature flags
  private enabledSources = {
    magiceden: true,
    tensor: true,
    helius: true,
    internal: true
  };
  
  // Circuit breaker pattern
  private circuitBreakers = new Map<string, {
    failureCount: number;
    lastFailure: Date;
    isOpen: boolean;
    threshold: number;
    resetTime: number;
  }>();

  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('MarketDataAggregator');
    this.nftPricingService = NFTPricingService.getInstance();
    this.localCollectionService = LocalCollectionService.getInstance();
    
    // Initialize rate limiters
    Object.keys(this.RATE_LIMITS).forEach(source => {
      this.rateLimiters.set(source, {
        source,
        requestsPerMinute: this.RATE_LIMITS[source as keyof typeof this.RATE_LIMITS],
        currentMinute: new Date().getMinutes(),
        requestCount: 0,
        lastReset: new Date()
      });
    });
    
    // Initialize circuit breakers
    Object.keys(this.RATE_LIMITS).forEach(source => {
      this.circuitBreakers.set(source, {
        failureCount: 0,
        lastFailure: new Date(0),
        isOpen: false,
        threshold: 5, // 5 failures before opening
        resetTime: 60000 // 1 minute reset
      });
    });
    
    this.logger.info('MarketDataAggregator initialized', {
      enabledSources: this.enabledSources,
      rateLimits: this.RATE_LIMITS
    });
  }

  public static getInstance(): MarketDataAggregator {
    if (!MarketDataAggregator.instance) {
      MarketDataAggregator.instance = new MarketDataAggregator();
    }
    return MarketDataAggregator.instance;
  }

  /**
   * Get comprehensive real-time market data with fallback support
   */
  public async getRealTimeMarketData(): Promise<RealTimeMarketData> {
    const operation = this.logger.operation('getRealTimeMarketData');
    
    try {
      // Check cache first
      const cached = this.getCachedData('market_overview');
      if (cached) {
        operation.info('Returning cached market data');
        operation.end();
        return cached;
      }

      // Aggregate data from all available sources
      const [collectionsData, nftsData, marketData] = await Promise.allSettled([
        this.getTrendingCollections(),
        this.getHotNFTs(),
        this.getMarketMetrics()
      ]);

      const marketOverview: RealTimeMarketData = {
        collections: {
          trending: collectionsData.status === 'fulfilled' ? collectionsData.value.trending : [],
          topGainers: collectionsData.status === 'fulfilled' ? collectionsData.value.topGainers : []
        },
        nfts: {
          hotNFTs: nftsData.status === 'fulfilled' ? nftsData.value : []
        },
        market: marketData.status === 'fulfilled' ? marketData.value : {
          totalVolume24h: 0,
          activeListings: 0,
          avgSalePrice: 0,
          marketSentiment: 'neutral' as const
        },
        lastUpdated: new Date()
      };

      // Cache the result
      this.setCachedData('market_overview', marketOverview, this.DEFAULT_CACHE_TTL);
      
      operation.info('Market data aggregated successfully', {
        trendingCollections: marketOverview.collections.trending.length,
        hotNFTs: marketOverview.nfts.hotNFTs.length,
        volume24h: marketOverview.market.totalVolume24h
      });
      
      operation.end();
      return marketOverview;
      
    } catch (error) {
      operation.error('Failed to get real-time market data', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return fallback data
      const fallbackData = this.getFallbackMarketData();
      operation.end();
      return fallbackData;
    }
  }

  /**
   * Get trending collections from multiple sources
   */
  private async getTrendingCollections(): Promise<{
    trending: Array<any>;
    topGainers: Array<any>;
  }> {
    const results = await Promise.allSettled([
      this.getMagicEdenTrendingCollections(),
      this.getTensorTrendingCollections(),
      this.getInternalTrendingCollections()
    ]);

    // Merge and deduplicate results
    const allTrending: any[] = [];
    const allGainers: any[] = [];

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        if (result.value.trending) allTrending.push(...result.value.trending);
        if (result.value.topGainers) allGainers.push(...result.value.topGainers);
      }
    });

    // Deduplicate by collection ID and rank by multiple factors
    const uniqueTrending = this.deduplicateAndRankCollections(allTrending);
    const uniqueGainers = this.deduplicateAndRankCollections(allGainers);

    return {
      trending: uniqueTrending.slice(0, 10),
      topGainers: uniqueGainers.slice(0, 10)
    };
  }

  /**
   * Get Magic Eden trending collections with rate limiting
   */
  private async getMagicEdenTrendingCollections(): Promise<{ trending: any[]; topGainers: any[] }> {
    if (!this.canMakeRequest('magiceden')) {
      this.logger.debug('Magic Eden rate limit exceeded, skipping');
      return { trending: [], topGainers: [] };
    }

    if (this.isCircuitBreakerOpen('magiceden')) {
      this.logger.debug('Magic Eden circuit breaker open, skipping');
      return { trending: [], topGainers: [] };
    }

    try {
      this.recordRequest('magiceden');
      
      const response = await fetch('https://api-mainnet.magiceden.dev/v2/collections?limit=20', {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Magic Eden API error: ${response.status}`);
      }

      const collections = await response.json();
      this.recordSuccess('magiceden');

      // Transform to our format
      const trending = collections.map((col: any) => ({
        id: col.symbol || col.name,
        name: col.name,
        floorPrice: col.floorPrice ? col.floorPrice / 1_000_000_000 : 0,
        change24h: 0, // Magic Eden doesn't provide this directly
        volume24h: col.volumeAll ? col.volumeAll / 1_000_000_000 : 0,
        verified: col.isBadged || false,
        source: 'magiceden'
      }));

      return { trending, topGainers: [] };

    } catch (error) {
      this.recordFailure('magiceden', error);
      this.logger.warn('Magic Eden collections fetch failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return { trending: [], topGainers: [] };
    }
  }

  /**
   * Get Tensor trending collections with GraphQL
   */
  private async getTensorTrendingCollections(): Promise<{ trending: any[]; topGainers: any[] }> {
    if (!this.canMakeRequest('tensor')) {
      return { trending: [], topGainers: [] };
    }

    if (this.isCircuitBreakerOpen('tensor')) {
      return { trending: [], topGainers: [] };
    }

    try {
      this.recordRequest('tensor');
      
      const response = await fetch('https://api.tensor.so/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: `
            query GetTrendingCollections {
              trendingCollections(period: "1d", limit: 20) {
                slug
                name
                floorPrice
                volume24h
                priceChange24h
                verified
              }
            }
          `
        })
      });

      if (!response.ok) {
        throw new Error(`Tensor API error: ${response.status}`);
      }

      const result = await response.json();
      this.recordSuccess('tensor');

      if (result.data?.trendingCollections) {
        const trending = result.data.trendingCollections.map((col: any) => ({
          id: col.slug,
          name: col.name,
          floorPrice: col.floorPrice ? col.floorPrice / 1_000_000_000 : 0,
          change24h: col.priceChange24h || 0,
          volume24h: col.volume24h ? col.volume24h / 1_000_000_000 : 0,
          verified: col.verified || false,
          source: 'tensor'
        }));

        return { trending, topGainers: trending };
      }

      return { trending: [], topGainers: [] };

    } catch (error) {
      this.recordFailure('tensor', error);
      this.logger.warn('Tensor collections fetch failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return { trending: [], topGainers: [] };
    }
  }

  /**
   * Get internal trending collections from SWAPS data
   */
  private async getInternalTrendingCollections(): Promise<{ trending: any[]; topGainers: any[] }> {
    try {
      this.recordRequest('internal');
      
      // Get collections from local service
      const allCollections = this.localCollectionService.getAllCollections();
      
      // Sort by some internal metrics (floor price, NFT count, etc.)
      const trending = allCollections
        .filter(col => col.floorPrice && col.floorPrice > 0)
        .sort((a, b) => {
          // Combine floor price and NFT count for ranking
          const scoreA = (a.floorPrice || 0) * Math.log(a.nftCount || 1);
          const scoreB = (b.floorPrice || 0) * Math.log(b.nftCount || 1);
          return scoreB - scoreA;
        })
        .slice(0, 15)
        .map(col => ({
          id: col.id,
          name: col.name,
          floorPrice: col.floorPrice || 0,
          change24h: 0, // Could calculate if we track historical data
          volume24h: col.volume24h || 0,
          verified: col.verified || false,
          source: 'internal'
        }));

      this.recordSuccess('internal');
      return { trending, topGainers: [] };

    } catch (error) {
      this.recordFailure('internal', error);
      this.logger.warn('Internal collections fetch failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return { trending: [], topGainers: [] };
    }
  }

  /**
   * Get hot NFTs from SWAPS internal trending data
   */
  private async getHotNFTs(): Promise<Array<any>> {
    try {
      // This would integrate with the existing TrendingService
      // For now, return empty array to avoid dependencies
      return [];
    } catch (error) {
      this.logger.warn('Hot NFTs fetch failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get market metrics
   */
  private async getMarketMetrics(): Promise<any> {
    try {
      // Aggregate basic market metrics
      return {
        totalVolume24h: 0,
        activeListings: 0,
        avgSalePrice: 0,
        marketSentiment: 'neutral' as const
      };
    } catch (error) {
      this.logger.warn('Market metrics fetch failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        totalVolume24h: 0,
        activeListings: 0,
        avgSalePrice: 0,
        marketSentiment: 'neutral' as const
      };
    }
  }

  // Rate limiting and circuit breaker methods
  private canMakeRequest(source: string): boolean {
    const limiter = this.rateLimiters.get(source);
    if (!limiter) return false;

    const now = new Date();
    const currentMinute = now.getMinutes();

    // Reset counter if we're in a new minute
    if (currentMinute !== limiter.currentMinute) {
      limiter.currentMinute = currentMinute;
      limiter.requestCount = 0;
      limiter.lastReset = now;
    }

    return limiter.requestCount < limiter.requestsPerMinute;
  }

  private recordRequest(source: string): void {
    const limiter = this.rateLimiters.get(source);
    if (limiter) {
      limiter.requestCount++;
    }
  }

  private isCircuitBreakerOpen(source: string): boolean {
    const breaker = this.circuitBreakers.get(source);
    if (!breaker) return false;

    // Check if enough time has passed to reset
    if (breaker.isOpen && Date.now() - breaker.lastFailure.getTime() > breaker.resetTime) {
      breaker.isOpen = false;
      breaker.failureCount = 0;
    }

    return breaker.isOpen;
  }

  private recordSuccess(source: string): void {
    const breaker = this.circuitBreakers.get(source);
    if (breaker) {
      breaker.failureCount = 0;
      breaker.isOpen = false;
    }
  }

  private recordFailure(source: string, error: any): void {
    const breaker = this.circuitBreakers.get(source);
    if (breaker) {
      breaker.failureCount++;
      breaker.lastFailure = new Date();
      
      if (breaker.failureCount >= breaker.threshold) {
        breaker.isOpen = true;
        this.logger.warn(`Circuit breaker opened for ${source}`, {
          failureCount: breaker.failureCount,
          threshold: breaker.threshold
        });
      }
    }
  }

  // Caching methods
  private getCachedData(key: string): any | null {
    const cached = this.marketDataCache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp.getTime() > cached.ttl) {
      this.marketDataCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  private setCachedData(key: string, data: any, ttl: number): void {
    this.marketDataCache.set(key, {
      data,
      timestamp: new Date(),
      ttl
    });
  }

  /**
   * Deduplicate and rank collections by multiple factors
   */
  private deduplicateAndRankCollections(collections: any[]): any[] {
    const uniqueCollections = new Map<string, any>();
    
    collections.forEach(col => {
      const id = col.id || col.name;
      const existing = uniqueCollections.get(id);
      
      if (!existing || this.getCollectionScore(col) > this.getCollectionScore(existing)) {
        uniqueCollections.set(id, col);
      }
    });
    
    return Array.from(uniqueCollections.values())
      .sort((a, b) => this.getCollectionScore(b) - this.getCollectionScore(a));
  }

  /**
   * Calculate collection score for ranking
   */
  private getCollectionScore(collection: any): number {
    let score = 0;
    
    // Floor price weight
    score += (collection.floorPrice || 0) * 10;
    
    // Volume weight  
    score += (collection.volume24h || 0) * 5;
    
    // Verification bonus
    if (collection.verified) score += 50;
    
    // Source reliability bonus
    if (collection.source === 'tensor') score += 20;
    else if (collection.source === 'magiceden') score += 15;
    else if (collection.source === 'internal') score += 10;
    
    return score;
  }

  /**
   * Get fallback market data when all sources fail
   */
  private getFallbackMarketData(): RealTimeMarketData {
    this.logger.info('Using fallback market data');
    
    return {
      collections: {
        trending: [],
        topGainers: []
      },
      nfts: {
        hotNFTs: []
      },
      market: {
        totalVolume24h: 0,
        activeListings: 0,
        avgSalePrice: 0,
        marketSentiment: 'neutral'
      },
      lastUpdated: new Date()
    };
  }

  /**
   * Get service statistics for monitoring
   */
  public getStats(): {
    rateLimits: any;
    circuitBreakers: any;
    cacheStats: any;
  } {
    return {
      rateLimits: Object.fromEntries(this.rateLimiters),
      circuitBreakers: Object.fromEntries(this.circuitBreakers),
      cacheStats: {
        size: this.marketDataCache.size,
        keys: Array.from(this.marketDataCache.keys())
      }
    };
  }

  /**
   * Enable/disable specific data sources
   */
  public configureSource(source: string, enabled: boolean): void {
    if (source in this.enabledSources) {
      (this.enabledSources as any)[source] = enabled;
      this.logger.info(`Data source ${source} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.marketDataCache.clear();
    this.logger.info('Market data cache cleared');
  }
} 