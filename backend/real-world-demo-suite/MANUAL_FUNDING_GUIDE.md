# 🚨 MANUAL FUNDING REQUIRED

Due to severe rate limiting on Solana devnet today, we need to manually fund these wallets to complete our historic trade.

## 📋 **ADDRESSES TO FUND**

### 💰 **Payer Wallet** (needs 2 SOL):
```
HwQFhX6g1ZoWBr78bQfieoX3FEgUhYoYrmHdgRiUy1ZE
```

### 👥 **Participant Wallets** (need 0.2 SOL each):
```
Alice:  C75CCbZeC4pCCtLJyYuE53VbJrXwxTXquypma54MoaPV
Bob:    EDqTCvsaauRcCC98UNCDdV96ZYT2YfYnqa9RVoVowBPm  
Carol:  D2yMK6bPmAGFWr38NWExrkrLPbz1Z41BYbbTKxjyB294
```

## 🌐 **MANUAL FUNDING OPTIONS**

### Option 1: Web Faucets (Try Multiple)
1. **Solana Official**: https://faucet.solana.com
2. **QuickNode**: https://faucet.quicknode.com/solana/devnet
3. **Alchemy**: https://www.alchemy.com/faucets/solana-devnet
4. **SolFaucet**: https://solfaucet.com
5. **Chainstack**: https://chainstack.com/solana-faucet/

### Option 2: Solana CLI (if available)
```bash
# Fund payer (try this first)
solana airdrop 2 HwQFhX6g1ZoWBr78bQfieoX3FEgUhYoYrmHdgRiUy1ZE --url devnet

# Fund participants
solana airdrop 0.2 C75CCbZeC4pCCtLJyYuE53VbJrXwxTXquypma54MoaPV --url devnet
solana airdrop 0.2 EDqTCvsaauRcCC98UNCDdV96ZYT2YfYnqa9RVoVowBPm --url devnet  
solana airdrop 0.2 D2yMK6bPmAGFWr38NWExrkrLPbz1Z41BYbbTKxjyB294 --url devnet
```

### Option 3: Alternative Networks
Try using different devnet endpoints or wait for rate limits to reset (usually 1-24 hours).

## ✅ **VERIFICATION COMMANDS**

Check if funding worked:
```bash
# Check payer balance
node -e "const {Connection,PublicKey,LAMPORTS_PER_SOL}=require('@solana/web3.js');const c=new Connection('https://api.devnet.solana.com');c.getBalance(new PublicKey('HwQFhX6g1ZoWBr78bQfieoX3FEgUhYoYrmHdgRiUy1ZE')).then(b=>console.log('Payer Balance:',b/LAMPORTS_PER_SOL,'SOL'))"

# Check all balances
node -e "
const {Connection,PublicKey,LAMPORTS_PER_SOL}=require('@solana/web3.js');
const c=new Connection('https://api.devnet.solana.com');
const addrs=['HwQFhX6g1ZoWBr78bQfieoX3FEgUhYoYrmHdgRiUy1ZE','C75CCbZeC4pCCtLJyYuE53VbJrXwxTXquypma54MoaPV','EDqTCvsaauRcCC98UNCDdV96ZYT2YfYnqa9RVoVowBPm','D2yMK6bPmAGFWr38NWExrkrLPbz1Z41BYbbTKxjyB294'];
const names=['Payer','Alice','Bob','Carol'];
Promise.all(addrs.map(a=>c.getBalance(new PublicKey(a)))).then(balances=>{
  balances.forEach((b,i)=>console.log(names[i]+': '+(b/LAMPORTS_PER_SOL)+' SOL'));
  const total=balances.reduce((sum,b)=>sum+b/LAMPORTS_PER_SOL,0);
  console.log('Total:',total,'SOL');
  if(total>=2.6)console.log('✅ READY FOR HISTORIC TRADE!');
  else console.log('❌ Need more funding');
});
"
```

## 🚀 **ONCE FUNDED, RUN:**

```bash
# Create the funded wallet file
node -e "
const {Keypair}=require('@solana/web3.js');
const fs=require('fs');
const wallets={
  payer:[/* Need to recreate keypair from address - this is a limitation */],
  participants:[
    {name:'Alice',secretKey:[],publicKey:'C75CCbZeC4pCCtLJyYuE53VbJrXwxTXquypma54MoaPV'},
    {name:'Bob',secretKey:[],publicKey:'EDqTCvsaauRcCC98UNCDdV96ZYT2YfYnqa9RVoVowBPm'},
    {name:'Carol',secretKey:[],publicKey:'D2yMK6bPmAGFWr38NWExrkrLPbz1Z41BYbbTKxjyB294'}
  ]
};
console.log('⚠️ Manual keypair recreation needed');
"

# Execute historic trade
node funded-historic-trade.js
```

## 💡 **ALTERNATIVE: Wait for Rate Limits**

Rate limits typically reset:
- Every 1-6 hours (per IP)
- Every 24 hours (per address)
- During off-peak hours (late night US time)

Try running again in a few hours:
```bash
node multi-source-funding.js
```

## 🎯 **PRIORITY**

**MINIMUM NEEDED TO PROCEED:**
- Payer: 1.5+ SOL
- At least 2 participants with 0.15+ SOL each

We can make history with even partial funding!