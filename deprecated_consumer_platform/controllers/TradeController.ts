import { Request, Response } from 'express';
import crypto from 'crypto';
import { PublicKey, Connection } from '@solana/web3.js';
import { TradeDiscoveryService } from '../services/trade/TradeDiscoveryService';
import { NFTService } from '../services/nft/NFTService';
import { NFTMetadata } from '../types/nft';
import { RejectionPreferences, TradeLoop } from '../types/trade';
import { KafkaIntegrationService } from '../services/trade/KafkaIntegrationService';
import { LoggingService, Logger } from '../utils/logging/LoggingService';
import { WalletService } from '../services/trade/WalletService';
import { ITradeDiscoveryService, ICacheService, ILogger } from '../types/services';
import { container } from '../di-container';
import { LATEST_GLOBAL_TRADES_CACHE_KEY } from '../services/TrendingService';
import { injectable, inject } from 'tsyringe';
import { Router } from 'express';

// Declare these functions as available on TradeDiscoveryService for TypeScript
declare module '../services/trade/TradeDiscoveryService' {
  interface TradeDiscoveryService {
    updateWalletState(walletAddress: string, forceRefresh?: boolean): Promise<any>;
    getAllWallets(): string[];
    getNFTOwnershipMap(): Record<string, string>;
    getRejections(walletAddress: string): RejectionPreferences | undefined;
    storeRejections(walletAddress: string, rejections: RejectionPreferences): void;
    recordTradeStepCompletion(tradeId: string, stepIndex: number, completionData: any): Promise<void>;
    walletExists(walletAddress: string): boolean;
    getTradesForWallet(walletAddress: string): Promise<any[]>;
    getDetailedSystemState(): any;
    storeTradeLoop(tradeId: string, steps: any[]): Promise<void>;
    getWallets(): Map<string, any>;
    getSystemState(): any;
    clearState(): void;
    registerManualNFTs(walletAddress: string, nftAddresses: string[]): void;
    rejectTrade(walletAddress: string, rejectedNftAddress: string, isNft: boolean): Promise<void>;
    findTradeLoops(settings?: any): Promise<TradeLoop[]>;
    getStoredTradeLoop(tradeId: string): Promise<TradeLoop | null>;
    addTradePreference(walletAddress: string, nftAddress: string): Promise<void>;
    getAllTradeKeys(): Promise<string[]>;
    addCollectionWant(walletAddress: string, collectionId: string): Promise<void>;
    getCollectionAbstractionService(): any;
    getCollectionMetadata(collectionId: string): any;
    getStats(): any;
  }
}

@injectable()
export class TradeController {
  private logger: ILogger;
  private readonly ENABLE_KAFKA: boolean;
  private cacheService: ICacheService;

  constructor(
    @inject("ITradeDiscoveryService") private tradeDiscoveryService: ITradeDiscoveryService,
    @inject("INFTService") private nftService: NFTService,
    @inject("IWalletService") private walletService: WalletService,
    @inject("ILoggingService") loggingServiceInstance: LoggingService,
    @inject("ICacheService") cacheService: ICacheService,
    @inject("KafkaIntegrationService") kafkaService?: KafkaIntegrationService
  ) {
    this.logger = loggingServiceInstance.createLogger('TradeController');
    this.cacheService = cacheService;
    
    if (kafkaService) {
      this.ENABLE_KAFKA = true;
      this.logger.info('KafkaIntegrationService is enabled and injected.');
    } else {
      this.ENABLE_KAFKA = false;
      this.logger.info('KafkaIntegrationService is not configured or not injected.');
    }
    this.logger.info('TradeController initialized with CacheService');
  }

