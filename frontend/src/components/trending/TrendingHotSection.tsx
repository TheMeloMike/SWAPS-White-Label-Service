'use client';

import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { TrendingService as FeTrendingService } from '../../services/trending';
import { TrendingData, TrendingWantedNft, TrendingLoopItem } from '../../types/trending';
import { fixImageUrl, handleImageError, createDataURIPlaceholder } from '@/utils/imageUtils';
import { getCollectionName } from '@/utils/nftUtils';
import NFTDetailModal, { NFTDetailItem, REFRESH_TRENDING_EVENT, RefreshTrendingEvent } from './NFTDetailModal';
import { NFTService } from '@/services/nft';
import { fadeInAnimation, cardHover, hoverGlow, shimmer, buttonHover } from '@/styles/animations';
import SkeletonLoader from '@/components/shared/SkeletonLoader';

// Define interfaces for combined trending items
interface CombinedTrendingItem {
  _combinedScore: number;
}

interface CombinedWantedNft extends TrendingWantedNft, CombinedTrendingItem {
  appearanceInLoops?: number;
  averageLoopScore?: number;
}

interface CombinedLoopItem extends TrendingLoopItem, CombinedTrendingItem {
}

type UnifiedTrendingItem = CombinedWantedNft | CombinedLoopItem;

// Styled components matching the trade tables
const TableContainer = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: 0;
  box-shadow: ${({ theme }) => theme.shadows.sm};
  border: 1px solid rgba(255, 255, 255, 0.1);
  width: 100%;
  max-width: 100%;
  margin-bottom: 1.5rem;
  transform: translateZ(0);
  overflow: visible;
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease-in-out;
  ${fadeInAnimation}
  ${cardHover}
  
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
  table-layout: fixed;
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
    white-space: nowrap;
    overflow: visible;
    text-overflow: ellipsis;
    position: relative;
  }
`;

const TableBody = styled.tbody`
  tr {
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    transition: background ${({ theme }) => theme.transitions.normal};
    
    &:last-child {
      border-bottom: none;
    }
    
    &:hover {
      background: rgba(255, 255, 255, 0.05);
    }
  }
  
  td {
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    color: white;
    box-sizing: border-box;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const NFTPreview = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  max-width: 100%;
  min-width: 0;
`;

const NFTImage = styled.img`
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  object-fit: cover;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  
  &:hover {
    transform: scale(1.1);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  }
`;

const NFTInfo = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;

  span:first-child {
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  span:last-child {
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const Badge = styled.div<{ $type: 'popularity' | 'score'; $value?: number }>`
  display: inline-block;
  padding: 4px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: 12px;
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  background: ${({ $type, $value, theme }) => {
    if ($type === 'popularity') return theme.colors.warning + '30';
    
    // Score coloring based on value
    if ($value !== undefined) {
      const scoreValue = $value < 1 ? $value * 100 : $value;
      if (scoreValue >= 80) return theme.colors.success + '30';
      if (scoreValue >= 40) return theme.colors.warning + '30';
      return theme.colors.error + '30';
    }
    
    return theme.colors.success + '30';
  }};
  color: ${({ $type, $value, theme }) => {
    if ($type === 'popularity') return theme.colors.warning;
    
    // Score coloring based on value
    if ($value !== undefined) {
      const scoreValue = $value < 1 ? $value * 100 : $value;
      if (scoreValue >= 80) return theme.colors.success;
      if (scoreValue >= 40) return theme.colors.warning;
      return theme.colors.error;
    }
    
    return theme.colors.success;
  }};
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transform: translateY(-50%);
    transition: left 0.5s ease;
  }
  
  &:hover::before {
    left: 100%;
  }
`;

const LoadingContainer = styled.div`
  padding: ${({ theme }) => theme.spacing.xl};
  text-align: center;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const ErrorContainer = styled.div`
  padding: ${({ theme }) => theme.spacing.xl};
  text-align: center;
  color: ${({ theme }) => theme.colors.error};
`;

// Add a wrapper component to match the width of other components
// const SectionWrapper = styled.div`
//   max-width: 1400px;
//   width: 100%;
//   margin: 0 auto;
//   padding: 0 1rem;
//   box-sizing: border-box;
//   overflow-x: hidden;
//   
//   @media (max-width: 640px) {
//     padding: 0.5rem;
//   }
// `;

// Add styled components for the filter dropdown
const FilterDropdownContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const FilterLabel = styled.label`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
`;

