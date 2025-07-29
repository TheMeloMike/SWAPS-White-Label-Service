'use client';

import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { CollectionService } from '@/services/collection';
import { CollectionSearchResult } from '@/types/trade';
import { useWallet } from '@solana/wallet-adapter-react';
import LoadingIndicator from './common/LoadingIndicator';
import GlassmorphicCard from './common/GlassmorphicCard';
import EnhancedRippleButton from './common/EnhancedRippleButton';

const SearchContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 600px;
`;

const SearchInputContainer = styled.div`
  position: relative;
  width: 100%;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: 0.9rem;
  outline: none;
  transition: all 0.2s ease;

  &:focus {
    border-color: rgba(103, 69, 255, 0.5);
    background: rgba(255, 255, 255, 0.08);
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

const SearchButton = styled.button`
  position: absolute;
  right: 0.25rem;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(103, 69, 255, 0.2);
  border: 1px solid rgba(103, 69, 255, 0.3);
  border-radius: 6px;
  color: ${({ theme }) => theme.colors.textPrimary};
  padding: 0.4rem 0.6rem;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(103, 69, 255, 0.3);
    border-color: rgba(103, 69, 255, 0.5);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SearchHint = styled.div`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textSecondary};
  text-align: center;
  margin-top: 0.25rem;
  opacity: 0.7;
`;

const ResultsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 400px;
  overflow-y: auto;
`;

const CollectionItem = styled(GlassmorphicCard)<{ $verified?: boolean }>`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid ${props => props.$verified ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)'};

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-1px);
  }
`;

const CollectionImage = styled.img`
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.1);
  
  &:not([src]) {
    background: linear-gradient(135deg, rgba(103, 69, 255, 0.3), rgba(255, 255, 255, 0.1));
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
`;

const CollectionInfo = styled.div`
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
  display: inline-flex;
  align-items: center;
  color: #00ff00;
  font-size: 0.8rem;
`;

const CollectionStats = styled.div`
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const StatItem = styled.span`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 2rem;
  color: ${({ theme }) => theme.colors.textSecondary};
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
  padding: 0.75rem;
  text-align: center;
  font-size: 0.9rem;
`;

const SuccessMessage = styled.div`
  color: #00ff00;
  background: rgba(0, 255, 0, 0.1);
  border: 1px solid rgba(0, 255, 0, 0.2);
  border-radius: 8px;
  padding: 0.75rem;
  text-align: center;
  font-size: 0.9rem;
