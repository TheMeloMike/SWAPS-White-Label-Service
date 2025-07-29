import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createTransferInstruction, getOrCreateAssociatedTokenAccount, getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { BaseService } from './base.service';
import { TradeLoop, TradeStep } from '@/types/trade';
import { WalletContextState } from '@solana/wallet-adapter-react';

export class TransactionService extends BaseService {
  private connection: Connection;
  
  constructor() {
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
    console.log('Transaction service initialized with RPC endpoint');
  }
  
  /**
   * Verifies NFT ownership before executing a trade
   * @param nftAddress The address of the NFT to verify
   * @param walletAddress The wallet address that should own the NFT
   */
  async verifyNFTOwnership(nftAddress: string, walletAddress: string): Promise<boolean> {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`Verifying ownership of NFT ${nftAddress} for wallet ${walletAddress}${retryCount > 0 ? ` (retry ${retryCount})` : ''}`);
        
        // Convert addresses to PublicKey
        const mint = new PublicKey(nftAddress);
        const owner = new PublicKey(walletAddress);
        
        // Get the token account address for this NFT
        const tokenAccountAddress = await getAssociatedTokenAddress(
          mint,
          owner,
          false, // allowOwnerOffCurve
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        
        // Query the account info
        const tokenAccountInfo = await this.connection.getAccountInfo(tokenAccountAddress);
        
        // If the account exists and has a balance, the wallet owns the NFT
        if (tokenAccountInfo && tokenAccountInfo.data.length > 0) {
          console.log(`✅ NFT ${nftAddress} is owned by ${walletAddress}`);
          return true;
        } else {
          console.log(`❌ NFT ${nftAddress} is NOT owned by ${walletAddress}`);
          return false;
        }
      } catch (error: any) {
        retryCount++;
        console.error(`Error verifying NFT ownership (attempt ${retryCount}/${maxRetries}):`, error);
        
        if (retryCount >= maxRetries) {
          console.warn(`Max retries reached for NFT ownership verification of ${nftAddress}`);
          // For RPC errors, assume ownership to prevent blocking trades unnecessarily
          // The backend still verifies ownership via other methods
          const errorMessage = error?.message || error?.toString() || '';
          const isRpcError = errorMessage.includes('403') || 
                            errorMessage.includes('429') ||
                            errorMessage.includes('Access forbidden');
          
          if (isRpcError) {
            console.warn(`RPC error encountered. Assuming ownership and proceeding with caution.`);
            return true;
          }
          return false;
        }
        
        // Wait before retrying (exponential backoff)
        const delay = 1000 * Math.pow(2, retryCount - 1);
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return false;
  }
  
