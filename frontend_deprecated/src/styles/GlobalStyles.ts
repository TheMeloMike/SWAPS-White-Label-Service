import { createGlobalStyle } from 'styled-components';

export const GlobalStyles = createGlobalStyle`
  :root {
    /* Color palette comes from theme.ts now */
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    
    /* Animation variables for consistency - refined for subtlety */
    --transition-speed-fast: 0.15s;
    --transition-speed-normal: 0.2s;
    --transition-speed-slow: 0.3s;
    --hover-lift: translateY(-1px);
    --active-press: translateY(0.5px);
    --hover-glow: 0 2px 6px rgba(103, 69, 255, 0.15);
    --hover-glow-soft: 0 1px 3px rgba(103, 69, 255, 0.1);
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    max-width: 100%;
  }

  html, body {
    width: 100%;
    height: 100%;
    min-height: 100vh;
    overflow-x: hidden;
    max-width: 100vw;
  }

  body {
    font-family: ${({ theme }) => theme.typography.fontFamily.sans};
    font-size: ${({ theme }) => theme.typography.fontSize.base};
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.textPrimary};
    background-color: ${({ theme }) => theme.colors.background};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  #__next, main {
    min-height: 100vh;
    width: 100%;
    max-width: 100vw;
  }

  /* Ensure all containers have proper box-sizing and max-width */
  div {
    box-sizing: border-box;
    max-width: 100%;
  }

  /* Ensure images, videos, and other media are responsive */
  img, video, iframe, canvas, svg {
    max-width: 100%;
    height: auto;
  }

  /* Make tables responsive */
  table {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    display: block;
  }

  /* Enhanced button interactions - refined for subtlety */
  button, 
  [role="button"],
  a.button,
  .wallet-adapter-button {
    transition: all var(--transition-speed-normal) cubic-bezier(0.2, 0, 0.2, 1);
    backface-visibility: hidden;
    transform: translateZ(0);
    
    &:hover {
      transform: var(--hover-lift);
      box-shadow: var(--hover-glow-soft);
    }
    
    &:active {
      transform: var(--active-press);
      transition: all 0.1s cubic-bezier(0.2, 0, 0.2, 1);
    }
  }

  /* Card hover effects */
  [class*="Card"], [class*="Container"] {
    transition: all var(--transition-speed-normal) cubic-bezier(0.2, 0, 0.2, 1);
  }

  /* Critical fix for bordered components with rounded corners */
  div[style*="border-radius"], 
  div[class*="Container"], 
  div[class*="Card"],
  div[class*="Tab"],
  div[class*="Button"], 
  button, 
  [role="button"],
  a.button,
  .wallet-adapter-button,
  *[style*="border-radius"], 
  *[class*="radius"], 
  *[class*="corner"] {
    isolation: isolate;
    position: relative;
    z-index: 0;
    max-width: 100%;
  }

  /* Fix for Safari and older browsers */
  @supports (-webkit-appearance: none) {
    div[style*="border-radius"], 
    div[class*="Container"], 
    div[class*="Card"],
    div[class*="Tab"],
    div[class*="Button"], 
    button,
    [role="button"] {
      -webkit-mask-image: -webkit-radial-gradient(white, black);
      transform: translateZ(0);
    }
  }

  /* Fix specific component types */
  .wallet-adapter-button,
  button,
  [role="button"] {
    overflow: hidden;
  }

  /* Special fix for Tab component which appears to be most affected */
  div[class*="Tab"] {
    margin: 1px;
    overflow: visible !important;
    backface-visibility: hidden;
  }

  /* Direct fix for Volume tab button */
  .volume-tab-button {
    display: inline-block !important;
    overflow: visible !important;
    border-radius: 9999px !important;
    /* Force hardware acceleration */
    transform: translateZ(0) !important;
    -webkit-mask-image: -webkit-radial-gradient(white, black) !important;
    backface-visibility: hidden !important;
    perspective: 1000px !important;
    transform-style: preserve-3d !important;
    -webkit-font-smoothing: subpixel-antialiased !important;
    position: relative !important;
    z-index: 10 !important;
    padding-left: 16px !important;
    padding-right: 16px !important;
  }

  /* Fix for tabs container to ensure all tab text is visible */
  div[class*="TabsContainer"] {
    min-width: 340px !important;
    display: flex !important;
    flex-wrap: nowrap !important;
    justify-content: stretch !important;
    margin-right: 10px !important;
  }

  /* Ensure the last tab in any container (typically "Participants") has enough room */
  div[class*="TabsContainer"] button:last-child {
    flex: 1.3 !important;
    min-width: 120px !important;
  }

  /* Remove text-overflow ellipsis from tab buttons */
  div[class*="TabsContainer"] button {
    text-overflow: clip !important;
    overflow: visible !important;
  }

  /* Responsive text adjustment */
  @media (max-width: 480px) {
    html {
      font-size: 14px;
    }
  }

  h1, h2, h3, h4, h5, h6 {
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
    line-height: 1.25;
    margin-bottom: ${({ theme }) => theme.spacing.md};
    color: ${({ theme }) => theme.colors.textPrimary};
    word-break: break-word;
  }

  a {
    color: ${({ theme }) => theme.colors.primary};
    text-decoration: none;
    transition: all var(--transition-speed-fast);

    &:hover {
      color: ${({ theme }) => theme.colors.primaryDark};
    }
  }

  button {
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
  }

  /* Custom scrollbar for the dark theme */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.background};
  }
  
  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.border};
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: ${({ theme }) => theme.colors.textMuted};
  }

  /* Fade-in animation for components */
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Subtle glow animation - more refined pulsing */
  @keyframes pulse-glow {
    0% {
      box-shadow: 0 0 0 rgba(103, 69, 255, 0.05);
    }
    50% {
      box-shadow: 0 0 5px rgba(103, 69, 255, 0.1);
    }
    100% {
      box-shadow: 0 0 0 rgba(103, 69, 255, 0.05);
    }
  }

  .fade-in {
    animation: fadeIn 0.3s ease forwards;
  }
`; 