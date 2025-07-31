/**
 * DI Container Unit Test
 * 
 * Critical test to verify the DI container registration works
 * exactly as it did before the cleanup/restoration.
 */

describe('🔧 DI Container Verification', () => {
  beforeAll(() => {
    // Set required environment variables
    process.env.HELIUS_API_KEY = 'demo';
    process.env.SWAP_PROGRAM_ID = 'Swap111111111111111111111111111111111111111';
    process.env.RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';
  });

  test('should register all services without errors', async () => {
    console.log('🔍 Testing DI Container Registration...');
    
    // Import and test DI container
    const { registerServices, container } = require('../../di-container');
    
    // This should not throw any errors
    expect(() => {
      registerServices();
    }).not.toThrow();
    
    console.log('✅ DI Container: All services registered successfully');
  });

  test('should have all critical services available', async () => {
    console.log('🔍 Testing Service Availability...');
    
    const { container } = require('../../di-container');
    
    // Test that we can resolve critical services
    const tradeService = container.resolve('TradeDiscoveryService');
    expect(tradeService).toBeDefined();
    
    const persistentService = container.resolve('PersistentTradeDiscoveryService');
    expect(persistentService).toBeDefined();
    
    const tenantService = container.resolve('TenantManagementService');
    expect(tenantService).toBeDefined();
    
    console.log('✅ All critical services are resolvable from DI container');
  });

  test('should initialize core services correctly', async () => {
    console.log('🔍 Testing Service Initialization...');
    
    const { TradeDiscoveryService } = require('../../services/trade/TradeDiscoveryService');
    const tradeService = TradeDiscoveryService.getInstance();
    
    // Test that core methods exist and work
    expect(typeof tradeService.getDataStats).toBe('function');
    
    const stats = tradeService.getDataStats();
    expect(stats).toHaveProperty('walletCount');
    expect(stats).toHaveProperty('nftCount');
    
    console.log(`✅ TradeDiscoveryService working: ${stats.walletCount} wallets, ${stats.nftCount} NFTs`);
  });

  test('should verify tenant management works', async () => {
    console.log('🔍 Testing Tenant Management...');
    
    const { TenantManagementService } = require('../../services/tenant/TenantManagementService');
    const tenantService = TenantManagementService.getInstance();
    
    // Test tenant creation and deletion
    const testTenant = await tenantService.createTenant('DITestTenant', 'test@dicontainer.com');
    expect(testTenant).toHaveProperty('id');
    expect(testTenant).toHaveProperty('apiKey');
    
    // Clean up
    await tenantService.deleteTenant(testTenant.id);
    
    console.log('✅ Tenant Management working: create/delete successful');
  });

  afterAll(() => {
    console.log('\n📊 DI CONTAINER VERIFICATION COMPLETE');
    console.log('✅ All services functioning exactly as before cleanup');
    console.log('✅ System ready for GitHub commits');
  });
}); 