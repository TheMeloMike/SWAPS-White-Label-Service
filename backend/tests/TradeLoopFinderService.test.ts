/// <reference types="jest" />

import { TradeLoopFinderService } from '../src/services/trade/TradeLoopFinderService';
import { TradeDiscoveryService } from '../src/services/trade/TradeDiscoveryService';
import { WalletState, RejectionPreferences } from '../src/types/trade';
import { MemoryPersistenceAdapter } from './helpers/MemoryPersistenceAdapter';
import { PersistenceManager } from '../src/lib/persistence/PersistenceManager';

// Increase Jest timeout for these potentially long-running tests
jest.setTimeout(60000);

// Define test size type
type TestSize = { 
  wallets: number; 
  nftsPerWallet: number; 
  wantsPerWallet: number 
};

/**
 * Test suite for the optimized TradeLoopFinderService
 * These tests use real data structures and algorithms, not mocked responses
 */
describe('TradeLoopFinderService Optimization Tests', () => {
  let memoryAdapter: MemoryPersistenceAdapter;
  
  // Use memory persistence adapter to avoid file system operations
  beforeAll(() => {
    // Configure PersistenceManager to use memory adapter for testing
    memoryAdapter = new MemoryPersistenceAdapter();
    PersistenceManager.configureForTesting(memoryAdapter);
  });
  
  afterAll(() => {
    // Reset PersistenceManager to default
    PersistenceManager.resetToDefault();
  });

  describe('Performance Tests', () => {
    // Test data with various graph sizes
    const testSizes: TestSize[] = [
      { wallets: 10, nftsPerWallet: 3, wantsPerWallet: 2 },
      { wallets: 20, nftsPerWallet: 5, wantsPerWallet: 3 },
      { wallets: 50, nftsPerWallet: 8, wantsPerWallet: 5 },
    ];

    test.each(testSizes)('Should efficiently find trade loops in a graph with %i wallets', 
      async ({ wallets, nftsPerWallet, wantsPerWallet }: TestSize) => {
      // Generate test data - real structure, synthetic values
      const { 
        walletsMap, 
        nftOwnership, 
        wantedNfts, 
        rejectionPreferences 
      } = generateTestData(wallets, nftsPerWallet, wantsPerWallet);

      // Create finder service with default parameters
      const finderService = new TradeLoopFinderService(8, 0.7);

      // Measure execution time
      const startTime = performance.now();
      const tradeLoops = finderService.findAllTradeLoops(
        walletsMap,
        nftOwnership,
        wantedNfts,
        rejectionPreferences
      );
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      console.log(`Test with ${wallets} wallets completed in ${executionTime.toFixed(2)}ms`);
      console.log(`Found ${tradeLoops.length} trade loops`);

      // Assert trade loops were found correctly
      expect(tradeLoops).toBeDefined();
      expect(Array.isArray(tradeLoops)).toBe(true);
      
      // Verify each trade loop has the correct structure
      tradeLoops.forEach(loop => {
        expect(loop.id).toBeDefined();
        expect(loop.steps).toBeDefined();
        expect(Array.isArray(loop.steps)).toBe(true);
        expect(loop.totalParticipants).toBeGreaterThanOrEqual(2);
        expect(loop.efficiency).toBeGreaterThanOrEqual(0);
        expect(loop.efficiency).toBeLessThanOrEqual(1);
        
        // Verify quality score if available (only in optimized version)
        if (loop.qualityScore !== undefined) {
          expect(loop.qualityScore).toBeGreaterThanOrEqual(0);
        }
      });
      
      // Performance assertions - adjust based on your hardware
      // These are just examples, you may need to adjust them
      if (wallets <= 10) {
        expect(executionTime).toBeLessThan(1000); // < 1000ms for small graphs
      } else if (wallets <= 20) {
        expect(executionTime).toBeLessThan(3000); // < 3s for medium graphs
      } else {
        expect(executionTime).toBeLessThan(15000); // < 15s for large graphs
      }
    });
  });

  describe('Real System Data Tests', () => {
    let tradeDiscoveryService: TradeDiscoveryService;
    
    beforeAll(async () => {
      try {
        // Reset the memory adapter before real data tests
        await memoryAdapter.clearAll();
        
        // Get the real TradeDiscoveryService instance
        tradeDiscoveryService = TradeDiscoveryService.getInstance();
        
        // If the system has no data, add some test wallets
        const systemState = tradeDiscoveryService.getSystemState();
        if (systemState.wallets < 5) {
          await addTestWallets(tradeDiscoveryService, 5);
        }
      } catch (error) {
        console.error('Error in beforeAll:', error);
      }
    }, 30000); // Increase timeout to allow for API calls
    
    test('Should find trade loops with real system data', async () => {
      try {
        // Get the current system state for real data
        const systemState = tradeDiscoveryService.getSystemState();
        console.log('Testing with real system state:', systemState);
        
        // Create finder service with same parameters as production
        const finderService = new TradeLoopFinderService(8, 0.7);
        
        // Get wallets, nftOwnership, and wantedNfts from the real system
        const detailedState = tradeDiscoveryService.getDetailedSystemState();
        
        // Convert to the expected format for TradeLoopFinderService
        const walletsMap = new Map<string, WalletState>();
        const nftOwnership = new Map<string, string>();
        const wantedNfts = new Map<string, Set<string>>();
        const rejectionPreferences = new Map<string, RejectionPreferences>();
        
        // Convert detailed state to Maps
        detailedState.wallets.forEach(wallet => {
          walletsMap.set(wallet.address, {
            address: wallet.address,
            ownedNfts: new Set(wallet.ownedNfts),
            wantedNfts: new Set(wallet.wantedNfts),
            lastUpdated: new Date()
          });
          
          // Update nftOwnership
          wallet.ownedNfts.forEach(nft => {
            nftOwnership.set(nft, wallet.address);
          });
          
          // Update wantedNfts
          wallet.wantedNfts.forEach(nft => {
            if (!wantedNfts.has(nft)) {
              wantedNfts.set(nft, new Set());
            }
            wantedNfts.get(nft)!.add(wallet.address);
          });
        });
        
        // Skip if no data in the system
        if (walletsMap.size === 0 || nftOwnership.size === 0) {
          console.log('No real data available to test, skipping this test.');
          return;
        }
        
        // Measure execution time
        console.log(`Running trade loop finder with ${walletsMap.size} wallets, ${nftOwnership.size} NFTs, and ${wantedNfts.size} wanted NFTs...`);
        const startTime = performance.now();
        const tradeLoops = finderService.findAllTradeLoops(
          walletsMap,
          nftOwnership,
          wantedNfts,
          rejectionPreferences
        );
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        
        console.log(`Real data test completed in ${executionTime.toFixed(2)}ms`);
        console.log(`Found ${tradeLoops.length} trade loops`);
        
        if (tradeLoops.length > 0) {
          // Log the first trade loop (just ID and step count for brevity)
          console.log(`First trade loop: ID=${tradeLoops[0].id}, Steps=${tradeLoops[0].steps.length}, Participants=${tradeLoops[0].totalParticipants}`);
          
          // Check for enhanced metrics
          if (tradeLoops[0].qualityScore !== undefined) {
            console.log(`Enhanced quality metrics: Score=${tradeLoops[0].qualityScore.toFixed(2)}`);
          }
        }
        
        // Basic assertions
        expect(tradeLoops).toBeDefined();
        expect(Array.isArray(tradeLoops)).toBe(true);
      } catch (error) {
        console.error('Error in real system data test:', error);
        throw error;
      }
    }, 30000); // Increase timeout
  });
});

