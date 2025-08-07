import { ethers } from 'ethers';
import { TradeLoop } from '../../types/trade';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { WalletAddressMappingService } from './WalletAddressMappingService';

/**
 * Ethereum Transaction Preparer Service
 * 
 * Prepares unsigned transaction data for users to sign with their own wallets.
 * This is the correct architecture - users pay their own gas.
 */

export interface PreparedTransaction {
    to: string;
    data: string;
    value: string;
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    nonce?: number;
}

export interface TransactionPreparationResult {
    success: boolean;
    transaction?: PreparedTransaction;
    metadata?: {
        operation: string;
        swapId?: string;
        participants?: string[];
        estimatedGas?: string;
        currentGasPrice?: string;
    };
    error?: string;
}

// Smart contract ABI for the MultiPartyNFTSwap contract
const SWAP_CONTRACT_ABI = [
    "function createSwap(bytes32 swapId, tuple(address wallet, tuple(address contractAddress, uint256 tokenId, address currentOwner, bool isERC1155, uint256 amount)[] givingNFTs, tuple(address contractAddress, uint256 tokenId, address currentOwner, bool isERC1155, uint256 amount)[] receivingNFTs, bool hasApproved)[] participants, uint256 duration)",
    "function approveSwap(bytes32 swapId)",
    "function executeSwap(bytes32 swapId)",
    "function cancelSwap(bytes32 swapId, string reason)",
];

export class EthereumTransactionPreparer {
    private static instance: EthereumTransactionPreparer;
    private logger: Logger;
    private provider: ethers.Provider;
    private contractInterface: ethers.Interface;
    private contractAddress: string;
    private walletMapping: WalletAddressMappingService;

    private constructor() {
        this.logger = LoggingService.getInstance().createLogger('EthereumTransactionPreparer');
        
        // Initialize provider
        const rpcUrl = process.env.ETHEREUM_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        
        // Initialize wallet mapping service
        this.walletMapping = WalletAddressMappingService.getInstance();
        
        // Initialize contract interface
        this.contractInterface = new ethers.Interface(SWAP_CONTRACT_ABI);
        
        // Contract address
        this.contractAddress = process.env.ETHEREUM_CONTRACT_ADDRESS || '0xb17Ad11D1b9474c5e7403cA62A8B6D3bc6Deae67';
    }

    public static getInstance(): EthereumTransactionPreparer {
        if (!EthereumTransactionPreparer.instance) {
            EthereumTransactionPreparer.instance = new EthereumTransactionPreparer();
        }
        return EthereumTransactionPreparer.instance;
    }

