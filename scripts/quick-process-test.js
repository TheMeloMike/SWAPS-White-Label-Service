#!/usr/bin/env node

/**
 * Quick Processing Test - Test the full collection processing pipeline with a small sample
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const dataDir = path.join(__dirname, '../data');
const collectionsFile = path.join(dataDir, 'collections.json');

// Same transformation logic as main crawler
function transformMagicEdenCollection(magicEdenCol, source) {
  return {
    id: magicEdenCol.symbol || magicEdenCol.id,
    name: magicEdenCol.name || 'Unknown Collection',
    symbol: magicEdenCol.symbol || '',
    verified: false, // simplified for test
    floorPrice: magicEdenCol.floorPrice || 0,
    volume24h: magicEdenCol.volume24hr || magicEdenCol.txVolume?.value1d || 0,
    totalSupply: magicEdenCol.totalItems || magicEdenCol.supply || 0,
    image: magicEdenCol.image || '',
    sources: [source],
    lastUpdated: Date.now(),
    metadata: {
      description: magicEdenCol.description || '',
      categories: magicEdenCol.categories || [],
      website: magicEdenCol.website || '',
      twitter: magicEdenCol.twitter || '',
      discord: magicEdenCol.discord || '',
      watchlistCount: magicEdenCol.watchlistCount || 0,
      createdAt: magicEdenCol.createdAt || null,
      magicEdenData: {
        isDraft: magicEdenCol.isDraft,
        isDerivative: magicEdenCol.isDerivative,
        enabledAttributesFilters: magicEdenCol.enabledAttributesFilters
      }
    }
  };
}

// Same processing logic as main crawler with debugging
async function processDiscoveries(collections, existingCollections) {
  if (collections.length === 0) return 0;
  
  console.log(`🔄 Processing ${collections.length} discovered collections...`);
  console.log(`📊 Current database size: ${Object.keys(existingCollections).length} collections`);
  
  let processed = 0;
  let newCollections = 0;
  let skippedInvalid = 0;
  let updatedExisting = 0;
  
  // Sample first few collections for debugging
  console.log(`🔍 Sample collections being processed:`);
  for (let i = 0; i < Math.min(5, collections.length); i++) {
    const col = collections[i];
    console.log(`   [${i}] ID: "${col.id}" | Name: "${col.name}" | Symbol: "${col.symbol}"`);
  }
  
  for (const collection of collections) {
    if (!collection.id || !collection.name) {
      skippedInvalid++;
      console.log(`   ⚠️ Skipping invalid collection: ID="${collection.id}", Name="${collection.name}"`);
      continue;
    }
    
    if (!existingCollections[collection.id]) {
      // New collection
      existingCollections[collection.id] = collection;
      newCollections++;
      if (newCollections <= 10) { // Log first 10 new collections
        console.log(`   ✅ NEW: ${collection.name} (ID: ${collection.id})`);
      }
    } else {
      // Update existing collection with new data
      const existing = existingCollections[collection.id];
      
      // Merge sources
      const existingSources = existing.sources || [];
      const newSources = collection.sources || [];
      existing.sources = [...new Set([...existingSources, ...newSources])];
      
      // Update stats if newer
      if (collection.floorPrice) existing.floorPrice = collection.floorPrice;
      if (collection.volume24h) existing.volume24h = collection.volume24h;
      if (collection.totalSupply) existing.totalSupply = collection.totalSupply;
      
      // Update metadata
      existing.lastUpdated = Date.now();
      if (collection.metadata) {
        existing.metadata = { ...existing.metadata, ...collection.metadata };
      }
      
      updatedExisting++;
      if (updatedExisting <= 5) { // Log first 5 updates
        console.log(`   🔄 UPDATED: ${collection.name} (ID: ${collection.id})`);
      }
    }
    
    processed++;
  }
  
  console.log(`✅ Processing complete!`);
  console.log(`   📊 Processed: ${processed} total`);
  console.log(`   🆕 New collections: ${newCollections}`);
  console.log(`   🔄 Updated existing: ${updatedExisting}`);
  console.log(`   ❌ Skipped invalid: ${skippedInvalid}`);
  console.log(`   📈 Database size now: ${Object.keys(existingCollections).length} collections`);
  
  return processed;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeApiCall(url) {
  try {
    await sleep(500); // Rate limiting
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'SWAPS-Quick-Test/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.warn(`⚠️ API call failed:`, error.message);
    return null;
  }
}

async function quickProcessTest() {
  console.log('🧪 Quick Processing Test - Testing full pipeline with small sample');
  
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
  
  // Fetch 3 pages of collections (60 total) starting from offset 800 (where new collections begin)
  console.log('🔍 Fetching 60 collections from offset 800...');
  
  const allCollections = [];
  for (let offset = 800; offset < 860; offset += 20) {
    console.log(`   📄 Fetching page: offset=${offset}, limit=20`);
    
    const url = `https://api-mainnet.magiceden.dev/v2/collections?offset=${offset}&limit=20`;
    const response = await makeApiCall(url);
    
    if (response && Array.isArray(response) && response.length > 0) {
      allCollections.push(...response);
      console.log(`   ✅ Retrieved ${response.length} collections (total: ${allCollections.length})`);
    } else {
      console.log(`   ⚠️ Failed to fetch page at offset ${offset}`);
    }
  }
  
  if (allCollections.length === 0) {
    console.error('❌ No collections fetched. Test failed.');
    return;
  }
  
  console.log(`📋 Fetched ${allCollections.length} collections successfully`);
  
  // Transform collections (same as main crawler)
  console.log('🔄 Transforming collections...');
  const transformedCollections = allCollections.map(col => transformMagicEdenCollection(col, 'quick_test'));
  
  // Process with debugging (this is where we'll see the detailed output)
  console.log('\n📊 Starting processing with debugging...');
  const processed = await processDiscoveries(transformedCollections, existingCollections);
  
  // Save to database
  console.log('\n💾 Saving to database...');
  try {
    fs.writeFileSync(collectionsFile, JSON.stringify(existingCollections, null, 2));
    console.log(`✅ Saved ${Object.keys(existingCollections).length} collections to database`);
    console.log(`📈 Final collection count: ${Object.keys(existingCollections).length}`);
  } catch (error) {
    console.error('❌ Error saving collections:', error.message);
  }
  
  console.log('\n🎉 Quick processing test complete!');
}

// Run test
quickProcessTest().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 