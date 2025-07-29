import { Helius } from 'helius-sdk';
import { PersistenceManager } from '../../lib/persistence/PersistenceManager';
import { 
  WalletState, 
  // TradeRequest,      // Unused import
  // DiscoveredTradeLoop, // Unused import
  TradeLoop, 
  RejectionPreferences,
  CompletedTradeStep,
  PreparedTradeData,
  NFTDemandMetrics,
  NFTValueRecord,
  TradeDiscoverySettings
} from '../../types/trade';
import { ITradeDiscoveryService } from '../../types/services';
import { WalletService } from './WalletService';
import { TradeLoopFinderService } from './TradeLoopFinderService';
import { ScalableTradeLoopFinderService } from './ScalableTradeLoopFinderService';
import { BundleTradeLoopFinderService } from './BundleTradeLoopFinderService';
import { TradeScoreService } from './TradeScoreService';
import { NFTPricingService } from '../nft/NFTPricingService';
import { performance } from 'perf_hooks';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import path from 'path';
import { 
  validateInput, 
  tradeDiscoverySettingsSchema, 
  isValidSolanaWalletAddress, 
  isValidNftAddress 
} from '../../utils/validation/inputValidation';
import { Mutex } from 'async-mutex';
import { CollectionAbstractionService } from './CollectionAbstractionService';
import { LocalCollectionService } from '../nft/LocalCollectionService';
import { CollectionConfigService } from './CollectionConfigService';
import { DataSyncService } from '../data/DataSyncService';
import { container } from '../../di-container';

/**
 * Main service for discovering and managing trades
 * Acts as orchestrator for multiple specialized services
 */
export class TradeDiscoveryService implements ITradeDiscoveryService {
  private static instance: TradeDiscoveryService;
  
  // Core data stores
  private wallets: Map<string, WalletState> = new Map();
  private nftOwnership: Map<string, string> = new Map(); // nftAddress -> walletAddress
  private wantedNfts: Map<string, Set<string>> = new Map(); // nftAddress -> Set<walletAddress>
  private rejectionPreferences: Map<string, RejectionPreferences> = new Map();
  private completedSteps: Map<string, CompletedTradeStep> = new Map();
  private manualNftRegistry: Map<string, string[]> = new Map();
  private nftDemandMetrics: Map<string, NFTDemandMetrics> = new Map();
  private nftValueRecords: Map<string, NFTValueRecord> = new Map();
  
  // Mutex locks to prevent race conditions when modifying state
  private walletsMutex = new Mutex();
  private nftOwnershipMutex = new Mutex();
  private wantedNftsMutex = new Mutex();
  private rejectionPreferencesMutex = new Mutex();
  private completedStepsMutex = new Mutex();
  private manualNftRegistryMutex = new Mutex();
  private nftDemandMetricsMutex = new Mutex();
  private nftValueRecordsMutex = new Mutex();
  
