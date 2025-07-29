'use client';

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { NFTService } from '@/services/nft';
import { TradeService } from '@/services/trade';
import { SearchInput } from '@/components/SearchInput';
import { NFTCard } from '@/components/NFTCard';
import { TradeFlow } from '@/components/trades/TradeFlow';
import TradeOpportunitiesTable from '@/components/trades/TradeOpportunitiesTable';
import SearchResultCard from '@/components/SearchResultCard';
import { TradeLoop } from '@/types/trade';
import { NFTMetadata } from '@/types/nft';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import WalletModal from '@/components/WalletModal';
import { TradeStatusService, TradeHistoryItem } from '@/services/trade-status';
import { PublicKey } from '@solana/web3.js';
import TradeStats from '@/components/stats/TradeStats';
import TradeActivity from '@/components/stats/TradeActivity';
import PopularCollections from '@/components/stats/PopularCollections';
import TradingMetrics from '@/components/stats/TradingMetrics';
import UserTradeSummary from '@/components/stats/UserTradeSummary';
import StatsService, { TradeStatistic, MetricDataPoint, NFTCollection, TradeActivityItem, UserTradeStats } from '@/services/stats';
require('@solana/wallet-adapter-react-ui/styles.css');

// Base styles to prevent horizontal scrolling
const BaseStyles = `
  box-sizing: border-box;
  max-width: 100%;
`;

const AppContainer = styled.div`
  min-height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  color: ${({ theme }) => theme.colors.textPrimary};
  overflow-x: hidden;
  overflow-y: visible;
  box-sizing: border-box;
  max-width: 100vw;
  background-color: #111314;
  animation: fadeIn 0.3s ease-in-out;
  
  @keyframes fadeIn {
    from { opacity: 0.8; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const Container = styled.div`
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  padding: 0.75rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow-x: hidden;
  box-sizing: border-box;
  background-color: #111314;
  
  @media (max-width: 640px) {
    padding: 0.5rem;
  }
