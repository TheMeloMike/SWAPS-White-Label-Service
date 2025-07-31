import { Request, Response, NextFunction } from 'express';
import { TenantManagementService } from '../services/tenant/TenantManagementService';
import { LoggingService } from '../utils/logging/LoggingService';

/**
 * Extended Request interface with tenant information
 */
export interface AuthenticatedRequest extends Request {
  tenant?: any;
}

/**
 * Tenant Authentication Middleware
 * 
 * Validates API keys and attaches tenant information to requests.
 * Provides secure access control for white label partners.
 */
export class TenantAuthMiddleware {
  private tenantService: TenantManagementService;
  private logger = LoggingService.getInstance().createLogger('TenantAuth');

  constructor() {
    this.tenantService = TenantManagementService.getInstance();
  }

  /**
   * Middleware function to authenticate tenant requests
   */
  public authenticate = async (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    const operation = this.logger.operation('authenticateRequest');
    
    try {
      // Extract API key from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        operation.warn('Missing or invalid authorization header', {
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        res.status(401).json({
          error: 'Unauthorized',
          message: 'API key required. Use Authorization: Bearer <api_key>'
        });
        operation.end();
        return;
      }

      const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      // Validate API key format
      if (!apiKey || !apiKey.startsWith('swaps_') || apiKey.length < 20) {
        operation.warn('Invalid API key format', {
          path: req.path,
          method: req.method,
          keyPrefix: apiKey?.substring(0, 10) + '...',
          ip: req.ip
        });
        
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid API key format'
        });
        operation.end();
        return;
      }

      // Look up tenant by API key
      const tenant = await this.tenantService.getTenantByApiKey(apiKey);
      if (!tenant) {
        operation.warn('API key not found', {
          path: req.path,
          method: req.method,
          keyPrefix: apiKey.substring(0, 10) + '...',
          ip: req.ip
        });
        
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid API key'
        });
        operation.end();
        return;
      }

      // Attach tenant to request
      req.tenant = tenant;
      
      operation.info('Request authenticated successfully', {
        tenantId: tenant.id,
        tenantName: tenant.name,
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      operation.end();
      next();
    } catch (error) {
      operation.error('Authentication error', {
        error: error instanceof Error ? error.message : String(error),
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      res.status(500).json({
        error: 'Internal server error',
        message: 'Authentication service unavailable'
      });
      operation.end();
    }
  };

  /**
   * Optional middleware for admin-only endpoints
   */
  public requireAdmin = (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): void => {
    // Check if this is an admin request (for system management)
    const adminKey = process.env.ADMIN_API_KEY;
    const authHeader = req.headers.authorization;
    
    if (!adminKey || !authHeader || authHeader !== `Bearer ${adminKey}`) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required'
      });
      return;
    }
    
    next();
  };
}

// Export middleware instance
export const tenantAuth = new TenantAuthMiddleware(); 