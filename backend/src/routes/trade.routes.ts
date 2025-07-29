import express from 'express';
import { container } from '../di-container';
import { TradeController } from '../controllers/TradeController';
import { WalletService } from '../services/trade/WalletService';
import { NFTService } from '../services/nft/NFTService';
import { Request, Response } from 'express';
import { KafkaIntegrationService } from '../services/trade/KafkaIntegrationService';
import { Helius } from 'helius-sdk';
import { ITradeDiscoveryService } from '../types/services';
import fs from 'fs';
import path from 'path';
import { TradeDiscoveryService } from '../services/trade/TradeDiscoveryService';
import { LoggingService } from '../utils/logging/LoggingService'; 
import { GlobalCacheService } from '../services/cache/GlobalCacheService';

const router = express.Router();
console.log('[Init] Trade routes module loaded'); // Diagnostic log

// Get services directly
const nftService = NFTService.getInstance();

// Create a Helius instance directly 
const apiKey = process.env.HELIUS_API_KEY || '';
const helius = new Helius(apiKey);

// Directly get TradeDiscoveryService instance
const tradeDiscoveryService = TradeDiscoveryService.getInstance();
if (!tradeDiscoveryService) {
  console.error('[Critical Error] TradeDiscoveryService.getInstance() returned null or undefined');
  process.exit(1); // Exit if we can't get this critical service
}

// Create essential services
const walletService = new WalletService(
  helius, 
  new Map() // Manual NFT registry
);

const kafkaService = process.env.ENABLE_KAFKA === 'true' ? KafkaIntegrationService.getInstance() : undefined;
const loggingService = new LoggingService();
const cacheService = new GlobalCacheService();

// Resolve TradeController from the DI container or create it manually
let tradeController: TradeController;
try {
  // First try to resolve via DI
  tradeController = container.resolve(TradeController);
  console.log('[Init] TradeController resolved successfully from DI container');
} catch (error) {
  console.warn('[Warning] DI resolution failed, creating TradeController manually:', error);
  
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
    console.log('[Init] TradeController created manually as fallback');
  } catch (fallbackError) {
    console.error('[Critical Error] Failed to create TradeController manually:', fallbackError);
    throw new Error('Failed to initialize TradeController after DI and manual attempts');
  }
}

// Health check endpoint specific to trade service
router.get('/health', (_req: Request, res: Response) => {
  res.json({ message: 'SWAPS Backend Trade Service Running - Route OK' });
});

// Discover potential trades
router.post('/discover', (req, res) => tradeController.findTrades(req, res));

// Add multiple NFTs to wants list
router.post('/wants/multiple', (req, res) => tradeController.addMultipleWants(req, res));

// Collection wants management
router.post('/wants/collection', (req, res) => tradeController.addCollectionWant(req, res));
router.get('/wants/collection', (req, res) => tradeController.getCollectionWants(req, res));
router.delete('/wants/collection/:collectionId', (req, res) => tradeController.removeCollectionWant(req, res));

// Note: Collection search, popular, and details routes are now handled by 
// the dedicated collections router at /api/collections/ instead of /api/trades/collections/

// Reject a trade
router.post('/reject', (req, res) => tradeController.rejectTrade(req, res));

// Record completed trade step
router.post('/step-completed', (req, res) => tradeController.recordTradeStepCompleted(req, res));

// Deep scan a wallet for all NFTs
router.post('/wallet/deep-scan', async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ success: false, error: 'Missing wallet address' });
  }
  const result = await tradeDiscoveryService.deepScanWalletNFTs(walletAddress);
  return res.json({ success: true, data: result });
});

// Get current system state
router.get('/system', (req, res) => tradeController.getSystemState(req, res));

// Clear system state for testing
router.post('/system/clear', (req, res) => tradeController.clearSystem(req, res));

// Get detailed system state
router.get('/system/detailed', (req, res) => tradeController.getDetailedSystemState(req, res));

// Get trades for a specific user wallet
router.get('/user/:walletAddress', (req, res) => tradeController.getUserTrades(req, res));

// Get trade opportunities for a specific wallet (new endpoint)
router.get('/opportunities/:walletAddress', (req, res) => tradeController.getTradeOpportunities(req, res));

/**
 * @route GET /api/trades/details/:tradeId
 * @description Get details for a specific trade by ID
 * @access Public
 */
router.get('/details/:tradeId', (req, res) => tradeController.getTradeDetails(req, res));

// Get current trade pool state
router.get('/pool', (req, res) => tradeController.getSystemState(req, res));

// Get trade pool statistics
router.get('/pool/stats', (req, res) => tradeController.getSystemState(req, res));

// Clear the trade pool (redirected to clear system)
router.post('/pool/clear', (req, res) => tradeController.clearSystem(req, res));

