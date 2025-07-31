/**
 * SWAPS White Label Performance Benchmark Suite
 * 
 * This script measures the current system's performance capabilities
 * including concurrent users, tenants, wallets, and discovery times.
 */

const { performance } = require('perf_hooks');

// Import services
const { TenantManagementService } = require('./src/services/tenant/TenantManagementService');
const { PersistentTradeDiscoveryService } = require('./src/services/trade/PersistentTradeDiscoveryService');
const { TradeDiscoveryService } = require('./src/services/trade/TradeDiscoveryService');
const { PerformanceOptimizer } = require('./src/services/trade/PerformanceOptimizer');

class PerformanceBenchmark {
  constructor() {
    this.tenantService = TenantManagementService.getInstance();
    this.persistentTradeService = PersistentTradeDiscoveryService.getInstance();
    this.baseTradeService = TradeDiscoveryService.getInstance();
    this.performanceOptimizer = PerformanceOptimizer.getInstance();
    
    this.results = {
      maxConcurrentTenants: 0,
      maxConcurrentUsers: 0,
      maxWalletsPerTenant: 0,
      maxNFTsPerTenant: 0,
      avgDiscoveryTime: 0,
      maxDiscoveryTime: 0,
      minDiscoveryTime: 0,
      throughputPerSecond: 0,
      memoryUsage: {},
      concurrencyMetrics: {},
      scalabilityLimits: {}
    };
  }

  async runComprehensiveBenchmark() {
    console.log('🚀 SWAPS WHITE LABEL PERFORMANCE BENCHMARK');
    console.log('==========================================\n');

    await this.testMaxConcurrentTenants();
    await this.testMaxWalletsPerTenant();
    await this.testMaxNFTsPerTenant();
    await this.testDiscoveryPerformance();
    await this.testConcurrentDiscovery();
    await this.testThroughput();
    await this.testMemoryUsage();
    await this.testScalabilityLimits();

    this.generateReport();
  }

