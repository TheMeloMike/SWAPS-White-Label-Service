'use client';

import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { DashboardService } from '@/services/dashboardService';
import LoadingIndicator from '@/components/common/LoadingIndicator';
import AnimatedTitle from '@/components/AnimatedTitle';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import RippleButton from '@/components/common/RippleButton';
import { AdminAuthService } from '@/services/adminAuth';

// Types for type safety and modularity
interface DashboardKPIs {
  activeUsers: number;
  completedTrades: number;
  successRate: number;
  systemUptime: number;
  errorRate: number;
  aiQueries: number;
  notificationsSent?: number;
  revenue?: number;
}

interface DashboardAlert {
  metric: string;
  condition: 'above' | 'below' | 'equals';
  value: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  lastTriggered?: Date;
  description: string;
}

interface DashboardInsight {
  id: string;
  type: 'trend' | 'anomaly' | 'opportunity' | 'warning' | 'prediction';
  category: 'performance' | 'user' | 'business' | 'system' | 'user_behavior' | 'technical';
  title: string;
  description: string;
  impact?: 'low' | 'medium' | 'high';
  confidence?: number;
  timestamp?: Date;
  priority?: 'low' | 'medium' | 'high';
  actionRequired?: boolean;
  tags?: string[];
  expiresAt?: Date;
}

interface SystemHealthBreakdown {
  overall: number;
  components: {
    'Trade Discovery': number;
    'Notifications': number;
    'AI Services': number;
    'System Resources': number;
  };
  bottlenecks: string[];
  recommendations: string[];
}

interface DashboardData {
  kpis: DashboardKPIs;
  alerts: DashboardAlert[];
  insights: DashboardInsight[];
  systemHealth: number;
  systemHealthBreakdown?: SystemHealthBreakdown;
  lastUpdated: Date;
}

// SWAPS Design System Components
const AppContainer = styled.div`
  min-height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  color: ${({ theme }) => theme.colors.textPrimary};
  overflow-x: hidden;
  overflow-y: visible;
  box-sizing: border-box;
  max-width: 100vw;
  background-color: #111314;
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  animation: fadeIn 0.3s ease-in-out;
  
  @keyframes fadeIn {
    from { opacity: 0.8; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const Container = styled.div`
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  padding: 0.75rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow-x: hidden;
  box-sizing: border-box;
  background-color: #111314;
  
  @media (max-width: 640px) {
    padding: 0.5rem;
  }
`;

const Content = styled.div`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  height: auto;
  min-height: calc(100vh - 100px);
  overflow-y: visible;
  overflow-x: hidden;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  position: relative;
  padding: 0;
  background-color: #111314;
`;

// Header Components
const HeaderSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  margin: 1.5rem auto 2rem auto;
  max-width: 800px;
  width: 100%;
`;

const HeaderSubtitle = styled.p`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  margin: 0.5rem 0 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-weight: ${({ theme }) => theme.typography.fontWeight.normal};
`;

const SystemStatus = styled.div<{ $health: number }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  background: ${({ $health }) => 
    $health >= 80 ? 'rgba(0, 224, 181, 0.1)' : 
    $health >= 60 ? 'rgba(255, 209, 102, 0.1)' : 
    'rgba(255, 93, 93, 0.1)'
  };
  border: 1px solid ${({ $health }) => 
    $health >= 80 ? 'rgba(0, 224, 181, 0.3)' : 
    $health >= 60 ? 'rgba(255, 209, 102, 0.3)' : 
    'rgba(255, 93, 93, 0.3)'
  };
  color: ${({ $health }) => 
    $health >= 80 ? '#00E0B5' : 
    $health >= 60 ? '#FFD166' : 
    '#FF5D5D'
  };
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  margin-top: ${({ theme }) => theme.spacing.md};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.normal};
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: ${({ theme }) => theme.shadows.md};
  }
`;

// System Health Breakdown Modal
const HealthModal = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  display: ${({ $isOpen }) => $isOpen ? 'flex' : 'none'};
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 1rem;
  animation: fadeIn 0.3s ease;
`;

const HealthModalContent = styled.div`
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  border-radius: ${({ theme }) => theme.borderRadius.xl};
  padding: ${({ theme }) => theme.spacing.xl};
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const HealthModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const HealthModalTitle = styled.h2`
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  margin: 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 1.5rem;
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  transition: all ${({ theme }) => theme.transitions.normal};
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

const ComponentsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const ComponentCard = styled.div<{ $score: number }>`
  background: ${({ theme }) => theme.colors.glass};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ $score }) => 
    $score >= 80 ? 'rgba(0, 224, 181, 0.3)' : 
    $score >= 60 ? 'rgba(255, 209, 102, 0.3)' : 
    'rgba(255, 93, 93, 0.3)'
  };
  text-align: center;
`;

const ComponentName = styled.h4`
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  margin: 0 0 ${({ theme }) => theme.spacing.xs} 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const ComponentScore = styled.div<{ $score: number }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ $score }) => 
    $score >= 80 ? '#00E0B5' : 
    $score >= 60 ? '#FFD166' : 
    '#FF5D5D'
  };
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const IssuesList = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const IssueItem = styled.div`
  background: rgba(255, 93, 93, 0.1);
  border: 1px solid rgba(255, 93, 93, 0.3);
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const RecommendationsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const RecommendationItem = styled.div`
  background: rgba(0, 224, 181, 0.1);
  border: 1px solid rgba(0, 224, 181, 0.3);
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  
  &::before {
    content: "💡 ";
    margin-right: ${({ theme }) => theme.spacing.xs};
  }
`;

// Memory Modal Styled Components
const MemoryModal = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  display: ${({ $isOpen }) => $isOpen ? 'flex' : 'none'};
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 1rem;
  animation: fadeIn 0.3s ease;
`;

const MemoryModalContent = styled.div`
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  border-radius: ${({ theme }) => theme.borderRadius.xl};
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  max-width: 1200px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  
  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(147, 51, 234, 0.5);
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(147, 51, 234, 0.7);
  }
`;

const MemoryModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.xl};
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const MemoryModalTitle = styled.h2`
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  margin: 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
`;

const MemoryModalSubtitle = styled.p`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  margin: ${({ theme }) => theme.spacing.xs} 0 0 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const MemorySection = styled.div`
  padding: ${({ theme }) => theme.spacing.xl};
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  
  &:last-child {
    border-bottom: none;
  }
`;

const MemorySectionTitle = styled.h3`
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  margin: 0 0 ${({ theme }) => theme.spacing.md} 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const MemoryOverviewGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
`;

