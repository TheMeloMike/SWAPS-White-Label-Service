#!/usr/bin/env node

/**
 * COMPREHENSIVE ETHEREUM CONNECTION TEST
 * 
 * Tests multiple endpoints to see if Ethereum is properly configured
 * and attempts actual trade execution to verify end-to-end functionality.
 */

const axios = require('axios');

class ComprehensiveEthereumTest {
    constructor() {
        this.apiBaseUrl = 'https://swaps-93hu.onrender.com';
        this.adminApiKey = 'swaps_admin_prod_2025_secure_key_abc123';
        this.tenant = null;
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
            console.log('📥 Response:', JSON.stringify(response.data, null, 2));
            return response.data;
        } catch (error) {
            console.error(`❌ API call failed: ${method.toUpperCase()} ${endpoint}`);
            if (error.response) {
                console.error('Status:', error.response.status);
                console.error('Data:', error.response.data);
            }
            return { error: error.message, status: error.response?.status };
        }
    }

    async test1_CreateEthereumTenant() {
        console.log('\n🏢 TEST 1: Creating Ethereum Tenant');
        
        const tenantData = {
            name: 'Comprehensive Ethereum Test',
            contactEmail: 'comprehensive@ethereum.test',
            industry: 'testing',
            blockchainSettings: {
                preferred: 'ethereum',
                allowSwitching: false,
                ethereumNetwork: 'sepolia'
            }
        };

        const response = await this.makeAPICall('POST', '/api/v1/admin/tenants', tenantData, {
            'Authorization': `Bearer ${this.adminApiKey}`
        });

        if (response.success) {
            this.tenant = {
                id: response.tenant.id,
                apiKey: response.tenant.apiKey
            };
            
            console.log('✅ Tenant created with Ethereum preference');
            console.log(`🔑 API Key: ${this.tenant.apiKey}`);
            return true;
        }
        
        console.log('❌ Failed to create tenant');
        return false;
    }

    async test2_CheckTenantAwareHealth() {
        console.log('\n🏥 TEST 2: Checking Tenant-Aware Health');
        
        if (!this.tenant) {
            console.log('❌ No tenant available');
            return false;
        }

        const response = await this.makeAPICall('GET', '/api/v1/blockchain/health', null, {
            'Authorization': `Bearer ${this.tenant.apiKey}`
        });

        if (response.blockchain) {
            console.log('\n📊 BLOCKCHAIN ANALYSIS:');
            console.log(`Network: ${response.blockchain.network}`);
            console.log(`RPC: ${response.blockchain.rpcEndpoint}`);
            
            if (response.blockchain.contractAddress) {
                console.log(`Contract: ${response.blockchain.contractAddress}`);
            }
            
            return response.blockchain.network.includes('Ethereum') || response.blockchain.network.includes('Sepolia');
        }
        
        return false;
    }

    async test3_TryDirectTradeExecution() {
        console.log('\n🚀 TEST 3: Attempting Direct Trade Execution');
        
        if (!this.tenant) {
            console.log('❌ No tenant available');
            return false;
        }

        const headers = { 'Authorization': `Bearer ${this.tenant.apiKey}` };

        // Step 1: Submit quick inventory
        console.log('\n📦 Submitting test inventory...');
        const inventory = {
            walletId: 'test_wallet_1',
            nfts: [{
                id: 'test_nft_1',
                metadata: { name: 'Test NFT 1', description: 'Test' },
                ownership: { ownerId: 'test_wallet_1', walletAddress: '0x78c9730c9A8A645bD3022771F9509e65DCd3a499' },
                valuation: { estimatedValue: 0.01, currency: 'ETH' },
                platformData: { blockchain: 'ethereum', network: 'sepolia', contractAddress: '0x1111111111111111111111111111111111111111', tokenId: '1' }
            }]
        };
        
        const invResponse = await this.makeAPICall('POST', '/api/v1/inventory/submit', inventory, headers);
        
        if (!invResponse.success) {
            console.log('❌ Inventory submission failed');
            return false;
        }

        // Step 2: Submit wants to create a simple loop
        console.log('\n💭 Submitting wants...');
        const wants = {
            walletId: 'test_wallet_1',
            wantedNFTs: ['test_nft_1'] // Simple self-loop for testing
        };
        
        const wantsResponse = await this.makeAPICall('POST', '/api/v1/wants/submit', wants, headers);
        
        if (wantsResponse.success && wantsResponse.newLoopsDiscovered > 0) {
            console.log('✅ Trade loop discovered!');
            
            // Step 3: Try to execute
            const tradeLoopId = wantsResponse.loops[0].id;
            console.log(`\n🎯 Attempting execution of: ${tradeLoopId}`);
            
            const executionData = {
                tradeLoopId: tradeLoopId,
                mode: 'execute',
                participants: ['0x78c9730c9A8A645bD3022771F9509e65DCd3a499'],
                settings: {
                    blockchainFormat: 'ethereum',
                    network: 'sepolia'
                }
            };
            
            const execResponse = await this.makeAPICall('POST', '/api/v1/blockchain/trades/execute', executionData, headers);
            
            if (execResponse.success) {
                console.log('🎉 EXECUTION SUCCESSFUL!');
                if (execResponse.transactionHash) {
                    console.log(`🔗 Transaction: ${execResponse.transactionHash}`);
                    console.log(`🌐 Etherscan: https://sepolia.etherscan.io/tx/${execResponse.transactionHash}`);
                    return 'TRANSACTION_HASH';
                } else {
                    console.log('✅ Execution initiated');
                    return 'EXECUTION_STARTED';
                }
            } else {
                console.log(`❌ Execution failed: ${execResponse.error || 'Unknown error'}`);
                return false;
            }
        } else {
            console.log('❌ No trade loop discovered');
            return false;
        }
    }

    async test4_CheckEnvironmentResponse() {
        console.log('\n🌍 TEST 4: Checking Environment Response Patterns');
        
        if (!this.tenant) {
            console.log('❌ No tenant available');
            return;
        }

        // Try a blockchain info endpoint if it exists
        const headers = { 'Authorization': `Bearer ${this.tenant.apiKey}` };
        
        try {
            const infoResponse = await this.makeAPICall('GET', '/api/v1/blockchain/info', null, headers);
            
            if (infoResponse && infoResponse.blockchain) {
                console.log('\n📋 BLOCKCHAIN INFO RESPONSE:');
                console.log(`Network: ${infoResponse.blockchain.network || 'N/A'}`);
                console.log(`RPC URL: ${infoResponse.blockchain.rpcUrl || 'N/A'}`);
                console.log(`Contract: ${infoResponse.blockchain.contractAddress || 'N/A'}`);
                
                if (infoResponse.tenantInfo) {
                    console.log('\n🏢 TENANT INFO:');
                    console.log(`Preferred: ${infoResponse.tenantInfo.blockchainPreference || 'N/A'}`);
                    console.log(`Network: ${infoResponse.tenantInfo.ethereumNetwork || 'N/A'}`);
                }
                
                return infoResponse;
            }
        } catch (error) {
            console.log('⚠️ Blockchain info endpoint not available or failed');
        }
    }

    async run() {
        console.log('🔍 COMPREHENSIVE ETHEREUM CONNECTION TEST');
        console.log('========================================\n');

        const results = {
            tenantCreation: false,
            healthCheck: false,
            tradeExecution: false,
            environmentCheck: false
        };

        // Test 1: Create Ethereum tenant
        results.tenantCreation = await this.test1_CreateEthereumTenant();

        // Test 2: Check health with tenant context
        results.healthCheck = await this.test2_CheckTenantAwareHealth();

        // Test 3: Try actual trade execution
        results.tradeExecution = await this.test3_TryDirectTradeExecution();

        // Test 4: Check environment responses
        results.environmentCheck = await this.test4_CheckEnvironmentResponse();

        // Final analysis
        console.log('\n📊 COMPREHENSIVE TEST RESULTS');
        console.log('============================');
        console.log(`✅ Tenant Creation: ${results.tenantCreation ? 'PASS' : 'FAIL'}`);
        console.log(`✅ Health Check: ${results.healthCheck ? 'ETHEREUM' : 'SOLANA'}`);
        console.log(`✅ Trade Execution: ${results.tradeExecution || 'FAILED'}`);
        console.log(`✅ Environment Check: ${results.environmentCheck ? 'COMPLETE' : 'INCOMPLETE'}`);

        console.log('\n🎯 FINAL DIAGNOSIS:');
        if (results.tradeExecution === 'TRANSACTION_HASH') {
            console.log('🎉 ETHEREUM IS FULLY OPERATIONAL!');
            console.log('🚀 Ready for end-to-end trade execution!');
        } else if (results.tradeExecution === 'EXECUTION_STARTED') {
            console.log('✅ ETHEREUM CONNECTION ESTABLISHED!');
            console.log('🎯 Execution pipeline is working!');
        } else if (results.tenantCreation && !results.healthCheck) {
            console.log('⚠️ MIXED RESULTS - May need additional investigation');
            console.log('💡 Tenant system works but health endpoint shows Solana');
        } else {
            console.log('❌ ETHEREUM NOT YET CONFIGURED');
            console.log('🔧 Environment variables may need review');
        }
    }
}

const test = new ComprehensiveEthereumTest();
test.run().catch(console.error);