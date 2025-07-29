import { DefaultTheme } from 'styled-components';

const theme: DefaultTheme = {
  colors: {
    // Main colors
    primary: '#7B61FF', // Vibrant purple
    primaryDark: '#6951D8',
    primaryLight: '#9A84FF',
    secondary: '#00E0B5', // Teal accent
    secondaryDark: '#00C29D',
    secondaryLight: '#33E6C2',
    
    // Text colors
    textPrimary: '#FFFFFF',
    textSecondary: '#A0A0B0',
    textMuted: '#717186',
    textLink: '#9A84FF',
    
    // Background colors
    background: '#0F0F17', // Dark background
    backgroundSecondary: '#151521',
    backgroundTertiary: '#1E1E2D',
    backgroundElevated: '#23233A',
    
    // Surface and border colors
    surface: '#1A1A27', // Card background
    surfaceBorder: '#282838',
    surfaceHover: '#222233',
    border: '#282838',
    borderLight: '#3A3A4A',
    
    // Status colors
    error: '#FF5D5D',
    errorDark: '#D64545',
    errorLight: '#FF7A7A',
    success: '#00E0B5',
    successDark: '#00B592',
    successLight: '#33E6C2',
    warning: '#FFD166',
    warningDark: '#E5BC5C',
    warningLight: '#FFD980',
    info: '#5E9EFF',
    infoDark: '#4B7FCC',
    infoLight: '#7EB4FF',
    
    // Gradients
    gradientStart: '#7B61FF',
    gradientEnd: '#00E0B5',
    gradientHot: 'linear-gradient(135deg, #FF6B6B 0%, #FF9E9E 100%)',
    gradientPurple: 'linear-gradient(135deg, #7B61FF 0%, #9A84FF 100%)',
    gradientBlue: 'linear-gradient(135deg, #5E9EFF 0%, #83B5FF 100%)',
    gradientGreen: 'linear-gradient(135deg, #00E0B5 0%, #33E6C2 100%)',
    
    // Special effects
    glass: 'rgba(255, 255, 255, 0.03)',
    overlay: 'rgba(0, 0, 0, 0.7)',
    highlight: 'rgba(123, 97, 255, 0.15)',
    shimmer: 'rgba(255, 255, 255, 0.05)',
  },
  
  spacing: {
    xxs: '0.125rem', // 2px
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    xxl: '3rem',     // 48px
  },
  
  typography: {
    fontSize: {
      xxs: '0.625rem',  // 10px
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '2rem',    // 32px
      '4xl': '2.5rem',  // 40px
    },
    fontFamily: {
      sans: '"Roboto Mono", monospace',
      mono: '"Roboto Mono", monospace',
      display: '"Roboto Mono", monospace',
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      none: 1,
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
    letterSpacing: {
      tight: '-0.025em',
      normal: '0',
      wide: '0.025em',
      wider: '0.05em',
    }
  },
  
  borderRadius: {
    none: '0',
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    '2xl': '24px',
    full: '9999px',
  },
  
  shadows: {
    none: 'none',
    sm: '0 2px 4px rgba(0, 0, 0, 0.3)',
    md: '0 4px 8px rgba(0, 0, 0, 0.4)',
    lg: '0 8px 16px rgba(0, 0, 0, 0.5)',
    xl: '0 12px 24px rgba(0, 0, 0, 0.6)',
    highlight: '0 0 0 2px rgba(123, 97, 255, 0.3)',
    glow: '0 0 15px rgba(123, 97, 255, 0.5)',
  },
  
  transitions: {
    instant: '0.05s ease',
    fast: '0.1s ease',
    normal: '0.2s ease',
    slow: '0.3s ease',
    gradual: '0.5s ease',
    spring: '0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    bounce: '0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
  
  zIndices: {
    base: 0,
    elevated: 10,
    dropdown: 100,
    sticky: 200,
    fixed: 300,
    modal: 400,
    popover: 500,
    tooltip: 600,
    toast: 700,
    max: 9999,
  },
  
  breakpoints: {
    xs: '480px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
  
  animations: {
    fadeIn: 'fadeIn 0.3s ease forwards',
    fadeInUp: 'fadeInUp 0.4s ease forwards',
    fadeInDown: 'fadeInDown 0.4s ease forwards',
    slideIn: 'slideIn 0.3s ease forwards',
    pulse: 'pulse 2s infinite',
    shimmer: 'shimmer 2.5s infinite',
    spin: 'spin 1s linear infinite',
    bounce: 'bounce 0.5s ease',
  },
};

export { theme }; 