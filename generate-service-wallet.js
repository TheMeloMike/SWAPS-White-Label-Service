#!/usr/bin/env node

/**
 * GENERATE SERVICE WALLET
 * 
 * Quick utility to generate a service wallet for MVP testing.
 * This wallet will pay for createSwap operations in the hybrid model.
 */

const crypto = require('crypto');

function generateWallet() {
    console.log('🔑 GENERATING SERVICE WALLET FOR MVP');
    console.log('====================================\n');
    
    // Generate random private key
    const privateKey = '0x' + crypto.randomBytes(32).toString('hex');
    
    // Derive address (simplified - in production use ethers.js)
    console.log('📋 SERVICE WALLET DETAILS:');
    console.log('-------------------------\n');
    console.log(`ETHEREUM_SERVICE_WALLET_KEY=${privateKey}`);
    console.log(`ETHEREUM_SERVICE_WALLET_ADDRESS=<Will be shown after importing to MetaMask>`);
    console.log(`EXECUTION_MODE=hybrid`);
    console.log(`ETHEREUM_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com`);
    console.log(`ETHEREUM_CONTRACT_ADDRESS=0xb17Ad11D1b9474c5e7403cA62A8B6D3bc6Deae67`);
    console.log(`ETHEREUM_NETWORK=sepolia`);
    
    console.log('\n📝 INSTRUCTIONS:');
    console.log('----------------');
    console.log('1. Import this private key into MetaMask');
    console.log('2. Copy the resulting address');
    console.log('3. Get Sepolia ETH from faucet (0.1 ETH minimum)');
    console.log('4. Add ALL variables above to Render environment');
    console.log('5. Restart Render service');
    console.log('6. Run mvp-hybrid-implementation.js');
    
    console.log('\n💰 FUNDING SOURCES:');
    console.log('------------------');
    console.log('• https://sepoliafaucet.com');
    console.log('• https://www.alchemy.com/faucets/ethereum-sepolia');
    console.log('• https://sepolia-faucet.pk910.de');
    
    console.log('\n⚠️  SECURITY NOTE:');
    console.log('-----------------');
    console.log('This is for TESTNET ONLY. Never use this method for mainnet!');
    console.log('Keep minimal funds (0.1 ETH) in service wallet.');
    console.log('Plan migration to user-pays model ASAP.\n');
    
    return privateKey;
}

// Generate the wallet
const privateKey = generateWallet();

console.log('✅ Wallet generated successfully!');
console.log('🚀 You are 15 minutes away from executing your first trade!\n');