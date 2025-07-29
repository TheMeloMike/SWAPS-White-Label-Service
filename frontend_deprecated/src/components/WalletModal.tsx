import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useWallet } from '@solana/wallet-adapter-react';
import { TradeService } from '@/services/trade';
import { NFTService, NFTMetadata } from '@/services/nft';
import { NFTCard } from './NFTCard';
import { fixImageUrl, handleImageError } from '@/utils/imageUtils';
import { getCollectionName } from '@/utils/nftUtils';

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background:#181a1b;
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 20px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  
  &:hover {
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

const WalletInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
`;

const WalletAddress = styled.div`
  font-family: monospace;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textSecondary};
  background: #242627;
  padding: 8px 12px;
  border-radius: 6px;
  word-break: break-all;
`;

const NFTGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  margin-top: 16px;
`;

const ScanButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: ${({ theme }) => theme.colors.primary};
  color: #FFFFFF;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${({ theme }) => theme.colors.primaryDark};
  }
  
  &:disabled {
    background: ${({ theme }) => theme.colors.backgroundSecondary};
    cursor: not-allowed;
  }
`;

const StatusBadge = styled.div`
  background: #242627;
  color: ${({ theme }) => theme.colors.textSecondary};
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: ${({ theme }) => theme.colors.textSecondary};
  text-align: center;
  
  svg {
    margin-bottom: 16px;
    color: ${({ theme }) => theme.colors.textMuted};
  }
