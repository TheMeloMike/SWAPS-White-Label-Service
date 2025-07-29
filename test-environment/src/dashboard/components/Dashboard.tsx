import React from 'react';
import styled from 'styled-components';
import { TradePathGraph } from './TradePathGraph';
import { MetricsPanel } from './MetricsPanel';
import { TradeHistory } from './TradeHistory';
import { StatusBar } from './StatusBar';
import { useTradeData } from '../hooks/useTradeData';

export function Dashboard() {
  const { 
    tradePaths, 
    metrics, 
    history, 
    status 
  } = useTradeData();

  return (
    <DashboardContainer>
      <Header>
        <Title>SWAPS Trade Discovery Dashboard</Title>
        <StatusBar status={status} />
      </Header>
      
      <MainContent>
        <LeftPanel>
          <TradePathGraph paths={tradePaths} />
          <MetricsPanel metrics={metrics} />
        </LeftPanel>
        
        <RightPanel>
          <TradeHistory history={history} />
        </RightPanel>
      </MainContent>
    </DashboardContainer>
  );
}

const DashboardContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1a1a1a;
  color: #ffffff;
`;

// ... other styled components 