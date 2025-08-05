import { Request, Response } from 'express';
import { SolanaIntegrationService, BlockchainTradeLoop, SolanaConfig } from '../services/blockchain/SolanaIntegrationService';
import { PersistentTradeDiscoveryService } from '../services/trade/PersistentTradeDiscoveryService';
import { TenantManagementService } from '../services/tenant/TenantManagementService';
import { TradeLoop } from '../types/trade';
import { LoggingService, Logger } from '../utils/logging/LoggingService';
import { ErrorResponses } from '../utils/errorResponses';
import { Keypair, PublicKey } from '@solana/web3.js';

/**
 * Enhanced Trade Controller with Blockchain Integration
 * 
 * Extends the existing trade discovery API with smart contract execution capabilities
 */

export interface TradeExecutionRequest {
    tradeLoopId: string;
    mode: 'simulate' | 'execute';
    walletPublicKey?: string;
    customTimeoutHours?: number;
}

export interface TradeApprovalRequest {
    tradeLoopId: string;
    stepIndex: number;
    walletPublicKey: string;
    signature?: string; // User's signature for approval
}

export interface BlockchainTradeDiscoveryRequest {
    wallets?: any[];
    walletId?: string;
    mode: 'discovery' | 'executable' | 'full_blockchain';
    settings?: {
        maxResults?: number;
        includeCollectionTrades?: boolean;
        blockchainFormat?: 'solana' | 'ethereum';
        autoCreateBlockchainTrades?: boolean;
    };
}

export class BlockchainTradeController {
    private logger: Logger;
    private persistentTradeService: PersistentTradeDiscoveryService;
    private tenantService: TenantManagementService;
    private solanaService: SolanaIntegrationService;

    constructor() {
        this.logger = LoggingService.getInstance().createLogger('BlockchainTradeController');
        this.persistentTradeService = PersistentTradeDiscoveryService.getInstance();
        this.tenantService = TenantManagementService.getInstance();
        
        // Initialize Solana service with devnet configuration
        const solanaConfig: SolanaConfig = {
            rpcUrl: 'https://api.devnet.solana.com',
            programId: '8QhM7mdLqs2mwuNwY4R4UAGiXpLyMg28aih5mZKU2XFD',
            network: 'devnet'
        };
        
        this.solanaService = SolanaIntegrationService.getInstance(solanaConfig);
        
        // Set up event listeners for real-time updates
        this.setupEventListeners();
    }

