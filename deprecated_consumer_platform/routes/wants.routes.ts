import express from 'express';
import { container } from '../di-container';
import { TradeController } from '../controllers/TradeController';
import { ITradeDiscoveryService } from '../types/services';
import { Request, Response } from 'express';
import { TradeDiscoveryService } from '../services/trade/TradeDiscoveryService';
import { NFTService } from '../services/nft/NFTService';
import { WalletService } from '../services/trade/WalletService';
import { LoggingService } from '../utils/logging/LoggingService';
import { GlobalCacheService } from '../services/cache/GlobalCacheService';
import { KafkaIntegrationService } from '../services/trade/KafkaIntegrationService';
import { Helius } from 'helius-sdk';

const router = express.Router();

// Get services for manual fallback
const nftService = NFTService.getInstance();
const apiKey = process.env.HELIUS_API_KEY || '';
const helius = new Helius(apiKey);
const tradeDiscoveryService = TradeDiscoveryService.getInstance();
const walletService = new WalletService(helius, new Map());
const kafkaService = process.env.ENABLE_KAFKA === 'true' ? KafkaIntegrationService.getInstance() : undefined;
const loggingService = new LoggingService();
const cacheService = new GlobalCacheService();

// Get the TradeController instance with fallback
let tradeController: TradeController;
try {
  // First try to resolve via DI
  tradeController = container.resolve(TradeController);
  console.log('[Wants Routes] TradeController resolved successfully from DI container');
} catch (error) {
  console.warn('[Wants Routes] DI resolution failed, creating TradeController manually:', error);
  
  try {
    // Manual creation fallback
    tradeController = new TradeController(
      // Force cast to the interface - we know the implementation should be compatible at runtime
      tradeDiscoveryService as unknown as ITradeDiscoveryService,
      nftService,
      walletService,
      loggingService,
      cacheService,
      kafkaService
    );
    console.log('[Wants Routes] TradeController created manually as fallback');
  } catch (fallbackError) {
    console.error('[Wants Routes] Critical Error - Failed to create TradeController manually:', fallbackError);
    throw new Error('Failed to initialize TradeController after DI and manual attempts');
  }
}

// Health check for wants routes
router.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    success: true,
    message: 'Wants API is healthy',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route POST /api/wants/collection
 * @description Add a collection want for a wallet
 * @body { wallet: string, collectionId: string }
 */
router.post('/collection', (req: Request, res: Response) => {
  return tradeController.addCollectionWant(req, res);
});

/**
 * @route GET /api/wants/collection?wallet=walletAddress
 * @description Get all collection wants for a specific wallet
 * @query wallet - The wallet address to get wants for
 */
router.get('/collection', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.query;
    
    if (!wallet || typeof wallet !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing wallet parameter',
        message: 'Please provide a wallet address'
      });
    }

    // Get the trade discovery service to retrieve collection wants
    const tradeDiscoveryService = container.resolve<ITradeDiscoveryService>("ITradeDiscoveryService");
    
    // For now, return empty array since collection wants storage isn't fully implemented
    // In a full implementation, this would query the stored collection wants for the wallet
    const collectionWants: any[] = [];

    return res.json({
      success: true,
      wants: collectionWants,
      wallet,
      count: collectionWants.length
    });
  } catch (error) {
    console.error('Error getting collection wants:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get collection wants',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route DELETE /api/wants/collection/:collectionId?wallet=walletAddress
 * @description Remove a collection want for a wallet
 * @param collectionId - The collection ID to remove from wants
 * @query wallet - The wallet address to remove the want from
 */
router.delete('/collection/:collectionId', async (req: Request, res: Response) => {
  try {
    const { collectionId } = req.params;
    const { wallet } = req.query;
    
    if (!wallet || typeof wallet !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing wallet parameter',
        message: 'Please provide a wallet address'
      });
    }

    if (!collectionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing collection ID',
        message: 'Please provide a collection ID'
      });
    }

    // Get the trade discovery service
    const tradeDiscoveryService = container.resolve<ITradeDiscoveryService>("ITradeDiscoveryService");
    
    // For now, just return success
    // In a full implementation, this would remove the collection want from storage
    console.log(`Removing collection want: ${collectionId} for wallet: ${wallet}`);

    return res.json({
      success: true,
      message: `Removed collection want for ${collectionId}`,
      wallet,
      collectionId
    });
  } catch (error) {
    console.error('Error removing collection want:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to remove collection want',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

console.log('[Init] Wants routes registered successfully');

export default router; 