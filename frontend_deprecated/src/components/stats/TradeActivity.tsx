import React from 'react';
import styled from 'styled-components';

// Types for activity data
interface TradeActivityItem {
  id: string;
  type: 'execution' | 'creation' | 'approval' | 'expiration' | 'rejection';
  tradeId: string;
  participants: number;
  nfts: string[]; // NFT names or IDs
  timestamp: Date;
  walletAddress?: string;
}

interface TradeActivityProps {
  activities: TradeActivityItem[];
  isLoading?: boolean;
  limit?: number;
  onViewAll?: () => void;
}

// Styled components
const ActivityContainer = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  box-shadow: ${({ theme }) => theme.shadows.sm};
  border: 1px solid rgba(255, 255, 255, 0.1);
  width: 100%;
  margin: 0; /* Remove margins as parent container controls spacing */
  /* Fix for border-radius rendering */
  transform: translateZ(0);
  overflow: visible;
  position: relative;
  box-sizing: border-box;
  max-width: 100%;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: rgba(255, 255, 255, 0.2);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  @media (max-width: 640px) {
    padding: ${({ theme }) => theme.spacing.sm};
    margin: 0;
  }
`;

const ActivityHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: ${({ theme }) => theme.spacing.sm};
  
  h3 {
    font-size: ${({ theme }) => theme.typography.fontSize.lg};
    color: white;
    margin: 0;
  }
  
  @media (max-width: 480px) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const ActivityList = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  flex: 1;
  min-height: 200px; /* Ensure minimum height for consistency */
`;

const ActivityItem = styled.div`
  display: flex;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  width: 100%;
  box-sizing: border-box;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.xs};
  transition: all 0.2s ease;
  position: relative;
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.03);
    transform: translateX(1px);
    padding-left: ${({ theme }) => theme.spacing.xs};
    box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.15);
  }
  
  @media (max-width: 480px) {
    padding: ${({ theme }) => theme.spacing.xs} 0;
  }
`;

const ActivityIcon = styled.div<{ $type: TradeActivityItem['type'] }>`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: ${({ theme }) => theme.spacing.sm};
  /* Fix for border-radius rendering */
  transform: translateZ(0);
  position: relative;
  transition: all 0.2s ease;
  
  background-color: ${({ $type, theme }) => {
    switch ($type) {
      case 'execution':
        return `${theme.colors.success}15`;
      case 'creation':
        return `${theme.colors.primary}15`;
      case 'approval':
        return `${theme.colors.primary}15`;
      case 'expiration':
        return `${theme.colors.warning}15`;
      case 'rejection':
        return `${theme.colors.error}15`;
      default:
        return theme.colors.backgroundSecondary;
    }
  }};
  
  color: ${({ $type, theme }) => {
    switch ($type) {
      case 'execution':
        return theme.colors.success;
      case 'creation':
        return theme.colors.primary;
      case 'approval':
        return theme.colors.primary;
      case 'expiration':
        return theme.colors.warning;
      case 'rejection':
        return theme.colors.error;
      default:
        return theme.colors.textSecondary;
    }
  }};
  
  ${ActivityItem}:hover & {
    transform: scale(1.03);
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  
  svg {
    transition: all 0.2s ease;
    
    ${ActivityItem}:hover & {
      transform: scale(1.1);
    }
  }
  
  @media (max-width: 480px) {
    width: 28px;
    height: 28px;
    min-width: 28px;
    margin-right: ${({ theme }) => theme.spacing.xs};
    
    svg {
      width: 14px;
      height: 14px;
    }
  }
`;

const ActivityInfo = styled.div`
  flex: 1;
  min-width: 0;
  overflow: hidden;
`;

const ActivityTitle = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.2s ease;
  
  ${ActivityItem}:hover & {
    color: ${({ theme }) => theme.colors.primary};
  }
  
  @media (max-width: 480px) {
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
  }
`;

const ActivityDescription = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ActivityTime = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: rgba(255, 255, 255, 0.5);
  min-width: 80px;
  text-align: right;
  white-space: nowrap;
  
  @media (max-width: 480px) {
    min-width: auto;
    text-align: left;
    width: 100%;
    margin-left: 36px;
    padding-left: ${({ theme }) => theme.spacing.sm};
  }
`;

