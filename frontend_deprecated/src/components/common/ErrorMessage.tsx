import React from 'react';
import styled from 'styled-components';
import { getUserFriendlyMessage, ErrorCategory, categorizeError } from '@/utils/errors/errorHandler';

interface ErrorMessageProps {
  error: unknown;
  className?: string;
  showDetails?: boolean;
  onRetry?: () => void;
}

// Styled container with different styling based on error category
const ErrorContainer = styled.div<{ $category: ErrorCategory }>`
  background-color: ${({ theme, $category }) => {
    switch ($category) {
      case ErrorCategory.NETWORK:
        return `${theme.colors.warning}15`; // Subtle warning background
      case ErrorCategory.WALLET:
        return `${theme.colors.primary}15`; // Subtle primary background
      default:
        return `${theme.colors.error}15`; // Subtle error background
    }
  }};
  
  border: 1px solid ${({ theme, $category }) => {
    switch ($category) {
      case ErrorCategory.NETWORK:
        return theme.colors.warning;
      case ErrorCategory.WALLET:
        return theme.colors.primary;
      default:
        return theme.colors.error;
    }
  }};
  
  color: ${({ theme, $category }) => {
    switch ($category) {
      case ErrorCategory.NETWORK:
        return theme.colors.warning;
      case ErrorCategory.WALLET:
        return theme.colors.primary;
      default:
        return theme.colors.error;
    }
  }};
  
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  margin: ${({ theme }) => theme.spacing.md} 0;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const ErrorText = styled.p`
  margin: 0;
  line-height: 1.5;
`;

const ErrorDetails = styled.pre`
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  margin: ${({ theme }) => theme.spacing.xs} 0 0 0;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  overflow: auto;
  max-height: 150px;
  word-break: break-all;
  white-space: pre-wrap;
`;

const ActionButton = styled.button`
  background: transparent;
  border: 1px solid currentColor;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  cursor: pointer;
  color: inherit;
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  margin-top: ${({ theme }) => theme.spacing.xs};
  align-self: flex-start;
  transition: all ${({ theme }) => theme.transitions.normal};
  
  &:hover {
    background: ${({ theme }) => theme.colors.backgroundSecondary};
  }
`;

/**
 * A component to display error messages with consistent styling
 */
const ErrorMessage: React.FC<ErrorMessageProps> = ({ 
  error, 
  className,
  showDetails = false,
  onRetry 
}) => {
  // Get categorized error information
  const errorInfo = categorizeError(error);
  const message = getUserFriendlyMessage(error);
  
  return (
    <ErrorContainer className={className} $category={errorInfo.category}>
      <ErrorText>{message}</ErrorText>
      
      {showDetails && errorInfo.technical && (
        <ErrorDetails>
          {errorInfo.technical}
        </ErrorDetails>
      )}
      
      {onRetry && (
        <ActionButton onClick={onRetry}>
          Try Again
        </ActionButton>
      )}
    </ErrorContainer>
  );
};

export default ErrorMessage; 