const FilterSelect = styled.select`
  padding: 0.3rem 0.5rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: 1px solid ${({ theme }) => theme.colors.surfaceBorder};
  background-color: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.primary}30;
  }
`;

// Add tooltip styles
const TooltipContainer = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
`;

const TooltipIcon = styled.span`
  display: inline-flex;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
  align-items: center;
  justify-content: center;
  cursor: help;
`;

const TooltipContent = styled.div`
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(5px);
  width: 250px;
  background-color: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 9000;
  visibility: hidden;
  opacity: 0;
  transition: all 0.2s ease;
  pointer-events: none;
  text-align: left;
  line-height: 1.4;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  word-wrap: break-word;
  white-space: normal;
  overflow: visible;
  
  &:after {
    content: '';
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 4px;
    border-style: solid;
    border-color: transparent transparent rgba(0, 0, 0, 0.9) transparent;
  }
  
  ${TooltipContainer}:hover & {
    visibility: visible;
    opacity: 1;
  }
`;

// Tooltip component
const Tooltip: React.FC<{ text: string }> = ({ text }) => (
  <TooltipContainer>
    <TooltipIcon>?</TooltipIcon>
    <TooltipContent>{text}</TooltipContent>
  </TooltipContainer>
);

// Add styles for clickable rows
const ClickableRow = styled.tr`
  cursor: pointer;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.08) !important;
  }
`;

// Add a placeholder image with the NFT ID display
const NFTPlaceholder = styled.div`
  width: 40px;
  height: 40px;
  background: #303050;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 10px;
  overflow: hidden;
  text-align: center;
  word-break: break-all;
  padding: 2px;
