import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { fixImageUrl, handleImageError, createDataURIPlaceholder } from '@/utils/imageUtils';

const ImageContainer = styled.div<{ $size?: number; $rounded?: boolean }>`
  width: ${props => props.$size || 40}px;
  height: ${props => props.$size || 40}px;
  position: relative;
  border-radius: ${props => props.$rounded ? '50%' : props.theme.borderRadius.sm};
  overflow: hidden;
  background: ${props => props.theme.colors.surface};
`;

const StyledImage = styled.img<{ $isLoading: boolean }>`
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: ${props => props.$isLoading ? 0.6 : 1};
  transition: opacity 0.3s ease;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.1);
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.7em;
`;

interface NFTImageProps {
  address: string;
  name?: string;
  image?: string;
  collection?: string | { address?: string; name?: string };
  size?: number;
  rounded?: boolean;
  className?: string;
  alt?: string;
}

export const NFTImage: React.FC<NFTImageProps> = ({
  address,
  name,
  image,
  collection,
  size = 40,
  rounded = false,
  className,
  alt
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

  // Initialize image source
  useEffect(() => {
    if (!address) {
      setImageState({
        src: createDataURIPlaceholder(name || 'NFT', 'unknown'),
        isLoading: false,
        hasError: true,
        attemptCount: 0
      });
      return;
    }
    
    // Always start with the proxy URL for best reliability
    const directProxyUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/nfts/image-proxy/${address}`;
    
    setImageState({
      src: directProxyUrl,
      isLoading: true,
      hasError: false,
      attemptCount: 0
    });
  }, [address, name]);

  // Handle successful load
  const handleImageLoad = () => {
    setImageState(prev => ({
      ...prev,
      isLoading: false,
      hasError: false
    }));
  };

  // Handle image error with retry logic
  const onImageError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!address) return;
    
    const newAttemptCount = imageState.attemptCount + 1;
    
    // Try different sources based on attempt count
    if (newAttemptCount === 1 && image) {
      // First retry: try the original URL from metadata
      setImageState({
        src: image,
        isLoading: true,
        hasError: false,
        attemptCount: newAttemptCount
      });
      return;
    } else if (newAttemptCount === 2) {
      // Second retry: try proxy with cache-busting params
      const refreshUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/nfts/image-proxy/${address}?refresh=true&t=${Date.now()}`;
      setImageState({
        src: refreshUrl,
        isLoading: true,
        hasError: false,
        attemptCount: newAttemptCount
      });
      return;
    }
    
    // After all retries, use the error handler for final placeholder
    handleImageError(
      event, 
      imageState.src, 
      name || `NFT ${address.slice(0, 6)}...`, 
      address
    );
    
    // Update our state with the placeholder
    setImageState({
      src: event.currentTarget.src,
      isLoading: false,
      hasError: true,
      attemptCount: newAttemptCount
    });
  };

  // Get collection address for data attribute
  const getCollectionAddress = () => {
    if (typeof collection === 'string') return collection;
    if (typeof collection === 'object' && collection?.address) return collection.address;
    return '';
  };

  return (
    <ImageContainer $size={size} $rounded={rounded} className={className}>
      <StyledImage
        src={imageState.src}
        alt={alt || name || 'NFT'}
        onLoad={handleImageLoad}
        onError={onImageError}
        $isLoading={imageState.isLoading}
        data-mint-address={address}
        data-collection={getCollectionAddress()}
        data-attempt-count={imageState.attemptCount}
      />
      {imageState.isLoading && (
        <LoadingOverlay>
          <span>...</span>
        </LoadingOverlay>
      )}
    </ImageContainer>
  );
};

export default NFTImage; 