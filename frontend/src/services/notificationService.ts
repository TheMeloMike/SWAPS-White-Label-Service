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

export interface NotificationPreferences {
  tradeOpportunities: boolean;
  priceAlerts: boolean;
  marketUpdates: boolean;
  systemMessages: boolean;
  minTradeValue?: number;
  maxNotificationsPerHour?: number;
  collections?: string[];
  timeframe?: string;
}

export type NotificationHandler = (notification: NotificationPayload) => void;

/**
 * Frontend notification service that manages WebSocket connections
 * and provides real-time trade opportunity alerts
 */
export class NotificationService {
  private static instance: NotificationService;
  private ws?: WebSocket;
  private isConnected = false;
  private walletAddress?: string;
  private handlers = new Set<NotificationHandler>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private heartbeatInterval?: number;
  
  // Notification storage
  private notifications: NotificationPayload[] = [];
  private maxStoredNotifications = 50;

  private constructor() {
    // Singleton pattern
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Connect to WebSocket notification server
   */
  public async connect(walletAddress: string): Promise<boolean> {
    if (this.isConnected && this.walletAddress === walletAddress) {
      console.log('[NotificationService] Already connected for this wallet');
      return true;
    }

    // Disconnect existing connection if wallet changed
    if (this.ws && this.walletAddress !== walletAddress) {
      this.disconnect();
    }

    this.walletAddress = walletAddress;

    try {
      const wsUrl = this.getWebSocketUrl(walletAddress);
      console.log('[NotificationService] Connecting to:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('[NotificationService] Connected successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = (event) => {
        console.log('[NotificationService] Connection closed:', event.code, event.reason);
        this.isConnected = false;
        this.stopHeartbeat();
        
        // Attempt to reconnect unless it was a manual disconnect
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('[NotificationService] WebSocket error:', error);
        this.isConnected = false;
      };

      return true;
    } catch (error) {
      console.error('[NotificationService] Failed to connect:', error);
      return false;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = undefined;
    }
    
    this.isConnected = false;
    this.walletAddress = undefined;
    this.reconnectAttempts = 0;
  }

  /**
   * Add notification handler
   */
  public addHandler(handler: NotificationHandler): void {
    this.handlers.add(handler);
  }

  /**
   * Remove notification handler
   */
  public removeHandler(handler: NotificationHandler): void {
    this.handlers.delete(handler);
  }

  /**
   * Get all stored notifications
   */
  public getNotifications(): NotificationPayload[] {
    return [...this.notifications];
  }

  /**
   * Get unread notifications count
   */
  public getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  /**
   * Mark notification as read
   */
  public markAsRead(notificationId: string): void {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      
      // Send read status to server
      this.sendMessage({
        type: 'mark_read',
        notificationId
      });
    }
  }

  /**
   * Mark all notifications as read
   */
  public markAllAsRead(): void {
    this.notifications.forEach(notification => {
      if (!notification.read) {
        notification.read = true;
        this.sendMessage({
          type: 'mark_read',
          notificationId: notification.id
        });
      }
    });
  }

  /**
   * Update notification preferences
   */
  public async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<boolean> {
    if (!this.isConnected || !this.walletAddress) {
      console.warn('[NotificationService] Not connected, cannot update preferences');
      return false;
    }

    try {
      // Send via WebSocket for immediate effect
      this.sendMessage({
        type: 'update_preferences',
        data: preferences
      });

      // Also send via REST API for persistence
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          walletAddress: this.walletAddress,
          preferences
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('[NotificationService] Preferences updated successfully');
      return true;
    } catch (error) {
      console.error('[NotificationService] Failed to update preferences:', error);
      return false;
    }
  }

  /**
   * Update notification subscriptions
   */
  public async updateSubscriptions(subscriptions: Partial<NotificationPreferences>): Promise<boolean> {
    if (!this.isConnected || !this.walletAddress) {
      console.warn('[NotificationService] Not connected, cannot update subscriptions');
      return false;
    }

    try {
      // Send via WebSocket for immediate effect
      this.sendMessage({
        type: 'subscribe',
        subscriptions
      });

      // Also send via REST API for persistence
      const response = await fetch('/api/notifications/subscriptions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          walletAddress: this.walletAddress,
          subscriptions
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('[NotificationService] Subscriptions updated successfully');
      return true;
    } catch (error) {
      console.error('[NotificationService] Failed to update subscriptions:', error);
      return false;
    }
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): {
    isConnected: boolean;
    walletAddress?: string;
    reconnectAttempts: number;
  } {
    return {
      isConnected: this.isConnected,
      walletAddress: this.walletAddress,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'notification':
          this.handleNotification(message.data);
          break;
        
        case 'pong':
          // Heartbeat response
          break;
        
        default:
          console.log('[NotificationService] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[NotificationService] Error parsing message:', error);
    }
  }

  /**
   * Handle incoming notification
   */
  private handleNotification(notification: NotificationPayload): void {
    // Convert timestamp string to Date object if needed
    if (typeof notification.timestamp === 'string') {
      notification.timestamp = new Date(notification.timestamp);
    }
    
    // Store notification
    this.notifications.unshift(notification);
    
    // Limit stored notifications
    if (this.notifications.length > this.maxStoredNotifications) {
      this.notifications = this.notifications.slice(0, this.maxStoredNotifications);
    }
    
    // Notify handlers
    this.handlers.forEach(handler => {
      try {
        handler(notification);
      } catch (error) {
        console.error('[NotificationService] Error in notification handler:', error);
      }
    });
    
    console.log('[NotificationService] Received notification:', {
      type: notification.type,
      priority: notification.priority,
      title: notification.title
    });
  }

  /**
   * Send message to WebSocket server
   */
  private sendMessage(message: any): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Get WebSocket URL with wallet parameter
   */
  private getWebSocketUrl(walletAddress: string): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = process.env.NODE_ENV === 'development' ? ':3001' : '';
    
    return `${protocol}//${host}${port}/ws/notifications?wallet=${encodeURIComponent(walletAddress)}`;
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    
    console.log(`[NotificationService] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.walletAddress && !this.isConnected) {
        this.connect(this.walletAddress);
      }
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.isConnected && this.ws) {
        this.sendMessage({ type: 'ping' });
      }
    }, 30000); // 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }
} 