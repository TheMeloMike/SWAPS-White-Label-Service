import { useState, useCallback, useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { TradeService } from '@/services/trade';
import { NFTService } from '@/services/nft';
import { LLMService } from '@/services/ai/llm.service';
import { EnhancedAIService } from '@/services/ai/enhanced-ai.service';
import { ResponseStreamingService } from '@/services/ai/response-streaming.service';
import { SmartSuggestionEngine } from '@/services/ai/smart-suggestion.service';
import { TradeLoop, TradeStep } from '@/types/trade';
import { NFTMetadata } from '@/types/nft';

interface StreamingMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isStreaming?: boolean;
  isComplete?: boolean;
  streamingProgress?: number;
  tradeProposal?: {
    type: 'direct' | 'multi-party';
    steps: string[];
    confidence?: number;
    estimatedGasFees?: number;
    tradeData?: TradeLoop;
  };
  suggestions?: string[];
  loadingType?: 'simple' | 'trade_analysis' | 'portfolio' | 'search';
}

interface EnhancedStatusUpdate {
  message: string;
  progress: number; // 0-100
  phase: 'analyzing' | 'searching' | 'processing' | 'evaluating' | 'completing';
  details?: string;
  estimatedTimeRemaining?: number;
  skeletonContent?: string[];
}

/**
 * Enhanced Streaming Trade Assistant Hook
 * 
 * Provides progressive AI response display with:
 * - Real-time response streaming with natural typing effects
 * - Intelligent loading states based on query type
 * - Enhanced skeleton loading with contextual messages
 * - Smooth animations and transitions
 * - Backward compatibility with existing trade assistant
 * 
 * Designed to make the AI feel significantly faster and more responsive
 * while maintaining all existing functionality.
 */
