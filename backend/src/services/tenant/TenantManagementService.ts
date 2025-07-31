import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { PersistenceManager } from '../../lib/persistence/PersistenceManager';
import { TenantConfig } from '../../types/abstract';
import { Mutex } from 'async-mutex';
import * as crypto from 'crypto';

/**
 * Tenant creation request interface
 */
export interface TenantCreationRequest {
  name: string;
  contactEmail: string;
  industry?: string;
  blockchain?: string;
  webhookUrl?: string;
  algorithmSettings?: {
    maxDepth?: number;
    minEfficiency?: number;
    maxLoopsPerRequest?: number;
    enableCollectionTrading?: boolean;
  };
  rateLimits?: {
    discoveryRequestsPerMinute?: number;
    nftSubmissionsPerDay?: number;
    webhookCallsPerMinute?: number;
  };
  security?: {
    maxNFTsPerWallet?: number;
    maxWantsPerWallet?: number;
    minNFTValueUSD?: number;
    blacklistedCollections?: string[];
  };
}

/**
 * Tenant update request interface
 */
export interface TenantUpdateRequest {
  name?: string;
  contactEmail?: string;
  webhookUrl?: string;
  algorithmSettings?: Partial<TenantConfig['settings']['algorithm']>;
  rateLimits?: Partial<TenantConfig['settings']['rateLimits']>;
  security?: Partial<TenantConfig['settings']['security']>;
}

/**
 * API key usage statistics
 */
export interface ApiKeyUsage {
  tenantId: string;
  totalRequests: number;
  requestsToday: number;
  discoveryRequests: number;
  nftSubmissions: number;
  webhookCalls: number;
  lastUsed: Date;
  rateLimitHits: number;
}

/**
 * Tenant Management Service
 * 
 * Handles multi-tenant configuration, API key management, and tenant lifecycle.
 * Provides secure tenant isolation and configuration management for white label partners.
 */
export class TenantManagementService {
  private static instance: TenantManagementService;
  private logger: Logger;
  private persistenceManager: PersistenceManager;
  
  // Tenant storage
  private tenants = new Map<string, TenantConfig>();           // tenantId -> config
  private apiKeyToTenant = new Map<string, string>();         // apiKey -> tenantId
  private tenantUsage = new Map<string, ApiKeyUsage>();       // tenantId -> usage stats
  
  // Thread safety
  private tenantsMutex = new Mutex();
  private usageMutex = new Mutex();
  
  // Default configurations
  private readonly DEFAULT_ALGORITHM_SETTINGS = {
    maxDepth: 10,
    minEfficiency: 0.6,
    maxLoopsPerRequest: 100,
    enableCollectionTrading: true
  };
  
  private readonly DEFAULT_RATE_LIMITS = {
    discoveryRequestsPerMinute: 60,
    nftSubmissionsPerDay: 10000,
    webhookCallsPerMinute: 100
  };
  
  private readonly DEFAULT_SECURITY_SETTINGS = {
    maxNFTsPerWallet: 1000,
    maxWantsPerWallet: 100,
    minNFTValueUSD: 0,
    blacklistedCollections: []
  };

  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('TenantManagement');
    this.persistenceManager = PersistenceManager.getInstance();
    
    // Load existing tenants
    this.loadTenants();
    
