import React, { useState, useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { TradeLoop, TradeStep } from '@/types/trade';
import { NFTMetadata } from '@/types/nft';
import { useWallet } from '@solana/wallet-adapter-react';
import { TradeFlow } from './TradeFlow';
import { fixImageUrl, handleImageError, createDataURIPlaceholder, SVG_PLACEHOLDER_PREFIX, DEFAULT_IMAGE_PLACEHOLDER } from '@/utils/imageUtils';
import { getCollectionName } from '@/utils/nftUtils';

// Highlighting animation for newly discovered trades
const highlightPulse = keyframes`
  0% {
    background: rgba(123, 97, 255, 0.3);
    box-shadow: 0 0 20px rgba(123, 97, 255, 0.4);
    transform: scale(1.02);
  }
  50% {
    background: rgba(123, 97, 255, 0.15);
    box-shadow: 0 0 30px rgba(123, 97, 255, 0.6);
    transform: scale(1.01);
  }
  100% {
    background: rgba(123, 97, 255, 0.05);
    box-shadow: 0 0 10px rgba(123, 97, 255, 0.2);
    transform: scale(1);
  }
`;

const fadeToNormal = keyframes`
  from {
    background: rgba(123, 97, 255, 0.05);
    box-shadow: 0 0 10px rgba(123, 97, 255, 0.2);
  }
  to {
    background: transparent;
    box-shadow: none;
  }
`;

const TableContainer = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: 0;
  box-shadow: ${({ theme }) => theme.shadows.sm};
  border: 1px solid rgba(255, 255, 255, 0.1);
  width: 100%;
  margin: 0;
  /* Fix for border-radius rendering */
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
  
  @media (max-width: 640px) {
    margin: 0;
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
    
    &:hover {
      background: rgba(255, 255, 255, 0.05);
      cursor: pointer;
    }
  }
  
  td {
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    color: white;
    box-sizing: border-box;
  }
`;

const EfficiencyBadge = styled.div<{ $efficiency: number }>`
  display: inline-block;
  padding: 4px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: 12px;
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  background: ${({ $efficiency, theme }) => 
    $efficiency >= 0.8 ? theme.colors.success + '30' :
    $efficiency >= 0.5 ? theme.colors.warning + '30' :
    theme.colors.error + '30'
  };
  color: ${({ $efficiency, theme }) => 
    $efficiency >= 0.8 ? theme.colors.success :
    $efficiency >= 0.5 ? theme.colors.warning :
    theme.colors.error
  };
  transition: all 0.2s ease;
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

const ExpandableTr = styled.tr<{ $isHighlighted?: boolean; $animationPhase?: 'pulse' | 'fade' | 'none' }>`
  cursor: pointer;
  position: relative; 
  transition: background-color 0.2s ease, transform 0.2s ease;
  
  ${({ $isHighlighted, $animationPhase }) => {
    if ($isHighlighted && $animationPhase === 'pulse') {
      return css`
        animation: ${highlightPulse} 2s ease-in-out;
        border: 1px solid rgba(123, 97, 255, 0.5);
        border-radius: 8px;
      `;
    } else if ($isHighlighted && $animationPhase === 'fade') {
      return css`
        animation: ${fadeToNormal} 1s ease-out forwards;
        border: 1px solid rgba(123, 97, 255, 0.3);
        border-radius: 8px;
      `;
    }
    return '';
  }}
  
  &:hover {
    background-color: ${({ theme, $isHighlighted }) => 
      $isHighlighted ? 'rgba(123, 97, 255, 0.15)' : theme.colors.primary + '20'};
    
    ${EfficiencyBadge} {
      transform: scale(1.05);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
  }
`;

const ExpandedContent = styled.tr`
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  
  td {
    padding: 0;
  }
`;

const ExpandedContentInner = styled.div`
  padding: ${({ theme }) => theme.spacing.md};
`;

// New styled components for the filter
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

// New styled component for the Sleek X Reject Button
const RejectButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 1.2rem; /* Adjust size as needed */
  font-weight: bold;
  padding: 0.25rem 0.5rem;
  margin-left: 0.75rem; /* Space it from the View Details text */
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

interface TradeOpportunitiesTableProps {
  trades: TradeLoop[];
  onRejectTrade: (tradeId: string) => void;
  title?: string;
  minTradeScore: number;
  onMinTradeScoreChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

// Helper to get initial image source: attempts fixImageUrl or provides placeholder
const getInitialImageSrc = (nftItem: NFTMetadata | undefined | null): string => { 
  if (!nftItem || !nftItem.address) return createDataURIPlaceholder('NFT', 'unknown');
  return nftItem.image ? fixImageUrl(nftItem.image, nftItem.address) : createDataURIPlaceholder(nftItem.name || 'NFT', nftItem.address);
};

// Simple component to manage image state for the table NFTs
const TableNftImage: React.FC<{ nftItem: NFTMetadata }> = ({ nftItem }) => {
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

  // Update image when nftItem changes
  useEffect(() => {
    if (!nftItem || !nftItem.address) {
      setImageState({
        src: createDataURIPlaceholder('NFT', 'unknown'),
        isLoading: false,
        hasError: true,
        attemptCount: 0
      });
      return;
    }
    
    // Always start with the proxy URL for best reliability
    const directProxyUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/nfts/image-proxy/${nftItem.address}`;
    
    setImageState({
      src: directProxyUrl,
      isLoading: true,
      hasError: false,
      attemptCount: 0
    });
  }, [nftItem]);

  // Handle successful load
  const handleImageLoad = () => {
    setImageState(prev => ({
      ...prev,
      isLoading: false
    }));
  };

  // Handle image error with retry logic
  const onImageError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!nftItem || !nftItem.address) return;
    
    // Get current attempt count for retry logic
    const newAttemptCount = imageState.attemptCount + 1;
    
    // Try different sources based on attempt count
    if (newAttemptCount === 1) {
      // First retry: try the original URL from metadata
      if (nftItem.image) {
        setImageState({
          src: nftItem.image,
          isLoading: true,
          hasError: false,
          attemptCount: newAttemptCount
        });
        return;
      }
    } else if (newAttemptCount === 2) {
      // Second retry: try proxy with cache-busting params
      const refreshUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/nfts/image-proxy/${nftItem.address}?refresh=true&t=${Date.now()}`;
      setImageState({
        src: refreshUrl,
        isLoading: true,
        hasError: false,
        attemptCount: newAttemptCount
      });
      return;
    }
    
    // After all retries, use the error handler for final placeholder
    handleImageError(
      event, 
      imageState.src, 
      nftItem.name || `NFT ${nftItem.address.slice(0, 6)}...`, 
      nftItem.address
    );
    
    // Update our state with the placeholder
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
      alt={nftItem?.name || 'NFT'}
      onLoad={handleImageLoad}
      onError={onImageError}
      data-mint-address={nftItem?.address}
      data-collection={typeof nftItem?.collection === 'string' ? nftItem.collection : 
                      (typeof nftItem?.collection === 'object' && nftItem.collection?.address ? 
                       nftItem.collection.address : '')}
      data-attempt-count={imageState.attemptCount} // Track attempts for debugging
      style={{ 
        marginRight: '8px',
        opacity: imageState.isLoading ? 0.6 : 1,
        transition: 'opacity 0.3s ease'
      }} 
    />
  );
};

const TradeOpportunitiesTable: React.FC<TradeOpportunitiesTableProps> = ({ trades, onRejectTrade, title, minTradeScore, onMinTradeScoreChange }) => {
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [highlightedTrades, setHighlightedTrades] = useState<Set<string>>(new Set());
  const [animationPhase, setAnimationPhase] = useState<Map<string, 'pulse' | 'fade' | 'none'>>(new Map());
  const { publicKey } = useWallet();

  // Handle highlighting animation for newly discovered trades
  useEffect(() => {
    const newlyDiscoveredTrades = trades.filter(trade => trade.isNewlyDiscovered);
    
    if (newlyDiscoveredTrades.length > 0) {
      const newHighlightedIds = new Set(newlyDiscoveredTrades.map(trade => trade.id));
      const newAnimationPhases = new Map<string, 'pulse' | 'fade' | 'none'>();
      
      // Set all newly discovered trades to pulse phase
      newlyDiscoveredTrades.forEach(trade => {
        newAnimationPhases.set(trade.id, 'pulse');
      });
      
      setHighlightedTrades(newHighlightedIds);
      setAnimationPhase(newAnimationPhases);
      
      // After pulse animation (2s), switch to fade phase
      setTimeout(() => {
        const fadePhases = new Map<string, 'pulse' | 'fade' | 'none'>();
        newlyDiscoveredTrades.forEach(trade => {
          fadePhases.set(trade.id, 'fade');
        });
        setAnimationPhase(fadePhases);
        
        // After fade animation (1s), remove highlighting
        setTimeout(() => {
          setHighlightedTrades(new Set());
          setAnimationPhase(new Map());
        }, 1000);
      }, 2000);
    }
  }, [trades]);

  // Enhanced debugging for trade data issues
  console.log('DEBUG - TradeOpportunitiesTable - Trades received:', trades?.length || 0);
  
  // Check for newly discovered trades
  const newlyDiscoveredCount = trades.filter(trade => trade.isNewlyDiscovered).length;
  if (newlyDiscoveredCount > 0) {
    console.log(`DEBUG - ${newlyDiscoveredCount} newly discovered trades with highlighting`);
  }
  
  // Detailed logging for each trade
  if (trades && trades.length > 0) {
    trades.forEach((trade, index) => {
      console.log(`DEBUG - Trade #${index + 1} (ID: ${trade.id}):`);
      console.log(`  Total Steps: ${trade.steps?.length || 0}`);
      console.log(`  Total Participants: ${trade.totalParticipants || 'unknown'}`);
      console.log(`  Efficiency: ${Math.round((trade.efficiency || 0) * 100)}%`);
      
      if (trade.steps && trade.steps.length > 0) {
        console.log('  Steps Details:');
        trade.steps.forEach((step, stepIndex) => {
          const sender = step.from;
          const receiver = step.to;
          const nfts = step.nfts || [];
          const isUserSender = publicKey && sender === publicKey.toString();
          const isUserReceiver = publicKey && receiver === publicKey.toString();
          
          console.log(`    Step ${stepIndex + 1}: ${sender.substring(0, 8)}→${receiver.substring(0, 8)}`);
          console.log(`      NFTs: ${nfts.length > 0 ? nfts.map(n => n.name || n.address).join(', ') : 'none'}`);
          console.log(`      User Involvement: ${isUserSender ? 'SENDER' : ''}${isUserSender && isUserReceiver ? ' & ' : ''}${isUserReceiver ? 'RECEIVER' : ''}${!isUserSender && !isUserReceiver ? 'NONE' : ''}`);
          
          // Deep check of NFT properties
          if (nfts.length > 0) {
            nfts.forEach((nft, nftIndex) => {
              console.log(`      NFT #${nftIndex + 1} Properties Check:`);
              console.log(`        Address: ${nft.address ? 'YES' : 'MISSING'}`);
              console.log(`        Name: ${nft.name ? 'YES' : 'MISSING'}`);
              console.log(`        Image: ${nft.image ? 'YES' : 'MISSING'}`);
              console.log(`        Collection: ${nft.collection ? 'YES' : 'MISSING'}`);
            });
          }
        });
        
        // Look specifically for the user's role
        if (publicKey) {
          const userWalletAddress = publicKey.toString();
          const userSendingSteps = trade.steps.filter(step => step.from === userWalletAddress);
          const userReceivingSteps = trade.steps.filter(step => step.to === userWalletAddress);
          
          console.log(`  User Wallet: ${userWalletAddress.substring(0, 8)}`);
          console.log(`  User is Sender in ${userSendingSteps.length} steps`);
          console.log(`  User is Receiver in ${userReceivingSteps.length} steps`);
          
          // Check sequential order for user
          const firstStep = trade.steps[0];
          const lastStep = trade.steps[trade.steps.length - 1];
          
          console.log(`  First Step - From: ${firstStep.from.substring(0, 8)} (User? ${firstStep.from === userWalletAddress})`);
          console.log(`  Last Step - To: ${lastStep.to.substring(0, 8)} (User? ${lastStep.to === userWalletAddress})`);
          console.log(`  Proper Sequential Order: ${firstStep.from === userWalletAddress && lastStep.to === userWalletAddress ? 'YES' : 'NO'}`);
        }
      } else {
        console.log('  WARNING: No steps in this trade loop!');
      }
      
      console.log('-----------------------------------');
    });
  } else {
    console.log('DEBUG - No trades to display');
  }

  // Function to toggle expanded trade
  const toggleExpand = (tradeId: string) => {
    setExpandedTradeId(expandedTradeId === tradeId ? null : tradeId);
  };

  // Get the NFT the user is giving in a trade
  const getUserNFT = (trade: TradeLoop): NFTMetadata[] | null => {
    if (!publicKey || !trade.steps || trade.steps.length === 0) return null;
    const userWalletAddress = publicKey.toString();
    
    const firstStep = trade.steps[0];
    if (firstStep.from === userWalletAddress && firstStep.nfts && firstStep.nfts.length > 0) {
      return firstStep.nfts;
    }
    
    const userSendingStep = trade.steps.find(step => step.from === userWalletAddress);
    return userSendingStep?.nfts || null;
  };

  // Get the NFT the user is receiving in a trade
  const getReceivingNFT = (trade: TradeLoop): NFTMetadata[] | null => {
    if (!publicKey || !trade.steps || !trade.steps.length) return null;
    const userWalletAddress = publicKey.toString();

    const lastStep = trade.steps[trade.steps.length - 1];
    if (lastStep.to === userWalletAddress && lastStep.nfts && lastStep.nfts.length > 0) {
      return lastStep.nfts;
    }

    const userReceivingStep = trade.steps.find(step => step.to === userWalletAddress);
    return userReceivingStep?.nfts || null;
  };

  // Filter trades based on minTradeScore
  const filteredTrades = trades.filter(trade => Math.round(trade.efficiency * 100) >= minTradeScore);

  return (
    <TableContainer>
      {title && (
        <TableHeaderContainer>
          <h3>{title}</h3>
          <FilterDropdownContainer>
            <FilterLabel htmlFor="scoreFilter">Min. Quality:</FilterLabel>
            <FilterSelect id="scoreFilter" value={minTradeScore} onChange={onMinTradeScoreChange}>
              <option value="0">All</option>
              <option value="95">95%</option>
              <option value="90">90%</option>
              <option value="80">80%</option>
              <option value="70">70%</option>
              <option value="60">60%</option>
              <option value="50">50%</option>
              <option value="40">40%</option>
              <option value="30">30%</option>
              <option value="20">20%</option>
              <option value="10">10%</option>
            </FilterSelect>
          </FilterDropdownContainer>
        </TableHeaderContainer>
      )}
      <Table>
        <TableHeader>
          <tr>
            <th>You Give</th>
            <th>You Receive</th>
            <th>Participants</th>
            <th>Quality</th>
            <th>Actions</th>
          </tr>
        </TableHeader>
        <TableBody>
          {filteredTrades && filteredTrades.length > 0 ? (
            filteredTrades.map(trade => {
              const userNFTRowItems: NFTMetadata[] | null = getUserNFT(trade);
              const receivingNFTRowItems: NFTMetadata[] | null = getReceivingNFT(trade);
              
              return (
                <React.Fragment key={trade.id}>
                  <ExpandableTr onClick={() => toggleExpand(trade.id)} $isHighlighted={highlightedTrades.has(trade.id)} $animationPhase={animationPhase.get(trade.id)}>
                    <td>
                      {userNFTRowItems && userNFTRowItems.length > 0 ? (
                        <NFTPreview>
                          {userNFTRowItems.map((nftItem, index) => (
                            <div key={`${nftItem.address}-${index}-give`} style={{ display: 'flex', alignItems: 'center', marginBottom: index < userNFTRowItems.length - 1 ? '8px' : '0' }}>
                              {nftItem && nftItem.address ? <TableNftImage nftItem={nftItem} /> : <NFTImage src={createDataURIPlaceholder('NFT', 'unknown-give-'+index)} alt="Missing NFT data" />}
                              <NFTInfo>
                                <span>{nftItem?.name || 'Unknown NFT'}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span style={{ fontSize: '0.75rem', color: '#a0a0b0'}}>
                                    {getCollectionName(nftItem?.collection, nftItem?.name, nftItem?.symbol)}
                                  </span>
                                  {nftItem?.isMagicEdenBadged && (
                                    <span style={{ fontSize: '0.65rem', color: '#00E0B5', fontWeight: 'bold' }} title="Verified by Magic Eden">
                                      (ME ✓)
                                    </span>
                                  )}
                                </div>
                              </NFTInfo>
                            </div>
                          ))}
                        </NFTPreview>
                      ) : <span>-</span>}
                    </td>
                    <td>
                      {receivingNFTRowItems && receivingNFTRowItems.length > 0 ? (
                        <NFTPreview>
                          {receivingNFTRowItems.map((nftItem, index) => (
                            <div key={`${nftItem.address}-${index}-receive`} style={{ display: 'flex', alignItems: 'center', marginBottom: index < receivingNFTRowItems.length - 1 ? '8px' : '0' }}>
                             {nftItem && nftItem.address ? <TableNftImage nftItem={nftItem} /> : <NFTImage src={createDataURIPlaceholder('NFT', 'unknown-receive-'+index)} alt="Missing NFT data" />}
                              <NFTInfo>
                                <span>{nftItem?.name || 'Unknown NFT'}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span style={{ fontSize: '0.75rem', color: '#a0a0b0'}}>
                                    {getCollectionName(nftItem?.collection, nftItem?.name, nftItem?.symbol)}
                                  </span>
                                  {nftItem?.isMagicEdenBadged && (
                                    <span style={{ fontSize: '0.65rem', color: '#00E0B5', fontWeight: 'bold' }} title="Verified by Magic Eden">
                                      (ME ✓)
                                    </span>
                                  )}
                                </div>
                              </NFTInfo>
                            </div>
                          ))}
                        </NFTPreview>
                      ) : <span>-</span>}
                    </td>
                    <td>{trade.totalParticipants || trade.steps.length}</td>
                    <td>
                      <EfficiencyBadge $efficiency={trade.efficiency}>
                        {Math.round(trade.efficiency * 100)}%
                      </EfficiencyBadge>
                    </td>
                    <td style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          toggleExpand(trade.id); 
                        }}
                        style={{ 
                          color: expandedTradeId === trade.id ? '#6d66d6' : 'inherit',
                          fontWeight: expandedTradeId === trade.id ? 'bold' : 'normal',
                          cursor: 'pointer',
                          marginRight: '10px'
                        }}>
                        {expandedTradeId === trade.id ? 'Hide Details' : 'View Details'}
                      </span>
                      <RejectButton 
                        onClick={(e) => {
                          e.stopPropagation(); 
                          onRejectTrade(trade.id);
                        }}
                        aria-label="Reject Trade"
                      >
                        ×
                      </RejectButton>
                    </td>
                  </ExpandableTr>
                  
                  {expandedTradeId === trade.id && (
                    <ExpandedContent>
                      <td colSpan={5}>
                        <ExpandedContentInner>
                          <TradeFlow
                            key={`${trade.id}-flow`} // Ensure unique key for TradeFlow
                            steps={trade.steps}
                            efficiency={trade.efficiency}
                            id={trade.id}
                            onReject={() => onRejectTrade(trade.id)}
                          />
                        </ExpandedContentInner>
                      </td>
                    </ExpandedContent>
                  )}
                </React.Fragment>
              );
            })
          ) : (
            <tr>
              <td colSpan={5} style={{textAlign: 'center', padding: '20px'}}>
                No trade opportunities found for the selected quality.
              </td>
            </tr>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default TradeOpportunitiesTable; 