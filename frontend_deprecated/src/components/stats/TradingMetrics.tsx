import React, { useState } from 'react';
import styled from 'styled-components';

// Types for metrics data
interface MetricDataPoint {
  date: string;
  value: number;
}

interface TradingMetricsProps {
  volumeData: MetricDataPoint[];
  tradesData: MetricDataPoint[];
  participantsData: MetricDataPoint[];
  totalVolume: string;
  totalTrades: string;
  totalParticipants: string;
  isLoading?: boolean;
}

// Styled components
const MetricsContainer = styled.div`
  background: #181a1b;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  box-shadow: ${({ theme }) => theme.mode === 'dark' ? '0 4px 12px rgba(0, 0, 0, 0.2)' : theme.shadows.sm};
  border: 1px solid ${({ theme }) => theme.colors.surfaceBorder};
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
  transition: all 0.3s ease;
  
  &:hover {
    border-color: ${({ theme }) => theme.colors.primary + '40'};
    box-shadow: ${({ theme }) => theme.mode === 'dark' ? '0 6px 16px rgba(0, 0, 0, 0.3)' : theme.shadows.md};
  }
  
  @media (max-width: 640px) {
    padding: ${({ theme }) => theme.spacing.sm};
    margin: 0;
  }
`;

const MetricsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  padding-bottom: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.surfaceBorder};
  
  h3 {
    font-size: ${({ theme }) => theme.typography.fontSize.lg};
    color: ${({ theme }) => theme.colors.textPrimary};
    margin: 0;
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  }
  
  @media (max-width: 480px) {
    flex-direction: column;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.xs};
  }
`;

const TabGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  padding: 4px;
  
  @media (max-width: 768px) {
    width: 100%;
    justify-content: space-between;
  }
`;

const Tab = styled.button<{ $active?: boolean }>`
  background: ${({ $active, theme }) => $active ? `linear-gradient(
    90deg, 
    ${theme.colors.gradientStart}, 
    ${theme.colors.gradientEnd}
  )` : 'transparent'};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  color: ${({ $active }) => $active ? 'white' : 'rgba(255, 255, 255, 0.6)'};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: ${({ $active, theme }) => $active ? theme.typography.fontWeight.medium : theme.typography.fontWeight.normal};
  
  &:hover {
    background: ${({ $active, theme }) => $active ? `linear-gradient(
      90deg, 
      ${theme.colors.gradientStart}, 
      ${theme.colors.gradientEnd}
    )` : theme.colors.backgroundSecondary};
    box-shadow: ${({ $active, theme }) => $active ? theme.shadows.sm : 'none'};
  }
  
  @media (max-width: 768px) {
    flex: 1;
    text-align: center;
  }
`;

const TimeframeGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-top: ${({ theme }) => theme.spacing.xs};
  
  @media (max-width: 768px) {
    width: 100%;
    justify-content: center;
  }
`;

const TimeframeButton = styled.button<{ $active?: boolean }>`
  background: transparent;
  border: none;
  color: ${({ $active }) => $active ? 'white' : 'rgba(255, 255, 255, 0.5)'};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  padding: 0.2rem 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: ${({ $active, theme }) => $active ? theme.typography.fontWeight.medium : theme.typography.fontWeight.normal};
  border-bottom: 1px solid ${({ $active }) => $active ? 'rgba(255, 255, 255, 0.2)' : 'transparent'};
  
  &:hover {
    color: white;
    border-color: rgba(255, 255, 255, 0.15);
  }
`;

const MetricsHighlights = styled.div`
  display: flex;
  justify-content: space-around;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  
  @media (max-width: 768px) {
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.md};
  }
`;

const HighlightStat = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  
  @media (max-width: 768px) {
    flex: 1 0 30%;
  }
`;

const HighlightValue = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: white;
  margin-bottom: 0.25rem;
`;

const HighlightLabel = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: rgba(255, 255, 255, 0.6);
`;

const ChartContainer = styled.div`
  height: 280px;
  width: 100%;
  margin-top: ${({ theme }) => theme.spacing.md};
  position: relative;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => theme.spacing.md} 0;
  box-sizing: border-box;
  flex: 1;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  
  @media (max-width: 768px) {
    height: 240px;
  }
  
  @media (max-width: 640px) {
    height: 200px;
  }
`;

// Let's also update the tooltip
const TooltipContainer = styled.div`
  background: rgba(24, 24, 28, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  
  p {
    margin: 0.25rem 0;
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    color: white;
  }
  
  .tooltip-label {
    color: rgba(255, 255, 255, 0.7);
  }
  
  .tooltip-value {
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  }
`;

const MetricsContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

const ChartBars = styled.div`
  display: flex;
  align-items: flex-end;
  height: 200px;
  width: 100%;
  position: relative;
  gap: 6px;
  padding-bottom: 30px;
  box-sizing: border-box;
  overflow-x: auto;
  flex: 1;
  
  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 2px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.surfaceBorder};
    border-radius: 2px;
  }
  
  &::after {
    content: '';
    position: absolute;
    bottom: 30px;
    left: 0;
    right: 0;
    height: 1px;
    background: ${({ theme }) => theme.colors.surfaceBorder};
  }
  
  @media (max-width: 768px) {
    height: 180px;
    gap: 4px;
  }
  
  @media (max-width: 640px) {
    height: 160px;
    gap: 3px;
  }
`;

const ChartBar = styled.div<{ $height: number; $isActive: boolean }>`
  flex: 1;
  height: ${({ $height }) => `${$height}%`};
  min-height: 1px;
  min-width: 20px;
  background: ${({ $isActive, theme }) => 
    $isActive 
      ? `linear-gradient(180deg, ${theme.colors.gradientStart}, ${theme.colors.gradientEnd})`
      : theme.colors.primary + '40'};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  transition: all 0.3s ease-out;
  position: relative;
  cursor: pointer;
  overflow: hidden;
  transform: translateZ(0);
  margin: 0 1px;
  
  &:hover {
    background: ${({ theme }) => 
      `linear-gradient(180deg, ${theme.colors.gradientStart}, ${theme.colors.gradientEnd})`};
    transform: translateY(-3px) scaleX(1.05);
    
    &::after {
      content: attr(data-value);
      position: absolute;
      top: -30px;
      left: 50%;
      transform: translateX(-50%);
      padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
      background: #181a1b;
      color: ${({ theme }) => theme.colors.textPrimary};
      border-radius: ${({ theme }) => theme.borderRadius.sm};
      font-size: 11px;
      white-space: nowrap;
      z-index: 10;
      box-shadow: ${({ theme }) => theme.shadows.sm};
      border: 1px solid ${({ theme }) => theme.colors.surfaceBorder};
    }
  }
`;

const XAxis = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: ${({ theme }) => theme.spacing.sm};
  padding: 0 ${({ theme }) => theme.spacing.xs};
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  
  &::-webkit-scrollbar {
    display: none;
  }
`;

const AxisLabel = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textSecondary};
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
  padding: 0 ${({ theme }) => theme.spacing.xs};
  transition: color 0.3s ease;
  
  &:hover {
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

const SummaryCards = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  box-sizing: border-box;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(3, 1fr);
    gap: ${({ theme }) => theme.spacing.sm};
  }
  
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing.sm};
  }
`;

const SummaryCard = styled.div`
  background: #242627;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.surfaceBorder};
  box-shadow: ${({ theme }) => theme.mode === 'dark' ? '0 4px 12px rgba(0, 0, 0, 0.2)' : theme.shadows.sm};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  width: 100%;
  box-sizing: border-box;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    border-color: ${({ theme }) => theme.colors.primary + '60'};
    box-shadow: ${({ theme }) => theme.mode === 'dark' 
      ? '0 6px 16px rgba(0, 0, 0, 0.3)' 
      : theme.shadows.md};
  }
`;

const SummaryLabel = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: color 0.3s ease;
`;

const SummaryValue = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  transition: color 0.3s ease;
  margin-top: ${({ theme }) => theme.spacing.xs};
`;

const NoData = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
`;

const LoadingContainer = styled.div`
  height: 200px;
  width: 100%;
  position: relative;
  margin-top: ${({ theme }) => theme.spacing.lg};
  display: flex;
  align-items: center;
  justify-content: center;
