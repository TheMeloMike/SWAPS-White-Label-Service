'use client';

import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import MarkdownMessage from './MarkdownMessage';
import { TradeProposalCard } from './TradeProposalCard';

interface StreamingMessageProps {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isStreaming?: boolean;
  isComplete?: boolean;
  streamingProgress?: number;
  tradeProposal?: any;
  suggestions?: string[];
  loadingType?: 'simple' | 'trade_analysis' | 'portfolio' | 'search';
  onSuggestionClick?: (suggestion: string) => void;
  onStopStreaming?: (messageId: string) => void;
  onShowTradeDetails?: (trade: any) => void;
}

// Animations
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
`;

const typewriter = keyframes`
  from { width: 0; }
  to { width: 100%; }
`;

// Styled Components
const MessageContainer = styled.div<{ $isUser: boolean; $isStreaming?: boolean }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: flex-start;
  animation: ${fadeIn} 0.3s ease-out;
  flex-direction: ${({ $isUser }) => $isUser ? 'row-reverse' : 'row'};
  position: relative;
  
  ${({ $isStreaming }) => $isStreaming && css`
    .message-content {
      position: relative;
      
      &::after {
        content: '';
        position: absolute;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 2px;
        height: 20px;
        background: ${({ theme }) => theme.colors.primary};
        animation: ${pulse} 1s infinite;
      }
    }
  `}
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
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  
  transition: all 0.2s ease;
  
  &:hover {
    transform: scale(1.05);
  }
`;

const MessageContent = styled.div<{ $isUser: boolean; $isStreaming?: boolean }>`
  max-width: 70%;
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ $isUser }) => $isUser ? '#2A2653' : '#242627'};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ $isUser }) => $isUser ? '#4A3F7A' : 'rgba(40, 40, 56, 0.3)'};
  position: relative;
  overflow: hidden;
  
  ${({ $isStreaming }) => $isStreaming && css`
    background: linear-gradient(
      90deg,
      #242627 0%,
      #2a2d2e 50%,
      #242627 100%
    );
    background-size: 200px 100%;
    animation: ${shimmer} 2s ease-in-out infinite;
  `}
`;

const StreamingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-top: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.primary};
`;

const ProgressBar = styled.div<{ $progress: number }>`
  width: 100%;
  height: 2px;
  background: rgba(103, 69, 255, 0.2);
  border-radius: 1px;
  overflow: hidden;
  margin-top: ${({ theme }) => theme.spacing.xs};
  
  &::before {
    content: '';
    display: block;
    height: 100%;
    width: ${({ $progress }) => $progress}%;
    background: ${({ theme }) => theme.colors.primary};
    transition: width 0.3s ease;
  }
`;

const SkeletonLoader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const SkeletonLine = styled.div<{ $width?: string; $delay?: number }>`
  height: 16px;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0.2) 50%,
    rgba(255, 255, 255, 0.1) 100%
  );
  background-size: 200px 100%;
  border-radius: 4px;
  width: ${({ $width }) => $width || '100%'};
  animation: ${shimmer} 1.5s ease-in-out infinite;
  animation-delay: ${({ $delay }) => $delay || 0}s;
`;

const SkeletonText = styled.div<{ $delay?: number }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: rgba(255, 255, 255, 0.7);
  animation: ${pulse} 2s ease-in-out infinite;
  animation-delay: ${({ $delay }) => $delay || 0}s;
`;

const SuggestionsContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
  margin-top: ${({ theme }) => theme.spacing.md};
  animation: ${fadeIn} 0.5s ease-out 0.3s both;
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

const StopStreamingButton = styled.button`
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primary};
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
    background: ${({ theme }) => theme.colors.primaryDark};
    transform: scale(1.1);
  }
`;

const LoadingTypeIndicator = styled.div<{ $type?: string }>`
  position: absolute;
  top: -12px;
  left: 12px;
  padding: 2px 8px;
  background: ${({ theme }) => theme.colors.primary};
  color: white;
  font-size: 10px;
  border-radius: 10px;
  z-index: 1;
  
  &::before {
    content: ${({ $type }) => {
      switch ($type) {
        case 'trade_analysis': return '"🔍 Analyzing"';
        case 'portfolio': return '"📦 Portfolio"';
        case 'search': return '"🌐 Searching"';
        default: return '"💭 Thinking"';
      }
    }};
  }
`;

/**
 * Enhanced Streaming Message Component
 * 
 * Features:
 * - Progressive text display with natural typing animation
 * - Smart skeleton loading based on message type
 * - Smooth progress indicators and streaming status
 * - Interactive controls to stop/complete streaming
 * - Enhanced visual feedback and micro-animations
 * - Backward compatibility with existing message format
 */
