import { CollectionMetadata, CollectionSearchResult } from '../../types/trade';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { NFTService } from './NFTService';
import { NFTPricingService } from './NFTPricingService';

/**
 * Collection index data structure
 */
interface CollectionIndex {
  collections: Map<string, CollectionMetadata>;
  nftToCollection: Map<string, string>; // nft -> collection ID
  collectionToNfts: Map<string, Set<string>>; // collection -> NFTs
  searchIndex: Map<string, string[]>; // searchable terms -> collection IDs
  lastUpdated: Map<string, number>; // collection -> timestamp
}

/**
 * Service for indexing and managing NFT collection metadata
 * Provides collection search, NFT-to-collection mapping, and metadata management
 */
export class CollectionIndexingService {
  private static instance: CollectionIndexingService;
  private logger: Logger;
  private nftService: NFTService;
  private nftPricingService: NFTPricingService;
  
  // Core index data
  private index: CollectionIndex = {
    collections: new Map(),
    nftToCollection: new Map(),
    collectionToNfts: new Map(),
    searchIndex: new Map(),
    lastUpdated: new Map()
  };
  
  // Cache settings
  private readonly COLLECTION_CACHE_TTL = 60 * 60 * 1000; // 1 hour
  private readonly NFT_COLLECTION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly SEARCH_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
  
  // Search cache
  private searchCache = new Map<string, {
    results: CollectionSearchResult[];
    timestamp: number;
  }>();

  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('CollectionIndexing');
    this.nftService = NFTService.getInstance();
    this.nftPricingService = NFTPricingService.getInstance();
    
    // Start background collection metadata updates
    setInterval(() => this.updateStaleCollections(), 30 * 60 * 1000); // Every 30 minutes
    
