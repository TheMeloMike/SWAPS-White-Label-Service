import React, { useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // Duration in milliseconds
  onDismiss: (id: string) => void;
}

// Animation for sliding in from top
const slideIn = keyframes`
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

// Animation for sliding out to top
const slideOut = keyframes`
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(-110%);
    opacity: 0;
  }
`;

// Different toast background colors based on type
const getToastColor = (type: ToastType, theme: any) => {
  switch (type) {
    case 'success':
      return theme.colors.success;
    case 'error':
      return theme.colors.error;
    case 'warning':
      return theme.colors.warning;
    case 'info':
    default:
      return theme.colors.primary;
  }
};

// Different toast icons based on type
const getToastIcon = (type: ToastType) => {
  switch (type) {
    case 'success':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      );
    case 'error':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      );
    case 'warning':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      );
    case 'info':
    default:
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      );
  }
};

interface ToastContainerProps {
  $type: ToastType;
  $closing: boolean;
}

const ToastContainer = styled.div<ToastContainerProps>`
  display: flex;
  align-items: center;
  min-width: 300px;
  max-width: 450px;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background-color: ${({ theme }) => theme.colors.backgroundSecondary};
  border-left: 4px solid ${({ $type, theme }) => getToastColor($type, theme)};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  box-shadow: ${({ theme }) => theme.shadows.md};
  color: ${({ theme }) => theme.colors.textPrimary};
  animation: ${({ $closing }) => 
    $closing 
      ? css`${slideOut} 0.3s ease-in-out forwards` 
      : css`${slideIn} 0.3s ease-in-out`
  };
  position: relative;
  overflow: hidden;
`;

const IconContainer = styled.div<{ $type: ToastType }>`
  display: flex;
  align-items: center;
  margin-right: ${({ theme }) => theme.spacing.sm};
  color: ${({ $type, theme }) => getToastColor($type, theme)};
  
  svg {
    width: 20px;
    height: 20px;
  }
`;

const MessageContainer = styled.div`
  flex: 1;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  line-height: 1.5;
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.colors.textSecondary};
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing.xs};
  margin-left: ${({ theme }) => theme.spacing.xs};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background ${({ theme }) => theme.transitions.normal};
  
  &:hover {
    background: ${({ theme }) => theme.colors.backgroundSecondary};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

// Progress bar to visualize the auto-dismiss timer
const ProgressBar = styled.div<{ $duration: number; $type: ToastType }>`
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background-color: ${({ $type, theme }) => getToastColor($type, theme)};
  animation: shrink ${({ $duration }) => $duration}ms linear forwards;
  
  @keyframes shrink {
    from { width: 100%; }
    to { width: 0%; }
  }
`;

const Toast: React.FC<ToastProps> = ({
  id,
  type,
  message,
  duration = 5000, // Default 5 seconds
  onDismiss,
}) => {
  const [closing, setClosing] = React.useState(false);
  
  // Handle the auto-dismiss
  useEffect(() => {
    const timer = setTimeout(() => {
      setClosing(true);
      // Add a small delay for the close animation to finish
      setTimeout(() => onDismiss(id), 300);
    }, duration);
    
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);
  
  // Handle manual dismiss
  const handleDismiss = () => {
    setClosing(true);
    // Allow time for animation
    setTimeout(() => onDismiss(id), 300);
  };
  
  return (
    <ToastContainer $type={type} $closing={closing}>
      <IconContainer $type={type}>
        {getToastIcon(type)}
      </IconContainer>
      <MessageContainer>
        {message}
      </MessageContainer>
      <CloseButton onClick={handleDismiss} aria-label="Close notification">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </CloseButton>
      <ProgressBar $duration={duration} $type={type} />
    </ToastContainer>
  );
};

export default Toast; 