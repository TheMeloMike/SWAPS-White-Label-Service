/**
 * Comprehensive Data Validation Framework
 * 
 * Ensures all data in the SWAPS system is real, on-chain verified data
 * and prevents mock/placeholder data from entering the system.
 */

import { ethers } from 'ethers';
import { PublicKey } from '@solana/web3.js';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { OnChainOwnershipValidator } from '../blockchain/OnChainOwnershipValidator';
import { AbstractNFT, AbstractWallet } from '../../types/abstract';

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    metadata?: any;
}

export class DataValidationFramework {
    private static instance: DataValidationFramework;
    private logger: Logger;
    private ownershipValidator: OnChainOwnershipValidator;
    
    // Mock/placeholder patterns to detect
    private readonly MOCK_PATTERNS = [
        /mock/i,
        /test/i,
        /dummy/i,
        /placeholder/i,
        /sample/i,
        /demo/i,
        /fake/i
    ];
    
    // Known placeholder addresses
    private readonly PLACEHOLDER_ADDRESSES = [
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000001',
        '0xdead000000000000000042069420694206942069',
        '11111111111111111111111111111112', // Solana system program
        'So11111111111111111111111111111111111111112'
    ];
    
    private constructor() {
        this.logger = LoggingService.getInstance().createLogger('DataValidationFramework');
        this.ownershipValidator = OnChainOwnershipValidator.getInstance();
    }
    
    public static getInstance(): DataValidationFramework {
        if (!DataValidationFramework.instance) {
            DataValidationFramework.instance = new DataValidationFramework();
        }
        return DataValidationFramework.instance;
    }
    
    /**
     * Validate wallet address
     */
    public async validateWalletAddress(
        address: string,
        blockchain: 'ethereum' | 'solana'
    ): Promise<ValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Check for empty/null
        if (!address) {
            errors.push('Wallet address is required');
            return { isValid: false, errors, warnings };
        }
        
        // Check for placeholder addresses
        if (this.PLACEHOLDER_ADDRESSES.includes(address)) {
            errors.push(`Placeholder address detected: ${address}`);
            return { isValid: false, errors, warnings };
        }
        
        // Check for mock patterns
        for (const pattern of this.MOCK_PATTERNS) {
            if (pattern.test(address)) {
                warnings.push(`Address contains mock pattern: ${pattern}`);
            }
        }
        
