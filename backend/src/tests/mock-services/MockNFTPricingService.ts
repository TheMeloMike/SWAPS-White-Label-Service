import { LoggingService } from '../../utils/logging/LoggingService';

/**
 * Mock NFT Pricing Service for tests - simplified version
 * Marked as deprecated - use MockPricingService instead
 */
export class MockNFTPricingService {
  private logger = LoggingService.getInstance().createLogger('MockNFTPricingService');
  private static instance: MockNFTPricingService;
  
  // Cache to keep prices consistent between calls
  private priceCache = new Map<string, number>();
  
  private constructor() {
    this.logger.info('MockNFTPricingService initialized (DEPRECATED - use MockPricingService)');
  }
  
  public static getInstance(): MockNFTPricingService {
    if (!MockNFTPricingService.instance) {
      MockNFTPricingService.instance = new MockNFTPricingService();
    }
    return MockNFTPricingService.instance;
  }
  
  /**
   * Reset the mock instance (useful for tests)
   */
  public static resetInstance(): void {
    MockNFTPricingService.instance = new MockNFTPricingService();
  }
  
  /**
   * Get price for an NFT without making real API calls
   */
  public async getPrice(nftAddress: string): Promise<number> {
    return 1.0; // Return a default value
  }
  
  /**
   * Get prices for multiple NFTs at once
   */
  public async getPricesBatch(nftAddresses: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    for (const address of nftAddresses) {
      prices.set(address, 1.0);
    }
    return prices;
  }
} 