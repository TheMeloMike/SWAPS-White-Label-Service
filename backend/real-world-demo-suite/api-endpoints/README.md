# SWAPS Real-World API Endpoints

## 📡 **New Endpoints for Real Wallet Integration**

These are the additional API endpoints needed to support real-world wallet integration beyond the existing SWAPS backend API.

---

## 🔐 **Wallet Authentication**

### **POST** `/api/v1/wallet/verify`
Verify wallet ownership and establish session

**Request:**
```json
{
  "publicKey": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  "signature": "base64_ed25519_signature",
  "message": "SWAPS_AUTH_2025-01-15T10:30:00Z",
  "network": "devnet"
}
```

**Response:**
```json
{
  "success": true,
  "sessionToken": "jwt_token_here",
  "walletInfo": {
    "address": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    "verified": true,
    "network": "devnet"
  },
  "expiresAt": "2025-01-15T18:30:00Z"
}
```

---

## 🎨 **NFT Detection & Management**

### **GET** `/api/v1/wallet/{address}/nfts`
Automatically detect NFTs owned by a wallet

**Parameters:**
- `address`: Wallet public key
- `network`: `devnet` | `testnet` | `mainnet-beta`
- `collection`: Optional collection filter
- `verified_only`: Only verified collections (default: false)

**Response:**
```json
{
  "success": true,
  "wallet": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  "nfts": [
    {
      "mint": "7xKXtg2CW3SBjZ4ddyJCCJrWKdTJPCfgDSjdyqRqiFFt",
      "name": "Bored Ape #1234",
      "symbol": "BAYC",
      "description": "Bored Ape Yacht Club NFT",
      "image": "https://ipfs.io/ipfs/...",
      "collection": {
        "name": "Bored Ape Yacht Club",
        "verified": true,
        "floorPrice": 15.5
      },
      "attributes": [
        {"trait_type": "Background", "value": "Blue"},
        {"trait_type": "Eyes", "value": "Laser"}
      ],
      "tokenAccount": "TokenAccount_Address_Here",
      "ownership": {
        "verified": true,
        "transferAuthority": "owner"
      }
    }
  ],
  "total": 3,
  "detectedAt": "2025-01-15T10:30:00Z"
}
```

### **POST** `/api/v1/wallet/nfts/refresh`
Force refresh of wallet NFT inventory

**Request:**
```json
{
  "walletAddress": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  "forceUpdate": true
}
```

---

## 🔄 **Trade Management with Signatures**

### **POST** `/api/v1/trades/list`
List NFTs for trading with wallet signature

**Request:**
```json
{
  "walletAddress": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  "nfts": [
    {
      "mint": "7xKXtg2CW3SBjZ4ddyJCCJrWKdTJPCfgDSjdyqRqiFFt",
      "listingSignature": "wallet_signature_approving_listing",
      "preferences": {
        "wantCollections": ["CryptoPunks", "DeGods"],
        "wantSpecific": [],
        "minValue": 10.0,
        "maxValue": 50.0
      }
    }
  ],
  "listingSignature": "master_listing_signature",
  "expiresAt": "2025-01-20T10:30:00Z"
}
```

### **POST** `/api/v1/trades/approve`
Approve a trade step with wallet signature

**Request:**
```json
{
  "tradeId": "trade_abc123",
  "stepIndex": 0,
  "walletAddress": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  "approvalData": {
    "giving": {
      "nft": "7xKXtg2CW3SBjZ4ddyJCCJrWKdTJPCfgDSjdyqRqiFFt",
      "to": "recipient_wallet_address"
    },
    "receiving": {
      "nft": "AaLiLP2rZ5fKQpV2iJ3HdkR6hWpvr3hNuFT7kD2iBUJt",
      "from": "sender_wallet_address"
    }
  },
  "signature": "ed25519_signature_of_approval_data",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "tradeId": "trade_abc123",
  "stepIndex": 0,
  "status": "approved",
  "pendingApprovals": 2,
  "readyForExecution": false,
  "nextSteps": [
    "Waiting for Bob to approve step 1",
    "Waiting for Carol to approve step 2"
  ]
}
```

### **GET** `/api/v1/trades/{tradeId}/status`
Get real-time trade status

