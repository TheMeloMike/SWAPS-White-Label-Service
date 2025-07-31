import { v4 as uuidv4 } from 'uuid';
import { performance } from 'perf_hooks';
import { TradeLoop, WalletState, RejectionPreferences } from '../../types/trade';
import { LoggingService } from '../../utils/logging/LoggingService';
import { NFTPricingService } from '../nft/NFTPricingService';
import { NFTService } from '../nft/NFTService';
import { TradeScoreService } from './TradeScoreService';

/**
 * Interface for bundle cache entry
 */
interface BundleCacheEntry {
  bundle: NFTBundle;
  timestamp: number;
}

/**
 * Interface representing a bundle of NFTs
 */
interface NFTBundle {
  nfts: string[];
  totalValue: number;
  sourceWallet: string;
  targetWallet: string;
  targetNFT?: string;
  valueRatio: number;
}

/**
 * Extended edge type for the graph
 * Can be either a single NFT (string) or a bundle of NFTs
 */
type ExtendedEdge = string | NFTBundle;

/**
 * Bundle-based implementation of trade loop finding service
 * This implementation specializes in finding opportunities for multi-NFT bundle trades
 * where wallets exchange multiple NFTs in a single transaction.
 */
export class BundleTradeLoopFinderService {
  private logger: any;
  private readonly MAX_DEPTH: number;
  private readonly MIN_EFFICIENCY: number;
  private readonly BUNDLE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL
  private readonly BUNDLE_TIMEOUT_MS = 200; // 200ms max for bundle calculation
  private readonly VALUE_THRESHOLD = 0.9; // 90% of value is acceptable for a bundle
  private readonly BUNDLE_BONUS = 0.05; // 5% bonus for trades with bundles
  private readonly MAX_BUNDLE_SIZE = 5; // Maximum number of NFTs in a bundle
  
  // Services
  private nftPricingService: NFTPricingService;
  private nftService: NFTService;
  private tradeScoreService: TradeScoreService;
  
  // Cache for bundle calculations
  private bundleCache: Map<string, BundleCacheEntry> = new Map();
  
  // Performance metrics
  private bundleCalculations = 0;
  private bundleEdgesFound = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  
  constructor(maxDepth: number = 8, minEfficiency: number = 0.6) {
    this.MAX_DEPTH = maxDepth || parseInt(process.env.TRADELOOP_MAX_DEPTH || '8', 10);
    this.MIN_EFFICIENCY = minEfficiency || parseFloat(process.env.TRADELOOP_MIN_EFFICIENCY || '0.6');
    this.logger = LoggingService.getInstance().createLogger('BundleTradeLoopFinder');
    
    this.nftPricingService = NFTPricingService.getInstance();
    this.nftService = NFTService.getInstance();
    this.tradeScoreService = new TradeScoreService();
    
    // Start a background cache cleanup task
    setInterval(() => this.cleanupBundleCache(), 15 * 60 * 1000); // Run every 15 minutes
    
    this.logger.info('BundleTradeLoopFinderService initialized', {
      maxDepth: this.MAX_DEPTH,
      minEfficiency: this.MIN_EFFICIENCY,
      valueThreshold: this.VALUE_THRESHOLD,
      bundleBonus: this.BUNDLE_BONUS,
      maxBundleSize: this.MAX_BUNDLE_SIZE
    });
  }

