#!/usr/bin/env node

/**
 * 🔍 PERFORMANCE BOTTLENECK ANALYSIS
 * 
 * Let's identify WHERE the 5+ second delays are coming from:
 * 1. Database/persistence operations
 * 2. Algorithm computation time
 * 3. Data transformation overhead
 * 4. Network/external API calls
 * 5. Memory/CPU inefficiencies
 * 6. Synchronous blocking operations
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'https://swaps-93hu.onrender.com/api/v1';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'swaps_admin_prod_2025_secure_key_abc123';

console.log('🔍 PERFORMANCE BOTTLENECK ANALYSIS');
console.log('==================================');
console.log('🎯 GOAL: Identify exactly where the 5+ second delays come from');
console.log('⚡ Then create targeted optimization plan');
console.log('');

class PerformanceAnalyzer {
  constructor() {
    this.tenant = null;
    this.apiKey = null;
    this.bottlenecks = [];
    this.optimizations = [];
  }

  logBottleneck(operation, timing, severity, rootCause, solution) {
    this.bottlenecks.push({ operation, timing, severity, rootCause, solution });
    const icon = severity === 'critical' ? '🚨' : severity === 'major' ? '⚠️' : '🔸';
    console.log(`   ${icon} ${operation}: ${timing}ms`);
    console.log(`      🔍 Root Cause: ${rootCause}`);
    console.log(`      💡 Solution: ${solution}`);
  }

  logOptimization(category, description, impact, effort) {
    this.optimizations.push({ category, description, impact, effort });
    console.log(`   ✅ ${category}: ${description}`);
    console.log(`      📈 Impact: ${impact}`);
    console.log(`      🔧 Effort: ${effort}`);
  }

  async setupTestEnvironment() {
    console.log('🏗️ Setting up performance test environment...');
    try {
      const response = await axios.post(`${BASE_URL}/admin/tenants`, {
        name: 'Performance_Analysis',
        contactEmail: 'perf@analysis.test',
        settings: {
          algorithm: { maxDepth: 15, minEfficiency: 0.3, maxLoopsPerRequest: 50 },
          security: { maxNFTsPerWallet: 1000, maxWantsPerWallet: 100 }
        }
      }, {
        headers: { 'Authorization': `Bearer ${ADMIN_API_KEY}`, 'Content-Type': 'application/json' }
      });

      this.tenant = response.data.tenant;
      this.apiKey = this.tenant.apiKey || response.data.apiKey;
      
      console.log(`   ✅ Test tenant: ${this.tenant.id}`);
      console.log('');
      
    } catch (error) {
      throw new Error(`Failed to setup: ${error.response?.data?.error || error.message}`);
    }
  }

  async analyzeEndpointPerformance() {
    console.log('📊 ANALYZING ENDPOINT PERFORMANCE');
    console.log('=================================');

    const endpoints = [
      {
        name: 'Health Check',
        test: () => axios.get(`${BASE_URL.replace('/api/v1', '')}/health`),
        expected: 100,
        baseline: true
      },
      {
        name: 'Empty Discovery',
        test: () => axios.post(`${BASE_URL}/discovery/trades`, { walletId: 'empty_test' }, {
          headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
        }),
        expected: 1000,
        algorithm: true
      },
      {
        name: 'Empty Inventory Submit',
        test: () => axios.post(`${BASE_URL}/inventory/submit`, { walletId: 'empty_submit', nfts: [] }, {
          headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
        }),
        expected: 500,
        persistence: true
      },
      {
        name: 'Single NFT Submit',
        test: () => axios.post(`${BASE_URL}/inventory/submit`, {
          walletId: 'single_test',
          nfts: [{
            id: 'perf_nft_1',
            metadata: { name: 'Perf NFT', symbol: 'PERF', description: 'Performance test' },
            ownership: { ownerId: 'single_test', blockchain: 'solana', contractAddress: 'perf_contract', tokenId: 'perf_nft_1' },
            valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'perf_test' }
          }]
        }, {
          headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
        }),
        expected: 1000,
        algorithm: true,
        persistence: true
      }
    ];

    for (const endpoint of endpoints) {
      console.log(`🧪 Testing: ${endpoint.name}`);
      
      const times = [];
      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        try {
          await endpoint.test();
          times.push(Date.now() - start);
        } catch (error) {
          times.push(Date.now() - start);
          console.log(`   ⚠️ Attempt ${i + 1} failed: ${error.response?.data?.error || error.message}`);
        }
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const isSlowCategory = avgTime > endpoint.expected;

      if (isSlowCategory) {
        let rootCause = 'Unknown bottleneck';
        let solution = 'Needs investigation';

        if (endpoint.baseline && avgTime > endpoint.expected) {
          rootCause = 'Basic infrastructure/network overhead';
          solution = 'Check server resources, network optimization';
        } else if (endpoint.algorithm && avgTime > endpoint.expected) {
          rootCause = 'Algorithm computation or graph processing overhead';
          solution = 'Optimize algorithm parameters, caching, or parallelization';
        } else if (endpoint.persistence && avgTime > endpoint.expected) {
          rootCause = 'Database/persistence layer slowness';
          solution = 'Database optimization, connection pooling, or caching';
        }

        this.logBottleneck(
          endpoint.name,
          Math.round(avgTime),
          avgTime > endpoint.expected * 3 ? 'critical' : 'major',
          rootCause,
          solution
        );
      } else {
        console.log(`   ✅ ${endpoint.name}: ${Math.round(avgTime)}ms (acceptable)`);
      }
    }

    console.log('');
  }

  async analyzeDataProcessingScaling() {
    console.log('📈 ANALYZING DATA PROCESSING SCALING');
    console.log('===================================');

    const dataSizes = [1, 3, 5, 10];
    const timings = [];

    for (const size of dataSizes) {
      console.log(`🧪 Testing ${size} NFTs...`);
      
      const testNFTs = Array.from({ length: size }, (_, i) => ({
        id: `scaling_nft_${size}_${i}`,
        metadata: { name: `Scaling NFT ${i}`, symbol: 'SCALE', description: 'Scaling test' },
        ownership: { ownerId: `scaling_wallet_${size}`, blockchain: 'solana', contractAddress: 'scaling_contract', tokenId: `scaling_nft_${size}_${i}` },
        valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'scaling_test' }
      }));

      const start = Date.now();
      try {
        await axios.post(`${BASE_URL}/inventory/submit`, {
          walletId: `scaling_wallet_${size}`,
          nfts: testNFTs
        }, {
          headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
        });
        
        const time = Date.now() - start;
        timings.push({ size, time, perItem: time / size });
        
        console.log(`   📊 ${size} NFTs: ${time}ms (${Math.round(time/size)}ms per NFT)`);
        
      } catch (error) {
        console.log(`   ❌ ${size} NFTs: Failed - ${error.response?.data?.error || error.message}`);
        timings.push({ size, time: 10000, perItem: 10000 / size });
      }
    }

    // Analyze scaling pattern
    console.log('\n📊 Scaling Analysis:');
    
    const scalingEfficiency = timings.length >= 2 ? 
      timings[timings.length - 1].perItem / timings[0].perItem : 1;

    if (scalingEfficiency > 2) {
      this.logBottleneck(
        'Data Processing Scaling',
        Math.round(scalingEfficiency * 100),
        'major',
        'Processing time increases non-linearly with data size',
        'Implement batch processing, better data structures, or streaming'
      );
    } else {
      console.log(`   ✅ Scaling efficiency: ${scalingEfficiency.toFixed(2)}x (good linear scaling)`);
    }

    // Check for base overhead
    const baseOverhead = timings[0]?.time || 5000;
    if (baseOverhead > 3000) {
      this.logBottleneck(
        'Base Processing Overhead',
        baseOverhead,
        'critical',
        'High fixed cost per operation regardless of data size',
        'Optimize startup costs, reduce algorithm initialization time'
      );
    }

    console.log('');
  }

  async analyzeAlgorithmSpecificPerformance() {
    console.log('🧮 ANALYZING ALGORITHM-SPECIFIC PERFORMANCE');
    console.log('==========================================');

    // Test different complexity scenarios
    const scenarios = [
      {
        name: 'Simple Scenario (2 wallets, potential 2-way trade)',
        setup: async () => {
          // Wallet 1: has NFT A, wants NFT B
          await axios.post(`${BASE_URL}/inventory/submit`, {
            walletId: 'simple_wallet_1',
            nfts: [{
              id: 'simple_nft_a',
              metadata: { name: 'Simple NFT A', symbol: 'SIMA', description: 'Simple test A' },
              ownership: { ownerId: 'simple_wallet_1', blockchain: 'solana', contractAddress: 'simple_contract', tokenId: 'simple_nft_a' },
              valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'simple_test' }
            }]
          }, {
            headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
          });

          await axios.post(`${BASE_URL}/wants/submit`, {
            walletId: 'simple_wallet_1',
            wantedNFTs: ['simple_nft_b']
          }, {
            headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
          });

          // Wallet 2: has NFT B, wants NFT A
          await axios.post(`${BASE_URL}/inventory/submit`, {
            walletId: 'simple_wallet_2',
            nfts: [{
              id: 'simple_nft_b',
              metadata: { name: 'Simple NFT B', symbol: 'SIMB', description: 'Simple test B' },
              ownership: { ownerId: 'simple_wallet_2', blockchain: 'solana', contractAddress: 'simple_contract', tokenId: 'simple_nft_b' },
              valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'simple_test' }
            }]
          }, {
            headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
          });

          await axios.post(`${BASE_URL}/wants/submit`, {
            walletId: 'simple_wallet_2',
            wantedNFTs: ['simple_nft_a']
          }, {
            headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
          });
        },
        expectedComplexity: 'low'
      },
      {
        name: 'Empty Graph (no trades possible)',
        setup: async () => {
          // Just query without any setup
        },
        expectedComplexity: 'minimal'
      }
    ];

    for (const scenario of scenarios) {
      console.log(`🧪 Testing: ${scenario.name}`);
      
      try {
        // Setup scenario
        const setupStart = Date.now();
        await scenario.setup();
        const setupTime = Date.now() - setupStart;

        // Test discovery
        const discoveryStart = Date.now();
        await axios.post(`${BASE_URL}/discovery/trades`, {
          walletId: 'simple_wallet_1'
        }, {
          headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
        });
        const discoveryTime = Date.now() - discoveryStart;

        console.log(`   📊 Setup: ${setupTime}ms, Discovery: ${discoveryTime}ms`);

        // Analyze results
        if (scenario.expectedComplexity === 'minimal' && discoveryTime > 1000) {
          this.logBottleneck(
            `${scenario.name} - Discovery`,
            discoveryTime,
            'major',
            'Even empty graph queries are slow - high algorithm overhead',
            'Optimize algorithm initialization and empty graph handling'
          );
        } else if (scenario.expectedComplexity === 'low' && discoveryTime > 2000) {
          this.logBottleneck(
            `${scenario.name} - Discovery`,
            discoveryTime,
            'major',
            'Simple trade scenarios taking too long - algorithm inefficiency',
            'Optimize cycle detection for simple graphs'
          );
        } else {
          console.log(`   ✅ ${scenario.name}: Performance acceptable for complexity`);
        }

        if (setupTime > 1000) {
          this.logBottleneck(
            `${scenario.name} - Setup`,
            setupTime,
            'minor',
            'Data submission/persistence is slow',
            'Optimize data persistence and graph updates'
          );
        }

      } catch (error) {
        console.log(`   ❌ ${scenario.name}: Failed - ${error.response?.data?.error || error.message}`);
      }
    }

    console.log('');
  }

  async identifyQuickWins() {
    console.log('🚀 IDENTIFYING QUICK PERFORMANCE WINS');
    console.log('====================================');

    // Test if there are obvious inefficiencies
    console.log('🔍 Looking for obvious inefficiencies...');

    // Test 1: Are we doing unnecessary work on empty queries?
    const emptyStart = Date.now();
    try {
      await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: 'nonexistent_wallet_12345'
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      const emptyTime = Date.now() - emptyStart;
      
      if (emptyTime > 1000) {
        this.logOptimization(
          'Empty Query Optimization',
          'Optimize handling of non-existent wallets',
          'Could reduce 1-2 seconds from common queries',
          'Low - add early validation'
        );
      }
    } catch (error) {
      const emptyTime = Date.now() - emptyStart;
      console.log(`   📊 Empty query: ${emptyTime}ms`);
    }

    // Test 2: Multiple rapid queries (caching effectiveness)
    console.log('🧪 Testing caching effectiveness...');
    
    const cacheTestWallet = 'cache_test_wallet';
    
    // First query (cold)
    const coldStart = Date.now();
    try {
      await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: cacheTestWallet
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      // Expected for non-existent wallet
    }
    const coldTime = Date.now() - coldStart;

    // Second query (should be cached)
    const warmStart = Date.now();
    try {
      await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: cacheTestWallet
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      // Expected for non-existent wallet
    }
    const warmTime = Date.now() - warmStart;

    console.log(`   📊 Cold query: ${coldTime}ms, Warm query: ${warmTime}ms`);
    
    const cacheEfficiency = warmTime / coldTime;
    if (cacheEfficiency > 0.5) {
      this.logOptimization(
        'Caching Optimization',
        'Improve caching for repeated queries',
        `Could reduce ${Math.round((1 - cacheEfficiency) * 100)}% of response time for repeated queries`,
        'Medium - enhance caching strategy'
      );
    } else {
      console.log(`   ✅ Caching: ${Math.round((1 - cacheEfficiency) * 100)}% improvement on repeat queries`);
    }

    console.log('');
  }

  generateOptimizationPlan() {
    console.log('📋 PERFORMANCE OPTIMIZATION PLAN');
    console.log('================================');
    console.log('');

    // Categorize bottlenecks by severity
    const critical = this.bottlenecks.filter(b => b.severity === 'critical');
    const major = this.bottlenecks.filter(b => b.severity === 'major');
    const minor = this.bottlenecks.filter(b => b.severity === 'minor');

    console.log('🚨 CRITICAL BOTTLENECKS (Fix First):');
    if (critical.length === 0) {
      console.log('   ✅ None found');
    } else {
      critical.forEach((b, i) => {
        console.log(`   ${i + 1}. ${b.operation}: ${b.timing}ms`);
        console.log(`      🔍 ${b.rootCause}`);
        console.log(`      💡 ${b.solution}`);
        console.log('');
      });
    }

    console.log('⚠️ MAJOR BOTTLENECKS (Fix Next):');
    if (major.length === 0) {
      console.log('   ✅ None found');
    } else {
      major.forEach((b, i) => {
        console.log(`   ${i + 1}. ${b.operation}: ${b.timing}ms`);
        console.log(`      🔍 ${b.rootCause}`);
        console.log(`      💡 ${b.solution}`);
        console.log('');
      });
    }

    console.log('🚀 QUICK WINS (High Impact, Low Effort):');
    const quickWins = this.optimizations.filter(o => o.effort.includes('Low') || o.effort.includes('Medium'));
    if (quickWins.length === 0) {
      console.log('   🔍 Need more analysis to identify quick wins');
    } else {
      quickWins.forEach((o, i) => {
        console.log(`   ${i + 1}. ${o.category}: ${o.description}`);
        console.log(`      📈 ${o.impact}`);
        console.log(`      🔧 ${o.effort}`);
        console.log('');
      });
    }

    // Generate action plan
    console.log('🎯 RECOMMENDED ACTION PLAN:');
    console.log('==========================');
    
    if (critical.length > 0) {
      console.log('Phase 1 (Immediate - 1-2 days):');
      critical.forEach((b, i) => {
        console.log(`   ${i + 1}. Fix: ${b.operation}`);
        console.log(`      Target: Reduce from ${b.timing}ms to <1000ms`);
      });
      console.log('');
    }

    if (major.length > 0) {
      console.log('Phase 2 (Short-term - 3-5 days):');
      major.forEach((b, i) => {
        console.log(`   ${i + 1}. Optimize: ${b.operation}`);
        console.log(`      Target: Reduce from ${b.timing}ms to <2000ms`);
      });
      console.log('');
    }

    if (quickWins.length > 0) {
      console.log('Phase 3 (Quick Wins - 1-2 days):');
      quickWins.forEach((o, i) => {
        console.log(`   ${i + 1}. Implement: ${o.category}`);
      });
      console.log('');
    }

    console.log('🎯 TARGET PERFORMANCE:');
    console.log('   📊 Simple queries: <1 second');
    console.log('   📊 Standard operations: <2 seconds');
    console.log('   📊 Complex computations: <3 seconds');
    console.log('   📊 Concurrent handling: <5 seconds total');

    return {
      critical: critical.length,
      major: major.length,
      quickWins: quickWins.length,
      totalOptimizations: this.optimizations.length
    };
  }

  async runAnalysis() {
    try {
      await this.setupTestEnvironment();
      await this.analyzeEndpointPerformance();
      await this.analyzeDataProcessingScaling();
      await this.analyzeAlgorithmSpecificPerformance();
      await this.identifyQuickWins();
      
      return this.generateOptimizationPlan();
    } catch (error) {
      console.error('💥 Performance analysis failed:', error.message);
      return { critical: 1, major: 0, quickWins: 0, totalOptimizations: 0 };
    }
  }
}

// Run the performance analysis
const analyzer = new PerformanceAnalyzer();
analyzer.runAnalysis().then(result => {
  console.log('\n🏁 PERFORMANCE ANALYSIS COMPLETE');
  console.log(`Found: ${result.critical} critical, ${result.major} major bottlenecks`);
  console.log(`Identified: ${result.quickWins} quick wins, ${result.totalOptimizations} total optimizations`);
});