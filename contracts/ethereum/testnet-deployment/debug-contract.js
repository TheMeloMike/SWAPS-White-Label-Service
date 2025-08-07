const { ethers } = require("hardhat");
const fs = require("fs");

async function debugContract() {
    console.log("🔍 DEBUGGING CONTRACT DEPLOYMENT");
    console.log("===============================");
    
    // Get deployment info
    const deploymentFiles = fs.readdirSync('.')
        .filter(f => f.startsWith('deployment-') && f.endsWith('.json'));
    
    const latestDeployment = deploymentFiles.sort().pop();
    const deploymentInfo = JSON.parse(fs.readFileSync(latestDeployment));
    
    const proxyAddress = deploymentInfo.contracts.swapProxy;
    const implementationAddress = deploymentInfo.contracts.swapImplementation;
    
    console.log(`📍 Proxy Address: ${proxyAddress}`);
    console.log(`📍 Implementation Address: ${implementationAddress}`);
    
    // Check if addresses have code
    const proxyCode = await ethers.provider.getCode(proxyAddress);
    const implCode = await ethers.provider.getCode(implementationAddress);
    
    console.log(`📦 Proxy has code: ${proxyCode !== '0x'} (${proxyCode.length} bytes)`);
    console.log(`📦 Implementation has code: ${implCode !== '0x'} (${implCode.length} bytes)`);
    
    // Try to connect to implementation directly
    console.log("\n🔍 Testing Implementation Contract Directly:");
    try {
        const implementationContract = await ethers.getContractAt("MultiPartyNFTSwap", implementationAddress);
        
        // Test basic calls
        try {
            const maxParticipants = await implementationContract.maxParticipants();
            console.log(`✅ Implementation maxParticipants: ${maxParticipants}`);
        } catch (error) {
            console.log(`❌ Implementation call failed: ${error.message}`);
        }
        
    } catch (error) {
        console.log(`❌ Implementation connection failed: ${error.message}`);
    }
    
    // Check if proxy is properly initialized
    console.log("\n🔍 Testing Proxy Initialization:");
    try {
        const proxyContract = await ethers.getContractAt("MultiPartyNFTSwap", proxyAddress);
        
        // Try a simple storage read that should work even if not initialized
        const code = await ethers.provider.getCode(proxyAddress);
        console.log(`✅ Proxy bytecode length: ${code.length}`);
        
        // Check if the proxy is pointing to the implementation
        const provider = ethers.provider;
        const implementationSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
        const storedImplementation = await provider.getStorage(proxyAddress, implementationSlot);
        const actualImplementation = '0x' + storedImplementation.slice(26); // Remove padding
        
        console.log(`📍 Stored implementation: ${actualImplementation}`);
        console.log(`📍 Expected implementation: ${implementationAddress.toLowerCase()}`);
        console.log(`✅ Proxy setup correct: ${actualImplementation.toLowerCase() === implementationAddress.toLowerCase()}`);
        
    } catch (error) {
        console.log(`❌ Proxy analysis failed: ${error.message}`);
    }
    
    // Test if proxy needs initialization
    console.log("\n🔍 Checking Initialization Status:");
    try {
        const [deployer] = await ethers.getSigners();
        const proxyContract = await ethers.getContractAt("MultiPartyNFTSwap", proxyAddress);
        
        // Check if we can call a simple function
        try {
            const tx = await proxyContract.maxParticipants.staticCall();
            console.log(`✅ Proxy working, maxParticipants: ${tx}`);
        } catch (initError) {
            console.log(`⚠️ Proxy not initialized or function missing: ${initError.message}`);
            
            // Try to initialize if needed
            console.log("\n🔧 Attempting to initialize proxy...");
            try {
                const initTx = await proxyContract.initialize(deployer.address, deployer.address);
                await initTx.wait();
                console.log("✅ Proxy initialized successfully");
                
                // Test again
                const maxParticipants = await proxyContract.maxParticipants();
                console.log(`✅ After init, maxParticipants: ${maxParticipants}`);
                
            } catch (initErr) {
                console.log(`❌ Initialization failed: ${initErr.message}`);
            }
        }
        
    } catch (error) {
        console.log(`❌ Initialization check failed: ${error.message}`);
    }
}

debugContract().catch(console.error);