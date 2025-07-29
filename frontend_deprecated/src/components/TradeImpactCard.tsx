'use client';

import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { NFTMetadata } from '@/types/nft';
import { fixImageUrl, handleImageError, createDataURIPlaceholder } from '@/utils/imageUtils';
import { useWallet } from '@solana/wallet-adapter-react';
import LoadingIndicator from '@/components/common/LoadingIndicator';
import { useToastMessage } from '@/utils/context/ToastContext';
import { isUserRejection } from '@/utils/errors/errorHandler';
import { BaseService } from '@/services/base.service';
import { getCollectionName as getCollectionNameUtil } from '@/utils/nftUtils';
import { useTheme } from 'styled-components';

// Get API base URL from environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const ImpactContainer = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.surfaceBorder};
  padding: ${({ theme }) => theme.spacing.md};
  width: 100%;
  margin: 0;
  box-sizing: border-box;
  overflow: visible;
  max-width: 100%;
  box-shadow: ${({ theme }) => theme.mode === 'dark' ? '0 4px 12px rgba(0, 0, 0, 0.2)' : theme.shadows.sm};
  transition: background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
  
  @media (max-width: 640px) {
    padding: ${({ theme }) => theme.spacing.sm};
  }
`;

const CloseButtonWrapper = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: color ${({ theme }) => theme.transitions.normal};
  cursor: pointer;
  padding: 0;
  
  &:hover {
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

const TradeCardsContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  box-sizing: border-box;
  flex-wrap: wrap;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  }
  
  @media (max-width: 400px) {
    gap: ${({ theme }) => theme.spacing.sm};
  }
`;

const NFTCardWrapper = styled.div`
  flex: 1;
  min-width: 140px;
  max-width: 180px;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: 1px solid ${({ theme }) => theme.colors.surfaceBorder};
  overflow: hidden;
  transition: transform ${({ theme }) => theme.transitions.normal}, 
              box-shadow ${({ theme }) => theme.transitions.normal},
              border-color ${({ theme }) => theme.transitions.normal},
              background-color ${({ theme }) => theme.transitions.normal};
  margin: 1px;
  
  @media (max-width: 400px) {
    max-width: 100%;
    min-width: 120px;
  }
  
  &:hover {
    transform: translateY(-3px);
    box-shadow: ${({ theme }) => theme.mode === 'dark' 
      ? '0 6px 16px rgba(0, 0, 0, 0.3)' 
      : theme.shadows.md};
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const ImageContainer = styled.div`
  position: relative;
  width: 100%;
  padding-bottom: 100%;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  transition: background-color 0.3s ease;
`;

const CardImage = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform ${({ theme }) => theme.transitions.normal};
  
  ${NFTCardWrapper}:hover & {
    transform: scale(1.05);
  }
`;

const CardInfo = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
`;

const CardName = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CardCollection = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const TradeLabel = styled.p<{ direction: 'from' | 'to' }>`
  margin: ${({ theme }) => theme.spacing.xs} 0 0;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ direction, theme }) => direction === 'from' ? 
    theme.colors.error : 
    theme.colors.success
  };
`;

const ArrowContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: color 0.3s ease;
  
  @media (max-width: 400px) {
    transform: rotate(90deg);
    margin: ${({ theme }) => theme.spacing.sm} 0;
  }
`;

const FooterText = styled.p`
  text-align: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  margin: ${({ theme }) => theme.spacing.md} 0;
`;

const ButtonsContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.md};
  justify-content: center;
