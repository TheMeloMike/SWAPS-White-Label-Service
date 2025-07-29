import * as crypto from 'crypto';
import { performance } from 'perf_hooks';
import { LoggingService } from '../utils/logging/LoggingService';
import { TradeDiscoveryService } from '../services/trade/TradeDiscoveryService';
import { TradeLoopFinderService } from '../services/trade/TradeLoopFinderService';
import { ScalableTradeLoopFinderService } from '../services/trade/ScalableTradeLoopFinderService';
import { MockNFTService } from './mock-services/MockNFTService';
import { MockPricingService } from './mock-services/MockPricingService';

// Define types locally for testing to avoid dependency issues
interface WalletState {
  address: string;
  ownedNfts: Set<string>;
  wantedNfts: Set<string>;
  lastUpdated: Date;
}

interface RejectionPreferences {
  rejectedNfts?: Set<string>;
  rejectedWallets?: Set<string>;
}

interface NFTMetadata {
  address: string;
  name: string;
  symbol: string;
  image: string;
  collection: string;
  description: string;
  floorPrice?: number;
  estimatedValue?: number;
  hasFloorPrice?: boolean;
  usedRealPrice?: boolean;
}

interface TradeStep {
  from: string;
  to: string;
  nfts: NFTMetadata[];
}

interface TradeLoop {
  id: string;
  steps: TradeStep[];
  totalParticipants: number;
  efficiency: number;
  rawEfficiency?: number;
  estimatedValue: number;
  status: string;
  progress: number;
  createdAt: Date;
  isBundle?: boolean;
  qualityScore?: number;
  qualityMetrics?: any;
}

// Configure logging
process.env.LOG_LEVEL = 'debug';
const logger = LoggingService.getInstance().createLogger('MultiPartyTradeTest');

// Set required environment variables
process.env.HELIUS_API_KEY = process.env.HELIUS_API_KEY || '{{HELIUS_API_KEY_FOR_TESTING_ONLY}}';
process.env.SWAP_PROGRAM_ID = process.env.SWAP_PROGRAM_ID || 'Swap111111111111111111111111111111111111111';
process.env.ENABLE_PERSISTENCE = 'false';
process.env.FORCE_SCALABLE_IMPLEMENTATION = 'true';
process.env.TRADELOOP_MAX_DEPTH = '10';
process.env.TRADELOOP_MIN_EFFICIENCY = '0.5';
process.env.TRADELOOP_GLOBAL_TIMEOUT_MS = '60000';

/**
 * Diagnostic test for multi-party trade detection
 * Creates controlled scenarios with guaranteed circular trades
 */
class MultiPartyTradeTest {
  // Wallet and NFT tracking
  private wallets: Map<string, WalletState> = new Map();
  private nftOwnership: Map<string, string> = new Map();
  private wantedNfts: Map<string, Set<string>> = new Map();

  // Algorithm services
  private tradeDiscoveryService: TradeDiscoveryService;
  private tradeLoopFinder: TradeLoopFinderService;
  private scalableTradeLoopFinder: ScalableTradeLoopFinderService;

  constructor() {
    // Initialize services
    this.tradeDiscoveryService = TradeDiscoveryService.getInstance();
    this.tradeLoopFinder = new TradeLoopFinderService(10, 0.5); // Lower efficiency threshold to catch more trades
    this.scalableTradeLoopFinder = ScalableTradeLoopFinderService.getInstance();

    // Initialize mocks
    MockNFTService.getInstance();
    MockPricingService.getInstance();
    
    logger.info('Test services initialized with algorithm parameters:');
    logger.info(`- Max Depth: ${process.env.TRADELOOP_MAX_DEPTH}`);
    logger.info(`- Min Efficiency: ${process.env.TRADELOOP_MIN_EFFICIENCY}`);
    logger.info(`- Timeout: ${process.env.TRADELOOP_GLOBAL_TIMEOUT_MS}ms`);
  }

