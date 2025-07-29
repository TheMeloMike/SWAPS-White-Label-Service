'use client';

import React from 'react';
import styled from 'styled-components';
import CleanTradeAssistant from '@/components/ai/CleanTradeAssistant';
import { fadeInAnimation } from '@/styles/animations';

const PageContainer = styled.div`
  min-height: 100vh;
  padding: ${({ theme }) => theme.spacing.xl};
  ${fadeInAnimation}
  position: relative;
  
  /* Add opaque background layer */
  &::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #181a1b;
    z-index: -1;
  }
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  position: relative;
  z-index: 1;
`;

const Title = styled.h1`
  color: #FFFFFF;
  font-size: ${({ theme }) => theme.typography.fontSize['3xl']};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const Subtitle = styled.p`
  color: #A0A0B0;
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  max-width: 800px;
  margin: 0 auto;
  line-height: 1.6;
`;

const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
  position: relative;
  z-index: 1;
`;

const FeatureCard = styled.div`
  background: #1e2021; /* Slightly lighter than main background */
  border: 1px solid #282838;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.lg};
  text-align: center;
`;

const FeatureIcon = styled.div`
  font-size: 40px;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const FeatureTitle = styled.h3`
  color: #FFFFFF;
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

const FeatureDescription = styled.p`
  color: #A0A0B0;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  margin: 0;
`;

const AssistantContainer = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
`;

export default function AIAssistantPage() {
  const features = [
    {
      icon: '🔍',
      title: 'Smart Path Discovery',
      description: 'Finds hidden multi-party trade routes invisible to the naked eye',
    },
    {
      icon: '🎯',
      title: 'Goal-Oriented Trading',
      description: 'Tell it what NFT you want, and it finds the optimal path',
    },
    {
      icon: '📊',
      title: 'SWAPS Ecosystem Analysis',
      description: 'Real-time analysis of trade viability and market conditions',
    },
    {
      icon: '💡',
      title: 'Intelligent Recommendations',
      description: 'Suggests trades based on your portfolio and market trends',
    },
  ];

  return (
    <PageContainer>
      <Header>
        <Title>
          <span style={{ fontSize: '48px' }}>🤖</span>
          AI Trade Assistant
        </Title>
        <Subtitle>
          Your intelligent companion for discovering complex NFT trade paths. 
          The AI analyzes the entire SWAPS network to find multi-party trade 
          routes that get you closer to your desired NFTs.
        </Subtitle>
      </Header>

      <FeatureGrid>
        {features.map((feature, index) => (
          <FeatureCard key={index}>
            <FeatureIcon>{feature.icon}</FeatureIcon>
            <FeatureTitle>{feature.title}</FeatureTitle>
            <FeatureDescription>{feature.description}</FeatureDescription>
          </FeatureCard>
        ))}
      </FeatureGrid>

      <AssistantContainer>
        <CleanTradeAssistant />
      </AssistantContainer>
    </PageContainer>
  );
} 