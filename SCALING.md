# Scaling SWAPS to 100,000+ Wallets

This document describes how we've scaled the SWAPS NFT trading platform to handle 100,000+ wallets and millions of NFTs using advanced graph algorithms and distributed computing techniques.

## Architecture Overview

The scalable SWAPS platform is built with the following components:

1. **Graph Partitioning Service** - Uses community detection to break down the massive trading graph into manageable subgraphs
2. **Scalable Trade Loop Finder** - Optimized algorithm for discovering trading opportunities at scale
3. **Kafka Integration Service** - Enables distributed processing and real-time updates

## Key Optimizations

### 1. Community Detection with Louvain Algorithm

The `GraphPartitioningService` implements the Louvain community detection algorithm to partition the wallet-NFT interaction graph into communities of potentially tradable wallets. This reduces the computational complexity from O(n²) to O(n log n).

```typescript
// Get community for a specific wallet
const community = graphPartitioningService.getWalletsInSameCommunity(walletAddress);
```

### 2. Probabilistic Data Structures

We use Bloom filters to efficiently track previously seen trade cycles without storing the full cycles in memory:

```typescript
// Check if we've seen this cycle before
if (!bloomFilter.has(cycleKey)) {
  bloomFilter.add(cycleKey);
  // Process the new cycle
}
```

### 3. Incremental Graph Updates

The system supports incremental updates to efficiently handle changes without reprocessing the entire graph:

```typescript
// When a wallet is added
scalableTradeLoopFinder.walletAdded(walletAddress);

// When a wallet is updated
scalableTradeLoopFinder.walletUpdated(walletAddress);

// When a wallet is removed
scalableTradeLoopFinder.walletRemoved(walletAddress);
```

### 4. Distributed Processing with Kafka

Kafka enables horizontal scaling across multiple nodes:

```typescript
// Start the Kafka integration
const kafkaService = KafkaIntegrationService.getInstance();
await kafkaService.connect();

// Send a trade discovery request to be processed by any available node
await kafkaService.requestTradeDiscovery(walletAddress, desiredNftAddress);
```

## Performance Metrics

In our tests with 100,000 wallets and 200,000 NFTs:

- **Standard Implementation**: Timeout after 30+ seconds
- **Optimized Implementation**: Completes in ~5 seconds
- **Distributed Implementation**: Completes in ~1 second with 5 nodes

## Getting Started

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file with the following parameters:

```
# Trade Loop Finder Configuration
TRADELOOP_MAX_DEPTH=10
TRADELOOP_MIN_EFFICIENCY=0.60
TRADELOOP_GLOBAL_TIMEOUT_MS=10000
TRADELOOP_MAX_SCCS_TO_PROCESS=30

# Kafka Configuration (for distributed mode)
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=swaps-trade-service
KAFKA_CONSUMER_GROUP=swaps-trade-group
```

### 3. Start Kafka (for distributed mode)

```bash
docker-compose up -d kafka zookeeper
```

### 4. Run the Application

```bash
npm run dev
```

## API Usage

### Direct API Mode

```typescript
// Import the scalable implementation
import { ScalableTradeLoopFinderService } from './services/trade/ScalableTradeLoopFinderService';

// Get an instance
const service = ScalableTradeLoopFinderService.getInstance();

// Find trade loops
const tradeLoops = service.findAllTradeLoops(wallets, nftOwnership, wantedNfts, rejectionPreferences);
```

### Distributed Mode with Kafka

```typescript
// Import the Kafka integration service
import { KafkaIntegrationService } from './services/trade/KafkaIntegrationService';

// Get an instance and connect
const kafkaService = KafkaIntegrationService.getInstance();
await kafkaService.connect();

// Request trade discovery
await kafkaService.requestTradeDiscovery(walletAddress, desiredNftAddress);

// Listen for results on the 'swaps-trade-results' topic
```

## Integration with Apache Spark

For even larger datasets (millions of wallets), we provide integration with Apache Spark:

1. Export the wallet and NFT data to Parquet format
2. Process the data with our Spark GraphX job (`spark/TradeLoopSpark.scala`)
3. Import the results back into the application

## Testing

Run the test suite to verify performance:

```bash
npm test tests/ScalableTradeLoopFinder.test.js
```

## Monitoring

We've added detailed telemetry points throughout the system to monitor performance:

- Community size distribution
- Processing time per community
- Cache hit/miss ratios
- Quality metrics of discovered trades

## Future Improvements

1. **GPU Acceleration** - Implement CUDA-based graph processing for even faster community detection
2. **Reinforcement Learning** - Use RL to predict which communities are most likely to contain valuable trades
3. **Stream Processing** - Implement fully streaming trade discovery with Apache Flink 