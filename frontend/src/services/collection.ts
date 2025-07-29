import { BaseService } from './base.service';
import { 
  CollectionSearchResult, 
  CollectionWant, 
  CollectionDiscoverySettings 
} from '../types/trade';
import { 
  CollectionMetadata, 
  CollectionSearchOptions, 
  NFTCollectionData 
} from '../types/nft';

/**
 * Service for handling collection-related operations
 */
export class CollectionService extends BaseService {
  private static instance: CollectionService;

  private constructor() {
    super();
  }

  public static getInstance(): CollectionService {
    if (!CollectionService.instance) {
      CollectionService.instance = new CollectionService();
    }
    return CollectionService.instance;
  }

  /**
   * Search for collections by name or ID
   */
  async searchCollections(
    query: string, 
    options: Partial<CollectionSearchOptions> = {}
  ): Promise<CollectionSearchResult[]> {
    try {
      console.log('Searching collections:', { query, options });
      
      const params = new URLSearchParams({
        q: query,
        limit: (options.limit || 10).toString(),
        ...(options.verified !== undefined && { verified: options.verified.toString() }),
        ...(options.minFloor !== undefined && { minFloor: options.minFloor.toString() }),
        ...(options.maxFloor !== undefined && { maxFloor: options.maxFloor.toString() }),
        ...(options.minVolume !== undefined && { minVolume: options.minVolume.toString() })
      });

      const result = await this.apiGet<{ 
        query: string;
        results: CollectionSearchResult[];
        count: number;
      } | {
        success: boolean; 
        collections: CollectionSearchResult[];
        total: number;
      }>(`/api/collections/search?${params}`);

      // Handle both response formats
      if ('success' in result && result.success) {
        console.log(`Found ${result.collections.length} collections for query: "${query}"`);
        return result.collections;
      } else if ('results' in result) {
        console.log(`Found ${result.results.length} collections for query: "${query}"`);
        return result.results;
      } else {
        console.warn('Collection search failed:', result);
        return [];
      }
    } catch (error) {
      console.error('Error searching collections:', error);
      return [];
    }
  }

  /**
   * Get detailed metadata for a specific collection
   */
  async getCollectionMetadata(collectionId: string): Promise<CollectionMetadata | null> {
    try {
      console.log('Getting collection metadata for:', collectionId);
      
      const result = await this.apiGet<{
        success: boolean;
        collection: CollectionMetadata;
      }>(`/api/collections/${encodeURIComponent(collectionId)}`);

      if (result.success && result.collection) {
        return result.collection;
      } else {
        console.warn('Collection metadata not found:', collectionId);
        return null;
      }
    } catch (error) {
      console.error('Error getting collection metadata:', error);
      return null;
    }
  }

  /**
   * Add a collection want for a wallet
   */
  async addCollectionWant(
    walletAddress: string, 
    collectionId: string, 
    preferences?: CollectionWant['preferences']
  ): Promise<boolean> {
    try {
      console.log('Adding collection want:', { walletAddress, collectionId, preferences });
      
      const payload = {
        wallet: walletAddress,  // Backend expects 'wallet' not 'walletAddress'
        collectionId,
        preferences
      };

      const result = await this.apiPost<{ success: boolean }>('/api/wants/collection', payload);

      if (result.success) {
        console.log(`Successfully added collection want: ${collectionId} for wallet: ${walletAddress}`);
        return true;
      } else {
        console.warn('Failed to add collection want:', result);
        return false;
      }
    } catch (error) {
      console.error('Error adding collection want:', error);
      return false;
    }
  }

  /**
   * Remove a collection want for a wallet
   */
  async removeCollectionWant(walletAddress: string, collectionId: string): Promise<boolean> {
    try {
      console.log('Removing collection want:', { walletAddress, collectionId });
      
      const result = await this.apiDelete<{ success: boolean }>(
        `/api/wants/collection/${encodeURIComponent(collectionId)}?wallet=${encodeURIComponent(walletAddress)}`
      );

      if (result.success) {
        console.log(`Successfully removed collection want: ${collectionId} for wallet: ${walletAddress}`);
        return true;
      } else {
        console.warn('Failed to remove collection want:', result);
        return false;
      }
    } catch (error) {
      console.error('Error removing collection want:', error);
      return false;
    }
  }

  /**
   * Get all collection wants for a wallet
   */
  async getWalletCollectionWants(walletAddress: string): Promise<CollectionWant[]> {
    try {
      console.log('Getting collection wants for wallet:', walletAddress);
      
      const result = await this.apiGet<{
        success: boolean;
        wants: CollectionWant[];
      }>(`/api/wants/collection?wallet=${encodeURIComponent(walletAddress)}`);

      if (result.success) {
        console.log(`Found ${result.wants.length} collection wants for wallet: ${walletAddress}`);
        return result.wants;
      } else {
        console.warn('Failed to get collection wants:', result);
        return [];
      }
    } catch (error) {
      console.error('Error getting collection wants:', error);
      return [];
    }
  }

  /**
   * Get popular/trending collections
   */
  async getPopularCollections(limit: number = 10): Promise<CollectionSearchResult[]> {
    try {
      console.log('Getting popular collections, limit:', limit);
      
      const result = await this.apiGet<{
        success: boolean;
        collections: CollectionSearchResult[];
      }>(`/api/collections/popular?limit=${limit}`);

      if (result.success) {
        console.log(`Found ${result.collections.length} popular collections`);
        return result.collections;
      } else {
        console.warn('Failed to get popular collections:', result);
        return [];
      }
    } catch (error) {
      console.error('Error getting popular collections:', error);
      return [];
    }
  }

  /**
   * Get collection statistics and metrics
   */
  async getCollectionStats(collectionId: string): Promise<{
    totalNFTs: number;
    ownersCount: number;
    floorPrice: number;
    volume24h: number;
    averagePrice: number;
    listedCount: number;
  } | null> {
    try {
      console.log('Getting collection stats for:', collectionId);
      
      const result = await this.apiGet<{
        success: boolean;
        stats: {
          totalNFTs: number;
          ownersCount: number;
          floorPrice: number;
          volume24h: number;
          averagePrice: number;
          listedCount: number;
        };
      }>(`/api/collections/${encodeURIComponent(collectionId)}/stats`);

      if (result.success && result.stats) {
        return result.stats;
      } else {
        console.warn('Collection stats not found:', collectionId);
        return null;
      }
    } catch (error) {
      console.error('Error getting collection stats:', error);
      return null;
    }
  }

  /**
   * Cache collection data locally for better performance
   */
  private cacheCollection(collection: CollectionSearchResult | CollectionMetadata): void {
    try {
      const cacheKey = `collection_cache_${collection.id}`;
      const cacheData = {
        ...collection,
        cachedAt: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache collection data:', error);
    }
  }

  /**
   * Get collection from cache if available and fresh
   */
  private getCachedCollection(collectionId: string): CollectionSearchResult | null {
    try {
      const cacheKey = `collection_cache_${collectionId}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const cacheData = JSON.parse(cached);
        const cacheAge = Date.now() - cacheData.cachedAt;
        
        // Cache is valid for 5 minutes
        if (cacheAge < 5 * 60 * 1000) {
          console.log('Using cached collection data for:', collectionId);
          return cacheData;
        }
      }
    } catch (error) {
      console.warn('Failed to read collection from cache:', error);
    }
    
    return null;
  }

  /**
   * Clear collection cache
   */
  clearCache(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('collection_cache_')) {
          localStorage.removeItem(key);
        }
      });
      console.log('Collection cache cleared');
    } catch (error) {
      console.warn('Failed to clear collection cache:', error);
    }
  }
} 