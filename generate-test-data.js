const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// Configuration
const NUM_WALLETS = 50;    // Drastically reduced from 200
const NUM_NFTS = 100;      // Drastically reduced from 1000
const WANTS_PER_WALLET = 5; // Drastically reduced from 20
const MAX_LOOP_DEPTH = 3;  // Limit search depth to reduce complexity
const PERFORMANCE_LOG_FILE = 'performance-metrics.json';
const TRADES_LOG_FILE = 'trade-stats.json';
const TEST_DATA_FILE = 'test-data.json';

// Simple Base58 alphabet for Solana-like addresses
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

// Helper function to measure execution time
function measureTime(description) {
  const start = process.hrtime.bigint();
  return {
    description,
    end: () => {
      const end = process.hrtime.bigint();
      const durationNs = end - start;
      const durationMs = Number(durationNs) / 1_000_000;
      console.log(`${description} completed in ${durationMs.toFixed(2)}ms`);
      return { description, durationMs };
    }
  };
}

// Generate mock wallet addresses (Solana-like in base58)
function generateWalletAddress() {
  // Generate a random string using the Base58 alphabet
  let result = '';
  for (let i = 0; i < 44; i++) {
    const randomIndex = Math.floor(Math.random() * BASE58_ALPHABET.length);
    result += BASE58_ALPHABET[randomIndex];
  }
  return result;
}

// Generate mock NFT addresses (Solana-like mint addresses in base58)
function generateNFTAddress() {
  // Generate a random string using the Base58 alphabet
  let result = '';
  for (let i = 0; i < 44; i++) {
    const randomIndex = Math.floor(Math.random() * BASE58_ALPHABET.length);
    result += BASE58_ALPHABET[randomIndex];
  }
  return result;
}

// Simple algorithm to find trade loops
function findTradeLoops(ownedNFTs, wantedNFTs, maxDepth = 5) {
  console.log("Analyzing data with local trade loop discovery algorithm...");
  const timer = measureTime("Local Trade Loop Algorithm");
  
  // Create ownership map for quick lookups
  const ownershipMap = {};
  for (const [wallet, nfts] of Object.entries(ownedNFTs)) {
    for (const nft of nfts) {
      ownershipMap[nft] = wallet;
    }
  }
  
  // Create wants map for quick lookups
  const wantsMap = {};
  for (const [wallet, nfts] of Object.entries(wantedNFTs)) {
    wantsMap[wallet] = new Set(nfts);
  }
  
  // Track found loops
  const loops = [];
  const loopSizes = {};
  
  // DFS function to find loops
  function findLoops(currentWallet, targetWallet, path = [], visited = new Set(), depth = 0) {
    // Stop if we've reached max depth
    if (depth >= maxDepth) {
      return;
    }
    
    // Stop if we've already visited this wallet in this path
    if (visited.has(currentWallet)) {
      return;
    }
    
    // Clone the path and visited set
    const newPath = [...path, currentWallet];
    const newVisited = new Set(visited);
    newVisited.add(currentWallet);
    
    // If we've found the target wallet, we've found a loop
    if (currentWallet === targetWallet && depth > 0) {
      loops.push(newPath);
      
      // Track loop size
      const loopSize = newPath.length;
      loopSizes[loopSize] = (loopSizes[loopSize] || 0) + 1;
      
      return;
    }
    
    // Get the NFTs owned by this wallet
    const nftsOwned = ownedNFTs[currentWallet] || [];
    
    // For each NFT, check if another wallet wants it
    for (const nft of nftsOwned) {
      // Find wallets that want this NFT
      const wanters = Object.entries(wantsMap)
        .filter(([wallet, wantedNfts]) => wantedNfts.has(nft))
        .map(([wallet]) => wallet);
      
      // Continue the search from each wanter
      for (const wanter of wanters) {
        findLoops(wanter, targetWallet, newPath, newVisited, depth + 1);
        
        // Limit the number of loops we find to avoid excessive computation
        if (loops.length >= 1000) {
          return;
        }
      }
    }
  }
  
  // Sample wallets to start the search from
  const sampleSize = Math.min(20, Object.keys(ownedNFTs).length);
  const wallets = Object.keys(ownedNFTs);
  const sampleWallets = [];
  
  for (let i = 0; i < sampleSize; i++) {
    const randomIndex = Math.floor(Math.random() * wallets.length);
    sampleWallets.push(wallets[randomIndex]);
  }
  
  // Find loops starting from each sample wallet
  console.log(`Looking for trade loops starting from ${sampleWallets.length} sample wallets...`);
  for (const wallet of sampleWallets) {
    console.log(`Finding loops for wallet ${wallet.substring(0, 8)}...`);
    findLoops(wallet, wallet);
    
    // Limit the total number of loops we find
    if (loops.length >= 1000) {
      console.log("Reached maximum number of loops. Stopping search.");
      break;
    }
  }
  
  // Sort loops by length
  loops.sort((a, b) => a.length - b.length);
  
  const duration = timer.end();
  
  return {
    loops,
    loopSizes,
    executionTime: duration.durationMs,
    totalLoops: loops.length
  };
}

