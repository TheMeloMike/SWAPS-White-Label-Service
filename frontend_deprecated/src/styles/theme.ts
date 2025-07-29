import { DefaultTheme } from 'styled-components';

const theme: DefaultTheme = {
  colors: {
    primary: '#7B61FF', // Vibrant purple
    primaryDark: '#6951D8',
    accent: '#00E0B5', // Teal accent
    textPrimary: '#FFFFFF',
    textSecondary: '#A0A0B0',
    textMuted: '#717186',
    background: '#0F0F17', // Dark background
    backgroundSecondary: '#151521',
    surface: '#1A1A27', // Card background
    surfaceBorder: '#282838',
    border: '#282838',
    error: '#FF5D5D',
    success: '#00E0B5',
    warning: '#FFD166',
    gradientStart: '#7B61FF',
    gradientEnd: '#00E0B5',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
  typography: {
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
    },
    fontFamily: {
      sans: '"Roboto Mono", monospace',
      mono: '"Roboto Mono", monospace',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    }
  },
  borderRadius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  shadows: {
    sm: '0 2px 4px rgba(0, 0, 0, 0.3)',
    md: '0 4px 8px rgba(0, 0, 0, 0.4)',
    lg: '0 8px 16px rgba(0, 0, 0, 0.5)',
  },
  transitions: {
    fast: '0.1s ease',
    normal: '0.2s ease',
    slow: '0.3s ease',
  }
};

export { theme }; 