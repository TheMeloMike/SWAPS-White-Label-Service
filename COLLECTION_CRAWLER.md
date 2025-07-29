# SWAPS Standalone Collection Crawler

## Overview

The SWAPS Collection Crawler is a standalone data proliferation system designed to aggressively discover and cache Solana NFT collections independently from the main backend. This approach provides clean separation of concerns and eliminates real-time API dependencies for collection search functionality.

## ✅ Clean Separation Achieved

- **Backend**: Cleaned of all crawler integration, now uses live Helius API calls for collections
- **Standalone Crawler**: Independent process for data discovery and caching  
- **Data Storage**: Local JSON files managed entirely by the crawler
- **No Dependencies**: Backend can run without crawler, crawler can run without backend

## 🚀 Features

### Multi-Strategy Collection Discovery
- **Recent Activity**: Discovers collections from latest Solana NFT activity
- **Creator Networks**: Expands through known creator networks
- **Collection Expansion**: Explores related assets within known collections
- **Parallel Processing**: All strategies run concurrently for maximum throughput

### Aggressive Performance Settings
- **Burst Mode**: 30-second intervals for first hour (6,000-12,000 collections/hour)
- **Normal Mode**: 2-minute intervals (14,000-36,000 collections/day)
- **Large Batches**: 1,000 assets per API call (20x larger than conservative)
- **Multi-Page Discovery**: 5 pages = 5,000 assets per cycle
- **High Concurrency**: 50 creators + 20 collections processed per cycle

### Persistent Storage & State Management
- **Auto-Save**: Collections and state saved every 5 minutes
- **Crash Recovery**: Resumes from last known state
- **Statistics Tracking**: Comprehensive metrics and performance monitoring
- **Search Interface**: Instant local search against cached collections

## 📁 File Structure

```
├── scripts/
│   ├── collection-crawler.js     # Main crawler implementation
│   ├── package.json             # Crawler dependencies
│   └── node_modules/            # Dependencies (node-fetch)
├── data/
│   ├── collections.json         # Collection database (auto-generated)
│   ├── crawler-state.json      # Runtime state (auto-generated)
│   ├── README.md               # Data structure documentation
│   └── .gitkeep               # Git tracking
└── start-collection-crawler.sh  # Convenience startup script
```

## 🛠 Installation & Setup

### Prerequisites
- Node.js 14+ 
- Valid HELIUS_API_KEY in `backend/.env.local` or `backend/.env`

### Quick Start
```bash
# Install dependencies
cd scripts && npm install

# Start aggressive collection discovery
./start-collection-crawler.sh start

# Or start directly
HELIUS_API_KEY=your_key node scripts/collection-crawler.js start
```

## 📋 Usage Commands

### Management Script (Recommended)
```bash
./start-collection-crawler.sh start     # Start crawler in burst mode
./start-collection-crawler.sh stop      # Stop crawler process
./start-collection-crawler.sh stats     # Show statistics
./start-collection-crawler.sh search "query"  # Search collections
./start-collection-crawler.sh test      # Test functionality
./start-collection-crawler.sh clean     # Clean all data
```

### Direct Node Commands
```bash
node scripts/collection-crawler.js start
node scripts/collection-crawler.js stats  
node scripts/collection-crawler.js search "mad lads"
```

## 📊 Performance Projections

### Burst Mode (First Hour)
- **Interval**: 30 seconds
- **Collections/Hour**: 6,000-12,000
- **API Calls/Hour**: ~1,200 
- **Purpose**: Rapid initial database population

### Normal Mode (Ongoing)
- **Interval**: 2 minutes  
- **Collections/Day**: 14,000-36,000
- **API Calls/Day**: ~4,320
- **Purpose**: Steady growth and maintenance

### Total Estimates
- **100K+ collections**: Achievable in weeks
- **1M+ collections**: Achievable in months
- **Rate limiting safe**: Built-in backoff and retry logic

## 🔍 Collection Discovery Strategies

### 1. Recent Activity Discovery
- Queries latest NFT activity on Solana
- Processes 5,000 assets per cycle (5 pages × 1,000 assets)
- Prioritizes active, trending collections
- Updates every crawl cycle

### 2. Creator Network Expansion  
- Tracks creators from discovered collections
- Explores all NFTs by known creators
- Builds creator relationship mapping
- Discovers creator "universes" of collections

### 3. Known Collection Expansion
- Deep-dives into existing collections
- Discovers related/derivative collections
- Finds collection families and series
- Ensures comprehensive coverage

## 💾 Data Storage

### collections.json Structure
```json
{
  "collectionId": {
    "id": "collection_mint_address",
    "name": "Collection Name",
    "symbol": "SYMBOL", 
    "verified": true,
    "floorPrice": 0,
    "volume24h": 0,
    "totalSupply": 10000,
    "image": "https://...",
    "sources": ["crawler", "seed"],
    "lastUpdated": 1748031234567,
    "metadata": {
      "creator": "creator_address",
      "attributes": [...]
    }
  }
}
```

### crawler-state.json Structure  
```json
{
  "crawlsExecuted": 42,
  "lastCrawlTime": 1748031234567,
  "collectionsDiscovered": 1337,
  "apiCalls": 5000,
  "errors": 3,
  "knownCreators": ["address1", "address2"],
  "recentCollections": ["collection1", "collection2"]
}
```

## 🔒 Rate Limiting & Safety

### Built-in Protections
- **Request Limits**: 10 requests/second (burst up to 25)
- **Exponential Backoff**: 1s, 2s, 3s retry delays
- **Error Handling**: Graceful failure with statistics tracking
- **API Budget Management**: Tracks and reports API usage

### Monitoring & Alerts
- **Statistics Dashboard**: Real-time metrics via `stats` command
- **Error Tracking**: Comprehensive error logging and counting
- **Performance Metrics**: Collections/hour calculation
- **Health Checks**: Built-in functionality testing

## 🔄 Integration with Backend

### Current Integration (Post-Cleanup)
- **Backend**: Uses live Helius API for collection search
- **Crawler**: Runs independently, builds local database
- **Future Integration**: Backend can optionally read crawler's `collections.json`

### Migration Path (Optional)
1. **Phase 1**: Standalone crawler builds comprehensive database
2. **Phase 2**: Backend switches to local database for search
3. **Phase 3**: Hybrid approach - local primary, live fallback

## 🚨 Troubleshooting

### Common Issues
```bash
# Missing API key
export HELIUS_API_KEY=your_key_here

# Permission errors  
chmod +x start-collection-crawler.sh
chmod +x scripts/collection-crawler.js

# Dependency issues
cd scripts && npm install

# Data corruption
./start-collection-crawler.sh clean  # Then restart
```

### Monitoring Health
```bash
# Check if running
ps aux | grep collection-crawler

# View recent logs
tail -f <output_of_running_process>

# Test functionality  
./start-collection-crawler.sh test
```

## 🎯 Next Steps

1. **Start the crawler**: `./start-collection-crawler.sh start`
2. **Monitor progress**: Check stats periodically with `./start-collection-crawler.sh stats`  
3. **Test searches**: Use `./start-collection-crawler.sh search "query"`
4. **Scale monitoring**: Track API usage and rate limiting behavior
5. **Future integration**: Consider integrating with backend when database is substantial

The standalone crawler is now ready for aggressive collection discovery while maintaining clean separation from your backend! 🚀 