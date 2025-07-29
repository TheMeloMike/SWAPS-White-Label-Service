import { LoggingService } from '../utils/logging/LoggingService';

interface GatewayStats {
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  lastSuccess: number | null;
  averageResponseTime: number;
  lastUsed: number;
}

interface CollectionGatewayMapping {
  [collectionSymbol: string]: {
    preferredGateways: string[];
    lastUpdated: number;
  };
}

class IPFSGatewayService {
  private gatewayStats: Map<string, GatewayStats> = new Map();
  private collectionMappings: CollectionGatewayMapping = {};
  private logger = LoggingService.getInstance().createLogger('IPFSGatewayService');
  
  // Default gateways in initial priority order
  private defaultGateways = [
    'https://cloudflare-ipfs.com/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://dweb.link/ipfs/',
    'https://ipfs.fleek.co/ipfs/',
    'https://nftstorage.link/ipfs/'
  ];

  constructor() {
    // Initialize stats for all default gateways
    this.defaultGateways.forEach(gateway => {
      this.gatewayStats.set(gateway, {
        totalAttempts: 0,
        successCount: 0,
        failureCount: 0,
        lastSuccess: null,
        averageResponseTime: 0,
        lastUsed: 0
      });
    });
    
    // Load any saved stats from persistent storage if available
    this.loadStats();
    
    // Schedule periodic cleanup and stats persistence
    setInterval(() => this.persistStats(), 30 * 60 * 1000); // Every 30 minutes
  }

  /**
   * Get a prioritized list of gateways to try for a specific CID
   */
  getPrioritizedGateways(cid: string, collectionSymbol?: string): string[] {
    const operation = this.logger.operation('ipfs-gateway-prioritize');
    
    // Start with a copy of all gateways
    let gateways = [...this.defaultGateways];
    
    // If we have a preferred list for this collection, prioritize those gateways
    if (collectionSymbol && this.collectionMappings[collectionSymbol]) {
      const preferredGateways = this.collectionMappings[collectionSymbol].preferredGateways;
      operation.info(`Using collection-specific gateway preferences for ${collectionSymbol}`);
      
      // Move preferred gateways to the front of the list, maintaining their relative order
      preferredGateways.forEach(gateway => {
        const index = gateways.indexOf(gateway);
        if (index !== -1) {
          gateways.splice(index, 1);
          gateways.unshift(gateway);
        }
      });
    } else {
      // Sort by success rate (descending), then by average response time (ascending)
      gateways.sort((a, b) => {
        const statsA = this.gatewayStats.get(a) || {
          successCount: 0, totalAttempts: 0, averageResponseTime: 0, lastSuccess: null
        };
        const statsB = this.gatewayStats.get(b) || {
          successCount: 0, totalAttempts: 0, averageResponseTime: 0, lastSuccess: null
        };
        
        // Calculate success rates
        const successRateA = statsA.totalAttempts > 0 ? statsA.successCount / statsA.totalAttempts : 0;
        const successRateB = statsB.totalAttempts > 0 ? statsB.successCount / statsB.totalAttempts : 0;
        
        // First compare success rates
        if (Math.abs(successRateA - successRateB) > 0.05) { // 5% threshold
          return successRateB - successRateA; // Higher success rate first
        }
        
        // If success rates are similar, compare recency of last success
        if (statsA.lastSuccess && statsB.lastSuccess && 
            Math.abs(statsA.lastSuccess - statsB.lastSuccess) > 5 * 60 * 1000) { // 5 min threshold
          return statsB.lastSuccess - statsA.lastSuccess; // More recent success first
        }
        
        // If still tied, use average response time
        return statsA.averageResponseTime - statsB.averageResponseTime; // Faster response first
      });
      
      operation.info(`Using dynamically prioritized gateways based on performance metrics`);
    }
    
    // Format the URLs for this specific CID
    const gatewayUrls = gateways.map(baseGateway => `${baseGateway}${cid}`);
    operation.info(`Prioritized ${gatewayUrls.length} gateways for CID ${cid.substring(0, 10)}...`);
    operation.end();
    
    return gatewayUrls;
  }

