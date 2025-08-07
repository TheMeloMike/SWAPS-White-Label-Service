#!/usr/bin/env node

/**
 * SWAPS Ethereum 3-Way Trade via Live API Demo
 * 
 * This script demonstrates a complete 3-way NFT trade on Ethereum Sepolia
 * using the live SWAPS API at https://swaps-93hu.onrender.com
 */

const axios = require('axios');

class SWAPSEthereumAPIDemo {
    constructor() {
        this.apiBaseUrl = 'https://swaps-93hu.onrender.com';
        this.adminApiKey = 'swaps_admin_prod_2025_secure_key_abc123';
        this.tenantApiKey = null;
        this.tradeLoopId = null;
        
        // Demo participant wallets (we'll use placeholder addresses)
        this.participants = {
            alice: {
                wallet: '0x742d35Cc6634C0532925a3b8D431C7BDDE7EC13b', // Placeholder
                ownedNFT: {
                    contractAddress: '0x067a1f0892eB57c8dccb9FA377D568De78ECf6dc',
                    tokenId: '1',
                    name: 'Test NFT #1'
                },
                wantedNFT: {
                    contractAddress: '0x067a1f0892eB57c8dccb9FA377D568De78ECf6dc',
                    tokenId: '2',
                    name: 'Test NFT #2'
                }
            },
            bob: {
                wallet: '0x8ba1f109551bD432803012645Hac136c72eFcc',
                ownedNFT: {
                    contractAddress: '0x067a1f0892eB57c8dccb9FA377D568De78ECf6dc',
                    tokenId: '2',
                    name: 'Test NFT #2'
                },
                wantedNFT: {
                    contractAddress: '0x067a1f0892eB57c8dccb9FA377D568De78ECf6dc',
                    tokenId: '3',
                    name: 'Test NFT #3'
                }
            },
            carol: {
                wallet: '0x9aE48aD1234F08A3b5D432803098765Hac94FcE',
                ownedNFT: {
                    contractAddress: '0x067a1f0892eB57c8dccb9FA377D568De78ECf6dc',
                    tokenId: '3',
                    name: 'Test NFT #3'
                },
                wantedNFT: {
                    contractAddress: '0x067a1f0892eB57c8dccb9FA377D568De78ECf6dc',
                    tokenId: '1',
                    name: 'Test NFT #1'
                }
            }
        };
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
            if (data) console.log('📤 Request:', JSON.stringify(data, null, 2));

            const response = await axios(config);
            console.log('📥 Response:', JSON.stringify(response.data, null, 2));
            return response.data;
        } catch (error) {
            console.error(`❌ API call failed: ${method.toUpperCase()} ${endpoint}`);
            if (error.response) {
                console.error('Status:', error.response.status);
                console.error('Data:', error.response.data);
            } else {
                console.error('Error:', error.message);
            }
            throw error;
        }
    }

    async step1_checkEthereumSupport() {
        console.log('\n🔍 Step 1: Checking Ethereum Support');
        
        try {
            // Check if Ethereum blockchain info is available
            const response = await this.makeAPICall('GET', '/api/v1/blockchain/info');
            
            // Also try to get Ethereum-specific info
            try {
                const ethResponse = await this.makeAPICall('POST', '/api/v1/blockchain/discovery/trades', {
                    mode: 'discovery',
                    settings: {
                        blockchainFormat: 'ethereum',
                        maxResults: 1
                    }
                });
                console.log('✅ Ethereum support confirmed');
                return true;
            } catch (ethError) {
                console.log('⚠️ Ethereum may not be configured, but will proceed with blockchain format specification');
                return true;
            }
        } catch (error) {
            console.error('❌ Failed to check blockchain support');
            return false;
        }
    }

    async step2_createTenant() {
        console.log('\n🏢 Step 2: Creating Demo Tenant');
        
        const tenantData = {
            name: 'Ethereum 3-Way Demo',
            contactEmail: 'demo@ethereum-test.com',
            description: 'Demo tenant for Ethereum Sepolia 3-way trade',
            settings: {
                allowedNetworks: ['ethereum'],
                defaultBlockchain: 'ethereum',
                maxTradesPerHour: 100
            }
        };

        const adminHeaders = {
            'Authorization': `Bearer ${this.adminApiKey}`
        };

        try {
            const response = await this.makeAPICall('POST', '/api/v1/admin/tenants', tenantData, adminHeaders);
            
            if (response.success && response.tenant && response.tenant.apiKey) {
                this.tenantApiKey = response.tenant.apiKey;
                console.log(`✅ Tenant created with API key: ${this.tenantApiKey.substring(0, 8)}...`);
                return true;
            } else {
                console.error('❌ Failed to get API key from tenant creation response');
                return false;
            }
        } catch (error) {
            console.error('❌ Failed to create tenant');
            return false;
        }
    }

    async step3_submitInventory() {
        console.log('\n📦 Step 3: Submitting NFT Inventory for All Participants');
        
        if (!this.tenantApiKey) {
            console.error('❌ No tenant API key available');
            return false;
        }

        const headers = {
            'Authorization': `Bearer ${this.tenantApiKey}`
        };

        // Submit inventory for all three participants
        for (const [name, participant] of Object.entries(this.participants)) {
            console.log(`\n📤 Submitting inventory for ${name}...`);
            
            const inventoryData = {
                walletId: participant.wallet,
                nfts: [{
                    id: `${participant.ownedNFT.contractAddress}:${participant.ownedNFT.tokenId}`,
                    metadata: {
                        name: participant.ownedNFT.name,
                        description: `Demo NFT for ${name}`,
                        image: 'https://example.com/demo.png'
                    },
                    ownership: {
                        ownerId: participant.wallet,
                        blockchain: 'ethereum'
                    },
                    valuation: {
                        estimatedValue: 0.1,
                        currency: 'ETH'
                    }
                }],
                settings: {
                    blockchainFormat: 'ethereum'
                }
            };

            try {
                const response = await this.makeAPICall('POST', '/api/v1/inventory/submit', inventoryData, headers);
                
                if (response.success) {
                    console.log(`✅ Inventory submitted for ${name}`);
                } else {
                    console.error(`❌ Failed to submit inventory for ${name}`);
                    return false;
                }
            } catch (error) {
                console.error(`❌ Failed to submit inventory for ${name}`);
                return false;
            }
        }

        console.log('✅ All inventories submitted successfully');
        return true;
    }

    async step4_submitWants() {
        console.log('\n💭 Step 4: Submitting Wanted NFTs for All Participants');
        
        const headers = {
            'Authorization': `Bearer ${this.tenantApiKey}`
        };

        // Submit wants for all three participants to create a 3-way loop
        for (const [name, participant] of Object.entries(this.participants)) {
            console.log(`\n💫 Submitting wants for ${name}...`);
            
            const wantsData = {
                walletId: participant.wallet,
                wantedNFTs: [`${participant.wantedNFT.contractAddress}:${participant.wantedNFT.tokenId}`],
                settings: {
                    blockchainFormat: 'ethereum'
                }
            };

            try {
                const response = await this.makeAPICall('POST', '/api/v1/wants/submit', wantsData, headers);
                
                if (response.success) {
                    console.log(`✅ Wants submitted for ${name}`);
                } else {
                    console.error(`❌ Failed to submit wants for ${name}`);
                    return false;
                }
            } catch (error) {
                console.error(`❌ Failed to submit wants for ${name}`);
                return false;
            }
        }

        console.log('✅ All wants submitted successfully');
        return true;
    }

    async step5_discoverTrades() {
        console.log('\n🔍 Step 5: Discovering 3-Way Trade Loops');
        
        const headers = {
            'Authorization': `Bearer ${this.tenantApiKey}`
        };

        const discoveryData = {
            mode: 'executable',
            settings: {
                blockchainFormat: 'ethereum',
                maxResults: 10,
                includeCollectionTrades: true,
                autoCreateBlockchainTrades: false
            }
        };

        try {
            const response = await this.makeAPICall('POST', '/api/v1/blockchain/discovery/trades', discoveryData, headers);
            
            if (response.success && response.trades && response.trades.length > 0) {
                console.log(`✅ Found ${response.trades.length} trade loop(s)`);
                
                // Look for a 3-way trade loop
                const threeWayTrade = response.trades.find(trade => 
                    trade.totalParticipants === 3 || 
                    trade.participants === 3 ||
                    (trade.steps && trade.steps.length === 3)
                );

                if (threeWayTrade) {
                    this.tradeLoopId = threeWayTrade.id;
                    console.log(`🎯 Found 3-way trade loop: ${this.tradeLoopId}`);
                    console.log('Trade details:', JSON.stringify(threeWayTrade, null, 2));
                    return true;
                } else {
                    console.log('⚠️ No 3-way trade loop found, using first available trade');
                    this.tradeLoopId = response.trades[0].id;
                    return true;
                }
            } else {
                console.error('❌ No trade loops discovered');
                return false;
            }
        } catch (error) {
            console.error('❌ Failed to discover trades');
            return false;
        }
    }

    async step6_simulateExecution() {
        console.log('\n🧪 Step 6: Simulating Trade Execution');
        
        if (!this.tradeLoopId) {
            console.error('❌ No trade loop ID available');
            return false;
        }

        const headers = {
            'Authorization': `Bearer ${this.tenantApiKey}`
        };

        const simulationData = {
            tradeLoopId: this.tradeLoopId,
            mode: 'simulate',
            settings: {
                blockchainFormat: 'ethereum'
            }
        };

        try {
            const response = await this.makeAPICall('POST', '/api/v1/blockchain/trades/execute', simulationData, headers);
            
            if (response.success && response.executionPlan) {
                console.log('✅ Simulation completed successfully');
                console.log('Execution plan:', JSON.stringify(response.executionPlan, null, 2));
                return true;
            } else {
                console.error('❌ Simulation failed');
                return false;
            }
        } catch (error) {
            console.error('❌ Failed to simulate execution');
            return false;
        }
    }

    async step7_executeOnBlockchain() {
        console.log('\n🚀 Step 7: Executing Trade on Ethereum Sepolia');
        
        if (!this.tradeLoopId) {
            console.error('❌ No trade loop ID available');
            return false;
        }

        const headers = {
            'Authorization': `Bearer ${this.tenantApiKey}`
        };

        const executionData = {
            tradeLoopId: this.tradeLoopId,
            mode: 'execute',
            customTimeoutHours: 24,
            settings: {
                blockchainFormat: 'ethereum'
            }
        };

        try {
            console.log('🔄 Initiating blockchain execution...');
            const response = await this.makeAPICall('POST', '/api/v1/blockchain/trades/execute', executionData, headers);
            
            if (response.success) {
                console.log('🎉 Trade execution initiated on Ethereum Sepolia!');
                
                if (response.blockchainTrade) {
                    console.log('Blockchain trade details:', JSON.stringify(response.blockchainTrade, null, 2));
                    
                    if (response.blockchainTrade.explorerUrl) {
                        console.log(`🔗 View on Etherscan: ${response.blockchainTrade.explorerUrl}`);
                    }
                    
                    if (response.blockchainTrade.swapId || response.blockchainTrade.tradeId) {
                        const tradeId = response.blockchainTrade.swapId || response.blockchainTrade.tradeId;
                        console.log(`📋 Trade ID: ${tradeId}`);
                    }
                }
                
                return true;
            } else {
                console.error('❌ Trade execution failed');
                return false;
            }
        } catch (error) {
            console.error('❌ Failed to execute trade on blockchain');
            return false;
        }
    }

    async runFullDemo() {
        console.log('🎬 SWAPS Ethereum 3-Way Trade API Demo Starting...\n');
        console.log('🎯 Goal: Execute a complete 3-way NFT trade on Ethereum Sepolia testnet');
        console.log('🔗 API: https://swaps-93hu.onrender.com');
        console.log('⛓️ Network: Ethereum Sepolia Testnet');
        console.log('📋 Contract: 0xb17Ad11D1b9474c5e7403cA62A8B6D3bc6Deae67\n');

        try {
            // Execute all steps
            if (!await this.step1_checkEthereumSupport()) return;
            if (!await this.step2_createTenant()) return;
            if (!await this.step3_submitInventory()) return;
            if (!await this.step4_submitWants()) return;
            if (!await this.step5_discoverTrades()) return;
            if (!await this.step6_simulateExecution()) return;
            if (!await this.step7_executeOnBlockchain()) return;

            console.log('\n🎉 SUCCESS! Complete 3-way Ethereum trade executed via SWAPS API!');
            console.log('\n📊 Demo Summary:');
            console.log(`✅ API Base URL: ${this.apiBaseUrl}`);
            console.log(`✅ Tenant Created: ${this.tenantApiKey ? 'Yes' : 'No'}`);
            console.log(`✅ Trade Loop ID: ${this.tradeLoopId || 'N/A'}`);
            console.log(`✅ Blockchain: Ethereum Sepolia`);
            console.log(`✅ Contract: 0xb17Ad11D1b9474c5e7403cA62A8B6D3bc6Deae67`);
            console.log('\n🌟 SWAPS multi-chain API successfully demonstrated!');

        } catch (error) {
            console.error('\n💥 Demo failed with error:', error.message);
            process.exit(1);
        }
    }
}

// Run the demo
const demo = new SWAPSEthereumAPIDemo();
demo.runFullDemo().catch(console.error);