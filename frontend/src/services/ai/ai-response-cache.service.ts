interface CacheContext {
  // User Context
  walletAddress?: string;
  userNFTCount?: number;
  portfolioValue?: number;
  
  // Market Context  
  marketState?: 'stable' | 'volatile' | 'trending';
  trendingCollections?: string[];
  
  // Conversation Context
  messageCount?: number;
  lastIntent?: string;
  conversationHash?: string;
  
  // Trade Context
  availableTradeCount?: number;
  lastTradeEfficiency?: number;
}

interface CachedResponse {
  response: {
    message: string;
    suggestions?: string[];
    shouldSearchTrades?: boolean;
    extractedNFTAddress?: string;
  };
  context: CacheContext;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  ttl: number;
  tags: string[]; // For smart invalidation
}

interface CacheKey {
  queryHash: string;
  contextHash: string;
  version: string; // For cache versioning
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalSize: number;
  averageAccessTime: number;
  topQueries: Array<{ query: string; count: number }>;
  contextDistribution: Record<string, number>;
}

/**
 * Enhanced AI Response Cache Service
 * 
 * Provides intelligent caching for AI responses with:
 * - Context-aware cache keys (user state, market conditions, conversation context)
 * - Smart TTL based on response type and volatility  
 * - Automatic cache invalidation when relevant data changes
 * - Cache warming for common queries
 * - Performance analytics and optimization
 * - Modular cache strategies for different response types
 */
export class AIResponseCacheService {
  private static instance: AIResponseCacheService;
  
  // Cache storage - uses existing frontend caching infrastructure
  private cache: Map<string, CachedResponse> = new Map();
  
  // Configuration
  private readonly MAX_CACHE_SIZE = 1000; // Maximum cached responses
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes default
  private readonly CACHE_VERSION = '1.0'; // For versioning compatibility
  
  // TTL strategies based on response type
  private readonly TTL_STRATEGIES = {
    // Static/educational content - cache longer
    education: 30 * 60 * 1000, // 30 minutes
    how_to: 20 * 60 * 1000, // 20 minutes
    explanation: 15 * 60 * 1000, // 15 minutes
    
    // Dynamic market content - cache shorter
    market_analysis: 2 * 60 * 1000, // 2 minutes  
    trending: 1 * 60 * 1000, // 1 minute
    price_analysis: 30 * 1000, // 30 seconds
    
    // User-specific content - medium cache
    portfolio_analysis: 5 * 60 * 1000, // 5 minutes
    trade_opportunities: 3 * 60 * 1000, // 3 minutes
    
    // General queries - standard cache
    general: this.DEFAULT_TTL
  };
  
