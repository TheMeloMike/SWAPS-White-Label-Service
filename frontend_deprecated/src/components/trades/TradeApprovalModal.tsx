import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { TradeStep } from '@/types/trade';
import { NFTCard } from '@/components/NFTCard';
import { SmartContractService } from '@/services/smart-contract';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { NFTService } from '@/services/nft';

interface TradeApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (transactionSignature: string) => void;
  tradeLoopAddress: string;
  stepIndex: number;
  step: TradeStep;
  timeout: string; // Formatted timeout string (e.g. "24 hours")
}

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
`;

const ModalContent = styled.div`
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  border: 1px solid ${({ theme }) => theme.colors.surfaceBorder};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  overflow-x: hidden;
  box-shadow: ${({ theme }) => theme.shadows.lg};
  box-sizing: border-box;
  
  @media (max-width: 600px) {
    padding: ${({ theme }) => theme.spacing.md};
    width: 95%;
  }
  
  /* Add internal padding to ensure content doesn't touch edges */
  > * {
    max-width: 100%;
  }
`;

const Title = styled.h2`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  color: ${({ theme }) => theme.colors.error};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  text-align: center;
`;

const WarningBox = styled.div`
  background: ${({ theme }) => `${theme.colors.error}10`};
  border: 1px solid ${({ theme }) => theme.colors.error};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const WarningText = styled.p`
  color: ${({ theme }) => theme.colors.error};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const InfoText = styled.p`
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const TradeDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  margin: ${({ theme }) => theme.spacing.md} 0;
`;

const NFTSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const SectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

const NFTGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  justify-content: center;
  width: 100%;
  
  @media (max-width: 500px) {
    flex-direction: column;
    align-items: center;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: ${({ theme }) => theme.spacing.lg};
  gap: ${({ theme }) => theme.spacing.md};
  
  @media (max-width: 500px) {
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  }
`;

const Button = styled.button<{ $primary?: boolean }>`
  background: ${({ theme, $primary }) => 
    $primary ? theme.colors.primary : 'transparent'};
  color: ${({ theme, $primary }) => 
    $primary ? '#ffffff' : theme.colors.textPrimary};
  border: 1px solid ${({ theme, $primary }) => 
    $primary ? theme.colors.primary : theme.colors.surfaceBorder};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.lg}`};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.normal};
  width: 100%;
  
  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

interface StatusTextProps {
  color?: 'success' | 'error' | 'textSecondary';
}

const StatusText = styled.p<StatusTextProps>`
  text-align: center;
  margin-top: ${({ theme }) => theme.spacing.lg};
  color: ${({ theme, color }) => 
    color && theme.colors[color] ? theme.colors[color] : theme.colors.textSecondary};
`;

const StatusContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: ${({ theme }) => theme.spacing.lg};
  gap: ${({ theme }) => theme.spacing.md};
`;

const TimeoutDisplay = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: ${({ theme }) => theme.spacing.md} 0;
  padding: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => `${theme.colors.warning}10`};
  border: 1px solid ${({ theme }) => theme.colors.warning};
  border-radius: ${({ theme }) => theme.borderRadius.md};
`;

const TimeoutIcon = styled.span`
  margin-right: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.warning};
`;

const TimeoutText = styled.span`
  color: ${({ theme }) => theme.colors.warning};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
`;

