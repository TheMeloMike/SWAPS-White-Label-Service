'use client';

import React, { useState } from 'react';
import styled from 'styled-components';
import { TradeLoop } from '@/types/trade';
import { TradeExecutionModal } from '../trade/TradeExecutionModal';
import { useWallet } from '@solana/wallet-adapter-react';

interface TradePathDisplayProps {
  trade: TradeLoop;
  userWallet?: string;
}

const Container = styled.div`
  background: #1e2021; /* Slightly lighter than webapp background for contrast */
  backdrop-filter: blur(10px);
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  margin: ${({ theme }) => theme.spacing.sm} 0;
  border: 1px solid #282838;
  box-shadow: ${({ theme }) => theme.shadows.sm};
  transition: all ${({ theme }) => theme.transitions.normal};
  
  &:hover {
    box-shadow: ${({ theme }) => theme.shadows.md};
    border-color: #3A3A4A;
    background: #242627;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const Title = styled.h4`
  color: #FFFFFF;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const Badge = styled.span`
  background: #242627; /* Slightly lighter */
  color: #A0A0B0;
  padding: 2px 6px;
  border-radius: ${({ theme }) => theme.borderRadius.xs};
  font-size: ${({ theme }) => theme.typography.fontSize.xxs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  border: 1px solid #282838;
`;

const TradeFlow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: ${({ theme }) => theme.spacing.sm} 0;
  overflow-x: auto;
  padding: ${({ theme }) => theme.spacing.xs} 0;
  
  &::-webkit-scrollbar {
    height: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: #242627;
    border-radius: ${({ theme }) => theme.borderRadius.xs};
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.primary};
    border-radius: ${({ theme }) => theme.borderRadius.xs};
    
    &:hover {
      background: ${({ theme }) => theme.colors.primaryDark};
    }
  }
`;

const TradeStep = styled.div<{ $isUserStep?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding: ${({ theme }) => theme.spacing.xs};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background: ${({ $isUserStep }) => 
    $isUserStep ? '#2A2653' : 'transparent'}; /* Solid purple tint */
  border: 1px solid ${({ $isUserStep }) => 
    $isUserStep ? '#4A3F7A' : 'transparent'};
  transition: all ${({ theme }) => theme.transitions.normal};
`;

const WalletLabel = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xxs};
  color: #B3B3C0; /* Solid color */
  text-align: center;
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const NFTCard = styled.div`
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: ${({ theme }) => theme.borderRadius.xs};
  overflow: hidden;
  background: #242627; /* Match webapp style */
  border: 1px solid #282838;
  transition: all ${({ theme }) => theme.transitions.fast};
  cursor: pointer;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: ${({ theme }) => theme.shadows.sm};
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const NFTImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const NFTName = styled.div`
  font-size: 10px;
  color: #E5E5E5; /* Solid color */
  text-align: center;
  max-width: 60px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Arrow = styled.div`
  color: ${({ theme }) => theme.colors.primary};
  font-size: 14px;
  flex-shrink: 0;
  opacity: 1; /* Full opacity */
  transition: all ${({ theme }) => theme.transitions.normal};
`;

const StatsRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
  padding-top: ${({ theme }) => theme.spacing.sm};
  border-top: 1px solid #282838;
`;

const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const StatLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xxs};
  color: #999999; /* Solid color */
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.wide};
`;

const StatValue = styled.span<{ $type?: 'quality' | 'efficiency' | 'fair' }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme, $type }) => {
    if ($type === 'quality' || $type === 'efficiency') {
      return theme.colors.success;
    }
    return theme.colors.success;
  }};
`;

const ActionSection = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-top: ${({ theme }) => theme.spacing.sm};
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  flex: 1;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.xs};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  border: none;
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.normal};
  
  ${({ theme, $variant }) => $variant === 'primary' ? `
    background: linear-gradient(
      90deg, 
      ${theme.colors.gradientStart}, 
      ${theme.colors.gradientEnd}
    );
    color: white;
    
    &:hover {
      opacity: 0.9;
      box-shadow: 0 2px 8px rgba(123, 97, 255, 0.3);
    }
  ` : `
    background: #242627; /* Match webapp style */
    color: #CCCCCC;
    border: 1px solid #282838;
    
    &:hover {
      background: #2A2C2E;
      color: #FFFFFF;
      border-color: #3A3A4A;
    }
  `}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const YouLabel = styled.div`
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  padding: 1px 4px;
  border-radius: ${({ theme }) => theme.borderRadius.xs};
  font-size: 9px;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  margin-bottom: 2px;
  text-transform: uppercase;
`;

export const TradePathDisplay: React.FC<TradePathDisplayProps> = ({ trade, userWallet }) => {
  const wallet = useWallet();
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const effectiveUserWallet = userWallet || wallet.publicKey?.toString();
  
  // Check if user is part of this trade
  const isUserInTrade = effectiveUserWallet && trade.steps.some(step => step.from === effectiveUserWallet);
  
  // Get a default image for NFTs without images
  const getImageUrl = (nft: any) => {
    return nft?.image || '/images/nft-placeholder.svg';
  };

  const formatWalletAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const qualityScore = Math.round((trade.qualityScore || 0) * 100);
  const efficiency = Math.round((trade.efficiency || 0) * 100);

  return (
    <>
      <Container>
        <Header>
          <Title>
            🔄 Trade Loop
          </Title>
          <Badge>{trade.steps.length} participants</Badge>
        </Header>

        <TradeFlow>
          {trade.steps.map((step, index) => {
            const isUserStep = step.from === effectiveUserWallet;
            const nftGiving = step.nfts[0];

            return (
              <React.Fragment key={index}>
                <TradeStep $isUserStep={isUserStep}>
                  {isUserStep && <YouLabel>YOU</YouLabel>}
                  <WalletLabel>{formatWalletAddress(step.from)}</WalletLabel>
                  <NFTCard>
                    <NFTImage 
                      src={getImageUrl(nftGiving)} 
                      alt={nftGiving?.name || 'NFT'}
                      onError={(e) => {
                        e.currentTarget.src = '/images/nft-placeholder.svg';
                      }}
                    />
                  </NFTCard>
                  <NFTName>{nftGiving?.name || 'Unknown'}</NFTName>
                </TradeStep>
                
                {index < trade.steps.length - 1 && <Arrow>→</Arrow>}
              </React.Fragment>
            );
          })}
        </TradeFlow>

        <StatsRow>
          <StatItem>
            <StatLabel>Quality</StatLabel>
            <StatValue $type="quality">{qualityScore}%</StatValue>
          </StatItem>
          <StatItem>
            <StatLabel>Efficiency</StatLabel>
            <StatValue $type="efficiency">{efficiency}%</StatValue>
          </StatItem>
          {isUserInTrade && (
            <ActionSection>
              <Button 
                $variant="primary"
                onClick={() => setShowExecutionModal(true)}
              >
                Execute
              </Button>
            </ActionSection>
          )}
        </StatsRow>
      </Container>

      {showExecutionModal && effectiveUserWallet && (
        <TradeExecutionModal
          trade={trade}
          userWallet={effectiveUserWallet}
          onClose={() => setShowExecutionModal(false)}
          onExecute={() => {
            console.log('Trade executed successfully');
          }}
        />
      )}
    </>
  );
}; 