  /**
   * Create a perfect 3-party circular trade:
   * A → B → C → A
   */
  createThreePartyCircle() {
    logger.info('Creating three-party circular trade test case');
    
    // Clear any previous data
    this.resetData();
    
    // Create three wallets
    const walletA = this.createWallet('wallet_A');
    const walletB = this.createWallet('wallet_B');
    const walletC = this.createWallet('wallet_C');
    
    // Create three NFTs
    const nftA = 'nft_A';
    const nftB = 'nft_B';
    const nftC = 'nft_C';
    
    // Assign NFT ownership: wallet X owns nft_X
    this.assignOwnership(walletA, nftA);
    this.assignOwnership(walletB, nftB);
    this.assignOwnership(walletC, nftC);
    
    // Create perfect circular wants: A wants B's NFT, B wants C's NFT, C wants A's NFT
    this.addWant(walletA, nftB);
    this.addWant(walletB, nftC);
    this.addWant(walletC, nftA);
    
    logger.info('Three-party circular trade created:');
    logger.info(`- ${walletA} owns ${nftA} and wants ${nftB}`);
    logger.info(`- ${walletB} owns ${nftB} and wants ${nftC}`);
    logger.info(`- ${walletC} owns ${nftC} and wants ${nftA}`);
    
    return {
      wallets: [walletA, walletB, walletC],
      nfts: [nftA, nftB, nftC]
    };
  }

  /**
   * Create a perfect 4-party circular trade:
   * A → B → C → D → A
   */
  createFourPartyCircle() {
    logger.info('Creating four-party circular trade test case');
    
    // Clear any previous data
    this.resetData();
    
    // Create four wallets
    const walletA = this.createWallet('wallet_A');
    const walletB = this.createWallet('wallet_B');
    const walletC = this.createWallet('wallet_C');
    const walletD = this.createWallet('wallet_D');
    
    // Create four NFTs
    const nftA = 'nft_A';
    const nftB = 'nft_B';
    const nftC = 'nft_C';
    const nftD = 'nft_D';
    
    // Assign NFT ownership: wallet X owns nft_X
    this.assignOwnership(walletA, nftA);
    this.assignOwnership(walletB, nftB);
    this.assignOwnership(walletC, nftC);
    this.assignOwnership(walletD, nftD);
    
    // Create perfect circular wants
    this.addWant(walletA, nftB);
    this.addWant(walletB, nftC);
    this.addWant(walletC, nftD);
    this.addWant(walletD, nftA);
    
    logger.info('Four-party circular trade created:');
    logger.info(`- ${walletA} owns ${nftA} and wants ${nftB}`);
    logger.info(`- ${walletB} owns ${nftB} and wants ${nftC}`);
    logger.info(`- ${walletC} owns ${nftC} and wants ${nftD}`);
    logger.info(`- ${walletD} owns ${nftD} and wants ${nftA}`);
    
    return {
      wallets: [walletA, walletB, walletC, walletD],
      nfts: [nftA, nftB, nftC, nftD]
    };
  }

