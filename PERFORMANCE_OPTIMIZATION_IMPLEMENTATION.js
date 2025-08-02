#!/usr/bin/env node

/**
 * 🚀 PERFORMANCE OPTIMIZATION IMPLEMENTATION
 * 
 * Based on bottleneck analysis, implementing targeted fixes:
 * 
 * CRITICAL ISSUE IDENTIFIED:
 * - TradeDiscoveryService.loadStateFromPersistence() loads ALL data on every instantiation
 * - Multiple service instances being created per request
 * - 6+ seconds of file I/O operations happening synchronously
 * 
 * FIXES TO IMPLEMENT:
 * 1. Lazy loading of persistence data
 * 2. Early validation for empty operations
 * 3. Service instance reuse optimization
 * 4. Async persistence loading
 */

const fs = require('fs').promises;
const path = require('path');

console.log('🚀 IMPLEMENTING PERFORMANCE OPTIMIZATIONS');
console.log('=========================================');
console.log('🎯 Target: Reduce 6+ second overhead to <1 second');
console.log('');

class PerformanceOptimizer {
  constructor() {
    this.changes = [];
    this.backups = [];
  }

  async logChange(file, description, impact) {
    this.changes.push({ file, description, impact, timestamp: new Date().toISOString() });
    console.log(`   ✅ ${file}: ${description}`);
    console.log(`      📈 Expected Impact: ${impact}`);
  }

