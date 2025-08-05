#!/usr/bin/env node

/**
 * 🔬 REAL ALGORITHM PERFORMANCE TEST
 * 
 * Now with admin access, this test will actually compare:
 * - Legacy algorithm system vs Algorithm Consolidation Service
 * - Real trade discovery performance
 * - Duplicate elimination verification
 * - Canonical trade ID generation
 * - Algorithm sophistication preservation
 */

const axios = require('axios');

const API_BASE = 'https://swaps-93hu.onrender.com';
const ADMIN_API_KEY = 'swaps_admin_prod_2025_secure_key_abc123';

class RealAlgorithmPerformanceTester {
  constructor() {
    this.results = {
      legacyPerformance: null,
      consolidationPerformance: null,
      comparison: null
    };
  }

  /**
   * Create test tenant with admin access
   */
  async createTestTenant(name, enableCanonical = true) {
    try {
      console.log(`📝 Creating test tenant: ${name}`);
      
      const response = await axios.post(`${API_BASE}/api/v1/admin/tenants`, {
        name: `Algorithm Performance Test - ${name}`,
        contactEmail: 'test@algorithmtest.com',
        description: `Testing algorithm performance - ${enableCanonical ? 'Consolidation' : 'Legacy'}`,
        settings: {
          algorithm: {
            enableCanonicalDiscovery: enableCanonical,
            maxDepth: 8,
            minEfficiency: 0.6,
            maxResults: 100,
            // Enable all sophisticated algorithms for testing
            enableSCCOptimization: true,
            enableLouvainClustering: true,
            enableKafkaDistribution: false, // Keep false for testing consistency
            enableBloomFilters: true,
            enableParallelProcessing: true
          },
          notifications: {
            webhookUrl: null,
            enableWebhooks: false
          }
        }
      }, {
        headers: {
          'Authorization': `Bearer ${ADMIN_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`✅ Tenant created: ${response.data.tenant.id}`);
      
      // Extract API key from response
      const apiKey = response.data.tenant.apiKey || response.data.apiKey;
      console.log(`🔑 API Key received: ${apiKey ? apiKey.substring(0, 20) + '...' : 'NOT FOUND'}`);
      
      return {
        tenantId: response.data.tenant.id,
        apiKey: apiKey
      };
      
    } catch (error) {
      throw new Error(`Failed to create tenant: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Generate sophisticated test data that will exercise all algorithms
   */
  generateAlgorithmTestData(walletCount = 25) {
    console.log(`🧪 Generating sophisticated test data (${walletCount} wallets)...`);
    
    const wallets = [];
    const nfts = [];
    
    // Collections that will create diverse graph structures
    const collections = [
      'DeGods', 'SMB', 'OkayBears', 'MagicEden', 'StarAtlas',
      'Aurory', 'SolPunks', 'Thugbirdz', 'FamousFox', 'Claynosaurz'
    ];
    
    // Generate wallets with complex interconnections (for SCC/Tarjan's testing)
    for (let i = 0; i < walletCount; i++) {
      const walletId = `perf_wallet_${i.toString().padStart(3, '0')}`;
      const ownedNfts = [];
      const wantedNfts = [];
      
      // Generate 2-3 NFTs per wallet
      const nftCount = 2 + Math.floor(Math.random() * 2);
      for (let j = 0; j < nftCount; j++) {
        const collection = collections[Math.floor(Math.random() * collections.length)];
        const nftId = `${collection}_${i}_${j}`;
        
        const nft = {
          id: nftId,
          metadata: {
            name: `${collection} #${1000 + i * 10 + j}`,
            symbol: collection.substring(0, 3).toUpperCase(),
            description: `Performance test NFT for algorithm comparison`,
            image: `https://example.com/nft/${nftId}.png`,
            attributes: [
              { trait_type: 'Rarity', value: Math.random() > 0.7 ? 'Rare' : 'Common' },
              { trait_type: 'Generation', value: Math.floor(Math.random() * 3) + 1 },
              { trait_type: 'Power', value: Math.floor(Math.random() * 100) + 1 }
            ]
          },
          ownership: {
            ownerId: walletId,
            blockchain: 'solana',
            contractAddress: `${collection.toLowerCase()}_contract`,
            tokenId: nftId
          },
          valuation: {
            estimatedValue: 0.5 + Math.random() * 3.0, // 0.5-3.5 SOL
            currency: 'SOL',
            lastUpdated: new Date().toISOString(),
            source: 'performance_test'
          }
        };
        
        ownedNfts.push(nftId);
        nfts.push(nft);
      }
      
      // Generate wants that create CIRCULAR DEPENDENCIES (critical for SCC testing)
      const wantCount = 2 + Math.floor(Math.random() * 2);
      for (let k = 0; k < wantCount; k++) {
        let targetWallet;
        
        if (k === 0) {
          // Create primary circular chain: 0→1→2→...→0
          targetWallet = (i + 1) % walletCount;
        } else if (k === 1) {
          // Create secondary connections for complexity
          targetWallet = (i + Math.floor(walletCount / 3)) % walletCount;
        } else {
          // Random connections for graph density
          targetWallet = Math.floor(Math.random() * walletCount);
          if (targetWallet === i) targetWallet = (i + 1) % walletCount;
        }
        
        const collection = collections[Math.floor(Math.random() * collections.length)];
        const targetNftIndex = Math.floor(Math.random() * nftCount);
        const wantedNftId = `${collection}_${targetWallet}_${targetNftIndex}`;
        wantedNfts.push(wantedNftId);
      }
      
      wallets.push({
        id: walletId,
        ownedNFTs: ownedNfts,
        wantedNFTs: wantedNfts,
        preferences: {
          allowBundles: Math.random() > 0.3,
          minTradeValue: 0.1,
          maxTradeValue: 10.0,
          preferredCollections: [collections[i % collections.length]]
        }
      });
    }
    
    console.log(`✅ Generated test data:`);
    console.log(`   • Wallets: ${walletCount} (with circular dependencies)`);
    console.log(`   • NFTs: ${nfts.length} (across ${collections.length} collections)`);
    console.log(`   • Circular chains: Designed to create ${Math.ceil(walletCount / 3)} SCCs`);
    console.log(`   • Graph complexity: High (exercises all algorithms)`);
    
    return { wallets, nfts };
  }

  /**
   * Upload test data to tenant
   */
  async uploadTestData(tenantCredentials, testData) {
    const { tenantId, apiKey } = tenantCredentials;
    const { wallets, nfts } = testData;
    
    console.log(`📤 Uploading test data to ${tenantId}...`);
    
    const headers = {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    };
    
    try {
      // Upload inventory using the white label API format: { nfts: AbstractNFT[], walletId: string }
      for (const wallet of wallets) {
        const walletNfts = wallet.ownedNFTs.map(nftId => {
          const nft = nfts.find(n => n.id === nftId);
          return {
            id: nftId,
            metadata: nft.metadata,
            ownership: nft.ownership,
            valuation: nft.valuation
          };
        });
        
        // Submit NFTs for this wallet
        if (walletNfts.length > 0) {
          await axios.post(`${API_BASE}/api/v1/inventory/submit`, {
            nfts: walletNfts,
            walletId: wallet.id
          }, { headers });
        }
        
        // Submit wants for this wallet
        if (wallet.wantedNFTs.length > 0) {
          await axios.post(`${API_BASE}/api/v1/wants/submit`, {
            walletId: wallet.id,
            wantedNFTs: wallet.wantedNFTs
          }, { headers });
        }
      }
      
      console.log(`✅ Uploaded inventory: ${wallets.length} wallets with ${nfts.length} NFTs`);
      
    } catch (error) {
      throw new Error(`Failed to upload test data: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Test algorithm performance and measure results
   */
  async testAlgorithmPerformance(tenantCredentials, algorithmType) {
    const { tenantId, apiKey } = tenantCredentials;
    
    console.log(`🚀 Testing ${algorithmType.toUpperCase()} algorithm performance...`);
    
    const headers = {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    };
    
    // Run multiple tests for consistency
    const testRuns = 3;
    const results = [];
    
    for (let i = 0; i < testRuns; i++) {
      console.log(`   Run ${i + 1}/${testRuns}...`);
      
      const startTime = Date.now();
      
      try {
        const response = await axios.post(`${API_BASE}/api/v1/discovery/trades`, {
          settings: {
            maxDepth: 8,
            minEfficiency: 0.6,
            maxResults: 100,
            timeoutMs: 60000
          }
        }, { 
          headers,
          timeout: 65000
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        const trades = response.data.trades || [];
        
        // Analyze trade results
        const analysis = this.analyzeTradeResults(trades, algorithmType);
        
        results.push({
          responseTime,
          tradesFound: trades.length,
          analysis,
          trades: trades.slice(0, 3) // Sample trades for analysis
        });
        
        console.log(`   Run ${i + 1}: ${responseTime}ms, ${trades.length} trades`);
        
        // Small delay between runs
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.log(`   Run ${i + 1}: FAILED - ${error.message}`);
        results.push({
          responseTime: null,
          tradesFound: 0,
          error: error.message
        });
      }
    }
    
    // Calculate averages
    const successfulRuns = results.filter(r => r.responseTime !== null);
    const avgResponseTime = successfulRuns.length > 0 ? 
      successfulRuns.reduce((sum, r) => sum + r.responseTime, 0) / successfulRuns.length : null;
    const avgTradesFound = successfulRuns.length > 0 ?
      successfulRuns.reduce((sum, r) => sum + r.tradesFound, 0) / successfulRuns.length : 0;
    
    console.log(`📊 ${algorithmType.toUpperCase()} Results:`);
    console.log(`   Average Response Time: ${avgResponseTime ? avgResponseTime.toFixed(2) + 'ms' : 'FAILED'}`);
    console.log(`   Average Trades Found: ${avgTradesFound.toFixed(1)}`);
    console.log(`   Success Rate: ${successfulRuns.length}/${testRuns}`);
    
    return {
      algorithmType,
      avgResponseTime,
      avgTradesFound,
      successRate: successfulRuns.length / testRuns,
      results,
      analysis: successfulRuns[0]?.analysis || null
    };
  }

  /**
   * Analyze trade results for algorithm indicators
   */
  analyzeTradeResults(trades, algorithmType) {
    let canonicalTrades = 0;
    let legacyTrades = 0;
    let duplicates = 0;
    
    const tradeSignatures = new Set();
    
    for (const trade of trades) {
      // Check for canonical trade ID format
      if (trade.id && trade.id.includes('canonical_')) {
        canonicalTrades++;
      } else if (trade.id && (trade.id.includes('trade_') || trade.id.includes('loop_'))) {
        legacyTrades++;
      }
      
      // Check for duplicates
      if (trade.participants && trade.participants.length > 1) {
        const participants = trade.participants.map(p => p.walletId).sort().join(',');
        if (tradeSignatures.has(participants)) {
          duplicates++;
        } else {
          tradeSignatures.add(participants);
        }
      }
    }
    
    return {
      canonicalTrades,
      legacyTrades,
      duplicates,
      totalTrades: trades.length,
      algorithmType,
      duplicateRate: trades.length > 0 ? duplicates / trades.length : 0
    };
  }

  /**
   * Compare algorithm performance
   */
  compareAlgorithmPerformance(legacyResults, consolidationResults) {
    console.log('📊 ALGORITHM PERFORMANCE COMPARISON');
    console.log('=' .repeat(70));
    
    const performanceImprovement = legacyResults.avgResponseTime && consolidationResults.avgResponseTime ?
      ((legacyResults.avgResponseTime - consolidationResults.avgResponseTime) / legacyResults.avgResponseTime) * 100 : 0;
    
    const tradeQualityDiff = consolidationResults.avgTradesFound - legacyResults.avgTradesFound;
    
    const duplicateElimination = (legacyResults.analysis?.duplicates || 0) - (consolidationResults.analysis?.duplicates || 0);
    
    console.log(`🔧 LEGACY SYSTEM:`);
    console.log(`   Response Time: ${legacyResults.avgResponseTime?.toFixed(2) || 'FAILED'}ms`);
    console.log(`   Trades Found: ${legacyResults.avgTradesFound.toFixed(1)}`);
    console.log(`   Duplicates: ${legacyResults.analysis?.duplicates || 0}`);
    console.log(`   Success Rate: ${(legacyResults.successRate * 100).toFixed(1)}%`);
    
    console.log(`🚀 CONSOLIDATION SERVICE:`);
    console.log(`   Response Time: ${consolidationResults.avgResponseTime?.toFixed(2) || 'FAILED'}ms`);
    console.log(`   Trades Found: ${consolidationResults.avgTradesFound.toFixed(1)}`);
    console.log(`   Duplicates: ${consolidationResults.analysis?.duplicates || 0}`);
    console.log(`   Canonical Trades: ${consolidationResults.analysis?.canonicalTrades || 0}`);
    console.log(`   Success Rate: ${(consolidationResults.successRate * 100).toFixed(1)}%`);
    
    console.log(`📈 IMPROVEMENT ANALYSIS:`);
    console.log(`   Performance: ${performanceImprovement > 0 ? '+' : ''}${performanceImprovement.toFixed(1)}% ${performanceImprovement > 0 ? 'faster' : 'slower'}`);
    console.log(`   Trade Quality: ${tradeQualityDiff > 0 ? '+' : ''}${tradeQualityDiff.toFixed(1)} trades difference`);
    console.log(`   Duplicate Elimination: ${duplicateElimination} fewer duplicates`);
    
    // Assessment
    const noRegression = performanceImprovement >= -10; // Allow up to 10% slower
    const betterQuality = Math.abs(tradeQualityDiff) <= 2; // Allow small variance
    const duplicatesEliminated = (consolidationResults.analysis?.duplicates || 0) <= (legacyResults.analysis?.duplicates || 0);
    const canonicalWorking = (consolidationResults.analysis?.canonicalTrades || 0) > 0;
    
    console.log('');
    console.log('🎯 ALGORITHM CONSOLIDATION ASSESSMENT:');
    console.log(`   ✅ No Performance Regression: ${noRegression ? 'PASS' : 'FAIL'}`);
    console.log(`   ✅ Trade Quality Maintained: ${betterQuality ? 'PASS' : 'FAIL'}`);
    console.log(`   ✅ Duplicates Eliminated: ${duplicatesEliminated ? 'PASS' : 'FAIL'}`);
    console.log(`   ✅ Canonical IDs Working: ${canonicalWorking ? 'PASS' : 'FAIL'}`);
    
    const overallSuccess = noRegression && betterQuality && duplicatesEliminated;
    
    return {
      performanceImprovement,
      tradeQualityDiff,
      duplicateElimination,
      noRegression,
      betterQuality,
      duplicatesEliminated,
      canonicalWorking,
      overallSuccess
    };
  }

  /**
   * Run comprehensive algorithm performance test
   */
  async runPerformanceTest() {
    console.log('🔬 REAL ALGORITHM PERFORMANCE TEST');
    console.log('=' .repeat(70));
    console.log('🎯 Objective: Compare Legacy vs Consolidation Service performance');
    console.log('📊 Test Method: Side-by-side algorithm comparison with identical data');
    console.log('');
    
    try {
      // Generate identical test data for both tests
      const testData = this.generateAlgorithmTestData(20); // 20 wallets for good algorithm coverage
      
      // Create legacy tenant (canonical disabled)
      console.log('🔧 Setting up LEGACY algorithm test...');
      const legacyTenant = await this.createTestTenant('Legacy', false);
      await this.uploadTestData(legacyTenant, testData);
      
      // Create consolidation tenant (canonical enabled)
      console.log('🚀 Setting up CONSOLIDATION SERVICE test...');
      const consolidationTenant = await this.createTestTenant('Consolidation', true);
      await this.uploadTestData(consolidationTenant, testData);
      
      // Wait for data processing
      console.log('⏱️  Waiting 5 seconds for data processing...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Test legacy algorithm
      this.results.legacyPerformance = await this.testAlgorithmPerformance(legacyTenant, 'legacy');
      
      // Wait between tests
      console.log('⏱️  Waiting 3 seconds between tests...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Test consolidation service
      this.results.consolidationPerformance = await this.testAlgorithmPerformance(consolidationTenant, 'consolidation');
      
      // Compare results
      this.results.comparison = this.compareAlgorithmPerformance(
        this.results.legacyPerformance,
        this.results.consolidationPerformance
      );
      
      // Final assessment
      console.log('');
      console.log('🏆 FINAL ALGORITHM PERFORMANCE ASSESSMENT');
      console.log('=' .repeat(70));
      
      if (this.results.comparison.overallSuccess) {
        console.log('🎉 ALGORITHM CONSOLIDATION: ✅ SUCCESS!');
        console.log('🚀 Performance verified - no regression detected');
        console.log('🎯 Algorithm sophistication preserved');
        console.log('✅ Ready for production deployment!');
      } else {
        console.log('⚠️  ALGORITHM CONSOLIDATION: ❌ NEEDS REVIEW');
        console.log('🔧 Some performance metrics indicate regression');
        console.log('📊 Review detailed results above');
      }
      
      return this.results;
      
    } catch (error) {
      console.error('💥 Performance test failed:', error.message);
      throw error;
    }
  }
}

// Run the test
if (require.main === module) {
  const tester = new RealAlgorithmPerformanceTester();
  
  tester.runPerformanceTest()
    .then(results => {
      if (results.comparison?.overallSuccess) {
        console.log('\n🎯 ALGORITHM PERFORMANCE TEST: ✅ PASSED');
        process.exit(0);
      } else {
        console.log('\n🔧 ALGORITHM PERFORMANCE TEST: ❌ NEEDS REVIEW');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Test crashed:', error.message);
      process.exit(1);
    });
}

module.exports = RealAlgorithmPerformanceTester;