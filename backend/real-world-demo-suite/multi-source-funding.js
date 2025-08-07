const { Connection, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Multi-Source Wallet Funding Strategy
 * Try multiple RPC endpoints and funding sources
 */

class MultiFundingStrategy {
    constructor() {
        // Try different RPC endpoints - some might have different rate limits
        this.connections = [
            new Connection('https://api.devnet.solana.com', 'confirmed'),
            new Connection('https://devnet.solana.com', 'confirmed'),
            new Connection('https://solana-devnet.g.alchemy.com/v2/demo', 'confirmed'),
            new Connection('https://divine-warmhearted-firefly.solana-devnet.discover.quiknode.pro/2af5315d336f9ae920c5c07205b5b68079659b4a/', 'confirmed')
        ];
        this.currentConnectionIndex = 0;
    }

    getCurrentConnection() {
        return this.connections[this.currentConnectionIndex];
    }

    switchConnection() {
        this.currentConnectionIndex = (this.currentConnectionIndex + 1) % this.connections.length;
        console.log(`🔄 Switching to RPC endpoint ${this.currentConnectionIndex + 1}/${this.connections.length}`);
    }

    async tryDirectFaucetAPI(publicKey, amount = 1) {
        console.log(`🌐 Trying direct faucet API for ${publicKey.slice(0, 8)}...`);
        
        const faucetAPIs = [
            {
                name: 'Solana Official',
                url: 'https://api.devnet.solana.com',
                method: 'requestAirdrop'
            },
            {
                name: 'Alternative Devnet',
                url: 'https://devnet.solana.com',
                method: 'requestAirdrop'
            }
        ];

        for (const api of faucetAPIs) {
            try {
                console.log(`   Trying ${api.name}...`);
                const response = await axios.post(api.url, {
                    jsonrpc: '2.0',
                    id: 1,
                    method: api.method,
                    params: [publicKey, amount * LAMPORTS_PER_SOL]
                }, {
                    timeout: 10000,
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.data.result) {
                    console.log(`   ✅ ${api.name} funding successful!`);
                    return response.data.result;
                }
            } catch (error) {
                console.log(`   ❌ ${api.name} failed: ${error.message}`);
            }
        }
        return null;
    }

    async tryWebFaucets(publicKey) {
        console.log(`🌍 Trying web faucet APIs for ${publicKey.slice(0, 8)}...`);
        
        // Try QuickNode faucet API
        try {
            console.log('   Trying QuickNode faucet...');
            const response = await axios.post('https://faucet.quicknode.com/solana/devnet', {
                address: publicKey
            }, {
                timeout: 15000,
                headers: { 
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            });
            
            if (response.status === 200) {
                console.log('   ✅ QuickNode funding successful!');
                return true;
            }
        } catch (error) {
            console.log(`   ❌ QuickNode failed: ${error.message}`);
        }

        return false;
    }

    async fundWalletMultiStrategy(keypair, targetAmount = 0.5, name = 'Wallet') {
        console.log(`\n💰 Multi-strategy funding for ${name}: ${keypair.publicKey.toBase58()}`);
        
        let attempts = 0;
        const maxAttempts = 15;
        
        while (attempts < maxAttempts) {
            attempts++;
            console.log(`\n🔄 Attempt ${attempts}/${maxAttempts} for ${name}`);
            
            try {
                // Check current balance first
                const balance = await this.getCurrentConnection().getBalance(keypair.publicKey);
                const currentSOL = balance / LAMPORTS_PER_SOL;
                console.log(`   Current balance: ${currentSOL} SOL`);
                
                if (currentSOL >= targetAmount) {
                    console.log(`   ✅ ${name} already has sufficient funds!`);
                    return true;
                }

                // Strategy 1: Try current connection airdrop
                try {
                    console.log(`   Strategy 1: Standard airdrop (connection ${this.currentConnectionIndex + 1})`);
                    const airdropAmount = Math.min(1, targetAmount - currentSOL);
                    const sig = await this.getCurrentConnection().requestAirdrop(
                        keypair.publicKey, 
                        airdropAmount * LAMPORTS_PER_SOL
                    );
                    
                    console.log(`   ⏳ Confirming airdrop: ${sig.slice(0, 8)}...`);
                    await this.getCurrentConnection().confirmTransaction(sig);
                    
                    const newBalance = await this.getCurrentConnection().getBalance(keypair.publicKey);
                    console.log(`   ✅ Standard airdrop successful! New balance: ${newBalance / LAMPORTS_PER_SOL} SOL`);
                    return true;
                    
                } catch (error) {
                    console.log(`   ❌ Standard airdrop failed: ${error.message}`);
                }

                // Strategy 2: Try direct API calls
                const apiResult = await this.tryDirectFaucetAPI(keypair.publicKey.toBase58(), 0.5);
                if (apiResult) {
                    console.log(`   ⏳ Confirming API airdrop...`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    const newBalance = await this.getCurrentConnection().getBalance(keypair.publicKey);
                    if (newBalance > balance) {
                        console.log(`   ✅ API funding successful! New balance: ${newBalance / LAMPORTS_PER_SOL} SOL`);
                        return true;
                    }
                }

                // Strategy 3: Try web faucets
                const webResult = await this.tryWebFaucets(keypair.publicKey.toBase58());
                if (webResult) {
                    console.log(`   ⏳ Waiting for web faucet confirmation...`);
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    const newBalance = await this.getCurrentConnection().getBalance(keypair.publicKey);
                    if (newBalance > balance) {
                        console.log(`   ✅ Web faucet successful! New balance: ${newBalance / LAMPORTS_PER_SOL} SOL`);
                        return true;
                    }
                }

                // Strategy 4: Switch RPC endpoint and try again
                if (attempts % 3 === 0) {
                    this.switchConnection();
                }

                // Progressive delay between attempts
                const delay = Math.min(attempts * 2000, 15000);
                console.log(`   ⏳ Waiting ${delay/1000}s before next attempt...`);
                await new Promise(resolve => setTimeout(resolve, delay));

            } catch (error) {
                console.log(`   ❌ Attempt ${attempts} failed: ${error.message}`);
                
                // If we hit a severe error, wait longer
                if (error.message.includes('429') || error.message.includes('rate')) {
                    const longDelay = 30000 + (attempts * 5000);
                    console.log(`   🛑 Rate limit detected, waiting ${longDelay/1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, longDelay));
                }
            }
        }

        console.log(`   ❌ ${name} funding failed after ${maxAttempts} attempts`);
        return false;
    }

    async createAndFundWallets() {
        console.log('🚀 AGGRESSIVE MULTI-SOURCE FUNDING STRATEGY');
        console.log('===========================================');
        console.log('🎯 Goal: Fund wallets using every possible method\n');

        // Create fresh wallets
        this.payer = Keypair.generate();
        this.participants = [
            { name: 'Alice', keypair: Keypair.generate(), wants: 'CryptoPunk', trading: 'Bored Ape' },
            { name: 'Bob', keypair: Keypair.generate(), wants: 'DeGod', trading: 'CryptoPunk' },
            { name: 'Carol', keypair: Keypair.generate(), wants: 'Bored Ape', trading: 'DeGod' }
        ];

        console.log('📋 Wallet Addresses Created:');
        console.log(`   Payer: ${this.payer.publicKey.toBase58()}`);
        this.participants.forEach(p => {
            console.log(`   ${p.name}: ${p.keypair.publicKey.toBase58()}`);
        });

        // Try to fund payer first (needs more SOL)
        console.log('\n🎯 Phase 1: Funding Payer (needs 2+ SOL)');
        const payerFunded = await this.fundWalletMultiStrategy(this.payer, 1.5, 'Payer');
        
        if (!payerFunded) {
            console.log('❌ Could not fund payer with any method');
            return false;
        }

        // Try to fund participants
        console.log('\n🎯 Phase 2: Funding Participants (need 0.2 SOL each)');
        let participantsFunded = 0;
        
        for (const participant of this.participants) {
            const funded = await this.fundWalletMultiStrategy(participant.keypair, 0.15, participant.name);
            if (funded) {
                participantsFunded++;
            }
        }

        console.log(`\n📊 Funding Results:`);
        console.log(`   Payer: ${payerFunded ? '✅' : '❌'}`);
        console.log(`   Participants: ${participantsFunded}/${this.participants.length}`);

        if (payerFunded && participantsFunded >= 2) {
            console.log('\n🎉 SUFFICIENT FUNDING ACHIEVED!');
            console.log('💫 Ready to proceed with historic trade!');
            
            // Save successful wallets
            const wallets = {
                payer: Array.from(this.payer.secretKey),
                participants: this.participants.map(p => ({
                    name: p.name,
                    secretKey: Array.from(p.keypair.secretKey),
                    publicKey: p.keypair.publicKey.toBase58(),
                    wants: p.wants,
                    trading: p.trading
                }))
            };
            
            fs.writeFileSync(path.join(__dirname, 'funded-wallets.json'), JSON.stringify(wallets, null, 2));
            console.log('✅ Funded wallets saved to funded-wallets.json');
            
            return true;
        } else {
            console.log('\n❌ INSUFFICIENT FUNDING');
            console.log('💡 Will keep trying - rate limits change frequently');
            return false;
        }
    }
}

// Execute the multi-funding strategy
async function main() {
    console.log('🏁 STARTING AGGRESSIVE FUNDING ATTEMPT');
    console.log('======================================\n');
    
    const funder = new MultiFundingStrategy();
    const success = await funder.createAndFundWallets();
    
    if (success) {
        console.log('\n🌟 SUCCESS! Wallets funded and ready!');
        console.log('🚀 Next: Run the historic trade script!');
        console.log('💫 Command: node funded-historic-trade.js');
        process.exit(0);
    } else {
        console.log('\n💔 Funding incomplete this round');
        console.log('🔄 Rate limits change frequently - try again in 10-30 minutes');
        console.log('💡 Or manually fund these addresses through web faucets:');
        console.log(`   Payer: ${funder.payer.publicKey.toBase58()}`);
        funder.participants.forEach(p => {
            console.log(`   ${p.name}: ${p.keypair.publicKey.toBase58()}`);
        });
        process.exit(1);
    }
}

main().catch(error => {
    console.error('💥 Critical error:', error);
    process.exit(1);
});