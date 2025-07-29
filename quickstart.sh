#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print header
echo -e "${CYAN}====================================================${NC}"
echo -e "${CYAN}       SWAPS - One-Step Project Launcher             ${NC}"
echo -e "${CYAN}====================================================${NC}"
echo ""

# Get the absolute path to the project directory
PROJECT_DIR=$(pwd)
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
DATA_DIR="$BACKEND_DIR/data"

# Verify key directories exist
echo -e "${CYAN}Verifying project structure...${NC}"
if [ ! -d "$BACKEND_DIR" ] || [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}ERROR: Missing critical directories. Make sure you're in the project root.${NC}"
    exit 1
fi

# Check for required tools
echo -e "${CYAN}Checking for required tools...${NC}"
command -v node >/dev/null 2>&1 || { echo -e "${RED}ERROR: Node.js is required but not installed.${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}ERROR: npm is required but not installed.${NC}"; exit 1; }

NODE_VERSION=$(node -v | cut -d 'v' -f 2)
echo -e "${GREEN}✓ Using Node.js version: $NODE_VERSION${NC}"

# Ensure yarn is installed
if ! command -v yarn &> /dev/null; then
    echo -e "${YELLOW}Yarn not found. Installing yarn globally...${NC}"
    npm install -g yarn
    echo -e "${GREEN}✓ Yarn installed successfully${NC}"
else
    YARN_VERSION=$(yarn --version)
    echo -e "${GREEN}✓ Using Yarn version: $YARN_VERSION${NC}"
fi

# Kill any existing processes
echo -e "${CYAN}Cleaning up existing processes...${NC}"
pkill -f "node|next" >/dev/null 2>&1 || true
sleep 1

# Create data directory if it doesn't exist
if [ ! -d "$DATA_DIR" ]; then
    echo -e "${YELLOW}Creating data directory: $DATA_DIR${NC}"
    mkdir -p "$DATA_DIR"
fi

# Create log directories and files
LOG_DIR="$PROJECT_DIR"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

# Reset log files
> "$BACKEND_LOG" 2>/dev/null || BACKEND_LOG="/tmp/swaps-backend.log"
> "$FRONTEND_LOG" 2>/dev/null || FRONTEND_LOG="/tmp/swaps-frontend.log"

echo -e "${CYAN}Installing project dependencies...${NC}"
# Check if node_modules exists at root level, if not, run install
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
    echo -e "${YELLOW}Installing project dependencies (this may take a minute)...${NC}"
    yarn install
    if [ $? -ne 0 ]; then
        echo -e "${RED}Dependency installation failed. Trying npm...${NC}"
        npm install
        if [ $? -ne 0 ]; then
            echo -e "${RED}ERROR: Failed to install dependencies. Please check your npm configuration.${NC}"
            exit 1
        fi
    fi
    echo -e "${GREEN}✓ Dependencies installed successfully${NC}"
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi

# Ensure environment files exist
if [ ! -f "$FRONTEND_DIR/.env.local" ]; then
    echo -e "${YELLOW}Creating frontend environment file...${NC}"
    cat > "$FRONTEND_DIR/.env.local" << EOL
NEXT_PUBLIC_API_URL=http://localhost:3001
EOL
    echo -e "${GREEN}✓ Created frontend environment file${NC}"
fi

if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo -e "${YELLOW}Creating backend environment file...${NC}"
    cat > "$BACKEND_DIR/.env" << EOL
PORT=3001
HELIUS_API_KEY=b9bab9a3-f168-4cdc-9a82-e3509dbc86e7
SWAP_PROGRAM_ID=Swap111111111111111111111111111111111111111
ENABLE_PERSISTENCE=true
DATA_DIR=./data
LOGGING_LEVEL=info
CORS_ORIGIN=http://localhost:3000
EOL
    echo -e "${GREEN}✓ Created backend environment file${NC}"
fi

echo -e "${CYAN}Launching SWAPS...${NC}"

# Start Backend
echo -e "${YELLOW}Starting backend server on port 3001...${NC}"
cd "$BACKEND_DIR"
NODE_ENV=development npm run dev > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

# Check if backend started successfully
sleep 3
if ! ps -p $BACKEND_PID > /dev/null; then
    echo -e "${RED}ERROR: Failed to start backend server.${NC}"
    echo -e "${RED}Check $BACKEND_LOG for details.${NC}"
    exit 1
fi

# Start Frontend
echo -e "${YELLOW}Starting frontend server on port 3000...${NC}"
cd "$FRONTEND_DIR"
npm run dev > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

# Check if frontend started successfully
sleep 3
if ! ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${RED}ERROR: Failed to start frontend server.${NC}"
    echo -e "${RED}Check $FRONTEND_LOG for details.${NC}"
    # Kill backend since frontend failed
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# Success message
echo ""
echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}  SWAPS is now running!                             ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo ""
echo -e "${CYAN}Frontend:${NC} http://localhost:3000"
echo -e "${CYAN}Backend API:${NC} http://localhost:3001"
echo ""
echo -e "${CYAN}Log files:${NC}"
echo -e "  - Backend: ${BACKEND_LOG}"
echo -e "  - Frontend: ${FRONTEND_LOG}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Function to clean up on exit
function cleanup {
    echo -e "${YELLOW}Stopping services...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    echo -e "${GREEN}Services stopped.${NC}"
    exit 0
}

# Handle Ctrl+C
trap cleanup INT

# Keep the script running and display backend logs
tail -f "$BACKEND_LOG" 