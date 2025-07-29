'use client';

import React, { useState } from 'react';
import styled from 'styled-components';
import { fadeInAnimation, cardHover } from '@/styles/animations';
import AnimatedNumber from '@/components/shared/AnimatedNumber';

const Container = styled.div`
  ${fadeInAnimation}
`;

const SearchSection = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

const SearchInput = styled.input`
  padding: ${({ theme }) => theme.spacing.md};
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
  
  &::placeholder {
    color: ${({ theme }) => theme.colors.textMuted};
  }
`;

const CompareButton = styled.button`
  padding: ${({ theme }) => `${theme.spacing.md} ${theme.spacing.xl}`};
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${({ theme }) => theme.colors.primaryDark};
  }
`;

const ComparisonGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const CollectionCard = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  ${cardHover}
`;

const CollectionHeader = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const CollectionImage = styled.img`
  width: 80px;
  height: 80px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  object-fit: cover;
`;

const CollectionInfo = styled.div`
  flex: 1;
`;

const CollectionName = styled.h3`
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0 0 ${({ theme }) => theme.spacing.xs} 0;
`;

const CollectionStats = styled.div`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const MetricRow = styled.div<{ $winner?: boolean }>`
  display: flex;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.sm};
  margin: ${({ theme }) => `${theme.spacing.xs} -${theme.spacing.sm}`};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background: ${({ $winner }) => $winner ? 'rgba(109, 102, 214, 0.1)' : 'transparent'};
  border: 1px solid ${({ $winner, theme }) => $winner ? theme.colors.primary + '40' : 'transparent'};
`;

const MetricLabel = styled.span`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const MetricValue = styled.span`
  color: ${({ theme }) => theme.colors.textPrimary};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
`;

const CollectionComparison: React.FC = () => {
  const [collection1, setCollection1] = useState('');
  const [collection2, setCollection2] = useState('');
  const [comparisonData, setComparisonData] = useState<any>(null);

  const handleCompare = () => {
    // Mock comparison data
    setComparisonData({
      collection1: {
        name: 'DeGods',
        image: '/api/placeholder/80/80',
        supply: 10000,
        holders: 4521,
        floorPrice: 345.2,
        volume24h: 1234.5,
        marketCap: 3452000,
        uniqueTraits: 158,
      },
      collection2: {
        name: 'y00ts',
        image: '/api/placeholder/80/80',
        supply: 15000,
        holders: 6234,
        floorPrice: 289.8,
        volume24h: 2345.6,
        marketCap: 4347000,
        uniqueTraits: 201,
      },
    });
  };

  const getWinner = (metric: string) => {
    if (!comparisonData) return null;
    const val1 = comparisonData.collection1[metric];
    const val2 = comparisonData.collection2[metric];
    
    // Higher is better for these metrics
    if (['volume24h', 'marketCap', 'holders', 'uniqueTraits'].includes(metric)) {
      return val1 > val2 ? 1 : val2 > val1 ? 2 : 0;
    }
    // Lower is better for floor price
    if (metric === 'floorPrice') {
      return val1 < val2 ? 1 : val2 < val1 ? 2 : 0;
    }
    return 0;
  };

  return (
    <Container>
      <SearchSection>
        <SearchInput
          placeholder="Enter first collection..."
          value={collection1}
          onChange={(e) => setCollection1(e.target.value)}
        />
        <SearchInput
          placeholder="Enter second collection..."
          value={collection2}
          onChange={(e) => setCollection2(e.target.value)}
        />
        <CompareButton onClick={handleCompare}>
          Compare
        </CompareButton>
      </SearchSection>

      {comparisonData && (
        <ComparisonGrid>
          <CollectionCard>
            <CollectionHeader>
              <CollectionImage src={comparisonData.collection1.image} alt={comparisonData.collection1.name} />
              <CollectionInfo>
                <CollectionName>{comparisonData.collection1.name}</CollectionName>
                <CollectionStats>
                  Supply: {comparisonData.collection1.supply.toLocaleString()}
                </CollectionStats>
              </CollectionInfo>
            </CollectionHeader>

            <MetricRow $winner={getWinner('floorPrice') === 1}>
              <MetricLabel>Floor Price</MetricLabel>
              <MetricValue>
                ◎<AnimatedNumber value={comparisonData.collection1.floorPrice} decimals={2} />
              </MetricValue>
            </MetricRow>

            <MetricRow $winner={getWinner('volume24h') === 1}>
              <MetricLabel>24h Volume</MetricLabel>
              <MetricValue>
                ◎<AnimatedNumber value={comparisonData.collection1.volume24h} decimals={1} />
              </MetricValue>
            </MetricRow>

            <MetricRow $winner={getWinner('holders') === 1}>
              <MetricLabel>Holders</MetricLabel>
              <MetricValue>
                <AnimatedNumber value={comparisonData.collection1.holders} />
              </MetricValue>
            </MetricRow>

            <MetricRow $winner={getWinner('marketCap') === 1}>
              <MetricLabel>Market Cap</MetricLabel>
              <MetricValue>
                ◎<AnimatedNumber value={comparisonData.collection1.marketCap} />
              </MetricValue>
            </MetricRow>

            <MetricRow $winner={getWinner('uniqueTraits') === 1}>
              <MetricLabel>Unique Traits</MetricLabel>
              <MetricValue>
                <AnimatedNumber value={comparisonData.collection1.uniqueTraits} />
              </MetricValue>
            </MetricRow>
          </CollectionCard>

          <CollectionCard>
            <CollectionHeader>
              <CollectionImage src={comparisonData.collection2.image} alt={comparisonData.collection2.name} />
              <CollectionInfo>
                <CollectionName>{comparisonData.collection2.name}</CollectionName>
                <CollectionStats>
                  Supply: {comparisonData.collection2.supply.toLocaleString()}
                </CollectionStats>
              </CollectionInfo>
            </CollectionHeader>

            <MetricRow $winner={getWinner('floorPrice') === 2}>
              <MetricLabel>Floor Price</MetricLabel>
              <MetricValue>
                ◎<AnimatedNumber value={comparisonData.collection2.floorPrice} decimals={2} />
              </MetricValue>
            </MetricRow>

            <MetricRow $winner={getWinner('volume24h') === 2}>
              <MetricLabel>24h Volume</MetricLabel>
              <MetricValue>
                ◎<AnimatedNumber value={comparisonData.collection2.volume24h} decimals={1} />
              </MetricValue>
            </MetricRow>

            <MetricRow $winner={getWinner('holders') === 2}>
              <MetricLabel>Holders</MetricLabel>
              <MetricValue>
                <AnimatedNumber value={comparisonData.collection2.holders} />
              </MetricValue>
            </MetricRow>

            <MetricRow $winner={getWinner('marketCap') === 2}>
              <MetricLabel>Market Cap</MetricLabel>
              <MetricValue>
                ◎<AnimatedNumber value={comparisonData.collection2.marketCap} />
              </MetricValue>
            </MetricRow>

            <MetricRow $winner={getWinner('uniqueTraits') === 2}>
              <MetricLabel>Unique Traits</MetricLabel>
              <MetricValue>
                <AnimatedNumber value={comparisonData.collection2.uniqueTraits} />
              </MetricValue>
            </MetricRow>
          </CollectionCard>
        </ComparisonGrid>
      )}
    </Container>
  );
};

export default CollectionComparison; 