import { Request, Response, NextFunction } from 'express';
import { LoggingService, Logger } from '../utils/logging/LoggingService';
import { SecurityUtils } from '../utils/security/SecurityUtils';

/**
 * Advanced Sliding Window Rate Limiting
 * 
 * Provides more accurate rate limiting than simple token bucket approaches.
 * Uses sliding window counters with Redis for distributed environments.
 * Includes IP-based, API key-based, and endpoint-specific rate limiting.
 */

export interface RateLimitConfig {
  windowMs: number;           // Time window in milliseconds
  maxRequests: number;        // Maximum requests per window
  skipSuccessfulRequests?: boolean; // Only count failed requests
  skipFailedRequests?: boolean;     // Only count successful requests
  keyGenerator?: (req: Request) => string; // Custom key generation
  whitelist?: string[];       // IPs or API keys to exempt
  message?: string;          // Custom error message
  standardHeaders?: boolean;  // Include rate limit headers
  legacyHeaders?: boolean;   // Include X-RateLimit headers
}

export interface RateLimitInfo {
  totalHits: number;
  totalRequests: number;
  remainingRequests: number;
  resetTime: Date;
  limit: number;
}

interface WindowData {
  requests: number[];  // Array of request timestamps
  total: number;       // Total requests in current window
}

