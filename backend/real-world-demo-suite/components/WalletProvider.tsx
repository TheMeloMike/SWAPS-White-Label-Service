import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
    TorusWalletAdapter,
    LedgerWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Import wallet adapter CSS
require('@solana/wallet-adapter-react-ui/styles.css');

interface SWAPSWalletProviderProps {
    children: ReactNode;
    network?: WalletAdapterNetwork;
}

/**
 * SWAPS Wallet Provider
 * 
 * This component sets up wallet connections for real-world SWAPS usage.
 * It supports major Solana wallets: Phantom, Solflare, Torus, Ledger.
 */
export const SWAPSWalletProvider: FC<SWAPSWalletProviderProps> = ({ 
    children, 
    network = WalletAdapterNetwork.Devnet 
}) => {
    // Configure RPC endpoint based on network
    const endpoint = useMemo(() => {
        switch (network) {
            case WalletAdapterNetwork.Mainnet:
                return process.env.REACT_APP_SOLANA_RPC_URL || clusterApiUrl('mainnet-beta');
            case WalletAdapterNetwork.Testnet:
                return clusterApiUrl('testnet');
            case WalletAdapterNetwork.Devnet:
            default:
                return clusterApiUrl('devnet');
        }
    }, [network]);

    // Configure supported wallets
    const wallets = useMemo(
        () => [
            // Phantom - Most popular Solana wallet
            new PhantomWalletAdapter(),
            
            // Solflare - Web and mobile wallet
            new SolflareWalletAdapter({ network }),
            
            // Torus - Social login wallet
            new TorusWalletAdapter(),
            
            // Ledger - Hardware wallet
            new LedgerWalletAdapter(),
        ],
        [network]
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

/**
 * Example usage:
 * 
 * ```tsx
 * import { SWAPSWalletProvider } from './components/WalletProvider';
 * import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
 * 
 * function App() {
 *     return (
 *         <SWAPSWalletProvider network={WalletAdapterNetwork.Devnet}>
 *             <SWAPSTradeInterface />
 *         </SWAPSWalletProvider>
 *     );
 * }
 * ```
 */