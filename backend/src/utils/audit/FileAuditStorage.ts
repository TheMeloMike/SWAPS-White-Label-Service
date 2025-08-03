import * as fs from 'fs/promises';
import * as path from 'path';
import { AuditEvent } from './AuditLogger';
import { LoggingService, Logger } from '../logging/LoggingService';

/**
 * File-based Audit Storage
 * 
 * Provides persistent storage for audit events using append-only log files.
 * Creates daily rotating log files for easy management and compliance.
 */
export class FileAuditStorage {
  private auditDir: string;
  private logger: Logger;
  private writeQueue: Promise<void> = Promise.resolve();
  
  constructor() {
    this.auditDir = process.env.AUDIT_LOG_DIR || path.join(process.cwd(), 'data', 'audit');
    this.logger = LoggingService.getInstance().createLogger('FileAuditStorage');
    this.ensureDirectoryExists();
  }
  
  /**
   * Append an audit event to the log file
   * Uses a write queue to ensure sequential writes
   */
  async append(event: AuditEvent): Promise<void> {
    // Queue writes to prevent concurrent file access issues
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        const date = new Date().toISOString().split('T')[0];
        const filename = `audit-${date}.log`;
        const filepath = path.join(this.auditDir, filename);
        
        // Convert event to JSON line format
        const logLine = JSON.stringify({
          ...event,
          timestamp: event.timestamp.toISOString(),
          _version: '1.0' // Schema version for future compatibility
        }) + '\n';
        
        // Append to file (creates if doesn't exist)
        await fs.appendFile(filepath, logLine, 'utf8');
        
        // Also create an index file for quick lookups
        await this.updateIndex(event, filepath);
      } catch (error) {
        this.logger.error('Failed to write audit event to file', {
          error: error instanceof Error ? error.message : String(error),
          eventId: event.id,
          eventType: event.type
        });
        
        // Don't throw - audit logging should not break the application
        // But do log this as a critical issue
        if (process.env.NODE_ENV === 'production') {
          // In production, this should trigger an alert
          console.error('[CRITICAL] Audit logging failure:', error);
        }
      }
    });
    
    return this.writeQueue;
  }
  
  /**
   * Read audit events from files (for querying)
   */
  async query(options: {
    startDate?: Date;
    endDate?: Date;
    type?: string;
    tenantId?: string;
    limit?: number;
  } = {}): Promise<AuditEvent[]> {
    const events: AuditEvent[] = [];
    
    try {
      // Get list of log files in date range
      const files = await this.getLogFilesInRange(options.startDate, options.endDate);
      
      // Read and parse each file
      for (const file of files) {
        const content = await fs.readFile(file, 'utf8');
        const lines = content.trim().split('\n').filter(line => line);
        
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            
            // Apply filters
            if (options.type && event.type !== options.type) continue;
            if (options.tenantId && event.context?.tenantId !== options.tenantId) continue;
            
            // Reconstruct Date object
            event.timestamp = new Date(event.timestamp);
            
            events.push(event);
            
            if (options.limit && events.length >= options.limit) {
              return events;
            }
          } catch (parseError) {
            this.logger.warn('Failed to parse audit log line', {
              file,
              line: line.substring(0, 100) + '...',
              error: parseError
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to query audit logs', {
        error: error instanceof Error ? error.message : String(error),
        options
      });
    }
    
    return events;
  }
  
  /**
   * Ensure audit directory exists
   */
  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.auditDir, { recursive: true });
      
      // Create a README in the audit directory
      const readmePath = path.join(this.auditDir, 'README.txt');
      const readmeContent = `SWAPS Audit Logs
================

This directory contains audit logs for the SWAPS White Label API.
Each file represents one day of audit events in JSON Lines format.

Files are named: audit-YYYY-MM-DD.log

Each line is a JSON object representing one audit event.

DO NOT MODIFY THESE FILES - They are append-only for compliance.

For queries, use the AuditLogger API rather than reading files directly.
`;
      
      try {
        await fs.access(readmePath);
      } catch {
        // File doesn't exist, create it
        await fs.writeFile(readmePath, readmeContent, 'utf8');
      }
    } catch (error) {
      this.logger.error('Failed to create audit directory', {
        error: error instanceof Error ? error.message : String(error),
        path: this.auditDir
      });
    }
  }
  
  /**
   * Update index file for quick event lookups
   */
  private async updateIndex(event: AuditEvent, filepath: string): Promise<void> {
    // Simple index by event type and date
    const indexPath = path.join(this.auditDir, 'index.json');
    
    try {
      let index: any = {};
      
      try {
        const existingIndex = await fs.readFile(indexPath, 'utf8');
        index = JSON.parse(existingIndex);
      } catch {
        // Index doesn't exist yet
      }
      
      // Update index
      const date = event.timestamp.toISOString().split('T')[0];
      if (!index[date]) {
        index[date] = {
          file: filepath,
          types: {},
          count: 0
        };
      }
      
      index[date].count++;
      index[date].types[event.type] = (index[date].types[event.type] || 0) + 1;
      
      // Write updated index
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
    } catch (error) {
      // Index update failure is not critical
      this.logger.debug('Failed to update audit index', { error });
    }
  }
  
  /**
   * Get log files within date range
   */
  private async getLogFilesInRange(startDate?: Date, endDate?: Date): Promise<string[]> {
    const files = await fs.readdir(this.auditDir);
    const logFiles = files
      .filter(f => f.startsWith('audit-') && f.endsWith('.log'))
      .map(f => path.join(this.auditDir, f))
      .sort();
    
    if (!startDate && !endDate) {
      return logFiles;
    }
    
    // Filter by date range
    return logFiles.filter(file => {
      const match = path.basename(file).match(/audit-(\d{4}-\d{2}-\d{2})\.log/);
      if (!match) return false;
      
      const fileDate = new Date(match[1]);
      if (startDate && fileDate < startDate) return false;
      if (endDate && fileDate > endDate) return false;
      
      return true;
    });
  }
  
  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalEvents: number;
    totalSize: number;
    oldestLog: Date | null;
    newestLog: Date | null;
    fileCount: number;
  }> {
    try {
      const files = await this.getLogFilesInRange();
      let totalEvents = 0;
      let totalSize = 0;
      
      for (const file of files) {
        const stat = await fs.stat(file);
        totalSize += stat.size;
        
        const content = await fs.readFile(file, 'utf8');
        totalEvents += content.trim().split('\n').filter(line => line).length;
      }
      
      const dates = files
        .map(f => {
          const match = path.basename(f).match(/audit-(\d{4}-\d{2}-\d{2})\.log/);
          return match ? new Date(match[1]) : null;
        })
        .filter(d => d) as Date[];
      
      return {
        totalEvents,
        totalSize,
        oldestLog: dates.length > 0 ? dates[0] : null,
        newestLog: dates.length > 0 ? dates[dates.length - 1] : null,
        fileCount: files.length
      };
    } catch (error) {
      return {
        totalEvents: 0,
        totalSize: 0,
        oldestLog: null,
        newestLog: null,
        fileCount: 0
      };
    }
  }
}

export default FileAuditStorage;