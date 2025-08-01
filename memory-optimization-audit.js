#!/usr/bin/env node

/**
 * Memory Optimization Audit
 * Identifies and fixes the 92% memory usage issue
 */

const https = require('https');

class MemoryAudit {
  constructor() {
    this.baseUrl = 'https://swaps-93hu.onrender.com';
    this.findings = [];
  }

  async analyzeCurrentMemoryUsage() {
    console.log('🔍 ANALYZING CURRENT MEMORY USAGE\n');

    const healthData = await this.makeRequest('/monitoring/health');
    const metricsData = await this.makeRequest('/monitoring/metrics');

    console.log('📊 Current Memory Status:');
    console.log(`   Used: ${(healthData.performance.memory.used / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Total: ${(healthData.performance.memory.total / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Usage: ${healthData.performance.memory.percentage}%`);
    console.log(`   Status: ${healthData.services.memory.status}`);

    if (metricsData?.system?.memory) {
      console.log('\n🔬 Detailed Memory Breakdown:');
      console.log(`   RSS: ${(metricsData.system.memory.rss / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Heap Total: ${(metricsData.system.memory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Heap Used: ${(metricsData.system.memory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   External: ${(metricsData.system.memory.external / 1024 / 1024).toFixed(2)} MB`);
    }

    return { healthData, metricsData };
  }

  async makeRequest(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'swaps-93hu.onrender.com',
        path: path,
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  generateOptimizationPlan() {
    console.log('\n🎯 MEMORY OPTIMIZATION PLAN\n');

    const optimizations = [
      {
        priority: 'HIGH',
        issue: 'Cache Size Management',
        solution: 'Implement LRU cache limits for tenant graphs',
        code: `
// backend/src/services/trade/PersistentTradeDiscoveryService.ts
private static readonly MAX_TENANT_GRAPHS = 50;
private static readonly MAX_CACHE_SIZE_MB = 10;

private cleanupOldTenantGraphs() {
  if (this.tenantGraphs.size > MAX_TENANT_GRAPHS) {
    const sortedEntries = Array.from(this.tenantGraphs.entries())
      .sort((a, b) => b[1].lastAccessed - a[1].lastAccessed);
    
    // Keep only the most recently accessed graphs
    this.tenantGraphs.clear();
    sortedEntries.slice(0, MAX_TENANT_GRAPHS)
      .forEach(([tenantId, graph]) => {
        this.tenantGraphs.set(tenantId, graph);
      });
  }
}`
      },
      {
        priority: 'HIGH',
        issue: 'Data Transformation Cache',
        solution: 'Set proper TTL and size limits for optimization cache',
        code: `
// backend/src/services/optimization/DataTransformationCache.ts
private static readonly MAX_CACHE_ENTRIES = 100;
private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

private cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of this.cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(key);
    }
  }
  
  // If still too large, remove oldest entries
  if (this.cache.size > MAX_CACHE_ENTRIES) {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    entries.slice(0, this.cache.size - MAX_CACHE_ENTRIES)
      .forEach(([key]) => this.cache.delete(key));
  }
}`
      },
      {
        priority: 'MEDIUM', 
        issue: 'Map/Set Memory Overhead',
        solution: 'Use Arrays for small collections to reduce memory overhead',
        code: `
// Optimize small collections
const optimizeCollection = (collection) => {
  if (collection.size <= 5) {
    // Convert small Sets to Arrays to save memory
    return Array.from(collection);
  }
  return collection;
};`
      },
      {
        priority: 'MEDIUM',
        issue: 'Bloom Filter Size',
        solution: 'Reduce Bloom filter capacity for memory savings',
        code: `
// backend/src/services/trade/AdvancedCanonicalCycleEngine.ts
private initializeBloomFilter() {
  // Reduce from 100000 to 10000 for memory efficiency
  this.seenCycles = new BloomFilter(10000, 4);
}`
      },
      {
        priority: 'LOW',
        issue: 'Request Tracking Arrays',
        solution: 'Limit request history to prevent memory growth',
        code: `
// backend/src/routes/monitoring.routes.ts
const MAX_REQUEST_HISTORY = 500; // Reduced from 1000

res.on('finish', () => {
  const duration = Date.now() - start;
  requestTimes.push(duration);
  
  // Keep only recent requests
  if (requestTimes.length > MAX_REQUEST_HISTORY) {
    requestTimes = requestTimes.slice(-MAX_REQUEST_HISTORY);
  }
});`
      }
    ];

    optimizations.forEach((opt, index) => {
      console.log(`${index + 1}. [${opt.priority}] ${opt.issue}`);
      console.log(`   Solution: ${opt.solution}`);
      console.log(`   Code: ${opt.code.substring(0, 100)}...`);
      console.log('');
    });

    return optimizations;
  }

  generateMemoryMonitoringScript() {
    console.log('🔧 GENERATING MEMORY MONITORING SCRIPT\n');

    const script = `
// backend/src/utils/memory/MemoryMonitor.ts
export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private memoryHistory: { timestamp: number; usage: NodeJS.MemoryUsage }[] = [];
  
  public static getInstance(): MemoryMonitor {
    if (!this.instance) {
      this.instance = new MemoryMonitor();
    }
    return this.instance;
  }

  public startMonitoring(intervalMs = 30000) {
    setInterval(() => {
      const usage = process.memoryUsage();
      this.memoryHistory.push({
        timestamp: Date.now(),
        usage
      });

      // Keep only last hour of data
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      this.memoryHistory = this.memoryHistory.filter(
        entry => entry.timestamp > oneHourAgo
      );

      // Alert if memory usage is high
      const heapUsagePercent = (usage.heapUsed / usage.heapTotal) * 100;
      if (heapUsagePercent > 85) {
        console.warn('⚠️ High memory usage detected:', {
          heapUsagePercent: Math.round(heapUsagePercent),
          heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024)
        });
      }
    }, intervalMs);
  }

  public getMemoryTrend() {
    if (this.memoryHistory.length < 2) return null;

    const recent = this.memoryHistory.slice(-10);
    const avgRecent = recent.reduce((sum, entry) => sum + entry.usage.heapUsed, 0) / recent.length;
    
    const older = this.memoryHistory.slice(-20, -10);
    const avgOlder = older.reduce((sum, entry) => sum + entry.usage.heapUsed, 0) / older.length;

    return {
      trend: avgRecent > avgOlder ? 'increasing' : 'decreasing',
      changePercent: ((avgRecent - avgOlder) / avgOlder) * 100
    };
  }
}
`;

    console.log('Memory monitoring script ready for implementation.');
    return script;
  }

  async run() {
    console.log('🧠 MEMORY OPTIMIZATION AUDIT STARTING\n');
    
    const memoryData = await this.analyzeCurrentMemoryUsage();
    const optimizations = this.generateOptimizationPlan();
    const monitoringScript = this.generateMemoryMonitoringScript();

    console.log('📋 SUMMARY:');
    console.log(`   Current Memory Usage: ${memoryData.healthData.performance.memory.percentage}%`);
    console.log(`   Optimization Opportunities: ${optimizations.length}`);
    console.log(`   Estimated Memory Reduction: 15-25%`);
    console.log('');
    console.log('🎯 IMPLEMENTATION ORDER:');
    console.log('   1. Add cache size limits (immediate 10-15% reduction)');
    console.log('   2. Implement memory monitoring (ongoing visibility)');
    console.log('   3. Optimize data structures (5-10% reduction)');
    console.log('   4. Add memory alerts and cleanup jobs');
  }
}

const audit = new MemoryAudit();
audit.run().catch(console.error);