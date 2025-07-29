'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { NFTService } from '@/services/nft';
import { CollectionService } from '@/services/collection';
import { NFTMetadata } from '@/types/nft';
import { CollectionSearchResult } from '@/types/trade';
import { useWallet } from '@solana/wallet-adapter-react';

// Smart search types
type SearchResultType = 'nft' | 'collection';

interface SearchSuggestion {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  imageUrl?: string;
  data: NFTMetadata | CollectionSearchResult;
}

interface UnifiedSearchBarProps {
  onResult: (result: SearchSuggestion) => void;
  placeholder?: string;
  disabled?: boolean;
}

const SearchContainer = styled.div`
  position: relative;
  width: 100%;
  max-width: 700px;
  margin: 0 auto;
  
  /* DEBUG: Ensure dropdown can be visible */
  overflow: visible !important;
  z-index: 10000;
`;

const SearchWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, 
    rgba(18, 20, 24, 0.95) 0%,
    rgba(24, 28, 36, 0.98) 100%
  );
  border: 2px solid transparent;
  border-radius: 24px;
  overflow: hidden;
  backdrop-filter: blur(20px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);

  &:focus-within {
    border-color: rgba(103, 69, 255, 0.6);
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(103, 69, 255, 0.3),
      0 0 40px rgba(103, 69, 255, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    transform: translateY(-2px);
  }

  &:hover:not(:focus-within) {
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }
`;

const SearchInput = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  padding: 1rem 1.5rem;
  color: white;
  font-size: 1.1rem;
  font-weight: 500;
  outline: none;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.4);
    font-weight: 400;
  }
  
  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const SearchIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 1.5rem;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.2s ease;
  
  svg {
    width: 20px;
    height: 20px;
  }
`;

const SearchTypeIndicator = styled.div<{ $type: SearchResultType | 'mixed' | '' }>`
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: all 0.2s ease;
  
  ${props => {
    switch (props.$type) {
      case 'nft':
        return `
          background: rgba(34, 197, 94, 0.2);
          color: rgb(34, 197, 94);
          border: 1px solid rgba(34, 197, 94, 0.3);
        `;
      case 'collection':
        return `
          background: rgba(59, 130, 246, 0.2);
          color: rgb(59, 130, 246);
          border: 1px solid rgba(59, 130, 246, 0.3);
        `;
      case 'mixed':
        return `
          background: rgba(168, 85, 247, 0.2);
          color: rgb(168, 85, 247);
          border: 1px solid rgba(168, 85, 247, 0.3);
        `;
      default:
        return `
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.2);
        `;
    }
  }}
`;

const SuggestionsDropdown = styled.div<{ $isVisible: boolean }>`
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: rgba(18, 20, 24, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  backdrop-filter: blur(20px);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
  z-index: 9999;
  max-height: 400px;
  overflow-y: auto;
  opacity: ${props => props.$isVisible ? 1 : 0};
  transform: translateY(${props => props.$isVisible ? 0 : '-8px'});
  pointer-events: ${props => props.$isVisible ? 'auto' : 'none'};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  /* Ensure proper visibility */
  ${props => props.$isVisible && `
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    transform: translateY(0) !important;
    pointer-events: auto !important;
  `}
`;

const SuggestionItem = styled.div<{ $isHighlighted: boolean }>`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;
  
  background: ${props => props.$isHighlighted ? 'rgba(103, 69, 255, 0.1)' : 'transparent'};
  
  &:hover {
    background: rgba(103, 69, 255, 0.1);
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

const SuggestionImage = styled.img`
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const SuggestionContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const SuggestionTitle = styled.div`
  color: white;
  font-weight: 600;
  font-size: 0.95rem;
`;

const SuggestionSubtitle = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.8rem;
`;

const SuggestionType = styled.div<{ $type: SearchResultType }>`
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  ${props => props.$type === 'nft' ? `
    background: rgba(34, 197, 94, 0.2);
    color: rgb(34, 197, 94);
  ` : `
    background: rgba(59, 130, 246, 0.2);
    color: rgb(59, 130, 246);
  `}
