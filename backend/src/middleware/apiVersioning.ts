/**
 * Enterprise API Versioning Middleware
 * Supports multiple versioning strategies for enterprise compatibility
 */

import { Request, Response, NextFunction } from 'express';
import { LoggingService } from '../utils/logging/LoggingService';
import { ErrorFactory } from '../utils/errors/StandardError';

interface VersionConfig {
  current: string;
  supported: string[];
  deprecated: string[];
  sunset: { [version: string]: Date };
  default: string;
}

interface ApiVersion {
  version: string;
  major: number;
  minor: number;
  patch: number;
  isSupported: boolean;
  isDeprecated: boolean;
  isSunset: boolean;
  sunsetDate?: Date;
}

export class ApiVersioning {
  private static logger = LoggingService.getInstance().createLogger('ApiVersioning');
  
  private static config: VersionConfig = {
    current: '1.0.0',
    supported: ['1.0.0'],
    deprecated: [],
    sunset: {},
    default: '1.0.0'
  };

  /**
   * Configure API versioning
   */
  public static configure(config: Partial<VersionConfig>) {
    this.config = { ...this.config, ...config };
    this.logger.info('API versioning configured', {
      current: this.config.current,
      supported: this.config.supported,
      deprecated: this.config.deprecated,
      default: this.config.default
    });
  }

