#!/bin/bash

# Algorithm Performance Test Runner
# This script will run the algorithm performance tests with proper environment variables

# Make sure we're in the right directory
cd "$(dirname "$0")"

# Set required environment variables
export HELIUS_API_KEY=demo
export SWAP_PROGRAM_ID=Swap111111111111111111111111111111111111111
export ENABLE_PERSISTENCE=true
export TRADELOOP_MAX_DEPTH=10
export TRADELOOP_MIN_EFFICIENCY=0.6

echo "=== Running Algorithm Performance Test ==="
echo "Test configurations:"
echo " - Simple 2-party trade"
echo " - Simple 3-party circular trade"
echo " - Complex multi-party trades (5 wallets)"
echo " - Medium-scale random network (20 wallets)"
echo " - Large-scale random network (100 wallets)"
echo " - Extreme-scale random network (500 wallets)"
echo ""
echo "Environment:"
echo " - Max trade depth: $TRADELOOP_MAX_DEPTH"
echo " - Min efficiency: $TRADELOOP_MIN_EFFICIENCY"
echo ""

# Run the test script
cd backend && npx ts-node src/tests/algorithm-performance.ts

# Exit with the test's exit code
exit $? 