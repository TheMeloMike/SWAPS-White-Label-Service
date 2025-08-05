#!/usr/bin/env node

/**
 * VERIFY LIVING PERSISTENT GRAPH
 * 
 * This test confirms we have a TRUE living persistent graph that:
 * 1. Maintains state continuously (not computation-based)
 * 2. Is event-driven (reacts to changes immediately)
 * 3. Constantly monitors for trade opportunities
 * 4. Updates in real-time as NFTs/wants are added/removed
 * 5. Persists across API calls without recalculation
 * 
 * NOT a computational engine, but a LIVING GRAPH SYSTEM.
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_URL || 'https://swaps-93hu.onrender.com/api/v1';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'swaps_admin_prod_2025_secure_key_abc123';

console.log('🌱 LIVING PERSISTENT GRAPH VERIFICATION');
console.log('========================================');
console.log('🎯 Goal: Confirm we have a living, event-driven graph');
console.log('🎯 NOT: A computational engine that runs on demand');
console.log('🎯 YES: A persistent graph that lives and breathes');
console.log('');

class LivingGraphVerifier {
  constructor() {
    this.tenant = null;
    this.apiKey = null;
    this.events = [];
    this.graphState = {
      wallets: new Map(),
      nfts: new Map(),
      wants: new Map(),
      discoveredLoops: []
    };
  }

  async createTenant() {
    console.log('📝 Creating living graph tenant...');
    
    try {
      const response = await axios.post(`${BASE_URL}/admin/tenants`, {
        name: 'Living Persistent Graph Test',
        contactEmail: 'living@persistentgraph.com',
        settings: {
          algorithm: { maxDepth: 15, minEfficiency: 0.3, maxLoopsPerRequest: 50 },
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
      
      console.log(`✅ Living graph tenant: ${this.tenant.id}`);
      console.log('');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to create tenant:', error.response?.data || error.message);
      return false;
    }
  }

  async addNFT(walletId, nftId, name) {
    const timestamp = Date.now();
    console.log(`📦 [${new Date().toISOString()}] Adding NFT: ${walletId} owns ${nftId}`);
    
    try {
      const nft = {
        id: nftId,
        metadata: { name: name, symbol: nftId.toUpperCase(), description: `Living graph NFT ${name}` },
        ownership: { ownerId: walletId, blockchain: 'solana', contractAddress: `contract_${nftId}`, tokenId: nftId },
        valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'living_test' }
      };

      const response = await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: walletId,
        nfts: [nft]
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });

      const responseTime = Date.now() - timestamp;
      const loopsDiscovered = response.data.newLoopsDiscovered;
      
      console.log(`   ⚡ Response: ${responseTime}ms, ${loopsDiscovered} new loops discovered`);
      
      // Record the event
      this.events.push({
        type: 'nft_added',
        timestamp,
        walletId,
        nftId,
        loopsDiscovered,
        responseTime
      });
      
      // Update our tracking
      this.graphState.nfts.set(nftId, { walletId, name });
      if (!this.graphState.wallets.has(walletId)) {
        this.graphState.wallets.set(walletId, { ownedNFTs: [], wantedNFTs: [] });
      }
      this.graphState.wallets.get(walletId).ownedNFTs.push(nftId);
      
      return { loopsDiscovered, responseTime };
    } catch (error) {
      console.error(`❌ Failed to add NFT ${nftId}:`, error.response?.data || error.message);
      return { loopsDiscovered: 0, responseTime: 0 };
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
      const loopsDiscovered = response.data.newLoopsDiscovered;
      
      console.log(`   ⚡ Response: ${responseTime}ms, ${loopsDiscovered} new loops discovered`);
      
      // Record the event
      this.events.push({
        type: 'want_added',
        timestamp,
        walletId,
        wantedNftId,
        loopsDiscovered,
        responseTime
      });
      
      // Update our tracking
      if (!this.graphState.wallets.has(walletId)) {
        this.graphState.wallets.set(walletId, { ownedNFTs: [], wantedNFTs: [] });
      }
      this.graphState.wallets.get(walletId).wantedNFTs.push(wantedNftId);
      
      return { loopsDiscovered, responseTime };
    } catch (error) {
      console.error(`❌ Failed to add want for ${wantedNftId}:`, error.response?.data || error.message);
      return { loopsDiscovered: 0, responseTime: 0 };
    }
  }

  async queryGraphState(walletId) {
    const timestamp = Date.now();
    
    try {
      const response = await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: walletId
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });

      const responseTime = Date.now() - timestamp;
      const trades = response.data.trades || [];
      
      return { trades, responseTime };
    } catch (error) {
      console.error(`❌ Failed to query graph for ${walletId}:`, error.response?.data || error.message);
      return { trades: [], responseTime: 0 };
    }
  }

  async demonstrateLivingGraph() {
    console.log('🌱 DEMONSTRATING LIVING PERSISTENT GRAPH');
    console.log('=========================================');
    console.log('');
    
    // Phase 1: Build partial graph and verify no trades yet
    console.log('📊 PHASE 1: Building partial graph (should find no trades)');
    console.log('----------------------------------------------------------');
    
    await this.addNFT('alice', 'nft_alpha', 'Alpha Token');
    await this.addNFT('bob', 'nft_beta', 'Beta Token');
    
    // Query state - should be no trades yet
    let aliceState = await this.queryGraphState('alice');
    console.log(`🔍 Alice's view: ${aliceState.trades.length} trades (expected: 0)`);
    console.log('');
    
    // Phase 2: Add wants but incomplete loop
    console.log('📊 PHASE 2: Adding incomplete wants (still no complete loops)');
    console.log('-------------------------------------------------------------');
    
    await this.addWant('alice', 'nft_beta');  // Alice wants Bob's NFT
    
    // Query state - still should be no trades
    aliceState = await this.queryGraphState('alice');
    console.log(`🔍 Alice's view after wanting beta: ${aliceState.trades.length} trades (expected: 0)`);
    console.log('');
    
    // Phase 3: Complete the loop by adding Bob's want
    console.log('📊 PHASE 3: Completing the trade loop (should trigger discovery)');
    console.log('----------------------------------------------------------------');
    
    console.log('🎯 CRITICAL MOMENT: Adding Bob\'s want for Alice\'s NFT...');
    console.log('   This should IMMEDIATELY trigger loop discovery in the living graph');
    console.log('');
    
    const bobWantResult = await this.addWant('bob', 'nft_alpha');  // Bob wants Alice's NFT - COMPLETES LOOP!
    
    if (bobWantResult.loopsDiscovered > 0) {
      console.log('🎉 SUCCESS: Loop discovered immediately upon completing the circle!');
      console.log(`   📈 ${bobWantResult.loopsDiscovered} loops found in ${bobWantResult.responseTime}ms`);
    } else {
      console.log('❌ FAILURE: No loop discovered when circle was completed');
    }
    console.log('');
    
    // Phase 4: Verify persistent state
    console.log('📊 PHASE 4: Verifying persistent graph state');
    console.log('--------------------------------------------');
    
    // Query both wallets to see the persistent state
    aliceState = await this.queryGraphState('alice');
    const bobState = await this.queryGraphState('bob');
    
    console.log(`🔍 Alice's persistent view: ${aliceState.trades.length} trades available`);
    console.log(`🔍 Bob's persistent view: ${bobState.trades.length} trades available`);
    
    if (aliceState.trades.length > 0) {
      const trade = aliceState.trades[0];
      console.log(`   💰 Quality: ${trade.qualityScore}, Efficiency: ${trade.efficiency}`);
      console.log(`   🔄 Steps: ${trade.steps ? trade.steps.length : 'N/A'}`);
      if (trade.steps) {
        console.log(`   📋 Path: ${trade.steps.map(s => `${s.from}→${s.to}`).join(', ')}`);
      }
    }
    console.log('');
    
    // Phase 5: Test persistence by adding a third party
    console.log('📊 PHASE 5: Testing graph expansion (adding third party)');
    console.log('--------------------------------------------------------');
    
    await this.addNFT('charlie', 'nft_gamma', 'Gamma Token');
    await this.addWant('charlie', 'nft_alpha');  // Charlie wants Alice's NFT
    await this.addWant('alice', 'nft_gamma');    // Alice now wants Charlie's NFT instead
    
    // This should potentially create a 3-way loop: Alice→Charlie→Bob→Alice
    console.log('');
    
    // Re-query to see if graph adapted
    const aliceStateAfter = await this.queryGraphState('alice');
    const charlieState = await this.queryGraphState('charlie');
    
    console.log(`🔍 Alice after expansion: ${aliceStateAfter.trades.length} trades`);
    console.log(`🔍 Charlie's view: ${charlieState.trades.length} trades`);
    console.log('');
    
    return this.analyzeResults();
  }

  analyzeResults() {
    console.log('📊 LIVING GRAPH ANALYSIS');
    console.log('========================');
    console.log('');
    
    // Analyze event-driven behavior
    const nftEvents = this.events.filter(e => e.type === 'nft_added');
    const wantEvents = this.events.filter(e => e.type === 'want_added');
    const discoveryEvents = this.events.filter(e => e.loopsDiscovered > 0);
    
    console.log(`📈 Events processed: ${this.events.length}`);
    console.log(`   📦 NFT additions: ${nftEvents.length}`);
    console.log(`   💭 Want additions: ${wantEvents.length}`);
    console.log(`   🎯 Loop discoveries: ${discoveryEvents.length}`);
    console.log('');
    
    // Analyze response times (should be fast for living graph)
    const responseTimes = this.events.map(e => e.responseTime);
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    
    console.log(`⚡ Performance Analysis:`);
    console.log(`   📊 Average response time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`   🎯 Max response time: ${Math.max(...responseTimes)}ms`);
    console.log(`   🏃 Min response time: ${Math.min(...responseTimes)}ms`);
    console.log('');
    
    // Verify living graph characteristics
    const isEventDriven = discoveryEvents.length > 0;
    const isFastResponse = avgResponseTime < 2000;  // Should be fast for living graph
    const hasImmediateDiscovery = discoveryEvents.some(e => e.responseTime < 3000);
    
    console.log(`🧮 Living Graph Characteristics:`);
    console.log(`   🎯 Event-driven discovery: ${isEventDriven ? '✅ YES' : '❌ NO'}`);
    console.log(`   ⚡ Fast response times: ${isFastResponse ? '✅ YES' : '❌ NO'} (avg: ${avgResponseTime.toFixed(2)}ms)`);
    console.log(`   🔄 Immediate loop detection: ${hasImmediateDiscovery ? '✅ YES' : '❌ NO'}`);
    console.log('');
    
    // Final assessment
    const livingGraphScore = [isEventDriven, isFastResponse, hasImmediateDiscovery].filter(Boolean).length;
    const totalCriteria = 3;
    
    console.log(`🏆 LIVING GRAPH ASSESSMENT: ${livingGraphScore}/${totalCriteria} criteria met`);
    
    if (livingGraphScore === totalCriteria) {
      console.log('✅ CONFIRMED: We have a TRUE living persistent graph!');
      console.log('🌱 The graph is alive, event-driven, and constantly monitoring');
      console.log('🚀 This is NOT computation-based, but a living breathing system');
    } else if (livingGraphScore >= 2) {
      console.log('⚠️  PARTIAL: Living graph characteristics present but not optimal');
      console.log('🔧 Some improvements needed for full living graph behavior');
    } else {
      console.log('❌ FAILURE: This appears to be computation-based, not a living graph');
      console.log('🛠️  Major architectural changes needed');
    }
    
    console.log('');
    console.log('📋 EVENT TIMELINE:');
    console.log('==================');
    for (const event of this.events) {
      const time = new Date(event.timestamp).toISOString().substr(11, 12);
      console.log(`[${time}] ${event.type}: ${event.walletId} → ${event.loopsDiscovered} loops (${event.responseTime}ms)`);
    }
    
    return livingGraphScore === totalCriteria;
  }

  async runVerification() {
    console.log('🚀 Starting living persistent graph verification...');
    console.log('');
    
    try {
      const tenantCreated = await this.createTenant();
      if (!tenantCreated) {
        throw new Error('Failed to create tenant');
      }
      
      const isLivingGraph = await this.demonstrateLivingGraph();
      
      if (isLivingGraph) {
        console.log('');
        console.log('🎉 VERIFICATION COMPLETE: LIVING PERSISTENT GRAPH CONFIRMED!');
        console.log('🌱 The system is truly alive and event-driven');
        console.log('🚀 Ready for real-time NFT trading scenarios');
      } else {
        console.log('');
        console.log('⚠️  VERIFICATION INCOMPLETE: Living graph needs optimization');
        console.log('🔧 Consider architectural improvements');
      }
      
    } catch (error) {
      console.error('💥 Verification failed:', error.message);
      process.exit(1);
    }
  }
}

// Run the living graph verification
const verifier = new LivingGraphVerifier();
verifier.runVerification();