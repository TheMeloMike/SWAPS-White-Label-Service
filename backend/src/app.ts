import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { LoggingService } from './utils/logging/LoggingService';
import { registerServices } from './di-container';

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

// Import white label routes
import whiteLabelApiRoutes from './routes/whiteLabelApi.routes';
import healthRoutes from './routes/health.routes';

const logger = LoggingService.getInstance().createLogger('WhiteLabelApp');
const app = express();

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

// Special CORS bypass for static files (favicon, etc.)
app.use('/favicon.ico', cors());
app.use('/*.ico', cors());

// Parse JSON request bodies (generous limit for NFT metadata)
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api/v1', whiteLabelApiRoutes);
app.use('/health', healthRoutes);

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

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    availableEndpoints: ['/api/v1', '/health'],
    documentation: 'https://desert-adjustment-111.notion.site/SWAPS-White-Label-Documentation-2409b1fc08278068a469c60e33a105d8'
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('API Error:', {
    path: req.path,
    method: req.method,
    error: err.message || 'Unknown error',
    stack: isProd ? undefined : err.stack
  });

  const statusCode = err.statusCode || err.status || 500;
  
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  });
});

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
  routes: ['/api/v1', '/health']
});

export default app; 