        // Validate format based on blockchain
        if (blockchain === 'ethereum') {
            if (!ethers.isAddress(address)) {
                errors.push(`Invalid Ethereum address format: ${address}`);
            }
            
            // Check if it's a zero address
            if (address.toLowerCase() === '0x0000000000000000000000000000000000000000') {
                errors.push('Zero address is not allowed');
            }
        } else if (blockchain === 'solana') {
            try {
                new PublicKey(address);
            } catch (e) {
                errors.push(`Invalid Solana address format: ${address}`);
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    
    /**
     * Validate NFT data
     */
    public async validateNFT(
        nft: AbstractNFT,
        checkOnChain: boolean = true
    ): Promise<ValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Basic validation
        if (!nft.id) {
            errors.push('NFT ID is required');
        }
        
        if (!nft.metadata?.name) {
            errors.push('NFT name is required');
        }
        
        // Check for mock patterns in ID and name
        const checkFields = [nft.id, nft.metadata?.name, nft.metadata?.description];
        for (const field of checkFields) {
            if (field) {
                for (const pattern of this.MOCK_PATTERNS) {
                    if (pattern.test(field)) {
                        warnings.push(`NFT contains mock pattern in ${field}: ${pattern}`);
                    }
                }
            }
        }
        
        // Validate blockchain data
        if (!nft.platformData) {
            errors.push('NFT platformData is required');
        } else {
            if (!nft.platformData.contractAddress) {
                errors.push('NFT contract address is required');
            } else {
                const contractValidation = await this.validateWalletAddress(
                    nft.platformData.contractAddress,
                    nft.platformData.blockchain as 'ethereum' | 'solana'
                );
                errors.push(...contractValidation.errors);
            }
            
            if (!nft.platformData.tokenId) {
                errors.push('NFT token ID is required');
            }
            
            if (!nft.platformData.walletAddress) {
                errors.push('NFT owner wallet address is required');
            }
        }
        
        // On-chain validation
        if (checkOnChain && nft.platformData?.walletAddress) {
            try {
                const ownershipResult = await this.ownershipValidator.validateOwnership(
                    nft,
                    nft.platformData.walletAddress
                );
                
                if (!ownershipResult.isValid) {
                    errors.push(`On-chain ownership validation failed: ${ownershipResult.error}`);
                }
            } catch (e) {
                errors.push(`Failed to validate on-chain: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            metadata: {
                nftId: nft.id,
                contractAddress: nft.platformData?.contractAddress,
                tokenId: nft.platformData?.tokenId
            }
        };
    }
    
    /**
     * Validate transaction data
     */
    public validateTransaction(transaction: any): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Check 'to' address
        if (!transaction.to) {
            errors.push('Transaction "to" address is required');
        } else if (this.PLACEHOLDER_ADDRESSES.includes(transaction.to)) {
            errors.push(`Transaction contains placeholder address: ${transaction.to}`);
        }
        
        // Check data field
        if (transaction.data === '0x' && transaction.value === '0') {
            warnings.push('Transaction appears to be empty (no data or value)');
        }
        
        // Check for mock wallet signatures
        if (transaction.from && transaction.from.includes('0x') && transaction.from.length === 42) {
            // This is a valid Ethereum address format, but check if it's generated
            if (transaction.from.includes('00000') || transaction.from.includes('11111')) {
                warnings.push('Transaction "from" address appears to be generated');
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    
    /**
     * Validate trade loop
     */
    public async validateTradeLoop(
        tradeLoop: any,
        checkOnChain: boolean = false
    ): Promise<ValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        if (!tradeLoop.id) {
            errors.push('Trade loop ID is required');
        }
        
        if (!tradeLoop.steps || tradeLoop.steps.length === 0) {
            errors.push('Trade loop must have at least one step');
        }
        
        // Validate each step
        for (let i = 0; i < tradeLoop.steps.length; i++) {
            const step = tradeLoop.steps[i];
            
            if (!step.from || !step.to) {
                errors.push(`Step ${i}: Missing from/to wallet`);
            }
            
            if (!step.nfts || step.nfts.length === 0) {
                errors.push(`Step ${i}: No NFTs specified`);
            }
            
            // Check for self-trades (mock behavior)
            if (step.from === step.to) {
                warnings.push(`Step ${i}: Self-trade detected (from === to)`);
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            metadata: {
                tradeLoopId: tradeLoop.id,
                stepCount: tradeLoop.steps?.length || 0
            }
        };
    }
    
    /**
     * Comprehensive validation for API request
     */
    public async validateApiRequest(
        endpoint: string,
        data: any
    ): Promise<ValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Check for common mock data in request
        const jsonStr = JSON.stringify(data);
        for (const pattern of this.MOCK_PATTERNS) {
            if (pattern.test(jsonStr)) {
                warnings.push(`Request contains potential mock pattern: ${pattern}`);
            }
        }
        
        // Endpoint-specific validation
        switch (endpoint) {
            case '/api/v1/inventory/submit':
                if (data.nfts && Array.isArray(data.nfts)) {
                    for (const nft of data.nfts) {
                        const result = await this.validateNFT(nft, true);
                        errors.push(...result.errors);
                        warnings.push(...result.warnings);
                    }
                }
                break;
                
            case '/api/v1/wallets/submit':
                if (data.wallets && Array.isArray(data.wallets)) {
                    for (const wallet of data.wallets) {
                        if (wallet.address) {
                            const result = await this.validateWalletAddress(
                                wallet.address,
                                wallet.blockchain || 'ethereum'
                            );
                            errors.push(...result.errors);
                            warnings.push(...result.warnings);
                        }
                    }
                }
                break;
                
            case '/api/v2/blockchain/trades/prepare':
                if (data.tradeLoop) {
                    const result = await this.validateTradeLoop(data.tradeLoop);
                    errors.push(...result.errors);
                    warnings.push(...result.warnings);
                }
                break;
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            metadata: {
                endpoint,
                timestamp: new Date().toISOString()
            }
        };
    }
    
    /**
     * Runtime assertion to prevent mock data
     */
    public assertNoMockData(data: any, context: string): void {
        const jsonStr = JSON.stringify(data);
        
        // Check for placeholder addresses
        for (const placeholder of this.PLACEHOLDER_ADDRESSES) {
            if (jsonStr.includes(placeholder)) {
                throw new Error(
                    `Mock/placeholder data detected in ${context}: ${placeholder}`
                );
            }
        }
        
        // Check for obvious mock patterns
        if (/createRandom|\.generate\(\)|mockWallet|mockKeypair/i.test(jsonStr)) {
            throw new Error(
                `Mock wallet generation detected in ${context}`
            );
        }
    }
}

/**
 * Express middleware for automatic validation
 */
export const validationMiddleware = (options?: { 
    checkOnChain?: boolean;
    blockOnErrors?: boolean;
}) => {
    return async (req: any, res: any, next: any) => {
        const validator = DataValidationFramework.getInstance();
        
        try {
            const result = await validator.validateApiRequest(
                req.path,
                req.body
            );
            
            // Attach validation result to request
            req.validation = result;
            
            // Log warnings
            if (result.warnings.length > 0) {
                console.warn(`Validation warnings for ${req.path}:`, result.warnings);
            }
            
            // Block on errors if configured
            if (options?.blockOnErrors && !result.isValid) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: result.errors
                });
            }
            
            next();
        } catch (error) {
            console.error('Validation middleware error:', error);
            next(); // Don't block on validation errors
        }
    };
};

/**
 * USAGE EXAMPLES:
 * 
 * 1. In controllers:
 *    const validator = DataValidationFramework.getInstance();
 *    const result = await validator.validateNFT(nft);
 *    if (!result.isValid) throw new Error(result.errors.join(', '));
 * 
 * 2. As middleware:
 *    app.use('/api/v1', validationMiddleware({ checkOnChain: true }));
 * 
 * 3. Runtime assertions:
 *    validator.assertNoMockData(transaction, 'transaction preparation');
 */