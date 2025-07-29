import React, { useState } from 'react';
import styled from 'styled-components';
import { TradeLoop } from '@/types/trade';
import { useWallet } from '@solana/wallet-adapter-react';
import { TradeFlow } from './TradeFlow';
import { fixImageUrl, handleImageError } from '@/utils/imageUtils';
import { getCollectionName } from '@/utils/nftUtils';

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

const ExpandableTr = styled.tr`
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  
  &:after {
    content: '';
    position: absolute;
    left: 0;
    width: 0;
    height: 100%;
    background: ${({ theme }) => theme.colors.primary}10;
    z-index: 0;
    transition: width 0.2s ease;
  }
  
  &:hover {
    transform: translateX(2px);
    
    &:after {
      width: 100%;
    }
    
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

interface TradeOpportunitiesTableProps {
  trades: TradeLoop[];
  onRejectTrade: (tradeId: string) => void;
  title?: string;
}

const TradeOpportunitiesTable: React.FC<TradeOpportunitiesTableProps> = ({ trades, onRejectTrade, title }) => {
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const { publicKey } = useWallet();

  // Enhanced debugging for trade data issues
  console.log('DEBUG - TradeOpportunitiesTable - Trades received:', trades?.length || 0);
  
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
  const getUserNFT = (trade: TradeLoop) => {
    if (!publicKey) return null;
    
    // Try getting from first step (if properly ordered)
    if (trade.steps && trade.steps.length > 0 && 
        trade.steps[0].from === publicKey.toString() && 
        trade.steps[0].nfts && trade.steps[0].nfts.length > 0) {
      const nft = trade.steps[0].nfts[0];
      console.log('User giving NFT (first step):', nft?.name || 'unknown');
      return nft;
    }
    
    // Fallback to any step where user is the sender
    const userSendingStep = trade.steps.find(step => step.from === publicKey.toString());
    const nft = userSendingStep?.nfts[0] || null;
    if (nft) console.log('User giving NFT (fallback):', nft?.name || 'unknown');
    else console.log('User giving NFT: NOT FOUND');
    return nft;
  };

  // Get the NFT the user is receiving in a trade
  const getReceivingNFT = (trade: TradeLoop) => {
    if (!publicKey) return null;
    
    // Try getting from last step (if properly ordered)
    if (trade.steps && trade.steps.length > 0 && 
        trade.steps[trade.steps.length-1].to === publicKey.toString() && 
        trade.steps[trade.steps.length-1].nfts && trade.steps[trade.steps.length-1].nfts.length > 0) {
      const nft = trade.steps[trade.steps.length-1].nfts[0];
      console.log('User receiving NFT (last step):', nft?.name || 'unknown');
      return nft;
    }
    
    // Fallback to any step where user is the receiver
    const userReceivingStep = trade.steps.find(step => step.to === publicKey.toString());
    const nft = userReceivingStep?.nfts[0] || null;
    if (nft) console.log('User receiving NFT (fallback):', nft?.name || 'unknown');
    else console.log('User receiving NFT: NOT FOUND');
    return nft;
  };

  return (
    <TableContainer>
      {title && (
        <TableHeaderContainer>
          <h3>{title}</h3>
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
          {trades && trades.length > 0 ? (
            trades.map(trade => {
              const userNFT = getUserNFT(trade);
              const receivingNFT = getReceivingNFT(trade);
              
              return (
                <React.Fragment key={trade.id}>
                  <ExpandableTr onClick={() => toggleExpand(trade.id)}>
                    <td>
                      {userNFT && (
                        <NFTPreview>
                          <NFTImage 
                            src={userNFT.image ? fixImageUrl(userNFT.image, userNFT.address) : ''}
                            alt={userNFT.name}
                            onError={handleImageError}
                          />
                          <NFTInfo>
                            <span>{userNFT.name}</span>
                            <span>
                              {userNFT.name?.split('#')[0]?.trim() || userNFT.symbol || getCollectionName(userNFT.collection, userNFT.name, userNFT.symbol)}
                            </span>
                          </NFTInfo>
                        </NFTPreview>
                      )}
                    </td>
                    <td>
                      {receivingNFT && (
                        <NFTPreview>
                          <NFTImage 
                            src={receivingNFT.image ? fixImageUrl(receivingNFT.image, receivingNFT.address) : ''}
                            alt={receivingNFT.name}
                            onError={handleImageError}
                          />
                          <NFTInfo>
                            <span>{receivingNFT.name}</span>
                            <span>
                              {receivingNFT.name?.split('#')[0]?.trim() || receivingNFT.symbol || getCollectionName(receivingNFT.collection, receivingNFT.name, receivingNFT.symbol)}
                            </span>
                          </NFTInfo>
                        </NFTPreview>
                      )}
                    </td>
                    <td>{trade.totalParticipants || trade.steps.length}</td>
                    <td>
                      <EfficiencyBadge $efficiency={trade.efficiency}>
                        {Math.round(trade.efficiency * 100)}%
                      </EfficiencyBadge>
                    </td>
                    <td>
                      <span style={{ 
                        color: expandedTradeId === trade.id ? '#6d66d6' : 'inherit',
                        fontWeight: expandedTradeId === trade.id ? 'bold' : 'normal'
                      }}>
                        {expandedTradeId === trade.id ? 'Hide Details' : 'View Details'}
                      </span>
                    </td>
                  </ExpandableTr>
                  
                  {expandedTradeId === trade.id && (
                    <ExpandedContent>
                      <td colSpan={5}>
                        <ExpandedContentInner>
                          <TradeFlow
                            key={trade.id}
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
                No trade opportunities found
              </td>
            </tr>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default TradeOpportunitiesTable; 