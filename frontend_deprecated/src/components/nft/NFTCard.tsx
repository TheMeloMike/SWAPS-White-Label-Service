'use client';

import React from 'react';
import styled from 'styled-components';
import { NFTMetadata } from '@/services/nft';
import { fixImageUrl, handleImageError } from '@/utils/imageUtils';

const Card = styled.div`
  background-color: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Image = styled.img`
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: ${({ theme }) => theme.spacing.sm};
`;

const Title = styled.h3`
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  margin: 0;
`;

const Collection = styled.div`
  color: ${({ theme }) => theme.colors.primary};
  font-weight: bold;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  margin: 0;
`;

const Symbol = styled.p`
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
`;

const Address = styled.p`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-size: 0.875rem;
  margin: 0;
  word-break: break-all;
`;

interface NFTCardProps {
  nft: NFTMetadata;
}

export const NFTCard: React.FC<NFTCardProps> = ({ nft }) => {
  // Pass both the image URL and NFT address to fixImageUrl to use the proxy
  const imageUrl = fixImageUrl(nft.image, nft.address);
  
  // Extract collection name and item number from NFT name (assumes format "Collection Name #123")
  const parts = nft.name?.split('#') || [];
  const collectionName = parts[0]?.trim() || '';
  const itemNumber = parts.length > 1 ? `#${parts[1]}` : '';

  return (
    <Card>
      {imageUrl && (
        <Image 
          src={imageUrl} 
          alt={nft.name} 
          onError={handleImageError}
          data-mint-address={nft.address} // Add mint address for better error handling
          loading="lazy" // Add lazy loading for performance
        />
      )}
      {collectionName && <Collection>{collectionName}</Collection>}
      <Title>{itemNumber ? itemNumber : nft.name}</Title>
      {nft.symbol && collectionName !== nft.symbol && <Symbol>{nft.symbol}</Symbol>}
      <Address>{nft.address}</Address>
    </Card>
  );
}; 