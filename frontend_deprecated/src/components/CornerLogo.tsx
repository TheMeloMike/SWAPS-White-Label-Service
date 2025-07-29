import React from 'react';
import Image from 'next/image';
import styled from 'styled-components';

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