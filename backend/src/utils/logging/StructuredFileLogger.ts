import fs from 'fs/promises';
import path from 'path';
import { LoggingService } from './LoggingService';

/**
 * Structured file logger with automatic rotation and security event correlation
 * 
 * Features:
 * - Daily log rotation
 * - Structured JSON logging
 * - Security event correlation
 * - Automatic cleanup of old logs
 * - Performance metrics
 */
export class StructuredFileLogger {
  private static instance: StructuredFileLogger;
  private logger = LoggingService.getInstance().createLogger('StructuredFileLogger');
  
  private logDir: string;
  private maxLogFiles: number;
  private maxLogSize: number;
  private currentLogFile: string | null = null;
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  
  // Performance tracking
  private metrics = {
    totalLogs: 0,
    errorLogs: 0,
    securityLogs: 0,
    lastFlush: Date.now(),
    avgWriteTime: 0
  };

  private constructor() {
    this.logDir = process.env.LOG_DIR || './logs';
    this.maxLogFiles = parseInt(process.env.MAX_LOG_FILES || '30');
    this.maxLogSize = parseInt(process.env.MAX_LOG_SIZE || '10485760'); // 10MB default
    
    this.initialize();
  }

  public static getInstance(): StructuredFileLogger {
    if (!StructuredFileLogger.instance) {
      StructuredFileLogger.instance = new StructuredFileLogger();
    }
    return StructuredFileLogger.instance;
  }

  /**
   * Initialize the logger
   */
  private async initialize(): Promise<void> {
    try {
      await this.ensureLogDirectory();
      await this.rotateIfNeeded();
      this.startFlushTimer();
      
      this.logger.info('Structured file logger initialized', {
        logDir: this.logDir,
        maxLogFiles: this.maxLogFiles,
        maxLogSize: this.maxLogSize
      });
    } catch (error) {
      this.logger.error('Failed to initialize structured file logger', { error });
    }
  }

