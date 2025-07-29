import React, { ReactNode } from 'react';
import styled, { keyframes } from 'styled-components';

interface GlassmorphicCardProps {
  children: ReactNode;
  onClick?: () => void;
  $highlighted?: boolean;
  className?: string;
  padding?: string;
  height?: string;
}

const shimmer = keyframes`
  0% {
    background-position: -100% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

const CardContainer = styled.div<{
  $highlighted?: boolean;
  $padding?: string;
  $height?: string;
}>`
  background: ${({ $highlighted, theme }) => 
    $highlighted 
      ? `rgba(103, 69, 255, 0.05)` 
      : `rgba(24, 26, 32, 0.9)`};
  border-radius: 12px;
  overflow: hidden;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid ${({ $highlighted, theme }) => 
    $highlighted 
      ? theme?.colors?.primary || '#6745FF' 
      : 'rgba(255, 255, 255, 0.08)'};
  transition: all 0.3s ease;
  padding: ${props => props.$padding || '1.5rem'};
  height: ${props => props.$height || 'auto'};
  position: relative;
  cursor: ${props => (props.onClick ? 'pointer' : 'default')};
  
  &:hover {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    border-color: ${({ $highlighted, theme }) => 
      $highlighted 
        ? theme?.colors?.primary || '#6745FF'
        : 'rgba(255, 255, 255, 0.2)'};
  }
  
  &:active {
    transform: translateY(0);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  }
  
  /* Shimmer effect overlay */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 200%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(103, 69, 255, 0.05),
      transparent
    );
    background-size: 200% 100%;
    opacity: ${props => (props.$highlighted ? 0.4 : 0)};
    transition: opacity 0.3s ease;
    animation: ${shimmer} 3s infinite linear;
    pointer-events: none;
  }
`;

const GlassmorphicCard: React.FC<GlassmorphicCardProps> = ({
  children,
  onClick,
  $highlighted,
  className,
  padding,
  height
}) => {
  return (
    <CardContainer
      onClick={onClick}
      $highlighted={$highlighted}
      className={className}
      $padding={padding}
      $height={height}
    >
      {children}
    </CardContainer>
  );
};

export default GlassmorphicCard; 