  /**
   * Clean up expired bundle cache entries
   */
  private cleanupBundleCache(): void {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, entry] of this.bundleCache.entries()) {
      if (now - entry.timestamp > this.BUNDLE_CACHE_TTL) {
        this.bundleCache.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      this.logger.info(`Cleaned up ${expiredCount} expired bundle cache entries, ${this.bundleCache.size} remaining`);
    }
  }
  
  /**
   * Find all possible trade loops with an emphasis on bundle trades
   */
  public async findAllTradeLoops(
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences: Map<string, RejectionPreferences>
  ): Promise<TradeLoop[]> {
    const operation = this.logger.operation('findAllTradeLoops');
    operation.info('Starting bundle trade loop discovery', {
      wallets: wallets.size,
      nfts: nftOwnership.size,
      wantedNfts: wantedNfts.size
    });
    
    // Reset performance metrics
    this.bundleCalculations = 0;
    this.bundleEdgesFound = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    
    try {
      const startTime = performance.now();
      
      // Step 1: Build an extended graph with both direct and bundle edges
      const graph = await this.buildExtendedGraph(wallets, nftOwnership, wantedNfts, rejectionPreferences);
      const buildTime = performance.now();
      
      operation.info('Extended graph built', {
        nodes: graph.size,
        buildTimeMs: (buildTime - startTime).toFixed(2),
        bundleEdges: this.bundleEdgesFound,
        bundleCalculations: this.bundleCalculations
      });
      
      // Step 2: Find cycles in the extended graph
      const cycles = this.findCyclesInExtendedGraph(graph);
      const cycleTime = performance.now();
      
      operation.info('Cycle detection completed', {
        cyclesFound: cycles.length,
        cycleTimeMs: (cycleTime - buildTime).toFixed(2)
      });
      
      // Step 3: Convert cycles to trade loops
      const tradeLoops = await this.convertCyclesToTradeLoops(cycles, graph, wallets, nftOwnership);
      const conversionTime = performance.now();
      
      operation.info('Conversion to trade loops completed', {
        tradeLoopsCreated: tradeLoops.length,
        conversionTimeMs: (conversionTime - cycleTime).toFixed(2)
      });
      
      // Step 4: Apply quality scoring
      const scoredTradeLoops = await this.applyQualityScoring(tradeLoops);
      const scoringTime = performance.now();
      
      operation.info('Quality scoring completed', {
        totalTradeLoops: scoredTradeLoops.length,
        scoringTimeMs: (scoringTime - conversionTime).toFixed(2),
        totalProcessingTimeMs: (scoringTime - startTime).toFixed(2)
      });
      
      operation.end();
      return scoredTradeLoops;
    } catch (error) {
      operation.error('Error finding bundle trade loops', {
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      return [];
    }
  }
  
  /**
   * Find trade loops specific to a wallet
   */
  public async findTradeLoopsForWallet(
    walletAddress: string,
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences: Map<string, RejectionPreferences>
  ): Promise<TradeLoop[]> {
    const operation = this.logger.operation('findTradeLoopsForWallet');
    operation.info('Finding bundle trades for specific wallet', { wallet: walletAddress });
    
    try {
      // Step 1: Build the extended graph with both direct and bundle edges
      const fullGraph = await this.buildExtendedGraph(wallets, nftOwnership, wantedNfts, rejectionPreferences);
      
      // Step 2: Create a subgraph focused on the specified wallet
      // Include connected wallets up to depth 2
      const relevantWallets = new Set<string>([walletAddress]);
      const subgraph = new Map<string, Map<string, ExtendedEdge>>();
      
      // First add the target wallet
      if (fullGraph.has(walletAddress)) {
        subgraph.set(walletAddress, fullGraph.get(walletAddress)!);
        
        // Add all outgoing neighbors
        for (const [neighbor] of fullGraph.get(walletAddress)!.entries()) {
          relevantWallets.add(neighbor);
        }
      }
      
      // Now add incoming neighbors
      for (const [sourceWallet, edges] of fullGraph.entries()) {
        if (edges.has(walletAddress)) {
          relevantWallets.add(sourceWallet);
        }
      }
      
      // Build subgraph with only relevant wallets
      for (const wallet of relevantWallets) {
        if (fullGraph.has(wallet)) {
          const filteredEdges = new Map<string, ExtendedEdge>();
          
          for (const [neighbor, edge] of fullGraph.get(wallet)!.entries()) {
            if (relevantWallets.has(neighbor)) {
              filteredEdges.set(neighbor, edge);
            }
          }
          
          if (filteredEdges.size > 0) {
            subgraph.set(wallet, filteredEdges);
          }
        }
      }
      
      operation.info('Subgraph built for wallet-specific trade loops', {
        relevantWallets: relevantWallets.size,
        subgraphSize: subgraph.size
      });
      
      // Step 3: Find cycles in the subgraph
      const cycles = this.findCyclesInExtendedGraph(subgraph);
      
      // Step 4: Convert cycles to trade loops
      const tradeLoops = await this.convertCyclesToTradeLoops(cycles, subgraph, wallets, nftOwnership);
      
      // Step 5: Filter to include only trades involving the target wallet
      const filteredTradeLoops = tradeLoops.filter(trade => 
        trade.steps.some(step => step.from === walletAddress || step.to === walletAddress)
      );
      
      // Step 6: Apply quality scoring
      const scoredTradeLoops = await this.applyQualityScoring(filteredTradeLoops);
      
      operation.info('Wallet-specific bundle trade discovery completed', {
        totalTradeLoops: scoredTradeLoops.length
      });
      
      operation.end();
      return scoredTradeLoops;
    } catch (error) {
      operation.error('Error finding wallet-specific bundle trade loops', {
        wallet: walletAddress,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      return [];
    }
  }
  
  /**
   * Build an extended graph with both regular and bundle edges
   */
  private async buildExtendedGraph(
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences: Map<string, RejectionPreferences>
  ): Promise<Map<string, Map<string, ExtendedEdge>>> {
    const graph = new Map<string, Map<string, ExtendedEdge>>();
    
    // Initialize graph nodes
    for (const [walletAddress] of wallets) {
      graph.set(walletAddress, new Map<string, ExtendedEdge>());
    }
    
    // Step 1: Add direct edges (single NFT wants)
    for (const [nftAddress, wanters] of wantedNfts) {
      const ownerAddress = nftOwnership.get(nftAddress);
      if (!ownerAddress) continue;
      
      for (const wanterAddress of wanters) {
        if (wanterAddress === ownerAddress) continue;
        if (!wallets.has(wanterAddress) || !wallets.has(ownerAddress)) continue;
        
        // Check rejection preferences
        if (this.isTradeRejected(wanterAddress, nftAddress, rejectionPreferences)) continue;
        
        // FIXED: Add directed edge from owner to wanter (NFT flow direction)
        // This represents "owner can give NFT to wanter"
        graph.get(ownerAddress)!.set(wanterAddress, nftAddress);
      }
    }
    
    // Step 2: Add bundle edges
    await this.addBundleEdges(graph, wallets, nftOwnership, wantedNfts, rejectionPreferences);
    
    return graph;
  }
  
  /**
   * Add bundle edges to the graph
   */
  private async addBundleEdges(
    graph: Map<string, Map<string, ExtendedEdge>>,
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences: Map<string, RejectionPreferences>
  ): Promise<void> {
    const operation = this.logger.operation('addBundleEdges');
    operation.info('Starting bundle edge computation');
    
    // Get NFT values
    const nftValues = await this.getNFTValues(nftOwnership);
    
    // For each wallet pair, check if bundle trades are possible
    const walletAddresses = Array.from(wallets.keys());
    
    // For each wallet, compute possible bundles to offer to other wallets
    for (const sourceWallet of walletAddresses) {
      const sourceState = wallets.get(sourceWallet);
      if (!sourceState || sourceState.ownedNfts.size === 0) continue;
      
      // Get all NFTs owned by this wallet
      const ownedNFTs = Array.from(sourceState.ownedNfts);
      
      // Skip wallets with only one NFT (no bundles possible)
      if (ownedNFTs.length <= 1) continue;
      
      // Get values for owned NFTs
      const ownedNFTValues = ownedNFTs.map(nft => ({
        nft,
        value: nftValues.get(nft) || 0
      })).filter(item => item.value > 0);
      
      // If no NFTs have values, skip
      if (ownedNFTValues.length === 0) continue;
      
      // For each potential target wallet
      for (const targetWallet of walletAddresses) {
        if (targetWallet === sourceWallet) continue;
        
        const targetState = wallets.get(targetWallet);
        if (!targetState || targetState.ownedNfts.size === 0) continue;
        
        // Get NFTs the target wallet owns that the source wallet might want
        const targetNFTs = Array.from(targetState.ownedNfts).filter(nft => 
          sourceState.wantedNfts.has(nft) && !this.isTradeRejected(sourceWallet, nft, rejectionPreferences)
        );
        
        // If target has no NFTs the source wants, skip
        if (targetNFTs.length === 0) continue;
        
        // For each NFT the source wants from target
        for (const targetNFT of targetNFTs) {
          // Get the value of the target NFT
          const targetNFTValue = nftValues.get(targetNFT) || 0;
          if (targetNFTValue <= 0) continue;
          
          // Find NFTs from source that target wants (for direct trade)
          const nftTargetWants = ownedNFTs.filter(nft => targetState.wantedNfts.has(nft));
          
          // If the target already wants exactly one NFT from source, we have a direct trade
          if (nftTargetWants.length === 1) continue;
          
          // Try to find a bundle of NFTs from source that closely matches target NFT value
          const bundle = await this.computeNFTBundle(
            sourceWallet,
            targetWallet,
            targetNFT,
            ownedNFTValues,
            targetNFTValue
          );
          
          // If we found a viable bundle, add it as an edge
          if (bundle && bundle.nfts.length > 0) {
            // Make sure the target wallet doesn't reject any NFT in the bundle
            const hasRejection = bundle.nfts.some(nft => 
              this.isTradeRejected(targetWallet, nft, rejectionPreferences)
            );
            
            if (!hasRejection) {
              // FIXED: Add a bundle edge from source to target
              // This maintains the NFT flow direction (from source to target)
              graph.get(sourceWallet)!.set(targetWallet, bundle);
              this.bundleEdgesFound++;
            }
          }
        }
      }
    }
    
    operation.info('Bundle edge computation completed', {
      bundleEdgesFound: this.bundleEdgesFound,
      bundleCalculations: this.bundleCalculations,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses
    });
    
    operation.end();
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
   * Get all NFT values in a single batch
   */
  private async getNFTValues(nftOwnership: Map<string, string>): Promise<Map<string, number>> {
    const values = new Map<string, number>();
    const nftAddresses = Array.from(nftOwnership.keys());
    
    // Batch get prices for all NFTs
    try {
      const pricingService = NFTPricingService.getInstance();
      const prices = await pricingService.batchGetFloorPrices(nftAddresses);
      
      // Iterate the Map correctly - prices is a Map, not an object
      for (const [nft, price] of prices.entries()) {
        if (price && price > 0) {
          values.set(nft, price);
        }
      }
      
      this.logger.info(`Loaded values for ${values.size} out of ${nftAddresses.length} NFTs`);
    } catch (error) {
      this.logger.error('Error batch loading NFT prices', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    return values;
  }
  
  /**
   * Compute a viable bundle of NFTs that closely matches a target value
   * Uses a variation of the knapsack problem algorithm
   */
  private async computeNFTBundle(
    sourceWallet: string,
    targetWallet: string,
    targetNFT: string,
    ownedNFTValues: { nft: string, value: number }[],
    targetNFTValue: number
  ): Promise<NFTBundle | null> {
    // Generate cache key for this bundle lookup
    const cacheKey = `${sourceWallet}->${targetWallet}:${targetNFT}`;
    
    // Check cache first for efficiency
    if (this.bundleCache.has(cacheKey)) {
      const cachedEntry = this.bundleCache.get(cacheKey)!;
      
      // Use cache if it's recent enough
      if (Date.now() - cachedEntry.timestamp < this.BUNDLE_CACHE_TTL) {
        this.cacheHits++;
        return cachedEntry.bundle;
      }
      
      // Cache expired, remove it
      this.bundleCache.delete(cacheKey);
    }
    
    this.cacheMisses++;
    this.bundleCalculations++;
    
    // Start the bundle computation with a timeout to prevent excessive processing
    const startTime = performance.now();
    
    try {
      // Sort NFTs by value (descending) for more efficient bundle creation
      const sortedNFTs = [...ownedNFTValues].sort((a, b) => b.value - a.value);
      
      // Initialize best bundle
      let bestBundle: NFTBundle | null = null;
      let bestRatio = 0;
      
      // OPTIMIZATION: First try to find a single NFT that's a good match
      // This fast path avoids the expensive bundle calculation when possible
      for (const item of sortedNFTs) {
        const ratio = item.value / targetNFTValue;
        
        // If we find a single NFT with value close to the target NFT, use it directly
        if (ratio >= this.VALUE_THRESHOLD && ratio <= 1.2) {
          bestBundle = {
            nfts: [item.nft],
            totalValue: item.value,
            sourceWallet,
            targetWallet,
            targetNFT,
            valueRatio: ratio
          };
          
          // Break early if we found an excellent match
          if (ratio >= 0.95 && ratio <= 1.05) break;
        }
      }
      
      // If we didn't find a good single NFT match and we have time, try bundle combinations
      if ((!bestBundle || bestBundle.valueRatio < 0.95) && 
          performance.now() - startTime < this.BUNDLE_TIMEOUT_MS) {
        
        // Only consider NFTs below the target value for the knapsack problem
        const candidateNFTs = sortedNFTs.filter(item => item.value <= targetNFTValue);
        
        // Don't attempt to bundle if insufficient candidates
        if (candidateNFTs.length >= 2) {
          // Use dynamic programming approach to the knapsack problem
          const bundle = this.solveKnapsackOptimized(candidateNFTs, targetNFTValue, this.MAX_BUNDLE_SIZE);
          
          if (bundle && bundle.nfts.length > 0) {
            const ratio = bundle.totalValue / targetNFTValue;
            
            // Only use this bundle if it's better than any single NFT we found
            if (ratio >= this.VALUE_THRESHOLD && (!bestBundle || ratio > bestRatio)) {
              bundle.sourceWallet = sourceWallet;
              bundle.targetWallet = targetWallet;
              bundle.targetNFT = targetNFT;
              bundle.valueRatio = ratio;
              
              bestBundle = bundle;
              bestRatio = ratio;
            }
          }
        }
      }
      
      // Cache the result for future lookups
      if (bestBundle) {
        this.bundleCache.set(cacheKey, {
          bundle: bestBundle,
          timestamp: Date.now()
        });
      }
      
      return bestBundle;
    } catch (error) {
      this.logger.error('Error computing NFT bundle', {
        error: error instanceof Error ? error.message : String(error),
        sourceWallet,
        targetWallet,
        targetNFT
      });
      return null;
    }
  }
  
  /**
   * Optimized knapsack algorithm for bundle creation
   * Uses dynamic programming with value scaling
   */
  private solveKnapsackOptimized(
    items: { nft: string, value: number }[],
    targetValue: number,
    maxItems: number
  ): NFTBundle | null {
    // Early exit for empty input
    if (items.length === 0) return null;
    
    // Scale values to integers for DP algorithm
    const scaleFactor = 1000;
    const scaledTarget = Math.round(targetValue * scaleFactor);
    
    // Create a 2D table for dynamic programming
    // We want to find a subset of items that sum closest to the target
    // while not exceeding maxItems
    
    // Each table entry is an array [totalValue, selectedItems[]]
    type Entry = [number, string[]];
    
    // Create a table with max bundle size rows
    const dp: Entry[][] = Array(maxItems + 1).fill(0).map(() => []);
    
    // Initialize first row - no items selected
    dp[0] = Array(scaledTarget + 1).fill(0).map(() => [0, []]);
    
    // Fill the DP table - i is the number of items we can use
    for (let i = 1; i <= maxItems; i++) {
      dp[i] = Array(scaledTarget + 1).fill(0).map(() => [0, []]);
      
      // j is the target value we're trying to reach
      for (let j = 0; j <= scaledTarget; j++) {
        // Start with the previous row's solution
        dp[i][j] = [...dp[i-1][j]];
        
        // Try including each item
        for (let k = 0; k < items.length; k++) {
          const item = items[k];
          const itemValue = Math.round(item.value * scaleFactor);
          
          // Skip if this item is too valuable
          if (itemValue > j) continue;
          
          // Check if we've used this item before
          const prevSolution = dp[i-1][j - itemValue];
          if (!prevSolution) continue;
          
          // Check if including this item would be better
          const newValue = prevSolution[0] + itemValue;
          
          // Make sure we haven't already included this exact NFT
          if (!prevSolution[1].includes(item.nft) && newValue > dp[i][j][0]) {
            dp[i][j] = [newValue, [...prevSolution[1], item.nft]];
          }
        }
      }
    }
    
    // Find best solution - closest to target without exceeding it
    let bestSolution: Entry | null = null;
    let bestDistance = Number.MAX_SAFE_INTEGER;
    
    for (let i = 1; i <= maxItems; i++) {
      for (let j = 0; j <= scaledTarget; j++) {
        const solution = dp[i][j];
        if (solution[1].length === 0) continue; // Skip empty solutions
        
        const distance = Math.abs(scaledTarget - solution[0]);
        
        // We want the solution closest to target value and with appropriate # of items
        if (distance < bestDistance && solution[1].length > 0 && solution[1].length <= maxItems) {
          bestSolution = solution;
          bestDistance = distance;
        }
      }
    }
    
    // Convert back from the solution
    if (bestSolution && bestSolution[1].length > 0) {
      // Calculate total value of selected NFTs
      const selectedNfts = bestSolution[1];
      const totalValue = selectedNfts.reduce((sum, nft) => {
        const item = items.find(i => i.nft === nft);
        return sum + (item ? item.value : 0);
      }, 0);
      
      return {
        nfts: selectedNfts,
        totalValue,
        sourceWallet: '',  // These will be filled in by the caller
        targetWallet: '',
        targetNFT: '',
        valueRatio: totalValue / targetValue
      };
    }
    
    return null;
  }
  
  /**
   * Find cycles in the extended graph
   */
  private findCyclesInExtendedGraph(
    graph: Map<string, Map<string, ExtendedEdge>>
  ): string[][] {
    const operation = this.logger.operation('findCyclesInExtendedGraph');
    const startTime = performance.now();
    
    const allCycles: string[][] = [];
    const nodes = Array.from(graph.keys());
    
    // Use a set for deduplication
    const seenCycles = new Set<string>();
    
    // For each node, find cycles starting from it
    for (const startNode of nodes) {
      const outEdges = graph.get(startNode);
      if (!outEdges || outEdges.size === 0) continue;
      
      // Check if any node has an edge back to startNode
      const hasIncomingEdges = Array.from(graph.entries()).some(([_, edges]) => edges.has(startNode));
      if (!hasIncomingEdges) continue;
      
      // Start DFS from this node
      const visited = new Set<string>();
      const path: string[] = [startNode];
      
      this.findCyclesDFS(
        startNode,
        startNode,
        graph,
        visited,
        path,
        allCycles,
        seenCycles,
        this.MAX_DEPTH
      );
    }
    
    const duration = performance.now() - startTime;
    
    operation.info('Cycle detection completed', {
      cyclesFound: allCycles.length,
      durationMs: duration.toFixed(2)
    });
    
    operation.end();
    return allCycles;
  }
  
  /**
   * DFS-based cycle detection for the extended graph
   */
  private findCyclesDFS(
    startNode: string,
    currentNode: string,
    graph: Map<string, Map<string, ExtendedEdge>>,
    visited: Set<string>,
    path: string[],
    allCycles: string[][],
    seenCycles: Set<string>,
    maxDepth: number
  ): void {
    // Mark current node as visited
    visited.add(currentNode);
    
    // Get neighbors of the current node
    const neighbors = graph.get(currentNode);
    if (!neighbors) {
      visited.delete(currentNode);
      return;
    }
    
    // Check each neighbor
    for (const [neighbor] of neighbors.entries()) {
      // We found a cycle if we can go back to startNode
      if (neighbor === startNode && path.length >= 2) {
        const cycle = [...path];
        const canonicalCycle = this.getCanonicalCycle(cycle);
        
        // Add the cycle if we haven't seen it before
        if (!seenCycles.has(canonicalCycle)) {
          seenCycles.add(canonicalCycle);
          allCycles.push(cycle);
        }
        continue;
      }
      
      // Skip if we've reached max depth or neighbor is already in the path
      if (path.length >= maxDepth || visited.has(neighbor)) {
        continue;
      }
      
      // Continue DFS with the neighbor
      path.push(neighbor);
      this.findCyclesDFS(
        startNode,
        neighbor,
        graph,
        visited,
        path,
        allCycles,
        seenCycles,
        maxDepth
      );
      path.pop();
    }
    
    // Remove the current node from visited
    visited.delete(currentNode);
  }
  
  /**
   * Get a canonical representation of a cycle for deduplication
   */
  private getCanonicalCycle(cycle: string[]): string {
    // Find the wallet with the lowest lexicographical value
    let minIndex = 0;
    for (let i = 1; i < cycle.length; i++) {
      if (cycle[i] < cycle[minIndex]) {
        minIndex = i;
      }
    }
    
    // Rotate the cycle to start from the min wallet
    const canonical: string[] = [];
    for (let i = 0; i < cycle.length; i++) {
      canonical.push(cycle[(minIndex + i) % cycle.length]);
    }
    
    return canonical.join(',');
  }
  
  /**
   * Convert cycles to trade loops
   */
  private async convertCyclesToTradeLoops(
    cycles: string[][],
    graph: Map<string, Map<string, ExtendedEdge>>,
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>
  ): Promise<TradeLoop[]> {
    const operation = this.logger.operation('convertCyclesToTradeLoops');
    const tradeLoops: TradeLoop[] = [];
    
    for (const cycle of cycles) {
      try {
        // Create trade loop steps
        const steps: any[] = [];
        let hasBundle = false;
        let totalValue = 0;
        
        // Process each step in the cycle
        for (let i = 0; i < cycle.length; i++) {
          const from = cycle[i];
          const to = cycle[(i + 1) % cycle.length];
          
          // Get the edge data (NFT or bundle)
          const edge = graph.get(from)?.get(to);
          if (!edge) {
            this.logger.warn(`Missing edge from ${from} to ${to}`);
            continue;
          }
          
          // Handle different edge types
          if (typeof edge === 'string') {
            // Single NFT edge
            steps.push({
              from,
              to,
              nfts: [{
                address: edge,
                name: '',
                symbol: '',
                image: '',
                collection: '',
                description: ''
              }]
            });
          } else {
            // Bundle edge
            hasBundle = true;
            totalValue += edge.totalValue;
            
            const bundleNfts = edge.nfts.map(nft => ({
              address: nft,
              name: '',
              symbol: '',
              image: '',
              collection: '',
              description: ''
            }));
            
            steps.push({
              from,
              to,
              nfts: bundleNfts,
              isBundle: true,
              bundleValue: edge.totalValue,
              targetNFT: edge.targetNFT
            });
          }
        }
        
        // Skip invalid trade loops
        if (steps.length !== cycle.length) {
          continue;
        }
        
        // Calculate efficiency score
        const uniqueParticipants = new Set(cycle).size;
        let efficiency = uniqueParticipants / cycle.length;
        
        // Apply a bonus for bundle trades
        if (hasBundle) {
          efficiency += this.BUNDLE_BONUS;
        }
        
        // Create the trade loop
        const tradeLoop: TradeLoop = {
          id: this.generateCanonicalTradeId(cycle, steps.map(step => step.nfts[0].address)),
          steps,
          totalParticipants: uniqueParticipants,
          efficiency,
          rawEfficiency: efficiency,
          estimatedValue: totalValue,
          status: 'pending',
          progress: 0,
          createdAt: new Date(),
          isBundle: hasBundle
        };
        
        tradeLoops.push(tradeLoop);
      } catch (error) {
        this.logger.error('Error converting cycle to trade loop', {
          cycle: cycle.join(' -> '),
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    operation.info('Cycle conversion completed', {
      tradeCycles: cycles.length,
      validTradeLoops: tradeLoops.length,
      bundleTradeLoops: tradeLoops.filter(t => t.isBundle).length
    });
    
    operation.end();
    return tradeLoops;
  }
  
  /**
   * Apply quality scoring to trade loops
   */
  private async applyQualityScoring(tradeLoops: TradeLoop[]): Promise<TradeLoop[]> {
    // Use the TradeScoreService to score each trade
    const scoredLoops = await Promise.all(tradeLoops.map(async (loop) => {
      try {
        // Calculate quality score
        const scoreResult = this.tradeScoreService.calculateTradeScore(loop);
        
        // Apply a slight boost for bundle trades
        const finalScore = loop.isBundle 
          ? scoreResult.score * (1 + this.BUNDLE_BONUS)
          : scoreResult.score;
        
        // Return new loop with updated score
        return {
          ...loop,
          qualityScore: finalScore,
          qualityMetrics: scoreResult.metrics,
          efficiency: finalScore, // Use score as efficiency for sorting
        };
      } catch (error) {
        this.logger.warn(`Error scoring trade loop ${loop.id}`, {
          error: error instanceof Error ? error.message : String(error)
        });
        return loop;
      }
    }));
    
    // Sort by score (highest first)
    return scoredLoops.sort((a, b) => b.efficiency - a.efficiency);
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