#!/usr/bin/env node

/**
 * SWAPS Algorithm Integration Test
 * 
 * This script runs integration tests with the actual algorithm by spawning
 * a ts-node process to execute TypeScript code directly.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Simple colored output
const colors = {
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  magenta: (text) => `\x1b[35m${text}\x1b[0m`
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    walletCount: 500,
    nftCount: 5000,
    verbose: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      
      if (key === 'wallets' && value) {
        config.walletCount = parseInt(value, 10);
      } else if (key === 'nfts' && value) {
        config.nftCount = parseInt(value, 10);
      } else if (key === 'verbose') {
        config.verbose = true;
      }
    }
  }
  
  return config;
}

// Create TypeScript test file
function createTypeScriptTest(config) {
  const testDir = path.join(__dirname, 'test-data');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const tsFilePath = path.join(testDir, 'integration-test.ts');
  
  const tsCode = `
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
  console.log('\\n=== SWAPS Algorithm Integration Test ===');
  console.log(\`Testing with \${${config.walletCount}} wallets and \${${config.nftCount}} NFTs\\n\`);
  
  // Create simulation with test data
  const simulation = new TradeSimulation({
    walletCount: ${config.walletCount},
    nftCount: ${config.nftCount},
    outputDir: './test-data'
  });
  
  // Generate test data
  console.log('Generating simulated wallet and NFT data...');
  const startGen = Date.now();
  await simulation.generateTestData();
  const genTime = Date.now() - startGen;
  console.log(\`Data generation completed in \${genTime}ms\\n\`);
  
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
  
  console.log(\`Registered \${simulation.wallets.length} wallets, \${simulation.nfts.length} NFTs, and trade preferences\\n\`);
  
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
    console.log(\`\\nFinding trades for wallet: \${wallet}\`);
    
    try {
      // Find trade loops using actual algorithm
      const results = await tradeDiscovery.findTradeLoops(wallet);
      const trades = results?.tradeLoops || [];
      
      console.log(\`Found \${trades.length} trades\`);
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
          console.log(\`- Trade with \${steps} steps and \${trade.totalParticipants || steps} participants\`);
          console.log(\`  Efficiency: \${trade.efficiency || 'N/A'}\`);
          
          if (${config.verbose} && trade.steps) {
            for (let i = 0; i < trade.steps.length; i++) {
              const step = trade.steps[i];
              console.log(\`  Step \${i+1}: \${step.from?.substring(0, 8)} → \${step.to?.substring(0, 8)}\`);
            }
          }
        }
      }
    } catch (error) {
      console.error(\`Error finding trades for wallet \${wallet}:\`, error);
    }
  }
  
  const endTime = Date.now();
  processingTime = endTime - startTime;
  
  // Print summary results
  console.log('\\n=== SWAPS Algorithm Test Results ===');
  console.log(\`Data generation time: \${genTime}ms\`);
  console.log(\`Algorithm runtime: \${processingTime}ms\`);
  console.log(\`Total trades found: \${totalTradesFound}\`);
  console.log(\`Direct trades (2 parties): \${directTrades}\`);
  console.log(\`Circular trades (3-6 parties): \${circularTrades}\`);
  console.log(\`Complex trades (>6 parties): \${complexTrades}\`);
  console.log(\`Largest trade size: \${largestTradeSize} parties\`);
  
  console.log('\\nTrades by Size:');
  const sizes = Object.keys(tradesBySize).sort((a, b) => parseInt(a) - parseInt(b));
  for (const size of sizes) {
    console.log(\`- \${size} parties: \${tradesBySize[size]} trades\`);
  }
  
  // Save results
  const resultsFile = path.join('./test-data', 'integration-test-results.json');
  const results = {
    config: {
      walletCount: ${config.walletCount},
      nftCount: ${config.nftCount}
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
  console.log(\`\\nResults saved to \${resultsFile}\`);
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
`;
  
  fs.writeFileSync(tsFilePath, tsCode, 'utf8');
  return tsFilePath;
}

// Run the test with ts-node
function runTest(tsFilePath, config) {
  console.log(colors.blue('=== SWAPS Algorithm Integration Test Runner ==='));
  console.log(colors.yellow('Configuration:'));
  console.log(`- Wallets: ${config.walletCount}`);
  console.log(`- NFTs: ${config.nftCount}`);
  console.log(`- Verbose: ${config.verbose}`);
  
  // Set required environment variables
  const env = {
    ...process.env,
    HELIUS_API_KEY: 'mock_key_for_testing',
    SWAP_PROGRAM_ID: 'Swap111111111111111111111111111111111111111',
    TS_NODE_TRANSPILE_ONLY: 'true'
  };
  
  // Spawn ts-node process
  const tsNode = spawn('npx', ['ts-node', tsFilePath], { 
    env,
    stdio: 'inherit'
  });
  
  return new Promise((resolve, reject) => {
    tsNode.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Test exited with code ${code}`));
      }
    });
    
    tsNode.on('error', (err) => {
      reject(err);
    });
  });
}

// Main function
async function main() {
  const config = parseArgs();
  const tsFilePath = createTypeScriptTest(config);
  
  try {
    await runTest(tsFilePath, config);
    console.log(colors.green('\n=== Test completed successfully ==='));
    process.exit(0);
  } catch (error) {
    console.error(colors.red(`\n=== Test failed: ${error.message} ===`));
    process.exit(1);
  }
}

// Run the main function
main(); 