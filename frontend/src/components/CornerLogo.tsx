import React from 'react';
import Image from 'next/image';
import styled, { keyframes } from 'styled-components';

const rotate = keyframes`
  0% { transform: rotate(0deg); }
  25% { transform: rotate(5deg); }
  75% { transform: rotate(-5deg); }
  100% { transform: rotate(0deg); }
`;

const pulse = keyframes`
  0% { 
    filter: drop-shadow(0 0 0px rgba(103, 69, 255, 0));
    transform: scale(1);
  }
  50% { 
    filter: drop-shadow(0 0 10px rgba(103, 69, 255, 0.7));
    transform: scale(1.05);
  }
  100% {
    filter: drop-shadow(0 0 0px rgba(103, 69, 255, 0));
    transform: scale(1);
  }
`;

const colorChange = keyframes`
  0% { filter: brightness(1) hue-rotate(0deg); }
  50% { filter: brightness(1.4) hue-rotate(50deg); }
  100% { filter: brightness(1) hue-rotate(0deg); }
`;

const LogoContainer = styled.div`
  position: fixed;
  bottom: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  z-index: 10;
  opacity: 0.7;
  transition: opacity 0.3s ease;
  
  &:hover {
    opacity: 1;
    animation: ${rotate} 2s ease-in-out infinite;
    
    img {
      animation: ${pulse} 1.5s ease-in-out infinite, ${colorChange} 3s ease-in-out infinite;
    }
  }
  
  img {
    transition: filter 0.3s ease;
  }
`;

const CornerLogo: React.FC = () => {
  return (
    <LogoContainer>
      <Image 
        src="/swaps-logo-black.svg"
        alt="SWAPS Logo"
        width={40}
        height={40}
        className="object-contain"
        priority
      />
    </LogoContainer>
  );
};

export default CornerLogo; 