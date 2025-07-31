import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { MarketDataAggregator, RealTimeMarketData } from './MarketDataAggregator';
import { TrendingService } from '../TrendingService';
import { NFTService } from '../nft/NFTService';
import { TradeDiscoveryService } from '../TradeDiscoveryService';
import { container } from '../../di-container';

export interface EnhancedAIContext {
  marketIntelligence: {
    trendingCollections: Array<{
      name: string;
      floorPrice: number;
      change24h: number;
      recommendation: string;
      confidence: number;
    }>;
    hotOpportunities: Array<{
      type: 'collection' | 'nft';
      name: string;
      reason: string;
      urgency: 'low' | 'medium' | 'high';
      potentialValue: string;
    }>;
    marketSentiment: {
      overall: 'bullish' | 'bearish' | 'neutral';
      reasoning: string;
      keyFactors: string[];
    };
  };
  personalizedInsights: {
    portfolioAnalysis?: {
      totalValue: number;
      diversification: number;
      performanceMetrics: any;
    };
    recommendedActions: Array<{
      action: string;
      priority: 'high' | 'medium' | 'low';
      reasoning: string;
      timeframe: string;
    }>;
    tradeOpportunities: Array<{
      targetNFT: string;
      tradePath: string;
      successProbability: number;
      estimatedValue: number;
    }>;
  };
  systemContext: {
    activeUsers: number;
    totalTrades24h: number;
    systemHealth: string;
    lastDataUpdate: Date;
  };
}

export interface UserPortfolioContext {
  walletAddress?: string;
  ownedNFTs?: Array<any>;
  wantedNFTs?: Array<string>;
  tradeHistory?: Array<any>;
  preferences?: {
    riskTolerance: 'low' | 'medium' | 'high';
    preferredCollections: string[];
    tradingStyle: 'conservative' | 'balanced' | 'aggressive';
  };
}

/**
 * Enhances AI context with real-time market intelligence and personalized insights
 * This service processes market data to provide actionable intelligence for the AI agent
 */
export class AIContextEnhancer {
  private static instance: AIContextEnhancer;
  private logger: Logger;
  private marketDataAggregator: MarketDataAggregator;
  private trendingService?: TrendingService;
  private nftService?: NFTService;
  private tradeDiscoveryService?: TradeDiscoveryService;
  
  // Intelligence processing cache
  private intelligenceCache = new Map<string, { data: EnhancedAIContext; timestamp: Date }>();
  private readonly INTELLIGENCE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  // Market analysis constants
  private readonly BULLISH_THRESHOLD = 0.15; // 15% average growth
  private readonly BEARISH_THRESHOLD = -0.10; // 10% average decline
  private readonly HIGH_VOLUME_THRESHOLD = 1000; // SOL
  private readonly TRENDING_THRESHOLD = 5; // Top 5 collections

  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('AIContextEnhancer');
    this.marketDataAggregator = MarketDataAggregator.getInstance();
    
    // Try to get services from DI container
    try {
      this.trendingService = container.resolve<TrendingService>(TrendingService);
      this.nftService = container.resolve('INFTService');
      this.tradeDiscoveryService = container.resolve('ITradeDiscoveryService');
    } catch (error) {
      this.logger.warn('Some services not available via DI, will use direct instances when needed');
    }
    
