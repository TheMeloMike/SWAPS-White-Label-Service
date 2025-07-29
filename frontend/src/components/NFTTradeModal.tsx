'use client';

import React, { useState, useEffect } from 'react';
import styled, { keyframes, ThemeProvider, createGlobalStyle } from 'styled-components';
import ReactDOM from 'react-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { NFTMetadata } from '@/types/nft';
import { fixImageUrl, handleImageError } from '@/utils/imageUtils';
import { getCollectionName } from '@/utils/nftUtils';
import { TradeService } from '@/services/trade';
import { TradeLoop } from '@/types/trade';
import EnhancedRippleButton from './common/EnhancedRippleButton';
import { v4 as uuidv4 } from 'uuid';
import { IoClose, IoSwapHorizontal, IoArrowForward, IoCheckmarkCircle, IoAlertCircle } from 'react-icons/io5';
import { theme } from '@/styles/theme';

// Use type assertion for PENDING_SEARCH_EVENT and PendingSearchEvent
// instead of importing from '@/types/events'
const PENDING_SEARCH_EVENT = 'pendingSearch';

interface PendingSearchEvent {
  id: string;
  searchedNFT: NFTMetadata;
  initiatedAt: Date;
}

interface NFTTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  nft: NFTMetadata;
}

// Add this global style for the modal
const ModalFontStyle = createGlobalStyle`
  .nft-trade-modal-container * {
    font-family: 'Roboto Mono', monospace !important;
  }
`;

// Enhanced animations
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { transform: translateY(30px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const glowPulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(103, 69, 255, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(103, 69, 255, 0); }
  100% { box-shadow: 0 0 0 0 rgba(103, 69, 255, 0); }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

// Modernized overlay with backdrop blur
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  padding: 1rem;
  animation: ${fadeIn} 0.25s ease;
  font-family: var(--font-roboto-mono), monospace;
`;

// Premium content container with glass effect
const ModalContent = styled.div`
  background: rgba(24, 26, 32, 0.95);
  border-radius: 16px;
  width: 95%;
  max-width: 900px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.3);
  animation: ${slideUp} 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-family: var(--font-roboto-mono), monospace;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    
    &:hover {
      background: rgba(255, 255, 255, 0.15);
    }
  }
`;

// Gradient header
const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  background: linear-gradient(to right, rgba(24, 26, 32, 0.9), rgba(103, 69, 255, 0.1));
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px 16px 0 0;
  font-family: var(--font-roboto-mono), monospace;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.35rem;
  color: ${({ theme }) => theme?.colors?.textPrimary || '#FFFFFF'};
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-roboto-mono), monospace;
  
  svg {
    color: ${({ theme }) => theme?.colors?.primary || '#6745FF'};
  }
`;

// Modern close button
const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.05);
  border: none;
  color: ${({ theme }) => theme?.colors?.textSecondary || '#A0A0B0'};
  font-size: 1.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: ${({ theme }) => theme?.colors?.textPrimary || '#FFFFFF'};
    transform: rotate(90deg);
  }
`;

const ModalBody = styled.div`
  padding: 1.25rem;
`;

// Enhanced NFT display
const NFTInfoSection = styled.div`
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1.25rem;
  background: rgba(0, 0, 0, 0.1);
  padding: 0.75rem;
  border-radius: 12px;
  
  @media (max-width: 580px) {
    flex-direction: column;
    align-items: center;
  }
`;

const NFTImageContainer = styled.div`
  width: 140px;
  height: 140px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.2);
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.4));
    pointer-events: none;
  }
  
  @media (max-width: 580px) {
    width: 160px;
    height: 160px;
  }
`;

const NFTImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
  
  ${NFTImageContainer}:hover & {
    transform: scale(1.05);
  }
`;

const NFTDetails = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1;
  font-family: var(--font-roboto-mono), monospace;
  
  @media (max-width: 580px) {
    align-items: center;
    text-align: center;
  }
`;

const NFTName = styled.h3`
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
  color: ${({ theme }) => theme?.colors?.textPrimary || '#FFFFFF'};
  font-weight: 600;
  font-family: var(--font-roboto-mono), monospace;
