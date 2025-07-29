import React, { useState, useEffect, useCallback } from 'react';
import { NotificationService, NotificationPayload, NotificationPreferences } from '../services/notificationService';

interface NotificationCenterProps {
  walletAddress?: string;
  onClose?: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  walletAddress, 
  onClose 
}) => {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    tradeOpportunities: true,
    priceAlerts: true,
    marketUpdates: false,
    systemMessages: true,
    maxNotificationsPerHour: 10,
    timeframe: '24h'
  });

  const notificationService = NotificationService.getInstance();

  // Handle new notifications
  const handleNewNotification = useCallback((notification: NotificationPayload) => {
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);
    
    // Show browser notification if supported and permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id
      });
    }
  }, []);

  // Initialize notification service when wallet connects
  useEffect(() => {
    if (walletAddress) {
      notificationService.connect(walletAddress).then(connected => {
        setIsConnected(connected);
        if (connected) {
          // Load existing notifications
          const existingNotifications = notificationService.getNotifications();
          setNotifications(existingNotifications);
          setUnreadCount(notificationService.getUnreadCount());
          
          // Add notification handler
          notificationService.addHandler(handleNewNotification);
        }
      });

      // Request browser notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          console.log('[NotificationCenter] Notification permission:', permission);
        });
      }
    } else {
      notificationService.disconnect();
      setIsConnected(false);
      setNotifications([]);
      setUnreadCount(0);
    }

    return () => {
      notificationService.removeHandler(handleNewNotification);
    };
  }, [walletAddress, handleNewNotification]);

  // Mark notification as read
  const markAsRead = (notificationId: string) => {
    notificationService.markAsRead(notificationId);
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(notificationService.getUnreadCount());
  };

  // Mark all as read
  const markAllAsRead = () => {
    notificationService.markAllAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  // Update preferences
  const updatePreferences = async (newPreferences: Partial<NotificationPreferences>) => {
    const updated = await notificationService.updatePreferences(newPreferences);
    if (updated) {
      setPreferences(prev => ({ ...prev, ...newPreferences }));
    }
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'border-red-500 bg-red-50';
      case 'high':
        return 'border-orange-500 bg-orange-50';
      case 'medium':
        return 'border-blue-500 bg-blue-50';
      case 'low':
        return 'border-gray-500 bg-gray-50';
      default:
        return 'border-gray-300 bg-white';
    }
  };

  // Get notification icon
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'trade_opportunity':
        return '🔄';
      case 'price_alert':
        return '💰';
      case 'market_update':
        return '📈';
      case 'system_message':
        return '📢';
      default:
        return '🔔';
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return timestamp.toLocaleDateString();
  };

  if (!walletAddress) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-500 mb-4">
          <span className="text-4xl">🔔</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          Connect Your Wallet
        </h3>
        <p className="text-gray-500">
          Connect your wallet to receive real-time trade opportunity notifications
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-96 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🔔</span>
            <div>
              <h2 className="text-lg font-semibold">Notifications</h2>
              <div className="flex items-center space-x-2 text-sm opacity-90">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></span>
                <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                {unreadCount}
              </span>
            )}
            <button
              onClick={() => setShowPreferences(!showPreferences)}
              className="p-1 hover:bg-white hover:bg-opacity-20 rounded"
              title="Notification Settings"
            >
              ⚙️
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-white hover:bg-opacity-20 rounded"
                title="Close"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Preferences Panel */}
      {showPreferences && (
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold mb-3">Notification Preferences</h3>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={preferences.tradeOpportunities}
                onChange={(e) => updatePreferences({ tradeOpportunities: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Trade Opportunities</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={preferences.priceAlerts}
                onChange={(e) => updatePreferences({ priceAlerts: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Price Alerts</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={preferences.marketUpdates}
                onChange={(e) => updatePreferences({ marketUpdates: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Market Updates</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={preferences.systemMessages}
                onChange={(e) => updatePreferences({ systemMessages: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">System Messages</span>
            </label>
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max notifications per hour
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={preferences.maxNotificationsPerHour || 10}
              onChange={(e) => updatePreferences({ maxNotificationsPerHour: parseInt(e.target.value) })}
              className="w-full px-3 py-1 border rounded text-sm"
            />
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <span className="text-3xl mb-2 block">📭</span>
            <p>No notifications yet</p>
            <p className="text-sm mt-1">
              {isConnected ? "You'll be notified of trade opportunities" : "Connect to start receiving notifications"}
            </p>
          </div>
        ) : (
          <>
            {/* Actions Bar */}
            {unreadCount > 0 && (
              <div className="p-3 border-b bg-gray-50">
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Mark all as read ({unreadCount})
                </button>
              </div>
            )}

            {/* Notification Items */}
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !notification.read ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-xl">{getNotificationIcon(notification.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className={`text-sm font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </h4>
                        <div className="flex items-center space-x-1">
                          <span className={`inline-block w-2 h-2 rounded-full ${
                            notification.priority === 'critical' ? 'bg-red-500' :
                            notification.priority === 'high' ? 'bg-orange-500' :
                            notification.priority === 'medium' ? 'bg-blue-500' : 'bg-gray-400'
                          }`}></span>
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(notification.timestamp)}
                          </span>
                        </div>
                      </div>
                      <p className={`text-sm mt-1 ${!notification.read ? 'text-gray-800' : 'text-gray-600'}`}>
                        {notification.message}
                      </p>
                      
                      {/* Additional data display */}
                      {notification.data && (
                        <div className="mt-2 text-xs text-gray-500">
                          {notification.data.priceChange && (
                            <span className={`inline-block px-2 py-1 rounded-full mr-2 ${
                              notification.data.priceChange > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {notification.data.priceChange > 0 ? '+' : ''}
                              {(notification.data.priceChange * 100).toFixed(1)}%
                            </span>
                          )}
                          {notification.data.timeframe && (
                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                              {notification.data.timeframe}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Connection Status Footer */}
      {!isConnected && walletAddress && (
        <div className="p-3 bg-yellow-50 border-t border-yellow-200">
          <div className="flex items-center space-x-2 text-yellow-800">
            <span className="text-sm">⚠️</span>
            <span className="text-sm">
              Reconnecting to notification service...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter; 