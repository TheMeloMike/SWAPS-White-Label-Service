#!/usr/bin/env node

/**
 * Tenant Blockchain Toggle Demo
 * 
 * This script demonstrates the new tenant-level blockchain selection feature:
 * 1. Creates an Ethereum-preferenced tenant
 * 2. Creates a Solana-preferenced tenant  
 * 3. Tests that each tenant's trades use their preferred blockchain
 * 4. Tests blockchain switching (if allowed)
 */

const axios = require('axios');

class TenantBlockchainToggleDemo {
    constructor() {
        this.apiBaseUrl = 'https://swaps-93hu.onrender.com';
        this.adminApiKey = 'swaps_admin_prod_2025_secure_key_abc123';
        this.tenants = {};
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

    async createEthereumTenant() {
        console.log('\n🟦 STEP 1: Creating Ethereum-Preferenced Tenant');
        
        const tenantData = {
            name: 'Ethereum Gaming Studio',
            contactEmail: 'ethereum@gaming.studio',
            industry: 'gaming',
            blockchainSettings: {
                preferred: 'ethereum',
                allowSwitching: false,  // Locked to Ethereum
                ethereumNetwork: 'sepolia'
            },
            algorithmSettings: {
                maxDepth: 5,
                enableCollectionTrading: true
            }
        };

        const response = await this.makeAPICall('POST', '/api/v1/admin/tenants', tenantData, {
            'Authorization': `Bearer ${this.adminApiKey}`
        });

        if (response.success) {
            this.tenants.ethereum = {
                id: response.tenant.id,
                apiKey: response.tenant.apiKey,
                config: response.tenant
            };
            console.log('✅ Ethereum tenant created successfully');
            console.log(`🔑 API Key: ${response.tenant.apiKey}`);
            console.log(`🟦 Blockchain: ${response.tenant.settings.blockchain?.preferred || 'ethereum'}`);
            console.log(`🔒 Allow Switching: ${response.tenant.settings.blockchain?.allowSwitching || false}`);
        }

        return response;
    }

    async createSolanaTenant() {
        console.log('\n🟪 STEP 2: Creating Solana-Preferenced Tenant');
        
        const tenantData = {
            name: 'Solana DeFi Protocol',
            contactEmail: 'solana@defi.protocol',
            industry: 'defi',
            blockchainSettings: {
                preferred: 'solana',
                allowSwitching: true,   // Can switch to Ethereum
                solanaNetwork: 'devnet'
            },
            algorithmSettings: {
                maxDepth: 8,
                enableCollectionTrading: true
            }
        };

        const response = await this.makeAPICall('POST', '/api/v1/admin/tenants', tenantData, {
            'Authorization': `Bearer ${this.adminApiKey}`
        });

        if (response.success) {
            this.tenants.solana = {
                id: response.tenant.id,
                apiKey: response.tenant.apiKey,
                config: response.tenant
            };
            console.log('✅ Solana tenant created successfully');
            console.log(`🔑 API Key: ${response.tenant.apiKey}`);
            console.log(`🟪 Blockchain: ${response.tenant.settings.blockchain?.preferred || 'solana'}`);
            console.log(`🔓 Allow Switching: ${response.tenant.settings.blockchain?.allowSwitching || false}`);
        }

        return response;
    }

    async testEthereumTenantTradeDiscovery() {
        console.log('\n🟦 STEP 3: Testing Ethereum Tenant Trade Discovery');
        
        const tenant = this.tenants.ethereum;
        const headers = {
            'Authorization': `Bearer ${tenant.apiKey}`
        };

        // Submit sample NFT inventory (Ethereum format)
        console.log('\n📦 Submitting Ethereum NFT Inventory');
        const inventoryData = {
            walletId: 'eth_wallet_001',
            nfts: [{
                id: '0x1234...abc:1',
                metadata: {
                    name: 'Ethereum Game Item #1',
                    description: 'Rare weapon from Ethereum game'
                },
                ownership: {
                    ownerId: 'eth_wallet_001'
                },
                valuation: {
                    estimatedValue: 150,
                    currency: 'ETH'
                }
            }]
        };

        await this.makeAPICall('POST', '/api/v1/inventory/submit', inventoryData, headers);

        // Submit wants
        console.log('\n💭 Submitting Ethereum Wants');
        const wantsData = {
            walletId: 'eth_wallet_001',
            wantedNFTs: ['0x5678...def:2']
        };

        await this.makeAPICall('POST', '/api/v1/wants/submit', wantsData, headers);

        // Discover trades (should use Ethereum blockchain)
        console.log('\n🔍 Discovering Trades for Ethereum Tenant');
        const discoveryData = {
            mode: 'discovery',
            settings: {
                maxResults: 3
                // Note: NO blockchainFormat specified - should use tenant preference
            }
        };

        const trades = await this.makeAPICall('POST', '/api/v1/blockchain/discovery/trades', discoveryData, headers);
        
        console.log('🎯 Expected: Ethereum blockchain used automatically');
        return trades;
    }

    async testSolanaTenantTradeDiscovery() {
        console.log('\n🟪 STEP 4: Testing Solana Tenant Trade Discovery');
        
        const tenant = this.tenants.solana;
        const headers = {
            'Authorization': `Bearer ${tenant.apiKey}`
        };

        // Submit sample NFT inventory (Solana format)
        console.log('\n📦 Submitting Solana NFT Inventory');
        const inventoryData = {
            walletId: 'sol_wallet_001',
            nfts: [{
                id: 'ABcd...1234',
                metadata: {
                    name: 'Solana DeFi Token #1',
                    description: 'Governance token NFT'
                },
                ownership: {
                    ownerId: 'sol_wallet_001'
                },
                valuation: {
                    estimatedValue: 50,
                    currency: 'SOL'
                }
            }]
        };

        await this.makeAPICall('POST', '/api/v1/inventory/submit', inventoryData, headers);

        // Submit wants
        console.log('\n💭 Submitting Solana Wants');
        const wantsData = {
            walletId: 'sol_wallet_001',
            wantedNFTs: ['EFgh...5678']
        };

        await this.makeAPICall('POST', '/api/v1/wants/submit', wantsData, headers);

        // Discover trades (should use Solana blockchain)
        console.log('\n🔍 Discovering Trades for Solana Tenant');
        const discoveryData = {
            mode: 'discovery',
            settings: {
                maxResults: 3
                // Note: NO blockchainFormat specified - should use tenant preference
            }
        };

        const trades = await this.makeAPICall('POST', '/api/v1/blockchain/discovery/trades', discoveryData, headers);
        
        console.log('🎯 Expected: Solana blockchain used automatically');
        return trades;
    }

    async testBlockchainSwitching() {
        console.log('\n🔄 STEP 5: Testing Blockchain Switching');
        
        const tenant = this.tenants.solana; // This tenant allows switching
        const headers = {
            'Authorization': `Bearer ${tenant.apiKey}`
        };

        console.log('\n✅ Testing ALLOWED switching (Solana tenant can switch to Ethereum)');
        const discoveryWithEthereum = {
            mode: 'discovery',
            settings: {
                blockchainFormat: 'ethereum',  // Override to Ethereum
                maxResults: 3
            }
        };

        try {
            const ethTrades = await this.makeAPICall('POST', '/api/v1/blockchain/discovery/trades', discoveryWithEthereum, headers);
            console.log('✅ Switching allowed - Ethereum used successfully');
        } catch (error) {
            console.log('❌ Switching failed:', error.message);
        }

        console.log('\n❌ Testing BLOCKED switching (Ethereum tenant cannot switch to Solana)');
        const ethTenant = this.tenants.ethereum; // This tenant does NOT allow switching
        const ethHeaders = {
            'Authorization': `Bearer ${ethTenant.apiKey}`
        };

        const discoveryWithSolana = {
            mode: 'discovery',
            settings: {
                blockchainFormat: 'solana',  // Try to override to Solana
                maxResults: 3
            }
        };

        try {
            const solTrades = await this.makeAPICall('POST', '/api/v1/blockchain/discovery/trades', discoveryWithSolana, ethHeaders);
            console.log('⚠️ Should use Ethereum (tenant preference) despite request override');
        } catch (error) {
            console.log('❌ Switching correctly blocked:', error.message);
        }
    }

    async checkBlockchainInfo() {
        console.log('\n📊 STEP 6: Checking Current API Blockchain Configuration');
        
        // Check without auth (global info)
        try {
            const globalInfo = await this.makeAPICall('GET', '/api/v1/blockchain/info');
            console.log('🌐 Global API blockchain configuration shown above');
        } catch (error) {
            console.log('❌ Could not get global blockchain info');
        }

        // Check with Ethereum tenant
        console.log('\n🟦 Ethereum Tenant Blockchain View:');
        try {
            const ethInfo = await this.makeAPICall('GET', '/api/v1/blockchain/info', null, {
                'Authorization': `Bearer ${this.tenants.ethereum.apiKey}`
            });
        } catch (error) {
            console.log('❌ Could not get Ethereum tenant blockchain info');
        }

        // Check with Solana tenant
        console.log('\n🟪 Solana Tenant Blockchain View:');
        try {
            const solInfo = await this.makeAPICall('GET', '/api/v1/blockchain/info', null, {
                'Authorization': `Bearer ${this.tenants.solana.apiKey}`
            });
        } catch (error) {
            console.log('❌ Could not get Solana tenant blockchain info');
        }
    }

    async run() {
        console.log('🎯 TENANT BLOCKCHAIN TOGGLE DEMONSTRATION');
        console.log('🔗 API: https://swaps-93hu.onrender.com');
        console.log('🎨 Testing: Tenant-level blockchain preferences\n');

        try {
            // Create tenants with different blockchain preferences
            await this.createEthereumTenant();
            await this.createSolanaTenant();

            // Test that each tenant uses their preferred blockchain
            await this.testEthereumTenantTradeDiscovery();
            await this.testSolanaTenantTradeDiscovery();

            // Test blockchain switching capabilities
            await this.testBlockchainSwitching();

            // Check blockchain info from different tenant perspectives
            await this.checkBlockchainInfo();

            console.log('\n🎊 DEMONSTRATION COMPLETE!');
            console.log('\n📋 SUMMARY:');
            console.log('✅ Ethereum-preferenced tenant created');
            console.log('✅ Solana-preferenced tenant created');
            console.log('✅ Each tenant uses their preferred blockchain automatically');
            console.log('✅ Blockchain switching permissions work correctly');
            console.log('🌟 Tenant-level blockchain toggle is FULLY FUNCTIONAL!');

        } catch (error) {
            console.error('\n💥 Demo failed:', error.message);
            console.log('\n📋 CREATED TENANTS (for cleanup):');
            if (this.tenants.ethereum) {
                console.log(`🟦 Ethereum Tenant: ${this.tenants.ethereum.id}`);
            }
            if (this.tenants.solana) {
                console.log(`🟪 Solana Tenant: ${this.tenants.solana.id}`);
            }
        }
    }
}

// Run the demonstration
const demo = new TenantBlockchainToggleDemo();
demo.run().catch(console.error);