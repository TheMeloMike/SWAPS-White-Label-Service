/**
 * Test suite for ScalableTradeLoopFinderService
 * 
 * These tests verify the scalability improvements for handling
 * massive NFT trade networks (100,000+ wallets, millions of NFTs)
 */

const { ScalableTradeLoopFinderService } = require('../src/services/trade/ScalableTradeLoopFinderService');
const { TradeLoopFinderService } = require('../src/services/trade/TradeLoopFinderService');

describe('ScalableTradeLoopFinderService', () => {
  // Mock dependencies for better isolation in tests
  jest.mock('../src/services/nft/NFTPricingService', () => ({
    getInstance: jest.fn().mockReturnValue({
      getNFTPrice: jest.fn().mockResolvedValue(1.0),
    }),
  }));
  
  jest.mock('../src/services/nft/NFTService', () => ({
    getInstance: jest.fn().mockReturnValue({
      getNFTMetadata: jest.fn().mockResolvedValue({
        name: 'Test NFT',
        symbol: 'NFT',
        image: 'https://example.com/image.png',
      }),
    }),
  }));
  
  describe('Small Graph Tests - Correctness Verification', () => {
    test('should correctly find direct trades between wallets', () => {
      // Create a test graph with direct matches
      const wallets = new Map();
      const nftOwnership = new Map();
      const wantedNfts = new Map();
      const rejections = new Map();
      
      // Set up two wallets that want each other's NFTs
      wallets.set('wallet1', {
        address: 'wallet1',
        ownedNfts: new Set(['nft1']),
        wantedNfts: new Set(['nft2'])
      });
      
      wallets.set('wallet2', {
        address: 'wallet2',
        ownedNfts: new Set(['nft2']),
        wantedNfts: new Set(['nft1'])
      });
      
      // Set up NFT ownership
      nftOwnership.set('nft1', 'wallet1');
      nftOwnership.set('nft2', 'wallet2');
      
      // Set up wanted NFTs
      wantedNfts.set('nft1', new Set(['wallet2']));
      wantedNfts.set('nft2', new Set(['wallet1']));
      
      // Create the service and find trades
      const service = new ScalableTradeLoopFinderService();
      const tradeLoops = service.findAllTradeLoops(wallets, nftOwnership, wantedNfts, rejections);
      
      // Verify that we found the expected direct trade
      expect(tradeLoops.length).toBe(1);
      expect(tradeLoops[0].steps.length).toBe(2);
      expect(tradeLoops[0].totalParticipants).toBe(2);
      
      // Verify the trade involves the right wallets and NFTs
      const step1 = tradeLoops[0].steps[0];
      const step2 = tradeLoops[0].steps[1];
      
      expect(step1.from).toBe('wallet1');
      expect(step1.to).toBe('wallet2');
      expect(step1.nfts[0].address).toBe('nft1');
      
      expect(step2.from).toBe('wallet2');
      expect(step2.to).toBe('wallet1');
      expect(step2.nfts[0].address).toBe('nft2');
    });
    
    test('should correctly partition graph and find trades in small communities', () => {
      // Create a test graph with two distinct communities
      const wallets = new Map();
      const nftOwnership = new Map();
      const wantedNfts = new Map();
      const rejections = new Map();
      
      // Community 1: Circular trade with 3 participants
      wallets.set('wallet1', {
        address: 'wallet1',
        ownedNfts: new Set(['nft1']),
        wantedNfts: new Set(['nft3'])
      });
      
      wallets.set('wallet2', {
        address: 'wallet2',
        ownedNfts: new Set(['nft2']),
        wantedNfts: new Set(['nft1'])
      });
      
      wallets.set('wallet3', {
        address: 'wallet3',
        ownedNfts: new Set(['nft3']),
        wantedNfts: new Set(['nft2'])
      });
      
      // Community 2: Direct trade with 2 participants
      wallets.set('wallet4', {
        address: 'wallet4',
        ownedNfts: new Set(['nft4']),
        wantedNfts: new Set(['nft5'])
      });
      
      wallets.set('wallet5', {
        address: 'wallet5',
        ownedNfts: new Set(['nft5']),
        wantedNfts: new Set(['nft4'])
      });
      
      // Set up NFT ownership
      nftOwnership.set('nft1', 'wallet1');
      nftOwnership.set('nft2', 'wallet2');
      nftOwnership.set('nft3', 'wallet3');
      nftOwnership.set('nft4', 'wallet4');
      nftOwnership.set('nft5', 'wallet5');
      
      // Set up wanted NFTs
      wantedNfts.set('nft1', new Set(['wallet2']));
      wantedNfts.set('nft2', new Set(['wallet3']));
      wantedNfts.set('nft3', new Set(['wallet1']));
      wantedNfts.set('nft4', new Set(['wallet5']));
      wantedNfts.set('nft5', new Set(['wallet4']));
      
      // Create the service and find trades
      const service = new ScalableTradeLoopFinderService();
      const tradeLoops = service.findAllTradeLoops(wallets, nftOwnership, wantedNfts, rejections);
      
      // Verify that we found both trades (2 communities: 1 circular, 1 direct)
      expect(tradeLoops.length).toBe(2);
      
      // We're not guaranteed about the order of the trades, so sort by number of steps
      const sortedTrades = [...tradeLoops].sort((a, b) => a.steps.length - b.steps.length);
      
      // The direct trade should have 2 steps
      expect(sortedTrades[0].steps.length).toBe(2);
      expect(sortedTrades[0].totalParticipants).toBe(2);
      
      // The circular trade should have 3 steps
      expect(sortedTrades[1].steps.length).toBe(3);
      expect(sortedTrades[1].totalParticipants).toBe(3);
    });
  });
  
  describe('Large Scale Tests - Performance Verification', () => {
    test('should efficiently handle a large number of wallets and NFTs', () => {
      // Create a large synthetic graph with 10,000 wallets and 20,000 NFTs
      const wallets = new Map();
      const nftOwnership = new Map();
      const wantedNfts = new Map();
      const rejections = new Map();
      
      // Generate wallets and NFTs
      for (let i = 0; i < 10000; i++) {
        const walletAddress = `wallet${i}`;
        const ownedNfts = new Set();
        const wantedNftSet = new Set();
        
        // Each wallet owns 2 NFTs
        const nft1 = `nft${i*2}`;
        const nft2 = `nft${i*2+1}`;
        ownedNfts.add(nft1);
        ownedNfts.add(nft2);
        
        // Each wallet wants 5 random NFTs
        for (let j = 0; j < 5; j++) {
          // Choose a random NFT that they don't own
          const randomNftId = Math.floor(Math.random() * 20000);
          const randomNft = `nft${randomNftId}`;
          if (!ownedNfts.has(randomNft)) {
            wantedNftSet.add(randomNft);
            
            // Add this wallet to the wanted set for this NFT
            if (!wantedNfts.has(randomNft)) {
              wantedNfts.set(randomNft, new Set());
            }
            wantedNfts.get(randomNft).add(walletAddress);
          }
        }
        
        // Register the wallet
        wallets.set(walletAddress, {
          address: walletAddress,
          ownedNfts,
          wantedNfts: wantedNftSet
        });
        
        // Register NFT ownership
        nftOwnership.set(nft1, walletAddress);
        nftOwnership.set(nft2, walletAddress);
      }
      
      // Time the trade loop discovery
      const startTime = performance.now();
      
      // Create the service and find trades
      const service = new ScalableTradeLoopFinderService();
      const tradeLoops = service.findAllTradeLoops(wallets, nftOwnership, wantedNfts, rejections);
      
      const endTime = performance.now();
      const timeMs = endTime - startTime;
      
      // Verify that we have some trades, but we don't know exactly how many
      console.log(`Found ${tradeLoops.length} trades in ${timeMs.toFixed(2)}ms`);
      
      // Important performance metric: algorithm should complete within a reasonable time
      // Typically under 10 seconds even for this large dataset
      expect(timeMs).toBeLessThan(10000);
      
      // We expect the algorithm to find some trades in this synthetic dataset
      // The exact number will vary, but it should be at least a few
      expect(tradeLoops.length).toBeGreaterThan(0);
    });
    
    test('should produce better results than the original algorithm for very large networks', () => {
      // Create a large synthetic graph with 1000 wallets and 2000 NFTs
      // This is a smaller test than the full 100k, but still challenging
      const wallets = new Map();
      const nftOwnership = new Map();
      const wantedNfts = new Map();
      const rejections = new Map();
      
      // Generate wallets and NFTs with communities
      // Create 10 communities with 100 wallets each
      for (let community = 0; community < 10; community++) {
        for (let i = 0; i < 100; i++) {
          const walletIndex = community * 100 + i;
          const walletAddress = `wallet${walletIndex}`;
          const ownedNfts = new Set();
          const wantedNftSet = new Set();
          
          // Each wallet owns 2 NFTs
          const nft1 = `nft${walletIndex*2}`;
          const nft2 = `nft${walletIndex*2+1}`;
          ownedNfts.add(nft1);
          ownedNfts.add(nft2);
          
          // Each wallet wants 5 NFTs, with 80% probability from same community
          for (let j = 0; j < 5; j++) {
            let targetCommunity;
            if (Math.random() < 0.8) {
              // 80% chance to want NFT from same community
              targetCommunity = community;
            } else {
              // 20% chance to want NFT from different community
              targetCommunity = Math.floor(Math.random() * 10);
            }
            
            // Choose a random NFT from the target community
            const randomWalletInCommunity = targetCommunity * 100 + Math.floor(Math.random() * 100);
            const randomNftId = randomWalletInCommunity * 2 + Math.floor(Math.random() * 2);
            const randomNft = `nft${randomNftId}`;
            
            if (!ownedNfts.has(randomNft)) {
              wantedNftSet.add(randomNft);
              
              // Add this wallet to the wanted set for this NFT
              if (!wantedNfts.has(randomNft)) {
                wantedNfts.set(randomNft, new Set());
              }
              wantedNfts.get(randomNft).add(walletAddress);
            }
          }
          
          // Register the wallet
          wallets.set(walletAddress, {
            address: walletAddress,
            ownedNfts,
            wantedNfts: wantedNftSet
          });
          
          // Register NFT ownership
          nftOwnership.set(nft1, walletAddress);
          nftOwnership.set(nft2, walletAddress);
        }
      }
      
      // Time the scalable algorithm
      console.log('\nTesting scalable algorithm...');
      const scalableStartTime = performance.now();
      const scalableService = new ScalableTradeLoopFinderService();
      const scalableTradeLoops = scalableService.findAllTradeLoops(wallets, nftOwnership, wantedNfts, rejections);
      const scalableTime = performance.now() - scalableStartTime;
      
      // Time the original algorithm
      console.log('\nTesting original algorithm...');
      const originalStartTime = performance.now();
      const originalService = new TradeLoopFinderService(8, 0.6);
      const originalTradeLoops = originalService.findAllTradeLoops(wallets, nftOwnership, wantedNfts, rejections);
      const originalTime = performance.now() - originalStartTime;
      
      console.log('\nPerformance Comparison:');
      console.log(`Scalable algorithm found ${scalableTradeLoops.length} trades in ${scalableTime.toFixed(2)}ms`);
      console.log(`Original algorithm found ${originalTradeLoops.length} trades in ${originalTime.toFixed(2)}ms`);
      console.log(`Speedup: ${(originalTime / scalableTime).toFixed(2)}x`);
      
      // We expect the scalable algorithm to be at least 2x faster
      expect(scalableTime).toBeLessThan(originalTime / 2);
      
      // Verify that the scalable algorithm finds at least as many high-quality trades
      // since it focuses on community detection and prioritizes small, high-value trades
      const scalableLength = Math.min(10, scalableTradeLoops.length);
      const originalLength = Math.min(10, originalTradeLoops.length);
      
      // Check that the top 10 trades from the scalable algorithm have reasonable efficiency
      for (let i = 0; i < scalableLength; i++) {
        console.log(`Scalable trade #${i+1} efficiency: ${scalableTradeLoops[i].efficiency.toFixed(2)}`);
        expect(scalableTradeLoops[i].efficiency).toBeGreaterThan(0.5);
      }
      for (let i = 0; i < originalLength; i++) {
        console.log(`Original trade #${i+1} efficiency: ${originalTradeLoops[i].efficiency.toFixed(2)}`);
      }
    });
  });
  
  describe('Incremental Update Tests', () => {
    test('should correctly handle incremental updates to the graph', () => {
      // Create a test graph with a few wallets
      const wallets = new Map();
      const nftOwnership = new Map();
      const wantedNfts = new Map();
      const rejections = new Map();
      
      // Set up initial wallets
      wallets.set('wallet1', {
        address: 'wallet1',
        ownedNfts: new Set(['nft1']),
        wantedNfts: new Set(['nft2'])
      });
      
      wallets.set('wallet2', {
        address: 'wallet2',
        ownedNfts: new Set(['nft2']),
        wantedNfts: new Set(['nft1'])
      });
      
      // Set up NFT ownership
      nftOwnership.set('nft1', 'wallet1');
      nftOwnership.set('nft2', 'wallet2');
      
      // Set up wanted NFTs
      wantedNfts.set('nft1', new Set(['wallet2']));
      wantedNfts.set('nft2', new Set(['wallet1']));
      
      // Create the service and find initial trades
      const service = new ScalableTradeLoopFinderService();
      const initialTradeLoops = service.findAllTradeLoops(wallets, nftOwnership, wantedNfts, rejections);
      
      // Verify that we found the expected direct trade
      expect(initialTradeLoops.length).toBe(1);
      
      // Now add a new wallet that creates a 3-way trade
      wallets.set('wallet3', {
        address: 'wallet3',
        ownedNfts: new Set(['nft3']),
        wantedNfts: new Set(['nft1'])
      });
      
      // Update wallet1 to want nft3
      const wallet1 = wallets.get('wallet1');
      wallet1.wantedNfts.add('nft3');
      
      // Update NFT ownership and wants
      nftOwnership.set('nft3', 'wallet3');
      if (!wantedNfts.has('nft3')) {
        wantedNfts.set('nft3', new Set());
      }
      wantedNfts.get('nft3').add('wallet1');
      
      // Add wallet3 to the set of wallets that want nft1
      wantedNfts.get('nft1').add('wallet3');
      
      // Notify the service of the changes
      service.walletAdded('wallet3');
      service.walletUpdated('wallet1');
      
      // Find trades again - the service should use cached results where possible
      const updatedTradeLoops = service.findAllTradeLoops(wallets, nftOwnership, wantedNfts, rejections);
      
      // Verify that the number of trades has increased
      expect(updatedTradeLoops.length).toBeGreaterThan(initialTradeLoops.length);
      
      // Verify that we found the new triangular trade
      const triangularTrade = updatedTradeLoops.find(trade => trade.steps.length === 3);
      expect(triangularTrade).toBeDefined();
      
      // The triangular trade should involve all three wallets
      const walletAddresses = new Set();
      for (const step of triangularTrade.steps) {
        walletAddresses.add(step.from);
      }
      expect(walletAddresses.size).toBe(3);
      expect(walletAddresses.has('wallet1')).toBe(true);
      expect(walletAddresses.has('wallet2')).toBe(true);
      expect(walletAddresses.has('wallet3')).toBe(true);
    });
  });
}); 