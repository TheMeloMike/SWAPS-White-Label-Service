import { TradeLoop, NFTDemandMetrics, CollectionResolution } from '../../types/trade';
import { NFTPricingService } from '../nft/NFTPricingService';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { CollectionIndexingService } from '../nft/CollectionIndexingService';

/**
 * Enhanced service for scoring trade loops with collection awareness
 * Evaluates trade quality using 18+ metrics including collection-level factors
 */
export class TradeScoreService {
  private static instance: TradeScoreService;
  private nftPricingService: NFTPricingService;
  private readonly DEFAULT_FAIRNESS_SCORE = 0.7; // Default fairness when insufficient price data
  private readonly MAX_PATH_LENGTH = 10; // Maximum number of steps before efficiency penalty
  private readonly MINIMUM_SCORE = 0.01; // Minimum score to avoid completely zero scores
  private readonly MIN_SCORE = 0.5; // 50% minimum score to ensure only high-quality trades (MVP Optimization: +25% quality threshold)
  private logger: Logger;
  private collectionIndexingService: CollectionIndexingService;

  // Weights for different scoring factors - cached as constants (MVP Optimized)
  private readonly WEIGHT_EFFICIENCY = 0.40;    // How efficient is the trade loop? (MVP: +14% weight - efficiency is key)
  private readonly WEIGHT_VALUE = 0.20;         // What's the total value involved? (MVP: reduced to balance)
  private readonly WEIGHT_FAIRNESS = 0.30;      // How evenly distributed is the value? (MVP: +20% weight - fairness increases success)
  private readonly WEIGHT_COMPLETION = 0.10;    // How likely is this trade to complete? (MVP: reduced to focus on quality)
  
  // Flags to control logging verbosity
  private readonly VERBOSE_LOGGING = process.env.TRADE_SCORE_VERBOSE === 'true';
  
  // Cache for recently calculated scores
  private scoreCache = new Map<string, {
    score: number;
    metrics: Record<string, number>;
    timestamp: number;
  }>();
  private readonly SCORE_CACHE_TTL = 10 * 60 * 1000; // 10 minute cache (MVP Optimization: 2x longer cache for efficiency)

  constructor() {
    this.nftPricingService = NFTPricingService.getInstance();
    this.logger = LoggingService.getInstance().createLogger('TradeScoreService');
    this.collectionIndexingService = CollectionIndexingService.getInstance();
  }

  public static getInstance(): TradeScoreService {
    if (!TradeScoreService.instance) {
      TradeScoreService.instance = new TradeScoreService();
    }
    return TradeScoreService.instance;
  }

