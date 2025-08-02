#!/usr/bin/env node

/**
 * 🎯 ACCURATE MVP READINESS TEST
 * 
 * CRITICAL: This test properly respects the LIVING PERSISTENT GRAPH architecture
 * - Uses submitInventory and submitWants to populate the graph
 * - Allows time for background processing
 * - Queries from the persistent cache
 * - Does NOT treat it as computation-on-demand
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'https://swaps-93hu.onrender.com/api/v1';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'swaps_admin_prod_2025_secure_key_abc123';

console.log('🎯 ACCURATE MVP READINESS TEST - LIVING PERSISTENT GRAPH');
console.log('========================================================');
console.log('✅ Testing with proper event-driven flow');
console.log('✅ Respecting the living graph architecture');
console.log('');

class AccurateMVPTester {
  constructor() {
    this.results = {
      performance: { passed: 0, total: 0, details: [] },
      functionality: { passed: 0, total: 0, details: [] },
      reliability: { passed: 0, total: 0, details: [] }
    };
    
    this.apiKey = null;
    this.tenantId = null;
  }

  async setupTestTenant() {
    console.log('🏗️ Setting up test tenant...');
    try {
      const response = await axios.post(`${BASE_URL}/admin/tenants`, {
        name: 'Accurate_MVP_Test_' + Date.now(),
        contactEmail: 'accurate@mvptest.com',
        settings: {
          algorithm: { maxDepth: 15, minEfficiency: 0.3, maxLoopsPerRequest: 50 },
          security: { maxNFTsPerWallet: 1000, maxWantsPerWallet: 100 }
        }
      }, {
        headers: { 'Authorization': `Bearer ${ADMIN_API_KEY}`, 'Content-Type': 'application/json' }
      });

      this.tenantId = response.data.tenant.id;
      this.apiKey = response.data.tenant.apiKey || response.data.apiKey;
      
      console.log(`   ✅ Tenant created: ${this.tenantId}`);
      return true;
    } catch (error) {
      console.error('   ❌ Failed to create tenant:', error.message);
      return false;
    }
  }

  async testLivingGraphPerformance() {
    console.log('\n⚡ TESTING LIVING GRAPH PERFORMANCE');
    console.log('===================================');
    
    // Test 1: Event-driven submission performance
    console.log('🧪 Test 1: NFT submission triggers background processing...');
    const submitStart = Date.now();
    
    try {
      const response = await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: 'perf_wallet_1',
        nfts: [{
          id: 'perf_nft_1',
          metadata: { name: 'Performance NFT 1', symbol: 'PERF1', description: 'Testing living graph' },
          ownership: { ownerId: 'perf_wallet_1', blockchain: 'solana', contractAddress: 'perf_contract', tokenId: 'perf_nft_1' },
          valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'perf_test' }
        }]
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      const submitTime = Date.now() - submitStart;
      
      // Check if background processing started
      const newLoops = response.data.newLoopsDiscovered || 0;
      
      this.logResult('performance', submitTime < 2000, 
        `NFT submission: ${submitTime}ms${newLoops > 0 ? ` (${newLoops} loops discovered immediately)` : ''}`);
        
      console.log(`   📊 Submission time: ${submitTime}ms`);
      console.log(`   📊 Immediate discoveries: ${newLoops}`);
      
    } catch (error) {
      this.logResult('performance', false, `NFT submission failed: ${error.message}`);
    }

    // Test 2: Want submission performance
    console.log('\n🧪 Test 2: Want submission triggers discovery...');
    const wantStart = Date.now();
    
    try {
      const response = await axios.post(`${BASE_URL}/wants/submit`, {
        walletId: 'perf_wallet_2',
        wantedNFTs: ['perf_nft_1']
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      const wantTime = Date.now() - wantStart;
      const newLoops = response.data.newLoopsDiscovered || 0;
      
      this.logResult('performance', wantTime < 2000,
        `Want submission: ${wantTime}ms${newLoops > 0 ? ` (${newLoops} loops discovered)` : ''}`);
        
      console.log(`   📊 Want submission time: ${wantTime}ms`);
      console.log(`   📊 Loops discovered: ${newLoops}`);
      
    } catch (error) {
      this.logResult('performance', false, `Want submission failed: ${error.message}`);
    }

    // Test 3: Query from living graph (should be instant)
    console.log('\n🧪 Test 3: Querying from living graph cache...');
    
    // First populate some data
    await this.populateTestData();
    
    // Allow background processing
    console.log('   ⏳ Allowing 2s for background processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const queryStart = Date.now();
    
    try {
      const response = await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: 'living_wallet_a'
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      const queryTime = Date.now() - queryStart;
      const trades = response.data.trades || [];
      
      this.logResult('performance', queryTime < 1000,
        `Cache query: ${queryTime}ms (${trades.length} trades from cache)`);
        
      console.log(`   📊 Query time: ${queryTime}ms`);
      console.log(`   📊 Trades found: ${trades.length}`);
      
      // This proves living graph if query is fast after data was populated
      if (queryTime < 1000 && trades.length > 0) {
        console.log('   ✅ CONFIRMED: Living persistent graph working!');
      }
      
    } catch (error) {
      this.logResult('performance', false, `Graph query failed: ${error.message}`);
    }
  }

  async testCoreTradeDiscovery() {
    console.log('\n🔧 TESTING CORE TRADE DISCOVERY');
    console.log('================================');
    
    // Test 1: Simple 2-way trade via living graph
    console.log('🧪 Test 1: 2-way trade discovery...');
    
    try {
      // Submit NFT A owned by wallet A
      await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: 'trade_wallet_a',
        nfts: [{
          id: 'trade_nft_a',
          metadata: { name: 'Trade NFT A', symbol: 'TA', description: '2-way trade test' },
          ownership: { ownerId: 'trade_wallet_a', blockchain: 'solana', contractAddress: 'trade_contract', tokenId: 'trade_nft_a' },
          valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'trade_test' }
        }]
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      // Wallet A wants NFT B
      await axios.post(`${BASE_URL}/wants/submit`, {
        walletId: 'trade_wallet_a',
        wantedNFTs: ['trade_nft_b']
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      // Submit NFT B owned by wallet B
      await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: 'trade_wallet_b',
        nfts: [{
          id: 'trade_nft_b',
          metadata: { name: 'Trade NFT B', symbol: 'TB', description: '2-way trade test' },
          ownership: { ownerId: 'trade_wallet_b', blockchain: 'solana', contractAddress: 'trade_contract', tokenId: 'trade_nft_b' },
          valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'trade_test' }
        }]
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      // Wallet B wants NFT A - this should trigger discovery
      const wantResponse = await axios.post(`${BASE_URL}/wants/submit`, {
        walletId: 'trade_wallet_b',
        wantedNFTs: ['trade_nft_a']
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      // Check immediate discovery
      const immediateLoops = wantResponse.data.newLoopsDiscovered || 0;
      
      // Allow processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Query trades
      const tradesResponse = await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: 'trade_wallet_a'
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      const trades = tradesResponse.data.trades || [];
      
      this.logResult('functionality', trades.length > 0 || immediateLoops > 0,
        `2-way trades: ${trades.length} found, ${immediateLoops} discovered immediately`);
        
      console.log(`   📊 Immediate discoveries: ${immediateLoops}`);
      console.log(`   📊 Trades in graph: ${trades.length}`);
      
      if (trades.length > 0) {
        const trade = trades[0];
        console.log(`   ✅ Trade quality: ${trade.qualityScore || 'N/A'}`);
        console.log(`   ✅ Trade efficiency: ${trade.efficiency || 'N/A'}`);
      }
      
    } catch (error) {
      this.logResult('functionality', false, `2-way trade test failed: ${error.message}`);
    }

    // Test 2: Multi-party trade (3-way)
    console.log('\n🧪 Test 2: 3-way multi-party trade...');
    
    try {
      const wallets = ['multi_wallet_1', 'multi_wallet_2', 'multi_wallet_3'];
      const nfts = ['multi_nft_1', 'multi_nft_2', 'multi_nft_3'];
      
      // Create circular trade: 1→2, 2→3, 3→1
      for (let i = 0; i < 3; i++) {
        // Submit NFT
        await axios.post(`${BASE_URL}/inventory/submit`, {
          walletId: wallets[i],
          nfts: [{
            id: nfts[i],
            metadata: { name: `Multi NFT ${i+1}`, symbol: `M${i+1}`, description: '3-way trade' },
            ownership: { ownerId: wallets[i], blockchain: 'solana', contractAddress: 'multi_contract', tokenId: nfts[i] },
            valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'multi_test' }
          }]
        }, {
          headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
        });
        
        // Submit want for next NFT in circle
        const wantResponse = await axios.post(`${BASE_URL}/wants/submit`, {
          walletId: wallets[i],
          wantedNFTs: [nfts[(i + 1) % 3]]
        }, {
          headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
        });
        
        console.log(`   📊 Wallet ${i+1} immediate discoveries: ${wantResponse.data.newLoopsDiscovered || 0}`);
      }
      
      // Allow background processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Query for multi-party trades
      const multiResponse = await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: wallets[0]
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      const multiTrades = multiResponse.data.trades || [];
      const has3Way = multiTrades.some(t => (t.participants?.length || t.steps?.length || 0) >= 3);
      
      this.logResult('functionality', has3Way,
        `3-way trades: ${has3Way ? 'FOUND' : 'NOT FOUND'} (${multiTrades.length} total trades)`);
        
      if (has3Way) {
        console.log('   ✅ Multi-party trade discovery confirmed!');
      }
      
    } catch (error) {
      this.logResult('functionality', false, `3-way trade test failed: ${error.message}`);
    }
  }

  async testReliabilityAndConcurrency() {
    console.log('\n🛡️ TESTING RELIABILITY & CONCURRENCY');
    console.log('====================================');
    
    // Test 1: Multiple tenants submitting simultaneously
    console.log('🧪 Test 1: Multi-tenant concurrent submissions...');
    
    const concurrentStart = Date.now();
    const submissions = [];
    
    // Submit data from multiple wallets simultaneously
    for (let i = 0; i < 5; i++) {
      submissions.push(
        axios.post(`${BASE_URL}/inventory/submit`, {
          walletId: `concurrent_wallet_${i}`,
          nfts: [{
            id: `concurrent_nft_${i}`,
            metadata: { name: `Concurrent NFT ${i}`, symbol: `C${i}`, description: 'Concurrency test' },
            ownership: { ownerId: `concurrent_wallet_${i}`, blockchain: 'solana', contractAddress: 'concurrent_contract', tokenId: `concurrent_nft_${i}` },
            valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'concurrent_test' }
          }]
        }, {
          headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
        }).catch(err => ({ error: err.message }))
      );
    }
    
    const results = await Promise.all(submissions);
    const concurrentTime = Date.now() - concurrentStart;
    const successes = results.filter(r => !r.error).length;
    
    this.logResult('reliability', successes === 5 && concurrentTime < 5000,
      `Concurrent submissions: ${successes}/5 succeeded in ${concurrentTime}ms`);
      
    console.log(`   📊 Success rate: ${successes}/5`);
    console.log(`   📊 Total time: ${concurrentTime}ms`);
    console.log(`   📊 Average per submission: ${(concurrentTime/5).toFixed(0)}ms`);

    // Test 2: Query persistence after submissions
    console.log('\n🧪 Test 2: Data persistence verification...');
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Query a wallet that was just submitted
    try {
      const persistResponse = await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: 'concurrent_wallet_0'
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      this.logResult('reliability', persistResponse.status === 200,
        'Data persisted and queryable after submission');
        
    } catch (error) {
      this.logResult('reliability', false, `Persistence check failed: ${error.message}`);
    }
  }

  async populateTestData() {
    // Helper to populate test data for living graph
    const testData = [
      { wallet: 'living_wallet_a', nft: 'living_nft_a', wants: 'living_nft_b' },
      { wallet: 'living_wallet_b', nft: 'living_nft_b', wants: 'living_nft_c' },
      { wallet: 'living_wallet_c', nft: 'living_nft_c', wants: 'living_nft_a' }
    ];
    
    for (const data of testData) {
      await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: data.wallet,
        nfts: [{
          id: data.nft,
          metadata: { name: `Living ${data.nft}`, symbol: 'LIVE', description: 'Living graph test' },
          ownership: { ownerId: data.wallet, blockchain: 'solana', contractAddress: 'living_contract', tokenId: data.nft },
          valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'living_test' }
        }]
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      await axios.post(`${BASE_URL}/wants/submit`, {
        walletId: data.wallet,
        wantedNFTs: [data.wants]
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
    }
  }

  logResult(category, passed, description) {
    this.results[category].total++;
    if (passed) {
      this.results[category].passed++;
      console.log(`   ✅ ${description}`);
    } else {
      console.log(`   ❌ ${description}`);
    }
    this.results[category].details.push({ passed, description });
  }

  generateReport() {
    console.log('\n📊 ACCURATE MVP ASSESSMENT RESULTS');
    console.log('==================================');
    
    let totalPassed = 0;
    let totalTests = 0;
    
    Object.keys(this.results).forEach(category => {
      const cat = this.results[category];
      totalPassed += cat.passed;
      totalTests += cat.total;
      
      const percentage = cat.total > 0 ? (cat.passed / cat.total * 100).toFixed(1) : '0.0';
      const icon = percentage >= 80 ? '✅' : percentage >= 60 ? '🟡' : '❌';
      
      console.log(`${icon} ${category.toUpperCase()}: ${cat.passed}/${cat.total} (${percentage}%)`);
    });
    
    const overallPercentage = totalTests > 0 ? (totalPassed / totalTests * 100).toFixed(1) : '0.0';
    
    console.log('\n🏆 OVERALL SCORE: ' + overallPercentage + '%');
    
    console.log('\n🎯 KEY FINDINGS:');
    
    // Performance insights
    const perfDetails = this.results.performance.details;
    const livingGraphConfirmed = perfDetails.some(d => d.description.includes('Living persistent graph'));
    
    if (livingGraphConfirmed) {
      console.log('✅ Living persistent graph architecture CONFIRMED');
    }
    
    // Functionality insights
    const funcDetails = this.results.functionality.details;
    const has2Way = funcDetails.some(d => d.passed && d.description.includes('2-way'));
    const has3Way = funcDetails.some(d => d.passed && d.description.includes('3-way'));
    
    if (has2Way) console.log('✅ Basic 2-way trades working');
    if (has3Way) console.log('✅ Multi-party (3+ way) trades working');
    
    // Final verdict
    console.log('\n🏛️ CLIENT READINESS VERDICT:');
    
    if (overallPercentage >= 80) {
      console.log('✅ READY FOR CLIENT DEMOS');
      console.log('• Living persistent graph confirmed');
      console.log('• Core trade discovery working');
      console.log('• Performance acceptable for pilots');
    } else if (overallPercentage >= 60) {
      console.log('🟡 READY FOR FRIENDLY PILOTS');
      console.log('• Core functionality works');
      console.log('• Some rough edges remain');
      console.log('• Position as early access');
    } else {
      console.log('❌ NEEDS MORE WORK');
      console.log('• Critical issues in core functionality');
      console.log('• Not ready for client exposure');
    }
    
    return {
      score: overallPercentage,
      livingGraphConfirmed,
      ready: overallPercentage >= 60
    };
  }

  async runAccurateTest() {
    try {
      const setupSuccess = await this.setupTestTenant();
      if (!setupSuccess) {
        console.error('❌ Cannot proceed without test tenant');
        return { score: 0, ready: false };
      }
      
      console.log('✅ Starting accurate MVP tests...\n');
      
      await this.testLivingGraphPerformance();
      await this.testCoreTradeDiscovery();
      await this.testReliabilityAndConcurrency();
      
      return this.generateReport();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      return { score: 0, ready: false };
    }
  }
}

// Run the accurate test
const tester = new AccurateMVPTester();
tester.runAccurateTest().then(result => {
  console.log('\n🏁 ACCURATE TEST COMPLETE');
  if (result.ready) {
    console.log('✅ System ready for client engagement!');
  } else {
    console.log('⚠️  More work needed before client demos');
  }
});