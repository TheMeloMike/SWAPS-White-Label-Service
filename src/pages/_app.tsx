import { WalletProvider } from '@/providers/WalletProvider';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
require('@solana/wallet-adapter-react-ui/styles.css');

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WalletProvider>
      <Component {...pageProps} />
    </WalletProvider>
  );
} 