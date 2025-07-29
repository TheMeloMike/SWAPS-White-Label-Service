import { LoggingService } from '../../utils/logging/LoggingService';

/**
 * Mock NFT Service for tests
 * Returns synthetic NFT metadata instead of making real API calls
 */
export class MockNFTService {
  private logger = LoggingService.getInstance().createLogger('MockNFTService');
  private static instance: MockNFTService;
  
  // Collection names for mock data
  private collections = [
    'Pixel Punks',
    'Bored Monkeys',
    'Crypto Kitties',
    'Degenerate Apes',
    'Cool Cats',
    'Moon Birds',
    'Azuki Beans',
    'Solana Wizards',
    'Doodle People',
    'Okay Bears'
  ];
  
  // Cache to keep metadata consistent between calls
  private metadataCache = new Map<string, any>();
  
  // Cache statistics for testing
  private cacheStats = {
    hits: 0,
    misses: 0,
    generated: 0
  };
  
  private constructor() {
    this.logger.info('MockNFTService initialized');
  }
  
  public static getInstance(): MockNFTService {
    if (!MockNFTService.instance) {
      MockNFTService.instance = new MockNFTService();
    }
    return MockNFTService.instance;
  }
  
  /**
   * Reset the mock instance (useful for tests)
   */
  public static resetInstance(): void {
    MockNFTService.instance = new MockNFTService();
  }
  
  /**
   * Get detailed metadata for an NFT
   */
  async getNFTMetadata(nftAddress: string): Promise<any> {
    // For test NFTs with simple names like nft_A, nft_B, etc., create synthetic metadata
    if (nftAddress.startsWith('nft_')) {
      const name = nftAddress.toUpperCase();
      const label = name.charAt(4);
      // Create specific collections for different NFT ranges to test collection-based matching
      let collection = 'Test Collection';
      
      // Group NFTs into collections based on their labels
      if ('ABCDE'.includes(label)) {
        collection = 'Alpha Collection';
      } else if ('FGHIJK'.includes(label)) {
        collection = 'Beta Collection';
      }
      
      return {
        address: nftAddress,
        name,
        symbol: `NFT${label}`,
        image: `https://example.com/image/${nftAddress}.png`,
        collection,
        description: `Test NFT ${name} for multi-party trade testing`,
        attributes: []
      };
    }
    
    // For other NFTs, use the cache if available
    if (this.metadataCache.has(nftAddress)) {
      this.cacheStats.hits++;
      return this.metadataCache.get(nftAddress);
    }
    
    this.cacheStats.misses++;
    
    // Generate synthetic metadata for testing
    const metadata = this.generateRandomMetadata(nftAddress);
    
    // Cache the result
    this.metadataCache.set(nftAddress, metadata);
    this.cacheStats.generated++;
    
    return metadata;
  }
  
  /**
   * Generate random metadata for an NFT
   */
  private generateRandomMetadata(nftAddress: string): any {
    // Generate deterministic but pseudo-random metadata based on NFT address
    const addressSum = nftAddress.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    
    // Use address hash to determine properties
    const collectionIndex = addressSum % this.collections.length;
    const collection = this.collections[collectionIndex];
    
    // Generate a token ID based on the address
    const tokenId = (addressSum % 10000).toString().padStart(4, '0');
    
    // Create mock metadata
    return {
      address: nftAddress,
      name: `${collection} #${tokenId}`,
      symbol: collection.split(' ').map(word => word[0]).join(''),
      image: `https://example.com/nft/${nftAddress}.png`,
      collection: collection,
      description: `A ${collection} NFT with token ID ${tokenId}`,
      attributes: [
        { trait_type: 'Rarity', value: this.getRarityForNFT(nftAddress) },
        { trait_type: 'Series', value: `Series ${Math.floor(addressSum % 5) + 1}` }
      ]
    };
  }
  
  /**
   * Get NFT rarity based on address characteristics
   */
  private getRarityForNFT(nftAddress: string): string {
    // Use last characters of address to determine rarity
    const lastTwoChars = nftAddress.substring(nftAddress.length - 2);
    const rarityValue = parseInt(lastTwoChars, 36);
    
    // Create rarity tiers
    if (rarityValue % 100 < 5) {
      return 'Legendary';
    } else if (rarityValue % 100 < 15) {
      return 'Epic';
    } else if (rarityValue % 100 < 30) {
      return 'Rare';
    } else if (rarityValue % 100 < 50) {
      return 'Uncommon';
    } else {
      return 'Common';
    }
  }
  
  /**
   * Get multiple NFTs at once
   */
  async getNFTsForWallet(walletAddress: string): Promise<string[]> {
    // For testing, generate a deterministic list of NFTs based on wallet address
    const addressSum = walletAddress.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const numNfts = (addressSum % 10) + 1; // 1-10 NFTs per wallet
    
    const nfts = [];
    for (let i = 0; i < numNfts; i++) {
      nfts.push(`${walletAddress}_nft_${i}`);
    }
    
    return nfts;
  }
} 