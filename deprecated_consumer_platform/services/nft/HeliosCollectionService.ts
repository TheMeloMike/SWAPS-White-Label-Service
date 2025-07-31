import { CollectionMetadata, CollectionSearchResult } from '../../types/trade';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import fetch from 'node-fetch';

/**
 * Service that uses Helius API directly for collection search
 * This provides comprehensive, always-fresh collection data without maintaining an internal index
 */
export class HeliusCollectionService {
  private static instance: HeliusCollectionService;
  private logger: Logger;
  
  // Cache for search results (short-lived)
  private searchCache = new Map<string, {
    results: CollectionSearchResult[];
    timestamp: number;
  }>();
  
  // Cache for collection metadata (longer-lived)
  private metadataCache = new Map<string, {
    metadata: CollectionMetadata;
    timestamp: number;
  }>();
  
  // Dynamic collection index - builds over time
  private collectionIndex = new Map<string, {
    id: string;
    name: string;
    symbol: string;
    searchTerms: string[];
    lastSeen: number;
  }>();
  
  private readonly SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly METADATA_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly INDEX_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('HeliusCollection');
    this.initializeCollectionIndex();
    this.logger.info('HeliusCollectionService initialized');
  }

  public static getInstance(): HeliusCollectionService {
    if (!HeliusCollectionService.instance) {
      HeliusCollectionService.instance = new HeliusCollectionService();
    }
    return HeliusCollectionService.instance;
  }

    /**
   * Search for collections using the background crawler database
   * Instant search against comprehensive local collection database
   */
  public async searchCollections(
    query: string,
    maxResults: number = 10
  ): Promise<CollectionSearchResult[]> {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Check search cache
    const cacheKey = `${normalizedQuery}:${maxResults}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.SEARCH_CACHE_TTL) {
      this.logger.debug('Returning cached search results', { query, resultsCount: cached.results.length });
      return cached.results;
    }
    
    const operation = this.logger.operation('searchCollections');
    operation.info('Searching collections in crawler database', { query, maxResults });
    
    try {
      // Use live Helius search since we don't have crawler database
      const results = await this.searchCollectionsViaHelius(normalizedQuery, maxResults);

      // Cache results
      this.searchCache.set(cacheKey, {
        results,
        timestamp: Date.now()
      });

      operation.info('Collection search completed via Helius', {
        query,
        resultsCount: results.length
      });

      operation.end();
      return results;

    } catch (error) {
      operation.error('Error searching collections', {
        query,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }



  /**
   * Get collection metadata by ID
   */
  public async getCollectionMetadata(collectionId: string): Promise<CollectionMetadata | null> {
    // Check cache first
    const cached = this.metadataCache.get(collectionId);
    if (cached && Date.now() - cached.timestamp < this.METADATA_CACHE_TTL) {
      return cached.metadata;
    }

    const operation = this.logger.operation('getCollectionMetadata');
    operation.info('Fetching collection metadata', { collectionId });

    try {
      // Use Helius to find assets in this collection
      const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `getCollectionAssets-${Date.now()}`,
          method: 'searchAssets',
          params: {
            grouping: [{ group_key: 'collection', group_value: collectionId }],
            page: 1,
            limit: 10, // Small sample to get metadata
            displayOptions: {
              showCollectionMetadata: true,
              showUnverifiedCollections: true,
              showNativeBalance: false
            }
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Helius API request failed with status ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        operation.warn('Helius API error', { error: data.error });
        operation.end();
        return null;
      }

      const assets = data.result?.items || [];
      if (assets.length === 0) {
        operation.warn('No assets found for collection', { collectionId });
        operation.end();
        return null;
      }

      const firstAsset = assets[0];
      const collectionName = firstAsset.content?.metadata?.collection?.name || 
                           firstAsset.collection?.name || 
                           collectionId;

      const metadata: CollectionMetadata = {
        id: collectionId,
        name: collectionName,
        symbol: firstAsset.content?.metadata?.symbol || '',
        verified: this.isVerifiedCollection(collectionId),
        floorPrice: await this.getFloorPrice(collectionId),
        volume24h: 0,
        totalSupply: assets.length, // This is a sample, real count would need separate API
        nftCount: assets.length,
        image: firstAsset.content?.links?.image || 
               firstAsset.content?.metadata?.image || '',
        sources: ['helius'],
        lastUpdated: new Date()
      };

      // Cache the metadata
      this.metadataCache.set(collectionId, {
        metadata,
        timestamp: Date.now()
      });

      operation.info('Collection metadata retrieved', { collectionId, name: collectionName });
      operation.end();
      return metadata;

    } catch (error) {
      operation.error('Error getting collection metadata', {
        collectionId,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      return null;
    }
  }

  /**
   * Get popular collections (trending/high volume)
   */
  public async getPopularCollections(limit: number = 10): Promise<CollectionSearchResult[]> {
    const operation = this.logger.operation('getPopularCollections');
    operation.info('Fetching popular collections via Helius', { limit });

    try {
      // Get a broader sample of verified/popular assets to derive collections
      const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `getPopularCollections-${Date.now()}`,
          method: 'searchAssets',
          params: {
            page: 1,
            limit: 100, // Get more assets to find diverse collections
            displayOptions: {
              showCollectionMetadata: true,
              showUnverifiedCollections: true,
              showNativeBalance: false
            },
            creatorVerified: true, // Focus on verified creators
            sortBy: {
              sortBy: 'created',
              sortDirection: 'desc'
            }
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Helius API request failed with status ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        operation.warn('Helius API error', { error: data.error });
        throw new Error(`Helius API error: ${data.error.message}`);
      }

      const assets = data.result?.items || [];
      
      // Group assets by collection to find the most active collections
      const collectionsMap = new Map<string, {
        collectionId: string;
        collectionName: string;
        symbol: string;
        image: string;
        assetCount: number;
        verified: boolean;
        firstAsset: any;
        totalValue: number;
      }>();

      for (const asset of assets) {
        const collectionKey = asset.grouping?.find((g: any) => g.group_key === 'collection')?.group_value;
        const collectionName = asset.content?.metadata?.collection?.name || 
                              asset.content?.metadata?.name || 
                              'Unknown Collection';
        
        if (!collectionKey || collectionName === 'Unknown Collection') continue;

        const existing = collectionsMap.get(collectionKey);
        if (existing) {
          existing.assetCount++;
        } else {
          collectionsMap.set(collectionKey, {
            collectionId: collectionKey,
            collectionName,
            symbol: asset.content?.metadata?.symbol || '',
            image: asset.content?.links?.image || asset.content?.files?.[0]?.uri || '',
            assetCount: 1,
            verified: this.isVerifiedCollection(collectionName),
            firstAsset: asset,
            totalValue: 0
          });
        }
      }

      // Convert to CollectionSearchResult format and sort by collection size/activity
      const results: CollectionSearchResult[] = Array.from(collectionsMap.values())
        .sort((a, b) => {
          // Sort by verified status first, then by asset count
          if (a.verified !== b.verified) {
            return a.verified ? -1 : 1;
          }
          return b.assetCount - a.assetCount;
        })
        .slice(0, limit)
        .map(collection => {
          const metadata: CollectionMetadata = {
            id: collection.collectionId,
            name: collection.collectionName,
            symbol: collection.symbol,
            verified: collection.verified,
            floorPrice: 0, // Would need separate pricing API
            volume24h: 0, // Would need separate volume API
            totalSupply: collection.assetCount,
            nftCount: collection.assetCount,
            image: collection.image,
            sources: ['helius'],
            lastUpdated: new Date()
          };

          // Cache the metadata
          this.metadataCache.set(collection.collectionId, {
            metadata,
            timestamp: Date.now()
          });

          return {
            collection: metadata,
            relevanceScore: collection.verified ? 100 : 80, // Higher score for verified
            matchType: 'exact' as const
          };
        });

      operation.info('Popular collections fetched', {
        collectionsFound: results.length,
        assetsProcessed: assets.length
      });

      operation.end();
      return results;

    } catch (error) {
      operation.error('Error fetching popular collections', {
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Search collections via Helius API directly
   */
  private async searchCollectionsViaHelius(query: string, maxResults: number = 10): Promise<CollectionSearchResult[]> {
    const operation = this.logger.operation('searchCollectionsViaHelius');
    operation.info('Searching collections via Helius API', { query, maxResults });

    try {
      // Search for assets that match the query
      const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `searchCollections-${Date.now()}`,
          method: 'searchAssets',
          params: {
            page: 1,
            limit: 50, // Get more assets to find diverse collections
            displayOptions: {
              showCollectionMetadata: true,
              showUnverifiedCollections: true,
              showNativeBalance: false
            }
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Helius API request failed with status ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        operation.warn('Helius API error', { error: data.error });
        return [];
      }

      const assets = data.result?.items || [];
      
      // Group assets by collection and filter by query
      const collectionsMap = new Map<string, {
        collectionId: string;
        collectionName: string;
        symbol: string;
        image: string;
        assetCount: number;
        verified: boolean;
        relevanceScore: number;
      }>();

      for (const asset of assets) {
        const collectionKey = asset.grouping?.find((g: any) => g.group_key === 'collection')?.group_value;
        const collectionName = asset.content?.metadata?.collection?.name || 
                              asset.content?.metadata?.name || 
                              'Unknown Collection';
        
        if (!collectionKey || collectionName === 'Unknown Collection') continue;

        // Calculate relevance score for this collection
        const relevanceScore = this.calculateRelevanceScore(query, collectionName, collectionKey);
        
        // Skip collections with very low relevance
        if (relevanceScore < 10) continue;

        const existing = collectionsMap.get(collectionKey);
        if (existing) {
          existing.assetCount++;
          // Keep the highest relevance score
          existing.relevanceScore = Math.max(existing.relevanceScore, relevanceScore);
        } else {
          collectionsMap.set(collectionKey, {
            collectionId: collectionKey,
            collectionName,
            symbol: asset.content?.metadata?.symbol || '',
            image: asset.content?.links?.image || asset.content?.files?.[0]?.uri || '',
            assetCount: 1,
            verified: this.isVerifiedCollection(collectionName),
            relevanceScore
          });
        }
      }

      // Convert to CollectionSearchResult format and sort by relevance
      const results: CollectionSearchResult[] = Array.from(collectionsMap.values())
        .sort((a, b) => {
          // Sort by relevance score first, then by verified status, then by asset count
          if (a.relevanceScore !== b.relevanceScore) {
            return b.relevanceScore - a.relevanceScore;
          }
          if (a.verified !== b.verified) {
            return a.verified ? -1 : 1;
          }
          return b.assetCount - a.assetCount;
        })
        .slice(0, maxResults)
        .map(collection => {
          const metadata: CollectionMetadata = {
            id: collection.collectionId,
            name: collection.collectionName,
            symbol: collection.symbol,
            verified: collection.verified,
            floorPrice: 0, // Would need separate pricing API
            volume24h: 0, // Would need separate volume API
            totalSupply: collection.assetCount,
            nftCount: collection.assetCount,
            image: collection.image,
            sources: ['helius'],
            lastUpdated: new Date()
          };

          // Cache the metadata
          this.metadataCache.set(collection.collectionId, {
            metadata,
            timestamp: Date.now()
          });

          return {
            collection: metadata,
            relevanceScore: collection.relevanceScore,
            matchType: this.determineMatchType(query, collection.collectionName)
          };
        });

      operation.info('Collections search via Helius completed', {
        query,
        resultsCount: results.length,
        assetsProcessed: assets.length
      });

      operation.end();
      return results;

    } catch (error) {
      operation.error('Error searching collections via Helius', {
        query,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      return [];
    }
  }

  /**
   * Calculate relevance score for search matching
   */
  private calculateRelevanceScore(query: string, collectionName: string, collectionId: string): number {
    const name = collectionName.toLowerCase();
    const id = collectionId.toLowerCase();
    let score = 0;

    // Exact matches
    if (name === query) score += 100;
    if (id === query) score += 95;
    
    // Starts with query
    if (name.startsWith(query)) score += 80;
    if (id.startsWith(query)) score += 75;
    
    // Contains query
    if (name.includes(query)) score += 50;
    if (id.includes(query)) score += 45;
    
    // Word boundary matches
    const words = name.split(/\s+/);
    for (const word of words) {
      if (word.startsWith(query)) score += 30;
      if (word === query) score += 60;
    }

    return score;
  }

  /**
   * Determine match type
   */
  private determineMatchType(query: string, collectionName: string): 'exact' | 'partial' | 'fuzzy' {
    const name = collectionName.toLowerCase();
    
    if (name === query) return 'exact';
    if (name.includes(query) || name.startsWith(query)) return 'partial';
    return 'fuzzy';
  }

  /**
   * Check if collection is verified based on known Solana verified collections
   */
  private isVerifiedCollection(collectionName: string): boolean {
    // Known verified Solana collections - in production this would come from a verified list API
    const verifiedCollections = [
      // Popular Solana NFT collections
      'DeGods', 'y00ts', 'Okay Bears', 'Solana Monkey Business', 'Famous Fox Federation',
      'Thugbirdz', 'Aurory', 'Star Atlas', 'Degenerate Ape Academy', 'SolPunks',
      'Galactic Geckos', 'Shadowy Super Coder', 'Degen Ape Academy', 'Monkey Kingdom',
      'Communi3', 'Mad Lads', 'Tensorians', 'Foxy Fam', 'ABC', 'Retardio Cousins',
      'SMB Gen2', 'Pesky Penguins', 'Catalina Whale Mixer', 'Playground Waves',
      'Jungle Cats', 'Skeleton Crew', 'Saga Monkeys', 'Blocksmith Labs',
      'Taiyo Robotics', 'Cets on Creck', 'Jikan Studios', 'The Heist',
      // Add more verified collections as needed
    ];
    
    const normalizedName = collectionName.toLowerCase().trim();
    
    return verifiedCollections.some(verified => {
      const normalizedVerified = verified.toLowerCase();
      return normalizedName.includes(normalizedVerified) || 
             normalizedVerified.includes(normalizedName) ||
             normalizedName === normalizedVerified;
    });
  }

  /**
   * Get floor price for collection (simplified)
   */
  private async getFloorPrice(collectionId: string): Promise<number> {
    // This would integrate with pricing services
    // For now, return a placeholder
    return 0;
  }



  /**
   * Get collections from index that match the search query
   */
  private async getMatchingCollectionsFromIndex(query: string): Promise<string[]> {
    const normalizedQuery = query.toLowerCase();
    const matchingIds: string[] = [];
    
    for (const [id, collection] of this.collectionIndex.entries()) {
      // Skip expired entries
      if (Date.now() - collection.lastSeen > this.INDEX_CACHE_TTL) {
        this.collectionIndex.delete(id);
        continue;
      }
      
      // Check if query matches name, symbol, or search terms
      if (collection.searchTerms.some(term => term.includes(normalizedQuery))) {
        matchingIds.push(id);
      }
    }
    
    return matchingIds;
  }

  /**
   * Get collection metadata by ID using targeted Helius call
   */
  private async getCollectionMetadataById(collectionId: string, operation: any): Promise<CollectionMetadata | null> {
    // Check metadata cache first
    const cached = this.metadataCache.get(collectionId);
    if (cached && Date.now() - cached.timestamp < this.METADATA_CACHE_TTL) {
      return cached.metadata;
    }

    try {
      // Use getAssetsByGroup which is more efficient than searchAssets
      const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `getCollection-${Date.now()}`,
          method: 'getAssetsByGroup',
          params: {
            groupKey: 'collection',
            groupValue: collectionId,
            page: 1,
            limit: 1, // Just need one asset to get collection metadata
            displayOptions: {
              showCollectionMetadata: true
            }
          },
        }),
      });

      if (!response.ok) {
        operation.warn('Failed to get assets for collection', { collectionId, status: response.status });
        return null;
      }

      const data = await response.json();
      if (data.error || !data.result?.items?.length) {
        operation.warn('No assets found for collection', { collectionId });
        return null;
      }

      const asset = data.result.items[0];
      const collectionName = asset.content?.metadata?.collection?.name || 
                           asset.content?.metadata?.name || 
                           'Unknown Collection';

      const metadata: CollectionMetadata = {
        id: collectionId,
        name: collectionName,
        symbol: asset.content?.metadata?.symbol || '',
        verified: this.isVerifiedCollection(collectionName),
        floorPrice: 0, // Would need separate pricing service
        volume24h: 0,
        totalSupply: data.result.total || 0,
        nftCount: data.result.total || 0,
        image: asset.content?.links?.image || 
               asset.content?.files?.[0]?.uri || 
               asset.content?.metadata?.image || '',
        sources: ['helius'],
        lastUpdated: new Date()
      };

      // Cache the metadata
      this.metadataCache.set(collectionId, {
        metadata,
        timestamp: Date.now()
      });

      return metadata;
    } catch (error) {
      operation.warn('Error getting collection metadata', { 
        collectionId, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }

  /**
   * Discover new collections by getting a small sample of recent assets
   */
  private async discoverNewCollections(operation: any): Promise<string[]> {
    try {
      // Get a small sample of recent assets to discover collections
      const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `discover-${Date.now()}`,
          method: 'searchAssets',
          params: {
            page: 1,
            limit: 20, // Small batch to avoid timeouts
            displayOptions: {
              showCollectionMetadata: true,
              showUnverifiedCollections: false
            },
            creatorVerified: true,
            sortBy: {
              sortBy: 'recent_action',
              sortDirection: 'desc'
            }
          },
        }),
      });

      if (!response.ok) {
        operation.warn('Discovery call failed', { status: response.status });
        return [];
      }

      const data = await response.json();
      if (data.error) {
        operation.warn('Discovery API error', { error: data.error });
        return [];
      }

      const discoveredCollections: string[] = [];
      const assets = data.result?.items || [];

      for (const asset of assets) {
        const collectionId = asset.grouping?.find((g: any) => g.group_key === 'collection')?.group_value;
        if (collectionId && !this.collectionIndex.has(collectionId)) {
          discoveredCollections.push(collectionId);
        }
      }

      operation.info('Discovered new collections', { count: discoveredCollections.length });
      return discoveredCollections;

    } catch (error) {
      operation.warn('Error discovering collections', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return [];
    }
  }

  /**
   * Add collections to the index for future searches
   */
  private async addCollectionsToIndex(collectionIds: string[]): Promise<void> {
    for (const collectionId of collectionIds) {
      try {
        const metadata = await this.getCollectionMetadataById(collectionId, { warn: () => {} });
        if (metadata && metadata.name !== 'Unknown Collection') {
          // Create search terms from name and symbol
          const symbol = metadata.symbol || '';
          const searchTerms = [
            metadata.name.toLowerCase(),
            symbol.toLowerCase(),
            ...metadata.name.toLowerCase().split(/\s+/), // Individual words
            ...symbol.toLowerCase().split(/\s+/)
          ].filter(term => term.length > 0);

          this.collectionIndex.set(collectionId, {
            id: collectionId,
            name: metadata.name,
            symbol: symbol,
            searchTerms,
            lastSeen: Date.now()
          });
        }
      } catch (error) {
        // Silently continue - this is best effort indexing
        continue;
      }
    }
  }

  /**
   * Get the current size of the collection index
   */
  private getCollectionIndexSize(): number {
    return this.collectionIndex.size;
  }

  /**
   * Initialize the collection index with some well-known collections
   */
  private initializeCollectionIndex(): void {
    // Seed with popular Solana collection IDs - these will be expanded over time
    const wellKnownCollections = [
      { id: 'SMBtHCCC6RYRutFEPb4gZqeBLUZbMNhRKaMKZZLHi7W', name: 'Solana Monkey Business', symbol: 'SMB' },
      { id: 'J1S9H3QjnRtBbbuD4HjPV6RpRhwuk4zKbxsnCHuTgh9w', name: 'DeGods', symbol: 'DEGODS' },
      { id: 'DRiP2Pn2K6fuMLKQmt5rZWyHiUZ6WK3GChEySUpHSS4x', name: 'DRiP', symbol: 'DRIP' },
      { id: 'BUjZjAS2vbbb65g7Z1Ca9ZRVYoJscURG5L3AkVvHP9ac', name: 'Famous Fox Federation', symbol: 'FFF' },
      { id: '4mKSoDDqApmF1DqXvVTSL6tu2zixrSSNjqMxUnwvVzy2', name: 'Okay Bears', symbol: 'OKAY' },
      { id: 'GUfCR9mK6azb9vcpsxgXyj7XRPAKJd4KMHTTVvtncGgp', name: 'Mad Lads', symbol: 'MAD' },
      { id: 'DSwfRF1jhhu6HpSuzaig1G19kzP73PfLZBPLofkw6fLD', name: 'The Heist', symbol: 'HEIST' },
      { id: 'CKEY4sUpt9Bpk3P2PfYqUfBbAeLevJ4PFMLqy43a5TT8', name: 'Aurory', symbol: 'AURY' },
      { id: '7C8XtpmDdvnHJk8a3ZKPLfhbhAzhjNTbXTQKyDpvLFvC', name: 'Thugbirdz', symbol: 'THUG' },
      { id: 'BKipkearSqAUdNKa1WDstvcMjoPsSKBuNyvKDQDDu9WE', name: 'Taiyo Robotics', symbol: 'TAIYO' }
    ];

    for (const collection of wellKnownCollections) {
      const searchTerms = [
        collection.name.toLowerCase(),
        collection.symbol.toLowerCase(),
        ...collection.name.toLowerCase().split(/\s+/),
        ...collection.symbol.toLowerCase().split(/\s+/)
      ].filter(term => term.length > 0);

      this.collectionIndex.set(collection.id, {
        id: collection.id,
        name: collection.name,
        symbol: collection.symbol,
        searchTerms,
        lastSeen: Date.now()
      });
    }

    this.logger.info('Collection index initialized', { size: this.collectionIndex.size });
  }

  /**
   * Clear caches
   */
  public clearCache(): void {
    this.searchCache.clear();
    this.metadataCache.clear();
    this.collectionIndex.clear();
    this.logger.info('Helius collection service caches cleared');
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    searchCacheSize: number;
    metadataCacheSize: number;
    indexSize: number;
  } {
    return {
      searchCacheSize: this.searchCache.size,
      metadataCacheSize: this.metadataCache.size,
      indexSize: this.collectionIndex.size
    };
  }
} 