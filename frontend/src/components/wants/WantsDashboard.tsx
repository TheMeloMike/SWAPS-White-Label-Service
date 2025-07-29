'use client';

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import GlassmorphicCard from '../common/GlassmorphicCard';
import EnhancedRippleButton from '../common/EnhancedRippleButton';
import LoadingIndicator from '../common/LoadingIndicator';
import { TradeService } from '@/services/trade';
import { CollectionService } from '@/services/collection';

interface SpecificWant {
  nftAddress: string;
  nftName: string;
  nftImage?: string;
  collection: string;
  addedAt: Date;
  floorPrice?: number;
}

interface CollectionWant {
  collectionId: string;
  collectionName: string;
  collectionImage?: string;
  nftCount: number;
  floorPrice: number;
  addedAt: Date;
  preferences?: {
    maxPrice?: number;
    minRarity?: number;
  };
}

type WantType = 'all' | 'specific' | 'collection';

const Container = styled(GlassmorphicCard)`
  max-width: 1200px;
  width: 100%;
  padding: 2rem;
`;

const Header = styled.div`
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0 0 0.5rem 0;
`;

const Subtitle = styled.p`
  font-size: 1rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
`;

const TabContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 1rem;
`;

const Tab = styled.button<{ $active: boolean }>`
  background: none;
  border: none;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 500;
  color: ${props => props.$active ? props.theme.colors.primary : props.theme.colors.textSecondary};
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  
  &:hover {
    color: ${({ theme }) => theme.colors.textPrimary};
  }
  
  &::after {
    content: '';
    position: absolute;
    bottom: -1rem;
    left: 0;
    right: 0;
    height: 2px;
    background: ${({ theme }) => theme.colors.primary};
    transform: scaleX(${props => props.$active ? 1 : 0});
    transition: transform 0.2s ease;
  }
`;

const TabBadge = styled.span`
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.125rem 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
`;

const StatCard = styled(GlassmorphicCard)`
  padding: 1.5rem;
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 0.25rem;
`;

const StatLabel = styled.div`
  font-size: 0.875rem;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const WantsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
`;

const WantCard = styled(motion.div)`
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
  cursor: pointer;
  
  &:hover {
    transform: translateY(-2px);
    border-color: rgba(0, 255, 136, 0.3);
    box-shadow: 0 8px 24px rgba(0, 255, 136, 0.1);
  }
`;

const WantImage = styled.div<{ $src?: string }>`
  width: 100%;
  height: 200px;
  background: ${props => props.$src ? `url(${props.$src})` : 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))'};
  background-size: cover;
  background-position: center;
  position: relative;
`;

const WantTypeBadge = styled.div<{ $type: 'specific' | 'collection' }>`
  position: absolute;
  top: 1rem;
  right: 1rem;
  padding: 0.25rem 0.75rem;
  background: ${props => props.$type === 'collection' ? 'rgba(0, 255, 255, 0.2)' : 'rgba(255, 136, 0, 0.2)'};
  border: 1px solid ${props => props.$type === 'collection' ? 'rgba(0, 255, 255, 0.5)' : 'rgba(255, 136, 0, 0.5)'};
  color: ${props => props.$type === 'collection' ? '#00ffff' : '#ff8800'};
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  backdrop-filter: blur(10px);
`;

const WantInfo = styled.div`
  padding: 1.5rem;
`;

const WantName = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0 0 0.5rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const VerifiedBadge = styled.span`
  color: #00ff88;
  font-size: 0.875rem;
`;

const WantDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const DetailRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
`;

const DetailLabel = styled.span`
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const DetailValue = styled.span`
  color: ${({ theme }) => theme.colors.textPrimary};
  font-weight: 500;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 4rem 2rem;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const EmptyIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  padding: 4rem;
`;

export const WantsDashboard: React.FC = () => {
  const { publicKey, connected } = useWallet();
  const [activeTab, setActiveTab] = useState<WantType>('all');
  const [specificWants, setSpecificWants] = useState<SpecificWant[]>([]);
  const [collectionWants, setCollectionWants] = useState<CollectionWant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tradeService = TradeService.getInstance();
  const collectionService = CollectionService.getInstance();

  useEffect(() => {
    if (connected && publicKey) {
      loadWants();
    } else {
      setSpecificWants([]);
      setCollectionWants([]);
      setIsLoading(false);
    }
  }, [connected, publicKey]);

  const loadWants = async () => {
    if (!publicKey) return;

    setIsLoading(true);
    setError(null);

    try {
      // Load specific NFT wants from localStorage (since TradeService doesn't have getWalletState)
      const savedWants = localStorage.getItem(`${publicKey.toString()}_wanted_nfts`);
      const specificNFTWants: SpecificWant[] = [];
      
      if (savedWants) {
        try {
          const wantedNfts = JSON.parse(savedWants);
          if (Array.isArray(wantedNfts)) {
            for (const nftAddress of wantedNfts) {
              try {
                // Use a placeholder for metadata since we don't have a direct method
                specificNFTWants.push({
                  nftAddress,
                  nftName: `NFT ${nftAddress.substring(0, 8)}...`,
                  nftImage: undefined,
                  collection: 'Unknown Collection',
                  addedAt: new Date(),
                  floorPrice: undefined
                });
              } catch (err) {
                console.warn(`Failed to process NFT ${nftAddress}`);
              }
            }
          }
        } catch (err) {
          console.warn('Failed to parse saved wants');
        }
      }
      
      setSpecificWants(specificNFTWants);

      // Load collection wants
      const walletCollectionWants = await collectionService.getWalletCollectionWants(publicKey.toString());
      const enhancedCollectionWants: CollectionWant[] = [];
      
      for (const want of walletCollectionWants) {
        const metadata = await collectionService.getCollectionMetadata(want.collectionId);
        if (metadata) {
          enhancedCollectionWants.push({
            collectionId: want.collectionId,
            collectionName: want.collectionName,
            collectionImage: metadata.imageUrl,
            nftCount: metadata.nftCount,
            floorPrice: metadata.floorPrice,
            addedAt: want.createdAt,
            preferences: want.preferences
          });
        }
      }
      
      setCollectionWants(enhancedCollectionWants);

    } catch (err) {
      console.error('Error loading wants:', err);
      setError('Failed to load your wants. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveSpecificWant = async (nftAddress: string) => {
    if (!publicKey) return;
    
    try {
      // Remove from localStorage since we don't have a direct API method
      const savedWants = localStorage.getItem(`${publicKey.toString()}_wanted_nfts`);
      if (savedWants) {
        const wantedNfts = JSON.parse(savedWants);
        const updatedWants = wantedNfts.filter((nft: string) => nft !== nftAddress);
        localStorage.setItem(`${publicKey.toString()}_wanted_nfts`, JSON.stringify(updatedWants));
      }
      
      setSpecificWants(prev => prev.filter(w => w.nftAddress !== nftAddress));
    } catch (err) {
      console.error('Error removing specific want:', err);
    }
  };

  const handleRemoveCollectionWant = async (collectionId: string) => {
    if (!publicKey) return;
    
    try {
      await collectionService.removeCollectionWant(publicKey.toString(), collectionId);
      setCollectionWants(prev => prev.filter(w => w.collectionId !== collectionId));
    } catch (err) {
      console.error('Error removing collection want:', err);
    }
  };

  const filteredWants = () => {
    if (activeTab === 'specific') return { specific: specificWants, collection: [] };
    if (activeTab === 'collection') return { specific: [], collection: collectionWants };
    return { specific: specificWants, collection: collectionWants };
  };

  const { specific, collection } = filteredWants();
  const allWants = [...specific, ...collection];

  const calculateTotalValue = () => {
    const specificValue = specificWants.reduce((sum, w) => sum + (w.floorPrice || 0), 0);
    const collectionValue = collectionWants.reduce((sum, w) => sum + w.floorPrice, 0);
    return specificValue + collectionValue;
  };

  if (!connected) {
    return (
      <Container>
        <EmptyState>
          <EmptyIcon>👛</EmptyIcon>
          <h2>Connect Your Wallet</h2>
          <p>Connect your wallet to view and manage your NFT wants</p>
        </EmptyState>
      </Container>
    );
  }

  if (isLoading) {
    return (
      <Container>
        <LoadingContainer>
          <LoadingIndicator size="large" />
        </LoadingContainer>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <Title>My Wants</Title>
        <Subtitle>Manage your specific NFT and collection wants in one place</Subtitle>
      </Header>

      <StatsGrid>
        <StatCard>
          <StatValue>{specificWants.length + collectionWants.length}</StatValue>
          <StatLabel>Total Wants</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue>{specificWants.length}</StatValue>
          <StatLabel>Specific NFTs</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue>{collectionWants.length}</StatValue>
          <StatLabel>Collections</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue>{calculateTotalValue().toFixed(2)}</StatValue>
          <StatLabel>Total Floor Value (SOL)</StatLabel>
        </StatCard>
      </StatsGrid>

      <TabContainer>
        <Tab $active={activeTab === 'all'} onClick={() => setActiveTab('all')}>
          All Wants
          <TabBadge>{allWants.length}</TabBadge>
        </Tab>
        <Tab $active={activeTab === 'specific'} onClick={() => setActiveTab('specific')}>
          Specific NFTs
          <TabBadge>{specificWants.length}</TabBadge>
        </Tab>
        <Tab $active={activeTab === 'collection'} onClick={() => setActiveTab('collection')}>
          Collections
          <TabBadge>{collectionWants.length}</TabBadge>
        </Tab>
      </TabContainer>

      {error && (
        <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>
      )}

      {allWants.length === 0 ? (
        <EmptyState>
          <EmptyIcon>🎯</EmptyIcon>
          <h2>No Wants Yet</h2>
          <p>Start by searching for specific NFTs or collections you're interested in</p>
          <div style={{ marginTop: '1rem' }}>
            <EnhancedRippleButton>
              Add Your First Want
            </EnhancedRippleButton>
          </div>
        </EmptyState>
      ) : (
        <WantsGrid>
          <AnimatePresence mode="popLayout">
            {specific.map((want) => (
              <WantCard
                key={want.nftAddress}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <WantImage $src={want.nftImage}>
                  <WantTypeBadge $type="specific">Specific NFT</WantTypeBadge>
                </WantImage>
                <WantInfo>
                  <WantName>{want.nftName}</WantName>
                  <WantDetails>
                    <DetailRow>
                      <DetailLabel>Collection</DetailLabel>
                      <DetailValue>{want.collection}</DetailValue>
                    </DetailRow>
                    <DetailRow>
                      <DetailLabel>Floor Price</DetailLabel>
                      <DetailValue>{want.floorPrice?.toFixed(3) || 'N/A'} SOL</DetailValue>
                    </DetailRow>
                    <DetailRow>
                      <DetailLabel>Added</DetailLabel>
                      <DetailValue>{new Date(want.addedAt).toLocaleDateString()}</DetailValue>
                    </DetailRow>
                  </WantDetails>
                  <ActionButtons>
                    <EnhancedRippleButton size="small" variant="outline">
                      View Trades
                    </EnhancedRippleButton>
                    <EnhancedRippleButton 
                      size="small" 
                      variant="outline"
                      onClick={() => handleRemoveSpecificWant(want.nftAddress)}
                    >
                      Remove
                    </EnhancedRippleButton>
                  </ActionButtons>
                </WantInfo>
              </WantCard>
            ))}
            
            {collection.map((want) => (
              <WantCard
                key={want.collectionId}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <WantImage $src={want.collectionImage}>
                  <WantTypeBadge $type="collection">Collection</WantTypeBadge>
                </WantImage>
                <WantInfo>
                  <WantName>
                    {want.collectionName}
                    <VerifiedBadge>✓</VerifiedBadge>
                  </WantName>
                  <WantDetails>
                    <DetailRow>
                      <DetailLabel>Collection Size</DetailLabel>
                      <DetailValue>{want.nftCount.toLocaleString()} NFTs</DetailValue>
                    </DetailRow>
                    <DetailRow>
                      <DetailLabel>Floor Price</DetailLabel>
                      <DetailValue>{want.floorPrice.toFixed(3)} SOL</DetailValue>
                    </DetailRow>
                    {want.preferences?.maxPrice && (
                      <DetailRow>
                        <DetailLabel>Max Price</DetailLabel>
                        <DetailValue>{want.preferences.maxPrice} SOL</DetailValue>
                      </DetailRow>
                    )}
                    <DetailRow>
                      <DetailLabel>Added</DetailLabel>
                      <DetailValue>{new Date(want.addedAt).toLocaleDateString()}</DetailValue>
                    </DetailRow>
                  </WantDetails>
                  <ActionButtons>
                    <EnhancedRippleButton size="small" variant="outline">
                      View Options
                    </EnhancedRippleButton>
                    <EnhancedRippleButton 
                      size="small" 
                      variant="outline"
                      onClick={() => handleRemoveCollectionWant(want.collectionId)}
                    >
                      Remove
                    </EnhancedRippleButton>
                  </ActionButtons>
                </WantInfo>
              </WantCard>
            ))}
          </AnimatePresence>
        </WantsGrid>
      )}
    </Container>
  );
};

export default WantsDashboard; 