// Manually register NFTs for a wallet
router.post('/register-nfts', (req, res) => tradeController.registerManualNFTs(req, res));

// Add the new API endpoints
router.post('/on-chain/create', (req, res) => tradeController.createOnChainTradeLoop(req, res));
router.post('/on-chain/step-completed', (req, res) => tradeController.recordTradeStepCompleted(req, res));
router.post('/on-chain/prepare', (req, res) => tradeController.prepareTradeLoopForContract(req, res));

// Add the trade submission endpoint
router.post('/submit', (req, res) => tradeController.submitTrade(req, res));

// Get active trades endpoint - Needs controller method
router.get('/active', (req, res) => tradeController.getActiveTrades(req, res));

// Get completed trades count - Needs controller method
router.get('/completed/count', (req, res) => tradeController.getCompletedTradesCount(req, res));

// Get trade history - Needs controller method
router.get('/history', (req, res) => tradeController.getTradeHistory(req, res));

// Get trade history for a specific user - Needs controller method
router.get('/history/user/:walletAddress', (req, res) => tradeController.getUserTradeHistory(req, res));

// Data validation endpoint
router.get('/validate-data', async (req, res) => {
  try {
    // Get DataSyncService instance
    const DataSyncService = (await import('../services/data/DataSyncService')).DataSyncService;
    const dataSyncService = container.resolve<any>("DataSyncService");
    
    // Get current system state
    const wallets = tradeDiscoveryService.getWallets();
    const wantedNfts = tradeDiscoveryService.getWantedNfts();
    const nftOwnership = tradeDiscoveryService.getNFTOwnershipMap();
    
    // Convert ownership map to Map for validation
    const ownershipMap = new Map(Object.entries(nftOwnership));
    
    // Validate data integrity
    const validationResult = dataSyncService.validateDataIntegrity(
      wallets,
      ownershipMap,
      wantedNfts
    );
    
    // Generate graph visualization data
    const graphData = dataSyncService.generateTradeGraphVisualization(
      wallets,
      ownershipMap,
      wantedNfts
    );
    
    res.json({
      success: true,
      dataIntegrity: {
        isValid: validationResult.isValid,
        issuesCount: validationResult.issues.length,
        issues: validationResult.issues,
        recommendations: validationResult.recommendations
      },
      systemState: {
        walletsCount: wallets.size,
        nftsCount: ownershipMap.size,
        wantedNftsCount: wantedNfts.size
      },
      graphVisualization: {
        nodesCount: graphData.nodes.length,
        edgesCount: graphData.edges.length,
        nodes: graphData.nodes,
        edges: graphData.edges
      }
    });
  } catch (error) {
    console.error('Error validating data integrity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate data integrity'
    });
  }
});

// Initialize test data route for performance testing
router.post('/initialize-test-data', async (req: Request, res: Response) => {
  try {
    const { dataFile } = req.body;
    console.log(`Loading test data from ${dataFile}`);
    
    if (!fs.existsSync(dataFile)) {
      return res.status(404).json({
        success: false,
        message: `Test data file not found: ${dataFile}`
      });
    }
    
    // Get the trade discovery service
    const tradeDiscovery = container.resolve<ITradeDiscoveryService>("ITradeDiscoveryService");
    
    // Read the test data file
    const testData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    
    // Clear existing system state first
    tradeDiscovery.clearState();
    console.log('Cleared existing system state');
    
    // Track registration stats
    let walletCount = 0;
    let nftCount = 0;
    let wantCount = 0;
    
    // Load owned NFTs
    console.log('Registering owned NFTs...');
    for (const [wallet, nfts] of Object.entries(testData.ownedNFTs)) {
      tradeDiscovery.registerManualNFTs(wallet, nfts as string[]);
      walletCount++;
      nftCount += (nfts as string[]).length;
    }
    
    // Load wanted NFTs
    console.log('Registering wanted NFTs...');
    for (const [wallet, nfts] of Object.entries(testData.wantedNFTs)) {
      for (const nft of nfts as string[]) {
        await tradeDiscovery.addTradePreference(wallet, nft);
        wantCount++;
      }
    }
    
    console.log(`Initialized system with ${walletCount} wallets, ${nftCount} NFTs, and ${wantCount} wants`);
    
    // Return success with stats
    return res.json({
      success: true,
      message: 'Test data loaded successfully',
      stats: {
        wallets: walletCount,
        nfts: nftCount,
        wants: wantCount
      }
    });
  } catch (error) {
    console.error('Error loading test data:', error);
    return res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get details for a specific trade by ID - Must be AFTER all other specific routes
router.get('/:tradeId', (req, res) => tradeController.getTradeDetails(req, res));

console.log('[Init] Trade routes using resolved TradeController registered.');

export default router; 