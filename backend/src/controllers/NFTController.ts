import { Request, Response } from 'express';
import { NFTService } from '../services/nft/NFTService';
import { WalletService } from '../services/trade/WalletService';
import { LoggingService } from '../utils/logging/LoggingService';

// Get a global logger for the file
const logger = LoggingService.getInstance().createLogger('NFTController');

export class NFTController {
  private logger = LoggingService.getInstance().createLogger('NFTController');
  private nftService: NFTService;
  private walletService: WalletService;
  
  constructor(nftService: NFTService, walletService: WalletService) {
    this.nftService = nftService;
    this.walletService = walletService;
  }
  
  // Helper function to fix Shadow Drive URLs
  private fixShadowDriveUrl(url: string, mintAddress: string, collectionId?: string): string {
    // Handle Shadow Drive URLs generically
    if (url.includes('shdw-drive.genesysgo.net')) {
      // Extract the storage account and filename
      const shadowMatch = url.match(/shdw-drive\.genesysgo\.net\/([^\/\s"']+)\/([^\/\s"']+)/i);
      if (shadowMatch && shadowMatch[1] && shadowMatch[2]) {
        const storageAccount = shadowMatch[1];
        let filename = shadowMatch[2];
        
        // Try to extract NFT number from filename or mintAddress
        const filenameMatch = filename.match(/^(\d+)\.\w+$/);
        let nftNumber: string | null = null;
        
        if (filenameMatch && filenameMatch[1]) {
          nftNumber = filenameMatch[1];
        } else {
          // Try extracting from url path
          const urlMatch = url.match(/\/(\d+)\.(?:png|jpg|jpeg|gif)/i);
          if (urlMatch && urlMatch[1]) {
            nftNumber = urlMatch[1];
          } 
          // Or try from mintAddress if it has a pattern like #1234
          else if (mintAddress.includes('#')) {
            const nameMatch = mintAddress.match(/#(\d+)/i);
            if (nameMatch && nameMatch[1]) {
              nftNumber = nameMatch[1];
            }
          }
        }
        
        // If we found a number, check if we should construct a new filename
        if (nftNumber && /^\d+$/.test(filename.replace(/\.\w+$/, ''))) {
          const extension = filename.match(/(\.\w+)$/)?.[1] || '.png';
          return `https://shdw-drive.genesysgo.net/${storageAccount}/${nftNumber}${extension}`;
        }
        
        return `https://shdw-drive.genesysgo.net/${storageAccount}/${filename}`;
      }
    }
    
    // Fix daswebs embedded URLs
    if (url.includes('daswebs.xyz') && url.includes('shdw-drive.genesysgo.net')) {
      const shadowMatch = url.match(/shdw-drive\.genesysgo\.net\/([^\/\s"']+)\/([^\/\s"']+)/i);
      if (shadowMatch && shadowMatch[1] && shadowMatch[2]) {
        return `https://shdw-drive.genesysgo.net/${shadowMatch[1]}/${shadowMatch[2]}`;
      }
    }
    
    return url;
  }

  /**
   * Get metadata for a specific NFT by address
   */
  public getNFTMetadata = async (req: Request, res: Response): Promise<void> => {
    const operation = this.logger.operation('getNFTMetadata');
    try {
      const nftAddress = req.params.nftAddress;
      
      if (!nftAddress) {
        res.status(400).json({ error: 'NFT address is required' });
        return;
      }
      
      // Check for refresh parameter
      const forceRefresh = req.query.forceRefresh === 'true' || req.query.refresh === 'true';
      
      // Log the request for debugging
      operation.info(`Getting metadata for NFT: ${nftAddress}${forceRefresh ? ' (force refresh)' : ''}`);
      
      // Get NFT metadata from Helius API
      const metadata = await this.nftService.getNFTMetadata(nftAddress, forceRefresh);
      
      // Apply fixes to image URLs for Shadow Drive hosted images
      if (metadata && metadata.image) {
        // Get collection ID if available
        let collectionId: string | undefined = undefined;
        
        if (metadata.collection) {
          if (typeof metadata.collection === 'string') {
            collectionId = metadata.collection;
          } else if (typeof metadata.collection === 'object') {
            // Try to get key, address, or any other identifier
            collectionId = (metadata.collection as any).key || 
                           (metadata.collection as any).address || 
                           (metadata.collection as any).id;
          }
        }
            
        metadata.image = this.fixShadowDriveUrl(metadata.image, nftAddress, collectionId);
      }
      
      operation.end();
      // Wrap the metadata in an object with a 'metadata' property to match frontend expectations
      res.json({ metadata });
    } catch (error) {
      operation.error('Error fetching NFT', { 
        error: error instanceof Error ? error.message : String(error),
        nftAddress: req.params.nftAddress
      });
      operation.end();
      res.status(500).json({ 
        error: 'Failed to fetch NFT metadata',
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  };

  /**
   * Get all NFTs owned by a specific wallet
   * Uses batched operations for better performance
   */
  public getUserNFTs = async (req: Request, res: Response): Promise<void> => {
    const operation = this.logger.operation('getUserNFTs');
    try {
      const walletAddress = req.params.walletAddress;
      
      if (!walletAddress) {
        res.status(400).json({ error: 'Wallet address is required' });
        return;
      }
      
      // Log the request for debugging
      operation.info(`Getting NFTs for wallet: ${walletAddress}`);
      
      // Directly call getOwnedNFTs from NFTService which should be more efficient
      const nfts = await this.nftService.getOwnedNFTs(walletAddress);
      
      // The getOwnedNFTs method in NFTService should ideally handle image URL fixing.
      // If it doesn't, we might need to add a loop here, but that's less ideal.
      // For now, assuming getOwnedNFTs returns metadata with potentially unfixed images.
      // Let's apply the fix here if necessary, but the long-term solution is for getOwnedNFTs to do it.
      if (nfts && Array.isArray(nfts)) {
        for (const nft of nfts) {
          if (nft && nft.image) {
            let collectionId: string | undefined = undefined;
            if (nft.collection) {
              if (typeof nft.collection === 'string') {
                collectionId = nft.collection;
              } else if (typeof nft.collection === 'object' && nft.collection !== null && 'name' in nft.collection) {
                // Assuming collection object has a name or id/address property
                collectionId = (nft.collection as any).address || (nft.collection as any).id || (nft.collection as any).name;
              }
            }
            nft.image = this.fixShadowDriveUrl(nft.image, nft.address, collectionId);
            // Note: ME Badging is also not part of the current getOwnedNFTs, would need enhancement there.
          }
        }
      }
      
      operation.info(`Completed metadata fetch for ${nfts.length} NFTs using getOwnedNFTs`);
      operation.end();
      
      // Format to match frontend expectations
      res.json({ success: true, nfts });
    } catch (error) {
      operation.error('Error fetching user NFTs', { 
        error: error instanceof Error ? error.message : String(error),
        walletAddress: req.params.walletAddress
      });
      operation.end();
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch user NFTs', 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Batch fetch metadata for multiple NFTs
   */
  public getBatchNFTMetadata = async (req: Request, res: Response): Promise<void> => {
    const operation = this.logger.operation('getBatchNFTMetadata');
    try {
      // Get mint addresses from the request body
      const { mintAddresses } = req.body;
      
      if (!mintAddresses || !Array.isArray(mintAddresses)) {
        operation.error('Invalid request body - mintAddresses array is required');
        res.status(400).json({ success: false, error: 'mintAddresses array is required' });
        return;
      }
      
      // Log the request size for debugging
      operation.info(`Batch fetching metadata for ${mintAddresses.length} NFTs`);
      
      // Use the NFT service to get metadata for all requested NFTs
      const nfts = await this.nftService.batchGetNFTMetadata(mintAddresses);
      
      // Apply fixes to image URLs for Shadow Drive hosted images
      if (nfts && Array.isArray(nfts)) {
        nfts.forEach((nft: any) => {
          if (nft && typeof nft === 'object' && nft.image) {
            // Get collection ID if available
            let collectionId: string | undefined = undefined;
            
            if (nft.collection) {
              if (typeof nft.collection === 'string') {
                collectionId = nft.collection;
              } else if (typeof nft.collection === 'object') {
                // Try multiple possible collection identifiers
                collectionId = nft.collection.key || 
                               nft.collection.address || 
                               nft.collection.id;
              }
            }
            
            nft.image = this.fixShadowDriveUrl(nft.image, 
                                               nft.address || '', 
                                               collectionId);
          }
        });
      }
      
      operation.end();
      // Format to match frontend expectations
      res.json({ success: true, nfts });
    } catch (error) {
      operation.error('Error fetching batch NFTs', { 
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch batch NFT metadata', 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
} 