  private validateNFTOwnership(
    nftAddress: string,
    expectedOwner: string,
    ownershipMap: Record<string, string>,
    metadata?: any
  ): boolean {
    const mappedOwner = ownershipMap[nftAddress];
    if (mappedOwner && mappedOwner !== expectedOwner) {
      this.logger.info(`Ownership validation failed: NFT ${nftAddress} - expected ${expectedOwner}, but ownership map says ${mappedOwner}`);
      const isShadowDriveNFT = metadata?.image?.includes('shdw-drive.genesysgo.net');
      if (isShadowDriveNFT) {
        this.logger.warn(`Shadow Drive NFT detected with ownership mismatch. Taking ownership from trade data as authoritative for ${nftAddress}`);
        return true;
      }
      return false;
    }
    if (metadata && metadata.owner && metadata.owner !== expectedOwner) {
      this.logger.info(`Ownership validation failed: NFT ${nftAddress} - expected ${expectedOwner}, but metadata says ${metadata.owner}`);
      const isShadowDriveNFT = metadata?.image?.includes('shdw-drive.genesysgo.net');
      if (isShadowDriveNFT) {
        this.logger.warn(`Shadow Drive NFT detected with ownership mismatch. Taking ownership from trade data as authoritative for ${nftAddress}`);
        return true;
      }
      return false;
    }
    return true;
  }
  
