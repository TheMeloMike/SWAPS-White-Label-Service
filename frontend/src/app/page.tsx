'use client';

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { NFTService } from '@/services/nft';
import { TradeService } from '@/services/trade';
import NFTCard from '@/components/NFTCard';
import { TradeFlow } from '@/components/trades/TradeFlow';
import TradeOpportunitiesTable from '@/components/trades/TradeOpportunitiesTable';
import PendingTradesTable from '@/components/trades/PendingTradesTable';
import UnifiedSearchBar from '@/components/UnifiedSearchBar';
import UnifiedDisplayModal from '@/components/UnifiedDisplayModal';
import { TradeLoop } from '@/types/trade';
import { NFTMetadata } from '@/types/nft';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import WalletModal from '@/components/WalletModal';
import { TradeStatusService, TradeHistoryItem } from '@/services/trade-status';
import { PublicKey } from '@solana/web3.js';
import dynamic from 'next/dynamic';
import LoadingIndicator from '@/components/common/LoadingIndicator';
import StatsService, { TradeStatistic, MetricDataPoint, NFTCollection, TradeActivityItem, UserTradeStats } from '@/services/stats';
import { v4 as uuidv4 } from 'uuid';
import RippleButton from '@/components/common/RippleButton';
import AnimatedCard from '@/components/common/AnimatedCard';
import AnimatedTitle from '../components/AnimatedTitle';
import CommandPalette from '@/components/CommandPalette';
import GlassmorphicCard from '@/components/common/GlassmorphicCard';
import ContextualEmptyState from '@/components/common/ContextualEmptyState';
import HelpModal from '@/components/HelpModal';
import { SwapsKnowledgeService } from '@/services/ai/swaps-knowledge.service';

require('@solana/wallet-adapter-react-ui/styles.css');

// Dynamic imports for code splitting
const TrendingHotSection = dynamic(() => import('@/components/trending/TrendingHotSection'), {
  loading: () => <LoadingContainer><LoadingIndicator size="large" /></LoadingContainer>
});

const TradeStats = dynamic(() => import('@/components/stats/TradeStats'), {
  loading: () => <LoadingContainer><LoadingIndicator size="large" /></LoadingContainer>
});

const PopularCollections = dynamic(() => import('@/components/stats/PopularCollections'), {
  loading: () => <LoadingContainer><LoadingIndicator size="large" /></LoadingContainer>
});

const TradeActivity = dynamic(() => import('@/components/stats/TradeActivity'), {
  loading: () => <LoadingContainer><LoadingIndicator size="large" /></LoadingContainer>
});

const UserTradeSummary = dynamic(() => import('@/components/stats/UserTradeSummary'), {
  loading: () => <LoadingContainer><LoadingIndicator size="large" /></LoadingContainer>
});

const TradingMetrics = dynamic(() => import('@/components/stats/TradingMetrics'), {
  loading: () => <LoadingContainer><LoadingIndicator size="large" /></LoadingContainer>
});

// Add a styled loading container
const LoadingContainer = styled.div`
  width: 100%;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.03);
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

// Interface for a pending trade search item
interface PendingSearchItem {
  id: string; // Unique ID for the pending search, e.g., timestamp or a UUID
  searchedNFT: NFTMetadata; // The NFT the user wants
  initiatedAt: Date;
  // ownedNFT?: NFTMetadata; // Optional: if the search was initiated by offering a specific owned NFT
}

// Function to generate a stable signature for a trade loop
const generateTradeSignature = (trade: TradeLoop): string => {
  if (!trade || !trade.steps || trade.steps.length === 0) return trade.id || Math.random().toString(); // Fallback

  const stepSignatures = trade.steps.map(step => {
    const nftAddresses = step.nfts.map(nft => nft.address).sort().join(',');
    return `${step.from}->${step.to}:${nftAddresses}`;
  });
  // Sort step signatures to ensure order doesn't matter for the overall trade signature
  return stepSignatures.sort().join('|'); 
};

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
  margin: 1.5rem auto 1rem auto;
  box-sizing: border-box;
  padding: 0 1rem;
  overflow: visible !important;
  position: relative;
  z-index: 1000;
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

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  margin: 1.5rem 0;
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
  padding-top: 1.5rem;
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

const AIAssistantBanner = styled.div`
  background: #181a1b;
  border: 1px solid rgba(40, 40, 56, 0.5);
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: 1.5rem;
  margin: 1.5rem auto;
  max-width: 800px;
  animation: fadeIn 0.5s ease;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
