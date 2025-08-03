import { LoggingService, Logger } from '../logging/LoggingService';
import { SecurityUtils } from '../security/SecurityUtils';
import { Request } from 'express';

/**
 * Comprehensive Audit Logging System
 * 
 * Tracks all security-sensitive operations, API usage, authentication events,
 * and data modifications for compliance and security monitoring.
 * 
 * Provides structured logging with security event correlation,
 * anomaly detection, and compliance reporting capabilities.
 */

export enum AuditEventType {
  // Authentication Events
  AUTH_LOGIN_SUCCESS = 'auth.login.success',
  AUTH_LOGIN_FAILURE = 'auth.login.failure',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_TOKEN_REFRESH = 'auth.token.refresh',
  AUTH_PASSWORD_CHANGE = 'auth.password.change',
  
  // API Key Events
  API_KEY_CREATED = 'api.key.created',
  API_KEY_REGENERATED = 'api.key.regenerated',
  API_KEY_DELETED = 'api.key.deleted',
  API_KEY_INVALID = 'api.key.invalid',
  API_KEY_USAGE = 'api.key.usage',
  
  // Tenant Management
  TENANT_CREATED = 'tenant.created',
  TENANT_UPDATED = 'tenant.updated',
  TENANT_DELETED = 'tenant.deleted',
  TENANT_SUSPENDED = 'tenant.suspended',
  TENANT_REACTIVATED = 'tenant.reactivated',
  
  // Data Operations
  DATA_READ = 'data.read',
  DATA_CREATE = 'data.create',
  DATA_UPDATE = 'data.update',
  DATA_DELETE = 'data.delete',
  DATA_EXPORT = 'data.export',
  DATA_IMPORT = 'data.import',
  
  // Security Events
  SECURITY_RATE_LIMIT_EXCEEDED = 'security.rate_limit.exceeded',
  SECURITY_CSRF_VIOLATION = 'security.csrf.violation',
  SECURITY_INVALID_INPUT = 'security.input.invalid',
  SECURITY_SUSPICIOUS_ACTIVITY = 'security.suspicious.activity',
  SECURITY_ACCESS_DENIED = 'security.access.denied',
  
  // Trade Events
  TRADE_DISCOVERY_REQUESTED = 'trade.discovery.requested',
  TRADE_LOOP_CREATED = 'trade.loop.created',
  TRADE_EXECUTED = 'trade.executed',
  TRADE_CANCELLED = 'trade.cancelled',
  
  // NFT Events
  NFT_SUBMITTED = 'nft.submitted',
  NFT_UPDATED = 'nft.updated',
  NFT_REMOVED = 'nft.removed',
  NFT_VALIDATED = 'nft.validated',
  
  // System Events
  SYSTEM_ERROR = 'system.error',
  SYSTEM_MAINTENANCE = 'system.maintenance',
  SYSTEM_BACKUP = 'system.backup',
  SYSTEM_RESTORE = 'system.restore',
  
  // Admin Events
  ADMIN_CONFIG_CHANGE = 'admin.config.change',
  ADMIN_USER_IMPERSONATION = 'admin.user.impersonation',
  ADMIN_SYSTEM_OVERRIDE = 'admin.system.override'
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AuditEventContext {
  // Request information
  requestId?: string;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  endpoint?: string;
  httpMethod?: string;
  
  // User/Tenant information
  tenantId?: string;
  userId?: string;
  apiKey?: string; // Sanitized (hashed)
  
  // Resource information
  resourceType?: string;
  resourceId?: string;
  resourceOwner?: string;
  
  // Operation details
  operation?: string;
  parameters?: Record<string, any>;
  result?: 'success' | 'failure' | 'partial';
  errorCode?: string;
  errorMessage?: string;
  
  // Metadata
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface AuditEvent {
  id: string;
  timestamp: Date;
  type: AuditEventType;
  severity: AuditSeverity;
  message: string;
  context: AuditEventContext;
  correlationId?: string;
  sequence?: number;
}

export interface AuditQuery {
  startDate?: Date;
  endDate?: Date;
  eventTypes?: AuditEventType[];
  severity?: AuditSeverity[];
  tenantId?: string;
  userId?: string;
  resourceType?: string;
  ipAddress?: string;
  limit?: number;
  offset?: number;
}

export class AuditLogger {
  private static instance: AuditLogger;
  private logger: Logger;
  private eventStorage: AuditEvent[] = []; // In-memory storage for now
  private sequenceNumber = 0;
  private correlationMap = new Map<string, string[]>(); // correlationId -> eventIds
  
  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('AuditLogger');
    this.startCleanupProcess();
  }
  
  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }
  
