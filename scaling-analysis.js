#!/usr/bin/env node

/**
 * SCALING ANALYSIS: TRADE DISCOVERY RATES
 * Analyzes how trade discovery scales with network size
 * Calculates discovery rates, efficiency metrics, and scaling patterns
 */

// Data from our incremental scaling tests
const scalingData = [
  {
    wallets: 50,
    nfts: 190,
    wants: 122,
    tradesDiscovered: 5,
    guaranteedTrades: 5,
    uploadTime: 19.8, // seconds
    discoveryTime: 86, // milliseconds
    apiSuccessRate: 100.0
  },
  {
    wallets: 100,
    nfts: 403,
    wants: 282,
    tradesDiscovered: 6,
    guaranteedTrades: 5,
    uploadTime: 135.8,
    discoveryTime: 82,
    apiSuccessRate: 100.0
  },
  {
    wallets: 250,
    nfts: 1064,
    wants: 724,
    tradesDiscovered: 64,
    guaranteedTrades: 5,
    uploadTime: 1142.2,
    discoveryTime: 135,
    apiSuccessRate: 100.0
  }
];

class ScalingAnalyzer {
  constructor(data) {
    this.data = data;
  }

  // Calculate discovery rate metrics
  calculateDiscoveryRates() {
    return this.data.map(point => {
      const detectionRate = (point.tradesDiscovered / point.guaranteedTrades) * 100;
      const tradesPerWallet = point.tradesDiscovered / point.wallets;
      const tradesPerNFT = point.tradesDiscovered / point.nfts;
      const tradesPerWant = point.tradesDiscovered / point.wants;
      const networkDensity = (point.wants / point.nfts) * 100;
      
      return {
        ...point,
        detectionRate,
        tradesPerWallet,
        tradesPerNFT,
        tradesPerWant,
        networkDensity
      };
    });
  }

  // Calculate scaling factors between data points
  calculateScalingFactors() {
    const rates = this.calculateDiscoveryRates();
    const factors = [];
    
    for (let i = 1; i < rates.length; i++) {
      const prev = rates[i - 1];
      const curr = rates[i];
      
      factors.push({
        fromWallets: prev.wallets,
        toWallets: curr.wallets,
        walletMultiplier: curr.wallets / prev.wallets,
        tradesMultiplier: curr.tradesDiscovered / prev.tradesDiscovered,
        efficiencyChange: (curr.tradesPerWallet / prev.tradesPerWallet),
        discoveryTimeChange: curr.discoveryTime / prev.discoveryTime,
        networkDensityChange: curr.networkDensity / prev.networkDensity
      });
    }
    
    return factors;
  }

  // Analyze the scaling pattern
  analyzeScalingPattern() {
    const rates = this.calculateDiscoveryRates();
    const factors = this.calculateScalingFactors();
    
    console.log('📊 TRADE DISCOVERY SCALING ANALYSIS');
    console.log('=====================================\n');
    
    // Basic metrics table
    console.log('📈 DISCOVERY RATES BY SCALE:');
    console.log('Wallets | NFTs | Wants | Trades | Detection% | Trades/Wallet | Network Density%');
    console.log('--------|------|-------|--------|------------|---------------|----------------');
    
    rates.forEach(point => {
      console.log(
        `${String(point.wallets).padStart(7)} | ` +
        `${String(point.nfts).padStart(4)} | ` +
        `${String(point.wants).padStart(5)} | ` +
        `${String(point.tradesDiscovered).padStart(6)} | ` +
        `${point.detectionRate.toFixed(1).padStart(9)}% | ` +
        `${point.tradesPerWallet.toFixed(3).padStart(12)} | ` +
        `${point.networkDensity.toFixed(1).padStart(13)}%`
      );
    });
    
    console.log('\n🚀 SCALING FACTORS:');
    console.log('Scale Change | Wallet×  | Trades× | Efficiency Change | Discovery Time');
    console.log('-------------|----------|---------|-------------------|---------------');
    
    factors.forEach(factor => {
      const effChange = factor.efficiencyChange >= 1 ? '↗' : '↘';
      const timeChange = factor.discoveryTimeChange >= 1 ? '↗' : '↘';
      
      console.log(
        `${factor.fromWallets}→${factor.toWallets}      | ` +
        `${factor.walletMultiplier.toFixed(1).padStart(7)}× | ` +
        `${factor.tradesMultiplier.toFixed(1).padStart(6)}× | ` +
        `${factor.efficiencyChange.toFixed(2).padStart(8)}× ${effChange.padStart(8)} | ` +
        `${factor.discoveryTimeChange.toFixed(2)}× ${timeChange}`
      );
    });
    
    return { rates, factors };
  }

