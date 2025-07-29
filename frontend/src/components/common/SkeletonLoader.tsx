import React from 'react';
import styled, { keyframes, DefaultTheme, css } from 'styled-components';

interface SkeletonLoaderProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  margin?: string;
  className?: string;
  variant?: 'rectangular' | 'circular' | 'text';
  animation?: 'pulse' | 'wave' | 'none';
}

// Shimmer animation
const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

// Pulse animation
const pulse = keyframes`
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 0.3;
  }
`;

const SkeletonElement = styled.div<{
  $width: string;
  $height: string;
  $borderRadius: string;
  $margin: string;
  $variant: 'rectangular' | 'circular' | 'text';
  $animation: 'pulse' | 'wave' | 'none';
}>`
  width: ${({ $width }) => $width};
  height: ${({ $height }) => $height};
  border-radius: ${({ $borderRadius, $variant }) => $variant === 'circular' ? '50%' : $borderRadius};
  margin: ${({ $margin }) => $margin};
  background-color: ${({ theme }) => theme.colors.backgroundSecondary};
  
  ${({ $variant }) => $variant === 'text' && `
    margin-bottom: 0.7em;
    &:last-child {
      width: 80%;
    }
  `}
  
  ${({ $animation }) => $animation === 'pulse' && css`
    animation: ${pulse} 1.5s ease-in-out infinite;
  `}
  
  ${({ $animation, theme }: { $animation: string; theme: DefaultTheme }) => $animation === 'wave' && css`
    background: linear-gradient(
      90deg,
      ${theme.colors.backgroundSecondary} 25%, 
      ${theme.colors.surface} 37%, 
      ${theme.colors.backgroundSecondary} 63%
    );
    background-size: 200% 100%;
    animation: ${shimmer} 1.5s infinite;
    animation-timing-function: linear;
  `}
`;

/**
 * A skeleton loader component that displays a placeholder while content is loading
 */
const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = '20px',
  borderRadius = '4px',
  margin = '0',
  className,
  variant = 'rectangular',
  animation = 'wave',
}) => {
  return (
    <SkeletonElement
      className={className}
      $width={width}
      $height={height}
      $borderRadius={borderRadius}
      $margin={margin}
      $variant={variant}
      $animation={animation}
    />
  );
};

// Preset variants for common use cases
export const TextSkeleton = styled(SkeletonLoader).attrs({
  variant: 'text',
  height: '16px',
  margin: '0 0 8px 0',
})``;

export const CircleSkeleton = styled(SkeletonLoader).attrs({
  variant: 'circular',
})``;

export const RectSkeleton = styled(SkeletonLoader).attrs({
  variant: 'rectangular',
})``;

// Create a skeleton component for cards
export const CardSkeleton: React.FC<{ height?: string }> = ({ height = '200px' }) => (
  <RectSkeleton height={height} borderRadius="12px" />
);

// Create a skeleton component for table rows
export const TableRowSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <>
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} style={{ display: 'flex', width: '100%', marginBottom: '12px' }}>
        <CircleSkeleton width="40px" height="40px" margin="0 12px 0 0" />
        <div style={{ flex: 1 }}>
          <TextSkeleton width="60%" />
          <TextSkeleton width="40%" />
        </div>
      </div>
    ))}
  </>
);

export default SkeletonLoader; 