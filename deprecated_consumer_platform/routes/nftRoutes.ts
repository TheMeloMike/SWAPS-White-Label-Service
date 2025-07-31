import { Router } from 'express';
import { NFTController } from '../controllers/NFTController';
import { NFTService } from '../services/nft/NFTService';
import { WalletService } from '../services/trade/WalletService';
import { Helius } from 'helius-sdk';
import { validateRequest } from '../middleware/validationMiddleware';
import { 
  nftAddressSchema, 
  walletAddressSchema, 
  batchNftMetadataSchema,
  nftPaginationSchema,
  floorPriceSchema,
  collectionSchema
} from '../middleware/nftValidation';
import { LoggingService } from '../utils/logging/LoggingService';

const logger = LoggingService.getInstance().createLogger('NFTRoutes');

// Setup router
const router = Router();

// Initialize services
const nftService = NFTService.getInstance();

// Initialize Helius for WalletService
const helius = new Helius(process.env.HELIUS_API_KEY || '');

// Create WalletService with empty manual registry for now
const walletService = new WalletService(helius, new Map());

// Create controller with both services
const nftController = new NFTController(nftService, walletService);

// Health check endpoint
router.get('/health', (_req, res) => {
  res.json({ message: 'SWAPS NFT Service Running' });
});

// Get metadata for multiple NFTs in batch - with validation
router.post('/batch', validateRequest(batchNftMetadataSchema), nftController.getBatchNFTMetadata);

// Get all NFTs for a wallet - with validation
router.get('/wallet/:walletAddress', validateRequest(walletAddressSchema, 'params'), nftController.getUserNFTs);

// Get NFT metadata by address - with validation
router.get('/:nftAddress', validateRequest(nftAddressSchema, 'params'), nftController.getNFTMetadata);

// Get NFTs with pagination - with validation
router.get('/list', validateRequest(nftPaginationSchema, 'query'), (req, res) => {
  // In a future implementation, this would call a controller method
  // Currently a placeholder for the route with validation
  res.json({ 
    message: 'NFT pagination endpoint ready for implementation',
    params: req.query
  });
});

// Get floor price for collection - with validation
router.get('/collection/:collectionAddress/floor', 
  validateRequest(floorPriceSchema, 'params'), 
  async (req, res) => {
    try {
      const { collectionAddress } = req.params;
      const floorPrice = await nftService.getCollectionFloorPrice(collectionAddress);
      res.json({ collectionAddress, floorPrice });
    } catch (error) {
      logger.error('Error fetching collection floor price', {
        collectionAddress: req.params.collectionAddress,
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ 
        error: 'Failed to fetch floor price',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router; 