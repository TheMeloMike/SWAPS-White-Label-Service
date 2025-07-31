// Import reflect-metadata for tsyringe dependency injection
import 'reflect-metadata';

// Register module aliases
import 'module-alias/register';

// Import environment variables
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { TradeDiscoveryService } from './services/trade/TradeDiscoveryService';
import { NFTService } from './services/nft/NFTService';
import { NFTPricingService } from './services/nft/NFTPricingService';
import { LoggingService } from './utils/logging/LoggingService';
import { container, registerServices } from './di-container';
import { ITradeDiscoveryService } from './types/services';
import { WebSocketNotificationService } from './services/notifications/WebSocketNotificationService';
import { OpportunityDetectionEngine } from './services/notifications/OpportunityDetectionEngine';
import http from 'http';

// Load environment variables FIRST
dotenv.config();

// Validate required environment variables
if (!process.env.HELIUS_API_KEY) {
  console.error('Error: HELIUS_API_KEY environment variable is required');
  process.exit(1);
}

if (!process.env.SWAP_PROGRAM_ID) {
  console.error('Error: SWAP_PROGRAM_ID environment variable is required');
  process.exit(1);
}

if (!process.env.RPC_ENDPOINT) {
  console.warn('Warning: RPC_ENDPOINT environment variable not set, using default endpoint');
}

// Initialize the dependency injection container BEFORE importing routes
registerServices();

// Import routes AFTER DI container is initialized
import tradeRoutes from './routes/trade.routes';
import nftRoutes from './routes/nft.routes';
import healthRoutes from './routes/health.routes';
import wantsRoutes from './routes/wants.routes';
import collectionRoutes from './routes/collection.routes';

// Import collections routes with error handling
let collectionsRoutes;
try {
  collectionsRoutes = require('./routes/collections.routes').default;
  console.log('[Server] Collections routes imported successfully');
} catch (error) {
  console.error('[Server] Error loading collections routes:', error);
  // Create a fallback router
  collectionsRoutes = express.Router();
  collectionsRoutes.get('/health', (req, res) => {
    res.json({
      error: 'Collections routes failed to load',
      message: 'The collections feature is currently unavailable',
      timestamp: new Date().toISOString()
    });
  });
}

// Add trending routes with fallback error handling
let trendingRoutes;
try {
  trendingRoutes = require('./routes/trending.routes').default;
  console.log('[Server] Successfully loaded trending routes');
} catch (error) {
  console.error('[Server] Error loading trending routes:', error);
  // Create a fallback router
  trendingRoutes = express.Router();
  trendingRoutes.get('/', (req, res) => {
    res.json({
      error: 'Trending routes failed to load',
      message: 'The trending feature is currently unavailable',
      timestamp: new Date().toISOString()
    });
  });
}

// Add dashboard routes with fallback error handling
let dashboardRoutes;
try {
  dashboardRoutes = require('./routes/dashboard.routes').default;
  console.log('[Server] Successfully loaded dashboard routes');
} catch (error) {
  console.error('[Server] Error loading dashboard routes:', error);
  // Create a fallback router
  dashboardRoutes = express.Router();
  dashboardRoutes.get('/overview', (req, res) => {
    res.json({
      error: 'Dashboard routes failed to load',
      message: 'The dashboard feature is currently unavailable',
      timestamp: new Date().toISOString()
    });
  });
}

// Add admin routes with fallback error handling
let adminRoutes;
try {
  console.log('[Server] Attempting to load admin routes...');
  adminRoutes = require('./routes/admin.routes').default;
  console.log('[Server] Successfully loaded admin routes');
} catch (error) {
  console.error('[Server] Error loading admin routes:', error);
  console.error('[Server] Error stack:', error instanceof Error ? error.stack : String(error));
  // Create a fallback router
  adminRoutes = express.Router();
  adminRoutes.get('/health', (req, res) => {
    res.json({
      error: 'Admin routes failed to load',
      message: 'The admin feature is currently unavailable',
      timestamp: new Date().toISOString()
    });
  });
}



// Initialize services
const tradeDiscoveryService = container.resolve<ITradeDiscoveryService>("ITradeDiscoveryService");
const nftService = NFTService.getInstance();
const nftPricingService = NFTPricingService.getInstance();
const logger = LoggingService.getInstance().createLogger('Server');

// Background services can be added here in the future if needed

