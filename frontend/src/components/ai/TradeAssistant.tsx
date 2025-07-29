'use client';

import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { useWallet } from '@solana/wallet-adapter-react';
import { fadeInAnimation, slideIn } from '@/styles/animations';
import { useTradeAssistant } from '@/hooks/useTradeAssistant';
import SkeletonLoader from '@/components/shared/SkeletonLoader';
import MarkdownMessage from './MarkdownMessage';
import { TradePathDisplay } from './TradePathDisplay';
import { TradeProposalCard } from './TradeProposalCard';
import { TradeExecutionModal } from '@/components/trade/TradeExecutionModal';
import { TradeLoop } from '@/types/trade';
import { SmartSuggestionEngine } from '@/services/ai/smart-suggestion.service';

const Container = styled.div`
  height: 600px;
  display: flex;
  flex-direction: column;
  background: #1e2021; /* Slightly elevated background */
  border: 1px solid rgba(40, 40, 56, 0.5);
  border-radius: 16px; /* Nice rounded corners */
  overflow: hidden;
  ${fadeInAnimation}
  position: relative;
  isolation: isolate;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3); /* Subtle shadow for depth */
  
  /* Ensure the background blocks any transparency */
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
  background: transparent; /* Remove separate background */
  border-bottom: 1px solid rgba(40, 40, 56, 0.3); /* Subtle border */
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const AssistantIcon = styled.div`
  width: 40px;
  height: 40px;
  background: ${({ theme }) => theme.colors.primary};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
`;

const HeaderInfo = styled.div`
  flex: 1;
`;

const AssistantName = styled.h3`
  margin: 0;
  color: #FFFFFF;
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
`;

const StatusText = styled.p`
  margin: 0;
  color: #A0A0B0;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const ChatContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  background: transparent; /* Remove separate background */
  
  /* Custom scrollbar */
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
  background: ${({ $isUser }) => $isUser ? '#2A2653' : '#242627'}; /* User messages purple, AI messages darker */
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ $isUser }) => $isUser ? '#4A3F7A' : 'rgba(40, 40, 56, 0.3)'};
`;

const MessageText = styled.p`
  margin: 0;
  color: #FFFFFF;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  line-height: 1.5;
`;

const TradeProposal = styled.div`
  margin-top: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md};
  background: #2A2653; /* Solid purple tint */
  border: 1px solid #4A3F7A;
  border-radius: ${({ theme }) => theme.borderRadius.md};
`;

const ProposalTitle = styled.h4`
  margin: 0 0 ${({ theme }) => theme.spacing.sm} 0;
  color: ${({ theme }) => theme.colors.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const TradeStep = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.xs} 0;
  color: #A0A0B0;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
`;

const InputContainer = styled.form`
  padding: ${({ theme }) => theme.spacing.lg};
  border-top: 1px solid rgba(40, 40, 56, 0.3); /* Subtle border matching header */
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  background: transparent; /* Transparent to blend with container */
`;

const ChatInput = styled.input`
  flex: 1;
  padding: ${({ theme }) => theme.spacing.md};
  background: #242627; /* Input field slightly lighter */
  border: 1px solid #282838;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: #FFFFFF;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
  
  &::placeholder {
    color: #717186;
  }
`;

const SendButton = styled.button`
  padding: ${({ theme }) => `${theme.spacing.md} ${theme.spacing.lg}`};
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${({ theme }) => theme.colors.primaryDark};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SuggestedPrompts = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const PromptChip = styled.button`
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  background: #181a1b; /* Solid purple tint */
  border: 1px solid #4A3F7A;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  color: ${({ theme }) => theme.colors.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #181a1b; /* Slightly lighter solid color */
  }
`;

const StatusContainer = styled.div`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  background: rgba(40, 40, 56, 0.3);
  border-bottom: 1px solid rgba(40, 40, 56, 0.3);
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 4px;
  background: rgba(40, 40, 56, 0.5);
  border-radius: 2px;
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $progress: number; $phase: string }>`
  height: 100%;
  width: ${({ $progress }) => $progress}%;
  background: ${({ $phase }) => {
    switch ($phase) {
      case 'analyzing': return 'linear-gradient(90deg, #6745FF, #8B5FFF)';
      case 'searching': return 'linear-gradient(90deg, #FF6B6B, #FF8E53)';
      case 'processing': return 'linear-gradient(90deg, #4ECDC4, #44A08D)';
      case 'evaluating': return 'linear-gradient(90deg, #FFD93D, #FF6B6B)';
      case 'completing': return 'linear-gradient(90deg, #6BCF7F, #4D9A6A)';
      default: return '#6745FF';
    }
  }};
  transition: all 0.3s ease;
  border-radius: 2px;
