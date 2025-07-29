'use client';

import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

interface NFTPreview {
  address: string;
  image?: string;
  name?: string;
  collection?: string;
}

interface NFTPreviewGridProps {
  nfts: NFTPreview[];
  maxDisplay?: number;
  onNFTClick?: (nft: NFTPreview) => void;
}

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 1rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  max-height: 400px;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    
    &:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  }
`;

const NFTCard = styled(motion.div)`
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
    border-color: rgba(0, 255, 136, 0.5);
    box-shadow: 0 8px 24px rgba(0, 255, 136, 0.2);
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
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.8rem;
  text-align: center;
  padding: 0.5rem;
`;

const CollectionBadge = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  padding: 0.25rem 0.5rem;
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.8);
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Spinner = styled.div`
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #00ff88;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const ShowMoreCard = styled(NFTCard)`
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 255, 136, 0.1);
  border-color: rgba(0, 255, 136, 0.3);
  color: #00ff88;
  font-weight: 600;
  font-size: 0.9rem;
  
  &:hover {
    background: rgba(0, 255, 136, 0.2);
  }
`;

export const NFTPreviewGrid: React.FC<NFTPreviewGridProps> = ({
  nfts,
  maxDisplay = 50,
  onNFTClick
}) => {
  const displayNFTs = nfts.slice(0, maxDisplay);
  const hasMore = nfts.length > maxDisplay;

  return (
    <GridContainer>
      {displayNFTs.map((nft, index) => (
        <NFTCard
          key={nft.address}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ 
            delay: Math.min(index * 0.02, 0.5),
            duration: 0.3,
            ease: 'easeOut'
          }}
          onClick={() => onNFTClick?.(nft)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {nft.image ? (
            <>
              <NFTImage 
                src={nft.image} 
                alt={nft.name || 'NFT'}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  // Show placeholder instead
                  const placeholder = target.nextElementSibling;
                  if (placeholder) {
                    (placeholder as HTMLElement).style.display = 'flex';
                  }
                }}
              />
              <NFTPlaceholder style={{ display: 'none' }}>
                {nft.name || 'NFT'}
              </NFTPlaceholder>
            </>
          ) : (
            <NFTPlaceholder>
              {nft.name || 'Loading...'}
            </NFTPlaceholder>
          )}
          
          {nft.collection && (
            <CollectionBadge>{nft.collection}</CollectionBadge>
          )}
        </NFTCard>
      ))}
      
      {hasMore && (
        <ShowMoreCard
          as={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          +{nfts.length - maxDisplay} more
        </ShowMoreCard>
      )}
    </GridContainer>
  );
};

export default NFTPreviewGrid; 