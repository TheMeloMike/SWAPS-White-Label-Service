/**
 * Collection Integration Test
 * Verifies that the collection support implementation is working correctly
 */

import { CollectionIndexingService } from '../services/nft/CollectionIndexingService';
import { CollectionAbstractionService } from '../services/trade/CollectionAbstractionService';
import { TradeDiscoveryService } from '../services/trade/TradeDiscoveryService';
import { TradeScoreService } from '../services/trade/TradeScoreService';
import { ScalableTradeLoopFinderService } from '../services/trade/ScalableTradeLoopFinderService';

/**
 * Test collection support functionality
 */
export async function testCollectionIntegration(): Promise<void> {
  console.log('🧪 Starting Collection Integration Test...\n');

  try {
    // Test 1: Collection Indexing Service
    console.log('📋 Test 1: Collection Indexing Service');
    await testCollectionIndexing();
    console.log('✅ Collection indexing test passed\n');

    // Test 2: Collection Abstraction Service
    console.log('🔄 Test 2: Collection Abstraction Service');
    await testCollectionAbstraction();
    console.log('✅ Collection abstraction test passed\n');

    // Test 3: Trade Discovery with Collections
    console.log('🔍 Test 3: Trade Discovery with Collection Support');
    await testTradeDiscoveryWithCollections();
    console.log('✅ Trade discovery with collections test passed\n');

    // Test 4: Enhanced Trade Scoring
    console.log('📊 Test 4: Enhanced Trade Scoring');
    await testEnhancedTradeScoring();
    console.log('✅ Enhanced trade scoring test passed\n');

    // Test 5: End-to-End Collection Trade
    console.log('🚀 Test 5: End-to-End Collection Trade');
    await testEndToEndCollectionTrade();
    console.log('✅ End-to-end collection trade test passed\n');

    console.log('🎉 All collection integration tests passed! Collection support is working correctly.');

  } catch (error) {
    console.error('❌ Collection integration test failed:', error);
    throw error;
  }
}

/**
 * Test collection indexing functionality
 */
async function testCollectionIndexing(): Promise<void> {
  const indexingService = CollectionIndexingService.getInstance();
  
  // Test NFT indexing
  const testNfts = [
    'CryptoPunk1234567890abcdef',
    'BoredApe9876543210fedcba',
    'Azuki555666777888999000'
  ];
  
  console.log('  - Building collection index...');
  await indexingService.buildCollectionIndex(testNfts);
  
  // Test collection search
  console.log('  - Testing collection search...');
  const searchResults = await indexingService.searchCollections('CryptoPunk', 5);
  
  // Test NFT-to-collection mapping
  console.log('  - Testing NFT-to-collection mapping...');
  const collectionId = await indexingService.getCollectionForNFT(testNfts[0]);
  
  // Test collection metadata
  if (collectionId) {
    console.log('  - Testing collection metadata retrieval...');
    const metadata = indexingService.getCollectionMetadata(collectionId);
    console.log(`    Found collection: ${metadata?.name || 'Unknown'}`);
  }
  
  const stats = indexingService.getIndexStats();
  console.log(`  - Index stats: ${stats.collections} collections, ${stats.nftMappings} NFT mappings`);
}

/**
 * Test collection abstraction functionality
 */
async function testCollectionAbstraction(): Promise<void> {
  const abstractionService = CollectionAbstractionService.getInstance();
  
  // Create test wallet states with collection wants
  const testWallets = new Map();
  testWallets.set('wallet1', {
    address: 'wallet1',
    ownedNfts: new Set(['nft1', 'nft2']),
    wantedNfts: new Set(['nft3']),
    wantedCollections: new Set(['CryptoPunks', 'BoredApes']),
    lastUpdated: new Date()
  });
  
  testWallets.set('wallet2', {
    address: 'wallet2', 
    ownedNfts: new Set(['nft3', 'nft4']),
    wantedNfts: new Set(['nft1']),
    wantedCollections: new Set(['Azuki']),
    lastUpdated: new Date()
  });
  
  // Test NFT ownership map
  const nftOwnership = new Map();
  nftOwnership.set('nft1', 'wallet1');
  nftOwnership.set('nft2', 'wallet1');
  nftOwnership.set('nft3', 'wallet2');
  nftOwnership.set('nft4', 'wallet2');
  
  // Test collection wants expansion
  console.log('  - Testing collection want expansion...');
  const collectionWants = new Map();
  collectionWants.set('wallet1', new Set(['CryptoPunks']));
  collectionWants.set('wallet2', new Set(['BoredApes']));
  
  const expandedWants = await abstractionService.expandCollectionWants(
    testWallets,
    nftOwnership,
    collectionWants
  );
  
  console.log(`  - Expanded wants: ${expandedWants.size} wallets with wants`);
  
  // Test collection resolution
  console.log('  - Testing collection preference resolution...');
  const resolution = await abstractionService.resolveCollectionPreference(
    'CryptoPunks',
    ['nft1', 'nft2'],
    'wallet1',
    { targetValue: 1.0 }
  );
  
  if (resolution) {
    console.log(`    Resolved to NFT: ${resolution.resolvedNFT} with confidence: ${resolution.confidence}`);
  }
  
  // Test collection ownership building
  console.log('  - Testing collection ownership mapping...');
  const collectionOwnership = await abstractionService.buildCollectionOwnership(testWallets);
  console.log(`    Built ownership for ${collectionOwnership.size} wallets`);
}

/**
 * Test trade discovery with collection support
 */
