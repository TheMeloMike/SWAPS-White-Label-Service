import React, { useRef, useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

interface RippleButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'success' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  className?: string;
  rippleColor?: string;
  rippleDuration?: number;
  hover3D?: boolean;
  glow?: boolean;
  fullWidth?: boolean;
}

interface Ripple {
  x: number;
  y: number;
  size: number;
  id: number;
}

// Styled components
const StyledButton = styled(motion.button)<{
  $variant: string;
  $size: string;
  $hover3D: boolean;
  $glow: boolean;
  $disabled: boolean;
  $fullWidth: boolean;
}>`
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  user-select: none;
  opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};
  transform-style: ${({ $hover3D }) => ($hover3D ? 'preserve-3d' : 'flat')};
  perspective: ${({ $hover3D }) => ($hover3D ? '1000px' : 'none')};
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  transform: translateZ(0);
  transition: all 0.2s ease;
  
  ${({ $size, theme }) => {
    switch ($size) {
      case 'sm':
        return `
          font-size: ${theme.typography.fontSize.xs};
          padding: 0.5rem 0.75rem;
          height: 2rem;
        `;
      case 'lg':
        return `
          font-size: ${theme.typography.fontSize.base};
          padding: 0.75rem 1.5rem;
          height: 3rem;
        `;
      default: // md
        return `
          font-size: ${theme.typography.fontSize.sm};
          padding: 0.625rem 1.25rem;
          height: 2.5rem;
        `;
    }
  }}
  
  ${({ $variant, theme, $glow }) => {
    const getStyles = () => {
      switch ($variant) {
        case 'secondary':
          return `
            background: ${theme.colors.surface};
            color: ${theme.colors.textPrimary};
            border: 1px solid ${theme.colors.border};
            
            &:hover:not(:disabled) {
              background: ${theme.colors.backgroundSecondary};
              border-color: ${theme.colors.border};
            }
          `;
        case 'outline':
          return `
            background: transparent;
            color: ${theme.colors.primary};
            border: 1.5px solid ${theme.colors.primary};
            
            &:hover:not(:disabled) {
              background: rgba(123, 97, 255, 0.1);
            }
          `;
        case 'ghost':
          return `
            background: transparent;
            color: ${theme.colors.textPrimary};
            border: none;
            
            &:hover:not(:disabled) {
              background: rgba(255, 255, 255, 0.1);
            }
          `;
        case 'success':
          return `
            background: ${theme.colors.success};
            color: #141414;
            border: none;
            
            &:hover:not(:disabled) {
              background: ${theme.colors.successDark || theme.colors.success};
            }
          `;
        case 'danger':
          return `
            background: ${theme.colors.error};
            color: white;
            border: none;
            
            &:hover:not(:disabled) {
              background: ${theme.colors.errorDark || theme.colors.error};
            }
          `;
        default: // primary
          return `
            background: linear-gradient(90deg, ${theme.colors.primary} 0%, ${theme.colors.primaryDark} 100%);
            color: white;
            border: none;
            box-shadow: ${$glow ? `0 4px 15px rgba(123, 97, 255, 0.3)` : 'none'};
            
            &:hover:not(:disabled) {
              background: linear-gradient(90deg, ${theme.colors.primary} 30%, ${theme.colors.primaryDark} 100%);
              box-shadow: ${$glow ? `0 6px 20px rgba(123, 97, 255, 0.4)` : 'none'};
            }
          `;
      }
    };
    
    return getStyles();
  }}
  
  &:hover:not(:disabled) {
    transform: translateY(-2px);
  }
  
  &:active:not(:disabled) {
    transform: translateY(0);
  }
`;

const RippleContainer = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
`;

const Ripple = styled.span<{
  size: number;
  x: number;
  y: number;
  color: string;
  $duration: number;
}>`
  position: absolute;
  border-radius: 50%;
  transform: scale(0);
  background-color: ${({ color }) => color};
  width: ${({ size }) => `${size}px`};
  height: ${({ size }) => `${size}px`};
  top: ${({ y, size }) => `${y - size / 2}px`};
  left: ${({ x, size }) => `${x - size / 2}px`};
  transform-origin: center;
  animation: ripple ${({ $duration }) => `${$duration}ms`} ease-out forwards;
  
  @keyframes ripple {
    0% {
      transform: scale(0);
      opacity: 0.6;
    }
    100% {
      transform: scale(4);
      opacity: 0;
    }
  }
`;

const LoadingSpinner = styled.div`
  width: 1em;
  height: 1em;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 0.8s linear infinite;
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

/**
 * An enhanced button component with advanced ripple effects and animations.
 * Creates engaging and satisfying interactions for users.
 */
const RippleButton: React.FC<RippleButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  isLoading = false,
  icon,
  iconPosition = 'left',
  className,
  rippleColor = 'rgba(255, 255, 255, 0.5)',
  rippleDuration = 600,
  hover3D = false,
  glow = false,
  fullWidth = false,
}) => {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextRippleId = useRef(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || isLoading) return;
    
    if (onClick) {
      onClick(e);
    }
    
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Size should be at least the diagonal of the button
    const width = button.offsetWidth;
    const height = button.offsetHeight;
    const size = Math.max(width, height) * 2;
    const id = nextRippleId.current++;
    
    setRipples(prev => [...prev, { x, y, size, id }]);
    
    // Remove ripple after animation completes
    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== id));
    }, rippleDuration);
  };
  
  // Button animation variants
  const buttonVariants = {
    initial: { 
      scale: 1 
    },
    hover: { 
      scale: 1.02,
      transition: { duration: 0.2 }
    },
    tap: { 
      scale: 0.98,
      transition: { duration: 0.1 }
    },
    disabled: { 
      scale: 1,
      opacity: 0.6
    }
  };
  
  // 3D hover effect
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  
  const handle3DHover = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!hover3D || disabled || isLoading) return;
    
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateY = ((x - centerX) / centerX) * 5; // Max 5 degrees
    const rotateX = ((centerY - y) / centerY) * 5; // Max 5 degrees
    
    setRotation({ x: rotateX, y: rotateY });
  };
  
  const resetRotation = () => {
    setRotation({ x: 0, y: 0 });
  };
  
  // Content with icon
  const renderContent = () => {
    if (isLoading) {
      return <LoadingSpinner />;
    }
    
    return (
      <>
        {icon && iconPosition === 'left' && icon}
        {children}
        {icon && iconPosition === 'right' && icon}
      </>
    );
  };
  
  return (
    <StyledButton
      ref={buttonRef}
      onClick={handleClick}
      onMouseMove={handle3DHover}
      onMouseLeave={resetRotation}
      disabled={disabled || isLoading}
      className={className}
      $variant={variant}
      $size={size}
      $hover3D={hover3D}
      $glow={glow}
      $disabled={disabled || isLoading}
      $fullWidth={fullWidth}
      initial="initial"
      whileHover={disabled || isLoading ? "disabled" : "hover"}
      whileTap={disabled || isLoading ? "disabled" : "tap"}
      variants={buttonVariants}
      style={{
        rotateX: rotation.x,
        rotateY: rotation.y
      }}
    >
      {renderContent()}
      
      <RippleContainer>
        <AnimatePresence>
          {ripples.map(ripple => (
            <Ripple
              key={ripple.id}
              size={ripple.size}
              x={ripple.x}
              y={ripple.y}
              color={rippleColor}
              $duration={rippleDuration}
            />
          ))}
        </AnimatePresence>
      </RippleContainer>
    </StyledButton>
  );
};

export default RippleButton; 