`;

const Header = styled.header`
  padding: 0.25rem 0;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  position: relative;
  width: 100%;
  flex-wrap: wrap;
  
  @media (max-width: 600px) {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  &::after {
    content: '';
    position: absolute;
    bottom: -0.25rem;
    left: 5%;
    right: 5%;
    height: 1px;
    background: linear-gradient(
      90deg, 
      transparent, 
      ${({ theme }) => theme.colors.surfaceBorder},
      transparent
    );
  }
`;

const TitleContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  position: relative;
  z-index: 1;
  
  @media (max-width: 600px) {
    align-items: center;
    width: 100%;
  }
`;

const Title = styled.h1`
  font-family: var(--font-michroma), sans-serif;
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.15rem;
  color: white;
  letter-spacing: -1px;
  position: relative;
  transition: all 0.3s ease;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  
  &:hover {
    transform: translateY(-1px);
  }
  
  @media (max-width: 600px) {
    font-size: 1.8rem;
  }
`;

const Subtitle = styled.p`
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 0.15rem;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  letter-spacing: -0.5px;
  opacity: 0.8;
  transition: all 0.3s ease;
  
  ${TitleContainer}:hover & {
    opacity: 1;
    transform: translateY(1px);
  }
`;

const Content = styled.div`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  height: auto;
  min-height: calc(100vh - 100px);
  overflow-y: visible;
  overflow-x: hidden;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  position: relative;
  padding: 0;
  background-color: #111314;
`;

const SearchContainer = styled.div`
  max-width: 800px;
  width: 100%;
  margin: 0 auto 0.5rem auto;
  box-sizing: border-box;
  padding: 0 1rem;
  overflow-x: hidden;
  overflow-y: visible;
`;

const GridContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex-grow: 1;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  overflow-y: visible;
  box-sizing: border-box;
  padding: 0;
  padding-bottom: 1rem;
  
  @media (max-width: 640px) {
    padding: 0;
    gap: 0.5rem;
  }
`;

const NFTGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin: 0.5rem 0;
  width: 100%;
  box-sizing: border-box;
`;

const ErrorText = styled.p`
  color: ${({ theme }) => theme.colors.error};
  text-align: center;
  margin: 0.5rem 0;
  padding: 0.5rem;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: 1px solid ${({ theme }) => theme.colors.error};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  word-break: break-word;
`;

const MessageContainer = styled.div`
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  border: 1px solid ${({ theme }) => theme.colors.surfaceBorder};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: 1rem;
  text-align: center;
  margin: 1rem auto;
  max-width: 600px;
  box-sizing: border-box;
`;

const MessageText = styled.p`
  color: ${({ theme }) => theme.colors.textSecondary};
  text-align: center;
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  word-break: break-word;
`;

const LoadingText = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  margin: 2rem 0;
  
  &::after {
    content: '';
    width: 20px;
    height: 20px;
    margin-left: 10px;
    border: 3px solid ${({ theme }) => theme.colors.textSecondary};
    border-top-color: ${({ theme }) => theme.colors.primary};
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const WalletSection = styled.div`
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  
  @media (max-width: 450px) {
    width: 100%;
    justify-content: center;
  }

  /* Override Solana wallet adapter button styles */
  .wallet-adapter-button {
    background-color: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.surfaceBorder};
    color: ${({ theme }) => theme.colors.textPrimary};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
    padding: 0.5rem 1rem;
    height: auto;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: all 0.25s ease;
    
    @media (max-width: 450px) {
      font-size: ${({ theme }) => theme.typography.fontSize.xs};
      padding: 0.4rem 0.8rem;
    }
    
    &:hover {
      background-color: ${({ theme }) => theme.colors.primary}10;
      border-color: ${({ theme }) => theme.colors.primary};
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(103, 69, 255, 0.15);
    }
    
    &:active {
      transform: translateY(0);
    }
  }
`;

const TradeLoopDisplay = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  overflow: visible;
  padding: 0;
  margin-top: 1.5rem;
  margin-bottom: 0;
  animation: slideUp 0.4s ease;
  
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @media (max-width: 640px) {
    padding: 0;
  }
`;

const Button = styled.button`
  background: linear-gradient(
    90deg, 
    ${({ theme }) => theme.colors.gradientStart}, 
    ${({ theme }) => theme.colors.gradientEnd}
  );
  color: white;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  padding: 0.75rem 1.5rem;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all 0.25s ease;
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  margin: 1.5rem auto;
  display: block;
  width: fit-content;
  position: relative;
  overflow: hidden;
  
  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.2),
      transparent
    );
    transition: left 0.7s ease;
  }
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(103, 69, 255, 0.25);
    
    &:before {
      left: 100%;
    }
  }
  
  &:active {
    transform: translateY(1px);
  }
  
  &:disabled {
    background: ${({ theme }) => theme.colors.backgroundSecondary};
    color: ${({ theme }) => theme.colors.textMuted};
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }
`;

const WalletIconButton = styled.button`
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(164, 164, 181, 0.2);
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
  
  &:before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(
      circle,
      rgba(103, 69, 255, 0.1),
      transparent 70%
    );
    opacity: 0;
    transform: scale(0.5);
    transition: all 0.3s ease;
  }
  
  &:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(103, 69, 255, 0.4);
    transform: translateY(-2px);
    
    &:before {
      opacity: 1;
      transform: scale(1);
    }
    
    svg {
      color: ${({ theme }) => theme.colors.primary};
      transform: scale(1.1);
    }
  }
  
  &:active {
    transform: translateY(0);
  }
  
  svg {
    transition: all 0.2s ease;
    color: #a4a4b5;
  }
