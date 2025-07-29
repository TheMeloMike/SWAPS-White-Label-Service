import { NFTIndexer } from './indexer';
import { PathFinder } from './pathfinder';
import { TradeLoop, NFTMetadata } from './types';
import { TradeVisualizer } from './visualizer';

export class TradeDiscoveryService {
  private indexer: NFTIndexer;
  private pathFinder: PathFinder;
  private visualizer: TradeVisualizer;

  constructor() {
    this.indexer = new NFTIndexer();
    this.pathFinder = new PathFinder();
    this.visualizer = new TradeVisualizer();
  }

  async findPotentialTrades(
    targetNFT: string,
    userWallet: string,
    connectedWallets: string[]
  ): Promise<TradeLoop[]> {
    // Index NFTs
    const nftIndex = await this.indexer.indexConnectedWallets(connectedWallets);
    
    // Find trade paths with visualization
    const paths = await this.pathFinder.findTradePaths(
      targetNFT,
      userWallet,
      nftIndex
    );

    // Visualize results
    paths.forEach(path => {
      console.log(this.visualizer.visualizeTradeLoop(path));
    });

    return paths;
  }

  // ... rest of the implementation
} 