const fs = require('fs');
const path = require('path');

// Load the data files
const wallets = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/wallets.json'), 'utf8'));
const nftOwnership = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/nftOwnership.json'), 'utf8'));
const wantedNfts = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/wantedNfts.json'), 'utf8'));

console.log('=== Trade Loop Validation ===\n');

// Our test wallets
const testWallets = [
  '5pPCbuGso6NguFBWAqaKm7FW9msRoLQQoWu7kawGfFna',
  'NHLeTzVE1BriRr3Uuebyq1aKEjRvWFMozy2BDAuLN2m',
  '52sLrTRsiVrVyxSL8r1rpbJmjtcbQER9QgeiykViUgC8'
];

console.log('Wallet States:');
testWallets.forEach(wallet => {
  const state = wallets[wallet];
  if (state) {
    console.log(`\nWallet ${wallet.substring(0, 8)}...`);
    console.log(`  Owns: ${state.ownedNfts.join(', ')}`);
    console.log(`  Wants: ${state.wantedNfts.join(', ')}`);
  }
});

console.log('\n\nNFT Ownership:');
Object.entries(nftOwnership).forEach(([nft, owner]) => {
  console.log(`  NFT ${nft.substring(0, 8)}... owned by ${owner.substring(0, 8)}...`);
});

console.log('\n\nWanted NFTs:');
Object.entries(wantedNfts).forEach(([nft, wanters]) => {
  console.log(`  NFT ${nft.substring(0, 8)}... wanted by: ${wanters.map(w => w.substring(0, 8) + '...').join(', ')}`);
});

// Check if trade loop exists
console.log('\n\n=== Trade Loop Analysis ===\n');

// Check each step of the potential loop
const steps = [
  { from: '5pPCbuGso6NguFBWAqaKm7FW9msRoLQQoWu7kawGfFna', to: 'NHLeTzVE1BriRr3Uuebyq1aKEjRvWFMozy2BDAuLN2m' },
  { from: 'NHLeTzVE1BriRr3Uuebyq1aKEjRvWFMozy2BDAuLN2m', to: '52sLrTRsiVrVyxSL8r1rpbJmjtcbQER9QgeiykViUgC8' },
  { from: '52sLrTRsiVrVyxSL8r1rpbJmjtcbQER9QgeiykViUgC8', to: '5pPCbuGso6NguFBWAqaKm7FW9msRoLQQoWu7kawGfFna' }
];

let isValidLoop = true;

steps.forEach((step, i) => {
  const fromWallet = wallets[step.from];
  const toWallet = wallets[step.to];
  
  console.log(`Step ${i + 1}: ${step.from.substring(0, 8)}... → ${step.to.substring(0, 8)}...`);
  
  // Find NFTs that 'from' owns that 'to' wants
  const possibleNfts = fromWallet.ownedNfts.filter(nft => toWallet.wantedNfts.includes(nft));
  
  if (possibleNfts.length > 0) {
    console.log(`  ✓ Can trade: ${possibleNfts.join(', ')}`);
    
    // Verify ownership
    possibleNfts.forEach(nft => {
      const owner = nftOwnership[nft];
      if (owner === step.from) {
        console.log(`    ✓ Ownership verified for ${nft.substring(0, 8)}...`);
      } else {
        console.log(`    ✗ Ownership mismatch for ${nft.substring(0, 8)}... (owner: ${owner?.substring(0, 8)}...)`);
        isValidLoop = false;
      }
    });
  } else {
    console.log(`  ✗ No tradeable NFTs found`);
    console.log(`    From owns: ${fromWallet.ownedNfts.join(', ')}`);
    console.log(`    To wants: ${toWallet.wantedNfts.join(', ')}`);
    isValidLoop = false;
  }
});

console.log(`\n${isValidLoop ? '✓ Valid 3-way trade loop exists!' : '✗ No valid trade loop found'}`); 