# SWAPS White Label API Documentation v2.0

---

## Introduction

The SWAPS White Label API transforms your NFT trading platform with sophisticated multi-party bartering capabilities. Unlike traditional 1:1 trading, SWAPS discovers complex trade loops involving multiple participants, dramatically increasing liquidity and trading opportunities.

### Key Features

- **🔄 Multi-Party Trade Discovery**: Find complex trade loops (2-10+ participants)
- **⚡ Real-Time Trade Awareness**: Event-driven live graph updates
- **🏢 Multi-Tenant Architecture**: Secure tenant isolation
- **🚀 High Performance**: <500ms average discovery time
- **🔧 Blockchain Agnostic**: Supports Ethereum, Solana, Polygon, and more
- **📊 Advanced Analytics**: Comprehensive trading metrics
- **🔐 Enterprise Security**: API key authentication and rate limiting

---

## Getting Started

### Base URLs

- **Production**: `https://api.swaps.com/api/v1`
- **Staging**: `https://staging-api.swaps.com/api/v1`

### 📦 End-to-End Flow Diagram

```
POST /inventory/nfts (upload NFT inventory)
POST /wants (define what users want)
         ⬇
   [Real-time discovery engine]
         ⬇
   [Webhook: trade_loop_discovered]
         ⬇
GET /trade/loops/:loopId/instructions
         ⬇
   [Execute trade via partner's system]

Sample loopId format: "loop_1f2e3d4c5b6a"
```

### Quick Start

1. **Register as a Partner**: Contact our team to get your tenant credentials
2. **Get API Key**: Receive your unique API key and tenant ID
3. **Set Up Webhooks**: Configure endpoints to receive real-time trade notifications
4. **Start Trading**: Begin uploading NFTs and discovering trade opportunities

---

## Authentication

**All endpoints require this header. Calls without a valid key return 401 Unauthorized.**

```bash
# Required header for every API call
X-API-Key: your_api_key_here
Content-Type: application/json
```

### Example API Call

```bash
curl -X POST https://api.swaps.com/api/v1/inventory/nfts \
  -H "X-API-Key: your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"nft": {...}}'
```

### Getting Your API Key

API keys are provided during the partner onboarding process. Each tenant receives:

- **Tenant ID**: Unique identifier for your organization
- **API Key**: Secret key for API authentication
- **Webhook Secret**: For verifying webhook authenticity

---

## Health & Status

### System Health Check

```http
GET /health
```

**Response:**

```json
{
  "status": "healthy",
  "uptime": "324567s",
  "version": "1.0.0",
  "services": {
    "tradeDiscovery": "operational",
    "webhooks": "operational",
    "persistence": "operational"
  }
}
```

**Error Responses:**

```json
// 500 Internal Server Error
{
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Trade discovery service is temporarily unavailable"
  }
}
```

---

## Core API Endpoints

### 1. NFT Management

### Add NFT to Inventory

```http
POST /inventory/nfts
```

**Request Body:**

```json
{
  "nft": {
    "id": "nft_unique_id",
    "metadata": {
      "name": "Cool NFT #123",
      "description": "An awesome NFT",
      "image": "https://example.com/image.png",
      "tags": ["legendary", "foil", "animated"],
      "estimatedValueUSD": 1500,
      "attributes": [
        {
          "trait_type": "rarity",
          "value": "legendary"
        }
      ]
    },
    "ownership": {
      "ownerId": "wallet_address",
      "ownershipProof": "signature_or_tx_hash"
    },
    "collection": {
      "id": "collection_id",
      "name": "Cool Collection",
      "floorPriceUSD": 1000
    },
    "blockchain": {
      "network": "ethereum",
      "contractAddress": "0x...",
      "tokenId": "123"
    },
    "preferences": {
      "minTradeValue": 1000,
      "preferredCollections": ["premium_collection"],
      "tradingTier": "high_value"
    }
  }
}
```

**Success Response:**

```json
{
  "success": true,
  "data": {
    "nftId": "nft_unique_id",
    "addedAt": "2025-01-30T12:00:00Z",
    "status": "active",
    "discoveredLoops": 3
  }
}
```

**Error Responses:**

```json
// 400 Bad Request
{
  "error": {
    "code": "INVALID_NFT_FORMAT",
    "message": "NFT metadata is missing required 'name' field",
    "details": { "field": "metadata.name", "required": true },
    "timestamp": "2025-01-30T12:00:00Z"
  }
}

// 401 Unauthorized
{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "Missing or invalid API key"
  }
}

// 500 Internal Server Error
{
  "error": {
    "code": "PROCESSING_ERROR",
    "message": "Unexpected server issue. Try again later."
  }
}
```

