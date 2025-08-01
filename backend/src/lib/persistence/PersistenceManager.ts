import * as fs from 'fs';
import * as path from 'path';
import { LoggingService } from '../../utils/logging/LoggingService';
import { RedisPersistenceAdapter } from './RedisPersistenceAdapter';

// Interface for persistence adapters to allow swapping implementations
export interface PersistenceAdapter {
  saveData<T>(key: string, data: T): Promise<void>;
  loadData<T>(key: string, defaultValue: T): Promise<T>;
  setData(key: string, data: any): Promise<void>;
  getData<T>(key: string, defaultValue: T): Promise<T>;
  deleteData(key: string): Promise<void>;
  listKeys?(prefix: string): Promise<string[]>;
}

/**
 * Manages persistence of data to disk or other storage backends
 * Provides a simple key-value store backed by configurable storage
 */
export class PersistenceManager {
  private static instance: PersistenceManager;
  private dataDir: string;
  private isEnabled: boolean;
  private adapter: PersistenceAdapter | null = null;
  private useAdapter: boolean = false;
  private logger = LoggingService.getInstance().createLogger('PersistenceManager');
  
  private constructor() {
    // Explicitly parse the environment variable with fallback to false
    this.isEnabled = process.env.ENABLE_PERSISTENCE === 'true';
    this.dataDir = process.env.DATA_DIR || path.join(__dirname, '../../../data');
    
    this.logger.info(`Persistence ${this.isEnabled ? 'ENABLED' : 'DISABLED'}, using directory: ${this.dataDir}`);
    
    // Sanitize environment variable logging
    const sanitizedEnv = {
      ENABLE_PERSISTENCE: process.env.ENABLE_PERSISTENCE,
      DATA_DIR: process.env.DATA_DIR ? '[SET]' : '[NOT_SET]'
    };
    this.logger.info('Environment configuration loaded', sanitizedEnv);
    
    // Check if we should use Redis
    if (process.env.USE_REDIS === 'true') {
      this.configureRedis();
    } else {
      // Create the data directory for file-based persistence if enabled
      if (this.isEnabled) {
        try {
          // Use async-await pattern for file operations for better performance
          this.createDataDirAsync().catch(err => {
            this.logger.error('Failed to create data directory asynchronously:', err);
            this.isEnabled = false;
            this.logger.error('DISABLING PERSISTENCE due to directory creation failure');
          });
        } catch (error) {
          this.logger.error('Failed to create data directory:', { 
            error: error instanceof Error ? error.message : String(error) 
          });
          // If we can't create the directory, we can't persist data
          this.isEnabled = false;
          this.logger.error('DISABLING PERSISTENCE due to directory creation failure');
        }
      }
    }
  }
  
