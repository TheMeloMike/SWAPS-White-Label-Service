import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Import the algorithm implementations
// Use any type for now to avoid TypeScript errors with internal implementation details
import { TradeDiscoveryService } from '../services/trade/TradeDiscoveryService';
import { GraphPartitioningService } from '../services/trade/GraphPartitioningService';
import { TradeLoopFinderService } from '../services/trade/TradeLoopFinderService';

// Define TradeLoop interface to match the expected structure
interface TradeLoop {
  id: string;
  steps?: Array<{
    from: string;
    to: string;
    nfts: Array<{
      address: string;
      name?: string;
    }>;
  }>;
  totalParticipants?: number;
  efficiency?: number;
}

/**
 * Large-scale test for the SWAPS algorithm
 * 
 * This test directly instantiates the algorithm classes and tests them with
 * large simulated datasets to measure performance and correctness.
 */

// Configuration
const TEST_CONFIG = {
  walletCount: 1000,
  nftCount: 10000,
  nftsPerWallet: {
    min: 1,
    max: 10
  },
  wantsPerWallet: {
    min: 1,
    max: 20
  },
  // Percentage of wallets in different trade patterns
  tradePatterns: {
    directSwap: 0.2,    // A wants B's NFT, B wants A's NFT
    circular3: 0.15,    // A→B→C→A
    circular4to6: 0.1,  // Larger circular trades (4-6 parties)
    random: 0.55        // Random preferences
  },
  algorithm: {
    maxDepth: 10,
    minEfficiency: 0.6,
    timeout: 60000 // 60 seconds
  },
  sampleSize: 20  // Number of random wallets to test
};

// Test structure
class ScaleTest {
  private wallets: string[] = [];
  private nfts: string[] = [];
  private nftOwnership = new Map<string, string>(); // NFT address -> wallet address
  private walletNfts = new Map<string, string[]>(); // wallet address -> owned NFT addresses
  private walletWants = new Map<string, string[]>(); // wallet address -> wanted NFT addresses
  
  private tradeDiscovery: any; // Using any type to avoid TypeScript errors
  
  // Statistics
  private stats = {
    generationTime: 0,
    totalProcessingTime: 0,
    averageProcessingTime: 0,
    totalTradesFound: 0,
    directTrades: 0,
    circularTrades: 0,
    complexTrades: 0,
    largestTradeSize: 0,
    tradesBySize: {} as Record<string, number>,
    walletResults: [] as any[]
  };
  
  constructor(private config = TEST_CONFIG) {
    // Initialize the algorithm with mock dependencies if needed
    try {
      // Initialize algorithm components
      // @ts-ignore - Ignore TypeScript errors due to private constructors
      const graphPartitioning = new GraphPartitioningService();
      
      // @ts-ignore - Ignore TypeScript errors due to constructor signature
      const tradeLoopFinder = new TradeLoopFinderService({
        maxDepth: config.algorithm.maxDepth,
        minEfficiency: config.algorithm.minEfficiency,
        timeout: config.algorithm.timeout
      });
      
      // Create trade discovery service with persistence disabled
      // @ts-ignore - Ignore TypeScript errors due to private constructors
      this.tradeDiscovery = new TradeDiscoveryService({
        persistenceEnabled: false,
        graphPartitioning,
        tradeLoopFinder
      });
      
      console.log("Successfully initialized trade algorithm components");
    } catch (error) {
      console.error("Error initializing trade algorithm:", error);
      throw error;
    }
  }
  
  /**
   * Run the full scale test
   */
  async run() {
    console.log('=== SWAPS Algorithm Scale Test ===');
    console.log(`Testing with ${this.config.walletCount} wallets and ${this.config.nftCount} NFTs`);
    
    // Generate test data
    await this.generateData();
    
    // Load data into algorithm
    this.loadDataIntoAlgorithm();
    
    // Test with sample wallets
    await this.testWithSampleWallets();
    
    // Print results
    this.printResults();
    
    // Save results
    this.saveResults();
    
    return this.stats;
  }
  
