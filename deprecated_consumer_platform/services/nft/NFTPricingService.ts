import { PriceEstimationResult } from '../../types/nft';
import { parallelize } from '../../lib/utils/parallelize';
import { INFTPricingService, ILoggingService } from '../../types/services';
import { injectable, inject } from "tsyringe";
import { Helius } from 'helius-sdk';
import { NFT } from '../../config/constants';

/**
 * Service for fetching and calculating NFT prices
 */
@injectable()
export class NFTPricingService implements INFTPricingService {
  private priceCache: Map<string, { price: any, timestamp: number }> = new Map();
  private metadataCache: Map<string, { metadata: any, timestamp: number }> = new Map();
  private collectionAddressCache: Map<string, string> = new Map(); // Maps NFT address to collection
  private readonly CACHE_TTL = NFT.CACHE.PRICE_TTL_MS; 
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second
  private requestsInProgress: Map<string, Promise<number>> = new Map();
  private logger: any;
  private helius: Helius;

  // Collection name mapping for API compatibility - start empty for fully dynamic operation
  private readonly COLLECTION_MAPPING: Record<string, string[]> = {};
  
  /**
   * Constructor with dependency injection
   */
  constructor(
    @inject("ILoggingService") loggingService: ILoggingService,
    @inject("Helius") helius: Helius
  ) {
    this.logger = loggingService.createLogger('NFTPricingService');
    this.helius = helius;
    this.priceCache = new Map();
    this.requestsInProgress = new Map();
  }
  
  /**
   * Clear the price cache
   */
  public clearCache(): void {
    const cacheSize = this.priceCache.size;
    this.priceCache.clear();
    console.log('NFT price cache cleared', { previousSize: cacheSize });
  }
  
  /**
   * Estimate value of an NFT
   * 
   * @param nftAddress The NFT address to estimate
   * @param options Additional options for estimation
   * @returns The estimated value in SOL
   */
  public async estimateNFTValue(
    nftAddress: string, 
    options: { forceRefresh?: boolean } = {}
  ): Promise<number> {
    // For now, just delegate to the existing method
    return this.estimateNFTPrice(nftAddress);
  }
  
  /**
   * Get the floor price for multiple NFT collections at once
   * @param collectionAddresses Array of collection addresses/slugs
   * @param maxConcurrency Maximum number of concurrent requests
   */
  public async batchGetFloorPrices(
    collectionAddresses: string[],
    maxConcurrency: number = 5
  ): Promise<Map<string, number>> {
    console.log(`Batch fetching floor prices for ${collectionAddresses.length} collections`);
    
    const results = new Map<string, number>();
    
    // Check cache first for all collections
    const uncachedCollections: string[] = [];
    
    for (const address of collectionAddresses) {
      const cachedPrice = this.priceCache.get(address);
      if (cachedPrice && (Date.now() - cachedPrice.timestamp) < this.CACHE_TTL) {
        results.set(address, cachedPrice.price);
      } else {
        uncachedCollections.push(address);
      }
    }
    
    // If all results were cached, return immediately
    if (uncachedCollections.length === 0) {
      return results;
    }
    
    // Fetch uncached collections with concurrency control
    try {
      const pricePromises = await parallelize(
        () => uncachedCollections.map(address => this.getFloorPrice(address)),
        { maxConcurrency }
      );
      
      // Add results to map
      uncachedCollections.forEach((address, index) => {
        results.set(address, pricePromises[index]);
      });
      
      return results;
    } catch (error) {
      console.error('Error in batch fetching floor prices:', error);
      
      // Add any remaining collections with 0 price
      for (const address of collectionAddresses) {
        if (!results.has(address)) {
          results.set(address, 0);
        }
      }
      
      return results;
    }
  }
  
