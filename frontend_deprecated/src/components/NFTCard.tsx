'use client';

import React from 'react';
import styled from 'styled-components';
import { NFTMetadata } from '@/types/nft';
import { fixImageUrl, handleImageError, createDataURIPlaceholder } from '@/utils/imageUtils';
import { getCollectionName } from '@/utils/nftUtils';

const Card = styled.div<{ $isSelected?: boolean }>`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme, $isSelected }) => 
    $isSelected ? theme.colors.primary : theme.colors.surfaceBorder};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  overflow: hidden;
  transition: all ${({ theme }) => theme.transitions.normal};
  cursor: pointer;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: ${({ theme }) => theme.shadows.sm};
    border-color: ${({ theme }) => theme.colors.primary};
  }
  
  ${({ $isSelected, theme }) => $isSelected && `
    box-shadow: ${theme.shadows.md};
    transform: translateY(-2px);
  `}
`;

const ImageContainer = styled.div`
  position: relative;
  width: 100%;
  padding-bottom: 75%; /* Reduce aspect ratio height */
  overflow: hidden;
  background: ${({ theme }) => theme.colors.backgroundSecondary};
`;

const Image = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform ${({ theme }) => theme.transitions.normal};
  
  ${Card}:hover & {
    transform: scale(1.05);
  }
`;

const Info = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
`;

const Name = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Collection = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const Address = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  overflow: hidden;
  text-overflow: ellipsis;
`;

export interface NFTCardProps {
  nft: NFTMetadata;
  onClick?: () => void;
  isSelected?: boolean;
}

export const NFTCard: React.FC<NFTCardProps> = ({ 
  nft,
  onClick,
  isSelected = false
}) => {
  // Use improved image handling with mint address
  // First check if image exists, otherwise provide placeholder
  const collectionName = getCollectionName(nft.collection, nft.name);
  const imageUrl = nft.image ? fixImageUrl(nft.image, nft.address) : createDataURIPlaceholder(nft.name || collectionName);
  
  // Format address to be shorter
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <Card onClick={onClick} $isSelected={isSelected}>
      <ImageContainer>
        <Image 
          src={imageUrl} 
          alt={nft.name} 
          onError={handleImageError}
          data-mint-address={nft.address}
          data-collection={collectionName}
          loading="lazy"
        />
      </ImageContainer>
      <Info>
        <Name>{nft.name}</Name>
        {collectionName && <Collection>{collectionName}</Collection>}
        <Address title={nft.address}>{formatAddress(nft.address)}</Address>
      </Info>
    </Card>
  );
}; 