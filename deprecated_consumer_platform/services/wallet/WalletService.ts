import { Helius } from 'helius-sdk';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { performance } from 'perf_hooks';

/**
 * Service for wallet-related operations, especially NFT retrieval
 * Optimized implementation with caching and parallel requests
 */
export class WalletService {
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 500; // ms
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_PARALLEL_REQUESTS = 5;
  private readonly USE_COMPRESSION = true; // Enable response compression
  private logger: Logger;
  
  // Cache for recently retrieved wallet NFTs
  private nftCache = new Map<string, {
    nfts: string[];
    timestamp: number;
  }>();
  
  // Performance stats
  private cacheHits = 0;
  private cacheMisses = 0;
  private apiErrors = 0;
  private apiRequests = 0;
  private compressedRequests = 0;
  private bytesTransferred = 0;
  
  constructor(
    private helius: Helius,
    private manualNftRegistry: Map<string, string[]>
  ) {
    this.logger = LoggingService.getInstance().createLogger('WalletService');
  }

  /**
   * Gets all NFTs owned by a wallet using Helius - robust implementation
   * Handles pagination, retries, and proper error handling
   * Includes caching to avoid redundant API calls
   */
  async getWalletNFTs(walletAddress: string): Promise<string[]> {
    const startTime = performance.now();
    
    try {
      const operation = this.logger.operation('getWalletNFTs');
      operation.info('Fetching NFTs for wallet', { wallet: walletAddress });
      
      // Check cache first
      if (this.nftCache.has(walletAddress)) {
        const cachedData = this.nftCache.get(walletAddress)!;
        
        // Check if cache is still valid
        if (Date.now() - cachedData.timestamp < this.CACHE_TTL) {
          this.cacheHits++;
          operation.info('Serving cached NFTs', {
            wallet: walletAddress, 
            count: cachedData.nfts.length,
            cacheAge: `${Math.round((Date.now() - cachedData.timestamp) / 1000)}s`
          });
          
          operation.end();
          return cachedData.nfts;
        } else {
          operation.info('Cache expired', { wallet: walletAddress });
          this.cacheMisses++;
        }
      } else {
        this.cacheMisses++;
      }
      
      const allNfts: Set<string> = new Set();
      
      // Run methods in parallel to speed up retrieval
      operation.info('Fetching NFTs from multiple sources in parallel', { wallet: walletAddress });
      
      const [assetsResult, tokenAccountsResult] = await Promise.all([
        this.fetchNFTsViaAssetsByOwner(walletAddress).catch(err => {
          operation.warn('Error fetching via assets API', { 
            wallet: walletAddress,
            error: err instanceof Error ? err.message : String(err)
          });
          return [] as string[];
        }),
        this.fetchNFTsViaTokenAccounts(walletAddress).catch(err => {
          operation.warn('Error fetching via token accounts', { 
            wallet: walletAddress,
            error: err instanceof Error ? err.message : String(err)
          });
          return [] as string[];
        })
      ]);
      
      // Combine results from both methods
      [...assetsResult, ...tokenAccountsResult].forEach(nft => allNfts.add(nft));
      
      const uniqueNfts = Array.from(allNfts);
      operation.info('Combined NFT results', { 
        wallet: walletAddress, 
        total: uniqueNfts.length,
        fromAssets: assetsResult.length,
        fromTokenAccounts: tokenAccountsResult.length
      });
      
      // If no NFTs found, check our manual registry
      if (uniqueNfts.length === 0 && this.manualNftRegistry.has(walletAddress)) {
        const registeredNfts = this.manualNftRegistry.get(walletAddress) || [];
        operation.info('Using manually registered NFTs', { 
          wallet: walletAddress, 
          count: registeredNfts.length 
        });
        
        // Update cache even for manual registry data
        this.nftCache.set(walletAddress, {
          nfts: registeredNfts,
          timestamp: Date.now()
        });
        
        operation.end();
        return registeredNfts;
      }
      
      // Cache the results
      this.nftCache.set(walletAddress, {
        nfts: uniqueNfts,
        timestamp: Date.now()
      });
      
      const endTime = performance.now();
      operation.info('NFT fetch completed', {
        wallet: walletAddress,
        count: uniqueNfts.length,
        durationMs: Math.round(endTime - startTime)
      });
      
      operation.end();
      return uniqueNfts;
    } catch (error) {
      const endTime = performance.now();
      this.logger.error('Error fetching wallet NFTs', { 
        wallet: walletAddress,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        durationMs: Math.round(endTime - startTime)
      });
      
      this.apiErrors++;
      
      // If API call fails completely, check our manual registry as fallback
      if (this.manualNftRegistry.has(walletAddress)) {
        const registeredNfts = this.manualNftRegistry.get(walletAddress) || [];
        this.logger.info('Using manually registered NFTs after API error', { 
          wallet: walletAddress, 
          count: registeredNfts.length 
        });
        return registeredNfts;
      }
      
      throw error;
    }
  }

