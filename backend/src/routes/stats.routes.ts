import express from 'express';
import { Request, Response } from 'express';
import { LocalCollectionService } from '../services/nft/LocalCollectionService';

const router = express.Router();

// GET /api/stats/global
router.get('/global', async (req: Request, res: Response) => {
  try {
    // Get stats from various services
    const localCollectionService = LocalCollectionService.getInstance();
    const collectionStats = localCollectionService.getCollectionStats();
    
    // Return global stats in the format expected by frontend
    const globalStats = [
      {
        label: 'Total Collections',
        value: collectionStats.totalCollections.toLocaleString(),
        icon: 'database'
      },
      {
        label: 'NFTs Indexed',
        value: collectionStats.totalNFTsIndexed.toLocaleString(),
        icon: 'image'
      },
      {
        label: 'Collections with Floor Price',
        value: collectionStats.collectionsWithFloorPrice.toLocaleString(),
        icon: 'dollar-sign'
      },
      {
        label: 'Average Floor Price',
        value: `${collectionStats.averageFloorPrice.toFixed(2)} SOL`,
        icon: 'trending-up'
      }
    ];
    
    res.json(globalStats);
  } catch (error) {
    console.error('[Stats Routes] Error in /global:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch global stats'
    });
  }
});

// GET /api/stats/metrics
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = {
      tradeVolume24h: 0, // Will be populated when trades are executed
      activeTraders: 0,
      averageTradeSize: 0,
      successRate: 100,
      popularTradePairs: []
    };
    
    res.json(metrics);
  } catch (error) {
    console.error('[Stats Routes] Error in /metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics'
    });
  }
});

// GET /api/stats/collections
router.get('/collections', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const localCollectionService = LocalCollectionService.getInstance();
    
    // Get all collections and sort by floor price to get "popular" ones
    const allCollections = localCollectionService.getAllCollections();
    const sortedCollections = allCollections
      .filter(col => col.floorPrice && col.floorPrice > 0)
      .sort((a, b) => (b.floorPrice || 0) - (a.floorPrice || 0))
      .slice(0, limit);
    
    // Format for frontend
    const formattedCollections = sortedCollections.map(col => ({
      id: col.id,
      name: col.name,
      symbol: col.symbol || '',
      imageUri: col.image || '',
      floorPrice: col.floorPrice || 0,
      volume24h: col.volume24h || 0,
      items: col.totalSupply || 0,
      holders: 0 // Not available in current data
    }));
    
    res.json(formattedCollections);
  } catch (error) {
    console.error('[Stats Routes] Error in /collections:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch collections stats'
    });
  }
});

// GET /api/stats/activity
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Return empty activity for now (will be populated when trades occur)
    const activity: any[] = [];
    
    res.json(activity);
  } catch (error) {
    console.error('[Stats Routes] Error in /activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity'
    });
  }
});

// GET /api/stats/user/:walletAddress
router.get('/user/:walletAddress', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    
    // Return user stats (will be populated based on actual user activity)
    const userStats = {
      totalTradesExecuted: 0,
      totalNFTsTraded: 0,
      successRate: 100,
      totalVolume: 0,
      favoriteCollections: [],
      tradeHistory: []
    };
    
    res.json(userStats);
  } catch (error) {
    console.error('[Stats Routes] Error in /user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user stats'
    });
  }
});

console.log('[Init] Stats routes registered');

export default router; 