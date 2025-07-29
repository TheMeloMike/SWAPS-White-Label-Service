import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { LocalCollectionService } from '../nft/LocalCollectionService';
import { NFTPricingService } from '../nft/NFTPricingService';
import { CollectionMetadata, CollectionExpansionMetrics } from '../../types/trade';

export interface ExpansionStrategy {
  maxSampleSize: number;
  strategyType: 'full' | 'stratified' | 'random' | 'adaptive';
  priceTiers?: number;
  prioritizeAvailable?: boolean;
  considerTradeVelocity?: boolean;
}

export interface StratifiedSample {
  tier: 'floor' | 'mid' | 'rare' | 'grail';
  priceRange: { min: number; max: number };
  nfts: string[];
  sampleSize: number;
}

export interface ExpansionResult {
  strategy: ExpansionStrategy;
  totalNFTs: number;
  sampledNFTs: string[];
  stratification?: StratifiedSample[];
  confidence: number;
  expansionTime: number;
}

/**
 * Smart Collection Expansion Service
 * 
 * Prevents graph explosion by intelligently sampling large collections
 * instead of creating edges to every single NFT.
 * 
 * Key strategies:
 * - Stratified sampling by price tiers
 * - Prioritization of available (owned) NFTs
 * - Trade velocity consideration
 * - Adaptive sampling based on collection size
 */
export class SmartCollectionExpansionService {
  private static instance: SmartCollectionExpansionService;
  private logger: Logger;
  private localCollectionService: LocalCollectionService;
  private pricingService: NFTPricingService;
  
  // Configuration
  private readonly DEFAULT_MAX_SAMPLE = 100;
  private readonly LARGE_COLLECTION_THRESHOLD = 1000;
  private readonly PRICE_TIER_PERCENTILES = [0, 0.25, 0.75, 0.95]; // Floor, Mid, Rare, Grail
  
