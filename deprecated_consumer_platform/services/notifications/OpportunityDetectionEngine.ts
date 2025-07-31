import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { MarketDataAggregator, RealTimeMarketData } from '../ai/MarketDataAggregator';
import { AIContextEnhancer, EnhancedAIContext } from '../ai/AIContextEnhancer';
import { TrendingService } from '../TrendingService';
import { TradeDiscoveryService } from '../TradeDiscoveryService';
import { WebSocketNotificationService, NotificationPayload } from './WebSocketNotificationService';
import { FeatureFlagService } from '../ai/FeatureFlagService';
import { container } from '../../di-container';

export interface TradeOpportunity {
  id: string;
  type: 'new_trade_available' | 'price_improvement' | 'rare_nft_available' | 'collection_trending' | 'market_shift';
  walletAddress: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  data: {
    nftAddress?: string;
    collectionId?: string;
    tradeLoop?: any;
    priceChange?: number;
    timeWindow?: string;
    estimatedValue?: number;
    successProbability?: number;
    expiresAt?: Date;
  };
  timestamp: Date;
}

export interface OpportunityDetectionMetrics {
  totalOpportunitiesDetected: number;
  opportunitiesByType: Record<string, number>;
  averageDetectionTime: number;
  userEngagementRate: number;
  falsePositiveRate: number;
  notificationsSent: number;
  lastAnalysisTime: Date;
}

export interface OpportunityFilter {
  walletAddress: string;
  preferences: {
    minTradeValue?: number;
    maxRiskLevel?: 'low' | 'medium' | 'high';
    preferredCollections?: string[];
    timeframe?: '1h' | '6h' | '24h' | '7d';
    opportunityTypes?: string[];
    priceChangeThreshold?: number;
  };
  userState: {
    ownedNFTs: string[];
    wantedNFTs: string[];
    wantedCollections: string[];
    recentTrades: any[];
  };
}

/**
 * Intelligent engine that analyzes market changes and user context to detect personalized trade opportunities
 * Integrates with AI market intelligence and real-time data to generate high-value notifications
 */
export class OpportunityDetectionEngine {
  private static instance: OpportunityDetectionEngine;
  private logger: Logger;
  private marketDataAggregator: MarketDataAggregator;
  private aiContextEnhancer: AIContextEnhancer;
  private notificationService: WebSocketNotificationService;
  private featureFlagService: FeatureFlagService;
  
  // Optional services (may not be available via DI)
  private trendingService?: TrendingService;
  private tradeDiscoveryService?: TradeDiscoveryService;
  
  // Detection state
  private lastMarketSnapshot?: RealTimeMarketData;
  private userOpportunityCache = new Map<string, TradeOpportunity[]>();
  private detectionMetrics: OpportunityDetectionMetrics = {
    totalOpportunitiesDetected: 0,
    opportunitiesByType: {},
    averageDetectionTime: 0,
    userEngagementRate: 0,
    falsePositiveRate: 0,
    notificationsSent: 0,
    lastAnalysisTime: new Date()
  };
  
  // Analysis intervals and thresholds
  private readonly ANALYSIS_INTERVAL = 2 * 60 * 1000; // 2 minutes
  private readonly PRICE_CHANGE_THRESHOLD = 0.15; // 15% price change
  private readonly HIGH_PRIORITY_THRESHOLD = 0.25; // 25% price change
  private readonly RARE_NFT_DEMAND_THRESHOLD = 10; // 10+ users wanting same NFT
  private readonly TRENDING_VELOCITY_THRESHOLD = 5; // 5+ new wants in last hour
  
  private analysisInterval?: NodeJS.Timeout;

  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('OpportunityDetectionEngine');
    this.marketDataAggregator = MarketDataAggregator.getInstance();
    this.aiContextEnhancer = AIContextEnhancer.getInstance();
    this.notificationService = WebSocketNotificationService.getInstance();
    this.featureFlagService = FeatureFlagService.getInstance();
    
    // Try to get optional services from DI container
    try {
      this.trendingService = container.resolve<TrendingService>(TrendingService);
      this.tradeDiscoveryService = container.resolve('ITradeDiscoveryService');
    } catch (error) {
      this.logger.warn('Some services not available via DI, core detection will work with reduced functionality');
    }
    
