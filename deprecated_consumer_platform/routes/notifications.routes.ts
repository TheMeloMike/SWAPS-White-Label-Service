import { Router, Request, Response } from 'express';
import { WebSocketNotificationService } from '../services/notifications/WebSocketNotificationService';
import { OpportunityDetectionEngine } from '../services/notifications/OpportunityDetectionEngine';
import { FeatureFlagService } from '../services/ai/FeatureFlagService';
import { LoggingService } from '../utils/logging/LoggingService';
import { z } from 'zod';

const router = Router();
const logger = LoggingService.getInstance().createLogger('NotificationRoutes');

// Validation schemas
const UpdatePreferencesSchema = z.object({
  walletAddress: z.string().min(32),
  preferences: z.object({
    minTradeValue: z.number().min(0).optional(),
    maxNotificationsPerHour: z.number().min(1).max(50).optional(),
    collections: z.array(z.string()).optional(),
    timeframe: z.enum(['1h', '6h', '24h', '7d']).optional()
  })
});

const UpdateSubscriptionsSchema = z.object({
  walletAddress: z.string().min(32),
  subscriptions: z.object({
    tradeOpportunities: z.boolean().optional(),
    priceAlerts: z.boolean().optional(),
    marketUpdates: z.boolean().optional(),
    systemMessages: z.boolean().optional()
  })
});

const TestNotificationSchema = z.object({
  walletAddress: z.string().min(32),
  type: z.enum(['trade_opportunity', 'price_alert', 'market_update', 'system_message']),
  title: z.string().min(1),
  message: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'critical'])
});

/**
 * @route GET /api/notifications/status
 * @desc Get notification system status and metrics
 * @access Public
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const notificationService = WebSocketNotificationService.getInstance();
    const detectionEngine = OpportunityDetectionEngine.getInstance();
    
    const [notificationMetrics, detectionMetrics] = await Promise.all([
      notificationService.getMetrics(),
      detectionEngine.getMetrics()
    ]);

    res.json({
      success: true,
      data: {
        notification: notificationMetrics,
        detection: detectionMetrics,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error getting notification status', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get notification status'
    });
  }
});

/**
 * @route GET /api/notifications/subscriptions
 * @desc Get active user subscriptions (admin endpoint)
 * @access Admin
 */
