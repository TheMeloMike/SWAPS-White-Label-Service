/**
 * CanonicalCycleEngine
 * 
 * A unified, optimized cycle detection engine that discovers trade cycles in their
 * canonical form, eliminating combinatorial explosion and computational redundancy.
 * 
 * Key Features:
 * - Single canonical representation per logical cycle
 * - Efficient SCC-based preprocessing
 * - Early termination on canonical discovery
 * - Modular and testable architecture
 * - Linear scalability with graph complexity
 */

import { performance } from 'perf_hooks';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { TradeLoop, WalletState } from '../../types/trade';
import { SCCFinderService } from './SCCFinderService';

export interface CycleEngineConfig {
  maxDepth: number;
  timeoutMs: number;
  maxCyclesPerSCC: number;
  enableBundleDetection: boolean;
  canonicalOnly: boolean;
}

export interface CycleDiscoveryResult {
  cycles: TradeLoop[];
  metadata: {
    sccsProcessed: number;
    cyclesDiscovered: number;
    canonicalCyclesReturned: number;
    permutationsEliminated: number;
    processingTimeMs: number;
    timedOut: boolean;
  };
}

export class CanonicalCycleEngine {
  private static instance: CanonicalCycleEngine;
  private logger: Logger;
  private sccFinder: SCCFinderService;
  
