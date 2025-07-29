import { SmartCollectionExpansionService } from '../services/trade/SmartCollectionExpansionService';
import { LocalCollectionService } from '../services/nft/LocalCollectionService';
import { NFTPricingService } from '../services/nft/NFTPricingService';

// Mock the dependencies
jest.mock('../services/nft/LocalCollectionService');
jest.mock('../services/nft/NFTPricingService');
jest.mock('../utils/logging/LoggingService', () => ({
  LoggingService: {
    getInstance: () => ({
      createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        operation: () => ({
          info: jest.fn(),
          error: jest.fn(),
          end: jest.fn()
        })
      })
    })
  }
}));

describe('SmartCollectionExpansionService', () => {
  let service: SmartCollectionExpansionService;
  let mockLocalCollectionService: jest.Mocked<LocalCollectionService>;
  let mockPricingService: jest.Mocked<NFTPricingService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton instance
    (SmartCollectionExpansionService as any).instance = undefined;
    
    mockLocalCollectionService = LocalCollectionService.getInstance() as jest.Mocked<LocalCollectionService>;
    mockPricingService = NFTPricingService.getInstance() as jest.Mocked<NFTPricingService>;
    
    service = SmartCollectionExpansionService.getInstance();
  });

  describe('Small Collections', () => {
    it('should use full expansion for collections smaller than max sample size', async () => {
      const collectionId = 'small-collection';
      const nfts = Array.from({ length: 50 }, (_, i) => `nft-${i}`);
      
      mockLocalCollectionService.getCollectionMetadata.mockReturnValue({
        id: collectionId,
        name: 'Small Collection',
        nftCount: 50,
        floorPrice: 1,
        verified: true,
        volume24h: 100,
        totalSupply: 50,
        sources: ['test'],
        lastUpdated: new Date()
      });
      
      mockLocalCollectionService.getNFTsInCollection.mockResolvedValue(nfts);
      
      const result = await service.expandCollection(collectionId);
      
      expect(result.strategy.strategyType).toBe('full');
      expect(result.sampledNFTs).toHaveLength(50);
      expect(result.sampledNFTs).toEqual(nfts);
      expect(result.confidence).toBe(1.0);
    });
  });

  describe('Large Collections', () => {
    it('should use stratified sampling for large verified collections with price data', async () => {
      const collectionId = 'large-verified-collection';
      const nfts = Array.from({ length: 10000 }, (_, i) => `nft-${i}`);
      
      mockLocalCollectionService.getCollectionMetadata.mockReturnValue({
        id: collectionId,
        name: 'Large Verified Collection',
        nftCount: 10000,
        floorPrice: 5,
        verified: true,
        volume24h: 1000,
        totalSupply: 10000,
        sources: ['test'],
        lastUpdated: new Date()
      });
      
      mockLocalCollectionService.getNFTsInCollection.mockResolvedValue(nfts);
      
      // Mock pricing for first 500 NFTs
      mockPricingService.estimateNFTPrice.mockImplementation(async (nft: string) => {
        const index = parseInt(nft.split('-')[1]);
        if (index < 500) {
          // Create price distribution
          return 5 + (index / 100); // Prices from 5 to 10 SOL
        }
        throw new Error('No price data');
      });
      
      const result = await service.expandCollection(collectionId, undefined, {
        maxSampleSize: 100
      });
      
      expect(result.strategy.strategyType).toBe('stratified');
      expect(result.sampledNFTs).toHaveLength(100);
      expect(result.confidence).toBe(0.85);
      expect(result.stratification).toBeDefined();
      expect(result.stratification).toHaveLength(4); // 4 price tiers
      
      // Verify stratification
      const tiers = result.stratification!;
      expect(tiers[0].tier).toBe('floor');
      expect(tiers[1].tier).toBe('mid');
      expect(tiers[2].tier).toBe('rare');
      expect(tiers[3].tier).toBe('grail');
      
      // Each tier should have roughly equal samples
      tiers.forEach(tier => {
        expect(tier.sampleSize).toBeGreaterThan(20);
        expect(tier.sampleSize).toBeLessThan(30);
      });
    });

    it('should fall back to random sampling when insufficient price data', async () => {
      const collectionId = 'large-no-price-collection';
      const nfts = Array.from({ length: 5000 }, (_, i) => `nft-${i}`);
      
      mockLocalCollectionService.getCollectionMetadata.mockReturnValue({
        id: collectionId,
        name: 'Large No Price Collection',
        nftCount: 5000,
        floorPrice: 0,
        verified: true,
        volume24h: 0,
        totalSupply: 5000,
        sources: ['test'],
        lastUpdated: new Date()
      });
      
      mockLocalCollectionService.getNFTsInCollection.mockResolvedValue(nfts);
      
      // Mock no price data
      mockPricingService.estimateNFTPrice.mockRejectedValue(new Error('No price data'));
      
      const result = await service.expandCollection(collectionId, undefined, {
        maxSampleSize: 100
      });
      
      expect(result.strategy.strategyType).toBe('stratified'); // Initially tries stratified
      expect(result.sampledNFTs).toHaveLength(100);
      expect(result.confidence).toBe(0.7); // Falls back to random sampling confidence
    });

    it('should use adaptive sampling for unverified large collections', async () => {
      const collectionId = 'large-unverified-collection';
      const nfts = Array.from({ length: 8000 }, (_, i) => `nft-${i}`);
      const ownership = new Map<string, string>();
      
      // Simulate 20% of NFTs being owned by active traders
      nfts.forEach((nft, i) => {
        if (i % 5 === 0) {
          ownership.set(nft, `wallet-${i % 100}`);
        }
      });
      
      mockLocalCollectionService.getCollectionMetadata.mockReturnValue({
        id: collectionId,
        name: 'Large Unverified Collection',
        nftCount: 8000,
        floorPrice: 0,
        verified: false,
        volume24h: 0,
        totalSupply: 8000,
        sources: ['test'],
        lastUpdated: new Date()
      });
      
      mockLocalCollectionService.getNFTsInCollection.mockResolvedValue(nfts);
      
      const result = await service.expandCollection(collectionId, ownership, {
        maxSampleSize: 100
      });
      
      expect(result.strategy.strategyType).toBe('adaptive');
      expect(result.sampledNFTs).toHaveLength(100);
      expect(result.confidence).toBe(0.75);
    });
  });

  describe('Graph Explosion Prevention', () => {
    it('should never expand more than maxSampleSize NFTs', async () => {
      const collectionId = 'massive-collection';
      const nfts = Array.from({ length: 50000 }, (_, i) => `nft-${i}`);
      
      mockLocalCollectionService.getCollectionMetadata.mockReturnValue({
        id: collectionId,
        name: 'Massive Collection',
        nftCount: 50000,
        floorPrice: 10,
        verified: true,
        volume24h: 10000,
        totalSupply: 50000,
        sources: ['test'],
        lastUpdated: new Date()
      });
      
      mockLocalCollectionService.getNFTsInCollection.mockResolvedValue(nfts);
      
      // Test with different max sample sizes
      const testCases = [50, 100, 200, 500];
      
      for (const maxSize of testCases) {
        const result = await service.expandCollection(collectionId, undefined, {
          maxSampleSize: maxSize
        });
        
        expect(result.sampledNFTs.length).toBeLessThanOrEqual(maxSize);
        expect(result.totalNFTs).toBe(50000);
        
        // Calculate reduction ratio
        const reduction = (1 - result.sampledNFTs.length / result.totalNFTs) * 100;
        expect(reduction).toBeGreaterThan(99); // Should reduce by >99%
      }
    });
  });

  describe('Reservoir Sampling', () => {
    it('should provide fair random sampling', async () => {
      const collectionId = 'test-reservoir';
      const nfts = Array.from({ length: 1000 }, (_, i) => `nft-${i}`);
      
      mockLocalCollectionService.getCollectionMetadata.mockReturnValue({
        id: collectionId,
        name: 'Test Reservoir',
        nftCount: 1000,
        floorPrice: 1,
        verified: false,
        volume24h: 100,
        totalSupply: 1000,
        sources: ['test'],
        lastUpdated: new Date()
      });
      
      mockLocalCollectionService.getNFTsInCollection.mockResolvedValue(nfts);
      
      // Run multiple samples to check distribution
      const sampleCounts = new Map<string, number>();
      const iterations = 100;
      const sampleSize = 10;
      
      for (let i = 0; i < iterations; i++) {
        const result = await service.expandCollection(collectionId, undefined, {
          maxSampleSize: sampleSize
        });
        
        result.sampledNFTs.forEach(nft => {
          sampleCounts.set(nft, (sampleCounts.get(nft) || 0) + 1);
        });
      }
      
      // Each NFT should have roughly equal chance of being selected
      const expectedCount = (iterations * sampleSize) / nfts.length;
      const tolerance = expectedCount * 0.5; // 50% tolerance
      
      let withinTolerance = 0;
      sampleCounts.forEach(count => {
        if (Math.abs(count - expectedCount) <= tolerance) {
          withinTolerance++;
        }
      });
      
      // At least 80% should be within tolerance
      expect(withinTolerance / sampleCounts.size).toBeGreaterThan(0.8);
    });
  });

  describe('Caching', () => {
    it('should cache expansion strategies', async () => {
      const collectionId = 'cached-collection';
      const nfts = Array.from({ length: 100 }, (_, i) => `nft-${i}`);
      
      mockLocalCollectionService.getCollectionMetadata.mockReturnValue({
        id: collectionId,
        name: 'Cached Collection',
        nftCount: 100,
        floorPrice: 1,
        verified: true,
        volume24h: 100,
        totalSupply: 100,
        sources: ['test'],
        lastUpdated: new Date()
      });
      
      mockLocalCollectionService.getNFTsInCollection.mockResolvedValue(nfts);
      
      // First call
      await service.expandCollection(collectionId);
      expect(mockLocalCollectionService.getCollectionMetadata).toHaveBeenCalledTimes(1);
      
      // Second call should use cached strategy
      await service.expandCollection(collectionId);
      expect(mockLocalCollectionService.getCollectionMetadata).toHaveBeenCalledTimes(1);
      
      // Clear cache
      service.clearCache();
      
      // Third call should fetch metadata again
      await service.expandCollection(collectionId);
      expect(mockLocalCollectionService.getCollectionMetadata).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing collection metadata', async () => {
      mockLocalCollectionService.getCollectionMetadata.mockReturnValue(null);
      
      await expect(service.expandCollection('non-existent')).rejects.toThrow(
        'Collection non-existent not found'
      );
    });

    it('should handle NFT fetching errors', async () => {
      const collectionId = 'error-collection';
      
      mockLocalCollectionService.getCollectionMetadata.mockReturnValue({
        id: collectionId,
        name: 'Error Collection',
        nftCount: 100,
        floorPrice: 1,
        verified: true,
        volume24h: 100,
        totalSupply: 100,
        sources: ['test'],
        lastUpdated: new Date()
      });
      
      mockLocalCollectionService.getNFTsInCollection.mockRejectedValue(
        new Error('Failed to fetch NFTs')
      );
      
      await expect(service.expandCollection(collectionId)).rejects.toThrow(
        'Failed to fetch NFTs'
      );
    });
  });
}); 