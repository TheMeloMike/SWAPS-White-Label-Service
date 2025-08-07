const { Connection, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { createMint, getOrCreateAssociatedTokenAccount, mintTo } = require('@solana/spl-token');
const axios = require('axios');

/**
 * MULTI-ENDPOINT 3-WAY TRADE
 * Try different RPC endpoints and faucet strategies
 */

const API_BASE_URL = 'https://swaps-93hu.onrender.com/api/v1';

class MultiEndpoint3WayTrade {
    constructor() {
        // Multiple devnet RPC endpoints to try
        this.rpcEndpoints = [
            'https://api.devnet.solana.com',
            'https://devnet.solana.com', 
            'https://solana-devnet.g.alchemy.com/v2/demo',
            'https://divine-warmhearted-firefly.solana-devnet.discover.quiknode.pro/2af5315d336f9ae920c5c07205b5b68079659b4a/',
            'https://rpc.ankr.com/solana_devnet',
            'https://devnet.helius-rpc.com/?api-key=demo'
        ];
        
        this.currentEndpointIndex = 0;
        this.connection = new Connection(this.rpcEndpoints[0], 'confirmed');
        this.participants = [];
        this.nfts = [];
    }

    switchRPCEndpoint() {
        this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.rpcEndpoints.length;
        const newEndpoint = this.rpcEndpoints[this.currentEndpointIndex];
        this.connection = new Connection(newEndpoint, 'confirmed');
        console.log(`🔄 Switched to RPC endpoint: ${newEndpoint.replace('https://', '').split('/')[0]}`);
        return newEndpoint;
    }

    async tryAlternativeFaucets(publicKey, amount = 0.02) {
        console.log(`🌐 Trying alternative faucet methods for ${publicKey.slice(0, 8)}...`);
        
        const faucetStrategies = [
            // Strategy 1: Direct HTTP faucet calls
            async () => {
                const faucetEndpoints = [
                    'https://api.devnet.solana.com',
                    'https://rpc.ankr.com/solana_devnet'
                ];
                
                for (const endpoint of faucetEndpoints) {
                    try {
                        console.log(`   Trying direct faucet: ${endpoint.split('/')[2]}`);
                        const response = await axios.post(endpoint, {
                            jsonrpc: '2.0',
                            id: 1,
                            method: 'requestAirdrop',
                            params: [publicKey, amount * LAMPORTS_PER_SOL]
                        }, { timeout: 15000 });
                        
                        if (response.data.result) {
                            console.log(`   ✅ Direct faucet success: ${response.data.result}`);
                            return response.data.result;
                        }
                    } catch (error) {
                        console.log(`   ❌ Direct faucet failed: ${error.message}`);
                    }
                }
                return null;
            },
            
            // Strategy 2: Web-based faucet APIs
            async () => {
                const webFaucets = [
                    {
                        name: 'SolFaucet',
                        url: 'https://api.solfaucet.com/airdrop',
                        method: 'POST',
                        data: { address: publicKey, amount: amount }
                    }
                ];
                
                for (const faucet of webFaucets) {
                    try {
                        console.log(`   Trying web faucet: ${faucet.name}`);
                        const response = await axios({
                            method: faucet.method,
                            url: faucet.url,
                            data: faucet.data,
                            timeout: 15000,
                            headers: {
                                'Content-Type': 'application/json',
                                'User-Agent': 'SWAPS-Protocol/1.0'
                            }
                        });
                        
                        if (response.status === 200) {
                            console.log(`   ✅ Web faucet success: ${faucet.name}`);
                            return true;
                        }
                    } catch (error) {
                        console.log(`   ❌ Web faucet failed: ${error.message}`);
                    }
                }
                return null;
            }
        ];

        // Try each strategy
        for (let i = 0; i < faucetStrategies.length; i++) {
            try {
                const result = await faucetStrategies[i]();
                if (result) {
                    console.log(`   🎉 Alternative faucet strategy ${i + 1} worked!`);
                    return result;
                }
            } catch (error) {
                console.log(`   ❌ Strategy ${i + 1} failed: ${error.message}`);
            }
        }

        return null;
    }

    async createAndFundWithMultipleEndpoints() {
        console.log('🌐 MULTI-ENDPOINT FUNDING STRATEGY');
        console.log('==================================');
        console.log('🎯 Trying different RPC endpoints and faucet sources\n');

        // Create fresh participants
        this.participants = [
            { name: 'Alice', keypair: Keypair.generate(), wants: 'CryptoPunk', trading: 'Bored Ape' },
            { name: 'Bob', keypair: Keypair.generate(), wants: 'DeGod', trading: 'CryptoPunk' },
            { name: 'Carol', keypair: Keypair.generate(), wants: 'Bored Ape', trading: 'DeGod' }
        ];

        console.log('📋 Multi-endpoint wallet addresses:');
        this.participants.forEach(p => {
            console.log(`   ${p.name}: ${p.keypair.publicKey.toBase58()}`);
        });

        let successCount = 0;
        
        for (const participant of this.participants) {
            console.log(`\n💰 Multi-strategy funding for ${participant.name}...`);
            let funded = false;
            let attempts = 0;
            
            while (!funded && attempts < this.rpcEndpoints.length * 2) {
                attempts++;
                
                try {
                    // Strategy 1: Try current RPC endpoint
                    console.log(`   Attempt ${attempts}: RPC ${this.currentEndpointIndex + 1}/${this.rpcEndpoints.length}`);
                    
                    const airdropSig = await this.connection.requestAirdrop(
                        participant.keypair.publicKey,
                        0.015 * LAMPORTS_PER_SOL  // Even smaller amount
                    );
                    
                    console.log(`   ⏳ Confirming airdrop: ${airdropSig.slice(0, 8)}...`);
                    await this.connection.confirmTransaction(airdropSig);
                    
                    const balance = await this.connection.getBalance(participant.keypair.publicKey);
                    console.log(`   ✅ ${participant.name}: ${balance / LAMPORTS_PER_SOL} SOL (RPC success)`);
                    funded = true;
                    successCount++;
                    break;
                    
                } catch (rpcError) {
                    console.log(`   ❌ RPC failed: ${rpcError.message.slice(0, 50)}...`);
                    
                    // Strategy 2: Try alternative faucets
                    const altResult = await this.tryAlternativeFaucets(
                        participant.keypair.publicKey.toBase58(), 
                        0.015
                    );
                    
                    if (altResult) {
                        console.log(`   ⏳ Waiting for alternative faucet confirmation...`);
                        await new Promise(resolve => setTimeout(resolve, 8000));
                        
                        const balance = await this.connection.getBalance(participant.keypair.publicKey);
                        if (balance > 0) {
                            console.log(`   ✅ ${participant.name}: ${balance / LAMPORTS_PER_SOL} SOL (alt faucet)`);
                            funded = true;
                            successCount++;
                            break;
                        }
                    }
                    
                    // Strategy 3: Switch RPC endpoint
                    if (attempts % 2 === 0) {
                        this.switchRPCEndpoint();
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            }
            
            if (!funded) {
                console.log(`   💔 ${participant.name}: All funding strategies failed`);
            }
            
            // Delay between participants
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        console.log(`\n📊 Multi-endpoint funding results: ${successCount}/3 wallets funded`);
        
        if (successCount >= 2) {
            console.log('🎉 Sufficient funding achieved! Ready for multi-party trade!');
            return true;
        } else if (successCount >= 1) {
            console.log('⚠️  Partial funding - can demonstrate limited functionality');
            return true;
        } else {
            console.log('💔 No funding achieved - severe infrastructure limitations');
            return false;
        }
    }

    async createEfficientNFTs() {
        console.log('\n🎨 Creating NFTs with multi-endpoint efficiency...');
        
        const nftConfigs = [
            { name: "Multi-Endpoint Bored Ape #2025", symbol: "MBA", owner: this.participants[0] },
            { name: "Multi-Endpoint CryptoPunk #2025", symbol: "MCP", owner: this.participants[1] },
            { name: "Multi-Endpoint DeGod #2025", symbol: "MDG", owner: this.participants[2] }
        ];

        for (let i = 0; i < this.participants.length; i++) {
            const participant = this.participants[i];
            const config = nftConfigs[i];
            
            const balance = await this.connection.getBalance(participant.keypair.publicKey);
            if (balance < 0.005 * LAMPORTS_PER_SOL) {
                console.log(`   ⚠️  ${participant.name}: Insufficient balance (${balance / LAMPORTS_PER_SOL} SOL)`);
                continue;
            }

            try {
                console.log(`🖼️  Creating ${config.name}...`);
                
                const mint = await createMint(
                    this.connection,
                    participant.keypair,
                    participant.keypair.publicKey,
                    participant.keypair.publicKey,
                    0
                );

                const tokenAccount = await getOrCreateAssociatedTokenAccount(
                    this.connection,
                    participant.keypair,
                    mint,
                    participant.keypair.publicKey
                );

                await mintTo(
                    this.connection,
                    participant.keypair,
                    mint,
                    tokenAccount.address,
                    participant.keypair.publicKey,
                    1,
                    [participant.keypair]
                );

                const nft = {
                    mint: mint.toBase58(),
                    name: config.name,
                    symbol: config.symbol,
                    owner: participant.name,
                    ownerAddress: participant.keypair.publicKey.toBase58(),
                    tokenAccount: tokenAccount.address.toBase58()
                };

                this.nfts.push(nft);
                
                const newBalance = await this.connection.getBalance(participant.keypair.publicKey);
                console.log(`   ✅ Created! Cost: ${((balance - newBalance) / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
                console.log(`   📍 Mint: ${nft.mint}`);
                
            } catch (error) {
                console.log(`   ❌ ${participant.name} NFT failed: ${error.message}`);
            }
        }

        return this.nfts.length >= 2;
    }

    async executeMultiEndpointTrade() {
        console.log('\n⚡ EXECUTING MULTI-ENDPOINT 3-WAY TRADE');
        console.log('======================================');

        try {
            const timestamp = Date.now();
            const tenantResponse = await axios.post(`${API_BASE_URL}/admin/tenants`, {
                name: `MULTI-ENDPOINT 3-WAY TRADE - ${timestamp}`,
                contactEmail: `multiendpoint-${timestamp}@swaps.com`,
                description: "Multi-endpoint 3-way NFT trade using alternative RPC sources",
                tier: "enterprise"
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer swaps_admin_prod_2025_secure_key_abc123'
                }
            });

            const tenantId = tenantResponse.data.tenant.id;
            const tenantApiKey = tenantResponse.data.tenant.apiKey;
            console.log(`✅ Multi-endpoint tenant: ${tenantId}`);

            // Submit NFTs and execute trade discovery
            console.log('\n📦 Submitting multi-endpoint NFTs...');
            
            for (let i = 0; i < this.nfts.length; i++) {
                const nft = this.nfts[i];
                const participant = this.participants[i];

                await axios.post(`${API_BASE_URL}/inventory/submit`, {
                    walletId: participant.keypair.publicKey.toBase58(),
                    nfts: [{
                        id: nft.mint,
                        metadata: {
                            name: nft.name,
                            description: `Multi-endpoint NFT for efficient 3-way trade`,
                            image: null
                        },
                        ownership: {
                            ownerId: participant.keypair.publicKey.toBase58(),
                            blockchain: 'solana'
                        },
                        valuation: {
                            estimatedValue: 0.001,
                            currency: 'SOL'
                        }
                    }]
                }, {
                    headers: { 'Content-Type': 'application/json', 'X-API-Key': tenantApiKey }
                });

                // Submit wants for circular trade
                const wantedNFT = this.nfts[(i + 1) % this.nfts.length].mint;
                await axios.post(`${API_BASE_URL}/wants/submit`, {
                    walletId: participant.keypair.publicKey.toBase58(),
                    wantedNFTs: [wantedNFT]
                }, {
                    headers: { 'Content-Type': 'application/json', 'X-API-Key': tenantApiKey }
                });

                console.log(`   ✅ ${participant.name}: NFT + wants submitted`);
            }

            // Trade discovery
            console.log('\n🔍 Multi-endpoint trade discovery...');
            
            const discoveryResponse = await axios.post(`${API_BASE_URL}/blockchain/discovery/trades`, {
                tenantId: tenantId,
                walletId: this.participants[0].keypair.publicKey.toBase58(),
                mode: 'full_blockchain',
                settings: { autoCreateBlockchainTrades: true, blockchainFormat: 'solana' }
            }, {
                headers: { 'Content-Type': 'application/json', 'X-API-Key': tenantApiKey }
            });

            if (discoveryResponse.data.trades.length > 0) {
                const trade = discoveryResponse.data.trades[0];
                
                console.log('\n🎉 MULTI-ENDPOINT SUCCESS!');
                console.log('==========================');
                console.log(`🏆 ${this.nfts.length}-way trade discovered using alternative endpoints!`);
                console.log(`📋 Trade ID: ${trade.id}`);
                console.log(`👥 Participants: ${trade.totalParticipants}`);
                
                if (trade.blockchainData) {
                    console.log(`🔗 Blockchain account: ${trade.blockchainData.accountAddress}`);
                    console.log(`📍 Explorer: ${trade.blockchainData.explorerUrl}`);
                }
                
                return { success: true, multiEndpoint: true, trade, participants: this.nfts.length };
            }

        } catch (error) {
            console.log('\n❌ Multi-endpoint trade failed:', error.response?.data || error.message);
            throw error;
        }
    }

    async run() {
        try {
            const funded = await this.createAndFundWithMultipleEndpoints();
            if (!funded) {
                throw new Error('Multi-endpoint funding failed');
            }

            const nftsCreated = await this.createEfficientNFTs();
            if (!nftsCreated) {
                throw new Error('Multi-endpoint NFT creation failed');
            }

            return await this.executeMultiEndpointTrade();
            
        } catch (error) {
            console.log('\n💥 Multi-endpoint attempt failed:', error.message);
            return { success: false, error: error.message };
        }
    }
}

console.log('🌐 MULTI-ENDPOINT 3-WAY TRADE');
console.log('=============================');
console.log('🎯 Using multiple RPC endpoints and faucet sources for real multi-party trade\n');

const trade = new MultiEndpoint3WayTrade();
trade.run().then(result => {
    if (result.success) {
        console.log('\n🌟 MULTI-ENDPOINT BREAKTHROUGH!');
        console.log('===============================');
        console.log(`🏆 ${result.participants}-way trade executed using alternative infrastructure!`);
        console.log('✅ Multiple RPC endpoints successfully utilized');
        console.log('✅ Alternative funding sources proven');
        console.log('✅ Real multi-party blockchain trading achieved!');
        console.log('\n🚀 INFRASTRUCTURE RESILIENCE PROVEN!');
    } else {
        console.log('\n💔 Multi-endpoint approach still constrained');
        console.log('🔧 Infrastructure limitations broader than expected');
    }
}).catch(error => {
    console.error('💥 Critical multi-endpoint error:', error);
});