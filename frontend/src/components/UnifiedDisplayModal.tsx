'use client';

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import styled, { createGlobalStyle, keyframes, css } from 'styled-components';
import { NFTMetadata } from '@/types/nft';
import { CollectionSearchResult } from '@/types/trade';
import { TradeLoop } from '@/types/trade';
import { TradeService } from '@/services/trade';
import { CollectionService } from '@/services/collection';
import { useWallet } from '@solana/wallet-adapter-react';
import RippleButton from './common/RippleButton';
import LoadingIndicator from './common/LoadingIndicator';

// Global modal styles - Perfect SWAPS Design System
const ModalGlobalStyle = createGlobalStyle`
  .unified-display-modal * {
    font-family: 'Roboto Mono', monospace !important;
  }
`;

// SWAPS-themed animations
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { 
    transform: translateY(20px); 
    opacity: 0; 
  }
  to { 
    transform: translateY(0); 
    opacity: 1; 
  }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const pulse = keyframes`
  0%, 100% { 
    transform: scale(1);
    opacity: 1;
  }
  50% { 
    transform: scale(1.05);
    opacity: 0.8;
  }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const glow = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(123, 97, 255, 0.3); }
  50% { box-shadow: 0 0 30px rgba(123, 97, 255, 0.5); }
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  padding: 1rem;
  ${css`animation: ${fadeIn} 0.3s ease;`}
`;

const ModalContent = styled.div`
  background: rgba(24, 26, 32, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  ${css`animation: ${slideUp} 0.4s cubic-bezier(0.22, 1, 0.36, 1);`}
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, #7b61ff, transparent);
    ${css`animation: ${shimmer} 2s infinite;`}
  }
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  background: linear-gradient(135deg, rgba(24, 26, 32, 0.9) 0%, rgba(123, 97, 255, 0.05) 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
`;

const ModalTitle = styled.h2`
  color: #ffffff;
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-family: 'Roboto Mono', monospace;
`;

const TypeBadge = styled.span<{ $type: 'nft' | 'collection' }>`
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-family: 'Roboto Mono', monospace;
  
  ${props => props.$type === 'nft' ? css`
    background: linear-gradient(135deg, #00E0B5 0%, #33E6C2 100%);
    color: #000;
    box-shadow: 0 2px 8px rgba(0, 224, 181, 0.3);
  ` : css`
    background: linear-gradient(135deg, #7B61FF 0%, #9A84FF 100%);
    color: #fff;
    box-shadow: 0 2px 8px rgba(123, 97, 255, 0.3);
  `}
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1.2rem;
  font-family: 'Roboto Mono', monospace;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
    transform: rotate(90deg);
  }
`;

const ModalBody = styled.div`
  flex: 1;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(123, 97, 255, 0.5);
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(123, 97, 255, 0.7);
  }
`;

const ContentSection = styled.div`
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 2rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
`;

const ImageSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const ImageWrapper = styled.div`
  width: 100%;
  aspect-ratio: 1/1;
  overflow: hidden;
  border-radius: 12px;
  position: relative;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
  }
`;

const Image = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
  
  &:hover {
    transform: scale(1.05);
  }
`;

const DetailsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const DetailGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const DetailLabel = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-family: 'Roboto Mono', monospace;
`;

const DetailValue = styled.div`
  color: #ffffff;
  font-size: 1rem;
  font-weight: 500;
  font-family: 'Roboto Mono', monospace;
  line-height: 1.4;
`;

const AddressValue = styled(DetailValue)`
  background: rgba(0, 0, 0, 0.3);
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.85rem;
  font-family: 'Roboto Mono', monospace;
  word-break: break-all;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
`;

const StatCard = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1rem;
  text-align: center;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(123, 97, 255, 0.05);
    border-color: rgba(123, 97, 255, 0.3);
    transform: translateY(-2px);
  }
`;

const StatValue = styled.div`
  color: #ffffff;
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
  font-family: 'Roboto Mono', monospace;
`;

const StatLabel = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.7rem;
  font-weight: 500;
  font-family: 'Roboto Mono', monospace;
`;

const AttributesSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const AttributesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
  max-height: 200px;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(123, 97, 255, 0.3);
    border-radius: 3px;
  }
`;

const AttributeCard = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 0.75rem;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: rgba(123, 97, 255, 0.3);
    background: rgba(123, 97, 255, 0.05);
  }
`;

const AttributeType = styled.div`
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
  letter-spacing: 0.5px;
  font-family: 'Roboto Mono', monospace;
`;

const AttributeValue = styled.div`
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 600;
  font-family: 'Roboto Mono', monospace;
`;

const ActionsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
`;

// Enhanced loading animation with SWAPS branding
const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  gap: 2rem;
  text-align: center;
  background: linear-gradient(135deg, rgba(24, 26, 32, 0.9) 0%, rgba(123, 97, 255, 0.05) 100%);
  border-radius: 16px;
  border: 1px solid rgba(123, 97, 255, 0.2);
`;

const LoadingSpinner = styled.div`
  position: relative;
  width: 80px;
  height: 80px;
  
  &::before,
  &::after {
    content: '';
    position: absolute;
    border-radius: 50%;
  }
  
  &::before {
    width: 100%;
    height: 100%;
    background: linear-gradient(to right, #7b61ff 0%, transparent 100%);
    ${css`animation: ${spin} 1.5s linear infinite;`}
  }
  
  &::after {
    width: 70%;
    height: 70%;
    background: rgba(24, 26, 32, 0.95);
    top: 15%;
    left: 15%;
  }
`;

const LoadingText = styled.div`
  color: #ffffff;
  font-size: 1.1rem;
  font-weight: 600;
  font-family: 'Roboto Mono', monospace;
  background: linear-gradient(90deg, #ffffff 0%, #7b61ff 50%, #ffffff 100%);
  background-size: 200% auto;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  ${css`animation: ${shimmer} 3s linear infinite;`}
`;

const LoadingSteps = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const LoadingStep = styled.div<{ $active: boolean; $completed: boolean }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  transition: all 0.3s ease;
  
  ${props => {
    if (props.$completed) {
      return css`
        background: #00E0B5;
        transform: scale(1.2);
        box-shadow: 0 0 10px rgba(0, 224, 181, 0.5);
      `;
    } else if (props.$active) {
      return css`
        background: #7b61ff;
        animation: ${pulse} 1s ease-in-out infinite;
      `;
    } else {
      return css`
        background: rgba(255, 255, 255, 0.2);
      `;
    }
  }}
`;

// Success message with SWAPS styling
const SuccessMessage = styled.div`
  background: linear-gradient(135deg, rgba(0, 224, 181, 0.1) 0%, rgba(51, 230, 194, 0.1) 100%);
  border: 1px solid rgba(0, 224, 181, 0.3);
  color: #00E0B5;
  padding: 1.5rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 1rem;
  ${css`animation: ${slideUp} 0.4s ease;`}
  font-family: 'Roboto Mono', monospace;
  
  .success-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
    ${css`animation: ${pulse} 2s ease-in-out infinite;`}
  }
`;

// Compact results display
const ResultsContainer = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  ${css`animation: ${slideUp} 0.4s ease;`}
`;

const ResultsTitle = styled.h3`
  color: #ffffff;
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  font-family: 'Roboto Mono', monospace;
`;

const ResultsSubtitle = styled.p`
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
  margin: 0;
  font-family: 'Roboto Mono', monospace;
`;

interface UnifiedDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'nft' | 'collection' | null;
  data: NFTMetadata | CollectionSearchResult | null;
  onTradesFound?: (trades: TradeLoop[]) => void;
}

