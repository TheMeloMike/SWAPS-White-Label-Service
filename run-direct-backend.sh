#!/bin/bash

# =====================================================================
# DEPRECATED: This script is deprecated and may not work correctly.
# Please use run-fixed.sh instead, which has proper environment variables
# and directory handling.
# =====================================================================

echo -e "\033[0;31mWARNING: This script is DEPRECATED. Please use run-fixed.sh instead.\033[0m"
echo "Starting SWAPS backend with direct environment variables..."

# Kill any existing node processes
pkill -f "node|next" || true
sleep 1

# Run with direct environment variables
cd backend && \
HELIUS_API_KEY=b9bab9a3-f168-4cdc-9a82-e3509dbc86e7 \
SWAP_PROGRAM_ID=Swap111111111111111111111111111111111111111 \
ENABLE_PERSISTENCE=true \
DATA_DIR=./data \
NODE_ENV=development \
node -r ts-node/register ./src/index.ts 