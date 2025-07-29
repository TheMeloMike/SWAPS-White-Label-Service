
// Import simulation framework
import { TradeSimulation } from '../scale-test-algorithm';

// Import actual algorithm implementations
import { TradeLoopFinderService } from '../backend/src/services/trade/TradeLoopFinderService';
import { TradeDiscoveryService } from '../backend/src/services/trade/TradeDiscoveryService';
import { GraphPartitioningService } from '../backend/src/services/trade/GraphPartitioningService';

// Statistics gathering
let totalTradesFound = 0;
let directTrades = 0;
let circularTrades = 0;
let complexTrades = 0;
let processingTime = 0;
let largestTradeSize = 0;
const tradesBySize = {};

async function runTest() {
  console.log('\n=== SWAPS Algorithm Integration Test ===');
  console.log(`Testing with ${500} wallets and ${5000} NFTs\n`);
  
  // Create simulation with test data
  const simulation = new TradeSimulation({
    walletCount: 500,
    nftCount: 5000,
    outputDir: './test-data'
  });
  
  // Generate test data
  console.log('Generating simulated wallet and NFT data...');
  const startGen = Date.now();
  await simulation.generateTestData();
  const genTime = Date.now() - startGen;
  console.log(`Data generation completed in ${genTime}ms\n`);
  
  // Initialize actual algorithm
  console.log('Initializing actual algorithm implementation...');
  const graphPartitioning = new GraphPartitioningService();
  const tradeLoopFinder = new TradeLoopFinderService({
    maxDepth: 10,
    minEfficiency: 0.6,
    timeout: 30000 // 30 seconds
  });
  
  const tradeDiscovery = new TradeDiscoveryService({
    graphPartitioning,
    tradeLoopFinder,
    persistenceEnabled: false
  });
  
  // Register wallets, NFTs and preferences
  console.log('Loading test data into algorithm...');
  
  // Register wallets
  for (const wallet of simulation.wallets) {
    tradeDiscovery.registerWallet(wallet);
  }
  
  // Register NFT ownership
  for (const [nftAddress, walletAddress] of simulation.nftOwnership.entries()) {
    tradeDiscovery.registerNFT(nftAddress, walletAddress);
  }
  
  // Register trade preferences
  for (const [wallet, wants] of simulation.walletWants.entries()) {
    for (const nft of wants) {
      tradeDiscovery.addTradePreference(wallet, nft);
    }
  }
  
  console.log(`Registered ${simulation.wallets.length} wallets, ${simulation.nfts.length} NFTs, and trade preferences\n`);
  
  // Test algorithm with sample wallets
  console.log('Testing algorithm with sample wallets...');
  const sampleSize = Math.min(10, simulation.wallets.length);
  const sampleWallets = [];
  
  for (let i = 0; i < sampleSize; i++) {
    const randomIndex = Math.floor(Math.random() * simulation.wallets.length);
    sampleWallets.push(simulation.wallets[randomIndex]);
  }
  
  // Run algorithm and measure performance
  const startTime = Date.now();
  
  for (const wallet of sampleWallets) {
    console.log(`\nFinding trades for wallet: ${wallet}`);
    
    try {
      // Find trade loops using actual algorithm
      const results = await tradeDiscovery.findTradeLoops(wallet);
      const trades = results?.tradeLoops || [];
      
      console.log(`Found ${trades.length} trades`);
      totalTradesFound += trades.length;
      
      if (trades.length > 0) {
        // Analyze types of trades found
        for (const trade of trades) {
          const steps = trade.steps?.length || 0;
          
          // Categorize trade
          if (steps === 2) {
            directTrades++;
          } else if (steps >= 3 && steps <= 6) {
            circularTrades++;
          } else {
            complexTrades++;
          }
          
          // Track trade sizes
          tradesBySize[steps] = (tradesBySize[steps] || 0) + 1;
          largestTradeSize = Math.max(largestTradeSize, steps);
          
          // Output trade details
          console.log(`- Trade with ${steps} steps and ${trade.totalParticipants || steps} participants`);
          console.log(`  Efficiency: ${trade.efficiency || 'N/A'}`);
          
          if (false && trade.steps) {
            for (let i = 0; i < trade.steps.length; i++) {
              const step = trade.steps[i];
              console.log(`  Step ${i+1}: ${step.from?.substring(0, 8)} → ${step.to?.substring(0, 8)}`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error finding trades for wallet ${wallet}:`, error);
    }
  }
  
  const endTime = Date.now();
  processingTime = endTime - startTime;
  
  // Print summary results
  console.log('\n=== SWAPS Algorithm Test Results ===');
  console.log(`Data generation time: ${genTime}ms`);
  console.log(`Algorithm runtime: ${processingTime}ms`);
  console.log(`Total trades found: ${totalTradesFound}`);
  console.log(`Direct trades (2 parties): ${directTrades}`);
  console.log(`Circular trades (3-6 parties): ${circularTrades}`);
  console.log(`Complex trades (>6 parties): ${complexTrades}`);
  console.log(`Largest trade size: ${largestTradeSize} parties`);
  
  console.log('\nTrades by Size:');
  const sizes = Object.keys(tradesBySize).sort((a, b) => parseInt(a) - parseInt(b));
  for (const size of sizes) {
    console.log(`- ${size} parties: ${tradesBySize[size]} trades`);
  }
  
  // Save results
  const resultsFile = path.join('./test-data', 'integration-test-results.json');
  const results = {
    config: {
      walletCount: 500,
      nftCount: 5000
    },
    stats: {
      generationTime: genTime,
      processingTime,
      totalTradesFound,
      directTrades,
      circularTrades,
      complexTrades,
      tradesBySize,
      largestTradeSize
    },
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to ${resultsFile}`);
}

// Run the test
runTest()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('Error running integration test:', err);
    process.exit(1);
  });