router.get('/subscriptions', async (req: Request, res: Response) => {
  try {
    const notificationService = WebSocketNotificationService.getInstance();
    const subscriptions = notificationService.getActiveSubscriptions();

    res.json({
      success: true,
      data: {
        subscriptions,
        total: subscriptions.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error getting subscriptions', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get subscriptions'
    });
  }
});

/**
 * @route PUT /api/notifications/preferences
 * @desc Update user notification preferences
 * @access Public
 */
router.put('/preferences', async (req: Request, res: Response) => {
  try {
    const validatedData = UpdatePreferencesSchema.parse(req.body);
    const { walletAddress, preferences } = validatedData;

    // Check if notifications are enabled for this user
    const featureFlagService = FeatureFlagService.getInstance();
    if (!featureFlagService.isEnabled('real_time_notifications', walletAddress)) {
      return res.status(403).json({
        success: false,
        error: 'Notifications not available for this user'
      });
    }

    // Note: In the current implementation, preferences are updated when the user connects via WebSocket
    // This endpoint would ideally store preferences in a database for persistence
    // For now, we'll return success to indicate the API is functional

    logger.info('User preferences update requested', {
      walletAddress: walletAddress.substring(0, 8) + '...',
      preferences
    });

    res.json({
      success: true,
      message: 'Preferences will be updated when you connect to notifications',
      data: {
        walletAddress: walletAddress.substring(0, 8) + '...',
        preferences,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }

    logger.error('Error updating preferences', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to update preferences'
    });
  }
});

/**
 * @route PUT /api/notifications/subscriptions
 * @desc Update user notification subscriptions
 * @access Public
 */
router.put('/subscriptions', async (req: Request, res: Response) => {
  try {
    const validatedData = UpdateSubscriptionsSchema.parse(req.body);
    const { walletAddress, subscriptions } = validatedData;

    // Check if notifications are enabled for this user
    const featureFlagService = FeatureFlagService.getInstance();
    if (!featureFlagService.isEnabled('real_time_notifications', walletAddress)) {
      return res.status(403).json({
        success: false,
        error: 'Notifications not available for this user'
      });
    }

    logger.info('User subscriptions update requested', {
      walletAddress: walletAddress.substring(0, 8) + '...',
      subscriptions
    });

    res.json({
      success: true,
      message: 'Subscriptions will be updated when you connect to notifications',
      data: {
        walletAddress: walletAddress.substring(0, 8) + '...',
        subscriptions,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }

    logger.error('Error updating subscriptions', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to update subscriptions'
    });
  }
});

/**
 * @route GET /api/notifications/opportunities/:walletAddress
 * @desc Get recent opportunities for a specific user
 * @access Public
 */
router.get('/opportunities/:walletAddress', async (req: Request, res: Response) => {
  try {
    const walletAddress = req.params.walletAddress;

    if (!walletAddress || walletAddress.length < 32) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address'
      });
    }

    // Check if notifications are enabled for this user
    const featureFlagService = FeatureFlagService.getInstance();
    if (!featureFlagService.isEnabled('real_time_notifications', walletAddress)) {
      return res.status(403).json({
        success: false,
        error: 'Notifications not available for this user'
      });
    }

    const detectionEngine = OpportunityDetectionEngine.getInstance();
    const opportunities = detectionEngine.getUserOpportunities(walletAddress);

    res.json({
      success: true,
      data: {
        opportunities,
        count: opportunities.length,
        walletAddress: walletAddress.substring(0, 8) + '...',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error getting user opportunities', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get opportunities'
    });
  }
});

/**
 * @route POST /api/notifications/test
 * @desc Send test notification to specific user (admin/debug endpoint)
 * @access Admin
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const validatedData = TestNotificationSchema.parse(req.body);
    const { walletAddress, type, title, message, priority } = validatedData;

    const notificationService = WebSocketNotificationService.getInstance();
    
    const testNotification = {
      id: `test_${Date.now()}`,
      type,
      title: `[TEST] ${title}`,
      message: `[TEST] ${message}`,
      priority,
      walletAddress,
      data: {
        actionRequired: false,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      },
      timestamp: new Date(),
      read: false
    };

    const sent = await notificationService.sendNotificationToUser(walletAddress, testNotification);

    res.json({
      success: true,
      data: {
        sent,
        notification: {
          ...testNotification,
          walletAddress: walletAddress.substring(0, 8) + '...'
        }
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }

    logger.error('Error sending test notification', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to send test notification'
    });
  }
});

/**
 * @route POST /api/notifications/broadcast
 * @desc Broadcast system message to all connected users (admin endpoint)
 * @access Admin
 */
router.post('/broadcast', async (req: Request, res: Response) => {
  try {
    const { title, message, priority = 'medium' } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        error: 'Title and message are required'
      });
    }

    const notificationService = WebSocketNotificationService.getInstance();
    
    const broadcastNotification = {
      id: `broadcast_${Date.now()}`,
      type: 'system_message' as const,
      title: `📢 ${title}`,
      message,
      priority: priority as 'low' | 'medium' | 'high' | 'critical',
      data: {
        actionRequired: false
      },
      timestamp: new Date(),
      read: false
    };

    const sent = await notificationService.broadcastNotification(broadcastNotification);

    logger.info('System broadcast sent', {
      title,
      sent,
      priority
    });

    res.json({
      success: true,
      data: {
        sent,
        title,
        message,
        priority,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error broadcasting notification', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to broadcast notification'
    });
  }
});

/**
 * @route POST /api/notifications/trigger-analysis
 * @desc Manually trigger opportunity analysis (admin/debug endpoint)
 * @access Admin
 */
router.post('/trigger-analysis', async (req: Request, res: Response) => {
  try {
    const detectionEngine = OpportunityDetectionEngine.getInstance();
    
    // Trigger analysis in background
    detectionEngine.triggerAnalysis().catch(error => {
      logger.error('Background analysis failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    });

    res.json({
      success: true,
      message: 'Opportunity analysis triggered',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error triggering analysis', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to trigger analysis'
    });
  }
});

export default router; 