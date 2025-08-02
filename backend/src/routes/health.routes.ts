import express from 'express';
import { BackgroundTradeDiscoveryService } from '../services/trade/BackgroundTradeDiscoveryService';
import { PersistentTradeDiscoveryService } from '../services/trade/PersistentTradeDiscoveryService';

const router = express.Router();

// 🏥 COMPREHENSIVE HEALTH CHECK - Basic
router.get('/', (_req, res) => {
  const uptime = process.uptime();
  const memory = process.memoryUsage();
  
  res.json({
    status: 'healthy',
    message: 'SWAPS White Label API is operational',
    timestamp: new Date().toISOString(),
    service: 'SWAPS White Label API',
    version: '1.0.0',
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
    uptimeSeconds: Math.round(uptime),
    environment: process.env.NODE_ENV || 'development',
    memory: {
      rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
      heapUtilization: `${Math.round((memory.heapUsed / memory.heapTotal) * 100)}%`
    },
    services: {
      backgroundTradeDiscovery: 'active',
      persistentGraph: 'operational',
      algorithmConsolidation: 'enabled'
    },
    api: {
      version: 'v1',
      baseUrl: '/api/v1',
      endpoints: [
        'POST /api/v1/admin/tenants',
        'POST /api/v1/inventory/submit',
        'POST /api/v1/wants/submit',
        'POST /api/v1/discovery/trades'
      ]
    }
  });
});

// 🩺 DEEP HEALTH CHECK - For monitoring systems
router.get('/deep', async (_req, res) => {
  try {
    const startTime = Date.now();
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    
    // Test core services
    let backgroundServiceStatus = 'unknown';
    let persistentServiceStatus = 'unknown';
    
    try {
      const backgroundService = BackgroundTradeDiscoveryService.getInstance();
      backgroundServiceStatus = backgroundService ? 'running' : 'stopped';
    } catch (error) {
      backgroundServiceStatus = 'error';
    }
    
    try {
      const persistentService = PersistentTradeDiscoveryService.getInstance();
      persistentServiceStatus = persistentService ? 'running' : 'stopped';
    } catch (error) {
      persistentServiceStatus = 'error';
    }
    
    const responseTime = Date.now() - startTime;
    
    // Determine overall health
    const memoryHealthy = memory.heapUsed < 500 * 1024 * 1024; // < 500MB
    const uptimeHealthy = uptime > 60; // Running for more than 1 minute
    const servicesHealthy = backgroundServiceStatus === 'running' && persistentServiceStatus === 'running';
    
    const overallHealthy = memoryHealthy && uptimeHealthy && servicesHealthy;
    
    res.status(overallHealthy ? 200 : 503).json({
      status: overallHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      checks: {
        backgroundTradeDiscovery: { 
          status: backgroundServiceStatus,
          healthy: backgroundServiceStatus === 'running'
        },
        persistentGraph: { 
          status: persistentServiceStatus,
          healthy: persistentServiceStatus === 'running'
        },
        memory: { 
          status: memoryHealthy ? 'good' : 'warning',
          usage: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
          limit: '500MB',
          utilization: `${Math.round((memory.heapUsed / memory.heapTotal) * 100)}%`,
          healthy: memoryHealthy
        },
        uptime: {
          status: uptimeHealthy ? 'stable' : 'starting',
          seconds: Math.round(uptime),
          healthy: uptimeHealthy
        },
        api: {
          status: 'operational',
          responseTime: `${responseTime}ms`,
          healthy: responseTime < 1000
        }
      },
      meta: {
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      summary: {
        healthy: overallHealthy,
        issues: overallHealthy ? 0 : [
          !memoryHealthy && 'High memory usage',
          !uptimeHealthy && 'Recently started',
          !servicesHealthy && 'Service issues'
        ].filter(Boolean).length
      }
    });
    
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      checks: {
        backgroundTradeDiscovery: { status: 'unknown', healthy: false },
        persistentGraph: { status: 'unknown', healthy: false },
        memory: { status: 'unknown', healthy: false },
        uptime: { status: 'unknown', healthy: false },
        api: { status: 'error', healthy: false }
      },
      summary: {
        healthy: false,
        issues: 1
      }
    });
  }
});

// 📊 READINESS CHECK - For load balancers
router.get('/ready', (_req, res) => {
  const uptime = process.uptime();
  const ready = uptime > 30; // Ready after 30 seconds
  
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not-ready',
    timestamp: new Date().toISOString(),
    uptime: Math.round(uptime),
    message: ready ? 'Service is ready to accept traffic' : 'Service is starting up'
  });
});

// 💓 LIVENESS CHECK - For orchestrators (Kubernetes, etc.)
router.get('/live', (_req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    pid: process.pid
  });
});

export default router; 