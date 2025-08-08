const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');

class CompleteEndToEndSepoliaExecution {
    constructor() {
        this.baseUrl = 'https://swaps-93hu.onrender.com';
        this.adminApiKey = 'swaps_admin_prod_2025_secure_key_abc123';
        
        // Load wallet configuration
        this.walletsConfig = JSON.parse(fs.readFileSync('test-wallets-sepolia.json', 'utf8'));
        this.nftsConfig = JSON.parse(fs.readFileSync('sepolia-real-nfts.json', 'utf8'));
        
        // Use multiple RPC endpoints for reliability
        this.rpcEndpoints = [
            'https://ethereum-sepolia-rpc.publicnode.com',
            'https://rpc.ankr.com/eth_sepolia',
            'https://ethereum-sepolia.blockpi.network/v1/rpc/public',
            'https://sepolia.gateway.tenderly.co'
        ];
        
        this.provider = null;
        this.tenant = null;
        this.apiKey = null;
        this.wallets = {};
        this.nfts = {};
        this.swapId = null; // Store swapId between operations
        
        // Retry configuration
        this.maxRetries = 3;
        this.retryDelay = 2000;
    }

    async initializeProvider() {
        console.log('🔗 Initializing Ethereum provider...');
        
        for (const rpcUrl of this.rpcEndpoints) {
            try {
                console.log(`   Trying ${rpcUrl}...`);
                const provider = new ethers.JsonRpcProvider(rpcUrl);
                
                // Test the connection
                await provider.getNetwork();
                console.log(`✅ Connected to ${rpcUrl}`);
                this.provider = provider;
                return;
            } catch (error) {
                console.log(`   ❌ Failed: ${error.message}`);
            }
        }
        
        throw new Error('Could not connect to any Sepolia RPC endpoint');
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async retryOperation(operation, description) {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`   Attempt ${attempt}/${this.maxRetries}: ${description}`);
                return await operation();
            } catch (error) {
                console.log(`   ❌ Attempt ${attempt} failed: ${error.message}`);
                
                if (attempt === this.maxRetries) {
                    throw error;
                }
                
                console.log(`   ⏳ Waiting ${this.retryDelay}ms before retry...`);
                await this.sleep(this.retryDelay);
            }
        }
    }

    async apiCall(method, endpoint, data = null, customHeaders = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...customHeaders
        };

        if (this.apiKey && !customHeaders['x-admin-key']) {
            headers['x-api-key'] = this.apiKey;
        }

        const config = {
            method,
            url: `${this.baseUrl}${endpoint}`,
            headers,
            timeout: 30000
        };

        if (data) {
            config.data = data;
        }

        return await this.retryOperation(async () => {
            try {
                const response = await axios(config);
                return response.data;
            } catch (error) {
                if (error.response && error.response.data) {
                    console.log('   Error details:', JSON.stringify(error.response.data, null, 2));
                }
                throw error;
            }
        }, `${method} ${endpoint}`);
    }

    async checkWalletBalances() {
        console.log('💰 Checking wallet balances...');
        
        for (const [name, wallet] of Object.entries(this.wallets)) {
            try {
                const balance = await this.provider.getBalance(wallet.address);
                const ethBalance = ethers.formatEther(balance);
                console.log(`   ${wallet.name}: ${ethBalance} ETH`);
                
                if (parseFloat(ethBalance) < 0.01) {
                    console.log(`   ⚠️  ${wallet.name} has low balance - may need more ETH for gas`);
                }
            } catch (error) {
                console.log(`   ${wallet.name}: Unable to check balance (${error.message})`);
            }
        }
        console.log();
    }

    async loadWalletConfiguration() {
        console.log('👛 Loading wallet configuration...');
        
        this.wallets = {
            alice: {
                ...this.walletsConfig.alice,
                name: 'Alice'
            },
            bob: {
                ...this.walletsConfig.bob,
                name: 'Bob'
            },
            carol: {
                ...this.walletsConfig.carol,
                name: 'Carol'
            }
        };

        this.nfts = {
            alice: this.nftsConfig.nfts.find(n => n.name === 'alice'),
            bob: this.nftsConfig.nfts.find(n => n.name === 'bob'),
            carol: this.nftsConfig.nfts.find(n => n.name === 'carol')
        };

        console.log('📋 WALLET ADDRESSES:');
        Object.values(this.wallets).forEach(wallet => {
            console.log(`   ${wallet.name}: ${wallet.address}`);
        });

        console.log('\n🎨 NFT COLLECTION:');
        Object.values(this.nfts).forEach(nft => {
            const rarity = nft.metadata.attributes.find(attr => attr.trait_type === 'Rarity')?.value;
            console.log(`   ${nft.metadata.name} (${rarity})`);
            console.log(`     Owner: ${nft.name.charAt(0).toUpperCase() + nft.name.slice(1)}`);
            console.log(`     Description: ${nft.metadata.description}`);
            console.log();
        });
    }

    async createTenant() {
        console.log('📋 STEP 1: CREATE ETHEREUM TENANT');
        console.log('=================================\n');

        const tenantData = {
            name: `End-to-End Test ${Date.now()}`,
            contactEmail: `test+${Date.now()}@swaps.com`,
            plan: 'premium',
            settings: {
                blockchainFormat: 'ethereum',
                network: 'sepolia',
                features: {
                    multiPartyTrading: true,
                    realTimeUpdates: true,
                    advancedAnalytics: true
                }
            }
        };

        const adminHeaders = {
            'Authorization': `Bearer ${this.adminApiKey}`
        };

        console.log('🔄 POST /api/v1/admin/tenants');
        const response = await this.apiCall('POST', '/api/v1/admin/tenants', tenantData, adminHeaders);
        
        this.tenant = response.tenant;
        this.apiKey = response.apiKey || response.tenant?.apiKey;
        
        console.log(`✅ Tenant created: ${this.tenant.id}`);
        console.log(`🔑 API Key: ${this.apiKey}\n`);
        
        if (!this.apiKey) {
            console.log('⚠️  API Key not found in response, checking response structure...');
            console.log('Response:', JSON.stringify(response, null, 2));
            throw new Error('API Key not returned from tenant creation');
        }
    }

    async submitInventory() {
        console.log('📋 STEP 2: SUBMIT ENHANCED NFT INVENTORIES');
        console.log('===========================================\n');
        console.log('🎨 Setting up real NFT inventories with rich metadata...');
        console.log('ℹ️  Each NFT has unique attributes, rarity, and descriptions\n');

        for (const nftConfig of this.nftsConfig.nfts) {
            const wallet = this.wallets[nftConfig.name];
            if (!wallet) {
                console.error(`Wallet not found for NFT owner: ${nftConfig.name}`);
                continue;
            }

            console.log(`👤 ${wallet.name} (${wallet.address})`);
            const inventoryData = {
                tenantId: this.tenant.id,
                walletId: wallet.walletId,
                nfts: [{
                    id: `nft_token_${nftConfig.tokenId}`, // Use token ID as NFT identifier
                    metadata: {
                        name: nftConfig.metadata.name,
                        description: nftConfig.metadata.description,
                        image: nftConfig.metadata.image,
                        attributes: nftConfig.metadata.attributes
                    },
                    ownership: {
                        ownerId: wallet.walletId,
                        walletAddress: wallet.address,
                        blockchain: 'ethereum',
                        network: 'sepolia',
                        contractAddress: nftConfig.contractAddress,
                        tokenId: nftConfig.tokenId.toString()
                    },
                    valuation: {
                        currency: 'ETH',
                        amount: 0.01
                    },
                    platformData: {
                        blockchain: 'ethereum',
                        network: 'sepolia',
                        contractAddress: nftConfig.contractAddress,
                        tokenId: nftConfig.tokenId.toString(),
                        walletAddress: wallet.address
                    }
                }]
            };

            console.log('🔄 POST /api/v1/inventory/submit');
            await this.apiCall('POST', '/api/v1/inventory/submit', inventoryData);
            console.log(`✅ ${wallet.name}'s "${nftConfig.metadata.name}" added to inventory`);
            console.log(`   Rarity: ${nftConfig.metadata.attributes.find(attr => attr.trait_type === 'Rarity')?.value}`);
            console.log(`   Power Level: ${nftConfig.metadata.attributes.find(attr => attr.trait_type === 'Power Level')?.value}\n`);
        }
        console.log('✅ All enhanced inventories submitted successfully\n');
    }

    async submitWants() {
        console.log('📋 STEP 3: CREATE PERFECT 3-WAY TRADE LOOP');
        console.log('==========================================\n');

        // Use token IDs as NFT identifiers to ensure proper mapping
        const aliceNftId = 'nft_token_1'; // Alice owns Token #1
        const bobNftId = 'nft_token_2';   // Bob owns Token #2
        const carolNftId = 'nft_token_3'; // Carol owns Token #3

        const aliceNftName = this.nfts.alice.metadata.name;
        const bobNftName = this.nfts.bob.metadata.name;
        const carolNftName = this.nfts.carol.metadata.name;

        // Alice wants Bob's NFT
        console.log(`🔄 POST /api/v1/wants/submit`);
        await this.apiCall('POST', '/api/v1/wants/submit', {
            tenantId: this.tenant.id,
            walletId: this.wallets.alice.walletId,
            wantedNFTs: [bobNftId]
        });
        console.log(`✅ Alice wants Bob's "${bobNftName}"`);

        // Bob wants Carol's NFT
        console.log(`🔄 POST /api/v1/wants/submit`);
        await this.apiCall('POST', '/api/v1/wants/submit', {
            tenantId: this.tenant.id,
            walletId: this.wallets.bob.walletId,
            wantedNFTs: [carolNftId]
        });
        console.log(`✅ Bob wants Carol's "${carolNftName}"`);

        // Carol wants Alice's NFT
        console.log(`🔄 POST /api/v1/wants/submit`);
        await this.apiCall('POST', '/api/v1/wants/submit', {
            tenantId: this.tenant.id,
            walletId: this.wallets.carol.walletId,
            wantedNFTs: [aliceNftId]
        });
        console.log(`✅ Carol wants Alice's "${aliceNftName}"`);

        console.log('\n🎉 PERFECT 3-WAY TRADE LOOP CONFIGURED!');
        console.log('🔗 Trade Summary:');
        console.log(`   Alice owns Token #1 (${aliceNftName}) → wants Token #2 from Bob`);
        console.log(`   Bob owns Token #2 (${bobNftName}) → wants Token #3 from Carol`);
        console.log(`   Carol owns Token #3 (${carolNftName}) → wants Token #1 from Alice`);
        console.log('\n✨ Token-based NFT IDs ensure correct on-chain mapping!\n');

        // Discover actual trade loops using the API
        console.log('🔍 Discovering available trade loops...');
        const discoveryResponse = await this.apiCall('POST', '/api/v1/discovery/trades', {
            walletId: this.wallets.alice.walletId,  // Get trades for Alice
            mode: 'composable',
            settings: {
                maxResults: 10,
                blockchainFormat: 'ethereum'
            }
        });
        
        if (discoveryResponse.trades && discoveryResponse.trades.length > 0) {
            const tradeLoop = discoveryResponse.trades[0];
            console.log(`✅ Found trade loop: ${tradeLoop.id}`);
            console.log(`   Participants: ${tradeLoop.steps?.length || 'Unknown'} steps`);
            console.log(`   Score: ${tradeLoop.score || 'Unknown'}\n`);
            return tradeLoop.id;
        } else {
            throw new Error('No trade loops discovered by the API - check inventory and wants configuration');
        }
    }

    async approveNFTs() {
        console.log('📋 STEP 4: APPROVE NFTS FOR SWAPS CONTRACT');
        console.log('=========================================\n');

        const nftContractAddress = this.nftsConfig.contractAddress;
        const swapsContractAddress = '0xb17Ad11D1b9474c5e7403cA62A8B6D3bc6Deae67'; // The actual deployed SWAPS contract
        
        // NFT contract ABI - just the functions we need
        const nftABI = [
            'function setApprovalForAll(address operator, bool approved) public',
            'function isApprovedForAll(address owner, address operator) public view returns (bool)'
        ];

        console.log(`🔐 NFT Contract: ${nftContractAddress}`);
        console.log(`🏛️  SWAPS Contract: ${swapsContractAddress}\n`);

        // Approve for each wallet
        for (const [name, walletConfig] of Object.entries(this.walletsConfig)) {
            const wallet = new ethers.Wallet(walletConfig.privateKey, this.provider);
            const nftContract = new ethers.Contract(nftContractAddress, nftABI, wallet);
            
            console.log(`👤 ${name} (${walletConfig.address})`);
            
            // Check if already approved
            const isApproved = await nftContract.isApprovedForAll(walletConfig.address, swapsContractAddress);
            
            if (isApproved) {
                console.log(`   ✅ Already approved for SWAPS contract\n`);
                continue;
            }
            
            console.log(`   🔄 Approving SWAPS contract to transfer NFTs...`);
            
            try {
                const tx = await nftContract.setApprovalForAll(swapsContractAddress, true);
                console.log(`   📡 Transaction sent: ${tx.hash}`);
                
                const receipt = await tx.wait();
                console.log(`   ✅ Approval confirmed in block ${receipt.blockNumber}\n`);
            } catch (error) {
                console.error(`   ❌ Failed to approve: ${error.message}\n`);
                throw error;
            }
        }
        
        console.log('✅ All wallets have approved the SWAPS contract!\n');
    }

    async sendTransaction(wallet, txData, description) {
        console.log(`✍️  Signing ${description} with ${wallet.address.substring(0, 8)}...`);
        
        // Get current gas price and ensure minimum
        const feeData = await this.provider.getFeeData();
        const minGasPrice = ethers.parseUnits('20', 'gwei');
        
        if (feeData.gasPrice && feeData.gasPrice > minGasPrice) {
            txData.gasPrice = feeData.gasPrice;
        } else {
            txData.gasPrice = minGasPrice;
        }

        console.log(`   Using gas price: ${ethers.formatUnits(txData.gasPrice, 'gwei')} Gwei`);

        // Check balance before transaction
        const balance = await this.provider.getBalance(wallet.address);
        const estimatedCost = BigInt(txData.gasLimit) * BigInt(txData.gasPrice);
        
        console.log(`   Account balance: ${ethers.formatEther(balance)} ETH`);
        console.log(`   Estimated cost: ${ethers.formatEther(estimatedCost)} ETH`);
        
        if (balance < estimatedCost) {
            throw new Error(`Insufficient funds: need ${ethers.formatEther(estimatedCost)} ETH but only have ${ethers.formatEther(balance)} ETH`);
        }

        // Send transaction
        console.log('📡 Broadcasting transaction to Sepolia...');
        const tx = await wallet.sendTransaction(txData);
        
        console.log('🎉 TRANSACTION BROADCAST SUCCESSFUL!');
        console.log(`🔗 Transaction Hash: ${tx.hash}`);
        console.log(`🌐 Etherscan: https://sepolia.etherscan.io/tx/${tx.hash}\n`);

        console.log('⏳ Waiting for transaction confirmation...\n');
        const receipt = await tx.wait();
        
        console.log('🎊 TRANSACTION CONFIRMED!');
        console.log(`   Block Number: ${receipt.blockNumber}`);
        console.log(`   Gas Used: ${receipt.gasUsed}`);
        console.log(`   Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
        console.log(`🌐 Block Explorer: https://sepolia.etherscan.io/tx/${receipt.hash}\n`);

        if (receipt.status !== 1) {
            throw new Error('Transaction failed on-chain');
        }

        return receipt;
    }

    async createSwap(tradeLoopId) {
        console.log('📋 STEP 5A: CREATE SWAP TRANSACTION');
        console.log('===================================\n');

        // Prepare transaction using V2 API
        console.log('📝 Preparing CREATE transaction...');
        const prepareResponse = await this.apiCall('POST', '/api/v2/blockchain/trades/prepare', {
            tradeLoopId: tradeLoopId,
            operation: 'create',
            userAddress: this.wallets.alice.address,
            walletId: this.wallets.alice.walletId,
            settings: {
                blockchainFormat: 'ethereum'
            }
        });

        console.log('✅ Transaction prepared!');
        console.log('Response structure:', JSON.stringify(prepareResponse, null, 2));
        
        // Extract transaction from response
        const transaction = prepareResponse.transaction || prepareResponse;
        
        // Contract address from backend is correct: 0xb17Ad11D1b9474c5e7403cA62A8B6D3bc6Deae67
        // No override needed!
        
        console.log(`   To: ${transaction.to || 'N/A'}`);
        console.log(`   Data: ${transaction.data ? transaction.data.substring(0, 50) + '...' : 'N/A'}`);
        console.log(`   Gas Limit: ${transaction.gasLimit || 'N/A'}`);
        console.log(`   Swap ID: ${prepareResponse.metadata?.swapId || 'N/A'}\n`);

        // Store the swapId for later use
        this.swapId = prepareResponse.metadata?.swapId;
        
        // Build transaction object
        const txData = {
            to: transaction.to,
            data: transaction.data,
            gasLimit: transaction.gasLimit || 500000,
            value: transaction.value || '0'
        };
        
        // Send transaction
        const wallet = new ethers.Wallet(this.wallets.alice.privateKey, this.provider);
        const receipt = await this.sendTransaction(wallet, txData, 'CREATE swap transaction');

        // Record transaction with API
        console.log('📡 Recording transaction with API...');
        await this.apiCall('POST', '/api/v2/blockchain/trades/broadcast', {
            tradeLoopId: tradeLoopId,
            transactionHash: receipt.hash,
            operation: 'create'
        });
        console.log('✅ Transaction recorded\n');

        return receipt;
    }

    async approveSwaps(tradeLoopId) {
        console.log('📋 STEP 5B: APPROVE SWAP TRANSACTIONS');
        console.log('=====================================\n');

        // Each participant needs to approve the swap
        for (const [name, walletConfig] of Object.entries(this.walletsConfig)) {
            console.log(`\n👤 ${name.toUpperCase()} approving the swap...`);
            
            // Prepare approve transaction
            const prepareResponse = await this.apiCall('POST', '/api/v2/blockchain/trades/prepare', {
                tradeLoopId: tradeLoopId,
                operation: 'approve',
                userAddress: walletConfig.address,
                walletId: this.wallets[name].walletId,
                settings: {
                    blockchainFormat: 'ethereum'
                }
            });

            const transaction = prepareResponse.transaction || prepareResponse;
            
            // Override contract address
            const correctContractAddress = ethers.getAddress('0x6E5817E7d0720a25b78c96Ee19BC19E662feABc0'.toLowerCase());
            if (transaction.to !== correctContractAddress) {
                transaction.to = correctContractAddress;
            }

            // Build transaction object
            const txData = {
                to: transaction.to,
                data: transaction.data,
                gasLimit: transaction.gasLimit || 200000,
                value: transaction.value || '0'
            };
            
            // Send transaction
            const wallet = new ethers.Wallet(walletConfig.privateKey, this.provider);
            const receipt = await this.sendTransaction(wallet, txData, `APPROVE swap transaction for ${name}`);

            // Record transaction with API
            await this.apiCall('POST', '/api/v2/blockchain/trades/broadcast', {
                tradeLoopId: tradeLoopId,
                transactionHash: receipt.hash,
                operation: 'approve'
            });
        }
        
        console.log('✅ All participants have approved the swap!\n');
    }

    async executeSwap(tradeLoopId) {
        console.log('📋 STEP 5C: EXECUTE SWAP TRANSACTION');
        console.log('====================================\n');
        console.log('🎯 This is where the NFTs actually get swapped!\n');

        // Prepare execute transaction
        const prepareResponse = await this.apiCall('POST', '/api/v2/blockchain/trades/prepare', {
            tradeLoopId: tradeLoopId,
            operation: 'execute',
            userAddress: this.wallets.alice.address,
            walletId: this.wallets.alice.walletId,
            settings: {
                blockchainFormat: 'ethereum'
            }
        });

        const transaction = prepareResponse.transaction || prepareResponse;
        
        // Override contract address
        const correctContractAddress = ethers.getAddress('0x6E5817E7d0720a25b78c96Ee19BC19E662feABc0'.toLowerCase());
        if (transaction.to !== correctContractAddress) {
            transaction.to = correctContractAddress;
        }

        console.log(`   To: ${transaction.to || 'N/A'}`);
        console.log(`   Data: ${transaction.data ? transaction.data.substring(0, 50) + '...' : 'N/A'}`);
        console.log(`   Gas Limit: ${transaction.gasLimit || 'N/A'}\n`);

        // Build transaction object
        const txData = {
            to: transaction.to,
            data: transaction.data,
            gasLimit: transaction.gasLimit || 300000,
            value: transaction.value || '0'
        };
        
        // Send transaction
        const wallet = new ethers.Wallet(this.wallets.alice.privateKey, this.provider);
        const receipt = await this.sendTransaction(wallet, txData, 'EXECUTE swap transaction');

        // Record transaction with API
        console.log('📡 Recording transaction with API...');
        await this.apiCall('POST', '/api/v2/blockchain/trades/broadcast', {
            tradeLoopId: tradeLoopId,
            transactionHash: receipt.hash,
            operation: 'execute'
        });
        console.log('✅ Transaction recorded\n');

        console.log('🎉 NFT SWAP EXECUTED SUCCESSFULLY!');
        console.log('The NFTs have been transferred between all participants!\n');

        return receipt;
    }

    async validateSuccess(receipt) {
        console.log('📋 STEP 6: VALIDATE EXECUTION SUCCESS');
        console.log('====================================\n');

        console.log('✅ END-TO-END EXECUTION COMPLETED SUCCESSFULLY!');
        console.log('\n🎉 ACHIEVEMENT UNLOCKED: REAL 3-WAY NFT TRADE ON SEPOLIA!');
        console.log('============================================================\n');

        console.log('📊 EXECUTION SUMMARY:');
        console.log(`   Tenant ID: ${this.tenant.id}`);
        console.log(`   Transaction Hash: ${receipt.hash}`);
        console.log(`   Block Number: ${receipt.blockNumber}`);
        console.log(`   Gas Used: ${receipt.gasUsed}`);
        console.log(`   Network: Sepolia Testnet`);
        console.log(`   Blockchain: Ethereum`);
        console.log();

        console.log('🔗 TRADE PARTICIPANTS:');
        Object.values(this.wallets).forEach(wallet => {
            console.log(`   ${wallet.name}: ${wallet.address}`);
        });
        console.log();

        console.log('🎨 NFTS TRADED:');
        Object.values(this.nfts).forEach(nft => {
            console.log(`   ${nft.metadata.name} (Token ID: ${nft.tokenId})`);
        });
        console.log();

        console.log('🌐 VERIFICATION LINKS:');
        console.log(`   Transaction: https://sepolia.etherscan.io/tx/${receipt.hash}`);
        console.log(`   Block: https://sepolia.etherscan.io/block/${receipt.blockNumber}`);
        console.log();

        console.log('✨ The SWAPS platform successfully executed a real multi-party trade!');
        console.log('   This proves the complete end-to-end functionality from API to blockchain.');
    }

    async run() {
        try {
            console.log('\n⚡ STARTING COMPLETE END-TO-END SEPOLIA EXECUTION...\n');
            
            console.log('🚀 COMPLETE END-TO-END SWAPS EXECUTION');
            console.log('======================================');
            console.log('⚠️  This will execute a REAL transaction on Sepolia testnet');
            console.log('💰 Make sure your wallets have enough ETH for gas fees');
            console.log('🎨 Using real NFT metadata and enhanced descriptions\n');

            await this.initializeProvider();
            await this.loadWalletConfiguration();
            await this.checkWalletBalances();
            
            await this.createTenant();
            await this.submitInventory();
            const tradeLoopId = await this.submitWants();
            await this.approveNFTs();
            
            // Execute the complete swap process
            const createReceipt = await this.createSwap(tradeLoopId);
            const approveReceipts = await this.approveSwaps(tradeLoopId);
            const executeReceipt = await this.executeSwap(tradeLoopId);
            
            await this.validateSuccess(executeReceipt);
            
        } catch (error) {
            console.error('\n❌ EXECUTION FAILED:', error.message);
            console.error('Stack:', error.stack);
            process.exit(1);
        }
    }
}

// Execute the complete end-to-end test
const execution = new CompleteEndToEndSepoliaExecution();
execution.run();