  /**
   * Get the floor price for an NFT collection
   * This is the main method for getting specific collection floor prices
   */
  public async getFloorPrice(collectionAddress: string): Promise<number> {
    if (!collectionAddress) {
      console.warn(`No collection address provided for floor price lookup`);
      return 0;
    }
    
    // Check if there's already a request in progress for this collection
    if (this.requestsInProgress.has(collectionAddress)) {
      console.log(`Request already in progress for ${collectionAddress}, reusing promise`);
      return this.requestsInProgress.get(collectionAddress)!;
    }
    
    // Format collection name from address if needed
    // Some APIs expect the slug (like "degods"), while others need the full address
    let collectionSlug = collectionAddress;
    if (collectionAddress.length > 30) {
      // This is likely a full address, try to extract slug
      const parts = collectionAddress.split('/');
      if (parts.length > 1) {
        collectionSlug = parts[parts.length - 1].toLowerCase();
      } else {
        collectionSlug = collectionAddress.substring(0, 12).toLowerCase();
      }
    }
    
    // Normalize the collection name for consistent handling
    const normalizedName = this.normalizeCollectionName(collectionSlug);
    
    console.log(`Looking up floor price for collection: ${collectionSlug}`);
    
    // Create a promise for this request and store it
    const pricePromise = this.fetchFloorPrice(collectionSlug, normalizedName);
    this.requestsInProgress.set(collectionAddress, pricePromise);
    
    try {
      const price = await pricePromise;
      // Remove from in-progress map once complete
      this.requestsInProgress.delete(collectionAddress);
      return price;
    } catch (error) {
      // Remove from in-progress map on error
      this.requestsInProgress.delete(collectionAddress);
      throw error;
    }
  }
  
  /**
   * Internal method to fetch floor price with caching and multi-source verification
   */
  private async fetchFloorPrice(collectionSlug: string, normalizedName: string): Promise<number> {
    try {
      // Check cache first - but with a short TTL to ensure fresh data
      const cachedPrice = this.priceCache.get(collectionSlug);
      if (cachedPrice && (Date.now() - cachedPrice.timestamp < this.CACHE_TTL)) {
        return cachedPrice.price;
      }
      
      // Get possible slugs for API queries
      const possibleSlugs = this.getPossibleCollectionSlugs(normalizedName);
      
      console.log(`Trying ${possibleSlugs.length} possible collection identifiers for ${normalizedName}`);
      
      // Collect prices from all sources for verification
      const prices: number[] = [];
      
      // Try Magic Eden for all possible slugs
      for (const slug of possibleSlugs) {
        console.log(`Attempting to fetch floor price with slug: ${slug}`);
        const price = await this.getMagicEdenFloorPrice(slug);
        if (price > 0) {
          prices.push(price);
          console.log(`Magic Eden floor price for ${slug}: ${price} SOL`);
        }
      }
      
      // Try Tensor API
      const tensorPrice = await this.getTensorFloorPrice(collectionSlug);
      if (tensorPrice > 0) {
        prices.push(tensorPrice);
        console.log(`Tensor floor price for ${collectionSlug}: ${tensorPrice} SOL`);
      }
      
      // Try Helius API if appropriate
      if (collectionSlug.length >= 32) {
        const heliusPrice = await this.getHeliusFloorPrice(collectionSlug);
        if (heliusPrice > 0) {
          prices.push(heliusPrice);
          console.log(`Helius floor price for ${collectionSlug}: ${heliusPrice} SOL`);
        }
      }
      
      // If we have any prices, calculate a reliable price
      if (prices.length > 0) {
        // Sort prices and remove outliers if we have enough data points
        prices.sort((a, b) => a - b);
        
        let finalPrice: number;
        if (prices.length >= 3) {
          // With 3+ data points, use median for robustness against outliers
          const middleIndex = Math.floor(prices.length / 2);
          finalPrice = prices.length % 2 === 0
            ? (prices[middleIndex - 1] + prices[middleIndex]) / 2
            : prices[middleIndex];
        } else {
          // With 1-2 data points, use the average
          const sum = prices.reduce((acc, curr) => acc + curr, 0);
          finalPrice = sum / prices.length;
        }
        
        console.log(`Final calculated floor price for ${collectionSlug}: ${finalPrice} SOL (from ${prices.length} sources)`);
        
        // Cache the result
        this.priceCache.set(collectionSlug, {
          price: finalPrice,
          timestamp: Date.now()
        });
        
        return finalPrice;
      }
      
      // If all APIs fail, return 0 to indicate no price available
      console.warn(`No floor price available for collection ${collectionSlug} from any source`);
      return 0;
    } catch (error) {
      console.error(`Error fetching floor price for ${collectionSlug}:`, error);
      return 0;
    }
  }
  
