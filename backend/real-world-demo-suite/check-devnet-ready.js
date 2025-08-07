const { Connection, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');

/**
 * DEVNET READINESS CHECKER
 * Quick test to see if devnet rate limits have reset
 */

async function checkDevnetReadiness() {
    console.log('🔍 DEVNET READINESS CHECK');
    console.log('=========================');
    console.log(`⏰ Testing at: ${new Date().toLocaleString()}\n`);

    const endpoints = [
        'https://api.devnet.solana.com',
        'https://solana-devnet.g.alchemy.com/v2/demo',
        'https://rpc.ankr.com/solana_devnet'
    ];

    let healthyEndpoints = 0;
    let airdropReady = false;

    for (const endpoint of endpoints) {
        try {
            const connection = new Connection(endpoint, 'confirmed');
            
            // Test 1: Basic connectivity
            console.log(`🌐 Testing ${endpoint.split('/')[2]}...`);
            const slot = await connection.getSlot();
            console.log(`   ✅ Connected - Current slot: ${slot}`);
            
            // Test 2: Can we query a balance?
            const testKey = Keypair.generate();
            const balance = await connection.getBalance(testKey.publicKey);
            console.log(`   ✅ Balance query successful: ${balance} lamports`);
            
            healthyEndpoints++;
            
            // Test 3: Can we request an airdrop? (Only test with main endpoint)
            if (endpoint === 'https://api.devnet.solana.com' && !airdropReady) {
                try {
                    console.log(`   🚰 Testing airdrop capability...`);
                    const airdropSig = await connection.requestAirdrop(
                        testKey.publicKey,
                        0.001 * LAMPORTS_PER_SOL  // Tiny amount
                    );
                    console.log(`   🎉 AIRDROP SUCCESS! Signature: ${airdropSig.slice(0, 8)}...`);
                    airdropReady = true;
                } catch (airdropError) {
                    if (airdropError.message.includes('429')) {
                        console.log(`   ⏳ Still rate limited for airdrops`);
                    } else {
                        console.log(`   ❌ Airdrop error: ${airdropError.message.slice(0, 50)}...`);
                    }
                }
            }
            
        } catch (error) {
            console.log(`   ❌ Failed: ${error.message.slice(0, 50)}...`);
        }
        
        console.log(''); // Space between endpoints
    }

    // Final assessment
    console.log('📊 READINESS ASSESSMENT');
    console.log('=======================');
    console.log(`🌐 Healthy endpoints: ${healthyEndpoints}/${endpoints.length}`);
    console.log(`🚰 Airdrop ready: ${airdropReady ? '✅ YES' : '❌ NO'}`);
    
    if (airdropReady && healthyEndpoints >= 2) {
        console.log('\n🎉 DEVNET IS READY!');
        console.log('✅ Multiple endpoints responsive');
        console.log('✅ Airdrop functionality restored');
        console.log('🚀 Ready to execute historic 3-way trade!');
        console.log('\n💡 Run: node multi-endpoint-3way-trade.js');
        return true;
    } else if (healthyEndpoints >= 2) {
        console.log('\n⚠️  DEVNET PARTIALLY READY');
        console.log('✅ Endpoints responsive');
        console.log('❌ Airdrop still rate limited');
        console.log('⏳ Wait a bit longer for full functionality');
        return false;
    } else {
        console.log('\n❌ DEVNET NOT READY');
        console.log('💔 Multiple endpoints still constrained');
        console.log('⏳ Continue waiting for infrastructure reset');
        return false;
    }
}

// Run the check
checkDevnetReadiness().then(ready => {
    process.exit(ready ? 0 : 1);
}).catch(error => {
    console.error('💥 Health check failed:', error);
    process.exit(1);
});