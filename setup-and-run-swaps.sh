#!/bin/bash

# Abort on any error
set -e

# Get the directory where the script is located to ensure paths are correct
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== SWAPS Full Setup & Run ===${NC}"

# Ensure we are in the project root
cd "$SCRIPT_DIR"
echo -e "${YELLOW}Changed directory to project root: $(pwd)${NC}"

# 1. Install root dependencies
echo -e "${BLUE}Installing root dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Root dependencies installed.${NC}"

# 2. Install backend dependencies
echo -e "${BLUE}Installing backend dependencies...${NC}"
if [ -d "backend" ]; then
  cd backend
  npm install
  cd ..
  echo -e "${GREEN}✓ Backend dependencies installed.${NC}"
else
  echo -e "${RED}Error: 'backend' directory not found. Skipping backend dependencies.${NC}"
fi

# 3. Install frontend_new dependencies
echo -e "${BLUE}Installing new frontend dependencies...${NC}"
if [ -d "frontend_new" ]; then
  cd frontend_new
  npm install
  cd ..
  echo -e "${GREEN}✓ New frontend dependencies installed.${NC}"
else
  echo -e "${RED}Error: 'frontend_new' directory not found. Skipping frontend_new dependencies.${NC}"
fi

# 4. Optional: Clear persisted backend data
echo -e "${YELLOW}Do you want to clear persisted backend data (from backend/data)? This is recommended for a fresh start. (y/N)${NC}"
read -r -p "Clear data? [y/N] " response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]
  then
    if [ -d "backend/data" ]; then
      echo -e "${YELLOW}Removing backend/data directory...${NC}"
      rm -rf "backend/data"
      echo -e "${GREEN}✓ Backend data cleared.${NC}"
    else
      echo -e "${YELLOW}backend/data directory not found, nothing to clear.${NC}"
    fi
else
  echo -e "${YELLOW}Skipping backend data clearing.${NC}"
fi

# 5. Optional: Clear logs
echo -e "${YELLOW}Do you want to clear existing logs (logs/backend.log)? (y/N)${NC}"
read -r -p "Clear logs? [y/N] " response_logs
if [[ "$response_logs" =~ ^([yY][eE][sS]|[yY])$ ]]
  then
    if [ -f "logs/backend.log" ]; then
      echo -e "${YELLOW}Removing logs/backend.log...${NC}"
      rm -f "logs/backend.log"
      echo -e "${GREEN}✓ Logs cleared.${NC}"
    else
      echo -e "${YELLOW}logs/backend.log not found, nothing to clear.${NC}"
    fi
else
  echo -e "${YELLOW}Skipping log clearing.${NC}"
fi


# 6. Execute the main run script
echo -e "${BLUE}All dependencies installed. Starting SWAPS platform...${NC}"
if [ -f "run-swaps-modernized.sh" ]; then
  bash run-swaps-modernized.sh
else
  echo -e "${RED}Error: 'run-swaps-modernized.sh' not found. Cannot start the platform.${NC}"
  exit 1
fi

echo -e "${GREEN}=== SWAPS Setup & Run Script Finished ===${NC}" 