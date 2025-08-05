#!/bin/bash

set -e

echo "🚀 SWAPS Smart Contract Deployment (Minimal Version)"
echo "=================================================="

# Use the Homebrew Solana if available
export PATH="/opt/homebrew/bin:$PATH"

# Check Solana version
echo "🔧 Solana version:"
solana --version

# Check current config
echo "📡 Current Solana config:"
solana config get

# Check balance
echo "💳 Current balance:"
solana balance

# Build the minimal contract
echo "🔨 Building minimal SWAPS contract..."
CARGO_MANIFEST_PATH=Cargo_minimal.toml cargo build-sbf

# Check if the binary was created
if [ -f "./target/deploy/swaps_contract.so" ]; then
    echo "✅ Smart contract binary created successfully!"
    
    # Get the size
    SIZE=$(ls -lh ./target/deploy/swaps_contract.so | awk '{print $5}')
    echo "📦 Binary size: $SIZE"
    
    # Deploy to devnet
    echo "🚀 Deploying to Solana devnet..."
    DEPLOY_OUTPUT=$(solana program deploy ./target/deploy/swaps_contract.so --output json)
    echo "Raw deploy output: $DEPLOY_OUTPUT"
    
    # Extract program ID
    PROGRAM_ID=$(echo "$DEPLOY_OUTPUT" | jq -r '.programId // empty')
    
    if [ -n "$PROGRAM_ID" ] && [ "$PROGRAM_ID" != "null" ]; then
        echo ""
        echo "🎉 SUCCESS! SWAPS Smart Contract Deployed to Solana Devnet!"
        echo "========================================================="
        echo "🏷️  Program ID: $PROGRAM_ID"
        echo "🌐 Network: Devnet"
        echo "📦 Contract Size: $SIZE"
        echo "⏱️  Deployed At: $(date)"
        echo "💰 Your Wallet: $(solana address)"
        echo "========================================================="
        
        # Save deployment info
        mkdir -p output
        echo "$PROGRAM_ID" > output/program_id.txt
        
        cat > output/deployment_info.json << EOF
{
  "program_id": "$PROGRAM_ID",
  "network": "devnet",
  "deployed_at": "$(date -Iseconds)",
  "contract_name": "SWAPS Multi-Party NFT Trading Contract",
  "deployer_wallet": "$(solana address)",
  "contract_size": "$SIZE"
}
EOF
        
        # Test the deployed contract
        echo ""
        echo "🔍 Testing deployed contract..."
        solana program show "$PROGRAM_ID"
        
        echo ""
        echo "✅ Deployment Complete!"
        echo "📋 Next Steps:"
        echo "   1. Program ID saved to: output/program_id.txt"
        echo "   2. Full deployment info: output/deployment_info.json"
        echo "   3. You can now integrate this contract with your API"
        echo ""
        echo "🔗 View on Solana Explorer:"
        echo "   https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
        
    else
        echo "❌ Deployment failed - could not extract program ID"
        echo "Raw output: $DEPLOY_OUTPUT"
        exit 1
    fi
else
    echo "❌ Build failed - binary not found"
    echo "Expected: ./target/deploy/swaps_contract.so"
    ls -la ./target/deploy/ || echo "Deploy directory doesn't exist"
    exit 1
fi