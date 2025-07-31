import { injectable, inject } from 'tsyringe';
import { ITradeDiscoveryService, INFTService, ILoggingService, ILogger, ICacheService } from '../types/services';
import { NFTMetadata } from '../types/nft';
import { TradeLoop } from '../types/trade'; // Assuming TradeLoop is the enriched version
import { TrendingWantedNft, TrendingLoopItem } from '../types/trending';
import { SimpleCache } from '../utils/SimpleCache';

// Define a global cache key that TradeController could use to store recent trades.
// This is an optimistic approach; TradeController would need to be updated to populate this.
export const LATEST_GLOBAL_TRADES_CACHE_KEY = 'latest_global_trades_cache';
const TRENDING_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const BACKGROUND_REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

@injectable()
export class TrendingService {
  private logger: ILogger;
  // Cache for this service's own computations
  private internalCache = new SimpleCache<any>();
  // This is a shared cache instance. Ideally, this would be a DI service itself.
  // For now, we assume TradeController can access and update this specific key if needed.
  private sharedTradeCache = new SimpleCache<TradeLoop[]>(); 
  private backgroundRefreshInterval: NodeJS.Timeout | null = null;

  constructor(
    @inject("ITradeDiscoveryService") private tradeDiscoveryService: ITradeDiscoveryService,
    @inject("INFTService") private nftService: INFTService,
    @inject("ILoggingService") private loggingServiceInstance: ILoggingService,
    @inject("ICacheService") private cacheService: ICacheService
  ) {
    this.logger = this.loggingServiceInstance.createLogger('TrendingService');
    this.logger.info('TrendingService initialized');
  }

  /**
   * Initialize the service and start background refresh tasks
   * This should be called after dependency injection is complete
   */
  public initialize(): void {
    this.startBackgroundRefresh();
    this.logger.info('TrendingService initialized with background refresh');
  }

