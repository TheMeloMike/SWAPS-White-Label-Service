#!/usr/bin/env node

/**
 * SPEED ANALYSIS: SYSTEM PERFORMANCE TIMING
 * Analyzes upload speeds, discovery times, and throughput metrics
 * across different scales to understand performance characteristics
 */

// Timing data from our incremental scaling tests
const speedData = [
  {
    wallets: 50,
    nfts: 190,
    wants: 122,
    tradesDiscovered: 5,
    // Timing data (all in seconds unless noted)
    totalTime: 19.9,
    uploadTime: 19.8,
    discoveryTime: 0.086, // 86ms converted to seconds
    apiRequests: 101,
    successfulRequests: 101,
    failedRequests: 0
  },
  {
    wallets: 100,
    nfts: 403,
    wants: 282,
    tradesDiscovered: 6,
    totalTime: 135.9,
    uploadTime: 135.8,
    discoveryTime: 0.082, // 82ms
    apiRequests: 201,
    successfulRequests: 201,
    failedRequests: 0
  },
  {
    wallets: 250,
    nfts: 1064,
    wants: 724,
    tradesDiscovered: 64,
    totalTime: 1142.3,
    uploadTime: 1142.2,
    discoveryTime: 0.135, // 135ms
    apiRequests: 501,
    successfulRequests: 501,
    failedRequests: 0
  }
];

class SpeedAnalyzer {
  constructor(data) {
    this.data = data;
  }

  // Calculate speed metrics
  calculateSpeedMetrics() {
    return this.data.map(point => {
      // Upload speeds
      const walletsPerSecond = point.wallets / point.uploadTime;
      const walletsPerMinute = walletsPerSecond * 60;
      const nftsPerSecond = point.nfts / point.uploadTime;
      const wantsPerSecond = point.wants / point.uploadTime;
      const requestsPerSecond = point.apiRequests / point.uploadTime;
      
      // Discovery speeds
      const tradesPerMillisecond = point.tradesDiscovered / (point.discoveryTime * 1000);
      const discoveryTimeMs = point.discoveryTime * 1000;
      
      // Efficiency metrics
      const timePerWallet = point.uploadTime / point.wallets;
      const timePerNFT = point.uploadTime / point.nfts;
      const timePerRequest = point.uploadTime / point.apiRequests;
      
      return {
        ...point,
        // Upload throughput
        walletsPerSecond,
        walletsPerMinute,
        nftsPerSecond,
        wantsPerSecond,
        requestsPerSecond,
        // Discovery performance
        tradesPerMillisecond,
        discoveryTimeMs,
        // Efficiency
        timePerWallet,
        timePerNFT,
        timePerRequest
      };
    });
  }

  // Analyze speed scaling
  analyzeSpeedScaling() {
    const metrics = this.calculateSpeedMetrics();
    
    console.log('⚡ SYSTEM SPEED ANALYSIS');
    console.log('========================\n');
    
    // Main speed table
    console.log('📊 UPLOAD PERFORMANCE:');
    console.log('Scale | Total Time | Upload Time | Wallets/sec | NFTs/sec | Requests/sec | Time/Wallet');
    console.log('------|------------|-------------|-------------|----------|--------------|------------');
    
    metrics.forEach(point => {
      console.log(
        `${String(point.wallets).padStart(5)} | ` +
        `${this.formatTime(point.totalTime).padStart(9)} | ` +
        `${this.formatTime(point.uploadTime).padStart(10)} | ` +
        `${point.walletsPerSecond.toFixed(2).padStart(10)} | ` +
        `${point.nftsPerSecond.toFixed(1).padStart(7)} | ` +
        `${point.requestsPerSecond.toFixed(1).padStart(11)} | ` +
        `${point.timePerWallet.toFixed(2)}s`
      );
    });
    
    console.log('\n🚀 DISCOVERY PERFORMANCE:');
    console.log('Scale | Discovery Time | Trades Found | Trades/ms | Time per Trade');
    console.log('------|----------------|--------------|-----------|---------------');
    
    metrics.forEach(point => {
      const timePerTrade = point.discoveryTimeMs / point.tradesDiscovered;
      console.log(
        `${String(point.wallets).padStart(5)} | ` +
        `${point.discoveryTimeMs.toFixed(0).padStart(13)}ms | ` +
        `${String(point.tradesDiscovered).padStart(11)} | ` +
        `${point.tradesPerMillisecond.toFixed(3).padStart(8)} | ` +
        `${timePerTrade.toFixed(1)}ms`
      );
    });
    
    return metrics;
  }

