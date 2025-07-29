import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import styled, { createGlobalStyle } from 'styled-components';
import { NFTMetadata } from '@/types/nft';
import { TrendingWantedNft, TrendingLoopItem } from '@/types/trending';
import { fixImageUrl, handleImageError, createDataURIPlaceholder, SVG_PLACEHOLDER_PREFIX, DEFAULT_IMAGE_PLACEHOLDER } from '@/utils/imageUtils';
import { getCollectionName } from '@/utils/nftUtils';
import { useWallet } from '@solana/wallet-adapter-react';
import { TradeService } from '@/services/trade';
import { NFTService } from '@/services/nft';
import { v4 as uuidv4 } from 'uuid';

// Global style to force Roboto Mono font throughout the modal
const NFTDetailModalFontStyle = createGlobalStyle`
  .nft-detail-modal-container,
  .nft-detail-modal-container * {
    font-family: 'Roboto Mono', monospace !important;
  }
`;

// Custom event to communicate with the main page component
export const PENDING_SEARCH_EVENT = 'add-pending-search';
export interface PendingSearchEvent {
  id: string;
  searchedNFT: NFTMetadata;
  initiatedAt: Date;
}

// Custom event to notify the parent component to refresh trending data
export const REFRESH_TRENDING_EVENT = 'refresh-trending-data';
export interface RefreshTrendingEvent {
  nftAddress: string;
  newWantCount: number;
}

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  padding: 20px;
  height: 100vh;
  width: 100vw;
`;

const ModalContent = styled.div`
  background: #181a1b;
  border-radius: 12px;
  padding: 1.5rem;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  animation: slideUp 0.3s ease;
  position: relative;
  z-index: 10000;
  
  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 22px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  
  &:hover {
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

const ModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  
  @media (min-width: 768px) {
    flex-direction: row;
  }
`;

const ImageSection = styled.div`
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
  
  @media (min-width: 768px) {
    width: 40%;
    margin: 0;
  }
`;

const ImageWrapper = styled.div`
  width: 100%;
  aspect-ratio: 1/1;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  position: relative;
  background: rgba(255, 255, 255, 0.05);
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

const InfoSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const CollectionName = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
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
`;

const AttributesSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const AttributesTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: white;
  margin: 0;
`;

const AttributesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: ${({ theme }) => theme.spacing.sm};
`;

const AttributeBadge = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s ease;
  
  &:hover {
    border-color: ${({ theme }) => theme.colors.primary}50;
    transform: translateY(-2px);
  }
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

const StatsSection = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
`;

const StatItem = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  min-width: 120px;
`;

const StatLabel = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 4px 0;
`;

const StatValue = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  color: white;
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  margin: 0;
`;

const ActionButton = styled.button`
  background: linear-gradient(
    90deg, 
    ${({ theme }) => theme.colors.gradientStart}, 
    ${({ theme }) => theme.colors.gradientEnd}
  );
  color: white;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  padding: 0.75rem 1.5rem;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all 0.25s ease;
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  width: 100%;
  margin-top: 1rem;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(103, 69, 255, 0.25);
  }
  
  &:active {
    transform: translateY(1px);
  }
  
  &:disabled {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.4);
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const SuccessMessage = styled.div`
  background: rgba(35, 197, 98, 0.1);
  color: #23c562;
  padding: 0.75rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  margin-top: 1rem;
  text-align: center;
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
`;

const ErrorMessage = styled.div`
  background: rgba(255, 69, 58, 0.1);
  color: #ff453a;
  padding: 0.75rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  margin-top: 1rem;
  text-align: center;
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 16px;
  height: 16px;
  margin-right: 8px;
  
  &:after {
    content: " ";
    display: block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid #fff;
    border-color: #fff transparent #fff transparent;
    animation: spinner 1.2s linear infinite;
  }
  
  @keyframes spinner {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const TypeBadge = styled.span<{ $type: 'NFT' | 'Collection' }>`
  background: ${({ $type }) => $type === 'NFT' ? 'rgba(103, 69, 255, 0.2)' : 'rgba(255, 184, 0, 0.2)'};
  color: ${({ $type }) => $type === 'NFT' ? '#6745ff' : '#ffb800'};
  padding: 4px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: 12px;
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  margin-left: 8px;
`;

// Add explicit styles for image placeholder
const ImagePlaceholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #303050;
  color: white;
  padding: 1rem;
  text-align: center;
  
  p {
    margin: 0.5rem 0;
    overflow-wrap: break-word;
    word-break: break-all;
  }
  
  .nft-id {
    font-family: ${({ theme }) => theme.typography.fontFamily.mono};
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.7);
    margin-top: 0.5rem;
  }
`;

