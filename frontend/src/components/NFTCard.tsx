'use client';

import React, { useState, useEffect, useCallback } from 'react';
import styled, { keyframes, DefaultTheme } from 'styled-components';
import Image from 'next/image';
import { NFTMetadata } from '@/types/nft';
import { fixImageUrl, handleImageError, createDataURIPlaceholder, SVG_PLACEHOLDER_PREFIX, DEFAULT_IMAGE_PLACEHOLDER } from '@/utils/imageUtils';
import { getCollectionName } from '@/utils/nftUtils';
import GlassmorphicCard from './common/GlassmorphicCard';
import NFTTradeModal from './NFTTradeModal';
import RippleButton from './common/RippleButton';

interface NFTCardProps {
  nft: NFTMetadata & { floorPrice?: number };
  onClick?: () => void;
  isSelected?: boolean;
  isWanted?: boolean;
  isPreview?: boolean;
  className?: string;
}

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(103, 69, 255, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(103, 69, 255, 0); }
  100% { box-shadow: 0 0 0 0 rgba(103, 69, 255, 0); }
`;

const shine = keyframes`
  0% { mask-position: -50%; }
  100% { mask-position: 150%; }
`;

const CardWrapper = styled.div<{ $isWanted?: boolean; $isSelected?: boolean }>`
  position: relative;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  transform-style: preserve-3d;
  perspective: 1000px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  will-change: transform, box-shadow;
  
  &:hover {
    transform: translateY(-6px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
  }
  
  ${({ $isWanted, theme }: { $isWanted?: boolean; theme: DefaultTheme }) => $isWanted && `
    &::after {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 24px;
      height: 24px;
      background: ${theme?.colors?.primary || '#6745FF'};
      border-radius: 0 0 0 8px;
      z-index: 2;
    }
  `}
  
  ${({ $isSelected }: { $isSelected?: boolean }) => $isSelected && `
    animation: ${pulse} 2s infinite;
  `}
`;

const StyledCard = styled(GlassmorphicCard)<{ $isWanted?: boolean; $isSelected?: boolean; $highlighted?: boolean }>`
  display: flex;
  flex-direction: column;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(24, 26, 32, 0.9);
  transition: all 0.3s ease;
  overflow: hidden;
  
  ${({ $isSelected, theme }: { $isSelected?: boolean; theme: DefaultTheme }) => $isSelected && `
    border-color: ${theme?.colors?.primary || '#6745FF'};
    background: rgba(103, 69, 255, 0.05);
  `}
  
  ${({ $isWanted, theme }: { $isWanted?: boolean; theme: DefaultTheme }) => $isWanted && `
    border-color: ${theme?.colors?.primary || '#6745FF'}50;
  `}
`;

const ImageContainer = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 8px 8px 0 0;
  background: rgba(13, 13, 16, 0.5);
  
  /* Add explicit min-height to prevent layout shifts */
  min-height: 120px;
`;

const PlaceholderImage = styled.div<{ $bg?: string }>`
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: ${({ $bg }) => $bg || 'rgba(13, 13, 16, 0.9)'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.75rem;
  text-align: center; // For multiline text
  padding: 8px; // Add some padding
  box-sizing: border-box;
`;

const StyledImage = styled(Image)`
  object-fit: cover;
  transition: transform 0.5s ease, opacity 0.3s ease;
  
  ${CardWrapper}:hover & {
    transform: scale(1.05);
  }
`;

const ContentContainer = styled.div`
  padding: 0.75rem;
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const NFTName = styled.h3`
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
  color: ${({ theme }) => theme?.colors?.textPrimary || '#FFFFFF'};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Collection = styled.p`
  font-size: 0.75rem;
  color: ${({ theme }) => theme?.colors?.textSecondary || '#A0A0B0'};
  margin: 0 0 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Badge = styled.div<{ $type: 'wanted' | 'selected' | 'preview' }>`
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 600;
  z-index: 2;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  
  ${({ $type, theme }) => {
    if ($type === 'wanted') {
      return `
        background: rgba(103, 69, 255, 0.2);
        color: ${theme?.colors?.primary || '#6745FF'};
        border: 1px solid ${theme?.colors?.primary || '#6745FF'}50;
      `;
    }
    if ($type === 'selected') {
      return `
        background: rgba(103, 69, 255, 0.15);
        color: ${theme?.colors?.primary || '#6745FF'};
        border: 1px solid ${theme?.colors?.primary || '#6745FF'}40;
      `;
    }
    return `
      background: rgba(255, 255, 255, 0.15);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
    `;
  }}
  
  /* Shine effect */
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.2),
      transparent
    );
    mask: linear-gradient(#fff 0 0);
    mask-composite: exclude;
    mask-size: 200%;
    animation: ${shine} 2s infinite;
  }
