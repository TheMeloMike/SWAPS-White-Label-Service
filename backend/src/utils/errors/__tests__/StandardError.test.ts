/**
 * Tests for StandardError System
 * Validates enterprise-grade error handling functionality
 */

import { 
  StandardError, 
  ErrorFactory, 
  ErrorCode, 
  ErrorTracker,
  getErrorSeverity,
  ErrorSeverity 
} from '../StandardError';

describe('StandardError', () => {
  beforeEach(() => {
    ErrorTracker.reset();
  });

  describe('StandardError Class', () => {
    it('should create a standard error with all properties', () => {
      const context = { tenantId: 'test-tenant' };
      const error = new StandardError(
        ErrorCode.UNAUTHORIZED,
        'Test error message',
        401,
        context,
        true
      );

      expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(error.message).toBe('Test error message');
      expect(error.statusCode).toBe(401);
      expect(error.context).toEqual(context);
      expect(error.isOperational).toBe(true);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should generate proper error response', () => {
      const error = new StandardError(
        ErrorCode.INVALID_REQUEST_FORMAT,
        'Invalid input',
        400
      );

      const response = error.toResponse('req-123');

      expect(response).toEqual({
        error: {
          code: ErrorCode.INVALID_REQUEST_FORMAT,
          message: 'Invalid input',
          timestamp: error.timestamp.toISOString(),
          requestId: 'req-123',
          context: {}
        },
        success: false
      });
    });

    it('should properly identify StandardError instances', () => {
      const standardError = new StandardError(ErrorCode.UNAUTHORIZED, 'Test');
      const normalError = new Error('Normal error');

      expect(StandardError.isStandardError(standardError)).toBe(true);
      expect(StandardError.isStandardError(normalError)).toBe(false);
    });
  });

  describe('ErrorFactory', () => {
    it('should create unauthorized error', () => {
      const error = ErrorFactory.unauthorized('Custom message', { tenantId: 'test' });

      expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(error.message).toBe('Custom message');
      expect(error.statusCode).toBe(401);
      expect(error.context.tenantId).toBe('test');
    });

    it('should create validation error', () => {
      const error = ErrorFactory.validationError('Invalid data');

      expect(error.code).toBe(ErrorCode.INVALID_REQUEST_FORMAT);
      expect(error.message).toBe('Invalid data');
      expect(error.statusCode).toBe(400);
    });

    it('should create rate limit error', () => {
      const error = ErrorFactory.rateLimitExceeded('Too many requests');

      expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      expect(error.statusCode).toBe(429);
    });

    it('should create NFT validation error with count', () => {
      const error = ErrorFactory.tooManyNfts(100, { walletId: 'test-wallet' });

      expect(error.code).toBe(ErrorCode.TOO_MANY_NFTS);
      expect(error.message).toBe('Too many NFTs submitted. Maximum allowed: 100');
      expect(error.statusCode).toBe(400);
      expect(error.context.walletId).toBe('test-wallet');
    });

    it('should create service unavailable error', () => {
      const error = ErrorFactory.serviceUnavailable('Trade Discovery Service');

      expect(error.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
      expect(error.message).toBe('Trade Discovery Service is currently unavailable');
      expect(error.statusCode).toBe(503);
    });
  });

  describe('Error Severity', () => {
    it('should categorize 5xx errors as HIGH severity', () => {
      const error = new StandardError(ErrorCode.INTERNAL_SERVER_ERROR, 'Server error', 500);
      expect(getErrorSeverity(error)).toBe(ErrorSeverity.HIGH);
    });

    it('should categorize 429 errors as MEDIUM severity', () => {
      const error = new StandardError(ErrorCode.RATE_LIMIT_EXCEEDED, 'Rate limited', 429);
      expect(getErrorSeverity(error)).toBe(ErrorSeverity.MEDIUM);
    });

    it('should categorize 4xx errors as LOW severity', () => {
      const error = new StandardError(ErrorCode.INVALID_REQUEST_FORMAT, 'Bad request', 400);
      expect(getErrorSeverity(error)).toBe(ErrorSeverity.LOW);
    });
  });

  describe('ErrorTracker', () => {
    it('should track error metrics', () => {
      const error = new StandardError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      
      ErrorTracker.track(error, 150);
      
      const metrics = ErrorTracker.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].code).toBe(ErrorCode.UNAUTHORIZED);
      expect(metrics[0].count).toBe(1);
      expect(metrics[0].avgResponseTime).toBe(150);
      expect(metrics[0].severity).toBe(ErrorSeverity.LOW);
    });

    it('should accumulate error counts', () => {
      const error1 = new StandardError(ErrorCode.UNAUTHORIZED, 'First', 401);
      const error2 = new StandardError(ErrorCode.UNAUTHORIZED, 'Second', 401);
      
      ErrorTracker.track(error1, 100);
      ErrorTracker.track(error2, 200);
      
      const metrics = ErrorTracker.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].count).toBe(2);
      expect(metrics[0].avgResponseTime).toBe(150); // Average of 100 and 200
    });

    it('should track multiple error types', () => {
      const unauthorizedError = new StandardError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
      const validationError = new StandardError(ErrorCode.INVALID_REQUEST_FORMAT, 'Invalid', 400);
      
      ErrorTracker.track(unauthorizedError);
      ErrorTracker.track(validationError);
      
      const metrics = ErrorTracker.getMetrics();
      expect(metrics).toHaveLength(2);
      
      const codes = metrics.map(m => m.code);
      expect(codes).toContain(ErrorCode.UNAUTHORIZED);
      expect(codes).toContain(ErrorCode.INVALID_REQUEST_FORMAT);
    });

    it('should reset metrics', () => {
      const error = new StandardError(ErrorCode.UNAUTHORIZED, 'Test', 401);
      ErrorTracker.track(error);
      
      expect(ErrorTracker.getMetrics()).toHaveLength(1);
      
      ErrorTracker.reset();
      
      expect(ErrorTracker.getMetrics()).toHaveLength(0);
    });
  });

  describe('Error Codes', () => {
    it('should have proper error code format', () => {
      const authCodes = [
        ErrorCode.UNAUTHORIZED,
        ErrorCode.INVALID_API_KEY,
        ErrorCode.API_KEY_EXPIRED
      ];

      authCodes.forEach(code => {
        expect(code).toMatch(/^SWAPS_4\d{3}$/);
      });
    });

    it('should have system error codes in 5xxx range', () => {
      const systemCodes = [
        ErrorCode.INTERNAL_SERVER_ERROR,
        ErrorCode.DATABASE_ERROR,
        ErrorCode.SERVICE_UNAVAILABLE
      ];

      systemCodes.forEach(code => {
        expect(code).toMatch(/^SWAPS_5\d{3}$/);
      });
    });
  });
}); 