/**
 * Generate synthetic test data with real structure
 */
function generateTestData(walletCount: number, nftsPerWallet: number, wantsPerWallet: number) {
  const walletsMap = new Map<string, WalletState>();
  const nftOwnership = new Map<string, string>();
  const wantedNfts = new Map<string, Set<string>>();
  const rejectionPreferences = new Map<string, RejectionPreferences>();
  
  // Create wallets
  for (let i = 0; i < walletCount; i++) {
    const walletAddress = `wallet_${i}`;
    const walletState: WalletState = {
      address: walletAddress,
      ownedNfts: new Set<string>(),
      wantedNfts: new Set<string>(),
      lastUpdated: new Date()
    };
    
    // Each wallet owns some NFTs
    for (let j = 0; j < nftsPerWallet; j++) {
      const nftAddress = `nft_${i}_${j}`;
      walletState.ownedNfts.add(nftAddress);
      nftOwnership.set(nftAddress, walletAddress);
    }
    
    walletsMap.set(walletAddress, walletState);
  }
  
  // Create wants relationships
  for (let i = 0; i < walletCount; i++) {
    const walletAddress = `wallet_${i}`;
    const walletState = walletsMap.get(walletAddress)!;
    
    // Pick random NFTs to want (from other wallets)
    const allNfts = Array.from(nftOwnership.keys());
    const ownedNfts = Array.from(walletState.ownedNfts);
    const otherNfts = allNfts.filter(nft => !ownedNfts.includes(nft));
    
    // Ensure we don't try to want more NFTs than exist
    const actualWants = Math.min(wantsPerWallet, otherNfts.length);
    
    // Shuffle and pick the first few
    const shuffled = otherNfts.sort(() => 0.5 - Math.random());
    const selectedNfts = shuffled.slice(0, actualWants);
    
    // Add wants
    for (const nft of selectedNfts) {
      walletState.wantedNfts.add(nft);
      
      if (!wantedNfts.has(nft)) {
        wantedNfts.set(nft, new Set<string>());
      }
      wantedNfts.get(nft)!.add(walletAddress);
    }
    
    // Create some rejections (10% chance to reject an NFT)
    const rejectedNfts = new Set<string>();
    const rejectedWallets = new Set<string>();
    
    allNfts.forEach(nft => {
      if (Math.random() < 0.1) {
        rejectedNfts.add(nft);
      }
    });
    
    // Also add some wallet rejections (5% chance to reject another wallet)
    for (let j = 0; j < walletCount; j++) {
      if (j !== i && Math.random() < 0.05) {
        rejectedWallets.add(`wallet_${j}`);
      }
    }
    
    // Add to rejection preferences if we have any
    if (rejectedNfts.size > 0 || rejectedWallets.size > 0) {
      rejectionPreferences.set(walletAddress, {
        nfts: rejectedNfts,
        wallets: rejectedWallets
      });
    }
  }
  
  // Create circular relationships to ensure trade loops exist
  // For example, arrange some wallets in a ring structure
  const ring = Math.min(walletCount, 5); // Create a ring of max 5 wallets
  for (let i = 0; i < ring; i++) {
    const currentWallet = `wallet_${i}`;
    const nextWallet = `wallet_${(i + 1) % ring}`;
    
    // Current wallet wants an NFT from the next wallet
    const nftsFromNext = Array.from(nftOwnership.entries())
      .filter(([nft, owner]) => owner === nextWallet)
      .map(([nft]) => nft);
    
    if (nftsFromNext.length > 0) {
      const nftToWant = nftsFromNext[0];
      
      walletsMap.get(currentWallet)!.wantedNfts.add(nftToWant);
      
      if (!wantedNfts.has(nftToWant)) {
        wantedNfts.set(nftToWant, new Set<string>());
      }
      wantedNfts.get(nftToWant)!.add(currentWallet);
    }
  }
  
  return {
    walletsMap,
    nftOwnership,
    wantedNfts,
    rejectionPreferences
  };
}

/**
 * Add test wallets to the TradeDiscoveryService
 * This uses real wallet interactions but with synthetic wallet addresses
 */
async function addTestWallets(tradeDiscoveryService: TradeDiscoveryService, count: number) {
  console.log(`Adding ${count} test wallets to the system...`);
  
  for (let i = 0; i < count; i++) {
    const wallet = `syntheticWallet${i}`;
    
    // Register some NFTs for this wallet
    const nfts = [`nft_${i}_0`, `nft_${i}_1`, `nft_${i}_2`];
    tradeDiscoveryService.registerManualNFTs(wallet, nfts);
    
    // Add some trade preferences
    await tradeDiscoveryService.addTradePreference(wallet, `nft_${(i + 1) % count}_0`);
    await tradeDiscoveryService.addTradePreference(wallet, `nft_${(i + 2) % count}_1`);
  }
  
  console.log('Test wallets added');
} 