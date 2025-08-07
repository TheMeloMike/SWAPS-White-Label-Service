#!/bin/bash

# SWAPS ETHEREUM TESTNET DEPLOYMENT SETUP SCRIPT
# This script sets up everything needed for testnet deployment

set -e  # Exit on any error

echo "🚀 SWAPS ETHEREUM TESTNET DEPLOYMENT SETUP"
echo "==========================================="
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✅ npm version: $(npm -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📋 Creating .env file from template..."
    cp env.example .env
    echo "✅ .env file created"
    echo "⚠️  Please edit .env file with your configuration before deploying"
else
    echo "✅ .env file already exists"
fi

# Check if .env file has required variables
echo "🔍 Checking environment configuration..."

if grep -q "YOUR_INFURA_PROJECT_ID" .env; then
    echo "⚠️  Please update INFURA_KEY in .env file"
fi

if grep -q "your_testnet_private_key_here" .env; then
    echo "⚠️  Please update TESTNET_PRIVATE_KEY in .env file"
fi

# Create contracts directory if it doesn't exist
if [ ! -d "contracts" ]; then
    mkdir -p contracts
    echo "✅ Created contracts directory"
fi

# Compile contracts to check for issues
echo "🔨 Compiling contracts..."
npx hardhat compile

if [ $? -eq 0 ]; then
    echo "✅ Contracts compiled successfully"
else
    echo "❌ Contract compilation failed"
    exit 1
fi

echo
echo "🎉 SETUP COMPLETE!"
echo "=================="
echo
echo "📋 Next Steps:"
echo "1. Edit .env file with your configuration:"
echo "   - Add your Infura/Alchemy RPC URL"
echo "   - Add your testnet wallet private key"
echo "   - Add API keys for contract verification"
echo
echo "2. Fund your testnet wallet with ETH:"
echo "   - Sepolia: https://sepoliafaucet.com"
echo "   - Goerli: https://goerlifaucet.com"
echo "   - Mumbai: https://faucet.polygon.technology"
echo
echo "3. Deploy to testnet:"
echo "   npm run deploy:sepolia    # Recommended"
echo "   npm run deploy:goerli     # Alternative"
echo "   npm run deploy:mumbai     # Polygon L2"
echo
echo "4. Run tests:"
echo "   npm test                  # Run test suite"
echo "   npm run test:gas          # With gas reporting"
echo
echo "🔗 Useful Commands:"
echo "   npx hardhat accounts              # List accounts"
echo "   npx hardhat balance --account     # Check balance"
echo "   npx hardhat verify --network      # Verify contract"
echo "   npx hardhat console --network     # Interactive console"
echo
echo "📖 For detailed instructions, see DEPLOYMENT_GUIDE.md"
echo
echo "🚀 Ready for testnet deployment!"