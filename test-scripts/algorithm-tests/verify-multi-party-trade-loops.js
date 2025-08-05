#!/usr/bin/env node

/**
 * VERIFY MULTI-PARTY TRADE LOOPS (3+)
 * 
 * This test confirms our living persistent graph can handle complex multi-party scenarios:
 * 1. 3-way circular trades (A→B→C→A)
 * 2. 4-way circular trades (A→B→C→D→A) 
 * 3. 5-way circular trades (A→B→C→D→E→A)
 * 4. 6-way circular trades (A→B→C→D→E→F→A)
 * 5. Complex branching patterns
 * 6. Mixed scenarios with multiple loops
 * 
 * Goal: Prove the living graph can handle enterprise-scale multi-party bartering
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_URL || 'https://swaps-93hu.onrender.com/api/v1';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'swaps_admin_prod_2025_secure_key_abc123';

console.log('🔄 MULTI-PARTY TRADE LOOPS VERIFICATION');
console.log('======================================');
console.log('🎯 Testing 3-way, 4-way, 5-way, and 6-way trade loops');
console.log('🎯 Verifying living graph handles complex multi-party scenarios');
console.log('');

class MultiPartyTradeVerifier {
  constructor() {
    this.tenant = null;
    this.apiKey = null;
    this.scenarios = [];
    this.results = {
      threeWay: { attempted: 0, successful: 0, loops: [] },
      fourWay: { attempted: 0, successful: 0, loops: [] },
      fiveWay: { attempted: 0, successful: 0, loops: [] },
      sixWay: { attempted: 0, successful: 0, loops: [] },
      complex: { attempted: 0, successful: 0, loops: [] }
    };
  }

  async createTenant() {
    console.log('📝 Creating multi-party trade test tenant...');
    
    try {
      const response = await axios.post(`${BASE_URL}/admin/tenants`, {
        name: 'Multi-Party Trade Loops Test',
        contactEmail: 'multiparty@tradeloops.com',
        settings: {
          algorithm: { 
            maxDepth: 20,  // Higher for complex multi-party scenarios
            minEfficiency: 0.2,  // Lower threshold for complex trades
            maxLoopsPerRequest: 100 
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
      
      console.log(`✅ Multi-party tenant: ${this.tenant.id}`);
      console.log('');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to create tenant:', error.response?.data || error.message);
      return false;
    }
  }

  async addNFT(walletId, nftId, name, value = 1.0) {
    try {
      const nft = {
        id: nftId,
        metadata: { name: name, symbol: nftId.toUpperCase(), description: `Multi-party trade NFT: ${name}` },
        ownership: { ownerId: walletId, blockchain: 'solana', contractAddress: `contract_${nftId}`, tokenId: nftId },
        valuation: { estimatedValue: value, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'multiparty_test' }
      };

      const response = await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: walletId,
        nfts: [nft]
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });

      return response.data;
    } catch (error) {
      console.error(`❌ Failed to add NFT ${nftId}:`, error.response?.data || error.message);
      return { newLoopsDiscovered: 0 };
    }
  }

  async addWant(walletId, wantedNftId) {
    try {
      const response = await axios.post(`${BASE_URL}/wants/submit`, {
        walletId: walletId,
        wantedNFTs: [wantedNftId]
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });

      return response.data;
    } catch (error) {
      console.error(`❌ Failed to add want for ${wantedNftId}:`, error.response?.data || error.message);
      return { newLoopsDiscovered: 0 };
    }
  }

  async queryTrades(walletId) {
    try {
      const response = await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: walletId
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });

      return response.data.trades || [];
    } catch (error) {
      console.error(`❌ Failed to query trades for ${walletId}:`, error.response?.data || error.message);
      return [];
    }
  }

  async test3WayLoop() {
    console.log('🔄 Testing 3-Way Circular Trade Loop');
    console.log('    Pattern: Alice→Bob→Charlie→Alice');
    console.log('    Alice owns Alpha, wants Beta');
    console.log('    Bob owns Beta, wants Gamma');
    console.log('    Charlie owns Gamma, wants Alpha');
    console.log('');

    this.results.threeWay.attempted++;

    try {
      // Set up the 3-way scenario
      const participants = [
        { wallet: 'alice_3way', nft: 'alpha_3way', wants: 'beta_3way', name: 'Alpha Token' },
        { wallet: 'bob_3way', nft: 'beta_3way', wants: 'gamma_3way', name: 'Beta Token' },
        { wallet: 'charlie_3way', nft: 'gamma_3way', wants: 'alpha_3way', name: 'Gamma Token' }
      ];

      // Add all NFTs first
      for (const p of participants) {
        await this.addNFT(p.wallet, p.nft, p.name);
      }

      // Add wants to complete the loop
      let totalLoops = 0;
      for (const p of participants) {
        const result = await this.addWant(p.wallet, p.wants);
        totalLoops += result.newLoopsDiscovered;
        console.log(`   ${p.wallet} wants ${p.wants} → ${result.newLoopsDiscovered} loops`);
      }

      // Verify trades are available
      let foundTrades = 0;
      for (const p of participants) {
        const trades = await this.queryTrades(p.wallet);
        foundTrades += trades.length;
        
        if (trades.length > 0) {
          const trade = trades[0];
          console.log(`   ✅ ${p.wallet}: ${trades.length} trades (${trade.steps ? trade.steps.length : 'N/A'} steps, Quality: ${trade.qualityScore || 'N/A'})`);
        }
      }

      if (totalLoops > 0 && foundTrades > 0) {
        this.results.threeWay.successful++;
        this.results.threeWay.loops.push({ participants: 3, loops: totalLoops, trades: foundTrades });
        console.log('   🎉 3-Way Loop: SUCCESS');
      } else {
        console.log('   ❌ 3-Way Loop: FAILED');
      }

    } catch (error) {
      console.error('   ❌ 3-Way Loop test failed:', error.message);
    }

    console.log('');
  }

  async test4WayLoop() {
    console.log('🔄 Testing 4-Way Circular Trade Loop');
    console.log('    Pattern: Alice→Bob→Charlie→David→Alice');
    console.log('');

    this.results.fourWay.attempted++;

    try {
      const participants = [
        { wallet: 'alice_4way', nft: 'alpha_4way', wants: 'beta_4way', name: 'Alpha-4 Token' },
        { wallet: 'bob_4way', nft: 'beta_4way', wants: 'gamma_4way', name: 'Beta-4 Token' },
        { wallet: 'charlie_4way', nft: 'gamma_4way', wants: 'delta_4way', name: 'Gamma-4 Token' },
        { wallet: 'david_4way', nft: 'delta_4way', wants: 'alpha_4way', name: 'Delta-4 Token' }
      ];

      // Add all NFTs
      for (const p of participants) {
        await this.addNFT(p.wallet, p.nft, p.name);
      }

      // Add wants to complete the loop
      let totalLoops = 0;
      for (const p of participants) {
        const result = await this.addWant(p.wallet, p.wants);
        totalLoops += result.newLoopsDiscovered;
        console.log(`   ${p.wallet} wants ${p.wants} → ${result.newLoopsDiscovered} loops`);
      }

      // Verify trades
      let foundTrades = 0;
      for (const p of participants) {
        const trades = await this.queryTrades(p.wallet);
        foundTrades += trades.length;
        
        if (trades.length > 0) {
          const trade = trades[0];
          console.log(`   ✅ ${p.wallet}: ${trades.length} trades (${trade.steps ? trade.steps.length : 'N/A'} steps, Quality: ${trade.qualityScore || 'N/A'})`);
        }
      }

      if (totalLoops > 0 && foundTrades > 0) {
        this.results.fourWay.successful++;
        this.results.fourWay.loops.push({ participants: 4, loops: totalLoops, trades: foundTrades });
        console.log('   🎉 4-Way Loop: SUCCESS');
      } else {
        console.log('   ❌ 4-Way Loop: FAILED');
      }

    } catch (error) {
      console.error('   ❌ 4-Way Loop test failed:', error.message);
    }

    console.log('');
  }

  async test5WayLoop() {
    console.log('🔄 Testing 5-Way Circular Trade Loop');
    console.log('    Pattern: Alice→Bob→Charlie→David→Eve→Alice');
    console.log('');

    this.results.fiveWay.attempted++;

    try {
      const participants = [
        { wallet: 'alice_5way', nft: 'alpha_5way', wants: 'beta_5way', name: 'Alpha-5 Token' },
        { wallet: 'bob_5way', nft: 'beta_5way', wants: 'gamma_5way', name: 'Beta-5 Token' },
        { wallet: 'charlie_5way', nft: 'gamma_5way', wants: 'delta_5way', name: 'Gamma-5 Token' },
        { wallet: 'david_5way', nft: 'delta_5way', wants: 'epsilon_5way', name: 'Delta-5 Token' },
        { wallet: 'eve_5way', nft: 'epsilon_5way', wants: 'alpha_5way', name: 'Epsilon-5 Token' }
      ];

      // Add all NFTs
      for (const p of participants) {
        await this.addNFT(p.wallet, p.nft, p.name);
      }

      // Add wants to complete the loop
      let totalLoops = 0;
      for (const p of participants) {
        const result = await this.addWant(p.wallet, p.wants);
        totalLoops += result.newLoopsDiscovered;
        console.log(`   ${p.wallet} wants ${p.wants} → ${result.newLoopsDiscovered} loops`);
      }

      // Verify trades
      let foundTrades = 0;
      for (const p of participants) {
        const trades = await this.queryTrades(p.wallet);
        foundTrades += trades.length;
        
        if (trades.length > 0) {
          const trade = trades[0];
          console.log(`   ✅ ${p.wallet}: ${trades.length} trades (${trade.steps ? trade.steps.length : 'N/A'} steps, Quality: ${trade.qualityScore || 'N/A'})`);
        }
      }

      if (totalLoops > 0 && foundTrades > 0) {
        this.results.fiveWay.successful++;
        this.results.fiveWay.loops.push({ participants: 5, loops: totalLoops, trades: foundTrades });
        console.log('   🎉 5-Way Loop: SUCCESS');
      } else {
        console.log('   ❌ 5-Way Loop: FAILED');
      }

    } catch (error) {
      console.error('   ❌ 5-Way Loop test failed:', error.message);
    }

    console.log('');
  }

  async test6WayLoop() {
    console.log('🔄 Testing 6-Way Circular Trade Loop');
    console.log('    Pattern: Alice→Bob→Charlie→David→Eve→Frank→Alice');
    console.log('');

    this.results.sixWay.attempted++;

    try {
      const participants = [
        { wallet: 'alice_6way', nft: 'alpha_6way', wants: 'beta_6way', name: 'Alpha-6 Token' },
        { wallet: 'bob_6way', nft: 'beta_6way', wants: 'gamma_6way', name: 'Beta-6 Token' },
        { wallet: 'charlie_6way', nft: 'gamma_6way', wants: 'delta_6way', name: 'Gamma-6 Token' },
        { wallet: 'david_6way', nft: 'delta_6way', wants: 'epsilon_6way', name: 'Delta-6 Token' },
        { wallet: 'eve_6way', nft: 'epsilon_6way', wants: 'zeta_6way', name: 'Epsilon-6 Token' },
        { wallet: 'frank_6way', nft: 'zeta_6way', wants: 'alpha_6way', name: 'Zeta-6 Token' }
      ];

      // Add all NFTs
      for (const p of participants) {
        await this.addNFT(p.wallet, p.nft, p.name);
      }

      // Add wants to complete the loop
      let totalLoops = 0;
      for (const p of participants) {
        const result = await this.addWant(p.wallet, p.wants);
        totalLoops += result.newLoopsDiscovered;
        console.log(`   ${p.wallet} wants ${p.wants} → ${result.newLoopsDiscovered} loops`);
      }

      // Verify trades
      let foundTrades = 0;
      for (const p of participants) {
        const trades = await this.queryTrades(p.wallet);
        foundTrades += trades.length;
        
        if (trades.length > 0) {
          const trade = trades[0];
          console.log(`   ✅ ${p.wallet}: ${trades.length} trades (${trade.steps ? trade.steps.length : 'N/A'} steps, Quality: ${trade.qualityScore || 'N/A'})`);
        }
      }

      if (totalLoops > 0 && foundTrades > 0) {
        this.results.sixWay.successful++;
        this.results.sixWay.loops.push({ participants: 6, loops: totalLoops, trades: foundTrades });
        console.log('   🎉 6-Way Loop: SUCCESS');
      } else {
        console.log('   ❌ 6-Way Loop: FAILED');
      }

    } catch (error) {
      console.error('   ❌ 6-Way Loop test failed:', error.message);
    }

    console.log('');
  }

  async testComplexMultiLoop() {
    console.log('🔄 Testing Complex Multi-Loop Scenario');
    console.log('    Multiple overlapping trade opportunities');
    console.log('    Testing sophisticated algorithm capabilities');
    console.log('');

    this.results.complex.attempted++;

    try {
      // Create a complex scenario with multiple possible loops
      const participants = [
        // First potential loop: A→B→C→A
        { wallet: 'complex_alice', nft: 'complex_alpha', wants: 'complex_beta', name: 'Complex Alpha' },
        { wallet: 'complex_bob', nft: 'complex_beta', wants: 'complex_gamma', name: 'Complex Beta' },
        { wallet: 'complex_charlie', nft: 'complex_gamma', wants: 'complex_alpha', name: 'Complex Gamma' },
        
        // Second potential loop: D→E→F→D  
        { wallet: 'complex_david', nft: 'complex_delta', wants: 'complex_epsilon', name: 'Complex Delta' },
        { wallet: 'complex_eve', nft: 'complex_epsilon', wants: 'complex_zeta', name: 'Complex Epsilon' },
        { wallet: 'complex_frank', nft: 'complex_zeta', wants: 'complex_delta', name: 'Complex Zeta' },
        
        // Cross-loop connections for complexity
        { wallet: 'complex_grace', nft: 'complex_eta', wants: 'complex_alpha', name: 'Complex Eta' },
        { wallet: 'complex_henry', nft: 'complex_theta', wants: 'complex_delta', name: 'Complex Theta' }
      ];

      // Add all NFTs
      for (const p of participants) {
        await this.addNFT(p.wallet, p.nft, p.name);
      }

      // Add wants to create complex patterns
      let totalLoops = 0;
      for (const p of participants) {
        const result = await this.addWant(p.wallet, p.wants);
        totalLoops += result.newLoopsDiscovered;
        if (result.newLoopsDiscovered > 0) {
          console.log(`   ${p.wallet} wants ${p.wants} → ${result.newLoopsDiscovered} loops discovered!`);
        }
      }

      // Verify trades across all participants
      let foundTrades = 0;
      let participantsWithTrades = 0;
      for (const p of participants) {
        const trades = await this.queryTrades(p.wallet);
        if (trades.length > 0) {
          foundTrades += trades.length;
          participantsWithTrades++;
          const trade = trades[0];
          console.log(`   ✅ ${p.wallet}: ${trades.length} trades (${trade.steps ? trade.steps.length : 'N/A'} steps)`);
        }
      }

      if (totalLoops > 0 && foundTrades > 0) {
        this.results.complex.successful++;
        this.results.complex.loops.push({ 
          participants: participants.length, 
          loops: totalLoops, 
          trades: foundTrades,
          participantsWithTrades 
        });
        console.log(`   🎉 Complex Multi-Loop: SUCCESS (${participantsWithTrades}/${participants.length} participants have trades)`);
      } else {
        console.log('   ❌ Complex Multi-Loop: FAILED');
      }

    } catch (error) {
      console.error('   ❌ Complex Multi-Loop test failed:', error.message);
    }

    console.log('');
  }

  printResults() {
    console.log('📊 MULTI-PARTY TRADE LOOPS RESULTS');
    console.log('==================================');
    console.log('');

    const categories = [
      { name: '3-Way Loops', key: 'threeWay' },
      { name: '4-Way Loops', key: 'fourWay' },
      { name: '5-Way Loops', key: 'fiveWay' },
      { name: '6-Way Loops', key: 'sixWay' },
      { name: 'Complex Multi-Loop', key: 'complex' }
    ];

    let totalAttempted = 0;
    let totalSuccessful = 0;

    for (const category of categories) {
      const result = this.results[category.key];
      totalAttempted += result.attempted;
      totalSuccessful += result.successful;
      
      const successRate = result.attempted > 0 ? (result.successful / result.attempted * 100).toFixed(1) : '0.0';
      const status = result.successful > 0 ? '✅' : '❌';
      
      console.log(`${status} ${category.name}: ${result.successful}/${result.attempted} (${successRate}%)`);
      
      if (result.loops.length > 0) {
        for (const loop of result.loops) {
          console.log(`   📈 ${loop.participants} participants → ${loop.loops} loops discovered, ${loop.trades} trades available`);
        }
      }
    }

    console.log('');
    const overallRate = totalAttempted > 0 ? (totalSuccessful / totalAttempted * 100).toFixed(1) : '0.0';
    console.log(`🏆 OVERALL SUCCESS RATE: ${totalSuccessful}/${totalAttempted} (${overallRate}%)`);
    
    console.log('');
    console.log('🧮 ALGORITHM SOPHISTICATION ASSESSMENT:');
    
    if (this.results.sixWay.successful > 0) {
      console.log('✅ EXCELLENT: 6-way loops working - highest sophistication achieved');
    } else if (this.results.fiveWay.successful > 0) {
      console.log('✅ VERY GOOD: 5-way loops working - high sophistication');
    } else if (this.results.fourWay.successful > 0) {
      console.log('✅ GOOD: 4-way loops working - solid sophistication');
    } else if (this.results.threeWay.successful > 0) {
      console.log('✅ BASIC: 3-way loops working - fundamental multi-party capability');
    } else {
      console.log('❌ POOR: Multi-party loops not functioning properly');
    }
    
    if (totalSuccessful >= 4) {
      console.log('🚀 ENTERPRISE READY: Multi-party trade loops fully operational');
      console.log('🎯 System capable of complex multi-party bartering scenarios');
    } else if (totalSuccessful >= 2) {
      console.log('⚠️  PARTIALLY READY: Some multi-party scenarios working');
      console.log('🔧 Consider optimization for complex scenarios');
    } else {
      console.log('❌ NOT READY: Multi-party capabilities need significant work');
      console.log('🛠️  Major improvements required before enterprise deployment');
    }
  }

  async runVerification() {
    console.log('🚀 Starting multi-party trade loops verification...');
    console.log('');
    
    try {
      const tenantCreated = await this.createTenant();
      if (!tenantCreated) {
        throw new Error('Failed to create tenant');
      }
      
      // Run all multi-party tests
      await this.test3WayLoop();
      await this.test4WayLoop();
      await this.test5WayLoop();
      await this.test6WayLoop();
      await this.testComplexMultiLoop();
      
      // Print comprehensive results
      this.printResults();
      
    } catch (error) {
      console.error('💥 Multi-party verification failed:', error.message);
      process.exit(1);
    }
  }
}

// Run the multi-party trade verification
const verifier = new MultiPartyTradeVerifier();
verifier.runVerification();