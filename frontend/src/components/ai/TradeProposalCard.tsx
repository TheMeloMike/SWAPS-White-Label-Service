'use client';

import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { TradeLoop } from '@/types/trade';
import NFTImage from '@/components/shared/NFTImage';
import { useWallet } from '@solana/wallet-adapter-react';
import { SmartContractService } from '@/services/smart-contract';

interface TradeProposalCardProps {
  trade: TradeLoop;
  onExecute?: () => void;
  onShowMore?: () => void;
}

const shimmer = keyframes`
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
`;

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const Container = styled.div`
  background: linear-gradient(135deg, #1e1e2e 0%, #252535 100%);
  border: 1px solid rgba(123, 97, 255, 0.2);
  border-radius: 12px;
  padding: 12px;
  margin-top: 12px;
  position: relative;
  overflow: hidden;
  animation: ${fadeIn} 0.4s ease-out;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
  max-width: 100%;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, #7b61ff, transparent);
    animation: ${shimmer} 2s infinite;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const Title = styled.h3`
  margin: 0;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const TradeIcon = styled.span`
  font-size: 16px;
`;

const EfficiencyBadge = styled.div`
  background: linear-gradient(135deg, #7b61ff 0%, #5d4abd 100%);
  border-radius: 16px;
  padding: 4px 10px;
  font-size: 12px;
  color: white;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(123, 97, 255, 0.3);
`;

const TradeVisual = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
`;

const NFTSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
`;

const NFTLabel = styled.div`
  font-size: 10px;
  color: #8b8b9e;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
`;

const NFTContainer = styled.div`
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid rgba(123, 97, 255, 0.3);
  background: #1a1a2e;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  
  &:hover {
    transform: scale(1.05);
    border-color: rgba(123, 97, 255, 0.6);
  }
`;

const NFTName = styled.div`
  font-size: 11px;
  color: #ffffff;
  font-weight: 600;
  text-align: center;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const NFTCollection = styled.div`
  font-size: 10px;
  color: #8b8b9e;
  text-align: center;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ArrowContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
`;

const Arrow = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7b61ff 0%, #5d4abd 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: white;
  box-shadow: 0 2px 8px rgba(123, 97, 255, 0.3);
`;

const TradeDirection = styled.div`
  font-size: 9px;
  color: #8b8b9e;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const TradeInfo = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 6px 0;
  font-size: 11px;
  color: #8b8b9e;
`;

const InfoItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const InfoLabel = styled.span`
  color: #8b8b9e;
`;

const InfoValue = styled.span`
  color: #a299ff;
  font-weight: 600;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 8px;
`;

const Button = styled.button<{ $primary?: boolean }>`
  flex: 1;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  
  ${props => props.$primary ? `
    background: linear-gradient(135deg, #7b61ff 0%, #5d4abd 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(123, 97, 255, 0.3);
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(123, 97, 255, 0.4);
    }
    
    &:active {
      transform: translateY(0);
    }
  ` : `
    background: rgba(255, 255, 255, 0.05);
    color: #a299ff;
    border: 1px solid rgba(123, 97, 255, 0.3);
    
    &:hover {
      background: rgba(123, 97, 255, 0.1);
      border-color: rgba(123, 97, 255, 0.5);
    }
  `}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
  margin-right: 6px;
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const ErrorMessage = styled.div`
  color: #ef4444;
  font-size: 11px;
  text-align: center;
  margin-bottom: 12px;
  padding: 6px 10px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