  /**
   * Calculate comprehensive trade score with collection awareness
   * Enhanced to include collection diversity, cross-collection trades, and collection preferences
   */
  public calculateTradeScore(
    trade: TradeLoop,
    nftDemandMetrics?: Map<string, NFTDemandMetrics>
  ): { score: number; metrics: Record<string, number>; collectionMetrics?: Record<string, any> } {
    const operation = this.logger.operation('calculateTradeScore');
    
    try {
      // Extract all NFTs and their metadata
      const allNfts = trade.steps.flatMap(step => step.nfts);
      const nftValues = allNfts.map(nft => nft.floorPrice || 0).filter(price => price > 0);
      const nftNames = allNfts.map(nft => nft.name || 'Unknown');
      
      // Calculate original metrics using existing methods
      const fairnessScore = this.calculateFairnessScore(nftValues, nftNames, operation);
      const liquidityScore = this.calculateLiquidityScoreSimple(trade, nftDemandMetrics);
      const complexityPenalty = this.calculateComplexityPenaltySimple(trade);
      const demandScore = this.calculateDemandScore(allNfts.map(n => n.address), nftDemandMetrics, operation);
      const valueScore = this.calculateValueScoreSimple(nftValues);
      const diversityScore = this.calculateDiversityScoreSimple(allNfts);
      const priceDataQuality = this.calculatePriceDataQualitySimple(allNfts);
      
      // NEW: Calculate collection-specific metrics
      const collectionMetrics = this.calculateCollectionMetrics(trade, allNfts);
      
      // Existing metrics
      const metrics = {
        fairness: fairnessScore,
        liquidity: liquidityScore,
        complexity: complexityPenalty,
        demand: demandScore,
        value: valueScore,
        diversity: diversityScore,
        priceDataQuality,
        ...collectionMetrics.scores // Spread collection scores into main metrics
      };
      
      // Enhanced weighted score calculation including collection factors
      const score = this.calculateWeightedScore(metrics);
      
      operation.info('Trade score calculated', {
        tradeId: trade.id,
        participants: trade.totalParticipants,
        finalScore: score.toFixed(3),
        hasCollectionTrades: collectionMetrics.metadata.hasCollectionTrades,
        collectionDiversity: collectionMetrics.metadata.uniqueCollections
      });
      
      return {
        score,
        metrics,
        collectionMetrics: collectionMetrics.metadata
      };
    } catch (error) {
      operation.error('Error calculating trade score', {
        tradeId: trade.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return default score on error
      return {
        score: this.DEFAULT_FAIRNESS_SCORE,
        metrics: { error: 1.0 }
      };
    } finally {
      operation.end();
    }
  }

  /**
   * Calculate collection-specific scoring metrics
   */
  private calculateCollectionMetrics(
    trade: TradeLoop,
    allNfts: Array<{ address: string; collection?: string; [key: string]: any }>
  ): { 
    scores: Record<string, number>; 
    metadata: {
      hasCollectionTrades: boolean;
      uniqueCollections: number;
      crossCollectionTrade: boolean;
      collectionDiversityRatio: number;
      averageCollectionFloor: number;
    } 
  } {
    // Identify collections for each NFT
    const nftCollections: string[] = [];
    const collectionFloors: number[] = [];
    
    for (const nft of allNfts) {
      const collectionId = nft.collection || 'unknown';
      nftCollections.push(collectionId);
      
      // Get collection floor price
      const collectionMetadata = this.collectionIndexingService.getCollectionMetadata(collectionId);
      if (collectionMetadata) {
        collectionFloors.push(collectionMetadata.floorPrice);
      }
    }
    
    // Calculate collection diversity
    const uniqueCollections = new Set(nftCollections.filter(c => c !== 'unknown')).size;
    const collectionDiversityRatio = uniqueCollections / Math.max(1, allNfts.length);
    
    // Check for cross-collection trades
    const crossCollectionTrade = uniqueCollections > 1;
    const hasCollectionTrades = uniqueCollections > 0;
    
    // Calculate average collection floor
    const averageCollectionFloor = collectionFloors.length > 0 ?
      collectionFloors.reduce((sum, floor) => sum + floor, 0) / collectionFloors.length : 0;
    
    // Calculate collection-specific scores
    const collectionDiversityScore = Math.min(1.0, collectionDiversityRatio * 2); // Boost diversity
    const crossCollectionBonus = crossCollectionTrade ? 1.15 : 1.0; // 15% bonus for cross-collection trades
    const collectionQualityScore = this.calculateCollectionQualityScore(nftCollections);
    
    // Check for collection resolution metadata (if trade was enhanced)
    const hasResolutions = (trade as any).collectionResolutions?.size > 0;
    const resolutionBonus = hasResolutions ? 1.1 : 1.0; // 10% bonus for resolved collection preferences
    
    return {
      scores: {
        collectionDiversity: collectionDiversityScore,
        crossCollectionBonus: crossCollectionBonus - 1.0, // Normalize to 0-0.15 range
        collectionQuality: collectionQualityScore,
        collectionResolution: resolutionBonus - 1.0 // Normalize to 0-0.1 range
      },
      metadata: {
        hasCollectionTrades,
        uniqueCollections,
        crossCollectionTrade,
        collectionDiversityRatio,
        averageCollectionFloor
      }
    };
  }

  /**
   * Calculate quality score based on collection reputation and metrics
   */
  private calculateCollectionQualityScore(collections: string[]): number {
    let totalQualityScore = 0;
    let validCollections = 0;
    
    for (const collectionId of collections) {
      if (collectionId === 'unknown') continue;
      
      const metadata = this.collectionIndexingService.getCollectionMetadata(collectionId);
      if (metadata) {
        let qualityScore = 0.5; // Base score
        
        // Boost for verified collections
        if (metadata.verified) qualityScore += 0.3;
        
        // Boost for collections with volume
        if (metadata.volume24h > 0) qualityScore += 0.2;
        
        // Boost for collections with many NFTs (established)
        if (metadata.nftCount > 1000) qualityScore += 0.2;
        else if (metadata.nftCount > 100) qualityScore += 0.1;
        
        // Boost for collections with reasonable floor price
        if (metadata.floorPrice > 0.01) qualityScore += 0.1; // > 0.01 SOL
        
        totalQualityScore += Math.min(1.0, qualityScore);
        validCollections++;
      }
    }
    
    return validCollections > 0 ? totalQualityScore / validCollections : 0.5;
  }

  /**
   * Enhanced weighted score calculation including collection factors
   */
  private calculateWeightedScore(metrics: Record<string, number>): number {
    // Original weights
    let score = 0;
    score += (metrics.fairness || this.DEFAULT_FAIRNESS_SCORE) * this.WEIGHT_FAIRNESS;
    score += (metrics.liquidity || 0) * this.WEIGHT_VALUE;
    score += (1 - (metrics.complexity || 0)) * this.WEIGHT_EFFICIENCY;
    score += (metrics.demand || 0) * this.WEIGHT_COMPLETION;
    score += (metrics.value || 0) * this.WEIGHT_VALUE;
    score += (metrics.diversity || 0) * this.WEIGHT_VALUE;
    score += (metrics.priceDataQuality || 0) * this.WEIGHT_VALUE;
    
    // NEW: Collection-specific weights
    const COLLECTION_DIVERSITY_WEIGHT = 0.08;
    const CROSS_COLLECTION_WEIGHT = 0.05;
    const COLLECTION_QUALITY_WEIGHT = 0.10;
    const COLLECTION_RESOLUTION_WEIGHT = 0.05;
    
    score += (metrics.collectionDiversity || 0) * COLLECTION_DIVERSITY_WEIGHT;
    score += (metrics.crossCollectionBonus || 0) * CROSS_COLLECTION_WEIGHT;
    score += (metrics.collectionQuality || 0) * COLLECTION_QUALITY_WEIGHT;
    score += (metrics.collectionResolution || 0) * COLLECTION_RESOLUTION_WEIGHT;
    
    // Apply collection bonus multiplier for exceptional trades
    if (metrics.collectionDiversity > 0.8 && metrics.crossCollectionBonus > 0) {
      score *= 1.05; // 5% bonus for highly diverse cross-collection trades
    }
    
    // Ensure score stays within bounds
    return Math.max(this.MIN_SCORE, Math.min(1.0, score));
  }

  /**
   * Calculate a comprehensive trade score based on multiple factors
   * @param trade The trade to evaluate
   * @returns A score object with the overall score and component metrics
   */
  public calculateTradeScoreOld(trade: TradeLoop, nftDemandMetrics?: Map<string, NFTDemandMetrics>): { score: number; metrics: Record<string, number> } {
    // Check cache first - avoid recalculating scores for the same trade
    if (this.scoreCache.has(trade.id)) {
      const cachedScore = this.scoreCache.get(trade.id)!;
      // Check if cache is still valid
      if (Date.now() - cachedScore.timestamp < this.SCORE_CACHE_TTL) {
        return {
          score: cachedScore.score,
          metrics: cachedScore.metrics
        };
      }
    }
    
    const operation = this.VERBOSE_LOGGING 
      ? this.logger.operation('calculateTradeScore')
      : null;
    
    if (operation) {
      operation.info(`Scoring trade`, { tradeId: trade.id, steps: trade.steps.length });
    }
    
    // Track NFT price availability
    let totalNfts = 0;
    let nftsWithRealPrices = 0;
    let nftsWithNoPrice = 0;
    const nftAddresses: string[] = [];
    const nftValues: number[] = [];
    const nftNames: string[] = [];
    
    if (operation) {
      operation.info('NFT Values in Trade:');
    }
    
    // Force initialize these properties if they don't exist to avoid broken flags
    // Process all NFTs in a single pass to collect all needed data
    for (const step of trade.steps) {
      for (const nft of step.nfts) {
        totalNfts++;
        
        // Initialize missing properties
        if (nft.usedRealPrice === undefined) {
          nft.usedRealPrice = (nft.floorPrice !== undefined && nft.floorPrice > 0);
        }
        if (nft.hasFloorPrice === undefined) {
          nft.hasFloorPrice = (nft.floorPrice !== undefined && nft.floorPrice > 0);
        }
        
        // Only do expensive logging if verbose mode is enabled
        if (operation) {
          const from = step.from.substring(0, 6) + "...";
          const to = step.to.substring(0, 6) + "...";
          operation.info(`Step: ${from} -> ${to}`);
          
          operation.info(`NFT: ${nft.name || nft.address.substring(0, 10) + "..."}`);
          operation.info(`  Floor Price: ${nft.floorPrice !== undefined ? nft.floorPrice.toFixed(4) : 'undefined'} SOL`);
          operation.info(`  usedRealPrice: ${nft.usedRealPrice}`);
          operation.info(`  hasFloorPrice: ${nft.hasFloorPrice}`);
          
          const priceType = nft.usedRealPrice ? "REAL" : "UNKNOWN";
          const priceDisplay = nft.floorPrice && nft.hasFloorPrice ? `${nft.floorPrice.toFixed(4)} SOL` : 'no floor price';
          
          if (nft.usedRealPrice && nft.hasFloorPrice && nft.floorPrice && nft.floorPrice > 0) {
            operation.info(`  → Using REAL price: ${nft.floorPrice.toFixed(4)} SOL`);
          } else {
            operation.info(`  → No valid price data - will apply penalty`);
          }
          
          operation.info(`  - ${nft.name || nft.address.substring(0, 10) + "..."}: ${priceDisplay} [${priceType}]`);
        }
        
        // Collect data for scoring calculations
        if (nft.usedRealPrice && nft.hasFloorPrice && nft.floorPrice && nft.floorPrice > 0) {
          nftsWithRealPrices++;
          nftValues.push(nft.floorPrice);
          nftAddresses.push(nft.address);
          nftNames.push(nft.name || nft.address.substring(0, 10) + '...');
        } else {
          nftsWithNoPrice++;
        }
      }
    }
    
    // Calculate a COMBINED directness score instead of separate efficiency and length scores
    // This consolidates both measures into a single score that rewards simple, direct trades
    if (operation) {
      operation.info(`\nDIRECTNESS CALCULATION:`);
      operation.info(`Trade has ${trade.steps.length} steps with ${trade.totalParticipants} participants`);
    }
    
    // Use rawEfficiency if available, otherwise use the regular efficiency
    const rawEfficiencyValue = trade.rawEfficiency !== undefined ? trade.rawEfficiency : trade.efficiency;
    
    // Blend efficiency and path length into a single directness score
    // 60% weight to raw efficiency, 40% weight to absolute path length - pre-calculate this
    const pathLengthFactor = Math.max(0.5, 1.0 - (trade.steps.length / 10));
    const directnessScore = (rawEfficiencyValue * 0.6) + (pathLengthFactor * 0.4);
    
    if (operation) {
      operation.info(`Raw efficiency: ${rawEfficiencyValue.toFixed(4)}`);
      operation.info(`Path length factor: ${pathLengthFactor.toFixed(4)}`);
      operation.info(`Combined directness score: ${directnessScore.toFixed(4)}`);
      
      // Directness score interpretation
      let directnessExplanation = "";
      if (directnessScore > 0.9) {
        directnessExplanation = "Excellent - Very direct trade";
      } else if (directnessScore > 0.7) {
        directnessExplanation = "Good - Reasonably direct trade";
      } else if (directnessScore > 0.5) {
        directnessExplanation = "Average - Moderately complex trade";
      } else {
        directnessExplanation = "Complex - Indirect trade with many steps";
      }
      operation.info(`Directness interpretation: ${directnessExplanation} (${(directnessScore * 100).toFixed(0)}%)`);
    }
    
    // Fairness score - how evenly distributed the value is
    const fairnessScore = this.calculateFairnessScore(nftValues, nftNames, operation);
    
    // Demand score - how wanted are the NFTs in this trade
    const demandScore = this.calculateDemandScore(nftAddresses, nftDemandMetrics, operation);
    
    // Price availability penalty - reduce score for trades with NFTs that have no floor price
    // Scale penalty based on the percentage of NFTs without prices
    // In case there are no real prices (all NFTs in this trade lack price data), prevent a penalty of 0
    const priceAvailabilityRatio = totalNfts > 0 ? Math.max(0.1, (totalNfts - nftsWithNoPrice) / totalNfts) : 0.1;
    
    // A less aggressive penalty formula
    const priceAvailabilityScore = 0.4 + (0.6 * priceAvailabilityRatio);
    
    if (operation) {
      operation.info(`\nSCORE COMPONENTS SUMMARY:`);
      operation.info(`Real floor price data: ${nftsWithRealPrices}/${totalNfts} NFTs`);
      operation.info(`NFTs without floor prices: ${nftsWithNoPrice}/${totalNfts}`);
      operation.info(`Price availability ratio: ${priceAvailabilityRatio.toFixed(4)}`);
      operation.info(`Price availability score: ${priceAvailabilityScore.toFixed(4)}`);
      operation.info(`Directness: ${directnessScore.toFixed(4)}`);
      operation.info(`Fairness: ${fairnessScore.toFixed(4)}${nftsWithRealPrices < 2 ? ' (USING DEFAULT 0.7 - INSUFFICIENT PRICE DATA)' : ''}`);
      operation.info(`Demand: ${demandScore.toFixed(4)}`);
    }
    
    // Calculate weighted score with UPDATED WEIGHTS
    // Directness: 40% (combined efficiency and length)
    // Fairness: 30% (unchanged)
    // Demand: 30% (increased from 20%)
    const weightedBeforePenalty = (
      directnessScore * 0.4 +
      fairnessScore * 0.3 +
      demandScore * 0.3
    );
    
    // Calculate the weighted score with price availability penalty
    let weightedScore = weightedBeforePenalty * priceAvailabilityScore;
    
    // Ensure a minimum score rather than showing 0%
    weightedScore = Math.max(this.MIN_SCORE, weightedScore);
    
    if (operation) {
      // Log the final score calculation
      operation.info(`\nFINAL SCORE CALCULATION:`);
      operation.info(`Base Score: (${directnessScore.toFixed(4)} * 0.4 + ${fairnessScore.toFixed(4)} * 0.3 + ${demandScore.toFixed(4)} * 0.3) = ${weightedBeforePenalty.toFixed(4)}`);
      operation.info(`With price penalty: ${weightedBeforePenalty.toFixed(4)} * ${priceAvailabilityScore.toFixed(4)} = ${(weightedBeforePenalty * priceAvailabilityScore).toFixed(4)}`);
      operation.info(`Final score with minimum applied: ${weightedScore.toFixed(4)}`);
      operation.info(`Final score percentage: ${(weightedScore * 100).toFixed(2)}%`);
      
      if (weightedScore < 0.01) {
        operation.warn(`WARNING: Score is extremely low or zero! Check for calculation issues.`);
        // Debug issue with zero score
        if (priceAvailabilityScore < 0.01) {
          operation.warn(`  → Price availability score (${priceAvailabilityScore.toFixed(4)}) is causing the zero score`);
        }
        if (weightedBeforePenalty < 0.01) {
          operation.warn(`  → Base weighted score (${weightedBeforePenalty.toFixed(4)}) is causing the zero score`);
        }
      }
    }
    
    // Store component metrics for reference
    const metrics = {
      efficiency: directnessScore,
      value: fairnessScore,
      fairness: fairnessScore,
      completion: 0.5, // Placeholder for completion score
      participantCount: trade.totalParticipants,
      stepCount: trade.steps.length,
      nftCount: totalNfts
    };
    
    // Cache the result for future use
    this.scoreCache.set(trade.id, {
      score: weightedScore,
      metrics,
      timestamp: Date.now()
    });
    
    if (operation) {
      operation.end();
    }
    
    return {
      score: weightedScore,
      metrics
    };
  }
  
  /**
   * Calculate how fair the trade is (equal value distribution)
   */
  private calculateFairnessScore(nftValues: number[], nftNames: string[], operation: any | null = null): number {
    // If we have no NFT values at all, return minimum fairness
    if (nftValues.length === 0) {
      if (operation) {
        operation.info(`\nFAIRNESS CALCULATION: No NFT values available`);
      }
      return 0.3; // Severe penalty for no data
    }
    
    // For single NFT or direct trades, calculate fairness based on data availability
    if (nftValues.length === 1) {
      // For a single NFT, fairness depends on whether we have price data
      // If we have the price, it's inherently "fair" as there's nothing to compare
      if (operation) {
        operation.info(`\nFAIRNESS CALCULATION: Single NFT trade`);
        operation.info(`Returning fairness score of 0.85 for single NFT with price data`);
      }
      return 0.85; // Good fairness for single NFT with known price
    }
    
    // For trades with limited price data, apply graduated penalties
    const totalNftsInTrade = nftNames.length;
    const nftsWithPrices = nftValues.length;
    const dataCompleteness = nftsWithPrices / totalNftsInTrade;
    
    if (operation) {
      operation.info(`\nFAIRNESS CALCULATION:`);
      operation.info(`Total NFTs in trade: ${totalNftsInTrade}`);
      operation.info(`NFTs with price data: ${nftsWithPrices} (${(dataCompleteness * 100).toFixed(1)}%)`);
    }
    
    // If we have very incomplete data, calculate a penalized fairness score
    if (dataCompleteness < 0.5) {
      // Less than 50% of NFTs have prices - apply significant penalty
      const penaltyFactor = 0.3 + (dataCompleteness * 0.4); // Range: 0.3 to 0.5
      if (operation) {
        operation.info(`Insufficient price data (${(dataCompleteness * 100).toFixed(1)}%)`);
        operation.info(`Applying penalty factor: ${penaltyFactor.toFixed(2)}`);
      }
      return penaltyFactor;
    }
    
    // Calculate statistical fairness for NFTs with known values
    const mean = nftValues.reduce((sum, val) => sum + val, 0) / nftValues.length;
    
    // Calculate variance and standard deviation in a single pass
    let totalSquaredDiff = 0;
    for (const val of nftValues) {
      const diff = val - mean;
      totalSquaredDiff += diff * diff;
    }
    const variance = totalSquaredDiff / nftValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate coefficient of variation (CV) - lower is better
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;
    
    // Convert CV to a fairness score (0-1 range) where:
    // CV = 0 means perfect fairness (score = 1.0)
    // CV = 0.10 (10%) means acceptable fairness (score = 0.9)
    // CV >= 0.25 (25%) means poor fairness (score approaches 0)
    // Changed from the previous formula that was too strict (now allows ±10%)
    let baseFairnessScore;
    if (coefficientOfVariation <= 0.10) {
      // Allow up to 10% variance with minimal penalty
      baseFairnessScore = 1.0 - (coefficientOfVariation * 1.0); // Linear penalty up to 10%
    } else {
      // More aggressive penalty for variance above 10%
      baseFairnessScore = Math.max(0, 0.9 - ((coefficientOfVariation - 0.10) * 2.0));
    }
    
    // Apply a data completeness multiplier
    // If we have 100% data, no penalty. If we have 50% data, multiply by 0.75
    const dataCompletenessPenalty = 0.5 + (dataCompleteness * 0.5); // Range: 0.75 to 1.0
    const fairnessScore = baseFairnessScore * dataCompletenessPenalty;
    
    if (operation) {
      operation.info(`Statistical analysis of ${nftsWithPrices} NFTs with verified prices:`);
      operation.info(`Mean Value: ${mean.toFixed(2)} SOL`);
      operation.info(`Std Dev: ${stdDev.toFixed(2)} SOL`);
      operation.info(`Coefficient of Variation: ${coefficientOfVariation.toFixed(3)} (${(coefficientOfVariation * 100).toFixed(1)}%)`);
      operation.info(`Base Fairness Score: ${baseFairnessScore.toFixed(3)} (NEW: ±10% tolerance applied)`);
      operation.info(`Data Completeness Penalty: ${dataCompletenessPenalty.toFixed(2)}`);
      operation.info(`Final Fairness Score: ${fairnessScore.toFixed(3)}`);
      operation.info(`NFT Values:`);
      for (let i = 0; i < nftValues.length; i++) {
        operation.info(`  - ${nftNames[i]}: ${nftValues[i].toFixed(2)} SOL [REAL]`);
      }
    }
    
    return fairnessScore;
  }
  
  /**
   * Calculate how in-demand the NFTs in this trade are
   */
  private calculateDemandScore(nftAddresses: string[], demandMetrics?: Map<string, NFTDemandMetrics>, operation: any | null = null): number {
    if (nftAddresses.length === 0) {
      return 0.8; // Default if no NFTs found
    }
    
    // If we have demand metrics, use them
    if (demandMetrics && demandMetrics.size > 0) {
      // Calculate demand score based on the available metrics
      const demandScores: number[] = [];
      
      for (const nftAddress of nftAddresses) {
        const metrics = demandMetrics.get(nftAddress);
        let score = 0.5; // Default base score
        
        if (metrics) {
          // Demand score is based on:
          // 1. Demand ratio (# of people wanting this NFT divided by supply)
          // 2. Request count (popularity of this NFT)
          // 3. Recency of requests
          
          // Factor 1: Demand ratio (0-1 score based on want/supply ratio)
          const demandRatioScore = Math.min(1, metrics.demandRatio / 3);
          
          // Factor 2: Request count (0-1 score based on total requests)
          const requestCountScore = Math.min(1, metrics.requestCount / 10);
          
          // Factor 3: Recency of requests (0-1 score, higher for recent)
          let recencyScore = 0.5; // Default
          
          // Calculate how recent the last request was
          if (metrics.lastRequested) {
            try {
              // Make sure it's a Date object
              const lastRequested = new Date(metrics.lastRequested);
              const now = new Date();
              const ageInDays = (now.getTime() - lastRequested.getTime()) / (1000 * 60 * 60 * 24);
              
              // Score from 0-1 based on recency (within last 30 days)
              recencyScore = Math.max(0, 1 - (ageInDays / 30));
            } catch (error) {
              if (operation) {
                operation.warn(`Error calculating recency score`, { 
                  error: error instanceof Error ? error.message : String(error) 
                });
              }
              // Keep the default score if there's an error
            }
          }
          
          // Combine all factors with weights
          // 50% demand ratio + 30% request count + 20% recency
          score = (demandRatioScore * 0.5) + (requestCountScore * 0.3) + (recencyScore * 0.2);
        }
        
        demandScores.push(score);
      }
      
      // Calculate average demand score across all NFTs
      if (demandScores.length > 0) {
        const averageDemandScore = demandScores.reduce((sum, score) => sum + score, 0) / demandScores.length;
        
        // Normalize to ensure score is between 0.5 and 1.0
        // This ensures even trades with low demand still get a reasonable score
        const normalizedDemandScore = 0.5 + (averageDemandScore * 0.5);
        
        if (operation) {
          operation.info(`\nDEMAND METRICS:`);
          operation.info(`Metrics available for ${demandScores.filter(s => s > 0.5).length} of ${nftAddresses.length} NFTs`);
          operation.info(`Average demand score: ${averageDemandScore.toFixed(2)}, normalized: ${normalizedDemandScore.toFixed(2)}`);
        }
        
        return normalizedDemandScore;
      }
    }
    
    // Fallback if no demand metrics available:
    // Use trade characteristics as proxy for demand
    
    // For now just use a base score with slight variation based on participant count
    // A trade with more participants might indicate higher demand
    const valueScore = 0.7; // Neutral base value
    const participantScore = Math.min(1, 0.5 + (nftAddresses.length / 10));
    
    // Combine scores
    const combinedScore = (valueScore * 0.7) + (participantScore * 0.3);
    
    // Normalize to ensure score is between 0.5 and 1.0
    const normalizedDemandScore = 0.5 + (combinedScore * 0.5);
    
    if (operation) {
      operation.info(`\nDEMAND METRICS (fallback):`);
      operation.info(`Value score: ${valueScore.toFixed(2)}, Participant score: ${participantScore.toFixed(2)}`);
      operation.info(`Combined score: ${combinedScore.toFixed(2)}, normalized: ${normalizedDemandScore.toFixed(2)}`);
    }
    
    return normalizedDemandScore;
  }
  
  /**
   * Clear the score cache
   */
  public clearCache(): void {
    this.scoreCache.clear();
    this.logger.info('Trade score cache cleared');
  }
  
  /**
   * Clean expired entries from the score cache
   */
  public cleanupCache(): void {
    const now = Date.now();
    let expiredEntries = 0;
    
    for (const [key, entry] of this.scoreCache.entries()) {
      if (now - entry.timestamp > this.SCORE_CACHE_TTL) {
        this.scoreCache.delete(key);
        expiredEntries++;
      }
    }
    
    if (expiredEntries > 0) {
      this.logger.info(`Removed ${expiredEntries} expired score cache entries`);
    }
  }

  /**
   * Simple liquidity score calculation
   */
  private calculateLiquidityScoreSimple(trade: TradeLoop, nftDemandMetrics?: Map<string, NFTDemandMetrics>): number {
    // Count NFTs with demand metrics as more liquid
    const allNfts = trade.steps.flatMap(step => step.nfts);
    if (!nftDemandMetrics || allNfts.length === 0) return 0.7;
    
    const nftsWithDemand = allNfts.filter(nft => nftDemandMetrics.has(nft.address));
    return 0.5 + (nftsWithDemand.length / allNfts.length) * 0.5;
  }

  /**
   * Simple complexity penalty calculation
   */
  private calculateComplexityPenaltySimple(trade: TradeLoop): number {
    // Penalty based on number of participants and steps
    const participantPenalty = Math.min(0.3, (trade.totalParticipants - 2) * 0.05);
    const stepPenalty = Math.min(0.2, (trade.steps.length - 2) * 0.03);
    return participantPenalty + stepPenalty;
  }

  /**
   * Simple value score calculation
   */
  private calculateValueScoreSimple(nftValues: number[]): number {
    if (nftValues.length === 0) return 0.5;
    
    const totalValue = nftValues.reduce((sum, val) => sum + val, 0);
    const avgValue = totalValue / nftValues.length;
    
    // Score based on average value (higher values get higher scores)
    if (avgValue > 1.0) return 1.0;        // > 1 SOL
    if (avgValue > 0.5) return 0.9;        // > 0.5 SOL  
    if (avgValue > 0.1) return 0.8;        // > 0.1 SOL
    if (avgValue > 0.01) return 0.6;       // > 0.01 SOL
    return 0.4;                            // <= 0.01 SOL
  }

  /**
   * Simple diversity score calculation
   */
  private calculateDiversityScoreSimple(allNfts: Array<{ address: string; collection?: string; [key: string]: any }>): number {
    if (allNfts.length <= 1) return 0.5;
    
    // Count unique collections
    const collections = new Set(allNfts.map(nft => nft.collection || nft.address).filter(c => c));
    const uniqueCollections = collections.size;
    
    // Score based on collection diversity
    const diversityRatio = uniqueCollections / allNfts.length;
    return Math.min(1.0, 0.5 + diversityRatio);
  }

  /**
   * Simple price data quality calculation
   */
  private calculatePriceDataQualitySimple(allNfts: Array<{ floorPrice?: number; hasFloorPrice?: boolean; [key: string]: any }>): number {
    if (allNfts.length === 0) return 0.5;
    
    const nftsWithPrices = allNfts.filter(nft => 
      nft.floorPrice !== undefined && 
      nft.floorPrice > 0 && 
      nft.hasFloorPrice
    );
    
    const priceDataRatio = nftsWithPrices.length / allNfts.length;
    return 0.3 + (priceDataRatio * 0.7); // Scale from 30% to 100%
  }
} 