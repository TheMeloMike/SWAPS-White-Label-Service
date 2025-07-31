#!/bin/bash

echo "🚀 Deploying SWAPS White Label API to Railway..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "📦 Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Navigate to backend directory
cd backend

# Set up environment variables for production
echo "⚙️ Setting up environment variables..."
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set LOG_LEVEL=info
railway variables set ENABLE_PERSISTENCE=true
railway variables set DATA_DIR=./data

# Deploy the application
echo "🚢 Deploying to Railway..."
railway up

echo "✅ Deployment complete!"
echo "🌐 Your API will be available at: https://[your-app-name].railway.app"
echo "📚 API Documentation: https://[your-app-name].railway.app/api/v1/health" 