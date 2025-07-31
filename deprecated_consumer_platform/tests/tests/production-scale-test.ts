console.log("=======================================");
console.log("PRODUCTION SCALE TEST STARTING");
console.log("=======================================");

import * as crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

// Import the actual production trade algorithm services
import { TradeDiscoveryService } from '../services/trade/TradeDiscoveryService';
import { TradeLoopFinderService } from '../services/trade/TradeLoopFinderService';
import { GraphPartitioningService } from '../services/trade/GraphPartitioningService';
import { TradeScoreService } from '../services/trade/TradeScoreService';
import { ScalableTradeLoopFinderService } from '../services/trade/ScalableTradeLoopFinderService';
import { BundleTradeLoopFinderService } from '../services/trade/BundleTradeLoopFinderService';
import { WalletService } from '../services/trade/WalletService';
import { KafkaIntegrationService } from '../services/trade/KafkaIntegrationService';
import { LoggingService } from '../utils/logging/LoggingService';

// Add imports for our mock services
import { MockNFTService } from './mock-services/MockNFTService';
import { MockPricingService } from './mock-services/MockPricingService';
import { MockTradeScoreService } from './mock-services/MockTradeScoreService';

// Import required types
import { WalletState, TradeLoop, RejectionPreferences } from './types';

// Configure logging
process.env.LOG_LEVEL = 'info';
const logger = LoggingService.getInstance().createLogger('ProductionScaleTest');

// Override console.log to ensure immediate output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = function(...args) {
  // Force immediate unbuffered output
  process.stdout.write(args.map(a => String(a)).join(' ') + '\n');
};

console.error = function(...args) {
  // Force immediate unbuffered output for errors
  process.stderr.write(args.map(a => String(a)).join(' ') + '\n');
};

