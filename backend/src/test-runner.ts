import { TradeScoreService } from './services/trade/TradeScoreService';
import { ScalableTradeLoopFinderService } from './services/trade/ScalableTradeLoopFinderService';
import { TradeLoopFinderService } from './services/trade/TradeLoopFinderService';
import { WalletState, TradeLoop, NFTDemandMetrics, RejectionPreferences } from './types/trade';

// Configure console colors for better readability
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m"
};

console.log(`${colors.bright}${colors.cyan}===== SWAPS Trading Algorithm Test Environment =====\n${colors.reset}`);

// --------------------------------------
// Create Mock Trading Environment
// --------------------------------------

console.log(`${colors.yellow}Setting up mock trading environment...${colors.reset}`);

// Create mock wallets
const wallets = new Map<string, WalletState>();
const nftOwnership = new Map<string, string>();
const wantedNfts = new Map<string, Set<string>>();
const rejectionPreferences = new Map<string, RejectionPreferences>();

// Wallet 1 data
wallets.set('wallet1', {
  address: 'wallet1',
  ownedNfts: new Set(['nft1', 'nft3', 'nft5']),
  wantedNfts: new Set(['nft2', 'nft6']),
  lastUpdated: new Date()
});

// Wallet 2 data
wallets.set('wallet2', {
  address: 'wallet2',
  ownedNfts: new Set(['nft2', 'nft4']),
  wantedNfts: new Set(['nft1', 'nft7']),
  lastUpdated: new Date()
});

// Wallet 3 data
wallets.set('wallet3', {
  address: 'wallet3',
  ownedNfts: new Set(['nft6', 'nft7']),
  wantedNfts: new Set(['nft3', 'nft4']),
  lastUpdated: new Date()
});

// Set up NFT ownership
for (const [walletAddr, walletState] of wallets.entries()) {
  for (const nft of walletState.ownedNfts) {
    nftOwnership.set(nft, walletAddr);
  }
}

// Set up wanted NFTs index
for (const [walletAddr, walletState] of wallets.entries()) {
  for (const nft of walletState.wantedNfts) {
    if (!wantedNfts.has(nft)) {
      wantedNfts.set(nft, new Set());
    }
    wantedNfts.get(nft)!.add(walletAddr);
  }
}

// Set up NFT demand metrics
const nftDemandMetrics = new Map<string, NFTDemandMetrics>();

// Add some demand metrics for testing
['nft1', 'nft2', 'nft3', 'nft4', 'nft5', 'nft6', 'nft7'].forEach((nft, index) => {
  nftDemandMetrics.set(nft, {
    wantCount: Math.floor(Math.random() * 10) + 1,
    supplyCount: 1,
    demandRatio: Math.floor(Math.random() * 10) + 1,
    requestCount: Math.floor(Math.random() * 15) + 1,
    lastRequested: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // Random time in the last week
  });
});

console.log(`Created ${wallets.size} wallets with ${nftOwnership.size} NFTs and ${wantedNfts.size} wanted NFTs`);

// --------------------------------------
// Test 1: Trade Loop Finding
// --------------------------------------

console.log(`\n${colors.magenta}Test 1: Trade Loop Finding${colors.reset}`);

async function testTradeLoopFinding() {
  try {
    // Initialize the trade loop finder service
    const tradeLoopFinder = new TradeLoopFinderService();
    
    console.log("Finding trade loops...");
    const tradeLoops = await tradeLoopFinder.findAllTradeLoops(
      wallets,
      nftOwnership,
      wantedNfts,
      rejectionPreferences
    );
    
    console.log(`Found ${tradeLoops.length} potential trade loops:`);
    
    // Print details of found trade loops
    tradeLoops.forEach((loop, index) => {
      console.log(`\n${colors.cyan}Trade Loop #${index + 1}:${colors.reset}`);
      console.log(`  ID: ${loop.id}`);
      console.log(`  Efficiency: ${loop.efficiency.toFixed(4)}`);
      console.log(`  Participants: ${loop.totalParticipants}`);
      console.log(`  Steps: ${loop.steps.length}`);
      
      // Print the path
      const path = loop.steps.map(step => `${step.from.substring(0, 8)}→${step.to.substring(0, 8)}`).join(' → ');
      console.log(`  Path: ${path}`);
    });
    
    return tradeLoops;
  } catch (error) {
    console.error(`${colors.red}Error in trade loop finding:${colors.reset}`, error);
    return [];
  }
}

// --------------------------------------
// Test 2: Trade Scoring
// --------------------------------------

console.log(`\n${colors.magenta}Test 2: Trade Scoring${colors.reset}`);

async function testTradeScoring(tradeLoops: TradeLoop[]) {
  try {
    // Initialize the trade score service
    const tradeScoreService = new TradeScoreService();
    
    if (tradeLoops.length === 0) {
      console.log("No trade loops to score");
      return;
    }
    
    console.log("Scoring trade loops...");
    
    // Score each trade loop
    const scoredLoops = tradeLoops.map(loop => {
      const scoreResult = tradeScoreService.calculateTradeScore(loop, nftDemandMetrics);
      
      return {
        ...loop,
        qualityScore: scoreResult.score,
        metrics: scoreResult.metrics
      };
    });
    
    // Sort by score and display results
    scoredLoops.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
    
    console.log(`\n${colors.green}Scored Trade Loops:${colors.reset}`);
    scoredLoops.forEach((loop, index) => {
      console.log(`\n${colors.cyan}Scored Trade Loop #${index + 1}:${colors.reset}`);
      console.log(`  ID: ${loop.id}`);
      console.log(`  Quality Score: ${(loop.qualityScore || 0).toFixed(4)} (${((loop.qualityScore || 0) * 100).toFixed(2)}%)`);
      console.log(`  Raw Efficiency: ${loop.rawEfficiency.toFixed(4)}`);
      
      // Print metrics if available
      if (loop.metrics) {
        console.log(`  Metrics:`);
        for (const [key, value] of Object.entries(loop.metrics)) {
          if (typeof value === 'number') {
            console.log(`    - ${key}: ${value.toFixed(4)}`);
          } else {
            console.log(`    - ${key}: ${value}`);
          }
        }
      }
    });
    
    return scoredLoops;
  } catch (error) {
    console.error(`${colors.red}Error in trade scoring:${colors.reset}`, error);
    return [];
  }
}

// Run tests
async function runTests() {
  try {
    const tradeLoops = await testTradeLoopFinding();
    await testTradeScoring(tradeLoops);
    
    console.log(`\n${colors.green}${colors.bright}All tests completed successfully!${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Test execution failed:${colors.reset}`, error);
  }
}

runTests().catch(err => console.error(err)); 