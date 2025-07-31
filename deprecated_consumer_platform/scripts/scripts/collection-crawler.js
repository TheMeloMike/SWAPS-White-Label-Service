#!/usr/bin/env node

/**
 * SWAPS Collection Crawler - Magic Eden API Version
 * 
 * Purpose: Comprehensive collection discovery using Magic Eden's public API
 * No API key required, much more reliable than blockchain scanning
 * 
 * Features:
 * - Multiple discovery strategies (all collections, popular, new, trending)
 * - Rich metadata extraction (stats, images, social links)
 * - Persistent local storage with auto-save
 * - Rate limiting protection
 * - Comprehensive collection database building
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

class MagicEdenCollectionCrawler {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.collectionsFile = path.join(this.dataDir, 'collections.json');
    this.stateFile = path.join(this.dataDir, 'crawler-state.json');
    
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // Load existing data
    this.collections = this.loadCollections();
    this.state = this.loadState();
    
    // Configuration optimized for Magic Eden API
    this.config = {
      // Magic Eden API endpoints - no authentication required
      endpoints: {
        allCollections: 'https://api-mainnet.magiceden.dev/v2/collections',
        // Note: Other endpoints from docs don't seem to work publicly
        // Focus on the working /v2/collections endpoint which has thousands of collections
      },
      
      // Crawl strategy - much faster than blockchain scanning
      crawlInterval: 5 * 60 * 1000, // 5 minutes between cycles
      
      // Rate limiting - conservative for public API
      rateLimit: {
        requestsPerSecond: 2,    // 2 RPS - very safe
        backoffMs: 1000,         // 1s backoff on failures  
        maxRetries: 3
      },
      
      // Discovery strategies
      strategies: {
        // Get all collections - comprehensive discovery via working endpoint
        allCollections: {
          enabled: true,
          priority: 1,
          // Fetch all collections every 2 hours (more conservative for full pagination)
          refreshInterval: 2 * 60 * 60 * 1000
        }
      },
      
      // Cache settings
      cache: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours (fresher than blockchain data)
        autoSaveInterval: 2 * 60 * 1000   // Auto-save every 2 minutes
      }
    };
    
    // Runtime state
    this.running = false;
    this.stats = {
      totalCollections: Object.keys(this.collections).length,
      crawlsExecuted: this.state.crawlsExecuted || 0,
      lastCrawlTime: this.state.lastCrawlTime || null,
      collectionsDiscovered: this.state.collectionsDiscovered || 0,
      apiCalls: this.state.apiCalls || 0,
      errors: this.state.errors || 0,
      uptime: Date.now()
    };
    
    console.log('🚀 SWAPS Magic Eden Collection Crawler initialized');
    console.log(`📊 Starting with ${this.stats.totalCollections} cached collections`);
    console.log('🎯 Using Magic Eden API (no auth required)');
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
      console.warn('⚠️ Error loading collections:', error.message);
    }
    
    // Start empty - will populate from Magic Eden API
    return {};
  }
  
  /**
   * Load crawler state from disk
   */
  loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const state = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
        console.log(`🔄 Resumed crawler state from ${new Date(state.lastCrawlTime || 0).toISOString()}`);
        return state;
      }
    } catch (error) {
      console.warn('⚠️ Error loading state:', error.message);
    }
    
    return {
      crawlsExecuted: 0,
      lastCrawlTime: null,
      collectionsDiscovered: 0,
      apiCalls: 0,
      errors: 0,
      lastAllCollectionsFetch: null,
      processedSymbols: new Set()
    };
  }
  
  /**
   * Save collections to disk
   */
  saveCollections() {
    try {
      fs.writeFileSync(this.collectionsFile, JSON.stringify(this.collections, null, 2));
      console.log(`💾 Saved ${Object.keys(this.collections).length} collections to disk`);
    } catch (error) {
      console.error('❌ Error saving collections:', error.message);
    }
  }
  
  /**
   * Save crawler state to disk
   */
  saveState() {
    try {
      const stateToSave = {
        ...this.state,
        processedSymbols: Array.from(this.state.processedSymbols || [])
      };
      fs.writeFileSync(this.stateFile, JSON.stringify(stateToSave, null, 2));
      console.log('💾 Saved crawler state to disk');
    } catch (error) {
      console.error('❌ Error saving state:', error.message);
    }
  }
  
  /**
   * Start the collection crawler
   */
  async start() {
    if (this.running) {
      console.log('⚠️ Crawler is already running');
      return;
    }
    
    this.running = true;
    console.log('🚀 Starting Magic Eden collection crawler...');
    
    // Start auto-save interval
    this.autoSaveInterval = setInterval(() => {
      this.saveCollections();
      this.saveState();
    }, this.config.cache.autoSaveInterval);
    
    console.log(`⏰ Crawl interval: ${Math.round(this.config.crawlInterval / 1000)}s`);
    console.log('🎯 Using Magic Eden public API endpoints');
    
    // Start crawling immediately
    await this.crawl();
    
    this.crawlInterval = setInterval(async () => {
      if (this.running) {
        await this.crawl();
      }
    }, this.config.crawlInterval);
    
    console.log('✅ Collection crawler started successfully');
  }
  
  /**
   * Stop the collection crawler
   */
  async stop() {
    if (!this.running) {
      console.log('⚠️ Crawler is not running');
      return;
    }
    
    this.running = false;
    console.log('🛑 Stopping collection crawler...');
    
    if (this.crawlInterval) {
      clearInterval(this.crawlInterval);
    }
    
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    // Final save
    this.saveCollections();
    this.saveState();
    
    console.log('✅ Collection crawler stopped successfully');
  }
  
  /**
   * Execute a single crawl cycle
   */
  async crawl() {
    const startTime = Date.now();
    console.log(`\n🔍 Starting crawl cycle #${this.stats.crawlsExecuted + 1}`);
    
    try {
      const initialCount = Object.keys(this.collections).length;
      
      // Execute discovery strategy: comprehensive all collections fetch
      let allDiscoveries = [];
      
      // Strategy: All Collections (comprehensive discovery with batch processing)
      if (this.shouldFetchAllCollections()) {
        console.log('📋 Fetching ALL collections from Magic Eden API with batch processing...');
        await this.fetchAllCollections(); // Now processes internally in batches
        this.state.lastAllCollectionsFetch = Date.now();
      } else {
        console.log('⏭️ Skipping all collections fetch (recently updated)');
      }
      
      // No need to process discoveries - they were processed in batches during fetching
      const processed = 0; // Batch processing handles this internally
      
      const finalCount = Object.keys(this.collections).length;
      const discovered = finalCount - initialCount;
      const duration = Date.now() - startTime;
      
      // Update stats
      this.stats.crawlsExecuted++;
      this.stats.lastCrawlTime = Date.now();
      this.stats.collectionsDiscovered += discovered;
      this.stats.totalCollections = finalCount;
      
      console.log(`✅ Crawl completed in ${Math.round(duration / 1000)}s`);
      console.log(`📈 Discovered: ${discovered} new collections`);
      console.log(`📊 Total collections: ${finalCount}`);
      console.log(`🌐 Total API calls: ${this.stats.apiCalls}`);
      console.log(`🔄 Processed: ${processed} total discoveries`);
      
      // Update state
      this.state.crawlsExecuted = this.stats.crawlsExecuted;
      this.state.lastCrawlTime = this.stats.lastCrawlTime;
      this.state.collectionsDiscovered = this.stats.collectionsDiscovered;
      this.state.apiCalls = this.stats.apiCalls;
      
    } catch (error) {
      this.stats.errors++;
      this.state.errors = this.stats.errors;
      console.error('❌ Error during crawl:', error.message);
    }
  }
  
  /**
   * Determine if we should fetch all collections
   */
  shouldFetchAllCollections() {
    if (!this.config.strategies.allCollections.enabled) return false;
    
    // Use the configured refresh interval
    const refreshInterval = this.config.strategies.allCollections.refreshInterval;
    const lastFetch = this.state.lastAllCollectionsFetch || 0;
    
    return (Date.now() - lastFetch) > refreshInterval;
  }
  
  /**
   * Fetch all collections from Magic Eden with batch processing (process as we go)
   */
  async fetchAllCollections() {
    try {
      let offset = 0;
      const limit = 20; // Use 20 to ensure we can access ALL offsets (20, 40, 60, etc.)
      const batchSize = 100; // Process every 100 collections for immediate progress
      let hasMore = true;
      let consecutiveErrors = 0;
      const maxErrors = 3;
      let totalFetched = 0;
      let batchCollections = [];
      
      console.log('📋 Starting paginated collection fetch with BATCH PROCESSING...');
      console.log(`   🔧 Using limit=20, batch processing every ${batchSize} collections`);
      console.log('   🎯 You\'ll see database growth every few minutes!');
      
      while (hasMore && consecutiveErrors < maxErrors) {
        const url = `${this.config.endpoints.allCollections}?offset=${offset}&limit=${limit}`;
        console.log(`   📄 Fetching page: offset=${offset}, limit=${limit}`);
        
        const response = await this.makeApiCall(url);
        
        if (response && Array.isArray(response) && response.length > 0) {
          // Transform and add to current batch
          const transformed = response.map(col => this.transformMagicEdenCollection(col, 'all_collections'));
          batchCollections.push(...transformed);
          totalFetched += response.length;
          
          console.log(`   ✅ Retrieved ${response.length} collections (total fetched: ${totalFetched}, batch: ${batchCollections.length})`);
          
          consecutiveErrors = 0; // Reset error counter on success
          
          // Process batch when it reaches batchSize
          if (batchCollections.length >= batchSize) {
            console.log(`\n🔄 Processing batch of ${batchCollections.length} collections...`);
            await this.processBatch(batchCollections);
            batchCollections = []; // Clear batch for next round
            
            // Save progress after each batch
            this.saveCollections();
            this.saveState();
            console.log(`💾 Progress saved! Database now has ${Object.keys(this.collections).length} collections\n`);
          }
          
          // Check if we got a full page - if not, we've reached the end
          hasMore = response.length === limit;
          offset += limit;
          
          // Rate limiting between pages (more conservative)
          if (hasMore) {
            await this.sleep(2000); // 2 seconds between pages
          }
        } else if (response && response.msg) {
          // API returned an error message
          console.warn(`   ⚠️ API constraint hit: ${response.msg}`);
          console.log(`   🛑 Stopping pagination at offset ${offset}`);
          hasMore = false;
        } else {
          consecutiveErrors++;
          console.warn(`   ⚠️ Empty response (${consecutiveErrors}/${maxErrors})`);
          
          if (consecutiveErrors >= maxErrors) {
            console.log(`   🛑 Too many consecutive errors, stopping pagination`);
            hasMore = false;
          } else {
            offset += limit; // Try next offset
          }
        }
      }
      
      // Process any remaining collections in the final batch
      if (batchCollections.length > 0) {
        console.log(`\n🔄 Processing final batch of ${batchCollections.length} collections...`);
        await this.processBatch(batchCollections);
        this.saveCollections();
        this.saveState();
        console.log(`💾 Final save complete! Database now has ${Object.keys(this.collections).length} collections`);
      }
      
      console.log(`📋 Batch processing complete! Processed ${totalFetched} total collections`);
      return []; // Return empty array since we processed everything in batches
      
    } catch (error) {
      console.error('❌ Error fetching all collections:', error.message);
    }
    
    return [];
  }
  
  /**
   * Process a batch of collections immediately (used in batch processing)
   */
  async processBatch(batchCollections) {
    // Skip enhancement for speed in batch mode - can be added later if needed
    console.log(`📊 Processing ${batchCollections.length} collections in batch...`);
    
    const processed = await this.processDiscoveries(batchCollections);
    return processed;
  }
  
  /**
   * Enhance collections with real trading stats from individual collection endpoints
   */
  async enhanceCollectionsWithStats(collections) {
    const enhanced = [];
    const batchSize = 5; // Process 5 collections at a time to avoid overwhelming the API
    
    console.log(`📊 Enhancing ${collections.length} collections with stats (${batchSize} at a time)...`);
    
    for (let i = 0; i < collections.length; i += batchSize) {
      const batch = collections.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (collection) => {
        try {
          // Get real stats from Magic Eden stats endpoint
          const statsUrl = `https://api-mainnet.magiceden.dev/v2/collections/${collection.symbol}/stats`;
          const stats = await this.makeApiCall(statsUrl);
          
          if (stats) {
            // Update with real trading data - CONVERT LAMPORTS TO SOL
            collection.floorPrice = stats.floorPrice ? (stats.floorPrice / 1000000000) : (collection.floorPrice || 0);
            collection.volume24h = stats.volumeAll ? (stats.volumeAll / 1000000000) : 
                                  stats.volume24hr ? (stats.volume24hr / 1000000000) : 
                                  (collection.volume24h || 0);
            collection.totalSupply = stats.totalItems || collection.totalSupply || 0;
            collection.listedCount = stats.listedCount || 0;
            collection.metadata.statsEnhanced = true;
            collection.metadata.statsLastUpdated = Date.now();
            
            console.log(`   ✅ Enhanced ${collection.name}: ${collection.floorPrice.toFixed(3)} SOL floor`);
          } else {
            console.log(`   ⚠️ No stats found for ${collection.name}`);
          }
          
          return collection;
        } catch (error) {
          console.warn(`   ❌ Failed to enhance ${collection.name}:`, error.message);
          return collection; // Return original collection if enhancement fails
        }
      });
      
      const enhancedBatch = await Promise.all(batchPromises);
      enhanced.push(...enhancedBatch);
      
      // Rate limiting between batches
      if (i + batchSize < collections.length) {
        await this.sleep(2000); // 2 second pause between batches
      }
    }
    
    console.log(`📊 Enhanced ${enhanced.length} collections with real trading stats`);
    return enhanced;
  }
  
  /**
   * Transform Magic Eden API response to our standard format
   */
  transformMagicEdenCollection(magicEdenCol, source) {
    return {
      id: magicEdenCol.symbol || magicEdenCol.id,
      name: magicEdenCol.name || 'Unknown Collection',
      symbol: magicEdenCol.symbol || '',
      verified: magicEdenCol.isBadged || false, // Use Magic Eden's actual badge status
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
  
  /**
   * Process discovered collections and update database
   */
  async processDiscoveries(discoveries) {
    if (discoveries.length === 0) return 0;
    
    console.log(`🔄 Processing ${discoveries.length} discovered collections...`);
    console.log(`📊 Current database size: ${Object.keys(this.collections).length} collections`);
    
    let processed = 0;
    let newCollections = 0;
    let skippedInvalid = 0;
    let updatedExisting = 0;
    
    // Sample first few collections for debugging
    console.log(`🔍 Sample collections being processed:`);
    for (let i = 0; i < Math.min(5, discoveries.length); i++) {
      const col = discoveries[i];
      console.log(`   [${i}] ID: "${col.id}" | Name: "${col.name}" | Symbol: "${col.symbol}"`);
    }
    
    for (const collection of discoveries) {
      if (!collection.id || !collection.name) {
        skippedInvalid++;
        console.log(`   ⚠️ Skipping invalid collection: ID="${collection.id}", Name="${collection.name}"`);
        continue;
      }
      
      if (!this.collections[collection.id]) {
        // New collection
        this.collections[collection.id] = collection;
        newCollections++;
        if (newCollections <= 5) { // Log first 5 new collections
          console.log(`   ✅ NEW: ${collection.name} (ID: ${collection.id})`);
        }
      } else {
        // Update existing collection with new data
        const existing = this.collections[collection.id];
        
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
        if (updatedExisting <= 3) { // Log first 3 updates
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
    console.log(`   📈 Database size now: ${Object.keys(this.collections).length} collections`);
    
    return processed;
  }
  
  /**
   * Make API call with rate limiting and error handling
   */
  async makeApiCall(url) {
    for (let retry = 0; retry < this.config.rateLimit.maxRetries; retry++) {
      try {
        // Rate limiting
        await this.sleep(1000 / this.config.rateLimit.requestsPerSecond);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'SWAPS-Collection-Crawler/1.0',
            'Accept': 'application/json'
          }
        });
        
        this.stats.apiCalls++;
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
        
      } catch (error) {
        console.warn(`⚠️ API call failed (attempt ${retry + 1}):`, error.message);
        console.warn(`   URL: ${url}`);
        
        if (retry < this.config.rateLimit.maxRetries - 1) {
          await this.sleep(this.config.rateLimit.backoffMs * (retry + 1));
        }
      }
    }
    
    return null;
  }
  
  /**
   * Check if collection is verified (simplified heuristic)
   */
  isVerifiedCollection(name) {
    if (!name) return false;
    
    const verified = [
      'DeGods', 'y00ts', 'Okay Bears', 'Solana Monkey Business', 'Famous Fox Federation',
      'Mad Lads', 'DRiP', 'Aurory', 'Star Atlas', 'Thugbirdz', 'Claynosaurz',
      'Shadowy Super Coder', 'SolPunks', 'Galactic Geckos', 'Degen Ape Academy'
    ];
    
    return verified.some(v => name.toLowerCase().includes(v.toLowerCase()));
  }
  
  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get crawler statistics
   */
  getStats() {
    return {
      ...this.stats,
      running: this.running,
      uptime: Date.now() - this.stats.uptime,
      collectionsPerHour: this.stats.crawlsExecuted > 0 
        ? Math.round((this.stats.collectionsDiscovered / ((Date.now() - this.stats.uptime) / 3600000)))
        : 0
    };
  }
  
  /**
   * Search collections in the local database
   */
  searchCollections(query, maxResults = 10) {
    const normalizedQuery = query.toLowerCase();
    const matches = [];
    
    for (const collection of Object.values(this.collections)) {
      const nameMatch = collection.name.toLowerCase().includes(normalizedQuery);
      const symbolMatch = collection.symbol.toLowerCase().includes(normalizedQuery);
      const descMatch = collection.metadata?.description?.toLowerCase().includes(normalizedQuery);
      
      if (nameMatch || symbolMatch || descMatch) {
        matches.push({
          ...collection,
          relevance: nameMatch ? 100 : (symbolMatch ? 80 : 50)
        });
      }
    }
    
    return matches
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxResults);
  }
}

// CLI Interface
async function main() {
  const crawler = new MagicEdenCollectionCrawler();
  
  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Received shutdown signal');
    await crawler.stop();
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'start':
      await crawler.start();
      break;
      
    case 'stats':
      console.log('📊 Crawler Statistics:');
      console.log(JSON.stringify(crawler.getStats(), null, 2));
      break;
      
    case 'search':
      const query = args[1];
      if (!query) {
        console.error('Usage: node collection-crawler.js search <query>');
        process.exit(1);
      }
      const results = crawler.searchCollections(query, 5);
      console.log(`🔍 Search results for "${query}":`);
      console.log(JSON.stringify(results, null, 2));
      break;
      
    case 'test':
      console.log('🧪 Testing Magic Eden API endpoints...');
      const testCrawler = new MagicEdenCollectionCrawler();
      
      // Test main collections endpoint
      const testUrl = 'https://api-mainnet.magiceden.dev/v2/collections';
      console.log(`📞 Testing: ${testUrl}`);
      
      const testResult = await testCrawler.makeApiCall(testUrl);
      if (testResult && Array.isArray(testResult)) {
        console.log(`✅ SUCCESS: Retrieved ${testResult.length} collections`);
        console.log(`📋 Sample collection: ${testResult[0]?.name || 'Unknown'}`);
        console.log(`🔍 Sample symbol: ${testResult[0]?.symbol || 'Unknown'}`);
      } else {
        console.log('❌ FAILED: No data returned');
      }
      break;
      
    default:
      console.log('🚀 SWAPS Magic Eden Collection Crawler');
      console.log('');
      console.log('Usage:');
      console.log('  node collection-crawler.js start   - Start the crawler');
      console.log('  node collection-crawler.js stats   - Show statistics');
      console.log('  node collection-crawler.js search <query> - Search collections');
      console.log('  node collection-crawler.js test    - Test Magic Eden API');
      break;
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = MagicEdenCollectionCrawler; 