    this.logger.info('TenantManagementService initialized');
  }

  public static getInstance(): TenantManagementService {
    if (!TenantManagementService.instance) {
      TenantManagementService.instance = new TenantManagementService();
    }
    return TenantManagementService.instance;
  }

  /**
   * Create a new tenant
   */
  public async createTenant(request: TenantCreationRequest): Promise<TenantConfig> {
    const operation = this.logger.operation('createTenant');
    
    try {
      return await this.tenantsMutex.runExclusive(async () => {
        // Generate unique tenant ID and API key
        const tenantId = this.generateTenantId();
        const apiKey = this.generateApiKey();
        
        // Create tenant configuration
        const tenant: TenantConfig = {
          id: tenantId,
          name: request.name,
          apiKey,
          settings: {
            algorithm: {
              ...this.DEFAULT_ALGORITHM_SETTINGS,
              ...request.algorithmSettings
            },
            rateLimits: {
              ...this.DEFAULT_RATE_LIMITS,
              ...request.rateLimits
            },
            webhooks: {
              tradeDiscoveryUrl: request.webhookUrl,
              enabled: !!request.webhookUrl
            },
            security: {
              ...this.DEFAULT_SECURITY_SETTINGS,
              ...request.security
            }
          },
          metadata: {
            industry: request.industry,
            blockchain: request.blockchain,
            contactEmail: request.contactEmail
          },
          createdAt: new Date()
        };
        
        // Store tenant
        this.tenants.set(tenantId, tenant);
        this.apiKeyToTenant.set(apiKey, tenantId);
        
        // Initialize usage tracking
        this.tenantUsage.set(tenantId, {
          tenantId,
          totalRequests: 0,
          requestsToday: 0,
          discoveryRequests: 0,
          nftSubmissions: 0,
          webhookCalls: 0,
          lastUsed: new Date(),
          rateLimitHits: 0
        });
        
        // Persist to storage
        await this.saveTenants();
        
        operation.info('Tenant created successfully', {
          tenantId,
          tenantName: request.name,
          industry: request.industry,
          hasWebhook: !!request.webhookUrl
        });
        
        operation.end();
        return tenant;
      });
    } catch (error) {
      operation.error('Failed to create tenant', {
        error: error instanceof Error ? error.message : String(error),
        tenantName: request.name
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Get tenant by ID
   */
  public async getTenant(tenantId: string): Promise<TenantConfig | null> {
    return this.tenants.get(tenantId) || null;
  }

  /**
   * Get tenant by API key
   */
  public async getTenantByApiKey(apiKey: string): Promise<TenantConfig | null> {
    const tenantId = this.apiKeyToTenant.get(apiKey);
    if (!tenantId) return null;
    
    // Update last used time
    await this.recordApiKeyUsage(tenantId, 'general');
    
    return this.tenants.get(tenantId) || null;
  }

  /**
   * Update tenant configuration
   */
  public async updateTenant(tenantId: string, updates: TenantUpdateRequest): Promise<TenantConfig> {
    const operation = this.logger.operation('updateTenant');
    
    try {
      return await this.tenantsMutex.runExclusive(async () => {
        const tenant = this.tenants.get(tenantId);
        if (!tenant) {
          throw new Error(`Tenant not found: ${tenantId}`);
        }
        
        // Apply updates
        if (updates.name) tenant.name = updates.name;
        if (updates.contactEmail) tenant.metadata!.contactEmail = updates.contactEmail;
        if (updates.webhookUrl !== undefined) {
          tenant.settings.webhooks.tradeDiscoveryUrl = updates.webhookUrl;
          tenant.settings.webhooks.enabled = !!updates.webhookUrl;
        }
        
        if (updates.algorithmSettings) {
          Object.assign(tenant.settings.algorithm, updates.algorithmSettings);
        }
        
        if (updates.rateLimits) {
          Object.assign(tenant.settings.rateLimits, updates.rateLimits);
        }
        
        if (updates.security) {
          Object.assign(tenant.settings.security, updates.security);
        }
        
        // Persist changes
        await this.saveTenants();
        
        operation.info('Tenant updated successfully', {
          tenantId,
          updatedFields: Object.keys(updates)
        });
        
        operation.end();
        return tenant;
      });
    } catch (error) {
      operation.error('Failed to update tenant', {
        tenantId,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Delete tenant and all associated data
   */
  public async deleteTenant(tenantId: string): Promise<void> {
    const operation = this.logger.operation('deleteTenant');
    
    try {
      await this.tenantsMutex.runExclusive(async () => {
        const tenant = this.tenants.get(tenantId);
        if (!tenant) {
          throw new Error(`Tenant not found: ${tenantId}`);
        }
        
        // Remove from all maps
        this.tenants.delete(tenantId);
        this.apiKeyToTenant.delete(tenant.apiKey);
        this.tenantUsage.delete(tenantId);
        
        // Persist changes
        await this.saveTenants();
        
        operation.info('Tenant deleted successfully', {
          tenantId,
          tenantName: tenant.name
        });
      });
      
      operation.end();
    } catch (error) {
      operation.error('Failed to delete tenant', {
        tenantId,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Regenerate API key for tenant
   */
  public async regenerateApiKey(tenantId: string): Promise<string> {
    const operation = this.logger.operation('regenerateApiKey');
    
    try {
      return await this.tenantsMutex.runExclusive(async () => {
        const tenant = this.tenants.get(tenantId);
        if (!tenant) {
          throw new Error(`Tenant not found: ${tenantId}`);
        }
        
        // Remove old API key mapping
        this.apiKeyToTenant.delete(tenant.apiKey);
        
        // Generate new API key
        const newApiKey = this.generateApiKey();
        tenant.apiKey = newApiKey;
        
        // Update mapping
        this.apiKeyToTenant.set(newApiKey, tenantId);
        
        // Persist changes
        await this.saveTenants();
        
        operation.info('API key regenerated successfully', { tenantId });
        operation.end();
        
        return newApiKey;
      });
    } catch (error) {
      operation.error('Failed to regenerate API key', {
        tenantId,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Record API key usage for rate limiting and analytics
   */
  public async recordApiKeyUsage(
    tenantId: string, 
    requestType: 'discovery' | 'nft_submission' | 'webhook' | 'general'
  ): Promise<void> {
    await this.usageMutex.runExclusive(async () => {
      let usage = this.tenantUsage.get(tenantId);
      if (!usage) {
        usage = {
          tenantId,
          totalRequests: 0,
          requestsToday: 0,
          discoveryRequests: 0,
          nftSubmissions: 0,
          webhookCalls: 0,
          lastUsed: new Date(),
          rateLimitHits: 0
        };
        this.tenantUsage.set(tenantId, usage);
      }
      
      // Update counters
      usage.totalRequests++;
      usage.lastUsed = new Date();
      
      // Reset daily counter if it's a new day
      const today = new Date().toDateString();
      const lastUsedDay = new Date(usage.lastUsed).toDateString();
      if (today !== lastUsedDay) {
        usage.requestsToday = 0;
      }
      usage.requestsToday++;
      
      // Update specific counters
      switch (requestType) {
        case 'discovery':
          usage.discoveryRequests++;
          break;
        case 'nft_submission':
          usage.nftSubmissions++;
          break;
        case 'webhook':
          usage.webhookCalls++;
          break;
      }
      
      // Update last active for tenant
      const tenant = this.tenants.get(tenantId);
      if (tenant) {
        tenant.lastActive = new Date();
      }
    });
  }

  /**
   * Check if tenant has exceeded rate limits
   */
  public async checkRateLimit(
    tenantId: string, 
    requestType: 'discovery' | 'nft_submission' | 'webhook'
  ): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> {
    const tenant = this.tenants.get(tenantId);
    const usage = this.tenantUsage.get(tenantId);
    
    if (!tenant || !usage) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }
    
    const limits = tenant.settings.rateLimits;
    const now = new Date();
    
    let currentCount = 0;
    let limit = 0;
    let resetTime = new Date();
    
    switch (requestType) {
      case 'discovery':
        // Per-minute limit
        limit = limits.discoveryRequestsPerMinute;
        resetTime = new Date(now.getTime() + 60 * 1000);
        // This is a simplified implementation - in production, use sliding window
        currentCount = usage.discoveryRequests % limits.discoveryRequestsPerMinute;
        break;
        
      case 'nft_submission':
        // Per-day limit
        limit = limits.nftSubmissionsPerDay;
        resetTime = new Date(now);
        resetTime.setDate(resetTime.getDate() + 1);
        resetTime.setHours(0, 0, 0, 0);
        currentCount = usage.requestsToday;
        break;
        
      case 'webhook':
        // Per-minute limit
        limit = limits.webhookCallsPerMinute;
        resetTime = new Date(now.getTime() + 60 * 1000);
        currentCount = usage.webhookCalls % limits.webhookCallsPerMinute;
        break;
    }
    
    const allowed = currentCount < limit;
    const remaining = Math.max(0, limit - currentCount);
    
    if (!allowed) {
      usage.rateLimitHits++;
    }
    
    return { allowed, remaining, resetTime };
  }

  /**
   * Get tenant usage statistics
   */
  public async getTenantUsage(tenantId: string): Promise<ApiKeyUsage | null> {
    return this.tenantUsage.get(tenantId) || null;
  }

  /**
   * List all tenants (admin function)
   */
  public async listTenants(): Promise<TenantConfig[]> {
    return Array.from(this.tenants.values());
  }

  /**
   * Get system-wide statistics
   */
  public getSystemStats() {
    const totalTenants = this.tenants.size;
    const activeTenants = Array.from(this.tenants.values())
      .filter(t => t.lastActive && t.lastActive > new Date(Date.now() - 24 * 60 * 60 * 1000))
      .length;
    
    const totalRequests = Array.from(this.tenantUsage.values())
      .reduce((sum, usage) => sum + usage.totalRequests, 0);
    
    const totalRateLimitHits = Array.from(this.tenantUsage.values())
      .reduce((sum, usage) => sum + usage.rateLimitHits, 0);
    
    return {
      totalTenants,
      activeTenants,
      totalRequests,
      totalRateLimitHits,
      timestamp: new Date()
    };
  }

  /**
   * Private helper methods
   */
  private generateTenantId(): string {
    return `tenant_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  private generateApiKey(): string {
    return `swaps_${crypto.randomBytes(32).toString('hex')}`;
  }

  private async loadTenants(): Promise<void> {
    try {
      const tenantsData = await this.persistenceManager.loadData<TenantConfig[]>('tenants', []);
      const usageData = await this.persistenceManager.loadData<ApiKeyUsage[]>('tenant_usage', []);
      
      // Restore tenants
      for (const tenant of tenantsData) {
        this.tenants.set(tenant.id, tenant);
        this.apiKeyToTenant.set(tenant.apiKey, tenant.id);
      }
      
      // Restore usage data
      for (const usage of usageData) {
        this.tenantUsage.set(usage.tenantId, usage);
      }
      
      this.logger.info('Tenants loaded from persistence', {
        tenantsLoaded: tenantsData.length,
        usageRecordsLoaded: usageData.length
      });
    } catch (error) {
      this.logger.error('Failed to load tenants', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async saveTenants(): Promise<void> {
    try {
      const tenantsArray = Array.from(this.tenants.values());
      const usageArray = Array.from(this.tenantUsage.values());
      
      await Promise.all([
        this.persistenceManager.saveData('tenants', tenantsArray),
        this.persistenceManager.saveData('tenant_usage', usageArray)
      ]);
    } catch (error) {
      this.logger.error('Failed to save tenants', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
} 