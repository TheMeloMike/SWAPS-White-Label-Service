#!/bin/bash

set -e

echo "🐳 SWAPS Smart Contract Docker Deployment"
echo "========================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "✅ Docker is running"

# Build the Docker image
echo "🔨 Building Docker image..."
docker build -t swaps-contract .

echo "✅ Docker image built successfully"

# Run the deployment
echo "🚀 Running deployment in Docker container..."
docker run --rm -v "$(pwd)/output:/app/output" swaps-contract

echo "🎉 Deployment complete!"
echo ""
echo "📄 Check the output directory for:"
echo "   - program_id.txt (contains your deployed contract address)"
echo "   - deployment logs"