  public findTrades = async (req: Request, res: Response): Promise<Response> => {
    const tradeDiscovery = this.tradeDiscoveryService;
    try {
      const wallet = req.body.wallet || req.body.walletAddress;
      const nft = req.body.nft || req.body.desiredNft;
      const forceRefresh = req.body.forceRefresh;
      
      const considerCollections = req.body.considerCollections;
      const includeCollectionTrades = req.body.includeCollectionTrades;
      
      this.logger.info('Trade discovery request received', { 
        wallet, 
        nft, 
        considerCollections, 
        includeCollectionTrades 
      });
      
      // For collection trades, only wallet is required
      // For specific NFT trades, both wallet and NFT are required
      if (!wallet) {
        return res.status(400).json({ error: 'Wallet address is required' });
      }
      
      if (!nft && !considerCollections && !includeCollectionTrades) {
        return res.status(400).json({ error: 'NFT address is required for specific NFT trades. For collection trades, use considerCollections=true' });
      }
      
      const shouldForceRefresh = forceRefresh === 'true' || forceRefresh === true;
      await tradeDiscovery.updateWalletState(wallet, shouldForceRefresh);
      
      // Only add specific NFT preference if we have an NFT address
      if (nft) {
        // CRITICAL: Validate that this is not a self-want (user wanting NFT they already own)
        // Self-wants break the SCC algorithm by creating invalid self-loops
        const wallets = tradeDiscovery.getWallets();
        const walletState = wallets.get(wallet);
        
        if (walletState && walletState.ownedNfts.has(nft)) {
          this.logger.warn('Self-want rejected', { 
            wallet: wallet.substring(0, 8) + '...', 
            nft: nft.substring(0, 8) + '...',
            reason: 'Cannot want NFT you already own - breaks multi-party algorithm'
          });
          
          return res.status(400).json({ 
            success: false,
            error: 'Invalid want: Self-wants not allowed',
            message: 'You cannot create a want for an NFT you already own. This would break the multi-party trade loop algorithm.',
            details: {
              wallet,
              nft,
              ownedNfts: Array.from(walletState.ownedNfts).slice(0, 10) // Show first 10 owned NFTs for debugging
            }
          });
        }
        
        await tradeDiscovery.addTradePreference(wallet, nft);
      }

      const systemState = tradeDiscovery.getSystemState();
      this.logger.info('Current System State', systemState);

      // Build trade discovery settings
      const tradeSettings: any = { 
        walletAddress: wallet
      };
      
      if (nft) {
        tradeSettings.nftAddress = nft;
      }
      
      if (considerCollections) {
        tradeSettings.considerCollections = true;
      }
      
      if (includeCollectionTrades) {
        tradeSettings.includeCollectionTrades = true;
      }
      
      // Add other settings from request body
      if (req.body.maxResults) {
        tradeSettings.maxResults = parseInt(req.body.maxResults, 10);
      }
      
      if (req.body.minEfficiency) {
        tradeSettings.minEfficiency = parseFloat(req.body.minEfficiency);
      }

      this.logger.info('Finding trade loops with settings', tradeSettings);
      const tradeLoops = await tradeDiscovery.findTradeLoops(tradeSettings);
      
      this.logger.info(tradeLoops.length > 0 ? `Found ${tradeLoops.length} trade loops` : 'No trade loops found');

      if (tradeLoops.length === 0) {
        return res.json({ success: true, trades: [], poolState: { size: systemState.wanted, walletCount: systemState.wallets } });
      }

      const allNftAddresses = new Set<string>();
      tradeLoops.forEach((loop: TradeLoop) => 
        loop.steps.forEach((step: { nfts: Array<{address: string}> }) => 
          step.nfts.forEach((n: {address: string}) => allNftAddresses.add(n.address))
        )
      );
      this.logger.info(`Fetching metadata for ${allNftAddresses.size} NFTs in trade loops`);

      const nftDetails = new Map<string, NFTMetadata>();
      const validNfts = new Set<string>();
      const nftOwnerMap = new Map<string, string>();
      
      for (const nftAddress of allNftAddresses) {
        try {
          const metadata = await this.nftService.getNFTMetadata(nftAddress);
          nftDetails.set(nftAddress, metadata);
          validNfts.add(nftAddress);
          if (metadata.owner) nftOwnerMap.set(nftAddress, metadata.owner);
        } catch (error:any) {
          this.logger.error(`Error fetching metadata for NFT ${nftAddress}: ${error.message}`);
        }
      }
      
      const deepScanOwnershipMap = tradeDiscovery.getNFTOwnershipMap();
      for (const [nftAddress, owner] of Object.entries(deepScanOwnershipMap)) {
        nftOwnerMap.set(nftAddress, owner);
      }

      const validTradeLoops = tradeLoops.filter((loop: TradeLoop) => 
        loop.steps.every((step: { nfts: Array<{address: string}> }) => 
          step.nfts.every((n: {address: string}) => validNfts.has(n.address))
        )
      );
      this.logger.info(`Filtered out ${tradeLoops.length - validTradeLoops.length} invalid trade loops due to metadata issues`);

      const ownershipMap = tradeDiscovery.getNFTOwnershipMap();

      // Define helper types (can be kept or removed if direct casting/assertion is clear enough)
      type NftInOriginalStep = { address: string; name?: string; symbol?: string; image?: string; collection?: any; description?: string; owner?: string; ownershipValid?: boolean }; // This is what `loop.steps.nfts` might look like before full enrichment
      type OriginalStepWithNfts = { from: string; to: string; nfts: NftInOriginalStep[] };

      const enhancedTradeLoops: TradeLoop[] = validTradeLoops.map((loop: TradeLoop): TradeLoop => {
        return {
          ...loop,
          steps: loop.steps.map((step: OriginalStepWithNfts) => {
            return {
              ...step,
              nfts: step.nfts.map((n: NftInOriginalStep): TradeLoop['steps'][0]['nfts'][0] => { // Return type is the strict NFT type from TradeLoop
                const metadata = nftDetails.get(n.address);
                
                // Default values for fields that are non-optional in the target TradeLoop NFT type
                const defaultName = n.address.slice(0, 8); // Fallback name if all else fails
                const finalName = metadata?.name || n.name || defaultName;
                const finalSymbol = metadata?.symbol || n.symbol || 'UNKN';
                const finalImage = metadata?.image || n.image || `https://via.placeholder.com/300/303050/FFFFFF?text=${encodeURIComponent(finalName)}`;
                let finalCollection: string = 'Unknown Collection';
                if (metadata?.collection) {
                  finalCollection = typeof metadata.collection === 'string' ? metadata.collection : (metadata.collection as any).name || 'Unknown Collection';
                }
                const finalDescription = metadata?.description || n.description || 'No description available.';

                const ownerFromMap = nftOwnerMap.get(n.address) || metadata?.owner;
                const ownershipValid = this.validateNFTOwnership(n.address, step.from, ownershipMap, metadata);

                return {
                  address: n.address,
                  name: finalName,
                  symbol: finalSymbol,
                  image: finalImage,
                  collection: finalCollection,
                  description: finalDescription,
                  owner: ownerFromMap,
                  // Optional fields from NFTMetadata that might be on TradeLoop's NFT definition:
                  floorPrice: metadata?.floorPrice,
                  usedRealPrice: metadata?.usedRealPrice,
                  hasFloorPrice: metadata?.hasFloorPrice,
                  priceSource: metadata?.priceSource,
                  // Ensure all properties expected by TradeLoop['steps'][0]['nfts'][0] are present
                  // Add dummy/default values for any other *required* string properties if they exist on the target type
                  // For example, if TradeLoop's NFT type had a required `rarityProvider: string`, you'd add:
                  // rarityProvider: metadata?.rarityProvider || 'default_provider',
                } as TradeLoop['steps'][0]['nfts'][0]; // Assert to the precise type
              })
            };
          })
        };
      });

      // Now relevantTradesForUser filter and map should work with `enhancedTradeLoops` which is `TradeLoop[]`
      const relevantTradesForUser = enhancedTradeLoops.filter((trade: TradeLoop) => {
        const isWalletInTrade = trade.steps.some(step => step.from === wallet || step.to === wallet);
        if (!isWalletInTrade) return false;
        return trade.steps.every(step => {
          const validOwnership = step.nfts.every(n => (n as any).ownershipValid !== false); // Keep an eye on this 'any' cast if 'ownershipValid' isn't on the strict type
          if (!validOwnership) return false;
          const recipientWalletNode = tradeDiscovery.getWallets().get(step.to);
          if (!recipientWalletNode) return false;
          return step.nfts.some(n => recipientWalletNode.wantedNfts.has(n.address));
        });
      }).map((trade: TradeLoop) => this.reorderTradeLoopForUser(trade, wallet));
      
      const tradeSignatures = new Map<string, TradeLoop>();
      relevantTradesForUser.forEach((trade: TradeLoop) => {
        const nftAddresses = trade.steps.flatMap(step => step.nfts.map(n => n.address)).sort().join('-');
        if (!tradeSignatures.has(nftAddresses) || (trade.steps.length > 0 && trade.steps[0].from === wallet)) {
          tradeSignatures.set(nftAddresses, trade);
        }
      });
      const uniqueTradesForUser = Array.from(tradeSignatures.values());
      this.logger.info(`Filtered to ${uniqueTradesForUser.length} viable trades for wallet ${wallet}`);

      if (enhancedTradeLoops.length > 0) {
        try {
          this.logger.info(`Caching ${enhancedTradeLoops.length} globally discovered & enriched trade loops for trending feature`);
          this.cacheService.set(LATEST_GLOBAL_TRADES_CACHE_KEY, enhancedTradeLoops, 2 * 60 * 1000);
        } catch (error) {
          this.logger.error(`Failed to cache trade loops for trending: ${error instanceof Error ? error.message : String(error)}`);
          // Don't let cache errors affect the main response
        }
      }

      return res.json({
        success: true,
        trades: uniqueTradesForUser,
        poolState: { size: systemState.wanted, walletCount: systemState.wallets }
      });
    } catch (error: any) {
      this.logger.error('Error in findTrades', { errorMessage: error.message, stack: error.stack });
      return res.status(500).json({ success: false, message: 'Failed to find trades', error: error.message });
    }
  }

