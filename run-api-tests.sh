#!/bin/bash

# API Tests Runner for Trade Algorithm
# This script installs required dependencies and runs the API tests

# Make sure we're in the right directory
cd "$(dirname "$0")"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
  echo "npm is required but not installed. Please install Node.js and npm first."
  exit 1
fi

# Install required dependencies if not already installed
if [ ! -d "node_modules" ] || [ ! -d "node_modules/axios" ]; then
  echo "Installing required dependencies..."
  npm install axios
fi

# Check if backend server is running
if ! curl -s http://localhost:3001/api/trades/health > /dev/null; then
  echo "Backend server is not running at http://localhost:3001"
  echo "Please start the backend server first with:"
  echo "  cd backend && HELIUS_API_KEY=demo SWAP_PROGRAM_ID=Swap111111111111111111111111111111111111111 npm run dev"
  exit 1
fi

# Run the tests
echo "Running API tests..."
node test-algorithm.js

# Exit with the same exit code as the test script
exit $? 