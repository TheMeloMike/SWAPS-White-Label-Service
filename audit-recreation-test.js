#!/usr/bin/env node

/**
 * 🔍 AUDIT RECREATION TEST
 * 
 * Recreating the exact conditions that caused the audit to fail
 * to prove it was timing/methodology, not server capability
 */

const axios = require('axios');

const BASE_URL = 'https://swaps-93hu.onrender.com/api/v1';
const ADMIN_API_KEY = 'swaps_admin_prod_2025_secure_key_abc123';

async function recreateAuditConditions() {
  console.log('🔍 AUDIT RECREATION TEST');
  console.log('========================');
  console.log('Recreating the exact audit conditions that failed...\n');

  try {
    // Recreate the exact sequence from the audit that failed
    console.log('1️⃣ RECREATING AUDIT SEQUENCE');
    console.log('-----------------------------');
    
    // Multiple rapid tenant creations (like the audit does)
    console.log('Creating multiple tenants rapidly...');
    
    const tenantPromises = [];
    for (let i = 0; i < 5; i++) {
      tenantPromises.push(
        axios.post(`${BASE_URL}/admin/tenants`, {
          name: `Audit Recreation Test ${i}`,
          contactEmail: `audit${i}@test.com`
        }, {
          headers: { 'Authorization': `Bearer ${ADMIN_API_KEY}` }
        })
      );
    }
    
    const tenantResults = await Promise.allSettled(tenantPromises);
    const successfulTenants = tenantResults.filter(r => r.status === 'fulfilled');
    
    console.log(`📊 Tenant Creation: ${successfulTenants.length}/5 succeeded`);
    
    if (successfulTenants.length === 0) {
      throw new Error('Failed to create any tenants');
    }
    
    const apiKey = successfulTenants[0].value.data.tenant.apiKey;

    // Immediate concurrent load (like audit does)
    console.log('\n2️⃣ IMMEDIATE CONCURRENT LOAD (AUDIT STYLE)');
    console.log('-------------------------------------------');
    
    const concurrentPromises = [];
    for (let i = 0; i < 20; i++) {
      concurrentPromises.push(
        axios.post(`${BASE_URL}/inventory/submit`, {
          walletId: `audit_wallet_${i}`,
          nfts: [{
            id: `audit_nft_${i}`,
            metadata: { name: `Audit NFT ${i}`, symbol: 'AUDIT' },
            ownership: { ownerId: `audit_wallet_${i}`, blockchain: 'solana', contractAddress: 'audit_contract', tokenId: `audit_nft_${i}` },
            valuation: { estimatedValue: 10, currency: 'SOL' }
          }]
        }, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
          timeout: 10000 // Same timeout as audit
        })
      );
    }
    
    const startTime = Date.now();
    const results = await Promise.allSettled(concurrentPromises);
    const duration = Date.now() - startTime;
    
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    
    console.log(`📊 Concurrent Load Results: ${successCount}/20 in ${duration}ms`);
    console.log(`📊 Success Rate: ${Math.round((successCount/20) * 100)}%`);

    // Immediate large payload (like audit does)
    console.log('\n3️⃣ IMMEDIATE LARGE PAYLOAD (AUDIT STYLE)');
    console.log('-----------------------------------------');
    
    const largeNFTArray = [];
    for (let i = 0; i < 100; i++) {
      largeNFTArray.push({
        id: `audit_large_nft_${i}`,
        metadata: { 
          name: `Audit Large NFT ${i}`, 
          symbol: 'AUDITLG',
          description: 'A'.repeat(500) // Same large description as audit
        },
        ownership: { ownerId: 'audit_large_wallet', blockchain: 'solana', contractAddress: 'audit_large_contract', tokenId: `audit_large_nft_${i}` },
        valuation: { estimatedValue: Math.random() * 1000, currency: 'SOL' }
      });
    }
    
    const largeStart = Date.now();
    const largeResponse = await axios.post(`${BASE_URL}/inventory/submit`, {
      walletId: 'audit_large_wallet',
      nfts: largeNFTArray
    }, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 30000
    });
    const largeDuration = Date.now() - largeStart;
    
    console.log(`📊 Large Payload: ${largeResponse.status} in ${largeDuration}ms`);
    console.log(`📊 NFTs Processed: ${largeResponse.data.nftsProcessed || 'unknown'}`);

    // Test health check during/after stress (when audit fails)
    console.log('\n4️⃣ HEALTH CHECK DURING STRESS');
    console.log('------------------------------');
    
    const healthPromises = [];
    for (let i = 0; i < 5; i++) {
      healthPromises.push(
        axios.get('https://swaps-93hu.onrender.com/health', { timeout: 10000 })
      );
    }
    
    const healthResults = await Promise.allSettled(healthPromises);
    const healthSuccesses = healthResults.filter(r => r.status === 'fulfilled').length;
    
    console.log(`📊 Health Checks: ${healthSuccesses}/5 succeeded`);
    
    if (healthSuccesses === 5) {
      console.log('✅ Health endpoints working during stress');
    } else {
      console.log('⚠️ Some health checks failed during stress');
      healthResults.forEach((result, i) => {
        if (result.status === 'rejected') {
          console.log(`   ❌ Health check ${i+1}: ${result.reason.message}`);
        }
      });
    }

    console.log('\n5️⃣ FINAL RECOVERY CHECK');
    console.log('------------------------');
    
    // Wait and check recovery (what happens after audit)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const finalHealth = await axios.get('https://swaps-93hu.onrender.com/health');
    console.log(`✅ Final Recovery: ${finalHealth.status}`);
    console.log(`📊 Memory: ${finalHealth.data.memory?.heapUsed || 'N/A'}`);

  } catch (error) {
    console.log(`❌ Audit recreation failed: ${error.message}`);
    console.log(`📊 Error details: ${error.response?.status || error.code || 'unknown'}`);
  }

  console.log('\n🏁 AUDIT RECREATION COMPLETE');
  console.log('=============================');
}

// Run the audit recreation
recreateAuditConditions()
  .then(() => {
    console.log('\n✅ Audit recreation complete!');
  })
  .catch(error => {
    console.error('\n❌ Audit recreation failed:', error.message);
  });