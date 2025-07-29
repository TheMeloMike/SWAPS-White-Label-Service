import React from 'react';
import styled from 'styled-components';

const GradientContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 1;
  opacity: 0.3;
`;

const AnimatedGradient = styled.div`
  position: absolute;
  width: 200%;
  height: 200%;
  top: -50%;
  left: -50%;
  background: radial-gradient(
    circle at 20% 30%,
    rgba(109, 102, 214, 0.3) 0%,
    transparent 50%
  ),
  radial-gradient(
    circle at 80% 80%,
    rgba(157, 141, 247, 0.2) 0%,
    transparent 50%
  ),
  radial-gradient(
    circle at 40% 70%,
    rgba(184, 174, 255, 0.2) 0%,
    transparent 50%
  );
  animation: gradientShift 20s ease-in-out infinite;
  
  @keyframes gradientShift {
    0%, 100% {
      transform: rotate(0deg) scale(1);
    }
    33% {
      transform: rotate(120deg) scale(1.1);
    }
    66% {
      transform: rotate(240deg) scale(0.9);
    }
  }
`;

interface GradientOverlayProps {
  intensity?: number;
}

const GradientOverlay: React.FC<GradientOverlayProps> = ({ intensity = 0.3 }) => {
  return (
    <GradientContainer style={{ opacity: intensity }}>
      <AnimatedGradient />
    </GradientContainer>
  );
};

export default GradientOverlay; 