  // Constants and configuration
  private readonly MAX_DEPTH: number;
  private readonly MIN_EFFICIENCY: number;
  private readonly WALLET_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  // Service dependencies
  private helius: Helius;
  private persistenceManager: PersistenceManager;
  private walletService: WalletService;
  private legacyTradeLoopFinder: TradeLoopFinderService;
  private scalableTradeLoopFinder: ScalableTradeLoopFinderService;
  private bundleTradeLoopFinder!: BundleTradeLoopFinderService;
  private tradeScoreService: TradeScoreService;
  private nftPricingService: NFTPricingService;
  private logger: Logger;
  private collectionAbstractionService: CollectionAbstractionService;
  private localCollectionService: LocalCollectionService;
  private collectionConfigService: CollectionConfigService;
  private dataSyncService: DataSyncService | null = null;
  
  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('TradeDiscoveryService');
    
    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
      throw new Error('HELIUS_API_KEY environment variable is required');
    }
    
    // Initialize services
    this.helius = new Helius(apiKey);
    this.persistenceManager = PersistenceManager.getInstance();
    this.nftPricingService = NFTPricingService.getInstance();
    
    // Initialize dependent services
    this.walletService = new WalletService(this.helius, this.manualNftRegistry);
    
    // Get configuration from environment variables or use defaults
    this.MAX_DEPTH = parseInt(process.env.TRADELOOP_MAX_DEPTH || '10', 10);
    this.MIN_EFFICIENCY = parseFloat(process.env.TRADELOOP_MIN_EFFICIENCY || '0.6');
    
    // Force persistence to be enabled regardless of environment variables
    console.log('Force enabling persistence in TradeDiscoveryService');
    this.persistenceManager.setEnabled(true);
    this.logger.info('Persistence is FORCEFULLY enabled by TradeDiscoveryService');
    
    this.logger.info('Initializing Trade Discovery Service', {
      maxDepth: this.MAX_DEPTH,
      minEfficiency: this.MIN_EFFICIENCY,
      persistenceEnabled: this.persistenceManager.getIsEnabled(),
      persistenceEnvVar: process.env.ENABLE_PERSISTENCE
    });
    
    // Initialize all finder implementations
    this.legacyTradeLoopFinder = new TradeLoopFinderService(
      this.MAX_DEPTH,
      this.MIN_EFFICIENCY
    );
    
    // Initialize the scalable implementation
    this.scalableTradeLoopFinder = ScalableTradeLoopFinderService.getInstance();
    
    // Initialize the bundle-based implementation if it exists
    try {
      this.bundleTradeLoopFinder = new BundleTradeLoopFinderService();
      this.logger.info('Bundle Trade Loop Finder initialized successfully');
    } catch (error) {
      this.logger.warn('Bundle Trade Loop Finder not available, continuing without it', { error });
    }
    
    this.tradeScoreService = new TradeScoreService();
    
    this.collectionAbstractionService = CollectionAbstractionService.getInstance();
    this.localCollectionService = LocalCollectionService.getInstance();
    this.collectionConfigService = CollectionConfigService.getInstance();
    // DataSyncService will be resolved lazily on first use
    
    // Load persisted state
    this.loadStateFromPersistence();
  }

  public static getInstance(): TradeDiscoveryService {
    if (!TradeDiscoveryService.instance) {
      TradeDiscoveryService.instance = new TradeDiscoveryService();
    }
    return TradeDiscoveryService.instance;
  }

  /**
   * Find potential trade loops based on registered wallets and preferences
   * with configurable settings
   */
  public async findTradeLoops(settings?: Partial<TradeDiscoverySettings>): Promise<TradeLoop[]> {
    const operation = this.logger.operation('findTradeLoops');
    operation.info('Starting trade loop discovery');
    
    // Set a global time budget from environment variables or settings
    const startTime = performance.now();
    // Ensure globalTimeoutMs always has a value
    const globalTimeoutMs = settings?.timeoutMs || 
                           parseInt(process.env.TRADELOOP_GLOBAL_TIMEOUT_MS || '10000', 10);
    
    // Validate settings using zod schema
    let validatedSettings = settings; // Initialize with incoming settings
    if (settings) {
      const [isValid, processedSettings, errorMessage] = validateInput(
        settings,
        tradeDiscoverySettingsSchema,
        'TradeDiscoverySettings'
      );
      
      if (!isValid) {
        operation.error('Invalid trade discovery settings', { error: errorMessage });
        throw new Error(`Invalid trade discovery settings: ${errorMessage}`);
      }
      validatedSettings = processedSettings || settings; // Use processed or original
    }
    
    // Merge settings with defaults, ensuring mergedSettings is always fully defined
    const mergedSettings: TradeDiscoverySettings = {
      maxDepth: validatedSettings?.maxDepth || this.MAX_DEPTH,
      minEfficiency: validatedSettings?.minEfficiency || this.MIN_EFFICIENCY,
      maxResults: validatedSettings?.maxResults !== undefined ? validatedSettings.maxResults : 100, // Ensure maxResults has a default
      includeDirectTrades: validatedSettings?.includeDirectTrades !== undefined ? validatedSettings.includeDirectTrades : true,
      includeMultiPartyTrades: validatedSettings?.includeMultiPartyTrades !== undefined ? validatedSettings.includeMultiPartyTrades : true,
      considerCollections: validatedSettings?.considerCollections !== undefined ? validatedSettings.considerCollections : false,
      timeoutMs: globalTimeoutMs,
      walletAddress: validatedSettings?.walletAddress, // Pass through from validated settings
      nftAddress: validatedSettings?.nftAddress     // Pass through from validated settings
    };
    
    // Synchronize data structures before proceeding
    operation.info('Synchronizing data structures before trade discovery');
    
    // Get DataSyncService lazily
    if (!this.dataSyncService) {
      try {
        this.dataSyncService = container.resolve<DataSyncService>("DataSyncService");
      } catch (error) {
        operation.warn('DataSyncService not available, skipping data sync', { error });
      }
    }
    
    if (this.dataSyncService) {
      // Validate and sync data integrity
      const validationResult = this.dataSyncService.validateDataIntegrity(
        this.wallets,
        this.nftOwnership,
        this.wantedNfts
      );
      
      if (!validationResult.isValid) {
        operation.warn('Data integrity issues detected', {
          issuesCount: validationResult.issues.length,
          sampleIssues: validationResult.issues.slice(0, 5)
        });
        
        // Perform synchronization to fix issues
        operation.info('Performing data synchronization to fix issues');
        this.wantedNfts = this.dataSyncService.syncWantedNfts(this.wallets, this.wantedNfts);
        this.nftOwnership = this.dataSyncService.syncNftOwnership(this.wallets, this.nftOwnership);
        
        // Re-validate after sync
        const postSyncValidation = this.dataSyncService.validateDataIntegrity(
          this.wallets,
          this.nftOwnership,
          this.wantedNfts
        );
        
        if (!postSyncValidation.isValid) {
          operation.error('Data integrity issues persist after synchronization', {
            remainingIssues: postSyncValidation.issues.length
          });
        } else {
          operation.info('Data synchronization successful - all integrity checks passed');
        }
      } else {
        operation.info('Data integrity validated - no issues found');
      }
    }
    
    // Log input sizes and settings
    operation.info('Trade loop discovery parameters', {
      wallets: this.wallets.size,
      nfts: this.nftOwnership.size,
      wantedNfts: this.wantedNfts.size,
      maxDepth: mergedSettings.maxDepth,
      minEfficiency: mergedSettings.minEfficiency,
      timeoutMs: mergedSettings.timeoutMs
    });
    
    // Safety check for minimum data requirements
    if (this.wallets.size < 2 || this.nftOwnership.size < 2 || this.wantedNfts.size < 1) {
      operation.warn('Not enough data to find trade loops (need at least 2 wallets, 2 NFTs, and 1 want)');
      operation.end();
      return [];
    }
    
    // Determine which implementation to use based on dataset size and environment variables
    const enableBundleTrades = process.env.ENABLE_BUNDLE_TRADES === 'true';
    const forceScalable = process.env.FORCE_SCALABLE_IMPLEMENTATION === 'true';
    const largeDataset = this.wallets.size > 100;

    // Define the strategy to use and backup strategies
    interface TradeFinderStrategy {
      name: string;
      finder: any;
      findAllTradeLoops: () => Promise<TradeLoop[]>;
    }

    // Build collection wants map before creating strategies
    const collectionWants = await this.buildCollectionWantsMap();
    
    // Expand collection wants to specific NFT wants if we have any
    let expandedWantedNfts = this.wantedNfts;
    if (collectionWants.size > 0) {
      expandedWantedNfts = await this.collectionAbstractionService.expandCollectionWants(
        this.wallets,
        this.nftOwnership,
        collectionWants
      );
      
      operation.info('Collection wants expanded', {
        originalWants: this.wantedNfts.size,
        expandedWants: expandedWantedNfts.size,
        newEdges: expandedWantedNfts.size - this.wantedNfts.size,
        collectionsExpanded: collectionWants.size
      });
    }

    // Prepare the strategies in order of preference
    const strategies: TradeFinderStrategy[] = [];

    // First choice: Bundle implementation (if enabled)
    if (enableBundleTrades && this.bundleTradeLoopFinder !== undefined) {
      strategies.push({
        name: 'bundle',
        finder: this.bundleTradeLoopFinder,
        findAllTradeLoops: async () => {
          operation.info('Using bundle-based implementation for trade loop discovery');
          const trades = await this.bundleTradeLoopFinder.findAllTradeLoops(
            this.wallets,
            this.nftOwnership,
            expandedWantedNfts, // Use expanded wants
            this.rejectionPreferences
          );
          
          // Calculate bundle percentage
          const bundleTrades = trades.filter(trade => trade.isBundle === true).length;
          const bundlePercentage = trades.length > 0 ? (bundleTrades / trades.length) * 100 : 0;
          
          operation.info('Bundle trade statistics', {
            totalTrades: trades.length,
            bundleTrades,
            bundlePercentage: `${bundlePercentage.toFixed(1)}%`
          });
          
          return trades;
        }
      });
    }
    
    // Second choice: Scalable implementation (for large datasets or when forced)
    if (forceScalable || largeDataset) {
      strategies.push({
        name: 'scalable',
        finder: this.scalableTradeLoopFinder,
        findAllTradeLoops: async () => {
          operation.info('Using scalable implementation for trade loop discovery');
          const trades = await this.scalableTradeLoopFinder.findAllTradeLoops(
            this.wallets,
            this.nftOwnership,
            expandedWantedNfts, // Use expanded wants
            this.rejectionPreferences
          );
          
          operation.info('Scalable implementation trade statistics', {
            totalTrades: trades.length,
            directTrades: trades.filter(t => t.steps.length === 2).length,
            multiPartyTrades: trades.filter(t => t.steps.length > 2).length
          });
          
          return trades;
        }
      });
    }
    
    // Always add legacy as the fallback option
    strategies.push({
      name: 'legacy',
      finder: this.legacyTradeLoopFinder,
      findAllTradeLoops: async () => {
        operation.info('Using legacy implementation for trade loop discovery');
        const trades = await this.legacyTradeLoopFinder.findAllTradeLoops(
          this.wallets,
          this.nftOwnership,
          expandedWantedNfts, // Use expanded wants
          this.rejectionPreferences
        );
        
        operation.info('Legacy implementation trade statistics', {
          totalTrades: trades.length,
          directTrades: trades.filter(t => t.steps.length === 2).length,
          multiPartyTrades: trades.filter(t => t.steps.length > 2).length
        });
        
        return trades;
      }
    });

    // Try each strategy in order until one succeeds or we run out of options
    let allTrades: TradeLoop[] = [];
    let lastError: any = null;
    let partialResults: TradeLoop[] = [];
    let strategiesAttempted = 0;
    let strategiesSucceeded = 0;
    
    for (const strategy of strategies) {
      strategiesAttempted++;
      try {
        operation.info(`Attempting to find trades with ${strategy.name} implementation`);
        const strategyTrades = await strategy.findAllTradeLoops();
        
        // Add to partial results regardless of count
        partialResults.push(...strategyTrades);
        
        // If this strategy returned results, consider it successful
        if (strategyTrades.length > 0) {
          strategiesSucceeded++;
          allTrades.push(...strategyTrades);
          operation.info(`${strategy.name} implementation found ${strategyTrades.length} trades`);
          
          // Only break if we have enough trades or this is the preferred strategy
          if (allTrades.length >= (mergedSettings.maxResults || 100) || strategy.name === 'bundle') {
            break;
          }
        } else {
          operation.warn(`${strategy.name} implementation found 0 trades, trying next implementation`);
        }
      } catch (error) {
        lastError = error;
        operation.error(`Error in ${strategy.name} implementation, continuing with next option`, { 
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        
        // Don't break on error - continue trying other strategies
        continue;
      }
    }
    
    // If no strategies succeeded but we have partial results, use them
    if (strategiesSucceeded === 0 && partialResults.length > 0) {
      operation.warn('No strategies fully succeeded, but using partial results', {
        partialResultsCount: partialResults.length,
        strategiesAttempted,
        lastError: lastError instanceof Error ? lastError.message : String(lastError)
      });
      allTrades = partialResults;
    }
    
    // If all strategies failed and no partial results, log comprehensive error
    if (allTrades.length === 0 && strategiesAttempted > 0) {
      operation.error('All implementations failed to find trades', { 
        strategiesAttempted,
        strategiesSucceeded,
        partialResultsCount: partialResults.length,
        lastError: lastError instanceof Error ? lastError.message : String(lastError)
      });
      
      // Return empty array but don't throw - graceful degradation
      operation.end();
      return [];
    }

    operation.info('DEBUG: Initial allTrades from finders', { 
      count: allTrades.length,
      details: allTrades.map(t => ({ 
        id: t.id, 
        steps: t.steps.map(s => ({ from: s.from, to: s.to, nfts: s.nfts.map(n => n.address) }))
      }))
    });
    
    // Calculate scores for all trades using the TradeScoreService
    operation.info('Calculating quality scores for trades');
    const scoredTrades = allTrades.map(trade => {
      // Calculate score with the TradeScoreService
      const scoreResult = this.tradeScoreService.calculateTradeScore(trade, this.nftDemandMetrics);
      
      // Store the original efficiency value for reference
      const originalEfficiency = trade.efficiency;
      
      // Replace efficiency with the final score for sorting and display
      return {
        ...trade,
        rawEfficiency: originalEfficiency,
        efficiency: scoreResult.score,
        qualityScore: scoreResult.score,
        qualityMetrics: scoreResult.metrics
      };
    });
    
    // Sort by the calculated quality score (descending)
    scoredTrades.sort((a, b) => b.efficiency - a.efficiency);
    
    let finalResults: TradeLoop[] = [];
    const requestingUserWallet = mergedSettings.walletAddress; // Use mergedSettings here

    if (requestingUserWallet) {
      operation.info('Prioritizing trades for requesting wallet', { walletAddress: requestingUserWallet });
      const userSpecificTrades = scoredTrades.filter(trade => 
        trade.steps.some(step => step.from === requestingUserWallet || step.to === requestingUserWallet)
      );
      // Add all user-specific trades first
      finalResults.push(...userSpecificTrades);
      
      // Then add other top-scored trades, avoiding duplicates, up to maxResults
      const otherTopTrades = scoredTrades.filter(trade => 
        !userSpecificTrades.some(ust => ust.id === trade.id)
      );
      // Ensure we don't add more trades than maxResults allows, considering user trades are already in
      const remainingSlots = (mergedSettings.maxResults || 100) - finalResults.length;
      if (remainingSlots > 0) {
        finalResults.push(...otherTopTrades.slice(0, remainingSlots));
      }
    } else {
      // If no specific user, just take the top scored trades up to maxResults
      finalResults = scoredTrades.slice(0, mergedSettings.maxResults || 100);
    }

    // Apply the maxResults limit if specified (redundant if handled above but good for clarity)
    const limitedResults = (mergedSettings.maxResults || 100) > 0 
      ? finalResults.slice(0, mergedSettings.maxResults || 100) 
      : finalResults;
    
    const endTime = performance.now();
    
    operation.info('Trade loop discovery completed', {
      totalDiscovered: allTrades.length,
      totalQualified: scoredTrades.length,
      totalReturned: limitedResults.length,
      durationMs: (endTime - startTime).toFixed(2)
    });
    
    const targetWallets = [
      '5pPCbuGso6NguFBWAqaKm7FW9msRoLQQoWu7kawGfFna',
      'NHLeTzVE1BriRr3Uuebyq1aKEjRvWFMozy2BDAuLN2m',
      '52sLrTRsiVrVyxSL8r1rpbJmjtcbQER9QgeiykViUgC8'
    ];
    
    const targetNFTs = [
      'CaE8oUsYRCvRByMYBRrg7vjaaSa4fbHSwXKEdBj8EKNf',
      'ABiGDshndLxs935LEyx5YJ6SrkeMLEBwCmtDtfFcck1W',
      'G7yWHtUEfZgocWwzwChPMXnP91HUXJ2V2GnqUiovkHgs'
    ];

    // Find the problematic 3-way trade loop
    const targetTradeLoops = allTrades.filter(trade => {
      // Check if this trade has all our target wallets involved
      const walletInvolved = (wallet: string) => 
        trade.steps.some(step => step.from === wallet || step.to === wallet);
      
      const nftInvolved = (nftAddr: string) =>
        trade.steps.some(step => step.nfts.some(nft => nft.address === nftAddr));
      
      return targetWallets.every(walletInvolved) && targetNFTs.every(nftInvolved);
    });

    operation.info('TARGET 3-WAY TRADE LOOP DEBUGGING - PRE-FILTERING', { 
      targetTradeLoopCount: targetTradeLoops.length,
      targetLoopDetails: targetTradeLoops.map(t => ({ id: t.id, efficiency: t.efficiency, steps: t.steps.length}))
    });

    if (targetTradeLoops.length > 0) {
      operation.info('FOUND THE SPECIFIC 3-WAY TRADE LOOP!', {
        count: targetTradeLoops.length,
        details: targetTradeLoops.map(trade => ({
          id: trade.id,
          steps: trade.steps.map(step => ({
            from: step.from,
            to: step.to,
            nfts: step.nfts.map(nft => nft.address)
          }))
        }))
      });
      
      // Check if these trade loops made it to the final results
      const foundInResults = targetTradeLoops.filter(targetTrade => 
        limitedResults.some(result => result.id === targetTrade.id)
      );
      
      operation.info('FINAL RESULT INCLUDES TARGET TRADE LOOP?', {
        included: foundInResults.length > 0,
        count: foundInResults.length,
        targetTradeCount: targetTradeLoops.length
      });
    } else {
      operation.info('TARGET 3-WAY TRADE LOOP NOT FOUND IN ALL TRADES');
    }
    
    operation.info('FINAL limitedResults count:', { count: limitedResults.length });
    if (limitedResults.length > 0) {
      operation.info('Top 5 trades in limitedResults (or fewer if less than 5):', { 
        details: limitedResults.slice(0, 5).map(t => ({ id: t.id, score: t.efficiency, steps: t.steps.length }))
      });
    }

    operation.end();
    return limitedResults;
  }
  
  /**
   * Gets all wallets registered in the system
   * This is used by the scalable trade loop finder service for incremental updates
   */
  public getAllWallets(): string[] {
    return Array.from(this.wallets.keys());
  }

  /**
   * Gets the entire wallets map
   * This is used by Kafka integration for distributed processing
   */
  public getWallets(): Map<string, WalletState> {
    return this.wallets;
  }
  
  /**
   * Gets the wanted NFTs map
   * This is used by Kafka integration for distributed processing
   */
  public getWantedNfts(): Map<string, Set<string>> {
    return this.wantedNfts;
  }
  
  /**
   * Gets the rejection preferences map
   * This is used by Kafka integration for distributed processing
   */
  public getRejectionPreferences(): Map<string, RejectionPreferences> {
    return this.rejectionPreferences;
  }

  /**
   * Update wallet state with latest NFT ownership
   */
  public async updateWalletState(
    walletAddress: string, 
    forceRefresh = false
  ): Promise<WalletState> {
    this.logger.info(`[TDS.updateWalletState] ENTERED`, { walletAddress, forceRefresh });

    const operation = this.logger.operation('updateWalletState');
    operation.info('Updating wallet state', { wallet: walletAddress, forceRefresh });

    // Execute all wallet state operations atomically within the mutex
    const walletState = await this.walletsMutex.runExclusive(async () => {
      // Check current cache expiration
      let shouldRefresh = forceRefresh;
      let existingWallet = this.wallets.get(walletAddress);
      
      if (existingWallet) {
        const cacheAge = Date.now() - (existingWallet.lastUpdated?.getTime() || 0);
        shouldRefresh = shouldRefresh || cacheAge > this.WALLET_CACHE_TTL;
      } else {
        shouldRefresh = true; // Always refresh for new wallets
      }

      // If not refreshing, return existing state
      if (!shouldRefresh && existingWallet) {
        operation.info('Using cached wallet state', { 
          wallet: walletAddress, 
          ownedNfts: existingWallet.ownedNfts.size,
          wantedNfts: existingWallet.wantedNfts.size
        });
        return existingWallet;
      }

      // Fetch and update wallet state
      try {
        // Fetch current NFT ownership directly from walletService
        const walletNftsArray = await this.walletService.getWalletNFTs(walletAddress);
        
        // Initialize wallet state with default empty values
        let newWalletState: WalletState = {
          address: walletAddress,
          ownedNfts: new Set<string>(),
          wantedNfts: new Set<string>(),
          lastUpdated: new Date()
        };
        
        if (existingWallet) {
          // Keep existing wanted NFTs, update owned NFTs
          newWalletState = {
            ...existingWallet,
            address: walletAddress,
            ownedNfts: new Set(walletNftsArray),
            lastUpdated: new Date()
          };
        } else {
          // Create new wallet state
          newWalletState = {
            address: walletAddress,
            ownedNfts: new Set(walletNftsArray),
            wantedNfts: new Set(),
            lastUpdated: new Date()
          };
        }
        
        // Update wallet in cache
        this.wallets.set(walletAddress, newWalletState);
        
        // Log details before updating nftOwnership
        operation.info('NFT ownership BEFORE update for wallet', { 
          wallet: walletAddress, 
          currentNftOwnershipSize: this.nftOwnership.size,
          incomingWalletNftCount: walletNftsArray.length,
          sampleIncomingWalletNfts: walletNftsArray.slice(0, 5)
        });

        // Update NFT ownership map within a nested mutex
        await this.nftOwnershipMutex.runExclusive(async () => {
          // First remove any previous ownership entries for this wallet
          const nftsToRemove: string[] = [];
          for (const [nftAddr, owner] of this.nftOwnership.entries()) {
            if (owner === walletAddress && !walletNftsArray.includes(nftAddr)) {
              nftsToRemove.push(nftAddr);
            }
          }
          nftsToRemove.forEach(nftAddr => this.nftOwnership.delete(nftAddr));
          if (nftsToRemove.length > 0) {
            operation.info('Removed old NFT ownership entries for wallet', { wallet: walletAddress, count: nftsToRemove.length });
          }
          
          // Now add current ownership entries
          for (const nftAddr of walletNftsArray) {
            this.nftOwnership.set(nftAddr, walletAddress);
          }
        });

        // Build collection ownership for this wallet
        try {
          operation.info('Building collection ownership for wallet', { wallet: walletAddress });
          
          // Note: Collection indexing is now handled by LocalCollectionService automatically
          
          // Build collection ownership maps
          const walletMap = new Map<string, WalletState>();
          walletMap.set(walletAddress, newWalletState);
          await this.collectionAbstractionService.buildCollectionOwnership(walletMap);
          
          operation.info('Collection ownership built', { 
            wallet: walletAddress,
            collectionsOwned: newWalletState.ownedCollections?.size || 0
          });
        } catch (error) {
          operation.warn('Error building collection ownership', {
            wallet: walletAddress,
            error: error instanceof Error ? error.message : String(error)
          });
          // Continue without collection data if this fails
        }

        operation.info('NFT ownership AFTER update for wallet', { 
          wallet: walletAddress, 
          finalNftOwnershipSize: this.nftOwnership.size 
        });
        
        operation.info('Wallet state updated', { 
          wallet: walletAddress, 
          ownedNfts: newWalletState.ownedNfts.size,
          wantedNfts: newWalletState.wantedNfts.size
        });
        
        return newWalletState;
      } catch (error) {
        operation.error('Error updating wallet state', { 
          error: error instanceof Error ? error.message : String(error) 
        });
        throw error;
      }
    });

    operation.end();
    return walletState;
  }
  
  /**
   * Checks if wallet state is stale and needs refreshing
   */
  private isWalletStateStale(walletAddress: string): boolean {
    const wallet = this.wallets.get(walletAddress);
    if (!wallet) return true;
    
    const now = new Date();
    const timeDiff = now.getTime() - wallet.lastUpdated.getTime();
    return timeDiff > this.WALLET_CACHE_TTL;
  }

  /**
   * Forces a refresh of wallet state regardless of cache
   */
  public async forceRefreshWalletState(walletAddress: string): Promise<WalletState> {
    if (this.wallets.has(walletAddress)) {
      this.wallets.delete(walletAddress);
    }
    return this.updateWalletState(walletAddress);
  }

  /**
   * Adds or updates a trade preference and updates wanted NFT index
   */
  public async addTradePreference(walletAddress: string, desiredNft: string): Promise<void> {
    const operation = this.logger.operation('addTradePreference');
    operation.info(`Adding trade preference`, { wallet: walletAddress, nft: desiredNft });
    
    // Validate wallet address format
    if (!isValidSolanaWalletAddress(walletAddress)) {
      const error = `Invalid Solana wallet address format: ${walletAddress}`;
      operation.error(error);
      throw new Error(error);
    }
    
    // Validate NFT address format
    if (!isValidNftAddress(desiredNft)) {
      const error = `Invalid NFT address format: ${desiredNft}`;
      operation.error(error);
      throw new Error(error);
    }
    
    // Get or create wallet state
    const wallet = this.wallets.get(walletAddress) || {
      address: walletAddress,
      ownedNfts: new Set<string>(),
      wantedNfts: new Set<string>(),
      lastUpdated: new Date()
    };
    
    // Normalize NFT address to prevent case sensitivity issues
    const normalizedNftAddress = desiredNft.trim();
    
    // Add to wanted NFTs
    wallet.wantedNfts.add(normalizedNftAddress);
    
    // Add the wallet to the NFT's wanters list for lookup
    // Safely initialize and update wanters Set
    if (!this.wantedNfts) {
      this.wantedNfts = new Map<string, Set<string>>();
    }
    
    let wanters = this.wantedNfts.get(normalizedNftAddress);
    if (!wanters) {
      wanters = new Set<string>();
      this.wantedNfts.set(normalizedNftAddress, wanters);
    }
    wanters.add(walletAddress);
    
    // Update the wallet in the main map
    this.wallets.set(walletAddress, wallet);
    
    // Update metrics for this NFT
    this.updateNftDemandMetrics(normalizedNftAddress);
    
    // Safely reference wanters size
    const wantersSize = wanters ? wanters.size : 0;
    
    // Log that we've updated the preferences
    operation.info(`Updated trade preference`, { 
      wallet: walletAddress, 
      nft: normalizedNftAddress,
      wantersCount: wantersSize
    });
    
    // Save the updated state
    await this.saveStateToPersistence();
    
    operation.end();
  }

  /**
   * Updates NFT demand metrics
   */
  private updateNftDemandMetrics(nft: string): void {
    // Ensure nftDemandMetrics is always initialized as a Map
    if (!this.nftDemandMetrics) {
      this.nftDemandMetrics = new Map<string, NFTDemandMetrics>();
      this.logger.info('Initialized nftDemandMetrics as new Map');
    } else if (!(this.nftDemandMetrics instanceof Map)) {
      // Convert from object to Map if needed
      this.logger.info('Converting nftDemandMetrics from object to Map');
      this.nftDemandMetrics = new Map(Object.entries(this.nftDemandMetrics || {}));
    }
    
    // Get current metrics if they exist
    const existing = this.nftDemandMetrics.get(nft);
    
    // Calculate how many wallets want this NFT
    const wantCount = this.wantedNfts.get(nft)?.size || 0;
    
    // Calculate how many instances of this NFT exist
    const supplyCount = this.nftOwnership.has(nft) ? 1 : 0;
    
    // Always use a proper Date object for lastRequested
    const now = new Date();
    
    // Create or update metrics
    if (existing) {
      this.nftDemandMetrics.set(nft, {
        ...existing,
        wantCount: wantCount,
        supplyCount,
        demandRatio: supplyCount > 0 ? wantCount / supplyCount : 0,
        lastRequested: now // Always set a fresh Date object
      });
    } else {
      this.nftDemandMetrics.set(nft, {
        wantCount,
        supplyCount,
        demandRatio: supplyCount > 0 ? wantCount / supplyCount : 0,
        requestCount: 1, // Start at 1 for a new request
        lastRequested: now, // Always a proper Date object
        mint: nft
      });
    }
  }

  /**
   * Rejects a trade by recording that the user doesn't want a specific NFT
   */
  public async rejectTrade(walletAddress: string, rejectedNftAddress: string): Promise<void> {
    const operation = this.logger.operation('rejectTrade');
    operation.info(`Rejecting trade`, { wallet: walletAddress, nft: rejectedNftAddress });

    // Ensure rejectionPreferences is initialized
    if (!this.rejectionPreferences) {
      this.rejectionPreferences = new Map<string, RejectionPreferences>();
    }

    // Initialize rejection preferences for this wallet if it doesn't exist
    if (!this.rejectionPreferences.has(walletAddress)) {
      this.rejectionPreferences.set(walletAddress, {
        wallets: new Set<string>(),
        nfts: new Set<string>()
      });
    }
    
    // Add to rejected NFTs for this wallet
    const preferences = this.rejectionPreferences.get(walletAddress);
    if (preferences) {
      // Ensure nfts Set is initialized
      if (!preferences.nfts) {
        preferences.nfts = new Set<string>();
      }
      preferences.nfts.add(rejectedNftAddress);
    }
    
    // If this was in the user's wanted NFTs, remove it
    const walletState = this.wallets.get(walletAddress);
    if (walletState && walletState.wantedNfts && walletState.wantedNfts.has(rejectedNftAddress)) {
      // Remove from wallet's wanted NFTs
      walletState.wantedNfts.delete(rejectedNftAddress);
      
      // Remove from global wanted NFTs index
      const wanters = this.wantedNfts.get(rejectedNftAddress);
      if (wanters) {
        wanters.delete(walletAddress);
        if (wanters.size === 0) {
          this.wantedNfts.delete(rejectedNftAddress);
        }
      }
      
      operation.info(`Removed from wanted NFTs`, { wallet: walletAddress, nft: rejectedNftAddress });
    }
    
    // Safely access preferences.nfts size
    const totalRejections = preferences?.nfts?.size || 0;
    
    operation.info(`Trade rejection recorded`, { 
      wallet: walletAddress, 
      nft: rejectedNftAddress,
      totalRejections
    });
    
    // Save state to persistence
    await this.saveStateToPersistence();
    
    operation.end();
  }

  /**
   * Add method to check system state
   */
  public getSystemState(): { wallets: number; nfts: number; wanted: number } {
    return {
      wallets: this.wallets.size,
      nfts: this.nftOwnership.size,
      wanted: this.wantedNfts.size
    };
  }

  /**
   * Add method to clear state
   */
  public async clearState(): Promise<void> {
    const operation = this.logger.operation('clearState');
    operation.info('Clearing trade discovery state');
    
    // Clear in-memory maps first
    await this.walletsMutex.runExclusive(() => this.wallets.clear());
    await this.nftOwnershipMutex.runExclusive(() => this.nftOwnership.clear());
    await this.wantedNftsMutex.runExclusive(() => this.wantedNfts.clear());
    await this.completedStepsMutex.runExclusive(() => this.completedSteps.clear());
    await this.manualNftRegistryMutex.runExclusive(() => this.manualNftRegistry.clear());
    await this.rejectionPreferencesMutex.runExclusive(() => this.rejectionPreferences.clear());
    await this.nftDemandMetricsMutex.runExclusive(() => this.nftDemandMetrics.clear());
    await this.nftValueRecordsMutex.runExclusive(() => this.nftValueRecords.clear());
    
    operation.info('Cleared in-memory state maps');

    // Delete aggregate persistence files
    const keysToDelete = [
      'wallets',
      'nftOwnership',
      'wantedNfts',
      'completedSteps',
      'manualNftRegistry',
      'rejection_preferences',
      'nft_demand_metrics',
      'nft_value_records'
    ];
    
    for (const key of keysToDelete) {
      try {
        await this.persistenceManager.deleteData(key);
      } catch (error) {
        operation.warn(`Error deleting aggregate file ${key}.json`, { error });
      }
    }
    operation.info('Deleted aggregate persistence files');

    // ADDITION: Delete individual trade loop files
    try {
      // Fix: Reconstruct data directory path logic
      const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
      const fs = require('fs').promises; // Use promises version of fs
      const files = await fs.readdir(dataDir);
      
      operation.info(`Found ${files.length} files in data directory`, { dataDir });
      
      let deletedCount = 0;
      for (const file of files) {
        if (file.startsWith('tradeLoop:') && file.endsWith('.json')) {
          try {
            await this.persistenceManager.deleteData(file.replace('.json', ''));
            deletedCount++;
          } catch (deleteError) {
            operation.warn(`Error deleting individual trade loop file: ${file}`, { deleteError });
          }
        }
      }
      operation.info(`Deleted ${deletedCount} individual trade loop files`);
    } catch (error) {
      operation.error('Error reading data directory or deleting trade loop files', { error });
    }

    // ADDITION: Clear/Reset internal state of finder services
    try {
      // Scalable finder has a clear method
      if (this.scalableTradeLoopFinder?.clearCache) { // Optional chaining for safety
        await this.scalableTradeLoopFinder.clearCache();
        operation.info('Cleared cache for ScalableTradeLoopFinderService');
      }

      // Legacy finder - Re-instantiate to clear internal state
      this.legacyTradeLoopFinder = new TradeLoopFinderService(
        this.MAX_DEPTH,
        this.MIN_EFFICIENCY
      );
      operation.info('Re-instantiated Legacy TradeLoopFinderService');

      // Bundle finder - Re-instantiate to clear internal state (if it exists)
      if (this.bundleTradeLoopFinder) { // Check if it was successfully initialized
        try {
           this.bundleTradeLoopFinder = new BundleTradeLoopFinderService();
           operation.info('Re-instantiated BundleTradeLoopFinderService');
        } catch (bundleError) {
            operation.warn('Could not re-instantiate BundleTradeLoopFinderService during clear', { bundleError });
            // Proceed without it if re-instantiation fails
        }
      }

    } catch (resetError) {
       operation.error('Error resetting trade finder services', { resetError });
    }
    
    operation.info('Trade discovery state cleared');
    operation.end();
  }

  /**
   * Gets a stored trade loop by ID
   */
  public async getStoredTradeLoop(tradeId: string): Promise<TradeLoop | null> {
    try {
      const operation = this.logger.operation('getStoredTradeLoop');
      operation.info(`Retrieving trade loop`, { tradeId });
      
      // Load from persistence with type assertion
      const tradeData = await this.persistenceManager.loadData(`tradeLoop:${tradeId}`, null) as any;
      
      if (!tradeData) {
        operation.info(`No data found for trade loop`, { tradeId });
        operation.end();
        return null;
      }
      
      // Ensure the data has the right format
      if (!tradeData.steps || !Array.isArray(tradeData.steps)) {
        operation.error(`Invalid trade data format`, { tradeId });
        operation.end();
        return null;
      }
      
      // Format as TradeLoop type
      const tradeLoop: TradeLoop = {
        id: tradeId,
        steps: tradeData.steps,
        totalParticipants: this.getUniqueParticipants(tradeData.steps).length,
        efficiency: tradeData.efficiency || 1.0,
        rawEfficiency: tradeData.rawEfficiency || tradeData.efficiency || 1.0,
        estimatedValue: tradeData.estimatedValue || this.calculateEstimatedValue(),
        qualityScore: tradeData.qualityScore,
        qualityMetrics: tradeData.qualityMetrics,
        status: tradeData.status || 'pending',
        progress: 0,
        createdAt: tradeData.createdAt ? new Date(tradeData.createdAt) : new Date(),
        completedAt: tradeData.completedAt ? new Date(tradeData.completedAt) : undefined
      };
      
      // Calculate progress
      const completedSteps = tradeData.steps.filter((step: any) => step.completed).length;
      tradeLoop.progress = Math.round((completedSteps / tradeData.steps.length) * 100);
      
      operation.info(`Trade loop retrieved successfully`, { 
        tradeId,
        participants: tradeLoop.totalParticipants,
        steps: tradeLoop.steps.length,
        progress: tradeLoop.progress
      });
      
      operation.end();
      return tradeLoop;
    } catch (error) {
      this.logger.error(`Error retrieving trade loop`, { 
        tradeId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
  
  /**
   * Get unique participants from trade steps
   */
  private getUniqueParticipants(steps: any[]): string[] {
    const participants = new Set<string>();
    
    for (const step of steps) {
      if (step.from) participants.add(step.from);
      if (step.to) participants.add(step.to);
    }
    
    return Array.from(participants);
  }

  /**
   * Store a trade loop for future reference
   * @param tradeId The unique ID of the trade
   * @param steps The steps in the trade loop
   * @param metadata Optional additional metadata about the trade
   */
  public async storeTradeLoop(tradeId: string, steps: any[], metadata?: any): Promise<void> {
    const operation = this.logger.operation('storeTradeLoop');
    operation.info('Storing trade loop', { tradeId, steps: steps.length });
    
    try {
      // Skip persistence if disabled
      const dataDir = this.getPersistenceDirectory();
      const persistenceEnabled = process.env.ENABLE_PERSISTENCE === 'true';
      operation.info('Persistence enabled: ' + persistenceEnabled, { tradeId, dataDir, envValue: process.env.ENABLE_PERSISTENCE });
      
      if (!persistenceEnabled) {
        operation.warn('Persistence is disabled, trade loop not stored', { tradeId });
        return;
      }
      
      // IMPORTANT: Validate ownership in the trade loop before storing
      // This prevents storing invalid trades that can't be executed
      if (!this.validateTradeOwnership(steps)) {
        operation.warn('Trade loop contains invalid ownership, not storing', { tradeId });
        return;
      }
      
      // Create the trade data object
      const tradeData = {
        id: tradeId,
        createdAt: new Date().toISOString(),
        steps,
        // Add any additional metadata if provided
        ...(metadata || {})
      };
      
      // Generate the storage path
      const dataPath = path.join(dataDir, `tradeLoop:${tradeId}.json`);
      
      // Store the data
      await this.persistenceManager.saveData(`tradeLoop:${tradeId}`, tradeData);
      
      // Verify the data was stored
      const dataExists = await this.persistenceManager.loadData(`tradeLoop:${tradeId}`, null) !== null;
      operation.info('Data storage check', { tradeId, stored: dataExists });
      
      if (dataExists) {
        operation.info('Trade loop stored successfully', { tradeId });
      } else {
        operation.error('Trade loop storage failed', { tradeId });
      }
    } catch (error) {
      operation.error('Error storing trade loop', { 
        tradeId,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      operation.end();
    }
  }

  /**
   * Validates that each NFT in a trade is actually owned by the sending wallet
   */
  private validateTradeOwnership(steps: any[]): boolean {
    for (const step of steps) {
      const fromWallet = step.from;
      
      for (const nft of step.nfts) {
        const nftAddress = nft.address;
        
        // Check if the sending wallet actually owns this NFT according to our records
        const actualOwner = this.nftOwnership.get(nftAddress);
        if (actualOwner !== fromWallet) {
          this.logger.warn(`Ownership mismatch: NFT ${nftAddress} is owned by ${actualOwner}, not ${fromWallet}`);
          return false;
        }
        
        // Verify the wallet has this NFT in its owned NFTs list
        const walletState = this.wallets.get(fromWallet);
        if (!walletState || !walletState.ownedNfts.has(nftAddress)) {
          this.logger.warn(`NFT ${nftAddress} is not in owned NFTs list for ${fromWallet}`);
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Prepare a trade loop for smart contract consumption
   */
  public async prepareTradeLoopForContract(tradeId: string): Promise<PreparedTradeData> {
    const operation = this.logger.operation('prepareTradeLoopForContract');
    operation.info(`Preparing trade loop for contract`, { tradeId });
    
    // Load the trade data from persistent storage
    const tradeData = await this.getStoredTradeLoop(tradeId);
    
    if (!tradeData) {
      operation.error(`Trade not found`, { tradeId });
      throw new Error(`Trade ${tradeId} not found`);
    }
    
    // Extract participants and NFTs
    const participants: string[] = [];
    const nfts: string[] = [];
    
    for (const step of tradeData.steps) {
      participants.push(step.from);
      
      // Get first NFT from each step
      if (step.nfts && step.nfts.length > 0) {
        nfts.push(step.nfts[0].address);
      } else {
        operation.error(`Step is missing NFT data`, { tradeId, step });
        throw new Error(`Step is missing NFT data`);
      }
    }
    
    // Add last recipient if there are steps
    if (tradeData.steps.length > 0) {
      const lastStep = tradeData.steps[tradeData.steps.length - 1];
      participants.push(lastStep.to);
    }
    
    // Create serialized representation for on-chain storage
    const serialized = JSON.stringify({
      id: tradeId,
      participants,
      nfts,
      created: Date.now(),
      expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours from now
    });
    
    operation.info(`Trade data prepared for contract`, { 
      tradeId,
      participants: participants.length,
      nfts: nfts.length,
      serializedBytes: Buffer.from(serialized).length
    });
    
    // Check if serialized data fits within Solana account size limits
    const MAX_ACCOUNT_SIZE = 10 * 1024; // 10KB example limit
    if (Buffer.from(serialized).length > MAX_ACCOUNT_SIZE) {
      operation.warn('Serialized trade data exceeds recommended account size limit', {
        tradeId,
        size: Buffer.from(serialized).length,
        maxSize: MAX_ACCOUNT_SIZE
      });
    }
    
    operation.end();
    return {
      participants,
      nfts,
      serialized
    };
  }

  /**
   * Manually register NFTs for a wallet when API doesn't find them
   */
  public registerManualNFTs(walletAddress: string, nftAddresses: string[]): void {
    const operation = this.logger.operation('registerManualNFTs');
    operation.info(`Manually registering NFTs`, { wallet: walletAddress, nfts: nftAddresses.length });
    
    // Update the manual registry
    this.manualNftRegistry.set(walletAddress, nftAddresses);
    
    // Save state to persistence
    this.saveStateToPersistence();
    
    // Update wallet state to include these NFTs
    this.forceRefreshWalletState(walletAddress);
    
    operation.info(`Manual NFTs registered`, { wallet: walletAddress, nfts: nftAddresses.length });
    operation.end();
  }

  /**
   * Calculate estimated value of a trade loop
   */
  private calculateEstimatedValue(): number {
    // Calculate based on NFT value records
    const baseValue = 0.05; // Base value in SOL
    // Return a more realistic value based on average floor prices
    return this.nftValueRecords.size > 0
      ? Array.from(this.nftValueRecords.values()).reduce((sum, record) => sum + record.estimatedValue, 0) / 
        this.nftValueRecords.size
      : baseValue;
  }

  /**
   * Loads the persisted trade state from disk
   */
  private async loadStateFromPersistence(): Promise<void> {
    const operation = this.logger.operation('loadStateFromPersistence');
    operation.info('Loading trade state from persistence');
    
    if (!this.persistenceManager.getIsEnabled()) {
      operation.info('Persistence is disabled, skipping load');
      operation.end();
      return;
    }
    
    try {
      // Load wallets with default to empty object
      const persistedWallets = await this.persistenceManager.loadData<Record<string, any>>(
        'wallets',
        {}
      );
      
      if (persistedWallets && Object.keys(persistedWallets).length > 0) {
        // Convert from object to Map and reconstruct Set objects
        this.wallets = new Map();
        for (const [address, state] of Object.entries(persistedWallets)) {
          this.wallets.set(address, {
            ...state,
            ownedNfts: new Set(state.ownedNfts || []),
            wantedNfts: new Set(state.wantedNfts || []),
            wantedCollections: new Set(state.wantedCollections || []),
            lastUpdated: state.lastUpdated ? new Date(state.lastUpdated) : new Date()
          });
        }
        operation.info(`Loaded wallets`, { count: this.wallets.size });
      }
      
      // Load NFT ownership
      const persistedNftOwnership = await this.persistenceManager.loadData<Record<string, string>>(
        'nftOwnership',
        {}
      );
      
      if (persistedNftOwnership && Object.keys(persistedNftOwnership).length > 0) {
        // Convert from object to Map
        this.nftOwnership = new Map(Object.entries(persistedNftOwnership));
        operation.info(`Loaded NFT ownership records`, { count: this.nftOwnership.size });
      }
      
      // Load wanted NFTs
      const persistedWantedNfts = await this.persistenceManager.loadData<Record<string, string[]>>(
        'wantedNfts',
        {}
      );
      
      if (persistedWantedNfts && Object.keys(persistedWantedNfts).length > 0) {
        // Convert from object to Map and reconstruct Set objects
        this.wantedNfts = new Map();
        for (const [nft, wallets] of Object.entries(persistedWantedNfts)) {
          this.wantedNfts.set(nft, new Set(wallets as string[]));
        }
        operation.info(`Loaded wanted NFT records`, { count: this.wantedNfts.size });
      }

      // CRITICAL FIX: Rebuild wantedNfts mapping from wallet states to ensure synchronization
      await this.rebuildWantedNftsMapping();
      
      // Load manual NFT registry
      const persistedManualRegistry = await this.persistenceManager.loadData<Record<string, string[]>>(
        'manualNftRegistry',
        {}
      );
      
      if (persistedManualRegistry && Object.keys(persistedManualRegistry).length > 0) {
        this.manualNftRegistry = new Map(Object.entries(persistedManualRegistry));
        operation.info(`Loaded manual NFT registry entries`, { count: this.manualNftRegistry.size });
      }
      
      // Load rejection preferences
      const rejectionPreferencesData = await this.persistenceManager.loadData<Record<string, any>>(
        'rejection_preferences', 
        {}
      );
      
      if (rejectionPreferencesData && Object.keys(rejectionPreferencesData).length > 0) {
        this.rejectionPreferences = new Map();
        for (const [wallet, prefs] of Object.entries(rejectionPreferencesData)) {
          this.rejectionPreferences.set(wallet, {
            wallets: new Set(prefs.wallets || []),
            nfts: new Set(prefs.nfts || [])
          });
        }
        operation.info(`Loaded rejection preference records`, { count: this.rejectionPreferences.size });
      }
      
      // Load NFT demand metrics
      const nftDemandMetricsData = await this.persistenceManager.loadData<Record<string, any>>(
        'nft_demand_metrics',
        {}
      );
      
      if (nftDemandMetricsData && Object.keys(nftDemandMetricsData).length > 0) {
        this.nftDemandMetrics = new Map(Object.entries(nftDemandMetricsData));
        operation.info(`Loaded NFT demand metric records`, { count: this.nftDemandMetrics.size });
      }
      
      // Load NFT value records
      const nftValueRecordsData = await this.persistenceManager.loadData<Record<string, any>>(
        'nft_value_records',
        {}
      );
      
      if (nftValueRecordsData && Object.keys(nftValueRecordsData).length > 0) {
        this.nftValueRecords = new Map(Object.entries(nftValueRecordsData));
        operation.info(`Loaded NFT value records`, { count: this.nftValueRecords.size });
      }
      
      operation.info('Trade state loaded from persistence');
      operation.end();
    } catch (error) {
      operation.error('Error loading trade state from persistence', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      operation.end();
      throw error;
    }
  }

  /**
   * CRITICAL FIX: Rebuild the wantedNfts reverse mapping from wallet states
   * This ensures data synchronization between the wallets Map and wantedNfts Map
   */
  private async rebuildWantedNftsMapping(): Promise<void> {
    const operation = this.logger.operation('rebuildWantedNftsMapping');
    operation.info('Rebuilding wantedNfts mapping from wallet states');
    
    // Clear existing mapping
    this.wantedNfts.clear();
    
    let totalWants = 0;
    let walletsProcessed = 0;
    
    // Rebuild from each wallet's wanted NFTs
    for (const [walletAddress, walletState] of this.wallets.entries()) {
      if (!walletState.wantedNfts || walletState.wantedNfts.size === 0) {
        continue;
      }
      
      walletsProcessed++;
      
      for (const nftAddress of walletState.wantedNfts) {
        // Get or create the Set of wallets that want this NFT
        let wanters = this.wantedNfts.get(nftAddress);
        if (!wanters) {
          wanters = new Set<string>();
          this.wantedNfts.set(nftAddress, wanters);
        }
        
        // Add this wallet to the wanters
        wanters.add(walletAddress);
        totalWants++;
      }
    }
    
    operation.info('WantedNfts mapping rebuilt', {
      walletsProcessed,
      totalWants,
      uniqueNftsWanted: this.wantedNfts.size
    });
    
    // Log critical edges for debugging
    const criticalNfts = [
      'DGPXMa22xFTs6N9fiCxozJnCCEFuDA4sE555JdtckBRH',
      '4iCQftmw9EouFsDQabdqEzc6tysSMagyNSWrHusWibAk',
      '6K87VYDnPrhefPjBnEdi9hUfC9fr3W8qDbGnMKnyoGvP'
    ];
    
    for (const nft of criticalNfts) {
      const wanters = this.wantedNfts.get(nft);
      if (wanters && wanters.size > 0) {
        operation.info('FIXED: Critical NFT now has wanters', {
          nft: nft.substring(0, 8) + '...',
          wanters: Array.from(wanters).map(w => w.substring(0, 8) + '...'),
          wanterCount: wanters.size
        });
      }
    }
    
    operation.end();
  }

  /**
   * Force rebuild wantedNfts mapping (public method for debugging)
   */
  public async forceRebuildWantedNftsMapping(): Promise<void> {
    await this.rebuildWantedNftsMapping();
  }
  
  /**
   * Saves the current system state to persistent storage
   */
  private async saveStateToPersistence(): Promise<void> {
    const operation = this.logger.operation('saveStateToPersistence');
    operation.info('Saving trade state to persistence');
    
    // Check if persistence is explicitly enabled
    if (!this.persistenceManager.getIsEnabled()) {
      operation.info('Persistence is disabled, skipping save');
      operation.end();
      return;
    }
    
    try {
      // Convert wallets Map to serializable format
      const walletsMap: Record<string, any> = {};
      for (const [address, state] of this.wallets.entries()) {
        walletsMap[address] = {
          ...state,
          ownedNfts: Array.from(state.ownedNfts),
          wantedNfts: Array.from(state.wantedNfts)
        };
      }
      await this.persistenceManager.saveData('wallets', walletsMap);
      
      // Convert NFT ownership Map to serializable format
      const ownershipMap: Record<string, string> = {};
      for (const [nft, wallet] of this.nftOwnership.entries()) {
        ownershipMap[nft] = wallet;
      }
      await this.persistenceManager.saveData('nftOwnership', ownershipMap);
      
      // Convert wanted NFTs Map to serializable format
      const wantedNftsMap: Record<string, string[]> = {};
      for (const [nft, wallets] of this.wantedNfts.entries()) {
        wantedNftsMap[nft] = Array.from(wallets);
      }
      await this.persistenceManager.saveData('wantedNfts', wantedNftsMap);
      
      // Convert completed steps Map to serializable format
      const completedStepsMap: Record<string, any> = {};
      for (const [id, step] of this.completedSteps.entries()) {
        completedStepsMap[id] = step;
      }
      await this.persistenceManager.saveData('completedSteps', completedStepsMap);
      
      // Save rejection preferences
      const rejectionPreferencesMap: Record<string, any> = {};
      for (const [address, preferences] of this.rejectionPreferences.entries()) {
        rejectionPreferencesMap[address] = {
          wallets: Array.from(preferences.wallets),
          nfts: Array.from(preferences.nfts)
        };
      }
      await this.persistenceManager.saveData('rejection_preferences', rejectionPreferencesMap);
      
      // Save NFT demand metrics
      const demandMetricsMap: Record<string, NFTDemandMetrics> = {};
      for (const [nft, metrics] of this.nftDemandMetrics.entries()) {
        demandMetricsMap[nft] = metrics;
      }
      await this.persistenceManager.saveData('nft_demand_metrics', demandMetricsMap);
      
      // Save NFT value records
      const valueRecordsMap: Record<string, NFTValueRecord> = {};
      for (const [nft, record] of this.nftValueRecords.entries()) {
        valueRecordsMap[nft] = record;
      }
      await this.persistenceManager.saveData('nft_value_records', valueRecordsMap);
      
      operation.info('Trade state saved to persistence');
    } catch (error) {
      operation.error('Error saving trade state to persistence', { 
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    operation.end();
  }

  /**
   * Checks if a wallet exists in the system
   */
  public walletExists(walletAddress: string): boolean {
    return this.wallets.has(walletAddress);
  }

  /**
   * Get trades that involve a specific wallet
   */
  public async getTradesForWallet(walletAddress: string): Promise<TradeLoop[]> {
    try {
      const operation = this.logger.operation('getTradesForWallet');
      operation.info(`Finding trades for wallet`, { wallet: walletAddress });
      
      // Verify the wallet exists in our system
      if (!this.wallets.has(walletAddress)) {
        operation.info(`Wallet not found, loading wallet data`, { wallet: walletAddress });
        await this.updateWalletState(walletAddress, true);
        
        // Check if we loaded the wallet successfully
        if (!this.wallets.has(walletAddress)) {
          operation.warn(`Could not load wallet`, { wallet: walletAddress });
          operation.end();
          return [];
        }
      }
      
      // STEP 1: First check if we have any stored trades for this wallet
      // so we don't have to recalculate everything
      operation.info(`Checking for stored trades for wallet`, { wallet: walletAddress });
      
      // Get all trade keys from persistence
      const allTradeKeys = await this.getAllTradeKeys();
      let storedTrades: TradeLoop[] = [];
      
      // If we have any trade keys, check if any involve this wallet
      if (allTradeKeys.length > 0) {
        operation.info(`Found ${allTradeKeys.length} potential stored trades to check`, { wallet: walletAddress });
        
        // Load each trade and check if it involves this wallet
        for (const key of allTradeKeys) {
          try {
            // Extract the trade ID from the key (remove the 'tradeLoop:' prefix)
            const tradeId = key.replace('tradeLoop:', '');
            const trade = await this.getStoredTradeLoop(tradeId);
            
            // If we found the trade and it involves this wallet, add it to the list
            if (trade && trade.steps.some(step => step.from === walletAddress || step.to === walletAddress)) {
              storedTrades.push(trade);
            }
          } catch (error) {
            operation.warn(`Error loading stored trade ${key}`, { 
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        
        operation.info(`Found ${storedTrades.length} stored trades involving wallet`, { wallet: walletAddress });
      }
      
      // STEP 2: If we don't have any stored trades, or we want fresh data,
      // calculate trades using a trade loop finder implementation
      let calculatedTrades: TradeLoop[] = [];
      
      // Define strategies for finding trades for a specific wallet
      interface WalletTradeFinderStrategy {
        name: string;
        findTradesForWallet: () => Promise<TradeLoop[]>;
      }

      // Create array of strategies in order of preference
      const strategies: WalletTradeFinderStrategy[] = [];
      
      // If bundle trades are enabled and available, use that first
      const enableBundleTrades = process.env.ENABLE_BUNDLE_TRADES === 'true';
      if (enableBundleTrades && this.bundleTradeLoopFinder !== undefined) {
        strategies.push({
          name: 'bundle',
          findTradesForWallet: async () => {
            operation.info(`Using bundle implementation for wallet trades`, { wallet: walletAddress });
            // First find all trades, then filter for this wallet
            const allTrades = await this.bundleTradeLoopFinder.findAllTradeLoops(
              this.wallets,
              this.nftOwnership,
              this.wantedNfts,
              this.rejectionPreferences
            );
            
            // Filter for trades involving this wallet
            return allTrades.filter(trade => 
              trade.steps.some(step => step.from === walletAddress || step.to === walletAddress)
            );
          }
        });
      }
      
      // Add scalable implementation strategy
      const forceScalable = process.env.FORCE_SCALABLE_IMPLEMENTATION === 'true';
      const largeDataset = this.wallets.size > 100;
      if (forceScalable || largeDataset) {
        strategies.push({
          name: 'scalable',
          findTradesForWallet: async () => {
            operation.info(`Using scalable implementation for wallet trades`, { wallet: walletAddress });
            // The scalable implementation has a specific method for finding trades for a wallet
            return this.scalableTradeLoopFinder.findTradeLoopsForWallet(
              walletAddress,
              this.wallets,
              this.nftOwnership,
              this.wantedNfts,
              this.rejectionPreferences
            );
          }
        });
      }
      
      // Always add legacy as fallback
      strategies.push({
        name: 'legacy',
        findTradesForWallet: async () => {
          operation.info(`Using legacy implementation for wallet trades`, { wallet: walletAddress });
          // First find all trades, then filter for this wallet
          const allTrades = await this.legacyTradeLoopFinder.findAllTradeLoops(
            this.wallets,
            this.nftOwnership,
            this.wantedNfts,
            this.rejectionPreferences
          );
          
          // Filter for trades involving this wallet
          return allTrades.filter(trade => 
            trade.steps.some(step => step.from === walletAddress || step.to === walletAddress)
          );
        }
      });
      
      // Try strategies in order until one succeeds
      for (const strategy of strategies) {
        try {
          calculatedTrades = await strategy.findTradesForWallet();
          if (calculatedTrades.length > 0) {
            operation.info(`Found ${calculatedTrades.length} trades for wallet using ${strategy.name} implementation`, 
              { wallet: walletAddress });
            break;
          } else {
            operation.info(`No trades found with ${strategy.name} implementation, trying next strategy`, 
              { wallet: walletAddress });
          }
        } catch (error) {
          operation.warn(`Error finding trades with ${strategy.name} implementation`, { 
            wallet: walletAddress,
            error: error instanceof Error ? error.message : String(error)
          });
          // Continue to next strategy
        }
      }
      
      // STEP 3: Combine stored and calculated trades, eliminating duplicates
      let combinedTrades: TradeLoop[] = [...storedTrades];
      
      // Add calculated trades that aren't already in stored trades
      for (const calcTrade of calculatedTrades) {
        const isDuplicate = combinedTrades.some(storedTrade => storedTrade.id === calcTrade.id);
        if (!isDuplicate) {
          combinedTrades.push(calcTrade);
          
          // Also store this newly calculated trade for future use
          try {
            await this.storeTradeLoop(calcTrade.id, calcTrade.steps);
            operation.info(`Stored new calculated trade for future retrieval`, { tradeId: calcTrade.id });
          } catch (error) {
            operation.warn(`Error storing calculated trade`, { 
              tradeId: calcTrade.id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }
      
      // Score the trades with the trade score service
      const scoredTrades = combinedTrades.map(trade => {
        const scoreResult = this.tradeScoreService.calculateTradeScore(trade, this.nftDemandMetrics);
        
        // Store the original efficiency value for reference
        const originalEfficiency = trade.efficiency;
        
        return {
          ...trade,
          rawEfficiency: originalEfficiency,
          efficiency: scoreResult.score,
          qualityScore: scoreResult.score,
          qualityMetrics: scoreResult.metrics
        };
      });
      
      // Sort by score (final weighted score)
      scoredTrades.sort((a, b) => b.efficiency - a.efficiency);
      
      operation.info(`Found trades for wallet`, { 
        wallet: walletAddress,
        tradesFound: scoredTrades.length, // This should be scoredTrades.length before any further slicing if it were to happen here
        fromStorage: storedTrades.length,
        fromCalculation: calculatedTrades.length
      });
      
      operation.end();
      return scoredTrades; // Return all scored trades for this wallet, controller will handle display limits
    } catch (error) {
      this.logger.error(`Error finding trades for wallet`, { 
        wallet: walletAddress,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
  
  /**
   * Get NFT demand metrics for a specific NFT
   */
  public getNFTDemandMetrics(nftAddress: string): NFTDemandMetrics | undefined {
    return this.nftDemandMetrics.get(nftAddress);
  }
  
  /**
   * Get all NFT demand metrics
   */
  public getAllNFTDemandMetrics(): Map<string, NFTDemandMetrics> {
    return this.nftDemandMetrics;
  }
  
  /**
   * Update NFT value record with latest price estimate
   */
  public async updateNFTValueRecord(nftAddress: string, estimatedValue: number): Promise<void> {
    this.nftValueRecords.set(nftAddress, {
      mint: nftAddress,
      estimatedValue,
      lastUpdated: new Date()
    });
    
    // Save to persistence to keep value records up to date
    await this.saveStateToPersistence();
  }
  
  /**
   * Get all available NFT value records
   */
  public getNFTValueRecords(): Map<string, NFTValueRecord> {
    return this.nftValueRecords;
  }

  /**
   * Gets the NFT ownership map
   * This is used for validating trade steps in the TradeController
   */
  public getNFTOwnershipMap(): Record<string, string> {
    // Convert Map to Record object
    const ownershipRecord: Record<string, string> = {};
    
    for (const [nftAddress, walletAddress] of this.nftOwnership.entries()) {
      ownershipRecord[nftAddress] = walletAddress;
    }
    
    return ownershipRecord;
  }

  /**
   * Get all trade keys from persistence
   * This is used by several API endpoints to fetch trade loops
   */
  public async getAllTradeKeys(): Promise<string[]> {
    try {
      const operation = this.logger.operation('getAllTradeKeys');
      operation.info('Fetching all trade loop keys');
      
      // Use the persistence manager to list all keys with the tradeLoop: prefix
      const allKeys = await this.persistenceManager.listKeys('tradeLoop:');
      
      operation.info(`Found ${allKeys.length} trade loop keys`);
      operation.end();
      
      return allKeys;
    } catch (error) {
      this.logger.error('Error fetching trade loop keys', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Perform a deep scan of wallet NFTs with additional metadata
   * This is called from the TradeController's deepScanWallet endpoint
   */
  public async deepScanWalletNFTs(walletAddress: string): Promise<any> {
    try {
      const operation = this.logger.operation('deepScanWalletNFTs');
      operation.info('Starting deep wallet scan', { wallet: walletAddress });
      
      // BREAKING THE RECURSION CYCLE: Use walletService directly instead of going through forceRefreshWalletState
      // This prevents the circular dependency with updateWalletState
      const walletNftsArray = await this.walletService.getWalletNFTs(walletAddress);
      
      // Update the wallet state directly with the NFTs we found
      let walletState = this.wallets.get(walletAddress);
      if (!walletState) {
        // Create a new wallet state
        walletState = {
          address: walletAddress,
          ownedNfts: new Set<string>(walletNftsArray),
          wantedNfts: new Set<string>(),
          lastUpdated: new Date()
        };
        this.wallets.set(walletAddress, walletState);
      } else {
        // Update existing wallet state with the NFTs
        walletState.ownedNfts = new Set<string>(walletNftsArray);
        walletState.lastUpdated = new Date();
      }
      
      // Update the NFT ownership map
      for (const nftAddress of walletNftsArray) {
        this.nftOwnership.set(nftAddress, walletAddress);
      }
      
      // Get NFT metadata for each owned NFT
      const nfts = [];
      const errors = [];
      let processed = 0;
      
      for (const nftAddress of walletState.ownedNfts) {
        try {
          // Get metadata using NFT service
          const metadata = await this.nftPricingService.getNFTMetadata(nftAddress);
          
          // Add pricing data if available
          let priceInfo = null;
          try {
            priceInfo = await this.nftPricingService.getNFTPriceEstimate(nftAddress);
          } catch (priceError) {
            operation.warn('Error getting price info', { 
              nft: nftAddress,
              error: priceError instanceof Error ? priceError.message : String(priceError)
            });
          }
          
          // Add demand metrics
          const demandMetrics = this.getNFTDemandMetrics(nftAddress);
          
          // Combine all data
          nfts.push({
            ...metadata,
            price: priceInfo,
            demandMetrics
          });
          
          processed++;
          if (processed % 10 === 0) {
            operation.info(`Processed ${processed} NFTs so far for wallet ${walletAddress}`);
          }
        } catch (error) {
          operation.error('Error processing NFT', { 
            nft: nftAddress,
            error: error instanceof Error ? error.message : String(error)
          });
          errors.push({
            nft: nftAddress,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      // Determine potential trades with these NFTs
      let potentialTrades = 0;
      for (const nftAddress of walletState.ownedNfts) {
        const wanters = this.wantedNfts.get(nftAddress);
        if (wanters && wanters.size > 0) {
          potentialTrades += wanters.size;
        }
      }
      
      const result = {
        wallet: walletAddress,
        nftsFound: walletState.ownedNfts.size,
        nftsProcessed: nfts.length,
        errors: errors.length,
        potentialTrades,
        nfts,
        errorDetails: errors
      };
      
      operation.info('Deep wallet scan completed', { 
        wallet: walletAddress,
        nftsFound: walletState.ownedNfts.size,
        nftsProcessed: nfts.length,
        errors: errors.length
      });
      operation.end();
      
      return result;
    } catch (error) {
      this.logger.error('Error performing deep wallet scan', { 
        wallet: walletAddress,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  private getPersistenceDirectory(): string {
    return process.env.DATA_DIR || 'default';
  }

  // Inside the registerWantedNFT method where an edge is added to the graph
  public registerWantedNFT(walletAddress: string, nftAddress: string): void {
    const releaseMutex = this.wantedNftsMutex.acquire();
    try {
      // Check if the wallet owns this NFT
      const ownerWallet = this.nftOwnership.get(nftAddress);
      
      // Don't allow a wallet to want an NFT it already owns
      if (ownerWallet === walletAddress) {
        this.logger.warn(`Wallet cannot want an NFT it already owns`, { 
          wallet: walletAddress, 
          nft: nftAddress 
        });
        return;
      }
      
      // Add to wanted NFTs
      if (!this.wantedNfts.has(nftAddress)) {
        this.wantedNfts.set(nftAddress, new Set<string>());
      }
      
      this.wantedNfts.get(nftAddress)!.add(walletAddress);
      
      // Add to wallet's wanted NFTs
      let walletState = this.wallets.get(walletAddress);
      if (!walletState) {
        walletState = {
          address: walletAddress,
          ownedNfts: new Set<string>(),
          wantedNfts: new Set<string>(),
          lastUpdated: new Date()
        };
        this.wallets.set(walletAddress, walletState);
      }
      
      walletState.wantedNfts.add(nftAddress);
      
      // Log the want edge for debugging
      this.logger.info(`Added want edge: ${walletAddress} wants ${nftAddress}`, {
        walletAddress: walletAddress.substring(0, 8),
        nftAddress: nftAddress.substring(0, 8)
      });
      
      // Special logging for our test case addresses
      if (walletAddress === '5pPCbuGso6NguFBWAqaKm7FW9msRoLQQoWu7kawGfFna' || 
          walletAddress === 'NHLeTzVE1BriRr3Uuebyq1aKEjRvWFMozy2BDAuLN2m' || 
          walletAddress === '52sLrTRsiVrVyxSL8r1rpbJmjtcbQER9QgeiykViUgC8') {
        
        // Check if this is one of our critical NFTs
        if (nftAddress === 'CaE8oUsYRCvRByMYBRrg7vjaaSa4fbHSwXKEdBj8EKNf' || 
            nftAddress === 'ABiGDshndLxs935LEyx5YJ6SrkeMLEBwCmtDtfFcck1W' || 
            nftAddress === 'G7yWHtUEfZgocWwzwChPMXnP91HUXJ2V2GnqUiovkHgs') {
          
          this.logger.info(`TEST CASE: Added critical edge: ${walletAddress} wants ${nftAddress}`);
        }
      }
      
      // Update NFT demand metrics
      this.updateNftDemandMetrics(nftAddress);
      
      // Save this change to persistence
      this.saveStateToPersistence().catch(error => {
        this.logger.error('Error saving state after registering wanted NFT', {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    } finally {
      releaseMutex.then(release => release());
    }
  }

  /**
   * Build a map of collection-level wants from wallet states
   */
  private async buildCollectionWantsMap(): Promise<Map<string, Set<string>>> {
    const collectionWants = new Map<string, Set<string>>();
    
    for (const [walletAddress, walletState] of this.wallets) {
      if (walletState.wantedCollections && walletState.wantedCollections.size > 0) {
        collectionWants.set(walletAddress, new Set(walletState.wantedCollections));
      }
    }
    
    return collectionWants;
  }

  /**
   * Add a collection-level want preference
   */
  public async addCollectionWant(
    walletAddress: string,
    collectionId: string
  ): Promise<void> {
    const operation = this.logger.operation('addCollectionWant');
    operation.info('Adding collection want', { wallet: walletAddress, collection: collectionId });
    
    // Validate collection ID
    if (!collectionId || collectionId.trim().length === 0) {
      throw new Error('Invalid collection ID');
    }
    
    // TEST MODE: Skip heavy wallet updates for faster testing
    const testMode = process.env.COLLECTION_WANTS_TEST_MODE === 'true';
    
    // Acquire mutex for wallet updates
    const releaseMutex = this.walletsMutex.acquire();
    
    try {
      await releaseMutex;
      
      // Get or create wallet state - lightweight for test mode
      let walletState = this.wallets.get(walletAddress);
      if (!walletState) {
        if (testMode) {
          // Create minimal wallet state for testing
          walletState = {
            address: walletAddress,
            ownedNfts: new Set<string>(),
            wantedNfts: new Set<string>(),
            wantedCollections: new Set<string>(),
            lastUpdated: new Date()
          };
          this.wallets.set(walletAddress, walletState);
          operation.info('Created minimal wallet state for test mode', { wallet: walletAddress });
        } else {
          // Full wallet state update (original behavior)
          walletState = await this.updateWalletState(walletAddress);
        }
      }
      
      // Double-check walletState exists after updateWalletState
      if (!walletState) {
        throw new Error(`Failed to create or retrieve wallet state for ${walletAddress}`);
      }
      
      // Initialize collection wants if needed
      if (!walletState.wantedCollections) {
        walletState.wantedCollections = new Set();
      }
      
      // Check if collection is already wanted
      if (walletState.wantedCollections.has(collectionId)) {
        operation.info('Collection already in wants', {
          wallet: walletAddress,
          collection: collectionId
        });
        operation.end();
        return;
      }
      
      // Validate against collection limits
      const validation = this.collectionConfigService.validateCollectionWant(
        walletAddress,
        walletState.wantedCollections.size
      );
      
      if (!validation.valid) {
        operation.error('Collection want validation failed', {
          wallet: walletAddress,
          collection: collectionId,
          reason: validation.reason
        });
        throw new Error(validation.reason);
      }
      
      // Verify collection exists (unless in test mode)
      if (!testMode) {
        const collectionMetadata = this.localCollectionService.getCollectionMetadata(collectionId);
        if (!collectionMetadata) {
          // Try to search for it
          const searchResults = await this.localCollectionService.searchCollections(collectionId, 1);
          if (searchResults.length === 0) {
            operation.warn('Collection not found in database', {
              wallet: walletAddress,
              collection: collectionId
            });
            // We'll still allow it, as it might be a new collection
          }
        }
      }
      
      // Add collection to wants
      walletState.wantedCollections.add(collectionId);
      
      // Update the wallet state map
      this.wallets.set(walletAddress, walletState);
      
      operation.info('Collection want added successfully', {
        wallet: walletAddress,
        collection: collectionId,
        totalCollectionWants: walletState.wantedCollections.size,
        testMode
      });
      operation.end();
      
      // Save state (skip for test mode to avoid additional delays)
      if (!testMode) {
        this.saveStateToPersistence().catch(error => {
          this.logger.error('Error saving state after adding collection want', {
            error: error instanceof Error ? error.message : String(error)
          });
        });
      }
    } finally {
      releaseMutex.then(release => release());
    }
  }

  /**
   * Remove a collection want
   */
  public async removeCollectionWant(
    walletAddress: string,
    collectionId: string
  ): Promise<void> {
    const operation = this.logger.operation('removeCollectionWant');
    operation.info('Removing collection want', { wallet: walletAddress, collection: collectionId });
    
    const releaseMutex = this.walletsMutex.acquire();
    
    try {
      await releaseMutex;
      
      const walletState = this.wallets.get(walletAddress);
      if (!walletState || !walletState.wantedCollections) {
        operation.info('No collection wants found for wallet', { wallet: walletAddress });
        operation.end();
        return;
      }
      
      if (!walletState.wantedCollections.has(collectionId)) {
        operation.info('Collection not in wants', {
          wallet: walletAddress,
          collection: collectionId
        });
        operation.end();
        return;
      }
      
      // Remove the collection want
      walletState.wantedCollections.delete(collectionId);
      
      operation.info('Collection want removed successfully', {
        wallet: walletAddress,
        collection: collectionId,
        remainingWants: walletState.wantedCollections.size
      });
      operation.end();
      
      // Save state
      this.saveStateToPersistence().catch(error => {
        this.logger.error('Error saving state after removing collection want', {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    } finally {
      releaseMutex.then(release => release());
    }
  }

  /**
   * Get collection wants for a wallet
   */
  public getCollectionWants(walletAddress: string): Set<string> {
    const walletState = this.wallets.get(walletAddress);
    return walletState?.wantedCollections || new Set();
  }

  /**
   * Get the collection abstraction service instance
   */
  public getCollectionAbstractionService(): CollectionAbstractionService {
    return this.collectionAbstractionService;
  }

  /**
   * Get system state summary
   */
  public getSystemStateSummary(): { wallets: number; nfts: number; wanted: number } {
    return {
      wallets: this.wallets.size,
      nfts: this.nftOwnership.size,
      wanted: this.wantedNfts.size
    };
  }

  /**
   * Interface method: Find trades for a specific wallet (alias for getTradesForWallet)
   */
  public async findTradesForWallet(walletAddress: string, options?: any): Promise<any[]> {
    return this.getTradesForWallet(walletAddress);
  }

  /**
   * Interface method: Find all possible trade loops (alias for findTradeLoops)
   */
  public async findAllTrades(options?: any): Promise<any[]> {
    return this.findTradeLoops(options);
  }

  /**
   * Get detailed system state
   */
  public getDetailedSystemState(): any {
    const basicState = this.getSystemState();
    
    return {
      ...basicState,
      nftDemandMetrics: Array.from(this.nftDemandMetrics.values()),
      nftValueRecords: Array.from(this.nftValueRecords.values()),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get rejection preferences for a wallet
   */
  public getRejections(walletAddress: string): any {
    return this.rejectionPreferences.get(walletAddress) || null;
  }

  /**
   * Store rejection preferences for a wallet
   */
  public storeRejections(walletAddress: string, rejections: any): void {
    this.rejectionPreferences.set(walletAddress, rejections);
    this.logger.info('Stored rejection preferences', { walletAddress });
  }

  /**
   * Record a completed trade step
   */
  public async recordTradeStepCompletion(tradeId: string, stepIndex: number, completionData: any): Promise<void> {
    this.logger.info('Recording trade step completion', { tradeId, stepIndex });
    // Store the completion data
    const stepKey = `${tradeId}-${stepIndex}`;
    this.completedSteps.set(stepKey, {
      from: completionData.from || '',
      to: completionData.to || '',
      nfts: completionData.nfts || [],
      transactionSignature: completionData.transactionSignature || '',
      timestamp: new Date()
    });
    
    // Save to persistence
    await this.saveStateToPersistence();
  }
}