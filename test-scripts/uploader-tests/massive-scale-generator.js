#!/usr/bin/env node

/**
 * MASSIVE SCALE TEST GENERATOR
 * Generates 1000 wallets with realistic NFT ownership and want patterns
 * for stress testing the SWAPS Canonical Engine
 */

const API_KEY = 'swaps_e7fd66973e3a00b73c539efdd93abefdd5281f762980957c5b80a3c7bc2411d5';
const BASE_URL = 'https://swaps-93hu.onrender.com/api/v1';

// Test Architecture Configuration
const CONFIG = {
  TOTAL_WALLETS: 1000,
  COLLECTIONS: [
    { id: 'megapunks', name: 'MegaPunks', nftCount: 600, avgValue: 500 },
    { id: 'solkingdom', name: 'Sol Kingdom', nftCount: 800, avgValue: 300 },
    { id: 'degenapes', name: 'Degen Apes', nftCount: 500, avgValue: 800 },
    { id: 'cybercats', name: 'CyberCats', nftCount: 700, avgValue: 250 },
    { id: 'spacebirds', name: 'Space Birds', nftCount: 400, avgValue: 600 },
    { id: 'moonrocks', name: 'Moon Rocks', nftCount: 900, avgValue: 150 },
    { id: 'galaxydogs', name: 'Galaxy Dogs', nftCount: 300, avgValue: 900 },
    { id: 'neonfish', name: 'Neon Fish', nftCount: 650, avgValue: 400 },
    { id: 'robotbears', name: 'Robot Bears', nftCount: 550, avgValue: 350 },
    { id: 'cosmicowls', name: 'Cosmic Owls', nftCount: 350, avgValue: 750 }
  ],
  WALLETS_PER_COLLECTION: 100,
  NFTS_PER_WALLET: { min: 3, max: 8 },
  WANTS_PER_WALLET: { min: 2, max: 6 },
  CROSS_COLLECTION_PROBABILITY: 0.4 // 40% chance to want from different collection
};

// Utility functions
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateWalletId(collectionId, index) {
  return `WALLET_${collectionId.toUpperCase()}_${String(index).padStart(3, '0')}`;
}

function generateNFTId(collectionId, nftIndex) {
  return `NFT_${collectionId.toUpperCase()}_${String(nftIndex).padStart(4, '0')}`;
}

// Generate complete test scenario
function generateMassiveScaleScenario() {
  console.log('🚀 GENERATING MASSIVE SCALE SCENARIO: 1000 WALLETS');
  console.log('================================================');
  
  const wallets = [];
  const allNFTs = new Map(); // nftId -> { collection, owner, metadata }
  let totalNFTs = 0;
  
  // Generate wallets and NFTs for each collection
  CONFIG.COLLECTIONS.forEach((collection, collectionIndex) => {
    console.log(`\n📦 Collection ${collectionIndex + 1}/10: ${collection.name}`);
    console.log(`   NFTs: ${collection.nftCount}, Wallets: ${CONFIG.WALLETS_PER_COLLECTION}`);
    
    // Generate NFTs for this collection
    const collectionNFTs = [];
    for (let nftIndex = 1; nftIndex <= collection.nftCount; nftIndex++) {
      const nftId = generateNFTId(collection.id, nftIndex);
      collectionNFTs.push(nftId);
      
      allNFTs.set(nftId, {
        id: nftId,
        metadata: {
          name: `${collection.name} #${nftIndex}`,
          description: `NFT from ${collection.name} collection`,
          estimatedValueUSD: randomInt(collection.avgValue * 0.5, collection.avgValue * 1.5)
        },
        collection: {
          id: collection.id,
          name: collection.name
        }
      });
    }
    
    // Generate wallets for this collection
    for (let walletIndex = 1; walletIndex <= CONFIG.WALLETS_PER_COLLECTION; walletIndex++) {
      const walletId = generateWalletId(collection.id, walletIndex);
      
      // Assign random NFTs from this collection to the wallet
      const nftCount = randomInt(CONFIG.NFTS_PER_WALLET.min, CONFIG.NFTS_PER_WALLET.max);
      const ownedNFTs = [];
      
      for (let i = 0; i < nftCount; i++) {
        const nftId = randomChoice(collectionNFTs);
        if (!ownedNFTs.includes(nftId)) {
          ownedNFTs.push(nftId);
          const nft = allNFTs.get(nftId);
          nft.ownership = { ownerId: walletId };
          totalNFTs++;
        }
      }
      
      wallets.push({
        walletId,
        collection: collection.id,
        ownedNFTs
      });
    }
  });
  
  console.log(`\n✅ Generated ${wallets.length} wallets with ${totalNFTs} NFT ownerships`);
  
  // Generate wants patterns (cross-collection for realistic trading opportunities)
  console.log('\n🎯 Generating wants patterns...');
  
  wallets.forEach(wallet => {
    const wantCount = randomInt(CONFIG.WANTS_PER_WALLET.min, CONFIG.WANTS_PER_WALLET.max);
    const wantedNFTs = [];
    
    for (let i = 0; i < wantCount; i++) {
      let targetCollection;
      
      // 40% chance for cross-collection wants, 60% same collection
      if (Math.random() < CONFIG.CROSS_COLLECTION_PROBABILITY) {
        targetCollection = randomChoice(CONFIG.COLLECTIONS.filter(c => c.id !== wallet.collection));
      } else {
        targetCollection = CONFIG.COLLECTIONS.find(c => c.id === wallet.collection);
      }
      
      // Pick random NFT from target collection that this wallet doesn't own
      const targetNFTs = Array.from(allNFTs.values())
        .filter(nft => nft.collection.id === targetCollection.id && 
                      !wallet.ownedNFTs.includes(nft.id) &&
                      !wantedNFTs.includes(nft.id));
      
      if (targetNFTs.length > 0) {
        wantedNFTs.push(randomChoice(targetNFTs).id);
      }
    }
    
    wallet.wantedNFTs = wantedNFTs;
  });
  
  console.log('\n📊 SCENARIO STATISTICS:');
  console.log(`   Total Wallets: ${wallets.length}`);
  console.log(`   Total NFT Ownerships: ${totalNFTs}`);
  console.log(`   Collections: ${CONFIG.COLLECTIONS.length}`);
  console.log(`   Avg NFTs per Wallet: ${(totalNFTs / wallets.length).toFixed(1)}`);
  
  const totalWants = wallets.reduce((sum, w) => sum + w.wantedNFTs.length, 0);
  console.log(`   Total Wants: ${totalWants}`);
  console.log(`   Avg Wants per Wallet: ${(totalWants / wallets.length).toFixed(1)}`);
  
  const crossCollectionWants = wallets.reduce((sum, wallet) => {
    return sum + wallet.wantedNFTs.filter(nftId => {
      const nft = allNFTs.get(nftId);
      return nft && nft.collection.id !== wallet.collection;
    }).length;
  }, 0);
  
  console.log(`   Cross-Collection Wants: ${crossCollectionWants} (${(crossCollectionWants/totalWants*100).toFixed(1)}%)`);
  
  return { wallets, allNFTs };
}

// Execute if called directly
if (require.main === module) {
  const scenario = generateMassiveScaleScenario();
  
  console.log('\n🎯 SCENARIO GENERATION COMPLETE!');
  console.log('Next: Run upload script to send to SWAPS API');
}

module.exports = { generateMassiveScaleScenario, CONFIG }; 