// Generate unique IDs without external dependencies
function generateId(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Define the test configuration
interface TestConfig {
  walletCount: number;
  nftCount: number;
  nftsPerWallet: {
    min: number;
    max: number;
  };
  wantsPerWallet: {
    min: number;
    max: number;
  };
  tradePatterns: {
    directSwap: number;
    circular3: number;
    circular4to6: number;
    random: number;
  };
  algorithm: {
    maxDepth: number;
    minEfficiency: number;
    timeout: number;
  };
  sampleSize: number;
}

// Default configuration
const DEFAULT_CONFIG: TestConfig = {
  walletCount: 100,
  nftCount: 500,
  nftsPerWallet: {
    min: 2,
    max: 15
  },
  wantsPerWallet: {
    min: 5,
    max: 30
  },
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

/**
 * Production-grade scale test for the SWAPS algorithm
 * 
 * This test uses the actual production algorithm implementation,
 * not a simplified version. It tests with large simulated datasets
 * to measure algorithm performance at scale.
 */
class ProductionScaleTest {
  private wallets: string[] = [];
  private nfts: string[] = [];
  private nftOwnership = new Map<string, string>(); // NFT address -> wallet address
  private walletNfts = new Map<string, Set<string>>(); // wallet address -> owned NFT set
  private walletWants = new Map<string, Set<string>>(); // wallet address -> wanted NFT set
  
  // Actual production services
  private tradeDiscoveryService: TradeDiscoveryService | null = null;
  private tradeLoopFinder: TradeLoopFinderService | null = null;
  private scalableTradeLoopFinder: ScalableTradeLoopFinderService | null = null;
  private bundleTradeLoopFinder: BundleTradeLoopFinderService | null = null;
  private graphPartitioning: GraphPartitioningService | null = null;
  
  // Statistics
  private stats = {
    generateTime: 0,
    totalProcessingTime: 0,
    averageProcessingTime: 0,
    totalTradesFound: 0,
    directTrades: 0,
    circularTrades: 0,
    complexTrades: 0,
    largestTradeSize: 0,
    largestCommunitySize: 0,
    communityCount: 0,
    tradesBySize: {} as Record<string, number>,
    walletResults: [] as any[]
  };
  
  constructor(private config = DEFAULT_CONFIG) {
    process.env.TRADELOOP_MAX_DEPTH = String(config.algorithm.maxDepth);
    process.env.TRADELOOP_MIN_EFFICIENCY = String(config.algorithm.minEfficiency);
    process.env.TRADELOOP_GLOBAL_TIMEOUT_MS = String(config.algorithm.timeout);
    process.env.ENABLE_PERSISTENCE = 'false';
    
    // Ensure Helius API key is set
    if (!process.env.HELIUS_API_KEY) {
      process.env.HELIUS_API_KEY = 'mock_key_for_testing';
    }
    
    logger.info('Scale test initialized with configuration', {
      walletCount: config.walletCount,
      nftCount: config.nftCount,
      maxDepth: config.algorithm.maxDepth,
      minEfficiency: config.algorithm.minEfficiency,
      timeout: config.algorithm.timeout
    });
  }
  
  /**
   * Run the full scale test
   */
  async run() {
    console.log('\n========== STARTING PRODUCTION ALGORITHM SCALE TEST ==========');
    logger.info('=== SWAPS Production Algorithm Scale Test ===');
    logger.info(`Testing with ${this.config.walletCount} wallets and ${this.config.nftCount} NFTs`);
    
    try {
      // 1. Generate test data
      console.log('\n=== STEP 1: GENERATING TEST DATA ===');
      await this.generateData();
      
      // 2. Initialize algorithm components
      console.log('\n=== STEP 2: INITIALIZING ALGORITHM COMPONENTS ===');
      this.initializeAlgorithm();
      
      // 3. Test with sample wallets
      console.log('\n=== STEP 3: TESTING TRADE DISCOVERY ===');
      await this.testTradeDiscovery();
      
      // 4. Print results
      console.log('\n=== STEP 4: PRINTING RESULTS ===');
      this.printResults();
      
      // 5. Save results
      console.log('\n=== STEP 5: DISPLAYING DETAILED RESULTS ===');
      this.saveResults();
      
      console.log('\n========== PRODUCTION ALGORITHM SCALE TEST COMPLETED ==========');
      return this.stats;
    } catch (error) {
      console.error('\n========== ERROR IN PRODUCTION ALGORITHM SCALE TEST ==========');
      console.error(error);
      logger.error('Error running scale test', {
        error: error instanceof Error ? error.stack : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Generate simulated test data
   */
  private async generateData() {
    logger.info('Generating test data...');
    const startTime = performance.now();
    
    // Generate wallets
    for (let i = 0; i < this.config.walletCount; i++) {
      const wallet = `wallet_${generateId().substring(0, 8)}`;
      this.wallets.push(wallet);
      this.walletNfts.set(wallet, new Set());
      this.walletWants.set(wallet, new Set());
    }
    
    // Generate NFTs
    for (let i = 0; i < this.config.nftCount; i++) {
      const nft = `nft_${generateId().substring(0, 8)}`;
      this.nfts.push(nft);
    }
    
    // Distribute NFTs to wallets
    this.distributeNFTsToWallets();
    
    // Generate trade preferences
    this.generateTradePreferences();
    
    const endTime = performance.now();
    this.stats.generateTime = Math.round(endTime - startTime);
    
    logger.info(`Data generation completed in ${this.stats.generateTime}ms`);
    logger.info(`- ${this.wallets.length} wallets created`);
    logger.info(`- ${this.nfts.length} NFTs created`);
    
    // Calculate NFT distribution stats
    let minNfts = Infinity;
    let maxNfts = 0;
    let totalNfts = 0;
    
    for (const wallet of this.wallets) {
      const nfts = this.walletNfts.get(wallet) || new Set();
      minNfts = Math.min(minNfts, nfts.size);
      maxNfts = Math.max(maxNfts, nfts.size);
      totalNfts += nfts.size;
    }
    
    logger.info(`- NFT distribution: min=${minNfts}, max=${maxNfts}, avg=${(totalNfts / this.wallets.length).toFixed(2)}`);
    
    // Calculate wants distribution stats
    let minWants = Infinity;
    let maxWants = 0;
    let totalWants = 0;
    
    for (const wallet of this.wallets) {
      const wants = this.walletWants.get(wallet) || new Set();
      minWants = Math.min(minWants, wants.size);
      maxWants = Math.max(maxWants, wants.size);
      totalWants += wants.size;
    }
    
    logger.info(`- Wants distribution: min=${minWants}, max=${maxWants}, avg=${(totalWants / this.wallets.length).toFixed(2)}`);
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
        this.walletNfts.get(wallet)?.add(nft);
        this.nftOwnership.set(nft, wallet);
      }
    }
    
    // Second pass: Distribute any remaining NFTs
    while (availableNfts.length > 0) {
      const randomWalletIndex = Math.floor(Math.random() * this.wallets.length);
      const wallet = this.wallets[randomWalletIndex];
      const nft = availableNfts.pop()!;
      
      this.walletNfts.get(wallet)?.add(nft);
      this.nftOwnership.set(nft, wallet);
    }
  }
  
  /**
   * Generate random trade preferences (wants)
   */
  private generateTradePreferences() {
    // For each wallet, generate random preferences
    for (const wallet of this.wallets) {
      // Determine how many NFTs to want (between min and max from config)
      const wantCount = Math.floor(
        this.config.wantsPerWallet.min +
        Math.random() * (this.config.wantsPerWallet.max - this.config.wantsPerWallet.min + 1)
      );
      
      // Get list of NFTs not owned by this wallet
      const ownedNfts = this.walletNfts.get(wallet) || new Set();
      const availableNfts = this.nfts.filter(nft => !ownedNfts.has(nft));
      
      // Randomly select NFTs to want
      const wantsSet = this.walletWants.get(wallet) || new Set<string>();
      for (let i = 0; i < wantCount && i < availableNfts.length; i++) {
        const randomIndex = Math.floor(Math.random() * availableNfts.length);
        const nft = availableNfts.splice(randomIndex, 1)[0];
        
        wantsSet.add(nft);
      }
      
      // Ensure the set is stored back
      this.walletWants.set(wallet, wantsSet);
    }
  }
  
  /**
   * Initialize algorithm services
   */
  private initializeAlgorithm() {
    console.log('Initializing real production algorithm with mocked external services...');
    
    // Set environment variables to disable real API calls
    process.env.DISABLE_EXTERNAL_APIS = 'true';
    process.env.USE_MOCK_PRICING = 'true';
    process.env.ENABLE_PERSISTENCE = 'false';
    
    // Get the real production algorithm service
    this.tradeDiscoveryService = TradeDiscoveryService.getInstance();
    
    // Instrument the real service with our mock services to prevent API calls
    this.instrumentTradeDiscoveryService();
    
    // Now register all our test data with the service
    if (!this.tradeDiscoveryService) {
      throw new Error('Failed to initialize trade discovery service');
    }
    
    // Clear any existing data in the service
    this.clearServiceState();
    
    // Load our test data into the service
    this.loadDataIntoTradeService();
    
    // Store reference to graph partitioning service if available
    if ((this.tradeDiscoveryService as any).graphPartitioning) {
      this.graphPartitioning = (this.tradeDiscoveryService as any).graphPartitioning;
    }
    
    console.log('Production algorithm initialized and loaded with test data');
  }

  /**
   * Instrument the TradeDiscoveryService with mock services
   */
  private instrumentTradeDiscoveryService() {
    if (!this.tradeDiscoveryService) return;
    
    // Cast to any to access private fields for testing
    const service = this.tradeDiscoveryService as any;
    
    // Disable persistence
    if (service.persistenceManager) {
      service.persistenceManager.setEnabled(false);
    }
    
    // Inject mock services
    service.nftPricingService = MockPricingService.getInstance();
    service.tradeScoreService = MockTradeScoreService.getInstance();
    
    // Inject mock services into all loop finders
    if (service.legacyTradeLoopFinder) {
      const legacyFinder = service.legacyTradeLoopFinder as any;
      legacyFinder.nftService = MockNFTService.getInstance();
      legacyFinder.nftPricingService = MockPricingService.getInstance();
    }
    
    if (service.scalableTradeLoopFinder) {
      this.instrumentScalableTradeLoopFinder(service.scalableTradeLoopFinder);
    }
    
    if (service.bundleTradeLoopFinder) {
      this.instrumentBundleTradeLoopFinder(service.bundleTradeLoopFinder);
    }
    
    console.log('Production algorithm services instrumented with mocks');
  }
  
  /**
   * Instrument the ScalableTradeLoopFinder with mock services
   */
  private instrumentScalableTradeLoopFinder(finder: any) {
    if (!finder) return;
    
    // Inject mock services
    finder.nftPricingService = MockPricingService.getInstance();
    finder.nftService = MockNFTService.getInstance();
    
    // Also inject mocks into inner tradeLoopFinder if exists
    if (finder.tradeLoopFinder) {
      const innerFinder = finder.tradeLoopFinder as any;
      innerFinder.nftService = MockNFTService.getInstance();
      innerFinder.nftPricingService = MockPricingService.getInstance();
    }
  }
  
  /**
   * Instrument the BundleTradeLoopFinder with mock services
   */
  private instrumentBundleTradeLoopFinder(finder: any) {
    if (!finder) return;
    
    // Inject mock services
    finder.nftPricingService = MockPricingService.getInstance();
    finder.nftService = MockNFTService.getInstance();
    finder.tradeScoreService = MockTradeScoreService.getInstance();
  }
  
  /**
   * Clear all existing state from the service
   */
  private clearServiceState() {
    if (!this.tradeDiscoveryService) return;
    
    const service = this.tradeDiscoveryService as any;
    
    // Clear all data stores
    service.wallets = new Map();
    service.nftOwnership = new Map();
    service.wantedNfts = new Map();
    service.rejectionPreferences = new Map();
    service.nftDemandMetrics = new Map();
    service.nftValueRecords = new Map();
    
    console.log('Cleared existing service state');
  }
  
  /**
   * Load the generated data into the algorithm
   */
  private loadDataIntoTradeService() {
    if (!this.tradeDiscoveryService) {
      throw new Error('Trade discovery service not initialized');
    }
    
    logger.info('Loading test data into trade discovery service...');
    
    // Register wallets
    for (const wallet of this.wallets) {
      this.registerWallet(wallet);
    }
    
    // Register NFT ownership
    for (const [nft, wallet] of this.nftOwnership.entries()) {
      this.registerNFT(nft, wallet);
    }
    
    // Register trade preferences
    for (const [wallet, wants] of this.walletWants.entries()) {
      for (const nft of wants) {
        this.addTradePreference(wallet, nft);
      }
    }
    
    // Verify data was loaded correctly
    const systemState = this.tradeDiscoveryService.getSystemState();
    logger.info(`Registered ${systemState.wallets} wallets, ${systemState.nfts} NFTs, and ${systemState.wanted} preferences`);
  }
  
  /**
   * Register a wallet with the trade discovery service
   */
  private registerWallet(wallet: string) {
    if (!this.tradeDiscoveryService) return;
    
    // Get the wallets map from the service
    const walletsMap = this.tradeDiscoveryService.getWallets();
    
    // Create a wallet state object
    const walletState = {
      address: wallet,
      ownedNfts: this.walletNfts.get(wallet) || new Set(),
      wantedNfts: this.walletWants.get(wallet) || new Set(),
      lastUpdated: new Date()
    };
    
    // Add it to the wallets map
    walletsMap.set(wallet, walletState);
  }
  
  /**
   * Register an NFT with the trade discovery service
   */
  private registerNFT(nft: string, wallet: string) {
    if (!this.tradeDiscoveryService) return;
    
    // Cast to any to be able to access private properties for testing
    const serviceAny = this.tradeDiscoveryService as any;
    
    // Direct access to the internal nftOwnership map
    if (typeof serviceAny.nftOwnership !== 'undefined') {
      serviceAny.nftOwnership.set(nft, wallet);
    }
  }
  
  /**
   * Add a trade preference to the trade discovery service
   */
  private addTradePreference(wallet: string, nft: string) {
    if (!this.tradeDiscoveryService) return;
    
    // Get the wantedNfts map
    const wantedNftsMap = this.tradeDiscoveryService.getWantedNfts();
    
    // Ensure there's a set for this NFT
    if (!wantedNftsMap.has(nft)) {
      wantedNftsMap.set(nft, new Set());
    }
    
    // Add the wallet to the set of wallets that want this NFT
    wantedNftsMap.get(nft)?.add(wallet);
  }
  
  /**
   * Helper method to get a random element from a Set
   */
  private getRandomSetElement<T>(set: Set<T>): T {
    const items = Array.from(set);
    return items[Math.floor(Math.random() * items.length)];
  }

  /**
   * Test the trade discovery algorithm with our generated data
   */
  private async testTradeDiscovery() {
    if (!this.tradeDiscoveryService) {
      throw new Error('Trade discovery service not initialized');
    }
    
    console.log(`\n=== TESTING TRADE DISCOVERY WITH ${this.wallets.length} WALLETS ===`);
    
    try {
      // Set environment variables for configuration
      process.env.FORCE_SCALABLE_IMPLEMENTATION = 'true';
      process.env.ENABLE_BUNDLE_TRADES = 'true';
      
      // Record start time
      const startTime = performance.now();
      
      // Find trade loops using the service
      console.log('Running trade discovery...');
      const trades = await (this.tradeDiscoveryService as any).findTradeLoops();
      
      // Calculate processing time
      const endTime = performance.now();
      this.stats.totalProcessingTime = Math.round(endTime - startTime);
      
      console.log(`\n========= TRADE DISCOVERY COMPLETED =========`);
      console.log(`Processing time: ${this.stats.totalProcessingTime}ms`);
      console.log(`Found ${trades.length} trades`);
      
      // Process trade results
      this.processTradeResults(trades);
      
      return trades;
    } catch (error) {
      console.error('Error during trade discovery:', error);
      throw error;
    }
  }
  
  /**
   * Process the trade results for statistics
   */
  private processTradeResults(trades: TradeLoop[]) {
    this.stats.totalTradesFound = trades.length;
    
    console.log(`\n=== FOUND ${trades.length} TOTAL TRADES ===`);
    
    // Count trade types
    for (const trade of trades) {
      const size = trade.steps.length;
      
      // Update trade size counts
      if (!this.stats.tradesBySize[size]) {
        this.stats.tradesBySize[size] = 0;
      }
      this.stats.tradesBySize[size]++;
      
      // Update trade types
      if (size === 2) {
        this.stats.directTrades++;
      } else {
        this.stats.circularTrades++;
      }
      
      // Track largest trade
      this.stats.largestTradeSize = Math.max(this.stats.largestTradeSize, size);
    }
    
    // Display sample trades for users to see
    if (trades.length > 0) {
      console.log("\n=== SAMPLE TRADES FOUND ===");
      // Show up to 5 trades as examples
      const samplesToShow = Math.min(5, trades.length);
      
      for (let i = 0; i < samplesToShow; i++) {
        const trade = trades[i];
        console.log(`\nTrade ${i+1} (${trade.steps.length} parties):`);
        
        if (trade.efficiency !== undefined) {
          console.log(`Efficiency: ${trade.efficiency.toFixed(2)}`);
        }
        
        if ((trade as any).score !== undefined) {
          console.log(`Score: ${(trade as any).score.toFixed(2)}`);
        }
        
        if (trade.steps) {
          trade.steps.forEach((step, idx) => {
            const fromWallet = step.from?.substring(0, 16) || 'unknown';
            const toWallet = step.to?.substring(0, 16) || 'unknown';
            const nftAddress = step.nfts?.[0]?.address?.substring(0, 16) || 'unknown';
            console.log(`Step ${idx+1}: ${fromWallet} → ${toWallet} (NFT: ${nftAddress})`);
          });
        }
      }
      
      if (trades.length > samplesToShow) {
        console.log(`\n...and ${trades.length - samplesToShow} more trades`);
      }
    }
    
    // Get community statistics if available
    if (this.graphPartitioning) {
      try {
        // Try to access community data with safer approach
        const communityData = (this.graphPartitioning as any).getCommunityStats
          ? (this.graphPartitioning as any).getCommunityStats()
          : (this.graphPartitioning as any).getCommunityData
            ? (this.graphPartitioning as any).getCommunityData()
            : null;

        if (communityData) {
          this.stats.communityCount = communityData.totalCommunities || 0;
          this.stats.largestCommunitySize = communityData.largestCommunitySize || 0;
          
          console.log(`\n=== GRAPH PARTITIONING RESULTS ===`);
          console.log(`Communities found: ${this.stats.communityCount}`);
          console.log(`Largest community size: ${this.stats.largestCommunitySize} wallets`);
          
          // Show community distribution if available
          if (communityData.communitySizes) {
            console.log(`\nCommunity size distribution:`);
            Object.entries(communityData.communitySizes)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .forEach(([size, count]) => {
                console.log(`- Size ${size}: ${count} communities`);
              });
          }
        } else {
          console.log(`\nNo community data available from graph partitioning service`);
        }
      } catch (error: any) {
        console.log(`\nError accessing community data: ${error.message}`);
      }
    }
    
    logger.info(`Found ${this.stats.totalTradesFound} trades (${this.stats.directTrades} direct, ${this.stats.circularTrades} circular)`);
    logger.info(`Largest trade size: ${this.stats.largestTradeSize}`);
    
    // Log detailed trade size breakdown
    const sizeBreakdown = Object.entries(this.stats.tradesBySize)
      .map(([size, count]) => `${size}: ${count}`)
      .join(', ');
    
    logger.info(`Trade size breakdown: ${sizeBreakdown}`);
  }
  
  /**
   * Print results to the console
   */
  private printResults() {
    logger.info('\n=== SWAPS Algorithm Scale Test Results ===');
    logger.info('Test Configuration:');
    logger.info(`- Wallets: ${this.config.walletCount}`);
    logger.info(`- NFTs: ${this.config.nftCount}`);
    logger.info(`- Algorithm max depth: ${this.config.algorithm.maxDepth}`);
    
    logger.info('\nPerformance Results:');
    logger.info(`- Data generation time: ${this.stats.generateTime}ms`);
    logger.info(`- Total processing time: ${this.stats.totalProcessingTime}ms`);
    
    logger.info('\nTrade Statistics:');
    logger.info(`- Total trades found: ${this.stats.totalTradesFound}`);
    logger.info(`- Direct trades (2 parties): ${this.stats.directTrades}`);
    logger.info(`- Circular trades (3-6 parties): ${this.stats.circularTrades}`);
    logger.info(`- Complex trades (>6 parties): ${this.stats.complexTrades}`);
    logger.info(`- Largest trade size: ${this.stats.largestTradeSize} parties`);
    
    logger.info('\nGraph Partitioning:');
    logger.info(`- Communities found: ${this.stats.communityCount}`);
    logger.info(`- Largest community size: ${this.stats.largestCommunitySize} wallets`);
    
    logger.info('\nTrades by Size:');
    const sizes = Object.keys(this.stats.tradesBySize).sort((a, b) => parseInt(a) - parseInt(b));
    for (const size of sizes) {
      logger.info(`- ${size} parties: ${this.stats.tradesBySize[size]} trades`);
    }
  }
  
  /**
   * Save the test results to a file
   */
  private saveResults() {
    logger.info('\nSaving test results...');
    
    // Create and display a detailed JSON results object
    const results = {
      config: this.config,
      stats: this.stats,
      timestamp: new Date().toISOString()
    };
    
    // Log the entire results object to the console
    console.log('\n========== DETAILED TEST RESULTS ==========');
    console.log(JSON.stringify(results, null, 2));
    console.log('==========================================\n');
    
    // Also log key metrics in a more readable format
    console.log('\n===== ALGORITHM PERFORMANCE SUMMARY =====');
    console.log(`Total wallets: ${this.config.walletCount}`);
    console.log(`Total NFTs: ${this.config.nftCount}`);
    console.log(`Data generation time: ${this.stats.generateTime}ms`);
    console.log(`Algorithm processing time: ${this.stats.totalProcessingTime}ms`);
    console.log(`Total trades found: ${this.stats.totalTradesFound}`);
    console.log(`Direct trades: ${this.stats.directTrades}`);
    console.log(`Circular trades: ${this.stats.circularTrades}`);
    console.log(`Communities: ${this.stats.communityCount}`);
    console.log(`Largest community: ${this.stats.largestCommunitySize} wallets`);
    console.log(`Largest trade size: ${this.stats.largestTradeSize} parties`);
    
    // Show trade size breakdown
    console.log('\nTrades by size:');
    Object.entries(this.stats.tradesBySize)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([size, count]) => {
        console.log(`- ${size} parties: ${count} trades`);
      });
    
    console.log('==========================================\n');
    
    logger.info('Results displayed in console output');
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    if (this.tradeLoopFinder) {
      this.tradeLoopFinder.dispose();
    }
    logger.info('Scale test resources disposed');
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): TestConfig {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };
  
  // Check for debug flag
  const debugMode = args.includes('--debug');
  if (debugMode) {
    process.env.LOG_LEVEL = 'debug';
    console.log('Debug mode enabled');
    console.log('Command line arguments:', args);
  }
  
  for (const arg of args) {
    if (arg.startsWith('--')) {
      // Skip the debug flag
      if (arg === '--debug') continue;
      
      const [key, value] = arg.substring(2).split('=');
      
      switch (key) {
        case 'walletCount':
        case 'nftCount':
        case 'sampleSize':
          config[key] = parseInt(value, 10);
          break;
        case 'maxDepth':
          config.algorithm.maxDepth = parseInt(value, 10);
          break;
        case 'minEfficiency':
          config.algorithm.minEfficiency = parseFloat(value);
          break;
        case 'timeout':
          config.algorithm.timeout = parseInt(value, 10);
          break;
        case 'small':
          config.walletCount = 100;
          config.nftCount = 1000;
          break;
        case 'medium':
          config.walletCount = 1000;
          config.nftCount = 10000;
          break;
        case 'large':
          config.walletCount = 5000;
          config.nftCount = 50000;
          break;
      }
    } else if (arg.includes('=')) {
      // Handle key=value format without the leading --
      const [key, value] = arg.split('=');
      
      switch (key) {
        case 'walletCount':
        case 'nftCount':
        case 'sampleSize':
          config[key] = parseInt(value, 10);
          break;
        case 'maxDepth':
          config.algorithm.maxDepth = parseInt(value, 10);
          break;
        case 'minEfficiency':
          config.algorithm.minEfficiency = parseFloat(value);
          break;
        case 'timeout':
          config.algorithm.timeout = parseInt(value, 10);
          break;
      }
    }
  }
  
  if (debugMode) {
    console.log('Final config:', config);
  }
  
  return config;
}

// Run the test when this script is executed directly
if (require.main === module) {
  console.log("STARTING PRODUCTION TEST");
  
  // Get configuration from command line arguments
  const config = parseArgs();
  
  // Create and run the test
  const test = new ProductionScaleTest(config);
  test.run()
    .then(() => {
      console.log("TEST COMPLETED SUCCESSFULLY");
    })
    .catch((error) => {
      console.error("TEST FAILED WITH ERROR:", error);
      process.exit(1);
    });
}