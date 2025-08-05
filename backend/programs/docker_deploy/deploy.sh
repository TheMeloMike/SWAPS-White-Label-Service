#!/bin/bash

set -e

echo "🚀 SWAPS Smart Contract Deployment to Solana Devnet"
echo "=================================================="

# Configure Solana for devnet
echo "📡 Configuring Solana CLI for devnet..."
solana config set --url devnet

# Check if keypair exists, if not create one
if [ ! -f /root/.config/solana/id.json ]; then
    echo "🔑 Creating new keypair..."
    solana-keygen new -o /root/.config/solana/id.json --no-bip39-passphrase
fi

# Get some SOL for deployment fees
echo "💰 Requesting SOL airdrop for deployment fees..."
solana airdrop 2 || echo "Airdrop failed, continuing with existing balance..."

# Check balance
echo "💳 Current balance:"
solana balance

# Deploy the smart contract
echo "🔨 Deploying SWAPS smart contract..."
if [ -f "./target/deploy/solana_nft_swap.so" ]; then
    echo "✅ Found compiled smart contract binary"
    PROGRAM_ID=$(solana program deploy ./target/deploy/solana_nft_swap.so --output json | jq -r '.programId')
    
    if [ "$PROGRAM_ID" != "null" ] && [ -n "$PROGRAM_ID" ]; then
        echo "🎉 SUCCESS! SWAPS Smart Contract Deployed!"
        echo "==============================================="
        echo "🏷️  Program ID: $PROGRAM_ID"
        echo "🌐 Network: Devnet"
        echo "💸 Deployment Cost: ~2-3 SOL"
        echo "⏱️  Time: $(date)"
        echo "==============================================="
        
        # Save program ID for future reference
        echo "$PROGRAM_ID" > /app/program_id.txt
        echo "Program ID saved to: /app/program_id.txt"
        
        # Copy to output directory if it exists
        if [ -d "/app/output" ]; then
            echo "$PROGRAM_ID" > /app/output/program_id.txt
            echo "Program ID also saved to: /app/output/program_id.txt"
            
            # Save deployment info
            cat > /app/output/deployment_info.json << EOF
{
  "program_id": "$PROGRAM_ID",
  "network": "devnet",
  "deployed_at": "$(date -Iseconds)",
  "contract_name": "SWAPS Multi-Party NFT Trading Contract"
}
EOF
        fi
        
        # Show program info
        echo "📋 Program Information:"
        solana program show "$PROGRAM_ID"
        
    else
        echo "❌ Deployment failed - Program ID not returned"
        exit 1
    fi
else
    echo "❌ Smart contract binary not found. Build may have failed."
    ls -la ./target/deploy/ || echo "Deploy directory doesn't exist"
    exit 1
fi

echo "✅ Deployment complete!"