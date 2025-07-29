import { Router, Request, Response } from 'express';
import { MetricsCollectionService } from '../services/analytics/MetricsCollectionService';
import { AnalyticsEngine } from '../services/analytics/AnalyticsEngine';
import { MemoryProfilerService } from '../services/analytics/MemoryProfilerService';
import { FeatureFlagService } from '../services/ai/FeatureFlagService';
import { LoggingService } from '../utils/logging/LoggingService';
import { requireAdminAuth } from '../middleware/adminAuth';
import { z } from 'zod';

const router = Router();
const logger = LoggingService.getInstance().createLogger('DashboardRoutes');

// Apply admin authentication to all dashboard routes
router.use(requireAdminAuth);

// Validation schemas
const TimeRangeSchema = z.object({
  start: z.string().transform(str => new Date(str)),
  end: z.string().transform(str => new Date(str))
});

const MetricsQuerySchema = z.object({
  timeRange: TimeRangeSchema.optional(),
  granularity: z.enum(['minute', 'hour', 'day']).optional().default('hour'),
  metrics: z.array(z.string()).optional()
});

const InsightsQuerySchema = z.object({
  type: z.enum(['trend', 'anomaly', 'opportunity', 'warning', 'prediction']).optional(),
  category: z.enum(['performance', 'user_behavior', 'business', 'technical']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  limit: z.number().min(1).max(100).optional().default(20)
});

const EventRecordSchema = z.object({
  type: z.enum(['performance', 'error', 'user_action', 'system_event', 'business_event']),
  category: z.string().min(1),
  event: z.string().min(1),
  data: z.any().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  source: z.string().min(1)
});

/**
 * @route GET /api/dashboard/overview
 * @desc Get comprehensive dashboard overview with KPIs and summary
 * @access Public
 */
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const metricsService = MetricsCollectionService.getInstance();
    
    // Get dashboard KPIs from metrics service
    const kpis = metricsService.getDashboardKPIs();
    
    // Try to get analytics data, but don't fail if AnalyticsEngine is unavailable
    let dashboardData;
    try {
      const analyticsEngine = AnalyticsEngine.getInstance();
      dashboardData = analyticsEngine.getDashboardData();
    } catch (analyticsError) {
      logger.warn('AnalyticsEngine not available, using basic data', {
        error: analyticsError instanceof Error ? analyticsError.message : String(analyticsError)
      });
      
      // Provide fallback data structure
      dashboardData = {
        insights: [],
        summary: {
          healthScore: 75,
          revenue24h: 0,
          uptime: Math.round(Date.now() / 1000)
        },
        performance: {
          systemHealth: {
            overall: 75
          }
        }
      };
    }
    
    // Combine all overview data
    const overview = {
      kpis: kpis.current,
      trends: kpis.trends,
      alerts: kpis.alerts,
      insights: dashboardData.insights.slice(0, 5), // Top 5 insights
      summary: dashboardData.summary,
      systemHealth: dashboardData.performance?.systemHealth?.overall || 75,
      timestamp: new Date()
    };

    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    logger.error('Error getting dashboard overview', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard overview'
    });
  }
});

/**
 * @route GET /api/dashboard/metrics
 * @desc Get detailed metrics with time range and granularity
 * @access Public
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const query = MetricsQuerySchema.parse(req.query);
    const metricsService = MetricsCollectionService.getInstance();
    
    // Default to last 24 hours if no time range provided
    const timeRange = query.timeRange || {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date()
    };
    
    // Get metrics history
    const metrics = metricsService.getMetricsHistory(timeRange, query.granularity);
    
    // Get current metrics for comparison
    const currentMetrics = metricsService.getCurrentMetrics();
    
    res.json({
      success: true,
      data: {
        current: currentMetrics,
        history: metrics,
        timeRange,
        granularity: query.granularity,
        count: metrics.length
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors
      });
    }

    logger.error('Error getting metrics', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics'
    });
  }
});

/**
 * @route GET /api/dashboard/insights
 * @desc Get analytics insights with filtering
 * @access Public
 */
