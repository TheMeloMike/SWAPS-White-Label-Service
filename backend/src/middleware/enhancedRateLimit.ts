/**
 * Enhanced Rate Limiting Middleware
 * Enterprise-grade rate limiting with proper headers and tenant-specific limits
 */

import { Request, Response, NextFunction } from 'express';
import { LoggingService, Logger } from '../utils/logging/LoggingService';
import { ErrorFactory } from '../utils/errors/StandardError';

interface RateLimitConfig {
  windowMs: number;           // Time window in milliseconds
  maxRequests: number;        // Max requests per window
  keyGenerator?: (req: Request) => string;  // Custom key generator
  skipSuccessfulRequests?: boolean;         // Don't count successful requests
  skipFailedRequests?: boolean;             // Don't count failed requests
  message?: string;           // Custom error message
  headers?: boolean;          // Include rate limit headers
  standardHeaders?: boolean;  // Use standard rate limit headers (draft spec)
}

interface RateLimitInfo {
  totalHits: number;
  totalHitsPerWindow: number;
  resetTime: Date;
  remaining: number;
}

export class EnhancedRateLimit {
  private static logger = LoggingService.getInstance().createLogger('RateLimit');
  private static store = new Map<string, { count: number; resetTime: number }>();
  
  /**
   * Create rate limiting middleware for API endpoints
   */
  public static create(config: RateLimitConfig) {
    return async (req: Request & { tenant?: any }, res: Response, next: NextFunction) => {
      try {
        const key = config.keyGenerator ? config.keyGenerator(req) : 
                   req.tenant?.id || req.ip || 'anonymous';
        
        const now = Date.now();
        const windowStart = now - config.windowMs;
        
        // Clean up old entries
        this.cleanupExpiredEntries(windowStart);
        
        // Get current count for this key
        const current = this.store.get(key) || { count: 0, resetTime: now + config.windowMs };
        
        // Reset if window has expired
        if (current.resetTime <= now) {
          current.count = 0;
          current.resetTime = now + config.windowMs;
        }
        
        // Check if limit exceeded
        if (current.count >= config.maxRequests) {
          const rateLimitInfo: RateLimitInfo = {
            totalHits: current.count,
            totalHitsPerWindow: current.count,
            resetTime: new Date(current.resetTime),
            remaining: 0
          };
          
          this.addHeaders(res, config, rateLimitInfo);
          
          this.logger.warn('Rate limit exceeded', {
            key,
            tenant: req.tenant?.id,
            ip: req.ip,
            path: req.path,
            method: req.method,
            limit: config.maxRequests,
            current: current.count
          });
          
          const error = ErrorFactory.rateLimitExceeded(
            config.message || `Too many requests. Try again in ${Math.ceil((current.resetTime - now) / 1000)} seconds.`,
            {
              tenantId: req.tenant?.id,
              ip: req.ip,
              endpoint: req.path,
              limit: config.maxRequests,
              resetTime: new Date(current.resetTime).toISOString()
            }
          );
          
          throw error;
        }
        
        // Increment counter
        current.count++;
        this.store.set(key, current);
        
        // Add headers
        const rateLimitInfo: RateLimitInfo = {
          totalHits: current.count,
          totalHitsPerWindow: current.count,
          resetTime: new Date(current.resetTime),
          remaining: Math.max(0, config.maxRequests - current.count)
        };
        
        this.addHeaders(res, config, rateLimitInfo);
        
        next();
      } catch (error) {
        next(error);
      }
    };
  }
  
  /**
   * Add rate limiting headers to response
   */
  private static addHeaders(res: Response, config: RateLimitConfig, info: RateLimitInfo) {
    if (config.headers !== false) {
      // Legacy headers
      res.set({
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': info.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(info.resetTime.getTime() / 1000).toString(),
        'X-RateLimit-Used': info.totalHits.toString()
      });
      
      // Standard headers (draft spec)
      if (config.standardHeaders !== false) {
        res.set({
          'RateLimit-Limit': config.maxRequests.toString(),
          'RateLimit-Remaining': info.remaining.toString(),
          'RateLimit-Reset': Math.ceil(info.resetTime.getTime() / 1000).toString(),
          'RateLimit-Used': info.totalHits.toString()
        });
      }
      
      // Add Retry-After header when limit exceeded
      if (info.remaining === 0) {
        const retryAfterSeconds = Math.ceil((info.resetTime.getTime() - Date.now()) / 1000);
        res.set('Retry-After', retryAfterSeconds.toString());
      }
    }
  }
  
  /**
   * Clean up expired entries from memory store
   */
  private static cleanupExpiredEntries(cutoff: number) {
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= cutoff) {
        this.store.delete(key);
      }
    }
  }
  
  /**
   * Get current rate limit status for a key
   */
  public static getStatus(key: string): { count: number; resetTime: number } | null {
    return this.store.get(key) || null;
  }
  
  /**
   * Reset rate limit for a key
   */
  public static reset(key: string): boolean {
    return this.store.delete(key);
  }
  
  /**
   * Get all rate limit statistics
   */
  public static getStats() {
    const now = Date.now();
    const activeKeys = Array.from(this.store.entries())
      .filter(([_, entry]) => entry.resetTime > now)
      .map(([key, entry]) => ({
        key,
        count: entry.count,
        resetTime: new Date(entry.resetTime),
        timeRemaining: entry.resetTime - now
      }));
    
    return {
      totalActiveKeys: activeKeys.length,
      totalStoredKeys: this.store.size,
      activeKeys: activeKeys.slice(0, 10) // Show only first 10 for performance
    };
  }
}

/**
 * Pre-configured rate limiters for different use cases
 */
export const RateLimiters = {
  /**
   * Strict rate limiting for public endpoints
   */
  strict: EnhancedRateLimit.create({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Too many requests. Please try again in 15 minutes.',
    headers: true,
    standardHeaders: true
  }),
  
  /**
   * Standard rate limiting for authenticated API endpoints
   */
  standard: EnhancedRateLimit.create({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
    keyGenerator: (req: Request & { tenant?: any }) => 
      req.tenant?.id || req.ip || 'anonymous',
    message: 'API rate limit exceeded. Please try again later.',
    headers: true,
    standardHeaders: true
  }),
  
  /**
   * Relaxed rate limiting for enterprise clients
   */
  enterprise: EnhancedRateLimit.create({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000,
    keyGenerator: (req: Request & { tenant?: any }) => 
      req.tenant?.id || req.ip || 'anonymous',
    message: 'Enterprise rate limit exceeded. Contact support if you need higher limits.',
    headers: true,
    standardHeaders: true
  }),
  
  /**
   * Heavy rate limiting for resource-intensive endpoints
   */
  heavy: EnhancedRateLimit.create({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10,
    keyGenerator: (req: Request & { tenant?: any }) => 
      req.tenant?.id || req.ip || 'anonymous',
    message: 'Resource-intensive operation rate limit exceeded.',
    headers: true,
    standardHeaders: true
  }),
  
  /**
   * Custom rate limiter factory
   */
  custom: (config: RateLimitConfig) => EnhancedRateLimit.create(config)
}; 