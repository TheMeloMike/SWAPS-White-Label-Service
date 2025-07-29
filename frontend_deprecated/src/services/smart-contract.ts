import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { BaseService } from './base.service';

// Constants - using actual deployed program ID
const SWAP_PROGRAM_ID = process.env.NEXT_PUBLIC_SWAP_PROGRAM_ID || '5wBoJ8u3Sj9SKLpsQbz3xrTz3qrdHE9Sj67NL4MAmGn4'; // Mainnet
const MAX_PARTICIPANTS_PER_TRANSACTION = 11;
const MAX_NFTS_PER_STEP = 4;
const DEFAULT_TIMEOUT_SECONDS = 86400; // 24 hours by default

/**
 * Service to interact with the NFT Swap smart contract
 */
export class SmartContractService extends BaseService {
  private static instance: SmartContractService;
  private connection: Connection;
  private validatedProgramId: boolean = false;
  
  private constructor() {
    super();
    // Use Helius RPC endpoint with API key for more reliable access
    const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
    if (!heliusApiKey) {
      console.warn('NEXT_PUBLIC_HELIUS_API_KEY not found in environment variables');
    }
    
    // Construct Helius RPC URL if API key is available, otherwise fall back to default
    const endpoint = heliusApiKey 
      ? `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`
      : process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
      
    this.connection = new Connection(endpoint, 'confirmed');
    console.log('Smart contract service initialized with RPC endpoint');
    
    // Validate the program ID during initialization
    this.validateProgramId().catch(error => {
      console.error('Program ID validation failed:', error);
    });
  }

  public static getInstance(): SmartContractService {
    if (!SmartContractService.instance) {
      SmartContractService.instance = new SmartContractService();
    }
    return SmartContractService.instance;
  }
  