router.get('/insights', async (req: Request, res: Response) => {
  try {
    const query = InsightsQuerySchema.parse(req.query);
    const analyticsEngine = AnalyticsEngine.getInstance();
    
    const insights = analyticsEngine.getInsights({
      type: query.type,
      category: query.category,
      severity: query.severity,
      limit: query.limit
    });
    
    res.json({
      success: true,
      data: {
        insights,
        total: insights.length,
        filters: {
          type: query.type,
          category: query.category,
          severity: query.severity
        }
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors
      });
    }

    logger.error('Error getting insights', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get insights'
    });
  }
});

/**
 * @route GET /api/dashboard/trends
 * @desc Get trend analysis for all or specific metrics
 * @access Public
 */
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const { metric } = req.query;
    const analyticsEngine = AnalyticsEngine.getInstance();
    
    if (metric && typeof metric === 'string') {
      // Get specific metric trend
      const trendAnalysis = analyticsEngine.getTrendAnalysis(metric);
      
      if (!trendAnalysis) {
        return res.status(404).json({
          success: false,
          error: `Trend analysis not found for metric: ${metric}`
        });
      }
      
      res.json({
        success: true,
        data: {
          metric,
          trend: trendAnalysis
        }
      });
    } else {
      // Get all trend analyses
      const allTrends = analyticsEngine.getAllTrendAnalyses();
      const trendsObject = Object.fromEntries(allTrends);
      
      res.json({
        success: true,
        data: {
          trends: trendsObject,
          count: allTrends.size
        }
      });
    }
  } catch (error) {
    logger.error('Error getting trends', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get trends'
    });
  }
});

/**
 * @route GET /api/dashboard/user-behavior
 * @desc Get user behavior analysis
 * @access Public
 */
router.get('/user-behavior', async (req: Request, res: Response) => {
  try {
    const analyticsEngine = AnalyticsEngine.getInstance();
    const userBehavior = analyticsEngine.getUserBehaviorAnalysis();
    
    res.json({
      success: true,
      data: userBehavior
    });
  } catch (error) {
    logger.error('Error getting user behavior analysis', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get user behavior analysis'
    });
  }
});

/**
 * @route GET /api/dashboard/business-intelligence
 * @desc Get business intelligence data
 * @access Public
 */
router.get('/business-intelligence', async (req: Request, res: Response) => {
  try {
    const analyticsEngine = AnalyticsEngine.getInstance();
    const businessIntelligence = analyticsEngine.getBusinessIntelligence();
    
    res.json({
      success: true,
      data: businessIntelligence
    });
  } catch (error) {
    logger.error('Error getting business intelligence', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get business intelligence'
    });
  }
});

/**
 * @route GET /api/dashboard/performance
 * @desc Get performance analysis
 * @access Public
 */
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const analyticsEngine = AnalyticsEngine.getInstance();
    const performanceAnalysis = analyticsEngine.getPerformanceAnalysis();
    
    res.json({
      success: true,
      data: performanceAnalysis
    });
  } catch (error) {
    logger.error('Error getting performance analysis', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get performance analysis'
    });
  }
});

/**
 * @route GET /api/dashboard/events
 * @desc Get event history with filtering
 * @access Public
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const metricsService = MetricsCollectionService.getInstance();
    
    const filters: any = {};
    
    if (req.query.type) filters.type = req.query.type;
    if (req.query.category) filters.category = req.query.category;
    if (req.query.userId) filters.userId = req.query.userId;
    if (req.query.limit) filters.limit = parseInt(req.query.limit as string);
    
    // Parse time range if provided
    if (req.query.startTime && req.query.endTime) {
      filters.timeRange = {
        start: new Date(req.query.startTime as string),
        end: new Date(req.query.endTime as string)
      };
    }
    
    const events = metricsService.getEventHistory(filters);
    
    res.json({
      success: true,
      data: {
        events,
        count: events.length,
        filters
      }
    });
  } catch (error) {
    logger.error('Error getting events', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get events'
    });
  }
});

/**
 * @route POST /api/dashboard/events
 * @desc Record a custom event
 * @access Public
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const eventData = EventRecordSchema.parse(req.body);
    const metricsService = MetricsCollectionService.getInstance();
    
    metricsService.recordEvent(eventData);
    
    res.json({
      success: true,
      message: 'Event recorded successfully',
      timestamp: new Date()
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event data',
        details: error.errors
      });
    }

    logger.error('Error recording event', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to record event'
    });
  }
});

/**
 * @route GET /api/dashboard/alerts
 * @desc Get alert thresholds and current alerts
 * @access Public
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const metricsService = MetricsCollectionService.getInstance();
    const currentMetrics = await metricsService.getCurrentMetrics();
    const kpis = metricsService.getDashboardKPIs();
    
    res.json({
      success: true,
      data: {
        thresholds: metricsService.getAlertThresholds(),
        active: kpis.alerts,
        currentMetrics: {
          errorRate: currentMetrics.system.errorRate,
          memoryUsage: currentMetrics.system.memoryUsage.percentage,
          tradeSuccessRate: currentMetrics.trade.successRate,
          notificationDeliveryRate: currentMetrics.notifications.deliverySuccessRate
        }
      }
    });
  } catch (error) {
    logger.error('Error getting alerts', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get alerts'
    });
  }
});

/**
 * @route GET /api/dashboard/system-health
 * @desc Get real-time system health status
 * @access Public
 */
