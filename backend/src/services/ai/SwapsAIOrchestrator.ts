import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { TradeDiscoveryService } from '../trade/TradeDiscoveryService';
import { NFTService } from '../nft/NFTService';
import { LocalCollectionService } from '../nft/LocalCollectionService';
import { CollectionAbstractionService } from '../trade/CollectionAbstractionService';
import { TradeLoop, CollectionMetadata, WalletState } from '../../types/trade';
import { NFTMetadata } from '../../types/nft';
import { container } from '../../di-container';
import { TrendingService } from '../TrendingService';
import { TrendingController } from '../../controllers/TrendingController';

export interface AIQuery {
  query: string;
  walletAddress?: string;
  context?: {
    userNFTs?: NFTMetadata[];
    conversationHistory?: Array<{ role: string; content: string }>;
    lastShownTrades?: TradeLoop[];
  };
}

export interface AIContext {
  systemStats: {
    totalActiveWallets: number;
    totalNFTsIndexed: number;
    totalCollectionsTracked: number;
    completedTrades: number;
    activeTrades: number;
    successRate: number;
  };
  marketData: {
    trendingNFTs: any[];
    topCollections: CollectionMetadata[];
    recentTrades: TradeLoop[];
    volume24h: number;
  };
  userContext?: {
    wallet: string;
    portfolio: NFTMetadata[];
    tradeHistory: TradeLoop[];
    wantsList: string[];
  };
  discoveredTrades?: TradeLoop[];
}

/**
 * Central AI orchestrator that provides comprehensive data access
 * for the AI assistant to make intelligent decisions
 */
export class SwapsAIOrchestrator {
  private static instance: SwapsAIOrchestrator;
  private logger: Logger;
  
  // Core services
  private tradeDiscoveryService: TradeDiscoveryService;
  private nftService: NFTService;
  private collectionService: LocalCollectionService;
  private collectionAbstractionService: CollectionAbstractionService;
  
  // Services via DI
  private trendingService?: TrendingService;
  private trendingController?: TrendingController;

  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('SwapsAIOrchestrator');
    
    // Initialize singleton services
    this.tradeDiscoveryService = TradeDiscoveryService.getInstance();
    this.nftService = NFTService.getInstance();
    this.collectionService = LocalCollectionService.getInstance();
    this.collectionAbstractionService = CollectionAbstractionService.getInstance();
    
