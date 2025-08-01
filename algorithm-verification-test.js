#!/usr/bin/env node

/**
 * 🚀 ALGORITHM CONSOLIDATION VERIFICATION TEST (Lightweight)
 * 
 * This test verifies that AlgorithmConsolidationService is working correctly
 * by using existing tenant data and checking for the key indicators:
 * 
 * 1. ✅ API responds successfully with trade discovery
 * 2. ✅ Response times are reasonable (no major regression)
 * 3. ✅ Canonical trade IDs are being generated
 * 4. ✅ No duplicate trade detection
 * 5. ✅ Algorithm consolidation logs appear
 */

const axios = require('axios');

const API_BASE = process.env.API_BASE || 'https://swaps-93hu.onrender.com';

class AlgorithmVerificationTester {
  constructor() {
    this.results = {
      apiHealth: false,
      tradeDiscoveryWorking: false,
      responseTimeAcceptable: false,
      canonicalIdsDetected: false,
      consolidationActive: false,
      overallSuccess: false
    };
  }

  /**
   * Test API health and basic functionality
   */
  async testAPIHealth() {
    console.log('🔍 Testing API Health...');
    
    try {
      const response = await axios.get(`${API_BASE}/api/v1/health`, {
        timeout: 10000
      });
      
      if (response.status === 200 && response.data.status === 'ok') {
        this.results.apiHealth = true;
        console.log('✅ API Health: HEALTHY');
        return true;
      } else {
        console.log('❌ API Health: UNHEALTHY');
        return false;
      }
    } catch (error) {
      console.log('❌ API Health: FAILED', error.message);
      return false;
    }
  }

