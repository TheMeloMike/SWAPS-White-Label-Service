import { Request, Response } from 'express';
import { LoggingService, Logger } from '../utils/logging/LoggingService';
import { PersistentTradeDiscoveryService } from '../services/trade/PersistentTradeDiscoveryService';
import { TenantManagementService } from '../services/tenant/TenantManagementService';
import { ErrorResponses, ApiError } from '../utils/errorResponses';
import { 
  TradeDiscoveryRequest, 
  TradeDiscoveryResponse, 
  AbstractNFT, 
  AbstractWallet,
  ExecutionMode,
  BlockchainFormat,
  ComposableInstructions
} from '../types/abstract';
import { TradeLoop } from '../types/trade';

/**
 * White Label API Controller
 * 
 * Primary API controller for white label partners to access SWAPS trade discovery.
 * Provides blockchain-agnostic endpoints for real-time trade discovery.
 */
export class WhiteLabelController {
  private logger: Logger;
  private persistentTradeService: PersistentTradeDiscoveryService;
  private tenantService: TenantManagementService;

  constructor() {
    this.logger = LoggingService.getInstance().createLogger('WhiteLabelController');
    this.persistentTradeService = PersistentTradeDiscoveryService.getInstance();
    this.tenantService = TenantManagementService.getInstance();
  }

