/**
 * UnifiedTradeDiscoveryEngine
 * 
 * A single, optimized trade discovery service that replaces all existing 
 * redundant cycle detection algorithms with the CanonicalCycleEngine.
 * 
 * This engine provides:
 * - Canonical cycle discovery (eliminates permutation explosion)
 * - Efficient SCC-based preprocessing  
 * - Configurable discovery modes
 * - Performance monitoring and scaling
 * - Backward compatibility with existing interfaces
 */

import { performance } from 'perf_hooks';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { TradeLoop, WalletState, TradeDiscoverySettings } from '../../types/trade';
import { CanonicalCycleEngine, CycleEngineConfig } from './CanonicalCycleEngine';
import { NFTPricingService } from '../nft/NFTPricingService';
import { TradeScoreService } from './TradeScoreService';

export interface UnifiedDiscoveryConfig {
  // Core discovery settings
  maxDepth: number;
  minEfficiency: number;
  maxResults: number;
  timeoutMs: number;
  
  // Algorithm selection
  enableBundleDetection: boolean;
  enableCollectionTrading: boolean;
  canonicalOnly: boolean;
  
  // Performance tuning
  maxCyclesPerSCC: number;
  enableParallelProcessing: boolean;
  
  // Quality filters
  minParticipants: number;
  maxParticipants: number;
  qualityThreshold: number;
}

export interface DiscoveryResult {
  trades: TradeLoop[];
  performance: {
    totalTimeMs: number;
    cycleDiscoveryMs: number;
    scoringMs: number;
    sccsProcessed: number;
    canonicalCycles: number;
    permutationsEliminated: number;
    qualityFiltered: number;
  };
  quality: {
    averageQuality: number;
    averageEfficiency: number;
    participantDistribution: Record<string, number>;
  };
}

export class UnifiedTradeDiscoveryEngine {
  private static instance: UnifiedTradeDiscoveryEngine;
  private logger: Logger;
  private canonicalEngine: CanonicalCycleEngine;
  private nftPricingService: NFTPricingService;
  private tradeScoreService: TradeScoreService;
  
