import { NFTMetadata, TradeStep, WalletNFTs } from './types';
import { Worker } from 'worker_threads';
import { PriorityQueue } from './utils/priority-queue';

interface Node {
  walletAddress: string;
  nfts: NFTMetadata[];
  visited: boolean;
}

interface TradePathContext {
  targetNFT: NFTMetadata;
  startWallet: string;
  maxDepth: number;
  minEfficiency: number;
}

export class PathFinder {
  private readonly PARALLEL_WORKERS = 4;
  private readonly MAX_PATHS_PER_TARGET = 10;
  private readonly MIN_PATH_SCORE = 0.75;
  private readonly MAX_DEPTH = 11; // Limit loop size for performance
  private readonly MIN_EFFICIENCY = 0.7; // Minimum trade efficiency threshold
  private readonly EFFICIENCY_THRESHOLD = 0.8;
  private readonly VALUE_VARIANCE_THRESHOLD = 0.3;

  // Advanced pruning strategies
  private pruningStrategies = {
    valueAlignment: {
      threshold: 0.2,  // 20% variance allowed
      weight: 0.4
    },
    pathLength: {
      optimal: 3,
      maxPenalty: 0.3,
      weight: 0.2
    },
    marketLiquidity: {
      threshold: 0.5,
      weight: 0.2
    },
    historicalSuccess: {
      threshold: 0.6,
      weight: 0.2
    }
  };

  async findTradePaths(
    targetNFT: NFTMetadata,
    startWallet: string,
    nftIndex: Map<string, NFTMetadata[]>
  ): Promise<TradeStep[][]> {
    const pathQueue = new PriorityQueue<TradeStep[]>();
    const workers: Worker[] = [];
    const results: TradeStep[][] = [];

    // Initialize workers for parallel processing
    for (let i = 0; i < this.PARALLEL_WORKERS; i++) {
      workers.push(this.createWorker());
    }

    try {
      const initialPaths = await this.generateInitialPaths(
        targetNFT,
        startWallet,
        nftIndex
      );

      initialPaths.forEach(path => {
        const score = this.calculatePathScore(path);
        pathQueue.enqueue(path, score);
      });

      while (!pathQueue.isEmpty() && results.length < this.MAX_PATHS_PER_TARGET) {
        const currentPath = pathQueue.dequeue();
        if (!currentPath) break;

        if (this.shouldPrunePath(currentPath)) {
          continue;
        }

        const workerResults = await this.distributePathToWorkers(
          currentPath,
          workers,
          nftIndex
        );

        for (const result of workerResults) {
          if (this.isValidPath(result)) {
            results.push(result);
          }
        }
      }

      return results;
    } finally {
      workers.forEach(worker => worker.terminate());
    }
  }

  private shouldPrunePath(path: TradeStep[]): boolean {
    const scores = {
      valueAlignment: this.calculateValueAlignmentScore(path),
      pathLength: this.calculatePathLengthScore(path),
      marketLiquidity: this.calculateMarketLiquidityScore(path),
      historicalSuccess: this.calculateHistoricalSuccessScore(path)
    };

    const weightedScore = Object.entries(scores).reduce((total, [key, score]) => {
      const strategy = this.pruningStrategies[key as keyof typeof this.pruningStrategies];
      return total + (score * strategy.weight);
    }, 0);

    return weightedScore < this.MIN_PATH_SCORE;
  }

  private async findTradeLoopsDFS(
    currentWallet: string,
    graph: Map<string, Node>,
    visited: Set<string>,
    currentPath: TradeStep[],
    allPaths: TradeStep[][],
    context: TradePathContext
  ): Promise<void> {
    // Base case: Path is too long
    if (currentPath.length >= context.maxDepth) {
      return;
    }

    visited.add(currentWallet);
    const currentNode = graph.get(currentWallet);
    if (!currentNode) return;

    // For each wallet that could be the next step in the trade
    for (const [nextWallet, nextNode] of graph.entries()) {
      if (visited.has(nextWallet)) {
        // Check if we've found a valid loop back to start
        if (
          nextWallet === context.startWallet &&
          currentPath.length >= 2 &&
          this.isValidTradeLoop(currentPath, context)
        ) {
          allPaths.push([...currentPath]);
        }
        continue;
      }

      // Find possible trades between current wallet and next wallet
      const possibleTrades = this.findPossibleTrades(
        currentNode.nfts,
        nextNode.nfts
      );

      for (const trade of possibleTrades) {
        currentPath.push(trade);
        await this.findTradeLoopsDFS(
          nextWallet,
          graph,
          new Set(visited),
          currentPath,
          allPaths,
          context
        );
        currentPath.pop();
      }
    }

    visited.delete(currentWallet);
  }

  private findPossibleTrades(
    sourceNFTs: NFTMetadata[],
    targetNFTs: NFTMetadata[]
  ): TradeStep[] {
    const trades: TradeStep[] = [];
    
    // Find NFTs of similar value that could be traded
    for (const sourceNFT of sourceNFTs) {
      for (const targetNFT of targetNFTs) {
        const efficiency = this.calculateTradeEfficiency(sourceNFT, targetNFT);
        if (efficiency >= this.MIN_EFFICIENCY) {
          trades.push({
            from: sourceNFT.owner!,
            to: targetNFT.owner!,
            nfts: [sourceNFT],
            solAdjustment: this.calculateSolAdjustment(sourceNFT, targetNFT)
          });
        }
      }
    }

    return trades;
  }

