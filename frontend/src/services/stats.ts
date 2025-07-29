import { BaseService } from './base.service';
import { logError } from '@/utils/errors/errorHandler';
import { TradeService } from './trade';
import { TradeStatusService, TradeHistoryItem } from './trade-status';
import { NFTService } from './nft';
import { TradeLoop } from '@/types/trade';
import { PublicKey } from '@solana/web3.js';
import { NFTMetadata } from '@/types/nft';

// Types for stats data
export interface TradeStatistic {
  label: string;
  value: string | number;
  change?: number;
  tooltip?: string;
}

export interface MetricDataPoint {
  date: string;
  value: number;
}

export interface NFTCollection {
  id: string;
  name: string;
  imageUrl: string;
  tradeVolume: number;
  tradeCount: number;
  floorPrice?: number;
  change?: number;
}

export interface TradeActivityItem {
  id: string;
  type: 'execution' | 'creation' | 'approval' | 'expiration' | 'rejection';
  tradeId: string;
  participants: number;
  nfts: string[];
  timestamp: Date;
  walletAddress?: string;
}

export interface UserTradeStats {
  totalTradesExecuted: number;
  totalTradesCreated: number;
  totalNFTsTraded: number;
  successRate: number;
  mostTradedCollection?: {
    name: string;
    count: number;
    imageUrl?: string;
  };
  avgTradeCompletionTime?: string;
  totalParticipantsInteracted?: number;
}

/**
 * Service for retrieving trade statistics and analytics data
 * This service only uses real data from the blockchain - no mock data
 */
export class StatsService extends BaseService {
  private static instance: StatsService;
  private tradeService: TradeService;
  private tradeStatusService: TradeStatusService;
  private nftService: NFTService;
  
  private constructor() {
    super();
    this.tradeService = TradeService.getInstance();
    this.tradeStatusService = TradeStatusService.getInstance();
    this.nftService = NFTService.getInstance();
  }
  
  public static getInstance(): StatsService {
    if (!StatsService.instance) {
      StatsService.instance = new StatsService();
    }
    return StatsService.instance;
  }
  
  /**
   * Fetch global platform statistics using only real blockchain data
   */
  public async getGlobalStats(): Promise<TradeStatistic[]> {
    try {
      // Check if API endpoint exists
      const apiExists = await this.checkApiEndpointExists('/api/stats/global');
      
      if (apiExists) {
        // Only try API call if we know the endpoint exists
        const response = await this.apiGet<{ stats: TradeStatistic[] }>('/api/stats/global');
        return response.stats;
      } else {
        // API endpoint doesn't exist, use local data silently
        console.log('API endpoint /api/stats/global is not implemented yet, using local data');
      }
    } catch (error) {
      // Silently catch errors without logging them
      console.log('Using computed stats - API not available');
    }
    
    try {
      // Compute statistics from real blockchain data
      const activeTradeAddresses = await this.tradeStatusService.getActiveTradeLoopAddresses();
      const activeTrades = activeTradeAddresses ? activeTradeAddresses.length : 0;
      const completedTrades = await this.tradeStatusService.getCompletedTradeCount();
      
      // Only include stats we can verify from blockchain
      const stats: TradeStatistic[] = [];
      
      // Only add stats if we have real data
      if (activeTrades >= 0) {
        stats.push({
          label: 'Active Trades',
          value: activeTrades,
          tooltip: 'Number of trade loops currently waiting for completion'
        });
      }
      
      if (completedTrades >= 0) {
        stats.push({
          label: 'Completed Trades',
          value: completedTrades,
          tooltip: 'Number of successfully executed trades'
        });
      }
      
      // Calculate success rate if we have both values
      if (activeTrades >= 0 && completedTrades >= 0 && (activeTrades + completedTrades > 0)) {
        const successRate = Math.round((completedTrades / (completedTrades + activeTrades)) * 100);
        stats.push({
          label: 'Success Rate',
          value: `${successRate}%`,
          tooltip: 'Percentage of created trades that complete successfully'
        });
      }
      
      // Always add a Total Volume stat with 0 when we have no trades
      stats.push({
        label: 'Total Trade Volume',
        value: '0 SOL',
        tooltip: 'Total value of all completed trades on the platform'
      });
      
      return stats;
    } catch (computeError) {
      console.warn('Computing stats from blockchain data failed', computeError);
      
      // Return minimal stats with zeros instead of nothing
      return [
        {
          label: 'Active Trades',
          value: 0,
          tooltip: 'Number of trade loops currently waiting for completion'
        },
        {
          label: 'Total Trade Volume',
          value: '0 SOL',
          tooltip: 'Total value of all completed trades on the platform'
        }
      ];
    }
  }
  