  // Cache for expansion strategies per collection
  private strategyCache = new Map<string, {
    strategy: ExpansionStrategy;
    timestamp: number;
  }>();
  private readonly STRATEGY_CACHE_TTL = 60 * 60 * 1000; // 1 hour

  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('SmartCollectionExpansion');
    this.localCollectionService = LocalCollectionService.getInstance();
    this.pricingService = NFTPricingService.getInstance();
  }

  public static getInstance(): SmartCollectionExpansionService {
    if (!SmartCollectionExpansionService.instance) {
      SmartCollectionExpansionService.instance = new SmartCollectionExpansionService();
    }
    return SmartCollectionExpansionService.instance;
  }

  /**
   * Expand a collection want into specific NFT wants using smart sampling
   */
  public async expandCollection(
    collectionId: string,
    availableNftOwnership?: Map<string, string>,
    options?: Partial<ExpansionStrategy>
  ): Promise<ExpansionResult> {
    const operation = this.logger.operation('expandCollection');
    const startTime = performance.now();
    
    try {
      // Get collection metadata
      const metadata = this.localCollectionService.getCollectionMetadata(collectionId);
      if (!metadata) {
        throw new Error(`Collection ${collectionId} not found`);
      }

      // Determine expansion strategy
      const strategy = await this.determineExpansionStrategy(
        collectionId,
        metadata,
        availableNftOwnership,
        options
      );

      operation.info('Expansion strategy determined', {
        collection: collectionId,
        totalNFTs: metadata.nftCount,
        strategy: strategy.strategyType,
        maxSample: strategy.maxSampleSize
      });

      // Execute expansion based on strategy
      let result: ExpansionResult;
      
      switch (strategy.strategyType) {
        case 'full':
          result = await this.fullExpansion(collectionId, strategy, availableNftOwnership);
          break;
        case 'stratified':
          result = await this.stratifiedExpansion(collectionId, strategy, availableNftOwnership);
          break;
        case 'adaptive':
          result = await this.adaptiveExpansion(collectionId, strategy, availableNftOwnership);
          break;
        default:
          result = await this.randomExpansion(collectionId, strategy, availableNftOwnership);
      }

      const endTime = performance.now();
      result.expansionTime = endTime - startTime;

      operation.info('Collection expansion completed', {
        collection: collectionId,
        sampledCount: result.sampledNFTs.length,
        totalCount: result.totalNFTs,
        reductionRatio: ((1 - result.sampledNFTs.length / result.totalNFTs) * 100).toFixed(1) + '%',
        timeMs: result.expansionTime.toFixed(2)
      });

      operation.end();
      return result;

    } catch (error) {
      operation.error('Collection expansion failed', {
        collection: collectionId,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Determine the best expansion strategy for a collection
   */
  private async determineExpansionStrategy(
    collectionId: string,
    metadata: CollectionMetadata,
    availableNftOwnership?: Map<string, string>,
    options?: Partial<ExpansionStrategy>
  ): Promise<ExpansionStrategy> {
    // Check cache first
    const cached = this.strategyCache.get(collectionId);
    if (cached && Date.now() - cached.timestamp < this.STRATEGY_CACHE_TTL && !options) {
      return cached.strategy;
    }

    const strategy: ExpansionStrategy = {
      maxSampleSize: options?.maxSampleSize || this.DEFAULT_MAX_SAMPLE,
      strategyType: 'full',
      priceTiers: 4,
      prioritizeAvailable: true,
      considerTradeVelocity: true,
      ...options
    };

    // Determine strategy based on collection size
    if (metadata.nftCount <= strategy.maxSampleSize) {
      // Small collection - use full expansion
      strategy.strategyType = 'full';
    } else if (metadata.nftCount <= this.LARGE_COLLECTION_THRESHOLD) {
      // Medium collection - use random sampling
      strategy.strategyType = 'random';
    } else if (metadata.floorPrice > 0 && metadata.verified) {
      // Large verified collection with price data - use stratified sampling
      strategy.strategyType = 'stratified';
    } else {
      // Large collection without good data - use adaptive sampling
      strategy.strategyType = 'adaptive';
    }

    // Cache the strategy
    this.strategyCache.set(collectionId, {
      strategy,
      timestamp: Date.now()
    });

    return strategy;
  }

  /**
   * Full expansion - return all NFTs (for small collections)
   */
  private async fullExpansion(
    collectionId: string,
    strategy: ExpansionStrategy,
    availableNftOwnership?: Map<string, string>
  ): Promise<ExpansionResult> {
    const allNFTs = await this.localCollectionService.getNFTsInCollection(
      collectionId,
      availableNftOwnership
    );

    return {
      strategy,
      totalNFTs: allNFTs.length,
      sampledNFTs: allNFTs,
      confidence: 1.0, // Full expansion has perfect confidence
      expansionTime: 0
    };
  }

  /**
   * Stratified expansion - sample from price tiers
   */
  private async stratifiedExpansion(
    collectionId: string,
    strategy: ExpansionStrategy,
    availableNftOwnership?: Map<string, string>
  ): Promise<ExpansionResult> {
    const allNFTs = await this.localCollectionService.getNFTsInCollection(
      collectionId,
      availableNftOwnership
    );

    if (allNFTs.length <= strategy.maxSampleSize) {
      return this.fullExpansion(collectionId, strategy, availableNftOwnership);
    }

    // Get price data for stratification
    const nftPrices = new Map<string, number>();
    const pricedNFTs: string[] = [];
    
    // Batch price fetching for efficiency
    const pricePromises = allNFTs.slice(0, 500).map(async (nft) => {
      try {
        const price = await this.pricingService.estimateNFTPrice(nft);
        if (price > 0) {
          nftPrices.set(nft, price);
          pricedNFTs.push(nft);
        }
      } catch (error) {
        // Silent fail for individual price errors
      }
    });

    await Promise.all(pricePromises);

    // If we don't have enough price data, fall back to random sampling
    if (pricedNFTs.length < strategy.maxSampleSize / 2) {
      this.logger.warn('Insufficient price data for stratified sampling', {
        collection: collectionId,
        pricedNFTs: pricedNFTs.length
      });
      return this.randomExpansion(collectionId, strategy, availableNftOwnership);
    }

    // Sort NFTs by price
    pricedNFTs.sort((a, b) => nftPrices.get(a)! - nftPrices.get(b)!);

    // Create strata
    const strata: StratifiedSample[] = [];
    const strataSize = Math.floor(strategy.maxSampleSize / strategy.priceTiers!);
    
    for (let i = 0; i < strategy.priceTiers!; i++) {
      const startIdx = Math.floor(i * pricedNFTs.length / strategy.priceTiers!);
      const endIdx = Math.floor((i + 1) * pricedNFTs.length / strategy.priceTiers!);
      const strataNFTs = pricedNFTs.slice(startIdx, endIdx);
      
      const tier = i === 0 ? 'floor' : 
                   i === strategy.priceTiers! - 1 ? 'grail' :
                   i === 1 ? 'mid' : 'rare';
      
      const minPrice = nftPrices.get(strataNFTs[0])!;
      const maxPrice = nftPrices.get(strataNFTs[strataNFTs.length - 1])!;
      
      // Sample from this stratum
      const sampledFromStratum = this.reservoirSample(strataNFTs, strataSize);
      
      strata.push({
        tier,
        priceRange: { min: minPrice, max: maxPrice },
        nfts: sampledFromStratum,
        sampleSize: sampledFromStratum.length
      });
    }

    // Combine all samples
    const sampledNFTs = strata.flatMap(s => s.nfts);

    // Add some random NFTs without price data to increase diversity
    const unpricedNFTs = allNFTs.filter(nft => !nftPrices.has(nft));
    if (unpricedNFTs.length > 0 && sampledNFTs.length < strategy.maxSampleSize) {
      const additionalSamples = this.reservoirSample(
        unpricedNFTs,
        strategy.maxSampleSize - sampledNFTs.length
      );
      sampledNFTs.push(...additionalSamples);
    }

    return {
      strategy,
      totalNFTs: allNFTs.length,
      sampledNFTs,
      stratification: strata,
      confidence: 0.85, // High confidence for stratified sampling
      expansionTime: 0
    };
  }

  /**
   * Random expansion - simple random sampling
   */
  private async randomExpansion(
    collectionId: string,
    strategy: ExpansionStrategy,
    availableNftOwnership?: Map<string, string>
  ): Promise<ExpansionResult> {
    const allNFTs = await this.localCollectionService.getNFTsInCollection(
      collectionId,
      availableNftOwnership
    );

    if (allNFTs.length <= strategy.maxSampleSize) {
      return this.fullExpansion(collectionId, strategy, availableNftOwnership);
    }

    const sampledNFTs = this.reservoirSample(allNFTs, strategy.maxSampleSize);

    return {
      strategy,
      totalNFTs: allNFTs.length,
      sampledNFTs,
      confidence: 0.7, // Moderate confidence for random sampling
      expansionTime: 0
    };
  }

  /**
   * Adaptive expansion - adjusts strategy based on real-time feedback
   */
  private async adaptiveExpansion(
    collectionId: string,
    strategy: ExpansionStrategy,
    availableNftOwnership?: Map<string, string>
  ): Promise<ExpansionResult> {
    const allNFTs = await this.localCollectionService.getNFTsInCollection(
      collectionId,
      availableNftOwnership
    );

    if (allNFTs.length <= strategy.maxSampleSize) {
      return this.fullExpansion(collectionId, strategy, availableNftOwnership);
    }

    // Start with a small sample to test connectivity
    const initialSampleSize = Math.min(20, strategy.maxSampleSize / 5);
    let sampledNFTs = this.reservoirSample(allNFTs, initialSampleSize);
    
    // Analyze initial sample for patterns
    const ownedByActiveTraders = sampledNFTs.filter(nft => {
      const owner = availableNftOwnership?.get(nft);
      // In real implementation, check if owner is an active trader
      return owner !== undefined;
    }).length;

    const activeTraderRatio = ownedByActiveTraders / sampledNFTs.length;

    // Adapt strategy based on findings
    if (activeTraderRatio > 0.5) {
      // High activity - we can use a smaller sample
      this.logger.info('High trader activity detected, using smaller sample', {
        collection: collectionId,
        activeRatio: activeTraderRatio
      });
    } else {
      // Low activity - need larger sample for better coverage
      const additionalSamples = this.reservoirSample(
        allNFTs.filter(nft => !sampledNFTs.includes(nft)),
        strategy.maxSampleSize - sampledNFTs.length
      );
      sampledNFTs.push(...additionalSamples);
    }

    return {
      strategy,
      totalNFTs: allNFTs.length,
      sampledNFTs,
      confidence: 0.75, // Moderate-high confidence for adaptive sampling
      expansionTime: 0
    };
  }

  /**
   * Reservoir sampling algorithm for fair random selection
   */
  private reservoirSample<T>(items: T[], sampleSize: number): T[] {
    if (items.length <= sampleSize) {
      return [...items];
    }

    const reservoir: T[] = [];
    
    // Fill reservoir with first sampleSize elements
    for (let i = 0; i < sampleSize; i++) {
      reservoir.push(items[i]);
    }
    
    // Replace elements with gradually decreasing probability
    for (let i = sampleSize; i < items.length; i++) {
      const j = Math.floor(Math.random() * (i + 1));
      if (j < sampleSize) {
        reservoir[j] = items[i];
      }
    }
    
    return reservoir;
  }

  /**
   * Get expansion statistics for monitoring
   */
  public getExpansionStats(): {
    strategyCacheSize: number;
    averageReductionRatio: number;
    strategyDistribution: Record<string, number>;
  } {
    const strategies = Array.from(this.strategyCache.values()).map(v => v.strategy);
    const distribution: Record<string, number> = {};
    
    strategies.forEach(s => {
      distribution[s.strategyType] = (distribution[s.strategyType] || 0) + 1;
    });

    return {
      strategyCacheSize: this.strategyCache.size,
      averageReductionRatio: 0, // Would need to track this
      strategyDistribution: distribution
    };
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.strategyCache.clear();
    this.logger.info('Smart expansion caches cleared');
  }
} 