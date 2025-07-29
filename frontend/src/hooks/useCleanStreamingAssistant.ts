import { useState, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { EnhancedAIService } from '@/services/ai/enhanced-ai.service';
import { MinimalStreamingService } from '@/services/ai/minimal-streaming.service';
import { SmartSuggestionEngine } from '@/services/ai/smart-suggestion.service';
import { TradeService } from '@/services/trade';
import { NFTService } from '@/services/nft';
import { TradeLoop } from '@/types/trade';
import { NFTMetadata } from '@/types/nft';

interface CleanMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isStreaming?: boolean;
  tradeProposal?: {
    type: 'direct' | 'multi-party';
    steps: string[];
    confidence?: number;
    estimatedGasFees?: number;
    tradeData?: TradeLoop;
  };
  suggestions?: string[];
}

interface SimpleStatus {
  isProcessing: boolean;
  message?: string;
}

/**
 * Clean Streaming Trade Assistant Hook
 * 
 * Provides:
 * - Smooth character-by-character streaming
 * - Minimal loading UI (just a typing indicator)
 * - No intrusive progress bars or large status containers
 * - Clean layout that doesn't cause overflow
 * - All the intelligence of the original assistant
 */
export const useCleanStreamingAssistant = () => {
  const { publicKey } = useWallet();
  const [messages, setMessages] = useState<CleanMessage[]>([]);
  const [status, setStatus] = useState<SimpleStatus>({ isProcessing: false });
  const [userNFTs, setUserNFTs] = useState<NFTMetadata[]>([]);
  const [conversationHistory, setConversationHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [lastShownTrades, setLastShownTrades] = useState<TradeLoop[]>([]);
  const [currentTradeIndex, setCurrentTradeIndex] = useState(0);
  
  const streamingService = MinimalStreamingService.getInstance();
  const messageIdCounter = useRef(0);
  
  const generateMessageId = useCallback(() => {
    messageIdCounter.current += 1;
    return `msg_${Date.now()}_${messageIdCounter.current}`;
  }, []);

  const streamResponseText = useCallback(async (text: string, suggestions?: string[]) => {
    // Remove any existing thinking message before streaming the real response
    setMessages(prev => prev.filter(msg => msg.id !== 'thinking'));
    setStatus({ isProcessing: false });
    
    const messageId = generateMessageId();
    const streamingMessage: CleanMessage = {
      id: messageId,
      text: '',
      isUser: false,
      timestamp: new Date(),
      isStreaming: true
    };
    
    setMessages(prev => [...prev, streamingMessage]);
    
    streamingService.startStreaming(
      messageId,
      text,
      { charactersPerSecond: 120, initialDelay: 150 },
      {
        onUpdate: (currentText, isComplete) => {
          setMessages(prev => prev.map(msg => 
            msg.id === messageId ? {
              ...msg,
              text: currentText,
              isStreaming: !isComplete
            } : msg
          ));
        },
        onComplete: () => {
          setMessages(prev => prev.map(msg => 
            msg.id === messageId ? {
              ...msg,
              isStreaming: false,
              suggestions: suggestions || []
            } : msg
          ));
          setConversationHistory(prev => [
            ...prev,
            { role: 'assistant', content: text }
          ]);
        }
      }
    );
  }, [generateMessageId, streamingService, setMessages, setConversationHistory]);

  const streamResponseTextWithTrade = useCallback(async (text: string, trade: TradeLoop, suggestions?: string[]) => {
    // Remove any existing thinking message before streaming the real response
    setMessages(prev => prev.filter(msg => msg.id !== 'thinking'));
    setStatus({ isProcessing: false });
    
    const messageId = generateMessageId();
    const streamingMessage: CleanMessage = {
      id: messageId,
      text: '',
      isUser: false,
      timestamp: new Date(),
      isStreaming: true
    };
    
    setMessages(prev => [...prev, streamingMessage]);
    
    streamingService.startStreaming(
      messageId,
      text,
      { charactersPerSecond: 120, initialDelay: 150 },
      {
        onUpdate: (currentText, isComplete) => {
          setMessages(prev => prev.map(msg => 
            msg.id === messageId ? {
              ...msg,
              text: currentText,
              isStreaming: !isComplete
            } : msg
          ));
        },
        onComplete: () => {
          setMessages(prev => prev.map(msg => 
            msg.id === messageId ? {
              ...msg,
              isStreaming: false,
              tradeProposal: {
                type: (trade.totalParticipants === 2 ? 'direct' : 'multi-party') as 'direct' | 'multi-party',
                steps: [],
                confidence: Math.round(trade.efficiency * 100),
                tradeData: trade,
              },
              suggestions: suggestions || []
            } : msg
          ));
          setConversationHistory(prev => [
            ...prev,
            { role: 'assistant', content: text }
          ]);
        }
      }
    );
  }, [generateMessageId, streamingService, setMessages, setConversationHistory]);
  
  // Add thinking message bubble
  const addThinkingMessage = useCallback((thinkingText: string) => {
    const thinkingMessage: CleanMessage = {
      id: 'thinking',
      text: thinkingText,
      isUser: false,
      timestamp: new Date(),
      isStreaming: false // This is a static thinking message, not streaming
    };
    
    setMessages(prev => {
      // Remove any existing thinking message first
      const filtered = prev.filter(msg => msg.id !== 'thinking');
      return [...filtered, thinkingMessage];
    });
  }, []);

  // Remove thinking message
  const removeThinkingMessage = useCallback(() => {
    setMessages(prev => prev.filter(msg => msg.id !== 'thinking'));
  }, []);
  
  // Add intent analysis function like the original assistant
  const analyzeUserIntent = useCallback((input: string) => {
    const lowerInput = input.toLowerCase();
    
    // Check for trade type requests
    const wantsDirectTrade = lowerInput.includes('direct trade') || 
                            lowerInput.includes('2 party') ||
                            lowerInput.includes('2-party') ||
                            lowerInput.includes('two party') ||
                            lowerInput.includes('bilateral') ||
                            lowerInput.includes('2 way') ||
                            lowerInput.includes('2-way') ||
                            lowerInput.includes('two way');
                            
    const wantsThreeWayTrade = lowerInput.includes('3 way') ||
                              lowerInput.includes('3-way') ||
                              lowerInput.includes('three way') ||
                              lowerInput.includes('3 part') ||
                              lowerInput.includes('3 parties') ||
                              lowerInput.includes('three parties') ||
                              lowerInput.includes('3 participants') ||
                              lowerInput.includes('three participants');
                              
    const wantsMultiPartyTrade = lowerInput.includes('multi party') ||
                                lowerInput.includes('multi-party') ||
                                lowerInput.includes('complex trade') ||
                                lowerInput.includes('loop') ||
                                (lowerInput.includes('more than') && lowerInput.includes('partie')) ||
                                lowerInput.includes('4 part') ||
                                lowerInput.includes('4 way') ||
                                lowerInput.includes('5 part') ||
                                lowerInput.includes('5 way');

    // Extract specific participant count if mentioned
    let specificParticipantCount: number | null = null;
    const participantMatches = lowerInput.match(/(\d+)\s*(?:way|part|parties|participants)/);
    if (participantMatches) {
      specificParticipantCount = parseInt(participantMatches[1]);
    }

    // Check for trade filtering requests
    const wantsFilteredTrades = wantsDirectTrade || wantsThreeWayTrade || wantsMultiPartyTrade || specificParticipantCount !== null;
    
    // General trade requests
    const wantsTrades = lowerInput.includes('trade opportunit') || 
                       lowerInput.includes('available trade') || 
                       lowerInput.includes('find trade') ||
                       lowerInput.includes('best trade') ||
                       lowerInput.includes('tradeable') ||
                       lowerInput.includes('show me trade') ||
                       lowerInput.includes('any trade') ||
                       lowerInput.includes('trades') ||
                       lowerInput.includes('opportunities');
    
    return {
      wantsTrades,
      wantsFilteredTrades,
      wantsDirectTrade,
      wantsThreeWayTrade,
      wantsMultiPartyTrade,
      specificParticipantCount,
      lowerInput
    };
  }, []);
  
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || status.isProcessing) return;
    
    // Add user message immediately
    const userMessage: CleanMessage = {
      id: generateMessageId(),
      text,
      isUser: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setConversationHistory(prev => [...prev, { role: 'user', content: text }]);
    
    // Add thinking message bubble instead of setting processing status
    addThinkingMessage('🤔 Thinking...');
    setStatus({ isProcessing: true });
    
    try {
      // Rich data gathering and response generation (like original assistant)
      const enhancedAI = EnhancedAIService.getInstance();
      const lowerMessage = text.toLowerCase();
      
      // Analyze user intent
      const intent = analyzeUserIntent(text);
      
      console.log('[AI Assistant] Processing message:', text);
      console.log('[AI Assistant] Intent analysis:', intent);
      
      // Handle "show my NFTs" / "what NFTs do I have" requests
      if (lowerMessage.includes('my nft') || 
          lowerMessage.includes('nfts do i have') ||
          lowerMessage.includes('what nfts do i have') ||
          lowerMessage.includes('nfts i have') ||
          lowerMessage.includes('what nfts') ||
          lowerMessage.includes('my wallet') ||
          lowerMessage.includes('show my') ||
          lowerMessage.includes('my portfolio') ||
          lowerMessage.includes('my collection')) {
        
        console.log('[AI Assistant] Triggered NFT portfolio query with:', lowerMessage);
        
        // Update thinking message
        addThinkingMessage('📦 Loading your NFT portfolio...');
        
        if (publicKey) {
          try {
            console.log(`[AI Assistant] Fetching NFTs for wallet: ${publicKey.toString()}`);
            // Use the NFTService like the original working assistant
            const nftService = NFTService.getInstance();
            const fetchedNFTs = await nftService.fetchUserNFTs(publicKey.toString());
            setUserNFTs(fetchedNFTs);
            
            if (fetchedNFTs.length > 0) {
              // Group NFTs by collection
              const nftsByCollection = fetchedNFTs.reduce((acc: Record<string, NFTMetadata[]>, nft: NFTMetadata) => {
                const collectionKey = typeof nft.collection === 'string' 
                  ? nft.collection 
                  : (nft.collection?.name || 'Unknown Collection');
                if (!acc[collectionKey]) acc[collectionKey] = [];
                acc[collectionKey].push(nft);
                return acc;
              }, {});
              
              let portfolioText = `📦 **Your NFT Portfolio:**\n\n`;
              Object.entries(nftsByCollection).forEach(([collection, collectionNfts]) => {
                const typedCollectionNfts = collectionNfts as NFTMetadata[];
                portfolioText += `**${collection}** (${typedCollectionNfts.length} NFTs)\n`;
                typedCollectionNfts.slice(0, 5).forEach((nft: NFTMetadata) => {
                  portfolioText += `• ${nft.name || `NFT #${nft.address.slice(0, 8)}...`}`;
                  if (nft.floorPrice) portfolioText += ` - Floor: ${nft.floorPrice} SOL`;
                  portfolioText += '\n';
                });
                if (typedCollectionNfts.length > 5) {
                  portfolioText += `• ... and ${typedCollectionNfts.length - 5} more\n`;
                }
                portfolioText += '\n';
              });
              
              portfolioText += `💡 **Total:** ${fetchedNFTs.length} NFTs across ${Object.keys(nftsByCollection).length} collections`;
              
              await streamResponseText(portfolioText, [
                "Find trades for my most valuable NFT",
                "Show all available trade paths", 
                "Which NFTs have the most liquidity?"
              ]);
              return;
            } else {
              const noNFTsText = `🔍 I couldn't find any NFTs in your wallet. This could be because:\n• Your wallet is empty\n• The NFTs haven't been indexed yet\n• There's a network issue\n\nTry refreshing the page or checking your wallet on a Solana explorer.`;
              
              await streamResponseText(noNFTsText, [
                "How do I get my first NFT?",
                "Show trending collections",
                "What is SWAPS?"
              ]);
              return;
            }
          } catch (error) {
            console.error('Error fetching user NFTs:', error);
          }
        } else {
          // No wallet connected
          await streamResponseText(`🔗 **Please connect your wallet first** to view your NFT portfolio.\n\nOnce connected, I'll show you:\n• All your NFTs organized by collection\n• Floor prices and values\n• Available trade opportunities\n• Personalized trading insights`, [
            "How to connect wallet",
            "Show trending NFTs",
            "View system statistics"
          ]);
          return;
        }
      }
      
      // Handle ALL trade discovery requests - COMPREHENSIVE patterns
      if (intent.wantsTrades || intent.wantsFilteredTrades ||
          (lowerMessage.includes('best') && lowerMessage.includes('trade')) || 
          lowerMessage.includes('trade opportunities') ||
          lowerMessage.includes('show me trade') ||
          lowerMessage.includes('show me some trade') ||
          lowerMessage.includes('show trades') ||
          lowerMessage.includes('tradeable nfts') ||
          (lowerMessage.includes('find') && lowerMessage.includes('trade')) ||
          lowerMessage.includes('trades available') ||
          lowerMessage.includes('opportunities') ||
          lowerMessage.includes('what trades') ||
          lowerMessage.includes('available trades') ||
          lowerMessage.includes('finding trades') ||
          lowerMessage.includes('trades when') ||
          lowerMessage.includes('know there are') ||
          lowerMessage.includes('trades for') ||
          lowerMessage.includes('discover trade') ||
          lowerMessage.includes('any trades') ||
          lowerMessage.includes('some available') ||
          lowerMessage.includes('there are some') ||
          // CRITICAL: Common user queries that should trigger trade discovery
          lowerMessage === 'show me trades' ||
          lowerMessage === 'any trades available' ||
          lowerMessage === 'any trades' ||
          lowerMessage === 'show trades' ||
          lowerMessage === 'trades' ||
          lowerMessage.startsWith('show me trade') ||
          lowerMessage.startsWith('any trade') ||
          lowerMessage.includes('me trades')) {
        
        console.log('[AI Assistant] Triggered trade opportunities query with:', lowerMessage);
        
        // Update thinking message with specific trade discovery text
        addThinkingMessage('🔍 Searching for trade opportunities...');
        
        // First ensure we have user's NFTs
        if (userNFTs.length === 0 && publicKey) {
          try {
            const nftService = NFTService.getInstance();
            const fetchedNFTs = await nftService.fetchUserNFTs(publicKey.toString());
            setUserNFTs(fetchedNFTs);
          } catch (error) {
            console.error('Error fetching user NFTs for trades:', error);
          }
        }
        
        if (publicKey) {
          // Update thinking message
          addThinkingMessage('⚡ Analyzing trade opportunities for your wallet...');
          
          try {
            // Use the TradeService like the original working assistant
            const tradeService = TradeService.getInstance();
            
            // Check existing trades in session storage
            const sessionTrades = sessionStorage.getItem('swaps_recent_trades');
            let existingTrades: TradeLoop[] = [];
            if (sessionTrades) {
              try {
                existingTrades = JSON.parse(sessionTrades);
                console.log('[AI Assistant] Found existing trades in session:', existingTrades.length);
              } catch (e) {
                console.error('[AI Assistant] Error parsing session trades:', e);
              }
            }
            
            // Filter existing trades for ones involving the user
            const userRelevantExistingTrades = existingTrades.filter(trade => {
              const isUserSender = trade.steps.some(step => step.from === publicKey.toString());
              const isUserReceiver = trade.steps.some(step => step.to === publicKey.toString());
              return isUserSender && isUserReceiver;
            });
            
            // Do a general discovery call to find ALL trades for the wallet
            const generalTrades = await tradeService.findTradeLoops(null, publicKey.toString(), {
              maxResults: 20,
              includeCollectionTrades: true,
              considerCollections: true
            });
            
            // Filter to only show trades where user is first sender and valid loop
            const relevantTrades = generalTrades.filter(trade => {
              if (!trade.steps || trade.steps.length === 0) return false;
              const isUserSender = trade.steps.some(step => step.from === publicKey.toString());
              const isUserReceiver = trade.steps.some(step => step.to === publicKey.toString());
              if (!(isUserSender && isUserReceiver)) return false;
              return trade.steps[0].from === publicKey.toString();
            });
            
            // Combine and deduplicate
            const allTrades = [...relevantTrades, ...userRelevantExistingTrades];
            const uniqueTrades = Array.from(
              new Map(allTrades.map(trade => [trade.id, trade])).values()
            );
            
            console.log('[AI Assistant] Found', uniqueTrades.length, 'relevant trades');
            
            if (uniqueTrades.length > 0) {
              // Sort by efficiency
              let sortedTrades = uniqueTrades.sort((a, b) => b.efficiency - a.efficiency);
              
              // APPLY FILTERING if this is a filtering request
              let isFilteredResult = false;
              let filterDescription = '';
              if (intent.wantsFilteredTrades) {
                console.log('[AI Assistant] Applying trade filtering for:', intent);
                
                if (intent.specificParticipantCount) {
                  sortedTrades = sortedTrades.filter(trade => trade.totalParticipants === intent.specificParticipantCount);
                  filterDescription = `${intent.specificParticipantCount}-party trades`;
                } else if (intent.wantsDirectTrade) {
                  sortedTrades = sortedTrades.filter(trade => trade.totalParticipants === 2);
                  filterDescription = 'direct (2-party) trades';
                } else if (intent.wantsThreeWayTrade) {
                  sortedTrades = sortedTrades.filter(trade => trade.totalParticipants === 3);
                  filterDescription = '3-way trades';
                } else if (intent.wantsMultiPartyTrade) {
                  sortedTrades = sortedTrades.filter(trade => trade.totalParticipants > 3);
                  filterDescription = 'multi-party trades (4+ participants)';
                }
                isFilteredResult = true;
                
                console.log('[AI Assistant] Filtered to', sortedTrades.length, filterDescription);
              }
              
              // Save the found trades for later reference
              setLastShownTrades(sortedTrades);
              setCurrentTradeIndex(0);
              
              // Check if filtered results are empty
              if (isFilteredResult && sortedTrades.length === 0) {
                // No trades found matching the criteria
                const totalTrades = uniqueTrades.length;
                const allTradesBreakdown = uniqueTrades.reduce((acc, trade) => {
                  const participants = trade.totalParticipants;
                  if (participants === 2) acc.direct++;
                  else if (participants === 3) acc.threeWay++;
                  else acc.multiParty++;
                  return acc;
                }, { direct: 0, threeWay: 0, multiParty: 0 });

                const noFilteredTradesText = `❌ **No ${filterDescription} found in your available trades.**\n\n**Your ${totalTrades} available trades breakdown:**\n🔄 Direct (2-party): ${allTradesBreakdown.direct}\n🔀 3-way: ${allTradesBreakdown.threeWay}\n🌐 Multi-party (4+): ${allTradesBreakdown.multiParty}\n\n💡 Try a different trade type or search for more opportunities!`;
                
                await streamResponseText(noFilteredTradesText, [
                  "Show all available trades",
                  "Find more trade opportunities",
                  allTradesBreakdown.direct > 0 ? "Show direct trades" : "Search for specific NFTs"
                ]);
                return;
              }
              
              let resultMessage = '';
              if (isFilteredResult) {
                resultMessage = `🎯 **Found ${sortedTrades.length} ${filterDescription}!**\n\n`;
              } else {
                resultMessage = `🎉 **Found ${sortedTrades.length} Active Trade Opportunities!**\n\n`;
              }
              
              // Show each trade with detailed info
              sortedTrades.slice(0, 5).forEach((trade: TradeLoop, index: number) => {
                const userSendingStep = trade.steps.find((s: any) => s.from === publicKey.toString());
                const userReceivingStep = trade.steps.find((s: any) => s.to === publicKey.toString());
                
                if (userSendingStep && userReceivingStep) {
                  const givingNFT = userSendingStep.nfts[0];
                  const receivingNFT = userReceivingStep.nfts[0];
                  
                  resultMessage += `**Trade ${index + 1}:**\n`;
                  resultMessage += `• You Give: **${givingNFT?.name || 'Unknown NFT'}**\n`;
                  resultMessage += `• You Receive: **${receivingNFT?.name || 'Unknown NFT'}**\n`;
                  resultMessage += `• Participants: ${trade.totalParticipants} traders\n`;
                  resultMessage += `• Efficiency: ${(trade.efficiency * 100).toFixed(0)}%\n`;
                  resultMessage += `• ID: ${trade.id.slice(0, 8)}...\n\n`;
                }
              });
              
              if (sortedTrades.length > 5) {
                resultMessage += `• ... and ${sortedTrades.length - 5} more trade opportunities\n\n`;
              }
              
              resultMessage += `💡 **All trades are ready to execute! Each trade is a complete loop where you both give and receive NFTs.**`;
              
              const bestTrade = sortedTrades[0] as TradeLoop;
              const suggestions = isFilteredResult ? [
                sortedTrades.length > 1 ? "Show next trade in this category" : "Show all available trades",
                "Execute this trade",
                "View all trade types"
              ] : [
                "Execute best trade",
                "Show all trade details",
                "Find different trades"
              ];
              
              await streamResponseTextWithTrade(resultMessage, bestTrade, suggestions);
              return;
            } else {
              const noTradesText = `🔄 **No immediate trade paths found.**\n\nThis could mean:\n• Your NFTs are highly sought after (low supply)\n• The specific combinations aren't available yet\n• More traders need to join the network\n\nI've registered your NFTs in the SWAPS network. You'll be notified when trade opportunities arise!\n\n💡 **Tips to increase trade opportunities:**\n• Search for specific NFTs you want to acquire\n• Add more NFTs to your wants list\n• Consider collection-level trades\n• Check back regularly as new trades appear constantly`;
              
              await streamResponseText(noTradesText, [
                "Search for NFTs I want",
                "Register wants for collections",
                "View trending trades"
              ]);
              return;
            }
          } catch (error) {
            console.error('Error finding trade opportunities:', error);
            const errorText = `⚠️ Unable to search for trade opportunities at the moment. Please try again.`;
            await streamResponseText(errorText, [
              "Try again",
              "Check wallet connection",
              "View system status"
            ]);
            return;
          }
        } else {
          const noWalletText = `🔗 **Connect your wallet to find trade opportunities.**\n\nOnce connected, I'll show you:\n• All available trade paths for your NFTs\n• Optimal trade loops with high efficiency\n• Real-time opportunities as they become available`;
          
          await streamResponseText(noWalletText, [
            "How to connect wallet",
            "What is SWAPS?",
            "View system statistics"
          ]);
          return;
        }
      }
      
      // Handle trending/popular NFT queries (actual trending NFTs)
      if (lowerMessage.includes('trending nfts') ||
          lowerMessage.includes('popular nfts') ||
          lowerMessage.includes('hot nfts') ||
          lowerMessage.includes('most wanted') ||
          lowerMessage.includes('trending items')) {
        
        try {
          setStatus({ 
            isProcessing: true, 
            message: 'Getting trending NFTs...' 
          });
          
          const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/trending`;
          console.log('[AI Assistant] Making trending request to:', apiUrl);
          
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (response.ok) {
            const trendingData = await response.json();
            
            if (trendingData.success && trendingData.data) {
              let trendingMessage = `🔥 **Most Wanted NFTs in SWAPS:**\n\n`;
              
              // Show top wanted NFTs with rich data
              if (trendingData.data.topWantedNfts && trendingData.data.topWantedNfts.length > 0) {
                trendingMessage += `🎯 **Top Wanted NFTs:**\n`;
                trendingData.data.topWantedNfts.slice(0, 6).forEach((nft: any, index: number) => {
                  const metadata = nft.metadata;
                  trendingMessage += `${index + 1}. **${metadata.name}** (${metadata.symbol})\n`;
                  trendingMessage += `   • Want Count: ${nft.wantCount} trader${nft.wantCount > 1 ? 's' : ''}\n`;
                  if (metadata.description && metadata.description.length > 0 && !metadata.description.includes('unavailable')) {
                    const shortDesc = metadata.description.slice(0, 80) + (metadata.description.length > 80 ? '...' : '');
                    trendingMessage += `   • ${shortDesc}\n`;
                  }
                  trendingMessage += '\n';
                });
              }
              
              // Show top loop performers
              if (trendingData.data.topLoopItems && trendingData.data.topLoopItems.length > 0) {
                trendingMessage += `⚡ **Most Active in Trade Loops:**\n`;
                trendingData.data.topLoopItems.slice(0, 5).forEach((item: any, index: number) => {
                  trendingMessage += `${index + 1}. **${item.displayName}**\n`;
                  trendingMessage += `   • Appears in ${item.appearanceInLoops} trade loops\n`;
                  trendingMessage += `   • Loop score: ${(item.averageLoopScore * 100).toFixed(0)}%\n\n`;
                });
              }
              
              trendingMessage += `💡 **These NFTs have the highest demand and most trading activity in the SWAPS network!**`;
              
              await streamResponseText(trendingMessage, [
                "Find trades for trending NFTs",
                "Show system statistics", 
                "What makes an NFT popular?"
              ]);
              return;
            }
          }
        } catch (error) {
          console.error('Error fetching trending NFTs:', error);
        }
      }
      
      // Handle trending/popular collection queries
      if (lowerMessage.includes('trending') ||
          lowerMessage.includes('popular') ||
          lowerMessage.includes('hot collections') ||
          lowerMessage.includes('top collections')) {
        
        try {
          setStatus({ 
            isProcessing: true, 
            message: 'Getting trending collections...' 
          });
          
          // Use the working collections stats endpoint for trending data
          const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/collections/stats`;
          console.log('[AI Assistant] Making collections stats request to:', apiUrl);
          
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (response.ok) {
            const stats = await response.json();
            
            let trendingMessage = `🔥 **Collection Overview:**\n\n`;
            
            if (stats.database) {
              trendingMessage += `📊 **Market Summary:**\n`;
              trendingMessage += `• **${stats.database.totalCollections?.toLocaleString()}** total collections indexed\n`;
              trendingMessage += `• **${stats.database.collectionsWithFloorPrice?.toLocaleString()}** collections with active floor prices\n`;
              trendingMessage += `• **${stats.database.averageFloorPrice?.toFixed(2)} SOL** average floor price\n`;
              trendingMessage += `• **${stats.database.totalNFTsIndexed?.toLocaleString()}** NFTs ready for trading\n\n`;
              
              // Calculate some trending insights
              const floorPriceRatio = (stats.database.collectionsWithFloorPrice / stats.database.totalCollections * 100).toFixed(1);
              trendingMessage += `🎯 **Trading Insights:**\n`;
              trendingMessage += `• **${floorPriceRatio}%** of collections have active market data\n`;
              trendingMessage += `• High-value collections (>100 SOL floor) are prime for trading\n`;
              trendingMessage += `• Multi-party swaps unlock liquidity in all price ranges\n\n`;
            }
            
            trendingMessage += `💡 **Ready to Trade:** All ${stats.database?.totalNFTsIndexed?.toLocaleString()} NFTs are available for SWAPS multi-party trading!`;
            
            await streamResponseText(trendingMessage, [
              "Find trades for my NFTs",
              "Show system statistics",
              "What are multi-party trades?"
            ]);
            return;
          }
        } catch (error) {
          console.error('Error fetching trending collections:', error);
        }
      }
      
      // Handle detailed system analysis
      if (lowerMessage.includes('system analysis') ||
          lowerMessage.includes('detailed stats') ||
          lowerMessage.includes('system health') ||
          lowerMessage.includes('analyze system') ||
          lowerMessage.includes('graph data')) {
        
        try {
          setStatus({ 
            isProcessing: true, 
            message: 'Running system analysis...' 
          });
          
          const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/trades/validate-data`;
          console.log('[AI Assistant] Making validation request to:', apiUrl);
          
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (response.ok) {
            const validationData = await response.json();
            
            if (validationData.success) {
              let analysisMessage = `📊 **SWAPS System Analysis:**\n\n`;
              
              // Data integrity
              analysisMessage += `🔍 **Data Integrity:**\n`;
              analysisMessage += `• Status: ${validationData.dataIntegrity.isValid ? '✅ Healthy' : '⚠️ Issues Found'}\n`;
              analysisMessage += `• Issues: ${validationData.dataIntegrity.issuesCount}\n`;
              if (validationData.dataIntegrity.issues.length > 0) {
                analysisMessage += `• Problems: ${validationData.dataIntegrity.issues.join(', ')}\n`;
              }
              analysisMessage += '\n';
              
              // System state
              analysisMessage += `📈 **System State:**\n`;
              analysisMessage += `• Active Wallets: ${validationData.systemState.walletsCount}\n`;
              analysisMessage += `• NFTs Tracked: ${validationData.systemState.nftsCount}\n`;
              analysisMessage += `• Wanted Items: ${validationData.systemState.wantedNftsCount}\n`;
              analysisMessage += '\n';
              
              // Graph visualization
              analysisMessage += `🕸️ **Trade Graph:**\n`;
              analysisMessage += `• Graph Nodes: ${validationData.graphVisualization.nodesCount}\n`;
              analysisMessage += `• Graph Edges: ${validationData.graphVisualization.edgesCount}\n`;
              analysisMessage += `• Connectivity: ${((validationData.graphVisualization.edgesCount / validationData.graphVisualization.nodesCount) * 100).toFixed(1)}%\n\n`;
              
              analysisMessage += `💡 **The system is modeling ${validationData.systemState.walletsCount} wallets and ${validationData.systemState.nftsCount} NFTs as a connected graph with ${validationData.graphVisualization.edgesCount} relationships for multi-party trade discovery.**`;
              
              await streamResponseText(analysisMessage, [
                "Show trade opportunities",
                "View NFT demand metrics",
                "Get system statistics"
              ]);
              return;
            }
          }
        } catch (error) {
          console.error('Error running system analysis:', error);
        }
      }
      
      // Handle NFT demand metrics
      if (lowerMessage.includes('demand metrics') ||
          lowerMessage.includes('nft demand') ||
          lowerMessage.includes('popular nfts detailed') ||
          lowerMessage.includes('nft popularity') ||
          lowerMessage.includes('demand analysis')) {
        
        try {
          setStatus({ 
            isProcessing: true, 
            message: 'Getting NFT demand metrics...' 
          });
          
          const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/trades/system/detailed`;
          console.log('[AI Assistant] Making detailed system request to:', apiUrl);
          
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (response.ok) {
            const detailedData = await response.json();
            
            if (detailedData.success && detailedData.detailedState) {
              let demandMessage = `📊 **NFT Demand Metrics:**\n\n`;
              
              const metrics = detailedData.detailedState.nftDemandMetrics;
              if (metrics && metrics.length > 0) {
                demandMessage += `🎯 **Top Demanded NFTs:**\n`;
                
                // Sort by demand ratio and show top results
                const sortedMetrics = metrics.sort((a: any, b: any) => b.demandRatio - a.demandRatio);
                
                sortedMetrics.slice(0, 8).forEach((metric: any, index: number) => {
                  const shortAddress = metric.mint.slice(0, 8) + '...';
                  demandMessage += `${index + 1}. **${shortAddress}**\n`;
                  demandMessage += `   • Want Count: ${metric.wantCount}\n`;
                  demandMessage += `   • Supply Count: ${metric.supplyCount}\n`;
                  demandMessage += `   • Demand Ratio: ${(metric.demandRatio * 100).toFixed(1)}%\n`;
                  demandMessage += `   • Requests: ${metric.requestCount}\n`;
                  const lastRequested = new Date(metric.lastRequested).toLocaleDateString();
                  demandMessage += `   • Last Requested: ${lastRequested}\n\n`;
                });
                
                demandMessage += `📈 **Demand Analysis:**\n`;
                const totalWants = metrics.reduce((sum: number, m: any) => sum + m.wantCount, 0);
                const totalSupply = metrics.reduce((sum: number, m: any) => sum + m.supplyCount, 0);
                const avgDemandRatio = metrics.reduce((sum: number, m: any) => sum + m.demandRatio, 0) / metrics.length;
                
                demandMessage += `• Total Wants: ${totalWants}\n`;
                demandMessage += `• Total Supply: ${totalSupply}\n`;
                demandMessage += `• Average Demand Ratio: ${(avgDemandRatio * 100).toFixed(1)}%\n`;
                demandMessage += `• Metrics Tracked: ${metrics.length} NFTs\n\n`;
                
                demandMessage += `💡 **Higher demand ratios indicate NFTs with more traders wanting them relative to supply, making them prime candidates for multi-party trade loops.**`;
              } else {
                demandMessage += `No demand metrics available yet. Start trading to generate demand data!`;
              }
              
              await streamResponseText(demandMessage, [
                "Find high-demand trades",
                "Show trending NFTs",
                "Get my portfolio"
              ]);
              return;
            }
          }
        } catch (error) {
          console.error('Error fetching demand metrics:', error);
        }
      }
      
      // Handle system statistics queries - COMPREHENSIVE patterns
      if (lowerMessage.includes('how many nfts') ||
          lowerMessage.includes('how many') ||
          lowerMessage.includes('indexed') ||
          lowerMessage.includes('stats') ||
          lowerMessage.includes('statistics') ||
          lowerMessage.includes('system') ||
          lowerMessage.includes('total nfts') ||
          lowerMessage.includes('nfts indexed') ||
          lowerMessage.includes('nfts in swaps') ||
          lowerMessage.includes('swaps system') ||
          lowerMessage.includes('tens of thousands') ||
          lowerMessage.includes('thousands') ||
          lowerMessage.includes('many') ||
          lowerMessage.includes('count') ||
          lowerMessage.includes('number')) {
        
        console.log('[AI Assistant] Triggered system stats query with:', lowerMessage);
        
        try {
          setStatus({ 
            isProcessing: true, 
            message: 'Gathering SWAPS system statistics...' 
          });
          
          // Use the working collections stats endpoint
          const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/collections/stats`;
          console.log('[AI Assistant] Making stats request to:', apiUrl);
          
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const stats = await response.json();
            
            let statsMessage = `📊 **SWAPS System Statistics:**\n\n`;
            
            // Use the actual data from collections stats
            if (stats.database) {
              statsMessage += `🎨 **Total Collections:** ${stats.database.totalCollections?.toLocaleString() || 'Updating...'}\n`;
              statsMessage += `🖼️ **NFTs Indexed:** ${stats.database.totalNFTsIndexed?.toLocaleString() || 'Updating...'}\n`;
              statsMessage += `💰 **Collections with Floor Price:** ${stats.database.collectionsWithFloorPrice?.toLocaleString() || 'Updating...'}\n`;
              statsMessage += `💎 **Average Floor Price:** ${stats.database.averageFloorPrice ? stats.database.averageFloorPrice.toFixed(2) + ' SOL' : 'Calculating...'}\n`;
            }
            
            if (stats.local) {
              statsMessage += `📂 **Collections Loaded:** ${stats.local.collectionsLoaded?.toLocaleString() || 'Updating...'}\n`;
              statsMessage += `⏰ **Last Updated:** ${stats.local.lastRefresh ? new Date(stats.local.lastRefresh).toLocaleTimeString() : 'Unknown'}\n`;
            }
            
            statsMessage += `\n🚀 **The SWAPS network is live and ready for multi-party NFT trading!**`;
            
            await streamResponseText(statsMessage, [
              "Show trending collections",
              "Find high-efficiency trades",
              "View recent trade activity"
            ]);
            return;
          }
        } catch (error) {
          console.error('Error fetching system stats:', error);
        }
      }
      
      // Handle wallet wants and preferences
      if (lowerMessage.includes('my wants') ||
          lowerMessage.includes('what i want') ||
          lowerMessage.includes('collection wants') ||
          lowerMessage.includes('wishlist') ||
          lowerMessage.includes('preferences')) {
        
        if (!publicKey) {
          await streamResponseText(`Please connect your wallet first to view your wants and preferences.`, [
            "How to connect wallet",
            "What are collection wants?",
            "Browse trending NFTs"
          ]);
          return;
        }
        
        try {
          setStatus({ 
            isProcessing: true, 
            message: 'Getting your wants and preferences...' 
          });
          
          const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/wants/collection?wallet=${publicKey.toString()}`;
          console.log('[AI Assistant] Making wants request to:', apiUrl);
          
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (response.ok) {
            const wantsData = await response.json();
            
            if (wantsData.success) {
              let wantsMessage = `🎯 **Your Trading Wants:**\n\n`;
              
              if (wantsData.wants && wantsData.wants.length > 0) {
                wantsMessage += `📋 **Collection Wants:**\n`;
                wantsData.wants.forEach((want: any, index: number) => {
                  wantsMessage += `${index + 1}. **${want.collectionName || want.collectionId}**\n`;
                  if (want.priceRange) {
                    wantsMessage += `   • Price Range: ${want.priceRange.min} - ${want.priceRange.max} SOL\n`;
                  }
                  if (want.addedDate) {
                    wantsMessage += `   • Added: ${new Date(want.addedDate).toLocaleDateString()}\n`;
                  }
                  wantsMessage += '\n';
                });
                
                wantsMessage += `💡 **Total:** ${wantsData.wants.length} collection wants active`;
              } else {
                wantsMessage += `No collection wants set yet.\n\n`;
                wantsMessage += `🎯 **Set Collection Wants:**\n`;
                wantsMessage += `• Add entire collections to your wishlist\n`;
                wantsMessage += `• Get notified when trades become available\n`;
                wantsMessage += `• Increase your trade opportunities\n\n`;
                wantsMessage += `💡 **Try saying:** "I want NFTs from Mad Lads" or "Add Solana Monkey Business to my wants"`;
              }
              
              await streamResponseText(wantsMessage, [
                "Add collection to wants",
                "Find trades for my wants",
                "Show trending collections"
              ]);
              return;
            }
          }
        } catch (error) {
          console.error('Error fetching wallet wants:', error);
        }
      }
      
      // Handle trade history requests
      if (lowerMessage.includes('trade history') ||
          lowerMessage.includes('my trades') ||
          lowerMessage.includes('past trades') ||
          lowerMessage.includes('completed trades') ||
          lowerMessage.includes('trading activity')) {
        
        if (!publicKey) {
          await streamResponseText(`Please connect your wallet first to view your trade history.`, [
            "How to connect wallet",
            "What are multi-party trades?",
            "Browse active trades"
          ]);
          return;
        }
        
        try {
          setStatus({ 
            isProcessing: true, 
            message: 'Getting your trade history...' 
          });
          
          const response = await fetch(`/api/trades/history/user/${publicKey.toString()}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (response.ok) {
            const historyData = await response.json();
            
            if (historyData.success) {
              let historyMessage = `📈 **Your Trading History:**\n\n`;
              
              if (historyData.trades && historyData.trades.length > 0) {
                historyMessage += `🎯 **Recent Trades:**\n`;
                historyData.trades.slice(0, 10).forEach((trade: any, index: number) => {
                  historyMessage += `${index + 1}. **${trade.type || 'Multi-party'} Trade**\n`;
                  if (trade.completedAt) {
                    historyMessage += `   • Completed: ${new Date(trade.completedAt).toLocaleDateString()}\n`;
                  }
                  if (trade.participants) {
                    historyMessage += `   • Participants: ${trade.participants} traders\n`;
                  }
                  if (trade.efficiency) {
                    historyMessage += `   • Efficiency: ${(trade.efficiency * 100).toFixed(0)}%\n`;
                  }
                  historyMessage += '\n';
                });
                
                historyMessage += `📊 **Summary:**\n`;
                historyMessage += `• Total Trades: ${historyData.trades.length}\n`;
                const avgEfficiency = historyData.trades.reduce((sum: number, t: any) => sum + (t.efficiency || 0), 0) / historyData.trades.length;
                historyMessage += `• Average Efficiency: ${(avgEfficiency * 100).toFixed(1)}%\n`;
                historyMessage += `• Success Rate: ${((historyData.completedTrades || 0) / historyData.trades.length * 100).toFixed(1)}%\n`;
              } else {
                historyMessage += `No trade history found.\n\n`;
                historyMessage += `🚀 **Start Trading:**\n`;
                historyMessage += `• Find trades for your current NFTs\n`;
                historyMessage += `• Add NFTs to your wants list\n`;
                historyMessage += `• Participate in multi-party swaps\n\n`;
                historyMessage += `💡 **Try saying:** "Find me trades" or "What trades are available?"`;
              }
              
              await streamResponseText(historyMessage, [
                "Find new trades",
                "Show my current NFTs",
                "View trending NFTs"
              ]);
              return;
            }
          }
        } catch (error) {
          console.error('Error fetching trade history:', error);
        }
      }
      
      // Handle market insights and analysis
      if (lowerMessage.includes('market insights') ||
          lowerMessage.includes('market analysis') ||
          lowerMessage.includes('trading insights') ||
          lowerMessage.includes('market trends') ||
          lowerMessage.includes('nft market')) {
        
        try {
          setStatus({ 
            isProcessing: true, 
            message: 'Generating market insights...' 
          });
          
          // Get multiple data sources for comprehensive analysis
          const [collectionsResponse, systemResponse, trendingResponse] = await Promise.all([
            fetch('/api/collections/stats'),
            fetch('/api/trades/system/detailed'),
            fetch('/api/trending')
          ]);
          
          if (collectionsResponse.ok && systemResponse.ok && trendingResponse.ok) {
            const [collectionsData, systemData, trendingData] = await Promise.all([
              collectionsResponse.json(),
              systemResponse.json(),
              trendingResponse.json()
            ]);
            
            let insightsMessage = `📊 **SWAPS Market Insights:**\n\n`;
            
            // Market overview
            insightsMessage += `🌟 **Market Overview:**\n`;
            if (collectionsData.database) {
              insightsMessage += `• **${collectionsData.database.totalCollections?.toLocaleString()}** collections indexed\n`;
              insightsMessage += `• **${collectionsData.database.totalNFTsIndexed?.toLocaleString()}** NFTs ready for trading\n`;
              insightsMessage += `• **${collectionsData.database.averageFloorPrice?.toFixed(2)} SOL** average floor price\n`;
            }
            
            // Trading activity
            if (systemData.success && systemData.detailedState) {
              insightsMessage += `\n⚡ **Trading Activity:**\n`;
              insightsMessage += `• **${systemData.detailedState.wallets}** active wallets\n`;
              insightsMessage += `• **${systemData.detailedState.wanted}** active want requests\n`;
              
              const metrics = systemData.detailedState.nftDemandMetrics;
              if (metrics && metrics.length > 0) {
                const highDemandItems = metrics.filter((m: any) => m.demandRatio > 0.8).length;
                insightsMessage += `• **${highDemandItems}** high-demand NFTs (>80% demand ratio)\n`;
                
                const avgDemandRatio = metrics.reduce((sum: number, m: any) => sum + m.demandRatio, 0) / metrics.length;
                insightsMessage += `• **${(avgDemandRatio * 100).toFixed(1)}%** average demand ratio\n`;
              }
            }
            
            // Trending insights
            if (trendingData.success && trendingData.data) {
              insightsMessage += `\n🔥 **Trending Insights:**\n`;
              if (trendingData.data.topWantedNfts && trendingData.data.topWantedNfts.length > 0) {
                const topCollections = trendingData.data.topWantedNfts.reduce((acc: any, nft: any) => {
                  const symbol = nft.metadata.symbol || 'Unknown';
                  acc[symbol] = (acc[symbol] || 0) + 1;
                  return acc;
                }, {});
                
                const mostWantedCollection = Object.entries(topCollections).sort((a: any, b: any) => b[1] - a[1])[0];
                insightsMessage += `• **${mostWantedCollection[0]}** is the most wanted collection\n`;
                
                const totalWants = trendingData.data.topWantedNfts.reduce((sum: number, nft: any) => sum + nft.wantCount, 0);
                insightsMessage += `• **${totalWants}** total wants for trending NFTs\n`;
              }
            }
            
            // Strategic insights
            insightsMessage += `\n💡 **Strategic Insights:**\n`;
            insightsMessage += `• Multi-party swaps unlock liquidity in all price ranges\n`;
            insightsMessage += `• High-demand NFTs create the most trading opportunities\n`;
            insightsMessage += `• Collection-level wants increase trade loop formation\n`;
            insightsMessage += `• Network effects grow exponentially with user adoption\n\n`;
            
            insightsMessage += `🚀 **SWAPS transforms NFT trading from bilateral exchanges to multi-party optimization, creating 10x more liquidity!**`;
            
            await streamResponseText(insightsMessage, [
              "Show high-demand NFTs",
              "Find optimal trades",
              "View trending collections"
            ]);
            return;
          }
        } catch (error) {
          console.error('Error generating market insights:', error);
        }
      }
      
      // Handle wallet-specific trading opportunities
      if (lowerMessage.includes('wallet opportunities') ||
          lowerMessage.includes('trading opportunities') ||
          lowerMessage.includes('my opportunities') ||
          lowerMessage.includes('optimal trades') ||
          lowerMessage.includes('best trades for me')) {
        
        if (!publicKey) {
          await streamResponseText(`Please connect your wallet first to view your trading opportunities.`, [
            "How to connect wallet",
            "Browse trending NFTs",
            "What are multi-party trades?"
          ]);
          return;
        }
        
        try {
          setStatus({ 
            isProcessing: true, 
            message: 'Analyzing your trading opportunities...' 
          });
          
          const response = await fetch(`/api/trades/opportunities/${publicKey.toString()}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (response.ok) {
            const opportunitiesData = await response.json();
            
            if (opportunitiesData.success) {
              let opportunitiesMessage = `🎯 **Your Trading Opportunities:**\n\n`;
              
              if (opportunitiesData.opportunities && opportunitiesData.opportunities.length > 0) {
                opportunitiesMessage += `⚡ **Active Opportunities:**\n`;
                
                opportunitiesData.opportunities.slice(0, 8).forEach((opportunity: any, index: number) => {
                  opportunitiesMessage += `${index + 1}. **${opportunity.type || 'Multi-party'} Trade**\n`;
                  if (opportunity.efficiency) {
                    opportunitiesMessage += `   • Efficiency: ${(opportunity.efficiency * 100).toFixed(1)}%\n`;
                  }
                  if (opportunity.participants) {
                    opportunitiesMessage += `   • Participants: ${opportunity.participants} traders\n`;
                  }
                  if (opportunity.estimatedValue) {
                    opportunitiesMessage += `   • Est. Value: ${opportunity.estimatedValue.toFixed(2)} SOL\n`;
                  }
                  if (opportunity.timeToComplete) {
                    opportunitiesMessage += `   • Time to Complete: ${opportunity.timeToComplete}\n`;
                  }
                  opportunitiesMessage += '\n';
                });
                
                // Summary statistics
                opportunitiesMessage += `📊 **Summary:**\n`;
                opportunitiesMessage += `• Total Opportunities: ${opportunitiesData.opportunities.length}\n`;
                const avgEfficiency = opportunitiesData.opportunities.reduce((sum: number, o: any) => sum + (o.efficiency || 0), 0) / opportunitiesData.opportunities.length;
                opportunitiesMessage += `• Average Efficiency: ${(avgEfficiency * 100).toFixed(1)}%\n`;
                
                if (opportunitiesData.potentialValue) {
                  opportunitiesMessage += `• Potential Value: ${opportunitiesData.potentialValue.toFixed(2)} SOL\n`;
                }
                
                opportunitiesMessage += `\n💡 **These opportunities are personalized based on your current NFT portfolio and trading preferences.**`;
              } else {
                opportunitiesMessage += `No specific opportunities found right now.\n\n`;
                opportunitiesMessage += `🚀 **Increase Your Opportunities:**\n`;
                opportunitiesMessage += `• Add more NFTs to your wants list\n`;
                opportunitiesMessage += `• Set collection-level preferences\n`;
                opportunitiesMessage += `• Participate in community trading\n`;
                opportunitiesMessage += `• Check back regularly for new opportunities\n\n`;
                opportunitiesMessage += `💡 **Try saying:** "Find me trades" or "Add Mad Lads to my wants"`;
              }
              
              await streamResponseText(opportunitiesMessage, [
                "Execute best trade",
                "Show my current NFTs",
                "Add to wants list"
              ]);
              return;
            }
          }
        } catch (error) {
          console.error('Error fetching trading opportunities:', error);
        }
      }
      
      // Handle deep wallet scan requests
      if (lowerMessage.includes('deep scan') ||
          lowerMessage.includes('scan wallet') ||
          lowerMessage.includes('full scan') ||
          lowerMessage.includes('rescan my wallet')) {
        
        if (!publicKey) {
          await streamResponseText(`Please connect your wallet first to perform a deep scan.`, [
            "How to connect wallet",
            "What is a deep scan?",
            "Browse trending NFTs"
          ]);
          return;
        }
        
        try {
          setStatus({ 
            isProcessing: true, 
            message: 'Performing deep wallet scan...' 
          });
          
          const response = await fetch('/api/trades/wallet/deep-scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: publicKey.toString() })
          });
          
          if (response.ok) {
            const scanData = await response.json();
            
            if (scanData.success) {
              let scanMessage = `🔍 **Deep Wallet Scan Results:**\n\n`;
              
              if (scanData.data) {
                scanMessage += `📊 **Scan Summary:**\n`;
                scanMessage += `• NFTs Discovered: ${scanData.data.nftsFound || 0}\n`;
                scanMessage += `• Collections: ${scanData.data.collectionsFound || 0}\n`;
                scanMessage += `• Verified NFTs: ${scanData.data.verifiedNfts || 0}\n`;
                scanMessage += `• Metadata Updated: ${scanData.data.metadataUpdated || 0}\n`;
                
                if (scanData.data.newNfts && scanData.data.newNfts.length > 0) {
                  scanMessage += `\n🆕 **New NFTs Found:**\n`;
                  scanData.data.newNfts.slice(0, 5).forEach((nft: any, index: number) => {
                    scanMessage += `${index + 1}. **${nft.name || 'Unknown NFT'}**\n`;
                    if (nft.collection) {
                      scanMessage += `   • Collection: ${nft.collection}\n`;
                    }
                    if (nft.floorPrice) {
                      scanMessage += `   • Floor Price: ${nft.floorPrice} SOL\n`;
                    }
                    scanMessage += '\n';
                  });
                  
                  if (scanData.data.newNfts.length > 5) {
                    scanMessage += `• ... and ${scanData.data.newNfts.length - 5} more NFTs\n`;
                  }
                }
                
                scanMessage += `\n✅ **Your wallet has been fully scanned and updated in the SWAPS system.**`;
                
                // Update local NFT state
                if (scanData.data.allNfts) {
                  setUserNFTs(scanData.data.allNfts);
                }
              } else {
                scanMessage += `Scan completed. No new NFTs found.`;
              }
              
              await streamResponseText(scanMessage, [
                "Find trades for new NFTs",
                "Show my full portfolio",
                "View trending collections"
              ]);
              return;
            }
          }
        } catch (error) {
          console.error('Error performing deep wallet scan:', error);
        }
      }
      
      // Handle specific debugging queries
      if (lowerMessage.includes('not finding trades') ||
          lowerMessage.includes("isn't finding") ||
          lowerMessage.includes('still not') ||
          lowerMessage.includes('not working')) {
        
        console.log('[AI Assistant] Triggered debug trade query');
        
        if (!publicKey) {
          await streamResponseText(`Please connect your wallet first to check for trade issues.`, [
            "Connect wallet",
            "How does trade discovery work?"
          ]);
          return;
        }
        
        try {
          setStatus({ 
            isProcessing: true, 
            message: 'Debugging trade discovery...' 
          });
          
          // Force a trade discovery call with full debugging
          const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/trades/discover`;
          console.log('[AI Assistant] Debug: Making trade discovery request to:', apiUrl);
          
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              wallet: publicKey.toString(),
              considerCollections: true,
              includeCollectionTrades: true,
              maxResults: 20
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            const allTrades = data.trades || [];
            
            let debugMessage = `🔍 **Trade Discovery Debug Report:**\n\n`;
            debugMessage += `📊 **Raw Results:**\n`;
            debugMessage += `• API Response: ${response.status} ${response.statusText}\n`;
            debugMessage += `• Total Trades Found: ${allTrades.length}\n`;
            debugMessage += `• Your Wallet: ${publicKey.toString().slice(0, 8)}...\n\n`;
            
            if (allTrades.length > 0) {
              debugMessage += `✅ **Found ${allTrades.length} potential trades!**\n\n`;
              
              // Check each trade
              allTrades.forEach((trade: any, index: number) => {
                const isUserSender = trade.steps?.some((step: any) => step.from === publicKey.toString());
                const isUserReceiver = trade.steps?.some((step: any) => step.to === publicKey.toString());
                const isValidLoop = isUserSender && isUserReceiver;
                
                debugMessage += `**Trade ${index + 1}:**\n`;
                debugMessage += `• ID: ${trade.id?.slice(0, 8)}...\n`;
                debugMessage += `• User is sender: ${isUserSender ? '✅' : '❌'}\n`;
                debugMessage += `• User is receiver: ${isUserReceiver ? '✅' : '❌'}\n`;
                debugMessage += `• Valid loop: ${isValidLoop ? '✅' : '❌'}\n`;
                debugMessage += `• Participants: ${trade.totalParticipants || 'Unknown'}\n`;
                debugMessage += `• Efficiency: ${((trade.efficiency || 0) * 100).toFixed(0)}%\n\n`;
              });
              
              const validTrades = allTrades.filter((trade: any) => {
                const isUserSender = trade.steps?.some((step: any) => step.from === publicKey.toString());
                const isUserReceiver = trade.steps?.some((step: any) => step.to === publicKey.toString());
                return isUserSender && isUserReceiver;
              });
              
              debugMessage += `🎯 **Valid Trade Loops for You: ${validTrades.length}**\n\n`;
              
              if (validTrades.length > 0) {
                debugMessage += `The trade discovery is working correctly! You have ${validTrades.length} available trade${validTrades.length > 1 ? 's' : ''}.`;
              } else {
                debugMessage += `⚠️ Found trades in the system, but none where you're both giving and receiving (complete loops).`;
              }
            } else {
              debugMessage += `❌ **No trades found.**\n\nPossible reasons:\n• No one wants your NFTs right now\n• No suitable trade chains available\n• Try adding specific NFTs to your wants list`;
            }
            
            await streamResponseText(debugMessage, [
              "Try finding trades again",
              "Show my NFT portfolio",
              "How can I increase trade opportunities?"
            ]);
            return;
          }
        } catch (error) {
          console.error('Error in debug trade discovery:', error);
        }
      }
      
      // If we get here, use the enhanced AI with rich context
      console.log('[AI Assistant] No specific handler matched, falling back to enhanced AI for query:', lowerMessage);
      const aiResponse = await enhancedAI.processQueryWithFullContext(text, {
        walletAddress: publicKey?.toString(),
        userNFTs: userNFTs,
        conversationHistory: conversationHistory,
        lastShownTrades: lastShownTrades,
        currentTradeIndex: currentTradeIndex
      });
      
      // Clear processing status
      setStatus({ isProcessing: false });
      
      // Create streaming message
      const messageId = generateMessageId();
      const streamingMessage: CleanMessage = {
        id: messageId,
        text: '',
        isUser: false,
        timestamp: new Date(),
        isStreaming: true
      };
      
      // Add streaming message placeholder
      setMessages(prev => [...prev, streamingMessage]);
      
      // Start character-by-character streaming
      streamingService.startStreaming(
        messageId,
        aiResponse.message,
        {
          charactersPerSecond: 120, // Fast typing speed
          initialDelay: 150 // Very brief pause before starting
        },
        {
          onUpdate: (currentText, isComplete) => {
            setMessages(prev => prev.map(msg => 
              msg.id === messageId ? {
                ...msg,
                text: currentText,
                isStreaming: !isComplete
              } : msg
            ));
          },
          onComplete: () => {
            // Generate smart suggestions
            const suggestionEngine = SmartSuggestionEngine.getInstance();
            const suggestions = suggestionEngine.generateSuggestions({
              isWalletConnected: !!publicKey,
              userNFTs: userNFTs?.map(nft => ({
                name: nft.name,
                collection: typeof nft.collection === 'string' ? nft.collection : 
                            nft.collection?.name || undefined,
                address: nft.address
              })) || [],
              messageCount: messages.length,
              conversationHistory: conversationHistory,
              lastShownTrades: lastShownTrades?.map(trade => ({
                efficiency: trade.efficiency,
                totalParticipants: trade.totalParticipants,
                steps: trade.steps.map(step => ({
                  from: step.from,
                  to: step.to,
                  nfts: step.nfts.map(nft => ({
                    name: nft.name,
                    collection: typeof nft.collection === 'string' ? nft.collection : 
                                nft.collection?.name || undefined,
                    address: nft.address
                  }))
                }))
              })) || [],
              hasRecentMarketData: true
            });
            
            // Final update with suggestions
            setMessages(prev => prev.map(msg => 
              msg.id === messageId ? {
                ...msg,
                isStreaming: false,
                suggestions: (aiResponse.suggestions && aiResponse.suggestions.length > 0) ? 
                           aiResponse.suggestions : suggestions,
                tradeProposal: aiResponse.shouldSearchTrades ? {
                  type: 'multi-party' as const,
                  steps: [],
                  confidence: 85,
                  tradeData: undefined // Will be filled by actual trade search
                } : undefined
              } : msg
            ));
            
            // Update conversation history
            setConversationHistory(prev => [
              ...prev,
              { role: 'assistant', content: aiResponse.message }
            ]);
          }
        }
      );
      
    } catch (error) {
      console.error('Error sending message:', error);
      setStatus({ isProcessing: false });
      
      // Add simple error message
      const errorMessage: CleanMessage = {
        id: generateMessageId(),
        text: "I encountered an issue. Please try again.",
        isUser: false,
        timestamp: new Date(),
        suggestions: ["Try again", "Check connection"]
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [
    publicKey, userNFTs, conversationHistory, lastShownTrades, 
    currentTradeIndex, status.isProcessing, generateMessageId, 
    streamingService, messages.length, streamResponseText, streamResponseTextWithTrade,
    analyzeUserIntent, addThinkingMessage, removeThinkingMessage
  ]);
  
  const stopStreaming = useCallback((messageId: string) => {
    streamingService.stopStreaming(messageId);
  }, [streamingService]);
  
  const clearChat = useCallback(() => {
    setMessages([]);
    setUserNFTs([]);
    setLastShownTrades([]);
    setCurrentTradeIndex(0);
    setConversationHistory([]);
    setStatus({ isProcessing: false });
    streamingService.cleanup();
  }, [streamingService]);
  
  const isStreaming = useCallback((messageId: string) => {
    return streamingService.isStreaming(messageId);
  }, [streamingService]);
  
  return {
    messages,
    sendMessage,
    clearChat,
    status,
    
    // Streaming controls
    stopStreaming,
    isStreaming,
    
    // Simple typing indicator for status
    getTypingIndicator: () => streamingService.getTypingIndicator()
  };
}; 