  private reorderTradeLoopForUser(trade: TradeLoop, userWallet: string): TradeLoop {
    const userStepIndex = trade.steps.findIndex(step => step.from === userWallet);
    if (userStepIndex > 0) {
        const newSteps = [...trade.steps.slice(userStepIndex), ...trade.steps.slice(0, userStepIndex)];
        return { ...trade, steps: newSteps };
    }
    return trade;
  }

  public async getSystemState(req: Request, res: Response): Promise<Response> {
    const systemState = this.tradeDiscoveryService.getSystemState();
    return res.json({ success: true, systemState });
  }

  public async clearSystem(req: Request, res: Response): Promise<Response> {
    await this.tradeDiscoveryService.clearState();
    const systemState = this.tradeDiscoveryService.getSystemState();
    return res.json({ success: true, message: 'System state cleared', systemState });
  }

  public async getDetailedSystemState(req: Request, res: Response): Promise<Response> {
    const detailedState = this.tradeDiscoveryService.getDetailedSystemState();
    return res.json({ success: true, detailedState });
  }

  public async registerManualNFTs(req: Request, res: Response): Promise<Response> {
    const { walletAddress, nftAddresses } = req.body;
    if (!walletAddress || !nftAddresses || !Array.isArray(nftAddresses) || nftAddresses.length === 0) {
      return res.status(400).json({ error: 'Invalid parameters', message: 'Please provide a walletAddress and an array of nftAddresses' });
    }
    this.logger.info(`Manually registering ${nftAddresses.length} NFTs for wallet ${walletAddress}`);
    this.tradeDiscoveryService.registerManualNFTs(walletAddress, nftAddresses);
    await this.tradeDiscoveryService.updateWalletState(walletAddress);
    const systemState = this.tradeDiscoveryService.getSystemState();
    return res.json({ success: true, message: `Registered ${nftAddresses.length} NFTs for wallet ${walletAddress}`, systemState });
  }

