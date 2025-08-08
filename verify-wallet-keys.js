const { ethers } = require('ethers');

// Test wallet private keys
const wallets = {
    alice: {
        address: '0x78c9730c9A8A645bD3022771F9509e65DCd3a499',
        privateKey: '0xc0b80b7d8779e2db13fe87b51fbc5a47e1b1bd0e97b7d9b6e9e0b47e92b26dc5'
    },
    bob: {
        address: '0xf65c05a521BAD596686aBf74c299fCa474D2b19b',
        privateKey: '0x89aa3a6cfeed956d41c4c1ae0b7a6ad7ab9a9f3b00a4e5b8976b8a0c9dfdc8b9'
    },
    carol: {
        address: '0xAd6bee0e55f173419897C1a94C354C49094A4f49',
        privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a'
    }
};

console.log('Verifying wallet private keys match addresses...\n');

for (const [name, wallet] of Object.entries(wallets)) {
    const derivedWallet = new ethers.Wallet(wallet.privateKey);
    const derivedAddress = derivedWallet.address;
    
    console.log(`${name.toUpperCase()}:`);
    console.log(`  Expected: ${wallet.address}`);
    console.log(`  Derived:  ${derivedAddress}`);
    console.log(`  Match:    ${derivedAddress.toLowerCase() === wallet.address.toLowerCase() ? '✅' : '❌'}\n`);
}