    this.logger.info('CollectionIndexingService initialized');
  }

  public static getInstance(): CollectionIndexingService {
    if (!CollectionIndexingService.instance) {
      CollectionIndexingService.instance = new CollectionIndexingService();
    }
    return CollectionIndexingService.instance;
  }

  /**
   * Get collection ID for a specific NFT
   */
  public async getCollectionForNFT(nftAddress: string): Promise<string | null> {
    // Check cache first
    const cached = this.index.nftToCollection.get(nftAddress);
    if (cached) {
      return cached;
    }
    
    // Try to determine collection from NFT metadata
    try {
      const metadata = await this.nftService.getNFTMetadata(nftAddress);
      let collectionId: string | null = null;
      
      if (metadata.collection) {
        if (typeof metadata.collection === 'string') {
          collectionId = metadata.collection;
        } else if (metadata.collection.name) {
          collectionId = metadata.collection.name;
        }
      }
      
      // Fallback to symbol or name-based heuristic
      if (!collectionId) {
        if (metadata.symbol) {
          collectionId = metadata.symbol;
        } else if (metadata.name) {
          // Extract potential collection name from NFT name
          const nameMatch = metadata.name.match(/^([^#\d]+)/);
          if (nameMatch) {
            collectionId = nameMatch[1].trim();
          }
        }
      }
      
      if (collectionId) {
        // Cache the mapping
        this.index.nftToCollection.set(nftAddress, collectionId);
        
        // Add to collection->NFTs mapping
        if (!this.index.collectionToNfts.has(collectionId)) {
          this.index.collectionToNfts.set(collectionId, new Set());
        }
        this.index.collectionToNfts.get(collectionId)!.add(nftAddress);
        
        // Ensure we have metadata for this collection
        await this.ensureCollectionMetadata(collectionId);
        
        return collectionId;
      }
    } catch (error) {
      this.logger.error('Error determining collection for NFT', {
        nft: nftAddress,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    return null;
  }

  /**
   * Search for collections by name or symbol
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
      return cached.results;
    }
    
    const results: CollectionSearchResult[] = [];
    
    // Search through indexed collections
    for (const [collectionId, metadata] of this.index.collections) {
      const relevanceScore = this.calculateRelevanceScore(normalizedQuery, metadata);
      
      if (relevanceScore > 0) {
        const matchType = this.determineMatchType(normalizedQuery, metadata);
        results.push({
          collection: metadata,
          relevanceScore,
          matchType
        });
      }
    }
    
    // Sort by relevance score (descending)
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Limit results
    const limitedResults = results.slice(0, maxResults);
    
    // Cache results
    this.searchCache.set(cacheKey, {
      results: limitedResults,
      timestamp: Date.now()
    });
    
    this.logger.debug('Collection search completed', {
      query,
      resultsCount: limitedResults.length,
      totalChecked: this.index.collections.size
    });
    
    return limitedResults;
  }

  /**
   * Get all NFTs in a collection
   */
  public getNFTsInCollection(collectionId: string): string[] {
    const nftSet = this.index.collectionToNfts.get(collectionId);
    return nftSet ? Array.from(nftSet) : [];
  }

  /**
   * Get collection metadata by ID
   */
  public getCollectionMetadata(collectionId: string): CollectionMetadata | null {
    return this.index.collections.get(collectionId) || null;
  }

  /**
   * Get all indexed collections
   */
  public getAllCollections(): CollectionMetadata[] {
    return Array.from(this.index.collections.values());
  }

  /**
   * Index a new NFT and determine its collection
   */
  public async indexNFT(nftAddress: string): Promise<string | null> {
    return this.getCollectionForNFT(nftAddress);
  }

  /**
   * Build comprehensive collection index from a list of NFTs
   */
  public async buildCollectionIndex(nftAddresses: string[]): Promise<void> {
    const operation = this.logger.operation('buildCollectionIndex');
    operation.info('Starting collection index build', { nftCount: nftAddresses.length });
    
    let processed = 0;
    let collections = 0;
    const batchSize = 50;
    
    for (let i = 0; i < nftAddresses.length; i += batchSize) {
      const batch = nftAddresses.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (nftAddress) => {
        try {
          const collectionId = await this.getCollectionForNFT(nftAddress);
          if (collectionId) {
            collections++;
          }
          processed++;
          
          if (processed % 100 === 0) {
            operation.info(`Processed ${processed}/${nftAddresses.length} NFTs`);
          }
        } catch (error) {
          operation.error('Error indexing NFT', {
            nft: nftAddress,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }));
    }
    
    operation.info('Collection index build completed', {
      nftsProcessed: processed,
      collectionsFound: this.index.collections.size,
      nftToCollectionMappings: this.index.nftToCollection.size
    });
    
    operation.end();
  }

  /**
   * Ensure we have metadata for a collection
   */
  private async ensureCollectionMetadata(collectionId: string): Promise<void> {
    const existing = this.index.collections.get(collectionId);
    const lastUpdate = this.index.lastUpdated.get(collectionId) || 0;
    
    // Skip if we have recent data
    if (existing && Date.now() - lastUpdate < this.COLLECTION_CACHE_TTL) {
      return;
    }
    
    try {
      // Get floor price from pricing service
      let floorPrice = 0;
      try {
        floorPrice = await this.nftPricingService.getFloorPrice(collectionId) || 0;
      } catch (error) {
        this.logger.debug('No floor price available', { collection: collectionId });
      }
      
      // Get NFT count in this collection
      const nftCount = this.index.collectionToNfts.get(collectionId)?.size || 0;
      
      // Create or update metadata
      const metadata: CollectionMetadata = {
        id: collectionId,
        name: collectionId, // Use ID as name for now
        verified: false, // TODO: Implement verification logic
        floorPrice,
        volume24h: 0, // TODO: Implement volume tracking
        totalSupply: nftCount,
        nftCount,
        sources: ['internal'], // Mark as internally discovered
        lastUpdated: new Date()
      };
      
      // Store metadata
      this.index.collections.set(collectionId, metadata);
      this.index.lastUpdated.set(collectionId, Date.now());
      
      // Update search index
      this.updateSearchIndex(collectionId, metadata);
      
      this.logger.debug('Collection metadata updated', {
        collection: collectionId,
        nftCount,
        floorPrice
      });
    } catch (error) {
      this.logger.error('Error updating collection metadata', {
        collection: collectionId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Update search index for a collection
   */
  private updateSearchIndex(collectionId: string, metadata: CollectionMetadata): void {
    const searchTerms = [
      metadata.name.toLowerCase(),
      metadata.id.toLowerCase()
    ];
    
    if (metadata.symbol) {
      searchTerms.push(metadata.symbol.toLowerCase());
    }
    
    // Add partial terms for fuzzy search
    searchTerms.forEach(term => {
      for (let i = 2; i <= term.length; i++) {
        const partial = term.substring(0, i);
        if (!this.index.searchIndex.has(partial)) {
          this.index.searchIndex.set(partial, []);
        }
        
        const collections = this.index.searchIndex.get(partial)!;
        if (!collections.includes(collectionId)) {
          collections.push(collectionId);
        }
      }
    });
  }

  /**
   * Calculate relevance score for search
   */
  private calculateRelevanceScore(query: string, metadata: CollectionMetadata): number {
    let score = 0;
    const name = metadata.name.toLowerCase();
    const symbol = metadata.symbol?.toLowerCase() || '';
    
    // Exact name match
    if (name === query) {
      score += 100;
    }
    // Exact symbol match
    else if (symbol === query) {
      score += 90;
    }
    // Name starts with query
    else if (name.startsWith(query)) {
      score += 80;
    }
    // Symbol starts with query
    else if (symbol.startsWith(query)) {
      score += 70;
    }
    // Name contains query
    else if (name.includes(query)) {
      score += 50;
    }
    // Symbol contains query
    else if (symbol.includes(query)) {
      score += 40;
    }
    // Fuzzy match
    else if (this.fuzzyMatch(query, name) || this.fuzzyMatch(query, symbol)) {
      score += 20;
    }
    
    // Boost score based on collection metrics
    if (metadata.verified) score += 10;
    if (metadata.volume24h > 0) score += 5;
    if (metadata.nftCount > 100) score += 5;
    
    return score;
  }

  /**
   * Determine match type for search result
   */
  private determineMatchType(query: string, metadata: CollectionMetadata): 'exact' | 'partial' | 'fuzzy' {
    const name = metadata.name.toLowerCase();
    const symbol = metadata.symbol?.toLowerCase() || '';
    
    if (name === query || symbol === query) {
      return 'exact';
    } else if (name.includes(query) || symbol.includes(query)) {
      return 'partial';
    } else {
      return 'fuzzy';
    }
  }

  /**
   * Simple fuzzy matching
   */
  private fuzzyMatch(query: string, target: string): boolean {
    if (query.length === 0) return true;
    if (target.length === 0) return false;
    
    let queryIndex = 0;
    for (let i = 0; i < target.length && queryIndex < query.length; i++) {
      if (target[i] === query[queryIndex]) {
        queryIndex++;
      }
    }
    
    return queryIndex === query.length;
  }

  /**
   * Update stale collection metadata in background
   */
  private async updateStaleCollections(): Promise<void> {
    const now = Date.now();
    const staleCollections: string[] = [];
    
    for (const [collectionId, lastUpdate] of this.index.lastUpdated) {
      if (now - lastUpdate > this.COLLECTION_CACHE_TTL) {
        staleCollections.push(collectionId);
      }
    }
    
    if (staleCollections.length > 0) {
      this.logger.info(`Updating ${staleCollections.length} stale collections`);
      
      for (const collectionId of staleCollections) {
        try {
          await this.ensureCollectionMetadata(collectionId);
        } catch (error) {
          this.logger.error('Error updating stale collection', {
            collection: collectionId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
  }

  /**
   * Clear all cached data
   */
  public clearCache(): void {
    this.index.collections.clear();
    this.index.nftToCollection.clear();
    this.index.collectionToNfts.clear();
    this.index.searchIndex.clear();
    this.index.lastUpdated.clear();
    this.searchCache.clear();
    
    this.logger.info('Collection index cache cleared');
  }

  /**
   * Get index statistics
   */
  public getIndexStats(): {
    collections: number;
    nftMappings: number;
    searchTerms: number;
    cacheSize: number;
  } {
    return {
      collections: this.index.collections.size,
      nftMappings: this.index.nftToCollection.size,
      searchTerms: this.index.searchIndex.size,
      cacheSize: this.searchCache.size
    };
  }
} 