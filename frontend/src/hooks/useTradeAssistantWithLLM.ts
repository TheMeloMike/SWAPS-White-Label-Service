import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { TradeService } from '@/services/trade';
import { NFTService } from '@/services/nft';
import { LLMService } from '@/services/ai/llm.service';
import StatsService from '@/services/stats';
import { TradeLoop } from '@/types/trade';
import { NFTMetadata } from '@/types/nft';

interface Message {
  text: string;
  isUser: boolean;
  timestamp: Date;
  tradeProposal?: {
    type: 'direct' | 'multi-party';
    steps: string[];
    confidence?: number;
    estimatedGasFees?: number;
    tradeData?: TradeLoop;
  };
  suggestions?: string[];
}

/**
 * Enhanced Trade Assistant Hook with LLM Integration
 * 
 * This hook provides an intelligent AI assistant powered by Claude or GPT-4
 * that can analyze the SWAPS network, provide market insights, and help
 * users discover complex multi-party trade opportunities.
 */
export const useTradeAssistantWithLLM = () => {
  const { publicKey } = useWallet();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userNFTs, setUserNFTs] = useState<NFTMetadata[]>([]);
  const [marketContext, setMarketContext] = useState<any>(null);
  const [conversationHistory, setConversationHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);

  // Load market context on mount
  useEffect(() => {
    const loadMarketContext = async () => {
      try {
        const statsService = StatsService.getInstance();
        const [stats, trending, activity] = await Promise.all([
          statsService.getGlobalStats(),
          statsService.getPopularCollections(5),
          statsService.getRecentActivity(10),
        ]);

        setMarketContext({
          totalVolume24h: stats.find((s: any) => s.label === 'Total Trade Volume')?.value || 0,
          activeTraders: stats.find((s: any) => s.label === 'Active Trades')?.value || 0,
          topCollections: trending.map((c: any) => c.name),
          trendingNFTs: trending.map((c: any) => ({
            name: c.name,
            volume: c.tradeVolume || 0,
            priceChange: 0,
          })),
          swapsNetworkStats: {
            totalLoopsFound: stats.find((s: any) => s.label === 'Completed Trades')?.value || 0,
            averageLoopSize: 3.2,
            successRate: parseFloat(String(stats.find((s: any) => s.label === 'Success Rate')?.value || '87.5')),
          },
        });
      } catch (error) {
        console.error('Failed to load market context:', error);
      }
    };

    loadMarketContext();
    const interval = setInterval(loadMarketContext, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Load user NFTs when wallet connects
  useEffect(() => {
    if (publicKey && userNFTs.length === 0) {
      const loadUserNFTs = async () => {
        try {
          const nftService = NFTService.getInstance();
          const nfts = await nftService.fetchUserNFTs(publicKey.toString());
          setUserNFTs(nfts);
        } catch (error) {
          console.error('Failed to load user NFTs:', error);
        }
      };
      loadUserNFTs();
    }
  }, [publicKey]);

  const formatTradeSteps = (trade: TradeLoop): string[] => {
    return trade.steps.map((step, index) => {
      const nftNames = step.nfts.map(nft => nft.name || `NFT ${nft.address.slice(0, 8)}...`).join(', ');
      const fromWallet = step.from === publicKey?.toString() ? 'You' : `${step.from.slice(0, 8)}...`;
      const toWallet = step.to === publicKey?.toString() ? 'You' : `${step.to.slice(0, 8)}...`;
      return `Step ${index + 1}: ${fromWallet} trades ${nftNames} to ${toWallet}`;
    });
  };

  const sendMessage = useCallback(async (text: string) => {
    const userMessage: Message = {
      text,
      isUser: true,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);
    
    const newHistory = [...conversationHistory, { role: 'user' as const, content: text }];
    setConversationHistory(newHistory);
    
    try {
      const llmService = LLMService.getInstance();
      const tradeService = TradeService.getInstance();
      const nftService = NFTService.getInstance();
      
      // Get AI response with full context
      const llmResponse = await llmService.generateResponse(text, {
        userWallet: publicKey?.toString(),
        userNFTs,
        marketContext,
        conversationHistory: newHistory.slice(-10),
      });
      
      // Process NFT address if found
      if (llmResponse.extractedNFTAddress && publicKey) {
        try {
          const nftMetadata = await nftService.getNFTMetadata(llmResponse.extractedNFTAddress);
          const trades = await tradeService.findTradeLoops(nftMetadata, publicKey.toString(), {
            includeCollectionTrades: true,
            considerCollections: true,
            maxResults: 10,
          });
          
          // Find relevant trades
          const relevantTrades = trades.filter(trade => 
            trade.steps.some(step => 
              step.to === publicKey.toString() && 
              step.nfts.some(nft => nft.address === llmResponse.extractedNFTAddress)
            )
          );
          
          if (relevantTrades.length > 0) {
            const bestTrade = relevantTrades[0];
            const steps = formatTradeSteps(bestTrade);
            const tradeAnalysis = await llmService.analyzeTradeLoop(bestTrade, publicKey.toString());
            
            const aiMessage: Message = {
              text: `${llmResponse.message}\n\n${tradeAnalysis}`,
              isUser: false,
              timestamp: new Date(),
              tradeProposal: {
                type: (bestTrade.steps.length === 1 ? 'direct' : 'multi-party') as 'direct' | 'multi-party',
                steps,
                confidence: Math.round(bestTrade.efficiency * 100),
                tradeData: bestTrade,
              },
              suggestions: llmResponse.suggestions,
            };
            
            setMessages(prev => [...prev, aiMessage]);
            setConversationHistory(prev => [...prev, { role: 'assistant', content: aiMessage.text }]);
            return;
          }
          
          // No trades found - register interest
          await tradeService.addMultipleWants([llmResponse.extractedNFTAddress], publicKey.toString());
        } catch (error) {
          console.error('Error processing NFT:', error);
        }
      }
      
      // Send standard AI response
      const aiMessage: Message = {
        text: llmResponse.message,
        isUser: false,
        timestamp: new Date(),
        suggestions: llmResponse.suggestions,
      };
      
      setMessages(prev => [...prev, aiMessage]);
      setConversationHistory(prev => [...prev, { role: 'assistant', content: aiMessage.text }]);
      
    } catch (error) {
      console.error('AI Assistant error:', error);
      
      // Fallback message
      const errorMessage: Message = {
        text: "I'm having trouble connecting to my AI brain, but I can still help with basic queries. Try pasting an NFT address!",
        isUser: false,
        timestamp: new Date(),
        suggestions: ["Paste an NFT address", "Check your inventory", "View trending collections"],
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  }, [publicKey, userNFTs, marketContext, conversationHistory]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setConversationHistory([]);
  }, []);

  return {
    messages,
    sendMessage,
    clearChat,
    isProcessing,
    marketContext,
    userNFTs,
  };
}; 