`;

export const TradeProposalCard: React.FC<TradeProposalCardProps> = ({ 
  trade, 
  onExecute,
  onShowMore 
}) => {
  const { publicKey, signTransaction } = useWallet();
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  if (!publicKey || !trade.steps || trade.steps.length === 0) {
    return null;
  }
  
  const userStep = trade.steps.find(step => step.from === publicKey.toString());
  const receivingStep = trade.steps.find(step => step.to === publicKey.toString());
  
  if (!userStep || !receivingStep) {
    return null;
  }
  
  const givingNFT = userStep.nfts[0];
  const receivingNFT = receivingStep.nfts[0];
  const efficiency = Math.round(trade.efficiency * 100);
  
  const handleExecute = async () => {
    if (!signTransaction) {
      setError('Wallet not properly connected');
      return;
    }
    
    setIsExecuting(true);
    setError(null);
    try {
      const smartContractService = SmartContractService.getInstance();
      // Find the trade loop address using the trade ID
      const tradeIdBytes = new TextEncoder().encode(trade.id);
      const [tradeLoopAddress] = smartContractService.findTradeLoopAddress(tradeIdBytes);
      
      // Execute the trade
      await smartContractService.executeFullTradeLoop(tradeLoopAddress, { publicKey, signTransaction } as any);
      if (onExecute) onExecute();
    } catch (error) {
      console.error('Trade execution error:', error);
      setError('Failed to execute trade. Please try again.');
    } finally {
      setIsExecuting(false);
    }
  };
  
  const handleViewDetails = () => {
    if (onShowMore) {
      onShowMore();
    }
  };
  
  return (
    <Container>
      <Header>
        <Title>
          <TradeIcon>🔄</TradeIcon>
          Trade Opportunity
        </Title>
        <EfficiencyBadge>
          {efficiency}% Match
        </EfficiencyBadge>
      </Header>
      
      <TradeVisual>
        <NFTSection>
          <NFTLabel>You Give</NFTLabel>
          <NFTContainer>
            <NFTImage
              address={givingNFT.address}
              name={givingNFT.name}
              image={givingNFT.image}
              collection={givingNFT.collection}
              size={60}
            />
          </NFTContainer>
          <NFTName>{givingNFT.name || 'Unknown NFT'}</NFTName>
          <NFTCollection>
            {typeof givingNFT.collection === 'string' 
              ? givingNFT.collection 
              : givingNFT.collection?.name || 'Unknown Collection'}
          </NFTCollection>
        </NFTSection>
        
        <ArrowContainer>
          <Arrow>→</Arrow>
          <TradeDirection>For</TradeDirection>
        </ArrowContainer>
        
        <NFTSection>
          <NFTLabel>You Receive</NFTLabel>
          <NFTContainer>
            <NFTImage
              address={receivingNFT.address}
              name={receivingNFT.name}
              image={receivingNFT.image}
              collection={receivingNFT.collection}
              size={60}
            />
          </NFTContainer>
          <NFTName>{receivingNFT.name || 'Unknown NFT'}</NFTName>
          <NFTCollection>
            {typeof receivingNFT.collection === 'string' 
              ? receivingNFT.collection 
              : receivingNFT.collection?.name || 'Unknown Collection'}
          </NFTCollection>
        </NFTSection>
      </TradeVisual>
      
      <TradeInfo>
        <InfoItem>
          <InfoLabel>Type:</InfoLabel>
          <InfoValue>
            {trade.totalParticipants === 2 ? 'Direct' : `${trade.totalParticipants}-Way`}
          </InfoValue>
        </InfoItem>
        <InfoItem>
          <InfoLabel>Steps:</InfoLabel>
          <InfoValue>{trade.steps.length}</InfoValue>
        </InfoItem>
        <InfoItem>
          <InfoLabel>Participants:</InfoLabel>
          <InfoValue>{trade.totalParticipants}</InfoValue>
        </InfoItem>
      </TradeInfo>
      
      {error && (
        <ErrorMessage>{error}</ErrorMessage>
      )}
      
      <ActionRow>
        <Button onClick={handleViewDetails}>
          Details
        </Button>
        <Button 
          $primary 
          onClick={handleExecute} 
          disabled={isExecuting}
        >
          {isExecuting && <LoadingSpinner />}
          {isExecuting ? 'Executing...' : 'Execute Trade'}
        </Button>
      </ActionRow>
    </Container>
  );
}; 