### Remove NFT from Inventory

```http
DELETE /inventory/nfts/{nftId}
```

**Success Response:**

```json
{
  "success": true,
  "data": {
    "nftId": "nft_unique_id",
    "removedAt": "2025-01-30T12:00:00Z"
  }
}
```

**Error Responses:**

```json
// 404 Not Found
{
  "error": {
    "code": "NFT_NOT_FOUND",
    "message": "NFT not found in inventory"
  }
}
```

### 2. Want Management

### Add Want (Trade Preference)

```http
POST /wants
```

**Request Body:**

```json
{
  "walletId": "wallet_address",
  "wantedNFTId": "target_nft_id",
  "priority": "high",
  "maxOfferedValue": 5000,
  "tags": ["premium", "rare"],
  "preferences": {
    "acceptCollectionTrades": true,
    "preferredCollections": ["collection_1", "collection_2"],
    "excludedCollections": ["spam_collection"],
    "minTradeParticipants": 2,
    "maxTradeParticipants": 5
  }
}
```

**Success Response:**

```json
{
  "success": true,
  "data": {
    "wantId": "want_abc123",
    "createdAt": "2025-01-30T12:00:00Z",
    "status": "active",
    "matchingLoops": 2
  }
}
```

**Error Responses:**

```json
// 400 Bad Request
{
  "error": {
    "code": "INVALID_WANT_FORMAT",
    "message": "Missing required field: walletId"
  }
}

// 429 Too Many Requests
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 45 seconds.",
    "retryAfter": 45
  }
}
```

### Remove Want

```http
DELETE /wants/{wantId}
```

### Get Wallet Wants

```http
GET /wants/wallet/{walletId}
```

**Success Response:**

```json
{
  "success": true,
  "data": {
    "wants": [
      {
        "wantId": "want_abc123",
        "wantedNFTId": "target_nft_id",
        "priority": "high",
        "status": "active",
        "matchingLoops": 2
      }
    ],
    "totalWants": 1
  }
}
```

### 3. Trade Discovery

### Discover Trade Loops

```http
POST /trade/discover
```

**Request Body:**

```json
{
  "walletId": "wallet_address",
  "nftId": "nft_id_to_trade",
  "settings": {
    "maxDepth": 5,
    "minEfficiency": 0.8,
    "maxLoopsPerRequest": 10,
    "considerCollections": true,
    "tradingTier": "high_value"
  }
}
```

**Success Response:**

```json
{
  "success": true,
  "data": {
    "loops": [
      {
        "id": "loop_1f2e3d4c5b6a",
        "steps": [
          {
            "fromWallet": "wallet_1",
            "toWallet": "wallet_2",
            "nftId": "nft_xyz",
            "action": "transfer"
          }
        ],
        "totalParticipants": 3,
        "efficiency": 0.95,
        "qualityScore": 0.92,
        "estimatedValueUSD": 15000,
        "executionComplexity": "moderate",
        "confidence": 0.94,
        "expiresAt": "2025-01-30T12:30:00Z"
      }
    ],
    "totalFound": 1,
    "processingTime": 234
  }
}
```

**Error Responses:**

```json
// 400 Bad Request
{
  "error": {
    "code": "INVALID_DISCOVERY_PARAMS",
    "message": "maxDepth must be between 2 and 10"
  }
}

// 404 Not Found
{
  "error": {
    "code": "WALLET_NOT_FOUND",
    "message": "Wallet not found in system"
  }
}
```

### Get Trade Loop Instructions

```http
GET /trade/loops/{loopId}/instructions
```

**Success Response:**

```json
{
  "success": true,
  "data": {
    "loopId": "loop_1f2e3d4c5b6a",
    "instructions": [
      {
        "step": 1,
        "action": "transfer",
        "fromWallet": "wallet_1",
        "toWallet": "wallet_2",
        "nftId": "nft_xyz",
        "contractAddress": "0x...",
        "tokenId": "123",
        "estimatedGas": 21000
      }
    ],
    "totalSteps": 3,
    "estimatedTotalGas": 63000,
    "executionOrder": "sequential"
  }
}
```

### Get Active Loops

```http
GET /trade/loops/active
```

**Success Response:**

