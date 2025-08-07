const { Keypair } = require('@solana/web3.js');
const fs = require('fs');

/**
 * WALLET SAFETY UTILITIES
 * Prevents the catastrophic loss of private keys that cost us 4 SOL
 */

class WalletSafetyUtils {
    /**
     * Create and IMMEDIATELY log private keys before any funding attempts
     * CRITICAL: This prevents the "funded but unusable" wallet disaster
     */
    static createAndLogWallets(participants) {
        console.log('🛡️  WALLET SAFETY PROTOCOL ACTIVE');
        console.log('==================================');
        
        const wallets = participants.map(config => ({
            ...config,
            keypair: Keypair.generate()
        }));

        // MANDATORY: Log addresses
        console.log('📋 Wallet addresses:');
        wallets.forEach(w => {
            console.log(`   ${w.name}: ${w.keypair.publicKey.toBase58()}`);
        });

        // CRITICAL: Log private keys IMMEDIATELY
        console.log('\n🔑 CRITICAL: Private keys (SAVE THESE NOW!):');
        wallets.forEach(w => {
            console.log(`   ${w.name} Private Key: [${Array.from(w.keypair.secretKey).join(',')}]`);
        });

        // EMERGENCY BACKUP: Auto-save to file
        const backupData = {};
        wallets.forEach(w => {
            backupData[w.name] = {
                publicKey: w.keypair.publicKey.toBase58(),
                privateKey: Array.from(w.keypair.secretKey)
            };
        });

        const backupFile = `wallet-backup-${Date.now()}.json`;
        fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
        
        console.log(`\n💾 EMERGENCY BACKUP: Keys saved to ${backupFile}`);
        console.log('   ⚠️  DELETE this file after successful trade execution!');
        console.log('   🔒 NEVER commit this file to git!');

        return wallets;
    }

    /**
     * Load wallets from private keys (recovery function)
     */
    static loadWalletsFromKeys(walletData) {
        const wallets = [];
        
        for (const [name, data] of Object.entries(walletData)) {
            try {
                const keypair = Keypair.fromSecretKey(new Uint8Array(data.privateKey));
                wallets.push({
                    name,
                    keypair,
                    publicKey: keypair.publicKey.toBase58()
                });
                
                console.log(`✅ Loaded ${name}: ${keypair.publicKey.toBase58()}`);
            } catch (error) {
                console.error(`❌ Failed to load ${name}: ${error.message}`);
            }
        }
        
        return wallets;
    }

    /**
     * Verify we have private keys before attempting any blockchain operations
     */
    static verifyPrivateKeyAccess(wallets) {
        console.log('\n🔍 SAFETY CHECK: Verifying private key access...');
        
        let allGood = true;
        wallets.forEach(w => {
            try {
                // Try to access the secret key
                const secretKey = w.keypair.secretKey;
                if (secretKey && secretKey.length === 64) {
                    console.log(`   ✅ ${w.name}: Private key accessible`);
                } else {
                    console.log(`   ❌ ${w.name}: Invalid private key`);
                    allGood = false;
                }
            } catch (error) {
                console.log(`   ❌ ${w.name}: Cannot access private key - ${error.message}`);
                allGood = false;
            }
        });

        if (!allGood) {
            throw new Error('CRITICAL: Some wallets lack private key access!');
        }

        console.log('   🛡️  All private keys verified accessible');
        return true;
    }

    /**
     * Clean up backup files after successful operations
     */
    static cleanupBackups() {
        const files = fs.readdirSync('.');
        const backupFiles = files.filter(f => f.startsWith('wallet-backup-') && f.endsWith('.json'));
        
        if (backupFiles.length > 0) {
            console.log('\n🧹 Cleaning up wallet backup files...');
            backupFiles.forEach(file => {
                fs.unlinkSync(file);
                console.log(`   🗑️  Deleted ${file}`);
            });
            console.log('   ✅ All backup files cleaned up');
        }
    }
}

module.exports = WalletSafetyUtils;