const StreamingMessage: React.FC<StreamingMessageProps> = ({
  id,
  text,
  isUser,
  timestamp,
  isStreaming = false,
  isComplete = true,
  streamingProgress = 0,
  tradeProposal,
  suggestions,
  loadingType,
  onSuggestionClick,
  onStopStreaming,
  onShowTradeDetails
}) => {
  const [displayedText, setDisplayedText] = useState(isUser ? text : '');
  const [showSkeletonLoader, setShowSkeletonLoader] = useState(!isUser && !text && isStreaming);
  const textRef = useRef<HTMLDivElement>(null);
  
  // Handle progressive text display
  useEffect(() => {
    if (isUser || isComplete) {
      setDisplayedText(text);
      setShowSkeletonLoader(false);
      return;
    }
    
    if (isStreaming && text) {
      setShowSkeletonLoader(false);
      setDisplayedText(text);
    }
  }, [text, isStreaming, isComplete, isUser]);
  
  // Auto-scroll to show new content
  useEffect(() => {
    if (textRef.current && isStreaming) {
      textRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
    }
  }, [displayedText, isStreaming]);
  
  const handleSuggestionClick = (suggestion: string) => {
    onSuggestionClick?.(suggestion);
  };
  
  const handleStopStreaming = () => {
    onStopStreaming?.(id);
  };
  
  // Generate skeleton content based on loading type
  const getSkeletonContent = () => {
    switch (loadingType) {
      case 'trade_analysis':
        return [
          { text: '🔍 Analyzing trade opportunity...', width: '90%', delay: 0 },
          { text: '📊 Calculating efficiency metrics...', width: '75%', delay: 0.2 },
          { text: '⚖️ Evaluating fairness factors...', width: '85%', delay: 0.4 },
          { text: '🎯 Generating recommendation...', width: '70%', delay: 0.6 }
        ];
      case 'portfolio':
        return [
          { text: '📦 Scanning your NFT portfolio...', width: '85%', delay: 0 },
          { text: '🔍 Identifying tradeable assets...', width: '90%', delay: 0.3 },
          { text: '📈 Calculating portfolio value...', width: '80%', delay: 0.6 }
        ];
      case 'search':
        return [
          { text: '🌐 Searching SWAPS network...', width: '85%', delay: 0 },
          { text: '🔄 Discovering trade paths...', width: '75%', delay: 0.4 },
          { text: '⚡ Finding best matches...', width: '90%', delay: 0.8 }
        ];
      default:
        return [
          { text: '🤖 Processing your request...', width: '80%', delay: 0 },
          { text: '💭 Generating response...', width: '70%', delay: 0.5 }
        ];
    }
  };
  
  return (
    <MessageContainer $isUser={isUser} $isStreaming={isStreaming}>
      <MessageAvatar $isUser={isUser}>
        {isUser ? '👤' : '🤖'}
      </MessageAvatar>
      
      <MessageContent $isUser={isUser} $isStreaming={isStreaming} className="message-content">
        {!isUser && loadingType && (isStreaming || showSkeletonLoader) && (
          <LoadingTypeIndicator $type={loadingType} />
        )}
        
        {!isUser && isStreaming && onStopStreaming && (
          <StopStreamingButton 
            onClick={handleStopStreaming}
            title="Click to complete message instantly"
          >
            ⏸
          </StopStreamingButton>
        )}
        
        {showSkeletonLoader ? (
          <SkeletonLoader>
            {getSkeletonContent().map((item, index) => (
              <div key={index} style={{ marginBottom: '8px' }}>
                <SkeletonText $delay={item.delay}>
                  {item.text}
                </SkeletonText>
                <SkeletonLine $width={item.width} $delay={item.delay + 0.1} />
              </div>
            ))}
          </SkeletonLoader>
        ) : (
          <div ref={textRef}>
            {isUser ? (
              <div style={{ color: '#FFFFFF', fontSize: '14px', lineHeight: 1.5 }}>
                {text}
              </div>
            ) : (
              <MarkdownMessage content={displayedText} />
            )}
            
            {tradeProposal && (
              <div style={{ marginTop: '12px' }}>
                <TradeProposalCard 
                  trade={tradeProposal.tradeData}
                  onExecute={() => console.log('Execute trade')}
                  onShowMore={() => onShowTradeDetails?.(tradeProposal.tradeData)}
                />
              </div>
            )}
            
            {isStreaming && !isUser && (
              <>
                <StreamingIndicator>
                  <span>●●●</span>
                  <span>Streaming response...</span>
                  <span>{Math.round(streamingProgress)}%</span>
                </StreamingIndicator>
                <ProgressBar $progress={streamingProgress} />
              </>
            )}
            
            {suggestions && suggestions.length > 0 && (isComplete || !isStreaming) && (
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
          </div>
        )}
      </MessageContent>
    </MessageContainer>
  );
};

export default StreamingMessage; 