export class AdvancedRateLimiter {
  private static instance: AdvancedRateLimiter;
  private logger: Logger;
  private storage = new Map<string, WindowData>(); // In-memory fallback
  private redisClient: any = null; // Redis client if available
  
  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('AdvancedRateLimiter');
    this.initializeRedis();
    this.startCleanupProcess();
  }
  
  public static getInstance(): AdvancedRateLimiter {
    if (!AdvancedRateLimiter.instance) {
      AdvancedRateLimiter.instance = new AdvancedRateLimiter();
    }
    return AdvancedRateLimiter.instance;
  }
  
  /**
   * Initialize Redis connection if available
   */
  private async initializeRedis(): Promise<void> {
    try {
      // Only initialize Redis if REDIS_URL is provided
      if (process.env.REDIS_URL) {
        const { createClient } = await import('redis');
        this.redisClient = createClient({
          url: process.env.REDIS_URL
        });
        
        await this.redisClient.connect();
        this.logger.info('Redis connected for distributed rate limiting');
      } else {
        this.logger.info('Using in-memory rate limiting (single instance)');
      }
    } catch (error) {
      this.logger.warn('Redis connection failed, using in-memory fallback', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.redisClient = null;
    }
  }
  
  /**
   * Create rate limiting middleware
   */
  public createMiddleware(config: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const key = this.generateKey(req, config);
        const now = Date.now();
        
        // Check if request should be rate limited
        if (this.shouldSkipRequest(req, config)) {
          return next();
        }
        
        // Check whitelist
        if (this.isWhitelisted(key, config)) {
          return next();
        }
        
        // Get current rate limit status
        const rateLimitInfo = await this.checkRateLimit(key, config, now);
        
        // Add rate limit headers
        if (config.standardHeaders !== false) {
          this.addRateLimitHeaders(res, rateLimitInfo, config);
        }
        
        // Check if rate limit exceeded
        if (rateLimitInfo.remainingRequests <= 0) {
          // Log rate limit violation
          this.logger.warn('Rate limit exceeded', {
            key: SecurityUtils.sanitizeForLogging({ key }).key,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            endpoint: req.path,
            method: req.method,
            limit: config.maxRequests,
            window: config.windowMs,
            totalRequests: rateLimitInfo.totalRequests
          });
          
          // Return rate limit error
          res.status(429).json({
            error: 'Too Many Requests',
            message: config.message || 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil((rateLimitInfo.resetTime.getTime() - now) / 1000),
            limit: config.maxRequests,
            remaining: 0,
            reset: rateLimitInfo.resetTime.toISOString()
          });
          return;
        }
        
        // Record the request
        await this.recordRequest(key, config, now);
        
        next();
      } catch (error) {
        this.logger.error('Rate limiting error', {
          error: error instanceof Error ? error.message : String(error),
          path: req.path
        });
        // On rate limiting error, allow request to proceed
        next();
      }
    };
  }
  
  /**
   * Generate rate limiting key
   */
  private generateKey(req: Request, config: RateLimitConfig): string {
    if (config.keyGenerator) {
      return config.keyGenerator(req);
    }
    
    // Try API key first
    const apiKey = req.headers['x-api-key'] as string || 
                  (req.headers.authorization?.startsWith('Bearer ') ? 
                   req.headers.authorization.substring(7) : null);
    
    if (apiKey && SecurityUtils.isValidApiKeyFormat(apiKey)) {
      return `api:${SecurityUtils.hashForCache(apiKey, 'sha256')}`;
    }
    
    // Fall back to IP address
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }
  
  /**
   * Check if request should be skipped
   */
  private shouldSkipRequest(req: Request, config: RateLimitConfig): boolean {
    const isSuccessful = (res: any) => res?.statusCode && res.statusCode < 400;
    
    if (config.skipSuccessfulRequests && isSuccessful(req.res)) {
      return true;
    }
    
    if (config.skipFailedRequests && !isSuccessful(req.res)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if key is whitelisted
   */
  private isWhitelisted(key: string, config: RateLimitConfig): boolean {
    if (!config.whitelist || config.whitelist.length === 0) {
      return false;
    }
    
    // Extract the actual identifier from the key
    const identifier = key.split(':')[1];
    return config.whitelist.includes(identifier);
  }
  
  /**
   * Check current rate limit status using sliding window
   */
  private async checkRateLimit(
    key: string, 
    config: RateLimitConfig, 
    now: number
  ): Promise<RateLimitInfo> {
    const windowStart = now - config.windowMs;
    
    if (this.redisClient) {
      return this.checkRateLimitRedis(key, config, now, windowStart);
    } else {
      return this.checkRateLimitMemory(key, config, now, windowStart);
    }
  }
  
  /**
   * Redis-based rate limiting
   */
  private async checkRateLimitRedis(
    key: string,
    config: RateLimitConfig,
    now: number,
    windowStart: number
  ): Promise<RateLimitInfo> {
    const redisKey = `rate_limit:${key}`;
    
    // Use Redis sorted set for sliding window
    const pipeline = this.redisClient.multi();
    
    // Remove old entries
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    
    // Count current requests
    pipeline.zcard(redisKey);
    
    // Set expiration
    pipeline.expire(redisKey, Math.ceil(config.windowMs / 1000));
    
    const results = await pipeline.exec();
    const currentRequests = results[1][1] || 0;
    
    return {
      totalHits: currentRequests,
      totalRequests: currentRequests,
      remainingRequests: Math.max(0, config.maxRequests - currentRequests),
      resetTime: new Date(now + config.windowMs),
      limit: config.maxRequests
    };
  }
  
  /**
   * Memory-based rate limiting (fallback)
   */
  private checkRateLimitMemory(
    key: string,
    config: RateLimitConfig,
    now: number,
    windowStart: number
  ): RateLimitInfo {
    let windowData = this.storage.get(key);
    
    if (!windowData) {
      windowData = { requests: [], total: 0 };
      this.storage.set(key, windowData);
    }
    
    // Remove old requests outside the window
    windowData.requests = windowData.requests.filter(timestamp => timestamp > windowStart);
    windowData.total = windowData.requests.length;
    
    return {
      totalHits: windowData.total,
      totalRequests: windowData.total,
      remainingRequests: Math.max(0, config.maxRequests - windowData.total),
      resetTime: new Date(now + config.windowMs),
      limit: config.maxRequests
    };
  }
  
  /**
   * Record a request
   */
  private async recordRequest(key: string, config: RateLimitConfig, now: number): Promise<void> {
    if (this.redisClient) {
      const redisKey = `rate_limit:${key}`;
      await this.redisClient.zadd(redisKey, now, `${now}-${Math.random()}`);
    } else {
      let windowData = this.storage.get(key);
      if (!windowData) {
        windowData = { requests: [], total: 0 };
        this.storage.set(key, windowData);
      }
      
      windowData.requests.push(now);
      windowData.total = windowData.requests.length;
    }
  }
  
  /**
   * Add rate limit headers to response
   */
  private addRateLimitHeaders(
    res: Response, 
    info: RateLimitInfo, 
    config: RateLimitConfig
  ): void {
    // Standard headers
    res.set({
      'RateLimit-Limit': config.maxRequests.toString(),
      'RateLimit-Remaining': info.remainingRequests.toString(),
      'RateLimit-Reset': info.resetTime.toISOString(),
      'RateLimit-Policy': `${config.maxRequests};w=${Math.floor(config.windowMs / 1000)}`
    });
    
    // Legacy headers for backward compatibility
    if (config.legacyHeaders !== false) {
      res.set({
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': info.remainingRequests.toString(),
        'X-RateLimit-Reset': Math.floor(info.resetTime.getTime() / 1000).toString()
      });
    }
  }
  
  /**
   * Clean up old entries from memory storage
   */
  private startCleanupProcess(): void {
    setInterval(() => {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      for (const [key, windowData] of this.storage.entries()) {
        // Remove entries older than 24 hours
        windowData.requests = windowData.requests.filter(timestamp => 
          now - timestamp < maxAge
        );
        
        // Remove empty entries
        if (windowData.requests.length === 0) {
          this.storage.delete(key);
        } else {
          windowData.total = windowData.requests.length;
        }
      }
    }, 5 * 60 * 1000); // Run every 5 minutes
  }
  
  /**
   * Get current rate limit status for a key
   */
  public async getRateLimitStatus(key: string, config: RateLimitConfig): Promise<RateLimitInfo> {
    const now = Date.now();
    return this.checkRateLimit(key, config, now);
  }
  
  /**
   * Reset rate limit for a specific key
   */
  public async resetRateLimit(key: string): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.del(`rate_limit:${key}`);
    } else {
      this.storage.delete(key);
    }
  }
}

