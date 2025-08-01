import { Router } from 'express';
import { WhiteLabelController } from '../controllers/WhiteLabelController';
import { TenantManagementService, TenantCreationRequest } from '../services/tenant/TenantManagementService';
import { PersistentTradeDiscoveryService } from '../services/trade/PersistentTradeDiscoveryService';
import { tenantAuth } from '../middleware/tenantAuth';
import { Request, Response } from 'express';
import { LoggingService } from '../utils/logging/LoggingService';
import { RateLimiters } from '../middleware/enhancedRateLimit';

const router = Router();
const logger = LoggingService.getInstance().createLogger('WhiteLabelAPI');

// Initialize services and controller
const whiteLabelController = new WhiteLabelController();
const tenantService = TenantManagementService.getInstance();
const persistentTradeService = PersistentTradeDiscoveryService.getInstance();
const universalIngestionService = require('../services/ingestion/UniversalNFTIngestionService').UniversalNFTIngestionService.getInstance();

/**
 * WHITE LABEL API ROUTES v1
 * 
 * Partner-facing API endpoints for real-time trade discovery
 */

// Health check endpoint for Render deployment
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'SWAPS White Label API is healthy',
    timestamp: new Date().toISOString(),
    service: 'SWAPS White Label API',
    version: '1.0.0'
  });
});

// ==========================================
// CORE TRADE DISCOVERY ENDPOINTS
// ==========================================

/**
 * POST /api/v1/discovery/trades
 * Main trade discovery endpoint - discovers trade loops for tenant inventory
 * 
 * Body:
 * {
 *   "wallets": [AbstractWallet[]],    // Optional: bulk inventory update
 *   "walletId": "string",             // Optional: get trades for specific wallet
 *   "mode": "informational|executable", // Response format
 *   "settings": {
 *     "maxResults": 100,
 *     "includeCollectionTrades": true,
 *     "blockchainFormat": "ethereum|solana|polygon|custom"
 *   }
 * }
 */
router.post('/discovery/trades', RateLimiters.enterprise, tenantAuth.authenticate, whiteLabelController.discoverTrades);

/**
 * POST /api/v1/inventory/submit
 * Submit NFT inventory for a wallet
 * 
 * Body:
 * {
 *   "walletId": "string",
 *   "nfts": [AbstractNFT[]]
 * }
 */
router.post('/inventory/submit', RateLimiters.standard, tenantAuth.authenticate, whiteLabelController.submitInventory);

/**
 * POST /api/v1/wants/submit
 * Submit want requests for a wallet
 * 
 * Body:
 * {
 *   "walletId": "string",
 *   "wantedNFTs": ["nft1", "nft2", ...]
 * }
 */
router.post('/wants/submit', RateLimiters.standard, tenantAuth.authenticate, whiteLabelController.submitWants);

/**
 * GET /api/v1/trades/active
 * Get active trade loops for tenant
 * 
 * Query params:
 * - walletId: specific wallet filter
 * - limit: max results (default 100)
 */
router.get('/trades/active', RateLimiters.enterprise, tenantAuth.authenticate, whiteLabelController.getActiveTrades);

/**
 * GET /api/v1/status
 * Get tenant status and usage statistics
 */
router.get('/status', tenantAuth.authenticate, whiteLabelController.getTenantStatus);

// ==========================================
// TENANT MANAGEMENT ENDPOINTS (ADMIN)
// ==========================================

/**
 * POST /api/v1/admin/tenants
 * Create a new tenant (admin only)
 */
router.post('/admin/tenants', tenantAuth.requireAdmin, async (req: Request, res: Response) => {
  const operation = logger.operation('createTenant');
  
  try {
    const request: TenantCreationRequest = req.body;
    
    // Validate request
    if (!request.name || !request.contactEmail) {
      res.status(400).json({
        error: 'Missing required fields: name, contactEmail'
      });
      operation.end();
      return;
    }
    
    const { tenant, apiKey } = await tenantService.createTenant(request);
    
    // Initialize tenant in persistent trade service
    await persistentTradeService.initializeTenant(tenant);
    
    operation.info('Tenant created and initialized', {
      tenantId: tenant.id,
      tenantName: tenant.name
    });
    
    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        apiKey: apiKey,
        settings: tenant.settings,
        metadata: tenant.metadata,
        createdAt: tenant.createdAt
      }
    });
    operation.end();
  } catch (error) {
    operation.error('Failed to create tenant', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      error: 'Failed to create tenant',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    operation.end();
  }
});