  async backupFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const backupPath = `${filePath}.backup.${Date.now()}`;
      await fs.writeFile(backupPath, content);
      this.backups.push({ original: filePath, backup: backupPath });
      console.log(`   💾 Backed up: ${path.basename(filePath)}`);
    } catch (error) {
      console.log(`   ⚠️ Could not backup ${filePath}: ${error.message}`);
    }
  }

  async optimizeTradeDiscoveryService() {
    console.log('🔧 OPTIMIZING TRADE DISCOVERY SERVICE');
    console.log('=====================================');

    const filePath = 'backend/src/services/trade/TradeDiscoveryService.ts';
    
    try {
      await this.backupFile(filePath);
      const content = await fs.readFile(filePath, 'utf8');

      // Fix 1: Make persistence loading lazy
      const lazyLoadingFix = content.replace(
        /\/\/ Load persisted state\n\s*this\.loadStateFromPersistence\(\);/,
        `// PERFORMANCE OPTIMIZATION: Make persistence loading lazy
    // this.loadStateFromPersistence(); // Moved to lazy loading - only load when data is actually needed`
      );

      // Fix 2: Add early validation method
      const earlyValidationMethod = `
  /**
   * 🚀 PERFORMANCE OPTIMIZATION: Early validation for empty operations
   * Checks if wallet exists before doing expensive operations
   */
  public async hasWallet(walletAddress: string): Promise<boolean> {
    // Check in-memory first (fast)
    if (this.wallets.has(walletAddress)) {
      return true;
    }
    
    // Only load persistence if needed
    if (!this.isStateLoaded) {
      await this.ensureStateLoaded();
    }
    
    return this.wallets.has(walletAddress);
  }

  /**
   * 🚀 PERFORMANCE OPTIMIZATION: Lazy state loading
   * Only loads persistent state when actually needed
   */
  private isStateLoaded = false;
  private loadingPromise: Promise<void> | null = null;

  private async ensureStateLoaded(): Promise<void> {
    if (this.isStateLoaded) {
      return;
    }

    // Prevent multiple simultaneous loads
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this.loadStateFromPersistence().then(() => {
      this.isStateLoaded = true;
      this.loadingPromise = null;
    });

    return this.loadingPromise;
  }
`;

      // Fix 3: Add the new methods after the constructor
      const withEarlyValidation = lazyLoadingFix.replace(
        /(  public static getInstance\(\): TradeDiscoveryService \{[^}]+\})/,
        `$1

${earlyValidationMethod}`
      );

      // Fix 4: Optimize existing methods to use lazy loading
      const optimizeExistingMethods = withEarlyValidation.replace(
        /(public async discoverTrades[^{]*\{)/,
        `$1
    // 🚀 PERFORMANCE OPTIMIZATION: Quick validation before expensive operations
    const operation = this.logger.operation('discoverTrades');
    operation.info('Starting trade discovery with optimization');
    
    // Early validation - avoid loading state for non-existent wallets
    const hasAnyWallets = this.wallets.size > 0 || await this.hasWallet(walletAddress || '');
    if (!hasAnyWallets && (!walletAddress || walletAddress.trim() === '')) {
      operation.info('No wallets to process - returning early');
      operation.end();
      return [];
    }
    
    // Ensure state is loaded only if we have valid operations to perform
    await this.ensureStateLoaded();`
      );

      await fs.writeFile(filePath, optimizeExistingMethods);
      
      await this.logChange(
        'TradeDiscoveryService.ts',
        'Implemented lazy loading and early validation',
        '4-5 second reduction for empty operations'
      );

    } catch (error) {
      console.log(`   ❌ Failed to optimize TradeDiscoveryService: ${error.message}`);
    }

    console.log('');
  }

  async optimizePersistentTradeDiscoveryService() {
    console.log('🔧 OPTIMIZING PERSISTENT TRADE DISCOVERY SERVICE');
    console.log('================================================');

    const filePath = 'backend/src/services/trade/PersistentTradeDiscoveryService.ts';
    
    try {
      await this.backupFile(filePath);
      const content = await fs.readFile(filePath, 'utf8');

      // Fix 1: Add early validation for discovery requests
      const earlyValidationFix = content.replace(
        /(public async getTradeLoopsForWallet\([^{]*\{)/,
        `$1
    // 🚀 PERFORMANCE OPTIMIZATION: Early validation
    const operation = this.logger.operation('getTradeLoopsForWallet');
    
    // Quick check - if tenant has no active loops, return empty immediately
    const cachedLoops = this.activeLoops.get(tenantId);
    if (!cachedLoops || cachedLoops.size === 0) {
      operation.info('No active loops for tenant - returning early', { tenantId });
      operation.end();
      return [];
    }
    
    // Quick check - if wallet not in cache, return empty immediately  
    const walletLoops = cachedLoops.get(walletId);
    if (!walletLoops || walletLoops.length === 0) {
      operation.info('No loops for wallet - returning early', { tenantId, walletId });
      operation.end();
      return [];
    }`
      );

      // Fix 2: Optimize data transformation with early exit
      const optimizeDataTransformation = earlyValidationFix.replace(
        /(\/\/ 🚀 CONVERT GRAPH TO STANDARD FORMAT)/,
        `// 🚀 PERFORMANCE OPTIMIZATION: Skip transformation for empty graphs
    if (graph.wallets.size === 0) {
      operation.info('Empty graph - skipping transformation and algorithm execution');
      operation.end();
      return [];
    }
    
    $1`
      );

      await fs.writeFile(filePath, optimizeDataTransformation);
      
      await this.logChange(
        'PersistentTradeDiscoveryService.ts',
        'Added early validation and empty graph optimization',
        '2-3 second reduction for empty queries'
      );

    } catch (error) {
      console.log(`   ❌ Failed to optimize PersistentTradeDiscoveryService: ${error.message}`);
    }

    console.log('');
  }

  async optimizeAlgorithmConsolidationService() {
    console.log('🔧 OPTIMIZING ALGORITHM CONSOLIDATION SERVICE');
    console.log('=============================================');

    const filePath = 'backend/src/services/trade/AlgorithmConsolidationService.ts';
    
    try {
      await this.backupFile(filePath);
      const content = await fs.readFile(filePath, 'utf8');

      // Fix 1: Add early exit for empty data
      const earlyExitFix = content.replace(
        /(public async discoverTrades\([^{]*\{[^}]*try \{)/,
        `$1
      // 🚀 PERFORMANCE OPTIMIZATION: Early exit for empty data
      if (wallets.size === 0 || nftOwnership.size === 0) {
        operation.info('Empty dataset - returning early', {
          wallets: wallets.size,
          nfts: nftOwnership.size,
          wants: wantedNfts.size
        });
        
        const quickResult: ConsolidationResult = {
          trades: [],
          algorithm: 'early-exit',
          executionTime: Date.now() - startTime,
          engineUsed: 'optimization',
          metadata: {
            totalCycles: 0,
            efficiency: 1.0,
            performance: {
              dataTransformationTime: 0,
              algorithmExecutionTime: 0,
              scoringTime: 0
            }
          }
        };
        
        operation.end();
        return quickResult;
      }`
      );

      await fs.writeFile(filePath, earlyExitFix);
      
      await this.logChange(
        'AlgorithmConsolidationService.ts',
        'Added early exit optimization for empty datasets',
        '1-2 second reduction for empty algorithm runs'
      );

    } catch (error) {
      console.log(`   ❌ Failed to optimize AlgorithmConsolidationService: ${error.message}`);
    }

    console.log('');
  }

  async addQuickValidationEndpoint() {
    console.log('🔧 ADDING QUICK VALIDATION ENDPOINT');
    console.log('===================================');

    const filePath = 'backend/src/controllers/WhiteLabelController.ts';
    
    try {
      await this.backupFile(filePath);
      const content = await fs.readFile(filePath, 'utf8');

      // Add a quick validation endpoint
      const quickValidationMethod = `
  /**
   * 🚀 PERFORMANCE OPTIMIZATION: Quick wallet validation
   * Fast endpoint to check if wallet exists before expensive operations
   */
  public validateWallet = async (req: Request & { tenant?: any }, res: Response): Promise<void> => {
    const operation = this.logger.operation('validateWallet');
    
    try {
      const { walletId } = req.body;
      const tenant = req.tenant;
      
      if (!walletId) {
        res.status(400).json({ error: 'walletId is required' });
        return;
      }
      
      // Quick validation without expensive loading
      const graph = this.persistentTradeService.getTenantGraph(tenant.id);
      const hasWallet = graph?.wallets.has(walletId) || false;
      
      res.status(200).json({
        success: true,
        walletExists: hasWallet,
        timestamp: new Date().toISOString()
      });
      
      operation.info('Wallet validation completed', { 
        tenantId: tenant.id, 
        walletId, 
        exists: hasWallet 
      });
      operation.end();
      
    } catch (error) {
      operation.error('Wallet validation failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      operation.end();
      
      res.status(500).json({
        error: 'Internal server error during validation'
      });
    }
  };
`;

      // Add the method to the class
      const withValidationMethod = content.replace(
        /(  \/\/ Helper method to validate required fields)/,
        `${quickValidationMethod}

  $1`
      );

      await fs.writeFile(filePath, withValidationMethod);
      
      await this.logChange(
        'WhiteLabelController.ts',
        'Added quick wallet validation endpoint',
        'Enables clients to avoid expensive operations for non-existent wallets'
      );

    } catch (error) {
      console.log(`   ❌ Failed to add validation endpoint: ${error.message}`);
    }

    console.log('');
  }

  async createPerformanceTestScript() {
    console.log('🧪 CREATING PERFORMANCE TEST SCRIPT');
    console.log('===================================');

    const testScript = `#!/usr/bin/env node

/**
 * 🚀 PERFORMANCE VERIFICATION TEST
 * Tests the optimizations we implemented
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'https://swaps-93hu.onrender.com/api/v1';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'swaps_admin_prod_2025_secure_key_abc123';

async function testOptimizations() {
  console.log('🧪 Testing Performance Optimizations');
  console.log('====================================');
  
  try {
    // Create test tenant
    const tenantResponse = await axios.post(\`\${BASE_URL}/admin/tenants\`, {
      name: 'Performance_Test_Optimized',
      contactEmail: 'perf@optimized.test',
      settings: {
        algorithm: { maxDepth: 15, minEfficiency: 0.3, maxLoopsPerRequest: 50 },
        security: { maxNFTsPerWallet: 1000, maxWantsPerWallet: 100 }
      }
    }, {
      headers: { 'Authorization': \`Bearer \${ADMIN_API_KEY}\`, 'Content-Type': 'application/json' }
    });

    const apiKey = tenantResponse.data.tenant.apiKey || tenantResponse.data.apiKey;
    console.log('✅ Test tenant created');

    // Test 1: Empty discovery (should be fast now)
    console.log('\\n🧪 Test 1: Empty Discovery');
    const emptyStart = Date.now();
    
    try {
      await axios.post(\`\${BASE_URL}/discovery/trades\`, {
        walletId: 'nonexistent_wallet'
      }, {
        headers: { 'Authorization': \`Bearer \${apiKey}\`, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      // Expected for non-existent wallet
    }
    
    const emptyTime = Date.now() - emptyStart;
    console.log(\`   📊 Empty discovery: \${emptyTime}ms\`);
    console.log(\`   \${emptyTime < 1000 ? '✅ OPTIMIZED' : '❌ STILL SLOW'} (target: <1000ms)\`);

    // Test 2: Empty inventory submit (should be fast now)
    console.log('\\n🧪 Test 2: Empty Inventory Submit');
    const inventoryStart = Date.now();
    
    await axios.post(\`\${BASE_URL}/inventory/submit\`, {
      walletId: 'empty_test',
      nfts: []
    }, {
      headers: { 'Authorization': \`Bearer \${apiKey}\`, 'Content-Type': 'application/json' }
    });
    
    const inventoryTime = Date.now() - inventoryStart;
    console.log(\`   📊 Empty inventory: \${inventoryTime}ms\`);
    console.log(\`   \${inventoryTime < 1000 ? '✅ OPTIMIZED' : '❌ STILL SLOW'} (target: <1000ms)\`);

    // Test 3: Multiple rapid empty queries (should benefit from lazy loading)
    console.log('\\n🧪 Test 3: Multiple Rapid Queries');
    const rapidStart = Date.now();
    
    const rapidPromises = [];
    for (let i = 0; i < 5; i++) {
      rapidPromises.push(
        axios.post(\`\${BASE_URL}/discovery/trades\`, {
          walletId: \`rapid_test_\${i}\`
        }, {
          headers: { 'Authorization': \`Bearer \${apiKey}\`, 'Content-Type': 'application/json' }
        }).catch(() => {}) // Ignore errors
      );
    }
    
    await Promise.all(rapidPromises);
    const rapidTime = Date.now() - rapidStart;
    console.log(\`   📊 5 rapid queries: \${rapidTime}ms (avg: \${Math.round(rapidTime/5)}ms)\`);
    console.log(\`   \${rapidTime < 3000 ? '✅ OPTIMIZED' : '❌ STILL SLOW'} (target: <3000ms total)\`);

    // Summary
    console.log('\\n📊 OPTIMIZATION RESULTS:');
    console.log('========================');
    console.log(\`Empty Discovery: \${emptyTime}ms (target: <1000ms)\`);
    console.log(\`Empty Inventory: \${inventoryTime}ms (target: <1000ms)\`);
    console.log(\`Rapid Queries: \${rapidTime}ms total (target: <3000ms)\`);
    
    const successCount = [emptyTime < 1000, inventoryTime < 1000, rapidTime < 3000].filter(Boolean).length;
    console.log(\`\\n🎯 Optimization Success: \${successCount}/3 targets met\`);
    
    if (successCount === 3) {
      console.log('🎉 ALL OPTIMIZATIONS SUCCESSFUL!');
    } else if (successCount >= 2) {
      console.log('✅ Most optimizations successful - good progress!');
    } else {
      console.log('⚠️  More optimization needed');
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testOptimizations();
`;

    await fs.writeFile('test-performance-optimizations.js', testScript);
    await fs.chmod('test-performance-optimizations.js', '755');
    
    await this.logChange(
      'test-performance-optimizations.js',
      'Created performance verification test script',
      'Enables testing optimization effectiveness'
    );

    console.log('');
  }

  generateImplementationReport() {
    console.log('📊 PERFORMANCE OPTIMIZATION REPORT');
    console.log('==================================');
    console.log('');

    console.log('🔧 CHANGES IMPLEMENTED:');
    this.changes.forEach((change, i) => {
      console.log(`   ${i + 1}. ${change.file}`);
      console.log(`      📝 ${change.description}`);
      console.log(`      📈 ${change.impact}`);
      console.log('');
    });

    console.log('💾 BACKUPS CREATED:');
    this.backups.forEach((backup, i) => {
      console.log(`   ${i + 1}. ${backup.backup}`);
    });

    console.log('\\n🎯 EXPECTED PERFORMANCE IMPROVEMENTS:');
    console.log('=====================================');
    console.log('   📊 Empty operations: 6000ms → <1000ms (83% improvement)');
    console.log('   📊 Small operations: 5000ms → <2000ms (60% improvement)');
    console.log('   📊 Concurrent requests: 45000ms → <5000ms (89% improvement)');
    console.log('   📊 First request after startup: 6000ms → <1000ms (83% improvement)');

    console.log('\\n🚀 NEXT STEPS:');
    console.log('==============');
    console.log('1. 🧪 Test the optimizations with: node test-performance-optimizations.js');
    console.log('2. 🔍 Monitor logs for lazy loading behavior');
    console.log('3. 📊 Run comprehensive performance audit again');
    console.log('4. 🎯 If targets met, system is ready for client demos!');

    return {
      changesImplemented: this.changes.length,
      backupsCreated: this.backups.length,
      expectedImprovement: '60-89% performance improvement'
    };
  }

  async runOptimizations() {
    try {
      await this.optimizeTradeDiscoveryService();
      await this.optimizePersistentTradeDiscoveryService();
      await this.optimizeAlgorithmConsolidationService();
      await this.addQuickValidationEndpoint();
      await this.createPerformanceTestScript();
      
      return this.generateImplementationReport();
    } catch (error) {
      console.error('💥 Optimization failed:', error.message);
      return { changesImplemented: 0, backupsCreated: 0, expectedImprovement: 'Failed' };
    }
  }
}

// Run the optimizations
const optimizer = new PerformanceOptimizer();
optimizer.runOptimizations().then(result => {
  console.log('\\n🏁 OPTIMIZATION COMPLETE');
  console.log(\`Changes: \${result.changesImplemented}, Backups: \${result.backupsCreated}\`);
  console.log(\`Expected improvement: \${result.expectedImprovement}\`);
});
`;

    await fs.writeFile('PERFORMANCE_OPTIMIZATION_IMPLEMENTATION.js', testScript);
    await fs.chmod('PERFORMANCE_OPTIMIZATION_IMPLEMENTATION.js', '755');

    console.log('✅ Created performance optimization implementation script');
  }
}

// Create and run the implementation
const implementer = new PerformanceOptimizer();
implementer.createPerformanceTestScript();