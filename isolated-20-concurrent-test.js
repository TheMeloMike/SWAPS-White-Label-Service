#!/usr/bin/env node

/**
 * 🔍 ISOLATED 20 CONCURRENT TEST
 * 
 * Testing ONLY the 20 concurrent capability in isolation
 * to confirm it still works when the system is fresh
 */

const axios = require('axios');

const BASE_URL = 'https://swaps-93hu.onrender.com/api/v1';
const ADMIN_API_KEY = 'swaps_admin_prod_2025_secure_key_abc123';

async function isolatedConcurrentTest() {
  console.log('🔍 ISOLATED 20 CONCURRENT REQUEST TEST');
  console.log('=====================================');
  console.log('Testing on fresh system state...\n');

  try {
    // Step 1: Check server health first
    console.log('1️⃣ CHECKING SERVER HEALTH');
    const healthCheck = await axios.get('https://swaps-93hu.onrender.com/health');
    console.log(`✅ Server healthy: ${healthCheck.status}`);
    console.log(`📊 Uptime: ${healthCheck.data.uptimeSeconds}s`);
    console.log(`📊 Memory: ${healthCheck.data.memory?.heapUsed}\n`);

    // Step 2: Create single tenant
    console.log('2️⃣ CREATING SINGLE TENANT');
    const tenant = await axios.post(`${BASE_URL}/admin/tenants`, {
      name: 'Isolated Concurrent Test',
      contactEmail: 'isolated@test.com'
    }, {
      headers: { 'Authorization': `Bearer ${ADMIN_API_KEY}` }
    });
    
    const apiKey = tenant.data.tenant.apiKey;
    console.log(`✅ Tenant created successfully\n`);

    // Step 3: Wait for stabilization
    console.log('3️⃣ WAITING FOR SYSTEM STABILIZATION');
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log(`✅ System stabilized\n`);

    // Step 4: Test 20 concurrent (exactly like our successful test)
    console.log('4️⃣ TESTING 20 CONCURRENT REQUESTS');
    console.log('Using exact same methodology as successful test...');
    
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(
        axios.post(`${BASE_URL}/inventory/submit`, {
          walletId: `concurrent_wallet_${i}`,
          nfts: [{
            id: `concurrent_nft_${i}`,
            metadata: { name: `Concurrent NFT ${i}`, symbol: 'CONC' },
            ownership: { ownerId: `concurrent_wallet_${i}`, blockchain: 'solana', contractAddress: 'conc_contract', tokenId: `concurrent_nft_${i}` },
            valuation: { estimatedValue: 10, currency: 'SOL' }
          }]
        }, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
          timeout: 30000
        })
      );
    }
    
    const startTime = Date.now();
    const results = await Promise.allSettled(promises);
    const duration = Date.now() - startTime;
    
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureReasons = results
      .filter(r => r.status === 'rejected')
      .map(r => r.reason?.response?.status || r.reason?.code || 'unknown');
    
    console.log(`📊 Results: ${successCount}/20 succeeded in ${duration}ms`);
    console.log(`📊 Success Rate: ${Math.round((successCount/20) * 100)}%`);
    console.log(`📊 Average per request: ${Math.round(duration/20)}ms`);
    
    if (failureReasons.length > 0) {
      console.log(`📊 Failure Types: ${[...new Set(failureReasons)].join(', ')}`);
    }
    
    // Step 5: Check server health after test
    console.log('\n5️⃣ CHECKING SERVER HEALTH AFTER TEST');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const postTestHealth = await axios.get('https://swaps-93hu.onrender.com/health');
    console.log(`✅ Server health: ${postTestHealth.status}`);
    console.log(`📊 Memory after: ${postTestHealth.data.memory?.heapUsed}`);

    // Analysis
    console.log('\n📊 ANALYSIS');
    console.log('===========');
    
    if (successCount === 20) {
      console.log('🎉 20 CONCURRENT REQUESTS STILL WORK!');
      console.log('✅ The capability exists when system is fresh');
      console.log('✅ Previous audit failed due to compound testing stress');
    } else if (successCount >= 15) {
      console.log('🟡 PARTIAL SUCCESS');
      console.log(`✅ ${successCount}/20 succeeded`);
      console.log('⚠️ Some degradation from fresh vs compound testing');
    } else {
      console.log('❌ SIGNIFICANT DEGRADATION');
      console.log('🔍 Server state or other factors affecting performance');
    }

  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
  }

  console.log('\n🏁 ISOLATED TEST COMPLETE');
}

// Run the test
isolatedConcurrentTest()
  .then(() => {
    console.log('\n✅ Analysis complete!');
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error.message);
  });