import React from 'react';
import styled from 'styled-components';

// Types for collections data
interface NFTCollection {
  id: string;
  name: string;
  imageUrl: string;
  tradeVolume: number;
  tradeCount: number;
  floorPrice?: number;
  change?: number; // Percentage change (positive or negative)
}

interface PopularCollectionsProps {
  collections: NFTCollection[];
  isLoading?: boolean;
  limit?: number;
  onViewAll?: () => void;
}

// Styled components
const CollectionsContainer = styled.div`
  background: #181a1b;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  box-shadow: ${({ theme }) => theme.mode === 'dark' ? '0 4px 12px rgba(0, 0, 0, 0.2)' : theme.shadows.sm};
  border: 1px solid ${({ theme }) => theme.colors.surfaceBorder};
  width: 100%;
  margin: 0; /* Remove margins as parent container controls spacing */
  /* Fix for border-radius rendering */
  transform: translateZ(0);
  overflow: visible;
  position: relative;
  box-sizing: border-box;
  max-width: 100%;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  
  &:hover {
    border-color: ${({ theme }) => theme.colors.primary + '40'};
    box-shadow: ${({ theme }) => theme.mode === 'dark' ? '0 6px 16px rgba(0, 0, 0, 0.3)' : theme.shadows.md};
  }
  
  @media (max-width: 640px) {
    padding: ${({ theme }) => theme.spacing.sm};
    margin: 0;
  }
`;

const CollectionsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.surfaceBorder};
  padding-bottom: ${({ theme }) => theme.spacing.sm};
  
  h3 {
    font-size: ${({ theme }) => theme.typography.fontSize.lg};
    color: ${({ theme }) => theme.colors.textPrimary};
    margin: 0;
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  }
  
  @media (max-width: 480px) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const TableHeader = styled.div`
  display: grid;
  grid-template-columns: 40px 2fr 1fr 1fr 1fr;
  padding: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.surfaceBorder};
  width: 100%;
  box-sizing: border-box;
  
  span {
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
    text-transform: uppercase;
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  @media (max-width: 768px) {
    grid-template-columns: 40px 2fr 1fr 1fr;
    span:nth-child(5) {
      display: none;
    }
  }
  
  @media (max-width: 480px) {
    grid-template-columns: 40px 2fr 1fr;
    span:nth-child(4), span:nth-child(5) {
      display: none;
    }
  }
`;

const CollectionRow = styled.div`
  display: grid;
  grid-template-columns: 40px 2fr 1fr 1fr 1fr;
  padding: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.surfaceBorder};
  align-items: center;
  transition: all 0.3s ease;
  width: 100%;
  box-sizing: border-box;
  position: relative;
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background: rgba(255, 255, 255, 0.03);
    transform: translateX(2px);
    padding-left: calc(${({ theme }) => theme.spacing.sm} + 2px);
    box-shadow: inset 2px 0 0 ${({ theme }) => theme.colors.primary}80;
  }
  
  @media (max-width: 768px) {
    grid-template-columns: 40px 2fr 1fr 1fr;
    > div:nth-child(5) {
      display: none;
    }
  }
  
  @media (max-width: 480px) {
    grid-template-columns: 40px 2fr 1fr;
    > div:nth-child(4), > div:nth-child(5) {
      display: none;
    }
  }
`;

const IndexCell = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  text-align: center;
`;

const CollectionCell = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const CollectionImage = styled.div`
  width: 36px;
  height: 36px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  overflow: hidden;
  background: #181a1b;
  /* Fix for border-radius rendering */
  transform: translateZ(0);
  position: relative;
  margin: 1px;
  transition: all 0.3s ease;
  
  ${CollectionRow}:hover & {
    transform: scale(1.05);
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: all 0.3s ease;
    
    ${CollectionRow}:hover & {
      transform: scale(1.05);
    }
  }
`;

const CollectionInfo = styled.div`
  display: flex;
  flex-direction: column;
  max-width: 100%;
`;

const CollectionName = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

const FloorPrice = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const VolumeCell = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TradeCountCell = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ChangeCell = styled.div<{ $positive?: boolean }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ $positive, theme }) => 
    $positive ? theme.colors.success : theme.colors.error};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const ViewAllButton = styled.button`
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.primary};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background-color: ${({ theme }) => theme.colors.primary}20;
    transform: translateY(-1px);
    box-shadow: ${({ theme }) => theme.mode === 'dark' ? '0 4px 8px rgba(0, 0, 0, 0.2)' : '0 2px 4px rgba(103, 69, 255, 0.2)'};
  }
  
  &:active {
    transform: translateY(0);
  }
  
  @media (max-width: 480px) {
    width: 100%;
  }
