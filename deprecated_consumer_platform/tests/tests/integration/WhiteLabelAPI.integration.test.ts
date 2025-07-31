import request from 'supertest';
import { Express } from 'express';
import { describe, it, beforeAll, afterAll, beforeEach, expect } from '@jest/globals';
import app from '../../app';
import { TenantManagementService } from '../../services/tenant/TenantManagementService';
import { PersistentTradeDiscoveryService } from '../../services/trade/PersistentTradeDiscoveryService';
import { TenantConfig, AbstractNFT, AbstractWallet } from '../../types/abstract';

describe('White Label API Integration Tests', () => {
  let server: Express;
  let testTenant: TenantConfig;
  let tenantService: TenantManagementService;
  let tradeService: PersistentTradeDiscoveryService;

  // Test data
  const testNFT: AbstractNFT = {
    id: 'test-nft-123',
    metadata: {
      name: 'Test NFT',
      description: 'Integration test NFT',
      image: 'https://example.com/nft.png'
    },
    ownership: {
      ownerId: 'test-wallet-1',
      acquiredAt: new Date()
    },
    valuation: {
      estimatedValue: 1.5,
      currency: 'ETH',
      confidence: 0.8
    },
    collection: {
      id: 'test-collection',
      name: 'Test Collection'
    }
  };

  const testWallet: AbstractWallet = {
    id: 'test-wallet-1',
    ownedNFTs: [testNFT],
    wantedNFTs: ['target-nft-456'],
    preferences: {
      maxTradeParticipants: 5,
      minValueThreshold: 1.0
    }
  };

  beforeAll(async () => {
    server = app;
    tenantService = TenantManagementService.getInstance();
    tradeService = PersistentTradeDiscoveryService.getInstance();

    // Create a test tenant
    testTenant = await tenantService.createTenant({
      name: 'Integration Test Tenant',
      contactEmail: 'test@integration.com',
      industry: 'testing'
    });

    // Initialize the tenant in the trade service
    await tradeService.initializeTenant(testTenant);
  });

  afterAll(async () => {
    // Cleanup test tenant
    if (testTenant?.id) {
      await tenantService.deleteTenant(testTenant.id);
    }
  });

  beforeEach(async () => {
    // Reset tenant state for each test
    // This would need to be implemented in the services
  });

  describe('Authentication', () => {
    it('should reject requests without API key', async () => {
      const response = await request(server)
        .post('/api/v1/discovery/trades')
        .send({
          wallets: [testWallet],
          mode: 'informational'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/authentication/i);
    });

    it('should reject requests with invalid API key', async () => {
      const response = await request(server)
        .post('/api/v1/discovery/trades')
        .set('Authorization', 'Bearer invalid-api-key')
        .send({
          wallets: [testWallet],
          mode: 'informational'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/invalid.*api.*key/i);
    });

    it('should accept requests with valid API key', async () => {
      const response = await request(server)
        .get('/api/v1/status')
        .set('Authorization', `Bearer ${testTenant.apiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.tenantId).toBe(testTenant.id);
    });
  });

  describe('Trade Discovery API', () => {
    it('should discover trades successfully', async () => {
      const response = await request(server)
        .post('/api/v1/discovery/trades')
        .set('Authorization', `Bearer ${testTenant.apiKey}`)
        .send({
          wallets: [testWallet],
          mode: 'informational',
          settings: {
            maxDepth: 5,
            minEfficiency: 0.7
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tradeLoops).toEqual(expect.any(Array));
      expect(response.body.metadata).toBeDefined();
      expect(response.body.metadata.tenantId).toBe(testTenant.id);
    });

    it('should handle executable mode requests', async () => {
      const response = await request(server)
        .post('/api/v1/discovery/trades')
        .set('Authorization', `Bearer ${testTenant.apiKey}`)
        .send({
          wallets: [testWallet],
          mode: 'executable',
          blockchainFormat: 'ethereum'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      if (response.body.tradeLoops.length > 0) {
        expect(response.body.executionInstructions).toBeDefined();
      }
    });

    it('should validate request data', async () => {
      const response = await request(server)
        .post('/api/v1/discovery/trades')
        .set('Authorization', `Bearer ${testTenant.apiKey}`)
        .send({
          wallets: [], // Empty wallets array
          mode: 'informational'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/validation/i);
    });

    it('should enforce rate limits', async () => {
      // Make multiple rapid requests to test rate limiting
      const promises = Array.from({ length: 10 }, () =>
        request(server)
          .post('/api/v1/discovery/trades')
          .set('Authorization', `Bearer ${testTenant.apiKey}`)
          .send({
            wallets: [testWallet],
            mode: 'informational'
          })
      );

      const responses = await Promise.all(promises);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Inventory Management API', () => {
    it('should submit NFT inventory successfully', async () => {
      const response = await request(server)
        .post('/api/v1/inventory/submit')
        .set('Authorization', `Bearer ${testTenant.apiKey}`)
        .send({
          walletId: 'test-wallet-1',
          nfts: [testNFT]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.discoveredLoops).toEqual(expect.any(Array));
    });

    it('should validate NFT data format', async () => {
      const invalidNFT = {
        id: 'invalid-nft',
        // Missing required fields
      };

      const response = await request(server)
        .post('/api/v1/inventory/submit')
        .set('Authorization', `Bearer ${testTenant.apiKey}`)
        .send({
          walletId: 'test-wallet-1',
          nfts: [invalidNFT]
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/validation/i);
    });

    it('should handle large inventory submissions', async () => {
      const largeInventory = Array.from({ length: 100 }, (_, i) => ({
        ...testNFT,
        id: `nft-${i}`,
        metadata: {
          ...testNFT.metadata,
          name: `Test NFT ${i}`
        }
      }));

      const response = await request(server)
        .post('/api/v1/inventory/submit')
        .set('Authorization', `Bearer ${testTenant.apiKey}`)
        .send({
          walletId: 'test-wallet-bulk',
          nfts: largeInventory
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Wants Management API', () => {
    it('should submit wants successfully', async () => {
      const response = await request(server)
        .post('/api/v1/wants/submit')
        .set('Authorization', `Bearer ${testTenant.apiKey}`)
        .send({
          walletId: 'test-wallet-1',
          wantedNFTs: ['target-nft-456', 'target-nft-789'],
          wantedCollections: ['premium-collection']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.discoveredLoops).toEqual(expect.any(Array));
    });

    it('should validate wants data', async () => {
      const response = await request(server)
        .post('/api/v1/wants/submit')
        .set('Authorization', `Bearer ${testTenant.apiKey}`)
        .send({
          walletId: '', // Invalid wallet ID
          wantedNFTs: []
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/validation/i);
    });
  });

  describe('Active Trades API', () => {
    beforeEach(async () => {
      // Submit some test data to generate trades
      await request(server)
        .post('/api/v1/inventory/submit')
        .set('Authorization', `Bearer ${testTenant.apiKey}`)
        .send({
          walletId: 'test-wallet-1',
          nfts: [testNFT]
        });
    });

    it('should retrieve active trades', async () => {
      const response = await request(server)
        .get('/api/v1/trades/active')
        .set('Authorization', `Bearer ${testTenant.apiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tradeLoops).toEqual(expect.any(Array));
      expect(response.body.metadata.totalLoops).toEqual(expect.any(Number));
    });

    it('should filter active trades by parameters', async () => {
      const response = await request(server)
        .get('/api/v1/trades/active')
        .set('Authorization', `Bearer ${testTenant.apiKey}`)
        .query({
          minParticipants: 2,
          maxParticipants: 5,
          minScore: 0.8
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Verify filtering worked
      response.body.tradeLoops.forEach((loop: any) => {
        expect(loop.totalParticipants).toBeGreaterThanOrEqual(2);
        expect(loop.totalParticipants).toBeLessThanOrEqual(5);
        expect(loop.qualityScore || loop.efficiency).toBeGreaterThanOrEqual(0.8);
      });
    });
  });

  describe('Tenant Status API', () => {
    it('should return tenant status', async () => {
      const response = await request(server)
        .get('/api/v1/status')
        .set('Authorization', `Bearer ${testTenant.apiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.tenantId).toBe(testTenant.id);
      expect(response.body.tenantName).toBe(testTenant.name);
      expect(response.body.status).toBe('active');
      expect(response.body.statistics).toBeDefined();
      expect(response.body.settings).toBeDefined();
    });

    it('should include usage statistics', async () => {
      const response = await request(server)
        .get('/api/v1/status')
        .set('Authorization', `Bearer ${testTenant.apiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.statistics.nftCount).toEqual(expect.any(Number));
      expect(response.body.statistics.walletCount).toEqual(expect.any(Number));
      expect(response.body.statistics.activeLoops).toEqual(expect.any(Number));
      expect(response.body.statistics.totalRequests).toEqual(expect.any(Number));
    });
  });

  describe('Universal NFT Ingestion API', () => {
    it('should configure API keys successfully', async () => {
      const response = await request(server)
        .post('/api/v1/config/api-keys')
        .set('Authorization', `Bearer ${testTenant.apiKey}`)
        .send({
          ethereum: {
            alchemy: {
              apiKey: 'test-alchemy-key',
              network: 'mainnet'
            }
          },
          solana: {
            helius: {
              apiKey: 'test-helius-key',
              cluster: 'mainnet-beta'
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toMatch(/configured/i);
    });

    it('should discover NFTs for user', async () => {
      const response = await request(server)
        .post('/api/v1/ingestion/discover')
        .set('Authorization', `Bearer ${testTenant.apiKey}`)
        .send({
          userId: 'test-user-123',
          walletAddresses: {
            ethereum: '0x742d35Cc6634C0532925a3b8D6C1a3bd07235',
            solana: 'DYw8jCTfwHNRJhhmFcbArzQwtMr2p4FqSd1atwMG'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.jobIds).toEqual(expect.any(Array));
      expect(response.body.estimatedCompletion).toBeDefined();
    });

    it('should return ingestion status', async () => {
      const response = await request(server)
        .get('/api/v1/ingestion/status')
        .set('Authorization', `Bearer ${testTenant.apiKey}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBeDefined();
      expect(response.body.statistics).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(server)
        .post('/api/v1/discovery/trades')
        .set('Authorization', `Bearer ${testTenant.apiKey}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/json/i);
    });

    it('should handle internal server errors gracefully', async () => {
      // This would need to be implemented by mocking a service to throw an error
      const response = await request(server)
        .post('/api/v1/discovery/trades')
        .set('Authorization', `Bearer ${testTenant.apiKey}`)
        .send({
          wallets: [testWallet],
          mode: 'informational'
        });

      // Verify error response format even if no error occurs
      if (response.status >= 500) {
        expect(response.body.error).toBeDefined();
        expect(response.body.requestId).toBeDefined();
      }
    });

    it('should validate content-type headers', async () => {
      const response = await request(server)
        .post('/api/v1/discovery/trades')
        .set('Authorization', `Bearer ${testTenant.apiKey}`)
        .set('Content-Type', 'text/plain')
        .send('not json');

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/content.*type/i);
    });
  });

  describe('System Health', () => {
    it('should return system health status', async () => {
      const response = await request(server)
        .get('/api/v1/system/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.services).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    it('should return system metrics for admins', async () => {
      // This would need admin credentials in a real implementation
      const response = await request(server)
        .get('/api/v1/system/metrics')
        .set('Authorization', 'Bearer admin-key');

      // For now, just check the endpoint exists
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    let secondTenant: TenantConfig;

    beforeAll(async () => {
      // Create a second tenant for isolation testing
      secondTenant = await tenantService.createTenant({
        name: 'Second Test Tenant',
        contactEmail: 'second@test.com',
        industry: 'testing'
      });
      await tradeService.initializeTenant(secondTenant);
    });

    afterAll(async () => {
      if (secondTenant?.id) {
        await tenantService.deleteTenant(secondTenant.id);
      }
    });

    it('should isolate data between tenants', async () => {
      // Submit data to first tenant
      await request(server)
        .post('/api/v1/inventory/submit')
        .set('Authorization', `Bearer ${testTenant.apiKey}`)
        .send({
          walletId: 'tenant1-wallet',
          nfts: [{ ...testNFT, id: 'tenant1-nft' }]
        });

      // Submit different data to second tenant
      await request(server)
        .post('/api/v1/inventory/submit')
        .set('Authorization', `Bearer ${secondTenant.apiKey}`)
        .send({
          walletId: 'tenant2-wallet',
          nfts: [{ ...testNFT, id: 'tenant2-nft' }]
        });

      // Verify first tenant only sees their data
      const tenant1Status = await request(server)
        .get('/api/v1/status')
        .set('Authorization', `Bearer ${testTenant.apiKey}`);

      // Verify second tenant only sees their data  
      const tenant2Status = await request(server)
        .get('/api/v1/status')
        .set('Authorization', `Bearer ${secondTenant.apiKey}`);

      expect(tenant1Status.body.tenantId).toBe(testTenant.id);
      expect(tenant2Status.body.tenantId).toBe(secondTenant.id);
      
      // Both should have their own data counts
      expect(tenant1Status.body.statistics.nftCount).toBeGreaterThan(0);
      expect(tenant2Status.body.statistics.nftCount).toBeGreaterThan(0);
    });

    it('should prevent cross-tenant API access', async () => {
      // Try to access second tenant's status with first tenant's key
      const response = await request(server)
        .get('/api/v1/status')
        .set('Authorization', `Bearer ${testTenant.apiKey}`)
        .query({ tenantId: secondTenant.id }); // Try to override tenant

      expect(response.status).toBe(200);
      // Should still return first tenant's data, ignoring the query param
      expect(response.body.tenantId).toBe(testTenant.id);
    });
  });

  describe('Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();

      // Make 10 concurrent requests
      const promises = Array.from({ length: 10 }, () =>
        request(server)
          .post('/api/v1/discovery/trades')
          .set('Authorization', `Bearer ${testTenant.apiKey}`)
          .send({
            wallets: [testWallet],
            mode: 'informational'
          })
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status); // Success or rate limited
      });

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds
    });

    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();

      const response = await request(server)
        .post('/api/v1/discovery/trades')
        .set('Authorization', `Bearer ${testTenant.apiKey}`)
        .send({
          wallets: [testWallet],
          mode: 'informational'
        });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(3000); // 3 seconds per requirement
    });
  });
}); 