import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { NFTMetadata } from '@/types/nft';
import { TradeStep } from '@/types/trade';
import { NFTCard } from '@/components/NFTCard';
import TradeImpactCard from '@/components/TradeImpactCard';
import { useWallet } from '@solana/wallet-adapter-react';
import { TransactionService } from '@/services/transaction';
import TradeApprovalModal from './TradeApprovalModal';
import { SmartContractService } from '@/services/smart-contract';
import { PublicKey } from '@solana/web3.js';
import { DefaultTheme } from 'styled-components';
import ErrorMessage from '@/components/common/ErrorMessage';
import LoadingIndicator from '@/components/common/LoadingIndicator';
import { useToastMessage } from '@/utils/context/ToastContext';
import { isUserRejection } from '@/utils/errors/errorHandler';
import { fixImageUrl, handleImageError, createDataURIPlaceholder } from '@/utils/imageUtils';
import { TradeService } from '@/services/trade';
import { getCollectionName } from '@/utils/nftUtils';

const FlowContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.surfaceBorder};
  margin: ${({ theme }) => theme.spacing.xs} 0;
  box-shadow: ${({ theme }) => theme.shadows.md};
  position: relative;
  width: 100%;
  box-sizing: border-box;
  overflow: visible;
  max-width: 100%;
  
  @media (max-width: 640px) {
    padding: ${({ theme }) => theme.spacing.sm};
    gap: ${({ theme }) => theme.spacing.sm};
  }
`;

const TradeHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  
  h3 {
    font-size: ${({ theme }) => theme.typography.fontSize.lg};
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
    margin: 0;
    background: linear-gradient(
      90deg, 
      ${({ theme }) => theme.colors.gradientStart}, 
      ${({ theme }) => theme.colors.gradientEnd}
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  
  @media (max-width: 480px) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
  
  @media (max-width: 480px) {
    width: 100%;
    justify-content: flex-start;
  }
`;

const ActionButton = styled.button`
  background: linear-gradient(
    90deg, 
    ${({ theme }) => theme.colors.gradientStart}, 
    ${({ theme }) => theme.colors.gradientEnd}
  );
  color: white;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.normal};
  border: none;
  box-shadow: ${({ theme }) => theme.shadows.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 140px;
  
  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: ${({ theme }) => theme.shadows.md};
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  
  &.success {
    background: ${({ theme }) => theme.colors.success};
    box-shadow: none;
  }
`;

const RejectButton = styled.button`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background-color: ${({ theme }) => theme.colors.backgroundSecondary};
  border: 1px solid ${({ theme }) => theme.colors.error};
  color: ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.normal};
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background-color: rgba(255, 0, 0, 0.05);
  }
`;

const EfficiencyBadge = styled.div<{ $efficiency: number }>`
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ $efficiency, theme }) => 
    $efficiency >= 0.8 ? theme.colors.success :
    $efficiency >= 0.5 ? theme.colors.warning :
    theme.colors.error
  };
`;

const TradeContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  width: 100%;
  box-sizing: border-box;
  max-width: 100%;
  
  @media (max-width: 640px) {
    gap: ${({ theme }) => theme.spacing.md};
  }
`;

const TradeLoopContainer = styled.div`
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.surfaceBorder};
  width: 100%;
  box-sizing: border-box;
  overflow-x: auto;
  max-width: 100%;
  
  @media (max-width: 640px) {
    padding: ${({ theme }) => theme.spacing.sm};
  }
`;

const StepsContainer = styled.div<{ $isVisible: boolean }>`
  display: ${({ $isVisible }) => $isVisible ? 'flex' : 'none'};
  flex-direction: column;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.md};
  position: relative;
  width: 100%;
  box-sizing: border-box;

  > div:last-child {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.md};
    width: 100%;
    flex-wrap: wrap;
  }
`;

const NFTCardContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.sm};
  position: relative;
  z-index: 1;
  width: 200px;
  
  > div {
    width: 100%;
    height: 200px;
  }
`;

