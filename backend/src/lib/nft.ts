import { Helius } from 'helius-sdk';

export interface NFTMetadata {
  address: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  owner?: string;
  ownershipMismatch?: boolean;
  collection?: {
    name: string;
    address: string;
  };
  attributes?: Array<{
    trait_type: string;
    value: string;
  }>;
}

export class NFTService {
  private helius: Helius;
  private metadataCache: Map<string, NFTMetadata> = new Map();
  
  constructor() {
    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
      throw new Error('HELIUS_API_KEY environment variable is required');
    }
    this.helius = new Helius(apiKey);
  }
  
  /**
   * Gets NFT metadata by address with caching
   */
  async getNFTMetadata(nftAddress: string): Promise<NFTMetadata> {
    try {
      console.log(`Fetching NFT metadata for address: ${nftAddress}`);
      
      // Check cache first
      if (this.metadataCache.has(nftAddress)) {
        console.log(`Using cached metadata for ${nftAddress}`);
        return this.metadataCache.get(nftAddress)!;
      }
      
      console.log(`Fetching NFT metadata from Helius for: ${nftAddress}`);
      
      // Use direct fetch for more control
      const apiKey = process.env.HELIUS_API_KEY;
      const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `getAsset-${Date.now()}`,
          method: 'getAsset',
          params: {
            id: nftAddress,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Received Helius response:`, data);
      
      if (data.error) {
        throw new Error(`API error: ${data.error.message || JSON.stringify(data.error)}`);
      }
      
      // Extract metadata from response
      const asset = data.result;
      
      // Format image URL
      let imageUrl = '';
      if (asset.content?.links?.image) {
        imageUrl = asset.content.links.image;
        console.log(`Image URL for NFT ${nftAddress} (original): ${imageUrl}`);
        
        // Fix image URL if needed
        if (imageUrl.startsWith('ipfs://')) {
          imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
        } else if (imageUrl.startsWith('ar://')) {
          imageUrl = imageUrl.replace('ar://', 'https://arweave.net/');
        }
        
        // Use direct links rather than Helius CDN to avoid embedding URL issues
        console.log(`Image URL for NFT ${nftAddress} (fixed): ${imageUrl}`);
      }
      
      // Prepare collection info if available
      const collection = asset.grouping?.find((g: any) => g.group_key === 'collection');
      let collectionInfo = undefined;
      
      if (collection) {
        collectionInfo = {
          name: collection.collection_metadata?.name || 'Unknown Collection',
          address: collection.group_value || '',
        };
      }
      
      // Get owner information
      const ownerAddress = asset.ownership?.owner || null;
      
      // Create formatted metadata
      const metadata: NFTMetadata = {
        address: nftAddress,
        name: asset.content?.metadata?.name || `NFT ${nftAddress.slice(0, 8)}...`,
        symbol: asset.content?.metadata?.symbol || 'NFT',
        description: asset.content?.metadata?.description || '',
        image: imageUrl,
        owner: ownerAddress,
        collection: collectionInfo,
      };
      
      // Add attributes if available
      if (asset.content?.metadata?.attributes) {
        metadata.attributes = asset.content.metadata.attributes;
      }
      
      // Cache the metadata
      this.metadataCache.set(nftAddress, metadata);
      
      return metadata;
    } catch (error) {
      console.error(`Error getting NFT metadata for ${nftAddress}:`, error);
      
      // Return minimal fallback metadata
      return {
        address: nftAddress,
        name: `NFT ${nftAddress.slice(0, 8)}...`,
        symbol: 'NFT',
        description: 'Metadata unavailable',
        image: '',
      };
    }
  }
  
  /**
   * Fetches all NFTs owned by a wallet
   * @param walletAddress Wallet address to fetch NFTs for
   * @returns Array of NFT metadata objects
   */
  async fetchUserNFTs(walletAddress: string): Promise<NFTMetadata[]> {
    try {
      console.log(`Fetching NFTs for wallet: ${walletAddress}`);
      
      // Use direct fetch for more control
      const apiKey = process.env.HELIUS_API_KEY;
      const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `getAssetsByOwner-${Date.now()}`,
          method: 'getAssetsByOwner',
          params: {
            ownerAddress: walletAddress,
            page: 1,
            limit: 100,
            displayOptions: {
              showFungible: false,
              showNativeBalance: false,
            }
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(`API error: ${data.error.message || JSON.stringify(data.error)}`);
      }
      
      // Extract NFTs from response
      const nfts = data.result?.items || [];
      const nftAddresses = nfts.map((asset: any) => asset.id);
      
      console.log(`Found ${nftAddresses.length} NFTs for wallet ${walletAddress}`);
      
      // Get metadata for each NFT
      const nftMetadata: NFTMetadata[] = [];
      
      for (const nftAddress of nftAddresses) {
        try {
          const metadata = await this.getNFTMetadata(nftAddress);
          nftMetadata.push(metadata);
        } catch (err) {
          console.error(`Error fetching metadata for NFT ${nftAddress}:`, err);
        }
      }
      
      return nftMetadata;
    } catch (error) {
      console.error(`Error fetching NFTs for wallet ${walletAddress}:`, error);
      return [];
    }
  }
  
  /**
   * Fetches metadata for multiple NFTs by addresses
   * @param addresses Array of NFT addresses
   * @returns Map of NFT metadata by address
   */
  async fetchNFTsByAddresses(addresses: string[]): Promise<Map<string, NFTMetadata>> {
    console.log(`Fetching metadata for ${addresses.length} NFTs`);
    
    const result = new Map<string, NFTMetadata>();
    
    // Process in batches to avoid overloading the API
    const batchSize = 20;
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      
      // Process batch concurrently
      await Promise.all(
        batch.map(async (address) => {
          try {
            const metadata = await this.getNFTMetadata(address);
            result.set(address, metadata);
          } catch (error) {
            console.error(`Error fetching metadata for NFT ${address}:`, error);
          }
        })
      );
    }
    
    return result;
  }
} 