  /**
   * Fetches NFTs using getAssetsByOwner method
   * Optimized implementation with pagination and backoff
   */
  private async fetchNFTsViaAssetsByOwner(walletAddress: string): Promise<string[]> {
    const operation = this.logger.operation('fetchNFTsViaAssetsByOwner');
    operation.info('Starting NFT fetch via assets API', { wallet: walletAddress });
    
    let page = 1;
    let hasMore = true;
    let totalRetries = 0;
    const allNfts: string[] = [];
    
    // Use direct fetch for more control over the request
    const apiKey = process.env.HELIUS_API_KEY;
    const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
    
    while (hasMore && totalRetries < this.MAX_RETRIES) {
      try {
        operation.info('Fetching NFT page', { wallet: walletAddress, page });
        this.apiRequests++;
        
        // Create request headers with compression if enabled
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };

        if (this.USE_COMPRESSION) {
          headers['Accept-Encoding'] = 'gzip, deflate, br';
          this.compressedRequests++;
        }
        
        // Use direct fetch for more control
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: `getAssetsByOwner-${Date.now()}`,
            method: 'getAssetsByOwner',
            params: {
              ownerAddress: walletAddress,
              page,
              limit: 1000,
              displayOptions: {
                showFungible: false, // Focus on NFTs only
                showNativeBalance: false, // Focus on NFTs only
              }
            },
          }),
          // Add timeout to avoid hanging requests
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });
        
        // Handle response
        if (!response.ok) {
          const error = `API request failed with status ${response.status}`;
          operation.error(error, { wallet: walletAddress, page });
          throw new Error(error);
        }
        
        // Track response size for metrics
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          this.bytesTransferred += parseInt(contentLength, 10);
        }
        
        const data = await response.json();
        
        if (data.error) {
          const errorMsg = `API error: ${data.error.message || JSON.stringify(data.error)}`;
          operation.error(errorMsg, { wallet: walletAddress, page });
          throw new Error(errorMsg);
        }
        
        // Extract NFTs from response
        const result = data.result;
        if (!result || !result.items || !Array.isArray(result.items)) {
          operation.warn('No valid items in response', { wallet: walletAddress, page });
          hasMore = false;
          continue;
        }
        
        const pageNfts = result.items.map((asset: any) => asset.id);
        operation.info('Found NFTs on page', { 
          wallet: walletAddress, 
          page, 
          count: pageNfts.length 
        });
        
        // Add to our collection
        allNfts.push(...pageNfts);
        
        // Check if we need to fetch more pages
        if (pageNfts.length < 1000) {
          // We received fewer items than the limit, so we've reached the end
          hasMore = false;
        } else {
          // Move to next page, add delay to avoid rate limiting
          page++;
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Reset retry counter on success
        totalRetries = 0;
        
      } catch (error) {
        operation.error('Error fetching NFT page', { 
          wallet: walletAddress, 
          page,
          error: error instanceof Error ? error.message : String(error)
        });
        
        totalRetries++;
        this.apiErrors++;
        
        if (totalRetries >= this.MAX_RETRIES) {
          operation.warn('Max retries reached', { 
            wallet: walletAddress, 
            maxRetries: this.MAX_RETRIES 
          });
          break;
        }
        
        // Exponential backoff
        const backoffDelay = this.RETRY_DELAY * Math.pow(2, totalRetries - 1);
        
        // Wait before retrying
        operation.info('Retrying after delay', { 
          wallet: walletAddress, 
          attempt: totalRetries, 
          maxRetries: this.MAX_RETRIES,
          delayMs: backoffDelay
        });
        
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
    
    operation.end();
    return allNfts;
  }

  /**
   * Fetches NFTs using getTokenAccountsByOwner method
   * Optimized implementation with retries and backoff
   */
  private async fetchNFTsViaTokenAccounts(walletAddress: string): Promise<string[]> {
    const operation = this.logger.operation('fetchNFTsViaTokenAccounts');
    operation.info('Starting NFT fetch via token accounts', { wallet: walletAddress });
    
    let totalRetries = 0;
    const allNfts: string[] = [];
    
    const apiKey = process.env.HELIUS_API_KEY;
    const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
    
    while (totalRetries < this.MAX_RETRIES) {
      try {
        this.apiRequests++;
        
        // Create request headers with compression if enabled
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };

        if (this.USE_COMPRESSION) {
          headers['Accept-Encoding'] = 'gzip, deflate, br';
          this.compressedRequests++;
        }
        
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: `getTokenAccounts-${Date.now()}`,
            method: 'getTokenAccountsByOwner',
            params: [
              walletAddress,
              {
                programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
              },
              {
                encoding: "jsonParsed"
              }
            ]
          }),
          // Add timeout to avoid hanging requests
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });
        
        if (!response.ok) {
          const error = `API request failed with status ${response.status}`;
          operation.error(error, { wallet: walletAddress });
          throw new Error(error);
        }
        
        // Track response size for metrics
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          this.bytesTransferred += parseInt(contentLength, 10);
        }
        
        const data = await response.json();
        
        if (data.error) {
          const errorMsg = `API error: ${data.error.message || JSON.stringify(data.error)}`;
          operation.error(errorMsg, { wallet: walletAddress });
          throw new Error(errorMsg);
        }
        
        // Extract NFTs from token accounts - optimize with filter+map in one pass
        const accounts = data.result?.value || [];
        
        const tokenMints = accounts
          .filter((account: any) => {
            const tokenAmount = account.account?.data?.parsed?.info?.tokenAmount;
            // Filtering for NFTs: decimals = 0 and amount = 1
            return tokenAmount && tokenAmount.decimals === 0 && tokenAmount.amount === "1";
          })
          .map((account: any) => account.account?.data?.parsed?.info?.mint)
          .filter(Boolean);
        
        operation.info('Found NFT mints via token accounts', { 
          wallet: walletAddress, 
          count: tokenMints.length 
        });
        
        // Add token mints to our collection
        allNfts.push(...tokenMints);
        
        // Successfully fetched, exit loop
        break;
        
      } catch (error) {
        operation.error('Error fetching token accounts', { 
          wallet: walletAddress,
          error: error instanceof Error ? error.message : String(error)
        });
        
        totalRetries++;
        this.apiErrors++;
        
        if (totalRetries >= this.MAX_RETRIES) {
          operation.warn('Max retries reached for token accounts', { 
            wallet: walletAddress, 
            maxRetries: this.MAX_RETRIES 
          });
          break;
        }
        
        // Exponential backoff
        const backoffDelay = this.RETRY_DELAY * Math.pow(2, totalRetries - 1);
        
        // Wait before retrying
        operation.info('Retrying token accounts fetch', { 
          wallet: walletAddress, 
          attempt: totalRetries, 
          maxRetries: this.MAX_RETRIES,
          delayMs: backoffDelay
        });
        
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
    
    operation.end();
    return allNfts;
  }

  /**
   * Batch fetch NFTs for multiple wallets
   * Optimized to process in parallel with concurrency limit
   */
  async batchGetWalletNFTs(walletAddresses: string[]): Promise<Map<string, string[]>> {
    const operation = this.logger.operation('batchGetWalletNFTs');
    const startTime = performance.now();
    
    operation.info('Starting batch NFT fetch', { 
      wallets: walletAddresses.length 
    });
    
    const result = new Map<string, string[]>();
    
    // Process in chunks to limit concurrency
    const chunks = [];
    for (let i = 0; i < walletAddresses.length; i += this.MAX_PARALLEL_REQUESTS) {
      chunks.push(walletAddresses.slice(i, i + this.MAX_PARALLEL_REQUESTS));
    }
    
    let processedWallets = 0;
    let successCount = 0;
    let errorCount = 0;
    
    // Process each chunk in sequence, but wallets within a chunk in parallel
    for (const chunk of chunks) {
      // Process wallets in this chunk in parallel
      const chunkResults = await Promise.allSettled(
        chunk.map(wallet => this.getWalletNFTs(wallet))
      );
      
      // Process results
      for (let i = 0; i < chunk.length; i++) {
        const wallet = chunk[i];
        const chunkResult = chunkResults[i];
        
        if (chunkResult.status === 'fulfilled') {
          result.set(wallet, chunkResult.value);
          successCount++;
        } else {
          // Log error but continue with empty array
          operation.error(`Failed to fetch NFTs for wallet ${wallet}`, {
            error: chunkResult.reason
          });
          result.set(wallet, []);
          errorCount++;
        }
        
        processedWallets++;
      }
      
      // Log progress for large batches
      if (walletAddresses.length > 20 && chunks.length > 1) {
        operation.info(`Batch progress: ${processedWallets}/${walletAddresses.length} wallets processed`);
      }
      
      // Small delay between chunks to avoid rate limiting
      if (chunks.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    const endTime = performance.now();
    operation.info('Batch NFT fetch completed', {
      wallets: walletAddresses.length,
      success: successCount,
      errors: errorCount,
      durationMs: Math.round(endTime - startTime)
    });
    
    operation.end();
    return result;
  }

  /**
   * Prefetch and cache NFTs for specific wallets
   * Useful for warming up the cache before heavy operations
   */
  async prefetchWalletNFTs(walletAddresses: string[]): Promise<void> {
    // Filter out wallets that are already in the cache
    const now = Date.now();
    const walletsToFetch = walletAddresses.filter(wallet => {
      if (!this.nftCache.has(wallet)) return true;
      
      const cachedData = this.nftCache.get(wallet)!;
      return now - cachedData.timestamp >= this.CACHE_TTL;
    });
    
    if (walletsToFetch.length === 0) {
      this.logger.debug('All wallets already in cache, skipping prefetch');
      return;
    }
    
    this.logger.info(`Prefetching NFTs for ${walletsToFetch.length} wallets`);
    await this.batchGetWalletNFTs(walletsToFetch);
  }

  /**
   * Clean expired entries from the cache
   */
  cleanupCache(): void {
    const now = Date.now();
    let expiredEntries = 0;
    
    for (const [wallet, data] of this.nftCache.entries()) {
      if (now - data.timestamp >= this.CACHE_TTL) {
        this.nftCache.delete(wallet);
        expiredEntries++;
      }
    }
    
    if (expiredEntries > 0) {
      this.logger.info(`Removed ${expiredEntries} expired cache entries`);
    }
  }
  
  /**
   * Get statistics about the wallet service
   */
  getStats(): {
    cacheSize: number;
    cacheHitRate: number;
    apiErrorRate: number;
    apiRequests: number;
    compressedRequestPercentage: number;
    bytesTransferred: number;
  } {
    const totalCacheRequests = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalCacheRequests > 0
      ? this.cacheHits / totalCacheRequests
      : 0;
    
    const apiErrorRate = this.apiRequests > 0
      ? this.apiErrors / this.apiRequests
      : 0;
    
    const compressedRequestPercentage = this.apiRequests > 0
      ? (this.compressedRequests / this.apiRequests) * 100
      : 0;
    
    return {
      cacheSize: this.nftCache.size,
      cacheHitRate,
      apiErrorRate,
      apiRequests: this.apiRequests,
      compressedRequestPercentage,
      bytesTransferred: this.bytesTransferred
    };
  }
  
  /**
   * Clear the cache
   */
  clearCache(): void {
    this.nftCache.clear();
    this.logger.info('Wallet NFT cache cleared');
  }
  
  /**
   * Configure service options
   */
  public configure(options: { 
    useCompression?: boolean;
    cacheTTL?: number;
    maxParallelRequests?: number;
  }): void {
    if (options.useCompression !== undefined) {
      (this as any).USE_COMPRESSION = options.useCompression;
      this.logger.info(`Response compression ${options.useCompression ? 'enabled' : 'disabled'}`);
    }
    
    if (options.cacheTTL !== undefined) {
      (this as any).CACHE_TTL = options.cacheTTL;
      this.logger.info(`Cache TTL set to ${options.cacheTTL}ms`);
    }
    
    if (options.maxParallelRequests !== undefined) {
      (this as any).MAX_PARALLEL_REQUESTS = options.maxParallelRequests;
      this.logger.info(`Max parallel requests set to ${options.maxParallelRequests}`);
    }
  }
} 