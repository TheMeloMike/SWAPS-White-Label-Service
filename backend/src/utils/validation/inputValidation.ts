import { z } from 'zod';
import { LoggingService } from '../logging/LoggingService';

/**
 * Input validation utilities using zod schema validation
 * This provides centralized validation for all input data to ensure
 * type safety, data integrity, and security.
 */

const logger = LoggingService.getInstance().createLogger('InputValidation');

/**
 * Solana wallet address format validation
 * Format: base58 encoded string of length 32-44 characters
 */
export const solanaWalletAddressSchema = z.string()
  .refine(val => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(val), {
    message: 'Invalid Solana wallet address format'
  });

/**
 * NFT token address format validation
 * Format: base58 encoded string of length 32-44 characters
 */
export const nftAddressSchema = z.string()
  .refine(val => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(val), {
    message: 'Invalid NFT token address format'
  });

/**
 * Trade ID format validation
 * Format: UUID v4 string
 */
export const tradeIdSchema = z.string()
  .uuid('Invalid trade ID format. Should be a valid UUID.');

/**
 * Trade step validation schema
 */
export const tradeStepSchema = z.object({
  from: solanaWalletAddressSchema,
  to: solanaWalletAddressSchema,
  nfts: z.array(z.object({
    address: nftAddressSchema,
    name: z.string().optional(),
    symbol: z.string().optional(),
    image: z.string().optional(),
    collection: z.string().optional(),
    description: z.string().optional(),
    floorPrice: z.number().optional(),
    owner: z.string().optional(),
    usedRealPrice: z.boolean().optional(),
    hasFloorPrice: z.boolean().optional(),
    priceSource: z.string().optional()
  }))
});

/**
 * Trade loop validation schema
 */
export const tradeLoopSchema = z.object({
  id: tradeIdSchema,
  steps: z.array(tradeStepSchema),
  totalParticipants: z.number().int().positive(),
  efficiency: z.number().min(0).max(1),
  rawEfficiency: z.number().optional(),
  estimatedValue: z.number().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  createdAt: z.date().optional(),
  completedAt: z.date().optional()
});

/**
 * Trade discovery settings validation schema
 */
export const tradeDiscoverySettingsSchema = z.object({
  maxDepth: z.number().int().min(2).max(12).optional(),
  minEfficiency: z.number().min(0.1).max(1).optional(),
  maxResults: z.number().int().positive().optional(),
  includeDirectTrades: z.boolean().optional(),
  includeMultiPartyTrades: z.boolean().optional(),
  considerCollections: z.boolean().optional(),
  timeoutMs: z.number().int().positive().optional()
});

/**
 * Validates input data against a schema
 * 
 * @param data The data to validate
 * @param schema The zod schema to validate against
 * @param context Optional context information for logging
 * @returns [isValid, validatedData, errorMessage]
 */
export function validateInput<T>(
  data: any, 
  schema: z.ZodType<T>,
  context: string = 'validation'
): [boolean, T | null, string | null] {
  try {
    const validatedData = schema.parse(data);
    return [true, validatedData, null];
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join('; ');
      
      logger.warn(`Validation failed for ${context}`, { 
        error: errorMessage,
        data: JSON.stringify(data).substring(0, 200) // Truncate large data for logging
      });
      
      return [false, null, errorMessage];
    }
    
    logger.error(`Unexpected error during validation for ${context}`, {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return [false, null, 'Unexpected validation error'];
  }
}

/**
 * Type guard for Solana wallet addresses
 */
export function isValidSolanaWalletAddress(value: any): value is string {
  return solanaWalletAddressSchema.safeParse(value).success;
}

/**
 * Type guard for NFT addresses
 */
export function isValidNftAddress(value: any): value is string {
  return nftAddressSchema.safeParse(value).success;
}

/**
 * Type guard for trade IDs
 */
export function isValidTradeId(value: any): value is string {
  return tradeIdSchema.safeParse(value).success;
}

/**
 * Type guard for trade loops
 */
export function isValidTradeLoop(value: any): boolean {
  return tradeLoopSchema.safeParse(value).success;
} 