export type NFTDetailItem = TrendingWantedNft | TrendingLoopItem;

interface NFTDetailModalProps {
  isOpen: boolean;
  item: NFTDetailItem | null;
  onClose: () => void;
}

// Create minimal metadata if fetch fails
const createMinimalNFTMetadata = (address: string, name: string): NFTMetadata => {
  return {
    address: address,
    name: name,
    owner: '',
    // Add required fields with empty/default values
    symbol: '',
    image: '',
    collection: '',
    attributes: []
  };
};

// Handle adding to wants
const handleAddToWants = async (
  nftAddress: string, 
  walletAddress: string,
  name: string, 
  setAddingToWants: React.Dispatch<React.SetStateAction<boolean>>,
  setSuccessMessage: React.Dispatch<React.SetStateAction<string | null>>,
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>,
  metadataToUse?: NFTMetadata | null,
  onSuccess?: () => void
) => {
  if (!walletAddress) {
    setErrorMessage('Please connect your wallet first');
    return;
  }
  
  setAddingToWants(true);
  setSuccessMessage(null);
  setErrorMessage(null);
  
  try {
    const tradeService = TradeService.getInstance();
    const success = await tradeService.addMultipleWants([nftAddress], walletAddress);
    
    if (success) {
      let finalMetadata: NFTMetadata;
      
      if (metadataToUse) {
        finalMetadata = metadataToUse;
      } else {
        try {
          const nftService = NFTService.getInstance();
          finalMetadata = await nftService.getNFTMetadata(nftAddress);
        } catch (error) {
          console.error('Error fetching NFT metadata for want:', error);
          finalMetadata = createMinimalNFTMetadata(nftAddress, name);
        }
      }
      
      const pendingSearchData: PendingSearchEvent = {
        id: uuidv4(),
        searchedNFT: finalMetadata,
        initiatedAt: new Date()
      };
      
      const event = new CustomEvent(PENDING_SEARCH_EVENT, { 
        detail: pendingSearchData,
        bubbles: true 
      });
      document.dispatchEvent(event);
      
      setSuccessMessage(`Successfully added ${name} to your wants list! Now searching for trades...`);
      
      try {
        await tradeService.findTradeLoops(finalMetadata, walletAddress);
      } catch (error) {
        console.error('Initial trade search error (non-blocking):', error);
      }
      
      if (onSuccess) {
        onSuccess();
      }
    } else {
      setErrorMessage('Failed to add to wants list. Please try again.');
    }
  } catch (error) {
    console.error('Error adding to wants:', error);
    setErrorMessage('An error occurred while adding to wants');
  } finally {
    setAddingToWants(false);
  }
};

