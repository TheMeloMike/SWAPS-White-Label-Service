#!/bin/bash

# =====================================================================
# DEPRECATED: This script is deprecated and may not work correctly.
# Please use run-fixed.sh instead, which has proper environment variables
# and directory handling.
# =====================================================================

echo -e "\033[0;31mWARNING: This script is DEPRECATED. Please use run-fixed.sh instead.\033[0m"

# SWAPS App Runner
echo "🚀 Starting SWAPS NFT Trading Platform"
echo "======================================"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing root dependencies..."
    npm install
fi

# Check if backend node_modules exists
if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

# Check if frontend node_modules exists
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Check if .env exists in backend, if not copy from example
if [ ! -f "backend/.env" ]; then
    echo "🔧 Creating backend .env file..."
    cp backend/.env.example backend/.env
    # Update the HELIUS_API_KEY placeholder
    sed -i '' 's/your_helius_api_key_here/b9bab9a3-f168-4cdc-9a82-e3509dbc86e7/g' backend/.env
    
    # Update key configurations
    sed -i '' 's/ENABLE_PERSISTENCE=false/ENABLE_PERSISTENCE=true/g' backend/.env
    sed -i '' 's/TRADELOOP_MIN_EFFICIENCY=0.6/TRADELOOP_MIN_EFFICIENCY=0.1/g' backend/.env
    sed -i '' 's/TRADELOOP_GLOBAL_TIMEOUT_MS=10000/TRADELOOP_GLOBAL_TIMEOUT_MS=30000/g' backend/.env
    echo "✅ Updated configuration for better trade discovery"
fi

# Make sure data directory exists
if [ ! -d "backend/data" ]; then
    echo "📁 Creating data directory for persistence..."
    mkdir -p backend/data
fi

# Use terminal multiplexer to run both services
if [ -x "$(command -v tmux)" ]; then
    # Use tmux if available
    echo "🖥️  Starting servers with tmux..."
    tmux new-session -d -s swaps-frontend "cd frontend && npm run dev"
    tmux new-session -d -s swaps-backend "cd backend && ENABLE_PERSISTENCE=true TRADELOOP_MIN_EFFICIENCY=0.1 TRADELOOP_GLOBAL_TIMEOUT_MS=30000 npm run dev"
    echo "✅ Servers started in tmux sessions:"
    echo "   - View frontend: tmux attach -t swaps-frontend"
    echo "   - View backend: tmux attach -t swaps-backend"
    echo ""
    echo "🌐 Frontend available at: http://localhost:3000"
    echo "🌐 Backend API available at: http://localhost:3001"
elif [ -x "$(command -v screen)" ]; then
    # Use screen as fallback
    echo "🖥️  Starting servers with screen..."
    screen -dmS swaps-frontend bash -c "cd frontend && npm run dev"
    screen -dmS swaps-backend bash -c "cd backend && ENABLE_PERSISTENCE=true TRADELOOP_MIN_EFFICIENCY=0.1 TRADELOOP_GLOBAL_TIMEOUT_MS=30000 npm run dev"
    echo "✅ Servers started in screen sessions:"
    echo "   - View frontend: screen -r swaps-frontend"
    echo "   - View backend: screen -r swaps-backend"
    echo ""
    echo "🌐 Frontend available at: http://localhost:3000"
    echo "🌐 Backend API available at: http://localhost:3001"
else
    # Fallback to background processes
    echo "🖥️  Starting servers in background..."
    cd frontend && npm run dev > ../frontend.log 2>&1 &
    FRONTEND_PID=$!
    cd ../backend && ENABLE_PERSISTENCE=true TRADELOOP_MIN_EFFICIENCY=0.1 TRADELOOP_GLOBAL_TIMEOUT_MS=30000 npm run dev > ../backend.log 2>&1 &
    BACKEND_PID=$!
    cd ..
    
    echo "✅ Servers started in background:"
    echo "   - Frontend PID: $FRONTEND_PID (logs in frontend.log)"
    echo "   - Backend PID: $BACKEND_PID (logs in backend.log)"
    echo ""
    echo "🌐 Frontend available at: http://localhost:3000"
    echo "🌐 Backend API available at: http://localhost:3001"
    echo ""
    echo "⚠️  To stop servers, run: kill $FRONTEND_PID $BACKEND_PID"
    
    # Create a stop script
    echo "#!/bin/bash" > stop-swaps.sh
    echo "kill $FRONTEND_PID $BACKEND_PID" >> stop-swaps.sh
    echo "echo 'Servers stopped'" >> stop-swaps.sh
    chmod +x stop-swaps.sh
    echo "   A stop-swaps.sh script has been created for convenience"
fi

echo ""
echo "Trade Configuration:"
echo "  - Min Efficiency: 0.1 (will find more trades)"
echo "  - Max Search Depth: 10"
echo "  - Timeout: 30000ms"
echo "  - Persistence: Enabled"
echo ""
echo "🔍 The system will now be able to properly discover trade loops!" 