  /**
   * Create a larger 11-party circular trade:
   * A → B → C → D → E → F → G → H → I → J → K → A
   */
  createElevenPartyCircle() {
    logger.info('Creating eleven-party circular trade test case');
    
    // Clear any previous data
    this.resetData();
    
    // Create eleven wallets
    const walletA = this.createWallet('wallet_A');
    const walletB = this.createWallet('wallet_B');
    const walletC = this.createWallet('wallet_C');
    const walletD = this.createWallet('wallet_D');
    const walletE = this.createWallet('wallet_E');
    const walletF = this.createWallet('wallet_F');
    const walletG = this.createWallet('wallet_G');
    const walletH = this.createWallet('wallet_H');
    const walletI = this.createWallet('wallet_I');
    const walletJ = this.createWallet('wallet_J');
    const walletK = this.createWallet('wallet_K');
    
    // Create eleven NFTs
    const nftA = 'nft_A';
    const nftB = 'nft_B';
    const nftC = 'nft_C';
    const nftD = 'nft_D';
    const nftE = 'nft_E';
    const nftF = 'nft_F';
    const nftG = 'nft_G';
    const nftH = 'nft_H';
    const nftI = 'nft_I';
    const nftJ = 'nft_J';
    const nftK = 'nft_K';
    
    // Assign NFT ownership: wallet X owns nft_X
    this.assignOwnership(walletA, nftA);
    this.assignOwnership(walletB, nftB);
    this.assignOwnership(walletC, nftC);
    this.assignOwnership(walletD, nftD);
    this.assignOwnership(walletE, nftE);
    this.assignOwnership(walletF, nftF);
    this.assignOwnership(walletG, nftG);
    this.assignOwnership(walletH, nftH);
    this.assignOwnership(walletI, nftI);
    this.assignOwnership(walletJ, nftJ);
    this.assignOwnership(walletK, nftK);
    
    // Create perfect circular wants
    this.addWant(walletA, nftB);
    this.addWant(walletB, nftC);
    this.addWant(walletC, nftD);
    this.addWant(walletD, nftE);
    this.addWant(walletE, nftF);
    this.addWant(walletF, nftG);
    this.addWant(walletG, nftH);
    this.addWant(walletH, nftI);
    this.addWant(walletI, nftJ);
    this.addWant(walletJ, nftK);
    this.addWant(walletK, nftA);
    
    logger.info('Eleven-party circular trade created:');
    logger.info(`- ${walletA} owns ${nftA} and wants ${nftB}`);
    logger.info(`- ${walletB} owns ${nftB} and wants ${nftC}`);
    logger.info(`- ${walletC} owns ${nftC} and wants ${nftD}`);
    logger.info(`- ${walletD} owns ${nftD} and wants ${nftE}`);
    logger.info(`- ${walletE} owns ${nftE} and wants ${nftF}`);
    logger.info(`- ${walletF} owns ${nftF} and wants ${nftG}`);
    logger.info(`- ${walletG} owns ${nftG} and wants ${nftH}`);
    logger.info(`- ${walletH} owns ${nftH} and wants ${nftI}`);
    logger.info(`- ${walletI} owns ${nftI} and wants ${nftJ}`);
    logger.info(`- ${walletJ} owns ${nftJ} and wants ${nftK}`);
    logger.info(`- ${walletK} owns ${nftK} and wants ${nftA}`);
    
    return {
      wallets: [walletA, walletB, walletC, walletD, walletE, walletF, walletG, walletH, walletI, walletJ, walletK],
      nfts: [nftA, nftB, nftC, nftD, nftE, nftF, nftG, nftH, nftI, nftJ, nftK]
    };
  }

  /**
   * Run test with TradeLoopFinder (direct implementation)
   */
  async testTradeLoopFinder() {
    logger.info('Testing TradeLoopFinder implementation...');
    
    const startTime = performance.now();
    const trades = await this.tradeLoopFinder.findAllTradeLoops(
      this.wallets,
      this.nftOwnership,
      this.wantedNfts,
      new Map()
    );
    const endTime = performance.now();
    
    this.logTradeResults(trades, endTime - startTime);
    return trades;
  }

  /**
   * Run test with ScalableTradeLoopFinder
   */
  async testScalableTradeLoopFinder() {
    logger.info('Testing ScalableTradeLoopFinder implementation...');
    
    const startTime = performance.now();
    const trades = await this.scalableTradeLoopFinder.findAllTradeLoops(
      this.wallets,
      this.nftOwnership,
      this.wantedNfts,
      new Map()
    );
    const endTime = performance.now();
    
    this.logTradeResults(trades, endTime - startTime);
    return trades;
  }

  /**
   * Run test with TradeDiscoveryService (orchestrator)
   */
  async testTradeDiscoveryService() {
    logger.info('Testing TradeDiscoveryService orchestrator...');
    
    // Add test methods to the service
    this.addTestMethodsToService();
    
    // Reset and import test data
    (this.tradeDiscoveryService as any).resetDataForTesting();
    (this.tradeDiscoveryService as any).importTestData(
      this.wallets,
      this.nftOwnership,
      this.wantedNfts,
      new Map()
    );
    
    const startTime = performance.now();
    const settings = {
      maxDepth: 10,
      minEfficiency: 0.5,
      maxResults: 100,
      includeDirectTrades: true,
      includeMultiPartyTrades: true,
      considerCollections: false,
      timeoutMs: 30000
    };
    
    // Trace execution with debug messages
    const trades = await this.tradeDiscoveryService.findTradeLoops(settings);
    const endTime = performance.now();
    
    this.logTradeResults(trades, endTime - startTime);
    return trades;
  }