`;

const PriceContainer = styled.div`
  display: flex;
  align-items: center;
  margin-top: auto;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
`;

const PriceLabel = styled.span`
  font-size: 0.75rem;
  color: ${({ theme }) => theme?.colors?.textSecondary || '#A0A0B0'};
`;

const PriceValue = styled.span`
  font-size: 0.875rem;
  font-weight: 600;
  color: ${({ theme }) => theme?.colors?.textPrimary || '#FFFFFF'};
  margin-left: auto;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(13, 13, 16, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
`;

const LoadingSpinner = styled.div`
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const NFTCard: React.FC<NFTCardProps> = React.memo(({
  nft,
  onClick,
  isSelected = false,
  isWanted = false,
  isPreview = false,
  className = ''
}) => {
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
  const [showModal, setShowModal] = useState(false);
  
  const displayName = nft?.name || `NFT ${nft?.address?.slice(0, 6) || '...'}...`;
  const collectionName = getCollectionName(nft?.collection, nft?.name);

  // Initialize image loading
  useEffect(() => {
    if (!nft || !nft.address) {
      setImageState({
        src: createDataURIPlaceholder(displayName, 'unknown'),
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
  }, [nft, displayName]);
  
  const price = nft?.floorPrice ? `${nft.floorPrice} SOL` : 'Unknown';

  const handleCardClick = useCallback(() => {
    if (onClick) {
      onClick();
    } else {
      setShowModal(true);
    }
  }, [onClick]);

  const handleModalClose = useCallback(() => {
    setShowModal(false);
  }, []);

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
      displayName,
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
    <>
      <CardWrapper 
        $isWanted={isWanted} 
        $isSelected={isSelected}
        className={className}
      >
        <StyledCard 
          onClick={handleCardClick}
          $isWanted={isWanted}
          $isSelected={isSelected}
          $highlighted={isSelected}
        >
          <ImageContainer>
            <StyledImage
              src={imageState.src}
              alt={displayName}
              fill
              priority={false}
              loading="lazy"
              onLoad={handleImageLoad}
              onError={onImageError}
              data-mint-address={nft?.address} 
              data-collection={collectionName}
              data-attempt-count={imageState.attemptCount}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              unoptimized={process.env.NODE_ENV === 'development'}
              style={{
                opacity: imageState.isLoading ? 0.7 : 1
              }}
            />
            
            {imageState.isLoading && (
              <LoadingOverlay>
                <LoadingSpinner />
              </LoadingOverlay>
            )}
            
            {/* Status badges */}
            {isWanted && <Badge $type="wanted">Wanted</Badge>}
            {isSelected && <Badge $type="selected">Selected</Badge>}
            {isPreview && <Badge $type="preview">Preview</Badge>}
          </ImageContainer>
          
          <ContentContainer>
            <NFTName title={displayName}>{displayName}</NFTName>
            <Collection title={collectionName}>{collectionName}</Collection>
            
            <PriceContainer>
              <PriceLabel>Floor</PriceLabel>
              <PriceValue>{price}</PriceValue>
            </PriceContainer>
          </ContentContainer>
        </StyledCard>
      </CardWrapper>

      {showModal && nft && (
        <NFTTradeModal
          isOpen={showModal}
          onClose={handleModalClose}
          nft={nft}
        />
      )}
    </>
  );
});

// Add a display name for better debugging
NFTCard.displayName = 'NFTCard';

export default NFTCard; 