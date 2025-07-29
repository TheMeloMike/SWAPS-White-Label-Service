'use client';

import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { useWallet } from '@solana/wallet-adapter-react';
import { fadeInAnimation, slideIn } from '@/styles/animations';
import { useTradeAssistant } from '@/hooks/useTradeAssistant';
import { useStreamingTradeAssistant } from '@/hooks/useStreamingTradeAssistant';
import SkeletonLoader from '@/components/shared/SkeletonLoader';
import MarkdownMessage from './MarkdownMessage';
import StreamingMessage from './StreamingMessage';
import { TradePathDisplay } from './TradePathDisplay';
import { TradeProposalCard } from './TradeProposalCard';
import { TradeExecutionModal } from '@/components/trade/TradeExecutionModal';
import { TradeLoop } from '@/types/trade';
import { SmartSuggestionEngine } from '@/services/ai/smart-suggestion.service';

interface EnhancedTradeAssistantProps {
  enableStreaming?: boolean;
  streamingSpeed?: 'slow' | 'normal' | 'fast';
  enableEnhancedLoading?: boolean;
  onTradeExecuted?: (trade: TradeLoop) => void;
  onTradeAnalyzed?: (trade: TradeLoop) => void;
}

const Container = styled.div`
  height: 600px;
  display: flex;
  flex-direction: column;
  background: #1e2021;
  border: 1px solid rgba(40, 40, 56, 0.5);
  border-radius: 16px;
  overflow: hidden;
  ${fadeInAnimation}
  position: relative;
  isolation: isolate;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: #1e2021;
    z-index: -1;
    border-radius: inherit;
  }
`;

const Header = styled.div`
  padding: ${({ theme }) => theme.spacing.lg};
  background: transparent;
  border-bottom: 1px solid rgba(40, 40, 56, 0.3);
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const AssistantIcon = styled.div<{ $isStreaming?: boolean }>`
  width: 40px;
  height: 40px;
  background: ${({ theme }) => theme.colors.primary};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: all 0.3s ease;
  position: relative;
  
  ${({ $isStreaming }) => $isStreaming && `
    &::after {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: 50%;
      background: linear-gradient(45deg, #6745FF, #8B5FFF, #6745FF);
      background-size: 200% 200%;
      animation: pulse 2s ease-in-out infinite;
      z-index: -1;
    }
  `}
`;

const HeaderInfo = styled.div`
  flex: 1;
`;

const AssistantName = styled.h3<{ $hasStreaming?: boolean }>`
  margin: 0;
  color: #FFFFFF;
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  
  ${({ $hasStreaming }) => $hasStreaming && `
    display: flex;
    align-items: center;
    gap: 0.5rem;
    
    &::after {
      content: '⚡';
      font-size: 0.8em;
      opacity: 0.7;
    }
  `}
`;

const StatusText = styled.p<{ $phase?: string }>`
  margin: 0;
  color: ${({ $phase }) => {
    switch ($phase) {
      case 'analyzing': return '#6745FF';
      case 'searching': return '#FF6B6B';
      case 'processing': return '#4ECDC4';
      case 'evaluating': return '#FFD93D';
      case 'completing': return '#6BCF7F';
      default: return '#A0A0B0';
    }
  }};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  transition: color 0.3s ease;
`;

const ChatContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  background: transparent;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(40, 40, 56, 0.2);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(123, 97, 255, 0.5);
    border-radius: 3px;
    
    &:hover {
      background: rgba(123, 97, 255, 0.7);
    }
  }
`;

const StatusContainer = styled.div<{ $enhanced?: boolean }>`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  background: ${({ $enhanced }) => $enhanced ? 
    'linear-gradient(90deg, rgba(103, 69, 255, 0.1), rgba(139, 95, 255, 0.1))' : 
    'rgba(40, 40, 56, 0.3)'
  };
  border-bottom: 1px solid rgba(40, 40, 56, 0.3);
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  transition: all 0.3s ease;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 4px;
  background: rgba(40, 40, 56, 0.5);
  border-radius: 2px;
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $progress: number; $phase: string; $enhanced?: boolean }>`
  height: 100%;
  width: ${({ $progress }) => $progress}%;
  background: ${({ $phase, $enhanced }) => {
    const baseGradients = {
      analyzing: 'linear-gradient(90deg, #6745FF, #8B5FFF)',
      searching: 'linear-gradient(90deg, #FF6B6B, #FF8E53)',
      processing: 'linear-gradient(90deg, #4ECDC4, #44A08D)',
      evaluating: 'linear-gradient(90deg, #FFD93D, #FF6B6B)',
      completing: 'linear-gradient(90deg, #6BCF7F, #4D9A6A)',
    };
    
    if ($enhanced) {
      return `${baseGradients[$phase as keyof typeof baseGradients] || '#6745FF'}, rgba(255, 255, 255, 0.2)`;
    }
    
    return baseGradients[$phase as keyof typeof baseGradients] || '#6745FF';
  }};
  transition: all 0.3s ease;
  border-radius: 2px;
  position: relative;
  
  ${({ $enhanced }) => $enhanced && `
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
      animation: shimmer 2s ease-in-out infinite;
    }
  `}
