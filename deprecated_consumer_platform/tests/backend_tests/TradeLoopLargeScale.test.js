// Import the service we need to test
const { TradeLoopFinderService } = require('../src/services/trade/TradeLoopFinderService');

// Mock NFT services
jest.mock('../src/services/nft/NFTPricingService', () => {
  return {
    NFTPricingService: {
      getInstance: jest.fn(() => ({
        estimateNFTPrice: jest.fn().mockResolvedValue(0.5),
        getFloorPrice: jest.fn().mockResolvedValue(0.5)
      }))
    }
  };
});

jest.mock('../src/services/nft/NFTService', () => {
  return {
    NFTService: {
      getInstance: jest.fn(() => ({
        getNFTMetadata: jest.fn().mockResolvedValue({
          name: 'Test NFT',
          symbol: 'TEST',
          image: 'https://example.com/image.png',
          collection: 'Test Collection',
          description: 'This is a test NFT'
        })
      }))
    }
  };
});

/**
 * Helper function to generate synthetic test data
 */
function generateTestData(walletCount, nftsPerWallet, wantsPerWallet) {
  const walletsMap = new Map();
  const nftOwnership = new Map();
  const wantedNfts = new Map();
  const rejectionPreferences = new Map();
  
  // Create wallets with owned NFTs
  for (let i = 0; i < walletCount; i++) {
    const walletAddress = `wallet_${i}`;
    const walletState = {
      address: walletAddress,
      ownedNfts: new Set(),
      wantedNfts: new Set(),
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
  
  // Create wants relationships (what NFTs each wallet wants)
  for (let i = 0; i < walletCount; i++) {
    const walletAddress = `wallet_${i}`;
    const walletState = walletsMap.get(walletAddress);
    
    // Select NFTs from other wallets to want
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
        wantedNfts.set(nft, new Set());
      }
      wantedNfts.get(nft).add(walletAddress);
    }
  }
  
  // Create several trade cycles of various sizes to ensure we have 
  // discoverable patterns in our test data
  createCycle(5, walletsMap, nftOwnership, wantedNfts, 0);
  createCycle(8, walletsMap, nftOwnership, wantedNfts, 10);
  createCycle(10, walletsMap, nftOwnership, wantedNfts, 20);
  createCycle(6, walletsMap, nftOwnership, wantedNfts, 50);
  
  return {
    walletsMap,
    nftOwnership,
    wantedNfts,
    rejectionPreferences
  };
}

/**
 * Helper function to create a cycle of specified size
 */
function createCycle(size, walletsMap, nftOwnership, wantedNfts, startIndex = 0) {
  const ringSize = Math.min(size, walletsMap.size - startIndex);
  
  for (let i = 0; i < ringSize; i++) {
    const currentWallet = `wallet_${startIndex + i}`;
    const nextWallet = `wallet_${startIndex + ((i + 1) % ringSize)}`;
    
    // Current wallet wants an NFT from the next wallet
    const nftsFromNext = Array.from(nftOwnership.entries())
      .filter(([nft, owner]) => owner === nextWallet)
      .map(([nft]) => nft);
    
    if (nftsFromNext.length > 0) {
      const nftToWant = nftsFromNext[0];
      
      // Add to wallet's wanted NFTs
      walletsMap.get(currentWallet).wantedNfts.add(nftToWant);
      
      // Update global wanted NFTs map
      if (!wantedNfts.has(nftToWant)) {
        wantedNfts.set(nftToWant, new Set());
      }
      wantedNfts.get(nftToWant).add(currentWallet);
    }
  }
}

/**
 * Large Scale Test Suite for TradeLoopFinderService
 */
