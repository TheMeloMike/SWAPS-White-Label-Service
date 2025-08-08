#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

/**
 * Generate new test wallets for Sepolia testing
 * This script creates new wallets and saves their private keys
 */

console.log('🔑 GENERATING NEW TEST WALLETS FOR SEPOLIA');
console.log('==========================================\n');

// Generate 3 new wallets
const wallets = {
    alice: ethers.Wallet.createRandom(),
    bob: ethers.Wallet.createRandom(),
    carol: ethers.Wallet.createRandom()
};

// Prepare wallet data
const walletData = {};

console.log('📋 NEW WALLET ADDRESSES:\n');
console.log('Please fund these wallets using Sepolia faucets:');
console.log('- https://sepolia-faucet.pk910.de/');
console.log('- https://www.alchemy.com/faucets/ethereum-sepolia');
console.log('- https://faucet.quicknode.com/ethereum/sepolia\n');

for (const [name, wallet] of Object.entries(wallets)) {
    walletData[name] = {
        name: name.charAt(0).toUpperCase() + name.slice(1),
        address: wallet.address,
        privateKey: wallet.privateKey,
        walletId: `${name}_sepolia_test`
    };
    
    console.log(`${walletData[name].name}:`);
    console.log(`  Address: ${wallet.address}`);
    console.log(`  Private Key: ${wallet.privateKey}`);
    console.log('');
}

// Save wallet data to file
const walletFile = path.join(__dirname, 'test-wallets-sepolia.json');
fs.writeFileSync(walletFile, JSON.stringify(walletData, null, 2));

console.log(`\n✅ Wallet data saved to: ${walletFile}`);

// Also create a secure backup with timestamp
const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
const backupFile = path.join(__dirname, `wallet-backup-${timestamp}.json`);
fs.writeFileSync(backupFile, JSON.stringify(walletData, null, 2));

console.log(`✅ Backup saved to: ${backupFile}`);

