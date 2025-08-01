import { Request, Response, NextFunction } from 'express';
import { LoggingService, Logger } from '../utils/logging/LoggingService';
import { ValidationUtils } from '../utils/validation/ValidationSchemas';
import AuditLogger, { AuditEventType, AuditSeverity } from '../utils/audit/AuditLogger';

/**
 * Request Sanitization Middleware
 * 
 * Comprehensively cleans and validates all incoming request data
 * to prevent injection attacks, XSS, SQL injection, NoSQL injection,
 * and other malicious input while preserving legitimate data.
 */

export interface SanitizationConfig {
  // String sanitization
  maxStringLength?: number;           // Maximum allowed string length (default: 10000)
  allowHtml?: boolean;               // Allow HTML tags (default: false)
  allowScripts?: boolean;            // Allow script tags (default: false)
  allowSpecialChars?: boolean;       // Allow special characters (default: true)
  
  // Object sanitization
  maxObjectDepth?: number;           // Maximum object nesting depth (default: 10)
  maxArrayLength?: number;           // Maximum array length (default: 1000)
  maxObjectKeys?: number;            // Maximum object keys (default: 100)
  
  // Request limits
  maxBodySize?: number;              // Maximum body size in bytes (default: 1MB)
  maxHeaderSize?: number;            // Maximum header size (default: 8KB)
  maxUrlLength?: number;             // Maximum URL length (default: 2048)
  
  // Validation options
  strictMode?: boolean;              // Strict validation mode (default: false)
  logSuspicious?: boolean;           // Log suspicious patterns (default: true)
  blockSuspicious?: boolean;         // Block suspicious requests (default: false)
  
  // Custom sanitizers
  customSanitizers?: Record<string, (value: any) => any>;
  
  // Whitelist patterns
  allowedPatterns?: RegExp[];
  
  // Blacklist patterns
  blockedPatterns?: RegExp[];
}

interface SanitizationResult {
  sanitized: any;
  warnings: string[];
  blocked: boolean;
  suspiciousPatterns: string[];
}

export class RequestSanitizer {
  private static instance: RequestSanitizer;
  private logger: Logger;
  private auditLogger: AuditLogger;
  private config: Required<SanitizationConfig>;
  
