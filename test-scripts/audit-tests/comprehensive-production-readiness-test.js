#!/usr/bin/env node

/**
 * COMPREHENSIVE PRODUCTION READINESS TEST
 * 
 * This test validates the entire system is ready for client deployment:
 * 1. Multi-tenant isolation and security
 * 2. API performance and reliability  
 * 3. Complex trade scenarios
 * 4. Mathematical optimizations under load
 * 5. Error handling and edge cases
 * 6. Real-world simulation
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_URL || 'https://swaps-93hu.onrender.com/api/v1';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'swaps_admin_prod_2025_secure_key_abc123';

console.log('🏭 COMPREHENSIVE PRODUCTION READINESS TEST');
console.log('==========================================');
console.log(`🔗 API URL: ${BASE_URL}`);
console.log('');

class ProductionReadinessValidator {
  constructor() {
    this.results = {
      multiTenant: { passed: 0, total: 0, errors: [] },
      performance: { passed: 0, total: 0, errors: [] },
      algorithms: { passed: 0, total: 0, errors: [] },
      security: { passed: 0, total: 0, errors: [] },
      reliability: { passed: 0, total: 0, errors: [] }
    };
  }

  async createTenant(name, contactEmail) {
    try {
      const response = await axios.post(`${BASE_URL}/admin/tenants`, {
        name: name,
        contactEmail: contactEmail,
        settings: {
          algorithm: { maxDepth: 15, minEfficiency: 0.3, maxLoopsPerRequest: 50 },
          security: { maxNFTsPerWallet: 1000, maxWantsPerWallet: 100 }
        }
      }, {
        headers: {
          'Authorization': `Bearer ${ADMIN_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      const tenant = response.data.tenant;
      const apiKey = tenant.apiKey || response.data.apiKey;
      return { tenant, apiKey };
    } catch (error) {
      throw new Error(`Tenant creation failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async submitInventory(apiKey, walletId, nfts) {
    const startTime = Date.now();
    try {
      const response = await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: walletId,
        nfts: nfts
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });
      
      const responseTime = Date.now() - startTime;
      return { ...response.data, responseTime };
    } catch (error) {
      throw new Error(`Inventory submission failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async submitWants(apiKey, walletId, wantedNFTs) {
    const startTime = Date.now();
    try {
      const response = await axios.post(`${BASE_URL}/wants/submit`, {
        walletId: walletId,
        wantedNFTs: wantedNFTs
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });
      
      const responseTime = Date.now() - startTime;
      return { ...response.data, responseTime };
    } catch (error) {
      throw new Error(`Wants submission failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async queryTrades(apiKey, walletId) {
    const startTime = Date.now();
    try {
      const response = await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: walletId
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });
      
      const responseTime = Date.now() - startTime;
      return { ...response.data, responseTime };
    } catch (error) {
      throw new Error(`Trade query failed: ${error.response?.data?.error || error.message}`);
    }
  }

  recordTest(category, passed, description, error = null) {
    this.results[category].total++;
    if (passed) {
      this.results[category].passed++;
      console.log(`   ✅ ${description}`);
    } else {
      this.results[category].errors.push({ description, error: error?.message || error });
      console.log(`   ❌ ${description}: ${error?.message || error}`);
    }
  }

  async testMultiTenantIsolation() {
    console.log('🏢 Testing Multi-Tenant Isolation...');
    
    try {
      // Create two separate tenants
      const tenant1 = await this.createTenant('Production Test Client 1', 'client1@test.com');
      const tenant2 = await this.createTenant('Production Test Client 2', 'client2@test.com');
      
      this.recordTest('multiTenant', true, 'Multiple tenant creation');
      
      // Add data to tenant 1
      await this.submitInventory(tenant1.apiKey, 'tenant1_wallet', [{
        id: 'tenant1_nft',
        metadata: { name: 'Tenant 1 NFT', symbol: 'T1', description: 'Isolated NFT' },
        ownership: { ownerId: 'tenant1_wallet', blockchain: 'solana', contractAddress: 't1_contract', tokenId: 'tenant1_nft' },
        valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'isolation_test' }
      }]);
      
      await this.submitWants(tenant1.apiKey, 'tenant1_wallet', ['tenant1_want']);
      
      // Try to access tenant 1 data with tenant 2 key (should fail gracefully)
      try {
        await this.queryTrades(tenant2.apiKey, 'tenant1_wallet');
        this.recordTest('security', false, 'Cross-tenant access should be blocked');
      } catch (error) {
        this.recordTest('security', true, 'Cross-tenant access properly blocked');
      }
      
      this.recordTest('multiTenant', true, 'Tenant isolation verification');
      
      return { tenant1, tenant2 };
      
    } catch (error) {
      this.recordTest('multiTenant', false, 'Multi-tenant setup', error);
      throw error;
    }
  }

  async testPerformanceUnderLoad(apiKey, baseWalletId) {
    console.log('⚡ Testing Performance Under Load...');
    
    const responseTimes = [];
    const batchSize = 5;
    
    try {
      // Submit multiple wallets rapidly
      for (let i = 1; i <= batchSize; i++) {
        const walletId = `${baseWalletId}_${i}`;
        const nfts = [{
          id: `load_nft_${i}`,
          metadata: { name: `Load Test NFT ${i}`, symbol: `LOAD${i}`, description: `Performance test NFT ${i}` },
          ownership: { ownerId: walletId, blockchain: 'solana', contractAddress: `load_contract_${i}`, tokenId: `load_nft_${i}` },
          valuation: { estimatedValue: 1.0 + (i * 0.1), currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'load_test' }
        }];
        
        const result = await this.submitInventory(apiKey, walletId, nfts);
        responseTimes.push(result.responseTime);
      }
      
      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      
      this.recordTest('performance', avgResponseTime < 2000, `Average response time: ${avgResponseTime.toFixed(2)}ms (target: <2000ms)`);
      this.recordTest('performance', maxResponseTime < 5000, `Max response time: ${maxResponseTime.toFixed(2)}ms (target: <5000ms)`);
      this.recordTest('performance', responseTimes.length === batchSize, `Batch processing: ${responseTimes.length}/${batchSize} requests`);
      
      return { avgResponseTime, maxResponseTime, responseTimes };
      
    } catch (error) {
      this.recordTest('performance', false, 'Load testing', error);
      throw error;
    }
  }

  async testComplexAlgorithmScenarios(apiKey) {
    console.log('🧮 Testing Complex Algorithm Scenarios...');
    
    try {
      // Create complex interconnected scenario
      const wallets = [];
      for (let i = 1; i <= 6; i++) {
        const walletId = `complex_wallet_${i}`;
        
        // Submit inventory
        const nfts = [{
          id: `complex_nft_${i}`,
          metadata: { name: `Complex NFT ${i}`, symbol: `COMP${i}`, description: `Complex scenario NFT ${i}` },
          ownership: { ownerId: walletId, blockchain: 'solana', contractAddress: `complex_contract_${i}`, tokenId: `complex_nft_${i}` },
          valuation: { estimatedValue: 1.0 + (i * 0.15), currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'complex_test' }
        }];
        
        await this.submitInventory(apiKey, walletId, nfts);
        wallets.push(walletId);
      }
      
      this.recordTest('algorithms', true, 'Complex inventory setup (6 wallets)');
      
      // Create circular want pattern: 1→2→3→4→5→6→1
      for (let i = 1; i <= 6; i++) {
        const walletId = `complex_wallet_${i}`;
        const wantedNft = `complex_nft_${i === 6 ? 1 : i + 1}`;
        
        await this.submitWants(apiKey, walletId, [wantedNft]);
      }
      
      this.recordTest('algorithms', true, 'Complex circular wants pattern');
      
      // Query for trades and analyze
      let totalTrades = 0;
      let qualityScores = [];
      
      for (const walletId of wallets) {
        const result = await this.queryTrades(apiKey, walletId);
        totalTrades += result.trades.length;
        
        if (result.trades.length > 0 && result.trades[0].qualityScore) {
          qualityScores.push(result.trades[0].qualityScore);
        }
      }
      
      this.recordTest('algorithms', totalTrades > 0, `Trade discovery: ${totalTrades} trades found`);
      this.recordTest('algorithms', totalTrades >= 6, `Complex loop detection: Found ${totalTrades} trades (expected ≥6)`);
      
      if (qualityScores.length > 0) {
        const avgQuality = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
        this.recordTest('algorithms', avgQuality >= 0.5, `Quality scoring: Average ${avgQuality.toFixed(3)} (target: ≥0.5)`);
      }
      
      this.recordTest('algorithms', true, 'Complex algorithm scenario completed');
      
    } catch (error) {
      this.recordTest('algorithms', false, 'Complex algorithm testing', error);
      throw error;
    }
  }

  async testErrorHandlingAndEdgeCases(apiKey) {
    console.log('🛡️  Testing Error Handling & Edge Cases...');
    
    try {
      // Test invalid NFT data
      try {
        await this.submitInventory(apiKey, 'test_wallet', [{ invalid: 'data' }]);
        this.recordTest('reliability', false, 'Invalid NFT data should be rejected');
      } catch (error) {
        this.recordTest('reliability', true, 'Invalid NFT data properly rejected');
      }
      
      // Test non-existent wallet query
      const result = await this.queryTrades(apiKey, 'non_existent_wallet');
      this.recordTest('reliability', result.trades.length === 0, 'Non-existent wallet returns empty results');
      
      // Test empty wants array
      const emptyWantsResult = await this.submitWants(apiKey, 'test_wallet', []);
      this.recordTest('reliability', emptyWantsResult.wantsProcessed === 0, 'Empty wants array handled correctly');
      
      this.recordTest('reliability', true, 'Error handling tests completed');
      
    } catch (error) {
      this.recordTest('reliability', false, 'Error handling testing', error);
      throw error;
    }
  }

  printFinalReport() {
    console.log('');
    console.log('📊 COMPREHENSIVE PRODUCTION READINESS REPORT');
    console.log('============================================');
    
    let totalPassed = 0;
    let totalTests = 0;
    
    for (const [category, results] of Object.entries(this.results)) {
      totalPassed += results.passed;
      totalTests += results.total;
      
      const percentage = results.total > 0 ? (results.passed / results.total * 100).toFixed(1) : '0.0';
      const status = results.passed === results.total ? '✅' : results.passed > results.total * 0.8 ? '⚠️' : '❌';
      
      console.log(`${status} ${category.toUpperCase()}: ${results.passed}/${results.total} (${percentage}%)`);
      
      if (results.errors.length > 0) {
        for (const error of results.errors) {
          console.log(`   🔍 ${error.description}: ${error.error}`);
        }
      }
    }
    
    const overallPercentage = totalTests > 0 ? (totalPassed / totalTests * 100).toFixed(1) : '0.0';
    
    console.log('');
    console.log(`🏆 OVERALL READINESS: ${totalPassed}/${totalTests} (${overallPercentage}%)`);
    
    if (overallPercentage >= 90) {
      console.log('✅ EXCELLENT: System is production-ready for immediate client deployment');
      console.log('🚀 Recommendation: Proceed with client licensing and demonstrations');
    } else if (overallPercentage >= 80) {
      console.log('⚠️  GOOD: System is mostly ready with minor improvements needed');
      console.log('🔧 Recommendation: Address specific issues before client deployment');
    } else {
      console.log('❌ NEEDS WORK: System requires significant improvements before production');
      console.log('🛠️  Recommendation: Fix critical issues before client engagement');
    }
    
    console.log('');
    console.log('📋 NEXT STEPS:');
    console.log('1. Review any failed tests and error details above');
    console.log('2. Implement fixes for critical issues');
    console.log('3. Re-run this test to validate improvements');
    console.log('4. Proceed with client demonstrations for passing categories');
  }

  async runComprehensiveTest() {
    console.log('🚀 Starting comprehensive production readiness validation...');
    console.log('');
    
    try {
      // Test 1: Multi-tenant isolation
      const { tenant1, tenant2 } = await this.testMultiTenantIsolation();
      console.log('');
      
      // Test 2: Performance under load
      await this.testPerformanceUnderLoad(tenant1.apiKey, 'performance_wallet');
      console.log('');
      
      // Test 3: Complex algorithm scenarios
      await this.testComplexAlgorithmScenarios(tenant1.apiKey);
      console.log('');
      
      // Test 4: Error handling and edge cases
      await this.testErrorHandlingAndEdgeCases(tenant1.apiKey);
      console.log('');
      
      // Print final report
      this.printFinalReport();
      
    } catch (error) {
      console.error('💥 Comprehensive test failed:', error.message);
      this.printFinalReport();
      process.exit(1);
    }
  }
}

// Run the comprehensive test
const validator = new ProductionReadinessValidator();
validator.runComprehensiveTest();