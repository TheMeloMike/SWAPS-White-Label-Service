#!/bin/bash

# Production Scale Test Runner for SWAPS Algorithm
# This script tests the production algorithm with large datasets

echo "=== SWAPS Production Algorithm Scale Test Runner ==="

# Default configuration
WALLET_COUNT=1000
NFT_COUNT=10000
MEMORY_PROFILE=false

# Process command line arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --wallets=*) WALLET_COUNT="${1#*=}" ;;
    --nfts=*) NFT_COUNT="${1#*=}" ;;
    --small) WALLET_COUNT=100; NFT_COUNT=1000 ;;
    --medium) WALLET_COUNT=1000; NFT_COUNT=10000 ;;
    --large) WALLET_COUNT=5000; NFT_COUNT=50000 ;;
    --memory) MEMORY_PROFILE=true ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  --wallets=N     Number of wallets (default: 1000)"
      echo "  --nfts=N        Number of NFTs (default: 10000)"
      echo "  --small         Quick test with 100 wallets, 1000 NFTs"
      echo "  --medium        Medium test with 1000 wallets, 10000 NFTs"
      echo "  --large         Large test with 5000 wallets, 50000 NFTs"
      echo "  --memory        Enable memory profiling"
      echo "  -h, --help      Show this help message"
      exit 0
      ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# Print configuration
echo "Configuration:"
echo "- Wallets: $WALLET_COUNT"
echo "- NFTs: $NFT_COUNT"
echo "- Memory Profiling: $MEMORY_PROFILE"

# Create test results directory
mkdir -p test-results

# Set environment variables
export HELIUS_API_KEY=${HELIUS_API_KEY:-mock_key_for_testing}
export SWAP_PROGRAM_ID=${SWAP_PROGRAM_ID:-Swap111111111111111111111111111111111111111}
export ENABLE_PERSISTENCE=false
export LOG_LEVEL=info

# Run the test
echo -e "\n=== Running Production Algorithm Scale Test ==="
cd backend

# Ensure TypeScript is compiled first
echo "Compiling TypeScript..."
npx tsc

# Run with memory profiling if requested
if [[ "$MEMORY_PROFILE" == "true" ]]; then
  echo "Running with memory profiling..."
  NODE_OPTIONS="--max-old-space-size=8192" node --inspect dist/tests/production-scale-test.js walletCount=$WALLET_COUNT nftCount=$NFT_COUNT
else
  echo "Running without memory profiling..."
  echo "Command: NODE_OPTIONS=\"--max-old-space-size=8192\" node dist/tests/production-scale-test.js walletCount=$WALLET_COUNT nftCount=$NFT_COUNT"
  NODE_OPTIONS="--max-old-space-size=8192" node dist/tests/production-scale-test.js walletCount=$WALLET_COUNT nftCount=$NFT_COUNT --debug
fi

# Get exit code
EXIT_CODE=$?

echo -e "\n=== Scale Test Completed with Exit Code: $EXIT_CODE ==="

# Check if test results were generated
RESULTS_COUNT=$(ls -1 test-results/production-scale-test-*.json 2>/dev/null | wc -l)
if [[ "$RESULTS_COUNT" -gt 0 ]]; then
  echo "Results saved to test-results directory"
fi

exit $EXIT_CODE 