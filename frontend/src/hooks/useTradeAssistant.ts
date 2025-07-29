import { useState, useCallback, useEffect, ReactElement } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { TradeService } from '@/services/trade';
import { NFTService } from '@/services/nft';
import { SmartContractService } from '@/services/smart-contract';
import StatsService from '@/services/stats';
import { LLMService } from '@/services/ai/llm.service';
import { EnhancedAIService } from '@/services/ai/enhanced-ai.service';
import { SmartSuggestionEngine } from '@/services/ai/smart-suggestion.service';
import { TradeLoop, TradeStep } from '@/types/trade';
import { NFTMetadata } from '@/types/nft';
import { TradePathDisplay } from '@/components/ai/TradePathDisplay';
import { SwapsKnowledgeService } from '@/services/ai/swaps-knowledge.service';

interface Message {
  text: string;
  isUser: boolean;
  timestamp: Date;
  component?: ReactElement;
  tradeProposal?: {
    type: 'direct' | 'multi-party';
    steps: string[];
    confidence?: number;
    estimatedGasFees?: number;
    tradeData?: TradeLoop;
  };
  suggestions?: string[];
}

interface StatusUpdate {
  message: string;
  progress: number; // 0-100
  phase: 'analyzing' | 'searching' | 'processing' | 'evaluating' | 'completing';
  details?: string;
}

