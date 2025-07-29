'use client';

import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

interface NFTPreview {
  address: string;
  image?: string;
  name?: string;
  collection?: string;
}

interface WalletScanningLoaderProps {
  isScanning: boolean;
  scanProgress: {
    stage: 'connecting' | 'scanning' | 'indexing' | 'complete';
    nftsFound: number;
    collectionsFound: number;
    estimatedTotal?: number;
  };
  discoveredNFTs: NFTPreview[];
  onComplete?: () => void;
}

const pulse = keyframes`
  0% {
    transform: scale(0.95);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.05);
    opacity: 1;
  }
  100% {
    transform: scale(0.95);
    opacity: 0.7;
  }
`;

const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

const Container = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
`;

const LoaderContent = styled.div`
  max-width: 600px;
  width: 90%;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  backdrop-filter: blur(20px);
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 2rem;
`;

const Title = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: #fff;
  margin: 0 0 0.5rem 0;
`;

const Subtitle = styled.p`
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
`;

const ProgressContainer = styled.div`
  margin: 2rem 0;
`;

const ProgressBar = styled.div`
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
`;

const ProgressFill = styled(motion.div)<{ $isIndeterminate?: boolean }>`
  height: 100%;
  background: linear-gradient(90deg, #00ff88, #00ffff);
  border-radius: 4px;
  position: relative;
  
  ${props => props.$isIndeterminate && `
    width: 100%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 0%,
      rgba(255, 255, 255, 0.3) 50%,
      rgba(255, 255, 255, 0.1) 100%
    );
    background-size: 200% 100%;
    animation: ${shimmer} 1.5s infinite;
  `}
`;

const StageIndicator = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 1rem;
`;

const Stage = styled.div<{ $active: boolean; $completed: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: ${props => props.$completed ? '#00ff88' : props.$active ? '#fff' : 'rgba(255, 255, 255, 0.4)'};
  font-size: 0.8rem;
  
  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${props => props.$completed ? '#00ff88' : props.$active ? '#fff' : 'rgba(255, 255, 255, 0.2)'};
    ${props => props.$active && `animation: ${pulse} 1.5s infinite;`}
  }
`;

const Stats = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin: 2rem 0;
`;

const StatCard = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: 700;
  color: #00ff88;
  margin-bottom: 0.25rem;
`;

const StatLabel = styled.div`
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
`;

const NFTPreviewGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 0.5rem;
  margin-top: 2rem;
  max-height: 200px;
  overflow-y: auto;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }
`;

const NFTPreviewItem = styled(motion.div)`
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  
  &:hover {
    transform: scale(1.05);
    box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
  }
`;

const NFTImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const NFTPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
`;

const CompleteMessage = styled(motion.div)`
  text-align: center;
  padding: 2rem;
`;

const CompleteIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 1rem;
`;

export const WalletScanningLoader: React.FC<WalletScanningLoaderProps> = ({
  isScanning,
  scanProgress,
  discoveredNFTs,
  onComplete
}) => {
  const [showComplete, setShowComplete] = useState(false);
  
  useEffect(() => {
    if (scanProgress.stage === 'complete' && !showComplete) {
      setShowComplete(true);
      setTimeout(() => {
        onComplete?.();
      }, 2000);
    }
  }, [scanProgress.stage, showComplete, onComplete]);

  const getStageMessage = () => {
    switch (scanProgress.stage) {
      case 'connecting':
        return 'Connecting to your wallet...';
      case 'scanning':
        return `Scanning your NFTs... Found ${scanProgress.nftsFound} so far`;
      case 'indexing':
        return 'Analyzing your collection...';
      case 'complete':
        return 'Scan complete!';
    }
  };

  const getProgress = () => {
    if (scanProgress.stage === 'connecting') return 0;
    if (scanProgress.stage === 'complete') return 100;
    if (scanProgress.estimatedTotal && scanProgress.estimatedTotal > 0) {
      return Math.min(95, (scanProgress.nftsFound / scanProgress.estimatedTotal) * 100);
    }
    return null; // Indeterminate
  };

  const progress = getProgress();

  return (
    <AnimatePresence>
      {isScanning && (
        <Container
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <LoaderContent>
            {!showComplete ? (
              <>
                <Header>
                  <Title>Discovering Your NFTs</Title>
                  <Subtitle>{getStageMessage()}</Subtitle>
                </Header>

                <ProgressContainer>
                  <ProgressBar>
                    <ProgressFill
                      initial={{ width: 0 }}
                      animate={{ width: progress !== null ? `${progress}%` : '100%' }}
                      transition={{ duration: 0.3 }}
                      $isIndeterminate={progress === null}
                    />
                  </ProgressBar>
                  
                  <StageIndicator>
                    <Stage 
                      $active={scanProgress.stage === 'connecting'} 
                      $completed={['scanning', 'indexing', 'complete'].includes(scanProgress.stage)}
                    >
                      Connect
                    </Stage>
                    <Stage 
                      $active={scanProgress.stage === 'scanning'} 
                      $completed={['indexing', 'complete'].includes(scanProgress.stage)}
                    >
                      Scan
                    </Stage>
                    <Stage 
                      $active={scanProgress.stage === 'indexing'} 
                      $completed={scanProgress.stage === 'complete'}
                    >
                      Index
                    </Stage>
                    <Stage 
                      $active={scanProgress.stage === 'complete'} 
                      $completed={scanProgress.stage === 'complete'}
                    >
                      Complete
                    </Stage>
                  </StageIndicator>
                </ProgressContainer>

                <Stats>
                  <StatCard>
                    <StatValue>{scanProgress.nftsFound}</StatValue>
                    <StatLabel>NFTs Found</StatLabel>
                  </StatCard>
                  <StatCard>
                    <StatValue>{scanProgress.collectionsFound}</StatValue>
                    <StatLabel>Collections</StatLabel>
                  </StatCard>
                </Stats>

                {discoveredNFTs.length > 0 && (
                  <NFTPreviewGrid>
                    {discoveredNFTs.slice(0, 50).map((nft, index) => (
                      <NFTPreviewItem
                        key={nft.address}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.02 }}
                      >
                        {nft.image ? (
                          <NFTImage 
                            src={nft.image} 
                            alt={nft.name || 'NFT'} 
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <NFTPlaceholder>NFT</NFTPlaceholder>
                        )}
                      </NFTPreviewItem>
                    ))}
                  </NFTPreviewGrid>
                )}
              </>
            ) : (
              <CompleteMessage
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <CompleteIcon>✨</CompleteIcon>
                <Title>All Set!</Title>
                <Subtitle>
                  Found {scanProgress.nftsFound} NFTs across {scanProgress.collectionsFound} collections
                </Subtitle>
              </CompleteMessage>
            )}
          </LoaderContent>
        </Container>
      )}
    </AnimatePresence>
  );
};

export default WalletScanningLoader; 