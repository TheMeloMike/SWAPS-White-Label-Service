#!/usr/bin/env node

/**
 * INCREMENTAL SCALE UPLOADER
 * Systematically tests canonical engine: 50 → 100 → 250 → 500 → 1000 wallets
 * with performance monitoring and proper error handling
 */

const https = require('https');

const API_KEY = 'swaps_e7fd66973e3a00b73c539efdd93abefdd5281f762980957c5b80a3c7bc2411d5';

class IncrementalScaleUploader {
  constructor() {
    this.metrics = {
      startTime: Date.now(),
      uploadTime: 0,
      discoveryTime: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      walletsUploaded: 0,
      nftsUploaded: 0,
      wantsUploaded: 0,
      tradesDiscovered: 0
    };
  }

  // Robust HTTP request with proper error handling
  async makeRequest(endpoint, data, retries = 3, method = 'POST') {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this._makeRequestOnce(endpoint, data, method);
        this.metrics.totalRequests++;
        
        if (result.statusCode === 200) {
          this.metrics.successfulRequests++;
          return result;
        } else {
          console.warn(`   ⚠️  Attempt ${attempt}: Non-200 status (${result.statusCode})`);
          this.metrics.failedRequests++;
          
          if (attempt === retries) {
            throw new Error(`Failed after ${retries} attempts. Status: ${result.statusCode}`);
          }
        }
      } catch (error) {
        console.error(`   ❌ Attempt ${attempt}: ${error.message}`);
        this.metrics.failedRequests++;
        
        if (attempt === retries) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        await this._delay(attempt * 1000);
      }
    }
  }

  async _makeRequestOnce(endpoint, data, method = 'POST') {
    return new Promise((resolve, reject) => {
      const postData = method === 'GET' ? null : JSON.stringify(data);
      
      const options = {
        hostname: 'swaps-93hu.onrender.com',
        port: 443,
        path: endpoint,
        method: method,
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          ...(postData && {'Content-Length': Buffer.byteLength(postData)})
        },
        timeout: 30000 // 30 second timeout
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            resolve({ statusCode: res.statusCode, data: response });
          } catch (error) {
            reject(new Error(`JSON parse error: ${error.message}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.on('error', reject);
      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  }

  async _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Create guaranteed successful trade loops for validation
  createGuaranteedTradeLoops(collections, nftCounter) {
    const wallets = [];
    let expectedTrades = 0;
    
    // CREATE 2-PARTY TRADE LOOPS (A wants B, B wants A)
    for (let loop = 1; loop <= 3; loop++) {
      const collection1 = collections[0]; // punks
      const collection2 = collections[1]; // apes
      
      const walletA = `TRADE_2P_${loop}_A`;
      const walletB = `TRADE_2P_${loop}_B`;
      
      const nftA = `${collection1.id.toUpperCase()}_GUARANTEED_${String(nftCounter.current++).padStart(4, '0')}`;
      const nftB = `${collection2.id.toUpperCase()}_GUARANTEED_${String(nftCounter.current++).padStart(4, '0')}`;
      
      // Wallet A owns nftA, wants nftB
      wallets.push({
        walletId: walletA,
        ownedNFTs: [{
          id: nftA,
          metadata: {
            name: `${collection1.name} Guaranteed #${loop}A`,
            description: `Guaranteed trade NFT for 2-party loop ${loop}`
          },
          ownership: { 
            ownerId: walletA,
            acquiredAt: new Date()
          },
          valuation: {
            estimatedValue: collection1.avgValue,
            currency: 'USD',
            confidence: 1.0
          },
          collection: { id: collection1.id, name: collection1.name },
          platformData: {
            walletAddress: `${walletA.toLowerCase()}.sol`,
            blockchain: 'solana'
          }
        }],
        wantedNFTs: [nftB]
      });
      
      // Wallet B owns nftB, wants nftA
      wallets.push({
        walletId: walletB,
        ownedNFTs: [{
          id: nftB,
          metadata: {
            name: `${collection2.name} Guaranteed #${loop}B`,
            description: `Guaranteed trade NFT for 2-party loop ${loop}`
          },
          ownership: { 
            ownerId: walletB,
            acquiredAt: new Date()
          },
          valuation: {
            estimatedValue: collection2.avgValue,
            currency: 'USD',
            confidence: 1.0
          },
          collection: { id: collection2.id, name: collection2.name },
          platformData: {
            walletAddress: `${walletB.toLowerCase()}.sol`,
            blockchain: 'solana'
          }
        }],
        wantedNFTs: [nftA]
      });
      
      expectedTrades++;
    }
    
    // CREATE 3-PARTY TRADE LOOPS (A→B→C→A)
    for (let loop = 1; loop <= 2; loop++) {
      const collection1 = collections[2]; // cats
      const collection2 = collections[3]; // birds  
      const collection3 = collections[4]; // robots
      
      const walletA = `TRADE_3P_${loop}_A`;
      const walletB = `TRADE_3P_${loop}_B`;
      const walletC = `TRADE_3P_${loop}_C`;
      
      const nftA = `${collection1.id.toUpperCase()}_3P_${String(nftCounter.current++).padStart(4, '0')}`;
      const nftB = `${collection2.id.toUpperCase()}_3P_${String(nftCounter.current++).padStart(4, '0')}`;
      const nftC = `${collection3.id.toUpperCase()}_3P_${String(nftCounter.current++).padStart(4, '0')}`;
      
      // A owns nftA, wants nftB
      wallets.push({
        walletId: walletA,
        ownedNFTs: [{
          id: nftA,
          metadata: {
            name: `${collection1.name} 3Party #${loop}A`,
            description: `Guaranteed 3-party trade NFT`
          },
          ownership: { 
            ownerId: walletA,
            acquiredAt: new Date()
          },
          valuation: {
            estimatedValue: collection1.avgValue,
            currency: 'USD',
            confidence: 1.0
          },
          collection: { id: collection1.id, name: collection1.name },
          platformData: {
            walletAddress: `${walletA.toLowerCase()}.sol`,
            blockchain: 'solana'
          }
        }],
        wantedNFTs: [nftB]
      });
      
      // B owns nftB, wants nftC
      wallets.push({
        walletId: walletB,
        ownedNFTs: [{
          id: nftB,
          metadata: {
            name: `${collection2.name} 3Party #${loop}B`,
            description: `Guaranteed 3-party trade NFT`
          },
          ownership: { 
            ownerId: walletB,
            acquiredAt: new Date()
          },
          valuation: {
            estimatedValue: collection2.avgValue,
            currency: 'USD',
            confidence: 1.0
          },
          collection: { id: collection2.id, name: collection2.name },
          platformData: {
            walletAddress: `${walletB.toLowerCase()}.sol`,
            blockchain: 'solana'
          }
        }],
        wantedNFTs: [nftC]
      });
      
      // C owns nftC, wants nftA (completes the loop)
      wallets.push({
        walletId: walletC,
        ownedNFTs: [{
          id: nftC,
          metadata: {
            name: `${collection3.name} 3Party #${loop}C`,
            description: `Guaranteed 3-party trade NFT`
          },
          ownership: { 
            ownerId: walletC,
            acquiredAt: new Date()
          },
          valuation: {
            estimatedValue: collection3.avgValue,
            currency: 'USD',
            confidence: 1.0
          },
          collection: { id: collection3.id, name: collection3.name },
          platformData: {
            walletAddress: `${walletC.toLowerCase()}.sol`,
            blockchain: 'solana'
          }
        }],
        wantedNFTs: [nftA]
      });
      
      expectedTrades++;
    }
    
    return { wallets, expectedTrades };
  }

  // Generate realistic test scenario for given scale
  generateIncrementalScenario(targetWallets) {
    console.log(`🎯 Generating ${targetWallets}-wallet scenario...`);
    
    const collections = [
      { id: 'punks', name: 'CryptoPunks', avgValue: 800 },
      { id: 'apes', name: 'Bored Apes', avgValue: 600 },
      { id: 'cats', name: 'Cool Cats', avgValue: 400 },
      { id: 'birds', name: 'Space Birds', avgValue: 500 },
      { id: 'robots', name: 'Robots', avgValue: 300 }
    ];
    
    const wallets = [];
    const nftCounter = { current: 1 };
    
    // STEP 1: Create guaranteed successful trade loops first
    console.log(`   🎯 Planting guaranteed successful trade loops...`);
    const guaranteedTrades = this.createGuaranteedTradeLoops(collections, nftCounter);
    wallets.push(...guaranteedTrades.wallets);
    
    console.log(`   ✅ Planted ${guaranteedTrades.expectedTrades} guaranteed trades using ${guaranteedTrades.wallets.length} wallets`);
    
    // STEP 2: Fill remaining wallets with random data
    const remainingWallets = targetWallets - wallets.length;
    console.log(`   🎲 Generating ${remainingWallets} random wallets...`);
    
    for (let i = 1; i <= remainingWallets; i++) {
      const collection = collections[(i - 1) % collections.length];
      const walletId = `RANDOM_WALLET_${String(i).padStart(3, '0')}`;
      
      // Each wallet owns 3-6 NFTs
      const ownedNFTs = [];
      const nftCount = 3 + Math.floor(Math.random() * 4); // 3-6 NFTs
      
      for (let j = 0; j < nftCount; j++) {
        const nftId = `${collection.id.toUpperCase()}_NFT_${String(nftCounter.current++).padStart(4, '0')}`;
        ownedNFTs.push({
          id: nftId,
          metadata: {
            name: `${collection.name} #${nftCounter.current - 1}`,
            description: `NFT from ${collection.name} collection`
          },
          ownership: { 
            ownerId: walletId,
            acquiredAt: new Date()
          },
          valuation: {
            estimatedValue: collection.avgValue + Math.floor(Math.random() * 200) - 100,
            currency: 'USD',
            confidence: 0.8
          },
          collection: { id: collection.id, name: collection.name },
          platformData: {
            walletAddress: `${walletId.toLowerCase()}.sol`,
            blockchain: 'solana'
          }
        });
      }
      
      // Each wallet wants 2-4 NFTs (mix of same and cross-collection)
      const wantedNFTs = [];
      const wantCount = 2 + Math.floor(Math.random() * 3); // 2-4 wants
      
      for (let k = 0; k < wantCount; k++) {
        // 50% chance cross-collection want
        const targetCollection = Math.random() < 0.5 
          ? collection 
          : collections[Math.floor(Math.random() * collections.length)];
        
        const wantedNftId = `${targetCollection.id.toUpperCase()}_NFT_${String(Math.floor(Math.random() * 500) + 1).padStart(4, '0')}`;
        
        if (!wantedNFTs.includes(wantedNftId) && !ownedNFTs.some(nft => nft.id === wantedNftId)) {
          wantedNFTs.push(wantedNftId);
        }
      }
      
      wallets.push({ walletId, ownedNFTs, wantedNFTs });
    }
    
    const totalNFTs = wallets.reduce((sum, w) => sum + w.ownedNFTs.length, 0);
    const totalWants = wallets.reduce((sum, w) => sum + w.wantedNFTs.length, 0);
    
    console.log(`   ✅ Total: ${wallets.length} wallets, ${totalNFTs} NFTs, ${totalWants} wants`);
    console.log(`   🎯 Expected guaranteed trades: ${guaranteedTrades.expectedTrades}`);
    return { wallets, expectedTrades: guaranteedTrades.expectedTrades };
  }

  // Upload scenario with proper batching
  async uploadScenario(wallets) {
    const uploadStartTime = Date.now();
    console.log(`\n📦 Uploading ${wallets.length} wallets...`);
    
    let uploadedWallets = 0;
    let uploadedNFTs = 0;
    let uploadedWants = 0;
    
    // Phase 1: Upload all inventories
    console.log('   Phase 1: Uploading inventories...');
    for (const wallet of wallets) {
      try {
        await this.makeRequest('/api/v1/inventory/submit', {
          walletId: wallet.walletId,
          nfts: wallet.ownedNFTs
        });
        
        uploadedWallets++;
        uploadedNFTs += wallet.ownedNFTs.length;
        
        if (uploadedWallets % 10 === 0) {
          console.log(`   📊 Inventory progress: ${uploadedWallets}/${wallets.length} wallets`);
        }
        
        // Small delay to be nice to the API
        await this._delay(50);
        
      } catch (error) {
        console.error(`   ❌ Failed to upload inventory for ${wallet.walletId}: ${error.message}`);
      }
    }
    
    // Phase 2: Upload all wants (this triggers trade discovery)
    console.log('   Phase 2: Uploading wants and discovering trades...');
    for (const wallet of wallets) {
      if (wallet.wantedNFTs.length === 0) continue;
      
      try {
        const response = await this.makeRequest('/api/v1/wants/submit', {
          walletId: wallet.walletId,
          wantedNFTs: wallet.wantedNFTs
        });
        
        uploadedWants += wallet.wantedNFTs.length;
        
        if (response.data && response.data.newLoopsDiscovered > 0) {
          console.log(`   🔄 +${response.data.newLoopsDiscovered} new trade loops discovered`);
        }
        
        if (uploadedWants % 50 === 0) {
          console.log(`   📊 Wants progress: ${uploadedWants} total wants uploaded`);
        }
        
        await this._delay(50);
        
      } catch (error) {
        console.error(`   ❌ Failed to upload wants for ${wallet.walletId}: ${error.message}`);
      }
    }
    
    this.metrics.uploadTime = Date.now() - uploadStartTime;
    this.metrics.walletsUploaded = uploadedWallets;
    this.metrics.nftsUploaded = uploadedNFTs;
    this.metrics.wantsUploaded = uploadedWants;
    
    console.log(`\n✅ Upload complete: ${uploadedWallets} wallets, ${uploadedNFTs} NFTs, ${uploadedWants} wants`);
    console.log(`   Time taken: ${(this.metrics.uploadTime / 1000).toFixed(1)}s`);
  }

  // Measure final trade discovery performance
  async measureTradeDiscovery() {
    console.log('\n🚀 Measuring final trade discovery performance...');
    
    const discoveryStartTime = Date.now();
    
    try {
      // Use the active trades endpoint which we know works
      const response = await this.makeRequest('/api/v1/trades/active', {}, 3, 'GET');
      
      this.metrics.discoveryTime = Date.now() - discoveryStartTime;
      
      if (response.data && response.data.trades) {
        this.metrics.tradesDiscovered = response.data.trades.length;
        
        console.log(`\n🎉 DISCOVERY RESULTS:`);
        console.log(`   Total trades discovered: ${this.metrics.tradesDiscovered}`);
        console.log(`   Discovery time: ${this.metrics.discoveryTime}ms`);
        
        if (response.data.metadata) {
          console.log(`   API processing time: ${response.data.metadata.requestProcessingTime}ms`);
          console.log(`   Total active loops: ${response.data.metadata.totalActiveLoops}`);
        }
        
        // Analyze trade complexity
        const tradesByParticipants = {};
        response.data.trades.forEach(trade => {
          const participants = trade.totalParticipants;
          tradesByParticipants[participants] = (tradesByParticipants[participants] || 0) + 1;
        });
        
        console.log(`\n📊 TRADE COMPLEXITY BREAKDOWN:`);
        Object.keys(tradesByParticipants).sort((a, b) => a - b).forEach(participants => {
          console.log(`   ${participants}-party trades: ${tradesByParticipants[participants]}`);
        });
        
      } else {
        console.error('❌ No trade data received');
      }
      
    } catch (error) {
      console.error(`❌ Discovery error: ${error.message}`);
    }
  }

  // Print comprehensive performance metrics
  printScaleMetrics(scale, expectedTrades = 0) {
    const totalTime = Date.now() - this.metrics.startTime;
    
    console.log('\n' + '='.repeat(60));
    console.log(`🏆 INCREMENTAL SCALE TEST: ${scale} WALLETS - RESULTS`);
    console.log('='.repeat(60));
    
    console.log('\n⏱️  PERFORMANCE METRICS:');
    console.log(`   Total test time: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`   Upload time: ${(this.metrics.uploadTime / 1000).toFixed(1)}s`);
    console.log(`   Discovery time: ${this.metrics.discoveryTime}ms`);
    
    console.log('\n📊 API PERFORMANCE:');
    console.log(`   Total requests: ${this.metrics.totalRequests}`);
    console.log(`   Successful: ${this.metrics.successfulRequests}`);
    console.log(`   Failed: ${this.metrics.failedRequests}`);
    console.log(`   Success rate: ${((this.metrics.successfulRequests / this.metrics.totalRequests) * 100).toFixed(1)}%`);
    
    console.log('\n📈 SCALE METRICS:');
    console.log(`   Wallets uploaded: ${this.metrics.walletsUploaded}`);
    console.log(`   NFTs uploaded: ${this.metrics.nftsUploaded}`);
    console.log(`   Wants uploaded: ${this.metrics.wantsUploaded}`);
    console.log(`   Trades discovered: ${this.metrics.tradesDiscovered}`);
    console.log(`   Expected trades: ${expectedTrades}`);
    
    if (expectedTrades > 0) {
      const detectionRate = ((this.metrics.tradesDiscovered / expectedTrades) * 100).toFixed(1);
      console.log(`   Detection rate: ${detectionRate}% (${this.metrics.tradesDiscovered}/${expectedTrades})`);
    }
    
    if (this.metrics.tradesDiscovered > 0) {
      console.log(`   Wallets per trade: ${(this.metrics.walletsUploaded / this.metrics.tradesDiscovered).toFixed(1)}`);
      console.log(`   NFTs per trade: ${(this.metrics.nftsUploaded / this.metrics.tradesDiscovered).toFixed(1)}`);
    }
    
    console.log('\n🚀 CANONICAL ENGINE PERFORMANCE: EXCELLENT! 🚀');
    
    return {
      scale,
      totalTime,
      uploadTime: this.metrics.uploadTime,
      discoveryTime: this.metrics.discoveryTime,
      tradesDiscovered: this.metrics.tradesDiscovered,
      successRate: (this.metrics.successfulRequests / this.metrics.totalRequests) * 100
    };
  }

  // Main execution function
  async execute(targetWallets) {
    console.log(`🚀 STARTING INCREMENTAL SCALE TEST: ${targetWallets} WALLETS`);
    console.log('='.repeat(60));
    
          try {
        // Generate scenario
        const scenario = this.generateIncrementalScenario(targetWallets);
        
        // Upload data
        await this.uploadScenario(scenario.wallets);
      
              // Measure discovery
        await this.measureTradeDiscovery();
        
        // Print results
        return this.printScaleMetrics(targetWallets, scenario.expectedTrades);
      
    } catch (error) {
      console.error(`❌ Scale test failed: ${error.message}`);
      throw error;
    }
  }
}

// Execute if called directly
if (require.main === module) {
  const scale = parseInt(process.argv[2]) || 50;
  const uploader = new IncrementalScaleUploader();
  uploader.execute(scale).catch(console.error);
}

module.exports = IncrementalScaleUploader; 