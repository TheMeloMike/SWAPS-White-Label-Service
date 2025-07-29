import { TradeScoreService } from './services/trade/TradeScoreService';
import { TradeLoop, NFTDemandMetrics } from './types/trade';

// Create a simple test to verify the TradeScoreService
console.log("Testing TradeScoreService...");

// Create a mock trade loop for testing
const mockTradeLoop: TradeLoop = {
  id: 'test-trade-123',
  steps: [
    {
      from: 'wallet1',
      to: 'wallet2',
      nfts: [
        {
          address: 'nft1',
          name: 'Test NFT 1',
          symbol: 'TNFT1',
          image: '',
          collection: 'Test Collection',
          description: 'Test NFT for scoring',
          floorPrice: 1.5,
          usedRealPrice: true,
          hasFloorPrice: true
        }
      ]
    },
    {
      from: 'wallet2',
      to: 'wallet1',
      nfts: [
        {
          address: 'nft2',
          name: 'Test NFT 2',
          symbol: 'TNFT2',
          image: '',
          collection: 'Test Collection',
          description: 'Test NFT for scoring',
          floorPrice: 1.2,
          usedRealPrice: true,
          hasFloorPrice: true
        }
      ]
    }
  ],
  totalParticipants: 2,
  efficiency: 1.0,
  rawEfficiency: 1.0,
  estimatedValue: 2.7,
  status: 'pending',
  progress: 0,
  createdAt: new Date()
};

// Create mock NFT demand metrics
const mockDemandMetrics = new Map<string, NFTDemandMetrics>();
mockDemandMetrics.set('nft1', {
  wantCount: 5,
  supplyCount: 1,
  demandRatio: 5,
  requestCount: 8,
  lastRequested: new Date(Date.now() - 1000 * 60 * 60 * 24) // 1 day ago
});
mockDemandMetrics.set('nft2', {
  wantCount: 3,
  supplyCount: 1,
  demandRatio: 3,
  requestCount: 4,
  lastRequested: new Date(Date.now() - 1000 * 60 * 60 * 48) // 2 days ago
});

// Create TradeScoreService instance
const tradeScoreService = new TradeScoreService();

// Calculate score for the mock trade
const result = tradeScoreService.calculateTradeScore(mockTradeLoop, mockDemandMetrics);

// Display the result
console.log("\n=== Test Results ===");
console.log(`Final Score: ${result.score.toFixed(4)} (${(result.score * 100).toFixed(2)}%)`);
console.log("Score Metrics:");
for (const [key, value] of Object.entries(result.metrics)) {
  console.log(`  - ${key}: ${typeof value === 'number' ? value.toFixed(4) : value}`);
}

console.log("\nTest completed successfully!"); 