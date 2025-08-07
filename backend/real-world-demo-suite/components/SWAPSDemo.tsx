import React, { FC } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { SWAPSWalletProvider } from './WalletProvider';
import { SWAPSWalletConnection } from './WalletConnection';

/**
 * SWAPS Real-World Demo Application
 * 
 * This is a complete demonstration of how SWAPS would work with real users,
 * real wallets, and real NFTs in a production environment.
 * 
 * Features demonstrated:
 * - Real wallet connections (Phantom, Solflare, etc.)
 * - Automatic NFT detection from user wallets
 * - Trade listing and discovery interface
 * - User-friendly approval flows
 * - Real transaction execution
 */

interface SWAPSDemoProps {
    network?: WalletAdapterNetwork;
    title?: string;
}

export const SWAPSDemo: FC<SWAPSDemoProps> = ({ 
    network = WalletAdapterNetwork.Devnet,
    title = "SWAPS Real-World Demo"
}) => {
    return (
        <div className="swaps-demo">
            <header className="demo-header">
                <h1>🔄 {title}</h1>
                <p className="tagline">
                    Multi-Party NFT Trading • Real Wallets • Atomic Swaps
                </p>
                <div className="network-indicator">
                    <span className={`network-badge ${network}`}>
                        📡 {network.toUpperCase()}
                    </span>
                </div>
            </header>

            <main className="demo-content">
                <SWAPSWalletProvider network={network}>
                    <SWAPSWalletConnection />
                </SWAPSWalletProvider>
                
                <div className="demo-info">
                    <h3>🌍 Real-World Features</h3>
                    <div className="feature-grid">
                        <div className="feature-card">
                            <h4>🔗 Real Wallet Integration</h4>
                            <p>
                                Connect with Phantom, Solflare, or any Solana wallet.
                                Your private keys never leave your wallet.
                            </p>
                        </div>
                        
                        <div className="feature-card">
                            <h4>🎨 Automatic NFT Detection</h4>
                            <p>
                                SWAPS automatically detects all NFTs in your wallet
                                and makes them available for trading.
                            </p>
                        </div>
                        
                        <div className="feature-card">
                            <h4>🔄 Multi-Party Trading</h4>
                            <p>
                                Trade with 2-6 participants simultaneously.
                                Everyone gets what they want in one atomic transaction.
                            </p>
                        </div>
                        
                        <div className="feature-card">
                            <h4>⚡ Atomic Execution</h4>
                            <p>
                                All transfers happen simultaneously.
                                Either everyone succeeds or no one does.
                            </p>
                        </div>
                        
                        <div className="feature-card">
                            <h4>🔐 Maximum Security</h4>
                            <p>
                                You sign every transaction with your wallet.
                                SWAPS never accesses your private keys.
                            </p>
                        </div>
                        
                        <div className="feature-card">
                            <h4>📱 Mobile Ready</h4>
                            <p>
                                Works with mobile wallets through WalletConnect.
                                Trade NFTs from anywhere.
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="demo-flow">
                    <h3>🚀 How It Works</h3>
                    <div className="flow-steps">
                        <div className="step">
                            <div className="step-number">1</div>
                            <div className="step-content">
                                <h4>Connect Wallet</h4>
                                <p>Connect your Phantom, Solflare, or other Solana wallet</p>
                            </div>
                        </div>
                        
                        <div className="step">
                            <div className="step-number">2</div>
                            <div className="step-content">
                                <h4>SWAPS Detects NFTs</h4>
                                <p>We automatically find all tradeable NFTs in your wallet</p>
                            </div>
                        </div>
                        
                        <div className="step">
                            <div className="step-number">3</div>
                            <div className="step-content">
                                <h4>List for Trading</h4>
                                <p>Choose which NFTs to trade and what you want in return</p>
                            </div>
                        </div>
                        
                        <div className="step">
                            <div className="step-number">4</div>
                            <div className="step-content">
                                <h4>Find Trade Loops</h4>
                                <p>SWAPS finds multi-party opportunities with other traders</p>
                            </div>
                        </div>
                        
                        <div className="step">
                            <div className="step-number">5</div>
                            <div className="step-content">
                                <h4>Approve Trade</h4>
                                <p>Review the trade and sign approval with your wallet</p>
                            </div>
                        </div>
                        
                        <div className="step">
                            <div className="step-number">6</div>
                            <div className="step-content">
                                <h4>Atomic Execution</h4>
                                <p>All NFTs swap simultaneously in one transaction</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            
            <footer className="demo-footer">
                <p>
                    🔬 This is a real-world demonstration of SWAPS technology.
                    All wallet connections and NFT detection are fully functional.
                </p>
                <p>
                    🔗 <strong>Network:</strong> {network} | 
                    🔐 <strong>Security:</strong> Your keys, your control |
                    ⚡ <strong>Speed:</strong> Instant trade discovery
                </p>
            </footer>
        </div>
    );
};

/**
 * Demo App Entry Point
 * This is what would be rendered to show the complete SWAPS experience
 */
export const App: FC = () => {
    return (
        <SWAPSDemo 
            network={WalletAdapterNetwork.Devnet}
            title="SWAPS Real-World Demo - Multi-Party NFT Trading"
        />
    );
};

export default App;

/**
 * CSS Styles for the demo
 */
const demoStyles = `
.swaps-demo {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    font-family: 'Arial', sans-serif;
}

.demo-header {
    text-align: center;
    padding: 2rem;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    color: white;
}

.demo-header h1 {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
}

.tagline {
    font-size: 1.2rem;
    opacity: 0.9;
    margin-bottom: 1rem;
}

.network-badge {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.9rem;
}

.demo-content {
    padding: 2rem;
    background: white;
    margin: 2rem;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
    margin-top: 2rem;
}

.feature-card {
    background: #f8f9fa;
    padding: 1.5rem;
    border-radius: 8px;
    border-left: 4px solid #4CAF50;
}

.feature-card h4 {
    color: #333;
    margin-bottom: 0.5rem;
}

.flow-steps {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 2rem;
}

.step {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 8px;
}

.step-number {
    background: #4CAF50;
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    flex-shrink: 0;
}

.step-content h4 {
    margin: 0 0 0.5rem 0;
    color: #333;
}

.step-content p {
    margin: 0;
    color: #666;
}

.demo-footer {
    text-align: center;
    padding: 2rem;
    background: rgba(0, 0, 0, 0.1);
    color: white;
}

@media (max-width: 768px) {
    .feature-grid {
        grid-template-columns: 1fr;
    }
    
    .demo-content {
        margin: 1rem;
        padding: 1rem;
    }
}
`;

// Inject demo styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = demoStyles;
    document.head.appendChild(styleSheet);
}