`;

const LoadingIndicator = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: rgba(255, 255, 255, 0.6);
  gap: 0.5rem;
  
  &::after {
    content: '';
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: rgba(103, 69, 255, 0.8);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const EmptyState = styled.div`
  padding: 2rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9rem;
`;

export const UnifiedSearchBar: React.FC<UnifiedSearchBarProps> = ({
  onResult,
  placeholder = "Search NFTs by address or collections by name...",
  disabled = false
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searchType, setSearchType] = useState<SearchResultType | 'mixed' | ''>('');
  
  const { connected } = useWallet();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const nftService = NFTService.getInstance();
  const collectionService = CollectionService.getInstance();

  // Debug logging for dropdown visibility
  useEffect(() => {
    console.log('UnifiedSearchBar: Dropdown visibility changed to:', isDropdownVisible, 'Suggestions count:', suggestions.length);
  }, [isDropdownVisible, suggestions.length]);

  // Detect search type based on input
  const detectSearchType = (input: string): SearchResultType | 'mixed' | '' => {
    if (!input.trim()) return '';
    
    // Check if it looks like a Solana address (base58, ~32-44 characters)
    const solanaAddressPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (solanaAddressPattern.test(input.trim())) {
      return 'nft';
    }
    
    // Otherwise assume collection search
    return 'collection';
  };

  // Debounced search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setIsDropdownVisible(false);
      return;
    }

    setIsLoading(true);
    const detectedType = detectSearchType(searchQuery);
    setSearchType(detectedType);
    
    console.log('UnifiedSearchBar: Performing search for:', searchQuery, 'Type:', detectedType, 'Connected:', connected);
    
    try {
      const suggestions: SearchSuggestion[] = [];
      
      if (detectedType === 'nft') {
        // Search for NFT by address
        try {
          const nft = await nftService.getNFTMetadata(searchQuery.trim());
          if (nft) {
            suggestions.push({
              id: nft.address,
              type: 'nft',
              title: nft.name || 'Unknown NFT',
              subtitle: `${nft.address.slice(0, 8)}...${nft.address.slice(-8)}`,
              imageUrl: nft.image,
              data: nft
            });
          }
        } catch (error) {
          console.log('NFT search failed:', error);
        }
      } else if (detectedType === 'collection') {
        // Search for collections by name
        try {
          const collections = await collectionService.searchCollections(searchQuery, {
            limit: 8,
            verified: undefined
          });
          
          collections.forEach((result: any) => {
            // Backend returns { collection: CollectionMetadata, relevanceScore, matchType }
            // But frontend expects CollectionSearchResult directly
            const collection = result.collection || result; // Handle both formats
            
            console.log('UnifiedSearchBar: Collection data:', {
              id: collection.id,
              name: collection.name,
              nftCount: collection.nftCount,
              floorPrice: collection.floorPrice,
              volume24h: collection.volume24h,
              verified: collection.verified,
              image: collection.image
            });
            
            // Fix display of incorrect data with better validation
            const nftCount = collection.nftCount && collection.nftCount > 0 ? collection.nftCount.toLocaleString() : 'N/A';
            const floorPrice = collection.floorPrice && collection.floorPrice > 0 && collection.floorPrice < 1000000
              ? collection.floorPrice.toFixed(3) 
              : 'N/A';
            const volume = collection.volume24h && collection.volume24h > 0 && collection.volume24h < 1000000
              ? ` • Vol: ${collection.volume24h.toFixed(1)} SOL`
              : '';
              
            suggestions.push({
              id: collection.id,
              type: 'collection',
              title: collection.name,
              subtitle: `${nftCount} NFTs • Floor: ${floorPrice} SOL${volume}`,
              imageUrl: collection.image,
              data: {
                id: collection.id,
                name: collection.name,
                description: collection.description,
                verified: collection.verified,
                nftCount: collection.nftCount,
                floorPrice: collection.floorPrice,
                volume24h: collection.volume24h,
                imageUrl: collection.image
              }
            });
          });
        } catch (error) {
          console.log('Collection search failed:', error);
        }
      }
      
      console.log('UnifiedSearchBar: Found', suggestions.length, 'suggestions:', suggestions);
      
      // Remove duplicates based on ID
      const uniqueSuggestions = suggestions.filter((suggestion, index, self) => 
        index === self.findIndex(s => s.id === suggestion.id)
      );
      
      console.log('UnifiedSearchBar: After deduplication:', uniqueSuggestions.length, 'unique suggestions');
      setSuggestions(uniqueSuggestions);
      const shouldShowDropdown = uniqueSuggestions.length > 0;
      console.log('UnifiedSearchBar: Setting dropdown visible:', shouldShowDropdown);
      setIsDropdownVisible(shouldShowDropdown);
      setHighlightedIndex(-1);
      
    } catch (error) {
      console.error('Search error:', error);
      setSuggestions([]);
      setIsDropdownVisible(false);
    } finally {
      setIsLoading(false);
    }
  }, [nftService, collectionService]);

  // Debounce search input
  useEffect(() => {
    console.log('UnifiedSearchBar: Debounce effect triggered with query:', query);
    
    // Don't perform search for empty queries
    if (!query.trim()) {
      console.log('UnifiedSearchBar: Clearing debounce timer - empty query');
      setSuggestions([]);
      setIsDropdownVisible(false);
      setSearchType('');
      return;
    }
    
    const timer = setTimeout(() => {
      console.log('UnifiedSearchBar: Executing debounced search for:', query);
      performSearch(query);
    }, 300);

    return () => {
      console.log('UnifiedSearchBar: Clearing debounce timer');
      clearTimeout(timer);
    };
  }, [query, performSearch]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    console.log('UnifiedSearchBar: Input change:', newQuery);
    setQuery(newQuery);
    
    if (!newQuery.trim()) {
      console.log('UnifiedSearchBar: Clearing dropdown due to empty query');
      setSuggestions([]);
      setIsDropdownVisible(false);
      setSearchType('');
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownVisible || suggestions.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSuggestionClick(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsDropdownVisible(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle suggestion selection
  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    console.log('UnifiedSearchBar: Suggestion clicked:', suggestion);
    onResult(suggestion);
    setQuery('');
    setSuggestions([]);
    setIsDropdownVisible(false);
    setHighlightedIndex(-1);
    setSearchType('');
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        console.log('UnifiedSearchBar: Closing dropdown due to click outside');
        setIsDropdownVisible(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Default placeholder with fallback SVG
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

  return (
    <SearchContainer>
      <SearchWrapper>
        <SearchIcon>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </SearchIcon>
        
        <SearchInput
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Connect wallet to search..." : placeholder}
          disabled={disabled}
        />
        
        {searchType && (
          <SearchTypeIndicator $type={searchType}>
            {searchType === 'nft' ? 'NFT' : searchType === 'collection' ? 'Collection' : 'Mixed'}
          </SearchTypeIndicator>
        )}
      </SearchWrapper>

      <SuggestionsDropdown ref={dropdownRef} $isVisible={isDropdownVisible}>
        {isLoading ? (
          <LoadingIndicator>
            Searching...
          </LoadingIndicator>
        ) : suggestions.length > 0 ? (
          suggestions.map((suggestion, index) => (
            <SuggestionItem
              key={`${suggestion.id}-${index}`}
              $isHighlighted={index === highlightedIndex}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <SuggestionImage
                src={suggestion.imageUrl || defaultImageSrc}
                alt={suggestion.title}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.src !== defaultImageSrc) {
                    target.src = defaultImageSrc;
                  }
                }}
              />
              <SuggestionContent>
                <SuggestionTitle>{suggestion.title}</SuggestionTitle>
                <SuggestionSubtitle>{suggestion.subtitle}</SuggestionSubtitle>
              </SuggestionContent>
              <SuggestionType $type={suggestion.type}>
                {suggestion.type}
              </SuggestionType>
            </SuggestionItem>
          ))
        ) : query.trim() && !isLoading ? (
          <EmptyState>
            No results found for "{query}"
            {!connected && <div style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>Connect wallet to find trades</div>}
          </EmptyState>
        ) : null}
      </SuggestionsDropdown>
    </SearchContainer>
  );
};

export default UnifiedSearchBar; 