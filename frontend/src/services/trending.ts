import { TrendingData } from '@/types/trending';
import { BaseService } from './base.service';
import cache from '@/utils/caching';
import { NFTService } from './nft';

export class TrendingService extends BaseService {
  private static instance: TrendingService;
  private readonly CACHE_KEY_TRENDING = 'trending_data';
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly CACHE_STALE_TTL = 30 * 60 * 1000; // 30 minutes - time to keep stale cache
  private fetchPromise: Promise<TrendingData | null> | null = null;

  private constructor() {
    super();
  }

  public static getInstance(): TrendingService {
    if (!TrendingService.instance) {
      TrendingService.instance = new TrendingService();
    }
    return TrendingService.instance;
  }

  /**
   * Fetches trending NFT data with cache support
   * @returns Promise with trending NFT data
   */
  async getTrendingData(): Promise<TrendingData | null> {
    // If there's already a fetch in progress, wait for it to complete
    if (this.fetchPromise) {
      console.log('Reusing in-flight trending data request');
      return this.fetchPromise;
    }
    
    // Try to get data from cache first (fresh cache)
    const cachedData = cache.get<TrendingData>(this.CACHE_KEY_TRENDING);
    if (cachedData) {
      console.log('Using cached trending data');
      
      // Trigger a background refresh if the cache is older than half its TTL
      // but don't wait for it to complete
      const cacheAge = cache.getAge(this.CACHE_KEY_TRENDING);
      if (cacheAge && cacheAge > this.CACHE_TTL / 2) {
        console.log('Refreshing trending data in background');
        this.refreshTrendingDataInBackground();
      }
      
      return cachedData;
    }
    
    // Get stale cache in case fetching fails
    const staleCachedData = cache.get<TrendingData>(`${this.CACHE_KEY_TRENDING}_stale`);
    
    // Start the fetch and cache the promise to prevent duplicate requests
    try {
      this.fetchPromise = this.fetchTrendingData();
      const data = await this.fetchPromise;
      
      if (!data && staleCachedData) {
        console.log('Fresh fetch failed, using stale cached data');
        return staleCachedData;
      }
      
      return data;
    } finally {
      // Clear the promise reference after it completes
      this.fetchPromise = null;
    }
  }
  
  /**
   * Internal method to fetch trending data from the API
   */
  private async fetchTrendingData(): Promise<TrendingData | null> {
    try {
      console.log('Frontend TrendingService: Fetching trending data...');
      const response = await this.apiGet<{ success: boolean; data: TrendingData; message?: string }>('/api/trending');
      
      if (response.success && response.data) {
        console.log('Frontend TrendingService: Received trending data:', response.data);
        
        // Save current cache as stale before updating
        const currentCache = cache.get<TrendingData>(this.CACHE_KEY_TRENDING);
        if (currentCache) {
          cache.set(`${this.CACHE_KEY_TRENDING}_stale`, currentCache, { ttl: this.CACHE_STALE_TTL });
        }
        
        // Enhance the metadata by prefetching NFT metadata
        const enhancedData = await this.enhanceTrendingData(response.data);
        
        // Cache the successful response
        cache.set(this.CACHE_KEY_TRENDING, enhancedData, { ttl: this.CACHE_TTL });
        
        return enhancedData;
      }
      
      console.error('Failed to fetch trending data:', response.message || 'No data returned');
      return null;
    } catch (error) {
      console.error('Error in Frontend TrendingService fetching trending data:', error);
      return null;
    }
  }
  
  /**
   * Trigger a background refresh of trending data
   */
  private refreshTrendingDataInBackground(): void {
    // Only start refresh if there isn't one already in progress
    if (!this.fetchPromise) {
      this.fetchPromise = this.fetchTrendingData().catch(err => {
        console.error('Background trending data refresh failed:', err);
        return null;
      }).finally(() => {
        this.fetchPromise = null;
      });
    }
  }
  
  /**
   * Enhance trending data by prefetching NFT metadata
   */
  private async enhanceTrendingData(data: TrendingData): Promise<TrendingData> {
    // Create a copy to avoid modifying the original object
    const enhancedData = { ...data };
    
    try {
      // Collect all NFT addresses
      const nftAddresses: string[] = [];
      
      // Add addresses from wanted NFTs
      enhancedData.topWantedNfts.forEach(nft => {
        if (!nftAddresses.includes(nft.nftAddress)) {
          nftAddresses.push(nft.nftAddress);
        }
      });
      
      // Add addresses from loop items that are NFTs
      enhancedData.topLoopItems.forEach(item => {
        if (item.itemType === 'NFT' && !nftAddresses.includes(item.itemId)) {
          nftAddresses.push(item.itemId);
        }
      });
      
      // Only proceed if we have NFT addresses to fetch
      if (nftAddresses.length > 0) {
        const nftService = NFTService.getInstance();
        const metadataMap = await nftService.fetchNFTsByAddresses(nftAddresses);
        
        // Enhance wanted NFTs with metadata
        enhancedData.topWantedNfts = enhancedData.topWantedNfts.map(nft => {
          const metadata = metadataMap.get(nft.nftAddress);
          if (metadata) {
            return { ...nft, metadata: metadata };
          }
          return nft;
        });
        
        // Enhance loop items with metadata
        enhancedData.topLoopItems = enhancedData.topLoopItems.map(item => {
          if (item.itemType === 'NFT') {
            const metadata = metadataMap.get(item.itemId);
            if (metadata) {
              return { 
                ...item, 
                nftMetadata: [metadata],
                imageUrl: metadata.image
              };
            }
          }
          return item;
        });
      }
    } catch (error) {
      console.error('Error enhancing trending data with metadata:', error);
      // Return original data if enhancement fails
    }
    
    return enhancedData;
  }

  /**
   * Fetches detailed information about a specific NFT
   * @param nftAddress The address of the NFT to fetch details for
   * @returns Promise with NFT detail data
   */
  async getNFTDetails(nftAddress: string): Promise<any | null> {
    const cacheKey = `nft_details_${nftAddress}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log(`Using cached NFT details for ${nftAddress}`);
      return cachedData;
    }
    
    try {
      const response = await this.apiGet<{ success: boolean; data: any; message?: string }>(`/api/nft/${nftAddress}/details`);
      
      if (response.success && response.data) {
        // Cache the successful response
        cache.set(cacheKey, response.data, { ttl: this.CACHE_TTL });
        return response.data;
      }
      
      // Try to get NFT metadata directly if the details API fails
      try {
        const nftService = NFTService.getInstance();
        const metadata = await nftService.getNFTMetadata(nftAddress);
        
        if (metadata) {
          const simpleDetails = {
            nftAddress: nftAddress,
            metadata: metadata,
            wantCount: 0, // Default values
            tradeLoopCount: 0
          };
          
          // Cache this as a fallback
          cache.set(cacheKey, simpleDetails, { ttl: this.CACHE_TTL / 2 }); // Shorter TTL for fallback data
          return simpleDetails;
        }
      } catch (metadataError) {
        console.error(`Error fetching fallback metadata for ${nftAddress}:`, metadataError);
      }
      
      return null;
    } catch (error) {
      console.error(`Error fetching NFT details for ${nftAddress}:`, error);
      return null;
    }
  }
  
  /**
   * Clears trending data from cache to force a fresh fetch
   */
  clearCache(): void {
    cache.remove(this.CACHE_KEY_TRENDING);
    cache.remove(`${this.CACHE_KEY_TRENDING}_stale`);
    console.log('Trending data cache cleared');
  }
} 