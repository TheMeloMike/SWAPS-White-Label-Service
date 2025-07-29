/**
 * A simple but effective caching utility for API responses and computed data
 * This helps improve frontend performance by avoiding redundant API calls
 * and expensive calculations.
 */

interface CacheItem<T> {
  data: T;
  expiry: number;
  createdAt?: number; // Add optional timestamp for cache item creation
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  storageType?: 'memory' | 'session' | 'local';
  keyPrefix?: string;
}

class Cache {
  private memoryCache: Map<string, CacheItem<any>> = new Map();
  private defaultTTL: number = 5 * 60 * 1000; // 5 minutes default TTL
  private keyPrefix: string = 'swaps_cache_';

  /**
   * Get an item from the cache
   * 
   * @param key Cache key
   * @param options Caching options
   * @returns The cached data or null if not found or expired
   */
  get<T>(key: string, options?: CacheOptions): T | null {
    const { storageType = 'memory', keyPrefix = this.keyPrefix } = options || {};
    const fullKey = `${keyPrefix}${key}`;
    
    // Get from memory cache
    if (storageType === 'memory') {
      const item = this.memoryCache.get(key);
      
      if (!item) return null;
      
      // Check if the item is expired
      if (item.expiry < Date.now()) {
        this.memoryCache.delete(key);
        return null;
      }
      
      return item.data;
    }
    
    // Get from browser storage
    const storage = storageType === 'local' ? localStorage : sessionStorage;
    const jsonItem = storage.getItem(fullKey);
    
    if (!jsonItem) return null;
    
    try {
      const item: CacheItem<T> = JSON.parse(jsonItem);
      
      // Check if the item is expired
      if (item.expiry < Date.now()) {
        storage.removeItem(fullKey);
        return null;
      }
      
      return item.data;
    } catch (e) {
      // Invalid JSON - remove it
      storage.removeItem(fullKey);
      return null;
    }
  }

  /**
   * Set an item in the cache
   * 
   * @param key Cache key
   * @param data Data to cache
   * @param options Caching options
   */
  set<T>(key: string, data: T, options?: CacheOptions): void {
    const { 
      ttl = this.defaultTTL, 
      storageType = 'memory',
      keyPrefix = this.keyPrefix
    } = options || {};
    
    const fullKey = `${keyPrefix}${key}`;
    const now = Date.now();
    const expiry = now + ttl;
    const item: CacheItem<T> = { data, expiry, createdAt: now };
    
    if (storageType === 'memory') {
      this.memoryCache.set(key, item);
      return;
    }
    
    // Store in browser storage
    const storage = storageType === 'local' ? localStorage : sessionStorage;
    
    try {
      storage.setItem(fullKey, JSON.stringify(item));
    } catch (e) {
      // Storage might be full - clear some space by removing oldest items
      this.clearOldest(storage, 10, keyPrefix);
      
      try {
        storage.setItem(fullKey, JSON.stringify(item));
      } catch (e) {
        console.warn('Cache storage is full, unable to store item');
      }
    }
  }

  /**
   * Get the age of a cached item in milliseconds
   * 
   * @param key Cache key
   * @param options Caching options
   * @returns Age of the cached item in milliseconds, or null if not found
   */
  getAge(key: string, options?: CacheOptions): number | null {
    const { storageType = 'memory', keyPrefix = this.keyPrefix } = options || {};
    const fullKey = `${keyPrefix}${key}`;
    const now = Date.now();
    
    // Get from memory cache
    if (storageType === 'memory') {
      const item = this.memoryCache.get(key);
      
      if (!item) return null;
      
      // Check if the item is expired
      if (item.expiry < now) {
        this.memoryCache.delete(key);
        return null;
      }
      
      // If createdAt is available, use it to calculate age
      if (item.createdAt) {
        return now - item.createdAt;
      }
      
      // Otherwise estimate age based on expiry and ttl
      const estimatedTtl = item.expiry - now;
      const estimatedCreation = item.expiry - this.defaultTTL;
      return now - estimatedCreation;
    }
    
    // Get from browser storage
    const storage = storageType === 'local' ? localStorage : sessionStorage;
    const jsonItem = storage.getItem(fullKey);
    
    if (!jsonItem) return null;
    
    try {
      const item: CacheItem<any> = JSON.parse(jsonItem);
      
      // Check if the item is expired
      if (item.expiry < now) {
        storage.removeItem(fullKey);
        return null;
      }
      
      // If createdAt is available, use it to calculate age
      if (item.createdAt) {
        return now - item.createdAt;
      }
      
      // Otherwise estimate age based on expiry and default ttl
      const estimatedCreation = item.expiry - this.defaultTTL;
      return now - estimatedCreation;
    } catch (e) {
      // Invalid JSON - remove it
      storage.removeItem(fullKey);
      return null;
    }
  }