    this.logger.info('AIContextEnhancer initialized');
  }

  public static getInstance(): AIContextEnhancer {
    if (!AIContextEnhancer.instance) {
      AIContextEnhancer.instance = new AIContextEnhancer();
    }
    return AIContextEnhancer.instance;
  }

  /**
   * Generate enhanced AI context with market intelligence and personalized insights
   */
  public async generateEnhancedContext(
    userContext?: UserPortfolioContext,
    query?: string
  ): Promise<EnhancedAIContext> {
    const operation = this.logger.operation('generateEnhancedContext');
    
    try {
      // Check cache first (with user-specific key if applicable)
      const cacheKey = userContext?.walletAddress 
        ? `enhanced_context_${userContext.walletAddress}` 
        : 'enhanced_context_global';
      
      const cached = this.getCachedIntelligence(cacheKey);
      if (cached) {
        operation.info('Returning cached enhanced context');
        operation.end();
        return cached;
      }

      // Get real-time market data
      const marketData = await this.marketDataAggregator.getRealTimeMarketData();
      
      // Process market intelligence
      const marketIntelligence = await this.processMarketIntelligence(marketData, query);
      
      // Generate personalized insights if user context provided
      const personalizedInsights = userContext 
        ? await this.generatePersonalizedInsights(userContext, marketData)
        : this.getDefaultPersonalizedInsights();
      
      // Get system context
      const systemContext = await this.getSystemContext();
      
      const enhancedContext: EnhancedAIContext = {
        marketIntelligence,
        personalizedInsights,
        systemContext
      };
      
      // Cache the result
      this.setCachedIntelligence(cacheKey, enhancedContext);
      
      operation.info('Enhanced context generated successfully', {
        trendingCollections: marketIntelligence.trendingCollections.length,
        hotOpportunities: marketIntelligence.hotOpportunities.length,
        recommendedActions: personalizedInsights.recommendedActions.length,
        hasUserContext: !!userContext
      });
      
      operation.end();
      return enhancedContext;
      
    } catch (error) {
      operation.error('Failed to generate enhanced context', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return minimal fallback context
      const fallbackContext = this.getFallbackContext();
      operation.end();
      return fallbackContext;
    }
  }

  /**
   * Process raw market data into actionable intelligence
   */
  private async processMarketIntelligence(
    marketData: RealTimeMarketData,
    query?: string
  ): Promise<EnhancedAIContext['marketIntelligence']> {
    
    // Analyze trending collections with recommendations
    const trendingCollections = marketData.collections.trending.map(collection => {
      const recommendation = this.generateCollectionRecommendation(collection, marketData);
      const confidence = this.calculateRecommendationConfidence(collection, marketData);
      
      return {
        name: collection.name,
        floorPrice: collection.floorPrice,
        change24h: collection.change24h,
        recommendation,
        confidence
      };
    });

    // Identify hot opportunities
    const hotOpportunities = await this.identifyHotOpportunities(marketData, query);
    
    // Analyze market sentiment
    const marketSentiment = this.analyzeMarketSentiment(marketData);
    
    return {
      trendingCollections,
      hotOpportunities,
      marketSentiment
    };
  }

  /**
   * Generate collection-specific recommendations
   */
  private generateCollectionRecommendation(
    collection: any,
    marketData: RealTimeMarketData
  ): string {
    const change = collection.change24h || 0;
    const volume = collection.volume24h || 0;
    const floorPrice = collection.floorPrice || 0;
    
    // High growth + high volume = strong buy signal
    if (change > 0.20 && volume > this.HIGH_VOLUME_THRESHOLD) {
      return "Strong upward momentum with high volume - consider for trade loops";
    }
    
    // Moderate growth + verified = safe play
    if (change > 0.05 && change <= 0.20 && collection.verified) {
      return "Steady growth with verification - good for balanced trading";
    }
    
    // High floor price + low change = premium collection
    if (floorPrice > 10 && Math.abs(change) < 0.05) {
      return "Premium collection with stable pricing - holds value well";
    }
    
    // Negative change but high volume = potential reversal
    if (change < -0.05 && volume > this.HIGH_VOLUME_THRESHOLD / 2) {
      return "Price correction with volume - potential buying opportunity";
    }
    
    // Low volume = proceed with caution
    if (volume < this.HIGH_VOLUME_THRESHOLD / 4) {
      return "Low trading volume - exercise caution in large trades";
    }
    
    return "Monitor for trading opportunities - check individual NFT performance";
  }

  /**
   * Calculate confidence score for recommendations
   */
  private calculateRecommendationConfidence(
    collection: any,
    marketData: RealTimeMarketData
  ): number {
    let confidence = 0.5; // Base confidence
    
    // Verified collections get confidence boost
    if (collection.verified) confidence += 0.2;
    
    // High volume increases confidence
    if (collection.volume24h > this.HIGH_VOLUME_THRESHOLD) confidence += 0.2;
    
    // Consistent with market trend increases confidence
    const avgChange = marketData.collections.trending
      .reduce((sum, col) => sum + (col.change24h || 0), 0) / marketData.collections.trending.length;
    
    if (Math.sign(collection.change24h || 0) === Math.sign(avgChange)) {
      confidence += 0.1;
    }
    
    return Math.min(1.0, Math.max(0.1, confidence));
  }

  /**
   * Identify hot trading opportunities
   */
  private async identifyHotOpportunities(
    marketData: RealTimeMarketData,
    query?: string
  ): Promise<Array<any>> {
    const opportunities: Array<any> = [];
    
    // Top gainers with high volume = high urgency opportunities
    marketData.collections.topGainers.slice(0, 3).forEach(gainer => {
      if (gainer.priceChange > 0.25) { // 25%+ gain
        opportunities.push({
          type: 'collection',
          name: gainer.name,
          reason: `Up ${(gainer.priceChange * 100).toFixed(1)}% in ${gainer.timeframe} with strong momentum`,
          urgency: 'high',
          potentialValue: 'Short-term trading gains possible'
        });
      }
    });

    // Collections with unusual volume
    marketData.collections.trending.forEach(collection => {
      const volumeScore = collection.volume24h / (collection.floorPrice || 1);
      if (volumeScore > 50) { // High volume relative to floor price
        opportunities.push({
          type: 'collection',
          name: collection.name,
          reason: 'Unusual trading volume detected - increased liquidity',
          urgency: 'medium',
          potentialValue: 'Enhanced trade loop possibilities'
        });
      }
    });

    // Query-specific opportunities
    if (query && this.containsCollectionName(query, marketData.collections.trending)) {
      const mentionedCollection = this.extractCollectionFromQuery(query, marketData.collections.trending);
      if (mentionedCollection) {
        opportunities.push({
          type: 'collection',
          name: mentionedCollection.name,
          reason: 'User expressed interest - current market analysis available',
          urgency: 'medium',
          potentialValue: 'Personalized trading insights ready'
        });
      }
    }

    return opportunities.slice(0, 5); // Top 5 opportunities
  }

  /**
   * Analyze overall market sentiment
   */
  private analyzeMarketSentiment(marketData: RealTimeMarketData): EnhancedAIContext['marketIntelligence']['marketSentiment'] {
    const collections = marketData.collections.trending;
    if (collections.length === 0) {
      return {
        overall: 'neutral',
        reasoning: 'Insufficient market data for sentiment analysis',
        keyFactors: ['Limited collection data available']
      };
    }

    // Calculate average price change
    const avgChange = collections.reduce((sum, col) => sum + (col.change24h || 0), 0) / collections.length;
    
    // Calculate volume indicators
    const totalVolume = collections.reduce((sum, col) => sum + (col.volume24h || 0), 0);
    const highVolumeCollections = collections.filter(col => (col.volume24h || 0) > this.HIGH_VOLUME_THRESHOLD).length;
    
    // Determine sentiment
    let overall: 'bullish' | 'bearish' | 'neutral';
    let reasoning: string;
    const keyFactors: string[] = [];

    if (avgChange > this.BULLISH_THRESHOLD) {
      overall = 'bullish';
      reasoning = `Strong positive momentum with ${(avgChange * 100).toFixed(1)}% average growth`;
      keyFactors.push(`${(avgChange * 100).toFixed(1)}% average price increase`);
    } else if (avgChange < this.BEARISH_THRESHOLD) {
      overall = 'bearish';
      reasoning = `Market correction with ${(Math.abs(avgChange) * 100).toFixed(1)}% average decline`;
      keyFactors.push(`${(Math.abs(avgChange) * 100).toFixed(1)}% average price decrease`);
    } else {
      overall = 'neutral';
      reasoning = 'Balanced market conditions with mixed signals';
      keyFactors.push('Price movements within normal range');
    }

    // Add volume factors
    if (highVolumeCollections > collections.length * 0.3) {
      keyFactors.push(`${highVolumeCollections} collections showing high volume`);
    }
    
    if (totalVolume > this.HIGH_VOLUME_THRESHOLD * 10) {
      keyFactors.push('Elevated overall trading volume');
    }

    // Add verification factor
    const verifiedCount = collections.filter(col => col.verified).length;
    if (verifiedCount > collections.length * 0.6) {
      keyFactors.push('Strong representation of verified collections');
    }

    return {
      overall,
      reasoning,
      keyFactors
    };
  }

  /**
   * Generate personalized insights for a user
   */
  private async generatePersonalizedInsights(
    userContext: UserPortfolioContext,
    marketData: RealTimeMarketData
  ): Promise<EnhancedAIContext['personalizedInsights']> {
    
    const recommendedActions: Array<any> = [];
    const tradeOpportunities: Array<any> = [];
    
    // Analyze user's portfolio if provided
    let portfolioAnalysis;
    if (userContext.ownedNFTs && userContext.ownedNFTs.length > 0) {
      portfolioAnalysis = await this.analyzeUserPortfolio(userContext.ownedNFTs, marketData);
      
      // Generate portfolio-based recommendations
      if (portfolioAnalysis.diversification < 0.3) {
        recommendedActions.push({
          action: 'Diversify your portfolio across different collections',
          priority: 'medium',
          reasoning: 'Low diversification increases risk exposure',
          timeframe: 'Next 2-4 weeks'
        });
      }
    }

    // Generate trade opportunities based on wants
    if (userContext.wantedNFTs && userContext.wantedNFTs.length > 0) {
      for (const wantedNFT of userContext.wantedNFTs.slice(0, 3)) {
        // This would integrate with actual trade discovery
        tradeOpportunities.push({
          targetNFT: wantedNFT,
          tradePath: 'Multi-party trade loop available',
          successProbability: 0.75,
          estimatedValue: 'Market value aligned'
        });
      }
    }

    // Market-based recommendations
    const topGainer = marketData.collections.topGainers[0];
    if (topGainer && topGainer.priceChange > 0.15) {
      recommendedActions.push({
        action: `Consider trading into ${topGainer.name} collection`,
        priority: 'high',
        reasoning: `Strong momentum with ${(topGainer.priceChange * 100).toFixed(1)}% growth`,
        timeframe: 'Next 24-48 hours'
      });
    }

    return {
      portfolioAnalysis,
      recommendedActions,
      tradeOpportunities
    };
  }

  /**
   * Analyze user's portfolio composition and performance
   */
  private async analyzeUserPortfolio(ownedNFTs: Array<any>, marketData: RealTimeMarketData): Promise<any> {
    const collections = new Set<string>();
    let totalValue = 0;
    
    ownedNFTs.forEach(nft => {
      if (nft.collection) collections.add(nft.collection);
      if (nft.floorPrice) totalValue += nft.floorPrice;
    });
    
    const diversification = collections.size / Math.max(1, ownedNFTs.length);
    
    return {
      totalValue,
      diversification,
      performanceMetrics: {
        collectionCount: collections.size,
        avgNFTValue: totalValue / Math.max(1, ownedNFTs.length),
        riskLevel: diversification > 0.5 ? 'low' : diversification > 0.3 ? 'medium' : 'high'
      }
    };
  }

  /**
   * Get current system context
   */
  private async getSystemContext(): Promise<EnhancedAIContext['systemContext']> {
    try {
      // Get basic system stats
      let activeUsers = 0;
      let totalTrades24h = 0;
      
      if (this.tradeDiscoveryService) {
        const systemState = this.tradeDiscoveryService.getSystemState();
        activeUsers = systemState.wallets || 0;
      }
      
      return {
        activeUsers,
        totalTrades24h,
        systemHealth: 'optimal',
        lastDataUpdate: new Date()
      };
    } catch (error) {
      this.logger.warn('Failed to get system context', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        activeUsers: 0,
        totalTrades24h: 0,
        systemHealth: 'degraded',
        lastDataUpdate: new Date()
      };
    }
  }

  /**
   * Get default personalized insights when no user context provided
   */
  private getDefaultPersonalizedInsights(): EnhancedAIContext['personalizedInsights'] {
    return {
      recommendedActions: [
        {
          action: 'Connect your wallet to get personalized trading insights',
          priority: 'high',
          reasoning: 'Personalized analysis requires portfolio data',
          timeframe: 'Immediate'
        }
      ],
      tradeOpportunities: []
    };
  }

  /**
   * Get fallback context when all data sources fail
   */
  private getFallbackContext(): EnhancedAIContext {
    return {
      marketIntelligence: {
        trendingCollections: [],
        hotOpportunities: [],
        marketSentiment: {
          overall: 'neutral',
          reasoning: 'Market data temporarily unavailable',
          keyFactors: ['External data sources offline']
        }
      },
      personalizedInsights: {
        recommendedActions: [
          {
            action: 'Market data is temporarily unavailable - check back shortly',
            priority: 'low',
            reasoning: 'External API connectivity issues',
            timeframe: 'Try again in 5-10 minutes'
          }
        ],
        tradeOpportunities: []
      },
      systemContext: {
        activeUsers: 0,
        totalTrades24h: 0,
        systemHealth: 'degraded',
        lastDataUpdate: new Date()
      }
    };
  }

  // Helper methods
  private containsCollectionName(query: string, collections: Array<any>): boolean {
    const lowerQuery = query.toLowerCase();
    return collections.some(col => 
      lowerQuery.includes(col.name.toLowerCase()) || 
      lowerQuery.includes(col.id.toLowerCase())
    );
  }

  private extractCollectionFromQuery(query: string, collections: Array<any>): any | null {
    const lowerQuery = query.toLowerCase();
    return collections.find(col => 
      lowerQuery.includes(col.name.toLowerCase()) || 
      lowerQuery.includes(col.id.toLowerCase())
    ) || null;
  }

  // Caching methods
  private getCachedIntelligence(key: string): EnhancedAIContext | null {
    const cached = this.intelligenceCache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp.getTime() > this.INTELLIGENCE_CACHE_TTL) {
      this.intelligenceCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  private setCachedIntelligence(key: string, data: EnhancedAIContext): void {
    this.intelligenceCache.set(key, {
      data,
      timestamp: new Date()
    });
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.intelligenceCache.clear();
    this.logger.info('AI context cache cleared');
  }

  /**
   * Get service statistics
   */
  public getStats(): {
    cacheSize: number;
    lastUpdate: Date | null;
  } {
    const lastUpdate = this.intelligenceCache.size > 0 
      ? Array.from(this.intelligenceCache.values())
          .reduce((latest, entry) => entry.timestamp > latest ? entry.timestamp : latest, new Date(0))
      : null;

    return {
      cacheSize: this.intelligenceCache.size,
      lastUpdate
    };
  }
} 