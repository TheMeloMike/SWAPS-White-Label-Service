import { Server as HttpServer } from 'http';
import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
// import { FeatureFlagService } from '../ai/FeatureFlagService'; // Deprecated for white label

export interface NotificationPayload {
  id: string;
  type: 'trade_opportunity' | 'price_alert' | 'market_update' | 'system_message';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  walletAddress: string;
  data?: {
    tradeLoop?: any;
    nftAddress?: string;
    collectionId?: string;
    priceChange?: number;
    timeframe?: string;
    actionRequired?: boolean;
    expiresAt?: Date;
  };
  timestamp: Date;
  read: boolean;
}

export interface UserSubscription {
  walletAddress: string;
  websocket: WebSocket;
  subscriptions: {
    tradeOpportunities: boolean;
    priceAlerts: boolean;
    marketUpdates: boolean;
    systemMessages: boolean;
  };
  preferences: {
    minTradeValue?: number;
    maxNotificationsPerHour?: number;
    collections?: string[];
    timeframe?: string;
  };
  lastActivity: Date;
  notificationCount: {
    hourly: number;
    daily: number;
    lastReset: Date;
  };
}

export interface NotificationMetrics {
  totalNotificationsSent: number;
  notificationsByType: Record<string, number>;
  activeSubscriptions: number;
  averageDeliveryTime: number;
  failedDeliveries: number;
  userEngagement: {
    openRate: number;
    clickThroughRate: number;
  };
}

/**
 * WebSocket-based notification service for real-time trade opportunity alerts
 * Integrates with existing WebSocket infrastructure and AI market intelligence
 */
export class WebSocketNotificationService {
  private static instance: WebSocketNotificationService;
  private logger: Logger;
  private wss?: WebSocket.Server;
  // // private featureFlagService: FeatureFlagService; // Deprecated for white label // Deprecated for white label
  
  // User management
  private activeConnections = new Map<string, UserSubscription>();
  private notificationQueue = new Map<string, NotificationPayload[]>();
  private deliveryMetrics = new Map<string, { sent: Date; delivered?: Date; read?: Date }>();
  
  // Rate limiting and throttling
  private readonly DEFAULT_MAX_NOTIFICATIONS_PER_HOUR = 10;
  private readonly DEFAULT_MAX_NOTIFICATIONS_PER_DAY = 50;
  private readonly NOTIFICATION_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  private readonly CONNECTION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  
  // Performance tracking
  private metrics: NotificationMetrics = {
    totalNotificationsSent: 0,
    notificationsByType: {},
    activeSubscriptions: 0,
    averageDeliveryTime: 0,
    failedDeliveries: 0,
    userEngagement: {
      openRate: 0,
      clickThroughRate: 0
    }
  };
  
  private cleanupInterval?: NodeJS.Timeout;

  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('WebSocketNotificationService');
    // this.featureFlagService = FeatureFlagService.getInstance(); // Deprecated for white label
    
    // Start periodic cleanup
    this.startPeriodicCleanup();
    
