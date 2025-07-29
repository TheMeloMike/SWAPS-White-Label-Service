'use client';

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { fadeIn, slideIn } from '@/styles/animations';

const NotificationContainer = styled.div`
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 1000;
  max-width: 400px;
  pointer-events: none;
  
  > * {
    pointer-events: auto;
  }
`;

const NotificationItem = styled.div<{ $type: 'success' | 'warning' | 'error' | 'info' }>`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ $type, theme }) => {
    switch ($type) {
      case 'success': return theme.colors.success + '40';
      case 'warning': return theme.colors.warning + '40';
      case 'error': return theme.colors.error + '40';
      default: return theme.colors.primary + '40';
    }
  }};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  animation: ${slideIn} 0.3s ease-out;
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: ${({ $type, theme }) => {
      switch ($type) {
        case 'success': return theme.colors.success;
        case 'warning': return theme.colors.warning;
        case 'error': return theme.colors.error;
        default: return theme.colors.primary;
      }
    }};
  }
`;

const NotificationIcon = styled.div<{ $type: 'success' | 'warning' | 'error' | 'info' }>`
  font-size: 20px;
  flex-shrink: 0;
`;

const NotificationContent = styled.div`
  flex: 1;
`;

const NotificationTitle = styled.h4`
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0 0 4px 0;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
`;

const NotificationMessage = styled.p`
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  line-height: 1.4;
`;

const NotificationTime = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  padding: 4px;
  opacity: 0.6;
  transition: opacity 0.2s ease;
  
  &:hover {
    opacity: 1;
  }
`;

const ProgressBar = styled.div<{ $duration: number }>`
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  background: rgba(255, 255, 255, 0.2);
  animation: shrink ${props => props.$duration}ms linear forwards;
  
  @keyframes shrink {
    from {
      width: 100%;
    }
    to {
      width: 0%;
    }
  }
`;

export interface Notification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationCenterProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ notifications, onDismiss }) => {
  const [visibleNotifications, setVisibleNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    setVisibleNotifications(notifications.slice(0, 5)); // Show max 5 notifications
  }, [notifications]);

  useEffect(() => {
    // Auto-dismiss notifications after their duration
    const timers = visibleNotifications.map(notification => {
      if (notification.duration) {
        return setTimeout(() => {
          onDismiss(notification.id);
        }, notification.duration);
      }
      return null;
    });

    return () => {
      timers.forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, [visibleNotifications, onDismiss]);

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <NotificationContainer>
      {visibleNotifications.map(notification => (
        <NotificationItem key={notification.id} $type={notification.type}>
          <NotificationIcon $type={notification.type}>
            {getIcon(notification.type)}
          </NotificationIcon>
          
          <NotificationContent>
            <NotificationTitle>{notification.title}</NotificationTitle>
            <NotificationMessage>{notification.message}</NotificationMessage>
            <NotificationTime>{formatTime(notification.timestamp)}</NotificationTime>
          </NotificationContent>
          
          <CloseButton onClick={() => onDismiss(notification.id)}>
            ✕
          </CloseButton>
          
          {notification.duration && (
            <ProgressBar $duration={notification.duration} />
          )}
        </NotificationItem>
      ))}
    </NotificationContainer>
  );
};

export default NotificationCenter;

// Hook for managing notifications
export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      duration: notification.duration || 5000,
    };
    
    setNotifications(prev => [newNotification, ...prev]);
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return {
    notifications,
    addNotification,
    dismissNotification,
    clearAll,
  };
}; 