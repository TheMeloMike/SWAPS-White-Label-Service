'use client';

import React, { useState } from 'react';
import styled from 'styled-components';
import { TradeLoop } from '@/types/trade';
import { NFTMetadata } from '@/types/nft';
import { useWallet } from '@solana/wallet-adapter-react';
import { TradeService } from '@/services/trade';
import { SmartContractService } from '@/services/smart-contract';

interface TradeExecutionModalProps {
  trade: TradeLoop;
  userWallet: string;
  onClose: () => void;
  onExecute: () => void;
}

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease-out;
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const ModalContent = styled.div`
  background: #1a1a1a;
  border-radius: 16px;
  padding: 32px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
  animation: slideUp 0.3s ease-out;
  
  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const Title = styled.h2`
  font-size: 24px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: #666;
  font-size: 24px;
  cursor: pointer;
  transition: color 0.2s;
  
  &:hover {
    color: #ffffff;
  }
`;

const TradeDetails = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 24px;
  align-items: center;
  margin-bottom: 32px;
`;

const NFTCard = styled.div`
  background: #262626;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
`;

const NFTImage = styled.img`
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 12px;
`;

const NFTName = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 4px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const NFTCollection = styled.p`
  font-size: 14px;
  color: #999;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Label = styled.div`
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
`;

const ArrowIcon = styled.div`
  font-size: 32px;
  color: #00d4ff;
`;

const InfoSection = styled.div`
  background: #262626;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  
  &:not(:last-child) {
    border-bottom: 1px solid #333;
  }
`;

const InfoLabel = styled.span`
  color: #999;
  font-size: 14px;
`;

const InfoValue = styled.span`
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 16px;
  justify-content: flex-end;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  
  ${props => props.variant === 'primary' ? `
    background: #00d4ff;
    color: #000;
    
    &:hover {
      background: #00a8cc;
      transform: translateY(-1px);
    }
    
    &:disabled {
      background: #333;
      color: #666;
      cursor: not-allowed;
      transform: none;
    }
  ` : `
    background: #333;
    color: #ffffff;
    
    &:hover {
      background: #444;
    }
  `}
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #000;
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 0.8s linear infinite;
  margin-right: 8px;
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const ErrorMessage = styled.div`
  background: #ff3333;
  color: #ffffff;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
`;

export const TradeExecutionModal: React.FC<TradeExecutionModalProps> = ({
  trade,
  userWallet,
  onClose,
  onExecute
}) => {
  const wallet = useWallet();
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Find user's position in the trade
  const userStep = trade.steps.find(step => step.from === userWallet);
  const userStepIndex = trade.steps.findIndex(step => step.from === userWallet);
  const nextStep = trade.steps[(userStepIndex + 1) % trade.steps.length];
  
  if (!userStep || !nextStep) {
    return null;
  }
  
  // Get the NFTs involved in the user's trade
  const nftGiving = userStep.nfts[0]; // User gives this
  const nftReceiving = nextStep.nfts[0]; // User receives this
  
  const handleExecute = async () => {
    if (!wallet.publicKey) {
      setError('Please connect your wallet to execute the trade');
      return;
    }
    
    setIsExecuting(true);
    setError(null);
    
    try {
      const smartContractService = SmartContractService.getInstance();
      
      // First, we need to find or create the trade loop address
      // In a real implementation, this would be stored with the trade data
      const tradeIdBytes = new Uint8Array(32);
      const encoder = new TextEncoder();
      const encoded = encoder.encode(trade.id);
      tradeIdBytes.set(encoded.slice(0, 32));
      
      const [tradeLoopAddress] = smartContractService.findTradeLoopAddress(tradeIdBytes);
      
      // Execute the trade on-chain
      const signature = await smartContractService.executeFullTradeLoop(
        tradeLoopAddress,
        wallet
      );
      
      if (signature) {
        // Update local state
        // Store the executed trade in session storage
        const executedTrades = JSON.parse(sessionStorage.getItem('executed_trades') || '[]');
        executedTrades.push({ 
          tradeId: trade.id, 
          executedAt: Date.now(),
          signature 
        });
        sessionStorage.setItem('executed_trades', JSON.stringify(executedTrades));
        onExecute();
        onClose();
      } else {
        setError('Failed to execute trade');
      }
    } catch (err) {
      console.error('Trade execution error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsExecuting(false);
    }
  };
  
  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Confirm Trade</Title>
          <CloseButton onClick={onClose}>×</CloseButton>
        </Header>
        
        {error && <ErrorMessage>{error}</ErrorMessage>}
        
        <TradeDetails>
          <NFTCard>
            <Label>You Give</Label>
            <NFTImage 
              src={nftGiving.image || '/images/nft-placeholder.png'} 
              alt={nftGiving.name}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/nft-placeholder.png';
              }}
            />
            <NFTName>{nftGiving.name || 'Unnamed NFT'}</NFTName>
            <NFTCollection>
              {typeof nftGiving.collection === 'string' 
                ? nftGiving.collection 
                : nftGiving.collection?.name || 'Unknown Collection'}
            </NFTCollection>
          </NFTCard>
          
          <ArrowIcon>→</ArrowIcon>
          
          <NFTCard>
            <Label>You Receive</Label>
            <NFTImage 
              src={nftReceiving.image || '/images/nft-placeholder.png'} 
              alt={nftReceiving.name}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/nft-placeholder.png';
              }}
            />
            <NFTName>{nftReceiving.name || 'Unnamed NFT'}</NFTName>
            <NFTCollection>
              {typeof nftReceiving.collection === 'string' 
                ? nftReceiving.collection 
                : nftReceiving.collection?.name || 'Unknown Collection'}
            </NFTCollection>
          </NFTCard>
        </TradeDetails>
        
        <InfoSection>
          <InfoRow>
            <InfoLabel>Trade Type</InfoLabel>
            <InfoValue>{trade.steps.length}-Way Trade</InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Total Participants</InfoLabel>
            <InfoValue>{trade.totalParticipants}</InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Trade Efficiency</InfoLabel>
            <InfoValue>{(trade.efficiency * 100).toFixed(0)}%</InfoValue>
          </InfoRow>
          <InfoRow>
            <InfoLabel>Quality Score</InfoLabel>
            <InfoValue>{((trade.qualityScore || 0) * 100).toFixed(0)}%</InfoValue>
          </InfoRow>
        </InfoSection>
        
        <ButtonGroup>
          <Button variant="secondary" onClick={onClose} disabled={isExecuting}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleExecute} 
            disabled={isExecuting || !wallet.publicKey}
          >
            {isExecuting && <LoadingSpinner />}
            {isExecuting ? 'Executing...' : 'Execute Trade'}
          </Button>
        </ButtonGroup>
      </ModalContent>
    </ModalOverlay>
  );
}; 