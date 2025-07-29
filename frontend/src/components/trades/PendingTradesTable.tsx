import React from 'react';
import styled from 'styled-components';
import { NFTMetadata } from '@/types/nft'; // Assuming NFTMetadata is used in PendingSearchItem
import { fixImageUrl, handleImageError } from '@/utils/imageUtils';
import { getCollectionName } from '@/utils/nftUtils';

// Re-use or adapt styles from TradeOpportunitiesTable.tsx
// For simplicity, I'm copying some key styled components.
// In a real scenario, you might put these in a shared file.

const TableContainer = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: 0;
  box-shadow: ${({ theme }) => theme.shadows.sm};
  border: 1px solid rgba(255, 255, 255, 0.1);
  width: 100%;
  margin-top: 1.5rem; // Add some space above this new table
  transform: translateZ(0);
  overflow: visible;
  position: relative;
  box-sizing: border-box;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease-in-out;
  
  &:hover {
    box-shadow: ${({ theme }) => theme.shadows.md};
    border-color: rgba(255, 255, 255, 0.2);
  }
`;

const TableHeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: ${({ theme }) => theme.spacing.md};
  padding-bottom: ${({ theme }) => theme.spacing.sm};
  box-sizing: border-box;
  width: 100%;
  
  h3 {
    font-size: ${({ theme }) => theme.typography.fontSize.lg};
    color: white;
    margin: 0;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  box-sizing: border-box;
`;

const TableHeader = styled.thead`
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  
  th {
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
    color: rgba(255, 255, 255, 0.7);
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    box-sizing: border-box;
  }
`;

const TableBody = styled.tbody`
  tr {
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    transition: background ${({ theme }) => theme.transitions.normal};
    
    &:last-child {
      border-bottom: none;
    }
    
    /* No hover effect needed for pending, or a different one */
    /* &:hover {
      background: rgba(255, 255, 255, 0.05);
    } */
  }
  
  td {
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    color: white;
    box-sizing: border-box;
  }
`;

const NFTPreview = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const NFTImage = styled.img`
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  object-fit: cover;
`;

const NFTInfo = styled.div`
  display: flex;
  flex-direction: column;

  span:first-child {
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  }

  span:last-child {
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

const StatusText = styled.span`
  color: ${({ theme }) => theme.colors.warning}; /* Or another appropriate color */
  font-style: italic;
  display: inline-flex; /* For ellipsis alignment */
  align-items: baseline;
`;

// New styled component for the animated ellipsis
const AnimatedEllipsis = styled.span`
  @keyframes ellipsis {
    0% { content: '.'; }
    33% { content: '..'; }
    66% { content: '...'; }
    100% { content: '.'; }
  }
  &:after {
    content: '.';
    animation: ellipsis 1.5s infinite;
    display: inline-block;
    width: 1.2em; /* Adjust width to prevent layout shift */
    text-align: left;
  }
`;

// Reuse or adapt RejectButton from TradeOpportunitiesTable
const RejectButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 1.1rem; // Slightly smaller if needed, or keep same as other table
  font-weight: bold;
  padding: 0.25rem 0.5rem;
  margin-left: 0.5rem;
  cursor: pointer;
  line-height: 1;
  transition: color 0.2s ease, transform 0.2s ease;

  &:hover {
    color: ${({ theme }) => theme.colors.error};
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.95);
  }
`;

// Interface for the props
interface PendingSearchItem {
  id: string;
  searchedNFT: NFTMetadata;
  initiatedAt: Date;
}

interface PendingTradesTableProps {
  pendingSearches: PendingSearchItem[];
  title?: string;
  onCancelSearch: (searchId: string) => void;
}

const PendingTradesTable: React.FC<PendingTradesTableProps> = ({ 
  pendingSearches, 
  title = "Pending Trade Searches", 
  onCancelSearch 
}) => {
  if (!pendingSearches || pendingSearches.length === 0) {
    // Optionally render nothing or a placeholder if no pending searches
    // For now, let's ensure the structure is there as requested for consistent layout
    // return null; 
  }

  return (
    <TableContainer>
      <TableHeaderContainer>
        <h3>{title}</h3>
        {/* No filter needed for pending table for now */}
      </TableHeaderContainer>
      <Table>
        <TableHeader>
          <tr>
            <th>NFT You Want</th>
            <th>Status</th>
            <th>Searched On</th>
            <th>Actions</th>
          </tr>
        </TableHeader>
        <TableBody>
          {pendingSearches && pendingSearches.length > 0 ? (
            pendingSearches.map(searchItem => (
              <tr key={searchItem.id}>
                <td>
                  <NFTPreview>
                    <NFTImage 
                      src={searchItem.searchedNFT.image ? fixImageUrl(searchItem.searchedNFT.image, searchItem.searchedNFT.address) : ''}
                      alt={searchItem.searchedNFT.name || 'Searched NFT'}
                      onError={handleImageError}
                    />
                    <NFTInfo>
                      <span>{searchItem.searchedNFT.name || 'Unnamed NFT'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#a0a0b0'}}>
                          {getCollectionName(searchItem.searchedNFT.collection, searchItem.searchedNFT.name, searchItem.searchedNFT.symbol)}
                        </span>
                        {searchItem.searchedNFT.isMagicEdenBadged && (
                          <span style={{ fontSize: '0.65rem', color: '#00E0B5', fontWeight: 'bold' }} title="Verified by Magic Eden">
                            (ME ✓)
                          </span>
                        )}
                      </div>
                    </NFTInfo>
                  </NFTPreview>
                </td>
                <td>
                  <StatusText>
                    Searching
                    <AnimatedEllipsis />
                  </StatusText>
                </td>
                <td>
                  {searchItem.initiatedAt.toLocaleDateString()} {searchItem.initiatedAt.toLocaleTimeString()}
                </td>
                <td>
                  <RejectButton 
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent any row-level click events if they exist
                      onCancelSearch(searchItem.id);
                    }}
                    aria-label="Cancel Search"
                  >
                    ×
                  </RejectButton>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} style={{textAlign: 'center', padding: '20px'}}>
                No active trade searches pending.
              </td>
            </tr>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default PendingTradesTable; 