#!/bin/bash

echo "🚀 Starting SWAPS with absolute paths and explicit environment variables"
echo "============================================================="

# Kill any existing server processes
echo "🔄 Cleaning up existing processes..."
pkill -f "node|next" || true
sleep 1

# Create data directory if it doesn't exist
BACKEND_DIR="$(pwd)/backend"
DATA_DIR="$BACKEND_DIR/data"
echo "📁 Using backend directory: $BACKEND_DIR"
echo "📁 Using data directory: $DATA_DIR"

if [ ! -d "$DATA_DIR" ]; then
    echo "📂 Creating data directory: $DATA_DIR"
    mkdir -p "$DATA_DIR"
fi

# Create log files if they don't exist
LOG_DIR="$(pwd)"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

# Make sure we can write to the log files
touch "$BACKEND_LOG" 2>/dev/null || { 
  echo "⚠️ Cannot create backend log file at $BACKEND_LOG" 
  echo "⚠️ Using fallback: /tmp/swaps-backend.log"
  BACKEND_LOG="/tmp/swaps-backend.log"
  touch "$BACKEND_LOG"
}

touch "$FRONTEND_LOG" 2>/dev/null || {
  echo "⚠️ Cannot create frontend log file at $FRONTEND_LOG"
  echo "⚠️ Using fallback: /tmp/swaps-frontend.log" 
  FRONTEND_LOG="/tmp/swaps-frontend.log" 
  touch "$FRONTEND_LOG"
}

# Clear the log files
> "$BACKEND_LOG"
> "$FRONTEND_LOG"

echo "📃 Log files created at:"
echo "   - Backend: $BACKEND_LOG"
echo "   - Frontend: $FRONTEND_LOG"

# Start backend server first
echo "🚀 Starting backend server on port 3001..."
cd "$BACKEND_DIR"
HELIUS_API_KEY=b9bab9a3-f168-4cdc-9a82-e3509dbc86e7 \
SWAP_PROGRAM_ID=Swap111111111111111111111111111111111111111 \
PORT=3001 \
NODE_ENV=development \
ENABLE_PERSISTENCE=true \
DATA_DIR="$DATA_DIR" \
TRADELOOP_MIN_EFFICIENCY=0.1 \
TRADELOOP_GLOBAL_TIMEOUT_MS=30000 \
ENABLE_VERBOSE_LOGGING=true \
npm run dev > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 3

# Start frontend server
echo "🚀 Starting frontend server on port 3000..."
cd ../frontend
PORT=3000 npm run dev > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

echo ""
echo "✅ Servers started with PIDs:"
echo "   - Backend: $BACKEND_PID"
echo "   - Frontend: $FRONTEND_PID"
echo ""
echo "📊 Logs:"
echo "   - Backend: tail -f $BACKEND_LOG"
echo "   - Frontend: tail -f $FRONTEND_LOG"
echo ""
echo "🔗 Access:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:3001"
echo ""
echo "📋 Press Ctrl+C to stop all servers"

# Function to kill servers on exit
function cleanup {
  echo "🛑 Stopping servers..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  exit 0
}

# Register cleanup on Ctrl+C
trap cleanup INT

# Keep script running and follow backend logs
tail -f "$BACKEND_LOG" 