const ViewAllButton = styled.button`
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.primary};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: ${({ theme }) => theme.colors.primary}20;
    transform: translateY(-1px);
    box-shadow: 0 1px 3px rgba(103, 69, 255, 0.2);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  @media (max-width: 480px) {
    width: 100%;
  }
`;

const NoActivities = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.md};
  color: rgba(255, 255, 255, 0.5);
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  width: 100%;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  min-height: 200px;
`;

// Helper functions
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffDays > 0) {
    return `${diffDays}d ago`;
  } else if (diffHrs > 0) {
    return `${diffHrs}h ago`;
  } else if (diffMin > 0) {
    return `${diffMin}m ago`;
  } else {
    return 'Just now';
  }
};

const getActivityIcon = (type: TradeActivityItem['type']) => {
  switch (type) {
    case 'execution':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'creation':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'approval':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'expiration':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
          <path d="M12 8V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case 'rejection':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    default:
      return null;
  }
};

const getActivityTitle = (activity: TradeActivityItem): string => {
  switch (activity.type) {
    case 'execution':
      return 'Trade Executed';
    case 'creation':
      return 'Trade Created';
    case 'approval':
      return 'Trade Approved';
    case 'expiration':
      return 'Trade Expired';
    case 'rejection':
      return 'Trade Rejected';
    default:
      return 'Trade Activity';
  }
};

const getActivityDescription = (activity: TradeActivityItem): string => {
  const shortTradeId = `#${activity.tradeId.substring(0, 6)}...`;
  const nftText = activity.nfts.length > 1 
    ? `${activity.nfts[0]} and ${activity.nfts.length - 1} more` 
    : activity.nfts[0];
    
  switch (activity.type) {
    case 'execution':
      return `Trade ${shortTradeId} with ${activity.participants} participants completed successfully`;
    case 'creation':
      return `New trade ${shortTradeId} created with ${activity.participants} participants`;
    case 'approval':
      return `Step approved for trade ${shortTradeId}, involving ${nftText}`;
    case 'expiration':
      return `Trade ${shortTradeId} expired with ${activity.participants} participants`;
    case 'rejection':
      return `Trade ${shortTradeId} was rejected by a participant`;
    default:
      return `Activity related to trade ${shortTradeId}`;
  }
};

/**
 * A component to display recent trade activity.
 */
const TradeActivity: React.FC<TradeActivityProps> = ({ 
  activities, 
  isLoading = false,
  limit = 5,
  onViewAll 
}) => {
  const displayLimit = limit || 5;

  if (isLoading) {
    return (
      <ActivityContainer>
        <ActivityHeader>
          <h3>Recent Activity</h3>
        </ActivityHeader>
        <ActivityList>
          {[...Array(3)].map((_, index) => (
            <ActivityItem key={index} style={{ opacity: 0.5 }}>
              <ActivityIcon $type="creation">
                <div style={{ width: 18, height: 18 }} />
              </ActivityIcon>
              <ActivityInfo>
                <ActivityTitle>Loading...</ActivityTitle>
                <ActivityDescription>Loading activity details...</ActivityDescription>
              </ActivityInfo>
              <ActivityTime>--</ActivityTime>
            </ActivityItem>
          ))}
        </ActivityList>
      </ActivityContainer>
    );
  }

  return (
    <ActivityContainer>
      <ActivityHeader>
        <h3>Recent Activity</h3>
        {onViewAll && activities.length > displayLimit && (
          <ViewAllButton onClick={onViewAll}>
            View All
          </ViewAllButton>
        )}
      </ActivityHeader>

      {activities.length === 0 ? (
        <NoActivities>
          No trade activity recorded yet. Activity will appear here as trades are executed.
        </NoActivities>
      ) : (
        <ActivityList>
          {activities.slice(0, displayLimit).map((activity) => (
            <ActivityItem key={activity.id || `${activity.type}-${activity.timestamp.getTime()}`}>
              <ActivityIcon $type={activity.type}>
                {getActivityIcon(activity.type)}
              </ActivityIcon>
              <ActivityInfo>
                <ActivityTitle>{getActivityTitle(activity)}</ActivityTitle>
                <ActivityDescription>{getActivityDescription(activity)}</ActivityDescription>
              </ActivityInfo>
              <ActivityTime>{formatTimeAgo(activity.timestamp)}</ActivityTime>
            </ActivityItem>
          ))}
        </ActivityList>
      )}
    </ActivityContainer>
  );
};

export default TradeActivity; 