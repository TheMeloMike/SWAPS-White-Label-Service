'use client';

import React, { ButtonHTMLAttributes, ReactNode, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  isFullWidth?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  withRipple?: boolean;
  withGlow?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

// Ripple animation
const rippleEffect = keyframes`
  0% {
    transform: scale(0);
    opacity: 0.6;
  }
  100% {
    transform: scale(2.5);
    opacity: 0;
  }
`;

// Glow pulse animation
const glowPulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(123, 97, 255, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(123, 97, 255, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(123, 97, 255, 0);
  }
`;

// Loading animation
const loadingAnimation = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

const StyledButton = styled.button<{
  $variant: string;
  $size: string;
  $isFullWidth: boolean;
  $hasIcon: boolean;
  $iconPosition: string;
  $withGlow: boolean;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  transition: all ${({ theme }) => theme.transitions.normal};
  cursor: pointer;
  width: ${({ $isFullWidth }) => ($isFullWidth ? '100%' : 'auto')};
  opacity: 1;
  text-decoration: none;
  outline: none;
  user-select: none;
  transform: translateZ(0);
  
  /* Size styles */
  ${({ $size, theme }) => {
    switch ($size) {
      case 'sm':
        return css`
          font-size: ${theme.typography.fontSize.xs};
          padding: 0.4rem 0.75rem;
          height: 2rem;
        `;
      case 'lg':
        return css`
          font-size: ${theme.typography.fontSize.base};
          padding: 0.75rem 1.5rem;
          height: 3rem;
        `;
      default: // md
        return css`
          font-size: ${theme.typography.fontSize.sm};
          padding: 0.6rem 1.25rem;
          height: 2.5rem;
        `;
    }
  }}
  
  /* Variant styles */
  ${({ $variant, theme }) => {
    switch ($variant) {
      case 'secondary':
        return css`
          background: ${theme.colors.surface};
          color: ${theme.colors.textPrimary};
          border: 1px solid ${theme.colors.border};
          
          &:hover:not(:disabled) {
            background: ${theme.colors.backgroundSecondary};
            border-color: ${theme.colors.primary};
            transform: translateY(-1px);
          }
          
          &:active:not(:disabled) {
            transform: translateY(0);
          }
        `;
      case 'outline':
        return css`
          background: transparent;
          color: ${theme.colors.primary};
          border: 1.5px solid ${theme.colors.primary};
          
          &:hover:not(:disabled) {
            background: rgba(123, 97, 255, 0.1);
            transform: translateY(-1px);
          }
          
          &:active:not(:disabled) {
            transform: translateY(0);
          }
        `;
      case 'ghost':
        return css`
          background: transparent;
          color: ${theme.colors.textPrimary};
          border: none;
          
          &:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.1);
          }
        `;
      case 'danger':
        return css`
          background: ${theme.colors.error};
          color: white;
          border: none;
          
          &:hover:not(:disabled) {
            opacity: 0.9;
            transform: translateY(-1px);
          }
          
          &:active:not(:disabled) {
            transform: translateY(0);
          }
        `;
      case 'success':
        return css`
          background: ${theme.colors.success};
          color: #141414;
          border: none;
          
          &:hover:not(:disabled) {
            opacity: 0.9;
            transform: translateY(-1px);
          }
          
          &:active:not(:disabled) {
            transform: translateY(0);
          }
        `;
      default: // primary
        return css`
          background: linear-gradient(90deg, 
            ${theme.colors.primary} 0%, 
            ${theme.colors.primaryDark} 100%
          );
          color: white;
          border: none;
          
          &:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(123, 97, 255, 0.3);
            background: linear-gradient(90deg, 
              ${theme.colors.primary} 30%, 
              ${theme.colors.primaryDark} 100%
            );
          }
          
          &:active:not(:disabled) {
            transform: translateY(0);
          }
        `;
    }
  }}
  
  /* Icon positioning */
  ${({ $hasIcon, $iconPosition }) =>
    $hasIcon &&
    css`
      ${$iconPosition === 'left'
        ? 'padding-left: 0.75rem;'
        : 'padding-right: 0.75rem;'}
    `}
  
  /* Glow animation */
  ${({ $withGlow, $variant }) =>
    $withGlow && $variant === 'primary' &&
    css`
      animation: ${glowPulse} 2s infinite;
    `}
  
  /* Disabled state */
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
`;

const IconWrapper = styled.span<{ $position: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  ${({ $position }) =>
    $position === 'left'
      ? 'margin-right: 0.5rem;'
      : 'margin-left: 0.5rem;'}
`;

const LoadingSpinner = styled.span`
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: ${loadingAnimation} 0.8s linear infinite;
  margin-right: 0.5rem;
`;

const RippleContainer = styled.span`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
`;

interface RippleProps {
  x: number;
  y: number;
  size: number;
}

const Circle = styled.span<RippleProps>`
  position: absolute;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.3);
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  top: ${({ y, size }) => y - size / 2}px;
  left: ${({ x, size }) => x - size / 2}px;
  animation: ${rippleEffect} 0.6s ease-out;
`;

/**
 * A versatile button component with various styles and features like loading state, 
 * icons, ripple effect, and glow animation.
 */
const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  isFullWidth = false,
  icon,
  iconPosition = 'left',
  withRipple = true,
  withGlow = false,
  disabled = false,
  className,
  children,
  onClick,
  ...props
}) => {
  const [ripples, setRipples] = useState<RippleProps[]>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (withRipple && !disabled && !isLoading) {
      const button = e.currentTarget;
      const rect = button.getBoundingClientRect();
      const size = Math.max(button.offsetWidth, button.offsetHeight);
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const ripple = { x, y, size };
      setRipples([...ripples, ripple]);
      
      // Clean up ripples after animation completes
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r !== ripple));
      }, 600);
    }
    
    if (onClick && !isLoading && !disabled) {
      onClick(e);
    }
  };

  return (
    <StyledButton
      type="button"
      $variant={variant}
      $size={size}
      $isFullWidth={isFullWidth}
      $hasIcon={!!icon}
      $iconPosition={iconPosition}
      $withGlow={withGlow}
      className={className}
      onClick={handleClick}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <LoadingSpinner />}
      
      {!isLoading && icon && iconPosition === 'left' && (
        <IconWrapper $position="left">{icon}</IconWrapper>
      )}
      
      {children}
      
      {!isLoading && icon && iconPosition === 'right' && (
        <IconWrapper $position="right">{icon}</IconWrapper>
      )}
      
      {withRipple && (
        <RippleContainer>
          {ripples.map((ripple, i) => (
            <Circle
              key={i}
              x={ripple.x}
              y={ripple.y}
              size={ripple.size}
            />
          ))}
        </RippleContainer>
      )}
    </StyledButton>
  );
};

export default Button; 