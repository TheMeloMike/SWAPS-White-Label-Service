# Collection System Investigation Plan

## Architectural Gap Analysis

Based on our holistic architecture design, here are the specific issues in the current implementation:

### **Issue 1: Inconsistent Graph Building**

**Problem**: Each trade finder service builds graphs differently and may not consistently use expanded collection wants.

**Current State**:
```typescript
// TradeLoopFinderService.buildGraph()
buildGraph(wallets, nftOwnership, wantedNfts, rejectionPreferences)

// Uses wantedNfts parameter directly - might not include expanded collection wants
for (const [nftAddress, wanters] of wantedNfts.entries()) {
  // builds edges based on wantedNfts only
}
```

**Expected State**:
```typescript
// UnifiedGraphBuilder.buildGraph()
buildGraph(wallets, nftOwnership, allWants, rejectionPreferences)
// where allWants = specificWants + expandedCollectionWants
```

### **Issue 2: Collection Expansion Timing**

**Problem**: Collection wants are expanded in TradeDiscoveryService but individual trade finders might do their own expansion.

**Current Flow**:
```
TradeDiscoveryService.findTradeLoops()
├── expandedWantedNfts = collectionAbstractionService.expandCollectionWants()
├── bundleTradeLoopFinder.findAllTradeLoops(expandedWantedNfts)
├── scalableTradeLoopFinder.findAllTradeLoops(expandedWantedNfts)
└── BUT: scalableTradeLoopFinder also calls expandCollectionWants() again!
```

**Issue**: Double expansion and potential inconsistencies.

### **Issue 3: getWalletsThatWant() Scope**

**Problem**: Critical graph traversal method only looks at specific wants.

**Current Implementation**:
```typescript
// in trade-discovery.ts
private getWalletsThatWant(nftAddress: string): string[] {
  const wanters = this.wantedNfts.get(nftAddress);
  return wanters ? [...wanters] : [];
}
```

**Missing**: Collection want logic - if an NFT belongs to a collection that someone wants, they should be included in the wanters list.

### **Issue 4: Data Flow Inconsistency**

**Problem**: Collection wants flow through different paths in different services.

## Specific Investigation Tasks

### Task 1: Trace Collection Want Data Flow

**Objective**: Understand exactly how collection wants flow through the system.

**Investigation Points**:
1. Where are collection wants stored? (`WalletState.wantedCollections`)
2. When are they expanded? (TradeDiscoveryService vs individual finders)
3. How are they passed to graph builders? (through `wantedNfts` parameter)
4. Are all trade finders receiving the same expanded data?

**Code to Examine**:
- `TradeDiscoveryService.findTradeLoops()` - lines 214-266
- `ScalableTradeLoopFinderService.findAllTradeLoops()` - lines 617-692  
- `CollectionAbstractionService.expandCollectionWants()` - lines 77-135

### Task 2: Verify Graph Building Consistency

**Objective**: Ensure all trade finders build graphs with the same collection-expanded data.

**Investigation Points**:
1. Do all `buildGraph()` methods receive expanded wants?
2. Is the `getWalletsThatWant()` method collection-aware?
3. Are collection edges properly created in all implementations?

**Code to Examine**:
- `TradeLoopFinderService.buildGraph()` - lines 473-700
- `BundleTradeLoopFinderService.buildExtendedGraph()` - lines 268-308
- `GraphPartitioningService.buildInteractionGraph()` - lines 178-344

### Task 3: Test Collection Edge Traversal

**Objective**: Verify that collection wants create proper graph edges for cycle detection.

**Test Scenario**:
```
Wallet A: owns NFT_X, wants ANY from Collection_Y
Wallet B: owns NFT_Y (from Collection_Y), wants ANY from Collection_Z  
Wallet C: owns NFT_Z (from Collection_Z), wants NFT_X

Expected: 3-party cycle A → B → C → A
```

**Investigation Points**:
1. Does Wallet A's collection want for Collection_Y create an edge to Wallet B?
2. Does the cycle detection algorithm find this 3-party loop?
3. Are collection wants properly resolved during trade construction?

### Task 4: Identify Edge Creation Logic

**Objective**: Find where specific vs collection edges are created and ensure consistency.

