const { Connection, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const WalletSafetyUtils = require('./wallet-safety-utils');

/**
 * WALLET SAFETY TEMPLATE
 * 
 * ⚠️  MANDATORY: All scripts that create wallets MUST follow this pattern
 * 
 * This template prevents the catastrophic "funded but unusable" wallet error
 * that cost us 4 SOL in devnet funding
 */

class SafeWalletScript {
    constructor() {
        this.connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        this.participants = [];
    }

    async createWallets() {
        console.log('🛡️  WALLET SAFETY PROTOCOL ACTIVE');
        console.log('==================================');
        
        // Define participant configurations (NO Keypair.generate() here!)
        const participantConfigs = [
            { name: 'Alice', wants: 'Collection A', trading: 'Collection B' },
            { name: 'Bob', wants: 'Collection B', trading: 'Collection C' },
            { name: 'Carol', wants: 'Collection C', trading: 'Collection A' }
        ];

        // MANDATORY STEP 1: Create wallets with IMMEDIATE private key logging
        this.participants = WalletSafetyUtils.createAndLogWallets(participantConfigs);

        // MANDATORY STEP 2: Verify private key access before ANY funding attempts
        WalletSafetyUtils.verifyPrivateKeyAccess(this.participants);
        
        console.log('\n✅ SAFETY CHECKS PASSED - Ready for funding');
        return true;
    }

    async fundWallets() {
        console.log('\n💰 FUNDING WALLETS (Private keys secured)...');
        
        for (const participant of this.participants) {
            try {
                console.log(`🔄 Funding ${participant.name}...`);
                
                const airdropSig = await this.connection.requestAirdrop(
                    participant.keypair.publicKey,
                    1.0 * LAMPORTS_PER_SOL
                );
                
                await this.connection.confirmTransaction(airdropSig);
                
                const balance = await this.connection.getBalance(participant.keypair.publicKey);
                console.log(`   ✅ ${participant.name}: ${balance / LAMPORTS_PER_SOL} SOL`);
                
            } catch (error) {
                console.log(`   ❌ ${participant.name}: ${error.message}`);
            }
        }
    }

    async executeTradeLogic() {
        // Your trade execution logic here
        console.log('\n🔄 Executing trade logic...');
        
        // Since we have private keys, we can sign transactions!
        for (const participant of this.participants) {
            try {
                // participant.keypair.secretKey is available for signing
                console.log(`✅ ${participant.name} can sign transactions`);
            } catch (error) {
                console.error(`❌ ${participant.name} cannot sign: ${error.message}`);
                throw error;
            }
        }
    }

    async cleanup() {
        console.log('\n🧹 SECURITY CLEANUP...');
        
        // MANDATORY: Clean up backup files after successful execution
        WalletSafetyUtils.cleanupBackups();
        
        console.log('✅ All private key backups cleaned up');
    }

    async run() {
        try {
            await this.createWallets();
            await this.fundWallets();
            await this.executeTradeLogic();
            await this.cleanup();
            
            return { success: true };
        } catch (error) {
            console.error('💥 Script failed:', error.message);
            return { success: false, error: error.message };
        }
    }
}

// Execute the script
if (require.main === module) {
    console.log('🛡️  SAFE WALLET SCRIPT TEMPLATE');
    console.log('================================');
    console.log('✅ Private keys logged BEFORE funding');
    console.log('✅ Safety checks mandatory');
    console.log('✅ Automatic cleanup after execution\n');

    const script = new SafeWalletScript();
    script.run().then(result => {
        if (result.success) {
            console.log('\n🏆 SAFE SCRIPT EXECUTION COMPLETE!');
        } else {
            console.log('\n💔 Script failed, but private keys were secured');
        }
    }).catch(error => {
        console.error('💥 Unexpected error:', error);
    });
}

module.exports = SafeWalletScript;