const { ethers } = require("hardhat");

/**
 * MINT TEST NFTs FOR SEPOLIA DEMONSTRATION
 * 
 * Simple script to mint NFTs for our 3-way trade demonstration
 */

async function mintNFTs() {
    console.log("🎨 MINTING TEST NFTs ON SEPOLIA");
    console.log("==============================");
    
    const [deployer] = await ethers.getSigners();
    console.log(`👤 Deployer: ${deployer.address}`);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);
    
    // Connect to NFT contract
    const nftAddress = "0x067a1f0892eB57c8dccb9FA377D568De78ECf6dc";
    console.log(`🎨 NFT Contract: ${nftAddress}`);
    
    const TestERC721 = await ethers.getContractFactory("SimpleERC721");
    const nftContract = TestERC721.attach(nftAddress);
    
    // Check contract info
    try {
        const name = await nftContract.name();
        const symbol = await nftContract.symbol();
        console.log(`📋 Contract: ${name} (${symbol})`);
    } catch (error) {
        console.log("⚠️  Contract info error:", error.message);
    }
    
    // Get current gas settings
    const feeData = await ethers.provider.getFeeData();
    console.log(`⛽ Gas Price: ${ethers.formatUnits(feeData.gasPrice, 'gwei')} gwei`);
    
    // Check if NFTs already exist
    console.log("\n🔍 Checking existing NFTs...");
    for (let tokenId = 1; tokenId <= 3; tokenId++) {
        try {
            const owner = await nftContract.ownerOf(tokenId);
            console.log(`   NFT #${tokenId}: ${owner} ✅`);
        } catch (error) {
            console.log(`   NFT #${tokenId}: Not minted yet`);
        }
    }
    
    // Mint NFTs 1, 2, 3
    console.log("\n🎨 Minting NFTs...");
    
    for (let tokenId = 1; tokenId <= 3; tokenId++) {
        try {
            // Check if already exists
            try {
                await nftContract.ownerOf(tokenId);
                console.log(`   NFT #${tokenId}: Already exists, skipping`);
                continue;
            } catch (error) {
                // Doesn't exist, proceed with minting
            }
            
            console.log(`   Minting NFT #${tokenId}...`);
            
            // Try to mint with proper gas settings
            const mintTx = await nftContract.mint(deployer.address, tokenId, {
                gasLimit: 150000,
                gasPrice: feeData.gasPrice
            });
            
            console.log(`   🔄 TX sent: ${mintTx.hash}`);
            const receipt = await mintTx.wait();
            
            if (receipt.status === 1) {
                console.log(`   ✅ NFT #${tokenId} minted successfully!`);
                console.log(`   🔗 TX: https://sepolia.etherscan.io/tx/${receipt.hash}`);
            } else {
                console.log(`   ❌ NFT #${tokenId} mint failed (status: ${receipt.status})`);
            }
            
        } catch (error) {
            console.log(`   ❌ NFT #${tokenId} mint error:`, error.message);
            
            // Try to get more specific error info
            if (error.receipt) {
                console.log(`   📋 Receipt status: ${error.receipt.status}`);
                console.log(`   ⛽ Gas used: ${error.receipt.gasUsed}`);
            }
        }
    }
    
    // Final verification
    console.log("\n🔍 Final NFT status:");
    for (let tokenId = 1; tokenId <= 3; tokenId++) {
        try {
            const owner = await nftContract.ownerOf(tokenId);
            console.log(`   NFT #${tokenId}: ${owner} ✅`);
        } catch (error) {
            console.log(`   NFT #${tokenId}: ❌ Not minted`);
        }
    }
    
    // Set approval for SWAPS contract
    const swapContractAddress = "0xb17Ad11D1b9474c5e7403cA62A8B6D3bc6Deae67";
    console.log(`\n🔐 Setting approval for SWAPS contract: ${swapContractAddress}`);
    
    try {
        const isApproved = await nftContract.isApprovedForAll(deployer.address, swapContractAddress);
        console.log(`   Current approval status: ${isApproved}`);
        
        if (!isApproved) {
            console.log("   Setting approval...");
            const approvalTx = await nftContract.setApprovalForAll(swapContractAddress, true, {
                gasLimit: 100000,
                gasPrice: feeData.gasPrice
            });
            
            const approvalReceipt = await approvalTx.wait();
            console.log(`   ✅ Approval set! TX: https://sepolia.etherscan.io/tx/${approvalReceipt.hash}`);
        } else {
            console.log("   ✅ Already approved");
        }
    } catch (error) {
        console.log("   ❌ Approval error:", error.message);
    }
    
    console.log("\n🎉 NFT MINTING COMPLETE!");
}

mintNFTs().catch(console.error);