  public async rejectTrade(req: Request, res: Response): Promise<Response> {
    const { walletAddress, rejectedNftAddress, rejectedWalletAddress } = req.body;
    if (!walletAddress || (!rejectedNftAddress && !rejectedWalletAddress)) {
      this.logger.error('Missing required parameters:', { walletAddress, rejectedNftAddress, rejectedWalletAddress });
      return res.status(400).json({ error: 'Missing required parameters. Must provide wallet/walletAddress and either rejectedNftAddress or rejectedWalletAddress', received: { walletAddress, rejectedNftAddress, rejectedWalletAddress } });
    }
    if (rejectedNftAddress) {
      await this.tradeDiscoveryService.rejectTrade(walletAddress, rejectedNftAddress, true);
    }
    if (rejectedWalletAddress) {
      this.logger.info(`Adding wallet rejection: ${walletAddress} rejects ${rejectedWalletAddress}`);
      const rejections = this.tradeDiscoveryService.getRejections(walletAddress) || { nfts: new Set<string>(), wallets: new Set<string>() };
      rejections.wallets.add(rejectedWalletAddress);
      this.tradeDiscoveryService.storeRejections(walletAddress, rejections);
    }
    const systemState = this.tradeDiscoveryService.getSystemState();
    return res.json({ success: true, message: 'Rejection preferences updated successfully', type: rejectedNftAddress ? 'nft' : 'wallet', rejectedItem: rejectedNftAddress || rejectedWalletAddress, poolState: { size: systemState.wanted, walletCount: systemState.wallets } });
  }

  /**
   * Deep scan a wallet to force refresh NFT data from the blockchain
   */
  private deepScanWallet = async (req: Request, res: Response) => {
    const { walletAddress } = req.params;
    if (!walletAddress) {
      return res.status(400).json({ success: false, error: 'Missing wallet address' });
    }
    const result = await this.tradeDiscoveryService.deepScanWalletNFTs(walletAddress);
    return res.json({ success: true, data: result });
  };