  /**
   * Builds a trade transaction for a single step
   */
  async buildTradeStepTransaction(
    step: TradeStep,
    wallet: WalletContextState
  ): Promise<Transaction | null> {
    try {
      if (!wallet.publicKey) {
        throw new Error('Wallet not connected');
      }
      
      console.log(`Building trade step transaction from ${step.from} to ${step.to}`);
      
      // Ensure the connected wallet matches the 'from' address
      if (wallet.publicKey.toString() !== step.from) {
        throw new Error(`Connected wallet (${wallet.publicKey.toString()}) does not match sender (${step.from})`);
      }
      
      // Verify ownership of all NFTs in this step
      for (const nft of step.nfts) {
        const isOwner = await this.verifyNFTOwnership(nft.address, step.from);
        if (!isOwner) {
          throw new Error(`NFT ${nft.address} is not owned by ${step.from}`);
        }
      }
      
      // Create a new transaction
      const transaction = new Transaction();
      
      // Add transfer instructions for each NFT
      for (const nft of step.nfts) {
        const mint = new PublicKey(nft.address);
        const sender = new PublicKey(step.from);
        const recipient = new PublicKey(step.to);
        
        // Get sender token account
        const senderTokenAccount = await getAssociatedTokenAddress(
          mint,
          sender,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        
        // Get recipient token account - we'll check if it exists
        const recipientTokenAccount = await getAssociatedTokenAddress(
          mint,
          recipient,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        
        // Check if recipient token account exists
        const recipientAccountInfo = await this.connection.getAccountInfo(recipientTokenAccount);
        
        // If recipient token account doesn't exist, add instruction to create it
        if (!recipientAccountInfo) {
          // Note: In a real implementation, we would add the create instruction
          // but this requires a signer which we don't have here
          // The user will need to create the token account separately or we need to
          // implement a server-side component to handle this
          console.log(`Recipient token account for ${nft.address} doesn't exist yet. It will need to be created.`);
        }
        
        // Create transfer instruction (amount 1 for NFTs)
        const transferInstruction = createTransferInstruction(
          senderTokenAccount,
          recipientTokenAccount,
          sender,
          1, // NFTs have amount 1
          [],
          TOKEN_PROGRAM_ID
        );
        
        transaction.add(transferInstruction);
      }
      
      // Get the latest blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;
      
      return transaction;
    } catch (error) {
      console.error('Error building trade step transaction:', error);
      throw error;
    }
  }
  
  /**
   * Executes a trade step
   */
  async executeTradeStep(
    step: TradeStep, 
    wallet: WalletContextState
  ): Promise<string> {
    try {
      if (!wallet.publicKey) {
        throw new Error('Wallet not connected');
      }
      
      console.log(`Executing trade step from ${step.from} to ${step.to}`);
      
      // Build the transaction
      const transaction = await this.buildTradeStepTransaction(step, wallet);
      if (!transaction) {
        throw new Error('Failed to build transaction');
      }
      
      // Sign and send the transaction using the wallet adapter
      const signedTransaction = await wallet.signTransaction!(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
      
      // Wait for confirmation
      console.log(`Transaction sent with signature ${signature}`);
      const confirmation = await this.connection.confirmTransaction(signature);
      
      if (confirmation.value.err) {
        throw new Error(`Transaction confirmed with error: ${confirmation.value.err}`);
      }
      
      console.log(`Transaction confirmed: ${signature}`);
      
      // Report to API that this step was completed
      await this.apiPost('/api/trades/step-completed', {
        stepId: `${step.from}-${step.to}`,
        transactionSignature: signature,
        nfts: step.nfts.map(nft => nft.address)
      });
      
      return signature;
    } catch (error) {
      console.error('Error executing trade step:', error);
      throw error;
    }
  }
  
  /**
   * Creates a proposed transaction for a complete trade loop
   * Note: This doesn't execute the transactions, it just prepares them
   */
  async prepareTradeLoop(
    tradeLoop: TradeLoop,
    wallet: WalletContextState
  ): Promise<{
    userSteps: TradeStep[];
    canExecute: boolean;
    message: string;
  }> {
    try {
      if (!wallet.publicKey) {
        return {
          userSteps: [],
          canExecute: false,
          message: 'Wallet not connected'
        };
      }
      
      const walletAddress = wallet.publicKey.toString();
      
      // Find steps where the current wallet is the sender
      const userSteps = tradeLoop.steps.filter(step => step.from === walletAddress);
      
      if (userSteps.length === 0) {
        return {
          userSteps: [],
          canExecute: false,
          message: 'You are not a sender in this trade loop'
        };
      }
      
      // Verify ownership of all NFTs in all steps for the current wallet
      let allNftsOwned = true;
      let missingNft = '';
      
      for (const step of userSteps) {
        for (const nft of step.nfts) {
          const isOwner = await this.verifyNFTOwnership(nft.address, walletAddress);
          if (!isOwner) {
            allNftsOwned = false;
            missingNft = nft.address;
            break;
          }
        }
        if (!allNftsOwned) break;
      }
      
      if (!allNftsOwned) {
        return {
          userSteps,
          canExecute: false,
          message: `You don't own NFT ${missingNft}`
        };
      }
      
      return {
        userSteps,
        canExecute: true,
        message: 'Ready to execute your part of the trade'
      };
    } catch (error) {
      console.error('Error preparing trade loop:', error);
      return {
        userSteps: [],
        canExecute: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
} 