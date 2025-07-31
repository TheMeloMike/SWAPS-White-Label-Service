import { LoggingService, Logger } from '../../utils/logging/LoggingService';

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string;
  rolloutPercentage: number; // 0-100
  enabledFor?: string[]; // Specific wallet addresses
  disabledFor?: string[]; // Blacklisted wallet addresses
  enabledEnvironments?: string[]; // dev, staging, production
  createdAt: Date;
  lastModified: Date;
  modifiedBy?: string;
}

export interface FeatureFlagConfig {
  [key: string]: FeatureFlag;
}

/**
 * Feature flag service for controlled rollout of AI enhancements
 * Provides instant rollback capability and gradual user exposure
 */
export class FeatureFlagService {
  private static instance: FeatureFlagService;
  private logger: Logger;
  private flags: Map<string, FeatureFlag> = new Map();
  private userBuckets: Map<string, number> = new Map(); // wallet -> bucket (0-99)
  
  // Default feature flags for AI enhancements
  private readonly DEFAULT_FLAGS: FeatureFlagConfig = {
    'enhanced_market_intelligence': {
      name: 'enhanced_market_intelligence',
      enabled: true,
      description: 'Enhanced AI with real-time market data from Magic Eden and Tensor',
      rolloutPercentage: 10, // Start with 10% of users
      enabledEnvironments: ['development', 'staging', 'production'],
      createdAt: new Date(),
      lastModified: new Date()
    },
    'real_time_notifications': {
      name: 'real_time_notifications',
      enabled: true, // Now enabled
      description: 'Real-time trade opportunity notifications via WebSocket',
      rolloutPercentage: 15, // Start with 15% of users
      enabledEnvironments: ['development', 'staging', 'production'],
      createdAt: new Date(),
      lastModified: new Date()
    },
    'personalized_insights': {
      name: 'personalized_insights',
      enabled: true,
      description: 'Personalized portfolio analysis and recommendations',
      rolloutPercentage: 25, // 25% of users
      enabledEnvironments: ['development', 'staging', 'production'],
      createdAt: new Date(),
      lastModified: new Date()
    },
    'advanced_market_analysis': {
      name: 'advanced_market_analysis',
      enabled: true,
      description: 'Advanced market sentiment and trend analysis',
      rolloutPercentage: 50, // 50% of users
      enabledEnvironments: ['development', 'staging', 'production'],
      createdAt: new Date(),
      lastModified: new Date()
    },
    'ai_circuit_breaker': {
      name: 'ai_circuit_breaker',
      enabled: true,
      description: 'Circuit breaker for AI services when external APIs fail',
      rolloutPercentage: 100, // All users - safety feature
      enabledEnvironments: ['development', 'staging', 'production'],
      createdAt: new Date(),
      lastModified: new Date()
    }
  };

  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('FeatureFlagService');
    this.initializeFlags();
    this.logger.info('FeatureFlagService initialized', {
      flagCount: this.flags.size,
      environment: process.env.NODE_ENV
    });
  }

  public static getInstance(): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      FeatureFlagService.instance = new FeatureFlagService();
    }
    return FeatureFlagService.instance;
  }

  /**
   * Initialize feature flags with defaults
   */
  private initializeFlags(): void {
    Object.values(this.DEFAULT_FLAGS).forEach(flag => {
      this.flags.set(flag.name, { ...flag });
    });
    
    // Override with environment variables if present
    this.loadEnvironmentOverrides();
  }

  /**
   * Load feature flag overrides from environment variables
   */
  private loadEnvironmentOverrides(): void {
    Object.keys(this.DEFAULT_FLAGS).forEach(flagName => {
      const envKey = `FEATURE_${flagName.toUpperCase()}`;
      const envValue = process.env[envKey];
      
      if (envValue !== undefined) {
        const flag = this.flags.get(flagName);
        if (flag) {
          // Support boolean values
          if (envValue.toLowerCase() === 'true' || envValue.toLowerCase() === 'false') {
            flag.enabled = envValue.toLowerCase() === 'true';
            flag.lastModified = new Date();
            flag.modifiedBy = 'environment';
            this.logger.info(`Feature flag ${flagName} overridden by environment: ${flag.enabled}`);
          }
          
          // Support percentage values
          const percentage = parseInt(envValue);
          if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
            flag.rolloutPercentage = percentage;
            flag.lastModified = new Date();
            flag.modifiedBy = 'environment';
            this.logger.info(`Feature flag ${flagName} rollout percentage set to ${percentage}%`);
          }
        }
      }
    });
  }

  /**
   * Check if a feature is enabled for a specific user
   */
  public isEnabled(flagName: string, walletAddress?: string): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) {
      this.logger.warn(`Feature flag ${flagName} not found, defaulting to disabled`);
      return false;
    }

    // Check if flag is disabled globally
    if (!flag.enabled) {
      return false;
    }

    // Check environment restrictions
    const currentEnv = process.env.NODE_ENV || 'development';
    if (flag.enabledEnvironments && !flag.enabledEnvironments.includes(currentEnv)) {
      return false;
    }

    // Check specific user overrides
    if (walletAddress) {
      // Check blacklist
      if (flag.disabledFor && flag.disabledFor.includes(walletAddress)) {
        return false;
      }

      // Check whitelist
      if (flag.enabledFor && flag.enabledFor.includes(walletAddress)) {
        return true;
      }

      // Check rollout percentage
      if (flag.rolloutPercentage < 100) {
        const userBucket = this.getUserBucket(walletAddress);
        return userBucket < flag.rolloutPercentage;
      }
    }

    // Default to rollout percentage for anonymous users
    if (!walletAddress && flag.rolloutPercentage < 100) {
      return Math.random() * 100 < flag.rolloutPercentage;
    }

    return true;
  }

  /**
   * Get user bucket for consistent rollout (same user always gets same result)
   */
  private getUserBucket(walletAddress: string): number {
    if (this.userBuckets.has(walletAddress)) {
      return this.userBuckets.get(walletAddress)!;
    }

    // Create deterministic bucket based on wallet address
    let hash = 0;
    for (let i = 0; i < walletAddress.length; i++) {
      const char = walletAddress.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    const bucket = Math.abs(hash) % 100;
    this.userBuckets.set(walletAddress, bucket);
    return bucket;
  }

  /**
   * Enable a feature flag
   */
  public enableFlag(flagName: string, rolloutPercentage: number = 100): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) {
      this.logger.error(`Cannot enable unknown feature flag: ${flagName}`);
      return false;
    }

    flag.enabled = true;
    flag.rolloutPercentage = Math.max(0, Math.min(100, rolloutPercentage));
    flag.lastModified = new Date();
    flag.modifiedBy = 'manual';

    this.logger.info(`Feature flag ${flagName} enabled with ${rolloutPercentage}% rollout`);
    return true;
  }

  /**
   * Disable a feature flag (instant rollback)
   */
  public disableFlag(flagName: string): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) {
      this.logger.error(`Cannot disable unknown feature flag: ${flagName}`);
      return false;
    }

    flag.enabled = false;
    flag.lastModified = new Date();
    flag.modifiedBy = 'manual';

    this.logger.warn(`Feature flag ${flagName} DISABLED - instant rollback activated`);
    return true;
  }

  /**
   * Update rollout percentage for gradual rollout
   */
  public updateRollout(flagName: string, percentage: number): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) {
      this.logger.error(`Cannot update rollout for unknown feature flag: ${flagName}`);
      return false;
    }

    const oldPercentage = flag.rolloutPercentage;
    flag.rolloutPercentage = Math.max(0, Math.min(100, percentage));
    flag.lastModified = new Date();
    flag.modifiedBy = 'manual';

    this.logger.info(`Feature flag ${flagName} rollout updated: ${oldPercentage}% → ${percentage}%`);
    return true;
  }

  /**
   * Add user to whitelist for a feature
   */
  public whitelistUser(flagName: string, walletAddress: string): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) {
      this.logger.error(`Cannot whitelist user for unknown feature flag: ${flagName}`);
      return false;
    }

    if (!flag.enabledFor) {
      flag.enabledFor = [];
    }

    if (!flag.enabledFor.includes(walletAddress)) {
      flag.enabledFor.push(walletAddress);
      flag.lastModified = new Date();
      flag.modifiedBy = 'manual';
      this.logger.info(`User ${walletAddress.substring(0, 8)}... whitelisted for ${flagName}`);
    }

    return true;
  }

  /**
   * Remove user from whitelist
   */
  public removeWhitelist(flagName: string, walletAddress: string): boolean {
    const flag = this.flags.get(flagName);
    if (!flag || !flag.enabledFor) {
      return false;
    }

    const index = flag.enabledFor.indexOf(walletAddress);
    if (index > -1) {
      flag.enabledFor.splice(index, 1);
      flag.lastModified = new Date();
      flag.modifiedBy = 'manual';
      this.logger.info(`User ${walletAddress.substring(0, 8)}... removed from ${flagName} whitelist`);
    }

    return true;
  }

  /**
   * Add user to blacklist (disable feature for specific user)
   */
  public blacklistUser(flagName: string, walletAddress: string): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) {
      this.logger.error(`Cannot blacklist user for unknown feature flag: ${flagName}`);
      return false;
    }

    if (!flag.disabledFor) {
      flag.disabledFor = [];
    }

    if (!flag.disabledFor.includes(walletAddress)) {
      flag.disabledFor.push(walletAddress);
      flag.lastModified = new Date();
      flag.modifiedBy = 'manual';
      this.logger.info(`User ${walletAddress.substring(0, 8)}... blacklisted for ${flagName}`);
    }

    return true;
  }

  /**
   * Get all feature flags
   */
  public getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Get specific feature flag
   */
  public getFlag(flagName: string): FeatureFlag | null {
    return this.flags.get(flagName) || null;
  }

  /**
   * Get feature flag status for a user
   */
  public getFlagStatus(flagName: string, walletAddress?: string): {
    enabled: boolean;
    reason: string;
    rolloutPercentage: number;
  } {
    const flag = this.flags.get(flagName);
    if (!flag) {
      return {
        enabled: false,
        reason: 'Feature flag not found',
        rolloutPercentage: 0
      };
    }

    if (!flag.enabled) {
      return {
        enabled: false,
        reason: 'Feature globally disabled',
        rolloutPercentage: flag.rolloutPercentage
      };
    }

    const currentEnv = process.env.NODE_ENV || 'development';
    if (flag.enabledEnvironments && !flag.enabledEnvironments.includes(currentEnv)) {
      return {
        enabled: false,
        reason: `Not enabled for environment: ${currentEnv}`,
        rolloutPercentage: flag.rolloutPercentage
      };
    }

    if (walletAddress) {
      if (flag.disabledFor && flag.disabledFor.includes(walletAddress)) {
        return {
          enabled: false,
          reason: 'User blacklisted',
          rolloutPercentage: flag.rolloutPercentage
        };
      }

      if (flag.enabledFor && flag.enabledFor.includes(walletAddress)) {
        return {
          enabled: true,
          reason: 'User whitelisted',
          rolloutPercentage: flag.rolloutPercentage
        };
      }

      if (flag.rolloutPercentage < 100) {
        const userBucket = this.getUserBucket(walletAddress);
        const enabled = userBucket < flag.rolloutPercentage;
        return {
          enabled,
          reason: enabled ? `User in rollout (bucket ${userBucket})` : `User not in rollout (bucket ${userBucket})`,
          rolloutPercentage: flag.rolloutPercentage
        };
      }
    }

    return {
      enabled: true,
      reason: 'Feature fully enabled',
      rolloutPercentage: flag.rolloutPercentage
    };
  }

  /**
   * Emergency disable all AI enhancements
   */
  public emergencyDisableAll(): void {
    this.logger.error('EMERGENCY: Disabling all AI enhancement features');
    
    this.flags.forEach((flag, flagName) => {
      if (flagName !== 'ai_circuit_breaker') { // Keep circuit breaker active
        flag.enabled = false;
        flag.lastModified = new Date();
        flag.modifiedBy = 'emergency';
      }
    });
    
    this.logger.error('All AI enhancement features disabled via emergency stop');
  }

  /**
   * Get usage statistics
   */
  public getUsageStats(): {
    totalFlags: number;
    enabledFlags: number;
    usersInBuckets: number;
    flagsPerEnvironment: Record<string, number>;
  } {
    const currentEnv = process.env.NODE_ENV || 'development';
    const enabledFlags = Array.from(this.flags.values()).filter(flag => flag.enabled).length;
    const flagsForCurrentEnv = Array.from(this.flags.values())
      .filter(flag => !flag.enabledEnvironments || flag.enabledEnvironments.includes(currentEnv)).length;

    return {
      totalFlags: this.flags.size,
      enabledFlags,
      usersInBuckets: this.userBuckets.size,
      flagsPerEnvironment: {
        [currentEnv]: flagsForCurrentEnv
      }
    };
  }

  /**
   * Reset all user buckets (force re-bucketing)
   */
  public resetUserBuckets(): void {
    this.userBuckets.clear();
    this.logger.info('All user buckets reset - users will be re-bucketed on next check');
  }
} 