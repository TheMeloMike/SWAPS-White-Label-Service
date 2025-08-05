#!/usr/bin/env node

/**
 * 🔍 CONTROLLED CAPABILITY TESTING
 * 
 * Systematic testing to identify exact server capabilities and limits
 */

const axios = require('axios');

const BASE_URL = 'https://swaps-93hu.onrender.com/api/v1';
const ADMIN_API_KEY = 'swaps_admin_prod_2025_secure_key_abc123';

async function testCapabilities() {
  console.log('🔍 CONTROLLED CAPABILITY TESTING');
  console.log('================================');
  console.log('Testing exact server limits and capabilities...\n');

  let testTenant;
  
  try {
    // Step 1: Basic functionality test
    console.log('1️⃣ BASIC FUNCTIONALITY TEST');
    console.log('----------------------------');
    
    const start = Date.now();
    const response = await axios.get('https://swaps-93hu.onrender.com/health');
    const duration = Date.now() - start;
    
    console.log(`✅ Health Check: ${response.status} (${duration}ms)`);
    console.log(`📊 Memory: ${response.data.memory?.heapUsed || 'N/A'}`);
    console.log(`📊 Uptime: ${response.data.uptimeSeconds || 'N/A'}s`);
    
    // Step 2: Single tenant creation
    console.log('\n2️⃣ TENANT CREATION TEST');
    console.log('------------------------');
    
    const tenantStart = Date.now();
    testTenant = await axios.post(`${BASE_URL}/admin/tenants`, {
      name: 'Capability Test',
      contactEmail: 'capability@test.com'
    }, {
      headers: { 'Authorization': `Bearer ${ADMIN_API_KEY}` }
    });
    const tenantDuration = Date.now() - tenantStart;
    
    console.log(`✅ Tenant Created: ${testTenant.status} (${tenantDuration}ms)`);
    
    const apiKey = testTenant.data.tenant.apiKey;
    
    // Step 3: Single NFT submission
    console.log('\n3️⃣ SINGLE NFT SUBMISSION TEST');
    console.log('------------------------------');
    
    const nftStart = Date.now();
    const nftResponse = await axios.post(`${BASE_URL}/inventory/submit`, {
      walletId: 'test_wallet',
      nfts: [{
        id: 'test_nft_1',
        metadata: { name: 'Test NFT', symbol: 'TEST' },
        ownership: { ownerId: 'test_wallet', blockchain: 'solana', contractAddress: 'test_contract', tokenId: 'test_nft_1' },
        valuation: { estimatedValue: 10, currency: 'SOL' }
      }]
    }, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const nftDuration = Date.now() - nftStart;
    
    console.log(`✅ NFT Submitted: ${nftResponse.status} (${nftDuration}ms)`);
    
  } catch (error) {
    console.log(`❌ Basic functionality failed: ${error.message}`);
    return;
  }

  // Step 4: Incremental concurrent testing
  console.log('\n4️⃣ INCREMENTAL CONCURRENT TESTING');
  console.log('-----------------------------------');
  
  const concurrentLevels = [2, 5, 10, 15, 20];
  const apiKey = testTenant.data.tenant.apiKey;
  
  for (const level of concurrentLevels) {
    try {
      console.log(`\n🔍 Testing ${level} concurrent requests...`);
      
      const promises = [];
      for (let i = 0; i < level; i++) {
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
      
      console.log(`   📊 Results: ${successCount}/${level} succeeded in ${duration}ms`);
      console.log(`   📊 Success Rate: ${Math.round((successCount/level) * 100)}%`);
      
      if (failureReasons.length > 0) {
        console.log(`   📊 Failure Types: ${[...new Set(failureReasons)].join(', ')}`);
      }
      
      if (successCount === level) {
        console.log(`   ✅ ${level} concurrent requests: PASS`);
      } else if (successCount >= level * 0.8) {
        console.log(`   ⚠️ ${level} concurrent requests: PARTIAL (${Math.round((successCount/level) * 100)}%)`);
      } else {
        console.log(`   ❌ ${level} concurrent requests: FAIL (${Math.round((successCount/level) * 100)}%)`);
        break; // Stop testing higher levels if this fails badly
      }
      
      // Wait between tests to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`   ❌ ${level} concurrent requests failed: ${error.message}`);
      break;
    }
  }

  // Step 5: Incremental payload size testing
  console.log('\n5️⃣ INCREMENTAL PAYLOAD SIZE TESTING');
  console.log('------------------------------------');
  
  const payloadSizes = [1, 5, 10, 25, 50, 100];
  
  for (const size of payloadSizes) {
    try {
      console.log(`\n🔍 Testing ${size} NFTs payload...`);
      
      const nfts = [];
      for (let i = 0; i < size; i++) {
        nfts.push({
          id: `payload_nft_${i}`,
          metadata: { 
            name: `Payload NFT ${i}`, 
            symbol: 'PAYLOAD',
            description: 'Standard description for testing'
          },
          ownership: { ownerId: 'payload_wallet', blockchain: 'solana', contractAddress: 'payload_contract', tokenId: `payload_nft_${i}` },
          valuation: { estimatedValue: Math.random() * 100, currency: 'SOL' }
        });
      }
      
      const startTime = Date.now();
      const response = await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: 'payload_wallet',
        nfts: nfts
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        timeout: 60000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      const duration = Date.now() - startTime;
      
      console.log(`   📊 Status: ${response.status} (${duration}ms)`);
      console.log(`   📊 NFTs Processed: ${response.data.nftsProcessed || 'unknown'}`);
      
      if (response.status === 200 && response.data.success) {
        console.log(`   ✅ ${size} NFTs payload: PASS`);
      } else {
        console.log(`   ⚠️ ${size} NFTs payload: PARTIAL`);
      }
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(`   ❌ ${size} NFTs payload failed: ${error.message}`);
      console.log(`   📊 Error Type: ${error.response?.status || error.code || 'unknown'}`);
      break; // Stop testing larger payloads if this fails
    }
  }

  // Step 6: Server recovery test
  console.log('\n6️⃣ SERVER RECOVERY TEST');
  console.log('------------------------');
  
  try {
    console.log('Waiting 5 seconds for server to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const recoveryStart = Date.now();
    const healthCheck = await axios.get('https://swaps-93hu.onrender.com/health');
    const recoveryDuration = Date.now() - recoveryStart;
    
    console.log(`✅ Server Recovery: ${healthCheck.status} (${recoveryDuration}ms)`);
    console.log(`📊 Memory After Tests: ${healthCheck.data.memory?.heapUsed || 'N/A'}`);
    
  } catch (error) {
    console.log(`❌ Server recovery failed: ${error.message}`);
  }

  console.log('\n🏁 CAPABILITY TESTING COMPLETE');
  console.log('===============================');
}

// Run the capability test
testCapabilities()
  .then(() => {
    console.log('\n✅ Capability analysis complete!');
  })
  .catch(error => {
    console.error('\n❌ Capability test failed:', error.message);
  });