  /**
   * Log an audit event
   */
  public logEvent(
    type: AuditEventType,
    message: string,
    context: AuditEventContext = {},
    severity: AuditSeverity = AuditSeverity.LOW
  ): string {
    const eventId = SecurityUtils.generateSecureRandom({ length: 16 });
    const correlationId = context.requestId || SecurityUtils.generateSecureRandom({ length: 12 });
    
    const event: AuditEvent = {
      id: eventId,
      timestamp: new Date(),
      type,
      severity,
      message,
      context: this.sanitizeContext(context),
      correlationId,
      sequence: ++this.sequenceNumber
    };
    
    // Store event
    this.eventStorage.push(event);
    
    // Update correlation mapping
    if (!this.correlationMap.has(correlationId)) {
      this.correlationMap.set(correlationId, []);
    }
    this.correlationMap.get(correlationId)!.push(eventId);
    
    // Log to standard logging system
    this.logToStandardLogger(event);
    
    // Trigger alerts for high-severity events
    if (severity === AuditSeverity.HIGH || severity === AuditSeverity.CRITICAL) {
      this.triggerAlert(event);
    }
    
    return eventId;
  }
  
  /**
   * Log authentication event
   */
  public logAuth(
    type: AuditEventType,
    result: 'success' | 'failure',
    context: AuditEventContext = {}
  ): string {
    const severity = result === 'failure' ? AuditSeverity.MEDIUM : AuditSeverity.LOW;
    const message = `Authentication ${result}: ${type}`;
    
    return this.logEvent(type, message, {
      ...context,
      result,
      operation: 'authentication'
    }, severity);
  }
  
  /**
   * Log API usage event
   */
  public logAPIUsage(
    endpoint: string,
    method: string,
    statusCode: number,
    context: AuditEventContext = {}
  ): string {
    const severity = statusCode >= 400 ? AuditSeverity.MEDIUM : AuditSeverity.LOW;
    const result = statusCode < 400 ? 'success' : 'failure';
    const message = `API call: ${method} ${endpoint} -> ${statusCode}`;
    
    return this.logEvent(AuditEventType.API_KEY_USAGE, message, {
      ...context,
      endpoint,
      httpMethod: method,
      result,
      metadata: { statusCode }
    }, severity);
  }
  
  /**
   * Log security event
   */
  public logSecurity(
    type: AuditEventType,
    message: string,
    context: AuditEventContext = {},
    severity: AuditSeverity = AuditSeverity.HIGH
  ): string {
    return this.logEvent(type, message, {
      ...context,
      operation: 'security'
    }, severity);
  }
  
  /**
   * Log data operation
   */
  public logDataOperation(
    operation: 'create' | 'read' | 'update' | 'delete',
    resourceType: string,
    resourceId: string,
    context: AuditEventContext = {}
  ): string {
    const typeMap = {
      create: AuditEventType.DATA_CREATE,
      read: AuditEventType.DATA_READ,
      update: AuditEventType.DATA_UPDATE,
      delete: AuditEventType.DATA_DELETE
    };
    
    const message = `Data ${operation}: ${resourceType}/${resourceId}`;
    
    return this.logEvent(typeMap[operation], message, {
      ...context,
      operation,
      resourceType,
      resourceId
    });
  }
  
  /**
   * Extract audit context from Express request
   */
  public extractRequestContext(req: Request): AuditEventContext {
    // Extract and sanitize API key
    const xApiKey = req.headers['x-api-key'];
    const rawApiKey = (typeof xApiKey === 'string' ? xApiKey : null) || 
                     (req.headers.authorization?.startsWith('Bearer ') ? 
                      req.headers.authorization.substring(7) : null);
    
    const apiKey = rawApiKey ? SecurityUtils.hashForCache(rawApiKey, 'sha256') : undefined;
    
    return {
      requestId: (req as any).id || SecurityUtils.generateSecureRandom({ length: 12 }),
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip || req.connection.remoteAddress,
      endpoint: req.path,
      httpMethod: req.method,
      apiKey,
      metadata: {
        referer: req.get('Referer'),
        origin: req.get('Origin'),
        contentType: req.get('Content-Type')
      }
    };
  }
  
