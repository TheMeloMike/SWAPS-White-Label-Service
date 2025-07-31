import express from 'express';

const router = express.Router();

/**
 * Simple admin login endpoint for testing
 * POST /api/admin-simple/login
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === 'admin' && password === 'swaps-admin-2024') {
    res.json({
      success: true,
      token: 'simple-test-token',
      message: 'Simple admin login successful'
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

/**
 * Test endpoint
 * GET /api/admin-simple/test
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Simple admin routes are working'
  });
});

/**
 * Debug endpoint to rebuild wantedNfts mapping
 * POST /api/admin-simple/rebuild-mapping
 */
router.post('/rebuild-mapping', async (req, res) => {
  try {
    const { TradeDiscoveryService } = await import('../services/trade/TradeDiscoveryService');
    const tradeService = TradeDiscoveryService.getInstance();
    
    await tradeService.forceRebuildWantedNftsMapping();
    
    res.json({
      success: true,
      message: 'WantedNfts mapping rebuilt successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 