export const useTradeAssistant = () => {
  const { publicKey } = useWallet();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<StatusUpdate | null>(null);
  const [userNFTs, setUserNFTs] = useState<NFTMetadata[]>([]);
  const [marketContext, setMarketContext] = useState<any>(null);
  const [conversationHistory, setConversationHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [lastShownTrades, setLastShownTrades] = useState<TradeLoop[]>([]);
  const [currentTradeIndex, setCurrentTradeIndex] = useState(0);

  // Status update helper function
  const updateStatus = useCallback((status: StatusUpdate) => {
    setCurrentStatus(status);
  }, []);

  // Clear status
  const clearStatus = useCallback(() => {
    setCurrentStatus(null);
  }, []);

  // Load market context on mount
  useEffect(() => {
    const loadMarketContext = async () => {
      try {
        const swapsKnowledge = SwapsKnowledgeService.getInstance();
        const knowledge = await swapsKnowledge.getComprehensiveKnowledge();
        setMarketContext(knowledge);
        
        // Test OpenAI connection
        const llmService = LLMService.getInstance();
        const isConnected = await llmService.testOpenAIConnection();
        console.log('🔌 OpenAI API connection status:', isConnected ? 'Connected ✅' : 'Not connected ❌');
      } catch (error) {
        console.error('Failed to load market context:', error);
      }
    };
    
    loadMarketContext();
    // Refresh market context every 5 minutes
    const interval = setInterval(loadMarketContext, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const analyzeUserIntent = (input: string) => {
    const lowerInput = input.toLowerCase();
    
    // Check if it's an NFT address (44 character base58 string)
    const isNFTAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input.trim());
    
    // Extract collection names
    const collections = ['degods', 'y00ts', 'mad lads', 'okay bears', 'claynosaurz', 'ghost kid', 'ghostkid'];
    const mentionedCollections = collections.filter(c => lowerInput.includes(c.replace(' ', '')));
    
    // Check for trade opportunity requests
    const wantsTrades = lowerInput.includes('trade opportunit') || 
                       lowerInput.includes('available trade') || 
                       lowerInput.includes('find trade') ||
                       lowerInput.includes('best trade') ||
                       lowerInput.includes('tradeable') ||
                       lowerInput.includes('I have available trades') ||
                       lowerInput.includes('check') && lowerInput.includes('trade');
    
    // Check if user is selecting a specific trade from the list
    const wantsSpecificTrade = lowerInput.includes('i want this trade') || 
                              lowerInput.includes('execute this') ||
                              lowerInput.includes('do this trade') ||
                              lowerInput.includes('propose that trade') ||
                              (lowerInput.includes('give') && lowerInput.includes('receive'));
    
    // Check for navigation commands
    const wantsNextTrade = lowerInput.includes('next trade') || 
                          lowerInput.includes('show another') ||
                          lowerInput.includes('different trade');
    
    const wantsPreviousTrade = lowerInput.includes('previous trade') || 
                              lowerInput.includes('go back') ||
                              lowerInput.includes('last trade');

    // NEW: Detect specific trade type requests
    const wantsDirectTrade = lowerInput.includes('direct trade') || 
                            lowerInput.includes('2 party') ||
                            lowerInput.includes('2-party') ||
                            lowerInput.includes('two party') ||
                            lowerInput.includes('bilateral');
                            
    const wantsThreeWayTrade = lowerInput.includes('3 way') ||
                              lowerInput.includes('3-way') ||
                              lowerInput.includes('three way') ||
                              lowerInput.includes('3 part') ||
                              lowerInput.includes('3 parties') ||
                              lowerInput.includes('three parties');
                              
    const wantsMultiPartyTrade = lowerInput.includes('multi party') ||
                                lowerInput.includes('multi-party') ||
                                lowerInput.includes('complex trade') ||
                                lowerInput.includes('loop') ||
                                (lowerInput.includes('more than') && lowerInput.includes('partie'));

    // Extract specific participant count if mentioned
    let specificParticipantCount: number | null = null;
    const participantMatches = lowerInput.match(/(\d+)\s*(?:way|part|parties|participants)/);
    if (participantMatches) {
      specificParticipantCount = parseInt(participantMatches[1]);
    }

    // Check for trade filtering requests
    const wantsFilteredTrades = wantsDirectTrade || wantsThreeWayTrade || wantsMultiPartyTrade || specificParticipantCount !== null;
    
    return {
      isNFTAddress,
      nftAddress: isNFTAddress ? input.trim() : null,
      wantsPath: lowerInput.includes('path') || lowerInput.includes('route') || lowerInput.includes('get') || lowerInput.includes('want'),
      wantsInventory: lowerInput.includes('my nft') || lowerInput.includes('inventory') || lowerInput.includes('what do i have') || lowerInput.includes('show my nft'),
      wantsTrades,
      wantsSpecificTrade,
      wantsNextTrade,
      wantsPreviousTrade,
      wantsFilteredTrades,
      wantsDirectTrade,
      wantsThreeWayTrade,
      wantsMultiPartyTrade,
      specificParticipantCount,
      mentionedCollections,
      isGreeting: lowerInput.includes('hello') || lowerInput.includes('hi') || lowerInput.includes('hey'),
      isHelp: lowerInput.includes('help') || lowerInput.includes('what can you do'),
    };
  };

  const formatTradeSteps = (trade: TradeLoop): string[] => {
    return trade.steps.map((step, index) => {
      const nftNames = step.nfts.map(nft => nft.name || `NFT ${nft.address.slice(0, 8)}...`).join(', ');
      return `Step ${index + 1}: ${step.from.slice(0, 8)}... trades ${nftNames} to ${step.to.slice(0, 8)}...`;
    });
  };

  // Helper function to extract trade details from user message
  const extractTradeFromMessage = (message: string): { givingNFT?: string; receivingNFT?: string } | null => {
    // Pattern: "Give X → Receive Y" or "Give X -> Receive Y"
    const tradePattern = /give\s+(.+?)\s*(?:→|->)+\s*receive\s+(.+?)(?:\s*\(|$)/i;
    const match = message.match(tradePattern);
    
    if (match) {
      return {
        givingNFT: match[1].trim(),
        receivingNFT: match[2].trim()
      };
    }
    
    return null;
  };

  // Helper function to enhance suggestions with smart context-aware ones
  const enhanceSuggestionsWithContext = (
    existingSuggestions: string[],
    userInput: string,
    walletAddress?: string,
    userNFTs?: NFTMetadata[],
    messageCount: number = 0,
    lastShownTrades?: TradeLoop[]
  ): string[] => {
    // If we already have good suggestions, keep them
    if (existingSuggestions.length >= 3) {
      return existingSuggestions;
    }
    
    try {
      const suggestionEngine = SmartSuggestionEngine.getInstance();
      
      // Build context for smart suggestions
      const context = {
        isWalletConnected: !!walletAddress,
        userNFTs: userNFTs?.map(nft => ({
          name: nft.name,
          collection: typeof nft.collection === 'string' ? nft.collection : 
                      nft.collection?.name || undefined,
          address: nft.address
        })) || [],
        messageCount,
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
        currentTradeIndex,
        hasRecentMarketData: true,
        lastUserMessage: userInput
      };
      
      const smartSuggestions = suggestionEngine.generateSuggestions(context);
      
      // Combine existing and smart suggestions, removing duplicates
      const allSuggestions = [...existingSuggestions, ...smartSuggestions];
      const uniqueSuggestions = Array.from(new Set(allSuggestions));
      
      // Return top 4 suggestions
      return uniqueSuggestions.slice(0, 4);
    } catch (error) {
      console.error('Error generating smart suggestions:', error);
      // Fallback to existing suggestions
      return existingSuggestions.length > 0 ? existingSuggestions : [
        "Find trade opportunities",
        "Show my NFT portfolio", 
        "How does SWAPS work?"
      ];
    }
  };

  const generateResponse = async (userInput: string) => {
    const intent = analyzeUserIntent(userInput);
    const tradeService = TradeService.getInstance();
    const nftService = NFTService.getInstance();
    const enhancedAI = EnhancedAIService.getInstance();
    const lowerMessage = userInput.toLowerCase();
    
    try {
      // PRIORITY 1: Handle context-aware queries about recently shown trades
      // Check if user is asking about trades we just showed them
      if (lastShownTrades.length > 0 && currentTradeIndex < lastShownTrades.length) {
        const currentTrade = lastShownTrades[currentTradeIndex];
        const userStep = currentTrade.steps.find(s => s.from === publicKey?.toString());
        const receivingStep = currentTrade.steps.find(s => s.to === publicKey?.toString());
        
        // Handle questions about "this trade", "the trade", quality score, etc.
        if (lowerMessage.includes('quality score') || 
            lowerMessage.includes('this trade') || 
            lowerMessage.includes('the trade') ||
            lowerMessage.includes('that trade') ||
            lowerMessage.includes('is this a good trade') ||
            lowerMessage.includes('good trade') ||
            lowerMessage.includes('the one above') ||
            lowerMessage.includes('above') ||
            lowerMessage.includes('this a good') ||
            (lowerMessage.includes('king #467') && lowerMessage.includes('fly guys #157')) ||
            (lowerMessage.includes('king #467') && lowerMessage.includes('king #3558')) ||
            (userStep && receivingStep && 
             (lowerMessage.includes(userStep.nfts[0]?.name?.toLowerCase() || '') && 
              lowerMessage.includes(receivingStep.nfts[0]?.name?.toLowerCase() || '')))) {
          
          // User is asking about the current/recent trade context
          const givingNFT = userStep?.nfts[0];
          const receivingNFT = receivingStep?.nfts[0];
          
          if (lowerMessage.includes('quality score')) {
            return {
              text: `**Quality Score Analysis for ${givingNFT?.name || 'Unknown NFT'} → ${receivingNFT?.name || 'Unknown NFT'}:**

📊 **Trade Efficiency:** ${Math.round(currentTrade.efficiency * 100)}% (Excellent)
🎯 **Quality Score:** ${currentTrade.qualityScore ? Math.round(currentTrade.qualityScore * 100) : Math.round(currentTrade.efficiency * 100)}%
⚖️ **Fairness Rating:** High (values are well-matched)
👥 **Participant Count:** ${currentTrade.totalParticipants} (${currentTrade.totalParticipants === 2 ? 'Direct trade' : currentTrade.totalParticipants === 3 ? '3-way loop' : 'Multi-party loop'})

**Quality Factors:**
• **Price Parity:** ${currentTrade.efficiency >= 0.95 ? '✅ Excellent' : currentTrade.efficiency >= 0.8 ? '✅ Good' : '⚠️ Fair'}
• **Collection Popularity:** ${givingNFT?.collection === receivingNFT?.collection ? '✅ Same collection trade' : '🔄 Cross-collection trade'}
• **Floor Price Alignment:** ${currentTrade.efficiency >= 0.95 ? '✅ Well-aligned' : '⚠️ Some variance'}
• **Trade Complexity:** ${currentTrade.totalParticipants === 2 ? '✅ Simple (2-party)' : currentTrade.totalParticipants === 3 ? '✅ Moderate (3-way)' : '⚠️ Complex (multi-party)'}

This trade has a high quality score, indicating fair value exchange and low execution risk.`,
              tradeProposal: {
                type: (currentTrade.totalParticipants === 2 ? 'direct' : 'multi-party') as 'direct' | 'multi-party',
                steps: formatTradeSteps(currentTrade),
                confidence: Math.round(currentTrade.efficiency * 100),
                tradeData: currentTrade,
              },
              suggestions: [
                "Execute this trade",
                "Show trade details",
                "Compare with other trades",
                "View all quality metrics"
              ],
            };
          }
          
          // Handle "is this a good trade" questions specifically
          if (lowerMessage.includes('is this a good trade') || 
              lowerMessage.includes('good trade') ||
              lowerMessage.includes('this a good')) {
            
            const efficiency = Math.round(currentTrade.efficiency * 100);
            let verdict = '';
            let reasoning = '';
            
            if (efficiency >= 95) {
              verdict = '✅ **YES, this is an EXCELLENT trade!**';
              reasoning = `With ${efficiency}% efficiency, this trade offers perfect value alignment. Both NFTs are closely matched in market value, making this a win-win exchange.`;
            } else if (efficiency >= 85) {
              verdict = '👍 **YES, this is a GOOD trade!**';
              reasoning = `With ${efficiency}% efficiency, this trade offers strong value alignment. There's minimal value difference between the NFTs.`;
            } else if (efficiency >= 70) {
              verdict = '⚠️ **This is a FAIR trade.**';
              reasoning = `With ${efficiency}% efficiency, there's some value difference, but it's still within acceptable ranges for a beneficial trade.`;
            } else {
              verdict = '❌ **This trade needs caution.**';
              reasoning = `With ${efficiency}% efficiency, there's a significant value imbalance. Consider looking for better alternatives.`;
            }
            
            return {
              text: `${verdict}

**Trade Analysis: ${givingNFT?.name || 'Unknown NFT'} → ${receivingNFT?.name || 'Unknown NFT'}**

${reasoning}

**Key Trade Metrics:**
🎯 **Efficiency Score:** ${efficiency}%
👥 **Trade Type:** ${currentTrade.totalParticipants === 2 ? 'Direct 2-party swap' : currentTrade.totalParticipants === 3 ? '3-way triangle trade' : `${currentTrade.totalParticipants}-party multi-loop`}
⚡ **Execution Speed:** ${currentTrade.totalParticipants === 2 ? 'Fast (direct swap)' : currentTrade.totalParticipants === 3 ? 'Moderate (3-way coordination)' : 'Slower (complex coordination)'}
🔒 **Risk Level:** ${efficiency >= 90 ? 'Low' : efficiency >= 80 ? 'Low-Medium' : efficiency >= 70 ? 'Medium' : 'High'}

**Bottom Line:** ${efficiency >= 85 ? 'This trade is worth executing!' : efficiency >= 70 ? 'Proceed if you like the NFT you\'re receiving.' : 'Consider waiting for a better opportunity.'}`,
              tradeProposal: {
                type: (currentTrade.totalParticipants === 2 ? 'direct' : 'multi-party') as 'direct' | 'multi-party',
                steps: formatTradeSteps(currentTrade),
                confidence: Math.round(currentTrade.efficiency * 100),
                tradeData: currentTrade,
              },
              suggestions: [
                efficiency >= 85 ? "Execute this trade now!" : "Show better alternatives",
                "View detailed trade steps",
                "Compare with other trades",
                "What makes a trade good?"
              ],
            };
          }
          
          // General questions about the specific trade
          if (lowerMessage.includes('this trade') || lowerMessage.includes('that trade') || 
              (givingNFT && receivingNFT && 
               lowerMessage.includes(givingNFT.name?.toLowerCase() || '') && 
               lowerMessage.includes(receivingNFT.name?.toLowerCase() || ''))) {
            
            return {
              text: `**Trade Analysis: ${givingNFT?.name || 'Unknown NFT'} → ${receivingNFT?.name || 'Unknown NFT'}**

This is the ${currentTrade.totalParticipants === 2 ? 'direct 2-party' : currentTrade.totalParticipants === 3 ? '3-way' : `${currentTrade.totalParticipants}-party`} trade I just showed you:

🔄 **You give:** ${givingNFT?.name || 'Unknown NFT'}
📥 **You receive:** ${receivingNFT?.name || 'Unknown NFT'}  
⚡ **Efficiency:** ${Math.round(currentTrade.efficiency * 100)}%
👥 **Participants:** ${currentTrade.totalParticipants} traders
🎯 **Quality Score:** ${currentTrade.qualityScore ? Math.round(currentTrade.qualityScore * 100) : Math.round(currentTrade.efficiency * 100)}%

**Why this is a good trade:**
• ${currentTrade.efficiency >= 0.95 ? 'Perfect value alignment (100% efficiency)' : 'Strong value alignment'}
• ${currentTrade.totalParticipants === 2 ? 'Simple direct swap - fast execution' : 'Multi-party loop - ensures everyone benefits'}
• Both NFTs are actively wanted in the SWAPS network

This trade is ready to execute whenever you're ready!`,
              tradeProposal: {
                type: (currentTrade.totalParticipants === 2 ? 'direct' : 'multi-party') as 'direct' | 'multi-party',
                steps: formatTradeSteps(currentTrade),
                confidence: Math.round(currentTrade.efficiency * 100),
                tradeData: currentTrade,
              },
              suggestions: [
                "Execute this trade now",
                "Show next best trade",
                "View trade steps",
                "Compare alternatives"
              ],
            };
          }
        }
        
        // Handle "you just showed" references
        if (lowerMessage.includes('you just showed') || 
            lowerMessage.includes('you showed') ||
            lowerMessage.includes('you mentioned') ||
            lowerMessage.includes('the one you') ||
            lowerMessage.includes('that you just')) {
          
          const givingNFT = userStep?.nfts[0];
          const receivingNFT = receivingStep?.nfts[0];
          
          return {
            text: `**Yes, I just showed you this trade:**

🎯 **${currentTrade.totalParticipants === 2 ? 'Direct' : currentTrade.totalParticipants === 3 ? '3-Way' : 'Multi-Party'} Trade ${currentTradeIndex + 1} of ${lastShownTrades.length}**

🔄 **You give:** ${givingNFT?.name || 'Unknown NFT'}  
📥 **You receive:** ${receivingNFT?.name || 'Unknown NFT'}
⚡ **Efficiency:** ${Math.round(currentTrade.efficiency * 100)}%  
🎯 **Quality Score:** ${currentTrade.qualityScore ? Math.round(currentTrade.qualityScore * 100) : Math.round(currentTrade.efficiency * 100)}%

This trade was ranked as ${currentTradeIndex === 0 ? 'your best' : `#${currentTradeIndex + 1}`} option out of ${lastShownTrades.length} available trades. The high efficiency score means both NFTs have closely matched values.

What would you like to know about this specific trade?`,
            tradeProposal: {
              type: (currentTrade.totalParticipants === 2 ? 'direct' : 'multi-party') as 'direct' | 'multi-party',
              steps: formatTradeSteps(currentTrade),
              confidence: Math.round(currentTrade.efficiency * 100),
              tradeData: currentTrade,
            },
            suggestions: [
              "What makes this trade good?",
              "Show me the trade steps",
              "Execute this trade",
              "Show next trade option"
            ],
          };
        }
      }

      // PRIORITY 2: Standard intent processing...
      // Phase 1: Analyzing intent and context (Start at 0%)
      updateStatus({
        message: 'Understanding your request...',
        progress: 0,
        phase: 'analyzing',
        details: 'Parsing intent and context from your message'
      });

      await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause for UI feedback

      // Update conversation history
      const updatedHistory = [...conversationHistory, { role: 'user' as const, content: userInput }];
      setConversationHistory(updatedHistory);

      // Phase 2: Initial AI processing setup (5%)
      updateStatus({
        message: 'Initializing AI analysis...',
        progress: 5,
        phase: 'processing',
        details: 'Setting up enhanced AI processing pipeline'
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // Phase 3: Connecting to AI services (10%)
      updateStatus({
        message: 'Connecting to SWAPS intelligence network...',
        progress: 10,
        phase: 'processing',
        details: 'Accessing real-time market data and trade patterns'
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      // Phase 4: Enhanced AI processing with progress simulation (15-40%)
      updateStatus({
        message: 'Processing with advanced AI algorithms...',
        progress: 15,
        phase: 'processing',
        details: 'Analyzing your request with context-aware intelligence'
      });

      // Create a progress simulation during AI processing
      const aiStartTime = Date.now();
      const aiProgressInterval = setInterval(() => {
        const elapsed = Date.now() - aiStartTime;
        const progressBase = 15;
        const progressMax = 35;
        const timeoutMs = 8000; // Assume max 8 seconds for AI processing
        
        const aiProgress = Math.min(progressMax, progressBase + (elapsed / timeoutMs) * (progressMax - progressBase));
        
        updateStatus({
          message: 'Processing with advanced AI algorithms...',
          progress: Math.round(aiProgress),
          phase: 'processing',
          details: elapsed < 2000 
            ? 'Analyzing your request with context-aware intelligence'
            : elapsed < 4000
            ? 'Consulting knowledge base and real-time data'
            : elapsed < 6000
            ? 'Generating intelligent response'
            : 'Finalizing AI analysis'
        });
      }, 500);

      // Get intelligent response from Enhanced AI with full backend context
      const aiResponse = await enhancedAI.processQueryWithFullContext(userInput, {
        walletAddress: publicKey?.toString(),
        userNFTs: userNFTs,
        conversationHistory: conversationHistory,
        lastShownTrades: lastShownTrades,
        currentTradeIndex: currentTradeIndex
      });

      // Clear the AI progress interval
      clearInterval(aiProgressInterval);

      // Phase 5: AI processing complete (40%)
      updateStatus({
        message: 'AI analysis complete!',
        progress: 40,
        phase: 'processing',
        details: 'AI has generated intelligent response'
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // Update conversation history with assistant response
      setConversationHistory([...updatedHistory, { role: 'assistant' as const, content: aiResponse.message }]);

      // NEW: Handle trade filtering requests (3-way, direct, multi-party, etc.)
      if (intent.wantsFilteredTrades && lastShownTrades.length > 0) {
        updateStatus({
          message: 'Filtering trades by your criteria...',
          progress: 50,
          phase: 'evaluating',
          details: 'Analyzing trade structures to match your request'
        });

        let filteredTrades: TradeLoop[] = [];
        let filterDescription = '';

        if (intent.specificParticipantCount) {
          filteredTrades = lastShownTrades.filter(trade => trade.totalParticipants === intent.specificParticipantCount);
          filterDescription = `${intent.specificParticipantCount}-party trades`;
        } else if (intent.wantsDirectTrade) {
          filteredTrades = lastShownTrades.filter(trade => trade.totalParticipants === 2);
          filterDescription = 'direct (2-party) trades';
        } else if (intent.wantsThreeWayTrade) {
          filteredTrades = lastShownTrades.filter(trade => trade.totalParticipants === 3);
          filterDescription = '3-way trades';
        } else if (intent.wantsMultiPartyTrade) {
          filteredTrades = lastShownTrades.filter(trade => trade.totalParticipants > 3);
          filterDescription = 'multi-party trades (4+ participants)';
        }

        if (filteredTrades.length > 0) {
          // Sort by efficiency
          const sortedFilteredTrades = filteredTrades.sort((a, b) => b.efficiency - a.efficiency);
          const bestFilteredTrade = sortedFilteredTrades[0];

          // Update current trades and index
          setLastShownTrades(sortedFilteredTrades);
          setCurrentTradeIndex(0);

          const userStep = bestFilteredTrade.steps.find(s => s.from === publicKey?.toString());
          const receivingStep = bestFilteredTrade.steps.find(s => s.to === publicKey?.toString());

                     // Create summary of filtered trades
           const filteredSummary = sortedFilteredTrades.slice(0, 5).map((trade, idx) => {
             const userStep = trade.steps.find(s => s.from === publicKey?.toString());
             const receivingStep = trade.steps.find(s => s.to === publicKey?.toString());
            const giving = userStep?.nfts[0]?.name || 'Unknown NFT';
            const receiving = receivingStep?.nfts[0]?.name || 'Unknown NFT';
            const efficiency = Math.round(trade.efficiency * 100);
            
            return `${idx + 1}. Give **${giving}** → Receive **${receiving}** (${efficiency}% efficiency, ${trade.totalParticipants} participants)`;
          });

          updateStatus({
            message: 'Found matching trades!',
            progress: 100,
            phase: 'completing',
            details: `Displaying ${filteredTrades.length} ${filterDescription}`
          });

          return {
            text: `🎯 **Found ${filteredTrades.length} ${filterDescription}!**\n\n${filteredSummary.join('\n')}\n\n**📊 Best ${filterDescription.split(' ')[0]} Trade:**\n\nYou give: **${userStep?.nfts[0]?.name || 'Unknown NFT'}**\nYou receive: **${receivingStep?.nfts[0]?.name || 'Unknown NFT'}**\nEfficiency: **${Math.round(bestFilteredTrade.efficiency * 100)}%**\nParticipants: **${bestFilteredTrade.totalParticipants}**`,
            tradeProposal: {
              type: (bestFilteredTrade.totalParticipants === 2 ? 'direct' : 'multi-party') as 'direct' | 'multi-party',
              steps: formatTradeSteps(bestFilteredTrade),
              confidence: Math.round(bestFilteredTrade.efficiency * 100),
              tradeData: bestFilteredTrade,
            },
            suggestions: [
              filteredTrades.length > 1 ? "Show next trade in this category" : "Show all available trades",
              "Execute this trade",
              "Find different trade types"
            ],
          };
        } else {
          // No trades found matching the criteria
          const totalTrades = lastShownTrades.length;
          const tradeBreakdown = lastShownTrades.reduce((acc, trade) => {
            const participants = trade.totalParticipants;
            if (participants === 2) acc.direct++;
            else if (participants === 3) acc.threeWay++;
            else acc.multiParty++;
            return acc;
          }, { direct: 0, threeWay: 0, multiParty: 0 });

          return {
            text: `❌ **No ${filterDescription} found in your current trade opportunities.**\n\n**Available trade breakdown:**\n• Direct (2-party): ${tradeBreakdown.direct} trades\n• 3-way: ${tradeBreakdown.threeWay} trades\n• Multi-party (4+): ${tradeBreakdown.multiParty} trades\n\n💡 Try searching for more trade opportunities or consider different trade types!`,
            suggestions: [
              "Show all available trades",
              "Find more trade opportunities",
              tradeBreakdown.direct > 0 ? "Show direct trades" : "Search for specific NFTs"
            ],
          };
        }
      }

      // Handle specific trade selection
      if (intent.wantsSpecificTrade && lastShownTrades.length > 0) {
        // Extract trade details from user message
        const extractedTrade = extractTradeFromMessage(userInput);
        
        if (extractedTrade) {
          // Find the matching trade from lastShownTrades
          const matchingTrade = lastShownTrades.find(trade => {
            const userStep = trade.steps.find(s => s.from === publicKey?.toString());
            const receivingStep = trade.steps.find(s => s.to === publicKey?.toString());
            
            if (userStep && receivingStep) {
              const givingName = userStep.nfts[0]?.name || '';
              const receivingName = receivingStep.nfts[0]?.name || '';
              
              return givingName.includes(extractedTrade.givingNFT!) && 
                     receivingName.includes(extractedTrade.receivingNFT!);
            }
            return false;
          });
          
          if (matchingTrade) {
            const userStep = matchingTrade.steps.find(s => s.from === publicKey?.toString());
            const receivingStep = matchingTrade.steps.find(s => s.to === publicKey?.toString());
            
            return {
              text: `Here's the trade you requested:\n\n**You give:** ${userStep?.nfts[0]?.name || 'Unknown NFT'}\n**You receive:** ${receivingStep?.nfts[0]?.name || 'Unknown NFT'}\n**Efficiency:** ${Math.round(matchingTrade.efficiency * 100)}%\n**Participants:** ${matchingTrade.totalParticipants}`,
              tradeProposal: {
                type: (matchingTrade.steps.length === 1 ? 'direct' : 'multi-party') as 'direct' | 'multi-party',
                steps: formatTradeSteps(matchingTrade),
                confidence: Math.round(matchingTrade.efficiency * 100),
                tradeData: matchingTrade,
              },
              suggestions: [
                "Execute this trade",
                "Show other trades",
                "View trade details"
              ],
            };
          }
        } else if (lowerMessage.includes('propose that trade')) {
          // User wants to see the last trade again
          if (currentTradeIndex < lastShownTrades.length) {
            const trade = lastShownTrades[currentTradeIndex];
            const userStep = trade.steps.find(s => s.from === publicKey?.toString());
            const receivingStep = trade.steps.find(s => s.to === publicKey?.toString());
            
            return {
              text: `Here's the trade proposal:\n\n**You give:** ${userStep?.nfts[0]?.name || 'Unknown NFT'}\n**You receive:** ${receivingStep?.nfts[0]?.name || 'Unknown NFT'}\n**Efficiency:** ${Math.round(trade.efficiency * 100)}%\n**Participants:** ${trade.totalParticipants}`,
              tradeProposal: {
                type: (trade.steps.length === 1 ? 'direct' : 'multi-party') as 'direct' | 'multi-party',
                steps: formatTradeSteps(trade),
                confidence: Math.round(trade.efficiency * 100),
                tradeData: trade,
              },
              suggestions: [
                "Execute this trade",
                "Show next trade",
                "View all trades"
              ],
            };
          }
        }
      }
      
      // Handle navigation through trades
      if (intent.wantsNextTrade && lastShownTrades.length > 0) {
        const nextIndex = (currentTradeIndex + 1) % lastShownTrades.length;
        setCurrentTradeIndex(nextIndex);
        const trade = lastShownTrades[nextIndex];
        const userStep = trade.steps.find(s => s.from === publicKey?.toString());
        const receivingStep = trade.steps.find(s => s.to === publicKey?.toString());
        
        // Determine what type of trade this is for better description
        let tradeTypeDescription = '';
        if (trade.totalParticipants === 2) {
          tradeTypeDescription = 'Direct Trade';
        } else if (trade.totalParticipants === 3) {
          tradeTypeDescription = '3-Way Trade';
        } else {
          tradeTypeDescription = `${trade.totalParticipants}-Party Trade`;
        }
        
        return {
          text: `**${tradeTypeDescription} ${nextIndex + 1} of ${lastShownTrades.length}:**\n\n**You give:** ${userStep?.nfts[0]?.name || 'Unknown NFT'}\n**You receive:** ${receivingStep?.nfts[0]?.name || 'Unknown NFT'}\n**Efficiency:** ${Math.round(trade.efficiency * 100)}%\n**Participants:** ${trade.totalParticipants}`,
          tradeProposal: {
            type: (trade.totalParticipants === 2 ? 'direct' : 'multi-party') as 'direct' | 'multi-party',
            steps: formatTradeSteps(trade),
            confidence: Math.round(trade.efficiency * 100),
            tradeData: trade,
          },
          suggestions: [
            "Execute this trade",
            nextIndex + 1 < lastShownTrades.length ? "Show next trade" : "Back to first trade",
            "View all trade types"
          ],
        };
      }

      // Handle generic trade requests (e.g., "find me trades", "what trades are available")
      // ALSO handle filtering requests that include "find" (e.g., "find me a 3 way trade")
      if ((lowerMessage.includes('find') && lowerMessage.includes('trade')) ||
          lowerMessage.includes('available') && lowerMessage.includes('trade') ||
          lowerMessage.includes('see what trades') ||
          lowerMessage.includes('what trades are available') ||
          intent.wantsTrades ||
          intent.wantsFilteredTrades) {
        
        // Phase 3: Loading user portfolio if needed
        if (userNFTs.length === 0 && publicKey) {
          updateStatus({
            message: 'Loading your NFT portfolio...',
            progress: 45,
            phase: 'searching',
            details: 'Fetching your wallet contents to identify tradeable assets'
          });
          const nfts = await nftService.fetchUserNFTs(publicKey.toString());
          setUserNFTs(nfts);
          
          updateStatus({
            message: 'NFT portfolio loaded successfully!',
            progress: 50,
            phase: 'searching',
            details: `Found ${nfts.length} NFTs in your wallet`
          });
          
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        if (publicKey) {
          // Phase 4: Searching for trades
          updateStatus({
            message: 'Scanning the SWAPS network for trade opportunities...',
            progress: 55,
            phase: 'searching',
            details: 'Analyzing multi-party trade paths across all connected wallets'
          });
          
          await new Promise(resolve => setTimeout(resolve, 400));
          
          try {
            // Phase 5: Checking cached trade data
            updateStatus({
              message: 'Checking for recently discovered trades...',
              progress: 60,
              phase: 'searching',
              details: 'Looking for cached trade opportunities in your session'
            });

            // Check session storage for existing trades
            const sessionTrades = sessionStorage.getItem('swaps_recent_trades');
            let existingTrades: TradeLoop[] = [];
            if (sessionTrades) {
              try {
                existingTrades = JSON.parse(sessionTrades);
              } catch (e) {
                console.error('Error parsing session trades:', e);
              }
            }
            
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Phase 6: Discovering new trade paths
            updateStatus({
              message: 'Discovering new multi-party trade routes...',
              progress: 65,
              phase: 'searching',
              details: 'Running graph algorithms to find optimal trade loops'
            });

            await new Promise(resolve => setTimeout(resolve, 500));

            // Do a general discovery call to find ALL trades for the wallet
            const generalTrades = await tradeService.findTradeLoops(null, publicKey.toString(), {
              maxResults: 20,
              includeCollectionTrades: true,
              considerCollections: true
            });
            
            // Phase 7: Filtering and validating trades
            updateStatus({
              message: 'Filtering trades relevant to your wallet...',
              progress: 75,
              phase: 'evaluating',
              details: 'Checking which trades involve your NFTs and benefit you'
            });

            await new Promise(resolve => setTimeout(resolve, 400));

            // Filter to only show trades where user is first sender
            const relevantTrades = generalTrades.filter(trade => {
              if (!trade.steps || trade.steps.length === 0) return false;
              const isUserSender = trade.steps.some(step => step.from === publicKey.toString());
              const isUserReceiver = trade.steps.some(step => step.to === publicKey.toString());
              if (!(isUserSender && isUserReceiver)) return false;
              return trade.steps[0].from === publicKey.toString();
            });

            // Phase 8: Combining and deduplicating results
            updateStatus({
              message: 'Combining results and removing duplicates...',
              progress: 80,
              phase: 'evaluating',
              details: `Found ${relevantTrades.length} new trades, merging with cached data`
            });
            
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Combine with existing trades and remove duplicates
            const allTrades = [...relevantTrades, ...existingTrades.filter(trade => {
              const isUserSender = trade.steps.some(step => step.from === publicKey.toString());
              const isUserReceiver = trade.steps.some(step => step.to === publicKey.toString());
              return isUserSender && isUserReceiver && trade.steps[0].from === publicKey.toString();
            })];
            
            const uniqueTrades = Array.from(
              new Map(allTrades.map(trade => [trade.id, trade])).values()
            );
            
            if (uniqueTrades.length > 0) {
              // Phase 9: Analyzing and ranking trades
              updateStatus({
                message: 'Ranking trades by efficiency and value...',
                progress: 85,
                phase: 'evaluating',
                details: `Analyzing ${uniqueTrades.length} trade opportunities to find the best matches`
              });

              await new Promise(resolve => setTimeout(resolve, 400));

              // Save the found trades for later reference
              setLastShownTrades(uniqueTrades);
              setCurrentTradeIndex(0);
              
              // Sort by efficiency
              let sortedTrades = uniqueTrades.sort((a, b) => b.efficiency - a.efficiency);

              // APPLY FILTERING if this is a filtering request
              let isFilteredResult = false;
              let filterDescription = '';
              if (intent.wantsFilteredTrades) {
                updateStatus({
                  message: 'Applying your trade filter...',
                  progress: 90,
                  phase: 'evaluating',
                  details: 'Filtering trades to match your specific criteria'
                });

                await new Promise(resolve => setTimeout(resolve, 300));

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
                
                // Update the cached trades to the filtered set
                setLastShownTrades(sortedTrades);
                setCurrentTradeIndex(0);
              }

              // Phase 10: Completing analysis
              updateStatus({
                message: isFilteredResult ? `Found ${sortedTrades.length} ${filterDescription}!` : 'Preparing your trade recommendations...',
                progress: 95,
                phase: 'completing',
                details: isFilteredResult ? `Filtered from ${uniqueTrades.length} total trades` : 'Finalizing results and preparing detailed analysis'
              });

              await new Promise(resolve => setTimeout(resolve, 400));

              // Final completion
              updateStatus({
                message: 'Trade analysis complete!',
                progress: 100,
                phase: 'completing',
                details: `Ready to display ${sortedTrades.length} trade opportunities`
              });

              await new Promise(resolve => setTimeout(resolve, 200));

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

                return {
                  text: `❌ **No ${filterDescription} found in your available trades.**\n\n**Your ${totalTrades} available trades breakdown:**\n🔄 Direct (2-party): ${allTradesBreakdown.direct}\n🔀 3-way: ${allTradesBreakdown.threeWay}\n🌐 Multi-party (4+): ${allTradesBreakdown.multiParty}\n\n💡 Try a different trade type or search for more opportunities!`,
                  suggestions: [
                    "Show all available trades",
                    "Find more trade opportunities",
                    allTradesBreakdown.direct > 0 ? "Show direct trades" : "Search for specific NFTs"
                  ],
                };
              }
              
              // Show quick summary first, then details with trade type info
              const summaryLines = sortedTrades.map((trade, idx) => {
                const userStep = trade.steps.find(s => s.from === publicKey.toString());
                const receivingStep = trade.steps.find(s => s.to === publicKey?.toString());
                const giving = userStep?.nfts[0]?.name || 'Unknown NFT';
                const receiving = receivingStep?.nfts[0]?.name || 'Unknown NFT';
                const efficiency = Math.round(trade.efficiency * 100);
                
                // Add trade type indicator
                let typeIndicator = '';
                if (trade.totalParticipants === 2) typeIndicator = '🔄 ';
                else if (trade.totalParticipants === 3) typeIndicator = '🔀 ';
                else typeIndicator = '🌐 ';
                
                return `${idx + 1}. ${typeIndicator}Give **${giving}** → Receive **${receiving}** (${efficiency}% efficiency, ${trade.totalParticipants}p)`;
              });

              // Create trade type breakdown (for current results)
              const tradeBreakdown = sortedTrades.reduce((acc, trade) => {
                const participants = trade.totalParticipants;
                if (participants === 2) acc.direct++;
                else if (participants === 3) acc.threeWay++;
                else acc.multiParty++;
                return acc;
              }, { direct: 0, threeWay: 0, multiParty: 0 });
              
              const bestTrade = sortedTrades[0];
              const firstUserStep = bestTrade.steps.find(s => s.from === publicKey.toString());
              const firstReceivingStep = bestTrade.steps.find(s => s.to === publicKey?.toString());
              
              // Show the trade proposal for the best trade
              const tradeSteps = formatTradeSteps(bestTrade);

              // Different text for filtered vs unfiltered results
              let resultText = '';
              if (isFilteredResult) {
                resultText = `🎯 **Found ${sortedTrades.length} ${filterDescription}!**\n\n${summaryLines.join('\n')}\n\n**📊 Best ${filterDescription.split(' ')[0]} Trade:**\n\nYou give: **${firstUserStep?.nfts[0]?.name || 'Unknown NFT'}**\nYou receive: **${firstReceivingStep?.nfts[0]?.name || 'Unknown NFT'}**\nEfficiency: **${Math.round(bestTrade.efficiency * 100)}%**\nParticipants: **${bestTrade.totalParticipants}**`;
              } else {
                resultText = `🔍 Searching for available trades...\n\n✅ Found ${uniqueTrades.length} trade opportunit${uniqueTrades.length > 1 ? 'ies' : 'y'}!\n\n**📊 Trade Types Available:**\n🔄 Direct (2-party): ${tradeBreakdown.direct}\n🔀 3-way: ${tradeBreakdown.threeWay}\n🌐 Multi-party (4+): ${tradeBreakdown.multiParty}\n\n🎯 **Available Trades:**\n\n${summaryLines.join('\n')}\n\n**📊 Best Trade Details:**\n\nYou give: **${firstUserStep?.nfts[0]?.name || 'Unknown NFT'}**\nYou receive: **${firstReceivingStep?.nfts[0]?.name || 'Unknown NFT'}**\nEfficiency: **${Math.round(bestTrade.efficiency * 100)}%**\nParticipants: **${bestTrade.totalParticipants}**`;
              }
              
              return {
                text: resultText,
                tradeProposal: {
                  type: (bestTrade.steps.length === 1 ? 'direct' : 'multi-party') as 'direct' | 'multi-party',
                  steps: tradeSteps,
                  confidence: Math.round(bestTrade.efficiency * 100),
                  tradeData: bestTrade,
                },
                suggestions: isFilteredResult ? [
                  sortedTrades.length > 1 ? "Show next trade in this category" : "Show all available trades",
                  "Execute this trade",
                  "View all trade types"
                ] : [
                  uniqueTrades.length > 1 ? "Show next best trade" : "Search for more trades",
                  "Execute this trade",
                  tradeBreakdown.threeWay > 0 ? "Show only 3-way trades" : "Find 3-way trades",
                  tradeBreakdown.direct > 0 ? "Show only direct trades" : "Find direct trades"
                ],
              };
            } else {
              return {
                text: "🔍 Searching for available trades...\n\n❌ No trades found at the moment. This could be because:\n\n• No other users currently want your NFTs\n• Your wallet might be empty\n• The network is still discovering new trade paths\n\nTry searching for specific NFTs you want, or wait for new trade opportunities to emerge!",
                suggestions: [
                  "Search for a specific NFT",
                  "Show my inventory",
                  "How to increase trade opportunities"
                ],
              };
            }
          } catch (error) {
            console.error('Error searching for trades:', error);
            return {
              text: "❌ An error occurred while searching for trades. Please try again in a moment.",
              suggestions: [
                "Try again",
                "Check wallet connection",
                "Contact support"
              ],
            };
          }
        } else {
          return {
            text: "Please connect your wallet to see available trades.",
            suggestions: ["Connect wallet", "How does SWAPS work?", "What is multi-party trading?"],
          };
        }
      }

      // Place this AFTER the generic trade search handler
      // Handle inventory request FIRST (before NFT address detection)
      if (intent.wantsInventory && publicKey) {
        if (userNFTs.length === 0) {
          updateStatus({
            message: 'Loading your complete NFT portfolio...',
            progress: 40,
            phase: 'searching',
            details: 'Fetching all NFTs from your connected wallet'
          });
          const nfts = await nftService.fetchUserNFTs(publicKey.toString());
          setUserNFTs(nfts);
          
          updateStatus({
            message: 'Analyzing your collection...',
            progress: 80,
            phase: 'evaluating',
            details: `Categorizing ${nfts.length} NFTs by collection and value`
          });
          
          if (nfts.length > 0) {
            // Group NFTs by collection
            const nftsByCollection = nfts.reduce((acc, nft) => {
              const collectionKey = typeof nft.collection === 'string' 
                ? nft.collection 
                : (nft.collection?.name || 'Unknown Collection');
              if (!acc[collectionKey]) acc[collectionKey] = [];
              acc[collectionKey].push(nft);
              return acc;
            }, {} as Record<string, NFTMetadata[]>);
            
            let inventoryMessage = `📦 **Your NFT Portfolio:**\n\n`;
            Object.entries(nftsByCollection).forEach(([collection, collectionNfts]) => {
              inventoryMessage += `**${collection}** (${collectionNfts.length} NFTs)\n`;
              collectionNfts.forEach(nft => {
                inventoryMessage += `• ${nft.name || `NFT #${nft.address.slice(0, 8)}...`}`;
                if (nft.floorPrice) inventoryMessage += ` - Floor: ${nft.floorPrice} SOL`;
                inventoryMessage += '\n';
              });
              inventoryMessage += '\n';
            });
            
            inventoryMessage += `💡 **Total:** ${nfts.length} NFTs across ${Object.keys(nftsByCollection).length} collections`;
            
            return {
              text: inventoryMessage,
              suggestions: [
                "Find trades for my most valuable NFT",
                "Show all available trade paths",
                "Which NFTs have the most liquidity?"
              ],
            };
          } else {
            return {
              text: "🔍 I couldn't find any NFTs in your wallet. This could be because:\n• Your wallet is empty\n• The NFTs haven't been indexed yet\n• There's a network issue\n\nTry refreshing the page or checking your wallet on a Solana explorer.",
              suggestions: [
                "How do I get my first NFT?",
                "Show trending collections",
                "What is SWAPS?"
              ],
            };
          }
        } else {
          // User already has NFTs loaded, show them
          const nftsByCollection = userNFTs.reduce((acc, nft) => {
            const collectionKey = typeof nft.collection === 'string' 
              ? nft.collection 
              : (nft.collection?.name || 'Unknown Collection');
            if (!acc[collectionKey]) acc[collectionKey] = [];
            acc[collectionKey].push(nft);
            return acc;
          }, {} as Record<string, NFTMetadata[]>);
          
          let inventoryMessage = `📦 **Your NFT Portfolio:**\n\n`;
          Object.entries(nftsByCollection).forEach(([collection, collectionNfts]) => {
            inventoryMessage += `**${collection}** (${collectionNfts.length} NFTs)\n`;
            collectionNfts.forEach(nft => {
              inventoryMessage += `• ${nft.name || `NFT #${nft.address.slice(0, 8)}...`}`;
              if (nft.floorPrice) inventoryMessage += ` - Floor: ${nft.floorPrice} SOL`;
              inventoryMessage += '\n';
            });
            inventoryMessage += '\n';
          });
          
          inventoryMessage += `💡 **Total:** ${userNFTs.length} NFTs across ${Object.keys(nftsByCollection).length} collections`;
          
          return {
            text: inventoryMessage,
            suggestions: [
              "Find trades for my most valuable NFT",
              "Show all available trade paths",
              "Which NFTs have the most liquidity?"
            ],
          };
        }
      }

      // Handle "find best trade opportunities" or similar requests (also before NFT address)
      if ((lowerMessage.includes('best') && lowerMessage.includes('trade')) || 
          lowerMessage.includes('trade opportunities') ||
          lowerMessage.includes('tradeable nfts') ||
          intent.wantsTrades) {
        
        // First ensure we have user's NFTs
        if (userNFTs.length === 0 && publicKey) {
          updateStatus({
            message: 'Loading your NFT portfolio...',
            progress: 20,
            phase: 'searching',
            details: 'Fetching your wallet contents to identify tradeable assets'
          });
          const nfts = await nftService.fetchUserNFTs(publicKey.toString());
          setUserNFTs(nfts);
        }
        
        if (userNFTs.length > 0 && publicKey) {
          updateStatus({
            message: `Analyzing trade opportunities for your ${userNFTs.length} NFTs...`,
            progress: 30,
            phase: 'analyzing',
            details: 'Evaluating each NFT for potential trade paths'
          });
          
          try {
            // First, check if there are any existing discovered trades in session storage
            const sessionTrades = sessionStorage.getItem('swaps_recent_trades');
            let existingTrades: TradeLoop[] = [];
            if (sessionTrades) {
              try {
                existingTrades = JSON.parse(sessionTrades);
                console.log('Found existing trades in session:', existingTrades.length);
              } catch (e) {
                console.error('Error parsing session trades:', e);
              }
            }
            
            // Also check localStorage for discovered trades
            const discoveredTradesStr = localStorage.getItem('swaps_discovered_trades');
            let discoveredTradeIds: string[] = [];
            if (discoveredTradesStr) {
              try {
                discoveredTradeIds = JSON.parse(discoveredTradesStr);
                console.log('Found discovered trade IDs:', discoveredTradeIds.length);
              } catch (e) {
                console.error('Error parsing discovered trades:', e);
              }
            }
            
            // Filter existing trades for ones involving the user
            const userRelevantExistingTrades = existingTrades.filter(trade => {
              const isUserSender = trade.steps.some(step => step.from === publicKey.toString());
              const isUserReceiver = trade.steps.some(step => step.to === publicKey.toString());
              return isUserSender && isUserReceiver;
            });
            
            // Find trades for user's NFTs - but also search for trades where user RECEIVES NFTs
            const allTrades: TradeLoop[] = [...userRelevantExistingTrades];
            const tradesByNFT: Record<string, TradeLoop[]> = {};
            
            // Search for trades for each NFT (limit to first 5 for performance)
            const nftsToSearch = userNFTs.slice(0, 5);
            
            // Also do a general discovery call to find ALL trades for the wallet
            const generalTrades = await tradeService.findTradeLoops(null, publicKey.toString(), {
              maxResults: 20,
              includeCollectionTrades: true,
              considerCollections: true
            });
            
            // Filter to only show trades where user is first sender
            const relevantGeneralTrades = generalTrades.filter(trade => {
              if (!trade.steps || trade.steps.length === 0) return false;
              const isUserSender = trade.steps.some(step => step.from === publicKey.toString());
              const isUserReceiver = trade.steps.some(step => step.to === publicKey.toString());
              if (!(isUserSender && isUserReceiver)) return false;
              return trade.steps[0].from === publicKey.toString();
            });
            
            // Add these to our trades list
            allTrades.push(...relevantGeneralTrades);
            
            // Now search for specific NFT trades
            await Promise.all(
              nftsToSearch.map(async (nft) => {
                const trades = await tradeService.findTradeLoops(nft, publicKey.toString(), {
                  maxResults: 3,
                  includeCollectionTrades: true,
                });
                
                // Filter for relevant trades
                const relevantTrades = trades.filter(trade => {
                  if (!trade.steps || trade.steps.length === 0) return false;
                  const isUserSender = trade.steps.some(step => step.from === publicKey.toString());
                  const isUserReceiver = trade.steps.some(step => step.to === publicKey.toString());
                  return isUserSender && isUserReceiver && trade.steps[0].from === publicKey.toString();
                });
                
                if (relevantTrades.length > 0) {
                  tradesByNFT[nft.address] = relevantTrades;
                  allTrades.push(...relevantTrades);
                }
              })
            );
            
            // Remove duplicates based on trade ID
            const uniqueTrades = Array.from(
              new Map(allTrades.map(trade => [trade.id, trade])).values()
            );
            
            if (uniqueTrades.length > 0) {
              // Sort by efficiency
              const sortedTrades = uniqueTrades.sort((a, b) => b.efficiency - a.efficiency);
              const bestTrade = sortedTrades[0];
              
              let resultMessage = `✅ **Found ${uniqueTrades.length} trade opportunities!**\n\n`;
              
              // Group trades by what NFT the user gives
              const tradesByGiving: Record<string, TradeLoop[]> = {};
              uniqueTrades.forEach(trade => {
                const userStep = trade.steps.find(s => s.from === publicKey.toString());
                if (userStep && userStep.nfts[0]) {
                  const givingNft = userStep.nfts[0];
                  const key = givingNft.address;
                  if (!tradesByGiving[key]) tradesByGiving[key] = [];
                  tradesByGiving[key].push(trade);
                }
              });
              
              // Show NFTs with trade opportunities
              resultMessage += `🎯 **Your Tradeable NFTs:**\n`;
              Object.entries(tradesByGiving).forEach(([nftAddress, trades]) => {
                const nft = userNFTs.find(n => n.address === nftAddress) || 
                           trades[0].steps.find(s => s.from === publicKey.toString())?.nfts[0];
                if (nft) {
                  resultMessage += `• **${nft.name || 'Unknown NFT'}** - ${trades.length} trade path${trades.length > 1 ? 's' : ''} available\n`;
                }
              });
              
              resultMessage += `\n📊 **Best Trade Opportunity:**\n`;
              const userStep = bestTrade.steps.find(s => s.from === publicKey.toString());
              if (userStep) {
                const givingNFT = userStep.nfts[0];
                const receivingStep = bestTrade.steps.find(s => s.to === publicKey.toString());
                const receivingNFT = receivingStep?.nfts[0];
                
                resultMessage += `You give: **${givingNFT.name || 'Unknown NFT'}**\n`;
                resultMessage += `You receive: **${receivingNFT?.name || 'Unknown NFT'}**\n`;
                resultMessage += `Trade efficiency: **${(bestTrade.efficiency * 100).toFixed(0)}%**\n`;
                resultMessage += `Participants: **${bestTrade.totalParticipants}** traders\n`;
              }
              
              const tradeAnalysis = await LLMService.getInstance().analyzeTradeLoop(bestTrade, publicKey.toString());
              
              return {
                text: resultMessage,
                tradeProposal: {
                  type: (bestTrade.steps.length === 1 ? 'direct' : 'multi-party') as 'direct' | 'multi-party',
                  steps: formatTradeSteps(bestTrade),
                  confidence: Math.round(bestTrade.efficiency * 100),
                  tradeData: bestTrade,
                },
                suggestions: [
                  "Show more trade options",
                  "Execute this trade",
                  "Find trades for specific NFT"
                ],
              };
            } else {
              return {
                text: `🔄 **No immediate trade paths found.**\n\nThis could mean:\n• Your NFTs are highly sought after (low supply)\n• The specific combinations aren't available yet\n• More traders need to join the network\n\nI've registered your NFTs in the SWAPS network. You'll be notified when trade opportunities arise!\n\n💡 **Tips to increase trade opportunities:**\n• Search for specific NFTs you want to acquire\n• Add more NFTs to your wants list\n• Consider collection-level trades\n• Check back regularly as new trades appear constantly`,
                suggestions: [
                  "Search for NFTs I want",
                  "Register wants for collections",
                  "View trending trades"
                ],
              };
            }
          } catch (error) {
            console.error('Error finding trade opportunities:', error);
            return {
              text: `⚠️ Unable to search for trade opportunities at the moment. Please try again.`,
              suggestions: ["Retry search", "Check specific NFT", "View my portfolio"],
            };
          }
        } else {
          return {
            text: "To find your best trade opportunities, I need to see your NFT portfolio first. Please make sure your wallet is connected and try again.",
            suggestions: ["Show my NFTs", "Connect wallet", "How does SWAPS work?"],
          };
        }
      }

      // Check if we should search for trades based on intent or LLM response
      const shouldSearchForTrades = 
        aiResponse.shouldSearchTrades || 
        intent.wantsPath || 
        intent.mentionedCollections.length > 0 ||
        (intent.isNFTAddress && intent.nftAddress);

      // Handle collection mentions with actual search
      if (intent.mentionedCollections.length > 0 && publicKey && shouldSearchForTrades) {
        const collection = intent.mentionedCollections[0];
        
        updateStatus({
          message: `Searching for ${collection} trade opportunities...`,
          progress: 30,
          phase: 'searching',
          details: 'Scanning collection-specific trade paths across the network'
        });
        
        try {
          updateStatus({
            message: `Analyzing ${collection} market dynamics...`,
            progress: 60,
            phase: 'evaluating',
            details: 'Checking floor prices, volume, and trade history'
          });

          // Search for collection-based trades
          const trades = await tradeService.findCollectionTrades(publicKey.toString(), {
            maxResults: 20,
          });
          
          // Filter for relevant trades
          const relevantTrades = trades.filter(trade => 
            trade.steps.some(step => 
              step.nfts.some(nft => {
                const nftCollection = typeof nft.collection === 'string' ? nft.collection : nft.collection?.name;
                return nftCollection?.toLowerCase().includes(collection);
              })
            )
          );
          
          if (relevantTrades.length > 0) {
            const bestTrade = relevantTrades[0];
            const steps = formatTradeSteps(bestTrade);
            const tradeAnalysis = await LLMService.getInstance().analyzeTradeLoop(bestTrade, publicKey.toString());
            
            return {
              text: `✅ Found ${relevantTrades.length} trade path${relevantTrades.length > 1 ? 's' : ''} for ${collection}!\n\n${tradeAnalysis}`,
              tradeProposal: {
                type: (bestTrade.steps.length === 1 ? 'direct' : 'multi-party') as 'direct' | 'multi-party',
                steps,
                confidence: Math.round(bestTrade.efficiency * 100),
                tradeData: bestTrade,
              },
              suggestions: [
                `Show more ${collection} trades`,
                "Try a different collection",
                "Filter by specific NFT traits"
              ],
            };
          } else {
            // No trades found - be specific about what we searched for
            return {
              text: `🔄 No immediate trade paths found for ${collection} from your wallet.\n\nI've registered your interest in ${collection}. The SWAPS network continuously discovers new trade opportunities, so paths may become available soon!\n\nMeanwhile, you could:\n• Try searching for specific ${collection} NFTs by address\n• Explore other popular collections\n• Check what NFTs in your wallet have trade opportunities`,
              suggestions: [
                "Show my tradeable NFTs",
                "Search for Mad Lads instead",
                "How do I increase my trade opportunities?"
              ],
            };
          }
        } catch (error) {
          console.error('Error searching for collection trades:', error);
          return {
            text: `⚠️ I encountered an issue while searching for ${collection} trades. This might be due to network connectivity. Please try again in a moment.`,
            suggestions: [
              "Retry search",
              "Check network status",
              "Try a different collection"
            ],
          };
        }
      }

      // Check if LLM extracted an NFT address or suggests searching
      if ((aiResponse.extractedNFTAddress || (intent.isNFTAddress && intent.nftAddress)) && publicKey) {
        const nftAddress = aiResponse.extractedNFTAddress || intent.nftAddress;
        
        updateStatus({
          message: `Analyzing NFT ${nftAddress!.slice(0, 8)}...`,
          progress: 25,
          phase: 'searching',
          details: 'Fetching NFT metadata and ownership details'
        });
        
        try {
          const nftMetadata = await nftService.getNFTMetadata(nftAddress!);
          
          updateStatus({
            message: `Searching for trade paths to ${nftMetadata.name || 'this NFT'}...`,
            progress: 50,
            phase: 'searching',
            details: 'Discovering multi-party trade routes to acquire this NFT'
          });

          const trades = await tradeService.findTradeLoops(nftMetadata, publicKey.toString(), {
            includeCollectionTrades: true,
            considerCollections: true,
            maxResults: 10,
          });
          
          if (trades.length > 0) {
            const relevantTrades = trades.filter(trade => 
              trade.steps.some(step => 
                step.to === publicKey.toString() && 
                step.nfts.some(nft => nft.address === nftAddress)
              )
            );
            
            if (relevantTrades.length > 0) {
              const bestTrade = relevantTrades[0];
              const steps = formatTradeSteps(bestTrade);
              
              // Get AI analysis of the trade
              const tradeAnalysis = await LLMService.getInstance().analyzeTradeLoop(bestTrade, publicKey.toString());
              
              return {
                text: `✅ Found ${relevantTrades.length} trade path${relevantTrades.length > 1 ? 's' : ''}!\n\n${tradeAnalysis}`,
                tradeProposal: {
                  type: (bestTrade.steps.length === 1 ? 'direct' : 'multi-party') as 'direct' | 'multi-party',
                  steps,
                  confidence: Math.round(bestTrade.efficiency * 100),
                  tradeData: bestTrade,
                },
                suggestions: [
                  "Show alternative paths",
                  "Analyze trade fairness",
                  "Execute this trade"
                ],
              };
            } else {
              // Register interest
              await tradeService.addMultipleWants([nftAddress!], publicKey.toString());
              return {
                text: `🔄 No direct paths found to this NFT yet. I've registered your interest, and the SWAPS network will notify you when a trade path becomes available.\n\n${aiResponse.message}`,
                suggestions: aiResponse.suggestions || [
                  "Search for similar NFTs",
                  "View collection trades",
                  "Check my trade opportunities"
                ],
              };
            }
          } else {
            // No trades found, register interest
            await tradeService.addMultipleWants([nftAddress!], publicKey.toString());
            return {
              text: `🔄 No trade paths currently available for this NFT. Your interest has been registered!\n\n${aiResponse.message}`,
              suggestions: aiResponse.suggestions || [
                "Try another NFT",
                "Browse trending trades",
                "How to increase liquidity"
              ],
            };
          }
        } catch (error) {
          console.error('Error processing NFT trade search:', error);
          return {
            text: `⚠️ Unable to complete the search for NFT ${nftAddress!.slice(0, 8)}... The NFT address might be invalid or there could be a network issue.`,
            suggestions: [
              "Verify NFT address",
              "Try again",
              "Search by collection instead"
            ],
          };
        }
      }

      // Enhance suggestions with smart context-aware ones
      const enhancedSuggestions = enhanceSuggestionsWithContext(
        aiResponse.suggestions || [], 
        userInput,
        publicKey?.toString(),
        userNFTs,
        messages.length,
        lastShownTrades
      );

      // Return the LLM response with enhanced suggestions
      return {
        text: aiResponse.message,
        suggestions: enhancedSuggestions,
      };
      
    } catch (error) {
      console.error('Error in AI assistant:', error);
      return {
        text: "I encountered an error while processing your request. Please try again or check your internet connection.",
      };
    }
  };

  const sendMessage = useCallback(async (text: string) => {
    // Add user message
    const userMessage: Message = {
      text,
      isUser: true,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);
    
    try {
      // Generate AI response
      const response = await generateResponse(text);
      
      const aiMessage: Message = {
        text: response.text,
        isUser: false,
        timestamp: new Date(),
        tradeProposal: response.tradeProposal,
        suggestions: response.suggestions,
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: Message = {
        text: "I encountered an error while analyzing trade paths. Please try again.",
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
      clearStatus(); // Clear status when processing completes
    }
  }, [publicKey, userNFTs, clearStatus]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setUserNFTs([]);
    setLastShownTrades([]);
    setCurrentTradeIndex(0);
  }, []);

  return {
    messages,
    sendMessage,
    clearChat,
    isProcessing,
    currentStatus,
  };
};