`;

const StatusDetails = styled.div<{ $enhanced?: boolean }>`
  font-size: 0.75rem;
  color: ${({ $enhanced }) => $enhanced ? '#C0C0D0' : '#A0A0B0'};
  font-style: italic;
  transition: color 0.3s ease;
`;

const SkeletonContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.sm};
`;

const SkeletonRow = styled.div<{ $delay?: number }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  animation: fadeIn 0.5s ease-out ${({ $delay }) => ($delay || 0) * 0.1}s both;
`;

const SkeletonIcon = styled.div`
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1));
  background-size: 200px 100%;
  animation: shimmer 1.5s ease-in-out infinite;
`;

const SkeletonText = styled.div<{ $width?: string }>`
  height: 16px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1));
  background-size: 200px 100%;
  border-radius: 4px;
  width: ${({ $width }) => $width || '100%'};
  animation: shimmer 1.5s ease-in-out infinite;
`;

const Message = styled.div<{ $isUser: boolean }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: flex-start;
  animation: ${slideIn} 0.3s ease-out;
  flex-direction: ${({ $isUser }) => $isUser ? 'row-reverse' : 'row'};
`;

const MessageAvatar = styled.div<{ $isUser: boolean }>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${({ $isUser, theme }) => $isUser ? theme.colors.secondary : theme.colors.primary};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
`;

const MessageContent = styled.div<{ $isUser: boolean }>`
  max-width: 70%;
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ $isUser }) => $isUser ? '#2A2653' : '#242627'};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ $isUser }) => $isUser ? '#4A3F7A' : 'rgba(40, 40, 56, 0.3)'};
`;

const MessageText = styled.p`
  margin: 0;
  color: #FFFFFF;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  line-height: 1.5;
`;

const SuggestedPrompts = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const PromptChip = styled.button<{ $enhanced?: boolean }>`
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  background: ${({ $enhanced }) => $enhanced ? 
    'linear-gradient(135deg, #181a1b, #242627)' : '#181a1b'
  };
  border: 1px solid ${({ $enhanced }) => $enhanced ? '#6745FF' : '#4A3F7A'};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  color: ${({ theme }) => theme.colors.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  
  &:hover {
    background: ${({ $enhanced }) => $enhanced ? 
      'linear-gradient(135deg, #242627, #2a2d2e)' : '#282a2b'
    };
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(103, 69, 255, 0.3);
  }
  
  ${({ $enhanced }) => $enhanced && `
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(103, 69, 255, 0.2), transparent);
      transition: left 0.3s ease;
    }
    
    &:hover::before {
      left: 100%;
    }
  `}
`;

const InputContainer = styled.form`
  padding: ${({ theme }) => theme.spacing.lg};
  border-top: 1px solid rgba(40, 40, 56, 0.3);
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  background: transparent;
`;

const ChatInput = styled.input<{ $enhanced?: boolean }>`
  flex: 1;
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ $enhanced }) => $enhanced ? 
    'linear-gradient(135deg, #242627, #2a2d2e)' : '#242627'
  };
  border: 1px solid ${({ $enhanced }) => $enhanced ? '#6745FF40' : '#282838'};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: #FFFFFF;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: ${({ $enhanced }) => $enhanced ? 
      '0 0 0 2px rgba(103, 69, 255, 0.1)' : 'none'
    };
  }
  
  &::placeholder {
    color: #717186;
  }
