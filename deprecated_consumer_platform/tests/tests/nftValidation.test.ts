import { describe, it, expect } from '@jest/globals';
import { 
  nftAddressSchema,
  walletAddressSchema,
  batchNftMetadataSchema,
  nftPaginationSchema,
  floorPriceSchema
} from '../middleware/nftValidation';

describe('NFT Validation Schemas', () => {
  describe('nftAddressSchema', () => {
    it('should accept valid NFT addresses', () => {
      const validAddress = 'DUSTawucrTsGU8hcqRdHDCbuYhCPADMLM2VcCb8VnFnQ';
      const result = nftAddressSchema.safeParse({ nftAddress: validAddress });
      expect(result.success).toBe(true);
    });

    it('should reject invalid NFT addresses', () => {
      const invalidAddresses = [
        '123', // Too short
        'ABC#DEF', // Invalid characters
        'thisIsNotValidBecauseItIsTooLongForASolanaAddress123456789', // Too long
        '', // Empty string
      ];

      invalidAddresses.forEach(address => {
        const result = nftAddressSchema.safeParse({ nftAddress: address });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('walletAddressSchema', () => {
    it('should accept valid wallet addresses', () => {
      const validAddress = '5FHwkrdxkCGhDYiuYLg9zJVJYUNkq4aftzdKwf8tJLYV';
      const result = walletAddressSchema.safeParse({ walletAddress: validAddress });
      expect(result.success).toBe(true);
    });

    it('should reject invalid wallet addresses', () => {
      const invalidAddresses = [
        '123', // Too short
        'wallet*address', // Invalid characters
        '', // Empty string
      ];

      invalidAddresses.forEach(address => {
        const result = walletAddressSchema.safeParse({ walletAddress: address });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('batchNftMetadataSchema', () => {
    it('should accept valid batch requests', () => {
      const validAddresses = [
        'DUSTawucrTsGU8hcqRdHDCbuYhCPADMLM2VcCb8VnFnQ',
        '5FHwkrdxkCGhDYiuYLg9zJVJYUNkq4aftzdKwf8tJLYV'
      ];
      
      const result = batchNftMetadataSchema.safeParse({
        addresses: validAddresses
      });
      
      expect(result.success).toBe(true);
    });

    it('should reject empty arrays', () => {
      const result = batchNftMetadataSchema.safeParse({
        addresses: []
      });
      
      expect(result.success).toBe(false);
    });

    it('should reject arrays with invalid addresses', () => {
      const invalidBatch = {
        addresses: [
          'DUSTawucrTsGU8hcqRdHDCbuYhCPADMLM2VcCb8VnFnQ', // Valid
          'invalid!address' // Invalid
        ]
      };
      
      const result = batchNftMetadataSchema.safeParse(invalidBatch);
      expect(result.success).toBe(false);
    });

    it('should reject arrays that are too large', () => {
      // Create an array with 51 elements (above the 50 limit)
      const tooManyAddresses = Array(51).fill('DUSTawucrTsGU8hcqRdHDCbuYhCPADMLM2VcCb8VnFnQ');
      
      const result = batchNftMetadataSchema.safeParse({
        addresses: tooManyAddresses
      });
      
      expect(result.success).toBe(false);
    });
  });

  describe('nftPaginationSchema', () => {
    it('should use default values when not provided', () => {
      const result = nftPaginationSchema.safeParse({});
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should accept valid pagination parameters', () => {
      const valid = {
        page: '2',
        limit: '10',
        sortBy: 'price',
        sortOrder: 'desc'
      };
      
      const result = nftPaginationSchema.safeParse(valid);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(10);
        expect(result.data.sortBy).toBe('price');
        expect(result.data.sortOrder).toBe('desc');
      }
    });

    it('should reject invalid pagination values', () => {
      const invalidCases = [
        { page: '0' }, // Page must be positive
        { limit: '0' }, // Limit must be positive
        { limit: '51' }, // Limit must be <= 50
        { sortBy: 'invalid' }, // Not a valid sort field
        { sortOrder: 'random' } // Not a valid sort order
      ];
      
      invalidCases.forEach(testCase => {
        const result = nftPaginationSchema.safeParse(testCase);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('floorPriceSchema', () => {
    it('should accept valid collection addresses', () => {
      const valid = {
        collectionAddress: 'dustcollection123'
      };
      
      const result = floorPriceSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject invalid collection addresses', () => {
      const invalidCases = [
        { collectionAddress: 'abc' }, // Too short (< 5 chars)
        { collectionAddress: 'a'.repeat(101) } // Too long (> 100 chars)
      ];
      
      invalidCases.forEach(testCase => {
        const result = floorPriceSchema.safeParse(testCase);
        expect(result.success).toBe(false);
      });
    });
  });
}); 