import { PublicKey } from '@solana/web3.js';
import { SmartContractService } from './smart-contract';
import { BaseService } from './base.service';
import { TradeLoop } from '@/types/trade';
import { logError } from '@/utils/errors/errorHandler';
import { NFTMetadata } from '@/types/nft';

export interface TradeStatus {
  tradeLoopAddress: string;
  tradeId: string;
  createdAt: Date;
  expiresAt: Date;
  steps: Array<{
    from: string;
    to: string;
    nftMints: string[];
    status: 'Created' | 'Approved' | 'Executed';
  }>;
  overallStatus: 'Pending' | 'Approved' | 'Executed' | 'Expired';
  isParticipant: boolean;
  progress: number; // 0-100 percentage
}

/**
 * Represents a trade history item for analytics
 */
export interface TradeHistoryItem {
  id: string;
  address: string;
  creator?: string;
  status: 'pending' | 'completed' | 'expired' | 'rejected';
  timestamp: string;
  createdAt?: string;
  completedAt?: string;
  value?: number;
  participants?: string[];
  nfts?: NFTMetadata[];
}

/**
 * Service for tracking and managing trade statuses
 */
export class TradeStatusService extends BaseService {
  private static instance: TradeStatusService;
  private pendingTrades: Map<string, TradeStatus> = new Map();
  private userParticipatingTrades: Map<string, string[]> = new Map(); // wallet -> tradeAddresses[]
  private smartContractService: SmartContractService;
  
  private constructor() {
    super();
    this.smartContractService = SmartContractService.getInstance();
  }
  
  public static getInstance(): TradeStatusService {
    if (!TradeStatusService.instance) {
      TradeStatusService.instance = new TradeStatusService();
    }
    return TradeStatusService.instance;
  }
  
