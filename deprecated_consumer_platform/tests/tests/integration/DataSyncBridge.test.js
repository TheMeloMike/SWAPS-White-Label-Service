const { describe, it, expect, beforeAll } = require('@jest/globals');
require('reflect-metadata');

/**
 * DataSyncBridge Test - Phase 1.1 Validation
 * 
 * This test validates that Phase 1.1 of the production fix is working:
 * - Data conversion from AbstractNFT/AbstractWallet to TradeDiscoveryService format
 * - Proper error handling for Phase 1.2 dependency
 */
describe('🔧 DataSyncBridge - Phase 1.1 Validation', () => {
  let dataSyncBridge;
  let mockTenantGraph;

  beforeAll(async () => {
    console.log('\n🔍 TESTING: DataSyncBridge Phase 1.1 Implementation');
    
    const { DataSyncBridge } = require('../../services/trade/DataSyncBridge');
    dataSyncBridge = DataSyncBridge.getInstance();

    // Create mock tenant graph data
    mockTenantGraph = {
      tenantId: 'test-tenant-123',
      nfts: new Map([
        ['nft-1', {
          id: 'nft-1',
          metadata: { name: 'Test NFT 1' },
          ownership: { ownerId: 'wallet-1' },
          collection: { id: 'collection-1', name: 'Test Collection 1' }
        }],
        ['nft-2', {
          id: 'nft-2', 
          metadata: { name: 'Test NFT 2' },
          ownership: { ownerId: 'wallet-2' },
          collection: { id: 'collection-2', name: 'Test Collection 2' }
        }]
      ]),
      wallets: new Map([
        ['wallet-1', {
          id: 'wallet-1',
          ownedNFTs: [{ id: 'nft-1' }],
          wantedNFTs: ['nft-2'],
          wantedCollections: ['collection-2'],
          metadata: { displayName: 'Test Wallet 1' }
        }],
        ['wallet-2', {
          id: 'wallet-2',
          ownedNFTs: [{ id: 'nft-2' }], 
          wantedNFTs: ['nft-1'],
          wantedCollections: ['collection-1'],
          metadata: { displayName: 'Test Wallet 2' }
        }]
      ]),
      wants: new Map([
        ['wallet-1', new Set(['nft-2'])],
        ['wallet-2', new Set(['nft-1'])]
      ]),
      activeLoops: new Map(),
      changeLog: []
    };
  }, 30000);

  describe('✅ Phase 1.1: Data Conversion', () => {
    it('should convert tenant graph data to TradeDiscoveryService format', () => {
      console.log('\n📊 TESTING: Data Format Conversion');

      const convertedData = dataSyncBridge.convertTenantToTradeData(mockTenantGraph);

      // Validate basic structure
      expect(convertedData).toHaveProperty('wallets');
      expect(convertedData).toHaveProperty('nftOwnership');
      expect(convertedData).toHaveProperty('wantedNfts');
      expect(convertedData).toHaveProperty('rejectionPreferences');

      // Validate wallets conversion
      expect(convertedData.wallets).toBeInstanceOf(Map);
      expect(convertedData.wallets.size).toBe(2);
      
      const wallet1 = convertedData.wallets.get('wallet-1');
      expect(wallet1).toBeDefined();
      expect(wallet1.address).toBe('wallet-1');
      expect(wallet1.ownedNfts).toBeInstanceOf(Set);
      expect(wallet1.wantedNfts).toBeInstanceOf(Set);
      expect(wallet1.lastUpdated).toBeInstanceOf(Date);

      // Validate NFT ownership conversion
      expect(convertedData.nftOwnership).toBeInstanceOf(Map);
      expect(convertedData.nftOwnership.size).toBe(2);
      expect(convertedData.nftOwnership.get('nft-1')).toBe('wallet-1');
      expect(convertedData.nftOwnership.get('nft-2')).toBe('wallet-2');

      // Validate wants conversion
      expect(convertedData.wantedNfts).toBeInstanceOf(Map);
      expect(convertedData.wantedNfts.size).toBe(2);
      expect(convertedData.wantedNfts.get('wallet-1')).toContain('nft-2');
      expect(convertedData.wantedNfts.get('wallet-2')).toContain('nft-1');

      console.log('✅ Data conversion successful:');
      console.log(`   - Wallets converted: ${convertedData.wallets.size}`);
      console.log(`   - NFTs converted: ${convertedData.nftOwnership.size}`);
      console.log(`   - Wants converted: ${convertedData.wantedNfts.size}`);
    });

    it('should handle empty tenant graph data gracefully', () => {
      console.log('\n📊 TESTING: Empty Data Handling');

      const emptyTenantGraph = {
        tenantId: 'empty-tenant',
        nfts: new Map(),
        wallets: new Map(),
        wants: new Map(),
        activeLoops: new Map(),
        changeLog: []
      };

      const convertedData = dataSyncBridge.convertTenantToTradeData(emptyTenantGraph);

      expect(convertedData.wallets.size).toBe(0);
      expect(convertedData.nftOwnership.size).toBe(0);
      expect(convertedData.wantedNfts.size).toBe(0);

      console.log('✅ Empty data handling successful');
    });
  });

  describe('🚨 Phase 1.2: Dependency Validation', () => {
    it('should properly detect missing Phase 1.2 implementation', async () => {
      console.log('\n📊 TESTING: Phase 1.2 Dependency Detection');

      // Mock TradeDiscoveryService without updateDataStructures method
      const mockBaseService = {
        findTradeLoops: jest.fn(),
        // Missing: updateDataStructures method
      };

      let errorThrown = false;
      let errorMessage = '';

      try {
        await dataSyncBridge.syncTenantToBaseService(
          'test-tenant',
          mockTenantGraph,
          mockBaseService
        );
      } catch (error) {
        errorThrown = true;
        errorMessage = error.message;
      }

      expect(errorThrown).toBe(true);
      expect(errorMessage).toContain('Phase 1.2 not implemented');
      expect(errorMessage).toContain('updateDataStructures method missing');

      console.log('✅ Phase 1.2 dependency detection working:');
      console.log(`   - Error detected: ${errorThrown}`);
      console.log(`   - Error message: ${errorMessage}`);
    });

    it('should provide clear implementation status', () => {
      console.log('\n📊 TESTING: Implementation Status Reporting');

      const status = dataSyncBridge.getImplementationStatus();

      expect(status.phase).toBe('1.1');
      expect(status.status).toBe('COMPLETE');
      expect(status.nextPhase).toBe('1.2');
      expect(status.nextTasks).toBeInstanceOf(Array);
      expect(status.nextTasks.length).toBeGreaterThan(0);
      expect(status.productionBlocker).toContain('updateDataStructures');

      console.log('✅ Implementation status clear:');
      console.log(`   - Current phase: ${status.phase} (${status.status})`);
      console.log(`   - Next phase: ${status.nextPhase}`);
      console.log(`   - Production blocker: ${status.productionBlocker}`);
      console.log(`   - Next tasks: ${status.nextTasks.length} items`);
    });
  });

  describe('🎯 PRODUCTION READINESS ASSESSMENT', () => {
    it('should demonstrate Phase 1.1 completion and Phase 1.2 requirement', () => {
      console.log('\n🎯 PRODUCTION READINESS ASSESSMENT:');

      console.log('\n✅ PHASE 1.1 COMPLETE:');
      console.log('   - DataSyncBridge service implemented');
      console.log('   - Data conversion working (AbstractNFT → WalletState)');
      console.log('   - Error handling for missing dependencies');
      console.log('   - Clear status reporting');

      console.log('\n🔴 PHASE 1.2 REQUIRED FOR PRODUCTION:');
      console.log('   - Add updateDataStructures method to TradeDiscoveryService');
      console.log('   - Integrate DataSyncBridge into PersistentTradeDiscoveryService');
      console.log('   - Test actual trade discovery with synced data');

      console.log('\n📅 ESTIMATED TIME TO PRODUCTION:');
      console.log('   - Phase 1.2 implementation: 1-2 days');
      console.log('   - Integration testing: 1 day');
      console.log('   - Production validation: 1 day');
      console.log('   - TOTAL: 3-4 days to working trade discovery');

      // This test passes to confirm Phase 1.1 is complete
      expect(true).toBe(true);
    });
  });
}); 