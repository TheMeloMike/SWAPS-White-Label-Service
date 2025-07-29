import { PublicKey } from '@solana/web3.js';
import { BaseService } from './base.service';
import { NFTMetadata } from '../types/nft';

// Re-export the NFTMetadata type from types/nft
export type { NFTMetadata };

interface NFTCache {
  walletNFTs: Map<string, {
    nfts: NFTMetadata[];
    timestamp: number;
  }>;
  nftMetadata: Map<string, {
    metadata: NFTMetadata;
    timestamp: number;
  }>;
}

/**
 * Service class responsible for fetching and processing NFT metadata
 */
export class NFTService extends BaseService {
  private static instance: NFTService;
  private cache: NFTCache = {
    walletNFTs: new Map(),
    nftMetadata: new Map(),
  };
  
  // Cache expiration times (in milliseconds)
  private readonly WALLET_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly METADATA_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  private constructor() {
    super();
  }

  public static getInstance(): NFTService {
    if (!NFTService.instance) {
      NFTService.instance = new NFTService();
    }
    return NFTService.instance;
  }

  /**
   * Clears the entire cache or specific wallet data
   */
  public clearCache(walletAddress?: string): void {
    if (walletAddress) {
      this.cache.walletNFTs.delete(walletAddress);
      console.log(`Cleared NFT cache for wallet: ${walletAddress}`);
    } else {
      this.cache.walletNFTs.clear();
      this.cache.nftMetadata.clear();
      console.log('Cleared all NFT caches');
    }
  }

  /**
   * Gets NFTs for a specific wallet, using cache if available and not expired
   */
  async getWalletNFTs(walletAddress: string, forceRefresh = false): Promise<NFTMetadata[]> {
    // Check if we have cached data that's still fresh
    const cachedData = this.cache.walletNFTs.get(walletAddress);
    const now = Date.now();
    
    if (
      !forceRefresh && 
      cachedData && 
      now - cachedData.timestamp < this.WALLET_CACHE_TTL
    ) {
      console.log(`Using cached NFTs for wallet ${walletAddress}`);
      return cachedData.nfts;
    }
    
    console.log(`Fetching NFTs for wallet ${walletAddress}`);
    
    try {
      // Make the API request with type annotation
      const data = await this.apiGet<{success: boolean, nfts: NFTMetadata[] | string[]}>(`/api/nfts/wallet/${walletAddress}`);
      
      if (!data || !data.nfts) {
        console.error('Invalid response format from NFT API');
        return [];
      }
      
      // Check if the response contains full NFT metadata objects or just addresses
      let fullNftData: NFTMetadata[] = [];
      
      // If the first item is a string, we assume it's just NFT addresses
      if (data.nfts.length > 0 && typeof data.nfts[0] === 'string') {
        console.log('API returned only NFT addresses. Fetching full metadata...');
        
        // Cast to string array
        const nftAddresses = data.nfts as string[];
        
        // Fetch metadata for each NFT
        const metadataPromises = nftAddresses.map(async (address: string) => {
          try {
            return await this.getNFTMetadata(address);
          } catch (error) {
            console.error(`Error fetching metadata for NFT ${address}:`, error);
            // Return a minimal NFT object if metadata fetch fails
            return {
              address: address,
              name: `NFT ${address.substring(0, 6)}...`,
              symbol: '',
              image: ''
            };
          }
        });
        
        fullNftData = await Promise.all(metadataPromises);
      } else {
        // We already have full NFT objects
        fullNftData = data.nfts as NFTMetadata[];
      }
      
      // Update cache
      this.cache.walletNFTs.set(walletAddress, {
        nfts: fullNftData,
        timestamp: now
      });
      
      // Also cache individual NFT metadata for faster lookup
      fullNftData.forEach((nft: NFTMetadata) => {
        if (nft.address) {
          this.cache.nftMetadata.set(nft.address, {
            metadata: nft,
            timestamp: now
          });
        }
      });
      
      return fullNftData;
    } catch (error) {
      console.error('Error fetching wallet NFTs:', error);
      
      // If we have expired cached data, return it as fallback
      if (cachedData) {
        console.warn(`Using expired cache for wallet ${walletAddress} as fallback`);
        return cachedData.nfts;
      }
      
      throw error;
    }
  }
  
  /**
   * Gets metadata for a specific NFT, using cache if available
   */
  async getNFTMetadata(nftAddress: string, forceRefresh = false): Promise<NFTMetadata> {
    // Check if we have cached data that's still fresh
    const cachedData = this.cache.nftMetadata.get(nftAddress);
    const now = Date.now();
    
    if (
      !forceRefresh && 
      cachedData && 
      now - cachedData.timestamp < this.METADATA_CACHE_TTL
    ) {
      console.log(`Using cached metadata for NFT ${nftAddress}`);
      return cachedData.metadata;
    }
    
    console.log(`Fetching metadata for NFT ${nftAddress}`);
    
    try {
      // Make the API request with type annotation
      const data = await this.apiGet<{metadata: NFTMetadata}>(`/api/nfts/${nftAddress}`);
      
      if (!data || !data.metadata) {
        throw new Error('Invalid response format from NFT API');
      }
      
      // Update cache
      this.cache.nftMetadata.set(nftAddress, {
        metadata: data.metadata,
        timestamp: now
      });
      
      return data.metadata;
    } catch (error) {
      console.error(`Error fetching NFT metadata for ${nftAddress}:`, error);
      
      // If we have expired cached data, return it as fallback
      if (cachedData) {
        console.warn(`Using expired cache for NFT ${nftAddress} as fallback`);
        return cachedData.metadata;
      }
      
      throw error;
    }
  }