/**
 * GET /api/v1/admin/tenants
 * List all tenants (admin only)
 */
router.get('/admin/tenants', tenantAuth.requireAdmin, async (req: Request, res: Response) => {
  try {
    const tenants = await tenantService.listTenants();
    const systemStats = tenantService.getSystemStats();
    
    res.json({
      success: true,
      tenants: tenants.map(t => ({
        id: t.id,
        name: t.name,
        industry: t.metadata?.industry,
        blockchain: t.metadata?.blockchain,
        createdAt: t.createdAt,
        lastActive: t.lastActive
      })),
      systemStats
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to list tenants',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/v1/admin/tenants/:tenantId
 * Update tenant configuration (admin only)
 */
router.put('/admin/tenants/:tenantId', tenantAuth.requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const updates = req.body;
    
    const updatedTenant = await tenantService.updateTenant(tenantId, updates);
    
    res.json({
      success: true,
      tenant: updatedTenant
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update tenant',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/v1/admin/tenants/:tenantId
 * Delete tenant (admin only)
 */
router.delete('/admin/tenants/:tenantId', tenantAuth.requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    
    await tenantService.deleteTenant(tenantId);
    
    res.json({
      success: true,
      message: 'Tenant deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete tenant',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/admin/tenants/:tenantId/regenerate-key
 * Regenerate API key for tenant (admin only)
 */
router.post('/admin/tenants/:tenantId/regenerate-key', tenantAuth.requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    
    const newApiKey = await tenantService.regenerateApiKey(tenantId);
    
    res.json({
      success: true,
      newApiKey
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to regenerate API key',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ==========================================
// SYSTEM MONITORING ENDPOINTS
// ==========================================

/**
 * GET /api/v1/system/health
 * System health check
 */
router.get('/system/health', async (req: Request, res: Response) => {
  try {
    const systemStats = tenantService.getSystemStats();
    const persistentMetrics = persistentTradeService.getMetrics();
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      system: systemStats,
      tradeDiscovery: persistentMetrics,
      version: '1.0.0'
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/system/metrics
 * Detailed system metrics (admin only)
 */
router.get('/system/metrics', tenantAuth.requireAdmin, async (req: Request, res: Response) => {
  try {
    const systemStats = tenantService.getSystemStats();
    const persistentMetrics = persistentTradeService.getMetrics();
    
    res.json({
      success: true,
      metrics: {
        tenantManagement: systemStats,
        persistentTradeDiscovery: persistentMetrics,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get system metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ==========================================
// INTEGRATION EXAMPLES ENDPOINT
// ==========================================

/**
 * GET /api/v1/integration/examples
 * Get integration examples for partners
 */
router.get('/integration/examples', async (req: Request, res: Response) => {
  const examples = {
    curl: {
      description: "Example cURL commands for API integration",
      tradeDiscovery: `curl -X POST https://api.swaps.com/api/v1/discovery/trades \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "wallets": [{
      "id": "wallet_123",
      "ownedNFTs": [{"id": "nft_456", "metadata": {"name": "My NFT"}, "ownership": {"ownerId": "wallet_123"}}],
      "wantedNFTs": ["nft_789"]
    }],
    "mode": "informational"
  }'`,
      
      submitInventory: `curl -X POST https://api.swaps.com/api/v1/inventory/submit \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "walletId": "wallet_123",
    "nfts": [{"id": "nft_456", "metadata": {"name": "My NFT"}, "ownership": {"ownerId": "wallet_123"}}]
  }'`
    },
    
    javascript: {
      description: "JavaScript/Node.js integration examples",
      setup: `const SWAPS_API_KEY = 'your_api_key_here';
const SWAPS_BASE_URL = 'https://api.swaps.com/api/v1';

const headers = {
  'Authorization': \`Bearer \${SWAPS_API_KEY}\`,
  'Content-Type': 'application/json'
};`,

      tradeDiscovery: `async function discoverTrades(wallets) {
  const response = await fetch(\`\${SWAPS_BASE_URL}/discovery/trades\`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      wallets,
      mode: 'informational',
      settings: { maxResults: 50 }
    })
  });
  
  const result = await response.json();
  return result.trades;
}`
    },
    
    python: {
      description: "Python integration examples",
      setup: `import requests

SWAPS_API_KEY = 'your_api_key_here'
SWAPS_BASE_URL = 'https://api.swaps.com/api/v1'

headers = {
    'Authorization': f'Bearer {SWAPS_API_KEY}',
    'Content-Type': 'application/json'
}`,

      tradeDiscovery: `def discover_trades(wallets):
    response = requests.post(
        f'{SWAPS_BASE_URL}/discovery/trades',
        headers=headers,
        json={
            'wallets': wallets,
            'mode': 'informational',
            'settings': {'maxResults': 50}
        }
    )
    
    return response.json()['trades']`
    }
  };
  
  res.json({
    success: true,
    examples,
    documentation: {
      apiReference: "https://docs.swaps.com/api",
      gettingStarted: "https://docs.swaps.com/quickstart",
      webhooks: "https://docs.swaps.com/webhooks"
    }
  });
});

// ==========================================
// UNIVERSAL NFT INGESTION ENDPOINTS
// ==========================================

/**
 * POST /api/v1/config/api-keys
 * Configure blockchain API keys for automatic NFT ingestion
 * 
 * Body:
 * {
 *   "ethereum": {
 *     "alchemy": { "apiKey": "...", "rateLimit": 300 },
 *     "moralis": { "apiKey": "...", "rateLimit": 600 }
 *   },
 *   "polygon": {
 *     "alchemy": { "apiKey": "..." }
 *   },
 *   "solana": {
 *     "helius": { "apiKey": "..." }
 *   }
 * }
 */
router.post('/config/api-keys', tenantAuth.authenticate, async (req: Request & { tenant?: any }, res: Response) => {
  try {
    const tenant = req.tenant;
    if (!tenant) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const apiKeys = req.body;
    if (!apiKeys || typeof apiKeys !== 'object') {
      return res.status(400).json({ error: 'API keys configuration required' });
    }

    await universalIngestionService.configureTenantAPIKeys(tenant.id, apiKeys);

    res.json({
      success: true,
      message: 'API keys configured successfully',
      blockchains: Object.keys(apiKeys),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to configure API keys', {
      tenantId: req.tenant?.id,
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to configure API keys',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/ingestion/discover
 * Automatically discover and ingest NFTs from all user's wallets
 * 
 * Body:
 * {
 *   "userId": "user_123",
 *   "walletAddresses": {
 *     "ethereum": "0x1234...",
 *     "polygon": "0x5678...", 
 *     "solana": "F1Vc6cRdwxRr3dGLJT8ZqgCjFJ5jKt2Qj9BzQ4sN7vPk"
 *   }
 * }
 */
router.post('/ingestion/discover', tenantAuth.authenticate, async (req: Request & { tenant?: any }, res: Response) => {
  try {
    const tenant = req.tenant;
    if (!tenant) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { userId, walletAddresses } = req.body;
    
    if (!userId || !walletAddresses) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['userId', 'walletAddresses']
      });
    }

    const result = await universalIngestionService.ingestUserNFTs(
      tenant.id, 
      userId, 
      walletAddresses
    );

    res.json({
      success: true,
      message: 'NFT ingestion started',
      jobIds: result.jobIds,
      estimatedCompletion: result.estimatedCompletion,
      blockchains: Object.keys(walletAddresses),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to start NFT ingestion', {
      tenantId: req.tenant?.id,
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to start NFT ingestion',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/ingestion/status
 * Get NFT ingestion status for tenant
 */
router.get('/ingestion/status', tenantAuth.authenticate, async (req: Request & { tenant?: any }, res: Response) => {
  try {
    const tenant = req.tenant;
    if (!tenant) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const status = universalIngestionService.getIngestionStatus(tenant.id);

    res.json({
      success: true,
      ...status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get ingestion status', {
      tenantId: req.tenant?.id,
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get ingestion status'
    });
  }
});

export default router; 