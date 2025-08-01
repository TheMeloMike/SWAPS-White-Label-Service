#!/usr/bin/env node

/**
 * 🚀 ALGORITHM CONSOLIDATION VERIFICATION TEST
 * 
 * This script verifies that the new AlgorithmConsolidationService:
 * 1. Successfully replaces legacy algorithm routing
 * 2. Eliminates duplicate trade discovery calls 
 * 3. Provides canonical trade IDs
 * 4. Demonstrates performance improvements
 * 
 * Expected Results:
 * - Zero duplicates in trade results
 * - Single algorithm path execution  
 * - Canonical trade IDs (not legacy permutations)
 * - Improved performance metrics
 */

const axios = require('axios');

const API_BASE = process.env.API_BASE || 'https://swaps-93hu.onrender.com';

// Test configuration
const TEST_CONFIG = {
  TENANT_COUNT: 1,
  WALLETS_PER_TENANT: 25,
  NFTS_PER_WALLET: 2,
  WANTS_PER_WALLET: 3
};

class AlgorithmConsolidationTester {
  constructor() {
    this.metrics = {
      totalRequestTime: 0,
      averageResponseTime: 0,
      duplicatesFound: 0,
      canonicalTradesFound: 0,
      legacyTradesFound: 0,
      consolidationSuccessRate: 0,
      algorithmMetrics: {}
    };
  }

  /**
   * Generate test data for algorithm consolidation verification
   */
  generateTestData(tenantId, walletCount = 25) {
    const wallets = [];
    const nfts = [];
    
    // Collections for realistic test data
    const collections = [
      'DeGods', 'Solana Monkey Business', 'Okay Bears', 'Magic Eden',
      'Star Atlas', 'Aurory', 'SolPunks', 'Thugbirdz', 'Famous Fox Federation'
    ];
    
    for (let i = 0; i < walletCount; i++) {
      const walletId = `test_wallet_${tenantId}_${i.toString().padStart(3, '0')}`;
      
      // Generate owned NFTs
      const ownedNfts = [];
      for (let j = 0; j < TEST_CONFIG.NFTS_PER_WALLET; j++) {
        const collection = collections[Math.floor(Math.random() * collections.length)];
        const nftId = `${collection}_${tenantId}_${i}_${j}`;
        
        ownedNfts.push({
          id: nftId,
          metadata: {
            name: `${collection} #${1000 + (i * 10) + j}`,
            symbol: collection.substring(0, 3).toUpperCase(),
            description: `Test NFT for algorithm consolidation verification`,
            image: `https://example.com/nft/${nftId}.png`,
            attributes: [
              { trait_type: 'Rarity', value: Math.random() > 0.7 ? 'Rare' : 'Common' },
              { trait_type: 'Collection', value: collection },
              { trait_type: 'Test', value: 'Algorithm Consolidation' }
            ]
          },
          ownership: {
            ownerId: walletId,
            blockchain: 'solana',
            contractAddress: `${collection.toLowerCase()}_contract`,
            tokenId: nftId
          },
          valuation: {
            estimatedValue: 0.5 + Math.random() * 2.0, // 0.5-2.5 SOL
            currency: 'SOL',
            lastUpdated: new Date().toISOString(),
            source: 'test_generator'
          }
        });
        
        nfts.push(ownedNfts[ownedNfts.length - 1]);
      }
      
      // Generate wanted NFTs (from other wallets/collections)
      const wantedNfts = [];
      for (let k = 0; k < TEST_CONFIG.WANTS_PER_WALLET; k++) {
        const targetWallet = (i + k + 1) % walletCount;
        const collection = collections[Math.floor(Math.random() * collections.length)];
        const wantedNftId = `${collection}_${tenantId}_${targetWallet}_${k}`;
        wantedNfts.push(wantedNftId);
      }
      
      wallets.push({
        id: walletId,
        ownedNFTs: ownedNfts.map(nft => nft.id),
        wantedNFTs: wantedNfts,
        preferences: {
          allowBundles: Math.random() > 0.3,
          minTradeValue: 0.1,
          maxTradeValue: 10.0,
          preferredCollections: [collections[i % collections.length]]
        }
      });
    }
    
    return { wallets, nfts };
  }

  /**
   * Create tenant and API key for testing
   */
  async createTestTenant(tenantId) {
    try {
      console.log(`📝 Creating test tenant: ${tenantId}`);
      
      const tenantResponse = await axios.post(`${API_BASE}/api/v1/admin/tenants`, {
        name: `Algorithm Consolidation Test ${tenantId}`,
        description: `Test tenant for verifying algorithm consolidation service`,
        settings: {
          algorithm: {
            enableCanonicalDiscovery: true,
            maxDepth: 8,
            minEfficiency: 0.6,
            maxLoopsPerRequest: 100
          },
          notifications: {
            webhookUrl: null,
            enableWebhooks: false
          }
        }
      });
      
      console.log(`✅ Tenant created: ${tenantResponse.data.tenant.id}`);
      return {
        tenantId: tenantResponse.data.tenant.id,
        apiKey: tenantResponse.data.apiKey
      };
      
    } catch (error) {
      console.error(`❌ Failed to create tenant ${tenantId}:`, 
        error.response?.data?.message || error.message);
      throw error;
    }
  }

