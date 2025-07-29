import { BaseService } from '../base.service';
import { LLMService, LLMResponse } from './llm.service';
import { SwapsKnowledgeService } from './swaps-knowledge.service';
import { AIResponseCacheService } from './ai-response-cache.service';
import { TradeLoop } from '@/types/trade';
import { NFTMetadata } from '@/types/nft';

export interface AIQueryContext {
  walletAddress?: string;
  userNFTs?: NFTMetadata[];
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  lastShownTrades?: TradeLoop[];
  currentTradeIndex?: number;
  recentTradeContext?: {
    totalTradesShown: number;
    currentTradeIndex: number;
    currentTrade: TradeLoop;
    tradeBreakdown: {
      direct: number;
      threeWay: number;
      multiParty: number;
    };
  };
}

export interface BackendAIContext {
  systemStats: {
    totalActiveWallets: number;
    totalNFTsIndexed: number;
    totalCollectionsTracked: number;
    completedTrades: number;
    activeTrades: number;
    successRate: number;
  };
  marketData: {
    trendingNFTs: any[];
    topCollections: any[];
    recentTrades: TradeLoop[];
    volume24h: number;
  };
  userContext?: {
    wallet: string;
    portfolio: NFTMetadata[];
    tradeHistory: TradeLoop[];
    wantsList: string[];
  };
  discoveredTrades?: TradeLoop[];
  enhanced?: {
    marketIntelligence: any;
    personalizedInsights: any;
    systemContext: any;
  };
  featuresEnabled?: {
    marketIntelligence: boolean;
    personalizedInsights: boolean;
  };
}

/**
 * Enhanced AI Service that combines frontend knowledge with backend data
 * for the most comprehensive and intelligent responses
 */
export class EnhancedAIService extends BaseService {
  private static instance: EnhancedAIService;
  private llmService: LLMService;
  private swapsKnowledge: SwapsKnowledgeService;

  private constructor() {
    super();
    this.llmService = LLMService.getInstance();
    this.swapsKnowledge = SwapsKnowledgeService.getInstance();
  }

  public static getInstance(): EnhancedAIService {
    if (!EnhancedAIService.instance) {
      EnhancedAIService.instance = new EnhancedAIService();
    }
    return EnhancedAIService.instance;
  }

  /**
   * Process user query with full backend context
   */
  async processQueryWithFullContext(
    query: string,
    context: AIQueryContext
  ): Promise<LLMResponse> {
    try {
      // Get backend AI context with enhanced intelligence if available
      let backendContext: BackendAIContext | null = null;
      
      try {
        // First check feature flags
        const featureFlagsResponse = await this.apiGet<{ success: boolean; flags: any[] }>(
          `/api/ai/feature-flags?walletAddress=${context.walletAddress || ''}`
        );
        
        const enhancedEnabled = featureFlagsResponse.success && 
          featureFlagsResponse.flags.find(f => f.name === 'enhanced_market_intelligence')?.enabled;
        
        const personalizedEnabled = featureFlagsResponse.success && 
          featureFlagsResponse.flags.find(f => f.name === 'personalized_insights')?.enabled;

        // Use enhanced AI query if available
        const response = await this.apiPost<{ success: boolean; context: BackendAIContext; enhanced?: any }>(
          '/api/ai/query',
          {
            query,
            walletAddress: context.walletAddress,
            context: {
              userNFTs: context.userNFTs,
              conversationHistory: context.conversationHistory,
              lastShownTrades: context.lastShownTrades,
              wantedNFTs: [] // TODO: Add wanted NFTs from user context when available
            }
          }
        );
        
        if (response.success) {
          backendContext = response.context;
          
          // Add enhanced data if available
          if (response.enhanced) {
            backendContext.enhanced = response.enhanced;
            backendContext.featuresEnabled = {
              marketIntelligence: enhancedEnabled,
              personalizedInsights: personalizedEnabled
            };
          }
        }
      } catch (error) {
        console.log('Backend AI not available, using frontend-only context');
      }

      // Enhance the context with backend data and recent trade context
      const enhancedContext = this.mergeContexts(context, backendContext);
      
      // Add specific context about recently shown trades
      if (context.lastShownTrades && context.lastShownTrades.length > 0) {
        const currentTradeIndex = context.currentTradeIndex || 0;
        const currentTrade = context.lastShownTrades[currentTradeIndex];
        
        // Build a detailed context about recent trades
        enhancedContext.recentTradeContext = {
          totalTradesShown: context.lastShownTrades.length,
          currentTradeIndex: currentTradeIndex,
          currentTrade: currentTrade,
          tradeBreakdown: context.lastShownTrades.reduce((acc, trade) => {
            const participants = trade.totalParticipants;
            if (participants === 2) acc.direct++;
            else if (participants === 3) acc.threeWay++;
            else acc.multiParty++;
            return acc;
          }, { direct: 0, threeWay: 0, multiParty: 0 })
        };
      }

      // Process with LLM
      return await this.llmService.processUserQuery(query, enhancedContext);
    } catch (error) {
      console.error('Error processing AI query with full context:', error);
      
      // Fallback to basic LLM processing
      return await this.llmService.processUserQuery(query, context);
    }
  }

