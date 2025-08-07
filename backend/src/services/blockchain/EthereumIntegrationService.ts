import { ethers, Contract, Wallet, HDNodeWallet } from 'ethers';
import { TradeLoop } from '../../types/trade';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { EventEmitter } from 'events';

/**
 * SWAPS Ethereum Integration Service
 * 
 * Connects the SWAPS backend API to the deployed Ethereum smart contract
 * Handles trade execution, status tracking, and blockchain interactions
 * 
 * Mirrors the functionality of SolanaIntegrationService for Ethereum
 */

export interface EthereumTradeStep {
    stepIndex: number;
    from: string;
    to: string;
    nftContracts: string[];
    nftTokenIds: string[];
    approved?: boolean;
    executed?: boolean;
    transactionHash?: string;
}

export interface EthereumBlockchainTradeLoop {
    swapId: string;
    tradeId: string; // Alias for compatibility with Solana interface
    contractAddress: string;
    accountAddress: string; // Alias for compatibility with Solana interface
    participants: number;
    steps: EthereumTradeStep[];
    status: 'created' | 'approving' | 'executing' | 'completed' | 'cancelled' | 'expired';
    createdAt: Date;
    expiresAt: Date;
    blockchainTxHash?: string;
    explorerUrl?: string;
}

export interface EthereumConfig {
    rpcUrl: string;
    contractAddress: string;
    network: 'mainnet' | 'goerli' | 'sepolia' | 'polygon' | 'bsc';
    payerWallet?: Wallet; // For automated execution (optional)
    gasLimit?: number;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
}

// Smart contract ABI for the MultiPartyNFTSwap contract
const SWAP_CONTRACT_ABI = [
    "function createSwap(bytes32 swapId, tuple(address wallet, tuple(address contractAddress, uint256 tokenId, address currentOwner, bool isERC1155, uint256 amount)[] givingNFTs, tuple(address contractAddress, uint256 tokenId, address currentOwner, bool isERC1155, uint256 amount)[] receivingNFTs, bool hasApproved)[] participants, uint256 duration)",
    "function approveSwap(bytes32 swapId)",
    "function executeSwap(bytes32 swapId)",
    "function cancelSwap(bytes32 swapId, string reason)",
    "function getSwapStatus(bytes32 swapId) view returns (uint8 status, bool allApproved, uint256 approvalCount, uint256 totalParticipants)",
    "function getSwapDetails(bytes32 swapId) view returns (uint8 status, uint256 participantCount, uint256 createdAt, uint256 expiresAt, address initiator)",
    "function getSwapParticipants(bytes32 swapId) view returns (tuple(address wallet, tuple(address contractAddress, uint256 tokenId, address currentOwner, bool isERC1155, uint256 amount)[] givingNFTs, tuple(address contractAddress, uint256 tokenId, address currentOwner, bool isERC1155, uint256 amount)[] receivingNFTs, bool hasApproved)[])",
    "function isParticipant(bytes32 swapId, address wallet) view returns (bool)",
    "function batchCancelExpiredSwaps(bytes32[] swapIds)",
    "event SwapCreated(bytes32 indexed swapId, address indexed initiator, uint256 participantCount, uint256 expiresAt)",
    "event SwapApproved(bytes32 indexed swapId, address indexed participant)",
    "event SwapExecuted(bytes32 indexed swapId, uint256 participantCount, uint256 nftCount)",
    "event SwapCancelled(bytes32 indexed swapId, address indexed canceller, string reason)"
];

export class EthereumIntegrationService extends EventEmitter {
    private static instance: EthereumIntegrationService;
    private provider: ethers.Provider;
    private contract: any; // Contract with dynamic ABI
    private logger: Logger;
    private activeTradeLoops: Map<string, EthereumBlockchainTradeLoop> = new Map();
    private network: string;
    private payerWallet?: Wallet;
    private config: EthereumConfig;

    private constructor(config: EthereumConfig) {
        super();
        this.config = config;
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
        this.contract = new Contract(config.contractAddress, SWAP_CONTRACT_ABI, this.provider);
        this.network = config.network;
        this.payerWallet = config.payerWallet;
        this.logger = LoggingService.getInstance().createLogger('EthereumIntegration');
        
        this.logger.info('Ethereum Integration Service initialized', {
            network: config.network,
            contractAddress: config.contractAddress,
            rpcUrl: config.rpcUrl
        });

        this.setupEventListeners();
    }

