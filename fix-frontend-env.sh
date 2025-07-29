#!/bin/bash

# Store absolute root directory
ROOT_DIR=$(pwd)

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Fixing SWAPS Environment Variables${NC}"

# Create or update frontend environment file
echo -e "${YELLOW}Updating frontend environment variables...${NC}"
cat > "$ROOT_DIR/frontend_new/.env.local" << EOL
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_HELIUS_API_KEY=b9bab9a3-f168-4cdc-9a82-e3509dbc86e7
NEXT_PUBLIC_SWAP_PROGRAM_ID=SwapsVeCiPHMUAtzQoFPPQ4cDnbBos39ZZf
NEXT_PUBLIC_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
EOL

echo -e "${GREEN}✓ Updated frontend environment variables${NC}"

# Kill existing frontend processes
echo -e "${YELLOW}Stopping existing frontend processes...${NC}"
pkill -f 'next' || true
sleep 2

# Restart frontend
echo -e "${YELLOW}Restarting frontend...${NC}"
cd "$ROOT_DIR/frontend_new"

# Clear Next.js cache to ensure environment changes are picked up
echo -e "${YELLOW}Clearing Next.js cache...${NC}"
rm -rf .next

# Restart frontend
npm run dev > "$ROOT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!

echo -e "${YELLOW}Waiting for frontend to start (5 seconds)...${NC}"
sleep 5

# Check if frontend started successfully
if ! ps -p $FRONTEND_PID > /dev/null; then
  echo -e "${RED}ERROR: Frontend failed to start.${NC}"
  echo -e "${YELLOW}Checking logs for errors...${NC}"
  cat "$ROOT_DIR/logs/frontend.log"
  exit 1
fi

echo -e "${GREEN}✓ Frontend restarted with PID: ${FRONTEND_PID}${NC}"
echo -e "${GREEN}✓ Frontend URL: http://localhost:3000${NC}"
echo -e "${GREEN}✓ Frontend logs: logs/frontend.log${NC}"

echo -e "${BLUE}Environment variables fixed successfully!${NC}"
echo -e "${YELLOW}You should now be able to connect to the Solana blockchain and scan/search NFTs properly.${NC}" 