  async testMaxConcurrentTenants() {
    console.log('📊 Testing Maximum Concurrent Tenants...');
    
    const tenants = [];
    const startTime = performance.now();
    let maxTenants = 0;

    try {
      // Create tenants until we hit performance degradation
      for (let i = 1; i <= 1000; i++) {
        const tenant = await this.tenantService.createTenant({
          name: `Benchmark Tenant ${i}`,
          contactEmail: `tenant${i}@benchmark.test`,
          industry: 'NFT Trading',
          blockchain: 'solana'
        });
        
        tenants.push(tenant);
        maxTenants = i;

        // Test discovery time every 10 tenants
        if (i % 10 === 0) {
          const testTime = await this.quickDiscoveryTest(tenant.id);
          if (testTime > 2000) { // If discovery takes > 2 seconds, we've hit limits
            console.log(`   ⚠️ Performance degradation at ${i} tenants (${testTime}ms discovery)`);
            break;
          }
        }

        if (i % 50 === 0) {
          console.log(`   ✅ ${i} tenants created (${(performance.now() - startTime).toFixed(0)}ms)`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Failed at ${maxTenants} tenants: ${error.message}`);
    }

    this.results.maxConcurrentTenants = maxTenants;
    console.log(`   🎯 Maximum Concurrent Tenants: ${maxTenants}\n`);

    // Cleanup
    for (const tenant of tenants) {
      await this.tenantService.deleteTenant(tenant.id);
    }
  }

  async testMaxWalletsPerTenant() {
    console.log('👛 Testing Maximum Wallets Per Tenant...');
    
    const tenant = await this.tenantService.createTenant({
      name: 'Wallet Scale Test',
      contactEmail: 'wallet@benchmark.test'
    });

    let maxWallets = 0;
    const startTime = performance.now();

    try {
      for (let i = 1; i <= 10000; i++) {
        await this.persistentTradeService.onNFTAdded(tenant.id, {
          id: `wallet-test-nft-${i}`,
          metadata: { name: `Wallet Test NFT ${i}` },
          ownership: { ownerId: `wallet-${i}` },
          collection: { id: 'wallet-test-collection', name: 'Wallet Test Collection' }
        });

        maxWallets = i;

        if (i % 100 === 0) {
          const testTime = await this.quickDiscoveryTest(tenant.id);
          if (testTime > 3000) {
            console.log(`   ⚠️ Performance degradation at ${i} wallets (${testTime}ms discovery)`);
            break;
          }
        }

        if (i % 500 === 0) {
          console.log(`   ✅ ${i} wallets created (${(performance.now() - startTime).toFixed(0)}ms)`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Failed at ${maxWallets} wallets: ${error.message}`);
    }

    this.results.maxWalletsPerTenant = maxWallets;
    console.log(`   🎯 Maximum Wallets Per Tenant: ${maxWallets}\n`);

    await this.tenantService.deleteTenant(tenant.id);
  }

  async testMaxNFTsPerTenant() {
    console.log('🖼️ Testing Maximum NFTs Per Tenant...');
    
    const tenant = await this.tenantService.createTenant({
      name: 'NFT Scale Test',
      contactEmail: 'nft@benchmark.test'
    });

    let maxNFTs = 0;
    const startTime = performance.now();

    try {
      for (let i = 1; i <= 50000; i++) {
        await this.persistentTradeService.onNFTAdded(tenant.id, {
          id: `nft-scale-test-${i}`,
          metadata: { name: `Scale Test NFT ${i}` },
          ownership: { ownerId: `owner-${Math.ceil(i / 10)}` }, // 10 NFTs per wallet
          collection: { id: `collection-${Math.ceil(i / 100)}`, name: `Collection ${Math.ceil(i / 100)}` }
        });

        maxNFTs = i;

        if (i % 1000 === 0) {
          const testTime = await this.quickDiscoveryTest(tenant.id);
          if (testTime > 5000) {
            console.log(`   ⚠️ Performance degradation at ${i} NFTs (${testTime}ms discovery)`);
            break;
          }
        }

        if (i % 2000 === 0) {
          console.log(`   ✅ ${i} NFTs created (${(performance.now() - startTime).toFixed(0)}ms)`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Failed at ${maxNFTs} NFTs: ${error.message}`);
    }

    this.results.maxNFTsPerTenant = maxNFTs;
    console.log(`   🎯 Maximum NFTs Per Tenant: ${maxNFTs}\n`);

    await this.tenantService.deleteTenant(tenant.id);
  }

  async testDiscoveryPerformance() {
    console.log('⚡ Testing Discovery Performance...');
    
    const tenant = await this.tenantService.createTenant({
      name: 'Discovery Performance Test',
      contactEmail: 'discovery@benchmark.test'
    });

    // Create a complex trading scenario
    const nfts = [
      { id: 'rare-1', owner: 'trader-1', collection: 'rare-collection' },
      { id: 'rare-2', owner: 'trader-2', collection: 'rare-collection' },
      { id: 'rare-3', owner: 'trader-3', collection: 'rare-collection' },
      { id: 'common-1', owner: 'trader-1', collection: 'common-collection' },
      { id: 'common-2', owner: 'trader-2', collection: 'common-collection' },
      { id: 'common-3', owner: 'trader-3', collection: 'common-collection' }
    ];

    for (const nft of nfts) {
      await this.persistentTradeService.onNFTAdded(tenant.id, {
        id: nft.id,
        metadata: { name: nft.id },
        ownership: { ownerId: nft.owner },
        collection: { id: nft.collection, name: nft.collection }
      });
    }

    // Run discovery tests
    const discoveryTimes = [];
    for (let i = 0; i < 100; i++) {
      const startTime = performance.now();
      
      await this.persistentTradeService.onWantAdded(
        tenant.id,
        'trader-1',
        `rare-${(i % 3) + 1}`
      );
      
      const discoveryTime = performance.now() - startTime;
      discoveryTimes.push(discoveryTime);
    }

    this.results.avgDiscoveryTime = discoveryTimes.reduce((a, b) => a + b, 0) / discoveryTimes.length;
    this.results.maxDiscoveryTime = Math.max(...discoveryTimes);
    this.results.minDiscoveryTime = Math.min(...discoveryTimes);

    console.log(`   🎯 Average Discovery Time: ${this.results.avgDiscoveryTime.toFixed(2)}ms`);
    console.log(`   🎯 Max Discovery Time: ${this.results.maxDiscoveryTime.toFixed(2)}ms`);
    console.log(`   🎯 Min Discovery Time: ${this.results.minDiscoveryTime.toFixed(2)}ms\n`);

    await this.tenantService.deleteTenant(tenant.id);
  }

  async testConcurrentDiscovery() {
    console.log('🔄 Testing Concurrent Discovery...');
    
    const tenants = [];
    for (let i = 1; i <= 10; i++) {
      const tenant = await this.tenantService.createTenant({
        name: `Concurrent Test ${i}`,
        contactEmail: `concurrent${i}@benchmark.test`
      });
      tenants.push(tenant);

      // Add NFTs to each tenant
      await this.persistentTradeService.onNFTAdded(tenant.id, {
        id: `concurrent-nft-1-${i}`,
        metadata: { name: `Concurrent NFT 1 ${i}` },
        ownership: { ownerId: `owner-1-${i}` },
        collection: { id: `collection-${i}`, name: `Collection ${i}` }
      });

      await this.persistentTradeService.onNFTAdded(tenant.id, {
        id: `concurrent-nft-2-${i}`,
        metadata: { name: `Concurrent NFT 2 ${i}` },
        ownership: { ownerId: `owner-2-${i}` },
        collection: { id: `collection-${i}`, name: `Collection ${i}` }
      });
    }

    // Test concurrent discovery
    const startTime = performance.now();
    const promises = tenants.map(tenant => 
      this.persistentTradeService.onWantAdded(
        tenant.id,
        `owner-1-${tenants.indexOf(tenant) + 1}`,
        `concurrent-nft-2-${tenants.indexOf(tenant) + 1}`
      )
    );

    await Promise.all(promises);
    const concurrentTime = performance.now() - startTime;

    this.results.concurrencyMetrics = {
      concurrentTenants: tenants.length,
      totalTime: concurrentTime,
      avgTimePerTenant: concurrentTime / tenants.length
    };

    console.log(`   🎯 Concurrent Discovery (${tenants.length} tenants): ${concurrentTime.toFixed(2)}ms`);
    console.log(`   🎯 Average per Tenant: ${this.results.concurrencyMetrics.avgTimePerTenant.toFixed(2)}ms\n`);

    // Cleanup
    for (const tenant of tenants) {
      await this.tenantService.deleteTenant(tenant.id);
    }
  }

  async testThroughput() {
    console.log('📈 Testing System Throughput...');
    
    const tenant = await this.tenantService.createTenant({
      name: 'Throughput Test',
      contactEmail: 'throughput@benchmark.test'
    });

    // Pre-populate with NFTs
    for (let i = 1; i <= 100; i++) {
      await this.persistentTradeService.onNFTAdded(tenant.id, {
        id: `throughput-nft-${i}`,
        metadata: { name: `Throughput NFT ${i}` },
        ownership: { ownerId: `throughput-owner-${i}` },
        collection: { id: 'throughput-collection', name: 'Throughput Collection' }
      });
    }

    // Test throughput over 60 seconds
    const startTime = performance.now();
    let operationCount = 0;
    const endTime = startTime + 60000; // 60 seconds

    while (performance.now() < endTime) {
      await this.persistentTradeService.onWantAdded(
        tenant.id,
        `throughput-owner-${(operationCount % 100) + 1}`,
        `throughput-nft-${((operationCount + 1) % 100) + 1}`
      );
      operationCount++;
    }

    this.results.throughputPerSecond = operationCount / 60;

    console.log(`   🎯 Operations Completed in 60s: ${operationCount}`);
    console.log(`   🎯 Throughput: ${this.results.throughputPerSecond.toFixed(2)} operations/second\n`);

    await this.tenantService.deleteTenant(tenant.id);
  }

  async testMemoryUsage() {
    console.log('💾 Testing Memory Usage...');
    
    const initialMemory = process.memoryUsage();
    
    const tenant = await this.tenantService.createTenant({
      name: 'Memory Test',
      contactEmail: 'memory@benchmark.test'
    });

    // Add 1000 NFTs and measure memory
    for (let i = 1; i <= 1000; i++) {
      await this.persistentTradeService.onNFTAdded(tenant.id, {
        id: `memory-nft-${i}`,
        metadata: { name: `Memory NFT ${i}` },
        ownership: { ownerId: `memory-owner-${Math.ceil(i / 10)}` },
        collection: { id: 'memory-collection', name: 'Memory Collection' }
      });
    }

    const finalMemory = process.memoryUsage();

    this.results.memoryUsage = {
      initialHeapUsed: Math.round(initialMemory.heapUsed / 1024 / 1024),
      finalHeapUsed: Math.round(finalMemory.heapUsed / 1024 / 1024),
      memoryIncrease: Math.round((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024),
      memoryPerNFT: Math.round((finalMemory.heapUsed - initialMemory.heapUsed) / 1000 / 1024)
    };

    console.log(`   🎯 Initial Memory: ${this.results.memoryUsage.initialHeapUsed}MB`);
    console.log(`   🎯 Final Memory: ${this.results.memoryUsage.finalHeapUsed}MB`);
    console.log(`   🎯 Memory Increase: ${this.results.memoryUsage.memoryIncrease}MB`);
    console.log(`   🎯 Memory per NFT: ${this.results.memoryUsage.memoryPerNFT}KB\n`);

    await this.tenantService.deleteTenant(tenant.id);
  }

  async testScalabilityLimits() {
    console.log('🔬 Testing Scalability Limits...');
    
    // Test maximum complex trade discovery
    const tenant = await this.tenantService.createTenant({
      name: 'Scalability Test',
      contactEmail: 'scalability@benchmark.test'
    });

    // Create a complex trading scenario with many possible loops
    const complexity = [10, 50, 100, 500]; // Different complexity levels
    
    for (const level of complexity) {
      console.log(`   Testing complexity level: ${level} wallets...`);
      
      // Clear previous data
      await this.baseTradeService.clearAllData();
      
      // Create complex trading scenario
      for (let i = 1; i <= level; i++) {
        await this.persistentTradeService.onNFTAdded(tenant.id, {
          id: `scale-nft-${i}`,
          metadata: { name: `Scale NFT ${i}` },
          ownership: { ownerId: `scale-wallet-${i}` },
          collection: { id: `scale-collection-${Math.ceil(i / 10)}`, name: `Scale Collection ${Math.ceil(i / 10)}` }
        });
      }

      // Add wants to create loops
      const startTime = performance.now();
      for (let i = 1; i <= Math.min(level, 20); i++) {
        await this.persistentTradeService.onWantAdded(
          tenant.id,
          `scale-wallet-${i}`,
          `scale-nft-${(i % level) + 1}`
        );
      }
      const discoveryTime = performance.now() - startTime;

      console.log(`     ✅ ${level} wallets: ${discoveryTime.toFixed(2)}ms discovery time`);
      
      if (!this.results.scalabilityLimits[level]) {
        this.results.scalabilityLimits[level] = discoveryTime;
      }
    }

    console.log();
    await this.tenantService.deleteTenant(tenant.id);
  }

  async quickDiscoveryTest(tenantId) {
    const startTime = performance.now();
    try {
      await this.persistentTradeService.onWantAdded(
        tenantId,
        'test-wallet',
        'test-nft'
      );
    } catch (error) {
      // Ignore errors for quick test
    }
    return performance.now() - startTime;
  }

  generateReport() {
    console.log('\n📊 COMPREHENSIVE PERFORMANCE REPORT');
    console.log('=====================================\n');

    console.log('🎯 SCALABILITY METRICS:');
    console.log(`   Maximum Concurrent Tenants: ${this.results.maxConcurrentTenants}`);
    console.log(`   Maximum Wallets per Tenant: ${this.results.maxWalletsPerTenant}`);
    console.log(`   Maximum NFTs per Tenant: ${this.results.maxNFTsPerTenant}`);

    console.log('\n⚡ PERFORMANCE METRICS:');
    console.log(`   Average Discovery Time: ${this.results.avgDiscoveryTime.toFixed(2)}ms`);
    console.log(`   Maximum Discovery Time: ${this.results.maxDiscoveryTime.toFixed(2)}ms`);
    console.log(`   Minimum Discovery Time: ${this.results.minDiscoveryTime.toFixed(2)}ms`);
    console.log(`   System Throughput: ${this.results.throughputPerSecond.toFixed(2)} ops/second`);

    console.log('\n🔄 CONCURRENCY METRICS:');
    console.log(`   Concurrent Tenants Tested: ${this.results.concurrencyMetrics.concurrentTenants}`);
    console.log(`   Total Concurrent Time: ${this.results.concurrencyMetrics.totalTime?.toFixed(2)}ms`);
    console.log(`   Average per Tenant: ${this.results.concurrencyMetrics.avgTimePerTenant?.toFixed(2)}ms`);

    console.log('\n💾 MEMORY METRICS:');
    console.log(`   Memory Increase (1000 NFTs): ${this.results.memoryUsage.memoryIncrease}MB`);
    console.log(`   Memory per NFT: ${this.results.memoryUsage.memoryPerNFT}KB`);

    console.log('\n🔬 SCALABILITY ANALYSIS:');
    Object.entries(this.results.scalabilityLimits).forEach(([level, time]) => {
      console.log(`   ${level} wallets: ${time.toFixed(2)}ms discovery time`);
    });

    console.log('\n🎉 BENCHMARK COMPLETE!');
    
    // Return results for documentation
    return this.results;
  }
}

// Run benchmark if called directly
if (require.main === module) {
  const benchmark = new PerformanceBenchmark();
  benchmark.runComprehensiveBenchmark()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Benchmark failed:', error);
      process.exit(1);
    });
}

module.exports = PerformanceBenchmark; 