  /**
   * Generate simulated test data
   */
  private async generateData() {
    console.log('\nGenerating test data...');
    const startTime = performance.now();
    
    // Generate wallets
    for (let i = 0; i < this.config.walletCount; i++) {
      const wallet = `wallet_${uuidv4().substring(0, 8)}`;
      this.wallets.push(wallet);
      this.walletNfts.set(wallet, []);
      this.walletWants.set(wallet, []);
    }
    
    // Generate NFTs
    for (let i = 0; i < this.config.nftCount; i++) {
      const nft = `nft_${uuidv4().substring(0, 8)}`;
      this.nfts.push(nft);
    }
    
    // Distribute NFTs to wallets
    this.distributeNFTsToWallets();
    
    // Generate trade preferences
    this.generateTradePreferences();
    
    const endTime = performance.now();
    this.stats.generationTime = Math.round(endTime - startTime);
    
    console.log(`Data generation completed in ${this.stats.generationTime}ms`);
    console.log(`- ${this.wallets.length} wallets created`);
    console.log(`- ${this.nfts.length} NFTs created`);
    
    // Calculate NFT distribution stats
    let minNfts = Infinity;
    let maxNfts = 0;
    let totalNfts = 0;
    
    for (const wallet of this.wallets) {
      const nfts = this.walletNfts.get(wallet) || [];
      minNfts = Math.min(minNfts, nfts.length);
      maxNfts = Math.max(maxNfts, nfts.length);
      totalNfts += nfts.length;
    }
    
    console.log(`- NFT distribution: min=${minNfts}, max=${maxNfts}, avg=${(totalNfts / this.wallets.length).toFixed(2)}`);
    
    // Calculate wants distribution stats
    let minWants = Infinity;
    let maxWants = 0;
    let totalWants = 0;
    
    for (const wallet of this.wallets) {
      const wants = this.walletWants.get(wallet) || [];
      minWants = Math.min(minWants, wants.length);
      maxWants = Math.max(maxWants, wants.length);
      totalWants += wants.length;
    }
    
    console.log(`- Wants distribution: min=${minWants}, max=${maxWants}, avg=${(totalWants / this.wallets.length).toFixed(2)}`);
  }
  
  /**
   * Distribute NFTs to wallets
   */
  private distributeNFTsToWallets() {
    // Create a copy of NFTs to distribute
    const availableNfts = [...this.nfts];
    
    // First pass: Assign based on nftsPerWallet config
    for (const wallet of this.wallets) {
      // Random number of NFTs for this wallet
      const nftCount = Math.floor(
        this.config.nftsPerWallet.min +
        Math.random() * (this.config.nftsPerWallet.max - this.config.nftsPerWallet.min + 1)
      );
      
      // Get random NFTs for this wallet
      for (let i = 0; i < nftCount && availableNfts.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * availableNfts.length);
        const nft = availableNfts.splice(randomIndex, 1)[0];
        
        // Update data structures
        this.walletNfts.get(wallet)?.push(nft);
        this.nftOwnership.set(nft, wallet);
      }
    }
    
