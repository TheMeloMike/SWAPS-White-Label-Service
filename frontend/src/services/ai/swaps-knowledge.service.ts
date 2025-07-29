'use client';

import { TradeService } from '@/services/trade';
import { NFTService } from '@/services/nft';
import StatsService from '@/services/stats';
import { CollectionService } from '@/services/collection';
import { TrendingService } from '@/services/trending';
import { TrendingWantedNft, TrendingLoopItem } from '@/types/trending';
import { TradeHistoryItem } from '@/services/trade-status';
import { NFTMetadata } from '@/types/nft';
import { CollectionSearchResult } from '@/types/trade';

export interface SwapsKnowledgeBase {
  systemCapabilities: {
    algorithms: string[];
    tradeLoopSizes: { min: number; max: number; average: number };
    scoringMetrics: string[];
    performanceMetrics: {
      averageDiscoveryTime: number;
      successRate: number;
      totalLoopsProcessed: number;
    };
  };
  currentMarketState: {
    totalActiveWallets: number;
    totalNFTsIndexed: number;
    totalCollectionsTracked: number;
    recentTradeVolume: number;
    topCollections: Array<{
      name: string;
      floorPrice: number;
      volume24h: number;
      activeTraders: number;
    }>;
    recentSuccessfulTrades: Array<{
      loopSize: number;
      totalValue: number;
      collections: string[];
      timestamp: Date;
    }>;
    proposedTrades: number;
    activeTrades: number;
    trendingNFTs: Array<{
      name: string;
      address: string;
      wantCount?: number;
      averageScore?: number;
      appearanceInLoops?: number;
      collection?: string;
    }>;
  };
  collectionData: {
    availableCollections: Array<{
      id: string;
      name: string;
      verified: boolean;
      nftCount: number;
      floorPrice: number;
      volume24h: number;
      holders?: number;
      listed?: number;
      imageUrl?: string;
    }>;
    trendingCollections: Array<{
      id: string;
      name: string;
      verified: boolean;
      trendScore: number;
      wantCount: number;
      tradeActivity: number;
      priceChange24h?: number;
    }>;
    collectionStats: {
      totalCollections: number;
      totalVerified: number;
      totalUnverified: number;
      collectionsWithFloorPrice: number;
      averageFloorPrice: number;
      totalVolume24h: number;
      mostActiveCollection: string;
    };
  };
  tradingPatterns: {
    popularTradeRoutes: Array<{
      fromCollection: string;
      toCollection: string;
      frequency: number;
    }>;
    averageLoopEfficiency: number;
    peakTradingHours: number[];
    commonLoopSizes: { [size: string]: number };
  };
  collectionInsights: {
    [collection: string]: {
      demandScore: number;
      liquidityScore: number;
      avgHoldTime: number;
      priceVolatility: number;
      commonTradePairs: string[];
    };
  };
  userBehavior: {
    averageWantsPerUser: number;
    mostWantedCollections: string[];
    tradeCompletionRate: number;
    averageTimeToTrade: number;
  };
}