// Create an updated real-sepolia-3way-execution script with new wallets
const executionScript = `#!/usr/bin/env node

/**
 * REAL SEPOLIA 3-WAY TRADE EXECUTION WITH NEW WALLETS
 * Generated on: ${new Date().toISOString()}
 */

const axios = require('axios');
const { ethers } = require('ethers');

class RealSepolia3WayExecution {
    constructor() {
        this.apiBaseUrl = 'https://swaps-93hu.onrender.com';
        this.adminApiKey = 'swaps_admin_prod_2025_secure_key_abc123';
        
        // New test wallets - FUND THESE WITH SEPOLIA ETH
        this.wallets = ${JSON.stringify(walletData, null, 8).split('\n').map((line, i) => i === 0 ? line : '        ' + line).join('\n')};
        
        // Initialize Ethereum provider
        this.provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
        
        this.tenant = null;
        this.tradeLoopId = null;
        this.swapId = null;
    }

    async makeAPICall(method, endpoint, data = null, headers = {}) {
        try {
            const config = {
                method,
                url: \`\${this.apiBaseUrl}\${endpoint}\`,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            };

            if (data) {
                config.data = data;
            }

            console.log(\`🔄 \${method.toUpperCase()} \${endpoint}\`);
            const response = await axios(config);
            console.log('✅ Success');
            return response.data;
        } catch (error) {
            console.error(\`❌ API call failed: \${error.response?.status} - \${error.response?.data?.error || error.message}\`);
            if (error.response?.data) {
                console.error('   Details:', JSON.stringify(error.response.data, null, 2));
            }
            throw error;
        }
    }

    async createTestNFTs() {
        console.log('\\n📦 Setting up test NFTs for demonstration...');
        console.log('ℹ️  Note: Using mock contract address for testing');
        console.log('   In production, these would be real NFT contracts on Sepolia\\n');

        // For this test, we'll use a mock contract address
        const mockContractAddress = '0x1234567890123456789012345678901234567890';
        
        return {
            alice: {
                contractAddress: mockContractAddress,
                tokenId: '2001'
            },
            bob: {
                contractAddress: mockContractAddress,
                tokenId: '2002'
            },
            carol: {
                contractAddress: mockContractAddress,
                tokenId: '2003'
            }
        };
    }

    async step1_CreateEthereumTenant() {
        console.log('\\n📋 STEP 1: CREATE ETHEREUM TENANT');
        console.log('=================================\\n');

        const tenantData = {
            name: 'New Wallets Sepolia Test',
            contactEmail: 'newwallets@sepolia.test',
            industry: 'production_test',
            blockchainSettings: {
                preferred: 'ethereum',
                allowSwitching: false,
                ethereumNetwork: 'sepolia'
            },
            algorithmSettings: {
                maxDepth: 3,
                enableCollectionTrading: true,
                enableCanonicalDiscovery: true
            }
        };

        const response = await this.makeAPICall('POST', '/api/v1/admin/tenants', tenantData, {
            'Authorization': \`Bearer \${this.adminApiKey}\`
        });

        if (response?.success) {
            this.tenant = {
                id: response.tenant.id,
                apiKey: response.tenant.apiKey
            };
            
            console.log(\`✅ Tenant created: \${this.tenant.id}\`);
            console.log(\`🔑 API Key: \${this.tenant.apiKey}\`);
            return true;
        }

        throw new Error('Failed to create tenant');
    }

    async step2_SubmitNFTInventories() {
        console.log('\\n📋 STEP 2: SUBMIT NFT INVENTORIES');
        console.log('=================================\\n');

        const headers = { 'Authorization': \`Bearer \${this.tenant.apiKey}\` };
        const nftContracts = await this.createTestNFTs();

        for (const [name, wallet] of Object.entries(this.wallets)) {
            console.log(\`\\n👤 \${wallet.name} (\${wallet.address})\`);
            
            const nftInfo = nftContracts[name];
            const inventory = {
                walletId: wallet.walletId,
                nfts: [{
                    id: \`new_\${name}_nft\`,
                    metadata: {
                        name: \`\${wallet.name} Sepolia NFT\`,
                        description: \`Test NFT for Sepolia execution\`,
                        image: \`https://example.com/\${name}-nft.png\`
                    },
                    ownership: {
                        ownerId: wallet.walletId
                    },
                    valuation: {
                        estimatedValue: 0.01,
                        currency: 'ETH'
                    },
                    platformData: {
                        blockchain: 'ethereum',
                        network: 'sepolia',
                        contractAddress: nftInfo.contractAddress,
                        tokenId: nftInfo.tokenId,
                        walletAddress: wallet.address
                    }
                }]
            };

            await this.makeAPICall('POST', '/api/v1/inventory/submit', inventory, headers);
            console.log(\`   ✅ \${wallet.name}'s inventory submitted\`);
        }

        console.log('\\n✅ All inventories submitted successfully');
        return true;
    }

    async step3_CreatePerfect3WayLoop() {
        console.log('\\n📋 STEP 3: CREATE PERFECT 3-WAY TRADE LOOP');
        console.log('==========================================\\n');

        const headers = { 'Authorization': \`Bearer \${this.tenant.apiKey}\` };

        // Alice wants Bob's NFT
        await this.makeAPICall('POST', '/api/v1/wants/submit', {
            walletId: this.wallets.alice.walletId,
            wantedNFTs: ['new_bob_nft']
        }, headers);
        console.log('✅ Alice wants Bob\\'s NFT');

        // Bob wants Carol's NFT  
        await this.makeAPICall('POST', '/api/v1/wants/submit', {
            walletId: this.wallets.bob.walletId,
            wantedNFTs: ['new_carol_nft']
        }, headers);
        console.log('✅ Bob wants Carol\\'s NFT');

        // Carol wants Alice's NFT (COMPLETES THE LOOP!)
        const response = await this.makeAPICall('POST', '/api/v1/wants/submit', {
            walletId: this.wallets.carol.walletId,
            wantedNFTs: ['new_alice_nft']
        }, headers);
        console.log('✅ Carol wants Alice\\'s NFT');

        if (response?.success && response.newLoopsDiscovered > 0) {
            this.tradeLoopId = response.loops[0].id;
            console.log('\\n🎉 PERFECT 3-WAY TRADE LOOP DISCOVERED!');
            console.log(\`🔗 Trade Loop ID: \${this.tradeLoopId}\`);
            return true;
        }

        throw new Error('Failed to create 3-way trade loop');
    }

    async step4_PrepareAndSignTransaction() {
        console.log('\\n📋 STEP 4: PREPARE AND SIGN REAL TRANSACTION');
        console.log('============================================\\n');

        const headers = { 'Authorization': \`Bearer \${this.tenant.apiKey}\` };

        // Step 4.1: Prepare CREATE transaction
        console.log('📝 Preparing CREATE transaction...');
        const prepareResponse = await this.makeAPICall('POST', '/api/v2/blockchain/trades/prepare', {
            tradeLoopId: this.tradeLoopId,
            operation: 'create',
            userAddress: this.wallets.alice.address,
            walletId: this.wallets.alice.walletId
        }, headers);

        if (!prepareResponse?.success || !prepareResponse.transaction) {
            throw new Error('Failed to prepare transaction');
        }

        const txData = prepareResponse.transaction;
        this.swapId = prepareResponse.metadata?.swapId;

        console.log('✅ Transaction prepared!');
        console.log(\`   To: \${txData.to}\`);
        console.log(\`   Data: \${txData.data?.slice(0, 50)}...\`);
        console.log(\`   Gas Limit: \${txData.gasLimit}\`);
        console.log(\`   Swap ID: \${this.swapId?.slice(0, 20)}...\`);

        // Step 4.2: Sign transaction with Alice's private key
        console.log('\\n🖊️  Signing transaction with Alice\\'s private key...');

        const signer = new ethers.Wallet(this.wallets.alice.privateKey, this.provider);
        
        // Get current gas price and ensure it's reasonable for Sepolia
        const feeData = await this.provider.getFeeData();
        let gasPrice = feeData.gasPrice;
        
        // Ensure minimum gas price for Sepolia (at least 20 Gwei)
        const minGasPrice = ethers.parseUnits('20', 'gwei');
        if (gasPrice < minGasPrice) {
            gasPrice = minGasPrice;
        }
        
        console.log(\`⛽ Gas price: \${ethers.formatUnits(gasPrice, 'gwei')} Gwei\`);

        // Prepare transaction object
        const transaction = {
            to: txData.to,
            data: txData.data,
            gasLimit: txData.gasLimit || 300000,
            gasPrice: gasPrice,
            value: txData.value || '0x0',
            nonce: await this.provider.getTransactionCount(this.wallets.alice.address)
        };
        
        // Estimate transaction cost
        const estimatedCost = gasPrice * BigInt(transaction.gasLimit);
        console.log(\`💰 Estimated transaction cost: \${ethers.formatEther(estimatedCost)} ETH\`);
        
        // Check if wallet has enough balance
        const balance = await this.provider.getBalance(this.wallets.alice.address);
        if (balance < estimatedCost) {
            console.error(\`❌ Insufficient funds!\`);
            console.error(\`   Balance: \${ethers.formatEther(balance)} ETH\`);
            console.error(\`   Required: \${ethers.formatEther(estimatedCost)} ETH\`);
            console.error(\`   Please add more ETH to Alice's wallet on Sepolia\`);
            throw new Error('Insufficient funds for transaction');
        }

        // Sign and send transaction
        console.log('📡 Broadcasting transaction to Sepolia...');
        const txResponse = await signer.sendTransaction(transaction);
        
        console.log(\`\\n🎉 TRANSACTION BROADCAST SUCCESSFUL!\`);
        console.log(\`🔗 Transaction Hash: \${txResponse.hash}\`);
        console.log(\`🌐 Etherscan: https://sepolia.etherscan.io/tx/\${txResponse.hash}\`);

        // Step 4.3: Record transaction with API
        console.log('\\n📡 Recording transaction with API...');
        await this.makeAPICall('POST', '/api/v2/blockchain/trades/broadcast', {
            tradeLoopId: this.tradeLoopId,
            transactionHash: txResponse.hash,
            operation: 'create'
        }, headers);
        
        console.log('✅ Transaction recorded');

        // Step 4.4: Wait for confirmation
        console.log('\\n⏳ Waiting for transaction confirmation...');
        const receipt = await txResponse.wait();
        
        console.log(\`✅ Transaction confirmed!\`);
        console.log(\`   Block: \${receipt.blockNumber}\`);
        console.log(\`   Gas Used: \${receipt.gasUsed.toString()}\`);
        console.log(\`   Status: \${receipt.status === 1 ? 'SUCCESS' : 'FAILED'}\`);

        return txResponse.hash;
    }

    async step5_CheckTransactionStatus() {
        console.log('\\n📋 STEP 5: CHECK TRANSACTION STATUS');
        console.log('==================================\\n');

        const headers = { 'Authorization': \`Bearer \${this.tenant.apiKey}\` };

        try {
            const response = await this.makeAPICall('GET', \`/api/v1/blockchain/trades/status/\${this.tradeLoopId}\`, null, headers);
            
            if (response?.success) {
                console.log('📊 Trade Status:', response.status);
                console.log('🔗 Trade Loop:', response.tradeLoop?.id);
                console.log('⏰ Created:', response.createdAt);
                
                if (response.blockchain) {
                    console.log('\\n⛓️  Blockchain Status:');
                    console.log(\`   State: \${response.blockchain.state}\`);
                    console.log(\`   Participants: \${response.blockchain.participants}\`);
                    console.log(\`   Approvals: \${response.blockchain.approvals}\`);
                }
            }
        } catch (error) {
            console.log('ℹ️  Status endpoint may not be available for V2 trades');
        }
    }

    async run() {
        console.log('🚀 REAL SEPOLIA 3-WAY TRADE EXECUTION');
        console.log('====================================');
        console.log('⚠️  This will execute a REAL transaction on Sepolia testnet');
        console.log('💰 Make sure your wallets have enough ETH for gas fees\\n');

        console.log('📋 WALLET ADDRESSES:');
        Object.values(this.wallets).forEach(wallet => {
            console.log(\`   \${wallet.name}: \${wallet.address}\`);
        });

        try {
            // Check wallet balances first
            console.log('\\n💰 Checking wallet balances...');
            let totalBalance = 0;
            for (const wallet of Object.values(this.wallets)) {
                const balance = await this.provider.getBalance(wallet.address);
                const ethBalance = parseFloat(ethers.formatEther(balance));
                totalBalance += ethBalance;
                console.log(\`   \${wallet.name}: \${ethers.formatEther(balance)} ETH\`);
                
                if (balance < ethers.parseEther('0.01')) {
                    console.warn(\`   ⚠️  \${wallet.name} has low balance! Needs at least 0.01 ETH for gas\`);
                }
            }
            
            if (totalBalance < 0.01) {
                console.error('\\n❌ WALLETS NOT FUNDED!');
                console.error('Please fund the wallets using a Sepolia faucet before continuing.');
                console.error('\\nRecommended faucets:');
                console.error('- https://sepolia-faucet.pk910.de/');
                console.error('- https://www.alchemy.com/faucets/ethereum-sepolia');
                console.error('- https://faucet.quicknode.com/ethereum/sepolia');
                return;
            }

            // Execute all steps
            await this.step1_CreateEthereumTenant();
            await this.step2_SubmitNFTInventories();
            await this.step3_CreatePerfect3WayLoop();
            const txHash = await this.step4_PrepareAndSignTransaction();
            await this.step5_CheckTransactionStatus();

            // Final summary
            console.log('\\n🏆 EXECUTION COMPLETE!');
            console.log('====================');
            console.log('✅ Real transaction executed on Sepolia');
            console.log(\`🔗 Transaction: https://sepolia.etherscan.io/tx/\${txHash}\`);
            console.log('🎯 3-way trade loop created via smart contract');
            console.log('💰 Gas paid by user (Alice)');
            console.log('🚀 Platform ready for multi-party NFT trading!');
            
            console.log('\\n📝 NEXT STEPS:');
            console.log('1. Other participants would call approve endpoint');
            console.log('2. After all approvals, execute endpoint completes the swap');
            console.log('3. NFTs are atomically exchanged between all 3 wallets');

        } catch (error) {
            console.error('\\n💥 Execution failed:', error.message);
            if (error.response?.data) {
                console.error('API Error:', JSON.stringify(error.response.data, null, 2));
            }
        }
    }
}

// Execute the real Sepolia test
console.log('⚡ STARTING REAL SEPOLIA 3-WAY TRADE EXECUTION...\\n');

const test = new RealSepolia3WayExecution();
test.run().catch(console.error);
`;

const newScriptFile = path.join(__dirname, 'new-wallets-sepolia-execution.js');
fs.writeFileSync(newScriptFile, executionScript);

console.log(`\n✅ New execution script created: ${newScriptFile}`);

console.log('\n📋 NEXT STEPS:');
console.log('1. Fund the wallets above using Sepolia faucets (at least 0.01 ETH each)');
console.log('2. Run: node new-wallets-sepolia-execution.js');
console.log('3. The script will execute a real 3-way trade on Sepolia!\n');

console.log('⚠️  IMPORTANT: Keep the private keys secure!');
console.log('These are testnet wallets, but always practice good security.\n');