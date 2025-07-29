# SWAPS Code Organization

This document outlines the organization of the SWAPS codebase, which follows a domain-driven design approach. The code is organized by functionality domain rather than by technical layer, making it easier to understand and maintain.

## Core Principles

1. **Separation of Concerns**: Each module has a single responsibility
2. **Domain-Driven Design**: Code is organized by domain (NFTs, trades, etc.)
3. **Modularity**: Services are designed to be modular and independently testable
4. **Type Safety**: All TypeScript interfaces and types are properly defined and exported

## Directory Structure

### Backend

```
/backend
├── /src
│   ├── /controllers       # Request handlers and controllers
│   ├── /routes            # API route definitions
│   ├── /services          # Core business logic and services
│   │   ├── /nft           # NFT-related services 
│   │   ├── /trade         # Trade-related services
│   │   └── /blockchain    # Blockchain interaction services
│   ├── /lib               # Shared libraries and utilities
│   │   ├── /persistence   # Data persistence helpers
│   │   └── /helius        # Helius API integrations
│   ├── /types             # TypeScript type definitions
│   ├── /utils             # Utility functions
│   ├── /middleware        # Express middleware
│   ├── app.ts             # Express application setup
│   └── index.ts           # Application entry point
├── .env.example           # Example environment variables
└── package.json           # Dependencies and scripts
```

### Frontend

```
/frontend
├── /src
│   ├── /app               # Next.js app directory
│   ├── /components        # React components
│   │   ├── /common        # Shared UI components
│   │   ├── /nft           # NFT-related components
│   │   ├── /trades        # Trade-related components
│   │   ├── /stats         # Analytics components
│   │   └── /layout        # Layout components
│   ├── /services          # API communication services
│   ├── /hooks             # React hooks
│   ├── /providers         # React context providers
│   ├── /types             # TypeScript type definitions
│   └── /utils             # Utility functions
│       ├── /errors        # Error handling utilities
│       └── /formatting    # Formatting utilities
├── .env.example           # Example environment variables
└── package.json           # Dependencies and scripts
```

## Trade Service Organization

The Trade Discovery Service has been refactored into several smaller, more focused modules:

1. **TradeDiscoveryService**: Main orchestration service that coordinates the trade discovery process
2. **WalletService**: Handles wallet-related operations like fetching NFTs
3. **TradeLoopFinderService**: Implements algorithms for finding potential trade loops
4. **TradeScoreService**: Calculates scores for trade loops based on various metrics
5. **NFTPricingService**: Handles fetching and calculating NFT prices

## Type Definitions

All type definitions have been moved to dedicated files in the `/types` directory:

1. **/types/trade.ts**: Contains all trade-related interfaces
2. **/types/nft.ts**: Contains all NFT-related interfaces

## Data Persistence

A dedicated `PersistenceManager` class handles all data persistence operations, providing a consistent interface for saving and loading data.

## Code Organization Benefits

1. **Easier Onboarding**: New developers can understand specific domains without needing to understand the entire codebase
2. **Maintainability**: Smaller, focused modules are easier to maintain and test
3. **Scalability**: New features can be added without affecting existing functionality
4. **Testability**: Modules can be tested in isolation

## Adding New Features

When adding new features to the codebase:

1. Identify the domain the feature belongs to
2. Create or use an existing service in that domain
3. Add appropriate type definitions in the types directory
4. Implement unit tests for the new functionality
5. Update controllers and routes if needed

## Coding Standards

1. **TypeScript**: Use proper type definitions for all interfaces
2. **Error Handling**: Use consistent error handling patterns
3. **Logging**: Use proper logging for debugging and monitoring
4. **Environment Variables**: Use environment variables for configuration
5. **Documentation**: Document public APIs and complex logic 