/**
 * SWAPS Real NFT Minting Script for Sepolia
 * ==========================================
 * 
 * This script:
 * 1. Deploys a simple ERC721 contract to Sepolia
 * 2. Mints one unique NFT for each of our 3 test wallets
 * 3. Saves the NFT data for use in our trade execution script
 */

const { ethers } = require('ethers');
const fs = require('fs');

class SepoliaRealNFTMinter {
    constructor() {
        // Sepolia RPC (using public endpoint)
        this.provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
        
        // Load wallets
        const walletData = JSON.parse(fs.readFileSync('test-wallets-sepolia.json', 'utf8'));
        this.wallets = {
            alice: new ethers.Wallet(walletData.alice.privateKey, this.provider),
            bob: new ethers.Wallet(walletData.bob.privateKey, this.provider),
            carol: new ethers.Wallet(walletData.carol.privateKey, this.provider)
        };

        // Simple ERC721 contract ABI and bytecode
        this.nftContractABI = [
            "constructor(string memory name, string memory symbol)",
            "function mint(address to, uint256 tokenId, string memory tokenURI) public",
            "function ownerOf(uint256 tokenId) public view returns (address)",
            "function tokenURI(uint256 tokenId) public view returns (string)",
            "function approve(address to, uint256 tokenId) public",
            "function transferFrom(address from, address to, uint256 tokenId) public",
            "function name() public view returns (string)",
            "function symbol() public view returns (string)"
        ];

        // Simple ERC721 bytecode (minimal implementation)
        this.nftContractBytecode = "0x608060405234801561001057600080fd5b506040516113a83803806113a8833981810160405281019061003291906100f7565b81600090816100419190610383565b5080600190816100519190610383565b505050610455565b6000604051905090565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6100c182610078565b810181811067ffffffffffffffff821117156100e0576100df610089565b5b80604052505050565b60006100f361005a565b90506100ff82826100b8565b919050565b6000806040838503121561011b5761011a610064565b5b600083013567ffffffffffffffff81111561013a57610139610069565b5b6101468582860161014e565b925050602083013567ffffffffffffffff8111156101675761016661006e565b5b6101738582860161014e565b9150509250929050565b600067ffffffffffffffff82111561019857610197610089565b5b6101a182610078565b9050602081019050919050565b60005b838110156101cc5780820151818401526020810190506101b1565b838111156101db576000848401525b50505050565b60006101f46101ef8461017d565b6100e9565b9050828152602081018484840111156102105761020f610073565b5b61021b8482856101ae565b509392505050565b600082601f8301126102385761023761006e565b5b81516102488482602086016101e1565b91505092915050565b60008151905061026081610223565b92915050565b6000602082840312156102825761027161005f565b5b600061029084828501610251565b91505092915050565b600081519050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b600060028204905060018216806102ec57607f821691505b6020821081036102ff576102fe6102a5565b5b50919050565b60006103108261029a565b61031a81856102d4565b935061032a8185602086016101ae565b61033381610078565b840191505092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b600061037982610305565b91506103848361033e565b9150828201905092915050565b600061039c8261029a565b6103a681856102d4565b93506103b68185602086016101ae565b6103bf81610078565b840191505092915050565b60006103d58261029a565b6103df81856102d4565b93506103ef8185602086016101ae565b6103f881610078565b840191505092915050565b60006104108260006102d4565b915061041b8261042a565b602082019050919050565b600061043182610403565b9050919050565b6104418161042a565b811461044c57600080fd5b50565b610f44806104646000396000f3fe608060405234801561001057600080fd5b50600436106100885760003560e01c80636352211e1161005b5780636352211e146101275780638da5cb5b1461015757806395d89b4114610175578063c87b56dd1461019357610088565b806306fdde031461008d578063095ea7b3146100ab57806323b872dd146100c757806342842e0e146100e3575b600080fd5b6100956101c3565b6040516100a29190610b3d565b60405180910390f35b6100c560048036038101906100c09190610bf8565b610255565b005b6100e160048036038101906100dc9190610c38565b61026c565b005b6100fd60048036038101906100f89190610c38565b6102cc565b005b61010f6102ec565b60405161011e9190610ca3565b60405180910390f35b610141600480360381019061013c9190610cbe565b610372565b60405161014e9190610cfa565b60405180910390f35b61015f610424565b60405161016c9190610cfa565b60405180910390f35b61017d61044e565b60405161018a9190610b3d565b60405180910390f35b6101ad60048036038101906101a89190610cbe565b6104e0565b6040516101ba9190610b3d565b60405180910390f35b6060600080546101d290610d44565b80601f01602080910402602001604051908101604052809291908181526020018280546101fe90610d44565b801561024b5780601f106102205761010080835404028352916020019161024b565b820191906000526020600020905b81548152906001019060200180831161022e57829003601f168201915b5050505050905090565b610267826102618361057c565b83610592565b505050565b61027783838361059f565b6102c782826040518060600160405280602481526020016108e860249139600460008873ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020546105fc9092919063ffffffff16565b505050565b6102e783838360405180602001604052806000815250610660565b505050565b6000806102f761069b565b90508073ffffffffffffffffffffffffffffffffffffffff1663f2fde38b6040518163ffffffff1660e01b8152600401602060405180830381865afa158015610344573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906103689190610d8a565b9150505090565b6000806002600084815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff160361041b576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161041290610e03565b60405180910390fd5b80915050919050565b6000600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b60606001805461045d90610d44565b80601f016020809104026020016040519081016040528092919081815260200182805461048990610d44565b80156104d65780601f106104ab576101008083540402835291602001916104d6565b820191906000526020600020905b8154815290600101906020018083116104b957829003601f168201915b5050505050905090565b60606104eb826106c2565b61052a576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161052190610e95565b60405180910390fd5b6000600460008481526020019081526020016000208054610550610d44565b80601f016020809104026020016040519081016040528092919081815260200182805461057c90610d44565b80156105c95780601f1061059e576101008083540402835291602001916105c9565b820191906000526020600020905b8154815290600101906020018083116105ac57829003601f168201915b505050505090508092505050919050565b6000610587826106c2565b9050919050565b61059c83838361072e565b505050565b6105aa8383836107e4565b6105f7816040518060600160405280602a8152602001610890602a91396002600086815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff166105fc9092919063ffffffff16565b505050565b6000828411156106465760006040517f70a0823100000000000000000000000000000000000000000000000000000000815260040161063d9190610eb5565b60405180910390fd5b600061065285856108a1565b905080915050949350505050565b61066b8484846102cc565b61069584848484604051806020016040528060008152506108b5565b50505050565b6000600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b60008073ffffffffffffffffffffffffffffffffffffffff166002600084815260200190815260200160002060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614159050919050565b8273ffffffffffffffffffffffffffffffffffffffff1661074e82610372565b73ffffffffffffffffffffffffffffffffffffffff16146107a4576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161079b90610f22565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036107de5760006107dd90610f42565b5b50505050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603610854576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161084b90610fb4565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036108c4576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016108bb90611026565b60405180910390fd5b610870838383610969565b61087b60008261096e565b6001600360008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055506108e4816002600085815260200190815260200160002061096e90919063ffffffff16565b60026000838152602001908152602001600020819055506109058282610a25565b808273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef60405160405180910390a4505050565b600082820390508091505092915050565b6000813b9050919050565b505050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036109de576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016109d590611098565b60405180910390fd5b6109e7816106c2565b15610a27576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610a1e90611104565b60405180910390fd5b610a3360008383610969565b6001600360008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206000828254610a839190611153565b92505081905550816002600083815260200190815260200160002060006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550808273ffffffffffffffffffffffffffffffffffffffff16600073ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef60405160405180910390a45050565b600080fd5b600080fd5b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000610b6082610b35565b9050919050565b610b7081610b55565b8114610b7b57600080fd5b50565b600081359050610b8d81610b67565b92915050565b6000819050919050565b610ba681610b93565b8114610bb157600080fd5b50565b600081359050610bc381610b9d565b92915050565b600080fd5b600080fd5b600080fd5b60008083601f840112610bee57610bed610bc9565b5b8235905067ffffffffffffffff811115610c0b57610c0a610bce565b5b602083019150836001820283011115610c2757610c26610bd3565b5b9250929050565b60008060008060608587031215610c4857610c47610b2b565b5b6000610c5687828801610b7e565b9450506020610c6787828801610b7e565b9350506040610c7887828801610bb4565b925050606085013567ffffffffffffffff811115610c9957610c98610b30565b5b610ca587828801610bd8565b925092505092959194509250565b610cbc81610b93565b82525050565b6000602082019050610cd76000830184610cb3565b92915050565b610ce681610b55565b82525050565b6000602082019050610d016000830184610cdd565b92915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b60006002820490506001821680610d5c57607f821691505b602082108103610d6f57610d6e610d07565b5b50919050565b600081519050610d8481610b67565b92915050565b600060208284031215610da057610d9f610b2b565b5b6000610dae84828501610d75565b91505092915050565b600082825260208201905092915050565b7f4552433732313a206f776e657220717565727920666f72206e6f6e657869737460008201527f656e7420746f6b656e0000000000000000000000000000000000000000000000602082015250565b6000610e25602983610db7565b9150610e3082610dc8565b604082019050919050565b60006020820190508181036000830152610e5481610e18565b9050919050565b7f4552433732314d657461646174613a2055524920717565727920666f72206e6f60008201527f6e6578697374656e7420746f6b656e0000000000000000000000000000000000602082015250565b6000610eb7602f83610db7565b9150610ec282610e5b565b604082019050919050565b60006020820190508181036000830152610ee681610eaa565b9050919050565b7f4552433732313a207472616e736665722066726f6d20696e636f72726563742060008201527f6f776e6572000000000000000000000000000000000000000000000000000000602082015250565b6000610f49602583610db7565b9150610f5482610eed565b604082019050919050565b60006020820190508181036000830152610f7881610f3c565b9050919050565b7f4552433732313a20617070726f76652063616c6c6572206973206e6f74206f7760008201527f6e6572206e6f7220617070726f76656420666f7220616c6c0000000000000000602082015250565b6000610fdb603883610db7565b9150610fe682610f7f565b604082019050919050565b6000602082019050818103600083015261100a81610fce565b9050919050565b7f4552433732313a206d696e7420746f20746865207a65726f2061646472657373600082015250565b6000611047602083610db7565b915061105282611011565b602082019050919050565b600060208201905081810360008301526110768161103a565b9050919050565b7f4552433732313a20746f6b656e20616c7265616479206d696e74656400000000600082015250565b60006110b3601c83610db7565b91506110be8261107d565b602082019050919050565b600060208201905081810360008301526110e2816110a6565b9050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b600061112382610b93565b915061112e83610b93565b925082820190508082111561114657611145611122565b5b92915050565b50565b6111588161115f565b82525050565b600060208201905061117360008301846110ef565b92915050565b600081905092915050565b60008190508160005260206000209050919050565b600081546111a681610d44565b6111b08186611179565b945060018216600081146111cb57600181146111e057611213565b60ff1983168652811515820286019350611213565b6111e985611184565b60005b8381101561120b578154818901526001820191506020810190506111ec565b838801955050505b50505092915050565b600061122782611179565b9150819050919050565b600061123c82611199565b915061124882846111bd565b91508190509291505056fea2646970667358221220e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85564736f6c63430008110033";
    }

