#!/bin/bash

# =====================================================================
# DEPRECATED: This script is deprecated and may not work correctly.
# Please use run-fixed.sh instead, which has proper environment variables
# and directory handling.
# =====================================================================

# Define colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${RED}WARNING: This script is DEPRECATED. Please use run-fixed.sh instead.${NC}"
echo -e "${GREEN}=== Starting SWAPS Development Environment ===${NC}"

# Check if both backend and frontend directories exist
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
  echo -e "${YELLOW}Error: Make sure you're running this script from the root project directory${NC}"
  echo "Current directory: $(pwd)"
  echo "Expected to find both 'backend' and 'frontend' directories"
  exit 1
fi

# Create log directories
mkdir -p logs

# Kill any existing processes
echo -e "${GREEN}Killing any existing processes...${NC}"
pkill -f "node|next" || true

# Sleep to ensure ports are freed
sleep 1

# Start the backend (using .env file)
echo -e "${GREEN}Starting backend server...${NC}"
cd backend && npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Sleep to give the backend time to start
sleep 2

# Start the frontend
echo -e "${GREEN}Starting frontend server...${NC}"
cd frontend && npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait a bit for services to initialize
sleep 2

echo -e "${GREEN}=== SWAPS Environment Started ===${NC}"
echo -e "Backend PID: ${YELLOW}${BACKEND_PID}${NC}"
echo -e "Frontend PID: ${YELLOW}${FRONTEND_PID}${NC}"
echo -e "Frontend URL: ${YELLOW}http://localhost:3000${NC}"
echo -e "Backend API: ${YELLOW}http://localhost:3001${NC}"
echo -e "Logs: ${YELLOW}./logs/backend.log${NC} and ${YELLOW}./logs/frontend.log${NC}"

# Tell the user how to stop the services
echo -e "${GREEN}To stop all services:${NC} pkill -f 'node|next'" 