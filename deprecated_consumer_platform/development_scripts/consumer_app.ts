import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { LoggingService } from './utils/logging/LoggingService';
import { BackgroundTradeDiscoveryService } from './services/trade/BackgroundTradeDiscoveryService';
import { registerServices } from './di-container';

// Load environment variables FIRST
dotenv.config();

// Try to register services with proper error handling
try {
  // Call registerServices immediately after env vars and before any route imports
  registerServices(); 
  console.log('[App] registerServices() called successfully'); // Diagnostic log
} catch (error) {
  console.error('[App CRITICAL] Failed to register services:', error);
  // Continue execution to let the error handler middleware handle any resulting issues
}

// NOW import routes AFTER services are registered 
let tradeRoutes;
let nftRoutes;
let healthRoutes;
let trendingRoutes;
let statsRoutes;

// Import each route with error handling to allow the app to start
// even if some routes fail to initialize
try {
  tradeRoutes = require('./routes/trade.routes').default;
  console.log('[App] Trade routes imported successfully');
} catch (error) {
  console.error('[App ERROR] Failed to import trade routes:', error);
  // Provide simple fallback route
  tradeRoutes = express.Router().get('/health', (_, res) => res.json({error: 'Trade routes failed to initialize'}));
}

// Import white label API routes
let whiteLabelApiRoutes;
try {
  whiteLabelApiRoutes = require('./routes/whiteLabelApi.routes').default;
  console.log('[App] White Label API routes imported successfully');
} catch (error) {
  console.error('[App ERROR] Failed to import White Label API routes:', error);
  whiteLabelApiRoutes = express.Router().get('/health', (_, res) => res.json({error: 'White Label API routes failed to initialize'}));
}

try {
  nftRoutes = require('./routes/nft.routes').default;
  console.log('[App] NFT routes imported successfully');
} catch (error) {
  console.error('[App ERROR] Failed to import NFT routes:', error);
  nftRoutes = express.Router().get('/health', (_, res) => res.json({error: 'NFT routes failed to initialize'}));
}

// Import collections routes
let collectionsRoutes;
try {
  console.log('[App] Attempting to import collections routes...');
  console.log('[App] HELIUS_API_KEY available:', !!process.env.HELIUS_API_KEY);
  collectionsRoutes = require('./routes/collections.routes').default;
  console.log('[App] Collections routes imported successfully');
} catch (error) {
  console.error('[App ERROR] Failed to import collections routes:', error);
  console.error('[App ERROR] Error details:', error instanceof Error ? error.stack : String(error));
  collectionsRoutes = express.Router().get('/health', (_, res) => res.json({error: 'Collections routes failed to initialize'}));
}

try {
  healthRoutes = require('./routes/health.routes').default;
  console.log('[App] Health routes imported successfully');
} catch (error) {
  console.error('[App ERROR] Failed to import health routes:', error);
  healthRoutes = express.Router().get('/', (_, res) => res.json({status: 'Service degraded'}));
}

// Handle trending routes separately with more detailed error information
try {
  // Check if trending routes file exists first
  const fs = require('fs');
  const trendingRoutesPath = require.resolve('./routes/trending.routes');
  console.log('[App] Found trending routes path:', trendingRoutesPath);
  
  // Try to load the module
  trendingRoutes = require('./routes/trending.routes').default;
  
  if (!trendingRoutes) {
    throw new Error('trending.routes.ts exists but exports.default is undefined');
  }
  
  console.log('[App] Trending routes imported successfully');
} catch (error) {
  console.error('[App ERROR] Failed to import trending routes - DETAILED ERROR:', error);
  // Create a dummy route handler that shows the error
  const dummyRouter = express.Router();
  
  dummyRouter.get('/', (_, res) => {
    res.status(500).json({
      error: 'Trending routes failed to initialize',
      details: error instanceof Error ? error.message : String(error),
      errorObject: JSON.stringify(error, Object.getOwnPropertyNames(error))
    });
  });
  
  dummyRouter.get('/health', (_, res) => {
    res.status(500).json({
      status: 'error',
      message: 'Trending module failed to load',
      details: error instanceof Error ? error.message : String(error)
    });
  });
  
  trendingRoutes = dummyRouter;
}

// Import stats routes
try {
  statsRoutes = require('./routes/stats.routes').default;
  console.log('[App] Stats routes imported successfully');
} catch (error) {
  console.error('[App ERROR] Failed to import stats routes:', error);
  statsRoutes = express.Router().get('/health', (_, res) => res.json({error: 'Stats routes failed to initialize'}));
}

// Import AI routes
let aiRoutes;
try {
  aiRoutes = require('./routes/ai.routes').default;
  console.log('[App] AI routes imported successfully');
} catch (error) {
  console.error('[App ERROR] Failed to import AI routes:', error);
  aiRoutes = express.Router().get('/health', (_, res) => res.json({error: 'AI routes failed to initialize'}));
}

// Import URL metadata routes
let urlMetadataRoutes;
try {
  urlMetadataRoutes = require('./routes/url-metadata.routes').default;
  console.log('[App] URL metadata routes imported successfully');
} catch (error) {
  console.error('[App ERROR] Failed to import URL metadata routes:', error);
  urlMetadataRoutes = express.Router().get('/health', (_, res) => res.json({error: 'URL metadata routes failed to initialize'}));
}

// Import notification routes
let notificationRoutes;
try {
  notificationRoutes = require('./routes/notifications.routes').default;
  console.log('[App] Notification routes imported successfully');
} catch (error) {
  console.error('[App ERROR] Failed to import notification routes:', error);
  notificationRoutes = express.Router().get('/health', (_, res) => res.json({error: 'Notification routes failed to initialize'}));
}

