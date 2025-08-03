import express from 'express';
import cors from 'cors';
import helmet from 'helmet'; // ADD THIS
import dotenv from 'dotenv';
import { LoggingService } from './utils/logging/LoggingService';
import { registerServices } from './di-container';
import { SecurityHeaders } from './middleware/securityHeaders'; // ADD THIS
import { RateLimiters } from './middleware/enhancedRateLimit'; // ADD THIS

// Load environment variables
dotenv.config();

// Register dependency injection services
try {
  registerServices();
  console.log('[WhiteLabel] Services registered successfully');
} catch (error) {
  console.error('[WhiteLabel CRITICAL] Failed to register services:', error);
  process.exit(1);
}

// Import and start background services for living persistent graph
import { BackgroundTradeDiscoveryService } from './services/trade/BackgroundTradeDiscoveryService';

// Import white label routes
import whiteLabelApiRoutes from './routes/whiteLabelApi.routes';
import healthRoutes from './routes/health.routes';
import docsRoutes from './routes/docs.routes';
import monitoringRoutes, { trackRequests } from './routes/monitoring.routes';
import { ErrorHandler } from './middleware/errorHandler';
import { detectApiVersion, configureEnterpriseVersioning } from './middleware/apiVersioning';

const logger = LoggingService.getInstance().createLogger('WhiteLabelApp');
const app = express();

// Configure enterprise API versioning
configureEnterpriseVersioning();

// CORS configuration for API service
const isProd = process.env.NODE_ENV === 'production';
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : [];

// In development, allow all origins. In production, use configured origins.
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like API clients, mobile apps)
    if (!origin) {
      return callback(null, true);
    }
    
    // In development, allow all origins
    if (!isProd) {
      return callback(null, true);
    }
    
    // In production, check against allowed list
    if (corsOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      logger.warn(`Origin ${origin} not allowed by CORS policy`);
      return callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-API-Key']
}));

// 🔒 SECURITY ENHANCEMENTS START HERE
// Add Helmet for basic security headers
app.use(helmet({
  contentSecurityPolicy: false, // Not needed for API
  crossOriginEmbedderPolicy: false // Not needed for API
}));

// Add our custom security headers
app.use(SecurityHeaders.api());

// Global rate limiting
app.use('/api', RateLimiters.standard);

// Special CORS bypass for static files (favicon, etc.)
app.use('/favicon.ico', cors());
app.use('/*.ico', cors());

// Parse JSON request bodies with specific limits per endpoint
app.use('/api/v1/inventory', express.json({ limit: '1mb' }));
app.use('/api/v1/wants', express.json({ limit: '500kb' }));
app.use('/api/v1', express.json({ limit: '100kb' })); // Default for other endpoints
app.use(express.json({ limit: '50kb' })); // Global fallback

// Add request tracking for error handling and monitoring
app.use(ErrorHandler.addRequestTracking);
app.use(trackRequests);

// Add API versioning detection
app.use('/api', detectApiVersion);

// API Routes with specific rate limits
app.use('/api/v1', whiteLabelApiRoutes);
app.use('/health', healthRoutes);
app.use('/monitoring', monitoringRoutes); // Enterprise monitoring endpoints
app.use('/', docsRoutes); // Documentation routes at root level

// Favicon route - serve a simple SWAPS favicon
app.get('/favicon.ico', (req, res) => {
  // Serve a simple SVG favicon with SWAPS branding
  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="45" fill="#1a1a2e"/>
    <text x="50" y="60" font-size="40" text-anchor="middle" fill="#0ff">🔄</text>
  </svg>`;
  
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
  res.send(favicon);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'SWAPS White Label API',
    version: '1.0.0',
    status: 'operational',
    endpoints: {
      api: '/api/v1',
      health: '/health',
      documentation: 'https://desert-adjustment-111.notion.site/SWAPS-White-Label-Documentation-2409b1fc08278068a469c60e33a105d8'
    },
    message: '🔄 SWAPS: Where NFTs find their perfect match',
    timestamp: new Date().toISOString()
  });
});

// 404 handler - use standardized error handling
app.use(ErrorHandler.handle404);

// Global error handling middleware
app.use(ErrorHandler.handle);

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Uncaught exception handler
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', {
    error: err.message,
    stack: err.stack
  });
  
  // Exit the process for uncaught exceptions in production
  if (isProd) {
    process.exit(1);
  }
});

logger.info('SWAPS White Label API initialized', {
  environment: isProd ? 'production' : 'development',
  corsOrigins: isProd ? corsOrigins.length : 'development (all origins allowed)',
  routes: ['/api/v1', '/health'],
  security: {
    helmet: true,
    securityHeaders: true,
    rateLimiting: true,
    requestSizeLimits: true
  }
});

// 🌱 START LIVING PERSISTENT GRAPH: Initialize background services
try {
  const backgroundService = BackgroundTradeDiscoveryService.getInstance();
  
  // Configure for white label multi-tenant environment
  backgroundService.configure({
    enableDifferentialUpdates: true  // Optimize for frequent tenant updates
  });
  
  // Start the living graph background processing
  backgroundService.start();
  
  logger.info('🌱 Living Persistent Graph started successfully', {
    service: 'BackgroundTradeDiscoveryService',
    differentialUpdates: true,
    status: 'operational'
  });
} catch (error) {
  logger.error('🚨 CRITICAL: Failed to start living persistent graph', {
    error: error instanceof Error ? error.message : String(error),
    impact: 'System will fall back to on-demand computation (slower responses)'
  });
  
  // Don't exit - allow system to continue with computation-based discovery
  // but log this as a critical issue for monitoring
}

export default app;