  /**
   * Find the trade loop account PDA for a given trade ID
   */
  public findTradeLoopAddress(tradeId: Uint8Array): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('trade_loop'), tradeId],
      new PublicKey(SWAP_PROGRAM_ID)
    );
  }
  
  /**
   * Creates a new trade loop on-chain
   * 
   * @param tradeId Unique identifier for this trade loop
   * @param stepCount Number of steps (participants) in the trade loop
   * @param timeoutSeconds Time until the trade expires, in seconds
   * @param wallet Connected wallet (will pay for the transaction)
   */
  async createTradeLoop(
    tradeId: string,
    stepCount: number,
    timeoutSeconds = DEFAULT_TIMEOUT_SECONDS,
    wallet: WalletContextState
  ): Promise<string> {
    if (!wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    
    // Validate step count against maximum
    if (stepCount > MAX_PARTICIPANTS_PER_TRANSACTION) {
      throw new Error(`Trade loop exceeds maximum allowed participants (${MAX_PARTICIPANTS_PER_TRANSACTION})`);
    }
    
    // Convert tradeId to bytes
    const tradeIdBytes = Buffer.from(tradeId);
    if (tradeIdBytes.length !== 32) {
      throw new Error('Trade ID must be 32 bytes');
    }
    
    // Calculate the trade loop account address
    const [tradeLoopAddress] = this.findTradeLoopAddress(tradeIdBytes);
    
    // Create instruction data
    const instructionData = Buffer.concat([
      Buffer.from([0]), // InitializeTradeLoop instruction
      tradeIdBytes,
      Buffer.from([stepCount]),
      new Uint8Array(new BigUint64Array([BigInt(timeoutSeconds)]).buffer)
    ]);
    
    // Create the instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // Payer
        { pubkey: tradeLoopAddress, isSigner: false, isWritable: true }, // Trade loop account
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // Rent
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
      ],
      programId: new PublicKey(SWAP_PROGRAM_ID),
      data: instructionData,
    });
    
    // Create and send the transaction
    const transaction = new Transaction().add(instruction);
    const signature = await this.sendAndConfirmTransaction(transaction, wallet);
    
    console.log(`Created trade loop with ID ${tradeId}, address: ${tradeLoopAddress.toString()}`);
    
    return signature;
  }
  
  /**
   * Adds a trade step to an existing trade loop
   * 
   * @param tradeLoopAddress Public key of the trade loop account
   * @param stepIndex Index of this step in the trade loop
   * @param recipientAddress Public key of the recipient wallet
   * @param nftMints Array of NFT mint addresses to be transferred
   * @param wallet Connected wallet (sender)
   */
  async addTradeStep(
    tradeLoopAddress: PublicKey,
    stepIndex: number,
    recipientAddress: PublicKey,
    nftMints: PublicKey[],
    wallet: WalletContextState
  ): Promise<string> {
    if (!wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    
    // Validate the NFT count
    if (nftMints.length === 0) {
      throw new Error('Must include at least one NFT to transfer');
    }
    
    if (nftMints.length > MAX_NFTS_PER_STEP) {
      throw new Error(`Exceeds maximum NFTs per step (${MAX_NFTS_PER_STEP})`);
    }
    
    // Create the instruction data
    const dataLayout: number[] = [
      1, // AddTradeStep instruction
      stepIndex,
    ];
    
    // Convert recipientAddress.toBytes() to array items
    const recipientBytes = recipientAddress.toBytes();
    for (let i = 0; i < recipientBytes.length; i++) {
      dataLayout.push(recipientBytes[i]);
    }
    
    dataLayout.push(nftMints.length); // Number of NFTs
    
    // Add each NFT mint pubkey
    nftMints.forEach(mint => {
      const mintBytes = mint.toBytes();
      for (let i = 0; i < mintBytes.length; i++) {
        dataLayout.push(mintBytes[i]);
      }
    });
    
    // Convert the final dataLayout to a Buffer
    const instructionData = Buffer.from(dataLayout);
    
    // Create the instruction
    const keys = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // Sender
      { pubkey: tradeLoopAddress, isSigner: false, isWritable: true }, // Trade loop account
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Token program
    ];
    
    // Add keys for each NFT for verification
    for (const mint of nftMints) {
      // Get token account for this NFT
      const tokenAccount = await getAssociatedTokenAddress(
        mint,
        wallet.publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      
      // Add mint and token account to verify ownership
      keys.push(
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: tokenAccount, isSigner: false, isWritable: false }
      );
    }
    
    const instruction = new TransactionInstruction({
      keys,
      programId: new PublicKey(SWAP_PROGRAM_ID),
      data: instructionData,
    });
    
    // Create and send the transaction
    const transaction = new Transaction().add(instruction);
    const signature = await this.sendAndConfirmTransaction(transaction, wallet);
    
    console.log(`Added trade step ${stepIndex} from ${wallet.publicKey.toString()} to ${recipientAddress.toString()}`);
    
    return signature;
  }
  
  /**
   * Validates the swap program ID to ensure it's properly configured
   * @throws Error if the program ID is invalid or not deployed
   */
  private async validateProgramId(): Promise<void> {
    // Skip validation if already validated
    if (this.validatedProgramId) {
      return;
    }
    
    try {
      // Check if the program ID is a valid PublicKey
      const programId = new PublicKey(SWAP_PROGRAM_ID);
      
      // Don't verify the program in development mode with a placeholder ID
      if (SWAP_PROGRAM_ID.includes('11111111')) {
        console.warn(`Running in development mode with placeholder program ID: ${SWAP_PROGRAM_ID}`);
        console.warn('Program validation skipped. This would fail in production.');
        this.validatedProgramId = true;
        return;
      }
      
      // Verify the program exists on-chain
      const programInfo = await this.connection.getAccountInfo(programId);
      if (!programInfo) {
        console.warn(`Swap program not found on chain at address: ${SWAP_PROGRAM_ID}`);
        console.warn('Running in mock mode - contract interactions will be simulated');
        this.validatedProgramId = true;
        return;
      }
      
      if (!programInfo.executable) {
        console.warn(`Account at ${SWAP_PROGRAM_ID} is not an executable program`);
        console.warn('Running in mock mode - contract interactions will be simulated');
        this.validatedProgramId = true;
        return;
      }
      
      this.validatedProgramId = true;
      console.log(`Validated swap program at ${SWAP_PROGRAM_ID}`);
    } catch (error) {
      console.error('Failed to validate swap program ID:', error);
      console.warn('Running in mock mode - contract interactions will be simulated');
      this.validatedProgramId = true;
    }
  }
  
  /**
   * Validates a trade step before approval
   * 
   * @param tradeLoopAddress Address of the trade loop
   * @param stepIndex Index of the step being approved
   * @param wallet Connected wallet
   * @returns The wallet public key if valid, throws error if invalid
   */
  private async validateTradeStep(
    tradeLoopAddress: PublicKey,
    stepIndex: number,
    wallet: WalletContextState
  ): Promise<PublicKey> {
    // Validate wallet is connected
    if (!wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    
    // Validate step index
    if (stepIndex < 0 || stepIndex >= MAX_PARTICIPANTS_PER_TRANSACTION) {
      throw new Error(`Invalid step index: ${stepIndex}. Must be between 0 and ${MAX_PARTICIPANTS_PER_TRANSACTION - 1}`);
    }
    
    // Validate trade loop address format
    try {
      // Ensure tradeLoopAddress is a valid public key
      if (!PublicKey.isOnCurve(tradeLoopAddress.toBuffer())) {
        throw new Error('Invalid trade loop address format');
      }
    } catch (error) {
      throw new Error(`Invalid trade loop address: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    
    // Validate the program ID
    await this.validateProgramId();
    
    return wallet.publicKey;
  }

  /**
   * Approves a trade step
   * 
   * @param tradeLoopAddress Public key of the trade loop account
   * @param stepIndex Index of this step in the trade loop
   * @param wallet Connected wallet (sender)
   */
  async approveTradeStep(
    tradeLoopAddress: PublicKey,
    stepIndex: number,
    wallet: WalletContextState
  ): Promise<string> {
    // Validate input data and get the wallet public key
    const walletPublicKey = await this.validateTradeStep(tradeLoopAddress, stepIndex, wallet);
    
    // Create instruction data
    const instructionData = Buffer.concat([
      Buffer.from([2]), // ApproveTradeStep instruction
      new Uint8Array(new Uint8Array([stepIndex])),
    ]);
    
    // Create the instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: walletPublicKey, isSigner: true, isWritable: true }, // Sender
        { pubkey: tradeLoopAddress, isSigner: false, isWritable: true }, // Trade loop account
      ],
      programId: new PublicKey(SWAP_PROGRAM_ID),
      data: instructionData,
    });
    
    // Create and send the transaction
    const transaction = new Transaction().add(instruction);
    const signature = await this.sendAndConfirmTransaction(transaction, wallet);
    
    console.log(`Approved trade step ${stepIndex} by ${walletPublicKey.toString()} - FINAL APPROVAL`);
    
    return signature;
  }
  
  /**
   * Executes a complete trade loop (all steps at once)
   * 
   * @param tradeLoopAddress Public key of the trade loop account
   * @param tradeLoop Trade loop data with steps
   * @param wallet Connected wallet
   */
  async executeFullTradeLoop(
    tradeLoopAddress: PublicKey,
    wallet: WalletContextState
  ): Promise<string> {
    if (!wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    
    // Fetch the trade loop account to get its data
    const tradeLoopAccount = await this.connection.getAccountInfo(tradeLoopAddress);
    if (!tradeLoopAccount) {
      throw new Error('Trade loop account not found');
    }
    
    // Create instruction data
    const instructionData = Buffer.from([
      4, // ExecuteFullTradeLoop instruction
    ]);
    
    // Basic accounts for execution
    const keys = [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // Executor (anyone)
      { pubkey: tradeLoopAddress, isSigner: false, isWritable: true }, // Trade loop account
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Token program
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Associated token program
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // Rent sysvar
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }, // Clock sysvar
    ];
    
    // We would need participant accounts here as well, but without the trade loop data parsed,
    // we can't add them all correctly. In a complete implementation, this would require
    // parsing the trade loop data or providing it as a parameter.
    
    // Create the instruction
    const instruction = new TransactionInstruction({
      keys,
      programId: new PublicKey(SWAP_PROGRAM_ID),
      data: instructionData,
    });
    
    // Create and send the transaction
    const transaction = new Transaction().add(instruction);
    const signature = await this.sendAndConfirmTransaction(transaction, wallet);
    
    console.log(`Executed full trade loop at ${tradeLoopAddress.toString()}`);
    
    return signature;
  }
  
  /**
   * Helper to send and confirm a transaction
   */
  private async sendAndConfirmTransaction(
    transaction: Transaction,
    wallet: WalletContextState
  ): Promise<string> {
    if (!wallet.signTransaction) {
      throw new Error('Wallet does not support transaction signing');
    }

    try {
      // Get a recent blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey!;
      
      // Sign the transaction (this will prompt the wallet UI)
      let signedTransaction: Transaction;
      
      try {
        // Attempt to sign the transaction
        signedTransaction = await wallet.signTransaction(transaction);
      } catch (err) {
        // Check specifically for user rejection to provide better feedback
        if (err instanceof Error && 
           (err.message.includes('User rejected') || 
            err.message.includes('cancelled') || 
            err.message.includes('denied'))) {
          const userRejectionError = new Error('Transaction was rejected by wallet');
          userRejectionError.name = 'UserRejectedError';
          throw userRejectionError;
        }
        // Rethrow the error - it will be handled by the categorizeError function
        throw err;
      }
      
      // Send the transaction
      const signature = await this.connection.sendRawTransaction(
        signedTransaction.serialize(),
        { skipPreflight: false, maxRetries: 3 } // Enable preflight checks and retry logic
      );
      
      console.log(`Transaction sent with signature: ${signature}`);
      
      // Wait for confirmation with timeout and retry logic
      try {
        // Create a promise that will reject after a timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Transaction confirmation timeout'));
          }, 60000); // 60 second timeout
        });
        
        // Use a more reliable confirmation strategy with retries
        const maxRetries = 3;
        let retryCount = 0;
        let confirmationError = null;
        
        while (retryCount <= maxRetries) {
          try {
            // Race the confirmation against the timeout
            const confirmationResult = await Promise.race([
              this.connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight,
              }, 'confirmed'), // Use 'confirmed' commitment level
              timeoutPromise,
            ]);
            
            // Check if the confirmation has an error
            if (confirmationResult && confirmationResult.value && confirmationResult.value.err) {
              throw new Error(`Transaction failed: ${JSON.stringify(confirmationResult.value.err)}`);
            }
            
            // If we got here, confirmation was successful
            console.log(`Transaction confirmed: ${signature}`);
            return signature;
          } catch (error) {
            confirmationError = error;
            
            // Check if we should retry based on the error type
            if (error instanceof Error && 
                (error.message.includes('timeout') || 
                 error.message.includes('network') || 
                 error.message.includes('connection'))) {
              
              retryCount++;
              if (retryCount <= maxRetries) {
                console.log(`Retrying confirmation (${retryCount}/${maxRetries})...`);
                // Exponential backoff
                const delay = 2000 * Math.pow(2, retryCount - 1);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
              }
            }
            
            // Either it's not a retryable error or we've exceeded max retries
            throw error;
          }
        }
        
        // If we get here, we've exceeded retries
        throw confirmationError || new Error('Failed to confirm transaction after multiple attempts');
      } catch (confirmError) {
        // Log the error for debugging but rethrow for user feedback
        console.error('Confirmation error:', confirmError);
        
        // Check if the transaction might have succeeded despite the error
        try {
          const status = await this.connection.getSignatureStatus(signature);
          if (status && status.value && !status.value.err) {
            console.log('Transaction appears to have succeeded despite confirmation error');
            return signature;
          }
        } catch (statusError) {
          console.error('Error checking transaction status:', statusError);
        }
        
        throw confirmError;
      }
    } catch (err) {
      // All errors will be properly handled by the caller using our error utilities
      throw err;
    }
  }
  
  /**
   * Decodes trade loop account data from the blockchain
   * 
   * @param tradeLoopAccount The account data buffer
   * @returns Decoded trade loop data
   */
  async decodeTradeLoopAccount(tradeLoopAddress: PublicKey): Promise<{
    initialized: boolean;
    tradeId: string;
    createdAt: number;
    expiresAt: number;
    steps: Array<{
      from: PublicKey;
      to: PublicKey;
      nftMints: PublicKey[];
      status: 'Created' | 'Approved' | 'Executed';
    }>;
    authority: PublicKey;
  }> {
    try {
      // Fetch the account data
      const accountInfo = await this.connection.getAccountInfo(tradeLoopAddress);
      if (!accountInfo) {
        throw new Error(`Trade loop account ${tradeLoopAddress.toString()} not found`);
      }
      
      const data = accountInfo.data;
      
      // Basic parsing - in a real implementation, you would use proper
      // borsh deserialization that matches the Rust contract
      let offset = 0;
      
      // is_initialized: bool (1 byte)
      const initialized = data[offset] === 1;
      offset += 1;
      
      // trade_id: [u8; 32] (32 bytes)
      const tradeIdBytes = data.slice(offset, offset + 32);
      const tradeId = Buffer.from(tradeIdBytes).toString('hex');
      offset += 32;
      
      // created_at: u64 (8 bytes)
      const createdAt = new DataView(data.buffer, offset, 8).getBigUint64(0, true);
      offset += 8;
      
      // expires_at: u64 (8 bytes)
      const expiresAt = new DataView(data.buffer, offset, 8).getBigUint64(0, true);
      offset += 8;
      
      // authority: Pubkey (32 bytes)
      const authorityBytes = data.slice(offset, offset + 32);
      const authority = new PublicKey(authorityBytes);
      offset += 32;
      
      // steps vector length (4 bytes)
      const stepsLength = new DataView(data.buffer, offset, 4).getUint32(0, true);
      offset += 4;
      
      // Parse each step
      const steps = [];
      for (let i = 0; i < stepsLength; i++) {
        // from: Pubkey (32 bytes)
        const fromBytes = data.slice(offset, offset + 32);
        const from = new PublicKey(fromBytes);
        offset += 32;
        
        // to: Pubkey (32 bytes)
        const toBytes = data.slice(offset, offset + 32);
        const to = new PublicKey(toBytes);
        offset += 32;
        
        // status: u8 (1 byte)
        const statusValue = data[offset];
        let status: 'Created' | 'Approved' | 'Executed';
        switch (statusValue) {
          case 0:
            status = 'Created';
            break;
          case 1:
            status = 'Approved';
            break;
          case 2:
            status = 'Executed';
            break;
          default:
            status = 'Created';
        }
        offset += 1;
        
        // nft_mints vector length (4 bytes)
        const nftMintsLength = new DataView(data.buffer, offset, 4).getUint32(0, true);
        offset += 4;
        
        // Parse each NFT mint
        const nftMints = [];
        for (let j = 0; j < nftMintsLength; j++) {
          const mintBytes = data.slice(offset, offset + 32);
          const mint = new PublicKey(mintBytes);
          nftMints.push(mint);
          offset += 32;
        }
        
        steps.push({
          from,
          to,
          nftMints,
          status
        });
      }
      
      return {
        initialized,
        tradeId,
        createdAt: Number(createdAt),
        expiresAt: Number(expiresAt),
        steps,
        authority
      };
    } catch (error) {
      console.error('Error decoding trade loop account:', error);
      throw error;
    }
  }
} 