  /**
   * Get real-time data snapshot from backend
   */
  async getDataSnapshot(): Promise<any> {
    try {
      const response = await this.apiGet<{ success: boolean; snapshot: any }>('/api/ai/context');
      
      if (response.success) {
        return response.snapshot;
      }
    } catch (error) {
      console.log('Could not fetch data snapshot from backend');
    }
    
    return null;
  }

  /**
   * Get AI insights for a specific collection
   */
  async getCollectionInsights(collectionId: string): Promise<any> {
    try {
      const response = await this.apiGet<{ success: boolean; insights: any }>(
        `/api/ai/collection-insights/${collectionId}`
      );
      
      if (response.success) {
        return response.insights;
      }
    } catch (error) {
      console.log('Could not fetch collection insights from backend');
    }
    
    return null;
  }

  /**
   * Merge frontend and backend contexts
   */
  private mergeContexts(
    frontendContext: AIQueryContext,
    backendContext: BackendAIContext | null
  ): AIQueryContext {
    if (!backendContext) {
      return frontendContext;
    }

    // Create enhanced context with backend data
    const enhanced: any = { ...frontendContext };

    // Add discovered trades from backend
    if (backendContext.discoveredTrades && backendContext.discoveredTrades.length > 0) {
      enhanced.discoveredTrades = backendContext.discoveredTrades;
    }

    // Add market context
    enhanced.marketContext = {
      systemStats: backendContext.systemStats,
      marketData: backendContext.marketData,
      userContext: backendContext.userContext
    };

    // Merge user portfolio if backend has more complete data
    if (backendContext.userContext?.portfolio && 
        backendContext.userContext.portfolio.length > (frontendContext.userNFTs?.length || 0)) {
      enhanced.userNFTs = backendContext.userContext.portfolio;
    }

    return enhanced;
  }

  /**
   * Analyze trade opportunities with AI insights
   */
  async analyzeTradeOpportunities(
    trades: TradeLoop[],
    userWallet: string
  ): Promise<{
    bestTrade: TradeLoop | null;
    analysis: string;
    recommendations: string[];
  }> {
    if (trades.length === 0) {
      return {
        bestTrade: null,
        analysis: 'No trades available to analyze.',
        recommendations: ['Try searching for different NFTs', 'Check back later for new opportunities']
      };
    }

    // Score and sort trades
    const scoredTrades = trades.map(trade => ({
      trade,
      score: this.calculateTradeScore(trade, userWallet)
    })).sort((a, b) => b.score - a.score);

    const bestTrade = scoredTrades[0].trade;
    
    // Generate AI analysis
    const analysis = await this.llmService.analyzeTradeLoop(bestTrade, userWallet);
    
    // Generate recommendations
    const recommendations = this.generateTradeRecommendations(scoredTrades, userWallet);

    return {
      bestTrade,
      analysis,
      recommendations
    };
  }

  /**
   * Calculate comprehensive trade score
   */
  private calculateTradeScore(trade: TradeLoop, userWallet: string): number {
    let score = trade.efficiency * 100;

    // Bonus for smaller loops (easier to execute)
    if (trade.totalParticipants <= 3) score += 10;
    
    // Bonus for high-quality score
    if (trade.qualityScore && trade.qualityScore > 0.9) score += 15;
    
    // Check if user is giving high-value NFT
    const userStep = trade.steps.find(s => s.from === userWallet);
    if (userStep && userStep.nfts[0]?.floorPrice) {
      if (userStep.nfts[0].floorPrice > 10) score -= 5; // Penalty for giving expensive NFT
    }

    return Math.min(100, score);
  }

