#!/bin/bash
# Complete script to start SWAPS with all necessary fixes

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting SWAPS platform${NC}"

# Kill any existing node processes
echo -e "Killing any existing processes..."
pkill -f 'node|next' || true
sleep 2

# Create data directory if it doesn't exist
mkdir -p backend/data

# Fix the GraphPartitioningService import (if not already fixed)
echo -e "${YELLOW}Applying GraphPartitioningService fix...${NC}"
if grep -q "import { Graph" backend/src/services/trade/GraphPartitioningService.ts; then
  # Replace the import statement if it still has the old format
  sed -i '' '1s/import { Graph/import Graph/' backend/src/services/trade/GraphPartitioningService.ts
  echo -e "${GREEN}Fixed GraphPartitioningService import${NC}"
else
  echo -e "${GREEN}GraphPartitioningService import already fixed${NC}"
fi

# Start the backend with environment variables
echo -e "${GREEN}Starting backend...${NC}"
cd backend
HELIUS_API_KEY=b9bab9a3-f168-4cdc-9a82-e3509dbc86e7 \
SWAP_PROGRAM_ID=Swap111111111111111111111111111111111111111 \
ENABLE_PERSISTENCE=true \
DATA_DIR=./data \
NODE_ENV=development \
npx ts-node src/index.ts > ../backend.log 2>&1 &

BACKEND_PID=$!
echo -e "Backend started with PID: ${BACKEND_PID}"
cd ..

# Wait for backend to initialize
echo -e "Waiting for backend to initialize..."
sleep 5

# Fix frontend React and Next.js versions and start
echo -e "${GREEN}Setting up frontend...${NC}"
cd frontend

# Back up original package.json
echo -e "${YELLOW}Backing up original package.json...${NC}"
cp package.json package.json.original

# Create a new package.json with compatible versions
echo -e "${YELLOW}Creating compatible package.json...${NC}"
cat > package.json << EOF
{
  "name": "frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@metaplex-foundation/js": "^0.19.4",
    "@solana/wallet-adapter-base": "^0.9.24",
    "@solana/wallet-adapter-react": "^0.15.36",
    "@solana/wallet-adapter-react-ui": "^0.9.36",
    "@solana/wallet-adapter-wallets": "^0.19.33",
    "@solana/web3.js": "^1.98.0",
    "@solana/spl-token": "^0.4.0",
    "next": "13.4.19",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "styled-components": "^6.1.1"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "eslint": "^8.45.0",
    "eslint-config-next": "13.4.19",
    "typescript": "^5"
  }
}
EOF

# Clean up node_modules and reinstall
echo -e "${YELLOW}Cleaning up node_modules and .next directories...${NC}"
rm -rf node_modules
rm -rf .next
rm -f package-lock.json

# Reinstall dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install

# Start the frontend
echo -e "${GREEN}Starting frontend...${NC}"
NODE_OPTIONS="--openssl-legacy-provider" npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "Frontend started with PID: ${FRONTEND_PID}"
cd ..

echo -e "${GREEN}SWAPS platform started!${NC}"
echo -e "Backend URL: http://localhost:3001"
echo -e "Frontend URL: http://localhost:3000"
echo -e "Backend logs: backend.log"
echo -e "Frontend logs: frontend.log"
echo -e "${GREEN}To stop all services:${NC} pkill -f 'node|next'"

# Show logs side by side if tmux is available
if command -v tmux &> /dev/null; then
  echo -e "${GREEN}Opening logs in tmux...${NC}"
  tmux new-session -d -s swaps "tail -f backend.log"
  tmux split-window -h "tail -f frontend.log"
  tmux attach-session -t swaps
else
  # Otherwise, show both logs with visual separation
  echo -e "${GREEN}Tailing both logs (CTRL+C to exit):${NC}"
  (echo -e "${YELLOW}=== Backend Log ====${NC}"; tail -f backend.log) & 
  (sleep 2; echo -e "${YELLOW}=== Frontend Log ====${NC}"; tail -f frontend.log)
fi 