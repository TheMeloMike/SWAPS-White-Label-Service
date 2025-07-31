import { Router } from 'express';
import { CollectionConfigService } from '../services/trade/CollectionConfigService';
import { CollectionMonitoringService } from '../services/trade/CollectionMonitoringService';
import { CollectionValidationService } from '../services/trade/CollectionValidationService';
import { LocalCollectionService } from '../services/nft/LocalCollectionService';
import { TradeDiscoveryService } from '../services/trade/TradeDiscoveryService';

const router = Router();

// Initialize services
const configService = CollectionConfigService.getInstance();
const monitoringService = CollectionMonitoringService.getInstance();
const validationService = CollectionValidationService.getInstance();
const localCollectionService = LocalCollectionService.getInstance();
const tradeDiscoveryService = TradeDiscoveryService.getInstance();

/**
 * GET /api/collections/health
 * Get overall collection system health
 */
router.get('/health', async (req, res) => {
  try {
    const systemHealth = monitoringService.getSystemHealth();
    const config = configService.getConfig();
    const stats = configService.getSystemStats();
    
    res.json({
      status: systemHealth.healthy ? 'healthy' : 'degraded',
      enabled: config.enabled,
      health: systemHealth,
      statistics: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get collection health',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/collections/config
 * Get current collection configuration
 */
router.get('/config', async (req, res) => {
  try {
    const config = configService.getConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/collections/config
 * Update collection configuration (admin only)
 */
router.put('/config', async (req, res) => {
  try {
    // In production, add authentication/authorization here
    const updates = req.body;
    configService.updateConfig(updates);
    
    res.json({
      success: true,
      config: configService.getConfig()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/collections/:collectionId/health
 * Get health status for a specific collection
 */
router.get('/:collectionId/health', async (req, res) => {
  try {
    const { collectionId } = req.params;
    const health = monitoringService.getCollectionHealth(collectionId);
    const analytics = configService.getCollectionAnalytics(collectionId);
    
    res.json({
      collectionId,
      health,
      analytics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get collection health',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/collections/:collectionId/nfts
 * Get NFTs in a collection (with pagination and filtering)
 */
router.get('/:collectionId/nfts', async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { available_only, limit = '100', offset = '0' } = req.query;
    
    // Get all NFTs in collection
    const allNFTs = await localCollectionService.getNFTsInCollection(collectionId);
    
    // Apply pagination
    const startIdx = parseInt(offset as string);
    const endIdx = startIdx + parseInt(limit as string);
    const paginatedNFTs = allNFTs.slice(startIdx, endIdx);
    
    res.json({
      collectionId,
      total: allNFTs.length,
      limit: parseInt(limit as string),
      offset: startIdx,
      nfts: paginatedNFTs,
      hasMore: endIdx < allNFTs.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get collection NFTs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/collections/:collectionId/validate
 * Validate a collection want for a wallet
 */
router.post('/:collectionId/validate', async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({
        error: 'walletAddress is required'
      });
    }
    
    // Get wallet state
    const walletState = await tradeDiscoveryService.updateWalletState(walletAddress);
    
    // Validate the collection want
    const validation = await validationService.validateCollectionWant(
      walletAddress,
      collectionId,
      walletState
    );
    
    res.json({
      collectionId,
      walletAddress,
      validation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to validate collection want',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/collections/search
 * Search for collections
 */
router.get('/search', async (req, res) => {
  try {
    const { q, limit = '10' } = req.query;
    
    if (!q) {
      return res.status(400).json({
        error: 'Search query (q) is required'
      });
    }
    
    const results = await localCollectionService.searchCollections(
      q as string,
      parseInt(limit as string)
    );
    
    res.json({
      query: q,
      results,
      count: results.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to search collections',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/collections/stats
 * Get collection system statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const systemStats = configService.getSystemStats();
    const localStats = localCollectionService.getStats();
    const validationStats = validationService.getValidationStats();
    const collectionDbStats = localCollectionService.getCollectionStats();
    
    res.json({
      system: systemStats,
      local: localStats,
      validation: validationStats,
      database: collectionDbStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/collections/top
 * Get top collections by popularity
 */
router.get('/top', async (req, res) => {
  try {
    const { limit = '10' } = req.query;
    const topCollections = configService.getTopCollections(parseInt(limit as string));
    
    res.json({
      collections: topCollections,
      count: topCollections.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get top collections',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/collections/metrics
 * Export metrics for external monitoring
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = monitoringService.exportMetrics();
    
    // Return in Prometheus format if requested
    const format = req.query.format;
    if (format === 'prometheus') {
      // Convert to Prometheus format
      let prometheusMetrics = '';
      prometheusMetrics += `# HELP collection_health_status Collection system health status (1=healthy, 0=degraded)\n`;
      prometheusMetrics += `collection_health_status ${metrics.health.status === 'healthy' ? 1 : 0}\n`;
      prometheusMetrics += `# HELP collection_total_issues Total number of collection issues\n`;
      prometheusMetrics += `collection_total_issues ${metrics.health.issues}\n`;
      prometheusMetrics += `# HELP collection_expansions_total Total number of collection expansions\n`;
      prometheusMetrics += `collection_expansions_total ${metrics.performance.totalExpansions}\n`;
      prometheusMetrics += `# HELP collection_avg_expansion_time Average expansion time in milliseconds\n`;
      prometheusMetrics += `collection_avg_expansion_time ${metrics.performance.averageExpansionTime}\n`;
      
      res.type('text/plain');
      res.send(prometheusMetrics);
    } else {
      res.json(metrics);
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to export metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/collections/clear-cache
 * Clear all collection caches (admin only)
 */
router.post('/clear-cache', async (req, res) => {
  try {
    // In production, add authentication/authorization here
    localCollectionService.clearCache();
    validationService.clearCache();
    
    res.json({
      success: true,
      message: 'All collection caches cleared',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to clear caches',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 