'use client';

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useWallet } from '@solana/wallet-adapter-react';
import StatCard from '@/components/shared/StatCard';
import { fadeInAnimation, cardHover } from '@/styles/animations';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const Container = styled.div`
  ${fadeInAnimation}
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const ChartContainer = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  border: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  ${cardHover}
`;

const ChartTitle = styled.h3`
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
`;

const TradeHistoryTable = styled.table`
  width: 100%;
  background: rgba(255, 255, 255, 0.03);
  border-radius: ${({ theme }) => theme.borderRadius.md};
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const TableHeader = styled.thead`
  background: rgba(255, 255, 255, 0.05);
  
  th {
    padding: ${({ theme }) => theme.spacing.md};
    text-align: left;
    color: ${({ theme }) => theme.colors.textSecondary};
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  }
`;

const TableBody = styled.tbody`
  tr {
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    transition: background 0.2s ease;
    
    &:hover {
      background: rgba(255, 255, 255, 0.02);
    }
  }
  
  td {
    padding: ${({ theme }) => theme.spacing.md};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

const StatusBadge = styled.span<{ $status: 'completed' | 'pending' | 'failed' }>`
  padding: 4px 12px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  background: ${({ $status, theme }) => {
    switch ($status) {
      case 'completed': return theme.colors.success + '20';
      case 'pending': return theme.colors.warning + '20';
      case 'failed': return theme.colors.error + '20';
    }
  }};
  color: ${({ $status, theme }) => {
    switch ($status) {
      case 'completed': return theme.colors.success;
      case 'pending': return theme.colors.warning;
      case 'failed': return theme.colors.error;
    }
  }};
`;

interface TradeAnalyticsProps {
  timeRange?: '24h' | '7d' | '30d' | 'all';
}

const TradeAnalytics: React.FC<TradeAnalyticsProps> = ({ timeRange = '7d' }) => {
  const { publicKey } = useWallet();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTrades: 0,
    successfulTrades: 0,
    totalVolume: 0,
    uniquePartners: 0,
    avgTradeValue: 0,
    successRate: 0,
  });

  // Mock data - in real app, fetch from backend
  const mockTradeHistory = [
    {
      id: '1',
      date: new Date(),
      partners: 3,
      value: 125.5,
      status: 'completed' as const,
      collection: 'DeGods',
    },
    {
      id: '2',
      date: new Date(Date.now() - 86400000),
      partners: 2,
      value: 89.2,
      status: 'completed' as const,
      collection: 'Okay Bears',
    },
    {
      id: '3',
      date: new Date(Date.now() - 172800000),
      partners: 4,
      value: 234.8,
      status: 'pending' as const,
      collection: 'Mad Lads',
    },
  ];

  const chartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Trade Volume (SOL)',
        data: [65, 89, 80, 101, 156, 145, 140],
        borderColor: 'rgb(109, 102, 214)',
        backgroundColor: 'rgba(109, 102, 214, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const collectionData = {
    labels: ['DeGods', 'Okay Bears', 'Mad Lads', 'Claynosaurz', 'Others'],
    datasets: [
      {
        data: [30, 25, 20, 15, 10],
        backgroundColor: [
          'rgba(109, 102, 214, 0.8)',
          'rgba(157, 141, 247, 0.8)',
          'rgba(184, 174, 255, 0.8)',
          'rgba(124, 115, 230, 0.8)',
          'rgba(90, 84, 164, 0.8)',
        ],
        borderWidth: 0,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: 'rgba(255, 255, 255, 0.8)',
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.6)',
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.6)',
        },
      },
    },
  };

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setStats({
        totalTrades: 47,
        successfulTrades: 42,
        totalVolume: 1234.5,
        uniquePartners: 23,
        avgTradeValue: 26.3,
        successRate: 89.4,
      });
      setLoading(false);
    }, 1000);
  }, [publicKey, timeRange]);

  if (!publicKey) {
    return (
      <Container>
        <ChartContainer>
          <ChartTitle>Connect wallet to view analytics</ChartTitle>
        </ChartContainer>
      </Container>
    );
  }

  return (
    <Container>
      <StatsGrid>
        <StatCard
          icon="📈"
          label="Total Trades"
          value={stats.totalTrades}
          change={12.5}
        />
        <StatCard
          icon="✅"
          label="Success Rate"
          value={stats.successRate}
          suffix="%"
          decimals={1}
          glowing
        />
        <StatCard
          icon="💎"
          label="Total Volume"
          value={stats.totalVolume}
          prefix="◎"
          decimals={2}
          change={8.3}
        />
        <StatCard
          icon="🤝"
          label="Trade Partners"
          value={stats.uniquePartners}
        />
      </StatsGrid>

      <ChartContainer>
        <ChartTitle>Trade Volume Over Time</ChartTitle>
        <div style={{ height: '300px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </ChartContainer>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <ChartContainer>
          <ChartTitle>Top Collections Traded</ChartTitle>
          <div style={{ height: '300px' }}>
            <Doughnut data={collectionData} options={{
              ...chartOptions,
              plugins: {
                legend: {
                  position: 'bottom' as const,
                  labels: {
                    color: 'rgba(255, 255, 255, 0.8)',
                    padding: 20,
                  },
                },
              },
            }} />
          </div>
        </ChartContainer>

        <ChartContainer>
          <ChartTitle>Recent Trade History</ChartTitle>
          <TradeHistoryTable>
            <TableHeader>
              <tr>
                <th>Date</th>
                <th>Collection</th>
                <th>Value</th>
                <th>Status</th>
              </tr>
            </TableHeader>
            <TableBody>
              {mockTradeHistory.map(trade => (
                <tr key={trade.id}>
                  <td>{trade.date.toLocaleDateString()}</td>
                  <td>{trade.collection}</td>
                  <td>◎{trade.value.toFixed(2)}</td>
                  <td>
                    <StatusBadge $status={trade.status}>
                      {trade.status}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </TableBody>
          </TradeHistoryTable>
        </ChartContainer>
      </div>
    </Container>
  );
};

export default TradeAnalytics; 