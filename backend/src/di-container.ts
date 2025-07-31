/**
 * Dependency Injection Container Setup - White Label API
 * 
 * This file sets up the DI container for the SWAPS White Label API.
 * Only registers services needed for the white label B2B platform.
 */

import "reflect-metadata"; // Required for tsyringe
import { container } from "tsyringe";

// Core services that exist
import { LoggingService } from './utils/logging/LoggingService';
import { TradeDiscoveryService } from './services/trade/TradeDiscoveryService';
import { PersistentTradeDiscoveryService } from './services/trade/PersistentTradeDiscoveryService';
import { TenantManagementService } from './services/tenant/TenantManagementService';

// Restored essential services
import { NFTService } from './services/nft/NFTService';
import { NFTPricingService } from './services/nft/NFTPricingService';
import { LocalCollectionService } from './services/nft/LocalCollectionService';
import { DataSyncService } from './services/data/DataSyncService';

// Check if these services exist before importing
let UniversalNFTIngestionService: any;
let WebhookNotificationService: any;
let ProductionMonitorService: any;
let AlgorithmRegressionTestSuite: any;

try {
  UniversalNFTIngestionService = require('./services/ingestion/UniversalNFTIngestionService').UniversalNFTIngestionService;
} catch (error) {
  console.log('[DI-Container] UniversalNFTIngestionService not available');
}

try {
  WebhookNotificationService = require('./services/notifications/WebhookNotificationService').WebhookNotificationService;
} catch (error) {
  console.log('[DI-Container] WebhookNotificationService not available');
}

try {
  ProductionMonitorService = require('./services/monitoring/ProductionMonitorService').ProductionMonitorService;
} catch (error) {
  console.log('[DI-Container] ProductionMonitorService not available');
}

try {
  AlgorithmRegressionTestSuite = require('./services/validation/AlgorithmRegressionTestSuite').AlgorithmRegressionTestSuite;
} catch (error) {
  console.log('[DI-Container] AlgorithmRegressionTestSuite not available');
}

// Persistence
import { FilePersistenceManager } from './lib/persistence/FilePersistenceManager';

/**
 * Register white label services with the DI container
 */
export function registerServices(): void {
  console.log('[DI-Container] Registering white label services...');

  try {
    // Core logging service
    container.registerSingleton("LoggingService", LoggingService);
    console.log('[DI-Container] ✅ LoggingService registered');

    // Core trade discovery service (uses singleton pattern)
    const tradeDiscoveryService = TradeDiscoveryService.getInstance();
    container.register("TradeDiscoveryService", {
      useFactory: () => tradeDiscoveryService
    });
    console.log('[DI-Container] ✅ TradeDiscoveryService registered');

    // Restored essential services - use getInstance for singleton services
    const nftService = NFTService.getInstance();
    container.register("NFTService", {
      useFactory: () => nftService
    });
    console.log('[DI-Container] ✅ NFTService registered');

    const nftPricingService = NFTPricingService.getInstance();
    container.register("NFTPricingService", {
      useFactory: () => nftPricingService
    });
    console.log('[DI-Container] ✅ NFTPricingService registered');

    // LocalCollectionService uses singleton pattern
    const localCollectionService = LocalCollectionService.getInstance();
    container.register("LocalCollectionService", {
      useFactory: () => localCollectionService
    });
    console.log('[DI-Container] ✅ LocalCollectionService registered');

    container.registerSingleton("DataSyncService", DataSyncService);
    console.log('[DI-Container] ✅ DataSyncService registered');

    // Persistent trade discovery service (singleton pattern)
    if (PersistentTradeDiscoveryService) {
      const persistentTradeService = PersistentTradeDiscoveryService.getInstance();
      container.register("PersistentTradeDiscoveryService", {
        useFactory: () => persistentTradeService
      });
      console.log('[DI-Container] ✅ PersistentTradeDiscoveryService registered');
    }

    // Tenant management service (singleton pattern)
    if (TenantManagementService) {
      const tenantService = TenantManagementService.getInstance();
      container.register("TenantManagementService", {
        useFactory: () => tenantService
      });
      console.log('[DI-Container] ✅ TenantManagementService registered');
    }

    // Optional services (if they exist)
    if (UniversalNFTIngestionService) {
      const ingestionService = UniversalNFTIngestionService.getInstance();
      container.register("UniversalNFTIngestionService", {
        useFactory: () => ingestionService
      });
      console.log('[DI-Container] ✅ UniversalNFTIngestionService registered');
    }

    if (WebhookNotificationService) {
      const webhookService = WebhookNotificationService.getInstance();
      container.register("WebhookNotificationService", {
        useFactory: () => webhookService
      });
      console.log('[DI-Container] ✅ WebhookNotificationService registered');
    }

    if (ProductionMonitorService) {
      const monitorService = ProductionMonitorService.getInstance();
      container.register("ProductionMonitorService", {
        useFactory: () => monitorService
      });
      console.log('[DI-Container] ✅ ProductionMonitorService registered');
    }

    if (AlgorithmRegressionTestSuite) {
      const regressionSuite = AlgorithmRegressionTestSuite.getInstance();
      container.register("AlgorithmRegressionTestSuite", {
        useFactory: () => regressionSuite
      });
      console.log('[DI-Container] ✅ AlgorithmRegressionTestSuite registered');
    }

    // File persistence (fallback for data storage)
    container.registerSingleton("FilePersistenceManager", FilePersistenceManager);
    console.log('[DI-Container] ✅ FilePersistenceManager registered');

    console.log('[DI-Container] ✅ All available white label services registered successfully');
  } catch (error) {
    console.error('[DI-Container CRITICAL] Failed to register services:', error);
    throw error; // Fail fast - critical registration failure
  }
}

/**
 * Reset the container (mainly for testing)
 */
export function resetContainer(): void {
  container.reset();
  console.log('[DI-Container] Container reset');
}

/**
 * Get a service from the container
 */
export function getService<T>(token: string): T {
  return container.resolve<T>(token);
}

// Export the container for direct access when needed
export { container }; 