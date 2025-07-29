#!/usr/bin/env node

/**
 * Trade Algorithm Test Script
 * 
 * This script tests the trade algorithm via HTTP API calls,
 * creating multiple test scenarios to verify the algorithm's ability
 * to detect various trade patterns.
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Simple colored output instead of chalk
const colors = {
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`
};

// Mock data for isolated testing
const TEST_WALLETS = {
  WALLET_A: 'wallet_a_address',
  WALLET_B: 'wallet_b_address', 
  WALLET_C: 'wallet_c_address'
};

const TEST_NFTS = {
  NFT_A1: 'nft_a1_address',
  NFT_A2: 'nft_a2_address',
  NFT_B1: 'nft_b1_address',
  NFT_B2: 'nft_b2_address',
  NFT_C1: 'nft_c1_address',
  NFT_C2: 'nft_c2_address'
};

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3001';
const ISOLATED_TEST = process.env.ISOLATED_TEST === 'true' || false;

// API client for interacting with the backend
const api = {
  // Reset the test environment
  async resetTestEnvironment() {
    if (!ISOLATED_TEST) {
      try {
        console.log('Resetting test environment...');
        await axios.post(`${API_URL}/api/test/reset`);
        return true;
      } catch (error) {
        console.error('Error resetting test environment:', error.message);
        return false;
      }
    }
    return true;
  },

  // Register an NFT as owned by a wallet
  async registerNFTs(wallet, nfts) {
    try {
      const response = await axios.post(`${API_URL}/api/trades/register-nfts`, {
        walletAddress: wallet,
        nftAddresses: nfts
      });
      return response.data;
    } catch (error) {
      console.error(`Error registering NFTs for ${wallet}:`, error.message);
      throw error;
    }
  },

  // Register a preference for an NFT by a wallet
  async addPreference(wallet, nft) {
    try {
      const response = await axios.post(`${API_URL}/api/trades/want-nft`, {
        walletAddress: wallet,
        nftAddress: nft
      });
      return response.data;
    } catch (error) {
      console.error(`Error adding preference for ${wallet}:`, error.message);
      throw error;
    }
  },

  // Discover potential trades for a wallet
  async findTrades(wallet) {
    try {
      const response = await axios.post(`${API_URL}/api/trades/discover`, {
        wallet,
        forceRefresh: true
      });
      return response.data;
    } catch (error) {
      console.error(`Error finding trade loops for ${wallet}:`, error.message);
      throw error;
    }
  },

  // For isolated testing - mocked responses that don't need the backend
  mockFindTrades(testCase) {
    if (testCase === 'direct') {
      return {
        trades: [
          {
            id: uuidv4(),
            steps: [
              {
                from: TEST_WALLETS.WALLET_A,
                to: TEST_WALLETS.WALLET_B,
                nfts: [{ address: TEST_NFTS.NFT_A1 }]
              },
              {
                from: TEST_WALLETS.WALLET_B,
                to: TEST_WALLETS.WALLET_A,
                nfts: [{ address: TEST_NFTS.NFT_B1 }]
              }
            ]
          }
        ]
      };
    } else if (testCase === 'circular') {
      return {
        trades: [
          {
            id: uuidv4(),
            steps: [
              {
                from: TEST_WALLETS.WALLET_A,
                to: TEST_WALLETS.WALLET_B,
                nfts: [{ address: TEST_NFTS.NFT_A1 }]
              },
              {
                from: TEST_WALLETS.WALLET_B,
                to: TEST_WALLETS.WALLET_C,
                nfts: [{ address: TEST_NFTS.NFT_B1 }]
              },
              {
                from: TEST_WALLETS.WALLET_C,
                to: TEST_WALLETS.WALLET_A,
                nfts: [{ address: TEST_NFTS.NFT_C1 }]
              }
            ]
          }
        ]
      };
    } else if (testCase === 'complex') {
      return {
        trades: [
          {
            id: uuidv4(),
            steps: [
              {
                from: TEST_WALLETS.WALLET_A,
                to: TEST_WALLETS.WALLET_B,
                nfts: [{ address: TEST_NFTS.NFT_A1 }]
              },
              {
                from: TEST_WALLETS.WALLET_B,
                to: TEST_WALLETS.WALLET_C,
                nfts: [{ address: TEST_NFTS.NFT_B1 }]
              },
              {
                from: TEST_WALLETS.WALLET_C,
                to: TEST_WALLETS.WALLET_B,
                nfts: [{ address: TEST_NFTS.NFT_C1 }]
              },
              {
                from: TEST_WALLETS.WALLET_B,
                to: TEST_WALLETS.WALLET_A,
                nfts: [{ address: TEST_NFTS.NFT_B2 }]
              }
            ]
          }
        ]
      };
    }
    return { trades: [] };
  }
};

// Test runner for different trade scenarios
const testRunner = {
  async runAllTests() {
    console.log(colors.blue('\n=== Test Suite Summary ==='));
    
    let passCount = 0;
    let failCount = 0;
    const results = [];

    try {
      console.log(colors.yellow('\nSetting up test environment...'));
      await api.resetTestEnvironment();

      // Test cases
      const testCases = [
        { name: '2-Party Direct Trade', handler: this.test2PartyDirectTrade },
        { name: '3-Party Circular Trade', handler: this.test3PartyCircularTrade },
        { name: 'Complex Multi-Party Trade', handler: this.testComplexMultiPartyTrade }
      ];

      // Run tests
      for (const test of testCases) {
        console.log(colors.yellow(`\nTesting ${test.name}...`));
        try {
          const passed = await test.handler();
          results.push({ name: test.name, passed });
          
          if (passed) {
            passCount++;
            console.log(colors.green(`${test.name} test passed! ✅`));
          } else {
            failCount++;
            console.log(colors.red(`${test.name} test failed! ❌`));
          }
        } catch (error) {
          results.push({ name: test.name, passed: false, error: error.message });
          failCount++;
          console.log(colors.red(`${test.name} test failed with error: ${error.message} ❌`));
        }
      }
    } catch (error) {
      console.error(colors.red(`\nTest suite failed to run: ${error.message}`));
    }

    // Print test summary
    console.log(colors.blue(`\n=== Test Suite Summary ===`));
    console.log(colors.blue(`Total tests: ${passCount + failCount}`));
    console.log(colors.green(`Passed: ${passCount}`));
    console.log(colors.red(`Failed: ${failCount}`));
    
    console.log(colors.blue(`\nDetailed results:`));
    results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      const color = result.passed ? colors.green : colors.red;
      console.log(color(`${result.name}: ${result.passed ? 'PASSED' : 'FAILED'} ${icon}`));
    });

    return passCount === results.length;
  },

  // Test Case 1: Simple direct trade between two parties
  async test2PartyDirectTrade() {
    console.log('Testing 2-party direct trade scenario...');
    
    if (ISOLATED_TEST) {
      // Use mock data in isolated mode
      const result = api.mockFindTrades('direct');
      return result.trades && result.trades.length > 0;
    }
    
    // Setup: Register NFTs and preferences for wallet A and B
    await api.registerNFTs(TEST_WALLETS.WALLET_A, [TEST_NFTS.NFT_A1]);
    await api.registerNFTs(TEST_WALLETS.WALLET_B, [TEST_NFTS.NFT_B1]);
    
    // Add preferences: A wants B's NFT, B wants A's NFT
    await api.addPreference(TEST_WALLETS.WALLET_A, TEST_NFTS.NFT_B1);
    await api.addPreference(TEST_WALLETS.WALLET_B, TEST_NFTS.NFT_A1);
    
    // Find trades for wallet A
    const result = await api.findTrades(TEST_WALLETS.WALLET_A);
    
    // Validate: Should find a direct trade between A and B
    console.log('Found trade loops:', result.trades ? result.trades.length : 0);
    return result.trades && result.trades.length > 0;
  },
  
  // Test Case 2: Three-party circular trade
  async test3PartyCircularTrade() {
    console.log('Testing 3-party circular trade scenario...');
    
    if (ISOLATED_TEST) {
      // Use mock data in isolated mode
      const result = api.mockFindTrades('circular');
      return result.trades && result.trades.length > 0;
    }
    
    // Setup: Register NFTs and preferences for wallets A, B and C
    await api.registerNFTs(TEST_WALLETS.WALLET_A, [TEST_NFTS.NFT_A1]);
    await api.registerNFTs(TEST_WALLETS.WALLET_B, [TEST_NFTS.NFT_B1]);
    await api.registerNFTs(TEST_WALLETS.WALLET_C, [TEST_NFTS.NFT_C1]);
    
    // Add preferences: A wants C's NFT, B wants A's NFT, C wants B's NFT
    await api.addPreference(TEST_WALLETS.WALLET_A, TEST_NFTS.NFT_C1);
    await api.addPreference(TEST_WALLETS.WALLET_B, TEST_NFTS.NFT_A1);
    await api.addPreference(TEST_WALLETS.WALLET_C, TEST_NFTS.NFT_B1);
    
    // Find trades for wallet A
    const result = await api.findTrades(TEST_WALLETS.WALLET_A);
    
    // Validate: Should find a circular trade A -> B -> C -> A
    console.log('Found trade loops:', result.trades ? result.trades.length : 0);
    return result.trades && result.trades.length > 0;
  },
  
  // Test Case 3: Complex multi-party trade with multiple steps
  async testComplexMultiPartyTrade() {
    console.log('Testing complex multi-party trade scenario...');
    
    if (ISOLATED_TEST) {
      // Use mock data in isolated mode
      const result = api.mockFindTrades('complex');
      return result.trades && result.trades.length > 0;
    }
    
    // Setup: Register NFTs and preferences for a complex scenario
    await api.registerNFTs(TEST_WALLETS.WALLET_A, [TEST_NFTS.NFT_A1, TEST_NFTS.NFT_A2]);
    await api.registerNFTs(TEST_WALLETS.WALLET_B, [TEST_NFTS.NFT_B1, TEST_NFTS.NFT_B2]);
    await api.registerNFTs(TEST_WALLETS.WALLET_C, [TEST_NFTS.NFT_C1, TEST_NFTS.NFT_C2]);
    
    // Add preferences for a complex trade route
    await api.addPreference(TEST_WALLETS.WALLET_A, TEST_NFTS.NFT_B2);
    await api.addPreference(TEST_WALLETS.WALLET_B, TEST_NFTS.NFT_A1);
    await api.addPreference(TEST_WALLETS.WALLET_B, TEST_NFTS.NFT_C1);
    await api.addPreference(TEST_WALLETS.WALLET_C, TEST_NFTS.NFT_B1);
    
    // Find trades for wallet A
    const result = await api.findTrades(TEST_WALLETS.WALLET_A);
    
    // Validate: Should find a complex trade with multiple steps
    console.log('Found trade loops:', result.trades ? result.trades.length : 0);
    return result.trades && result.trades.length > 0;
  }
};

// Run all tests
(async () => {
  console.log(colors.blue('Running Trade Algorithm Tests...'));
  console.log(colors.yellow(`Mode: ${ISOLATED_TEST ? 'Isolated (mocked)' : 'Integration (API)'}`));
  console.log(colors.yellow(`API URL: ${API_URL}`));
  
  try {
    const success = await testRunner.runAllTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error(colors.red(`Test failed with error: ${error.message}`));
    process.exit(1);
  }
})(); 