import React from 'react';
import styled from 'styled-components';
import { shimmer } from '@/styles/animations';

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  margin?: string;
}

const SkeletonElement = styled.div<SkeletonProps>`
  width: ${props => props.width || '100%'};
  height: ${props => props.height || '20px'};
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.05) 0%,
    rgba(255, 255, 255, 0.1) 50%,
    rgba(255, 255, 255, 0.05) 100%
  );
  background-size: 200% 100%;
  animation: ${shimmer} 1.5s infinite;
  border-radius: ${props => props.borderRadius || '4px'};
  margin: ${props => props.margin || '0'};
`;

const SkeletonContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SkeletonRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

interface SkeletonLoaderProps {
  type?: 'text' | 'nft' | 'table';
  rows?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ type = 'text', rows = 3 }) => {
  if (type === 'nft') {
    return (
      <SkeletonRow>
        <SkeletonElement width="40px" height="40px" borderRadius="8px" />
        <div style={{ flex: 1 }}>
          <SkeletonElement height="16px" width="70%" margin="0 0 4px 0" />
          <SkeletonElement height="12px" width="40%" />
        </div>
      </SkeletonRow>
    );
  }

  if (type === 'table') {
    return (
      <SkeletonContainer>
        {Array.from({ length: rows }).map((_, index) => (
          <SkeletonRow key={index}>
            <SkeletonElement width="40px" height="40px" borderRadius="8px" />
            <SkeletonElement width="150px" height="16px" />
            <SkeletonElement width="80px" height="24px" borderRadius="12px" />
            <SkeletonElement width="60px" height="16px" />
            <SkeletonElement width="60px" height="24px" borderRadius="12px" />
            <SkeletonElement width="50px" height="16px" />
          </SkeletonRow>
        ))}
      </SkeletonContainer>
    );
  }

  return (
    <SkeletonContainer>
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonElement key={index} width={`${100 - index * 10}%`} />
      ))}
    </SkeletonContainer>
  );
};

export default SkeletonLoader; 