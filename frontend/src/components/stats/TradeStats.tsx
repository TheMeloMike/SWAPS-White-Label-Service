import React from 'react';
import styled from 'styled-components';
import AnimatedNumber from '@/components/common/AnimatedNumber';
import { CardSkeleton } from '@/components/common/SkeletonLoader';

// Types for stats data
interface TradeStatistic {
  label: string;
  value: string | number;
  change?: number; // Percentage change (positive or negative)
  icon?: React.ReactNode;
  tooltip?: string;
}

interface TradeStatsProps {
  stats: TradeStatistic[];
  isLoading?: boolean;
}

// Styled components
const StatsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  margin: 0; /* Remove margins as parent container controls spacing */
  box-sizing: border-box;
  max-width: 100%;
  position: relative;
  padding: 0;
  overflow: visible;
  
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing.sm};
    margin: 0;
  }
`;

const StatLabel = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: ${({ theme }) => theme.spacing.xs};
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  overflow: visible;
`;

const StatValue = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: white;
  margin-bottom: ${({ theme }) => theme.spacing.xs};
  transition: all 0.3s ease;
`;

const StatCard = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  box-shadow: ${({ theme }) => theme.shadows.sm};
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.25s cubic-bezier(0.2, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transform: translateZ(0);
  overflow: visible;
  position: relative;
  margin-top: 0;
  margin-bottom: 0;
  width: 100%;
  box-sizing: border-box;
  max-width: 100%;
  animation: pulse-glow 6s infinite ease-in-out;
  animation-delay: calc(var(--animation-order, 0) * 0.8s);
  
  @media (max-width: 640px) {
    padding: ${({ theme }) => theme.spacing.sm};
  }

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 15px rgba(103, 69, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.2);
    animation-play-state: paused;
    z-index: 10;
    
    &:before {
      opacity: 1;
    }
    
    ${StatValue} {
      background: linear-gradient(90deg, 
        ${({ theme }) => theme.colors.gradientStart}, 
        ${({ theme }) => theme.colors.gradientEnd}
      );
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      transform: scale(1.05);
    }
  }
  
  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: inherit;
    pointer-events: none;
    z-index: -1;
    transition: opacity 0.3s ease;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1), 
                0 4px 12px 0 rgba(103, 69, 255, 0.15);
    opacity: 0;
  }
  
  @keyframes pulse-glow {
    0% { box-shadow: 0 0 0 rgba(103, 69, 255, 0); }
    50% { box-shadow: 0 0 8px rgba(103, 69, 255, 0.15); }
    100% { box-shadow: 0 0 0 rgba(103, 69, 255, 0); }
  }
`;

const StatChange = styled.div<{ $positive?: boolean }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ $positive, theme }) => 
    $positive ? theme.colors.success : theme.colors.error};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const IconContainer = styled.div`
  color: ${({ theme }) => theme.colors.textSecondary};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const TooltipContainer = styled.div`
  position: relative;
  display: inline-flex;
  z-index: 100;
  margin-left: 4px;
  
  &:hover span {
    visibility: visible;
    opacity: 1;
  }
`;

const Tooltip = styled.span`
  visibility: hidden;
  position: absolute;
  top: -10px;
  left: 24px;
  transform: none;
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textPrimary};
  text-align: left;
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  line-height: 1.5;
  white-space: normal;
  z-index: 999;
  opacity: 0;
  transition: all ${({ theme }) => theme.transitions.normal};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  border: 1px solid ${({ theme }) => theme.colors.surfaceBorder};
  pointer-events: none;
  width: max-content;
  max-width: 220px;
  
  &::after {
    content: "";
    position: absolute;
    top: 15px;
    right: 100%;
    margin-top: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: transparent ${({ theme }) => theme.colors.surface} transparent transparent;
  }
  
  @media (max-width: 768px) {
    right: 0;
    left: auto;
    top: calc(100% + 5px);
    
    &::after {
      right: 10px;
      left: auto;
      top: -10px;
      border-color: transparent transparent ${({ theme }) => theme.colors.surface} transparent;
    }
  }
`;

// Icons for stats
const ArrowUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'currentColor' }}>
    <path d="M12 19V5M12 5L5 12M12 5L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ArrowDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'currentColor' }}>
    <path d="M12 5V19M12 19L19 12M12 19L5 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'currentColor' }}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
    <path d="M12 16V12M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// Default stats to show when no real data is available
const DEFAULT_STATS = [
  {
    label: 'Total Trade Volume',
    value: '0 SOL',
    tooltip: 'Total value of all completed trades on the platform'
  },
  {
    label: 'Active Trades',
    value: 0,
    tooltip: 'Number of trade loops currently waiting for completion'
  },
  {
    label: 'Completed Trades',
    value: 0,
    tooltip: 'Number of successfully executed trades'
  },
  {
    label: 'Success Rate',
    value: '0%',
    tooltip: 'Percentage of created trades that complete successfully'
  },
  {
    label: 'Unique Traders',
    value: 0,
    tooltip: 'Number of unique wallet addresses that have participated in trades'
  }
];

/**
 * A component to display trade statistics in a grid of cards.
 * Always shows real stats even when all values are zero.
 */
const TradeStats: React.FC<TradeStatsProps> = ({ stats, isLoading = false }) => {
  if (isLoading) {
    return (
      <StatsContainer>
        {[...Array(5)].map((_, index) => (
          <StatCard key={index} style={{ opacity: 0.5, animationPlayState: 'paused' }}>
            <StatLabel>Loading...</StatLabel>
            <CardSkeleton height="80px" />
          </StatCard>
        ))}
      </StatsContainer>
    );
  }

  // Ensure we always display key stats, even if they're zero
  let displayStats = [...stats];
  
  // If we have no stats at all, use the default stats with zero values
  if (displayStats.length === 0) {
    displayStats = DEFAULT_STATS;
  } else {
    // Ensure all default stats are represented
    const existingLabels = new Set(displayStats.map(stat => stat.label));
    
    DEFAULT_STATS.forEach(defaultStat => {
      if (!existingLabels.has(defaultStat.label)) {
        displayStats.push(defaultStat);
      }
    });
  }

  // Sort stats to ensure consistent order
  displayStats.sort((a, b) => {
    const orderA = DEFAULT_STATS.findIndex(s => s.label === a.label);
    const orderB = DEFAULT_STATS.findIndex(s => s.label === b.label);
    return orderA - orderB;
  });

  return (
    <StatsContainer>
      {displayStats.map((stat, index) => (
        <StatCard key={index} style={{ '--animation-order': index } as React.CSSProperties}>
          <StatLabel>
            {stat.label}
            {stat.tooltip && (
              <TooltipContainer>
                <InfoIcon />
                <Tooltip>{stat.tooltip}</Tooltip>
              </TooltipContainer>
            )}
          </StatLabel>
          <StatValue>
            {typeof stat.value === 'number' ? (
              <AnimatedNumber 
                value={stat.value} 
                duration={1500} 
                delay={index * 100} 
              />
            ) : (
              stat.value
            )}
          </StatValue>
          {stat.change !== undefined && (
            <StatChange $positive={stat.change >= 0}>
              {stat.change >= 0 ? <ArrowUpIcon /> : <ArrowDownIcon />}
              <AnimatedNumber 
                value={Math.abs(stat.change)} 
                suffix="% from last week" 
                decimals={1}
                duration={1200}  
              />
            </StatChange>
          )}
          {stat.icon && <IconContainer>{stat.icon}</IconContainer>}
        </StatCard>
      ))}
    </StatsContainer>
  );
};

export default TradeStats; 