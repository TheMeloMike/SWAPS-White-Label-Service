/**
 * Standardized Error System for SWAPS White Label API
 * Provides consistent error responses and proper HTTP status codes
 */

export enum ErrorCode {
  // Authentication & Authorization (4000-4099)
  UNAUTHORIZED = 'SWAPS_4001',
  INVALID_API_KEY = 'SWAPS_4002',
  API_KEY_EXPIRED = 'SWAPS_4003',
  INSUFFICIENT_PERMISSIONS = 'SWAPS_4004',
  TENANT_NOT_FOUND = 'SWAPS_4005',
  
  // Validation Errors (4100-4199)
  INVALID_REQUEST_FORMAT = 'SWAPS_4100',
  MISSING_REQUIRED_FIELD = 'SWAPS_4101',
  INVALID_NFT_DATA = 'SWAPS_4102',
  INVALID_WALLET_ID = 'SWAPS_4103',
  INVALID_PARAMETER = 'SWAPS_4104',
  
  // Rate Limiting (4200-4299)
  RATE_LIMIT_EXCEEDED = 'SWAPS_4200',
  TOO_MANY_NFTS = 'SWAPS_4201',
  TOO_MANY_WANTS = 'SWAPS_4202',
  QUOTA_EXCEEDED = 'SWAPS_4203',
  
  // Business Logic (4300-4399)
  TRADE_LOOP_NOT_FOUND = 'SWAPS_4300',
  WALLET_NOT_FOUND = 'SWAPS_4301',
  NFT_ALREADY_EXISTS = 'SWAPS_4302',
  INVALID_TRADE_STATE = 'SWAPS_4303',
  COLLECTION_NOT_SUPPORTED = 'SWAPS_4304',
  
  // System Errors (5000-5099)
  INTERNAL_SERVER_ERROR = 'SWAPS_5000',
  DATABASE_ERROR = 'SWAPS_5001',
  SERVICE_UNAVAILABLE = 'SWAPS_5002',
  TIMEOUT_ERROR = 'SWAPS_5003',
  CONFIGURATION_ERROR = 'SWAPS_5004',
  
  // External Service Errors (5100-5199)
  BLOCKCHAIN_SERVICE_ERROR = 'SWAPS_5100',
  NFT_METADATA_ERROR = 'SWAPS_5101',
  PRICING_SERVICE_ERROR = 'SWAPS_5102',
  WEBHOOK_DELIVERY_ERROR = 'SWAPS_5103',
  
  // Algorithm Errors (5200-5299)
  TRADE_DISCOVERY_ERROR = 'SWAPS_5200',
  GRAPH_PROCESSING_ERROR = 'SWAPS_5201',
  ALGORITHM_TIMEOUT = 'SWAPS_5202',
  OPTIMIZATION_ERROR = 'SWAPS_5203'
}

export interface ErrorContext {
  tenantId?: string;
  walletId?: string;
  nftId?: string;
  tradeLoopId?: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  [key: string]: any;
}

export interface StandardErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: string;
    timestamp: string;
    requestId?: string;
    context?: ErrorContext;
  };
  success: false;
}

export class StandardError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly context: ErrorContext;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    context: ErrorContext = {},
    isOperational: boolean = true
  ) {
    super(message);
    
    this.name = 'StandardError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.isOperational = isOperational;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StandardError);
    }
  }

  public toResponse(requestId?: string): StandardErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        timestamp: this.timestamp.toISOString(),
        requestId,
        context: this.context
      },
      success: false
    };
  }

  public static isStandardError(error: any): error is StandardError {
    return error instanceof StandardError;
  }
}

/**
 * Pre-defined error factories for common scenarios
 */
export class ErrorFactory {
  static unauthorized(message: string = 'Authentication required', context?: ErrorContext): StandardError {
    return new StandardError(ErrorCode.UNAUTHORIZED, message, 401, context);
  }