// Create Express app
const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register routes
app.use('/api/trades', tradeRoutes);
app.use('/api/nfts', nftRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/trending', trendingRoutes);
app.use('/api/wants', wantsRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
console.log('[Server] Collections routes mounted at /api/collections');
console.log('[Server] Trending routes mounted at /api/trending');
console.log('[Server] Wants routes mounted at /api/wants');
console.log('[Server] Dashboard routes mounted at /api/dashboard');
console.log('[Server] Admin routes mounted at /api/admin');

// Add a direct test endpoint for trending
app.get('/api/trending-direct-test', (req, res) => {
  console.log('Direct trending test endpoint hit!');
  res.json({
    success: true,
    message: 'Direct trending test endpoint is working',
    timestamp: new Date().toISOString()
  });
});
console.log('[Server] Added fallback direct trending test endpoint at /api/trending-direct-test');

// Trade discovery routes
app.get('/api/trades', async (req, res) => {
  try {
    const trades = await tradeDiscoveryService.findTradeLoops();
    res.json({ trades });
  } catch (error) {
    console.error('Error finding trade loops:', error);
    res.status(500).json({ error: 'Failed to find trade loops' });
  }
});

app.get('/api/wallet/:address/trades', async (req, res) => {
  try {
    const { address } = req.params;
    const trades = await tradeDiscoveryService.getTradesForWallet(address);
    res.json({ trades });
  } catch (error) {
    console.error(`Error getting trades for wallet ${req.params.address}:`, error);
    res.status(500).json({ error: 'Failed to get trades for wallet' });
  }
});

app.post('/api/wallet/:address/wants', async (req, res) => {
  try {
    const { address } = req.params;
    const { nftAddress } = req.body;
    
    if (!nftAddress) {
      return res.status(400).json({ error: 'nftAddress is required' });
    }
    
    await tradeDiscoveryService.addTradePreference(address, nftAddress);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error adding trade preference:', error);
    return res.status(500).json({ error: 'Failed to add trade preference' });
  }
});

app.post('/api/wallet/:address/reject', async (req, res) => {
  try {
    const { address } = req.params;
    const { nftAddress } = req.body;
    
    if (!nftAddress) {
      return res.status(400).json({ error: 'nftAddress is required' });
    }
    
    await tradeDiscoveryService.rejectTrade(address, nftAddress, true);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error rejecting trade:', error);
    return res.status(500).json({ error: 'Failed to reject trade' });
  }
});

app.post('/api/wallet/:address/update', async (req, res) => {
  try {
    const { address } = req.params;
    const { forceRefresh } = req.body;
    
    const walletState = await tradeDiscoveryService.updateWalletState(address, !!forceRefresh);
    return res.json({ walletState });
  } catch (error) {
    console.error('Error updating wallet state:', error);
    return res.status(500).json({ error: 'Failed to update wallet state' });
  }
});

// Set port in app
app.set('port', port);

// Create HTTP server and handle errors properly
const server = http.createServer(app);

// Initialize WebSocket notification service
const notificationService = WebSocketNotificationService.getInstance();
notificationService.initialize(server);

// Initialize and start opportunity detection engine
const detectionEngine = OpportunityDetectionEngine.getInstance();
detectionEngine.start();

logger.info('Notification system initialized', {
  websocketPath: '/ws/notifications',
  detectionInterval: '2 minutes'
});

// Initialize analytics services
console.log('Initializing analytics services...');
try {
  const { MetricsCollectionService } = require('./services/analytics/MetricsCollectionService');
  const { AnalyticsEngine } = require('./services/analytics/AnalyticsEngine');
  
  const metricsCollectionService = MetricsCollectionService.getInstance();
  const analyticsEngine = AnalyticsEngine.getInstance();
  
  // Start analytics services
  metricsCollectionService.start();
  analyticsEngine.start();
  
  logger.info('Analytics services initialized successfully', {
    metricsInterval: '1 minute',
    insightsInterval: '5 minutes',
    trendsInterval: '15 minutes'
  });
} catch (error) {
  logger.error('Failed to initialize analytics services', {
    error: error instanceof Error ? error.message : String(error)
  });
  // Continue without analytics services
}

// Add proper error handling to the server
server.on('error', (error: any) => {
  if (error.syscall !== 'listen') {
    logger.error('Server error:', { error: error.message, stack: error.stack });
    throw error;
  }

  const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

  // Handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      logger.error(`${bind} requires elevated privileges`);
      process.exit(1);
    case 'EADDRINUSE':
      logger.error(`${bind} is already in use`);
      process.exit(1);
    default:
      logger.error('Server error:', { error: error.message, stack: error.stack });
      throw error;
  }
});

// Global error handlers
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', {
    error: err.message,
    stack: err.stack
  });
  
  // Log the error but don't exit - this prevents the server from crashing
  // which is useful during development, but might not be appropriate for production
  // in production, you might want to gracefully restart the process instead
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
  // Again, we log but don't exit
});

// Start listening
server.listen(port, () => {
  logger.info(`SWAPS backend listening at http://localhost:${port}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  
  // Gracefully shutdown notification services
  try {
    detectionEngine.stop();
    notificationService.shutdown();
    logger.info('Notification services shutdown completed');
  } catch (error) {
    logger.error('Error during notification services shutdown', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  // Gracefully shutdown analytics services
  try {
    const { MetricsCollectionService } = require('./services/analytics/MetricsCollectionService');
    const { AnalyticsEngine } = require('./services/analytics/AnalyticsEngine');
    
    const metricsCollectionService = MetricsCollectionService.getInstance();
    const analyticsEngine = AnalyticsEngine.getInstance();
    
    metricsCollectionService.stop();
    analyticsEngine.stop();
    logger.info('Analytics services shutdown completed');
  } catch (error) {
    logger.error('Error during analytics services shutdown', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  process.exit(0);
}); 