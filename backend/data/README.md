# SWAPS Data Directory

This directory contains persistent storage for the SWAPS backend system.

## 📁 Directory Structure

```
backend/data/
├── collections.json          # Background crawler collection database
├── crawler-state.json        # Crawler service state and progress
├── wallets.json              # Wallet state cache
├── wantedNfts.json           # User NFT preferences
├── nftOwnership.json         # NFT ownership cache
├── nft_demand_metrics.json   # Demand analytics
├── nft_value_records.json    # Value tracking
├── rejection_preferences.json # User rejection history
├── completedSteps.json       # Trade execution state
└── tradeLoop:*.json          # Individual trade loop cache files
```

## 🤖 Collection Crawler Data

### `collections.json` (~3KB)
**Purpose**: Main collection database built by background crawler
**Contains**: Complete collection metadata for instant search
**Structure**:
```json
{
  "collectionId": {
    "id": "SMBtHCCC6RYRutFEPb4gZqeBLUZbMNhRKaMKZZLHi7W",
    "name": "SMB #2832",
    "symbol": "SMB",
    "verified": false,
    "totalSupply": 5,
    "image": "https://...",
    "floorPrice": 0,
    "volume24h": 0,
    "sources": ["crawler"],
    "lastUpdated": 1748030104701,
    "discoveredAt": 1748030104701,
    "creators": ["creator1", "creator2"],
    "searchTerms": ["smb #2832", "smb", "#2832"]
  }
}
```

### `crawler-state.json` (~1KB)
**Purpose**: Background crawler service state tracking
**Contains**: Crawl progress, discovered creators, error counts
**Structure**:
```json
{
  "totalCollections": 5,
  "lastCrawlTime": 1748030104701,
  "discoveredToday": 0,
  "errorCount": 0,
  "knownCreators": ["creator1", "creator2", ...],
  "processedCollections": ["collection1", "collection2", ...]
}
```

## 🔄 Trade System Data

### `wallets.json`
**Purpose**: Cached wallet states and NFT holdings
**Updates**: When wallets are scanned or updated

### `wantedNfts.json`
**Purpose**: User preferences for specific NFTs and collections
**Updates**: When users add/remove wants

### `tradeLoop:*.json`
**Purpose**: Individual trade loop cache files
**Format**: `tradeLoop:{uuid}.json`
**Contains**: Complete trade loop data for quick retrieval

## 📊 Analytics Data

### `nft_demand_metrics.json`
**Purpose**: Demand analytics and popularity scoring
**Updates**: During trade discovery runs

### `nft_value_records.json`
**Purpose**: Historical value tracking for NFTs
**Updates**: When pricing data is collected

## ⚙️ Configuration

**Storage Location**: Configurable via `DATA_DIR` environment variable
**Default Path**: `./data` (relative to backend root)
**Persistence**: All files are automatically saved and loaded on restart

## 🔍 Monitoring

**Crawler Stats**: `GET /api/collections/crawler/stats`
**Database Size**: Currently 5 collections, growing every 30 minutes
**Last Update**: Check `lastCrawlTime` in crawler-state.json

## 🛠 Maintenance

**Growing Database**: Collections database expands automatically via:
- Recent activity discovery
- Creator network expansion  
- Known collection analysis

**Cleanup**: No automatic cleanup - files grow as needed
**Backup**: Consider backing up collections.json periodically

## 📈 Performance

- **Search Speed**: Instant (local database, no API calls)
- **Rate Limits**: None (all local data)
- **Timeouts**: None (no external dependencies for search)
- **Growth Rate**: ~30-minute crawl intervals

---
*Generated: May 23, 2025*
*SWAPS Background Collection Crawler System* 