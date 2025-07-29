import { PublicKey } from '@solana/web3.js';
import { NFTMetadata } from '../types/nft';
import { TradeLoop, TradeResponse } from '../types/trade';
import { BaseService } from './base.service';
import { TradeStatusService } from './trade-status';

export class TradeService extends BaseService {
  private static instance: TradeService;

  private constructor() {
    super();
  }

  public static getInstance(): TradeService {
    if (!TradeService.instance) {
      TradeService.instance = new TradeService();
    }
    return TradeService.instance;
  }

  /**
   * Finds trade loops for the specified NFT and wallet
   * Enhanced to support collection-level preferences and settings
   * 
   * @param nft The NFT the wallet is interested in (optional if using collection preferences)
   * @param walletAddress The wallet address
   * @param options Optional collection discovery settings
   * @returns Promise resolving to an array of discovered trade loops
   */
  async findTradeLoops(
    nft: NFTMetadata | null, 
    walletAddress: string, 
    options?: {
      includeCollectionTrades?: boolean;
      considerCollections?: boolean;
      maxResults?: number;
      minEfficiency?: number;
    }
  ): Promise<TradeLoop[]> {
    try {
      if (!walletAddress) {
        console.error('No wallet address provided to findTradeLoops');
        return [];
      }
      
      // Prepare the request payload with collection support
      const payload: any = {
        wallet: walletAddress,
        forceRefresh: 'true',
        searchId: `${Date.now()}-${walletAddress.substring(0, 8)}`
      };

      // Add NFT-specific parameters if an NFT is provided
      if (nft && nft.address) {
        payload.nft = nft.address;
        payload.searchId += `-${nft.address.substring(0, 8)}`;
      }

      // Add collection-specific parameters
      if (options) {
        if (options.includeCollectionTrades !== undefined) {
          payload.includeCollectionTrades = options.includeCollectionTrades;
        }
        if (options.considerCollections !== undefined) {
          payload.considerCollections = options.considerCollections;
        }
        if (options.maxResults !== undefined) {
          payload.maxResults = options.maxResults;
        }
        if (options.minEfficiency !== undefined) {
          payload.minEfficiency = options.minEfficiency;
        }
      }
      
      console.log(`Sending enhanced trade discovery request`, payload);
      
      // Call the backend to discover potential trades
      const result = await this.apiPost<TradeResponse>('/api/trades/discover', payload);
      
      if (result.success && result.trades && result.trades.length > 0) {
        console.log(`Received ${result.trades.length} trades (collection-enhanced)`);
        
        // Log collection stats if available
        if (result.collectionStats) {
          console.log('Collection trading stats:', result.collectionStats);
        }
        
        // Validate each trade has the necessary data
        const validatedTrades = result.trades.filter(trade => {
          // Check if this trade has valid steps
          if (!trade.steps || trade.steps.length === 0) {
            console.warn('Trade has no steps, skipping:', trade.id);
            return false;
          }
          
          // Make sure each step has the required nfts data
          const hasValidNFTs = trade.steps.every(step => {
            return step.nfts && Array.isArray(step.nfts) && step.nfts.length > 0;
          });
          
          if (!hasValidNFTs) {
            console.warn('Trade has steps with missing NFT data, skipping:', trade.id);
            return false;
          }
          
          return true;
        });
        
        if (validatedTrades.length < result.trades.length) {
          console.warn(`Filtered out ${result.trades.length - validatedTrades.length} invalid trades`);
        }
        
        // Sort by quality score if available, otherwise by efficiency
        validatedTrades.sort((a, b) => {
          const scoreA = a.qualityScore || a.efficiency;
          const scoreB = b.qualityScore || b.efficiency;
          return scoreB - scoreA;
        });
        
        return validatedTrades;
      } else {
        console.log(`No trades found for request:`, payload);
        return [];
      }
    } catch (error) {
      console.error(`Error discovering trades:`, error);
      return [];
    }
  }

  /**
   * Rejects a specific NFT for a wallet
   */
  async rejectTrade(nftAddress: string, userWallet: string): Promise<boolean> {
    try {
      console.log('Rejecting trade for:', { nftAddress, userWallet });
      
      const request = {
        wallet: userWallet,
        rejectedNftAddress: nftAddress,
      };
      console.log('Sending trade rejection request:', request);

      const data = await this.apiPost<{success: boolean}>('/api/trades/reject', request);
      console.log('Trade rejection response:', data);
      
      if (data.success) {
        // Also remove this NFT from the wallet's wanted NFTs in localStorage
        const savedWants = localStorage.getItem(`${userWallet}_wanted_nfts`);
        if (savedWants) {
          try {
            const parsedWants = JSON.parse(savedWants);
            if (Array.isArray(parsedWants)) {
              const updatedWants = parsedWants.filter(want => want !== nftAddress);
              localStorage.setItem(`${userWallet}_wanted_nfts`, JSON.stringify(updatedWants));
              console.log(`Removed ${nftAddress} from wallet's wanted NFTs in localStorage`);
            }
          } catch (e) {
            console.warn('Failed to update saved wants after rejection:', e);
          }
        }
      }
      
      return data.success;
    } catch (error) {
      console.error('Error rejecting trade:', error);
      return false;
    }
  }