/**
 * Pre-configured rate limiting middleware functions
 */
export const RateLimitMiddleware = {
  /**
   * Global API rate limiting
   */
  global: () => AdvancedRateLimiter.getInstance().createMiddleware({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
    message: 'Too many requests from this client',
    standardHeaders: true
  }),
  
  /**
   * Authentication endpoint rate limiting
   */
  auth: () => AdvancedRateLimiter.getInstance().createMiddleware({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
    message: 'Too many authentication attempts',
    standardHeaders: true,
    skipSuccessfulRequests: true // Only count failed attempts
  }),
  
  /**
   * Trade discovery rate limiting
   */
  tradeDiscovery: () => AdvancedRateLimiter.getInstance().createMiddleware({
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 60,
    message: 'Trade discovery rate limit exceeded',
    standardHeaders: true
  }),
  
  /**
   * NFT submission rate limiting
   */
  nftSubmission: () => AdvancedRateLimiter.getInstance().createMiddleware({
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 100,
    message: 'NFT submission rate limit exceeded',
    standardHeaders: true
  }),
  
  /**
   * Admin endpoint rate limiting
   */
  admin: () => AdvancedRateLimiter.getInstance().createMiddleware({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 50,
    message: 'Admin rate limit exceeded',
    standardHeaders: true
  }),
  
  /**
   * Custom rate limiting with tenant-specific limits
   */
  custom: (config: RateLimitConfig) => AdvancedRateLimiter.getInstance().createMiddleware(config)
};

export default AdvancedRateLimiter; 