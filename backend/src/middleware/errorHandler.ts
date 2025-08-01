/**
 * Global Error Handler Middleware
 * Handles all errors in a standardized way for enterprise APIs
 */

import { Request, Response, NextFunction } from 'express';
import { LoggingService, Logger } from '../utils/logging/LoggingService';
import { 
  StandardError, 
  ErrorFactory, 
  ErrorTracker, 
  getErrorSeverity,
  ErrorContext 
} from '../utils/errors/StandardError';
import { v4 as uuidv4 } from 'uuid';

export interface ErrorRequest extends Request {
  requestId?: string;
  tenant?: any;
  startTime?: number;
}

/**
 * Enhanced error handler that provides enterprise-grade error management
 */
export class ErrorHandler {
  private static logger: Logger = LoggingService.getInstance().createLogger('ErrorHandler');

  /**
   * Main error handling middleware
   */
  public static handle = (
    error: any,
    req: ErrorRequest,
    res: Response,
    next: NextFunction
  ): void => {
    const startTime = Date.now();
    const requestId = req.requestId || uuidv4();
    const responseTime = req.startTime ? startTime - req.startTime : 0;

    // Build error context from request
    const context: ErrorContext = {
      tenantId: req.tenant?.id,
      requestId,
      endpoint: req.path,
      method: req.method,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      ...(req.params && Object.keys(req.params).length > 0 && { params: req.params }),
      ...(req.query && Object.keys(req.query).length > 0 && { query: req.query })
    };

    let standardError: StandardError;

    // Convert various error types to StandardError
    if (StandardError.isStandardError(error)) {
      // Create new instance with merged context
      standardError = new StandardError(
        error.code,
        error.message,
        error.statusCode,
        { ...error.context, ...context },
        error.isOperational
      );
    } else if (error.name === 'ValidationError') {
      standardError = ErrorFactory.validationError(error.message, context);
    } else if (error.name === 'UnauthorizedError' || error.status === 401) {
      standardError = ErrorFactory.unauthorized(error.message || 'Unauthorized', context);
    } else if (error.name === 'TimeoutError') {
      standardError = ErrorFactory.timeoutError('Request timeout', context);
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      standardError = ErrorFactory.serviceUnavailable('External service', context);
    } else if (error.status && error.status >= 400 && error.status < 500) {
      standardError = ErrorFactory.validationError(
        error.message || 'Client error',
        context
      );
    } else {
      // Unknown error - treat as internal server error
      standardError = ErrorFactory.internalError(
        process.env.NODE_ENV === 'production' 
          ? 'An unexpected error occurred' 
          : error.message,
        context
      );
    }

    // Track error metrics
    ErrorTracker.track(standardError, responseTime);

    // Log error based on severity
    const severity = getErrorSeverity(standardError);
    const logData = {
      requestId,
      errorCode: standardError.code,
      statusCode: standardError.statusCode,
      message: standardError.message,
      context: standardError.context,
      responseTime,
      severity,
      stack: standardError.stack
    };

    switch (severity) {
      case 'critical':
        this.logger.error('Critical error occurred', logData);
        break;
      case 'high':
        this.logger.error('High severity error', logData);
        break;
      case 'medium':
        this.logger.warn('Medium severity error', logData);
        break;
      case 'low':
        this.logger.info('Low severity error', logData);
        break;
    }

    // Send standardized error response
    const errorResponse = standardError.toResponse(requestId);
    
    // Add additional fields for debugging (non-production)
    if (process.env.NODE_ENV !== 'production') {
      errorResponse.error.details = error.stack;
    }

    res.status(standardError.statusCode).json(errorResponse);
  };

  /**
   * Middleware to add request tracking
   */
  public static addRequestTracking = (
    req: ErrorRequest,
    res: Response,
    next: NextFunction
  ): void => {
    req.requestId = uuidv4();
    req.startTime = Date.now();
    
    // Add request ID to response headers for debugging
    res.setHeader('X-Request-ID', req.requestId);
    
    next();
  };

  /**
   * Handle 404 errors
   */
  public static handle404 = (
    req: ErrorRequest,
    res: Response,
    next: NextFunction
  ): void => {
    const context: ErrorContext = {
      requestId: req.requestId,
      endpoint: req.path,
      method: req.method,
      ip: req.ip
    };

    const error = ErrorFactory.notFound(`Endpoint ${req.method} ${req.path}`, context);
    ErrorHandler.handle(error, req, res, next);
  };

  /**
   * Async error wrapper for route handlers
   */
  public static asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  /**
   * Get error statistics for monitoring
   */
  public static getErrorStats = (req: Request, res: Response): void => {
    const metrics = ErrorTracker.getMetrics();
    const stats = {
      totalErrors: metrics.reduce((sum, metric) => sum + metric.count, 0),
      errorsByCode: metrics.reduce((acc, metric) => {
        acc[metric.code] = metric.count;
        return acc;
      }, {} as Record<string, number>),
      errorsBySeverity: metrics.reduce((acc, metric) => {
        acc[metric.severity] = (acc[metric.severity] || 0) + metric.count;
        return acc;
      }, {} as Record<string, number>),
      recentErrors: metrics
        .sort((a, b) => b.lastOccurrence.getTime() - a.lastOccurrence.getTime())
        .slice(0, 10)
    };

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  };
}

/**
 * Validation helpers for common validation scenarios
 */
export class ValidationHelper {
  static validateRequired(fields: Record<string, any>, requiredFields: string[]): void {
    const missing = requiredFields.filter(field => 
      fields[field] === undefined || fields[field] === null || fields[field] === ''
    );

    if (missing.length > 0) {
      throw ErrorFactory.validationError(
        `Missing required fields: ${missing.join(', ')}`
      );
    }
  }

  static validateArray(value: any, fieldName: string, minLength?: number, maxLength?: number): void {
    if (!Array.isArray(value)) {
      throw ErrorFactory.validationError(`${fieldName} must be an array`);
    }

    if (minLength !== undefined && value.length < minLength) {
      throw ErrorFactory.validationError(
        `${fieldName} must contain at least ${minLength} items`
      );
    }

    if (maxLength !== undefined && value.length > maxLength) {
      throw ErrorFactory.validationError(
        `${fieldName} must contain at most ${maxLength} items`
      );
    }
  }

  static validateString(value: any, fieldName: string, minLength?: number, maxLength?: number): void {
    if (typeof value !== 'string') {
      throw ErrorFactory.validationError(`${fieldName} must be a string`);
    }

    if (minLength !== undefined && value.length < minLength) {
      throw ErrorFactory.validationError(
        `${fieldName} must be at least ${minLength} characters long`
      );
    }

    if (maxLength !== undefined && value.length > maxLength) {
      throw ErrorFactory.validationError(
        `${fieldName} must be at most ${maxLength} characters long`
      );
    }
  }

  static validateNFT(nft: any): void {
    if (!nft || typeof nft !== 'object') {
      throw ErrorFactory.nftValidationError('NFT must be an object');
    }

    ValidationHelper.validateRequired(nft, ['id', 'metadata', 'ownership']);
    ValidationHelper.validateRequired(nft.metadata, ['name']);
    ValidationHelper.validateRequired(nft.ownership, ['ownerId']);

    ValidationHelper.validateString(nft.id, 'NFT ID', 1, 255);
    ValidationHelper.validateString(nft.metadata.name, 'NFT name', 1, 255);
    ValidationHelper.validateString(nft.ownership.ownerId, 'Owner ID', 1, 255);
  }
} 