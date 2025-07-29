'use client';

import { ThemeProvider } from 'styled-components';
import { WalletContextProvider } from '@/providers/WalletProvider';
import { theme } from '@/styles/theme';
import StyledComponentsRegistry from '@/lib/registry';

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <StyledComponentsRegistry>
      <ThemeProvider theme={theme}>
        <WalletContextProvider>
          {children}
        </WalletContextProvider>
      </ThemeProvider>
    </StyledComponentsRegistry>
  );
} 