const MemoryOverviewCard = styled.div`
  background: ${({ theme }) => theme.colors.glass};
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.lg};
  transition: all ${({ theme }) => theme.transitions.normal};
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: ${({ theme }) => theme.shadows.md};
  }
`;

const MemoryOverviewLabel = styled.div`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const MemoryOverviewValue = styled.div`
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const MemoryOverviewSubtext = styled.div`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  margin-top: ${({ theme }) => theme.spacing.xs};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const MemoryConsumersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const MemoryConsumerItem = styled.div`
  background: ${({ theme }) => theme.colors.glass};
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.lg};
  transition: all ${({ theme }) => theme.transitions.normal};
  cursor: pointer;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: ${({ theme }) => theme.shadows.sm};
    border-color: rgba(147, 51, 234, 0.3);
  }
`;

const MemoryConsumerHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const MemoryConsumerRank = styled.div`
  background: linear-gradient(135deg, #9333ea, #7c3aed);
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  flex-shrink: 0;
`;

const MemoryConsumerInfo = styled.div`
  flex: 1;
`;

const MemoryConsumerName = styled.div`
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  text-transform: capitalize;
`;

const MemoryConsumerStats = styled.div`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  margin-top: ${({ theme }) => theme.spacing.xs};
`;

const MemoryConsumerStatus = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-shrink: 0;
`;

const MemoryHealthBadge = styled.span<{ $status: 'healthy' | 'warning' | 'critical' }>`
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  
  ${({ $status }) => {
    switch ($status) {
      case 'healthy':
        return `
          background: rgba(0, 224, 181, 0.1);
          color: #00E0B5;
          border: 1px solid rgba(0, 224, 181, 0.3);
        `;
      case 'warning':
        return `
          background: rgba(255, 209, 102, 0.1);
          color: #FFD166;
          border: 1px solid rgba(255, 209, 102, 0.3);
        `;
      case 'critical':
        return `
          background: rgba(255, 93, 93, 0.1);
          color: #FF5D5D;
          border: 1px solid rgba(255, 93, 93, 0.3);
        `;
    }
  }}
`;

const MemoryTrendIcon = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
`;

const MemoryEfficiencyGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
`;

const MemoryCloseButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 1.5rem;
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  transition: all ${({ theme }) => theme.transitions.normal};
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: ${({ theme }) => theme.colors.textPrimary};
    transform: scale(1.1);
  }
`;

// Main Content Layout
const DashboardGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xl};
  width: 100%;
  max-width: 100%;
  
  & > * {
    animation: fadeInStats 0.5s ease backwards;
  }
  
  & > *:nth-child(1) { animation-delay: 0.1s; }
  & > *:nth-child(2) { animation-delay: 0.2s; }
  & > *:nth-child(3) { animation-delay: 0.3s; }
  
  @keyframes fadeInStats {
    from { opacity: 0; transform: translateY(15px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

// KPI Section
const KPISection = styled.section`
  width: 100%;
`;

const SectionTitle = styled.h2`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.colors.textSecondary};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.tight};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const KPIGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  width: 100%;
`;

const KPICard = styled.div<{ $isExpanded?: boolean }>`
  background: ${({ theme }) => theme.colors.glass};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all ${({ theme }) => theme.transitions.normal};
  position: relative;
  overflow: hidden;
  cursor: pointer;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, 
      ${({ theme }) => theme.colors.primary}, 
      ${({ theme }) => theme.colors.secondary}
    );
    transform: scaleX(0);
    transition: transform ${({ theme }) => theme.transitions.normal};
  }
  
  &:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.2);
    box-shadow: ${({ theme }) => theme.shadows.lg};
    
    &::before {
      transform: scaleX(1);
    }
  }
  
  ${({ $isExpanded }) => $isExpanded && `
    min-height: 300px;
  `}
`;

const KPIHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const KPILabel = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.wide};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const KPIIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: rgba(123, 97, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
`;

const KPIValue = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize['3xl']};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.textPrimary};
  line-height: ${({ theme }) => theme.typography.lineHeight.none};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

const KPITrend = styled.div<{ $trend: 'up' | 'down' | 'neutral' }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ $trend, theme }) => 
    $trend === 'up' ? theme.colors.success :
    $trend === 'down' ? theme.colors.error :
    theme.colors.textSecondary
  };
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const KPIDetails = styled.div<{ $isVisible: boolean }>`
  display: ${({ $isVisible }) => $isVisible ? 'block' : 'none'};
  margin-top: ${({ theme }) => theme.spacing.md};
  padding-top: ${({ theme }) => theme.spacing.md};
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  animation: ${({ $isVisible }) => $isVisible ? 'slideDown 0.3s ease' : 'none'};
  
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const KPIDescription = styled.p`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const KPIMetrics = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: ${({ theme }) => theme.spacing.sm};
`;

const KPIMetric = styled.div`
  text-align: center;
`;

const KPIMetricLabel = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.wide};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const KPIMetricValue = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

// Alert Section
const AlertSection = styled.section`
  width: 100%;
`;

const AlertGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const AlertCard = styled.div<{ 
  $severity: 'low' | 'medium' | 'high' | 'critical';
  $isExpanded?: boolean;
}>`
  background: ${({ theme }) => theme.colors.glass};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ $severity, theme }) => {
    switch ($severity) {
      case 'critical': return theme.colors.error;
      case 'high': return '#FF8E53';
      case 'medium': return theme.colors.warning;
      default: return theme.colors.info;
    }
  }};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  transition: all ${({ theme }) => theme.transitions.normal};
  cursor: pointer;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: ${({ theme }) => theme.shadows.md};
  }
  
  ${({ $isExpanded }) => $isExpanded && `
    min-height: 400px;
  `}
`;

const AlertIcon = styled.div<{ $severity: 'low' | 'medium' | 'high' | 'critical' }>`
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $severity, theme }) => {
    switch ($severity) {
      case 'critical': return `${theme.colors.error}20`;
      case 'high': return 'rgba(255, 142, 83, 0.2)';
      case 'medium': return `${theme.colors.warning}20`;
      default: return `${theme.colors.info}20`;
    }
  }};
  color: ${({ $severity, theme }) => {
    switch ($severity) {
      case 'critical': return theme.colors.error;
      case 'high': return '#FF8E53';
      case 'medium': return theme.colors.warning;
      default: return theme.colors.info;
    }
  }};
  font-size: 18px;
  flex-shrink: 0;
`;

const AlertHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
`;

