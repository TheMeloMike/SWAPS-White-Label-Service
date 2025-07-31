const { generateMassiveScaleScenario } = require('./massive-scale-generator.js');

// Modify config for smaller test
const originalConfig = require('./massive-scale-generator.js').CONFIG;
const testConfig = {
  ...originalConfig,
  TOTAL_WALLETS: 50,
  WALLETS_PER_COLLECTION: 5,
  COLLECTIONS: originalConfig.COLLECTIONS.slice(0, 2) // Just 2 collections
};

// Override the config
require('./massive-scale-generator.js').CONFIG.TOTAL_WALLETS = 50;
require('./massive-scale-generator.js').CONFIG.WALLETS_PER_COLLECTION = 5;
require('./massive-scale-generator.js').CONFIG.COLLECTIONS = originalConfig.COLLECTIONS.slice(0, 2);

console.log('🧪 SMALL SCALE TEST: 10 wallets (5 per collection)');
const scenario = generateMassiveScaleScenario();
console.log('Ready for upload test...');