    this.logger.info('WebSocketNotificationService initialized');
  }

  public static getInstance(): WebSocketNotificationService {
    if (!WebSocketNotificationService.instance) {
      WebSocketNotificationService.instance = new WebSocketNotificationService();
    }
    return WebSocketNotificationService.instance;
  }

  /**
   * Initialize WebSocket server with HTTP server
   */
  public initialize(server: HttpServer): void {
    if (this.wss) {
      this.logger.warn('WebSocket server already initialized');
      return;
    }

    this.wss = new WebSocket.Server({ 
      server, 
      path: '/ws/notifications',
      clientTracking: true 
    });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error: Error) => {
      this.logger.error('WebSocket server error', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    });

    this.logger.info('WebSocket notification server initialized on /ws/notifications');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const operation = this.logger.operation('handleConnection');
    
    try {
      // Extract wallet address from query parameters or headers
      const url = new URL(request.url || '', 'http://localhost');
      const walletParam = url.searchParams.get('wallet');
      const headerParam = request.headers['x-wallet-address'];
      const walletAddress = walletParam || (Array.isArray(headerParam) ? headerParam[0] : headerParam);

      if (!walletAddress || typeof walletAddress !== 'string') {
        operation.warn('Connection rejected: missing wallet address');
        ws.close(1008, 'Wallet address required');
        operation.end();
        return;
      }


      // Create user subscription
      const subscription: UserSubscription = {
        walletAddress,
        websocket: ws,
        subscriptions: {
          tradeOpportunities: true,
          priceAlerts: true,
          marketUpdates: false, // Default off for less spam
          systemMessages: true
        },
        preferences: {
          maxNotificationsPerHour: this.DEFAULT_MAX_NOTIFICATIONS_PER_HOUR,
          timeframe: '24h'
        },
        lastActivity: new Date(),
        notificationCount: {
          hourly: 0,
          daily: 0,
          lastReset: new Date()
        }
      };

      // Store connection
      this.activeConnections.set(walletAddress, subscription);
      this.metrics.activeSubscriptions = this.activeConnections.size;

      operation.info('WebSocket connection established', {
        walletAddress: walletAddress.substring(0, 8) + '...',
        totalConnections: this.activeConnections.size
      });

      // Send welcome message
      this.sendNotificationToUser(walletAddress, {
        id: `welcome_${Date.now()}`,
        type: 'system_message',
        title: '🎯 SWAPS Notifications Active',
        message: 'You\'ll now receive real-time trade opportunity alerts!',
        priority: 'low',
        walletAddress,
        timestamp: new Date(),
        read: false
      });

      // Send any queued notifications
      this.deliverQueuedNotifications(walletAddress);

      // Handle incoming messages
      ws.on('message', (data) => {
        this.handleMessage(walletAddress, data);
      });

      // Handle connection close
      ws.on('close', () => {
        this.handleDisconnection(walletAddress);
      });

      // Handle errors
      ws.on('error', (error) => {
        operation.warn('WebSocket connection error', {
          walletAddress: walletAddress.substring(0, 8) + '...',
          error: error instanceof Error ? error.message : String(error)
        });
      });

      operation.end();
    } catch (error) {
      operation.error('Error handling WebSocket connection', {
        error: error instanceof Error ? error.message : String(error)
      });
      ws.close(1011, 'Internal server error');
      operation.end();
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(walletAddress: string, data: any): void {
    try {
      const message = JSON.parse(data.toString());
      const subscription = this.activeConnections.get(walletAddress);
      
      if (!subscription) return;

      switch (message.type) {
        case 'update_preferences':
          this.updateUserPreferences(walletAddress, message.data);
          break;
        
        case 'mark_read':
          this.markNotificationRead(walletAddress, message.notificationId);
          break;
        
        case 'subscribe':
          this.updateSubscriptions(walletAddress, message.subscriptions);
          break;
        
        case 'ping':
          subscription.websocket.send(JSON.stringify({ type: 'pong', timestamp: new Date() }));
          break;
        
        default:
          this.logger.warn('Unknown message type', { type: message.type, walletAddress: walletAddress.substring(0, 8) + '...' });
      }

      // Update last activity
      subscription.lastActivity = new Date();
    } catch (error) {
      this.logger.warn('Error parsing WebSocket message', {
        walletAddress: walletAddress.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnection(walletAddress: string): void {
    this.activeConnections.delete(walletAddress);
    this.metrics.activeSubscriptions = this.activeConnections.size;
    
    this.logger.info('WebSocket connection closed', {
      walletAddress: walletAddress.substring(0, 8) + '...',
      remainingConnections: this.activeConnections.size
    });
  }

  /**
   * Send notification to specific user
   */
  public async sendNotificationToUser(walletAddress: string, notification: NotificationPayload): Promise<boolean> {
    const subscription = this.activeConnections.get(walletAddress);
    
    // If user not connected, queue the notification
    if (!subscription) {
      this.queueNotification(walletAddress, notification);
      return false;
    }

    // Check rate limits
    if (!this.checkRateLimit(subscription, notification)) {
      this.logger.debug('Notification rate limited', {
        walletAddress: walletAddress.substring(0, 8) + '...',
        type: notification.type
      });
      return false;
    }

    // Check user subscription preferences
    if (!this.shouldSendNotification(subscription, notification)) {
      return false;
    }

    try {
      const startTime = Date.now();
      
      // Send notification
      subscription.websocket.send(JSON.stringify({
        type: 'notification',
        data: notification
      }));

      // Update metrics
      this.updateNotificationMetrics(notification, startTime);
      this.updateUserNotificationCount(subscription);

      this.logger.debug('Notification sent', {
        walletAddress: walletAddress.substring(0, 8) + '...',
        type: notification.type,
        priority: notification.priority
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to send notification', {
        walletAddress: walletAddress.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error)
      });
      
      this.metrics.failedDeliveries++;
      return false;
    }
  }

  /**
   * Broadcast notification to all connected users (filtered by preferences)
   */
  public async broadcastNotification(notification: Omit<NotificationPayload, 'walletAddress'>): Promise<number> {
    const sent = new Set<string>();
    
    for (const [walletAddress, subscription] of this.activeConnections) {
      const userNotification = { ...notification, walletAddress };
      
      if (await this.sendNotificationToUser(walletAddress, userNotification)) {
        sent.add(walletAddress);
      }
    }

    this.logger.info('Broadcast notification sent', {
      type: notification.type,
      totalConnections: this.activeConnections.size,
      successfulDeliveries: sent.size
    });

    return sent.size;
  }

  /**
   * Check if notification should be sent based on user preferences
   */
  private shouldSendNotification(subscription: UserSubscription, notification: NotificationPayload): boolean {
    // Check subscription type
    switch (notification.type) {
      case 'trade_opportunity':
        if (!subscription.subscriptions.tradeOpportunities) return false;
        break;
      case 'price_alert':
        if (!subscription.subscriptions.priceAlerts) return false;
        break;
      case 'market_update':
        if (!subscription.subscriptions.marketUpdates) return false;
        break;
      case 'system_message':
        if (!subscription.subscriptions.systemMessages) return false;
        break;
    }

    // Check minimum trade value if applicable
    if (notification.type === 'trade_opportunity' && 
        subscription.preferences.minTradeValue && 
        notification.data?.tradeLoop?.estimatedValue < subscription.preferences.minTradeValue) {
      return false;
    }

    // Check collection filters
    if (subscription.preferences.collections && 
        subscription.preferences.collections.length > 0 &&
        notification.data?.collectionId &&
        !subscription.preferences.collections.includes(notification.data.collectionId)) {
      return false;
    }

    return true;
  }

  /**
   * Check rate limiting for user
   */
  private checkRateLimit(subscription: UserSubscription, notification: NotificationPayload): boolean {
    const now = new Date();
    const hoursSinceReset = (now.getTime() - subscription.notificationCount.lastReset.getTime()) / (1000 * 60 * 60);
    
    // Reset counters if needed
    if (hoursSinceReset >= 24) {
      subscription.notificationCount.daily = 0;
      subscription.notificationCount.hourly = 0;
      subscription.notificationCount.lastReset = now;
    } else if (hoursSinceReset >= 1) {
      subscription.notificationCount.hourly = 0;
    }

    // Check limits
    const maxHourly = subscription.preferences.maxNotificationsPerHour || this.DEFAULT_MAX_NOTIFICATIONS_PER_HOUR;
    const maxDaily = this.DEFAULT_MAX_NOTIFICATIONS_PER_DAY;

    // Critical notifications bypass rate limits
    if (notification.priority === 'critical') {
      return true;
    }

    return subscription.notificationCount.hourly < maxHourly && 
           subscription.notificationCount.daily < maxDaily;
  }

  /**
   * Update user notification count
   */
  private updateUserNotificationCount(subscription: UserSubscription): void {
    subscription.notificationCount.hourly++;
    subscription.notificationCount.daily++;
  }

  /**
   * Queue notification for offline user
   */
  private queueNotification(walletAddress: string, notification: NotificationPayload): void {
    if (!this.notificationQueue.has(walletAddress)) {
      this.notificationQueue.set(walletAddress, []);
    }
    
    const queue = this.notificationQueue.get(walletAddress)!;
    queue.push(notification);
    
    // Limit queue size (keep only recent notifications)
    if (queue.length > 20) {
      queue.splice(0, queue.length - 20);
    }
  }

  /**
   * Deliver queued notifications when user connects
   */
  private deliverQueuedNotifications(walletAddress: string): void {
    const queue = this.notificationQueue.get(walletAddress);
    if (!queue || queue.length === 0) return;

    // Send up to 5 most recent notifications
    const toSend = queue.slice(-5);
    
    for (const notification of toSend) {
      this.sendNotificationToUser(walletAddress, notification);
    }
    
    // Clear queue
    this.notificationQueue.delete(walletAddress);
  }

  /**
   * Update user preferences
   */
  private updateUserPreferences(walletAddress: string, preferences: any): void {
    const subscription = this.activeConnections.get(walletAddress);
    if (!subscription) return;

    subscription.preferences = { ...subscription.preferences, ...preferences };
    
    this.logger.info('User preferences updated', {
      walletAddress: walletAddress.substring(0, 8) + '...',
      preferences
    });
  }

  /**
   * Update user subscriptions
   */
  private updateSubscriptions(walletAddress: string, subscriptions: any): void {
    const subscription = this.activeConnections.get(walletAddress);
    if (!subscription) return;

    subscription.subscriptions = { ...subscription.subscriptions, ...subscriptions };
    
    this.logger.info('User subscriptions updated', {
      walletAddress: walletAddress.substring(0, 8) + '...',
      subscriptions
    });
  }

  /**
   * Mark notification as read
   */
  private markNotificationRead(walletAddress: string, notificationId: string): void {
    const metrics = this.deliveryMetrics.get(notificationId);
    if (metrics) {
      metrics.read = new Date();
    }
  }

  /**
   * Update notification metrics
   */
  private updateNotificationMetrics(notification: NotificationPayload, startTime: number): void {
    const deliveryTime = Date.now() - startTime;
    
    this.metrics.totalNotificationsSent++;
    this.metrics.notificationsByType[notification.type] = 
      (this.metrics.notificationsByType[notification.type] || 0) + 1;
    
    // Update average delivery time
    this.metrics.averageDeliveryTime = 
      (this.metrics.averageDeliveryTime + deliveryTime) / 2;
    
    // Store delivery metrics
    this.deliveryMetrics.set(notification.id, {
      sent: new Date(startTime),
      delivered: new Date()
    });
  }

  /**
   * Start periodic cleanup of old data
   */
  private startPeriodicCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.NOTIFICATION_CLEANUP_INTERVAL);
  }

  /**
   * Perform cleanup of old data and inactive connections
   */
  private performCleanup(): void {
    const now = new Date();
    const cutoff = new Date(now.getTime() - this.CONNECTION_TIMEOUT);
    
    // Remove inactive connections
    for (const [walletAddress, subscription] of this.activeConnections) {
      if (subscription.lastActivity < cutoff) {
        subscription.websocket.close();
        this.activeConnections.delete(walletAddress);
      }
    }
    
    // Clean old delivery metrics
    for (const [id, metrics] of this.deliveryMetrics) {
      if (metrics.sent < new Date(now.getTime() - 24 * 60 * 60 * 1000)) {
        this.deliveryMetrics.delete(id);
      }
    }
    
    // Update metrics
    this.metrics.activeSubscriptions = this.activeConnections.size;
    
    this.logger.debug('Periodic cleanup completed', {
      activeConnections: this.activeConnections.size,
      queuedNotifications: Array.from(this.notificationQueue.values()).reduce((sum, queue) => sum + queue.length, 0),
      metricsStored: this.deliveryMetrics.size
    });
  }

  /**
   * Get current service metrics
   */
  public getMetrics(): NotificationMetrics & {
    queuedNotifications: number;
    deliveryMetricsCount: number;
  } {
    return {
      ...this.metrics,
      queuedNotifications: Array.from(this.notificationQueue.values()).reduce((sum, queue) => sum + queue.length, 0),
      deliveryMetricsCount: this.deliveryMetrics.size
    };
  }

  /**
   * Get active user subscriptions (admin/debug)
   */
  public getActiveSubscriptions(): Array<{
    walletAddress: string;
    subscriptions: any;
    preferences: any;
    notificationCount: any;
    lastActivity: Date;
  }> {
    return Array.from(this.activeConnections.values()).map(sub => ({
      walletAddress: sub.walletAddress.substring(0, 8) + '...',
      subscriptions: sub.subscriptions,
      preferences: sub.preferences,
      notificationCount: sub.notificationCount,
      lastActivity: sub.lastActivity
    }));
  }

  /**
   * Shutdown service gracefully
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.wss) {
      this.wss.close();
    }
    
    // Close all connections
    for (const subscription of this.activeConnections.values()) {
      subscription.websocket.close();
    }
    
    this.logger.info('WebSocketNotificationService shutdown completed');
  }
} 