```json
{
  "success": true,
  "data": {
    "activeLoops": [
      {
        "id": "loop_1f2e3d4c5b6a",
        "createdAt": "2025-01-30T12:00:00Z",
        "status": "pending",
        "participants": 3,
        "totalValueUSD": 15000,
        "expiresAt": "2025-01-30T12:30:00Z"
      }
    ],
    "totalActive": 1
  }
}
```

### 4. Tenant Management

### Get Tenant Status

```http
GET /tenant/status
```

**Success Response:**

```json
{
  "success": true,
  "data": {
    "tenantId": "tenant_abc123",
    "name": "Your Company",
    "status": "active",
    "settings": {
      "algorithm": {
        "maxDepth": 5,
        "minEfficiency": 0.8
      },
      "rateLimits": {
        "discoveryRequestsPerMinute": 100,
        "nftSubmissionsPerDay": 10000
      }
    },
    "usage": {
      "totalRequests": 15673,
      "requestsToday": 234,
      "lastRequestAt": "2025-01-30T12:00:00Z"
    },
    "performance": {
      "avgDiscoveryTime": 234,
      "totalLoopsDiscovered": 5432,
      "successRate": 0.97
    }
  }
}
```

### 5. Analytics

### Get Trading Analytics

```http
GET /analytics/trading
```

**Query Parameters:**

- `startDate`: ISO date string
- `endDate`: ISO date string
- `granularity`: "day" | "week" | "month"

**Success Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalLoopsDiscovered": 1234,
      "totalValueTraded": 567890,
      "avgLoopSize": 3.2,
      "successfulTrades": 1100
    },
    "timeSeries": [
      {
        "date": "2025-01-30",
        "loopsDiscovered": 45,
        "valueTraded": 12340,
        "activeUsers": 156
      }
    ],
    "topCollections": [
      {
        "collectionId": "cool_collection",
        "name": "Cool Collection",
        "tradesCount": 234,
        "volumeUSD": 45678
      }
    ]
  }
}
```

**Error Responses:**

```json
// 400 Bad Request
{
  "error": {
    "code": "INVALID_DATE_RANGE",
    "message": "startDate must be before endDate"
  }
}
```

---

## Webhooks

Configure webhook endpoints to receive real-time notifications about trade events.

### Webhook Events

### trade_loop_discovered

Fired when new trade loops are discovered.

**Payload:**

```json
{
  "event": "trade_loop_discovered",
  "loopId": "loop_1f2e3d4c5b6a",
  "timestamp": "2025-01-30T12:00:00Z",
  "tenantId": "tenant_abc123",
  "data": {
    "participants": 3,
    "totalValueUSD": 15750.50,
    "confidence": 0.94,
    "expiresAt": "2025-01-30T12:30:00Z",
    "affectedWallets": ["wallet_x1", "wallet_y2", "wallet_z3"],
    "estimatedGas": 63000
  },
  "signature": "sha256=abc123..."
}
```

### trade_loop_completed

Fired when a trade loop is successfully completed.

**Payload:**

```json
{
  "event": "trade_loop_completed",
  "loopId": "loop_1f2e3d4c5b6a",
  "timestamp": "2025-01-30T12:15:00Z",
  "tenantId": "tenant_abc123",
  "data": {
    "participants": 3,
    "completedAt": "2025-01-30T12:15:00Z",
    "totalValueUSD": 15750.50,
    "actualGasUsed": 58400,
    "transactionHashes": ["0xabc123...", "0xdef456..."]
  }
}
```

### trade_loop_cancelled

Fired when a trade loop is cancelled or expires.

**Payload:**

```json
{
  "event": "trade_loop_cancelled",
  "loopId": "loop_1f2e3d4c5b6a",
  "timestamp": "2025-01-30T12:30:00Z",
  "tenantId": "tenant_abc123",
  "data": {
    "reason": "expired",
    "cancelledAt": "2025-01-30T12:30:00Z"
  }
}
```

### Webhook Reliability

**Retry Policy:**
- Webhooks are retried up to 3 times with exponential backoff: 1s, 4s, 16s
- Failed webhooks are logged for manual replay
- Timeout: 30 seconds per attempt

### Webhook Security

All webhooks include an HMAC signature for verification:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(computedSignature, 'hex')
  );
}
```

---

## Rate Limiting

Rate limits are applied per tenant:

| Endpoint Type | Default Limit | Window |
| --- | --- | --- |
| Trade Discovery | 100 requests | 1 minute |
| NFT Submissions | 10,000 NFTs | 1 day |
| Webhook Calls | 50 calls | 1 minute |
| Analytics | 1,000 requests | 1 hour |

