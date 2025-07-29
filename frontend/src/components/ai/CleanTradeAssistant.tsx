'use client';

import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { useWallet } from '@solana/wallet-adapter-react';
import { fadeInAnimation } from '@/styles/animations';
import { useCleanStreamingAssistant } from '@/hooks/useCleanStreamingAssistant';
import CleanStreamingMessage from './CleanStreamingMessage';
import { TradeExecutionModal } from '@/components/trade/TradeExecutionModal';
import { TradeLoop } from '@/types/trade';
import { SmartSuggestionEngine } from '@/services/ai/smart-suggestion.service';

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

const AssistantIcon = styled.div<{ $isProcessing?: boolean }>`
  width: 40px;
  height: 40px;
  background: ${({ theme }) => theme.colors.primary};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: all 0.3s ease;
  
  ${({ $isProcessing }) => $isProcessing && `
    animation: pulse 2s ease-in-out infinite;
  `}
  
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
`;

const HeaderInfo = styled.div`
  flex: 1;
`;

const AssistantName = styled.h3`
  margin: 0;
  color: #FFFFFF;
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &::after {
    content: '⚡';
    font-size: 0.8em;
    opacity: 0.7;
  }
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
  background: transparent;
  
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

const WelcomeContainer = styled.div`
  text-align: center;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const WelcomeMessage = styled.p`
  color: #FFFFFF;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  line-height: 1.5;
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const SuggestedPrompts = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
  justify-content: center;
`;

const PromptChip = styled.button`
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  background: #181a1b;
  border: 1px solid #4A3F7A;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  color: ${({ theme }) => theme.colors.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #282a2b;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(103, 69, 255, 0.3);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const InputContainer = styled.form`
  padding: ${({ theme }) => theme.spacing.lg};
  border-top: 1px solid rgba(40, 40, 56, 0.3);
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  background: transparent;
`;

const ChatInput = styled.input`
  flex: 1;
  padding: ${({ theme }) => theme.spacing.md};
  background: linear-gradient(135deg, #242627, #2a2d2e);
  border: 1px solid #6745FF40;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: #FFFFFF;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 2px rgba(103, 69, 255, 0.1);
  }
  
  &::placeholder {
    color: #717186;
  }
`;

const SendButton = styled.button`
  padding: ${({ theme }) => `${theme.spacing.md} ${theme.spacing.lg}`};
  background: linear-gradient(135deg, #6745FF, #8B5FFF);
  color: white;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  
  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #5634CC, #7A4FDD);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(103, 69, 255, 0.4);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  
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
`;

/**
 * Clean Trade Assistant Component
 * 
 * Features:
 * - Character-by-character streaming responses
 * - Minimal UI with no intrusive loading states
 * - Clean layout that doesn't cause overflow
 * - Smart suggestions and trade analysis
 * - All the intelligence of the original assistant
 */
const CleanTradeAssistant: React.FC = () => {
  const { publicKey } = useWallet();
  const [input, setInput] = useState('');
  const [selectedTrade, setSelectedTrade] = useState<TradeLoop | null>(null);
  const [showTradeDetails, setShowTradeDetails] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  
  const {
    messages,
    sendMessage,
    clearChat,
    status,
    stopStreaming,
    isStreaming,
    getTypingIndicator
  } = useCleanStreamingAssistant();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !status.isProcessing) {
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
    
    const context = {
      isWalletConnected: !!publicKey,
      userNFTs: [],
      messageCount: messages.length,
      conversationHistory: messages.map(msg => ({
        role: msg.isUser ? 'user' as const : 'assistant' as const,
        content: msg.text
      })),
      lastShownTrades: [],
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
          <WelcomeMessage>Connect your wallet to start using the AI Trade Assistant</WelcomeMessage>
        </ChatContainer>
      </Container>
    );
  }

  return (
    <>
      <Container>
        <Header>
          <AssistantIcon $isProcessing={status.isProcessing}>
            🤖
          </AssistantIcon>
          <HeaderInfo>
            <AssistantName>
              SWAPS AI Assistant
            </AssistantName>
            <StatusText>
              Ready to help you find the perfect trade
            </StatusText>
          </HeaderInfo>
        </Header>

        <ChatContainer ref={chatRef}>
          {messages.length === 0 && (
            <WelcomeContainer>
              <WelcomeMessage>
                👋 Hi! I'm your AI swaps assistant. I can help you get the NFTs you want.
                <br />
                <span style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: '0.5rem', display: 'block' }}>
                  ⚡ Enhanced with real-time streaming responses
                </span>
              </WelcomeMessage>
              <SuggestedPrompts>
                {suggestedPrompts.map((prompt, index) => (
                  <PromptChip 
                    key={index} 
                    onClick={() => handlePromptClick(prompt)}
                  >
                    {prompt}
                  </PromptChip>
                ))}
              </SuggestedPrompts>
            </WelcomeContainer>
          )}

          {messages.map((message, index) => (
            <CleanStreamingMessage
              key={message.id}
              id={message.id}
              text={message.text}
              isUser={message.isUser}
              timestamp={message.timestamp}
              isStreaming={message.isStreaming}
              tradeProposal={message.tradeProposal}
              suggestions={message.suggestions}
              onSuggestionClick={handlePromptClick}
              onStopStreaming={stopStreaming}
              onShowTradeDetails={handleShowTradeDetails}
            />
          ))}
        </ChatContainer>

        <InputContainer onSubmit={handleSubmit}>
          <ChatInput
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything and watch the magic happen in real-time..."
            disabled={status.isProcessing}
          />
          <SendButton 
            type="submit" 
            disabled={status.isProcessing || !input.trim()}
          >
            {status.isProcessing ? getTypingIndicator() : 'Send'}
          </SendButton>
        </InputContainer>
      </Container>

      {showTradeDetails && selectedTrade && publicKey && (
        <TradeExecutionModal
          trade={selectedTrade}
          userWallet={publicKey.toString()}
          onClose={() => setShowTradeDetails(false)}
          onExecute={() => {
            console.log('Trade executed');
            setShowTradeDetails(false);
          }}
        />
      )}
    </>
  );
};

export default CleanTradeAssistant; 