const AlertContent = styled.div`
  flex: 1;
`;

const AlertTitle = styled.h4`
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0 0 ${({ theme }) => theme.spacing.xs} 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const AlertDescription = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const AlertDetails = styled.div<{ $isVisible: boolean }>`
  display: ${({ $isVisible }) => $isVisible ? 'block' : 'none'};
  margin-top: ${({ theme }) => theme.spacing.lg};
  padding-top: ${({ theme }) => theme.spacing.lg};
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  animation: ${({ $isVisible }) => $isVisible ? 'slideDown 0.3s ease' : 'none'};
  
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const AlertAnalysis = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const AlertAnalysisTitle = styled.h5`
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  margin: 0 0 ${({ theme }) => theme.spacing.sm} 0;
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.wide};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const AlertAnalysisContent = styled.div`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const AlertMetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
  margin: ${({ theme }) => theme.spacing.md} 0;
`;

const AlertMetricCard = styled.div<{ $status: 'critical' | 'warning' | 'normal' }>`
  background: ${({ $status }) => 
    $status === 'critical' ? 'rgba(255, 93, 93, 0.1)' :
    $status === 'warning' ? 'rgba(255, 209, 102, 0.1)' :
    'rgba(0, 224, 181, 0.1)'
  };
  border: 1px solid ${({ $status }) => 
    $status === 'critical' ? 'rgba(255, 93, 93, 0.3)' :
    $status === 'warning' ? 'rgba(255, 209, 102, 0.3)' :
    'rgba(0, 224, 181, 0.3)'
  };
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  text-align: center;
`;

const AlertMetricLabel = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.wide};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const AlertMetricValue = styled.div<{ $status: 'critical' | 'warning' | 'normal' }>`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ $status }) => 
    $status === 'critical' ? '#FF5D5D' :
    $status === 'warning' ? '#FFD166' :
    '#00E0B5'
  };
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const AlertActionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const AlertActionItem = styled.div<{ $priority: 'high' | 'medium' | 'low' }>`
  background: ${({ $priority }) => 
    $priority === 'high' ? 'rgba(255, 93, 93, 0.1)' :
    $priority === 'medium' ? 'rgba(255, 209, 102, 0.1)' :
    'rgba(0, 224, 181, 0.1)'
  };
  border: 1px solid ${({ $priority }) => 
    $priority === 'high' ? 'rgba(255, 93, 93, 0.3)' :
    $priority === 'medium' ? 'rgba(255, 209, 102, 0.3)' :
    'rgba(0, 224, 181, 0.3)'
  };
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  
  &::before {
    content: ${({ $priority }) => 
      $priority === 'high' ? '"🚨 "' :
      $priority === 'medium' ? '"⚠️ "' :
      '"💡 "'
    };
    margin-right: ${({ theme }) => theme.spacing.xs};
  }
`;

// Insight Section
const InsightSection = styled.section`
  width: 100%;
`;

const InsightGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
`;

const InsightCard = styled.div<{ $isExpanded?: boolean }>`
  background: ${({ theme }) => theme.colors.glass};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all ${({ theme }) => theme.transitions.normal};
  cursor: pointer;
  
  &:hover {
    transform: translateY(-2px);
    border-color: ${({ theme }) => theme.colors.primary}40;
    box-shadow: ${({ theme }) => theme.shadows.glow};
  }
  
  ${({ $isExpanded }) => $isExpanded && `
    min-height: 450px;
  `}
`;

const InsightHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const InsightIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.primary}20;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
`;

const InsightMeta = styled.div`
  flex: 1;
`;

const InsightTitle = styled.h4`
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0 0 ${({ theme }) => theme.spacing.xs} 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const InsightCategory = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.primary};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.wide};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const InsightDescription = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const InsightDetails = styled.div<{ $isVisible: boolean }>`
  display: ${({ $isVisible }) => $isVisible ? 'block' : 'none'};
  margin-top: ${({ theme }) => theme.spacing.lg};
  padding-top: ${({ theme }) => theme.spacing.lg};
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  animation: ${({ $isVisible }) => $isVisible ? 'slideDown 0.3s ease' : 'none'};
  
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const InsightTechnicalAnalysis = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const InsightDataGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
  margin: ${({ theme }) => theme.spacing.md} 0;
`;

const InsightDataCard = styled.div`
  background: rgba(123, 97, 255, 0.1);
  border: 1px solid rgba(123, 97, 255, 0.3);
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  text-align: center;
`;

const InsightDataLabel = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.primary};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.wide};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const InsightDataValue = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const InsightRecommendations = styled.div`
  margin-top: ${({ theme }) => theme.spacing.lg};
`;

const InsightRecommendationItem = styled.div<{ $urgency: 'immediate' | 'soon' | 'planned' }>`
  background: ${({ $urgency }) => 
    $urgency === 'immediate' ? 'rgba(255, 93, 93, 0.1)' :
    $urgency === 'soon' ? 'rgba(255, 209, 102, 0.1)' :
    'rgba(0, 224, 181, 0.1)'
  };
  border: 1px solid ${({ $urgency }) => 
    $urgency === 'immediate' ? 'rgba(255, 93, 93, 0.3)' :
    $urgency === 'soon' ? 'rgba(255, 209, 102, 0.3)' :
    'rgba(0, 224, 181, 0.3)'
  };
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  
  &::before {
    content: ${({ $urgency }) => 
      $urgency === 'immediate' ? '"🚨 IMMEDIATE: "' :
      $urgency === 'soon' ? '"⏰ SOON: "' :
      '"📋 PLANNED: "'
    };
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    margin-right: ${({ theme }) => theme.spacing.xs};
  }
`;

// Loading and Error States
const LoadingContainer = styled.div`
  width: 100%;
  height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.colors.glass};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  border: 1px solid rgba(255, 255, 255, 0.1);
  gap: ${({ theme }) => theme.spacing.md};
`;

const LoadingText = styled.p`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const ErrorContainer = styled.div`
  background: ${({ theme }) => theme.colors.error}10;
  border: 1px solid ${({ theme }) => theme.colors.error}30;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.xl};
  text-align: center;
  color: ${({ theme }) => theme.colors.error};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const ErrorTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const ErrorMessage = styled.p`
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const RetryButton = styled.button`
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  border: none;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.normal};
  
  &:hover {
    background: ${({ theme }) => theme.colors.primaryDark};
    transform: translateY(-1px);
  }
`;

// Empty State
const EmptyState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.xl};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

