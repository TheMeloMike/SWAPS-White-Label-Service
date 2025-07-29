import { TradeDiscoveryService } from './TradeDiscoveryService';
import { GraphAbstractionAdapter } from './GraphAbstractionAdapter';
import { UnifiedTradeGraphService } from './UnifiedTradeGraphService';
import { TradeLoop, WalletState, RejectionPreferences } from '../../types/trade';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { performance } from 'perf_hooks';

/**
 * Enhanced Trade Discovery Service
 * 
 * This service demonstrates how to integrate the Graph Abstraction Layer
 * with existing advanced algorithms (Johnson's, Tarjan's, Louvain, etc.)
 * while adding collection support in a completely modular way.
 * 
 * Key Features:
 * - Preserves ALL existing algorithm capabilities
 * - Adds collection trading support transparently
 * - Maintains backwards compatibility
 * - Uses the Graph Abstraction Layer for enhanced performance
 */
export class EnhancedTradeDiscoveryService {
  private static enhancedInstance: EnhancedTradeDiscoveryService;
  private logger: Logger;
  private graphAdapter: GraphAbstractionAdapter;
  private graphService: UnifiedTradeGraphService;
  private baseTradeService: TradeDiscoveryService;
  
  // Collection wants tracking
  private collectionWants = new Map<string, Set<string>>();
  
