#!/bin/bash
# Clean script to start SWAPS properly

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting SWAPS with fixed algorithm${NC}"

# Kill any existing node processes
echo -e "Killing any existing processes..."
pkill -f 'node|next' || true
sleep 2

# Create data directory if it doesn't exist
mkdir -p backend/data

# Start the backend with environment variables
echo -e "${GREEN}Starting backend...${NC}"
cd backend
HELIUS_API_KEY=b9bab9a3-f168-4cdc-9a82-e3509dbc86e7 \
SWAP_PROGRAM_ID=Swap111111111111111111111111111111111111111 \
ENABLE_PERSISTENCE=true \
DATA_DIR=./data \
NODE_ENV=development \
npm run dev > ../backend.log 2>&1 &

BACKEND_PID=$!
echo -e "Backend started with PID: ${BACKEND_PID}"
cd ..

# Wait for backend to initialize
sleep 5

# Check if frontend directory exists
if [ -d "frontend" ]; then
  # Start the frontend
  echo -e "${GREEN}Starting frontend...${NC}"
  cd frontend
  npm run dev > ../frontend.log 2>&1 &
  FRONTEND_PID=$!
  echo -e "Frontend started with PID: ${FRONTEND_PID}"
  cd ..
else
  echo -e "${RED}Frontend directory not found, skipping frontend start${NC}"
fi

echo -e "${GREEN}Services started!${NC}"
echo -e "Backend URL: http://localhost:3001"
echo -e "Frontend URL: http://localhost:3000 (if started)"
echo -e "Backend logs: backend.log"
echo -e "Frontend logs: frontend.log"
echo -e "${GREEN}To stop all services:${NC} pkill -f 'node|next'"

# Keep the script running
echo -e "${GREEN}Tailing backend logs:${NC}"
tail -f backend.log 