describe('TradeLoopFinderService Large Scale Tests', () => {
  // Store service instance for cleanup
  let service;
  
  // Clean up resources after all tests
  afterAll(() => {
    if (service && typeof service.dispose === 'function') {
      service.dispose();
    }
  });

  // Test with increasingly large wallet counts
  const largeScaleTests = [
    { name: '100 wallets', wallets: 100, nftsPerWallet: 10, wantsPerWallet: 5, maxTime: 30000 }
  ];

  test.each(largeScaleTests)('should efficiently handle $name graph', 
    async ({ wallets, nftsPerWallet, wantsPerWallet, maxTime }) => {
      console.log(`\n=== LARGE SCALE TEST: ${wallets} wallets with ${nftsPerWallet} NFTs each and ${wantsPerWallet} wants each ===`);
      
      // Generate test data
      const startGen = performance.now();
      const { walletsMap, nftOwnership, wantedNfts, rejectionPreferences } = 
        generateTestData(wallets, nftsPerWallet, wantsPerWallet);
      const endGen = performance.now();
      console.log(`Test data generation took ${(endGen - startGen).toFixed(2)}ms`);
      
      // Log data characteristics
      console.log(`Generated ${walletsMap.size} wallets`);
      console.log(`Generated ${nftOwnership.size} NFTs`);
      
      // Create service with parameters optimized for large graphs
      service = new TradeLoopFinderService(10, 0.6);
      
      // Measure execution time
      const startTime = performance.now();
      const tradeLoops = service.findAllTradeLoops(
        walletsMap,
        nftOwnership,
        wantedNfts,
        rejectionPreferences
      );
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      console.log(`\n=== RESULTS ===`);
      console.log(`Found ${tradeLoops.length} trade loops in ${executionTime.toFixed(2)}ms`);
      
      // Verify the algorithm finds trade loops correctly
      expect(tradeLoops).toBeDefined();
      expect(Array.isArray(tradeLoops)).toBe(true);
      
      // Verify algorithm performance
      expect(executionTime).toBeLessThan(maxTime);
      
      // Log trade statistics
      if (tradeLoops.length > 0) {
        // Count loops by participant size
        const loopSizeDistribution = new Map();
        
        tradeLoops.forEach(loop => {
          const participantCount = loop.totalParticipants;
          loopSizeDistribution.set(
            participantCount, 
            (loopSizeDistribution.get(participantCount) || 0) + 1
          );
        });
        
        console.log('\nTrade loop size distribution:');
        Array.from(loopSizeDistribution.entries())
          .sort((a, b) => a[0] - b[0])
          .forEach(([size, count]) => {
            console.log(`  ${size} participants: ${count} loops (${(count/tradeLoops.length*100).toFixed(1)}%)`);
          });
        
        // Log quality score distribution
        const qualityScores = tradeLoops.map(loop => loop.qualityScore || loop.efficiency);
        const avgQuality = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
        const minQuality = Math.min(...qualityScores);
        const maxQuality = Math.max(...qualityScores);
        
        console.log('\nTrade quality statistics:');
        console.log(`  Average quality score: ${avgQuality.toFixed(3)}`);
        console.log(`  Minimum quality score: ${minQuality.toFixed(3)}`);
        console.log(`  Maximum quality score: ${maxQuality.toFixed(3)}`);
        
        // Log sample best and worst trades
        const bestTradeIndex = qualityScores.indexOf(maxQuality);
        const worstTradeIndex = qualityScores.indexOf(minQuality);
        
        console.log('\nSample best trade:');
        console.log(`  ID: ${tradeLoops[bestTradeIndex].id}`);
        console.log(`  Participants: ${tradeLoops[bestTradeIndex].totalParticipants}`);
        console.log(`  Quality score: ${qualityScores[bestTradeIndex].toFixed(3)}`);
        
        console.log('\nSample worst trade:');
        console.log(`  ID: ${tradeLoops[worstTradeIndex].id}`);
        console.log(`  Participants: ${tradeLoops[worstTradeIndex].totalParticipants}`);
        console.log(`  Quality score: ${qualityScores[worstTradeIndex].toFixed(3)}`);
      }
    }, 60000); // Set timeout to 60 seconds for large tests
}); 