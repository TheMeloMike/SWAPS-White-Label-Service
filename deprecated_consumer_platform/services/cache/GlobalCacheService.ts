import { injectable, singleton } from 'tsyringe';
import { SimpleCache } from '../../utils/SimpleCache';
import { ICacheService } from '../../types/services';

@singleton() // Ensure this service is a singleton
@injectable()
export class GlobalCacheService implements ICacheService {
  // Use a generic type for the cache, or specify <any> if mixed types are stored.
  // For specific well-known keys, type safety is handled at get/set.
  private cache = new SimpleCache<any>();

  constructor() {
    // Logging can be added here if an ILoggingService is injected
    console.log('[Init] GlobalCacheService initialized');
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, value, ttlMs);
  }

  get<T>(key: string): T | null {
    return this.cache.get(key) as T | null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
} 