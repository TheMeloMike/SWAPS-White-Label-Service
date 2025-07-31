#!/bin/bash

echo "🚀 Simple SWAPS White Label API Deployment"
echo ""
echo "This script helps you deploy to production platforms easily."
echo ""

# Check if we're in the right directory
if [ ! -f "backend/package.json" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

echo "📦 Deployment Options:"
echo "1. DigitalOcean App Platform (Easiest - No CLI needed)"
echo "2. Heroku (Git push deployment)"
echo "3. Railway (Modern platform)"
echo "4. Manual Docker"
echo ""

read -p "Choose option (1-4): " option

case $option in
    1)
        echo ""
        echo "🌊 DigitalOcean App Platform Deployment:"
        echo "1. Go to: https://cloud.digitalocean.com/apps"
        echo "2. Click 'Create App'"
        echo "3. Connect GitHub repo: TheMeloMike/SWAPS-White-Label-Service"
        echo "4. Set source directory: backend"
        echo "5. Add environment variables:"
        echo "   - NODE_ENV=production"
        echo "   - PORT=3000"
        echo "   - HELIUS_API_KEY=your_key_here"
        echo "6. Click 'Create Resources'"
        echo ""
        echo "✅ That's it! DigitalOcean will handle the build and deployment."
        ;;
    2)
        echo ""
        echo "🚀 Heroku Deployment:"
        echo "Make sure you have Heroku CLI installed:"
        echo "brew install heroku/brew/heroku"
        echo ""
        read -p "Press Enter when ready..."
        
        cd backend
        heroku create swaps-white-label-api-$(date +%s)
        heroku config:set NODE_ENV=production
        heroku config:set PORT=3000
        read -p "Enter your HELIUS_API_KEY: " helius_key
        heroku config:set HELIUS_API_KEY=$helius_key
        
        echo "Creating Procfile..."
        echo "web: npm start" > Procfile
        
        git init
        git add .
        git commit -m "Deploy to Heroku"
        git push heroku main
        
        echo "✅ Deployed to Heroku!"
        heroku open
        ;;
    3)
        echo ""
        echo "🚄 Railway Deployment:"
        echo "1. Install Railway CLI:"
        echo "   curl -fsSL https://railway.app/install.sh | sh"
        echo "2. Run: railway login"
        echo "3. Run: railway init"
        echo "4. Run: railway up"
        echo ""
        echo "Or deploy via GitHub:"
        echo "1. Go to: https://railway.app"
        echo "2. Connect GitHub repo"
        echo "3. Deploy automatically"
        ;;
    4)
        echo ""
        echo "🐳 Docker Deployment:"
        echo "Build and run locally:"
        echo "docker build -t swaps-white-label-api ."
        echo "docker run -p 3000:3000 -e NODE_ENV=production swaps-white-label-api"
        echo ""
        echo "For cloud deployment, push to your preferred container registry."
        ;;
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo ""
echo "🌐 After deployment, test your API:"
echo "curl https://your-app-url.com/api/v1/health"
echo ""
echo "📚 Full documentation: SWAPS_WHITE_LABEL_API_DOCUMENTATION_V2.md" 