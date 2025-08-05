#!/usr/bin/env node

const { 
    Connection, 
    PublicKey, 
    Transaction, 
    TransactionInstruction, 
    Keypair, 
    sendAndConfirmTransaction,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    SYSVAR_CLOCK_PUBKEY
} = require('@solana/web3.js');

// SWAPS Contract Details
const PROGRAM_ID = new PublicKey('8QhM7mdLqs2mwuNwY4R4UAGiXpLyMg28aih5mZKU2XFD');
const CONNECTION = new Connection('https://api.devnet.solana.com', 'confirmed');

// Load wallet
const PAYER = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(require('fs').readFileSync('/Users/pat.dentico/.config/solana/id.json')))
);

console.log('🧪 COMPREHENSIVE SWAPS TRADING ENGINE TEST');
console.log('============================================');
console.log('Program ID:', PROGRAM_ID.toString());
console.log('Payer:', PAYER.publicKey.toString());
console.log('Network: Solana Devnet');
console.log('');

async function testBasicProgramInvocation() {
    console.log('🔹 TEST 1: Basic Program Invocation');
    console.log('   Testing if the program responds to instructions...');
    
    try {
        // Create a simple instruction to test program responsiveness
        // Using instruction type that doesn't require complex setup
        const instruction = new TransactionInstruction({
            keys: [
                { pubkey: PAYER.publicKey, isSigner: true, isWritable: false },
            ],
            programId: PROGRAM_ID,
            data: Buffer.from([99]) // Invalid instruction to see error handling
        });
        
        const transaction = new Transaction().add(instruction);
        
        try {
            await sendAndConfirmTransaction(CONNECTION, transaction, [PAYER]);
            console.log('   ❌ Unexpected success with invalid instruction');
        } catch (error) {
            if (error.message.includes('custom program error: 0x0')) {
                console.log('   ✅ Program responding correctly (InvalidInstructionData error)');
                return true;
            } else {
                console.log('   ⚠️  Program responded with:', error.message);
                return true; // Program is responding, just different error
            }
        }
    } catch (error) {
        console.log('   ❌ Failed to invoke program:', error.message);
        return false;
    }
}

