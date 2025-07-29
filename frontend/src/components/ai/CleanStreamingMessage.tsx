'use client';

import React from 'react';
import styled from 'styled-components';
import MarkdownMessage from './MarkdownMessage';
import { TradeProposalCard } from './TradeProposalCard';
import { slideIn } from '@/styles/animations';

interface CleanStreamingMessageProps {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isStreaming?: boolean;
  tradeProposal?: any;
  suggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
  onStopStreaming?: (messageId: string) => void;
  onShowTradeDetails?: (trade: any) => void;
}

// Clean, minimal styled components
const MessageContainer = styled.div<{ $isUser: boolean }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: flex-start;
  animation: ${slideIn} 0.3s ease-out;
  flex-direction: ${({ $isUser }) => $isUser ? 'row-reverse' : 'row'};
  max-width: 100%;
  margin-bottom: ${({ theme }) => theme.spacing.md};
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
  transition: all 0.2s ease;
  
  &:hover {
    transform: scale(1.05);
  }
`;

const MessageContent = styled.div<{ $isUser: boolean; $isStreaming?: boolean; $isThinking?: boolean }>`
  max-width: 70%;
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ $isUser, $isThinking }) => 
    $isThinking ? 'rgba(103, 69, 255, 0.1)' : 
    $isUser ? '#2A2653' : '#242627'};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ $isUser, $isThinking }) => 
    $isThinking ? 'rgba(103, 69, 255, 0.3)' :
    $isUser ? '#4A3F7A' : 'rgba(40, 40, 56, 0.3)'};
  position: relative;
  word-wrap: break-word;
  overflow-wrap: break-word;
  
  ${({ $isThinking }) => $isThinking && `
    animation: thinkingPulse 2s ease-in-out infinite;
    
    @keyframes thinkingPulse {
      0%, 100% { 
        background: rgba(103, 69, 255, 0.1);
        border-color: rgba(103, 69, 255, 0.3);
      }
      50% { 
        background: rgba(103, 69, 255, 0.15);
        border-color: rgba(103, 69, 255, 0.4);
      }
    }
  `}
  
  ${({ $isStreaming }) => $isStreaming && `
    &::after {
      content: '';
      display: inline-block;
      width: 2px;
      height: 1.2em;
      background: #6745FF;
      margin-left: 2px;
      animation: blink 1s infinite;
      vertical-align: text-bottom;
    }
    
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
  `}
`;

const MessageText = styled.div`
  color: #FFFFFF;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  line-height: 1.5;
  margin: 0;
  
  /* Ensure text wraps properly and doesn't cause overflow */
  word-break: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
`;

const SuggestionsContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
  margin-top: ${({ theme }) => theme.spacing.md};
`;

const SuggestionChip = styled.button`
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

const SkipButton = styled.button`
  position: absolute;
  top: -8px;
  right: -8px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(103, 69, 255, 0.8);
  border: none;
  color: white;
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 2;
  
  &:hover {
    background: ${({ theme }) => theme.colors.primary};
    transform: scale(1.1);
  }
`;

/**
 * Clean Streaming Message Component
 * 
 * Features:
 * - True character-by-character streaming with cursor
 * - No overflow issues or layout problems
 * - Minimal UI footprint
 * - Optional skip button for impatient users
 * - Smooth animations without being distracting
 */
const CleanStreamingMessage: React.FC<CleanStreamingMessageProps> = ({
  id,
  text,
  isUser,
  timestamp,
  isStreaming = false,
  tradeProposal,
  suggestions,
  onSuggestionClick,
  onStopStreaming,
  onShowTradeDetails
}) => {
  const handleSuggestionClick = (suggestion: string) => {
    onSuggestionClick?.(suggestion);
  };
  
  const handleSkipStreaming = () => {
    onStopStreaming?.(id);
  };
  
  // Detect if this is a thinking message
  const isThinking = id === 'thinking' || text.includes('🤔') || text.includes('Thinking...');
  
  return (
    <MessageContainer $isUser={isUser}>
      <MessageAvatar $isUser={isUser}>
        {isUser ? '👤' : (isThinking ? '🤔' : '🤖')}
      </MessageAvatar>
      
      <MessageContent $isUser={isUser} $isStreaming={isStreaming} $isThinking={isThinking}>
        {/* Skip button for streaming messages */}
        {isStreaming && !isUser && onStopStreaming && (
          <SkipButton 
            onClick={handleSkipStreaming}
            title="Click to complete message instantly"
          >
            ⏭
          </SkipButton>
        )}
        
        {/* Message content */}
        {isUser ? (
          <MessageText>{text}</MessageText>
        ) : (
          <MessageText>
            <MarkdownMessage content={text} />
          </MessageText>
        )}
        
        {/* Trade proposal */}
        {tradeProposal && tradeProposal.tradeData && (
          <div style={{ marginTop: '12px' }}>
            <TradeProposalCard 
              trade={tradeProposal.tradeData}
              onExecute={() => console.log('Execute trade')}
              onShowMore={() => onShowTradeDetails?.(tradeProposal.tradeData)}
            />
          </div>
        )}
        
        {/* Suggestions */}
        {suggestions && suggestions.length > 0 && !isStreaming && (
          <SuggestionsContainer>
            {suggestions.map((suggestion, index) => (
              <SuggestionChip 
                key={index} 
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </SuggestionChip>
            ))}
          </SuggestionsContainer>
        )}
      </MessageContent>
    </MessageContainer>
  );
};

export default CleanStreamingMessage; 