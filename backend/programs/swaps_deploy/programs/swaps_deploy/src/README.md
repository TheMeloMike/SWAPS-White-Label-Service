# Solana NFT Swap Program

This directory contains the Solana smart contract implementation for the NFT trading platform.

## Directory Structure

```
src/
├── lib.rs              # Program entry point and exports
├── instructions/       # Program instructions
│   ├── trade.rs       # Trade execution logic
│   ├── loop.rs        # Trade loop management
│   └── market.rs      # Market making operations
├── state/             # Program state definitions
│   ├── trade.rs       # Trade state structures
│   ├── loop.rs        # Loop state structures
│   └── market.rs      # Market state structures
└── error.rs           # Custom error definitions
```

## Key Components

### Instructions
- `execute_trade`: Handles individual NFT trades
- `create_loop`: Initializes a trade loop
- `complete_loop`: Executes a complete trade loop
- `manage_market`: Handles market making operations

### State Management
- `TradeState`: Tracks individual trade details
- `LoopState`: Manages trade loop information
- `MarketState`: Handles market making state

## Development Guidelines

1. Follow Solana program best practices
2. Implement proper security checks
3. Optimize for gas efficiency
4. Write comprehensive tests
5. Document all public functions 