const TradeApprovalModal: React.FC<TradeApprovalModalProps> = ({
  isOpen,
  onClose,
  onApprove,
  tradeLoopAddress,
  stepIndex,
  step,
  timeout,
}) => {
  const [status, setStatus] = useState<'idle' | 'verifying' | 'approving' | 'success' | 'error'>('idle');
  const [error, setError] = useState<{
    code?: string;
    message: string;
    type: 'wallet' | 'ownership' | 'program' | 'network' | 'unknown';
    recoverable: boolean;
  } | null>(null);
  const wallet = useWallet();
  const [timeoutCountdown, setTimeoutCountdown] = useState<string>(timeout);
  const [verifyAttempts, setVerifyAttempts] = useState<number>(0);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  
  if (!isOpen) return null;
  
  const handleCancel = () => {
    // Prevent closing during processing unless forced
    if (status === 'verifying' || status === 'approving') {
      const confirmClose = window.confirm('Transaction is in progress. Are you sure you want to close this window?');
      if (!confirmClose) return;
    }
    onClose();
  };
  
  const setErrorState = (message: string, type: 'wallet' | 'ownership' | 'program' | 'network' | 'unknown' = 'unknown', recoverable = true, code?: string) => {
    setError({
      message,
      type,
      recoverable,
      code
    });
    setStatus('error');
  };
  
  const verifyNFTOwnership = async (): Promise<boolean> => {
    if (!wallet.publicKey) {
      setErrorState('Wallet not connected', 'wallet', true);
      return false;
    }
    
    try {
      setStatus('verifying');
      setVerifyAttempts(prev => prev + 1);
      
      // Verify wallet address matches the expected sender
      const walletAddress = wallet.publicKey.toString();
      if (walletAddress !== step.from) {
        setErrorState(
          `Connected wallet (${formatAddress(walletAddress)}) does not match the sender address (${formatAddress(step.from)})`,
          'wallet', 
          true
        );
        return false;
      }
      
      // Get current NFTs owned by the wallet
      const nftService = NFTService.getInstance();
      
      // Add some retry logic for NFT ownership verification
      let attemptCount = 0;
      const maxAttempts = 3;
      let success = false;
      let userNFTs: Array<{ address: string; name?: string }> = [];
      
      while (attemptCount < maxAttempts && !success) {
        try {
          userNFTs = await nftService.getWalletNFTs(walletAddress);
          success = true;
        } catch (err) {
          console.error(`NFT fetch attempt ${attemptCount + 1} failed:`, err);
          attemptCount++;
          
          if (attemptCount >= maxAttempts) {
            throw err;
          }
          
          // Wait before retry with exponential backoff
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attemptCount)));
        }
      }
      
      // Create a Set of NFT addresses for faster lookup
      const userNFTAddresses = new Set(userNFTs.map(nft => nft.address));
      
      // Check if all NFTs in the trade step are still owned by the user
      const missingNFTs = step.nfts.filter(nft => !userNFTAddresses.has(nft.address));
      
      if (missingNFTs.length > 0) {
        const missingNames = missingNFTs.map(nft => nft.name || nft.address).join(', ');
        setErrorState(
          `You no longer own the following NFT(s): ${missingNames}`,
          'ownership',
          false
        );
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Error verifying NFT ownership:', err);
      
      // If we've already tried multiple times and still failing, continue with caution
      if (verifyAttempts >= 2) {
        console.warn('Multiple failures verifying NFT ownership, proceeding with caution');
        return true;
      }
      
      setErrorState(
        'Failed to verify NFT ownership. Please try again.',
        'network',
        true
      );
      return false;
    }
  };
  
  const handleApprove = async () => {
    try {
      // Reset error state if retrying
      setError(null);
      
      // First verify the user still owns the NFTs
      const ownershipVerified = await verifyNFTOwnership();
      if (!ownershipVerified) return;
      
      // Now proceed with the transaction
      setStatus('approving');
      const smartContractService = SmartContractService.getInstance();

      // Approve the trade step on-chain
      const signature = await smartContractService.approveTradeStep(
        new PublicKey(tradeLoopAddress),
        stepIndex,
        wallet
      );
      
      // Set the explorer URL for the signature
      const explorerUrl = `https://explorer.solana.com/tx/${signature}`;
      setSignatureUrl(explorerUrl);
      
      setStatus('success');
      onApprove(signature);
    } catch (err) {
      console.error('Error approving trade:', err);
      
      // Categorize errors
      if (err instanceof Error) {
        const errorMessage = err.message;
        
        // Handle different error types
        if (err.name === 'UserRejectedError' || errorMessage.includes('User rejected') || errorMessage.includes('cancelled') || errorMessage.includes('denied')) {
          setErrorState('Transaction was rejected by wallet', 'wallet', true);
        } else if (errorMessage.includes('insufficient funds')) {
          setErrorState('Insufficient funds for transaction. Make sure you have enough SOL to cover fees.', 'wallet', true);
        } else if (errorMessage.includes('Swap program not found') || errorMessage.includes('Invalid swap program ID')) {
          setErrorState(errorMessage, 'program', false);
        } else if (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('Connection failed')) {
          setErrorState('Network error or timeout. Please try again when connection improves.', 'network', true);
        } else if (errorMessage.includes('blockhash not found') || errorMessage.includes('block height exceeded')) {
          setErrorState('Transaction timed out. Please try again.', 'network', true);
        } else {
          setErrorState(errorMessage, 'unknown', true);
        }
      } else {
        setErrorState('Unknown error occurred', 'unknown', true);
      }
    }
  };
  
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };
  
  // Determine if we should prevent closing by clicking outside
  const isProcessing = status === 'verifying' || status === 'approving';

  // Only allow closing the modal if not processing
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (isProcessing) {
      // Show a warning toast or indicator that closing is not recommended
      e.stopPropagation();
      return;
    }
    handleCancel();
    e.stopPropagation();
  };

  // More detailed instructions for wallet interaction
  const getWalletInstructions = () => {
    if (status === 'approving') {
      return (
        <div style={{ 
          margin: '1rem 0', 
          padding: '0.5rem',
          border: '1px solid #6d66d6',
          borderRadius: '0.5rem',
          backgroundColor: '#6d66d610'
        }}>
          <p style={{ fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>
            Wallet Instructions:
          </p>
          <ol style={{ margin: '0', paddingLeft: '1.2rem' }}>
            <li>A transaction approval window should appear in your wallet</li>
            <li>Review the transaction details</li>
            <li>Approve the transaction to continue</li>
            <li>Wait for confirmation (this may take a few seconds)</li>
          </ol>
        </div>
      );
    }
    return null;
  };
  
  // Calculate and update the remaining time
  useEffect(() => {
    // This is just a mock countdown - in a real implementation we would get the actual 
    // expiration timestamp from the trade loop data and calculate the remaining time
    
    // Check if we should update the countdown
    if (isOpen && status !== 'success' && status !== 'error') {
      // For now, just use the provided timeout string
      setTimeoutCountdown(timeout);
      
      // In a real implementation, we would set up an interval to update the countdown:
      // const interval = setInterval(() => {
      //   // Calculate remaining time
      //   const now = new Date();
      //   const remaining = expiresAt.getTime() - now.getTime();
      //   
      //   if (remaining <= 0) {
      //     setTimeoutCountdown('Expired');
      //     clearInterval(interval);
      //   } else {
      //     // Format the remaining time
      //     const hours = Math.floor(remaining / (1000 * 60 * 60));
      //     const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      //     const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
      //     setTimeoutCountdown(`${hours}h ${minutes}m ${seconds}s`);
      //   }
      // }, 1000);
      // 
      // return () => clearInterval(interval);
    }
  }, [isOpen, timeout, status]);
  
  return (
    <ModalOverlay onClick={handleOverlayClick}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <Title>Final Trade Approval</Title>
        
        <WarningBox>
          <WarningText>⚠️ This action cannot be reversed!</WarningText>
          <WarningText>
            By approving this trade, you are entering into a binding agreement to trade your NFTs.
          </WarningText>
          <WarningText>
            Once approved, the trade will execute when all participants approve or expire after {timeout}.
          </WarningText>
        </WarningBox>
        
        <TimeoutDisplay>
          <TimeoutIcon>⏱️</TimeoutIcon>
          <TimeoutText>Trade will expire in: {timeoutCountdown}</TimeoutText>
        </TimeoutDisplay>
        
        <InfoText>
          Please review the trade details carefully before approving:
        </InfoText>
        
        <TradeDetails>
          <NFTSection>
            <SectionTitle>You will send:</SectionTitle>
            <NFTGrid>
              {step.nfts.map((nft) => (
                <NFTCard 
                  key={nft.address}
                  nft={nft}
                />
              ))}
            </NFTGrid>
          </NFTSection>
          
          <InfoText>
            <strong>To:</strong> {formatAddress(step.to)}
          </InfoText>
          
          <InfoText>
            <strong>Part of Trade Loop:</strong> {formatAddress(tradeLoopAddress)}
          </InfoText>
        </TradeDetails>
        
        {/* Add warning when trying to close during processing */}
        {isProcessing && (
          <InfoText style={{ 
            color: '#FFD166', // Use the warning color directly
            marginTop: '1rem'  // Use a direct value for spacing
          }}>
            Please wait for the transaction to complete. Do not close this window.
          </InfoText>
        )}
        
        {status === 'idle' && (
          <ButtonContainer>
            <Button onClick={handleCancel}>Cancel</Button>
            <Button $primary onClick={handleApprove}>
              I Understand - Approve Trade
            </Button>
          </ButtonContainer>
        )}
        
        {status === 'verifying' && (
          <StatusContainer>
            <StatusText>
              Verifying NFT ownership...
            </StatusText>
          </StatusContainer>
        )}
        
        {status === 'approving' && (
          <StatusContainer>
            <StatusText>
              Approving trade... Confirm the transaction in your wallet.
            </StatusText>
            {getWalletInstructions()}
          </StatusContainer>
        )}
        
        {status === 'success' && (
          <StatusContainer>
            <StatusText color="success">
              Trade approved successfully! The NFTs will be exchanged when all participants approve.
            </StatusText>
            {signatureUrl && (
              <InfoText>
                <a 
                  href={signatureUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ 
                    color: 'inherit', 
                    textDecoration: 'underline',
                    marginLeft: '0.25rem'
                  }}
                >
                  View transaction on Solana Explorer
                </a>
              </InfoText>
            )}
            <Button onClick={onClose}>Close</Button>
          </StatusContainer>
        )}
        
        {status === 'error' && error && (
          <StatusContainer>
            <StatusText color="error">
              {error.type === 'wallet' && '👛 Wallet Error: '}
              {error.type === 'ownership' && '🔒 Ownership Error: '}
              {error.type === 'program' && '📜 Program Error: '}
              {error.type === 'network' && '🌐 Network Error: '}
              {error.type === 'unknown' && '❓ Error: '}
              {error.message}
            </StatusText>
            
            {error.recoverable ? (
              <ButtonContainer>
                <Button onClick={handleCancel}>Cancel</Button>
                <Button $primary onClick={handleApprove}>
                  Try Again
                </Button>
              </ButtonContainer>
            ) : (
              <Button onClick={handleCancel}>Close</Button>
            )}
          </StatusContainer>
        )}
      </ModalContent>
    </ModalOverlay>
  );
};

export default TradeApprovalModal; 