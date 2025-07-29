import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';

interface GlowEffectProps {
  children: React.ReactNode;
  color?: string;
  intensity?: 'low' | 'medium' | 'high';
  interactive?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const GlowContainer = styled.div<{
  $color: string;
  $intensity: string;
  $interactive: boolean;
}>`
  position: relative;
  z-index: 1;
  overflow: visible;
  display: inline-block;
  
  &:before {
    content: '';
    position: absolute;
    top: -20px;
    left: -20px;
    right: -20px;
    bottom: -20px;
    border-radius: inherit;
    z-index: -1;
    opacity: ${({ $intensity }) => 
      $intensity === 'low' ? '0.3' : 
      $intensity === 'high' ? '0.7' : 
      '0.5'};
    background: radial-gradient(
      circle at var(--x, 50%) var(--y, 50%), 
      ${({ $color }) => $color}, 
      transparent 70%
    );
    pointer-events: none;
    transition: opacity 0.3s ease, transform 0.3s ease;
    transform: scale(${({ $intensity }) => 
      $intensity === 'low' ? '0.7' : 
      $intensity === 'high' ? '1.1' : 
      '0.9'});
  }
  
  ${({ $interactive }) => $interactive && `
    &:hover:before {
      opacity: 0.8;
      transform: scale(1.2);
    }
  `}
`;

/**
 * A component that adds a customizable glow effect behind its children.
 * It can be static or interactive, tracking mouse movements for a dynamic glow effect.
 */
const GlowEffect: React.FC<GlowEffectProps> = ({
  children,
  color = 'rgba(123, 97, 255, 0.5)',
  intensity = 'medium',
  interactive = true,
  className,
  style,
}) => {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!interactive || !containerRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      setPosition({ x, y });
      
      // Update CSS variables for the glow position
      if (containerRef.current) {
        containerRef.current.style.setProperty('--x', `${x}%`);
        containerRef.current.style.setProperty('--y', `${y}%`);
      }
    };

    const element = containerRef.current;
    element.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      element.removeEventListener('mousemove', handleMouseMove);
    };
  }, [interactive]);

  return (
    <GlowContainer
      ref={containerRef}
      $color={color}
      $intensity={intensity}
      $interactive={interactive}
      className={className}
      style={style}
    >
      {children}
    </GlowContainer>
  );
};

export default GlowEffect; 