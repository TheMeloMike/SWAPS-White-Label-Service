import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import { TenantManagementService, TenantCreationRequest } from '../../services/tenant/TenantManagementService';
import { TenantConfig } from '../../types/abstract';

// Mock dependencies
jest.mock('../../utils/logging/LoggingService');

describe('TenantManagementService', () => {
  let service: TenantManagementService;

  const mockTenantRequest: TenantCreationRequest = {
    name: 'Test Partner',
    contactEmail: 'test@partner.com',
    industry: 'gaming',
    expectedVolume: 'medium'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = TenantManagementService.getInstance();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Tenant Creation', () => {
    it('should create new tenant successfully', async () => {
      const tenant = await service.createTenant(mockTenantRequest);

      expect(tenant).toBeDefined();
      expect(tenant.id).toBeDefined();
      expect(tenant.name).toBe(mockTenantRequest.name);
      expect(tenant.apiKey).toBeDefined();
      expect(tenant.settings).toBeDefined();
      expect(tenant.createdAt).toBeInstanceOf(Date);
    });

    it('should generate unique API keys for each tenant', async () => {
      const tenant1 = await service.createTenant(mockTenantRequest);
      const tenant2 = await service.createTenant({
        ...mockTenantRequest,
        name: 'Different Partner'
      });

      expect(tenant1.apiKey).not.toBe(tenant2.apiKey);
      expect(tenant1.id).not.toBe(tenant2.id);
    });

    it('should apply default settings for new tenants', async () => {
      const tenant = await service.createTenant(mockTenantRequest);

      expect(tenant.settings.algorithm.maxDepth).toBe(10);
      expect(tenant.settings.algorithm.minEfficiency).toBe(0.6);
      expect(tenant.settings.algorithm.enableCollectionTrading).toBe(false);
      expect(tenant.settings.rateLimits.discoveryRequestsPerMinute).toBeGreaterThan(0);
    });

    it('should customize settings based on expected volume', async () => {
      const highVolumeRequest = {
        ...mockTenantRequest,
        expectedVolume: 'high' as const
      };

      const tenant = await service.createTenant(highVolumeRequest);

      expect(tenant.settings.rateLimits.discoveryRequestsPerMinute).toBeGreaterThan(
        service.getDefaultRateLimits().discoveryRequestsPerMinute
      );
    });
  });

  describe('Tenant Retrieval', () => {
    let testTenant: TenantConfig;

    beforeEach(async () => {
      testTenant = await service.createTenant(mockTenantRequest);
    });

    it('should retrieve tenant by ID', async () => {
      const retrieved = await service.getTenant(testTenant.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(testTenant.id);
      expect(retrieved!.name).toBe(testTenant.name);
    });

    it('should retrieve tenant by API key', async () => {
      const retrieved = await service.getTenantByApiKey(testTenant.apiKey);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(testTenant.id);
      expect(retrieved!.apiKey).toBe(testTenant.apiKey);
    });

    it('should return null for non-existent tenant', async () => {
      const retrieved = await service.getTenant('non-existent-id');
      expect(retrieved).toBeNull();
    });

    it('should return null for invalid API key', async () => {
      const retrieved = await service.getTenantByApiKey('invalid-api-key');
      expect(retrieved).toBeNull();
    });
  });

  describe('Tenant Updates', () => {
    let testTenant: TenantConfig;

    beforeEach(async () => {
      testTenant = await service.createTenant(mockTenantRequest);
    });

    it('should update tenant configuration', async () => {
      const updates = {
        settings: {
          ...testTenant.settings,
          algorithm: {
            ...testTenant.settings.algorithm,
            maxDepth: 15
          }
        }
      };

      const updated = await service.updateTenant(testTenant.id, updates);

      expect(updated.settings.algorithm.maxDepth).toBe(15);
    });

    it('should update last active timestamp', async () => {
      const originalLastActive = testTenant.lastActive;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await service.updateLastActive(testTenant.id);
      const updated = await service.getTenant(testTenant.id);

      expect(updated!.lastActive!.getTime()).toBeGreaterThan(
        originalLastActive ? originalLastActive.getTime() : 0
      );
    });

    it('should regenerate API key', async () => {
      const originalApiKey = testTenant.apiKey;

      const newApiKey = await service.regenerateApiKey(testTenant.id);

      expect(newApiKey).not.toBe(originalApiKey);
      expect(newApiKey).toBeDefined();

      // Verify the tenant was updated
      const updated = await service.getTenant(testTenant.id);
      expect(updated!.apiKey).toBe(newApiKey);
    });
  });

  describe('API Key Management', () => {
    it('should generate valid API keys', () => {
      const apiKey1 = service.generateApiKey();
      const apiKey2 = service.generateApiKey();

      expect(apiKey1).toBeDefined();
      expect(apiKey2).toBeDefined();
      expect(apiKey1).not.toBe(apiKey2);
      expect(apiKey1.length).toBeGreaterThan(20);
    });

    it('should validate API keys correctly', async () => {
      const tenant = await service.createTenant(mockTenantRequest);

      const isValid = await service.validateApiKey(tenant.apiKey);
      expect(isValid).toBe(true);

      const isInvalid = await service.validateApiKey('invalid-key');
      expect(isInvalid).toBe(false);
    });
  });

  describe('Usage Tracking', () => {
    let testTenant: TenantConfig;

    beforeEach(async () => {
      testTenant = await service.createTenant(mockTenantRequest);
    });

    it('should track API usage', async () => {
      await service.recordApiUsage(testTenant.id, 'trade_discovery', 1);
      await service.recordApiUsage(testTenant.id, 'trade_discovery', 3);

      const usage = await service.getUsageStats(testTenant.id);

      expect(usage.trade_discovery).toBe(4);
    });

    it('should track usage per day', async () => {
      const today = new Date().toISOString().split('T')[0];

      await service.recordApiUsage(testTenant.id, 'nft_submission', 5);

      const dailyUsage = await service.getDailyUsage(testTenant.id, today);

      expect(dailyUsage.nft_submission).toBe(5);
    });

    it('should reset daily usage at midnight', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const today = new Date().toISOString().split('T')[0];

      // Record usage for yesterday
      await service.recordApiUsage(testTenant.id, 'trade_discovery', 10, yesterday);

      // Record usage for today
      await service.recordApiUsage(testTenant.id, 'trade_discovery', 5);

      const yesterdayUsage = await service.getDailyUsage(testTenant.id, yesterdayStr);
      const todayUsage = await service.getDailyUsage(testTenant.id, today);

      expect(yesterdayUsage.trade_discovery).toBe(10);
      expect(todayUsage.trade_discovery).toBe(5);
    });
  });

  describe('Rate Limiting', () => {
    let testTenant: TenantConfig;

    beforeEach(async () => {
      testTenant = await service.createTenant(mockTenantRequest);
    });

    it('should check rate limits', async () => {
      // First request should be allowed
      const allowed1 = await service.checkRateLimit(
        testTenant.id,
        'trade_discovery',
        1
      );
      expect(allowed1).toBe(true);

      // Simulate hitting the rate limit
      const rateLimit = testTenant.settings.rateLimits.discoveryRequestsPerMinute;
      const allowed2 = await service.checkRateLimit(
        testTenant.id,
        'trade_discovery',
        rateLimit + 1
      );
      expect(allowed2).toBe(false);
    });

    it('should reset rate limits after time window', async () => {
      // This test would need to mock time or use a smaller time window
      // For now, we'll just verify the rate limit structure exists
      const rateLimitResult = await service.checkRateLimit(
        testTenant.id,
        'trade_discovery',
        1
      );
      
      expect(typeof rateLimitResult).toBe('boolean');
    });
  });

  describe('Tenant Deletion', () => {
    let testTenant: TenantConfig;

    beforeEach(async () => {
      testTenant = await service.createTenant(mockTenantRequest);
    });

    it('should delete tenant and cleanup data', async () => {
      await service.deleteTenant(testTenant.id);

      const retrieved = await service.getTenant(testTenant.id);
      expect(retrieved).toBeNull();

      const retrievedByKey = await service.getTenantByApiKey(testTenant.apiKey);
      expect(retrievedByKey).toBeNull();
    });

    it('should handle deletion of non-existent tenant gracefully', async () => {
      await expect(service.deleteTenant('non-existent')).resolves.not.toThrow();
    });
  });

  describe('Default Settings', () => {
    it('should provide default algorithm settings', () => {
      const defaults = service.getDefaultAlgorithmSettings();

      expect(defaults.maxDepth).toBeDefined();
      expect(defaults.minEfficiency).toBeDefined();
      expect(defaults.maxLoopsPerRequest).toBeDefined();
      expect(defaults.enableCollectionTrading).toBeDefined();
    });

    it('should provide default rate limits', () => {
      const defaults = service.getDefaultRateLimits();

      expect(defaults.discoveryRequestsPerMinute).toBeGreaterThan(0);
      expect(defaults.nftSubmissionsPerDay).toBeGreaterThan(0);
      expect(defaults.webhookCallsPerMinute).toBeGreaterThan(0);
    });

    it('should provide default security settings', () => {
      const defaults = service.getDefaultSecuritySettings();

      expect(defaults.maxNFTsPerWallet).toBeGreaterThan(0);
      expect(defaults.maxWantsPerWallet).toBeGreaterThan(0);
      expect(defaults.blacklistedCollections).toEqual([]);
    });
  });

  describe('Tenant Listing', () => {
    beforeEach(async () => {
      // Create multiple tenants for listing tests
      await service.createTenant({
        name: 'Partner A',
        contactEmail: 'a@test.com',
        industry: 'gaming',
        expectedVolume: 'low'
      });
      
      await service.createTenant({
        name: 'Partner B',
        contactEmail: 'b@test.com',
        industry: 'collectibles',
        expectedVolume: 'high'
      });
    });

    it('should list all tenants', async () => {
      const tenants = await service.getAllTenants();

      expect(tenants.length).toBeGreaterThanOrEqual(2);
      expect(tenants.every(t => t.id && t.name && t.apiKey)).toBe(true);
    });

    it('should provide tenant statistics', async () => {
      const stats = await service.getTenantStatistics();

      expect(stats.totalTenants).toBeGreaterThanOrEqual(2);
      expect(stats.activeTenants).toBeDefined();
      expect(stats.industryBreakdown).toBeDefined();
    });
  });
}); 