  /**
   * Add debugging instrumentation to the TradeLoopFinder
   */
  instrumentTradeLoopFinder() {
    if (!this.tradeLoopFinder) return;
    
    // Cast to any to access private fields for testing
    const finder = this.tradeLoopFinder as any;
    
    // Save original methods
    const originalFindElementaryCycles = finder.findElementaryCycles;
    
    // Override with instrumented versions
    finder.findElementaryCycles = function(graph: any) {
      console.log('findElementaryCycles called with graph:', {
        nodes: Object.keys(graph).length,
        edges: Object.values(graph).reduce((sum: number, outEdges: any) => 
          sum + Object.keys(outEdges).length, 0)
      });
      
      // Track cycles as they're found
      let cycleCount = 0;
      const startTime = performance.now();
      
      const cycles = originalFindElementaryCycles.call(this, graph);
      
      const endTime = performance.now();
      console.log(`Found ${cycles.length} elementary cycles in ${(endTime - startTime).toFixed(2)}ms`);
      
      // Log the first few cycles
      if (cycles.length > 0) {
        console.log('Sample cycles found:');
        cycles.slice(0, Math.min(5, cycles.length)).forEach((cycle: any, i: number) => {
          console.log(`Cycle ${i + 1}: ${cycle.join(' → ')}`);
        });
      }
      
      return cycles;
    };
    
    // Inject mock services
    finder.nftService = MockNFTService.getInstance();
    finder.nftPricingService = MockPricingService.getInstance();
    
    logger.info('TradeLoopFinder instrumented with debug logging and mock services');
  }

  /**
   * Reset all data structures
   */
  private resetData() {
    this.wallets.clear();
    this.nftOwnership.clear();
    this.wantedNfts.clear();
    logger.info('All test data reset');
  }

  /**
   * Create a new wallet
   */
  private createWallet(id: string): string {
    const walletState: WalletState = {
      address: id,
      ownedNfts: new Set(),
      wantedNfts: new Set(),
      lastUpdated: new Date()
    };
    
    this.wallets.set(id, walletState);
    return id;
  }

  /**
   * Assign NFT ownership
   */
  private assignOwnership(walletId: string, nftId: string) {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }
    
