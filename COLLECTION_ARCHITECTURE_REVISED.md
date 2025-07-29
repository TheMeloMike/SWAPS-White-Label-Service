# SWAPS Collection System - Revised Holistic Architecture

## Core Principle: **Algorithm Preservation + Modular Enhancement**

**Critical Requirement**: Preserve all advanced algorithms (Johnson's, Tarjan's, Louvain, Graph Partitioning) while adding collection support in a completely modular, non-invasive way.

## **Architectural Strategy: Graph Abstraction Layer**

Instead of modifying individual algorithm implementations, create a **unified graph abstraction** that handles collection expansion transparently.

### **1. Graph Abstraction Layer Architecture**

```typescript
interface UnifiedTradeGraph {
  // Core graph operations (algorithm-agnostic)
  getNodes(): string[];
  getEdges(from: string): Map<string, GraphEdgeData>;
  getWanters(nft: string): string[];  // ← This handles collections transparently
  
  // Algorithm-specific views
  getJohnsonGraph(): { [key: string]: { [key: string]: string[] } };
  getTarjanGraph(): GraphX.Graph;
  getLouvainGraph(): Community.Graph;
  getPartitionGraph(): Partition.Graph;
}

class CollectionAwareTradeGraph implements UnifiedTradeGraph {
  constructor(
    private wallets: Map<string, WalletState>,
    private nftOwnership: Map<string, string>,
    private specificWants: Map<string, Set<string>>,
    private collectionWants: Map<string, Set<string>>, // New parameter
    private collectionResolver: CollectionResolver
  ) {}
  
  // THE KEY METHOD - handles collections transparently
  getWanters(nft: string): string[] {
    // Get specific wants
    const specific = this.specificWants.get(nft) || new Set();
    
    // Get collection wants (only if collections are enabled)
    const collection = this.collectionResolver.getWantersForNFT(nft) || new Set();
    
    return [...new Set([...specific, ...collection])];
  }
  
  // Algorithm-specific graph generation (preserves existing interfaces)
  getJohnsonGraph(): { [key: string]: { [key: string]: string[] } } {
    // Generate the exact same graph format that Johnson's expects
    // But use this.getWanters() instead of direct wants lookup
    const graph = {};
    for (const [nft, owner] of this.nftOwnership) {
      const wanters = this.getWanters(nft); // ← Collection-aware
      // Build graph using existing Johnson's format...
    }
    return graph;
  }
}
```

### **2. Collection Resolution Service (Isolated)**

```typescript
class CollectionResolver {
  private nftToCollectionCache = new Map<string, string>();
  private collectionToNFTsCache = new Map<string, Set<string>>();
  
  constructor(
    private localCollectionService: LocalCollectionService,
    private enabled: boolean = false  // Dynamic enabling
  ) {}
  
  getWantersForNFT(nft: string): Set<string> {
    if (!this.enabled) return new Set(); // Zero performance impact when disabled
    
    const collectionId = this.getCollectionForNFT(nft);
    if (!collectionId) return new Set();
    
    return this.collectionWants.get(collectionId) || new Set();
  }
  
  // Optimized collection lookup with caching
  private getCollectionForNFT(nft: string): string | null {
    if (this.nftToCollectionCache.has(nft)) {
      return this.nftToCollectionCache.get(nft)!;
    }
    
    // Batch collection resolution to minimize API calls
    const collectionId = this.localCollectionService.getCollectionForNFT(nft);
    if (collectionId) {
      this.nftToCollectionCache.set(nft, collectionId);
    }
    
    return collectionId;
  }
}
```

### **3. Algorithm Integration (Zero Changes)**

```typescript
// Johnson's Algorithm - NO CHANGES NEEDED
class TradeLoopFinderService {
  async findAllTradeLoops(
    graph: UnifiedTradeGraph,  // ← New interface, same data
    rejectionPreferences: Map<string, RejectionPreferences>
  ): Promise<TradeLoop[]> {
    // Get algorithm-specific graph format
    const johnsonGraph = graph.getJohnsonGraph(); // ← Handles collections transparently
    
    // Use EXISTING Johnson's implementation unchanged
    const cycles = this.johnsonAlgorithm.findElementaryCycles(johnsonGraph);
    
    // Rest of algorithm unchanged...
  }
}

// Tarjan's Algorithm - NO CHANGES NEEDED  
class SCCFinderService {
  findStronglyConnectedComponents(graph: UnifiedTradeGraph) {
    const tarjanGraph = graph.getTarjanGraph(); // ← Handles collections transparently
    
    // Use EXISTING Tarjan's implementation unchanged
    return this.tarjanAlgorithm.findSCCs(tarjanGraph);
  }
}

// Graph Partitioning - NO CHANGES NEEDED
class GraphPartitioningService {
  partitionGraph(graph: UnifiedTradeGraph) {
    const partitionGraph = graph.getPartitionGraph(); // ← Handles collections transparently
    
    // Use EXISTING Louvain implementation unchanged
    return this.louvainAlgorithm.detectCommunities(partitionGraph);
  }
}
```

## **4. Service Layer - Clean Separation**