`;

/**
 * A component to display trade volume and other metrics charts.
 */
const TradingMetrics: React.FC<TradingMetricsProps> = ({
  volumeData,
  tradesData,
  participantsData,
  totalVolume,
  totalTrades,
  totalParticipants,
  isLoading = false
}) => {
  const [activeTab, setActiveTab] = useState<'volume' | 'trades' | 'participants'>('volume');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  
  const getActiveData = () => {
    switch (activeTab) {
      case 'volume':
        return volumeData;
      case 'trades':
        return tradesData;
      case 'participants':
        return participantsData;
      default:
        return volumeData;
    }
  };
  
  const activeData = getActiveData();
  
  // Find the maximum value to normalize the chart heights
  const maxValue = Math.max(...activeData.map(item => item.value), 1);

  // Check if charts have data before rendering them
  const hasChartData = activeData && activeData.length > 0;
  const showEmptyState = !isLoading && !hasChartData;

  if (isLoading) {
    return (
      <MetricsContainer>
        <MetricsHeader>
          <h3>Trading Metrics</h3>
          <TabGroup>
            <Tab $active={false}>Volume</Tab>
            <Tab $active={false}>Trades</Tab>
            <Tab $active={false}>Participants</Tab>
          </TabGroup>
        </MetricsHeader>
        <SummaryCards>
          {[...Array(3)].map((_, index) => (
            <SummaryCard key={index} style={{ opacity: 0.5 }}>
              <SummaryLabel>Loading...</SummaryLabel>
              <SummaryValue>--</SummaryValue>
            </SummaryCard>
          ))}
        </SummaryCards>
        <ChartContainer>
          <NoData>Loading chart data...</NoData>
        </ChartContainer>
      </MetricsContainer>
    );
  }

  const renderChart = () => {
    if (activeData.length === 0) {
      return <NoData>No data available for this time period</NoData>;
    }

    return (
      <ChartContainer>
        <ChartBars>
          {activeData.map((item, index) => {
            const height = (item.value / maxValue) * 100;
            return (
              <ChartBar 
                key={index}
                $height={height} 
                $isActive={activeIndex === index}
                data-value={activeTab === 'volume' ? `${item.value} SOL` : item.value}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              />
            );
          })}
        </ChartBars>
        <XAxis>
          {activeData.map((item, index) => (
            // Only show every Nth label to avoid overcrowding
            index % Math.ceil(activeData.length / 7) === 0 && (
              <AxisLabel key={index}>{item.date}</AxisLabel>
            )
          ))}
        </XAxis>
      </ChartContainer>
    );
  };

  return (
    <MetricsContainer>
      <MetricsHeader>
        <h3>Trading Metrics</h3>
        <TabGroup>
          <Tab 
            $active={activeTab === 'volume'} 
            onClick={() => setActiveTab('volume')}
            className="volume-tab-button"
            style={{ flex: 0.8 }}
          >
            Volume
          </Tab>
          <Tab 
            $active={activeTab === 'trades'} 
            onClick={() => setActiveTab('trades')}
            style={{ flex: 0.8 }}
          >
            Trades
          </Tab>
          <Tab 
            $active={activeTab === 'participants'} 
            onClick={() => setActiveTab('participants')}
            style={{ flex: 1.4 }}
          >
            Participants
          </Tab>
        </TabGroup>
      </MetricsHeader>

      <SummaryCards>
        <SummaryCard>
          <SummaryLabel>Total Volume</SummaryLabel>
          <SummaryValue>{totalVolume} SOL</SummaryValue>
        </SummaryCard>
        <SummaryCard>
          <SummaryLabel>Total Trades</SummaryLabel>
          <SummaryValue>{totalTrades}</SummaryValue>
        </SummaryCard>
        <SummaryCard>
          <SummaryLabel>Total Participants</SummaryLabel>
          <SummaryValue>{totalParticipants}</SummaryValue>
        </SummaryCard>
      </SummaryCards>

      {showEmptyState ? (
        <ChartContainer>
          <NoData>
            No trading data available yet. Charts will display real-time data as trades are executed.
          </NoData>
        </ChartContainer>
      ) : (
        <ChartContainer>
          {hasChartData ? (
            <>
              <ChartBars>
                {activeData.map((item, index) => (
                  <ChartBar
                    key={index}
                    $height={Math.max(1, (item.value / maxValue) * 100)}
                    $isActive={activeIndex === index}
                    data-value={activeTab === 'volume' ? `${item.value.toFixed(2)} SOL` : item.value}
                    onClick={() => setActiveIndex(index)}
                  />
                ))}
              </ChartBars>
              <XAxis>
                {activeData.map((item, index) => (
                  <AxisLabel key={index} onClick={() => setActiveIndex(index)}>
                    {item.date}
                  </AxisLabel>
                ))}
              </XAxis>
            </>
          ) : (
            <LoadingContainer>
              <div>Loading chart data...</div>
            </LoadingContainer>
          )}
        </ChartContainer>
      )}
    </MetricsContainer>
  );
};

export default TradingMetrics; 