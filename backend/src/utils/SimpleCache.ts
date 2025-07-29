/**
 * A simple in-memory cache with Time-To-Live (TTL) support.
 */
export class SimpleCache<T> {
  private cache = new Map<string, { data: T; expiry: number }>();

  /**
   * Sets a value in the cache.
   * @param key The cache key.
   * @param value The value to cache.
   * @param ttlMs The Time-To-Live in milliseconds.
   */
  set(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, { data: value, expiry: Date.now() + ttlMs });
  }

  /**
   * Gets a value from the cache.
   * Returns null if the key is not found or the item has expired.
   * @param key The cache key.
   */
  get(key: string): T | null {
    const item = this.cache.get(key);
    if (item) {
      if (Date.now() < item.expiry) {
        return item.data;
      }
      // Item expired, delete it
      this.cache.delete(key);
    }
    return null;
  }

  /**
   * Deletes a key from the cache.
   * @param key The cache key to delete.
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clears the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }
} 