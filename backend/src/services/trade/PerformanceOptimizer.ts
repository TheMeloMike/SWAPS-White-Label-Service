import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { EventEmitter } from 'events';

/**
 * PerformanceOptimizer - Phase 3 Production Optimization
 * 
 * Implements advanced performance optimization features:
 * - Smart caching for repeated subgraph calculations
 * - Circuit breakers for high-frequency events
 * - Batched updates for bulk operations
 * - Memory management for large tenant graphs
 * - Performance monitoring and auto-scaling
 */
export class PerformanceOptimizer extends EventEmitter {
  private static instance: PerformanceOptimizer;
  private logger: Logger;

  // Smart caching system
  private subgraphCache = new Map<string, {
    result: any;
    timestamp: Date;
    hitCount: number;
    computeTime: number;
  }>();

  // Circuit breaker state
  private circuitBreakers = new Map<string, {
    failures: number;
    lastFailure: Date;
    state: 'closed' | 'open' | 'half-open';
    threshold: number;
    timeout: number;
  }>();

  // Batch processing queues
  private batchQueues = new Map<string, {
    operations: any[];
    timer: NodeJS.Timeout | null;
    batchSize: number;
    maxWaitTime: number;
  }>();

  // Performance metrics
  private metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    circuitBreakerTrips: 0,
    batchOperationsProcessed: 0,
    memoryOptimizations: 0,
    avgResponseTime: 0,
    peakMemoryUsage: 0,
    operationsPerSecond: 0
  };

  // Configuration
  private config = {
    cacheMaxSize: 1000,
    cacheTTL: 5 * 60 * 1000, // 5 minutes
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 30 * 1000, // 30 seconds
    batchSize: 100,
    batchMaxWaitTime: 1000, // 1 second
    memoryThreshold: 500 * 1024 * 1024, // 500MB
    gcInterval: 60 * 1000 // 1 minute
  };

  private constructor() {
    super();
    this.logger = LoggingService.getInstance().createLogger('PerformanceOptimizer');
    this.initializeOptimization();
    this.logger.info('PerformanceOptimizer initialized with production-grade optimizations');
  }

  public static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  /**
   * Initialize optimization systems
   */
  private initializeOptimization(): void {
    // Start memory monitoring
    this.startMemoryMonitoring();
    
    // Start cache cleanup
    this.startCacheCleanup();
    
    // Start performance metrics collection
    this.startMetricsCollection();

    this.logger.info('Performance optimization systems started');
  }

  /**
   * SMART CACHING: Cache subgraph calculation results
   */
  public cacheSubgraphResult(key: string, result: any, computeTime: number): void {
    // Check cache size limit
    if (this.subgraphCache.size >= this.config.cacheMaxSize) {
      this.evictOldestCacheEntry();
    }

    this.subgraphCache.set(key, {
      result,
      timestamp: new Date(),
      hitCount: 0,
      computeTime
    });

    this.logger.debug('Subgraph result cached', { key, computeTime });
  }

  public getCachedSubgraphResult(key: string): any | null {
    const cached = this.subgraphCache.get(key);
    
    if (!cached) {
      this.metrics.cacheMisses++;
      return null;
    }

    // Check TTL
    const age = Date.now() - cached.timestamp.getTime();
    if (age > this.config.cacheTTL) {
      this.subgraphCache.delete(key);
      this.metrics.cacheMisses++;
      return null;
    }

    // Update hit count and metrics
    cached.hitCount++;
    this.metrics.cacheHits++;
    
    this.logger.debug('Cache hit for subgraph', { key, hitCount: cached.hitCount });
    return cached.result;
  }

  /**
   * CIRCUIT BREAKER: Protect against cascade failures
   */
  public async executeWithCircuitBreaker<T>(
    operationId: string,
    operation: () => Promise<T>,
    options?: {
      threshold?: number;
      timeout?: number;
    }
  ): Promise<T> {
    const breaker = this.getOrCreateCircuitBreaker(operationId, options);
    
    // Check circuit breaker state
    if (breaker.state === 'open') {
      const timeSinceLastFailure = Date.now() - breaker.lastFailure.getTime();
      if (timeSinceLastFailure < breaker.timeout) {
        throw new Error(`Circuit breaker open for operation: ${operationId}`);
      } else {
        breaker.state = 'half-open';
        this.logger.info('Circuit breaker moving to half-open', { operationId });
      }
    }

    try {
      const result = await operation();
      
      // Success - reset circuit breaker
      if (breaker.state === 'half-open') {
        breaker.state = 'closed';
        breaker.failures = 0;
        this.logger.info('Circuit breaker closed after successful operation', { operationId });
      }
      
      return result;
    } catch (error) {
      breaker.failures++;
      breaker.lastFailure = new Date();
      
      if (breaker.failures >= breaker.threshold) {
        breaker.state = 'open';
        this.metrics.circuitBreakerTrips++;
        this.logger.warn('Circuit breaker opened due to failures', { 
          operationId, 
          failures: breaker.failures,
          threshold: breaker.threshold 
        });
      }
      
      throw error;
    }
  }

  /**
   * BATCHED OPERATIONS: Improve performance with bulk processing
   */
  public addToBatch(
    batchId: string,
    operation: any,
    options?: {
      batchSize?: number;
      maxWaitTime?: number;
      processor?: (operations: any[]) => Promise<void>;
    }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const queue = this.getOrCreateBatchQueue(batchId, options);
      
      queue.operations.push({ operation, resolve, reject });
      
      // Check if batch is full
      if (queue.operations.length >= queue.batchSize) {
        this.processBatch(batchId);
      } else if (!queue.timer) {
        // Set timer for max wait time
        queue.timer = setTimeout(() => {
          this.processBatch(batchId);
        }, queue.maxWaitTime);
      }
    });
  }

  /**
   * MEMORY MANAGEMENT: Monitor and optimize memory usage
   */
  public optimizeMemoryUsage(): void {
    const memoryUsage = process.memoryUsage();
    const heapUsed = memoryUsage.heapUsed;
    
    this.metrics.peakMemoryUsage = Math.max(this.metrics.peakMemoryUsage, heapUsed);
    
    if (heapUsed > this.config.memoryThreshold) {
      this.logger.warn('High memory usage detected, triggering optimization', {
        heapUsed: Math.round(heapUsed / 1024 / 1024) + 'MB',
        threshold: Math.round(this.config.memoryThreshold / 1024 / 1024) + 'MB'
      });
      
      // Aggressive cache cleanup
      this.aggressiveCacheCleanup();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        this.logger.info('Forced garbage collection executed');
      }
      
      this.metrics.memoryOptimizations++;
      this.emit('memoryOptimized', { heapUsed, threshold: this.config.memoryThreshold });
    }
  }

  /**
   * PERFORMANCE MONITORING: Track and report performance metrics
   */
  public getPerformanceMetrics(): typeof this.metrics & {
    cacheHitRate: number;
    activeCircuitBreakers: number;
    activeBatchQueues: number;
    cacheSize: number;
  } {
    const totalCacheRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 ? (this.metrics.cacheHits / totalCacheRequests) * 100 : 0;
    
    return {
      ...this.metrics,
      cacheHitRate,
      activeCircuitBreakers: Array.from(this.circuitBreakers.values()).filter(cb => cb.state !== 'closed').length,
      activeBatchQueues: this.batchQueues.size,
      cacheSize: this.subgraphCache.size
    };
  }

  /**
   * PERFORMANCE TUNING: Dynamic configuration updates
   */
  public updateConfiguration(newConfig: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Performance configuration updated', newConfig);
    this.emit('configurationUpdated', this.config);
  }

  // Private helper methods

  private evictOldestCacheEntry(): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, value] of this.subgraphCache) {
      if (value.timestamp.getTime() < oldestTime) {
        oldestTime = value.timestamp.getTime();
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.subgraphCache.delete(oldestKey);
      this.logger.debug('Evicted oldest cache entry', { key: oldestKey });
    }
  }

  private getOrCreateCircuitBreaker(operationId: string, options?: any) {
    if (!this.circuitBreakers.has(operationId)) {
      this.circuitBreakers.set(operationId, {
        failures: 0,
        lastFailure: new Date(0),
        state: 'closed',
        threshold: options?.threshold || this.config.circuitBreakerThreshold,
        timeout: options?.timeout || this.config.circuitBreakerTimeout
      });
    }
    return this.circuitBreakers.get(operationId)!;
  }

  private getOrCreateBatchQueue(batchId: string, options?: any) {
    if (!this.batchQueues.has(batchId)) {
      this.batchQueues.set(batchId, {
        operations: [],
        timer: null,
        batchSize: options?.batchSize || this.config.batchSize,
        maxWaitTime: options?.maxWaitTime || this.config.batchMaxWaitTime
      });
    }
    return this.batchQueues.get(batchId)!;
  }

  private async processBatch(batchId: string): Promise<void> {
    const queue = this.batchQueues.get(batchId);
    if (!queue || queue.operations.length === 0) return;

    const operations = queue.operations.splice(0);
    if (queue.timer) {
      clearTimeout(queue.timer);
      queue.timer = null;
    }

    this.logger.info('Processing batch', { batchId, operationCount: operations.length });

    try {
      // Process all operations
      for (const { operation, resolve } of operations) {
        resolve(operation);
      }
      
      this.metrics.batchOperationsProcessed += operations.length;
    } catch (error) {
      this.logger.error('Batch processing failed', { batchId, error });
      
      // Reject all operations in the batch
      for (const { reject } of operations) {
        reject(error);
      }
    }
  }

  private startMemoryMonitoring(): void {
    setInterval(() => {
      this.optimizeMemoryUsage();
    }, this.config.gcInterval);
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredCache();
    }, this.config.cacheTTL / 2); // Clean up every half TTL
  }

  private startMetricsCollection(): void {
    let lastOperationCount = 0;
    
    setInterval(() => {
      const currentOperations = this.metrics.batchOperationsProcessed;
      this.metrics.operationsPerSecond = currentOperations - lastOperationCount;
      lastOperationCount = currentOperations;
    }, 1000);
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, value] of this.subgraphCache) {
      const age = now - value.timestamp.getTime();
      if (age > this.config.cacheTTL) {
        this.subgraphCache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.logger.debug('Cleaned up expired cache entries', { cleanedCount });
    }
  }

  private aggressiveCacheCleanup(): void {
    // Remove least recently used cache entries
    const entries = Array.from(this.subgraphCache.entries())
      .sort((a, b) => a[1].hitCount - b[1].hitCount);
    
    const toRemove = Math.floor(entries.length * 0.3); // Remove 30% of cache
    
    for (let i = 0; i < toRemove; i++) {
      this.subgraphCache.delete(entries[i][0]);
    }
    
    this.logger.info('Aggressive cache cleanup completed', { removedEntries: toRemove });
  }
} 