    // Second pass: Distribute any remaining NFTs
    while (availableNfts.length > 0) {
      const randomWalletIndex = Math.floor(Math.random() * this.wallets.length);
      const wallet = this.wallets[randomWalletIndex];
      const nft = availableNfts.pop()!;
      
      this.walletNfts.get(wallet)?.push(nft);
      this.nftOwnership.set(nft, wallet);
    }
  }
  
  /**
   * Generate trade preferences (wants) with specific patterns
   */
  private generateTradePreferences() {
    // Calculate how many wallets for each pattern
    const { directSwap, circular3, circular4to6 } = this.config.tradePatterns;
    
    const directSwapWallets = Math.floor(this.wallets.length * directSwap);
    const circular3Wallets = Math.floor(this.wallets.length * circular3);
    const circular4to6Wallets = Math.floor(this.wallets.length * circular4to6);
    
    // Create wallet pools
    const availableWallets = [...this.wallets];
    
    // Create direct swap patterns (A wants B's NFT, B wants A's NFT)
    for (let i = 0; i < directSwapWallets / 2; i++) {
      if (availableWallets.length < 2) break;
      
      // Get two random wallets
      const walletAIndex = Math.floor(Math.random() * availableWallets.length);
      const walletA = availableWallets.splice(walletAIndex, 1)[0];
      
      const walletBIndex = Math.floor(Math.random() * availableWallets.length);
      const walletB = availableWallets.splice(walletBIndex, 1)[0];
      
      // Get an NFT from each wallet
      const nftsA = this.walletNfts.get(walletA) || [];
      const nftsB = this.walletNfts.get(walletB) || [];
      
      if (nftsA.length > 0 && nftsB.length > 0) {
        const nftA = nftsA[Math.floor(Math.random() * nftsA.length)];
        const nftB = nftsB[Math.floor(Math.random() * nftsB.length)];
        
        // Set preferences
        this.walletWants.get(walletA)?.push(nftB);
        this.walletWants.get(walletB)?.push(nftA);
      }
    }
    
    // Create 3-way circular trades (A→B→C→A)
    for (let i = 0; i < circular3Wallets / 3; i++) {
      if (availableWallets.length < 3) break;
      
      // Get three random wallets
      const wallets = [];
      for (let j = 0; j < 3; j++) {
        const index = Math.floor(Math.random() * availableWallets.length);
        wallets.push(availableWallets.splice(index, 1)[0]);
      }
      
      // Create circular wants
      for (let j = 0; j < 3; j++) {
        const currentWallet = wallets[j];
        const nextWallet = wallets[(j + 1) % 3];
        
        const nextWalletNfts = this.walletNfts.get(nextWallet) || [];
        if (nextWalletNfts.length > 0) {
          const nft = nextWalletNfts[Math.floor(Math.random() * nextWalletNfts.length)];
          this.walletWants.get(currentWallet)?.push(nft);
        }
      }
    }
    
    // Create larger circular trades (4-6 parties)
    const possibleSizes = [4, 5, 6];
    let remainingCircularWallets = circular4to6Wallets;
    
    while (remainingCircularWallets > 0 && availableWallets.length >= 4) {
      // Choose a random size for this circular trade
      const size = possibleSizes[Math.floor(Math.random() * possibleSizes.length)];
      
      if (availableWallets.length < size) break;
      
      // Get random wallets
      const wallets = [];
      for (let j = 0; j < size; j++) {
        const index = Math.floor(Math.random() * availableWallets.length);
        wallets.push(availableWallets.splice(index, 1)[0]);
      }
      
      // Create circular wants
      for (let j = 0; j < size; j++) {
        const currentWallet = wallets[j];
        const nextWallet = wallets[(j + 1) % size];
        
        const nextWalletNfts = this.walletNfts.get(nextWallet) || [];
        if (nextWalletNfts.length > 0) {
          const nft = nextWalletNfts[Math.floor(Math.random() * nextWalletNfts.length)];
          this.walletWants.get(currentWallet)?.push(nft);
        }
      }
      
      remainingCircularWallets -= size;
    }
    
    // Create random preferences for remaining wallets
    for (const wallet of availableWallets) {
      // Determine how many NFTs to want
      const wantCount = Math.floor(
        this.config.wantsPerWallet.min +
        Math.random() * (this.config.wantsPerWallet.max - this.config.wantsPerWallet.min + 1)
      );
      
      // Get list of NFTs not owned by this wallet
      const ownedNfts = new Set(this.walletNfts.get(wallet) || []);
      const availableNfts = this.nfts.filter(nft => !ownedNfts.has(nft));
      
      // Randomly select NFTs to want
      for (let i = 0; i < wantCount && i < availableNfts.length; i++) {
        const randomIndex = Math.floor(Math.random() * availableNfts.length);
        const nft = availableNfts.splice(randomIndex, 1)[0];
        
        this.walletWants.get(wallet)?.push(nft);
      }
    }
  }
  
  /**
   * Load the generated data into the algorithm
   */
  private loadDataIntoAlgorithm() {
    console.log('\nLoading data into algorithm...');
    
    try {
      // Register wallets
      for (const wallet of this.wallets) {
        this.tradeDiscovery.registerWallet(wallet);
      }
      
      // Register NFT ownership
      for (const [nft, wallet] of this.nftOwnership.entries()) {
        this.tradeDiscovery.registerNFT(nft, wallet);
      }
      
      // Register trade preferences
      for (const [wallet, wants] of this.walletWants.entries()) {
        for (const nft of wants) {
          this.tradeDiscovery.addTradePreference(wallet, nft);
        }
      }
      
      console.log(`Registered ${this.wallets.length} wallets, ${this.nfts.length} NFTs, and trade preferences`);
    } catch (error) {
      console.error("Error loading data into algorithm:", error);
      throw error;
    }
  }
  
  /**
   * Test the algorithm with a sample of wallets
   */
  private async testWithSampleWallets() {
    console.log(`\nTesting algorithm with ${this.config.sampleSize} random wallets...`);
    
    // Select random wallets to test
    const sampleWallets = this.getRandomSampleWallets();
    
    // Track overall processing time
    let totalProcessingTime = 0;
    let walletResults = [];
    
    // Test each wallet
    for (const wallet of sampleWallets) {
      console.log(`\nFinding trades for wallet: ${wallet}`);
      
      try {
        const startTime = performance.now();
        
        // Call the actual algorithm
        const results = await this.tradeDiscovery.findTradeLoops(wallet);
        
        const endTime = performance.now();
        const processingTime = Math.round(endTime - startTime);
        totalProcessingTime += processingTime;
        
        // Get the trade loops
        const trades = results || [];
        
        console.log(`Found ${trades.length} trades in ${processingTime}ms`);
        this.stats.totalTradesFound += trades.length;
        
        // Store individual wallet result
        const walletResult = {
          wallet,
          processingTime,
          tradesFound: trades.length,
          tradeDetails: [] as any[]
        };
        
        // Analyze the trades
        if (trades.length > 0) {
          for (const trade of trades) {
            const steps = trade.steps?.length || 0;
            
            // Categorize by size
            if (steps === 2) {
              this.stats.directTrades++;
            } else if (steps >= 3 && steps <= 6) {
              this.stats.circularTrades++;
            } else {
              this.stats.complexTrades++;
            }
            
            // Track trade by size
            this.stats.tradesBySize[steps.toString()] = (this.stats.tradesBySize[steps.toString()] || 0) + 1;
            
            // Track largest trade
            this.stats.largestTradeSize = Math.max(this.stats.largestTradeSize, steps);
            
            // Store trade details
            walletResult.tradeDetails.push({
              id: trade.id,
              steps: steps,
              participants: trade.totalParticipants || steps,
              efficiency: trade.efficiency || 0
            });
            
            // Output trade information
            console.log(`- Trade with ${steps} steps and ${trade.totalParticipants || steps} participants`);
            console.log(`  Efficiency: ${trade.efficiency?.toFixed(4) || 'N/A'}`);
          }
        }
        
        walletResults.push(walletResult);
        
      } catch (error) {
        console.error(`Error finding trades for wallet ${wallet}:`, error);
      }
    }
    
    // Update statistics
    this.stats.totalProcessingTime = totalProcessingTime;
    this.stats.averageProcessingTime = Math.round(totalProcessingTime / sampleWallets.length);
    this.stats.walletResults = walletResults;
    
    console.log(`\nCompleted testing ${sampleWallets.length} wallets`);
    console.log(`Total processing time: ${totalProcessingTime}ms`);
    console.log(`Average processing time: ${this.stats.averageProcessingTime}ms per wallet`);
  }
  
  /**
   * Get a random sample of wallets to test
   */
  private getRandomSampleWallets(): string[] {
    const sampleSize = Math.min(this.config.sampleSize, this.wallets.length);
    const walletsCopy = [...this.wallets];
    const sample = [];
    
    for (let i = 0; i < sampleSize; i++) {
      const randomIndex = Math.floor(Math.random() * walletsCopy.length);
      sample.push(walletsCopy.splice(randomIndex, 1)[0]);
    }
    
    return sample;
  }
  
  /**
   * Print results to the console
   */
  private printResults() {
    console.log('\n=== SWAPS Algorithm Scale Test Results ===');
    console.log('Test Configuration:');
    console.log(`- Wallets: ${this.config.walletCount}`);
    console.log(`- NFTs: ${this.config.nftCount}`);
    console.log(`- Algorithm max depth: ${this.config.algorithm.maxDepth}`);
    
    console.log('\nPerformance Results:');
    console.log(`- Data generation time: ${this.stats.generationTime}ms`);
    console.log(`- Total processing time: ${this.stats.totalProcessingTime}ms`);
    console.log(`- Average processing time: ${this.stats.averageProcessingTime}ms per wallet`);
    
    console.log('\nTrade Statistics:');
    console.log(`- Total trades found: ${this.stats.totalTradesFound}`);
    console.log(`- Direct trades (2 parties): ${this.stats.directTrades}`);
    console.log(`- Circular trades (3-6 parties): ${this.stats.circularTrades}`);
    console.log(`- Complex trades (>6 parties): ${this.stats.complexTrades}`);
    console.log(`- Largest trade size: ${this.stats.largestTradeSize} parties`);
    
    console.log('\nTrades by Size:');
    const sizes = Object.keys(this.stats.tradesBySize).sort((a, b) => parseInt(a) - parseInt(b));
    for (const size of sizes) {
      console.log(`- ${size} parties: ${this.stats.tradesBySize[size]} trades`);
    }
  }
  
  /**
   * Save results to a file
   */
  private saveResults() {
    const resultsDir = path.join(__dirname, '../../test-results');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const filename = path.join(resultsDir, `scale-test-${timestamp}.json`);
    
    const results = {
      config: this.config,
      stats: this.stats,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to ${filename}`);
  }
}

/**
 * Run the scale test
 */
async function runTest(config?: typeof TEST_CONFIG) {
  // Parse command line arguments to override config
  const args = process.argv.slice(2);
  const overrides = {} as any;
  
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      
      if (key && value) {
        try {
          // Try to parse as number first
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            overrides[key] = numValue;
          } else {
            // Otherwise use as string
            overrides[key] = value;
          }
        } catch {
          overrides[key] = value;
        }
      }
    }
  }
  
  // Apply overrides to config
  const testConfig = { 
    ...TEST_CONFIG,
    ...config,
    ...overrides
  };
  
  // Create and run the test
  const test = new ScaleTest(testConfig);
  await test.run();
}

// When run directly
if (require.main === module) {
  // Set required environment variables if not already set
  process.env.HELIUS_API_KEY = process.env.HELIUS_API_KEY || 'mock_key_for_testing';
  process.env.SWAP_PROGRAM_ID = process.env.SWAP_PROGRAM_ID || 'Swap111111111111111111111111111111111111111';
  
  runTest()
    .then(() => {
      process.exit(0);
    })
    .catch(err => {
      console.error('Error running scale test:', err);
      process.exit(1);
    });
}

// Export for use in other modules
export { ScaleTest, TEST_CONFIG, runTest }; 