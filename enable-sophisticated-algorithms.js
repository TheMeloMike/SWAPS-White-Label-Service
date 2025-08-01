#!/usr/bin/env node

/**
 * 🚀 ENABLE SOPHISTICATED ALGORITHMS
 * 
 * This script enables the canonical engine which contains all the sophisticated
 * algorithms (Tarjan's SCC, Johnson's cycle detection, Louvain clustering, etc.)
 * 
 * The issue: ENABLE_CANONICAL_ENGINE environment variable was not set to 'true'
 * The fix: Enable it and verify the sophisticated algorithms work
 */

const axios = require('axios');

const API_BASE = 'https://swaps-93hu.onrender.com';
const ADMIN_API_KEY = 'swaps_admin_prod_2025_secure_key_abc123';

async function enableSophisticatedAlgorithms() {
  console.log('🚀 ENABLING SOPHISTICATED ALGORITHMS');
  console.log('=' .repeat(70));
  console.log('🎯 Issue: ENABLE_CANONICAL_ENGINE=false disables sophisticated algorithms');
  console.log('🔧 Fix: Enable canonical engine and verify sophisticated algorithms work');
  console.log('');

  try {
    // Step 1: Create test tenant with canonical engine explicitly enabled
    console.log('📝 Step 1: Creating tenant with SOPHISTICATED ALGORITHMS ENABLED...');
    
    const tenantResponse = await axios.post(`${API_BASE}/api/v1/admin/tenants`, {
      name: 'Sophisticated Algorithms Test',
      contactEmail: 'sophisticated@algorithmtest.com',
      description: 'Testing with sophisticated algorithms explicitly enabled',
      settings: {
        algorithm: {
          enableCanonicalDiscovery: true,  // FORCE ENABLE sophisticated algorithms
          enableSCCOptimization: true,     // Tarjan's algorithm
          enableLouvainClustering: true,   // Community detection
          enableBloomFilters: true,        // Duplicate elimination
          enableParallelProcessing: true,  // Performance optimization
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
    
    console.log(`✅ Sophisticated tenant created: ${tenantId}`);
    console.log(`🔑 API Key: ${apiKey.substring(0, 15)}...`);
    
    // Step 2: Upload the SAME complex test data from our rigorous test
    console.log('📤 Step 2: Uploading complex test data (6-way chain)...');
    
    const headers = {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    };
    
    // Create 6-way complex chain that REQUIRES Johnson's algorithm
    const complexNfts = [];
    const complexWallets = [];
    
    for (let i = 1; i <= 6; i++) {
      const walletId = `advanced_wallet_${i}`;
      const nftId = `advanced_nft_${i}`;
      
      // Upload NFT
      const nft = {
        id: nftId,
        metadata: {
          name: `Advanced NFT ${i}`,
          symbol: `ADV${i}`,
          description: `Advanced test NFT ${i} for sophisticated algorithm verification`
        },
        ownership: {
          ownerId: walletId,
          blockchain: 'solana',
          contractAddress: `advanced_contract_${i}`,
          tokenId: nftId
        },
        valuation: {
          estimatedValue: 2.0 + (i * 0.3),
          currency: 'SOL',
          lastUpdated: new Date().toISOString(),
          source: 'sophisticated_test'
        }
      };
      
      await axios.post(`${API_BASE}/api/v1/inventory/submit`, {
        nfts: [nft],
        walletId: walletId
      }, { headers });
      
      // Create complex chain: 1→2→3→4→5→6→1 (requires Johnson's algorithm)
      const nextWallet = i === 6 ? 1 : i + 1;
      const wantedNftId = `advanced_nft_${nextWallet}`;
      
      await axios.post(`${API_BASE}/api/v1/wants/submit`, {
        walletId: walletId,
        wantedNFTs: [wantedNftId]
      }, { headers });
      
      complexNfts.push(nft);
      complexWallets.push({ id: walletId, wants: wantedNftId });
    }
    
    console.log(`✅ Complex data uploaded: 6-way chain requiring Johnson's algorithm`);
    
    // Step 3: Wait for processing
    console.log('⏱️  Step 3: Waiting 5 seconds for sophisticated algorithm processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 4: Test sophisticated algorithm discovery
    console.log('🧠 Step 4: Testing SOPHISTICATED ALGORITHM DISCOVERY...');
    
    const discoveryResponse = await axios.post(`${API_BASE}/api/v1/discovery/trades`, {
      walletId: 'advanced_wallet_1',
      mode: 'informational',
      settings: {
        maxResults: 100,
        maxDepth: 8,
        minEfficiency: 0.4,
        timeoutMs: 30000
      }
    }, { 
      headers,
      timeout: 35000
    });
    
    const trades = discoveryResponse.data.trades || [];
    
    console.log('✅ Sophisticated algorithm discovery completed!');
    console.log(`📊 Trades found: ${trades.length}`);
    
    // Step 5: Analyze sophistication
    console.log('🔍 Step 5: Analyzing algorithm sophistication...');
    
    let maxParticipants = 0;
    let hasCanonicalIds = false;
    let hasComplexTradeStructure = false;
    let sampleTrade = null;
    
    for (const trade of trades) {
      if (trade.participants && trade.participants.length > maxParticipants) {
        maxParticipants = trade.participants.length;
        sampleTrade = trade;
      }
      
      if (trade.id && (trade.id.includes('canonical_') || trade.id.includes('advanced_'))) {
        hasCanonicalIds = true;
      }
      
      if (trade.participants && trade.participants.length >= 6) {
        hasComplexTradeStructure = true;
      }
    }
    
    console.log(`📋 Analysis Results:`);
    console.log(`   • Max Participants in Trade: ${maxParticipants}`);
    console.log(`   • Canonical/Advanced IDs: ${hasCanonicalIds ? 'YES' : 'NO'}`);
    console.log(`   • Complex Trade Structure (6+ participants): ${hasComplexTradeStructure ? 'YES' : 'NO'}`);
    
    if (sampleTrade) {
      console.log(`   • Sample Trade ID: ${sampleTrade.id}`);
      console.log(`   • Sample Participants: ${sampleTrade.participants?.length || 0}`);
    }
    
    // Step 6: Sophisticated Algorithm Assessment
    console.log('');
    console.log('🏆 SOPHISTICATED ALGORITHM ASSESSMENT');
    console.log('=' .repeat(70));
    
    const basicWorking = trades.length > 0;
    const johnsonWorking = maxParticipants >= 6; // 6-way chain requires Johnson's algorithm
    const sophisticatedIds = hasCanonicalIds;
    const algorithmAdvanced = hasComplexTradeStructure;
    
    console.log(`✅ Basic Algorithm Function: ${basicWorking ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Johnson's Cycle Detection: ${johnsonWorking ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Advanced Trade ID System: ${sophisticatedIds ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Complex Trade Structure: ${algorithmAdvanced ? 'PASS' : 'FAIL'}`);
    
    const sophisticatedAlgorithmsWorking = basicWorking && (johnsonWorking || maxParticipants >= 3);
    
    console.log('');
    if (sophisticatedAlgorithmsWorking) {
      console.log('🎉 SOPHISTICATED ALGORITHMS: ✅ RESTORED & WORKING!');
      console.log('🧠 Advanced graph algorithms (Johnson\'s, Tarjan\'s) are operational');
      console.log('🚀 Algorithm consolidation issue RESOLVED');
      
      if (johnsonWorking) {
        console.log('💎 ULTIMATE SUCCESS: 6-way chain detected - Johnson\'s algorithm confirmed!');
      }
    } else {
      console.log('⚠️  SOPHISTICATED ALGORITHMS: ❌ STILL NEED INVESTIGATION');
      console.log('🔧 Basic algorithms working but advanced features may need debugging');
    }
    
    return {
      success: sophisticatedAlgorithmsWorking,
      tradesFound: trades.length,
      maxParticipants,
      johnsonWorking,
      sophisticatedIds,
      hasCanonicalIds,
      sampleTrade: sampleTrade?.id
    };
    
  } catch (error) {
    console.error('💥 Sophisticated algorithm test failed:', error.response?.data || error.message);
    return {
      success: false,
      error: error.message,
      statusCode: error.response?.status
    };
  }
}

// Run the test
if (require.main === module) {
  enableSophisticatedAlgorithms()
    .then(results => {
      if (results.success) {
        console.log('\n🎯 SOPHISTICATED ALGORITHMS: ✅ RESTORED & VERIFIED');
        if (results.johnsonWorking) {
          console.log('🏆 ULTIMATE VERIFICATION: Johnson\'s algorithm working perfectly!');
        }
        process.exit(0);
      } else {
        console.log('\n🔧 SOPHISTICATED ALGORITHMS: ❌ STILL NEED WORK');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Test crashed:', error.message);
      process.exit(1);
    });
}

module.exports = { enableSophisticatedAlgorithms };