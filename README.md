# SWAPS

## Overview

SWAPS is a next-generation engine for decentralized NFT trading that eliminates the need for traditional buy-sell mechanics. Instead of relying on direct sales or auctions, SWAPS uses advanced graph theory algorithms to facilitate multi-party bartering—enabling users to swap NFTs across a network of interconnected wallets.

## Key Features

### 🔄 Multi-Party Bartering
- Discover complex trade loops involving 2-10+ participants
- Everyone gets what they want without monetary transactions
- Unlock liquidity in previously illiquid NFT markets

### 🧠 Advanced Algorithms
- **Graph Theory**: Models the ecosystem as a directed graph
- **Strongly Connected Components**: Uses Tarjan's Algorithm for optimization
- **Cycle Enumeration**: Johnson's Algorithm for efficient loop discovery
- **18-Metric Scoring System**: Ensures fair trades with ~10% variance

### ⚡ High Performance
- **Distributed Architecture**: Horizontal scaling with Kafka
- **Background Discovery Engine**: Pre-computed trade opportunities
- **Linear Efficiency**: ~92% efficiency across 16+ nodes
- **Real-time Processing**: Instant results for users

### 🎯 Solana Integration
- Native Solana blockchain support
- Custom smart contracts for atomic swaps
- Helius API integration for NFT data
- Wallet adapter support

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│                 │    │                  │    │                 │
│   Frontend      │◄──►│    Backend       │◄──►│   Blockchain    │
│   (Next.js)     │    │   (Node.js)      │    │   (Solana)      │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │                  │
                       │   Trade Engine   │
                       │   - Graph Theory │
                       │   - Cycle Detect │
                       │   - Scoring      │
                       │                  │
                       └──────────────────┘
```

## Tech Stack

- **Backend**: Node.js, TypeScript, Express
- **Frontend**: Next.js, React, TypeScript
- **Blockchain**: Solana, Rust (Smart Contracts)
- **Database**: File-based persistence with JSON
- **APIs**: Helius API for NFT data
- **Infrastructure**: Docker-ready, horizontally scalable

## Getting Started

### Prerequisites
- Node.js 18+ 
- NPM or Yarn
- Solana CLI (for blockchain interaction)
- Helius API Key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/swaps.git
   cd swaps
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Environment Setup**
   ```bash
   # Backend (.env)
   HELIUS_API_KEY=your_helius_api_key
   PORT=3001
   ENABLE_PERSISTENCE=true
   
   # Frontend (.env.local)
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

5. **Start the services**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev
   
   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

## Project Structure

```
swaps/
├── backend/                 # Node.js backend
│   ├── src/
│   │   ├── services/       # Core business logic
│   │   ├── routes/         # API endpoints
│   │   ├── controllers/    # Request handlers
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utility functions
│   ├── programs/           # Solana smart contracts
│   └── tests/              # Test files
├── frontend/               # Next.js frontend
│   ├── src/
│   │   ├── app/           # Next.js app router
│   │   ├── components/    # React components
│   │   ├── services/      # API clients
│   │   └── types/         # TypeScript types
│   └── public/            # Static assets
└── docs/                  # Documentation
```

## Core Concepts

### Trade Loops
A trade loop is a closed cycle where multiple users exchange NFTs:
- User A owns NFT X, wants NFT Y
- User B owns NFT Y, wants NFT Z  
- User C owns NFT Z, wants NFT X
- Result: All users get what they want!

### Graph Theory Application
- **Nodes**: Wallets or NFTs
- **Edges**: "Want" relationships
- **Cycles**: Potential trade loops
- **SCCs**: Strongly Connected Components for optimization

### Fairness Scoring
18-metric evaluation system considering:
- Price parity and floor alignment
- Collection popularity and rarity
- Historical trading behavior
- Ownership patterns and preferences

## API Documentation

### Core Endpoints

- `POST /api/trades/discover` - Discover trade loops
- `GET /api/trades/active` - Get active trades
- `POST /api/nfts/register` - Register NFT ownership
- `POST /api/nfts/want` - Express interest in NFT

### Admin Endpoints

- `GET /api/admin/system-state` - System statistics
- `POST /api/admin/rebuild-mapping` - Rebuild data mappings

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, questions, or feature requests:
- Create an issue on GitHub
- Contact the development team

## Roadmap

- [ ] Collection-level abstraction
- [ ] Mobile app development
- [ ] Cross-chain support
- [ ] Advanced ML-based recommendations
- [ ] Governance token integration

---

**Built with ❤️ for the Solana NFT community** 
