import { WalletContextProvider } from '@/providers/WalletProvider';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import StyledComponentsRegistry from '@/lib/registry';
require('@solana/wallet-adapter-react-ui/styles.css');

export default function App({ Component, pageProps }: AppProps) {
  return (
    <StyledComponentsRegistry>
      <ThemeProvider theme={theme}>
        <WalletContextProvider>
          <Component {...pageProps} />
        </WalletContextProvider>
      </ThemeProvider>
    </StyledComponentsRegistry>
  );
} 