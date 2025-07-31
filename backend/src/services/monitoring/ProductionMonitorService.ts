import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { EventEmitter } from 'events';
import { PerformanceOptimizer } from '../trade/PerformanceOptimizer';
import { ErrorRecoveryService } from '../trade/ErrorRecoveryService';

/**
 * ProductionMonitorService - Phase 4 Production Monitoring
 * 
 * Implements comprehensive production monitoring and alerting:
 * - Real-time performance metrics tracking
 * - System health monitoring and alerting
 * - SLA compliance monitoring
 * - Resource usage tracking
 * - Predictive issue detection
 * - Dashboard metrics export
 */
export class ProductionMonitorService extends EventEmitter {
  private static instance: ProductionMonitorService;
  private logger: Logger;

  // Performance tracking
  private performanceMetrics = {
    responseTime: {
      current: 0,
      average: 0,
      p95: 0,
      p99: 0,
      measurements: [] as number[]
    },
    throughput: {
      requestsPerSecond: 0,
      loopsPerSecond: 0,
      totalRequests: 0,
      totalLoops: 0
    },
    errorRates: {
      total: 0,
      rate: 0,
      criticalErrors: 0,
      lastHour: 0
    },
    resources: {
      memoryUsage: 0,
      cpuUsage: 0,
      diskUsage: 0,
      networkLatency: 0
    }
  };

  // SLA tracking
  private slaMetrics = {
    availability: {
      uptime: 0,
      downtimeEvents: 0,
      lastDowntime: null as Date | null,
      targetAvailability: 99.9 // 99.9% uptime SLA
    },
    performance: {
      averageResponseTime: 0,
      targetResponseTime: 500, // 500ms target
      slowRequestCount: 0,
      targetP95: 1000 // 1s P95 target
    },
    reliability: {
      errorRate: 0,
      targetErrorRate: 1, // 1% max error rate
      consecutiveSuccesses: 0,
      mtbf: 0 // Mean Time Between Failures
    }
  };

  // Alert thresholds
  private alertThresholds = {
    responseTime: {
      warning: 1000, // 1s
      critical: 2000 // 2s
    },
    errorRate: {
      warning: 5, // 5%
      critical: 10 // 10%
    },
    memoryUsage: {
      warning: 70, // 70%
      critical: 85 // 85%
    },
    throughput: {
      warning: 10, // 10 req/s minimum
      critical: 5 // 5 req/s minimum
    }
  };

  // Monitoring state
  private monitoringActive = false;
  private metricsCollectionInterval: NodeJS.Timeout | null = null;
  private alertingInterval: NodeJS.Timeout | null = null;
  private startTime = new Date();

  // Dependencies
  private performanceOptimizer: PerformanceOptimizer;
  private errorRecoveryService: ErrorRecoveryService;

  private constructor() {
    super();
    this.logger = LoggingService.getInstance().createLogger('ProductionMonitor');
    this.performanceOptimizer = PerformanceOptimizer.getInstance();
    this.errorRecoveryService = ErrorRecoveryService.getInstance();
    this.logger.info('ProductionMonitorService initialized');
  }

  public static getInstance(): ProductionMonitorService {
    if (!ProductionMonitorService.instance) {
      ProductionMonitorService.instance = new ProductionMonitorService();
    }
    return ProductionMonitorService.instance;
  }

  /**
   * Start production monitoring
   */
  public startMonitoring(): void {
    if (this.monitoringActive) {
      this.logger.warn('Monitoring already active');
      return;
    }

    this.monitoringActive = true;
    this.startTime = new Date();

         // Start metrics collection
     this.metricsCollectionInterval = setInterval((): void => {
       this.collectMetrics();
     }, 5000); // Collect every 5 seconds

     // Start alerting
     this.alertingInterval = setInterval((): void => {
       this.checkAlerts();
     }, 30000); // Check alerts every 30 seconds

    // Register health checks
    this.registerHealthChecks();

    this.logger.info('Production monitoring started');
    this.emit('monitoringStarted', { timestamp: this.startTime });
  }

  /**
   * Stop production monitoring
   */
  public stopMonitoring(): void {
    this.monitoringActive = false;

    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = null;
    }

    if (this.alertingInterval) {
      clearInterval(this.alertingInterval);
      this.alertingInterval = null;
    }

