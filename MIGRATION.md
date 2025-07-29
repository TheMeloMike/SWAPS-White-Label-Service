# Migration Guide

This document provides guidance for migrating from the old code organization to the new domain-driven structure.

## Overview

The codebase has been reorganized to follow a domain-driven design approach, with a focus on separation of concerns and modularity. The main changes include:

1. Breaking down large service files into smaller, focused modules
2. Moving type definitions to dedicated files
3. Organizing code by domain rather than by technical layer
4. Improving error handling and type safety

## Migration Steps

### 1. Backend Migration

#### Monolithic TradeDiscoveryService

The large `TradeDiscoveryService` has been refactored into several smaller services:

1. `TradeDiscoveryService`: Main orchestration service
2. `WalletService`: Wallet-related operations
3. `TradeLoopFinderService`: Trade loop finding algorithms
4. `TradeScoreService`: Trade scoring logic
5. `NFTPricingService`: NFT pricing operations

When migrating existing code:

```typescript
// Old approach - direct usage of TradeDiscoveryService
import { TradeDiscoveryService } from '../lib/trade-discovery';
const tradeDiscovery = TradeDiscoveryService.getInstance();
tradeDiscovery.findTradeLoops();

// New approach - use the new modular services
import { TradeDiscoveryService } from '../services/trade/TradeDiscoveryService';
const tradeDiscovery = TradeDiscoveryService.getInstance();
tradeDiscovery.findTradeLoops();
```

#### Type Definitions

Type definitions have been moved from inline definitions to dedicated files:

```typescript
// Old approach - importing types from implementation files
import { TradeLoop } from '../lib/trade-discovery';

// New approach - importing from dedicated type files
import { TradeLoop } from '../types/trade';
```

### 2. Frontend Migration

The frontend organization has been improved with better component organization:

```
/frontend/src/components
├── /common        # Shared UI components
├── /nft           # NFT-related components
├── /trades        # Trade-related components
├── /stats         # Analytics components
└── /layout        # Layout components
```

When migrating existing code:

```typescript
// Old approach
import { NFTCard } from '../components/NFTCard';

// New approach
import { NFTCard } from '../components/nft/NFTCard';
```

### 3. Service Dependencies

The refactored services have explicit dependencies, which are injected in the constructor:

```typescript
// Old approach - implicit dependencies
class OldService {
  private apiService = new ApiService();
  // ...
}

// New approach - explicit dependencies
class NewService {
  constructor(
    private apiService: ApiService,
    private configService: ConfigService
  ) {}
  // ...
}
```

### 4. Environment Variables

Environment variables are now documented in `.env.example` files:

```
# Old approach - undocumented environment variables
HELIUS_API_KEY=xyz123

# New approach - documented in .env.example
# Helius API key for Solana data retrieval
HELIUS_API_KEY=your_helius_api_key_here
```

## API Endpoints

API endpoints remain unchanged, but the underlying implementation has been refactored. Controllers use the new service classes, but maintain the same external interface.

## Testing

With the new organization, testing is more focused:

```typescript
// Old approach - testing large services
describe('TradeDiscoveryService', () => {
  // Many tests for different functionalities
});

// New approach - focused testing
describe('TradeLoopFinderService', () => {
  // Tests specific to finding trade loops
});

describe('TradeScoreService', () => {
  // Tests specific to scoring trades
});
```

## Gradual Migration

You can migrate gradually by following these steps:

1. Start using the new type definitions
2. Migrate controllers to use the new services
3. Update imports throughout the codebase
4. Remove the old files once all references have been updated

## Benefits of New Organization

The new organization provides several benefits:

1. **Better Developer Experience**: Easier to find and understand code
2. **Improved Maintainability**: Smaller, focused modules
3. **Better Testability**: Isolated components with explicit dependencies
4. **Clearer Documentation**: Types and services have clear responsibilities
5. **Onboarding**: New developers can understand specific domains without understanding the entire system 