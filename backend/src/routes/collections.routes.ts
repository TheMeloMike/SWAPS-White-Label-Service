import express from 'express';
import { container } from '../di-container';
import { TradeController } from '../controllers/TradeController';
import { Request, Response } from 'express';
import { ITradeDiscoveryService } from '../types/services';

const router = express.Router();

// Lazy initialization function to get TradeController
function getTradeController(): TradeController {
  try {
    // Try to resolve from DI container first
    return container.resolve(TradeController);
  } catch (error) {
    // If DI fails, create manually with lazy service initialization
    const { TradeDiscoveryService } = require('../services/trade/TradeDiscoveryService');
    const { NFTService } = require('../services/nft/NFTService');
    const { WalletService } = require('../services/trade/WalletService');
    const { LoggingService } = require('../utils/logging/LoggingService');
    const { GlobalCacheService } = require('../services/cache/GlobalCacheService');
    const { Helius } = require('helius-sdk');
    const { KafkaIntegrationService } = require('../services/trade/KafkaIntegrationService');

    // Get services with proper error handling
    const nftService = NFTService.getInstance();
    const apiKey = process.env.HELIUS_API_KEY || '';
    const helius = new Helius(apiKey);
    const tradeDiscoveryService = TradeDiscoveryService.getInstance();
    const walletService = new WalletService(helius, new Map());
    const kafkaService = process.env.ENABLE_KAFKA === 'true' ? KafkaIntegrationService.getInstance() : undefined;
    const loggingService = new LoggingService();
    const cacheService = new GlobalCacheService();

    return new TradeController(
      tradeDiscoveryService as unknown as ITradeDiscoveryService,
      nftService,
      walletService,
      loggingService,
      cacheService,
      kafkaService
    );
  }
}

// Collection search endpoint
router.get('/search', (req: Request, res: Response) => {
  console.log(`[Collections Router] GET /search with query: ${req.query.q || req.query.query}`);
  try {
    const tradeController = getTradeController();
    return tradeController.searchCollections(req, res);
  } catch (error) {
    console.error('[Collections Router] Error in search:', error);
    return res.status(500).json({
      success: false,
      error: 'Collections service initialization failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Popular collections endpoint
router.get('/popular', (req: Request, res: Response) => {
  console.log(`[Collections Router] GET /popular with limit: ${req.query.limit}`);
  try {
    const tradeController = getTradeController();
    return tradeController.getPopularCollections(req, res);
  } catch (error) {
    console.error('[Collections Router] Error in popular:', error);
    return res.status(500).json({
      success: false,
      error: 'Collections service initialization failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Health check for collections service - must be before /:collectionId
router.get('/health', (req: Request, res: Response) => {
  res.json({ 
    success: true, 
    message: 'Collections API is healthy',
    timestamp: new Date().toISOString()
  });
});

// Future: Crawler stats endpoint can be added when needed

// Collection details endpoint - must be after other specific routes
router.get('/:collectionId', (req: Request, res: Response) => {
  console.log(`[Collections Router] GET /:collectionId with id: ${req.params.collectionId}`);
  try {
    const tradeController = getTradeController();
    return tradeController.getCollectionDetails(req, res);
  } catch (error) {
    console.error('[Collections Router] Error in details:', error);
    return res.status(500).json({
      success: false,
      error: 'Collections service initialization failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

console.log('[Init] Collections routes registered');

// Debug endpoint to force reload collection database
router.post('/reload', async (req: Request, res: Response) => {
  try {
    console.log('[Collections Router] POST /reload - Force reloading local collection database');
    const { LocalCollectionService } = require('../services/nft/LocalCollectionService');
    const localCollectionService = LocalCollectionService.getInstance();
    
    await localCollectionService.reloadDatabase();
    const stats = localCollectionService.getStats();
    
    res.json({
      success: true,
      message: 'Collection database reloaded successfully',
      stats
    });
  } catch (error) {
    console.error('[Collections Router] Error reloading database:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reload database',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 