  /**
   * Version detection middleware
   * Supports multiple version detection strategies:
   * 1. Accept header: Accept: application/vnd.swaps.v1+json
   * 2. Custom header: X-API-Version: 1.0.0
   * 3. URL parameter: /api/v1/endpoint
   * 4. Query parameter: ?version=1.0.0
   */
  public static detectVersion() {
    return (req: Request & { apiVersion?: ApiVersion }, res: Response, next: NextFunction) => {
      try {
        let requestedVersion: string | null = null;

        // Strategy 1: Accept header (most RESTful)
        const acceptHeader = req.get('Accept');
        if (acceptHeader) {
          const versionMatch = acceptHeader.match(/application\/vnd\.swaps\.v(\d+(?:\.\d+)?(?:\.\d+)?)\+json/);
          if (versionMatch) {
            requestedVersion = versionMatch[1];
            if (!requestedVersion.includes('.')) {
              requestedVersion += '.0.0';
            } else if (requestedVersion.split('.').length === 2) {
              requestedVersion += '.0';
            }
          }
        }

        // Strategy 2: Custom header
        if (!requestedVersion) {
          requestedVersion = req.get('X-API-Version') || null;
        }

        // Strategy 3: URL path (already handled by router structure)
        if (!requestedVersion) {
          const urlMatch = req.path.match(/^\/api\/v(\d+(?:\.\d+)?(?:\.\d+)?)\//);
          if (urlMatch) {
            requestedVersion = urlMatch[1];
            if (!requestedVersion.includes('.')) {
              requestedVersion += '.0.0';
            } else if (requestedVersion.split('.').length === 2) {
              requestedVersion += '.0';
            }
          }
        }

        // Strategy 4: Query parameter
        if (!requestedVersion) {
          requestedVersion = req.query.version as string || null;
        }

        // Use default if no version specified
        if (!requestedVersion) {
          requestedVersion = this.config.default;
        }

        // Parse and validate version
        const apiVersion = this.parseVersion(requestedVersion);
        
        if (!apiVersion.isSupported) {
          this.logger.warn('Unsupported API version requested', {
            requested: requestedVersion,
            supported: this.config.supported,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });

          const error = ErrorFactory.validationError(
            `API version ${requestedVersion} is not supported. Supported versions: ${this.config.supported.join(', ')}`,
            {
              requestedVersion,
              supportedVersions: this.config.supported,
              currentVersion: this.config.current
            }
          );
          
          throw error;
        }

        // Add version info to request
        req.apiVersion = apiVersion;

        // Add version headers to response
        res.set({
          'X-API-Version': apiVersion.version,
          'X-API-Current-Version': this.config.current,
          'X-API-Supported-Versions': this.config.supported.join(', ')
        });

        // Add deprecation warnings
        if (apiVersion.isDeprecated) {
          const sunsetDate = this.config.sunset[apiVersion.version];
          const warningMessage = sunsetDate 
            ? `API version ${apiVersion.version} is deprecated and will be sunset on ${sunsetDate.toISOString()}`
            : `API version ${apiVersion.version} is deprecated`;

          res.set({
            'Warning': `299 - "${warningMessage}"`,
            'Deprecation': 'true',
            'Sunset': sunsetDate ? sunsetDate.toISOString() : ''
          });

          this.logger.warn('Deprecated API version used', {
            version: apiVersion.version,
            sunsetDate: sunsetDate?.toISOString(),
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });
        }

        // Log version usage for analytics
        this.logger.debug('API version detected', {
          version: apiVersion.version,
          method: req.method,
          path: req.path,
          ip: req.ip
        });

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Parse version string into ApiVersion object
   */
  private static parseVersion(versionString: string): ApiVersion {
    const cleanVersion = versionString.replace(/^v/, ''); // Remove 'v' prefix if present
    const parts = cleanVersion.split('.').map(Number);
    
    const [major = 0, minor = 0, patch = 0] = parts;
    const normalizedVersion = `${major}.${minor}.${patch}`;

    const isSupported = this.config.supported.includes(normalizedVersion);
    const isDeprecated = this.config.deprecated.includes(normalizedVersion);
    const isSunset = this.config.sunset[normalizedVersion] ? 
      new Date() > this.config.sunset[normalizedVersion] : false;
    const sunsetDate = this.config.sunset[normalizedVersion];

    return {
      version: normalizedVersion,
      major,
      minor,
      patch,
      isSupported: isSupported && !isSunset,
      isDeprecated,
      isSunset,
      sunsetDate
    };
  }

  /**
   * Version-specific route handler
   * Allows different implementations for different API versions
   */
  public static versionHandler(handlers: { [version: string]: Function }) {
    return (req: Request & { apiVersion?: ApiVersion }, res: Response, next: NextFunction) => {
      if (!req.apiVersion) {
        const error = ErrorFactory.internalError(
          'API version not detected. Ensure version detection middleware is applied first.'
        );
        return next(error);
      }

      const handler = handlers[req.apiVersion.version] || 
                    handlers[`${req.apiVersion.major}.${req.apiVersion.minor}`] ||
                    handlers[`${req.apiVersion.major}`] ||
                    handlers['default'];

      if (!handler) {
        const error = ErrorFactory.validationError(
          `No handler available for API version ${req.apiVersion.version}`,
          { version: req.apiVersion.version, availableVersions: Object.keys(handlers) }
        );
        return next(error);
      }

      return handler(req, res, next);
    };
  }

  /**
   * Get version statistics for monitoring
   */
  public static getVersionStats() {
    return {
      current: this.config.current,
      supported: this.config.supported,
      deprecated: this.config.deprecated,
      sunset: Object.entries(this.config.sunset).map(([version, date]) => ({
        version,
        sunsetDate: date.toISOString()
      })),
      default: this.config.default
    };
  }

  /**
   * Add a new supported version
   */
  public static addSupportedVersion(version: string) {
    if (!this.config.supported.includes(version)) {
      this.config.supported.push(version);
      this.config.supported.sort(this.compareVersions);
      this.logger.info('New API version added', { version, supported: this.config.supported });
    }
  }

  /**
   * Deprecate a version
   */
  public static deprecateVersion(version: string, sunsetDate?: Date) {
    if (!this.config.deprecated.includes(version)) {
      this.config.deprecated.push(version);
      if (sunsetDate) {
        this.config.sunset[version] = sunsetDate;
      }
      this.logger.info('API version deprecated', { 
        version, 
        sunsetDate: sunsetDate?.toISOString(),
        deprecated: this.config.deprecated 
      });
    }
  }

  /**
   * Remove sunset versions
   */
  public static removeSunsetVersions() {
    const now = new Date();
    const toRemove: string[] = [];

    Object.entries(this.config.sunset).forEach(([version, sunsetDate]) => {
      if (now > sunsetDate) {
        toRemove.push(version);
      }
    });

    toRemove.forEach(version => {
      this.config.supported = this.config.supported.filter(v => v !== version);
      this.config.deprecated = this.config.deprecated.filter(v => v !== version);
      delete this.config.sunset[version];
    });

    if (toRemove.length > 0) {
      this.logger.info('Sunset API versions removed', { removed: toRemove });
    }

    return toRemove;
  }

  /**
   * Compare version strings for sorting
   */
  private static compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;

      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }

    return 0;
  }
}

/**
 * Pre-configured version detection for standard use
 */
export const detectApiVersion = ApiVersioning.detectVersion();

/**
 * Enterprise version configuration
 */
export const configureEnterpriseVersioning = () => {
  ApiVersioning.configure({
    current: '1.0.0',
    supported: ['1.0.0'],
    deprecated: [],
    sunset: {},
    default: '1.0.0'
  });
};

export default ApiVersioning;