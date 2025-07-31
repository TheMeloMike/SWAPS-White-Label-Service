import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { 
  TenantTradeGraph, 
  AbstractNFT, 
  AbstractWallet, 
  GraphChange 
} from '../../types/abstract';
import { TradeLoop } from '../../types/trade';

/**
 * Subgraph data for focused trade discovery
 */
export interface SubgraphData {
  affectedWallets: Set<string>;
  affectedNFTs: Set<string>;
  affectedCollections: Set<string>;
  connectedComponents: string[][];
  changeReason: string;
  estimatedComplexity: 'low' | 'medium' | 'high';
}

/**
 * Delta Detection Engine
 * 
 * Identifies which parts of the trade graph are affected by changes
 * and only recalculates those subgraphs for real-time performance.
 * 
 * This is critical for persistent state trade awareness - instead of
 * recomputing the entire graph on every change, we only process
 * the affected portions.
 */
export class DeltaDetectionEngine {
  private logger: Logger;
  
  // Performance tracking
  private detectionMetrics = {
    totalDetections: 0,
    avgDetectionTime: 0,
    subgraphSizeReductions: [] as number[]
  };

  constructor() {
    this.logger = LoggingService.getInstance().createLogger('DeltaDetectionEngine');
  }

  /**
   * Detect which part of the graph is affected by adding an NFT
   */
  public getAffectedSubgraphByNFTAddition(
    graph: TenantTradeGraph, 
    nft: AbstractNFT
  ): SubgraphData {
    const startTime = Date.now();
    const operation = this.logger.operation('getAffectedSubgraphByNFTAddition');
    
    try {
      // Find wallets that want this specific NFT
      const directWanters = this.findWalletsWantingNFT(graph, nft.id);
      
      // Find wallets that want NFTs from this collection
      const collectionWanters = nft.collection 
        ? this.findWalletsWantingCollection(graph, nft.collection.id)
        : new Set<string>();
      
      // Combine interested wallets
      const interestedWallets = new Set([...directWanters, ...collectionWanters]);
      
      // Add the owner of this NFT
      interestedWallets.add(nft.ownership.ownerId);
      
      // Find connected wallets (wallets that own NFTs wanted by interested wallets)
      const connectedWallets = this.findConnectedWallets(graph, interestedWallets);
      
      // Build the subgraph
      const subgraph = this.buildSubgraph(
        graph, 
        connectedWallets,
        new Set([nft.id]),
        nft.collection ? new Set([nft.collection.id]) : new Set(),
        `NFT ${nft.id} added to wallet ${nft.ownership.ownerId}`
      );
      
      operation.info('NFT addition subgraph detected', {
        nftId: nft.id,
        ownerId: nft.ownership.ownerId,
        directWanters: directWanters.size,
        collectionWanters: collectionWanters.size,
        totalAffectedWallets: subgraph.affectedWallets.size,
        detectionTime: Date.now() - startTime
      });
      
      operation.end();
      this.updateMetrics(Date.now() - startTime, subgraph.affectedWallets.size, graph.wallets.size);
      
      return subgraph;
    } catch (error) {
      operation.error('Failed to detect NFT addition subgraph', {
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Detect which part of the graph is affected by adding a want
   */
  public getAffectedSubgraphByWantAddition(
    graph: TenantTradeGraph,
    walletId: string,
    wantedNFTId: string
  ): SubgraphData {
    const operation = this.logger.operation('getAffectedSubgraphByWantAddition');
    
    try {
      // Find who owns the wanted NFT
      const ownerId = this.findNFTOwner(graph, wantedNFTId);
      
      if (!ownerId) {
        // NFT not in system yet, minimal subgraph
        return this.buildMinimalSubgraph(
          walletId,
          wantedNFTId,
          `Want added for non-existent NFT ${wantedNFTId}`
        );
      }
      
      // Find potential trade paths starting from the wanter
      const affectedWallets = new Set([walletId, ownerId]);
      
      // Find wallets that the wanter owns NFTs that others want
      const wanterWallet = graph.wallets.get(walletId);
      if (wanterWallet) {
        for (const ownedNFT of wanterWallet.ownedNFTs) {
          const wanters = graph.wants.get(ownedNFT.id);
          if (wanters) {
            wanters.forEach(w => affectedWallets.add(w));
          }
        }
      }
      
      // Find wallets that the owner wants NFTs from
      const ownerWallet = graph.wallets.get(ownerId);
      if (ownerWallet) {
        for (const wantedNFT of ownerWallet.wantedNFTs) {
          const owner = this.findNFTOwner(graph, wantedNFT);
          if (owner) {
            affectedWallets.add(owner);
          }
        }
      }
      
      const subgraph = this.buildSubgraph(
        graph,
        affectedWallets,
        new Set([wantedNFTId]),
        new Set(),
        `Want added: ${walletId} wants ${wantedNFTId}`
      );
      
      operation.info('Want addition subgraph detected', {
        walletId,
        wantedNFTId,
        ownerId,
        affectedWallets: subgraph.affectedWallets.size
      });
      
      operation.end();
      return subgraph;
    } catch (error) {
      operation.error('Failed to detect want addition subgraph', {
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Detect which part of the graph is affected by removing an NFT
   */
  public getAffectedSubgraphByNFTRemoval(
    graph: TenantTradeGraph,
    nftId: string
  ): SubgraphData {
    const operation = this.logger.operation('getAffectedSubgraphByNFTRemoval');
    
    try {
      // Find all wallets that want this NFT
      const wanters = graph.wants.get(nftId) || new Set();
      
      // Find any active trade loops involving this NFT
      const affectedLoops = this.findLoopsContainingNFT(graph, nftId);
      
      // Collect all wallets from affected loops
      const affectedWallets = new Set<string>();
      for (const loop of affectedLoops) {
        loop.steps.forEach(step => {
          affectedWallets.add(step.from);
          affectedWallets.add(step.to);
        });
      }
      
      // Add direct wanters
      wanters.forEach(w => affectedWallets.add(w));
      
      const subgraph = this.buildSubgraph(
        graph,
        affectedWallets,
        new Set([nftId]),
        new Set(),
        `NFT ${nftId} removed from system`
      );
      
      operation.info('NFT removal subgraph detected', {
        nftId,
        directWanters: wanters.size,
        affectedLoops: affectedLoops.length,
        affectedWallets: subgraph.affectedWallets.size
      });
      
      operation.end();
      return subgraph;
    } catch (error) {
      operation.error('Failed to detect NFT removal subgraph', {
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Find wallets that want a specific NFT
   */
  private findWalletsWantingNFT(graph: TenantTradeGraph, nftId: string): Set<string> {
    return graph.wants.get(nftId) || new Set();
  }

  /**
   * Find wallets that want any NFT from a collection
   */
  private findWalletsWantingCollection(graph: TenantTradeGraph, collectionId: string): Set<string> {
    return graph.collectionWants.get(collectionId) || new Set();
  }

  /**
   * Find wallets connected through trade relationships
   */
  private findConnectedWallets(
    graph: TenantTradeGraph, 
    seedWallets: Set<string>
  ): Set<string> {
    const connected = new Set(seedWallets);
    const toProcess = Array.from(seedWallets);
    
    // BFS to find connected wallets within 2 degrees
    const maxDepth = 2;
    let currentDepth = 0;
    
    while (toProcess.length > 0 && currentDepth < maxDepth) {
      const currentBatch = toProcess.splice(0);
      
      for (const walletId of currentBatch) {
        const wallet = graph.wallets.get(walletId);
        if (!wallet) continue;
        
        // Find wallets that want this wallet's NFTs
        for (const ownedNFT of wallet.ownedNFTs) {
          const wanters = graph.wants.get(ownedNFT.id);
          if (wanters) {
            for (const wanter of wanters) {
              if (!connected.has(wanter)) {
                connected.add(wanter);
                toProcess.push(wanter);
              }
            }
          }
        }
        
        // Find wallets that own this wallet's wanted NFTs
        for (const wantedNFT of wallet.wantedNFTs) {
          const owner = this.findNFTOwner(graph, wantedNFT);
          if (owner && !connected.has(owner)) {
            connected.add(owner);
            toProcess.push(owner);
          }
        }
      }
      
      currentDepth++;
    }
    
    return connected;
  }

  /**
   * Find the owner of an NFT
   */
  private findNFTOwner(graph: TenantTradeGraph, nftId: string): string | null {
    const nft = graph.nfts.get(nftId);
    return nft ? nft.ownership.ownerId : null;
  }

  /**
   * Find trade loops that contain a specific NFT
   */
  private findLoopsContainingNFT(graph: TenantTradeGraph, nftId: string): TradeLoop[] {
    const containingLoops: TradeLoop[] = [];
    
    for (const loop of graph.activeLoops.values()) {
      const containsNFT = loop.steps.some(step => 
        step.nfts.some(nft => nft.address === nftId)
      );
      
      if (containsNFT) {
        containingLoops.push(loop);
      }
    }
    
    return containingLoops;
  }

  /**
   * Build a subgraph from affected components
   */
  private buildSubgraph(
    graph: TenantTradeGraph,
    affectedWallets: Set<string>,
    affectedNFTs: Set<string>,
    affectedCollections: Set<string>,
    changeReason: string
  ): SubgraphData {
    // Group wallets into connected components for parallel processing
    const connectedComponents = this.findConnectedComponents(graph, affectedWallets);
    
    // Estimate complexity based on size
    const estimatedComplexity = this.estimateComplexity(affectedWallets.size);
    
    return {
      affectedWallets,
      affectedNFTs,
      affectedCollections,
      connectedComponents,
      changeReason,
      estimatedComplexity
    };
  }

  /**
   * Build minimal subgraph for edge cases
   */
  private buildMinimalSubgraph(
    walletId: string,
    nftId: string,
    changeReason: string
  ): SubgraphData {
    return {
      affectedWallets: new Set([walletId]),
      affectedNFTs: new Set([nftId]),
      affectedCollections: new Set(),
      connectedComponents: [[walletId]],
      changeReason,
      estimatedComplexity: 'low'
    };
  }

  /**
   * Find connected components within affected wallets
   */
  private findConnectedComponents(
    graph: TenantTradeGraph,
    affectedWallets: Set<string>
  ): string[][] {
    const visited = new Set<string>();
    const components: string[][] = [];
    
    for (const walletId of affectedWallets) {
      if (!visited.has(walletId)) {
        const component = this.dfsComponent(graph, walletId, affectedWallets, visited);
        if (component.length > 0) {
          components.push(component);
        }
      }
    }
    
    return components;
  }

  /**
   * DFS to find a connected component
   */
  private dfsComponent(
    graph: TenantTradeGraph,
    startWallet: string,
    affectedWallets: Set<string>,
    visited: Set<string>
  ): string[] {
    const component: string[] = [];
    const stack = [startWallet];
    
    while (stack.length > 0) {
      const walletId = stack.pop()!;
      
      if (visited.has(walletId)) continue;
      visited.add(walletId);
      component.push(walletId);
      
      const wallet = graph.wallets.get(walletId);
      if (!wallet) continue;
      
      // Find connected wallets through trade relationships
      for (const ownedNFT of wallet.ownedNFTs) {
        const wanters = graph.wants.get(ownedNFT.id);
        if (wanters) {
          for (const wanter of wanters) {
            if (affectedWallets.has(wanter) && !visited.has(wanter)) {
              stack.push(wanter);
            }
          }
        }
      }
    }
    
    return component;
  }

  /**
   * Estimate computational complexity
   */
  private estimateComplexity(walletCount: number): 'low' | 'medium' | 'high' {
    if (walletCount <= 5) return 'low';
    if (walletCount <= 20) return 'medium';
    return 'high';
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(detectionTime: number, subgraphSize: number, totalGraphSize: number): void {
    this.detectionMetrics.totalDetections++;
    
    // Update average detection time
    this.detectionMetrics.avgDetectionTime = 
      (this.detectionMetrics.avgDetectionTime * (this.detectionMetrics.totalDetections - 1) + detectionTime) / 
      this.detectionMetrics.totalDetections;
    
    // Track size reduction
    const reductionRatio = 1 - (subgraphSize / totalGraphSize);
    this.detectionMetrics.subgraphSizeReductions.push(reductionRatio);
    
    // Keep only last 100 measurements
    if (this.detectionMetrics.subgraphSizeReductions.length > 100) {
      this.detectionMetrics.subgraphSizeReductions.shift();
    }
  }

  /**
   * Get performance metrics
   */
  public getMetrics() {
    const avgReduction = this.detectionMetrics.subgraphSizeReductions.length > 0
      ? this.detectionMetrics.subgraphSizeReductions.reduce((a, b) => a + b, 0) / 
        this.detectionMetrics.subgraphSizeReductions.length
      : 0;
    
    return {
      totalDetections: this.detectionMetrics.totalDetections,
      avgDetectionTime: this.detectionMetrics.avgDetectionTime,
      avgSubgraphReduction: avgReduction,
      performanceGain: avgReduction > 0 ? `${(avgReduction * 100).toFixed(1)}% smaller subgraphs` : 'No data'
    };
  }
} 