`;

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Global variable to track the last scan time for each wallet
const walletScanTimes: Map<string, number> = new Map();
// How often to refresh (15 minutes)
const SCAN_REFRESH_INTERVAL = 15 * 60 * 1000;

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { publicKey, disconnect } = useWallet();
  const [nfts, setNfts] = useState<NFTMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'complete' | 'error'>('idle');
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const nftService = NFTService.getInstance();
  const tradeService = TradeService.getInstance();
  
  // Check if a deep scan is needed
  const isDeepScanNeeded = (walletAddress: string): boolean => {
    const lastScan = walletScanTimes.get(walletAddress);
    
    if (!lastScan) {
      // No record of previous scan, so one is needed
      return true;
    }
    
    const now = Date.now();
    const timeSinceLastScan = now - lastScan;
    
    // If it's been more than the refresh interval since the last scan
    return timeSinceLastScan > SCAN_REFRESH_INTERVAL;
  };
  
  // Automatically scan for NFTs when wallet connects, but only if needed
  useEffect(() => {
    if (publicKey) {
      const walletAddress = publicKey.toString();
      loadNFTs();
      
      // Check if a deep scan is needed
      if (isDeepScanNeeded(walletAddress)) {
        console.log(`Deep scan needed for wallet ${walletAddress}`);
        handleDeepScan();
      } else {
        console.log(`Using recent scan data for wallet ${walletAddress}`);
        const lastScan = walletScanTimes.get(walletAddress);
        if (lastScan) {
          setLastScanTime(new Date(lastScan));
        }
      }
    }
  }, [publicKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // We're disabling the exhaustive-deps rule because adding loadNFTs and handleDeepScan 
  // would create a dependency cycle for this effect
  
  const loadNFTs = async () => {
    if (!publicKey) return;
    
    try {
      setIsLoading(true);
      const walletAddress = publicKey.toString();
      
      // Use NFTService to load NFTs instead of direct fetch
      const walletNfts = await nftService.getWalletNFTs(walletAddress);
      
      // Log the NFT data for debugging
      console.log('Loaded NFTs:', walletNfts.map(nft => ({
        address: nft.address,
        name: nft.name,
        image: nft.image,
        hasCollection: nft.collection ? 'yes' : 'no',
        collectionType: nft.collection ? typeof nft.collection : 'none'
      })));
      
      setNfts(walletNfts);
    } catch (error) {
      console.error('Error loading NFTs:', error);
      setNfts([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeepScan = async () => {
    if (!publicKey) return;
    
    try {
      const walletAddress = publicKey.toString();
      setIsScanning(true);
      setScanStatus('scanning');
      
      const result = await tradeService.deepScanWallet(walletAddress);
      
      if (result.success) {
        await loadNFTs(); // Reload NFTs after deep scan
        setScanStatus('complete');
        
        // Record this scan time
        const now = Date.now();
        walletScanTimes.set(walletAddress, now);
        setLastScanTime(new Date(now));
      } else {
        setScanStatus('error');
      }
    } catch (error) {
      console.error('Error during deep scan:', error);
      setScanStatus('error');
    } finally {
      setIsScanning(false);
    }
  };
  
  const shortenAddress = (address: string) => {
    return `${address.slice(0, 10)}...${address.slice(-10)}`;
  };
  
  if (!isOpen) return null;
  
  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <Title>Your Wallet</Title>
          <CloseButton onClick={onClose}>×</CloseButton>
        </ModalHeader>
        
        {publicKey ? (
          <>
            <WalletInfo>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <StatusBadge>Connected</StatusBadge>
                <ScanButton onClick={handleDeepScan} disabled={isScanning}>
                  {isScanning ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.3" />
                        <path 
                          d="M12 2a10 10 0 0 1 10 10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                          strokeLinecap="round"
                        >
                          <animateTransform
                            attributeName="transform"
                            type="rotate"
                            from="0 12 12"
                            to="360 12 12"
                            dur="1s"
                            repeatCount="indefinite"
                          />
                        </path>
                      </svg>
                      <span>Scanning...</span>
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2"/>
                        <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Refresh NFTs</span>
                    </>
                  )}
                </ScanButton>
              </div>
              
              {lastScanTime && (
                <div style={{ 
                  fontSize: '12px', 
                  color: '#a0a0b0', 
                  textAlign: 'right',
                  marginTop: '4px'
                }}>
                  Last scan: {lastScanTime.toLocaleTimeString()}
                </div>
              )}
              
              {scanStatus === 'complete' && (
                <div style={{ 
                  padding: '6px', 
                  background: 'rgba(0,224,181,0.1)', 
                  color: '#00E0B5', 
                  borderRadius: '4px',
                  marginTop: '8px',
                  fontSize: '14px',
                  textAlign: 'center'
                }}>
                  Scan complete! NFT inventory updated.
                </div>
              )}
              
              {scanStatus === 'error' && (
                <div style={{ 
                  padding: '6px', 
                  background: 'rgba(255,93,93,0.1)', 
                  color: '#FF5D5D', 
                  borderRadius: '4px',
                  marginTop: '8px',
                  fontSize: '14px',
                  textAlign: 'center'
                }}>
                  Error scanning NFTs. Please try again.
                </div>
              )}
              
              <WalletAddress>
                {publicKey.toString()}
              </WalletAddress>
            </WalletInfo>
            
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ margin: 0 }}>Your NFTs</h3>
                <span style={{ color: '#777', fontSize: '14px' }}>{nfts.length} items</span>
              </div>
              
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ margin: '0 auto' }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.3" />
                    <path 
                      d="M12 2a10 10 0 0 1 10 10" 
                      stroke="currentColor" 
                      strokeWidth="4" 
                      fill="none"
                      strokeLinecap="round"
                    >
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0 12 12"
                        to="360 12 12"
                        dur="1s"
                        repeatCount="indefinite"
                      />
                    </path>
                  </svg>
                  <p>Loading NFTs...</p>
                </div>
              ) : nfts.length > 0 ? (
                <NFTGrid>
                  {nfts.map((nft, index) => (
                    <div key={nft.address || `nft-${index}-${nft?.name?.replace(/\s+/g, '-') || 'unknown'}`} style={{ cursor: 'pointer' }}>
                      <div style={{
                        borderRadius: '12px',
                        overflow: 'hidden',
                        background: '#242627',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                      }}>
                        <div style={{ position: 'relative', paddingBottom: '100%' }}>
                          {nft.image ? (
                            <img 
                              src={fixImageUrl(nft.image, nft.address)}
                              alt={nft.name || 'NFT'}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                              onError={handleImageError}
                              data-mint-address={nft.address}
                            />
                          ) : (
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#181a1b',
                              color: '#aaa',
                              fontSize: '0.8rem',
                              textAlign: 'center',
                              padding: '8px'
                            }}>
                              {nft?.address && (
                                <span>
                                  {nft?.name || `Mint: ${typeof nft.address === 'string' ? nft.address.slice(0, 6) + '...' : 'Unknown'}`}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '12px' }}>
                          <p style={{ 
                            margin: 0, 
                            fontSize: '14px', 
                            fontWeight: '600', 
                            color: 'white',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {nft?.name || (nft?.address && typeof nft.address === 'string' ? `NFT ${nft.address.slice(0, 8)}...` : 'Unknown NFT')}
                          </p>
                          {nft.collection && (
                            <p style={{ 
                              margin: '4px 0 0 0', 
                              fontSize: '12px', 
                              color: 'rgba(255,255,255,0.6)'
                            }}>
                              {typeof nft.collection === 'string' 
                                ? (nft.symbol || nft.name?.split('#')[0]?.trim() || 'Unknown Collection')
                                : (nft.collection.name || 'Unknown Collection')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </NFTGrid>
              ) : (
                <EmptyState>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M9 14.5L11 16.5L15.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M8 2.5V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M16 2.5V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <p>No NFTs found in your wallet</p>
                  <p style={{ fontSize: '12px', marginTop: '4px' }}>Use Deep Scan to find all your NFTs</p>
                </EmptyState>
              )}
            </div>
          </>
        ) : (
          <EmptyState>
            <p>Please connect your wallet to view your NFTs</p>
          </EmptyState>
        )}
      </ModalContent>
    </ModalOverlay>
  );
};

export default WalletModal; 