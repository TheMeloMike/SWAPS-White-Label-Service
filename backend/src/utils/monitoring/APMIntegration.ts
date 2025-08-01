/**
 * Application Performance Monitoring (APM) Integration
 * Enterprise-grade observability and performance tracking
 */

import { LoggingService } from '../logging/LoggingService';
import { ErrorTracker } from '../errors/StandardError';

interface APMConfig {
  serviceName: string;
  environment: string;
  version: string;
  enableTracing: boolean;
  enableMetrics: boolean;
  enableLogs: boolean;
  sampleRate: number;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags: Record<string, string>;
}

interface TraceSpan {
  traceId: string;
  spanId: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: Array<{ timestamp: number; message: string; level: string }>;
  success: boolean;
  error?: Error;
}

export class APMIntegration {
  private static instance: APMIntegration;
  private logger = LoggingService.getInstance().createLogger('APM');
  private config: APMConfig;
  private activeSpans = new Map<string, TraceSpan>();
  private metrics: PerformanceMetric[] = [];
  private metricsBuffer: PerformanceMetric[] = [];

  private constructor() {
    this.config = {
      serviceName: process.env.APM_SERVICE_NAME || 'swaps-api',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0',
      enableTracing: process.env.APM_ENABLE_TRACING !== 'false',
      enableMetrics: process.env.APM_ENABLE_METRICS !== 'false',
      enableLogs: process.env.APM_ENABLE_LOGS !== 'false',
      sampleRate: parseFloat(process.env.APM_SAMPLE_RATE || '1.0')
    };

    this.initializeAPM();
  }

  public static getInstance(): APMIntegration {
    if (!this.instance) {
      this.instance = new APMIntegration();
    }
    return this.instance;
  }

  private initializeAPM() {
    this.logger.info('Initializing APM integration', {
      serviceName: this.config.serviceName,
      environment: this.config.environment,
      version: this.config.version
    });

    // Start periodic metrics collection
    if (this.config.enableMetrics) {
      this.startMetricsCollection();
    }

    // Start periodic metrics reporting
    setInterval(() => {
      this.flushMetrics();
    }, 60000); // Every minute
  }

  /**
   * Start a distributed trace span
   */
  public startSpan(operationName: string, parentSpanId?: string): string {
    if (!this.config.enableTracing || Math.random() > this.config.sampleRate) {
      return 'disabled';
    }

    const spanId = this.generateSpanId();
    const traceId = parentSpanId ? this.getTraceId(parentSpanId) : this.generateTraceId();

    const span: TraceSpan = {
      traceId,
      spanId,
      operationName,
      startTime: Date.now(),
      tags: {
        service: this.config.serviceName,
        environment: this.config.environment,
        version: this.config.version
      },
      logs: [],
      success: true
    };

    this.activeSpans.set(spanId, span);

    this.logger.debug('Started trace span', {
      traceId,
      spanId,
      operationName
    });

    return spanId;
  }

  /**
   * Finish a trace span
   */
  public finishSpan(spanId: string, success: boolean = true, error?: Error) {
    if (spanId === 'disabled') return;

    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.success = success;
    span.error = error;

    // Log span completion
    this.logger.debug('Finished trace span', {
      traceId: span.traceId,
      spanId: span.spanId,
      operationName: span.operationName,
      duration: span.duration,
      success: span.success
    });

    // Record performance metric
    this.recordMetric('operation_duration', span.duration, 'ms', {
      operation: span.operationName,
      success: success.toString()
    });

    // Send to APM provider (if configured)
    this.sendSpanToAPM(span);

    this.activeSpans.delete(spanId);
  }

  /**
   * Add tags to an active span
   */
  public addSpanTags(spanId: string, tags: Record<string, any>) {
    if (spanId === 'disabled') return;

    const span = this.activeSpans.get(spanId);
    if (span) {
      Object.assign(span.tags, tags);
    }
  }

  /**
   * Add a log entry to an active span
   */
  public logToSpan(spanId: string, message: string, level: string = 'info') {
    if (spanId === 'disabled') return;

    const span = this.activeSpans.get(spanId);
    if (span) {
      span.logs.push({
        timestamp: Date.now(),
        message,
        level
      });
    }
  }

  /**
   * Record a custom metric
   */
  public recordMetric(name: string, value: number, unit: string = 'count', tags: Record<string, string> = {}) {
    if (!this.config.enableMetrics) return;

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags: {
        service: this.config.serviceName,
        environment: this.config.environment,
        ...tags
      }
    };

    this.metricsBuffer.push(metric);

