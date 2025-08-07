#!/usr/bin/env node

/**
 * MVP HYBRID IMPLEMENTATION
 * 
 * Quick solution to get trades executing TODAY using a hybrid model:
 * - Service wallet for createSwap (minimal cost)
 * - Users sign their own approvals
 * - Service wallet for final execution (optional)
 * 
 * This gets us to a working demo immediately while we build the full user-pays model.
 */

const axios = require('axios');

class MVPHybridImplementation {
    constructor() {
        this.apiBaseUrl = 'https://swaps-93hu.onrender.com';
        this.adminApiKey = 'swaps_admin_prod_2025_secure_key_abc123';
        
        // MVP Service Wallet (you'll need to create and fund this)
        this.serviceWallet = {
            address: '0xYOUR_SERVICE_WALLET_ADDRESS', // Replace with actual
            privateKey: '0xYOUR_SERVICE_WALLET_PRIVATE_KEY' // Replace with actual
        };
        
        // User wallets (your funded test wallets)
        this.userWallets = {
            alice: {
                address: '0x78c9730c9A8A645bD3022771F9509e65DCd3a499',
                walletId: 'mvp_alice',
                name: 'Alice'
            },
            bob: {
                address: '0xf65c05a521BAD596686aBf74c299fCa474D2b19b',
                walletId: 'mvp_bob',
                name: 'Bob'
            },
            carol: {
                address: '0xAd6bee0e55f173419897C1a94C354C49094A4f49',
                walletId: 'mvp_carol',
                name: 'Carol'
            }
        };
        
        this.tenant = null;
        this.tradeLoopId = null;
    }

    async makeAPICall(method, endpoint, data = null, headers = {}) {
        try {
            const config = {
                method,
                url: `${this.apiBaseUrl}${endpoint}`,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            };

            if (data) {
                config.data = data;
            }

            console.log(`🔄 ${method.toUpperCase()} ${endpoint}`);
            const response = await axios(config);
            console.log('✅ Success');
            return response.data;
        } catch (error) {
            console.error(`❌ Failed: ${error.response?.status} - ${error.response?.data?.error || error.message}`);
            return null;
        }
    }

    async step1_SetupServiceWallet() {
        console.log('\n📋 STEP 1: SERVICE WALLET SETUP');
        console.log('================================\n');
        
        console.log('🔧 REQUIRED ACTIONS:');
        console.log('1. Create a new Ethereum wallet');
        console.log('2. Fund it with 0.1 ETH from Sepolia faucet');
        console.log('3. Add these to Render environment variables:');
        console.log('   ETHEREUM_SERVICE_WALLET_ADDRESS=0x...');
        console.log('   ETHEREUM_SERVICE_WALLET_KEY=0x...');
        console.log('   EXECUTION_MODE=hybrid');
        console.log('4. Restart Render service\n');
        
        console.log('📝 Service Wallet Details:');
        console.log(`Address: ${this.serviceWallet.address}`);
        console.log(`Status: ${this.serviceWallet.address.includes('YOUR') ? '❌ Not configured' : '✅ Configured'}`);
        
        return !this.serviceWallet.address.includes('YOUR');
    }

    async step2_CreateTenantAndTradeLoop() {
        console.log('\n📋 STEP 2: CREATING TENANT & TRADE LOOP');
        console.log('========================================\n');

        // Create tenant
        const tenantData = {
            name: 'MVP Hybrid Test',
            contactEmail: 'mvp@hybrid.test',
            industry: 'demo',
            blockchainSettings: {
                preferred: 'ethereum',
                allowSwitching: false,
                ethereumNetwork: 'sepolia'
            }
        };

        const tenantResponse = await this.makeAPICall('POST', '/api/v1/admin/tenants', tenantData, {
            'Authorization': `Bearer ${this.adminApiKey}`
        });

        if (!tenantResponse?.success) {
            console.log('❌ Failed to create tenant');
            return false;
        }

        this.tenant = {
            id: tenantResponse.tenant.id,
            apiKey: tenantResponse.tenant.apiKey
        };

        console.log(`✅ Tenant created: ${this.tenant.id}`);

        const headers = { 'Authorization': `Bearer ${this.tenant.apiKey}` };

        // Submit inventories
        console.log('\n📦 Submitting NFT inventories...');
        
        for (const [name, wallet] of Object.entries(this.userWallets)) {
            const inventory = {
                walletId: wallet.walletId,
                nfts: [{
                    id: `mvp_${name}_nft`,
                    metadata: { name: `${wallet.name} MVP NFT`, description: 'MVP test NFT' },
                    ownership: { ownerId: wallet.walletId, walletAddress: wallet.address },
                    valuation: { estimatedValue: 0.01, currency: 'ETH' },
                    platformData: { 
                        blockchain: 'ethereum', 
                        network: 'sepolia', 
                        contractAddress: '0x1111111111111111111111111111111111111111', 
                        tokenId: `400${Object.keys(this.userWallets).indexOf(name) + 1}` 
                    }
                }]
            };
            
            await this.makeAPICall('POST', '/api/v1/inventory/submit', inventory, headers);
        }

        // Create 3-way loop
        console.log('\n💭 Creating 3-way trade loop...');
        
        await this.makeAPICall('POST', '/api/v1/wants/submit', {
            walletId: this.userWallets.alice.walletId,
            wantedNFTs: ['mvp_bob_nft']
        }, headers);

        await this.makeAPICall('POST', '/api/v1/wants/submit', {
            walletId: this.userWallets.bob.walletId,
            wantedNFTs: ['mvp_carol_nft']
        }, headers);

        const finalWants = await this.makeAPICall('POST', '/api/v1/wants/submit', {
            walletId: this.userWallets.carol.walletId,
            wantedNFTs: ['mvp_alice_nft']
        }, headers);

        if (finalWants?.success && finalWants.newLoopsDiscovered > 0) {
            this.tradeLoopId = finalWants.loops[0].id;
            console.log(`✅ Trade loop created: ${this.tradeLoopId}`);
            return true;
        }

        console.log('❌ Failed to create trade loop');
        return false;
    }

