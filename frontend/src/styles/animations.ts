import { keyframes, css } from 'styled-components';

// Keyframe animations
export const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

export const glow = keyframes`
  0% {
    box-shadow: 0 0 5px rgba(109, 102, 214, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(109, 102, 214, 0.8), 0 0 30px rgba(109, 102, 214, 0.4);
  }
  100% {
    box-shadow: 0 0 5px rgba(109, 102, 214, 0.5);
  }
`;

export const pulse = keyframes`
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
`;

export const shimmer = keyframes`
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
`;

export const float = keyframes`
  0% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
  100% {
    transform: translateY(0px);
  }
`;

// Animation mixins
export const hoverScale = css`
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  
  &:hover {
    transform: scale(1.05);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  }
`;

export const hoverGlow = css`
  transition: all 0.3s ease;
  
  &:hover {
    box-shadow: 0 0 20px rgba(109, 102, 214, 0.6);
  }
`;

export const cardHover = css`
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  }
`;

export const buttonHover = css`
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    transform: translate(-50%, -50%);
    transition: width 0.6s, height 0.6s;
  }
  
  &:hover::before {
    width: 300px;
    height: 300px;
  }
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 25px rgba(109, 102, 214, 0.3);
  }
`;

export const loadingAnimation = css`
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.1) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  background-size: 1000px 100%;
  animation: ${shimmer} 2s infinite;
`;

export const fadeInAnimation = css`
  animation: ${fadeIn} 0.5s ease-out;
`;

export const slideInAnimation = css`
  animation: ${slideIn} 0.5s ease-out;
`;

export const glowAnimation = css`
  animation: ${glow} 2s ease-in-out infinite;
`;

export const floatAnimation = css`
  animation: ${float} 3s ease-in-out infinite;
`; 