  /**
   * Starts background refresh of trending data
   */
  private startBackgroundRefresh(intervalMs: number = BACKGROUND_REFRESH_INTERVAL_MS): void {
    // Clear any existing interval
    if (this.backgroundRefreshInterval) {
      clearInterval(this.backgroundRefreshInterval);
    }
    
    this.backgroundRefreshInterval = setInterval(async () => {
      try {
        this.logger.info('Background refresh of trending data started');
        
        // First refresh NFT wants which is simpler and faster
        await this.getTrendingWantedNfts(20);
        
        // Then do the more expensive trade loop discovery
        await this.getTrendingLoopItems(100, 20);
        
        this.logger.info('Background trending data refresh completed');
      } catch (error) {
        this.logger.error(`Background refresh failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, intervalMs);
  }

  /**
   * Gets NFTs most frequently found in users' want lists.
   */
  public async getTrendingWantedNfts(limit: number = 10): Promise<TrendingWantedNft[]> {
    const cacheKey = `trending_wanted_nfts_${limit}`;
    const cached = this.internalCache.get(cacheKey) as TrendingWantedNft[] | null;
    if (cached) {
      this.logger.debug('Returning cached trending wanted NFTs');
      return cached;
    }

    this.logger.info('Calculating trending wanted NFTs');
    const walletsMap = this.tradeDiscoveryService.getWallets();
    const wantCounts: Map<string, number> = new Map();

    walletsMap.forEach(walletNode => {
      walletNode.wantedNfts.forEach((nftAddress: string) => {
        wantCounts.set(nftAddress, (wantCounts.get(nftAddress) || 0) + 1);
      });
    });

    const sortedWants = Array.from(wantCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    const trendingWanted: TrendingWantedNft[] = [];
    for (const [nftAddress, count] of sortedWants) {
      try {
        const metadata = await this.nftService.getNFTMetadata(nftAddress);
        trendingWanted.push({ nftAddress, wantCount: count, metadata });
      } catch (error: any) {
        this.logger.warn(`Failed to fetch metadata for wanted NFT ${nftAddress}: ${error.message}`);
        // Add without metadata if fetch fails, so the NFT still trends
        trendingWanted.push({ nftAddress, wantCount: count }); 
      }
    }
    
    this.internalCache.set(cacheKey, trendingWanted, TRENDING_CACHE_TTL_MS);
    return trendingWanted;
  }

  /**
   * Gets NFTs and Collections trending based on appearance in high-potential trade loops.
   * Enhanced to be self-sufficient with fallback discovery if cache is empty.
   */
  public async getTrendingLoopItems(loopCountLimit: number = 50, itemLimit: number = 10): Promise<TrendingLoopItem[]> {
    const cacheKey = `trending_loop_items_${loopCountLimit}_${itemLimit}`;
    const cached = this.internalCache.get(cacheKey) as TrendingLoopItem[] | null;
    if (cached) {
      this.logger.debug('Returning cached trending loop items');
      return cached;
    }
    this.logger.info('Calculating trending loop items');

    // Try to get from the shared cache first
    let recentGlobalLoops = this.sharedTradeCache.get(LATEST_GLOBAL_TRADES_CACHE_KEY) || 
                           this.cacheService.get(LATEST_GLOBAL_TRADES_CACHE_KEY) as TradeLoop[] || [];

    // SELF-HEALING: If no cached loops, perform our own discovery
    if (recentGlobalLoops.length === 0) {
      this.logger.info('No cached trade loops found, performing discovery');
      try {
        // Direct discovery with optimized settings for trending
        const discoveredLoops = await this.tradeDiscoveryService.findTradeLoops({
          maxResults: loopCountLimit * 2, // Request more to ensure quality
          minEfficiency: 0.5,            // Reasonable threshold
          considerCollections: true,      // Important for collection trending
          timeoutMs: 15000               // Reasonable timeout for interactive feature
        });
        
        // Enrich the loops with metadata if needed
        const enrichedLoops = await this.enrichTradeLoopsWithMetadata(discoveredLoops);
        
        if (enrichedLoops.length > 0) {
          this.logger.info(`Discovered ${enrichedLoops.length} trade loops for trending`);
          this.sharedTradeCache.set(LATEST_GLOBAL_TRADES_CACHE_KEY, enrichedLoops, TRENDING_CACHE_TTL_MS);
          this.cacheService.set(LATEST_GLOBAL_TRADES_CACHE_KEY, enrichedLoops, TRENDING_CACHE_TTL_MS);
          recentGlobalLoops = enrichedLoops;
        }
      } catch (error) {
        this.logger.error(`Failed to discover trade loops: ${error instanceof Error ? error.message : String(error)}`);
        // Continue with empty loops - we'll still return empty trending results
      }
    }

    // Take the top N loops by score if many are cached
    const highPotentialLoops = recentGlobalLoops
      .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
      .slice(0, loopCountLimit);

    const itemAppearances: Map<string, { 
      itemType: 'NFT' | 'Collection'; 
      count: number; 
      totalScore: number; 
      displayNames: Set<string>; 
      imageUrls: Set<string>;
      sampleNftMetadata: NFTMetadata[]; // For collections
    }> = new Map();

    for (const loop of highPotentialLoops) {
      const currentLoopScore = loop.qualityScore || 0;
      if (currentLoopScore < 0.1) continue; // Basic threshold for "high-potential"

      const distinctItemsInLoop = new Set<string>(); // Track unique NFTs/Collections within this single loop to count them once per loop

      for (const step of loop.steps) {
        for (const nft of step.nfts) { // nft here is assumed to be enriched NFTMetadata (or similar) from TradeController
          if (!nft.address) continue;

          // Trend by individual NFT
          const nftKey = `NFT:${nft.address}`;
          if (!distinctItemsInLoop.has(nftKey)) {
            const currentNft = itemAppearances.get(nftKey) || 
              { itemType: 'NFT', count: 0, totalScore: 0, displayNames: new Set(), imageUrls: new Set(), sampleNftMetadata: [] };
            currentNft.count++;
            currentNft.totalScore += currentLoopScore;
            currentNft.displayNames.add(nft.name || nft.address);
            if (nft.image) currentNft.imageUrls.add(nft.image);
            itemAppearances.set(nftKey, currentNft);
            distinctItemsInLoop.add(nftKey);
          }

          // Trend by Collection
          const collectionName = this.normalizeCollectionName(nft.collection);
          
          if (collectionName !== 'Unknown Collection') {
            const collectionKey = `Collection:${collectionName}`;
            if (!distinctItemsInLoop.has(collectionKey)) {
                const currentCollection = itemAppearances.get(collectionKey) || 
                { itemType: 'Collection', count: 0, totalScore: 0, displayNames: new Set(), imageUrls: new Set(), sampleNftMetadata: [] };
              currentCollection.count++;
              currentCollection.totalScore += currentLoopScore;
              currentCollection.displayNames.add(collectionName);
              // Add NFT image as a sample for the collection if no other image yet or to diversify
              if (nft.image && currentCollection.sampleNftMetadata.length < 3) {
                 currentCollection.imageUrls.add(nft.image); // Use NFT image for collection if appropriate
                 currentCollection.sampleNftMetadata.push(nft as NFTMetadata);
              }
              itemAppearances.set(collectionKey, currentCollection);
              distinctItemsInLoop.add(collectionKey);
            }
          }
        }
      }
    }

    const sortedItems = Array.from(itemAppearances.entries())
      .sort((a, b) => {
        if (b[1].count !== a[1].count) return b[1].count - a[1].count;
        // Handle cases where count might be 0 to avoid NaN if totalScore is also 0
        const avgScoreA = a[1].count > 0 ? (a[1].totalScore / a[1].count) : 0;
        const avgScoreB = b[1].count > 0 ? (b[1].totalScore / b[1].count) : 0;
        return avgScoreB - avgScoreA;
      })
      .slice(0, itemLimit);

    const trendingLoopItems: TrendingLoopItem[] = sortedItems.map(([key, data]) => {
      const [itemType, itemIdPart] = key.split(':');
      const displayName = Array.from(data.displayNames)[0] || itemIdPart; // Pick one name
      const imageUrl = Array.from(data.imageUrls)[0]; // Pick one image

      return {
        itemId: itemIdPart,
        itemType: itemType as 'NFT' | 'Collection',
        displayName,
        imageUrl,
        appearanceInLoops: data.count,
        averageLoopScore: data.count > 0 ? (data.totalScore / data.count) : 0,
        nftMetadata: data.itemType === 'Collection' ? data.sampleNftMetadata.slice(0,3) : undefined,
      };
    });
    
    this.internalCache.set(cacheKey, trendingLoopItems, TRENDING_CACHE_TTL_MS);
    return trendingLoopItems;
  }

  /**
   * Enriches trade loops with metadata for NFTs
   */
  private async enrichTradeLoopsWithMetadata(tradeLoops: TradeLoop[]): Promise<TradeLoop[]> {
    if (tradeLoops.length === 0) return [];

    // Collect all NFT addresses in the loops
    const nftAddresses = new Set<string>();
    tradeLoops.forEach(loop => {
      loop.steps.forEach(step => {
        step.nfts.forEach(nft => nftAddresses.add(nft.address));
      });
    });

    // Fetch metadata in batches to avoid overloading the API
    const metadata = new Map<string, NFTMetadata>();
    const batchSize = 20;
    const nftArray = Array.from(nftAddresses);
    
    for (let i = 0; i < nftArray.length; i += batchSize) {
      const batch = nftArray.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(address => this.nftService.getNFTMetadata(address))
      );
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          metadata.set(batch[index], result.value);
        }
      });
    }

    // Create a deep copy of the trade loops to avoid modifying the original
    const enrichedLoops: TradeLoop[] = JSON.parse(JSON.stringify(tradeLoops));
    
    // Enrich each NFT in each step of each loop
    for (const loop of enrichedLoops) {
      for (const step of loop.steps) {
        for (let i = 0; i < step.nfts.length; i++) {
          const nft = step.nfts[i];
          const meta = metadata.get(nft.address);
          
          if (meta) {
            // Normalize the collection to always be a string
            const collectionStr = this.normalizeCollectionName(meta.collection);
            
            // Update the NFT with metadata
            step.nfts[i] = {
              ...nft,
              name: meta.name || nft.name || nft.address.substring(0, 8),
              symbol: meta.symbol || 'UNKN',
              image: meta.image || `https://via.placeholder.com/300?text=${encodeURIComponent(meta.name || nft.address.substring(0, 8))}`,
              // Ensure collection is always a string to satisfy type constraints
              collection: collectionStr,
              description: meta.description || 'No description available',
              floorPrice: meta.floorPrice,
              usedRealPrice: meta.usedRealPrice || false,
              hasFloorPrice: meta.hasFloorPrice || false,
              priceSource: meta.priceSource || 'unknown'
            };
          }
        }
      }
    }
    
    return enrichedLoops;
  }

  /**
   * Helper to normalize collection data regardless of format
   */
  private normalizeCollectionName(collection: string | { name: string; family?: string } | undefined): string {
    if (!collection) return 'Unknown Collection';
    if (typeof collection === 'string') return collection;
    return collection.name || 'Unknown Collection';
  }

  /**
   * Cleanup resources - important for testing
   */
  public dispose(): void {
    if (this.backgroundRefreshInterval) {
      clearInterval(this.backgroundRefreshInterval);
      this.backgroundRefreshInterval = null;
    }
    this.logger.info('TrendingService disposed');
  }
} 