import { 
    Connection, 
    PublicKey, 
    Transaction, 
    TransactionInstruction, 
    Keypair, 
    sendAndConfirmTransaction,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    SYSVAR_CLOCK_PUBKEY
} from '@solana/web3.js';
import { 
    TOKEN_PROGRAM_ID, 
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    getAccount,
    TokenAccountNotFoundError,
    createTransferInstruction
} from '@solana/spl-token';
import { TradeLoop } from '../../types/trade';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { EventEmitter } from 'events';

/**
 * SWAPS Solana Integration Service
 * 
 * Connects the SWAPS backend API to the deployed Solana smart contract
 * Handles trade execution, status tracking, and blockchain interactions
 */

export interface SolanaTradeStep {
    stepIndex: number;
    from: string;
    to: string;
    nftMints: string[];
    approved?: boolean;
    executed?: boolean;
    transactionSignature?: string;
}

export interface BlockchainTradeLoop {
    tradeId: string;
    accountAddress: string;
    participants: number;
    steps: SolanaTradeStep[];
    status: 'created' | 'populating' | 'approving' | 'executing' | 'completed' | 'cancelled' | 'expired';
    createdAt: Date;
    expiresAt: Date;
    blockchainTxHash?: string;
    explorerUrl?: string;
}

export interface SolanaConfig {
    rpcUrl: string;
    programId: string;
    network: 'devnet' | 'testnet' | 'mainnet-beta';
    payerKeypair?: Keypair; // For automated execution (optional)
}

export class SolanaIntegrationService extends EventEmitter {
    private static instance: SolanaIntegrationService;
    private connection: Connection;
    private programId: PublicKey;
    private logger: Logger;
    private activeTradeLoops: Map<string, BlockchainTradeLoop> = new Map();
    private network: string;
    private payerKeypair?: Keypair;

    private constructor(config: SolanaConfig) {
        super();
        this.connection = new Connection(config.rpcUrl, 'confirmed');
        this.programId = new PublicKey(config.programId);
        this.network = config.network;
        this.payerKeypair = config.payerKeypair;
        this.logger = LoggingService.getInstance().createLogger('SolanaIntegration');
        
        this.logger.info('Solana Integration Service initialized', {
            network: config.network,
            programId: config.programId,
            rpcUrl: config.rpcUrl
        });
    }

    public static getInstance(config?: SolanaConfig): SolanaIntegrationService {
        if (!SolanaIntegrationService.instance && config) {
            SolanaIntegrationService.instance = new SolanaIntegrationService(config);
        }
        return SolanaIntegrationService.instance;
    }

