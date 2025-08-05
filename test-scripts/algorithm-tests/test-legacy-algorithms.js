#!/usr/bin/env node

/**
 * 🔧 TEST LEGACY ALGORITHMS
 * 
 * Test the legacy algorithm path to see if the sophisticated algorithms
 * work there. If they do, then the issue is with the canonical engine.
 */

const axios = require('axios');

const API_BASE = 'https://swaps-93hu.onrender.com';
const ADMIN_API_KEY = 'swaps_admin_prod_2025_secure_key_abc123';

async function testLegacyAlgorithms() {
  console.log('🔧 TESTING LEGACY ALGORITHM PATH');
  console.log('=' .repeat(70));
  console.log('🎯 Goal: Test if sophisticated algorithms work in legacy path');
  console.log('🧪 Method: Create tenant with canonical disabled, test complex trades');
  console.log('');

  try {
    // Create tenant with CANONICAL DISABLED (forces legacy path)
    console.log('📝 Creating tenant with LEGACY ALGORITHMS (canonical disabled)...');
    
    const tenantResponse = await axios.post(`${API_BASE}/api/v1/admin/tenants`, {
      name: 'Legacy Algorithm Test',
      contactEmail: 'legacy@algorithmtest.com',
      description: 'Testing legacy algorithm path with sophisticated features',
      settings: {
        algorithm: {
          enableCanonicalDiscovery: false,  // FORCE LEGACY PATH
          enableSCCOptimization: true,      // Try to enable sophisticated algorithms
          enableLouvainClustering: true,    
          enableBloomFilters: true,         
          enableParallelProcessing: true,   
          maxDepth: 8,
          minEfficiency: 0.5,
          maxResults: 200
        }
      }
    }, {
      headers: {
        'Authorization': `Bearer ${ADMIN_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const tenantId = tenantResponse.data.tenant.id;
    const apiKey = tenantResponse.data.tenant.apiKey || tenantResponse.data.apiKey;
    
    console.log(`✅ Legacy tenant created: ${tenantId}`);
    console.log(`🔑 API Key: ${apiKey.substring(0, 15)}...`);
    
    // Upload simple 3-way loop (should work in legacy)
    console.log('📤 Uploading simple 3-way test data...');
    
    const headers = {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    };
    
    // Create simple 3-way loop: 1→2→3→1
    for (let i = 1; i <= 3; i++) {
      const walletId = `legacy_wallet_${i}`;
      const nftId = `legacy_nft_${i}`;
      
      // Upload NFT
      await axios.post(`${API_BASE}/api/v1/inventory/submit`, {
        nfts: [{
          id: nftId,
          metadata: {
            name: `Legacy NFT ${i}`,
            symbol: `LEG${i}`,
            description: `Legacy test NFT ${i}`
          },
          ownership: {
            ownerId: walletId,
            blockchain: 'solana',
            contractAddress: `legacy_contract_${i}`,
            tokenId: nftId
          },
          valuation: {
            estimatedValue: 1.0 + (i * 0.1),
            currency: 'SOL',
            lastUpdated: new Date().toISOString(),
            source: 'legacy_test'
          }
        }],
        walletId: walletId
      }, { headers });
      
      // Create circular wants: 1→2→3→1
      const nextWallet = i === 3 ? 1 : i + 1;
      await axios.post(`${API_BASE}/api/v1/wants/submit`, {
        walletId: walletId,
        wantedNFTs: [`legacy_nft_${nextWallet}`]
      }, { headers });
    }
    
    console.log(`✅ Simple 3-way loop uploaded`);
    
    // Wait for processing
    console.log('⏱️  Waiting 3 seconds for processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test legacy discovery
    console.log('🔧 Testing LEGACY ALGORITHM DISCOVERY...');
    
    const discoveryResponse = await axios.post(`${API_BASE}/api/v1/discovery/trades`, {
      walletId: 'legacy_wallet_1',
      mode: 'informational',
      settings: {
        maxResults: 100,
        maxDepth: 5,
        minEfficiency: 0.4,
        timeoutMs: 30000
      }
    }, { 
      headers,
      timeout: 35000
    });
    
    const trades = discoveryResponse.data.trades || [];
    
    console.log('✅ Legacy algorithm discovery completed!');
    console.log(`📊 Trades found: ${trades.length}`);
    
    // Analyze results
    let maxParticipants = 0;
    let hasLegacyIds = false;
    let sampleTrade = null;
    
    for (const trade of trades) {
      if (trade.participants && trade.participants.length > maxParticipants) {
        maxParticipants = trade.participants.length;
        sampleTrade = trade;
      }
      
      if (trade.id && (trade.id.includes('trade_') || trade.id.includes('loop_'))) {
        hasLegacyIds = true;
      }
    }
    
    console.log(`📋 Legacy Results:`);
    console.log(`   • Trades Found: ${trades.length}`);
    console.log(`   • Max Participants: ${maxParticipants}`);
    console.log(`   • Legacy Trade IDs: ${hasLegacyIds ? 'YES' : 'NO'}`);
    
    if (sampleTrade) {
      console.log(`   • Sample Trade ID: ${sampleTrade.id}`);
      console.log(`   • Sample Participants: ${sampleTrade.participants?.length || 0}`);
    }
    
    // Assessment
    console.log('');
    console.log('🏆 LEGACY ALGORITHM ASSESSMENT');
    console.log('=' .repeat(70));
    
    const legacyWorking = trades.length > 0;
    const threeWayWorking = maxParticipants >= 3;
    const correctStructure = hasLegacyIds;
    
    console.log(`✅ Legacy Algorithm Function: ${legacyWorking ? 'PASS' : 'FAIL'}`);
    console.log(`✅ 3-Way Loop Detection: ${threeWayWorking ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Correct Trade Structure: ${correctStructure ? 'PASS' : 'FAIL'}`);
    
    if (legacyWorking) {
      console.log('');
      console.log('🎯 DIAGNOSIS: Legacy algorithms are working!');
      console.log('❌ Issue is specifically with the CANONICAL ENGINE');
      console.log('🔧 The sophisticated algorithms exist but canonical engine has bugs');
    } else {
      console.log('');
      console.log('🚨 DIAGNOSIS: Both legacy and canonical paths are broken');
      console.log('🔧 Deeper system issue needs investigation');
    }
    
    return {
      legacyWorking,
      tradesFound: trades.length,
      maxParticipants,
      hasLegacyIds,
      threeWayWorking
    };
    
  } catch (error) {
    console.error('💥 Legacy algorithm test failed:', error.response?.data || error.message);
    return {
      legacyWorking: false,
      error: error.message
    };
  }
}

// Run the test
if (require.main === module) {
  testLegacyAlgorithms()
    .then(results => {
      if (results.legacyWorking) {
        console.log('\n🎯 DIAGNOSIS: ✅ LEGACY WORKS, CANONICAL BROKEN');
        console.log('🔧 Fix needed: Debug canonical engine implementation');
        process.exit(0);
      } else {
        console.log('\n🚨 DIAGNOSIS: ❌ BOTH PATHS BROKEN');
        console.log('🔧 Fix needed: Investigate deeper system issues');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Test crashed:', error.message);
      process.exit(1);
    });
}

module.exports = { testLegacyAlgorithms };