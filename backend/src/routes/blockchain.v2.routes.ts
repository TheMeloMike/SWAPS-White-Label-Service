import { Router } from 'express';
import { BlockchainTradeControllerV2 } from '../controllers/BlockchainTradeControllerV2';
import { tenantAuth } from '../middleware/tenantAuth';
import { RateLimiters } from '../middleware/enhancedRateLimit';
import { Request, Response } from 'express';

const router = Router();

// Initialize V2 blockchain controller (user-pays-gas model)
const blockchainControllerV2 = new BlockchainTradeControllerV2();

/**
 * BLOCKCHAIN INTEGRATION API ROUTES v2
 * 
 * User-pays-gas model: API prepares transactions, users sign and pay
 * 
 * This is the financially sustainable model where:
 * - Platform pays $0 in gas fees
 * - Users pay their own gas
 * - Platform profits from trading fees
 */

// ==========================================
// TRANSACTION PREPARATION ENDPOINTS
// ==========================================

/**
 * POST /api/v2/blockchain/trades/prepare
 * Prepare unsigned transaction for user signing
 * 
 * Body:
 * {
 *   "tradeLoopId": "string",
 *   "operation": "create|approve|execute",
 *   "userAddress": "0x...",
 *   "walletId": "string"  // Optional
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "transaction": {
 *     "to": "0xContractAddress",
 *     "data": "0xEncodedCallData",
 *     "value": "0",
 *     "gasLimit": "300000",
 *     "maxFeePerGas": "20000000000",
 *     "maxPriorityFeePerGas": "2000000000"
 *   },
 *   "metadata": {
 *     "operation": "createSwap",
 *     "swapId": "0x...",
 *     "estimatedGas": "300000",
 *     "currentGasPrice": "15000000000"
 *   },
 *   "instructions": {
 *     "step1": "Sign this transaction with your wallet",
 *     "step2": "Broadcast the signed transaction",
 *     "note": "You pay the gas fees from your wallet"
 *   }
 * }
 */
router.post('/trades/prepare',
    RateLimiters.standard,
    tenantAuth.authenticate,
    blockchainControllerV2.prepareTransaction
);

/**
 * POST /api/v2/blockchain/trades/broadcast
 * Record a transaction that was broadcast by the user
 * 
 * Body:
 * {
 *   "tradeLoopId": "string",
 *   "transactionHash": "0x...",
 *   "operation": "create|approve|execute"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "transactionHash": "0x...",
 *   "explorerUrl": "https://sepolia.etherscan.io/tx/0x...",
 *   "status": "pending_confirmation"
 * }
 */
router.post('/trades/broadcast',
    RateLimiters.standard,
    tenantAuth.authenticate,
    blockchainControllerV2.recordBroadcastedTransaction
);

/**
 * GET /api/v2/blockchain/gas-prices
 * Get current gas prices for user reference
 * 
 * Response:
 * {
 *   "success": true,
 *   "gasPrices": {
 *     "gasPrice": "15000000000",
 *     "maxFeePerGas": "20000000000",
 *     "maxPriorityFeePerGas": "2000000000"
 *   },
 *   "network": "sepolia",
 *   "timestamp": "2025-01-11T..."
 * }
 */
router.get('/gas-prices',
    RateLimiters.standard,
    tenantAuth.authenticateOptional,
    blockchainControllerV2.getGasPrices
);

// ==========================================
// API DOCUMENTATION
// ==========================================

/**
 * GET /api/v2/blockchain/docs
 * V2 API documentation (user-pays-gas model)
 */
router.get('/docs', (req: Request, res: Response) => {
    res.json({
        version: '2.0.0',
        model: 'User Pays Gas',
        description: 'Financially sustainable model where users pay their own gas fees',
        endpoints: {
            prepare: {
                method: 'POST',
                path: '/api/v2/blockchain/trades/prepare',
                description: 'Prepare unsigned transaction for user signing',
                authentication: 'Required',
                userPaysGas: true
            },
            broadcast: {
                method: 'POST',
                path: '/api/v2/blockchain/trades/broadcast',
                description: 'Record user-broadcasted transaction',
                authentication: 'Required'
            },
            gasPrices: {
                method: 'GET',
                path: '/api/v2/blockchain/gas-prices',
                description: 'Get current network gas prices',
                authentication: 'Optional'
            }
        },
        flow: {
            step1: {
                action: 'Discover trade loops',
                endpoint: '/api/v1/blockchain/discovery/trades',
                paysGas: false
            },
            step2: {
                action: 'Prepare transaction',
                endpoint: '/api/v2/blockchain/trades/prepare',
                paysGas: false,
                returns: 'Unsigned transaction data'
            },
            step3: {
                action: 'User signs with wallet',
                location: 'Frontend/MetaMask',
                paysGas: true,
                userAction: true
            },
            step4: {
                action: 'User broadcasts transaction',
                location: 'Frontend/MetaMask',
                paysGas: true,
                userAction: true
            },
            step5: {
                action: 'Report transaction hash',
                endpoint: '/api/v2/blockchain/trades/broadcast',
                paysGas: false
            }
        },
        benefits: {
            platform: [
                'Zero gas costs',
                'No private key management',
                'Financially sustainable',
                'Profit from trading fees'
            ],
            users: [
                'Full control of transactions',
                'Use their preferred wallet',
                'Transparent gas costs',
                'Security of self-custody'
            ]
        },
        example: {
            prepare: {
                request: {
                    tradeLoopId: 'canonical_alice,bob,carol|nft1,nft2,nft3',
                    operation: 'create',
                    userAddress: '0x78c9730c9A8A645bD3022771F9509e65DCd3a499',
                    walletId: 'alice_wallet'
                },
                response: {
                    success: true,
                    transaction: {
                        to: '0xb17Ad11D1b9474c5e7403cA62A8B6D3bc6Deae67',
                        data: '0x...',
                        value: '0',
                        gasLimit: '300000'
                    }
                }
            }
        }
    });
});

export default router;