# SWAPS Developer Overview

## 🎯 Project Summary

SWAPS is a **multi-party NFT trading platform** that uses advanced graph theory algorithms to discover complex trade loops where multiple users can exchange NFTs simultaneously. Unlike traditional 1:1 trading, SWAPS finds circular paths where everyone gets what they want without monetary transactions.

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SWAPS PLATFORM                          │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   FRONTEND      │    BACKEND      │       BLOCKCHAIN            │
│   (Next.js)     │   (Node.js)     │       (Solana)              │
│                 │                 │                             │
│ • React UI      │ • Trade Engine  │ • Smart Contracts          │
│ • Wallet Connect│ • Graph Algorithms│ • Atomic Swaps           │
│ • AI Assistant  │ • APIs & Routes │ • NFT Verification         │
│ • Admin Panel   │ • Data Persistence│                          │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

## 📁 Project Structure

### Root Level
```
SWAPS/
├── backend/                 # Node.js/TypeScript backend
├── frontend/                # Next.js frontend  
├── frontend_deprecated/     # Legacy frontend (keep for reference)
├── scripts/                 # Utility scripts
├── test-data/              # Test datasets
├── test-environment/       # Testing infrastructure
├── logs/                   # Application logs
├── data/                   # Shared data files
└── docs/                   # Documentation (*.md files)
```

### Backend Structure (`/backend/`)
```
backend/
├── src/
│   ├── services/           # 🔥 CORE BUSINESS LOGIC
│   │   ├── trade/         # Trade discovery algorithms
│   │   ├── nft/           # NFT data management
│   │   ├── ai/            # AI-powered features
│   │   └── analytics/     # Performance monitoring
│   ├── controllers/       # API request handlers
│   ├── routes/           # API endpoint definitions
│   ├── types/            # TypeScript type definitions
│   ├── middleware/       # Authentication, validation
│   └── utils/            # Helper functions
├── programs/             # Solana smart contracts (Rust)
├── tests/               # Test suites
└── data/                # Persistent data storage
```

### Frontend Structure (`/frontend/`)
```
frontend/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   │   ├── ai/          # AI assistant components
│   │   ├── trade/       # Trading interface
│   │   ├── nft/         # NFT display components
│   │   └── common/      # Reusable UI components
│   ├── services/        # API clients & business logic
│   ├── hooks/           # Custom React hooks
│   ├── types/           # TypeScript definitions
│   └── styles/          # Styling and themes
└── public/              # Static assets
```

## 🧠 Core Algorithms & Services

### 1. Trade Discovery Engine
**Location:** `backend/src/services/trade/`

| File | Purpose |
|------|---------|
| `TradeDiscoveryService.ts` | Main orchestrator for trade discovery |
| `TradeLoopFinderService.ts` | Johnson's Algorithm implementation |
| `ScalableTradeLoopFinderService.ts` | Optimized version for large datasets |
| `SCCFinderService.ts` | Strongly Connected Components detection |
| `TradeScoreService.ts` | 18-metric trade fairness evaluation |

### 2. Graph Theory Implementation
- **Algorithm:** Johnson's Algorithm for cycle detection
- **Optimization:** Tarjan's Algorithm for SCC decomposition  
- **Scaling:** Distributed processing with Kafka integration
- **Performance:** ~92% linear efficiency across 16+ nodes

### 3. NFT Data Management
**Location:** `backend/src/services/nft/`

| Service | Function |
|---------|----------|
| `NFTService.ts` | Core NFT operations |
| `NFTPricingService.ts` | Price discovery and valuation |
| `LocalCollectionService.ts` | Collection metadata management |
| `CollectionAbstractionService.ts` | Collection-level trading logic |

## 🚀 Getting Started (Developer Setup)

### Prerequisites
```bash
# Required
node >= 18.0.0
npm >= 8.0.0
git

# Optional but recommended  
solana-cli (for blockchain features)
```

### Quick Start
```bash
# 1. Clone the repository
git clone https://github.com/TheMeloMike/SWAPS.git
cd SWAPS

# 2. Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env with your API keys

# 3. Frontend setup  
cd ../frontend
npm install
cp .env.example .env.local
# Edit .env.local with your config

# 4. Start development servers
cd ../backend && npm run dev &    # Backend on :3001
cd ../frontend && npm run dev &   # Frontend on :3000
```

### Environment Variables

**Backend (`.env`):**
```bash
HELIUS_API_KEY=your_helius_api_key
PORT=3001
ENABLE_PERSISTENCE=true
NODE_ENV=development
```

**Frontend (`.env.local`):**
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_key
```

## 🛣️ API Routes & Endpoints

### Core Trading APIs
```bash
# Trade Discovery
POST /api/trades/discover          # Find trade loops for wallet
GET  /api/trades/active           # Get active trade opportunities  
GET  /api/trades/validate-data    # Validate system data integrity

# NFT Management
POST /api/nfts/register           # Register NFT ownership
POST /api/nfts/want               # Express interest in NFT
GET  /api/nfts/collections        # List available collections

