import axios from 'axios';
import { Helius } from 'helius-sdk';

/**
 * Service for retrieving NFT pricing data from real market sources
 */
export class NFTPricingService {
  private static instance: NFTPricingService;
  private helius: Helius;
  private averageFloorPrice: number = 1.0; // Default 1 SOL
  private lastUpdated: Date = new Date();
  private updateIntervalMs: number = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
      throw new Error('HELIUS_API_KEY environment variable is required');
    }
    this.helius = new Helius(apiKey);
    this.scheduleFloorPriceUpdate();
  }

  public static getInstance(): NFTPricingService {
    if (!NFTPricingService.instance) {
      NFTPricingService.instance = new NFTPricingService();
    }
    return NFTPricingService.instance;
  }

  /**
   * Get the most recent average floor price across popular collections
   */
  public getAveragePriceEstimate(): number {
    // Update the price if it's stale
    const now = new Date();
    if (now.getTime() - this.lastUpdated.getTime() > this.updateIntervalMs) {
      this.updateFloorPrices();
    }
    return this.averageFloorPrice;
  }

  /**
   * Get price estimate for a specific NFT by mint address
   * @param mintAddress The NFT mint address
   */
  public async getNFTPriceEstimate(mintAddress: string): Promise<number> {
    try {
      // Get the NFT metadata including collection info
      const assetData = await this.helius.rpc.getAsset({
        id: mintAddress
      });

      if (!assetData) {
        return this.averageFloorPrice; // Fall back to average if no data
      }

      // If we have collection data, try to get its floor price
      if (assetData.grouping && assetData.grouping.length > 0) {
        const collectionId = assetData.grouping.find(
          g => g.group_key === 'collection'
        )?.group_value;

        if (collectionId) {
          return await this.getCollectionFloorPrice(collectionId);
        }
      }

      // If we get here, use average floor price
      return this.averageFloorPrice;
    } catch (error) {
      console.error(`Error estimating price for NFT ${mintAddress}:`, error);
      return this.averageFloorPrice;
    }
  }

  /**
   * Update floor prices across multiple collections
   */
  private async updateFloorPrices(): Promise<void> {
    try {
      // Get popular collections (this would use a real API in production)
      const popularCollections = [
        'Solana Monkey Business',
        'DeGods',
        'Okay Bears',
        'y00ts',
        'Claynosaurz'
      ];

      // Collect floor prices
      const floorPrices: number[] = [];

      // Using Magic Eden API to get collection floors
      const apiUrl = 'https://api-mainnet.magiceden.dev/v2/collections';
      
      for (const collection of popularCollections) {
        try {
          const response = await axios.get(`${apiUrl}/${encodeURIComponent(collection)}/stats`);
          if (response.data && response.data.floorPrice) {
            // Convert from lamports to SOL
            const floorPriceInSol = response.data.floorPrice / 1_000_000_000;
            floorPrices.push(floorPriceInSol);
          }
        } catch (error) {
          console.warn(`Error fetching floor price for ${collection}:`, error);
        }
      }

      // Calculate average if we got any prices
      if (floorPrices.length > 0) {
        const sum = floorPrices.reduce((acc, price) => acc + price, 0);
        this.averageFloorPrice = sum / floorPrices.length;
      }

      // Update the timestamp
      this.lastUpdated = new Date();
      
      console.log(`Updated average floor price: ${this.averageFloorPrice} SOL`);
    } catch (error) {
      console.error('Error updating floor prices:', error);
    }
  }

  /**
   * Schedule periodic updates of floor prices
   */
  private scheduleFloorPriceUpdate(): void {
    // Initial update
    this.updateFloorPrices();
    
    // Schedule regular updates
    setInterval(() => {
      this.updateFloorPrices();
    }, this.updateIntervalMs);
  }

  /**
   * Get floor price for a specific collection
   */
  private async getCollectionFloorPrice(collectionId: string): Promise<number> {
    try {
      // Use Magic Eden API to get collection floor
      const apiUrl = 'https://api-mainnet.magiceden.dev/v2/collections';
      
      const response = await axios.get(`${apiUrl}/${encodeURIComponent(collectionId)}/stats`);
      
      if (response.data && response.data.floorPrice) {
        // Convert from lamports to SOL
        return response.data.floorPrice / 1_000_000_000;
      }
      
      // Fall back to average
      return this.averageFloorPrice;
    } catch (error) {
      console.warn(`Error fetching floor price for collection ${collectionId}:`, error);
      return this.averageFloorPrice;
    }
  }
} 