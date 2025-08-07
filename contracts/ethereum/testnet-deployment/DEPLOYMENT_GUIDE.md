# SWAPS ETHEREUM TESTNET DEPLOYMENT GUIDE

## 🚀 QUICK START DEPLOYMENT

### Prerequisites

1. **Node.js** (v16+) and **npm** (v8+)
2. **Testnet ETH** for deployment
3. **RPC Provider** (Infura, Alchemy, or public RPC)
4. **API Keys** for contract verification

### Step 1: Environment Setup

```bash
# Navigate to testnet deployment directory
cd contracts/ethereum/testnet-deployment

# Install dependencies
npm install

# Copy environment configuration
cp env.example .env
```

### Step 2: Configure Environment

Edit `.env` file with your details:

```env
# Required: RPC URL for your chosen testnet
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID

# Required: Private key for deployment wallet
TESTNET_PRIVATE_KEY=0x1234567890abcdef...

# Optional: API keys for verification
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Step 3: Fund Your Wallet

Get testnet ETH from faucets:

**Sepolia Testnet** (Recommended):
- https://sepoliafaucet.com
- https://faucet.quicknode.com/ethereum/sepolia
- https://faucet.paradigm.xyz

**Goerli Testnet** (Legacy):
- https://goerlifaucet.com
- https://faucet.quicknode.com/ethereum/goerli

**Polygon Mumbai**:
- https://faucet.polygon.technology

### Step 4: Deploy Contract

```bash
# Deploy to Sepolia (recommended)
npm run deploy:sepolia

# Alternative networks
npm run deploy:goerli
npm run deploy:mumbai
npm run deploy:bsc-testnet
```

### Step 5: Verify and Test

```bash
# Run integration tests
npm test

# Verify contract on explorer
npm run verify:sepolia <CONTRACT_ADDRESS>
```

---

## 📋 DETAILED DEPLOYMENT PROCESS

### Network Options

| Network | Chain ID | RPC URL | Faucet | Explorer |
|---------|----------|---------|---------|----------|
| Sepolia | 11155111 | https://sepolia.infura.io/v3/KEY | [sepoliafaucet.com](https://sepoliafaucet.com) | [sepolia.etherscan.io](https://sepolia.etherscan.io) |
| Goerli | 5 | https://goerli.infura.io/v3/KEY | [goerlifaucet.com](https://goerlifaucet.com) | [goerli.etherscan.io](https://goerli.etherscan.io) |
| Mumbai | 80001 | https://rpc-mumbai.maticvigil.com | [faucet.polygon.technology](https://faucet.polygon.technology) | [mumbai.polygonscan.com](https://mumbai.polygonscan.com) |
| BSC Testnet | 97 | https://data-seed-prebsc-1-s1.binance.org:8545 | [testnet.binance.org](https://testnet.binance.org/faucet-smart) | [testnet.bscscan.com](https://testnet.bscscan.com) |

### Deployment Output

After successful deployment, you'll see:

```
✅ Deployment Successful!

📍 Contract Addresses:
   Proxy: 0x1234567890abcdef1234567890abcdef12345678
   Implementation: 0xabcdef1234567890abcdef1234567890abcdef12
   Admin: 0x9876543210fedcba9876543210fedcba98765432

🔗 Explorer Links:
   Proxy: https://sepolia.etherscan.io/address/0x1234...
   Implementation: https://sepolia.etherscan.io/address/0xabcd...

📋 Backend Integration:
   ETHEREUM_CONTRACT_ADDRESS=0x1234567890abcdef1234567890abcdef12345678
   ETHEREUM_NETWORK=sepolia
   ETHEREUM_CHAIN_ID=11155111
```

---

## 🧪 TESTING ON TESTNET

### Automated Testing

```bash
# Run comprehensive test suite
npm test

# Run with gas reporting
npm run test:gas

