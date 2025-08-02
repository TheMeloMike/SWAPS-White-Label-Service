#!/usr/bin/env node

/**
 * INVESTIGATE 5+ WAY LOOP ISSUE
 * 
 * The algorithms are discovering 5+ way loops (we see "2 loops discovered") 
 * but they're not accessible via queries. Let's investigate:
 * 
 * 1. Step-by-step 5-way loop construction with detailed logging
 * 2. Check what's being stored in activeLoops vs what's being retrieved
 * 3. Examine the specific loop structures being created
 * 4. Test individual wallet queries vs bulk queries
 * 5. Compare 4-way (working) vs 5-way (broken) patterns
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_URL || 'https://swaps-93hu.onrender.com/api/v1';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'swaps_admin_prod_2025_secure_key_abc123';

console.log('🔍 INVESTIGATING 5+ WAY LOOP ISSUE');
console.log('==================================');
console.log('🎯 Goal: Understand why discovered loops aren\'t accessible');
console.log('🎯 Hypothesis: Caching/retrieval mismatch for complex loops');
console.log('');

class LoopInvestigator {
  constructor() {
    this.tenant = null;
    this.apiKey = null;
    this.discoveryEvents = [];
    this.queryResults = [];
  }

  async createTenant() {
    console.log('📝 Creating investigation tenant...');
    
    try {
      const response = await axios.post(`${BASE_URL}/admin/tenants`, {
        name: '5-Way Loop Investigation',
        contactEmail: 'investigate@5wayloops.com',
        settings: {
          algorithm: { 
            maxDepth: 25,  // Even higher for investigation
            minEfficiency: 0.1,  // Very low threshold
            maxLoopsPerRequest: 200  // High limit
          },
          security: { maxNFTsPerWallet: 1000, maxWantsPerWallet: 100 }
        }
      }, {
        headers: {
          'Authorization': `Bearer ${ADMIN_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      this.tenant = response.data.tenant;
      this.apiKey = this.tenant.apiKey || response.data.apiKey;
      
      console.log(`✅ Investigation tenant: ${this.tenant.id}`);
      console.log('');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to create tenant:', error.response?.data || error.message);
      return false;
    }
  }

  async addNFT(walletId, nftId, name, value = 1.0) {
    const timestamp = Date.now();
    console.log(`📦 [${new Date().toISOString()}] Adding NFT: ${walletId} owns ${nftId}`);
    
    try {
      const nft = {
        id: nftId,
        metadata: { name: name, symbol: nftId.toUpperCase(), description: `Investigation NFT: ${name}` },
        ownership: { ownerId: walletId, blockchain: 'solana', contractAddress: `investigate_${nftId}`, tokenId: nftId },
        valuation: { estimatedValue: value, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'investigation' }
      };

      const response = await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: walletId,
        nfts: [nft]
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });

      const responseTime = Date.now() - timestamp;
      console.log(`   ⚡ Response: ${responseTime}ms, ${response.data.newLoopsDiscovered} loops discovered`);
      
      this.discoveryEvents.push({
        type: 'nft_added',
        timestamp,
        walletId,
        nftId,
        loopsDiscovered: response.data.newLoopsDiscovered,
        responseTime
      });

      return response.data;
    } catch (error) {
      console.error(`❌ Failed to add NFT ${nftId}:`, error.response?.data || error.message);
      return { newLoopsDiscovered: 0 };
    }
  }

  async addWant(walletId, wantedNftId) {
    const timestamp = Date.now();
    console.log(`💭 [${new Date().toISOString()}] Adding want: ${walletId} wants ${wantedNftId}`);
    
    try {
      const response = await axios.post(`${BASE_URL}/wants/submit`, {
        walletId: walletId,
        wantedNFTs: [wantedNftId]
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });

      const responseTime = Date.now() - timestamp;
      console.log(`   ⚡ Response: ${responseTime}ms, ${response.data.newLoopsDiscovered} loops discovered`);
      
      this.discoveryEvents.push({
        type: 'want_added',
        timestamp,
        walletId,
        wantedNftId,
        loopsDiscovered: response.data.newLoopsDiscovered,
        responseTime,
        loopsReturned: response.data.loops || []
      });

      // If loops were discovered, let's examine them
      if (response.data.newLoopsDiscovered > 0 && response.data.loops) {
        console.log(`   🔍 Examining discovered loops:`);
        for (let i = 0; i < response.data.loops.length; i++) {
          const loop = response.data.loops[i];
          console.log(`      Loop ${i + 1}: ${loop.steps ? loop.steps.length : 'N/A'} steps, Quality: ${loop.qualityScore || 'N/A'}, ID: ${loop.id || 'N/A'}`);
          if (loop.steps) {
            const path = loop.steps.map(step => `${step.from}→${step.to}`).join(', ');
            console.log(`      Path: ${path}`);
          }
        }
      }

      return response.data;
    } catch (error) {
      console.error(`❌ Failed to add want for ${wantedNftId}:`, error.response?.data || error.message);
      return { newLoopsDiscovered: 0 };
    }
  }

  async queryTrades(walletId, detailed = false) {
    const timestamp = Date.now();
    
    try {
      const response = await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: walletId
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });

      const responseTime = Date.now() - timestamp;
      const trades = response.data.trades || [];
      
      if (detailed) {
        console.log(`🔍 [${new Date().toISOString()}] Query result for ${walletId}:`);
        console.log(`   ⚡ Response: ${responseTime}ms, ${trades.length} trades found`);
        
        if (trades.length > 0) {
          for (let i = 0; i < trades.length; i++) {
            const trade = trades[i];
            console.log(`      Trade ${i + 1}: ${trade.steps ? trade.steps.length : 'N/A'} steps, Quality: ${trade.qualityScore || 'N/A'}, ID: ${trade.id || 'N/A'}`);
            if (trade.steps) {
              const path = trade.steps.map(step => `${step.from}→${step.to}`).join(', ');
              console.log(`      Path: ${path}`);
            }
          }
        } else {
          console.log(`      ❌ No trades accessible for ${walletId}`);
        }
      }

      this.queryResults.push({
        timestamp,
        walletId,
        tradesCount: trades.length,
        trades,
        responseTime
      });

      return trades;
    } catch (error) {
      console.error(`❌ Failed to query trades for ${walletId}:`, error.response?.data || error.message);
      return [];
    }
  }

  async investigate4WayWorking() {
    console.log('🔍 STEP 1: Testing 4-Way Loop (Known Working)');
    console.log('==============================================');
    console.log('Pattern: A→B→C→D→A');
    console.log('');

    const participants = [
      { wallet: 'test4_alice', nft: 'test4_alpha', wants: 'test4_beta' },
      { wallet: 'test4_bob', nft: 'test4_beta', wants: 'test4_gamma' },
      { wallet: 'test4_charlie', nft: 'test4_gamma', wants: 'test4_delta' },
      { wallet: 'test4_david', nft: 'test4_delta', wants: 'test4_alpha' }
    ];

    // Add all NFTs
    for (const p of participants) {
      await this.addNFT(p.wallet, p.nft, `Test4 ${p.nft}`);
    }

    console.log('');
    console.log('Adding wants to complete 4-way loop:');
    
    // Add wants
    for (const p of participants) {
      await this.addWant(p.wallet, p.wants);
    }

    console.log('');
    console.log('Querying 4-way participants:');
    
    // Query all participants
    for (const p of participants) {
      await this.queryTrades(p.wallet, true);
    }

    console.log('');
  }

  async investigate5WayBroken() {
    console.log('🔍 STEP 2: Testing 5-Way Loop (Broken)');
    console.log('=======================================');
    console.log('Pattern: A→B→C→D→E→A');
    console.log('');

    const participants = [
      { wallet: 'test5_alice', nft: 'test5_alpha', wants: 'test5_beta' },
      { wallet: 'test5_bob', nft: 'test5_beta', wants: 'test5_gamma' },
      { wallet: 'test5_charlie', nft: 'test5_gamma', wants: 'test5_delta' },
      { wallet: 'test5_david', nft: 'test5_delta', wants: 'test5_epsilon' },
      { wallet: 'test5_eve', nft: 'test5_epsilon', wants: 'test5_alpha' }
    ];

    // Add all NFTs
    for (const p of participants) {
      await this.addNFT(p.wallet, p.nft, `Test5 ${p.nft}`);
    }

    console.log('');
    console.log('Adding wants to complete 5-way loop:');
    
    // Add wants step by step with detailed monitoring
    for (const p of participants) {
      console.log(`\n🎯 Adding want for ${p.wallet}:`);
      const result = await this.addWant(p.wallet, p.wants);
      
      if (result.newLoopsDiscovered > 0) {
        console.log(`   🚨 CRITICAL: ${result.newLoopsDiscovered} loops discovered! Let's check accessibility immediately:`);
        
        // Immediately check if the loops are accessible
        for (const participant of participants) {
          const trades = await this.queryTrades(participant.wallet);
          console.log(`      ${participant.wallet}: ${trades.length} trades accessible`);
        }
      }
    }

    console.log('');
    console.log('Final 5-way query check:');
    
    // Final query of all participants
    for (const p of participants) {
      await this.queryTrades(p.wallet, true);
    }

    console.log('');
  }

  async testQueryTiming() {
    console.log('🔍 STEP 3: Testing Query Timing');
    console.log('===============================');
    console.log('Hypothesis: Timing issues between discovery and query');
    console.log('');

    // Use the 5-way participants for timing tests
    const testWallets = ['test5_alice', 'test5_bob', 'test5_charlie', 'test5_david', 'test5_eve'];
    
    console.log('Testing immediate vs delayed queries:');
    
    for (const wallet of testWallets) {
      console.log(`\n🕐 Testing ${wallet}:`);
      
      // Immediate query
      const immediateStart = Date.now();
      const immediateTrades = await this.queryTrades(wallet);
      const immediateTime = Date.now() - immediateStart;
      console.log(`   Immediate: ${immediateTrades.length} trades (${immediateTime}ms)`);
      
      // Wait 2 seconds and try again
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const delayedStart = Date.now();
      const delayedTrades = await this.queryTrades(wallet);
      const delayedTime = Date.now() - delayedStart;
      console.log(`   Delayed (2s): ${delayedTrades.length} trades (${delayedTime}ms)`);
      
      if (immediateTrades.length !== delayedTrades.length) {
        console.log(`   🚨 TIMING ISSUE: Trade count changed from ${immediateTrades.length} to ${delayedTrades.length}`);
      }
    }
    
    console.log('');
  }

  async testBulkQuery() {
    console.log('🔍 STEP 4: Testing Bulk Query vs Individual');
    console.log('==========================================');
    console.log('Hypothesis: Bulk discovery might not populate individual caches');
    console.log('');

    // Try bulk discovery approach
    const bulkWallets = [
      { id: 'bulk_alice', ownedNFTs: [{ id: 'bulk_alpha', metadata: { name: 'Bulk Alpha' }, ownership: { ownerId: 'bulk_alice' }, valuation: { estimatedValue: 1.0 } }], wantedNFTs: ['bulk_beta'] },
      { id: 'bulk_bob', ownedNFTs: [{ id: 'bulk_beta', metadata: { name: 'Bulk Beta' }, ownership: { ownerId: 'bulk_bob' }, valuation: { estimatedValue: 1.0 } }], wantedNFTs: ['bulk_gamma'] },
      { id: 'bulk_charlie', ownedNFTs: [{ id: 'bulk_gamma', metadata: { name: 'Bulk Gamma' }, ownership: { ownerId: 'bulk_charlie' }, valuation: { estimatedValue: 1.0 } }], wantedNFTs: ['bulk_delta'] },
      { id: 'bulk_david', ownedNFTs: [{ id: 'bulk_delta', metadata: { name: 'Bulk Delta' }, ownership: { ownerId: 'bulk_david' }, valuation: { estimatedValue: 1.0 } }], wantedNFTs: ['bulk_epsilon'] },
      { id: 'bulk_eve', ownedNFTs: [{ id: 'bulk_epsilon', metadata: { name: 'Bulk Epsilon' }, ownership: { ownerId: 'bulk_eve' }, valuation: { estimatedValue: 1.0 } }], wantedNFTs: ['bulk_alpha'] }
    ];

    try {
      console.log('Trying bulk discovery approach:');
      const bulkResponse = await axios.post(`${BASE_URL}/discovery/trades`, {
        wallets: bulkWallets
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });

      console.log(`Bulk discovery result: ${bulkResponse.data.trades ? bulkResponse.data.trades.length : 0} trades`);
      
      // Now check individual queries
      for (const wallet of bulkWallets) {
        const individualTrades = await this.queryTrades(wallet.id);
        console.log(`   ${wallet.id}: ${individualTrades.length} trades individually`);
      }
      
    } catch (error) {
      console.log(`Bulk query failed: ${error.response?.data?.error || error.message}`);
    }
    
    console.log('');
  }

  analyzeResults() {
    console.log('📊 INVESTIGATION ANALYSIS');
    console.log('=========================');
    console.log('');

    // Analyze discovery events
    const discoveryEvents = this.discoveryEvents.filter(e => e.loopsDiscovered > 0);
    console.log(`📈 Discovery Events: ${discoveryEvents.length} events with loops discovered`);
    
    for (const event of discoveryEvents) {
      console.log(`   ${event.type}: ${event.walletId} → ${event.loopsDiscovered} loops (${event.responseTime}ms)`);
    }
    
    console.log('');
    
    // Analyze query results
    const queryEvents = this.queryResults.filter(q => q.tradesCount > 0);
    console.log(`📊 Query Events: ${queryEvents.length} queries with trades found`);
    
    for (const query of queryEvents) {
      console.log(`   Query: ${query.walletId} → ${query.tradesCount} trades (${query.responseTime}ms)`);
    }
    
    console.log('');
    
    // Compare discovery vs accessibility
    const totalLoopsDiscovered = this.discoveryEvents.reduce((sum, e) => sum + e.loopsDiscovered, 0);
    const totalTradesAccessible = this.queryResults.reduce((sum, q) => sum + q.tradesCount, 0);
    
    console.log(`🔍 SUMMARY:`);
    console.log(`   📈 Total loops discovered: ${totalLoopsDiscovered}`);
    console.log(`   📊 Total trades accessible: ${totalTradesAccessible}`);
    console.log(`   📉 Discovery-to-Access ratio: ${totalLoopsDiscovered > 0 ? (totalTradesAccessible / totalLoopsDiscovered * 100).toFixed(1) : 0}%`);
    
    if (totalLoopsDiscovered > totalTradesAccessible) {
      console.log('');
      console.log('🚨 ISSUE IDENTIFIED: Loops are being discovered but not stored/retrieved properly');
      console.log('   Possible causes:');
      console.log('   1. Cache storage issue for complex loops');
      console.log('   2. Loop ID mismatch between discovery and retrieval');
      console.log('   3. Complex loops being filtered out during storage');
      console.log('   4. Multi-step loops not being properly indexed');
      console.log('   5. Tenant isolation issue for complex scenarios');
    } else {
      console.log('');
      console.log('✅ Discovery and access rates match - no systematic issue found');
    }
  }

  async runInvestigation() {
    console.log('🚀 Starting 5+ way loop investigation...');
    console.log('');
    
    try {
      const tenantCreated = await this.createTenant();
      if (!tenantCreated) {
        throw new Error('Failed to create tenant');
      }
      
      // Run systematic investigation
      await this.investigate4WayWorking();
      await this.investigate5WayBroken();
      await this.testQueryTiming();
      await this.testBulkQuery();
      
      // Analyze all results
      this.analyzeResults();
      
    } catch (error) {
      console.error('💥 Investigation failed:', error.message);
      this.analyzeResults(); // Still analyze what we have
      process.exit(1);
    }
  }
}

// Run the investigation
const investigator = new LoopInvestigator();
investigator.runInvestigation();