import { performance } from 'perf_hooks';
import { v4 as uuidv4 } from 'uuid';
import { WalletState, DiscoveredTradeLoop, TradeLoop, RejectionPreferences } from '../../types/trade';
import { NFTPricingService } from '../nft/NFTPricingService';
import { NFTService } from '../nft/NFTService';
import { TradeScoreService } from './TradeScoreService';
import { LoggingService } from '../../utils/logging/LoggingService';
// Import the dedicated SCC and Cycle finder services
import { SCCFinderService } from './SCCFinderService';
import { CycleFinderService } from './CycleFinderService';

// Define interface for edge trade data
interface EdgeTradeData {
  fromOwner: string;    // NFT going from owner to wanter
  fromWanter: string;   // NFT going from wanter to owner
}

/**
 * Service for finding all possible trade loops in a wallet trade graph
 * Implements an optimized version of Johnson's algorithm for finding elementary cycles
 * in a directed graph.
 * 
 * This is the core algorithm that powers the SWAPS NFT trading platform.
 */
export class TradeLoopFinderService {
  private nftPricingService: NFTPricingService;
  private nftService: NFTService;
  private logger: any; // Will be initialized in constructor
  
  // DEBUGGING: Target wallets for enhanced logging
  private readonly TARGET_WALLETS = [
    '52sLrTRsiVrVyxSL8r1rpbJmjtcbQER9QgeiykViUgC8',
    '5pPCbuGso6NguFBWAqaKm7FW9msRoLQQoWu7kawGfFna',
    'NHLeTzVE1BriRr3Uuebyq1aKEjRvWFMozy2BDAuLN2m'
  ];
  
  // Map to store detailed trade data for each edge
  private edgeTradeData: Map<string, EdgeTradeData> = new Map();
  
  // Configuration options
  private readonly maxDepth: number;
  private readonly minEfficiency: number;
  private readonly globalTimeoutMs: number;
  
  // Profiling and metrics
  private startTime: number = 0;
  private cyclesFound: number = 0; // Consider removing if CycleFinderService tracks this
  private edgesTraversed: number = 0; // Consider removing if CycleFinderService tracks this
  
  // Configuration
  private readonly MAX_SCC_CONCURRENCY = 4; // Process up to 4 SCCs in parallel
  private readonly MAX_API_CONCURRENCY = 10; // Maximum concurrent API calls
  private readonly MAX_CYCLES_DENSE_GRAPH = 500; // Max cycles to find in dense graphs
  private readonly VERBOSE_LOGGING = false;
  
  // State for graph building
  private walletsInGraph = new Set<string>();
  private tradePreferences = new Map<string, Set<string>>();
  
  // Cache for NFT metadata and prices with TTL
  private nftMetadataCache = new Map<string, any>();
  private nftPriceCache = new Map<string, { price: number, timestamp: number }>();
  private readonly PRICE_CACHE_TTL = 60 * 60 * 1000; // 60 minutes (was 30 minutes)
  private readonly METADATA_CACHE_TTL = 3 * 24 * 60 * 60 * 1000; // 3 days (was 24 hours)
  
  // Cache statistics for monitoring
  private cacheStats = {
    metadataHits: 0,
    metadataMisses: 0,
    priceHits: 0,
    priceMisses: 0,
    batchLoads: 0,
    apiCalls: 0
  };
  
  // For cache cleanup
  private cacheCleanupInterval: any = null;
  
  constructor(maxDepth: number = 7, minEfficiency: number = 0.7) {
    this.maxDepth = maxDepth || parseInt(process.env.TRADELOOP_MAX_DEPTH || '7', 10);
    this.minEfficiency = minEfficiency || parseFloat(process.env.TRADELOOP_MIN_EFFICIENCY || '0.7');
    this.globalTimeoutMs = parseInt(process.env.TRADELOOP_GLOBAL_TIMEOUT_MS || '30000', 10);
    
    // Initialize logger
    this.logger = LoggingService.getInstance().createLogger('TradeLoopFinder');
    
    // Initialize counters
    this.edgesTraversed = 0;
    this.cyclesFound = 0;
    
    // Initialize services
    this.nftService = NFTService.getInstance();
    this.nftPricingService = NFTPricingService.getInstance();
    
    // Initialize caches
    this.nftMetadataCache = new Map();
    this.nftPriceCache = new Map();
    this.edgeTradeData = new Map();
    
    this.logger.info('TradeLoopFinder initialized', {
      maxDepth: this.maxDepth,
      minEfficiency: this.minEfficiency,
      timeoutMs: this.globalTimeoutMs
    });
    
    // DEBUGGING: Log our target wallets for enhanced debugging
    this.logger.info('Enhanced logging enabled for target wallets', {
      targetWallets: this.TARGET_WALLETS.map(w => w.substring(0, 8) + '...')
    });
  }

  // DEBUGGING: Helper for checking if wallet is in our target list
  private isTargetWallet(walletAddress: string): boolean {
    return this.TARGET_WALLETS.includes(walletAddress);
  }
  
  // DEBUGGING: Helper for logging target wallet events
  private logTargetEvent(eventType: string, data: any): void {
    this.logger.info(`[TARGET DEBUG] ${eventType}`, data);
  }

  /**
   * Clean up resources when the service is no longer needed
   * Particularly important in test environments
   */
  dispose() {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }
    this.logger.info('TradeLoopFinderService resources disposed');
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCaches() {
    const now = Date.now();
    let expiredMetadata = 0;
    let expiredPrices = 0;
    
    // Clean up metadata cache
    for (const [key, value] of this.nftMetadataCache.entries()) {
      if (value.timestamp && now - value.timestamp > this.METADATA_CACHE_TTL) {
        this.nftMetadataCache.delete(key);
        expiredMetadata++;
      }
    }
    
    // Clean up price cache
    for (const [key, value] of this.nftPriceCache.entries()) {
      if (now - value.timestamp > this.PRICE_CACHE_TTL) {
        this.nftPriceCache.delete(key);
        expiredPrices++;
      }
    }
    
    this.logger.info(`Cache cleanup: Removed ${expiredMetadata} metadata and ${expiredPrices} price entries`, {
      expiredMetadata,
      expiredPrices,
      cacheStats: this.cacheStats
    });
  }
  