```typescript
// TradeDiscoveryService - Orchestrator Only
class TradeDiscoveryService {
  async findTradeLoops(settings?: TradeDiscoverySettings): Promise<TradeLoop[]> {
    // Step 1: Build unified graph (handles collections transparently)
    const graph = this.graphBuilder.buildUnifiedGraph(
      this.wallets,
      this.nftOwnership,
      this.wantedNfts,
      this.collectionWants, // ← New parameter
      settings?.considerCollections || false
    );
    
    // Step 2: Use existing algorithms unchanged
    const strategies = [
      { name: 'johnson', finder: () => this.johnsonFinder.findTradeLoops(graph) },
      { name: 'scalable', finder: () => this.scalableFinder.findTradeLoops(graph) },
      { name: 'bundle', finder: () => this.bundleFinder.findTradeLoops(graph) }
    ];
    
    // Rest unchanged...
  }
}

// GraphBuilder - Single Point of Graph Creation
class UnifiedGraphBuilder {
  buildUnifiedGraph(
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    specificWants: Map<string, Set<string>>,
    collectionWants: Map<string, Set<string>>,
    enableCollections: boolean
  ): UnifiedTradeGraph {
    
    const collectionResolver = new CollectionResolver(
      this.localCollectionService,
      enableCollections  // ← Dynamic enabling
    );
    
    return new CollectionAwareTradeGraph(
      wallets,
      nftOwnership,
      specificWants,
      collectionWants,
      collectionResolver
    );
  }
}
```

## **5. Performance Optimization Strategy**

### **Lazy Collection Resolution**
```typescript
class OptimizedCollectionResolver {
  private resolutionCache = new Map<string, Promise<Set<string>>>();
  
  getWantersForNFT(nft: string): Set<string> {
    // Only resolve collections for NFTs that are actually queried
    if (!this.resolutionCache.has(nft)) {
      this.resolutionCache.set(nft, this.resolveWantersLazy(nft));
    }
    
    // Return cached result or empty set while resolving
    const promise = this.resolutionCache.get(nft)!;
    return promise.isResolved ? promise.value : new Set();
  }
  
  private async resolveWantersLazy(nft: string): Promise<Set<string>> {
    // Batch multiple NFT resolutions together
    return this.batchResolver.addToBatch(nft);
  }
}
```

### **Batch Collection Processing**
```typescript
class BatchCollectionResolver {
  private batchQueue = new Set<string>();
  private batchTimer: Timer | null = null;
  
  addToBatch(nft: string): Promise<Set<string>> {
    this.batchQueue.add(nft);
    
    // Process batches every 10ms to optimize API calls
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.processBatch(), 10);
    }
    
    return this.getPromiseForNFT(nft);
  }
  
  private processBatch() {
    const nfts = Array.from(this.batchQueue);
    this.batchQueue.clear();
    this.batchTimer = null;
    
    // Single API call for multiple NFTs
    this.localCollectionService.getCollectionsForNFTs(nfts)
      .then(results => this.distributeResults(results));
  }
}
```

## **6. Dynamic Feature Control**

```typescript
interface CollectionConfig {
  enabled: boolean;
  maxCollectionSize: number;      // Skip huge collections
  cacheTimeout: number;          // Collection cache TTL
  batchSize: number;             // Batch processing size
  fallbackToExpansion: boolean;  // Use expansion for small collections
}

class CollectionFeatureController {
  constructor(private config: CollectionConfig) {}
  
  shouldUseCollectionEdges(collectionId: string): boolean {
    if (!this.config.enabled) return false;
    
    const size = this.getCollectionSize(collectionId);
    return size <= this.config.maxCollectionSize;
  }
  
  shouldExpandCollection(collectionId: string): boolean {
    if (!this.config.fallbackToExpansion) return false;
    
    const size = this.getCollectionSize(collectionId);
    return size <= 100; // Small collections get expanded
  }
}
```

## **7. Migration Strategy - Zero Risk**

### **Phase 1: Infrastructure (Week 1)**
- Create `UnifiedTradeGraph` interface
- Implement `CollectionAwareTradeGraph`
- Add feature flags for collection support

### **Phase 2: Algorithm Integration (Week 2)**
- Update algorithm services to use `UnifiedTradeGraph`
- Maintain 100% backward compatibility
- Add comprehensive testing

### **Phase 3: Optimization (Week 3)**
- Add batch processing and caching
- Performance benchmarking vs current system
- Zero performance regression validation

### **Phase 4: Production (Week 4)**
- Feature flag rollout
- A/B testing with collection features
- Gradual enablement

## **8. Success Metrics**

### **Functionality**
- ✅ Collections work in 2-party and multi-party trades
- ✅ All existing algorithms work unchanged
- ✅ Feature can be enabled/disabled dynamically

### **Performance**
- ✅ Zero regression when collections disabled
- ✅ <5% performance impact when collections enabled
- ✅ Handles millions of NFTs + thousands of collections

### **Scalability**
- ✅ Johnson's algorithm performance unchanged
- ✅ Tarjan's algorithm performance unchanged  
- ✅ Graph partitioning performance unchanged
- ✅ Community detection performance unchanged

### **Architecture**
- ✅ Clean separation of concerns
- ✅ Modular collection handling
- ✅ Algorithm implementations unchanged
- ✅ Unified graph interface

## **9. Risk Assessment**

### **Zero Risk Changes**
- Adding new interfaces (additive only)
- Feature flag implementation
- Collection resolver service (isolated)

### **Low Risk Changes**
- Algorithm service interface updates (same functionality)
- Graph builder consolidation (single responsibility)

### **Mitigation Strategy**
- Comprehensive unit tests for all algorithms
- Performance regression testing
- Feature flags for instant rollback
- Gradual rollout with monitoring

## **Implementation Priority**

1. **UnifiedTradeGraph Interface** - Foundation for everything
2. **CollectionResolver Service** - Isolated collection logic  
3. **Algorithm Integration** - Update to use unified interface
4. **Performance Optimization** - Caching and batching
5. **Production Deployment** - Feature flags and monitoring

This approach preserves the advanced algorithmic foundation while adding collection support in a completely modular, scalable way. 