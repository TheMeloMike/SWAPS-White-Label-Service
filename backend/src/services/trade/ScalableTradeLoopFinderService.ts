import { WalletState, DiscoveredTradeLoop, TradeLoop, RejectionPreferences } from '../../types/trade';
import { GraphPartitioningService } from './GraphPartitioningService';
import { TradeLoopFinderService } from './TradeLoopFinderService';
import { NFTPricingService } from '../nft/NFTPricingService';
import { NFTService } from '../nft/NFTService';
import { BloomFilter } from 'bloom-filters';
import { performance } from 'perf_hooks';
import { parallelize } from '../../lib/utils/parallelize';
import { LoggingService } from '../../utils/logging/LoggingService';
import * as os from 'os';
import { Mutex } from 'async-mutex';
import { ProbabilisticTradePathSampler } from './ProbabilisticTradePathSampler';
import { CollectionAbstractionService } from './CollectionAbstractionService';
import { CollectionIndexingService } from '../nft/CollectionIndexingService';
import { CollectionResolution } from '../../types/trade';
import { TradeScoreService } from './TradeScoreService';

/**
 * Scalable implementation of trade loop finder service using graph partitioning
 * 
 * This service is designed to scale to hundreds of thousands of wallets by:
 * 1. Partitioning the wallet graph into communities using the Louvain algorithm
 * 2. Processing communities in parallel to divide computational load
 * 3. Using Bloom filters for probabilistic deduplication of cycles
 * 4. Implementing incremental updates to avoid recomputing entire communities
 * 5. Caching results with time-based invalidation
 * 
 * Performance characteristics:
 * - Time complexity: O(N log N) where N is the number of wallets, compared to O(N²) for naive approach
 * - Space complexity: O(E) where E is the number of edges (trade preferences)
 * - Scales sublinearly with increasing number of wallets
 * - Parallelizable across communities with minimal shared state
 * 
 * @author SWAPS Team
 */
export class ScalableTradeLoopFinderService {
  private static instance: ScalableTradeLoopFinderService;
  
  // Graph partitioning
  private graphPartitioner: GraphPartitioningService;
  private communities: Map<string, string[]> = new Map();
  private walletToCommunity: Map<string, string> = new Map();
  private communityTradeCache: Map<string, TradeLoop[]> = new Map();
  private lastUpdateTime: Map<string, number> = new Map();
  
  // Cache and incremental updates
  private incrementalUpdateQueues: Map<string, {
    addedWallets: Set<string>;
    removedWallets: Set<string>;
    updatedWallets: Set<string>;
  }> = new Map();
  
  // Bloom filter for probabilistic filtering
  private seenCycles: BloomFilter = new BloomFilter(10, 100000); // Default initialization, will be replaced
  
  // User activity data for prioritization
  private walletActivityMap: Map<string, {
    lastActive?: Date;
    createdAt?: Date;
    tradeCount?: number;
  }> = new Map();
  
