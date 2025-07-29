# Frontend Source Code

This directory contains the frontend application source code organized as follows:

## Directory Structure

```
src/
├── app/                 # Next.js pages and routing
├── components/          # Reusable UI components
│   ├── trade-loop/     # Trade loop visualization and management
│   ├── wallet/         # Wallet connection and management
│   └── analytics/      # Analytics and metrics display
├── hooks/              # Custom React hooks
├── providers/          # React context providers
├── services/           # API and blockchain services
└── types/             # TypeScript type definitions
```

## Key Components

### Trade Loop Components
- `TradeLoopVisualizer`: Displays trade loop opportunities
- `TradeLoopParticipant`: Manages individual participant interactions
- `ValueOptimizer`: Shows and manages value optimization

### Wallet Components
- `WalletConnector`: Handles wallet connection
- `NFTInventory`: Displays user's NFT inventory
- `TransactionManager`: Manages trade transactions

### Analytics Components
- `TradingMetrics`: Shows trading volume and success rates
- `ValueCirculation`: Tracks value movement
- `MarketEfficiency`: Displays market performance metrics

## Development Guidelines

1. All components should be TypeScript-based
2. Use styled-components for styling
3. Implement proper error handling
4. Include unit tests for all components
5. Document props and component behavior 