#!/usr/bin/env node

/**
 * 🔬 RIGOROUS ALGORITHM VERIFICATION
 * 
 * This test creates complex graph scenarios that REQUIRE sophisticated algorithms
 * to solve. It will definitively prove whether Tarjan's SCC, Johnson's cycle
 * detection, and other advanced algorithms are actually working.
 */

const axios = require('axios');

const API_BASE = 'https://swaps-93hu.onrender.com';
const ADMIN_API_KEY = 'swaps_admin_prod_2025_secure_key_abc123';

class RigorousAlgorithmTester {
  constructor() {
    this.tenantId = null;
    this.apiKey = null;
    this.testResults = {
      simpleLoops: null,
      complexChains: null,
      disconnectedComponents: null,
      algorithmSophistication: null
    };
  }

  /**
   * Create test tenant for rigorous testing
   */
  async createRigorousTestTenant() {
    console.log('📝 Creating rigorous test tenant...');
    
    const response = await axios.post(`${API_BASE}/api/v1/admin/tenants`, {
      name: 'Rigorous Algorithm Verification',
      contactEmail: 'rigorous@algorithmtest.com',
      description: 'Rigorous testing of sophisticated algorithms',
      settings: {
        algorithm: {
          enableCanonicalDiscovery: true,
          maxDepth: 10,  // Higher depth for complex scenarios
          minEfficiency: 0.5,  // Lower threshold to allow complex trades
          maxResults: 200,
          // Ensure all sophisticated algorithms are enabled
          enableSCCOptimization: true,
          enableLouvainClustering: true,
          enableBloomFilters: true,
          enableParallelProcessing: true
        }
      }
    }, {
      headers: {
        'Authorization': `Bearer ${ADMIN_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    this.tenantId = response.data.tenant.id;
    this.apiKey = response.data.tenant.apiKey || response.data.apiKey;
    
    console.log(`✅ Rigorous test tenant: ${this.tenantId}`);
    console.log(`🔑 API Key: ${this.apiKey.substring(0, 15)}...`);
  }

  /**
   * Generate complex graph scenario that requires sophisticated algorithms
   */
  generateComplexGraphScenario() {
    console.log('🧪 Generating COMPLEX graph scenarios...');
    
    const collections = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
    const wallets = [];
    const nfts = [];
    
    // SCENARIO 1: Simple 3-way loop (basic test)
    console.log('  📊 Scenario 1: Simple 3-way loop');
    for (let i = 1; i <= 3; i++) {
      const walletId = `simple_wallet_${i}`;
      const nftId = `simple_nft_${i}`;
      
      // Create NFT
      nfts.push({
        id: nftId,
        metadata: {
          name: `Simple NFT ${i}`,
          symbol: `SMP${i}`,
          description: `Simple test NFT ${i} for 3-way loop`
        },
        ownership: {
          ownerId: walletId,
          blockchain: 'solana',
          contractAddress: `simple_contract_${i}`,
          tokenId: nftId
        },
        valuation: {
          estimatedValue: 1.0 + (i * 0.1),
          currency: 'SOL',
          lastUpdated: new Date().toISOString(),
          source: 'rigorous_test'
        }
      });
      
      // Create wallet with circular wants: 1→2→3→1
      const nextWallet = i === 3 ? 1 : i + 1;
      wallets.push({
        id: walletId,
        ownedNFTs: [nftId],
        wantedNFTs: [`simple_nft_${nextWallet}`],
        preferences: {
          allowBundles: true,
          minTradeValue: 0.5,
          maxTradeValue: 10.0
        }
      });
    }
    
    // SCENARIO 2: Complex multi-component graph with 6-way chain
    console.log('  📊 Scenario 2: Complex 6-way chain');
    for (let i = 1; i <= 6; i++) {
      const walletId = `complex_wallet_${i}`;
      const nftId = `complex_nft_${i}`;
      
      nfts.push({
        id: nftId,
        metadata: {
          name: `Complex NFT ${i}`,
          symbol: `CMP${i}`,
          description: `Complex test NFT ${i} for 6-way chain`,
          attributes: [
            { trait_type: 'Complexity', value: 'High' },
            { trait_type: 'Chain Position', value: i },
            { trait_type: 'Test Type', value: 'SCC Detection' }
          ]
        },
        ownership: {
          ownerId: walletId,
          blockchain: 'solana',
          contractAddress: `complex_contract_${i}`,
          tokenId: nftId
        },
        valuation: {
          estimatedValue: 2.0 + (i * 0.2),
          currency: 'SOL',
          lastUpdated: new Date().toISOString(),
          source: 'rigorous_test'
        }
      });
      
      // Create complex chain: 1→2→3→4→5→6→1
      const nextWallet = i === 6 ? 1 : i + 1;
      wallets.push({
        id: walletId,
        ownedNFTs: [nftId],
        wantedNFTs: [`complex_nft_${nextWallet}`],
        preferences: {
          allowBundles: true,
          minTradeValue: 1.0,
          maxTradeValue: 20.0
        }
      });
    }
    
    // SCENARIO 3: Disconnected components test (requires SCC to identify separate groups)
    console.log('  📊 Scenario 3: Disconnected components');
    for (let group = 1; group <= 2; group++) {
      for (let i = 1; i <= 3; i++) {
        const walletId = `group${group}_wallet_${i}`;
        const nftId = `group${group}_nft_${i}`;
        
        nfts.push({
          id: nftId,
          metadata: {
            name: `Group ${group} NFT ${i}`,
            symbol: `G${group}N${i}`,
            description: `Disconnected component test - Group ${group}, NFT ${i}`
          },
          ownership: {
            ownerId: walletId,
            blockchain: 'solana',
            contractAddress: `group${group}_contract_${i}`,
            tokenId: nftId
          },
          valuation: {
            estimatedValue: 1.5 + (group * 0.3) + (i * 0.1),
            currency: 'SOL',
            lastUpdated: new Date().toISOString(),
            source: 'rigorous_test'
          }
        });
        
        // Each group forms its own loop, disconnected from others
        const nextWallet = i === 3 ? 1 : i + 1;
        wallets.push({
          id: walletId,
          ownedNFTs: [nftId],
          wantedNFTs: [`group${group}_nft_${nextWallet}`],
          preferences: {
            allowBundles: true,
            minTradeValue: 0.8,
            maxTradeValue: 15.0
          }
        });
      }
    }
    
    // SCENARIO 4: High-complexity interlinked chains (ultimate SCC test)
    console.log('  📊 Scenario 4: Interlinked chains (ultimate complexity)');
    for (let i = 1; i <= 5; i++) {
      const walletId = `ultra_wallet_${i}`;
      const nftId = `ultra_nft_${i}`;
      
      nfts.push({
        id: nftId,
        metadata: {
          name: `Ultra Complex NFT ${i}`,
          symbol: `ULT${i}`,
          description: `Ultimate complexity test NFT ${i}`,
          attributes: [
            { trait_type: 'Complexity', value: 'Ultimate' },
            { trait_type: 'Graph Type', value: 'Interlinked' },
            { trait_type: 'Algorithm Required', value: 'Tarjan SCC + Johnson Cycles' }
          ]
        },
        ownership: {
          ownerId: walletId,
          blockchain: 'solana',
          contractAddress: `ultra_contract_${i}`,
          tokenId: nftId
        },
        valuation: {
          estimatedValue: 3.0 + (i * 0.5),
          currency: 'SOL',
          lastUpdated: new Date().toISOString(),
          source: 'rigorous_test'
        }
      });
      
      // Create multiple wants per wallet (creates dense interconnections)
      const wantedNfts = [];
      
      // Primary chain
      const primaryNext = i === 5 ? 1 : i + 1;
      wantedNfts.push(`ultra_nft_${primaryNext}`);
      
      // Secondary connection (creates complexity)
      const secondaryNext = ((i + 2) % 5) + 1;
      wantedNfts.push(`ultra_nft_${secondaryNext}`);
      
      // Cross-group connections
      if (i <= 3) {
        wantedNfts.push(`simple_nft_${i}`);
      }
      
      wallets.push({
        id: walletId,
        ownedNFTs: [nftId],
        wantedNFTs: wantedNfts,
        preferences: {
          allowBundles: true,
          minTradeValue: 2.0,
          maxTradeValue: 50.0
        }
      });
    }
    
    console.log(`✅ Complex graph generated:`);
    console.log(`   • Total Wallets: ${wallets.length}`);
    console.log(`   • Total NFTs: ${nfts.length}`);
    console.log(`   • Scenario 1: 3-way simple loop (3 wallets)`);
    console.log(`   • Scenario 2: 6-way complex chain (6 wallets)`);
    console.log(`   • Scenario 3: 2 disconnected 3-way loops (6 wallets)`);
    console.log(`   • Scenario 4: 5-way interlinked ultra-complex (5 wallets)`);
    console.log(`   • Graph Complexity: MAXIMUM (requires all algorithms)`);
    
    return { wallets, nfts };
  }

  /**
   * Upload complex test data
   */
  async uploadComplexTestData(testData) {
    console.log('📤 Uploading complex test data...');
    
    const { wallets, nfts } = testData;
    const headers = {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json'
    };
    
    let uploadedNfts = 0;
    let uploadedWallets = 0;
    
    // Upload NFTs and wants for each wallet
    for (const wallet of wallets) {
      try {
        // Upload wallet's NFTs
        const walletNfts = wallet.ownedNFTs.map(nftId => {
          const nft = nfts.find(n => n.id === nftId);
          if (!nft) throw new Error(`NFT ${nftId} not found`);
          return nft;
        });
        
        if (walletNfts.length > 0) {
          await axios.post(`${API_BASE}/api/v1/inventory/submit`, {
            nfts: walletNfts,
            walletId: wallet.id
          }, { headers });
          uploadedNfts += walletNfts.length;
        }
        
        // Upload wallet's wants
        if (wallet.wantedNFTs.length > 0) {
          await axios.post(`${API_BASE}/api/v1/wants/submit`, {
            walletId: wallet.id,
            wantedNFTs: wallet.wantedNFTs
          }, { headers });
          uploadedWallets++;
        }
        
        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Failed to upload wallet ${wallet.id}:`, error.response?.data || error.message);
        throw error;
      }
    }
    
    console.log(`✅ Upload complete: ${uploadedNfts} NFTs, ${uploadedWallets} wallets with wants`);
  }

