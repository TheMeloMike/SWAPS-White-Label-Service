import React from 'react';
import styled, { keyframes, css } from 'styled-components';

interface LoadingIndicatorProps {
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
  overlay?: boolean;
  text?: string;
  color?: string;
  className?: string;
}

// Animation for the spinner
const spin = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

// Animation for the pulse
const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
`;

// Container for the loading indicator
const Container = styled.div<{
  $fullScreen: boolean;
  $overlay: boolean;
}>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  
  ${({ $fullScreen }) => $fullScreen && css`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9999;
  `}
  
  ${({ $overlay }) => $overlay && css`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    background-color: ${({ theme }) => `${theme.colors.background}99`};
    backdrop-filter: blur(3px);
  `}
`;

// The spinner component
const Spinner = styled.div<{
  $size: 'small' | 'medium' | 'large';
  $color?: string;
}>`
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
  
  ${({ $size, theme, $color }) => {
    switch ($size) {
      case 'small':
        return css`
          width: 16px;
          height: 16px;
          border: 2px solid ${theme.colors.backgroundSecondary};
          border-top: 2px solid ${$color || theme.colors.primary};
        `;
      case 'large':
        return css`
          width: 48px;
          height: 48px;
          border: 4px solid ${theme.colors.backgroundSecondary};
          border-top: 4px solid ${$color || theme.colors.primary};
        `;
      default: // medium
        return css`
          width: 32px;
          height: 32px;
          border: 3px solid ${theme.colors.backgroundSecondary};
          border-top: 3px solid ${$color || theme.colors.primary};
        `;
    }
  }}
`;

// Text label below the spinner
const LoadingText = styled.div<{
  $size: 'small' | 'medium' | 'large';
}>`
  margin-top: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  animation: ${pulse} 1.5s ease-in-out infinite;
  
  ${({ $size, theme }) => {
    switch ($size) {
      case 'small':
        return css`
          font-size: ${theme.typography.fontSize.xs};
        `;
      case 'large':
        return css`
          font-size: ${theme.typography.fontSize.lg};
        `;
      default: // medium
        return css`
          font-size: ${theme.typography.fontSize.sm};
        `;
    }
  }}
`;

/**
 * A versatile loading indicator component with various display options
 */
const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  size = 'medium',
  fullScreen = false,
  overlay = false,
  text,
  color,
  className,
}) => {
  return (
    <Container $fullScreen={fullScreen} $overlay={overlay} className={className}>
      <Spinner $size={size} $color={color} />
      {text && <LoadingText $size={size}>{text}</LoadingText>}
    </Container>
  );
};

export default LoadingIndicator; 