    /**
     * Prepare createSwap transaction for user signing
     */
    public async prepareCreateSwap(
        tradeLoop: TradeLoop,
        userAddress: string,
        tenantId: string
    ): Promise<TransactionPreparationResult> {
        const operation = this.logger.operation('prepareCreateSwap');
        
        try {
            // Generate swap ID
            const swapId = ethers.id(tradeLoop.id);
            
            // Extract all wallet IDs from trade loop steps
            const walletIds = [...new Set([
                ...tradeLoop.steps.map(step => step.from),
                ...tradeLoop.steps.map(step => step.to)
            ])];
            
            // Get wallet addresses for all participants
            operation.info('Resolving wallet addresses for trade participants', { walletIds });
            const walletAddresses = await this.walletMapping.getWalletAddresses(tenantId, walletIds, 'ethereum');
            
            // Validate that all wallet addresses were resolved
            const missingAddresses = walletIds.filter(walletId => !walletAddresses.has(walletId));
            if (missingAddresses.length > 0) {
                throw new Error(`Could not resolve Ethereum addresses for wallets: ${missingAddresses.join(', ')}`);
            }
            
            operation.info('Successfully resolved all wallet addresses', { 
                resolved: Array.from(walletAddresses.entries())
            });
            
            // Build participants array with proper Ethereum addresses
            const participants = tradeLoop.steps.map(step => {
                const walletAddress = walletAddresses.get(step.from);
                if (!walletAddress) {
                    throw new Error(`No Ethereum address found for wallet ID: ${step.from}`);
                }
                
                const givingNFTs = step.nfts.map(nft => ({
                    contractAddress: nft.address || '0x0000000000000000000000000000000000000000',
                    tokenId: '1', // Default token ID, should be enhanced to extract from nft.address
                    currentOwner: walletAddress, // Use resolved Ethereum address
                    isERC1155: false,
                    amount: 1
                }));
                
                return {
                    wallet: walletAddress, // Use resolved Ethereum address
                    givingNFTs,
                    receivingNFTs: [], // Will be filled based on trade logic
                    hasApproved: false
                };
            });
            
            // Encode function data
            const data = this.contractInterface.encodeFunctionData('createSwap', [
                swapId,
                participants,
                86400 // 24 hour duration
            ]);
            
            // Estimate gas
            const estimatedGas = await this.estimateGas(userAddress, this.contractAddress, data);
            
            // Get current gas prices
            const feeData = await this.provider.getFeeData();
            
            const result: TransactionPreparationResult = {
                success: true,
                transaction: {
                    to: this.contractAddress,
                    data: data,
                    value: '0',
                    gasLimit: estimatedGas.toString(),
                    maxFeePerGas: feeData.maxFeePerGas?.toString(),
                    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString()
                },
                metadata: {
                    operation: 'createSwap',
                    swapId: swapId,
                    participants: tradeLoop.steps.map(s => s.from),
                    estimatedGas: estimatedGas.toString(),
                    currentGasPrice: feeData.gasPrice?.toString()
                }
            };
            
            operation.info('Transaction prepared for user signing', {
                swapId,
                userAddress,
                estimatedGas: estimatedGas.toString()
            });
            
            operation.end();
            return result;
            
        } catch (error) {
            operation.error('Failed to prepare transaction', {
                error: error instanceof Error ? error.message : String(error)
            });
            operation.end();
            
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to prepare transaction'
            };
        }
    }

    /**
     * Prepare approveSwap transaction for user signing
     */
    public async prepareApproveSwap(
        swapId: string,
        userAddress: string
    ): Promise<TransactionPreparationResult> {
        const operation = this.logger.operation('prepareApproveSwap');
        
        try {
            // Encode function data
            const data = this.contractInterface.encodeFunctionData('approveSwap', [swapId]);
            
            // Estimate gas
            const estimatedGas = await this.estimateGas(userAddress, this.contractAddress, data);
            
            // Get current gas prices
            const feeData = await this.provider.getFeeData();
            
            const result: TransactionPreparationResult = {
                success: true,
                transaction: {
                    to: this.contractAddress,
                    data: data,
                    value: '0',
                    gasLimit: estimatedGas.toString(),
                    maxFeePerGas: feeData.maxFeePerGas?.toString(),
                    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString()
                },
                metadata: {
                    operation: 'approveSwap',
                    swapId: swapId,
                    estimatedGas: estimatedGas.toString(),
                    currentGasPrice: feeData.gasPrice?.toString()
                }
            };
            
            operation.info('Approval transaction prepared', {
                swapId,
                userAddress,
                estimatedGas: estimatedGas.toString()
            });
            
            operation.end();
            return result;
            
        } catch (error) {
            operation.error('Failed to prepare approval', {
                error: error instanceof Error ? error.message : String(error)
            });
            operation.end();
            
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to prepare approval'
            };
        }
    }

    /**
     * Prepare executeSwap transaction for user signing
     */
    public async prepareExecuteSwap(
        swapId: string,
        userAddress: string
    ): Promise<TransactionPreparationResult> {
        const operation = this.logger.operation('prepareExecuteSwap');
        
        try {
            // Encode function data
            const data = this.contractInterface.encodeFunctionData('executeSwap', [swapId]);
            
            // Estimate gas (higher for execution)
            const estimatedGas = await this.estimateGas(userAddress, this.contractAddress, data, 500000n);
            
            // Get current gas prices
            const feeData = await this.provider.getFeeData();
            
            const result: TransactionPreparationResult = {
                success: true,
                transaction: {
                    to: this.contractAddress,
                    data: data,
                    value: '0',
                    gasLimit: estimatedGas.toString(),
                    maxFeePerGas: feeData.maxFeePerGas?.toString(),
                    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString()
                },
                metadata: {
                    operation: 'executeSwap',
                    swapId: swapId,
                    estimatedGas: estimatedGas.toString(),
                    currentGasPrice: feeData.gasPrice?.toString()
                }
            };
            
            operation.info('Execution transaction prepared', {
                swapId,
                userAddress,
                estimatedGas: estimatedGas.toString()
            });
            
            operation.end();
            return result;
            
        } catch (error) {
            operation.error('Failed to prepare execution', {
                error: error instanceof Error ? error.message : String(error)
            });
            operation.end();
            
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to prepare execution'
            };
        }
    }

    /**
     * Estimate gas for a transaction
     */
    private async estimateGas(
        from: string,
        to: string,
        data: string,
        minGas: bigint = 200000n
    ): Promise<bigint> {
        try {
            const estimated = await this.provider.estimateGas({
                from,
                to,
                data
            });
            
            // Add 20% buffer
            const withBuffer = (estimated * 120n) / 100n;
            
            // Ensure minimum gas
            return withBuffer > minGas ? withBuffer : minGas;
            
        } catch (error) {
            this.logger.warn('Gas estimation failed, using default', {
                error: error instanceof Error ? error.message : String(error)
            });
            return minGas;
        }
    }

    /**
     * Get current gas prices
     */
    public async getCurrentGasPrices(): Promise<{
        gasPrice?: string;
        maxFeePerGas?: string;
        maxPriorityFeePerGas?: string;
    }> {
        const feeData = await this.provider.getFeeData();
        return {
            gasPrice: feeData.gasPrice?.toString(),
            maxFeePerGas: feeData.maxFeePerGas?.toString(),
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString()
        };
    }
}