    /**
     * POST /api/v1/blockchain/discovery/trades
     * Enhanced trade discovery with blockchain execution capabilities
     */
    public discoverBlockchainTrades = async (req: Request & { tenant?: any }, res: Response): Promise<void> => {
        const operation = this.logger.operation('discoverBlockchainTrades');
        const startTime = Date.now();
        
        try {
            const tenant = req.tenant;
            if (!tenant) {
                ErrorResponses.sendError(res, ErrorResponses.unauthorized());
                operation.end();
                return;
            }

            const request: BlockchainTradeDiscoveryRequest = req.body;
            
            // Step 1: Discover trade loops using existing algorithms
            let discoveredTrades: TradeLoop[] = [];
            
            if (request.wallets && request.wallets.length > 0) {
                // Bulk discovery mode - update inventory for all wallets
                const abstractWallets = request.wallets.map(wallet => ({
                    id: wallet.walletAddress,
                    ownedNFTs: wallet.nfts || [],
                    wantedNFTs: []
                }));
                await this.persistentTradeService.updateTenantInventory(tenant.id, abstractWallets);
                // Get discovered trades for the tenant
                discoveredTrades = this.persistentTradeService.getActiveLoopsForTenant(tenant.id);
            } else if (request.walletId) {
                // Single wallet discovery
                discoveredTrades = await this.persistentTradeService.getTradeLoopsForWallet(
                    tenant.id,
                    request.walletId
                );
            } else {
                // Get all available trades for tenant
                discoveredTrades = this.persistentTradeService.getActiveLoopsForTenant(tenant.id);
            }

            // Step 2: Enhance with blockchain capabilities based on mode
            let blockchainTrades: BlockchainTradeLoop[] = [];
            let enhancedTrades = discoveredTrades;

            if (request.mode === 'executable' || request.mode === 'full_blockchain') {
                if (request.settings?.autoCreateBlockchainTrades) {
                    // Automatically create blockchain trade loops for top trades
                    const topTrades = discoveredTrades
                        .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
                        .slice(0, Math.min(5, request.settings?.maxResults || 5));

                    for (const trade of topTrades) {
                        try {
                            const blockchainTrade = await this.solanaService.createBlockchainTradeLoop(trade);
                            blockchainTrades.push(blockchainTrade);
                            
                            // Add blockchain metadata to original trade
                            trade.status = 'pending';
                            (trade as any).blockchainData = {
                                tradeId: blockchainTrade.tradeId,
                                accountAddress: blockchainTrade.accountAddress,
                                explorerUrl: blockchainTrade.explorerUrl,
                                status: blockchainTrade.status
                            };
                        } catch (error) {
                            this.logger.warn('Failed to create blockchain trade loop', {
                                tradeId: trade.id,
                                error: error instanceof Error ? error.message : String(error)
                            });
                        }
                    }
                } else {
                    // Just mark trades as ready for execution
                    enhancedTrades = discoveredTrades.map(trade => ({
                        ...trade,
                        status: 'pending' as const
                    }));
                }
            }

            const duration = Date.now() - startTime;

            operation.info('Blockchain trade discovery completed', {
                tenantId: tenant.id,
                mode: request.mode,
                algorithmic_trades: discoveredTrades.length,
                blockchain_trades: blockchainTrades.length,
                duration: `${duration}ms`
            });

            // Prepare response based on mode
            let response: any = {
                success: true,
                trades: enhancedTrades,
                totalCount: enhancedTrades.length,
                mode: request.mode,
                duration: `${duration}ms`,
                timestamp: new Date().toISOString()
            };

            if (request.mode === 'full_blockchain') {
                response.blockchain = {
                    active_trade_loops: blockchainTrades,
                    contract_address: '8QhM7mdLqs2mwuNwY4R4UAGiXpLyMg28aih5mZKU2XFD',
                    network: 'devnet',
                    explorer_base: 'https://explorer.solana.com?cluster=devnet'
                };
            }

            res.json(response);
            operation.end();

        } catch (error) {
            operation.error('Blockchain trade discovery failed', {
                error: error instanceof Error ? error.message : String(error),
                tenantId: req.tenant?.id
            });

            ErrorResponses.sendError(res, ErrorResponses.internalError(
                error instanceof Error ? error.message : 'Unknown error occurred'
            ));
            operation.end();
        }
    };

    /**
     * POST /api/v1/blockchain/trades/execute
     * Execute a discovered trade loop on the blockchain
     */
    public executeTradeLoop = async (req: Request & { tenant?: any }, res: Response): Promise<void> => {
        const operation = this.logger.operation('executeTradeLoop');
        
        try {
            const tenant = req.tenant;
            if (!tenant) {
                ErrorResponses.sendError(res, ErrorResponses.unauthorized());
                operation.end();
                return;
            }

            const request: TradeExecutionRequest = req.body;
            
            // Validate request
            if (!request.tradeLoopId) {
                ErrorResponses.sendError(res, ErrorResponses.validationError('tradeLoopId is required'));
                operation.end();
                return;
            }

            // Get the trade loop from discovery service
            const tradeLoops = await this.persistentTradeService.getTradeLoopsForWallet(tenant.id, request.walletPublicKey || '');
            const targetTrade = tradeLoops.find(trade => trade.id === request.tradeLoopId);
            
            if (!targetTrade) {
                ErrorResponses.sendError(res, ErrorResponses.notFound('Trade loop not found'));
                operation.end();
                return;
            }

            if (request.mode === 'simulate') {
                // Simulation mode - just validate and return execution plan
                const executionPlan = {
                    tradeLoopId: request.tradeLoopId,
                    participants: targetTrade.totalParticipants,
                    steps: targetTrade.steps.map((step, index) => ({
                        stepIndex: index,
                        from: step.from,
                        to: step.to,
                        nfts: step.nfts.map(nft => ({
                            address: nft.address,
                            name: nft.name,
                            collection: nft.collection
                        })),
                        estimatedGas: '0.001 SOL',
                        requiresApproval: true
                    })),
                    estimatedTotalGas: `${targetTrade.totalParticipants * 0.001} SOL`,
                    timeoutHours: request.customTimeoutHours || 24,
                    readyForExecution: true
                };

                res.json({
                    success: true,
                    mode: 'simulation',
                    executionPlan,
                    message: 'Trade loop simulation completed successfully'
                });
                operation.end();
                return;
            }

            // Execute mode - actually create blockchain trade loop
            const blockchainTrade = await this.solanaService.createBlockchainTradeLoop(targetTrade);

            operation.info('Trade loop execution initiated', {
                tenantId: tenant.id,
                tradeLoopId: request.tradeLoopId,
                blockchainTradeId: blockchainTrade.tradeId,
                accountAddress: blockchainTrade.accountAddress,
                explorerUrl: blockchainTrade.explorerUrl
            });

            res.json({
                success: true,
                mode: 'execute',
                execution: {
                    tradeLoopId: request.tradeLoopId,
                    blockchainTradeId: blockchainTrade.tradeId,
                    accountAddress: blockchainTrade.accountAddress,
                    status: blockchainTrade.status,
                    participants: blockchainTrade.participants,
                    explorerUrl: blockchainTrade.explorerUrl,
                    transactionHash: blockchainTrade.blockchainTxHash,
                    expiresAt: blockchainTrade.expiresAt
                },
                nextSteps: {
                    step1: 'Add trade steps using /api/v1/blockchain/trades/steps',
                    step2: 'Participants approve steps using /api/v1/blockchain/trades/approve',
                    step3: 'Execute final trade using /api/v1/blockchain/trades/complete'
                }
            });
            operation.end();

        } catch (error) {
            operation.error('Trade execution failed', {
                error: error instanceof Error ? error.message : String(error),
                tradeLoopId: req.body.tradeLoopId,
                tenantId: req.tenant?.id
            });

            ErrorResponses.sendError(res, ErrorResponses.internalError(
                error instanceof Error ? error.message : 'Trade execution failed'
            ));
            operation.end();
        }
    };

