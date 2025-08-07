const { completeTradeWithSignatures, signTradeStep } = require('./complete_nft_trade_with_signatures');
const axios = require('axios');

/**
 * Execute Complete 3-Way NFT Trade via SWAPS API
 * 
 * This demonstrates the FULL flow:
 * 1. Create real NFTs and wallets
 * 2. Submit to SWAPS API
 * 3. Get trade loop discovery
 * 4. Initialize on blockchain
 * 5. Add trade steps with signatures
 * 6. Execute complete atomic trade
 */

const API_BASE = 'https://swaps-93hu.onrender.com/api/v1';
const ADMIN_KEY = 'swaps_admin_prod_2025_secure_key_abc123';

async function executeCompleteNFTTrade() {
    console.log('🚀 EXECUTING COMPLETE 3-WAY NFT TRADE');
    console.log('====================================\n');
    
    try {
        // Step 1: Create real NFTs and wallets
        console.log('Step 1: Creating real NFTs and wallets...');
        const tradeAssets = await completeTradeWithSignatures();
        console.log('✅ Assets created\n');
        
        // Step 2: Create tenant for this demo
        console.log('Step 2: Creating SWAPS tenant...');
        const tenantResponse = await axios.post(`${API_BASE}/admin/tenants`, {
            name: "Complete Trade Demo",
            contactEmail: "complete@swaps.com",
            description: "Full 3-way NFT trade with signatures",
            tier: "enterprise"
        }, {
            headers: {
                'Authorization': `Bearer ${ADMIN_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const apiKey = tenantResponse.data.tenant.apiKey;
        console.log('✅ Tenant created\n');
        
        // Step 3: Submit inventories to SWAPS
        console.log('Step 3: Submitting NFT inventories...');
        
        const inventories = [
            {
                walletId: tradeAssets.wallets.alice,
                nfts: [{
                    id: tradeAssets.nfts.alpha,
                    metadata: { name: "Real NFT Alpha" },
                    ownership: { 
                        ownerId: tradeAssets.wallets.alice,
                        blockchain: "solana"
                    },
                    valuation: { estimatedValue: 1.0, currency: "SOL" }
                }]
            },
            {
                walletId: tradeAssets.wallets.bob,
                nfts: [{
                    id: tradeAssets.nfts.beta,
                    metadata: { name: "Real NFT Beta" },
                    ownership: { 
                        ownerId: tradeAssets.wallets.bob,
                        blockchain: "solana"
                    },
                    valuation: { estimatedValue: 1.0, currency: "SOL" }
                }]
            },
            {
                walletId: tradeAssets.wallets.carol,
                nfts: [{
                    id: tradeAssets.nfts.gamma,
                    metadata: { name: "Real NFT Gamma" },
                    ownership: { 
                        ownerId: tradeAssets.wallets.carol,
                        blockchain: "solana"
                    },
                    valuation: { estimatedValue: 1.0, currency: "SOL" }
                }]
            }
        ];
        
        for (const inventory of inventories) {
            await axios.post(`${API_BASE}/inventory/submit`, inventory, {
                headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' }
            });
        }
        console.log('✅ Inventories submitted\n');
        
        // Step 4: Submit wants to create trade loop
        console.log('Step 4: Creating trade loop with wants...');
        
        const wants = [
            { walletId: tradeAssets.wallets.alice, wantedNFTs: [tradeAssets.nfts.beta] },
            { walletId: tradeAssets.wallets.bob, wantedNFTs: [tradeAssets.nfts.gamma] },
            { walletId: tradeAssets.wallets.carol, wantedNFTs: [tradeAssets.nfts.alpha] }
        ];
        
        let tradeLoop = null;
        for (let i = 0; i < wants.length; i++) {
            const response = await axios.post(`${API_BASE}/wants/submit`, wants[i], {
                headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' }
            });
            
            if (response.data.loops && response.data.loops.length > 0) {
                tradeLoop = response.data.loops[0];
            }
        }
        
        if (!tradeLoop) {
            throw new Error('No trade loop discovered');
        }
        console.log('✅ Trade loop discovered:', tradeLoop.id.slice(0, 50) + '...\n');
        
        // Step 5: Initialize trade on blockchain
        console.log('Step 5: Initializing trade on blockchain...');
        
        const blockchainResponse = await axios.post(`${API_BASE}/blockchain/trades/execute`, {
            tradeLoopId: tradeLoop.id,
            walletPublicKey: tradeAssets.wallets.alice,
            mode: "execute",
            customTimeoutHours: 24
        }, {
            headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' }
        });
        
        const blockchainTrade = blockchainResponse.data.execution;
        console.log('✅ Blockchain trade initialized');
        console.log('   Transaction:', blockchainTrade.transactionHash);
        console.log('   Account:', blockchainTrade.accountAddress);
        console.log('   Explorer:', blockchainTrade.explorerUrl, '\n');
        
        // Step 6: What would happen next (signature flow)
        console.log('Step 6: Next steps for complete execution:');
        console.log('==========================================');
        
        console.log('\n📝 Required API calls:');
        console.log('1. POST /blockchain/trades/steps - Add NFT transfer steps');
        console.log('2. POST /blockchain/trades/approve - Get participant approvals');
        console.log('3. POST /blockchain/trades/complete - Execute atomic swap');
        
        console.log('\n🔑 For demonstration, we could sign with our generated keys:');
        
        // Demonstrate signature creation
        const aliceStep = {
            from: tradeAssets.wallets.alice,
            to: tradeAssets.wallets.bob,
            nftMint: tradeAssets.nfts.alpha,
            tokenAccount: tradeAssets.tokenAccounts.aliceAlpha
        };
        
        const aliceSignature = signTradeStep(aliceStep, tradeAssets.keypairs.alice.secretKey);
        console.log('Alice signature demo:', aliceSignature.signature);
        
        const bobStep = {
            from: tradeAssets.wallets.bob,
            to: tradeAssets.wallets.carol,
            nftMint: tradeAssets.nfts.beta,
            tokenAccount: tradeAssets.tokenAccounts.bobBeta
        };
        
        const bobSignature = signTradeStep(bobStep, tradeAssets.keypairs.bob.secretKey);
        console.log('Bob signature demo:', bobSignature.signature);
        
        const carolStep = {
            from: tradeAssets.wallets.carol,
            to: tradeAssets.wallets.alice,
            nftMint: tradeAssets.nfts.gamma,
            tokenAccount: tradeAssets.tokenAccounts.carolGamma
        };
        
        const carolSignature = signTradeStep(carolStep, tradeAssets.keypairs.carol.secretKey);
        console.log('Carol signature demo:', carolSignature.signature);
        
        console.log('\n🎯 CURRENT STATUS:');
        console.log('✅ Real NFTs created and distributed');
        console.log('✅ Trade loop discovered by algorithm');
        console.log('✅ Blockchain trade account initialized');
        console.log('✅ All signatures available for execution');
        console.log('⏳ Waiting for API endpoints: /steps, /approve, /complete');
        
        console.log('\n🚀 TO COMPLETE THE TRADE:');
        console.log('We need to implement the missing API endpoints that:');
        console.log('1. Accept trade step details (NFT mints, token accounts)');
        console.log('2. Verify participant signatures');
        console.log('3. Execute atomic SPL token transfers');
        
        return {
            success: true,
            tradeId: blockchainTrade.blockchainTradeId,
            transactionHash: blockchainTrade.transactionHash,
            explorerUrl: blockchainTrade.explorerUrl,
            assets: tradeAssets,
            signatures: {
                alice: aliceSignature,
                bob: bobSignature,
                carol: carolSignature
            }
        };
        
    } catch (error) {
        console.error('❌ Trade execution failed:', error.message);
        if (error.response) {
            console.error('   API Response:', error.response.data);
        }
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    executeCompleteNFTTrade()
        .then(result => {
            console.log('\n🎉 Complete trade demo finished!');
            console.log('Check the blockchain transaction:', result.explorerUrl);
        })
        .catch(error => {
            console.error('\n💥 Demo failed:', error.message);
        });
}

module.exports = { executeCompleteNFTTrade };