    async step3_ExecuteWithHybridModel() {
        console.log('\n📋 STEP 3: EXECUTING WITH HYBRID MODEL');
        console.log('======================================\n');

        if (!this.tenant || !this.tradeLoopId) {
            console.log('❌ Missing tenant or trade loop');
            return false;
        }

        const headers = { 'Authorization': `Bearer ${this.tenant.apiKey}` };

        console.log('🚀 Attempting hybrid execution...');
        console.log('Mode: Service wallet for createSwap, users for approval\n');
        
        const executionData = {
            tradeLoopId: this.tradeLoopId,
            mode: 'execute',
            walletPublicKey: this.userWallets.alice.walletId,
            useServiceWallet: true, // MVP mode
            participants: Object.values(this.userWallets).map(w => w.address),
            settings: {
                blockchainFormat: 'ethereum',
                network: 'sepolia',
                executionMode: 'hybrid'
            }
        };

        const result = await this.makeAPICall('POST', '/api/v1/blockchain/trades/execute', executionData, headers);

        if (result?.success) {
            console.log('🎉 EXECUTION SUCCESSFUL!');
            if (result.transactionHash) {
                console.log(`\n🔗 Transaction Hash: ${result.transactionHash}`);
                console.log(`🌐 View on Etherscan: https://sepolia.etherscan.io/tx/${result.transactionHash}`);
                return result.transactionHash;
            }
            return true;
        }

        console.log('❌ Execution failed - likely need service wallet configuration');
        return false;
    }

    async run() {
        console.log('🚀 MVP HYBRID IMPLEMENTATION');
        console.log('============================');
        console.log('Goal: Execute real trade on Sepolia TODAY\n');

        try {
            // Check service wallet
            const walletReady = await this.step1_SetupServiceWallet();
            
            if (!walletReady) {
                console.log('\n⚠️  SERVICE WALLET NOT CONFIGURED');
                console.log('Please follow the setup instructions above');
                console.log('Then update this script with your service wallet details');
                return;
            }

            // Create trade loop
            const loopCreated = await this.step2_CreateTenantAndTradeLoop();
            
            if (!loopCreated) {
                console.log('\n❌ Failed to create trade loop');
                return;
            }

            // Execute trade
            const txHash = await this.step3_ExecuteWithHybridModel();

            console.log('\n📊 FINAL RESULTS');
            console.log('===============');
            
            if (txHash) {
                console.log('🎉 SUCCESS! First multi-party trade executed!');
                console.log(`🔗 Transaction: ${txHash}`);
                console.log('🏆 MVP COMPLETE - Trade executing on Sepolia!');
            } else {
                console.log('🔧 Execution blocked - need service wallet on Render');
                console.log('\n📋 NEXT STEPS:');
                console.log('1. Create and fund service wallet (0.1 ETH)');
                console.log('2. Add environment variables to Render');
                console.log('3. Restart service');
                console.log('4. Run this script again');
            }

        } catch (error) {
            console.error('💥 Error:', error.message);
        }
    }
}

// Instructions for immediate use
console.log('📋 IMMEDIATE ACTION PLAN');
console.log('=======================\n');
console.log('1. Create new wallet using MetaMask or ethers.js');
console.log('2. Get Sepolia ETH from: https://sepoliafaucet.com');
console.log('3. Add to Render environment variables');
console.log('4. Update this script with wallet details');
console.log('5. Run: node mvp-hybrid-implementation.js\n');

const mvp = new MVPHybridImplementation();
// Uncomment when ready with service wallet
// mvp.run().catch(console.error);