`;

const Button = styled.button<{ $primary?: boolean; $loading?: boolean }>`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: none;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.normal};
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 140px;
  
  background: ${({ $primary, theme }) => 
    $primary ? `linear-gradient(
      90deg, 
      ${theme.colors.gradientStart}, 
      ${theme.colors.gradientEnd}
    )` : theme.colors.backgroundSecondary};
  
  color: ${({ $primary, theme }) => 
    $primary ? '#FFFFFF' : theme.colors.textPrimary};
  
  &:hover {
    transform: ${({ $loading }) => $loading ? 'none' : 'translateY(-1px)'};
    box-shadow: ${({ $loading, theme }) => $loading ? 'none' : theme.mode === 'dark' 
      ? '0 4px 12px rgba(0, 0, 0, 0.3)' 
      : theme.shadows.sm};
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const RejectButton = styled(Button)`
  background-color: ${({ theme }) => theme.colors.backgroundSecondary};
  border: 1px solid ${({ theme }) => theme.colors.error};
  color: ${({ theme }) => theme.colors.error};
  
  &:hover {
    background-color: ${({ theme }) => theme.mode === 'dark' 
      ? 'rgba(255, 50, 50, 0.15)' 
      : 'rgba(255, 0, 0, 0.05)'};
  }
`;

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.lg};
  text-align: center;
`;

const ErrorTitle = styled.h3`
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.error};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
`;

const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.colors.error};
  text-align: center;
  margin-top: 10px;
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  animation: ${fadeIn} 0.3s ease-in-out;
`;

const NFTDetails = styled.div`
  padding: ${({ theme }) => theme.spacing.sm};
  background-color: ${({ theme }) => theme.colors.surface};
  transition: background-color 0.3s ease;
`;

const NFTName = styled.div`
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.3s ease;
`;

const CollectionName = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.3s ease;
`;

const MetricLabel = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: color 0.3s ease;
`;

const MetricValue = styled.div<{ $positive?: boolean; $neutral?: boolean }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ $positive, $neutral, theme }) => 
    $positive 
      ? theme.colors.success 
      : $neutral 
        ? theme.colors.textPrimary 
        : theme.colors.error};
  transition: color 0.3s ease;
`;

const QualityIndicator = styled.div<{ $quality: string }>`
  display: flex;
  align-items: center;
  margin-top: ${({ theme }) => theme.spacing.xs};
  
  span {
    display: inline-block;
    padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.xs}`};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
    margin-left: ${({ theme }) => theme.spacing.xs};
    
    background-color: ${({ $quality, theme }) => {
      switch ($quality.toLowerCase()) {
        case 'excellent':
          return theme.mode === 'dark' ? 'rgba(46, 204, 113, 0.3)' : 'rgba(46, 204, 113, 0.15)';
        case 'good':
          return theme.mode === 'dark' ? 'rgba(52, 152, 219, 0.3)' : 'rgba(52, 152, 219, 0.15)';
        case 'fair':
          return theme.mode === 'dark' ? 'rgba(241, 196, 15, 0.3)' : 'rgba(241, 196, 15, 0.15)';
        case 'poor':
          return theme.mode === 'dark' ? 'rgba(231, 76, 60, 0.3)' : 'rgba(231, 76, 60, 0.15)';
        default:
          return theme.mode === 'dark' ? 'rgba(149, 165, 166, 0.3)' : 'rgba(149, 165, 166, 0.15)';
      }
    }};
    
    color: ${({ $quality, theme }) => {
      switch ($quality.toLowerCase()) {
        case 'excellent':
          return '#27ae60';
        case 'good':
          return '#2980b9';
        case 'fair':
          return '#f39c12';
        case 'poor':
          return '#c0392b';
        default:
          return theme.colors.textSecondary;
      }
    }};
    
    transition: background-color 0.3s ease, color 0.3s ease;
  }
`;

interface TradeImpactCardProps {
  userNFT: NFTMetadata | null;
  receivingNFT: NFTMetadata | null;
  onClose?: () => void;
  onReject?: (nftAddress: string) => void;
  onExecute?: () => Promise<void>;
}

