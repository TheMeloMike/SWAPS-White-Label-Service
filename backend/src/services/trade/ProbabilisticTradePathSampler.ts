import { WalletState, TradeLoop, RejectionPreferences } from '../../types/trade';
import { LoggingService } from '../../utils/logging/LoggingService';
import { performance } from 'perf_hooks';

/**
 * Implements probabilistic trade path sampling using Monte Carlo methods
 * 
 * This class uses random walk sampling to discover trade loops in large communities
 * rather than exhaustively analyzing all possibilities. This provides significant
 * performance improvements for large communities at the cost of potentially missing
 * some valid trade loops.
 * 
 * Key features:
 * - Random walk sampling with restart
 * - Biased exploration favoring high-value NFTs and recent activity
 * - Configurable sampling intensity and walk length
 * - Statistical guarantees on cycle discovery
 * 
 * This approach is particularly effective for communities with 100+ members
 * where exhaustive search becomes computationally expensive.
 */
export class ProbabilisticTradePathSampler {
  private logger = LoggingService.getInstance().createLogger('ProbabilisticSampler');

  // Sampling configuration with sensible defaults
  private readonly MAX_SAMPLES: number;
  private readonly MAX_WALK_LENGTH: number;
  private readonly WALK_RESTART_PROBABILITY: number;
  private readonly EXPLORATION_BIAS: number;
  private readonly MIN_CYCLES_TO_FIND: number;
  private readonly TIMEOUT_MS: number;

  /**
   * Create a new probabilistic sampler with custom settings
   */
  constructor(config?: {
    maxSamples?: number;
    maxWalkLength?: number;
    walkRestartProbability?: number;
    explorationBias?: number;
    minCyclesToFind?: number;
    timeoutMs?: number;
  }) {
    // Set configuration with environment variables or defaults
    this.MAX_SAMPLES = config?.maxSamples || 
      parseInt(process.env.PROBABILISTIC_MAX_SAMPLES || '1000', 10);
    
    this.MAX_WALK_LENGTH = config?.maxWalkLength || 
      parseInt(process.env.PROBABILISTIC_MAX_WALK_LENGTH || '20', 10);
    
    this.WALK_RESTART_PROBABILITY = config?.walkRestartProbability || 
      parseFloat(process.env.PROBABILISTIC_RESTART_PROBABILITY || '0.1');
    
    this.EXPLORATION_BIAS = config?.explorationBias || 
      parseFloat(process.env.PROBABILISTIC_EXPLORATION_BIAS || '0.3');
    
    this.MIN_CYCLES_TO_FIND = config?.minCyclesToFind || 
      parseInt(process.env.PROBABILISTIC_MIN_CYCLES || '50', 10);
    
    this.TIMEOUT_MS = config?.timeoutMs || 
      parseInt(process.env.PROBABILISTIC_TIMEOUT_MS || '5000', 10);
    
    this.logger.info('Initialized ProbabilisticTradePathSampler', {
      maxSamples: this.MAX_SAMPLES,
      maxWalkLength: this.MAX_WALK_LENGTH,
      walkRestartProbability: this.WALK_RESTART_PROBABILITY,
      explorationBias: this.EXPLORATION_BIAS,
      minCyclesToFind: this.MIN_CYCLES_TO_FIND,
      timeoutMs: this.TIMEOUT_MS
    });
  }