  // Canonical cycle tracking
  private canonicalCycles = new Map<string, TradeLoop>();
  private cycleNormalizationCache = new Map<string, string>();
  
  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('CanonicalCycleEngine');
    this.sccFinder = SCCFinderService.getInstance();
  }

  public static getInstance(): CanonicalCycleEngine {
    if (!CanonicalCycleEngine.instance) {
      CanonicalCycleEngine.instance = new CanonicalCycleEngine();
    }
    return CanonicalCycleEngine.instance;
  }

  /**
   * Discover all canonical trade cycles in the given trade graph
   * 
   * @param wallets Map of wallet states
   * @param nftOwnership Map of NFT to owner
   * @param wantedNfts Map of NFT to set of wallets that want it
   * @param config Engine configuration
   * @returns CycleDiscoveryResult with canonical cycles and metadata
   */
  public async discoverCanonicalCycles(
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    config: CycleEngineConfig
  ): Promise<CycleDiscoveryResult> {
    const startTime = performance.now();
    const operation = this.logger.operation('discoverCanonicalCycles');
    
    // Clear previous state
    this.canonicalCycles.clear();
    this.cycleNormalizationCache.clear();
    
    operation.info('Starting canonical cycle discovery', {
      wallets: wallets.size,
      nfts: nftOwnership.size,
      wants: wantedNfts.size,
      config
    });

    try {
      // Phase 1: Build directed trade graph
      const tradeGraph = this.buildTradeGraph(wallets, nftOwnership, wantedNfts);
      
      // Phase 2: Find strongly connected components
      const sccResult = this.sccFinder.findStronglyConnectedComponents(
        tradeGraph, 
        Array.from(wallets.keys())
      );
      
      // Phase 3: Process each SCC for canonical cycles
      let totalCyclesDiscovered = 0;
      let permutationsEliminated = 0;
      
      for (const scc of sccResult.sccs) {
        if (scc.length < 2) continue; // Skip trivial SCCs
        
        const sccResult = await this.findCanonicalCyclesInSCC(
          scc, 
          tradeGraph, 
          wallets, 
          nftOwnership, 
          config
        );
        
        totalCyclesDiscovered += sccResult.rawCyclesFound;
        permutationsEliminated += sccResult.permutationsEliminated;
        
        // Early termination if timeout exceeded
        if (performance.now() - startTime > config.timeoutMs) {
          operation.warn('Timeout reached during SCC processing');
          break;
        }
      }
      
      const processingTime = performance.now() - startTime;
      const cycles = Array.from(this.canonicalCycles.values());
      
      const result: CycleDiscoveryResult = {
        cycles,
        metadata: {
          sccsProcessed: sccResult.sccs.length,
          cyclesDiscovered: totalCyclesDiscovered,
          canonicalCyclesReturned: cycles.length,
          permutationsEliminated,
          processingTimeMs: processingTime,
          timedOut: processingTime > config.timeoutMs
        }
      };
      
      operation.info('Canonical cycle discovery completed', result.metadata);
      operation.end();
      
      return result;
      
    } catch (error) {
      operation.error('Error in canonical cycle discovery', {
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Build directed trade graph from wallet states and wants
   */
  private buildTradeGraph(
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>
  ): { [key: string]: { [key: string]: string[] } } {
    const graph: { [key: string]: { [key: string]: string[] } } = {};
    
    // Initialize all wallet nodes
    for (const walletId of wallets.keys()) {
      graph[walletId] = {};
    }
    
    // Build edges: wallet A -> wallet B if A wants NFT owned by B
    for (const [nftId, wanters] of wantedNfts) {
      const owner = nftOwnership.get(nftId);
      if (!owner) continue;
      
      for (const wanter of wanters) {
        if (wanter === owner) continue; // Skip self-loops
        
        if (!graph[wanter][owner]) {
          graph[wanter][owner] = [];
        }
        graph[wanter][owner].push(nftId);
      }
    }
    
    return graph;
  }

  /**
   * Find canonical cycles within a strongly connected component
   */
  private async findCanonicalCyclesInSCC(
    scc: string[],
    graph: { [key: string]: { [key: string]: string[] } },
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    config: CycleEngineConfig
  ): Promise<{ rawCyclesFound: number; permutationsEliminated: number }> {
    
    let rawCyclesFound = 0;
    let permutationsEliminated = 0;
    
    // Use lexicographically smallest wallet as canonical starting point
    const canonicalStart = scc.sort()[0];
    
    // DFS from canonical start only - eliminates rotation duplicates
    const visited = new Set<string>();
    const path: string[] = [];
    
    this.canonicalDFS(
      canonicalStart,
      canonicalStart,
      graph,
      visited,
      path,
      scc,
      wallets,
      nftOwnership,
      config,
      { rawCyclesFound: () => rawCyclesFound++, permutationsEliminated: () => permutationsEliminated++ }
    );
    
    return { rawCyclesFound, permutationsEliminated };
  }

  /**
   * Canonical DFS - only discovers cycles in their canonical form
   */
  private canonicalDFS(
    startNode: string,
    currentNode: string,
    graph: { [key: string]: { [key: string]: string[] } },
    visited: Set<string>,
    path: string[],
    sccNodes: string[],
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    config: CycleEngineConfig,
    metrics: { rawCyclesFound: () => void; permutationsEliminated: () => void }
  ): void {
    
    // Early termination checks
    if (path.length >= config.maxDepth) return;
    
    path.push(currentNode);
    visited.add(currentNode);
    
    const neighbors = graph[currentNode] || {};
    
    for (const [neighbor, nfts] of Object.entries(neighbors)) {
      // Skip if neighbor not in current SCC
      if (!sccNodes.includes(neighbor)) continue;
      
      if (neighbor === startNode && path.length > 1) {
        // Found a cycle back to start
        metrics.rawCyclesFound();
        
        // Check if this is the canonical representation
        const cycleKey = this.generateCanonicalCycleKey([...path]);
        
        if (!this.canonicalCycles.has(cycleKey)) {
          // This is a new canonical cycle
          const tradeLoop = this.constructTradeLoop(path, graph, wallets, nftOwnership);
          if (tradeLoop) {
            this.canonicalCycles.set(cycleKey, tradeLoop);
          }
        } else {
          // This is a permutation of an existing canonical cycle
          metrics.permutationsEliminated();
        }
        
      } else if (!visited.has(neighbor)) {
        // Continue DFS
        this.canonicalDFS(
          startNode,
          neighbor,
          graph,
          visited,
          path,
          sccNodes,
          wallets,
          nftOwnership,
          config,
          metrics
        );
      }
    }
    
    // Backtrack
    path.pop();
    visited.delete(currentNode);
  }

  /**
   * Generate canonical cycle key that's invariant to rotation and direction
   */
  private generateCanonicalCycleKey(cycle: string[]): string {
    // Find lexicographically smallest rotation
    let canonical = cycle;
    let minRotation = cycle.join('|');
    
    for (let i = 1; i < cycle.length; i++) {
      const rotation = [...cycle.slice(i), ...cycle.slice(0, i)];
      const rotationKey = rotation.join('|');
      if (rotationKey < minRotation) {
        minRotation = rotationKey;
        canonical = rotation;
      }
    }
    
    // Check reverse direction
    const reversed = [...canonical].reverse();
    const reversedKey = reversed.join('|');
    
    return minRotation < reversedKey ? minRotation : reversedKey;
  }

  /**
   * Construct TradeLoop object from discovered cycle path
   */
  private constructTradeLoop(
    path: string[],
    graph: { [key: string]: { [key: string]: string[] } },
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>
  ): TradeLoop | null {
    
    const steps = [];
    
    for (let i = 0; i < path.length; i++) {
      const from = path[i];
      const to = path[(i + 1) % path.length];
      
      const nfts = graph[from]?.[to] || [];
      if (nfts.length === 0) return null;
      
      steps.push({
        from,
        to,
        nfts: nfts.map(nftId => ({
          address: nftId,
          name: `NFT ${nftId.substring(0, 8)}`,
          symbol: '',
          image: '',
          description: '',
          collection: ''
        })),
        completed: false
      });
    }
    
    const canonicalId = this.generateCanonicalTradeId(
      path,
      steps.flatMap(step => step.nfts.map(nft => nft.address))
    );
    
    return {
      id: canonicalId,
      steps,
      totalParticipants: path.length,
      efficiency: 1.0,
      rawEfficiency: 1.0 / path.length,
      estimatedValue: 0,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      qualityScore: 1.0
    };
  }

  /**
   * Generate canonical trade ID
   */
  private generateCanonicalTradeId(participants: string[], nfts: string[]): string {
    const sortedParticipants = [...participants].sort();
    const sortedNfts = [...nfts].sort();
    const combined = sortedParticipants.join(',') + '|' + sortedNfts.join(',');
    return `canonical_${combined}`;
  }

  /**
   * Reset engine state
   */
  public reset(): void {
    this.canonicalCycles.clear();
    this.cycleNormalizationCache.clear();
  }

  /**
   * Get performance metrics
   */
  public getMetrics() {
    return {
      canonicalCyclesStored: this.canonicalCycles.size,
      cacheSize: this.cycleNormalizationCache.size
    };
  }
} 