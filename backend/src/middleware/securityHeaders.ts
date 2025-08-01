import { Request, Response, NextFunction } from 'express';
import { LoggingService, Logger } from '../utils/logging/LoggingService';

/**
 * Security Headers Middleware
 * 
 * Provides comprehensive security headers to protect against
 * various web vulnerabilities including XSS, clickjacking,
 * MIME sniffing, and other common attacks.
 */

export interface SecurityHeadersConfig {
  // Content Security Policy
  contentSecurityPolicy?: {
    directives?: Record<string, string | string[]>;
    reportOnly?: boolean;
    reportUri?: string;
  };
  
  // Cross-Origin settings
  crossOriginEmbedderPolicy?: 'require-corp' | 'unsafe-none' | false;
  crossOriginOpenerPolicy?: 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none' | false;
  crossOriginResourcePolicy?: 'same-origin' | 'same-site' | 'cross-origin' | false;
  
  // DNS Prefetch Control
  dnsPrefetchControl?: { allow?: boolean } | false;
  
  // Expect-CT
  expectCt?: {
    maxAge?: number;
    enforce?: boolean;
    reportUri?: string;
  } | false;
  
  // Feature Policy / Permissions Policy
  permissionsPolicy?: Record<string, string[]> | false;
  
  // Frame Options
  frameguard?: { action?: 'deny' | 'sameorigin' | 'allow-from'; domain?: string } | false;
  
  // Hide Powered-By
  hidePoweredBy?: boolean;
  
  // HTTP Strict Transport Security
  hsts?: {
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  } | false;
  
  // IE No Open
  ieNoOpen?: boolean;
  
  // MIME Type Sniffing
  noSniff?: boolean;
  
  // Origin Agent Cluster
  originAgentCluster?: boolean;
  
  // Referrer Policy
  referrerPolicy?: string | string[] | false;
  
  // X-XSS-Protection
  xssFilter?: { setOnOldIE?: boolean } | false;
  
  // Custom headers
  customHeaders?: Record<string, string>;
}

export class SecurityHeadersMiddleware {
  private static instance: SecurityHeadersMiddleware;
  private logger: Logger;
  private config: SecurityHeadersConfig;
  
  private constructor(config: SecurityHeadersConfig = {}) {
    this.logger = LoggingService.getInstance().createLogger('SecurityHeaders');
    this.config = this.mergeWithDefaults(config);
  }
  
  public static getInstance(config?: SecurityHeadersConfig): SecurityHeadersMiddleware {
    if (!SecurityHeadersMiddleware.instance) {
      SecurityHeadersMiddleware.instance = new SecurityHeadersMiddleware(config);
    }
    return SecurityHeadersMiddleware.instance;
  }
  