### Rate Limit Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1643723400
```

### Handling Rate Limits

When rate limits are exceeded, the API returns a `429 Too Many Requests` response:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 45 seconds.",
    "retryAfter": 45
  }
}
```

---

## Error Handling

### Standard Error Response Format

**All endpoints use this consistent error format:**

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional error details"
    },
    "timestamp": "2025-01-30T12:00:00Z",
    "requestId": "req_abc123"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
| --- | --- | --- |
| `INVALID_API_KEY` | 401 | Invalid or missing API key |
| `TENANT_NOT_FOUND` | 404 | Tenant ID not found |
| `NFT_NOT_FOUND` | 404 | NFT not found in inventory |
| `WALLET_NOT_FOUND` | 404 | Wallet not found in system |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded |
| `INVALID_REQUEST` | 400 | Invalid request format |
| `INVALID_NFT_FORMAT` | 400 | NFT data format error |
| `INVALID_WANT_FORMAT` | 400 | Want data format error |
| `TRADE_DISCOVERY_FAILED` | 500 | Trade discovery service error |
| `PROCESSING_ERROR` | 500 | Unexpected server issue |

---

## Data Models

### AbstractNFT

```typescript
interface AbstractNFT {
  id: string;
  metadata: {
    name: string;
    description?: string;
    image?: string;
    tags?: string[];                    // Optional: ["legendary", "foil"]
    estimatedValueUSD?: number;         // Optional: 1500
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
  };
  ownership: {
    ownerId: string;
    ownershipProof?: string;
  };
  collection: {
    id: string;
    name: string;
    floorPriceUSD?: number;
  };
  blockchain?: {
    network: BlockchainFormat;
    contractAddress?: string;
    tokenId?: string;
  };
  preferences?: {                       // Optional trading preferences
    minTradeValue?: number;
    preferredCollections?: string[];
    tradingTier?: "standard" | "premium" | "high_value";
  };
}
```

### TradeLoop

```typescript
interface TradeLoop {
  id: string;                          // Format: "loop_1f2e3d4c5b6a"
  steps: TradeStep[];
  totalParticipants: number;
  efficiency: number;                  // 0-1 efficiency score
  qualityScore: number;                // 0-1 quality score
  confidence: number;                  // 0-1 confidence score
  estimatedValueUSD?: number;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  createdAt: Date;
  expiresAt?: Date;
}
```

### TradeStep

```typescript
interface TradeStep {
  fromWallet: string;
  toWallet: string;
  nftId: string;
  action: 'transfer';
  position: number;
  estimatedGas?: number;
}
```

---

## Code Examples

### JavaScript/Node.js

```javascript
const SwapsAPI = require('@swaps/white-label-sdk');

const client = new SwapsAPI({
  apiKey: 'your_api_key',
  baseURL: 'https://api.swaps.com/api/v1'
});

// Add NFT with optional fields
async function addNFT() {
  try {
    const result = await client.inventory.addNFT({
      id: 'nft_123',
      metadata: {
        name: 'Cool NFT #123',
        image: 'https://example.com/image.png',
        tags: ['legendary', 'animated'],
        estimatedValueUSD: 1500
      },
      ownership: {
        ownerId: 'wallet_address'
      },
      collection: {
        id: 'collection_id',
        name: 'Cool Collection'
      },
      preferences: {
        tradingTier: 'high_value',
        minTradeValue: 1000
      }
    });

    console.log('NFT added:', result.data.nftId);
    console.log('Discovered loops:', result.data.discoveredLoops);
  } catch (error) {
    if (error.status === 401) {
      console.error('Authentication failed: Check your API key');
    } else if (error.status === 400) {
      console.error('Invalid NFT format:', error.error.message);
    } else {
      console.error('Error adding NFT:', error.message);
    }
  }
}

// Discover trade loops with error handling
async function discoverTrades() {
  try {
    const loops = await client.trade.discover({
      walletId: 'wallet_address',
      nftId: 'wanted_nft_id',
      settings: {
        maxDepth: 5,
        considerCollections: true,
        tradingTier: 'high_value'
      }
    });

    console.log(`Found ${loops.data.totalFound} trade loops`);
    
    for (const loop of loops.data.loops) {
      console.log(`Loop ${loop.id}: ${loop.totalParticipants} participants`);
      console.log(`Value: $${loop.estimatedValueUSD}, Confidence: ${loop.confidence}`);
      
      // Get execution instructions
      const instructions = await client.trade.getInstructions(loop.id);
      console.log(`Execution steps: ${instructions.data.totalSteps}`);
    }
  } catch (error) {
    if (error.status === 429) {
      console.error(`Rate limited. Retry after ${error.retryAfter} seconds`);
    } else {
      console.error('Trade discovery failed:', error.message);
    }
  }
}

// Webhook handler with signature verification
function handleWebhook(req, res) {
  const signature = req.headers['x-webhook-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!verifyWebhook(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = req.body;
  
  switch (event.event) {
    case 'trade_loop_discovered':
      console.log(`New loop discovered: ${event.loopId}`);
      console.log(`Participants: ${event.data.participants}`);
      console.log(`Value: $${event.data.totalValueUSD}`);
      break;
      
    case 'trade_loop_completed':
      console.log(`Loop completed: ${event.loopId}`);
      break;
      
    case 'trade_loop_cancelled':
      console.log(`Loop cancelled: ${event.loopId}, Reason: ${event.data.reason}`);
      break;
  }
  
  res.status(200).send('OK');
}
```

