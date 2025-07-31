# Backend Source Code

This directory contains the backend services and APIs organized as follows:

## Directory Structure

```
src/
├── services/           # Core business logic services
│   ├── loop-detection/    # Trade loop discovery algorithm
│   ├── value-matching/    # Value optimization service
│   └── market-making/     # Liquidity management
├── api/               # API routes and controllers
├── models/            # Data models and types
├── utils/             # Utility functions
└── config/            # Configuration management
```

## Key Services

### Loop Detection Service
- `discoverLoops`: Identifies potential trade loops
- `validateLoop`: Ensures loops meet trading criteria
- `optimizeLoop`: Improves trade efficiency

### Value Matching Service
- `calculateValue`: Determines NFT values
- `optimizeTrades`: Balances trade values
- `adjustSOL`: Manages SOL adjustments

### Market Making Service
- `manageLiquidity`: Handles protocol liquidity
- `adjustFees`: Manages trading fees
- `distributeRewards`: Handles market maker rewards

## Development Guidelines

1. All services should be TypeScript-based
2. Implement proper error handling and logging
3. Write comprehensive unit tests
4. Document all public APIs
5. Follow the established service patterns 