const TradeImpactCard: React.FC<TradeImpactCardProps> = ({
  userNFT,
  receivingNFT,
  onClose,
  onReject,
  onExecute
}) => {
  const { publicKey } = useWallet();
  const [isExecuting, setIsExecuting] = useState(false);
  const toast = useToastMessage();
  const theme = useTheme();
  const [tradingState, setTradingState] = useState<'idle' | 'executing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // === Log received props ===
  console.log('[TradeImpactCard] Received Props:', {
    userNFT: userNFT ? { name: userNFT.name, image: userNFT.image, address: userNFT.address } : null,
    receivingNFT: receivingNFT ? { name: receivingNFT.name, image: receivingNFT.image, address: receivingNFT.address } : null
  });
  // === End logging ===
  
  // Log NFT information for debugging only
  console.log('TradeImpactCard NFTs:', {
    userNFT: userNFT ? {
      name: userNFT.name,
      address: userNFT.address
    } : null,
    receivingNFT: receivingNFT ? {
      name: receivingNFT.name,
      address: receivingNFT.address
    } : null
  });
  
  // Error state - we need both NFTs to show a meaningful trade impact
  if (!userNFT || !receivingNFT) {
    return (
      <ImpactContainer>
        <div style={{ 
          padding: '20px',
          textAlign: 'center',
          color: theme.colors.error,
          backgroundColor: 'rgba(255,0,0,0.05)',
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Unable to display trade impact</div>
          
          {receivingNFT && !userNFT && <div>Found receiving NFT but not sending NFT.</div>}
          {userNFT && !receivingNFT && <div>Found sending NFT but not receiving NFT.</div>}
          {!userNFT && !receivingNFT && <div>Could not determine NFTs in this trade loop.</div>}

          <div style={{ marginTop: '10px', fontSize: '12px', color: theme.colors.textSecondary }}>
            This is likely due to an incomplete trade loop structure.
            Please try refreshing the page or contact support.
          </div>
          
          {onClose && (
            <div style={{ marginTop: '10px' }}>
              <button 
                onClick={onClose}
                style={{
                  padding: '5px 10px',
                  background: 'transparent',
                  border: `1px solid ${theme.colors.error}`,
                  borderRadius: '4px',
                  color: theme.colors.error,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </ImpactContainer>
    );
  }
  
  // Use the NFTs as provided by the TradeFlow component
  // We trust that TradeFlow has determined the correct NFTs
  const actualUserNFT = userNFT;
  const actualReceivingNFT = receivingNFT;
  
  // Ensure we always have an image URL, using data URI placeholders if needed
  const processImageUrl = (imageUrl: string, mintAddress: string) => {
    // Direct check for problematic daswebs.xyz URLs with Shadow Drive images
    if (imageUrl && imageUrl.includes('daswebs.xyz') && imageUrl.includes('shdw-drive.genesysgo.net')) {
      // Extract the Shadow Drive URL directly
      const shadowMatch = imageUrl.match(/shdw-drive\.genesysgo\.net\/([^\/\s"']+)\/([^\/\s"']+)/i);
      if (shadowMatch && shadowMatch[1] && shadowMatch[2]) {
        const storageAccount = shadowMatch[1];
        const fileName = shadowMatch[2];
        // Use the direct Shadow Drive URL
        console.log(`Fixed Shadow Drive URL for ${mintAddress}: https://shdw-drive.genesysgo.net/${storageAccount}/${fileName}`);
        return `https://shdw-drive.genesysgo.net/${storageAccount}/${fileName}`;
      }
    }
    
    // Use our standard fixImageUrl function as the fallback
    return fixImageUrl(imageUrl, mintAddress);
  };
  
  const userImageUrl = actualUserNFT.image && actualUserNFT.image !== ''
    ? processImageUrl(actualUserNFT.image, actualUserNFT.address) 
    : createDataURIPlaceholder(actualUserNFT.name || actualUserNFT.address.slice(0, 8));
    
  const receivingImageUrl = actualReceivingNFT.image && actualReceivingNFT.image !== ''
    ? processImageUrl(actualReceivingNFT.image, actualReceivingNFT.address)
    : createDataURIPlaceholder(actualReceivingNFT.name || actualReceivingNFT.address.slice(0, 8));
  
  const handleReject = async () => {
    try {
      // Skip API call if no wallet connected
      if (!publicKey) {
        console.log('No wallet connected, skipping rejection API call');
        if (onReject && actualReceivingNFT) onReject(actualReceivingNFT.address);
        if (onClose) onClose();
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/trades/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          rejectedNftAddress: actualReceivingNFT.address
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        console.log('Trade rejected successfully');
        if (onReject) onReject(actualReceivingNFT.address);
        // Simply close/remove the component when rejected
        if (onClose) onClose();
      }
    } catch (error) {
      console.error('Error rejecting trade:', error);
    }
  };

  // Handle execution of the trade
  const handleExecute = async () => {
    if (!onExecute) {
      toast.warning("Execute functionality is not available");
      return;
    }
    
    setIsExecuting(true);
    try {
      await onExecute();
      toast.success("Trade executed successfully!");
    } catch (err) {
      console.error("Error executing trade:", err);
      
      // Only show error toast if it's not a user rejection
      if (!isUserRejection(err)) {
        toast.error("Failed to execute trade. Please try again.");
      }
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExecuteDemoTrade = () => {
    setTradingState('executing');
    const theme = useTheme();
    
    // Simulate API call with timeout
    setTimeout(() => {
      if (Math.random() > 0.7) {
        // Randomly simulate an error (30% chance)
        setTradingState('error');
        setErrorMessage('Demo transaction failed');
      } else {
        setTradingState('success');
      }
    }, 2000);
  };

  // Error state
  if (tradingState === 'error') {
    return (
      <ImpactContainer>
        <ErrorContainer>
          <ErrorTitle>Transaction Failed</ErrorTitle>
          <ErrorMessage>{errorMessage}</ErrorMessage>
          <CloseButton onClick={onClose}>Close</CloseButton>
        </ErrorContainer>
      </ImpactContainer>
    );
  }

  return (
    <ImpactContainer>
      {onClose && (
        <CloseButtonWrapper>
          <CloseButton onClick={onClose} aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </CloseButton>
        </CloseButtonWrapper>
      )}

      <TradeCardsContainer>
        {/* User's current NFT */}
        <NFTCardWrapper>
          <ImageContainer>
            <CardImage 
              src={userImageUrl} 
              alt={actualUserNFT.name || 'NFT'} 
              onError={handleImageError}
              data-mint-address={actualUserNFT.address}
              data-collection={getCollectionNameUtil(actualUserNFT.collection, actualUserNFT.name)}
            />
          </ImageContainer>
          <CardInfo>
            <CardName>{actualUserNFT.name || 'Unknown NFT'}</CardName>
            <CardCollection>{getCollectionNameUtil(actualUserNFT.collection, actualUserNFT.name)}</CardCollection>
            <TradeLabel direction="from">Giving</TradeLabel>
          </CardInfo>
        </NFTCardWrapper>

        {/* Arrow */}
        <ArrowContainer>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>For</span>
        </ArrowContainer>

        {/* Receiving NFT */}
        <NFTCardWrapper>
          <ImageContainer>
            <CardImage 
              src={receivingImageUrl} 
              alt={actualReceivingNFT.name || 'NFT'} 
              onError={handleImageError}
              data-mint-address={actualReceivingNFT.address}
              data-collection={getCollectionNameUtil(actualReceivingNFT.collection, actualReceivingNFT.name)}
            />
          </ImageContainer>
          <CardInfo>
            <CardName>{actualReceivingNFT.name || 'Unknown NFT'}</CardName>
            <CardCollection>{getCollectionNameUtil(actualReceivingNFT.collection, actualReceivingNFT.name)}</CardCollection>
            <TradeLabel direction="to">Receiving</TradeLabel>
          </CardInfo>
        </NFTCardWrapper>
      </TradeCardsContainer>

      <FooterText>
        You are sending <strong>{actualUserNFT.name}</strong> and receiving <strong>{actualReceivingNFT.name}</strong> as part of this multi-party trade loop.
      </FooterText>
      
      <ButtonsContainer>
        {onReject && (
          <RejectButton onClick={() => onReject(actualReceivingNFT?.address || '')}>
            Reject
          </RejectButton>
        )}
        <Button 
          $primary={true}
          disabled={isExecuting || !onExecute}
          onClick={handleExecute}
        >
          {isExecuting ? (
            <>
              <LoadingIndicator size="small" color="white" />
              <span style={{ marginLeft: '0.5rem' }}>Executing...</span>
            </>
          ) : (
            "Execute Trade"
          )}
        </Button>
      </ButtonsContainer>
    </ImpactContainer>
  );
};

export default TradeImpactCard; 