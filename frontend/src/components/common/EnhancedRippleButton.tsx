import React, { useState, useRef, useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';

interface RippleButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  loading?: boolean;
}

interface RippleState {
  x: number;
  y: number;
  size: number;
  active: boolean;
}

const rippleAnimation = keyframes`
  0% {
    transform: scale(0);
    opacity: 0.6;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
`;

const loadingAnimation = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const scaleAnimation = keyframes`
  0% { transform: scale(1) translateY(0); }
  50% { transform: scale(0.95) translateY(2px); }
  100% { transform: scale(1) translateY(0); }
`;

const ButtonContainer = styled.button<{
  $variant: string;
  $size: string;
  $fullWidth: boolean;
  $hasIcon: boolean;
  $isLoading: boolean;
}>`
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: ${({ $size }) => 
    $size === 'small' ? '0.5rem 0.75rem' : 
    $size === 'large' ? '0.75rem 1.5rem' : 
    '0.625rem 1.25rem'};
  font-size: ${({ $size }) => 
    $size === 'small' ? '0.875rem' : 
    $size === 'large' ? '1.125rem' : 
    '1rem'};
  font-weight: 500;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  cursor: ${({ disabled, $isLoading }) => (disabled || $isLoading ? 'not-allowed' : 'pointer')};
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, box-shadow;
  transform: translateZ(0);
  
  &:active:not(:disabled) {
    animation: ${scaleAnimation} 0.2s forwards;
  }
  
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }
  
  /* Variant Styles */
  ${({ $variant, theme, disabled, $isLoading }) => {
    if ($variant === 'primary') {
      return css`
        background: ${theme.colors.primary};
        color: white;
        border: none;
        box-shadow: 0 2px 4px rgba(103, 69, 255, 0.2);
        
        &:hover:not(:disabled):not([data-loading="true"]) {
          background: ${theme.colors.primaryDark};
          box-shadow: 0 4px 12px rgba(103, 69, 255, 0.3);
          transform: translateY(-2px);
        }
        
        &:disabled, &[data-loading="true"] {
          background: ${disabled || $isLoading ? 'rgba(103, 69, 255, 0.5)' : theme.colors.primary};
          color: ${disabled ? 'rgba(255, 255, 255, 0.6)' : 'white'};
        }
      `;
    }
    
    if ($variant === 'secondary') {
      return css`
        background: rgba(103, 69, 255, 0.1);
        color: ${theme.colors.primary};
        border: none;
        
        &:hover:not(:disabled):not([data-loading="true"]) {
          background: rgba(103, 69, 255, 0.15);
          transform: translateY(-2px);
        }
        
        &:disabled, &[data-loading="true"] {
          background: rgba(103, 69, 255, 0.05);
          color: ${disabled ? 'rgba(103, 69, 255, 0.5)' : theme.colors.primary};
        }
      `;
    }
    
    if ($variant === 'outline') {
      return css`
        background: transparent;
        color: ${theme.colors.primary};
        border: 1px solid ${theme.colors.primary};
        
        &:hover:not(:disabled):not([data-loading="true"]) {
          background: rgba(103, 69, 255, 0.05);
          border-color: ${theme.colors.primaryDark};
          transform: translateY(-2px);
        }
        
        &:disabled, &[data-loading="true"] {
          color: ${disabled ? 'rgba(103, 69, 255, 0.5)' : theme.colors.primary};
          border-color: ${disabled ? 'rgba(103, 69, 255, 0.3)' : theme.colors.primary};
        }
      `;
    }
    
    return css`
      background: transparent;
      color: ${theme.colors.textPrimary};
      border: none;
      
      &:hover:not(:disabled):not([data-loading="true"]) {
        background: rgba(255, 255, 255, 0.05);
        transform: translateY(-2px);
      }
      
      &:disabled, &[data-loading="true"] {
        color: ${disabled ? 'rgba(255, 255, 255, 0.3)' : theme.colors.textPrimary};
      }
    `;
  }}
`;

const RippleEffect = styled.span<{ $x: number; $y: number; $size: number }>`
  position: absolute;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.5);
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  left: ${({ $x }) => $x}px;
  top: ${({ $y }) => $y}px;
  transform: translate(-50%, -50%) scale(0);
  animation: ${rippleAnimation} 0.6s ease-out;
  pointer-events: none;
`;

const LoadingSpinner = styled.span`
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: ${loadingAnimation} 0.8s infinite linear;
`;

const IconWrapper = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const EnhancedRippleButton: React.FC<RippleButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  icon,
  disabled = false,
  className,
  type = 'button',
  loading = false,
}) => {
  const [ripples, setRipples] = useState<RippleState[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Clear ripples after animation completes
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (ripples.length > 0) {
        setRipples([]);
      }
    }, 600);
    
    return () => clearTimeout(timeout);
  }, [ripples]);
  
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    
    const button = buttonRef.current;
    if (!button) return;
    
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Use the longer dimension for the ripple
    const size = Math.max(rect.width, rect.height) * 2;
    
    // Add new ripple
    setRipples([...ripples, { x, y, size, active: true }]);
    
    if (onClick) {
      onClick(e);
    }
  };
  
  return (
    <ButtonContainer
      ref={buttonRef}
      onClick={handleClick}
      $variant={variant}
      $size={size}
      $fullWidth={fullWidth}
      $hasIcon={!!icon}
      disabled={disabled}
      className={className}
      type={type}
      $isLoading={loading}
      data-loading={loading}
    >
      {/* Ripple effects */}
      {ripples.map((ripple, i) => (
        <RippleEffect
          key={i}
          $x={ripple.x}
          $y={ripple.y}
          $size={ripple.size}
        />
      ))}
      
      {/* Loading spinner */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {icon && <IconWrapper>{icon}</IconWrapper>}
          {children}
        </>
      )}
    </ButtonContainer>
  );
};

export default EnhancedRippleButton; 