// Jest setup for SWAPS White Label API tests
require('reflect-metadata');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.PORT = '3001';

// Set required API keys and configuration
if (!process.env.HELIUS_API_KEY) {
  process.env.HELIUS_API_KEY = 'demo_test_key';
}

if (!process.env.SWAP_PROGRAM_ID) {
  process.env.SWAP_PROGRAM_ID = 'Swap111111111111111111111111111111111111111';
}

if (!process.env.RPC_ENDPOINT) {
  process.env.RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';
}

// Set persistence configuration
process.env.ENABLE_PERSISTENCE = 'true';
process.env.DATA_DIR = './data';

// Disable background services during tests
process.env.ENABLE_BACKGROUND_TRADE_DISCOVERY = 'false';

console.log('[Test Setup] SWAPS White Label test environment initialized'); 