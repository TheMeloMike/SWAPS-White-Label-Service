'use client';

import { useMemo } from 'react';
import { NFTMetadata } from '@/types/nft';

/**
 * Hook to sort NFTs by different criteria
 */
export function useSortNFTs(nfts: NFTMetadata[], sortOption: string): NFTMetadata[] {
  return useMemo(() => {
    if (!nfts || nfts.length === 0) {
      return [];
    }

    const sortedNFTs = [...nfts];

    switch (sortOption) {
      case 'collection':
        // Sort by collection name
        return sortedNFTs.sort((a, b) => {
          // Handle collection field which can be string or object
          const collectionA = typeof a.collection === 'string' 
            ? a.collection 
            : a.collection?.name || '';
          const collectionB = typeof b.collection === 'string'
            ? b.collection
            : b.collection?.name || '';
          
          return collectionA.localeCompare(collectionB);
        });

      case 'name':
        // Sort by NFT name
        return sortedNFTs.sort((a, b) => {
          const nameA = a.name || '';
          const nameB = b.name || '';
          return nameA.localeCompare(nameB);
        });

      case 'recent':
        // Sort by recently added (assuming newer NFTs have higher createdAt values)
        return sortedNFTs.sort((a, b) => {
          const timeA = a.createdAt || 0;
          const timeB = b.createdAt || 0;
          return timeB - timeA;
        });

      case 'price':
        // Sort by floor price (highest to lowest)
        return sortedNFTs.sort((a, b) => {
          const priceA = a.floorPrice || 0;
          const priceB = b.floorPrice || 0;
          return priceB - priceA;
        });

      default:
        return sortedNFTs;
    }
  }, [nfts, sortOption]);
} 