  /**
   * Log a structured entry
   */
  public log(level: LogLevel, message: string, data: any = {}, category: LogCategory = 'general'): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data: this.sanitizeLogData(data),
      requestId: data.requestId || this.generateRequestId(),
      sessionId: data.sessionId,
      userId: data.userId,
      tenantId: data.tenantId,
      ip: data.ip,
      userAgent: data.userAgent,
      endpoint: data.endpoint,
      method: data.method,
      responseTime: data.responseTime,
      statusCode: data.statusCode,
      correlationId: data.correlationId || data.requestId
    };

    // Add to buffer
    this.logBuffer.push(entry);
    this.updateMetrics(entry);

    // Immediate flush for errors and security events
    if (level === 'error' || level === 'critical' || category === 'security') {
      this.flushLogs();
    }
  }

  /**
   * Log security events
   */
  public security(event: SecurityEvent, message: string, data: any = {}): void {
    this.log('info', message, {
      ...data,
      securityEvent: event,
      severity: this.getSecuritySeverity(event)
    }, 'security');
  }

  /**
   * Log API requests
   */
  public api(req: any, res: any, responseTime: number): void {
    this.log('info', 'API Request', {
      method: req.method,
      endpoint: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.id,
      tenantId: req.tenant?.id,
      statusCode: res.statusCode,
      responseTime,
      contentLength: res.get('Content-Length')
    }, 'api');
  }

  /**
   * Log performance metrics
   */
  public performance(metric: string, value: number, unit: string, data: any = {}): void {
    this.log('info', `Performance: ${metric}`, {
      ...data,
      metric,
      value,
      unit,
      timestamp: Date.now()
    }, 'performance');
  }

  /**
   * Log errors with stack traces
   */
  public error(error: Error, context: any = {}): void {
    this.log('error', error.message, {
      ...context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: (error as any).cause
      }
    }, 'error');
  }

  /**
   * Flush logs to file
   */
  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const startTime = Date.now();
    const logsToWrite = [...this.logBuffer];
    this.logBuffer = [];
    
    try {
      await this.rotateIfNeeded();

      const logLines = logsToWrite.map(entry => JSON.stringify(entry)).join('\n') + '\n';
      
      if (this.currentLogFile) {
        await fs.appendFile(this.currentLogFile, logLines, 'utf8');
      }

      // Update metrics
      this.metrics.totalLogs += logsToWrite.length;
      this.metrics.lastFlush = Date.now();
      this.metrics.avgWriteTime = (this.metrics.avgWriteTime + (Date.now() - startTime)) / 2;

    } catch (error) {
      this.logger.error('Failed to flush logs', { error });
      // Re-add logs to buffer if write failed
      this.logBuffer.unshift(...logsToWrite);
    }
  }

  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    this.flushInterval = setInterval(() => {
      this.flushLogs();
    }, 5000); // Flush every 5 seconds
  }

  /**
   * Rotate log file if needed
   */
  private async rotateIfNeeded(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const expectedLogFile = path.join(this.logDir, `swaps-${today}.json`);

    // Check if we need a new file (new day or file too large)
    if (this.currentLogFile !== expectedLogFile) {
      this.currentLogFile = expectedLogFile;
    } else if (this.currentLogFile) {
      try {
        const stats = await fs.stat(this.currentLogFile);
        if (stats.size > this.maxLogSize) {
          // Create a new file with hour suffix
          const hour = new Date().getHours().toString().padStart(2, '0');
          this.currentLogFile = path.join(this.logDir, `swaps-${today}-${hour}.json`);
        }
      } catch {
        // File doesn't exist yet, that's fine
      }
    }

    // Clean up old log files
    await this.cleanupOldLogs();
  }

  /**
   * Clean up old log files
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files
        .filter(file => file.startsWith('swaps-') && file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(this.logDir, file),
          stats: null as any
        }));

      // Get file stats
      for (const file of logFiles) {
        try {
          file.stats = await fs.stat(file.path);
        } catch {
          // Ignore files we can't stat
        }
      }

      // Sort by creation time and remove old files
      const validFiles = logFiles
        .filter(f => f.stats)
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

      if (validFiles.length > this.maxLogFiles) {
        const filesToDelete = validFiles.slice(this.maxLogFiles);
        
        for (const file of filesToDelete) {
          await fs.unlink(file.path);
          this.logger.debug(`Deleted old log file: ${file.name}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old logs', { error });
    }
  }

  /**
   * Ensure log directory exists
   */
  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.access(this.logDir);
    } catch {
      await fs.mkdir(this.logDir, { recursive: true });
    }
  }

  /**
   * Sanitize log data to prevent sensitive information leakage
   */
  private sanitizeLogData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sensitiveFields = [
      'password', 'apiKey', 'secret', 'token', 'key', 'authorization',
      'credit_card', 'ssn', 'private_key', 'wallet_private_key'
    ];

    const sanitized = { ...data };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeLogData(value);
      }
    }

    return sanitized;
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get security event severity
   */
  private getSecuritySeverity(event: SecurityEvent): string {
    const highSeverityEvents = [
      'auth_failure_repeated', 'rate_limit_exceeded', 'injection_attempt',
      'unauthorized_access', 'data_breach_attempt'
    ];
    
    return highSeverityEvents.includes(event) ? 'HIGH' : 'MEDIUM';
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(entry: LogEntry): void {
    this.metrics.totalLogs++;
    
    if (entry.level === 'error' || entry.level === 'critical') {
      this.metrics.errorLogs++;
    }
    
    if (entry.category === 'security') {
      this.metrics.securityLogs++;
    }
  }

  /**
   * Get current metrics
   */
  public getMetrics(): LoggerMetrics {
    return {
      ...this.metrics,
      bufferedLogs: this.logBuffer.length,
      currentLogFile: this.currentLogFile,
      uptime: Date.now() - this.metrics.lastFlush
    };
  }

  /**
   * Search logs by criteria
   */
  public async searchLogs(criteria: LogSearchCriteria): Promise<LogEntry[]> {
    // This is a basic implementation - in production you'd want more sophisticated indexing
    const results: LogEntry[] = [];
    
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(f => f.startsWith('swaps-') && f.endsWith('.json'));
      
      for (const file of logFiles.slice(0, 10)) { // Limit to recent files
        const content = await fs.readFile(path.join(this.logDir, file), 'utf8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          try {
            const entry = JSON.parse(line) as LogEntry;
            
            if (this.matchesCriteria(entry, criteria)) {
              results.push(entry);
            }
            
            if (results.length >= (criteria.limit || 100)) {
              return results;
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to search logs', { error });
    }
    
    return results;
  }

  /**
   * Check if log entry matches search criteria
   */
  private matchesCriteria(entry: LogEntry, criteria: LogSearchCriteria): boolean {
    if (criteria.level && entry.level !== criteria.level) return false;
    if (criteria.category && entry.category !== criteria.category) return false;
    if (criteria.tenantId && entry.tenantId !== criteria.tenantId) return false;
    if (criteria.requestId && entry.requestId !== criteria.requestId) return false;
    
    if (criteria.startTime && new Date(entry.timestamp) < new Date(criteria.startTime)) return false;
    if (criteria.endTime && new Date(entry.timestamp) > new Date(criteria.endTime)) return false;
    
    if (criteria.message && !entry.message.toLowerCase().includes(criteria.message.toLowerCase())) return false;
    
    return true;
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    await this.flushLogs();
    this.logger.info('Structured file logger shutdown complete');
  }
}

// Types
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';
export type LogCategory = 'general' | 'security' | 'api' | 'performance' | 'error' | 'audit' | 'system';
export type SecurityEvent = 
  | 'auth_success' | 'auth_failure' | 'auth_failure_repeated'
  | 'rate_limit_exceeded' | 'injection_attempt' 
  | 'unauthorized_access' | 'data_breach_attempt'
  | 'api_key_created' | 'api_key_rotated'
  | 'security_health_check' | 'rate_limit_reset'
  | 'encryption_key_generated' | 'log_search';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data: any;
  requestId?: string;
  sessionId?: string;
  userId?: string;
  tenantId?: string;
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  responseTime?: number;
  statusCode?: number;
  correlationId?: string;
}

export interface LoggerMetrics {
  totalLogs: number;
  errorLogs: number;
  securityLogs: number;
  bufferedLogs: number;
  lastFlush: number;
  avgWriteTime: number;
  currentLogFile: string | null;
  uptime: number;
}

export interface LogSearchCriteria {
  level?: LogLevel;
  category?: LogCategory;
  tenantId?: string;
  requestId?: string;
  startTime?: string;
  endTime?: string;
  message?: string;
  limit?: number;
}