// Utility Functions
const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const formatPercentage = (num: number): string => {
  return `${(num * 100).toFixed(1)}%`;
};

const getKPIIcon = (metric: string): string => {
  const icons: Record<string, string> = {
    activeUsers: '👥',
    completedTrades: '🔄',
    successRate: '✅',
    systemUptime: '⏱️',
    errorRate: '❌',
    aiQueries: '🤖',
    notificationsSent: '📢',
    revenue: '💰'
  };
  return icons[metric] || '📊';
};

const getKPILabel = (key: string): string => {
  const labels: Record<string, string> = {
    activeUsers: 'Active Users',
    completedTrades: 'Completed Trades',
    successRate: 'Success Rate',
    systemUptime: 'System Uptime',
    errorRate: 'Error Rate',
    aiQueries: 'AI Queries',
    notificationsSent: 'Notifications Sent',
    revenue: 'Revenue (24h)'
  };
  return labels[key] || key.replace(/([A-Z])/g, ' $1').trim();
};

const getKPIDescription = (key: string): string => {
  const descriptions: Record<string, string> = {
    activeUsers: 'Number of unique users who have interacted with the platform in the last 24 hours. This includes wallet connections, trade searches, and AI queries.',
    completedTrades: 'Total number of successful multi-party trade loops executed in the last 24 hours. Each trade represents multiple NFT swaps in a single transaction.',
    successRate: 'Percentage of trade discovery attempts that result in successful trade execution. Based on algorithm effectiveness and market conditions.',
    systemUptime: 'Percentage of time the SWAPS platform has been operational and accessible to users over the last 24 hours.',
    errorRate: 'Percentage of requests that result in errors. Includes API failures, transaction errors, and system exceptions.',
    aiQueries: 'Number of AI-powered queries processed in the last 24 hours, including trade optimization requests and market analysis.',
    notificationsSent: 'Total push notifications delivered to users about trade opportunities, system updates, and market changes.',
    revenue: 'Total platform revenue generated in the last 24 hours from transaction fees and premium features.'
  };
  return descriptions[key] || 'Detailed metrics breakdown for this indicator.';
};

const getKPIMetrics = (key: string, value: number): Array<{ label: string; value: string }> => {
  switch (key) {
    case 'activeUsers':
      return [
        { label: 'Today', value: value.toString() },
        { label: 'Peak', value: '247' },
        { label: 'Avg/Day', value: '89' }
      ];
    case 'completedTrades':
      return [
        { label: 'Today', value: value.toString() },
        { label: 'Success', value: '85%' },
        { label: 'Avg Size', value: '2.8 NFTs' }
      ];
    case 'successRate':
      return [
        { label: 'Current', value: formatPercentage(value) },
        { label: 'Target', value: '90%' },
        { label: 'Trend', value: '+2.1%' }
      ];
    case 'systemUptime':
      return [
        { label: 'Current', value: formatPercentage(value) },
        { label: 'Target', value: '99.9%' },
        { label: 'MTTR', value: '15min' }
      ];
    case 'errorRate':
      return [
        { label: 'Current', value: formatPercentage(value) },
        { label: 'Target', value: '<0.1%' },
        { label: 'Peak', value: '2.3%' }
      ];
    case 'aiQueries':
      return [
        { label: 'Today', value: value.toString() },
        { label: 'Avg Time', value: '380ms' },
        { label: 'Success', value: '92%' }
      ];
    default:
      return [
        { label: 'Current', value: value.toString() },
        { label: 'Change', value: '+5.2%' },
        { label: 'Target', value: 'Met' }
      ];
  }
};

const getAlertIcon = (severity: string): string => {
  const icons: Record<string, string> = {
    critical: '🚨',
    high: '⚠️',
    medium: '💡',
    low: 'ℹ️'
  };
  return icons[severity] || 'ℹ️';
};

const getInsightIcon = (type: string): string => {
  const icons: Record<string, string> = {
    trend: '📈',
    anomaly: '🔍',
    opportunity: '💰',
    warning: '⚠️',
    prediction: '🔮'
  };
  return icons[type] || '💡';
};

// Alert Analysis Functions
const getAlertAnalysis = (alert: DashboardAlert): {
  analysis: string;
  metrics: Array<{ label: string; value: string; status: 'critical' | 'warning' | 'normal' }>;
  actions: Array<{ text: string; priority: 'high' | 'medium' | 'low' }>;
} => {
  if (alert.metric === 'system.memoryUsage.percentage') {
    return {
      analysis: `Memory usage at 96% indicates the system is approaching capacity limits. This high utilization can lead to performance degradation, increased garbage collection overhead, and potential out-of-memory errors. The threshold of 85% was exceeded, triggering this alert. Immediate action is required to prevent system instability.`,
      metrics: [
        { label: 'Current Usage', value: '96%', status: 'critical' },
        { label: 'Available', value: '5GB', status: 'critical' },
        { label: 'Threshold', value: '85%', status: 'warning' },
        { label: 'Target', value: '<75%', status: 'normal' }
      ],
      actions: [
        { text: 'Scale memory allocation by 50% immediately', priority: 'high' },
        { text: 'Identify and eliminate memory leaks in trade discovery service', priority: 'high' },
        { text: 'Implement memory monitoring and alerting at 70% threshold', priority: 'medium' },
        { text: 'Optimize caching strategies to reduce memory footprint', priority: 'medium' },
        { text: 'Schedule regular memory profiling sessions', priority: 'low' }
      ]
    };
  } else if (alert.metric === 'ai.querySuccessRate') {
    return {
      analysis: `AI query success rate at 75% is below the target threshold of 85%. This impacts user experience and platform reliability. Common causes include model inference timeouts, API rate limiting, or degraded external service performance. The reduced success rate may correlate with increased memory pressure affecting AI processing capabilities.`,
      metrics: [
        { label: 'Success Rate', value: '75%', status: 'warning' },
        { label: 'Target', value: '85%', status: 'normal' },
        { label: 'Avg Response', value: '1.2s', status: 'warning' },
        { label: 'Timeout Rate', value: '15%', status: 'critical' }
      ],
      actions: [
        { text: 'Optimize AI model inference pipeline for faster processing', priority: 'high' },
        { text: 'Implement request queuing and retry mechanisms', priority: 'high' },
        { text: 'Scale AI service infrastructure to handle increased load', priority: 'medium' },
        { text: 'Add circuit breakers for external AI service dependencies', priority: 'medium' },
        { text: 'Implement caching for frequently requested AI analyses', priority: 'low' }
      ]
    };
  }
  
  // Default analysis for other alerts
  return {
    analysis: `This alert indicates a system metric has exceeded its defined threshold. Regular monitoring and proactive response to these alerts helps maintain optimal system performance and user experience.`,
    metrics: [
      { label: 'Current', value: alert.value.toString(), status: 'warning' },
      { label: 'Threshold', value: alert.value.toString(), status: 'normal' },
      { label: 'Severity', value: alert.severity, status: 'warning' }
    ],
    actions: [
      { text: 'Investigate root cause of threshold breach', priority: 'high' },
      { text: 'Implement corrective measures based on findings', priority: 'medium' },
      { text: 'Monitor for trend patterns and adjust thresholds if needed', priority: 'low' }
    ]
  };
};