    async printHeader() {
        console.log('\n⚡ MINTING REAL NFTs ON SEPOLIA...\n');
        console.log('🎨 REAL SEPOLIA NFT MINTING');
        console.log('===========================');
        console.log('📋 Creating real ERC721 NFTs for our 3 test wallets');
        console.log('🔗 Each wallet will receive a unique NFT with metadata\n');
    }

    async checkBalances() {
        console.log('💰 Checking wallet balances...');
        for (const [name, wallet] of Object.entries(this.wallets)) {
            const balance = await this.provider.getBalance(wallet.address);
            const ethBalance = ethers.formatEther(balance);
            console.log(`   ${name.charAt(0).toUpperCase() + name.slice(1)}: ${ethBalance} ETH`);
        }
        console.log('');
    }

    async deployNFTContract() {
        console.log('📋 STEP 1: DEPLOY ERC721 CONTRACT');
        console.log('=================================\n');

        console.log('🚀 Deploying SWAPS Test NFT contract to Sepolia...');

        // Use Alice's wallet to deploy the contract
        const deployer = this.wallets.alice;
        
        // Create contract factory
        const contractFactory = new ethers.ContractFactory(
            this.nftContractABI,
            this.nftContractBytecode,
            deployer
        );

        try {
            // Deploy contract
            const contract = await contractFactory.deploy("SWAPS Test NFT", "SWAP");
            
            console.log('⏳ Waiting for deployment confirmation...');
            await contract.waitForDeployment();
            
            const contractAddress = await contract.getAddress();
            console.log(`✅ Contract deployed!`);
            console.log(`   Address: ${contractAddress}`);
            console.log(`   Deployer: ${deployer.address}`);
            console.log(`   Explorer: https://sepolia.etherscan.io/address/${contractAddress}\n`);

            return contract;
        } catch (error) {
            console.error('❌ Contract deployment failed:', error.message);
            throw error;
        }
    }

