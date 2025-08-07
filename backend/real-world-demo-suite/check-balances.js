const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');

/**
 * Quick balance checker for manual funding verification
 */

async function checkBalances() {
    console.log('💰 CHECKING WALLET BALANCES');
    console.log('===========================');
    
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    // Load wallet addresses
    const walletFile = 'manual-funding-wallets.json';
    if (!fs.existsSync(walletFile)) {
        console.log('❌ No wallet file found. Run the keypair creation script first.');
        return;
    }
    
    const wallets = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
    
    try {
        // Check payer
        const payerKey = new PublicKey(wallets.participants[0].publicKey); // Using first participant key
        // Actually, let's reconstruct payer from secretKey
        const { Keypair } = require('@solana/web3.js');
        const payerKeypair = Keypair.fromSecretKey(new Uint8Array(wallets.payer));
        
        console.log('🔍 Checking balances...\n');
        
        const payerBalance = await connection.getBalance(payerKeypair.publicKey);
        console.log(`💰 Payer (${payerKeypair.publicKey.toBase58()})`);
        console.log(`   Balance: ${payerBalance / LAMPORTS_PER_SOL} SOL`);
        console.log(`   Status: ${payerBalance >= 1.5 * LAMPORTS_PER_SOL ? '✅ Sufficient' : '❌ Need more (min 1.5 SOL)'}`);
        console.log();
        
        let totalBalance = payerBalance / LAMPORTS_PER_SOL;
        let readyCount = payerBalance >= 1.5 * LAMPORTS_PER_SOL ? 1 : 0;
        
        for (const participant of wallets.participants) {
            const participantKeypair = Keypair.fromSecretKey(new Uint8Array(participant.secretKey));
            const balance = await connection.getBalance(participantKeypair.publicKey);
            const balanceSOL = balance / LAMPORTS_PER_SOL;
            
            console.log(`👤 ${participant.name} (${participantKeypair.publicKey.toBase58()})`);
            console.log(`   Balance: ${balanceSOL} SOL`);
            console.log(`   Status: ${balance >= 0.15 * LAMPORTS_PER_SOL ? '✅ Sufficient' : '❌ Need more (min 0.15 SOL)'}`);
            console.log();
            
            totalBalance += balanceSOL;
            if (balance >= 0.15 * LAMPORTS_PER_SOL) readyCount++;
        }
        
        console.log('📊 SUMMARY');
        console.log('==========');
        console.log(`Total Balance: ${totalBalance.toFixed(4)} SOL`);
        console.log(`Ready Wallets: ${readyCount}/4`);
        console.log(`Minimum Needed: ${1.5 + (3 * 0.15)} SOL total`);
        console.log();
        
        if (readyCount >= 3 && payerBalance >= 1.5 * LAMPORTS_PER_SOL) {
            console.log('🎉 READY FOR HISTORIC TRADE!');
            console.log('🚀 Run: node funded-historic-trade.js');
        } else if (readyCount >= 2 && payerBalance >= 1.0 * LAMPORTS_PER_SOL) {
            console.log('⚠️  Partial funding - might work with reduced participants');
            console.log('🔄 Try: node funded-historic-trade.js (may need adjustments)');
        } else {
            console.log('❌ INSUFFICIENT FUNDING');
            console.log('💡 Fund these addresses:');
            console.log(`   Payer: ${payerKeypair.publicKey.toBase58()} (need ${Math.max(0, 1.5 - payerBalance/LAMPORTS_PER_SOL).toFixed(2)} more SOL)`);
            wallets.participants.forEach((p, i) => {
                const needed = Math.max(0, 0.15 - (totalBalance - payerBalance/LAMPORTS_PER_SOL));
                if (needed > 0) {
                    const keypair = Keypair.fromSecretKey(new Uint8Array(p.secretKey));
                    console.log(`   ${p.name}: ${keypair.publicKey.toBase58()} (need ~0.15 SOL)`);
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Error checking balances:', error.message);
        console.log('💡 Try again in a moment - RPC might be temporarily unavailable');
    }
}

checkBalances().catch(console.error);