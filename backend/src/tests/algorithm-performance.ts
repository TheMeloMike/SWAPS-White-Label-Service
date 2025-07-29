/**
 * Trade Algorithm Performance Test Suite
 * 
 * This script tests the performance and correctness of the trade discovery algorithm
 * under various conditions, with configurable parameters to simulate different
 * network topologies and trade patterns.
 */

import { TradeDiscoveryService } from '../services/trade/TradeDiscoveryService';
import { performance } from 'perf_hooks';
import * as crypto from 'crypto';
import { TradeLoop } from '../types/trade';

// Define the WalletState type
interface WalletState {
  ownedNfts: Set<string>;
  wantedNfts: Set<string>;
}

// Configure test parameters
const TEST_CONFIG = {
  // Basic test with guaranteed trade loops
  simpleTwoParty: {
    wallets: 2,
    nftsPerWallet: 2,
    wantsPerWallet: 1,
    tradePattern: 'direct' // A⟷B direct swap
  },
  simpleThreeParty: {
    wallets: 3,
    nftsPerWallet: 3,
    wantsPerWallet: 1, 
    tradePattern: 'circular' // A→B→C→A
  },
  complexMultiParty: {
    wallets: 5,
    nftsPerWallet: 5,
    wantsPerWallet: 2,
    tradePattern: 'mesh' // Complex interconnected wants
  },

  // Scale tests
  mediumScale: {
    wallets: 20,
    nftsPerWallet: 5,
    wantsPerWallet: 3,
    tradePattern: 'random'
  },
  largeScale: {
    wallets: 100,
    nftsPerWallet: 10,
    wantsPerWallet: 5,
    tradePattern: 'random'
  },
  extremeScale: {
    wallets: 500,
    nftsPerWallet: 20,
    wantsPerWallet: 10,
    tradePattern: 'random'
  }
};

/**
 * Generate a test wallet address
 */
