'use client';

import React, { useState } from 'react';
import styled from 'styled-components';
import { TradeLoop } from '@/types/trade';
import { TradeExecutionModal } from './TradeExecutionModal';
import { useWallet } from '@solana/wallet-adapter-react';

interface TradeLoopComponentProps {
  trade: TradeLoop;
  onClose?: () => void;
}

const TradeContainer = styled.div`
  background: #1a1a1a;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 16px;
  border: 1px solid #333;
  animation: fadeIn 0.3s ease-out;
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const Title = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
`;

const Badge = styled.span<{ type: 'efficiency' | 'quality' | 'participants' }>`
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  background: ${props => {
    switch (props.type) {
      case 'efficiency': return '#00d4ff22';
      case 'quality': return '#00ff8822';
      case 'participants': return '#ff00ff22';
      default: return '#ffffff22';
    }
  }};
  color: ${props => {
    switch (props.type) {
      case 'efficiency': return '#00d4ff';
      case 'quality': return '#00ff88';
      case 'participants': return '#ff00ff';
      default: return '#ffffff';
    }
  }};
`;

const StepsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  overflow-x: auto;
  padding: 16px 0;
  
  &::-webkit-scrollbar {
    height: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: #333;
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #666;
    border-radius: 3px;
  }
`;

const Step = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 120px;
`;

const WalletAddress = styled.div`
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
  font-family: monospace;
`;

const NFTCard = styled.div`
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #333;
  background: #262626;
`;

const NFTImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const NFTName = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4px;
  background: rgba(0, 0, 0, 0.8);
  color: #ffffff;
  font-size: 10px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Arrow = styled.div`
  color: #00d4ff;
  font-size: 24px;
  margin: 0 8px;
`;

const MetricsRow = styled.div`
  display: flex;
  gap: 16px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #333;
`;

const Metric = styled.div`
  flex: 1;
  text-align: center;
`;

const MetricLabel = styled.div`
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
`;

const MetricValue = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
`;

const ActionButton = styled.button`
  background: #00d4ff;
  color: #000;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 16px;
  width: 100%;
  
  &:hover {
    background: #00a8cc;
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

export const TradeLoopComponent: React.FC<TradeLoopComponentProps> = ({ trade, onClose }) => {
  const { publicKey } = useWallet();
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  
  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };
  
  const handleTradeExecuted = () => {
    // Refresh trade data or notify parent component
    if (onClose) {
      onClose();
    }
  };
  
  // Check if the current user is part of this trade
  const isUserInTrade = publicKey && trade.steps.some(step => step.from === publicKey.toString());
  
  // Calculate total value from NFT floor prices
  const totalValue = trade.steps.reduce((sum, step) => {
    return sum + step.nfts.reduce((nftSum, nft) => nftSum + (nft.floorPrice || 0), 0);
  }, 0);
  
  return (
    <>
      <TradeContainer>
        <Header>
          <Title>{trade.steps.length}-Way Trade Loop</Title>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Badge type="efficiency">{Math.round(trade.efficiency * 100)}% Efficiency</Badge>
            <Badge type="quality">{Math.round((trade.qualityScore || 0) * 100)}% Quality</Badge>
            <Badge type="participants">{trade.totalParticipants} Traders</Badge>
          </div>
        </Header>
        
        <StepsContainer>
          {trade.steps.map((step, index) => (
            <React.Fragment key={index}>
              <Step>
                <WalletAddress>{formatAddress(step.from)}</WalletAddress>
                {step.nfts.map((nft, nftIndex) => (
                  <NFTCard key={nftIndex}>
                    <NFTImage
                      src={nft.image || '/images/nft-placeholder.png'}
                      alt={nft.name || 'NFT'}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/images/nft-placeholder.png';
                      }}
                    />
                    <NFTName>{nft.name || 'Unnamed NFT'}</NFTName>
                  </NFTCard>
                ))}
              </Step>
              {index < trade.steps.length - 1 && <Arrow>→</Arrow>}
            </React.Fragment>
          ))}
          {/* Show the loop completion */}
          <Arrow>→</Arrow>
          <Step>
            <WalletAddress>{formatAddress(trade.steps[0].from)}</WalletAddress>
            <NFTCard style={{ border: '2px solid #00d4ff' }}>
              <div style={{ 
                width: '100%', 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#00d4ff',
                fontSize: '12px',
                textAlign: 'center',
                padding: '8px'
              }}>
                Receives from last trader
              </div>
            </NFTCard>
          </Step>
        </StepsContainer>
        
        <MetricsRow>
          <Metric>
            <MetricLabel>Total Value</MetricLabel>
            <MetricValue>~{totalValue.toFixed(2)} SOL</MetricValue>
          </Metric>
          <Metric>
            <MetricLabel>Avg NFT Value</MetricLabel>
            <MetricValue>~{(totalValue / trade.steps.length).toFixed(2)} SOL</MetricValue>
          </Metric>
          <Metric>
            <MetricLabel>Created</MetricLabel>
            <MetricValue>{trade.createdAt ? new Date(trade.createdAt).toLocaleDateString() : 'Unknown'}</MetricValue>
          </Metric>
        </MetricsRow>
        
        {isUserInTrade && (
          <ActionButton onClick={() => setShowExecutionModal(true)}>
            View & Execute Trade
          </ActionButton>
        )}
      </TradeContainer>
      
      {showExecutionModal && publicKey && (
        <TradeExecutionModal
          trade={trade}
          userWallet={publicKey.toString()}
          onClose={() => setShowExecutionModal(false)}
          onExecute={handleTradeExecuted}
        />
      )}
    </>
  );
}; 