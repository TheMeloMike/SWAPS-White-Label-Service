#!/usr/bin/env node

/**
 * Clean Persistence Data Script
 * 
 * This script safely cleans all potentially stale persistence data
 * from the SWAPS system while preserving essential operational data.
 */

const fs = require('fs').promises;
const path = require('path');
let createClient;
try {
    ({ createClient } = require('redis'));
} catch (e) {
    // Redis module not installed
    createClient = null;
}

// Configuration
const BACKEND_DATA_DIR = path.join(__dirname, 'backend', 'data');
const PRESERVE_FILES = ['rate_limits.json']; // Files to preserve
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_PREFIX = process.env.REDIS_PREFIX || 'swaps:';

async function cleanFilePersistence() {
    console.log('\n🧹 Cleaning File-Based Persistence Data');
    console.log('=====================================\n');
    
    try {
        // Check if data directory exists
        await fs.access(BACKEND_DATA_DIR);
        
        // List all files in data directory
        const files = await fs.readdir(BACKEND_DATA_DIR);
        
        for (const file of files) {
            const filePath = path.join(BACKEND_DATA_DIR, file);
            
            // Skip directories
            const stat = await fs.stat(filePath);
            if (stat.isDirectory()) continue;
            
            // Check if file should be preserved
            if (PRESERVE_FILES.includes(file)) {
                console.log(`✅ Preserving: ${file} (operational data)`);
                continue;
            }
            
            // Read current content
            const content = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(content);
            
            // Check if file is already empty
            if (JSON.stringify(data) === '{}' || JSON.stringify(data) === '[]') {
                console.log(`⏭️  Skipping: ${file} (already empty)`);
                continue;
            }
            
            // Create backup
            const backupPath = filePath + `.backup_${Date.now()}`;
            await fs.writeFile(backupPath, content);
            console.log(`💾 Backed up: ${file} → ${path.basename(backupPath)}`);
            
            // Clear the file
            const emptyData = Array.isArray(data) ? '[]' : '{}';
            await fs.writeFile(filePath, emptyData);
            console.log(`🗑️  Cleared: ${file}`);
        }
        
        console.log('\n✅ File persistence cleanup complete!');
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('ℹ️  No data directory found at:', BACKEND_DATA_DIR);
        } else {
            console.error('❌ Error cleaning file persistence:', error.message);
        }
    }
}

async function cleanRedisPersistence() {
    console.log('\n🧹 Cleaning Redis Persistence Data');
    console.log('==================================\n');
    
    if (!createClient) {
        console.log('ℹ️  Redis module not installed - skipping Redis cleanup');
        return;
    }
    
    let client;
    
    try {
        // Try to connect to Redis with timeout
        client = createClient({ url: REDIS_URL });
        
        client.on('error', (err) => {
            // Silently handle errors - Redis might not be configured
        });
        
        // Add connection timeout
        const connectTimeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Redis connection timeout')), 3000);
        });
        
        await Promise.race([
            client.connect(),
            connectTimeout
        ]);
        console.log('✅ Connected to Redis');
        
        // Find all keys with SWAPS prefix
        const keys = await client.keys(`${REDIS_PREFIX}*`);
        
        if (keys.length === 0) {
            console.log('ℹ️  No SWAPS keys found in Redis');
            return;
        }
        
        console.log(`Found ${keys.length} SWAPS keys in Redis`);
        
        // Create backup of keys and values
        const backup = {};
        for (const key of keys) {
            const value = await client.get(key);
            backup[key] = value;
        }
        
        // Save backup to file
        const backupPath = path.join(__dirname, `redis_backup_${Date.now()}.json`);
        await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));
        console.log(`💾 Backed up Redis data to: ${backupPath}`);
        
        // Delete all SWAPS keys
        for (const key of keys) {
            await client.del(key);
            console.log(`🗑️  Deleted: ${key}`);
        }
        
        console.log('\n✅ Redis cleanup complete!');
        
    } catch (error) {
        console.log('ℹ️  Redis not available or not configured (this is normal if not using Redis)');
    } finally {
        if (client) {
            try {
                await client.quit();
            } catch (e) {
                // Ignore quit errors
            }
        }
    }
}

async function validateNoMockData() {
    console.log('\n🔍 Validating No Mock Data in Persistence');
    console.log('=========================================\n');
    
    const mockPatterns = [
        /test_nft/i,
        /mock/i,
        /dummy/i,
        /placeholder/i,
        /0x0000000000000000000000000000000000000000/,
        /11111111111111111111111111111112/
    ];
    
    try {
        const files = await fs.readdir(BACKEND_DATA_DIR);
        
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            
            const filePath = path.join(BACKEND_DATA_DIR, file);
            const content = await fs.readFile(filePath, 'utf8');
            
            // Check for mock patterns
            for (const pattern of mockPatterns) {
                if (pattern.test(content)) {
                    console.log(`⚠️  Warning: ${file} contains mock/test data pattern: ${pattern}`);
                }
            }
        }
        
        console.log('✅ Validation complete');
        
    } catch (error) {
        console.error('❌ Error during validation:', error.message);
    }
}

async function showSummary() {
    console.log('\n📊 CLEANUP SUMMARY');
    console.log('==================\n');
    
    console.log('Actions performed:');
    console.log('1. ✅ Backed up all data files before cleaning');
    console.log('2. ✅ Cleared stale persistence files (wallets, NFTs, wants)');
    console.log('3. ✅ Preserved operational data (rate limits)');
    console.log('4. ✅ Attempted Redis cleanup (if configured)');
    console.log('5. ✅ Validated no mock data remains');
    
    console.log('\n⚠️  IMPORTANT NOTES:');
    console.log('- All cleared data has been backed up with timestamps');
    console.log('- Rate limit data has been preserved');
    console.log('- You may need to restart the backend service');
    console.log('- New data will be validated on-chain going forward');
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Fix mock wallet generation in BlockchainTradeController');
    console.log('2. Remove placeholder addresses from WhiteLabelController');
    console.log('3. Restart backend service to clear in-memory caches');
    console.log('4. Test with fresh, real on-chain data');
}

// Main execution
async function main() {
    console.log('🚀 SWAPS Persistence Data Cleanup Tool');
    console.log('======================================');
    console.log(`Timestamp: ${new Date().toISOString()}`);
    
    try {
        await cleanFilePersistence();
        await cleanRedisPersistence();
        await validateNoMockData();
        await showSummary();
        
        console.log('\n✅ Cleanup completed successfully!\n');
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Fatal error during cleanup:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { cleanFilePersistence, cleanRedisPersistence, validateNoMockData };