`;

const AIAssistantContent = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
  
  @media (max-width: 640px) {
    flex-direction: column;
    text-align: center;
  }
`;

const AIAssistantIcon = styled.div`
  font-size: 48px;
  flex-shrink: 0;
`;

const AIAssistantText = styled.div`
  flex: 1;
`;

const AIAssistantTitle = styled.h3`
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  margin: 0 0 0.5rem 0;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
`;

const AIAssistantDescription = styled.p`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  margin: 0;
  line-height: 1.5;
`;

const AIAssistantButton = styled.a`
  display: inline-flex;
  align-items: center;
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.lg}`};
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  text-decoration: none;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  transition: all 0.2s ease;
  
  &:hover {
    background: ${({ theme }) => theme.colors.primaryDark};
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(109, 102, 214, 0.3);
  }
`;

export default function Home() {
  const [nfts, setNfts] = useState<NFTMetadata[]>([]);
  const [trades, setTrades] = useState<TradeLoop[]>([]);
  const [pendingSearches, setPendingSearches] = useState<PendingSearchItem[]>([]);
  const [rejectedTradeIds, setRejectedTradeIds] = useState<Set<string>>(new Set());
  const [searchedNFT, setSearchedNFT] = useState<NFTMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [selectedTradeLoop, setSelectedTradeLoop] = useState<TradeLoop | null>(null);
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [globalStats, setGlobalStats] = useState<TradeStatistic[]>([]);
  const [minTradeScore, setMinTradeScore] = useState<number>(0);
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
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [helpModalType, setHelpModalType] = useState<'documentation' | 'help'>('help');
  
  // Unified modal state
  const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false);
  const [unifiedModalType, setUnifiedModalType] = useState<'nft' | 'collection' | null>(null);
  const [unifiedModalData, setUnifiedModalData] = useState<NFTMetadata | any | null>(null);

  const handleCancelPendingSearch = (searchId: string) => {
    setPendingSearches(prevSearches => prevSearches.filter(search => search.id !== searchId));
    console.log(`Pending search cancelled (frontend only): ${searchId}`);
  };

  // Handle unified search results
  const handleUnifiedSearchResult = (result: any) => {
    console.log('handleUnifiedSearchResult called with:', result);
    setUnifiedModalType(result.type);
    setUnifiedModalData(result.data);
    console.log('Setting unified modal open to true');
    setIsUnifiedModalOpen(true);
    
    // Also set the searchedNFT for existing functionality if it's an NFT
    if (result.type === 'nft') {
      setSearchedNFT(result.data);
    }
  };

  // Close unified modal
  const handleCloseUnifiedModal = () => {
    setIsUnifiedModalOpen(false);
    setUnifiedModalType(null);
    setUnifiedModalData(null);
  };

  // Handle trades found from unified modal
  const handleTradesFoundFromModal = (foundTrades: TradeLoop[]) => {
    console.log('=== MAIN PAGE: Received trades from modal ===');
    console.log('Number of trades received:', foundTrades.length);
    console.log('Current trades state length:', trades.length);
    console.log('Wallet connected:', connected);
    console.log('Public key:', publicKey?.toString());
    
    if (foundTrades.length > 0) {
      setTrades(prevTrades => {
        // Create signatures for existing trades to check against
        const existingTradeSignatures = new Set(prevTrades.map(generateTradeSignature));
        
        const newUniqueTrades = foundTrades.filter(newTrade => {
          const newTradeSignature = generateTradeSignature(newTrade);
          return !existingTradeSignatures.has(newTradeSignature);
        });
        
        if (newUniqueTrades.length > 0) {
          console.log('Adding', newUniqueTrades.length, 'new unique trades from modal');
          return [...newUniqueTrades, ...prevTrades]; // Add new unique trades to the beginning
        }
        return prevTrades; // No new unique trades to add
      });
      
      // Set a message about the found trades
      setMessage(`Found ${foundTrades.length} trade opportunities!`);
    }
  };

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

  // Track trades when they change
  useEffect(() => {
    if (trades.length > 0) {
      // Track all current trades
      const knowledgeService = SwapsKnowledgeService.getInstance();
      trades.forEach(trade => {
        knowledgeService.trackDiscoveredTrade(trade.id);
      });
      
      // Update session storage with current trades
      sessionStorage.setItem('swaps_recent_trades', JSON.stringify(trades));
    }
  }, [trades]);

  // Listen for add-pending-search events from the NFTDetailModal
  useEffect(() => {
    const handleAddPendingSearch = (event: CustomEvent) => {
      const pendingSearchItem = event.detail;
      console.log('Received add-pending-search event:', pendingSearchItem);
      
      // Check if pendingSearchItem and searchedNFT are valid
      if (
        pendingSearchItem && 
        pendingSearchItem.searchedNFT && 
        pendingSearchItem.searchedNFT.address
      ) {
        setPendingSearches(prevSearches => {
          // Avoid duplicates by checking if this NFT is already in pending searches
          if (!prevSearches.some(ps => 
            ps.searchedNFT && 
            ps.searchedNFT.address === pendingSearchItem.searchedNFT.address
          )) {
            return [pendingSearchItem, ...prevSearches]; // Add to the beginning
          }
          return prevSearches;
        });
      } else {
        console.error('Invalid pending search data received:', pendingSearchItem);
      }
    };

    // Add event listener
    document.addEventListener('add-pending-search', handleAddPendingSearch as EventListener);
    
    // Clean up
    return () => {
      document.removeEventListener('add-pending-search', handleAddPendingSearch as EventListener);
    };
  }, []);

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

    // 1. Immediately add to pending searches when the button is clicked
    const newPendingSearchItem: PendingSearchItem = {
      id: uuidv4(), 
      searchedNFT: searchedNFT, 
      initiatedAt: new Date(),
    };

    setPendingSearches(prevSearches => {
      if (!prevSearches.some(ps => ps.searchedNFT.address === newPendingSearchItem.searchedNFT.address && 
                                   Math.abs(ps.initiatedAt.getTime() - newPendingSearchItem.initiatedAt.getTime()) < 2000 )) { // Check within 2 secs to avoid rapid click duplicates
        return [newPendingSearchItem, ...prevSearches]; // Add to the beginning
      }
      return prevSearches;
    });
    
    try {
      const tradeService = TradeService.getInstance();
      console.log('Searching for trades with wallet:', publicKey.toString(), 'for NFT:', searchedNFT.address);
      
      // Enhanced trade discovery with collection support
      const tradeLoops = await tradeService.findTradeLoops(searchedNFT, publicKey.toString(), {
        considerCollections: true,
        includeCollectionTrades: true,
        maxResults: 100
      });
      
      console.log('Received trade loops from API:', tradeLoops);
      
      // Enhanced debugging for the specific issue
      console.log('===== DEBUGGING TRADE LOOPS =====');
      console.log(`Total trade loops received: ${tradeLoops.length}`);
      
      // Log collection-specific trade information
      const collectionTrades = tradeLoops.filter(trade => 
        trade.hasCollectionTrades || trade.crossCollectionTrade
      );
      if (collectionTrades.length > 0) {
        console.log(`${collectionTrades.length} trades involve collection preferences`);
      }
      
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
      
      const currentWalletAddress = publicKey.toString();
      const relevantTrades = tradeLoops.filter(trade => {
        if (!trade.steps || trade.steps.length === 0) return false;
        const isUserSender = trade.steps.some(step => step.from === currentWalletAddress);
        const isUserReceiver = trade.steps.some(step => step.to === currentWalletAddress);
        if (!(isUserSender && isUserReceiver)) return false;
        return trade.steps[0].from === currentWalletAddress;
      });
      
      if (relevantTrades.length > 0) {
        setTrades(prevTrades => {
          // Create signatures for existing trades to check against
          const existingTradeSignatures = new Set(prevTrades.map(generateTradeSignature));
          
          const newUniqueTrades = relevantTrades.filter(newTrade => {
            const newTradeSignature = generateTradeSignature(newTrade);
            return !existingTradeSignatures.has(newTradeSignature);
          });
          
          if (newUniqueTrades.length > 0) {
            // Track each newly discovered trade
            const knowledgeService = SwapsKnowledgeService.getInstance();
            newUniqueTrades.forEach(trade => {
              knowledgeService.trackDiscoveredTrade(trade.id);
            });
            
            // Also store in session storage for immediate access
            const currentSession = sessionStorage.getItem('swaps_recent_trades') || '[]';
            try {
              const sessionTrades = JSON.parse(currentSession);
              const updatedTrades = [...newUniqueTrades, ...sessionTrades].slice(0, 50); // Keep last 50
              sessionStorage.setItem('swaps_recent_trades', JSON.stringify(updatedTrades));
            } catch (e) {
              sessionStorage.setItem('swaps_recent_trades', JSON.stringify(newUniqueTrades));
            }
            
            return [...newUniqueTrades, ...prevTrades]; // Add new unique trades to the beginning
          }
          return prevTrades; // No new unique trades to add
        });
        setMessage(`Found ${relevantTrades.length} trade opportunities for ${searchedNFT.name || searchedNFT.address}!`);
        
        // Check if any of the found trades involve the user receiving the searchedNFT
        const userReceivesSearchedNFT = relevantTrades.some(trade => 
          trade.steps.some(step => 
            step.to === currentWalletAddress && 
            step.nfts.some(nft => nft.address === searchedNFT.address)
          )
        );

        if (userReceivesSearchedNFT) {
          setPendingSearches(prevSearches => 
            prevSearches.filter(ps => ps.searchedNFT.address !== searchedNFT.address)
          );
        }

      } else {
        setMessage(`No immediate trades found for ${searchedNFT.name || searchedNFT.address}. Your interest is registered and the system is searching.`);
      }

      // ... (Keep existing logging for relevantTrades, like logTradeDetails and the NEW DETAILED NFT LOGGING)
      logTradeDetails(relevantTrades); 
      console.log('PAGE.TSX - DETAILED LOG OF relevantTrades before passing to table:');
      relevantTrades.forEach((trade, tradeIndex) => {
        console.log(`  Trade ${tradeIndex + 1} (ID: ${trade.id}):`);
        trade.steps.forEach((step, stepIndex) => {
          console.log(`    Step ${stepIndex + 1} (From: ${step.from.substring(0,6)}... To: ${step.to.substring(0,6)}...):`);
          step.nfts.forEach((nftItem, nftIndex) => {
            console.log(`      NFT ${nftIndex + 1}:`, {
              address: nftItem.address,
              name: nftItem.name,
              image: nftItem.image,
              collectionName: typeof nftItem.collection === 'string' ? nftItem.collection : nftItem.collection?.name,
              symbol: nftItem.symbol,
            });
          });
        });
      });

    } catch (err) {
      console.error('Trade search error:', err);
      setError(err instanceof Error ? err.message : 'Failed to find trade opportunities');
      // Optionally, if API call fails, remove the pending search item that was just added:
      // setPendingSearches(prev => prev.filter(p => p.id !== newPendingSearchItem.id));
    } finally {
      setIsLoading(false);
    }
  };

  // Filter out rejected trades AND apply score filter
  const visibleTrades = trades
    .filter(trade => !rejectedTradeIds.has(trade.id))
    .filter(trade => (trade.efficiency * 100) >= minTradeScore);
  console.log('Visible trades:', visibleTrades.length, 'after filtering rejected trades and applying score filter of', minTradeScore);

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

  const handleMinTradeScoreChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const score = parseInt(event.target.value, 10);
    setMinTradeScore(isNaN(score) ? 0 : Math.max(0, Math.min(100, score)));
  };

  // Command palette keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Listen for Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Command palette options
  const commandOptions = [
    {
      id: 'search',
      name: 'Search for NFT',
      description: 'Find an NFT by its address',
      icon: '🔍',
      action: () => {
        // Close command palette first
        setIsCommandPaletteOpen(false);
        // Use a more reliable method to focus the search bar
        setTimeout(() => {
          // Find the UnifiedSearchBar input by its more stable attributes
          const searchInputs = document.querySelectorAll('input[type="text"]');
          const searchInput = Array.from(searchInputs).find(input => {
            const htmlInput = input as HTMLInputElement;
            return htmlInput.placeholder && htmlInput.placeholder.toLowerCase().includes('search');
          }) as HTMLInputElement;
          
          if (searchInput) {
            searchInput.focus();
            searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100); // Small delay to ensure command palette is closed
      }
    },
    {
      id: 'wallet',
      name: 'Connect Wallet',
      description: connected ? 'View your connected wallet' : 'Connect a new wallet',
      icon: '👛',
      action: () => {
        if (connected) {
          // If already connected, show the custom wallet modal for NFT viewing
          setIsWalletModalOpen(true);
        } else {
          // If not connected, show the wallet adapter modal for connection
          setVisible(true);
        }
      }
    },
    {
      id: 'clear-pending',
      name: 'Clear Pending Searches',
      description: 'Remove all pending NFT search requests',
      icon: '🧹',
      action: () => {
        setPendingSearches([]);
      }
    },
    {
      id: 'clear-rejected',
      name: 'Clear Rejected Trades',
      description: 'Reset rejected trade filters',
      icon: '🔄',
      action: () => {
        setRejectedTradeIds(new Set());
      }
    },
    {
      id: 'help',
      name: 'Help & Documentation',
      description: 'Learn how to use SWAPS effectively',
      icon: '❓',
      action: () => {
        setHelpModalType('help');
        setHelpModalOpen(true);
      }
    }
  ];

  // Conditional rendering for empty states
  const renderEmptyState = () => {
    if (!connected) {
      return (
        <ContextualEmptyState
          title="Welcome to SWAPS"
          description="Connect your wallet to get started with multi-party NFT trading."
          illustration="/images/wallet-illustration.svg"
          actions={[
            {
              title: "Connect Wallet",
              description: "Connect your Solana wallet to view your NFTs and start trading.",
              action: () => {
                // Use the wallet adapter modal instead of custom modal
                setVisible(true);
              }
            },
            {
              title: "Learn More",
              description: "Discover how SWAPS makes trading NFTs easier than ever before.",
              action: () => {
                setHelpModalType('documentation');
                setHelpModalOpen(true);
              }
            }
          ]}
        />
      );
    }
    
    if (connected && !searchedNFT && trades.length === 0 && pendingSearches.length === 0) {
      return null;
    }
    
    return null;
  };

  // Listen for sticky search results from the header
  useEffect(() => {
    const handleStickySearchResult = (event: CustomEvent) => {
      console.log('Home page received sticky search result:', event.detail);
      // Use the same handler as the main search
      handleUnifiedSearchResult(event.detail);
    };

    // Listen for the custom event
    document.addEventListener('stickySearchResult', handleStickySearchResult as EventListener);

    return () => {
      document.removeEventListener('stickySearchResult', handleStickySearchResult as EventListener);
    };
  }, [handleUnifiedSearchResult]);

  return (
    <AppContainer>
      <Container>
        <Content>
          <SearchContainer data-main-search>
            <UnifiedSearchBar 
              onResult={handleUnifiedSearchResult}
              placeholder="Search NFTs by address or collections by name..."
              disabled={!connected}
            />
          </SearchContainer>

          {connected && (
            <AIAssistantBanner>
              <AIAssistantContent>
                <AIAssistantIcon>🤖</AIAssistantIcon>
                <AIAssistantText>
                  <AIAssistantTitle>Need help finding complex trade paths?</AIAssistantTitle>
                  <AIAssistantDescription>
                    Our AI Trade Assistant can analyze the entire network to find multi-party trade routes that get you the NFTs you want.
                  </AIAssistantDescription>
                </AIAssistantText>
                <AIAssistantButton href="/ai-assistant">
                  Launch AI Assistant
                </AIAssistantButton>
              </AIAssistantContent>
            </AIAssistantBanner>
          )}

          <GridContainer>
            {error && <ErrorText>{error}</ErrorText>}
            
            {isLoading ? (
              <LoadingText>Finding the best trades...</LoadingText>
            ) : (
              <>
                {(trades.length > 0 || pendingSearches.length > 0) ? (
                  <TradeLoopDisplay>
                    {trades.length > 0 && (
                      <TradeOpportunitiesTable 
                        trades={visibleTrades} 
                        onRejectTrade={handleTradeRejection}
                        title="Discovered Trade Opportunities"
                        minTradeScore={minTradeScore}
                        onMinTradeScoreChange={handleMinTradeScoreChange}
                      />
                    )}
                    <PendingTradesTable 
                      pendingSearches={pendingSearches} 
                      onCancelSearch={handleCancelPendingSearch}
                    />
                  </TradeLoopDisplay>
                ) : renderEmptyState()}
              </>
            )}
          </GridContainer>

          {connected && (
            <StatsContainer>
              <TradeStats stats={globalStats} isLoading={statsLoading} />
              
              <TrendingHotSection />
              
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

        <CommandPalette 
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          options={commandOptions}
        />
        <UnifiedDisplayModal
          isOpen={isUnifiedModalOpen}
          onClose={handleCloseUnifiedModal}
          type={unifiedModalType}
          data={unifiedModalData}
          onTradesFound={handleTradesFoundFromModal}
        />
        
        <HelpModal
          isOpen={helpModalOpen}
          onClose={() => setHelpModalOpen(false)}
          type={helpModalType}
        />
      </Container>
    </AppContainer>
  );
} 
