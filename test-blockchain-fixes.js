#!/usr/bin/env node

/**
 * Test Blockchain Fixes
 * 
 * This script tests the two blockchain fixes:
 * 1. Blockchain settings visibility in tenant creation response
 * 2. Tenant-aware blockchain info endpoint
 */

const axios = require('axios');

class BlockchainFixesTest {
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

    async testFix1_BlockchainSettingsVisibility() {
        console.log('\n🔧 FIX 1: Testing Blockchain Settings Visibility in Tenant Creation');
        
        const tenantData = {
            name: 'Blockchain Settings Test',
            contactEmail: 'blockchain@test.com',
            industry: 'gaming',
            blockchainSettings: {
                preferred: 'ethereum',
                allowSwitching: true,
                ethereumNetwork: 'sepolia',
                solanaNetwork: 'devnet'
            }
        };

        console.log('📤 Creating tenant with explicit blockchain settings...');
        const response = await this.makeAPICall('POST', '/api/v1/admin/tenants', tenantData, {
            'Authorization': `Bearer ${this.adminApiKey}`
        });

        if (response.success && response.tenant.settings?.blockchain) {
            console.log('✅ FIX 1 SUCCESSFUL: Blockchain settings are now visible in response!');
            console.log('🔍 Blockchain Settings:');
            console.log('  - Preferred:', response.tenant.settings.blockchain.preferred);
            console.log('  - Allow Switching:', response.tenant.settings.blockchain.allowSwitching);
            console.log('  - Ethereum Network:', response.tenant.settings.blockchain.ethereumNetwork);
            console.log('  - Solana Network:', response.tenant.settings.blockchain.solanaNetwork);
            
            return {
                success: true,
                tenant: response.tenant
            };
        } else {
            console.log('❌ FIX 1 STILL BROKEN: Blockchain settings missing from response');
            console.log('🔍 Available settings keys:', Object.keys(response.tenant.settings || {}));
            
            return {
                success: false,
                tenant: response.tenant
            };
        }
    }

    async testFix2_TenantAwareBlockchainInfo(tenant) {
        console.log('\n🔧 FIX 2: Testing Tenant-Aware Blockchain Info Endpoint');

        if (!tenant) {
            console.log('❌ Cannot test Fix 2: No tenant available');
            return { success: false };
        }

        // Test 1: Blockchain info without authentication (should show default)
        console.log('\n📊 Test 2A: Blockchain info without tenant authentication');
        const globalInfo = await this.makeAPICall('GET', '/api/v1/blockchain/info');
        console.log('🌐 Global Response (no auth):', globalInfo.blockchain.network);
        
        // Test 2: Blockchain info with tenant authentication (should show tenant-specific)
        console.log('\n📊 Test 2B: Blockchain info with tenant authentication');
        const tenantInfo = await this.makeAPICall('GET', '/api/v1/blockchain/info', null, {
            'Authorization': `Bearer ${tenant.apiKey}`
        });
        
        console.log('🎯 Tenant-specific Response:');
        console.log('  - Network:', tenantInfo.blockchain.network);
        console.log('  - Chain/Program ID:', tenantInfo.blockchain.contractAddress || tenantInfo.blockchain.programId);
        
        if (tenantInfo.tenantInfo) {
            console.log('  - Tenant Blockchain Preference:', tenantInfo.tenantInfo.blockchainPreference);
            console.log('  - Allow Switching:', tenantInfo.tenantInfo.allowSwitching);
            console.log('✅ FIX 2 SUCCESSFUL: Tenant-specific blockchain info is working!');
            return { success: true };
        } else {
            console.log('❌ FIX 2 STILL BROKEN: Tenant info missing from response');
            return { success: false };
        }
    }

    async testBothFixes() {
        console.log('🧪 TESTING BLOCKCHAIN FIXES');
        console.log('🔗 API: https://swaps-93hu.onrender.com\n');

        const results = {
            fix1: { success: false },
            fix2: { success: false }
        };

        try {
            // Test Fix 1: Blockchain settings visibility
            const fix1Result = await this.testFix1_BlockchainSettingsVisibility();
            results.fix1 = fix1Result;

            // Test Fix 2: Tenant-aware blockchain info
            const fix2Result = await this.testFix2_TenantAwareBlockchainInfo(fix1Result.tenant);
            results.fix2 = fix2Result;

            // Summary
            console.log('\n📋 FIXES TEST SUMMARY:');
            console.log(`${results.fix1.success ? '✅' : '❌'} Fix 1: Blockchain settings visibility in tenant creation`);
            console.log(`${results.fix2.success ? '✅' : '❌'} Fix 2: Tenant-aware blockchain info endpoint`);

            if (results.fix1.success && results.fix2.success) {
                console.log('\n🎉 ALL FIXES SUCCESSFUL! Tenant blockchain toggle is fully operational!');
            } else {
                console.log('\n⚠️ Some fixes still need deployment. Check if latest code is deployed.');
            }

        } catch (error) {
            console.error('\n💥 Test failed:', error.message);
        }

        return results;
    }

    async run() {
        return await this.testBothFixes();
    }
}

// Run the test
const test = new BlockchainFixesTest();
test.run().catch(console.error);