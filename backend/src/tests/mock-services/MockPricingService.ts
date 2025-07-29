import { LoggingService } from '../../utils/logging/LoggingService';

/**
 * Mock Pricing Service for tests
 * Provides predictable synthetic NFT prices
 */
export class MockPricingService {
  private logger = LoggingService.getInstance().createLogger('MockPricingService');
  private static instance: MockPricingService;
  
  // Store fixed mock prices
  private priceMap = new Map<string, number>();
  private floorPriceMap = new Map<string, number>();
  
  private constructor() {
    this.logger.info('MockPricingService initialized');
  }
  
  public static getInstance(): MockPricingService {
    if (!MockPricingService.instance) {
      MockPricingService.instance = new MockPricingService();
    }
    return MockPricingService.instance;
  }
  
  /**
   * Get a mocked price for an NFT
   * Returns a consistent price based on the NFT address hash
   */
  public async getPrice(nftAddress: string): Promise<number> {
    // Check if we already computed a price for this NFT
    if (this.priceMap.has(nftAddress)) {
      return this.priceMap.get(nftAddress) || 1.0;
    }
    
    // Generate a deterministic price based on NFT address
    // We use a simple hash function to ensure consistency
    const hash = this.simpleHash(nftAddress);
    // Generate a price between 0.5 and 10.0 SOL
    const price = 0.5 + (hash % 95) / 10;
    
    // Store for future reference
    this.priceMap.set(nftAddress, price);
    
    return price;
  }
  
  /**
   * Get a mocked floor price for a collection
   * Returns a consistent floor price based on the collection name hash
   */
  public async getFloorPrice(collectionAddress: string): Promise<number> {
    if (!collectionAddress) return 0.5; // Default floor price
    
    // Check if we already computed a floor price for this collection
    if (this.floorPriceMap.has(collectionAddress)) {
      return this.floorPriceMap.get(collectionAddress) || 0.5;
    }
    
    // Generate a deterministic floor price based on collection address
    const hash = this.simpleHash(collectionAddress);
    // Generate a floor price between 0.1 and 5.0 SOL
    const floorPrice = 0.1 + (hash % 49) / 10;
    
    // Store for future reference
    this.floorPriceMap.set(collectionAddress, floorPrice);
    
    return floorPrice;
  }
  
  /**
   * Get NFT collection ID (mock implementation)
   */
  public getNFTCollectionId(nftAddress: string): string {
    // Just return a fixed collection ID based on the NFT address
    return `collection_${nftAddress.substring(0, 8)}`;
  }
  
  /**
   * Batch get floor prices for multiple collections at once
   */
  public async batchGetFloorPrices(
    collectionAddresses: string[],
    maxConcurrency: number = 5
  ): Promise<Map<string, number>> {
    // Create result map
    const results = new Map<string, number>();
    
    // Process all addresses in one go (no need for real concurrency in mock)
    for (const address of collectionAddresses) {
      const price = await this.getFloorPrice(address);
      results.set(address, price);
    }
    
    return results;
  }
  
  /**
   * Simple string hash function
   * This produces consistent numerical values for strings
   */
  private simpleHash(str: string): number {
    let hash = 0;
    if (str.length === 0) return hash;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash);
  }
} 