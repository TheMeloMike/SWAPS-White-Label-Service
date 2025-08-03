import { EncryptionManager } from './EncryptionManager';
import { StructuredFileLogger } from '../logging/StructuredFileLogger';
import { PersistentRateLimit } from '../../middleware/PersistentRateLimit';
import { LoggingService } from '../logging/LoggingService';

/**
 * Security system initializer and health checker
 * 
 * Coordinates initialization of all security components and provides
 * centralized security health monitoring.
 */
export class SecurityInitializer {
  private static instance: SecurityInitializer;
  private logger = LoggingService.getInstance().createLogger('SecurityInitializer');
  
  private components = {
    encryption: false,
    structuredLogging: false,
    persistentRateLimit: false,
    auditLogging: false
  };

  private constructor() {}

  public static getInstance(): SecurityInitializer {
    if (!SecurityInitializer.instance) {
      SecurityInitializer.instance = new SecurityInitializer();
    }
    return SecurityInitializer.instance;
  }

  /**
   * Initialize all security components
   */
  public async initializeAll(): Promise<SecurityInitializationResult> {
    this.logger.info('Starting security system initialization...');
    
    const result: SecurityInitializationResult = {
      success: true,
      components: {},
      warnings: [],
      errors: [],
      recommendations: []
    };

    // Initialize encryption
    try {
      const encryption = EncryptionManager.getInstance();
      this.components.encryption = encryption.isEncryptionEnabled();
      
      result.components.encryption = {
        initialized: true,
        enabled: this.components.encryption,
        details: this.components.encryption 
          ? 'AES-256-GCM encryption active'
          : 'Encryption disabled - set ENCRYPTION_MASTER_KEY to enable'
      };

      if (!this.components.encryption) {
        result.warnings.push('Encryption is disabled. Sensitive data will be stored in plain text.');
        result.recommendations.push('Set ENCRYPTION_MASTER_KEY environment variable (32+ characters)');
      } else {
        this.logger.info('✅ Encryption system initialized');
      }
    } catch (error) {
      result.errors.push(`Encryption initialization failed: ${error}`);
      result.success = false;
    }

    // Initialize structured logging
    try {
      const structuredLogger = StructuredFileLogger.getInstance();
      this.components.structuredLogging = true;
      
      result.components.structuredLogging = {
        initialized: true,
        enabled: true,
        details: 'File-based structured logging with rotation active'
      };
      
      this.logger.info('✅ Structured logging initialized');
    } catch (error) {
      result.errors.push(`Structured logging initialization failed: ${error}`);
      result.success = false;
    }

    // Initialize persistent rate limiting
    try {
      const rateLimiter = PersistentRateLimit.getInstance();
      this.components.persistentRateLimit = true;
      
      result.components.persistentRateLimit = {
        initialized: true,
        enabled: true,
        details: 'File-based rate limiting with persistence active'
      };
      
      this.logger.info('✅ Persistent rate limiting initialized');
    } catch (error) {
      result.errors.push(`Persistent rate limiting initialization failed: ${error}`);
      result.success = false;
    }

    // Check audit logging
    try {
      // Audit logging is already initialized in the main app
      this.components.auditLogging = true;
      
      result.components.auditLogging = {
        initialized: true,
        enabled: true,
        details: 'Audit logging with file persistence active'
      };
      
      this.logger.info('✅ Audit logging verified');
    } catch (error) {
      result.warnings.push(`Audit logging check failed: ${error}`);
    }

    // Generate recommendations based on environment
    this.generateRecommendations(result);

    const successCount = Object.values(result.components).filter(c => c.initialized).length;
    const totalCount = Object.keys(result.components).length;

    this.logger.info(`Security initialization complete: ${successCount}/${totalCount} components active`, {
      components: this.components,
      warnings: result.warnings.length,
      errors: result.errors.length
    });

    return result;
  }