  /**
   * Remove an item from the cache
   * 
   * @param key Cache key
   * @param options Caching options
   */
  remove(key: string, options?: CacheOptions): void {
    const { storageType = 'memory', keyPrefix = this.keyPrefix } = options || {};
    const fullKey = `${keyPrefix}${key}`;
    
    if (storageType === 'memory') {
      this.memoryCache.delete(key);
      return;
    }
    
    const storage = storageType === 'local' ? localStorage : sessionStorage;
    storage.removeItem(fullKey);
  }

  /**
   * Clear all items from the cache that match the prefix
   * 
   * @param options Caching options
   */
  clear(options?: CacheOptions): void {
    const { storageType = 'memory', keyPrefix = this.keyPrefix } = options || {};
    
    if (storageType === 'memory') {
      this.memoryCache.clear();
      return;
    }
    
    const storage = storageType === 'local' ? localStorage : sessionStorage;
    
    // Remove all items with matching prefix
    Object.keys(storage).forEach(key => {
      if (key.startsWith(keyPrefix)) {
        storage.removeItem(key);
      }
    });
  }

  /**
   * Check if an item exists in the cache and is not expired
   * 
   * @param key Cache key
   * @param options Caching options
   * @returns true if the item exists and is not expired
   */
  has(key: string, options?: CacheOptions): boolean {
    return this.get(key, options) !== null;
  }

  /**
   * Clear expired items from the cache
   * 
   * @param options Caching options
   */
  clearExpired(options?: CacheOptions): void {
    const { storageType = 'memory', keyPrefix = this.keyPrefix } = options || {};
    const now = Date.now();
    
    if (storageType === 'memory') {
      this.memoryCache.forEach((item, key) => {
        if (item.expiry < now) {
          this.memoryCache.delete(key);
        }
      });
      return;
    }
    
    const storage = storageType === 'local' ? localStorage : sessionStorage;
    
    // Remove expired items with matching prefix
    Object.keys(storage).forEach(key => {
      if (key.startsWith(keyPrefix)) {
        try {
          const item: CacheItem<any> = JSON.parse(storage.getItem(key) || '');
          if (item.expiry < now) {
            storage.removeItem(key);
          }
        } catch (e) {
          // Invalid JSON - remove it
          storage.removeItem(key);
        }
      }
    });
  }

  /**
   * Clear the oldest items from storage to make room for new items
   * 
   * @param storage Storage object (localStorage or sessionStorage)
   * @param count Number of items to remove
   * @param keyPrefix Key prefix to match
   */
  private clearOldest(storage: Storage, count: number, keyPrefix: string): void {
    const items: Array<{ key: string; expiry: number }> = [];
    
    // Find all items with matching prefix
    Object.keys(storage).forEach(key => {
      if (key.startsWith(keyPrefix)) {
        try {
          const item: CacheItem<any> = JSON.parse(storage.getItem(key) || '');
          items.push({ key, expiry: item.expiry });
        } catch (e) {
          // Invalid JSON - remove it
          storage.removeItem(key);
        }
      }
    });
    
    // Sort by expiry (oldest first)
    items.sort((a, b) => a.expiry - b.expiry);
    
    // Remove the oldest items
    items.slice(0, count).forEach(item => {
      storage.removeItem(item.key);
    });
  }
}

// Export a singleton instance
const cache = new Cache();
export default cache; 