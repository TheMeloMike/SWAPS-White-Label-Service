import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { PersistentTradeDiscoveryService } from '../trade/PersistentTradeDiscoveryService';
import { AbstractNFT, TenantTradeGraph } from '../../types/abstract';

/**
 * Wallet Address Mapping Service
 * 
 * Provides dynamic and scalable wallet ID to blockchain address mapping.
 * This service extracts wallet addresses from various sources in the system
 * to enable proper blockchain transaction preparation.
 */
export class WalletAddressMappingService {
    private static instance: WalletAddressMappingService;
    private logger: Logger;
    private tradeService: PersistentTradeDiscoveryService;
    
    // Cache for wallet ID to address mappings per tenant
    private addressCache = new Map<string, Map<string, string>>(); // tenantId -> (walletId -> address)

    private constructor() {
        this.logger = LoggingService.getInstance().createLogger('WalletAddressMappingService');
        this.tradeService = PersistentTradeDiscoveryService.getInstance();
    }

    public static getInstance(): WalletAddressMappingService {
        if (!WalletAddressMappingService.instance) {
            WalletAddressMappingService.instance = new WalletAddressMappingService();
        }
        return WalletAddressMappingService.instance;
    }

    /**
     * Get blockchain address for a wallet ID within a specific tenant context
     */
    public async getWalletAddress(tenantId: string, walletId: string, blockchainType: 'ethereum' | 'solana' = 'ethereum'): Promise<string | null> {
        const operation = this.logger.operation('getWalletAddress');
        
        try {
            // Check cache first
            const tenantCache = this.addressCache.get(tenantId);
            if (tenantCache?.has(walletId)) {
                const cachedAddress = tenantCache.get(walletId)!;
                operation.info('Retrieved wallet address from cache', { walletId, address: cachedAddress });
                return cachedAddress;
            }

            // If not in cache, extract from tenant graph
            const address = await this.extractWalletAddressFromTenantData(tenantId, walletId, blockchainType);
            
            if (address) {
                // Update cache
                this.updateCache(tenantId, walletId, address);
                operation.info('Extracted wallet address from tenant data', { walletId, address });
                return address;
            }

            operation.warn('Wallet address not found', { tenantId, walletId, blockchainType });
            return null;

        } catch (error) {
            operation.error('Failed to get wallet address', { error: (error as Error).message, walletId, tenantId });
            throw error;
        } finally {
            operation.end();
        }
    }

    /**
     * Get multiple wallet addresses for efficient batch processing
     */
    public async getWalletAddresses(tenantId: string, walletIds: string[], blockchainType: 'ethereum' | 'solana' = 'ethereum'): Promise<Map<string, string>> {
        const operation = this.logger.operation('getWalletAddresses');
        
        try {
            const addresses = new Map<string, string>();
            const uncachedWalletIds: string[] = [];

            // Check cache for all wallet IDs
            const tenantCache = this.addressCache.get(tenantId);
            for (const walletId of walletIds) {
                if (tenantCache?.has(walletId)) {
                    addresses.set(walletId, tenantCache.get(walletId)!);
                } else {
                    uncachedWalletIds.push(walletId);
                }
            }

            // Extract addresses for uncached wallet IDs
            if (uncachedWalletIds.length > 0) {
                const extractedAddresses = await this.batchExtractWalletAddresses(tenantId, uncachedWalletIds, blockchainType);
                
                // Update cache and result map
                for (const [walletId, address] of extractedAddresses) {
                    this.updateCache(tenantId, walletId, address);
                    addresses.set(walletId, address);
                }
            }

            operation.info('Retrieved wallet addresses', { 
                requested: walletIds.length, 
                found: addresses.size, 
                cached: walletIds.length - uncachedWalletIds.length,
                extracted: uncachedWalletIds.length 
            });

            return addresses;

        } catch (error) {
            operation.error('Failed to get wallet addresses', { error: (error as Error).message, walletIds, tenantId });
            throw error;
        } finally {
            operation.end();
        }
    }

    /**
     * Extract wallet address from tenant graph data
     */
    private async extractWalletAddressFromTenantData(tenantId: string, walletId: string, blockchainType: 'ethereum' | 'solana'): Promise<string | null> {
        try {
            // Get tenant graph data
            const tenantGraph = this.tradeService.getTenantGraph(tenantId);
            if (!tenantGraph) {
                return null;
            }

            // Strategy 1: Look for wallet address in NFT platformData
            for (const [nftId, nft] of tenantGraph.nfts) {
                if (nft.ownership.ownerId === walletId && nft.platformData?.walletAddress) {
                    const address = nft.platformData.walletAddress;
                    if (this.isValidAddress(address, blockchainType)) {
                        return address;
                    }
                }
            }

            // Strategy 2: Look for wallet address in AbstractWallet metadata (if extended)
            const wallet = tenantGraph.wallets.get(walletId);
            if (wallet?.metadata?.platformUserId && this.isValidAddress(wallet.metadata.platformUserId, blockchainType)) {
                return wallet.metadata.platformUserId;
            }

            // Strategy 3: Check if walletId itself is a valid address (direct mapping case)
            if (this.isValidAddress(walletId, blockchainType)) {
                return walletId;
            }

            return null;

        } catch (error) {
            this.logger.error('Failed to extract wallet address from tenant data', { 
                error: (error as Error).message, 
                tenantId, 
                walletId 
            });
            return null;
        }
    }

