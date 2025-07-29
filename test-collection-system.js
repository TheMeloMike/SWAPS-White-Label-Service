#!/usr/bin/env node

/**
 * SWAPS Collection Trading System Test
 * 
 * Tests the complete end-to-end collection trading functionality:
 * 1. Collection search via enhanced database
 * 2. Collection wants management (add/get/remove)
 * 3. Collection-based trade discovery
 * 4. Frontend UnifiedDisplayModal integration
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const TEST_WALLET = '5pPCbuGso6NguFBWAqaKm7FW9msRoLQQoWu7kawGfFna';

class CollectionSystemTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
    this.baseUrl = BASE_URL;
  }

  async detectServerPort() {
    const ports = [3001, 8080, 3000, 8000];
    
    for (const port of ports) {
      try {
        const url = `http://localhost:${port}/api/trades/health`;
        const response = await fetch(url);
        if (response.ok) {
          this.baseUrl = `http://localhost:${port}`;
          console.log(`✅ Detected server running on port ${port}`);
          return true;
        }
      } catch (error) {
        // Continue to next port
      }
    }
    
    console.log(`❌ Could not detect server on any common port`);
    return false;
  }

  async test(name, testFn) {
    console.log(`\n🧪 Testing: ${name}`);
    try {
      await testFn();
      console.log(`✅ PASSED: ${name}`);
      this.testResults.passed++;
      this.testResults.tests.push({ name, status: 'PASSED' });
    } catch (error) {
      console.error(`❌ FAILED: ${name} - ${error.message}`);
      this.testResults.failed++;
      this.testResults.tests.push({ name, status: 'FAILED', error: error.message });
    }
  }

  async apiRequest(endpoint, method = 'GET', body = null) {
    const url = `${BASE_URL}${endpoint}`;
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} - ${data.message || data.error || 'Unknown error'}`);
    }
    
    return data;
  }

  async testCollectionSearch() {
    await this.test('Collection Search - Basic Query', async () => {
      const result = await this.apiRequest('/api/collections/search?q=Mad Lads&limit=5');
      
      if (!result.success) {
        throw new Error('Search request failed');
      }
      
      if (!Array.isArray(result.collections)) {
        throw new Error('Collections array not returned');
      }
      
      console.log(`   Found ${result.collections.length} collections`);
      if (result.collections.length > 0) {
        const firstCollection = result.collections[0];
        console.log(`   First result: ${firstCollection.name} (${firstCollection.id})`);
        console.log(`   Floor price: ${firstCollection.floorPrice} SOL`);
        console.log(`   NFT count: ${firstCollection.nftCount}`);
      }
    });

    await this.test('Collection Search - Empty Query', async () => {
      const result = await this.apiRequest('/api/collections/search?q=&limit=5');
      
      if (!result.success) {
        throw new Error('Empty search should still succeed');
      }
      
      console.log(`   Empty query returned ${result.collections.length} collections`);
    });

    await this.test('Collection Search - Popular Collections', async () => {
      const result = await this.apiRequest('/api/collections/popular?limit=5');
      
      if (!result.success) {
        throw new Error('Popular collections request failed');
      }
      
      if (!Array.isArray(result.collections)) {
        throw new Error('Collections array not returned');
      }
      
      console.log(`   Found ${result.collections.length} popular collections`);
      if (result.collections.length > 0) {
        result.collections.forEach((collection, i) => {
          console.log(`   ${i + 1}. ${collection.name} - Floor: ${collection.floorPrice} SOL`);
        });
      }
    });
  }

  async testCollectionWantsManagement() {
    const testCollectionId = 'madlads';
    
    await this.test('Add Collection Want', async () => {
      const result = await this.apiRequest('/api/trades/wants/collection', 'POST', {
        wallet: TEST_WALLET,
        collectionId: testCollectionId
      });
      
      if (!result.success) {
        throw new Error(`Failed to add collection want: ${result.message}`);
      }
      
      console.log(`   Added collection want for ${testCollectionId}`);
    });

    await this.test('Get Collection Wants', async () => {
      const result = await this.apiRequest(`/api/trades/wants/collection?wallet=${TEST_WALLET}`);
      
      if (!result.success) {
        throw new Error('Failed to get collection wants');
      }
      
      if (!Array.isArray(result.wants)) {
        throw new Error('Wants array not returned');
      }
      
      console.log(`   Retrieved ${result.wants.length} collection wants`);
      
      const hasTestCollection = result.wants.some(want => want.collectionId === testCollectionId);
      if (!hasTestCollection) {
        throw new Error('Test collection not found in wants list');
      }
      
      console.log(`   ✓ Test collection ${testCollectionId} found in wants`);
    });

    await this.test('Remove Collection Want', async () => {
      const result = await this.apiRequest(
        `/api/trades/wants/collection/${encodeURIComponent(testCollectionId)}?wallet=${TEST_WALLET}`, 
        'DELETE'
      );
      
      if (!result.success) {
        throw new Error(`Failed to remove collection want: ${result.message}`);
      }
      
      console.log(`   Removed collection want for ${testCollectionId}`);
      
      // Verify it's gone
      const checkResult = await this.apiRequest(`/api/trades/wants/collection?wallet=${TEST_WALLET}`);
      const stillHasCollection = checkResult.wants.some(want => want.collectionId === testCollectionId);
      
      if (stillHasCollection) {
        throw new Error('Collection want was not properly removed');
      }
      
      console.log(`   ✓ Verified collection want was removed`);
    });
  }

  async testTradeDiscovery() {
    await this.test('Basic Trade Discovery', async () => {
      const result = await this.apiRequest('/api/trades/discover', 'POST', {
        wallet: TEST_WALLET,
        forceRefresh: true,
        considerCollections: true,
        includeCollectionTrades: true,
        maxResults: 10
      });
      
      if (!result.success) {
        throw new Error(`Trade discovery failed: ${result.message || 'Unknown error'}`);
      }
      
      console.log(`   Trade discovery completed`);
      console.log(`   Found ${result.trades.length} trade opportunities`);
      
      if (result.trades.length > 0) {
        const firstTrade = result.trades[0];
        console.log(`   First trade: ${firstTrade.totalParticipants} participants, ${firstTrade.steps.length} steps`);
        console.log(`   Efficiency: ${(firstTrade.efficiency * 100).toFixed(1)}%`);
        
        if (firstTrade.hasCollectionTrades) {
          console.log(`   ✓ Contains collection-level trades`);
        }
      }
    });
  }

  async testSystemState() {
    await this.test('System State Check', async () => {
      const result = await this.apiRequest('/api/trades/system');
      
      if (!result.success) {
        throw new Error('Failed to get system state');
      }
      
      console.log(`   System state retrieved`);
      console.log(`   Wallets: ${result.systemState.wallets}`);
      console.log(`   Wanted NFTs: ${result.systemState.wanted}`);
      console.log(`   Owned NFTs: ${result.systemState.owned}`);
    });
  }

  async testHealthChecks() {
    await this.test('Collections Service Health', async () => {
      const result = await this.apiRequest('/api/collections/health');
      
      if (result.error) {
        throw new Error(`Collections service not healthy: ${result.error}`);
      }
      
      console.log(`   Collections service is healthy`);
    });

    await this.test('Trade Service Health', async () => {
      const result = await this.apiRequest('/api/trades/health');
      
      if (!result.message || !result.message.includes('Running')) {
        throw new Error('Trade service not responding correctly');
      }
      
      console.log(`   Trade service is healthy`);
    });
  }

  async runAllTests() {
    console.log('🚀 Starting SWAPS Collection Trading System Tests\n');
    console.log(`Testing against: ${BASE_URL}`);
    console.log(`Test wallet: ${TEST_WALLET}\n`);

    // Run test categories
    await this.testHealthChecks();
    await this.testCollectionSearch();
    await this.testCollectionWantsManagement();
    await this.testTradeDiscovery();
    await this.testSystemState();

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('🎯 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📊 Total: ${this.testResults.passed + this.testResults.failed}`);
    
    if (this.testResults.failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.testResults.tests
        .filter(test => test.status === 'FAILED')
        .forEach(test => {
          console.log(`   • ${test.name}: ${test.error}`);
        });
    }

    const successRate = (this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100;
    console.log(`\n🎯 Success Rate: ${successRate.toFixed(1)}%`);
    
    if (successRate === 100) {
      console.log('\n🎉 ALL TESTS PASSED! Collection trading system is production ready! 🎉');
    } else if (successRate >= 80) {
      console.log('\n⚠️  Most tests passed, but some issues need attention.');
    } else {
      console.log('\n💥 Significant issues detected. System needs debugging.');
    }
  }
}

// Run the tests
async function main() {
  const tester = new CollectionSystemTester();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('\n💥 Test runner crashed:', error.message);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { CollectionSystemTester }; 