    /**
     * POST /api/v1/blockchain/trades/approve
     * Approve a trade step
     */
    public approveTradeStep = async (req: Request & { tenant?: any }, res: Response): Promise<void> => {
        const operation = this.logger.operation('approveTradeStep');
        
        try {
            const tenant = req.tenant;
            if (!tenant) {
                ErrorResponses.sendError(res, ErrorResponses.unauthorized());
                operation.end();
                return;
            }

            const request: TradeApprovalRequest = req.body;
            
            // In production, would validate user's wallet signature
            // For now, simulate approval
            const mockKeypair = Keypair.generate(); // Would use actual user keypair
            
            const signature = await this.solanaService.approveTradeStep(
                request.tradeLoopId,
                request.stepIndex,
                mockKeypair
            );

            operation.info('Trade step approved', {
                tenantId: tenant.id,
                tradeLoopId: request.tradeLoopId,
                stepIndex: request.stepIndex,
                walletPublicKey: request.walletPublicKey,
                signature
            });

            res.json({
                success: true,
                approval: {
                    tradeLoopId: request.tradeLoopId,
                    stepIndex: request.stepIndex,
                    walletPublicKey: request.walletPublicKey,
                    signature,
                    explorerUrl: this.solanaService.getExplorerUrl(signature),
                    timestamp: new Date().toISOString()
                }
            });
            operation.end();

        } catch (error) {
            operation.error('Trade approval failed', {
                error: error instanceof Error ? error.message : String(error),
                tradeLoopId: req.body.tradeLoopId,
                stepIndex: req.body.stepIndex,
                tenantId: req.tenant?.id
            });

            ErrorResponses.sendError(res, ErrorResponses.internalError(
                error instanceof Error ? error.message : 'Trade approval failed'
            ));
            operation.end();
        }
    };

    /**
     * GET /api/v1/blockchain/trades/status/:tradeId
     * Get blockchain trade loop status
     */
    public getTradeLoopStatus = async (req: Request & { tenant?: any }, res: Response): Promise<void> => {
        const operation = this.logger.operation('getTradeLoopStatus');
        
        try {
            const tenant = req.tenant;
            if (!tenant) {
                ErrorResponses.sendError(res, ErrorResponses.unauthorized());
                operation.end();
                return;
            }

            const { tradeId } = req.params;
            
            // Get status from blockchain
            const blockchainTrade = await this.solanaService.refreshTradeLoopStatus(tradeId);
            
            if (!blockchainTrade) {
                ErrorResponses.sendError(res, ErrorResponses.notFound('Trade loop not found'));
                operation.end();
                return;
            }

            operation.info('Trade loop status retrieved', {
                tenantId: tenant.id,
                tradeId,
                status: blockchainTrade.status,
                participants: blockchainTrade.participants
            });

            res.json({
                success: true,
                tradeLoop: {
                    tradeId: blockchainTrade.tradeId,
                    accountAddress: blockchainTrade.accountAddress,
                    status: blockchainTrade.status,
                    participants: blockchainTrade.participants,
                    steps: blockchainTrade.steps,
                    createdAt: blockchainTrade.createdAt,
                    expiresAt: blockchainTrade.expiresAt,
                    explorerUrl: blockchainTrade.explorerUrl,
                    completionProgress: this.calculateCompletionProgress(blockchainTrade)
                }
            });
            operation.end();

        } catch (error) {
            operation.error('Failed to get trade loop status', {
                error: error instanceof Error ? error.message : String(error),
                tradeId: req.params.tradeId,
                tenantId: req.tenant?.id
            });

            ErrorResponses.sendError(res, ErrorResponses.internalError(
                error instanceof Error ? error.message : 'Failed to get trade status'
            ));
            operation.end();
        }
    };

