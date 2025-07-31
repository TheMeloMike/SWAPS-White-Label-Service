import fs from 'fs';
import path from 'path';
import { CollectionMetadata, CollectionSearchResult } from '../../types/trade';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { HeliusCollectionService } from './HeliosCollectionService';
import { CollectionConfigService } from '../trade/CollectionConfigService';
import { CollectionMonitoringService } from '../trade/CollectionMonitoringService';
import { CollectionExpansionMetrics } from '../../types/trade';

/**
 * Production-ready service that bridges the local collection database (14,703+ collections)
 * with the trade algorithm for scalable collection trading
 * 
 * Key Features:
 * - Direct access to enhanced collection database
 * - Real-time collection-to-NFT expansion
 * - Dynamic NFT discovery for collections
 * - Production-scale performance
 */
export class LocalCollectionService {
  private static instance: LocalCollectionService;
  private logger: Logger;
  private heliusService: HeliusCollectionService;
  private configService: CollectionConfigService;
  private monitoringService: CollectionMonitoringService;
  
  // Local collection database cache
  private collectionsCache = new Map<string, CollectionMetadata>();
  private collectionsById = new Map<string, CollectionMetadata>();
  private lastCacheUpdate = 0;
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  
  // Collection NFT expansion cache
  private collectionNftsCache = new Map<string, {
    nfts: string[];
    timestamp: number;
  }>();
  private readonly NFT_EXPANSION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('LocalCollection');
    this.heliusService = HeliusCollectionService.getInstance();
    this.configService = CollectionConfigService.getInstance();
    this.monitoringService = CollectionMonitoringService.getInstance();
    
    // Load initial collection data
    this.loadCollectionsFromDatabase();
    
    // Set up periodic cache refresh
    setInterval(() => this.refreshCollectionsCache(), 60 * 1000); // Every minute
    
