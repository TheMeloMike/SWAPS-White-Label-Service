# 🚀 Quick Deploy Guide - SWAPS White Label API

## Option 1: Railway (Recommended)

### Step 1: Install Railway CLI Manually
```bash
# Install Railway CLI
curl -fsSL https://railway.app/install.sh | sh

# Or via npm with sudo
sudo npm install -g @railway/cli
```

### Step 2: Deploy
```bash
cd backend
railway login
railway init
railway up
```

## Option 2: Heroku

### Step 1: Install Heroku CLI
```bash
# macOS
brew install heroku/brew/heroku

# Or download from: https://devcenter.heroku.com/articles/heroku-cli
```

### Step 2: Deploy
```bash
cd backend
heroku create swaps-white-label-api
heroku config:set NODE_ENV=production
heroku config:set HELIUS_API_KEY=your_key_here
git push heroku main
```

## Option 3: DigitalOcean App Platform

1. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Click "Create App"
3. Connect your GitHub repository: `TheMeloMike/SWAPS-White-Label-Service`
4. Set source directory to: `backend`
5. Configure environment variables:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `HELIUS_API_KEY=your_key_here`
6. Click "Create Resources"

## Option 4: Manual Docker Deployment

### Any Cloud Platform with Docker Support
```bash
# Build Docker image
docker build -t swaps-white-label-api .

# Run locally to test
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e HELIUS_API_KEY=your_key_here \
  swaps-white-label-api

# Deploy to your cloud platform
```

## Option 5: Direct Node.js Deployment

### On Any VPS/Server
```bash
# Install dependencies
cd backend
npm install

# Set environment variables
export NODE_ENV=production
export PORT=3000
export HELIUS_API_KEY=your_key_here

# Start the server
npm start
```

## 🌐 Access Your API

Once deployed, your API will be available at:
- **Health Check**: `GET /api/v1/health`
- **API Documentation**: See `SWAPS_WHITE_LABEL_API_DOCUMENTATION_V2.md`

## 🔧 Environment Variables

Required for production:
```bash
NODE_ENV=production
PORT=3000
HELIUS_API_KEY=your_helius_api_key
WEBHOOK_SECRET=your_webhook_secret
ENABLE_PERSISTENCE=true
DATA_DIR=./data
```

## 🧪 Test Your Deployment

```bash
# Health check
curl https://your-app-url.com/api/v1/health

# Should return:
# {"status":"healthy","uptime":"...","version":"1.0.0"}
```

## 📞 Need Help?

- **Railway Issues**: [Railway Discord](https://discord.gg/railway)
- **Heroku Issues**: [Heroku Support](https://help.heroku.com/)
- **API Questions**: Check `SWAPS_WHITE_LABEL_API_DOCUMENTATION_V2.md` 