  // Predict scaling behavior
  predictScaling(targetWallets) {
    const rates = this.calculateDiscoveryRates();
    const lastPoint = rates[rates.length - 1];
    
    // Calculate growth patterns
    const walletGrowthFactors = [];
    const tradeGrowthFactors = [];
    
    for (let i = 1; i < rates.length; i++) {
      const walletGrowth = rates[i].wallets / rates[i - 1].wallets;
      const tradeGrowth = rates[i].tradesDiscovered / rates[i - 1].tradesDiscovered;
      walletGrowthFactors.push(walletGrowth);
      tradeGrowthFactors.push(tradeGrowth);
    }
    
    // Average growth patterns
    const avgWalletGrowth = walletGrowthFactors.reduce((a, b) => a + b) / walletGrowthFactors.length;
    const avgTradeGrowth = tradeGrowthFactors.reduce((a, b) => a + b) / tradeGrowthFactors.length;
    
    // Predict for target
    const walletScaleFactor = targetWallets / lastPoint.wallets;
    
    // Use observed exponential pattern (trades grow faster than wallets)
    const predictedTrades = Math.round(lastPoint.tradesDiscovered * Math.pow(walletScaleFactor, 1.5));
    const predictedTradesPerWallet = predictedTrades / targetWallets;
    
    console.log('\n🔮 SCALING PREDICTION:');
    console.log(`Target scale: ${targetWallets} wallets`);
    console.log(`Scale factor: ${walletScaleFactor.toFixed(1)}× from current ${lastPoint.wallets} wallets`);
    console.log(`Predicted trades: ~${predictedTrades}`);
    console.log(`Predicted trades per wallet: ${predictedTradesPerWallet.toFixed(3)}`);
    console.log(`Predicted detection rate: ${((predictedTrades / 5) * 100).toFixed(0)}%`);
    
    return {
      targetWallets,
      predictedTrades,
      predictedTradesPerWallet,
      scaleFactor: walletScaleFactor
    };
  }

  // Analyze performance characteristics
  analyzePerformance() {
    const rates = this.calculateDiscoveryRates();
    
    console.log('\n⚡ PERFORMANCE ANALYSIS:');
    console.log('Scale | Upload Time | Discovery Time | API Success | Throughput');
    console.log('------|-------------|----------------|-------------|------------');
    
    rates.forEach(point => {
      const throughput = point.wallets / (point.uploadTime / 60); // wallets per minute
      console.log(
        `${String(point.wallets).padStart(5)} | ` +
        `${(point.uploadTime / 60).toFixed(1).padStart(10)}min | ` +
        `${String(point.discoveryTime).padStart(13)}ms | ` +
        `${point.apiSuccessRate.toFixed(1).padStart(10)}% | ` +
        `${throughput.toFixed(1)} w/min`
      );
    });
    
    // Key insights
    console.log('\n🧠 KEY INSIGHTS:');
    
    const firstPoint = rates[0];
    const lastPoint = rates[rates.length - 1];
    
    const walletScale = lastPoint.wallets / firstPoint.wallets;
    const tradeScale = lastPoint.tradesDiscovered / firstPoint.tradesDiscovered;
    const efficiencyChange = (lastPoint.tradesPerWallet / firstPoint.tradesPerWallet);
    
    console.log(`• Wallet scale: ${walletScale}× (${firstPoint.wallets} → ${lastPoint.wallets})`);
    console.log(`• Trade scale: ${tradeScale}× (${firstPoint.tradesDiscovered} → ${lastPoint.tradesDiscovered})`);
    console.log(`• Scaling efficiency: ${efficiencyChange.toFixed(2)}× (trades grow ${tradeScale > walletScale ? 'FASTER' : 'slower'} than wallets)`);
    console.log(`• Discovery time: ${lastPoint.discoveryTime / firstPoint.discoveryTime}× (${firstPoint.discoveryTime}ms → ${lastPoint.discoveryTime}ms)`);
    console.log(`• Network effect: ${tradeScale > walletScale ? '✅ STRONG' : '❌ WEAK'} (exponential trade growth)`);
    
    if (tradeScale > walletScale * 1.5) {
      console.log('🚀 EXPONENTIAL SCALING DETECTED: Canonical engine exhibits superlinear growth!');
    } else if (tradeScale > walletScale) {
      console.log('📈 POSITIVE SCALING: Trade discovery grows faster than network size');
    } else {
      console.log('📉 SUBLINEAR SCALING: Trade growth slower than network growth');
    }
  }

  // Generate full report
  generateReport() {
    const analysis = this.analyzeScalingPattern();
    this.analyzePerformance();
    
    // Predictions for next scales
    console.log('\n🎯 SCALING PREDICTIONS:');
    [500, 1000, 2000].forEach(target => {
      this.predictScaling(target);
      console.log('');
    });
    
    return analysis;
  }
}

// Execute analysis
if (require.main === module) {
  const analyzer = new ScalingAnalyzer(scalingData);
  analyzer.generateReport();
}

module.exports = ScalingAnalyzer; 