**Response:**
```json
{
  "tradeId": "trade_abc123",
  "status": "pending_approvals",
  "participants": [
    {
      "wallet": "Alice_wallet",
      "step": 0,
      "approved": true,
      "approvedAt": "2025-01-15T10:30:00Z"
    },
    {
      "wallet": "Bob_wallet", 
      "step": 1,
      "approved": false,
      "notifiedAt": "2025-01-15T10:32:00Z"
    },
    {
      "wallet": "Carol_wallet",
      "step": 2,
      "approved": false,
      "notifiedAt": "2025-01-15T10:32:00Z"
    }
  ],
  "createdAt": "2025-01-15T10:25:00Z",
  "expiresAt": "2025-01-15T18:25:00Z"
}
```

---

## ⚡ **Real-Time Updates**

### **WebSocket** `/ws/trades/{walletAddress}`
Real-time trade notifications

**Connection:**
```typescript
const ws = new WebSocket('wss://api.swaps.com/ws/trades/9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  // Handle real-time updates
};
```

**Message Types:**
```json
// Trade opportunity found
{
  "type": "trade_opportunity",
  "tradeId": "trade_abc123",
  "message": "New 3-way trade opportunity found!",
  "participants": 3,
  "yourGiving": "Bored Ape #1234",
  "yourReceiving": "CryptoPunk #5678"
}

// Approval needed
{
  "type": "approval_needed",
  "tradeId": "trade_abc123",
  "message": "Please review and approve your trade",
  "expiresIn": 28800
}

// Trade executed
{
  "type": "trade_executed",
  "tradeId": "trade_abc123",
  "transactionHash": "solana_tx_hash",
  "explorerUrl": "https://explorer.solana.com/tx/...",
  "message": "Trade completed successfully!"
}
```

---

## 🔍 **Transaction Monitoring**

### **GET** `/api/v1/transactions/{txHash}/status`
Monitor transaction confirmation

**Response:**
```json
{
  "transactionHash": "solana_tx_hash",
  "status": "confirmed",
  "confirmations": 32,
  "blockHeight": 123456789,
  "explorerUrl": "https://explorer.solana.com/tx/...",
  "tradeDetails": {
    "tradeId": "trade_abc123",
    "participants": 3,
    "nftsTransferred": 3,
    "gasUsed": 0.001234,
    "completedAt": "2025-01-15T10:35:00Z"
  }
}
```

---

## 🛠️ **Integration Examples**

### **Frontend Wallet Integration**
```typescript
// Connect wallet and detect NFTs
const connectWallet = async () => {
  const { publicKey } = await wallet.connect();
  
  // Detect NFTs
  const nfts = await fetch(`/api/v1/wallet/${publicKey}/nfts`);
  
  // Setup real-time updates
  const ws = new WebSocket(`/ws/trades/${publicKey}`);
  ws.onmessage = handleTradeUpdate;
};

// Approve trade with wallet signature
const approveTrade = async (tradeData) => {
  const message = JSON.stringify(tradeData);
  const signature = await wallet.signMessage(message);
  
  await fetch('/api/v1/trades/approve', {
    method: 'POST',
    body: JSON.stringify({
      ...tradeData,
      signature: signature
    })
  });
};
```

### **Backend Integration**
```typescript
// Verify wallet signatures
import nacl from 'tweetnacl';

const verifyWalletSignature = (message: string, signature: Uint8Array, publicKey: PublicKey) => {
  const messageBytes = new TextEncoder().encode(message);
  return nacl.sign.detached.verify(messageBytes, signature, publicKey.toBytes());
};

// Real-time notifications
const notifyTradeOpportunity = (walletAddress: string, tradeData: any) => {
  const ws = getWebSocket(walletAddress);
  ws.send(JSON.stringify({
    type: 'trade_opportunity',
    ...tradeData
  }));
};
```

---

## 🎯 **API Benefits**

### **For Users:**
- ✅ Never share private keys
- ✅ Clear approval process
- ✅ Real-time trade updates
- ✅ Automatic NFT detection

### **For SWAPS:**
- ✅ Scalable to thousands of users
- ✅ Secure signature verification
- ✅ Real-time user engagement
- ✅ Production-ready architecture

### **For Developers:**
- ✅ Standard REST + WebSocket APIs
- ✅ Comprehensive documentation
- ✅ Easy wallet integration
- ✅ TypeScript support

---

**These endpoints transform SWAPS from blockchain infrastructure to user-ready platform! 🚀**