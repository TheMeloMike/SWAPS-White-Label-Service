/**
 * SWAPS White Label API Server
 * 
 * Main entry point for the white label B2B API service.
 * Starts the Express server with only white label endpoints.
 */

import 'reflect-metadata';
import dotenv from 'dotenv';
import { LoggingService } from './utils/logging/LoggingService';
import app from './app';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = LoggingService.getInstance().createLogger('WhiteLabelServer');

// Server configuration
const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';

// Start server
const server = app.listen(port, host, () => {
  logger.info(`🚀 SWAPS White Label API Server started`, {
    port,
    host,
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      api: '/api/v1',
      health: '/health',
      docs: '/'
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server shutdown complete');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server shutdown complete');
    process.exit(0);
  });
});

// Export server for testing
export default server; 