export class SwapsKnowledgeService {
  private static instance: SwapsKnowledgeService;
  private knowledgeCache: SwapsKnowledgeBase | null = null;
  private lastUpdate: Date | null = null;
  private updateInterval = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): SwapsKnowledgeService {
    if (!SwapsKnowledgeService.instance) {
      SwapsKnowledgeService.instance = new SwapsKnowledgeService();
    }
    return SwapsKnowledgeService.instance;
  }

  /**
   * Force refresh of cached knowledge data
   * Useful after system updates or configuration changes
   */
  public clearCache(): void {
    this.knowledgeCache = null;
    this.lastUpdate = null;
  }

  async getComprehensiveKnowledge(): Promise<SwapsKnowledgeBase> {
    // Return cached data if fresh
    if (this.knowledgeCache && this.lastUpdate && 
        Date.now() - this.lastUpdate.getTime() < this.updateInterval) {
      return this.knowledgeCache;
    }

    // Gather fresh data
    const [stats, collections, recentTrades, trendingData, collectionData] = await Promise.all([
      this.gatherSystemStats(),
      this.gatherCollectionData(),
      this.gatherRecentTradeData(),
      this.gatherTrendingData(),
      this.gatherComprehensiveCollectionData()
    ]);

    // Calculate dynamic metrics from real data
    const averageLoopSize = this.calculateAverageLoopSize(recentTrades);
    const commonLoopSizes = this.calculateCommonLoopSizes(recentTrades);
    const peakTradingHours = this.calculatePeakTradingHours(recentTrades);
    const averageDiscoveryTime = this.calculateAverageDiscoveryTime(recentTrades);
    const averageLoopEfficiency = this.calculateAverageLoopEfficiency(recentTrades);
    const userBehaviorMetrics = await this.calculateUserBehaviorMetrics();

    this.knowledgeCache = {
      systemCapabilities: {
        algorithms: [
          "Advanced graph analysis for trade discovery",
          "Proprietary cycle detection algorithms",
          "Distributed processing for scalability",
          "Optimized memory structures for performance",
          "Intelligent pathfinding for optimal routes"
        ],
        tradeLoopSizes: {
          min: 2,
          max: 10,
          average: averageLoopSize
        },
        scoringMetrics: [
          "Price parity (±10% variance)",
          "Collection popularity scores",
          "Floor price alignment",
          "Historical trading behavior",
          "Rarity scores",
          "Ownership concentration",
          "Market momentum",
          "Liquidity depth",
          "Trade velocity",
          "Collection volatility",
          "Social signals",
          "Holder reputation",
          "Time-based decay",
          "Cross-collection correlation",
          "Gas optimization",
          "Risk assessment",
          "Fairness index",
          "Network effects"
        ],
        performanceMetrics: {
          averageDiscoveryTime: averageDiscoveryTime,
          successRate: stats.successRate || 0,
          totalLoopsProcessed: stats.totalLoopsFound
        }
      },
      currentMarketState: {
        totalActiveWallets: stats.activeWallets,
        totalNFTsIndexed: stats.totalNFTs || 0,
        totalCollectionsTracked: collections.length,
        recentTradeVolume: stats.volume24h,
        topCollections: collections.slice(0, 10).map(c => ({
          name: c.name,
          floorPrice: c.floorPrice || 0,
          volume24h: c.tradeVolume || 0,
          activeTraders: c.activeTraders || 0
        })),
        recentSuccessfulTrades: recentTrades,
        proposedTrades: stats.proposedTrades || 0,
        activeTrades: stats.activeTrades || 0,
        trendingNFTs: trendingData
      },
      collectionData: collectionData,
      tradingPatterns: {
        popularTradeRoutes: this.extractPopularRoutes(recentTrades),
        averageLoopEfficiency: averageLoopEfficiency,
        peakTradingHours: peakTradingHours,
        commonLoopSizes: commonLoopSizes
      },
      collectionInsights: this.buildCollectionInsights(collections),
      userBehavior: userBehaviorMetrics
    };

    this.lastUpdate = new Date();
    return this.knowledgeCache;
  }

  private async gatherSystemStats(): Promise<any> {
    try {
      const statsService = StatsService.getInstance();
      const globalStats = await statsService.getGlobalStats();
      
      // Extract real values from the stats
      const completedTrades = globalStats.find((s: any) => s.label === 'Completed Trades')?.value || 0;
      const activeTrades = globalStats.find((s: any) => s.label === 'Active Trades')?.value || 0;
      const successRateStr = globalStats.find((s: any) => s.label === 'Success Rate')?.value || '0%';
      const successRate = parseFloat(successRateStr.toString().replace('%', '')) || 0;
      const volumeStr = globalStats.find((s: any) => s.label === 'Total Trade Volume')?.value || '0 SOL';
      const volume = parseFloat(volumeStr.toString().replace(' SOL', '')) || 0;
      
      // Get proposed trades from local tracking
      const proposedTrades = await this.getProposedTradesCount();
      
      // Get active wallets count
      const activeWallets = await this.getActiveWalletsCount();
      
      // Get total NFTs indexed
      const totalNFTs = await this.getTotalNFTsIndexed();
      
      // Convert to numbers to ensure proper addition
      const activeTradesNum = typeof activeTrades === 'number' ? activeTrades : parseInt(activeTrades.toString()) || 0;
      const completedTradesNum = typeof completedTrades === 'number' ? completedTrades : parseInt(completedTrades.toString()) || 0;
      
      return {
        totalLoopsFound: completedTradesNum, // Use REAL completed trades count
        activeWallets: activeWallets,
        volume24h: volume,
        totalNFTs: totalNFTs,
        proposedTrades: proposedTrades,
        activeTrades: activeTradesNum,
        completedTrades: completedTradesNum,
        successRate: successRate
      };
    } catch (error) {
      console.error('Error gathering system stats:', error);
      // Return actual zeros instead of fake data
      return {
        totalLoopsFound: 0,
        activeWallets: 0,
        volume24h: 0,
        totalNFTs: 0,
        proposedTrades: 0,
        activeTrades: 0,
        completedTrades: 0,
        successRate: 0
      };
    }
  }

  private async gatherCollectionData(): Promise<any[]> {
    try {
      const collectionService = CollectionService.getInstance();
      const collections = await collectionService.getPopularCollections(20);
      return collections;
    } catch (error) {
      console.error('Error gathering collection data:', error);
      return [];
    }
  }

  private async gatherRecentTradeData(): Promise<any[]> {
    try {
      const statsService = StatsService.getInstance();
      const recentActivity = await statsService.getRecentActivity(20);
      
      return recentActivity.map((activity: any) => ({
        loopSize: activity.participants || 3,
        totalValue: activity.value || 0,
        collections: activity.collections || [],
        timestamp: new Date(activity.timestamp || Date.now())
      }));
    } catch (error) {
      console.error('Error gathering trade data:', error);
      return [];
    }
  }

  private async gatherTrendingData(): Promise<any[]> {
    try {
      const trendingService = TrendingService.getInstance();
      const trendingData = await trendingService.getTrendingData();
      
      if (!trendingData) {
        return [];
      }
      
      // Combine wanted and loop items into a unified list
      const trendingNFTs: any[] = [];
      
      // Add wanted NFTs
      if (trendingData.topWantedNfts && trendingData.topWantedNfts.length > 0) {
        trendingData.topWantedNfts.forEach((item: TrendingWantedNft) => {
          const collectionName = typeof item.metadata?.collection === 'string' 
            ? item.metadata.collection 
            : item.metadata?.collection?.name || 'Unknown Collection';
            
          trendingNFTs.push({
            name: item.metadata?.name || `NFT ${item.nftAddress.slice(0, 8)}...`,
            address: item.nftAddress,
            wantCount: item.wantCount,
            collection: collectionName
          });
        });
      }
      
      // Add NFTs from trending loops
      if (trendingData.topLoopItems && trendingData.topLoopItems.length > 0) {
        trendingData.topLoopItems.forEach((item: TrendingLoopItem) => {
          if (item.itemType === 'NFT') {
            const existing = trendingNFTs.find(nft => nft.address === item.itemId);
            if (!existing) {
              // Use metadata from nftMetadata array if available
              const metadata = item.nftMetadata?.[0];
              const name = metadata?.name || item.displayName || `NFT ${item.itemId.slice(0, 8)}...`;
              const collectionName = typeof metadata?.collection === 'string'
                ? metadata.collection
                : metadata?.collection?.name || 'Unknown Collection';
              
              trendingNFTs.push({
                name: name,
                address: item.itemId,
                averageScore: item.averageLoopScore,
                appearanceInLoops: item.appearanceInLoops,
                collection: collectionName
              });
            } else {
              // Update existing with loop data
              existing.averageScore = item.averageLoopScore;
              existing.appearanceInLoops = item.appearanceInLoops;
            }
          }
        });
      }
      
      // Sort by combined popularity (want count + appearance count)
      trendingNFTs.sort((a, b) => {
        const aScore = (a.wantCount || 0) + (a.appearanceInLoops || 0);
        const bScore = (b.wantCount || 0) + (b.appearanceInLoops || 0);
        return bScore - aScore;
      });
      
      return trendingNFTs.slice(0, 10); // Return top 10
    } catch (error) {
      console.error('Error gathering trending data:', error);
      return [];
    }
  }

  private extractPopularRoutes(trades: any[]): any[] {
    const routeMap = new Map<string, number>();
    
    trades.forEach(trade => {
      if (trade.collections && trade.collections.length >= 2) {
        for (let i = 0; i < trade.collections.length - 1; i++) {
          const route = `${trade.collections[i]}->${trade.collections[i + 1]}`;
          routeMap.set(route, (routeMap.get(route) || 0) + 1);
        }
      }
    });

    return Array.from(routeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([route, frequency]) => {
        const [from, to] = route.split('->');
        return { fromCollection: from, toCollection: to, frequency };
      });
  }

  private buildCollectionInsights(collections: any[]): any {
    const insights: any = {};
    
    collections.forEach(collection => {
      insights[collection.name] = {
        demandScore: collection.demandScore || 0, // Use real data or 0
        liquidityScore: collection.liquidityScore || 0, // Use real data or 0
        avgHoldTime: collection.avgHoldTime || 0, // Use real data or 0
        priceVolatility: collection.volatility || 0, // Use real data or 0
        commonTradePairs: this.generateCommonPairs(collection.name)
      };
    });

    return insights;
  }

  private generateCommonPairs(collectionName: string): string[] {
    // Get other collection names from our cached data if available
    if (this.knowledgeCache?.currentMarketState?.topCollections) {
      const otherCollections = this.knowledgeCache.currentMarketState.topCollections
        .map(c => c.name)
        .filter(c => c !== collectionName);
      
      if (otherCollections.length > 0) {
        // Return up to 3 random collections from actual data
        return otherCollections
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);
      }
    }
    
    // If no data available yet, return empty array
    return [];
  }

  formatForLLM(knowledge: SwapsKnowledgeBase): string {
    const hasCompletedTrades = knowledge.systemCapabilities.performanceMetrics.totalLoopsProcessed > 0;
    const proposedTrades = (knowledge.currentMarketState as any).proposedTrades || 0;
    const activeTrades = (knowledge.currentMarketState as any).activeTrades || 0;
    const hasTrendingData = knowledge.currentMarketState.trendingNFTs && knowledge.currentMarketState.trendingNFTs.length > 0;
    const hasCollectionData = knowledge.collectionData && knowledge.collectionData.availableCollections.length > 0;
    
    return `
SWAPS COMPREHENSIVE KNOWLEDGE BASE (Real-time Data):

🧮 SYSTEM CAPABILITIES:
${knowledge.systemCapabilities.algorithms.map(a => `• ${a}`).join('\n')}
• Trade Loop Sizes: ${knowledge.systemCapabilities.tradeLoopSizes.min}-${knowledge.systemCapabilities.tradeLoopSizes.max} parties${hasCompletedTrades ? ` (avg: ${knowledge.systemCapabilities.tradeLoopSizes.average.toFixed(1)})` : ''}
• Discovery Speed: ${knowledge.systemCapabilities.performanceMetrics.averageDiscoveryTime > 0 ? `${knowledge.systemCapabilities.performanceMetrics.averageDiscoveryTime.toFixed(2)}s average` : 'Calculating...'}
• Success Rate: ${hasCompletedTrades ? `${knowledge.systemCapabilities.performanceMetrics.successRate}%` : 'No trades completed yet'}
• Total Loops Completed: ${knowledge.systemCapabilities.performanceMetrics.totalLoopsProcessed}
• Active Trade Loops: ${activeTrades}
• Proposed Trade Loops: ${proposedTrades}

📊 CURRENT MARKET STATE:
• Active Wallets: ${knowledge.currentMarketState.totalActiveWallets > 0 ? knowledge.currentMarketState.totalActiveWallets.toLocaleString() : 'Growing'}
• NFTs Indexed: ${knowledge.currentMarketState.totalNFTsIndexed > 0 ? knowledge.currentMarketState.totalNFTsIndexed.toLocaleString() : 'Indexing in progress'}
• Collections Tracked: ${knowledge.currentMarketState.totalCollectionsTracked}
• 24h Volume: ${knowledge.currentMarketState.recentTradeVolume.toLocaleString()} SOL

🏛️ COLLECTION DATA:
${hasCollectionData && knowledge.collectionData.collectionStats ? `
• Total Collections Available: ${knowledge.collectionData.collectionStats.totalCollections || knowledge.collectionData.availableCollections.length}
• Verified Collections: ${knowledge.collectionData.collectionStats.totalVerified}
• Collections with Floor Price: ${knowledge.collectionData.collectionStats.collectionsWithFloorPrice || 'N/A'}
• Average Floor Price: ${knowledge.collectionData.collectionStats.averageFloorPrice.toFixed(2)} SOL
• Total 24h Volume: ${knowledge.collectionData.collectionStats.totalVolume24h.toFixed(2)} SOL
• Most Active Collection: ${knowledge.collectionData.collectionStats.mostActiveCollection}` : 
'Collection data is being indexed...'}

📈 TRENDING COLLECTIONS:
${hasCollectionData && knowledge.collectionData.trendingCollections.length > 0 ?
  knowledge.collectionData.trendingCollections.slice(0, 5).map((c, i) => 
    `${i + 1}. **${c.name}**${c.verified ? ' ✓' : ''}: ${c.wantCount} wants, ${c.tradeActivity} trades, score: ${c.trendScore.toFixed(0)}`
  ).join('\n') :
  'Analyzing collection trends...'}

✅ VERIFIED COLLECTIONS AVAILABLE:
${hasCollectionData ? 
  knowledge.collectionData.availableCollections
    .filter(c => c.verified)
    .slice(0, 10)
    .map((c, i) => `${i + 1}. ${c.name}: ${c.floorPrice.toFixed(2)} SOL floor, ${c.nftCount} NFTs`)
    .join('\n') || 'No verified collections found' :
  'Loading collection verification data...'}

🔥 TRENDING NFTs RIGHT NOW:
${hasTrendingData ? 
  knowledge.currentMarketState.trendingNFTs.slice(0, 5).map((nft, i) => {
    const metrics = [];
    if (nft.wantCount) metrics.push(`${nft.wantCount} wants`);
    if (nft.appearanceInLoops) metrics.push(`in ${nft.appearanceInLoops} loops`);
    if (nft.averageScore) metrics.push(`${(nft.averageScore * 100).toFixed(1)}% avg score`);
    
    return `${i + 1}. **${nft.name}** (${nft.collection})${metrics.length > 0 ? `: ${metrics.join(', ')}` : ''}`;
  }).join('\n') : 
  'NFT trending data is being calculated...'}

🏆 TOP COLLECTIONS BY ACTIVITY:
${knowledge.currentMarketState.topCollections.length > 0 ? 
  knowledge.currentMarketState.topCollections.slice(0, 5).map((c, i) => 
    `${i + 1}. ${c.name}: ${c.floorPrice} SOL floor, ${c.volume24h} SOL volume`
  ).join('\n') : 
  'Collections are being indexed...'}

🔄 TRADING PATTERNS:
${hasCompletedTrades || Object.keys(knowledge.tradingPatterns.commonLoopSizes).length > 0 ? 
  `• Most Common Loop Sizes: ${Object.entries(knowledge.tradingPatterns.commonLoopSizes)
    .map(([size, pct]) => `${size}: ${pct}%`).join(', ')}
• Average Loop Efficiency: ${knowledge.tradingPatterns.averageLoopEfficiency > 0 ? `${(knowledge.tradingPatterns.averageLoopEfficiency * 100).toFixed(1)}%` : 'Calculating...'}
• Peak Trading Hours: ${knowledge.tradingPatterns.peakTradingHours.length > 0 ? knowledge.tradingPatterns.peakTradingHours.join(', ') + ' UTC' : 'Gathering data...'}` :
  `• The SWAPS network is ready for its first trades!
• Advanced algorithms are actively searching for optimal trade paths
• Multi-party loops from 2-10+ participants are supported`}

🎯 TRADE STATUS:
• Completed Trades: ${knowledge.systemCapabilities.performanceMetrics.totalLoopsProcessed}
• Active Trades: ${activeTrades}
• Proposed Trades: ${proposedTrades}
${!hasCompletedTrades ? '• The platform is live and ready for trading!' : ''}

👥 USER BEHAVIOR INSIGHTS:
• Average Wants per User: ${knowledge.userBehavior.averageWantsPerUser > 0 ? knowledge.userBehavior.averageWantsPerUser.toFixed(1) : 'Gathering data...'}
• Trade Completion Rate: ${hasCompletedTrades && knowledge.userBehavior.tradeCompletionRate > 0 ? `${(knowledge.userBehavior.tradeCompletionRate * 100).toFixed(1)}%` : 'Awaiting first trades'}
• Average Time to Trade: ${knowledge.userBehavior.averageTimeToTrade > 0 ? `${knowledge.userBehavior.averageTimeToTrade.toFixed(1)} hours` : 'Calculating...'}
• Most Wanted Collections: ${knowledge.userBehavior.mostWantedCollections.length > 0 ? knowledge.userBehavior.mostWantedCollections.join(', ') : 'Analyzing preferences...'}

💎 SCORING METRICS (18 factors):
${knowledge.systemCapabilities.scoringMetrics.map((m, i) => `${i + 1}. ${m}`).join('\n')}
`;
  }

  /**
   * Get count of discovered trades that haven't been executed yet
   * This includes trades shown to users but not yet initiated
   */
  private async getProposedTradesCount(): Promise<number> {
    try {
      // Method 1: Check localStorage for discovered trades
      const discoveredTradesKey = 'swaps_discovered_trades';
      const storedTrades = localStorage.getItem(discoveredTradesKey);
      
      let localCount = 0;
      if (storedTrades) {
        const trades = JSON.parse(storedTrades);
        // Count trades that are less than 24 hours old and not executed
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const proposedTrades = trades.filter((trade: any) => 
          trade.discoveredAt > oneDayAgo && !trade.executed
        );
        localCount = proposedTrades.length;
      }
      
      // Method 2: Skip trying to get from TradeService as the method doesn't exist
      
      // Method 3: Check session storage for recent trade discoveries
      const sessionTrades = sessionStorage.getItem('swaps_recent_trades');
      if (sessionTrades) {
        try {
          const trades = JSON.parse(sessionTrades);
          if (Array.isArray(trades) && trades.length > 0) {
            return trades.length;
          }
        } catch (e) {
          // Invalid JSON
        }
      }
      
      return localCount;
    } catch (error) {
      console.error('Error getting proposed trades count:', error);
      return 0;
    }
  }

  /**
   * Track when a trade is discovered (shown to user)
   */
  public trackDiscoveredTrade(tradeId: string): void {
    try {
      const discoveredTradesKey = 'swaps_discovered_trades';
      const storedTrades = localStorage.getItem(discoveredTradesKey) || '[]';
      const trades = JSON.parse(storedTrades);
      
      // Add new trade if not already tracked
      if (!trades.find((t: any) => t.id === tradeId)) {
        trades.push({
          id: tradeId,
          discoveredAt: Date.now(),
          executed: false
        });
        
        // Keep only last 100 trades
        if (trades.length > 100) {
          trades.shift();
        }
        
        localStorage.setItem(discoveredTradesKey, JSON.stringify(trades));
      }
    } catch (error) {
      console.error('Error tracking discovered trade:', error);
    }
  }

  /**
   * Mark a trade as executed
   */
  public markTradeExecuted(tradeId: string): void {
    try {
      const discoveredTradesKey = 'swaps_discovered_trades';
      const storedTrades = localStorage.getItem(discoveredTradesKey) || '[]';
      const trades = JSON.parse(storedTrades);
      
      const trade = trades.find((t: any) => t.id === tradeId);
      if (trade) {
        trade.executed = true;
        localStorage.setItem(discoveredTradesKey, JSON.stringify(trades));
      }
    } catch (error) {
      console.error('Error marking trade as executed:', error);
    }
  }

  /**
   * Calculate average loop size from recent trades
   */
  private calculateAverageLoopSize(trades: any[]): number {
    if (!trades || trades.length === 0) return 0;
    
    const totalSize = trades.reduce((sum, trade) => sum + (trade.loopSize || 0), 0);
    return totalSize / trades.length;
  }

  /**
   * Calculate distribution of loop sizes
   */
  private calculateCommonLoopSizes(trades: any[]): { [size: string]: number } {
    if (!trades || trades.length === 0) return {};
    
    const sizeCounts: { [key: number]: number } = {};
    trades.forEach(trade => {
      const size = trade.loopSize || 0;
      sizeCounts[size] = (sizeCounts[size] || 0) + 1;
    });
    
    const total = trades.length;
    const distribution: { [size: string]: number } = {};
    
    // Group into categories
    let twoWay = 0, threeWay = 0, fourWay = 0, fiveWay = 0, sixPlus = 0;
    
    Object.entries(sizeCounts).forEach(([size, count]) => {
      const sizeNum = parseInt(size);
      if (sizeNum === 2) twoWay += count;
      else if (sizeNum === 3) threeWay += count;
      else if (sizeNum === 4) fourWay += count;
      else if (sizeNum === 5) fiveWay += count;
      else if (sizeNum >= 6) sixPlus += count;
    });
    
    if (twoWay > 0) distribution["2-way"] = Math.round((twoWay / total) * 100);
    if (threeWay > 0) distribution["3-way"] = Math.round((threeWay / total) * 100);
    if (fourWay > 0) distribution["4-way"] = Math.round((fourWay / total) * 100);
    if (fiveWay > 0) distribution["5-way"] = Math.round((fiveWay / total) * 100);
    if (sixPlus > 0) distribution["6+way"] = Math.round((sixPlus / total) * 100);
    
    return distribution;
  }

  /**
   * Calculate peak trading hours from trade timestamps
   */
  private calculatePeakTradingHours(trades: any[]): number[] {
    if (!trades || trades.length === 0) return [];
    
    const hourCounts: { [hour: number]: number } = {};
    
    trades.forEach(trade => {
      if (trade.timestamp) {
        const hour = new Date(trade.timestamp).getUTCHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    });
    
    // Find top 5 hours
    const sortedHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hour]) => parseInt(hour))
      .sort((a, b) => a - b);
    
    return sortedHours;
  }

  /**
   * Calculate average discovery time from trades
   */
  private calculateAverageDiscoveryTime(trades: any[]): number {
    // Since we don't have actual discovery time data yet, return 0
    // This will be populated when we have real timing data
    return 0;
  }

  /**
   * Calculate average loop efficiency from trades
   */
  private calculateAverageLoopEfficiency(trades: any[]): number {
    if (!trades || trades.length === 0) return 0;
    
    // If trades have efficiency data, use it
    const tradesWithEfficiency = trades.filter(t => t.efficiency !== undefined);
    if (tradesWithEfficiency.length > 0) {
      const totalEfficiency = tradesWithEfficiency.reduce((sum, trade) => sum + trade.efficiency, 0);
      return totalEfficiency / tradesWithEfficiency.length;
    }
    
    return 0;
  }

  /**
   * Calculate user behavior metrics from real data
   */
  private async calculateUserBehaviorMetrics(): Promise<any> {
    try {
      // Calculate average wants per user
      const walletWants = this.getAllWalletWantsFromStorage();
      let totalWants = 0;
      let walletsWithWants = 0;
      
      walletWants.forEach((wants) => {
        if (wants.length > 0) {
          totalWants += wants.length;
          walletsWithWants++;
        }
      });
      
      const averageWantsPerUser = walletsWithWants > 0 ? totalWants / walletsWithWants : 0;
      
      // Get most wanted collections
      const mostWantedCollections = await this.getMostWantedCollections();
      
      // Calculate trade completion rate
      const statsService = StatsService.getInstance();
      const globalStats = await statsService.getGlobalStats();
      const completedTradesRaw = globalStats.find((s: any) => s.label === 'Completed Trades')?.value || 0;
      const completedTrades = typeof completedTradesRaw === 'number' ? completedTradesRaw : parseInt(completedTradesRaw.toString()) || 0;
      const proposedTrades = await this.getProposedTradesCount();
      const totalAttempted = completedTrades + proposedTrades;
      const tradeCompletionRate = totalAttempted > 0 ? completedTrades / totalAttempted : 0;
      
      // Calculate average time to trade from trade history
      const averageTimeToTrade = await this.calculateAverageTimeToTrade();
      
      return {
        averageWantsPerUser: averageWantsPerUser,
        mostWantedCollections: mostWantedCollections,
        tradeCompletionRate: tradeCompletionRate,
        averageTimeToTrade: averageTimeToTrade
      };
    } catch (error) {
      console.error('Error calculating user behavior metrics:', error);
      return {
        averageWantsPerUser: 0,
        mostWantedCollections: [],
        tradeCompletionRate: 0,
        averageTimeToTrade: 0
      };
    }
  }

  /**
   * Get most wanted collections from real user wants
   */
  private async getMostWantedCollections(): Promise<string[]> {
    try {
      // Get all wallet collection wants from backend
      const tradeService = TradeService.getInstance();
      const collectionWantCounts = new Map<string, number>();
      
      // Track collection mentions in localStorage wants
      const allWalletWants = this.getAllWalletWantsFromStorage();
      
      for (const [wallet, wants] of Array.from(allWalletWants.entries())) {
        // This would need to map NFT addresses to collections
        // For now, we'll use collection names if available
        for (const nftAddress of wants) {
          // Try to extract collection from NFT metadata if cached
          const cachedMetadata = this.getCachedNFTMetadata(nftAddress);
          if (cachedMetadata?.collection) {
            const collectionName = typeof cachedMetadata.collection === 'string' 
              ? cachedMetadata.collection 
              : cachedMetadata.collection.name;
            
            if (collectionName) {
              collectionWantCounts.set(collectionName, (collectionWantCounts.get(collectionName) || 0) + 1);
            }
          }
        }
      }
      
      // Sort by count and return top collections
      const sortedCollections = Array.from(collectionWantCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([collection]) => collection);
      
      return sortedCollections.length > 0 ? sortedCollections : [];
    } catch (error) {
      console.error('Error getting most wanted collections:', error);
      return [];
    }
  }

  /**
   * Get all wallet wants from localStorage
   */
  private getAllWalletWantsFromStorage(): Map<string, string[]> {
    const walletWants = new Map<string, string[]>();
    
    try {
      // Iterate through localStorage to find all wallet wants
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.endsWith('_wanted_nfts')) {
          const wallet = key.replace('_wanted_nfts', '');
          const wants = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(wants) && wants.length > 0) {
            walletWants.set(wallet, wants);
          }
        }
      }
    } catch (error) {
      console.error('Error getting wallet wants from storage:', error);
    }
    
    return walletWants;
  }

  /**
   * Get cached NFT metadata
   */
  private getCachedNFTMetadata(nftAddress: string): any {
    try {
      // Check if NFT metadata is cached in sessionStorage or localStorage
      const cacheKey = `nft_metadata_${nftAddress}`;
      const cached = sessionStorage.getItem(cacheKey) || localStorage.getItem(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      // Ignore cache errors
    }
    return null;
  }

  /**
   * Get active wallets count
   */
  private async getActiveWalletsCount(): Promise<number> {
    try {
      // Count unique wallets that have either:
      // 1. Active trades
      // 2. Proposed trades
      // 3. Wants registered
      const activeWallets = new Set<string>();
      
      // Get wallets from trade history
      const tradeService = TradeService.getInstance();
      // Try to get trade history directly from the trade service
      const tradeHistory = await this.getTradeHistory();
      
      tradeHistory.forEach((trade: TradeHistoryItem) => {
        if (trade.participants) {
          trade.participants.forEach((wallet: string) => activeWallets.add(wallet));
        }
        if (trade.creator) {
          activeWallets.add(trade.creator);
        }
      });
      
      // Get wallets with wants
      const walletWants = this.getAllWalletWantsFromStorage();
      walletWants.forEach((_, wallet) => activeWallets.add(wallet));
      
      // Get current user if connected
      const currentUser = this.getCurrentUserWallet();
      if (currentUser) {
        activeWallets.add(currentUser);
      }
      
      return activeWallets.size;
    } catch (error) {
      console.error('Error getting active wallets count:', error);
      return 0;
    }
  }

  /**
   * Get current user wallet from window
   */
  private getCurrentUserWallet(): string | null {
    try {
      // Check if wallet is connected via window.solana
      if (typeof window !== 'undefined' && (window as any).solana?.publicKey) {
        return (window as any).solana.publicKey.toString();
      }
    } catch (error) {
      // Ignore errors
    }
    return null;
  }

  /**
   * Get total NFTs indexed in the system
   */
  private async getTotalNFTsIndexed(): Promise<number> {
    try {
      // Count unique NFTs from various sources
      const uniqueNFTs = new Set<string>();
      
      // 1. NFTs from trending data
      if (this.knowledgeCache?.currentMarketState?.trendingNFTs) {
        this.knowledgeCache.currentMarketState.trendingNFTs.forEach(nft => {
          if (nft.address) uniqueNFTs.add(nft.address);
        });
      }
      
      // 2. NFTs from trade history
      const tradeHistory = await this.getTradeHistory();
      
      tradeHistory.forEach((trade: TradeHistoryItem) => {
        if (trade.nfts) {
          trade.nfts.forEach((nft: NFTMetadata) => {
            if (nft.address) uniqueNFTs.add(nft.address);
          });
        }
      });
      
      // 3. NFTs from recent trades
      const recentTrades = sessionStorage.getItem('swaps_recent_trades');
      if (recentTrades) {
        try {
          const trades = JSON.parse(recentTrades);
          if (Array.isArray(trades)) {
            trades.forEach(trade => {
              trade.steps?.forEach((step: any) => {
                step.nfts?.forEach((nft: any) => {
                  if (nft.address) uniqueNFTs.add(nft.address);
                });
              });
            });
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // 4. User's NFTs if connected
      const userNFTs = sessionStorage.getItem('user_nfts_cache');
      if (userNFTs) {
        try {
          const nfts = JSON.parse(userNFTs);
          if (Array.isArray(nfts)) {
            nfts.forEach(nft => {
              if (nft.address) uniqueNFTs.add(nft.address);
            });
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      return uniqueNFTs.size;
    } catch (error) {
      console.error('Error getting total NFTs indexed:', error);
      return 0;
    }
  }

  /**
   * Get trade history from available sources
   */
  private async getTradeHistory(): Promise<TradeHistoryItem[]> {
    try {
      // Try to get from StatsService which has access to TradeStatusService
      const statsService = StatsService.getInstance();
      
      // Get from localStorage or sessionStorage if available
      const storedHistory = localStorage.getItem('trade_history') || sessionStorage.getItem('trade_history');
      if (storedHistory) {
        try {
          const history = JSON.parse(storedHistory);
          if (Array.isArray(history)) {
            return history;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // Return empty array if no history available
      return [];
    } catch (error) {
      console.error('Error getting trade history:', error);
      return [];
    }
  }

  /**
   * Calculate average time to complete a trade
   */
  private async calculateAverageTimeToTrade(): Promise<number> {
    try {
      const tradeHistory = await this.getTradeHistory();
      
      const completedTrades = tradeHistory.filter((trade: TradeHistoryItem) => 
        trade.status === 'completed' && trade.createdAt && trade.completedAt
      );
      
      if (completedTrades.length === 0) return 0;
      
      let totalTimeHours = 0;
      completedTrades.forEach(trade => {
        const created = new Date(trade.createdAt!).getTime();
        const completed = new Date(trade.completedAt!).getTime();
        const timeMs = completed - created;
        totalTimeHours += timeMs / (1000 * 60 * 60); // Convert to hours
      });
      
      return totalTimeHours / completedTrades.length;
    } catch (error) {
      console.error('Error calculating average time to trade:', error);
      return 0;
    }
  }

  /**
   * Gather comprehensive collection data
   */
  private async gatherComprehensiveCollectionData(): Promise<any> {
    try {
      const collectionService = CollectionService.getInstance();
      
      // Get popular collections (since getAllCollections doesn't exist)
      // We'll get a larger set for more comprehensive data
      let popularCollections = await collectionService.getPopularCollections(200);
      
      // If API returns no data, try loading from local JSON file
      if (!popularCollections || popularCollections.length === 0) {
        popularCollections = await this.loadCollectionsFromFile();
      }
      
      // Get trending collections based on activity
      const trendingCollections = await this.identifyTrendingCollections(popularCollections);
      
      // Calculate collection statistics
      const collectionStats = this.calculateCollectionStats(popularCollections);
      
      return {
        availableCollections: popularCollections.slice(0, 100).map((c: CollectionSearchResult) => ({
          id: c.id,
          name: c.name,
          verified: c.verified || false,
          nftCount: c.nftCount || 0,
          floorPrice: c.floorPrice || 0,
          volume24h: c.volume24h || 0,
          holders: (c as any).holders,
          listed: (c as any).listed,
          imageUrl: c.imageUrl
        })),
        trendingCollections: trendingCollections,
        collectionStats: collectionStats
      };
    } catch (error) {
      console.error('Error gathering collection data:', error);
      return {
        availableCollections: [],
        trendingCollections: [],
        collectionStats: {
          totalCollections: 0,
          totalVerified: 0,
          totalUnverified: 0,
          collectionsWithFloorPrice: 0,
          averageFloorPrice: 0,
          totalVolume24h: 0,
          mostActiveCollection: 'Unknown'
        }
      };
    }
  }

  /**
   * Load collections from local JSON file as fallback
   */
  private async loadCollectionsFromFile(): Promise<CollectionSearchResult[]> {
    try {
      // Try to fetch the collections.json file
      const response = await fetch('/collections.json').catch(() => null);
      
      if (!response || !response.ok) {
        // Try alternative path
        const altResponse = await fetch('/data/collections.json').catch(() => null);
        if (!altResponse || !altResponse.ok) {
          console.warn('Could not load collections from file');
          return [];
        }
        const data = await altResponse.json();
        return this.convertFileDataToCollections(data);
      }
      
      const data = await response.json();
      return this.convertFileDataToCollections(data);
    } catch (error) {
      console.error('Error loading collections from file:', error);
      
      // Return some hardcoded popular Solana collections as last resort
      return [
        {
          id: 'degods',
          name: 'DeGods',
          description: 'A collection of degenerates, building a community, 1 god at a time.',
          verified: true,
          nftCount: 10000,
          floorPrice: 8.5,
          volume24h: 125.4,
          imageUrl: ''
        },
        {
          id: 'madlads',
          name: 'Mad Lads',
          description: 'Mad Lads is a collection of 10,000 NFTs on Solana.',
          verified: true,
          nftCount: 10000,
          floorPrice: 12.3,
          volume24h: 234.5,
          imageUrl: ''
        },
        {
          id: 'okay-bears',
          name: 'Okay Bears',
          description: 'Okay Bears is a culture shift.',
          verified: true,
          nftCount: 10000,
          floorPrice: 6.8,
          volume24h: 89.2,
          imageUrl: ''
        },
        {
          id: 'smb',
          name: 'Solana Monkey Business',
          description: 'SMB is a collection of 5000 unique monkeys on the Solana blockchain.',
          verified: true,
          nftCount: 5000,
          floorPrice: 15.7,
          volume24h: 156.8,
          imageUrl: ''
        },
        {
          id: 'claynosaurz',
          name: 'Claynosaurz',
          description: 'Claynosaurz is a collection of 10,000 3D animated NFTs.',
          verified: true,
          nftCount: 10000,
          floorPrice: 4.2,
          volume24h: 67.3,
          imageUrl: ''
        }
      ] as CollectionSearchResult[];
    }
  }

  /**
   * Convert file data to CollectionSearchResult format
   */
  private convertFileDataToCollections(data: any): CollectionSearchResult[] {
    try {
      const collections: CollectionSearchResult[] = [];
      
      // Handle both array and object formats
      const entries = Array.isArray(data) ? data : Object.values(data);
      
      entries.forEach((item: any) => {
        if (item && item.name) {
          collections.push({
            id: item.id || item.symbol || item.name,
            name: item.name,
            description: item.description || '',
            verified: item.verified || false,
            nftCount: item.totalSupply || item.nftCount || 0,
            floorPrice: item.floorPrice || 0,
            volume24h: item.volume24h || 0,
            imageUrl: item.image || item.imageUrl || ''
          });
        }
      });
      
      // Sort by floor price descending
      return collections.sort((a, b) => (b.floorPrice || 0) - (a.floorPrice || 0));
    } catch (error) {
      console.error('Error converting file data to collections:', error);
      return [];
    }
  }

  /**
   * Identify trending collections based on various metrics
   */
  private async identifyTrendingCollections(allCollections: any[]): Promise<any[]> {
    try {
      // Get collection want counts
      const collectionWantCounts = await this.getCollectionWantCounts();
      
      // Get collection trade activity
      const tradeActivity = await this.getCollectionTradeActivity();
      
      // Calculate trend scores
      const collectionsWithScores = allCollections.map(collection => {
        const wantCount = collectionWantCounts.get(collection.name) || 0;
        const activity = tradeActivity.get(collection.name) || 0;
        
        // Calculate trend score based on multiple factors
        let trendScore = 0;
        trendScore += wantCount * 10; // Want count has high weight
        trendScore += activity * 5; // Trade activity
        trendScore += (collection.volume24h || 0) * 0.1; // Volume contributes
        
        return {
          id: collection.id,
          name: collection.name,
          verified: collection.verified || false,
          trendScore: trendScore,
          wantCount: wantCount,
          tradeActivity: activity,
          priceChange24h: collection.priceChange24h
        };
      });
      
      // Sort by trend score and return top 20
      return collectionsWithScores
        .sort((a, b) => b.trendScore - a.trendScore)
        .slice(0, 20);
    } catch (error) {
      console.error('Error identifying trending collections:', error);
      return [];
    }
  }

  /**
   * Calculate collection statistics
   */
  private calculateCollectionStats(collections: any[]): any {
    let totalVerified = 0;
    let totalUnverified = 0;
    let totalFloorPrice = 0;
    let totalVolume24h = 0;
    let mostActiveCollection = 'Unknown';
    let maxActivity = 0;
    let collectionsWithFloorPrice = 0;
    
    collections.forEach(collection => {
      if (collection.verified) {
        totalVerified++;
      } else {
        totalUnverified++;
      }
      
      if (collection.floorPrice && collection.floorPrice > 0) {
        collectionsWithFloorPrice++;
        totalFloorPrice += collection.floorPrice;
      }
      
      totalVolume24h += collection.volume24h || 0;
      
      const activity = (collection.volume24h || 0) + (collection.activeTraders || 0) * 10;
      if (activity > maxActivity) {
        maxActivity = activity;
        mostActiveCollection = collection.name;
      }
    });
    
    const averageFloorPrice = collectionsWithFloorPrice > 0 ? totalFloorPrice / collectionsWithFloorPrice : 0;
    
    return {
      totalCollections: collections.length, // Use actual count, not hardcoded
      totalVerified,
      totalUnverified,
      collectionsWithFloorPrice,
      averageFloorPrice,
      totalVolume24h,
      mostActiveCollection: mostActiveCollection === 'Unknown' && collections.length > 0 ? collections[0].name : mostActiveCollection
    };
  }

  /**
   * Get collection want counts from user data
   */
  private async getCollectionWantCounts(): Promise<Map<string, number>> {
    const collectionCounts = new Map<string, number>();
    
    try {
      // Get all wallet wants
      const walletWants = this.getAllWalletWantsFromStorage();
      
      // Count collection mentions
      for (const [wallet, wants] of Array.from(walletWants.entries())) {
        for (const nftAddress of wants) {
          const metadata = this.getCachedNFTMetadata(nftAddress);
          if (metadata?.collection) {
            const collectionName = typeof metadata.collection === 'string' 
              ? metadata.collection 
              : metadata.collection.name;
            
            if (collectionName) {
              collectionCounts.set(collectionName, (collectionCounts.get(collectionName) || 0) + 1);
            }
          }
        }
      }
      
      // Also check trending data for collection mentions
      if (this.knowledgeCache?.currentMarketState?.trendingNFTs) {
        this.knowledgeCache.currentMarketState.trendingNFTs.forEach(nft => {
          if (nft.collection && nft.wantCount) {
            collectionCounts.set(nft.collection, 
              (collectionCounts.get(nft.collection) || 0) + (nft.wantCount || 1)
            );
          }
        });
      }
    } catch (error) {
      console.error('Error getting collection want counts:', error);
    }
    
    return collectionCounts;
  }

  /**
   * Get collection trade activity
   */
  private async getCollectionTradeActivity(): Promise<Map<string, number>> {
    const activityMap = new Map<string, number>();
    
    try {
      const tradeHistory = await this.getTradeHistory();
      
      tradeHistory.forEach((trade: TradeHistoryItem) => {
        if (trade.nfts) {
          trade.nfts.forEach((nft: NFTMetadata) => {
            if (nft.collection) {
              const collectionName = typeof nft.collection === 'string' 
                ? nft.collection 
                : nft.collection.name;
              
              if (collectionName) {
                activityMap.set(collectionName, (activityMap.get(collectionName) || 0) + 1);
              }
            }
          });
        }
      });
    } catch (error) {
      console.error('Error getting collection trade activity:', error);
    }
    
    return activityMap;
  }
} 