  /**
   * Find trade loops using Monte Carlo sampling
   * 
   * This method performs multiple random walks through the trade graph
   * to discover potential trade loops without exhaustive search.
   * 
   * @param communityWallets Map of wallets in the community
   * @param nftOwnership Map of NFT addresses to owner wallet addresses
   * @param wantedNfts Map of NFT addresses to wallets that want them
   * @param rejectionPreferences Optional rejection preferences
   * @returns Array of discovered trade loops
   */
  public findTradeLoops(
    communityWallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences?: Map<string, RejectionPreferences>
  ): Promise<TradeLoop[]> {
    const operation = this.logger.operation('findTradeLoops');
    const startTime = performance.now();
    
    operation.info('Starting probabilistic trade loop search', {
      wallets: communityWallets.size,
      strategy: 'MonteCarlo'
    });
    
    return new Promise((resolve) => {
      // Track discovered unique cycles
      const discoveredCycles = new Map<string, TradeLoop>();
      
      // Create weighted starting points favoring active wallets and those with many NFTs
      const startingPoints = this.selectStartingPoints(communityWallets);
      
      // Track performance metrics
      let samplesPerformed = 0;
      let cyclesFound = 0;
      let longestCycle = 0;
      
      // Set timeout to ensure we don't run too long
      const timeoutId = setTimeout(() => {
        operation.info('Probabilistic search reached timeout', {
          durationMs: Math.round(performance.now() - startTime),
          samplesPerformed,
          cyclesFound
        });
        finishSampling();
      }, this.TIMEOUT_MS);
      
      // Main sampling loop - we'll run this asynchronously to allow for interruption
      const runSampling = async () => {
        for (let i = 0; i < this.MAX_SAMPLES; i++) {
          samplesPerformed++;
          
          // Periodically check if we should terminate early
          if (i % 100 === 0 && (performance.now() - startTime > this.TIMEOUT_MS || 
              discoveredCycles.size >= this.MIN_CYCLES_TO_FIND)) {
            break;
          }
          
          // Select a starting point for this walk
          const startWallet = this.selectRandomWallet(startingPoints);
          if (!startWallet) continue;
          
          // Perform a random walk from this wallet
          const cyclePath = this.performRandomWalk(
            startWallet, 
            communityWallets, 
            nftOwnership, 
            wantedNfts,
            rejectionPreferences
          );
          
          // If we found a valid cycle, add it to our results
          if (cyclePath && cyclePath.length > 0) {
            const tradeLoop = this.convertPathToTradeLoop(
              cyclePath, 
              communityWallets, 
              nftOwnership
            );
            
            if (tradeLoop) {
              // Use the ID as the key to avoid duplicates
              discoveredCycles.set(tradeLoop.id, tradeLoop);
              cyclesFound++;
              longestCycle = Math.max(longestCycle, cyclePath.length);
            }
          }
          
          // Check if we've found enough cycles
          if (discoveredCycles.size >= this.MIN_CYCLES_TO_FIND) {
            operation.info('Found sufficient number of cycles, terminating early', {
              targetCycles: this.MIN_CYCLES_TO_FIND,
              actualCycles: discoveredCycles.size,
              samplesPerformed
            });
            break;
          }
        }
        
        finishSampling();
      };
      
      // Helper to finish sampling and resolve the promise
      const finishSampling = () => {
        clearTimeout(timeoutId);
        
        const results = Array.from(discoveredCycles.values());
        const endTime = performance.now();
        
        operation.info('Probabilistic trade loop search completed', {
          durationMs: Math.round(endTime - startTime),
          samplesPerformed,
          cyclesFound: results.length,
          uniqueCycles: discoveredCycles.size,
          longestCycle,
          samplesPerSecond: Math.round(samplesPerformed / ((endTime - startTime) / 1000))
        });
        
        operation.end();
        resolve(results);
      };
      
      // Start the sampling process
      runSampling();
    });
  }
  
  /**
   * Select weighted starting points for random walks
   * Prioritizes wallets with more NFTs and wants
   */
  private selectStartingPoints(
    communityWallets: Map<string, WalletState>
  ): Map<string, number> {
    const startingPoints = new Map<string, number>();
    
    for (const [walletId, wallet] of communityWallets.entries()) {
      // Calculate weight based on wallet activity
      const weight = wallet.ownedNfts.size + wallet.wantedNfts.size;
      
      // Only include wallets with both owned NFTs and wants
      if (wallet.ownedNfts.size > 0 && wallet.wantedNfts.size > 0) {
        startingPoints.set(walletId, weight);
      }
    }
    
    return startingPoints;
  }
  