  /**
   * Generate smart trade recommendations
   */
  private generateTradeRecommendations(
    scoredTrades: Array<{ trade: TradeLoop; score: number }>,
    userWallet: string
  ): string[] {
    const recommendations: string[] = [];

    if (scoredTrades.length > 0) {
      const topTrade = scoredTrades[0];
      
      // Recommend based on score
      if (topTrade.score > 90) {
        recommendations.push('🎯 Execute this trade immediately - excellent match!');
      } else if (topTrade.score > 80) {
        recommendations.push('✅ This is a good trade opportunity');
      }

      // Recommend based on participants
      if (topTrade.trade.totalParticipants === 2) {
        recommendations.push('💫 Direct 2-party trade - fast execution');
      } else if (topTrade.trade.totalParticipants > 5) {
        recommendations.push('🔄 Complex trade - may take longer to coordinate');
      }

      // Collection-based recommendations
      const receivingStep = topTrade.trade.steps.find(s => s.to === userWallet);
      if (receivingStep) {
        const collection = receivingStep.nfts[0]?.collection;
        if (collection) {
          recommendations.push(`📈 ${collection} is a solid collection choice`);
        }
      }

      // Alternative trades
      if (scoredTrades.length > 1) {
        recommendations.push(`🔍 ${scoredTrades.length - 1} alternative trades available`);
      }
    }

    return recommendations.slice(0, 4);
  }

  /**
   * Get personalized market insights
   */
  async getPersonalizedInsights(walletAddress: string): Promise<{
    insights: string[];
    opportunities: string[];
    warnings: string[];
  }> {
    const snapshot = await this.getDataSnapshot();
    const insights: string[] = [];
    const opportunities: string[] = [];
    const warnings: string[] = [];

    if (snapshot) {
      // Market insights
      if (snapshot.marketMetrics?.totalVolume24h > 1000) {
        insights.push('📊 High trading volume today - great liquidity');
      }

      // Trending opportunities
      if (snapshot.trendingData?.hotNFTs?.length > 0) {
        const topNFT = snapshot.trendingData.hotNFTs[0];
        opportunities.push(`🔥 ${topNFT.name} is trending with ${topNFT.wantCount} wants`);
      }

      // Network health warnings
      if (snapshot.networkHealth?.successRate < 80) {
        warnings.push('⚠️ Network success rate is lower than usual');
      }
    }

    // Add fallback insights if no backend data
    if (insights.length === 0) {
      insights.push('💡 SWAPS finds hidden trade paths others miss');
      insights.push('🔄 Multi-party trades unlock more opportunities');
    }

    return { insights, opportunities, warnings };
  }

  /**
   * Cache management methods for enhanced performance
   */

  /**
   * Invalidate user-specific cache when wallet data changes
   */
  public invalidateUserCache(walletAddress: string): void {
    const cacheService = AIResponseCacheService.getInstance();
    const invalidatedCount = cacheService.invalidateUserPortfolio(walletAddress);
    
    if (invalidatedCount > 0) {
      console.log(`🗑️ Invalidated ${invalidatedCount} cached AI responses for wallet ${walletAddress.slice(0, 8)}...`);
    }
  }

  /**
   * Invalidate market-dependent cache when trending data updates
   */
  public invalidateMarketCache(): void {
    const cacheService = AIResponseCacheService.getInstance();
    const invalidatedCount = cacheService.invalidateMarketData();
    
    if (invalidatedCount > 0) {
      console.log(`🗑️ Invalidated ${invalidatedCount} market-dependent AI responses`);
    }
  }

  /**
   * Get cache performance statistics
   */
  public getCacheStats(): any {
    const cacheService = AIResponseCacheService.getInstance();
    return cacheService.getStats();
  }

  /**
   * Warm cache with common queries for better performance
   */
  public async warmCache(): Promise<void> {
    const commonQueries = [
      "How does SWAPS work?",
      "What makes a good trade?",
      "Show me trending collections",
      "Find trade opportunities"
    ];

    console.log('🔥 Warming AI response cache with common queries...');
    
    // Process common queries in background to populate cache
    for (const query of commonQueries) {
      try {
        await this.processQueryWithFullContext(query, {});
      } catch (error) {
        console.warn(`Failed to warm cache for query: ${query}`);
      }
    }
    
    console.log('✅ Cache warming completed');
  }
} 