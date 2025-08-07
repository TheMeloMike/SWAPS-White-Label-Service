import React, { FC, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection, PublicKey } from '@solana/web3.js';

interface NFT {
    mint: string;
    name: string;
    image?: string;
    collection?: string;
}

/**
 * SWAPS Wallet Connection Component
 * 
 * This is what real users see when connecting their wallets to SWAPS.
 * It handles wallet connection, NFT detection, and displays user inventory.
 */
export const SWAPSWalletConnection: FC = () => {
    const { connected, publicKey, wallet, disconnect } = useWallet();
    const [userNFTs, setUserNFTs] = useState<NFT[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Detect user's NFTs when wallet connects
    useEffect(() => {
        if (connected && publicKey) {
            detectUserNFTs(publicKey);
        } else {
            setUserNFTs([]);
            setError(null);
        }
    }, [connected, publicKey]);

    /**
     * Detect NFTs owned by the connected wallet
     * This is the real-world equivalent of what SWAPS would do
     */
    const detectUserNFTs = async (walletAddress: PublicKey) => {
        setLoading(true);
        setError(null);
        
        try {
            console.log('🔍 Detecting NFTs for wallet:', walletAddress.toBase58());
            
            // In production, this would call our NFT detection service
            // For demo purposes, we'll simulate with a timeout
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Simulated NFT detection results
            const mockNFTs: NFT[] = [
                {
                    mint: "7xKXtg2CW3SBjZ4ddyJCCJrWKdTJPCfgDSjdyqRqiFFt",
                    name: "Bored Ape #1234",
                    collection: "Bored Ape Yacht Club",
                    image: "https://example.com/bayc/1234.png"
                },
                {
                    mint: "AaLiLP2rZ5fKQpV2iJ3HdkR6hWpvr3hNuFT7kD2iBUJt",
                    name: "CryptoPunk #5678",
                    collection: "CryptoPunks",
                    image: "https://example.com/punks/5678.png"
                },
                {
                    mint: "54oUD16xuV3dPZwgfXXD33XLAv1XqS6buCvBpgJ4km27",
                    name: "DeGod #9012",
                    collection: "DeGods",
                    image: "https://example.com/degods/9012.png"
                }
            ];
            
            setUserNFTs(mockNFTs);
            console.log('✅ Found', mockNFTs.length, 'NFTs');
            
        } catch (err) {
            console.error('❌ Error detecting NFTs:', err);
            setError('Failed to detect NFTs. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Handle listing an NFT for trading
     */
    const handleListNFT = async (nft: NFT) => {
        console.log('📝 Listing NFT for trading:', nft.name);
        
        // In production, this would call the SWAPS API
        alert(`Listed ${nft.name} for trading! This would integrate with SWAPS trade discovery.`);
    };

    if (!connected) {
        return (
            <div className="wallet-connection-container">
                <div className="connection-prompt">
                    <h2>🌟 Welcome to SWAPS</h2>
                    <p>Connect your wallet to start trading NFTs</p>
                    <p className="subtitle">
                        Multi-party trades • Zero fees • Atomic swaps
                    </p>
                    
                    <div className="wallet-button-container">
                        <WalletMultiButton />
                    </div>
                    
                    <div className="supported-wallets">
                        <p>Supported wallets:</p>
                        <div className="wallet-icons">
                            <span>👻 Phantom</span>
                            <span>🔥 Solflare</span>
                            <span>🌐 Torus</span>
                            <span>🔐 Ledger</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="wallet-connected-container">
            <div className="wallet-header">
                <div className="wallet-info">
                    <h3>🔗 Wallet Connected</h3>
                    <p>
                        <strong>{wallet?.adapter.name}</strong>
                    </p>
                    <p className="wallet-address">
                        {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-8)}
                    </p>
                </div>
                
                <button onClick={disconnect} className="disconnect-button">
                    Disconnect
                </button>
            </div>

            <div className="nft-inventory">
                <h4>🎨 Your NFT Inventory</h4>
                
                {loading && (
                    <div className="loading">
                        <p>🔍 Detecting your NFTs...</p>
                        <div className="loading-spinner">⏳</div>
                    </div>
                )}
                
                {error && (
                    <div className="error">
                        <p>❌ {error}</p>
                        <button onClick={() => detectUserNFTs(publicKey!)}>
                            Try Again
                        </button>
                    </div>
                )}
                
                {!loading && !error && userNFTs.length === 0 && (
                    <div className="no-nfts">
                        <p>No NFTs found in this wallet</p>
                        <p className="subtitle">
                            You need NFTs to participate in trading
                        </p>
                    </div>
                )}
                
                {!loading && userNFTs.length > 0 && (
                    <div className="nft-grid">
                        {userNFTs.map((nft) => (
                            <div key={nft.mint} className="nft-card">
                                <div className="nft-image">
                                    {nft.image ? (
                                        <img src={nft.image} alt={nft.name} />
                                    ) : (
                                        <div className="nft-placeholder">🖼️</div>
                                    )}
                                </div>
                                
                                <div className="nft-info">
                                    <h5>{nft.name}</h5>
                                    {nft.collection && (
                                        <p className="collection">{nft.collection}</p>
                                    )}
                                    <p className="mint">
                                        {nft.mint.slice(0, 8)}...{nft.mint.slice(-8)}
                                    </p>
                                </div>
                                
                                <button 
                                    onClick={() => handleListNFT(nft)}
                                    className="list-button"
                                >
                                    List for Trading
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {userNFTs.length > 0 && (
                <div className="trade-actions">
                    <h4>🔄 Trade Actions</h4>
                    <p>Ready to trade! SWAPS will find multi-party opportunities.</p>
                    <button className="discover-trades-button">
                        🔍 Discover Trade Opportunities
                    </button>
                </div>
            )}
        </div>
    );
};

/**
 * CSS Styles (would be in a separate .css file in production)
 */
const styles = `
.wallet-connection-container {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem;
    text-align: center;
}

.connection-prompt h2 {
    color: #4CAF50;
    margin-bottom: 1rem;
}

.wallet-button-container {
    margin: 2rem 0;
}

.supported-wallets {
    margin-top: 2rem;
    opacity: 0.7;
}

.wallet-icons {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 0.5rem;
}

.wallet-connected-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
}

.wallet-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 8px;
}

.nft-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
}

.nft-card {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 1rem;
    text-align: center;
}

.nft-image {
    width: 100%;
    height: 150px;
    background: #f5f5f5;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
}

.list-button {
    background: #4CAF50;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 0.5rem;
}

.discover-trades-button {
    background: #2196F3;
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1.1rem;
    margin-top: 1rem;
}
`;

// Inject styles (in production, this would be a separate CSS file)
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}