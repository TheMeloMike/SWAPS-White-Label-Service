#!/bin/bash
# SWAPS fully modernized startup script
# Compatible with Node.js v22

# Store absolute root directory
ROOT_DIR=$(pwd)

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Starting SWAPS Platform (Modernized)${NC}"
echo -e "${GREEN}=========================================${NC}"

# Kill any existing node processes
echo -e "${YELLOW}Killing any existing processes...${NC}"
pkill -f 'node|next' || true
sleep 2

# Create data directories if they don't exist
echo -e "${BLUE}Creating data directories...${NC}"
mkdir -p "${ROOT_DIR}/backend/data"
mkdir -p "${ROOT_DIR}/logs"
mkdir -p "${ROOT_DIR}/frontend" 2>/dev/null || true

# 1. START BACKEND
echo -e "\n${GREEN}Starting Backend...${NC}"
cd "${ROOT_DIR}/backend"

# Launch backend service
echo -e "${BLUE}Launching backend service...${NC}"
HELIUS_API_KEY=b9bab9a3-f168-4cdc-9a82-e3509dbc86e7 \
NODE_ENV=development \
PORT=3001 \
DATA_DIR=./data \
SWAP_PROGRAM_ID=SwapsVeCiPHMUAtzQoFPPQ4cDnbBos39ZZf \
RPC_ENDPOINT=https://api.mainnet-beta.solana.com \
TRADE_SCORE_VERBOSE=true \
npx ts-node --transpile-only src/index.ts > "${ROOT_DIR}/logs/backend.log" 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}Backend started with PID: ${BACKEND_PID}${NC}"

# Wait for backend to initialize
echo -e "${YELLOW}Waiting for backend to initialize (10 seconds)...${NC}"
sleep 10

# Check if the backend process is still running
if ! ps -p $BACKEND_PID > /dev/null; then
  echo -e "${RED}ERROR: Backend process has terminated. Check logs/backend.log for details${NC}"
  cat "${ROOT_DIR}/logs/backend.log"
  exit 1
fi

echo -e "${GREEN}Backend running successfully on http://localhost:3001${NC}"

# 2. START FRONTEND
echo -e "\n${GREEN}Starting Frontend...${NC}"

# Check if the frontend exists
if [ ! -d "${ROOT_DIR}/frontend" ] || [ ! -f "${ROOT_DIR}/frontend/package.json" ]; then
  echo -e "${RED}ERROR: Frontend not found. Please ensure the frontend directory exists.${NC}"
  exit 1
fi

# Start the frontend
cd "${ROOT_DIR}/frontend"

# Launch frontend
echo -e "${BLUE}Launching frontend...${NC}"

# Clear Next.js cache to ensure path alias changes are picked up
echo -e "${YELLOW}Clearing Next.js cache...${NC}"
rm -rf .next
rm -rf .next-*

# Start with clean Next.js build
npm run dev > "${ROOT_DIR}/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo -e "${YELLOW}Waiting for frontend to start (10 seconds)...${NC}"
sleep 10

# Check if frontend started successfully
if ! ps -p $FRONTEND_PID > /dev/null; then
  echo -e "${RED}ERROR: Frontend failed to start.${NC}"
  echo -e "${YELLOW}Checking logs for errors...${NC}"
  cat "${ROOT_DIR}/logs/frontend.log"
  exit 1
fi

echo -e "${GREEN}Frontend started with PID: ${FRONTEND_PID}${NC}"
cd "${ROOT_DIR}"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}🚀 SWAPS platform started successfully! 🚀${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Backend URL: ${BLUE}http://localhost:3001${NC}"
echo -e "Frontend URL: ${BLUE}http://localhost:3000${NC}"
echo -e "Backend logs: ${BLUE}logs/backend.log${NC}"
echo -e "Frontend logs: ${BLUE}logs/frontend.log${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop the platform${NC}"

# Keep the script running as long as the processes are active
while ps -p $BACKEND_PID > /dev/null && ps -p $FRONTEND_PID > /dev/null; do
  sleep 5
done

echo -e "${RED}One of the SWAPS services has terminated. Exiting script.${NC}" 