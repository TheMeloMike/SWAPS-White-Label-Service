const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

/**
 * Generate fresh wallets for HISTORIC 3-WAY TRADE
 * Get addresses for manual funding before running the trade
 */

console.log('🏆 GENERATING FRESH WALLETS FOR HISTORIC TRADE');
console.log('==============================================');
console.log('');

// Generate fresh payer
const payer = Keypair.generate();
console.log('💰 PAYER WALLET (fund this with 2-3 SOL):');
console.log('  Address:', payer.publicKey.toBase58());
console.log('');

// Generate 3 participants
const participants = [
    { name: 'Alice', keypair: Keypair.generate() },
    { name: 'Bob', keypair: Keypair.generate() },
    { name: 'Carol', keypair: Keypair.generate() }
];

console.log('👥 PARTICIPANT WALLETS (fund each with 0.2 SOL):');
participants.forEach(p => {
    console.log(`  ${p.name}: ${p.keypair.publicKey.toBase58()}`);
});

console.log('');
console.log('💡 FUNDING INSTRUCTIONS:');
console.log('========================');
console.log('Option 1: Solana CLI');
console.log(`  solana airdrop 2 ${payer.publicKey.toBase58()} --url devnet`);
participants.forEach(p => {
    console.log(`  solana airdrop 0.2 ${p.keypair.publicKey.toBase58()} --url devnet`);
});

console.log('');
console.log('Option 2: Web Faucets');
console.log('  Visit: https://faucet.solana.com (paste addresses above)');
console.log('  Or: https://solfaucet.com');

console.log('');
console.log('Option 3: Copy addresses for easy pasting:');
console.log('PAYER:', payer.publicKey.toBase58());
participants.forEach(p => {
    console.log(`${p.name.toUpperCase()}:`, p.keypair.publicKey.toBase58());
});

// Save keypairs for the trade script
const wallets = {
    payer: Array.from(payer.secretKey),
    participants: participants.map(p => ({
        name: p.name,
        secretKey: Array.from(p.keypair.secretKey),
        publicKey: p.keypair.publicKey.toBase58()
    }))
};

fs.writeFileSync(path.join(__dirname, 'fresh-wallets.json'), JSON.stringify(wallets, null, 2));

console.log('');
console.log('✅ Wallets saved to fresh-wallets.json');
console.log('💫 Once funded, run: node funded-historic-trade.js');