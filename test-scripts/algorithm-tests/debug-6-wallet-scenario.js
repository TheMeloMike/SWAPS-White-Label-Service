#!/usr/bin/env node

/**
 * DEBUG 6-WALLET SCENARIO
 * 
 * Investigating why the perfect 6-wallet circular trade loop isn't being discovered.
 * This should be a textbook case for our algorithms.
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_URL || 'https://swaps-93hu.onrender.com/api/v1';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'swaps_admin_prod_2025_secure_key_abc123';

console.log('🔍 DEBUG: 6-WALLET CIRCULAR TRADE SCENARIO');
console.log('=========================================');
console.log('Expected: Perfect circular trade 1→2→3→4→5→6→1');
console.log('');

async function createTenant() {
  try {
    const response = await axios.post(`${BASE_URL}/admin/tenants`, {
      name: '6-Wallet Debug Test',
      contactEmail: 'debug@6wallet.com',
      settings: {
        algorithm: {
          maxDepth: 20,  // Increased for complex scenario
          minEfficiency: 0.1,  // Lower threshold
          maxLoopsPerRequest: 100
        },
        security: {
          maxNFTsPerWallet: 1000,
          maxWantsPerWallet: 100
        }
      }
    }, {
      headers: {
        'Authorization': `Bearer ${ADMIN_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const tenant = response.data.tenant;
    const apiKey = tenant.apiKey || response.data.apiKey;
    
    console.log(`✅ Debug tenant created: ${tenant.id}`);
    console.log('');
    
    return { tenant, apiKey };
  } catch (error) {
    console.error('❌ Failed to create tenant:', error.response?.data || error.message);
    throw error;
  }
}

async function submitInventory(apiKey, walletId, nfts) {
  try {
    const response = await axios.post(`${BASE_URL}/inventory/submit`, {
      walletId: walletId,
      nfts: nfts
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error(`❌ Inventory submission failed for ${walletId}:`, error.response?.data || error.message);
    throw error;
  }
}

async function submitWants(apiKey, walletId, wantedNFTs) {
  try {
    const response = await axios.post(`${BASE_URL}/wants/submit`, {
      walletId: walletId,
      wantedNFTs: wantedNFTs
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error(`❌ Wants submission failed for ${walletId}:`, error.response?.data || error.message);
    throw error;
  }
}

async function queryTrades(apiKey, walletId) {
  try {
    const response = await axios.post(`${BASE_URL}/discovery/trades`, {
      walletId: walletId
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error(`❌ Trade query failed for ${walletId}:`, error.response?.data || error.message);
    throw error;
  }
}

async function debugCircularTradeScenario() {
  console.log('🚀 Starting 6-wallet circular trade debug...');
  console.log('');
  
  try {
    // Step 1: Create tenant
    const { tenant, apiKey } = await createTenant();
    
    // Step 2: Create the circular scenario with detailed logging
    console.log('📦 Setting up 6-wallet circular scenario...');
    console.log('   Expected trade loop: 1→2→3→4→5→6→1');
    console.log('');
    
    const walletData = [];
    
    // Create each wallet with clear mapping
    for (let i = 1; i <= 6; i++) {
      const walletId = `debug_wallet_${i}`;
      const nftId = `debug_nft_${i}`;
      const nextWallet = i === 6 ? 1 : i + 1;
      const wantedNft = `debug_nft_${nextWallet}`;
      
      console.log(`   🏠 Wallet ${i}: owns NFT_${i}, wants NFT_${nextWallet}`);
      
      walletData.push({
        walletId,
        nftId,
        wantedNft,
        position: i
      });
    }
    
    console.log('');
    
    // Step 3: Submit all inventory first
    console.log('📦 Submitting inventory for all wallets...');
    let inventoryLoops = 0;
    
    for (const wallet of walletData) {
      const nfts = [{
        id: wallet.nftId,
        metadata: {
          name: `Debug NFT ${wallet.position}`,
          symbol: `DBG${wallet.position}`,
          description: `Debug circular NFT ${wallet.position} for 6-way trade`
        },
        ownership: {
          ownerId: wallet.walletId,
          blockchain: 'solana',
          contractAddress: `debug_contract_${wallet.position}`,
          tokenId: wallet.nftId
        },
        valuation: {
          estimatedValue: 1.0,  // Equal values for perfect fairness
          currency: 'SOL',
          lastUpdated: new Date().toISOString(),
          source: 'debug_test'
        }
      }];
      
      const result = await submitInventory(apiKey, wallet.walletId, nfts);
      inventoryLoops += result.newLoopsDiscovered;
      
      console.log(`   ✅ ${wallet.walletId}: owns ${wallet.nftId} → ${result.newLoopsDiscovered} loops`);
    }
    
    console.log(`📊 Total loops after inventory: ${inventoryLoops}`);
    console.log('');
    
    // Step 4: Submit wants one by one to see when the loop completes
    console.log('💭 Submitting wants to build the circular pattern...');
    let totalWantLoops = 0;
    
    for (const wallet of walletData) {
      console.log(`   🎯 ${wallet.walletId} wants ${wallet.wantedNft}...`);
      
      const result = await submitWants(apiKey, wallet.walletId, [wallet.wantedNft]);
      totalWantLoops += result.newLoopsDiscovered;
      
      console.log(`      → ${result.newLoopsDiscovered} new loops discovered (total wants loops: ${totalWantLoops})`);
      
      if (result.newLoopsDiscovered > 0) {
        console.log(`      🎉 LOOP DETECTED! Circle completed at wallet ${wallet.position}`);
        console.log(`      🔄 Expected: ${result.newLoopsDiscovered} should be 1 (the 6-way circular loop)`);
      }
    }
    
    console.log('');
    console.log(`📊 Summary after wants submission:`);
    console.log(`   📈 Inventory loops: ${inventoryLoops}`);
    console.log(`   📈 Wants loops: ${totalWantLoops}`);
    console.log(`   📈 Expected: 1 (one 6-way circular loop)`);
    console.log('');
    
    // Step 5: Query each wallet to see what trades are available
    console.log('🔍 Querying trades for each wallet...');
    let totalQueryTrades = 0;
    
    for (const wallet of walletData) {
      const result = await queryTrades(apiKey, wallet.walletId);
      totalQueryTrades += result.trades.length;
      
      if (result.trades.length > 0) {
        const trade = result.trades[0];
        console.log(`   🎯 ${wallet.walletId}: ${result.trades.length} trades available`);
        console.log(`      💰 Quality: ${trade.qualityScore || 'N/A'}`);
        console.log(`      ⚡ Efficiency: ${trade.efficiency || 'N/A'}`);
        console.log(`      🔄 Steps: ${trade.steps ? trade.steps.length : 'N/A'}`);
        
        if (trade.steps && trade.steps.length > 0) {
          console.log(`      📋 Trade path: ${trade.steps.map(step => `${step.from}→${step.to}`).join(', ')}`);
        }
      } else {
        console.log(`   ❌ ${wallet.walletId}: No trades found`);
      }
    }
    
    console.log('');
    console.log('🔍 DIAGNOSIS:');
    console.log('=============');
    
    if (totalWantLoops > 0 && totalQueryTrades > 0) {
      console.log('✅ SUCCESS: Circular trade loop was discovered and cached!');
      console.log(`📊 Loops discovered during wants: ${totalWantLoops}`);
      console.log(`📊 Trades available in queries: ${totalQueryTrades}`);
      console.log('🧮 Mathematical optimizations working correctly');
      console.log('🎯 6-wallet scenario is functioning as designed');
    } else if (totalWantLoops > 0 && totalQueryTrades === 0) {
      console.log('⚠️  PARTIAL: Loops discovered but not accessible via queries');
      console.log('🔍 Issue: Caching or retrieval problem');
      console.log('🛠️  Fix needed: Check activeLoops to query mapping');
    } else if (totalWantLoops === 0) {
      console.log('❌ FAILURE: No loops discovered during wants submission');
      console.log('🔍 Issue: Algorithm not detecting the circular pattern');
      console.log('🛠️  Fix needed: Check cycle detection logic');
      
      // Additional debugging
      console.log('');
      console.log('💡 POSSIBLE CAUSES:');
      console.log('   1. Algorithm timeout (6-wallet might exceed limits)');
      console.log('   2. Efficiency threshold too high');
      console.log('   3. Cycle detection depth insufficient');
      console.log('   4. Data transformation issue');
    } else {
      console.log('❓ UNKNOWN: Unexpected state');
    }
    
  } catch (error) {
    console.error('💥 Debug test failed:', error.message);
    throw error;
  }
}

// Run the debug test
debugCircularTradeScenario();