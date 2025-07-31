import { EventEmitter } from 'events';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { TradeDiscoveryService } from './TradeDiscoveryService';
import { DeltaDetectionEngine, SubgraphData } from './DeltaDetectionEngine';
import { WebhookNotificationService } from '../notifications/WebhookNotificationService';
import { DataSyncBridge } from './DataSyncBridge';
import { 
  TenantTradeGraph, 
  AbstractNFT, 
  AbstractWallet, 
  GraphChange,
  TenantConfig 
} from '../../types/abstract';
import { TradeLoop, WalletState, TradeDiscoverySettings } from '../../types/trade';
import { NFTMetadata } from '../../types/nft';
import { Mutex } from 'async-mutex';

/**
 * Persistent Trade Discovery Service
 * 
 * Wraps the existing sophisticated TradeDiscoveryService with real-time
 * persistent state management and delta detection for white label partners.
 * 
 * Key Features:
 * - Maintains persistent trade graphs per tenant
 * - Delta detection for real-time performance
 * - Event-driven change notifications
 * - Preserves ALL existing algorithm sophistication
 * - Multi-tenant isolation
 */
export class PersistentTradeDiscoveryService extends EventEmitter {
  private static instance: PersistentTradeDiscoveryService;
  private logger: Logger;
  
  // Core components
  private deltaEngine: DeltaDetectionEngine;
  private baseTradeService: TradeDiscoveryService;
  private webhookService: WebhookNotificationService;
  private dataSyncBridge: DataSyncBridge;
  
  // Multi-tenant state management
  private tenantGraphs = new Map<string, TenantTradeGraph>();
  private tenantConfigs = new Map<string, TenantConfig>();
  private tenantMutexes = new Map<string, Mutex>();
  
  // Performance monitoring
  private performanceMetrics = {
    totalEventsProcessed: 0,
    avgEventProcessingTime: 0,
    realTimeNotifications: 0,
    backgroundDiscoveries: 0
  };

  private constructor() {
    super();
    this.logger = LoggingService.getInstance().createLogger('PersistentTradeDiscovery');
    
    // Initialize core components
    this.deltaEngine = new DeltaDetectionEngine();
    this.baseTradeService = TradeDiscoveryService.getInstance();
    this.webhookService = WebhookNotificationService.getInstance();
    this.dataSyncBridge = DataSyncBridge.getInstance();
    
    this.logger.info('PersistentTradeDiscoveryService initialized');
  }

  public static getInstance(): PersistentTradeDiscoveryService {
    if (!PersistentTradeDiscoveryService.instance) {
      PersistentTradeDiscoveryService.instance = new PersistentTradeDiscoveryService();
    }
    return PersistentTradeDiscoveryService.instance;
  }