    /**
     * Convert a discovered TradeLoop to a blockchain-executable format
     * SECURITY: Now uses PDA-based trade loop accounts with creator isolation for replay protection
     */
    public async createBlockchainTradeLoop(
        tradeLoop: TradeLoop, 
        creatorKeypair?: Keypair
    ): Promise<BlockchainTradeLoop> {
        const operation = this.logger.operation('createBlockchainTradeLoop');
        
        try {
            // Generate unique trade ID
            const tradeId = Array.from(crypto.getRandomValues(new Uint8Array(32)));
            const payer = creatorKeypair || this.payerKeypair;
            
            if (!payer) {
                throw new Error('No payer keypair available for trade creation');
            }

            // SECURITY ENHANCEMENT: Calculate PDA-based trade loop account with creator isolation
            // This prevents replay attacks by including the creator's pubkey in the PDA generation
            const [tradeLoopPda, bump] = this.calculateTradeLoopPDA(tradeId, payer.publicKey);
            
            operation.info('Generated secure trade loop PDA', {
                tradeId: Buffer.from(tradeId).toString('hex'),
                creator: payer.publicKey.toString(),
                tradeLoopPda: tradeLoopPda.toString(),
                bump: bump
            });

            // Prepare instruction data
            const instructionData = this.createInitializeTradeLoopData(
                tradeId,
                tradeLoop.totalParticipants,
                24 * 60 * 60 // 24 hours timeout
            );

            // Create transaction with PDA-based account
            const instruction = new TransactionInstruction({
                keys: [
                    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                    { pubkey: tradeLoopPda, isSigner: false, isWritable: true }, // PDA doesn't require signature
                    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                programId: this.programId,
                data: instructionData
            });

            const transaction = new Transaction().add(instruction);
            const signature = await sendAndConfirmTransaction(
                this.connection, 
                transaction, 
                [payer] // Only payer needs to sign, PDA is created automatically
            );

            // Create blockchain trade loop object
            const blockchainTradeLoop: BlockchainTradeLoop = {
                tradeId: Buffer.from(tradeId).toString('hex'),
                accountAddress: tradeLoopPda.toString(),
                participants: tradeLoop.totalParticipants,
                steps: tradeLoop.steps.map((step, index) => ({
                    stepIndex: index,
                    from: step.from,
                    to: step.to,
                    nftMints: step.nfts.map(nft => nft.address),
                    approved: false,
                    executed: false
                })),
                status: 'created',
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                blockchainTxHash: signature,
                explorerUrl: this.getExplorerUrl(signature)
            };

            // Store in memory for tracking
            this.activeTradeLoops.set(blockchainTradeLoop.tradeId, blockchainTradeLoop);

            operation.info('Blockchain trade loop created', {
                tradeId: blockchainTradeLoop.tradeId,
                accountAddress: blockchainTradeLoop.accountAddress,
                participants: blockchainTradeLoop.participants,
                signature,
                explorerUrl: blockchainTradeLoop.explorerUrl
            });

            // Emit event for real-time updates
            this.emit('tradeLoopCreated', blockchainTradeLoop);

            operation.end();
            return blockchainTradeLoop;

        } catch (error) {
            operation.error('Failed to create blockchain trade loop', {
                tradeLoopId: tradeLoop.id,
                participants: tradeLoop.totalParticipants,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Add a trade step to an existing blockchain trade loop
     */
    public async addTradeStep(
        tradeId: string,
        stepIndex: number,
        fromWallet: string,
        toWallet: string,
        nftMints: string[],
        signerKeypair: Keypair
    ): Promise<string> {
        const operation = this.logger.operation('addTradeStep');
        
        try {
            const tradeLoop = this.activeTradeLoops.get(tradeId);
            if (!tradeLoop) {
                throw new Error(`Trade loop not found: ${tradeId}`);
            }

            const fromWalletPubkey = new PublicKey(fromWallet);
            const toWalletPubkey = new PublicKey(toWallet);
            const nftMintPubkeys = nftMints.map(mint => new PublicKey(mint));

            // Verify the signer owns the from wallet
            if (!signerKeypair.publicKey.equals(fromWalletPubkey)) {
                throw new Error('Signer must own the from wallet');
            }

            // Create instruction data for adding trade step
            const instructionData = this.createAddTradeStepData(stepIndex, toWalletPubkey, nftMintPubkeys);

            // Build the accounts array according to smart contract expectations
            const accounts = [
                { pubkey: signerKeypair.publicKey, isSigner: true, isWritable: false }, // from_signer
                { pubkey: new PublicKey(tradeLoop.accountAddress), isSigner: false, isWritable: true }, // trade_loop_state
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
            ];

            // For each NFT, add: mint + from_token_account + to_token_account
            for (const nftMint of nftMintPubkeys) {
                const fromTokenAccount = await getAssociatedTokenAddress(nftMint, fromWalletPubkey);
                const toTokenAccount = await getAssociatedTokenAddress(nftMint, toWalletPubkey);

                // Verify the from wallet owns this NFT
                await this.verifyNFTOwnership(nftMint, fromWalletPubkey);

                accounts.push(
                    { pubkey: nftMint, isSigner: false, isWritable: false }, // nft_mint
                    { pubkey: fromTokenAccount, isSigner: false, isWritable: true }, // from_token_account
                    { pubkey: toTokenAccount, isSigner: false, isWritable: true } // to_token_account (will be created if needed)
                );
            }

            // Create instruction
            const instruction = new TransactionInstruction({
                keys: accounts,
                programId: this.programId,
                data: instructionData
            });

            // Build transaction with any needed account creation instructions
            const transaction = new Transaction();
            
            // Add token account creation instructions if needed
            for (const nftMint of nftMintPubkeys) {
                const toTokenAccount = await getAssociatedTokenAddress(nftMint, toWalletPubkey);
                const accountExists = await this.checkTokenAccountExists(toTokenAccount);
                
                if (!accountExists) {
                    const createAccountInstruction = createAssociatedTokenAccountInstruction(
                        signerKeypair.publicKey, // payer
                        toTokenAccount,
                        toWalletPubkey, // owner
                        nftMint
                    );
                    transaction.add(createAccountInstruction);
                }
            }

            transaction.add(instruction);

            const signature = await sendAndConfirmTransaction(this.connection, transaction, [signerKeypair]);

            // Update local state
            if (tradeLoop.steps[stepIndex]) {
                tradeLoop.steps[stepIndex].transactionSignature = signature;
            }
            tradeLoop.status = 'populating';

            operation.info('Trade step added', {
                tradeId,
                stepIndex,
                signature,
                explorerUrl: this.getExplorerUrl(signature)
            });

            this.emit('tradeStepAdded', { tradeId, stepIndex, signature });
            
            operation.end();
            return signature;

        } catch (error) {
            operation.error('Failed to add trade step', {
                tradeId,
                stepIndex,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Approve a trade step
     */
    public async approveTradeStep(
        tradeId: string,
        stepIndex: number,
        approverKeypair: Keypair
    ): Promise<string> {
        const operation = this.logger.operation('approveTradeStep');
        
        try {
            const tradeLoop = this.activeTradeLoops.get(tradeId);
            if (!tradeLoop) {
                throw new Error(`Trade loop not found: ${tradeId}`);
            }

            const instructionData = this.createApproveTradeStepData(stepIndex);

            const instruction = new TransactionInstruction({
                keys: [
                    { pubkey: approverKeypair.publicKey, isSigner: true, isWritable: false },
                    { pubkey: new PublicKey(tradeLoop.accountAddress), isSigner: false, isWritable: true },
                    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
                ],
                programId: this.programId,
                data: instructionData
            });

            const transaction = new Transaction().add(instruction);
            const signature = await sendAndConfirmTransaction(this.connection, transaction, [approverKeypair]);

            // Update local state
            if (tradeLoop.steps[stepIndex]) {
                tradeLoop.steps[stepIndex].approved = true;
                tradeLoop.steps[stepIndex].transactionSignature = signature;
            }

            // Check if all steps are approved
            const allApproved = tradeLoop.steps.every(step => step.approved);
            if (allApproved) {
                tradeLoop.status = 'approving';
            }

            operation.info('Trade step approved', {
                tradeId,
                stepIndex,
                allApproved,
                signature,
                explorerUrl: this.getExplorerUrl(signature)
            });

            this.emit('tradeStepApproved', { tradeId, stepIndex, allApproved, signature });
            
            operation.end();
            return signature;

        } catch (error) {
            operation.error('Failed to approve trade step', {
                tradeId,
                stepIndex,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Execute a single trade step (transfers NFTs)
     */
    public async executeTradeStep(
        tradeId: string,
        stepIndex: number,
        executorKeypair?: Keypair
    ): Promise<string> {
        const operation = this.logger.operation('executeTradeStep');
        
        try {
            const tradeLoop = this.activeTradeLoops.get(tradeId);
            if (!tradeLoop) {
                throw new Error(`Trade loop not found: ${tradeId}`);
            }

            const step = tradeLoop.steps[stepIndex];
            if (!step) {
                throw new Error(`Step ${stepIndex} not found in trade loop`);
            }

            if (!step.approved) {
                throw new Error(`Step ${stepIndex} is not approved yet`);
            }

            if (step.executed) {
                throw new Error(`Step ${stepIndex} is already executed`);
            }

            const executor = executorKeypair || this.payerKeypair;
            if (!executor) {
                throw new Error('No executor keypair available');
            }

            const fromWalletPubkey = new PublicKey(step.from);
            const toWalletPubkey = new PublicKey(step.to);

            // Create instruction data
            const instructionData = Buffer.from([3, stepIndex]); // ExecuteTradeStep + step_index

            // Build accounts for execution
            const accounts = [
                { pubkey: executor.publicKey, isSigner: true, isWritable: false }, // executor
                { pubkey: new PublicKey(tradeLoop.accountAddress), isSigner: false, isWritable: true }, // trade_loop_state
                { pubkey: fromWalletPubkey, isSigner: false, isWritable: false }, // sender_wallet
                { pubkey: toWalletPubkey, isSigner: false, isWritable: false }, // recipient_wallet
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
                { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
            ];

            // Add NFT accounts for each token being transferred
            for (const nftMint of step.nftMints) {
                const nftMintPubkey = new PublicKey(nftMint);
                const fromTokenAccount = await getAssociatedTokenAddress(nftMintPubkey, fromWalletPubkey);
                const toTokenAccount = await getAssociatedTokenAddress(nftMintPubkey, toWalletPubkey);

                accounts.push(
                    { pubkey: nftMintPubkey, isSigner: false, isWritable: false }, // nft_mint
                    { pubkey: fromTokenAccount, isSigner: false, isWritable: true }, // from_token_account
                    { pubkey: toTokenAccount, isSigner: false, isWritable: true } // to_token_account
                );
            }

            const instruction = new TransactionInstruction({
                keys: accounts,
                programId: this.programId,
                data: instructionData
            });

            const transaction = new Transaction().add(instruction);
            const signature = await sendAndConfirmTransaction(this.connection, transaction, [executor]);

            // Update local state
            step.executed = true;
            step.transactionSignature = signature;

            // Check if all steps are executed
            const allExecuted = tradeLoop.steps.every(s => s.executed);
            if (allExecuted) {
                tradeLoop.status = 'completed';
            }

            operation.info('Trade step executed', {
                tradeId,
                stepIndex,
                signature,
                explorerUrl: this.getExplorerUrl(signature)
            });

            this.emit('tradeStepExecuted', { tradeId, stepIndex, signature });
            
            operation.end();
            return signature;

        } catch (error) {
            operation.error('Failed to execute trade step', {
                tradeId,
                stepIndex,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Execute the complete trade loop (atomic swap)
     */
    public async executeTradeLoop(tradeId: string, executorKeypair?: Keypair): Promise<string> {
        const operation = this.logger.operation('executeTradeLoop');
        
        try {
            const tradeLoop = this.activeTradeLoops.get(tradeId);
            if (!tradeLoop) {
                throw new Error(`Trade loop not found: ${tradeId}`);
            }

            if (tradeLoop.status !== 'approving') {
                throw new Error(`Trade loop not ready for execution. Status: ${tradeLoop.status}`);
            }

            const payer = executorKeypair || this.payerKeypair;
            if (!payer) {
                throw new Error('No executor keypair available');
            }

            // Create execution instruction
            const instructionData = Buffer.from([4]); // ExecuteFullTradeLoop instruction

            const instruction = new TransactionInstruction({
                keys: [
                    { pubkey: payer.publicKey, isSigner: true, isWritable: false },
                    { pubkey: new PublicKey(tradeLoop.accountAddress), isSigner: false, isWritable: true },
                    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                    // Note: In production, would need all NFT and token account pairs
                ],
                programId: this.programId,
                data: instructionData
            });

            const transaction = new Transaction().add(instruction);
            const signature = await sendAndConfirmTransaction(this.connection, transaction, [payer]);

            // Update local state
            tradeLoop.status = 'completed';
            tradeLoop.steps.forEach(step => {
                step.executed = true;
                if (!step.transactionSignature) {
                    step.transactionSignature = signature;
                }
            });

            operation.info('Trade loop executed successfully', {
                tradeId,
                participants: tradeLoop.participants,
                signature,
                explorerUrl: this.getExplorerUrl(signature)
            });

            this.emit('tradeLoopExecuted', { tradeId, signature });
            
            operation.end();
            return signature;

        } catch (error) {
            operation.error('Failed to execute trade loop', {
                tradeId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Cancel a trade loop
     */
    public async cancelTradeLoop(tradeId: string, cancellerKeypair: Keypair): Promise<string> {
        const operation = this.logger.operation('cancelTradeLoop');
        
        try {
            const tradeLoop = this.activeTradeLoops.get(tradeId);
            if (!tradeLoop) {
                throw new Error(`Trade loop not found: ${tradeId}`);
            }

            const instructionData = Buffer.from([5]); // CancelTradeLoop instruction

            const instruction = new TransactionInstruction({
                keys: [
                    { pubkey: cancellerKeypair.publicKey, isSigner: true, isWritable: false },
                    { pubkey: new PublicKey(tradeLoop.accountAddress), isSigner: false, isWritable: true },
                ],
                programId: this.programId,
                data: instructionData
            });

            const transaction = new Transaction().add(instruction);
            const signature = await sendAndConfirmTransaction(this.connection, transaction, [cancellerKeypair]);

            // Update local state
            tradeLoop.status = 'cancelled';

            operation.info('Trade loop cancelled', {
                tradeId,
                signature,
                explorerUrl: this.getExplorerUrl(signature)
            });

            this.emit('tradeLoopCancelled', { tradeId, signature });
            
            operation.end();
            return signature;

        } catch (error) {
            operation.error('Failed to cancel trade loop', {
                tradeId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Get trade loop status from blockchain and update local state
     */
    public async refreshTradeLoopStatus(tradeId: string): Promise<BlockchainTradeLoop> {
        const operation = this.logger.operation('refreshTradeLoopStatus');
        
        try {
            const tradeLoop = this.activeTradeLoops.get(tradeId);
            if (!tradeLoop) {
                throw new Error(`Trade loop not found: ${tradeId}`);
            }

            // Fetch account data from blockchain
            const accountInfo = await this.connection.getAccountInfo(new PublicKey(tradeLoop.accountAddress));
            
            if (!accountInfo) {
                tradeLoop.status = 'expired';
                operation.info('Trade loop account not found, marking as expired', { tradeId });
                operation.end();
                return tradeLoop;
            }

            // Parse blockchain state and update local state
            try {
                const blockchainState = this.deserializeTradeLoopAccount(accountInfo.data);
                
                // Update status based on blockchain state
                if (blockchainState.isInitialized) {
                    const currentTime = Math.floor(Date.now() / 1000);
                    
                    if (currentTime > blockchainState.expiresAt) {
                        tradeLoop.status = 'expired';
                    } else {
                        // Check step statuses to determine overall status
                        const allStepsApproved = blockchainState.steps.every((step: any) => step.status === 'Approved');
                        const anyStepsExecuted = blockchainState.steps.some((step: any) => step.status === 'Executed');
                        
                        if (anyStepsExecuted) {
                            const allStepsExecuted = blockchainState.steps.every((step: any) => step.status === 'Executed');
                            tradeLoop.status = allStepsExecuted ? 'completed' : 'executing';
                        } else if (allStepsApproved) {
                            tradeLoop.status = 'approving';
                        } else {
                            tradeLoop.status = 'populating';
                        }
                        
                        // Update step statuses
                        blockchainState.steps.forEach((blockchainStep: any, index: number) => {
                            if (tradeLoop.steps[index]) {
                                tradeLoop.steps[index].approved = blockchainStep.status === 'Approved' || blockchainStep.status === 'Executed';
                                tradeLoop.steps[index].executed = blockchainStep.status === 'Executed';
                            }
                        });
                    }
                }
                
                operation.info('Trade loop status refreshed from blockchain', {
                    tradeId,
                    status: tradeLoop.status,
                    expiresAt: new Date(blockchainState.expiresAt * 1000).toISOString()
                });
                
            } catch (parseError) {
                operation.warn('Failed to parse blockchain state, keeping local state', {
                    tradeId,
                    error: parseError instanceof Error ? parseError.message : String(parseError)
                });
            }

            operation.end();
            return tradeLoop;

        } catch (error) {
            operation.error('Failed to refresh trade loop status', {
                tradeId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Deserialize trade loop account data from blockchain
     * Note: This is a simplified implementation. In production, you'd want to use
     * a proper Rust struct deserialization library like borsh-js
     */
    private deserializeTradeLoopAccount(data: Buffer): any {
        // This is a simplified parser for the TradeLoop struct
        // In production, use proper borsh deserialization
        
        if (data.length < 100) {
            throw new Error('Account data too small to be a valid TradeLoop');
        }
        
        let offset = 0;
        
        // Read basic fields (simplified)
        const isInitialized = data.readUInt8(offset) === 1;
        offset += 1;
        
        const tradeId = data.slice(offset, offset + 32);
        offset += 32;
        
        const createdAt = data.readBigUInt64LE(offset);
        offset += 8;
        
        const expiresAt = data.readBigUInt64LE(offset);
        offset += 8;
        
        const stepCount = data.readUInt8(offset);
        offset += 1;
        
        // Read steps (simplified)
        const steps = [];
        for (let i = 0; i < stepCount; i++) {
            // This is a very simplified step parsing
            // In reality, you'd parse the full TradeStep struct
            const stepStatus = data.readUInt8(offset);
            offset += 1;
            
            steps.push({
                status: stepStatus === 0 ? 'Created' : stepStatus === 1 ? 'Approved' : 'Executed'
            });
            
            // Skip remaining step data for now
            offset += 100; // Approximate step size
        }
        
        return {
            isInitialized,
            tradeId: tradeId.toString('hex'),
            createdAt: Number(createdAt),
            expiresAt: Number(expiresAt),
            steps
        };
    }

    /**
     * Initialize program configuration
     */
    public async initializeProgramConfig(
        authorityKeypair: Keypair,
        governance?: PublicKey
    ): Promise<string> {
        const operation = this.logger.operation('initializeProgramConfig');
        
        try {
            // Calculate program config PDA
            const [configPda, bump] = PublicKey.findProgramAddressSync(
                [Buffer.from('config')],
                this.programId
            );

            // Create instruction data
            const instructionData = Buffer.alloc(2);
            instructionData.writeUInt8(7, 0); // InitializeProgramConfig instruction
            
            if (governance) {
                instructionData.writeUInt8(1, 1); // has_governance = true
                // Note: In full implementation, would append governance pubkey
            } else {
                instructionData.writeUInt8(0, 1); // has_governance = false
            }

            const instruction = new TransactionInstruction({
                keys: [
                    { pubkey: authorityKeypair.publicKey, isSigner: true, isWritable: true }, // upgrade_authority (payer)
                    { pubkey: configPda, isSigner: false, isWritable: true }, // program_config_account
                    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // rent_sysvar
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
                ],
                programId: this.programId,
                data: instructionData
            });

            const transaction = new Transaction().add(instruction);
            const signature = await sendAndConfirmTransaction(this.connection, transaction, [authorityKeypair]);

            operation.info('Program config initialized', {
                configPda: configPda.toString(),
                hasGovernance: !!governance,
                signature,
                explorerUrl: this.getExplorerUrl(signature)
            });

            operation.end();
            return signature;

        } catch (error) {
            operation.error('Failed to initialize program config', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Update program configuration
     */
    public async updateProgramConfig(
        authorityKeypair: Keypair,
        options: {
            newUpgradeAuthority?: PublicKey;
            newGovernance?: PublicKey;
            newPausedState?: boolean;
        }
    ): Promise<string> {
        const operation = this.logger.operation('updateProgramConfig');
        
        try {
            // Calculate program config PDA
            const [configPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('config')],
                this.programId
            );

            // Create instruction data
            let dataSize = 4; // Base size
            if (options.newUpgradeAuthority) dataSize += 32;
            if (options.newGovernance) dataSize += 32;
            
            const instructionData = Buffer.alloc(dataSize);
            let offset = 0;
            
            instructionData.writeUInt8(8, offset); // UpdateProgramConfig instruction
            offset += 1;
            
            // New upgrade authority
            instructionData.writeUInt8(options.newUpgradeAuthority ? 1 : 0, offset);
            offset += 1;
            if (options.newUpgradeAuthority) {
                options.newUpgradeAuthority.toBuffer().copy(instructionData, offset);
                offset += 32;
            }
            
            // New governance
            instructionData.writeUInt8(options.newGovernance ? 1 : 0, offset);
            offset += 1;
            if (options.newGovernance) {
                options.newGovernance.toBuffer().copy(instructionData, offset);
                offset += 32;
            }
            
            // New paused state
            instructionData.writeUInt8(options.newPausedState !== undefined ? 1 : 0, offset);
            offset += 1;
            if (options.newPausedState !== undefined) {
                instructionData.writeUInt8(options.newPausedState ? 1 : 0, offset);
            }

            const instruction = new TransactionInstruction({
                keys: [
                    { pubkey: authorityKeypair.publicKey, isSigner: true, isWritable: false }, // current_upgrade_authority
                    { pubkey: configPda, isSigner: false, isWritable: true }, // program_config_account
                ],
                programId: this.programId,
                data: instructionData
            });

            const transaction = new Transaction().add(instruction);
            const signature = await sendAndConfirmTransaction(this.connection, transaction, [authorityKeypair]);

            operation.info('Program config updated', {
                configPda: configPda.toString(),
                newUpgradeAuthority: options.newUpgradeAuthority?.toString(),
                newGovernance: options.newGovernance?.toString(),
                newPausedState: options.newPausedState,
                signature,
                explorerUrl: this.getExplorerUrl(signature)
            });

            operation.end();
            return signature;

        } catch (error) {
            operation.error('Failed to update program config', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Get all active trade loops
     */
    public getActiveTradeLoops(): BlockchainTradeLoop[] {
        return Array.from(this.activeTradeLoops.values());
    }

    /**
     * Get specific trade loop by ID
     */
    public getTradeLoop(tradeId: string): BlockchainTradeLoop | undefined {
        return this.activeTradeLoops.get(tradeId);
    }

    /**
     * Verify that a wallet owns an NFT
     */
    private async verifyNFTOwnership(nftMint: PublicKey, owner: PublicKey): Promise<void> {
        try {
            const tokenAccount = await getAssociatedTokenAddress(nftMint, owner);
            const account = await getAccount(this.connection, tokenAccount);
            
            if (account.amount < 1) {
                throw new Error(`Wallet ${owner.toString()} does not own NFT ${nftMint.toString()}`);
            }
        } catch (error) {
            if (error instanceof TokenAccountNotFoundError) {
                throw new Error(`NFT token account not found for ${nftMint.toString()} owned by ${owner.toString()}`);
            }
            throw error;
        }
    }

    /**
     * Check if a token account exists
     */
    private async checkTokenAccountExists(tokenAccount: PublicKey): Promise<boolean> {
        try {
            await getAccount(this.connection, tokenAccount);
            return true;
        } catch (error) {
            if (error instanceof TokenAccountNotFoundError) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Get explorer URL for transaction or account
     */
    public getExplorerUrl(signature: string): string {
        const baseUrl = this.network === 'mainnet-beta' 
            ? 'https://explorer.solana.com'
            : `https://explorer.solana.com?cluster=${this.network}`;
        return `${baseUrl}/tx/${signature}`;
    }

    /**
     * Get account explorer URL
     */
    public getAccountExplorerUrl(address: string): string {
        const baseUrl = this.network === 'mainnet-beta' 
            ? 'https://explorer.solana.com'
            : `https://explorer.solana.com?cluster=${this.network}`;
        return `${baseUrl}/address/${address}`;
    }

    // =====================================
    // PRIVATE HELPER METHODS
    // =====================================

    private createInitializeTradeLoopData(tradeId: number[], stepCount: number, timeoutSeconds: number): Buffer {
        const data = Buffer.alloc(1 + 32 + 1 + 8);
        let offset = 0;
        
        data.writeUInt8(0, offset); // InitializeTradeLoop instruction
        offset += 1;
        
        Buffer.from(tradeId).copy(data, offset); // trade_id
        offset += 32;
        
        data.writeUInt8(stepCount, offset); // step_count
        offset += 1;
        
        data.writeBigUInt64LE(BigInt(timeoutSeconds), offset); // timeout_seconds
        
        return data;
    }

    private createAddTradeStepData(stepIndex: number, to: PublicKey, nftMints: PublicKey[]): Buffer {
        const data = Buffer.alloc(1 + 1 + 32 + 1 + (nftMints.length * 32));
        let offset = 0;
        
        data.writeUInt8(1, offset); // AddTradeStep instruction
        offset += 1;
        
        data.writeUInt8(stepIndex, offset); // step_index
        offset += 1;
        
        to.toBuffer().copy(data, offset); // to address
        offset += 32;
        
        data.writeUInt8(nftMints.length, offset); // nft count
        offset += 1;
        
        for (const mint of nftMints) {
            mint.toBuffer().copy(data, offset);
            offset += 32;
        }
        
        return data;
    }

    private createApproveTradeStepData(stepIndex: number): Buffer {
        const data = Buffer.alloc(2);
        data.writeUInt8(2, 0); // ApproveTradeStep instruction
        data.writeUInt8(stepIndex, 1); // step_index
        return data;
    }

    /**
     * Calculate Trade Loop PDA with Creator Isolation for Replay Protection
     * SECURITY: Matches the smart contract's enhanced PDA generation including creator pubkey
     */
    private calculateTradeLoopPDA(tradeId: number[], creator: PublicKey): [PublicKey, number] {
        const seeds = [
            Buffer.from("trade_loop", "utf8"),
            Buffer.from(tradeId),
            creator.toBuffer() // SECURITY: Creator isolation prevents replay attacks
        ];
        
        return PublicKey.findProgramAddressSync(seeds, this.programId);
    }

    /**
     * Legacy PDA calculation for backward compatibility (DEPRECATED)
     * WARNING: This version is vulnerable to replay attacks - use only for migration
     */
    private calculateTradeLoopPDALegacy(tradeId: number[]): [PublicKey, number] {
        const seeds = [
            Buffer.from("trade_loop", "utf8"),
            Buffer.from(tradeId)
        ];
        
        return PublicKey.findProgramAddressSync(seeds, this.programId);
    }
}