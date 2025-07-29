'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { NFTMetadata, NFTService } from '@/services/nft';

export function useNFTTrading() {
  const { publicKey, connected } = useWallet();
  const [userNFTs, setUserNFTs] = useState<NFTMetadata[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected || !publicKey) {
      setUserNFTs([]);
      return;
    }

    const fetchUserNFTs = async () => {
      setIsIndexing(true);
      setError(null);
      
      try {
        const nftService = NFTService.getInstance();
        const nfts = await nftService.fetchUserNFTs(publicKey.toString());
        setUserNFTs(nfts);
      } catch (err) {
        console.error('Error fetching user NFTs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch user NFTs');
        setUserNFTs([]);
      } finally {
        setIsIndexing(false);
      }
    };

    fetchUserNFTs();
  }, [publicKey, connected]);

  return { userNFTs, isIndexing, error };
} 