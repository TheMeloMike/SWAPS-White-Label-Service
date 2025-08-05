# SWAPS Blockchain Deployment Guide for Render

## 🔐 Security First

**NEVER commit private keys or keypairs to GitHub!**

## 📋 Setup Instructions

### 1. Generate a Blockchain Payer Keypair (Local)

```bash
# Run this locally to generate a keypair
node setup_blockchain_payer.js
```

This will:
- Generate a new Solana keypair
- Request 2 SOL from the devnet faucet
- Save the keypair locally (DO NOT COMMIT!)
- Show you the private key array to use in Render

### 2. Configure Environment Variables in Render

In your Render dashboard, add these environment variables:

```env
# Required for blockchain operations
BLOCKCHAIN_PAYER_PRIVATE_KEY=[217,48,190,111,254,93,44,244,151,132,233,128,42,229,111,159,100,65,1,22,195,145,67,91,111,145,111,98,186,247,133,127,209,231,199,128,128,61,36,70,57,99,204,87,213,217,191,43,62,122,20,189,118,2,255,18,221,39,234,224,225,138,239,138]

# Optional - defaults shown
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=8QhM7mdLqs2mwuNwY4R4UAGiXpLyMg28aih5mZKU2XFD
SOLANA_NETWORK=devnet

# Your existing env vars
ADMIN_API_KEY=swaps_admin_prod_2025_secure_key_abc123
```

### 3. Deploy to Render

1. Commit and push your code changes (keypair files will be ignored)
2. Render will automatically rebuild and deploy
3. The API will now have blockchain execution capabilities!

## 🚀 Testing Blockchain Operations

Once deployed, you can execute real trades:

```bash
# Execute a trade loop on-chain
curl -X POST https://swaps-93hu.onrender.com/api/v1/blockchain/trades/execute \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: YOUR_TENANT_API_KEY' \
  -d '{
    "tradeLoopId": "YOUR_TRADE_LOOP_ID",
    "walletPublicKey": "YOUR_WALLET_ADDRESS",
    "mode": "execute"
  }'
```

## 🔍 Monitoring

- View your payer account: https://explorer.solana.com/address/YOUR_PAYER_PUBLIC_KEY?cluster=devnet
- Monitor program logs: https://explorer.solana.com/address/8QhM7mdLqs2mwuNwY4R4UAGiXpLyMg28aih5mZKU2XFD?cluster=devnet

## ⚠️ Production Considerations

1. **Mainnet Deployment**: Change network to `mainnet-beta` and use real SOL
2. **Key Management**: Consider using a hardware wallet or KMS for production
3. **Multi-sig**: Implement multi-signature for high-value operations
4. **Rate Limiting**: Ensure proper rate limits to prevent fund drainage

## 💰 Funding

The payer account needs SOL for transaction fees:
- Devnet: Use the faucet or `solana airdrop` command
- Mainnet: Purchase SOL from an exchange

Each trade execution costs approximately 0.001-0.003 SOL in fees.