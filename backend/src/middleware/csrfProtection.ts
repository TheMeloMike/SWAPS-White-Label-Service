import { Request, Response, NextFunction } from 'express';
import { LoggingService, Logger } from '../utils/logging/LoggingService';
import { SecurityUtils } from '../utils/security/SecurityUtils';

/**
 * CSRF Protection Middleware
 * 
 * Provides Cross-Site Request Forgery protection for web endpoints.
 * Generates and validates CSRF tokens to ensure requests originate
 * from trusted sources.
 */

export interface CSRFConfig {
  tokenLength?: number;           // Length of CSRF token (default: 32)
  tokenLifetime?: number;         // Token lifetime in ms (default: 1 hour)
  cookieName?: string;           // Name of CSRF cookie (default: '_csrf')
  headerName?: string;           // Name of CSRF header (default: 'X-CSRF-Token')
  fieldName?: string;            // Name of form field (default: '_csrf')
  sameSite?: 'strict' | 'lax' | 'none'; // Cookie SameSite setting
  secure?: boolean;              // Require HTTPS for cookies
  httpOnly?: boolean;            // HTTP-only cookies (prevent XSS)
  exemptMethods?: string[];      // HTTP methods to exempt (default: ['GET', 'HEAD', 'OPTIONS'])
  exemptPaths?: RegExp[];        // Paths to exempt from CSRF checks
  customTokenValidator?: (token: string, secret: string) => boolean;
}

interface CSRFToken {
  token: string;
  secret: string;
  expires: number;
}

export class CSRFProtection {
  private static instance: CSRFProtection;
  private logger: Logger;
  private config: Required<CSRFConfig>;
  private tokenStorage = new Map<string, CSRFToken>(); // In-memory storage
  
  private constructor(config: CSRFConfig = {}) {
    this.logger = LoggingService.getInstance().createLogger('CSRFProtection');
    this.config = {
      tokenLength: config.tokenLength || 32,
      tokenLifetime: config.tokenLifetime || 60 * 60 * 1000, // 1 hour
      cookieName: config.cookieName || '_csrf',
      headerName: config.headerName || 'X-CSRF-Token',
      fieldName: config.fieldName || '_csrf',
      sameSite: config.sameSite || 'strict',
      secure: config.secure !== undefined ? config.secure : process.env.NODE_ENV === 'production',
      httpOnly: config.httpOnly !== undefined ? config.httpOnly : true,
      exemptMethods: config.exemptMethods || ['GET', 'HEAD', 'OPTIONS'],
      exemptPaths: config.exemptPaths || [],
      customTokenValidator: config.customTokenValidator || this.defaultTokenValidator.bind(this)
    };
    
    this.startCleanupProcess();
  }
  
  public static getInstance(config?: CSRFConfig): CSRFProtection {
    if (!CSRFProtection.instance) {
      CSRFProtection.instance = new CSRFProtection(config);
    }
    return CSRFProtection.instance;
  }
  
  /**
   * Create CSRF protection middleware
   */
  public createMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        // Skip CSRF check for exempt methods
        if (this.config.exemptMethods.includes(req.method.toUpperCase())) {
          return this.ensureTokenAvailable(req, res, next);
        }
        
        // Skip CSRF check for exempt paths
        if (this.isPathExempt(req.path)) {
          return this.ensureTokenAvailable(req, res, next);
        }
        
        // Skip CSRF check for API endpoints (they use API keys)
        if (this.isAPIEndpoint(req)) {
          return next();
        }
        
        // Validate CSRF token for state-changing requests
        if (!this.validateCSRFToken(req)) {
          this.logger.warn('CSRF token validation failed', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            method: req.method,
            referer: req.get('Referer'),
            origin: req.get('Origin')
          });
          