router.get('/system-health', async (req: Request, res: Response) => {
  try {
    // Get basic system metrics
    const memoryUsage = process.memoryUsage();
    const memoryPercentage = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);
    const uptime = Math.round(process.uptime());
    
    // Mock some basic metrics for now (in a real implementation these would come from services)
    const mockMetrics = {
      tradeSuccessRate: 85,
      notificationDeliveryRate: 92,
      aiQuerySuccessRate: 88,
      errorRate: 2
    };
    
    // Calculate system health components
    const components = {
      tradeDiscovery: Math.max(0, Math.min(100, mockMetrics.tradeSuccessRate)),
      notifications: Math.max(0, Math.min(100, mockMetrics.notificationDeliveryRate)),
      aiServices: Math.max(0, Math.min(100, mockMetrics.aiQuerySuccessRate)),
      systemResources: Math.max(0, Math.min(100, 100 - memoryPercentage))
    };
    
    // Calculate overall health score
    const overall = Math.round(
      (components.tradeDiscovery * 0.3) +
      (components.notifications * 0.2) +
      (components.aiServices * 0.2) +
      (components.systemResources * 0.3)
    );
    
    // Generate bottlenecks based on current metrics
    const bottlenecks: string[] = [];
    if (memoryPercentage > 85) {
      bottlenecks.push(`Memory usage at ${memoryPercentage}% - approaching capacity limits`);
    }
    if (mockMetrics.errorRate > 5) {
      bottlenecks.push(`Error rate at ${mockMetrics.errorRate}% - above acceptable threshold`);
    }
    if (mockMetrics.tradeSuccessRate < 80) {
      bottlenecks.push(`Trade success rate at ${mockMetrics.tradeSuccessRate}% - below optimal performance`);
    }
    if (mockMetrics.notificationDeliveryRate < 90) {
      bottlenecks.push(`Notification delivery at ${mockMetrics.notificationDeliveryRate}% - experiencing delivery issues`);
    }
    
    // Generate recommendations based on bottlenecks
    const recommendations: string[] = [];
    if (memoryPercentage > 85) {
      recommendations.push('Scale up memory allocation to handle increased load');
      recommendations.push('Implement Redis caching layer for frequently accessed NFT data');
    }
    if (mockMetrics.errorRate > 5) {
      recommendations.push('Investigate error patterns and implement circuit breakers');
      recommendations.push('Add monitoring for critical system components');
    }
    if (mockMetrics.tradeSuccessRate < 80) {
      recommendations.push('Optimize trade discovery algorithms for better matching');
      recommendations.push('Review NFT pricing data accuracy and update frequency');
    }
    if (mockMetrics.notificationDeliveryRate < 90) {
      recommendations.push('Implement notification retry mechanisms');
      recommendations.push('Add read replicas to distribute notification load');
    }
    
    // Fallback recommendations if no specific issues
    if (recommendations.length === 0) {
      recommendations.push('System is operating within normal parameters');
      recommendations.push('Continue monitoring for performance optimization opportunities');
    }
    
    const systemHealth = {
      overall,
      components,
      bottlenecks,
      recommendations,
      uptime,
      memoryUsage: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        percentage: memoryPercentage
      },
      activeConnections: 0, // Would need to track this
      requestsPerMinute: 0, // Would need to track this
      errorRate: mockMetrics.errorRate,
      timestamp: new Date()
    };
    
    res.json({
      success: true,
      data: systemHealth
    });
  } catch (error) {
    logger.error('Error getting system health', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get system health'
    });
  }
});

