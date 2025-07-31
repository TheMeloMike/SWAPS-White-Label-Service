#!/bin/bash

# SWAPS Trading Algorithm Test Runner
echo "🚀 SWAPS Trading Algorithm Test Environment"
echo "=========================================="
echo ""

# Check for ts-node
if ! command -v ts-node &> /dev/null; then
    echo "⚠️  ts-node is not installed. Installing it globally..."
    npm install -g ts-node typescript
fi

# Set up environment
echo "🔧 Setting up test environment..."
export NODE_PATH=./src

# Ensure types are compiled
echo "📦 Compiling TypeScript types..."
tsc --noEmit src/types/trade.ts

# Run the test suite
echo "🧪 Running trading algorithm tests..."
echo ""
ts-node src/test-runner.ts

# Exit with proper status code
exit_code=$?
if [ $exit_code -ne 0 ]; then
    echo "❌ Tests failed with exit code $exit_code"
    exit $exit_code
else
    echo "✅ All tests completed successfully!"
    exit 0
fi 