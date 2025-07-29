// Add a very clear debugging log at the top of the file
console.log('[CRITICAL-DEBUG] trending.routes.ts module is being loaded');

import express from 'express';
import { container } from '../di-container';
import { TrendingController } from '../controllers/TrendingController';
import { TrendingService } from '../services/TrendingService';
import { LoggingService } from '../utils/logging/LoggingService';
import { TradeDiscoveryService } from '../services/trade/TradeDiscoveryService';
import { NFTService } from '../services/nft/NFTService';
import { GlobalCacheService } from '../services/cache/GlobalCacheService';

console.log('[Init] Trending routes module loaded'); // Diagnostic log

const router = express.Router();

// Try to resolve the controller from the DI container or create it manually if that fails
let trendingController: TrendingController;
try {
  // First try to resolve via DI
  trendingController = container.resolve(TrendingController);
  console.log('[Init] TrendingController resolved successfully from DI container');
} catch (error) {
  console.warn('[Warning] DI resolution failed for TrendingController, creating manually:', error);
  
  try {
    // Create required dependencies
    const loggingService = new LoggingService();
    const tradeDiscoveryService = TradeDiscoveryService.getInstance();
    const nftService = NFTService.getInstance();
    const cacheService = new GlobalCacheService();
    
    // Create TrendingService manually
    const trendingService = new TrendingService(
      tradeDiscoveryService as unknown as any, // Force cast because TS is complaining
      nftService,
      loggingService,
      cacheService
    );
    
    // Initialize trending service manually
    trendingService.initialize();
    
    // Create controller with the manually created service
    trendingController = new TrendingController(
      trendingService,
      loggingService
    );
    console.log('[Init] TrendingController created manually as fallback');
  } catch (fallbackError) {
    console.error('[Critical Error] Failed to create TrendingController manually:', fallbackError);
    throw new Error('Failed to initialize TrendingController after DI and manual attempts');
  }
}

/**
 * @route GET /api/trending
 * @description Fetches combined trending NFT data (top wanted, top from loops).
 * @access Public
 */
router.get('/', trendingController.getTrendingData);

// Add a health endpoint
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Trending service is operational' });
});

console.log('[Init] Trending routes registered:', router.stack.map(r => r.route?.path).filter(p => p)); // Diagnostic log

export default router; 