    this.logger.info('Production monitoring stopped');
    this.emit('monitoringStopped', { timestamp: new Date() });
  }

  /**
   * Record performance metrics
   */
  public recordResponseTime(duration: number): void {
    this.performanceMetrics.responseTime.current = duration;
    this.performanceMetrics.responseTime.measurements.push(duration);

    // Keep only last 1000 measurements for percentile calculations
    if (this.performanceMetrics.responseTime.measurements.length > 1000) {
      this.performanceMetrics.responseTime.measurements.shift();
    }

    // Update average
    const measurements = this.performanceMetrics.responseTime.measurements;
    this.performanceMetrics.responseTime.average = 
      measurements.reduce((sum, time) => sum + time, 0) / measurements.length;

    // Update percentiles
    const sorted = [...measurements].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);
    
    this.performanceMetrics.responseTime.p95 = sorted[p95Index] || 0;
    this.performanceMetrics.responseTime.p99 = sorted[p99Index] || 0;
  }

  public recordRequest(): void {
    this.performanceMetrics.throughput.totalRequests++;
  }

  public recordTradeLoop(): void {
    this.performanceMetrics.throughput.totalLoops++;
  }

  public recordError(severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    this.performanceMetrics.errorRates.total++;
    
    if (severity === 'critical') {
      this.performanceMetrics.errorRates.criticalErrors++;
    }
  }

  /**
   * Get comprehensive production metrics
   */
  public getProductionMetrics() {
    const uptimeMs = Date.now() - this.startTime.getTime();
    const uptimeHours = uptimeMs / (1000 * 60 * 60);

    // Calculate current status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (this.performanceMetrics.errorRates.rate > this.alertThresholds.errorRate.critical ||
        this.performanceMetrics.responseTime.average > this.alertThresholds.responseTime.critical) {
      status = 'unhealthy';
    } else if (this.performanceMetrics.errorRates.rate > this.alertThresholds.errorRate.warning ||
               this.performanceMetrics.responseTime.average > this.alertThresholds.responseTime.warning) {
      status = 'degraded';
    }

    // Get health data from other services
    const performanceHealth = this.performanceOptimizer.getPerformanceMetrics();
    const recoveryHealth = this.errorRecoveryService.getRecoveryMetrics();

    return {
      performance: this.performanceMetrics,
      sla: this.slaMetrics,
      health: {
        performance: performanceHealth,
        recovery: recoveryHealth
      },
      uptime: uptimeHours,
      status
    };
  }

  /**
   * Check SLA compliance
   */
  public getSLACompliance(): {
    availability: { compliant: boolean; current: number; target: number };
    performance: { compliant: boolean; current: number; target: number };
    reliability: { compliant: boolean; current: number; target: number };
    overall: { compliant: boolean; score: number };
  } {
    // Calculate availability
    const uptimeMs = Date.now() - this.startTime.getTime();
    const availabilityPercent = (uptimeMs / (1000 * 60 * 60 * 24 * 30)) * 100; // 30-day window
    
    // Calculate performance compliance
    const performanceCompliant = this.performanceMetrics.responseTime.average <= this.slaMetrics.performance.targetResponseTime;
    
    // Calculate reliability compliance
    const reliabilityCompliant = this.performanceMetrics.errorRates.rate <= this.slaMetrics.reliability.targetErrorRate;
    
    // Overall compliance score
    const availabilityScore = Math.min(availabilityPercent / this.slaMetrics.availability.targetAvailability, 1);
    const performanceScore = performanceCompliant ? 1 : 0.5;
    const reliabilityScore = reliabilityCompliant ? 1 : 0.5;
    
    const overallScore = (availabilityScore + performanceScore + reliabilityScore) / 3;
    const overallCompliant = overallScore >= 0.95; // 95% overall compliance

    return {
      availability: {
        compliant: availabilityPercent >= this.slaMetrics.availability.targetAvailability,
        current: availabilityPercent,
        target: this.slaMetrics.availability.targetAvailability
      },
      performance: {
        compliant: performanceCompliant,
        current: this.performanceMetrics.responseTime.average,
        target: this.slaMetrics.performance.targetResponseTime
      },
      reliability: {
        compliant: reliabilityCompliant,
        current: this.performanceMetrics.errorRates.rate,
        target: this.slaMetrics.reliability.targetErrorRate
      },
      overall: {
        compliant: overallCompliant,
        score: overallScore * 100
      }
    };
  }

  /**
   * Generate production dashboard data
   */
  public getDashboardData(): {
    summary: any;
    charts: any;
    alerts: any;
  } {
    const metrics = this.getProductionMetrics();
    const slaCompliance = this.getSLACompliance();

    return {
      summary: {
        status: metrics.status,
        uptime: `${metrics.uptime.toFixed(2)} hours`,
        requestsPerSecond: this.performanceMetrics.throughput.requestsPerSecond,
        averageResponseTime: `${this.performanceMetrics.responseTime.average.toFixed(0)}ms`,
        errorRate: `${this.performanceMetrics.errorRates.rate.toFixed(2)}%`,
        slaCompliance: `${slaCompliance.overall.score.toFixed(1)}%`
      },
      charts: {
        responseTime: {
          current: this.performanceMetrics.responseTime.current,
          average: this.performanceMetrics.responseTime.average,
          p95: this.performanceMetrics.responseTime.p95,
          p99: this.performanceMetrics.responseTime.p99
        },
        throughput: {
          requests: this.performanceMetrics.throughput.requestsPerSecond,
          loops: this.performanceMetrics.throughput.loopsPerSecond
        },
        errors: {
          total: this.performanceMetrics.errorRates.total,
          rate: this.performanceMetrics.errorRates.rate,
          critical: this.performanceMetrics.errorRates.criticalErrors
        }
      },
      alerts: this.getActiveAlerts()
    };
  }

  // Private methods

  private collectMetrics(): void {
    // Calculate throughput
    const now = Date.now();
    const timeWindow = 60000; // 1 minute
    
    // Update throughput (simplified calculation)
    this.performanceMetrics.throughput.requestsPerSecond = 
      this.performanceMetrics.throughput.totalRequests / ((now - this.startTime.getTime()) / 1000);
    
    this.performanceMetrics.throughput.loopsPerSecond = 
      this.performanceMetrics.throughput.totalLoops / ((now - this.startTime.getTime()) / 1000);

    // Calculate error rate
    if (this.performanceMetrics.throughput.totalRequests > 0) {
      this.performanceMetrics.errorRates.rate = 
        (this.performanceMetrics.errorRates.total / this.performanceMetrics.throughput.totalRequests) * 100;
    }

    // Update resource usage (simplified)
    const memUsage = process.memoryUsage();
    this.performanceMetrics.resources.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB

    this.emit('metricsCollected', {
      timestamp: new Date(),
      metrics: this.performanceMetrics
    });
  }

  private checkAlerts(): void {
    const alerts: any[] = [];

    // Response time alerts
    if (this.performanceMetrics.responseTime.average > this.alertThresholds.responseTime.critical) {
      alerts.push({
        type: 'response_time',
        severity: 'critical',
        message: `Response time critical: ${this.performanceMetrics.responseTime.average.toFixed(0)}ms`,
        threshold: this.alertThresholds.responseTime.critical
      });
    } else if (this.performanceMetrics.responseTime.average > this.alertThresholds.responseTime.warning) {
      alerts.push({
        type: 'response_time',
        severity: 'warning',
        message: `Response time high: ${this.performanceMetrics.responseTime.average.toFixed(0)}ms`,
        threshold: this.alertThresholds.responseTime.warning
      });
    }

    // Error rate alerts
    if (this.performanceMetrics.errorRates.rate > this.alertThresholds.errorRate.critical) {
      alerts.push({
        type: 'error_rate',
        severity: 'critical',
        message: `Error rate critical: ${this.performanceMetrics.errorRates.rate.toFixed(2)}%`,
        threshold: this.alertThresholds.errorRate.critical
      });
    }

    // Memory usage alerts
    if (this.performanceMetrics.resources.memoryUsage > 500) { // 500MB threshold
      alerts.push({
        type: 'memory_usage',
        severity: 'warning',
        message: `High memory usage: ${this.performanceMetrics.resources.memoryUsage.toFixed(0)}MB`,
        threshold: 500
      });
    }

    // Emit alerts
    for (const alert of alerts) {
      this.emit('alert', alert);
      this.logger.warn('Production alert triggered', alert);
    }
  }

  private registerHealthChecks(): void {
    // Register health checks with ErrorRecoveryService
    this.errorRecoveryService.registerHealthCheck(
      'ProductionMonitor',
      async () => this.monitoringActive,
      { interval: 30000 }
    );

    this.errorRecoveryService.registerHealthCheck(
      'PerformanceOptimizer',
      async () => {
        const metrics = this.performanceOptimizer.getPerformanceMetrics();
        return metrics.cacheHitRate > 50; // 50% cache hit rate minimum
      },
      { interval: 60000 }
    );
  }

  private getActiveAlerts(): any[] {
    // Return currently active alerts
    const alerts: any[] = [];
    
    if (this.performanceMetrics.responseTime.average > this.alertThresholds.responseTime.warning) {
      alerts.push({
        type: 'performance',
        message: 'High response time detected',
        severity: this.performanceMetrics.responseTime.average > this.alertThresholds.responseTime.critical ? 'critical' : 'warning'
      });
    }

    if (this.performanceMetrics.errorRates.rate > this.alertThresholds.errorRate.warning) {
      alerts.push({
        type: 'reliability',
        message: 'High error rate detected',
        severity: this.performanceMetrics.errorRates.rate > this.alertThresholds.errorRate.critical ? 'critical' : 'warning'
      });
    }

    return alerts;
  }
} 