  /**
   * Create data directory asynchronously
   */
  private async createDataDirAsync(): Promise<void> {
    try {
      // Check if directory exists using async API
      try {
        await fs.promises.access(this.dataDir);
      } catch (error) {
        // Directory doesn't exist, create it
        await fs.promises.mkdir(this.dataDir, { recursive: true });
        this.logger.info(`Created data directory: ${this.dataDir}`);
      }
    } catch (error) {
      this.logger.error('Error creating data directory:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }
  
  /**
   * Configure Redis as the persistence backend
   */
  public configureRedis(options: {
    url?: string;
    keyPrefix?: string;
    keyTtlSeconds?: number;
  } = {}): void {
    try {
      this.logger.info('Configuring Redis persistence backend');
      const redisAdapter = new RedisPersistenceAdapter(options);
      this.adapter = redisAdapter;
      this.useAdapter = true;
      this.isEnabled = true;
      this.logger.info('Redis persistence adapter configured successfully');
    } catch (error) {
      this.logger.error('Failed to configure Redis persistence adapter:', {
        error: error instanceof Error ? error.message : String(error)
      });
      // Fall back to file-based persistence
      this.adapter = null;
      this.useAdapter = false;
      this.logger.warn('Falling back to file-based persistence due to Redis configuration error');
    }
  }
  
  public static getInstance(): PersistenceManager {
    if (!PersistenceManager.instance) {
      PersistenceManager.instance = new PersistenceManager();
    }
    return PersistenceManager.instance;
  }
  
  /**
   * Configure the manager to use a custom adapter for testing
   */
  public static configureForTesting(adapter: PersistenceAdapter): void {
    const instance = PersistenceManager.getInstance();
    instance.adapter = adapter;
    instance.useAdapter = true;
    instance.logger.info('PersistenceManager configured for testing with custom adapter');
  }
  
  /**
   * Reset to use the default file system persistence
   */
  public static resetToDefault(): void {
    const instance = PersistenceManager.getInstance();
    instance.adapter = null;
    instance.useAdapter = false;
    instance.logger.info('PersistenceManager reset to default file system persistence');
  }
  
  /**
   * Set whether persistence is enabled or disabled
   * @param enabled Whether persistence should be enabled
   */
  public setEnabled(enabled: boolean): void {
    // Hard override - prioritize the method call over environment variable
    this.isEnabled = enabled;
    this.logger.info(`Persistence FORCEFULLY ${enabled ? 'ENABLED' : 'DISABLED'} via setEnabled()`);
    
    // If using adapter, no need to create directory
    if (this.useAdapter) {
      return;
    }
    
    // Create the data directory async if enabling
    if (enabled) {
      this.createDataDirAsync().catch(err => {
        this.logger.error('Failed to create data directory:', { 
          error: err instanceof Error ? err.message : String(err) 
        });
        this.isEnabled = false;
        this.logger.error('DISABLING PERSISTENCE due to directory creation failure');
      });
    }
  }
  
  /**
   * Check if persistence is enabled
   * @returns Whether persistence is enabled
   */
  public getIsEnabled(): boolean {
    return this.isEnabled;
  }
  
  /**
   * Save data to storage
   * @param key The key to store the data under
   * @param data The data to store
   */
  public async saveData<T>(key: string, data: T): Promise<void> {
    // If using an adapter, delegate to it
    if (this.useAdapter && this.adapter) {
      return this.adapter.saveData(key, data);
    }
    
    if (!this.isEnabled) {
      this.logger.info(`Persistence is disabled, skipping save for key: ${key}`);
      return;
    }
    
    try {
      const filePath = path.join(this.dataDir, `${key}.json`);
      const jsonData = JSON.stringify(data, this.replacer);
      await fs.promises.writeFile(filePath, jsonData);
      this.logger.info(`Data saved to ${filePath}`);
    } catch (error) {
      this.logger.error(`Error saving data to ${key}:`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }
  
  /**
   * Load data from storage
   * @param key The key to load the data from
   * @param defaultValue The default value to return if the file doesn't exist
   */
  public async loadData<T>(key: string, defaultValue: T): Promise<T> {
    // If using an adapter, delegate to it
    if (this.useAdapter && this.adapter) {
      return this.adapter.loadData(key, defaultValue);
    }
    
    if (!this.isEnabled) {
      this.logger.info(`Persistence is disabled, returning default value for key: ${key}`);
      return defaultValue;
    }
    
    try {
      const filePath = path.join(this.dataDir, `${key}.json`);
      
      // Check if the file exists using async API
      try {
        await fs.promises.access(filePath);
      } catch (error) {
        this.logger.info(`No data file found at ${filePath}, returning default value for key: ${key}`);
        return defaultValue;
      }
      
      const jsonData = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(jsonData, this.reviver) as T;
    } catch (error) {
      this.logger.error(`Error loading data from ${key}:`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return defaultValue;
    }
  }
  
  /**
   * Sets data in the store
   * @param key The key to store the data under
   * @param data The data to store
   */
  public async setData<T>(key: string, data: T): Promise<void> {
    // If using an adapter, delegate to it
    if (this.useAdapter && this.adapter) {
      return this.adapter.setData(key, data);
    }
    
    return this.saveData(key, data);
  }
  
  /**
   * Gets data from the store
   * @param key The key to get the data from
   * @param defaultValue The default value to return if the key doesn't exist
   */
  public async getData<T>(key: string, defaultValue: T): Promise<T> {
    // If using an adapter, delegate to it
    if (this.useAdapter && this.adapter) {
      return this.adapter.getData(key, defaultValue);
    }
    
    return this.loadData(key, defaultValue);
  }
  
  /**
   * Deletes data from the store
   * @param key The key to delete
   */
  public async deleteData(key: string): Promise<void> {
    // If using an adapter, delegate to it
    if (this.useAdapter && this.adapter) {
      return this.adapter.deleteData(key);
    }
    
    if (!this.isEnabled) {
      this.logger.info('Persistence is disabled, skipping delete');
      return;
    }
    
    try {
      const filePath = path.join(this.dataDir, `${key}.json`);
      
      // Check if the file exists using async API
      try {
        await fs.promises.access(filePath);
        await fs.promises.unlink(filePath);
        this.logger.info(`Deleted data file: ${filePath}`);
      } catch (error) {
        this.logger.info(`No data file found at ${filePath}`);
      }
    } catch (error) {
      this.logger.error(`Error deleting data from ${key}:`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
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
  
  /**
   * Lists all keys with the given prefix
   * @param prefix The prefix to filter keys by
   * @returns Array of keys
   */
  public async listKeys(prefix: string): Promise<string[]> {
    // If using an adapter that implements listKeys, delegate to it
    if (this.useAdapter && this.adapter && this.adapter.listKeys) {
      return this.adapter.listKeys(prefix);
    }
    
    try {
      // Return empty array if persistence is disabled
      if (!this.isEnabled) {
        this.logger.info('Persistence is disabled, returning empty array');
        return [];
      }
      
      // Make sure data directory exists using async API
      try {
        await fs.promises.access(this.dataDir);
      } catch (error) {
        await fs.promises.mkdir(this.dataDir, { recursive: true });
      }
      
      // Get all files in the directory using async API
      const files = await fs.promises.readdir(this.dataDir);
      
      // Filter and transform to keys
      const keys = files
        .filter(file => file.startsWith(prefix.replace(/:/g, '_')))
        .map(file => file.replace(/\.json$/, '').replace(/_/g, ':'));
      
      return keys;
    } catch (error) {
      this.logger.error('Error listing keys:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return [];
    }
  }
} 