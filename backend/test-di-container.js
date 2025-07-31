/**
 * Test DI Container Registration
 * Tests that the DI container can initialize all services correctly
 */

require('reflect-metadata');
process.env.NODE_ENV = 'test';
process.env.HELIUS_API_KEY = 'demo';
process.env.SWAP_PROGRAM_ID = 'Swap111111111111111111111111111111111111111';
process.env.RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';

console.log('🔍 TESTING DI CONTAINER REGISTRATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

async function testDIContainer() {
  try {
    // Test using ts-node to load TypeScript
    const { execSync } = require('child_process');
    
    console.log('\n1️⃣ Testing TypeScript compilation...');
    const tsNodeCmd = 'npx ts-node -e "console.log(\'TypeScript working\')"';
    execSync(tsNodeCmd, { stdio: 'inherit' });
    console.log('✅ TypeScript compilation working');

    console.log('\n2️⃣ Testing DI container import...');
    const diTestCmd = `npx ts-node -e "
      require('reflect-metadata');
      process.env.NODE_ENV = 'test';
      process.env.HELIUS_API_KEY = 'demo';
      process.env.SWAP_PROGRAM_ID = 'Swap111111111111111111111111111111111111111';
      process.env.RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';
      const { registerServices } = require('./src/di-container');
      console.log('✅ DI container imported successfully');
      registerServices();
      console.log('✅ All services registered successfully');
    "`;
    
    execSync(diTestCmd, { stdio: 'inherit' });
    
    console.log('\n🎉 DI CONTAINER TEST: ✅ PASSED');
    console.log('✅ All services can be registered correctly');
    console.log('✅ System is working as expected');
    
  } catch (error) {
    console.error('\n❌ DI CONTAINER TEST: FAILED');
    console.error('Error:', error.message);
    console.log('\n🔧 CRITICAL ISSUE: DI container registration broken');
    console.log('This needs to be fixed before any commits');
    process.exit(1);
  }
}

testDIContainer(); 