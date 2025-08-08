import { ethers } from 'ethers';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { AbstractNFT } from '../../types/AbstractNFT';

/**
 * On-Chain Ownership Validator Service
 * 
 * Provides real-time validation of NFT ownership against blockchain state.
 * This ensures trade discovery only uses verified ownership data.
 */

export interface OwnershipValidationResult {
    isValid: boolean;
    actualOwner?: string;
    error?: string;
    verifiedAt: Date;
}

export interface BatchOwnershipResult {
    [nftId: string]: OwnershipValidationResult;
}

export class OnChainOwnershipValidator {
    private static instance: OnChainOwnershipValidator;
    private logger: Logger;
    private provider: ethers.Provider;
    private validationCache: Map<string, { result: OwnershipValidationResult; expiresAt: number }>;
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    private constructor() {
        this.logger = LoggingService.getInstance().createLogger('OnChainOwnershipValidator');
        
        // Initialize provider
        const rpcUrl = process.env.ETHEREUM_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        
        this.validationCache = new Map();
    }

    public static getInstance(): OnChainOwnershipValidator {
        if (!OnChainOwnershipValidator.instance) {
            OnChainOwnershipValidator.instance = new OnChainOwnershipValidator();
        }
        return OnChainOwnershipValidator.instance;
    }

    /**
     * Validate that a wallet actually owns an NFT on-chain
     */
    public async validateOwnership(
        nft: AbstractNFT,
        expectedOwner: string
    ): Promise<OwnershipValidationResult> {
        const operation = this.logger.operation('validateOwnership');
        
        try {
            const cacheKey = `${nft.platformData?.contractAddress}-${nft.platformData?.tokenId}`;
            
            // Check cache first
            const cached = this.validationCache.get(cacheKey);
            if (cached && cached.expiresAt > Date.now()) {
                operation.info('Using cached ownership validation', { nftId: nft.id });
                return cached.result;
            }

            // Extract contract info
            const contractAddress = nft.platformData?.contractAddress;
            const tokenId = nft.platformData?.tokenId;

            if (!contractAddress || !tokenId) {
                const result: OwnershipValidationResult = {
                    isValid: false,
                    error: 'Missing contract address or token ID',
                    verifiedAt: new Date()
                };
                operation.warn('Invalid NFT data for ownership validation', { nftId: nft.id });
                return result;
            }

            // Validate addresses
            if (!ethers.isAddress(contractAddress) || !ethers.isAddress(expectedOwner)) {
                const result: OwnershipValidationResult = {
                    isValid: false,
                    error: 'Invalid contract or owner address format',
                    verifiedAt: new Date()
                };
                operation.warn('Invalid address format', { contractAddress, expectedOwner });
                return result;
            }

            // Query on-chain ownership
            const nftContract = new ethers.Contract(
                contractAddress,
                ['function ownerOf(uint256 tokenId) external view returns (address)'],
                this.provider
            );

            operation.info('Querying on-chain ownership', {
                contract: contractAddress,
                tokenId,
                expectedOwner,
                nftId: nft.id
            });

            const actualOwner = await nftContract.ownerOf(tokenId);
            const isValid = actualOwner.toLowerCase() === expectedOwner.toLowerCase();

            const result: OwnershipValidationResult = {
                isValid,
                actualOwner,
                verifiedAt: new Date()
            };

            if (!isValid) {
                result.error = `Expected owner ${expectedOwner} but actual owner is ${actualOwner}`;
                operation.warn('Ownership validation failed', {
                    nftId: nft.id,
                    expected: expectedOwner,
                    actual: actualOwner
                });
            } else {
                operation.info('Ownership validation successful', { nftId: nft.id });
            }

            // Cache the result
            this.validationCache.set(cacheKey, {
                result,
                expiresAt: Date.now() + this.CACHE_TTL
            });

            operation.end();
            return result;

        } catch (error) {
            operation.error('Ownership validation error', {
                error: error instanceof Error ? error.message : String(error),
                nftId: nft.id
            });

            const result: OwnershipValidationResult = {
                isValid: false,
                error: error instanceof Error ? error.message : 'Unknown validation error',
                verifiedAt: new Date()
            };

            operation.end();
            return result;
        }
    }

    /**
     * Batch validate ownership for multiple NFTs
     */
    public async batchValidateOwnership(
        nftOwnershipPairs: Array<{ nft: AbstractNFT; expectedOwner: string }>
    ): Promise<BatchOwnershipResult> {
        const operation = this.logger.operation('batchValidateOwnership');
        
        try {
            operation.info('Starting batch ownership validation', {
                count: nftOwnershipPairs.length
            });

            const results: BatchOwnershipResult = {};
            
            // Process validations in parallel for better performance
            const validationPromises = nftOwnershipPairs.map(async ({ nft, expectedOwner }) => {
                const result = await this.validateOwnership(nft, expectedOwner);
                results[nft.id] = result;
            });

            await Promise.all(validationPromises);

            const validCount = Object.values(results).filter(r => r.isValid).length;
            operation.info('Batch validation completed', {
                total: nftOwnershipPairs.length,
                valid: validCount,
                invalid: nftOwnershipPairs.length - validCount
            });

            operation.end();
            return results;

        } catch (error) {
            operation.error('Batch validation failed', {
                error: error instanceof Error ? error.message : String(error)
            });
            operation.end();
            throw error;
        }
    }

    /**
     * Validate an entire trade loop's ownership requirements
     */
    public async validateTradeLoopOwnership(
        tradeLoop: any,
        nftMap: Map<string, AbstractNFT>
    ): Promise<{ isValid: boolean; errors: string[]; validationResults: BatchOwnershipResult }> {
        const operation = this.logger.operation('validateTradeLoopOwnership');
        
        try {
            const validationPairs: Array<{ nft: AbstractNFT; expectedOwner: string }> = [];
            const errors: string[] = [];

            // Extract all NFT-owner pairs from trade loop steps
            for (const step of tradeLoop.steps) {
                for (const nftRef of step.nfts) {
                    const nft = nftMap.get(nftRef.address);
                    if (!nft) {
                        errors.push(`NFT not found in map: ${nftRef.address}`);
                        continue;
                    }

                    validationPairs.push({
                        nft,
                        expectedOwner: step.from
                    });
                }
            }

            if (errors.length > 0) {
                operation.warn('Trade loop validation has missing NFT data', { errors });
            }

            // Batch validate all ownership requirements
            const validationResults = await this.batchValidateOwnership(validationPairs);

            // Check if all validations passed
            const allValid = Object.values(validationResults).every(result => result.isValid);
            
            // Collect all validation errors
            for (const [nftId, result] of Object.entries(validationResults)) {
                if (!result.isValid && result.error) {
                    errors.push(`${nftId}: ${result.error}`);
                }
            }

            operation.info('Trade loop ownership validation completed', {
                tradeLoopId: tradeLoop.id,
                validationsPerformed: validationPairs.length,
                allValid,
                errorCount: errors.length
            });

            operation.end();
            return {
                isValid: allValid && errors.length === 0,
                errors,
                validationResults
            };

        } catch (error) {
            operation.error('Trade loop validation failed', {
                error: error instanceof Error ? error.message : String(error),
                tradeLoopId: tradeLoop.id
            });
            operation.end();
            throw error;
        }
    }

    /**
     * Clear validation cache (useful for testing or forced refresh)
     */
    public clearCache(): void {
        this.validationCache.clear();
        this.logger.info('Ownership validation cache cleared');
    }

    /**
     * Get cache statistics
     */
    public getCacheStats(): { size: number; hitRate?: number } {
        return {
            size: this.validationCache.size
        };
    }
}