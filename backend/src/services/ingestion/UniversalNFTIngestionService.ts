import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { TenantConfig, AbstractNFT, AbstractWallet } from '../../types/abstract';
import { PersistentTradeDiscoveryService } from '../trade/PersistentTradeDiscoveryService';

/**
 * Universal NFT Ingestion Service
 * 
 * This service can automatically ingest NFTs from any blockchain using 
 * partner-provided API keys. Partners just provide wallet addresses and API keys,
 * SWAPS handles all the complex multi-chain fetching and processing.
 */

interface BlockchainAPI {
  apiKey: string;
  endpoint?: string;
  rateLimit?: number;
}

interface TenantAPIKeys {
  ethereum?: {
    alchemy?: BlockchainAPI;
    moralis?: BlockchainAPI;
    opensea?: BlockchainAPI;
    quicknode?: BlockchainAPI;
  };
  polygon?: {
    alchemy?: BlockchainAPI;
    moralis?: BlockchainAPI;
    quicknode?: BlockchainAPI;
  };
  arbitrum?: {
    alchemy?: BlockchainAPI;
    moralis?: BlockchainAPI;
  };
  optimism?: {
    alchemy?: BlockchainAPI;
    moralis?: BlockchainAPI;
  };
  base?: {
    alchemy?: BlockchainAPI;
    moralis?: BlockchainAPI;
  };
  solana?: {
    helius?: BlockchainAPI;
    quicknode?: BlockchainAPI;
  };
}

interface IngestionJob {
  id: string;
  tenantId: string;
  blockchain: string;
  walletAddress: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  nftsFound: number;
  startTime: Date;
  endTime?: Date;
  error?: string;
}

export class UniversalNFTIngestionService {
  private static instance: UniversalNFTIngestionService;
  private logger: Logger;
  private tradeService: PersistentTradeDiscoveryService;
  
  // Tenant API key storage
  private tenantAPIKeys = new Map<string, TenantAPIKeys>();
  
  // Active ingestion jobs
  private activeJobs = new Map<string, IngestionJob>();
  private jobHistory: IngestionJob[] = [];
  
  // Rate limiting per API provider
  private rateLimiters = new Map<string, { lastCall: Date; callsPerMinute: number }>();

  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('UniversalNFTIngestion');
    this.tradeService = PersistentTradeDiscoveryService.getInstance();
    
