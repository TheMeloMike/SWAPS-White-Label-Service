/**
 * Dependency Injection Container Setup
 * 
 * This file sets up the DI container and registers all service implementations.
 * It centralizes all dependency registrations to make them easy to manage.
 */

import "reflect-metadata"; // Required for tsyringe
import { container } from "tsyringe";
import { Helius } from 'helius-sdk';

// Interfaces
import { 
  ILoggingService, 
  INFTService, 
  INFTPricingService,
  IWalletService,
  ITradeDiscoveryService,
  IPersistenceManager,
  ICacheService
} from './types/services';

// Service implementations
import { LoggingService } from './utils/logging/LoggingService';
import { NFTService } from './services/nft/NFTService';
import { NFTPricingService } from './services/nft/NFTPricingService';
import { WalletService } from './services/trade/WalletService';
import { TradeDiscoveryService } from './services/trade/TradeDiscoveryService';
import { RedisPersistenceManager } from './lib/persistence/RedisPersistenceManager';
import { FilePersistenceManager } from './lib/persistence/FilePersistenceManager';
import { TrendingService } from './services/TrendingService';
import { TrendingController } from './controllers/TrendingController';
import { GlobalCacheService } from './services/cache/GlobalCacheService';
import { CollectionAbstractionService } from './services/trade/CollectionAbstractionService';
import { CollectionIndexingService } from './services/nft/CollectionIndexingService';
import { DynamicValuationService } from './services/trade/DynamicValuationService';
import { TradeLoopFinderService } from './services/trade/TradeLoopFinderService';
import { ScalableTradeLoopFinderService } from './services/trade/ScalableTradeLoopFinderService';
import { GraphPartitioningService } from './services/trade/GraphPartitioningService';
import { TradeScoreService } from './services/trade/TradeScoreService';
import { BundleTradeLoopFinderService } from './services/trade/BundleTradeLoopFinderService';
import { SCCFinderService } from './services/trade/SCCFinderService';
import { CycleFinderService } from './services/trade/CycleFinderService';
import { LocalCollectionService } from './services/nft/LocalCollectionService';
import { CollectionConfigService } from './services/trade/CollectionConfigService';
import { DataSyncService } from './services/data/DataSyncService';

/**
 * Register all services with the DI container
 */
export function registerServices(): void {
  // Register DataSyncService first as it's needed by other services
  container.registerSingleton<DataSyncService>("DataSyncService", DataSyncService);

  // Register external dependencies
  container.register<Helius>("Helius", {
    useFactory: () => {
      const apiKey = process.env.HELIUS_API_KEY;
      if (!apiKey) {
        throw new Error('HELIUS_API_KEY environment variable is required');
      }
      return new Helius(apiKey);
    }
  });

  // Register service implementations
  container.register<ILoggingService>("ILoggingService", { 
    useClass: LoggingService 
  });
  
  // Register NFTService and NFTPricingService as singletons if applicable
  container.registerSingleton<INFTService>("INFTService", NFTService);
  container.registerSingleton<INFTPricingService>("INFTPricingService", NFTPricingService);

  // Register WalletService normally (assuming it's not strictly a singleton)
  container.register("IWalletService", { 
    useClass: WalletService 
  });
  
  // FIXED: Use getInstance pattern but with proper error handling
  try {
    const tradeDiscoveryServiceInstance = TradeDiscoveryService.getInstance();
    if (!tradeDiscoveryServiceInstance) {
      throw new Error("TradeDiscoveryService.getInstance() returned null/undefined");
    }
    container.register("ITradeDiscoveryService", {
      useFactory: () => tradeDiscoveryServiceInstance
    });
    console.log('[DI-Container] TradeDiscoveryService registered successfully');
  } catch (error) {
    console.error('[DI-Container CRITICAL] Failed to register TradeDiscoveryService:', error);
    throw error; // Fail fast - critical registration failure
  }
  
  // Register PersistenceManager as a singleton based on environment
  if (process.env.USE_REDIS === 'true') {
    container.registerSingleton<IPersistenceManager>("IPersistenceManager", RedisPersistenceManager);
  } else {
    container.registerSingleton<IPersistenceManager>("IPersistenceManager", FilePersistenceManager);
  }

  // Register Cache Service
  container.registerSingleton<ICacheService>("ICacheService", GlobalCacheService);

  // Register new services and controllers
  container.registerSingleton<TrendingService>(TrendingService, TrendingService);
  container.registerSingleton<TrendingController>(TrendingController, TrendingController);

  // Register CollectionAbstractionService
  container.register("CollectionAbstractionService", {
    useFactory: () => CollectionAbstractionService.getInstance()
  });

  // Register LocalCollectionService
  container.register("LocalCollectionService", {
    useFactory: () => LocalCollectionService.getInstance()
  });

  // Register CollectionConfigService
  container.register("CollectionConfigService", {
    useFactory: () => CollectionConfigService.getInstance()
  });

  // Note: Collection and trade services use getInstance() singleton pattern
  // and cannot be registered with DI container due to private constructors.
  // They are accessed directly via:
  // - CollectionIndexingService.getInstance()
  // - CollectionAbstractionService.getInstance()
  // - DynamicValuationService.getInstance()
  // - ScalableTradeLoopFinderService.getInstance()
  // - Other singleton pattern services
}

/**
 * Reset the container (mainly for testing)
 */
export function resetContainer(): void {
  container.reset();
}

// Export the container for direct access when needed
export { container }; 