  /**
   * Fetch trading metrics over time using real trade history data
   */
  public async getTradingMetrics(): Promise<{
    volumeData: MetricDataPoint[];
    tradesData: MetricDataPoint[];
    participantsData: MetricDataPoint[];
    totalVolume: string;
    totalTrades: string;
    totalParticipants: string;
  }> {
    try {
      // Check if API endpoint exists
      const apiExists = await this.checkApiEndpointExists('/api/stats/metrics');
      
      if (apiExists) {
        // Only try API call if we know the endpoint exists
        const response = await this.apiGet<{
          volumeData: MetricDataPoint[];
          tradesData: MetricDataPoint[];
          participantsData: MetricDataPoint[];
          totalVolume: string;
          totalTrades: string;
          totalParticipants: string;
        }>('/api/stats/metrics');
        return response;
      } else {
        // API endpoint doesn't exist, use local data silently
        console.log('API endpoint /api/stats/metrics is not implemented yet, using local data');
      }
    } catch (error) {
      // Silently catch errors without logging them
      console.log('Using computed metrics - API not available');
    }
    
    try {
      // Compute metrics from real blockchain data
      const tradeHistory = await this.tradeStatusService.getTradeHistory();
      
      // Initialize empty metrics
      const emptyMetrics = {
        volumeData: [] as MetricDataPoint[],
        tradesData: [] as MetricDataPoint[],
        participantsData: [] as MetricDataPoint[],
        totalVolume: '0',
        totalTrades: '0',
        totalParticipants: '0'
      };
      
      // If no history available, return empty metrics
      if (!tradeHistory || tradeHistory.length === 0) {
        return emptyMetrics;
      }
      
      // Group by date
      const dateBuckets: { [key: string]: { volume: number, trades: number, participants: Set<string> } } = {};
      
      // Fill with actual data
      let totalVolume = 0;
      let totalParticipants = new Set<string>();
      
      tradeHistory.forEach(trade => {
        const tradeDate = new Date(trade.timestamp);
        const dateStr = `${tradeDate.getMonth() + 1}/${tradeDate.getDate()}`;
        
        if (!dateBuckets[dateStr]) {
          dateBuckets[dateStr] = { volume: 0, trades: 0, participants: new Set<string>() };
        }
        
        dateBuckets[dateStr].trades += 1;
        dateBuckets[dateStr].volume += trade.value || 0;
        totalVolume += trade.value || 0;
        
        // Add participants
        if (trade.participants) {
          trade.participants.forEach((participant: string) => {
            dateBuckets[dateStr].participants.add(participant);
            totalParticipants.add(participant);
          });
        }
      });
      
      // Convert to arrays needed for charts
      const volumeData: MetricDataPoint[] = [];
      const tradesData: MetricDataPoint[] = [];
      const participantsData: MetricDataPoint[] = [];
      
      Object.keys(dateBuckets).forEach(date => {
        volumeData.push({ date, value: dateBuckets[date].volume });
        tradesData.push({ date, value: dateBuckets[date].trades });
        participantsData.push({ date, value: dateBuckets[date].participants.size });
      });
      
      return {
        volumeData,
        tradesData,
        participantsData,
        totalVolume: totalVolume.toFixed(2),
        totalTrades: tradeHistory.length.toString(),
        totalParticipants: totalParticipants.size.toString()
      };
    } catch (computeError) {
      console.warn('Computing metrics failed', computeError);
      
      // Return empty metrics with zeros
      return {
        volumeData: [],
        tradesData: [],
        participantsData: [],
        totalVolume: '0',
        totalTrades: '0',
        totalParticipants: '0'
      };
    }
  }
  