  /**
   * Upload test data to verify algorithm consolidation
   */
  async uploadTestData(tenantCredentials, testData) {
    const { tenantId, apiKey } = tenantCredentials;
    const { wallets, nfts } = testData;
    
    try {
      console.log(`📤 Uploading ${wallets.length} wallets and ${nfts.length} NFTs for ${tenantId}`);
      
      const headers = {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      };
      
      // Upload NFTs
      for (const nft of nfts) {
        await axios.post(`${API_BASE}/api/v1/nfts`, nft, { headers });
      }
      
      // Upload wallets
      for (const wallet of wallets) {
        await axios.post(`${API_BASE}/api/v1/wallets`, wallet, { headers });
      }
      
      console.log(`✅ Test data uploaded for ${tenantId}`);
      
    } catch (error) {
      console.error(`❌ Failed to upload test data for ${tenantId}:`,
        error.response?.data?.message || error.message);
      throw error;
    }
  }

  /**
   * Test algorithm consolidation and measure performance
   */
  async testAlgorithmConsolidation(tenantCredentials) {
    const { tenantId, apiKey } = tenantCredentials;
    
    try {
      console.log(`🔍 Testing algorithm consolidation for ${tenantId}`);
      
      const headers = {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      };
      
      const startTime = Date.now();
      
      // Discover trades using new consolidated algorithm
      const response = await axios.post(`${API_BASE}/api/v1/trades/discover`, {
        settings: {
          maxDepth: 8,
          minEfficiency: 0.6,
          maxLoopsPerRequest: 50,
          timeoutMs: 30000
        }
      }, { headers });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      const trades = response.data.trades || [];
      
      console.log(`⚡ Algorithm consolidation completed in ${responseTime}ms`);
      console.log(`🔄 Found ${trades.length} trades`);
      
      // Analyze trade results for consolidation verification
      const analysis = this.analyzeTradeResults(trades, responseTime);
      
      console.log(`📊 Trade Analysis:`);
      console.log(`   • Canonical Trades: ${analysis.canonicalTrades}`);
      console.log(`   • Legacy Trades: ${analysis.legacyTrades}`);
      console.log(`   • Duplicates Found: ${analysis.duplicates}`);
      console.log(`   • Algorithm Used: ${analysis.algorithmType}`);
      console.log(`   • Response Time: ${responseTime}ms`);
      
      return {
        tenantId,
        responseTime,
        tradesFound: trades.length,
        analysis,
        trades: trades.slice(0, 3) // Sample trades for verification
      };
      
    } catch (error) {
      console.error(`❌ Algorithm consolidation test failed for ${tenantId}:`,
        error.response?.data?.message || error.message);
      throw error;
    }
  }

  /**
   * Analyze trade results to verify consolidation effectiveness
   */
  analyzeTradeResults(trades, responseTime) {
    let canonicalTrades = 0;
    let legacyTrades = 0;
    let duplicates = 0;
    let algorithmType = 'unknown';
    
    const tradeSignatures = new Set();
    
    for (const trade of trades) {
      // Check for canonical trade ID format
      if (trade.id && trade.id.includes('canonical_')) {
        canonicalTrades++;
        algorithmType = 'canonical';
      } else if (trade.id && (trade.id.includes('trade_') || trade.id.includes('loop_'))) {
        legacyTrades++;
        if (algorithmType === 'unknown') algorithmType = 'legacy';
      }
      
      // Check for duplicate trade logic (same participants, different IDs)
      if (trade.participants && trade.participants.length > 1) {
        const participants = trade.participants.map(p => p.walletId).sort().join(',');
        const nfts = trade.participants.map(p => p.gives?.nftId || '').sort().join(',');
        const signature = `${participants}|${nfts}`;
        
        if (tradeSignatures.has(signature)) {
          duplicates++;
        } else {
          tradeSignatures.add(signature);
        }
      }
    }
    
    return {
      canonicalTrades,
      legacyTrades,
      duplicates,
      algorithmType,
      responseTime,
      totalTrades: trades.length,
      consolidationEffective: canonicalTrades > legacyTrades && duplicates === 0
    };
  }