  /**
   * Record a successful gateway request
   */
  recordSuccess(gatewayUrl: string, responseTimeMs: number, collectionSymbol?: string): void {
    // Extract the base gateway URL
    const baseGateway = this.extractBaseGateway(gatewayUrl);
    if (!baseGateway) return;
    
    const stats = this.gatewayStats.get(baseGateway) || {
      totalAttempts: 0,
      successCount: 0,
      failureCount: 0,
      lastSuccess: null,
      averageResponseTime: 0,
      lastUsed: 0
    };
    
    // Update stats
    stats.totalAttempts++;
    stats.successCount++;
    stats.lastSuccess = Date.now();
    stats.lastUsed = Date.now();
    
    // Update average response time with exponential moving average
    const alpha = 0.3; // Weight for new value
    stats.averageResponseTime = alpha * responseTimeMs + (1 - alpha) * stats.averageResponseTime;
    
    this.gatewayStats.set(baseGateway, stats);
    
    // If we have collection info, update collection preferences
    if (collectionSymbol) {
      this.updateCollectionPreference(collectionSymbol, baseGateway);
    }
  }

  /**
   * Record a failed gateway request
   */
  recordFailure(gatewayUrl: string): void {
    // Extract the base gateway URL
    const baseGateway = this.extractBaseGateway(gatewayUrl);
    if (!baseGateway) return;
    
    const stats = this.gatewayStats.get(baseGateway) || {
      totalAttempts: 0,
      successCount: 0,
      failureCount: 0,
      lastSuccess: null,
      averageResponseTime: 0,
      lastUsed: 0
    };
    
    // Update stats
    stats.totalAttempts++;
    stats.failureCount++;
    stats.lastUsed = Date.now();
    
    this.gatewayStats.set(baseGateway, stats);
  }

  /**
   * Extract the base gateway URL from a full gateway URL
   */
  private extractBaseGateway(fullUrl: string): string | null {
    // Match against known gateway patterns
    for (const baseGateway of this.defaultGateways) {
      if (fullUrl.startsWith(baseGateway)) {
        return baseGateway;
      }
    }
    return null;
  }

  /**
   * Update collection-specific gateway preferences
   */
  private updateCollectionPreference(collectionSymbol: string, successfulGateway: string): void {
    // Get or initialize collection mapping
    const mapping = this.collectionMappings[collectionSymbol] || {
      preferredGateways: [],
      lastUpdated: 0
    };
    
    // Add this gateway to preferred list if not already there
    if (!mapping.preferredGateways.includes(successfulGateway)) {
      mapping.preferredGateways.push(successfulGateway);
      // Keep list at reasonable size
      if (mapping.preferredGateways.length > 3) {
        mapping.preferredGateways.shift(); // Remove oldest
      }
    } else {
      // Move to the end (most recent successful)
      const index = mapping.preferredGateways.indexOf(successfulGateway);
      mapping.preferredGateways.splice(index, 1);
      mapping.preferredGateways.push(successfulGateway);
    }
    
    mapping.lastUpdated = Date.now();
    this.collectionMappings[collectionSymbol] = mapping;
  }

  /**
   * Save stats to persistent storage (optional)
   */
  private persistStats(): void {
    // In a production implementation, this would save to Redis, database, etc.
    // For now, just log the current stats
    this.logger.info('IPFS Gateway stats snapshot', {
      gatewayCount: this.gatewayStats.size,
      collectionMappings: Object.keys(this.collectionMappings).length,
      timestamp: new Date().toISOString()
    });
    
    // Clean up old/unused entries
    this.cleanupStats();
  }

  /**
   * Load stats from persistent storage (optional)
   */
  private loadStats(): void {
    // In a production implementation, this would load from Redis, database, etc.
    this.logger.info('Initialized IPFS Gateway service with default settings');
  }

  /**
   * Clean up old or unused gateway stats
   */
  private cleanupStats(): void {
    const now = Date.now();
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
    
    // Clean up old collection mappings
    Object.keys(this.collectionMappings).forEach(collectionSymbol => {
      if (now - this.collectionMappings[collectionSymbol].lastUpdated > ONE_WEEK) {
        delete this.collectionMappings[collectionSymbol];
      }
    });
  }

  /**
   * Get stats for all gateways (for monitoring)
   */
  getGatewayStats(): Record<string, GatewayStats> {
    const stats: Record<string, GatewayStats> = {};
    this.gatewayStats.forEach((value, key) => {
      stats[key] = { ...value };
    });
    return stats;
  }
}

// Export as singleton
export const ipfsGatewayService = new IPFSGatewayService(); 