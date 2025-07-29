import React from 'react';
import styled from 'styled-components';
import { NFTMetadata } from '@/services/nft';

interface NFTTableProps {
  nfts: NFTMetadata[];
  isLoading?: boolean;
}

const Table = styled.div`
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: #2a2a2a;
`;

const TableHeader = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;
  padding: 1rem;
  background: #333;
  font-weight: bold;
`;

const TableRow = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;
  padding: 1rem;
  border-bottom: 1px solid #444;
  
  &:last-child {
    border-bottom: none;
  }
`;

export function NFTTable({ nfts, isLoading }: NFTTableProps) {
  if (isLoading) {
    return <div>Loading NFTs...</div>;
  }

  if (nfts.length === 0) {
    return <div>No NFTs found</div>;
  }

  return (
    <Table>
      <TableHeader>
        <div>Image</div>
        <div>Name</div>
        <div>Actions</div>
      </TableHeader>
      {nfts.map((nft) => (
        <TableRow key={nft.address}>
          <div>
            {nft.image && (
              <img 
                src={nft.image} 
                alt={nft.name} 
                style={{ width: '50px', height: '50px', objectFit: 'cover' }} 
              />
            )}
          </div>
          <div>{nft.name}</div>
          <div>
            <button>View</button>
          </div>
        </TableRow>
      ))}
    </Table>
  );
} 