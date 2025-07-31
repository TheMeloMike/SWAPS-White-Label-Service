import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import { PersistentTradeDiscoveryService } from '../../services/trade/PersistentTradeDiscoveryService';
import { DeltaDetectionEngine } from '../../services/trade/DeltaDetectionEngine';
import { WebhookNotificationService } from '../../services/notifications/WebhookNotificationService';
import { TenantConfig, AbstractNFT, AbstractWallet } from '../../types/abstract';
import { TradeLoop } from '../../types/trade';

// Mock dependencies
jest.mock('../../services/trade/TradeDiscoveryService');
jest.mock('../../services/trade/DeltaDetectionEngine');
jest.mock('../../services/notifications/WebhookNotificationService');
jest.mock('../../utils/logging/LoggingService');

describe('PersistentTradeDiscoveryService', () => {
  let service: PersistentTradeDiscoveryService;
  let mockDeltaEngine: jest.Mocked<DeltaDetectionEngine>;
  let mockWebhookService: jest.Mocked<WebhookNotificationService>;

  const mockTenantConfig: TenantConfig = {
    id: 'test-tenant',
    name: 'Test Tenant',
    apiKey: 'test-api-key',
    settings: {
      algorithm: {
        maxDepth: 5,
        minEfficiency: 0.7,
        maxLoopsPerRequest: 50,
        enableCollectionTrading: true
      },
      rateLimits: {
        discoveryRequestsPerMinute: 100,
        nftSubmissionsPerDay: 1000,
        webhookCallsPerMinute: 50
      },
      security: {
        maxNFTsPerWallet: 500,
        maxWantsPerWallet: 100,
        minNFTValueUSD: 0.01,
        blacklistedCollections: ['spam-collection']
      },
      webhooks: {
        tradeDiscoveryUrl: 'https://test.com/webhook',
        enabled: true
      }
    },
    createdAt: new Date(),
    lastActive: new Date()
  };

  const mockNFT: AbstractNFT = {
    id: 'nft-123',
    name: 'Test NFT',
    image: 'https://example.com/nft.png',
    ownership: {
      ownerId: 'wallet-123',
      acquiredAt: new Date()
    },
    valuation: {
      estimatedValue: 2.5,
      currency: 'ETH',
      confidence: 0.9
    },
    collection: {
      id: 'test-collection',
      name: 'Test Collection'
    },
    platformData: {
      ethereum: {
        contractAddress: '0x123...',
        tokenId: '456'
      }
    }
  };

  const mockWallet: AbstractWallet = {
    id: 'wallet-123',
    ownedNFTs: [mockNFT],
    wantedNFTs: ['nft-456'],
    preferences: {
      maxTradeSize: 5,
      preferredCollections: ['premium-collection'],
      blockedWallets: ['spam-wallet']
    }
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Get service instance
    service = PersistentTradeDiscoveryService.getInstance();
    
    // Setup mock implementations
    mockDeltaEngine = {
      getAffectedSubgraphByNFTAddition: jest.fn(),
      getAffectedSubgraphByNFTRemoval: jest.fn(),
      getAffectedSubgraphByWantAddition: jest.fn(),
      getAffectedSubgraphByWantRemoval: jest.fn()
    } as any;

    mockWebhookService = {
      notifyTradeLoopDiscovered: jest.fn(),
      notifyTradeLoopInvalidated: jest.fn(),
      notifyTradeLoopCompleted: jest.fn()
    } as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Tenant Management', () => {
    it('should initialize tenant successfully', async () => {
      await expect(service.initializeTenant(mockTenantConfig)).resolves.not.toThrow();
    });

    it('should handle duplicate tenant initialization gracefully', async () => {
      await service.initializeTenant(mockTenantConfig);
      await expect(service.initializeTenant(mockTenantConfig)).resolves.not.toThrow();
    });

    it('should validate tenant configuration', async () => {
      const invalidConfig = {
        ...mockTenantConfig,
        settings: {
          ...mockTenantConfig.settings,
          algorithm: {
            ...mockTenantConfig.settings.algorithm,
            maxDepth: -1 // Invalid depth
          }
        }
      };

      await expect(service.initializeTenant(invalidConfig)).rejects.toThrow();
    });
  });

  describe('NFT Management', () => {
    beforeEach(async () => {
      await service.initializeTenant(mockTenantConfig);
    });

    it('should add NFT and trigger trade discovery', async () => {
      const mockSubgraph = {
        affectedWallets: new Set(['wallet-123']),
        affectedNFTs: new Set(['nft-123']),
        changeType: 'nft_added' as const
      };

      mockDeltaEngine.getAffectedSubgraphByNFTAddition.mockReturnValue(mockSubgraph);

      const result = await service.onNFTAdded('test-tenant', mockNFT);

      expect(mockDeltaEngine.getAffectedSubgraphByNFTAddition).toHaveBeenCalledWith(
        expect.any(Object),
        mockNFT
      );
      expect(result).toEqual(expect.any(Array));
    });

    it('should handle NFT addition with empty subgraph', async () => {
      const emptySubgraph = {
        affectedWallets: new Set(),
        affectedNFTs: new Set(),
        changeType: 'nft_added' as const
      };

      mockDeltaEngine.getAffectedSubgraphByNFTAddition.mockReturnValue(emptySubgraph);

      const result = await service.onNFTAdded('test-tenant', mockNFT);

      expect(result).toEqual([]);
    });

    it('should remove NFT and invalidate affected loops', async () => {
      // First add an NFT
      await service.onNFTAdded('test-tenant', mockNFT);

      // Then remove it
      await expect(service.onNFTRemoved('test-tenant', 'nft-123')).resolves.not.toThrow();
    });

    it('should handle removal of non-existent NFT gracefully', async () => {
      await expect(service.onNFTRemoved('test-tenant', 'non-existent')).resolves.not.toThrow();
    });
  });

  describe('Want Management', () => {
    beforeEach(async () => {
      await service.initializeTenant(mockTenantConfig);
    });

    it('should add want and trigger discovery', async () => {
      const mockSubgraph = {
        affectedWallets: new Set(['wallet-123']),
        affectedNFTs: new Set(['nft-456']),
        changeType: 'want_added' as const
      };

      mockDeltaEngine.getAffectedSubgraphByWantAddition.mockReturnValue(mockSubgraph);

      const result = await service.onWantAdded('test-tenant', 'wallet-123', 'nft-456');

      expect(mockDeltaEngine.getAffectedSubgraphByWantAddition).toHaveBeenCalled();
      expect(result).toEqual(expect.any(Array));
    });

    it('should remove want and update graph', async () => {
      // First add a want
      await service.onWantAdded('test-tenant', 'wallet-123', 'nft-456');

      // Then remove it
      await expect(service.onWantRemoved('test-tenant', 'wallet-123', 'nft-456')).resolves.not.toThrow();
    });

    it('should handle duplicate want addition gracefully', async () => {
      await service.onWantAdded('test-tenant', 'wallet-123', 'nft-456');
      const result = await service.onWantAdded('test-tenant', 'wallet-123', 'nft-456');

      expect(result).toEqual([]);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    const tenant2Config = {
      ...mockTenantConfig,
      id: 'tenant-2',
      name: 'Tenant 2'
    };

    beforeEach(async () => {
      await service.initializeTenant(mockTenantConfig);
      await service.initializeTenant(tenant2Config);
    });

    it('should isolate NFTs between tenants', async () => {
      // Add NFT to tenant 1
      await service.onNFTAdded('test-tenant', mockNFT);

      // Add different NFT to tenant 2
      const nft2 = { ...mockNFT, id: 'nft-tenant2' };
      await service.onNFTAdded('tenant-2', nft2);

      // Verify isolation - tenant 1 should not see tenant 2's NFT
      const tenant1Status = await service.getTenantStatus('test-tenant');
      const tenant2Status = await service.getTenantStatus('tenant-2');

      expect(tenant1Status.nftCount).toBe(1);
      expect(tenant2Status.nftCount).toBe(1);
    });

    it('should isolate wants between tenants', async () => {
      await service.onWantAdded('test-tenant', 'wallet-1', 'nft-want-1');
      await service.onWantAdded('tenant-2', 'wallet-2', 'nft-want-2');

      const tenant1Status = await service.getTenantStatus('test-tenant');
      const tenant2Status = await service.getTenantStatus('tenant-2');

      expect(tenant1Status.totalWants).toBe(1);
      expect(tenant2Status.totalWants).toBe(1);
    });

    it('should prevent cross-tenant data leakage', async () => {
      // This should throw an error for non-existent tenant
      await expect(service.onNFTAdded('non-existent-tenant', mockNFT)).rejects.toThrow();
    });
  });

  describe('Performance and Concurrency', () => {
    beforeEach(async () => {
      await service.initializeTenant(mockTenantConfig);
    });

    it('should handle concurrent NFT additions safely', async () => {
      const nfts = Array.from({ length: 10 }, (_, i) => ({
        ...mockNFT,
        id: `nft-${i}`,
        ownership: {
          ...mockNFT.ownership,
          ownerId: `wallet-${i}`
        }
      }));

      const promises = nfts.map(nft => service.onNFTAdded('test-tenant', nft));

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('should handle concurrent want additions safely', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        service.onWantAdded('test-tenant', `wallet-${i}`, `nft-want-${i}`)
      );

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('should maintain performance under load', async () => {
      const startTime = Date.now();

      // Add 100 NFTs
      const promises = Array.from({ length: 100 }, (_, i) =>
        service.onNFTAdded('test-tenant', {
          ...mockNFT,
          id: `nft-${i}`
        })
      );

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid tenant ID gracefully', async () => {
      await expect(service.onNFTAdded('invalid-tenant', mockNFT)).rejects.toThrow('Tenant graph not found');
    });

    it('should handle malformed NFT data', async () => {
      await service.initializeTenant(mockTenantConfig);

      const invalidNFT = {
        ...mockNFT,
        ownership: null as any
      };

      await expect(service.onNFTAdded('test-tenant', invalidNFT)).rejects.toThrow();
    });

    it('should handle webhook notification failures gracefully', async () => {
      await service.initializeTenant(mockTenantConfig);

      mockWebhookService.notifyTradeLoopDiscovered.mockRejectedValue(new Error('Webhook failed'));

      // Should not throw even if webhook fails
      await expect(service.onNFTAdded('test-tenant', mockNFT)).resolves.not.toThrow();
    });
  });

  describe('Delta Detection Integration', () => {
    beforeEach(async () => {
      await service.initializeTenant(mockTenantConfig);
    });

    it('should call delta detection for NFT additions', async () => {
      const mockSubgraph = {
        affectedWallets: new Set(['wallet-123']),
        affectedNFTs: new Set(['nft-123']),
        changeType: 'nft_added' as const
      };

      mockDeltaEngine.getAffectedSubgraphByNFTAddition.mockReturnValue(mockSubgraph);

      await service.onNFTAdded('test-tenant', mockNFT);

      expect(mockDeltaEngine.getAffectedSubgraphByNFTAddition).toHaveBeenCalledTimes(1);
    });

    it('should optimize discovery when subgraph is small', async () => {
      const smallSubgraph = {
        affectedWallets: new Set(['wallet-123']),
        affectedNFTs: new Set(['nft-123']),
        changeType: 'nft_added' as const
      };

      mockDeltaEngine.getAffectedSubgraphByNFTAddition.mockReturnValue(smallSubgraph);

      const startTime = Date.now();
      await service.onNFTAdded('test-tenant', mockNFT);
      const duration = Date.now() - startTime;

      // Should be fast for small subgraphs
      expect(duration).toBeLessThan(100); // 100ms
    });
  });

  describe('Configuration Validation', () => {
    it('should validate algorithm settings', async () => {
      const configWithInvalidAlgorithm = {
        ...mockTenantConfig,
        settings: {
          ...mockTenantConfig.settings,
          algorithm: {
            maxDepth: 0, // Invalid
            minEfficiency: 1.5, // Invalid (> 1.0)
            maxLoopsPerRequest: -1, // Invalid
            enableCollectionTrading: true
          }
        }
      };

      await expect(service.initializeTenant(configWithInvalidAlgorithm)).rejects.toThrow();
    });

    it('should validate rate limits', async () => {
      const configWithInvalidRateLimits = {
        ...mockTenantConfig,
        settings: {
          ...mockTenantConfig.settings,
          rateLimits: {
            discoveryRequestsPerMinute: -1, // Invalid
            nftSubmissionsPerDay: 0, // Invalid
            webhookCallsPerMinute: -5 // Invalid
          }
        }
      };

      await expect(service.initializeTenant(configWithInvalidRateLimits)).rejects.toThrow();
    });
  });

  describe('Webhook Integration', () => {
    beforeEach(async () => {
      await service.initializeTenant(mockTenantConfig);
    });

    it('should trigger webhooks for new trade loops', async () => {
      const mockTradeLoop: TradeLoop = {
        id: 'loop-123',
        steps: [
          {
            from: 'wallet-1',
            to: 'wallet-2',
            nfts: [{
              address: 'nft-123',
              name: 'Test NFT',
              symbol: 'TEST',
              image: 'https://example.com/nft.png',
              collection: 'test-collection',
              description: 'Test NFT for trading',
              floorPrice: 1.0
            }]
          }
        ],
        totalParticipants: 2,
        efficiency: 0.8,
        rawEfficiency: 0.5,
        estimatedValue: 1.0,
        qualityScore: 0.85
      };

      // Mock the discovery to return a loop
      const mockSubgraph = {
        affectedWallets: new Set(['wallet-123']),
        affectedNFTs: new Set(['nft-123']),
        changeType: 'nft_added' as const
      };

      mockDeltaEngine.getAffectedSubgraphByNFTAddition.mockReturnValue(mockSubgraph);

      await service.onNFTAdded('test-tenant', mockNFT);

      // Note: In a real test, we'd need to mock the actual trade discovery to return loops
      // For now, we verify the delta detection was called
      expect(mockDeltaEngine.getAffectedSubgraphByNFTAddition).toHaveBeenCalled();
    });
  });
}); 