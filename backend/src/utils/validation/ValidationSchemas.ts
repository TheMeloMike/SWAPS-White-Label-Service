import { z } from 'zod';

/**
 * Comprehensive Input Validation Schemas
 * 
 * Provides secure, type-safe validation for all API endpoints
 * to prevent injection attacks, data corruption, and ensure data integrity.
 * 
 * All API endpoints should use these schemas to validate incoming data.
 */

// Base validation schemas
export const BaseSchemas = {
  // Wallet address validation (Solana format)
  walletAddress: z.string()
    .min(32)
    .max(44)
    .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid wallet address format'),
    
  // NFT mint address validation  
  nftAddress: z.string()
    .min(32)
    .max(44)
    .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid NFT address format'),
    
  // Collection ID validation
  collectionId: z.string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Collection ID can only contain alphanumeric characters, underscores, and hyphens'),
    
  // Tenant ID validation
  tenantId: z.string()
    .regex(/^tenant_\d+_[a-f0-9]+$/, 'Invalid tenant ID format'),
    
  // API key validation
  apiKey: z.string()
    .regex(/^swaps_[a-f0-9]{64}$/, 'Invalid API key format'),
    
  // Email validation
  email: z.string().email('Invalid email format').max(254),
  
  // URL validation
  url: z.string().url('Invalid URL format').max(2048),
  
  // Safe string (no special characters that could cause injection)
  safeString: z.string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9\s\-_.]+$/, 'String contains invalid characters'),
    
  // Numeric validations
  positiveInteger: z.number().int().positive(),
  nonNegativeInteger: z.number().int().min(0),
  percentage: z.number().min(0).max(100),
  
  // Date validation
  isoDate: z.string().datetime('Invalid ISO date format'),
};

// Abstract NFT schema (defined separately to avoid circular reference)
const abstractNFTSchema = z.object({
  id: BaseSchemas.nftAddress,
  metadata: z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    image: z.string().url().max(2048).optional(),
    attributes: z.record(z.any()).optional(),
  }),
  ownership: z.object({
    ownerId: BaseSchemas.walletAddress,
    acquiredAt: z.date().optional(),
  }),
  valuation: z.object({
    estimatedValue: z.number().positive().optional(),
    currency: z.string().length(3).optional(), // e.g., 'SOL', 'ETH'
    confidence: z.number().min(0).max(1).optional(),
  }).optional(),
  collection: z.object({
    id: BaseSchemas.collectionId,
    name: z.string().min(1).max(100),
    family: z.string().max(100).optional(),
  }).optional(),
  platformData: z.record(z.any()).optional(),
});

// NFT-related schemas
export const NFTSchemas = {
  // AbstractNFT validation
  abstractNFT: abstractNFTSchema,
  
  // NFT submission
  nftSubmission: z.object({
    nfts: z.array(abstractNFTSchema).min(1).max(100),
    walletAddress: BaseSchemas.walletAddress,
  }),
  
  // Want submission
  wantSubmission: z.object({
    walletAddress: BaseSchemas.walletAddress,
    wantedNFTId: BaseSchemas.nftAddress,
  }),
};

// Tenant-related schemas
export const TenantSchemas = {
  // Tenant creation request
  tenantCreation: z.object({
    name: z.string().min(1).max(100),
    contactEmail: BaseSchemas.email,
    industry: z.enum(['gaming', 'collectibles', 'art', 'defi', 'other']).optional(),
    blockchain: z.enum(['ethereum', 'solana', 'polygon', 'multi']).optional(),
    webhookUrl: BaseSchemas.url.optional(),
    algorithmSettings: z.object({
      maxDepth: z.number().int().min(2).max(20).optional(),
      minEfficiency: z.number().min(0).max(1).optional(),
      maxLoopsPerRequest: z.number().int().min(1).max(1000).optional(),
      enableCollectionTrading: z.boolean().optional(),
    }).optional(),
    rateLimits: z.object({
      discoveryRequestsPerMinute: z.number().int().min(1).max(1000).optional(),
      nftSubmissionsPerDay: z.number().int().min(1).max(100000).optional(),
      webhookCallsPerMinute: z.number().int().min(1).max(1000).optional(),
    }).optional(),
    security: z.object({
      maxNFTsPerWallet: z.number().int().min(1).max(10000).optional(),
      maxWantsPerWallet: z.number().int().min(1).max(1000).optional(),
      minNFTValueUSD: z.number().min(0).optional(),
      blacklistedCollections: z.array(BaseSchemas.collectionId).max(100).optional(),
    }).optional(),
  }),
  
  // Tenant update request
  tenantUpdate: z.object({
    name: z.string().min(1).max(100).optional(),
    contactEmail: BaseSchemas.email.optional(),
    webhookUrl: BaseSchemas.url.optional(),
    algorithmSettings: z.object({
      maxDepth: z.number().int().min(2).max(20).optional(),
      minEfficiency: z.number().min(0).max(1).optional(),
      maxLoopsPerRequest: z.number().int().min(1).max(1000).optional(),
      enableCollectionTrading: z.boolean().optional(),
    }).partial().optional(),
    rateLimits: z.object({
      discoveryRequestsPerMinute: z.number().int().min(1).max(1000).optional(),
      nftSubmissionsPerDay: z.number().int().min(1).max(100000).optional(),
      webhookCallsPerMinute: z.number().int().min(1).max(1000).optional(),
    }).partial().optional(),
    security: z.object({
      maxNFTsPerWallet: z.number().int().min(1).max(10000).optional(),
      maxWantsPerWallet: z.number().int().min(1).max(1000).optional(),
      minNFTValueUSD: z.number().min(0).optional(),
      blacklistedCollections: z.array(BaseSchemas.collectionId).max(100).optional(),
    }).partial().optional(),
  }),
};