  private isValidTradeLoop(
    path: TradeStep[],
    context: TradePathContext
  ): boolean {
    // Verify the loop includes the target NFT
    const hasTargetNFT = path.some(step =>
      step.nfts.some(nft => nft.address === context.targetNFT.address)
    );

    // Calculate total efficiency of the loop
    const totalEfficiency = this.calculateLoopEfficiency(path);

    return hasTargetNFT && totalEfficiency >= context.minEfficiency;
  }

  private calculateTradeEfficiency(
    nft1: NFTMetadata,
    nft2: NFTMetadata
  ): number {
    // Calculate how well the NFTs match in value
    const value1 = nft1.estimatedValue || 0;
    const value2 = nft2.estimatedValue || 0;
    
    if (value1 === 0 || value2 === 0) return 0;
    
    const ratio = Math.min(value1, value2) / Math.max(value1, value2);
    return ratio;
  }

  private calculateLoopEfficiency(path: TradeStep[]): number {
    let totalEfficiency = 1;
    for (const step of path) {
      // Calculate combined efficiency of all trades in the loop
      const stepEfficiency = this.calculateStepEfficiency(step);
      totalEfficiency *= stepEfficiency;
    }
    return totalEfficiency;
  }

  private calculateStepEfficiency(step: TradeStep): number {
    // Consider both NFT value match and SOL adjustments
    const baseEfficiency = 0.95; // Base efficiency for a direct trade
    const solAdjustmentImpact = step.solAdjustment 
      ? Math.max(0, 1 - (Math.abs(step.solAdjustment) / 100))
      : 1;
    
    return baseEfficiency * solAdjustmentImpact;
  }

  private calculateSolAdjustment(
    nft1: NFTMetadata,
    nft2: NFTMetadata
  ): number {
    // Calculate SOL needed to balance the trade
    const value1 = nft1.estimatedValue || 0;
    const value2 = nft2.estimatedValue || 0;
    return value2 - value1;
  }

  private buildTradeGraph(
    nftIndex: Map<string, NFTMetadata[]>
  ): Map<string, Node> {
    const graph = new Map<string, Node>();
    
    for (const [wallet, nfts] of nftIndex.entries()) {
      graph.set(wallet, {
        walletAddress: wallet,
        nfts,
        visited: false
      });
    }

    return graph;
  }

  private calculatePathValueVariance(path: TradeStep[]): number {
    if (path.length === 0) return 0;

    const values = path.flatMap(step => 
      step.nfts.map(nft => nft.estimatedValue || 0)
    );
    
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, val) => 
      acc + Math.pow(val - avg, 2), 0) / values.length;
    
    return Math.sqrt(variance) / avg; // Normalized variance
  }

  private canReachTargetNFT(
    currentPath: TradeStep[],
    targetNFT: NFTMetadata
  ): boolean {
    // Check if remaining wallets have NFTs of similar value
    const currentValue = this.getPathValue(currentPath);
    const remainingWallets = this.getRemainingWallets(currentPath);
    
    return remainingWallets.some(wallet => 
      this.hasCompatibleNFTs(wallet, currentValue, targetNFT)
    );
  }

  private calculateValueAlignmentScore(path: TradeStep[]): number {
    // Implementation of calculateValueAlignmentScore
    return 0.8; // Placeholder return, actual implementation needed
  }

  private calculatePathLengthScore(path: TradeStep[]): number {
    // Implementation of calculatePathLengthScore
    return 0.8; // Placeholder return, actual implementation needed
  }

  private calculateMarketLiquidityScore(path: TradeStep[]): number {
    // Implementation of calculateMarketLiquidityScore
    return 0.8; // Placeholder return, actual implementation needed
  }

  private calculateHistoricalSuccessScore(path: TradeStep[]): number {
    // Implementation of calculateHistoricalSuccessScore
    return 0.8; // Placeholder return, actual implementation needed
  }

  private calculatePathScore(path: TradeStep[]): number {
    // Implementation of calculatePathScore
    return 0.8; // Placeholder return, actual implementation needed
  }

  private isValidPath(path: TradeStep[]): boolean {
    // Implementation of isValidPath
    return true; // Placeholder return, actual implementation needed
  }

  private getPathValue(path: TradeStep[]): number {
    // Implementation of getPathValue
    return 0; // Placeholder return, actual implementation needed
  }

  private getRemainingWallets(path: TradeStep[]): string[] {
    // Implementation of getRemainingWallets
    return []; // Placeholder return, actual implementation needed
  }

  private hasCompatibleNFTs(
    wallet: string,
    currentValue: number,
    targetNFT: NFTMetadata
  ): boolean {
    // Implementation of hasCompatibleNFTs
    return true; // Placeholder return, actual implementation needed
  }

  private createWorker(): Worker {
    // Implementation of createWorker
    return new Worker(() => {}); // Placeholder return, actual implementation needed
  }

  private distributePathToWorkers(
    path: TradeStep[],
    workers: Worker[],
    nftIndex: Map<string, NFTMetadata[]>
  ): Promise<TradeStep[][]> {
    // Implementation of distributePathToWorkers
    return Promise.all(workers.map(() => this.findTradePaths(path[0].nfts[0], path[0].from, nftIndex))); // Placeholder return, actual implementation needed
  }

  private generateInitialPaths(
    targetNFT: NFTMetadata,
    startWallet: string,
    nftIndex: Map<string, NFTMetadata[]>
  ): Promise<TradeStep[][]> {
    // Implementation of generateInitialPaths
    return Promise.all([this.findTradePaths(targetNFT, startWallet, nftIndex)]); // Placeholder return, actual implementation needed
  }
} 