/**
 * @route GET /api/dashboard/export
 * @desc Export metrics data in various formats
 * @access Public
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { format = 'json', startTime, endTime } = req.query;
    
    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'startTime and endTime parameters are required'
      });
    }
    
    const timeRange = {
      start: new Date(startTime as string),
      end: new Date(endTime as string)
    };
    
    const metricsService = MetricsCollectionService.getInstance();
    const exportData = metricsService.exportMetrics(timeRange, format as 'json' | 'csv');
    
    const contentType = format === 'csv' ? 'text/csv' : 'application/json';
    const filename = `swaps-metrics-${timeRange.start.toISOString().split('T')[0]}-to-${timeRange.end.toISOString().split('T')[0]}.${format}`;
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exportData);
  } catch (error) {
    logger.error('Error exporting metrics', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to export metrics'
    });
  }
});

/**
 * @route GET /api/dashboard/real-time
 * @desc Get real-time metrics for live dashboard updates
 * @access Public
 */
router.get('/real-time', async (req: Request, res: Response) => {
  try {
    const metricsService = MetricsCollectionService.getInstance();
    const analyticsEngine = AnalyticsEngine.getInstance();
    
    const currentMetrics = await metricsService.getCurrentMetrics();
    const recentInsights = analyticsEngine.getInsights({ limit: 3 });
    
    // Get last 5 minutes of metrics for micro-trends
    const recentMetrics = metricsService.getMetricsHistory({
      start: new Date(Date.now() - 5 * 60 * 1000),
      end: new Date()
    }, 'minute');
    
    const realTimeData = {
      current: {
        activeUsers: currentMetrics.user.dailyActiveUsers,
        systemHealth: analyticsEngine.getPerformanceAnalysis().systemHealth.overall,
        errorRate: currentMetrics.system.errorRate,
        memoryUsage: currentMetrics.system.memoryUsage.percentage,
        tradeSuccessRate: currentMetrics.trade.successRate,
        notificationsSent: currentMetrics.notifications.notificationsSent24h,
        aiQueries: currentMetrics.ai.totalQueries24h
      },
      microTrends: {
        length: recentMetrics.length,
        latest: recentMetrics[0] || null,
        trend: recentMetrics.length > 1 ? {
          activeUsers: calculateMicroTrend(recentMetrics.map(m => m.user.dailyActiveUsers)),
          errorRate: calculateMicroTrend(recentMetrics.map(m => m.system.errorRate)),
          memoryUsage: calculateMicroTrend(recentMetrics.map(m => m.system.memoryUsage.percentage))
        } : null
      },
      alerts: recentInsights.filter(i => i.severity === 'high' || i.severity === 'critical'),
      timestamp: new Date(),
      uptime: Math.round(currentMetrics.system.uptime / 3600) // hours
    };
    
    res.json({
      success: true,
      data: realTimeData
    });
  } catch (error) {
    logger.error('Error getting real-time data', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get real-time data'
    });
  }
});

/**
 * Helper function to calculate micro trends
 */
function calculateMicroTrend(values: number[]): 'up' | 'down' | 'stable' {
  if (values.length < 2) return 'stable';
  
  const latest = values[values.length - 1];
  const previous = values[values.length - 2];
  const change = ((latest - previous) / previous) * 100;
  
  if (Math.abs(change) < 1) return 'stable';
  return change > 0 ? 'up' : 'down';
}

/**
 * @route GET /api/dashboard/feature-flags
 * @desc Get feature flag status for dashboard features
 * @access Public
 */
router.get('/feature-flags', async (req: Request, res: Response) => {
  try {
    const featureFlagService = FeatureFlagService.getInstance();
    const { walletAddress } = req.query;
    
    if (!walletAddress || typeof walletAddress !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'walletAddress parameter is required'
      });
    }
    
    const flags = {
      dashboardAnalytics: featureFlagService.isEnabled('dashboard_analytics', walletAddress),
      advancedInsights: featureFlagService.isEnabled('advanced_insights', walletAddress),
      realTimeAlerts: featureFlagService.isEnabled('real_time_notifications', walletAddress),
      businessIntelligence: featureFlagService.isEnabled('business_intelligence', walletAddress)
    };
    
    res.json({
      success: true,
      data: {
        flags,
        walletAddress: walletAddress.substring(0, 8) + '...',
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Error getting feature flags', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get feature flags'
    });
  }
});

