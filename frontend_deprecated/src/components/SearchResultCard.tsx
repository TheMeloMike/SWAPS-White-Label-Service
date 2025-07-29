'use client';

import React from 'react';
import styled from 'styled-components';
import { NFTMetadata } from '@/types/nft';
import { fixImageUrl, handleImageError, createDataURIPlaceholder } from '@/utils/imageUtils';
import { getCollectionName } from '@/utils/nftUtils';

const ResultContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0.75rem auto;
  max-width: 800px;
  width: 100%;
  background: rgba(255, 255, 255, 0.03);
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  box-shadow: ${({ theme }) => theme.shadows.md};
  padding: ${({ theme }) => theme.spacing.sm};
  transition: all 0.3s ease;
 
  &:hover {
    border-color: rgba(255, 255, 255, 0.2);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  @media (min-width: 768px) {
    flex-direction: row;
    padding: ${({ theme }) => theme.spacing.md};
  }
`;

const ImageWrapper = styled.div`
  width: 100%;
  max-width: 260px;
  aspect-ratio: 1/1;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  position: relative;
  background: rgba(255, 255, 255, 0.05);
  
  @media (max-width: 768px) {
    max-width: 200px;
    margin-bottom: ${({ theme }) => theme.spacing.sm};
  }
`;

const Image = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform ${({ theme }) => theme.transitions.normal};
  
  &:hover {
    transform: scale(1.05);
  }
`;

const DetailsContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing.sm};
  gap: ${({ theme }) => theme.spacing.sm};
  
  @media (min-width: 768px) {
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  }
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const Title = styled.h2`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: white;
  margin: 0;
`;

const Collection = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
`;

const Address = styled.div`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.05);
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  width: fit-content;
  margin-top: ${({ theme }) => theme.spacing.xs};
`;

const Description = styled.p`
  color: rgba(255, 255, 255, 0.7);
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  line-height: 1.4;
  margin: 0;
  max-height: 4.2em;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
`;

const ActionContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
  padding-top: ${({ theme }) => theme.spacing.sm};
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: ${({ theme }) => theme.spacing.sm};
`;

const TradeButton = styled.button`
  background: linear-gradient(
    90deg, 
    ${({ theme }) => theme.colors.gradientStart}, 
    ${({ theme }) => theme.colors.gradientEnd}
  );
  color: white;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  padding: 0.5rem 1.25rem;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all 0.25s ease;
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  position: relative;
  overflow: hidden;
  
  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.2),
      transparent
    );
    transition: left 0.7s ease;
  }
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(103, 69, 255, 0.3);
    
    &:before {
      left: 100%;
    }
  }
  
  &:active {
    transform: translateY(1px);
  }
  
  &:disabled {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.4);
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }
`;

const AttributesSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const AttributesTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
`;

const AttributesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.xs};
`;

const AttributeBadge = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => theme.spacing.xs};
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const AttributeType = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 ${({ theme }) => theme.spacing.xs} 0;
  text-transform: uppercase;
`;

const AttributeValue = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: white;
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  margin: 0;
`;

// Function to handle image errors
const handleImageErrorCustom = (e: React.SyntheticEvent<HTMLImageElement>, collection?: string) => {
  // We can use our global error handler, but we'll add some specific attributes
  const img = e.currentTarget;
  if (!img.hasAttribute('data-collection') && collection) {
    img.setAttribute('data-collection', collection);
  }
  handleImageError(e);
};

export interface SearchResultCardProps {
  nft: NFTMetadata;
  onFindTrades: () => void;
  disabled?: boolean;
}

const SearchResultCard: React.FC<SearchResultCardProps> = ({ 
  nft, 
  onFindTrades,
  disabled = false
}) => {
  // Process the image URL with improved handling
  const collectionName = getCollectionName(nft.collection, nft.name);
  const imageUrl = nft.image ? fixImageUrl(nft.image, nft.address) : null;
  
  return (
    <ResultContainer>
      <ImageWrapper>
        {imageUrl ? (
          <Image 
            src={imageUrl} 
            alt={nft.name}
            onError={(e) => handleImageErrorCustom(e, collectionName)}
            data-mint-address={nft.address}
            data-collection={collectionName}
            loading="lazy"
          />
        ) : (
          <Image 
            src={createDataURIPlaceholder(nft.name || (collectionName ? `${collectionName} NFT` : 'NFT'))}
            alt={`${nft.name} (No Image)`}
            data-mint-address={nft.address}
            data-collection={collectionName}
          />
        )}
      </ImageWrapper>
      
      <DetailsContainer>
        <Header>
          <Title>{nft.name}</Title>
          {nft.collection && (
            <Collection>
              {getCollectionName(nft.collection, nft.name)}
            </Collection>
          )}
          <Address>{nft.address}</Address>
        </Header>
        
        {nft.description && <Description>{nft.description}</Description>}
        
        {nft.attributes && nft.attributes.length > 0 && (
          <AttributesSection>
            <AttributesTitle>Attributes</AttributesTitle>
            <AttributesGrid>
              {nft.attributes.slice(0, 4).map((attr, index) => (
                <AttributeBadge key={`${attr.trait_type}-${index}`}>
                  <AttributeType>{attr.trait_type}</AttributeType>
                  <AttributeValue>{attr.value}</AttributeValue>
                </AttributeBadge>
              ))}
            </AttributesGrid>
          </AttributesSection>
        )}
        
        {onFindTrades && (
          <ActionContainer>
            <TradeButton 
              onClick={onFindTrades}
              disabled={disabled}
            >
              Find Potential Trades
            </TradeButton>
          </ActionContainer>
        )}
      </DetailsContainer>
    </ResultContainer>
  );
};

export default SearchResultCard; 