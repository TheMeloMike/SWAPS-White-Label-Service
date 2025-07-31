import { injectable } from 'tsyringe';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { WalletState, RejectionPreferences } from '../../types/trade';

/**
 * Service responsible for maintaining data consistency across all trade-related data structures.
 * This addresses the core issue of mismatched data between different representations.
 */
@injectable()
export class DataSyncService {
  private logger: Logger;

  constructor() {
    this.logger = LoggingService.getInstance().createLogger('DataSyncService');
  }

  /**
   * Synchronizes wallet states with the wanted NFTs index.
   * Ensures bidirectional consistency between wallet.wantedNfts and the wantedNfts map.
   */
  public syncWantedNfts(
    wallets: Map<string, WalletState>,
    wantedNfts: Map<string, Set<string>>
  ): Map<string, Set<string>> {
    const operation = this.logger.operation('syncWantedNfts');
    
    // Clear and rebuild the wantedNfts map from wallet states
    const rebuiltWantedNfts = new Map<string, Set<string>>();
    
    // First pass: Build the wantedNfts map from wallet states
    for (const [walletAddress, walletState] of wallets) {
      for (const nftAddress of walletState.wantedNfts) {
        if (!rebuiltWantedNfts.has(nftAddress)) {
          rebuiltWantedNfts.set(nftAddress, new Set<string>());
        }
        rebuiltWantedNfts.get(nftAddress)!.add(walletAddress);
      }
    }
    
    // Second pass: Verify consistency with existing wantedNfts map
    let inconsistencies = 0;
    for (const [nftAddress, wanters] of wantedNfts) {
      const rebuiltWanters = rebuiltWantedNfts.get(nftAddress);
      
      if (!rebuiltWanters) {
        operation.warn(`NFT ${nftAddress} in wantedNfts map but no wallets want it`, {
          nft: nftAddress,
          previousWanters: Array.from(wanters)
        });
        inconsistencies++;
      } else {
        // Check if the sets are equal
        const rebuiltArray = Array.from(rebuiltWanters).sort();
        const existingArray = Array.from(wanters).sort();
        
        if (JSON.stringify(rebuiltArray) !== JSON.stringify(existingArray)) {
          operation.warn(`Inconsistent wanters for NFT ${nftAddress}`, {
            nft: nftAddress,
            fromWalletStates: rebuiltArray,
            fromWantedNftsMap: existingArray
          });
          inconsistencies++;
        }
      }
    }
    
    // Check for NFTs in wallets but not in wantedNfts map
    for (const [nftAddress, wanters] of rebuiltWantedNfts) {
      if (!wantedNfts.has(nftAddress)) {
        operation.warn(`NFT ${nftAddress} wanted by wallets but not in wantedNfts map`, {
          nft: nftAddress,
          wanters: Array.from(wanters)
        });
        inconsistencies++;
      }
    }
    
    operation.info(`Synchronization complete`, {
      walletsProcessed: wallets.size,
      nftsWithWanters: rebuiltWantedNfts.size,
      inconsistenciesFound: inconsistencies
    });
    
    operation.end();
    
    // Return the rebuilt map as the source of truth
    return rebuiltWantedNfts;
  }

  /**
   * Validates and synchronizes NFT ownership data.
   * Ensures consistency between wallet.ownedNfts and the nftOwnership map.
   */
  public syncNftOwnership(
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>
  ): Map<string, string> {
    const operation = this.logger.operation('syncNftOwnership');
    
    // Rebuild ownership map from wallet states
    const rebuiltOwnership = new Map<string, string>();
    
    for (const [walletAddress, walletState] of wallets) {
      for (const nftAddress of walletState.ownedNfts) {
        if (rebuiltOwnership.has(nftAddress)) {
          operation.error(`NFT ${nftAddress} owned by multiple wallets!`, {
            nft: nftAddress,
            firstOwner: rebuiltOwnership.get(nftAddress),
            secondOwner: walletAddress
          });
        } else {
          rebuiltOwnership.set(nftAddress, walletAddress);
        }
      }
    }
    
    // Verify consistency with existing ownership map
    let inconsistencies = 0;
    for (const [nftAddress, owner] of nftOwnership) {
      const rebuiltOwner = rebuiltOwnership.get(nftAddress);
      
      if (!rebuiltOwner) {
        operation.warn(`NFT ${nftAddress} in ownership map but not in any wallet`, {
          nft: nftAddress,
          previousOwner: owner
        });
        inconsistencies++;
      } else if (rebuiltOwner !== owner) {
        operation.warn(`Ownership mismatch for NFT ${nftAddress}`, {
          nft: nftAddress,
          fromWalletState: rebuiltOwner,
          fromOwnershipMap: owner
        });
        inconsistencies++;
      }
    }
    
    operation.info(`Ownership sync complete`, {
      walletsProcessed: wallets.size,
      nftsWithOwners: rebuiltOwnership.size,
      inconsistenciesFound: inconsistencies
    });
    
    operation.end();
    
    return rebuiltOwnership;
  }