  // System monitoring for adaptive concurrency
  private lastResourceCheck: number = 0;
  private resourceCheckInterval: number = 5000; // 5 seconds
  private systemHealthMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    lastChecked: number;
  } = {
    cpuUsage: 0,
    memoryUsage: 0,
    lastChecked: 0
  };
  
  // Base timeout values
  private readonly BASE_TIMEOUT_MS: number;
  private readonly EXTENDED_TIMEOUT_MS: number;
  
  // Trade finders
  private tradeLoopFinder: TradeLoopFinderService;
  private nftPricingService: NFTPricingService;
  private nftService: NFTService;
  
  // Logger 
  private logger: any;
  
  // Parallelization settings (configurable via environment variables)
  private readonly PARALLEL_BATCH_SIZE: number;
  private readonly MAX_CONCURRENT_COMMUNITIES: number;
  private readonly COMMUNITY_CACHE_TTL_MS: number;
  private readonly MAX_TRADES_PER_COMMUNITY: number;
  private readonly MIN_COMMUNITY_SIZE_FOR_PARALLEL: number;
  private readonly MAX_CACHE_ENTRIES: number = 1000; // Maximum number of cached community results
  private readonly EXTENDED_CACHE_TTL_MS: number; // Extended TTL for infrequent users
  
  // Flags for tracking processing state
  private pendingWalletAdditions: Map<string, string[]> = new Map();
  private pendingWalletRemovals: Map<string, string[]> = new Map();
  private pendingWalletUpdates: Map<string, string[]> = new Map();
  private isGraphDirty: boolean = false;
  
  // Mutex locks to prevent race conditions
  private communitiesMutex = new Mutex();
  private walletCommunityMutex = new Mutex();
  private cacheMutex = new Mutex();
  private pendingWalletsMutex = new Mutex();
  private graphDirtyMutex = new Mutex();
  private incrementalUpdateQueuesMutex = new Mutex();
  
  // Probabilistic sampling for large communities
  private probabilisticSampler: ProbabilisticTradePathSampler | null = null;
  private readonly USE_PROBABILISTIC_SAMPLING: boolean;
  private readonly PROBABILISTIC_COMMUNITY_THRESHOLD: number;
  
  private collectionAbstractionService: CollectionAbstractionService;
  private collectionIndexingService: CollectionIndexingService;
  
  private tradeScoreService: TradeScoreService;
  
  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('ScalableTradeLoopFinder');
    
    // Initialize graph partitioner
    this.graphPartitioner = GraphPartitioningService.getInstance();
    
    // Initialize trade finder with default parameters
    const maxDepth = parseInt(process.env.TRADELOOP_MAX_DEPTH || '8', 10);
    const minEfficiency = parseFloat(process.env.TRADELOOP_MIN_EFFICIENCY || '0.6');
    this.tradeLoopFinder = new TradeLoopFinderService(maxDepth, minEfficiency);
    this.nftPricingService = NFTPricingService.getInstance();
    this.nftService = NFTService.getInstance();
    
    // Initialize Bloom filter for cycle deduplication with adaptive sizing
    const estimatedTradeVolume = parseInt(process.env.ESTIMATED_TRADE_VOLUME || '100000', 10);
    this.initializeBloomFilter(estimatedTradeVolume);
    
    // Initialize probabilistic sampling for large communities
    this.USE_PROBABILISTIC_SAMPLING = process.env.USE_PROBABILISTIC_SAMPLING === 'true';
    this.PROBABILISTIC_COMMUNITY_THRESHOLD = parseInt(
      process.env.PROBABILISTIC_COMMUNITY_THRESHOLD || '50', 10
    );
    
    if (this.USE_PROBABILISTIC_SAMPLING) {
      this.probabilisticSampler = new ProbabilisticTradePathSampler();
      this.logger.info('Probabilistic sampling enabled for large communities', {
        threshold: this.PROBABILISTIC_COMMUNITY_THRESHOLD
      });
    }
    
    // Load parallelization settings from environment with defaults
    this.PARALLEL_BATCH_SIZE = parseInt(process.env.PARALLEL_BATCH_SIZE || '5', 10);
    this.MAX_CONCURRENT_COMMUNITIES = parseInt(process.env.MAX_CONCURRENT_COMMUNITIES || '3', 10);
    this.COMMUNITY_CACHE_TTL_MS = parseInt(process.env.COMMUNITY_CACHE_TTL_MS || '300000', 10); // 5 minutes by default
    this.MAX_TRADES_PER_COMMUNITY = parseInt(process.env.MAX_TRADES_PER_COMMUNITY || '50', 10);
    this.MIN_COMMUNITY_SIZE_FOR_PARALLEL = parseInt(process.env.MIN_COMMUNITY_SIZE_FOR_PARALLEL || '10', 10);
    this.BASE_TIMEOUT_MS = parseInt(process.env.BASE_TIMEOUT_MS || '5000', 10);
    this.EXTENDED_TIMEOUT_MS = parseInt(process.env.EXTENDED_TIMEOUT_MS || '15000', 10);
    this.EXTENDED_CACHE_TTL_MS = parseInt(process.env.EXTENDED_CACHE_TTL_MS || '1800000', 10); // 30 minutes by default
    
    this.tradeScoreService = new TradeScoreService();
    this.collectionAbstractionService = CollectionAbstractionService.getInstance();
    this.collectionIndexingService = CollectionIndexingService.getInstance();
    
    // Initialize the update queues
    this.resetQueues();
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): ScalableTradeLoopFinderService {
    if (!ScalableTradeLoopFinderService.instance) {
      ScalableTradeLoopFinderService.instance = new ScalableTradeLoopFinderService();
    }
    return ScalableTradeLoopFinderService.instance;
  }
  
  /**
   * Count the number of unique NFT collections in a set of wallets
   * This helps measure the diversity of a community
   */
  private countUniqueCollections(walletAddresses: string[], allWallets: Map<string, WalletState>): number {
    const collections = new Set<string>();
    
    for (const walletAddress of walletAddresses) {
      const wallet = allWallets.get(walletAddress);
      if (!wallet) continue;
      
      // Check owned NFTs for collections
      for (const nftAddress of wallet.ownedNfts) {
        // Extract collection identifier (usually first part of address or metadata)
        const collectionId = this.extractCollectionId(nftAddress);
        if (collectionId) {
          collections.add(collectionId);
        }
      }
      
      // Also check wanted NFTs
      for (const nftAddress of wallet.wantedNfts) {
        const collectionId = this.extractCollectionId(nftAddress);
        if (collectionId) {
          collections.add(collectionId);
        }
      }
    }
    
    return collections.size;
  }
  
  /**
   * Extract a collection ID from an NFT address
   * This is a simple implementation - in practice would use NFT metadata
   */
  private extractCollectionId(nftAddress: string): string {
    // Basic implementation: use first part of address as collection ID
    // In a real implementation, we would use metadata or a lookup service
    const parts = nftAddress.split(':');
    return parts.length > 1 ? parts[0] : nftAddress.substring(0, 8);
  }

  /**
   * Check if a wallet belongs to an infrequent user
   */
  private isInfrequentUser(walletAddress: string): boolean {
    const wallet = this.walletActivityMap.get(walletAddress);
    if (!wallet?.lastActive) return true; // No activity data means assumed infrequent
    
    const now = new Date();
    const daysSinceActive = (now.getTime() - wallet.lastActive.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceActive > 7; // More than a week since last activity
  }
  
  /**
   * Check if a wallet belongs to a new user
   */
  private isNewUser(walletAddress: string): boolean {
    const wallet = this.walletActivityMap.get(walletAddress);
    if (!wallet?.createdAt) return false; // No creation date means not a new user
    
    const now = new Date();
    const daysSinceCreation = (now.getTime() - wallet.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCreation < 14; // Less than two weeks since account creation
  }
  
  /**
   * Monitor system resources to adapt concurrency
   * @returns System health indicators for adaptive concurrency
   */
  private monitorSystemResources(): { cpuUsage: number, memoryUsage: number } {
    const now = Date.now();
    
    // Only check resources periodically to avoid performance impact
    if (now - this.lastResourceCheck < this.resourceCheckInterval) {
      return this.systemHealthMetrics;
    }
    
    // Update the last check time
    this.lastResourceCheck = now;
    
    // Get CPU usage (simplified - in production you'd want a rolling average)
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }
    
    // Calculate CPU usage percentage (higher is more used)
    const cpuUsage = 1 - (totalIdle / totalTick);
    
    // Get memory usage
    const memInfo = process.memoryUsage();
    const memoryUsage = memInfo.heapUsed / memInfo.heapTotal;
    
    // Update the metrics
    this.systemHealthMetrics = {
      cpuUsage,
      memoryUsage,
      lastChecked: now
    };
    
    this.logger.debug('System resource monitoring', {
      cpuUsagePercent: Math.round(cpuUsage * 100),
      memoryUsagePercent: Math.round(memoryUsage * 100),
      freeMemoryMB: Math.round((memInfo.heapTotal - memInfo.heapUsed) / (1024 * 1024))
    });
    
    return this.systemHealthMetrics;
  }
  
  /**
   * Calculate the optimal concurrency level based on system resources
   */
  private calculateOptimalConcurrency(systemHealth: { cpuUsage: number, memoryUsage: number }): number {
    const cpuCount = os.cpus().length;
    
    // Start with CPU count as the base
    let concurrency = cpuCount;
    
    // Reduce concurrency when CPU is heavily used
    if (systemHealth.cpuUsage > 0.8) {
      concurrency = Math.max(1, Math.floor(concurrency * 0.5));
    } else if (systemHealth.cpuUsage > 0.6) {
      concurrency = Math.max(1, Math.floor(concurrency * 0.7));
    }
    
    // Reduce concurrency when memory is heavily used
    if (systemHealth.memoryUsage > 0.8) {
      concurrency = Math.max(1, Math.floor(concurrency * 0.6));
    } else if (systemHealth.memoryUsage > 0.6) {
      concurrency = Math.max(1, Math.floor(concurrency * 0.8));
    }
    
    // Never exceed the configured maximum
    concurrency = Math.min(concurrency, this.MAX_CONCURRENT_COMMUNITIES);
    
    // Always allow at least one concurrent operation
    return Math.max(1, concurrency);
  }
  
  /**
   * Calculate appropriate timeout for a community based on its characteristics
   */
  private calculateCommunityTimeout(community: string[], baseMs: number): number {
    // More time for larger communities, regardless of value
    const sizeMultiplier = Math.min(3, 1 + (community.length / 100));
    
    // More time for communities with new/infrequent users
    const hasNewUsers = community.some(wallet => 
      this.isInfrequentUser(wallet) || this.isNewUser(wallet)
    );
    const userTypeMultiplier = hasNewUsers ? 1.5 : 1.0;
    
    return Math.floor(baseMs * sizeMultiplier * userTypeMultiplier);
  }
  
  /**
   * Prioritize communities based on multiple balanced factors
   * This ensures fair treatment across different user types and maximizes chances of finding good trades
   * 
   * @param communities Map of community IDs to arrays of wallet addresses
   * @param allWallets Complete map of all wallet states
   * @returns Array of prioritized communities with their metadata
   */
  private prioritizeCommunities(
    communities: Map<number, string[]>,
    allWallets: Map<string, WalletState>
  ): Array<{ id: string, wallets: string[], balanceScore: number }> {
    // Early exit for empty communities
    if (communities.size === 0) return [];
    
    // Prepare storage for metrics to avoid recalculation
    const communityMetrics = new Map<string, {
      size: number;
      uniqueCollections: number;
      newUserCount: number;
      infrequentUserCount: number;
      connectedness: number;
    }>();
    
    // Precalculate metrics for all communities in a single pass
    for (const [id, communityWallets] of communities.entries()) {
      // Skip empty communities
      if (communityWallets.length === 0) continue;
      
      const communityId = String(id);
      const size = communityWallets.length;
      const uniqueCollections = this.countUniqueCollections(communityWallets, allWallets);
      
      // Count user types
      let newUserCount = 0;
      let infrequentUserCount = 0;
      
      // Calculate connectedness (ratio of existing connections to possible connections)
      let connections = 0;
      const maxConnections = size * (size - 1) / 2; // Maximum possible connections in a community
      
      // Process all wallets in the community
      for (const wallet of communityWallets) {
        // Track user types
        if (this.isNewUser(wallet)) newUserCount++;
        if (this.isInfrequentUser(wallet)) infrequentUserCount++;
        
        // Count outgoing connections (wants) within the community
        const walletState = allWallets.get(wallet);
        if (walletState) {
          for (const nftWant of walletState.wantedNfts) {
            // Check if any wallet in this community owns this NFT
            for (const otherWallet of communityWallets) {
              if (otherWallet === wallet) continue; // Skip self
              
              const otherState = allWallets.get(otherWallet);
              if (otherState && otherState.ownedNfts.has(nftWant)) {
                connections++;
                break; // Each want counts only once
              }
            }
          }
        }
      }
      
      // Calculate connectedness ratio (clamped to avoid division by zero)
      const connectedness = maxConnections > 0 
        ? connections / maxConnections 
        : 0;
      
      // Store metrics for this community
      communityMetrics.set(communityId, {
        size,
        uniqueCollections,
        newUserCount,
        infrequentUserCount,
        connectedness
      });
    }
    
    // Now convert to array and calculate scores
    return Array.from(communities.entries())
      .map(([id, communityWallets]) => {
        const communityId = String(id);
        const metrics = communityMetrics.get(communityId);
        
        // Skip communities with no metrics (shouldn't happen)
        if (!metrics) {
          return { 
            id: communityId, 
            wallets: communityWallets, 
            balanceScore: 0 
          };
        }
        
        // Calculate component scores
        
        // 1. Collection diversity (more diverse collections get higher priority)
        const diversityScore = metrics.uniqueCollections / Math.max(1, metrics.size);
        
        // 2. Size factor (moderate sized communities get priority - not too small, not too big)
        // This curve favors communities of size ~20-50 wallets which tend to have optimal trade possibilities
        const sizeOptimality = Math.exp(-(Math.log(metrics.size / 30) ** 2));
        
        // 3. User composition (communities with new/infrequent users get slightly higher priority)
        const newUserRatio = metrics.newUserCount / Math.max(1, metrics.size);
        const infrequentUserRatio = metrics.infrequentUserCount / Math.max(1, metrics.size);
        const userCompositionScore = (newUserRatio * 0.6) + (infrequentUserRatio * 0.4);
        
        // 4. Connectedness - how densely connected the community is
        const connectednessScore = metrics.connectedness;
        
        // Combined balance score with weighted components
        const balanceScore = 
          (diversityScore * 0.25) +       // 25% weight for diversity
          (sizeOptimality * 0.25) +       // 25% weight for optimal size
          (userCompositionScore * 0.2) +  // 20% weight for user types
          (connectednessScore * 0.3);     // 30% weight for connectedness
          
        return { 
          id: communityId, 
          wallets: communityWallets, 
          balanceScore 
        };
      })
      .filter(item => item.balanceScore > 0) // Remove zero-scored communities
      .sort((a, b) => b.balanceScore - a.balanceScore); // Higher score gets processed first
  }
  
  /**
   * Initialize or resize Bloom filter based on current workload
   * 
   * This dynamically adjusts the Bloom filter size and precision based on 
   * the current system state to optimize memory usage and false positive rates.
   * 
   * @param expectedItems Estimated number of unique trade cycles to store
   */
  private initializeBloomFilter(expectedItems?: number): void {
    // Default to 100,000 items if not specified
    const itemCount = expectedItems || 100000;
    
    // Calculate optimal filter size for the expected number of items
    // with a target false positive rate of 0.1% (0.001)
    
    // Using the formula: m = -n*ln(p)/(ln(2))² where:
    // m = optimal size in bits
    // n = expected number of items
    // p = desired false positive probability
    const optimalBits = Math.ceil(-itemCount * Math.log(0.001) / (Math.log(2) ** 2));
    
    // Calculate optimal number of hash functions using formula: k = (m/n)*ln(2)
    const optimalHashFunctions = Math.max(1, Math.min(20, Math.round((optimalBits / itemCount) * Math.log(2))));
    
    // Create new Bloom filter with calculated parameters
    this.seenCycles = new BloomFilter(optimalHashFunctions, Math.ceil(optimalBits / 8));
    
    this.logger.info('Initialized adaptive Bloom filter', {
      expectedItems: itemCount,
      bitsPerItem: Math.round(optimalBits / itemCount),
      hashFunctions: optimalHashFunctions,
      falsePositiveRate: '0.1%',
      memorySizeBytes: Math.ceil(optimalBits / 8)
    });
  }
  
  /**
   * Calculate optimal concurrency settings based on community characteristics and system load
   * 
   * This method dynamically adjusts parallelism levels based on the specific community's
   * characteristics and current system resource utilization, rather than using
   * a global concurrency setting.
   * 
   * @param communitySize Size of the community being processed
   * @param systemHealth Current CPU and memory utilization metrics
   * @returns Optimal concurrency level and batch size
   */
  private calculateOptimalCommunityParallelism(
    communitySize: number,
    systemHealth: { cpuUsage: number, memoryUsage: number }
  ): { concurrency: number, batchSize: number } {
    // Base concurrency on available CPU cores
    const cpuCount = os.cpus().length;
    
    // Start with default values
    let concurrency = cpuCount > 4 ? Math.floor(cpuCount * 0.75) : cpuCount;
    let batchSize = this.PARALLEL_BATCH_SIZE;
    
    // For very small communities, reduce concurrency to avoid overhead
    if (communitySize < 20) {
      concurrency = Math.min(concurrency, 2);
      batchSize = Math.min(batchSize, communitySize);
    } 
    // For medium communities, scale proportionally
    else if (communitySize < 100) {
      concurrency = Math.min(concurrency, 4);
      batchSize = Math.min(batchSize, Math.ceil(communitySize / 4));
    } 
    // For large communities, maximize parallelism with constraints
    else {
      batchSize = Math.min(batchSize, Math.ceil(communitySize / cpuCount));
    }
    
    // Adjust for CPU load
    if (systemHealth.cpuUsage > 0.8) {
      concurrency = Math.max(1, Math.floor(concurrency * 0.5));
    } else if (systemHealth.cpuUsage > 0.6) {
      concurrency = Math.max(1, Math.floor(concurrency * 0.7));
    }
    
    // Adjust for memory pressure
    if (systemHealth.memoryUsage > 0.8) {
      batchSize = Math.max(5, Math.floor(batchSize * 0.6));
      concurrency = Math.max(1, Math.floor(concurrency * 0.7));
    } else if (systemHealth.memoryUsage > 0.6) {
      batchSize = Math.max(5, Math.floor(batchSize * 0.8));
    }
    
    // Apply hard limits
    concurrency = Math.min(concurrency, this.MAX_CONCURRENT_COMMUNITIES);
    concurrency = Math.max(1, concurrency);
    batchSize = Math.max(1, batchSize);
    
    return { concurrency, batchSize };
  }

  /**
   * Process each community in this batch with adaptive concurrency
   */
  private async processBatchWithAdaptiveConcurrency(
    batch: Array<{ id: string, wallets: string[], balanceScore: number }>,
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences: Map<string, RejectionPreferences>
  ): Promise<TradeLoop[][]> {
    const operation = this.logger.operation('processBatchWithAdaptiveConcurrency');
    
    // Monitor system resources
    const systemHealth = this.monitorSystemResources();
    
    // Calculate optimal parallelism settings based on largest community in batch
    const largestCommunitySize = Math.max(...batch.map(c => c.wallets.length));
    const { concurrency, batchSize } = this.calculateOptimalCommunityParallelism(
      largestCommunitySize,
      systemHealth
    );
    
    operation.info(`Processing batch with adaptive concurrency`, {
      batchSize: batch.length,
      largestCommunitySize,
      concurrency,
      processingBatchSize: batchSize,
      cpuUsagePercent: Math.round(systemHealth.cpuUsage * 100),
      memoryUsagePercent: Math.round(systemHealth.memoryUsage * 100)
    });
    
    // Create the processing promises
    const batchPromises = batch.map(community => {
      return this.processCommunityCycles(
        String(community.id),
        community.wallets,
        wallets,
        nftOwnership,
        wantedNfts,
        rejectionPreferences
      );
    });
    
    // Process with calculated concurrency
    const results = await parallelize(() => batchPromises, { 
      maxConcurrency: concurrency
    });
    
    operation.end();
    return results;
  }

  /**
   * Find all trade loops in the system
   * Enhanced to support collection-level wants
   */
  public async findAllTradeLoops(
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences: Map<string, RejectionPreferences>
  ): Promise<TradeLoop[]> {
    const operation = this.logger.operation('findAllTradeLoops');
    const startTime = performance.now();
    
    operation.info('Starting scalable trade loop discovery', {
      wallets: wallets.size,
      nfts: nftOwnership.size,
      wants: wantedNfts.size
    });
    
    // Step 1: Expand collection-level wants to specific NFT wants
    let expandedWantedNfts = wantedNfts;
    const collectionWants = this.buildCollectionWantsMap(wallets);
    
    if (collectionWants.size > 0) {
      operation.info('Expanding collection wants', { 
        walletsWithCollectionWants: collectionWants.size 
      });
      
      try {
        expandedWantedNfts = await this.collectionAbstractionService.expandCollectionWants(
          wallets,
          nftOwnership,
          collectionWants
        );
        
        operation.info('Collection wants expanded', {
          originalWants: wantedNfts.size,
          expandedWants: expandedWantedNfts.size,
          newEdges: expandedWantedNfts.size - wantedNfts.size
        });
      } catch (error) {
        operation.warn('Error expanding collection wants, using original wants', {
          error: error instanceof Error ? error.message : String(error)
        });
        expandedWantedNfts = wantedNfts;
      }
    }
    
    // Step 2: Continue with standard trade loop finding using expanded wants
    const allTradeLoops = await this.findTradeLoopsWithExpandedWants(
      wallets,
      nftOwnership,
      expandedWantedNfts,
      rejectionPreferences
    );
    
    // Step 3: Resolve any collection preferences in the discovered loops
    const enhancedLoops = await this.enhanceLoopsWithCollectionResolutions(
      allTradeLoops,
      collectionWants
    );
    
    const endTime = performance.now();
    operation.info('Scalable trade loop discovery completed', {
      loopsFound: enhancedLoops.length,
      durationMs: (endTime - startTime).toFixed(2),
      withCollectionResolutions: enhancedLoops.filter((loop: TradeLoop) => 
        (loop as any).collectionResolutions?.size > 0
      ).length
    });
    
    operation.end();
    return enhancedLoops;
  }

  /**
   * Build collection wants map from wallet states
   */
  private buildCollectionWantsMap(wallets: Map<string, WalletState>): Map<string, Set<string>> {
    const collectionWants = new Map<string, Set<string>>();
    
    for (const [walletAddress, walletState] of wallets) {
      if (walletState.wantedCollections && walletState.wantedCollections.size > 0) {
        collectionWants.set(walletAddress, new Set(walletState.wantedCollections));
      }
    }
    
    return collectionWants;
  }

  /**
   * Enhance discovered trade loops with collection resolution metadata
   */
  private async enhanceLoopsWithCollectionResolutions(
    tradeLoops: TradeLoop[],
    collectionWants: Map<string, Set<string>>
  ): Promise<TradeLoop[]> {
    if (collectionWants.size === 0) {
      return tradeLoops; // No collection wants to resolve
    }

    const operation = this.logger.operation('enhanceLoopsWithCollectionResolutions');
    operation.info('Enhancing trade loops with collection resolutions', {
      totalLoops: tradeLoops.length,
      walletsWithCollectionWants: collectionWants.size
    });

    const enhancedLoops: TradeLoop[] = [];

    for (const loop of tradeLoops) {
      try {
        const collectionResolutions = new Map<string, CollectionResolution>();
        let hasCollectionTrades = false;
        
        // Check each step for collection-level preferences
        for (const step of loop.steps) {
          const receivingWallet = step.to;
          const walletCollectionWants = collectionWants.get(receivingWallet);
          
          if (walletCollectionWants && walletCollectionWants.size > 0) {
            // Check if any NFTs in this step satisfy collection wants
            for (const nft of step.nfts) {
              const nftCollectionId = await this.collectionIndexingService.getCollectionForNFT(nft.address);
              
              if (nftCollectionId && walletCollectionWants.has(nftCollectionId)) {
                // This NFT satisfies a collection want
                const resolution: CollectionResolution = {
                  collectionId: nftCollectionId,
                  collectionName: nftCollectionId, // TODO: Get actual collection name
                  resolvedNFT: nft.address,
                  alternativeNFTs: [], // TODO: Find alternatives
                  resolutionReason: 'liquidity',
                  confidence: 0.8
                };
                
                collectionResolutions.set(nft.address, resolution);
                hasCollectionTrades = true;
              }
            }
          }
        }

        // Create enhanced loop with collection metadata
        const enhancedLoop = {
          ...loop,
          collectionResolutions,
          hasCollectionTrades,
          collectionCount: collectionResolutions.size,
          crossCollectionTrade: collectionResolutions.size > 1
        } as any; // Use any for now since we're extending TradeLoop

        enhancedLoops.push(enhancedLoop);
      } catch (error) {
        operation.warn('Error enhancing loop with collection resolutions', {
          loopId: loop.id,
          error: error instanceof Error ? error.message : String(error)
        });
        // Add the original loop if enhancement fails
        enhancedLoops.push(loop);
      }
    }

    operation.info('Trade loop enhancement completed', {
      originalLoops: tradeLoops.length,
      enhancedLoops: enhancedLoops.length,
      loopsWithCollections: enhancedLoops.filter(loop => (loop as any).hasCollectionTrades).length
    });
    operation.end();

    return enhancedLoops;
  }

  /**
   * Find trade loops using expanded wants (original algorithm logic)
   */
  private async findTradeLoopsWithExpandedWants(
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences: Map<string, RejectionPreferences>
  ): Promise<TradeLoop[]> {
    // This contains the original algorithm logic with renamed variables to avoid conflicts
    const discoveredTradeLoops: TradeLoop[] = [];
    const operation = this.logger.operation('findTradeLoopsWithExpandedWants');
    const algorithmStartTime = performance.now();
    
    // Automatically resize the Bloom filter based on system scale if needed
    const walletCount = wallets.size;
    const currentFilterCapacity = this.estimateBloomFilterCapacity();
    
    // If wallet count is large, we should resize the filter to handle more potential trades
    if (walletCount > 1000 && currentFilterCapacity < walletCount * 5) {
      // Estimate that we'll see approximately 5 unique trades per wallet
      const estimatedTrades = walletCount * 5;
      operation.info('Resizing Bloom filter for larger workload', {
        walletCount,
        currentCapacity: currentFilterCapacity,
        newCapacity: estimatedTrades
      });
      this.initializeBloomFilter(estimatedTrades);
    }
    
    operation.info('Starting scalable trade loop discovery', {
      wallets: wallets.size,
      nfts: nftOwnership.size,
      wants: wantedNfts.size
    });
    
    // Step 1: Find direct trades (two-party exchanges) - these are fast to compute
    const directTrades = await this.tradeLoopFinder.findDirectMatches(wallets, nftOwnership, wantedNfts, rejectionPreferences);
    operation.info(`Found direct trades`, { count: directTrades.length });
    
    // Step 2: Partition the graph into communities for scalable processing
    const communities = this.graphPartitioner.partitionGraph(wallets, nftOwnership, wantedNfts);
    operation.info(`Graph partitioning completed`, { communities: communities.size });
    
    if (communities.size === 0) {
      operation.info('No communities found, returning only direct trades');
      operation.end();
      return directTrades; // No communities found, return only direct trades
    }
    
    // Step 3: Process each community in parallel to find trade loops
    // Use a balanced prioritization strategy that's fair to all user types
    const prioritizedCommunities = this.prioritizeCommunities(communities, wallets);
    
    operation.info(`Communities prioritized using balanced algorithm`, { 
      totalCommunities: communities.size 
    });
    
    // Track all discovered trade loops
    let allMultiPartyTrades: TradeLoop[] = [];
    const processedCommunities = new Set<string>();
    
    // Track user categories to ensure fair processing
    const categorizedWallets = {
      new: new Set<string>(),      // New or less active users
      standard: new Set<string>(), // Regular users
      power: new Set<string>()     // Power users with many NFTs/preferences
    };
    
    // Categorize wallets by activity and size (not value)
    for (const [walletAddress, state] of wallets.entries()) {
      if (this.isNewUser(walletAddress) || this.isInfrequentUser(walletAddress)) {
        categorizedWallets.new.add(walletAddress);
      } else if (state.ownedNfts.size + state.wantedNfts.size > 10) {
        categorizedWallets.power.add(walletAddress);
      } else {
        categorizedWallets.standard.add(walletAddress);
      }
    }
    
    operation.info(`Wallets categorized for fair processing`, {
      newUsers: categorizedWallets.new.size,
      standardUsers: categorizedWallets.standard.size,
      powerUsers: categorizedWallets.power.size
    });
    
    // Create a tracker for the current time budget
    const startTimeMs = performance.now();
    const globalTimeoutMs = parseInt(process.env.TRADELOOP_GLOBAL_TIMEOUT_MS || '10000', 10);
    
    // Process communities in batches to control concurrency
    for (let i = 0; i < prioritizedCommunities.length; i += this.PARALLEL_BATCH_SIZE) {
      // Check if we've exceeded the global time budget
      if (performance.now() - startTimeMs > globalTimeoutMs) {
        operation.info(`Global time budget exceeded, stopping community processing`, { 
          timeoutMs: globalTimeoutMs,
          elapsedMs: Math.round(performance.now() - startTimeMs)
        });
        break;
      }
      
      // Get the next batch of communities
      const batch = prioritizedCommunities.slice(i, i + this.PARALLEL_BATCH_SIZE);
      
      // Make sure each category of users is represented in the batch if possible
      const batchContainsNewUsers = batch.some(community => 
        community.wallets.some(wallet => categorizedWallets.new.has(wallet))
      );
      const batchContainsStandardUsers = batch.some(community => 
        community.wallets.some(wallet => categorizedWallets.standard.has(wallet))
      );
      
      // Use adaptive concurrency for better resource utilization
      const batchResults = await this.processBatchWithAdaptiveConcurrency(
        batch,
        wallets,
        nftOwnership,
        wantedNfts,
        rejectionPreferences
      );
      
      // Merge results from all communities in this batch
      for (let j = 0; j < batch.length; j++) {
        const community = batch[j];
        const communityTrades = await batchResults[j];
        
        // Filter duplicates before caching
        const uniqueTrades = this.filterDuplicateCycles(communityTrades);
        
        // Cache the results for this community
        this.communityTradeCache.set(String(community.id), uniqueTrades);
        
        // Add to overall results - CRITICAL: This is where trades are accumulated
        if (uniqueTrades.length > 0) {
          operation.info(`Adding trade loops from community to results`, {
            communityId: community.id,
            tradeCount: uniqueTrades.length
          });
          allMultiPartyTrades = [...allMultiPartyTrades, ...uniqueTrades];
        }
        
        // Mark as processed
        processedCommunities.add(String(community.id));
      }
      
      operation.info(`Batch processing progress`, {
        processedCount: processedCommunities.size,
        totalCommunities: communities.size,
        tradesFound: allMultiPartyTrades.length
      });
      
      // If we have enough trades, stop early but ensure we've processed at least some
      // communities from each user category if possible
      if (allMultiPartyTrades.length > 1000 && processedCommunities.size > Math.min(10, communities.size)) {
        // Check if we've processed communities with all user types
        const processedNewUserCommunity = Array.from(processedCommunities).some(id => {
          const community = communities.get(Number(id));
          return community && community.some(wallet => categorizedWallets.new.has(wallet));
        });
        
        const processedStandardUserCommunity = Array.from(processedCommunities).some(id => {
          const community = communities.get(Number(id));
          return community && community.some(wallet => categorizedWallets.standard.has(wallet));
        });
        
        // Only stop if we've processed at least one community from each user category
        // or if we've processed a significant portion of all communities
        if ((processedNewUserCommunity && processedStandardUserCommunity) || 
            processedCommunities.size > communities.size * 0.3) {
          operation.info('Found sufficient trade loops with fair representation, stopping early', {
            tradesFound: allMultiPartyTrades.length,
            processedNewUserCommunity,
            processedStandardUserCommunity,
            processedRatio: processedCommunities.size / communities.size
          });
          break;
        }
      }
    }
    
    // Combine direct trades with multi-party trades
    const allTradeLoops = [...directTrades, ...allMultiPartyTrades];
    
    // Log results and timing
    const endTime = performance.now();
    operation.info(`Scalable trade loop discovery completed`, {
      durationMs: Math.round(endTime - algorithmStartTime),
      processedCommunities: processedCommunities.size,
      totalCommunities: communities.size,
      directTrades: directTrades.length,
      multiPartyTrades: allMultiPartyTrades.length,
      totalTrades: allTradeLoops.length
    });
    
    operation.end();
    
    // Score and sort trade loops
    return this.scoreAndSortTradeLoops(allTradeLoops);
  }
  
  /**
   * Manage the trade cache with fairness to ensure all users get good performance
   * This includes extending cache lifetimes for infrequent users and fair eviction
   */
  private manageCacheWithFairness(): void {
    const now = Date.now();
    
    // Check if we need to evict entries due to capacity constraints
    if (this.communityTradeCache.size > this.MAX_CACHE_ENTRIES) {
      this.logger.info('Cache capacity exceeded, evicting oldest entries', {
        cacheSize: this.communityTradeCache.size,
        maxEntries: this.MAX_CACHE_ENTRIES
      });
      
      // Sort cache entries by age (oldest first)
      const entries = Array.from(this.lastUpdateTime.entries())
        .sort((a, b) => a[1] - b[1]);
        
      // Remove oldest entries to make room, but only up to 20% at a time
      const entriesToRemove = entries.slice(0, Math.floor(this.MAX_CACHE_ENTRIES * 0.2));
      for (const [communityId] of entriesToRemove) {
        this.communityTradeCache.delete(communityId);
        this.lastUpdateTime.delete(communityId);
        this.logger.debug('Evicted cache entry', { communityId });
      }
    }
    
    // Special handling for communities with infrequent users
    for (const [communityId, wallets] of this.communities.entries()) {
      // Skip communities that aren't cached
      if (!this.communityTradeCache.has(communityId)) continue;
      
      const lastUpdate = this.lastUpdateTime.get(communityId) || 0;
      // Skip if cache entry is too old
      if (now - lastUpdate > this.EXTENDED_CACHE_TTL_MS) continue;
      
      // Check if this community has any infrequent users
      const hasInfrequentUsers = wallets.some(wallet => this.isInfrequentUser(wallet));
      const hasNewUsers = wallets.some(wallet => this.isNewUser(wallet));
      
      if (hasInfrequentUsers || hasNewUsers) {
        // If regular TTL has expired but extended TTL hasn't
        if (now - lastUpdate > this.COMMUNITY_CACHE_TTL_MS && 
            now - lastUpdate < this.EXTENDED_CACHE_TTL_MS) {
          this.logger.debug('Extending cache lifetime for community with infrequent users', { 
            communityId,
            hasInfrequentUsers,
            hasNewUsers 
          });
        }
        
        // We don't need to reset the timestamp - we just use the extended TTL
        // when checking for cache validity in processCommunityCycles
      }
    }
  }
  
  /**
   * Create a memory-efficient subset of wallets for community processing
   * This avoids unnecessary object creation for large communities
   * 
   * @param communityWallets Array of wallet addresses in this community
   * @param allWallets Complete map of all wallet states
   * @param updateQueue Optional update queue for this community
   * @returns An efficient subset map containing only relevant wallets
   */
  private createCommunityWalletSubset(
    communityWallets: string[],
    allWallets: Map<string, WalletState>,
    updateQueue?: {
      addedWallets: Set<string>;
      removedWallets: Set<string>;
      updatedWallets: Set<string>;
    }
  ): Map<string, WalletState> {
    // For small communities, just create a new map directly
    if (communityWallets.length < 50 && (!updateQueue || 
       (updateQueue.addedWallets.size === 0 && updateQueue.removedWallets.size === 0))) {
      const subset = new Map<string, WalletState>();
      for (const walletAddress of communityWallets) {
        const wallet = allWallets.get(walletAddress);
        if (wallet) subset.set(walletAddress, wallet);
      }
      return subset;
    }
    
    // For larger communities or those with updates, use a more efficient approach
    // Pre-allocate a Set for O(1) lookups of removals
    const removedWallets = new Set<string>();
    if (updateQueue) {
      for (const walletAddress of updateQueue.removedWallets) {
        removedWallets.add(walletAddress);
      }
    }
    
    // Calculate the expected capacity to avoid resizing
    const expectedSize = communityWallets.length + 
      (updateQueue ? updateQueue.addedWallets.size - removedWallets.size : 0);
    
    // Create the subset with calculated capacity
    const subset = new Map<string, WalletState>();
    
    // First add all wallets from the community that haven't been removed
    for (const walletAddress of communityWallets) {
      if (removedWallets.has(walletAddress)) continue;
      
      const wallet = allWallets.get(walletAddress);
      if (wallet) subset.set(walletAddress, wallet);
    }
    
    // Then add any wallets that were newly added to this community
    if (updateQueue && updateQueue.addedWallets.size > 0) {
      for (const walletAddress of updateQueue.addedWallets) {
        const wallet = allWallets.get(walletAddress);
        if (wallet) subset.set(walletAddress, wallet);
      }
    }
    
    return subset;
  }
  
  /**
   * Process a specific community to find trade cycles within that community
   * This method now uses probabilistic sampling for large communities when enabled
   */
  private async processCommunityCycles(
    communityId: string,
    walletAddresses: string[],
    allWallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences: Map<string, RejectionPreferences>
  ): Promise<TradeLoop[]> {
    const operation = this.logger.operation('processCommunityCycles');
    const startTime = performance.now();
    
    operation.info(`Processing community`, {
      communityId,
      walletCount: walletAddresses.length
    });
    
    // Check cache conditions first - keep this part unchanged
    const cachedTrades = this.communityTradeCache.get(communityId);
    const lastUpdate = this.lastUpdateTime.get(communityId) || 0;
    const updateQueue = this.incrementalUpdateQueues.get(communityId);
    
    // Check for infrequent users to determine which TTL to use
    const hasInfrequentUsers = walletAddresses.some(wallet => this.isInfrequentUser(wallet));
    const hasNewUsers = walletAddresses.some(wallet => this.isNewUser(wallet));
    
    // Use extended TTL for communities with infrequent or new users
    const effectiveTTL = (hasInfrequentUsers || hasNewUsers) ? 
                        this.EXTENDED_CACHE_TTL_MS : 
                        this.COMMUNITY_CACHE_TTL_MS;
    
    // First check if we can use the cache
    const useCache = cachedTrades && 
                    lastUpdate > 0 && 
                    (startTime - lastUpdate) < effectiveTTL && 
                    updateQueue &&
                    updateQueue.addedWallets.size === 0 && 
                    updateQueue.removedWallets.size === 0 && 
                    updateQueue.updatedWallets.size === 0;
    
    if (useCache) {
      operation.info(`Using cached trade loops for community`, {
        communityId,
        tradeCount: cachedTrades.length,
        cacheAgeMs: Math.round(startTime - lastUpdate),
        hasInfrequentUsers,
        hasNewUsers,
        effectiveTTL
      });
      operation.end();
      return cachedTrades;
    }
    
    // Decide whether to use probabilistic sampling based on community size
    // Add proper null check for the probabilistic sampler
    const useProbabilisticSampling = 
      this.USE_PROBABILISTIC_SAMPLING && 
      this.probabilisticSampler !== null && 
      walletAddresses.length >= this.PROBABILISTIC_COMMUNITY_THRESHOLD;
      
    // Create community wallet subset for efficiency
    const communityWallets = this.createCommunityWalletSubset(
      walletAddresses,
      allWallets,
      updateQueue
    );
    
    // Try probabilistic sampling for large communities
    if (useProbabilisticSampling && this.probabilisticSampler) {
      operation.info(`Using probabilistic sampling for large community`, {
        communityId,
        walletCount: walletAddresses.length,
        threshold: this.PROBABILISTIC_COMMUNITY_THRESHOLD
      });
      
      try {
        // Use the probabilistic sampler to find trade loops
        const tradeLoops = await this.probabilisticSampler.findTradeLoops(
          communityWallets,
          nftOwnership,
          wantedNfts,
          rejectionPreferences
        );
        
        // Limit number of trades per community
        const limitedTradeLoops = tradeLoops.slice(0, this.MAX_TRADES_PER_COMMUNITY);
        
        // Update caching and tracking as in the original method
        if (updateQueue) {
          updateQueue.addedWallets.clear();
          updateQueue.removedWallets.clear();
          updateQueue.updatedWallets.clear();
        }
        
        // Cache the results with automatic eviction
        await this.cacheMutex.runExclusive(async () => {
          // Check if we need to evict before adding
          if (this.communityTradeCache.size >= this.MAX_CACHE_ENTRIES) {
            await this.evictOldestCacheEntries();
          }
          
          this.communityTradeCache.set(communityId, limitedTradeLoops);
          this.lastUpdateTime.set(communityId, performance.now());
        });
        
        // Run cache maintenance in the background
        setTimeout(() => this.manageCacheWithFairness(), 0);
        
        const endTime = performance.now();
        operation.info(`Probabilistic community processing completed`, {
          communityId,
          durationMs: Math.round(endTime - startTime),
          tradesFoundCount: limitedTradeLoops.length,
          originalCount: tradeLoops.length,
          algorithm: 'MonteCarlo'
        });
        
        operation.end();
        return limitedTradeLoops;
      } catch (error) {
        // If probabilistic sampling fails, fall back to deterministic algorithm
        operation.warn(`Probabilistic sampling failed, falling back to deterministic algorithm`, {
          communityId,
          error: error instanceof Error ? error.message : String(error)
        });
        
        // Continue with original deterministic approach
      }
    }
    
    // Original deterministic algorithm continues here
    operation.info(`Using deterministic algorithm for community`, { 
      communityId,
      subsetWalletCount: communityWallets.size
    });
    
    // Calculate an appropriate timeout for this community
    const timeout = this.calculateCommunityTimeout(
      walletAddresses, 
      (hasInfrequentUsers || hasNewUsers) ? this.EXTENDED_TIMEOUT_MS : this.BASE_TIMEOUT_MS
    );
    
    try {
      // Set a timeout to ensure we don't spend too long on any single community
      const timeoutPromise = new Promise<TradeLoop[]>((_, reject) => {
        setTimeout(() => reject(new Error('Community processing timed out')), timeout);
      });
      
      // Create the trade finding promise
      const findTradesPromise = this.tradeLoopFinder.findAllTradeLoops(
        communityWallets,
        nftOwnership,
        wantedNfts,
        rejectionPreferences
      );
      
      // Race the timeout against the actual processing
      const tradeLoops = await Promise.race([findTradesPromise, timeoutPromise]);
      
      // Apply probabilistic filtering with Bloom filter to avoid duplicate cycles
      const uniqueTradeLoops = this.filterDuplicateCycles(tradeLoops);
      
      // Limit number of trades per community
      const limitedTradeLoops = uniqueTradeLoops.slice(0, this.MAX_TRADES_PER_COMMUNITY);
      
      // Clear the update queue for this community since we've processed it
      if (updateQueue) {
        updateQueue.addedWallets.clear();
        updateQueue.removedWallets.clear();
        updateQueue.updatedWallets.clear();
      }
      
      // Cache the results with automatic eviction
      await this.cacheMutex.runExclusive(async () => {
        // Check if we need to evict before adding
        if (this.communityTradeCache.size >= this.MAX_CACHE_ENTRIES) {
          await this.evictOldestCacheEntries();
        }
        
        this.communityTradeCache.set(communityId, limitedTradeLoops);
        this.lastUpdateTime.set(communityId, performance.now());
      });
      
      // Run cache maintenance in the background
      setTimeout(() => this.manageCacheWithFairness(), 0);
      
      const endTime = performance.now();
      operation.info(`Community processing completed`, {
        communityId,
        durationMs: Math.round(endTime - startTime),
        timeout,
        hasInfrequentUsers,
        hasNewUsers,
        tradesFoundCount: limitedTradeLoops.length,
        originalCount: tradeLoops.length,
        uniqueCount: uniqueTradeLoops.length,
        limitedCount: limitedTradeLoops.length,
        algorithm: 'Deterministic'
      });
      
      operation.end();
      return limitedTradeLoops;
    } catch (error) {
      // Handle timeouts gracefully
      if (error instanceof Error && error.message === 'Community processing timed out') {
        operation.warn('Community processing timed out, returning cached results if available', {
          communityId,
          timeout,
          hasCachedResults: cachedTrades !== undefined
        });
        
        // If we have cached results, return those even if expired
        if (cachedTrades) {
          operation.end();
          return cachedTrades;
        }
        
        // Otherwise return an empty array
        operation.end();
        return [];
      }
      
      // Handle other errors
      operation.error('Error processing community', {
        communityId,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      return [];
    }
  }
  
  /**
   * Filter duplicate trade cycles using probabilistic data structures
   * 
   * This method uses a Bloom filter to efficiently detect duplicate cycles
   * across different communities. Since communities may overlap, the same cycle
   * might be discovered multiple times. The Bloom filter provides a memory-efficient
   * way to detect duplicates with a small false positive rate.
   * 
   * Optimizations:
   * - Early exit for small trade sets to avoid Bloom filter overhead
   * - Pre-allocated result array for optimal memory usage
   * - O(1) lookups regardless of number of trades
   * - Minimal memory allocation during processing
   * 
   * Note: Bloom filters have a configurable false positive rate. We accept a small
   * chance of missing a valid trade to gain significant performance benefits.
   * 
   * @param trades Array of trade loops to filter for duplicates
   * @returns Array of unique trade loops after filtering
   */
  private filterDuplicateCycles(trades: TradeLoop[]): TradeLoop[] {
    // Early exit for empty or small inputs (no need for Bloom filter overhead)
    if (trades.length === 0) return [];
    if (trades.length <= 3) return trades; // For very small sets, duplicates are unlikely
    
    // Pre-allocate result array at max possible size to avoid resizing
    const uniqueTradesArray: TradeLoop[] = new Array(trades.length);
    let uniqueCount = 0;
    
    // Map trade IDs for constant-time lookup (faster than Array.includes)
    const tradeIdsMap = new Map<string, boolean>();
    for (const trade of trades) {
      tradeIdsMap.set(trade.id, true);
    }
    
    // Track metrics for logging
    let duplicatesSkipped = 0;
    
    // Track test case addresses
    const testWallets = [
      '5pPCbuGso6NguFBWAqaKm7FW9msRoLQQoWu7kawGfFna',
      'NHLeTzVE1BriRr3Uuebyq1aKEjRvWFMozy2BDAuLN2m',
      '52sLrTRsiVrVyxSL8r1rpbJmjtcbQER9QgeiykViUgC8'
    ];
    
    const testNfts = [
      'CaE8oUsYRCvRByMYBRrg7vjaaSa4fbHSwXKEdBj8EKNf',
      'ABiGDshndLxs935LEyx5YJ6SrkeMLEBwCmtDtfFcck1W',
      'G7yWHtUEfZgocWwzwChPMXnP91HUXJ2V2GnqUiovkHgs'
    ];
    
    // Only log if we're processing a significant number of trades
    if (trades.length > 100) {
      this.logger.info(`Filtering ${trades.length} trade loops for duplicates`);
    }
    
    for (const trade of trades) {
      // Skip processing if trade ID is no longer in the map (already processed)
      if (!tradeIdsMap.has(trade.id)) {
        duplicatesSkipped++;
        continue;
      }
      
      // Remove immediately from the map to mark as processed
      tradeIdsMap.delete(trade.id);
      
      // Check if this is our test case trade
      const isTestCaseTrade = trade.steps.some(step => 
        testWallets.includes(step.from) || testWallets.includes(step.to) ||
        testNfts.includes(step.nfts[0].address)
      );
      
      // Create efficient canonical representation
      const cycleKey = this.createEfficientCycleKey(trade);
      
      if (isTestCaseTrade) {
        this.logger.info(`[TEST CASE] Checking trade for duplicate: ${trade.id}`, {
          cycleKey,
          steps: trade.steps.map(step => `${step.from.substring(0, 6)} -> ${step.to.substring(0, 6)}`),
          participants: trade.totalParticipants,
          efficiency: trade.efficiency
        });
      }
      
      // Check if we've seen this cycle before using the Bloom filter
      if (!this.seenCycles.has(cycleKey)) {
        // Add to Bloom filter - this prevents duplicates across different community runs
        this.seenCycles.add(cycleKey);
        
        // Add to the result array directly - no need for intermediate map
        uniqueTradesArray[uniqueCount++] = trade;
        
        if (isTestCaseTrade) {
          this.logger.info(`[TEST CASE] Trade ACCEPTED as unique: ${trade.id}`);
        }
      } else if (isTestCaseTrade) {
        this.logger.warn(`[TEST CASE] Trade REJECTED as duplicate: ${trade.id}`);
      }
    }
    
    // Only log significant duplicate counts
    if (duplicatesSkipped > 10) {
      this.logger.info(`Filtered out ${duplicatesSkipped} duplicates from ${trades.length} trades`);
    }
    
    // Return only the filled portion of the array
    return uniqueTradesArray.slice(0, uniqueCount);
  }
  
  /**
   * Create an efficient canonical key for a trade loop
   * This method avoids unnecessary object creation and memory allocation
   * and uses string interning for optimal memory management
   * 
   * CRITICAL FIX: Now includes NFT data to prevent same-wallet different-NFT duplicates
   */
  private createEfficientCycleKey(trade: TradeLoop): string {
    // FIXED: Include both wallets AND NFTs in the canonical key
    // This prevents the same wallets trading different NFTs from being considered duplicates
    
    // Create a comprehensive representation including all trade elements
    const tradeElements: string[] = [];
    
    // Add each step as wallet_pair:nft_address for complete uniqueness
    for (const step of trade.steps) {
      const nftAddress = step.nfts[0]?.address || 'unknown';
      // Create deterministic representation: from->to:nft
      tradeElements.push(`${step.from}->${step.to}:${nftAddress}`);
    }
    
    // Sort the trade elements to ensure canonical ordering
    // This handles cycle rotations (A->B->C vs B->C->A vs C->A->B)
    tradeElements.sort();
    
    // Create the final canonical key
    const key = tradeElements.join('|');
    
    // Intern the string to reduce memory usage for repetitive keys
    return String(key);
  }
  
  /**
   * Score and sort trade loops
   * This applies additional quality metrics beyond simple efficiency
   */
  private scoreAndSortTradeLoops(trades: TradeLoop[]): TradeLoop[] {
    // Early exit for empty trades
    if (trades.length === 0) return [];
    
    // Map in-place instead of creating copies to reduce memory allocation
    for (const trade of trades) {
      // Add quality score directly to the trade object
      trade.qualityScore = this.calculateQualityScore(trade);
    }
    
    // Sort in-place to avoid creating a new array
    trades.sort((a, b) => {
      return (b.qualityScore || 0) - (a.qualityScore || 0);
    });
    
    return trades;
  }
  
  /**
   * Calculate a quality score for a trade loop
   * This goes beyond simple efficiency to include value, popularity, etc.
   */
  private calculateQualityScore(trade: TradeLoop): number {
    // Base score is the trade efficiency
    let score = trade.efficiency || 0.5; // Default to 0.5 if undefined
    
    // Participant factor: preference for smaller loops (2-3 participants)
    // Every participant above 2 reduces score by 5% up to a maximum penalty of 30%
    const participantPenalty = Math.min(0.3, Math.max(0, (trade.totalParticipants - 2) * 0.05));
    score *= (1.0 - participantPenalty);
    
    // Value factor: higher value trades get a boost, but with diminishing returns
    // Scale value between 0.8 and 1.5 based on estimated value
    const valueBoost = trade.estimatedValue > 0
      ? Math.min(1.5, Math.max(0.8, 1.0 + (trade.estimatedValue / 20)))
      : 1.0;
    score *= valueBoost;
    
    // Bundle bonus: trades with multiple NFTs (bundles) get a slight boost
    if (trade.isBundle) {
      score *= 1.05; // 5% bonus for bundle trades
    }
    
    return score;
  }
  
  /**
   * Find trade loops for a specific wallet with optimized performance
   * This method focuses processing on the most relevant community and uses targeted caching
   */
  public async findTradeLoopsForWallet(
    walletAddress: string,
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences: Map<string, RejectionPreferences>
  ): Promise<TradeLoop[]> {
    const operation = this.logger.operation('findTradeLoopsForWallet');
    const startTime = performance.now();
    
    // Mark this wallet as a priority wallet for future background processing
    this.setPriorityWallet(walletAddress);
    
    operation.info(`Finding trades for specific wallet`, { wallet: walletAddress });
    
    // Check for a specialized wallet-specific cache first
    const walletCacheKey = `wallet:${walletAddress}`;
    const cachedTrades = this.communityTradeCache.get(walletCacheKey);
    const lastCacheUpdate = this.lastUpdateTime.get(walletCacheKey) || 0;
    const cacheTTL = this.isNewUser(walletAddress) || this.isInfrequentUser(walletAddress) ? 
      this.EXTENDED_CACHE_TTL_MS : this.COMMUNITY_CACHE_TTL_MS;
    
    // Use recent cache if available
    if (cachedTrades && (performance.now() - lastCacheUpdate) < cacheTTL) {
      operation.info(`Using cached wallet-specific trades`, {
        wallet: walletAddress,
        tradeCount: cachedTrades.length,
        cacheAgeMs: Math.round(performance.now() - lastCacheUpdate)
      });
      
      operation.end();
      return cachedTrades;
    }
    
    // Find the community this wallet belongs to
    let communityId: string | null = null;
    let communityWallets: string[] = [];
    
    // Use mutex lock to safely read from walletToCommunity
    await this.walletCommunityMutex.runExclusive(async () => {
      communityId = this.walletToCommunity.get(walletAddress) || null;
    });
    
    if (communityId) {
      // Get the community wallet addresses
      await this.communitiesMutex.runExclusive(async () => {
        communityWallets = this.communities.get(communityId!) || [];
      });
    }
    
    // Fetch direct trades first (these are fast to compute)
    // Look only for trades directly involving this wallet to improve performance
    const directTradesPromise = this.findDirectTradesForWallet(
      walletAddress, wallets, nftOwnership, wantedNfts, rejectionPreferences
    );
    
    let communityTradesPromise: Promise<TradeLoop[]> = Promise.resolve([]);
    
    // If wallet is part of a community with other wallets, process that community
    if (communityId && communityWallets.length > 1) {
      communityTradesPromise = this.processCommunityCycles(
        communityId,
        communityWallets,
        wallets,
        nftOwnership,
        wantedNfts,
        rejectionPreferences
      );
    } else {
      operation.info(`Wallet not found in any useful community, finding direct trades only`);
    }
    
    // Run both operations in parallel for better performance
    const [directTrades, communityTrades] = await Promise.all([
      directTradesPromise,
      communityTradesPromise
    ]);
    
    // Combine all trades and filter to just those relevant to this wallet
    // Use a Set to efficiently check if a wallet is included in a trade
    const relevantTrades = [...directTrades, ...communityTrades].filter(trade => 
      trade.steps.some(step => step.from === walletAddress || step.to === walletAddress)
    );
    
    // Score and sort the filtered trades
    const scoredTrades = this.scoreAndSortTradeLoops(relevantTrades);
    
    // Cache the results for this specific wallet
    this.communityTradeCache.set(walletCacheKey, scoredTrades);
    this.lastUpdateTime.set(walletCacheKey, performance.now());
    
    const duration = performance.now() - startTime;
    operation.info(`Found trades for wallet`, {
      wallet: walletAddress,
      directTrades: directTrades.length,
      communityTrades: communityTrades.length,
      relevantTrades: scoredTrades.length,
      durationMs: Math.round(duration)
    });
    
    operation.end();
    return scoredTrades;
  }
  
  /**
   * Optimized method to find direct 1:1 trades specifically involving a given wallet
   * This is more efficient than running the general direct match algorithm
   */
  private async findDirectTradesForWallet(
    walletAddress: string,
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences: Map<string, RejectionPreferences>
  ): Promise<TradeLoop[]> {
    const wallet = wallets.get(walletAddress);
    if (!wallet) return [];
    
    const directTrades: TradeLoop[] = [];
    const walletId = walletAddress;
    
    // Get rejection preferences for this wallet
    const rejectPrefs = rejectionPreferences.get(walletId) || { 
      nfts: new Set<string>(), 
      wallets: new Set<string>() 
    };
    
    // 1. Check this wallet's wanted NFTs to find potential trades where this wallet receives
    for (const wantedNft of wallet.wantedNfts) {
      // Skip if wallet has rejected this NFT
      if (rejectPrefs.nfts.has(wantedNft)) continue;
      
      // Find the current owner of this NFT
      const ownerWalletId = nftOwnership.get(wantedNft);
      if (!ownerWalletId || ownerWalletId === walletId) continue;
      
      // Skip if wallet has rejected the owner
      if (rejectPrefs.wallets.has(ownerWalletId)) continue;
      
      // Get owner's wallet state
      const ownerWallet = wallets.get(ownerWalletId);
      if (!ownerWallet) continue;
      
      // Check if owner wants any of this wallet's NFTs
      for (const ownedNft of wallet.ownedNfts) {
        if (ownerWallet.wantedNfts.has(ownedNft)) {
          // Get rejection preferences for the other wallet
          const ownerRejectPrefs = rejectionPreferences.get(ownerWalletId) || { 
            nfts: new Set<string>(), 
            wallets: new Set<string>() 
          };
          
          // Skip if owner rejected this NFT or wallet
          if (ownerRejectPrefs.nfts.has(ownedNft) || ownerRejectPrefs.wallets.has(walletId)) {
            continue;
          }
          
          // Found a valid direct match!
          directTrades.push(this.createDirectTradeLoop(
            walletId, ownerWalletId, ownedNft, wantedNft
          ));
        }
      }
    }
    
    return directTrades;
  }
  
  /**
   * Helper to construct a direct trade loop object
   */
  private createDirectTradeLoop(
    wallet1: string,
    wallet2: string,
    nft1: string,
    nft2: string
  ): TradeLoop {
    // Generate a deterministic ID for the trade
    const id = `direct:${[wallet1, wallet2].sort().join(':')}-${[nft1, nft2].sort().join(':')}`;
    
    // Create the trade loop with complete NFT objects
    return {
      id,
      steps: [
        {
          from: wallet1,
          to: wallet2,
          nfts: [{
            address: nft1,
            collection: this.extractCollectionId(nft1),
            name: `NFT ${nft1.substring(0, 8)}`,
            symbol: "",
            image: "",
            description: ""
          }]
        },
        {
          from: wallet2,
          to: wallet1,
          nfts: [{
            address: nft2,
            collection: this.extractCollectionId(nft2),
            name: `NFT ${nft2.substring(0, 8)}`,
            symbol: "",
            image: "",
            description: ""
          }]
        }
      ],
      totalParticipants: 2,
      estimatedValue: 0, // Initially unknown
      efficiency: 1.0,   // Direct trades are 100% efficient
      rawEfficiency: 1.0, // Add the required rawEfficiency property
      qualityScore: 0,   // Will be calculated later
      isBundle: false
    };
  }
  
  /**
   * Mark a wallet as high priority for future processing
   */
  private setPriorityWallet(walletAddress: string): void {
    // Get current time for tracking recent activity
    const now = Date.now();
    
    // Update wallet activity map
    const activity = this.walletActivityMap.get(walletAddress) || {
      lastActive: undefined,
      createdAt: undefined,
      tradeCount: 0
    };
    
    // Update last active time
    activity.lastActive = new Date();
    
    // Set created time if not already set
    if (!activity.createdAt) {
      activity.createdAt = new Date();
    }
    
    this.walletActivityMap.set(walletAddress, activity);
  }

  /**
   * Add a wallet to the system
   */
  public async walletAdded(walletAddress: string): Promise<void> {
    // Use mutex to safely modify pendingWalletAdditions and isGraphDirty
    await this.pendingWalletsMutex.runExclusive(async () => {
      // First, check if wallet already belongs to a community
      let existingCommunity: string | undefined;
      
      await this.walletCommunityMutex.runExclusive(async () => {
        existingCommunity = this.walletToCommunity.get(walletAddress);
      });
      
      if (existingCommunity) {
        this.logger.info(`Wallet ${walletAddress} already in community ${existingCommunity}, skipping`);
        return;
      }
      
      // Mark graph as needing re-partitioning
      await this.graphDirtyMutex.runExclusive(async () => {
        this.isGraphDirty = true;
      });
      
      // If wallet isn't already in a community, add it to the pending list
      if (this.pendingWalletAdditions.has('all')) {
        const pending = this.pendingWalletAdditions.get('all')!;
        if (!pending.includes(walletAddress)) {
          pending.push(walletAddress);
          this.logger.info(`Added wallet ${walletAddress} to pending additions`);
        }
      } else {
        this.pendingWalletAdditions.set('all', [walletAddress]);
        this.logger.info(`Created pending additions list with wallet ${walletAddress}`);
      }
    });
  }

  /**
   * Remove a wallet from the system
   */
  public async walletRemoved(walletAddress: string): Promise<void> {
    // Use mutex to safely modify pendingWalletRemovals and isGraphDirty
    await this.pendingWalletsMutex.runExclusive(async () => {
      // Check if wallet belongs to a community
      let existingCommunity: string | undefined;
      
      await this.walletCommunityMutex.runExclusive(async () => {
        existingCommunity = this.walletToCommunity.get(walletAddress);
      });
      
      if (existingCommunity) {
        // Mark graph as needing re-partitioning
        await this.graphDirtyMutex.runExclusive(async () => {
          this.isGraphDirty = true;
        });
        
        // Add to the community-specific removal list
        if (this.pendingWalletRemovals.has(existingCommunity)) {
          const pending = this.pendingWalletRemovals.get(existingCommunity)!;
          if (!pending.includes(walletAddress)) {
            pending.push(walletAddress);
            this.logger.info(`Added wallet ${walletAddress} to community ${existingCommunity} removal list`);
          }
        } else {
          this.pendingWalletRemovals.set(existingCommunity, [walletAddress]);
          this.logger.info(`Created removal list for community ${existingCommunity} with wallet ${walletAddress}`);
        }
      }
    });
  }

  /**
   * Update a wallet in the system
   */
  public async walletUpdated(walletAddress: string): Promise<void> {
    // Use mutex to safely modify pendingWalletUpdates
    await this.pendingWalletsMutex.runExclusive(async () => {
      // Check if wallet belongs to a community
      let existingCommunity: string | undefined;
      
      await this.walletCommunityMutex.runExclusive(async () => {
        existingCommunity = this.walletToCommunity.get(walletAddress);
      });
      
      if (existingCommunity) {
        // For updates, we don't need to re-partition the graph
        // Just add to the community-specific update list
        if (this.pendingWalletUpdates.has(existingCommunity)) {
          const pending = this.pendingWalletUpdates.get(existingCommunity)!;
          if (!pending.includes(walletAddress)) {
            pending.push(walletAddress);
            this.logger.info(`Added wallet ${walletAddress} to community ${existingCommunity} update list`);
          }
        } else {
          this.pendingWalletUpdates.set(existingCommunity, [walletAddress]);
          this.logger.info(`Created update list for community ${existingCommunity} with wallet ${walletAddress}`);
        }
        
        // Safely update the update queue
        await this.incrementalUpdateQueuesMutex.runExclusive(async () => {
          const queue = this.getUpdateQueue(existingCommunity!);
          queue.updatedWallets.add(walletAddress);
        });
        
        // Invalidate community cache since a wallet was updated
        await this.cacheMutex.runExclusive(async () => {
          this.communityTradeCache.delete(existingCommunity!);
          this.lastUpdateTime.delete(existingCommunity!);
          this.logger.info(`Invalidated cache for community ${existingCommunity}`);
        });
      } else {
        // If wallet isn't in a community, treat it as an addition
        this.walletAdded(walletAddress);
      }
    });
  }

  /**
   * Clear the cache
   */
  public async clearCache(): Promise<void> {
    await this.cacheMutex.runExclusive(async () => {
      this.communityTradeCache.clear();
      this.lastUpdateTime.clear();
      this.logger.info('Trade cache cleared');
    });
    
    // Reset the update queues
    await this.incrementalUpdateQueuesMutex.runExclusive(async () => {
      this.resetQueues();
    });
  }
  
  /**
   * Reset the update queues
   */
  private resetQueues(): void {
    this.incrementalUpdateQueues.clear();
    this.logger.info('Update queues reset');
  }

  /**
   * Get or create update queue for a community
   */
  private getUpdateQueue(communityId: string): {
    addedWallets: Set<string>;
    removedWallets: Set<string>;
    updatedWallets: Set<string>;
  } {
    let queue = this.incrementalUpdateQueues.get(communityId);
    if (!queue) {
      queue = {
        addedWallets: new Set<string>(),
        removedWallets: new Set<string>(),
        updatedWallets: new Set<string>()
      };
      this.incrementalUpdateQueues.set(communityId, queue);
    }
    return queue;
  }

  /**
   * Estimate the current capacity of the Bloom filter
   * @returns Approximate number of items the filter is sized for
   */
  private estimateBloomFilterCapacity(): number {
    // Estimate the capacity by looking at the filter's parameters
    // For the BloomFilter library we use, we need to use reflection
    // as these properties aren't directly exposed
    const filterSize = (this.seenCycles as any)._size || 1000; // bytes
    const filterHashCount = (this.seenCycles as any)._hashFunctions || 10;
    
    // Estimate capacity at 0.1% false positive rate
    const filterBits = filterSize * 8; // convert bytes to bits
    const capacity = Math.round(filterBits * (Math.log(2) ** 2) / -Math.log(0.001));
    
    return capacity;
  }

  /**
   * Evict oldest cache entries when we reach the maximum
   * This prevents unbounded memory growth
   */
  private async evictOldestCacheEntries(): Promise<void> {
    // Calculate how many entries to evict (20% of max)
    const entriesToEvict = Math.max(1, Math.floor(this.MAX_CACHE_ENTRIES * 0.2));
    
    // Get all entries sorted by last update time (oldest first)
    const sortedEntries = Array.from(this.lastUpdateTime.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, entriesToEvict);
    
    // Evict the oldest entries
    for (const [communityId] of sortedEntries) {
      this.communityTradeCache.delete(communityId);
      this.lastUpdateTime.delete(communityId);
    }
    
    this.logger.info('Evicted oldest cache entries', {
      evictedCount: sortedEntries.length,
      remainingEntries: this.communityTradeCache.size
    });
  }
} 