`;

const NFTCollection = styled.div`
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
  color: ${({ theme }) => theme?.colors?.primary || '#6745FF'};
  background: rgba(103, 69, 255, 0.1);
  padding: 0.2rem 0.75rem;
  border-radius: 12px;
  display: inline-block;
  border: 1px solid rgba(103, 69, 255, 0.2);
  font-weight: 500;
  font-family: var(--font-roboto-mono), monospace;
`;

const NFTAddress = styled.p`
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: ${({ theme }) => theme?.colors?.textSecondary || '#A0A0B0'};
  font-family: var(--font-roboto-mono), monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  background: rgba(255, 255, 255, 0.03);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  
  @media (max-width: 580px) {
    max-width: 100%;
    word-break: break-all;
  }
`;

// Modern button container
const ButtonContainer = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: 0.875rem;
  
  @media (max-width: 480px) {
    flex-direction: column;
    gap: 0.5rem;
  }
`;

// Enhanced status messages
const StatusMessage = styled.div<{ $isError?: boolean }>`
  color: ${({ theme, $isError }) => $isError ? theme?.colors?.error || '#FF3B30' : theme?.colors?.primary || '#6745FF'};
  margin: 0.75rem 0;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: ${({ theme, $isError }) => $isError ? 'rgba(255, 59, 48, 0.1)' : 'rgba(103, 69, 255, 0.1)'};
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
  border: 1px solid ${({ theme, $isError }) => $isError ? 'rgba(255, 59, 48, 0.2)' : 'rgba(103, 69, 255, 0.2)'};
  animation: ${fadeIn} 0.3s ease;
  font-family: var(--font-roboto-mono), monospace;
  
  svg {
    font-size: 1.25rem;
    flex-shrink: 0;
  }
`;

// Modern loading animation
const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin: 1.5rem 0;
  padding: 1.5rem;
`;

const LoadingSpinner = styled.div`
  position: relative;
  width: 48px;
  height: 48px;
  
  &::before,
  &::after {
    content: '';
    position: absolute;
    border-radius: 50%;
  }
  
  &::before {
    width: 100%;
    height: 100%;
    background: linear-gradient(to right, ${({ theme }) => theme?.colors?.primary || '#6745FF'} 0%, transparent 100%);
    animation: rotate 2s linear infinite;
  }
  
  &::after {
    width: 75%;
    height: 75%;
    background: rgba(24, 26, 32, 0.95);
    top: 12.5%;
    left: 12.5%;
  }
  
  @keyframes rotate {
    to { transform: rotate(360deg); }
  }
`;

const LoadingText = styled.p`
  color: ${({ theme }) => theme?.colors?.textSecondary || '#A0A0B0'};
  margin: 0;
  font-size: 1rem;
  font-family: var(--font-roboto-mono), monospace;
  
  background: linear-gradient(90deg, 
    ${({ theme }) => theme?.colors?.textSecondary || '#A0A0B0'} 0%, 
    ${({ theme }) => theme?.colors?.primary || '#6745FF'} 50%, 
    ${({ theme }) => theme?.colors?.textSecondary || '#A0A0B0'} 100%
  );
  background-size: 200% auto;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: ${shimmer} 4s linear infinite;
`;

// Trade section
const TradeSection = styled.div`
  margin-top: 1rem;
  font-family: var(--font-roboto-mono), monospace;
`;

const SectionTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: ${({ theme }) => theme?.colors?.textPrimary || '#FFFFFF'};
  margin: 0 0 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-roboto-mono), monospace;
  
  svg {
    color: ${({ theme }) => theme?.colors?.primary || '#6745FF'};
  }
`;

const TradeListContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 0.75rem;
  
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const NoTradesMessage = styled.div`
  color: ${({ theme }) => theme?.colors?.textSecondary || '#A0A0B0'};
  text-align: center;
  margin: 1.5rem 0;
  padding: 1.5rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.1);
  font-size: 0.9rem;
  line-height: 1.4;
  font-family: var(--font-roboto-mono), monospace;
`;

// Modernized trade card
const TradeCard = styled.div`
  padding: 0.875rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.2s ease;
  height: fit-content;
  
  &:hover {
    border-color: rgba(103, 69, 255, 0.3);
    background: rgba(103, 69, 255, 0.05);
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  }
  
  animation: ${fadeIn} 0.4s ease backwards;
  
  &:nth-child(1) { animation-delay: 0.1s; }
  &:nth-child(2) { animation-delay: 0.2s; }
  &:nth-child(3) { animation-delay: 0.3s; }
`;

