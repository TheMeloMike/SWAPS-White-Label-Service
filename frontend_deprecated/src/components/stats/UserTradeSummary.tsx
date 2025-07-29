import React from 'react';
import styled from 'styled-components';
import { useWallet } from '@solana/wallet-adapter-react';

// Types for user stats
interface UserTradeStats {
  totalTradesExecuted: number;
  totalTradesCreated: number;
  totalNFTsTraded: number;
  successRate: number;
  mostTradedCollection?: {
    name: string;
    count: number;
    imageUrl?: string;
  };
  avgTradeCompletionTime?: string;
  totalParticipantsInteracted?: number;
}

interface UserTradeSummaryProps {
  stats: UserTradeStats;
  isLoading?: boolean;
  isConnected?: boolean;
}

// Styled components
const SummaryContainer = styled.div`
  background: #181a1b;
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

const SummaryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: ${({ theme }) => theme.spacing.sm};
  
  h3 {
    font-size: ${({ theme }) => theme.typography.fontSize.lg};
    color: white;
    margin: 0;
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
`;

const StatCard = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => theme.spacing.md};
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  /* Fix for border-radius rendering */
  transform: translateZ(0);
  overflow: visible;
  position: relative;
  margin: 1px;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 5px rgba(103, 69, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.15);
  }
  
  &:before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.1), transparent);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  &:hover:before {
    opacity: 1;
  }
`;

const StatLabel = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: rgba(255, 255, 255, 0.6);
`;

const StatValue = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  color: white;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  transition: all 0.2s ease;
  
  ${StatCard}:hover & {
    background: linear-gradient(
      90deg, 
      ${({ theme }) => theme.colors.gradientStart}, 
      ${({ theme }) => theme.colors.gradientEnd}
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    transform: scale(1.02);
  }
`;

const StatDescription = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: rgba(255, 255, 255, 0.5);
  margin-top: ${({ theme }) => theme.spacing.xs};
`;

const CollectionCard = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.surfaceBorder};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  /* Fix for border-radius rendering */
  transform: translateZ(0);
  overflow: visible;
  position: relative;
  margin: 1px;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 5px rgba(103, 69, 255, 0.08);
    border-color: ${({ theme }) => theme.colors.primary}30;
  }
  
  &:before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(to right, transparent, ${({ theme }) => theme.colors.primary}20, transparent);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  &:hover:before {
    opacity: 1;
  }
`;

const CollectionImage = styled.div`
  width: 48px;
  height: 48px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  overflow: hidden;
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  /* Fix for border-radius rendering */
  transform: translateZ(0);
  position: relative;
  transition: all 0.2s ease;
  
  ${CollectionCard}:hover & {
    transform: scale(1.03) rotate(1deg);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: all 0.2s ease;
    
    ${CollectionCard}:hover & {
      transform: scale(1.03);
    }
  }
`;

const CollectionInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const CollectionTitle = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const CollectionStats = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const NoStatsMessage = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const ConnectPrompt = styled.div`
  padding: ${({ theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  text-align: center;
  
  p {
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    margin: 0;
  }
`;

/**
 * A component to display user-specific trade statistics.
 * Shows zero values when user has no trades rather than an empty state.
 */
const UserTradeSummary: React.FC<UserTradeSummaryProps> = ({ 
  stats, 
  isLoading = false,
  isConnected
}) => {
  const { publicKey } = useWallet();
  const walletConnected = isConnected !== undefined ? isConnected : !!publicKey;
  
  if (!walletConnected) {
    return (
      <SummaryContainer>
        <SummaryHeader>
          <h3>Your Trade Activity</h3>
        </SummaryHeader>
        <ConnectPrompt>
          <p>Connect your wallet to view your trade statistics</p>
        </ConnectPrompt>
      </SummaryContainer>
    );
  }
  
  if (isLoading) {
    return (
      <SummaryContainer>
        <SummaryHeader>
          <h3>Your Trade Activity</h3>
        </SummaryHeader>
        <StatsGrid>
          {[...Array(4)].map((_, index) => (
            <StatCard key={index} style={{ opacity: 0.5 }}>
              <StatLabel>Loading...</StatLabel>
              <StatValue>--</StatValue>
            </StatCard>
          ))}
        </StatsGrid>
      </SummaryContainer>
    );
  }

  const displayShortenedAddress = () => {
    if (!publicKey) return '';
    const address = publicKey.toString();
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // Always render stats even if all values are zero
  return (
    <SummaryContainer>
      <SummaryHeader>
        <h3>Your Trade Activity</h3>
        <div style={{ 
          fontSize: '12px', 
          color: '#a4a4b5', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px' 
        }}>
          <span style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            backgroundColor: '#4ade80', 
            display: 'inline-block' 
          }}></span>
          {displayShortenedAddress()}
        </div>
      </SummaryHeader>

      <StatsGrid>
        <StatCard>
          <StatLabel>Total Trades</StatLabel>
          <StatValue>{stats.totalTradesExecuted}</StatValue>
          <StatDescription>Successful trade executions</StatDescription>
        </StatCard>
        
        <StatCard>
          <StatLabel>Created Trades</StatLabel>
          <StatValue>{stats.totalTradesCreated}</StatValue>
          <StatDescription>Trade loops initiated by you</StatDescription>
        </StatCard>
        
        <StatCard>
          <StatLabel>NFTs Traded</StatLabel>
          <StatValue>{stats.totalNFTsTraded}</StatValue>
          <StatDescription>Total assets exchanged</StatDescription>
        </StatCard>
        
        <StatCard>
          <StatLabel>Success Rate</StatLabel>
          <StatValue>{stats.successRate.toFixed(1)}%</StatValue>
          <StatDescription>Percentage of successful trades</StatDescription>
        </StatCard>
      </StatsGrid>

      {stats.mostTradedCollection && (
        <CollectionCard>
          <CollectionImage>
            {stats.mostTradedCollection.imageUrl && (
              <img 
                src={stats.mostTradedCollection.imageUrl} 
                alt={stats.mostTradedCollection.name} 
                onError={(e) => {
                  e.currentTarget.src = 'https://placehold.co/48x48?text=NFT';
                }}
              />
            )}
          </CollectionImage>
          <CollectionInfo>
            <CollectionTitle>Most Traded Collection</CollectionTitle>
            <CollectionStats>
              {stats.mostTradedCollection.name} - {stats.mostTradedCollection.count} trades
            </CollectionStats>
          </CollectionInfo>
        </CollectionCard>
      )}
    </SummaryContainer>
  );
};

export default UserTradeSummary; 