`;

interface CollectionSearchProps {
  onCollectionAdded?: (collection: CollectionSearchResult) => void;
  placeholder?: string;
  showAddButton?: boolean;
}

export const CollectionSearch: React.FC<CollectionSearchProps> = ({
  onCollectionAdded,
  placeholder = "Search for collections (e.g., CryptoPunks, Bored Apes...)",
  showAddButton = true
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CollectionSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { publicKey, connected } = useWallet();

  const collectionService = CollectionService.getInstance();

  // Fallback placeholder SVG as data URL
  const defaultImageSrc = `data:image/svg+xml;base64,${btoa(`
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="8" fill="url(#gradient)"/>
      <path d="M20 18h8c2.2 0 4 1.8 4 4v4c0 2.2-1.8 4-4 4h-8c-2.2 0-4-1.8-4-4v-4c0-2.2 1.8-4 4-4z" fill="rgba(255,255,255,0.2)"/>
      <circle cx="22" cy="22" r="2" fill="rgba(255,255,255,0.4)"/>
      <path d="M16 26l4-4 2 2 6-6v8c0 1.1-.9 2-2 2h-8c-1.1 0-2-.9-2-2z" fill="rgba(255,255,255,0.3)"/>
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="rgba(103,69,255,0.4)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0.1)"/>
        </linearGradient>
      </defs>
    </svg>
  `)}`;

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const collections = await collectionService.searchCollections(searchQuery, {
        limit: 10,
        verified: undefined // Show both verified and unverified
      });
      
      setResults(collections);
      
      if (collections.length === 0) {
        setError(`No collections found for "${searchQuery}"`);
      }
    } catch (err) {
      console.error('Collection search error:', err);
      setError('Failed to search collections. Please try again.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [collectionService]);

  // Handle input change (just update the input, don't search)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    
    // Clear results and error when input is cleared
    if (!newQuery.trim()) {
      setResults([]);
      setError(null);
    }
  };

  // Handle key press - search only on Enter
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      performSearch(query);
    }
  };

  // Handle search button click
  const handleSearchClick = () => {
    performSearch(query);
  };

  // Handle collection selection
  const handleCollectionSelect = async (collection: CollectionSearchResult) => {
    if (!connected || !publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    if (!showAddButton) {
      // If not showing add button, just notify parent
      onCollectionAdded?.(collection);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const success = await collectionService.addCollectionWant(
        publicKey.toString(),
        collection.id
      );

      if (success) {
        setSuccessMessage(`Added "${collection.name}" to your collection wants!`);
        onCollectionAdded?.(collection);
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError('Failed to add collection want. Please try again.');
      }
    } catch (err) {
      console.error('Error adding collection want:', err);
      setError('Failed to add collection want. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // No cleanup needed since we're not using timeouts anymore

  const formatFloorPrice = (price: number): string => {
    if (price >= 1) return `${price.toFixed(2)} SOL`;
    if (price >= 0.01) return `${price.toFixed(3)} SOL`;
    return `${price.toFixed(4)} SOL`;
  };

  const formatVolume = (volume: number): string => {
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K SOL`;
    if (volume >= 1) return `${volume.toFixed(1)} SOL`;
    return `${volume.toFixed(2)} SOL`;
  };

  return (
    <SearchContainer>
      <SearchInputContainer>
        <SearchInput
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={!connected}
        />
        <SearchButton
          onClick={handleSearchClick}
          disabled={!connected || !query.trim() || isLoading}
          title="Search collections"
        >
          🔍
        </SearchButton>
      </SearchInputContainer>
      <SearchHint>
        Type a collection name and press Enter or click the search button
      </SearchHint>

      {error && <ErrorMessage>{error}</ErrorMessage>}
      {successMessage && <SuccessMessage>{successMessage}</SuccessMessage>}

      {isLoading && (
        <LoadingContainer>
          <LoadingIndicator size="medium" />
        </LoadingContainer>
      )}

      {!isLoading && results.length > 0 && (
        <ResultsContainer>
          {results.map((collection) => (
            <CollectionItem
              key={collection.id}
              $verified={collection.verified}
              onClick={() => handleCollectionSelect(collection)}
            >
              <CollectionImage
                src={collection.imageUrl || defaultImageSrc}
                alt={collection.name}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.src !== defaultImageSrc) {
                    target.src = defaultImageSrc;
                  }
                }}
              />
              <CollectionInfo>
                <CollectionName>
                  {collection.name}
                  {collection.verified && (
                    <VerifiedBadge title="Verified Collection">✓</VerifiedBadge>
                  )}
                </CollectionName>
                <CollectionStats>
                  <StatItem>
                    📊 {collection.nftCount.toLocaleString()} NFTs
                  </StatItem>
                  <StatItem>
                    💎 {formatFloorPrice(collection.floorPrice)}
                  </StatItem>
                  <StatItem>
                    📈 {formatVolume(collection.volume24h)} 24h
                  </StatItem>
                </CollectionStats>
              </CollectionInfo>
              {showAddButton && (
                <EnhancedRippleButton
                  size="small"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCollectionSelect(collection);
                  }}
                >
                  Add Want
                </EnhancedRippleButton>
              )}
            </CollectionItem>
          ))}
        </ResultsContainer>
      )}

      {!isLoading && query && results.length === 0 && !error && (
        <EmptyState>
          Start typing to search for collections...
        </EmptyState>
      )}
    </SearchContainer>
  );
};

export default CollectionSearch; 