    this.logger.info('OpportunityDetectionEngine initialized');
  }

  public static getInstance(): OpportunityDetectionEngine {
    if (!OpportunityDetectionEngine.instance) {
      OpportunityDetectionEngine.instance = new OpportunityDetectionEngine();
    }
    return OpportunityDetectionEngine.instance;
  }

  /**
   * Start the opportunity detection engine
   */
  public start(): void {
    if (this.analysisInterval) {
      this.logger.warn('OpportunityDetectionEngine already running');
      return;
    }

    this.analysisInterval = setInterval(() => {
      this.performOpportunityAnalysis();
    }, this.ANALYSIS_INTERVAL);

    // Perform initial analysis
    this.performOpportunityAnalysis();

    this.logger.info('OpportunityDetectionEngine started', {
      interval: this.ANALYSIS_INTERVAL,
      thresholds: {
        priceChange: this.PRICE_CHANGE_THRESHOLD,
        highPriority: this.HIGH_PRIORITY_THRESHOLD,
        rareDemand: this.RARE_NFT_DEMAND_THRESHOLD
      }
    });
  }

  /**
   * Stop the opportunity detection engine
   */
  public stop(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = undefined;
    }
    
    this.logger.info('OpportunityDetectionEngine stopped');
  }

  /**
   * Perform comprehensive opportunity analysis
   */
  private async performOpportunityAnalysis(): Promise<void> {
    const operation = this.logger.operation('performOpportunityAnalysis');
    
    try {
      const startTime = Date.now();
      
      // Get current market data
      const currentMarketData = await this.marketDataAggregator.getRealTimeMarketData();
      
      // Analyze different types of opportunities
      const [
        priceChangeOpportunities,
        trendingOpportunities,
        rareNFTOpportunities,
        newTradeOpportunities
      ] = await Promise.allSettled([
        this.analyzePriceChangeOpportunities(currentMarketData),
        this.analyzeTrendingOpportunities(currentMarketData),
        this.analyzeRareNFTOpportunities(),
        this.analyzeNewTradeOpportunities()
      ]);

      // Collect all opportunities
      const allOpportunities: TradeOpportunity[] = [];
      
      if (priceChangeOpportunities.status === 'fulfilled') {
        allOpportunities.push(...priceChangeOpportunities.value);
      }
      if (trendingOpportunities.status === 'fulfilled') {
        allOpportunities.push(...trendingOpportunities.value);
      }
      if (rareNFTOpportunities.status === 'fulfilled') {
        allOpportunities.push(...rareNFTOpportunities.value);
      }
      if (newTradeOpportunities.status === 'fulfilled') {
        allOpportunities.push(...newTradeOpportunities.value);
      }

      // Process opportunities for each connected user
      await this.processOpportunitiesForUsers(allOpportunities);
      
      // Update metrics
      const detectionTime = Date.now() - startTime;
      this.updateDetectionMetrics(allOpportunities, detectionTime);
      
      // Store market snapshot for next analysis
      this.lastMarketSnapshot = currentMarketData;
      
      operation.info('Opportunity analysis completed', {
        totalOpportunities: allOpportunities.length,
        detectionTime,
        opportunityTypes: this.getOpportunityTypeCounts(allOpportunities)
      });
      
      operation.end();
    } catch (error) {
      operation.error('Error during opportunity analysis', {
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
    }
  }

  /**
   * Analyze price change opportunities
   */
  private async analyzePriceChangeOpportunities(currentData: RealTimeMarketData): Promise<TradeOpportunity[]> {
    const opportunities: TradeOpportunity[] = [];
    
    if (!this.lastMarketSnapshot) {
      return opportunities; // Need baseline for comparison
    }

    // Analyze collection price changes
    for (const collection of currentData.collections.trending) {
      const lastCollection = this.lastMarketSnapshot.collections.trending
        .find(c => c.id === collection.id);
      
      if (!lastCollection) continue;

      const priceChange = (collection.floorPrice - lastCollection.floorPrice) / lastCollection.floorPrice;
      
      if (Math.abs(priceChange) >= this.PRICE_CHANGE_THRESHOLD) {
        const isPositive = priceChange > 0;
        const priority = Math.abs(priceChange) >= this.HIGH_PRIORITY_THRESHOLD ? 'high' : 'medium';
        
        opportunities.push({
          id: `price_change_${collection.id}_${Date.now()}`,
          type: 'price_improvement',
          walletAddress: '', // Will be set per user
          title: `${collection.name} ${isPositive ? 'Surged' : 'Dropped'} ${(Math.abs(priceChange) * 100).toFixed(1)}%`,
          description: isPositive 
            ? `Floor price increased to ${collection.floorPrice.toFixed(2)} SOL - consider trading into trending collection`
            : `Floor price dropped to ${collection.floorPrice.toFixed(2)} SOL - potential buying opportunity`,
          priority: priority as 'medium' | 'high',
          data: {
            collectionId: collection.id,
            priceChange,
            timeWindow: '2m',
            expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
          },
          timestamp: new Date()
        });
      }
    }

    return opportunities;
  }

  /**
   * Analyze trending opportunities
   */
  private async analyzeTrendingOpportunities(currentData: RealTimeMarketData): Promise<TradeOpportunity[]> {
    const opportunities: TradeOpportunity[] = [];
    
    // Analyze top gainers for momentum opportunities
    for (const gainer of currentData.collections.topGainers.slice(0, 3)) {
      if (gainer.priceChange >= this.PRICE_CHANGE_THRESHOLD) {
        opportunities.push({
          id: `trending_${gainer.id}_${Date.now()}`,
          type: 'collection_trending',
          walletAddress: '',
          title: `🔥 ${gainer.name} Trending Up`,
          description: `Up ${(gainer.priceChange * 100).toFixed(1)}% in ${gainer.timeframe} - strong momentum detected`,
          priority: gainer.priceChange >= this.HIGH_PRIORITY_THRESHOLD ? 'high' : 'medium',
          data: {
            collectionId: gainer.id,
            priceChange: gainer.priceChange,
            timeWindow: gainer.timeframe,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
          },
          timestamp: new Date()
        });
      }
    }

    return opportunities;
  }

  /**
   * Analyze rare NFT opportunities using trending service
   */
  private async analyzeRareNFTOpportunities(): Promise<TradeOpportunity[]> {
    const opportunities: TradeOpportunity[] = [];
    
    if (!this.trendingService) {
      return opportunities;
    }

    try {
      const trendingWantedNFTs = await this.trendingService.getTrendingWantedNfts(20);
      
      for (const wanted of trendingWantedNFTs) {
        if (wanted.wantCount >= this.RARE_NFT_DEMAND_THRESHOLD) {
          opportunities.push({
            id: `rare_nft_${wanted.nftAddress}_${Date.now()}`,
            type: 'rare_nft_available',
            walletAddress: '',
            title: `💎 High Demand NFT Spotted`,
            description: `${wanted.metadata?.name || 'Rare NFT'} wanted by ${wanted.wantCount} traders - excellent trade potential`,
            priority: wanted.wantCount >= this.RARE_NFT_DEMAND_THRESHOLD * 2 ? 'high' : 'medium',
            data: {
              nftAddress: wanted.nftAddress,
              collectionId: wanted.metadata?.collection as string,
              estimatedValue: wanted.metadata?.floorPrice || 0,
              successProbability: Math.min(0.95, wanted.wantCount / 20), // Higher demand = higher success
              expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
            },
            timestamp: new Date()
          });
        }
      }
    } catch (error) {
      this.logger.warn('Error analyzing rare NFT opportunities', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return opportunities;
  }

  /**
   * Analyze new trade opportunities using trade discovery
   */
  private async analyzeNewTradeOpportunities(): Promise<TradeOpportunity[]> {
    const opportunities: TradeOpportunity[] = [];
    
    // This would integrate with the trade discovery service to find new loops
    // For now, we'll use a simplified approach
    
    return opportunities;
  }

  /**
   * Process opportunities for all connected users
   */
  private async processOpportunitiesForUsers(opportunities: TradeOpportunity[]): Promise<void> {
    const connectedUsers = this.notificationService.getActiveSubscriptions();
    
    for (const user of connectedUsers) {
      const userWallet = user.walletAddress.replace('...', ''); // Would need full address in practice
      
      // Skip if notifications not enabled for user
      if (!this.featureFlagService.isEnabled('real_time_notifications', userWallet)) {
        continue;
      }

      const relevantOpportunities = await this.filterOpportunitiesForUser(
        opportunities, 
        userWallet, 
        user.preferences
      );

      for (const opportunity of relevantOpportunities) {
        await this.sendOpportunityNotification(userWallet, opportunity);
      }
    }
  }

  /**
   * Filter opportunities based on user preferences and context
   */
  private async filterOpportunitiesForUser(
    opportunities: TradeOpportunity[], 
    walletAddress: string, 
    userPreferences: any
  ): Promise<TradeOpportunity[]> {
    const filtered: TradeOpportunity[] = [];
    
    for (const opportunity of opportunities) {
      // Check minimum trade value
      if (userPreferences.minTradeValue && 
          opportunity.data.estimatedValue && 
          opportunity.data.estimatedValue < userPreferences.minTradeValue) {
        continue;
      }

      // Check collection preferences
      if (userPreferences.collections && 
          userPreferences.collections.length > 0 &&
          opportunity.data.collectionId &&
          !userPreferences.collections.includes(opportunity.data.collectionId)) {
        continue;
      }

      // Check if user already has this NFT
      if (opportunity.data.nftAddress) {
        // Would need to check user's owned NFTs
        // For now, assume it's relevant
      }

      // Set wallet address for this user
      opportunity.walletAddress = walletAddress;
      filtered.push(opportunity);
    }

    // Limit to top 3 opportunities per analysis to avoid spam
    return filtered
      .sort((a, b) => {
        // Sort by priority then by estimated value
        const priorityScore = { critical: 4, high: 3, medium: 2, low: 1 };
        const scoreA = priorityScore[a.priority] * 100 + (a.data.estimatedValue || 0);
        const scoreB = priorityScore[b.priority] * 100 + (b.data.estimatedValue || 0);
        return scoreB - scoreA;
      })
      .slice(0, 3);
  }

  /**
   * Send opportunity notification to user
   */
  private async sendOpportunityNotification(walletAddress: string, opportunity: TradeOpportunity): Promise<void> {
    const notification: NotificationPayload = {
      id: opportunity.id,
      type: 'trade_opportunity',
      title: opportunity.title,
      message: opportunity.description,
      priority: opportunity.priority,
      walletAddress,
      data: {
        tradeLoop: opportunity.data.tradeLoop,
        nftAddress: opportunity.data.nftAddress,
        collectionId: opportunity.data.collectionId,
        priceChange: opportunity.data.priceChange,
        timeframe: opportunity.data.timeWindow,
        actionRequired: true,
        expiresAt: opportunity.data.expiresAt
      },
      timestamp: opportunity.timestamp,
      read: false
    };

    const sent = await this.notificationService.sendNotificationToUser(walletAddress, notification);
    
    if (sent) {
      this.detectionMetrics.notificationsSent++;
      this.logger.debug('Opportunity notification sent', {
        walletAddress: walletAddress.substring(0, 8) + '...',
        type: opportunity.type,
        priority: opportunity.priority
      });
    }
  }

  /**
   * Update detection metrics
   */
  private updateDetectionMetrics(opportunities: TradeOpportunity[], detectionTime: number): void {
    this.detectionMetrics.totalOpportunitiesDetected += opportunities.length;
    this.detectionMetrics.averageDetectionTime = 
      (this.detectionMetrics.averageDetectionTime + detectionTime) / 2;
    this.detectionMetrics.lastAnalysisTime = new Date();

    // Update opportunity type counts
    for (const opportunity of opportunities) {
      this.detectionMetrics.opportunitiesByType[opportunity.type] = 
        (this.detectionMetrics.opportunitiesByType[opportunity.type] || 0) + 1;
    }
  }

  /**
   * Get opportunity type counts for logging
   */
  private getOpportunityTypeCounts(opportunities: TradeOpportunity[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const opportunity of opportunities) {
      counts[opportunity.type] = (counts[opportunity.type] || 0) + 1;
    }
    return counts;
  }

  /**
   * Get detection metrics
   */
  public getMetrics(): OpportunityDetectionMetrics {
    return { ...this.detectionMetrics };
  }

  /**
   * Get opportunities for a specific user (admin/debug)
   */
  public getUserOpportunities(walletAddress: string): TradeOpportunity[] {
    return this.userOpportunityCache.get(walletAddress) || [];
  }

  /**
   * Manually trigger opportunity analysis (for testing/admin)
   */
  public async triggerAnalysis(): Promise<void> {
    await this.performOpportunityAnalysis();
  }
} 