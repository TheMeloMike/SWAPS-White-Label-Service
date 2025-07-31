const fs = require('fs');
const path = require('path');

// Load the data files
const wallets = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/wallets.json'), 'utf8'));
const nftOwnership = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/nftOwnership.json'), 'utf8'));
const wantedNfts = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/wantedNfts.json'), 'utf8'));

console.log('=== Data Synchronization Test ===\n');

// Check consistency between wallets and wantedNfts
console.log('Checking wallet.wantedNfts vs wantedNfts map consistency:\n');

let issues = 0;

// For each wallet, check if their wantedNfts are reflected in the wantedNfts map
for (const [walletAddress, walletState] of Object.entries(wallets)) {
  console.log(`Wallet ${walletAddress.substring(0, 8)}...:`);
  
  for (const wantedNft of walletState.wantedNfts || []) {
    const wanters = wantedNfts[wantedNft];
    
    if (!wanters) {
      console.log(`  ✗ NFT ${wantedNft} wanted by wallet but not in wantedNfts map`);
      issues++;
    } else if (!wanters.includes(walletAddress)) {
      console.log(`  ✗ NFT ${wantedNft} - wallet not in wanters list`);
      console.log(`    Wanters: ${wanters.map(w => w.substring(0, 8) + '...').join(', ')}`);
      issues++;
    } else {
      console.log(`  ✓ NFT ${wantedNft} - correctly mapped`);
    }
  }
}

// Check the reverse - wantedNfts map entries should match wallet states
console.log('\nChecking wantedNfts map vs wallet.wantedNfts consistency:\n');

for (const [nftAddress, wanters] of Object.entries(wantedNfts)) {
  console.log(`NFT ${nftAddress.substring(0, 8)}...:`);
  
  for (const wanterAddress of wanters) {
    const wallet = wallets[wanterAddress];
    
    if (!wallet) {
      console.log(`  ✗ Wanter ${wanterAddress.substring(0, 8)}... not found in wallets`);
      issues++;
    } else if (!wallet.wantedNfts || !wallet.wantedNfts.includes(nftAddress)) {
      console.log(`  ✗ Wanter ${wanterAddress.substring(0, 8)}... doesn't have NFT in wantedNfts`);
      issues++;
    } else {
      console.log(`  ✓ Wanter ${wanterAddress.substring(0, 8)}... correctly wants this NFT`);
    }
  }
}

console.log(`\n${issues === 0 ? '✓ Data is consistent!' : `✗ Found ${issues} consistency issues`}`);

// Rebuild wantedNfts from wallet states (what DataSyncService does)
console.log('\n=== Rebuilding wantedNfts from wallet states ===\n');

const rebuiltWantedNfts = {};

for (const [walletAddress, walletState] of Object.entries(wallets)) {
  for (const nftAddress of walletState.wantedNfts || []) {
    if (!rebuiltWantedNfts[nftAddress]) {
      rebuiltWantedNfts[nftAddress] = [];
    }
    rebuiltWantedNfts[nftAddress].push(walletAddress);
  }
}

console.log('Rebuilt wantedNfts:');
for (const [nft, wanters] of Object.entries(rebuiltWantedNfts)) {
  console.log(`  ${nft.substring(0, 8)}... wanted by: ${wanters.map(w => w.substring(0, 8) + '...').join(', ')}`);
}

console.log('\nComparing with original wantedNfts:');
const originalKeys = Object.keys(wantedNfts).sort();
const rebuiltKeys = Object.keys(rebuiltWantedNfts).sort();

if (JSON.stringify(originalKeys) === JSON.stringify(rebuiltKeys)) {
  console.log('✓ Same NFT keys in both');
} else {
  console.log('✗ Different NFT keys!');
  console.log(`  Original: ${originalKeys.join(', ')}`);
  console.log(`  Rebuilt: ${rebuiltKeys.join(', ')}`);
} 