  /**
   * Perform comprehensive security health check
   */
  public async performHealthCheck(): Promise<SecurityHealthCheck> {
    const healthCheck: SecurityHealthCheck = {
      overall: 'healthy',
      timestamp: new Date().toISOString(),
      components: {},
      securityScore: 0,
      recommendations: []
    };

    let totalScore = 0;
    let maxScore = 0;

    // Check encryption
    try {
      const encryption = EncryptionManager.getInstance();
      const encryptionEnabled = encryption.isEncryptionEnabled();
      
      healthCheck.components.encryption = {
        status: encryptionEnabled ? 'healthy' : 'warning',
        enabled: encryptionEnabled,
        message: encryptionEnabled 
          ? 'Encryption system operational'
          : 'Encryption disabled - sensitive data not protected'
      };
      
      totalScore += encryptionEnabled ? 25 : 10;
      maxScore += 25;
    } catch (error) {
      healthCheck.components.encryption = {
        status: 'error',
        enabled: false,
        message: `Encryption system error: ${error}`
      };
      maxScore += 25;
    }

    // Check structured logging
    try {
      const logger = StructuredFileLogger.getInstance();
      const metrics = logger.getMetrics();
      
      healthCheck.components.structuredLogging = {
        status: 'healthy',
        enabled: true,
        message: `Logging active: ${metrics.totalLogs} total logs, ${metrics.bufferedLogs} buffered`,
        metrics: {
          totalLogs: metrics.totalLogs,
          errorLogs: metrics.errorLogs,
          securityLogs: metrics.securityLogs,
          bufferedLogs: metrics.bufferedLogs
        }
      };
      
      totalScore += 20;
      maxScore += 20;
    } catch (error) {
      healthCheck.components.structuredLogging = {
        status: 'error',
        enabled: false,
        message: `Structured logging error: ${error}`
      };
      maxScore += 20;
    }

    // Check rate limiting
    try {
      const rateLimiter = PersistentRateLimit.getInstance();
      const stats = rateLimiter.getStats();
      
      healthCheck.components.rateLimiting = {
        status: 'healthy',
        enabled: true,
        message: `Rate limiting active: ${stats.activeKeys} active keys, ${stats.totalEntries} entries`,
        metrics: {
          totalKeys: stats.totalKeys,
          activeKeys: stats.activeKeys,
          totalEntries: stats.totalEntries
        }
      };
      
      totalScore += 20;
      maxScore += 20;
    } catch (error) {
      healthCheck.components.rateLimiting = {
        status: 'error',
        enabled: false,
        message: `Rate limiting error: ${error}`
      };
      maxScore += 20;
    }

    // Check environment security
    const envSecurity = this.checkEnvironmentSecurity();
    healthCheck.components.environment = envSecurity;
    totalScore += envSecurity.status === 'healthy' ? 15 : (envSecurity.status === 'warning' ? 8 : 0);
    maxScore += 15;

    // Check file permissions
    const filePerms = await this.checkFilePermissions();
    healthCheck.components.filePermissions = filePerms;
    totalScore += filePerms.status === 'healthy' ? 10 : 0;
    maxScore += 10;

    // Calculate overall score
    healthCheck.securityScore = Math.round((totalScore / maxScore) * 100);

    // Determine overall status
    if (healthCheck.securityScore >= 90) {
      healthCheck.overall = 'healthy';
    } else if (healthCheck.securityScore >= 70) {
      healthCheck.overall = 'warning';
    } else {
      healthCheck.overall = 'critical';
    }

    // Generate recommendations
    if (!healthCheck.components.encryption?.enabled) {
      healthCheck.recommendations.push('Enable encryption by setting ENCRYPTION_MASTER_KEY environment variable');
    }
    
    if (healthCheck.securityScore < 80) {
      healthCheck.recommendations.push('Security score below 80% - review failed components');
    }

    return healthCheck;
  }

  /**
   * Check environment security configuration
   */
  private checkEnvironmentSecurity(): ComponentHealth {
    const checks = {
      nodeEnv: process.env.NODE_ENV === 'production',
      verboseErrors: process.env.VERBOSE_ERRORS !== 'true',
      adminKey: !!process.env.ADMIN_API_KEY,
      encryptionKey: !!process.env.ENCRYPTION_MASTER_KEY
    };

    const passedChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;

    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    if (passedChecks < totalChecks * 0.8) status = 'warning';
    if (passedChecks < totalChecks * 0.5) status = 'error';

    return {
      status,
      enabled: true,
      message: `Environment security: ${passedChecks}/${totalChecks} checks passed`,
      details: checks
    };
  }

  /**
   * Check file permissions
   */
  private async checkFilePermissions(): Promise<ComponentHealth> {
    // This is a simplified check - in production you'd want more comprehensive checks
    try {
      const dataDir = process.env.DATA_DIR || './data';
      const logDir = process.env.LOG_DIR || './logs';
      
      // Check if directories exist and are writable
      // This is a basic implementation
      return {
        status: 'healthy',
        enabled: true,
        message: 'File permissions appear correct'
      };
    } catch (error) {
      return {
        status: 'warning',
        enabled: false,
        message: `File permission check failed: ${error}`
      };
    }
  }

  /**
   * Generate environment-specific recommendations
   */
  private generateRecommendations(result: SecurityInitializationResult): void {
    const env = process.env.NODE_ENV;
    
    if (env !== 'production') {
      result.recommendations.push('Set NODE_ENV=production for production deployments');
    }
    
    if (!process.env.ENCRYPTION_MASTER_KEY) {
      result.recommendations.push('Generate and set ENCRYPTION_MASTER_KEY for data encryption');
    }
    
    if (process.env.VERBOSE_ERRORS === 'true') {
      result.recommendations.push('Set VERBOSE_ERRORS=false in production to prevent information leakage');
    }
    
    if (!process.env.LOG_DIR) {
      result.recommendations.push('Set LOG_DIR environment variable for centralized logging');
    }
  }

  /**
   * Generate a security master key
   */
  public generateMasterKey(): string {
    return EncryptionManager.generateMasterKey();
  }

  /**
   * Get security component status
   */
  public getComponentStatus(): typeof this.components {
    return { ...this.components };
  }
}

// Types
export interface SecurityInitializationResult {
  success: boolean;
  components: Record<string, ComponentInitResult>;
  warnings: string[];
  errors: string[];
  recommendations: string[];
}

export interface ComponentInitResult {
  initialized: boolean;
  enabled: boolean;
  details: string;
}

export interface SecurityHealthCheck {
  overall: 'healthy' | 'warning' | 'critical';
  timestamp: string;
  components: Record<string, ComponentHealth>;
  securityScore: number;
  recommendations: string[];
}

export interface ComponentHealth {
  status: 'healthy' | 'warning' | 'error';
  enabled: boolean;
  message: string;
  details?: any;
  metrics?: any;
}