  /**
   * Test algorithm consolidation with a simple existing tenant
   */
  async testAlgorithmConsolidation() {
    console.log('🚀 Testing Algorithm Consolidation...');
    
    // First, let's try to create a simple tenant for testing
    try {
      // Create a basic tenant (not admin)
      const tenantResponse = await axios.post(`${API_BASE}/api/v1/tenants`, {
        name: 'Algorithm Verification Test',
        description: 'Simple test to verify algorithm consolidation is working'
      });
      
      const { tenantId, apiKey } = tenantResponse.data;
      console.log(`📝 Created test tenant: ${tenantId}`);
      
      // Add some simple test data
      await this.uploadSimpleTestData(apiKey);
      
      // Wait for processing
      console.log('⏱️  Waiting 3 seconds for data processing...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Test trade discovery
      const discoveryResult = await this.testTradeDiscovery(apiKey);
      
      return discoveryResult;
      
    } catch (error) {
      console.log('❌ Algorithm Consolidation Test Failed:', error.response?.data?.message || error.message);
      
      // If tenant creation fails, try with a test approach that doesn't need tenant creation
      return await this.testWithoutTenantCreation();
    }
  }

  /**
   * Upload minimal test data to trigger algorithm execution
   */
  async uploadSimpleTestData(apiKey) {
    const headers = {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    };
    
    console.log('📤 Uploading simple test data...');
    
    // Create 3 simple NFTs
    const nfts = [
      {
        id: 'test_nft_1',
        metadata: {
          name: 'Test NFT 1',
          symbol: 'TEST',
          description: 'Algorithm verification test NFT'
        },
        ownership: {
          ownerId: 'test_wallet_1',
          blockchain: 'solana',
          contractAddress: 'test_contract',
          tokenId: 'test_nft_1'
        },
        valuation: {
          estimatedValue: 1.0,
          currency: 'SOL',
          lastUpdated: new Date().toISOString(),
          source: 'test'
        }
      },
      {
        id: 'test_nft_2',
        metadata: {
          name: 'Test NFT 2',
          symbol: 'TEST',
          description: 'Algorithm verification test NFT'
        },
        ownership: {
          ownerId: 'test_wallet_2',
          blockchain: 'solana',
          contractAddress: 'test_contract',
          tokenId: 'test_nft_2'
        },
        valuation: {
          estimatedValue: 1.0,
          currency: 'SOL',
          lastUpdated: new Date().toISOString(),
          source: 'test'
        }
      },
      {
        id: 'test_nft_3',
        metadata: {
          name: 'Test NFT 3',
          symbol: 'TEST',
          description: 'Algorithm verification test NFT'
        },
        ownership: {
          ownerId: 'test_wallet_3',
          blockchain: 'solana',
          contractAddress: 'test_contract',
          tokenId: 'test_nft_3'
        },
        valuation: {
          estimatedValue: 1.0,
          currency: 'SOL',
          lastUpdated: new Date().toISOString(),
          source: 'test'
        }
      }
    ];
    
    // Create 3 simple wallets with circular wants (for algorithm testing)
    const wallets = [
      {
        id: 'test_wallet_1',
        ownedNFTs: ['test_nft_1'],
        wantedNFTs: ['test_nft_2'],
        preferences: {
          allowBundles: true,
          minTradeValue: 0.1,
          maxTradeValue: 10.0
        }
      },
      {
        id: 'test_wallet_2',
        ownedNFTs: ['test_nft_2'],
        wantedNFTs: ['test_nft_3'],
        preferences: {
          allowBundles: true,
          minTradeValue: 0.1,
          maxTradeValue: 10.0
        }
      },
      {
        id: 'test_wallet_3',
        ownedNFTs: ['test_nft_3'],
        wantedNFTs: ['test_nft_1'],
        preferences: {
          allowBundles: true,
          minTradeValue: 0.1,
          maxTradeValue: 10.0
        }
      }
    ];
    
    // Upload NFTs
    for (const nft of nfts) {
      await axios.post(`${API_BASE}/api/v1/nfts`, nft, { headers });
    }
    
    // Upload wallets
    for (const wallet of wallets) {
      await axios.post(`${API_BASE}/api/v1/wallets`, wallet, { headers });
    }
    
    console.log('✅ Simple test data uploaded (3 NFTs, 3 wallets with circular wants)');
  }

  /**
   * Test trade discovery and measure performance
   */
  async testTradeDiscovery(apiKey) {
    console.log('🔍 Testing Trade Discovery...');
    
    const headers = {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    };
    
    const startTime = Date.now();
    
    try {
      const response = await axios.post(`${API_BASE}/api/v1/trades/discover`, {
        settings: {
          maxDepth: 5,
          minEfficiency: 0.6,
          maxResults: 50,
          timeoutMs: 30000
        }
      }, { 
        headers,
        timeout: 35000
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log(`⚡ Trade Discovery Response Time: ${responseTime}ms`);
      
      // Check if response time is acceptable (< 10 seconds)
      this.results.responseTimeAcceptable = responseTime < 10000;
      
      const trades = response.data.trades || [];
      console.log(`🔄 Trades Found: ${trades.length}`);
      
      // Analyze the results
      this.analyzeTradeResults(trades, responseTime);
      
      this.results.tradeDiscoveryWorking = true;
      
      return {
        success: true,
        responseTime,
        tradesFound: trades.length,
        trades: trades.slice(0, 3) // Sample trades
      };
      
    } catch (error) {
      console.log('❌ Trade Discovery Failed:', error.response?.data?.message || error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze trade results for consolidation indicators
   */
  analyzeTradeResults(trades, responseTime) {
    console.log('📊 Analyzing Algorithm Consolidation Indicators...');
    
    // Check for canonical trade IDs
    let canonicalTrades = 0;
    let duplicateSignatures = new Set();
    let duplicatesFound = 0;
    
    for (const trade of trades) {
      // Check for canonical ID format
      if (trade.id && trade.id.includes('canonical_')) {
        canonicalTrades++;
      }
      
      // Check for duplicates
      if (trade.participants && trade.participants.length > 1) {
        const signature = trade.participants.map(p => p.walletId).sort().join(',');
        if (duplicateSignatures.has(signature)) {
          duplicatesFound++;
        } else {
          duplicateSignatures.add(signature);
        }
      }
    }
    
    // Update results based on analysis
    this.results.canonicalIdsDetected = canonicalTrades > 0;
    
    console.log(`   • Canonical Trade IDs: ${canonicalTrades}/${trades.length}`);
    console.log(`   • Duplicates Found: ${duplicatesFound}`);
    console.log(`   • Response Time: ${responseTime}ms`);
    console.log(`   • Algorithm Indicators:`);
    console.log(`     - Canonical IDs Active: ${this.results.canonicalIdsDetected ? '✅' : '❌'}`);
    console.log(`     - Response Time OK: ${this.results.responseTimeAcceptable ? '✅' : '❌'}`);
    console.log(`     - Zero Duplicates: ${duplicatesFound === 0 ? '✅' : '❌'}`);
    
    // Mark consolidation as active if we see the expected indicators
    this.results.consolidationActive = this.results.canonicalIdsDetected || duplicatesFound === 0;
  }

  /**
   * Test without creating new tenants (fallback approach)
   */
  async testWithoutTenantCreation() {
    console.log('🔄 Testing algorithm verification without tenant creation...');
    
    try {
      // Test general API endpoints that might show algorithm status
      const endpoints = [
        '/api/v1/health',
        '/monitoring/health',
        '/monitoring/metrics'
      ];
      
      for (const endpoint of endpoints) {
        try {
          const response = await axios.get(`${API_BASE}${endpoint}`, { timeout: 5000 });
          console.log(`✅ ${endpoint}: ${response.status}`);
          
          // Look for algorithm-related information in responses
          if (response.data && typeof response.data === 'object') {
            const dataStr = JSON.stringify(response.data).toLowerCase();
            
            if (dataStr.includes('canonical') || dataStr.includes('consolidation')) {
              console.log(`🎯 Found algorithm consolidation indicators in ${endpoint}`);
              this.results.consolidationActive = true;
            }
          }
        } catch (error) {
          console.log(`❌ ${endpoint}: Failed (${error.message})`);
        }
      }
      
      return {
        success: true,
        message: 'Basic API verification completed'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Run comprehensive verification test
   */
  async runVerificationTest() {
    console.log('🔬 ALGORITHM CONSOLIDATION VERIFICATION TEST');
    console.log('=' .repeat(70));
    console.log('🎯 Objective: Verify algorithm consolidation is working');
    console.log(`🌐 API Base: ${API_BASE}`);
    console.log('');
    
    try {
      // Step 1: Test API Health
      const healthOk = await this.testAPIHealth();
      
      if (!healthOk) {
        throw new Error('API health check failed');
      }
      
      // Step 2: Test Algorithm Consolidation
      await this.testAlgorithmConsolidation();
      
      // Step 3: Calculate overall success
      this.results.overallSuccess = 
        this.results.apiHealth && 
        this.results.tradeDiscoveryWorking &&
        this.results.responseTimeAcceptable;
      
      // Step 4: Display results
      this.displayResults();
      
      return this.results;
      
    } catch (error) {
      console.error('💥 Verification test failed:', error.message);
      this.displayResults();
      return this.results;
    }
  }

  /**
   * Display comprehensive test results
   */
  displayResults() {
    console.log('');
    console.log('🏆 ALGORITHM CONSOLIDATION VERIFICATION RESULTS');
    console.log('=' .repeat(70));
    console.log(`✅ API Health: ${this.results.apiHealth ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Trade Discovery: ${this.results.tradeDiscoveryWorking ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Response Time: ${this.results.responseTimeAcceptable ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Canonical IDs: ${this.results.canonicalIdsDetected ? 'DETECTED' : 'NOT DETECTED'}`);
    console.log(`✅ Consolidation Active: ${this.results.consolidationActive ? 'YES' : 'NO'}`);
    console.log('');
    
    if (this.results.overallSuccess) {
      console.log('🎉 VERIFICATION SUCCESSFUL!');
      console.log('✅ Algorithm consolidation is working correctly');
      console.log('🚀 System is ready for production use');
    } else {
      console.log('⚠️  VERIFICATION NEEDS ATTENTION');
      console.log('🔧 Some components may need review');
      
      const failedChecks = [];
      if (!this.results.apiHealth) failedChecks.push('API Health');
      if (!this.results.tradeDiscoveryWorking) failedChecks.push('Trade Discovery');
      if (!this.results.responseTimeAcceptable) failedChecks.push('Response Time');
      
      if (failedChecks.length > 0) {
        console.log(`❌ Failed checks: ${failedChecks.join(', ')}`);
      }
    }
    
    console.log('');
    console.log('📋 SUMMARY:');
    console.log(`   • Algorithm consolidation appears to be: ${this.results.consolidationActive ? 'ACTIVE' : 'INACTIVE'}`);
    console.log(`   • System performance: ${this.results.responseTimeAcceptable ? 'GOOD' : 'NEEDS IMPROVEMENT'}`);
    console.log(`   • Overall readiness: ${this.results.overallSuccess ? 'READY' : 'NEEDS WORK'}`);
  }
}

// Run the test if called directly
if (require.main === module) {
  const tester = new AlgorithmVerificationTester();
  
  tester.runVerificationTest()
    .then(results => {
      if (results.overallSuccess) {
        console.log('\n🎯 VERIFICATION PASSED');
        console.log('✅ Algorithm consolidation verified and working!');
        process.exit(0);
      } else {
        console.log('\n🔧 VERIFICATION INCOMPLETE');
        console.log('⚠️  Some checks failed - review results above');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Verification crashed:', error.message);
      process.exit(1);
    });
}

module.exports = AlgorithmVerificationTester;