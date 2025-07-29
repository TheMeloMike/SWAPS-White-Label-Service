// Setup environment variables for tests
process.env.ENABLE_PERSISTENCE = 'true';
process.env.DATA_DIR = './tests/data';
process.env.NODE_ENV = 'test';

// Create a mock for any required API keys
if (!process.env.HELIUS_API_KEY) {
  process.env.HELIUS_API_KEY = 'test_api_key_for_tests';
}

// Log test environment
console.log('Test environment variables set up:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- ENABLE_PERSISTENCE:', process.env.ENABLE_PERSISTENCE);
console.log('- DATA_DIR:', process.env.DATA_DIR);
console.log('- HELIUS_API_KEY:', 'REDACTED'); 