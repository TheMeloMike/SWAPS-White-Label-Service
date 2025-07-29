'use client';

import React from 'react';
import styled from 'styled-components';
import { PublicKey } from '@solana/web3.js';

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
                {nft.image ? (
                  <NFTImage src={nft.image} alt={nft.name} />
                ) : (
                  <PlaceholderImage>No Image</PlaceholderImage>
                )}
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

const NFTImage = styled.img`
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