    wallet.ownedNfts.add(nftId);
    this.nftOwnership.set(nftId, walletId);
  }

  /**
   * Add a want relationship (wallet wants NFT)
   */
  private addWant(walletId: string, nftId: string) {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }
    
    wallet.wantedNfts.add(nftId);
    
    // Also update the wantedNfts map
    if (!this.wantedNfts.has(nftId)) {
      this.wantedNfts.set(nftId, new Set());
    }
    this.wantedNfts.get(nftId)?.add(walletId);
  }

  /**
   * Add testing methods to TradeDiscoveryService
   */
  private addTestMethodsToService() {
    if (!('resetDataForTesting' in this.tradeDiscoveryService)) {
      (this.tradeDiscoveryService as any).resetDataForTesting = function() {
        this.wallets = new Map();
        this.nftOwnership = new Map();
        this.wantedNfts = new Map();
        this.rejectionPreferences = new Map();
      };
    }
    
    if (!('importTestData' in this.tradeDiscoveryService)) {
      (this.tradeDiscoveryService as any).importTestData = function(
        wallets: Map<string, WalletState>,
        nftOwnership: Map<string, string>,
        wantedNfts: Map<string, Set<string>>,
        rejectionPreferences: Map<string, RejectionPreferences>
      ) {
        this.wallets = wallets;
        this.nftOwnership = nftOwnership;
        this.wantedNfts = wantedNfts;
        this.rejectionPreferences = rejectionPreferences;
      };
    }
  }

  /**
   * Log trade results
   */
  private logTradeResults(trades: any[], executionTime: number) {
    logger.info(`Found ${trades.length} total trades in ${executionTime.toFixed(2)}ms`);
    
    // Count trade types
    const tradeCounts = new Map<number, number>();
    for (const trade of trades) {
      const size = trade.steps.length;
      tradeCounts.set(size, (tradeCounts.get(size) || 0) + 1);
    }
    
    // Log breakdown by size
    logger.info('Trade size breakdown:');
    for (const [size, count] of tradeCounts.entries()) {
      logger.info(`- ${size}-party trades: ${count}`);
    }
    
    // Log details of each trade
    logger.info('Trade details:');
    trades.forEach((trade, i) => {
      logger.info(`Trade ${i + 1} (${trade.steps.length} parties):`);
      trade.steps.forEach((step: any) => {
        logger.info(`- ${step.from} → ${step.to}: ${step.nfts.map((n: any) => n.address).join(', ')}`);
      });
    });
  }

  /**
   * Instrument all services with mock dependencies
   */
  instrumentAllServices() {
    // Instrument the TradeLoopFinder
    this.instrumentTradeLoopFinder();
    
    // Instrument ScalableTradeLoopFinder
    this.instrumentScalableTradeLoopFinder();
    
    // Instrument TradeDiscoveryService
    this.instrumentTradeDiscoveryService();
    
    logger.info('All services instrumented with mock dependencies');
  }

  /**
   * Instrument the ScalableTradeLoopFinder with mock services
   */
  instrumentScalableTradeLoopFinder() {
    if (!this.scalableTradeLoopFinder) return;
    
    // Cast to any to access private fields for testing
    const finder = this.scalableTradeLoopFinder as any;
    
    // Inject mock services
    if (finder.tradeLoopFinder) {
      const innerFinder = finder.tradeLoopFinder as any;
      innerFinder.nftService = MockNFTService.getInstance();
      innerFinder.nftPricingService = MockPricingService.getInstance();
      
      logger.info('Mock services injected into ScalableTradeLoopFinder.tradeLoopFinder');
    }
    
    logger.info('ScalableTradeLoopFinder instrumented with mock services');
  }
  
  /**
   * Instrument the TradeDiscoveryService with mock services
   */
  instrumentTradeDiscoveryService() {
    if (!this.tradeDiscoveryService) return;
    
    // Cast to any to access private fields for testing
    const service = this.tradeDiscoveryService as any;
    
    // Inject mock services
    service.nftService = MockNFTService.getInstance();
    service.nftPricingService = MockPricingService.getInstance();
    
    // Inject mock versions of the loop finders
    if (service.legacyTradeLoopFinder) {
      const legacyFinder = service.legacyTradeLoopFinder as any;
      legacyFinder.nftService = MockNFTService.getInstance();
      legacyFinder.nftPricingService = MockPricingService.getInstance();
    }
    
    if (service.scalableTradeLoopFinder) {
      this.instrumentScalableTradeLoopFinder();
    }
    
    logger.info('TradeDiscoveryService instrumented with mock services');
  }

  /**
   * Create a large-scale test with many wallets and NFTs
   * to measure performance with our updated algorithm
   */
  async createLargeScaleTest(walletCount = 100, nftCount = 500) {
    logger.info(`Creating large-scale test with ${walletCount} wallets and ${nftCount} NFTs`);
    
    // Clear any previous data
    this.resetData();
    
    // Create wallets
    const wallets = [];
    for (let i = 0; i < walletCount; i++) {
      const wallet = this.createWallet(`wallet_large_${i}`);
      wallets.push(wallet);
    }
    
    // Create NFTs
    const nfts = [];
    for (let i = 0; i < nftCount; i++) {
      const nft = `nft_large_${i}`;
      nfts.push(nft);
    }
    
    // Assign NFT ownership randomly
    // First ensure each wallet gets at least one NFT
    const minNftsPerWallet = Math.min(3, Math.floor(nftCount / walletCount));
    
    let nftIndex = 0;
    for (let i = 0; i < walletCount && nftIndex < nftCount; i++) {
      // Assign minNftsPerWallet to each wallet
      for (let j = 0; j < minNftsPerWallet && nftIndex < nftCount; j++) {
        this.assignOwnership(wallets[i], nfts[nftIndex]);
        nftIndex++;
      }
    }
    
    // Randomly assign the remaining NFTs
    while (nftIndex < nftCount) {
      const randomWalletIndex = Math.floor(Math.random() * walletCount);
      this.assignOwnership(wallets[randomWalletIndex], nfts[nftIndex]);
      nftIndex++;
    }
    
    logger.info(`NFTs assigned to wallets`);
    
    // Create trade preferences - including some circular trades
    
    // 1. Create some direct 2-party trades (10% of wallets)
    const directTradeCount = Math.floor(walletCount * 0.1) / 2;
    logger.info(`Creating ${directTradeCount} direct 2-party trades`);
    
    for (let i = 0; i < directTradeCount; i++) {
      const walletA = wallets[i * 2];
      const walletB = wallets[i * 2 + 1];
      
      // Get owned NFTs for each wallet
      const nftsA = this.getOwnedNfts(walletA);
      const nftsB = this.getOwnedNfts(walletB);
      
      if (nftsA.length > 0 && nftsB.length > 0) {
        // Create direct wants
        this.addWant(walletA, nftsB[0]);
        this.addWant(walletB, nftsA[0]);
        logger.info(`Created 2-party trade between ${walletA} and ${walletB}`);
      }
    }
    
    // 2. Create some 3-party circular trades (15% of wallets)
    const circular3Count = Math.floor(walletCount * 0.15) / 3;
    logger.info(`Creating ${circular3Count} 3-party circular trades`);
    
    for (let i = 0; i < circular3Count; i++) {
      const offset = directTradeCount * 2 + i * 3;
      if (offset + 2 >= walletCount) break;
      
      const walletA = wallets[offset];
      const walletB = wallets[offset + 1];
      const walletC = wallets[offset + 2];
      
      // Get owned NFTs for each wallet
      const nftsA = this.getOwnedNfts(walletA);
      const nftsB = this.getOwnedNfts(walletB);
      const nftsC = this.getOwnedNfts(walletC);
      
      if (nftsA.length > 0 && nftsB.length > 0 && nftsC.length > 0) {
        // Create circular wants
        this.addWant(walletA, nftsB[0]);
        this.addWant(walletB, nftsC[0]);
        this.addWant(walletC, nftsA[0]);
        logger.info(`Created 3-party trade: ${walletA} -> ${walletB} -> ${walletC} -> ${walletA}`);
      }
    }
    
    // 3. Create some 4-6 party circular trades (10% of wallets)
    const circular4to6Count = Math.floor(walletCount * 0.1) / 5; // Average of 5 parties
    let currentOffset = directTradeCount * 2 + circular3Count * 3;
    
    logger.info(`Creating ${circular4to6Count} 4-6 party circular trades`);
    
    for (let i = 0; i < circular4to6Count; i++) {
      // Choose a random size between 4 and 6
      const size = 4 + Math.floor(Math.random() * 3);
      if (currentOffset + size >= walletCount) break;
      
      // Get wallets for this trade
      const tradeWallets = [];
      for (let j = 0; j < size; j++) {
        tradeWallets.push(wallets[currentOffset + j]);
      }
      currentOffset += size;
      
      // Check if all wallets have NFTs
      let allHaveNfts = true;
      const ownedNfts = tradeWallets.map(wallet => {
        const nfts = this.getOwnedNfts(wallet);
        if (nfts.length === 0) allHaveNfts = false;
        return nfts;
      });
      
      if (!allHaveNfts) {
        logger.info(`Skipping ${size}-party trade: some wallets have no NFTs`);
        continue;
      }
      
      // Create circular wants
      let tradeDescription = `Created ${size}-party trade: `;
      for (let j = 0; j < size; j++) {
        const currentWallet = tradeWallets[j];
        const nextWallet = tradeWallets[(j + 1) % size];
        const nextNfts = ownedNfts[(j + 1) % size];
        
        if (nextNfts.length > 0) {
          this.addWant(currentWallet, nextNfts[0]);
          tradeDescription += `${currentWallet} -> `;
        }
      }
      tradeDescription += `${tradeWallets[0]}`;
      logger.info(tradeDescription);
    }
    
    // 4. Create random wants for remaining wallets
    logger.info(`Creating random wants for remaining wallets`);
    for (let i = currentOffset; i < walletCount; i++) {
      const wallet = wallets[i];
      
      // Choose 1-5 random NFTs to want
      const wantCount = 1 + Math.floor(Math.random() * 5);
      
      // Get NFTs not owned by this wallet
      const ownedNfts = new Set(this.getOwnedNfts(wallet));
      const availableNfts = nfts.filter(nft => !ownedNfts.has(nft));
      
      // Add random wants
      for (let j = 0; j < Math.min(wantCount, availableNfts.length); j++) {
        const randomIndex = Math.floor(Math.random() * availableNfts.length);
        const nft = availableNfts.splice(randomIndex, 1)[0];
        this.addWant(wallet, nft);
      }
    }
    
    logger.info(`Large-scale test created with ${walletCount} wallets and ${nftCount} NFTs`);
    
    // Log distribution stats
    this.logDistributionStats(wallets);
    
    return { wallets, nfts };
  }
  
  /**
   * Get owned NFTs for a wallet
   */
  getOwnedNfts(wallet: string): string[] {
    return Array.from(this.wallets.get(wallet)?.ownedNfts || []);
  }
  
  /**
   * Log distribution statistics
   */
  logDistributionStats(wallets: string[]) {
    // Calculate NFT distribution stats
    let minNfts = Infinity;
    let maxNfts = 0;
    let totalNfts = 0;
    
    for (const wallet of wallets) {
      const nfts = this.getOwnedNfts(wallet);
      minNfts = Math.min(minNfts, nfts.length);
      maxNfts = Math.max(maxNfts, nfts.length);
      totalNfts += nfts.length;
    }
    
    logger.info('NFT distribution stats:');
    logger.info(`- Min NFTs per wallet: ${minNfts}`);
    logger.info(`- Max NFTs per wallet: ${maxNfts}`);
    logger.info(`- Avg NFTs per wallet: ${(totalNfts / wallets.length).toFixed(2)}`);
    
    // Calculate wants distribution stats
    let minWants = Infinity;
    let maxWants = 0;
    let totalWants = 0;
    
    for (const wallet of wallets) {
      const wants = Array.from(this.wallets.get(wallet)?.wantedNfts || []);
      minWants = Math.min(minWants, wants.length);
      maxWants = Math.max(maxWants, wants.length);
      totalWants += wants.length;
    }
    
    logger.info('Wants distribution stats:');
    logger.info(`- Min wants per wallet: ${minWants}`);
    logger.info(`- Max wants per wallet: ${maxWants}`);
    logger.info(`- Avg wants per wallet: ${(totalWants / wallets.length).toFixed(2)}`);
  }
}