const TradeSummary = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  
  @media (max-width: 480px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
`;

const TradeParticipants = styled.div`
  font-size: 0.875rem;
  color: ${({ theme }) => theme?.colors?.textSecondary || '#A0A0B0'};
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  
  svg {
    color: ${({ theme }) => theme?.colors?.primary || '#6745FF'};
  }
`;

const TradeEfficiency = styled.div<{ $efficiency: number }>`
  font-size: 0.875rem;
  color: ${({ $efficiency, theme }) => {
    if ($efficiency >= 90) return theme?.colors?.success || '#3AD26A';
    if ($efficiency >= 70) return theme?.colors?.warning || '#FFCC00';
    return theme?.colors?.error || '#FF3B30';
  }};
  font-weight: 600;
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  background: ${({ $efficiency }) => {
    if ($efficiency >= 90) return 'rgba(58, 220, 106, 0.1)';
    if ($efficiency >= 70) return 'rgba(255, 204, 0, 0.1)';
    return 'rgba(255, 59, 48, 0.1)';
  }};
  border: 1px solid ${({ $efficiency }) => {
    if ($efficiency >= 90) return 'rgba(58, 220, 106, 0.2)';
    if ($efficiency >= 70) return 'rgba(255, 204, 0, 0.2)';
    return 'rgba(255, 59, 48, 0.2)';
  }};
  
  animation: ${({ $efficiency }) => $efficiency >= 90 ? glowPulse : 'none'} 2s infinite;
`;

const TradeDetails = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
`;

const TradeColumn = styled.div`
  flex: 1;
`;

const ColumnHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

const ColumnLabel = styled.span`
  font-size: 0.75rem;
  color: ${({ theme }) => theme?.colors?.textSecondary || '#A0A0B0'};
  margin: 0;
  font-weight: 500;
  font-family: var(--font-roboto-mono), monospace;
`;

const NFTPreview = styled.div`
  display: flex;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.15);
  padding: 0.375rem;
  border-radius: 6px;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(0, 0, 0, 0.25);
    transform: translateY(-2px);
  }
`;

const SmallNFTImage = styled.div`
  width: 42px;
  height: 42px;
  overflow: hidden;
  border-radius: 6px;
  position: relative;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const NFTInfo = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
`;

const NFTPreviewName = styled.span`
  font-size: 0.8125rem;
  color: ${({ theme }) => theme?.colors?.textPrimary || '#FFFFFF'};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  font-family: var(--font-roboto-mono), monospace;
`;

const NFTPreviewCollection = styled.span`
  font-size: 0.6875rem;
  color: ${({ theme }) => theme?.colors?.textSecondary || '#A0A0B0'};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--font-roboto-mono), monospace;
`;

const ArrowIcon = styled(IoArrowForward)`
  color: ${({ theme }) => theme?.colors?.primary || '#6745FF'};
  font-size: 1.25rem;
  margin: 0;
  align-self: center;
  
  @media (max-width: 480px) {
    transform: rotate(90deg);
    margin: 0.5rem 0;
  }
`;

const GiveReceiveWrapper = styled.div`
  display: contents;
`;

const ActionButton = styled(EnhancedRippleButton)`
  flex: 1;
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
  height: auto;
`;

const NFTTradeModal: React.FC<NFTTradeModalProps> = ({ isOpen, onClose, nft }) => {
  const { publicKey } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [trades, setTrades] = useState<TradeLoop[]>([]);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<TradeLoop | null>(null);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [executingTradeId, setExecutingTradeId] = useState<string | null>(null);
  const [executionSuccess, setExecutionSuccess] = useState<boolean | null>(null);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);
  // Use a ref to store the current NFT address to prevent issues with closure in useEffect
  const currentNftRef = React.useRef<string | null>(null);
  
  // Clean up state when the modal opens with a new NFT
  useEffect(() => {
    if (isOpen && nft) {
      // Check if we're opening with a different NFT than before
      if (currentNftRef.current !== nft.address) {
        setTrades([]);
        setMessage(null);
        setIsError(false);
        setSelectedTradeId(null);
        setSelectedTrade(null);
        setIsDetailViewOpen(false);
        setRetryCount(0);
        currentNftRef.current = nft.address;
      }
    }
  }, [isOpen, nft]);

  useEffect(() => {
    if (isOpen && publicKey && nft) {
      fetchTrades();
    }
  }, [isOpen, publicKey, nft, retryCount]);

  // Reset the modal state when it's closed
  useEffect(() => {
    if (!isOpen) {
      setSelectedTradeId(null);
      setSelectedTrade(null);
      setIsDetailViewOpen(false);
      currentNftRef.current = null;
    }
  }, [isOpen]);

  // Retry fetch if needed
  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  const fetchTrades = async () => {
    if (!publicKey || !nft) return;
    
    setIsLoading(true);
    setMessage(null);
    setIsError(false);
    setTrades([]);
    
    try {
      const tradeService = TradeService.getInstance();
      
      // Make sure we're using the specific NFT address for this trade search
      console.log(`Searching for trades involving NFT: ${nft.address}`);
      
      const discoveredTrades = await tradeService.findTradeLoops(nft, publicKey.toString());
      
      console.log(`Discovered ${discoveredTrades.length} total trades for NFT: ${nft.address}`);
      console.log('Trade data:', discoveredTrades);
      
      if (discoveredTrades.length > 0) {
        // Ensure we only display trades that involve the specific NFT we clicked on
        const relevantTrades = discoveredTrades.filter(trade => {
          if (!trade.steps || trade.steps.length === 0) return false;
          
          const currentWalletAddress = publicKey.toString();
          
          // Check if this trade involves the current NFT
          const involvesCurrentNFT = trade.steps.some(step => {
            return step.nfts && step.nfts.some(nftItem => nftItem.address === nft.address);
          });
          
          // Check if the user is involved in this trade (either giving or receiving)
          const isUserSender = trade.steps.some(step => step.from === currentWalletAddress);
          const isUserReceiver = trade.steps.some(step => step.to === currentWalletAddress);
          
          // The trade should involve both the current NFT and the user's wallet
          return involvesCurrentNFT && (isUserSender || isUserReceiver);
        });
        
        console.log(`Filtered to ${relevantTrades.length} trades specific to this NFT and user`);
        
        setTrades(relevantTrades);
        
        if (relevantTrades.length > 0) {
          setMessage(`Found ${relevantTrades.length} potential trade ${relevantTrades.length === 1 ? 'opportunity' : 'opportunities'}!`);
        } else {
          setMessage('No direct trade opportunities found for this specific NFT.');
        }
      } else {
        setTrades([]);
        setMessage('No trades available for this NFT currently.');
      }
    } catch (error) {
      console.error('Error finding trades:', error);
      setMessage('Error finding trades. Please try again later.');
      setIsError(true);
      setTrades([]);
    } finally {
      setIsLoading(false);
    }
  };

  const viewTradeDetails = async (tradeId: string) => {
    // Find the trade in the existing trades
    const trade = trades.find(t => t.id === tradeId);
    
    if (trade) {
      console.log('Viewing trade details for:', tradeId);
      setSelectedTradeId(tradeId);
      setSelectedTrade(trade);
      setIsDetailViewOpen(true);
    } else {
      try {
        setIsLoading(true);
        // Try to fetch full trade details from API if needed
        const tradeService = TradeService.getInstance();
        const tradeDetails = await tradeService.getTradeDetails(tradeId);
        
        if (tradeDetails) {
          setSelectedTradeId(tradeId);
          setSelectedTrade(tradeDetails);
          setIsDetailViewOpen(true);
        } else {
          setMessage('Could not load trade details. Please try again.');
          setIsError(true);
        }
      } catch (error) {
        console.error('Error fetching trade details:', error);
        setMessage('Error loading trade details. Please try again.');
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const closeDetailView = () => {
    setIsDetailViewOpen(false);
    setSelectedTradeId(null);
    setSelectedTrade(null);
  };

  const handleAddToWants = async () => {
    if (!publicKey) return;
    
    setIsLoading(true);
    setMessage(null);
    setIsError(false);
    
    try {
      const tradeService = TradeService.getInstance();
      const success = await tradeService.addMultipleWants([nft.address], publicKey.toString());
      
      if (success) {
        // Create pending search event data
        const pendingSearchData: PendingSearchEvent = {
          id: uuidv4(),
          searchedNFT: nft,
          initiatedAt: new Date()
        };
        
        // Dispatch custom event for the main page to catch and add to pendingSearches
        const event = new CustomEvent(PENDING_SEARCH_EVENT, { 
          detail: pendingSearchData,
          bubbles: true 
        });
        document.dispatchEvent(event);
        
        setMessage(`Successfully added ${nft.name} to your wants list! Now searching for trades...`);
        onClose(); // Close modal after adding to wants
      } else {
        setMessage('Failed to add to wants list.');
        setIsError(true);
      }
    } catch (error) {
      console.error('Error adding to wants:', error);
      setMessage('Error adding to wants list. Please try again.');
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Get the NFT the user is giving in a trade
  const getUserNFT = (trade: TradeLoop) => {
    if (!publicKey) return null;
    
    const currentWalletAddress = publicKey.toString();
    
    // Find the step where the user is the sender
    const userSendingStep = trade.steps.find(step => step.from === currentWalletAddress);
    
    if (userSendingStep && userSendingStep.nfts && userSendingStep.nfts.length > 0) {
      return userSendingStep.nfts;
    }
    
    return null;
  };

  // Get the NFT the user is receiving in a trade
  const getReceivingNFT = (trade: TradeLoop) => {
    if (!publicKey) return null;
    
    const currentWalletAddress = publicKey.toString();
    
    // Find the step where the user is the receiver
    const userReceivingStep = trade.steps.find(step => step.to === currentWalletAddress);
    
    if (userReceivingStep && userReceivingStep.nfts && userReceivingStep.nfts.length > 0) {
      return userReceivingStep.nfts;
    }
    
    return null;
  };

  const formatEfficiency = (efficiency: number): string => {
    if (typeof efficiency !== 'number') return 'N/A';
    return `${Math.round(efficiency * 100)}% match`;
  };

  // Execute a trade
  const executeTradeAction = async (tradeId: string) => {
    if (!publicKey) {
      setMessage('Please connect your wallet first');
      setIsError(true);
      return;
    }
    
    setExecutingTradeId(tradeId);
    setExecutionSuccess(null);
    setExecutionMessage(null);
    
    try {
      // Find the trade in our list
      const trade = trades.find(t => t.id === tradeId);
      
      if (!trade) {
        setExecutionMessage('Could not find trade details.');
        setExecutionSuccess(false);
        return;
      }
      
      // Validate the trade has all required information
      if (!trade.steps || trade.steps.length === 0) {
        setExecutionMessage('Invalid trade data: missing steps.');
        setExecutionSuccess(false);
        return;
      }
      
      console.log(`Executing trade: ${tradeId}`);
      
      const tradeService = TradeService.getInstance();
      
      // Call the actual trade execution API method
      const executionResult = await tradeService.executeTradeById(tradeId, publicKey.toString());
      
      if (executionResult.success) {
        setExecutionSuccess(true);
        setExecutionMessage(executionResult.message);
        
        // Remove this trade from the list after successful execution
        setTrades(prev => prev.filter(t => t.id !== tradeId));
        
        // After 3 seconds, close the success message
        setTimeout(() => {
          setExecutingTradeId(null);
          setExecutionSuccess(null);
          setExecutionMessage(null);
        }, 3000);
      } else {
        setExecutionSuccess(false);
        setExecutionMessage(executionResult.message || 'Failed to execute trade.');
      }
    } catch (error) {
      console.error('Error executing trade:', error);
      setExecutionSuccess(false);
      setExecutionMessage('An error occurred during trade execution.');
    } finally {
      // Keep executing trade ID for a moment to show the completion state
      setTimeout(() => {
        setExecutingTradeId(null);
      }, 3000);
    }
  };

  // Render trade details view
  const renderTradeDetailView = () => {
    if (!selectedTrade) return null;

    const userNFTs = getUserNFT(selectedTrade);
    const receivingNFTs = getReceivingNFT(selectedTrade);

    return (
      <ModalOverlay onClick={(e) => e.target === e.currentTarget && closeDetailView()}>
        <ModalContent>
          <ModalHeader>
            <Title>
              <IoSwapHorizontal /> Trade Details
            </Title>
            <CloseButton onClick={closeDetailView}>
              <IoClose />
            </CloseButton>
          </ModalHeader>
          
          <ModalBody>
            <StatusMessage>
              <IoCheckmarkCircle />
              Viewing detailed information for trade #{selectedTrade.id?.substring(0, 8) || 'Unknown'}
            </StatusMessage>
            
            <SectionTitle>Trade Overview</SectionTitle>
            <TradeDetailSection>
              <DetailRow>
                <DetailLabel>Trade ID:</DetailLabel>
                <DetailValue>{selectedTrade.id || 'Unknown'}</DetailValue>
              </DetailRow>
              <DetailRow>
                <DetailLabel>Participants:</DetailLabel>
                <DetailValue>{selectedTrade.totalParticipants || selectedTrade.steps.length}</DetailValue>
              </DetailRow>
              <DetailRow>
                <DetailLabel>Efficiency Score:</DetailLabel>
                <DetailValue>
                  <TradeEfficiency $efficiency={selectedTrade.efficiency * 100}>
                    {formatEfficiency(selectedTrade.efficiency)}
                  </TradeEfficiency>
                </DetailValue>
              </DetailRow>
            </TradeDetailSection>
            
            <SectionTitle>Trade Path</SectionTitle>
            <TradePathSection>
              {selectedTrade.steps.map((step, index) => (
                <TradePathStep key={`step-${index}`}>
                  <WalletAddress>
                    {step.from === publicKey?.toString() ? 'You' : `Wallet ${step.from.substring(0, 6)}...${step.from.substring(step.from.length - 4)}`}
                  </WalletAddress>
                  <ArrowIcon />
                  <WalletAddress>
                    {step.to === publicKey?.toString() ? 'You' : `Wallet ${step.to.substring(0, 6)}...${step.to.substring(step.to.length - 4)}`}
                  </WalletAddress>
                </TradePathStep>
              ))}
            </TradePathSection>
            
            <TradeDetails>
              <TradeColumn>
                <ColumnHeader>
                  <ColumnLabel>You Give</ColumnLabel>
                </ColumnHeader>
                {userNFTs && userNFTs.length > 0 ? (
                  userNFTs.map((nftItem, idx) => (
                    <NFTPreview key={`give-detail-${idx}-${nftItem.address}`}>
                      <SmallNFTImage>
                        <img 
                          src={nftItem.image ? fixImageUrl(nftItem.image, nftItem.address) : '/images/placeholder.png'}
                          alt={nftItem.name}
                          onError={handleImageError}
                        />
                      </SmallNFTImage>
                      <NFTInfo>
                        <NFTPreviewName>{nftItem.name}</NFTPreviewName>
                        <NFTPreviewCollection>
                          {getCollectionName(nftItem.collection, nftItem.name, nftItem.symbol)}
                        </NFTPreviewCollection>
                      </NFTInfo>
                    </NFTPreview>
                  ))
                ) : (
                  <p>No NFTs found</p>
                )}
              </TradeColumn>
              
              <ArrowIcon />
              
              <TradeColumn>
                <ColumnHeader>
                  <ColumnLabel>You Receive</ColumnLabel>
                </ColumnHeader>
                {receivingNFTs && receivingNFTs.length > 0 ? (
                  receivingNFTs.map((nftItem, idx) => (
                    <NFTPreview key={`receive-detail-${idx}-${nftItem.address}`}>
                      <SmallNFTImage>
                        <img 
                          src={nftItem.image ? fixImageUrl(nftItem.image, nftItem.address) : '/images/placeholder.png'}
                          alt={nftItem.name}
                          onError={handleImageError}
                        />
                      </SmallNFTImage>
                      <NFTInfo>
                        <NFTPreviewName>{nftItem.name}</NFTPreviewName>
                        <NFTPreviewCollection>
                          {getCollectionName(nftItem.collection, nftItem.name, nftItem.symbol)}
                        </NFTPreviewCollection>
                      </NFTInfo>
                    </NFTPreview>
                  ))
                ) : (
                  <p>No NFTs found</p>
                )}
              </TradeColumn>
            </TradeDetails>
            
            <ButtonContainer>
              <ActionButton onClick={closeDetailView} variant="outline">
                Back to Trades
              </ActionButton>
              <ActionButton 
                onClick={() => {
                  if (selectedTrade && selectedTrade.id) {
                    closeDetailView();
                    executeTradeAction(selectedTrade.id);
                  }
                }}
                disabled={executingTradeId === selectedTrade?.id}
                loading={executingTradeId === selectedTrade?.id}
              >
                Execute Trade
              </ActionButton>
            </ButtonContainer>
          </ModalBody>
        </ModalContent>
      </ModalOverlay>
    );
  };

  // Render custom "no trades" message with retry option
  const renderNoTradesMessage = () => (
    <NoTradesMessage>
      <div style={{ marginBottom: '1rem' }}>
        No direct trades available for this NFT at the moment.
      </div>
      <ButtonContainer>
        <ActionButton onClick={handleRetry} variant="outline">
          Retry Search
        </ActionButton>
        <ActionButton onClick={handleAddToWants}>
          Add to Wants
        </ActionButton>
      </ButtonContainer>
    </NoTradesMessage>
  );

  const renderTradeList = () => {
    if (trades.length === 0) {
      return renderNoTradesMessage();
    }

    return (
      <TradeListContainer>
        {trades.map((trade, index) => {
          const userNFTs = getUserNFT(trade);
          const receivingNFTs = getReceivingNFT(trade);
          
          // Skip rendering if missing essential data
          if (!userNFTs || !receivingNFTs) {
            console.warn(`Trade ${trade.id || index} missing NFT data, skipping`);
            return null;
          }
          
          const tradeId = trade.id || `trade-${index}`;
          const isExecutingThisTrade = executingTradeId === tradeId;
          
          return (
            <TradeCard key={`trade-${index}-${tradeId}`}>
              <TradeSummary>
                <TradeParticipants>
                  <IoSwapHorizontal />
                  {trade.totalParticipants || trade.steps.length} participant trade loop
                </TradeParticipants>
                <TradeEfficiency $efficiency={trade.efficiency * 100}>
                  {formatEfficiency(trade.efficiency)}
                </TradeEfficiency>
              </TradeSummary>
              
              <TradeDetails>
                <TradeColumn>
                  <ColumnHeader>
                    <ColumnLabel>You Give</ColumnLabel>
                  </ColumnHeader>
                  {userNFTs && userNFTs.length > 0 ? (
                    userNFTs.map((nftItem, idx) => (
                      <NFTPreview key={`give-${idx}-${nftItem.address}`}>
                        <SmallNFTImage>
                          <img 
                            src={nftItem.image ? fixImageUrl(nftItem.image, nftItem.address) : '/images/placeholder.png'}
                            alt={nftItem.name}
                            onError={handleImageError}
                          />
                        </SmallNFTImage>
                        <NFTInfo>
                          <NFTPreviewName>{nftItem.name}</NFTPreviewName>
                          <NFTPreviewCollection>
                            {getCollectionName(nftItem.collection, nftItem.name, nftItem.symbol)}
                          </NFTPreviewCollection>
                        </NFTInfo>
                      </NFTPreview>
                    ))
                  ) : (
                    <p>No NFTs found</p>
                  )}
                </TradeColumn>
                
                <ArrowIcon />
                
                <TradeColumn>
                  <ColumnHeader>
                    <ColumnLabel>You Receive</ColumnLabel>
                  </ColumnHeader>
                  {receivingNFTs && receivingNFTs.length > 0 ? (
                    receivingNFTs.map((nftItem, idx) => (
                      <NFTPreview key={`receive-${idx}-${nftItem.address}`}>
                        <SmallNFTImage>
                          <img 
                            src={nftItem.image ? fixImageUrl(nftItem.image, nftItem.address) : '/images/placeholder.png'}
                            alt={nftItem.name}
                            onError={handleImageError}
                          />
                        </SmallNFTImage>
                        <NFTInfo>
                          <NFTPreviewName>{nftItem.name}</NFTPreviewName>
                          <NFTPreviewCollection>
                            {getCollectionName(nftItem.collection, nftItem.name, nftItem.symbol)}
                          </NFTPreviewCollection>
                        </NFTInfo>
                      </NFTPreview>
                    ))
                  ) : (
                    <p>No NFTs found</p>
                  )}
                </TradeColumn>
              </TradeDetails>
              
              {isExecutingThisTrade && executionMessage && (
                <StatusMessage $isError={!executionSuccess}>
                  {executionSuccess ? <IoCheckmarkCircle /> : <IoAlertCircle />}
                  {executionMessage}
                </StatusMessage>
              )}
              
              <ButtonContainer>
                <ActionButton 
                  onClick={() => viewTradeDetails(tradeId)}
                  variant="outline"
                  disabled={isExecutingThisTrade}
                >
                  View Details
                </ActionButton>
                <ActionButton 
                  onClick={() => executeTradeAction(tradeId)}
                  disabled={isExecutingThisTrade}
                  loading={isExecutingThisTrade}
                >
                  {isExecutingThisTrade ? 'Processing...' : 'Execute Trade'}
                </ActionButton>
              </ButtonContainer>
            </TradeCard>
          );
        }).filter(Boolean)}
      </TradeListContainer>
    );
  };

  const modalContent = (
    <ModalOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ModalContent>
        <ModalHeader>
          <Title>
            <IoSwapHorizontal /> Trade Finder
          </Title>
          <CloseButton onClick={onClose}>
            <IoClose />
          </CloseButton>
        </ModalHeader>
        
        <ModalBody>
          <NFTInfoSection>
            <NFTImageContainer>
              <NFTImage 
                src={fixImageUrl(nft.image || '', nft.address)}
                alt={nft.name}
                onError={handleImageError}
              />
            </NFTImageContainer>
            <NFTDetails>
              <NFTName>{nft.name || 'Untitled NFT'}</NFTName>
              <NFTCollection>{getCollectionName(nft.collection, nft.name, nft.symbol)}</NFTCollection>
              <NFTAddress>{nft.address}</NFTAddress>
            </NFTDetails>
          </NFTInfoSection>
          
          {isLoading ? (
            <LoadingContainer>
              <LoadingSpinner />
              <LoadingText>Scanning trade network...</LoadingText>
            </LoadingContainer>
          ) : (
            <>
              {message && (
                <StatusMessage $isError={isError}>
                  {isError ? <IoAlertCircle /> : <IoCheckmarkCircle />}
                  {message}
                </StatusMessage>
              )}
              
              {trades.length > 0 && (
                <TradeSection>
                  <SectionTitle>
                    <IoSwapHorizontal /> Available Trades ({trades.length})
                  </SectionTitle>
                  {renderTradeList()}
                </TradeSection>
              )}
              
              {trades.length === 0 && !isLoading && !message && renderNoTradesMessage()}
            </>
          )}
        </ModalBody>
      </ModalContent>
    </ModalOverlay>
  );

  if (!isOpen) return null;

  // Use React Portal to render the modal at the document root
  return typeof document !== 'undefined' 
    ? ReactDOM.createPortal(
        <ThemeProvider theme={theme}>
          <div className="nft-trade-modal-container">
            <ModalFontStyle />
            {isDetailViewOpen ? renderTradeDetailView() : modalContent}
          </div>
        </ThemeProvider>,
        document.body
      ) 
    : null;
};

// New styled components for the trade detail view
const TradeDetailSection = styled.div`
  background: rgba(0, 0, 0, 0.1);
  padding: 0.75rem;
  border-radius: 10px;
  margin-bottom: 1rem;
  font-family: var(--font-roboto-mono), monospace;
`;

const DetailRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  align-items: center;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const DetailLabel = styled.span`
  font-size: 0.75rem;
  color: ${({ theme }) => theme?.colors?.textSecondary || '#A0A0B0'};
  font-weight: 500;
  font-family: var(--font-roboto-mono), monospace;
`;

const DetailValue = styled.span`
  font-size: 0.8125rem;
  color: ${({ theme }) => theme?.colors?.textPrimary || '#FFFFFF'};
  text-align: right;
  font-weight: 500;
  font-family: var(--font-roboto-mono), monospace;
`;

const TradePathSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const TradePathStep = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
`;

const WalletAddress = styled.span`
  font-size: 0.75rem;
  font-family: var(--font-roboto-mono), monospace;
  color: ${({ theme }) => theme?.colors?.textPrimary || '#FFFFFF'};
`;

export default NFTTradeModal; 