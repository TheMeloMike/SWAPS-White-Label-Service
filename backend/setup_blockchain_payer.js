const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

async function setupPayerKeypair() {
    console.log('🔧 Setting up SWAPS Blockchain Payer Account...\n');
    
    // Connect to devnet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    // Generate a new keypair for the payer
    const payerKeypair = Keypair.generate();
    console.log('✅ Generated new payer keypair');
    console.log('   Public Key:', payerKeypair.publicKey.toBase58());
    
    // Request airdrop
    console.log('\n💰 Requesting SOL airdrop...');
    try {
        const airdropSignature = await connection.requestAirdrop(
            payerKeypair.publicKey,
            2 * LAMPORTS_PER_SOL // 2 SOL
        );
        
        console.log('   Airdrop signature:', airdropSignature);
        
        // Wait for confirmation
        await connection.confirmTransaction(airdropSignature);
        console.log('✅ Airdrop confirmed!');
        
        // Check balance
        const balance = await connection.getBalance(payerKeypair.publicKey);
        console.log('   Balance:', balance / LAMPORTS_PER_SOL, 'SOL');
        
    } catch (error) {
        console.error('❌ Airdrop failed:', error.message);
        console.log('   Please try again or use the Solana faucet manually');
    }
    
    // Save keypair to file
    const keypairPath = path.join(__dirname, 'blockchain_payer_keypair.json');
    const keypairData = Array.from(payerKeypair.secretKey);
    fs.writeFileSync(keypairPath, JSON.stringify(keypairData));
    console.log('\n✅ Keypair saved to:', keypairPath);
    
    // Create .env entry
    console.log('\n📝 Add this to your .env file:');
    console.log(`BLOCKCHAIN_PAYER_PRIVATE_KEY=${JSON.stringify(keypairData)}`);
    
    return payerKeypair;
}

// Run setup
setupPayerKeypair()
    .then((keypair) => {
        console.log('\n🎉 Setup complete! Payer account ready for blockchain operations.');
        console.log('\nNext steps:');
        console.log('1. The system will use this keypair automatically');
        console.log('2. You can now execute trades on-chain');
        console.log('3. Monitor transactions at: https://explorer.solana.com/address/' + keypair.publicKey.toBase58() + '?cluster=devnet');
    })
    .catch((error) => {
        console.error('\n❌ Setup failed:', error);
        process.exit(1);
    });