# Analytics & Stats
GET  /api/stats/system            # System performance metrics
GET  /api/stats/trading           # Trading activity statistics
```

### Admin APIs
```bash
GET  /api/admin/system-state      # System status and metrics
POST /api/admin/rebuild-mapping   # Rebuild data mappings
POST /api/admin/load-all-wallets  # Force reload wallet data
```

### Development/Debug APIs  
```bash
GET  /api/admin-simple/test       # Simple health check
POST /api/admin-simple/rebuild-mapping  # Debug data sync
```

## 🎨 Frontend Architecture

### Key Components

| Component Path | Purpose |
|----------------|---------|
| `app/page.tsx` | Main landing page |
| `components/TradeLoop.tsx` | Trade visualization |
| `components/ai/TradeAssistant.tsx` | AI-powered trading help |
| `components/WalletDisplay.tsx` | Wallet connection interface |
| `services/trade.ts` | Backend API client |

### Styling System
- **Framework:** Styled-components + CSS modules
- **Theme:** Dynamic theming with dark/light modes
- **Animations:** Custom animation system in `styles/animations.ts`

## 🔧 Key Configuration Files

| File | Purpose |
|------|---------|
| `backend/tsconfig.json` | TypeScript configuration |
| `backend/package.json` | Dependencies and scripts |
| `frontend/next.config.js` | Next.js configuration |
| `docker-compose.yml` | Container orchestration |
| `.gitignore` | Git ignore patterns |

## 🧪 Testing Strategy

### Test Locations
```bash
backend/tests/              # Backend unit tests
backend/src/tests/          # Integration tests  
test-data/                  # Test datasets
test-environment/           # Isolated testing setup
```

### Running Tests
```bash
# Backend tests
cd backend && npm test

# Algorithm performance tests
npm run test:algorithm

# Large-scale tests (100+ wallets)
npm run test:scale
```

## 📊 Data Flow & Persistence

### Data Storage
```bash
backend/data/
├── wallets.json           # User wallet states
├── nftOwnership.json      # NFT ownership mapping  
├── wantedNfts.json        # User preferences
└── completedSteps.json    # Trade history
```

### Data Synchronization
- **Primary:** File-based JSON storage
- **Caching:** In-memory caching with TTL
- **Backup:** Automatic data backups in `data_backup/`
- **Sync:** Real-time sync via `DataSyncService`

## 🎯 Core Concepts for Developers

### Trade Loop Discovery
1. **Input:** Wallets with NFTs and "wants"
2. **Graph Construction:** Wallets = nodes, wants = edges
3. **SCC Detection:** Find strongly connected components
4. **Cycle Enumeration:** Use Johnson's Algorithm
5. **Scoring:** Apply 18-metric fairness evaluation
6. **Output:** Ranked list of viable trade loops

### Multi-Party Trading Example
```javascript
// 3-way trade loop:
// Alice owns NFT_A, wants NFT_B  
// Bob owns NFT_B, wants NFT_C
// Carol owns NFT_C, wants NFT_A
// Result: Everyone gets what they want!
```

## 🔍 Debugging & Monitoring

### Logging
```bash
# View real-time logs
tail -f logs/backend.log

# Search for specific events
grep "trade discovery" logs/backend.log
```

### Debug Endpoints
```bash
# System health
curl http://localhost:3001/health

# Data validation  
curl http://localhost:3001/api/trades/validate-data
```

### Performance Monitoring
- **Metrics:** Built-in performance tracking
- **Alerts:** Automatic error detection
- **Dashboards:** Admin panel at `/admin/login`

## 🚀 Deployment Guide

### Development
```bash
# Start both services
npm run dev:all
```

### Production
```bash
# Build backend
cd backend && npm run build

# Build frontend  
cd frontend && npm run build

# Start production servers
npm run start:prod
```

### Docker Deployment
```bash
docker-compose up -d
```

## 🛠️ Common Development Tasks

### Adding New API Endpoint
1. Define route in `backend/src/routes/`
2. Create controller in `backend/src/controllers/`
3. Add service logic in `backend/src/services/`
4. Update frontend client in `frontend/src/services/`

### Adding New NFT Collection
1. Update collection config in `CollectionConfigService`
2. Add collection data to `LocalCollectionService`
3. Test with collection crawler scripts

### Modifying Trade Algorithm
1. Core logic in `TradeLoopFinderService`
2. Scoring in `TradeScoreService`  
3. Performance tuning in `ScalableTradeLoopFinderService`
4. Test with `npm run test:algorithm`

## 🚨 Known Issues & Gotchas

### Performance Considerations
- Large graphs (>1000 wallets) require `ScalableTradeLoopFinderService`
- Memory usage scales with graph complexity
- Background discovery service helps with real-time performance

### Data Consistency
- Always use `rebuildWantedNftsMapping()` after data changes
- File-based persistence requires careful concurrency handling
- Backup data before major algorithm changes

### Solana Integration  
- Smart contracts in `backend/programs/swap/`
- Requires Solana CLI for deployment
- Test with devnet before mainnet deployment

## 📞 Support & Contributing

### Getting Help
1. Check this overview first
2. Review existing issues on GitHub
3. Check logs for error details
4. Use debug endpoints for system state

### Contributing
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Follow existing code patterns
4. Add tests for new functionality
5. Submit pull request with detailed description

---

## 📚 Additional Resources

- **Main README:** `README.md` - Project overview and setup
- **API Documentation:** Check individual route files for endpoint details  
- **Algorithm Details:** `mermaid_algorithm_flow.md` - Visual algorithm flow
- **Architecture Decisions:** Various `*_IMPLEMENTATION.md` files
- **Troubleshooting:** `SWAPS-TROUBLESHOOTING.md`

---

**Happy coding! 🚀 Welcome to the future of NFT trading.** 