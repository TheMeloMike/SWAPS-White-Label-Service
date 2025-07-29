import React from 'react';
import styled from 'styled-components';
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { TradeMetrics } from '../../lib/trade-discovery/types';

interface MetricsPanelProps {
  metrics: TradeMetrics;
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  return (
    <MetricsContainer>
      <MetricsHeader>Trade Metrics</MetricsHeader>
      
      <MetricsGrid>
        <MetricCard>
          <MetricTitle>Value Metrics</MetricTitle>
          <MetricChart data={metrics.valueMetrics.history} />
          <MetricStats>
            <Stat>
              <StatLabel>Total Value</StatLabel>
              <StatValue>{formatSOL(metrics.valueMetrics.totalValue)}</StatValue>
            </Stat>
            <Stat>
              <StatLabel>Value Growth</StatLabel>
              <StatValue>{formatPercentage(metrics.valueMetrics.valueGrowth)}</StatValue>
            </Stat>
          </MetricStats>
        </MetricCard>

        <MetricCard>
          <MetricTitle>Market Metrics</MetricTitle>
          <MetricChart data={metrics.marketMetrics.history} />
          <MetricStats>
            <Stat>
              <StatLabel>Liquidity</StatLabel>
              <StatValue>{formatPercentage(metrics.marketMetrics.averageLiquidity)}</StatValue>
            </Stat>
            <Stat>
              <StatLabel>Volume</StatLabel>
              <StatValue>{formatSOL(metrics.marketMetrics.tradeVolume)}</StatValue>
            </Stat>
          </MetricStats>
        </MetricCard>

        <MetricCard>
          <MetricTitle>Risk Analysis</MetricTitle>
          <RiskGauge value={metrics.riskMetrics.overallRisk} />
          <MetricStats>
            <Stat>
              <StatLabel>Counterparty Risk</StatLabel>
              <StatValue>{formatRisk(metrics.riskMetrics.counterpartyRisk)}</StatValue>
            </Stat>
            <Stat>
              <StatLabel>Market Risk</StatLabel>
              <StatValue>{formatRisk(metrics.riskMetrics.marketRisk)}</StatValue>
            </Stat>
          </MetricStats>
        </MetricCard>
      </MetricsGrid>
    </MetricsContainer>
  );
}

const MetricsContainer = styled.div`
  background: #2a2a2a;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
`;

// ... other styled components 