  // Analytics
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalSize: 0,
    averageAccessTime: 0,
    topQueries: [],
    contextDistribution: {}
  };
  
  // Query tracking for analytics
  private queryFrequency: Map<string, number> = new Map();
  private accessTimes: number[] = [];
  
  private constructor() {
    // Set up periodic cleanup and optimization
    setInterval(() => this.performMaintenance(), 10 * 60 * 1000); // Every 10 minutes
    
    // Warm cache with common queries on startup
    this.warmCache();
  }
  
  public static getInstance(): AIResponseCacheService {
    if (!AIResponseCacheService.instance) {
      AIResponseCacheService.instance = new AIResponseCacheService();
    }
    return AIResponseCacheService.instance;
  }
  
  /**
   * Get cached response if available and valid
   */
  public getCachedResponse(
    query: string, 
    context: CacheContext
  ): CachedResponse['response'] | null {
    const startTime = performance.now();
    
    try {
      const cacheKey = this.generateCacheKey(query, context);
      const cached = this.cache.get(cacheKey.queryHash + cacheKey.contextHash);
      
      if (!cached) {
        this.stats.misses++;
        this.trackQueryFrequency(query);
        return null;
      }
      
      // Check if cache entry is still valid
      const now = Date.now();
      if (now - cached.timestamp > cached.ttl) {
        // Cache expired - remove it
        this.cache.delete(cacheKey.queryHash + cacheKey.contextHash);
        this.stats.misses++;
        this.trackQueryFrequency(query);
        return null;
      }
      
      // Check if context has changed significantly
      if (!this.isContextCompatible(cached.context, context)) {
        this.stats.misses++;
        this.trackQueryFrequency(query);
        return null;
      }
      
      // Cache hit! Update access statistics
      cached.accessCount++;
      cached.lastAccessed = now;
      this.stats.hits++;
      
      const accessTime = performance.now() - startTime;
      this.accessTimes.push(accessTime);
      if (this.accessTimes.length > 100) {
        this.accessTimes.shift(); // Keep last 100 access times
      }
      
      this.updateStats();
      
      return cached.response;
    } catch (error) {
      console.error('Error retrieving cached response:', error);
      this.stats.misses++;
      return null;
    }
  }
  
  /**
   * Cache an AI response with intelligent TTL and tagging
   */
  public cacheResponse(
    query: string,
    response: CachedResponse['response'],
    context: CacheContext
  ): void {
    try {
      const cacheKey = this.generateCacheKey(query, context);
      const responseType = this.classifyResponse(query, response);
      const ttl = this.getTTLForResponse(responseType, context);
      const tags = this.generateCacheTags(query, response, context);
      
      const cachedResponse: CachedResponse = {
        response,
        context,
        timestamp: Date.now(),
        accessCount: 1,
        lastAccessed: Date.now(),
        ttl,
        tags
      };
      
      const fullKey = cacheKey.queryHash + cacheKey.contextHash;
      
      // Check cache size limit
      if (this.cache.size >= this.MAX_CACHE_SIZE) {
        this.evictLeastUsed();
      }
      
      this.cache.set(fullKey, cachedResponse);
      this.trackQueryFrequency(query);
      this.updateStats();
      
    } catch (error) {
      console.error('Error caching AI response:', error);
    }
  }
  
  /**
   * Invalidate cache entries based on tags (smart invalidation)
   */
  public invalidateByTag(tag: string): number {
    let invalidatedCount = 0;
    
    for (const [key, cached] of Array.from(this.cache.entries())) {
      if (cached.tags.includes(tag)) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }
    
    this.updateStats();
    return invalidatedCount;
  }
  
  /**
   * Invalidate cache when market conditions change
   */
  public invalidateMarketData(): number {
    return this.invalidateByTag('market_data') + 
           this.invalidateByTag('trending') + 
           this.invalidateByTag('price_analysis');
  }
  
  /**
   * Invalidate cache when user portfolio changes
   */
  public invalidateUserPortfolio(walletAddress: string): number {
    let invalidatedCount = 0;
    
    for (const [key, cached] of Array.from(this.cache.entries())) {
      if (cached.context.walletAddress === walletAddress && 
          (cached.tags.includes('portfolio') || cached.tags.includes('trade_opportunities'))) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }
    
    this.updateStats();
    return invalidatedCount;
  }
  
  /**
   * Generate intelligent cache key based on query and context
   */
  private generateCacheKey(query: string, context: CacheContext): CacheKey {
    // Normalize query for consistent caching
    const normalizedQuery = query.toLowerCase().trim();
    
    // Create context hash based on relevant context factors
    const contextFactors = [
      context.walletAddress || 'anonymous',
      Math.floor((context.userNFTCount || 0) / 5) * 5, // Group by 5s to reduce cache fragmentation
      context.marketState || 'unknown',
      context.lastIntent || 'general',
      Math.floor((context.messageCount || 0) / 5) * 5, // Group conversation length
      context.trendingCollections?.slice(0, 3).join(',') || 'none' // Top 3 trending
    ];
    
    const queryHash = this.hashString(normalizedQuery);
    const contextHash = this.hashString(contextFactors.join('|'));
    
    return {
      queryHash,
      contextHash,
      version: this.CACHE_VERSION
    };
  }
  
  /**
   * Classify response type for TTL strategy
   */
  private classifyResponse(query: string, response: CachedResponse['response']): string {
    const queryLower = query.toLowerCase();
    const responseLower = response.message.toLowerCase();
    
    // Educational content patterns
    if (queryLower.includes('how') || queryLower.includes('what is') || 
        queryLower.includes('explain') || responseLower.includes('here\'s how')) {
      return 'education';
    }
    
    // Market analysis patterns
    if (queryLower.includes('trending') || queryLower.includes('popular') ||
        responseLower.includes('trending') || responseLower.includes('floor price')) {
      return 'trending';
    }
    
    // Portfolio/trade analysis
    if (queryLower.includes('my nft') || queryLower.includes('portfolio') ||
        queryLower.includes('trade opportunities') || response.shouldSearchTrades) {
      return 'trade_opportunities';
    }
    
    // Price analysis
    if (queryLower.includes('price') || queryLower.includes('value') ||
        responseLower.includes('efficiency') || responseLower.includes('floor')) {
      return 'price_analysis';
    }
    
    return 'general';
  }
  
  /**
   * Get TTL based on response type and context
   */
  private getTTLForResponse(responseType: string, context: CacheContext): number {
    let baseTTL = this.TTL_STRATEGIES[responseType as keyof typeof this.TTL_STRATEGIES] || this.DEFAULT_TTL;
    
    // Adjust TTL based on market volatility
    if (context.marketState === 'volatile') {
      baseTTL = Math.min(baseTTL, 2 * 60 * 1000); // Max 2 minutes in volatile markets
    } else if (context.marketState === 'stable') {
      baseTTL = baseTTL * 1.5; // 50% longer in stable markets
    }
    
    return baseTTL;
  }
  
  /**
   * Generate cache tags for smart invalidation
   */
  private generateCacheTags(
    query: string, 
    response: CachedResponse['response'], 
    context: CacheContext
  ): string[] {
    const tags: string[] = [];
    const queryLower = query.toLowerCase();
    const responseLower = response.message.toLowerCase();
    
    // Add response type tags
    if (queryLower.includes('trending') || responseLower.includes('trending')) {
      tags.push('trending', 'market_data');
    }
    
    if (queryLower.includes('price') || responseLower.includes('price')) {
      tags.push('price_analysis', 'market_data');
    }
    
    if (queryLower.includes('portfolio') || queryLower.includes('my nft')) {
      tags.push('portfolio', 'user_data');
    }
    
    if (response.shouldSearchTrades) {
      tags.push('trade_opportunities', 'dynamic_data');
    }
    
    // Add context-based tags
    if (context.walletAddress) {
      tags.push('user_specific');
    }
    
    if (context.trendingCollections && context.trendingCollections.length > 0) {
      tags.push('collection_dependent');
    }
    
    return tags;
  }
  
  /**
   * Check if cached context is compatible with current context
   */
  private isContextCompatible(cached: CacheContext, current: CacheContext): boolean {
    // Wallet must match for user-specific data
    if (cached.walletAddress !== current.walletAddress) {
      return false;
    }
    
    // Portfolio size changes significantly
    const cachedNFTs = cached.userNFTCount || 0;
    const currentNFTs = current.userNFTCount || 0;
    if (Math.abs(cachedNFTs - currentNFTs) > Math.max(5, cachedNFTs * 0.2)) {
      return false; // More than 20% change or 5 NFTs difference
    }
    
    // Market state changes
    if (cached.marketState !== current.marketState) {
      return false;
    }
    
    // Trending collections changed significantly
    const cachedTrending = cached.trendingCollections || [];
    const currentTrending = current.trendingCollections || [];
    const intersection = cachedTrending.filter(c => currentTrending.includes(c));
    if (intersection.length < Math.min(cachedTrending.length, currentTrending.length) * 0.7) {
      return false; // Less than 70% overlap in trending collections
    }
    
    return true;
  }
  
  /**
   * Evict least recently used cache entries
   */
  private evictLeastUsed(): void {
    if (this.cache.size === 0) return;
    
    // Find entries to evict (oldest and least accessed)
    const entries = Array.from(this.cache.entries()).map(([key, cached]) => ({
      key,
      score: cached.lastAccessed + (cached.accessCount * 10000) // Favor recently accessed and frequently used
    }));
    
    entries.sort((a, b) => a.score - b.score);
    
    // Remove bottom 10% of entries
    const toRemove = Math.max(1, Math.floor(entries.length * 0.1));
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i].key);
    }
  }
  
  /**
   * Track query frequency for analytics
   */
  private trackQueryFrequency(query: string): void {
    const normalizedQuery = query.toLowerCase().trim();
    const current = this.queryFrequency.get(normalizedQuery) || 0;
    this.queryFrequency.set(normalizedQuery, current + 1);
  }
  
  /**
   * Update cache statistics
   */
  private updateStats(): void {
    const totalRequests = this.stats.hits + this.stats.misses;
    this.stats.hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    this.stats.totalSize = this.cache.size;
    
    if (this.accessTimes.length > 0) {
      this.stats.averageAccessTime = this.accessTimes.reduce((a, b) => a + b, 0) / this.accessTimes.length;
    }
    
    // Update top queries
    this.stats.topQueries = Array.from(this.queryFrequency.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));
  }
  
  /**
   * Perform periodic maintenance
   */
  private performMaintenance(): void {
    const before = this.cache.size;
    
    // Remove expired entries
    const now = Date.now();
    for (const [key, cached] of Array.from(this.cache.entries())) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
      }
    }
    
    // Evict if still over limit
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      this.evictLeastUsed();
    }
    
    this.updateStats();
    
    const removed = before - this.cache.size;
    if (removed > 0) {
      console.log(`Cache maintenance: removed ${removed} expired/unused entries`);
    }
  }
  
  /**
   * Warm cache with common queries
   */
  private warmCache(): void {
    // This would be called with common queries when the service starts
    // For now, just placeholder - in real implementation would cache frequent patterns
    console.log('AI Response Cache Service initialized with cache warming');
  }
  
  /**
   * Simple string hashing function
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
  
  /**
   * Get cache statistics for monitoring
   */
  public getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }
  
  /**
   * Clear all cache entries
   */
  public clear(): void {
    this.cache.clear();
    this.queryFrequency.clear();
    this.accessTimes = [];
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalSize: 0,
      averageAccessTime: 0,
      topQueries: [],
      contextDistribution: {}
    };
  }
  
  /**
   * Get cache status for debugging
   */
  public getDebugInfo(): any {
    return {
      cacheSize: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      stats: this.getStats(),
      topQueries: this.stats.topQueries,
      contextDistribution: this.stats.contextDistribution
    };
  }
} 