  // Dangerous patterns to detect and sanitize
  private readonly DANGEROUS_PATTERNS = {
    // Script injection
    SCRIPT_TAGS: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    EVENT_HANDLERS: /on\w+\s*=\s*["'][^"']*["']/gi,
    JAVASCRIPT_URLS: /javascript\s*:/gi,
    
    // SQL injection patterns
    SQL_KEYWORDS: /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b/gi,
    SQL_OPERATORS: /(\-\-|\/\*|\*\/|;|\||&)/g,
    
    // NoSQL injection patterns
    NOSQL_OPERATORS: /\$where|\$ne|\$gt|\$lt|\$regex|\$exists/gi,
    
    // Path traversal
    PATH_TRAVERSAL: /\.\.\/|\.\.\\|\.\.\%2f|\.\.\%5c/gi,
    
    // Command injection
    COMMAND_INJECTION: /[;&|`$(){}[\]]/g,
    
    // XSS patterns
    XSS_PATTERNS: /(<|%3C)(script|img|svg|object|embed|iframe|link|style)/gi,
    
    // Server-side includes
    SSI_PATTERNS: /<!--\s*#(exec|include|echo|config|set)/gi,
    
    // Template injection
    TEMPLATE_INJECTION: /\{\{.*?\}\}|\{%.*?%\}|\{#.*?#\}/g
  };
  
  private constructor(config: SanitizationConfig = {}) {
    this.logger = LoggingService.getInstance().createLogger('RequestSanitizer');
    this.auditLogger = AuditLogger.getInstance();
    this.config = this.mergeWithDefaults(config);
  }
  
  public static getInstance(config?: SanitizationConfig): RequestSanitizer {
    if (!RequestSanitizer.instance) {
      RequestSanitizer.instance = new RequestSanitizer(config);
    }
    return RequestSanitizer.instance;
  }
  
  /**
   * Create sanitization middleware
   */
  public createMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        // Check request size limits
        if (!this.checkRequestLimits(req)) {
          res.status(413).json({
            error: 'Request Too Large',
            message: 'Request exceeds size limits'
          });
          return;
        }
        
        // Sanitize request data
        const sanitizedBody = this.sanitizeObject(req.body || {}, 'body');
        const sanitizedQuery = this.sanitizeObject(req.query || {}, 'query');
        const sanitizedParams = this.sanitizeObject(req.params || {}, 'params');
        
        // Check if any suspicious patterns were detected
        const allWarnings = [
          ...sanitizedBody.warnings,
          ...sanitizedQuery.warnings,
          ...sanitizedParams.warnings
        ];
        
        const allSuspiciousPatterns = [
          ...sanitizedBody.suspiciousPatterns,
          ...sanitizedQuery.suspiciousPatterns,
          ...sanitizedParams.suspiciousPatterns
        ];
        
        // Log suspicious activity
        if (allSuspiciousPatterns.length > 0 && this.config.logSuspicious) {
          this.auditLogger.logSecurity(
            AuditEventType.SECURITY_INVALID_INPUT,
            `Suspicious input patterns detected: ${allSuspiciousPatterns.join(', ')}`,
            this.auditLogger.extractRequestContext(req),
            AuditSeverity.MEDIUM
          );
        }
        
        // Block request if configured and suspicious patterns detected
        if (this.config.blockSuspicious && 
            (sanitizedBody.blocked || sanitizedQuery.blocked || sanitizedParams.blocked)) {
          
          this.auditLogger.logSecurity(
            AuditEventType.SECURITY_ACCESS_DENIED,
            'Request blocked due to suspicious input patterns',
            this.auditLogger.extractRequestContext(req),
            AuditSeverity.HIGH
          );
          
          res.status(400).json({
            error: 'Bad Request',
            message: 'Request contains invalid or suspicious data',
            suspiciousPatterns: allSuspiciousPatterns
          });
          return;
        }
        
        // Replace request data with sanitized versions
        req.body = sanitizedBody.sanitized;
        req.query = sanitizedQuery.sanitized;
        req.params = sanitizedParams.sanitized;
        
        // Add sanitization metadata to request
        (req as any).sanitization = {
          warnings: allWarnings,
          suspiciousPatterns: allSuspiciousPatterns,
          sanitized: allWarnings.length > 0
        };
        
        next();
      } catch (error) {
        this.logger.error('Request sanitization error', {
          error: error instanceof Error ? error.message : String(error),
          path: req.path
        });
        
        // On sanitization error, proceed with caution
        if (this.config.strictMode) {
          res.status(500).json({
            error: 'Internal Server Error',
            message: 'Request processing failed'
          });
          return;
        }
        
        next();
      }
    };
  }
  
  /**
   * Sanitize an object recursively
   */
  private sanitizeObject(
    obj: any, 
    context: string, 
    depth: number = 0
  ): SanitizationResult {
    const warnings: string[] = [];
    const suspiciousPatterns: string[] = [];
    let blocked = false;
    
    // Check depth limit
    if (depth > this.config.maxObjectDepth) {
      warnings.push(`Object depth limit exceeded in ${context}`);
      return { sanitized: {}, warnings, blocked: true, suspiciousPatterns };
    }
    
    // Handle null/undefined
    if (obj === null || obj === undefined) {
      return { sanitized: obj, warnings, blocked, suspiciousPatterns };
    }
    
    // Handle primitive types
    if (typeof obj === 'string') {
      return this.sanitizeString(obj, context);
    }
    
    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return { sanitized: obj, warnings, blocked, suspiciousPatterns };
    }
    
    // Handle arrays
    if (Array.isArray(obj)) {
      if (obj.length > this.config.maxArrayLength) {
        warnings.push(`Array length limit exceeded in ${context}`);
        blocked = true;
      }
      
      const sanitizedArray = obj.slice(0, this.config.maxArrayLength).map((item, index) => {
        const result = this.sanitizeObject(item, `${context}[${index}]`, depth + 1);
        warnings.push(...result.warnings);
        suspiciousPatterns.push(...result.suspiciousPatterns);
        if (result.blocked) blocked = true;
        return result.sanitized;
      });
      
      return { sanitized: sanitizedArray, warnings, blocked, suspiciousPatterns };
    }
    
    // Handle objects
    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      
      if (keys.length > this.config.maxObjectKeys) {
        warnings.push(`Object keys limit exceeded in ${context}`);
        blocked = true;
      }
      
      const sanitizedObj: any = {};
      
      for (const key of keys.slice(0, this.config.maxObjectKeys)) {
        // Sanitize the key itself
        const keyResult = this.sanitizeString(key, `${context}.key`);
        const sanitizedKey = keyResult.sanitized;
        
        warnings.push(...keyResult.warnings);
        suspiciousPatterns.push(...keyResult.suspiciousPatterns);
        if (keyResult.blocked) blocked = true;
        
        // Sanitize the value
        const valueResult = this.sanitizeObject(
          obj[key], 
          `${context}.${sanitizedKey}`, 
          depth + 1
        );
        
        warnings.push(...valueResult.warnings);
        suspiciousPatterns.push(...valueResult.suspiciousPatterns);
        if (valueResult.blocked) blocked = true;
        
        sanitizedObj[sanitizedKey] = valueResult.sanitized;
      }
      
      return { sanitized: sanitizedObj, warnings, blocked, suspiciousPatterns };
    }
    
    // Unknown type - convert to string and sanitize
    const stringResult = this.sanitizeString(String(obj), context);
    return stringResult;
  }
  
  /**
   * Sanitize a string value
   */
  private sanitizeString(str: string, context: string): SanitizationResult {
    const warnings: string[] = [];
    const suspiciousPatterns: string[] = [];
    let blocked = false;
    let sanitized = str;
    
    // Check string length
    if (str.length > this.config.maxStringLength) {
      warnings.push(`String length limit exceeded in ${context}`);
      sanitized = str.substring(0, this.config.maxStringLength);
    }
    
    // Check for dangerous patterns
    for (const [patternName, pattern] of Object.entries(this.DANGEROUS_PATTERNS)) {
      if (pattern.test(sanitized)) {
        suspiciousPatterns.push(patternName);
        
        if (this.config.strictMode) {
          blocked = true;
        } else {
          // Remove dangerous patterns
          sanitized = sanitized.replace(pattern, '');
        }
      }
    }
    
    // Check custom blocked patterns
    for (const pattern of this.config.blockedPatterns) {
      if (pattern.test(sanitized)) {
        suspiciousPatterns.push(`CUSTOM_BLOCKED_${pattern.source}`);
        blocked = true;
      }
    }
    
    // Check if allowed by whitelist (if configured)
    if (this.config.allowedPatterns.length > 0) {
      const isAllowed = this.config.allowedPatterns.some(pattern => pattern.test(sanitized));
      if (!isAllowed) {
        warnings.push(`String not in whitelist: ${context}`);
        if (this.config.strictMode) {
          blocked = true;
        }
      }
    }
    
    // Apply additional sanitization
    if (!this.config.allowHtml) {
      sanitized = this.stripHtml(sanitized);
    }
    
    if (!this.config.allowScripts) {
      sanitized = this.stripScripts(sanitized);
    }
    
    if (!this.config.allowSpecialChars) {
      sanitized = this.sanitizeSpecialChars(sanitized);
    }
    
    // Apply custom sanitizers
    for (const [name, sanitizer] of Object.entries(this.config.customSanitizers)) {
      try {
        sanitized = sanitizer(sanitized);
      } catch (error) {
        warnings.push(`Custom sanitizer '${name}' failed in ${context}`);
      }
    }
    
    return { sanitized, warnings, blocked, suspiciousPatterns };
  }
  
  /**
   * Strip HTML tags
   */
  private stripHtml(str: string): string {
    return str.replace(/<[^>]*>/g, '');
  }
  
  /**
   * Strip script content more aggressively
   */
  private stripScripts(str: string): string {
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript\s*:/gi, 'removed:');
  }
  
  /**
   * Sanitize special characters that could be used for injection
   */
  private sanitizeSpecialChars(str: string): string {
    return str
      .replace(/[<>'"&]/g, (match) => {
        const entities: Record<string, string> = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;'
        };
        return entities[match] || match;
      });
  }
  
  /**
   * Check request size limits
   */
  private checkRequestLimits(req: Request): boolean {
    // Check URL length
    if (req.url.length > this.config.maxUrlLength) {
      return false;
    }
    
    // Check header size (approximate)
    const headerSize = JSON.stringify(req.headers).length;
    if (headerSize > this.config.maxHeaderSize) {
      return false;
    }
    
    // Body size is typically checked by Express middleware
    // but we can add additional validation here if needed
    
    return true;
  }
  
  /**
   * Merge config with defaults
   */
  private mergeWithDefaults(config: SanitizationConfig): Required<SanitizationConfig> {
    return {
      maxStringLength: config.maxStringLength ?? 10000,
      allowHtml: config.allowHtml ?? false,
      allowScripts: config.allowScripts ?? false,
      allowSpecialChars: config.allowSpecialChars ?? true,
      maxObjectDepth: config.maxObjectDepth ?? 10,
      maxArrayLength: config.maxArrayLength ?? 1000,
      maxObjectKeys: config.maxObjectKeys ?? 100,
      maxBodySize: config.maxBodySize ?? 1024 * 1024, // 1MB
      maxHeaderSize: config.maxHeaderSize ?? 8192, // 8KB
      maxUrlLength: config.maxUrlLength ?? 2048,
      strictMode: config.strictMode ?? false,
      logSuspicious: config.logSuspicious ?? true,
      blockSuspicious: config.blockSuspicious ?? false,
      customSanitizers: config.customSanitizers ?? {},
      allowedPatterns: config.allowedPatterns ?? [],
      blockedPatterns: config.blockedPatterns ?? []
    };
  }
}

/**
 * Pre-configured sanitization middleware
 */
export const RequestSanitization = {
  /**
   * Strict sanitization for production
   */
  strict: () => RequestSanitizer.getInstance({
    strictMode: true,
    blockSuspicious: true,
    allowHtml: false,
    allowScripts: false,
    allowSpecialChars: false,
    maxStringLength: 5000,
    maxObjectDepth: 5,
    maxArrayLength: 100,
    maxObjectKeys: 50
  }).createMiddleware(),
  
  /**
   * Balanced sanitization for most APIs
   */
  standard: () => RequestSanitizer.getInstance({
    strictMode: false,
    blockSuspicious: false,
    allowHtml: false,
    allowScripts: false,
    allowSpecialChars: true,
    logSuspicious: true
  }).createMiddleware(),
  
  /**
   * Relaxed sanitization for development
   */
  development: () => RequestSanitizer.getInstance({
    strictMode: false,
    blockSuspicious: false,
    allowHtml: true,
    allowScripts: false,
    allowSpecialChars: true,
    logSuspicious: false,
    maxStringLength: 50000
  }).createMiddleware(),
  
  /**
   * Custom sanitization
   */
  custom: (config: SanitizationConfig) => 
    RequestSanitizer.getInstance(config).createMiddleware()
};

export default RequestSanitizer; 