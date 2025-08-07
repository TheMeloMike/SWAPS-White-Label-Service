const { ethers, upgrades, network } = require("hardhat");
const fs = require("fs");

/**
 * COMPREHENSIVE TESTNET DEPLOYMENT SCRIPT
 * 
 * Deploys the audited SWAPS MultiPartyNFTSwap contract to testnet
 * with comprehensive validation, testing, and monitoring setup
 */

async function main() {
    console.log("🚀 SWAPS ETHEREUM TESTNET DEPLOYMENT");
    console.log("=====================================\n");

    // Get network info
    const networkName = network.name;
    const chainId = await ethers.provider.getNetwork().then(n => Number(n.chainId));
    
    console.log("📋 Deployment Configuration:");
    console.log(`   Network: ${networkName}`);
    console.log(`   Chain ID: ${chainId}`);
    
    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log(`   Deployer: ${deployer.address}`);
    
    // Check deployer balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance < ethers.parseEther("0.05")) {
        console.log("⚠️  WARNING: Low balance for deployment");
        console.log("   Consider funding the account with testnet ETH");
        
        // Provide faucet links based on network
        const faucets = {
            11155111: "https://sepoliafaucet.com", // Sepolia
            5: "https://goerlifaucet.com", // Goerli
            80001: "https://faucet.polygon.technology", // Mumbai
            97: "https://testnet.binance.org/faucet-smart" // BSC Testnet
        };
        
        if (faucets[chainId]) {
            console.log(`   Faucet: ${faucets[chainId]}`);
        }
        
        // Continue anyway for testing
    }

    console.log("\n🔧 Contract Compilation and Deployment...");

    // Get contract factory
    const SwapContract = await ethers.getContractFactory("MultiPartyNFTSwap");
    
    console.log("📦 Deploying upgradeable proxy...");
    
    // Deployment parameters
    const owner = deployer.address;
    const feeRecipient = deployer.address; // Can be changed later
    
    // Deploy with OpenZeppelin proxy
    let swapContract;
    try {
        swapContract = await upgrades.deployProxy(
            SwapContract,
            [owner, feeRecipient],
            { 
                initializer: 'initialize',
                kind: 'transparent',
                timeout: 120000 // 2 minutes timeout
            }
        );
        
        await swapContract.waitForDeployment();
    } catch (error) {
        console.error("💥 Deployment failed:", error.message);
        
        if (error.message.includes("gas")) {
            console.log("💡 Try increasing gas limit or gas price");
        }
        
        process.exit(1);
    }
    
    const contractAddress = await swapContract.getAddress();
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(contractAddress);
    const adminAddress = await upgrades.erc1967.getAdminAddress(contractAddress);
    
    console.log("✅ Deployment Successful!");
    console.log("\n📍 Contract Addresses:");
    console.log(`   Proxy: ${contractAddress}`);
    console.log(`   Implementation: ${implementationAddress}`);
    console.log(`   Admin: ${adminAddress}`);
    
    // Get deployment transaction details
    const deploymentTx = swapContract.deploymentTransaction();
    if (deploymentTx) {
        console.log(`   Deploy Tx: ${deploymentTx.hash}`);
        console.log(`   Gas Used: ${deploymentTx.gasLimit.toString()}`);
    }
    
    console.log("\n🔍 Contract Verification...");
    
    // Verify basic contract functionality
    try {
        const version = await swapContract.getVersion();
        const contractOwner = await swapContract.owner();
        const maxParticipants = await swapContract.maxParticipants();
        const platformFee = await swapContract.platformFeePercentage();
        
        console.log(`   Version: ${version}`);
        console.log(`   Owner: ${contractOwner}`);
        console.log(`   Max Participants: ${maxParticipants}`);
        console.log(`   Platform Fee: ${platformFee}%`);
        
        // Verify interface support
        const supportsERC721Receiver = await swapContract.supportsInterface('0x150b7a02');
        const supportsERC1155Receiver = await swapContract.supportsInterface('0x4e2312e0');
        
        console.log(`   ERC721 Receiver: ${supportsERC721Receiver ? '✅' : '❌'}`);
        console.log(`   ERC1155 Receiver: ${supportsERC1155Receiver ? '✅' : '❌'}`);
        
        console.log("✅ Contract verification passed!");
        
    } catch (error) {
        console.error("❌ Contract verification failed:", error.message);
    }
    
    console.log("\n🎨 Deploying Test NFT Contracts...");
    
    // Deploy test NFT contracts for testing
    let testNFT721, testNFT1155;
    
    try {
        // Deploy simple test ERC721
        const TestERC721 = await ethers.getContractFactory("SimpleERC721");
        testNFT721 = await TestERC721.deploy("SWAPS Test NFT", "STNFT");
        await testNFT721.waitForDeployment();
        
        // Deploy simple test ERC1155  
        const TestERC1155 = await ethers.getContractFactory("SimpleERC1155");
        testNFT1155 = await TestERC1155.deploy("https://api.swaps.com/metadata/{id}");
        await testNFT1155.waitForDeployment();
        
        console.log(`   Test ERC721: ${await testNFT721.getAddress()}`);
        console.log(`   Test ERC1155: ${await testNFT1155.getAddress()}`);
        
    } catch (error) {
        console.log("⚠️  Test NFT deployment failed (will skip):", error.message);
        testNFT721 = null;
        testNFT1155 = null;
    }
    
    // Get network explorer URLs
    const explorerUrls = {
        1: 'https://etherscan.io',
        5: 'https://goerli.etherscan.io', 
        11155111: 'https://sepolia.etherscan.io',
        137: 'https://polygonscan.com',
        80001: 'https://mumbai.polygonscan.com',
        56: 'https://bscscan.com',
        97: 'https://testnet.bscscan.com'
    };
    
    const explorerUrl = explorerUrls[chainId];
    
    console.log("\n🔗 Explorer Links:");
    if (explorerUrl) {
        console.log(`   Proxy: ${explorerUrl}/address/${contractAddress}`);
        console.log(`   Implementation: ${explorerUrl}/address/${implementationAddress}`);
        if (testNFT721) {
            console.log(`   Test ERC721: ${explorerUrl}/address/${await testNFT721.getAddress()}`);
        }
        if (testNFT1155) {
            console.log(`   Test ERC1155: ${explorerUrl}/address/${await testNFT1155.getAddress()}`);
        }
    } else {
        console.log("   Custom network - no explorer link available");
    }
    
    // Generate deployment summary
    const deploymentSummary = {
        network: networkName,
        chainId: chainId,
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        deployerBalance: ethers.formatEther(balance),
        contracts: {
            swapProxy: contractAddress,
            swapImplementation: implementationAddress,
            swapAdmin: adminAddress,
            testERC721: testNFT721 ? await testNFT721.getAddress() : null,
            testERC1155: testNFT1155 ? await testNFT1155.getAddress() : null,
        },
        version: await swapContract.getVersion().catch(() => "unknown"),
        explorerUrls: explorerUrl ? {
            proxy: `${explorerUrl}/address/${contractAddress}`,
            implementation: `${explorerUrl}/address/${implementationAddress}`,
        } : null,
        gasUsed: deploymentTx ? deploymentTx.gasLimit.toString() : "unknown",
    };
    
    // Save deployment info
    const deploymentFile = `deployment-${networkName}-${Date.now()}.json`;
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentSummary, null, 2));
    
    console.log(`\n💾 Deployment saved to: ${deploymentFile}`);
    
    console.log("\n📋 Backend Integration:");
    console.log("   Add to your .env file:");
    console.log(`   ETHEREUM_CONTRACT_ADDRESS=${contractAddress}`);
    console.log(`   ETHEREUM_NETWORK=${networkName}`);
    console.log(`   ETHEREUM_CHAIN_ID=${chainId}`);
    console.log(`   ETHEREUM_RPC_URL=<your_rpc_url>`);
    
    console.log("\n🧪 Testing Commands:");
    console.log(`   Test contract: npx hardhat test --network ${networkName}`);
    console.log(`   Verify contract: npx hardhat verify --network ${networkName} ${contractAddress}`);
    console.log(`   Upgrade contract: npx hardhat run scripts/upgrade.js --network ${networkName}`);
    
    console.log("\n🎉 TESTNET DEPLOYMENT COMPLETE!");
    console.log("==================================");
    console.log("🚀 Ready for integration testing!");
    console.log("📖 Next steps:");
    console.log("   1. Verify contract on block explorer");
    console.log("   2. Run integration tests with SWAPS backend");
    console.log("   3. Create test swaps with mock NFTs");
    console.log("   4. Monitor gas usage and performance");
    console.log("   5. Test edge cases and error handling");
    
    return deploymentSummary;
}

// Handle deployment
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("💥 Deployment failed:", error);
            process.exit(1);
        });
}

module.exports = main;