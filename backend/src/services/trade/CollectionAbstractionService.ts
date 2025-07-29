import { WalletState, TradeLoop, CollectionMetadata, CollectionResolution } from '../../types/trade';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { NFTPricingService } from '../nft/NFTPricingService';
import { NFTService } from '../nft/NFTService';
import { LocalCollectionService } from '../nft/LocalCollectionService';
import { DynamicValuationService } from './DynamicValuationService';

/**
 * Service to handle collection-level abstraction for NFT wants
 * This allows users to want "any NFT from collection X" instead of specific NFTs
 * Dramatically increases liquidity and trade opportunities
 */
export class CollectionAbstractionService {
  private static instance: CollectionAbstractionService;
  private logger: Logger;
  private nftService: NFTService;
  private nftPricingService: NFTPricingService;
  private localCollectionService: LocalCollectionService;
  private dynamicValuationService: DynamicValuationService;
  
  // Cache for collection resolution decisions
  private resolutionCache = new Map<string, {
    resolution: CollectionResolution;
    timestamp: number;
  }>();
  
  private readonly RESOLUTION_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('CollectionAbstraction');
    this.nftService = NFTService.getInstance();
    this.nftPricingService = NFTPricingService.getInstance();
    this.localCollectionService = LocalCollectionService.getInstance();
    this.dynamicValuationService = DynamicValuationService.getInstance();
  }

  public static getInstance(): CollectionAbstractionService {
    if (!CollectionAbstractionService.instance) {
      CollectionAbstractionService.instance = new CollectionAbstractionService();
    }
    return CollectionAbstractionService.instance;
  }

  /**
   * Extract collection ID from an NFT address using the local collection service
   */
  public async getCollectionId(nftAddress: string): Promise<string | null> {
    // Use NFT metadata to determine collection
    try {
      const metadata = await this.nftService.getNFTMetadata(nftAddress);
      if (metadata.collection) {
        if (typeof metadata.collection === 'string') {
          return metadata.collection;
        } else if (metadata.collection.name) {
          return metadata.collection.name;
        }
      }
      
      // Fallback to symbol or name-based heuristic
      if (metadata.symbol) {
        return metadata.symbol;
      } else if (metadata.name) {
        // Extract potential collection name from NFT name
        const nameMatch = metadata.name.match(/^([^#\d]+)/);
        if (nameMatch) {
          return nameMatch[1].trim();
        }
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
   * Expand collection-level wants to specific NFT wants based on availability
   * This creates edges in the graph for any NFT from the wanted collection
   */
  public async expandCollectionWants(
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    collectionWants: Map<string, Set<string>> // wallet -> collections wanted
  ): Promise<Map<string, Set<string>>> {
    const operation = this.logger.operation('expandCollectionWants');
    const expandedWants = new Map<string, Set<string>>();
    
    // Initialize expanded wants with existing specific wants
    for (const [wallet, state] of wallets) {
      expandedWants.set(wallet, new Set(state.wantedNfts));
    }
    
    // Build collection membership maps if needed
    await this.ensureCollectionIndex(Array.from(nftOwnership.keys()));
    
    let expansionCount = 0;
    let collectionProcessed = 0;
    
    // Now expand collection wants
    for (const [walletAddress, wantedCollections] of collectionWants) {
      const walletState = wallets.get(walletAddress);
      if (!walletState) continue;
      
      for (const collectionId of wantedCollections) {
        collectionProcessed++;
        
        // Get all NFTs in this collection using the local collection service
        const nftsInCollection = await this.localCollectionService.getNFTsInCollection(collectionId, nftOwnership);
        
        if (nftsInCollection.length === 0) {
          operation.warn('No NFTs found for collection', { collection: collectionId });
          continue;
        }
        
        // Add all NFTs from this collection that the wallet doesn't already own
        for (const nftAddress of nftsInCollection) {
          // Skip if wallet already owns this NFT
          if (walletState.ownedNfts.has(nftAddress)) continue;
          
          // Skip if wallet already specifically wants this NFT
          if (expandedWants.get(walletAddress)?.has(nftAddress)) continue;
          
          // Check if someone owns this NFT (it's available for trading)
          if (nftOwnership.has(nftAddress)) {
            // Add to expanded wants
            if (!expandedWants.has(walletAddress)) {
              expandedWants.set(walletAddress, new Set());
            }
            expandedWants.get(walletAddress)!.add(nftAddress);
            expansionCount++;
          }
        }
        
        operation.debug('Expanded collection want', {
          wallet: walletAddress,
          collection: collectionId,
          nftsInCollection: nftsInCollection.length,
          availableForTrade: nftsInCollection.filter(nft => nftOwnership.has(nft)).length
        });
      }
    }
    
    operation.info('Collection want expansion completed', {
      walletsWithCollectionWants: collectionWants.size,
      collectionsProcessed: collectionProcessed,
      totalExpansions: expansionCount,
      averageExpansionsPerWallet: collectionWants.size > 0 ? 
        (expansionCount / collectionWants.size).toFixed(2) : 0
    });
    
    operation.end();
    return expandedWants;
  }

  /**
   * Score NFTs within a collection based on various factors
   * This helps choose the best NFT from a collection when multiple options exist
   */
  public async scoreNFTsInCollection(
    collectionNfts: string[],
    targetWallet: string,
    context: {
      rarity?: Map<string, number>;
      demand?: Map<string, number>;
      aestheticPreferences?: any;
      tradeContext?: {
        otherNFTsInTrade: string[];
        targetValue?: number;
      };
    }
  ): Promise<Map<string, number>> {
    const scores = new Map<string, number>();
    
    for (const nft of collectionNfts) {
      let score = 1.0; // Base score
      
      // Factor 1: Rarity (if available)
      if (context.rarity?.has(nft)) {
        const rarityScore = context.rarity.get(nft)!;
        score *= (1 + rarityScore * 0.3); // Up to 30% boost for rarity
      }
      
      // Factor 2: Demand (how many users want this specific NFT)
      if (context.demand?.has(nft)) {
        const demandScore = Math.min(1, context.demand.get(nft)! / 10);
        score *= (1 + demandScore * 0.2); // Up to 20% boost for demand
      }
      
      // Factor 3: Dynamic valuation alignment
      try {
        const dynamicValuation = await this.dynamicValuationService.calculateDynamicValue(nft);
        
        // If we have a target value for the trade, prefer NFTs closer to that value
        if (context.tradeContext?.targetValue) {
          const valueDiff = Math.abs(dynamicValuation.value - context.tradeContext.targetValue);
          const maxDiff = context.tradeContext.targetValue * 0.5; // Allow 50% variance
          const valueScore = Math.max(0, 1 - (valueDiff / maxDiff));
          score *= (0.7 + valueScore * 0.6); // 70-130% based on value alignment
        }
        
        // Boost for high confidence valuations
        score *= (0.9 + dynamicValuation.confidence * 0.2); // 90-110% based on confidence
        
      } catch (error) {
        // Continue without dynamic valuation if unavailable
        this.logger.debug('Dynamic valuation unavailable for NFT', { nft });
      }
      
      // Factor 4: Floor price alignment (prefer NFTs closer to collection floor)
      try {
        const collectionId = await this.getCollectionId(nft);
        if (collectionId) {
          const collectionMetadata = this.localCollectionService.getCollectionMetadata(collectionId);
          const nftPrice = await this.nftPricingService.estimateNFTPrice(nft);
          
          if (collectionMetadata && nftPrice && collectionMetadata.floorPrice > 0) {
            // Prefer NFTs closer to floor (more liquid)
            const priceRatio = nftPrice / collectionMetadata.floorPrice;
            const priceScore = 1 / (1 + Math.abs(priceRatio - 1));
            score *= (0.8 + priceScore * 0.4); // 80-120% based on floor alignment
          }
        }
      } catch (error) {
        // Continue without price factor if unavailable
      }
      
      // Factor 5: Liquidity contribution (how much does this NFT help future trades)
      if (context.tradeContext?.otherNFTsInTrade) {
        // Prefer NFTs that create diverse collection representation
        const otherCollections = new Set<string>();
        for (const otherNft of context.tradeContext.otherNFTsInTrade) {
          const collection = await this.getCollectionId(otherNft);
          if (collection) otherCollections.add(collection);
        }
        
        const thisCollection = await this.getCollectionId(nft);
        if (thisCollection && !otherCollections.has(thisCollection)) {
          score *= 1.15; // 15% boost for collection diversity
        }
      }
      
      scores.set(nft, score);
    }
    
    return scores;
  }

  /**
   * Convert collection-level preferences to optimal specific NFT matches
   * This is called during trade loop construction
   */
  public async resolveCollectionPreference(
    wantedCollection: string,
    availableNfts: string[],
    targetWallet: string,
    context: {
      tradeLoop?: TradeLoop;
      otherNFTsInTrade?: string[];
      targetValue?: number;
    }
  ): Promise<CollectionResolution | null> {
    if (availableNfts.length === 0) return null;
    
    // Check cache first
    const cacheKey = `${wantedCollection}:${availableNfts.sort().join(',')}:${targetWallet}`;
    const cached = this.resolutionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.RESOLUTION_CACHE_TTL) {
      return cached.resolution;
    }
    
    const operation = this.logger.operation('resolveCollectionPreference');
    operation.info('Resolving collection preference', {
      collection: wantedCollection,
      availableOptions: availableNfts.length,
      targetWallet
    });
    
    // If only one option, return it
    if (availableNfts.length === 1) {
      const resolution: CollectionResolution = {
        collectionId: wantedCollection,
        collectionName: wantedCollection,
        resolvedNFT: availableNfts[0],
        alternativeNFTs: [],
        resolutionReason: 'user_preference',
        confidence: 1.0
      };
      
      this.cacheResolution(cacheKey, resolution);
      operation.end();
      return resolution;
    }
    
    // Score all available NFTs
    const scores = await this.scoreNFTsInCollection(
      availableNfts,
      targetWallet,
      {
        tradeContext: {
          otherNFTsInTrade: context.otherNFTsInTrade || [],
          targetValue: context.targetValue
        }
      }
    );
    
    // Find the highest scoring NFT
    let bestNft: string | null = null;
    let bestScore = 0;
    const sortedNfts: Array<{nft: string; score: number}> = [];
    
    for (const [nft, score] of scores) {
      sortedNfts.push({ nft, score });
      if (score > bestScore) {
        bestScore = score;
        bestNft = nft;
      }
    }
    
    // Sort alternatives by score
    sortedNfts.sort((a, b) => b.score - a.score);
    
    if (!bestNft) {
      operation.error('No valid NFT found for collection resolution');
      operation.end();
      return null;
    }
    
    // Determine resolution reason
    let resolutionReason: CollectionResolution['resolutionReason'] = 'floor_price';
    if (context.targetValue) {
      resolutionReason = 'value_match';
    } else if (bestScore > 1.3) {
      resolutionReason = 'user_preference';
    } else if (bestScore > 1.1) {
      resolutionReason = 'liquidity';
    }
    
    // Calculate confidence based on score distribution
    const avgScore = sortedNfts.reduce((sum, item) => sum + item.score, 0) / sortedNfts.length;
    const confidence = Math.min(1.0, bestScore / (avgScore * 1.5));
    
    const resolution: CollectionResolution = {
      collectionId: wantedCollection,
      collectionName: wantedCollection, // TODO: Get actual collection name
      resolvedNFT: bestNft,
      alternativeNFTs: sortedNfts.slice(1, 4).map(item => item.nft), // Top 3 alternatives
      resolutionReason,
      confidence
    };
    
    // Cache the resolution
    this.cacheResolution(cacheKey, resolution);
    
    operation.info('Collection preference resolved', {
      collection: wantedCollection,
      resolvedNFT: bestNft,
      alternatives: resolution.alternativeNFTs.length,
      reason: resolutionReason,
      confidence: confidence.toFixed(2)
    });
    
    operation.end();
    return resolution;
  }

  /**
   * Build collection ownership maps for wallets
   */
  public async buildCollectionOwnership(
    wallets: Map<string, WalletState>
  ): Promise<Map<string, Map<string, string[]>>> {
    const operation = this.logger.operation('buildCollectionOwnership');
    const collectionOwnership = new Map<string, Map<string, string[]>>();
    
    for (const [walletAddress, walletState] of wallets) {
      const walletCollections = new Map<string, string[]>();
      
      for (const nftAddress of walletState.ownedNfts) {
        const collectionId = await this.getCollectionId(nftAddress);
        if (collectionId) {
          if (!walletCollections.has(collectionId)) {
            walletCollections.set(collectionId, []);
          }
          walletCollections.get(collectionId)!.push(nftAddress);
        }
      }
      
      if (walletCollections.size > 0) {
        collectionOwnership.set(walletAddress, walletCollections);
        
        // Update wallet state with collection ownership
        walletState.ownedCollections = walletCollections;
      }
    }
    
    operation.info('Collection ownership maps built', {
      walletsProcessed: wallets.size,
      walletsWithCollections: collectionOwnership.size
    });
    
    operation.end();
    return collectionOwnership;
  }

  /**
   * Ensure collection index is built for the given NFTs
   */
  private async ensureCollectionIndex(nftAddresses: string[]): Promise<void> {
    // LocalCollectionService automatically handles collection indexing
    // No explicit index building needed
    this.logger.debug('Collection index ensured via LocalCollectionService');
  }

  /**
   * Cache a collection resolution
   */
  private cacheResolution(key: string, resolution: CollectionResolution): void {
    this.resolutionCache.set(key, {
      resolution,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries
    if (this.resolutionCache.size > 1000) {
      const cutoff = Date.now() - this.RESOLUTION_CACHE_TTL;
      for (const [cacheKey, entry] of this.resolutionCache) {
        if (entry.timestamp < cutoff) {
          this.resolutionCache.delete(cacheKey);
        }
      }
    }
  }

  /**
   * Get collection metadata by ID
   */
  public getCollectionMetadata(collectionId: string): CollectionMetadata | null {
    return this.localCollectionService.getCollectionMetadata(collectionId);
  }

  /**
   * Search collections
   */
  public async searchCollections(query: string, maxResults?: number): Promise<CollectionMetadata[]> {
    const results = await this.localCollectionService.searchCollections(query, maxResults || 10);
    return results.map(result => result.collection);
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.resolutionCache.clear();
    this.localCollectionService.clearCache();
    this.logger.info('Collection abstraction caches cleared');
  }

  /**
   * Get service statistics
   */
  public getStats(): {
    indexStats: any;
    resolutionCacheSize: number;
  } {
    return {
      indexStats: this.localCollectionService.getCollectionStats(),
      resolutionCacheSize: this.resolutionCache.size
    };
  }
} 