  /**
   * Query audit events
   */
  public queryEvents(query: AuditQuery = {}): AuditEvent[] {
    let events = [...this.eventStorage];
    
    // Apply filters
    if (query.startDate) {
      events = events.filter(e => e.timestamp >= query.startDate!);
    }
    
    if (query.endDate) {
      events = events.filter(e => e.timestamp <= query.endDate!);
    }
    
    if (query.eventTypes && query.eventTypes.length > 0) {
      events = events.filter(e => query.eventTypes!.includes(e.type));
    }
    
    if (query.severity && query.severity.length > 0) {
      events = events.filter(e => query.severity!.includes(e.severity));
    }
    
    if (query.tenantId) {
      events = events.filter(e => e.context.tenantId === query.tenantId);
    }
    
    if (query.userId) {
      events = events.filter(e => e.context.userId === query.userId);
    }
    
    if (query.resourceType) {
      events = events.filter(e => e.context.resourceType === query.resourceType);
    }
    
    if (query.ipAddress) {
      events = events.filter(e => e.context.ipAddress === query.ipAddress);
    }
    
    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Apply pagination
    if (query.offset) {
      events = events.slice(query.offset);
    }
    
    if (query.limit) {
      events = events.slice(0, query.limit);
    }
    
    return events;
  }
  
  /**
   * Get events by correlation ID
   */
  public getCorrelatedEvents(correlationId: string): AuditEvent[] {
    const eventIds = this.correlationMap.get(correlationId) || [];
    return this.eventStorage.filter(e => eventIds.includes(e.id));
  }
  
  /**
   * Generate audit report
   */
  public generateReport(query: AuditQuery = {}): {
    summary: Record<string, number>;
    events: AuditEvent[];
    timeRange: { start: Date; end: Date };
  } {
    const events = this.queryEvents(query);
    const summary: Record<string, number> = {};
    
    // Count events by type
    events.forEach(event => {
      summary[event.type] = (summary[event.type] || 0) + 1;
    });
    
    // Add severity counts
    Object.values(AuditSeverity).forEach(severity => {
      const count = events.filter(e => e.severity === severity).length;
      summary[`severity_${severity}`] = count;
    });
    
    const timeRange = {
      start: query.startDate || (events.length > 0 ? events[events.length - 1].timestamp : new Date()),
      end: query.endDate || (events.length > 0 ? events[0].timestamp : new Date())
    };
    
    return { summary, events, timeRange };
  }
  
  /**
   * Detect anomalies in audit logs
   */
  public detectAnomalies(): {
    suspiciousIPs: string[];
    unusualPatterns: string[];
    highVolumeUsers: string[];
  } {
    const recentEvents = this.queryEvents({
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    });
    
    // Detect suspicious IPs (multiple failures)
    const ipFailures = new Map<string, number>();
    recentEvents
      .filter(e => e.context.result === 'failure')
      .forEach(e => {
        const ip = e.context.ipAddress || 'unknown';
        ipFailures.set(ip, (ipFailures.get(ip) || 0) + 1);
      });
    
    const suspiciousIPs = Array.from(ipFailures.entries())
      .filter(([_, count]) => count > 10) // More than 10 failures
      .map(([ip, _]) => ip);
    
    // Detect unusual patterns (rapid API calls from same source)
    const userVolume = new Map<string, number>();
    recentEvents.forEach(e => {
      const key = e.context.apiKey || e.context.ipAddress || 'unknown';
      userVolume.set(key, (userVolume.get(key) || 0) + 1);
    });
    
    const highVolumeUsers = Array.from(userVolume.entries())
      .filter(([_, count]) => count > 1000) // More than 1000 requests
      .map(([user, _]) => user);
    
    // Detect unusual patterns
    const unusualPatterns: string[] = [];
    
    // Check for rapid authentication attempts
    const authEvents = recentEvents.filter(e => 
      e.type.startsWith('auth.') || e.type.includes('api.key')
    );
    if (authEvents.length > 100) {
      unusualPatterns.push('High volume authentication attempts');
    }
    
    // Check for after-hours activity (if applicable)
    const afterHoursEvents = recentEvents.filter(e => {
      const hour = e.timestamp.getHours();
      return hour < 6 || hour > 22; // Outside business hours
    });
    if (afterHoursEvents.length > recentEvents.length * 0.3) {
      unusualPatterns.push('High after-hours activity');
    }
    
    return { suspiciousIPs, unusualPatterns, highVolumeUsers };
  }
  
