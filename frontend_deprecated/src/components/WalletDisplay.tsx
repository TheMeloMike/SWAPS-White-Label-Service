import React, { useState } from 'react';
import styled from 'styled-components';
import { useWallet } from '@solana/wallet-adapter-react';
import { TradeService } from '@/services/trade';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  border-radius: 8px;
  margin-bottom: 16px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const WalletAddress = styled.h3`
  font-size: 16px;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
`;

const Button = styled.button`
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.primary};
  color: #FFFFFF;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  cursor: pointer;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};

  &:hover {
    background: ${({ theme }) => theme.colors.primaryDark};
  }

  &:disabled {
    background: ${({ theme }) => theme.colors.surfaceBorder};
    cursor: not-allowed;
  }
`;

const StatsContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
`;

const Stat = styled.div`
  display: flex;
  flex-direction: column;
`;

const StatLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const StatValue = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
`;

interface WalletDisplayProps {
  onRefresh?: () => void;
}

export const WalletDisplay: React.FC<WalletDisplayProps> = ({ onRefresh }) => {
  const { publicKey } = useWallet();
  const [isDeepScanning, setIsDeepScanning] = useState(false);
  const [nftCount, setNftCount] = useState<number | null>(null);

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const handleDeepScan = async () => {
    if (!publicKey) return;
    
    try {
      setIsDeepScanning(true);
      const walletAddress = publicKey.toString();
      
      const tradeService = TradeService.getInstance();
      const result = await tradeService.deepScanWallet(walletAddress);
      
      if (result.success) {
        setNftCount(result.walletState.total);
        if (onRefresh) onRefresh();
      }
    } catch (error) {
      console.error('Error during deep scan:', error);
    } finally {
      setIsDeepScanning(false);
    }
  };

  if (!publicKey) return null;

  return (
    <Container>
      <Header>
        <WalletAddress>{shortenAddress(publicKey.toString())}</WalletAddress>
        <Button onClick={handleDeepScan} disabled={isDeepScanning}>
          {isDeepScanning ? (
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
              Scanning...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2v3M2 12h3m14 0h3M12 19v3M7 7l2 2M15 7l-2 2M7 17l2-2M15 17l-2-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Deep Scan
            </>
          )}
        </Button>
      </Header>

      {nftCount !== null && (
        <StatsContainer>
          <Stat>
            <StatLabel>NFTs Found</StatLabel>
            <StatValue>{nftCount}</StatValue>
          </Stat>
        </StatsContainer>
      )}
    </Container>
  );
};

export default WalletDisplay; 