// Import dashboard routes
let dashboardRoutes;
try {
  dashboardRoutes = require('./routes/dashboard.routes').default;
  console.log('[App] Dashboard routes imported successfully');
} catch (error) {
  console.error('[App ERROR] Failed to import dashboard routes:', error);
  dashboardRoutes = express.Router().get('/health', (_, res) => res.json({error: 'Dashboard routes failed to initialize'}));
}

// Import admin routes
let adminRoutes;
try {
  console.log('[App] Attempting to import admin routes...');
  adminRoutes = require('./routes/admin.routes').default;
  console.log('[App] Admin routes imported successfully');
  console.log('[App] Admin routes type:', typeof adminRoutes);
} catch (error) {
  console.error('[App ERROR] Failed to import admin routes:', error);
  console.error('[App ERROR] Error stack:', error instanceof Error ? error.stack : String(error));
  adminRoutes = express.Router().get('/health', (_, res) => res.json({error: 'Admin routes failed to initialize'}));
}

// Import admin-simple routes
let adminSimpleRoutes;
try {
  console.log('[App] Attempting to import admin-simple routes...');
  adminSimpleRoutes = require('./routes/admin-simple.routes').default;
  console.log('[App] Admin-simple routes imported successfully');
} catch (error) {
  console.error('[App ERROR] Failed to import admin-simple routes:', error);
  adminSimpleRoutes = express.Router().get('/health', (_, res) => res.json({error: 'Admin-simple routes failed to initialize'}));
}

const logger = LoggingService.getInstance().createLogger('App');
const app = express();

// CORS configuration
// In production, use the CORS_ORIGIN environment variable
// In development, allow all origins with credentials
const isProd = process.env.NODE_ENV === 'production';
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : [];

// Always include common development origins
if (!isProd) {
  corsOrigins.push(
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002'
  );
}

logger.info('CORS configuration:', {
  isProd,
  allowedOrigins: corsOrigins,
  allowAll: !isProd
});

// Enable CORS for all routes
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // In development, allow all origins
    if (!isProd) {
      return callback(null, true);
    }
    
    // In production, check against the allowed list
    if (corsOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      logger.warn(`Origin ${origin} not allowed by CORS policy`);
      return callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Parse JSON request bodies
app.use(express.json({ limit: '5mb' }));

// Add direct test endpoint for trending
const directTrendingRouter = express.Router();
directTrendingRouter.get('/test', (req, res) => {
  console.log('DIRECT TRENDING TEST ENDPOINT HIT');
  res.json({
    success: true,
    message: 'Direct trending test endpoint working',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/trades', tradeRoutes);
app.use('/api/nfts', nftRoutes);
app.use('/api/collections', collectionsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/health', healthRoutes);
app.use('/api/trending', trendingRoutes);
app.use('/api/trending-test', directTrendingRouter);
app.use('/api/ai', aiRoutes);
app.use('/api/url', urlMetadataRoutes);
app.use('/api/notifications', notificationRoutes);

// WHITE LABEL API ROUTES - Partner-facing endpoints
console.log('[App] Mounting White Label API routes at /api/v1...');
app.use('/api/v1', whiteLabelApiRoutes);
console.log('[App] White Label API routes mounted successfully');
console.log('[App] Mounting admin routes at /api/admin...');
app.use('/api/admin', adminRoutes);
console.log('[App] Admin routes mounted successfully');
console.log('[App] Mounting admin-simple routes at /api/admin-simple...');
app.use('/api/admin-simple', adminSimpleRoutes);
console.log('[App] Admin-simple routes mounted successfully');
app.use('/api/dashboard', dashboardRoutes);
console.log('[Init] ***IMPORTANT*** Direct trending test endpoint mounted at /api/trending-test/test');
console.log('[Init] ***IMPORTANT*** Regular trending routes mounted at /api/trending');
console.log('[Init] ***IMPORTANT*** Stats routes mounted at /api/stats');
console.log('[Init] ***IMPORTANT*** AI routes mounted at /api/ai');
console.log('[Init] All core routes mounted.'); // Diagnostic log

// Start background services if enabled
const enableBackgroundTradeDiscovery = process.env.ENABLE_BACKGROUND_TRADE_DISCOVERY === 'true';
if (enableBackgroundTradeDiscovery) {
  logger.info('Starting background trade discovery service');
  
  try {
    const backgroundService = BackgroundTradeDiscoveryService.getInstance();
    backgroundService.start();
    
    // Register process shutdown handler
    process.on('SIGINT', () => {
      logger.info('Stopping background trade discovery service');
      backgroundService.stop();
    });
    
    logger.info('Background trade discovery service started successfully');
  } catch (error) {
    logger.error('Failed to start background trade discovery service', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
} else {
  logger.info('Background trade discovery service is disabled');
}

// 404 handler - must be added after all routes
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.status(404).json({
    status: 'error',
    message: `Cannot ${req.method} ${req.path}`,
    code: 'NOT_FOUND'
  });
});

// Error handling middleware - must be the last middleware added
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('API Error:', {
    path: req.path,
    method: req.method,
    error: err.message || 'Unknown error',
    stack: isProd ? undefined : err.stack
  });

  // Ensure response status is set to an error code
  const statusCode = err.statusCode || err.status || 500;
  
  // Send error response
  res.status(statusCode).json({
    status: 'error',
    message: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR'
  });
});

// Catch uncaught exceptions to prevent server crashes
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', {
    error: err.message,
    stack: err.stack
  });
  
  // Don't exit the process, just log the error
  // This is a temporary fix to keep the server running despite errors
});

export default app; 