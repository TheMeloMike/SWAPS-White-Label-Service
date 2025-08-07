import { Request, Response } from 'express';
import { EthereumTransactionPreparer } from '../services/blockchain/EthereumTransactionPreparer';
import { PersistentTradeDiscoveryService } from '../services/trade/PersistentTradeDiscoveryService';
import { LoggingService, Logger } from '../utils/logging/LoggingService';
import { ErrorResponses } from '../utils/errorResponses';

/**
 * Blockchain Trade Controller V2 - User Pays Gas Model
 * 
 * This is the correct implementation where users pay their own gas fees.
 * The API prepares transaction data that users sign with their own wallets.
 */

export interface TransactionPreparationRequest {
    tradeLoopId: string;
    operation: 'create' | 'approve' | 'execute';
    userAddress: string;
    walletId?: string;
}

export class BlockchainTradeControllerV2 {
    private logger: Logger;
    private transactionPreparer: EthereumTransactionPreparer;
    private persistentTradeService: PersistentTradeDiscoveryService;

    constructor() {
        this.logger = LoggingService.getInstance().createLogger('BlockchainTradeControllerV2');
        this.transactionPreparer = EthereumTransactionPreparer.getInstance();
        this.persistentTradeService = PersistentTradeDiscoveryService.getInstance();
    }

    /**
     * POST /api/v2/blockchain/trades/prepare
     * Prepare unsigned transaction for user signing (USER PAYS GAS)
     */
    public prepareTransaction = async (req: Request & { tenant?: any }, res: Response): Promise<void> => {
        const operation = this.logger.operation('prepareTransaction');
        
        try {
            const tenant = req.tenant;
            if (!tenant) {
                ErrorResponses.sendError(res, ErrorResponses.unauthorized());
                operation.end();
                return;
            }

            const request: TransactionPreparationRequest = req.body;
            
            // Validate request
            if (!request.tradeLoopId || !request.operation || !request.userAddress) {
                ErrorResponses.sendError(res, ErrorResponses.validationError(
                    'tradeLoopId, operation, and userAddress are required'
                ));
                operation.end();
                return;
            }

            // Get the trade loop from discovery service
            const walletId = request.walletId || request.userAddress;
            const tradeLoops = await this.persistentTradeService.getTradeLoopsForWallet(tenant.id, walletId);
            const targetTrade = tradeLoops.find(trade => trade.id === request.tradeLoopId);
            
            if (!targetTrade) {
                ErrorResponses.sendError(res, ErrorResponses.notFound('Trade loop not found'));
                operation.end();
                return;
            }

            let result;

            switch (request.operation) {
                case 'create':
                    result = await this.transactionPreparer.prepareCreateSwap(
                        targetTrade,
                        request.userAddress,
                        tenant.id
                    );
                    break;

                case 'approve':
                    // For approve, we need the swapId which should be stored after create
                    const swapId = this.getSwapIdForTradeLoop(request.tradeLoopId);
                    if (!swapId) {
                        ErrorResponses.sendError(res, ErrorResponses.validationError(
                            'Swap must be created first before approval'
                        ));
                        operation.end();
                        return;
                    }
                    result = await this.transactionPreparer.prepareApproveSwap(
                        swapId,
                        request.userAddress
                    );
                    break;

                case 'execute':
                    // For execute, we need the swapId
                    const execSwapId = this.getSwapIdForTradeLoop(request.tradeLoopId);
                    if (!execSwapId) {
                        ErrorResponses.sendError(res, ErrorResponses.validationError(
                            'Swap must be created and approved first'
                        ));
                        operation.end();
                        return;
                    }
                    result = await this.transactionPreparer.prepareExecuteSwap(
                        execSwapId,
                        request.userAddress
                    );
                    break;

                default:
                    ErrorResponses.sendError(res, ErrorResponses.validationError(
                        'Invalid operation. Must be create, approve, or execute'
                    ));
                    operation.end();
                    return;
            }

            if (result.success) {
                operation.info('Transaction prepared for user signing', {
                    tenantId: tenant.id,
                    tradeLoopId: request.tradeLoopId,
                    operation: request.operation,
                    userAddress: request.userAddress,
                    estimatedGas: result.metadata?.estimatedGas
                });

                res.json({
                    success: true,
                    message: 'Transaction prepared for user signing',
                    transaction: result.transaction,
                    metadata: result.metadata,
                    instructions: {
                        step1: 'Sign this transaction with your wallet (MetaMask, etc.)',
                        step2: 'Broadcast the signed transaction to the network',
                        step3: 'Transaction hash will be returned after broadcast',
                        note: 'You pay the gas fees from your wallet'
                    }
                });
            } else {
                ErrorResponses.sendError(res, ErrorResponses.internalError(
                    result.error || 'Failed to prepare transaction'
                ));
            }

            operation.end();

        } catch (error) {
            operation.error('Transaction preparation failed', {
                error: error instanceof Error ? error.message : String(error),
                tenantId: req.tenant?.id
            });

            ErrorResponses.sendError(res, ErrorResponses.internalError(
                error instanceof Error ? error.message : 'Transaction preparation failed'
            ));
            operation.end();
        }
    };

