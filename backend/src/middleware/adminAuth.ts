import { Request, Response, NextFunction } from 'express';
import { LoggingService } from '../utils/logging/LoggingService';

/**
 * Admin authentication middleware
 * Verifies admin API key for sensitive endpoints
 */

const logger = LoggingService.getInstance().createLogger('AdminAuth');

export const adminAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const adminApiKey = process.env.ADMIN_API_KEY;
    
    if (!adminApiKey) {
      logger.error('Admin API key not configured');
      res.status(500).json({
        error: 'Admin authentication not configured'
      });
      return;
    }

    // Extract API key from headers
    const providedKey = req.headers['x-api-key'] as string || 
                       (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') 
                        ? req.headers.authorization.substring(7) 
                        : null);

    if (!providedKey) {
      logger.warn('Admin endpoint accessed without API key', {
        ip: req.ip,
        endpoint: req.path,
        userAgent: req.get('User-Agent')
      });
      
      res.status(401).json({
        error: 'Admin API key required',
        message: 'Use X-API-Key header or Authorization: Bearer <admin_api_key>'
      });
      return;
    }

    // Simple string comparison for admin key
    if (providedKey !== adminApiKey) {
      logger.warn('Invalid admin API key attempt', {
        ip: req.ip,
        endpoint: req.path,
        providedKeyLength: providedKey.length,
        userAgent: req.get('User-Agent')
      });
      
      res.status(403).json({
        error: 'Invalid admin API key'
      });
      return;
    }

    // Admin authenticated successfully
    logger.info('Admin authentication successful', {
      ip: req.ip,
      endpoint: req.path,
      userAgent: req.get('User-Agent')
    });

    next();
  } catch (error) {
    logger.error('Admin authentication error', { error });
    res.status(500).json({
      error: 'Authentication error'
    });
  }
};