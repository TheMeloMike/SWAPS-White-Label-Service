import { createClient, RedisClientType } from 'redis';
import { PersistenceAdapter } from './PersistenceManager';
import { LoggingService } from '../../utils/logging/LoggingService';

/**
 * Redis-based persistence adapter
 * Provides a high-performance alternative to file-based persistence
 */
export class RedisPersistenceAdapter implements PersistenceAdapter {
  private client: RedisClientType;
  private isConnected: boolean = false;
  private readonly logger = LoggingService.getInstance().createLogger('RedisPersistenceAdapter');
  private readonly keyPrefix: string;
  private readonly KEY_TTL_SECONDS: number = 60 * 60 * 24 * 30; // 30 days default
  
  /**
   * Create a new Redis persistence adapter
   * @param options Configuration options
   */
  constructor(options: {
    url?: string;
    keyPrefix?: string;
    keyTtlSeconds?: number;
  } = {}) {
    const url = options.url || process.env.REDIS_URL || 'redis://localhost:6379';
    this.keyPrefix = options.keyPrefix || 'swaps:';
    
    if (options.keyTtlSeconds) {
      this.KEY_TTL_SECONDS = options.keyTtlSeconds;
    }
    
    this.client = createClient({ url });
    
    // Set up error handler
    this.client.on('error', (err) => {
      this.logger.error('Redis client error', { 
        error: err.message,
        stack: err.stack 
      });
    });
    
    this.logger.info('Redis persistence adapter initialized', { 
      url,
      keyPrefix: this.keyPrefix 
    });
  }
  
  /**
   * Connect to Redis if not already connected
   */
  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.client.connect();
        this.isConnected = true;
        this.logger.info('Connected to Redis server');
      } catch (error) {
        this.logger.error('Failed to connect to Redis', { 
          error: error instanceof Error ? error.message : String(error) 
        });
        throw error;
      }
    }
  }
  
  /**
   * Formats a key with the prefix for consistency
   */
  private formatKey(key: string): string {
    // Make sure the key is compatible with Redis
    // Replace characters that might cause issues with ':'
    const sanitizedKey = key.replace(/[^a-zA-Z0-9_:-]/g, ':');
    return `${this.keyPrefix}${sanitizedKey}`;
  }
  
  /**
   * Save data to Redis
   * @param key The key to store the data under
   * @param data The data to store
   */
  public async saveData<T>(key: string, data: T): Promise<void> {
    await this.ensureConnection();
    const redisKey = this.formatKey(key);
    
    try {
      // Convert data to JSON string for storage
      const jsonData = JSON.stringify(data, this.replacer);
      
      // Store in Redis with TTL
      await this.client.set(redisKey, jsonData, {
        EX: this.KEY_TTL_SECONDS
      });
      
      this.logger.info('Data saved to Redis', { key: redisKey });
    } catch (error) {
      this.logger.error('Error saving data to Redis', { 
        key: redisKey,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }
  
  /**
   * Load data from Redis
   * @param key The key to load the data from
   * @param defaultValue The default value to return if the key doesn't exist
   */
  public async loadData<T>(key: string, defaultValue: T): Promise<T> {
    await this.ensureConnection();
    const redisKey = this.formatKey(key);
    
    try {
      // Retrieve data from Redis
      const jsonData = await this.client.get(redisKey);
      
      // If no data found, return default value
      if (!jsonData) {
        this.logger.info('No data found in Redis, returning default value', { key: redisKey });
        return defaultValue;
      }
      
      // Reset TTL on read to keep frequently used data longer
      await this.client.expire(redisKey, this.KEY_TTL_SECONDS);
      
      // Parse JSON data
      return JSON.parse(jsonData, this.reviver) as T;
    } catch (error) {
      this.logger.error('Error loading data from Redis', { 
        key: redisKey,
        error: error instanceof Error ? error.message : String(error) 
      });
      return defaultValue;
    }
  }
  
  /**
   * Alias for saveData to satisfy the interface
   */
  public async setData<T>(key: string, data: T): Promise<void> {
    return this.saveData(key, data);
  }
  
  /**
   * Alias for loadData to satisfy the interface
   */
  public async getData<T>(key: string, defaultValue: T): Promise<T> {
    return this.loadData(key, defaultValue);
  }
  
  /**
   * Delete data from Redis
   * @param key The key to delete
   */
  public async deleteData(key: string): Promise<void> {
    await this.ensureConnection();
    const redisKey = this.formatKey(key);
    
    try {
      await this.client.del(redisKey);
      this.logger.info('Data deleted from Redis', { key: redisKey });
    } catch (error) {
      this.logger.error('Error deleting data from Redis', { 
        key: redisKey,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }
  
  /**
   * Lists all keys with a given prefix
   * @param prefix The prefix to search for
   * @returns Array of keys
   */
  public async listKeys(prefix: string): Promise<string[]> {
    await this.ensureConnection();
    const redisKeyPattern = this.formatKey(prefix) + '*';
    
    try {
      const keys = await this.client.keys(redisKeyPattern);
      
      // Remove the keyPrefix from the keys to match the expected format
      return keys.map(key => key.replace(this.keyPrefix, ''));
    } catch (error) {
      this.logger.error('Error listing keys from Redis', { 
        pattern: redisKeyPattern,
        error: error instanceof Error ? error.message : String(error) 
      });
      return [];
    }
  }
  
  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      try {
        await this.client.quit();
        this.isConnected = false;
        this.logger.info('Disconnected from Redis server');
      } catch (error) {
        this.logger.error('Error disconnecting from Redis', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
  }
  
  /**
   * Custom replacer function to handle Set and Map objects during serialization
   */
  private replacer(key: string, value: any): any {
    if (value instanceof Set) {
      return {
        dataType: 'Set',
        value: Array.from(value)
      };
    } else if (value instanceof Map) {
      return {
        dataType: 'Map',
        value: Array.from(value.entries())
      };
    } else if (value instanceof Date) {
      return {
        dataType: 'Date',
        value: value.toISOString()
      };
    }
    return value;
  }
  
  /**
   * Custom reviver function to restore Set and Map objects during deserialization
   */
  private reviver(key: string, value: any): any {
    if (value && typeof value === 'object') {
      if (value.dataType === 'Set') {
        return new Set(value.value);
      } else if (value.dataType === 'Map') {
        return new Map(value.value);
      } else if (value.dataType === 'Date') {
        return new Date(value.value);
      }
    }
    return value;
  }
} 