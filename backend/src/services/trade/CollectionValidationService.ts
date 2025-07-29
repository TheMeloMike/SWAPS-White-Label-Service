import { WalletState, CollectionMetadata } from '../../types/trade';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { LocalCollectionService } from '../nft/LocalCollectionService';
import { NFTPricingService } from '../nft/NFTPricingService';

/**
 * Validates collection data integrity and handles edge cases
 * Ensures collection wants are valid and executable in real trades
 */
export class CollectionValidationService {
  private static instance: CollectionValidationService;
  private logger: Logger;
  private localCollectionService: LocalCollectionService;
  private nftPricingService: NFTPricingService;
  
  // Validation cache to avoid repeated checks
  private validationCache = new Map<string, {
    valid: boolean;
    reason?: string;
    timestamp: number;
  }>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  
  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('CollectionValidation');
    this.localCollectionService = LocalCollectionService.getInstance();
    this.nftPricingService = NFTPricingService.getInstance();
  }
  
  public static getInstance(): CollectionValidationService {
    if (!CollectionValidationService.instance) {
      CollectionValidationService.instance = new CollectionValidationService();
    }
    return CollectionValidationService.instance;
  }
  
  /**
   * Validate a collection want before adding it
   */
  public async validateCollectionWant(
    walletAddress: string,
    collectionId: string,
    walletState: WalletState
  ): Promise<{
    valid: boolean;
    reason?: string;
    warnings?: string[];
  }> {
    const warnings: string[] = [];
    
    // Check cache first
    const cached = this.validationCache.get(`${walletAddress}:${collectionId}`);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return { valid: cached.valid, reason: cached.reason };
    }
    
    try {
      // 1. Validate collection exists and is active
      const collectionMetadata = this.localCollectionService.getCollectionMetadata(collectionId);
      if (!collectionMetadata) {
        // Try searching for it
        const searchResults = await this.localCollectionService.searchCollections(collectionId, 1);
        if (searchResults.length === 0) {
          return this.cacheAndReturn(walletAddress, collectionId, false, 'Collection not found');
        }
        warnings.push('Collection found via search but not in primary index');
      }
      
      // 2. Check if wallet already owns NFTs from this collection
      if (walletState.ownedCollections?.has(collectionId)) {
        const ownedCount = walletState.ownedCollections.get(collectionId)?.length || 0;
        if (ownedCount > 0) {
          warnings.push(`Wallet already owns ${ownedCount} NFTs from this collection`);
        }
      }
      
      // 3. Validate collection has tradeable NFTs
      const sampleNFTs = await this.localCollectionService.getNFTsInCollection(collectionId);
      if (sampleNFTs.length === 0) {
        return this.cacheAndReturn(
          walletAddress, 
          collectionId, 
          false, 
          'Collection has no discoverable NFTs'
        );
      }
      
      // 4. Check collection liquidity and activity
      if (collectionMetadata) {
        if (collectionMetadata.floorPrice === 0) {
          warnings.push('Collection has no floor price - may have low liquidity');
        }
        
        if (collectionMetadata.volume24h === 0) {
          warnings.push('Collection has no recent trading volume');
        }
        
        if (!collectionMetadata.verified) {
          warnings.push('Collection is not verified - trade with caution');
        }
      }
      
      // 5. Check for suspicious patterns
      const suspiciousPatterns = this.checkSuspiciousPatterns(walletState, collectionId);
      if (suspiciousPatterns.length > 0) {
        warnings.push(...suspiciousPatterns);
      }
      
      // 6. Validate collection size is reasonable
      if (collectionMetadata && collectionMetadata.totalSupply > 100000) {
        warnings.push('Very large collection - expansion may be limited by sampling');
      }
      
      return this.cacheAndReturn(walletAddress, collectionId, true, undefined, warnings);
      
    } catch (error) {
      this.logger.error('Error validating collection want', {
        wallet: walletAddress,
        collection: collectionId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return this.cacheAndReturn(
        walletAddress,
        collectionId,
        false,
        'Validation error: ' + (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }
  
  /**
   * Validate collection resolution in a trade loop
   */
  public async validateCollectionResolution(
    collectionId: string,
    resolvedNFT: string,
    ownerWallet: string
  ): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    try {
      // 1. Verify the resolved NFT actually belongs to the collection
      const collectionNFTs = await this.localCollectionService.getNFTsInCollection(collectionId);
      if (!collectionNFTs.includes(resolvedNFT)) {
        return {
          valid: false,
          reason: 'Resolved NFT does not belong to the specified collection'
        };
      }
      
      // 2. Verify ownership
      const nftMetadata = await this.nftPricingService.getNFTMetadata(resolvedNFT);
      if (nftMetadata.owner !== ownerWallet) {
        return {
          valid: false,
          reason: 'NFT ownership mismatch'
        };
      }
      
      // 3. Check if NFT is tradeable (not staked, frozen, etc.)
      // This would require additional blockchain checks in production
      
      return { valid: true };
      
    } catch (error) {
      this.logger.error('Error validating collection resolution', {
        collection: collectionId,
        nft: resolvedNFT,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        valid: false,
        reason: 'Validation error: ' + (error instanceof Error ? error.message : 'Unknown error')
      };
    }
  }
  
  /**
   * Check for suspicious patterns
   */
  private checkSuspiciousPatterns(
    walletState: WalletState,
    collectionId: string
  ): string[] {
    const warnings: string[] = [];
    
    // Check if wallet is wanting too many collections
    if (walletState.wantedCollections && walletState.wantedCollections.size > 10) {
      warnings.push('Wallet wants many collections - may indicate bot activity');
    }
    
    // Check if wallet has no owned NFTs but many wants
    if (walletState.ownedNfts.size === 0 && walletState.wantedNfts.size > 5) {
      warnings.push('Wallet has no NFTs but many wants - cannot participate in trades');
    }
    
    // Check for wash trading patterns (wanting collections they already own heavily)
    if (walletState.ownedCollections?.has(collectionId)) {
      const ownedCount = walletState.ownedCollections.get(collectionId)?.length || 0;
      if (ownedCount > 10) {
        warnings.push('Wallet already owns many NFTs from this collection');
      }
    }
    
    return warnings;
  }
  
  /**
   * Validate collection expansion results
   */
  public validateExpansionResults(
    collectionId: string,
    expandedNFTs: string[],
    originalRequest: {
      walletAddress: string;
      availableOnly: boolean;
    }
  ): {
    valid: boolean;
    issues: string[];
    stats: Record<string, number>;
  } {
    const issues: string[] = [];
    const stats: Record<string, number> = {
      totalExpanded: expandedNFTs.length,
      duplicates: 0,
      invalid: 0
    };
    
    // Check for duplicates
    const uniqueNFTs = new Set(expandedNFTs);
    if (uniqueNFTs.size < expandedNFTs.length) {
      stats.duplicates = expandedNFTs.length - uniqueNFTs.size;
      issues.push(`Found ${stats.duplicates} duplicate NFTs in expansion`);
    }
    
    // Validate NFT addresses
    const invalidNFTs = expandedNFTs.filter(nft => !this.isValidNFTAddress(nft));
    if (invalidNFTs.length > 0) {
      stats.invalid = invalidNFTs.length;
      issues.push(`Found ${stats.invalid} invalid NFT addresses`);
    }
    
    // Check if expansion returned reasonable results
    if (expandedNFTs.length === 0) {
      issues.push('Expansion returned no NFTs');
    } else if (expandedNFTs.length > 10000) {
      issues.push('Expansion returned suspiciously large number of NFTs');
    }
    
    return {
      valid: issues.length === 0,
      issues,
      stats
    };
  }
  
  /**
   * Validate NFT address format
   */
  private isValidNFTAddress(address: string): boolean {
    // Basic Solana address validation
    if (!address || typeof address !== 'string') return false;
    
    // Check length (base58 encoded Solana addresses are typically 32-44 chars)
    if (address.length < 32 || address.length > 44) return false;
    
    // Check for valid base58 characters
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    return base58Regex.test(address);
  }
  
  /**
   * Cache validation result
   */
  private cacheAndReturn(
    walletAddress: string,
    collectionId: string,
    valid: boolean,
    reason?: string,
    warnings?: string[]
  ): {
    valid: boolean;
    reason?: string;
    warnings?: string[];
  } {
    this.validationCache.set(`${walletAddress}:${collectionId}`, {
      valid,
      reason,
      timestamp: Date.now()
    });
    
    return { valid, reason, warnings };
  }
  
  /**
   * Clear validation cache
   */
  public clearCache(): void {
    this.validationCache.clear();
    this.logger.info('Validation cache cleared');
  }
  
  /**
   * Get validation statistics
   */
  public getValidationStats(): {
    cacheSize: number;
    recentValidations: number;
    failureRate: number;
  } {
    const recentCutoff = Date.now() - 60 * 60 * 1000; // 1 hour
    let recentCount = 0;
    let failureCount = 0;
    
    for (const [_, result] of this.validationCache) {
      if (result.timestamp > recentCutoff) {
        recentCount++;
        if (!result.valid) failureCount++;
      }
    }
    
    return {
      cacheSize: this.validationCache.size,
      recentValidations: recentCount,
      failureRate: recentCount > 0 ? failureCount / recentCount : 0
    };
  }
} 