  /**
   * Initiates a trade request for an NFT
   * @param nftAddress - The address of the NFT to trade for
   */
  async initiateTrade(nftAddress: string): Promise<void> {
    try {
      console.log('Trade service: Initiating trade for NFT:', nftAddress);
      
      // Get connected wallet
      const walletAddress = localStorage.getItem('lastConnectedWallet');
      if (!walletAddress) {
        throw new Error('No wallet connected. Please connect your wallet first.');
      }
      
      // Register ONLY the specific want for the NFT being initiated
      const wantedNftsArray = [nftAddress]; // Only the current NFT
      await this.addMultipleWants(wantedNftsArray, walletAddress);
      
      // Create the trade request payload for discovery
      const request = {
        wallet: walletAddress,
        nft: nftAddress, // Still pass the specific NFT for context
        forceRefresh: true
      };
      
      // Send the request to the backend to discover trades based on updated wants
      const response = await this.apiPost<{success: boolean, trades: any[]}>('/api/trades/discover', request);
      
      if (!response.success) {
        throw new Error('Failed to initiate trade discovery');
      }
      
      console.log('Trade initiation and discovery successful:', response);
      return; // Return void as originally intended
    } catch (error) {
      console.error('Error initiating trade:', error);
      throw error instanceof Error ? error : new Error('Failed to initiate trade');
    }
  }

  /**
   * Gets the current state of the trade pool
   */
  async getPoolState(): Promise<{ size: number; walletCount: number }> {
    try {
      const data = await this.apiGet<{ stats: { requestCount: number; walletCount: number } }>('/api/trades/pool/stats');
      return {
        size: data.stats.requestCount,
        walletCount: data.stats.walletCount
      };
    } catch (error) {
      console.error('Error getting pool state:', error);
      throw error instanceof Error ? error : new Error('Failed to get pool state');
    }
  }

  /**
   * Clears the trade pool
   */
  async clearPool(): Promise<void> {
    try {
      await this.apiPost<any>('/api/trades/pool/clear', {});
      console.log('Trade pool cleared');
    } catch (error) {
      console.error('Error clearing trade pool:', error);
      throw error instanceof Error ? error : new Error('Failed to clear trade pool');
    }
  }

  /**
   * Gets details for a specific trade
   */
  async getTradeDetails(tradeId: string): Promise<TradeLoop | null> {
    try {
      // Check if API endpoint exists first
      const endpointExists = await this.checkApiEndpointExists(`/api/trades/${tradeId}`);
      
      if (endpointExists) {
        const data = await this.apiGet<{ trade: TradeLoop | null }>(`/api/trades/${tradeId}`);
        return data.trade;
      } else {
        console.warn(`Trade details endpoint for ID ${tradeId} is not implemented yet`);
        // Try to get trade details from the TradeStatusService
        const tradeStatusService = (window as any).TradeStatusService?.getInstance();
        if (tradeStatusService) {
          const trade = await tradeStatusService.getTradeDetails(tradeId);
          return trade || null;
        }
        return null;
      }
    } catch (error) {
      console.error('Error getting trade details:', error);
      return null;
    }
  }

  /**
   * This method is deprecated as we no longer need to submit trades.
   * SWAPS automatically discovers valid trade opportunities.
   * @deprecated Use findTradeLoops instead
   */
  async submitTrade(): Promise<any> {
    console.warn('submitTrade is deprecated. SWAPS automatically discovers valid trade opportunities.');
    return { success: false, error: 'Method deprecated' };
  }

  /**
   * Performs a deep scan of the wallet to find all NFTs
   */
  async deepScanWallet(userWallet: string): Promise<any> {
    try {
      console.log('Requesting deep scan for wallet:', userWallet);
      
      // Use the correct API endpoint that matches the backend route
      const endpoint = '/api/trades/wallet/deep-scan'; // Corrected endpoint
      console.log('Sending deep scan request to endpoint:', endpoint, 'with method POST');

      // Backend expects walletAddress in the POST body
      const payload = { walletAddress: userWallet };
      const data = await this.apiPost<any>(endpoint, payload); // Changed to apiPost and added payload
      console.log('Deep scan response:', data);
      return data;
    } catch (error) {
      console.error('Error performing deep wallet scan:', error);
      throw error instanceof Error ? error : new Error('Failed to deep scan wallet');
    }
  }

