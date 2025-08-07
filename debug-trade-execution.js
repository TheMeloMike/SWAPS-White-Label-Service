#!/usr/bin/env node

/**
 * DEBUG TRADE EXECUTION ISSUE
 * 
 * The trade loop is discovered perfectly, but execution returns 404.
 * Let's debug this by:
 * 1. Checking the exact trade loop format
 * 2. Testing different execution approaches
 * 3. Verifying the trade loop still exists
 */

const axios = require('axios');

class DebugTradeExecution {
    constructor() {
        this.apiBaseUrl = 'https://swaps-93hu.onrender.com';
        this.adminApiKey = 'swaps_admin_prod_2025_secure_key_abc123';
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

    async step1_RecreateTradeLoop() {
        console.log('🔄 STEP 1: Recreating Trade Loop for Debugging');
        
        // Create tenant
        const tenantData = {
            name: 'Debug Trade Execution',
            contactEmail: 'debug@trade.execution',
            industry: 'debugging',
            blockchainSettings: {
                preferred: 'ethereum',
                allowSwitching: false,
                ethereumNetwork: 'sepolia'
            }
        };

        const tenantResponse = await this.makeAPICall('POST', '/api/v1/admin/tenants', tenantData, {
            'Authorization': `Bearer ${this.adminApiKey}`
        });

        if (!tenantResponse.success) {
            console.log('❌ Failed to create tenant');
            return false;
        }

        this.tenant = {
            id: tenantResponse.tenant.id,
            apiKey: tenantResponse.tenant.apiKey
        };

        const headers = { 'Authorization': `Bearer ${this.tenant.apiKey}` };

        // Submit simple inventories
        console.log('\n📦 Submitting debug inventories...');
        
        const aliceInventory = {
            walletId: 'debug_alice',
            nfts: [{
                id: 'debug_alice_nft',
                metadata: { name: 'Debug Alice NFT', description: 'Debug NFT' },
                ownership: { ownerId: 'debug_alice', walletAddress: '0x78c9730c9A8A645bD3022771F9509e65DCd3a499' },
                valuation: { estimatedValue: 0.01, currency: 'ETH' },
                platformData: { blockchain: 'ethereum', network: 'sepolia', contractAddress: '0x1111111111111111111111111111111111111111', tokenId: '1' }
            }]
        };

        const bobInventory = {
            walletId: 'debug_bob',
            nfts: [{
                id: 'debug_bob_nft',
                metadata: { name: 'Debug Bob NFT', description: 'Debug NFT' },
                ownership: { ownerId: 'debug_bob', walletAddress: '0xf65c05a521BAD596686aBf74c299fCa474D2b19b' },
                valuation: { estimatedValue: 0.01, currency: 'ETH' },
                platformData: { blockchain: 'ethereum', network: 'sepolia', contractAddress: '0x1111111111111111111111111111111111111111', tokenId: '2' }
            }]
        };

        await this.makeAPICall('POST', '/api/v1/inventory/submit', aliceInventory, headers);
        await this.makeAPICall('POST', '/api/v1/inventory/submit', bobInventory, headers);

        // Submit wants to create loop
        console.log('\n💭 Creating debug trade loop...');
        
        await this.makeAPICall('POST', '/api/v1/wants/submit', {
            walletId: 'debug_alice',
            wantedNFTs: ['debug_bob_nft']
        }, headers);

        const finalWants = await this.makeAPICall('POST', '/api/v1/wants/submit', {
            walletId: 'debug_bob',
            wantedNFTs: ['debug_alice_nft']
        }, headers);

        if (finalWants.success && finalWants.newLoopsDiscovered > 0) {
            this.tradeLoopId = finalWants.loops[0].id;
            console.log(`✅ Debug trade loop created: ${this.tradeLoopId}`);
            return true;
        }

        console.log('❌ Failed to create debug trade loop');
        return false;
    }

    async step2_TestDiscoveryEndpoint() {
        console.log('\n🔍 STEP 2: Testing Trade Discovery Endpoint');
        
        if (!this.tenant) return false;

        const headers = { 'Authorization': `Bearer ${this.tenant.apiKey}` };

        try {
            const discoveryResponse = await this.makeAPICall('POST', '/api/v1/blockchain/discovery/trades', {
                mode: 'executable',
                settings: {
                    blockchainFormat: 'ethereum'
                }
            }, headers);

            if (discoveryResponse.success) {
                console.log('✅ Discovery endpoint working');
                console.log(`📊 Trades found: ${discoveryResponse.trades?.length || 0}`);
                
                if (discoveryResponse.trades && discoveryResponse.trades.length > 0) {
                    console.log('🔗 Available trade IDs:');
                    discoveryResponse.trades.forEach((trade, index) => {
                        console.log(`   ${index + 1}. ${trade.id || trade.tradeId || 'Unknown ID'}`);
                    });
                    
                    // Try using the first discovered trade
                    return discoveryResponse.trades[0];
                }
            }
        } catch (error) {
            console.log('❌ Discovery endpoint failed');
        }

        return null;
    }

    async step3_TestDifferentExecutionMethods() {
        console.log('\n🎯 STEP 3: Testing Different Execution Methods');
        
        if (!this.tenant || !this.tradeLoopId) {
            console.log('❌ Missing tenant or trade loop ID');
            return false;
        }

        const headers = { 'Authorization': `Bearer ${this.tenant.apiKey}` };

        // Method 1: Original approach
        console.log('\n🧪 Method 1: Original execution approach...');
        const method1 = await this.makeAPICall('POST', '/api/v1/blockchain/trades/execute', {
            tradeLoopId: this.tradeLoopId,
            mode: 'execute',
            participants: ['0x78c9730c9A8A645bD3022771F9509e65DCd3a499', '0xf65c05a521BAD596686aBf74c299fCa474D2b19b'],
            settings: { blockchainFormat: 'ethereum', network: 'sepolia' }
        }, headers);

        if (method1.success) {
            console.log('✅ Method 1 SUCCESS!');
            return method1;
        }

        // Method 2: URL encode the trade loop ID
        console.log('\n🧪 Method 2: URL-encoded trade loop ID...');
        const encodedId = encodeURIComponent(this.tradeLoopId);
        const method2 = await this.makeAPICall('POST', '/api/v1/blockchain/trades/execute', {
            tradeLoopId: encodedId,
            mode: 'execute',
            participants: ['0x78c9730c9A8A645bD3022771F9509e65DCd3a499', '0xf65c05a521BAD596686aBf74c299fCa474D2b19b'],
            settings: { blockchainFormat: 'ethereum' }
        }, headers);

        if (method2.success) {
            console.log('✅ Method 2 SUCCESS!');
            return method2;
        }

        // Method 3: Create mode first
        console.log('\n🧪 Method 3: Create blockchain trade first...');
        const method3 = await this.makeAPICall('POST', '/api/v1/blockchain/trades/execute', {
            tradeLoopId: this.tradeLoopId,
            mode: 'create',
            participants: ['0x78c9730c9A8A645bD3022771F9509e65DCd3a499', '0xf65c05a521BAD596686aBf74c299fCa474D2b19b'],
            settings: { blockchainFormat: 'ethereum' }
        }, headers);

        if (method3.success) {
            console.log('✅ Method 3 SUCCESS!');
            return method3;
        }

        // Method 4: Try with discovered trade
        const discoveredTrade = await this.step2_TestDiscoveryEndpoint();
        if (discoveredTrade) {
            console.log('\n🧪 Method 4: Using discovered trade ID...');
            const method4 = await this.makeAPICall('POST', '/api/v1/blockchain/trades/execute', {
                tradeLoopId: discoveredTrade.id || discoveredTrade.tradeId,
                mode: 'execute',
                participants: ['0x78c9730c9A8A645bD3022771F9509e65DCd3a499', '0xf65c05a521BAD596686aBf74c299fCa474D2b19b'],
                settings: { blockchainFormat: 'ethereum' }
            }, headers);

            if (method4.success) {
                console.log('✅ Method 4 SUCCESS!');
                return method4;
            }
        }

        console.log('❌ All execution methods failed');
        return false;
    }

    async step4_CheckTradeStatus() {
        console.log('\n📊 STEP 4: Checking Trade Status');
        
        if (!this.tenant || !this.tradeLoopId) return;

        const headers = { 'Authorization': `Bearer ${this.tenant.apiKey}` };

        try {
            // Try to get trade status
            const encodedId = encodeURIComponent(this.tradeLoopId);
            const statusResponse = await this.makeAPICall('GET', `/api/v1/blockchain/trades/status/${encodedId}`, null, headers);
            
            if (statusResponse.success) {
                console.log('✅ Trade status retrieved successfully');
                console.log(`📈 Status: ${statusResponse.status}`);
                return statusResponse;
            }
        } catch (error) {
            console.log('⚠️ Trade status endpoint failed');
        }

        return null;
    }

    async run() {
        console.log('🔍 DEBUG TRADE EXECUTION ISSUE');
        console.log('==============================\n');

        try {
            // Step 1: Create a simple trade loop
            const loopCreated = await this.step1_RecreateTradeLoop();
            
            if (!loopCreated) {
                console.log('❌ Failed to create trade loop for debugging');
                return;
            }

            // Step 2: Test discovery
            await this.step2_TestDiscoveryEndpoint();

            // Step 3: Test different execution methods
            const executionResult = await this.step3_TestDifferentExecutionMethods();

            // Step 4: Check trade status
            await this.step4_CheckTradeStatus();

            console.log('\n🎯 DEBUG RESULTS:');
            if (executionResult && executionResult.success) {
                console.log('🎉 EXECUTION SUCCESSFUL!');
                if (executionResult.transactionHash) {
                    console.log(`🔗 Transaction: ${executionResult.transactionHash}`);
                    console.log(`🌐 Etherscan: https://sepolia.etherscan.io/tx/${executionResult.transactionHash}`);
                }
            } else {
                console.log('🔍 DIAGNOSTIC INFORMATION:');
                console.log(`   Trade Loop ID: ${this.tradeLoopId}`);
                console.log(`   Tenant ID: ${this.tenant?.id}`);
                console.log('   Issue: Execution endpoint returns 404');
                console.log('   Possible causes:');
                console.log('     • Trade loop ID format mismatch');
                console.log('     • Execution service not finding trade');
                console.log('     • Different service handling execution vs discovery');
                console.log('     • Environment configuration still incomplete');
            }

        } catch (error) {
            console.error('💥 Debug failed:', error.message);
        }
    }
}

const debug = new DebugTradeExecution();
debug.run().catch(console.error);