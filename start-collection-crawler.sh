#!/bin/bash

# SWAPS Collection Crawler Startup Script
# This script starts the standalone collection crawler with proper environment configuration

set -e

echo "🚀 Starting SWAPS Collection Crawler..."

# Check if we're in the right directory
if [ ! -f "scripts/collection-crawler.js" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    echo "   Current directory: $(pwd)"
    echo "   Expected: collection-crawler.js should be at scripts/collection-crawler.js"
    exit 1
fi

# Check for Helius API key
if [ -f "backend/.env.local" ]; then
    echo "📁 Loading environment from backend/.env.local"
    export $(grep -v '^#' backend/.env.local | xargs)
elif [ -f "backend/.env" ]; then
    echo "📁 Loading environment from backend/.env"
    export $(grep -v '^#' backend/.env | xargs)
else
    echo "⚠️  No .env file found. Please ensure HELIUS_API_KEY is set."
fi

if [ -z "$HELIUS_API_KEY" ]; then
    echo "❌ Error: HELIUS_API_KEY environment variable is required"
    echo "   Please set it in backend/.env.local or backend/.env"
    exit 1
fi

echo "✅ Environment configured"
echo "🔑 API Key: ${HELIUS_API_KEY:0:8}..."

# Check if dependencies are installed
if [ ! -d "scripts/node_modules" ]; then
    echo "📦 Installing crawler dependencies..."
    cd scripts && npm install && cd ..
fi

# Parse command line arguments
COMMAND=${1:-start}

case $COMMAND in
    start)
        echo "🚀 Starting collection crawler in aggressive mode..."
        echo "⚡ This will discover collections rapidly using burst mode"
        echo "💾 Data will be saved to data/collections.json"
        echo "📊 Press Ctrl+C to stop and view statistics"
        echo ""
(cd scripts && node collection-crawler.js start)
        ;;
    
    stop)
        echo "🛑 Stopping collection crawler..."
        pkill -f "collection-crawler.js" || echo "No crawler process found"
        ;;
    
    stats)
        echo "📊 Collection Crawler Statistics:"
(cd scripts && node collection-crawler.js stats)
        ;;
    
    search)
        if [ -z "$2" ]; then
            echo "Usage: $0 search <query>"
            exit 1
        fi
        echo "🔍 Searching collections for: $2"
(cd scripts && node collection-crawler.js search "$2")
        ;;
    
    test)
        echo "🧪 Testing crawler functionality..."
        (cd scripts && node collection-crawler.js stats)
        echo ""
        echo "🔍 Testing search functionality..."
        (cd scripts && node collection-crawler.js search "mad")
        ;;
    
    clean)
        echo "🧹 Cleaning crawler data..."
        read -p "Are you sure you want to delete all crawler data? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -f data/collections.json data/crawler-state.json
            echo "✅ Crawler data cleaned"
        else
            echo "❌ Operation cancelled"
        fi
        ;;
    
    *)
        echo "🚀 SWAPS Collection Crawler Management Script"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  start   - Start the collection crawler (default)"
        echo "  stop    - Stop the collection crawler"
        echo "  stats   - Show crawler statistics"
        echo "  search  - Search collections (usage: $0 search <query>)"
        echo "  test    - Test crawler functionality"
        echo "  clean   - Clean all crawler data"
        echo ""
        echo "Examples:"
        echo "  $0 start                 # Start aggressive collection discovery"
        echo "  $0 stats                 # Show current statistics"
        echo "  $0 search 'solana'       # Search for Solana collections"
        echo "  $0 test                  # Test basic functionality"
        ;;
esac 