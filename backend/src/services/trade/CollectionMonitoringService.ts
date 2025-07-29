import { CollectionExpansionMetrics, CollectionTradeAnalytics } from '../../types/trade';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { CollectionConfigService } from './CollectionConfigService';

/**
 * Real-time monitoring service for collection feature health
 * Tracks actual usage patterns and identifies issues in production
 */
export class CollectionMonitoringService {
  private static instance: CollectionMonitoringService;
  private logger: Logger;
  private configService: CollectionConfigService;
  
  // Real-time health metrics
  private healthMetrics = {
    expansionFailures: new Map<string, number>(),
    slowExpansions: new Map<string, number>(),
    emptyExpansions: new Map<string, number>(),
    apiTimeouts: new Map<string, number>(),
    rateLimitHits: new Map<string, number>()
  };
  
  // Performance thresholds
  private readonly SLOW_EXPANSION_THRESHOLD = 2000; // 2 seconds
  private readonly FAILURE_THRESHOLD = 5; // 5 failures before alerting
  
  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('CollectionMonitoring');
    this.configService = CollectionConfigService.getInstance();
    
    // Start monitoring intervals
    this.startHealthChecks();
  }
  
  public static getInstance(): CollectionMonitoringService {
    if (!CollectionMonitoringService.instance) {
      CollectionMonitoringService.instance = new CollectionMonitoringService();
    }
    return CollectionMonitoringService.instance;
  }
  
  /**
   * Monitor a collection expansion in real-time
   */
  public monitorExpansion(
    collectionId: string,
    metrics: CollectionExpansionMetrics
  ): void {
    // Track slow expansions
    if (metrics.expansionTime > this.SLOW_EXPANSION_THRESHOLD) {
      const count = (this.healthMetrics.slowExpansions.get(collectionId) || 0) + 1;
      this.healthMetrics.slowExpansions.set(collectionId, count);
      
      this.logger.warn('Slow collection expansion detected', {
        collectionId,
        expansionTime: metrics.expansionTime,
        threshold: this.SLOW_EXPANSION_THRESHOLD,
        occurrences: count
      });
    }
    
    // Track empty expansions
    if (metrics.expandedSize === 0) {
      const count = (this.healthMetrics.emptyExpansions.get(collectionId) || 0) + 1;
      this.healthMetrics.emptyExpansions.set(collectionId, count);
      
      if (count >= this.FAILURE_THRESHOLD) {
        this.logger.error('Collection consistently returning empty results', {
          collectionId,
          failures: count
        });
      }
    }
    
    // Track rate limit hits
    if (metrics.hitRateLimit) {
      const count = (this.healthMetrics.rateLimitHits.get(collectionId) || 0) + 1;
      this.healthMetrics.rateLimitHits.set(collectionId, count);
    }
  }
  
  /**
   * Record an expansion failure
   */
  public recordExpansionFailure(
    collectionId: string,
    error: Error,
    context: Record<string, any>
  ): void {
    const count = (this.healthMetrics.expansionFailures.get(collectionId) || 0) + 1;
    this.healthMetrics.expansionFailures.set(collectionId, count);
    
    // Log with increasing severity based on failure count
    if (count >= this.FAILURE_THRESHOLD * 2) {
      this.logger.error('Critical: Collection expansion repeatedly failing', {
        collectionId,
        failures: count,
        error: error.message,
        ...context
      });
    } else if (count >= this.FAILURE_THRESHOLD) {
      this.logger.warn('Collection expansion failures exceeding threshold', {
        collectionId,
        failures: count,
        error: error.message,
        ...context
      });
    }
  }
  
  /**
   * Get health report for a specific collection
   */
  public getCollectionHealth(collectionId: string): {
    healthy: boolean;
    issues: string[];
    metrics: Record<string, number>;
  } {
    const issues: string[] = [];
    const metrics: Record<string, number> = {};
    
    // Check failure rate
    const failures = this.healthMetrics.expansionFailures.get(collectionId) || 0;
    if (failures > 0) {
      metrics.failures = failures;
      if (failures >= this.FAILURE_THRESHOLD) {
        issues.push(`High failure rate: ${failures} failures`);
      }
    }
    
    // Check performance
    const slowCount = this.healthMetrics.slowExpansions.get(collectionId) || 0;
    if (slowCount > 0) {
      metrics.slowExpansions = slowCount;
      if (slowCount >= this.FAILURE_THRESHOLD) {
        issues.push(`Performance degradation: ${slowCount} slow expansions`);
      }
    }
    
    // Check empty results
    const emptyCount = this.healthMetrics.emptyExpansions.get(collectionId) || 0;
    if (emptyCount > 0) {
      metrics.emptyResults = emptyCount;
      if (emptyCount >= this.FAILURE_THRESHOLD) {
        issues.push(`No NFTs found: ${emptyCount} empty results`);
      }
    }
    
    // Check rate limits
    const rateLimitCount = this.healthMetrics.rateLimitHits.get(collectionId) || 0;
    if (rateLimitCount > 0) {
      metrics.rateLimitHits = rateLimitCount;
      if (rateLimitCount >= 10) {
        issues.push(`Rate limiting: ${rateLimitCount} hits`);
      }
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      metrics
    };
  }
  
  /**
   * Get system-wide health report
   */
  public getSystemHealth(): {
    healthy: boolean;
    totalIssues: number;
    problematicCollections: Array<{
      collectionId: string;
      issues: string[];
    }>;
    summary: Record<string, number>;
  } {
    const problematicCollections: Array<{ collectionId: string; issues: string[] }> = [];
    let totalIssues = 0;
    
    // Check all tracked collections
    const allCollections = new Set<string>();
    for (const map of Object.values(this.healthMetrics)) {
      for (const collectionId of map.keys()) {
        allCollections.add(collectionId);
      }
    }
    
    for (const collectionId of allCollections) {
      const health = this.getCollectionHealth(collectionId);
      if (!health.healthy) {
        problematicCollections.push({
          collectionId,
          issues: health.issues
        });
        totalIssues += health.issues.length;
      }
    }
    
    // Calculate summary metrics
    const summary = {
      totalCollectionsMonitored: allCollections.size,
      collectionsWithIssues: problematicCollections.length,
      totalFailures: Array.from(this.healthMetrics.expansionFailures.values())
        .reduce((sum, count) => sum + count, 0),
      totalSlowExpansions: Array.from(this.healthMetrics.slowExpansions.values())
        .reduce((sum, count) => sum + count, 0),
      totalEmptyResults: Array.from(this.healthMetrics.emptyExpansions.values())
        .reduce((sum, count) => sum + count, 0),
      totalRateLimitHits: Array.from(this.healthMetrics.rateLimitHits.values())
        .reduce((sum, count) => sum + count, 0)
    };
    
    return {
      healthy: problematicCollections.length === 0,
      totalIssues,
      problematicCollections: problematicCollections.slice(0, 10), // Top 10
      summary
    };
  }
  
  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    // Check system health every 5 minutes
    setInterval(() => {
      const health = this.getSystemHealth();
      
      if (!health.healthy) {
        this.logger.warn('Collection system health check failed', {
          issues: health.totalIssues,
          problematicCollections: health.problematicCollections.length,
          summary: health.summary
        });
      }
      
      // Auto-disable collections with critical issues
      for (const { collectionId, issues } of health.problematicCollections) {
        if (issues.length >= 3) { // Multiple critical issues
          this.logger.error('Auto-disabling problematic collection', {
            collectionId,
            issues
          });
          // Could implement auto-disable logic here
        }
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    // Clean up old metrics every hour
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 60 * 60 * 1000);
  }
  
  /**
   * Clean up metrics for collections that haven't had issues recently
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    
    // For now, just log what we would clean up
    // In production, you might want to actually clean these up
    const totalMetrics = 
      this.healthMetrics.expansionFailures.size +
      this.healthMetrics.slowExpansions.size +
      this.healthMetrics.emptyExpansions.size +
      this.healthMetrics.rateLimitHits.size;
    
    this.logger.info('Health metrics status', {
      totalMetricsTracked: totalMetrics,
      wouldCleanup: 'Not implemented - keeping all metrics for analysis'
    });
  }
  
  /**
   * Export metrics for external monitoring systems
   */
  public exportMetrics(): Record<string, any> {
    const systemHealth = this.getSystemHealth();
    const config = this.configService.getConfig();
    const systemStats = this.configService.getSystemStats();
    
    return {
      timestamp: new Date().toISOString(),
      health: {
        status: systemHealth.healthy ? 'healthy' : 'degraded',
        issues: systemHealth.totalIssues,
        ...systemHealth.summary
      },
      configuration: {
        enabled: config.enabled,
        limits: {
          maxCollectionSize: config.maxCollectionSize,
          maxCollectionsPerWallet: config.maxCollectionsPerWallet,
          maxExpansionPerRequest: config.maxExpansionPerRequest
        }
      },
      performance: {
        averageExpansionTime: systemStats.averageExpansionTime,
        samplingRate: systemStats.samplingRate,
        totalExpansions: systemStats.totalExpansions
      },
      topIssues: systemHealth.problematicCollections.slice(0, 5)
    };
  }
} 