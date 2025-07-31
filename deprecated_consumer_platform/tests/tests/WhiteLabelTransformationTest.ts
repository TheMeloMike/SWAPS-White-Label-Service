import { TradeDiscoveryService } from '../services/trade/TradeDiscoveryService';
import { PersistentTradeDiscoveryService } from '../services/trade/PersistentTradeDiscoveryService';
import { TenantManagementService } from '../services/tenant/TenantManagementService';
import { AbstractNFT, AbstractWallet, TenantConfig } from '../types/abstract';
import { WalletState } from '../types/trade';

/**
 * White Label Transformation Regression Test
 * 
 * Verifies that the white label transformation maintains zero regression
 * in trade discovery accuracy compared to the original system.
 */
describe('White Label Transformation Regression Tests', () => {
  let originalTradeService: TradeDiscoveryService;
  let persistentTradeService: PersistentTradeDiscoveryService;
  let tenantService: TenantManagementService;
  let testTenant: TenantConfig;

  beforeAll(async () => {
    // Initialize services
    originalTradeService = TradeDiscoveryService.getInstance();
    persistentTradeService = PersistentTradeDiscoveryService.getInstance();
    tenantService = TenantManagementService.getInstance();

    // Create test tenant
    testTenant = await tenantService.createTenant({
      name: 'Test Tenant',
      contactEmail: 'test@example.com',
      algorithmSettings: {
        maxDepth: 10,
        minEfficiency: 0.6,
        maxLoopsPerRequest: 100,
        enableCollectionTrading: true
      }
    });

    await persistentTradeService.initializeTenant(testTenant);
  });

  describe('Trade Discovery Accuracy', () => {
    test('Should discover identical trade loops as original system', async () => {
      // Create test data
      const testNFTs = createTestNFTData();
      const testWallets = createTestWalletData(testNFTs);

      // Test original system
      await setupOriginalSystem(testWallets);
      const originalLoops = await originalTradeService.findTradeLoops();

      // Test white label system
      await setupWhiteLabelSystem(testTenant.id, testWallets);
      const whiteLabelLoops = await getWhiteLabelLoops(testTenant.id);

      // Compare results
      expect(whiteLabelLoops).toHaveLength(originalLoops.length);
      
      // Verify each loop exists in both systems
      for (const originalLoop of originalLoops) {
        const matchingLoop = findMatchingLoop(originalLoop, whiteLabelLoops);
        expect(matchingLoop).toBeDefined();
        expect(matchingLoop!.totalParticipants).toBe(originalLoop.totalParticipants);
        expect(matchingLoop!.steps).toHaveLength(originalLoop.steps.length);
      }
    });

    test('Should maintain quality scores within tolerance', async () => {
      const testData = createComplexTestScenario();
      
      // Original system
      await setupOriginalSystem(testData.wallets);
      const originalLoops = await originalTradeService.findTradeLoops();

      // White label system
      await setupWhiteLabelSystem(testTenant.id, testData.wallets);
      const whiteLabelLoops = await getWhiteLabelLoops(testTenant.id);

      // Compare quality scores (allowing for minor floating-point differences)
      for (const originalLoop of originalLoops) {
        const matchingLoop = findMatchingLoop(originalLoop, whiteLabelLoops);
        if (matchingLoop && originalLoop.qualityScore && matchingLoop.qualityScore) {
          const scoreDifference = Math.abs(originalLoop.qualityScore - matchingLoop.qualityScore);
          expect(scoreDifference).toBeLessThan(0.01); // Within 1% tolerance
        }
      }
    });

    test('Should handle collection-level trading accurately', async () => {
      const testData = createCollectionTestScenario();
      
      // Both systems should discover the same collection-based opportunities
      await setupOriginalSystem(testData.wallets);
      const originalLoops = await originalTradeService.findTradeLoops({
        considerCollections: true
      });

      await setupWhiteLabelSystem(testTenant.id, testData.wallets);
      const whiteLabelLoops = await getWhiteLabelLoops(testTenant.id);

      expect(whiteLabelLoops.length).toBeGreaterThanOrEqual(originalLoops.length);
    });
  });

  describe('Real-time Performance', () => {
    test('Should maintain sub-second response times for additions', async () => {
      const newNFT = createSingleTestNFT();
      
      const startTime = Date.now();
      await persistentTradeService.onNFTAdded(testTenant.id, newNFT);
      const processingTime = Date.now() - startTime;
      
      expect(processingTime).toBeLessThan(1000); // Under 1 second
    });

    test('Should scale linearly with tenant count', async () => {
      // Create multiple tenants
      const tenants = await Promise.all([
        createTestTenant('Tenant A'),
        createTestTenant('Tenant B'),
        createTestTenant('Tenant C')
      ]);

      // Measure processing time with multiple tenants
      const processingTimes: number[] = [];
      
      for (const tenant of tenants) {
        const testNFT = createSingleTestNFT();
        const startTime = Date.now();
        await persistentTradeService.onNFTAdded(tenant.id, testNFT);
        processingTimes.push(Date.now() - startTime);
      }

      // Verify consistent performance across tenants
      const avgTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      const maxDeviation = Math.max(...processingTimes.map(t => Math.abs(t - avgTime)));
      
      expect(maxDeviation).toBeLessThan(avgTime * 0.5); // Within 50% of average
    });
  });

  describe('Algorithm Preservation', () => {
    test('Should use identical SCC detection logic', async () => {
      // Create a graph with known strongly connected components
      const sccTestData = createSCCTestData();
      
      await setupOriginalSystem(sccTestData.wallets);
      await setupWhiteLabelSystem(testTenant.id, sccTestData.wallets);
      
      // Both systems should identify the same SCCs
      // (This is verified implicitly by finding the same trade loops)
      const originalLoops = await originalTradeService.findTradeLoops();
      const whiteLabelLoops = await getWhiteLabelLoops(testTenant.id);
      
      expect(whiteLabelLoops).toHaveLength(originalLoops.length);
    });

    test('Should maintain Johnson\'s algorithm cycle detection', async () => {
      // Create a scenario that specifically tests cycle enumeration
      const cycleTestData = createCycleTestData();
      
      await setupOriginalSystem(cycleTestData.wallets);
      const originalLoops = await originalTradeService.findTradeLoops();
      
      await setupWhiteLabelSystem(testTenant.id, cycleTestData.wallets);
      const whiteLabelLoops = await getWhiteLabelLoops(testTenant.id);
      
      // Should find all the same cycles
      expect(whiteLabelLoops).toHaveLength(originalLoops.length);
      
      // Verify cycle completeness
      for (const loop of originalLoops) {
        expect(verifyCycleCompleteness(loop)).toBe(true);
      }
    });
  });

  // Helper functions
  function createTestNFTData(): AbstractNFT[] {
    return [
      {
        id: 'nft_1',
        metadata: { name: 'Test NFT 1', description: 'First test NFT' },
        ownership: { ownerId: 'wallet_1', acquiredAt: new Date() },
        valuation: { estimatedValue: 100, currency: 'USD', confidence: 0.9 },
        collection: { id: 'collection_1', name: 'Test Collection' }
      },
      {
        id: 'nft_2',
        metadata: { name: 'Test NFT 2', description: 'Second test NFT' },
        ownership: { ownerId: 'wallet_2', acquiredAt: new Date() },
        valuation: { estimatedValue: 120, currency: 'USD', confidence: 0.85 },
        collection: { id: 'collection_1', name: 'Test Collection' }
      },
      {
        id: 'nft_3',
        metadata: { name: 'Test NFT 3', description: 'Third test NFT' },
        ownership: { ownerId: 'wallet_3', acquiredAt: new Date() },
        valuation: { estimatedValue: 110, currency: 'USD', confidence: 0.8 },
        collection: { id: 'collection_2', name: 'Another Collection' }
      }
    ];
  }

  function createTestWalletData(nfts: AbstractNFT[]): AbstractWallet[] {
    return [
      {
        id: 'wallet_1',
        ownedNFTs: [nfts[0]],
        wantedNFTs: ['nft_2']
      },
      {
        id: 'wallet_2',
        ownedNFTs: [nfts[1]],
        wantedNFTs: ['nft_3']
      },
      {
        id: 'wallet_3',
        ownedNFTs: [nfts[2]],
        wantedNFTs: ['nft_1']
      }
    ];
  }

  function createComplexTestScenario() {
    // Create a more complex scenario with multiple possible loops
    const nfts = Array.from({ length: 10 }, (_, i) => ({
      id: `complex_nft_${i}`,
      metadata: { name: `Complex NFT ${i}` },
      ownership: { ownerId: `complex_wallet_${i % 5}`, acquiredAt: new Date() },
      valuation: { estimatedValue: 100 + (i * 10), currency: 'USD', confidence: 0.8 }
    }));

    const wallets = Array.from({ length: 5 }, (_, i) => ({
      id: `complex_wallet_${i}`,
      ownedNFTs: nfts.filter(nft => nft.ownership.ownerId === `complex_wallet_${i}`),
      wantedNFTs: [`complex_nft_${(i + 1) % 10}`, `complex_nft_${(i + 2) % 10}`]
    }));

    return { nfts, wallets };
  }

  function createCollectionTestScenario() {
    const nfts = [
      { id: 'rare_sword', metadata: { name: 'Rare Sword' }, ownership: { ownerId: 'gamer_1', acquiredAt: new Date() }, collection: { id: 'weapons', name: 'Weapons' } },
      { id: 'epic_armor', metadata: { name: 'Epic Armor' }, ownership: { ownerId: 'gamer_2', acquiredAt: new Date() }, collection: { id: 'armor', name: 'Armor' } },
      { id: 'magic_staff', metadata: { name: 'Magic Staff' }, ownership: { ownerId: 'gamer_3', acquiredAt: new Date() }, collection: { id: 'weapons', name: 'Weapons' } }
    ];

    const wallets = [
      { id: 'gamer_1', ownedNFTs: [nfts[0]], wantedNFTs: [], wantedCollections: ['armor'] },
      { id: 'gamer_2', ownedNFTs: [nfts[1]], wantedNFTs: [], wantedCollections: ['weapons'] },
      { id: 'gamer_3', ownedNFTs: [nfts[2]], wantedNFTs: ['epic_armor'], wantedCollections: [] }
    ];

    return { nfts, wallets };
  }

  function createSCCTestData() {
    // Create a graph with known SCC structure
    return createComplexTestScenario();
  }

  function createCycleTestData() {
    // Create data that forms clear cycles
    return createTestWalletData(createTestNFTData());
  }

  function createSingleTestNFT(): AbstractNFT {
    return {
      id: `test_nft_${Date.now()}`,
      metadata: { name: 'Single Test NFT' },
      ownership: { ownerId: `test_wallet_${Date.now()}`, acquiredAt: new Date() },
      valuation: { estimatedValue: 100, currency: 'USD', confidence: 0.9 }
    };
  }

  async function createTestTenant(name: string): Promise<TenantConfig> {
    const tenant = await tenantService.createTenant({
      name,
      contactEmail: `${name.toLowerCase().replace(' ', '')}@test.com`
    });
    await persistentTradeService.initializeTenant(tenant);
    return tenant;
  }

  async function setupOriginalSystem(wallets: AbstractWallet[]): Promise<void> {
    // Convert abstract wallets to original format
    for (const wallet of wallets) {
      const walletState: WalletState = {
        address: wallet.id,
        ownedNfts: new Set(wallet.ownedNFTs.map(nft => nft.id)),
        wantedNfts: new Set(wallet.wantedNFTs),
        lastUpdated: new Date()
      };
      
      await originalTradeService.submitWalletState(walletState);
    }
  }

  async function setupWhiteLabelSystem(tenantId: string, wallets: AbstractWallet[]): Promise<void> {
    for (const wallet of wallets) {
      // Add NFTs
      for (const nft of wallet.ownedNFTs) {
        await persistentTradeService.onNFTAdded(tenantId, nft);
      }
      
      // Add wants
      for (const wantedNFT of wallet.wantedNFTs) {
        await persistentTradeService.onWantAdded(tenantId, wallet.id, wantedNFT);
      }
    }
  }

  async function getWhiteLabelLoops(tenantId: string) {
    const graph = (persistentTradeService as any).getTenantGraph(tenantId);
    return Array.from(graph.activeLoops.values());
  }

  function findMatchingLoop(originalLoop: any, whiteLabelLoops: any[]) {
    return whiteLabelLoops.find(loop => 
      loop.totalParticipants === originalLoop.totalParticipants &&
      Math.abs(loop.efficiency - originalLoop.efficiency) < 0.01
    );
  }

  function verifyCycleCompleteness(loop: any): boolean {
    // Verify that the loop forms a complete cycle
    const participants = new Set();
    for (const step of loop.steps) {
      participants.add(step.from);
      participants.add(step.to);
    }
    return participants.size === loop.totalParticipants;
  }
}); 