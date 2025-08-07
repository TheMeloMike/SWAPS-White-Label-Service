const { ethers } = require("hardhat");

/**
 * GAS COST ESTIMATION FOR SWAPS DEPLOYMENT
 * 
 * This script estimates the exact gas costs for:
 * 1. Deploying the SWAPS contract
 * 2. Deploying test NFTs  
 * 3. Running a complete 3-way trade
 */

async function estimateGasCosts() {
    console.log("⛽ GAS COST ESTIMATION FOR SWAPS DEPLOYMENT");
    console.log("==========================================");
    
    // Get current gas price from Sepolia
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const gasPrice = await provider.getFeeData();
    
    console.log("📊 Current Sepolia Gas Prices:");
    console.log(`   Gas Price: ${ethers.formatUnits(gasPrice.gasPrice, 'gwei')} gwei`);
    console.log(`   Max Fee: ${ethers.formatUnits(gasPrice.maxFeePerGas, 'gwei')} gwei`);
    
    // Estimated gas usage based on our local tests
    const gasEstimates = {
        swapContractDeploy: 3500000,    // SWAPS contract deployment
        testNFTDeploy: 1500000,         // Simple ERC721 deployment
        swapCreation: 1200000,          // Creating a 3-way swap
        approvals: 80000 * 3,           // 3 participants approving
        swapExecution: 200000,          // Executing the atomic swap
    };
    
    console.log("\n⛽ Gas Usage Estimates:");
    
    let totalGas = 0;
    let totalCostWei = BigInt(0);
    
    for (const [operation, gasUsed] of Object.entries(gasEstimates)) {
        const costWei = BigInt(gasUsed) * gasPrice.gasPrice;
        const costETH = ethers.formatEther(costWei);
        
        console.log(`   ${operation.padEnd(20)}: ${gasUsed.toLocaleString().padStart(10)} gas = ${costETH.padStart(8)} ETH`);
        
        totalGas += gasUsed;
        totalCostWei += costWei;
    }
    
    const totalCostETH = ethers.formatEther(totalCostWei);
    
    console.log("   " + "─".repeat(50));
    console.log(`   ${"TOTAL".padEnd(20)}: ${totalGas.toLocaleString().padStart(10)} gas = ${totalCostETH.padStart(8)} ETH`);
    
    // Add 20% buffer for safety
    const bufferCostWei = totalCostWei * BigInt(120) / BigInt(100);
    const bufferCostETH = ethers.formatEther(bufferCostWei);
    
    console.log(`   ${"WITH 20% BUFFER".padEnd(20)}: ${""} = ${bufferCostETH.padStart(8)} ETH`);
    
    console.log("\n💰 FUNDING ANALYSIS:");
    console.log(`   Available: 0.1 ETH`);
    console.log(`   Required:  ${bufferCostETH} ETH`);
    
    const availableWei = ethers.parseEther("0.1");
    const sufficient = availableWei >= bufferCostWei;
    
    if (sufficient) {
        console.log("   ✅ SUFFICIENT! We can proceed with deployment");
        
        const remainingWei = availableWei - bufferCostWei;
        const remainingETH = ethers.formatEther(remainingWei);
        console.log(`   💵 Remaining: ${remainingETH} ETH`);
    } else {
        console.log("   ❌ INSUFFICIENT funds");
        
        const shortfallWei = bufferCostWei - availableWei;
        const shortfallETH = ethers.formatEther(shortfallWei);
        console.log(`   💸 Need additional: ${shortfallETH} ETH`);
        
        console.log("\n🔧 OPTIMIZATION OPTIONS:");
        console.log("   1. Deploy only SWAPS contract (skip test NFTs)");
        console.log("   2. Use existing NFTs on testnet");
        console.log("   3. Reduce gas limit/price");
        console.log("   4. Deploy minimal demo version");
    }
    
    return {
        totalCostETH: parseFloat(totalCostETH),
        bufferCostETH: parseFloat(bufferCostETH),
        sufficient,
        gasEstimates
    };
}

// Run estimation
estimateGasCosts()
    .then((result) => {
        console.log("\n📋 RECOMMENDATION:");
        if (result.sufficient) {
            console.log("✅ Proceed with full deployment!");
        } else {
            console.log("🔧 Use optimized deployment strategy");
        }
    })
    .catch(console.error);