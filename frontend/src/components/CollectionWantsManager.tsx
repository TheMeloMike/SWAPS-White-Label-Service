'use client';

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { CollectionService } from '@/services/collection';
import { CollectionWant, CollectionSearchResult } from '@/types/trade';
import { useWallet } from '@solana/wallet-adapter-react';
import GlassmorphicCard from './common/GlassmorphicCard';
import EnhancedRippleButton from './common/EnhancedRippleButton';
import LoadingIndicator from './common/LoadingIndicator';
import CollectionSearch from './CollectionSearch';

const Container = styled(GlassmorphicCard)`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 800px;
  width: 100%;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
`;

const Title = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
`;

const AddSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
`;

const SectionTitle = styled.h3`
  font-size: 1.1rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
`;

const WantsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  width: 100%;
`;

const WantItem = styled(GlassmorphicCard)`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const CollectionImage = styled.img`
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.1);
`;

const WantInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const CollectionName = styled.div`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textPrimary};
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const VerifiedBadge = styled.span`
  color: #00ff00;
  font-size: 0.8rem;
`;

const WantDetails = styled.div`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const RemoveButton = styled(EnhancedRippleButton)`
  padding: 0.5rem;
  font-size: 0.8rem;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const EmptyStateIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  padding: 2rem;
`;

const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.colors.error};
  background: rgba(255, 0, 0, 0.1);
  border: 1px solid rgba(255, 0, 0, 0.2);
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
`;

const StatsContainer = styled.div`
  display: flex;
  gap: 2rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  flex-wrap: wrap;
`;

const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
`;

const StatValue = styled.div`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
`;

