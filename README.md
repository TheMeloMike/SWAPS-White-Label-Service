# SWAPS White Label API 

> **Enterprise B2B API for Multi-Party NFT Trading with Living Persistent Graph**

Transform your platform with sophisticated multi-party bartering capabilities. SWAPS discovers complex trade loops across multiple participants, creating liquidity where none existed before.

## 🌟 Key Features

- **🔄 Multi-Party Trade Discovery**: Find complex trade loops (2-7+ participants)
- **⚡ Living Persistent Graph**: Event-driven architecture with real-time updates
- **🏢 Multi-Tenant Architecture**: Complete data isolation per API key
- **🚀 High Performance**: <600ms discovery for most scenarios
- **🔧 Solana-First Design**: Optimized for Solana NFTs with multi-chain support
- **📊 Fair Trade Scoring**: 18-metric system ensuring balanced trades
- **🔐 Enterprise Security**: API key authentication with rate limiting

## 🚀 Quick Start

### 1. Deploy to Render (Recommended)

```bash
# Clone the repository
git clone https://github.com/TheMeloMike/SWAPS-White-Label-Service.git
cd SWAPS-White-Label-Service

# Deploy using the deploy button in README or manually
# Set environment variables in Render dashboard
```

### 2. Local Development

```bash
# Install dependencies
cd backend
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the server
npm start
```

## 📡 Core API Flow

### 1. Submit NFT Inventory
```bash
POST /api/v1/inventory/submit
Content-Type: application/json
X-API-Key: your_api_key_here

{
  "walletId": "wallet_address",
  "nfts": [{
    "id": "nft_unique_id",
    "name": "Cool NFT #123",
    "collection": "collection_name",
    "imageUrl": "https://...",
    "estimatedValueUSD": 1500
  }]
}
```

### 2. Submit Wants
```bash
POST /api/v1/wants/submit
Content-Type: application/json
X-API-Key: your_api_key_here

{
  "walletId": "wallet_address",
  "wants": [{
    "nftId": "desired_nft_id",
    "priority": 1
  }]
}
```

### 3. Discover Trade Loops
```bash
POST /api/v1/discovery/trades
Content-Type: application/json
X-API-Key: your_api_key_here

{
  "walletId": "wallet_address"
}
```

## 📚 Complete Documentation

- **[📖 API Documentation](./SWAPS_White_Label_Integration_Guide_UPDATED.md)** - Complete integration guide
- **[🔒 Security Overview](./SWAPS_White_Label_Security_Overview_UPDATED.md)** - Security features
- **[🔧 Troubleshooting Guide](./SWAPS_White_Label_Troubleshooting_Guide_UPDATED.md)** - Common issues & solutions
- **[📊 Performance Metrics](./SWAPS_Performance_Metrics_ACCURATE.md)** - Real performance data

## 🏗️ How It Works

1. **Living Graph Architecture**: The system maintains a persistent in-memory graph of all NFT ownership and wants
2. **Event-Driven Updates**: When NFTs or wants are submitted, the graph updates and triggers background discovery
3. **Advanced Algorithms**: Johnson's algorithm finds cycles, Tarjan's identifies connected components
4. **Fair Trade Scoring**: Each loop is scored on 18 metrics to ensure all participants benefit equally
5. **Instant Results**: Pre-computed loops are served from cache for sub-second response times

## 📊 Real Performance Metrics

Based on production testing:

- **Small Graphs (2-5 wallets)**: 100-600ms discovery
- **Medium Graphs (10-50 wallets)**: 300-2000ms discovery  
- **Large Graphs (100+ wallets)**: 2-10s discovery
- **Cached Results**: <100ms retrieval
- **Concurrent Handling**: 15-20 requests reliably

## 💡 Best Practices

1. **Populate the Graph First**: Submit all NFTs and wants before querying
2. **Use Wallet-Based Queries**: Query with `walletId` for cached results
3. **Batch Submissions**: Submit multiple NFTs/wants in single requests
4. **Monitor Rate Limits**: Stay within 60 requests/minute per API key

## 🧪 Testing

```bash
# Test the living persistent graph flow
node verify-living-persistent-graph.js

# Test multi-party loops
node verify-multi-party-trade-loops.js

# Performance testing
node controlled-capability-test.js
```

## 🌐 Environment Variables

```bash
NODE_ENV=production
PORT=3000
ADMIN_API_KEY=your_admin_key
ENABLE_PERSISTENCE=true
DATA_DIR=./data
```

## 🤝 Simple Integration Example

```javascript
// 1. Submit inventory
await fetch(`${API_URL}/inventory/submit`, {
  method: 'POST',
  headers: {
    'X-API-Key': 'your_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    walletId: 'user_wallet',
    nfts: [/* user's NFTs */]
  })
});

// 2. Submit wants
await fetch(`${API_URL}/wants/submit`, {
  method: 'POST',
  headers: {
    'X-API-Key': 'your_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    walletId: 'user_wallet',
    wants: [/* desired NFTs */]
  })
});

// 3. Get trade loops
const trades = await fetch(`${API_URL}/discovery/trades`, {
  method: 'POST',
  headers: {
    'X-API-Key': 'your_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    walletId: 'user_wallet'
  })
});
```

## 📧 Support & Contact

- **Technical Integration**: [technical@swaps.network](mailto:technical@swaps.network)
- **Business Development**: [partnerships@swaps.network](mailto:partnerships@swaps.network)

## 📄 License

Proprietary - Enterprise White Label Service

---

**Ready to add multi-party trading to your platform?** Deploy in minutes and transform your NFT marketplace into a liquidity engine. 🚀