  /**
   * Validate data integrity and get synchronization report
   */
  private validateDataIntegrity = async (req: Request, res: Response) => {
    try {
      this.logger.info('Validating data integrity');
      
      // Get DataSyncService instance
      const dataSyncService = container.resolve<any>("DataSyncService");
      
      // Get current system state
      const wallets = this.tradeDiscoveryService.getWallets();
      const wantedNfts = this.tradeDiscoveryService.getWantedNfts();
      const nftOwnership = this.tradeDiscoveryService.getNFTOwnershipMap();
      
      // Convert ownership map to Map for validation
      const ownershipMap = new Map(Object.entries(nftOwnership));
      
      // Validate data integrity
      const validationResult = dataSyncService.validateDataIntegrity(
        wallets,
        ownershipMap,
        wantedNfts
      );
      
      // Generate graph visualization data
      const graphData = dataSyncService.generateTradeGraphVisualization(
        wallets,
        ownershipMap,
        wantedNfts
      );
      
      res.json({
        success: true,
        dataIntegrity: {
          isValid: validationResult.isValid,
          issuesCount: validationResult.issues.length,
          issues: validationResult.issues,
          recommendations: validationResult.recommendations
        },
        systemState: {
          walletsCount: wallets.size,
          nftsCount: ownershipMap.size,
          wantedNftsCount: wantedNfts.size
        },
        graphVisualization: {
          nodesCount: graphData.nodes.length,
          edgesCount: graphData.edges.length,
          nodes: graphData.nodes,
          edges: graphData.edges
        }
      });
    } catch (error) {
      this.logger.error('Error validating data integrity', {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({
        success: false,
        error: 'Failed to validate data integrity'
      });
    }
  };

  public createOnChainTradeLoop(req: Request, res: Response): Response {
    return res.json({success: true, message: 'Create on-chain placeholder'});
  }

  public prepareTradeLoopForContract(req: Request, res: Response): Response {
    return res.json({success: true, message: 'Prepare for contract placeholder'});
  }

  public recordTradeStepCompleted(req: Request, res: Response): Response {
    return res.json({success: true, message: 'Record step placeholder'});
  }

  public async getUserTrades(req: Request, res: Response): Promise<Response> {
    const trades = await this.tradeDiscoveryService.getTradesForWallet(req.params.walletAddress);
    return res.json({success:true, trades});
  }

  public getTradeOpportunities = this.getUserTrades;

  public async getTradeDetails(req: Request, res: Response): Promise<Response> {
    const trade = await this.tradeDiscoveryService.getStoredTradeLoop(req.params.tradeId);
    return res.json({success: true, trade});
  }

  public submitTrade(req: Request, res: Response): Response {
    return res.json({success: true, message: 'Submit trade placeholder'});
  }

  public async addMultipleWants(req: Request, res: Response): Promise<Response> {
    const { wallet, nfts } = req.body;
    if(wallet && nfts && Array.isArray(nfts)){
        for(const nft of nfts){
            await this.tradeDiscoveryService.addTradePreference(wallet, nft);
        }
    }
    return res.json({success:true, message: 'Add multiple wants placeholder'});
  }

  public async addCollectionWant(req: Request, res: Response): Promise<Response> {
    const { wallet, collectionId } = req.body;
    
    if (!wallet || !collectionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters',
        message: 'Please provide wallet and collectionId' 
      });
    }
    
    try {
      this.logger.info(`Adding collection want for wallet ${wallet}, collection: ${collectionId}`);
      
      // This would call the addCollectionWant method on TradeDiscoveryService
      // For now, we'll store it as metadata that can be expanded during trade discovery
      this.tradeDiscoveryService.addCollectionWant(wallet, collectionId);
      
      const systemState = this.tradeDiscoveryService.getSystemState();
      
      return res.json({
        success: true,
        message: `Added collection want for ${collectionId}`,
        wallet,
        collectionId,
        systemState
      });
    } catch (error: any) {
      this.logger.error('Error adding collection want', { 
        wallet, 
        collectionId,
        error: error.message 
      });
      
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to add collection want',
        message: error.message 
      });
    }
  }

  public getCollectionWants(req: Request, res: Response): Response {
    const { wallet } = req.query;
    
    if (!wallet || typeof wallet !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters',
        message: 'Please provide wallet parameter' 
      });
    }
    
    try {
      this.logger.info(`Getting collection wants for wallet ${wallet}`);
      
      // Get wallet state and extract collection wants
      const wallets = this.tradeDiscoveryService.getWallets();
      const walletState = wallets.get(wallet);
      
      if (!walletState || !walletState.wantedCollections) {
        return res.json({
          success: true,
          wants: []
        });
      }
      
      // Convert collection wants to the expected format
      const wants = Array.from(walletState.wantedCollections).map(collectionId => ({
        walletAddress: wallet,
        collectionId,
        collectionName: collectionId, // We can enhance this with actual collection names later
        createdAt: new Date() // We can store timestamps later
      }));
      
      return res.json({
        success: true,
        wants
      });
    } catch (error: any) {
      this.logger.error('Error getting collection wants', { 
        wallet,
        error: error.message 
      });
      
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to get collection wants',
        message: error.message 
      });
    }
  }

  public removeCollectionWant(req: Request, res: Response): Response {
    const { collectionId } = req.params;
    const { wallet } = req.query;
    
    if (!wallet || typeof wallet !== 'string' || !collectionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters',
        message: 'Please provide wallet and collectionId' 
      });
    }
    
    try {
      this.logger.info(`Removing collection want for wallet ${wallet}, collection: ${collectionId}`);
      
      // Get wallet state and remove collection want
      const wallets = this.tradeDiscoveryService.getWallets();
      const walletState = wallets.get(wallet);
      
      if (walletState && walletState.wantedCollections) {
        walletState.wantedCollections.delete(collectionId);
        
        // Update the wallet state
        wallets.set(wallet, walletState);
      }
      
      return res.json({
        success: true,
        message: `Removed collection want for ${collectionId}`,
        wallet,
        collectionId
      });
    } catch (error: any) {
      this.logger.error('Error removing collection want', { 
        wallet, 
        collectionId,
        error: error.message 
      });
      
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to remove collection want',
        message: error.message 
      });
    }
  }

  public async searchCollections(req: Request, res: Response): Promise<Response> {
    const { q, query, maxResults } = req.query;
    const searchQuery = q || query; // Support both 'q' and 'query' parameters
    
    if (!searchQuery || typeof searchQuery !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid query parameter',
        message: 'Please provide a search query'
      });
    }
    
    try {
      this.logger.info(`Searching collections with query: ${searchQuery}`);
      
      // Use the new LocalCollectionService (searches our crawler database)
      const { LocalCollectionService } = require('../services/nft/LocalCollectionService');
      const localCollectionService = LocalCollectionService.getInstance();
      
      const maxResultsNum = maxResults ? parseInt(maxResults as string, 10) : 10;
      const searchResults = await localCollectionService.searchCollections(searchQuery, maxResultsNum);
      
      // Convert to the format expected by the frontend
      const collections = searchResults.map((result: any) => ({
        id: result.collection.id,
        name: result.collection.name,
        description: result.collection.description || result.collection.metadata?.description,
        verified: result.collection.verified,
        nftCount: result.collection.nftCount,
        floorPrice: result.collection.floorPrice,
        volume24h: result.collection.volume24h,
        imageUrl: result.collection.image,
        relevanceScore: result.relevanceScore,
        matchType: result.matchType,
        sources: result.collection.sources
      }));
      
      // Get local database stats for debugging
      const stats = localCollectionService.getStats();
      
      this.logger.info(`Found ${collections.length} collections for query: ${searchQuery}`, {
        localDbStats: stats
      });
      
      return res.json({
        success: true,
        collections,
        total: collections.length,
        stats: {
          totalCollectionsInDb: stats.localCollectionsCount,
          lastUpdated: stats.lastLoadTime,
          source: 'local_database'
        }
      });
    } catch (error: any) {
      this.logger.error('Error searching collections', {
        query: searchQuery,
        error: error.message
      });
      
      return res.status(500).json({
        success: false,
        error: 'Failed to search collections',
        message: error.message
      });
    }
  }

  public async getCollectionDetails(req: Request, res: Response): Promise<Response> {
    const { collectionId } = req.params;
    
    if (!collectionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing collection ID',
        message: 'Please provide a collection ID'
      });
    }
    
    try {
      this.logger.info(`Getting details for collection: ${collectionId}`);
      
      // Use LocalCollectionService (combines local data + live Helius metadata)
      const { LocalCollectionService } = require('../services/nft/LocalCollectionService');
      const localCollectionService = LocalCollectionService.getInstance();
      
      const metadata = await localCollectionService.getCollectionDetails(collectionId);
      
      if (!metadata) {
        return res.status(404).json({
          success: false,
          error: 'Collection not found',
          message: `Collection ${collectionId} not found in local database or Helius`
        });
      }
      
      // Get local database stats for debugging
      const stats = localCollectionService.getStats();
      
      return res.json({
        success: true,
        collection: metadata,
        stats: {
          totalCollectionsInDb: stats.localCollectionsCount,
          lastUpdated: stats.lastLoadTime,
          hasLiveData: metadata.sources.includes('helius'),
          dataAge: Date.now() - new Date(metadata.lastUpdated).getTime()
        }
      });
    } catch (error: any) {
      this.logger.error('Error getting collection details', {
        collectionId,
        error: error.message
      });
      
      return res.status(500).json({
        success: false,
        error: 'Failed to get collection details',
        message: error.message
      });
    }
  }

  public getActiveTrades(req: Request, res: Response): Response {
    return res.json({success: true, trades: []});
  }

  public getCompletedTradesCount(req: Request, res: Response): Response {
    return res.json({success: true, count: 0});
  }

  public getTradeHistory(req: Request, res: Response): Response {
    return res.json({success: true, trades: []});
  }

  public getUserTradeHistory(req: Request, res: Response): Response {
    return res.json({success: true, trades: []});
  }

  public async getPopularCollections(req: Request, res: Response): Promise<Response> {
    const { limit } = req.query;
    
    try {
      const limitNum = limit ? parseInt(limit as string, 10) : 10;
      this.logger.info(`Getting popular collections from local database, limit: ${limitNum}`);
      
      // Use LocalCollectionService for popular collections (from our local database)
      const { LocalCollectionService } = require('../services/nft/LocalCollectionService');
      const localCollectionService = LocalCollectionService.getInstance();
      
      const searchResults = await localCollectionService.getPopularCollections(limitNum);
      
      // Convert to the format expected by the frontend
      const collections = searchResults.map((result: any) => ({
        id: result.collection.id,
        name: result.collection.name,
        description: result.collection.description || result.collection.metadata?.description,
        verified: result.collection.verified,
        nftCount: result.collection.nftCount,
        floorPrice: result.collection.floorPrice,
        volume24h: result.collection.volume24h,
        imageUrl: result.collection.image,
        relevanceScore: result.relevanceScore,
        sources: result.collection.sources
      }));
      
      // Get local database stats
      const stats = localCollectionService.getStats();
      
      this.logger.info(`Found ${collections.length} popular collections from local database`, {
        totalInDb: stats.localCollectionsCount
      });
      
      return res.json({
        success: true,
        collections,
        stats: {
          totalCollectionsInDb: stats.localCollectionsCount,
          lastUpdated: stats.lastLoadTime,
          source: 'local_database'
        }
      });
    } catch (error: any) {
      this.logger.error('Error getting popular collections', {
        error: error.message
      });
      
      return res.status(500).json({
        success: false,
        error: 'Failed to get popular collections',
        message: error.message
      });
    }
  }

  public setupRoutes(router: Router): void {
    // Advanced features
    router.get('/deep-scan/:walletAddress', this.deepScanWallet);
    router.get('/validate-data', this.validateDataIntegrity);
  }
} 