export const useStreamingTradeAssistant = () => {
  const { publicKey } = useWallet();
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<EnhancedStatusUpdate | null>(null);
  const [userNFTs, setUserNFTs] = useState<NFTMetadata[]>([]);
  const [conversationHistory, setConversationHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [lastShownTrades, setLastShownTrades] = useState<TradeLoop[]>([]);
  const [currentTradeIndex, setCurrentTradeIndex] = useState(0);
  
  // Streaming service reference
  const streamingService = ResponseStreamingService.getInstance();
  const messageIdCounter = useRef(0);
  
  // Enhanced status update with intelligent loading
  const updateStatus = useCallback((status: EnhancedStatusUpdate) => {
    setCurrentStatus(status);
  }, []);
  
  // Clear status
  const clearStatus = useCallback(() => {
    setCurrentStatus(null);
  }, []);
  
  // Generate unique message ID
  const generateMessageId = useCallback(() => {
    messageIdCounter.current += 1;
    return `msg_${Date.now()}_${messageIdCounter.current}`;
  }, []);
  
  // Detect query type for appropriate loading states
  const detectQueryType = useCallback((query: string): StreamingMessage['loadingType'] => {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('trade') || lowerQuery.includes('efficiency') || lowerQuery.includes('swap')) {
      return 'trade_analysis';
    }
    
    if (lowerQuery.includes('portfolio') || lowerQuery.includes('my nft') || lowerQuery.includes('inventory')) {
      return 'portfolio';
    }
    
    if (lowerQuery.includes('search') || lowerQuery.includes('find') || lowerQuery.includes('look')) {
      return 'search';
    }
    
    return 'simple';
  }, []);
  
  // Enhanced response generation with streaming
  const generateStreamingResponse = useCallback(async (userInput: string): Promise<void> => {
    const queryType = detectQueryType(userInput);
    
    // Start with enhanced loading state
    const skeletonContent = streamingService.createSkeletonForContentType(queryType || 'simple');
    
    updateStatus({
      message: 'Analyzing your request...',
      progress: 0,
      phase: 'analyzing',
      details: 'Understanding query context and intent',
      skeletonContent
    });
    
    try {
      // Phase 1: Intent Analysis (0-15%)
      updateStatus({
        message: 'Understanding your request...',
        progress: 5,
        phase: 'analyzing',
        details: 'Parsing intent and extracting entities',
        estimatedTimeRemaining: 8000,
        skeletonContent
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Phase 2: Data Gathering (15-40%)
      updateStatus({
        message: queryType === 'trade_analysis' ? 'Analyzing trade networks...' : 
                queryType === 'portfolio' ? 'Scanning your portfolio...' : 
                queryType === 'search' ? 'Searching SWAPS network...' : 
                'Gathering relevant data...',
        progress: 15,
        phase: 'searching',
        details: 'Accessing real-time market data and user context',
        estimatedTimeRemaining: 6000,
        skeletonContent
      });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Phase 3: AI Processing (40-70%)
      updateStatus({
        message: 'Processing with advanced AI...',
        progress: 40,
        phase: 'processing',
        details: 'Generating intelligent response with context awareness',
        estimatedTimeRemaining: 4000,
        skeletonContent: [
          '🤖 AI is analyzing your request...',
          '💭 Generating contextual insights...',
          '🎯 Preparing personalized response...'
        ]
      });
      
      // Get AI response using the actual working EnhancedAIService
      const enhancedAI = EnhancedAIService.getInstance();
      
      // Use the actual working method from EnhancedAIService
      const aiResponse = await enhancedAI.processQueryWithFullContext(userInput, {
        walletAddress: publicKey?.toString(),
        userNFTs: userNFTs,
        conversationHistory: conversationHistory,
        lastShownTrades: lastShownTrades,
        currentTradeIndex: currentTradeIndex
      });
      
      // Phase 4: Response Preparation (70-90%)
      updateStatus({
        message: 'Preparing response...',
        progress: 70,
        phase: 'evaluating',
        details: 'Formatting and optimizing response for display',
        estimatedTimeRemaining: 2000,
        skeletonContent: [
          '📝 Formatting response...',
          '✨ Adding interactive elements...',
          '🎨 Optimizing for display...'
        ]
      });
      
      await new Promise(resolve => setTimeout(resolve, 400));
      
      // Phase 5: Streaming Setup (90-100%)
      updateStatus({
        message: 'Ready to stream response!',
        progress: 90,
        phase: 'completing',
        details: 'Initializing progressive display',
        estimatedTimeRemaining: 1000
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Clear status and start streaming
      clearStatus();
      
      // Create streaming message
      const messageId = generateMessageId();
      const streamingMessage: StreamingMessage = {
        id: messageId,
        text: '',
        isUser: false,
        timestamp: new Date(),
        isStreaming: true,
        isComplete: false,
        streamingProgress: 0,
        loadingType: queryType
      };
      
      // Add initial streaming message
      setMessages(prev => [...prev, streamingMessage]);
      
      // Start streaming the response
      streamingService.startStreaming(
        messageId,
        aiResponse.message,
        {
          typingSpeed: queryType === 'trade_analysis' ? 40 : 50, // Slower for complex analysis
          enableTradeProposalStreaming: true,
          enableSuggestionStreaming: true
        },
        {
          onUpdate: (updatedMessage) => {
            setMessages(prev => prev.map(msg => 
              msg.id === messageId ? {
                ...msg,
                text: updatedMessage.currentText,
                streamingProgress: (updatedMessage.chunks.findIndex(chunk => 
                  updatedMessage.currentText.includes(chunk.content)
                ) / updatedMessage.chunks.length) * 100,
                tradeProposal: updatedMessage.tradeProposal ? {
                  type: 'multi-party' as const,
                  steps: [],
                  confidence: updatedMessage.tradeProposal.efficiency,
                  tradeData: updatedMessage.tradeProposal as any
                } : undefined
              } : msg
            ));
          },
          onComplete: (completedMessage) => {
            // Enhance with full context from AI response
            const enhancedSuggestions = SmartSuggestionEngine.getInstance().generateSuggestions({
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
            
            setMessages(prev => prev.map(msg => 
              msg.id === messageId ? {
                ...msg,
                text: completedMessage.currentText,
                isStreaming: false,
                isComplete: true,
                streamingProgress: 100,
                suggestions: (aiResponse.suggestions && aiResponse.suggestions.length > 0) ? 
                           aiResponse.suggestions : enhancedSuggestions
              } : msg
            ));
            
            // Update conversation history
            setConversationHistory(prev => [
              ...prev,
              { role: 'assistant', content: completedMessage.currentText }
            ]);
          }
        }
      );
      
    } catch (error) {
      console.error('Error in streaming response generation:', error);
      clearStatus();
      
      // Add error message with streaming effect
      const errorMessageId = generateMessageId();
      const errorMessage: StreamingMessage = {
        id: errorMessageId,
        text: '',
        isUser: false,
        timestamp: new Date(),
        isStreaming: true,
        isComplete: false,
        streamingProgress: 0
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      // Stream error message
      streamingService.startStreaming(
        errorMessageId,
        "I encountered an issue while processing your request. Please try again or check your connection.",
        { typingSpeed: 60 },
        {
          onUpdate: (updatedMessage) => {
            setMessages(prev => prev.map(msg => 
              msg.id === errorMessageId ? {
                ...msg,
                text: updatedMessage.currentText,
                streamingProgress: 50
              } : msg
            ));
          },
          onComplete: (completedMessage) => {
            setMessages(prev => prev.map(msg => 
              msg.id === errorMessageId ? {
                ...msg,
                text: completedMessage.currentText,
                isStreaming: false,
                isComplete: true,
                streamingProgress: 100,
                suggestions: [
                  "Try again",
                  "Check connection",
                  "Report issue"
                ]
              } : msg
            ));
          }
        }
      );
    }
  }, [publicKey, userNFTs, conversationHistory, lastShownTrades, currentTradeIndex, updateStatus, clearStatus, generateMessageId, streamingService, detectQueryType]);
  
  // Send message with streaming response
  const sendMessage = useCallback(async (text: string) => {
    // Add user message immediately
    const userMessage: StreamingMessage = {
      id: generateMessageId(),
      text,
      isUser: true,
      timestamp: new Date(),
      isStreaming: false,
      isComplete: true
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);
    
    // Update conversation history
    setConversationHistory(prev => [...prev, { role: 'user', content: text }]);
    
    try {
      await generateStreamingResponse(text);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [generateStreamingResponse, generateMessageId]);
  
  // Stop streaming for a message (user can click to complete immediately)
  const stopStreaming = useCallback((messageId: string) => {
    streamingService.stopStreaming(messageId);
  }, [streamingService]);
  
  // Get streaming status for a message
  const getStreamingStatus = useCallback((messageId: string) => {
    return streamingService.getStreamingStatus(messageId);
  }, [streamingService]);
  
  // Clear chat
  const clearChat = useCallback(() => {
    setMessages([]);
    setUserNFTs([]);
    setLastShownTrades([]);
    setCurrentTradeIndex(0);
    setConversationHistory([]);
    clearStatus();
  }, [clearStatus]);
  
  // Enhanced typing indicator
  const getTypingIndicator = useCallback(() => {
    return streamingService.generateTypingIndicator();
  }, [streamingService]);
  
  return {
    messages,
    sendMessage,
    clearChat,
    isProcessing,
    currentStatus,
    
    // Streaming-specific methods
    stopStreaming,
    getStreamingStatus,
    getTypingIndicator,
    
    // Enhanced loading states
    detectQueryType
  };
}; 