    async mintNFTs(contract) {
        console.log('📋 STEP 2: MINT UNIQUE NFTs');
        console.log('============================\n');

        const contractAddress = await contract.getAddress();
        const nftData = [];

        const nftDetails = [
            {
                name: 'alice',
                wallet: this.wallets.alice,
                tokenId: 1,
                metadata: {
                    name: "Cosmic Crystal",
                    description: "A rare cosmic crystal with mysterious powers",
                    image: "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400",
                    attributes: [
                        { trait_type: "Rarity", value: "Legendary" },
                        { trait_type: "Element", value: "Cosmic" },
                        { trait_type: "Power Level", value: 95 }
                    ]
                }
            },
            {
                name: 'bob',
                wallet: this.wallets.bob,
                tokenId: 2,
                metadata: {
                    name: "Dragon Sword",
                    description: "An ancient sword forged by dragon fire",
                    image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400",
                    attributes: [
                        { trait_type: "Rarity", value: "Epic" },
                        { trait_type: "Element", value: "Fire" },
                        { trait_type: "Power Level", value: 88 }
                    ]
                }
            },
            {
                name: 'carol',
                wallet: this.wallets.carol,
                tokenId: 3,
                metadata: {
                    name: "Mystic Shield",
                    description: "A protective shield imbued with ancient magic",
                    image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400",
                    attributes: [
                        { trait_type: "Rarity", value: "Rare" },
                        { trait_type: "Element", value: "Magic" },
                        { trait_type: "Power Level", value: 82 }
                    ]
                }
            }
        ];

        for (const nft of nftDetails) {
            console.log(`🎨 Minting "${nft.metadata.name}" for ${nft.name.charAt(0).toUpperCase() + nft.name.slice(1)}...`);
            
            try {
                // Create metadata URI (in production, this would be stored on IPFS)
                const tokenURI = `data:application/json;base64,${Buffer.from(JSON.stringify(nft.metadata)).toString('base64')}`;
                
                // Mint NFT using Alice's wallet (the deployer)
                const tx = await contract.mint(nft.wallet.address, nft.tokenId, tokenURI);
                
                console.log(`   📡 Transaction: ${tx.hash}`);
                console.log(`   ⏳ Waiting for confirmation...`);
                
                await tx.wait();
                
                console.log(`   ✅ Minted! Token ID: ${nft.tokenId}`);
                console.log(`   👤 Owner: ${nft.wallet.address}`);
                console.log(`   🌐 Explorer: https://sepolia.etherscan.io/tx/${tx.hash}\n`);

                // Store NFT data
                nftData.push({
                    name: nft.name,
                    walletAddress: nft.wallet.address,
                    contractAddress: contractAddress,
                    tokenId: nft.tokenId,
                    metadata: nft.metadata,
                    transactionHash: tx.hash
                });

            } catch (error) {
                console.error(`❌ Failed to mint NFT for ${nft.name}:`, error.message);
                throw error;
            }
        }

        return nftData;
    }

