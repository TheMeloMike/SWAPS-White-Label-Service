import React from 'react';
import styled from 'styled-components';
import { NFTCard } from './NFTCard';
import { NFTMetadata } from '@/services/nft';

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md};
`;

interface NFTGridProps {
  nfts: NFTMetadata[];
}

export const NFTGrid: React.FC<NFTGridProps> = ({ nfts }) => {
  if (nfts.length === 0) {
    return <EmptyState>No NFTs found in your wallet</EmptyState>;
  }

  return (
    <Grid>
      {nfts.map((nft) => (
        <NFTCard key={nft.address} nft={nft} />
      ))}
    </Grid>
  );
};

const EmptyState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.xl};
  color: ${({ theme }) => theme.colors.textSecondary};
`; 