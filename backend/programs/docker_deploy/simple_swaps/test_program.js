#!/usr/bin/env node

const { Connection, PublicKey, Transaction, TransactionInstruction, Keypair, sendAndConfirmTransaction } = require('@solana/web3.js');

async function testSwapsProgram() {
    // Connect to devnet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    // Program ID of our deployed contract
    const programId = new PublicKey('3FqSeZWjAA8pVQ7ZoNna2J7FqikSynjUWsJ1dCGm1fZ5');
    
    // Use the same wallet that deployed the program
    const keypairData = JSON.parse(require('fs').readFileSync('/Users/pat.dentico/.config/solana/id.json'));
    const payer = Keypair.fromSecretKey(new Uint8Array(keypairData));
    
    console.log('🧪 Testing SWAPS Program');
    console.log('Program ID:', programId.toString());
    console.log('Payer:', payer.publicKey.toString());
    
    // Create test transaction
    const instruction = new TransactionInstruction({
        keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        ],
        programId,
        data: Buffer.from([0]) // Test instruction
    });
    
    const transaction = new Transaction().add(instruction);
    
    try {
        console.log('📤 Sending test transaction...');
        const signature = await sendAndConfirmTransaction(connection, transaction, [payer]);
        console.log('✅ Transaction successful!');
        console.log('🔗 Signature:', signature);
        console.log('🔍 View on Explorer: https://explorer.solana.com/tx/' + signature + '?cluster=devnet');
        
        // Get transaction details to see logs
        const txDetails = await connection.getTransaction(signature, { commitment: 'confirmed' });
        if (txDetails && txDetails.meta && txDetails.meta.logMessages) {
            console.log('\n📋 Program Logs:');
            txDetails.meta.logMessages.forEach(log => console.log('   ', log));
        }
        
    } catch (error) {
        console.error('❌ Transaction failed:', error.message);
    }
}

testSwapsProgram().catch(console.error);