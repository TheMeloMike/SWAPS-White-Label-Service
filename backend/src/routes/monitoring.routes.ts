/**
 * Enterprise Monitoring Routes
 * Comprehensive health checks and system status for enterprise clients
 */

import { Router, Request, Response } from 'express';
import { ErrorHandler } from '../middleware/errorHandler';
import { ErrorTracker } from '../utils/errors/StandardError';
import { LoggingService } from '../utils/logging/LoggingService';
import { PersistentTradeDiscoveryService } from '../services/trade/PersistentTradeDiscoveryService';
import { TenantManagementService } from '../services/tenant/TenantManagementService';
import ApiVersioning from '../middleware/apiVersioning';

const router = Router();
const logger = LoggingService.getInstance().createLogger('Monitoring');

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  environment: string;
  services: {
    [serviceName: string]: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      responseTime?: number;
      lastCheck?: string;
      details?: string;
    };
  };
  performance: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
    requests: {
      total: number;
      perMinute: number;
      averageResponseTime: number;
    };
  };
  errors: {
    total: number;
    last24Hours: number;
    byType: Record<string, number>;
  };
}

/**
 * GET /monitoring/health
 * Comprehensive health check endpoint
 */
router.get('/health', ErrorHandler.asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Check individual services
    const serviceChecks = await Promise.allSettled([
      checkTradeDiscoveryService(),
      checkTenantService(),
      checkMemoryUsage(),
      checkDiskSpace()
    ]);

    const services: HealthStatus['services'] = {};
    const serviceNames = ['tradeDiscovery', 'tenantManagement', 'memory', 'disk'];
    
    serviceChecks.forEach((result, index) => {
      const serviceName = serviceNames[index];
      if (result.status === 'fulfilled') {
        services[serviceName] = result.value;
      } else {
        services[serviceName] = {
          status: 'unhealthy',
          details: result.reason?.message || 'Unknown error'
        };
      }
    });

    // Calculate overall status
    const statuses = Object.values(services).map(s => s.status);
    const overallStatus = statuses.includes('unhealthy') ? 'unhealthy' :
                         statuses.includes('degraded') ? 'degraded' : 'healthy';

    // Get performance metrics
    const memUsage = process.memoryUsage();
    const errorMetrics = ErrorTracker.getMetrics();
    
    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      services,
      performance: {
        memory: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
        },
        cpu: {
          usage: await getCpuUsage()
        },
        requests: {
          total: getRequestMetrics().total,
          perMinute: getRequestMetrics().perMinute,
          averageResponseTime: getRequestMetrics().averageResponseTime
        }
      },
      errors: {
        total: errorMetrics.reduce((sum, metric) => sum + metric.count, 0),
        last24Hours: errorMetrics.filter(m => 
          Date.now() - m.lastOccurrence.getTime() < 24 * 60 * 60 * 1000
        ).reduce((sum, metric) => sum + metric.count, 0),
        byType: errorMetrics.reduce((acc, metric) => {
          acc[metric.code] = metric.count;
          return acc;
        }, {} as Record<string, number>)
      }
    };

    const responseTime = Date.now() - startTime;
    
    // Set appropriate HTTP status based on health
    const httpStatus = overallStatus === 'healthy' ? 200 :
                      overallStatus === 'degraded' ? 200 : 503;

    res.status(httpStatus).json({
      ...healthStatus,
      responseTime
    });

  } catch (error) {
    logger.error('Health check failed', { error: (error as Error).message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check service unavailable',
      responseTime: Date.now() - startTime
    });
  }
}));

/**
 * GET /monitoring/metrics
 * Detailed system metrics for monitoring tools
 */
router.get('/metrics', ErrorHandler.asyncHandler(async (req: Request, res: Response) => {
  const memUsage = process.memoryUsage();
  const errorMetrics = ErrorTracker.getMetrics();
  const requestMetrics = getRequestMetrics();

  res.json({
    timestamp: new Date().toISOString(),
    system: {
      uptime: process.uptime(),
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers
      },
      cpu: {
        usage: await getCpuUsage(),
        loadAverage: process.platform !== 'win32' ? (process as any).loadavg?.() || [0, 0, 0] : [0, 0, 0]
      },
      process: {
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version,
        title: process.title
      }
    },
    application: {
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      requests: requestMetrics,
      errors: {
        metrics: errorMetrics,
        summary: {
          total: errorMetrics.reduce((sum, m) => sum + m.count, 0),
          bySeverity: errorMetrics.reduce((acc, m) => {
            acc[m.severity] = (acc[m.severity] || 0) + m.count;
            return acc;
          }, {} as Record<string, number>)
        }
      }
    }
  });
}));

