# SWAPS White Label API 🚀

> **Enterprise B2B API for Multi-Party NFT Trading with Real-Time Discovery**

Transform your platform with sophisticated multi-party bartering capabilities. SWAPS discovers complex trade loops involving multiple participants, dramatically increasing liquidity and trading opportunities.

## 🌟 Key Features

- **🔄 Multi-Party Trade Discovery**: Find complex trade loops (2-10+ participants)
- **⚡ Real-Time Trade Awareness**: Event-driven live graph updates
- **🏢 Multi-Tenant Architecture**: Secure tenant isolation
- **🚀 High Performance**: <500ms average discovery time
- **🔧 Blockchain Agnostic**: Supports Ethereum, Solana, Polygon, and more
- **📊 Advanced Analytics**: Comprehensive trading metrics
- **🔐 Enterprise Security**: API key authentication and rate limiting

## 🚀 Quick Start

### 1. Deploy to Railway (Recommended)

```bash
# Clone the repository
git clone https://github.com/TheMeloMike/SWAPS-White-Label-Service.git
cd SWAPS-White-Label-Service

# Deploy to Railway
chmod +x deploy-to-railway.sh
./deploy-to-railway.sh
```

### 2. Local Development

```bash
# Install dependencies
cd backend
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Start the server
npm start
```

### 3. Docker Deployment

```bash
# Build and run with Docker
docker build -t swaps-white-label-api .
docker run -p 3000:3000 swaps-white-label-api
```

## 📡 API Endpoints

### Health Check
```bash
GET /api/v1/health
```

### Add NFT to Inventory
```bash
POST /api/v1/inventory/nfts
Content-Type: application/json
X-API-Key: your_api_key_here

{
  "nft": {
    "id": "nft_unique_id",
    "metadata": {
      "name": "Cool NFT #123",
      "description": "An awesome NFT",
      "estimatedValueUSD": 1500
    },
    "ownership": {
      "ownerId": "wallet_address"
    },
    "collection": {
      "id": "collection_id",
      "name": "Cool Collection"
    }
  }
}
```

### Discover Trade Loops
```bash
POST /api/v1/trade/discover
Content-Type: application/json
X-API-Key: your_api_key_here

{
  "walletId": "wallet_address",
  "nftId": "nft_id_to_trade",
  "settings": {
    "maxDepth": 5,
    "minEfficiency": 0.8,
    "considerCollections": true
  }
}
```

## 📚 Complete Documentation

- **[📖 API Documentation](./SWAPS_WHITE_LABEL_API_DOCUMENTATION_V2.md)** - Complete API reference
- **[⚡ Performance Report](./backend/SWAPS_PERFORMANCE_REPORT.json)** - Benchmarks and metrics
- **[🧪 Testing Guide](./run-all-tests.sh)** - Run comprehensive test suite

## 🏗️ Architecture Highlights

- **Event-driven persistent graph** vs stateless batch processing
- **Johnson's + Tarjan's algorithms** for cycle detection
- **18-metric trade scoring system** for fairness
- **Horizontal scaling** with 92% linear efficiency
- **Memory-optimized** distributed deployment

## 🔗 Real-Time Webhooks

Configure webhook endpoints to receive instant notifications:

```javascript
// Webhook payload example
{
  "event": "trade_loop_discovered",
  "loopId": "loop_1f2e3d4c5b6a",
  "data": {
    "participants": 3,
    "totalValueUSD": 15750.50,
    "confidence": 0.94,
    "expiresAt": "2025-01-30T12:30:00Z"
  }
}
```

## 💼 Enterprise Features

- **Multi-tenant isolation** with secure API keys
- **Universal NFT ingestion** from all major blockchains
- **Advanced rate limiting** and usage analytics
- **Production monitoring** with SLA compliance
- **Comprehensive error recovery** and rollback systems

## 🧪 Testing

```bash
# Run all tests
npm test

# Run comprehensive system test
./run-all-tests.sh

# Test specific components
npm test src/tests/unit/DIContainer.test.js
```

## 📊 Performance Metrics

- **Discovery Time**: <500ms average
- **Throughput**: 100+ requests/minute per tenant
- **Memory Usage**: ~15KB per NFT (distributed)
- **Scalability**: Linear scaling to 1000+ tenants
- **Uptime**: 99.9% SLA compliance

## 🌐 Deployment Options

### Production Platforms
- **Railway** (recommended for MVP)
- **Heroku** (simple deployment)
- **DigitalOcean** (cost-effective)
- **AWS/GCP/Azure** (enterprise-grade)

### Environment Variables
```bash
NODE_ENV=production
PORT=3000
HELIUS_API_KEY=your_helius_key
WEBHOOK_SECRET=your_webhook_secret
ENABLE_PERSISTENCE=true
DATA_DIR=./data
```

## 🤝 Partner Integration

### JavaScript/Node.js
```javascript
const SwapsAPI = require('@swaps/white-label-sdk');

const client = new SwapsAPI({
  apiKey: 'your_api_key',
  baseURL: 'https://your-deployment.railway.app/api/v1'
});

const result = await client.trade.discover({
  walletId: 'wallet_address',
  nftId: 'wanted_nft_id'
});
```

### Python
```python
import requests

headers = {
    'X-API-Key': 'your_api_key',
    'Content-Type': 'application/json'
}

response = requests.post(
    'https://your-deployment.railway.app/api/v1/trade/discover',
    headers=headers,
    json={'walletId': 'wallet_address', 'nftId': 'wanted_nft_id'}
)
```

## 📧 Support & Contact

- **Technical Support**: [technical-support@swaps.com](mailto:technical-support@swaps.com)
- **Business Development**: [partnerships@swaps.com](mailto:partnerships@swaps.com)
- **Documentation**: [Complete API Docs](./SWAPS_WHITE_LABEL_API_DOCUMENTATION_V2.md)

## 📄 License

Proprietary - Enterprise White Label Service

---

**Ready to transform your NFT platform?** [Contact us for API keys and partnership opportunities](mailto:partnerships@swaps.com) 🚀 
