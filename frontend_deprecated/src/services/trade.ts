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
   * 
   * @param nft The NFT the wallet is interested in
   * @param walletAddress The wallet address
   * @returns Promise resolving to an array of discovered trade loops
   */
  async findTradeLoops(nft: NFTMetadata, walletAddress: string): Promise<TradeLoop[]> {
    try {
      // Prepare the request payload
      // It still sends the specific NFT context for potential backend use or logging
      const payload = {
        wallet: walletAddress,
        nft: nft.address,
        forceRefresh: 'true' // Keep forceRefresh to ensure backend checks latest state
      };
      
      console.log('Sending trade discovery request with payload:', payload);
      
      // Call the backend to discover potential trades based on wants already registered on the backend
      const result = await this.apiPost<TradeResponse>('/api/trades/discover', payload);
      
      // === Log the raw response immediately ===
      console.log('Received trade discovery response RAW:', JSON.stringify(result, null, 2)); 
      if (result.trades && result.trades.length > 0) {
        console.log('Image URL for first NFT in first trade:', result.trades[0]?.steps[0]?.nfts[0]?.image);
      }
      // === End logging ===
      
      console.log('Received trade discovery response:', result);
      
      if (result.success) {
        // Map the returned trades to our trade loop model
        return result.trades || [];
      } else {
        console.error('Error response from trade discovery:', result);
        return [];
      }
    } catch (error) {
      console.error('Error discovering trades:', error);
      throw error;
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
      console.log('Sending deep scan request to endpoint:', `/api/trades/scan/${userWallet}`);

      const data = await this.apiGet<any>(`/api/trades/scan/${userWallet}`);
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
} 