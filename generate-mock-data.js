const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');

// Configuration
const NUM_WALLETS = 1000;
const NUM_NFTS = 10000;
const API_URL = 'http://localhost:3001/api/trades';
const BATCH_SIZE = 100; // Number of requests to send in parallel
const NFT_PER_WALLET = 10; // Average NFTs owned per wallet
const WANTS_PER_WALLET = 15; // Average NFTs wanted per wallet

// Generate a Solana-like address (base58 encoded)
function generateSolanaAddress() {
  const bytes = crypto.randomBytes(32);
  return bs58Encode(bytes);
}

// Simple Base58 encoding (simplified version)
function bs58Encode(bytes) {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return result;
}

// Main function to generate and register mock data
async function generateAndRegisterMockData() {
  console.log('Generating mock wallets and NFTs...');
  
  // Generate mock wallet addresses
  const wallets = Array.from({ length: NUM_WALLETS }, () => generateSolanaAddress().substring(0, 44));
  
  // Generate mock NFT addresses
  const nfts = Array.from({ length: NUM_NFTS }, () => generateSolanaAddress().substring(0, 44));
  
  console.log(`Generated ${wallets.length} mock wallets and ${nfts.length} mock NFTs`);
  
  // Distribute NFTs to wallets (each wallet owns approximately NFT_PER_WALLET NFTs)
  const ownedNFTs = {};
  const nftOwnership = {};
  
  // First, assign each NFT to a random wallet
  nfts.forEach(nft => {
    const walletIndex = Math.floor(Math.random() * NUM_WALLETS);
    const wallet = wallets[walletIndex];
    
    if (!ownedNFTs[wallet]) {
      ownedNFTs[wallet] = [];
    }
    
    ownedNFTs[wallet].push(nft);
    nftOwnership[nft] = wallet;
  });
  
  console.log('Distributed NFTs among wallets');
  
  // Generate "wants" for each wallet (NFTs they don't own)
  const wantedNFTs = {};
  
  wallets.forEach(wallet => {
    wantedNFTs[wallet] = [];
    
    // Find NFTs that this wallet doesn't own
    const unownedNFTs = nfts.filter(nft => nftOwnership[nft] !== wallet);
    
    // Randomly select WANTS_PER_WALLET NFTs to want
    const wantsCount = Math.min(Math.floor(Math.random() * WANTS_PER_WALLET) + 5, unownedNFTs.length);
    
    // Shuffle unowned NFTs and take the first 'wantsCount'
    const shuffled = unownedNFTs.sort(() => 0.5 - Math.random());
    wantedNFTs[wallet] = shuffled.slice(0, wantsCount);
  });
  
  console.log('Generated wants relationships');
  
  // Save the generated data to a file (for reference)
  const mockData = {
    wallets,
    nfts,
    ownedNFTs,
    wantedNFTs
  };
  
  fs.writeFileSync('mock-data.json', JSON.stringify(mockData, null, 2));
  console.log('Saved mock data to mock-data.json');
  
  // Register NFTs with the system
  console.log('Registering owned NFTs with the system...');
  
  const ownershipRequests = [];
  
  for (const [wallet, nftList] of Object.entries(ownedNFTs)) {
    if (nftList.length > 0) {
      // Register NFTs in batches
      for (let i = 0; i < nftList.length; i += BATCH_SIZE) {
        const batch = nftList.slice(i, i + BATCH_SIZE);
        
        ownershipRequests.push(
          axios.post(`${API_URL}/register-nfts`, {
            wallet,
            nfts: batch
          }).catch(error => {
            console.error(`Error registering NFTs for wallet ${wallet}:`, error.message);
            return null;
          })
        );
      }
    }
  }
  
  // Wait for all ownership requests to complete
  await Promise.all(ownershipRequests);
  console.log('Registered all owned NFTs');
  
  // Register wants
  console.log('Registering wanted NFTs...');
  
  const wantRequests = [];
  
  for (const [wallet, nftList] of Object.entries(wantedNFTs)) {
    if (nftList.length > 0) {
      // Register wants in batches
      for (let i = 0; i < nftList.length; i += BATCH_SIZE) {
        const batch = nftList.slice(i, i + BATCH_SIZE);
        
        wantRequests.push(
          axios.post(`${API_URL}/wants/${wallet}`, {
            wallet,
            nfts: batch
          }).catch(error => {
            console.error(`Error registering wants for wallet ${wallet}:`, error.message);
            return null;
          })
        );
      }
    }
  }
  
  // Wait for all want requests to complete
  await Promise.all(wantRequests);
  console.log('Registered all wanted NFTs');
  
  // Generate some connected components to ensure trade loops
  console.log('Creating some guaranteed trade loops...');
  
  // Create 5 groups of 3 wallets each that form a trade loop
  for (let i = 0; i < 5; i++) {
    const loopWallets = wallets.slice(i * 3, (i + 1) * 3);
    
    if (loopWallets.length === 3) {
      const [wallet1, wallet2, wallet3] = loopWallets;
      
      // Find NFTs owned by each wallet
      const nft1 = ownedNFTs[wallet1][0];
      const nft2 = ownedNFTs[wallet2][0];
      const nft3 = ownedNFTs[wallet3][0];
      
      // Create a trade loop: wallet1 -> wallet2 -> wallet3 -> wallet1
      console.log(`Creating trade loop: ${wallet1.substring(0, 8)}... -> ${wallet2.substring(0, 8)}... -> ${wallet3.substring(0, 8)}...`);
      
      // wallet2 wants nft1 from wallet1
      await axios.post(`${API_URL}/wants/${wallet2}`, {
        wallet: wallet2,
        nfts: [nft1]
      }).catch(console.error);
      
      // wallet3 wants nft2 from wallet2
      await axios.post(`${API_URL}/wants/${wallet3}`, {
        wallet: wallet3,
        nfts: [nft2]
      }).catch(console.error);
      
      // wallet1 wants nft3 from wallet3
      await axios.post(`${API_URL}/wants/${wallet1}`, {
        wallet: wallet1,
        nfts: [nft3]
      }).catch(console.error);
    }
  }
  
  console.log('Data generation and registration complete!');
  console.log('To find trades, use the Trade Discovery API endpoint.');
}

// Check if axios is installed
try {
  require.resolve('axios');
  
  // Run the main function
  generateAndRegisterMockData().catch(error => {
    console.error('Error generating mock data:', error);
  });
} catch (e) {
  console.error('axios is required. Please install it with: npm install axios');
  process.exit(1);
} 