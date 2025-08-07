const ethers = require('ethers');
require('dotenv').config();

const WALLET_ADDRESS = '0xD413ed443dE07bc345669A07367a3E6cfed3577d';
const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';

async function monitorBalance() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    console.log('💰 MONITORING WALLET BALANCE FOR DEPLOYMENT');
    console.log('==========================================');
    console.log(`📍 Wallet: ${WALLET_ADDRESS}`);
    console.log(`🔗 Network: Sepolia Testnet`);
    console.log('\n⏳ Checking balance every 5 seconds...\n');
    
    let lastBalance = '0';
    let deploymentReady = false;
    
    const checkBalance = async () => {
        try {
            const balance = await provider.getBalance(WALLET_ADDRESS);
            const balanceInEth = ethers.formatEther(balance);
            
            if (balanceInEth !== lastBalance) {
                console.log(`✅ Balance updated: ${balanceInEth} ETH`);
                lastBalance = balanceInEth;
                
                if (parseFloat(balanceInEth) >= 0.1 && !deploymentReady) {
                    deploymentReady = true;
                    console.log('\n🎉 WALLET FUNDED! Ready for deployment!');
                    console.log('💡 Run: npm run deploy:sepolia');
                    console.log('\n🚀 DEPLOYING PRODUCTION SWAPS CONTRACT...\n');
                    
                    // Auto-deploy when funded
                    const { exec } = require('child_process');
                    exec('npm run deploy:sepolia', (error, stdout, stderr) => {
                        if (error) {
                            console.error(`❌ Deployment error: ${error}`);
                            return;
                        }
                        console.log(stdout);
                        if (stderr) console.error(stderr);
                    });
                }
            }
        } catch (error) {
            console.error('Error checking balance:', error.message);
        }
    };
    
    // Initial check
    await checkBalance();
    
    // Check every 5 seconds
    setInterval(checkBalance, 5000);
}

// Faucet information
console.log('🔗 SEPOLIA FAUCETS:');
console.log('   1. https://faucet.quicknode.com/ethereum/sepolia');
console.log('   2. https://sepoliafaucet.com');
console.log('   3. https://faucet.paradigm.xyz');
console.log('   4. https://www.alchemy.com/faucets/ethereum-sepolia');
console.log('\n💡 Get at least 0.5 ETH for deployment + testing\n');

monitorBalance().catch(console.error);