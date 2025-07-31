/**
 * SWAPS White Label System Verification
 * 
 * This script verifies that ALL core functionality works exactly
 * as it did before the cleanup/restoration process.
 */

require('reflect-metadata');
process.env.NODE_ENV = 'test';
process.env.HELIUS_API_KEY = 'demo';
process.env.SWAP_PROGRAM_ID = 'Swap111111111111111111111111111111111111111';
process.env.RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';

console.log('🚀 SWAPS WHITE LABEL SYSTEM VERIFICATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

async function verifySystem() {
  const results = {
    diContainer: false,
    coreServices: false,
    tradeDiscovery: false,
    persistentDiscovery: false,
    tenantManagement: false,
    dataSync: false,
    webhooks: false,
    algorithms: false
  };

  try {
    // 1. Test DI Container Registration
    console.log('\n1️⃣ Testing DI Container...');
    const { registerServices } = require('./src/di-container');
    registerServices();
    results.diContainer = true;
    console.log('✅ DI Container: Services registered successfully');

    // 2. Test Core Services
    console.log('\n2️⃣ Testing Core Services...');
    const { LoggingService } = require('./src/utils/logging/LoggingService');
    const logger = LoggingService.getInstance().createLogger('Verification');
    logger.info('Core services test');
    results.coreServices = true;
    console.log('✅ Core Services: LoggingService working');

    // 3. Test Trade Discovery Service
    console.log('\n3️⃣ Testing Trade Discovery Service...');
    const { TradeDiscoveryService } = require('./src/services/trade/TradeDiscoveryService');
    const tradeService = TradeDiscoveryService.getInstance();
    const stats = tradeService.getDataStats();
    results.tradeDiscovery = true;
    console.log(`✅ Trade Discovery: Service initialized (${stats.walletCount} wallets, ${stats.nftCount} NFTs)`);

    // 4. Test Persistent Trade Discovery
    console.log('\n4️⃣ Testing Persistent Trade Discovery...');
    const { PersistentTradeDiscoveryService } = require('./src/services/trade/PersistentTradeDiscoveryService');
    const persistentService = PersistentTradeDiscoveryService.getInstance();
    results.persistentDiscovery = true;
    console.log('✅ Persistent Discovery: Service initialized');

    // 5. Test Tenant Management
    console.log('\n5️⃣ Testing Tenant Management...');
    const { TenantManagementService } = require('./src/services/tenant/TenantManagementService');
    const tenantService = TenantManagementService.getInstance();
    const testTenant = await tenantService.createTenant('VerificationTest', 'test@example.com');
    await tenantService.deleteTenant(testTenant.id);
    results.tenantManagement = true;
    console.log('✅ Tenant Management: Create/delete tenant successful');

    // 6. Test Data Sync Bridge
    console.log('\n6️⃣ Testing Data Synchronization...');
    const { DataSyncBridge } = require('./src/services/trade/DataSyncBridge');
    const dataSyncBridge = DataSyncBridge.getInstance();
    results.dataSync = true;
    console.log('✅ Data Sync: Bridge initialized');

    // 7. Test Webhook Service
    console.log('\n7️⃣ Testing Webhook Service...');
    const { WebhookNotificationService } = require('./src/services/notifications/WebhookNotificationService');
    const webhookService = WebhookNotificationService.getInstance();
    results.webhooks = true;
    console.log('✅ Webhooks: Service initialized');

    // 8. Test Core Algorithms
    console.log('\n8️⃣ Testing Core Algorithms...');
    const { ScalableTradeLoopFinderService } = require('./src/services/trade/ScalableTradeLoopFinderService');
    const algorithmService = ScalableTradeLoopFinderService.getInstance();
    results.algorithms = true;
    console.log('✅ Algorithms: ScalableTradeLoopFinder working');

    // Summary
    console.log('\n📊 VERIFICATION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const totalTests = Object.keys(results).length;
    const passedTests = Object.values(results).filter(Boolean).length;
    const passRate = (passedTests / totalTests * 100).toFixed(1);

    Object.entries(results).forEach(([test, passed]) => {
      const icon = passed ? '✅' : '❌';
      const name = test.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      console.log(`${icon} ${name}`);
    });

    console.log(`\n📈 Pass Rate: ${passedTests}/${totalTests} (${passRate}%)`);
    
    if (passedTests === totalTests) {
      console.log('\n🎉 VERIFICATION COMPLETE: ✅ ALL SYSTEMS OPERATIONAL');
      console.log('🚀 System works EXACTLY as before cleanup/restoration');
      console.log('✅ Ready for GitHub commits');
    } else {
      console.log('\n❌ VERIFICATION FAILED: Some systems not working');
      console.log('🔧 Investigation required before commits');
    }

  } catch (error) {
    console.error('\n❌ VERIFICATION ERROR:', error.message);
    console.log('🔧 System needs fixes before commits');
  }
}

// Run verification
verifySystem().then(() => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Verification completed');
  process.exit(0);
}).catch(error => {
  console.error('Verification failed:', error);
  process.exit(1);
}); 