  /**
   * Fetch popular NFT collections based on actual trade data
   */
  public async getPopularCollections(limit: number = 10): Promise<NFTCollection[]> {
    try {
      // Check if API endpoint exists
      const apiExists = await this.checkApiEndpointExists(`/api/stats/collections?limit=${limit}`);
      
      if (apiExists) {
        // Only try API call if we know the endpoint exists
        const response = await this.apiGet<{ collections: NFTCollection[] }>(`/api/stats/collections?limit=${limit}`);
        return response.collections;
      } else {
        // API endpoint doesn't exist, use local data silently
        console.log(`API endpoint /api/stats/collections is not implemented yet, using local data`);
      }
    } catch (error) {
      // Silently catch errors without logging them
      console.log('Using computed collections - API not available');
    }
    
    try {
      // Compute from real blockchain data
      const tradeHistory = await this.tradeStatusService.getTradeHistory();
      
      // If no history, return empty array
      if (!tradeHistory || tradeHistory.length === 0) {
        return [];
      }
      
      // Track collections by frequency and volume
      const collections: Record<string, {
        id: string;
        name: string;
        imageUrl: string;
        tradeVolume: number;
        tradeCount: number;
      }> = {};
      
      // Process each trade and extract collection info from real data
      for (const trade of tradeHistory) {
        if (!trade.nfts) continue;
        
        for (const nft of trade.nfts) {
          // Handle collection which can be a string or an object
          let collectionId = 'unknown';
          let collectionName = 'Unknown Collection';
          
          if (nft.collection) {
            if (typeof nft.collection === 'string') {
              collectionId = nft.collection;
              collectionName = nft.collection;
            } else {
              collectionId = nft.collection.address || 'unknown';
              collectionName = nft.collection.name || 'Unknown Collection';
            }
          }
          
          if (!collections[collectionId]) {
            collections[collectionId] = {
              id: collectionId,
              name: collectionName,
              imageUrl: nft.image || '',
              tradeVolume: 0,
              tradeCount: 0
            };
          }
          
          collections[collectionId].tradeCount += 1;
          collections[collectionId].tradeVolume += (trade.value || 0) / (trade.nfts.length || 1);
          
          // Update image if not set yet
          if (!collections[collectionId].imageUrl && nft.image) {
            collections[collectionId].imageUrl = nft.image;
          }
        }
      }
      
      // Convert to array and sort by volume
      const collectionsArray = Object.values(collections);
      collectionsArray.sort((a, b) => b.tradeVolume - a.tradeVolume);
      
      return collectionsArray.slice(0, limit);
    } catch (computeError) {
      console.warn('Computing collections failed', computeError);
      return [];
    }
  }
  
  /**
   * Fetch recent trade activity from actual trade history
   */
  public async getRecentActivity(limit: number = 10): Promise<TradeActivityItem[]> {
    try {
      // Check if API endpoint exists
      const apiExists = await this.checkApiEndpointExists(`/api/stats/activity?limit=${limit}`);
      
      if (apiExists) {
        // Only try API call if we know the endpoint exists
        const response = await this.apiGet<{ activities: any[] }>(`/api/stats/activity?limit=${limit}`);
        
        // Convert API response to proper format with Date objects
        const activities: TradeActivityItem[] = response.activities.map(activity => ({
          ...activity,
          timestamp: new Date(activity.timestamp)
        }));
        
        return activities;
      } else {
        // API endpoint doesn't exist, use local data silently
        console.log(`API endpoint /api/stats/activity is not implemented yet, using local data`);
      }
    } catch (error) {
      // Silently catch errors without logging them
      console.log('Using computed activity - API not available');
    }
    
    try {
      // Compute from real blockchain data
      const tradeHistory = await this.tradeStatusService.getTradeHistory();
      
      if (!tradeHistory || tradeHistory.length === 0) {
        return [];
      }
      
      // Sort by most recent first
      const sortedHistory = [...tradeHistory].sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      
      // Convert to activity items
      const activities: TradeActivityItem[] = sortedHistory.slice(0, limit).map(trade => ({
        id: trade.id || `activity-${Math.random().toString(36).substring(2, 11)}`,
        type: trade.status === 'completed' ? 'execution' : 
              trade.status === 'expired' ? 'expiration' : 
              trade.status === 'rejected' ? 'rejection' : 'creation',
        tradeId: trade.address || 'unknown',
        participants: trade.participants?.length || 0,
        nfts: trade.nfts?.map((nft: NFTMetadata) => nft.name || 'Unnamed NFT') || [],
        timestamp: new Date(trade.timestamp)
      }));
      
      return activities;
    } catch (computeError) {
      console.warn('Computing activity failed', computeError);
      return [];
    }
  }
  
