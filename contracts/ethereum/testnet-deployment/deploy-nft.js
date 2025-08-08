const { ethers } = require("hardhat");
const fs = require("fs");

/**
 * Deploy SimpleERC721 NFT Contract and Mint NFTs for SWAPS Testing
 */

async function main() {
    console.log("🚀 DEPLOYING SIMPLE ERC721 NFT CONTRACT");
    console.log("======================================\n");

    // Get deployer account (should be Alice from our test wallets)
    const [deployer] = await ethers.getSigners();
    console.log("👤 Deployer:", deployer.address);
    
    // Check balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Balance:", ethers.formatEther(balance), "ETH");
    
    // Get current gas price
    const feeData = await ethers.provider.getFeeData();
    console.log("⛽ Gas Price:", ethers.formatUnits(feeData.gasPrice, 'gwei'), "gwei\n");
    
    try {
        // Deploy SimpleERC721 contract
        console.log("📋 Deploying SimpleERC721 contract...");
        const SimpleERC721 = await ethers.getContractFactory("SimpleERC721");
        const nftContract = await SimpleERC721.deploy("SWAPS Test NFT", "SWAP");
        
        console.log("⏳ Waiting for deployment confirmation...");
        await nftContract.waitForDeployment();
        
        const contractAddress = await nftContract.getAddress();
        console.log("✅ Contract deployed!");
        console.log("   Address:", contractAddress);
        console.log("   Explorer: https://sepolia.etherscan.io/address/" + contractAddress);
        console.log();
        
        // Load wallet addresses from test-wallets file
        const walletsData = fs.readFileSync("../../../test-wallets-sepolia.json", "utf8");
        const wallets = JSON.parse(walletsData);
        
        // Mint NFTs to each wallet
        console.log("🎨 Minting NFTs...");
        
        // Mint NFT #1 to Alice
        console.log("   Minting NFT #1 to Alice...");
        let tx = await nftContract.mint(wallets.alice.address, 1);
        await tx.wait();
        console.log("   ✅ Minted NFT #1 to", wallets.alice.address);
        
        // Mint NFT #2 to Bob
        console.log("   Minting NFT #2 to Bob...");
        tx = await nftContract.mint(wallets.bob.address, 2);
        await tx.wait();
        console.log("   ✅ Minted NFT #2 to", wallets.bob.address);
        
        // Mint NFT #3 to Carol
        console.log("   Minting NFT #3 to Carol...");
        tx = await nftContract.mint(wallets.carol.address, 3);
        await tx.wait();
        console.log("   ✅ Minted NFT #3 to", wallets.carol.address);
        
        console.log("\n🔍 Verifying ownership...");
        for (let tokenId = 1; tokenId <= 3; tokenId++) {
            const owner = await nftContract.ownerOf(tokenId);
            console.log("   NFT #" + tokenId + ":", owner);
        }
        
        // Update the NFT configuration file
        console.log("\n📝 Updating configuration files...");
        
        const nftConfig = JSON.parse(fs.readFileSync("../../../sepolia-real-nfts.json", "utf8"));
        nftConfig.contractAddress = contractAddress;
        nftConfig.deploymentTime = new Date().toISOString();
        nftConfig.network = "sepolia";
        nftConfig.type = "real_deployed";
        
        // Update each NFT with the real contract address
        nftConfig.nfts.forEach((nft, index) => {
            nft.contractAddress = contractAddress;
            nft.tokenId = index + 1;
        });
        
        fs.writeFileSync("../../../sepolia-real-nfts.json", JSON.stringify(nftConfig, null, 2));
        console.log("✅ Updated sepolia-real-nfts.json");
        
        // Create deployment record
        const deploymentRecord = {
            contractAddress: contractAddress,
            nftContractAddress: contractAddress,
            deploymentTime: new Date().toISOString(),
            network: "sepolia",
            deployer: deployer.address,
            nfts: [
                { owner: "alice", address: wallets.alice.address, tokenId: 1 },
                { owner: "bob", address: wallets.bob.address, tokenId: 2 },
                { owner: "carol", address: wallets.carol.address, tokenId: 3 }
            ],
            contractName: "SWAPS Test NFT",
            contractSymbol: "SWAP"
        };
        
        fs.writeFileSync("nft-deployment-" + Date.now() + ".json", JSON.stringify(deploymentRecord, null, 2));
        console.log("✅ Created deployment record");
        
        console.log("\n🎉 NFT DEPLOYMENT COMPLETE!");
        console.log("===========================");
        console.log("Contract:", contractAddress);
        console.log("NFTs minted: 3");
        console.log("\n✨ Ready for SWAPS testing!");
        
    } catch (error) {
        console.error("\n❌ Error:", error.message);
        if (error.transaction) {
            console.error("Transaction:", error.transaction);
        }
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });