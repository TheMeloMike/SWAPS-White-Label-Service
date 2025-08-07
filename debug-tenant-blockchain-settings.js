#!/usr/bin/env node

/**
 * Debug Tenant Blockchain Settings
 * 
 * This script creates a tenant and checks if blockchain settings are properly saved and returned
 */

const axios = require('axios');

async function debugTenantCreation() {
    const apiBaseUrl = 'https://swaps-93hu.onrender.com';
    const adminApiKey = 'swaps_admin_prod_2025_secure_key_abc123';

    console.log('🔍 DEBUGGING TENANT BLOCKCHAIN SETTINGS');
    console.log('Creating a test tenant with explicit blockchain settings...\n');

    const tenantData = {
        name: 'Debug Test Tenant',
        contactEmail: 'debug@test.com',
        industry: 'gaming',
        blockchainSettings: {
            preferred: 'ethereum',
            allowSwitching: true,
            ethereumNetwork: 'sepolia',
            solanaNetwork: 'devnet'
        },
        algorithmSettings: {
            maxDepth: 6,
            enableCollectionTrading: true
        }
    };

    console.log('📤 Sending request with blockchain settings:');
    console.log(JSON.stringify(tenantData.blockchainSettings, null, 2));

    try {
        const response = await axios.post(`${apiBaseUrl}/api/v1/admin/tenants`, tenantData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminApiKey}`
            }
        });

        console.log('\n📥 Full API Response:');
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.success && response.data.tenant.settings) {
            console.log('\n🔍 Detailed Settings Analysis:');
            console.log('- Algorithm settings:', response.data.tenant.settings.algorithm);
            console.log('- Rate limits:', response.data.tenant.settings.rateLimits);
            console.log('- Webhooks:', response.data.tenant.settings.webhooks);
            console.log('- Security:', response.data.tenant.settings.security);
            console.log('- Blockchain:', response.data.tenant.settings.blockchain);

            if (response.data.tenant.settings.blockchain) {
                console.log('\n✅ BLOCKCHAIN SETTINGS FOUND:');
                console.log('  - Preferred:', response.data.tenant.settings.blockchain.preferred);
                console.log('  - Allow Switching:', response.data.tenant.settings.blockchain.allowSwitching);
                console.log('  - Ethereum Network:', response.data.tenant.settings.blockchain.ethereumNetwork);
                console.log('  - Solana Network:', response.data.tenant.settings.blockchain.solanaNetwork);
            } else {
                console.log('\n❌ BLOCKCHAIN SETTINGS MISSING FROM RESPONSE');
            }
        } else {
            console.log('\n❌ No settings found in response');
        }

    } catch (error) {
        console.error('\n💥 Error:', error.response ? error.response.data : error.message);
    }
}

debugTenantCreation().catch(console.error);