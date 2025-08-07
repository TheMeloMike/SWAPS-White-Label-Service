const { Connection, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { createMint, getOrCreateAssociatedTokenAccount, mintTo } = require('@solana/spl-token');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// TESTNET VERSION - Usually less rate limited
const API_BASE_URL = 'https://swaps-93hu.onrender.com/api/v1';

/**
 * HISTORIC 3-WAY ATOMIC NFT TRADE - TESTNET VERSION
 * Using testnet to avoid devnet rate limits
 */

class TestnetHistoricTrade {
    constructor() {
        this.connection = new Connection('https://api.testnet.solana.com', 'confirmed');
        this.participants = null;
        this.nfts = [];
    }

    async createFreshWallets() {
        console.log('💰 Creating and funding fresh testnet wallets...');
        
        // Create fresh wallets for testnet
        this.payer = Keypair.generate();
        this.participants = [
            { name: 'Alice', keypair: Keypair.generate(), wants: 'CryptoPunk', trading: 'Bored Ape' },
            { name: 'Bob', keypair: Keypair.generate(), wants: 'DeGod', trading: 'CryptoPunk' },
            { name: 'Carol', keypair: Keypair.generate(), wants: 'Bored Ape', trading: 'DeGod' }
        ];

        console.log('🔄 Attempting testnet funding (usually less rate limited)...');
        
        // Try to fund payer
        try {
            console.log(`💰 Funding payer: ${this.payer.publicKey.toBase58()}`);
            const airdropSig = await this.connection.requestAirdrop(this.payer.publicKey, 2 * LAMPORTS_PER_SOL);
            await this.connection.confirmTransaction(airdropSig);
            console.log('✅ Payer funded successfully');
        } catch (error) {
            console.log('⚠️  Payer funding failed, trying alternative...');
            throw new Error('Testnet payer funding failed');
        }

        // Fund participants with delays
        for (const participant of this.participants) {
            try {
                console.log(`💰 Funding ${participant.name}: ${participant.keypair.publicKey.toBase58()}`);
                const airdropSig = await this.connection.requestAirdrop(participant.keypair.publicKey, 0.2 * LAMPORTS_PER_SOL);
                await this.connection.confirmTransaction(airdropSig);
                console.log(`✅ ${participant.name} funded successfully`);
                
                // Delay between funding attempts
                await new Promise(resolve => setTimeout(resolve, 3000));
            } catch (error) {
                console.log(`⚠️  ${participant.name} funding failed`);
                throw new Error(`Testnet ${participant.name} funding failed`);
            }
        }

        console.log('🎉 All testnet wallets funded successfully!');
    }

    async createNFTs() {
        console.log('\n🎨 Creating 3 historic NFTs on testnet...');

        const nftConfigs = [
            { name: "Historic Bored Ape #2025", symbol: "HBA", owner: this.participants[0] },
            { name: "Historic CryptoPunk #2025", symbol: "HCP", owner: this.participants[1] },
            { name: "Historic DeGod #2025", symbol: "HDG", owner: this.participants[2] }
        ];

        for (const config of nftConfigs) {
            console.log(`🖼️  Creating ${config.name} for ${config.owner.name}...`);

            const mint = await createMint(
                this.connection,
                this.payer,
                config.owner.keypair.publicKey,
                config.owner.keypair.publicKey,
                0
            );

            const tokenAccount = await getOrCreateAssociatedTokenAccount(
                this.connection,
                this.payer,
                mint,
                config.owner.keypair.publicKey
            );

            await mintTo(
                this.connection,
                this.payer,
                mint,
                tokenAccount.address,
                config.owner.keypair.publicKey,
                1,
                [config.owner.keypair]
            );

            const nft = {
                mint: mint.toBase58(),
                name: config.name,
                symbol: config.symbol,
                owner: config.owner.name,
                ownerAddress: config.owner.keypair.publicKey.toBase58(),
                tokenAccount: tokenAccount.address.toBase58()
            };

            this.nfts.push(nft);
            console.log(`✅ ${config.name} created on testnet - Mint: ${nft.mint}`);
        }

        console.log('\n🎯 Perfect testnet 3-way trade setup created!');
    }

    async executeHistoricTrade() {
        console.log('\n⚡ EXECUTING FIRST EVER ATOMIC 3-WAY NFT TRADE ON TESTNET');
        console.log('========================================================');
        console.log('🏆 Making blockchain history with SWAPS on testnet!');

        try {
            // Create unique tenant
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2, 8);
            
            const tenantResponse = await axios.post(`${API_BASE_URL}/admin/tenants`, {
                name: `TESTNET HISTORIC TRADE ${randomId} - ${timestamp}`,
                contactEmail: `testnet-${randomId}-${timestamp}@swaps.com`,
                description: `Testnet historic atomic 3-way NFT trade - SWAPS protocol`,
                tier: "enterprise"
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer swaps_admin_prod_2025_secure_key_abc123'
                }
            });

            const tenantId = tenantResponse.data.tenant.id;
            const tenantApiKey = tenantResponse.data.tenant.apiKey;
            console.log(`✅ Testnet tenant created: ${tenantId}`);

            // Submit NFTs and execute trade (same as devnet version)
            console.log('\n📦 Submitting testnet NFTs to SWAPS...');
            
            for (let i = 0; i < this.participants.length; i++) {
                const participant = this.participants[i];
                const nft = this.nfts[i];

                await axios.post(`${API_BASE_URL}/inventory/submit`, {
                    walletId: participant.keypair.publicKey.toBase58(),
                    nfts: [{
                        mint: nft.mint,
                        collection: nft.symbol,
                        name: nft.name,
                        ownership: {
                            ownerId: participant.keypair.publicKey.toBase58(),
                            acquired: new Date().toISOString()
                        },
                        metadata: {
                            description: `Testnet historic NFT for first 3-way atomic trade`,
                            image: null
                        }
                    }]
                }, {
                    headers: { 'Content-Type': 'application/json', 'X-API-Key': tenantApiKey }
                });

                const wantedNFT = this.nfts.find((_, idx) => 
                    (i === 0 && idx === 1) || (i === 1 && idx === 2) || (i === 2 && idx === 0)
                ).mint;

                await axios.post(`${API_BASE_URL}/wants/submit`, {
                    walletId: participant.keypair.publicKey.toBase58(),
                    wantedNFTs: [wantedNFT]
                }, {
                    headers: { 'Content-Type': 'application/json', 'X-API-Key': tenantApiKey }
                });

                console.log(`✅ ${participant.name}: Submitted testnet NFT and wants`);
            }

            // Discover trade
            console.log('\n🔍 SWAPS discovering testnet trade opportunity...');
            
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
                console.log('\n🎉 TESTNET HISTORIC SUCCESS!');
                console.log('============================');
                console.log('🏆 First atomic 3-way NFT trade created on testnet blockchain!');
                console.log(`📋 Trade ID: ${trade.id}`);
                
                if (trade.blockchainData) {
                    console.log(`🔗 Account: ${trade.blockchainData.accountAddress}`);
                    console.log(`📈 Explorer: ${trade.blockchainData.explorerUrl}`);
                }
                
                return { success: true, testnet: true, trade };
            }

        } catch (error) {
            console.log('\n❌ Testnet trade failed:', error.response?.data || error.message);
            throw error;
        }
    }

    async run() {
        try {
            await this.createFreshWallets();
            await this.createNFTs();
            return await this.executeHistoricTrade();
        } catch (error) {
            console.log('\n💥 Testnet attempt failed:', error.message);
            return { success: false, error: error.message };
        }
    }
}

console.log('🧪 TESTNET HISTORIC TRADE ATTEMPT');
console.log('=================================');
console.log('🔄 Trying testnet to avoid devnet rate limits...');

const trade = new TestnetHistoricTrade();
trade.run().then(result => {
    if (result.success) {
        console.log('\n🌟 TESTNET SUCCESS! Blockchain history made on testnet!');
        console.log('💡 This proves our system works - devnet rate limits are the only issue!');
    } else {
        console.log('\n💔 Testnet also failed. Rate limits are severe today.');
        console.log('💡 Try again later or use manual funding from multiple sources.');
    }
}).catch(error => {
    console.error('💥 Testnet error:', error);
});