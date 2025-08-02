/**
 * 🚨 STANDARDIZED ERROR RESPONSE UTILITY
 * 
 * Ensures all API endpoints return consistent error formats
 * for better client experience and debugging
 */

export interface StandardErrorResponse {
  error: string;
  code: string;
  details?: any;
  timestamp: string;
  requestId?: string;
}

export class ApiError extends Error {
  public code: string;
  public statusCode: number;
  public details?: any;

  constructor(message: string, code: string, statusCode: number = 400, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ErrorResponses {
  // 🔑 Authentication Errors
  static unauthorized(message: string = 'Authentication required'): ApiError {
    return new ApiError(message, 'AUTH_REQUIRED', 401);
  }

  static invalidApiKey(message: string = 'Invalid API key'): ApiError {
    return new ApiError(message, 'INVALID_API_KEY', 401);
  }

  static forbidden(message: string = 'Access denied'): ApiError {
    return new ApiError(message, 'ACCESS_DENIED', 403);
  }

  // 📝 Validation Errors
  static validationError(message: string, details?: any): ApiError {
    return new ApiError(message, 'VALIDATION_ERROR', 400, details);
  }

  static missingField(fieldName: string): ApiError {
    return new ApiError(
      `Required field '${fieldName}' is missing`,
      'MISSING_FIELD',
      400,
      { field: fieldName }
    );
  }

  static invalidFormat(fieldName: string, expectedFormat: string): ApiError {
    return new ApiError(
      `Field '${fieldName}' has invalid format. Expected: ${expectedFormat}`,
      'INVALID_FORMAT',
      400,
      { field: fieldName, expectedFormat }
    );
  }

  static invalidWalletId(walletId: string): ApiError {
    return new ApiError(
      `Invalid wallet ID: ${walletId}`,
      'INVALID_WALLET_ID',
      400,
      { walletId }
    );
  }

  static invalidNftFormat(details?: any): ApiError {
    return new ApiError(
      'Invalid NFT format. Expected: { id: string, metadata: { name: string, description?: string, image?: string }, ownership: { ownerId: string, blockchain?: string }, valuation?: { estimatedValue: number, currency: string } }',
      'INVALID_NFT_FORMAT',
      400,
      { 
        ...details,
        expectedFormat: {
          id: 'string - unique identifier',
          metadata: { name: 'string - required', description: 'string - optional', image: 'string - optional' },
          ownership: { ownerId: 'string - required', blockchain: 'string - optional' },
          valuation: { estimatedValue: 'number - optional', currency: 'string - optional' }
        }
      }
    );
  }

  static invalidArrayFormat(fieldName: string, expectedType: string): ApiError {
    return new ApiError(
      `Field '${fieldName}' must be an array of ${expectedType}. Example: [${expectedType === 'strings' ? '"item1", "item2"' : '{ ... }, { ... }'}]`,
      'INVALID_ARRAY_FORMAT',
      400,
      { field: fieldName, expectedType, example: expectedType === 'strings' ? ['item1', 'item2'] : [{}] }
    );
  }

  static invalidStringArray(fieldName: string): ApiError {
    return new ApiError(
      `Field '${fieldName}' must be an array of strings. Example: ["nft-id-1", "nft-id-2"]`,
      'INVALID_STRING_ARRAY',
      400,
      { field: fieldName, expectedType: 'string[]', example: ['nft-id-1', 'nft-id-2'] }
    );
  }

  // 🚦 Rate Limiting Errors
  static rateLimitExceeded(remaining: number = 0, resetTime?: number): ApiError {
    return new ApiError(
      'Rate limit exceeded. Please try again later.',
      'RATE_LIMIT_EXCEEDED',
      429,
      { remaining, resetTime }
    );
  }

  // 🔍 Resource Errors
  static notFound(resource: string, id?: string): ApiError {
    return new ApiError(
      `${resource} ${id ? `with ID '${id}' ` : ''}not found`,
      'RESOURCE_NOT_FOUND',
      404,
      { resource, id }
    );
  }

  static tenantNotFound(tenantId: string): ApiError {
    return new ApiError(
      `Tenant with ID '${tenantId}' not found`,
      'TENANT_NOT_FOUND',
      404,
      { tenantId }
    );
  }

  static walletNotFound(walletId: string): ApiError {
    return new ApiError(
      `Wallet with ID '${walletId}' not found`,
      'WALLET_NOT_FOUND',
      404,
      { walletId }
    );
  }

  // ⚙️ Processing Errors
  static processingError(message: string, details?: any): ApiError {
    return new ApiError(message, 'PROCESSING_ERROR', 500, details);
  }

  static algorithmError(message: string, details?: any): ApiError {
    return new ApiError(
      `Algorithm processing failed: ${message}`,
      'ALGORITHM_ERROR',
      500,
      details
    );
  }

  static timeoutError(operation: string, timeoutMs: number): ApiError {
    return new ApiError(
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      'OPERATION_TIMEOUT',
      408,
      { operation, timeoutMs }
    );
  }

  // 🏗️ Infrastructure Errors
  static serviceUnavailable(service: string, details?: any): ApiError {
    return new ApiError(
      `Service '${service}' is temporarily unavailable`,
      'SERVICE_UNAVAILABLE',
      503,
      { service, ...details }
    );
  }

  static internalError(message: string = 'Internal server error', details?: any): ApiError {
    return new ApiError(message, 'INTERNAL_ERROR', 500, details);
  }

  // 📊 Utility Methods
  static formatErrorResponse(error: ApiError | Error, requestId?: string): StandardErrorResponse {
    if (error instanceof ApiError) {
      return {
        error: error.message,
        code: error.code,
        details: error.details,
        timestamp: new Date().toISOString(),
        requestId
      };
    }

    // Handle generic errors
    return {
      error: error.message || 'Unknown error occurred',
      code: 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString(),
      requestId
    };
  }

  static sendError(res: any, error: ApiError | Error, requestId?: string): void {
    const apiError = error instanceof ApiError ? error : new ApiError(
      error.message || 'Unknown error',
      'UNKNOWN_ERROR',
      500
    );

    const response = ErrorResponses.formatErrorResponse(apiError, requestId);
    res.status(apiError.statusCode).json(response);
  }
}