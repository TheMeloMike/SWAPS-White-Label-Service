import React from 'react';
import styled, { keyframes } from 'styled-components';

interface AnimatedTitleProps {
  text: string;
  className?: string;
}

const hoverAnimation = keyframes`
  0% {
    color: white;
    text-shadow: 0 0 2px rgba(103, 69, 255, 0.2);
    transform: translateY(0);
  }
  50% {
    color: #d0d0ff;
    text-shadow: 0 0 15px rgba(124, 97, 255, 0.8), 0 0 25px rgba(124, 97, 255, 0.5);
    transform: translateY(-3px);
  }
  100% {
    color: white;
    text-shadow: 0 0 2px rgba(103, 69, 255, 0.2);
    transform: translateY(0);
  }
`;

const clickAnimation = keyframes`
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2) rotate(5deg);
    color: #6745ff;
    text-shadow: 0 0 20px rgba(103, 69, 255, 0.9);
  }
  100% {
    transform: scale(1);
  }
`;

const TitleContainer = styled.h1`
  font-family: var(--font-michroma), sans-serif;
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.15rem;
  color: white;
  letter-spacing: -1px;
  position: relative;
  display: flex;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  
  @media (max-width: 600px) {
    font-size: 1.8rem;
  }
`;

const CharWrapper = styled.span<{ $index: number }>`
  position: relative;
  display: inline-block;
  transition: all 0.2s ease;
  
  &:hover {
    animation: ${hoverAnimation} 0.8s ease-in-out;
    color: #6745ff;
    text-shadow: 0 0 15px rgba(103, 69, 255, 0.8), 0 0 30px rgba(103, 69, 255, 0.6);
    transform: translateY(-2px);
  }
  
  &:active {
    animation: ${clickAnimation} 0.5s ease-in-out;
  }
`;

const AnimatedTitle: React.FC<AnimatedTitleProps> = ({ text, className }) => {
  return (
    <TitleContainer className={className} data-text={text}>
      {text.split('').map((char, index) => (
        <CharWrapper 
          key={index} 
          $index={index}
        >
          {char}
        </CharWrapper>
      ))}
    </TitleContainer>
  );
};

export default AnimatedTitle; 