  /**
   * Fetch user-specific trade statistics from actual trade history
   */
  public async getUserStats(walletAddress: string): Promise<UserTradeStats> {
    try {
      // Check if API endpoint exists
      const apiExists = await this.checkApiEndpointExists(`/api/stats/user/${walletAddress}`);
      
      if (apiExists) {
        // Only try API call if we know the endpoint exists
        const response = await this.apiGet<{ stats: UserTradeStats }>(`/api/stats/user/${walletAddress}`);
        return response.stats;
      } else {
        // API endpoint doesn't exist, use local data silently
        console.log(`API endpoint /api/stats/user/${walletAddress} is not implemented yet, using local data`);
      }
    } catch (error) {
      // Silently catch errors without logging them
      console.log(`Using computed user stats for ${walletAddress} - API not available`);
    }
    
    try {
      // Validate wallet address format
      try {
        new PublicKey(walletAddress);
      } catch (e) {
        throw new Error('Invalid wallet address format');
      }
      
      // Get trade history filtered by this wallet
      const tradeHistory = await this.tradeStatusService.getUserTradeHistory(walletAddress);
      
      if (!tradeHistory || tradeHistory.length === 0) {
        // No trade history available for this user, return zero stats
        return {
          totalTradesExecuted: 0,
          totalTradesCreated: 0,
          totalNFTsTraded: 0,
          successRate: 0
        };
      }
      
      // Count executed and created trades from real data
      const executed = tradeHistory.filter((t: TradeHistoryItem) => t.status === 'completed').length;
      const created = tradeHistory.filter((t: TradeHistoryItem) => t.creator === walletAddress).length;
      
      // Count total NFTs traded from real data
      let totalNFTs = 0;
      const collections: Record<string, number> = {};
      let mostTradedCollection: { name: string; count: number; imageUrl?: string } | undefined;
      
      tradeHistory.forEach(trade => {
        if (trade.nfts) {
          totalNFTs += trade.nfts.length;
          
          // Track collections
          trade.nfts.forEach(nft => {
            // Handle collection which can be a string or an object
            let collectionName = 'Unknown Collection';
            
            if (nft.collection) {
              if (typeof nft.collection === 'string') {
                collectionName = nft.collection;
              } else if (typeof nft.collection === 'object' && nft.collection.name) {
                collectionName = nft.collection.name;
              }
            }
            
            collections[collectionName] = (collections[collectionName] || 0) + 1;
            
            // Update most traded collection
            if (!mostTradedCollection || collections[collectionName] > mostTradedCollection.count) {
              mostTradedCollection = {
                name: collectionName,
                count: collections[collectionName],
                imageUrl: nft.image
              };
            }
          });
        }
      });
      
      // Calculate success rate from real data
      const total = tradeHistory.length;
      const successful = tradeHistory.filter((t: TradeHistoryItem) => t.status === 'completed').length;
      const successRate = total > 0 ? (successful / total) * 100 : 0;
      
      // Calculate average completion time from real data (if timestamps available)
      let avgCompletionTime: string | undefined;
      const completedTrades = tradeHistory.filter((t: TradeHistoryItem) => 
        t.status === 'completed' && t.createdAt && t.completedAt
      );
      
      if (completedTrades.length > 0) {
        const totalTimeMs = completedTrades.reduce((sum, trade) => {
          const created = new Date(trade.createdAt!).getTime();
          const completed = new Date(trade.completedAt!).getTime();
          return sum + (completed - created);
        }, 0);
        
        const avgTimeMs = totalTimeMs / completedTrades.length;
        const avgTimeHours = avgTimeMs / (1000 * 60 * 60);
        
        if (avgTimeHours < 1) {
          avgCompletionTime = `${Math.round(avgTimeHours * 60)} minutes`;
        } else {
          avgCompletionTime = `${avgTimeHours.toFixed(1)} hours`;
        }
      }
      
      // Count unique participants from real data
      const uniqueParticipants = new Set<string>();
      tradeHistory.forEach(trade => {
        if (trade.participants) {
          trade.participants.forEach(p => uniqueParticipants.add(p));
        }
      });
      
      // Remove the user's own wallet
      uniqueParticipants.delete(walletAddress);
      
      return {
        totalTradesExecuted: executed,
        totalTradesCreated: created,
        totalNFTsTraded: totalNFTs,
        successRate,
        mostTradedCollection,
        avgTradeCompletionTime: avgCompletionTime,
        totalParticipantsInteracted: uniqueParticipants.size
      };
    } catch (computeError) {
      console.warn(`Computing user stats for ${walletAddress} failed`, computeError);
      
      // Return zero stats instead of nothing
      return {
        totalTradesExecuted: 0,
        totalTradesCreated: 0,
        totalNFTsTraded: 0,
        successRate: 0
      };
    }
  }
}

export default StatsService; 