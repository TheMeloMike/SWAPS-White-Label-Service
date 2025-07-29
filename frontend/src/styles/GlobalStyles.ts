import { createGlobalStyle } from 'styled-components';

const GlobalStyles = createGlobalStyle`
  /* Add global animations */
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes fadeInUp {
    from { 
      opacity: 0;
      transform: translateY(20px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes fadeInDown {
    from { 
      opacity: 0;
      transform: translateY(-20px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes slideIn {
    from { 
      transform: translateX(-20px);
      opacity: 0;
    }
    to { 
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.05);
      opacity: 0.8;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
  
  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
  
  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
  
  @keyframes bounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-10px);
    }
  }
  
  /* Base styles */
  body {
    margin: 0;
    padding: 0;
    background-color: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.textPrimary};
    font-family: ${({ theme }) => theme.typography.fontFamily.sans};
    font-size: ${({ theme }) => theme.typography.fontSize.base};
    line-height: ${({ theme }) => theme.typography.lineHeight.normal};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow-x: hidden;
  }
  
  * {
    box-sizing: border-box;
  }
  
  a {
    color: ${({ theme }) => theme.colors.textLink};
    text-decoration: none;
    transition: color ${({ theme }) => theme.transitions.fast};
    
    &:hover {
      color: ${({ theme }) => theme.colors.primary};
    }
  }
  
  h1, h2, h3, h4, h5, h6 {
    margin: 0 0 ${({ theme }) => theme.spacing.md} 0;
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    line-height: ${({ theme }) => theme.typography.lineHeight.tight};
  }
  
  h1 {
    font-size: ${({ theme }) => theme.typography.fontSize['3xl']};
  }
  
  h2 {
    font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  }
  
  h3 {
    font-size: ${({ theme }) => theme.typography.fontSize.xl};
  }
  
  h4 {
    font-size: ${({ theme }) => theme.typography.fontSize.lg};
  }
  
  p {
    margin: 0 0 ${({ theme }) => theme.spacing.md} 0;
  }
  
  button, input, select, textarea {
    font-family: inherit;
  }
  
  ::selection {
    background-color: ${({ theme }) => theme.colors.primary};
    color: white;
  }
  
  /* Improved scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.backgroundSecondary};
  }
  
  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.surfaceBorder};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    
    &:hover {
      background: ${({ theme }) => theme.colors.primary};
    }
  }
  
  /* Apply smooth scrolling */
  html {
    scroll-behavior: smooth;
  }
  
  /* Focus states */
  :focus {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }
  
  /* Add responsive text sizing */
  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    h1 {
      font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
    }
    
    h2 {
      font-size: ${({ theme }) => theme.typography.fontSize.xl};
    }
    
    h3 {
      font-size: ${({ theme }) => theme.typography.fontSize.lg};
    }
  }
  
  /* Animation classes that can be applied to any element */
  .animate-fadeIn { animation: ${({ theme }) => theme.animations.fadeIn}; }
  .animate-fadeInUp { animation: ${({ theme }) => theme.animations.fadeInUp}; }
  .animate-fadeInDown { animation: ${({ theme }) => theme.animations.fadeInDown}; }
  .animate-slideIn { animation: ${({ theme }) => theme.animations.slideIn}; }
  .animate-pulse { animation: ${({ theme }) => theme.animations.pulse}; }
  .animate-shimmer { animation: ${({ theme }) => theme.animations.shimmer}; }
  .animate-spin { animation: ${({ theme }) => theme.animations.spin}; }
  .animate-bounce { animation: ${({ theme }) => theme.animations.bounce}; }
  
  /* Utility classes for commonly used styles */
  .text-gradient {
    background: linear-gradient(90deg, 
      ${({ theme }) => theme.colors.gradientStart}, 
      ${({ theme }) => theme.colors.gradientEnd}
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-fill-color: transparent;
  }
  
  .glass-effect {
    background: ${({ theme }) => theme.colors.glass};
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
    
    &::-webkit-scrollbar {
      display: none;
    }
  }
`;

export default GlobalStyles; 