### Python

```python
import requests
import hmac
import hashlib
import json

class SwapsAPI:
    def __init__(self, api_key, base_url="https://api.swaps.com/api/v1"):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json"
        }

    def add_nft(self, nft_data):
        """Add NFT with comprehensive error handling"""
        try:
            response = requests.post(
                f"{self.base_url}/inventory/nfts",
                headers=self.headers,
                json={"nft": nft_data}
            )
            
            if response.status_code == 401:
                raise Exception("Authentication failed: Check your API key")
            elif response.status_code == 400:
                error_data = response.json()
                raise Exception(f"Invalid NFT format: {error_data['error']['message']}")
            elif response.status_code == 429:
                error_data = response.json()
                raise Exception(f"Rate limited. Retry after {error_data['error']['retryAfter']} seconds")
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"API request failed: {str(e)}")

    def discover_trades(self, wallet_id, nft_id, settings=None):
        """Discover trades with optional settings"""
        payload = {
            "walletId": wallet_id,
            "nftId": nft_id,
            "settings": settings or {
                "maxDepth": 5,
                "considerCollections": True,
                "tradingTier": "high_value"
            }
        }
        
        response = requests.post(
            f"{self.base_url}/trade/discover",
            headers=self.headers,
            json=payload
        )
        
        if response.status_code != 200:
            error_data = response.json()
            raise Exception(f"Discovery failed: {error_data['error']['message']}")
        
        return response.json()

    def get_trade_instructions(self, loop_id):
        """Get execution instructions for a trade loop"""
        response = requests.get(
            f"{self.base_url}/trade/loops/{loop_id}/instructions",
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

# Webhook signature verification
def verify_webhook(payload, signature, secret):
    """Verify webhook signature"""
    computed_signature = hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, f"sha256={computed_signature}")

# Usage example
api = SwapsAPI("your_api_key")

# Add NFT with optional fields
nft_data = {
    "id": "nft_123",
    "metadata": {
        "name": "Cool NFT #123",
        "tags": ["legendary", "animated"],
        "estimatedValueUSD": 1500
    },
    "ownership": {"ownerId": "wallet_address"},
    "collection": {"id": "collection_id", "name": "Cool Collection"},
    "preferences": {
        "tradingTier": "high_value",
        "minTradeValue": 1000
    }
}

try:
    result = api.add_nft(nft_data)
    print(f"NFT added: {result['data']['nftId']}")
    print(f"Discovered loops: {result['data']['discoveredLoops']}")
except Exception as e:
    print(f"Error: {e}")

# Discover trades
try:
    trade_result = api.discover_trades(
        wallet_id="wallet_address",
        nft_id="wanted_nft_id"
    )
    
    loops = trade_result['data']['loops']
    print(f"Found {len(loops)} trade loops")
    
    for loop in loops:
        print(f"Loop {loop['id']}: {loop['totalParticipants']} participants")
        print(f"Value: ${loop['estimatedValueUSD']}, Confidence: {loop['confidence']}")
        
        # Get execution instructions
        instructions = api.get_trade_instructions(loop['id'])
        print(f"Execution steps: {instructions['data']['totalSteps']}")
        
except Exception as e:
    print(f"Discovery failed: {e}")
```

---

## Troubleshooting

### Common Issues

### 1. Authentication Errors