**Current Edge Creation Pattern**:
```typescript
// For each NFT, find who wants it
for (const [nftAddress, ownerWallet] of nftOwnership.entries()) {
  const wanters = wantedNfts.get(nftAddress); // ← This might miss collection wants
  for (const wanter of wanters) {
    // Create edge: ownerWallet → wanter
  }
}
```

**Enhanced Pattern Needed**:
```typescript
// For each NFT, find who wants it (specific + collection)
for (const [nftAddress, ownerWallet] of nftOwnership.entries()) {
  const specificWanters = wantedNfts.get(nftAddress) || new Set();
  const collectionWanters = getCollectionWanters(nftAddress);
  const allWanters = new Set([...specificWanters, ...collectionWanters]);
  
  for (const wanter of allWanters) {
    // Create edge: ownerWallet → wanter
  }
}
```

## Immediate Investigation Steps

### Step 1: Add Debug Logging to Collection Flow

Add comprehensive logging to trace collection want processing:

```typescript
// In TradeDiscoveryService.findTradeLoops()
operation.debug('Collection wants before expansion', {
  collectionWants: Array.from(collectionWants.entries()),
  originalWantedNfts: this.wantedNfts.size
});

// After expansion
operation.debug('Collection wants after expansion', {
  expandedWantedNfts: expandedWantedNfts.size,
  newEdges: expandedWantedNfts.size - this.wantedNfts.size
});
```

### Step 2: Verify Graph Builder Inputs

Check what each trade finder receives as input:

```typescript
// In each trade finder's findAllTradeLoops method
operation.debug('Trade finder inputs', {
  wallets: wallets.size,
  nftOwnership: nftOwnership.size,
  wantedNfts: wantedNfts.size,
  wantedNftsDetail: Array.from(wantedNfts.entries()).slice(0, 5)
});
```

### Step 3: Trace getWalletsThatWant() Calls

Monitor what this critical method returns for our test NFTs:

```typescript
// In trade-discovery.ts getWalletsThatWant()
private getWalletsThatWant(nftAddress: string): string[] {
  const wanters = this.wantedNfts.get(nftAddress);
  const result = wanters ? [...wanters].filter(wallet => !this.hasRejectedNft(wallet, nftAddress)) : [];
  
  // Debug logging for our test NFTs
  if (this.isTestNFT(nftAddress)) {
    console.log(`getWalletsThatWant(${nftAddress}):`, result);
  }
  
  return result;
}
```

### Step 4: Check Collection Expansion Results

Verify that collection expansion is working correctly:

```typescript
// In CollectionAbstractionService.expandCollectionWants()
operation.debug('Collection expansion details', {
  walletAddress,
  collectionId,
  nftsInCollection: nftsInCollection.length,
  addedToExpandedWants: nftsInCollection.filter(nft => nftOwnership.has(nft)).length
});
```

## Root Cause Hypotheses

Based on the architecture analysis, the most likely issues are:

### **Hypothesis 1**: Collection expansion happens but graph builders don't use expanded data
- **Test**: Verify that `buildGraph()` methods receive and use the expanded `wantedNfts`
- **Fix**: Ensure all trade finders use the same expanded wants

### **Hypothesis 2**: getWalletsThatWant() doesn't include collection wanters
- **Test**: Check if this method returns collection-based wanters for test NFTs
- **Fix**: Enhance this method to check both specific and collection wants

### **Hypothesis 3**: Graph building happens before collection expansion
- **Test**: Verify the timing of expansion vs graph building
- **Fix**: Ensure expansion happens before any graph construction

### **Hypothesis 4**: Multiple expansion causes conflicts
- **Test**: Check if multiple services expand the same collections differently
- **Fix**: Centralize expansion to single point

## Success Criteria

The investigation will be complete when we can:

1. **Trace Data Flow**: See exactly how collection wants flow from registration to trade discovery
2. **Verify Consistency**: Confirm all trade finders receive the same expanded want data  
3. **Identify Bottleneck**: Pinpoint exactly where collection wants are lost in the process
4. **Propose Fix**: Have a specific, targeted fix based on evidence

## Next Steps

1. Run the investigation tasks above with detailed logging
2. Create a minimal reproduction case with known collection wants
3. Step through the code with a debugger to see exact data flow
4. Identify the specific line(s) where collection wants are not properly handled
5. Implement the targeted fix based on findings 