const ArrowContainer = styled.div<{ $isReturn?: boolean }>`
  display: flex;
  align-items: center;
  color: #6d66d6;
  
  ${({ $isReturn }) => !$isReturn && `
    padding: 0 ${({ theme }: { theme: DefaultTheme }) => theme.spacing.xs};
    
    svg {
      width: 24px;
      height: 24px;
    }
  `}

  ${({ $isReturn, theme }: { $isReturn?: boolean; theme: DefaultTheme }) => $isReturn && `
    position: absolute;
    top: 0;
    right: 0;
    width: 0;

    &::before {
      content: '';
      position: absolute;
      right: 0;
      top: 0;
      width: 2px;
      height: 50px;
      background: #6d66d6;
    }

    &::after {
      content: '';
      position: absolute;
      right: 0;
      top: 0;
      width: 100%;
      height: 2px;
      background: #6d66d6;
    }

    &::nth-child(1) {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      width: 2px;
      height: 50px;
      background: #6d66d6;
    }

    svg {
      position: absolute;
      left: 0;
      top: 38px;
      width: 24px;
      height: 24px;
      transform: rotate(90deg);
    }
  `}
`;

const TradeOpportunityTitle = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-bottom: ${({ theme }: { theme: DefaultTheme }) => theme.spacing.md};

  h3 {
    color: #6d66d6;
    font-size: ${({ theme }: { theme: DefaultTheme }) => theme.typography.fontSize.lg};
    margin: 0;
  }
`;

const AddressText = styled.span`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
  display: block;
  text-align: center;
`;

const ExecuteButtonContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.md};
  justify-content: center;
`;

const ErrorMessageContainer = styled.div`
  background-color: ${({ theme }) => theme.colors.error}15;
  color: ${({ theme }) => theme.colors.error};
  padding: ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  margin-top: ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  text-align: center;
`;

const SuccessMessage = styled.div`
  background-color: ${({ theme }) => theme.colors.success}20;
  color: ${({ theme }) => theme.colors.success};
  padding: ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  margin-top: ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  text-align: center;
  
  a {
    color: ${({ theme }) => theme.colors.primary};
    margin-left: ${({ theme }) => theme.spacing.xs};
    text-decoration: underline;
  }
`;

const ToggleButton = styled.button`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: 1px solid ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.primary};
  background: transparent;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.normal};
  
  &:hover {
    background: ${({ theme }) => theme.colors.primary}10;
  }
`;

const ReturnArrow = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
  z-index: 5;
`;

const StepCardContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow-x: auto;
  padding-bottom: ${({ theme }) => theme.spacing.md}; /* Space for potential scrollbar */
`;

const StepsRow = styled.div`
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-start;
  justify-content: center;
  margin: ${({ theme }) => theme.spacing.md} 0;
  min-width: min-content; /* Ensure cards don't shrink too much */
  padding: 0 ${({ theme }) => theme.spacing.xs};
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const StepCardWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 1px 8px;
  height: 100%;
`;

const StepCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.sm};
  min-width: 200px;
  max-width: 220px;
  min-height: 380px;
  box-sizing: border-box;
  position: relative;
  border: 1px solid ${({ theme }) => theme.colors.surfaceBorder};
  overflow: hidden;
`;

const ParticipantInfo = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing.xs};
  border-bottom: 1px solid ${({ theme }) => theme.colors.surfaceBorder};
  padding-bottom: ${({ theme }) => theme.spacing.xs};
  min-height: 70px; /* Reduced height for participant info section */
  justify-content: center;
`;

const ParticipantLabel = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const DirectionText = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

const CollectionName = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-top: 2px;
`;

const NFTPreviewContainer = styled.div`
  width: 100%;
  margin: ${({ theme }) => theme.spacing.xs} 0;
  display: flex;
  flex-direction: column;
  min-height: 280px;
`;

const NFTPreview = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  transition: transform ${({ theme }) => theme.transitions.normal};

  &:hover {
    transform: scale(1.03);
  }
`;