          res.status(403).json({
            error: 'Forbidden',
            message: 'CSRF token validation failed',
            code: 'CSRF_INVALID'
          });
          return;
        }
        
        // Ensure fresh token is available for next request
        this.ensureTokenAvailable(req, res, next);
      } catch (error) {
        this.logger.error('CSRF protection error', {
          error: error instanceof Error ? error.message : String(error),
          path: req.path
        });
        
        // On CSRF error, reject the request for security
        res.status(403).json({
          error: 'Forbidden',
          message: 'CSRF protection error',
          code: 'CSRF_ERROR'
        });
      }
    };
  }
  
  /**
   * Generate a new CSRF token
   */
  public generateToken(): { token: string; secret: string } {
    const secret = SecurityUtils.generateSecureRandom({ length: this.config.tokenLength });
    const tokenData = SecurityUtils.generateSecureRandom({ length: this.config.tokenLength });
    const token = SecurityUtils.generateHmacSignature(tokenData, secret);
    
    const expires = Date.now() + this.config.tokenLifetime;
    
    // Store token for validation
    this.tokenStorage.set(token, {
      token,
      secret,
      expires
    });
    
    return { token, secret };
  }
  
  /**
   * Validate CSRF token from request
   */
  private validateCSRFToken(req: Request): boolean {
    // Get token from header, body, or query
    const token = this.getTokenFromRequest(req);
    
    if (!token) {
      this.logger.debug('No CSRF token found in request');
      return false;
    }
    
    // Get secret from cookie or session
    const secret = this.getSecretFromRequest(req);
    
    if (!secret) {
      this.logger.debug('No CSRF secret found in request');
      return false;
    }
    
    // Validate token
    return this.config.customTokenValidator(token, secret);
  }
  
  /**
   * Default token validator
   */
  private defaultTokenValidator(token: string, secret: string): boolean {
    const storedToken = this.tokenStorage.get(token);
    
    if (!storedToken) {
      return false;
    }
    
    // Check if token expired
    if (Date.now() > storedToken.expires) {
      this.tokenStorage.delete(token);
      return false;
    }
    
    // Validate secret matches
    return SecurityUtils.timingSafeEqual(
      Buffer.from(storedToken.secret),
      Buffer.from(secret)
    );
  }
  
  /**
   * Get CSRF token from request
   */
  private getTokenFromRequest(req: Request): string | null {
    // Check header first
    const headerToken = req.get(this.config.headerName);
    if (headerToken) return headerToken;
    
    // Check body
    if (req.body && req.body[this.config.fieldName]) {
      return req.body[this.config.fieldName];
    }
    
    // Check query
    if (req.query && req.query[this.config.fieldName]) {
      return req.query[this.config.fieldName] as string;
    }
    
    return null;
  }
  
  /**
   * Get CSRF secret from request
   */
  private getSecretFromRequest(req: Request): string | null {
    // Get from cookie
    if (req.cookies && req.cookies[this.config.cookieName]) {
      return req.cookies[this.config.cookieName];
    }
    
    // Get from session if available
    if ((req as any).session && (req as any).session.csrfSecret) {
      return (req as any).session.csrfSecret;
    }
    
    return null;
  }
  
  /**
   * Ensure CSRF token is available for the client
   */
  private ensureTokenAvailable(req: Request, res: Response, next: NextFunction): void {
    const existingSecret = this.getSecretFromRequest(req);
    
    if (!existingSecret) {
      // Generate new token and secret
      const { token, secret } = this.generateToken();
      
      // Set cookie with secret
      res.cookie(this.config.cookieName, secret, {
        httpOnly: this.config.httpOnly,
        secure: this.config.secure,
        sameSite: this.config.sameSite,
        maxAge: this.config.tokenLifetime
      });
      
      // Make token available to client (in response headers or locals)
      res.set('X-CSRF-Token', token);
      res.locals.csrfToken = token;
    }
    
    next();
  }
  
  /**
   * Check if path is exempt from CSRF protection
   */
  private isPathExempt(path: string): boolean {
    return this.config.exemptPaths.some(pattern => pattern.test(path));
  }
  
     /**
    * Check if request is an API endpoint (uses API key authentication)
    */
   private isAPIEndpoint(req: Request): boolean {
     // Check for API key in headers
     const xApiKey = req.headers['x-api-key'];
     const apiKey = (typeof xApiKey === 'string' ? xApiKey : null) || 
                   (req.headers.authorization?.startsWith('Bearer ') ? 
                    req.headers.authorization.substring(7) : null);
     
     return apiKey !== null && SecurityUtils.isValidApiKeyFormat(apiKey);
   }
  
  /**
   * Start cleanup process to remove expired tokens
   */
  private startCleanupProcess(): void {
    setInterval(() => {
      const now = Date.now();
      
      for (const [token, data] of this.tokenStorage.entries()) {
        if (now > data.expires) {
          this.tokenStorage.delete(token);
        }
      }
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }
  
  /**
   * Get CSRF token for client-side use
   */
  public getTokenForResponse(req: Request): string | null {
    const secret = this.getSecretFromRequest(req);
    
    if (!secret) {
      return null;
    }
    
    // Generate new token with existing secret
    const tokenData = SecurityUtils.generateSecureRandom({ length: this.config.tokenLength });
    const token = SecurityUtils.generateHmacSignature(tokenData, secret);
    
    const expires = Date.now() + this.config.tokenLifetime;
    
    this.tokenStorage.set(token, {
      token,
      secret,
      expires
    });
    
    return token;
  }
  
  /**
   * Invalidate all tokens for a specific secret
   */
  public invalidateTokensForSecret(secret: string): void {
    for (const [token, data] of this.tokenStorage.entries()) {
      if (data.secret === secret) {
        this.tokenStorage.delete(token);
      }
    }
  }
}

/**
 * Pre-configured CSRF protection middleware
 */
export const CSRFMiddleware = {
  /**
   * Standard CSRF protection for web interfaces
   */
  web: () => CSRFProtection.getInstance({
    tokenLifetime: 60 * 60 * 1000, // 1 hour
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    exemptPaths: [
      /^\/api\/v1\//, // Exempt API endpoints
      /^\/health$/,   // Exempt health checks
    ]
  }).createMiddleware(),
  
  /**
   * Strict CSRF protection for admin interfaces
   */
  admin: () => CSRFProtection.getInstance({
    tokenLifetime: 30 * 60 * 1000, // 30 minutes
    sameSite: 'strict',
    secure: true, // Always require HTTPS for admin
    exemptPaths: []
  }).createMiddleware(),
  
  /**
   * Relaxed CSRF protection for development
   */
  development: () => CSRFProtection.getInstance({
    tokenLifetime: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
    secure: false,
    exemptPaths: [
      /^\/api\/v1\//,
      /^\/health$/,
      /^\/docs\//,
    ]
  }).createMiddleware(),
  
  /**
   * Custom CSRF protection
   */
  custom: (config: CSRFConfig) => CSRFProtection.getInstance(config).createMiddleware()
};

export default CSRFProtection; 