/// <reference types="node-fetch" />
import { Helius } from 'helius-sdk';
import { NFTMetadata } from '../../types/nft';
import { NFTPricingService } from './NFTPricingService';
import { parallelize } from '../../lib/utils/parallelize';
import { LoggingService } from '../../utils/logging/LoggingService';
import { HeliusAPIError, NotFoundError } from '../../utils/errors/AppErrors';
import { NFT, TRADE } from '../../config/constants';
import { injectable, inject } from 'tsyringe';
import { INFTService, INFTPricingService, ILoggingService } from '../../types/services';
import fetch from 'node-fetch'; // Import node-fetch for backend HTTP requests

/**
 * Helius Asset API response types
 */
interface HeliusAssetContent {
  metadata?: {
    name?: string;
    symbol?: string;
    description?: string;
    image?: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
  };
  links?: {
    image?: string;
  };
}

interface HeliusAssetGrouping {
  group_key: string;
  group_value: string;
  collection_id?: string;
}

interface HeliusAsset {
  id: string;
  name?: string;
  content?: HeliusAssetContent;
  grouping?: HeliusAssetGrouping[];
}

// Add type for Magic Eden Token API response (simplified)
interface MagicEdenTokenResponse {
  mintAddress: string;
  collection?: string; // This might be the ME collection symbol
  collectionName?: string; // Or this
  // Potentially other fields, we are looking for something like 'isBadged' or a collection object
  // Let's assume for now the collection details including isBadged might be nested
  // or that 'collection' is the symbol we need.
  // For the purpose of this edit, we'll look for 'isBadged' directly,
  // or a 'collectionSymbol' or 'collection' field to use for a secondary call.
  // For the purpose of this edit, we'll look for 'isBadged' directly,
  // or a 'collectionSymbol' or 'collection' field to use for a secondary call.
  isBadged?: boolean; // Direct badged status for the token's collection
  collectionSymbol?: string; // Explicit ME collection symbol
}

// Add type for Magic Eden API response (simplified)
interface MagicEdenCollectionResponse {
  symbol: string;
  name: string;
  isBadged?: boolean; // This is the field we're interested in
  // ... other fields we might not need right now
}

/**
 * Service for retrieving and working with NFT metadata
 * Provides caching and batching capabilities for optimized performance
 */
@injectable()
export class NFTService implements INFTService {
  private static instance: NFTService;
  private helius: Helius;
  private metadataCache: Map<string, { metadata: NFTMetadata, timestamp: number }> = new Map();
  private magicEdenCollectionCache: Map<string, { isBadged: boolean, timestamp: number }> = new Map(); // Cache for ME data
  private logger: any;
  private CACHE_TTL = NFT.CACHE.METADATA_TTL_MS;
  // Increased TTL for Magic Eden data, fallback to 12 hours if METADATA_TTL_MS is shorter.
  private ME_CACHE_TTL = Math.max(NFT.CACHE.METADATA_TTL_MS, (60 * 60 * 1000 * 12)); 
  
  /**
   * Constructor with dependency injection
   */
  constructor(
    @inject("INFTPricingService") private pricingService: INFTPricingService,
    @inject("ILoggingService") loggingService: ILoggingService
  ) {
    const heliusApiKey = process.env.HELIUS_API_KEY;
    if (!heliusApiKey) {
      throw new Error('HELIUS_API_KEY environment variable is required');
    }
    // No longer strictly needed for ME badged status, as it's a public endpoint
    // if (!process.env.MAGIC_EDEN_API_KEY) {
    //   this.logger?.warn('MAGIC_EDEN_API_KEY environment variable is not set. Magic Eden badging will not be available.');
    // }

    this.helius = new Helius(heliusApiKey);
    this.logger = loggingService.createLogger('NFTService');
    
    // Set up cache cleanup interval
    setInterval(() => this.cleanupExpiredCache(), NFT.CACHE.CLEANUP_INTERVAL_MS);
  }
  
  /**
   * Get the singleton instance
   * @returns The NFTService instance
   * @deprecated Use dependency injection instead
   */
  public static getInstance(): NFTService {
    if (!NFTService.instance) {
      // This creates a temporary instance using the old pattern
      // In a fully migrated system, all dependencies would be resolved through the DI container
      NFTService.instance = new NFTService(
        NFTPricingService.getInstance(),
        LoggingService.getInstance()
      );
    }
    return NFTService.instance;
  }
  
  /**
   * Attempts to verify if a URL is accessible via a HEAD request.
   * @param url The URL to check.
   * @param timeout Milliseconds before giving up.
   * @returns True if the URL returns a success status (2xx), false otherwise.
   */
  private async isUrlAccessible(url: string, timeout: number = 3000): Promise<boolean> {
    if (!url) return false;
    
    // Special handling for Shadow Drive URLs which sometimes need more time and different validation
    if (url.includes('shdw-drive.genesysgo.net')) {
      timeout = 5000; // Give Shadow Drive URLs more time to respond
      return await this.validateShadowDriveUrl(url, timeout);
    }
    
    try {
      // Use fetch with a timeout for the HEAD request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, { 
        method: 'HEAD', 
        signal: controller.signal,
        headers: {
          'Accept': 'image/*'
        }
      });
      