    async verifyOwnership(contract, nftData) {
        console.log('📋 STEP 3: VERIFY NFT OWNERSHIP');
        console.log('===============================\n');

        for (const nft of nftData) {
            try {
                const owner = await contract.ownerOf(nft.tokenId);
                const isCorrectOwner = owner.toLowerCase() === nft.walletAddress.toLowerCase();
                
                console.log(`🎨 Token ID ${nft.tokenId} (${nft.metadata.name})`);
                console.log(`   Owner: ${owner}`);
                console.log(`   Expected: ${nft.walletAddress}`);
                console.log(`   Status: ${isCorrectOwner ? '✅ Correct' : '❌ Mismatch'}\n`);
                
                if (!isCorrectOwner) {
                    throw new Error(`NFT ownership verification failed for token ${nft.tokenId}`);
                }
            } catch (error) {
                console.error(`❌ Verification failed for token ${nft.tokenId}:`, error.message);
                throw error;
            }
        }
    }

    async saveNFTData(contractAddress, nftData) {
        console.log('📋 STEP 4: SAVE NFT DATA');
        console.log('========================\n');

        const savedData = {
            contractAddress: contractAddress,
            deploymentTime: new Date().toISOString(),
            network: "sepolia",
            nfts: nftData
        };

        // Save to JSON file
        fs.writeFileSync('sepolia-real-nfts.json', JSON.stringify(savedData, null, 2));
        
        console.log('💾 NFT data saved to: sepolia-real-nfts.json');
        console.log(`📄 Contract Address: ${contractAddress}`);
        console.log(`🎨 Total NFTs Minted: ${nftData.length}`);
        
        console.log('\n📋 NFT SUMMARY:');
        console.log('================');
        nftData.forEach(nft => {
            console.log(`🎨 ${nft.metadata.name}`);
            console.log(`   Owner: ${nft.name.charAt(0).toUpperCase() + nft.name.slice(1)} (${nft.walletAddress})`);
            console.log(`   Token ID: ${nft.tokenId}`);
            console.log(`   Contract: ${nft.contractAddress}`);
            console.log('');
        });

        return savedData;
    }

    async run() {
        try {
            await this.printHeader();
            await this.checkBalances();
            
            const contract = await this.deployNFTContract();
            const nftData = await this.mintNFTs(contract);
            await this.verifyOwnership(contract, nftData);
            const savedData = await this.saveNFTData(await contract.getAddress(), nftData);
            
            console.log('🎉 REAL NFT MINTING COMPLETED SUCCESSFULLY!');
            console.log('============================================');
            console.log('✅ All NFTs minted and verified on Sepolia');
            console.log('✅ Contract deployed and functional');
            console.log('✅ NFT data saved for trade script');
            console.log('\n🚀 Ready for real NFT trading!\n');
            
            return savedData;
            
        } catch (error) {
            console.error('\n❌ MINTING FAILED:', error.message);
            if (error.reason) console.error('Reason:', error.reason);
            process.exit(1);
        }
    }
}

// Run the minting process
if (require.main === module) {
    const minter = new SepoliaRealNFTMinter();
    minter.run();
}

module.exports = SepoliaRealNFTMinter;