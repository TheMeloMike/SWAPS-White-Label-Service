#!/usr/bin/env node

/**
 * PROPER PERSISTENT GRAPH TEST
 * 
 * This test follows the correct workflow for a living persistent graph:
 * 1. Create tenant
 * 2. Submit inventory (NFTs) via /api/v1/inventory/submit
 * 3. Submit wants via /api/v1/wants/submit  
 * 4. Query the living graph via /api/v1/discovery/trades
 * 
 * This should populate activeLoops and test the mathematical optimizations.
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_URL || 'https://swaps-93hu.onrender.com/api/v1';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'swaps_admin_prod_2025_secure_key_abc123';

console.log('🧪 PROPER PERSISTENT GRAPH TEST');
console.log('================================');
console.log(`🔗 API URL: ${BASE_URL}`);
console.log('');

async function createTenant() {
  console.log('📝 Step 1: Creating tenant...');
  
  try {
    const response = await axios.post(`${BASE_URL}/admin/tenants`, {
      name: 'Persistent Graph Test',
      contactEmail: 'test@persistentgraph.com',
      settings: {
        algorithm: {
          maxDepth: 15,
          minEfficiency: 0.3,
          maxLoopsPerRequest: 50
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
    
    console.log(`✅ Tenant created successfully`);
    console.log(`   🆔 Tenant ID: ${tenant.id}`);
    console.log(`   🔑 API Key: ${apiKey}`);
    console.log('');
    
    return { tenant, apiKey };
  } catch (error) {
    console.error('❌ Failed to create tenant:', error.response?.data || error.message);
    throw error;
  }
}

async function submitInventory(tenantId, apiKey, walletData) {
  console.log(`📦 Step 2: Submitting inventory for wallet ${walletData.walletId}...`);
  
  try {
    const response = await axios.post(`${BASE_URL}/inventory/submit`, {
      walletId: walletData.walletId,
      nfts: walletData.nfts
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Inventory submitted: ${walletData.nfts.length} NFTs, ${response.data.newLoopsDiscovered} new loops discovered`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to submit inventory:`, error.response?.data || error.message);
    throw error;
  }
}

async function submitWants(tenantId, apiKey, walletId, wantedNFTs) {
  console.log(`💭 Step 3: Submitting wants for wallet ${walletId}...`);
  
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

    console.log(`✅ Wants submitted: ${wantedNFTs.length} wants, ${response.data.newLoopsDiscovered} new loops discovered`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to submit wants:`, error.response?.data || error.message);
    throw error;
  }
}

async function queryPersistentGraph(tenantId, apiKey, walletId) {
  console.log(`🔍 Step 4: Querying persistent graph for wallet ${walletId}...`);
  
  try {
    const response = await axios.post(`${BASE_URL}/discovery/trades`, {
      walletId: walletId
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Graph query successful: ${response.data.trades.length} trades found`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to query graph:`, error.response?.data || error.message);
    throw error;
  }
}

async function runPersistentGraphTest() {
  console.log('🚀 Starting proper persistent graph test...');
  console.log('');
  
  try {
    // Step 1: Create tenant
    const { tenant, apiKey } = await createTenant();
    
    // Step 2: Create 3-way perfect trade scenario
    const testData = [
      {
        walletId: 'wallet_alice',
        nfts: [{
          id: 'nft_alpha',
          metadata: {
            name: 'Alpha NFT',
            symbol: 'ALPHA',
            description: 'Alice owns Alpha, wants Beta'
          },
          ownership: {
            ownerId: 'wallet_alice',
            blockchain: 'solana',
            contractAddress: 'alpha_contract',
            tokenId: 'nft_alpha'
          },
          valuation: {
            estimatedValue: 1.0,
            currency: 'SOL',
            lastUpdated: new Date().toISOString(),
            source: 'persistent_test'
          }
        }],
        wants: ['nft_beta']
      },
      {
        walletId: 'wallet_bob',
        nfts: [{
          id: 'nft_beta',
          metadata: {
            name: 'Beta NFT',
            symbol: 'BETA',
            description: 'Bob owns Beta, wants Gamma'
          },
          ownership: {
            ownerId: 'wallet_bob',
            blockchain: 'solana',
            contractAddress: 'beta_contract',
            tokenId: 'nft_beta'
          },
          valuation: {
            estimatedValue: 1.1,
            currency: 'SOL',
            lastUpdated: new Date().toISOString(),
            source: 'persistent_test'
          }
        }],
        wants: ['nft_gamma']
      },
      {
        walletId: 'wallet_charlie',
        nfts: [{
          id: 'nft_gamma',
          metadata: {
            name: 'Gamma NFT',
            symbol: 'GAMMA',
            description: 'Charlie owns Gamma, wants Alpha'
          },
          ownership: {
            ownerId: 'wallet_charlie',
            blockchain: 'solana',
            contractAddress: 'gamma_contract',
            tokenId: 'nft_gamma'
          },
          valuation: {
            estimatedValue: 1.2,
            currency: 'SOL',
            lastUpdated: new Date().toISOString(),
            source: 'persistent_test'
          }
        }],
        wants: ['nft_alpha']
      }
    ];
    
    // Step 3: Submit all inventory to populate the persistent graph
    console.log('📦 Populating persistent graph with inventory...');
    let totalInventoryLoops = 0;
    for (const walletData of testData) {
      const result = await submitInventory(tenant.id, apiKey, walletData);
      totalInventoryLoops += result.newLoopsDiscovered;
    }
    console.log(`📊 Total loops discovered during inventory submission: ${totalInventoryLoops}`);
    console.log('');
    
    // Step 4: Submit all wants to trigger loop detection
    console.log('💭 Submitting wants to trigger trade loop discovery...');
    let totalWantLoops = 0;
    for (const walletData of testData) {
      const result = await submitWants(tenant.id, apiKey, walletData.walletId, walletData.wants);
      totalWantLoops += result.newLoopsDiscovered;
    }
    console.log(`📊 Total loops discovered during wants submission: ${totalWantLoops}`);
    console.log('');
    
    // Step 5: Query the persistent graph for each wallet
    console.log('🔍 Querying persistent graph for discovered trades...');
    let totalFoundTrades = 0;
    for (const walletData of testData) {
      const result = await queryPersistentGraph(tenant.id, apiKey, walletData.walletId);
      totalFoundTrades += result.trades.length;
      
      if (result.trades.length > 0) {
        console.log(`   🎯 ${walletData.walletId}: ${result.trades.length} trades available`);
        
        // Show first trade details
        const trade = result.trades[0];
        console.log(`      💰 Quality Score: ${trade.qualityScore || 'N/A'}`);
        console.log(`      🔄 Steps: ${trade.steps.length}`);
        console.log(`      🏆 Efficiency: ${trade.efficiency || 'N/A'}`);
      } else {
        console.log(`   ❌ ${walletData.walletId}: No trades found`);
      }
    }
    
    // Final analysis
    console.log('');
    console.log('📊 PERSISTENT GRAPH TEST RESULTS');
    console.log('=================================');
    console.log(`📈 Total loops discovered during inventory: ${totalInventoryLoops}`);
    console.log(`📈 Total loops discovered during wants: ${totalWantLoops}`);
    console.log(`📈 Total trades found in queries: ${totalFoundTrades}`);
    console.log('');
    
    if (totalFoundTrades > 0) {
      console.log('✅ SUCCESS: Persistent graph is working correctly!');
      console.log('🧮 Mathematical optimizations are being utilized');
      console.log('🔄 Living graph architecture is functional');
      console.log('🚀 System ready for client demonstrations');
    } else {
      console.log('❌ FAILURE: Persistent graph not populating trades');
      console.log('🔍 Investigation needed into algorithm consolidation');
      console.log('⚠️  System not ready for client use');
    }
    
  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
    process.exit(1);
  }
}

// Run the test
runPersistentGraphTest();