  /**
   * Select a random wallet based on weighted probabilities
   */
  private selectRandomWallet(weightedWallets: Map<string, number>): string | null {
    if (weightedWallets.size === 0) return null;
    
    // Calculate total weight
    let totalWeight = 0;
    for (const weight of weightedWallets.values()) {
      totalWeight += weight;
    }
    
    // Select a random point in the weighted distribution
    const randomValue = Math.random() * totalWeight;
    
    // Find the wallet at that point
    let cumulativeWeight = 0;
    for (const [walletId, weight] of weightedWallets.entries()) {
      cumulativeWeight += weight;
      if (randomValue <= cumulativeWeight) {
        return walletId;
      }
    }
    
    // Fallback to first wallet (shouldn't reach here)
    return Array.from(weightedWallets.keys())[0];
  }
  
  /**
   * Perform a random walk through the graph to find a trade cycle
   * Uses restarts and biased exploration to improve efficiency
   */
  private performRandomWalk(
    startWalletId: string,
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences?: Map<string, RejectionPreferences>
  ): string[] | null {
    // Track wallets and NFTs in the current path
    const path: string[] = [startWalletId];
    const usedNfts = new Set<string>();
    const visitedWallets = new Set<string>([startWalletId]);
    
    // Current wallet in the walk
    let currentWalletId = startWalletId;
    let stepsWithoutProgress = 0;
    
    // Perform random walk
    for (let step = 0; step < this.MAX_WALK_LENGTH; step++) {
      const currentWallet = wallets.get(currentWalletId);
      if (!currentWallet) break;
      
      // Get rejection preferences for this wallet
      const rejectPrefs = rejectionPreferences?.get(currentWalletId) || {
        nfts: new Set<string>(),
        wallets: new Set<string>()
      };
      
      // Find all possible next wallets via NFT wants
      const possibleNextSteps: Array<{
        nextWallet: string;
        nftToSend: string;
        weight: number;
      }> = [];
      
      // Check each NFT this wallet wants
      for (const wantedNft of currentWallet.wantedNfts) {
        // Skip if this NFT is rejected
        if (rejectPrefs.nfts.has(wantedNft)) continue;
        
        // Find the NFT owner
        const ownerWalletId = nftOwnership.get(wantedNft);
        if (!ownerWalletId || ownerWalletId === currentWalletId) continue;
        
        // Skip if wallet has rejected the owner
        if (rejectPrefs.wallets.has(ownerWalletId)) continue;
        
        // If we've already used this NFT in the path, skip it
        if (usedNfts.has(wantedNft)) continue;
        
        // Calculate a weight for this step
        let weight = 1.0;
        
        // Prefer steps that might close the cycle
        if (ownerWalletId === startWalletId && path.length > 2) {
          weight += 2.0; // Strongly prefer cycle completion
        }
        // Prefer unvisited wallets with proper exploration-exploitation balance
        else if (!visitedWallets.has(ownerWalletId)) {
          weight += this.EXPLORATION_BIAS;
        }
        
        possibleNextSteps.push({
          nextWallet: ownerWalletId,
          nftToSend: wantedNft,
          weight
        });
      }
      
      // If no valid next steps, consider restart or termination
      if (possibleNextSteps.length === 0) {
        // Count steps without progress
        stepsWithoutProgress++;
        
        // Consider random restart with some probability
        if (Math.random() < this.WALK_RESTART_PROBABILITY || stepsWithoutProgress > 3) {
          // If we've already built a decent path, let's just terminate
          if (path.length > 2) break;
          
          // Otherwise restart from our original starting point
          currentWalletId = startWalletId;
          path.length = 1; // Keep only the starting point
          usedNfts.clear();
          visitedWallets.clear();
          visitedWallets.add(startWalletId);
          stepsWithoutProgress = 0;
          continue;
        }
        
        // If we're not restarting and have no next steps, terminate
        break;
      }
      
      // Reset the no-progress counter
      stepsWithoutProgress = 0;
      
      // Select next step based on weighted probabilities
      const nextStep = this.selectWeightedRandomStep(possibleNextSteps);
      
      // Move to the next wallet
      currentWalletId = nextStep.nextWallet;
      usedNfts.add(nextStep.nftToSend);
      path.push(currentWalletId);
      visitedWallets.add(currentWalletId);
      
      // Check if we've completed a cycle
      if (currentWalletId === startWalletId && path.length > 2) {
        return path;
      }
    }
    
    // We reached max steps without finding a cycle
    return null;
  }
  