`;

// Update existing image handling in the NFT section
// Replace the image component with a more robust version
const NFTImageWithRetry = ({ nft, itemId, displayName }: { nft: any, itemId: string, displayName: string }) => {
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

  // Initialize image loading
  useEffect(() => {
    if (!itemId) {
      setImageState({
        src: createDataURIPlaceholder(displayName, 'unknown'),
        isLoading: false,
        hasError: true,
        attemptCount: 0
      });
      return;
    }
    
    // Start with the proxy URL for best reliability
    const directProxyUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/nfts/image-proxy/${itemId}`;
    setImageState({
      src: directProxyUrl,
      isLoading: true,
      hasError: false,
      attemptCount: 0
    });
  }, [itemId, displayName]);

  // Handle load success
  const handleImageLoad = () => {
    setImageState(prev => ({
      ...prev,
      isLoading: false
    }));
  };

  // Handle load error with retry logic
  const onImageError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!itemId) return;
    
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
      const refreshUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/nfts/image-proxy/${itemId}?refresh=true&t=${Date.now()}`;
      setImageState({
        src: refreshUrl,
        isLoading: true,
        hasError: false,
        attemptCount: newAttemptCount
      });
      return;
    }
    
    // If all retries failed, use the utility's error handler
    handleImageError(
      event,
      imageState.src,
      displayName,
      itemId
    );
    
    // Update our state with the placeholder that handleImageError set
    setImageState({
      src: event.currentTarget.src,
      isLoading: false,
      hasError: true,
      attemptCount: newAttemptCount
    });
  };

  return (
    <NFTImage 
      src={imageState.src}
      alt={displayName || 'NFT'}
      onLoad={handleImageLoad}
      onError={onImageError}
      data-mint-address={itemId}
      data-attempt-count={imageState.attemptCount}
      style={{
        opacity: imageState.isLoading ? 0.6 : 1,
        transition: 'opacity 0.3s ease'
      }}
    />
  );
};

// Main component
const TrendingHotSection: React.FC = () => {
  const [trendingData, setTrendingData] = useState<TrendingData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState<number>(5);
  const [selectedItem, setSelectedItem] = useState<NFTDetailItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Add a new state to track fetched NFT metadata
  const [nftMetadataMap, setNftMetadataMap] = useState<Map<string, any>>(new Map());

  // Handle filter changes
  const handleDisplayCountChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setDisplayCount(value === 'all' ? Infinity : parseInt(value, 10));
  };

  // Handle NFT selection
  const handleNftClick = (item: NFTDetailItem) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };
  
  // Close modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

    const fetchTrending = async () => {
      setLoading(true);
      setError(null);
      try {
        const service = FeTrendingService.getInstance();
        const data = await service.getTrendingData();
        if (data) {
        // Log score values to understand the format
        if (data.topLoopItems && data.topLoopItems.length > 0) {
          console.log('DEBUG - Trade Loop Scores:');
          data.topLoopItems.forEach((item, index) => {
            console.log(`Item ${index + 1} (${item.displayName}): original score = ${item.averageLoopScore}`);
          });
        }
          setTrendingData(data);
        } else {
          setError('No trending data received.');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load trending data.');
      console.error('Error in Frontend TrendingService fetching trending data:', err);
      }
      setLoading(false);
    };

  // Initial data fetch
  useEffect(() => {
    fetchTrending();
  }, []);

  // New effect to load NFT metadata after trending data is fetched
  useEffect(() => {
    if (trendingData && trendingData.topWantedNfts.length > 0) {
      const nftAddresses = trendingData.topWantedNfts.map(nft => nft.nftAddress);
      
      // Add addresses from loop items that are NFTs
      if (trendingData.topLoopItems) {
        trendingData.topLoopItems.forEach(item => {
          if (item.itemType === 'NFT' && !nftAddresses.includes(item.itemId)) {
            nftAddresses.push(item.itemId);
          }
        });
      }
      
      // Fetch metadata for all NFTs
      const fetchNFTMetadata = async () => {
        try {
          const nftService = NFTService.getInstance();
          const metadataMap = await nftService.fetchNFTsByAddresses(nftAddresses);
          setNftMetadataMap(metadataMap);
        } catch (err) {
          console.error('Error fetching NFT metadata for trending items:', err);
        }
      };
      
      fetchNFTMetadata();
    }
  }, [trendingData]);

  // Listen for refresh events
  useEffect(() => {
    const handleRefreshEvent = (event: CustomEvent<RefreshTrendingEvent>) => {
      console.log('Refreshing trending data after NFT added to wants');
      
      // Handle event data if available
      const eventData = event.detail;
      const hasEventData = eventData && eventData.nftAddress && eventData.newWantCount;
      
      if (hasEventData) {
        console.log(`Refresh event for NFT ${eventData.nftAddress} with new count: ${eventData.newWantCount}`);
      }
      
      // Update the current data immediately with the event data if available
      if (hasEventData && trendingData) {
        // Make a copy of the trending data
        const updatedData = { ...trendingData };
        
        // Find and update the NFT in topWantedNfts if it exists
        const nftIndex = updatedData.topWantedNfts.findIndex(
          nft => nft.nftAddress === eventData.nftAddress
        );
        
        if (nftIndex >= 0) {
          // Update the wantCount
          const updatedNft = {
            ...updatedData.topWantedNfts[nftIndex],
            wantCount: eventData.newWantCount
          };
          
          // Replace the item in the array
          updatedData.topWantedNfts[nftIndex] = updatedNft;
          
          // Also update the selected item if it matches
          if (selectedItem && 'wantCount' in selectedItem && 
              selectedItem.nftAddress === eventData.nftAddress) {
            setSelectedItem({
              ...selectedItem,
              wantCount: eventData.newWantCount
            });
          }
          
          // Update the trending data
          setTrendingData(updatedData);
          console.log(`Updated local trending data for NFT ${eventData.nftAddress}`);
        }
      }
      
      // Fetch new data from backend without setting loading state to true
      const refreshDataQuietly = async () => {
        try {
          const service = FeTrendingService.getInstance();
          const data = await service.getTrendingData();
          if (data) {
            console.log('Got fresh trending data after NFT added to wants');
            
            // Preserve the local want count for the updated NFT if we have event data
            if (hasEventData) {
              const updatedNft = data.topWantedNfts.find(
                nft => nft.nftAddress === eventData.nftAddress
              );
              
              if (updatedNft && updatedNft.wantCount < eventData.newWantCount) {
                console.log(`Backend data for ${eventData.nftAddress} has count ${updatedNft.wantCount}, using our count ${eventData.newWantCount}`);
                updatedNft.wantCount = eventData.newWantCount;
              }
            }
            
            // Update the trending data
            setTrendingData(data);
            
            // If we have a selectedItem (modal is open), update it with fresh data
            if (selectedItem && isModalOpen) {
              // For NFT type items (in Most Wanted NFTs)
              if ('wantCount' in selectedItem) {
                const refreshedItem = data.topWantedNfts.find(
                  item => item.nftAddress === selectedItem.nftAddress
                );
                
                if (refreshedItem) {
                  // If we have event data and it's for this NFT, ensure we keep the higher count
                  if (hasEventData && selectedItem.nftAddress === eventData.nftAddress) {
                    if (refreshedItem.wantCount < eventData.newWantCount) {
                      refreshedItem.wantCount = eventData.newWantCount;
                    }
                  }
                  
                  setSelectedItem(refreshedItem);
                }
              } 
              // For loop items (in Hot in Trade Loops)
              else if (selectedItem.itemType && selectedItem.itemId) {
                const refreshedItem = data.topLoopItems.find(
                  item => item.itemId === selectedItem.itemId && item.itemType === selectedItem.itemType
                );
                if (refreshedItem) {
                  setSelectedItem(refreshedItem);
                }
              }
            }
          }
        } catch (err) {
          console.error('Error quietly refreshing trending data:', err);
          // Don't set error state to keep the UI stable
        }
      };
      
      refreshDataQuietly();
    };

    // Add event listener
    document.addEventListener(REFRESH_TRENDING_EVENT, handleRefreshEvent as EventListener);
    
    // Clean up
    return () => {
      document.removeEventListener(REFRESH_TRENDING_EVENT, handleRefreshEvent as EventListener);
    };
  }, [trendingData, selectedItem, isModalOpen]);

  // Helper function to format score based on its original format
  const formatScore = (score: number | undefined): string => {
    if (score === undefined || score === null) return '-';
    
    // If score is already a percentage (e.g., 75)
    if (score >= 1) {
      return `${Math.round(score)}%`;
    }
    
    // If score is a decimal representing a percentage (e.g., 0.75)
    if (score < 1) {
      return `${Math.round(score * 100)}%`;
    }
    
    return `${score}%`;
  };

  // Create a unified list of trending items
  const getUnifiedTrendingItems = (): UnifiedTrendingItem[] => {
    if (!trendingData) return [];

    // Create a map of NFT addresses to avoid duplicates
    const itemsMap = new Map<string, UnifiedTrendingItem>();
    
    // First add all wanted NFTs to the map
    trendingData.topWantedNfts.forEach(nft => {
      itemsMap.set(nft.nftAddress, {
        ...nft,
        // Add a combined score field for sorting
        _combinedScore: nft.wantCount * 10 // Give wanted NFTs a high weight
      });
    });
    
    // Then add or merge loop items
    trendingData.topLoopItems.forEach(item => {
      // If it's an NFT that's already in our wanted list, merge data
      if (item.itemType === 'NFT' && itemsMap.has(item.itemId)) {
        const existingItem = itemsMap.get(item.itemId) as CombinedWantedNft;
        
        // Create a merged item with properties from both
        const mergedItem: CombinedWantedNft = {
          ...existingItem,
          appearanceInLoops: item.appearanceInLoops,
          averageLoopScore: item.averageLoopScore,
          // Update combined score with both metrics
          _combinedScore: (existingItem.wantCount * 10) + (item.appearanceInLoops * 5)
        };
        
        itemsMap.set(item.itemId, mergedItem);
      } else {
        // Otherwise, add as a new item
        itemsMap.set(`${item.itemType}-${item.itemId}`, {
          ...item,
          // Add combined score
          _combinedScore: item.appearanceInLoops * 5
        } as CombinedLoopItem);
      }
    });
    
    // Convert map to array and sort by combined score
    return Array.from(itemsMap.values())
      .sort((a, b) => b._combinedScore - a._combinedScore)
      .slice(0, displayCount);
  };

  const renderContent = () => {
  if (loading) {
      return (
        <TableContainer>
          <TableHeaderContainer>
            <h3>🔥 Trending</h3>
          </TableHeaderContainer>
          <LoadingContainer>
            <SkeletonLoader type="table" rows={5} />
          </LoadingContainer>
        </TableContainer>
      );
  }

  if (error) {
      return (
        <TableContainer>
          <TableHeaderContainer>
            <h3>🔥 Trending</h3>
          </TableHeaderContainer>
          <ErrorContainer>Error: {error}</ErrorContainer>
        </TableContainer>
      );
  }

  if (!trendingData || (trendingData.topWantedNfts.length === 0 && trendingData.topLoopItems.length === 0)) {
      return (
        <TableContainer>
          <TableHeaderContainer>
            <h3>🔥 Trending</h3>
          </TableHeaderContainer>
          <LoadingContainer>No trending NFTs available at the moment.</LoadingContainer>
        </TableContainer>
      );
    }

    // Get unified trending items
    const unifiedItems = getUnifiedTrendingItems();

    return (
      <TableContainer>
        <TableHeaderContainer>
          <h3>🔥 Trending</h3>
          <FilterDropdownContainer>
            <FilterLabel htmlFor="displayCountFilter">Show:</FilterLabel>
            <FilterSelect 
              id="displayCountFilter" 
              value={displayCount === Infinity ? 'all' : displayCount.toString()} 
              onChange={handleDisplayCountChange}
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="20">20</option>
              <option value="25">25</option>
              <option value="all">All</option>
            </FilterSelect>
          </FilterDropdownContainer>
        </TableHeaderContainer>
        <Table>
          <TableHeader>
            <tr>
              <th>NFT/Item</th>
              <th>Wanted By <Tooltip text="Number of users who want this NFT" /></th>
              <th>Popularity <Tooltip text="How popular this NFT is based on wants" /></th>
              <th>Appearances <Tooltip text="Number of times this appears in trade loops" /></th>
              <th>Avg. Score <Tooltip text="Average score of trade loops containing this item" /></th>
              <th>Type <Tooltip text="Type of item: NFT or Collection" /></th>
            </tr>
          </TableHeader>
          <TableBody>
            {unifiedItems.map((item) => {
              // Determine if this is a WantedNft or LoopItem
              const isWantedNft = 'wantCount' in item;
              const isLoopItem = 'appearanceInLoops' in item;
              
              // Get common data
              const itemId = isWantedNft ? item.nftAddress : item.itemId;
              const itemType = isWantedNft ? 'NFT' : item.itemType;
              
              // Try to get metadata from our newly fetched metadata map
              const fetchedMetadata = nftMetadataMap.get(itemId);
              
              // Use fetched metadata if available, otherwise fall back to existing data
              const metadata = fetchedMetadata || (isWantedNft ? item.metadata : 
                (item.nftMetadata && item.nftMetadata.length > 0 ? item.nftMetadata[0] : null));
              
              // Display name with better fallbacks
              const displayName = metadata?.name || 
                (isWantedNft ? 'NFT ' + item.nftAddress.slice(0, 8) : 
                (item.displayName || 'Unknown Item'));
              
              // Get image URL with better fallback handling
              const imageUrl = metadata?.image ? fixImageUrl(metadata.image, itemId) : 
                (isWantedNft ? '' : 
                (item.imageUrl ? fixImageUrl(item.imageUrl, item.itemId) : ''));
              
              // Get collection name
              const collection = metadata?.collection ? 
                getCollectionName(metadata.collection, metadata.name, metadata.symbol) : 
                (itemType === 'Collection' ? displayName : null);
              
              // Get metrics
              const wantCount = isWantedNft ? item.wantCount : 0;
              const appearances = isLoopItem && 'appearanceInLoops' in item && item.appearanceInLoops !== undefined ? item.appearanceInLoops : 0;
              const score = isLoopItem && item.averageLoopScore ? item.averageLoopScore : null;
              
              return (
                <ClickableRow 
                  key={`trending-${itemType}-${itemId}`}
                  onClick={() => handleNftClick({...item, metadata: metadata})}
                >
                  <td>
                    <NFTPreview>
                      {imageUrl ? (
                        <NFTImageWithRetry 
                          nft={metadata} 
                          itemId={itemId} 
                          displayName={displayName} 
                        />
                      ) : (
                        <NFTPlaceholder>
                          {itemId.slice(0, 8)}
                        </NFTPlaceholder>
                      )}
                      <NFTInfo>
                        <span>{displayName}</span>
                        <span>
                          {collection || itemId.slice(0, 8) + '...'}
                        </span>
                      </NFTInfo>
                    </NFTPreview>
                  </td>
                  <td>{wantCount > 0 ? `${wantCount} users` : '-'}</td>
                  <td>
                    {wantCount > 0 ? (
                      <Badge $type="popularity">
                        {wantCount > 10 ? 'Very High' : wantCount > 5 ? 'High' : 'Rising'}
                      </Badge>
                    ) : '-'}
                  </td>
                  <td>{appearances > 0 ? `${appearances} loops` : '-'}</td>
                  <td>
                    {score !== null ? (
                      <Badge $type="score" $value={score}>
                        {formatScore(score)}
                      </Badge>
                    ) : '-'}
                  </td>
                  <td>{itemType}</td>
                </ClickableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // Update the return statement to return the content directly without the SectionWrapper
  return (
    <>
      {renderContent()}
      
      {/* NFT Detail Modal - Moved outside the table container */}
      {isModalOpen && selectedItem && (
        <NFTDetailModal 
          isOpen={isModalOpen}
          item={selectedItem}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};

export default TrendingHotSection; 