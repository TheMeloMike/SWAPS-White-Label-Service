import * as crypto from 'crypto';

/**
 * Centralized Security Utilities
 * 
 * Provides secure cryptographic operations, API key management,
 * and security-related functions for the SWAPS platform.
 * 
 * All security-sensitive operations should use these utilities
 * to ensure consistency and best practices.
 */

export interface HashedApiKey {
  hash: string;
  salt: string;
}

export interface SecureRandomOptions {
  length?: number;
  encoding?: 'hex' | 'base64' | 'base64url';
}

export class SecurityUtils {
  
  // Security constants
  private static readonly API_KEY_PREFIX = 'swaps_';
  private static readonly HASH_ALGORITHM = 'sha256';
  private static readonly SALT_LENGTH = 32;
  private static readonly HASH_ITERATIONS = 100000; // PBKDF2 iterations
  private static readonly MIN_API_KEY_LENGTH = 20;
  
  /**
   * Generate a cryptographically secure API key
   */
  static generateApiKey(): string {
    const randomBytes = crypto.randomBytes(32);
    return `${this.API_KEY_PREFIX}${randomBytes.toString('hex')}`;
  }
  
  /**
   * Generate a secure random string
   */
  static generateSecureRandom(options: SecureRandomOptions = {}): string {
    const { length = 32, encoding = 'hex' } = options;
    const bytes = crypto.randomBytes(length);
    
    switch (encoding) {
      case 'base64':
        return bytes.toString('base64');
      case 'base64url':
        return bytes.toString('base64url');
      case 'hex':
      default:
        return bytes.toString('hex');
    }
  }
  
  /**
   * Generate a secure tenant ID
   */
  static generateTenantId(): string {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(8);
    return `tenant_${timestamp}_${randomBytes.toString('hex')}`;
  }
  
  /**
   * Hash an API key securely for storage
   */
  static hashApiKey(apiKey: string): HashedApiKey {
    if (!this.isValidApiKeyFormat(apiKey)) {
      throw new Error('Invalid API key format');
    }
    
    const salt = crypto.randomBytes(this.SALT_LENGTH);
    const hash = crypto.pbkdf2Sync(
      apiKey, 
      salt, 
      this.HASH_ITERATIONS, 
      64, 
      this.HASH_ALGORITHM
    );
    
    return {
      hash: hash.toString('hex'),
      salt: salt.toString('hex')
    };
  }
  
  /**
   * Verify an API key against its hash
   */
  static verifyApiKey(apiKey: string, hashedApiKey: HashedApiKey): boolean {
    if (!this.isValidApiKeyFormat(apiKey)) {
      return false;
    }
    
    try {
      const salt = Buffer.from(hashedApiKey.salt, 'hex');
      const hash = crypto.pbkdf2Sync(
        apiKey,
        salt,
        this.HASH_ITERATIONS,
        64,
        this.HASH_ALGORITHM
      );
      
      const expectedHash = Buffer.from(hashedApiKey.hash, 'hex');
      
      // Use timing-safe comparison
      return this.timingSafeEqual(hash, expectedHash);
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Validate API key format
   */
  static isValidApiKeyFormat(apiKey: string): boolean {
    return (
      typeof apiKey === 'string' &&
      apiKey.startsWith(this.API_KEY_PREFIX) &&
      apiKey.length >= this.MIN_API_KEY_LENGTH
    );
  }
  
  /**
   * Generate HMAC signature for webhooks
   */
  static generateHmacSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
  }
  
  /**
   * Verify HMAC signature
   */
  static verifyHmacSignature(
    payload: string, 
    signature: string, 
    secret: string
  ): boolean {
    try {
      const expectedSignature = this.generateHmacSignature(payload, secret);
      return this.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Timing-safe comparison to prevent timing attacks
   */
  static timingSafeEqual(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(a, b);
  }
  
  /**
   * Sanitize data for logging (remove sensitive information)
   */
  static sanitizeForLogging(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }
    
    const sensitiveKeys = [
      'password', 'secret', 'key', 'token', 'authorization',
      'apikey', 'api_key', 'webhook_secret', 'jwt_secret'
    ];
    
    const sanitized = { ...data };
    
    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'string' && sanitized[key].startsWith(this.API_KEY_PREFIX)) {
        // Partially redact API keys for debugging while keeping prefix
        sanitized[key] = sanitized[key].substring(0, 10) + '...[REDACTED]';
      }
    }
    
    return sanitized;
  }
  
  /**
   * Generate a secure JWT secret
   */
  static generateJwtSecret(): string {
    return this.generateSecureRandom({ length: 64, encoding: 'base64' });
  }
  
  /**
   * Validate environment variable exists and is secure
   */
  static validateSecureEnvVar(
    varName: string, 
    minLength: number = 32
  ): string {
    const value = process.env[varName];
    
    if (!value) {
      throw new Error(`Environment variable ${varName} is required but not set`);
    }
    
    if (value.length < minLength) {
      throw new Error(
        `Environment variable ${varName} must be at least ${minLength} characters long`
      );
    }
    
    return value;
  }
  
  /**
   * Hash a string for non-cryptographic purposes (caching, etc.)
   */
  static hashForCache(input: string, algorithm: 'md5' | 'sha256' = 'sha256'): string {
    return crypto.createHash(algorithm).update(input).digest('hex');
  }
}

export default SecurityUtils; 