const NFTDetailModal: React.FC<NFTDetailModalProps> = ({ isOpen, item, onClose }) => {
  const { publicKey, connected } = useWallet();
  const [addingToWants, setAddingToWants] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localWantCount, setLocalWantCount] = useState<number | null>(null);
  const hasAddedToWants = useRef(false);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [enhancedMetadata, setEnhancedMetadata] = useState<NFTMetadata | null>(null);

  // State for image specific to this modal instance
  const [currentImageSrc, setCurrentImageSrc] = useState<string>('');
  const [isImageActuallyLoading, setIsImageActuallyLoading] = useState(true);

  // Derive properties using type guards
  const getItemProperties = () => {
    if (!item) return {
        isNftType: false, itemAddress: '', itemName: 'Item', itemImageUrl: '', 
        initialMetadata: null, itemTypeDisplay: 'Unknown', itemDescription: '', 
        itemWantCount: 0, itemAppearanceInLoops:0, itemAverageLoopScore: null
    };
    const isRealNftType = 'wantCount' in item; // This is our type guard
    const itemAddress = isRealNftType ? item.nftAddress : item.itemId;
    const itemName = isRealNftType ? (item.metadata?.name || `NFT ${itemAddress.slice(0,8)}`) : (item.displayName || 'Unknown Item');
    const itemImageUrl = isRealNftType ? item.metadata?.image : item.imageUrl;
    const initialMetadata = isRealNftType ? item.metadata : (item.itemType === 'NFT' && item.nftMetadata && item.nftMetadata.length > 0 ? item.nftMetadata[0] : null);
    const itemTypeDisplay = isRealNftType ? 'NFT' : (item.itemType || 'Unknown');
    
    let determinedDescription = '';
    if (isRealNftType) {
        determinedDescription = item.metadata?.description || '';
    } else { // It's a TrendingLoopItem
        if (item.itemType === 'NFT' && item.nftMetadata && item.nftMetadata.length > 0) {
            determinedDescription = item.nftMetadata[0]?.description || '';
        } 
        // No specific description field for TrendingLoopItem if it's a collection type or NFT metadata is missing description
    }

    const itemWantCount = isRealNftType ? item.wantCount : 0;
    const itemAppearanceInLoops = isRealNftType ? 0 : item.appearanceInLoops;
    const itemAverageLoopScore = isRealNftType ? null : item.averageLoopScore;

    return {
        isNftType: isRealNftType, itemAddress, itemName, itemImageUrl, initialMetadata, 
        itemTypeDisplay, itemDescription: determinedDescription, itemWantCount, itemAppearanceInLoops, itemAverageLoopScore
    };
  };

  const { 
    isNftType, itemAddress, itemName, itemImageUrl, initialMetadata, 
    itemTypeDisplay, itemDescription, itemWantCount, itemAppearanceInLoops, itemAverageLoopScore 
  } = getItemProperties();

  useEffect(() => {
    if (isOpen && itemAddress) {
      // Start with a placeholder while loading to prevent flicker
      setCurrentImageSrc(createDataURIPlaceholder(itemName, itemAddress));
      setIsImageActuallyLoading(true);
      setSuccessMessage(null);
      setErrorMessage(null);
      setLocalWantCount(null);
      hasAddedToWants.current = false;
      setAddingToWants(false);
    } else if (!isOpen) {
      setCurrentImageSrc('');
    }
  }, [isOpen, itemAddress, itemName]);

  useEffect(() => {
    if (!isOpen || !itemAddress) {
      setEnhancedMetadata(null);
      setLoadingMetadata(false);
      return;
    }

    if (!initialMetadata || !initialMetadata.image) {
      setLoadingMetadata(true);
      setEnhancedMetadata(null);
      const fetchMetadata = async () => {
        try {
          const nftService = NFTService.getInstance();
          const metadata = await nftService.getNFTMetadata(itemAddress);
          if (isOpen) setEnhancedMetadata(metadata); // Check if still open
        } catch (error) {
          console.error(`Error fetching enhanced metadata for ${itemAddress}:`, error);
          if (isOpen) setEnhancedMetadata(null);
        } finally {
          if (isOpen) setLoadingMetadata(false);
        }
      };
      fetchMetadata();
    } else {
      setEnhancedMetadata(initialMetadata);
      setLoadingMetadata(false);
    }
  }, [isOpen, itemAddress, initialMetadata]);

  useEffect(() => {
    if (!isOpen || !itemAddress) {
      setCurrentImageSrc('');
      return;
    }

    // Start loading immediately
    setIsImageActuallyLoading(true);
    
    // First try the direct proxy approach - this is the most reliable
    const proxyUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/nfts/image-proxy/${itemAddress}`;
    
    // Set state for loading UI
    setCurrentImageSrc(proxyUrl);
    
    // Load the image in the background
    const img = new window.Image();
    let isActive = true; // Track if the effect is still active
    
    img.onload = () => {
      if (isActive) {
        setCurrentImageSrc(proxyUrl);
        setIsImageActuallyLoading(false);
      }
    };
    
    img.onerror = () => {
      if (!isActive) return;
      
      // If proxy fails, try the original URL from metadata if available
      const finalMeta = enhancedMetadata || initialMetadata;
      const originalImageUrl = finalMeta?.image || itemImageUrl;
      
      if (originalImageUrl) {
        const secondImg = new window.Image();
        secondImg.onload = () => {
          if (isActive) {
            setCurrentImageSrc(originalImageUrl);
            setIsImageActuallyLoading(false);
          }
        };
        
        secondImg.onerror = () => {
          if (!isActive) return;
          
          // As last resort, try a forced refresh through the proxy
          const refreshUrl = `${proxyUrl}?refresh=true&t=${Date.now()}`;
          const thirdImg = new window.Image();
          
          thirdImg.onload = () => {
            if (isActive) {
              setCurrentImageSrc(refreshUrl);
              setIsImageActuallyLoading(false);
            }
          };
          
          thirdImg.onerror = () => {
            if (isActive) {
              // Finally fall back to placeholder
              setCurrentImageSrc(createDataURIPlaceholder(itemName || itemName, itemAddress));
              setIsImageActuallyLoading(false);
            }
          };
          
          thirdImg.src = refreshUrl;
        };
        
        secondImg.src = originalImageUrl;
      } else {
        // No original URL to try, go to placeholder
        setCurrentImageSrc(createDataURIPlaceholder(itemName || itemName, itemAddress));
        setIsImageActuallyLoading(false);
      }
    };
    
    img.src = proxyUrl;
    
    // Cleanup function
    return () => {
      isActive = false;
    };
  }, [isOpen, itemAddress, itemName, itemImageUrl, enhancedMetadata, initialMetadata]);

  // Enhanced image error handler
  const onImageErrorHandler = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // Use the proper error handler from imageUtils
    handleImageError(
      event, 
      event.currentTarget.src,  // Original source that failed
      itemName || itemName,  // Name for the placeholder
      itemAddress  // Mint address for cache and proxy
    );
    
    // Update our local state to match what handleImageError did
    setCurrentImageSrc(event.currentTarget.src);
    setIsImageActuallyLoading(false);
  };

  const updateLocalWantCount = (original: number, increment: boolean = true) => {
    setLocalWantCount(prev => {
      const currentCount = prev !== null ? prev : original;
      const newCount = increment ? Math.max(currentCount, original) + 1 : Math.max(currentCount, original);
      return newCount;
    });
  };

  if (!isOpen || !item) return null;

  const finalDisplayMetadata = enhancedMetadata || initialMetadata;
  const nameForDisplay = finalDisplayMetadata?.name || itemName;
  const collectionForDisplay = finalDisplayMetadata?.collection ? 
    getCollectionName(finalDisplayMetadata.collection, finalDisplayMetadata.name, finalDisplayMetadata.symbol) :
    (itemTypeDisplay === 'Collection' ? nameForDisplay : null);
  const descriptionForDisplay = itemDescription;
  const attributesForDisplay = finalDisplayMetadata?.attributes;

  const basePopularityValue = isNftType ? itemWantCount : itemAppearanceInLoops;
  const popularityDisplay = localWantCount !== null ? localWantCount : basePopularityValue;
  const scoreDisplay = !isNftType && itemAverageLoopScore ? 
    (itemAverageLoopScore < 1 ? Math.round(itemAverageLoopScore * 100) : Math.round(itemAverageLoopScore)) : null;

  const onEffectiveAddToWants = () => {
    if (!connected || !publicKey || !itemAddress) {
      setErrorMessage('Please connect your wallet first or ensure item is valid.');
      return;
    }
    if (hasAddedToWants.current) {
      setSuccessMessage(`You've already added ${nameForDisplay} to your wants list`);
      return;
    }
    handleAddToWants(
      itemAddress, 
      publicKey.toString(), 
      nameForDisplay, 
      setAddingToWants, 
      setSuccessMessage, 
      setErrorMessage,
      finalDisplayMetadata, 
      () => {
        hasAddedToWants.current = true;
        if (isNftType) {
          updateLocalWantCount(basePopularityValue, true);
          const newCount = (localWantCount !== null ? localWantCount : basePopularityValue) + 1;
          setTimeout(() => {
            const ev = new CustomEvent(REFRESH_TRENDING_EVENT, { 
              bubbles: true,
              detail: { nftAddress: itemAddress, newWantCount: newCount } as RefreshTrendingEvent
            });
            document.dispatchEvent(ev);
            // updateLocalWantCount(basePopularityValue, false); // Re-set to ensure it doesn't double increment if called again quickly
          }, 3000); // Shortened delay for quicker UI feedback
        }
      }
    );
  };

  const modalDisplayContent = (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <Title>
            {nameForDisplay}
            <TypeBadge $type={itemTypeDisplay === 'Collection' ? 'Collection' : 'NFT'}>
              {itemTypeDisplay}
            </TypeBadge>
          </Title>
          <CloseButton onClick={onClose}>×</CloseButton>
        </ModalHeader>
        
        <ModalBody>
          <ImageSection>
            <ImageWrapper>
              {(loadingMetadata || isImageActuallyLoading) ? (
                <ImagePlaceholder>
                  <p>{loadingMetadata ? 'Loading Metadata...' : 'Loading Image...'}</p>
                  <p className="nft-id">{itemAddress ? itemAddress.slice(0,12) + '...' : 'Loading...'}</p>
                </ImagePlaceholder>
              ) : (
                <Image 
                  key={`${itemAddress}-${currentImageSrc}`}
                  src={currentImageSrc} 
                  alt={nameForDisplay || 'NFT Image'}
                  onError={onImageErrorHandler} 
                  data-mint-address={itemAddress} 
                  data-collection={collectionForDisplay || ''} 
                  data-tracking-added="true"
                />
              )}
            </ImageWrapper>
          </ImageSection>
          
          <InfoSection>
            {collectionForDisplay && <CollectionName>{collectionForDisplay}</CollectionName>}
            <Address>{itemAddress}</Address>
            
            {descriptionForDisplay && <Description>{descriptionForDisplay}</Description>}
            
            <StatsSection>
              <StatItem>
                <StatLabel>{isNftType ? 'Wanted By' : 'Appearances'}</StatLabel>
                <StatValue>{popularityDisplay} {isNftType ? 'users' : 'loops'}</StatValue>
              </StatItem>
              
              {scoreDisplay !== null && (
                <StatItem>
                  <StatLabel>Average Score</StatLabel>
                  <StatValue>{scoreDisplay}%</StatValue>
                </StatItem>
              )}
            </StatsSection>
            
            {attributesForDisplay && attributesForDisplay.length > 0 && (
              <AttributesSection>
                <AttributesTitle>Attributes</AttributesTitle>
                <AttributesGrid>
                  {attributesForDisplay.map((attr, index) => (
                    <AttributeBadge key={`${attr.trait_type}-${index}`}>
                      <AttributeType>{attr.trait_type}</AttributeType>
                      <AttributeValue>{attr.value}</AttributeValue>
                    </AttributeBadge>
                  ))}
                </AttributesGrid>
              </AttributesSection>
            )}
            
            <ActionButton 
              onClick={onEffectiveAddToWants}
              disabled={addingToWants || !connected || (isNftType && successMessage !== null && successMessage.includes('Successfully added'))}
            >
              {addingToWants ? (
                <>
                  <LoadingSpinner /> Adding to Wants...
                </>
              ) : (isNftType && successMessage !== null && successMessage.includes('Successfully added')) ? 'Added to Wants' : 'Add to My Wants'}
            </ActionButton>
            
            {successMessage && <SuccessMessage>{successMessage}</SuccessMessage>}
            {errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}
          </InfoSection>
        </ModalBody>
      </ModalContent>
    </ModalOverlay>
  );

  return typeof document !== 'undefined' 
    ? ReactDOM.createPortal(
        <div className="nft-detail-modal-container">
          <NFTDetailModalFontStyle />
          {modalDisplayContent}
        </div>, 
        document.body
      ) 
    : null;
};

export default NFTDetailModal; 