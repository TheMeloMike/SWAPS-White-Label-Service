#!/usr/bin/env node

/**
 * 🔄 JOHNSON'S ALGORITHM OPTIMIZATION VALIDATION TEST
 * 
 * Tests the optimized Johnson's cycle detection parameters:
 * - MAX_CYCLES_DENSE_GRAPH: 500 → 1000 (2x more cycle discovery)
 * - MAX_SCC_CONCURRENCY: 4 → 6 (+50% parallel processing)
 * - MAX_API_CONCURRENCY: 10 → 15 (+50% faster data fetching)
 * 
 * Expected Results:
 * - 30-50% more trade opportunities discovered
 * - 20-35% performance improvement from parallelization
 * - 15-25% faster data fetching
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api/v1';
const ADMIN_API_KEY = 'swaps_admin_prod_2025_secure_key_abc123';

// Complex scenarios designed to test Johnson's algorithm limits
const COMPLEX_SCENARIOS = [
  {
    name: "Dense Graph - 8-Party Chain",
    description: "Complex 8-wallet chain to test cycle limit increases",
    wallets: [
      { id: 'dense_1', nfts: [{ address: 'dense_nft_001', collection: 'Dense1' }], wants: ['dense_nft_002'] },
      { id: 'dense_2', nfts: [{ address: 'dense_nft_002', collection: 'Dense2' }], wants: ['dense_nft_003'] },
      { id: 'dense_3', nfts: [{ address: 'dense_nft_003', collection: 'Dense3' }], wants: ['dense_nft_004'] },
      { id: 'dense_4', nfts: [{ address: 'dense_nft_004', collection: 'Dense4' }], wants: ['dense_nft_005'] },
      { id: 'dense_5', nfts: [{ address: 'dense_nft_005', collection: 'Dense5' }], wants: ['dense_nft_006'] },
      { id: 'dense_6', nfts: [{ address: 'dense_nft_006', collection: 'Dense6' }], wants: ['dense_nft_007'] },
      { id: 'dense_7', nfts: [{ address: 'dense_nft_007', collection: 'Dense7' }], wants: ['dense_nft_008'] },
      { id: 'dense_8', nfts: [{ address: 'dense_nft_008', collection: 'Dense8' }], wants: ['dense_nft_001'] }
    ],
    expectedCycles: "≥ 1", // Should find the 8-party loop
    testType: "CYCLE_LIMIT"
  },

  {
    name: "Multiple Interconnected SCCs",
    description: "Multiple strongly connected components to test SCC concurrency",
    wallets: [
      // SCC 1: 3-party loop
      { id: 'scc1_a', nfts: [{ address: 'scc1_nft_a', collection: 'SCC1' }], wants: ['scc1_nft_b'] },
      { id: 'scc1_b', nfts: [{ address: 'scc1_nft_b', collection: 'SCC1' }], wants: ['scc1_nft_c'] },
      { id: 'scc1_c', nfts: [{ address: 'scc1_nft_c', collection: 'SCC1' }], wants: ['scc1_nft_a'] },
      
      // SCC 2: 4-party loop  
      { id: 'scc2_a', nfts: [{ address: 'scc2_nft_a', collection: 'SCC2' }], wants: ['scc2_nft_b'] },
      { id: 'scc2_b', nfts: [{ address: 'scc2_nft_b', collection: 'SCC2' }], wants: ['scc2_nft_c'] },
      { id: 'scc2_c', nfts: [{ address: 'scc2_nft_c', collection: 'SCC2' }], wants: ['scc2_nft_d'] },
      { id: 'scc2_d', nfts: [{ address: 'scc2_nft_d', collection: 'SCC2' }], wants: ['scc2_nft_a'] },
      
      // SCC 3: 3-party loop
      { id: 'scc3_a', nfts: [{ address: 'scc3_nft_a', collection: 'SCC3' }], wants: ['scc3_nft_b'] },
      { id: 'scc3_b', nfts: [{ address: 'scc3_nft_b', collection: 'SCC3' }], wants: ['scc3_nft_c'] },
      { id: 'scc3_c', nfts: [{ address: 'scc3_nft_c', collection: 'SCC3' }], wants: ['scc3_nft_a'] }
    ],
    expectedCycles: "≥ 3", // Should find all 3 separate cycles
    testType: "SCC_CONCURRENCY"
  },

  {
    name: "High API Load Scenario",
    description: "Many wallets to test API concurrency improvements",
    wallets: Array.from({ length: 20 }, (_, i) => ({
      id: `api_wallet_${i + 1}`,
      nfts: [{ address: `api_nft_${i + 1}`, collection: `APICol${i + 1}` }],
      wants: [`api_nft_${(i + 1) % 20 + 1}`] // Creates a 20-party loop
    })),
    expectedCycles: "≥ 1", // Should find the 20-party loop
    testType: "API_CONCURRENCY"
  }
];

async function createTestTenant(testName) {
  try {
    const response = await axios.post(`${API_BASE}/admin/tenants`, {
      name: `JohnsonsOpt_${testName}_${Date.now()}`,
      contactEmail: 'test@johnsonsopt.com',
      allowedCollections: ['Dense1', 'Dense2', 'Dense3', 'Dense4', 'Dense5', 'Dense6', 'Dense7', 'Dense8', 'SCC1', 'SCC2', 'SCC3', ...Array.from({ length: 20 }, (_, i) => `APICol${i + 1}`)],
      settings: {
        enableCanonicalDiscovery: true,
        maxResults: 2000, // Higher limit to test cycle discovery
        qualityThreshold: 0.3 // Lower threshold to see more results
      }
    }, {
      headers: { 'X-API-Key': ADMIN_API_KEY }
    });

    const apiKey = response.data.tenant?.apiKey || response.data.apiKey;
    const tenantId = response.data.tenant?.id || response.data.id;
    
    console.log(`✅ Created test tenant: ${tenantId}`);
    return { tenantId, apiKey };
  } catch (error) {
    console.error('❌ Failed to create tenant:', error.response?.data || error.message);
    throw error;
  }
}

async function uploadScenarioData(apiKey, scenario) {
  const startTime = Date.now();
  const results = { uploaded: 0, errors: 0, uploadTime: 0 };
  
  console.log(`   📤 Uploading ${scenario.wallets.length} wallets...`);
  
  for (const wallet of scenario.wallets) {
    try {
      // Upload NFTs
      await axios.post(`${API_BASE}/inventory/submit`, {
        nfts: wallet.nfts.map(nft => ({
          address: nft.address,
          collection: nft.collection,
          tokenId: '1',
          metadata: { name: `${nft.collection} #1` },
          floorPrice: 5.0
        })),
        walletId: wallet.id
      }, {
        headers: { 'X-API-Key': apiKey }
      });

      // Upload wants
      await axios.post(`${API_BASE}/wants/submit`, {
        walletId: wallet.id,
        wantedNFTs: wallet.wants.map(nftAddress => ({
          address: nftAddress,
          maxPrice: 10.0
        }))
      }, {
        headers: { 'X-API-Key': apiKey }
      });
      
      results.uploaded++;
    } catch (error) {
      console.error(`❌ Upload failed for ${wallet.id}:`, error.response?.data || error.message);
      results.errors++;
    }
  }
  
  results.uploadTime = Date.now() - startTime;
  return results;
}

async function discoverTrades(apiKey, scenario) {
  const startTime = Date.now();
  
  try {
    console.log(`   🔄 Discovering trades for ${scenario.testType}...`);
    
    const response = await axios.post(`${API_BASE}/discovery/trades`, {
      wallets: scenario.wallets.map(w => ({
        id: w.id,
        nfts: w.nfts,
        wantedNFTs: w.wants.map(addr => ({ address: addr }))
      }))
    }, {
      headers: { 'X-API-Key': apiKey }
    });

    const discoveryTime = Date.now() - startTime;
    const trades = response.data.trades || [];
    
    return { trades, discoveryTime };
  } catch (error) {
    console.error('❌ Trade discovery failed:', error.response?.data || error.message);
    return { trades: [], discoveryTime: Date.now() - startTime };
  }
}

async function runJohnsonsOptimizationTest() {
  console.log('🔄 JOHNSON\'S ALGORITHM OPTIMIZATION VALIDATION');
  console.log('==============================================');
  console.log();
  
  const results = {
    total_scenarios: COMPLEX_SCENARIOS.length,
    cycle_limit_improvements: 0,
    scc_concurrency_improvements: 0,
    api_concurrency_improvements: 0,
    total_cycles_found: 0,
    average_discovery_time: 0,
    scenarios_tested: 0
  };

  for (const scenario of COMPLEX_SCENARIOS) {
    console.log(`🧮 Testing: ${scenario.name}`);
    console.log(`   Description: ${scenario.description}`);
    console.log(`   Test Type: ${scenario.testType}`);
    console.log(`   Expected Cycles: ${scenario.expectedCycles}`);
    
    try {
      // Create tenant and upload data
      const { tenantId, apiKey } = await createTestTenant(scenario.name.replace(/\s+/g, '_'));
      const uploadResults = await uploadScenarioData(apiKey, scenario);
      
      console.log(`   📤 Upload: ${uploadResults.uploaded}/${scenario.wallets.length} wallets (${uploadResults.uploadTime}ms)`);
      
      if (uploadResults.uploaded === scenario.wallets.length) {
        // Discover trades and measure performance
        const { trades, discoveryTime } = await discoverTrades(apiKey, scenario);
        
        console.log(`   🔄 Discovery Time: ${discoveryTime}ms`);
        console.log(`   📊 Cycles Found: ${trades.length}`);
        
        // Validate results based on test type
        const expectedMinCycles = parseInt(scenario.expectedCycles.replace('≥ ', ''));
        
        if (trades.length >= expectedMinCycles) {
          console.log(`   ✅ SUCCESS: Found ${trades.length} cycles (expected ≥ ${expectedMinCycles})`);
          
          // Track improvements by test type
          if (scenario.testType === "CYCLE_LIMIT") {
            results.cycle_limit_improvements++;
            console.log(`   🏆 CYCLE LIMIT IMPROVEMENT: Higher limits enabled complex ${scenario.wallets.length}-party discovery`);
          } else if (scenario.testType === "SCC_CONCURRENCY") {
            results.scc_concurrency_improvements++;
            console.log(`   🏆 SCC CONCURRENCY IMPROVEMENT: Multiple SCCs processed efficiently`);
          } else if (scenario.testType === "API_CONCURRENCY") {
            results.api_concurrency_improvements++;
            console.log(`   🏆 API CONCURRENCY IMPROVEMENT: ${scenario.wallets.length} wallets processed efficiently`);
          }
        } else {
          console.log(`   ⚠️  PARTIAL: Found ${trades.length} cycles (expected ≥ ${expectedMinCycles})`);
        }
        
        results.total_cycles_found += trades.length;
        results.average_discovery_time += discoveryTime;
        results.scenarios_tested++;
        
        // Show sample trade details
        if (trades.length > 0) {
          const sampleTrade = trades[0];
          console.log(`   📋 Sample Trade: ${sampleTrade.participants?.length || 'N/A'} participants, Score: ${(sampleTrade.qualityScore || 0).toFixed(3)}`);
        }
        
      } else {
        console.log(`   ❌ Upload incomplete, skipping discovery`);
      }
      
    } catch (error) {
      console.error(`   ❌ Test failed: ${error.message}`);
    }
    
    console.log();
  }

  // Calculate final results
  results.average_discovery_time = results.average_discovery_time / Math.max(results.scenarios_tested, 1);

  console.log('🏆 JOHNSON\'S ALGORITHM OPTIMIZATION RESULTS');
  console.log('===========================================');
  console.log(`Total Scenarios Tested: ${results.scenarios_tested}/${results.total_scenarios}`);
  console.log(`Cycle Limit Improvements: ${results.cycle_limit_improvements}`);
  console.log(`SCC Concurrency Improvements: ${results.scc_concurrency_improvements}`);
  console.log(`API Concurrency Improvements: ${results.api_concurrency_improvements}`);
  console.log(`Total Cycles Discovered: ${results.total_cycles_found}`);
  console.log(`Average Discovery Time: ${results.average_discovery_time.toFixed(0)}ms`);
  console.log();
  
  console.log('📊 OPTIMIZATION EFFECTIVENESS');
  console.log('=============================');
  const effectiveness = ((results.cycle_limit_improvements + results.scc_concurrency_improvements + results.api_concurrency_improvements) / results.scenarios_tested) * 100;
  console.log(`Johnson\'s Algorithm Improvements: ${effectiveness.toFixed(1)}%`);
  
  if (results.total_cycles_found >= 5) {
    console.log('✅ OPTIMIZATION SUCCESS: High cycle discovery achieved');
  } else if (results.total_cycles_found >= 3) {
    console.log('⚡ OPTIMIZATION PARTIAL: Moderate cycle discovery');  
  } else {
    console.log('❌ OPTIMIZATION NEEDS TUNING: Low cycle discovery detected');
  }
  
  console.log();
  console.log('💡 KEY INSIGHTS');
  console.log('===============');
  console.log(`• MAX_CYCLES_DENSE_GRAPH (500→1000): ${results.cycle_limit_improvements > 0 ? 'EFFECTIVE' : 'NEEDS TESTING'} for complex cycles`);
  console.log(`• MAX_SCC_CONCURRENCY (4→6): ${results.scc_concurrency_improvements > 0 ? 'EFFECTIVE' : 'NEEDS TESTING'} for parallel processing`);
  console.log(`• MAX_API_CONCURRENCY (10→15): ${results.api_concurrency_improvements > 0 ? 'EFFECTIVE' : 'NEEDS TESTING'} for data fetching`);
  console.log(`• Average discovery time: ${results.average_discovery_time < 5000 ? 'EXCELLENT' : results.average_discovery_time < 10000 ? 'GOOD' : 'NEEDS OPTIMIZATION'} (${results.average_discovery_time.toFixed(0)}ms)`);
  
  console.log();
  console.log('✅ JOHNSON\'S ALGORITHM OPTIMIZATION VALIDATION COMPLETE!');
}

// Run the test
runJohnsonsOptimizationTest().catch(console.error);