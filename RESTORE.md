# SWAPS Restoration Guide

This document provides instructions on how to restore the SWAPS Solana NFT Trading Platform from the core algorithm files that have been preserved.

## What's Been Restored

This repository contains the core algorithm files of the SWAPS platform:

1. **TradeLoopFinderService**: The heart of the system, implementing Johnson's Algorithm for finding cycles in directed graphs.
2. **ScalableTradeLoopFinderService**: An enhanced service for massive-scale trade discovery.
3. **GraphPartitioningService**: The community detection system that partitions large graphs for efficient processing.
4. **TradeScoreService**: The scoring system that ranks trades based on directness, fairness, and demand.
5. **WalletService**: The robust NFT retrieval system with fallback mechanisms.

## Setup Instructions

1. Make the setup script executable and run it:

```bash
chmod +x setup.sh
./setup.sh
```

2. Get a Helius API key from https://dev.helius.xyz/

3. Add your Helius API key to `backend/.env`:

```
HELIUS_API_KEY=your_api_key_here
```

4. Install dependencies:

```bash
yarn install
```

5. Start the development server:

```bash
yarn dev
```

## Missing Components

The following components are still missing or incomplete and need further development:

1. **Frontend UI**: The entire frontend interface needs to be rebuilt.
2. **Wallet Integration**: Solana wallet connection functionality.
3. **Smart Contract Integration**: The on-chain components for executing trades.
4. **Complete API**: While basic API routes are included, a more comprehensive API is needed.

## Next Steps

1. Implement the `TradeLoopFinderService` which is referenced but not fully implemented in this restoration.
2. Develop a basic frontend to interact with the trade discovery API.
3. Add wallet connection support for actual NFT discovery.
4. Implement trade execution functionality.

## API Documentation

The restored API includes the following endpoints:

- `GET /api/health`: Health check endpoint
- `GET /api/trades`: Get all discovered trade loops
- `GET /api/wallet/:address/trades`: Get trades for a specific wallet
- `POST /api/wallet/:address/wants`: Add an NFT to a wallet's wanted list
- `POST /api/wallet/:address/reject`: Reject an NFT from trade consideration
- `POST /api/wallet/:address/update`: Update a wallet's NFT state

## Troubleshooting

If you encounter errors related to missing dependencies, try:

```bash
yarn add graphology graphology-communities-louvain graphology-layout-forceatlas2 graphology-utils bloom-filters
```

If Helius API calls fail, check that your API key is correct and that you haven't exceeded rate limits. 