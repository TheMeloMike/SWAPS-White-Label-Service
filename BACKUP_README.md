# SWAPS Complete Backup - One-Click Restore & Run

🚀 **This is a complete, self-contained backup of the SWAPS (Solana Wallet Automated P2P Swaps) application.**

## What is SWAPS?

SWAPS is a next-generation engine for decentralized NFT trading that eliminates the need for traditional buy-sell mechanics. Instead of relying on direct sales or auctions, SWAPS uses an advanced algorithm to facilitate multi-party bartering—enabling users to swap NFTs across a network of interconnected wallets through complex trade loops.

## Quick Start (One-Click Setup)

### Prerequisites
- **Node.js 18+** (Download from [nodejs.org](https://nodejs.org/))
- **npm** (comes with Node.js)
- **macOS/Linux/Windows** (with bash support)

### 🎯 One-Click Launch

1. **Extract this backup** to your desired location
2. **Open terminal** in the extracted folder
3. **Run the magic command**:
   ```bash
   ./ONE_CLICK_START_SWAPS.sh
   ```

That's it! The script will:
- ✅ Check system requirements
- ✅ Install all dependencies automatically
- ✅ Build the application
- ✅ Start both backend and frontend servers
- ✅ Open the application in your browser

### 🌐 Access Points

Once running, access SWAPS at:
- **Frontend UI**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## Manual Setup (Alternative)

If you prefer manual control:

### 1. Install Dependencies
```bash
# Root dependencies
npm install

# Backend dependencies
cd backend && npm install && cd ..

# Frontend dependencies  
cd frontend && npm install && cd ..
```

### 2. Start Services
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd frontend && npm run dev
```

## 🏗️ Project Structure

```
SWAPS/
├── ONE_CLICK_START_SWAPS.sh    # 🎯 One-click startup script
├── backend/                     # Node.js/TypeScript backend
│   ├── src/                    # Source code
│   ├── package.json            # Backend dependencies
│   └── tsconfig.json           # TypeScript config
├── frontend/                   # React/Next.js frontend
│   ├── src/                    # React components
│   ├── package.json            # Frontend dependencies
│   └── next.config.js          # Next.js config
├── scripts/                    # Utility scripts
├── data/                       # Application data
├── logs/                       # Runtime logs (created on startup)
└── README.md                   # Original project docs
```

## 🔧 Development Features

- **Multi-party NFT bartering** using graph theory algorithms
- **Trade loop detection** with Johnson's Algorithm
- **Strongly Connected Components** analysis
- **Real-time trade scoring** with 18-metric fairness system
- **Solana blockchain integration**
- **Modern React UI** with wallet connectivity

## 📝 Logs & Debugging

Logs are automatically created in the `logs/` directory:
- `logs/backend.log` - Backend server logs
- `logs/frontend.log` - Frontend development server logs

## 🛑 Stopping SWAPS

To stop all services:
- Press `Ctrl+C` in the terminal running the one-click script
- Or manually kill the processes listed in `backend.pid` and `frontend.pid`

## 🔄 Updates & Maintenance

This backup includes:
- ✅ Complete source code
- ✅ All configuration files
- ✅ Environment variables
- ✅ Package.json with exact versions
- ✅ TypeScript configurations
- ✅ Build scripts and tools

## 🆘 Troubleshooting

### Common Issues:

1. **Port already in use**
   ```bash
   # Kill processes on ports 3000 and 3001
   lsof -ti:3000 | xargs kill -9
   lsof -ti:3001 | xargs kill -9
   ```

2. **Node.js version issues**
   ```bash
   # Check version (needs 18+)
   node --version
   ```

3. **Permission denied on script**
   ```bash
   chmod +x ONE_CLICK_START_SWAPS.sh
   ```

4. **Dependencies issues**
   ```bash
   # Clear caches and reinstall
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

## 📞 Support

This backup was created to be completely self-contained. If you encounter issues:

1. Check the logs in `logs/` directory
2. Ensure Node.js 18+ is installed
3. Verify all dependencies installed correctly
4. Check that ports 3000 and 3001 are available

## 🎉 Success!

When everything is working, you should see:
- 🟢 Backend server running on http://localhost:3001
- 🟢 Frontend UI accessible at http://localhost:3000
- 🟢 Console output showing "SWAPS is now running!"

**Happy trading with SWAPS! 🔄💎** 