// Admin-related schemas
export const AdminSchemas = {
  // Admin login
  adminLogin: z.object({
    username: z.string().min(3).max(50),
    password: z.string().min(8).max(128),
  }),
  
  // System configuration
  systemConfig: z.object({
    maintenanceMode: z.boolean().optional(),
    maxConcurrentRequests: z.number().int().min(1).max(10000).optional(),
    defaultRateLimits: z.object({
      discoveryRequestsPerMinute: z.number().int().min(1).max(1000),
      nftSubmissionsPerDay: z.number().int().min(1).max(100000),
      webhookCallsPerMinute: z.number().int().min(1).max(1000),
    }).optional(),
  }),
};

// Query parameter schemas
export const QuerySchemas = {
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
  
  // Trade discovery options
  tradeDiscoveryOptions: z.object({
    algorithmPreference: z.enum(['auto', 'johnson', 'scalable', 'probabilistic']).default('auto'),
    maxResults: z.coerce.number().int().min(1).max(1000).default(100),
    minScore: z.coerce.number().min(0).max(1).default(0),
    enableCollections: z.coerce.boolean().default(false),
  }),
  
  // Filtering options
  filterOptions: z.object({
    collection: BaseSchemas.collectionId.optional(),
    minValue: z.coerce.number().min(0).optional(),
    maxValue: z.coerce.number().min(0).optional(),
    sortBy: z.enum(['created', 'value', 'efficiency', 'participants']).default('created'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
};

// Webhook schemas
export const WebhookSchemas = {
  // Webhook signature verification
  webhookPayload: z.object({
    event: z.string(),
    timestamp: BaseSchemas.isoDate,
    tenantId: BaseSchemas.tenantId,
    data: z.record(z.any()),
    signature: z.string().optional(),
  }),
};

/**
 * Validation utility functions
 */
export class ValidationUtils {
  /**
   * Validate request body against schema
   */
  static validateBody<T>(schema: z.ZodSchema<T>, data: unknown): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ).join(', ');
        throw new Error(`Validation failed: ${errorMessages}`);
      }
      throw error;
    }
  }
  
  /**
   * Validate query parameters against schema
   */
  static validateQuery<T>(schema: z.ZodSchema<T>, data: unknown): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ).join(', ');
        throw new Error(`Query validation failed: ${errorMessages}`);
      }
      throw error;
    }
  }
  
  /**
   * Sanitize string input to prevent injection attacks
   */
  static sanitizeString(input: string): string {
    return input
      .trim()
      .replace(/[<>\"'&]/g, '') // Remove potential HTML/script characters
      .substring(0, 1000); // Limit length
  }
  
  /**
   * Validate array of items against schema
   */
  static validateArray<T>(schema: z.ZodSchema<T>, data: unknown[]): T[] {
    return data.map((item, index) => {
      try {
        return schema.parse(item);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errorMessages = error.errors.map(err => 
            `[${index}].${err.path.join('.')}: ${err.message}`
          ).join(', ');
          throw new Error(`Array validation failed: ${errorMessages}`);
        }
        throw error;
      }
    });
  }
}

export default {
  BaseSchemas,
  NFTSchemas,
  TenantSchemas,
  AdminSchemas,
  QuerySchemas,
  WebhookSchemas,
  ValidationUtils,
}; 