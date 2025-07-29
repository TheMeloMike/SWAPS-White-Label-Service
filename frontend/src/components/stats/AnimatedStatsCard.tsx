import React, { useState } from 'react';
import styled from 'styled-components';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import AnimatedNumber from '../common/AnimatedNumber';

interface AnimatedStatsCardProps {
  title: string;
  value: number;
  change?: number;
  changeText?: string;
  description?: string;
  icon?: React.ReactNode;
  color?: string;
  format?: (value: number) => string;
  delay?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

const Card = styled(motion.div)`
  background: rgba(255, 255, 255, 0.03);
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  box-shadow: ${({ theme }) => theme.shadows.sm};
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.25s cubic-bezier(0.2, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transform: translateZ(0);
  overflow: visible;
  position: relative;
  width: 100%;
  box-sizing: border-box;
  min-height: 160px;
  
  @media (max-width: 640px) {
    padding: ${({ theme }) => theme.spacing.sm};
    min-height: 140px;
  }
`;

const GlowFilter = styled(motion.div)`
  position: absolute;
  inset: -1px;
  z-index: -1;
  border-radius: inherit;
  background: radial-gradient(
    800px circle at var(--x) var(--y),
    rgba(123, 97, 255, 0.15),
    transparent 40%
  );
  opacity: 0;
  transition: opacity 0.2s;
`;

const CardContent = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  z-index: 1;
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const Title = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
`;

const IconWrapper = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  color: ${({ theme }) => theme.colors.primary};
`;

const ValueWrapper = styled.div`
  margin-top: auto;
`;

const Value = styled.div<{ $color?: string }>`
  font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ $color, theme }) => $color || theme.colors.textPrimary};
  margin: 0;
  display: flex;
  align-items: baseline;
  transition: transform 0.3s ease;
  
  span {
    font-size: 0.9em;
  }
  
  @media (max-width: 640px) {
    font-size: ${({ theme }) => theme.typography.fontSize.xl};
  }
`;

const Change = styled.div<{ $positive?: boolean; $neutral?: boolean }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ $positive, $neutral, theme }) => 
    $neutral ? theme.colors.textSecondary : 
    $positive ? theme.colors.success : theme.colors.error};
  display: flex;
  align-items: center;
  margin-top: ${({ theme }) => theme.spacing.xxs};
  
  svg {
    margin-right: 4px;
  }
`;

const Description = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin: ${({ theme }) => theme.spacing.xs} 0 0;
  max-width: 90%;
`;

/**
 * An animated card component for displaying statistics with interactive hover effects,
 * animated counters, and visual feedback for changes in values.
 */
const AnimatedStatsCard: React.FC<AnimatedStatsCardProps> = ({
  title,
  value,
  change,
  changeText,
  description,
  icon,
  color,
  format,
  delay = 0,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
}) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  // Transform x/y mouse position to card rotation
  const rotateY = useTransform(x, [-100, 100], [-2, 2]);
  const rotateX = useTransform(y, [-100, 100], [2, -2]);
  
  // State to track hover
  const [isHovered, setIsHovered] = useState(false);
  
  // Handle mouse move for interactive effects
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Calculate distance from center of card
    const mouseX = e.clientX - rect.left - centerX;
    const mouseY = e.clientY - rect.top - centerY;
    
    // Update motion values for rotation
    x.set(mouseX);
    y.set(mouseY);
    
    // Set CSS variables for glow effect
    e.currentTarget.style.setProperty('--x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--y', `${e.clientY - rect.top}px`);
  };
  
  // Handle hover state changes
  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  // Determine if change is positive, negative, or neutral
  const isPositive = change !== undefined && change > 0;
  const isNeutral = change === undefined || change === 0;
  
  // Card animation variants
  const cardVariants = {
    hover: { 
      scale: 1.02,
      boxShadow: '0 10px 20px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(123, 97, 255, 0.1)',
      borderColor: 'rgba(123, 97, 255, 0.3)',
      transition: { duration: 0.2 }
    },
    initial: { 
      scale: 1,
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      transition: { duration: 0.2 }
    }
  };
  
  // Entrance animation variants
  const entranceVariants = {
    hidden: { 
      opacity: 0,
      y: 20,
      scale: 0.95
    },
    visible: { 
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        delay: delay * 0.1,
        ease: [0.25, 0.1, 0.25, 1.0]
      }
    }
  };

  return (
    <Card
      className={className}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      initial="hidden"
      animate="visible"
      variants={entranceVariants}
      whileHover="hover"
      style={{
        rotateY,
        rotateX,
        transition: 'all 0.15s ease'
      }}
    >
      <GlowFilter 
        style={{ 
          opacity: isHovered ? 1 : 0
        }} 
      />
      
      <CardContent>
        <CardHeader>
          <Title>{title}</Title>
          {icon && <IconWrapper>{icon}</IconWrapper>}
        </CardHeader>
        
        <ValueWrapper>
          <Value $color={color}>
            <AnimatedNumber
              value={value}
              formatFn={format}
              prefix={prefix}
              suffix={suffix}
              decimals={decimals}
              duration={1500}
              delay={delay * 100}
            />
          </Value>
          
          {!isNeutral && (
            <Change $positive={isPositive} $neutral={isNeutral}>
              {isPositive ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M7 14l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {changeText || `${Math.abs(change || 0)}%`}
            </Change>
          )}
          
          {isNeutral && changeText && (
            <Change $neutral={true}>
              {changeText}
            </Change>
          )}
        </ValueWrapper>
        
        {description && <Description>{description}</Description>}
      </CardContent>
    </Card>
  );
};

export default AnimatedStatsCard; 