    public static getInstance(config?: EthereumConfig): EthereumIntegrationService {
        if (!EthereumIntegrationService.instance && config) {
            EthereumIntegrationService.instance = new EthereumIntegrationService(config);
        }
        return EthereumIntegrationService.instance;
    }

    /**
     * Convert a discovered TradeLoop to an Ethereum blockchain-executable format
     */
    public async createBlockchainTradeLoop(
        tradeLoop: TradeLoop,
        creatorWallet?: Wallet | ethers.HDNodeWallet
    ): Promise<EthereumBlockchainTradeLoop> {
        const operation = this.logger.operation('createBlockchainTradeLoop');
        
        try {
            // Generate unique swap ID
            const swapId = ethers.keccak256(ethers.toUtf8Bytes(
                `${Date.now()}-${Math.random()}-${tradeLoop.id}`
            ));
            
            const wallet = creatorWallet || this.payerWallet;
            if (!wallet) {
                throw new Error('No wallet available for trade creation');
            }

            const contractWithSigner = this.contract.connect(wallet);

            // Convert TradeLoop to contract format
            const participants = this.convertTradeLoopToContractFormat(tradeLoop);
            const duration = 24 * 60 * 60; // 24 hours

            operation.info('Creating Ethereum trade loop', {
                swapId: swapId,
                participants: participants.length,
                creator: wallet.address
            });

            // Estimate gas for the transaction
            const gasEstimate = await contractWithSigner.createSwap.estimateGas(
                swapId,
                participants,
                duration
            );

            // Create the swap on blockchain
            const tx = await contractWithSigner.createSwap(
                swapId,
                participants,
                duration,
                {
                    gasLimit: gasEstimate.mul(120).div(100), // 20% buffer
                    maxFeePerGas: this.config.maxFeePerGas,
                    maxPriorityFeePerGas: this.config.maxPriorityFeePerGas
                }
            );

            const receipt = await tx.wait();

            const blockchainTradeLoop: EthereumBlockchainTradeLoop = {
                swapId: swapId,
                tradeId: swapId, // Alias for compatibility
                contractAddress: this.config.contractAddress,
                accountAddress: this.config.contractAddress, // Alias for compatibility
                participants: participants.length,
                steps: this.convertToTradeSteps(tradeLoop),
                status: 'created',
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + duration * 1000),
                blockchainTxHash: receipt.hash,
                explorerUrl: this.getExplorerUrl(receipt.hash)
            };

            this.activeTradeLoops.set(swapId, blockchainTradeLoop);

            operation.info('Ethereum trade loop created successfully', {
                swapId: swapId,
                txHash: receipt.hash,
                explorerUrl: blockchainTradeLoop.explorerUrl
            });

            this.emit('tradeLoopCreated', blockchainTradeLoop);
            return blockchainTradeLoop;

        } catch (error: any) {
            operation.error('Failed to create Ethereum trade loop', { error: error.message });
            throw new Error(`Ethereum trade creation failed: ${error.message}`);
        } finally {
            operation.end();
        }
    }

    /**
     * Approve a trade step for a specific participant
     */
    public async approveTradeStep(
        swapId: string,
        participantWallet: Wallet | ethers.HDNodeWallet
    ): Promise<string> {
        const operation = this.logger.operation('approveTradeStep');
        
        try {
            const contractWithSigner = this.contract.connect(participantWallet);

            operation.info('Approving trade step', {
                swapId: swapId,
                participant: participantWallet.address
            });

            const tx = await contractWithSigner.approveSwap(swapId, {
                gasLimit: this.config.gasLimit || 200000,
                maxFeePerGas: this.config.maxFeePerGas,
                maxPriorityFeePerGas: this.config.maxPriorityFeePerGas
            });

            const receipt = await tx.wait();

            operation.info('Trade step approved', {
                swapId: swapId,
                participant: participantWallet.address,
                txHash: receipt.hash
            });

            this.emit('tradeStepApproved', {
                swapId,
                participant: participantWallet.address,
                txHash: receipt.hash
            });

            return receipt.hash;

        } catch (error: any) {
            operation.error('Failed to approve trade step', { 
                swapId, 
                participant: participantWallet.address,
                error: error.message 
            });
            throw new Error(`Trade approval failed: ${error.message}`);
        } finally {
            operation.end();
        }
    }

    /**
     * Execute the swap once all participants have approved
     */
    public async executeSwap(
        swapId: string,
        executorWallet?: Wallet
    ): Promise<string> {
        const operation = this.logger.operation('executeSwap');
        
        try {
            const wallet = executorWallet || this.payerWallet;
            if (!wallet) {
                throw new Error('No wallet available for swap execution');
            }

            const contractWithSigner = this.contract.connect(wallet);

            operation.info('Executing atomic swap', {
                swapId: swapId,
                executor: wallet.address
            });

            // Check if all participants have approved
            const [status, allApproved, approvalCount, totalParticipants] = 
                await this.contract.getSwapStatus(swapId);

            if (!allApproved) {
                throw new Error(`Swap not ready for execution: ${approvalCount}/${totalParticipants} approved`);
            }

            const tx = await contractWithSigner.executeSwap(swapId, {
                gasLimit: this.config.gasLimit || 500000, // Higher limit for execution
                maxFeePerGas: this.config.maxFeePerGas,
                maxPriorityFeePerGas: this.config.maxPriorityFeePerGas
            });

            const receipt = await tx.wait();

            // Update local state
            const tradeLoop = this.activeTradeLoops.get(swapId);
            if (tradeLoop) {
                tradeLoop.status = 'completed';
                tradeLoop.blockchainTxHash = receipt.hash;
            }

            operation.info('Atomic swap executed successfully', {
                swapId: swapId,
                txHash: receipt.hash,
                explorerUrl: this.getExplorerUrl(receipt.hash)
            });

            this.emit('swapExecuted', {
                swapId,
                txHash: receipt.hash,
                explorerUrl: this.getExplorerUrl(receipt.hash)
            });

            return receipt.hash;

        } catch (error: any) {
            operation.error('Failed to execute swap', { 
                swapId, 
                error: error.message 
            });
            throw new Error(`Swap execution failed: ${error.message}`);
        } finally {
            operation.end();
        }
    }

    /**
     * Get current status of a swap
     */
    public async getSwapStatus(swapId: string): Promise<{
        status: string;
        allApproved: boolean;
        approvalCount: number;
        totalParticipants: number;
    }> {
        try {
            const [status, allApproved, approvalCount, totalParticipants] = 
                await this.contract.getSwapStatus(swapId);

            const statusNames = ['Created', 'Approved', 'Executed', 'Cancelled', 'Expired'];

            return {
                status: statusNames[status] || 'Unknown',
                allApproved,
                approvalCount: Number(approvalCount),
                totalParticipants: Number(totalParticipants)
            };
        } catch (error: any) {
            this.logger.error('Failed to get swap status', { swapId, error: error.message });
            throw error;
        }
    }

    /**
     * Cancel a swap
     */
    public async cancelSwap(
        swapId: string,
        reason: string,
        wallet: Wallet
    ): Promise<string> {
        const operation = this.logger.operation('cancelSwap');
        
        try {
            const contractWithSigner = this.contract.connect(wallet);

            const tx = await contractWithSigner.cancelSwap(swapId, reason, {
                gasLimit: this.config.gasLimit || 100000,
                maxFeePerGas: this.config.maxFeePerGas,
                maxPriorityFeePerGas: this.config.maxPriorityFeePerGas
            });

            const receipt = await tx.wait();

            // Update local state
            const tradeLoop = this.activeTradeLoops.get(swapId);
            if (tradeLoop) {
                tradeLoop.status = 'cancelled';
            }

            operation.info('Swap cancelled', {
                swapId,
                reason,
                txHash: receipt.hash
            });

            return receipt.hash;

        } catch (error: any) {
            operation.error('Failed to cancel swap', { swapId, error: error.message });
            throw error;
        } finally {
            operation.end();
        }
    }

    /**
     * Get explorer URL for a transaction
     */
    public getExplorerUrl(txHash: string): string {
        const explorerUrls: Record<string, string> = {
            'mainnet': 'https://etherscan.io/tx/',
            'goerli': 'https://goerli.etherscan.io/tx/',
            'sepolia': 'https://sepolia.etherscan.io/tx/',
            'polygon': 'https://polygonscan.com/tx/',
            'bsc': 'https://bscscan.com/tx/'
        };

        const baseUrl = explorerUrls[this.network] || explorerUrls['mainnet'];
        return `${baseUrl}${txHash}`;
    }

    /**
     * Get blockchain info for status endpoint
     */
    public async getBlockchainInfo(): Promise<any> {
        try {
            const network = await this.provider.getNetwork();
            const latestBlock = await this.provider.getBlockNumber();

            return {
                network: this.network,
                chainId: Number(network.chainId),
                contractAddress: this.config.contractAddress,
                latestBlock,
                activeTradeLoops: this.activeTradeLoops.size
            };
        } catch (error: any) {
            this.logger.error('Failed to get blockchain info', { error: error.message });
            throw error;
        }
    }

    // ============ PRIVATE HELPER METHODS ============

    private convertTradeLoopToContractFormat(tradeLoop: TradeLoop): any[] {
        // Convert SWAPS TradeLoop format to Ethereum contract participant format
        const participants: any[] = [];

        // Build participant map from trade steps
        const participantMap = new Map<string, {
            wallet: string;
            giving: any[];
            receiving: any[];
        }>();

        tradeLoop.steps.forEach(step => {
            // Initialize participants if not exists
            if (!participantMap.has(step.from)) {
                participantMap.set(step.from, { wallet: step.from, giving: [], receiving: [] });
            }
            if (!participantMap.has(step.to)) {
                participantMap.set(step.to, { wallet: step.to, giving: [], receiving: [] });
            }

            // Add NFTs to giving/receiving arrays
            step.nfts.forEach(nft => {
                // Add to giver's giving array
                participantMap.get(step.from)!.giving.push({
                    contractAddress: nft.address,
                    tokenId: ethers.toBigInt(nft.address.slice(-10)), // Simple tokenId derivation
                    currentOwner: step.from,
                    isERC1155: false, // Default to ERC721
                    amount: 1
                });

                // Add to receiver's receiving array
                participantMap.get(step.to)!.receiving.push({
                    contractAddress: nft.address,
                    tokenId: ethers.toBigInt(nft.address.slice(-10)),
                    currentOwner: step.from,
                    isERC1155: false,
                    amount: 1
                });
            });
        });

        // Convert map to array format expected by contract
        for (const [address, data] of participantMap) {
            participants.push({
                wallet: data.wallet,
                givingNFTs: data.giving,
                receivingNFTs: data.receiving,
                hasApproved: false
            });
        }

        return participants;
    }

    private convertToTradeSteps(tradeLoop: TradeLoop): EthereumTradeStep[] {
        return tradeLoop.steps.map((step, index) => ({
            stepIndex: index,
            from: step.from,
            to: step.to,
            nftContracts: step.nfts.map(nft => nft.address),
            nftTokenIds: step.nfts.map(nft => nft.address.slice(-10)),
            approved: false,
            executed: false
        }));
    }

    private setupEventListeners(): void {
        // Listen to contract events
        this.contract.on('SwapCreated', (swapId: string, initiator: string, participantCount: any, expiresAt: any) => {
            this.logger.info('SwapCreated event', {
                swapId: swapId,
                initiator,
                participantCount: Number(participantCount)
            });
        });

        this.contract.on('SwapApproved', (swapId: string, participant: string) => {
            this.logger.info('SwapApproved event', {
                swapId: swapId,
                participant
            });
        });

        this.contract.on('SwapExecuted', (swapId: string, participantCount: any, nftCount: any) => {
            this.logger.info('SwapExecuted event', {
                swapId: swapId,
                participantCount: Number(participantCount),
                nftCount: Number(nftCount)
            });
        });

        this.contract.on('SwapCancelled', (swapId: string, canceller: string, reason: string) => {
            this.logger.info('SwapCancelled event', {
                swapId: swapId,
                canceller,
                reason
            });
        });
    }
}

export default EthereumIntegrationService;