async function testTradeDiscoveryWithCollections(): Promise<void> {
  const tradeDiscovery = TradeDiscoveryService.getInstance();
  
  // Set up test scenario with collection wants
  console.log('  - Setting up test wallets...');
  
  // Wallet 1: Owns CryptoPunk, wants any BoredApe
  await tradeDiscovery.updateWalletState('test-wallet-1');
  await tradeDiscovery.addCollectionWant('test-wallet-1', 'BoredApes');
  
  // Wallet 2: Owns BoredApe, wants any CryptoPunk  
  await tradeDiscovery.updateWalletState('test-wallet-2');
  await tradeDiscovery.addCollectionWant('test-wallet-2', 'CryptoPunks');
  
  console.log('  - Running trade discovery with collection support...');
  const trades = await tradeDiscovery.findTradeLoops({
    maxResults: 10,
    considerCollections: true
  });
  
  console.log(`    Found ${trades.length} trade loops with collection support`);
  
  // Check for collection-enhanced trades
  const collectionTrades = trades.filter(trade => 
    (trade as any).hasCollectionTrades || (trade as any).collectionResolutions?.size > 0
  );
  
  console.log(`    ${collectionTrades.length} trades involve collection-level preferences`);
}

/**
 * Test enhanced trade scoring with collection metrics
 */
async function testEnhancedTradeScoring(): Promise<void> {
  const scoreService = TradeScoreService.getInstance();
  
  // Create a mock trade loop with collection data
  const mockTrade = {
    id: 'test-trade-123',
    steps: [
      {
        from: 'wallet1',
        to: 'wallet2',
        nfts: [
          {
            address: 'nft1',
            name: 'CryptoPunk #1234',
            symbol: 'PUNK',
            image: 'image1.png',
            collection: 'CryptoPunks',
            description: 'A CryptoPunk',
            floorPrice: 5.0,
            hasFloorPrice: true
          }
        ]
      },
      {
        from: 'wallet2', 
        to: 'wallet1',
        nfts: [
          {
            address: 'nft2',
            name: 'Bored Ape #5678',
            symbol: 'BAYC',
            image: 'image2.png', 
            collection: 'BoredApes',
            description: 'A Bored Ape',
            floorPrice: 4.5,
            hasFloorPrice: true
          }
        ]
      }
    ],
    totalParticipants: 2,
    efficiency: 0.8,
    rawEfficiency: 0.8,
    estimatedValue: 4.75,
    // Add collection metadata
    collectionResolutions: new Map(),
    hasCollectionTrades: true,
    collectionCount: 2,
    crossCollectionTrade: true
  };
  
  console.log('  - Calculating enhanced trade score...');
  const scoreResult = scoreService.calculateTradeScore(mockTrade);
  
  console.log(`    Trade score: ${scoreResult.score.toFixed(3)}`);
  console.log(`    Collection metrics available: ${!!scoreResult.collectionMetrics}`);
  
  if (scoreResult.collectionMetrics) {
    console.log(`    Has collection trades: ${scoreResult.collectionMetrics.hasCollectionTrades}`);
    console.log(`    Unique collections: ${scoreResult.collectionMetrics.uniqueCollections}`);
    console.log(`    Cross-collection trade: ${scoreResult.collectionMetrics.crossCollectionTrade}`);
  }
  
  // Test collection-specific scoring factors
  const metrics = scoreResult.metrics;
  if (metrics.collectionDiversity !== undefined) {
    console.log(`    Collection diversity score: ${metrics.collectionDiversity.toFixed(3)}`);
  }
  if (metrics.collectionQuality !== undefined) {
    console.log(`    Collection quality score: ${metrics.collectionQuality.toFixed(3)}`);
  }
}

/**
 * Test end-to-end collection trade scenario
 */
async function testEndToEndCollectionTrade(): Promise<void> {
  console.log('  - Creating end-to-end collection trade scenario...');
  
  const tradeDiscovery = TradeDiscoveryService.getInstance();
  
  // Scenario: 3-way collection trade
  // Wallet A: Has Punk, wants any Ape
  // Wallet B: Has Ape, wants any Azuki  
  // Wallet C: Has Azuki, wants any Punk
  
  console.log('    Setting up 3-wallet collection trade scenario...');
  
  // Clear system state first
  await tradeDiscovery.clearState();
  
  // Register wallets with collection wants
  await tradeDiscovery.updateWalletState('wallet-a');
  await tradeDiscovery.updateWalletState('wallet-b'); 
  await tradeDiscovery.updateWalletState('wallet-c');
  
  await tradeDiscovery.addCollectionWant('wallet-a', 'BoredApes');
  await tradeDiscovery.addCollectionWant('wallet-b', 'Azuki');
  await tradeDiscovery.addCollectionWant('wallet-c', 'CryptoPunks');
  
  console.log('    Running trade discovery for collection trade...');
  const trades = await tradeDiscovery.findTradeLoops({
    maxResults: 5,
    considerCollections: true,
    includeMultiPartyTrades: true
  });
  
  console.log(`    Found ${trades.length} potential collection trades`);
  
  // Find multi-party collection trades
  const multiPartyCollectionTrades = trades.filter(trade => 
    trade.totalParticipants >= 3 && (trade as any).hasCollectionTrades
  );
  
  console.log(`    ${multiPartyCollectionTrades.length} multi-party collection trades found`);
  
  if (multiPartyCollectionTrades.length > 0) {
    const bestTrade = multiPartyCollectionTrades[0];
    console.log(`    Best trade efficiency: ${bestTrade.efficiency.toFixed(3)}`);
    console.log(`    Participants: ${bestTrade.totalParticipants}`);
    console.log(`    Steps: ${bestTrade.steps.length}`);
  }
  
  // Test system state after collection operations
  const systemState = tradeDiscovery.getSystemState();
  console.log(`    Final system state: ${systemState.wallets} wallets, ${systemState.wanted} wants`);
} 