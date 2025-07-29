'use client';

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { NFTMetadata } from '@/services/nft';
import { fixImageUrl, handleImageError, clearImageCaches, SVG_PLACEHOLDER_PREFIX, DEFAULT_IMAGE_PLACEHOLDER } from '@/utils/imageUtils';

const Card = styled.div`
  background-color: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const ImageContainer = styled.div`
  width: 100%;
  height: 200px;
  position: relative;
  border-radius: ${({ theme }) => theme.spacing.sm};
  overflow: hidden;
  background-color: rgba(0, 0, 0, 0.1);
`;

const Image = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: ${({ theme }) => theme.spacing.sm};
  transition: opacity 0.3s ease;
`;

const ImagePlaceholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textSecondary};
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

// Helper function to determine if a src is a placeholder
const isPlaceholder = (src: string): boolean => {
  return src.startsWith(SVG_PLACEHOLDER_PREFIX) || 
         src.endsWith(DEFAULT_IMAGE_PLACEHOLDER);
}

export const NFTCard: React.FC<NFTCardProps> = ({ nft }) => {
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
  
  // Effect to handle image URL preparation
  useEffect(() => {
    if (!nft || !nft.address) {
      setImageState({
        src: DEFAULT_IMAGE_PLACEHOLDER,
        isLoading: false,
        hasError: true,
        attemptCount: 0
      });
      return;
    }
    
    // Get direct Solana address-based image URL
    const directProxyUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/nfts/image-proxy/${nft.address}`;
    
    // Always start with the direct proxy URL for reliability
    setImageState({
      src: directProxyUrl,
      isLoading: true,
      hasError: false,
      attemptCount: 0
    });
  }, [nft?.address]);
  
  // Handle image load success
  const handleImageLoad = () => {
    setImageState(prev => ({
      ...prev,
      isLoading: false
    }));
  };
  
  // Handle image load error with retry logic
  const handleImageLoadError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // Get the current attempt count
    const newAttemptCount = imageState.attemptCount + 1;
    
    // Try different sources based on attempt count
    if (newAttemptCount === 1) {
      // Try the original image URL from metadata on first failure
      if (nft?.image) {
        setImageState({
          src: nft.image,
          isLoading: true,
          hasError: false,
          attemptCount: newAttemptCount
        });
        return;
      }
    } else if (newAttemptCount === 2) {
      // Try URL with cache-busting parameter
      const proxyUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/nfts/image-proxy/${nft.address}?refresh=true&t=${Date.now()}`;
      setImageState({
        src: proxyUrl,
        isLoading: true,
        hasError: false,
        attemptCount: newAttemptCount
      });
      return;
    }
    
    // After all retries, use the utility's error handler
    handleImageError(e, imageState.src, nft?.name, nft?.address);
    
    // Update state to show placeholder
    setImageState({
      src: e.currentTarget.src, // This will be the placeholder set by handleImageError
      isLoading: false,
      hasError: true,
      attemptCount: newAttemptCount
    });
  };

  // Extract collection name and item number from NFT name (assumes format "Collection Name #123")
  const parts = nft?.name?.split('#') || [];
  const collectionName = parts[0]?.trim() || '';
  const itemNumber = parts.length > 1 ? `#${parts[1]}` : '';

  return (
    <Card>
      <ImageContainer>
        {imageState.isLoading && (
          <ImagePlaceholder>Loading...</ImagePlaceholder>
        )}
        <Image 
          src={imageState.src} 
          alt={nft?.name || 'NFT'} 
          onLoad={handleImageLoad}
          onError={handleImageLoadError}
          data-mint-address={nft?.address} // Add mint address for better error handling
          data-collection={collectionName} // Add collection info for improved proxy handling
          data-attempt-count={imageState.attemptCount} // Track attempts for debugging
          loading="lazy" // Add lazy loading for performance
          style={{ opacity: imageState.isLoading ? 0 : 1 }} // Fade in when loaded
        />
      </ImageContainer>
      {collectionName && <Collection>{collectionName}</Collection>}
      <Title>{itemNumber ? itemNumber : nft?.name}</Title>
      {nft?.symbol && collectionName !== nft?.symbol && <Symbol>{nft.symbol}</Symbol>}
      <Address>{nft?.address}</Address>
    </Card>
  );
}; 