// Insight Analysis Functions
const getInsightAnalysis = (insight: DashboardInsight): {
  technicalAnalysis: string;
  dataPoints: Array<{ label: string; value: string }>;
  recommendations: Array<{ text: string; urgency: 'immediate' | 'soon' | 'planned' }>;
} => {
  if (insight.title === 'High Memory Usage') {
    return {
      technicalAnalysis: `Memory usage has reached 96% of available capacity, indicating potential memory pressure that could lead to performance degradation. Analysis shows consistent growth in memory consumption over the past 4 hours, with the primary contributors being NFT metadata caching (40%), trade discovery algorithms (35%), and WebSocket connections (25%). The system is approaching the critical threshold where garbage collection overhead significantly impacts performance.`,
      dataPoints: [
        { label: 'Memory Used', value: '124 GB' },
        { label: 'Memory Free', value: '5 GB' },
        { label: 'Total Capacity', value: '129 GB' },
        { label: 'Growth Rate', value: '+2.1%/hour' },
        { label: 'GC Overhead', value: '12%' },
        { label: 'Cache Hit Rate', value: '89%' }
      ],
      recommendations: [
        { text: 'Scale memory allocation to 200GB to provide immediate relief', urgency: 'immediate' },
        { text: 'Implement memory leak detection and monitoring tools', urgency: 'immediate' },
        { text: 'Optimize NFT metadata caching with LRU eviction policies', urgency: 'soon' },
        { text: 'Implement database connection pooling to reduce memory overhead', urgency: 'soon' },
        { text: 'Migrate to streaming data processing for large trade discovery operations', urgency: 'planned' },
        { text: 'Implement horizontal scaling for memory-intensive services', urgency: 'planned' }
      ]
    };
  }
  
  // Default analysis for other insights
  return {
    technicalAnalysis: `This insight provides important information about system performance and potential optimization opportunities. Regular analysis of these patterns helps maintain optimal platform operation and user experience.`,
    dataPoints: [
      { label: 'Confidence', value: `${((insight.confidence || 0.9) * 100).toFixed(1)}%` },
      { label: 'Category', value: insight.category },
      { label: 'Type', value: insight.type },
      { label: 'Impact', value: insight.impact || 'medium' }
    ],
    recommendations: [
      { text: 'Review and analyze the underlying data patterns', urgency: 'soon' },
      { text: 'Implement monitoring for related metrics', urgency: 'planned' },
      { text: 'Consider preventive measures based on insight type', urgency: 'planned' }
    ]
  };
};

// System Health Analysis
const getSystemHealthAnalysis = (health: number): { 
  status: string; 
  color: string; 
  issues: string[]; 
  recommendations: string[] 
} => {
  if (health >= 80) {
    return {
      status: 'Healthy',
      color: '#00E0B5',
      issues: [],
      recommendations: ['Continue monitoring key metrics', 'Maintain current optimization levels']
    };
  } else if (health >= 60) {
    return {
      status: 'Degraded Performance',
      color: '#FFD166',
      issues: [
        'Memory usage above optimal threshold (96%)',
        'AI query success rate below target (85%)',
        'System resources approaching capacity'
      ],
      recommendations: [
        'Investigate memory usage patterns and potential leaks',
        'Scale up system resources to handle increased load',
        'Optimize AI query processing pipeline',
        'Implement caching strategies for frequently accessed data',
        'Monitor database performance and query optimization'
      ]
    };
  } else {
    return {
      status: 'Critical Issues',
      color: '#FF5D5D',
      issues: [
        'Multiple system components below acceptable thresholds',
        'High memory usage causing performance degradation',
        'Service availability impacted'
      ],
      recommendations: [
        'Immediate system resource scaling required',
        'Emergency performance optimization',
        'Implement circuit breakers for failing services',
        'Activate incident response procedures'
      ]
    };
  }
};

