require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

/**
 * HARDHAT CONFIGURATION FOR ETHEREUM TESTNET DEPLOYMENT
 * 
 * Supports multiple testnets for comprehensive testing:
 * - Sepolia (recommended for testing)
 * - Goerli (legacy support)
 * - Polygon Mumbai (L2 testing)
 * - BSC Testnet (alternative EVM)
 */

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Enable intermediate representation for better optimization
    },
  },
  networks: {
    // Ethereum Sepolia Testnet (Primary)
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/" + (process.env.INFURA_KEY || ""),
      accounts: (process.env.TESTNET_PRIVATE_KEY && process.env.TESTNET_PRIVATE_KEY.length >= 64) ? [process.env.TESTNET_PRIVATE_KEY] : [],
      gas: 6000000,
      gasPrice: "auto",
      chainId: 11155111,
    },
    
    // Ethereum Goerli Testnet (Backup)
    goerli: {
      url: process.env.GOERLI_RPC_URL || "https://goerli.infura.io/v3/" + (process.env.INFURA_KEY || ""),
      accounts: (process.env.TESTNET_PRIVATE_KEY && process.env.TESTNET_PRIVATE_KEY.length >= 64) ? [process.env.TESTNET_PRIVATE_KEY] : [],
      gas: 6000000,
      gasPrice: "auto",
      chainId: 5,
    },
    
    // Polygon Mumbai Testnet (L2 Testing)
    mumbai: {
      url: process.env.MUMBAI_RPC_URL || "https://rpc-mumbai.maticvigil.com",
      accounts: (process.env.TESTNET_PRIVATE_KEY && process.env.TESTNET_PRIVATE_KEY.length >= 64) ? [process.env.TESTNET_PRIVATE_KEY] : [],
      gas: 6000000,
      gasPrice: "auto",
      chainId: 80001,
    },
    
    // BSC Testnet (Alternative EVM)
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      accounts: (process.env.TESTNET_PRIVATE_KEY && process.env.TESTNET_PRIVATE_KEY.length >= 64) ? [process.env.TESTNET_PRIVATE_KEY] : [],
      gas: 6000000,
      gasPrice: "auto",
      chainId: 97,
    },
    
    // Local Hardhat Network
    hardhat: {
      chainId: 1337,
      gas: 12000000,
      blockGasLimit: 12000000,
      allowUnlimitedContractSize: true,
    },
  },
  
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      goerli: process.env.ETHERSCAN_API_KEY || "",
      polygonMumbai: process.env.POLYGONSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
    },
  },
  
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    gasPrice: 20, // gwei
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  
  mocha: {
    timeout: 120000, // 2 minutes for complex tests
  },
  
  // Custom task configurations
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

// Custom Hardhat tasks
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();
  for (const account of accounts) {
    console.log(account.address);
  }
});

task("balance", "Prints an account's balance")
  .addParam("account", "The account's address")
  .setAction(async (taskArgs, hre) => {
    const balance = await hre.ethers.provider.getBalance(taskArgs.account);
    console.log(hre.ethers.formatEther(balance), "ETH");
  });

task("deploy-testnet", "Deploy SWAPS contract to testnet")
  .addParam("targetNetwork", "The network to deploy to")
  .setAction(async (taskArgs, hre) => {
    console.log(`🚀 Deploying to ${taskArgs.targetNetwork}...`);
    await hre.run("run", {
      script: "deploy-testnet.js"
    });
  });