    /**
     * Batch extract wallet addresses for efficiency
     */
    private async batchExtractWalletAddresses(tenantId: string, walletIds: string[], blockchainType: 'ethereum' | 'solana'): Promise<Map<string, string>> {
        const addresses = new Map<string, string>();
        
        try {
            // Get tenant graph once for all wallets
            const tenantGraph = this.tradeService.getTenantGraph(tenantId);
            if (!tenantGraph) {
                return addresses;
            }

            // Create a mapping of walletId to potential addresses from NFT platformData
            const potentialAddresses = new Map<string, Set<string>>();
            
            for (const [nftId, nft] of tenantGraph.nfts) {
                if (walletIds.includes(nft.ownership.ownerId) && nft.platformData?.walletAddress) {
                    const walletId = nft.ownership.ownerId;
                    const address = nft.platformData.walletAddress;
                    
                    if (!potentialAddresses.has(walletId)) {
                        potentialAddresses.set(walletId, new Set());
                    }
                    potentialAddresses.get(walletId)!.add(address);
                }
            }

            // Validate and select addresses
            for (const walletId of walletIds) {
                const candidateAddresses = potentialAddresses.get(walletId);
                
                if (candidateAddresses) {
                    // Use the first valid address found
                    for (const address of candidateAddresses) {
                        if (this.isValidAddress(address, blockchainType)) {
                            addresses.set(walletId, address);
                            break;
                        }
                    }
                }

                // Fallback strategies if not found in NFT data
                if (!addresses.has(walletId)) {
                    const wallet = tenantGraph.wallets.get(walletId);
                    if (wallet?.metadata?.platformUserId && this.isValidAddress(wallet.metadata.platformUserId, blockchainType)) {
                        addresses.set(walletId, wallet.metadata.platformUserId);
                    } else if (this.isValidAddress(walletId, blockchainType)) {
                        addresses.set(walletId, walletId);
                    }
                }
            }

            return addresses;

        } catch (error) {
            this.logger.error('Failed to batch extract wallet addresses', { 
                error: (error as Error).message, 
                tenantId, 
                walletIds 
            });
            return addresses;
        }
    }

    /**
     * Validate if an address is valid for the specified blockchain
     */
    private isValidAddress(address: string, blockchainType: 'ethereum' | 'solana'): boolean {
        if (!address || typeof address !== 'string') {
            return false;
        }

        if (blockchainType === 'ethereum') {
            // Ethereum address validation: 0x + 40 hex characters
            return /^0x[a-fA-F0-9]{40}$/.test(address);
        } else if (blockchainType === 'solana') {
            // Solana address validation: Base58, typically 32-44 characters
            return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
        }

        return false;
    }

    /**
     * Update the address cache
     */
    private updateCache(tenantId: string, walletId: string, address: string): void {
        if (!this.addressCache.has(tenantId)) {
            this.addressCache.set(tenantId, new Map());
        }
        this.addressCache.get(tenantId)!.set(walletId, address);
    }

    /**
     * Clear cache for a specific tenant (useful for testing or data updates)
     */
    public clearTenantCache(tenantId: string): void {
        this.addressCache.delete(tenantId);
        this.logger.info('Cleared wallet address cache for tenant', { tenantId });
    }

    /**
     * Clear all cache (useful for testing)
     */
    public clearAllCache(): void {
        this.addressCache.clear();
        this.logger.info('Cleared all wallet address cache');
    }

    /**
     * Get cache statistics for monitoring
     */
    public getCacheStats(): { tenants: number; totalMappings: number } {
        let totalMappings = 0;
        for (const tenantCache of this.addressCache.values()) {
            totalMappings += tenantCache.size;
        }
        
        return {
            tenants: this.addressCache.size,
            totalMappings
        };
    }

    /**
     * Explicitly register a wallet ID to address mapping (for manual setup scenarios)
     */
    public registerWalletAddress(tenantId: string, walletId: string, address: string, blockchainType: 'ethereum' | 'solana' = 'ethereum'): boolean {
        const operation = this.logger.operation('registerWalletAddress');
        
        try {
            if (!this.isValidAddress(address, blockchainType)) {
                operation.error('Invalid address provided', { walletId, address, blockchainType });
                return false;
            }

            this.updateCache(tenantId, walletId, address);
            operation.info('Registered wallet address mapping', { tenantId, walletId, address, blockchainType });
            return true;

        } catch (error) {
            operation.error('Failed to register wallet address', { error: (error as Error).message, walletId, address });
            return false;
        } finally {
            operation.end();
        }
    }
}