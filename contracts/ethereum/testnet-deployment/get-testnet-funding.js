const { ethers } = require("hardhat");
const axios = require('axios');

/**
 * MULTI-STRATEGY TESTNET FUNDING
 * 
 * Tries multiple approaches to get testnet ETH:
 * 1. API-based faucets
 * 2. Multiple testnets (Sepolia, Goerli alternatives)
 * 3. Polygon Mumbai (cheaper alternative)
 * 4. Optimism/Arbitrum testnets
 */

const WALLET_ADDRESS = "0xD413ed443dE07bc345669A07367a3E6cfed3577d";

async function tryAPIFaucets() {
    console.log("🚰 Trying API-based faucets...");
    
    const faucetAPIs = [
        {
            name: "Chainlink Sepolia",
            url: `https://faucets.chain.link/sepolia`,
            method: 'post',
            data: { address: WALLET_ADDRESS }
        },
        {
            name: "Alchemy Sepolia",
            url: `https://sepoliafaucet.com/api/v1/faucet`,
            method: 'post',
            data: { address: WALLET_ADDRESS, amount: 1 }
        }
    ];
    
    for (const faucet of faucetAPIs) {
        try {
            console.log(`   Trying ${faucet.name}...`);
            
            const response = await axios({
                method: faucet.method,
                url: faucet.url,
                data: faucet.data,
                timeout: 10000
            });
            
            console.log(`   ✅ ${faucet.name} request sent:`, response.data);
            return true;
            
        } catch (error) {
            console.log(`   ❌ ${faucet.name} failed:`, error.response?.data || error.message);
        }
    }
    
    return false;
}

async function checkAlternativeNetworks() {
    console.log("\n🌐 Checking alternative testnet options...");
    
    const networks = [
        {
            name: "Polygon Mumbai",
            rpc: "https://rpc-mumbai.maticvigil.com",
            chainId: 80001,
            faucet: "https://faucet.polygon.technology"
        },
        {
            name: "BSC Testnet", 
            rpc: "https://data-seed-prebsc-1-s1.binance.org:8545",
            chainId: 97,
            faucet: "https://testnet.binance.org/faucet-smart"
        },
        {
            name: "Optimism Goerli",
            rpc: "https://goerli.optimism.io",
            chainId: 420,
            faucet: "https://app.optimism.io/faucet"
        }
    ];
    
    for (const network of networks) {
        try {
            console.log(`\n📡 Testing ${network.name}...`);
            
            const provider = new ethers.JsonRpcProvider(network.rpc);
            const balance = await provider.getBalance(WALLET_ADDRESS);
            
            console.log(`   💰 Balance: ${ethers.formatEther(balance)} ETH`);
            console.log(`   🚰 Faucet: ${network.faucet}`);
            
            if (balance > 0) {
                console.log(`   🎉 Found existing balance on ${network.name}!`);
                return { network, balance };
            }
            
        } catch (error) {
            console.log(`   ❌ ${network.name} unavailable:`, error.message);
        }
    }
    
    return null;
}

async function createAlternativeWallet() {
    console.log("\n🔑 Creating fresh wallet for better faucet success...");
    
    const wallet = ethers.Wallet.createRandom();
    console.log(`📍 New Address: ${wallet.address}`);
    console.log(`🔐 Private Key: ${wallet.privateKey}`);
    
    // Save to .env for easy access
    const fs = require('fs');
    const envContent = fs.readFileSync('.env', 'utf8');
    const newEnvContent = envContent + `\n\n# FRESH WALLET FOR FAUCET\nFRESH_WALLET_ADDRESS=${wallet.address}\nFRESH_WALLET_PRIVATE_KEY=${wallet.privateKey}\n`;
    fs.writeFileSync('.env', newEnvContent);
    
    console.log("✅ Fresh wallet saved to .env");
    console.log("\n🚰 Try these faucets with the fresh address:");
    console.log("   1. https://faucet.quicknode.com/ethereum/sepolia");
    console.log("   2. https://sepoliafaucet.com");
    console.log("   3. https://faucet.paradigm.xyz");
    
    return wallet;
}

async function main() {
    console.log("🎯 TESTNET FUNDING MISSION");
    console.log("=========================");
    console.log(`Target: ${WALLET_ADDRESS}`);
    console.log("");
    
    // Strategy 1: Try API faucets
    const apiSuccess = await tryAPIFaucets();
    if (apiSuccess) {
        console.log("\n✅ API faucet request successful!");
        console.log("⏳ Wait 1-2 minutes then check balance");
        return;
    }
    
    // Strategy 2: Check alternative networks
    const altNetwork = await checkAlternativeNetworks();
    if (altNetwork) {
        console.log(`\n🎉 Found funds on ${altNetwork.network.name}!`);
        console.log("💡 We can deploy there instead of Sepolia");
        return altNetwork;
    }
    
    // Strategy 3: Create fresh wallet
    const freshWallet = await createAlternativeWallet();
    
    console.log("\n📋 NEXT STEPS:");
    console.log("1. Use the fresh wallet address with web faucets");
    console.log("2. OR try alternative testnets (Polygon Mumbai, BSC)");
    console.log("3. OR we can proceed with local deployment proof");
    console.log("\n💡 Even local deployment proves the full system works!");
}

main().catch(console.error);