    this.logger.info('LocalCollectionService initialized with enhanced database');
  }

  public static getInstance(): LocalCollectionService {
    if (!LocalCollectionService.instance) {
      LocalCollectionService.instance = new LocalCollectionService();
    }
    return LocalCollectionService.instance;
  }

  /**
   * Get all NFTs available for trading in a specific collection
   * This is the KEY method for collection want expansion in trade loops
   */
  public async getNFTsInCollection(
    collectionId: string,
    availableNftOwnership?: Map<string, string>
  ): Promise<string[]> {
    const operation = this.logger.operation('getNFTsInCollection');
    const startTime = performance.now();
    
    try {
      // Check if collections are enabled
      const config = this.configService.getConfig();
      if (!config.enabled) {
        operation.warn('Collection wants are disabled');
        operation.end();
        return [];
      }
      
      // Check rate limit
      const rateLimit = this.configService.checkRateLimit(`collection:${collectionId}`);
      if (!rateLimit.allowed) {
        operation.warn('Rate limit exceeded for collection', {
          collection: collectionId,
          resetTime: rateLimit.resetTime
        });
        operation.end();
        return [];
      }
      
      // Add overall timeout protection for the entire operation
      const timeoutPromise = new Promise<string[]>((_, reject) => {
        setTimeout(() => reject(new Error('Collection NFT discovery timed out')), config.apiTimeout);
      });
      
      const discoveryPromise = this.performNFTDiscovery(collectionId, availableNftOwnership, operation, config);
      
      const nfts = await Promise.race([discoveryPromise, timeoutPromise]);
      
      const endTime = performance.now();
      const expansionTime = endTime - startTime;
      
      // Record metrics
      const metrics: CollectionExpansionMetrics = {
        collectionId,
        originalSize: nfts.length,
        expandedSize: nfts.length,
        expansionTime,
        hitRateLimit: false,
        usedSampling: false,
        timestamp: new Date()
      };
      
      this.configService.recordExpansionMetrics(metrics);
      this.monitoringService.monitorExpansion(collectionId, metrics);
      
      return nfts;
    } catch (error) {
      const endTime = performance.now();
      
      // Record failed expansion
      const metrics: CollectionExpansionMetrics = {
        collectionId,
        originalSize: 0,
        expandedSize: 0,
        expansionTime: endTime - startTime,
        hitRateLimit: false,
        usedSampling: false,
        timestamp: new Date()
      };
      
      this.configService.recordExpansionMetrics(metrics);
      this.monitoringService.recordExpansionFailure(
        collectionId,
        error instanceof Error ? error : new Error(String(error)),
        { availableNftOwnership: !!availableNftOwnership }
      );
      
      operation.error('Collection NFT discovery failed', {
        collection: collectionId,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      
      // Return empty array instead of throwing
      return [];
    }
  }

  /**
   * Internal method to perform the actual NFT discovery
   */
  private async performNFTDiscovery(
    collectionId: string,
    availableNftOwnership?: Map<string, string>,
    operation?: any,
    config?: any
  ): Promise<string[]> {
    // Check cache first
    const cached = this.collectionNftsCache.get(collectionId);
    if (cached && Date.now() - cached.timestamp < this.NFT_EXPANSION_CACHE_TTL) {
      const availableNfts = availableNftOwnership ? 
        cached.nfts.filter(nft => availableNftOwnership.has(nft)) : 
        cached.nfts;
      
      if (operation) {
        operation.info('Returning cached NFTs for collection', {
          collection: collectionId,
          totalNfts: cached.nfts.length,
          availableNfts: availableNfts.length
        });
        operation.end();
      }
      return availableNfts;
    }

    try {
      // Use Helius to discover NFTs in this collection dynamically
      let nfts = await this.discoverNFTsInCollection(collectionId, config);
      
      // Check if we need to use sampling
      if (config && this.configService.shouldUseSampling(nfts.length)) {
        const sampleSize = this.configService.getSampleSize(nfts.length);
        const sampledNfts = this.sampleNFTs(nfts, sampleSize);
        
        if (operation) {
          operation.info('Using sampling for large collection', {
            collection: collectionId,
            originalSize: nfts.length,
            sampleSize: sampledNfts.length
          });
        }
        
        // Update metrics to reflect sampling
        const metrics: CollectionExpansionMetrics = {
          collectionId,
          originalSize: nfts.length,
          expandedSize: sampledNfts.length,
          sampledSize: sampledNfts.length,
          expansionTime: 0, // Will be set by caller
          hitRateLimit: false,
          usedSampling: true,
          timestamp: new Date()
        };
        
        this.configService.recordExpansionMetrics(metrics);
        
        nfts = sampledNfts;
      }
      
      // Cache the result
      this.collectionNftsCache.set(collectionId, {
        nfts,
        timestamp: Date.now()
      });
      
      // Filter by available NFTs if ownership map provided
      const availableNfts = availableNftOwnership ? 
        nfts.filter(nft => availableNftOwnership.has(nft)) : 
        nfts;
      
      if (operation) {
        operation.info('Discovered NFTs for collection', {
          collection: collectionId,
          totalDiscovered: nfts.length,
          availableForTrade: availableNfts.length
        });
        operation.end();
      }
      
      return availableNfts;
      
    } catch (error) {
      if (operation) {
        operation.error('Error getting NFTs for collection', {
          collection: collectionId,
          error: error instanceof Error ? error.message : String(error)
        });
        operation.end();
      }
      return [];
    }
  }

  /**
   * Sample NFTs from a large collection
   */
  private sampleNFTs(nfts: string[], sampleSize: number): string[] {
    if (nfts.length <= sampleSize) {
      return nfts;
    }
    
    // Use reservoir sampling for fair random selection
    const sampled: string[] = [];
    
    // Fill reservoir with first sampleSize elements
    for (let i = 0; i < sampleSize; i++) {
      sampled.push(nfts[i]);
    }
    
    // Replace elements with gradually decreasing probability
    for (let i = sampleSize; i < nfts.length; i++) {
      const j = Math.floor(Math.random() * (i + 1));
      if (j < sampleSize) {
        sampled[j] = nfts[i];
      }
    }
    
    return sampled;
  }

  /**
   * Dynamically discover NFTs in a collection using Helius
   */
  private async discoverNFTsInCollection(collectionId: string, config?: any): Promise<string[]> {
    const nfts: string[] = [];
    const maxBatchSize = config?.batchSize || 100;
    
    try {
      // Add timeout control for Helius API calls
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config?.apiTimeout || 5000);
      
      // Use Helius searchAssets to find NFTs in this collection
      const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `getNFTsInCollection-${Date.now()}`,
          method: 'searchAssets',
          params: {
            grouping: [{ group_key: 'collection', group_value: collectionId }],
            page: 1,
            limit: maxBatchSize, // Use configured batch size
            displayOptions: {
              showNativeBalance: false,
              showInscription: false,
              showCollectionMetadata: false
            }
          },
        }),
        signal: controller.signal // Add abort signal
      });

      clearTimeout(timeoutId); // Clear timeout on success

      if (response.ok) {
        const data = await response.json();
        
        if (data.result && data.result.items) {
          for (const asset of data.result.items) {
            if (asset.id) {
              nfts.push(asset.id);
              
              // Stop if we've reached the max collection size
              if (config && nfts.length >= config.maxCollectionSize) {
                this.logger.info('Reached max collection size limit', {
                  collection: collectionId,
                  limit: config.maxCollectionSize
                });
                break;
              }
            }
          }
          
          // If there are more pages and we haven't hit the limit, we could fetch more
          // For now, we'll stick with the first batch to avoid excessive API calls
          if (data.result.total > maxBatchSize && (!config || nfts.length < config.maxCollectionSize)) {
            this.logger.info('Collection has more NFTs than single batch', {
              collection: collectionId,
              total: data.result.total,
              fetched: nfts.length
            });
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.warn('Helius API call timed out', {
          collection: collectionId,
          message: 'Using fallback methods'
        });
      } else {
        this.logger.error('Error discovering NFTs in collection via Helius', {
          collection: collectionId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Fallback: Try using collection symbol as mint authority pattern
    if (nfts.length === 0) {
      try {
        const symbolSearchNfts = await this.searchNFTsBySymbol(collectionId, config);
        nfts.push(...symbolSearchNfts);
      } catch (error) {
        this.logger.debug('Symbol-based NFT search also failed', { collection: collectionId });
      }
    }
    
    // Final fallback: Return empty array to prevent blocking
    return nfts;
  }

  /**
   * Fallback: Search NFTs by collection symbol/name pattern
   */
  private async searchNFTsBySymbol(collectionId: string, config?: any): Promise<string[]> {
    const nfts: string[] = [];
    
    // This is a simplified fallback - in production, you might want to 
    // use additional APIs or indexing services
    try {
      // Add timeout control for fallback API calls
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout for fallback
      
      const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `searchBySymbol-${Date.now()}`,
          method: 'searchAssets',
          params: {
            page: 1,
            limit: 50, // Reduced limit for faster fallback
            displayOptions: {
              showNativeBalance: false
            },
            tokenType: 'NonFungible',
            creatorAddress: collectionId // Try using collectionId as creator
          },
        }),
        signal: controller.signal // Add abort signal
      });

      clearTimeout(timeoutId); // Clear timeout on success

      if (response.ok) {
        const data = await response.json();
        if (data.result && data.result.items) {
          for (const asset of data.result.items) {
            if (asset.id) {
              nfts.push(asset.id);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.debug('Fallback API call timed out', { collection: collectionId });
      }
      // Silent failure for fallback method - don't log errors
    }
    
    return nfts;
  }

  /**
   * Load collections from the enhanced local database
   */
  private loadCollectionsFromDatabase(): void {
    try {
      // Try multiple possible paths for the collections database
      const possiblePaths = [
        path.join(process.cwd(), 'Crawler-data', 'collections.json'),
        path.join(process.cwd(), 'data', 'collections.json'),
        path.join(process.cwd(), '..', 'Crawler-data', 'collections.json'),
        path.join(__dirname, '..', '..', '..', 'Crawler-data', 'collections.json'),
        path.join(__dirname, '..', '..', '..', '..', 'Crawler-data', 'collections.json')
      ];
      
      this.logger.info('Attempting to load collections database', {
        currentWorkingDirectory: process.cwd(),
        dirname: __dirname,
        possiblePaths
      });
      
      let dataPath: string | null = null;
      for (const possiblePath of possiblePaths) {
        this.logger.debug('Checking path:', { path: possiblePath, exists: fs.existsSync(possiblePath) });
        if (fs.existsSync(possiblePath)) {
          dataPath = possiblePath;
          break;
        }
      }
      
      if (!dataPath) {
        this.logger.warn('Local collections database not found in any expected location', { 
          searchedPaths: possiblePaths 
        });
        return;
      }
      
      this.logger.info('Loading collections database from', { path: dataPath });
      
      const fileContent = fs.readFileSync(dataPath, 'utf8');
      const collectionsData = JSON.parse(fileContent);
      
      this.logger.info('Collections file loaded', {
        fileSize: fileContent.length,
        isArray: Array.isArray(collectionsData),
        objectKeys: Array.isArray(collectionsData) ? collectionsData.length : Object.keys(collectionsData).length
      });
      
      // Handle both object and array formats
      let collectionsArray: any[];
      if (Array.isArray(collectionsData)) {
        collectionsArray = collectionsData;
      } else {
        // Convert object to array
        collectionsArray = Object.values(collectionsData);
      }
      
      this.logger.info('Processing collections array', {
        totalCollections: collectionsArray.length
      });
      
      // Convert array to maps for fast lookup
      this.collectionsCache.clear();
      this.collectionsById.clear();
      
      let processedCount = 0;
      let collectionsWithFloorPrice = 0;
      
      for (const collection of collectionsArray) {
        try {
          const metadata: CollectionMetadata = {
            id: collection.id || collection.symbol || collection.name,
            name: collection.name || collection.symbol || collection.id,
            symbol: collection.symbol || '',
            verified: collection.verified || false,
            floorPrice: this.parseFloorPrice(collection.floorPrice),
            volume24h: collection.volume24h || 0,
            totalSupply: collection.totalSupply || collection.nftCount || 0,
            nftCount: collection.nftCount || collection.totalSupply || 0,
            image: collection.image || collection.imageUrl || '',
            sources: collection.sources || ['local'],
            lastUpdated: collection.lastUpdated ? new Date(collection.lastUpdated) : new Date()
          };
          
          // Store by ID (primary key)
          this.collectionsById.set(metadata.id, metadata);
          
          // Store by name for search (secondary index)
          this.collectionsCache.set(metadata.name.toLowerCase(), metadata);
          
          // Also store by symbol if different (tertiary index)
          if (metadata.symbol && metadata.symbol !== metadata.name && metadata.symbol.toLowerCase() !== metadata.name.toLowerCase()) {
            this.collectionsCache.set(metadata.symbol.toLowerCase(), metadata);
          }
          
          processedCount++;
          if (metadata.floorPrice > 0) {
            collectionsWithFloorPrice++;
          }
          
          // Log progress for large datasets
          if (processedCount % 5000 === 0) {
            this.logger.info('Processing collections...', {
              processed: processedCount,
              total: collectionsArray.length,
              withFloorPrice: collectionsWithFloorPrice
            });
          }
        } catch (error) {
          this.logger.warn('Failed to process collection', {
            collection: collection.id || collection.name || 'unknown',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      this.lastCacheUpdate = Date.now();
      
      this.logger.info('Collections loaded from enhanced database', {
        totalCollections: this.collectionsById.size,
        collectionsInCache: this.collectionsCache.size,
        collectionsWithFloorPrice,
        processedCount,
        databasePath: dataPath
      });
      
    } catch (error) {
      this.logger.error('Error loading collections database', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Parse floor price from various formats in the database
   */
  private parseFloorPrice(floorPrice: any): number {
    if (typeof floorPrice === 'number') {
      return floorPrice;
    }
    if (typeof floorPrice === 'string') {
      const parsed = parseFloat(floorPrice);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * Search collections from enhanced local database
   * Ultra-fast search across 14,703+ collections
   */
  public async searchCollections(
    query: string,
    maxResults: number = 10
  ): Promise<CollectionSearchResult[]> {
    this.ensureCollectionsCacheLoaded();
    
    const normalizedQuery = query.toLowerCase().trim();
    const results: CollectionSearchResult[] = [];
    const seenIds = new Set<string>(); // Track unique collection IDs to avoid duplicates
    
    // Search through unique collections using collectionsById to avoid duplicates
    for (const collection of this.collectionsById.values()) {
      // Skip if we've already processed this collection
      if (seenIds.has(collection.id)) {
        continue;
      }
      seenIds.add(collection.id);
      
      const relevanceScore = this.calculateRelevanceScore(normalizedQuery, collection);
      
      if (relevanceScore > 0) {
        const matchType = this.determineMatchType(normalizedQuery, collection);
        results.push({
          collection,
          relevanceScore,
          matchType
        });
      }
    }
    
    // Sort by relevance and return top results
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const limitedResults = results.slice(0, maxResults);
    
    this.logger.debug('Collection search completed', {
      query,
      resultsCount: limitedResults.length,
      totalSearched: this.collectionsById.size
    });
    
    return limitedResults;
  }

  /**
   * Get collection metadata by ID from local database
   */
  public getCollectionMetadata(collectionId: string): CollectionMetadata | null {
    this.ensureCollectionsCacheLoaded();
    return this.collectionsById.get(collectionId) || null;
  }

  /**
   * Get all available collections from enhanced database
   */
  public getAllCollections(): CollectionMetadata[] {
    this.ensureCollectionsCacheLoaded();
    return Array.from(this.collectionsCache.values());
  }

  /**
   * Get collection statistics for scaling insights
   */
  public getCollectionStats(): {
    totalCollections: number;
    collectionsWithFloorPrice: number;
    averageFloorPrice: number;
    totalNFTsIndexed: number;
    lastDatabaseUpdate: Date | null;
  } {
    this.ensureCollectionsCacheLoaded();
    
    let collectionsWithFloor = 0;
    let totalFloorValue = 0;
    let totalNFTs = 0;
    
    for (const collection of this.collectionsCache.values()) {
      if (collection.floorPrice > 0) {
        collectionsWithFloor++;
        totalFloorValue += collection.floorPrice;
      }
      totalNFTs += collection.nftCount || 0;
    }
    
    return {
      totalCollections: this.collectionsCache.size,
      collectionsWithFloorPrice: collectionsWithFloor,
      averageFloorPrice: collectionsWithFloor > 0 ? totalFloorValue / collectionsWithFloor : 0,
      totalNFTsIndexed: totalNFTs,
      lastDatabaseUpdate: new Date(this.lastCacheUpdate)
    };
  }

  /**
   * Calculate relevance score for collection search
   */
  private calculateRelevanceScore(query: string, collection: CollectionMetadata): number {
    let score = 0;
    const name = collection.name.toLowerCase();
    const symbol = collection.symbol?.toLowerCase() || '';
    
    // Exact matches get highest scores
    if (name === query || symbol === query) {
      score += 100;
    }
    // Prefix matches
    else if (name.startsWith(query) || symbol.startsWith(query)) {
      score += 80;
    }
    // Contains matches
    else if (name.includes(query) || symbol.includes(query)) {
      score += 50;
    }
    // Fuzzy/partial matches
    else if (this.fuzzyMatch(query, name) || this.fuzzyMatch(query, symbol)) {
      score += 20;
    }
    
    // Boost verified collections
    if (collection.verified) {
      score += 10;
    }
    
    // Boost collections with floor prices (more liquid)
    if (collection.floorPrice > 0) {
      score += 5;
    }
    
    // Boost collections with higher NFT counts (more options)
    if (collection.nftCount > 1000) {
      score += 5;
    }
    
    return score;
  }

  /**
   * Determine match type for search results
   */
  private determineMatchType(query: string, collection: CollectionMetadata): 'exact' | 'partial' | 'fuzzy' {
    const name = collection.name.toLowerCase();
    const symbol = collection.symbol?.toLowerCase() || '';
    
    if (name === query || symbol === query) {
      return 'exact';
    } else if (name.includes(query) || symbol.includes(query)) {
      return 'partial';
    } else {
      return 'fuzzy';
    }
  }

  /**
   * Simple fuzzy matching algorithm
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
   * Ensure collections cache is loaded and current
   */
  private ensureCollectionsCacheLoaded(): void {
    if (this.collectionsCache.size === 0 || 
        Date.now() - this.lastCacheUpdate > this.CACHE_TTL) {
      this.loadCollectionsFromDatabase();
    }
  }

  /**
   * Refresh collections cache from database
   */
  private refreshCollectionsCache(): void {
    if (Date.now() - this.lastCacheUpdate > this.CACHE_TTL) {
      this.loadCollectionsFromDatabase();
    }
  }

  /**
   * Get service statistics
   */
  public getStats(): {
    collectionsLoaded: number;
    nftsCached: number;
    cacheHitRate: number;
    lastRefresh: Date | null;
  } {
    let totalCacheHits = 0;
    let totalCacheRequests = 0;
    
    // Calculate cache hit rate from NFT cache
    for (const [_, cacheEntry] of this.collectionNftsCache) {
      totalCacheRequests++;
      // We'd need to track hits separately in production
    }
    
    return {
      collectionsLoaded: this.collectionsCache.size,
      nftsCached: this.collectionNftsCache.size,
      cacheHitRate: totalCacheRequests > 0 ? totalCacheHits / totalCacheRequests : 0,
      lastRefresh: new Date(this.lastCacheUpdate)
    };
  }
  
  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.collectionsCache.clear();
    this.collectionsById.clear();
    this.collectionNftsCache.clear();
    this.lastCacheUpdate = 0;
    this.logger.info('Local collection service caches cleared');
  }
} 