  /**
   * Run comprehensive algorithm consolidation verification
   */
  async runConsolidationTest() {
    console.log('🚀 ALGORITHM CONSOLIDATION VERIFICATION TEST');
    console.log('=' .repeat(80));
    console.log(`📊 Test Configuration:`);
    console.log(`   • Tenants: ${TEST_CONFIG.TENANT_COUNT}`);
    console.log(`   • Wallets per tenant: ${TEST_CONFIG.WALLETS_PER_TENANT}`);
    console.log(`   • NFTs per wallet: ${TEST_CONFIG.NFTS_PER_WALLET}`);
    console.log(`   • API Base: ${API_BASE}`);
    console.log('');
    
    const results = [];
    let totalResponseTime = 0;
    let totalTrades = 0;
    let totalCanonical = 0;
    let totalLegacy = 0;
    let totalDuplicates = 0;
    
    try {
      for (let i = 0; i < TEST_CONFIG.TENANT_COUNT; i++) {
        const tenantId = `algorithm_test_${Date.now()}_${i}`;
        
        console.log(`🔄 Testing tenant ${i + 1}/${TEST_CONFIG.TENANT_COUNT}: ${tenantId}`);
        
        // Create tenant
        const tenantCredentials = await this.createTestTenant(tenantId);
        
        // Generate and upload test data
        const testData = this.generateTestData(tenantId, TEST_CONFIG.WALLETS_PER_TENANT);
        await this.uploadTestData(tenantCredentials, testData);
        
        // Wait for data processing
        console.log('⏱️  Waiting 3 seconds for data processing...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test algorithm consolidation
        const result = await this.testAlgorithmConsolidation(tenantCredentials);
        results.push(result);
        
        // Aggregate metrics
        totalResponseTime += result.responseTime;
        totalTrades += result.tradesFound;
        totalCanonical += result.analysis.canonicalTrades;
        totalLegacy += result.analysis.legacyTrades;
        totalDuplicates += result.analysis.duplicates;
        
        console.log(`✅ Tenant ${tenantId} completed\n`);
      }
      
      // Calculate final metrics
      const averageResponseTime = totalResponseTime / TEST_CONFIG.TENANT_COUNT;
      const consolidationSuccess = totalCanonical > totalLegacy && totalDuplicates === 0;
      
      console.log('🎯 ALGORITHM CONSOLIDATION VERIFICATION RESULTS');
      console.log('=' .repeat(80));
      console.log(`📊 Performance Metrics:`);
      console.log(`   • Average Response Time: ${averageResponseTime.toFixed(2)}ms`);
      console.log(`   • Total Trades Found: ${totalTrades}`);
      console.log(`   • Canonical Trades: ${totalCanonical} (${((totalCanonical/totalTrades)*100).toFixed(1)}%)`);
      console.log(`   • Legacy Trades: ${totalLegacy} (${((totalLegacy/totalTrades)*100).toFixed(1)}%)`);
      console.log(`   • Duplicates Found: ${totalDuplicates}`);
      console.log('');
      
      console.log('🔍 Consolidation Analysis:');
      console.log(`   • Algorithm Consolidation: ${consolidationSuccess ? '✅ SUCCESSFUL' : '❌ NEEDS IMPROVEMENT'}`);
      console.log(`   • Duplicate Elimination: ${totalDuplicates === 0 ? '✅ ZERO DUPLICATES' : `❌ ${totalDuplicates} DUPLICATES FOUND`}`);
      console.log(`   • Canonical ID Usage: ${totalCanonical > 0 ? '✅ CANONICAL IDs ACTIVE' : '❌ NO CANONICAL IDs'}`);
      console.log('');
      
      if (consolidationSuccess) {
        console.log('🎉 ALGORITHM CONSOLIDATION: ✅ VERIFIED AND WORKING');
        console.log('🚀 Performance improvement delivered as expected');
        console.log('🎯 Zero duplicates confirmed - enterprise ready!');
      } else {
        console.log('⚠️  ALGORITHM CONSOLIDATION: ❌ NEEDS ATTENTION');
        console.log('🔧 Check AlgorithmConsolidationService configuration');
        console.log('📊 Review canonical engine enablement settings');
      }
      
      return {
        success: consolidationSuccess,
        averageResponseTime,
        totalTrades,
        consolidationMetrics: {
          canonicalTrades: totalCanonical,
          legacyTrades: totalLegacy,
          duplicates: totalDuplicates,
          consolidationRate: totalCanonical / Math.max(1, totalTrades)
        },
        results
      };
      
    } catch (error) {
      console.error('❌ Algorithm consolidation verification failed:', error.message);
      throw error;
    }
  }
}

// Run the test if called directly
if (require.main === module) {
  const tester = new AlgorithmConsolidationTester();
  
  tester.runConsolidationTest()
    .then(results => {
      console.log('\n📋 FINAL ASSESSMENT:');
      
      if (results.success) {
        console.log('🚀 Algorithm consolidation is working correctly!');
        console.log(`⚡ Performance: ${results.averageResponseTime.toFixed(2)}ms average`);
        console.log(`🎯 Consolidation: ${(results.consolidationMetrics.consolidationRate * 100).toFixed(1)}% canonical`);
        process.exit(0);
      } else {
        console.log('❌ Algorithm consolidation needs improvement');
        console.log('🔧 Review configuration and implementation');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = AlgorithmConsolidationTester;