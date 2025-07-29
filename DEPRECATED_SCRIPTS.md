# Deprecated Scripts in SWAPS

The following scripts have been marked as deprecated and should not be used:

- `start-swaps.sh` - Missing frontend directory path
- `run-backend.sh` - Environment variable issues
- `run-direct-backend.sh` - Path issues
- `run-swaps.sh` - Original implementation with issues

## Recommended Script

Please use `run-fixed.sh` instead, which:

1. Properly sets all environment variables
2. Creates necessary data directories
3. Handles both backend and frontend startup
4. Redirects logs appropriately
5. Ensures the GraphPartitioningService fix is properly loaded

## Running SWAPS

To run the application:

```bash
./run-fixed.sh
```

This script will:
- Kill any existing Node.js processes
- Start the backend with all required environment variables
- Start the frontend
- Output log locations for troubleshooting

The fixed version correctly validates trade loops to prevent invalid trades where users would receive NFTs they don't want. 