async function main() {
  console.log("Starting test data generation and local algorithm testing...");
  const overallTimer = measureTime("Overall Execution");
  const performanceMetrics = [];
  
  // Generate wallet addresses
  let timer = measureTime("Wallet Generation");
  console.log(`Generating ${NUM_WALLETS} wallet addresses...`);
  const wallets = Array.from({ length: NUM_WALLETS }, () => generateWalletAddress());
  performanceMetrics.push(timer.end());
  
  // Generate NFT addresses
  timer = measureTime("NFT Generation");
  console.log(`Generating ${NUM_NFTS} NFT addresses...`);
  const nfts = Array.from({ length: NUM_NFTS }, () => generateNFTAddress());
  performanceMetrics.push(timer.end());
  
  // Distribute NFTs to wallets (10 per wallet on average)
  timer = measureTime("NFT Distribution");
  console.log("Distributing NFTs to wallets...");
  const ownedNFTs = {};
  wallets.forEach(wallet => {
    ownedNFTs[wallet] = [];
  });
  
  nfts.forEach((nft, index) => {
    const walletIndex = index % NUM_WALLETS;
    ownedNFTs[wallets[walletIndex]].push(nft);
  });
  performanceMetrics.push(timer.end());
  
  // Create "wants" relationships - purely random
  timer = measureTime("Wants Generation");
  console.log("Creating wants relationships...");
  const wantedNFTs = {};
  wallets.forEach(wallet => {
    wantedNFTs[wallet] = [];
    
    // Each wallet wants WANTS_PER_WALLET random NFTs they don't own
    const ownedByThisWallet = new Set(ownedNFTs[wallet]);
    const availableNFTs = nfts.filter(nft => !ownedByThisWallet.has(nft));
    
    // Shuffle and pick WANTS_PER_WALLET
    const shuffled = availableNFTs.sort(() => 0.5 - Math.random());
    wantedNFTs[wallet] = shuffled.slice(0, WANTS_PER_WALLET);
  });
  performanceMetrics.push(timer.end());
  
  // Create some deliberate trade loops to ensure we have loops to find
  timer = measureTime("Trade Loop Creation");
  console.log("Creating deliberate trade loops...");
  // Create 10 loops of 3 wallets each
  for (let i = 0; i < 10; i++) {
    const walletA = wallets[i * 3];
    const walletB = wallets[i * 3 + 1];
    const walletC = wallets[i * 3 + 2];
    
    const nftA = ownedNFTs[walletA][0];
    const nftB = ownedNFTs[walletB][0];
    const nftC = ownedNFTs[walletC][0];
    
    // A wants B's NFT
    if (!wantedNFTs[walletA].includes(nftB)) {
      wantedNFTs[walletA].push(nftB);
    }
    
    // B wants C's NFT
    if (!wantedNFTs[walletB].includes(nftC)) {
      wantedNFTs[walletB].push(nftC);
    }
    
    // C wants A's NFT (completing the loop)
    if (!wantedNFTs[walletC].includes(nftA)) {
      wantedNFTs[walletC].push(nftA);
    }
    
    console.log(`Created deliberate loop: ${walletA.substring(0, 8)} → ${walletB.substring(0, 8)} → ${walletC.substring(0, 8)} → ${walletA.substring(0, 8)}`);
  }
  performanceMetrics.push(timer.end());
  
  // Save test data to a file
  timer = measureTime("Save Test Data");
  console.log("Saving test data to file...");
  const testData = {
    ownedNFTs,
    wantedNFTs
  };
  fs.writeFileSync(TEST_DATA_FILE, JSON.stringify(testData));
  performanceMetrics.push(timer.end());
  
  // Run local trade loop discovery algorithm
  const { loops, loopSizes, executionTime, totalLoops } = findTradeLoops(ownedNFTs, wantedNFTs);
  
  performanceMetrics.push({ description: "Trade Loop Discovery", durationMs: executionTime });
  
  // Complete overall timer
  const overallMetrics = overallTimer.end();
  performanceMetrics.push(overallMetrics);
  
  // Generate summary report
  console.log("\n=== PERFORMANCE SUMMARY ===");
  performanceMetrics.forEach(metric => {
    console.log(`${metric.description}: ${metric.durationMs.toFixed(2)}ms`);
  });
  
  console.log("\n=== TRADE STATISTICS ===");
  console.log(`Total trade loops found: ${totalLoops}`);
  console.log(`Trades by loop length:`);
  
  // Sort by loop size
  const sortedLoopSizes = Object.entries(loopSizes).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  
  sortedLoopSizes.forEach(([length, count]) => {
    console.log(`  ${length} steps: ${count} trades (${(count/totalLoops*100).toFixed(2)}%)`);
  });
  
  // Show some example loops
  if (loops.length > 0) {
    console.log("\n=== EXAMPLE TRADE LOOPS ===");
    const exampleCount = Math.min(5, loops.length);
    
    for (let i = 0; i < exampleCount; i++) {
      const loop = loops[i];
      console.log(`Loop ${i+1} (${loop.length} steps):`);
      
      for (let j = 0; j < loop.length - 1; j++) {
        const from = loop[j];
        const to = loop[j+1];
        console.log(`  ${from.substring(0, 8)} → ${to.substring(0, 8)}`);
      }
      
      // The last step to close the loop
      const lastFrom = loop[loop.length - 1];
      const lastTo = loop[0];
      console.log(`  ${lastFrom.substring(0, 8)} → ${lastTo.substring(0, 8)}`);
      console.log();
    }
  }
  
  // Save metrics to files
  fs.writeFileSync(PERFORMANCE_LOG_FILE, JSON.stringify(performanceMetrics, null, 2));
  
  const tradeStats = {
    totalLoops,
    loopSizes,
    exampleLoops: loops.slice(0, 10)
  };
  
  fs.writeFileSync(TRADES_LOG_FILE, JSON.stringify(tradeStats, null, 2));
  console.log(`\nPerformance metrics saved to ${PERFORMANCE_LOG_FILE}`);
  console.log(`Trade statistics saved to ${TRADES_LOG_FILE}`);
  
  console.log("\nTest data generation and analysis complete!");
  console.log(`Created ${NUM_WALLETS} wallets with ${NUM_NFTS} NFTs and ${NUM_WALLETS * WANTS_PER_WALLET} wants relationships`);
  console.log(`Including 10 deliberate trade loops of 3 wallets each`);
}

// Run the script
main().catch(error => {
  console.error("Error generating test data:", error);
  process.exit(1);
}); 