  /**
   * Create security headers middleware
   */
  public createMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        this.setSecurityHeaders(req, res);
        next();
      } catch (error) {
        this.logger.error('Security headers error', {
          error: error instanceof Error ? error.message : String(error),
          path: req.path
        });
        // Continue with request even if header setting fails
        next();
      }
    };
  }
  
  /**
   * Set all security headers
   */
  private setSecurityHeaders(req: Request, res: Response): void {
    // Content Security Policy
    if (this.config.contentSecurityPolicy) {
      this.setContentSecurityPolicy(res, this.config.contentSecurityPolicy);
    }
    
    // Cross-Origin policies
    if (this.config.crossOriginEmbedderPolicy) {
      res.set('Cross-Origin-Embedder-Policy', this.config.crossOriginEmbedderPolicy);
    }
    
    if (this.config.crossOriginOpenerPolicy) {
      res.set('Cross-Origin-Opener-Policy', this.config.crossOriginOpenerPolicy);
    }
    
    if (this.config.crossOriginResourcePolicy) {
      res.set('Cross-Origin-Resource-Policy', this.config.crossOriginResourcePolicy);
    }
    
    // DNS Prefetch Control
    if (this.config.dnsPrefetchControl) {
      const allow = this.config.dnsPrefetchControl.allow !== false;
      res.set('X-DNS-Prefetch-Control', allow ? 'on' : 'off');
    }
    
    // Expect-CT
    if (this.config.expectCt) {
      this.setExpectCt(res, this.config.expectCt);
    }
    
    // Permissions Policy
    if (this.config.permissionsPolicy) {
      this.setPermissionsPolicy(res, this.config.permissionsPolicy);
    }
    
    // Frame Options
    if (this.config.frameguard) {
      this.setFrameOptions(res, this.config.frameguard);
    }
    
    // Hide Powered-By
    if (this.config.hidePoweredBy) {
      res.removeHeader('X-Powered-By');
    }
    
    // HTTP Strict Transport Security
    if (this.config.hsts) {
      this.setHsts(res, this.config.hsts);
    }
    
    // IE No Open
    if (this.config.ieNoOpen) {
      res.set('X-Download-Options', 'noopen');
    }
    
    // MIME Type Sniffing
    if (this.config.noSniff) {
      res.set('X-Content-Type-Options', 'nosniff');
    }
    
    // Origin Agent Cluster
    if (this.config.originAgentCluster) {
      res.set('Origin-Agent-Cluster', '?1');
    }
    
    // Referrer Policy
    if (this.config.referrerPolicy) {
      const policy = Array.isArray(this.config.referrerPolicy) 
        ? this.config.referrerPolicy.join(', ')
        : this.config.referrerPolicy;
      res.set('Referrer-Policy', policy);
    }
    
    // X-XSS-Protection
    if (this.config.xssFilter) {
      res.set('X-XSS-Protection', '1; mode=block');
    }
    
    // Custom headers
    if (this.config.customHeaders) {
      Object.entries(this.config.customHeaders).forEach(([name, value]) => {
        res.set(name, value);
      });
    }
  }
  
  /**
   * Set Content Security Policy header
   */
  private setContentSecurityPolicy(
    res: Response, 
    csp: NonNullable<Exclude<SecurityHeadersConfig['contentSecurityPolicy'], false>>
  ): void {
    if (!csp.directives) return;
    
    const directives = Object.entries(csp.directives)
      .map(([directive, value]) => {
        const values = Array.isArray(value) ? value.join(' ') : value;
        return `${directive} ${values}`;
      })
      .join('; ');
    
    const headerName = csp.reportOnly 
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';
    
    res.set(headerName, directives);
  }
  
  /**
   * Set Expect-CT header
   */
  private setExpectCt(
    res: Response, 
    expectCt: NonNullable<Exclude<SecurityHeadersConfig['expectCt'], false>>
  ): void {
    const parts: string[] = [];
    
    if (expectCt.maxAge !== undefined) {
      parts.push(`max-age=${expectCt.maxAge}`);
    }
    
    if (expectCt.enforce) {
      parts.push('enforce');
    }
    
    if (expectCt.reportUri) {
      parts.push(`report-uri="${expectCt.reportUri}"`);
    }
    
    if (parts.length > 0) {
      res.set('Expect-CT', parts.join(', '));
    }
  }
  
  /**
   * Set Permissions Policy header
   */
  private setPermissionsPolicy(
    res: Response, 
    policy: NonNullable<Exclude<SecurityHeadersConfig['permissionsPolicy'], false>>
  ): void {
    const directives = Object.entries(policy)
      .map(([feature, allowlist]) => {
        const origins = allowlist.length === 0 ? '()' : allowlist.join(' ');
        return `${feature}=${origins}`;
      })
      .join(', ');
    
    res.set('Permissions-Policy', directives);
  }
  
  /**
   * Set Frame Options header
   */
  private setFrameOptions(
    res: Response, 
    frameguard: NonNullable<Exclude<SecurityHeadersConfig['frameguard'], false>>
  ): void {
    let value: string;
    
    switch (frameguard.action) {
      case 'deny':
        value = 'DENY';
        break;
      case 'sameorigin':
        value = 'SAMEORIGIN';
        break;
      case 'allow-from':
        if (!frameguard.domain) {
          throw new Error('Domain is required for allow-from action');
        }
        value = `ALLOW-FROM ${frameguard.domain}`;
        break;
      default:
        value = 'DENY';
    }
    
    res.set('X-Frame-Options', value);
  }
  
  /**
   * Set HTTP Strict Transport Security header
   */
  private setHsts(
    res: Response, 
    hsts: NonNullable<Exclude<SecurityHeadersConfig['hsts'], false>>
  ): void {
    const parts: string[] = [];
    
    if (hsts.maxAge !== undefined) {
      parts.push(`max-age=${hsts.maxAge}`);
    }
    
    if (hsts.includeSubDomains) {
      parts.push('includeSubDomains');
    }
    
    if (hsts.preload) {
      parts.push('preload');
    }
    
    res.set('Strict-Transport-Security', parts.join('; '));
  }
  
  /**
   * Merge config with secure defaults
   */
  private mergeWithDefaults(config: SecurityHeadersConfig): SecurityHeadersConfig {
    const defaults: SecurityHeadersConfig = {
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'https:'],
          'font-src': ["'self'", 'https:'],
          'connect-src': ["'self'"],
          'media-src': ["'self'"],
          'object-src': ["'none'"],
          'child-src': ["'self'"],
          'frame-ancestors': ["'none'"],
          'form-action': ["'self'"],
          'base-uri': ["'self'"],
          'manifest-src': ["'self'"]
        },
        reportOnly: false
      },
      crossOriginEmbedderPolicy: false, // Can break functionality, disabled by default
      crossOriginOpenerPolicy: 'same-origin',
      crossOriginResourcePolicy: 'same-origin',
      dnsPrefetchControl: { allow: false },
      expectCt: false, // Not needed for modern apps with proper HTTPS
      permissionsPolicy: {
        'accelerometer': [],
        'camera': [],
        'geolocation': [],
        'gyroscope': [],
        'magnetometer': [],
        'microphone': [],
        'payment': [],
        'usb': []
      },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: false // Only enable if domain is added to HSTS preload list
      },
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      referrerPolicy: ['no-referrer', 'strict-origin-when-cross-origin'],
      xssFilter: { setOnOldIE: false },
      customHeaders: {
        'X-Permitted-Cross-Domain-Policies': 'none',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    };
    
    return this.deepMerge(defaults, config);
  }
  
  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] === false) {
        // Explicitly disable a security feature
        result[key] = false;
      } else if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
}

