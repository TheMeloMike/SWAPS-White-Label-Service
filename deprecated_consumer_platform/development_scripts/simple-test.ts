// Simple test to verify the production algorithm

import { TradeDiscoveryService } from './services/trade/TradeDiscoveryService';
import { LoggingService } from './utils/logging/LoggingService';

// Configure logging
const logger = LoggingService.getInstance().createLogger('SimpleTest');

// Override console.log for direct output
console.log = function(...args) {
  process.stdout.write(args.map(a => String(a)).join(' ') + '\n');
};

async function runTest() {
  console.log("=== Starting Simple Production Algorithm Test ===");
  
  try {
    // Set algorithm parameters 
    process.env.TRADELOOP_MAX_DEPTH = '7';
    process.env.TRADELOOP_MIN_EFFICIENCY = '0.6';
    process.env.ENABLE_PERSISTENCE = 'false';
    // Use environment API key or a placeholder for testing only
    // IMPORTANT: This test file should never be used in production
    process.env.HELIUS_API_KEY = process.env.HELIUS_API_KEY || 'HELIUS_API_KEY_FOR_TESTING_ONLY';
    
    // Get the trade discovery service
    const tradeDiscovery = TradeDiscoveryService.getInstance();
    
    // Create some test wallets
    const walletA = 'wallet_A';
    const walletB = 'wallet_B';
    const walletC = 'wallet_C';
    
    // Create some test NFTs
    const nftA = 'nft_A';
    const nftB = 'nft_B';
    const nftC = 'nft_C';
    
    // Setup ownership
    const service = tradeDiscovery as any;
    
    // Use any casting to bypass type checking for testing purposes
    service.registerWallet(walletA);
    service.registerWallet(walletB);
    service.registerWallet(walletC);
    
    service.registerNFT(nftA, walletA);
    service.registerNFT(nftB, walletB);
    service.registerNFT(nftC, walletC);
    
    // Setup trade preferences - make a simple 3-party loop
    tradeDiscovery.addTradePreference(walletA, nftB);
    tradeDiscovery.addTradePreference(walletB, nftC);
    tradeDiscovery.addTradePreference(walletC, nftA);
    
    console.log("Test data loaded");
    console.log("NFT Ownership:");
    console.log(`- ${walletA} owns ${nftA}`);
    console.log(`- ${walletB} owns ${nftB}`);
    console.log(`- ${walletC} owns ${nftC}`);
    
    console.log("\nWants:");
    console.log(`- ${walletA} wants ${nftB}`);
    console.log(`- ${walletB} wants ${nftC}`);
    console.log(`- ${walletC} wants ${nftA}`);
    
    console.log("\n=== Running Trade Discovery Algorithm ===");
    const settings = {
      maxDepth: 7,
      minEfficiency: 0.6,
      maxResults: 100,
      includeDirectTrades: true,
      includeMultiPartyTrades: true,
      considerCollections: false,
      timeoutMs: 10000
    };
    
    const trades = await tradeDiscovery.findTradeLoops(settings);
    
    console.log(`\n=== Found ${trades.length} trades ===`);
    
    // Print trade details
    for (let i = 0; i < trades.length; i++) {
      const trade = trades[i];
      console.log(`\nTrade ${i+1}:`);
      console.log(`- Efficiency: ${trade.efficiency?.toFixed(2) || 'N/A'}`);
      console.log(`- Score: ${(trade as any).score?.toFixed(2) || 'N/A'}`);
      console.log(`- Steps: ${trade.steps.length}`);
      
      trade.steps.forEach((step, idx) => {
        console.log(`  Step ${idx+1}: ${step.from} → ${step.to} (NFT: ${step.nfts?.[0]?.address || 'unknown'})`);
      });
    }
    
    console.log("\n=== Test Completed Successfully ===");
  } catch (error) {
    console.error("Test Failed With Error:", error);
  }
}

// Run the test when this script is executed directly
if (require.main === module) {
  runTest()
    .then(() => console.log("Done"))
    .catch(console.error);
} 