`;

const TradeStatusSection = styled.section`
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  box-sizing: border-box;
`;

const StatsContainer = styled.div`
  margin-top: 0;
  padding-top: 1rem;
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: visible;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 100%;
  
  & > * {
    animation: fadeInStats 0.5s ease backwards;
  }
  
  & > *:nth-child(1) { animation-delay: 0.1s; }
  & > *:nth-child(2) { animation-delay: 0.2s; }
  & > *:nth-child(3) { animation-delay: 0.3s; }
  & > *:nth-child(4) { animation-delay: 0.4s; }
  
  @keyframes fadeInStats {
    from { opacity: 0; transform: translateY(15px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  
  /* Ensure both child components have the same height */
  & > * {
    min-height: 300px; /* Set a standard minimum height for all immediate children */
    height: 100%; /* Make all components fill the row height */
  }
  
  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
    gap: 1.5rem;
    margin: 0;
    
    & > * {
      min-height: 250px; /* Slightly reduced height for mobile */
    }
  }
`;

const SectionTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  margin-bottom: 0.5rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  letter-spacing: -0.5px;
`;

export default function Home() {
  const [nfts, setNfts] = useState<NFTMetadata[]>([]);
  const [trades, setTrades] = useState<TradeLoop[]>([]);
  const [rejectedTradeIds, setRejectedTradeIds] = useState<Set<string>>(new Set());
  const [searchedNFT, setSearchedNFT] = useState<NFTMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [selectedTradeLoop, setSelectedTradeLoop] = useState<TradeLoop | null>(null);
  const { publicKey, connected } = useWallet();
  const [globalStats, setGlobalStats] = useState<TradeStatistic[]>([]);
  const [tradingMetrics, setTradingMetrics] = useState<{
    volumeData: MetricDataPoint[];
    tradesData: MetricDataPoint[];
    participantsData: MetricDataPoint[];
    totalVolume: string;
    totalTrades: string;
    totalParticipants: string;
  }>({
    volumeData: [],
    tradesData: [],
    participantsData: [],
    totalVolume: '0',
    totalTrades: '0',
    totalParticipants: '0'
  });
  const [popularCollections, setPopularCollections] = useState<NFTCollection[]>([]);
  const [recentActivity, setRecentActivity] = useState<TradeActivityItem[]>([]);
  const [userStats, setUserStats] = useState<UserTradeStats>({
    totalTradesExecuted: 0,
    totalTradesCreated: 0,
    totalNFTsTraded: 0,
    successRate: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!connected) return;
      
      setStatsLoading(true);
      try {
        const statsService = StatsService.getInstance();
        const tradeStatusService = TradeStatusService.getInstance();
        
        // Get current wallet address
        const walletAddress = publicKey ? publicKey.toString() : null;
        
        // Use only real blockchain data
        let activeTrades = 0;
        let completedTrades = 0;
        let userTradeCount = 0;
        let userTrades: any[] = [];
        let tradeHistory: TradeHistoryItem[] = [];
        
        // Get active trade count - this is real data from the blockchain
        const activeTradeAddresses = await tradeStatusService.getActiveTradeLoopAddresses();
        activeTrades = activeTradeAddresses.length;
        console.log('Active trades count:', activeTrades);
        
        // Get completed trade count - this is real data from the blockchain
        completedTrades = await tradeStatusService.getCompletedTradeCount();
        console.log('Completed trades count:', completedTrades);
        
        // Get user trade history if wallet is connected
        if (walletAddress) {
          userTrades = await tradeStatusService.getUserTrades(walletAddress);
          userTradeCount = userTrades.length;
          
          tradeHistory = await tradeStatusService.getUserTradeHistory(walletAddress);
          console.log('User trades:', userTradeCount, 'User history:', tradeHistory.length);
        }
        
        // Calculate actual stats
        const totalTrades = activeTrades + completedTrades;
        // Only calculate success rate if there are trades
        const successRate = totalTrades > 0 ? Math.round((completedTrades / totalTrades) * 100) : 0;
        
        // Fetch all stats in parallel, but only using real blockchain data
        const [
          globalStatsData,
          metricsData,
          collectionsData,
          activityData,
          userStatsData
        ] = await Promise.all([
          // Global stats using only real data
          (async () => {
            // Only use data that we can confirm from the blockchain
            const stats: TradeStatistic[] = [];
            
            // Active trades (real data)
            if (activeTrades >= 0) {
              stats.push({
                label: 'Active Trades',
                value: activeTrades,
                tooltip: 'Number of trade loops currently waiting for completion'
              });
            }
            
            // Completed trades (real data)
            if (completedTrades >= 0) {
              stats.push({
                label: 'Completed Trades',
                value: completedTrades,
                tooltip: 'Number of successfully executed trades'
              });
            }
            
            // Success rate (calculated from real data)
            if (totalTrades > 0) {
              stats.push({
                label: 'Success Rate',
                value: `${successRate}%`,
                tooltip: 'Percentage of created trades that complete successfully'
              });
            }
            
            // Total trade volume (from actual trades)
            const totalVolume = userTrades.reduce((sum, trade) => {
              // Add value of each trade if available
              return sum + (trade.value || 0);
            }, 0);
            
            if (totalVolume > 0) {
              stats.push({
                label: 'Total Trade Volume',
                value: `${totalVolume.toFixed(2)} SOL`,
                tooltip: 'Total value of all completed trades on the platform'
              });
            }
            
            // Only add unique traders stat if we have real data
            const uniqueParticipants = new Set<string>();
            userTrades.forEach(trade => {
              if (trade.participants) {
                trade.participants.forEach((participant: string) => {
                  uniqueParticipants.add(participant);
                });
              }
            });
            
            if (uniqueParticipants.size > 0) {
              stats.push({
                label: 'Unique Traders',
                value: uniqueParticipants.size,
                tooltip: 'Number of unique wallet addresses that have participated in trades'
              });
            }
            
            // Only return stats if we have any
            return stats.length > 0 ? stats : [];
          })(),
          
          // Metrics using only real trade data
          (async () => {
            try {
              const realMetrics = {
                volumeData: [] as MetricDataPoint[],
                tradesData: [] as MetricDataPoint[],
                participantsData: [] as MetricDataPoint[],
                totalVolume: '0',
                totalTrades: totalTrades.toString(),
                totalParticipants: '0'
              };
              
              // Only populate with real data if trades exist
              if (userTrades.length > 0) {
                // Group trades by date
                const tradesByDate = new Map<string, { count: number, volume: number, participants: Set<string> }>();
                userTrades.forEach(trade => {
                  if (!trade.createdAt) return;
                  
                  const date = new Date(trade.createdAt);
                  const dateKey = `${date.getMonth() + 1}/${date.getDate()}`;
                  
                  if (!tradesByDate.has(dateKey)) {
                    tradesByDate.set(dateKey, { count: 0, volume: 0, participants: new Set<string>() });
                  }
                  
                  const dateData = tradesByDate.get(dateKey)!;
                  dateData.count++;
                  dateData.volume += (trade.value || 0);
                  
                  if (trade.participants) {
                    trade.participants.forEach((p: string) => dateData.participants.add(p));
                  }
                });
                
                // Convert to arrays
                tradesByDate.forEach((data, date) => {
                  realMetrics.volumeData.push({ date, value: data.volume });
                  realMetrics.tradesData.push({ date, value: data.count });
                  realMetrics.participantsData.push({ date, value: data.participants.size });
                });
                
                // Calculate totals
                const totalVolume = userTrades.reduce((sum, t) => sum + (t.value || 0), 0);
                const allParticipants = new Set<string>();
                userTrades.forEach(t => {
                  if (t.participants) {
                    t.participants.forEach((p: string) => allParticipants.add(p));
                  }
                });
                
                realMetrics.totalVolume = totalVolume.toFixed(2);
                realMetrics.totalParticipants = allParticipants.size.toString();
              }
              
              return realMetrics;
            } catch (e) {
              console.error('Error computing real metrics:', e);
              return {
                volumeData: [],
                tradesData: [],
                participantsData: [],
                totalVolume: '0',
                totalTrades: '0',
                totalParticipants: '0'
              };
            }
          })(),
          
          // Collections using only real NFT data
          (async () => {
            try {
              // Only use real collections data from actual trades
              const collections: Record<string, NFTCollection> = {};
              
              userTrades.forEach(trade => {
                if (!trade.nfts) return;
                
                trade.nfts.forEach((nft: any) => {
                  let collectionId = 'unknown';
                  let collectionName = 'Unknown Collection';
                  
                  // Extract collection information
                  if (nft.collection) {
                    if (typeof nft.collection === 'string') {
                      collectionId = nft.collection;
                      collectionName = nft.collection;
                    } else if (nft.collection.address) {
                      collectionId = nft.collection.address;
                      collectionName = nft.collection.name || 'Unknown Collection';
                    }
                  }
                  
                  // Create or update collection
                  if (!collections[collectionId]) {
                    collections[collectionId] = {
                      id: collectionId,
                      name: collectionName,
                      imageUrl: nft.image || '',
                      tradeVolume: 0,
                      tradeCount: 0
                    };
                  }
                  
                  // Update stats
                  collections[collectionId].tradeCount++;
                  collections[collectionId].tradeVolume += (trade.value || 0) / (trade.nfts.length || 1);
                });
              });
              
              // Convert to array and sort
              const collectionsArray = Object.values(collections);
              return collectionsArray.sort((a, b) => b.tradeVolume - a.tradeVolume);
            } catch (e) {
              console.error('Error computing collections from real data:', e);
              return [];
            }
          })(),
          
          // Activity using only real trade history
          (async () => {
            try {
              if (tradeHistory && tradeHistory.length > 0) {
                // Convert real history to activity items
                return tradeHistory.map(trade => ({
                  id: trade.id,
                  type: trade.status as 'execution' | 'creation' | 'approval' | 'expiration' | 'rejection',
                  tradeId: trade.address || 'unknown',
                  participants: trade.participants?.length || 0,
                  nfts: trade.nfts?.map((nft: NFTMetadata) => nft.name || 'Unnamed NFT') || [],
                  timestamp: new Date(trade.timestamp)
                }));
              }
              return [];
            } catch (e) {
              console.error('Error converting real trade history to activity:', e);
              return [];
            }
          })(),
          
          // User stats using only real user data
          (async () => {
            if (!walletAddress) return null;
            
            try {
              // Only use real user data
              const completedUserTrades = userTrades.filter(t => t.status === 'completed').length;
              const createdUserTrades = userTrades.filter(t => t.creator === walletAddress).length;
              
              // Count NFTs
              let nftCount = 0;
              userTrades.forEach(trade => {
                if (trade.nfts) nftCount += trade.nfts.length;
              });
              
              // Calculate success rate only if there are trades
              const userSuccessRate = userTrades.length > 0 
                ? (completedUserTrades / userTrades.length) * 100 
                : 0;
              
              return {
                totalTradesExecuted: completedUserTrades,
                totalTradesCreated: createdUserTrades,
                totalNFTsTraded: nftCount,
                successRate: userSuccessRate
              };
            } catch (e) {
              console.error('Error calculating real user stats:', e);
              return null;
            }
          })()
        ]);
        
        setGlobalStats(globalStatsData);
        setTradingMetrics(metricsData);
        setPopularCollections(collectionsData);
        setRecentActivity(activityData);
        if (userStatsData) setUserStats(userStatsData);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setStatsLoading(false);
      }
    };
    
    fetchStats();
  }, [connected, publicKey]);

  const handleSearch = async (address: string) => {
    if (!connected || !publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);
    setTrades([]);
    
    try {
      const nftService = NFTService.getInstance();
      const nft = await nftService.getNFTMetadata(address);
      setSearchedNFT(nft);
      setNfts([nft]);
      setMessage('NFT found! Click "Find Potential Trades" to search for trade opportunities.');
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch NFT data');
      setNfts([]);
      setSearchedNFT(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFindTrades = async () => {
    if (!connected || !publicKey || !searchedNFT) {
      setError('Please connect your wallet and search for an NFT first');
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);
    
    try {
      const tradeService = TradeService.getInstance();
      console.log('Searching for trades with wallet:', publicKey.toString());
      const tradeLoops = await tradeService.findTradeLoops(searchedNFT, publicKey.toString());
      console.log('Received trade loops from API:', tradeLoops);
      
      // Enhanced debugging for the specific issue
      console.log('===== DEBUGGING TRADE LOOPS =====');
      console.log(`Total trade loops received: ${tradeLoops.length}`);
      
      // Log each trade for detailed diagnosis
      tradeLoops.forEach((trade, index) => {
        console.log(`\n[Trade ${index + 1} / ${tradeLoops.length}] ID: ${trade.id}`);
        console.log(`Total participants: ${trade.totalParticipants}`);
        console.log(`Efficiency: ${trade.efficiency}`);
        console.log(`Steps: ${trade.steps.length}`);
        
        // Check for the specific 3-way trade loop we're looking for
        const targetWallets = [
          '5pPCbuGso6NguFBWAqaKm7FW9msRoLQQoWu7kawGfFna',
          'NHLeTzVE1BriRr3Uuebyq1aKEjRvWFMozy2BDAuLN2m',
          '52sLrTRsiVrVyxSL8r1rpbJmjtcbQER9QgeiykViUgC8'
        ];
        
        const targetNFTs = [
          'CaE8oUsYRCvRByMYBRrg7vjaaSa4fbHSwXKEdBj8EKNf',
          'ABiGDshndLxs935LEyx5YJ6SrkeMLEBwCmtDtfFcck1W',
          'G7yWHtUEfZgocWwzwChPMXnP91HUXJ2V2GnqUiovkHgs'
        ];
        
        // Is this the problematic trade loop?
        const hasAllTargetWallets = targetWallets.every(wallet => 
          trade.steps.some(step => step.from === wallet || step.to === wallet)
        );
        
        const hasAllTargetNFTs = targetNFTs.every(nft => 
          trade.steps.some(step => step.nfts.some(stepNft => stepNft.address === nft))
        );
        
        if (hasAllTargetWallets && hasAllTargetNFTs) {
          console.log('>>> FOUND THE TARGET TRADE LOOP <<<');
          console.log('Step details:');
          trade.steps.forEach((step, i) => {
            const nftAddresses = step.nfts.map(nft => nft.address).join(', ');
            console.log(`Step ${i+1}: ${step.from} -> ${step.to}`);
            console.log(`  NFTs: ${nftAddresses}`);
            console.log(`  Is user wallet (${publicKey.toString()}) the sender? ${step.from === publicKey.toString()}`);
          });
        }
        
        // Log first step info for filtering logic diagnosis
        if (trade.steps && trade.steps.length > 0) {
          const firstStep = trade.steps[0];
          console.log(`First step: ${firstStep.from} -> ${firstStep.to}`);
          console.log(`Is user wallet (${publicKey.toString()}) the first sender? ${firstStep.from === publicKey.toString()}`);
        }
      });
      
      // Filter trades to show only the permutation where user is the first sender
      // This ensures we don't show multiple permutations of the same trade loop
      const currentWalletAddress = publicKey.toString();
      const relevantTrades = tradeLoops.filter(trade => {
        // Must have at least one step
        if (!trade.steps || trade.steps.length === 0) return false;
        
        // First, validate that this is a proper trade loop for the user
        // (user must be both a sender and receiver for it to be a valid loop)
        const isUserSender = trade.steps.some(step => step.from === currentWalletAddress);
        const isUserReceiver = trade.steps.some(step => step.to === currentWalletAddress);
        const isProperLoop = isUserSender && isUserReceiver;
        
        if (!isProperLoop) {
          console.log(`Trade ${trade.id}: Filtered out - not a proper trade loop for user`);
          return false;
        }
        
        // CRITICAL: We only want to show the permutation where the user is the first sender
        // This filters out duplicate permutations of the same trade loop
        const isFirstSender = trade.steps[0].from === currentWalletAddress;
        console.log(`Trade ${trade.id}: User wallet ${currentWalletAddress} is first sender? ${isFirstSender}`);
        
        // Only keep trades where user is the first sender - this is the permutation from the user's perspective
        return isFirstSender;
      });
      
      // Check if any trades are explicitly submitted
      const submittedTradeIds = JSON.parse(localStorage.getItem('submittedTrades') || '[]');
      
      // Log diagnostic information
      console.log(`Found ${tradeLoops.length} total trades, ${relevantTrades.length} permutations from user's perspective for wallet ${currentWalletAddress}`);
      console.log('Submitted trade IDs from localStorage:', submittedTradeIds);
      
      // DIAGNOSTIC: Log detailed trade information
      logTradeDetails(relevantTrades);
      
      // Set the trades that will be displayed in the UI
      // For discovery, we'll show trades even if they aren't submitted yet
      setTrades(relevantTrades);

      if (relevantTrades.length === 0) {
        setMessage('No trade opportunities found yet. Your trade request has been added to the pool. Check back later when more traders join!');
      }
    } catch (err) {
      console.error('Trade search error:', err);
      setError(err instanceof Error ? err.message : 'Failed to find trade opportunities');
      setTrades([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter out rejected trades
  const visibleTrades = trades.filter(trade => !rejectedTradeIds.has(trade.id));
  console.log('Visible trades:', visibleTrades.length, 'after filtering rejected trades');

  // Handle trade rejection
  const handleTradeRejection = (tradeId: string) => {
    setRejectedTradeIds(prev => {
      const updated = new Set(prev);
      updated.add(tradeId);
      return updated;
    });
  };

  // DIAGNOSTIC: Log wallet connection status and trades
  const logTradeDetails = (trades: TradeLoop[]) => {
    if (trades.length > 0) {
      console.log(`MAIN PAGE DIAGNOSTIC: Found ${trades.length} trade(s) for connected wallet: ${publicKey?.toString() || 'Not connected'}`);
      
      // Log info about the first trade
      if (trades[0]) {
        const trade = trades[0];
        console.log('First trade details:', {
          id: trade.id,
          participants: trade.totalParticipants,
          steps: trade.steps.map(step => ({
            from: step.from,
            to: step.to,
            nftCount: step.nfts.length,
            firstNft: step.nfts[0] ? {
              address: step.nfts[0].address,
              name: step.nfts[0].name,
              owner: step.nfts[0].owner
            } : 'No NFT data'
          }))
        });
      }
    } else {
      console.log(`MAIN PAGE DIAGNOSTIC: No trades found for wallet: ${publicKey?.toString() || 'Not connected'}`);
    }
  };

  return (
    <AppContainer>
      <Container>
        <Header>
          <TitleContainer>
            <Title>SWAPS</Title>
            <Subtitle>More Connections. Better Trades.</Subtitle>
          </TitleContainer>
          <WalletSection>
            {publicKey && (
              <WalletIconButton onClick={() => setIsWalletModalOpen(true)}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 8.25V15.75C3 16.9926 4.00736 18 5.25 18H18.75C19.9926 18 21 16.9926 21 15.75V8.25C21 7.00736 19.9926 6 18.75 6H5.25C4.00736 6 3 7.00736 3 8.25Z" stroke="#a4a4b5" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M3 10H21" stroke="#a4a4b5" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M16.5 15C17.3284 15 18 14.3284 18 13.5C18 12.6716 17.3284 12 16.5 12C15.6716 12 15 12.6716 15 13.5C15 14.3284 15.6716 15 16.5 15Z" fill="#a4a4b5"/>
                  <path d="M7.5 8.25V3.75C7.5 2.92157 8.17157 2.25 9 2.25H15C15.8284 2.25 16.5 2.92157 16.5 3.75V6" stroke="#a4a4b5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </WalletIconButton>
            )}
            <WalletMultiButton />
          </WalletSection>
        </Header>

        <Content>
          <SearchContainer>
            <SearchInput 
              onSearch={handleSearch} 
              placeholder="Enter NFT address to find trades..." 
              disabled={!connected}
            />
            {!isLoading && !error && nfts.length === 0 && !searchedNFT && (
              <MessageText style={{ marginTop: '0.5rem' }}>
                Search for NFTs you want to start trading!
              </MessageText>
            )}
          </SearchContainer>

          <GridContainer>
            {error && <ErrorText>{error}</ErrorText>}
            
            {isLoading ? (
              <LoadingText>Finding the best trades...</LoadingText>
            ) : (
              <>
                {/* Display trade loops when we have trades */}
                {trades.length > 0 && (
                  <TradeLoopDisplay>
                    <TradeOpportunitiesTable 
                      trades={visibleTrades} 
                      onRejectTrade={handleTradeRejection}
                      title="Discovered Trade Opportunities"
                    />
                  </TradeLoopDisplay>
                )}

                {/* Show NFT grid only when there are no trades */}
                {trades.length === 0 && (
                  <>
                    {searchedNFT && (
                      <SearchResultCard
                        nft={searchedNFT}
                        onFindTrades={handleFindTrades}
                        disabled={!connected}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </GridContainer>

          {connected && (
            <StatsContainer>
              <TradeStats stats={globalStats} isLoading={statsLoading} />
              
              <StatsGrid>
                <UserTradeSummary stats={userStats} isLoading={statsLoading} />
                <TradeActivity activities={recentActivity} isLoading={statsLoading} />
              </StatsGrid>
              
              <TradingMetrics 
                volumeData={tradingMetrics.volumeData}
                tradesData={tradingMetrics.tradesData}
                participantsData={tradingMetrics.participantsData}
                totalVolume={tradingMetrics.totalVolume}
                totalTrades={tradingMetrics.totalTrades}
                totalParticipants={tradingMetrics.totalParticipants}
                isLoading={statsLoading}
              />
              
              <StatsGrid>
                <PopularCollections collections={popularCollections} isLoading={statsLoading} />
                <TradeActivity activities={recentActivity} isLoading={statsLoading} limit={3} />
              </StatsGrid>
            </StatsContainer>
          )}
        </Content>

        {isWalletModalOpen && (
          <WalletModal
            isOpen={isWalletModalOpen}
            onClose={() => setIsWalletModalOpen(false)}
          />
        )}
      </Container>
    </AppContainer>
  );
} 