**Symptoms:**
- `401 Unauthorized` responses
- "Missing or invalid API key" errors

**Solutions:**
```bash
# Verify your API key format
curl -X GET https://api.swaps.com/api/v1/health \
  -H "X-API-Key: your_api_key_here"

# Should return 200 OK with system status
```

### 2. Trade Discovery Returns No Results

**Possible Causes:**
- Insufficient NFT inventory
- No matching wants in the system
- Overly restrictive discovery settings

**Solutions:**

```javascript
// Expand search parameters
const result = await client.trade.discover({
  walletId: 'wallet_address',
  nftId: 'wanted_nft_id',
  settings: {
    maxDepth: 8,           // Increase from default 5
    minEfficiency: 0.6,    // Lower from default 0.8
    considerCollections: true,
    maxLoopsPerRequest: 20 // Increase from default 10
  }
});
```

### 3. Webhook Not Receiving Events

**Checklist:**
- ✅ Verify webhook URL is publicly accessible
- ✅ Check webhook secret configuration
- ✅ Ensure proper HTTPS certificate
- ✅ Verify webhook signature validation
- ✅ Check webhook retry logs

**Test Webhook:**

```bash
# Test webhook endpoint accessibility
curl -X POST https://your-webhook-url.com/webhooks/swaps \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### 4. Rate Limit Issues

**Monitor Usage:**

```javascript
// Check rate limit headers in responses
const response = await client.trade.discover(params);
console.log('Remaining requests:', response.headers['x-ratelimit-remaining']);
console.log('Reset time:', new Date(response.headers['x-ratelimit-reset'] * 1000));
```

**Implement Backoff Strategy:**

```javascript
async function discoverWithBackoff(params, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.trade.discover(params);
    } catch (error) {
      if (error.status === 429) {
        const retryAfter = error.retryAfter || Math.pow(2, i) * 1000;
        console.log(`Rate limited. Retrying in ${retryAfter}ms`);
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Performance Guidelines

### Best Practices

1. **Use Webhooks**: Subscribe to real-time events instead of polling
2. **Batch Operations**: Group multiple NFT additions together
3. **Cache Results**: Cache trade loops and analytics data appropriately
4. **Optimize Discovery**: Tune settings based on your use case
5. **Monitor Rate Limits**: Implement proper backoff strategies
6. **Handle Errors Gracefully**: Build robust error handling into your integration

### Recommended Settings by Use Case

### High-Frequency Trading Platform

```json
{
  "maxDepth": 3,
  "minEfficiency": 0.95,
  "maxLoopsPerRequest": 5,
  "considerCollections": false,
  "tradingTier": "high_value"
}
```

### Marketplace Integration

```json
{
  "maxDepth": 5,
  "minEfficiency": 0.8,
  "maxLoopsPerRequest": 10,
  "considerCollections": true,
  "tradingTier": "standard"
}
```

### Portfolio Management

```json
{
  "maxDepth": 8,
  "minEfficiency": 0.6,
  "maxLoopsPerRequest": 20,
  "considerCollections": true,
  "tradingTier": "premium"
}
```

### Performance Monitoring

```javascript
// Monitor API performance
const startTime = Date.now();
const result = await client.trade.discover(params);
const responseTime = Date.now() - startTime;

console.log(`Discovery took ${responseTime}ms`);
console.log(`Found ${result.data.totalFound} loops`);

// Log slow responses for optimization
if (responseTime > 1000) {
  console.warn('Slow discovery response detected');
}
```

---

## Support

### Contact Information

- **Technical Support**: [technical-support@swaps.com](mailto:technical-support@swaps.com)
- **Business Development**: [partnerships@swaps.com](mailto:partnerships@swaps.com)
- **Documentation**: [https://docs.swaps.com](https://docs.swaps.com/)

### Response Times

- **Critical Issues**: 1 hour
- **Standard Issues**: 4 hours
- **General Questions**: 24 hours

### Status Page

Monitor API status and scheduled maintenance: [https://status.swaps.com](https://status.swaps.com/)

---

## Changelog

### v2.0 (Current)
- ✅ Enhanced error handling across all endpoints
- ✅ Complete webhook documentation with retry policy
- ✅ Added optional extensible parameters
- ✅ Comprehensive code examples
- ✅ Added health/status endpoint
- ✅ Improved authentication documentation

### v1.0
- Initial API release
- Basic trade discovery functionality
- NFT and want management
- Webhook support

---

*Last Updated: January 30, 2025 | API Version: 2.0* 