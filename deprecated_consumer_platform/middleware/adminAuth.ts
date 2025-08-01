import { Request, Response, NextFunction } from 'express';

const jwt = require('jsonwebtoken');

// Simple console logger for admin auth (avoiding DI dependencies)
const logger = {
  info: (message: string, meta?: any) => console.log(`[AdminAuth] INFO: ${message}`, meta || ''),
  warn: (message: string, meta?: any) => console.warn(`[AdminAuth] WARN: ${message}`, meta || ''),
  error: (message: string, meta?: any) => console.error(`[AdminAuth] ERROR: ${message}`, meta || '')
};

// Admin credentials from environment variables - NO DEFAULTS FOR SECURITY
// Validate required security environment variables on startup
if (!process.env.ADMIN_USERNAME) {
  throw new Error('ADMIN_USERNAME environment variable is required');
}
if (!process.env.ADMIN_PASSWORD) {
  throw new Error('ADMIN_PASSWORD environment variable is required');
}
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

const ADMIN_USERNAME: string = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD: string = process.env.ADMIN_PASSWORD;
const JWT_SECRET: string = process.env.JWT_SECRET;
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '24h';

export interface AdminAuthRequest extends Request {
  admin?: {
    username: string;
    isAdmin: boolean;
  };
}

/**
 * Admin login endpoint
 */
export const adminLogin = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Validate admin credentials
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      logger.warn('Failed admin login attempt', { username, ip: req.ip });
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    // Generate JWT token
    const payload = { 
      username: ADMIN_USERNAME, 
      isAdmin: true,
      iat: Math.floor(Date.now() / 1000)
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    logger.info('Successful admin login', { username, ip: req.ip });

    res.json({
      success: true,
      token,
      expiresIn: JWT_EXPIRES_IN,
      message: 'Admin login successful'
    });
  } catch (error) {
    logger.error('Admin login error', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Admin authentication middleware
 */
export const requireAdminAuth = (req: AdminAuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      if (!decoded.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin privileges required'
        });
      }

      // Attach admin info to request
      req.admin = {
        username: decoded.username,
        isAdmin: decoded.isAdmin
      };

      next();
    } catch (jwtError) {
      logger.warn('Invalid admin token', { error: jwtError instanceof Error ? jwtError.message : 'Unknown JWT error', ip: req.ip });
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired admin token'
      });
    }
  } catch (error) {
    logger.error('Admin auth middleware error', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Admin token validation endpoint
 */
export const validateAdminToken = (req: AdminAuthRequest, res: Response) => {
  res.json({
    success: true,
    admin: req.admin,
    message: 'Admin token is valid'
  });
}; 