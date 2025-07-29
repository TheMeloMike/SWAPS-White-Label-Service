import { NFTDemandMetrics } from '../../types/trade';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { NFTPricingService } from '../nft/NFTPricingService';

/**
 * Service for dynamic NFT valuation based on SWAPS network effects
 * Creates internal valuations that reflect true demand within the trading network
 */
export class DynamicValuationService {
  private static instance: DynamicValuationService;
  private logger: Logger;
  private nftPricingService: NFTPricingService;
  
  // Valuation cache with time decay
  private valuationCache = new Map<string, {
    baseValue: number;
    dynamicValue: number;
    confidence: number;
    lastUpdated: number;
    factors: {
      floorPrice: number;
      demandMultiplier: number;
      velocityMultiplier: number;
      scarcityMultiplier: number;
      networkEffect: number;
    };
  }>();
  
  // Network-wide metrics
  private networkMetrics = {
    totalTrades: 0,
    averageTradeVelocity: 0,
    networkLiquidity: 0,
    lastUpdated: Date.now()
  };
  
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly CONFIDENCE_DECAY_RATE = 0.95; // Confidence decays 5% per hour

  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('DynamicValuation');
    this.nftPricingService = NFTPricingService.getInstance();
    
    // Start periodic confidence decay
    setInterval(() => this.decayConfidence(), 60 * 60 * 1000); // Every hour
  }

  public static getInstance(): DynamicValuationService {
    if (!DynamicValuationService.instance) {
      DynamicValuationService.instance = new DynamicValuationService();
    }
    return DynamicValuationService.instance;
  }

  /**
   * Calculate dynamic valuation for an NFT based on SWAPS network activity
   */
  public async calculateDynamicValue(
    nftAddress: string,
    demandMetrics?: NFTDemandMetrics,
    context?: {
      recentTrades?: number;
      collectionActivity?: number;
      userSegment?: 'whale' | 'active' | 'casual';
    }
  ): Promise<{
    value: number;
    confidence: number;
    breakdown: any;
  }> {
    // Check cache first
    const cached = this.valuationCache.get(nftAddress);
    if (cached && Date.now() - cached.lastUpdated < this.CACHE_TTL) {
      return {
        value: cached.dynamicValue,
        confidence: cached.confidence,
        breakdown: cached.factors
      };
    }
    
    // Start with floor price as base
    let baseValue = 0;
    let hasFloorPrice = false;
    
    try {
      const floorPrice = await this.nftPricingService.estimateNFTPrice(nftAddress);
      if (floorPrice && floorPrice > 0) {
        baseValue = floorPrice;
        hasFloorPrice = true;
      }
    } catch (error) {
      this.logger.debug('No floor price available', { nft: nftAddress });
    }
    
    // If no floor price, use network average as base
    if (!hasFloorPrice) {
      baseValue = this.networkMetrics.averageTradeVelocity > 0 ? 0.5 : 0.1; // Default SOL values
    }
    
    // Calculate multipliers
    const factors = {
      floorPrice: baseValue,
      demandMultiplier: this.calculateDemandMultiplier(demandMetrics),
      velocityMultiplier: this.calculateVelocityMultiplier(context?.recentTrades || 0),
      scarcityMultiplier: this.calculateScarcityMultiplier(demandMetrics),
      networkEffect: this.calculateNetworkEffect(demandMetrics, context)
    };
    
    // Apply multipliers with diminishing returns
    let dynamicValue = baseValue;
    
    // Demand can increase value up to 2x
    dynamicValue *= (1 + (factors.demandMultiplier - 1) * 0.5);
    
    // Velocity can increase value up to 1.5x
    dynamicValue *= (1 + (factors.velocityMultiplier - 1) * 0.3);
    
    // Scarcity can increase value up to 1.3x
    dynamicValue *= (1 + (factors.scarcityMultiplier - 1) * 0.2);
    
    // Network effect can increase value up to 1.4x
    dynamicValue *= factors.networkEffect;
    
    // Calculate confidence based on data availability
    let confidence = 0.5; // Base confidence
    
    if (hasFloorPrice) confidence += 0.2;
    if (demandMetrics && demandMetrics.wantCount > 0) confidence += 0.15;
    if (context?.recentTrades && context.recentTrades > 0) confidence += 0.1;
    if (this.networkMetrics.totalTrades > 100) confidence += 0.05;
    
    // Cap confidence at 0.95
    confidence = Math.min(0.95, confidence);
    
    // Update cache
    this.valuationCache.set(nftAddress, {
      baseValue,
      dynamicValue,
      confidence,
      lastUpdated: Date.now(),
      factors
    });
    
    this.logger.debug('Calculated dynamic value', {
      nft: nftAddress,
      baseValue,
      dynamicValue,
      confidence,
      factors
    });
    
    return {
      value: dynamicValue,
      confidence,
      breakdown: factors
    };
  }

  /**
   * Calculate demand multiplier based on want/supply ratio
   */
  private calculateDemandMultiplier(demandMetrics?: NFTDemandMetrics): number {
    if (!demandMetrics || demandMetrics.wantCount === 0) {
      return 1.0; // No demand data, neutral multiplier
    }
    
    // Basic demand ratio
    const demandRatio = demandMetrics.demandRatio || 0;
    
    // Logarithmic scaling to prevent extreme values
    // demandRatio of 1 = 1.2x, 2 = 1.35x, 5 = 1.6x, 10 = 1.8x
    const multiplier = 1 + (Math.log10(demandRatio + 1) * 0.4);
    
    // Cap at 2x to prevent runaway valuations
    return Math.min(2.0, multiplier);
  }

  /**
   * Calculate velocity multiplier based on recent trade activity
   */
  private calculateVelocityMultiplier(recentTrades: number): number {
    if (recentTrades === 0) return 1.0;
    
    // Higher velocity = more liquid = more valuable
    // 1 trade = 1.05x, 5 trades = 1.2x, 10 trades = 1.35x
    const multiplier = 1 + (Math.log10(recentTrades + 1) * 0.15);
    
    return Math.min(1.5, multiplier);
  }

  /**
   * Calculate scarcity multiplier based on supply/demand imbalance
   */
  private calculateScarcityMultiplier(demandMetrics?: NFTDemandMetrics): number {
    if (!demandMetrics) return 1.0;
    
    // If supply is 1 and demand > 1, it's scarce
    const scarcityFactor = demandMetrics.supplyCount > 0 
      ? demandMetrics.wantCount / demandMetrics.supplyCount 
      : 0;
    
    if (scarcityFactor <= 1) return 1.0; // Not scarce
    
    // Scarcity bonus: 2:1 = 1.1x, 5:1 = 1.2x, 10:1 = 1.3x
    const multiplier = 1 + (Math.log10(scarcityFactor) * 0.15);
    
    return Math.min(1.3, multiplier);
  }

  /**
   * Calculate network effect multiplier
   * NFTs involved in more potential trades are more valuable
   */
  private calculateNetworkEffect(
    demandMetrics?: NFTDemandMetrics,
    context?: any
  ): number {
    let networkScore = 1.0;
    
    // Factor 1: Number of potential trade paths
    if (demandMetrics && demandMetrics.wantCount > 0) {
      // More people wanting = more trade paths
      const pathBonus = Math.log10(demandMetrics.wantCount + 1) * 0.1;
      networkScore += pathBonus;
    }
    
    // Factor 2: Collection network effect
    if (context?.collectionActivity) {
      // Active collections get a bonus
      const collectionBonus = Math.min(0.2, context.collectionActivity / 100);
      networkScore += collectionBonus;
    }
    
    // Factor 3: User segment bonus
    if (context?.userSegment === 'whale') {
      networkScore *= 1.1; // Whales create more liquidity
    } else if (context?.userSegment === 'active') {
      networkScore *= 1.05; // Active traders increase velocity
    }
    
    return Math.min(1.4, networkScore);
  }

  /**
   * Update network-wide metrics based on completed trades
   */
  public updateNetworkMetrics(trades: Array<{
    value: number;
    participants: number;
    timestamp: number;
  }>): void {
    this.networkMetrics.totalTrades += trades.length;
    
    // Calculate average velocity (trades per day)
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    const recentTrades = trades.filter(t => now - t.timestamp < dayInMs).length;
    
    // Exponential moving average
    this.networkMetrics.averageTradeVelocity = 
      this.networkMetrics.averageTradeVelocity * 0.9 + recentTrades * 0.1;
    
    // Update network liquidity estimate
    const totalValue = trades.reduce((sum, t) => sum + t.value, 0);
    this.networkMetrics.networkLiquidity = 
      this.networkMetrics.networkLiquidity * 0.95 + totalValue * 0.05;
    
    this.networkMetrics.lastUpdated = now;
  }

  /**
   * Decay confidence values over time
   */
  private decayConfidence(): void {
    const now = Date.now();
    let decayedCount = 0;
    
    for (const [nft, cached] of this.valuationCache) {
      const hoursSinceUpdate = (now - cached.lastUpdated) / (60 * 60 * 1000);
      
      if (hoursSinceUpdate > 1) {
        // Apply decay
        cached.confidence *= Math.pow(this.CONFIDENCE_DECAY_RATE, hoursSinceUpdate);
        
        // Remove if confidence too low
        if (cached.confidence < 0.1) {
          this.valuationCache.delete(nft);
          decayedCount++;
        }
      }
    }
    
    if (decayedCount > 0) {
      this.logger.info(`Removed ${decayedCount} low-confidence valuations`);
    }
  }

  /**
   * Get valuation comparison between floor price and dynamic value
   */
  public async getValuationComparison(nftAddress: string): Promise<{
    floorPrice: number | null;
    dynamicValue: number;
    premium: number;
    confidence: number;
  }> {
    const dynamic = await this.calculateDynamicValue(nftAddress);
    let floorPrice: number | null = null;
    
    try {
      floorPrice = await this.nftPricingService.estimateNFTPrice(nftAddress);
    } catch (error) {
      // Continue without floor price
    }
    
    const premium = floorPrice && floorPrice > 0 
      ? ((dynamic.value - floorPrice) / floorPrice) * 100 
      : 0;
    
    return {
      floorPrice,
      dynamicValue: dynamic.value,
      premium,
      confidence: dynamic.confidence
    };
  }
} 