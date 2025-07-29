/**
 * Custom application error classes
 * These help with identifying error types and handling them appropriately
 */

/**
 * Base class for all application errors
 */
export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    
    // Maintains proper stack trace for where our error was thrown (only in V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error for invalid input or validation failures
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400);
    this.details = details;
  }

  public readonly details?: Record<string, unknown>;
}

/**
 * Error for when a requested resource is not found
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier "${identifier}" not found` 
      : `${resource} not found`;
    super(message, 404);
    this.resource = resource;
    this.identifier = identifier;
  }

  public readonly resource: string;
  public readonly identifier?: string;
}

/**
 * Error for API rate limits
 */
export class RateLimitError extends AppError {
  constructor(message: string, retryAfterMs?: number) {
    super(message, 429);
    this.retryAfterMs = retryAfterMs;
  }

  public readonly retryAfterMs?: number;
}

/**
 * Error for external API failures
 */
export class ExternalAPIError extends AppError {
  constructor(
    apiName: string,
    message: string,
    originalError?: Error,
    statusCode: number = 502
  ) {
    super(`${apiName} API Error: ${message}`, statusCode);
    this.apiName = apiName;
    this.originalError = originalError;
  }

  public readonly apiName: string;
  public readonly originalError?: Error;
}

/**
 * Specific error for Helius API issues
 */
export class HeliusAPIError extends ExternalAPIError {
  constructor(message: string, originalError?: Error, statusCode: number = 502) {
    super('Helius', message, originalError, statusCode);
  }
}

/**
 * Error for permission issues
 */
export class PermissionError extends AppError {
  constructor(message: string, requiredPermission?: string) {
    super(message, 403);
    this.requiredPermission = requiredPermission;
  }

  public readonly requiredPermission?: string;
}

/**
 * Error for concurrency issues
 */
export class ConcurrencyError extends AppError {
  constructor(resource: string, message: string = 'Resource lock could not be acquired') {
    super(`${message}: ${resource}`, 409);
    this.resource = resource;
  }

  public readonly resource: string;
}

/**
 * Error for timeout issues
 */
export class TimeoutError extends AppError {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation '${operation}' timed out after ${timeoutMs}ms`, 408);
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }

  public readonly operation: string;
  public readonly timeoutMs: number;
} 