const NFTPreviewImage = styled.img<{ $highlight?: boolean }>`
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 0.5rem;
  border: ${props => props.$highlight ? '2px solid #6d66d6' : 'none'};
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
  
  &#last-nft, &#first-nft {
    border: 2px solid #6d66d6;
    box-shadow: 0 0 10px rgba(109, 102, 214, 0.6);
  }
  
  &:hover {
    transform: scale(1.03);
  }
`;

const NFTPreviewName = styled.div`
  padding: ${({ theme }) => theme.spacing.xs} 0;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
`;

const ActionIndicator = styled.div<{ $active?: boolean }>`
  position: relative;
  margin-top: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  background-color: ${({ $active, theme }) => 
    $active ? theme.colors.error + '20' : theme.colors.success + '20'};
  color: ${({ $active, theme }) => 
    $active ? theme.colors.error : theme.colors.success};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  border: 1px solid ${({ $active, theme }) => 
    $active ? theme.colors.error + '50' : theme.colors.success + '50'};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  text-align: center;
  width: 80%;
  min-width: 80px;
`;

const StepArrow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.primary};
  margin: 0 4px;
  z-index: 1;
  align-self: center;
  
  svg {
    width: 24px;
    height: 24px;
    stroke-width: 2px;
  }
  
  @media (max-width: 640px) {
    transform: rotate(90deg);
    margin: ${({ theme }) => theme.spacing.xs} 0;
  }
`;

const SectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.colors.textPrimary};
  align-self: flex-start;
`;

const NFTInfoDisplay = styled.div`
  text-align: center;
  width: 100%;
`;

const YouLabel = styled.span`
  background: linear-gradient(
    90deg, 
    ${({ theme }) => theme.colors.gradientStart}, 
    ${({ theme }) => theme.colors.gradientEnd}
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
`;

interface TradeFlowProps {
  steps: TradeStep[];
  efficiency: number;
  id: string;
  onReject: () => void;
}