  /**
   * Sanitize context to remove sensitive information
   */
  private sanitizeContext(context: AuditEventContext): AuditEventContext {
    const sanitized = { ...context };
    
    // Sanitize parameters
    if (sanitized.parameters) {
      sanitized.parameters = SecurityUtils.sanitizeForLogging(sanitized.parameters);
    }
    
    // Sanitize metadata
    if (sanitized.metadata) {
      sanitized.metadata = SecurityUtils.sanitizeForLogging(sanitized.metadata);
    }
    
    // Ensure API key is already hashed/sanitized
    if (sanitized.apiKey && !sanitized.apiKey.startsWith('hash:')) {
      sanitized.apiKey = `hash:${SecurityUtils.hashForCache(sanitized.apiKey, 'sha256')}`;
    }
    
    return sanitized;
  }
  
  /**
   * Log event to standard logging system
   */
  private logToStandardLogger(event: AuditEvent): void {
    const logData = {
      auditEventId: event.id,
      type: event.type,
      severity: event.severity,
      correlationId: event.correlationId,
      sequence: event.sequence,
      context: event.context
    };
    
    switch (event.severity) {
      case AuditSeverity.CRITICAL:
        this.logger.error(`AUDIT: ${event.message}`, logData);
        break;
      case AuditSeverity.HIGH:
        this.logger.warn(`AUDIT: ${event.message}`, logData);
        break;
      case AuditSeverity.MEDIUM:
        this.logger.info(`AUDIT: ${event.message}`, logData);
        break;
      default:
        this.logger.debug(`AUDIT: ${event.message}`, logData);
    }
  }
  
  /**
   * Trigger alert for high-severity events
   */
  private triggerAlert(event: AuditEvent): void {
    // In a real implementation, this would:
    // - Send notifications to security team
    // - Integrate with SIEM systems
    // - Trigger automated responses
    // - Send webhooks to monitoring systems
    
    this.logger.error('SECURITY ALERT', {
      auditEventId: event.id,
      type: event.type,
      severity: event.severity,
      message: event.message,
      context: event.context,
      timestamp: event.timestamp
    });
  }
  
  /**
   * Start cleanup process to manage storage
   */
  private startCleanupProcess(): void {
    setInterval(() => {
      const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days
      const cutoff = new Date(Date.now() - maxAge);
      
      // Remove old events
      const oldCount = this.eventStorage.length;
      this.eventStorage = this.eventStorage.filter(e => e.timestamp >= cutoff);
      
      // Clean up correlation map
      for (const [correlationId, eventIds] of this.correlationMap.entries()) {
        const validEventIds = eventIds.filter(id => 
          this.eventStorage.some(e => e.id === id)
        );
        
        if (validEventIds.length === 0) {
          this.correlationMap.delete(correlationId);
        } else {
          this.correlationMap.set(correlationId, validEventIds);
        }
      }
      
      const newCount = this.eventStorage.length;
      if (oldCount !== newCount) {
        this.logger.info('Audit log cleanup completed', {
          removedEvents: oldCount - newCount,
          remainingEvents: newCount
        });
      }
    }, 24 * 60 * 60 * 1000); // Run daily
  }
}

/**
 * Audit middleware factory
 */
export const createAuditMiddleware = () => {
  const auditLogger = AuditLogger.getInstance();
  
  return (req: Request, res: any, next: any): void => {
    const context = auditLogger.extractRequestContext(req);
    
    // Log API usage after response
    res.on('finish', () => {
      auditLogger.logAPIUsage(
        req.path,
        req.method,
        res.statusCode,
        context
      );
    });
    
    // Make audit logger available to route handlers
    (req as any).auditLogger = auditLogger;
    (req as any).auditContext = context;
    
    next();
  };
};

export default AuditLogger; 