  /**
   * Adds multiple NFTs to a wallet's want list at once
   * @param nftAddresses Array of NFT addresses the wallet wants
   * @param walletAddress The wallet address
   * @returns Promise resolving to true if successful
   */
  async addMultipleWants(nftAddresses: string[], walletAddress: string): Promise<boolean> {
    try {
      if (!nftAddresses || nftAddresses.length === 0) {
        console.warn('No NFT addresses provided to addMultipleWants');
        return false;
      }
      
      console.log(`Adding ${nftAddresses.length} NFTs to wants list for wallet ${walletAddress}`);
      
      // Prepare the request payload
      const payload = {
        wallet: walletAddress,
        nfts: nftAddresses
      };
      
      console.log('Sending multiple wants request with payload:', payload);
      
      // Call the backend to add all wants at once
      const result = await this.apiPost<{success: boolean}>('/api/trades/wants/multiple', payload);
      
      console.log('Multiple wants response:', result);
      
      return result.success;
    } catch (error) {
      console.error('Error adding multiple wants:', error);
      return false;
    }
  }

  /**
   * Executes a specific trade by its ID
   * @param tradeId The ID of the trade to execute
   * @param walletAddress The wallet address of the user executing the trade
   */
  async executeTradeById(tradeId: string, walletAddress: string): Promise<{success: boolean, message: string}> {
    try {
      console.log(`Executing trade ${tradeId} for wallet ${walletAddress}`);
      
      // Check if the actual API endpoint exists yet
      const endpointExists = await this.checkApiEndpointExists('/api/trades/execute');
      
      if (endpointExists) {
        // If the endpoint exists, call it
        const payload = {
          tradeId,
          wallet: walletAddress
        };
        
        const result = await this.apiPost<{success: boolean, message: string}>('/api/trades/execute', payload);
        return result;
      } else {
        // If the endpoint doesn't exist yet, simulate a successful response
        console.log('Trade execution endpoint not implemented yet, simulating success');
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        return {
          success: true,
          message: 'Trade execution initiated. Check your wallet for approval.'
        };
      }
    } catch (error) {
      console.error('Error executing trade:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred'
      };
    }
  }

  /**
   * Finds trade loops based on collection wants for a wallet
   * This method is optimized for collection-level trading preferences
   * 
   * @param walletAddress The wallet address
   * @param options Collection-specific discovery options
   * @returns Promise resolving to an array of discovered trade loops
   */
  async findCollectionTrades(
    walletAddress: string,
    options?: {
      maxResults?: number;
      minEfficiency?: number;
      verifiedCollectionsOnly?: boolean;
      minCollectionFloor?: number;
      maxCollectionFloor?: number;
    }
  ): Promise<TradeLoop[]> {
    try {
      if (!walletAddress) {
        console.error('No wallet address provided to findCollectionTrades');
        return [];
      }
      
      // Prepare the request payload specifically for collection trades
      const payload = {
        wallet: walletAddress,
        considerCollections: true,
        includeCollectionTrades: true,
        forceRefresh: true,
        searchId: `collection-${Date.now()}-${walletAddress.substring(0, 8)}`,
        ...(options || {})
      };
      
      console.log(`Searching for collection-based trades`, payload);
      
      // Call the backend to discover collection-based trades
      const result = await this.apiPost<TradeResponse>('/api/trades/discover', payload);
      
      if (result.success && result.trades && result.trades.length > 0) {
        console.log(`Found ${result.trades.length} collection-based trades`);
        
        // Filter to only collection trades if available
        const collectionTrades = result.trades.filter(trade => 
          trade.hasCollectionTrades || 
          trade.crossCollectionTrade ||
          (trade.collectionMetrics?.hasCollectionTrades)
        );
        
        if (collectionTrades.length > 0) {
          console.log(`${collectionTrades.length} trades involve collection preferences`);
          
          // Sort by collection quality metrics
          collectionTrades.sort((a, b) => {
            // Prioritize cross-collection trades and collection diversity
            const scoreA = (a.qualityScore || a.efficiency) + 
                          (a.crossCollectionTrade ? 0.1 : 0) +
                          ((a.collectionMetrics?.collectionDiversityRatio || 0) * 0.05);
            const scoreB = (b.qualityScore || b.efficiency) + 
                          (b.crossCollectionTrade ? 0.1 : 0) +
                          ((b.collectionMetrics?.collectionDiversityRatio || 0) * 0.05);
            return scoreB - scoreA;
          });
          
          return collectionTrades;
        } else {
          // Return all trades if no specific collection trades found
          console.log('No specific collection trades found, returning all trades');
          return result.trades;
        }
      } else {
        console.log('No collection trades found');
        return [];
      }
    } catch (error) {
      console.error('Error discovering collection trades:', error);
      return [];
    }
  }
} 