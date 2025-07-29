#!/bin/bash

# Start of script
echo "=== Starting ISOLATED Algorithm Tests ==="
echo "These tests run completely isolated from any external dependencies"
echo "No backend or API connection required"

# Set environment variables for isolated testing
export ISOLATED_TEST=true
export API_URL=http://localhost:3001  # Not actually used in isolated mode

# Run the algorithm tests in isolated mode
node test-algorithm.js

# Capture exit code
EXIT_CODE=$?

# Exit with the same code as the test script
echo "=== Test completed with exit code: $EXIT_CODE ==="
exit $EXIT_CODE 