/**
 * Run the tests
 */
async function runTests() {
  logger.info('=== Multi-Party Trade Detection Diagnostic Test ===');
  
  const test = new MultiPartyTradeTest();
  
  try {
    // Add instrumentation
    test.instrumentAllServices();
    
    // Test 3-party circle
    logger.info('\n=== Testing 3-party circular trade ===');
    test.createThreePartyCircle();
    
    logger.info('\n--- Testing with direct TradeLoopFinder ---');
    const directTrades3 = await test.testTradeLoopFinder();
    
    logger.info('\n--- Testing with ScalableTradeLoopFinder ---');
    const scalableTrades3 = await test.testScalableTradeLoopFinder();
    
    logger.info('\n--- Testing with TradeDiscoveryService ---');
    const serviceTrades3 = await test.testTradeDiscoveryService();
    
    // Test 4-party circle
    logger.info('\n=== Testing 4-party circular trade ===');
    test.createFourPartyCircle();
    
    logger.info('\n--- Testing with direct TradeLoopFinder ---');
    const directTrades4 = await test.testTradeLoopFinder();
    
    logger.info('\n--- Testing with ScalableTradeLoopFinder ---');
    const scalableTrades4 = await test.testScalableTradeLoopFinder();
    
    logger.info('\n--- Testing with TradeDiscoveryService ---');
    const serviceTrades4 = await test.testTradeDiscoveryService();
    
    // Test 11-party circle
    logger.info('\n=== Testing 11-party circular trade ===');
    test.createElevenPartyCircle();
    
    logger.info('\n--- Testing with direct TradeLoopFinder ---');
    const directTrades11 = await test.testTradeLoopFinder();
    
    logger.info('\n--- Testing with ScalableTradeLoopFinder ---');
    const scalableTrades11 = await test.testScalableTradeLoopFinder();
    
    logger.info('\n--- Testing with TradeDiscoveryService ---');
    const serviceTrades11 = await test.testTradeDiscoveryService();
    
    // Large-scale test
    logger.info('\n=== Testing with large-scale dataset ===');
    const largeScaleTest = new MultiPartyTradeTest();
    await largeScaleTest.createLargeScaleTest(100, 500);
    
    const largeScaleStartTime = performance.now();
    logger.info('\n--- Testing large-scale with TradeDiscoveryService ---');
    const largeScaleResults = await largeScaleTest.testTradeDiscoveryService();
    const largeScaleEndTime = performance.now();
    
    logger.info(`Found ${largeScaleResults.length} total trades in ${(largeScaleEndTime - largeScaleStartTime).toFixed(2)}ms`);
    
    // Show trade size breakdown
    const tradesBySize: Record<number, number> = {};
    for (const trade of largeScaleResults) {
      const size = trade.steps.length;
      tradesBySize[size] = (tradesBySize[size] || 0) + 1;
    }
    
    logger.info('Trade size breakdown:');
    for (const size in tradesBySize) {
      logger.info(`- ${size}-party trades: ${tradesBySize[size]}`);
    }
    
    // Summary
    logger.info('\n=== Test Summary ===');
    logger.info('3-party circle:');
    logger.info(`- TradeLoopFinder: ${directTrades3.length} trades`);
    logger.info(`- ScalableTradeLoopFinder: ${scalableTrades3.length} trades`);
    logger.info(`- TradeDiscoveryService: ${serviceTrades3.length} trades`);
    
    logger.info('4-party circle:');
    logger.info(`- TradeLoopFinder: ${directTrades4.length} trades`);
    logger.info(`- ScalableTradeLoopFinder: ${scalableTrades4.length} trades`);
    logger.info(`- TradeDiscoveryService: ${serviceTrades4.length} trades`);
    
    logger.info('11-party circle:');
    logger.info(`- TradeLoopFinder: ${directTrades11.length} trades`);
    logger.info(`- ScalableTradeLoopFinder: ${scalableTrades11.length} trades`);
    logger.info(`- TradeDiscoveryService: ${serviceTrades11.length} trades`);
    
    return {
      threeParty: {
        direct: directTrades3.length,
        scalable: scalableTrades3.length,
        service: serviceTrades3.length
      },
      fourParty: {
        direct: directTrades4.length,
        scalable: scalableTrades4.length,
        service: serviceTrades4.length
      },
      elevenParty: {
        direct: directTrades11.length,
        scalable: scalableTrades11.length,
        service: serviceTrades11.length
      },
      largeScale: {
        trades: largeScaleResults.length,
        timeMs: largeScaleEndTime - largeScaleStartTime,
        tradesBySize
      }
    };
  } catch (error) {
    logger.error('Error running multi-party trade tests:', {
      error: error instanceof Error ? error.stack : String(error)
    });
    throw error;
  }
}

// Run the tests when executed directly
if (require.main === module) {
  runTests()
    .then(results => {
      console.log('Test completed with results:', results);
      process.exit(0);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { MultiPartyTradeTest, runTests }; 