/**
 * @route POST /api/dashboard/record-interaction
 * @desc Record user interaction with dashboard for analytics
 * @access Public
 */
router.post('/record-interaction', async (req: Request, res: Response) => {
  try {
    const { action, component, data, userId } = req.body;
    
    if (!action || !component) {
      return res.status(400).json({
        success: false,
        error: 'action and component are required'
      });
    }
    
    const metricsService = MetricsCollectionService.getInstance();
    
    metricsService.recordEvent({
      type: 'user_action',
      category: 'dashboard',
      event: action,
      data: {
        component,
        ...data
      },
      userId,
      source: 'dashboard'
    });
    
    res.json({
      success: true,
      message: 'Interaction recorded',
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error recording interaction', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to record interaction'
    });
  }
});

// Test endpoint to check service health
router.get('/test', async (req: Request, res: Response) => {
  try {
    const metricsService = MetricsCollectionService.getInstance();
    const currentTime = new Date();
    
    res.json({
      success: true,
      message: 'Dashboard routes are working',
      timestamp: currentTime,
      metricsServiceAvailable: !!metricsService
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Dashboard test failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Simple system health test endpoint
router.get('/system-health-test', async (req: Request, res: Response) => {
  try {
    const memoryUsage = process.memoryUsage();
    const memoryPercentage = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);
    
    res.json({
      success: true,
      data: {
        overall: 85,
        components: {
          tradeDiscovery: 85,
          notifications: 92,
          aiServices: 88,
          systemResources: 100 - memoryPercentage
        },
        bottlenecks: memoryPercentage > 85 ? [`Memory usage at ${memoryPercentage}%`] : [],
        recommendations: ['System is operating within normal parameters'],
        memoryUsage: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          percentage: memoryPercentage
        },
        timestamp: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'System health test failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Memory breakdown endpoint - now uses real memory profiler
router.get('/memory-breakdown', async (req: Request, res: Response) => {
  try {
    const memoryProfilerService = MemoryProfilerService.getInstance();
    logger.info('MemoryProfilerService instance obtained successfully');
    
    let realMemoryData;
    try {
      logger.info('Attempting to get real memory breakdown...');
      realMemoryData = await memoryProfilerService.getRealMemoryBreakdown();
      logger.info('Real memory breakdown obtained successfully');
    } catch (memoryError) {
      logger.error('Failed to get real memory breakdown', {
        error: memoryError instanceof Error ? memoryError.message : String(memoryError),
        stack: memoryError instanceof Error ? memoryError.stack : undefined
      });
      
      return res.status(500).json({
        success: false,
        error: 'Failed to get memory breakdown',
        details: memoryError instanceof Error ? memoryError.message : String(memoryError)
      });
    }
    
    // Transform to expected format for frontend
    const memoryBreakdown = {
      heapUsed: realMemoryData.totalHeapUsed,
      heapTotal: realMemoryData.totalHeapTotal,
      external: realMemoryData.external,
      arrayBuffers: realMemoryData.arrayBuffers,
      components: realMemoryData.components,
      growthRate: 0, // Will be calculated from trends
      peakUsage: realMemoryData.totalHeapUsed * 1.2, // Estimate
      averageUsage: realMemoryData.totalHeapUsed * 0.8, // Estimate
      gcMetrics: realMemoryData.gcMetrics,
      efficiency: realMemoryData.efficiency,
      recommendations: realMemoryData.recommendations.map(rec => ({
        id: rec.id,
        priority: rec.priority === 'critical' ? 'high' : rec.priority,
        category: rec.category === 'cache_optimization' ? 'optimization' : 
                 rec.category === 'memory_leak' ? 'cleanup' :
                 rec.category === 'gc_tuning' ? 'optimization' : 'scaling',
        title: rec.title,
        description: rec.description,
        impact: rec.impact,
        effort: rec.confidence > 0.8 ? 'low' : rec.confidence > 0.6 ? 'medium' : 'high',
        actions: rec.actions,
        estimatedSavings: Math.round(rec.estimatedSavings)
      }))
    };
    
    // Get historical memory data for trends
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let historicalMetrics: any[] = [];
    try {
      const metricsService = MetricsCollectionService.getInstance();
      historicalMetrics = metricsService.getMetricsHistory({
        start: oneHourAgo,
        end: new Date()
      });
    } catch (historyError) {
      logger.warn('Could not fetch historical metrics for memory trends', {
        error: historyError instanceof Error ? historyError.message : String(historyError)
      });
    }
    
    // Calculate memory trends
    const memoryTrends = historicalMetrics.map(m => ({
      timestamp: m.timestamp,
      totalMemory: m.system.memoryUsage.used,
      percentage: m.system.memoryUsage.percentage,
      components: m.system.memoryUsage.breakdown?.components || {}
    }));
    
    // Get top memory consumers with clean formatting
    const topConsumers = Object.entries(memoryBreakdown.components)
      .sort(([,a], [,b]) => b.used - a.used)
      .slice(0, 5)
      .map(([name, data], index) => ({
        rank: index + 1,
        name: name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1'),
        used: Math.round(data.used * 10) / 10, // Round to 1 decimal place for cleaner display
        percentage: Math.round(data.percentage * 10) / 10, // Round to 1 decimal place
        trend: data.trend,
        healthStatus: data.healthStatus
      }));
    
    // Get critical recommendations
    const criticalRecommendations = memoryBreakdown.recommendations
      .filter(r => r.priority === 'high')
      .slice(0, 3);
    
    res.json({
      success: true,
      data: {
        overview: {
          totalUsed: Math.round(memoryBreakdown.heapUsed * 10) / 10,
          totalAvailable: Math.round(memoryBreakdown.heapTotal * 10) / 10,
          utilizationPercentage: Math.round((memoryBreakdown.heapUsed / memoryBreakdown.heapTotal) * 100),
          growthRate: Math.round(memoryBreakdown.growthRate * 10) / 10,
          peakUsage: Math.round(memoryBreakdown.peakUsage * 10) / 10,
          averageUsage: Math.round(memoryBreakdown.averageUsage * 10) / 10
        },
        components: Object.fromEntries(
          Object.entries(memoryBreakdown.components).map(([name, data]) => [
            name, {
              ...data,
              used: Math.round(data.used * 10) / 10,
              percentage: Math.round(data.percentage * 10) / 10
            }
          ])
        ),
        topConsumers,
        garbageCollection: memoryBreakdown.gcMetrics,
        efficiency: memoryBreakdown.efficiency,
        recommendations: {
          critical: criticalRecommendations,
          all: memoryBreakdown.recommendations
        },
        trends: memoryTrends,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    logger.error('Error fetching memory breakdown', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch memory breakdown data',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Component-specific memory details endpoint
router.get('/memory-breakdown/:component', async (req: Request, res: Response) => {
  try {
    const { component } = req.params;
    const metricsService = MetricsCollectionService.getInstance();
    const currentMetrics = await metricsService.getCurrentMetrics();
    const memoryBreakdown = currentMetrics.system.memoryUsage.breakdown;
    
    const componentData = (memoryBreakdown.components as any)[component];
    if (!componentData) {
      return res.status(404).json({
        success: false,
        error: `Component '${component}' not found`
      });
    }
    
    // Get historical data for this component
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const historicalMetrics = metricsService.getMetricsHistory({
      start: oneHourAgo,
      end: new Date()
    });
    
    const componentTrends = historicalMetrics.map(m => ({
      timestamp: m.timestamp,
      used: ((m.system.memoryUsage.breakdown?.components as any)?.[component]?.used) || 0,
      percentage: ((m.system.memoryUsage.breakdown?.components as any)?.[component]?.percentage) || 0
    }));
    
    // Get recommendations specific to this component
    const componentRecommendations = memoryBreakdown.recommendations
      .filter(r => r.title.toLowerCase().includes(component.toLowerCase()) || 
                   r.description.toLowerCase().includes(component.toLowerCase()));
    
    res.json({
      success: true,
      data: {
        component: component,
        current: componentData,
        trends: componentTrends,
        recommendations: componentRecommendations,
        details: {
          breakdown: componentData.details,
          healthAnalysis: {
            status: componentData.healthStatus,
            trend: componentData.trend,
            riskLevel: componentData.healthStatus === 'critical' ? 'high' : 
                      componentData.healthStatus === 'warning' ? 'medium' : 'low'
          }
        },
        lastUpdated: componentData.lastUpdated
      }
    });
  } catch (error) {
    console.error('Error fetching component memory details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch component memory details'
    });
  }
});

export default router; 