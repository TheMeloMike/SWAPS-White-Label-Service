import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { LoggingService } from '../utils/logging/LoggingService';

const logger = LoggingService.getInstance().createLogger('ValidationMiddleware');

/**
 * Middleware factory for validating request data using zod schemas
 * 
 * @param schema The zod schema to validate against
 * @param source Where to find the data to validate ('body', 'query', 'params', or 'all')
 * @returns Express middleware function
 */
export function validateRequest(
  schema: z.ZodTypeAny,
  source: 'body' | 'query' | 'params' | 'all' = 'body'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Select data to validate based on the source
      const dataToValidate = source === 'all' 
        ? { body: req.body, query: req.query, params: req.params }
        : req[source];
      
      // Validate data against schema
      const validatedData = await schema.parseAsync(dataToValidate);
      
      // Replace the request data with the validated/transformed data
      if (source === 'all') {
        req.body = validatedData.body;
        req.query = validatedData.query;
        req.params = validatedData.params;
      } else {
        req[source] = validatedData;
      }
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Format error messages
        const formattedErrors = error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message
        }));
        
        logger.warn('Validation failed for request', {
          endpoint: req.originalUrl,
          method: req.method,
          errors: formattedErrors
        });
        
        // Return validation error response
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: formattedErrors
        });
      }
      
      // Handle unexpected errors
      logger.error('Unexpected error during request validation', {
        endpoint: req.originalUrl,
        method: req.method,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error during validation'
      });
    }
  };
}

/**
 * Middleware for validating wallet addresses in route parameters
 */
export function validateWalletAddress() {
  const walletAddressSchema = z.object({
    walletAddress: z.string().refine(val => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(val), {
      message: 'Invalid Solana wallet address format'
    })
  });
  
  return validateRequest(walletAddressSchema, 'params');
}

/**
 * Middleware for validating NFT addresses in route parameters
 */
export function validateNftAddress() {
  const nftAddressSchema = z.object({
    nftAddress: z.string().refine(val => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(val), {
      message: 'Invalid NFT address format'
    })
  });
  
  return validateRequest(nftAddressSchema, 'params');
}

/**
 * Middleware for validating trade IDs in route parameters
 */
export function validateTradeId() {
  const tradeIdSchema = z.object({
    tradeId: z.string().uuid('Invalid trade ID format. Should be a valid UUID.')
  });
  
  return validateRequest(tradeIdSchema, 'params');
}

/**
 * Middleware for validating pagination parameters
 */
export function validatePagination() {
  const paginationSchema = z.object({
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20)
  }).refine(data => data.page > 0, {
    message: 'Page must be a positive number',
    path: ['page']
  }).refine(data => data.limit > 0 && data.limit <= 100, {
    message: 'Limit must be between 1 and 100',
    path: ['limit']
  });
  
  return validateRequest(paginationSchema, 'query');
} 