export const TradeFlow = ({ steps, efficiency, id, onReject }: TradeFlowProps): JSX.Element => {
  const wallet = useWallet();
  const { publicKey } = wallet;
  const toast = useToastMessage();
  const [showParticipants, setShowParticipants] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalStep, setApprovalStep] = useState<any | null>(null);
  const [tradeLoopAddress, setTradeLoopAddress] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isExecuted, setIsExecuted] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);

  // Comprehensive debug logging of the trade loop
  console.log('DEBUG - TRADE LOOP:', {
    steps,
    userWallet: publicKey?.toString()
  });

  // Update the useEffect with proper typing and better error handling
  useEffect(() => {
    if (showParticipants && steps.length > 1) {
      // Use a more reliable approach with intersection observer to ensure elements are in the DOM
      const observer = new IntersectionObserver((entries) => {
        // Only proceed if the first and last NFT elements are visible
        if (entries.some(entry => entry.isIntersecting)) {
          // Wait a small amount of time to ensure all layout calculations are done
          setTimeout(() => {
            try {
              const firstNFT = document.getElementById('first-nft');
              const lastNFT = document.getElementById('last-nft');
              const arrowPath = document.getElementById('return-arrow-path');
              
              if (!firstNFT || !lastNFT || !arrowPath) {
                console.warn('Arrow elements not found in DOM');
                return;
              }
              
              // Get the positions of the first and last NFT cards
              const firstRect = firstNFT.getBoundingClientRect();
              const lastRect = lastNFT.getBoundingClientRect();
              
              // Get the container element to compute relative positions
              const container = firstNFT.closest('.trades-container') || document.body;
              const containerRect = container.getBoundingClientRect();
              
              // Calculate the positions relative to the container
              const firstTop = firstRect.top - containerRect.top;
              const firstLeft = firstRect.left - containerRect.left + (firstRect.width / 2);
              const lastTop = lastRect.top - containerRect.top;
              const lastRight = lastRect.right - containerRect.left;
              const lastCenter = lastTop + (lastRect.height / 2);
              
              // Set a very small vertical offset
              const verticalOffset = 10;
              
              // Create the SVG path with precise measurements
              // The path goes from the right edge of the last NFT, up and left to above the first NFT, then down to the first NFT
              const pathDescription = 
                "M " + lastRight + "," + lastCenter + " " +
                "L " + (lastRight + 20) + "," + lastCenter + " " +
                "L " + (lastRight + 20) + "," + (firstTop - verticalOffset) + " " +
                "L " + firstLeft + "," + (firstTop - verticalOffset) + " " +
                "L " + firstLeft + "," + firstTop;
              
              // Update the path
              arrowPath.setAttribute('d', pathDescription);
              arrowPath.setAttribute('stroke', '#6d66d6'); // Match the purple color of other arrows
              
              // Find and update all polygon elements within markers to match the color
              const markers = document.querySelectorAll('#arrowhead polygon');
              markers.forEach(marker => {
                marker.setAttribute('fill', '#6d66d6');
              });
              
              console.log('Arrow path updated successfully');
            } catch (err) {
              console.error('Error updating arrow:', err);
            }
          }, 100); // Small delay to ensure layout is stabilized
        }
      });
      
      // Start observing both first and last NFT elements
      const firstNFT = document.getElementById('first-nft');
      const lastNFT = document.getElementById('last-nft');
      
      if (firstNFT) observer.observe(firstNFT);
      if (lastNFT) observer.observe(lastNFT);
      
      // Clean up observer on unmount or when dependencies change
      return () => {
        observer.disconnect();
      };
    }
    // Return empty cleanup function if condition is not met
    return () => {};
  }, [showParticipants, steps.length]);

  // Log all NFT ownership data for debugging
  console.log('DEBUG - All NFTs in trade loop:', steps.map(step => ({
    from: step.from,
    to: step.to,
    fromIsUser: step.from === publicKey?.toString(),
    toIsUser: step.to === publicKey?.toString(),
    nfts: step.nfts.map(nft => ({
      name: nft.name,
      address: nft.address,
      owner: nft.owner,
      ownerIsUser: nft.owner === publicKey?.toString(),
    }))
  })));

  // Find steps where the user is involved
  const userSendingStep = steps.find(step => step.from === publicKey?.toString());
  const userReceivingStep = steps.find(step => step.to === publicKey?.toString());
  
  // === Log steps data before determining userNFT/receivingNFT ===
  console.log('[TradeFlow] Steps data for user determination:', JSON.stringify(steps.map(s => ({ 
    from: s.from, 
    to: s.to, 
    nftName: s.nfts[0]?.name,
    nftImage: s.nfts[0]?.image, 
    nftAddress: s.nfts[0]?.address
  })), null, 2));
  // === End logging ===
  
  // Determine which NFTs the user is sending and receiving
  let userNFT: NFTMetadata | null = null;
  let receivingNFT: NFTMetadata | null = null;
  
  // With backend sending properly ordered trade loops:
  // - First step should always be the user sending their NFT
  // - Last step should always be another wallet sending the final NFT to the user
  
  // Get user's NFT (what they're sending)
  if (steps.length > 0 && steps[0].from === publicKey?.toString() && steps[0].nfts.length > 0) {
    userNFT = steps[0].nfts[0];
    console.log('User is sending:', userNFT.name);
  } else if (userSendingStep && userSendingStep.nfts.length > 0) {
    // Fallback if steps aren't in expected order
    userNFT = userSendingStep.nfts[0];
    console.log('Fallback - User is sending:', userNFT?.name);
  }
  
  // Get the NFT user is receiving (should be the last step)
  if (steps.length > 0 && steps[steps.length - 1].to === publicKey?.toString() && steps[steps.length - 1].nfts.length > 0) {
    receivingNFT = steps[steps.length - 1].nfts[0];
    console.log('User is receiving (last step):', receivingNFT.name);
  } else if (userReceivingStep && userReceivingStep.nfts.length > 0) {
    // Fallback if steps aren't in expected order
    receivingNFT = userReceivingStep.nfts[0];
    console.log('Fallback - User is receiving:', receivingNFT?.name);
  }
  
  // Debug trade info
  console.log('Trade Flow NFTs:', {
    sending: userNFT?.name || 'none',
    receiving: receivingNFT?.name || 'none',
    stepCount: steps.length,
    isSequential: steps.length > 1 && steps[0].from === publicKey?.toString() && steps[steps.length-1].to === publicKey?.toString(),
    allSteps: steps.map(s => ({ 
      from: s.from.substring(0,8), 
      to: s.to.substring(0,8), 
      nft: s.nfts[0]?.name || 'unknown',
      isUserSender: s.from === publicKey?.toString(),
      isUserReceiver: s.to === publicKey?.toString()
    }))
  });

  // Handle trade execution
  const handleExecuteTrade = async () => {
    if (!publicKey) {
      toast.error("Wallet not connected or you are not part of this trade");
      return;
    }

    // Find the step where user is the sender based on wallet address
    if (!userSendingStep) {
      toast.error("You are not a sender in this trade loop");
      return;
    }

    try {
      setIsExecuting(true);
      setTxError(null); // Clear any previous errors

      // Create the trade loop on-chain first
      const smartContractService = SmartContractService.getInstance();
      
      // Create a 32-byte trade ID by hashing the input ID
      const tradeIdBytes = Buffer.from(id);
      const hash = require('crypto').createHash('sha256');
      hash.update(tradeIdBytes);
      const tradeId = hash.digest(); // This will be exactly 32 bytes
      
      const [tradeLoopAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from('trade_loop'), tradeId],
        new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || '')
      );
      
      // Create the trade loop with all steps
      const createTxSignature = await smartContractService.createTradeLoop(
        tradeId,
        steps.length,
        24 * 60 * 60, // 24 hours timeout
        wallet
      );
      
      console.log(`Created trade loop with signature: ${createTxSignature}`);
      toast.success("Trade loop created successfully");

      // Add each step to the trade loop
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        try {
          const stepTxSignature = await smartContractService.addTradeStep(
            tradeLoopAddress,
            i,
            new PublicKey(step.to),
            step.nfts.map(nft => new PublicKey(nft.address)),
            wallet
          );
          console.log(`Added step ${i} with signature: ${stepTxSignature}`);
        } catch (stepErr) {
          // If a step fails, log it but continue with other steps
          console.error(`Error adding step ${i}:`, stepErr);
          
          // Only throw if it's not a user rejection
          if (!isUserRejection(stepErr)) {
            throw stepErr;
          } else {
            // If user rejected, exit the flow
            setIsExecuting(false);
            return;
          }
        }
      }

      // Open the approval modal for the user's step
      const stepIndex = steps.findIndex(s => s.from === userSendingStep.from && s.to === userSendingStep.to);
      setApprovalStep({ step: userSendingStep, index: stepIndex });
      setTradeLoopAddress(tradeLoopAddress.toString());
      setApprovalModalOpen(true);
    } catch (err) {
      console.error("Error creating trade loop:", err);
      
      // If the user rejected the transaction, just reset to idle state without error
      if (isUserRejection(err)) {
        setIsExecuting(false);
        return;
      }
      
      // For all other errors, show the error state
      setIsExecuting(false);
      
      // Provide a more user-friendly error message
      let errorMessage = "Failed to create trade loop";
      if (err instanceof Error) {
        // Parse for known error types and provide better messages
        const message = err.message.toLowerCase();
        if (message.includes('insufficient funds')) {
          errorMessage = "Insufficient funds to complete this transaction";
        } else if (message.includes('timeout') || message.includes('network')) {
          errorMessage = "Network error. Please check your connection and try again";
        } else if (message.includes('account not found') || message.includes('program not found')) {
          errorMessage = "Smart contract issue. Please try again later"; 
        } else {
          errorMessage = err.message;
        }
      }
      
      setTxError(errorMessage);
      
      // Show toast message for errors
      toast.error(errorMessage);
    }
  };

  // Helper function to format wallet addresses
  const formatWalletAddress = (address: string): React.ReactNode => {
    if (!address) return '';
    if (address === publicKey?.toString()) return <YouLabel>You</YouLabel>;
    return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
  };

  // Handle successful approval
  const handleApprovalSuccess = (transactionSignature: string) => {
    setIsExecuted(true);
    setTxSuccess(transactionSignature);
    
    // Show success toast
    toast.success("Trade executed successfully!");
    
    setTimeout(() => {
      setApprovalModalOpen(false);
      setApprovalStep(null);
    }, 3000);
  };

  // Render transaction error if any
  const renderTransactionError = () => {
    if (isExecuting && txError) {
      return (
        <ErrorMessage 
          error={new Error(txError)} 
          onRetry={handleExecuteTrade}
          showDetails={false} // Hide technical details from users
        />
      );
    }
    return null;
  };

  // Calculate number of steps involving the user's wallet
  const walletStepsCount = steps.filter(
    step => step.from === publicKey?.toString() || step.to === publicKey?.toString()
  ).length;

  // Function to render different states of the execute button
  const renderExecuteButton = () => {
    if (isExecuting) {
      return (
        <ActionButton disabled>
          <LoadingIndicator size="small" color="white" />
          <span style={{ marginLeft: '0.5rem' }}>Executing Trade...</span>
        </ActionButton>
      );
    }
    
    if (isExecuted) {
      return (
        <ActionButton disabled className="success">
          Trade Executed Successfully!
        </ActionButton>
      );
    }
    
    return (
      <ActionButton onClick={handleExecuteTrade}>
        Execute Trade
      </ActionButton>
    );
  };

  // Render transaction success if any
  const renderTransactionSuccess = () => {
    if (isExecuted && txSuccess) {
      return (
        <SuccessMessage>
          Transaction confirmed: 
          <a 
            href={`https://explorer.solana.com/tx/${txSuccess}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Explorer
          </a>
        </SuccessMessage>
      );
    }
    return null;
  };

  // Helper function for NFT images that handles null/undefined images
  const getNFTImageUrl = (nft: NFTMetadata | undefined) => {
    if (!nft) {
      return createDataURIPlaceholder('NFT');
    }
    
    // First check if we have a problematic daswebs.xyz URL with Shadow Drive content
    if (nft.image && nft.image.includes('daswebs.xyz') && nft.image.includes('shdw-drive.genesysgo.net')) {
      // Extract the Shadow Drive URL directly
      const shadowMatch = nft.image.match(/shdw-drive\.genesysgo\.net\/([^\/\s"']+)\/([^\/\s"']+)/i);
      if (shadowMatch && shadowMatch[1] && shadowMatch[2]) {
        const storageAccount = shadowMatch[1];
        const fileName = shadowMatch[2];
        // Use the direct Shadow Drive URL
        console.log(`Fixed Shadow Drive URL for ${nft.address}: https://shdw-drive.genesysgo.net/${storageAccount}/${fileName}`);
        return `https://shdw-drive.genesysgo.net/${storageAccount}/${fileName}`;
      }
    }
    
    // Always use the mint address if available
    if (nft.address) {
      return fixImageUrl(nft.image || '', nft.address);
    }
    
    // Fallback to just the image URL (should rarely happen with valid NFTs)
    return nft.image ? fixImageUrl(nft.image, nft.address) : createDataURIPlaceholder(nft.name);
  };

  return (
    <FlowContainer>
      <TradeHeader>
        <h3>Trade Opportunity</h3>
        <HeaderActions>
          <ToggleButton onClick={() => setShowParticipants(!showParticipants)}>
            {showParticipants ? 'Hide Participants' : 'Show Participants'}
          </ToggleButton>
          <EfficiencyBadge $efficiency={efficiency}>
            {Math.round(efficiency * 100)}% Trade Quality
          </EfficiencyBadge>
          <RejectButton onClick={onReject}>Reject</RejectButton>
        </HeaderActions>
      </TradeHeader>

      {/* Keep Trade Impact Card to show user's perspective */}
      {publicKey && (
        <TradeImpactCard
          userNFT={userNFT}
          receivingNFT={receivingNFT}
          onReject={onReject}
          onExecute={handleExecuteTrade}
        />
      )}

      {/* Trade Flow Steps (shown when expanded) */}
      <StepsContainer $isVisible={showParticipants}>
        <SectionTitle>Trade Flow</SectionTitle>
        
        <StepCardContainer>
          <StepsRow>
            {/* Render trade steps in their sequential order from the backend */}
            {(() => {
              // Log steps for debugging
              console.log('Trade steps from backend (should be in sequential order):', steps.map(s => 
                `${s.from.substring(0,4)}→${s.to.substring(0,4)} (${s.nfts[0]?.name || 'unknown'})`
              ));

              // These steps should already be in the correct order from backend reordering
              // First step: User sending their NFT
              // Middle steps: Sequential trades
              // Last step: User receiving their NFT
              
              return steps.map((step, index, array) => {
                const isUserSender = step.from === publicKey?.toString();
                const isUserReceiver = step.to === publicKey?.toString();
                const isFirstStep = index === 0; 
                const isLastStep = index === array.length - 1;
                
                return (
                  <React.Fragment key={`${step.from}-${step.to}-${index}`}>
                    <StepCardWrapper>
                      <StepCard>
                        <ParticipantInfo>
                          <ParticipantLabel>
                            {index + 1}. {formatWalletAddress(step.from)}
                          </ParticipantLabel>
                          <DirectionText>Sends to</DirectionText>
                          <ParticipantLabel>
                            {formatWalletAddress(step.to)}
                          </ParticipantLabel>
                        </ParticipantInfo>
                        
                        <NFTPreviewContainer>
                          {step.nfts.map((nft) => (
                            <div key={nft.address}>
                              <NFTPreview>
                                <NFTPreviewImage 
                                  id={isFirstStep ? "first-nft" : isLastStep ? "last-nft" : undefined}
                                  src={getNFTImageUrl(nft)}
                                  alt={nft.name}
                                  data-mint-address={nft.address}
                                  data-collection={getCollectionName(nft.collection, nft.name)}
                                  onError={handleImageError}
                                  $highlight={isFirstStep || isLastStep}
                                />
                              </NFTPreview>
                              <NFTPreviewName>{nft.name || 'Unknown NFT'}</NFTPreviewName>
                              <CollectionName>{getCollectionName(nft.collection, nft.name)}</CollectionName>
                            </div>
                          ))}
                        </NFTPreviewContainer>
                      </StepCard>
                      
                      {/* Action indicators outside the cards */}
                      {isUserSender ? (
                        <ActionIndicator $active>Giving</ActionIndicator>
                      ) : isUserReceiver ? (
                        <ActionIndicator>Receiving</ActionIndicator>
                      ) : null}
                    </StepCardWrapper>
                    
                    {/* Add arrows between steps */}
                    {index < array.length - 1 && (
                      <StepArrow>
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </StepArrow>
                    )}
                  </React.Fragment>
                );
              });
            })()}
          </StepsRow>
        </StepCardContainer>
        
        {/* Return arrow for visual loop representation - works with reordered steps because it uses ID markers */}
        <ReturnArrow>
          <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" />
              </marker>
            </defs>
            <path
              id="return-arrow-path"
              d=""
              fill="none"
              stroke="#6d66d6"
              strokeWidth="2"
              strokeDasharray="5,5"
              markerEnd="url(#arrowhead)"
            />
          </svg>
        </ReturnArrow>
      </StepsContainer>

      {/* Transaction status messages */}
      {renderTransactionError()}
      {renderTransactionSuccess()}
      
      {/* Action buttons when applicable - only keep the execute button */}
      {walletStepsCount > 0 && showParticipants && (
        <ExecuteButtonContainer>
          {renderExecuteButton()}
        </ExecuteButtonContainer>
      )}

      {approvalModalOpen && approvalStep && tradeLoopAddress && (
        <TradeApprovalModal
          isOpen={approvalModalOpen}
          onClose={() => setApprovalModalOpen(false)}
          onApprove={handleApprovalSuccess}
          tradeLoopAddress={tradeLoopAddress}
          stepIndex={steps.findIndex(s => s.from === approvalStep.step.from && s.to === approvalStep.step.to)}
          step={approvalStep.step}
          timeout="24 hours"
        />
      )}
    </FlowContainer>
  );
};