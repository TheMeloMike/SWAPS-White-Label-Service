#!/bin/bash

# SWAPS - One-Click Startup Script
# This script will fully set up and launch the SWAPS application

set -e  # Exit on any error

echo "🚀 Starting SWAPS - Solana Wallet Automated P2P Swaps"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | sed 's/v//')
REQUIRED_VERSION="18.0.0"

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm."
    exit 1
fi

print_status "Node.js version: $NODE_VERSION"
print_status "npm version: $(npm -v)"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_status "Working in directory: $SCRIPT_DIR"

# Create logs directory if it doesn't exist
mkdir -p logs

# Function to install dependencies with error handling
install_dependencies() {
    local dir=$1
    local name=$2
    
    print_status "Installing $name dependencies..."
    cd "$SCRIPT_DIR/$dir"
    
    if [ -f "package.json" ]; then
        if [ -f "yarn.lock" ]; then
            if command -v yarn &> /dev/null; then
                yarn install --frozen-lockfile
            else
                print_warning "yarn.lock found but yarn not installed, using npm..."
                npm ci
            fi
        elif [ -f "package-lock.json" ]; then
            npm ci
        else
            npm install
        fi
        print_success "$name dependencies installed"
    else
        print_warning "No package.json found in $dir"
    fi
    
    cd "$SCRIPT_DIR"
}

# Install root dependencies
print_status "Installing root dependencies..."
if [ -f "package.json" ]; then
    npm install
    print_success "Root dependencies installed"
fi

# Install backend dependencies
if [ -d "backend" ]; then
    install_dependencies "backend" "Backend"
fi

# Install frontend dependencies
if [ -d "frontend" ]; then
    install_dependencies "frontend" "Frontend"
fi

# Build backend if TypeScript
if [ -d "backend" ] && [ -f "backend/tsconfig.json" ]; then
    print_status "Building backend..."
    cd backend
    if [ -f "package.json" ] && grep -q "build" package.json; then
        npm run build || print_warning "Backend build failed, will run in development mode"
    fi
    cd "$SCRIPT_DIR"
fi

# Function to start backend
start_backend() {
    print_status "Starting backend server..."
    cd "$SCRIPT_DIR/backend"
    
    # Try different start methods
    if [ -f "package.json" ]; then
        if grep -q "\"start\":" package.json; then
            npm start > ../logs/backend.log 2>&1 &
        elif grep -q "\"dev\":" package.json; then
            npm run dev > ../logs/backend.log 2>&1 &
        elif [ -f "src/index.js" ]; then
            node src/index.js > ../logs/backend.log 2>&1 &
        elif [ -f "src/index.ts" ]; then
            npx ts-node src/index.ts > ../logs/backend.log 2>&1 &
        elif [ -f "dist/index.js" ]; then
            node dist/index.js > ../logs/backend.log 2>&1 &
        else
            print_error "Could not find backend entry point"
            return 1
        fi
    else
        print_error "No package.json found in backend directory"
        return 1
    fi
    
    BACKEND_PID=$!
    echo $BACKEND_PID > backend.pid
    print_success "Backend started (PID: $BACKEND_PID)"
    
    cd "$SCRIPT_DIR"
}

# Function to start frontend
start_frontend() {
    print_status "Starting frontend server..."
    cd "$SCRIPT_DIR/frontend"
    
    if [ -f "package.json" ]; then
        if grep -q "\"dev\":" package.json; then
            npm run dev > ../logs/frontend.log 2>&1 &
        elif grep -q "\"start\":" package.json; then
            npm start > ../logs/frontend.log 2>&1 &
        else
            print_error "No dev or start script found in frontend package.json"
            return 1
        fi
    else
        print_error "No package.json found in frontend directory"
        return 1
    fi
    
    FRONTEND_PID=$!
    echo $FRONTEND_PID > frontend.pid
    print_success "Frontend started (PID: $FRONTEND_PID)"
    
    cd "$SCRIPT_DIR"
}

# Function to wait for services to be ready
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    # Wait for backend (usually port 3001)
    for i in {1..30}; do
        if curl -s http://localhost:3001/health > /dev/null 2>&1 || curl -s http://localhost:3001 > /dev/null 2>&1; then
            print_success "Backend is ready!"
            break
        fi
        sleep 1
    done
    
    # Wait for frontend (usually port 3000)
    for i in {1..30}; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            print_success "Frontend is ready!"
            break
        fi
        sleep 1
    done
}

# Function to cleanup on exit
cleanup() {
    print_status "Cleaning up..."
    if [ -f "backend.pid" ]; then
        kill $(cat backend.pid) 2>/dev/null || true
        rm backend.pid
    fi
    if [ -f "frontend.pid" ]; then
        kill $(cat frontend.pid) 2>/dev/null || true
        rm frontend.pid
    fi
    print_success "Cleanup complete"
}

# Set up signal handlers
trap cleanup EXIT INT TERM

# Start services
if [ -d "backend" ]; then
    start_backend
    sleep 3  # Give backend time to start
fi

if [ -d "frontend" ]; then
    start_frontend
    sleep 3  # Give frontend time to start
fi

# Wait for services to be ready
wait_for_services

echo ""
echo "🎉 SWAPS is now running!"
echo "=================================================="
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:3001"
echo ""
echo "Logs are available in:"
echo "  - Backend: logs/backend.log"
echo "  - Frontend: logs/frontend.log"
echo ""
echo "Press Ctrl+C to stop all services"
echo "=================================================="

# Keep the script running and show log output
tail -f logs/backend.log logs/frontend.log 2>/dev/null || sleep infinity 