  /**
   * Initialize tenant with configuration
   */
  public async initializeTenant(config: TenantConfig): Promise<void> {
    const operation = this.logger.operation('initializeTenant');
    
    try {
      // Create tenant graph
      const tenantGraph: TenantTradeGraph = {
        tenantId: config.id,
        nfts: new Map(),
        wallets: new Map(),
        wants: new Map(),
        collectionWants: new Map(),
        activeLoops: new Map(),
        lastUpdated: new Date(),
        changeLog: []
      };
      
      // Store tenant data
      this.tenantGraphs.set(config.id, tenantGraph);
      this.tenantConfigs.set(config.id, config);
      this.tenantMutexes.set(config.id, new Mutex());
      
      operation.info('Tenant initialized', {
        tenantId: config.id,
        tenantName: config.name,
        algorithSettings: config.settings.algorithm
      });
      
      operation.end();
    } catch (error) {
      operation.error('Failed to initialize tenant', {
        tenantId: config.id,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Add NFT to tenant's inventory with real-time loop detection
   */
  public async onNFTAdded(tenantId: string, nft: AbstractNFT): Promise<TradeLoop[]> {
    const startTime = Date.now();
    const operation = this.logger.operation('onNFTAdded');
    
    try {
      const mutex = this.getTenantMutex(tenantId);
      return await mutex.runExclusive(async () => {
        const graph = this.getTenantGraph(tenantId);
        
        // Record the change
        const change: GraphChange = {
          type: 'nft_added',
          timestamp: new Date(),
          entityId: nft.id,
          details: { ownerId: nft.ownership.ownerId }
        };
        
        // Update graph state
        graph.nfts.set(nft.id, nft);
        
        // Update wallet state
        let wallet = graph.wallets.get(nft.ownership.ownerId);
        if (!wallet) {
          wallet = this.createNewWallet(nft.ownership.ownerId);
          graph.wallets.set(nft.ownership.ownerId, wallet);
        }
        wallet.ownedNFTs.push(nft);
        
        // Detect affected subgraph
        const subgraph = this.deltaEngine.getAffectedSubgraphByNFTAddition(graph, nft);
        
        // Discover new trade loops in affected subgraph
        const newLoops = await this.discoverLoopsInSubgraph(tenantId, subgraph);
        
        // Cache and emit new loops
        const tenant = this.getTenantConfig(tenantId);
        newLoops.forEach(async (loop) => {
          graph.activeLoops.set(loop.id, loop);
          this.emit('tradeLoopDiscovered', { 
            tenantId, 
            loop, 
            trigger: 'nft_added',
            nftId: nft.id 
          });
          
          // Send webhook notification
          await this.webhookService.notifyTradeLoopDiscovered(
            tenant,
            loop,
            'nft_added',
            { nftId: nft.id, ownerId: nft.ownership.ownerId }
          );
        });
        
        // Update metadata
        graph.changeLog.push(change);
        graph.lastUpdated = new Date();
        
        operation.info('NFT added and loops discovered', {
          tenantId,
          nftId: nft.id,
          ownerId: nft.ownership.ownerId,
          newLoopsFound: newLoops.length,
          affectedWallets: subgraph.affectedWallets.size,
          processingTime: Date.now() - startTime
        });
        
        this.updatePerformanceMetrics(Date.now() - startTime, newLoops.length);
        operation.end();
        
        return newLoops;
      });
    } catch (error) {
      operation.error('Failed to process NFT addition', {
        tenantId,
        nftId: nft.id,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Add want to tenant's graph with real-time loop detection
   */
  public async onWantAdded(
    tenantId: string, 
    walletId: string, 
    wantedNFTId: string
  ): Promise<TradeLoop[]> {
    const startTime = Date.now();
    const operation = this.logger.operation('onWantAdded');
    
    try {
      const mutex = this.getTenantMutex(tenantId);
      return await mutex.runExclusive(async () => {
        const graph = this.getTenantGraph(tenantId);
        
        // Update wants mapping
        let wanters = graph.wants.get(wantedNFTId);
        if (!wanters) {
          wanters = new Set();
          graph.wants.set(wantedNFTId, wanters);
        }
        wanters.add(walletId);
        
        // Update wallet wants
        let wallet = graph.wallets.get(walletId);
        if (!wallet) {
          wallet = this.createNewWallet(walletId);
          graph.wallets.set(walletId, wallet);
        }
        wallet.wantedNFTs.push(wantedNFTId);
        
        // Detect affected subgraph
        const subgraph = this.deltaEngine.getAffectedSubgraphByWantAddition(
          graph, 
          walletId, 
          wantedNFTId
        );
        
        // Discover new trade loops
        const newLoops = await this.discoverLoopsInSubgraph(tenantId, subgraph);
        
        // Cache and emit new loops
        newLoops.forEach(loop => {
          graph.activeLoops.set(loop.id, loop);
          this.emit('tradeLoopDiscovered', { 
            tenantId, 
            loop, 
            trigger: 'want_added',
            walletId,
            wantedNFTId 
          });
        });
        
        // Record change
        const change: GraphChange = {
          type: 'want_added',
          timestamp: new Date(),
          entityId: wantedNFTId,
          details: { walletId }
        };
        graph.changeLog.push(change);
        graph.lastUpdated = new Date();
        
        operation.info('Want added and loops discovered', {
          tenantId,
          walletId,
          wantedNFTId,
          newLoopsFound: newLoops.length,
          affectedWallets: subgraph.affectedWallets.size,
          processingTime: Date.now() - startTime
        });
        
        this.updatePerformanceMetrics(Date.now() - startTime, newLoops.length);
        operation.end();
        
        return newLoops;
      });
    } catch (error) {
      operation.error('Failed to process want addition', {
        tenantId,
        walletId,
        wantedNFTId,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Remove NFT from tenant's inventory
   */
  public async onNFTRemoved(tenantId: string, nftId: string): Promise<void> {
    const operation = this.logger.operation('onNFTRemoved');
    
    try {
      const mutex = this.getTenantMutex(tenantId);
      await mutex.runExclusive(async () => {
        const graph = this.getTenantGraph(tenantId);
        
        // Detect affected subgraph before removal
        const subgraph = this.deltaEngine.getAffectedSubgraphByNFTRemoval(graph, nftId);
        
        // Remove NFT from graph
        const nft = graph.nfts.get(nftId);
        if (nft) {
          // Remove from wallet
          const wallet = graph.wallets.get(nft.ownership.ownerId);
          if (wallet) {
            wallet.ownedNFTs = wallet.ownedNFTs.filter(n => n.id !== nftId);
          }
          
          // Remove NFT
          graph.nfts.delete(nftId);
        }
        
        // Remove affected trade loops
        const affectedLoops: string[] = [];
        for (const [loopId, loop] of graph.activeLoops) {
          const containsNFT = loop.steps.some(step => 
            step.nfts.some(nft => nft.address === nftId)
          );
          
          if (containsNFT) {
            graph.activeLoops.delete(loopId);
            affectedLoops.push(loopId);
            this.emit('tradeLoopInvalidated', { 
              tenantId, 
              loopId, 
              reason: 'nft_removed',
              nftId 
            });
          }
        }
        
        // Record change
        const change: GraphChange = {
          type: 'nft_removed',
          timestamp: new Date(),
          entityId: nftId
        };
        graph.changeLog.push(change);
        graph.lastUpdated = new Date();
        
        operation.info('NFT removed and loops invalidated', {
          tenantId,
          nftId,
          invalidatedLoops: affectedLoops.length,
          affectedWallets: subgraph.affectedWallets.size
        });
      });
      
      operation.end();
    } catch (error) {
      operation.error('Failed to process NFT removal', {
        tenantId,
        nftId,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Update entire tenant inventory (batch operation)
   */
  public async updateTenantInventory(
    tenantId: string, 
    wallets: AbstractWallet[]
  ): Promise<TradeLoop[]> {
    const operation = this.logger.operation('updateTenantInventory');
    
    try {
      const allNewLoops: TradeLoop[] = [];
      
      // Process each wallet's inventory
      for (const wallet of wallets) {
        // Add/update NFTs
        for (const nft of wallet.ownedNFTs) {
          const newLoops = await this.onNFTAdded(tenantId, nft);
          allNewLoops.push(...newLoops);
        }
        
        // Add wants
        for (const wantedNFTId of wallet.wantedNFTs) {
          const newLoops = await this.onWantAdded(tenantId, wallet.id, wantedNFTId);
          allNewLoops.push(...newLoops);
        }
      }
      
      operation.info('Tenant inventory updated', {
        tenantId,
        walletsProcessed: wallets.length,
        totalNewLoops: allNewLoops.length
      });
      
      operation.end();
      return allNewLoops;
    } catch (error) {
      operation.error('Failed to update tenant inventory', {
        tenantId,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Get active trade loops for a specific wallet
   */
  public async getTradeLoopsForWallet(tenantId: string, walletId: string): Promise<TradeLoop[]> {
    const graph = this.getTenantGraph(tenantId);
    const loops: TradeLoop[] = [];
    
    for (const loop of graph.activeLoops.values()) {
      const isParticipant = loop.steps.some(step => 
        step.from === walletId || step.to === walletId
      );
      
      if (isParticipant) {
        loops.push(loop);
      }
    }
    
    // Sort by quality score
    return loops.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
  }

  /**
   * Get total active loops for tenant
   */
  public async getActiveLoopCount(tenantId: string): Promise<number> {
    const graph = this.getTenantGraph(tenantId);
    return graph.activeLoops.size;
  }

  /**
   * Start real-time monitoring for a tenant
   */
  public startRealtimeMonitoring(tenantId: string): void {
    const config = this.tenantConfigs.get(tenantId);
    if (!config) {
      throw new Error(`Tenant ${tenantId} not found`);
    }
    
    this.logger.info('Starting real-time monitoring', {
      tenantId,
      webhooksEnabled: config.settings.webhooks.enabled
    });
    
    // Monitoring is enabled by default through event emission
    // Partners can subscribe to events for real-time updates
  }

  /**
   * Stop real-time monitoring for a tenant
   */
  public stopRealtimeMonitoring(tenantId: string): void {
    this.logger.info('Stopping real-time monitoring', { tenantId });
    // Remove event listeners for this tenant if needed
  }

  /**
   * DEPRECATED: Replaced by DataSyncBridge in Phase 1.2
   * This method is preserved for reference but no longer used
   */
  private convertAbstractToWalletStates(subgraph: SubgraphData, graph: TenantTradeGraph): WalletState[] {
    // This method is deprecated - DataSyncBridge handles all conversions now
    this.logger.warn('Using deprecated convertAbstractToWalletStates - should use DataSyncBridge');
    return [];
  }

  /**
   * Discover trade loops in a specific subgraph using DataSyncBridge (Phase 1.2+)
   * 
   * CRITICAL PRODUCTION FIX: Now uses DataSyncBridge to properly sync data
   * between the persistent graph and the algorithm layer
   */
  private async discoverLoopsInSubgraph(
    tenantId: string, 
    subgraph: SubgraphData
  ): Promise<TradeLoop[]> {
    const operation = this.logger.operation('discoverLoopsInSubgraph');
    const graph = this.getTenantGraph(tenantId);
    const config = this.getTenantConfig(tenantId);
    
    try {
      // PHASE 1.2 FIX: Use DataSyncBridge to sync entire tenant graph to algorithm layer
      await this.dataSyncBridge.syncTenantToBaseService(
        tenantId,
        graph,
        this.baseTradeService
      );
      
      // Use existing sophisticated algorithms with tenant-specific settings
      const settings: Partial<TradeDiscoverySettings> = {
        maxDepth: config.settings.algorithm.maxDepth,
        minEfficiency: config.settings.algorithm.minEfficiency,
        maxResults: config.settings.algorithm.maxLoopsPerRequest,
        considerCollections: config.settings.algorithm.enableCollectionTrading
      };
      
      // Now the baseTradeService has the correct data - run discovery
      const discoveredLoops = await this.baseTradeService.findTradeLoops(settings);
      
      operation.info('Trade loops discovered with synchronized data', {
        tenantId,
        subgraphSize: subgraph.affectedWallets.size,
        loopsFound: discoveredLoops.length,
        dataStats: this.baseTradeService.getDataStats()
      });
      
      return discoveredLoops;
      
    } catch (error) {
      operation.error('Error discovering loops in subgraph', {
        tenantId,
        subgraphSize: subgraph.affectedWallets.size,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Helper methods
   */
  private getTenantGraph(tenantId: string): TenantTradeGraph {
    const graph = this.tenantGraphs.get(tenantId);
    if (!graph) {
      throw new Error(`Tenant graph not found: ${tenantId}`);
    }
    return graph;
  }

  private getTenantConfig(tenantId: string): TenantConfig {
    const config = this.tenantConfigs.get(tenantId);
    if (!config) {
      throw new Error(`Tenant config not found: ${tenantId}`);
    }
    return config;
  }

  private getTenantMutex(tenantId: string): Mutex {
    const mutex = this.tenantMutexes.get(tenantId);
    if (!mutex) {
      throw new Error(`Tenant mutex not found: ${tenantId}`);
    }
    return mutex;
  }

  private createNewWallet(walletId: string): AbstractWallet {
    return {
      id: walletId,
      ownedNFTs: [],
      wantedNFTs: [],
      wantedCollections: []
    };
  }

  private updatePerformanceMetrics(processingTime: number, loopsFound: number): void {
    this.performanceMetrics.totalEventsProcessed++;
    this.performanceMetrics.avgEventProcessingTime = 
      (this.performanceMetrics.avgEventProcessingTime * (this.performanceMetrics.totalEventsProcessed - 1) + processingTime) / 
      this.performanceMetrics.totalEventsProcessed;
    
    if (loopsFound > 0) {
      this.performanceMetrics.realTimeNotifications++;
    }
  }

  /**
   * Get service metrics
   */
  public getMetrics() {
    return {
      ...this.performanceMetrics,
      deltaEngineMetrics: this.deltaEngine.getMetrics(),
      activeTenants: this.tenantGraphs.size,
      totalActiveLoops: Array.from(this.tenantGraphs.values())
        .reduce((sum, graph) => sum + graph.activeLoops.size, 0)
    };
  }
} 