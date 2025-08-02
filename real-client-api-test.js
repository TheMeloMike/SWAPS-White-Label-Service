#!/usr/bin/env node

/**
 * 🎯 REAL CLIENT API TEST
 * 
 * Testing EXACTLY how a real client would use the API:
 * - No special setup
 * - Default behavior only
 * - Standard API calls as documented
 * - Verify living graph is the DEFAULT, not optional
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'https://swaps-93hu.onrender.com/api/v1';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'swaps_admin_prod_2025_secure_key_abc123';

console.log('🎯 REAL CLIENT API TEST - DEFAULT BEHAVIOR');
console.log('==========================================');
console.log('Testing exactly as a client would use it...');
console.log('NO special configuration or setup');
console.log('');

class RealClientTest {
  constructor() {
    this.testResults = {
      defaultBehavior: [],
      issues: [],
      successes: []
    };
  }

  async simulateRealClient() {
    console.log('👤 SIMULATING REAL CLIENT EXPERIENCE');
    console.log('====================================');
    
    // Step 1: Client creates account (gets API key)
    console.log('\n📝 Step 1: Client signs up for API access...');
    
    let apiKey;
    let tenantId;
    
    try {
      const tenantResponse = await axios.post(`${BASE_URL}/admin/tenants`, {
        name: 'Real Client Corp',
        contactEmail: 'client@realcorp.com',
        settings: {
          algorithm: { maxDepth: 15, minEfficiency: 0.3, maxLoopsPerRequest: 50 },
          security: { maxNFTsPerWallet: 1000, maxWantsPerWallet: 100 }
        }
      }, {
        headers: { 'Authorization': `Bearer ${ADMIN_API_KEY}`, 'Content-Type': 'application/json' }
      });

      tenantId = tenantResponse.data.tenant.id;
      apiKey = tenantResponse.data.tenant.apiKey || tenantResponse.data.apiKey;
      
      console.log(`   ✅ API Key received: ${apiKey.substring(0, 20)}...`);
      console.log(`   ✅ Tenant ID: ${tenantId}`);
      
      this.testResults.successes.push('Client onboarding smooth');
      
    } catch (error) {
      console.log(`   ❌ Failed to create account: ${error.message}`);
      this.testResults.issues.push('Client onboarding failed');
      return;
    }

    // Step 2: Client submits their first NFT
    console.log('\n📦 Step 2: Client submits their first NFT...');
    
    const submitTime = Date.now();
    let submitResponse;
    
    try {
      submitResponse = await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: 'client_wallet_1',
        nfts: [{
          id: 'client_nft_001',
          metadata: {
            name: 'My Valuable NFT',
            symbol: 'MVN',
            description: 'A valuable NFT I want to trade'
          },
          ownership: {
            ownerId: 'client_wallet_1',
            blockchain: 'solana',
            contractAddress: 'client_contract_1',
            tokenId: 'client_nft_001'
          },
          valuation: {
            estimatedValue: 100.0,
            currency: 'SOL',
            lastUpdated: new Date().toISOString(),
            source: 'client_valuation'
          }
        }]
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });
      
      const responseTime = Date.now() - submitTime;
      
      console.log(`   📊 Response time: ${responseTime}ms`);
      console.log(`   📊 Response: ${JSON.stringify(submitResponse.data)}`);
      
      // Check if background processing happened
      if (submitResponse.data.newLoopsDiscovered !== undefined) {
        console.log(`   ℹ️  Loops discovered: ${submitResponse.data.newLoopsDiscovered}`);
        this.testResults.defaultBehavior.push('Background discovery on NFT submit');
      } else {
        console.log(`   ⚠️  No loop discovery info in response`);
        this.testResults.issues.push('No background discovery feedback');
      }
      
    } catch (error) {
      console.log(`   ❌ NFT submission failed: ${error.message}`);
      this.testResults.issues.push('NFT submission failed');
      return;
    }

    // Step 3: Client immediately queries for trades (testing if data is in living graph)
    console.log('\n🔍 Step 3: Client immediately queries for trades...');
    
    const queryTime = Date.now();
    
    try {
      const tradesResponse = await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: 'client_wallet_1'
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });
      
      const queryResponseTime = Date.now() - queryTime;
      
      console.log(`   📊 Query response time: ${queryResponseTime}ms`);
      console.log(`   📊 Trades found: ${tradesResponse.data.trades?.length || 0}`);
      
      if (queryResponseTime < 1000) {
        console.log(`   ✅ Fast query suggests living graph (cache) is working`);
        this.testResults.defaultBehavior.push('Fast queries from living graph');
      } else {
        console.log(`   ⚠️  Slow query suggests computation on demand`);
        this.testResults.issues.push('Slow queries - not using cache?');
      }
      
    } catch (error) {
      console.log(`   ❌ Trade query failed: ${error.message}`);
      this.testResults.issues.push('Trade query failed');
    }

    // Step 4: Client adds a want (should trigger discovery)
    console.log('\n💭 Step 4: Client specifies what they want...');
    
    try {
      const wantResponse = await axios.post(`${BASE_URL}/wants/submit`, {
        walletId: 'client_wallet_1',
        wantedNFTs: ['desired_nft_xyz']
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });
      
      console.log(`   📊 Want submission response: ${JSON.stringify(wantResponse.data)}`);
      
      if (wantResponse.data.newLoopsDiscovered !== undefined) {
        console.log(`   ✅ Background discovery triggered: ${wantResponse.data.newLoopsDiscovered} loops`);
        this.testResults.defaultBehavior.push('Background discovery on want submit');
      } else {
        console.log(`   ⚠️  No discovery feedback on want submission`);
        this.testResults.issues.push('No discovery feedback on wants');
      }
      
    } catch (error) {
      console.log(`   ❌ Want submission failed: ${error.message}`);
      this.testResults.issues.push('Want submission failed');
    }

    // Step 5: Test real trade scenario
    console.log('\n🔄 Step 5: Testing real trade discovery...');
    
    try {
      // Create a trading partner
      await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: 'partner_wallet',
        nfts: [{
          id: 'partner_nft_001',
          metadata: {
            name: 'Partner NFT',
            symbol: 'PNF',
            description: 'NFT owned by trading partner'
          },
          ownership: {
            ownerId: 'partner_wallet',
            blockchain: 'solana',
            contractAddress: 'partner_contract',
            tokenId: 'partner_nft_001'
          },
          valuation: {
            estimatedValue: 100.0,
            currency: 'SOL',
            lastUpdated: new Date().toISOString(),
            source: 'partner_valuation'
          }
        }]
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });
      
      // Partner wants client's NFT
      await axios.post(`${BASE_URL}/wants/submit`, {
        walletId: 'partner_wallet',
        wantedNFTs: ['client_nft_001']
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });
      
      // Client wants partner's NFT (should create a match)
      const matchResponse = await axios.post(`${BASE_URL}/wants/submit`, {
        walletId: 'client_wallet_1',
        wantedNFTs: ['partner_nft_001']
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });
      
      console.log(`   📊 Match attempt response: ${JSON.stringify(matchResponse.data)}`);
      
      // Small delay to allow processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if trade was discovered
      const finalCheck = await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: 'client_wallet_1'
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });
      
      const trades = finalCheck.data.trades || [];
      
      if (trades.length > 0) {
        console.log(`   ✅ Trade discovered! ${trades.length} trade(s) found`);
        console.log(`   📊 Trade details:`, JSON.stringify(trades[0], null, 2));
        this.testResults.successes.push('Trade discovery working by default');
      } else {
        console.log(`   ❌ No trades found despite perfect match`);
        this.testResults.issues.push('Trade discovery not working by default');
      }
      
    } catch (error) {
      console.log(`   ❌ Trade scenario failed: ${error.message}`);
      this.testResults.issues.push(`Trade test error: ${error.message}`);
    }

    // Step 6: Test if background service is running
    console.log('\n🔧 Step 6: Checking if background services are active...');
    
    try {
      // Submit data and immediately check - if fast, it's cached/persistent
      const testStart = Date.now();
      
      await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: 'background_test',
        nfts: [{
          id: 'background_nft',
          metadata: { name: 'Background Test', symbol: 'BGT', description: 'Testing background' },
          ownership: { ownerId: 'background_test', blockchain: 'solana', contractAddress: 'bg_contract', tokenId: 'background_nft' },
          valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'bg_test' }
        }]
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });
      
      // Immediate query
      const bgQueryResponse = await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: 'background_test'
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });
      
      const totalTime = Date.now() - testStart;
      
      console.log(`   📊 Submit + immediate query time: ${totalTime}ms`);
      
      if (totalTime < 2000) {
        console.log(`   ✅ Fast processing indicates background service active`);
        this.testResults.defaultBehavior.push('Background processing active by default');
      } else {
        console.log(`   ⚠️  Slow processing - background service may not be active`);
        this.testResults.issues.push('Background processing seems inactive');
      }
      
    } catch (error) {
      console.log(`   ❌ Background service check failed: ${error.message}`);
    }
  }

  generateReport() {
    console.log('\n📊 REAL CLIENT EXPERIENCE REPORT');
    console.log('================================');
    
    console.log('\n✅ SUCCESSES:');
    if (this.testResults.successes.length > 0) {
      this.testResults.successes.forEach(s => console.log(`   • ${s}`));
    } else {
      console.log('   • None recorded');
    }
    
    console.log('\n📋 DEFAULT BEHAVIORS OBSERVED:');
    if (this.testResults.defaultBehavior.length > 0) {
      this.testResults.defaultBehavior.forEach(b => console.log(`   • ${b}`));
    } else {
      console.log('   • No living graph behaviors observed by default');
    }
    
    console.log('\n❌ ISSUES FOUND:');
    if (this.testResults.issues.length > 0) {
      this.testResults.issues.forEach(i => console.log(`   • ${i}`));
    } else {
      console.log('   • No issues found');
    }
    
    // Final verdict
    const hasLivingGraph = this.testResults.defaultBehavior.some(b => 
      b.includes('Background') || b.includes('Fast queries') || b.includes('living graph')
    );
    
    const successRate = this.testResults.successes.length / 
      (this.testResults.successes.length + this.testResults.issues.length);
    
    console.log('\n🎯 VERDICT: DEFAULT API BEHAVIOR');
    console.log('================================');
    
    if (hasLivingGraph && successRate > 0.7) {
      console.log('✅ LIVING GRAPH IS THE DEFAULT!');
      console.log('• Background processing happens automatically');
      console.log('• Fast cached queries work out of the box');
      console.log('• Clients get optimal experience by default');
    } else if (hasLivingGraph) {
      console.log('🟡 LIVING GRAPH PARTIALLY WORKING BY DEFAULT');
      console.log('• Some features work automatically');
      console.log('• But issues prevent full functionality');
      console.log('• Clients may have mixed experience');
    } else {
      console.log('❌ LIVING GRAPH NOT DEFAULT BEHAVIOR');
      console.log('• System appears to use computation on demand');
      console.log('• Background processing not automatic');
      console.log('• Clients will experience slow performance');
    }
    
    console.log('\n🔧 RECOMMENDATIONS:');
    if (!hasLivingGraph) {
      console.log('1. Ensure BackgroundTradeDiscoveryService starts by default');
      console.log('2. Verify living graph is enabled in production config');
      console.log('3. Check that event handlers trigger on data submission');
    } else if (this.testResults.issues.length > 0) {
      console.log('1. Fix the identified issues for consistent experience');
      console.log('2. Ensure all API responses include discovery feedback');
      console.log('3. Test with multiple concurrent clients');
    } else {
      console.log('1. System working well - document the default behavior');
      console.log('2. Create client onboarding guide');
      console.log('3. Monitor performance in production');
    }
    
    return {
      hasLivingGraph,
      successRate,
      ready: hasLivingGraph && successRate > 0.7
    };
  }

  async runTest() {
    try {
      await this.simulateRealClient();
      return this.generateReport();
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      return { hasLivingGraph: false, successRate: 0, ready: false };
    }
  }
}

// Run the real client test
console.log('🚀 Starting real client API test...\n');
const tester = new RealClientTest();
tester.runTest().then(result => {
  console.log('\n🏁 TEST COMPLETE');
  if (result.ready) {
    console.log('✅ API provides optimal experience by default!');
  } else {
    console.log('⚠️  Default behavior needs improvement');
  }
});