    /**
     * POST /api/v2/blockchain/trades/broadcast
     * Record a transaction that was broadcast by the user
     */
    public recordBroadcastedTransaction = async (req: Request & { tenant?: any }, res: Response): Promise<void> => {
        const operation = this.logger.operation('recordBroadcastedTransaction');
        
        try {
            const tenant = req.tenant;
            if (!tenant) {
                ErrorResponses.sendError(res, ErrorResponses.unauthorized());
                operation.end();
                return;
            }

            const { tradeLoopId, transactionHash, operation: txOperation } = req.body;

            if (!tradeLoopId || !transactionHash || !txOperation) {
                ErrorResponses.sendError(res, ErrorResponses.validationError(
                    'tradeLoopId, transactionHash, and operation are required'
                ));
                operation.end();
                return;
            }

            // Store the transaction hash for tracking
            // In production, this would update your database
            operation.info('Recording user-broadcasted transaction', {
                tenantId: tenant.id,
                tradeLoopId,
                transactionHash,
                operation: txOperation
            });

            res.json({
                success: true,
                message: 'Transaction recorded successfully',
                transactionHash,
                explorerUrl: `https://sepolia.etherscan.io/tx/${transactionHash}`,
                status: 'pending_confirmation'
            });

            operation.end();

        } catch (error) {
            operation.error('Failed to record transaction', {
                error: error instanceof Error ? error.message : String(error),
                tenantId: req.tenant?.id
            });

            ErrorResponses.sendError(res, ErrorResponses.internalError(
                error instanceof Error ? error.message : 'Failed to record transaction'
            ));
            operation.end();
        }
    };

    /**
     * GET /api/v2/blockchain/gas-prices
     * Get current gas prices for user reference
     */
    public getGasPrices = async (req: Request & { tenant?: any }, res: Response): Promise<void> => {
        const operation = this.logger.operation('getGasPrices');
        
        try {
            const prices = await this.transactionPreparer.getCurrentGasPrices();

            res.json({
                success: true,
                gasPrices: prices,
                network: 'sepolia',
                timestamp: new Date().toISOString()
            });

            operation.end();

        } catch (error) {
            operation.error('Failed to get gas prices', {
                error: error instanceof Error ? error.message : String(error)
            });

            ErrorResponses.sendError(res, ErrorResponses.internalError(
                error instanceof Error ? error.message : 'Failed to get gas prices'
            ));
            operation.end();
        }
    };

    /**
     * Helper to get swapId for a trade loop
     * In production, this would query your database
     */
    private getSwapIdForTradeLoop(tradeLoopId: string): string | null {
        // For now, generate deterministically from trade loop ID
        // In production, this would be stored after create operation
        const ethers = require('ethers');
        return ethers.id(tradeLoopId);
    }
}