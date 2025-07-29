import 'styled-components';

declare module 'styled-components' {
  export interface DefaultTheme {
    colors: {
      primary: string;
      primaryDark: string;
      primaryLight: string;
      secondary: string;
      secondaryDark: string;
      secondaryLight: string;
      textPrimary: string;
      textSecondary: string;
      textMuted: string;
      textLink: string;
      background: string;
      backgroundSecondary: string;
      backgroundTertiary: string;
      backgroundElevated: string;
      surface: string;
      surfaceBorder: string;
      surfaceHover: string;
      border: string;
      borderLight: string;
      error: string;
      errorDark: string;
      errorLight: string;
      success: string;
      successDark: string;
      successLight: string;
      warning: string;
      warningDark: string;
      warningLight: string;
      info: string;
      infoDark: string;
      infoLight: string;
      gradientStart: string;
      gradientEnd: string;
      gradientHot: string;
      gradientPurple: string;
      gradientBlue: string;
      gradientGreen: string;
      glass: string;
      overlay: string;
      highlight: string;
      shimmer: string;
    };
    spacing: {
      xxs: string;
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      xxl: string;
    };
    typography: {
      fontSize: {
        xxs: string;
        xs: string;
        sm: string;
        base: string;
        lg: string;
        xl: string;
        '2xl': string;
        '3xl': string;
        '4xl': string;
      };
      fontFamily: {
        sans: string;
        mono: string;
        display: string;
      };
      fontWeight: {
        light: number;
        normal: number;
        medium: number;
        semibold: number;
        bold: number;
      };
      lineHeight: {
        none: number;
        tight: number;
        normal: number;
        relaxed: number;
      };
      letterSpacing: {
        tight: string;
        normal: string;
        wide: string;
        wider: string;
      };
    };
    borderRadius: {
      none: string;
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
      full: string;
    };
    shadows: {
      none: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      highlight: string;
      glow: string;
    };
    transitions: {
      instant: string;
      fast: string;
      normal: string;
      slow: string;
      gradual: string;
      spring: string;
      bounce: string;
    };
    breakpoints: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
    };
    animations: {
      fadeIn: string;
      fadeInUp: string;
      fadeInDown: string;
      slideIn: string;
      pulse: string;
      shimmer: string;
      spin: string;
      bounce: string;
    };
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
} 