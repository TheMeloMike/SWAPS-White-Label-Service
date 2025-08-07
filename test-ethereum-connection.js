#!/usr/bin/env node

/**
 * TEST ETHEREUM CONNECTION AFTER ENV SETUP
 * 
 * Quick test to verify the API is now properly connected to Ethereum
 * instead of Solana after environment variables were set.
 */

const axios = require('axios');

class TestEthereumConnection {
    constructor() {
        this.apiBaseUrl = 'https://swaps-93hu.onrender.com';
        this.adminApiKey = 'swaps_admin_prod_2025_secure_key_abc123';
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
            throw error;
        }
    }

    async testEthereumConnection() {
        console.log('🌍 TESTING ETHEREUM CONNECTION AFTER ENV SETUP');
        console.log('=============================================\n');

        try {
            // Create a quick Ethereum tenant
            console.log('1️⃣ Creating Ethereum tenant...');
            const tenantData = {
                name: 'Ethereum Connection Test',
                contactEmail: 'test@ethereum.connection',
                industry: 'testing',
                blockchainSettings: {
                    preferred: 'ethereum',
                    allowSwitching: false,
                    ethereumNetwork: 'sepolia'
                }
            };

            const tenantResponse = await this.makeAPICall('POST', '/api/v1/admin/tenants', tenantData, {
                'Authorization': `Bearer ${this.adminApiKey}`
            });

            if (tenantResponse.success) {
                const tenantApiKey = tenantResponse.tenant.apiKey;
                console.log('✅ Ethereum tenant created successfully\n');

                // Test blockchain health with tenant context
                console.log('2️⃣ Checking blockchain health...');
                const healthResponse = await this.makeAPICall('GET', '/api/v1/blockchain/health', null, {
                    'Authorization': `Bearer ${tenantApiKey}`
                });

                console.log('\n📊 BLOCKCHAIN CONNECTION ANALYSIS:');
                console.log('================================');
                
                if (healthResponse.blockchain) {
                    const network = healthResponse.blockchain.network;
                    const rpcEndpoint = healthResponse.blockchain.rpcEndpoint;
                    
                    if (network.includes('Ethereum') || network.includes('Sepolia')) {
                        console.log('🎉 SUCCESS! Connected to Ethereum!');
                        console.log(`✅ Network: ${network}`);
                        console.log(`✅ RPC: ${rpcEndpoint}`);
                        console.log(`✅ Contract: ${healthResponse.blockchain.contractAddress || 'N/A'}`);
                        return true;
                    } else if (network.includes('Solana')) {
                        console.log('⚠️ Still connected to Solana');
                        console.log(`❌ Network: ${network}`);
                        console.log(`❌ RPC: ${rpcEndpoint}`);
                        console.log('💡 Render service may need restart to pick up new env vars');
                        return false;
                    } else {
                        console.log(`🔍 Unknown network: ${network}`);
                        return false;
                    }
                } else {
                    console.log('❌ No blockchain info in health response');
                    return false;
                }
            }
        } catch (error) {
            console.error('❌ Connection test failed:', error.message);
            return false;
        }
    }

    async run() {
        const isEthereumConnected = await this.testEthereumConnection();
        
        console.log('\n🎯 NEXT STEPS:');
        if (isEthereumConnected) {
            console.log('✅ Environment configured correctly!');
            console.log('🚀 Ready to execute the end-to-end trade!');
            console.log('📋 Run: node first-end-to-end-trade-execution.js');
        } else {
            console.log('🔧 Service restart needed:');
            console.log('   1. Go to Render dashboard');
            console.log('   2. Manual deploy or restart service');
            console.log('   3. Wait for service to restart');
            console.log('   4. Re-run this test');
        }
    }
}

const test = new TestEthereumConnection();
test.run().catch(console.error);