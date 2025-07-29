#!/bin/bash
# Frontend-only script for SWAPS

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting SWAPS frontend only${NC}"

cd frontend

# Remove node_modules and reinstall dependencies
echo -e "${GREEN}Cleaning and reinstalling dependencies...${NC}"
rm -rf node_modules
rm -rf .next
npm install 

# Install specific version of next.js to ensure compatibility
echo -e "${GREEN}Installing specific Next.js version...${NC}"
npm install next@13.5.6 --save

# Start the frontend 
echo -e "${GREEN}Starting frontend...${NC}"
npm run dev > ../frontend.log 2>&1 &

FRONTEND_PID=$!
echo -e "Frontend started with PID: ${FRONTEND_PID}"
cd ..

echo -e "${GREEN}Frontend started!${NC}"
echo -e "Frontend URL: http://localhost:3000"
echo -e "Frontend logs: frontend.log"
echo -e "${GREEN}To stop:${NC} pkill -f 'node|next'"

# Keep the script running
echo -e "${GREEN}Tailing frontend logs:${NC}"
tail -f frontend.log 