  /**
   * Normalize a collection name for consistent API handling
   */
  private normalizeCollectionName(name: string): string {
    // Simply remove special characters, spaces, and convert to lowercase
    return name.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/\s+/g, '');
  }
  
  /**
   * Get possible collection slugs to try
   */
  private getPossibleCollectionSlugs(normalizedName: string): string[] {
    // Start with the input name itself
    const results = [normalizedName];
    
    // Generate common variations without relying on hardcoded mappings
    
    // Try with different separators (dash, underscore, or none)
    if (normalizedName.includes('-')) {
      // If name has dashes, try with underscores and without separators
      results.push(normalizedName.replace(/-/g, '_')); // Replace dash with underscore
      results.push(normalizedName.replace(/-/g, '')); // Remove dashes
    } else if (normalizedName.includes('_')) {
      // If name has underscores, try with dashes and without separators
      results.push(normalizedName.replace(/_/g, '-')); // Replace underscore with dash
      results.push(normalizedName.replace(/_/g, '')); // Remove underscores
    } else {
      // If name has no separators, try adding them at logical points
      // Look for transitions between letters and numbers (e.g., "okay123" -> "okay-123")
      const withSeparators = normalizedName.replace(/([a-z])(\d)/g, '$1-$2').replace(/(\d)([a-z])/g, '$1-$2');
      if (withSeparators !== normalizedName) {
        results.push(withSeparators);
        results.push(withSeparators.replace(/-/g, '_')); // Also try with underscores
      }
    }
    
    // Try short prefix (first 3-4 characters for collections with numeric IDs)
    if (/^[a-z]+\d/.test(normalizedName)) { // If name starts with letters followed by numbers
      const prefixMatch = normalizedName.match(/^([a-z]+)\d/);
      if (prefixMatch && prefixMatch[1].length >= 3) {
        results.push(prefixMatch[1]); // Just the letter prefix
      }
    }
    
    // Remove duplicates and return
    return [...new Set(results)];
  }
  
  /**
   * Get Magic Eden floor price
   */
  private async getMagicEdenFloorPrice(collectionSlug: string): Promise<number> {
    try {
      let retries = 0;
      let success = false;
      let response;
      
      // Log request to identify collection
      console.log(`Fetching Magic Eden floor price for: ${collectionSlug}`);
      
      // Implement retry logic
      while (!success && retries < this.MAX_RETRIES) {
        try {
          // Use v2 API endpoint
          response = await fetch(`https://api-mainnet.magiceden.dev/v2/collections/${collectionSlug}/stats`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
          success = true;
        } catch (err) {
          retries++;
          if (retries >= this.MAX_RETRIES) throw err;
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * retries));
        }
      }
      
      if (!response || !response.ok) {
        console.warn(`Magic Eden API request failed for ${collectionSlug}: ${response?.status}`);
        return 0;
      }
      
      const data = await response.json();
      console.log(`Magic Eden response for ${collectionSlug}:`, data);
      
      // Check for valid floor price in the response
      if (data && typeof data.floorPrice === 'number' && data.floorPrice > 0) {
        // Convert from lamports to SOL
        const floorPriceInSol = data.floorPrice / 1_000_000_000;
        console.log(`Found valid floor price for ${collectionSlug}: ${floorPriceInSol} SOL`);
        return floorPriceInSol;
      }
      
      // Some collections might use a different structure
      if (data && data.listedCount > 0 && data.avgPrice24hr) {
        // If we have listings but no floor price, use the 24hr average as a fallback
        const avgPriceInSol = data.avgPrice24hr / 1_000_000_000;
        console.log(`No floor price, using 24hr average for ${collectionSlug}: ${avgPriceInSol} SOL`);
        return avgPriceInSol;
      }
      
      // Also try to directly check listings to determine floor price
      try {
        const listingsResponse = await fetch(`https://api-mainnet.magiceden.dev/v2/collections/${collectionSlug}/listings?limit=1&offset=0&listStatus=listed`, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (listingsResponse.ok) {
          const listings = await listingsResponse.json();
          if (listings && listings.length > 0 && listings[0].price) {
            console.log(`Found floor price from listings for ${collectionSlug}: ${listings[0].price} SOL`);
            return listings[0].price;
          }
        }
      } catch (error) {
        console.warn(`Error fetching listings for ${collectionSlug}:`, error);
      }
      
      console.warn(`Magic Eden: Floor price not available for ${collectionSlug}`);
      return 0;
    } catch (error) {
      console.warn(`Magic Eden price fetch failed for ${collectionSlug}:`, error);
      return 0; // Return 0 to indicate failure, allowing fallback to other sources
    }
  }
  
  /**
   * Get Tensor floor price
   * Implements Tensor API integration
   */
  private async getTensorFloorPrice(collectionSlug: string): Promise<number> {
    try {
      console.log(`Fetching Tensor floor price for: ${collectionSlug}`);
      
      // We can use Tensor's public API endpoint
      const response = await fetch(`https://api.tensor.so/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: `
            query GetCollectionFloor($slug: String!) {
              collectionsV2(slug: $slug) {
                slug
                floorPrice
                statistics {
                  floor1d
                  floor7d
                }
              }
            }
          `,
          variables: {
            slug: collectionSlug
          }
        })
      });
      
      if (!response.ok) {
        console.warn(`Tensor API request failed for ${collectionSlug}: ${response.status}`);
        return 0;
      }
      
      const result = await response.json();
      console.log(`Tensor response for ${collectionSlug}:`, result);
      
      if (result && result.data && result.data.collectionsV2 && result.data.collectionsV2.length > 0) {
        const collection = result.data.collectionsV2[0];
        
        // Get floor price in lamports and convert to SOL
        if (collection.floorPrice) {
          const floorPriceInSol = collection.floorPrice / 1_000_000_000;
          console.log(`Tensor floor price for ${collectionSlug}: ${floorPriceInSol} SOL`);
          return floorPriceInSol;
        }
        
        // If no current floor price, try historical data
        if (collection.statistics) {
          if (collection.statistics.floor1d) {
            const floor1dInSol = collection.statistics.floor1d / 1_000_000_000;
            console.log(`Tensor 1d floor price for ${collectionSlug}: ${floor1dInSol} SOL`);
            return floor1dInSol;
          }
          
          if (collection.statistics.floor7d) {
            const floor7dInSol = collection.statistics.floor7d / 1_000_000_000;
            console.log(`Tensor 7d floor price for ${collectionSlug}: ${floor7dInSol} SOL`);
            return floor7dInSol;
          }
        }
      }
      
      // As a fallback, try the DApp API that doesn't need API key
      try {
        const dappResponse = await fetch(`https://tensor.so/api/collection-stats?slug=${encodeURIComponent(collectionSlug)}`);
        
        if (dappResponse.ok) {
          const dappData = await dappResponse.json();
          console.log(`Tensor DApp API response for ${collectionSlug}:`, dappData);
          
          if (dappData && dappData.floorPrice) {
            const floorPriceInSol = dappData.floorPrice / 1_000_000_000;
            console.log(`Tensor DApp API floor price for ${collectionSlug}: ${floorPriceInSol} SOL`);
            return floorPriceInSol;
          }
        }
      } catch (error) {
        console.warn(`Tensor DApp API error for ${collectionSlug}:`, error);
      }
      
      console.warn(`No floor price found on Tensor for ${collectionSlug}`);
      return 0;
    } catch (error) {
      console.warn(`Tensor price fetch failed for ${collectionSlug}:`, error);
      return 0;
    }
  }
  
  /**
   * Get floor price using Helius API
   */
  private async getHeliusFloorPrice(collectionAddress: string): Promise<number> {
    try {
      console.log(`Fetching Helius floor price for: ${collectionAddress}`);
      
      // Use the Helius RPC API to get collection data
      const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `getCollectionData-${Date.now()}`,
          method: 'getCollectionData',
          params: {
            collectionId: collectionAddress
          },
        }),
      });
      
      if (!response.ok) {
        console.warn(`Helius API request failed for ${collectionAddress}: ${response.status}`);
        return 0;
      }
      
      const result = await response.json();
      console.log(`Helius response for ${collectionAddress}:`, result);
      
      if (result.error) {
        console.warn(`Helius API error for ${collectionAddress}: ${result.error.message || JSON.stringify(result.error)}`);
        return 0;
      }
      
      // Check if we got the collection data with floor price
      if (result.result && typeof result.result.floorPrice === 'number' && result.result.floorPrice > 0) {
        // Convert from lamports to SOL
        const floorPriceInSol = result.result.floorPrice / 1_000_000_000;
        console.log(`Helius floor price for ${collectionAddress}: ${floorPriceInSol} SOL`);
        return floorPriceInSol;
      }
      
      // Also check if there are any marketStats with floor prices
      if (result.result && result.result.marketStats) {
        const stats = result.result.marketStats;
        
        // Check different marketplaces in order of preference
        for (const marketplace of ['magicEden', 'tensor', 'coralCube', 'openSea']) {
          if (stats[marketplace] && typeof stats[marketplace].floorPrice === 'number' && stats[marketplace].floorPrice > 0) {
            const floorPriceInSol = stats[marketplace].floorPrice / 1_000_000_000;
            console.log(`Helius ${marketplace} floor price for ${collectionAddress}: ${floorPriceInSol} SOL`);
            return floorPriceInSol;
          }
        }
      }
      
      console.warn(`No floor price found in Helius API for ${collectionAddress}`);
      return 0;
    } catch (error) {
      console.warn(`Helius price fetch failed for ${collectionAddress}:`, error);
      return 0;
    }
  }
  
  /**
   * Estimate price for an NFT by getting its collection floor price
   */
  public async estimateNFTPrice(nftAddress: string, collectionAddress?: string): Promise<number> {
    try {
      console.log(`Estimating price for NFT mint address: ${nftAddress}`);
      
      // First attempt: Try to get the price directly using the mint address
      try {
        console.log(`Attempting direct price lookup for mint: ${nftAddress}`);
        const directPrice = await this.getMintDirectPrice(nftAddress);
        if (directPrice > 0) {
          console.log(`Found direct price for mint ${nftAddress}: ${directPrice} SOL`);
          return directPrice;
        }
      } catch (error) {
        console.warn(`Direct price lookup failed for ${nftAddress}:`, error);
      }
      
      // If we have a collection address, use that next
      if (collectionAddress) {
        console.log(`Using provided collection address: ${collectionAddress}`);
        const price = await this.getFloorPrice(collectionAddress);
        if (price > 0) {
          return price;
        }
      }
      
      // Check if we have a cached collection for this NFT
      const cachedCollection = this.collectionAddressCache.get(nftAddress);
      if (cachedCollection) {
        console.log(`Using cached collection for NFT ${nftAddress}: ${cachedCollection}`);
        const price = await this.getFloorPrice(cachedCollection);
        if (price > 0) {
          return price;
        }
      }
      
      // If we get here, we need to fetch metadata to determine collection
      try {
        const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: `getAsset-${Date.now()}`,
            method: 'getAsset',
            params: {
              id: nftAddress
            },
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Helius API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        if (data.error) {
          throw new Error(`Helius API error: ${data.error.message || JSON.stringify(data.error)}`);
        }
        
        const asset = data.result;
        if (!asset) {
          throw new Error('Helius: No asset data returned');
        }
        
        // Extract collection info
        let collectionId = null;
        
        // Try to extract collection from grouping data
        if (asset.grouping?.length > 0) {
          for (const group of asset.grouping) {
            if (group.group_key === 'collection') {
              collectionId = group.group_value;
              break;
            }
          }
        }
        
        // If no collection from grouping, try content metadata 
        if (!collectionId && asset.content?.metadata?.collection?.name) {
          collectionId = asset.content.metadata.collection.name;
        }
        
        // If still no collection id, try the symbol or token name
        if (!collectionId && asset.content?.metadata?.symbol) {
          collectionId = asset.content.metadata.symbol;
        } else if (!collectionId && asset.content?.metadata?.name) {
          // Try to parse collection name from NFT name (e.g., "Collection #1234")
          const nameMatch = asset.content.metadata.name.match(/^([A-Za-z]+)/);
          if (nameMatch) {
            collectionId = nameMatch[1];
          }
        }
        
        if (collectionId) {
          console.log(`Found collection for NFT ${nftAddress}: ${collectionId}`);
          
          // Cache the collection for this NFT
          this.collectionAddressCache.set(nftAddress, collectionId);
          
          // Get floor price for this collection
          const price = await this.getFloorPrice(collectionId);
          if (price > 0) {
            return price;
          }
        } else {
          console.warn(`Could not determine collection for NFT ${nftAddress}`);
        }
      } catch (error) {
        console.error(`Error fetching metadata for NFT ${nftAddress}:`, error);
      }
      
      // If all attempts fail, return 0 to indicate no price available
      return 0;
    } catch (error) {
      console.error(`Error estimating NFT price for ${nftAddress}:`, error);
      return 0;
    }
  }
  
  /**
   * Get price for a specific NFT mint address directly
   */
  private async getMintDirectPrice(mintAddress: string): Promise<number> {
    try {
      // First approach: Try the token endpoint to get collection info
      console.log(`Checking Magic Eden token info for mint: ${mintAddress}`);
      const meResponse = await fetch(`https://api-mainnet.magiceden.dev/v2/tokens/${mintAddress}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      let collectionSlug = '';
      
      if (meResponse.ok) {
        const tokenData = await meResponse.json();
        console.log(`Magic Eden token data:`, tokenData);
        
        // Check if the token is listed and has a price
        if (tokenData && tokenData.price && tokenData.price > 0) {
          console.log(`Found direct listing price for ${mintAddress}: ${tokenData.price} SOL`);
          return tokenData.price;
        }
        
        // Extract collection info for further lookups
        if (tokenData && tokenData.collection) {
          collectionSlug = tokenData.collection;
          console.log(`Found collection slug from token: ${collectionSlug}`);
        }
      }
      
      // Check collection listings if we have a collection slug
      if (collectionSlug) {
        try {
          console.log(`Checking collection listings for: ${collectionSlug}`);
          const listingsResponse = await fetch(`https://api-mainnet.magiceden.dev/v2/collections/${collectionSlug}/listings?offset=0&limit=1`, {
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (listingsResponse.ok) {
            const listings = await listingsResponse.json();
            console.log(`Collection listings:`, listings);
            
            if (listings && listings.length > 0 && listings[0].price) {
              console.log(`Found floor price from collection listings: ${listings[0].price} SOL`);
              return listings[0].price;
            }
          }
        } catch (err) {
          console.warn(`Error getting collection listings:`, err);
        }
      }
      
      // Second approach: Try getting recent activities for this mint
      const activitiesResponse = await fetch(`https://api-mainnet.magiceden.dev/v2/tokens/${mintAddress}/activities?offset=0&limit=10`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (activitiesResponse.ok) {
        const activities = await activitiesResponse.json();
        console.log(`Magic Eden activities data:`, activities);
        
        // Find the most recent listing or sale
        for (const activity of activities) {
          if ((activity.type === 'listing' || activity.type === 'sale') && activity.price) {
            console.log(`Found recent ${activity.type} price for ${mintAddress}: ${activity.price} SOL`);
            return activity.price;
          }
        }
      }
      
      // Third approach: Try Helius getAsset method with extended market data
      const heliusResponse = await fetch(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `getAsset-${Date.now()}`,
          method: 'getAsset',
          params: {
            id: mintAddress,
            displayOptions: {
              showListingsByMarketplace: true,
              showBids: true
            }
          },
        }),
      });
      
      if (heliusResponse.ok) {
        const data = await heliusResponse.json();
        if (data.result) {
          const asset = data.result;
          
          // Try to get collection info from asset data
          if (!collectionSlug && asset.grouping) {
            for (const group of asset.grouping) {
              if (group.group_key === 'collection') {
                const assetCollectionSlug = group.group_value;
                console.log(`Found collection from Helius: ${assetCollectionSlug}`);
                
                // Try collection listings approach with this slug
                try {
                  console.log(`Checking collection listings for: ${assetCollectionSlug}`);
                  const collListingsResponse = await fetch(`https://api-mainnet.magiceden.dev/v2/collections/${assetCollectionSlug}/listings?offset=0&limit=1`, {
                    headers: {
                      'Content-Type': 'application/json'
                    }
                  });
                  
                  if (collListingsResponse.ok) {
                    const collListings = await collListingsResponse.json();
                    
                    if (collListings && collListings.length > 0 && collListings[0].price) {
                      console.log(`Found floor price from Helius collection listings: ${collListings[0].price} SOL`);
                      return collListings[0].price;
                    }
                  }
                } catch (err) {
                  console.warn(`Error getting Helius collection listings:`, err);
                }
                
                break;
              }
            }
          }
          
          // Check if there are current listings
          if (asset.listings && asset.listings.length > 0) {
            // Find the lowest priced listing
            let lowestPrice = Number.MAX_VALUE;
            for (const listing of asset.listings) {
              const price = listing.price / 1_000_000_000; // Convert from lamports to SOL
              if (price < lowestPrice) {
                lowestPrice = price;
              }
            }
            
            if (lowestPrice < Number.MAX_VALUE) {
              console.log(`Found Helius listing price for ${mintAddress}: ${lowestPrice} SOL`);
              return lowestPrice;
            }
          }
          
          // Check if there's a lastSale price
          if (asset.lastSale && asset.lastSale.price) {
            const lastSalePrice = asset.lastSale.price / 1_000_000_000;
            console.log(`Found Helius last sale price for ${mintAddress}: ${lastSalePrice} SOL`);
            return lastSalePrice;
          }
        }
      }
      
      // No direct price found
      return 0;
    } catch (error) {
      console.warn(`Error getting direct price for mint ${mintAddress}:`, error);
      return 0;
    }
  }
  
  /**
   * Associate an NFT with its collection
   */
  public registerNFTCollection(nftAddress: string, collectionAddress: string): void {
    this.collectionAddressCache.set(nftAddress, collectionAddress);
  }
  
  /**
   * Batch estimate prices for multiple NFTs with concurrency control
   */
  public async batchEstimateNFTPrices(
    nftAddresses: string[], 
    collectionAddresses?: string[],
    maxConcurrency: number = 8
  ): Promise<Map<string, number>> {
    console.log(`Batch estimating prices for ${nftAddresses.length} NFTs`);
    
    const results = new Map<string, number>();
    
    try {
      const pricePromises = await parallelize(
        () => nftAddresses.map((address, index) => {
          const collection = collectionAddresses ? collectionAddresses[index] : undefined;
          return this.estimateNFTPrice(address, collection);
        }),
        { maxConcurrency }
      );
      
      // Map results to NFT addresses
      nftAddresses.forEach((address, index) => {
        results.set(address, pricePromises[index]);
      });
      
      return results;
    } catch (error) {
      console.error('Error in batch estimating NFT prices:', error);
      
      // Add any remaining NFTs with 0 price
      for (const address of nftAddresses) {
        if (!results.has(address)) {
          results.set(address, 0);
        }
      }
      
      return results;
    }
  }

  /**
   * Get NFT metadata for a specific NFT address
   * @param nftAddress The NFT address to get metadata for
   * @returns The NFT metadata
   */
  public async getNFTMetadata(nftAddress: string): Promise<any> {
    try {
      // First check if we have this cached
      if (this.metadataCache.has(nftAddress)) {
        const cachedData = this.metadataCache.get(nftAddress);
        
        // Check if cache is still valid (less than 15 minutes old)
        if (cachedData && Date.now() - cachedData.timestamp < 15 * 60 * 1000) {
          this.logger.info(`Using cached metadata for NFT ${nftAddress}`);
          return cachedData.metadata;
        }
      }
      
      // Make a direct call to the Helius API
      const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'my-id',
          method: 'getAsset',
          params: {
            id: nftAddress,
            displayOptions: {
              showCollectionMetadata: true
            }
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Helius API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Process the response to extract metadata
      const assetData = data.result || {};
      
      // Extract collection data
      let collection = null;
      if (assetData.grouping && assetData.grouping.length > 0) {
        const grouping = assetData.grouping.find((g: any) => g.group_key === 'collection');
        if (grouping) {
          collection = {
            name: grouping.group_value || 'Unknown Collection',
            address: grouping.collection_id || null
          };
        }
      }
      
      // Get the content object, which typically contains the files/media
      const content = assetData.content || {};
      
      // Extract standard metadata fields
      const metadata = {
        name: assetData.name || 'Unnamed NFT',
        symbol: assetData.symbol || '',
        address: nftAddress,
        description: content.description || assetData.description || '',
        image: content.links?.image || '',
        collection: collection || assetData.collection || 'Unknown Collection',
        owner: assetData.ownership?.owner || null,
        // Additional asset info
        royalty: assetData.royalty || null,
        attributes: content.metadata?.attributes || []
      };
      
      // Cache the result
      this.metadataCache.set(nftAddress, {
        metadata,
        timestamp: Date.now()
      });
      
      return metadata;
    } catch (error) {
      this.logger.error(`Error fetching NFT metadata for ${nftAddress}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get price estimate for a specific NFT
   * @param nftAddress The NFT address to get price for
   * @returns Price estimate data
   */
  public async getNFTPriceEstimate(nftAddress: string): Promise<any> {
    try {
      // First check if we have a cached price record for this NFT
      if (this.priceCache.has(nftAddress)) {
        const cachedData = this.priceCache.get(nftAddress);
        
        // Check if cache is still valid (less than 30 minutes old)
        if (cachedData && Date.now() - cachedData.timestamp < 30 * 60 * 1000) {
          this.logger.info(`Using cached price data for NFT ${nftAddress}`);
          return cachedData.price;
        }
      }
      
      // Try to get metadata first to find collection info
      const metadata = await this.getNFTMetadata(nftAddress);
      
      // Check for collection address
      let collectionAddress = null;
      if (metadata.collection && typeof metadata.collection === 'object') {
        collectionAddress = metadata.collection.address;
      }
      
      // If we have a collection address, try to get the floor price
      if (collectionAddress) {
        try {
          // Make a direct call to the Helius API to get collection floor price
          const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 'my-id',
              method: 'getCollectionFinancials',
              params: {
                query: { collectionId: collectionAddress }
              }
            }),
          });
          
          if (!response.ok) {
            throw new Error(`Helius API error: ${response.status} ${response.statusText}`);
          }
          
          const data = await response.json();
          
          if (data.result) {
            const priceData = {
              floorPrice: data.result.floor7d || data.result.floor1d || data.result.floor30d || 0,
              currency: 'SOL',
              lastUpdated: new Date().toISOString(),
              source: 'Helius API',
              hasFloorPrice: true,
              usedRealPrice: true
            };
            
            // Cache the result
            this.priceCache.set(nftAddress, {
              price: priceData,
              timestamp: Date.now()
            });
            
            return priceData;
          }
        } catch (error) {
          this.logger.error(`Error fetching collection floor price for ${collectionAddress}`, {
            error: error instanceof Error ? error.message : String(error)
          });
          // Continue to fallback
        }
      }
      
      // Instead of using a hardcoded fallback, try to get secondary market data
      try {
        // Try to find similar NFTs in the collection and use their average price
        console.log(`Attempting to find similar NFTs for price estimation for ${nftAddress}`);
        
        // Use Helius API to search for similar NFTs in the same collection
        let collectionIdentifier = null;
        if (metadata.collection) {
          if (typeof metadata.collection === 'string') {
            collectionIdentifier = metadata.collection;
          } else if (metadata.collection.name) {
            collectionIdentifier = metadata.collection.name;
          }
        }
        
        if (collectionIdentifier) {
          // Make an API call to get a sample of similar NFTs
          const sampleResponse = await fetch(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: `searchAssets-${Date.now()}`,
              method: 'searchAssets',
              params: {
                ownerAddress: null, // Don't filter by owner
                grouping: [{ group_key: 'collection', group_value: collectionIdentifier }],
                page: 1,
                limit: 5
              }
            })
          });
          
          if (sampleResponse.ok) {
            const sampleData = await sampleResponse.json();
            if (sampleData.result && sampleData.result.items && sampleData.result.items.length > 0) {
              // Use these similar NFTs to estimate price
              const pricePromises = sampleData.result.items.map((item: any) => 
                this.estimateNFTPrice(item.id)
              );
              
              const prices = await Promise.all(pricePromises);
              const validPrices = prices.filter(price => price > 0);
              
              if (validPrices.length > 0) {
                // Calculate average price
                const avgPrice = validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;
                
                const dynamicFallback = {
                  floorPrice: avgPrice,
                  currency: 'SOL',
                  lastUpdated: new Date().toISOString(),
                  source: 'Similar NFTs Average',
                  hasFloorPrice: true,
                  usedRealPrice: true
                };
                
                // Cache the result
                this.priceCache.set(nftAddress, {
                  price: dynamicFallback,
                  timestamp: Date.now()
                });
                
                return dynamicFallback;
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Error in dynamic fallback price estimation:`, error);
        // Continue to basic fallback
      }
      
      // Final fallback with lower price to indicate uncertainty
      const basicFallback = {
        floorPrice: 0.001, // Very low estimate to indicate high uncertainty in error case
        currency: 'SOL',
        lastUpdated: new Date().toISOString(),
        source: 'Error Fallback - No Data Available',
        hasFloorPrice: false,
        usedRealPrice: false
      };
      
      // Cache the fallback result
      this.priceCache.set(nftAddress, {
        price: basicFallback,
        timestamp: Date.now() - (4 * 60 * 1000) // Set shorter TTL by making timestamp slightly older
      });
      
      return basicFallback;
    } catch (error) {
      this.logger.error(`Error getting NFT price estimate for ${nftAddress}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return a default value on error
      return {
        floorPrice: 0.001, // Very low estimate to indicate high uncertainty in error case
        currency: 'SOL',
        lastUpdated: new Date().toISOString(),
        source: 'Error Fallback - No Data Available',
        hasFloorPrice: false,
        usedRealPrice: false
      };
    }
  }

  private canUseAlpha(collectionAddress: string, normalizedName: string): boolean {
    // Alpha works best with slugs rather than full addresses
    return collectionAddress.length < 30 || normalizedName !== collectionAddress;
  }

  // Support backward compatibility with static getInstance
  /**
   * @deprecated Use dependency injection instead
   */
  public static getInstance(): NFTPricingService {
    console.warn('NFTPricingService.getInstance() is deprecated. Use dependency injection instead.');
    
    try {
      // Try to dynamically import the container
      const { container } = require("../../di-container");
      return container.resolve(NFTPricingService);
    } catch (error) {
      // Fallback if container is not available yet
      console.error('DI container not available, creating temporary instance. This is not recommended for production.');
      const tempHelius = new Helius(process.env.HELIUS_API_KEY || '');
      
      // Create a simple logger that wraps console
      const simpleLogger = {
        createLogger: () => console
      };
      
      return new NFTPricingService(simpleLogger as any, tempHelius);
    }
  }
} 