/**
 * Pre-configured security headers middleware
 */
export const SecurityHeaders = {
  /**
   * Strict security headers for production
   */
  strict: () => SecurityHeadersMiddleware.getInstance({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'img-src': ["'self'", 'data:'],
        'font-src': ["'self'"],
        'connect-src': ["'self'"],
        'media-src': ["'none'"],
        'object-src': ["'none'"],
        'child-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'form-action': ["'self'"],
        'base-uri': ["'self'"]
      }
    },
    hsts: {
      maxAge: 63072000, // 2 years
      includeSubDomains: true,
      preload: true
    },
    frameguard: { action: 'deny' },
    referrerPolicy: 'no-referrer'
  }).createMiddleware(),
  
  /**
   * Relaxed security headers for development
   */
  development: () => SecurityHeadersMiddleware.getInstance({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'https:', 'http:'],
        'font-src': ["'self'", 'https:', 'data:'],
        'connect-src': ["'self'", 'ws:', 'wss:']
      }
    },
    hsts: false, // Disabled for local development
    crossOriginOpenerPolicy: false,
    customHeaders: {}
  }).createMiddleware(),
  
  /**
   * API-specific security headers
   */
  api: () => SecurityHeadersMiddleware.getInstance({
           contentSecurityPolicy: undefined, // Not needed for APIs
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: 'no-referrer',
    customHeaders: {
      'X-Content-Type-Options': 'nosniff',
      'X-API-Version': process.env.API_VERSION || '1.0'
    }
  }).createMiddleware(),
  
  /**
   * Custom security headers
   */
  custom: (config: SecurityHeadersConfig) => 
    SecurityHeadersMiddleware.getInstance(config).createMiddleware()
};

export default SecurityHeadersMiddleware; 