// Add reflect-metadata polyfill for tsyringe
require('reflect-metadata');

// Test script to verify core algorithm data requirements and flow
const { TradeDiscoveryService } = require('./backend/dist/services/trade/TradeDiscoveryService');
const fs = require('fs');

async function testCoreAlgorithm() {
  console.log('=== VERIFYING CORE ALGORITHM DATA REQUIREMENTS ===\n');

  // Initialize the TradeDiscoveryService
  let tradeService;
  try {
    tradeService = TradeDiscoveryService.getInstance();
    console.log('✅ TradeDiscoveryService initialized successfully');
  } catch (error) {
    console.log('❌ TradeDiscoveryService initialization failed:', error.message);
    process.exit(1);
  }

  // Check current system state
  const systemState = tradeService.getSystemState();
  console.log('📊 Current System State:', systemState);
  console.log('');

  // Get the core data structures
  const wallets = tradeService.getWallets();
  const wantedNfts = tradeService.getWantedNfts();
  console.log('📊 Core Data Structures:');
  console.log('  - Wallets Map size:', wallets.size);
  console.log('  - WantedNfts Map size:', wantedNfts.size);
  console.log('');

  // Examine WalletState structure
  if (wallets.size > 0) {
    const firstWallet = wallets.values().next().value;
    console.log('📊 WalletState Structure Sample:');
    console.log('  - address:', firstWallet.address);
    console.log('  - ownedNfts type:', firstWallet.ownedNfts.constructor.name);
    console.log('  - ownedNfts size:', firstWallet.ownedNfts.size);
    console.log('  - wantedNfts type:', firstWallet.wantedNfts.constructor.name);
    console.log('  - wantedNfts size:', firstWallet.wantedNfts.size);
    console.log('  - lastUpdated:', firstWallet.lastUpdated);
    console.log('  - ownedCollections:', firstWallet.ownedCollections ? 'present' : 'absent');
    console.log('  - wantedCollections:', firstWallet.wantedCollections ? 'present' : 'absent');
    console.log('');
  }

  // Examine data format details
  console.log('📊 Data Format Verification:');
  if (wallets.size > 0) {
    const [walletAddress, walletState] = wallets.entries().next().value;
    console.log('  - Wallet address format:', typeof walletAddress, 'length:', walletAddress.length);
    
    if (walletState.ownedNfts.size > 0) {
      const firstNft = walletState.ownedNfts.values().next().value;
      console.log('  - NFT address format:', typeof firstNft, 'length:', firstNft.length);
    }
  }
  
  if (wantedNfts.size > 0) {
    const [nftAddress, wantingWallets] = wantedNfts.entries().next().value;
    console.log('  - Wanted NFT structure: nft ->', typeof nftAddress, 'wallets ->', wantingWallets.constructor.name, 'size:', wantingWallets.size);
  }
  console.log('');

  // Test finding trade loops with current data
  console.log('🔍 Testing trade loop discovery...');
  const startTime = performance.now();
  
  try {
    const trades = await tradeService.findTradeLoops({
      maxResults: 5,
      includeDirectTrades: true,
      includeMultiPartyTrades: true,
      considerCollections: true,
      timeoutMs: 10000
    });
    
    const endTime = performance.now();
    console.log('✅ Trade discovery completed in', (endTime - startTime).toFixed(2), 'ms');
    console.log('📊 Results:');
    console.log('  - Total trades found:', trades.length);
    console.log('');
    
    if (trades.length > 0) {
      console.log('  - Trade types:');
      const directTrades = trades.filter(t => t.steps.length === 2).length;
      const multiPartyTrades = trades.filter(t => t.steps.length > 2).length;
      console.log('    * Direct (2-party):', directTrades);
      console.log('    * Multi-party (3+):', multiPartyTrades);
      console.log('');
      
      // Show first trade as example
      const firstTrade = trades[0];
      console.log('📊 Sample Trade Structure:');
      console.log('  - id:', firstTrade.id);
      console.log('  - steps count:', firstTrade.steps.length);
      console.log('  - totalParticipants:', firstTrade.totalParticipants);
      console.log('  - efficiency:', firstTrade.efficiency);
      console.log('  - qualityScore:', firstTrade.qualityScore || 'N/A');
      console.log('');
      
      firstTrade.steps.forEach((step, i) => {
        console.log(`  - Step ${i + 1}: ${step.from.substring(0,8)}... → ${step.to.substring(0,8)}... NFTs: ${step.nfts.length}`);
        step.nfts.forEach((nft, j) => {
          console.log(`    * NFT ${j + 1}: ${nft.address.substring(0,12)}... (${nft.name || 'Unnamed'})`);
        });
      });
      console.log('');
    }
    
    // Test collection wants functionality
    console.log('🔍 Testing collection wants functionality...');
    
    // Add a collection want
    try {
      const testWallet = wallets.keys().next().value;
      if (testWallet) {
        console.log('📝 Adding collection want for wallet:', testWallet.substring(0,8) + '...');
        await tradeService.addCollectionWant(testWallet, 'FSw4cZhK5pMmhEDenDpa3CauJ9kLt5agr2U1oQxaH2cv');
        console.log('✅ Collection want added successfully');
        
        // Try discovery again to see if collection wants are working
        const tradesWithCollection = await tradeService.findTradeLoops({
          maxResults: 3,
          includeDirectTrades: true,
          includeMultiPartyTrades: true,
          considerCollections: true,
          timeoutMs: 5000
        });
        
        console.log('📊 Discovery with collection wants:', tradesWithCollection.length, 'trades found');
      }
    } catch (error) {
      console.log('⚠️ Collection want test failed:', error.message);
    }
    
  } catch (error) {
    console.log('❌ Trade discovery failed:', error.message);
    console.log('Error details:', error.stack);
  }

  console.log('\n=== TEST COMPLETED ===');
}

// Run the test
testCoreAlgorithm().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
}); 