# Run integration tests only
npx hardhat test test-integration.js --network sepolia
```

### Manual Testing Steps

1. **Contract Verification**
   ```bash
   npx hardhat verify --network sepolia <PROXY_ADDRESS>
   ```

2. **Create Test NFTs**
   - The deployment script automatically creates test ERC721 and ERC1155 contracts
   - Use these for testing multi-party swaps

3. **Test Swap Creation**
   ```javascript
   // Example swap creation
   const swapId = ethers.keccak256(ethers.toUtf8Bytes("test-swap-1"));
   const participants = [
     // ... participant data
   ];
   await swapContract.createSwap(swapId, participants, 24 * 60 * 60);
   ```

4. **Test Approval Process**
   ```javascript
   // Each participant approves
   await swapContract.connect(alice).approveSwap(swapId);
   await swapContract.connect(bob).approveSwap(swapId);
   await swapContract.connect(carol).approveSwap(swapId);
   ```

5. **Test Execution**
   ```javascript
   // Execute atomic swap
   await swapContract.connect(alice).executeSwap(swapId);
   ```

---

## 📊 GAS USAGE EXPECTATIONS

Based on testnet analysis:

| Operation | Gas Usage | Estimated Cost (20 gwei) |
|-----------|-----------|---------------------------|
| Create 3-way swap | ~250,000 | ~0.005 ETH |
| Approve swap | ~50,000 | ~0.001 ETH |
| Execute 3-way swap | ~400,000 | ~0.008 ETH |
| **Total 3-way swap** | **~700,000** | **~0.014 ETH** |

For larger swaps:
- 5-way swap: ~1,000,000 gas (~0.02 ETH)
- 10-way swap: ~1,500,000 gas (~0.03 ETH)

---

## 🔧 TROUBLESHOOTING

### Common Issues

**1. "Insufficient funds for intrinsic transaction cost"**
- Solution: Fund your wallet with more testnet ETH

**2. "Replacement transaction underpriced"**
- Solution: Increase gas price or wait for previous transaction

**3. "Nonce too high"**
- Solution: Reset MetaMask account or use `--reset` flag

**4. "Network request failed"**
- Solution: Check RPC URL and API keys

### Debugging Commands

```bash
# Check account balance
npx hardhat balance --account 0xYourAddress --network sepolia

# List all accounts
npx hardhat accounts --network sepolia

# Get gas price
npx hardhat console --network sepolia
> await ethers.provider.getGasPrice()
```

### Performance Monitoring

Monitor deployment and testing:

```bash
# Enable verbose logging
DEBUG=true npm run deploy:sepolia

# Monitor gas usage
REPORT_GAS=true npm test
```

---

## 🔗 INTEGRATION WITH SWAPS BACKEND

### Environment Variables

Add to your backend `.env`:

```env
# Ethereum Configuration
ETHEREUM_CONTRACT_ADDRESS=0x1234567890abcdef1234567890abcdef12345678
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
ETHEREUM_NETWORK=sepolia
ETHEREUM_CHAIN_ID=11155111

# Optional: For automated operations
ETHEREUM_PAYER_PRIVATE_KEY=0x...
```

### Backend Service Configuration

```typescript
import { EthereumIntegrationService } from './services/blockchain/EthereumIntegrationService';

const ethereumConfig = {
    rpcUrl: process.env.ETHEREUM_RPC_URL!,
    contractAddress: process.env.ETHEREUM_CONTRACT_ADDRESS!,
    network: process.env.ETHEREUM_NETWORK as any,
    payerWallet: process.env.ETHEREUM_PAYER_PRIVATE_KEY ? 
        new ethers.Wallet(process.env.ETHEREUM_PAYER_PRIVATE_KEY) : undefined
};

const ethereumService = EthereumIntegrationService.getInstance(ethereumConfig);
```

### API Testing

Test the integration:

```bash
# Test blockchain info endpoint
curl https://your-api.com/api/v1/blockchain/info

# Test trade discovery with Ethereum format
curl -X POST https://your-api.com/api/v1/blockchain/discovery/trades \
  -H "Content-Type: application/json" \
  -d '{"mode": "executable", "settings": {"blockchainFormat": "ethereum"}}'
```

---

## 🎯 SUCCESS CRITERIA

Your testnet deployment is successful when:

- ✅ Contract deploys without errors
- ✅ All interfaces are supported (ERC721Receiver, ERC1155Receiver)
- ✅ Test NFTs can be minted and approved
- ✅ 3-way swaps execute successfully
- ✅ Gas usage is within expected ranges
- ✅ Contract is verified on block explorer
- ✅ Integration tests pass
- ✅ SWAPS backend can connect and interact

---

## 🚀 NEXT STEPS AFTER TESTNET

1. **Stress Testing**
   - Test with maximum participants (10-way swaps)
   - Test edge cases and error conditions
   - Monitor performance under load

2. **Security Validation**
   - Run security tests
   - Test with malicious inputs
   - Validate all access controls

3. **Integration Testing**
   - Full SWAPS backend integration
   - Frontend wallet integration
   - End-to-end user flows

4. **Performance Optimization**
   - Analyze gas usage patterns
   - Optimize based on real usage data
   - Consider Layer 2 deployment

5. **Mainnet Preparation**
   - Final security audit
   - Mainnet deployment strategy
   - Launch monitoring setup

**Your Ethereum smart contract is now ready for comprehensive testnet validation!** 🎉