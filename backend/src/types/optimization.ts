/**
 * HIGH-ROI OPTIMIZATION TYPE DEFINITIONS
 * Focused on the highest impact performance improvements
 */

export interface TransformationCacheEntry {
  tenantId: string;
  graphHash: string;
  transformedData: {
    wallets: Map<string, any>;
    nftOwnership: Map<string, string>;
    wantedNfts: Map<string, Set<string>>;
  };
  timestamp: number;
  hitCount: number;
  computeTime: number;
}

export interface QueryOptimizationMetrics {
  avgQueryTime: number;
  slowQueries: number;
  cacheHitRate: number;
  transformationTime: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  totalTransformationTime: number;
  avgComputeTime: number;
  hitRate: number;
  cacheSize: number;
}

export interface OptimizationResult<T> {
  data: T;
  fromCache: boolean;
  computeTime: number;
  optimizationApplied: boolean;
}

export interface OptimizationConfig {
  transformation: {
    cacheEnabled: boolean;
    maxCacheSize: number;
    ttl: number;
    hashAlgorithm: 'simple' | 'md5' | 'sha256';
  };
  
  queries: {
    connectionPoolSize: number;
    queryTimeout: number;
    indexOptimization: boolean;
    batchSize: number;
  };
  
  memory: {
    compressionEnabled: boolean;
    gcThreshold: number;
    maxHeapSize: number;
  };
}

export interface OptimizationEvent {
  type: 'cache_hit' | 'cache_miss' | 'slow_operation' | 'config_update';
  tenantId?: string;
  operationType?: string;
  metrics?: any;
  timestamp: number;
}

export interface TransformationResult {
  wallets: Map<string, any>;
  nftOwnership: Map<string, string>;
  wantedNfts: Map<string, Set<string>>;
  fromCache: boolean;
  computeTime: number;
}

export interface OverallOptimizationMetrics {
  cache: CacheMetrics;
  queries: QueryOptimizationMetrics;
  overall: {
    totalOptimizations: number;
    totalTimeSaved: number;
    averageSpeedup: number;
  };
} 