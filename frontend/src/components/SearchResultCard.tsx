'use client';

import React, { useState, useEffect } from 'react';
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
  transition: transform ${({ theme }) => theme.transitions.normal}, opacity 0.3s ease;
  
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

// Enhanced NFT image component with retry logic
const NFTImageWithRetry = ({ nft }: { nft: NFTMetadata }) => {
  const [imageState, setImageState] = useState<{
    src: string;
    isLoading: boolean;
    hasError: boolean;
    attemptCount: number;
  }>({
    src: '',
    isLoading: true,
    hasError: false,
    attemptCount: 0
  });

  const collectionName = getCollectionName(nft.collection, nft.name);

  // Initialize image loading
  useEffect(() => {
    if (!nft || !nft.address) {
      setImageState({
        src: createDataURIPlaceholder(nft?.name || 'NFT', 'unknown'),
        isLoading: false,
        hasError: true,
        attemptCount: 0
      });
      return;
    }
    
    // Start with direct proxy URL for best reliability
    const directProxyUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/nfts/image-proxy/${nft.address}`;
    setImageState({
      src: directProxyUrl,
      isLoading: true,
      hasError: false,
      attemptCount: 0
    });
  }, [nft]);

  // Handle load success
  const handleImageLoad = () => {
    setImageState(prev => ({
      ...prev,
      isLoading: false
    }));
  };

  // Handle load error with retry logic
  const onImageError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!nft?.address) return;
    
    // Get current attempt count
    const newAttemptCount = imageState.attemptCount + 1;
    
    // Try different approaches based on attempt number
    if (newAttemptCount === 1 && nft?.image) {
      // First retry: try the original URL from metadata
      setImageState({
        src: nft.image,
        isLoading: true,
        hasError: false,
        attemptCount: newAttemptCount
      });
      return;
    } else if (newAttemptCount === 2) {
      // Second retry: try proxy with refresh parameter
      const refreshUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/nfts/image-proxy/${nft.address}?refresh=true&t=${Date.now()}`;
      setImageState({
        src: refreshUrl,
        isLoading: true,
        hasError: false,
        attemptCount: newAttemptCount
      });
      return;
    }
    
    // If all retries failed, use placeholder
    handleImageError(
      event,
      imageState.src,
      nft?.name || `NFT ${nft.address.slice(0,8)}`,
      nft.address
    );
    
    // Update state with the placeholder
    setImageState({
      src: event.currentTarget.src,
      isLoading: false,
      hasError: true,
      attemptCount: newAttemptCount
    });
  };

  return (
    <Image 
      src={imageState.src}
      alt={nft?.name || 'NFT'}
      onLoad={handleImageLoad}
      onError={onImageError}
      data-mint-address={nft?.address}
      data-collection={collectionName}
      style={{
        opacity: imageState.isLoading ? 0.6 : 1,
        transition: 'opacity 0.3s ease'
      }}
    />
  );
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
  // Get collection name for display purposes
  const collectionName = getCollectionName(nft.collection, nft.name);
  
  return (
    <ResultContainer>
      <ImageWrapper>
        <NFTImageWithRetry nft={nft} />
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