    // Keep buffer size manageable
    if (this.metricsBuffer.length > 1000) {
      this.metricsBuffer = this.metricsBuffer.slice(-500);
    }
  }

  /**
   * Increment a counter metric
   */
  public incrementCounter(name: string, tags: Record<string, string> = {}) {
    this.recordMetric(name, 1, 'count', tags);
  }

  /**
   * Record a histogram value
   */
  public histogram(name: string, value: number, tags: Record<string, string> = {}) {
    this.recordMetric(name, value, 'histogram', tags);
  }

  /**
   * Record a gauge value
   */
  public gauge(name: string, value: number, tags: Record<string, string> = {}) {
    this.recordMetric(name, value, 'gauge', tags);
  }

  /**
   * Middleware for Express.js to automatically trace requests
   */
  public expressMiddleware() {
    return (req: any, res: any, next: any) => {
      const spanId = this.startSpan(`${req.method} ${req.path}`);
      
      // Add request details to span
      this.addSpanTags(spanId, {
        'http.method': req.method,
        'http.url': req.originalUrl,
        'http.user_agent': req.get('User-Agent'),
        'http.remote_addr': req.ip
      });

      // Store span ID for later use
      req.spanId = spanId;

      const startTime = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const success = res.statusCode < 400;

        this.addSpanTags(spanId, {
          'http.status_code': res.statusCode,
          'http.response_size': res.get('Content-Length') || '0'
        });

        this.finishSpan(spanId, success);

        // Record HTTP metrics
        this.recordMetric('http_request_duration', duration, 'ms', {
          method: req.method,
          status: res.statusCode.toString(),
          endpoint: req.route?.path || req.path
        });

        this.incrementCounter('http_requests_total', {
          method: req.method,
          status: res.statusCode.toString(),
          endpoint: req.route?.path || req.path
        });
      });

      next();
    };
  }

  /**
   * Start collecting system metrics
   */
  private startMetricsCollection() {
    setInterval(() => {
      // Memory metrics
      const memUsage = process.memoryUsage();
      this.gauge('memory_heap_used', memUsage.heapUsed, { type: 'heap_used' });
      this.gauge('memory_heap_total', memUsage.heapTotal, { type: 'heap_total' });
      this.gauge('memory_rss', memUsage.rss, { type: 'rss' });
      this.gauge('memory_external', memUsage.external, { type: 'external' });

      // CPU metrics
      const cpuUsage = process.cpuUsage();
      this.gauge('cpu_user_time', cpuUsage.user, { type: 'user' });
      this.gauge('cpu_system_time', cpuUsage.system, { type: 'system' });

      // Process metrics
      this.gauge('process_uptime', process.uptime(), { type: 'uptime' });

      // Event loop lag
      this.measureEventLoopLag();

      // Error metrics
      const errorMetrics = ErrorTracker.getMetrics();
      const totalErrors = errorMetrics.reduce((sum, metric) => sum + metric.count, 0);
      this.gauge('errors_total', totalErrors);

      errorMetrics.forEach(metric => {
        this.gauge('errors_by_code', metric.count, { code: metric.code });
      });

    }, 30000); // Every 30 seconds
  }

  /**
   * Measure event loop lag
   */
  private measureEventLoopLag() {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
      this.gauge('event_loop_lag', lag, { unit: 'ms' });
    });
  }

  /**
   * Flush metrics to APM provider
   */
  private flushMetrics() {
    if (this.metricsBuffer.length === 0) return;

    const metricsToSend = [...this.metricsBuffer];
    this.metricsBuffer = [];

    this.logger.debug('Flushing metrics to APM', {
      metricsCount: metricsToSend.length
    });

    // Send to APM provider (implement based on your provider)
    this.sendMetricsToAPM(metricsToSend);
  }

  /**
   * Send span data to APM provider
   */
  private sendSpanToAPM(span: TraceSpan) {
    // Implement based on your APM provider (Datadog, New Relic, etc.)
    if (process.env.APM_ENDPOINT) {
      // Example implementation for custom APM endpoint
      this.logger.debug('Sending span to APM', {
        traceId: span.traceId,
        spanId: span.spanId,
        operationName: span.operationName
      });
    }
  }

  /**
   * Send metrics to APM provider
   */
  private sendMetricsToAPM(metrics: PerformanceMetric[]) {
    // Implement based on your APM provider
    if (process.env.APM_ENDPOINT) {
      this.logger.debug('Sending metrics to APM', {
        metricsCount: metrics.length
      });
    }
  }

  /**
   * Get current performance summary
   */
  public getPerformanceSummary() {
    const recentMetrics = this.metricsBuffer.slice(-100);
    
    return {
      activeSpans: this.activeSpans.size,
      metricsBuffered: this.metricsBuffer.length,
      recentMetrics: recentMetrics.slice(0, 10),
      config: this.config
    };
  }

  private generateTraceId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private generateSpanId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private getTraceId(spanId: string): string {
    const span = this.activeSpans.get(spanId);
    return span ? span.traceId : this.generateTraceId();
  }
}

export default APMIntegration;