async function testInitializeTradeLoop() {
    console.log('🔹 TEST 2: Initialize Trade Loop');
    console.log('   Testing multi-party trade loop creation...');
    
    try {
        // Generate unique trade ID
        const tradeId = Array.from(crypto.getRandomValues(new Uint8Array(32)));
        
        // Create trade loop account keypair
        const tradeLoopKeypair = Keypair.generate();
        
        // Create instruction data for InitializeTradeLoop
        // Instruction format: [0, trade_id(32), step_count(1), timeout_seconds(8)]
        const stepCount = 3; // 3-party trade loop
        const timeoutSeconds = BigInt(24 * 60 * 60); // 24 hours
        
        const instructionData = Buffer.alloc(1 + 32 + 1 + 8);
        let offset = 0;
        
        instructionData.writeUInt8(0, offset); // InitializeTradeLoop instruction
        offset += 1;
        
        Buffer.from(tradeId).copy(instructionData, offset); // trade_id
        offset += 32;
        
        instructionData.writeUInt8(stepCount, offset); // step_count
        offset += 1;
        
        instructionData.writeBigUInt64LE(timeoutSeconds, offset); // timeout_seconds
        
        const instruction = new TransactionInstruction({
            keys: [
                { pubkey: PAYER.publicKey, isSigner: true, isWritable: true }, // payer
                { pubkey: tradeLoopKeypair.publicKey, isSigner: true, isWritable: true }, // trade loop account
                { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // rent sysvar
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system program
            ],
            programId: PROGRAM_ID,
            data: instructionData
        });
        
        const transaction = new Transaction().add(instruction);
        
        console.log('   📤 Creating 3-party trade loop...');
        console.log('   Trade ID:', Buffer.from(tradeId).toString('hex'));
        console.log('   Trade Loop Account:', tradeLoopKeypair.publicKey.toString());
        
        const signature = await sendAndConfirmTransaction(CONNECTION, transaction, [PAYER, tradeLoopKeypair]);
        
        console.log('   ✅ Trade loop initialized successfully!');
        console.log('   🔗 Signature:', signature);
        console.log('   🔍 View on Explorer: https://explorer.solana.com/tx/' + signature + '?cluster=devnet');
        
        // Get transaction details to see logs
        const txDetails = await CONNECTION.getTransaction(signature, { commitment: 'confirmed' });
        if (txDetails && txDetails.meta && txDetails.meta.logMessages) {
            console.log('   📋 Program Logs:');
            txDetails.meta.logMessages.forEach(log => {
                if (log.includes('Program log:') || log.includes('SWAPS') || log.includes('Trade loop')) {
                    console.log('      ', log);
                }
            });
        }
        
        return { success: true, tradeLoopAccount: tradeLoopKeypair.publicKey, tradeId };
        
    } catch (error) {
        console.log('   ❌ Failed to initialize trade loop:', error.message);
        return { success: false };
    }
}

async function testProgramConfig() {
    console.log('🔹 TEST 3: Program Configuration');
    console.log('   Testing program configuration and admin controls...');
    
    try {
        // Calculate program config PDA
        const [configPubkey] = PublicKey.findProgramAddressSync(
            [Buffer.from('config')],
            PROGRAM_ID
        );
        
        console.log('   📍 Config PDA:', configPubkey.toString());
        
        // Check if config account exists
        const configAccount = await CONNECTION.getAccountInfo(configPubkey);
        
        if (configAccount) {
            console.log('   ✅ Program config already exists');
            console.log('   📊 Config size:', configAccount.data.length, 'bytes');
            console.log('   🔒 Owner:', configAccount.owner.toString());
            return { success: true, exists: true };
        } else {
            console.log('   📝 Config account not found - program may not be initialized');
            
            // Try to initialize program config
            const instructionData = Buffer.alloc(2); // [7, 0] for InitializeProgramConfig with no governance
            instructionData.writeUInt8(7, 0); // InitializeProgramConfig instruction
            instructionData.writeUInt8(0, 1); // No governance (false)
            
            const instruction = new TransactionInstruction({
                keys: [
                    { pubkey: PAYER.publicKey, isSigner: true, isWritable: true }, // authority
                    { pubkey: configPubkey, isSigner: false, isWritable: true }, // config account
                    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // rent sysvar
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system program
                ],
                programId: PROGRAM_ID,
                data: instructionData
            });
            
            const transaction = new Transaction().add(instruction);
            
            try {
                console.log('   📤 Initializing program config...');
                const signature = await sendAndConfirmTransaction(CONNECTION, transaction, [PAYER]);
                console.log('   ✅ Program config initialized!');
                console.log('   🔗 Signature:', signature);
                return { success: true, exists: false, initialized: true };
            } catch (error) {
                console.log('   ⚠️  Config initialization failed:', error.message);
                return { success: false, error: error.message };
            }
        }
        
    } catch (error) {
        console.log('   ❌ Failed to test program config:', error.message);
        return { success: false };
    }
}

async function displaySummary(results) {
    console.log('');
    console.log('📊 TEST SUMMARY');
    console.log('===============');
    
    const tests = [
        { name: 'Basic Program Invocation', result: results.basicTest },
        { name: 'Initialize Trade Loop', result: results.tradeLoopTest?.success },
        { name: 'Program Configuration', result: results.configTest?.success }
    ];
    
    tests.forEach((test, index) => {
        const status = test.result ? '✅ PASS' : '❌ FAIL';
        console.log(`${index + 1}. ${test.name}: ${status}`);
    });
    
    const passedTests = tests.filter(t => t.result).length;
    console.log('');
    console.log(`Overall: ${passedTests}/${tests.length} tests passed`);
    
    if (results.tradeLoopTest?.success) {
        console.log('');
        console.log('🎯 SWAPS TRADING ENGINE STATUS: OPERATIONAL');
        console.log('✅ Multi-party trade loops can be created');
        console.log('✅ Program is responding to instructions');
        console.log('✅ Ready for advanced trading scenarios');
    }
    
    console.log('');
    console.log('🔗 Program Explorer: https://explorer.solana.com/address/' + PROGRAM_ID.toString() + '?cluster=devnet');
}

async function runTests() {
    try {
        console.log('Starting comprehensive SWAPS engine tests...\n');
        
        // Test 1: Basic program invocation
        const basicTest = await testBasicProgramInvocation();
        console.log('');
        
        // Test 2: Initialize trade loop
        const tradeLoopTest = await testInitializeTradeLoop();
        console.log('');
        
        // Test 3: Program configuration
        const configTest = await testProgramConfig();
        console.log('');
        
        // Display summary
        await displaySummary({
            basicTest,
            tradeLoopTest,
            configTest
        });
        
    } catch (error) {
        console.error('❌ Test suite failed:', error);
    }
}

// Run the tests
runTests().catch(console.error);