  /**
   * Find all possible trade loops for the given wallet states
   * 
   * @param wallets Map of wallet states
   * @param nftOwnership Map of NFT addresses to wallet addresses
   * @param wantedNfts Map of NFT addresses to Set of wallets that want them
   * @param rejectionPreferences Map of rejection preferences
   * @returns Array of discovered trade loops
   */
  public async findAllTradeLoops(
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences: Map<string, RejectionPreferences>
  ): Promise<TradeLoop[]> {
    const operation = this.logger.operation('findAllTradeLoops');
    this.startTime = performance.now();
    
    // Reset counters
    this.edgesTraversed = 0;
    this.cyclesFound = 0;
    
    operation.info('Starting trade loop discovery', {
      wallets: wallets.size,
      nfts: nftOwnership.size,
      wantedNfts: wantedNfts.size
    });
    
    try {
      // Step 1: Find direct matches (2-party trades)
      const directMatches = this.findDirectMatches(wallets, nftOwnership, wantedNfts, rejectionPreferences);
      
      // Step 2: Build a graph representation
      const graph = this.buildGraph(wallets, nftOwnership, wantedNfts, rejectionPreferences);
      
      operation.info('Graph constructed', {
        nodes: Object.keys(graph).length,
        edges: this.countEdges(graph)
      });
      
      // Step 3: Find cycles in the graph
      const cycles = this.findElementaryCycles(graph);
      
      operation.info('Cycle detection completed', {
        directMatches: directMatches.length,
        potentialTradeLoops: cycles.length
      });
      
      // Step 4: Convert cycles to valid trade loops
      const tradeLoops = this.convertToTradeLoops(cycles, wallets, nftOwnership, wantedNfts);
      
      operation.info('Validation completed', {
        validTradeLoops: tradeLoops.length
      });
      
      // Step 5: Add direct matches to the trade loops
      const allTradeLoops = [...directMatches, ...tradeLoops];
      
      // Step 6: Enhance trade loops with metadata and price information
      const enhancedTrades = await this.enhanceTradeLoopsWithMetadata(allTradeLoops);
      
      const endTime = performance.now();
      operation.info('Trade loop discovery completed', {
        duration: `${(endTime - this.startTime).toFixed(2)}ms`,
        totalTradeLoops: enhancedTrades.length,
        edgesTraversed: this.edgesTraversed,
        cyclesFound: this.cyclesFound
      });
      
      operation.end();
      return enhancedTrades;
    } catch (error) {
      operation.error('Error finding trade loops', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      operation.end();
      return [];
    }
  }

  /**
   * Comprehensive ownership verification for any NFT
   * This centralizes all ownership checks in one place
   */
  private verifyNFTOwnership(
    nftAddress: string, 
    ownerWallet: string,
    nftOwnership: Map<string, string>,
    wallets: Map<string, WalletState>
  ): boolean {
    // Get current owner from ownership map
    const recordedOwner = nftOwnership.get(nftAddress);
    
    // Verification 1: Check that we have ownership data at all
    if (!recordedOwner) {
      this.logger.info(`Ownership verification failed - no ownership record for NFT ${nftAddress}`);
      return false;
    }
    
    // Verification 2: Check ownership map matches specified owner
    if (recordedOwner !== ownerWallet) {
      this.logger.info(`Ownership verification failed - NFT ${nftAddress} is owned by ${recordedOwner}, not ${ownerWallet}`);
      return false;
    }
    
    // Verification 3: Check wallet state is consistent with ownership map
    const walletState = wallets.get(ownerWallet);
    if (!walletState) {
      this.logger.info(`Ownership verification failed - wallet ${ownerWallet} not found in state`);
      return false;
    }
    
    // Verification 4: Check wallet's owned NFTs includes this NFT
    if (!walletState.ownedNfts.has(nftAddress)) {
      this.logger.info(`Ownership verification failed - wallet ${ownerWallet} does not list NFT ${nftAddress} in owned NFTs`);
      return false;
    }
    
    // Ownership verified through all checks
    return true;
  }

  /**
   * Find direct matches between two wallets
   * These are the simplest trade loops (A → B → A) and are handled separately for efficiency
   * This optimized version reduces property lookups and implements early filtering
   */
  public findDirectMatches(
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences: Map<string, RejectionPreferences>
  ): TradeLoop[] {
    const startTime = performance.now();
    this.logger.info('\n=== Finding Direct Matches ===');
    this.logger.info(`Input: Wallets=${wallets.size}, NFT Ownership=${nftOwnership.size}, Wanted NFTs=${wantedNfts.size}`);
    
    const directMatches: TradeLoop[] = [];
    
    // Log wallet data only in debug mode to avoid excessive logging
    if (this.VERBOSE_LOGGING) {
      this.logger.info("\nWALLET DATA SNAPSHOT:");
      for (const [walletAddress, walletState] of wallets) {
        this.logger.info(`Wallet ${walletAddress}: owns ${walletState.ownedNfts.size} NFTs, wants ${walletState.wantedNfts.size} NFTs`);
        
        // Log first 3 owned NFTs
        if (walletState.ownedNfts.size > 0) {
          const ownedSample = Array.from(walletState.ownedNfts).slice(0, 3);
          this.logger.info(`  Owns: ${ownedSample.join(', ')}${walletState.ownedNfts.size > 3 ? '...' : ''}`);
        }
        
        // Log first 3 wanted NFTs
        if (walletState.wantedNfts.size > 0) {
          const wantedSample = Array.from(walletState.wantedNfts).slice(0, 3);
          this.logger.info(`  Wants: ${wantedSample.join(', ')}${walletState.wantedNfts.size > 3 ? '...' : ''}`);
        }
      }
    }
    
    // Pre-compute potential direct matches to avoid quadratic checking
    // For each wanted NFT, store the wallet that wants it along with its owner
    // This creates potential matches: { ownerWallet: { wanterWallet: [nftAddresses] } }
    const potentialMatches: Map<string, Map<string, string[]>> = new Map();
    
    // Process each wallet that wants NFTs - O(n) where n is number of wallets
    for (const [walletA, walletAState] of wallets) {
      // Skip wallets with no wanted NFTs - early filter
      if (!walletAState.wantedNfts || walletAState.wantedNfts.size === 0) continue;
      
      // For each wanted NFT, identify its owner
      for (const wantedNft of walletAState.wantedNfts) {
        // Who owns this NFT?
        const ownerWallet = nftOwnership.get(wantedNft);
        
        // Skip if NFT has no owner or is owned by the same wallet
        if (!ownerWallet || ownerWallet === walletA) continue;
        
        // Verify NFT ownership
        if (!this.verifyNFTOwnership(wantedNft, ownerWallet, nftOwnership, wallets)) continue;
        
        // Create a potential match entry
        if (!potentialMatches.has(ownerWallet)) {
          potentialMatches.set(ownerWallet, new Map());
        }
        
        const ownerMatches = potentialMatches.get(ownerWallet)!;
        if (!ownerMatches.has(walletA)) {
          ownerMatches.set(walletA, []);
        }
        
        ownerMatches.get(walletA)!.push(wantedNft);
      }
    }
    
    // Now check for reciprocal wants (2-way trades)
    // Process each owner wallet
    for (const [ownerWallet, wanterMap] of potentialMatches) {
      const ownerState = wallets.get(ownerWallet);
      if (!ownerState) continue; // Owner wallet no longer exists
      
      // Process each wanter wallet
      for (const [wanterWallet, wantedNfts] of wanterMap) {
        const wanterState = wallets.get(wanterWallet);
        if (!wanterState) continue; // Wanter wallet no longer exists
        
        // We already know wanterWallet wants NFTs from ownerWallet
        // Now check if ownerWallet wants any NFTs from wanterWallet
        
        // Find the intersection of what owner wants and what wanter owns
        const potentialResponseNfts: string[] = [];
        
        // Iterate the smaller set for efficiency
        if (ownerState.wantedNfts.size < wanterState.ownedNfts.size) {
          for (const nft of ownerState.wantedNfts) {
            if (wanterState.ownedNfts.has(nft) && 
                nftOwnership.get(nft) === wanterWallet && 
                !this.isTradeRejected(ownerWallet, nft, rejectionPreferences)) {
              potentialResponseNfts.push(nft);
            }
          }
        } else {
          for (const nft of wanterState.ownedNfts) {
            if (ownerState.wantedNfts.has(nft) && 
                !this.isTradeRejected(ownerWallet, nft, rejectionPreferences)) {
              potentialResponseNfts.push(nft);
            }
          }
        }
        
        // No response NFTs found
        if (potentialResponseNfts.length === 0) continue;
        
        // Choose a wanted NFT from owner to wanter (there could be multiple)
        for (const wantedNft of wantedNfts) {
          // Check if the trade is rejected by preferences
          if (this.isTradeRejected(wanterWallet, wantedNft, rejectionPreferences)) {
            continue;
          }
          
          // Valid direct match found!
          const responseNft = potentialResponseNfts[0]; // Take the first valid response
          
          this.logger.info(`Valid direct match: ${wanterWallet} wants ${wantedNft} from ${ownerWallet}, and ${ownerWallet} wants ${responseNft} from ${wanterWallet}`);
          
          // Create the trade loop
          const tradeLoop: TradeLoop = {
            id: this.generateCanonicalTradeId([wanterWallet, ownerWallet], [responseNft, wantedNft]),
            steps: [
              {
                from: wanterWallet,
                to: ownerWallet,
                nfts: [{
                  address: responseNft,
                  name: '',
                  symbol: '',
                  image: '',
                  collection: '',
                  description: '',
                  usedRealPrice: false,
                  hasFloorPrice: false
                }]
              },
              {
                from: ownerWallet,
                to: wanterWallet,
                nfts: [{
                  address: wantedNft,
                  name: '',
                  symbol: '',
                  image: '',
                  collection: '',
                  description: '',
                  usedRealPrice: false,
                  hasFloorPrice: false
                }]
              }
            ],
            totalParticipants: 2,
            efficiency: 1.0, // Direct matches have perfect efficiency
            rawEfficiency: 1.0,
            estimatedValue: 0, // Will be calculated later in enhanceTradeLoopsWithMetadata
            status: 'pending',
            progress: 0,
            createdAt: new Date()
          };
          
          directMatches.push(tradeLoop);
          
          // We've handled this wanted NFT, move to the next one
          break;
        }
      }
    }
    
    const endTime = performance.now();
    this.logger.info(`Direct match discovery completed in ${(endTime - startTime).toFixed(2)}ms`);
    this.logger.info(`Found ${directMatches.length} direct matches`);
    
    return directMatches;
  }
  
  /**
   * Build a directed graph where:
   * - Nodes are wallet addresses
   * - Edges represent "wants NFT from" relationships
   * - Edge data includes the NFT address
   */
  private buildGraph(
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences: Map<string, RejectionPreferences>
  ): { [key: string]: { [key: string]: string[] } } {
    // Create an adjacency list representation of the graph
    // Pre-allocate the graph with known wallet count
    const graph: { [key: string]: { [key: string]: string[] } } = Object.create(null);
    
    // Tracking metrics
    let possibleEdgesConsidered = 0;
    let edgesCreated = 0;
    let edgesRejectedOwnership = 0;
    let edgesRejectedWants = 0;
    let edgesRejectedNoReciprocal = 0;
    let edgesRejectedPreferences = 0;
    
    // DEBUGGING: Track edges between our target wallets
    const targetEdges: { from: string, to: string, nft: string }[] = [];
    
    // Set of target wallets for faster lookups
    const targetWalletsSet = new Set(this.TARGET_WALLETS);
    
    // Initialize empty adjacency lists for all wallets (pre-allocate known size)
    for (const wallet of wallets.keys()) {
      graph[wallet] = Object.create(null);
      this.walletsInGraph.add(wallet);
    }
    
    // DEBUGGING: Log detailed wallet states for target wallets
    for (const targetWallet of this.TARGET_WALLETS) {
      if (wallets.has(targetWallet)) {
        const state = wallets.get(targetWallet)!;
        this.logTargetEvent('Wallet State', {
          wallet: targetWallet.substring(0, 8) + '...',
          ownedNfts: Array.from(state.ownedNfts).slice(0, 5),
          wantedNfts: Array.from(state.wantedNfts).slice(0, 5),
          totalOwned: state.ownedNfts.size,
          totalWanted: state.wantedNfts.size,
          fullOwnedList: Array.from(state.ownedNfts),
          fullWantedList: Array.from(state.wantedNfts)
        });
      } else {
        this.logTargetEvent('Wallet Not In System', {
          wallet: targetWallet.substring(0, 8) + '...'
        });
      }
    }
    
    // For each NFT, find who wants it
    for (const [nftAddress, ownerWallet] of nftOwnership.entries()) {
      // Make sure the NFT and owner are still valid
      if (!ownerWallet || !wallets.has(ownerWallet)) {
        if (targetWalletsSet.has(ownerWallet)) {
          this.logTargetEvent('Invalid Owner for NFT', {
            nft: nftAddress,
            owner: ownerWallet || 'null/undefined',
            reason: !ownerWallet ? 'No owner specified' : 'Owner wallet not in system'
          });
        }
        continue;
      }
      
      // Get all wallets that want this NFT
      const wanters = wantedNfts.get(nftAddress);
      if (!wanters || wanters.size === 0) {
        // Only log for NFTs owned by target wallets to avoid excessive logging
        if (targetWalletsSet.has(ownerWallet)) {
          this.logTargetEvent('No Wanters for NFT', {
            nft: nftAddress,
            owner: ownerWallet.substring(0, 8) + '...'
          });
        }
        continue;
      }
      
      const isTargetWallet = targetWalletsSet.has(ownerWallet);
      
      // DEBUGGING: Log when a target wallet owns an NFT others want
      if (isTargetWallet) {
        this.logTargetEvent('Target Wallet Owns Wanted NFT', {
          wallet: ownerWallet.substring(0, 8) + '...',
          nft: nftAddress,
          wantedBy: Array.from(wanters).map(w => w.substring(0, 8) + '...'),
          fullWantersList: Array.from(wanters)
        });
      }
      
      // Create edges from owner to each wanter
      for (const wanter of wanters) {
        // Skip if wanter is not a valid wallet
        if (!wallets.has(wanter)) {
          if (isTargetWallet || targetWalletsSet.has(wanter)) {
            this.logTargetEvent('Invalid Wanter', {
              nft: nftAddress,
              owner: ownerWallet.substring(0, 8) + '...',
              wanter: wanter.substring(0, 8) + '...',
              reason: 'Wanter wallet not in system'
            });
          }
          continue;
        }
        
        possibleEdgesConsidered++;
        
        // Skip self-loops
        if (wanter === ownerWallet) {
          if (isTargetWallet || targetWalletsSet.has(wanter)) {
            this.logTargetEvent('Edge Rejected', {
              nft: nftAddress,
              from: ownerWallet.substring(0, 8) + '...',
              to: wanter.substring(0, 8) + '...',
              reason: 'Self-loop (owner and wanter are the same)'
            });
          }
          edgesRejectedOwnership++;
          continue;
        }
        
        // Check if wanter wants the NFT and doesn't have rejection preferences for it
        const wanterState = wallets.get(wanter)!;
        if (!wanterState.wantedNfts.has(nftAddress)) {
          edgesRejectedWants++;
          
          // DEBUGGING: Log when a target wallet should want an NFT but doesn't
          if (targetWalletsSet.has(wanter)) {
            this.logTargetEvent('Target Wallet Missing Want', {
              wallet: wanter.substring(0, 8) + '...',
              nft: nftAddress,
              owner: ownerWallet.substring(0, 8) + '...',
              wantsInState: Array.from(wanterState.wantedNfts).slice(0, 5),
              reason: 'NFT not in wallet\'s wanted list',
              fullWantsList: Array.from(wanterState.wantedNfts)
            });
          }
          continue;
        }
        
        // Check rejection preferences
        const wanterRejections = rejectionPreferences.get(wanter);
        if (wanterRejections) {
          // Check for rejections at NFT level
          if (wanterRejections.nfts?.has(nftAddress)) {
            if (isTargetWallet || targetWalletsSet.has(wanter)) {
              this.logTargetEvent('Edge Rejected', {
                nft: nftAddress,
                from: ownerWallet.substring(0, 8) + '...',
                to: wanter.substring(0, 8) + '...',
                reason: 'NFT rejected by wanter'
              });
            }
            edgesRejectedPreferences++;
            continue;
          }
          
          // Check for rejections at wallet level
          if (wanterRejections.wallets?.has(ownerWallet)) {
            if (isTargetWallet || targetWalletsSet.has(wanter)) {
              this.logTargetEvent('Edge Rejected', {
                nft: nftAddress,
                from: ownerWallet.substring(0, 8) + '...',
                to: wanter.substring(0, 8) + '...',
                reason: 'Owner wallet rejected by wanter'
              });
            }
            edgesRejectedPreferences++;
            continue;
          }
        }
        
        // We have a valid edge from owner to wanter
        // The edge represents: owner has an NFT that wanter wants
        if (!graph[ownerWallet][wanter]) {
          graph[ownerWallet][wanter] = [];
        }
        graph[ownerWallet][wanter].push(nftAddress);
        edgesCreated++;
        
        // Store edge data for later validation
        const edgeKey = `${ownerWallet}->${wanter}:${nftAddress}`;
        this.edgeTradeData.set(edgeKey, {
          fromOwner: nftAddress,   // NFT owned by sender
          fromWanter: ''  // Will be filled in later if there's a reciprocal want
        });
        
        // DEBUGGING: Track edges between target wallets
        if (targetWalletsSet.has(ownerWallet) && targetWalletsSet.has(wanter)) {
          targetEdges.push({
            from: ownerWallet,
            to: wanter,
            nft: nftAddress
          });
          
          this.logTargetEvent('Added Edge Between Target Wallets', {
            from: ownerWallet.substring(0, 8) + '...',
            to: wanter.substring(0, 8) + '...',
            nft: nftAddress,
            edgeKey
          });
        }
      }
    }
    
    // DEBUGGING: Analyze specific paths between our target wallets
    this.logTargetEvent('All Target Wallet Edges', { edges: targetEdges });
    
    // Analyze potential 3-way trades between our target wallets
    if (this.TARGET_WALLETS.length >= 3) {
      // Create a detailed graph analysis for any potential N-way trade involving target wallets
      this.analyzeTargetWalletTrades(graph);
      
      // Check all possible 3-cycles between target wallets
      const numTargets = this.TARGET_WALLETS.length;
      for (let i = 0; i < numTargets; i++) {
        const walletA = this.TARGET_WALLETS[i];
        
        for (let j = 0; j < numTargets; j++) {
          if (j === i) continue;
          const walletB = this.TARGET_WALLETS[j];
          
          // Does A → B edge exist?
          const aToB = graph[walletA] && graph[walletA][walletB];
          if (!aToB) {
            this.logTargetEvent('Missing Edge', {
              from: walletA.substring(0, 8) + '...',
              to: walletB.substring(0, 8) + '...',
              reason: graph[walletA] ? 'No connection from source to target' : 'Source wallet has no outgoing edges'
            });
            continue;
          }
          
          for (let k = 0; k < numTargets; k++) {
            if (k === i || k === j) continue;
            const walletC = this.TARGET_WALLETS[k];
            
            // Does B → C edge exist?
            const bToC = graph[walletB] && graph[walletB][walletC];
            // Does C → A edge exist?
            const cToA = graph[walletC] && graph[walletC][walletA];
            
            if (aToB && bToC && cToA) {
              this.logTargetEvent('3-PARTY CYCLE DETECTED!', {
                cycle: `${walletA.substring(0, 8)} → ${walletB.substring(0, 8)} → ${walletC.substring(0, 8)} → ${walletA.substring(0, 8)}`,
                aToB_NFTs: aToB,
                bToC_NFTs: bToC,
                cToA_NFTs: cToA
              });
            } else {
              this.logTargetEvent('Incomplete 3-Party Cycle', {
                cycle: `${walletA.substring(0, 8)} → ${walletB.substring(0, 8)} → ${walletC.substring(0, 8)} → ${walletA.substring(0, 8)}`,
                aToB: aToB ? 'Yes' : 'No',
                bToC: bToC ? 'Yes' : 'No',
                cToA: cToA ? 'Yes' : 'No',
                aToB_NFTs: aToB || '[none]',
                bToC_NFTs: bToC || '[none]',
                cToA_NFTs: cToA || '[none]',
                reasons: {
                  bToC: !bToC ? (graph[walletB] ? 'No connection from B to C' : 'Wallet B has no outgoing edges') : null,
                  cToA: !cToA ? (graph[walletC] ? 'No connection from C to A' : 'Wallet C has no outgoing edges') : null
                }
              });
            }
          }
        }
      }
    }
    
    // Define the trade path check function - more generalized approach
    const checkTradePaths = () => {
      // Test specific paths between wallets (can be modified for any set of wallets)
      const pathsToCheck = [
        // Our 3-way GhostKid loop
        {
          name: "GhostKid 3-way loop",
          path: [
            this.TARGET_WALLETS[1], // wallet A
            this.TARGET_WALLETS[2], // wallet B
            this.TARGET_WALLETS[0], // wallet C
            this.TARGET_WALLETS[1]  // back to wallet A to complete the loop
          ]
        }
      ];

      for (const testPath of pathsToCheck) {
        const results = [];
        let isComplete = true;
        
        for (let i = 0; i < testPath.path.length - 1; i++) {
          const from = testPath.path[i];
          const to = testPath.path[i + 1];
          
          // Check if this edge exists in the graph
          const edgeExists = graph[from] && graph[from][to] && graph[from][to].length > 0;
          const nfts = edgeExists ? graph[from][to] : [];
          
          results.push({
            from: from.substring(0, 8) + '...',
            to: to.substring(0, 8) + '...',
            exists: edgeExists ? 'YES' : 'NO',
            nfts: nfts,
            reason: !edgeExists 
              ? (graph[from] 
                ? 'No connection to target wallet' 
                : 'Source wallet has no outgoing edges')
              : null
          });
          
          if (!edgeExists) {
            isComplete = false;
          }
        }
        
        this.logTargetEvent(`Path Check: ${testPath.name}`, {
          edges: results,
          isComplete: isComplete,
          conclusion: isComplete 
            ? 'Complete path exists - should be detectable by the algorithm' 
            : 'Incomplete path - missing edges will prevent detection'
        });
      }
    };
    
    // Run enhanced path checking
    checkTradePaths();
    
    this.logger.info('Graph construction metrics', {
      wallets: wallets.size,
      nfts: nftOwnership.size,
      wants: wantedNfts.size,
      possibleEdgesConsidered,
      edgesCreated,
      edgesRejectedOwnership,
      edgesRejectedWants,
      edgesRejectedNoReciprocal,
      edgesRejectedPreferences
    });
    
    return graph;
  }

  /**
   * Analyze trades involving target wallets in a more structured way
   */
  private analyzeTargetWalletTrades(graph: { [key: string]: { [key: string]: string[] } }): void {
    // Create an N x N matrix of edges between target wallets
    const edgeMatrix: { [key: string]: { [key: string]: string[] } } = {};
    
    for (const fromWallet of this.TARGET_WALLETS) {
      edgeMatrix[fromWallet] = {};
      
      for (const toWallet of this.TARGET_WALLETS) {
        if (fromWallet === toWallet) continue;
        
        // Check if an edge exists from fromWallet to toWallet
        const edge = graph[fromWallet] && graph[fromWallet][toWallet];
        edgeMatrix[fromWallet][toWallet] = edge || [];
      }
    }
    
    // Log the edge matrix
    this.logTargetEvent('Target Wallet Edge Matrix', {
      matrix: Object.fromEntries(
        Object.entries(edgeMatrix).map(([from, edges]) => [
          from.substring(0, 8) + '...',
          Object.fromEntries(
            Object.entries(edges).map(([to, nfts]) => [
              to.substring(0, 8) + '...',
              nfts.length ? nfts : '[none]'
            ])
          )
        ])
      )
    });
    
    // Look for potential cycles of any length (2 to N)
    for (let cycleLength = 2; cycleLength <= this.TARGET_WALLETS.length; cycleLength++) {
      this.findTargetWalletCycles(edgeMatrix, cycleLength);
    }
  }
  
  /**
   * Find cycles of a specific length between target wallets
   */
  private findTargetWalletCycles(
    edgeMatrix: { [key: string]: { [key: string]: string[] } },
    cycleLength: number
  ): void {
    const findCyclesHelper = (
      startWallet: string,
      currentWallet: string,
      path: string[],
      depth: number
    ) => {
      // Check if we completed a cycle
      if (depth === cycleLength && edgeMatrix[currentWallet][startWallet]?.length > 0) {
        const completeCycle = [...path, startWallet];
        
        this.logTargetEvent(`${cycleLength}-Party Trade Loop Found`, {
          cycle: completeCycle.map(w => w.substring(0, 8) + '...').join(' → '),
          edges: completeCycle.map((wallet, index) => {
            const nextWallet = index === completeCycle.length - 1 
              ? completeCycle[0] 
              : completeCycle[index + 1];
            
            return {
              from: wallet.substring(0, 8) + '...',
              to: nextWallet.substring(0, 8) + '...',
              nfts: edgeMatrix[wallet][nextWallet] || '[none]'
            };
          }).slice(0, -1)  // Remove the last edge which is duplicated
        });
        
        return;
      }
      
      if (depth === cycleLength) return;
      
      // Try all possible next wallets
      for (const nextWallet of this.TARGET_WALLETS) {
        if (path.includes(nextWallet)) continue;  // Avoid revisiting wallets
        
        // Check if edge exists
        if (edgeMatrix[currentWallet][nextWallet]?.length > 0) {
          path.push(nextWallet);
          findCyclesHelper(startWallet, nextWallet, path, depth + 1);
          path.pop();
        }
      }
    };
    
    // Try starting from each target wallet
    for (const startWallet of this.TARGET_WALLETS) {
      findCyclesHelper(startWallet, startWallet, [startWallet], 1);
    }
  }

  /**
   * Count the total number of edges in the graph
   */
  private countEdges(graph: { [key: string]: { [key: string]: string[] } }): number {
    let edgeCount = 0;
    for (const node in graph) {
      // Use Object.keys for consistency and potential minor optimization
      edgeCount += Object.keys(graph[node] || {}).length;
    }
    return edgeCount;
  }
  
  /**
   * Check if a trade is rejected based on preferences
   */
  private isTradeRejected(
    walletAddress: string,
    nftAddress: string,
    rejectionPreferences: Map<string, RejectionPreferences>
  ): boolean {
    const preferences = rejectionPreferences.get(walletAddress);
    if (!preferences) return false;
    
    // Check if this NFT is rejected
    if (preferences.nfts.has(nftAddress)) return true;
    
    return false;
  }
  
  /**
   * Implementation of Johnson's algorithm for finding elementary cycles
   */
  private findElementaryCycles(graph: { [key: string]: { [key: string]: string[] } }): string[][] {
    // Use cached nodes array instead of repeatedly calling Object.keys
    const nodes = Object.keys(graph);
    const edgesCount = this.countEdges(graph); // Use the helper method
    
    this.logger.info('findElementaryCycles called with graph:', {
      nodes: nodes.length,
      edges: edgesCount
    });
    
    const sccFinder = SCCFinderService.getInstance();
    
    // Configure SCCFinderService with appropriate timeout
    sccFinder.configure({
      timeoutMs: this.globalTimeoutMs,
      enablePruning: true
    });
    
    // Step 1: Find strongly connected components (SCCs)
    const sccStartTime = performance.now();
    const sccResult = sccFinder.findStronglyConnectedComponents(graph, nodes);
    const sccDuration = performance.now() - sccStartTime;
    
    // Extract SCCs and metadata from the result
    const sccs = sccResult.sccs;
    const sccMetadata = sccResult.metadata;
    
    // Get performance metrics from SCCFinderService if available
    const sccMetrics = sccFinder.getPerformanceMetrics();
    this.logger.info('SCC detection metrics:', {
      timeElapsed: sccMetrics?.timeElapsed?.toFixed(2) || 'N/A',
      nodesProcessed: sccMetadata.processedNodes.length,
      timedOut: sccMetadata.timedOut,
      durationMs: sccDuration.toFixed(2)
    });
    
    // Warn if SCC detection timed out
    if (sccMetadata.timedOut) {
      this.logger.warn('SCC detection timed out - results may be incomplete', {
        processedNodes: sccMetadata.processedNodes.length,
        totalNodes: nodes.length
      });
    }
    
    this.logger.info(`Found ${sccs.length} strongly connected components`);
    
    // Keep only SCCs that could contain cycles - use Set for fast lookups later
    // Double-check to ensure we only process SCCs that can contain cycles
    // This maintains the original filtering logic in case SCCFinderService doesn't filter
    const potentialCyclicSccs = sccs.filter(scc => 
      scc.length > 1 || (scc.length === 1 && graph[scc[0]] && scc[0] in graph[scc[0]])
    );
    this.logger.info(`Found ${potentialCyclicSccs.length} SCCs with potential cycles`);
    
    // Pre-allocate expected size - avoids repeated array expansions
    // Setting an initial capacity based on typical results from past runs
    const allCycles: string[][] = [];
    // Cache target wallet set for faster lookups
    const targetWalletsSet = new Set(this.TARGET_WALLETS);
    
    // Process each SCC in parallel if environment supports it and SCCs are complex enough
    // For now we'll process them sequentially with optimizations
    const cycleFinder = CycleFinderService.getInstance(); // Get instance once
    
    for (const scc of potentialCyclicSccs) {
      // Check if this SCC contains any target wallets - use our cached Set
      const targetWalletsInScc = scc.filter(wallet => targetWalletsSet.has(wallet));
      const hasSomeTargetWallets = targetWalletsInScc.length > 0;
      const hasAllTargetWallets = targetWalletsInScc.length === this.TARGET_WALLETS.length;
      
      if (hasSomeTargetWallets) {
        this.logTargetEvent('Processing SCC With Target Wallets', {
          sccSize: scc.length,
          targetWallets: targetWalletsInScc.map(w => w.substring(0, 8) + '...'),
          allTargetsPresent: hasAllTargetWallets,
          otherWallets: scc.length > targetWalletsInScc.length 
            ? `Plus ${scc.length - targetWalletsInScc.length} other wallets`
            : 'No other wallets'
        });
      }
      
      // Create a subgraph for this SCC - use null prototype for faster property lookups
      const subgraph: { [key: string]: { [key: string]: string[] } } = Object.create(null);
      // Pre-compute a Set for faster lookup - O(1) contains checks vs O(n) array search
      const sccNodesSet = new Set(scc);
      
      // Build subgraph by filtering the main graph to only include nodes in this SCC
      for (const node of scc) {
        subgraph[node] = Object.create(null);
        const nodeEdges = graph[node];
        if (nodeEdges) {
          // Use direct property access for faster iteration
          for (const neighbor in nodeEdges) {
            // Only include edges to nodes within this SCC - O(1) lookup with Set
            if (sccNodesSet.has(neighbor)) {
              subgraph[node][neighbor] = nodeEdges[neighbor];
              
              // Log target wallet connections within the SCC
              if (targetWalletsSet.has(node) && targetWalletsSet.has(neighbor)) {
                this.logTargetEvent('Target Wallet Edge in SCC', {
                  from: node.substring(0, 8) + '...',
                  to: neighbor.substring(0, 8) + '...',
                  nfts: nodeEdges[neighbor]
                });
              }
            }
          }
        }
      }
      
      // Analyze subgraph density to optimize processing approach
      let totalEdges = 0;
      for (const node in subgraph) {
        totalEdges += Object.keys(subgraph[node]).length;
      }
      
      const density = scc.length > 0 ? totalEdges / (scc.length * scc.length) : 0;
      const averageOutDegree = scc.length > 0 ? totalEdges / scc.length : 0;
      
      if (hasSomeTargetWallets) {
        this.logTargetEvent('SCC Metrics', {
          nodes: scc.length,
          edges: totalEdges,
          density: density.toFixed(3),
          averageOutDegree: averageOutDegree.toFixed(2)
        });
      }
      
      // Configure cycle finder based on graph density - same logic as original code
      const isDenseGraph = density > 0.2 || averageOutDegree > 5;
      const cycleLimit = isDenseGraph ? this.MAX_CYCLES_DENSE_GRAPH : Infinity;
      const maxDepth = parseInt(process.env.TRADELOOP_MAX_DEPTH || '11', 10);
      
      // *** USE EXTERNAL SERVICE for cycle finding ***
      // Configure the cycle finder instance with the same parameters as original implementation
      cycleFinder.configure({ 
        timeoutMs: this.globalTimeoutMs,
        maxDepth: maxDepth,
        cycleLimit: cycleLimit
      });
      
      if (isDenseGraph && hasSomeTargetWallets) {
        this.logTargetEvent('Using Dense Graph Configuration', {
          sccSize: scc.length,
          cycleLimit: cycleLimit,
          density: density.toFixed(3)
        });
      }
      
      // Find cycles within this SCC's subgraph using the dedicated service
      const sccStartTime = performance.now();
      const cyclesFromScc = cycleFinder.findElementaryCycles(subgraph);
      const sccDuration = performance.now() - sccStartTime;
      
      // Update performance metrics with results from CycleFinderService
      const cycleFinderMetrics = cycleFinder.getPerformanceMetrics();
      this.edgesTraversed += cycleFinderMetrics.edgesTraversed;
      this.cyclesFound += cycleFinderMetrics.cyclesFound;
      
      // Log results for this SCC if it contains target wallets
      if (hasSomeTargetWallets) {
        this.logTargetEvent('Cycle Finder Completed for SCC', {
          sccSize: scc.length,
          durationMs: sccDuration.toFixed(2),
          cyclesFound: cyclesFromScc.length,
          edgesTraversed: cycleFinderMetrics.edgesTraversed,
          isDenseGraph: isDenseGraph,
          limits: {
            maxDepth: maxDepth,
            cycleLimit: cycleLimit
          }
        });
        
        // Filter cycles that contain target wallets
        const targetWalletCycles = cyclesFromScc.filter(cycle => 
          cycle.some(wallet => targetWalletsSet.has(wallet))
        );
        
        this.logTargetEvent('Cycles Found in SCC', {
          totalCycles: cyclesFromScc.length,
          targetWalletCycles: targetWalletCycles.length,
          examples: targetWalletCycles.slice(0, 3).map(cycle => 
            cycle.map(w => w.substring(0, 8) + '...').join(' → ')
          )
        });
      }
      
      // Add cycles from this SCC to the overall list - use push.apply for better performance
      // with large arrays (avoids repeated .push calls)
      if (cyclesFromScc.length > 0) {
        allCycles.push(...cyclesFromScc);
      }
    }
    
    // Filter cycles that exceed maximum depth - increased to 11 or from env var
    const maxDepth = parseInt(process.env.TRADELOOP_MAX_DEPTH || '11', 10);
    // Note: we already check this in the DFS, but adding a safety check here
    const filteredCycles = allCycles.filter(cycle => cycle.length <= maxDepth);
    
    // Check if any of our target wallet cycles were dropped due to depth
    const targetCyclesBeforeFilter = allCycles.filter(cycle => 
      cycle.some(wallet => targetWalletsSet.has(wallet))
    ).length;
    
    const targetCyclesAfterFilter = filteredCycles.filter(cycle => 
      cycle.some(wallet => targetWalletsSet.has(wallet))
    ).length;
    
    if (targetCyclesBeforeFilter > targetCyclesAfterFilter) {
      this.logTargetEvent('Target Cycles Filtered by Depth', {
        before: targetCyclesBeforeFilter,
        after: targetCyclesAfterFilter,
        droppedCycles: targetCyclesBeforeFilter - targetCyclesAfterFilter,
        maxDepth
      });
    }
    
    this.logger.info(`Found ${allCycles.length} total cycles, ${filteredCycles.length} within depth limit`);
    
    return filteredCycles;
  }
  
  /**
   * Convert a list of cycles (list of wallet addresses) into valid trade loops
   * Only trade loops with valid trade items are returned
   */
  private convertToTradeLoops(
    cycles: string[][],
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>
  ): TradeLoop[] {
    const validTradeLoops: TradeLoop[] = [];
    
    for (const cycle of cycles) {
      // Skip invalid cycles
      if (cycle.length < 2) continue;
      
      // For each cycle, try to construct valid trade steps
      const steps: any[] = [];
      let isValidCycle = true;
      
      // Helper function to create trade step permutations
      const buildPermutations = (
        currentStepIndex: number,
        accumulatedSteps: any[] // Array of TradeLoopStep like objects
      ): void => {
        // If we've processed all steps, we have a complete valid path
        if (currentStepIndex >= cycle.length) {
          // Validate ownership for all steps before accepting this permutation
          let allOwnershipValid = true;
          for (const step of accumulatedSteps) {
            const fromWallet = step.from;
            for (const nft of step.nfts) {
              if (!this.verifyNFTOwnership(nft.address, fromWallet, nftOwnership, wallets)) {
                allOwnershipValid = false;
                break;
              }
            }
            if (!allOwnershipValid) break;
          }
          
          // Only accept permutations with valid ownership
          if (allOwnershipValid) {
            // Create a new valid trade loop
            const tradeLoop: TradeLoop = {
              id: this.generateCanonicalTradeId(
                cycle, 
                accumulatedSteps.map(step => step.nfts[0].address)
              ),
              steps: accumulatedSteps.map(step => ({
                ...step,
                completed: false
              })),
              totalParticipants: cycle.length,
              efficiency: 1.0 / cycle.length,
              rawEfficiency: 1.0 / cycle.length,
              estimatedValue: 0, // Will be calculated later
              status: 'pending',
              progress: 0,
              createdAt: new Date()
            };
            
            validTradeLoops.push(tradeLoop);
          }
          return;
        }
        
        const fromIndex = currentStepIndex;
        const toIndex = (currentStepIndex + 1) % cycle.length;
        const fromWallet = cycle[fromIndex];
        const toWallet = cycle[toIndex];
        
        // Get wallet states
        const fromWalletState = wallets.get(fromWallet);
        const toWalletState = wallets.get(toWallet);
        
        if (!fromWalletState || !toWalletState) {
          // Can't form a valid step, abandon this path
          return;
        }
        
        // Find NFTs that fromWallet owns that toWallet wants
        const possibleNfts: string[] = [];
        
        for (const ownedNft of fromWalletState.ownedNfts) {
          // Verify ownership before considering this NFT
          if (!this.verifyNFTOwnership(ownedNft, fromWallet, nftOwnership, wallets)) {
            continue;
          }
          
          if (toWalletState.wantedNfts.has(ownedNft)) {
            possibleNfts.push(ownedNft);
          }
        }
        
        // If no valid NFTs for this step, abandon this path
        if (possibleNfts.length === 0) {
          return;
        }
        
        // For each possible NFT, continue building the path
        // NOTE: We only use the first valid NFT to avoid combinatorial explosion
        // In the future, we might want to explore multiple options
        const chosenNft = possibleNfts[0];
        
        const newStep = {
          from: fromWallet,
          to: toWallet,
          nfts: [{
            address: chosenNft,
            name: '',
            symbol: '',
            image: '',
            collection: '',
            description: '',
            usedRealPrice: false,
            hasFloorPrice: false
          }]
        };
        
        // Continue with this chosen NFT
        buildPermutations(currentStepIndex + 1, [...accumulatedSteps, newStep]);
      };
      
      // Start building permutations from the first step
      buildPermutations(0, []);
    }
    
    this.logger.info(`Converted ${cycles.length} cycles to ${validTradeLoops.length} valid trade loops with ownership verification`);
    return validTradeLoops;
  }
  
  /**
   * Enhance trade loops with NFT metadata and price information
   * Uses batch processing to minimize API calls and improve performance
   */
  private async enhanceTradeLoopsWithMetadata(tradeLoops: TradeLoop[]): Promise<TradeLoop[]> {
    const startTime = performance.now();
    this.logger.info(`Enhancing ${tradeLoops.length} trade loops with metadata`);
    
    // If no loops to enhance, return immediately
    if (tradeLoops.length === 0) {
      return [];
    }
    
    // Step 1: Extract all unique NFT addresses across all trade loops
    const uniqueNftAddresses = new Set<string>();
    for (const loop of tradeLoops) {
      for (const step of loop.steps) {
        for (const nft of step.nfts) {
          uniqueNftAddresses.add(nft.address);
        }
      }
    }
    
    this.logger.info(`Found ${uniqueNftAddresses.size} unique NFTs across all trade loops`);
    
    // Step 2: Batch prefetch metadata and prices for all NFTs
    const nftAddressArray = Array.from(uniqueNftAddresses);
    const metadataPromises: Promise<any>[] = [];
    const pricePromises: Promise<number | null>[] = [];
    
    // Track which NFTs already have cached metadata and prices
    const cachedMetadataNfts = new Set<string>();
    const cachedPriceNfts = new Set<string>();
    
    // Check cache first for each NFT
    for (const nftAddress of nftAddressArray) {
      // Check if metadata is cached
      if (this.nftMetadataCache.has(nftAddress)) {
        const cachedData = this.nftMetadataCache.get(nftAddress);
        if (!cachedData.timestamp || Date.now() - cachedData.timestamp < this.METADATA_CACHE_TTL) {
          cachedMetadataNfts.add(nftAddress);
        }
      }
      
      // Check if price is cached
      if (this.nftPriceCache.has(nftAddress)) {
        const cachedPrice = this.nftPriceCache.get(nftAddress);
        if (cachedPrice && Date.now() - cachedPrice.timestamp < this.PRICE_CACHE_TTL) {
          cachedPriceNfts.add(nftAddress);
        }
      }
    }
    
    // Log cache hits
    this.logger.info(`Cache stats: ${cachedMetadataNfts.size} metadata cache hits, ${cachedPriceNfts.size} price cache hits`);
    
    // Create batches of uncached NFTs
    const BATCH_SIZE = 50; // Adjust based on API limitations
    const uncachedMetadataNfts = nftAddressArray.filter(nft => !cachedMetadataNfts.has(nft));
    const uncachedPriceNfts = nftAddressArray.filter(nft => !cachedPriceNfts.has(nft));
    
    // Batch preload metadata
    if (uncachedMetadataNfts.length > 0) {
      // Process in batches to avoid overwhelming APIs
      for (let i = 0; i < uncachedMetadataNfts.length; i += BATCH_SIZE) {
        const batch = uncachedMetadataNfts.slice(i, i + BATCH_SIZE);
        
        try {
          this.logger.info(`Preloading metadata batch ${i/BATCH_SIZE + 1}/${Math.ceil(uncachedMetadataNfts.length/BATCH_SIZE)}, size: ${batch.length}`);
          // Create a promise for each NFT in the batch
          for (const nftAddress of batch) {
            metadataPromises.push(this.getNFTMetadata(nftAddress));
          }
        } catch (error) {
          this.logger.error(`Error preloading metadata batch: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    
    // Batch preload prices (ideally using a batch API if available)
    if (uncachedPriceNfts.length > 0) {
      // If available, use batch price API
      if (uncachedPriceNfts.length > BATCH_SIZE && typeof this.nftPricingService.batchGetFloorPrices === 'function') {
        try {
          this.logger.info(`Using batch API to preload ${uncachedPriceNfts.length} NFT prices`);
          await this.nftPricingService.batchGetFloorPrices(uncachedPriceNfts);
          // After batch loading, individual getNFTPrice calls should hit the cache
        } catch (error) {
          this.logger.error(`Error in batch price preloading: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // In any case, prepare individual price promises
      for (let i = 0; i < uncachedPriceNfts.length; i += BATCH_SIZE) {
        const batch = uncachedPriceNfts.slice(i, i + BATCH_SIZE);
        
        this.logger.info(`Preloading prices batch ${i/BATCH_SIZE + 1}/${Math.ceil(uncachedPriceNfts.length/BATCH_SIZE)}, size: ${batch.length}`);
        // Create a promise for each NFT in the batch
        for (const nftAddress of batch) {
          pricePromises.push(this.getNFTPrice(nftAddress, 'enhanceTradeLoopsWithMetadata'));
        }
      }
    }
    
    // Step 3: Wait for all metadata and price prefetching to complete
    // This ensures we've populated the cache with all needed data
    if (metadataPromises.length > 0 || pricePromises.length > 0) {
      this.logger.info(`Waiting for ${metadataPromises.length} metadata and ${pricePromises.length} price prefetch operations to complete...`);
      await Promise.all([...metadataPromises, ...pricePromises]);
      this.logger.info('All prefetch operations complete');
    }
    
    // Step 4: Now enhance each trade loop - should mostly hit cache
    const enhancedLoops: TradeLoop[] = [];
    
    // Process loops in parallel batches to improve performance on multi-core systems
    const LOOP_BATCH_SIZE = 100;
    
    for (let i = 0; i < tradeLoops.length; i += LOOP_BATCH_SIZE) {
      const batch = tradeLoops.slice(i, i + LOOP_BATCH_SIZE);
      const batchPromises = batch.map(async (loop) => {
        let totalValue = 0;
        
        // Enhance each step with NFT metadata - should now hit cache for most/all
        for (const step of loop.steps) {
          for (const nft of step.nfts) {
            try {
              // Get NFT metadata and price information from cache
              const metadata = await this.getNFTMetadata(nft.address);
              
              nft.name = metadata.name || '';
              nft.symbol = metadata.symbol || '';
              nft.image = metadata.image || '';
              nft.collection = typeof metadata.collection === 'string' 
                ? metadata.collection 
                : (metadata.collection?.name || '');
              nft.description = metadata.description || '';
              
              // Get price - should now hit cache
              const price = await this.getNFTPrice(nft.address, 'enhanceTradeLoopsWithMetadata');
              nft.floorPrice = price || 0;
              nft.usedRealPrice = price !== null;
              nft.hasFloorPrice = price !== null;
              
              totalValue += nft.floorPrice;
            } catch (error) {
              this.logger.error(`Error enhancing NFT metadata for ${nft.address}: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
        
        // Update estimated value
        loop.estimatedValue = totalValue;
        
        return loop;
      });
      
      // Wait for this batch to complete
      const completedBatch = await Promise.all(batchPromises);
      enhancedLoops.push(...completedBatch);
      
      // Log progress
      if (i + LOOP_BATCH_SIZE < tradeLoops.length) {
        this.logger.info(`Enhanced ${i + LOOP_BATCH_SIZE}/${tradeLoops.length} trade loops`);
      }
    }
    
    const endTime = performance.now();
    this.logger.info(`Enhanced ${enhancedLoops.length} trade loops with metadata in ${(endTime - startTime).toFixed(2)}ms`);
    
    return enhancedLoops;
  }
  
  /**
   * Get NFT metadata from cache or API
   */
  private async getNFTMetadata(nftAddress: string): Promise<any> {
    // Check cache first
    if (this.nftMetadataCache.has(nftAddress)) {
      const cachedData = this.nftMetadataCache.get(nftAddress);
      // Check if data is still valid
      if (!cachedData.timestamp || Date.now() - cachedData.timestamp < this.METADATA_CACHE_TTL) {
        this.cacheStats.metadataHits++;
        return cachedData;
      }
    }
    
    this.cacheStats.metadataMisses++;
    this.cacheStats.apiCalls++;
    
    try {
      // Fetch from API
      const metadata = await this.nftService.getNFTMetadata(nftAddress);
      
      // Update cache with timestamp
      const cachedData = {
        ...metadata,
        timestamp: Date.now()
      };
      this.nftMetadataCache.set(nftAddress, cachedData);
      
      return cachedData;
    } catch (error) {
      this.logger.error(`Error fetching NFT metadata for ${nftAddress}`, { error });
      
      // Return basic placeholder if fetch fails
      return {
        address: nftAddress,
        name: `NFT ${nftAddress.slice(0, 8)}...`,
        symbol: 'NFT',
        image: '',
        collection: '',
        description: 'NFT metadata unavailable',
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Get NFT price from cache or API with optimistic update and customizable options
   */
  private async getNFTPrice(nftAddress: string, contextId: string): Promise<number | null> {
    try {
      // First check if we have the price in our local cache
      if (this.nftPriceCache.has(nftAddress)) {
        const cachedPrice = this.nftPriceCache.get(nftAddress);
        return cachedPrice?.price || null;
      }
      
      // Next, try to load from pricing service with a short timeout
      try {
        const price = await this.nftPricingService.estimateNFTPrice(nftAddress);
        
        if (price !== null && price !== undefined) {
          // Update cache and return
          this.nftPriceCache.set(nftAddress, {
            price,
            timestamp: Date.now()
          });
          return price;
        }
      } catch (error: unknown) {
        // Log but continue with fallback options
        const priceError = error instanceof Error ? error : new Error(String(error));
        this.logger.debug(`[${contextId}] Price lookup failed for NFT ${nftAddress}: ${priceError.message}`);
      }
      
      // If we reach here, pricing service didn't return a valid price
      // Check if NFT has collection info we can use for floor price
      const nftData = await this.getNFTMetadata(nftAddress);
      
      if (nftData?.collectionName) {
        try {
          const floorPrice = await this.nftPricingService.getFloorPrice(nftData.collectionName);
          
          if (floorPrice !== null && floorPrice !== undefined) {
            // Cache and return floor price
            this.nftPriceCache.set(nftAddress, {
              price: floorPrice,
              timestamp: Date.now()
            });
            return floorPrice;
          }
        } catch (error: unknown) {
          const floorError = error instanceof Error ? error : new Error(String(error));
          this.logger.debug(`[${contextId}] Floor price lookup failed for collection ${nftData.collectionName}: ${floorError.message}`);
        }
      }
      
      // All pricing methods failed
      // Cache null to avoid repeated lookups and return null
      this.nftPriceCache.set(nftAddress, {
        price: null as unknown as number, // Type assertion to satisfy the cache structure
        timestamp: Date.now()
      });
      return null;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${contextId}] Unexpected error in getNFTPrice for ${nftAddress}: ${errorMsg}`);
      // Don't cache errors
      return null;
    }
  }
  
  /**
   * Preload NFT metadata and prices in batch to reduce API calls
   */
  private async preloadNFTsBatch(nftAddresses: string[]): Promise<void> {
    this.cacheStats.batchLoads++;
    
    try {
      const uniqueNftAddresses = [...new Set(nftAddresses)];
      this.logger.info(`Batch preloading ${uniqueNftAddresses.length} NFTs`);
      
      if (uniqueNftAddresses.length === 0) {
        return;
      }
      
      // Preload NFT data using the pricing service's batch capability
      await this.nftPricingService.batchGetFloorPrices(uniqueNftAddresses);
      
      this.logger.info(`Completed batch preloading for ${uniqueNftAddresses.length} NFTs`);
    } catch (error) {
      this.logger.error('Error in batch NFT preloading', { error });
    }
  }
  
  /**
   * Helper method to time operations
   */
  private timeOperation<T>(name: string, operation: () => T): T {
    const start = performance.now();
    const result = operation();
    const end = performance.now();
    this.logger.info(`Performance: ${name} took ${(end - start).toFixed(2)}ms`);
    return result;
  }
  
  /**
   * Helper method to time async operations
   */
  private async timeOperationAsync<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await operation();
    const end = performance.now();
    this.logger.info(`Performance: ${name} took ${(end - start).toFixed(2)}ms`);
    return result;
  }

  /**
   * Gets the NFT associated with an edge between two wallets
   */
  private getNFTForEdge(from: string, to: string, graph: Map<string, Map<string, string>>): string {
    const edges = graph.get(from);
    if (!edges) return '';
    return edges.get(to) || '';
  }

  /**
   * Generates a canonical trade ID based on the trade participants and NFTs involved.
   * This ensures consistency across different runs and environments.
   */
  private generateCanonicalTradeId(participants: string[], nfts: string[]): string {
    // Sort participants and NFTs to ensure consistent order
    const sortedParticipants = [...participants].sort();
    const sortedNfts = [...nfts].sort();

    // Combine and hash to create a unique ID
    const combined = sortedParticipants.join(',') + '|' + sortedNfts.join(',');
    return `trade_${combined}`;
  }
}