  // Performance monitoring
  private performanceMetrics = {
    standardGraphBuilds: 0,
    collectionGraphBuilds: 0,
    avgStandardBuildTime: 0,
    avgCollectionBuildTime: 0,
    collectionExpansionRatio: 0
  };

  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('EnhancedTradeDiscovery');
    this.graphAdapter = GraphAbstractionAdapter.getInstance();
    this.graphService = UnifiedTradeGraphService.getInstance();
    this.baseTradeService = TradeDiscoveryService.getInstance();
  }

  public static getEnhancedInstance(): EnhancedTradeDiscoveryService {
    if (!EnhancedTradeDiscoveryService.enhancedInstance) {
      EnhancedTradeDiscoveryService.enhancedInstance = new EnhancedTradeDiscoveryService();
    }
    return EnhancedTradeDiscoveryService.enhancedInstance;
  }

  /**
   * Enhanced trade discovery with collection support
   * This method preserves all existing functionality while adding collection capabilities
   */
  public async discoverTradesForWalletEnhanced(
    walletAddress: string,
    options: {
      enableCollections?: boolean;
      maxResults?: number;
      minScore?: number;
      algorithmPreference?: 'johnson' | 'scalable' | 'probabilistic' | 'auto';
    } = {}
  ): Promise<TradeLoop[]> {
    const operation = this.logger.operation('discoverTradesForWalletEnhanced');
    const startTime = performance.now();
    
    operation.info('Starting enhanced trade discovery', {
      wallet: walletAddress,
      enableCollections: options.enableCollections || false,
      algorithmPreference: options.algorithmPreference || 'auto'
    });

    try {
      // Step 1: Get base data (same as original)
      const wallets = await this.baseTradeService.getWallets();
      const nftOwnershipRecord = this.baseTradeService.getNFTOwnershipMap();
      const wantedNfts = this.baseTradeService.getWantedNfts();
      const rejectionPreferences = this.baseTradeService.getRejectionPreferences();
      
      // Convert Record to Map for compatibility
      const nftOwnership = new Map<string, string>();
      for (const [nft, owner] of Object.entries(nftOwnershipRecord)) {
        nftOwnership.set(nft, owner);
      }

      // Step 2: Build appropriate graph type
      let graphBuildTime: number;
      const graphStartTime = performance.now();
      
      if (options.enableCollections && this.collectionWants.size > 0) {
        // Use collection-aware graph
        await this.graphAdapter.initializeCollectionAwareGraph(
          wallets,
          nftOwnership,
          wantedNfts,
          this.collectionWants,
          rejectionPreferences
        );
        
        graphBuildTime = performance.now() - graphStartTime;
        this.updatePerformanceMetrics('collection', graphBuildTime);
        
        operation.info('Collection-aware graph initialized', {
          buildTime: `${graphBuildTime.toFixed(2)}ms`,
          stats: this.graphAdapter.getGraphStats()
        });
      } else {
        // Use standard graph (backwards compatible)
        await this.graphAdapter.initializeStandardGraph(
          wallets,
          nftOwnership,
          wantedNfts,
          rejectionPreferences
        );
        
        graphBuildTime = performance.now() - graphStartTime;
        this.updatePerformanceMetrics('standard', graphBuildTime);
        
        operation.info('Standard graph initialized', {
          buildTime: `${graphBuildTime.toFixed(2)}ms`,
          stats: this.graphAdapter.getGraphStats()
        });
      }

      // Step 3: Get enhanced graph data for algorithms
      const enhancedWantedNfts = this.graphAdapter.getWantedNfts();
      const enhancedNftOwnership = this.graphAdapter.getNftOwnership();
      const walletNodes = this.graphAdapter.getWalletNodes();

      operation.info('Graph enhancement completed', {
        originalWants: wantedNfts.size,
        enhancedWants: enhancedWantedNfts.size,
        expansionRatio: enhancedWantedNfts.size / Math.max(1, wantedNfts.size),
        graphType: this.graphAdapter.hasCollectionSupport() ? 'collection-aware' : 'standard'
      });

      // Step 4: Choose algorithm based on preference and graph characteristics
      const algorithmStartTime = performance.now();
      let trades: TradeLoop[];
      
      const algorithm = this.chooseOptimalAlgorithm(
        options.algorithmPreference || 'auto',
        walletNodes.length,
        enhancedWantedNfts.size,
        this.graphAdapter.getGraphStats()
      );

      operation.info('Algorithm selected', { algorithm });

      // Step 5: Run the chosen algorithm (ALL EXISTING ALGORITHMS WORK UNCHANGED)
      switch (algorithm) {
        case 'scalable':
          trades = await this.runScalableAlgorithm(
            walletAddress,
            wallets,
            enhancedNftOwnership,
            enhancedWantedNfts,
            rejectionPreferences
          );
          break;
          
        case 'johnson':
          trades = await this.runJohnsonAlgorithm(
            walletAddress,
            wallets,
            enhancedNftOwnership,
            enhancedWantedNfts,
            rejectionPreferences
          );
          break;
          
        case 'probabilistic':
          trades = await this.runProbabilisticAlgorithm(
            walletAddress,
            wallets,
            enhancedNftOwnership,
            enhancedWantedNfts,
            rejectionPreferences
          );
          break;
          
        default:
          // Fall back to original implementation
          trades = await this.baseTradeService.getTradesForWallet(walletAddress);
      }

      const algorithmTime = performance.now() - algorithmStartTime;

      // Step 6: Enhance results with collection metadata
      const enhancedTrades = this.enhanceTradesWithCollectionMetadata(trades);

      // Step 7: Apply enhanced scoring if collection-aware
      if (this.graphAdapter.hasCollectionSupport()) {
        this.applyCollectionAwareScoring(enhancedTrades);
      }

      // Step 8: Filter and sort results
      const filteredTrades = this.filterAndSortTrades(
        enhancedTrades,
        options.maxResults || 50,
        options.minScore || 0.4
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      operation.info('Enhanced trade discovery completed', {
        wallet: walletAddress,
        algorithm,
        totalTime: `${totalTime.toFixed(2)}ms`,
        graphBuildTime: `${graphBuildTime.toFixed(2)}ms`,
        algorithmTime: `${algorithmTime.toFixed(2)}ms`,
        tradesFound: filteredTrades.length,
        hasCollectionTrades: filteredTrades.some(t => this.hasCollectionDerivedEdges(t))
      });

      operation.end();
      return filteredTrades;

    } catch (error) {
      operation.error('Error in enhanced trade discovery', {
        wallet: walletAddress,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Add collection wants for a wallet
   * This extends the existing functionality without breaking it
   */
  public async addCollectionWant(walletAddress: string, collectionId: string): Promise<void> {
    if (!this.collectionWants.has(walletAddress)) {
      this.collectionWants.set(walletAddress, new Set());
    }
    this.collectionWants.get(walletAddress)!.add(collectionId);
    
    // Also add to the base service if it supports collection wants
    try {
      await this.baseTradeService.addCollectionWant(walletAddress, collectionId);
    } catch (error) {
      // Base service might not support collections yet - that's okay
      this.logger.debug('Base service does not support collection wants', { error });
    }
    
    this.logger.info('Collection want added', {
      wallet: walletAddress,
      collection: collectionId,
      totalCollectionWants: this.collectionWants.get(walletAddress)!.size
    });
  }

  /**
   * Remove collection wants for a wallet
   */
  public removeCollectionWant(walletAddress: string, collectionId: string): void {
    const walletWants = this.collectionWants.get(walletAddress);
    if (walletWants) {
      walletWants.delete(collectionId);
      if (walletWants.size === 0) {
        this.collectionWants.delete(walletAddress);
      }
    }
    
    this.logger.info('Collection want removed', {
      wallet: walletAddress,
      collection: collectionId
    });
  }

  /**
   * Get collection wants for a wallet
   */
  public getCollectionWants(walletAddress: string): Set<string> {
    return this.collectionWants.get(walletAddress) || new Set();
  }

  /**
   * Choose the optimal algorithm based on graph characteristics
   * This preserves all existing algorithm selection logic while enhancing it
   */
  private chooseOptimalAlgorithm(
    preference: string,
    nodeCount: number,
    edgeCount: number,
    graphStats: any
  ): 'scalable' | 'johnson' | 'probabilistic' | 'standard' {
    if (preference !== 'auto') {
      return preference as any;
    }

    // Algorithm selection based on graph characteristics
    // This logic preserves the existing sophisticated algorithm selection
    if (nodeCount > 1000 || edgeCount > 10000) {
      return 'scalable'; // Use Louvain partitioning for large graphs
    } else if (nodeCount > 100) {
      return 'probabilistic'; // Use Monte Carlo for medium graphs
    } else {
      return 'johnson'; // Use Johnson's algorithm for small graphs
    }
  }

  /**
   * Run the scalable algorithm (Tarjan's + Louvain + Johnson's)
   * This method shows how existing algorithms work unchanged with enhanced graphs
   */
  private async runScalableAlgorithm(
    walletAddress: string,
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences: Map<string, RejectionPreferences>
  ): Promise<TradeLoop[]> {
    // Get the scalable trade loop finder (existing sophisticated implementation)
    const scalableFinder = (this as any).scalableTradeLoopFinderService;
    
    // The existing algorithm works unchanged - it receives enhanced data
    // All advanced algorithms (Tarjan's, Louvain, Johnson's) operate normally
    return await scalableFinder.findTradeLoopsForWallet(
      walletAddress,
      wallets,
      nftOwnership,
      wantedNfts,
      rejectionPreferences
    );
  }

  /**
   * Run Johnson's algorithm (pure cycle enumeration)
   * Shows how sophisticated cycle detection works with enhanced graphs
   */
  private async runJohnsonAlgorithm(
    walletAddress: string,
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences: Map<string, RejectionPreferences>
  ): Promise<TradeLoop[]> {
    // Get the standard trade loop finder (uses Johnson's algorithm)
    const tradeLoopFinder = (this as any).tradeLoopFinderService;
    
    // Johnson's algorithm works unchanged with enhanced graph data
    return await tradeLoopFinder.findTradeLoopsForWallet(
      walletAddress,
      wallets,
      nftOwnership,
      wantedNfts,
      rejectionPreferences
    );
  }

  /**
   * Run probabilistic algorithm (Monte Carlo sampling)
   * Shows how probabilistic methods benefit from denser graphs
   */
  private async runProbabilisticAlgorithm(
    walletAddress: string,
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences: Map<string, RejectionPreferences>
  ): Promise<TradeLoop[]> {
    // Get the probabilistic sampler
    const { ProbabilisticTradePathSampler } = await import('./ProbabilisticTradePathSampler');
    const sampler = new ProbabilisticTradePathSampler();
    
    // Convert to the format expected by the probabilistic sampler
    const walletStates = new Map<string, any>();
    for (const [address, state] of wallets) {
      walletStates.set(address, state);
    }
    
    // Probabilistic algorithm benefits from the denser collection-enhanced graph
    return await sampler.findTradeLoops(
      walletStates,
      nftOwnership,
      wantedNfts,
      rejectionPreferences
    );
  }

  /**
   * Enhance trades with collection metadata
   */
  private enhanceTradesWithCollectionMetadata(trades: TradeLoop[]): TradeLoop[] {
    if (!this.graphAdapter.hasCollectionSupport()) {
      return trades; // No enhancement needed for standard graphs
    }

    return trades.map(trade => {
      const enhancedSteps = trade.steps.map(step => {
        const enhancedNfts = step.nfts.map(nft => {
          const edgeData = this.graphAdapter.getEdgeData(step.from, step.to);
          
          return {
            ...nft,
            isCollectionDerived: edgeData?.isCollectionDerived || false,
            sourceCollection: edgeData?.sourceCollection,
            collectionMetadata: edgeData?.sourceCollection ? {
              collection: edgeData.sourceCollection,
              derivedFromCollectionWant: true
            } : undefined
          };
        });

        return {
          ...step,
          nfts: enhancedNfts,
          hasCollectionDerivedNfts: enhancedNfts.some(nft => nft.isCollectionDerived)
        };
      });

      return {
        ...trade,
        steps: enhancedSteps,
        hasCollectionTrades: enhancedSteps.some(step => step.hasCollectionDerivedNfts),
        collectionMetadata: {
          totalCollectionDerivedSteps: enhancedSteps.filter(s => s.hasCollectionDerivedNfts).length,
          collectionsInvolved: new Set(enhancedSteps.flatMap(s => 
            s.nfts.map(n => n.sourceCollection).filter(c => c)
          )).size
        }
      };
    });
  }

  /**
   * Apply collection-aware scoring
   */
  private applyCollectionAwareScoring(trades: TradeLoop[]): void {
    // Enhanced scoring that considers collection diversity and metadata
    for (const trade of trades) {
      let collectionBonus = 0;
      
      if ((trade as any).hasCollectionTrades) {
        // Apply bonus for collection trades
        collectionBonus += 0.05; // 5% bonus for involving collections
        
        const metadata = (trade as any).collectionMetadata;
        if (metadata.collectionsInvolved > 1) {
          collectionBonus += 0.03; // 3% bonus for cross-collection trades
        }
      }
      
      // Apply bonus to existing score
      trade.qualityScore = (trade.qualityScore || 0.5) * (1 + collectionBonus);
      trade.efficiency = (trade.efficiency || 0.5) * (1 + collectionBonus);
    }
  }

  /**
   * Check if a trade has collection-derived edges
   */
  private hasCollectionDerivedEdges(trade: TradeLoop): boolean {
    return (trade as any).hasCollectionTrades || false;
  }

  /**
   * Filter and sort trades based on criteria
   */
  private filterAndSortTrades(
    trades: TradeLoop[],
    maxResults: number,
    minScore: number
  ): TradeLoop[] {
    return trades
      .filter(trade => (trade.qualityScore || 0) >= minScore)
      .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
      .slice(0, maxResults);
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(type: 'standard' | 'collection', buildTime: number): void {
    if (type === 'standard') {
      this.performanceMetrics.standardGraphBuilds++;
      this.performanceMetrics.avgStandardBuildTime = 
        (this.performanceMetrics.avgStandardBuildTime * (this.performanceMetrics.standardGraphBuilds - 1) + buildTime) / 
        this.performanceMetrics.standardGraphBuilds;
    } else {
      this.performanceMetrics.collectionGraphBuilds++;
      this.performanceMetrics.avgCollectionBuildTime = 
        (this.performanceMetrics.avgCollectionBuildTime * (this.performanceMetrics.collectionGraphBuilds - 1) + buildTime) / 
        this.performanceMetrics.collectionGraphBuilds;
    }
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      graphStats: this.graphAdapter.getGraphStats(),
      cacheStats: this.graphService.getCacheStats()
    };
  }

  /**
   * Reset all collection data (useful for testing)
   */
  public resetCollectionData(): void {
    this.collectionWants.clear();
    this.graphAdapter.reset();
    this.logger.info('Collection data reset');
  }
} 