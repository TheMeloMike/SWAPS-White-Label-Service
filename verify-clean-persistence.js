#!/usr/bin/env node

/**
 * Verify Clean Persistence Script
 * 
 * This script verifies that all persistence data has been cleaned
 * and no mock/test data remains in the system.
 */

const fs = require('fs');
const path = require('path');

const BACKEND_DATA_DIR = path.join(__dirname, 'backend', 'data');
const FILES_TO_CHECK = [
    'nftOwnership.json',
    'wallets.json',
    'wantedNfts.json',
    'tenant_usage.json'
];

console.log('🔍 VERIFYING CLEAN PERSISTENCE DATA');
console.log('===================================\n');

let allClean = true;

// Check each file
FILES_TO_CHECK.forEach(file => {
    const filePath = path.join(BACKEND_DATA_DIR, file);
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        
        // Check if empty
        const isEmpty = JSON.stringify(data) === '{}' || JSON.stringify(data) === '[]';
        
        if (isEmpty) {
            console.log(`✅ ${file}: CLEAN (empty)`);
        } else {
            console.log(`❌ ${file}: Contains data!`);
            console.log(`   Content: ${JSON.stringify(data).substring(0, 100)}...`);
            allClean = false;
        }
        
        // Check for mock patterns
        const mockPatterns = [
            'test_nft',
            'mock',
            'dummy',
            'placeholder',
            '0x0000000000000000000000000000000000000000',
            '11111111111111111111111111111112'
        ];
        
        const contentStr = JSON.stringify(data);
        mockPatterns.forEach(pattern => {
            if (contentStr.toLowerCase().includes(pattern.toLowerCase())) {
                console.log(`   ⚠️  Warning: Contains mock pattern: "${pattern}"`);
                allClean = false;
            }
        });
        
    } catch (error) {
        console.log(`⚠️  ${file}: Error reading - ${error.message}`);
    }
});

// Check rate limits file
console.log('\n📊 Operational Data:');
try {
    const rateLimits = JSON.parse(fs.readFileSync(path.join(BACKEND_DATA_DIR, 'rate_limits.json'), 'utf8'));
    console.log(`✅ rate_limits.json: Preserved (last saved: ${rateLimits.lastSaved || 'unknown'})`);
} catch (error) {
    console.log(`⚠️  rate_limits.json: ${error.message}`);
}

// Summary
console.log('\n📋 SUMMARY:');
if (allClean) {
    console.log('✅ All persistence files are clean!');
    console.log('✅ No mock or test data found!');
    console.log('✅ System is ready for real on-chain data!');
} else {
    console.log('❌ Some files contain data or mock patterns!');
    console.log('   Run clean-persistence-data.js to clean them.');
}

console.log('\n🎯 NEXT STEPS:');
console.log('1. Fix mock wallet generation in BlockchainTradeController');
console.log('2. Remove placeholder addresses from WhiteLabelController');
console.log('3. Update NFT IDs to use token-based mapping (already done in script)');
console.log('4. Test with fresh real on-chain data\n');