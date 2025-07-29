import { z } from 'zod';

// Solana address validation regex (supports both base58 and bech32 formats)
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Validation schema for NFT address
 */
export const nftAddressSchema = z.object({
  nftAddress: z.string()
    .refine(val => SOLANA_ADDRESS_REGEX.test(val), {
      message: 'Invalid NFT address format. Must be a valid Solana address.'
    })
});

/**
 * Validation schema for wallet address
 */
export const walletAddressSchema = z.object({
  walletAddress: z.string()
    .refine(val => SOLANA_ADDRESS_REGEX.test(val), {
      message: 'Invalid Solana wallet address format'
    })
});

/**
 * Validation schema for batch NFT metadata requests
 * Includes additional validations and better error messages
 */
export const batchNftMetadataSchema = z.object({
  addresses: z.array(
    z.string()
      .refine(val => SOLANA_ADDRESS_REGEX.test(val), {
        message: 'Invalid NFT address format. Must be a valid Solana address.'
      })
  )
  .min(1, { message: 'At least one NFT address is required' })
  .max(50, { message: 'Maximum of 50 NFT addresses allowed per request' })
});

/**
 * Validation schema for NFT ownership request
 */
export const nftOwnershipSchema = z.object({
  nftAddress: z.string()
    .refine(val => SOLANA_ADDRESS_REGEX.test(val), {
      message: 'Invalid NFT address format'
    }),
  ownerAddress: z.string()
    .refine(val => SOLANA_ADDRESS_REGEX.test(val), {
      message: 'Invalid wallet address format'
    })
    .optional()
});

/**
 * Validation schema for NFT collection requests
 */
export const collectionSchema = z.object({
  collectionId: z.string()
    .min(5, { message: 'Collection ID must be at least 5 characters' })
    .max(100, { message: 'Collection ID cannot exceed 100 characters' })
});

/**
 * Validation schema for NFT pagination
 * Enhances defaults and applies limits
 */
export const nftPaginationSchema = z.object({
  page: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 1)
    .refine(val => val > 0, {
      message: 'Page must be a positive number'
    }),
  limit: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 20)
    .refine(val => val > 0 && val <= 50, {
      message: 'Limit must be between 1 and 50'
    }),
  sortBy: z.enum(['name', 'price', 'date', 'rarity']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

/**
 * Validation schema for collection floor price request
 */
export const floorPriceSchema = z.object({
  collectionAddress: z.string()
    .min(5, { message: 'Collection address must be at least 5 characters' })
    .max(100, { message: 'Collection address cannot exceed 100 characters' })
}); 