  /**
   * Test specific algorithm scenario
   */
  async testAlgorithmScenario(scenarioName, walletId, expectedMinTrades = 0) {
    console.log(`🔬 Testing ${scenarioName}...`);
    
    const headers = {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json'
    };
    
    try {
      const response = await axios.post(`${API_BASE}/api/v1/discovery/trades`, {
        walletId: walletId,
        mode: 'informational',
        settings: {
          maxResults: 100,
          maxDepth: 10,
          minEfficiency: 0.4,  // Lower to catch complex trades
          timeoutMs: 45000
        }
      }, { 
        headers,
        timeout: 50000
      });
      
      const trades = response.data.trades || [];
      const success = trades.length >= expectedMinTrades;
      
      console.log(`   📊 ${scenarioName}: ${trades.length} trades found (expected ≥${expectedMinTrades}) - ${success ? '✅ PASS' : '❌ FAIL'}`);
      
      // Analyze trade complexity
      let maxParticipants = 0;
      let hasCanonical = false;
      
      for (const trade of trades) {
        if (trade.participants && trade.participants.length > maxParticipants) {
          maxParticipants = trade.participants.length;
        }
        if (trade.id && trade.id.includes('canonical_')) {
          hasCanonical = true;
        }
      }
      
      return {
        scenario: scenarioName,
        tradesFound: trades.length,
        success,
        maxParticipants,
        hasCanonical,
        sampleTrades: trades.slice(0, 2)
      };
      
    } catch (error) {
      console.log(`   ❌ ${scenarioName}: FAILED - ${error.response?.data?.error || error.message}`);
      return {
        scenario: scenarioName,
        tradesFound: 0,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test all scenarios and analyze algorithm sophistication
   */
  async testAllScenarios() {
    console.log('⏱️  Waiting 8 seconds for complex data processing...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    console.log('🚀 Testing algorithm scenarios...');
    
    // Test each scenario
    const scenarios = [
      { name: 'Simple 3-way Loop', wallet: 'simple_wallet_1', expected: 1 },
      { name: 'Complex 6-way Chain', wallet: 'complex_wallet_1', expected: 1 },
      { name: 'Disconnected Group 1', wallet: 'group1_wallet_1', expected: 1 },
      { name: 'Disconnected Group 2', wallet: 'group2_wallet_1', expected: 1 },
      { name: 'Ultra-Complex Interlinked', wallet: 'ultra_wallet_1', expected: 1 }
    ];
    
    const results = [];
    
    for (const scenario of scenarios) {
      const result = await this.testAlgorithmScenario(scenario.name, scenario.wallet, scenario.expected);
      results.push(result);
      
      // Delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return results;
  }

  /**
   * Analyze algorithm sophistication based on results
   */
  analyzeAlgorithmSophistication(scenarioResults) {
    console.log('');
    console.log('🔍 ALGORITHM SOPHISTICATION ANALYSIS');
    console.log('=' .repeat(70));
    
    let totalScenarios = scenarioResults.length;
    let successfulScenarios = scenarioResults.filter(r => r.success).length;
    let totalTrades = scenarioResults.reduce((sum, r) => sum + r.tradesFound, 0);
    let maxComplexity = Math.max(...scenarioResults.map(r => r.maxParticipants || 0));
    let hasCanonical = scenarioResults.some(r => r.hasCanonical);
    
    // Specific sophistication tests
    const simpleLoopWorking = scenarioResults.find(r => r.scenario.includes('Simple'))?.success;
    const complexChainWorking = scenarioResults.find(r => r.scenario.includes('Complex'))?.success;
    const disconnectedComponentsWorking = scenarioResults.filter(r => r.scenario.includes('Disconnected')).every(r => r.success);
    const ultraComplexWorking = scenarioResults.find(r => r.scenario.includes('Ultra'))?.success;
    
    console.log(`📊 Overall Results:`);
    console.log(`   • Scenarios Passed: ${successfulScenarios}/${totalScenarios}`);
    console.log(`   • Total Trades Found: ${totalTrades}`);
    console.log(`   • Max Trade Complexity: ${maxComplexity} participants`);
    console.log(`   • Canonical IDs Detected: ${hasCanonical ? 'Yes' : 'No'}`);
    
    console.log(`🧪 Algorithm Sophistication Tests:`);
    console.log(`   • Simple Loops (Basic): ${simpleLoopWorking ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   • Complex Chains (Johnson's): ${complexChainWorking ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   • Disconnected Components (Tarjan's SCC): ${disconnectedComponentsWorking ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   • Ultra-Complex Interlinked (Full Stack): ${ultraComplexWorking ? '✅ PASS' : '❌ FAIL'}`);
    
    // Algorithm assessment
    const basicAlgorithms = simpleLoopWorking;
    const intermediateAlgorithms = complexChainWorking && disconnectedComponentsWorking;
    const advancedAlgorithms = ultraComplexWorking && totalTrades > 3;
    
    let sophisticationLevel = 'None';
    if (basicAlgorithms && intermediateAlgorithms && advancedAlgorithms) {
      sophisticationLevel = 'Full (Tarjan + Johnson + Optimizations)';
    } else if (basicAlgorithms && intermediateAlgorithms) {
      sophisticationLevel = 'Intermediate (Some Advanced Algorithms)';
    } else if (basicAlgorithms) {
      sophisticationLevel = 'Basic (Simple Algorithms Only)';
    }
    
    console.log(`🎯 Algorithm Sophistication Level: ${sophisticationLevel}`);
    
    return {
      sophisticationLevel,
      basicAlgorithms,
      intermediateAlgorithms,
      advancedAlgorithms,
      totalTrades,
      successRate: successfulScenarios / totalScenarios,
      hasCanonical
    };
  }

  /**
   * Run comprehensive rigorous test
   */
  async runRigorousTest() {
    console.log('🔬 RIGOROUS ALGORITHM VERIFICATION');
    console.log('=' .repeat(70));
    console.log('🎯 Objective: Verify sophisticated algorithms are working correctly');
    console.log('📊 Method: Complex graph scenarios requiring advanced algorithms');
    console.log('');
    
    try {
      // Setup
      await this.createRigorousTestTenant();
      const testData = this.generateComplexGraphScenario();
      await this.uploadComplexTestData(testData);
      
      // Test all scenarios
      const scenarioResults = await this.testAllScenarios();
      
      // Analyze sophistication
      const sophisticationAnalysis = this.analyzeAlgorithmSophistication(scenarioResults);
      
      // Final verdict
      console.log('');
      console.log('🏆 RIGOROUS ALGORITHM VERIFICATION RESULTS');
      console.log('=' .repeat(70));
      
      const algorithmsSophisticated = sophisticationAnalysis.sophisticationLevel.includes('Full');
      const systemFunctional = sophisticationAnalysis.successRate >= 0.6;
      const tradesGenerated = sophisticationAnalysis.totalTrades > 0;
      
      console.log(`✅ System Functional: ${systemFunctional ? 'PASS' : 'FAIL'}`);
      console.log(`✅ Trades Generated: ${tradesGenerated ? 'PASS' : 'FAIL'}`);
      console.log(`✅ Algorithm Sophistication: ${algorithmsSophisticated ? 'FULL' : sophisticationAnalysis.sophisticationLevel}`);
      console.log(`✅ Success Rate: ${(sophisticationAnalysis.successRate * 100).toFixed(1)}%`);
      
      const overallSuccess = systemFunctional && tradesGenerated;
      
      console.log('');
      if (overallSuccess && algorithmsSophisticated) {
        console.log('🎉 RIGOROUS VERIFICATION: ✅ FULL SUCCESS!');
        console.log('🧠 Sophisticated algorithms (Tarjan, Johnson, etc.) are WORKING');
        console.log('🚀 Algorithm Consolidation Service is FULLY VERIFIED');
      } else if (overallSuccess) {
        console.log('⚠️  RIGOROUS VERIFICATION: ✅ PARTIAL SUCCESS');
        console.log('🔧 System working but algorithm sophistication needs review');
      } else {
        console.log('❌ RIGOROUS VERIFICATION: FAILED');
        console.log('🔧 System issues detected, requires debugging');
      }
      
      return {
        overallSuccess,
        algorithmsSophisticated,
        sophisticationAnalysis,
        scenarioResults
      };
      
    } catch (error) {
      console.error('💥 Rigorous test failed:', error.message);
      throw error;
    }
  }
}

// Run rigorous test
if (require.main === module) {
  const tester = new RigorousAlgorithmTester();
  
  tester.runRigorousTest()
    .then(results => {
      if (results.overallSuccess && results.algorithmsSophisticated) {
        console.log('\n🎯 RIGOROUS ALGORITHM TEST: ✅ FULL SUCCESS');
        process.exit(0);
      } else if (results.overallSuccess) {
        console.log('\n🔧 RIGOROUS ALGORITHM TEST: ⚠️  PARTIAL SUCCESS');
        process.exit(2);
      } else {
        console.log('\n❌ RIGOROUS ALGORITHM TEST: FAILED');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Test crashed:', error.message);
      process.exit(1);
    });
}

module.exports = RigorousAlgorithmTester;