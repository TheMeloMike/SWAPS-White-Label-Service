const { ethers, upgrades } = require('hardhat');

/**
 * ETHEREUM DEPLOYMENT SCRIPT FOR SWAPS MULTI-PARTY NFT SWAP CONTRACT
 * 
 * Deploys the production-ready contract with:
 * - Proxy pattern for upgradability
 * - Proper initialization parameters
 * - Security validations
 * - Gas optimization
 * - Integration verification
 */

async function main() {
    console.log('🚀 DEPLOYING SWAPS ETHEREUM SMART CONTRACT');
    console.log('==========================================\n');

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log('📋 Deployment Configuration:');
    console.log(`   Deployer: ${deployer.address}`);
    console.log(`   Network: ${await ethers.provider.getNetwork().then(n => n.name)}`);
    console.log(`   Chain ID: ${await ethers.provider.getNetwork().then(n => n.chainId)}`);
    
    // Check deployer balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance < ethers.parseEther('0.1')) {
        console.log('⚠️  WARNING: Low ETH balance for deployment');
    }

    console.log('\n🔧 Contract Deployment...');

    // Get contract factory
    const SwapContract = await ethers.getContractFactory('MultiPartyNFTSwap');
    
    // Deployment parameters
    const owner = deployer.address;
    const feeRecipient = deployer.address; // Can be changed later
    
    console.log('📦 Deploying proxy contract...');
    
    // Deploy with OpenZeppelin proxy
    const swapContract = await upgrades.deployProxy(
        SwapContract,
        [owner, feeRecipient],
        { 
            initializer: 'initialize',
            kind: 'transparent'
        }
    );
    
    await swapContract.waitForDeployment();
    
    const contractAddress = await swapContract.getAddress();
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(contractAddress);
    const adminAddress = await upgrades.erc1967.getAdminAddress(contractAddress);
    
    console.log('✅ Deployment Successful!');
    console.log('\n📍 Contract Addresses:');
    console.log(`   Proxy: ${contractAddress}`);
    console.log(`   Implementation: ${implementationAddress}`);
    console.log(`   Admin: ${adminAddress}`);
    
    // Verify deployment
    console.log('\n🔍 Verification...');
    
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
    
    // Test basic functionality
    console.log('\n🧪 Basic Functionality Test...');
    
    const testSwapId = ethers.keccak256(ethers.toUtf8Bytes('deployment-test'));
    
    try {
        // This should fail since we don't have valid participants, but it verifies the function exists
        await swapContract.getSwapDetails.staticCall(testSwapId);
    } catch (error) {
        if (error.message.includes('Swap does not exist')) {
            console.log('   ✅ Contract functions accessible');
        } else {
            console.log('   ❌ Unexpected error:', error.message);
        }
    }
    
    // Get network explorer URL
    const network = await ethers.provider.getNetwork();
    const explorerUrls = {
        1: 'https://etherscan.io/address/',
        5: 'https://goerli.etherscan.io/address/',
        11155111: 'https://sepolia.etherscan.io/address/',
        137: 'https://polygonscan.com/address/',
        56: 'https://bscscan.com/address/'
    };
    
    const explorerUrl = explorerUrls[Number(network.chainId)];
    
    console.log('\n🔗 Explorer Links:');
    if (explorerUrl) {
        console.log(`   Proxy: ${explorerUrl}${contractAddress}`);
        console.log(`   Implementation: ${explorerUrl}${implementationAddress}`);
    } else {
        console.log('   Custom network - no explorer link available');
    }
    
    // Generate integration code for backend
    console.log('\n📋 Backend Integration:');
    console.log('   Add to your .env file:');
    console.log(`   ETHEREUM_CONTRACT_ADDRESS=${contractAddress}`);
    console.log(`   ETHEREUM_NETWORK=${network.name}`);
    console.log(`   ETHEREUM_CHAIN_ID=${network.chainId}`);
    
    // Output deployment summary
    const deploymentSummary = {
        network: network.name,
        chainId: Number(network.chainId),
        contractAddress: contractAddress,
        implementationAddress: implementationAddress,
        adminAddress: adminAddress,
        owner: contractOwner,
        deployer: deployer.address,
        version: version,
        timestamp: new Date().toISOString(),
        explorerUrl: explorerUrl ? `${explorerUrl}${contractAddress}` : null
    };
    
    // Save deployment info
    const fs = require('fs');
    const deploymentFile = `deployment-${network.name}-${Date.now()}.json`;
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentSummary, null, 2));
    
    console.log(`\n💾 Deployment info saved to: ${deploymentFile}`);
    
    console.log('\n🎉 ETHEREUM DEPLOYMENT COMPLETE!');
    console.log('================================');
    console.log('🚀 Ready for SWAPS integration!');
    console.log('📖 Next steps:');
    console.log('   1. Update backend configuration with contract address');
    console.log('   2. Verify contract on block explorer');
    console.log('   3. Configure EthereumIntegrationService in your API');
    console.log('   4. Run integration tests with real NFTs');
    console.log('   5. Set up monitoring and alerts');
    
    return {
        contractAddress,
        implementationAddress,
        adminAddress,
        deploymentSummary
    };
}

// Handle deployment
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('💥 Deployment failed:', error);
            process.exit(1);
        });
}

module.exports = main;