  // Analyze speed degradation/improvement
  analyzeSpeedChanges() {
    const metrics = this.calculateSpeedMetrics();
    const changes = [];
    
    for (let i = 1; i < metrics.length; i++) {
      const prev = metrics[i - 1];
      const curr = metrics[i];
      
      changes.push({
        scaleChange: `${prev.wallets}→${curr.wallets}`,
        walletSpeedChange: curr.walletsPerSecond / prev.walletsPerSecond,
        nftSpeedChange: curr.nftsPerSecond / prev.nftsPerSecond,
        discoverySpeedChange: curr.discoveryTimeMs / prev.discoveryTimeMs,
        efficiencyChange: curr.timePerWallet / prev.timePerWallet,
        tradesFoundSpeedUp: (curr.tradesDiscovered / curr.discoveryTimeMs) / (prev.tradesDiscovered / prev.discoveryTimeMs)
      });
    }
    
    console.log('\n📈 SPEED SCALING FACTORS:');
    console.log('Scale Change | Upload Speed | NFT Speed | Discovery Time | Efficiency | Trade Discovery Speed');
    console.log('-------------|--------------|-----------|----------------|------------|---------------------');
    
    changes.forEach(change => {
      const uploadTrend = change.walletSpeedChange >= 1 ? '↗' : '↘';
      const nftTrend = change.nftSpeedChange >= 1 ? '↗' : '↘';
      const discoveryTrend = change.discoverySpeedChange >= 1 ? '↗' : '↘';
      const effTrend = change.efficiencyChange >= 1 ? '↘' : '↗'; // Lower time per wallet is better
      const tradeTrend = change.tradesFoundSpeedUp >= 1 ? '↗' : '↘';
      
      console.log(
        `${change.scaleChange.padStart(11)} | ` +
        `${change.walletSpeedChange.toFixed(2)}× ${uploadTrend.padStart(7)} | ` +
        `${change.nftSpeedChange.toFixed(2)}× ${nftTrend.padStart(6)} | ` +
        `${change.discoverySpeedChange.toFixed(2)}× ${discoveryTrend.padStart(11)} | ` +
        `${change.efficiencyChange.toFixed(2)}× ${effTrend.padStart(7)} | ` +
        `${change.tradesFoundSpeedUp.toFixed(1)}× ${tradeTrend}`
      );
    });
    
    return changes;
  }

  // Calculate bottlenecks and performance insights
  analyzeBottlenecks() {
    const metrics = this.calculateSpeedMetrics();
    
    console.log('\n🔍 PERFORMANCE BOTTLENECK ANALYSIS:');
    
    // Identify what's taking the most time
    metrics.forEach(point => {
      const uploadPercent = (point.uploadTime / point.totalTime) * 100;
      const discoveryPercent = (point.discoveryTime / point.totalTime) * 100;
      const overheadPercent = 100 - uploadPercent - discoveryPercent;
      
      console.log(`\n${point.wallets} wallets:`);
      console.log(`  Upload: ${this.formatTime(point.uploadTime)} (${uploadPercent.toFixed(1)}%)`);
      console.log(`  Discovery: ${point.discoveryTimeMs.toFixed(0)}ms (${discoveryPercent.toFixed(1)}%)`);
      console.log(`  Overhead: ${overheadPercent.toFixed(1)}%`);
      console.log(`  Bottleneck: ${uploadPercent > 95 ? '🔴 UPLOAD' : uploadPercent > 80 ? '🟡 UPLOAD' : '🟢 BALANCED'}`);
    });
    
    // Speed predictions
    console.log('\n🎯 SPEED PREDICTIONS:');
    const lastPoint = metrics[metrics.length - 1];
    
    // Predict upload times for larger scales
    [500, 1000, 2000].forEach(targetWallets => {
      const scaleFactor = targetWallets / lastPoint.wallets;
      // Upload time scales roughly linearly with complexity
      const predictedUploadTime = lastPoint.uploadTime * scaleFactor * 1.2; // 20% overhead for complexity
      const predictedDiscoveryTime = lastPoint.discoveryTimeMs * Math.pow(scaleFactor, 0.3); // Discovery scales sublinearly
      
      console.log(`${targetWallets} wallets:`);
      console.log(`  Predicted upload time: ${this.formatTime(predictedUploadTime)}`);
      console.log(`  Predicted discovery time: ${predictedDiscoveryTime.toFixed(0)}ms`);
      console.log(`  Predicted total time: ${this.formatTime(predictedUploadTime + predictedDiscoveryTime/1000)}`);
    });
  }

  // Format time for display
  formatTime(seconds) {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes}m${secs.toFixed(0)}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h${minutes}m`;
    }
  }

  // Generate speed summary
  generateSpeedReport() {
    console.log('⚡ COMPREHENSIVE SPEED ANALYSIS REPORT');
    console.log('======================================\n');
    
    const metrics = this.analyzeSpeedScaling();
    const changes = this.analyzeSpeedChanges();
    this.analyzeBottlenecks();
    
    // Key speed insights
    console.log('\n🏆 KEY SPEED INSIGHTS:');
    const firstPoint = metrics[0];
    const lastPoint = metrics[metrics.length - 1];
    
    const speedDegradation = lastPoint.walletsPerSecond / firstPoint.walletsPerSecond;
    const discoveryScaling = lastPoint.discoveryTimeMs / firstPoint.discoveryTimeMs;
    const overallEfficiency = (lastPoint.wallets / lastPoint.totalTime) / (firstPoint.wallets / firstPoint.totalTime);
    
    console.log(`• Upload speed change: ${speedDegradation.toFixed(2)}× (${speedDegradation < 1 ? 'SLOWER' : 'FASTER'} per wallet)`);
    console.log(`• Discovery time scaling: ${discoveryScaling.toFixed(2)}× (${discoveryScaling < 2 ? 'EXCELLENT' : 'MODERATE'} scaling)`);
    console.log(`• Overall efficiency: ${overallEfficiency.toFixed(2)}× (${overallEfficiency > 0.5 ? 'GOOD' : 'NEEDS OPTIMIZATION'})`);
    console.log(`• Bottleneck: ${lastPoint.uploadTime > lastPoint.discoveryTime * 1000 ? 'UPLOAD DOMINATED' : 'DISCOVERY DOMINATED'}`);
    
    if (discoveryScaling < 2) {
      console.log('✅ Discovery performance scales excellently with network size!');
    }
    
    if (speedDegradation > 0.1) {
      console.log('✅ Upload performance maintains reasonable speeds at scale!');
    }
    
    return { metrics, changes };
  }
}

// Execute analysis
if (require.main === module) {
  const analyzer = new SpeedAnalyzer(speedData);
  analyzer.generateSpeedReport();
}

module.exports = SpeedAnalyzer; 