/**
 * GET /monitoring/readiness
 * Kubernetes readiness probe endpoint
 */
router.get('/readiness', ErrorHandler.asyncHandler(async (req: Request, res: Response) => {
  try {
    // Quick checks for essential services
    const tradeService = PersistentTradeDiscoveryService.getInstance();
    const tenantService = TenantManagementService.getInstance();
    
    // Basic availability checks
    if (!tradeService || !tenantService) {
      throw new Error('Essential services not available');
    }

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        tradeService: 'available',
        tenantService: 'available'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: (error as Error).message
    });
  }
}));

/**
 * GET /monitoring/liveness
 * Kubernetes liveness probe endpoint
 */
router.get('/liveness', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * Service health check functions
 */
async function checkTradeDiscoveryService() {
  const startTime = Date.now();
  try {
    const service = PersistentTradeDiscoveryService.getInstance();
    if (!service) {
      throw new Error('Service not available');
    }
    
    return {
      status: 'healthy' as const,
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy' as const,
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      details: (error as Error).message
    };
  }
}

async function checkTenantService() {
  const startTime = Date.now();
  try {
    const service = TenantManagementService.getInstance();
    if (!service) {
      throw new Error('Service not available');
    }
    
    return {
      status: 'healthy' as const,
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy' as const,
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      details: (error as Error).message
    };
  }
}

async function checkMemoryUsage() {
  const memUsage = process.memoryUsage();
  const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  
  const status: 'healthy' | 'degraded' | 'unhealthy' = 
    memoryUsagePercent > 90 ? 'unhealthy' :
    memoryUsagePercent > 75 ? 'degraded' : 'healthy';
  
  return {
    status,
    responseTime: 1,
    lastCheck: new Date().toISOString(),
    details: `Memory usage: ${memoryUsagePercent.toFixed(1)}%`
  };
}

async function checkDiskSpace() {
  // Simplified disk check - in production, use proper disk space monitoring
  return {
    status: 'healthy' as const,
    responseTime: 1,
    lastCheck: new Date().toISOString(),
    details: 'Disk space monitoring not implemented'
  };
}

async function getCpuUsage(): Promise<number> {
  return new Promise((resolve) => {
    const startUsage = process.cpuUsage();
    setTimeout(() => {
      const endUsage = process.cpuUsage(startUsage);
      const totalUsage = endUsage.user + endUsage.system;
      const usage = (totalUsage / 1000000) * 100; // Convert to percentage
      resolve(Math.min(100, Math.max(0, usage)));
    }, 100);
  });
}

// Simple request tracking
let requestCount = 0;
let requestTimes: number[] = [];
const startTime = Date.now();

// Middleware to track requests
export const trackRequests = (req: any, res: any, next: any) => {
  const start = Date.now();
  requestCount++;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    requestTimes.push(duration);
    
    // Keep only last 1000 requests
    if (requestTimes.length > 1000) {
      requestTimes = requestTimes.slice(-1000);
    }
  });
  
  next();
};

function getRequestMetrics() {
  const now = Date.now();
  const uptime = (now - startTime) / 1000; // seconds
  const perMinute = uptime > 0 ? Math.round((requestCount / uptime) * 60) : 0;
  const averageResponseTime = requestTimes.length > 0 
    ? Math.round(requestTimes.reduce((a, b) => a + b, 0) / requestTimes.length)
    : 0;

  return {
    total: requestCount,
    perMinute,
    averageResponseTime
  };
}

/**
 * GET /monitoring/version
 * API version information and statistics
 */
router.get('/version', ErrorHandler.asyncHandler(async (req: Request, res: Response) => {
  const versionStats = ApiVersioning.getVersionStats();
  
  res.json({
    timestamp: new Date().toISOString(),
    api: {
      name: 'SWAPS White Label API',
      version: versionStats.current,
      supportedVersions: versionStats.supported,
      deprecatedVersions: versionStats.deprecated,
      defaultVersion: versionStats.default,
      sunsetSchedule: versionStats.sunset
    },
    compatibility: {
      strategies: [
        'Accept header: Accept: application/vnd.swaps.v1+json',
        'Custom header: X-API-Version: 1.0.0',
        'URL path: /api/v1/endpoint',
        'Query parameter: ?version=1.0.0'
      ],
      headers: {
        versioning: ['X-API-Version', 'X-API-Current-Version', 'X-API-Supported-Versions'],
        deprecation: ['Warning', 'Deprecation', 'Sunset']
      }
    }
  });
}));

export default router; 