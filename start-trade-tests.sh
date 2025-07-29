#!/bin/bash

# Start Trade Algorithm Test Suite
# This script can run tests either in isolated mode or connected to the backend

# Parse command line options
MODE="isolated"  # Default to isolated mode
API_URL="http://localhost:3001"
START_BACKEND=false

# Process command line arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --mode=*) MODE="${1#*=}" ;;
    --api=*) API_URL="${1#*=}" ;;
    --start-backend) START_BACKEND=true ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  --mode=isolated|backend   Test mode (default: isolated)"
      echo "  --api=URL                 API URL for backend tests (default: http://localhost:3001)"
      echo "  --start-backend           Start the backend server (only with backend mode)"
      echo "  -h, --help                Show this help message"
      exit 0
      ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# Validate mode
if [[ "$MODE" != "isolated" && "$MODE" != "backend" ]]; then
  echo "Error: Mode must be either 'isolated' or 'backend'"
  exit 1
fi

# Function to stop the backend server
function stop_backend {
  echo "Stopping backend server..."
  kill $BACKEND_PID 2>/dev/null
}

# Set up environment based on mode
if [[ "$MODE" == "isolated" ]]; then
  echo "=== Starting ISOLATED Algorithm Tests ==="
  echo "These tests run completely isolated from any external dependencies"
  echo "No backend or API connection required"
  
  # Set environment variables for isolated testing
  export ISOLATED_TEST=true
  export API_URL=$API_URL
  
  # Run the tests in isolated mode
  node test-algorithm.js
  
  # Capture exit code
  EXIT_CODE=$?
  
else # backend mode
  echo "=== Starting BACKEND Algorithm Tests ==="
  echo "These tests connect to the backend API at: $API_URL"
  
  # Start backend if requested
  if [[ "$START_BACKEND" == true ]]; then
    echo "Starting backend server..."
    cd backend && HELIUS_API_KEY=demo SWAP_PROGRAM_ID=Swap111111111111111111111111111111111111111 npm run dev &
    BACKEND_PID=$!
    
    # Set up trap to stop the backend when script exits
    trap stop_backend EXIT
    
    # Wait for the backend to start
    echo "Waiting for backend to start..."
    sleep 5
  fi
  
  # Set environment variables for backend testing
  export ISOLATED_TEST=false
  export API_URL=$API_URL
  
  # Run the tests with backend connection
  node test-algorithm.js
  
  # Capture exit code
  EXIT_CODE=$?
fi

# Print summary
echo "=== Test completed with exit code: $EXIT_CODE ==="
exit $EXIT_CODE 