  // Performance tracking
  private metrics = {
    totalDiscoveries: 0,
    totalCyclesFound: 0,
    totalPermutationsEliminated: 0,
    averageDiscoveryTime: 0
  };

  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('UnifiedTradeDiscovery');
    this.canonicalEngine = CanonicalCycleEngine.getInstance();
    this.nftPricingService = NFTPricingService.getInstance();
    this.tradeScoreService = TradeScoreService.getInstance();
  }

  public static getInstance(): UnifiedTradeDiscoveryEngine {
    if (!UnifiedTradeDiscoveryEngine.instance) {
      UnifiedTradeDiscoveryEngine.instance = new UnifiedTradeDiscoveryEngine();
    }
    return UnifiedTradeDiscoveryEngine.instance;
  }

  /**
   * Main entry point for unified trade discovery
   * Replaces all existing findAllTradeLoops methods across different services
   */
  public async discoverTrades(
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    config: UnifiedDiscoveryConfig
  ): Promise<DiscoveryResult> {
    const startTime = performance.now();
    const operation = this.logger.operation('discoverTrades');
    
    operation.info('Starting unified trade discovery', {
      wallets: wallets.size,
      nfts: nftOwnership.size,
      wants: wantedNfts.size,
      config
    });

    try {
      // Phase 1: Canonical cycle discovery
      const cycleStartTime = performance.now();
      const cycleConfig: CycleEngineConfig = {
        maxDepth: config.maxDepth,
        timeoutMs: config.timeoutMs,
        maxCyclesPerSCC: config.maxCyclesPerSCC,
        enableBundleDetection: config.enableBundleDetection,
        canonicalOnly: config.canonicalOnly
      };
      
      const cycleResult = await this.canonicalEngine.discoverCanonicalCycles(
        wallets,
        nftOwnership,
        wantedNfts,
        cycleConfig
      );
      const cycleDiscoveryTime = performance.now() - cycleStartTime;
      
      // Phase 2: Quality scoring and filtering
      const scoringStartTime = performance.now();
      const scoredTrades = await this.scoreAndFilterTrades(
        cycleResult.cycles,
        config
      );
      const scoringTime = performance.now() - scoringStartTime;
      
      // Phase 3: Result limiting and final filtering
      const finalTrades = this.applyFinalFilters(scoredTrades, config);
      
      const totalTime = performance.now() - startTime;
      
      // Update metrics
      this.updateMetrics(cycleResult, totalTime);
      
      const result: DiscoveryResult = {
        trades: finalTrades,
        performance: {
          totalTimeMs: totalTime,
          cycleDiscoveryMs: cycleDiscoveryTime,
          scoringMs: scoringTime,
          sccsProcessed: cycleResult.metadata.sccsProcessed,
          canonicalCycles: cycleResult.metadata.canonicalCyclesReturned,
          permutationsEliminated: cycleResult.metadata.permutationsEliminated,
          qualityFiltered: scoredTrades.length - finalTrades.length
        },
        quality: this.calculateQualityMetrics(finalTrades)
      };
      
      operation.info('Unified trade discovery completed', {
        inputSize: { wallets: wallets.size, nfts: nftOwnership.size, wants: wantedNfts.size },
        output: { trades: result.trades.length },
        performance: result.performance,
        quality: result.quality
      });
      
      operation.end();
      return result;
      
    } catch (error) {
      operation.error('Error in unified trade discovery', {
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Backward compatibility method for existing TradeDiscoverySettings interface
   */
  public async findAllTradeLoops(
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences?: Map<string, any>,
    settings?: Partial<TradeDiscoverySettings>
  ): Promise<TradeLoop[]> {
    
    // Convert legacy settings to unified config
    const config: UnifiedDiscoveryConfig = {
      maxDepth: settings?.maxDepth || 10,
      minEfficiency: settings?.minEfficiency || 0.6,
      maxResults: settings?.maxResults || 100,
      timeoutMs: 30000,
      enableBundleDetection: true,
      enableCollectionTrading: settings?.considerCollections || false,
      canonicalOnly: true,
      maxCyclesPerSCC: 1000,
      enableParallelProcessing: false,
      minParticipants: 2,
      maxParticipants: 10,
      qualityThreshold: 0.5
    };
    
    const result = await this.discoverTrades(wallets, nftOwnership, wantedNfts, config);
    return result.trades;
  }

  /**
   * Score and filter trades based on quality metrics
   */
  private async scoreAndFilterTrades(
    trades: TradeLoop[],
    config: UnifiedDiscoveryConfig
  ): Promise<TradeLoop[]> {
    
    const scoredTrades: TradeLoop[] = [];
    
    for (const trade of trades) {
      // Apply participant filters
      if (trade.totalParticipants < config.minParticipants || 
          trade.totalParticipants > config.maxParticipants) {
        continue;
      }
      
      // Apply efficiency filter
      if (trade.efficiency < config.minEfficiency) {
        continue;
      }
      
      // Calculate comprehensive quality score
      const qualityResult = this.tradeScoreService.calculateTradeScore(trade, new Map());
      const enhancedTrade = {
        ...trade,
        qualityScore: qualityResult.score,
        qualityMetrics: qualityResult.metrics
      };
      
      // Apply quality threshold
      if (enhancedTrade.qualityScore >= config.qualityThreshold) {
        scoredTrades.push(enhancedTrade);
      }
    }
    
    // Sort by quality score (descending)
    return scoredTrades.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
  }

  /**
   * Apply final filters and result limiting
   */
  private applyFinalFilters(
    trades: TradeLoop[],
    config: UnifiedDiscoveryConfig
  ): TradeLoop[] {
    
    // Apply result limit
    const limitedTrades = trades.slice(0, config.maxResults);
    
    return limitedTrades;
  }

  /**
   * Calculate quality metrics for the result set
   */
  private calculateQualityMetrics(trades: TradeLoop[]) {
    if (trades.length === 0) {
      return {
        averageQuality: 0,
        averageEfficiency: 0,
        participantDistribution: {}
      };
    }
    
    const totalQuality = trades.reduce((sum, trade) => sum + (trade.qualityScore || 0), 0);
    const totalEfficiency = trades.reduce((sum, trade) => sum + trade.efficiency, 0);
    
    const participantDistribution: Record<string, number> = {};
    trades.forEach(trade => {
      const key = `${trade.totalParticipants}-party`;
      participantDistribution[key] = (participantDistribution[key] || 0) + 1;
    });
    
    return {
      averageQuality: totalQuality / trades.length,
      averageEfficiency: totalEfficiency / trades.length,
      participantDistribution
    };
  }

  /**
   * Update internal performance metrics
   */
  private updateMetrics(cycleResult: any, totalTime: number): void {
    this.metrics.totalDiscoveries++;
    this.metrics.totalCyclesFound += cycleResult.metadata.canonicalCyclesReturned;
    this.metrics.totalPermutationsEliminated += cycleResult.metadata.permutationsEliminated;
    
    // Update rolling average
    this.metrics.averageDiscoveryTime = 
      (this.metrics.averageDiscoveryTime * (this.metrics.totalDiscoveries - 1) + totalTime) / 
      this.metrics.totalDiscoveries;
  }

  /**
   * Get engine performance metrics
   */
  public getPerformanceMetrics() {
    return {
      ...this.metrics,
      canonicalEngineMetrics: this.canonicalEngine.getMetrics()
    };
  }

  /**
   * Reset engine state (useful for testing)
   */
  public reset(): void {
    this.canonicalEngine.reset();
    this.metrics = {
      totalDiscoveries: 0,
      totalCyclesFound: 0,
      totalPermutationsEliminated: 0,
      averageDiscoveryTime: 0
    };
  }

  /**
   * Configuration validation
   */
  public validateConfig(config: UnifiedDiscoveryConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (config.maxDepth < 2 || config.maxDepth > 20) {
      errors.push('maxDepth must be between 2 and 20');
    }
    
    if (config.minEfficiency < 0 || config.minEfficiency > 1) {
      errors.push('minEfficiency must be between 0 and 1');
    }
    
    if (config.maxResults < 1 || config.maxResults > 10000) {
      errors.push('maxResults must be between 1 and 10000');
    }
    
    if (config.timeoutMs < 1000) {
      errors.push('timeoutMs must be at least 1000ms');
    }
    
    if (config.minParticipants < 2) {
      errors.push('minParticipants must be at least 2');
    }
    
    if (config.maxParticipants < config.minParticipants) {
      errors.push('maxParticipants must be >= minParticipants');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
} 