`;

const SendButton = styled.button<{ $enhanced?: boolean }>`
  padding: ${({ theme }) => `${theme.spacing.md} ${theme.spacing.lg}`};
  background: ${({ theme, $enhanced }) => $enhanced ? 
    'linear-gradient(135deg, #6745FF, #8B5FFF)' : theme.colors.primary
  };
  color: white;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  
  &:hover {
    background: ${({ theme, $enhanced }) => $enhanced ? 
      'linear-gradient(135deg, #5634CC, #7A4FDD)' : theme.colors.primaryDark
    };
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(103, 69, 255, 0.4);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  
  ${({ $enhanced }) => $enhanced && `
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: left 0.3s ease;
    }
    
    &:hover:not(:disabled)::before {
      left: 100%;
    }
  `}
`;

/**
 * Enhanced Trade Assistant with Optional Streaming
 * 
 * Features:
 * - Progressive AI response streaming
 * - Enhanced loading states and animations
 * - Smart context-aware suggestions
 * - Backward compatibility with existing trade assistant
 * - Configurable streaming speed and enhancement levels
 * - Real-time status updates with visual feedback
 */
const EnhancedTradeAssistant: React.FC<EnhancedTradeAssistantProps> = ({
  enableStreaming = false,
  streamingSpeed = 'normal',
  enableEnhancedLoading = true,
  onTradeExecuted,
  onTradeAnalyzed
}) => {
  const { publicKey } = useWallet();
  const [input, setInput] = useState('');
  const [selectedTrade, setSelectedTrade] = useState<TradeLoop | null>(null);
  const [showTradeDetails, setShowTradeDetails] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const [previousMessageCount, setPreviousMessageCount] = useState(0);
  
  // Conditionally use streaming or regular trade assistant
  const regularAssistant = useTradeAssistant();
  const streamingAssistant = useStreamingTradeAssistant();
  
  const {
    messages,
    sendMessage,
    isProcessing,
    currentStatus,
    stopStreaming,
    getStreamingStatus,
    getTypingIndicator
  } = enableStreaming ? {
    ...streamingAssistant,
    stopStreaming: streamingAssistant.stopStreaming,
    getStreamingStatus: streamingAssistant.getStreamingStatus,
    getTypingIndicator: streamingAssistant.getTypingIndicator
  } : {
    ...regularAssistant,
    stopStreaming: undefined,
    getStreamingStatus: undefined,
    getTypingIndicator: undefined
  };

  // Enhanced auto-scroll logic
  useEffect(() => {
    if (chatRef.current) {
      const container = chatRef.current;
      const isNewMessage = messages.length > previousMessageCount;
      const lastMessage = messages[messages.length - 1];
      
      if (isNewMessage && lastMessage) {
        if (lastMessage.isUser) {
          container.scrollTop = container.scrollHeight;
        } else {
          const messageElements = container.querySelectorAll('[data-message-index]');
          const lastMessageElement = messageElements[messageElements.length - 1];
          
          if (lastMessageElement) {
            lastMessageElement.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
              inline: 'nearest'
            });
          }
        }
      }
      
      setPreviousMessageCount(messages.length);
    }
  }, [messages, previousMessageCount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      sendMessage(input);
      setInput('');
    }
  };

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
  };

  const handleShowTradeDetails = (trade: TradeLoop) => {
    setSelectedTrade(trade);
    setShowTradeDetails(true);
    onTradeAnalyzed?.(trade);
  };

  const handleTradeExecuted = (trade: TradeLoop) => {
    onTradeExecuted?.(trade);
  };

  const handleStopStreaming = (messageId: string) => {
    if (stopStreaming) {
      stopStreaming(messageId);
    }
  };

  // Generate enhanced skeleton content based on status
  const getEnhancedSkeletonContent = () => {
    if (!currentStatus || !enableEnhancedLoading) return null;
    
    const phaseContent = {
      analyzing: [
        { icon: '🔍', text: 'Parsing your request...', width: '85%' },
        { icon: '🧠', text: 'Understanding context...', width: '75%' },
        { icon: '🎯', text: 'Identifying intent...', width: '90%' }
      ],
      searching: [
        { icon: '🌐', text: 'Scanning SWAPS network...', width: '80%' },
        { icon: '🔄', text: 'Finding trade paths...', width: '85%' },
        { icon: '📊', text: 'Analyzing opportunities...', width: '75%' }
      ],
      processing: [
        { icon: '🤖', text: 'AI processing request...', width: '90%' },
        { icon: '💭', text: 'Generating insights...', width: '70%' },
        { icon: '✨', text: 'Optimizing response...', width: '85%' }
      ],
      evaluating: [
        { icon: '⚖️', text: 'Evaluating trade fairness...', width: '80%' },
        { icon: '📈', text: 'Calculating efficiency...', width: '75%' },
        { icon: '🎯', text: 'Ranking opportunities...', width: '85%' }
      ],
      completing: [
        { icon: '📝', text: 'Finalizing response...', width: '90%' },
        { icon: '🎨', text: 'Formatting display...', width: '70%' },
        { icon: '✅', text: 'Ready to present...', width: '95%' }
      ]
    };
    
    return phaseContent[currentStatus.phase] || phaseContent.processing;
  };

  // Dynamic suggestions based on context
  const suggestedPrompts = React.useMemo(() => {
    const suggestionEngine = SmartSuggestionEngine.getInstance();
    
    const context = {
      isWalletConnected: !!publicKey,
      userNFTs: [],
      messageCount: messages.length,
      conversationHistory: messages.map(msg => ({
        role: msg.isUser ? 'user' as const : 'assistant' as const,
        content: msg.text
      })),
      lastShownTrades: messages
        .filter(msg => msg.tradeProposal?.tradeData)
        .map(msg => ({
          efficiency: msg.tradeProposal!.tradeData!.efficiency,
          totalParticipants: msg.tradeProposal!.tradeData!.totalParticipants,
          steps: msg.tradeProposal!.tradeData!.steps.map(step => ({
            from: step.from,
            to: step.to,
            nfts: step.nfts.map(nft => ({
              name: nft.name,
              collection: typeof nft.collection === 'string' ? nft.collection : 
                          nft.collection?.name || undefined,
              address: nft.address
            }))
          }))
        })),
      hasRecentMarketData: true,
    };
    
    const smartSuggestions = suggestionEngine.generateSuggestions(context);
    
    if (smartSuggestions.length === 0) {
      return [
        "Find me the best available trades.",
        "Are there any trade loops to get me a Mad Lad?",
        "Show me if there are trades using my NFTs.",
        "Tell me about how SWAPS works."
      ];
    }
    
    return smartSuggestions;
  }, [publicKey, messages]);

  if (!publicKey) {
    return (
      <Container>
        <ChatContainer style={{ justifyContent: 'center', alignItems: 'center' }}>
          <MessageText>Connect your wallet to start using the AI Trade Assistant</MessageText>
        </ChatContainer>
      </Container>
    );
  }

  return (
    <>
      <Container>
        <Header>
          <AssistantIcon $isStreaming={enableStreaming && isProcessing}>
            🤖
          </AssistantIcon>
          <HeaderInfo>
            <AssistantName $hasStreaming={enableStreaming}>
              SWAPS AI Assistant
            </AssistantName>
            <StatusText $phase={currentStatus?.phase}>
              {currentStatus ? currentStatus.message : 
               isProcessing ? (enableStreaming ? 
                 `${getTypingIndicator?.()} Processing...` : 'Processing your request...') : 
               'Ready to help you find the perfect trade'}
            </StatusText>
          </HeaderInfo>
        </Header>

        {currentStatus && (
          <StatusContainer $enhanced={enableEnhancedLoading}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <StatusText style={{ margin: 0, fontSize: '0.85rem' }} $phase={currentStatus.phase}>
                {currentStatus.message}
              </StatusText>
              <span style={{ fontSize: '0.75rem', color: '#A0A0B0' }}>
                {currentStatus.progress}%
              </span>
              {(currentStatus as any).estimatedTimeRemaining && (
                <span style={{ fontSize: '0.7rem', color: '#717186' }}>
                  ~{Math.round((currentStatus as any).estimatedTimeRemaining / 1000)}s
                </span>
              )}
            </div>
            <ProgressBar>
              <ProgressFill 
                $progress={currentStatus.progress} 
                $phase={currentStatus.phase}
                $enhanced={enableEnhancedLoading}
              />
            </ProgressBar>
            {currentStatus.details && (
              <StatusDetails $enhanced={enableEnhancedLoading}>
                {currentStatus.details}
              </StatusDetails>
            )}
            
            {enableEnhancedLoading && getEnhancedSkeletonContent() && (
              <SkeletonContainer>
                {getEnhancedSkeletonContent()!.map((item, index) => (
                  <SkeletonRow key={index} $delay={index}>
                    <SkeletonIcon />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.75rem', color: '#C0C0D0', marginBottom: '4px' }}>
                        {item.text}
                      </div>
                      <SkeletonText $width={item.width} />
                    </div>
                  </SkeletonRow>
                ))}
              </SkeletonContainer>
            )}
          </StatusContainer>
        )}

        <ChatContainer ref={chatRef}>
          {messages.length === 0 && (
            <div>
              <MessageText style={{ textAlign: 'center', marginBottom: '1rem' }}>
                👋 Hi! I'm your AI swaps assistant. I can help you get the NFTs you want.
                {enableStreaming && (
                  <span style={{ display: 'block', fontSize: '0.8rem', marginTop: '0.5rem', color: '#A0A0B0' }}>
                    ⚡ Enhanced with real-time streaming responses
                  </span>
                )}
              </MessageText>
              <SuggestedPrompts>
                {suggestedPrompts.map((prompt, index) => (
                  <PromptChip 
                    key={index} 
                    onClick={() => handlePromptClick(prompt)}
                    $enhanced={enableEnhancedLoading}
                  >
                    {prompt}
                  </PromptChip>
                ))}
              </SuggestedPrompts>
            </div>
          )}

          {messages.map((message, index) => (
            enableStreaming ? (
              <StreamingMessage
                key={index}
                id={(message as any).id || `msg-${index}`}
                text={message.text}
                isUser={message.isUser}
                timestamp={message.timestamp}
                isStreaming={(message as any).isStreaming}
                isComplete={(message as any).isComplete}
                streamingProgress={(message as any).streamingProgress}
                tradeProposal={message.tradeProposal}
                suggestions={message.suggestions}
                loadingType={(message as any).loadingType}
                onSuggestionClick={handlePromptClick}
                onStopStreaming={handleStopStreaming}
                onShowTradeDetails={handleShowTradeDetails}
              />
            ) : (
              <Message key={index} $isUser={message.isUser} data-message-index={index}>
                <MessageAvatar $isUser={message.isUser}>
                  {message.isUser ? '👤' : '🤖'}
                </MessageAvatar>
                <MessageContent $isUser={message.isUser}>
                  {message.isUser ? (
                    <MessageText>{message.text}</MessageText>
                  ) : (
                    <MarkdownMessage content={message.text} />
                  )}
                  
                  {message.tradeProposal?.tradeData && (
                    <TradeProposalCard 
                      trade={message.tradeProposal.tradeData}
                      onExecute={() => handleTradeExecuted(message.tradeProposal!.tradeData!)}
                      onShowMore={() => {
                        if (message.tradeProposal?.tradeData) {
                          handleShowTradeDetails(message.tradeProposal.tradeData);
                        }
                      }}
                    />
                  )}
                  
                  {message.suggestions && message.suggestions.length > 0 && (
                    <SuggestedPrompts style={{ marginTop: '1rem' }}>
                      {message.suggestions.map((suggestion, idx) => (
                        <PromptChip 
                          key={idx} 
                          onClick={() => handlePromptClick(suggestion)}
                          $enhanced={enableEnhancedLoading}
                        >
                          {suggestion}
                        </PromptChip>
                      ))}
                    </SuggestedPrompts>
                  )}
                </MessageContent>
              </Message>
            )
          ))}

          {isProcessing && !enableStreaming && (
            <Message $isUser={false} data-message-index="processing">
              <MessageAvatar $isUser={false}>🤖</MessageAvatar>
              <MessageContent $isUser={false}>
                <SkeletonLoader type="text" rows={2} />
              </MessageContent>
            </Message>
          )}
        </ChatContainer>

        <InputContainer onSubmit={handleSubmit}>
          <ChatInput
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={enableStreaming ? 
              "Ask me anything and watch the magic happen in real-time..." :
              "Ask me about trade paths, NFT recommendations, or learn about SWAPS..."
            }
            disabled={isProcessing}
            $enhanced={enableEnhancedLoading}
          />
          <SendButton 
            type="submit" 
            disabled={isProcessing || !input.trim()}
            $enhanced={enableEnhancedLoading}
          >
            {enableStreaming && isProcessing ? getTypingIndicator?.() || 'Send' : 'Send'}
          </SendButton>
        </InputContainer>
      </Container>

      {showTradeDetails && selectedTrade && publicKey && (
        <TradeExecutionModal
          trade={selectedTrade}
          userWallet={publicKey.toString()}
          onClose={() => setShowTradeDetails(false)}
          onExecute={() => {
            handleTradeExecuted(selectedTrade);
            setShowTradeDetails(false);
          }}
        />
      )}
    </>
  );
};

export default EnhancedTradeAssistant; 