`;

const StatusDetails = styled.div`
  font-size: 0.75rem;
  color: #A0A0B0;
  font-style: italic;
`;

const TradeAssistant: React.FC = () => {
  const { publicKey } = useWallet();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<TradeLoop | null>(null);
  const [showTradeDetails, setShowTradeDetails] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const [previousMessageCount, setPreviousMessageCount] = useState(0);
  const { messages, sendMessage, isProcessing, currentStatus } = useTradeAssistant();

  useEffect(() => {
    if (chatRef.current) {
      const container = chatRef.current;
      const isNewMessage = messages.length > previousMessageCount;
      const lastMessage = messages[messages.length - 1];
      
      if (isNewMessage && lastMessage) {
        if (lastMessage.isUser) {
          // For user messages, scroll to bottom to show the message was sent
          container.scrollTop = container.scrollHeight;
        } else {
          // For AI messages, scroll to show the start of the new message
          // Find the last AI message element and scroll to its top
          const messageElements = container.querySelectorAll('[data-message-index]');
          const lastMessageElement = messageElements[messageElements.length - 1];
          
          if (lastMessageElement) {
            // Scroll to show the top of the new AI message
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
  };

  // Generate dynamic suggestions based on current context
  const suggestedPrompts = React.useMemo(() => {
    const suggestionEngine = SmartSuggestionEngine.getInstance();
    
    // Build context from current state
    const context = {
      isWalletConnected: !!publicKey,
      userNFTs: [], // TODO: Get from wallet/state when available
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
    
    // Fallback to static suggestions if no smart suggestions generated
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
          <AssistantIcon>🤖</AssistantIcon>
          <HeaderInfo>
            <AssistantName>SWAPS AI Assistant</AssistantName>
            <StatusText>
              {currentStatus ? currentStatus.message : 
               isProcessing ? 'Processing your request...' : 
               'Ready to help you find the perfect trade'}
            </StatusText>
          </HeaderInfo>
        </Header>

        {currentStatus && (
          <StatusContainer>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <StatusText style={{ margin: 0, fontSize: '0.85rem' }}>
                {currentStatus.message}
              </StatusText>
              <span style={{ fontSize: '0.75rem', color: '#A0A0B0' }}>
                {currentStatus.progress}%
              </span>
            </div>
            <ProgressBar>
              <ProgressFill $progress={currentStatus.progress} $phase={currentStatus.phase} />
            </ProgressBar>
            {currentStatus.details && (
              <StatusDetails>{currentStatus.details}</StatusDetails>
            )}
          </StatusContainer>
        )}

        <ChatContainer ref={chatRef}>
          {messages.length === 0 && (
            <div>
              <MessageText style={{ textAlign: 'center', marginBottom: '1rem' }}>
                👋 Hi! I'm your AI swaps assistant. I can help you get the NFTs you want.
              </MessageText>
              <SuggestedPrompts>
                {suggestedPrompts.map((prompt, index) => (
                  <PromptChip key={index} onClick={() => handlePromptClick(prompt)}>
                    {prompt}
                  </PromptChip>
                ))}
              </SuggestedPrompts>
            </div>
          )}

          {messages.map((message, index) => (
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
                    onExecute={() => {
                      // Handle successful execution
                      console.log('Trade executed successfully');
                    }}
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
                      <PromptChip key={idx} onClick={() => handlePromptClick(suggestion)}>
                        {suggestion}
                      </PromptChip>
                    ))}
                  </SuggestedPrompts>
                )}
              </MessageContent>
            </Message>
          ))}

          {isProcessing && (
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
            placeholder="Ask me about trade paths, NFT recommendations, or learn about SWAPS..."
            disabled={isProcessing}
          />
          <SendButton type="submit" disabled={isProcessing || !input.trim()}>
            Send
          </SendButton>
        </InputContainer>
      </Container>

      {showTradeDetails && selectedTrade && publicKey && (
        <TradeExecutionModal
          trade={selectedTrade}
          userWallet={publicKey.toString()}
          onClose={() => setShowTradeDetails(false)}
          onExecute={() => {
            console.log('Trade executed successfully');
            setShowTradeDetails(false);
          }}
        />
      )}
    </>
  );
};

export default TradeAssistant; 