const StatLabel = styled.div`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const ToggleButton = styled(EnhancedRippleButton)<{ $isExpanded: boolean }>`
  transform: ${props => props.$isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'};
  transition: transform 0.2s ease;
`;

interface CollectionWantsManagerProps {
  className?: string;
}

export const CollectionWantsManager: React.FC<CollectionWantsManagerProps> = ({
  className
}) => {
  const [wants, setWants] = useState<CollectionWant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddSectionExpanded, setIsAddSectionExpanded] = useState(false);
  const [collectionsMetadata, setCollectionsMetadata] = useState<Map<string, CollectionSearchResult>>(new Map());
  
  const { publicKey, connected } = useWallet();
  const collectionService = CollectionService.getInstance();

  // Load collection wants on wallet connection
  useEffect(() => {
    if (connected && publicKey) {
      loadCollectionWants();
    } else {
      setWants([]);
      setCollectionsMetadata(new Map());
    }
  }, [connected, publicKey]);

  const loadCollectionWants = async () => {
    if (!publicKey) return;

    setIsLoading(true);
    setError(null);

    try {
      const walletWants = await collectionService.getWalletCollectionWants(publicKey.toString());
      setWants(walletWants);

      // Load metadata for each collection
      const metadataMap = new Map<string, CollectionSearchResult>();
      for (const want of walletWants) {
        try {
          const metadata = await collectionService.getCollectionMetadata(want.collectionId);
          if (metadata) {
            // Convert CollectionMetadata to CollectionSearchResult format
            metadataMap.set(want.collectionId, {
              id: metadata.id,
              name: metadata.name,
              description: metadata.description,
              verified: metadata.verified,
              nftCount: metadata.nftCount,
              floorPrice: metadata.floorPrice,
              volume24h: metadata.volume24h,
              imageUrl: metadata.imageUrl
            });
          }
        } catch (metaError) {
          console.warn(`Failed to load metadata for collection ${want.collectionId}:`, metaError);
        }
      }
      setCollectionsMetadata(metadataMap);

    } catch (err) {
      console.error('Error loading collection wants:', err);
      setError('Failed to load collection wants. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveWant = async (collectionId: string) => {
    if (!publicKey) return;

    try {
      const success = await collectionService.removeCollectionWant(publicKey.toString(), collectionId);
      
      if (success) {
        // Remove from local state
        setWants(prev => prev.filter(want => want.collectionId !== collectionId));
        setCollectionsMetadata(prev => {
          const newMap = new Map(prev);
          newMap.delete(collectionId);
          return newMap;
        });
      } else {
        setError('Failed to remove collection want. Please try again.');
      }
    } catch (err) {
      console.error('Error removing collection want:', err);
      setError('Failed to remove collection want. Please try again.');
    }
  };

  const handleCollectionAdded = (collection: CollectionSearchResult) => {
    // Refresh the wants list
    loadCollectionWants();
    
    // Collapse the add section
    setIsAddSectionExpanded(false);
  };

  const formatCreatedAt = (date: Date): string => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInHours < 24 * 7) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  if (!connected) {
    return (
      <Container className={className}>
        <EmptyState>
          <EmptyStateIcon>👛</EmptyStateIcon>
          <div>Connect your wallet to manage collection wants</div>
        </EmptyState>
      </Container>
    );
  }

  if (isLoading && wants.length === 0) {
    return (
      <Container className={className}>
        <LoadingContainer>
          <LoadingIndicator size="large" />
        </LoadingContainer>
      </Container>
    );
  }

  return (
    <Container className={className}>
      <Header>
        <Title>Collection Wants</Title>
        <EnhancedRippleButton
          size="small"
          onClick={() => setIsAddSectionExpanded(!isAddSectionExpanded)}
        >
          {isAddSectionExpanded ? 'Cancel' : 'Add Collection Want'}
        </EnhancedRippleButton>
      </Header>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      {wants.length > 0 && (
        <StatsContainer>
          <StatItem>
            <StatValue>{wants.length}</StatValue>
            <StatLabel>Collection Wants</StatLabel>
          </StatItem>
          <StatItem>
            <StatValue>
              {new Set(wants.map(w => collectionsMetadata.get(w.collectionId)?.verified).filter(Boolean)).size}
            </StatValue>
            <StatLabel>Verified Collections</StatLabel>
          </StatItem>
          <StatItem>
            <StatValue>
              {Array.from(collectionsMetadata.values())
                .reduce((sum, meta) => sum + (meta.floorPrice || 0), 0)
                .toFixed(2)}
            </StatValue>
            <StatLabel>Total Floor (SOL)</StatLabel>
          </StatItem>
        </StatsContainer>
      )}

      {isAddSectionExpanded && (
        <AddSection>
          <SectionTitle>Search and Add Collection Wants</SectionTitle>
          <CollectionSearch
            onCollectionAdded={handleCollectionAdded}
            placeholder="Search for collections to add to your wants..."
          />
        </AddSection>
      )}

      {wants.length === 0 && !isLoading ? (
        <EmptyState>
          <EmptyStateIcon>🎯</EmptyStateIcon>
          <div>No collection wants yet</div>
          <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Add collections you're interested in to find more trading opportunities
          </div>
        </EmptyState>
      ) : (
        <WantsGrid>
          {wants.map((want) => {
            const metadata = collectionsMetadata.get(want.collectionId);
            return (
              <WantItem key={want.collectionId}>
                <CollectionImage
                  src={metadata?.imageUrl || '/images/default-collection.png'}
                  alt={want.collectionName}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/default-collection.png';
                  }}
                />
                <WantInfo>
                  <CollectionName>
                    {want.collectionName}
                    {metadata?.verified && (
                      <VerifiedBadge title="Verified Collection">✓</VerifiedBadge>
                    )}
                  </CollectionName>
                  <WantDetails>
                    Added {formatCreatedAt(want.createdAt)}
                    {metadata && (
                      <>
                        <br />
                        Floor: {metadata.floorPrice.toFixed(3)} SOL
                        {want.preferences?.maxPrice && (
                          <>, Max: {want.preferences.maxPrice} SOL</>
                        )}
                      </>
                    )}
                  </WantDetails>
                </WantInfo>
                <RemoveButton
                  size="small"
                  variant="outline"
                  onClick={() => handleRemoveWant(want.collectionId)}
                >
                  Remove
                </RemoveButton>
              </WantItem>
            );
          })}
        </WantsGrid>
      )}
    </Container>
  );
};

export default CollectionWantsManager; 