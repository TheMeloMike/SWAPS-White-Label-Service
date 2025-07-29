'use client';

import React from 'react';
import styled from 'styled-components';
import { Button } from '../common/Button';

const Card = styled.div`
  background-color: ${({ theme }) => theme.colors.background};
  border: 2px solid ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  margin: ${({ theme }) => theme.spacing.md} 0;
  transition: all 0.2s ease-in-out;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const TradeDetails = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const NFTInfo = styled.div`
  flex: 1;
`;

const Title = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const Address = styled.p`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

interface TradeOpportunityProps {
  targetNFT: {
    name: string;
    address: string;
    image?: string;
  };
  availableNFTs: Array<{
    name: string;
    address: string;
    image?: string;
  }>;
  onExecuteTrade: () => void;
}

export const TradeOpportunity: React.FC<TradeOpportunityProps> = ({
  targetNFT,
  availableNFTs,
  onExecuteTrade,
}) => {
  return (
    <Card>
      <TradeDetails>
        <NFTInfo>
          <Title>Available Trade Found!</Title>
          <Address>Target NFT: {targetNFT.address}</Address>
        </NFTInfo>
      </TradeDetails>
      <div>
        <p>You can trade one of these NFTs:</p>
        {availableNFTs.map((nft) => (
          <Address key={nft.address}>{nft.name} ({nft.address})</Address>
        ))}
      </div>
      <Button onClick={onExecuteTrade}>Execute Trade</Button>
    </Card>
  );
}; 