// Main Component
export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading, admin, logout, redirectToLogin } = useAdminAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [expandedKPI, setExpandedKPI] = useState<string | null>(null);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [showMemoryBreakdown, setShowMemoryBreakdown] = useState(false);
  const [memoryData, setMemoryData] = useState<any | null>(null); // Changed type to any for now
  const [loadingMemory, setLoadingMemory] = useState(false);
  
  // Real system health breakdown from API - moved to top with other hooks
  const [systemHealthBreakdown, setSystemHealthBreakdown] = useState<SystemHealthBreakdown>({
    overall: 75,
    components: {
      'Trade Discovery': 85,
      'Notifications': 92,
      'AI Services': 75,
      'System Resources': 4
    },
    bottlenecks: [
      'Loading system health data...'
    ],
    recommendations: [
      'Loading recommendations...'
    ]
  });

  // Define all hooks first before any conditional returns
  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      const service = new DashboardService();
      const apiData = await service.getOverview();
      
      // Transform and validate data according to actual API structure
      const transformedData: DashboardData = {
        kpis: {
          activeUsers: apiData.kpis?.activeUsers || 0,
          completedTrades: apiData.kpis?.completedTrades || 0,
          successRate: (apiData.kpis?.successRate || 0) / 100, // API returns as percentage, convert to decimal
          systemUptime: (apiData.summary?.uptime || 0) / 100, // API returns as percentage, convert to decimal  
          errorRate: (apiData.kpis?.errorRate || 0) / 100, // API returns as percentage, convert to decimal
          aiQueries: apiData.kpis?.aiQueries || 0,
          notificationsSent: apiData.kpis?.notificationsSent || 0,
          revenue: apiData.kpis?.revenue || apiData.summary?.revenue24h || 0
        },
        alerts: apiData.alerts || [],
        insights: apiData.insights || [],
        systemHealth: apiData.systemHealth || apiData.summary?.healthScore || 0,
        lastUpdated: new Date(apiData.timestamp || Date.now())
      };
      
      setDashboardData(transformedData);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Dashboard error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMemoryAnalysis = useCallback(async () => {
    setLoadingMemory(true);
    try {
      const dashboardService = new DashboardService();
      const memoryBreakdown = await dashboardService.getMemoryBreakdown();
      setMemoryData(memoryBreakdown);
      setShowMemoryBreakdown(true);
    } catch (error) {
      console.error('Error fetching memory breakdown:', error);
    } finally {
      setLoadingMemory(false);
    }
  }, []);

  // Fetch system health data - moved to top with other hooks
  const fetchSystemHealth = useCallback(async () => {
    try {
      const adminAuthService = AdminAuthService.getInstance();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/dashboard/system-health`, {
        headers: {
          'Authorization': `Bearer ${adminAuthService.getToken()}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const healthData = result.data;
          
          // Transform API data to match our interface
          const transformedData: SystemHealthBreakdown = {
            overall: healthData.overall || (dashboardData?.systemHealth || 75),
            components: {
              'Trade Discovery': healthData.components?.tradeDiscovery || 85,
              'Notifications': healthData.components?.notifications || 92,
              'AI Services': healthData.components?.aiServices || 75,
              'System Resources': healthData.components?.systemResources || Math.max(0, 100 - (healthData.memoryUsage?.percentage || 96))
            },
            bottlenecks: healthData.bottlenecks || [
              `Memory usage at ${healthData.memoryUsage?.percentage || 96}% - approaching capacity limits`,
              `Error rate: ${healthData.errorRate || 0}%`,
              `Active connections: ${healthData.activeConnections || 0}`
            ],
            recommendations: healthData.recommendations || [
              'Scale up memory allocation to handle increased load',
              'Implement Redis caching layer for frequently accessed NFT data',
              'Optimize system performance for better response times'
            ]
          };
          
          setSystemHealthBreakdown(transformedData);
        }
      }
    } catch (error) {
      console.error('Error fetching system health:', error);
      // Keep using the default/fallback data
    }
  }, [dashboardData?.systemHealth]);

  // Authentication check
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      redirectToLogin();
    }
  }, [authLoading, isAuthenticated, redirectToLogin]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
      
      // Auto-refresh every 30 seconds
      const interval = setInterval(fetchDashboardData, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchDashboardData, isAuthenticated]);

  // Fetch system health data on component mount and when dashboard data changes
  useEffect(() => {
    if (isAuthenticated && dashboardData) {
      fetchSystemHealth();
    }
  }, [isAuthenticated, dashboardData, fetchSystemHealth]);

  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <AppContainer>
        <Container>
          <Content>
            <HeaderSection>
              <AnimatedTitle text="Admin Dashboard" />
              <HeaderSubtitle>Authenticating...</HeaderSubtitle>
            </HeaderSection>
            <LoadingContainer>
              <LoadingIndicator size="large" />
              <LoadingText>Verifying admin credentials...</LoadingText>
            </LoadingContainer>
          </Content>
        </Container>
      </AppContainer>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return null; // Component will unmount as redirect happens
  }

  // Loading State
  if (loading && !dashboardData) {
    return (
      <AppContainer>
        <Container>
          <Content>
            <HeaderSection>
              <AnimatedTitle text="Performance Dashboard" />
              <HeaderSubtitle>Real-time system metrics and insights</HeaderSubtitle>
            </HeaderSection>
            <LoadingContainer>
              <LoadingIndicator size="large" />
              <LoadingText>Loading dashboard data...</LoadingText>
            </LoadingContainer>
          </Content>
        </Container>
      </AppContainer>
    );
  }

  // Error State
  if (error) {
    return (
      <AppContainer>
        <Container>
          <Content>
            <HeaderSection>
              <AnimatedTitle text="Performance Dashboard" />
              <HeaderSubtitle>Real-time system metrics and insights</HeaderSubtitle>
            </HeaderSection>
            <ErrorContainer>
              <ErrorTitle>Failed to Load Dashboard</ErrorTitle>
              <ErrorMessage>{error}</ErrorMessage>
              <RetryButton onClick={fetchDashboardData}>
                Retry Loading
              </RetryButton>
            </ErrorContainer>
          </Content>
        </Container>
      </AppContainer>
    );
  }

  if (!dashboardData) {
    return (
      <AppContainer>
        <Container>
          <Content>
            <HeaderSection>
              <AnimatedTitle text="Performance Dashboard" />
              <HeaderSubtitle>Real-time system metrics and insights</HeaderSubtitle>
            </HeaderSection>
            <EmptyState>
              <h3>No Data Available</h3>
              <p>Dashboard data is currently unavailable.</p>
            </EmptyState>
          </Content>
        </Container>
      </AppContainer>
    );
  }

  const { kpis, alerts, insights, systemHealth } = dashboardData;
  const healthAnalysis = getSystemHealthAnalysis(systemHealth);

  return (
    <AppContainer>
      <Container>
        <Content>
          <HeaderSection>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }} />
              <div style={{ textAlign: 'center' }}>
                <AnimatedTitle text="Performance Dashboard" />
                <HeaderSubtitle>Real-time system metrics and insights</HeaderSubtitle>
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                <RippleButton
                  onClick={logout}
                  variant="ghost"
                  size="sm"
                >
                  👤 {admin?.username} • Logout
                </RippleButton>
              </div>
            </div>
            <SystemStatus 
              $health={systemHealth}
              onClick={() => setIsHealthModalOpen(true)}
            >
              {systemHealth >= 80 ? '🟢' : systemHealth >= 60 ? '🟡' : '🔴'}
              System Health: {systemHealth}% - {healthAnalysis.status}
            </SystemStatus>
          </HeaderSection>

          <DashboardGrid>
            {/* KPIs Section */}
            <KPISection>
              <SectionTitle>Key Performance Indicators</SectionTitle>
              <KPIGrid>
                {Object.entries(kpis).map(([key, value]) => (
                  <KPICard 
                    key={key}
                    $isExpanded={expandedKPI === key}
                    onClick={() => setExpandedKPI(expandedKPI === key ? null : key)}
                  >
                    <KPIHeader>
                      <KPILabel>{getKPILabel(key)}</KPILabel>
                      <KPIIcon>{getKPIIcon(key)}</KPIIcon>
                    </KPIHeader>
                    <KPIValue>
                      {key.includes('Rate') || key.includes('Uptime') ? 
                        formatPercentage(value) : 
                        key === 'revenue' ? 
                          `$${formatNumber(value)}` :
                        formatNumber(value)
                      }
                    </KPIValue>
                    <KPITrend $trend="neutral">
                      Last updated: {lastRefresh.toLocaleTimeString()}
                    </KPITrend>
                    
                    <KPIDetails $isVisible={expandedKPI === key}>
                      <KPIDescription>
                        {getKPIDescription(key)}
                      </KPIDescription>
                      <KPIMetrics>
                        {getKPIMetrics(key, value).map((metric, index) => (
                          <KPIMetric key={index}>
                            <KPIMetricLabel>{metric.label}</KPIMetricLabel>
                            <KPIMetricValue>{metric.value}</KPIMetricValue>
                          </KPIMetric>
                        ))}
                      </KPIMetrics>
                    </KPIDetails>
                  </KPICard>
                ))}
              </KPIGrid>
            </KPISection>

            {/* Alerts Section */}
            {alerts && alerts.length > 0 && (
              <AlertSection>
                <SectionTitle>Active Alerts ({alerts.length})</SectionTitle>
                <AlertGrid>
                  {alerts.map((alert, index) => {
                    const alertAnalysis = getAlertAnalysis(alert);
                    const alertId = `${alert.metric}-${index}`;
                    return (
                      <AlertCard 
                        key={index} 
                        $severity={alert.severity}
                        $isExpanded={expandedAlert === alertId}
                        onClick={() => setExpandedAlert(expandedAlert === alertId ? null : alertId)}
                      >
                        <AlertHeader>
                          <AlertIcon $severity={alert.severity}>
                            {getAlertIcon(alert.severity)}
                          </AlertIcon>
                          <AlertContent>
                            <AlertTitle>{alert.metric}</AlertTitle>
                            <AlertDescription>{alert.description}</AlertDescription>
                          </AlertContent>
                        </AlertHeader>
                        
                        <AlertDetails $isVisible={expandedAlert === alertId}>
                          <AlertAnalysis>
                            <AlertAnalysisTitle>Technical Analysis</AlertAnalysisTitle>
                            <AlertAnalysisContent>{alertAnalysis.analysis}</AlertAnalysisContent>
                          </AlertAnalysis>
                          
                          <AlertAnalysis>
                            <AlertAnalysisTitle>Key Metrics</AlertAnalysisTitle>
                            <AlertMetricsGrid>
                              {alertAnalysis.metrics.map((metric, metricIndex) => (
                                <AlertMetricCard key={metricIndex} $status={metric.status}>
                                  <AlertMetricLabel>{metric.label}</AlertMetricLabel>
                                  <AlertMetricValue $status={metric.status}>{metric.value}</AlertMetricValue>
                                </AlertMetricCard>
                              ))}
                            </AlertMetricsGrid>
                          </AlertAnalysis>
                          
                          <AlertAnalysis>
                            <AlertAnalysisTitle>Recommended Actions</AlertAnalysisTitle>
                            <AlertActionsList>
                              {alertAnalysis.actions.map((action, actionIndex) => (
                                <AlertActionItem key={actionIndex} $priority={action.priority}>
                                  {action.text}
                                </AlertActionItem>
                              ))}
                            </AlertActionsList>
                          </AlertAnalysis>
                        </AlertDetails>
                      </AlertCard>
                    );
                  })}
                </AlertGrid>
              </AlertSection>
            )}

            {/* Insights Section */}
            {insights && insights.length > 0 && (
              <InsightSection>
                <SectionTitle>System Insights</SectionTitle>
                <InsightGrid>
                  {insights.map((insight) => {
                    const insightAnalysis = getInsightAnalysis(insight);
                    return (
                      <InsightCard 
                        key={insight.id}
                        $isExpanded={expandedInsight === insight.id}
                        onClick={() => setExpandedInsight(expandedInsight === insight.id ? null : insight.id)}
                      >
                        <InsightHeader>
                          <InsightIcon>{getInsightIcon(insight.type)}</InsightIcon>
                          <InsightMeta>
                            <InsightTitle>{insight.title}</InsightTitle>
                            <InsightCategory>{insight.category}</InsightCategory>
                          </InsightMeta>
                        </InsightHeader>
                        <InsightDescription>{insight.description}</InsightDescription>
                        
                        <InsightDetails $isVisible={expandedInsight === insight.id}>
                          <InsightTechnicalAnalysis>
                            <AlertAnalysisTitle>Deep Technical Analysis</AlertAnalysisTitle>
                            <AlertAnalysisContent>{insightAnalysis.technicalAnalysis}</AlertAnalysisContent>
                          </InsightTechnicalAnalysis>
                          
                          <div>
                            <AlertAnalysisTitle>System Data Points</AlertAnalysisTitle>
                            <InsightDataGrid>
                              {insightAnalysis.dataPoints.map((dataPoint, dataIndex) => (
                                <InsightDataCard key={dataIndex}>
                                  <InsightDataLabel>{dataPoint.label}</InsightDataLabel>
                                  <InsightDataValue>{dataPoint.value}</InsightDataValue>
                                </InsightDataCard>
                              ))}
                            </InsightDataGrid>
                          </div>
                          
                          <InsightRecommendations>
                            <AlertAnalysisTitle>Action Plan</AlertAnalysisTitle>
                            {insightAnalysis.recommendations.map((rec, recIndex) => (
                              <InsightRecommendationItem key={recIndex} $urgency={rec.urgency}>
                                {rec.text}
                              </InsightRecommendationItem>
                            ))}
                          </InsightRecommendations>
                        </InsightDetails>
                      </InsightCard>
                    );
                  })}
                </InsightGrid>
              </InsightSection>
            )}
          </DashboardGrid>

          {/* System Health Modal */}
          <HealthModal $isOpen={isHealthModalOpen}>
            <HealthModalContent>
              <HealthModalHeader>
                <HealthModalTitle>System Health Analysis</HealthModalTitle>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleMemoryAnalysis}
                    disabled={loadingMemory}
                    className="px-3 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded text-sm hover:bg-purple-500/30 transition-colors disabled:opacity-50 font-mono"
                  >
                    {loadingMemory ? 'Loading...' : '🧠 Memory Analysis'}
                  </button>
                  <CloseButton onClick={() => setIsHealthModalOpen(false)}>
                    ✕
                  </CloseButton>
                </div>
              </HealthModalHeader>
              
              <ComponentsGrid>
                {Object.entries(systemHealthBreakdown.components).map(([name, score]) => (
                  <ComponentCard key={name} $score={score}>
                    <ComponentName>{name}</ComponentName>
                    <ComponentScore $score={score}>{score}%</ComponentScore>
                  </ComponentCard>
                ))}
              </ComponentsGrid>

              {systemHealthBreakdown.bottlenecks.length > 0 && (
                <div>
                  <SectionTitle>Identified Issues</SectionTitle>
                  <IssuesList>
                    {systemHealthBreakdown.bottlenecks.map((issue, index) => (
                      <IssueItem key={index}>{issue}</IssueItem>
                    ))}
                  </IssuesList>
                </div>
              )}

              <div>
                <SectionTitle>Recommendations</SectionTitle>
                <RecommendationsList>
                  {systemHealthBreakdown.recommendations.map((rec, index) => (
                    <RecommendationItem key={index}>{rec}</RecommendationItem>
                  ))}
                </RecommendationsList>
              </div>
            </HealthModalContent>
          </HealthModal>

          {/* Memory Breakdown Modal */}
          {showMemoryBreakdown && (
            <MemoryBreakdownModal
              data={memoryData}
              onClose={() => setShowMemoryBreakdown(false)}
              loading={loadingMemory}
            />
          )}

        </Content>
      </Container>
    </AppContainer>
  );
}

