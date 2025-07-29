import React from 'react';
import styled from 'styled-components';
import { cardHover, fadeInAnimation, glowAnimation } from '@/styles/animations';
import AnimatedNumber from './AnimatedNumber';

const Card = styled.div<{ $glowing?: boolean }>`
  background: rgba(255, 255, 255, 0.03);
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
  ${fadeInAnimation}
  ${cardHover}
  ${props => props.$glowing && glowAnimation}
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(109, 102, 214, 0.1) 0%,
      transparent 50%,
      rgba(109, 102, 214, 0.05) 100%
    );
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  &:hover::before {
    opacity: 1;
  }
`;

const IconContainer = styled.div`
  width: 48px;
  height: 48px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: rgba(109, 102, 214, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  font-size: 24px;
  transition: transform 0.3s ease;
  
  ${Card}:hover & {
    transform: scale(1.1) rotate(5deg);
  }
`;

const Label = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const Value = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.textPrimary};
  line-height: 1;
`;

const Change = styled.div<{ $positive?: boolean }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ $positive, theme }) => $positive ? theme.colors.success : theme.colors.error};
  margin-top: ${({ theme }) => theme.spacing.sm};
  display: flex;
  align-items: center;
  gap: 4px;
`;

interface StatCardProps {
  icon?: string;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  change?: number;
  glowing?: boolean;
  formatFn?: (value: number) => string;
}

const StatCard: React.FC<StatCardProps> = ({
  icon = '📊',
  label,
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  change,
  glowing = false,
  formatFn
}) => {
  return (
    <Card $glowing={glowing}>
      <IconContainer>{icon}</IconContainer>
      <Label>{label}</Label>
      <Value>
        <AnimatedNumber
          value={value}
          prefix={prefix}
          suffix={suffix}
          decimals={decimals}
          formatFn={formatFn}
        />
      </Value>
      {change !== undefined && (
        <Change $positive={change >= 0}>
          <span>{change >= 0 ? '↑' : '↓'}</span>
          <AnimatedNumber
            value={Math.abs(change)}
            suffix="%"
            decimals={1}
          />
        </Change>
      )}
    </Card>
  );
};

export default StatCard; 