`;

const NoCollections = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const NoData = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  width: 100%;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  min-height: 200px;
`;

const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
  box-sizing: border-box;
  margin-top: ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  -webkit-mask-image: -webkit-radial-gradient(white, black);
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 200px; /* Ensure minimum height for consistency */
  
  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 2px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.surfaceBorder};
    border-radius: 2px;
  }
`;

// Helper components
const ArrowUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'currentColor' }}>
    <path d="M12 19V5M12 5L5 12M12 5L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ArrowDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'currentColor' }}>
    <path d="M12 5V19M12 19L19 12M12 19L5 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Format number with abbreviation (K, M)
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  } else {
    return num.toString();
  }
};

// Helper for handling image load errors
const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
  e.currentTarget.src = 'https://via.placeholder.com/36/303050/FFFFFF?text=NFT';
};

/**
 * A component to display popular NFT collections based on trade volume.
 */
const PopularCollections: React.FC<PopularCollectionsProps> = ({ 
  collections, 
  isLoading = false,
  limit = 5,
  onViewAll 
}) => {
  const displayLimit = limit || 5;

  if (isLoading) {
    return (
      <CollectionsContainer>
        <CollectionsHeader>
          <h3>Popular Collections</h3>
        </CollectionsHeader>
        <TableContainer>
          <TableHeader>
            <span>#</span>
            <span>Collection</span>
            <span>Volume</span>
            <span>Trades</span>
            <span>Change</span>
          </TableHeader>
          {[...Array(3)].map((_, index) => (
            <CollectionRow key={index} style={{ opacity: 0.5 }}>
              <IndexCell>{index + 1}</IndexCell>
              <CollectionCell>
                <CollectionImage />
                <CollectionInfo>
                  <CollectionName>Loading...</CollectionName>
                </CollectionInfo>
              </CollectionCell>
              <VolumeCell>--</VolumeCell>
              <TradeCountCell>--</TradeCountCell>
              <ChangeCell $positive={true}>--</ChangeCell>
            </CollectionRow>
          ))}
        </TableContainer>
      </CollectionsContainer>
    );
  }

  return (
    <CollectionsContainer>
      <CollectionsHeader>
        <h3>Popular Collections</h3>
        {onViewAll && collections.length > displayLimit && (
          <ViewAllButton onClick={onViewAll}>
            View All
          </ViewAllButton>
        )}
      </CollectionsHeader>

      {collections.length === 0 ? (
        <NoData>No collection data available yet</NoData>
      ) : (
        <TableContainer>
          <TableHeader>
            <span>#</span>
            <span>Collection</span>
            <span>Volume</span>
            <span>Trades</span>
            <span>Change</span>
          </TableHeader>
          {collections.slice(0, displayLimit).map((collection, index) => (
            <CollectionRow key={collection.id || index}>
              <IndexCell>{index + 1}</IndexCell>
              <CollectionCell>
                <CollectionImage>
                  <img 
                    src={collection.imageUrl || 'https://via.placeholder.com/36'} 
                    alt={collection.name} 
                    onError={handleImageError}
                  />
                </CollectionImage>
                <CollectionInfo>
                  <CollectionName>{collection.name}</CollectionName>
                  {collection.floorPrice && (
                    <FloorPrice>Floor: {collection.floorPrice} SOL</FloorPrice>
                  )}
                </CollectionInfo>
              </CollectionCell>
              <VolumeCell>{formatNumber(collection.tradeVolume)} SOL</VolumeCell>
              <TradeCountCell>{formatNumber(collection.tradeCount)}</TradeCountCell>
              <ChangeCell $positive={collection.change != null ? collection.change >= 0 : undefined}>
                {collection.change != null && (
                  <>
                    {collection.change >= 0 ? (
                      <>
                        <ArrowUpIcon />+{collection.change}%
                      </>
                    ) : (
                      <>
                        <ArrowDownIcon />{collection.change}%
                      </>
                    )}
                  </>
                )}
              </ChangeCell>
            </CollectionRow>
          ))}
        </TableContainer>
      )}
    </CollectionsContainer>
  );
};

export default PopularCollections; 