    /**
     * GET /api/v1/blockchain/trades/active
     * Get all active blockchain trade loops for tenant
     */
    public getActiveBlockchainTrades = async (req: Request & { tenant?: any }, res: Response): Promise<void> => {
        const operation = this.logger.operation('getActiveBlockchainTrades');
        
        try {
            const tenant = req.tenant;
            if (!tenant) {
                ErrorResponses.sendError(res, ErrorResponses.unauthorized());
                operation.end();
                return;
            }

            const activeTrades = this.solanaService.getActiveTradeLoops();
            
            // Filter by tenant (in production, would store tenant association)
            const tenantTrades = activeTrades.filter(trade => 
                trade.status !== 'completed' && trade.status !== 'cancelled'
            );

            operation.info('Active blockchain trades retrieved', {
                tenantId: tenant.id,
                totalTrades: tenantTrades.length
            });

            res.json({
                success: true,
                trades: tenantTrades.map(trade => ({
                    tradeId: trade.tradeId,
                    accountAddress: trade.accountAddress,
                    status: trade.status,
                    participants: trade.participants,
                    createdAt: trade.createdAt,
                    expiresAt: trade.expiresAt,
                    explorerUrl: trade.explorerUrl,
                    completionProgress: this.calculateCompletionProgress(trade)
                })),
                totalCount: tenantTrades.length,
                contractInfo: {
                    programId: '8QhM7mdLqs2mwuNwY4R4UAGiXpLyMg28aih5mZKU2XFD',
                    network: 'devnet',
                    explorerUrl: 'https://explorer.solana.com/address/8QhM7mdLqs2mwuNwY4R4UAGiXpLyMg28aih5mZKU2XFD?cluster=devnet'
                }
            });
            operation.end();

        } catch (error) {
            operation.error('Failed to get active blockchain trades', {
                error: error instanceof Error ? error.message : String(error),
                tenantId: req.tenant?.id
            });

            ErrorResponses.sendError(res, ErrorResponses.internalError(
                error instanceof Error ? error.message : 'Failed to get active trades'
            ));
            operation.end();
        }
    };

    // =====================================
    // PRIVATE HELPER METHODS
    // =====================================

    private setupEventListeners(): void {
        this.solanaService.on('tradeLoopCreated', (blockchainTrade: BlockchainTradeLoop) => {
            this.logger.info('Real-time: Trade loop created on blockchain', {
                tradeId: blockchainTrade.tradeId,
                accountAddress: blockchainTrade.accountAddress
            });
        });

        this.solanaService.on('tradeStepApproved', (data: any) => {
            this.logger.info('Real-time: Trade step approved', {
                tradeId: data.tradeId,
                stepIndex: data.stepIndex,
                signature: data.signature
            });
        });

        this.solanaService.on('tradeLoopExecuted', (data: any) => {
            this.logger.info('Real-time: Trade loop executed successfully', {
                tradeId: data.tradeId,
                signature: data.signature
            });
        });
    }

    private calculateCompletionProgress(trade: BlockchainTradeLoop): number {
        if (trade.status === 'completed') return 100;
        if (trade.status === 'cancelled' || trade.status === 'expired') return 0;
        
        const totalSteps = trade.steps.length;
        const approvedSteps = trade.steps.filter(step => step.approved).length;
        const executedSteps = trade.steps.filter(step => step.executed).length;
        
        if (executedSteps > 0) return 75 + (executedSteps / totalSteps) * 25;
        if (approvedSteps > 0) return 25 + (approvedSteps / totalSteps) * 50;
        return 10; // Created but not populated
    }
}