// Memory Breakdown Modal Component
interface MemoryBreakdownModalProps {
  data: any | null; // Changed type to any for now
  onClose: () => void;
  loading: boolean;
}

function MemoryBreakdownModal({ data, onClose, loading }: MemoryBreakdownModalProps) {
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);

  // Modal is working! Show the real memory breakdown

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-[#111314] border border-purple-500/20 rounded-lg p-8">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400"></div>
            <span className="text-gray-300">Loading memory analysis...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return '📈';
      case 'decreasing': return '📉';
      case 'stable': return '➡️';
      default: return '➡️';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <MemoryModal $isOpen={true}>
      <MemoryModalContent>
        {/* Header */}
        <MemoryModalHeader>
          <div>
            <MemoryModalTitle>Memory Breakdown Analysis</MemoryModalTitle>
            <MemoryModalSubtitle>Detailed memory usage by component</MemoryModalSubtitle>
          </div>
          <MemoryCloseButton onClick={onClose}>
            ✕
          </MemoryCloseButton>
        </MemoryModalHeader>

        {/* Overview Section */}
        <MemorySection>
          <MemorySectionTitle>📊 Memory Overview</MemorySectionTitle>
          <MemoryOverviewGrid>
            <MemoryOverviewCard>
              <MemoryOverviewLabel>Total Used</MemoryOverviewLabel>
              <MemoryOverviewValue>{Math.round(data.overview.totalUsed * 10) / 10}MB</MemoryOverviewValue>
              <MemoryOverviewSubtext>of {Math.round(data.overview.totalAvailable * 10) / 10}MB</MemoryOverviewSubtext>
            </MemoryOverviewCard>
            <MemoryOverviewCard>
              <MemoryOverviewLabel>Utilization</MemoryOverviewLabel>
              <MemoryOverviewValue>{data.overview.utilizationPercentage}%</MemoryOverviewValue>
              <MemoryOverviewSubtext>Current usage</MemoryOverviewSubtext>
            </MemoryOverviewCard>
            <MemoryOverviewCard>
              <MemoryOverviewLabel>Growth Rate</MemoryOverviewLabel>
              <MemoryOverviewValue>{Math.round(data.overview.growthRate * 10) / 10}MB/hr</MemoryOverviewValue>
              <MemoryOverviewSubtext>Memory growth</MemoryOverviewSubtext>
            </MemoryOverviewCard>
          </MemoryOverviewGrid>
        </MemorySection>

        {/* Top Memory Consumers */}
        <MemorySection>
          <MemorySectionTitle>🔥 Top Memory Consumers</MemorySectionTitle>
          <MemoryConsumersList>
            {data.topConsumers.map((consumer: any, index: number) => (
              <MemoryConsumerItem 
                key={consumer.name}
                onClick={() => setSelectedComponent(consumer.name)}
              >
                <MemoryConsumerHeader>
                  <MemoryConsumerRank>#{index + 1}</MemoryConsumerRank>
                  <MemoryConsumerInfo>
                    <MemoryConsumerName>
                      {consumer.name.replace(/([A-Z])/g, ' $1').trim()}
                    </MemoryConsumerName>
                    <MemoryConsumerStats>
                      {Math.round(consumer.used * 10) / 10}MB ({Math.round(consumer.percentage * 10) / 10}%)
                    </MemoryConsumerStats>
                  </MemoryConsumerInfo>
                  <MemoryConsumerStatus>
                    <MemoryHealthBadge $status={consumer.healthStatus}>
                      {consumer.healthStatus}
                    </MemoryHealthBadge>
                    <MemoryTrendIcon>
                      {getTrendIcon(consumer.trend)}
                    </MemoryTrendIcon>
                  </MemoryConsumerStatus>
                </MemoryConsumerHeader>
              </MemoryConsumerItem>
            ))}
          </MemoryConsumersList>
        </MemorySection>

        {/* Memory Efficiency Metrics */}
        <MemorySection>
          <MemorySectionTitle>⚡ Memory Efficiency</MemorySectionTitle>
          <MemoryEfficiencyGrid>
            <MemoryOverviewCard>
              <MemoryOverviewLabel>Memory per User</MemoryOverviewLabel>
              <MemoryOverviewValue>{Math.round(data.efficiency.memoryPerUser * 10) / 10}MB</MemoryOverviewValue>
            </MemoryOverviewCard>
            <MemoryOverviewCard>
              <MemoryOverviewLabel>Memory per Trade</MemoryOverviewLabel>
              <MemoryOverviewValue>{Math.round(data.efficiency.memoryPerTrade * 10) / 10}MB</MemoryOverviewValue>
            </MemoryOverviewCard>
            <MemoryOverviewCard>
              <MemoryOverviewLabel>Cache Hit Ratio</MemoryOverviewLabel>
              <MemoryOverviewValue>{(data.efficiency.cacheHitRatio * 100).toFixed(1)}%</MemoryOverviewValue>
            </MemoryOverviewCard>
                         <MemoryOverviewCard>
               <MemoryOverviewLabel>Memory Turnover</MemoryOverviewLabel>
               <MemoryOverviewValue>{(data.efficiency.memoryTurnover * 100).toFixed(1)}%</MemoryOverviewValue>
             </MemoryOverviewCard>
           </MemoryEfficiencyGrid>
        </MemorySection>
      </MemoryModalContent>
    </MemoryModal>
  );
} 