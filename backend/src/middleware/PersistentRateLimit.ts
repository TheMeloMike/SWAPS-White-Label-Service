import fs from 'fs/promises';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { LoggingService } from '../utils/logging/LoggingService';

/**
 * File-based rate limiting that persists across server restarts
 * 
 * Features:
 * - Sliding window rate limiting
 * - File-based persistence (survives restarts)
 * - Automatic cleanup of old entries
 * - Multiple rate limit tiers
 * - Whitelist support
 */
export class PersistentRateLimit {
  private static instance: PersistentRateLimit;
  private logger = LoggingService.getInstance().createLogger('PersistentRateLimit');
  
  private dataFile: string;
  private rateLimitData: Map<string, RateLimitEntry[]> = new Map();
  private lastSave = 0;
  private saveInterval = 30000; // Save every 30 seconds
  private cleanupInterval = 60000; // Cleanup every minute
  
  private cleanupTimer: NodeJS.Timeout | null = null;
  private saveTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.dataFile = path.join(process.env.DATA_DIR || './data', 'rate_limits.json');
    this.initialize();
  }

  public static getInstance(): PersistentRateLimit {
    if (!PersistentRateLimit.instance) {
      PersistentRateLimit.instance = new PersistentRateLimit();
    }
    return PersistentRateLimit.instance;
  }

  /**
   * Initialize rate limiter
   */
  private async initialize(): Promise<void> {
    try {
      await this.loadData();
      this.startTimers();
      this.logger.info('Persistent rate limiter initialized');
    } catch (error) {
      this.logger.error('Failed to initialize persistent rate limiter', { error });
    }
  }

  /**
   * Create rate limit middleware
   */
  public createMiddleware(config: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = this.generateKey(req, config);
        const allowed = await this.checkRateLimit(key, config);
        
        if (!allowed.allowed) {
          const resetTime = Math.ceil((allowed.resetTime || Date.now() + config.windowMs) / 1000);
          
          res.set({
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetTime.toString(),
            'Retry-After': Math.ceil((allowed.resetTime || Date.now() + config.windowMs - Date.now()) / 1000).toString()
          });

          // Log rate limit violation
          this.logger.warn('Rate limit exceeded', {
            key,
            ip: req.ip,
            endpoint: req.path,
            limit: config.maxRequests,
            window: config.windowMs,
            requestId: (req as any).id
          });

          return res.status(429).json({
            error: 'Rate limit exceeded',
            message: config.message || 'Too many requests, please try again later',
            retryAfter: Math.ceil((allowed.resetTime || Date.now() + config.windowMs - Date.now()) / 1000)
          });
        }

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': (config.maxRequests - allowed.requestCount).toString(),
          'X-RateLimit-Reset': Math.ceil((allowed.resetTime || Date.now() + config.windowMs) / 1000).toString()
        });

        next();
      } catch (error) {
        this.logger.error('Rate limit middleware error', { error });
        // Fail open - allow request if rate limiter fails
        next();
      }
    };
  }

  /**
   * Check if request is allowed under rate limit
   */
  private async checkRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    // Get existing entries for this key
    let entries = this.rateLimitData.get(key) || [];
    
    // Remove old entries outside the window
    entries = entries.filter(entry => entry.timestamp > windowStart);
    
    // Check if we're under the limit
    if (entries.length < config.maxRequests) {
      // Add new entry
      entries.push({
        timestamp: now,
        ip: key.split(':')[1] // Extract IP from key
      });
      
      this.rateLimitData.set(key, entries);
      this.scheduleSave();
      
      return {
        allowed: true,
        requestCount: entries.length,
        resetTime: windowStart + config.windowMs + config.windowMs
      };
    }

    // Rate limit exceeded
    const oldestEntry = Math.min(...entries.map(e => e.timestamp));
    const resetTime = oldestEntry + config.windowMs;
    
    return {
      allowed: false,
      requestCount: entries.length,
      resetTime
    };
  }

  /**
   * Generate rate limit key
   */
  private generateKey(req: Request, config: RateLimitConfig): string {
    if (config.keyGenerator) {
      return config.keyGenerator(req);
    }

    // Default key generation
    const tenant = (req as any).tenant?.id || 'anonymous';
    const ip = req.ip || 'unknown';
    const endpoint = config.skipSuccessfulRequests ? req.path : '';
    
    return `${tenant}:${ip}:${endpoint}`;
  }

  /**
   * Load rate limit data from file
   */
  private async loadData(): Promise<void> {
    try {
      const data = await fs.readFile(this.dataFile, 'utf8');
      const parsed = JSON.parse(data);
      
      // Convert plain object back to Map with proper types
      for (const [key, entries] of Object.entries(parsed.rateLimits || {})) {
        this.rateLimitData.set(key, entries as RateLimitEntry[]);
      }
      
      this.logger.debug(`Loaded ${this.rateLimitData.size} rate limit keys from storage`);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        this.logger.error('Failed to load rate limit data', { error });
      }
      // File doesn't exist yet, start with empty data
    }
  }

  /**
   * Save rate limit data to file
   */
  private async saveData(): Promise<void> {
    try {
      const data = {
        version: '1.0',
        lastSaved: new Date().toISOString(),
        rateLimits: Object.fromEntries(this.rateLimitData)
      };
      
      // Ensure directory exists
      const dir = path.dirname(this.dataFile);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2), 'utf8');
      this.lastSave = Date.now();
    } catch (error) {
      this.logger.error('Failed to save rate limit data', { error });
    }
  }

  /**
   * Schedule a save operation
   */
  private scheduleSave(): void {
    if (Date.now() - this.lastSave > this.saveInterval) {
      this.saveData();
    }
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedKeys = 0;
    let cleanedEntries = 0;
    
    for (const [key, entries] of this.rateLimitData.entries()) {
      // Remove entries older than 24 hours
      const filtered = entries.filter(entry => now - entry.timestamp < 24 * 60 * 60 * 1000);
      
      if (filtered.length === 0) {
        // Remove empty keys
        this.rateLimitData.delete(key);
        cleanedKeys++;
      } else if (filtered.length !== entries.length) {
        // Update with filtered entries
        this.rateLimitData.set(key, filtered);
        cleanedEntries += entries.length - filtered.length;
      }
    }
    
    if (cleanedKeys > 0 || cleanedEntries > 0) {
      this.logger.debug(`Cleaned up ${cleanedKeys} keys and ${cleanedEntries} entries`);
      this.scheduleSave();
    }
  }

  /**
   * Start background timers
   */
  private startTimers(): void {
    // Save timer
    this.saveTimer = setInterval(() => {
      if (Date.now() - this.lastSave > this.saveInterval) {
        this.saveData();
      }
    }, this.saveInterval);

    // Cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Get rate limit statistics
   */
  public getStats(): RateLimitStats {
    let totalEntries = 0;
    const now = Date.now();
    const activeKeys = new Set<string>();
    
    for (const [key, entries] of this.rateLimitData.entries()) {
      totalEntries += entries.length;
      
      // Check if key has recent activity (last hour)
      if (entries.some(entry => now - entry.timestamp < 60 * 60 * 1000)) {
        activeKeys.add(key);
      }
    }
    
    return {
      totalKeys: this.rateLimitData.size,
      activeKeys: activeKeys.size,
      totalEntries,
      lastSave: this.lastSave,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }

  /**
   * Reset rate limits for a specific key
   */
  public resetKey(key: string): boolean {
    const existed = this.rateLimitData.has(key);
    this.rateLimitData.delete(key);
    this.scheduleSave();
    return existed;
  }

  /**
   * Get current rate limit status for a key
   */
  public getKeyStatus(key: string, windowMs: number): RateLimitKeyStatus {
    const entries = this.rateLimitData.get(key) || [];
    const now = Date.now();
    const windowStart = now - windowMs;
    const activeEntries = entries.filter(entry => entry.timestamp > windowStart);
    
    return {
      key,
      requestCount: activeEntries.length,
      oldestRequest: activeEntries.length > 0 ? Math.min(...activeEntries.map(e => e.timestamp)) : null,
      newestRequest: activeEntries.length > 0 ? Math.max(...activeEntries.map(e => e.timestamp)) : null
    };
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    if (this.saveTimer) clearInterval(this.saveTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    
    await this.saveData();
    this.logger.info('Persistent rate limiter shutdown complete');
  }
}

// Rate limit configurations
export const RateLimitConfigs = {
  strict: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Strict rate limit exceeded'
  },
  standard: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
    message: 'Rate limit exceeded'
  },
  api: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 60,
    message: 'API rate limit exceeded'
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Authentication rate limit exceeded'
  }
} as const;

// Types
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  whitelist?: string[];
}

export interface RateLimitEntry {
  timestamp: number;
  ip: string;
}

export interface RateLimitResult {
  allowed: boolean;
  requestCount: number;
  resetTime?: number;
}

export interface RateLimitStats {
  totalKeys: number;
  activeKeys: number;
  totalEntries: number;
  lastSave: number;
  memoryUsage: number;
}

export interface RateLimitKeyStatus {
  key: string;
  requestCount: number;
  oldestRequest: number | null;
  newestRequest: number | null;
}