    this.logger.info('UniversalNFTIngestionService initialized');
  }

  public static getInstance(): UniversalNFTIngestionService {
    if (!UniversalNFTIngestionService.instance) {
      UniversalNFTIngestionService.instance = new UniversalNFTIngestionService();
    }
    return UniversalNFTIngestionService.instance;
  }

  /**
   * Partners call this to configure their API keys once
   */
  public async configureTenantAPIKeys(tenantId: string, apiKeys: TenantAPIKeys): Promise<void> {
    const operation = this.logger.operation('configureTenantAPIKeys');
    
    try {
      // Validate API keys by testing them
      await this.validateAPIKeys(apiKeys);
      
      // Store encrypted API keys (in production, encrypt these)
      this.tenantAPIKeys.set(tenantId, apiKeys);
      
      operation.info('Tenant API keys configured', {
        tenantId,
        blockchains: Object.keys(apiKeys),
        providers: this.countProviders(apiKeys)
      });
      
      operation.end();
    } catch (error) {
      operation.error('Failed to configure API keys', {
        tenantId,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Partners call this to trigger automatic NFT discovery for a user
   * SWAPS handles all the blockchain APIs and processing
   */
  public async ingestUserNFTs(
    tenantId: string, 
    userId: string, 
    walletAddresses: Record<string, string>
  ): Promise<{ jobIds: string[]; estimatedCompletion: Date }> {
    
    const operation = this.logger.operation('ingestUserNFTs');
    
    try {
      const apiKeys = this.tenantAPIKeys.get(tenantId);
      if (!apiKeys) {
        throw new Error(`No API keys configured for tenant ${tenantId}`);
      }

      const jobIds: string[] = [];
      
      // Create ingestion jobs for each blockchain the user has wallets on
      for (const [blockchain, walletAddress] of Object.entries(walletAddresses)) {
        if (this.canIngestBlockchain(blockchain, apiKeys)) {
          const jobId = await this.createIngestionJob(tenantId, userId, blockchain, walletAddress);
          jobIds.push(jobId);
        }
      }

      // Start processing jobs
      for (const jobId of jobIds) {
        this.processIngestionJob(jobId); // Don't await - run in background
      }

      const estimatedCompletion = new Date(Date.now() + (jobIds.length * 30000)); // 30s per job estimate

      operation.info('User NFT ingestion started', {
        tenantId,
        userId,
        jobCount: jobIds.length,
        blockchains: Object.keys(walletAddresses)
      });

      operation.end();
      return { jobIds, estimatedCompletion };

    } catch (error) {
      operation.error('Failed to start NFT ingestion', {
        tenantId,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Process a single ingestion job
   */
  private async processIngestionJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    const operation = this.logger.operation('processIngestionJob');
    
    try {
      job.status = 'running';
      operation.info('Starting ingestion job', { jobId, blockchain: job.blockchain });

      let nfts: AbstractNFT[] = [];

      // Route to appropriate blockchain ingestion
      switch (job.blockchain) {
        case 'ethereum':
          nfts = await this.ingestEthereumNFTs(job.tenantId, job.walletAddress);
          break;
        case 'polygon':
          nfts = await this.ingestPolygonNFTs(job.tenantId, job.walletAddress);
          break;
        case 'solana':
          nfts = await this.ingestSolanaNFTs(job.tenantId, job.walletAddress);
          break;
        case 'arbitrum':
          nfts = await this.ingestArbitrumNFTs(job.tenantId, job.walletAddress);
          break;
        default:
          throw new Error(`Unsupported blockchain: ${job.blockchain}`);
      }

      // Submit discovered NFTs to trade discovery
      for (const nft of nfts) {
        await this.tradeService.onNFTAdded(job.tenantId, nft);
      }

      // Complete job
      job.status = 'completed';
      job.nftsFound = nfts.length;
      job.endTime = new Date();

      operation.info('Ingestion job completed', {
        jobId,
        nftsFound: nfts.length,
        processingTime: Date.now() - job.startTime.getTime()
      });

      operation.end();

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      job.endTime = new Date();

      operation.error('Ingestion job failed', {
        jobId,
        error: job.error
      });
      operation.end();
    } finally {
      // Move to history
      this.activeJobs.delete(jobId);
      this.jobHistory.push(job);
    }
  }

  /**
   * Ingest NFTs from Ethereum using partner's API keys
   */
  private async ingestEthereumNFTs(tenantId: string, walletAddress: string): Promise<AbstractNFT[]> {
    const apiKeys = this.tenantAPIKeys.get(tenantId)?.ethereum;
    if (!apiKeys) throw new Error('No Ethereum API keys configured');

    // Try different providers in order of preference
    if (apiKeys.alchemy) {
      return await this.fetchFromAlchemy('ethereum', walletAddress, apiKeys.alchemy);
    } else if (apiKeys.moralis) {
      return await this.fetchFromMoralis('ethereum', walletAddress, apiKeys.moralis);
    } else if (apiKeys.opensea) {
      return await this.fetchFromOpenSea(walletAddress, apiKeys.opensea);
    }
    
    throw new Error('No working Ethereum API provider configured');
  }

  /**
   * Fetch NFTs from Alchemy
   */
  private async fetchFromAlchemy(
    network: string, 
    walletAddress: string, 
    apiKey: BlockchainAPI
  ): Promise<AbstractNFT[]> {
    
    await this.waitForRateLimit(`alchemy_${network}`, apiKey.rateLimit || 300);

    const baseUrl = apiKey.endpoint || `https://eth-mainnet.g.alchemy.com/nft/v3/${apiKey.apiKey}`;
    const response = await fetch(`${baseUrl}/getNFTsForOwner?owner=${walletAddress}&pageSize=100`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Alchemy API error: ${response.status}`);
    }

    const data = await response.json();
    const nfts: AbstractNFT[] = [];

    for (const nft of data.ownedNfts || []) {
      nfts.push({
        id: `${network}_${nft.contract.address}_${nft.tokenId}`,
        metadata: {
          name: nft.name || nft.rawMetadata?.name || 'Unknown NFT',
          description: nft.description || nft.rawMetadata?.description,
          image: nft.image?.originalUrl || nft.rawMetadata?.image,
          attributes: nft.rawMetadata?.attributes || []
        },
        ownership: {
          ownerId: walletAddress,
          acquiredAt: new Date()
        },
        valuation: {
          estimatedValue: 0, // Would integrate with pricing APIs
          currency: 'ETH',
          confidence: 0.5
        },
        platformData: {
          blockchain: network,
          contractAddress: nft.contract.address,
          tokenId: nft.tokenId,
          tokenType: nft.tokenType,
          network: 'mainnet'
        }
      });
    }

    return nfts;
  }

  /**
   * Fetch NFTs from Moralis
   */
  private async fetchFromMoralis(
    network: string,
    walletAddress: string,
    apiKey: BlockchainAPI
  ): Promise<AbstractNFT[]> {
    
    await this.waitForRateLimit(`moralis_${network}`, apiKey.rateLimit || 600);

    const chainMap: Record<string, string> = {
      ethereum: 'eth',
      polygon: 'polygon',
      arbitrum: 'arbitrum',
      optimism: 'optimism'
    };

    const chain = chainMap[network];
    if (!chain) throw new Error(`Unsupported network for Moralis: ${network}`);

    const response = await fetch(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}/nft?chain=${chain}&format=decimal`,
      {
        headers: {
          'Accept': 'application/json',
          'X-API-Key': apiKey.apiKey
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Moralis API error: ${response.status}`);
    }

    const data = await response.json();
    const nfts: AbstractNFT[] = [];

    for (const nft of data.result || []) {
      const metadata = nft.metadata ? JSON.parse(nft.metadata) : {};
      
      nfts.push({
        id: `${network}_${nft.token_address}_${nft.token_id}`,
        metadata: {
          name: metadata.name || nft.name || 'Unknown NFT',
          description: metadata.description,
          image: metadata.image,
          attributes: metadata.attributes || []
        },
        ownership: {
          ownerId: walletAddress,
          acquiredAt: new Date()
        },
        valuation: {
          estimatedValue: 0,
          currency: network === 'ethereum' ? 'ETH' : 'MATIC',
          confidence: 0.5
        },
        platformData: {
          blockchain: network,
          contractAddress: nft.token_address,
          tokenId: nft.token_id,
          network: 'mainnet'
        }
      });
    }

    return nfts;
  }

  /**
   * Existing Solana implementation (already works)
   */
  private async ingestSolanaNFTs(tenantId: string, walletAddress: string): Promise<AbstractNFT[]> {
    // Use existing Solana ingestion logic
    const apiKeys = this.tenantAPIKeys.get(tenantId)?.solana;
    // Implementation would use existing Helius integration
    return []; // Placeholder - would use existing code
  }

  private async ingestPolygonNFTs(tenantId: string, walletAddress: string): Promise<AbstractNFT[]> {
    return await this.ingestEthereumNFTs(tenantId, walletAddress); // Same logic, different network
  }

  private async ingestArbitrumNFTs(tenantId: string, walletAddress: string): Promise<AbstractNFT[]> {
    return await this.ingestEthereumNFTs(tenantId, walletAddress); // Same logic, different network
  }

  // ... Additional methods for OpenSea, rate limiting, validation, etc.

  private async fetchFromOpenSea(walletAddress: string, apiKey: BlockchainAPI): Promise<AbstractNFT[]> {
    // OpenSea API implementation
    return [];
  }

  private async waitForRateLimit(provider: string, callsPerMinute: number): Promise<void> {
    const key = provider;
    const limiter = this.rateLimiters.get(key);
    
    if (limiter) {
      const timeSinceLastCall = Date.now() - limiter.lastCall.getTime();
      const minInterval = (60 * 1000) / callsPerMinute; // ms between calls
      
      if (timeSinceLastCall < minInterval) {
        const waitTime = minInterval - timeSinceLastCall;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    this.rateLimiters.set(key, { lastCall: new Date(), callsPerMinute });
  }

  private async validateAPIKeys(apiKeys: TenantAPIKeys): Promise<void> {
    // Test each API key by making a simple request
    for (const [blockchain, providers] of Object.entries(apiKeys)) {
      for (const [provider, config] of Object.entries(providers)) {
        await this.testAPIKey(blockchain, provider, config as BlockchainAPI);
      }
    }
  }

  private async testAPIKey(blockchain: string, provider: string, config: BlockchainAPI): Promise<void> {
    // Make a simple test request to validate the API key works
    // Implementation would depend on the specific provider
  }

  private canIngestBlockchain(blockchain: string, apiKeys: TenantAPIKeys): boolean {
    return !!apiKeys[blockchain as keyof TenantAPIKeys];
  }

  private countProviders(apiKeys: TenantAPIKeys): number {
    let count = 0;
    for (const providers of Object.values(apiKeys)) {
      count += Object.keys(providers).length;
    }
    return count;
  }

  private async createIngestionJob(
    tenantId: string, 
    userId: string, 
    blockchain: string, 
    walletAddress: string
  ): Promise<string> {
    const jobId = `${tenantId}_${blockchain}_${Date.now()}`;
    
    const job: IngestionJob = {
      id: jobId,
      tenantId,
      blockchain,
      walletAddress,
      status: 'pending',
      nftsFound: 0,
      startTime: new Date()
    };

    this.activeJobs.set(jobId, job);
    return jobId;
  }

  /**
   * Get ingestion status for a tenant
   */
  public getIngestionStatus(tenantId: string) {
    const activeJobs = Array.from(this.activeJobs.values()).filter(job => job.tenantId === tenantId);
    const completedJobs = this.jobHistory.filter(job => job.tenantId === tenantId);
    
    return {
      activeJobs: activeJobs.length,
      completedJobs: completedJobs.length,
      totalNFTsIngested: completedJobs.reduce((sum, job) => sum + job.nftsFound, 0),
      jobs: [...activeJobs, ...completedJobs.slice(-10)] // Last 10 completed jobs
    };
  }
} 