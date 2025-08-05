#!/bin/bash

echo "🚀 Deploying SWAPS White Label API to Railway..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "📦 Installing Railway CLI..."
    
    # Try npm install with sudo
    if sudo npm install -g @railway/cli; then
        echo "✅ Railway CLI installed successfully"
    else
        echo "❌ Failed to install Railway CLI with npm"
        echo "💡 Please install manually:"
        echo "   curl -fsSL https://railway.app/install.sh | sh"
        echo "   Or visit: https://docs.railway.app/quick-start"
        exit 1
    fi
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