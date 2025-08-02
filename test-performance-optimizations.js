#!/usr/bin/env node

/**
 * 🚀 PERFORMANCE OPTIMIZATION VERIFICATION TEST
 * Tests the lazy loading and early exit optimizations we implemented
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'https://swaps-93hu.onrender.com/api/v1';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'swaps_admin_prod_2025_secure_key_abc123';

async function testOptimizations() {
  console.log('🧪 TESTING PERFORMANCE OPTIMIZATIONS');
  console.log('====================================');
  console.log('🎯 Expected: 60-80% improvement in response times');
  console.log('');
  
  try {
    // Create test tenant
    console.log('🏗️ Setting up test environment...');
    const tenantResponse = await axios.post(`${BASE_URL}/admin/tenants`, {
      name: 'Performance_Test_Optimized',
      contactEmail: 'perf@optimized.test',
      settings: {
        algorithm: { maxDepth: 15, minEfficiency: 0.3, maxLoopsPerRequest: 50 },
        security: { maxNFTsPerWallet: 1000, maxWantsPerWallet: 100 }
      }
    }, {
      headers: { 'Authorization': `Bearer ${ADMIN_API_KEY}`, 'Content-Type': 'application/json' }
    });

    const apiKey = tenantResponse.data.tenant.apiKey || tenantResponse.data.apiKey;
    console.log('   ✅ Test tenant created');
    console.log('');

    // Test 1: Empty discovery (should benefit from early exits)
    console.log('🧪 Test 1: Empty Discovery Optimization');
    console.log('======================================');
    
    const emptyTests = [];
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      
      try {
        await axios.post(`${BASE_URL}/discovery/trades`, {
          walletId: `nonexistent_wallet_${i}`
        }, {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        // Expected for non-existent wallet
      }
      
      const time = Date.now() - start;
      emptyTests.push(time);
      console.log(`   🕐 Empty discovery ${i + 1}: ${time}ms`);
    }
    
    const avgEmpty = emptyTests.reduce((a, b) => a + b, 0) / emptyTests.length;
    console.log(`   📊 Average empty discovery: ${avgEmpty.toFixed(0)}ms`);
    console.log(`   ${avgEmpty < 2000 ? '✅ IMPROVED' : avgEmpty < 4000 ? '🟡 SOME IMPROVEMENT' : '❌ STILL SLOW'} (target: <2000ms)`);
    console.log('');

    // Test 2: Empty inventory submit (should benefit from lazy loading)
    console.log('🧪 Test 2: Empty Inventory Submit Optimization');
    console.log('=============================================');
    
    const inventoryTests = [];
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      
      await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: `empty_test_${i}`,
        nfts: []
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });
      
      const time = Date.now() - start;
      inventoryTests.push(time);
      console.log(`   🕐 Empty inventory ${i + 1}: ${time}ms`);
    }
    
    const avgInventory = inventoryTests.reduce((a, b) => a + b, 0) / inventoryTests.length;
    console.log(`   📊 Average empty inventory: ${avgInventory.toFixed(0)}ms`);
    console.log(`   ${avgInventory < 2000 ? '✅ IMPROVED' : avgInventory < 4000 ? '🟡 SOME IMPROVEMENT' : '❌ STILL SLOW'} (target: <2000ms)`);
    console.log('');

    // Test 3: Multiple rapid queries (should benefit from lazy loading after first load)
    console.log('🧪 Test 3: Rapid Query Optimization');
    console.log('===================================');
    
    const rapidStart = Date.now();
    const rapidPromises = [];
    
    for (let i = 0; i < 5; i++) {
      rapidPromises.push(
        axios.post(`${BASE_URL}/discovery/trades`, {
          walletId: `rapid_test_${i}`
        }, {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        }).catch(() => {}) // Ignore errors
      );
    }
    
    await Promise.all(rapidPromises);
    const rapidTime = Date.now() - rapidStart;
    const avgRapid = rapidTime / 5;
    
    console.log(`   📊 5 rapid queries: ${rapidTime}ms total (avg: ${avgRapid.toFixed(0)}ms)`);
    console.log(`   ${rapidTime < 5000 ? '✅ IMPROVED' : rapidTime < 10000 ? '🟡 SOME IMPROVEMENT' : '❌ STILL SLOW'} (target: <5000ms total)`);
    console.log('');

    // Test 4: Basic health check (baseline performance)
    console.log('🧪 Test 4: Baseline Health Check');
    console.log('================================');
    
    const healthStart = Date.now();
    await axios.get(`${BASE_URL.replace('/api/v1', '')}/health`);
    const healthTime = Date.now() - healthStart;
    
    console.log(`   📊 Health check: ${healthTime}ms`);
    console.log(`   ${healthTime < 200 ? '✅ FAST' : healthTime < 500 ? '🟡 ACCEPTABLE' : '❌ SLOW'} (baseline)`);
    console.log('');

    // Summary and analysis
    console.log('📊 OPTIMIZATION RESULTS SUMMARY');
    console.log('===============================');
    
    const results = [
      { name: 'Empty Discovery', time: avgEmpty, target: 2000, previous: 6000 },
      { name: 'Empty Inventory', time: avgInventory, target: 2000, previous: 6000 },
      { name: 'Rapid Queries', time: rapidTime, target: 5000, previous: 25000 },
      { name: 'Health Check', time: healthTime, target: 200, previous: 200 }
    ];
    
    let improvements = 0;
    let totalImprovement = 0;
    
    results.forEach(result => {
      const improvement = ((result.previous - result.time) / result.previous) * 100;
      const status = result.time <= result.target ? '✅ TARGET MET' : 
                    improvement > 30 ? '🟡 IMPROVED' : '❌ NO CHANGE';
      
      console.log(`   ${status} ${result.name}: ${result.time.toFixed(0)}ms (target: ${result.target}ms)`);
      
      if (improvement > 0) {
        console.log(`      📈 Improvement: ${improvement.toFixed(1)}% faster than before`);
        totalImprovement += improvement;
        improvements++;
      }
    });
    
    console.log('');
    
    const avgImprovement = improvements > 0 ? totalImprovement / improvements : 0;
    const targetsHit = results.filter(r => r.time <= r.target).length;
    
    console.log(`🎯 OVERALL PERFORMANCE ASSESSMENT:`);
    console.log(`   📊 Targets hit: ${targetsHit}/${results.length}`);
    console.log(`   📈 Average improvement: ${avgImprovement.toFixed(1)}%`);
    
    if (targetsHit >= 3) {
      console.log('   🎉 OPTIMIZATION SUCCESSFUL! System ready for client demos');
    } else if (targetsHit >= 2 || avgImprovement > 40) {
      console.log('   ✅ SIGNIFICANT IMPROVEMENT! Good progress made');
    } else if (avgImprovement > 20) {
      console.log('   🟡 MODERATE IMPROVEMENT! Some optimizations working');
    } else {
      console.log('   ⚠️  LIMITED IMPROVEMENT! More optimization needed');
    }
    
    console.log('');
    console.log('🔍 NEXT STEPS:');
    
    if (targetsHit >= 3) {
      console.log('   1. ✅ Performance targets achieved!');
      console.log('   2. 🚀 System ready for client presentations');
      console.log('   3. 📊 Monitor performance in production');
    } else {
      console.log('   1. 🔍 Review remaining slow operations');
      console.log('   2. 🔧 Implement additional optimizations');
      console.log('   3. 🧪 Test with real-world data scenarios');
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
    console.log('');
    console.log('🔧 TROUBLESHOOTING:');
    console.log('   1. Check if API is accessible');
    console.log('   2. Verify ADMIN_API_KEY is correct');
    console.log('   3. Ensure optimizations were applied correctly');
  }
}

testOptimizations();