function generateWalletAddress(): string {
  return `wallet-${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Generate a test NFT address
 */
function generateNftAddress(): string {
  return `nft-${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Create synthetic test data based on configuration
 */
function generateTestData(config: typeof TEST_CONFIG.simpleTwoParty) {
  console.log(`Generating test data with ${config.wallets} wallets, ${config.nftsPerWallet} NFTs per wallet, ${config.wantsPerWallet} wants per wallet`);
  
  const wallets = new Map<string, WalletState>();
  const nftOwnership = new Map<string, string>();
  const nftsByWallet: Map<string, string[]> = new Map();
  
  // Step 1: Create wallets and their owned NFTs
  const walletAddresses: string[] = [];
  
  for (let i = 0; i < config.wallets; i++) {
    const walletAddress = generateWalletAddress();
    walletAddresses.push(walletAddress);
    
    // Initialize wallet state
    wallets.set(walletAddress, {
      ownedNfts: new Set<string>(),
      wantedNfts: new Set<string>()
    });
    
    // Generate NFTs for this wallet
    const nfts: string[] = [];
    for (let j = 0; j < config.nftsPerWallet; j++) {
      const nftAddress = generateNftAddress();
      nfts.push(nftAddress);
      
      // Update maps
      wallets.get(walletAddress)!.ownedNfts.add(nftAddress);
      nftOwnership.set(nftAddress, walletAddress);
    }
    
    nftsByWallet.set(walletAddress, nfts);
  }
  
  // Step 2: Create trade patterns based on configuration
  if (config.tradePattern === 'direct') {
    // Direct 2-party trade: A wants from B, B wants from A
    if (walletAddresses.length >= 2) {
      const wallet1 = walletAddresses[0];
      const wallet2 = walletAddresses[1];
      
      // Wallet 1 wants NFT from Wallet 2
      const nft1 = nftsByWallet.get(wallet2)![0];
      wallets.get(wallet1)!.wantedNfts.add(nft1);
      
      // Wallet 2 wants NFT from Wallet 1
      const nft2 = nftsByWallet.get(wallet1)![0];
      wallets.get(wallet2)!.wantedNfts.add(nft2);
      
      console.log(`Created direct trade pattern: ${wallet1} wants ${nft1} from ${wallet2}`);
      console.log(`Created direct trade pattern: ${wallet2} wants ${nft2} from ${wallet1}`);
    }
  } 
  else if (config.tradePattern === 'circular') {
    // Circular trade: A→B→C→A
    for (let i = 0; i < walletAddresses.length; i++) {
      const currentWallet = walletAddresses[i];
      const nextWallet = walletAddresses[(i + 1) % walletAddresses.length];
      
      // Current wallet wants NFT from next wallet
      const nftToWant = nftsByWallet.get(nextWallet)![0];
      wallets.get(currentWallet)!.wantedNfts.add(nftToWant);
      
      console.log(`Created circular trade link: ${currentWallet} wants ${nftToWant} from ${nextWallet}`);
    }
  }
  else if (config.tradePattern === 'mesh') {
    // Complex mesh of trades: Each wallet wants from multiple other wallets
    for (let i = 0; i < walletAddresses.length; i++) {
      const currentWallet = walletAddresses[i];
      
      // Each wallet wants from config.wantsPerWallet other wallets
      for (let j = 0; j < config.wantsPerWallet; j++) {
        // Pick another wallet that's not the current one
        const targetIndex = (i + j + 1) % walletAddresses.length;
        if (targetIndex === i) continue;
        
        const targetWallet = walletAddresses[targetIndex];
        const nftToWant = nftsByWallet.get(targetWallet)![j % nftsByWallet.get(targetWallet)!.length];
        
        wallets.get(currentWallet)!.wantedNfts.add(nftToWant);
        
        console.log(`Created mesh trade link: ${currentWallet} wants ${nftToWant} from ${targetWallet}`);
      }
    }
  }
  else if (config.tradePattern === 'random') {
    // Randomly assign wants
    for (let i = 0; i < walletAddresses.length; i++) {
      const currentWallet = walletAddresses[i];
      
      // Create a set to track wallets we've already selected NFTs from
      const selectedWallets = new Set<string>([currentWallet]); // Can't want from self
      
      // Each wallet wants from config.wantsPerWallet other wallets
      for (let j = 0; j < config.wantsPerWallet; j++) {
        // If we've selected from all other wallets, break
        if (selectedWallets.size >= walletAddresses.length) break;
        
        // Pick a random wallet that we haven't selected from yet
        let targetWallet: string;
        do {
          const randomIndex = Math.floor(Math.random() * walletAddresses.length);
          targetWallet = walletAddresses[randomIndex];
        } while (selectedWallets.has(targetWallet));
        
        selectedWallets.add(targetWallet);
        
        // Pick a random NFT from the target wallet
        const targetNfts = nftsByWallet.get(targetWallet)!;
        const nftToWant = targetNfts[Math.floor(Math.random() * targetNfts.length)];
        
        wallets.get(currentWallet)!.wantedNfts.add(nftToWant);
      }
    }
    
    console.log(`Created random trade pattern with ${config.wantsPerWallet} wants per wallet`);
  }
  
  // Return the complete synthetic test data
  return {
    wallets,
    nftOwnership,
    walletAddresses
  };
}

/**
 * Run a single test with the given configuration
 */
async function runTest(name: string, config: typeof TEST_CONFIG.simpleTwoParty) {
  console.log(`\n=== Running Test: ${name} ===`);
  
  // Generate test data
  const { wallets, nftOwnership, walletAddresses } = generateTestData(config);
  
  // Create a trade discovery service instance for testing
  // Since TradeDiscoveryService has a private constructor, use getInstance()
  const tradeDiscovery = TradeDiscoveryService.getInstance();
  
  // Reset the state
  tradeDiscovery.clearState();
  
  // Load the test data into the service
  // Since we can't access private methods directly, we'll use the public API
  for (const [walletAddress, state] of wallets.entries()) {
    // Register wanted NFTs using addTradePreference
    for (const nft of state.wantedNfts) {
      await tradeDiscovery.addTradePreference(walletAddress, nft);
    }
  }
  
  // For test purposes, we'll need to manually register NFT ownership
  // We'll check if the service has a method to register all NFTs at once
  for (const [nftAddress, ownerWallet] of nftOwnership.entries()) {
    // Directly register NFT ownership for testing
    await tradeDiscovery.registerManualNFTs(ownerWallet, [nftAddress]);
  }
  
  // Run a full scan trade discovery for one of the wallets
  const testWallet = walletAddresses[0];
  
  console.log(`Running trade discovery for wallet: ${testWallet}`);
  
  const startTime = performance.now();
  
  // Find trade loops
  // The API doesn't accept wallet as part of settings, so we pass it as a separate param
  const tradeLoops = await tradeDiscovery.findTradeLoops({
    maxDepth: 5, // Use a reasonable depth for testing
    minEfficiency: 0.6, // Use standard efficiency threshold
    timeoutMs: 30000 // Allow 30 seconds for testing
  });
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  // Log results
  console.log(`Found ${tradeLoops.length} trade loops in ${duration.toFixed(2)} ms`);
  
  // Output details of each trade loop
  if (tradeLoops.length > 0) {
    console.log('\nTrade loop details:');
    tradeLoops.forEach((loop: TradeLoop, i: number) => {
      console.log(`\nTrade Loop #${i+1}:`);
      console.log(`Participants: ${loop.totalParticipants}`);
      console.log(`Steps: ${loop.steps.length}`);
      console.log(`Efficiency: ${loop.efficiency.toFixed(2)}`);
      
      // Log each step
      loop.steps.forEach((step: any, j: number) => {
        const nftNames = step.nfts.map((nft: any) => nft.address).join(', ');
        console.log(`  Step ${j+1}: ${step.from} → ${step.to} (NFTs: ${nftNames})`);
      });
    });
  }
  
  return {
    config,
    duration,
    tradeCount: tradeLoops.length,
    walletCount: wallets.size,
    nftCount: nftOwnership.size,
    tradeLoops
  };
}

/**
 * Run all tests and compile results
 */
async function runAllTests() {
  console.log('=== Trade Algorithm Performance Test Suite ===\n');
  
  const results: any[] = [];
  
  // Run each configured test
  for (const [name, config] of Object.entries(TEST_CONFIG)) {
    const result = await runTest(name, config);
    results.push({
      name,
      ...result
    });
  }
  
  // Compile and print summary
  console.log('\n=== Test Suite Summary ===');
  console.log('Name\tWallets\tNFTs\tTrades\tDuration (ms)');
  
  for (const result of results) {
    console.log(`${result.name}\t${result.walletCount}\t${result.nftCount}\t${result.tradeCount}\t${result.duration.toFixed(2)}`);
  }
}

// Run the test suite if this is the main module
if (require.main === module) {
  runAllTests().catch(err => {
    console.error('Error running test suite:', err);
    process.exit(1);
  });
}

export { generateTestData, runTest, runAllTests }; 