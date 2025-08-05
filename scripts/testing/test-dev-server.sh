#!/bin/bash

echo "🧪 Testing SWAPS White Label API in Development Mode..."

# Navigate to backend directory
cd backend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚙️ Setting up environment variables..."
    cp .env.example .env
    echo "🔧 Please edit backend/.env with your API keys"
fi

echo "🚀 Starting development server..."
echo "📊 Access your API at: http://localhost:3000"
echo "🏥 Health check: http://localhost:3000/api/v1/health"
echo "📚 Press Ctrl+C to stop the server"
echo ""

# Start in development mode with live reloading
npm run dev 