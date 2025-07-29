import React, { useState } from 'react';
import styled from 'styled-components';
import { motion, useMotionTemplate, useMotionValue, AnimatePresence } from 'framer-motion';

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverScale?: number;
  rotateEffect?: boolean;
  glowEffect?: boolean;
  elevation?: 'none' | 'low' | 'medium' | 'high';
  entranceDelay?: number;
  interactive?: boolean;
  fadeInUpEffect?: boolean;
}

const StyledCard = styled(motion.div)<{
  $elevation: 'none' | 'low' | 'medium' | 'high';
  $rotateEffect: boolean;
  $glowEffect: boolean;
  $interactive: boolean;
}>`
  position: relative;
  overflow: visible;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  border: 1px solid ${({ theme }) => theme.colors.surfaceBorder};
  height: 100%;
  width: 100%;
  padding: ${({ theme }) => theme.spacing.md};
  box-sizing: border-box;
  transform-style: preserve-3d;
  perspective: 1000px;
  transform: translateZ(0);
  
  ${({ $elevation, theme }) => {
    switch ($elevation) {
      case 'low':
        return `box-shadow: ${theme.shadows.sm};`;
      case 'medium':
        return `box-shadow: ${theme.shadows.md};`;
      case 'high':
        return `box-shadow: ${theme.shadows.lg};`;
      default:
        return 'box-shadow: none;';
    }
  }}
  
  ${({ $interactive }) => $interactive && `
    cursor: pointer;
  `}
  
  ${({ $glowEffect }) => $glowEffect && `
    &::before {
      content: '';
      position: absolute;
      inset: -1px;
      background: radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(123, 97, 255, 0.4), transparent 40%);
      border-radius: inherit;
      z-index: -1;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }
    
    &:hover::before {
      opacity: 0.7;
    }
  `}
`;

const GlowHighlight = styled(motion.div)`
  position: absolute;
  inset: 0;
  border-radius: inherit;
  opacity: 0;
  z-index: 2;
  pointer-events: none;
  background: radial-gradient(
    800px circle at var(--mouse-x) var(--mouse-y),
    rgba(123, 97, 255, 0.1),
    transparent 40%
  );
`;

/**
 * An attention-grabbing animated card component with various interactive effects
 */
const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className,
  onClick,
  hoverScale = 1.02,
  rotateEffect = false,
  glowEffect = true,
  elevation = 'medium',
  entranceDelay = 0,
  interactive = true,
  fadeInUpEffect = true,
}) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [isHovered, setIsHovered] = useState(false);
  
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  
  const backgroundX = useMotionValue(0);
  const backgroundY = useMotionValue(0);
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Calculate mouse position relative to the card
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Update CSS variables for glow effect
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
    
    // For Framer Motion values
    mouseX.set(x);
    mouseY.set(y);
    
    if (rotateEffect) {
      // Calculate rotation based on mouse position
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateXValue = ((y - centerY) / centerY) * 5; // Max 5 degrees
      const rotateYValue = ((centerX - x) / centerX) * 5; // Max 5 degrees
      
      rotateX.set(rotateXValue);
      rotateY.set(rotateYValue);
    }
  };

  const handleMouseEnter = () => {
    if (!interactive) return;
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (!interactive) return;
    setIsHovered(false);
    
    // Reset rotations
    if (rotateEffect) {
      rotateX.set(0);
      rotateY.set(0);
    }
  };
  
  // Card entrance animation
  const entranceVariants = {
    hidden: { 
      opacity: 0, 
      y: fadeInUpEffect ? 20 : 0,
      scale: 0.98
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: { 
        duration: 0.5,
        delay: entranceDelay * 0.1,
        ease: [0.25, 0.1, 0.25, 1.0] // Easing function for smoother motion
      }
    }
  };
  
  // Card hover animation
  const hoverVariants = {
    hover: {
      scale: hoverScale,
      transition: { duration: 0.2, ease: "easeOut" }
    },
    rest: {
      scale: 1,
      transition: { duration: 0.2, ease: "easeOut" }
    }
  };
  
  return (
    <AnimatePresence>
      <StyledCard
        initial="hidden"
        animate="visible"
        variants={entranceVariants}
        whileHover={interactive ? "hover" : undefined}
        style={{
          rotateX: rotateEffect ? rotateX : 0,
          rotateY: rotateEffect ? rotateY : 0
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={interactive ? onClick : undefined}
        className={className}
        $elevation={elevation}
        $rotateEffect={rotateEffect}
        $glowEffect={glowEffect}
        $interactive={interactive}
      >
        {children}
        
        {glowEffect && (
          <GlowHighlight
            style={{
              opacity: isHovered ? 1 : 0,
              background: useMotionTemplate`radial-gradient(
                800px circle at ${mouseX}px ${mouseY}px,
                rgba(123, 97, 255, 0.1),
                transparent 40%
              )`
            }}
          />
        )}
      </StyledCard>
    </AnimatePresence>
  );
};

export default AnimatedCard; 