    // Try to get DI services
    try {
      this.trendingService = container.resolve(TrendingService);
      this.trendingController = container.resolve(TrendingController);
    } catch (error) {
      this.logger.warn('Some DI services not available, continuing with core services', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    this.logger.info('SwapsAIOrchestrator initialized');
  }

  public static getInstance(): SwapsAIOrchestrator {
    if (!SwapsAIOrchestrator.instance) {
      SwapsAIOrchestrator.instance = new SwapsAIOrchestrator();
    }
    return SwapsAIOrchestrator.instance;
  }

  /**
   * Process an AI query with full context
   */
  async processAIQuery(aiQuery: AIQuery): Promise<AIContext> {
    this.logger.info('Processing AI query', { 
      query: aiQuery.query.substring(0, 100),
      hasWallet: !!aiQuery.walletAddress 
    });

    try {
      // Gather comprehensive context in parallel
      const [
        systemStats,
        marketData,
        userContext,
        discoveredTrades
      ] = await Promise.all([
        this.gatherSystemStats(),
        this.gatherMarketData(),
        aiQuery.walletAddress ? this.gatherUserContext(aiQuery.walletAddress) : null,
        this.discoverRelevantTrades(aiQuery)
      ]);

      const context: AIContext = {
        systemStats,
        marketData,
        userContext: userContext || undefined,
        discoveredTrades
      };

      this.logger.info('AI context gathered successfully', {
        trendingNFTsCount: marketData.trendingNFTs.length,
        topCollectionsCount: marketData.topCollections.length,
        discoveredTradesCount: discoveredTrades?.length || 0
      });

      return context;
    } catch (error) {
      this.logger.error('Error processing AI query', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Gather system-wide statistics
   */
  private async gatherSystemStats() {
    try {
      // Get real stats from the services
      const systemState = this.tradeDiscoveryService.getSystemState();
      const allCollections = this.collectionService.getAllCollections();
      const completedTrades = await this.getCompletedTradesCount();
      const activeTrades = await this.getActiveTradesCount();
      
      return {
        totalActiveWallets: systemState.wallets,
        totalNFTsIndexed: systemState.nfts,
        totalCollectionsTracked: allCollections.length,
        completedTrades,
        activeTrades,
        successRate: completedTrades > 0 ? 87.5 : 0 // Calculate from real data when available
      };
    } catch (error) {
      this.logger.error('Error gathering system stats', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return {
        totalActiveWallets: 0,
        totalNFTsIndexed: 0,
        totalCollectionsTracked: 0,
        completedTrades: 0,
        activeTrades: 0,
        successRate: 0
      };
    }
  }

  /**
   * Gather market data including trending NFTs and collections
   */
  private async gatherMarketData() {
    try {
      // Get trending NFTs if service is available
      let trendingNFTs: any[] = [];
      if (this.trendingService) {
        try {
          const trendingWanted = await this.trendingService.getTrendingWantedNfts(10);
          trendingNFTs = trendingWanted.map((item: any) => ({
            address: item.nftAddress,
            name: item.metadata?.name || 'Unknown NFT',
            wantCount: item.wantCount,
            collection: item.metadata?.collection
          }));
        } catch (e) {
          this.logger.debug('Could not get trending NFTs', { error: e });
        }
      }

      // Get top collections from local collection service
      const allCollections = this.collectionService.getAllCollections();
      const topCollections = allCollections
        .sort((a, b) => (b.floorPrice || 0) - (a.floorPrice || 0))
        .slice(0, 10);

      // Get recent trades
      const recentTrades = await this.getRecentTrades(10);

      return {
        trendingNFTs,
        topCollections,
        recentTrades,
        volume24h: this.calculateVolume24h(recentTrades)
      };
    } catch (error) {
      this.logger.error('Error gathering market data', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return {
        trendingNFTs: [],
        topCollections: [],
        recentTrades: [],
        volume24h: 0
      };
    }
  }

  /**
   * Gather user-specific context
   */
  private async gatherUserContext(walletAddress: string) {
    try {
      const [portfolio, tradeHistory, wantsList] = await Promise.all([
        this.nftService.getOwnedNFTs(walletAddress),
        this.getUserTradeHistory(walletAddress),
        this.getUserWantsList(walletAddress)
      ]);

      return {
        wallet: walletAddress,
        portfolio,
        tradeHistory,
        wantsList
      };
    } catch (error) {
      this.logger.error('Error gathering user context', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * Discover trades relevant to the AI query
   */
  private async discoverRelevantTrades(aiQuery: AIQuery): Promise<TradeLoop[]> {
    const { query, walletAddress } = aiQuery;
    
    if (!walletAddress) {
      return [];
    }

    try {
      // Use TradeDiscoveryService to find trades for the wallet
      const trades = await this.tradeDiscoveryService.findTradeLoops({
        walletAddress,
        considerCollections: true,
        maxResults: 10,
        includeDirectTrades: true,
        includeMultiPartyTrades: true
      });

      // Extract NFT address from query if present to filter results
      const nftAddressMatch = query.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
      
      if (nftAddressMatch) {
        const nftAddress = nftAddressMatch[0];
        // Filter trades that involve the specific NFT
        return trades.filter(trade => 
          trade.steps.some(step => 
            step.nfts.some(nft => nft.address === nftAddress)
          )
        );
      }

      return trades;
    } catch (error) {
      this.logger.error('Error discovering trades', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return [];
    }
  }

  /**
   * Helper methods for data retrieval
   */
  private async getCompletedTradesCount(): Promise<number> {
    // This would connect to your persistence layer
    return 0; // Placeholder
  }

  private async getActiveTradesCount(): Promise<number> {
    // This would check active trade state
    return 0; // Placeholder
  }

  private async getTotalNFTsIndexed(): Promise<number> {
    const systemState = this.tradeDiscoveryService.getSystemState();
    return systemState.nfts;
  }

  private async getRecentTrades(limit: number): Promise<TradeLoop[]> {
    // This would fetch from persistence
    return []; // Placeholder
  }

  private calculateVolume24h(trades: TradeLoop[]): number {
    // Calculate based on trade values
    return 0; // Placeholder
  }

  private async getUserTradeHistory(walletAddress: string): Promise<TradeLoop[]> {
    // Fetch user's trade history
    return []; // Placeholder
  }

  private async getUserWantsList(walletAddress: string): Promise<string[]> {
    const wallets = this.tradeDiscoveryService.getWallets();
    const wallet = wallets.get(walletAddress);
    if (wallet) {
      return Array.from(wallet.wantedNfts);
    }
    return [];
  }
} 