#!/bin/bash

# SWAPS Initialization Script

echo "Setting up SWAPS Solana NFT Trading Platform..."

# Create necessary directories
mkdir -p backend/data frontend/public

# Install dependencies
echo "Installing dependencies..."
yarn install

# Set up backend
echo "Setting up backend..."
cd backend
mkdir -p dist
cp .env.example .env 2>/dev/null || cp .env .env.backup 2>/dev/null

# Set up frontend
echo "Setting up frontend..."
cd ../frontend
cp .env.example .env.local 2>/dev/null || cp .env.local .env.local.backup 2>/dev/null

# Return to root directory
cd ..

echo "Setup complete!"
echo "Next steps:"
echo "1. Edit backend/.env to add your Helius API key"
echo "2. Start the development server with: yarn dev"
echo "3. Visit http://localhost:3000 in your browser" 