  static invalidApiKey(message: string = 'Invalid API key', context?: ErrorContext): StandardError {
    return new StandardError(ErrorCode.INVALID_API_KEY, message, 401, context);
  }

  static validationError(message: string, context?: ErrorContext): StandardError {
    return new StandardError(ErrorCode.INVALID_REQUEST_FORMAT, message, 400, context);
  }

  static nftValidationError(message: string, context?: ErrorContext): StandardError {
    return new StandardError(ErrorCode.INVALID_NFT_DATA, message, 400, context);
  }

  static rateLimitExceeded(message: string, context?: ErrorContext): StandardError {
    return new StandardError(ErrorCode.RATE_LIMIT_EXCEEDED, message, 429, context);
  }

  static tooManyNfts(limit: number, context?: ErrorContext): StandardError {
    return new StandardError(
      ErrorCode.TOO_MANY_NFTS, 
      `Too many NFTs submitted. Maximum allowed: ${limit}`, 
      400, 
      context
    );
  }

  static tooManyWants(limit: number, context?: ErrorContext): StandardError {
    return new StandardError(
      ErrorCode.TOO_MANY_WANTS, 
      `Too many wants submitted. Maximum allowed: ${limit}`, 
      400, 
      context
    );
  }

  static notFound(resource: string, context?: ErrorContext): StandardError {
    return new StandardError(
      ErrorCode.TRADE_LOOP_NOT_FOUND, 
      `${resource} not found`, 
      404, 
      context
    );
  }

  static internalError(message: string = 'Internal server error', context?: ErrorContext): StandardError {
    return new StandardError(ErrorCode.INTERNAL_SERVER_ERROR, message, 500, context);
  }

  static serviceUnavailable(service: string, context?: ErrorContext): StandardError {
    return new StandardError(
      ErrorCode.SERVICE_UNAVAILABLE, 
      `${service} is currently unavailable`, 
      503, 
      context
    );
  }

  static timeoutError(operation: string, context?: ErrorContext): StandardError {
    return new StandardError(
      ErrorCode.TIMEOUT_ERROR, 
      `${operation} timed out`, 
      504, 
      context
    );
  }

  static algorithmError(message: string, context?: ErrorContext): StandardError {
    return new StandardError(ErrorCode.TRADE_DISCOVERY_ERROR, message, 500, context);
  }
}

/**
 * Error categorization for monitoring and alerting
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export function getErrorSeverity(error: StandardError): ErrorSeverity {
  if (error.statusCode >= 500) {
    return ErrorSeverity.HIGH;
  }
  
  if (error.statusCode === 429) {
    return ErrorSeverity.MEDIUM;
  }
  
  if (error.statusCode >= 400) {
    return ErrorSeverity.LOW;
  }
  
  return ErrorSeverity.MEDIUM;
}

/**
 * Error metrics for monitoring
 */
export interface ErrorMetrics {
  code: ErrorCode;
  count: number;
  lastOccurrence: Date;
  severity: ErrorSeverity;
  avgResponseTime?: number;
  tenantId?: string;
}

export class ErrorTracker {
  private static metrics = new Map<ErrorCode, ErrorMetrics>();

  static track(error: StandardError, responseTime?: number): void {
    const existing = this.metrics.get(error.code);
    const severity = getErrorSeverity(error);

    if (existing) {
      existing.count++;
      existing.lastOccurrence = error.timestamp;
      if (responseTime && existing.avgResponseTime) {
        existing.avgResponseTime = (existing.avgResponseTime + responseTime) / 2;
      }
    } else {
      this.metrics.set(error.code, {
        code: error.code,
        count: 1,
        lastOccurrence: error.timestamp,
        severity,
        avgResponseTime: responseTime,
        tenantId: error.context.tenantId
      });
    }
  }

  static getMetrics(): ErrorMetrics[] {
    return Array.from(this.metrics.values());
  }

  static reset(): void {
    this.metrics.clear();
  }
} 