  /**
   * Performs a full data validation and reports any issues.
   * This is useful for debugging and ensuring data integrity.
   */
  public validateDataIntegrity(
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>
  ): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const operation = this.logger.operation('validateDataIntegrity');
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check 1: Every owned NFT should have an owner in the ownership map
    for (const [walletAddress, walletState] of wallets) {
      for (const nftAddress of walletState.ownedNfts) {
        const owner = nftOwnership.get(nftAddress);
        if (!owner) {
          issues.push(`NFT ${nftAddress} owned by wallet ${walletAddress} but not in ownership map`);
        } else if (owner !== walletAddress) {
          issues.push(`NFT ${nftAddress} ownership mismatch: wallet states ${walletAddress}, map states ${owner}`);
        }
      }
    }
    
    // Check 2: Every wanted NFT should be reflected in the wantedNfts map
    for (const [walletAddress, walletState] of wallets) {
      for (const nftAddress of walletState.wantedNfts) {
        const wanters = wantedNfts.get(nftAddress);
        if (!wanters) {
          issues.push(`NFT ${nftAddress} wanted by wallet ${walletAddress} but not in wantedNfts map`);
          recommendations.push(`Add NFT ${nftAddress} to wantedNfts map with wallet ${walletAddress}`);
        } else if (!wanters.has(walletAddress)) {
          issues.push(`Wallet ${walletAddress} wants NFT ${nftAddress} but is not in the wanters set`);
          recommendations.push(`Add wallet ${walletAddress} to wanters set for NFT ${nftAddress}`);
        }
      }
    }
    
    // Check 3: Every entry in ownership map should have a corresponding wallet
    for (const [nftAddress, ownerAddress] of nftOwnership) {
      const wallet = wallets.get(ownerAddress);
      if (!wallet) {
        issues.push(`NFT ${nftAddress} owned by non-existent wallet ${ownerAddress}`);
        recommendations.push(`Remove NFT ${nftAddress} from ownership map or add wallet ${ownerAddress}`);
      } else if (!wallet.ownedNfts.has(nftAddress)) {
        issues.push(`NFT ${nftAddress} in ownership map but not in wallet ${ownerAddress}'s owned list`);
        recommendations.push(`Add NFT ${nftAddress} to wallet ${ownerAddress}'s owned NFTs`);
      }
    }
    
    // Check 4: Every entry in wantedNfts map should have valid wallets
    for (const [nftAddress, wanters] of wantedNfts) {
      for (const wanterAddress of wanters) {
        const wallet = wallets.get(wanterAddress);
        if (!wallet) {
          issues.push(`NFT ${nftAddress} wanted by non-existent wallet ${wanterAddress}`);
          recommendations.push(`Remove wallet ${wanterAddress} from wanters of NFT ${nftAddress}`);
        } else if (!wallet.wantedNfts.has(nftAddress)) {
          issues.push(`Wallet ${wanterAddress} in wanters set for NFT ${nftAddress} but doesn't want it`);
          recommendations.push(`Sync wallet ${wanterAddress}'s wanted NFTs with wantedNfts map`);
        }
      }
    }
    
    const isValid = issues.length === 0;
    
    operation.info(`Data integrity validation complete`, {
      isValid,
      issuesFound: issues.length,
      recommendationsCount: recommendations.length
    });
    
    if (!isValid) {
      operation.warn(`Data integrity issues found`, {
        sampleIssues: issues.slice(0, 5),
        totalIssues: issues.length
      });
    }
    
    operation.end();
    
    return {
      isValid,
      issues,
      recommendations
    };
  }

  /**
   * Creates a graph visualization data structure for debugging
   */
  public generateTradeGraphVisualization(
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>
  ): {
    nodes: Array<{ id: string; type: 'wallet' | 'nft'; label: string }>;
    edges: Array<{ from: string; to: string; type: 'owns' | 'wants'; label: string }>;
  } {
    const nodes: Array<{ id: string; type: 'wallet' | 'nft'; label: string }> = [];
    const edges: Array<{ from: string; to: string; type: 'owns' | 'wants'; label: string }> = [];
    
    // Add wallet nodes
    for (const [walletAddress] of wallets) {
      nodes.push({
        id: walletAddress,
        type: 'wallet',
        label: `Wallet ${walletAddress.substring(0, 8)}...`
      });
    }
    
    // Add NFT nodes and ownership edges
    for (const [nftAddress, ownerAddress] of nftOwnership) {
      nodes.push({
        id: nftAddress,
        type: 'nft',
        label: `NFT ${nftAddress.substring(0, 8)}...`
      });
      
      edges.push({
        from: ownerAddress,
        to: nftAddress,
        type: 'owns',
        label: 'owns'
      });
    }
    
    // Add wants edges
    for (const [nftAddress, wanters] of wantedNfts) {
      for (const wanterAddress of wanters) {
        edges.push({
          from: wanterAddress,
          to: nftAddress,
          type: 'wants',
          label: 'wants'
        });
      }
    }
    
    return { nodes, edges };
  }
} 