      clearTimeout(timeoutId);
      return response.ok; // status code 200-299
    } catch (error) {
      this.logger.warn('URL accessibility check failed', { 
        url, 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }
  
  /**
   * Special validation function for Shadow Drive URLs which have unique requirements
   * and sometimes reject HEAD requests but work with GET.
   * @param url The Shadow Drive URL to validate
   * @param timeout Timeout in milliseconds
   * @returns True if the URL is valid and accessible
   */
  private async validateShadowDriveUrl(url: string, timeout: number = 5000): Promise<boolean> {
    const operation = this.logger.operation('validateShadowDriveUrl');
    operation.info('Validating Shadow Drive URL', { url });
    
    try {
      // Try HEAD first - fastest when it works
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, { 
          method: 'HEAD', 
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'image/*'
          }
        });
        
        clearTimeout(timeoutId);
        if (response.ok) {
          operation.info('Shadow Drive HEAD request succeeded');
          operation.end();
          return true;
        }
      } catch (headError) {
        operation.info('Shadow Drive HEAD request failed, trying GET fallback', {
          error: headError instanceof Error ? headError.message : String(headError)
        });
        // Continue to GET fallback
      }
      
      // Fall back to GET with range request - some Shadow Drive endpoints only work with GET
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, { 
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'image/*',
          'Range': 'bytes=0-1024' // Just get the first KB to check if it exists
        }
      });
      
      clearTimeout(timeoutId);
      const isValid = response.ok;
      
      if (isValid) {
        operation.info('Shadow Drive GET request succeeded');
      } else {
        operation.warn('Shadow Drive GET request failed', { 
          status: response.status,
          statusText: response.statusText 
        });
      }
      
      operation.end();
      return isValid;
    } catch (error) {
      operation.warn('Shadow Drive validation failed', { 
        url, 
        error: error instanceof Error ? error.message : String(error) 
      });
      operation.end();
      
      // Shadow Drive URLs sometimes fail validation but work in browsers
      // For this special case, return true to allow the URL to be used
      return true;
    }
  }
  
  /**
   * Gets metadata for a given NFT
   * @param mintAddress The NFT mint address
   * @param forceRefresh Whether to force a refresh of metadata bypassing cache
   * @returns NFT metadata
   */
  public async getNFTMetadata(mintAddress: string, forceRefresh: boolean = false): Promise<NFTMetadata> {
    const operation = this.logger.operation('getNFTMetadata');
    try {
      operation.info(`Fetching metadata for NFT: ${mintAddress}${forceRefresh ? ' (forced refresh)' : ''}`);
      
      // Check cache if not forcing refresh
      if (!forceRefresh) {
        const cachedNFT = this.metadataCache.get(mintAddress);
        if (cachedNFT) {
          operation.info(`Returning cached metadata for NFT: ${mintAddress}`);
          operation.end();
          return cachedNFT.metadata;
        }
      } else {
        operation.info(`Bypassing cache for NFT: ${mintAddress}`);
      }

      // 🚫 CRITICAL FIX: Skip Helius for Ethereum NFTs to prevent 401 errors
      if (this.isEthereumNFT(mintAddress)) {
        operation.info(`Skipping Helius for Ethereum NFT: ${mintAddress}`);
        const metadata = this.getEthereumNFTMetadata(mintAddress);
        this.metadataCache.set(mintAddress, { metadata, timestamp: Date.now() });
        operation.end();
        return metadata;
      }

      // Only call Helius for valid Solana mint addresses
      if (!this.isValidSolanaMintAddress(mintAddress)) {
        operation.warn(`Invalid Solana mint address, using placeholder: ${mintAddress}`);
        const metadata = this.getPlaceholderMetadata(mintAddress);
        this.metadataCache.set(mintAddress, { metadata, timestamp: Date.now() });
        operation.end();
        return metadata;
      }

      const asset = await this.fetchHeliusAsset(mintAddress);

      // Log the entire asset.grouping array to inspect its structure for verification flags
      if (asset.grouping) {
        operation.info('Helius asset.grouping details:', { mintAddress, grouping: JSON.stringify(asset.grouping, null, 2) });
      } else {
        operation.info('Helius asset.grouping is undefined or null', { mintAddress });
      }

      // --- Start URL Validation & Normalization --- 
      // Check both possible locations for the image URL
      let rawImageUrl = asset.content?.links?.image || asset.content?.metadata?.image || '';
      let validatedImageUrl = '';
      operation.info('Raw image URL from Helius', { 
        mintAddress, 
        rawImageUrl,
        fromLinks: asset.content?.links?.image || 'not found',
        fromMetadata: asset.content?.metadata?.image || 'not found'
      });

      if (rawImageUrl) {
        const potentialUrls: string[] = [];

        // 1. Normalize potential URLs based on protocol/source
        if (rawImageUrl.includes('shdw-drive.genesysgo.net')) {
          // Shadow Drive is usually most reliable for Solana NFTs
          potentialUrls.push(rawImageUrl); // Try the raw URL first
          
          // Sometimes Shadow Drive URLs have slight variations
          const urlParts = rawImageUrl.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const baseUrl = urlParts.slice(0, urlParts.length - 1).join('/');
          
          // Try common variations of Shadow Drive URLs with potential fixes
          if (fileName.includes('.')) {
            potentialUrls.push(`${baseUrl}/${fileName}`);
            
            // Add more common Shadow Drive URL patterns
            const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
            const ext = fileName.substring(fileName.lastIndexOf('.'));
            
            // Try with and without leading zeros
            if (/^\d+$/.test(fileNameWithoutExt)) {
              // If numeric, try variations that might have different numeric formats
              potentialUrls.push(`${baseUrl}/${parseInt(fileNameWithoutExt)}${ext}`); // Without leading zeros
            }
          }
        } else if (rawImageUrl.startsWith('ipfs://')) {
          const ipfsHash = rawImageUrl.replace('ipfs://', '');
          potentialUrls.push(`https://ipfs.io/ipfs/${ipfsHash}`);
          potentialUrls.push(`https://cloudflare-ipfs.com/ipfs/${ipfsHash}`);
          potentialUrls.push(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
        } else if (rawImageUrl.startsWith('ar://')) {
          potentialUrls.push(rawImageUrl.replace('ar://', 'https://arweave.net/'));
        } else if (rawImageUrl.includes('.ipfs.dweb.link/')) {
          const cidMatch = rawImageUrl.match(/([a-z0-9]+)\.ipfs\.dweb\.link\/(.+)/i);
          if (cidMatch && cidMatch[1] && cidMatch[2]) {
            const cid = cidMatch[1];
            const path = cidMatch[2];
            potentialUrls.push(`https://ipfs.io/ipfs/${cid}/${path}`);
            potentialUrls.push(`https://cloudflare-ipfs.com/ipfs/${cid}/${path}`);
          }
        } else if (rawImageUrl.startsWith('http')) {
          potentialUrls.push(rawImageUrl); // Assume standard HTTPS URL
        }
        
        // 2. Add Helius CDN as a general fallback
        potentialUrls.push(`https://cdn.helius-rpc.com/cdn-cgi/image/${mintAddress}`);

        // 3. For IPFS and other decentralized storage, skip validation as it's often slow
        // The image proxy will handle retries and fallbacks
        if (rawImageUrl.includes('ipfs') || rawImageUrl.includes('arweave.net') || rawImageUrl.includes('shdw-drive')) {
          operation.info('Skipping validation for decentralized storage URL, trusting metadata', { mintAddress, rawImageUrl });
          validatedImageUrl = potentialUrls[0] || rawImageUrl; // Use the first normalized URL or raw URL
        } else {
          // For regular HTTP URLs, do a quick validation
        operation.info('Attempting to validate image URLs', { mintAddress, potentialUrls });
        for (const urlToTest of potentialUrls) {
          try {
              const isAccessible = await this.isUrlAccessible(urlToTest, 1500); // Shorter timeout for regular URLs
            
            if (isAccessible) {
              validatedImageUrl = urlToTest;
              operation.info('Validated image URL found', { mintAddress, validatedImageUrl });
                break;
            }
          } catch (urlError) {
            operation.warn('Error validating URL', {
              url: urlToTest,
              error: urlError instanceof Error ? urlError.message : String(urlError)
            });
            // Continue to next URL
          }
          }
        }
        
        if (!validatedImageUrl && rawImageUrl) {
          // If validation failed but we have a URL, use it anyway
          // The image proxy will handle any issues
          operation.warn('Using unvalidated URL, letting image proxy handle it', { mintAddress, rawImageUrl });
            validatedImageUrl = rawImageUrl;
        }
      }
      // --- End URL Validation & Normalization --- 

      // Extract collection info before creating metadata
      const collectionId = asset.grouping?.find((g: HeliusAssetGrouping) => g.group_key === 'collection')?.group_value || '';
      
      // If no valid image URL was found, try to construct one based on common patterns
      if (!validatedImageUrl && rawImageUrl) {
        operation.warn('No validated image URL, attempting fallback strategies', { mintAddress, rawImageUrl });
        
        // Try to extract NFT number for constructing URLs
        const nftName = asset.content?.metadata?.name || asset.name || '';
        const numberMatch = nftName.match(/#(\d+)/);
        const nftNumber = numberMatch ? numberMatch[1] : null;
        
        // Common NFT image URL patterns
        if (nftNumber) {
          const fallbackUrls = [
            // Try common IPFS gateways with the raw URL
            rawImageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/'),
            rawImageUrl.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/'),
            rawImageUrl.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/'),
            // Try Arweave
            rawImageUrl.replace('ar://', 'https://arweave.net/'),
          ];
          
          for (const fallbackUrl of fallbackUrls) {
            if (await this.isUrlAccessible(fallbackUrl, 2000)) {
              validatedImageUrl = fallbackUrl;
              operation.info('Found working fallback URL', { mintAddress, validatedImageUrl });
              break;
            }
          }
        }
      }
      
      // Final fallback: If still no image, try to get from collection metadata
      if (!validatedImageUrl && collectionId) {
        operation.info('No NFT image found, attempting to use collection image as fallback', { mintAddress, collectionId });
        try {
          // Try to get collection metadata which might have a better image
          const collectionAsset = await this.fetchHeliusAsset(collectionId).catch(() => null);
          if (collectionAsset?.content?.links?.image || collectionAsset?.content?.metadata?.image) {
            const collectionImage = collectionAsset.content?.links?.image || collectionAsset.content?.metadata?.image || '';
            if (await this.isUrlAccessible(collectionImage, 2000)) {
              validatedImageUrl = collectionImage;
              operation.info('Using collection image as fallback', { mintAddress, collectionId, validatedImageUrl });
            }
          }
        } catch (collError) {
          operation.warn('Failed to fetch collection metadata for image fallback', { 
            error: collError instanceof Error ? collError.message : String(collError) 
          });
        }
      }

      const metadataFromHelius: NFTMetadata = {
        address: mintAddress,
        name: asset.content?.metadata?.name || asset.name || `${NFT.PLACEHOLDERS.NFT_NAME_PREFIX}${mintAddress.slice(0, 8)}...`,
        symbol: asset.content?.metadata?.symbol || '',
        image: validatedImageUrl,
        collection: collectionId,
        description: asset.content?.metadata?.description || '',
        attributes: asset.content?.metadata?.attributes || [],
        isMagicEdenBadged: false, // Default
      };

      // Attempt to get Magic Eden badged status
      let meBadgedStatus: boolean | undefined = undefined;
      let meCollectionSymbolToQuery: string | undefined = undefined;

      const operationFetchMEToken = this.logger.operation('fetchMagicEdenTokenDetails');
      try {
        operationFetchMEToken.info('Attempting to fetch ME token details for badged status or symbol', { mintAddress });
        const meTokenApiUrl = `https://api-mainnet.magiceden.dev/v2/tokens/${mintAddress}`;
        const tokenResponse = await fetch(meTokenApiUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (tokenResponse.ok) {
          const tokenData: MagicEdenTokenResponse = await tokenResponse.json();
          operationFetchMEToken.info('ME Token API response received', { mintAddress, tokenData });
          if (tokenData.isBadged !== undefined) {
            meBadgedStatus = tokenData.isBadged;
            operationFetchMEToken.info('Found isBadged directly in ME token response', { isBadged: meBadgedStatus });
          } else if (tokenData.collectionSymbol) { // Check for explicit 'collectionSymbol'
            meCollectionSymbolToQuery = tokenData.collectionSymbol;
            operationFetchMEToken.info('Found ME collectionSymbol in token response', { collectionSymbol: meCollectionSymbolToQuery });
          } else if (typeof tokenData.collection === 'string' && tokenData.collection.length > 0 && !tokenData.collection.includes(':')) { // Heuristic: if collection is a string and doesn't look like an address
            meCollectionSymbolToQuery = tokenData.collection;
            operationFetchMEToken.info('Using ME token.collection as collectionSymbol', { collectionSymbol: meCollectionSymbolToQuery });
          }
        } else {
          operationFetchMEToken.warn('ME Token API request failed', { status: tokenResponse.status, url: meTokenApiUrl });
        }
      } catch (meTokenError) {
        operationFetchMEToken.warn('Error fetching ME token details', { error: meTokenError instanceof Error ? meTokenError.message : String(meTokenError) });
      } finally {
        operationFetchMEToken.end();
      }

      if (meBadgedStatus !== undefined) {
        metadataFromHelius.isMagicEdenBadged = meBadgedStatus;
      } else if (meCollectionSymbolToQuery) {
        // We have a symbol, now fetch collection data for 'isBadged'
        // REMOVED DELAY: Introduce a delay to respect Magic Eden's rate limits (e.g., 2 QPS)
        // const delayBetweenMEAPICallsMs = 1100; // Increased to 1100ms delay
        // operation.info(`Waiting ${delayBetweenMEAPICallsMs}ms before fetching ME collection details to respect rate limits.`);
        // await new Promise(resolve => setTimeout(resolve, delayBetweenMEAPICallsMs));

        const operationFetchMECollection = this.logger.operation('fetchMagicEdenCollectionForBadge');
        operationFetchMECollection.info('Attempting to fetch ME collection details using symbol', { meCollectionSymbolToQuery });
        try {
          const meCollectionData = await this.fetchMagicEdenCollectionData(meCollectionSymbolToQuery);
          if (meCollectionData?.isBadged !== undefined) {
            metadataFromHelius.isMagicEdenBadged = meCollectionData.isBadged;
            operationFetchMECollection.info('Successfully fetched Magic Eden badged status via collection symbol', { isBadged: meCollectionData.isBadged });
          }
        } catch (meCollectionError) {
          operationFetchMECollection.warn('Failed to fetch ME collection data using symbol', { error: meCollectionError instanceof Error ? meCollectionError.message : String(meCollectionError) });
        } finally {
          operationFetchMECollection.end();
        }
      }
      
      this.metadataCache.set(mintAddress, { metadata: metadataFromHelius, timestamp: Date.now() });
      operation.info('Final metadata prepared (with ME check)', { mintAddress, name: metadataFromHelius.name, isMEBadged: metadataFromHelius.isMagicEdenBadged });
      operation.end();
      return metadataFromHelius;

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof HeliusAPIError) {
        operation.error('Error fetching NFT metadata', {
          mintAddress,
          errorType: error.name,
          error: error.message,
          stack: error.stack
        });
      } else {
        operation.error('Unexpected error fetching NFT metadata', {
          mintAddress,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
      
      // Return a minimal placeholder with the address
      const placeholder: NFTMetadata = {
        address: mintAddress,
        name: `${NFT.PLACEHOLDERS.NFT_NAME_PREFIX}${mintAddress.slice(0, 8)}...`,
        symbol: NFT.PLACEHOLDERS.DEFAULT_SYMBOL,
        image: '',
        collection: '',
        description: NFT.PLACEHOLDERS.DESCRIPTION_UNAVAILABLE,
      };
      
      operation.end();
      return placeholder;
    }
  }

  /**
   * Check if this is an Ethereum NFT (not a Solana mint address)
   */
  private isEthereumNFT(mintAddress: string): boolean {
    // Ethereum NFTs in our system start with "nft_token_" or are 40-character hex addresses
    return mintAddress.startsWith('nft_token_') || 
           (mintAddress.startsWith('0x') && mintAddress.length === 42) ||
           mintAddress.includes('ethereum') ||
           mintAddress.includes('sepolia');
  }

  /**
   * Check if this is a valid Solana mint address (base58, 32-44 characters)
   */
  private isValidSolanaMintAddress(mintAddress: string): boolean {
    // Solana addresses are base58 encoded, typically 32-44 characters
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(mintAddress) && !mintAddress.includes('0x');
  }

  /**
   * Get metadata for Ethereum NFTs without calling Helius
   */
  private getEthereumNFTMetadata(mintAddress: string): NFTMetadata {
    return {
      name: this.getEthereumNFTName(mintAddress),
      symbol: 'ETH_NFT',
      description: `Ethereum NFT ${mintAddress}`,
      image: '',
      collection: {
        name: 'Ethereum Collection',
        family: 'Ethereum'
      },
      attributes: [],
      creators: [],
      mintAddress: mintAddress
    };
  }

  /**
   * Get a friendly name for Ethereum NFTs
   */
  private getEthereumNFTName(mintAddress: string): string {
    if (mintAddress === 'nft_token_1') return 'Cosmic Crystal';
    if (mintAddress === 'nft_token_2') return 'Dragon Flame Sword';
    if (mintAddress === 'nft_token_3') return 'Ethereal Protection Shield';
    if (mintAddress.startsWith('nft_token_')) {
      const tokenId = mintAddress.replace('nft_token_', '');
      return `Ethereum NFT #${tokenId}`;
    }
    return `Ethereum NFT ${mintAddress.slice(0, 8)}...`;
  }

  /**
   * Get placeholder metadata for invalid addresses
   */
  private getPlaceholderMetadata(mintAddress: string): NFTMetadata {
    return {
      name: `NFT ${mintAddress.slice(0, 8)}...`,
      symbol: '',
      description: '',
      image: '',
      collection: 'Unknown Collection',
      attributes: [],
      creators: [],
      mintAddress: mintAddress
    };
  }
  
  /**
   * Helper function to fetch raw asset data from Helius.
   * Separated for clarity.
   */
  private async fetchHeliusAsset(mintAddress: string): Promise<HeliusAsset> {
      const apiKey = process.env.HELIUS_API_KEY;
      const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `getAsset-${Date.now()}-${mintAddress.slice(0,4)}`,
          method: 'getAsset',
          params: {
            id: mintAddress,
          },
        }),
      });
      
      if (!response.ok) {
        throw new HeliusAPIError(`Helius API request failed for ${mintAddress} with status ${response.status}`,
          new Error(await response.text()));
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new HeliusAPIError(`Helius API error for ${mintAddress}: ${data.error.message || JSON.stringify(data.error)}`);
      }
      
      const asset = data.result;
      
      if (!asset) {
        throw new NotFoundError('NFT Asset', mintAddress);
      }
      return asset;
  }
  
  /**
   * Get NFT metadata for multiple mint addresses with concurrency control and batching
   * Optimized to use cache and batch API calls efficiently
   * 
   * @param mintAddresses Array of NFT mint addresses
   * @param maxConcurrency Maximum number of concurrent requests
   * @returns Array of NFT metadata objects
   */
  public async batchGetNFTMetadata(
    mintAddresses: string[],
    maxConcurrency: number = NFT.API.DEFAULT_CONCURRENCY
  ): Promise<NFTMetadata[]> {
    const operation = this.logger.operation('batchGetNFTMetadata');
    operation.info('Batch fetching metadata', {
      count: mintAddresses.length,
      concurrency: maxConcurrency
    });
    
    // First check cache to avoid unnecessary requests
    const uncachedAddresses: string[] = [];
    const results: NFTMetadata[] = [];
    const now = Date.now();
    
    for (const address of mintAddresses) {
      if (this.metadataCache.has(address)) {
        const cachedItem = this.metadataCache.get(address)!;
        if (now - cachedItem.timestamp < this.CACHE_TTL) {
          results.push(cachedItem.metadata);
        } else {
          uncachedAddresses.push(address);
        }
      } else {
        uncachedAddresses.push(address);
      }
    }
    
    operation.info('Cache check complete', {
      cacheHits: results.length,
      cacheMisses: uncachedAddresses.length
    });
    
    // If all results were cached, return immediately
    if (uncachedAddresses.length === 0) {
      operation.info('All NFTs found in cache');
      operation.end();
      return results;
    }
    
    // Try to use getAssetBatch for more efficient fetching if supported by Helius
    try {
      // Check if we should use batch API or individual requests
      if (uncachedAddresses.length > 1 && uncachedAddresses.length <= NFT.API.HELIUS_BATCH_LIMIT) {
        operation.info('Using getAssetBatch API for efficiency', { 
          batchSize: uncachedAddresses.length 
        });
        
        const batchResults = await this.fetchNFTBatch(uncachedAddresses);
        
        // Merge with cached results
        results.push(...batchResults);
        operation.info('Batch fetch successful', { 
          fetchedCount: batchResults.length 
        });
        operation.end();
        return results;
      }
      
      // Fall back to parallel individual requests if needed
      operation.info('Using parallel individual requests', { 
        count: uncachedAddresses.length 
      });
      
      const fetchPromises = await parallelize<NFTMetadata>(
        () => uncachedAddresses.map(address => this.getNFTMetadata(address)),
        { maxConcurrency }
      );
      
      results.push(...fetchPromises);
      
      operation.info('Parallel fetch complete', { 
        fetchedCount: fetchPromises.length
      });
      operation.end();
      return results;
    } catch (error) {
      operation.error('Error in batch fetching NFT metadata', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Return whatever results we have plus placeholders for failures
      const fetchedAddresses = new Set(results.map(nft => nft.address));
      for (const address of uncachedAddresses) {
        if (!fetchedAddresses.has(address)) {
          results.push({
            address,
            name: `${NFT.PLACEHOLDERS.NFT_NAME_PREFIX}${address.slice(0, 8)}...`,
            symbol: NFT.PLACEHOLDERS.DEFAULT_SYMBOL,
            image: '',
            collection: '',
            description: NFT.PLACEHOLDERS.BATCH_ERROR_MESSAGE,
          });
        }
      }
      
      operation.end();
      return results;
    }
  }
  
  /**
   * Fetch a batch of NFTs using the getAssetBatch API
   * More efficient than individual requests for multiple NFTs
   * 
   * @param mintAddresses Array of NFT mint addresses to fetch
   * @returns Array of NFT metadata objects
   * @throws HeliusAPIError if the API request fails
   */
  private async fetchNFTBatch(mintAddresses: string[]): Promise<NFTMetadata[]> {
    const operation = this.logger.operation('fetchNFTBatch');
    operation.info('Fetching NFT batch', { count: mintAddresses.length });
    
    try {
      // Use the Helius getAssetBatch endpoint
      const apiKey = process.env.HELIUS_API_KEY;
      const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `getAssetBatch-${Date.now()}`,
          method: 'getAssetBatch',
          params: {
            ids: mintAddresses,
          },
        }),
      });
      
      if (!response.ok) {
        throw new HeliusAPIError(`API request failed with status ${response.status}`, 
          new Error(await response.text()));
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new HeliusAPIError(data.error.message || JSON.stringify(data.error));
      }
      
      const assets = data.result || [];
      
      // Convert to our metadata format and update cache
      const results: NFTMetadata[] = [];
      const now = Date.now();
      
      for (const asset of assets as HeliusAsset[]) {
        if (!asset || !asset.id) continue;
        
        const metadata: NFTMetadata = {
          address: asset.id,
          name: asset.content?.metadata?.name || asset.name || `${NFT.PLACEHOLDERS.NFT_NAME_PREFIX}${asset.id.slice(0, 8)}...`,
          symbol: asset.content?.metadata?.symbol || '',
          image: asset.content?.links?.image || asset.content?.metadata?.image || '',
          collection: asset.grouping?.find((g: HeliusAssetGrouping) => g.group_key === 'collection')?.group_value || '',
          description: asset.content?.metadata?.description || '',
          attributes: asset.content?.metadata?.attributes || [],
        };
        
        // Update cache
        this.metadataCache.set(asset.id, { metadata, timestamp: now });
        results.push(metadata);
      }
      
      // Check if any requested NFTs were not found
      const foundAddresses = new Set(results.map(nft => nft.address));
      for (const address of mintAddresses) {
        if (!foundAddresses.has(address)) {
          operation.warn('NFT not found in batch response', { address });
          const placeholder: NFTMetadata = {
            address,
            name: `${NFT.PLACEHOLDERS.NFT_NAME_PREFIX}${address.slice(0, 8)}...`,
            symbol: NFT.PLACEHOLDERS.DEFAULT_SYMBOL,
            image: '',
            collection: '',
            description: NFT.PLACEHOLDERS.NOT_FOUND_MESSAGE,
          };
          results.push(placeholder);
        }
      }
      
      operation.info('Batch fetch successful', { count: results.length });
      operation.end();
      return results;
    } catch (error) {
      operation.error('Error fetching NFT batch', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      operation.end();
      throw error; // Let caller handle this
    }
  }
  
  /**
   * Clears expired items from the metadata cache
   * Runs periodically to prevent memory bloat
   */
  private cleanupExpiredCache(): void {
    const operation = this.logger.operation('cleanupExpiredCache');
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, value] of this.metadataCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.metadataCache.delete(key);
        expiredCount++;
      }
    }
    
    operation.info('Cache cleanup complete', {
      expiredCount,
      remainingCount: this.metadataCache.size
    });
    operation.end();
  }
  
  /**
   * Clears the entire metadata cache
   * Useful for testing or when prices/data might be stale
   */
  public clearCache(): void {
    const cacheSize = this.metadataCache.size;
    this.metadataCache.clear();
    this.logger.info('NFT metadata cache cleared', { previousSize: cacheSize });
  }
  
  /**
   * Get all NFTs owned by a wallet with optimized batch fetching
   * 
   * @param walletAddress The wallet address to fetch NFTs for
   * @returns Array of NFT metadata objects owned by the wallet
   */
  public async getOwnedNFTs(walletAddress: string): Promise<NFTMetadata[]> {
    const operation = this.logger.operation('getOwnedNFTs');
    try {
      operation.info('Fetching owned NFTs for wallet', { walletAddress });
      
      // Use direct RPC call for more control
      const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `getAssetsByOwner-${Date.now()}`,
          method: 'getAssetsByOwner',
          params: {
            ownerAddress: walletAddress,
            page: 1,
            limit: NFT.API.MAX_USER_OWNED_NFTS, // Limit to reasonable number for performance
            displayOptions: {
              showFungible: false,
              showNativeBalance: false,
            }
          },
        }),
      });
      
      if (!response.ok) {
        throw new HeliusAPIError(`API request failed with status ${response.status}`, 
          new Error(await response.text()));
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new HeliusAPIError(data.error.message || JSON.stringify(data.error));
      }
      
      const assets = data.result?.items || [];
      operation.info('Received assets from API', { count: assets.length });
      
      // Get collection IDs for batched floor price lookup
      const collectionIds = new Set<string>();
      assets.forEach((asset: HeliusAsset) => {
        const collection = asset.grouping?.find((g: HeliusAssetGrouping) => g.group_key === 'collection')?.collection_id;
        if (collection) collectionIds.add(collection);
      });
      
      // Batch fetch floor prices if available
      const floorPrices = new Map<string, number>();
      if (collectionIds.size > 0) {
        try {
          operation.info('Fetching floor prices for collections', { 
            collectionCount: collectionIds.size 
          });
          
          // This would be implemented in pricingService
          // const prices = await this.pricingService.batchGetFloorPrices(Array.from(collectionIds));
          // prices.forEach((price, id) => floorPrices.set(id, price));
        } catch (err) {
          operation.warn('Failed to fetch floor prices', {
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
      
      // Map to our metadata format - do in batches for better performance
      const nfts: NFTMetadata[] = [];
      const batchSize = 10; // Process 10 at a time
      
      for (let i = 0; i < assets.length; i += batchSize) {
        const batch = assets.slice(i, i + batchSize);
        
        const batchResults = await parallelize<NFTMetadata>(
          () => batch.map(async (asset: HeliusAsset) => {
            // Get collection info
            const collectionId = asset.grouping?.find((g: HeliusAssetGrouping) => g.group_key === 'collection')?.collection_id;
            const collectionName = asset.grouping?.find((g: HeliusAssetGrouping) => g.group_key === 'collection')?.group_value || '';
            
            // Get floor price if available
            let floorPrice = undefined;
            if (collectionId && floorPrices.has(collectionId)) {
              floorPrice = floorPrices.get(collectionId);
            } else if (collectionId) {
              try {
                floorPrice = await this.pricingService.getFloorPrice(collectionId);
              } catch (err) {
                // Just log and continue
                operation.warn('Failed to fetch individual floor price', {
                  collection: collectionId,
                  error: err instanceof Error ? err.message : String(err)
                });
              }
            }
            
            // Set cached metadata
            const metadata: NFTMetadata = {
              address: asset.id,
              name: asset.content?.metadata?.name || `${NFT.PLACEHOLDERS.NFT_NAME_PREFIX}${asset.id.slice(0, 6)}...`,
              symbol: asset.content?.metadata?.symbol || NFT.PLACEHOLDERS.DEFAULT_SYMBOL,
              description: asset.content?.metadata?.description || '',
              image: asset.content?.links?.image || '',
              collection: collectionName,
              attributes: asset.content?.metadata?.attributes || [],
              floorPrice,
              owner: walletAddress,
              usedRealPrice: floorPrice !== undefined,
              hasFloorPrice: floorPrice !== undefined && floorPrice > 0
            };
            
            // Update cache
            this.metadataCache.set(asset.id, {
              metadata,
              timestamp: Date.now()
            });
            
            return metadata;
          }),
          { maxConcurrency: NFT.API.DEFAULT_CONCURRENCY }
        );
        
        nfts.push(...batchResults);
      }
      
      operation.info('Successfully processed wallet NFTs', { count: nfts.length });
      operation.end();
      return nfts;
    } catch (error) {
      operation.error('Error fetching owned NFTs for wallet', {
        walletAddress,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      operation.end();
      return [];
    }
  }
  
  /**
   * Batch fetch NFTs for multiple wallets with concurrency control
   * 
   * @param walletAddresses Array of wallet addresses to fetch NFTs for
   * @param maxConcurrency Maximum number of concurrent wallet requests
   * @returns Map of wallet addresses to their owned NFTs
   */
  public async batchGetOwnedNFTs(
    walletAddresses: string[],
    maxConcurrency: number = NFT.API.DEFAULT_CONCURRENCY
  ): Promise<Map<string, NFTMetadata[]>> {
    const operation = this.logger.operation('batchGetOwnedNFTs');
    operation.info('Batch fetching owned NFTs for wallets', {
      walletCount: walletAddresses.length,
      concurrency: maxConcurrency
    });
    
    const results = new Map<string, NFTMetadata[]>();
    
    try {
      // Use the parallelize utility to control concurrency
      const walletNFTs = await parallelize<NFTMetadata[]>(
        () => walletAddresses.map(address => this.getOwnedNFTsWithRetry(address)),
        { maxConcurrency }
      );
      
      // Map results to wallet addresses
      walletAddresses.forEach((address, index) => {
        results.set(address, walletNFTs[index]);
      });
      
      operation.info('Batch wallet NFT fetch complete', {
        walletCount: results.size,
        totalNFTs: Array.from(results.values()).reduce((sum, nfts) => sum + nfts.length, 0)
      });
      operation.end();
      return results;
    } catch (error) {
      operation.error('Error in batch fetching wallet NFTs', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Return any successfully fetched results
      for (const address of walletAddresses) {
        if (!results.has(address)) {
          results.set(address, []);
        }
      }
      
      operation.end();
      return results;
    }
  }
  
  /**
   * Get owned NFTs with retry logic for reliability
   * Implements exponential backoff for transient failures
   * 
   * @param walletAddress The wallet address to fetch NFTs for
   * @param retries Number of retry attempts
   * @returns Array of NFT metadata objects owned by the wallet
   */
  private async getOwnedNFTsWithRetry(
    walletAddress: string, 
    retries: number = TRADE.TIMEOUTS.DEFAULT_RETRY_COUNT
  ): Promise<NFTMetadata[]> {
    const operation = this.logger.operation('getOwnedNFTsWithRetry');
    operation.info('Fetching wallet NFTs with retry logic', {
      walletAddress,
      maxRetries: retries
    });
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.getOwnedNFTs(walletAddress);
        operation.info('Successfully fetched wallet NFTs', {
          walletAddress,
          attempt,
          nftCount: result.length
        });
        operation.end();
        return result;
      } catch (error) {
        if (attempt === retries) {
          operation.error('Failed to fetch NFTs after all retry attempts', {
            walletAddress,
            attempts: retries,
            error: error instanceof Error ? error.message : String(error)
          });
          operation.end();
          return [];
        }
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * TRADE.TIMEOUTS.EXPONENTIAL_BACKOFF_BASE_MS;
        operation.warn('Retrying NFT fetch after failure', {
          walletAddress,
          attempt,
          nextAttempt: attempt + 1,
          delayMs: delay,
          error: error instanceof Error ? error.message : String(error)
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    operation.end();
    return [];
  }
  
  /**
   * Get floor price for an NFT collection
   * 
   * @param collectionAddress The collection address to get floor price for
   * @returns The floor price in SOL or 0 if not available
   */
  public async getCollectionFloorPrice(collectionAddress: string): Promise<number> {
    return this.pricingService.getFloorPrice(collectionAddress);
  }
  
  /**
   * Records errors when fetching floor prices for monitoring
   * 
   * @param collectionId The collection ID that failed
   * @param error The error that occurred
   */
  private recordFloorPriceError(collectionId: string, error: unknown): void {
    this.logger.warn('Floor price fetch error', {
      collectionId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // TODO: Implement error tracking for floor price failures
    // For example, track failure rates by collection or API provider
  }

  /**
   * Fetches collection data from Magic Eden API.
   * Includes caching.
   * @param collectionSymbol The Magic Eden collection symbol.
   * @returns Object containing isBadged status or null if error/not found.
   */
  private async fetchMagicEdenCollectionData(collectionSymbol: string): Promise<{ isBadged: boolean } | null> {
    const operation = this.logger.operation('fetchMagicEdenCollectionData');
    operation.info('Fetching ME data for symbol', { collectionSymbol });

    // Check cache first
    if (this.magicEdenCollectionCache.has(collectionSymbol)) {
      const cachedItem = this.magicEdenCollectionCache.get(collectionSymbol)!;
      if (Date.now() - cachedItem.timestamp < this.ME_CACHE_TTL) {
        operation.info('Cache hit for ME collection data');
        operation.end();
        return { isBadged: cachedItem.isBadged };
      } else {
        operation.info('ME Collection cache expired');
        this.magicEdenCollectionCache.delete(collectionSymbol); // Remove expired item
      }
    }

    const meApiUrl = `https://api-mainnet.magiceden.dev/v2/collections/${collectionSymbol}`;
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        operation.info(`Calling Magic Eden API (public endpoint) - Attempt ${attempt}/${maxRetries}`, { url: meApiUrl });
        const response = await fetch(meApiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          // timeout: 7000 // Consider a slightly longer timeout for external APIs if needed
        });

        if (response.ok) {
          const data: MagicEdenCollectionResponse = await response.json();
          operation.info('Magic Eden API response received', { data });

          if (data && data.isBadged !== undefined) {
            this.magicEdenCollectionCache.set(collectionSymbol, { isBadged: data.isBadged, timestamp: Date.now() });
            operation.info('ME Collection data cached', { isBadged: data.isBadged });
            operation.end();
            return { isBadged: data.isBadged };
          } else {
            operation.warn('ME API response did not contain isBadged or was unexpected', { data });
            operation.end();
            return null; // Or handle as a specific type of error if needed
          }
        } else if (response.status === 429) {
          lastError = new Error(`Magic Eden API rate limit exceeded (status 429) after attempt ${attempt}`);
          operation.warn(lastError.message, { url: meApiUrl });
          if (attempt < maxRetries) {
            const delay = 5000; // Increased delay to 5 seconds
            operation.info(`Waiting ${delay}ms before retry...`);
            continue; // Next attempt
          }
        } else {
          // Handle other non-ok statuses (404, 500, etc.) as immediate failure for this attempt
          const errorBody = await response.text();
          lastError = new Error(`Magic Eden API request failed with status ${response.status}: ${errorBody}`);
          operation.error(lastError.message, { status: response.status, url: meApiUrl });
          // For non-429 errors, we might not want to retry, or have different logic
          // For simplicity here, we break and will return null based on lastError.
          break; 
        }
      } catch (error) {
        lastError = error;
        operation.error('Error calling Magic Eden API', { 
          collectionSymbol, 
          attempt,
          error: error instanceof Error ? error.message : String(error) 
        });
        if (attempt < maxRetries) { // Also retry on network errors, etc.
          const delay = 5000; // Increased delay to 5 seconds
          operation.info(`Waiting ${delay}ms before retry due to fetch error...`);
          continue;
        }
        break; // Exhausted retries or unrecoverable error
      }
    }
    // If loop finished due to exhausted retries or non-429 error
    if(lastError) {
        operation.error('Failed to fetch from Magic Eden API after all retries or due to critical error', { collectionSymbol, finalError: lastError.message });
    }
    operation.end();
    return null; 
  }
} 