  /**
   * Fetches metadata for multiple NFTs by addresses
   * @param addresses - Array of NFT addresses
   * @returns Promise<Map<string, NFTMetadata>> - Map of NFT metadata by address
   */
  async fetchNFTsByAddresses(addresses: string[]): Promise<Map<string, NFTMetadata>> {
    try {
      // Filter out addresses we already have in cache
      const now = Date.now();
      const uncachedAddresses = addresses.filter(addr => {
        const cached = this.cache.nftMetadata.get(addr);
        return !cached || now - cached.timestamp > this.METADATA_CACHE_TTL;
      });
      
      if (uncachedAddresses.length === 0) {
        console.log('All NFTs are in cache, no need to fetch from API');
        return new Map(addresses.map(addr => [addr, this.cache.nftMetadata.get(addr)!.metadata]));
      }
      
      console.log('Fetching metadata for uncached NFTs:', uncachedAddresses);
      const data = await this.apiPost<{ nfts: NFTMetadata[] }>(
        '/api/nfts/batch', 
        { addresses: uncachedAddresses }
      );
      
      if (!data || !Array.isArray(data.nfts)) {
        throw new Error('Invalid response format: nfts is not an array');
      }

      // Cache the results
      data.nfts.forEach(nft => this.cache.nftMetadata.set(nft.address, {
        metadata: nft,
        timestamp: now
      }));
      
      // Return all requested NFTs, both from cache and newly fetched
      return new Map(addresses.map(addr => {
        const cached = this.cache.nftMetadata.get(addr);
        return [addr, cached ? cached.metadata : null];
      }).filter(([_, nft]) => nft !== null) as [string, NFTMetadata][]);
    } catch (error) {
      console.error('Error fetching NFTs by addresses:', error);
      throw error instanceof Error ? error : new Error('Failed to fetch NFTs by addresses');
    }
  }

  /**
   * Fetches all NFTs owned by a wallet
   * @param walletAddress - The wallet address to fetch NFTs for
   * @returns Promise<NFTMetadata[]> - Array of NFT metadata
   */
  async fetchUserNFTs(walletAddress: string): Promise<NFTMetadata[]> {
    try {
      console.log('Fetching NFTs for wallet:', walletAddress);
      const data = await this.apiGet<{ success: boolean, nfts: NFTMetadata[] }>(`/api/nfts/wallet/${walletAddress}`);
      
      if (!data || !data.success || !Array.isArray(data.nfts)) {
        console.error('Invalid response format:', data);
        return [];
      }
      
      // Cache all NFTs
      const now = Date.now();
      data.nfts.forEach(nft => this.cache.nftMetadata.set(nft.address, {
        metadata: nft,
        timestamp: now
      }));
      return data.nfts;
    } catch (error) {
      console.error('Error fetching wallet NFTs:', error);
      return [];
    }
  }

  /**
   * Gets all available NFTs in the trading pool that can be requested
   */
  public async getAvailablePoolNFTs(): Promise<NFTMetadata[]> {
    try {
      console.log('Fetching available NFTs in trading pool');
      
      // Use the API_BASE directly instead of trying to find a port
      const response = await fetch(`${this.API_BASE}/api/trades/system/detailed`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch available NFTs: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success || !data.detailedState || !data.detailedState.wallets) {
        console.error('Invalid response format:', data);
        throw new Error('Invalid response format from backend');
      }
      
      // Collect all NFTs from all wallets
      const availableNFTs: NFTMetadata[] = [];
      const processedNFTs = new Set<string>(); // To avoid duplicates
      
      for (const wallet of data.detailedState.wallets) {
        // For each NFT in the wallet
        for (const nftAddress of wallet.ownedNfts) {
          // Skip if we've already processed this NFT
          if (processedNFTs.has(nftAddress)) {
            continue;
          }
          
          processedNFTs.add(nftAddress);
          
          // Fetch metadata for this NFT
          try {
            const nftMetadata = await this.getNFTMetadata(nftAddress);
            if (nftMetadata) {
              availableNFTs.push(nftMetadata);
            }
          } catch (err) {
            console.warn(`Could not fetch metadata for NFT ${nftAddress}`, err);
          }
        }
      }
      
      console.log(`Found ${availableNFTs.length} NFTs available in the trading pool`);
      return availableNFTs;
    } catch (error) {
      console.error('Error fetching available NFTs:', error);
      throw error;
    }
  }
} 