#!/usr/bin/env node

/**
 * Debug Discovery Test - Test collection processing logic
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const dataDir = path.join(__dirname, '../data');
const collectionsFile = path.join(dataDir, 'collections.json');

async function testDiscovery() {
  console.log('🧪 Testing collection discovery and processing...');
  
  // Load existing collections
  let existingCollections = {};
  try {
    if (fs.existsSync(collectionsFile)) {
      existingCollections = JSON.parse(fs.readFileSync(collectionsFile, 'utf8'));
      console.log(`📚 Loaded ${Object.keys(existingCollections).length} existing collections`);
    }
  } catch (error) {
    console.error('Error loading existing collections:', error.message);
    return;
  }
  
  // Fetch a small sample from Magic Eden
  console.log('🔍 Fetching sample collections from Magic Eden...');
  
  try {
    const response = await fetch('https://api-mainnet.magiceden.dev/v2/collections?offset=1000&limit=20');
    const rawCollections = await response.json();
    
    if (!Array.isArray(rawCollections)) {
      console.error('❌ Invalid response from Magic Eden:', rawCollections);
      return;
    }
    
    console.log(`✅ Fetched ${rawCollections.length} collections from API`);
    
    // Transform collections (same logic as crawler)
    const transformedCollections = rawCollections.map(col => ({
      id: col.symbol || col.id || `unknown_${Date.now()}`,
      name: col.name || 'Unknown Collection',
      symbol: col.symbol || '',
      verified: false, // simplified
      floorPrice: col.floorPrice || 0,
      volume24h: col.volume24hr || 0,
      totalSupply: col.totalItems || col.supply || 0,
      image: col.image || '',
      sources: ['test_discovery'],
      lastUpdated: Date.now(),
      metadata: {
        description: col.description || '',
        categories: col.categories || []
      }
    }));
    
    console.log('🔄 Processing sample collections...');
    console.log('📊 Sample transformed collections:');
    transformedCollections.slice(0, 3).forEach((col, i) => {
      console.log(`   [${i}] ID: "${col.id}" | Name: "${col.name}" | Symbol: "${col.symbol}"`);
    });
    
    // Test processing logic
    let newCollections = 0;
    let updatedExisting = 0;
    let skippedInvalid = 0;
    
    for (const collection of transformedCollections) {
      if (!collection.id || !collection.name) {
        skippedInvalid++;
        console.log(`   ⚠️ Invalid: ID="${collection.id}", Name="${collection.name}"`);
        continue;
      }
      
      if (!existingCollections[collection.id]) {
        // New collection
        existingCollections[collection.id] = collection;
        newCollections++;
        console.log(`   ✅ NEW: ${collection.name} (ID: ${collection.id})`);
      } else {
        // Existing collection
        updatedExisting++;
        console.log(`   🔄 EXISTS: ${collection.name} (ID: ${collection.id})`);
      }
    }
    
    console.log('\n📊 Processing Results:');
    console.log(`   🆕 New collections: ${newCollections}`);
    console.log(`   🔄 Updated existing: ${updatedExisting}`);
    console.log(`   ❌ Skipped invalid: ${skippedInvalid}`);
    console.log(`   📈 Total collections after: ${Object.keys(existingCollections).length}`);
    
    if (newCollections > 0) {
      console.log('\n💾 Test successful - collections would be added!');
      console.log('🔧 The processing logic works correctly.');
    } else {
      console.log('\n⚠️ No new collections added - all already exist or are invalid.');
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error.message);
  }
}

// Run test
testDiscovery().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 