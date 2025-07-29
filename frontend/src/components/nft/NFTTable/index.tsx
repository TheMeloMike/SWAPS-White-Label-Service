'use client';

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { PublicKey } from '@solana/web3.js';
import { fixImageUrl, handleImageError, createDataURIPlaceholder } from '@/utils/imageUtils';

interface NFT {
  mint: PublicKey;
  name: string;
  image?: string;
  collection?: string;
}

interface NFTTableProps {
  nfts: NFT[];
  isLoading?: boolean;
}

// Helper function to get collection name from either string or object format
const getCollectionName = (collection: string | { name: string; address: string } | undefined): string => {
  if (!collection) return 'N/A';
  if (typeof collection === 'object' && collection.name) {
    return collection.name;
  }
  return collection as string;
};

// Enhanced NFT image component with retry logic
const NFTImageWithRetry = ({ nft }: { nft: NFT }) => {
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

  const collectionName = getCollectionName(nft.collection);

  // Initialize image loading
  useEffect(() => {
    if (!nft || !nft.mint) {
      setImageState({
        src: createDataURIPlaceholder(nft?.name || 'NFT', 'unknown'),
        isLoading: false,
        hasError: true,
        attemptCount: 0
      });
      return;
    }
    
    // Start with direct proxy URL for best reliability
    const mintAddress = nft.mint.toString();
    const directProxyUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/nfts/image-proxy/${mintAddress}`;
    setImageState({
      src: directProxyUrl,
      isLoading: true,
      hasError: false,
      attemptCount: 0
    });
  }, [nft]);

  // Handle load success
  const handleImageLoad = () => {
    setImageState(prev => ({
      ...prev,
      isLoading: false
    }));
  };

  // Handle load error with retry logic
  const onImageError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!nft?.mint) return;
    
    const mintAddress = nft.mint.toString();
    
    // Get current attempt count
    const newAttemptCount = imageState.attemptCount + 1;
    
    // Try different approaches based on attempt number
    if (newAttemptCount === 1 && nft?.image) {
      // First retry: try the original URL from metadata
      setImageState({
        src: nft.image,
        isLoading: true,
        hasError: false,
        attemptCount: newAttemptCount
      });
      return;
    } else if (newAttemptCount === 2) {
      // Second retry: try proxy with refresh parameter
      const refreshUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/nfts/image-proxy/${mintAddress}?refresh=true&t=${Date.now()}`;
      setImageState({
        src: refreshUrl,
        isLoading: true,
        hasError: false,
        attemptCount: newAttemptCount
      });
      return;
    }
    
    // If all retries failed, use placeholder
    handleImageError(
      event,
      imageState.src,
      nft?.name || `NFT ${mintAddress.slice(0,8)}`,
      mintAddress
    );
    
    // Update state with the placeholder
    setImageState({
      src: event.currentTarget.src,
      isLoading: false,
      hasError: true,
      attemptCount: newAttemptCount
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      <StyledNFTImage 
        src={imageState.src}
        alt={nft?.name || 'NFT'}
        onLoad={handleImageLoad}
        onError={onImageError}
        data-mint-address={nft?.mint?.toString()}
        data-collection={collectionName}
        data-attempt-count={imageState.attemptCount}
        style={{
          opacity: imageState.isLoading ? 0.6 : 1,
          transition: 'opacity 0.3s ease'
        }}
      />
      {imageState.isLoading && (
        <LoadingOverlay>
          <LoadingSpinner />
        </LoadingOverlay>
      )}
    </div>
  );
};

export const NFTTable = ({ nfts, isLoading }: NFTTableProps) => {
  if (isLoading) {
    return <LoadingText>Loading your NFTs...</LoadingText>;
  }

  if (nfts.length === 0) {
    return <EmptyText>No NFTs found in your wallet</EmptyText>;
  }

  return (
    <TableContainer>
      <Table>
        <thead>
          <TableRow>
            <TableHeader>Image</TableHeader>
            <TableHeader>Name</TableHeader>
            <TableHeader>Collection</TableHeader>
            <TableHeader>Mint Address</TableHeader>
          </TableRow>
        </thead>
        <tbody>
          {nfts.map((nft) => (
            <TableRow key={nft.mint.toString()}>
              <TableCell>
                <NFTImageWithRetry nft={nft} />
              </TableCell>
              <TableCell>{nft.name}</TableCell>
              <TableCell>{getCollectionName(nft.collection)}</TableCell>
              <TableCell>
                <AddressText>{nft.mint.toString()}</AddressText>
              </TableCell>
            </TableRow>
          ))}
        </tbody>
      </Table>
    </TableContainer>
  );
};

const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: white;
`;

const TableRow = styled.tr`
  border-bottom: 1px solid #e5e5e5;
`;

const TableHeader = styled.th`
  text-align: left;
  padding: 1rem;
  background-color: #f8f9fa;
  font-weight: 600;
`;

const TableCell = styled.td`
  padding: 1rem;
`;

const StyledNFTImage = styled.img`
  width: 48px;
  height: 48px;
  border-radius: 4px;
  object-fit: cover;
`;

const PlaceholderImage = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 4px;
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #666666;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 48px;
  height: 48px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const LoadingSpinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const AddressText = styled.span`
  font-family: monospace;
  font-size: 14px;
`;

const LoadingText = styled.div`
  text-align: center;
  padding: 2rem;
  color: #666666;
`;

const EmptyText = styled.div`
  text-align: center;
  padding: 2rem;
  color: #666666;
`; 