  /**
   * Track a new trade loop
   * @param tradeLoopAddress The address of the trade loop to track
   * @param userWallet Optional user wallet to associate with this trade
   */
  public async trackTradeLoop(tradeLoopAddress: string, userWallet?: string): Promise<TradeStatus | null> {
    try {
      // Check if this is a UUID-format ID rather than a PublicKey
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tradeLoopAddress);
      
      if (isUUID) {
        // For UUID-formatted trade IDs, we need to handle them differently
        // We'll create a stub TradeStatus object with available data
        console.log(`Trade ID ${tradeLoopAddress} is in UUID format, creating stub data`);
        
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
        
        const tradeStatus: TradeStatus = {
          tradeLoopAddress: tradeLoopAddress,
          tradeId: tradeLoopAddress,
          createdAt: now,
          expiresAt: expiresAt,
          steps: [], // Will be populated from API when available
          overallStatus: 'Pending',
          isParticipant: true, // Assume user is participant since we have this ID
          progress: 0
        };
        
        // Store in our tracking maps
        this.pendingTrades.set(tradeLoopAddress, tradeStatus);
        
        // If user wallet provided, track this trade for that user
        if (userWallet) {
          if (!this.userParticipatingTrades.has(userWallet)) {
            this.userParticipatingTrades.set(userWallet, []);
          }
          
          const userTrades = this.userParticipatingTrades.get(userWallet)!;
          if (!userTrades.includes(tradeLoopAddress)) {
            userTrades.push(tradeLoopAddress);
            this.userParticipatingTrades.set(userWallet, userTrades);
          }
        }
        
        // Try to get more details from the API
        try {
          const response = await this.apiGet<{trade: TradeLoop | null}>(`/api/trades/details/${tradeLoopAddress}`);
          
          if (response.trade && response.trade.steps && Array.isArray(response.trade.steps)) {
            // Update our stub with real data
            tradeStatus.steps = response.trade.steps.map(step => ({
              from: step.from,
              to: step.to,
              nftMints: step.nfts?.map(nft => nft.address) || [],
              status: 'Created'
            }));
            
            tradeStatus.progress = 0; // Recalculate based on real steps
            tradeStatus.isParticipant = userWallet ? 
              response.trade.steps.some(step => 
                step.from === userWallet || step.to === userWallet
              ) : false;
              
            // Update our stored version
            this.pendingTrades.set(tradeLoopAddress, tradeStatus);
          }
        } catch (apiError) {
          console.warn(`Could not get API details for UUID trade ${tradeLoopAddress}`, apiError);
          
          // Check if this was a 404 Not Found error
          if (apiError instanceof Error && apiError.message.includes('404 Not Found')) {
            console.log(`Trade ${tradeLoopAddress} no longer exists in the backend, removing from tracking`);
            
            // Remove from pendingTrades
            this.pendingTrades.delete(tradeLoopAddress);
            
            // Remove from user participating trades if a wallet was provided
            if (userWallet && this.userParticipatingTrades.has(userWallet)) {
              const userTrades = this.userParticipatingTrades.get(userWallet)!;
              const index = userTrades.indexOf(tradeLoopAddress);
              if (index !== -1) {
                userTrades.splice(index, 1);
                this.userParticipatingTrades.set(userWallet, userTrades);
              }
            }
            
            // Return null to indicate this trade no longer exists
            return null;
          }
          
          // Continue with stub data for other types of errors
        }
        
        return tradeStatus;
      }
      
      // Standard PublicKey-based trade loop handling
      try {
        // Fetch the trade loop details from the blockchain
        const decodedLoop = await this.smartContractService.decodeTradeLoopAccount(
          new PublicKey(tradeLoopAddress)
        );
        
        // Calculate overall status
        const now = Date.now();
        let overallStatus: 'Pending' | 'Approved' | 'Executed' | 'Expired' = 'Pending';
        
        if (decodedLoop.expiresAt < now) {
          overallStatus = 'Expired';
        } else {
          // Check if all steps are approved
          const allApproved = decodedLoop.steps.every(step => 
            step.status === 'Approved' || step.status === 'Executed'
          );
          
          if (allApproved) {
            overallStatus = 'Approved';
          }
          
          // Check if any steps are executed (which means all are)
          const anyExecuted = decodedLoop.steps.some(step => step.status === 'Executed');
          if (anyExecuted) {
            overallStatus = 'Executed';
          }
        }
        
        // Calculate progress
        const totalSteps = decodedLoop.steps.length;
        const approvedSteps = decodedLoop.steps.filter(
          step => step.status === 'Approved' || step.status === 'Executed'
        ).length;
        const progress = Math.round((approvedSteps / totalSteps) * 100);
        
        // Format the trade status
        const tradeStatus: TradeStatus = {
          tradeLoopAddress,
          tradeId: decodedLoop.tradeId,
          createdAt: new Date(decodedLoop.createdAt),
          expiresAt: new Date(decodedLoop.expiresAt),
          steps: decodedLoop.steps.map(step => ({
            from: step.from.toString(),
            to: step.to.toString(),
            nftMints: step.nftMints.map(mint => mint.toString()),
            status: step.status
          })),
          overallStatus,
          isParticipant: userWallet ? 
            decodedLoop.steps.some(step => 
              step.from.toString() === userWallet || step.to.toString() === userWallet
            ) : false,
          progress
        };
        
        // Store in our tracking maps
        this.pendingTrades.set(tradeLoopAddress, tradeStatus);
        
        // If user wallet provided, track this trade for that user
        if (userWallet) {
          if (!this.userParticipatingTrades.has(userWallet)) {
            this.userParticipatingTrades.set(userWallet, []);
          }
          
          const userTrades = this.userParticipatingTrades.get(userWallet)!;
          if (!userTrades.includes(tradeLoopAddress)) {
            userTrades.push(tradeLoopAddress);
            this.userParticipatingTrades.set(userWallet, userTrades);
          }
        }
        
        return tradeStatus;
      } catch (blockchainError) {
        console.error(`Error decoding trade loop from blockchain: ${tradeLoopAddress}`, blockchainError);
        
        // Try to fall back to API data if blockchain call fails
        try {
          console.log(`Trying API fallback for trade ${tradeLoopAddress}`);
          const response = await this.apiGet<{trade: TradeLoop | null}>(`/api/trades/details/${tradeLoopAddress}`);
          
          if (response.trade && response.trade.steps && Array.isArray(response.trade.steps)) {
            // Create a basic TradeStatus from the API data
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default 24hr expiry
            
            const tradeStatus: TradeStatus = {
              tradeLoopAddress,
              tradeId: response.trade.id || tradeLoopAddress,
              createdAt: response.trade.createdAt ? new Date(response.trade.createdAt) : now,
              expiresAt: response.trade.expiresAt ? new Date(response.trade.expiresAt) : expiresAt,
              steps: response.trade.steps.map(step => ({
                from: step.from,
                to: step.to,
                nftMints: step.nfts?.map(nft => nft.address) || [],
                status: 'Created'
              })),
              overallStatus: 'Pending',
              isParticipant: userWallet ? 
                response.trade.steps.some(step => 
                  step.from === userWallet || step.to === userWallet
                ) : false,
              progress: 0
            };
            
            // Store in our tracking maps
            this.pendingTrades.set(tradeLoopAddress, tradeStatus);
            
            // If user wallet provided, track this trade for that user
            if (userWallet) {
              if (!this.userParticipatingTrades.has(userWallet)) {
                this.userParticipatingTrades.set(userWallet, []);
              }
              
              const userTrades = this.userParticipatingTrades.get(userWallet)!;
              if (!userTrades.includes(tradeLoopAddress)) {
                userTrades.push(tradeLoopAddress);
                this.userParticipatingTrades.set(userWallet, userTrades);
              }
            }
            
            return tradeStatus;
          }
        } catch (apiError) {
          console.error(`API fallback also failed for trade ${tradeLoopAddress}`, apiError);
          
          // Check if this was a 404 Not Found error
          if (apiError instanceof Error && apiError.message.includes('404 Not Found')) {
            console.log(`Trade ${tradeLoopAddress} no longer exists in the backend, removing from tracking`);
            
            // Remove from pendingTrades
            this.pendingTrades.delete(tradeLoopAddress);
            
            // Remove from user participating trades if a wallet was provided
            if (userWallet && this.userParticipatingTrades.has(userWallet)) {
              const userTrades = this.userParticipatingTrades.get(userWallet)!;
              const index = userTrades.indexOf(tradeLoopAddress);
              if (index !== -1) {
                userTrades.splice(index, 1);
                this.userParticipatingTrades.set(userWallet, userTrades);
              }
            }
          }
        }
        
        // If we got here, both blockchain and API fallback failed
        return null;
      }
    } catch (error) {
      console.error(`Error tracking trade loop ${tradeLoopAddress}:`, error);
      return null;
    }
  }
  
  /**
   * Get all trades a user is participating in
   * @param walletAddress The user's wallet address
   * @param explicitlySubmittedOnly If true, only return trades that were explicitly submitted by the user
   */
  public async getUserTrades(walletAddress: string, explicitlySubmittedOnly: boolean = false): Promise<TradeStatus[]> {
    const result: TradeStatus[] = [];
    
    try {
      // If we already know about trades for this user, refresh their status
      if (this.userParticipatingTrades.has(walletAddress)) {
        const tradeAddresses = this.userParticipatingTrades.get(walletAddress)!;
        
        // Skip refresh if no trades to refresh
        if (tradeAddresses.length > 0) {
          console.log(`Refreshing ${tradeAddresses.length} tracked trades for wallet ${walletAddress}`);
          
          // Refresh each trade in parallel
          const refreshPromises = tradeAddresses.map(address => 
            this.trackTradeLoop(address, walletAddress)
              .catch(err => {
                console.warn(`Error refreshing trade ${address}:`, err);
                return null;
              })
          );
          
          const refreshedTrades = await Promise.all(refreshPromises);
          
          // Add valid trades to the result
          refreshedTrades.forEach(trade => {
            if (trade) result.push(trade);
          });
          
          // Clean up userParticipatingTrades to include only valid trades
          const validTradeIds = refreshedTrades
            .filter(trade => trade !== null)
            .map(trade => trade!.tradeLoopAddress);
            
          if (validTradeIds.length !== tradeAddresses.length) {
            console.log(`Cleaning up trade tracking: ${tradeAddresses.length} before, ${validTradeIds.length} after`);
            this.userParticipatingTrades.set(walletAddress, validTradeIds);
          }
        }
      }
      
      // Try to query API for any additional trades
      try {
        const params = explicitlySubmittedOnly ? '?explicitlySubmittedOnly=true' : '';
        const endpoint = `/api/trades/user/${walletAddress}${params}`;
        const response = await this.apiGet<{trades: TradeLoop[]}>(endpoint);
        
        if (response.trades && response.trades.length > 0) {
          console.log(`Found ${response.trades.length} trades from API for wallet ${walletAddress}`);
          
          // Add these trades to our tracking (if they aren't already tracked)
          const addTradePromises = response.trades
            .filter(trade => trade.id && !this.pendingTrades.has(trade.id))
            .map(trade => this.trackTradeLoop(trade.id, walletAddress)
              .catch(err => {
                console.warn(`Error tracking new trade ${trade.id}:`, err);
                return null;
              })
            );
            
          // Wait for all trades to be added
          const addedTrades = await Promise.all(addTradePromises);
          
          // Add valid trades to result
          addedTrades.forEach(trade => {
            if (trade) result.push(trade);
          });
        }
      } catch (apiError) {
        // Just log API error and continue with the trades we already have
        console.warn(`Failed to fetch additional trades from API for ${walletAddress}:`, apiError);
      }
      
      // Sort by creation date, newest first
      result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      return result;
    } catch (error) {
      // Log the error for debugging
      logError(error, `Fetching trades for ${walletAddress}`);
      
      // Return the trades we already had (if any)
      if (result.length > 0) {
        console.warn('Returning cached trades due to API error');
        return result;
      }
      
      // Re-throw if we have no trades to return
      throw error;
    }
  }
  
  /**
   * Refresh the status of a specific trade
   * @param tradeLoopAddress The address of the trade to refresh
   * @param userWallet Optional user wallet to check participation
   */
  public async refreshTradeStatus(tradeLoopAddress: string, userWallet?: string): Promise<TradeStatus | null> {
    return this.trackTradeLoop(tradeLoopAddress, userWallet);
  }
  
  /**
   * Check for updates to all tracked trades
   */
  public async refreshAllTrades(): Promise<void> {
    const tradeAddresses = Array.from(this.pendingTrades.keys());
    
    const refreshPromises = tradeAddresses.map(address => this.trackTradeLoop(address));
    await Promise.all(refreshPromises);
  }
  
  /**
   * Format time until expiration in a human-readable way
   */
  public formatTimeRemaining(expiresAt: Date): string {
    const now = new Date();
    const timeRemaining = expiresAt.getTime() - now.getTime();
    
    if (timeRemaining <= 0) {
      return 'Expired';
    }
    
    // Convert to seconds, minutes, hours
    const seconds = Math.floor(timeRemaining / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h remaining`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m remaining`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s remaining`;
    } else {
      return `${seconds}s remaining`;
    }
  }

  /**
   * Get addresses of all currently active trade loops
   */
  public async getActiveTradeLoopAddresses(): Promise<string[]> {
    try {
      // Check if API endpoint exists by doing a safe fetch that won't log errors
      const apiExists = await this.checkApiEndpointExists('/api/trades/active');
      
      if (apiExists) {
        // Only try API call if we know the endpoint exists
        const response = await this.apiGet<{ success: boolean, trades: any[] }>('/api/trades/active');
        // Extract trade IDs from the trades array
        return response.trades?.map(trade => trade.id || '') || [];
      } else {
        // API endpoint doesn't exist, use local data silently
        console.log('API endpoint /api/trades/active is not implemented yet, using local data');
      }
    } catch (error) {
      // Silently catch errors without logging them
      console.log('Using local trade data - API not available');
    }
    
    // Use our local tracking
    const activeTrades = Array.from(this.pendingTrades.values())
      .filter(trade => trade.overallStatus !== 'Expired' && trade.overallStatus !== 'Executed')
      .map(trade => trade.tradeLoopAddress);
    
    return activeTrades;
  }

  /**
   * Get the count of completed trades
   */
  public async getCompletedTradeCount(): Promise<number> {
    try {
      // Check if API endpoint exists
      const apiExists = await this.checkApiEndpointExists('/api/trades/completed/count');
      
      if (apiExists) {
        // Only try API call if we know the endpoint exists
        const response = await this.apiGet<{ success: boolean, count: number }>('/api/trades/completed/count');
        return response.count || 0;
      } else {
        // API endpoint doesn't exist, use local data silently
        console.log('API endpoint /api/trades/completed/count is not implemented yet, using local data');
      }
    } catch (error) {
      // Silently catch errors without logging them
      console.log('Using local completed trades count - API not available');
    }
    
    // Calculate from our local tracking
    const completedTrades = Array.from(this.pendingTrades.values())
      .filter(trade => trade.overallStatus === 'Executed')
      .length;
    
    // This will undercount since we only track recent trades, but it's better than nothing
    return completedTrades;
  }

  /**
   * Get trade history for analytics
   */
  public async getTradeHistory(): Promise<TradeHistoryItem[]> {
    try {
      // Check if API endpoint exists
      const apiExists = await this.checkApiEndpointExists('/api/trades/history');
      
      if (apiExists) {
        // Only try API call if we know the endpoint exists
        const response = await this.apiGet<{ success: boolean, trades: TradeHistoryItem[] }>('/api/trades/history');
        return response.trades || [];
      } else {
        // API endpoint doesn't exist, use local data silently
        console.log('API endpoint /api/trades/history is not implemented yet, using local data');
      }
    } catch (error) {
      // Silently catch errors without logging them
      console.log('Using local trade history - API not available');
    }
    
    // Convert our local tracking to history items
    const historyItems: TradeHistoryItem[] = Array.from(this.pendingTrades.values()).map(trade => {
      // Calculate estimated value (placeholders for real data)
      const estimatedValue = 0; // No mock data, use real values only
      
      // Convert steps to participants
      const participants = new Set<string>();
      trade.steps.forEach(step => {
        participants.add(step.from);
        participants.add(step.to);
      });
      
      // Get NFT info from steps
      const nfts: NFTMetadata[] = [];
      trade.steps.forEach(step => {
        // Create NFT metadata from mint addresses - minimal data only
        step.nftMints.forEach((mint) => {
          nfts.push({
            address: mint,
            name: `NFT ${mint.substring(0, 4)}...`, // Just show mint address part
            symbol: 'NFT',
            image: '', // No mock image
            owner: step.from
          });
        });
      });
      
      return {
        id: trade.tradeId,
        address: trade.tradeLoopAddress,
        status: this.mapStatusToHistoryStatus(trade.overallStatus),
        timestamp: trade.createdAt.toISOString(),
        createdAt: trade.createdAt.toISOString(),
        completedAt: trade.overallStatus === 'Executed' ? 
          trade.createdAt.toISOString() : // Use creation date since we don't track completion time 
          undefined,
        value: estimatedValue,
        participants: Array.from(participants),
        nfts
      };
    });
    
    // Sort by timestamp, newest first
    historyItems.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    return historyItems;
  }

  /**
   * Get trade history for a specific user
   * @param walletAddress The user's wallet address
   */
  public async getUserTradeHistory(walletAddress: string): Promise<TradeHistoryItem[]> {
    try {
      // Check if API endpoint exists
      const apiExists = await this.checkApiEndpointExists(`/api/trades/history/user/${walletAddress}`);
      
      if (apiExists) {
        // Only try API call if we know the endpoint exists
        const response = await this.apiGet<{ success: boolean, trades: TradeHistoryItem[] }>(`/api/trades/history/user/${walletAddress}`);
        return response.trades || [];
      } else {
        // API endpoint doesn't exist, use local data silently
        console.log(`API endpoint /api/trades/history/user/${walletAddress} is not implemented yet, using local data`);
      }
    } catch (error) {
      // Silently catch errors without logging them
      console.log('Using local user trade history - API not available');
    }
    
    try {
      // Get full trade history then filter to this user
      const allHistory = await this.getTradeHistory();
      
      // Filter to trades where this wallet is a participant
      return allHistory.filter(trade => 
        trade.participants?.includes(walletAddress) ||
        trade.creator === walletAddress
      );
    } catch (historyError) {
      // If getting history fails, just return empty array
      console.warn("Failed to get user trade history:", historyError);
      return [];
    }
  }

  /**
   * Helper to map trade status to history status
   */
  private mapStatusToHistoryStatus(status: TradeStatus['overallStatus']): TradeHistoryItem['status'] {
    switch(status) {
      case 'Executed':
        return 'completed';
      case 'Expired':
        return 'expired';
      case 'Pending':
      case 'Approved':
      default:
        return 'pending';
    }
  }
} 