import { Request, Response, NextFunction } from 'express';
import { TenantManagementService } from '../services/tenant/TenantManagementService';
import { LoggingService } from '../utils/logging/LoggingService';
import { ErrorResponses } from '../utils/errorResponses';

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
      // Extract API key from either X-API-Key header (preferred) or Authorization header (legacy)
      let apiKey: string | undefined;
      
      // Try X-API-Key header first (documented format)
      const xApiKey = req.headers['x-api-key'] as string;
      if (xApiKey) {
        apiKey = xApiKey;
      } else {
        // Fallback to Authorization Bearer format
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
        }
      }
      
      if (!apiKey) {
        operation.warn('Missing API key', {
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        res.status(401).json({
          error: 'Unauthorized',
          message: 'API key required. Use X-API-Key header or Authorization: Bearer <api_key>'
        });
        operation.end();
        return;
      }
      
      // Validate API key format
      if (!apiKey || !apiKey.startsWith('swaps_') || apiKey.length < 20) {
        operation.warn('Invalid API key format', {
          path: req.path,
          method: req.method,
          keyPrefix: apiKey?.substring(0, 10) + '...',
          ip: req.ip
        });
        
        ErrorResponses.sendError(res, ErrorResponses.invalidApiKey('Invalid API key format'));
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
        
        ErrorResponses.sendError(res, ErrorResponses.invalidApiKey());
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

  /**
   * Optional authentication - adds tenant info if valid API key provided, but doesn't require it
   */
  public authenticateOptional = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const operation = this.logger.operation('authenticateOptional');
    
    try {
      // Try to extract API key
      const apiKey = this.extractApiKey(req);
      
      if (!apiKey) {
        // No API key provided - continue without tenant context
        operation.info('No API key provided, continuing without tenant context');
        operation.end();
        next();
        return;
      }
      
      // Try to find tenant by API key
      const tenant = await this.tenantService.getTenantByApiKey(apiKey);
      
      if (!tenant) {
        // Invalid API key - continue without tenant context (don't fail)
        operation.warn('Invalid API key provided, continuing without tenant context');
        operation.end();
        next();
        return;
      }
      
      // Valid tenant found - add to request context
      req.tenant = tenant;
      
      // Update usage tracking
      await this.tenantService.trackApiUsage(tenant.id, req.path);
      
      operation.info('Optional authentication successful', {
        tenantId: tenant.id,
        tenantName: tenant.name
      });
      operation.end();
      next();
      
    } catch (error) {
      // Log error but don't fail the request
      operation.error('Optional authentication error', {
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      next(); // Continue without tenant context
    }
  };
}

// Export middleware instance
export const tenantAuth = new TenantAuthMiddleware(); 