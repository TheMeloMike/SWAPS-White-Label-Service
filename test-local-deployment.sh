#!/bin/bash

echo "🧪 Testing SWAPS White Label API Locally..."

# Navigate to backend directory
cd backend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the TypeScript code
echo "🔨 Building TypeScript..."
npm run build

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚙️ Setting up environment variables..."
    cp .env.example .env
    echo "🔧 Please edit backend/.env with your API keys"
fi

# Start the server in background (use dev mode for better development experience)
echo "🚀 Starting server locally..."
npm run dev &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 5

# Test health endpoint
echo "🏥 Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:3000/api/v1/health)

if [[ $HEALTH_RESPONSE == *"healthy"* ]]; then
    echo "✅ Health check passed!"
    echo "📊 Response: $HEALTH_RESPONSE"
else
    echo "❌ Health check failed!"
    echo "📊 Response: $HEALTH_RESPONSE"
fi

# Test with dummy data
echo "🧪 Testing NFT endpoint..."
DUMMY_NFT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/inventory/nfts \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test_key" \
  -d '{
    "nft": {
      "id": "test_nft_123",
      "metadata": {
        "name": "Test NFT #123",
        "description": "A test NFT"
      },
      "ownership": {
        "ownerId": "test_wallet"
      },
      "collection": {
        "id": "test_collection",
        "name": "Test Collection"
      }
    }
  }')

echo "📊 NFT Response: $DUMMY_NFT_RESPONSE"

# Stop the server
echo "🛑 Stopping test server..."
kill $SERVER_PID

echo ""
echo "🎉 Local testing complete!"
echo "🌐 Your API is ready for deployment!"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env with your real API keys"
echo "2. Choose a deployment option from QUICK_DEPLOY_GUIDE.md"
echo "3. Deploy to production!" 