export const UnifiedDisplayModal: React.FC<UnifiedDisplayModalProps> = ({
  isOpen,
  onClose,
  type,
  data,
  onTradesFound
}) => {
  const [trades, setTrades] = useState<TradeLoop[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);
  const [hasSearchedTrades, setHasSearchedTrades] = useState(false);
  const [isAddingWant, setIsAddingWant] = useState(false);
  const [wantAdded, setWantAdded] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const { publicKey, connected } = useWallet();

  const tradeService = TradeService.getInstance();
  const collectionService = CollectionService.getInstance();

  // Reset state when modal opens/closes or data changes
  useEffect(() => {
    if (isOpen && data) {
      setTrades([]);
      setHasSearchedTrades(false);
      setWantAdded(false);
      setLoadingStep(0);
    }
  }, [isOpen, data]);

  // Enhanced loading animation
  useEffect(() => {
    if (isLoadingTrades) {
      const interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % 4);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isLoadingTrades]);

  // Handle finding trades with enhanced UX
  const handleFindTrades = async () => {
    if (!connected || !publicKey || !data) {
      return;
    }

    setIsLoadingTrades(true);
    setHasSearchedTrades(true);
    setLoadingStep(0);

    try {
      let tradeLoops: TradeLoop[] = [];

      if (type === 'nft') {
        const nftData = data as NFTMetadata;
        tradeLoops = await tradeService.findTradeLoops(nftData, publicKey.toString(), {
          considerCollections: true,
          includeCollectionTrades: true,
          maxResults: 50
        });
      } else if (type === 'collection') {
        const collectionData = data as CollectionSearchResult;
        await collectionService.addCollectionWant(publicKey.toString(), collectionData.id);
        
        tradeLoops = await tradeService.findCollectionTrades(publicKey.toString(), {
          maxResults: 50,
          minEfficiency: 0.7
        });
      }

      // Filter relevant trades
      const currentWalletAddress = publicKey.toString();
      const relevantTrades = tradeLoops.filter(trade => {
        if (!trade.steps || trade.steps.length === 0) return false;
        const isUserSender = trade.steps.some(step => step.from === currentWalletAddress);
        const isUserReceiver = trade.steps.some(step => step.to === currentWalletAddress);
        const isFirstStepFromUser = trade.steps[0].from === currentWalletAddress;
        
        return isUserSender && isUserReceiver && isFirstStepFromUser;
      });

      setTrades(relevantTrades);
      
      // Enhanced flow - just finish loading and close modal
      setTimeout(() => {
        setIsLoadingTrades(false);
        
        if (relevantTrades.length > 0) {
          // Mark trades as newly discovered for highlighting
          const tradesWithHighlight = relevantTrades.map(trade => ({
            ...trade,
            isNewlyDiscovered: true,
            searchedNFTAddress: type === 'nft' ? (data as NFTMetadata).address : undefined,
            searchedCollectionId: type === 'collection' ? (data as CollectionSearchResult).id : undefined
          }));
          
          // Pass trades back to parent and close modal
          if (onTradesFound) {
            onTradesFound(tradesWithHighlight);
          }
          onClose();
        } else {
          // Show no results message briefly then close
          setTimeout(() => {
            onClose();
          }, 2000);
        }
      }, 1200);

    } catch (error) {
      console.error('Error finding trades:', error);
      setIsLoadingTrades(false);
    }
  };

  const handleAddCollectionWant = async () => {
    if (!connected || !publicKey || type !== 'collection') {
      return;
    }

    setIsAddingWant(true);
    try {
      const collectionData = data as CollectionSearchResult;
      const success = await collectionService.addCollectionWant(publicKey.toString(), collectionData.id);
      if (success) {
        setWantAdded(true);
        setTimeout(() => {
          handleFindTrades();
        }, 800);
      }
    } catch (error) {
      console.error('Error adding collection want:', error);
    } finally {
      setIsAddingWant(false);
    }
  };

  if (!isOpen || !data || !type) return null;

  // Enhanced placeholder with SWAPS branding
  const defaultImageSrc = `data:image/svg+xml;base64,${btoa(`
    <svg width="320" height="320" viewBox="0 0 320 320" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#7b61ff"/>
          <stop offset="100%" stop-color="#9a84ff"/>
        </linearGradient>
      </defs>
      <rect width="320" height="320" rx="16" fill="url(#gradient)" opacity="0.1"/>
      <rect x="80" y="120" width="160" height="80" rx="12" fill="url(#gradient)" opacity="0.3"/>
      <circle cx="140" cy="140" r="16" fill="#7b61ff" opacity="0.6"/>
      <path d="M80 180l40-40 20 20 40-40v60c0 8-6 14-14 14h-72c-8 0-14-6-14-14z" fill="#7b61ff" opacity="0.4"/>
      <text x="160" y="260" text-anchor="middle" fill="#7b61ff" font-family="monospace" font-size="14" opacity="0.8">SWAPS</text>
    </svg>
  `)}`;

  const modalContent = (
    <div className="unified-display-modal">
      <ModalGlobalStyle />
      <ModalOverlay onClick={onClose}>
        <ModalContent onClick={e => e.stopPropagation()}>
          <ModalHeader>
            <ModalTitle>
              {type === 'nft' ? (data as NFTMetadata).name || 'Unknown NFT' : (data as CollectionSearchResult).name}
              <TypeBadge $type={type}>{type}</TypeBadge>
            </ModalTitle>
            <CloseButton onClick={onClose}>×</CloseButton>
          </ModalHeader>

          <ModalBody>
            {isLoadingTrades ? (
              <LoadingContainer>
                <LoadingSpinner />
                <LoadingText>Discovering trade opportunities...</LoadingText>
                <LoadingSteps>
                  {[0, 1, 2, 3].map(step => (
                    <LoadingStep 
                      key={step}
                      $active={step === loadingStep}
                      $completed={step < loadingStep}
                    />
                  ))}
                </LoadingSteps>
              </LoadingContainer>
            ) : (
              <>
                <ContentSection>
                  <ImageSection>
                    <ImageWrapper>
                      <Image
                        src={type === 'nft' ? (data as NFTMetadata).image || defaultImageSrc : (data as CollectionSearchResult).imageUrl || defaultImageSrc}
                        alt={type === 'nft' ? (data as NFTMetadata).name || 'NFT' : (data as CollectionSearchResult).name}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (target.src !== defaultImageSrc) {
                            target.src = defaultImageSrc;
                          }
                        }}
                      />
                    </ImageWrapper>
                  </ImageSection>

                  <DetailsSection>
                    {type === 'nft' ? (
                      <>
                        <DetailGroup>
                          <DetailLabel>NFT Address</DetailLabel>
                          <AddressValue>{(data as NFTMetadata).address}</AddressValue>
                        </DetailGroup>

                        {(data as NFTMetadata).collection && (
                          <DetailGroup>
                            <DetailLabel>Collection</DetailLabel>
                            <DetailValue>
                              {typeof (data as NFTMetadata).collection === 'string' 
                                ? (data as NFTMetadata).collection 
                                : ((data as NFTMetadata).collection as any)?.name || 'Unknown Collection'}
                            </DetailValue>
                          </DetailGroup>
                        )}

                        {(data as NFTMetadata).description && (
                          <DetailGroup>
                            <DetailLabel>Description</DetailLabel>
                            <DetailValue>{(data as NFTMetadata).description}</DetailValue>
                          </DetailGroup>
                        )}

                        {(data as NFTMetadata).attributes && (data as NFTMetadata).attributes!.length > 0 && (
                          <AttributesSection>
                            <DetailLabel>Attributes</DetailLabel>
                            <AttributesGrid>
                              {(data as NFTMetadata).attributes!.map((attr, index) => (
                                <AttributeCard key={`${attr.trait_type}-${index}`}>
                                  <AttributeType>{attr.trait_type}</AttributeType>
                                  <AttributeValue>{attr.value}</AttributeValue>
                                </AttributeCard>
                              ))}
                            </AttributesGrid>
                          </AttributesSection>
                        )}
                      </>
                    ) : (
                      <>
                        <DetailGroup>
                          <DetailLabel>Collection ID</DetailLabel>
                          <AddressValue>{(data as CollectionSearchResult).id}</AddressValue>
                        </DetailGroup>

                        <StatsGrid>
                          <StatCard>
                            <StatValue>{(data as CollectionSearchResult).nftCount.toLocaleString()}</StatValue>
                            <StatLabel>Total NFTs</StatLabel>
                          </StatCard>
                          <StatCard>
                            <StatValue>{(data as CollectionSearchResult).floorPrice.toFixed(3)} SOL</StatValue>
                            <StatLabel>Floor Price</StatLabel>
                          </StatCard>
                          <StatCard>
                            <StatValue>{(data as CollectionSearchResult).volume24h.toFixed(1)} SOL</StatValue>
                            <StatLabel>24h Volume</StatLabel>
                          </StatCard>
                          {(data as CollectionSearchResult).verified && (
                            <StatCard>
                              <StatValue>✓</StatValue>
                              <StatLabel>Verified</StatLabel>
                            </StatCard>
                          )}
                        </StatsGrid>

                        {(data as CollectionSearchResult).description && (
                          <DetailGroup>
                            <DetailLabel>Description</DetailLabel>
                            <DetailValue>{(data as CollectionSearchResult).description}</DetailValue>
                          </DetailGroup>
                        )}
                      </>
                    )}
                  </DetailsSection>
                </ContentSection>

                <ActionsSection>
                  <ActionButtons>
                    {connected ? (
                      <>
                        {type === 'collection' && !wantAdded && (
                          <RippleButton
                            variant="secondary"
                            onClick={handleAddCollectionWant}
                            disabled={isAddingWant}
                          >
                            {isAddingWant ? 'Adding Collection...' : '+ Add Collection to Wants'}
                          </RippleButton>
                        )}
                        
                        <RippleButton
                          variant="primary"
                          onClick={handleFindTrades}
                          disabled={isLoadingTrades}
                        >
                          {isLoadingTrades ? 'Finding Trades...' : `Find ${type === 'nft' ? 'NFT' : 'Collection'} Trades`}
                        </RippleButton>
                      </>
                    ) : (
                      <DetailValue style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                        Connect your wallet to find trades
                      </DetailValue>
                    )}
                  </ActionButtons>

                  {wantAdded && (
                    <SuccessMessage>
                      <span className="success-icon">✓</span>
                      Collection added to your wants! Finding trades...
                    </SuccessMessage>
                  )}

                  {hasSearchedTrades && !isLoadingTrades && (
                    <ResultsContainer>
                      <ResultsTitle>
                        {trades.length > 0 ? `Found ${trades.length} Trade Opportunities` : 'No Immediate Trades Found'}
                      </ResultsTitle>
                      <ResultsSubtitle>
                        {trades.length > 0 
                          ? 'Your trades will appear on the main dashboard'
                          : 'Your interest has been registered in the system'
                        }
                      </ResultsSubtitle>
                    </ResultsContainer>
                  )}
                </ActionsSection>
              </>
            )}
          </ModalBody>
        </ModalContent>
      </ModalOverlay>
    </div>
  );

  return typeof document !== 'undefined' 
    ? ReactDOM.createPortal(modalContent, document.body) 
    : null;
};

export default UnifiedDisplayModal; 