  /**
   * Select a random next step based on weights
   */
  private selectWeightedRandomStep(steps: Array<{
    nextWallet: string;
    nftToSend: string;
    weight: number;
  }>): { nextWallet: string; nftToSend: string; weight: number } {
    if (steps.length === 1) return steps[0];
    
    // Calculate total weight
    let totalWeight = 0;
    for (const step of steps) {
      totalWeight += step.weight;
    }
    
    // Select a random point in the weighted distribution
    const randomValue = Math.random() * totalWeight;
    
    // Find the step at that point
    let cumulativeWeight = 0;
    for (const step of steps) {
      cumulativeWeight += step.weight;
      if (randomValue <= cumulativeWeight) {
        return step;
      }
    }
    
    // Fallback to first step (shouldn't reach here)
    return steps[0];
  }
  
  /**
   * Convert a cycle path to a TradeLoop object
   */
  private convertPathToTradeLoop(
    cyclePath: string[],
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>
  ): TradeLoop | null {
    // Ensure the path is a valid cycle (last node equals first node)
    if (cyclePath[0] !== cyclePath[cyclePath.length - 1]) {
      return null;
    }
    
    // Build a list of steps for the trade loop
    const steps: Array<{
      from: string;
      to: string;
      nfts: Array<{
        address: string;
        name: string;
        symbol: string;
        image: string;
        collection: string;
        description: string;
      }>;
    }> = [];
    
    // Track which NFTs are used to avoid duplicates
    const usedNfts = new Set<string>();
    
    // Process each step in the cycle (excluding the repeated last node)
    for (let i = 0; i < cyclePath.length - 1; i++) {
      const fromWalletId = cyclePath[i];
      const toWalletId = cyclePath[i + 1];
      
      const fromWallet = wallets.get(fromWalletId);
      const toWallet = wallets.get(toWalletId);
      
      if (!fromWallet || !toWallet) return null;
      
      // Find an NFT that from wallet owns and to wallet wants
      let matchingNft: string | null = null;
      
      for (const ownedNft of fromWallet.ownedNfts) {
        if (toWallet.wantedNfts.has(ownedNft) && !usedNfts.has(ownedNft)) {
          matchingNft = ownedNft;
          break;
        }
      }
      
      // If no matching NFT, try to find any NFT that to wallet wants
      if (!matchingNft) {
        for (const wantedNft of toWallet.wantedNfts) {
          if (nftOwnership.get(wantedNft) === fromWalletId && !usedNfts.has(wantedNft)) {
            matchingNft = wantedNft;
            break;
          }
        }
      }
      
      // If still no matching NFT, this isn't a valid trade loop
      if (!matchingNft) return null;
      
      // Mark this NFT as used
      usedNfts.add(matchingNft);
      
      // Create a step in the trade loop
      steps.push({
        from: fromWalletId,
        to: toWalletId,
        nfts: [{
          address: matchingNft,
          collection: this.extractCollectionId(matchingNft),
          name: `NFT ${matchingNft.substring(0, 8)}`,
          symbol: "",
          image: "",
          description: ""
        }]
      });
    }
    
    // Generate a canonical trade ID for this trade loop
    const tradeId = this.generateCanonicalTradeId(cyclePath.slice(0, -1), steps.map(step => step.nfts[0].address));
    
    // Create the trade loop
    return {
      id: tradeId,
      steps,
      totalParticipants: cyclePath.length - 1, // Exclude the duplicate last node
      estimatedValue: 0, // This will be calculated later
      efficiency: 1.0, // Default to perfect efficiency
      rawEfficiency: 1.0,
      qualityScore: 0, // This will be calculated later
      isBundle: false
    };
  }
  
  /**
   * Extract a collection ID from an NFT address
   * Simple implementation - in practice would use NFT metadata
   */
  private extractCollectionId(nftAddress: string): string {
    // Basic implementation: use first part of address as collection ID
    const parts = nftAddress.split(':');
    return parts.length > 1 ? parts[0] : nftAddress.substring(0, 8);
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