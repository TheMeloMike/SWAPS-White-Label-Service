#!/usr/bin/env node

/**
 * SWAPS Floor Price Enhancement Script
 * 
 * Purpose: Enhance existing collections with accurate floor price data
 * Uses Magic Eden's /v2/collections/{symbol}/stats endpoint for real trading data
 * 
 * Features:
 * - Processes existing collections in batches
 * - Fetches real-time floor prices and volume data
 * - Proper lamports to SOL conversion
 * - Rate limiting and error handling
 * - Progress tracking and incremental saves
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

class FloorPriceEnhancer {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.collectionsFile = path.join(this.dataDir, 'collections.json');
    this.backupFile = path.join(this.dataDir, 'collections-backup-pre-enhancement.json');
    
    // Configuration
    this.config = {
      batchSize: 10,          // Process 10 collections at a time
      delayBetweenBatches: 3000, // 3 seconds between batches
      delayBetweenRequests: 500,  // 500ms between individual requests
      maxRetries: 3,
      saveEveryNBatches: 5    // Save progress every 5 batches
    };
    
    // Track progress
    this.stats = {
      totalCollections: 0,
      processed: 0,
      enhanced: 0,
      errors: 0,
      startTime: Date.now()
    };
  }
  
  /**
   * Load collections from disk
   */
  loadCollections() {
    try {
      if (fs.existsSync(this.collectionsFile)) {
        const data = JSON.parse(fs.readFileSync(this.collectionsFile, 'utf8'));
        console.log(`📚 Loaded ${Object.keys(data).length} collections from disk`);
        return data;
      }
    } catch (error) {
      console.error('❌ Error loading collections:', error.message);
      process.exit(1);
    }
    
    console.error('❌ No collections file found');
    process.exit(1);
  }
  
  /**
   * Save collections to disk
   */
  saveCollections(collections) {
    try {
      fs.writeFileSync(this.collectionsFile, JSON.stringify(collections, null, 2));
      console.log(`💾 Saved ${Object.keys(collections).length} collections to disk`);
    } catch (error) {
      console.error('❌ Error saving collections:', error.message);
    }
  }
  
  /**
   * Create backup before enhancement
   */
  createBackup(collections) {
    try {
      fs.writeFileSync(this.backupFile, JSON.stringify(collections, null, 2));
      console.log(`🔒 Created backup at ${this.backupFile}`);
    } catch (error) {
      console.error('❌ Error creating backup:', error.message);
    }
  }
  
  /**
   * Fetch floor price and stats for a collection
   */
  async fetchCollectionStats(symbol) {
    const url = `https://api-mainnet.magiceden.dev/v2/collections/${encodeURIComponent(symbol)}/stats`;
    
    let retries = 0;
    while (retries < this.config.maxRetries) {
      try {
        const response = await fetch(url, {
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            console.log(`   ⚠️ Collection not found: ${symbol}`);
            return null;
          }
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        // Extract and convert the data
        const stats = {
          floorPrice: data.floorPrice ? (data.floorPrice / 1_000_000_000) : 0,
          volume24h: data.volume24hr ? (data.volume24hr / 1_000_000_000) : 
                     data.volumeAll ? (data.volumeAll / 1_000_000_000) : 0,
          totalItems: data.totalItems || 0,
          listedCount: data.listedCount || 0,
          avgPrice24hr: data.avgPrice24hr ? (data.avgPrice24hr / 1_000_000_000) : 0
        };
        
        return stats;
        
      } catch (error) {
        retries++;
        console.log(`   ⚠️ Retry ${retries}/${this.config.maxRetries} for ${symbol}: ${error.message}`);
        
        if (retries >= this.config.maxRetries) {
          console.log(`   ❌ Failed to fetch stats for ${symbol} after ${retries} retries`);
          return null;
        }
        
        // Wait before retry
        await this.sleep(1000 * retries);
      }
    }
    
    return null;
  }
  
  /**
   * Process collections in batches
   */
  async enhanceFloorPrices() {
    console.log('🚀 Starting floor price enhancement...');
    
    // Load collections
    const collections = this.loadCollections();
    this.stats.totalCollections = Object.keys(collections).length;
    
    // Create backup
    this.createBackup(collections);
    
    // Convert to array for batch processing
    const collectionEntries = Object.entries(collections);
    const totalBatches = Math.ceil(collectionEntries.length / this.config.batchSize);
    
    console.log(`📊 Processing ${this.stats.totalCollections} collections in ${totalBatches} batches`);
    console.log(`⚙️ Batch size: ${this.config.batchSize}, Delay: ${this.config.delayBetweenBatches}ms`);
    console.log('');
    
    let batchNumber = 0;
    
    for (let i = 0; i < collectionEntries.length; i += this.config.batchSize) {
      batchNumber++;
      const batch = collectionEntries.slice(i, i + this.config.batchSize);
      
      console.log(`🔄 Processing batch ${batchNumber}/${totalBatches} (collections ${i + 1}-${Math.min(i + this.config.batchSize, collectionEntries.length)})`);
      
      // Process batch
      for (const [id, collection] of batch) {
        this.stats.processed++;
        
        try {
          // Skip if already enhanced recently (within 24 hours)
          if (collection.metadata?.statsEnhanced && collection.metadata?.statsLastUpdated) {
            const lastUpdated = collection.metadata.statsLastUpdated;
            const hoursSinceUpdate = (Date.now() - lastUpdated) / (1000 * 60 * 60);
            if (hoursSinceUpdate < 24) {
              console.log(`   ⏭️ Skipping ${collection.name} (recently enhanced)`);
              continue;
            }
          }
          
          console.log(`   🔍 Enhancing: ${collection.name} (${collection.symbol})`);
          
          const stats = await this.fetchCollectionStats(collection.symbol);
          
          if (stats) {
            // Update collection with enhanced data
            collection.floorPrice = stats.floorPrice;
            collection.volume24h = stats.volume24h;
            collection.totalSupply = stats.totalItems || collection.totalSupply;
            collection.listedCount = stats.listedCount;
            
            // Add metadata about enhancement
            if (!collection.metadata) collection.metadata = {};
            collection.metadata.statsEnhanced = true;
            collection.metadata.statsLastUpdated = Date.now();
            collection.metadata.avgPrice24hr = stats.avgPrice24hr;
            
            this.stats.enhanced++;
            
            if (stats.floorPrice > 0) {
              console.log(`   ✅ Enhanced ${collection.name}: ${stats.floorPrice.toFixed(4)} SOL floor, ${stats.volume24h.toFixed(2)} SOL volume`);
            } else {
              console.log(`   ✅ Enhanced ${collection.name}: No active floor price`);
            }
          } else {
            console.log(`   ❌ Failed to enhance ${collection.name}`);
            this.stats.errors++;
          }
          
          // Rate limiting between requests
          await this.sleep(this.config.delayBetweenRequests);
          
        } catch (error) {
          console.log(`   ❌ Error processing ${collection.name}: ${error.message}`);
          this.stats.errors++;
        }
      }
      
      // Save progress periodically
      if (batchNumber % this.config.saveEveryNBatches === 0) {
        console.log(`💾 Saving progress after batch ${batchNumber}...`);
        this.saveCollections(collections);
      }
      
      // Progress report
      const progress = ((this.stats.processed / this.stats.totalCollections) * 100).toFixed(1);
      console.log(`📊 Progress: ${progress}% | Enhanced: ${this.stats.enhanced} | Errors: ${this.stats.errors}`);
      console.log('');
      
      // Delay between batches (except for the last batch)
      if (i + this.config.batchSize < collectionEntries.length) {
        await this.sleep(this.config.delayBetweenBatches);
      }
    }
    
    // Final save
    console.log('💾 Saving final results...');
    this.saveCollections(collections);
    
    // Final report
    const duration = Date.now() - this.stats.startTime;
    const durationMinutes = Math.round(duration / 60000);
    
    console.log('\n🎉 Floor price enhancement completed!');
    console.log(`📊 Final Statistics:`);
    console.log(`   Total collections: ${this.stats.totalCollections}`);
    console.log(`   Processed: ${this.stats.processed}`);
    console.log(`   Successfully enhanced: ${this.stats.enhanced}`);
    console.log(`   Errors: ${this.stats.errors}`);
    console.log(`   Duration: ${durationMinutes} minutes`);
    console.log(`   Success rate: ${((this.stats.enhanced / this.stats.processed) * 100).toFixed(1)}%`);
    
    // Show some examples of enhanced collections
    console.log('\n📈 Sample enhanced collections:');
    let sampleCount = 0;
    for (const [id, collection] of Object.entries(collections)) {
      if (collection.floorPrice > 0 && sampleCount < 5) {
        console.log(`   ${collection.name}: ${collection.floorPrice.toFixed(4)} SOL floor`);
        sampleCount++;
      }
    }
  }
  
  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the enhancement
async function main() {
  const enhancer = new FloorPriceEnhancer();
  
  try {
    await enhancer.enhanceFloorPrices();
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Handle interruption gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Enhancement interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Enhancement terminated');
  process.exit(0);
});

if (require.main === module) {
  main();
} 