  /**
   * POST /api/v1/discovery/trades
   * Discover trade loops for a tenant's inventory
   */
  public discoverTrades = async (req: Request & { tenant?: any }, res: Response): Promise<void> => {
    const operation = this.logger.operation('discoverTrades');
    const startTime = Date.now();
    
    try {
      const tenant = req.tenant;
      if (!tenant) {
        ErrorResponses.sendError(res, ErrorResponses.unauthorized());
        operation.end();
        return;
      }

      // Check rate limits
      const rateLimit = await this.tenantService.checkRateLimit(tenant.id, 'discovery');
      if (!rateLimit.allowed) {
        ErrorResponses.sendError(
          res, 
          ErrorResponses.rateLimitExceeded(rateLimit.remaining, rateLimit.resetTime?.getTime?.() || Date.now())
        );
        operation.end();
        return;
      }

      const request: TradeDiscoveryRequest = req.body;
      
      // Validate request
      const validation = this.validateTradeDiscoveryRequest(request);
      if (!validation.valid) {
        ErrorResponses.sendError(
          res,
          ErrorResponses.validationError(validation.error || 'Validation failed', { request })
        );
        operation.end();
        return;
      }

      // Record API usage
      await this.tenantService.recordApiKeyUsage(tenant.id, 'discovery');

      let discoveredTrades: TradeLoop[] = [];

      if (request.wallets && request.wallets.length > 0) {
        // Bulk inventory update
        operation.info('Processing bulk inventory update', {
          tenantId: tenant.id,
          walletsCount: request.wallets.length
        });

        // CRITICAL FIX: Ensure wallets have proper ownedNFTs arrays
        const validatedWallets = request.wallets.map(wallet => {
          // Convert wallet to proper AbstractWallet format if needed
          if (!wallet.ownedNFTs || !Array.isArray(wallet.ownedNFTs)) {
            operation.warn('Wallet missing ownedNFTs array, using empty array', {
              walletId: wallet.id || 'unknown'
            });
            return {
              ...wallet,
              ownedNFTs: [],
              wantedNFTs: wallet.wantedNFTs || []
            };
          }
          return wallet;
        });

        discoveredTrades = await this.persistentTradeService.updateTenantInventory(
          tenant.id, 
          validatedWallets
        );
      } else if (request.walletId) {
        // Get trades for specific wallet
        operation.info('Fetching trades for specific wallet', {
          tenantId: tenant.id,
          walletId: request.walletId
        });

        discoveredTrades = await this.persistentTradeService.getTradeLoopsForWallet(
          tenant.id, 
          request.walletId
        );
      } else {
        // Get all active trades for tenant
        discoveredTrades = this.persistentTradeService.getActiveLoopsForTenant(tenant.id);
      }

      // Apply result limits
      const maxResults = request.settings?.maxResults || tenant.settings.algorithm.maxLoopsPerRequest;
      if (discoveredTrades.length > maxResults) {
        discoveredTrades = discoveredTrades
          .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
          .slice(0, maxResults);
      }

      // Prepare response
      const mode: ExecutionMode = request.mode || 'informational';
      const response: TradeDiscoveryResponse = {
        success: true,
        trades: discoveredTrades,
        mode,
        metadata: {
          totalActiveLoops: this.persistentTradeService.getActiveLoopCountForTenant(tenant.id),
          requestProcessingTime: Date.now() - startTime,
          tenantId: tenant.id
        }
      };

      // Add execution instructions if requested
      if (mode === 'executable' && discoveredTrades.length > 0) {
        const blockchainFormat = request.settings?.blockchainFormat || 'custom';
        response.executionInstructions = this.generateExecutionInstructions(
          discoveredTrades, 
          blockchainFormat
        );
      }

      operation.info('Trade discovery completed', {
        tenantId: tenant.id,
        tradesFound: discoveredTrades.length,
        mode,
        processingTime: Date.now() - startTime
      });

      res.json(response);
      operation.end();
    } catch (error) {
      operation.error('Trade discovery failed', {
        error: error instanceof Error ? error.message : String(error),
        tenantId: req.tenant?.id
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      operation.end();
    }
  };

  /**
   * POST /api/v1/inventory/submit
   * Submit NFT inventory updates for a tenant
   */
  public submitInventory = async (req: Request & { tenant?: any }, res: Response): Promise<void> => {
    const operation = this.logger.operation('submitInventory');
    
    try {
      const tenant = req.tenant;
      if (!tenant) {
        ErrorResponses.sendError(res, ErrorResponses.unauthorized());
        operation.end();
        return;
      }

      // Check rate limits
      const rateLimit = await this.tenantService.checkRateLimit(tenant.id, 'nft_submission');
      if (!rateLimit.allowed) {
        ErrorResponses.sendError(
          res,
          ErrorResponses.rateLimitExceeded(rateLimit.remaining, rateLimit.resetTime?.getTime?.() || Date.now())
        );
        operation.end();
        return;
      }

      const { nfts, walletId } = req.body;

      // Validate input
      if (!Array.isArray(nfts)) {
        ErrorResponses.sendError(
          res,
          ErrorResponses.invalidFormat('nfts', 'Array of AbstractNFT objects')
        );
        operation.end();
        return;
      }

      if (!walletId) {
        ErrorResponses.sendError(
          res,
          ErrorResponses.missingField('walletId')
        );
        operation.end();
        return;
      }

      // Validate NFT data
      const invalidNFTs = this.validateNFTArray(nfts);
      if (invalidNFTs.length > 0) {
        ErrorResponses.sendError(
          res,
          ErrorResponses.invalidNftFormat({ invalidNFTs })
        );
        operation.end();
        return;
      }

      // Record API usage
      await this.tenantService.recordApiKeyUsage(tenant.id, 'nft_submission');

      // Process NFT additions
      const newLoops: TradeLoop[] = [];
      for (const nft of nfts) {
        // Ensure ownership is set correctly
        nft.ownership.ownerId = walletId;
        
        const loops = await this.persistentTradeService.onNFTAdded(tenant.id, nft);
        newLoops.push(...loops);
      }

      operation.info('Inventory submitted successfully', {
        tenantId: tenant.id,
        walletId,
        nftsSubmitted: nfts.length,
        newLoopsDiscovered: newLoops.length
      });

      res.json({
        success: true,
        nftsProcessed: nfts.length,
        newLoopsDiscovered: newLoops.length,
        loops: newLoops
      });
      operation.end();
    } catch (error) {
      operation.error('Inventory submission failed', {
        error: error instanceof Error ? error.message : String(error),
        tenantId: req.tenant?.id
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      operation.end();
    }
  };

  /**
   * POST /api/v1/wants/submit
   * Submit want requests for a tenant's wallet
   */
  public submitWants = async (req: Request & { tenant?: any }, res: Response): Promise<void> => {
    const operation = this.logger.operation('submitWants');
    
    try {
      const tenant = req.tenant;
      if (!tenant) {
        res.status(401).json({ error: 'Authentication required' });
        operation.end();
        return;
      }

      const { walletId, wantedNFTs } = req.body;

      // Validate input
      if (!walletId || !Array.isArray(wantedNFTs)) {
        res.status(400).json({ 
          error: 'Invalid request. Expected: { walletId: string, wantedNFTs: string[] }' 
        });
        operation.end();
        return;
      }

      // Validate tenant security settings
      const maxWants = tenant.settings.security.maxWantsPerWallet;
      if (wantedNFTs.length > maxWants) {
        res.status(400).json({
          error: `Too many wants. Maximum allowed: ${maxWants}`
        });
        operation.end();
        return;
      }

      // Process want additions
      const newLoops: TradeLoop[] = [];
      for (const wantedNFTId of wantedNFTs) {
        const loops = await this.persistentTradeService.onWantAdded(
          tenant.id, 
          walletId, 
          wantedNFTId
        );
        newLoops.push(...loops);
      }

      operation.info('Wants submitted successfully', {
        tenantId: tenant.id,
        walletId,
        wantsSubmitted: wantedNFTs.length,
        newLoopsDiscovered: newLoops.length
      });

      res.json({
        success: true,
        wantsProcessed: wantedNFTs.length,
        newLoopsDiscovered: newLoops.length,
        loops: newLoops
      });
      operation.end();
    } catch (error) {
      operation.error('Want submission failed', {
        error: error instanceof Error ? error.message : String(error),
        tenantId: req.tenant?.id
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      operation.end();
    }
  };

  /**
   * GET /api/v1/trades/active
   * Get all active trade loops for tenant
   */
  public getActiveTrades = async (req: Request & { tenant?: any }, res: Response): Promise<void> => {
    const operation = this.logger.operation('getActiveTrades');
    
    try {
      const tenant = req.tenant;
      if (!tenant) {
        res.status(401).json({ error: 'Authentication required' });
        operation.end();
        return;
      }

      const { walletId, limit = 100 } = req.query;

      let trades: TradeLoop[];

      if (walletId) {
        trades = await this.persistentTradeService.getTradeLoopsForWallet(
          tenant.id, 
          walletId as string
        );
      } else {
        // Get all active trades for tenant
        trades = this.persistentTradeService.getActiveLoopsForTenant(tenant.id);
      }

      // Apply limit
      if (trades.length > Number(limit)) {
        trades = trades
          .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
          .slice(0, Number(limit));
      }

      operation.info('Active trades retrieved', {
        tenantId: tenant.id,
        walletId: walletId || 'all',
        tradesCount: trades.length
      });

      res.json({
        success: true,
        trades,
        totalCount: trades.length,
        filtered: !!walletId
      });
      operation.end();
    } catch (error) {
      operation.error('Failed to get active trades', {
        error: error instanceof Error ? error.message : String(error),
        tenantId: req.tenant?.id
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      operation.end();
    }
  };

  /**
   * GET /api/v1/status
   * Get tenant status and statistics
   */
  public getTenantStatus = async (req: Request & { tenant?: any }, res: Response): Promise<void> => {
    const operation = this.logger.operation('getTenantStatus');
    
    try {
      const tenant = req.tenant;
      if (!tenant) {
        res.status(401).json({ error: 'Authentication required' });
        operation.end();
        return;
      }

      const usage = await this.tenantService.getTenantUsage(tenant.id);
      const activeLoops = await this.persistentTradeService.getActiveLoopCount(tenant.id);
      const metrics = this.persistentTradeService.getMetrics();

      operation.info('Tenant status retrieved', {
        tenantId: tenant.id
      });

      res.json({
        success: true,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          settings: tenant.settings,
          lastActive: tenant.lastActive
        },
        statistics: {
          activeLoops,
          usage,
          systemMetrics: metrics
        }
      });
      operation.end();
    } catch (error) {
      operation.error('Failed to get tenant status', {
        error: error instanceof Error ? error.message : String(error),
        tenantId: req.tenant?.id
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      operation.end();
    }
  };

  /**
   * Private helper methods
   */
  private validateTradeDiscoveryRequest(request: TradeDiscoveryRequest): { valid: boolean; error?: string } {
    if (!request.wallets && !request.walletId) {
      return { valid: false, error: 'Either wallets array or walletId must be provided' };
    }

    if (request.wallets && request.wallets.length === 0) {
      return { valid: false, error: 'Wallets array cannot be empty' };
    }

    return { valid: true };
  }

  private validateNFTArray(nfts: any[]): string[] {
    const errors: string[] = [];
    
    for (let i = 0; i < nfts.length; i++) {
      const nft = nfts[i];
      
      if (!nft.id) {
        errors.push(`NFT ${i}: Missing required field 'id'`);
      }
      
      if (!nft.metadata?.name) {
        errors.push(`NFT ${i}: Missing required field 'metadata.name'`);
      }
      
      if (!nft.ownership?.ownerId) {
        errors.push(`NFT ${i}: Missing required field 'ownership.ownerId'`);
      }
    }
    
    return errors;
  }

  private generateExecutionInstructions(
    trades: TradeLoop[], 
    blockchainFormat: BlockchainFormat
  ): ComposableInstructions {
    // This is a simplified implementation
    // In production, this would generate actual blockchain-specific instructions
    
    const baseInstructions = trades.flatMap((trade, tradeIndex) => 
      trade.steps.map((step, stepIndex) => ({
        stepIndex: tradeIndex * trade.steps.length + stepIndex,
        from: step.from,
        to: step.to,
        nftIds: step.nfts.map(nft => nft.address),
        instructionType: 'transfer' as const,
        dependencies: stepIndex > 0 ? [stepIndex - 1] : [],
        rollbackInstructions: []
      }))
    );

    const instructions: ComposableInstructions = {
      baseInstructions,
      blockchainInstructions: {},
      execution: {
        totalSteps: baseInstructions.length,
        estimatedGas: { [blockchainFormat]: baseInstructions.length * 50000 },
        requiredApprovals: [],
        safetyChecks: [
          {
            type: 'ownership_verification',
            description: 'Verify all NFTs are owned by specified wallets',
            required: true
          }
        ],
        atomicityGuarantee: false
      }
    };

    // Add blockchain-specific instructions based on format
    switch (blockchainFormat) {
      case 'ethereum':
        instructions.blockchainInstructions.ethereum = {
          transactions: baseInstructions.map(step => ({
            to: '0x0000000000000000000000000000000000000000', // Placeholder
            data: '0x', // Placeholder
            value: '0',
            gasLimit: 50000
          })),
          gasEstimate: baseInstructions.length * 50000,
          contracts: []
        };
        break;
        
      case 'solana':
        instructions.blockchainInstructions.solana = {
          instructions: baseInstructions.map(step => ({
            programId: '11111111111111111111111111111112', // Placeholder
            keys: [],
            data: Buffer.from([])
          })),
          computeUnits: baseInstructions.length * 200,
          programIds: []
        };
        break;
        
      default:
        instructions.blockchainInstructions.custom = {
          format: blockchainFormat,
          instructions: baseInstructions,
          metadata: { platform: blockchainFormat }
        };
    }

    return instructions;
  }
} 