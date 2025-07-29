/**
 * Simple file-based persistence utility to store and retrieve trade system state between server restarts
 */

import fs from 'fs';
import path from 'path';

export class PersistenceManager {
  private static instance: PersistenceManager;
  private dataDir: string;
  private isEnabled: boolean;
  
  private constructor() {
    // Check if persistence is enabled via environment variable
    this.isEnabled = process.env.ENABLE_PERSISTENCE === 'true';
    
    // Set up the data directory for persistence files
    this.dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    
    // Create the data directory if it doesn't exist
    if (this.isEnabled && !fs.existsSync(this.dataDir)) {
      try {
        fs.mkdirSync(this.dataDir, { recursive: true });
        console.log(`Created data directory at ${this.dataDir}`);
      } catch (error) {
        console.error('Failed to create data directory, persistence will be disabled:', error);
        this.isEnabled = false;
      }
    }
    
    console.log(`Persistence ${this.isEnabled ? 'enabled' : 'disabled'}, using directory: ${this.dataDir}`);
  }
  
  public static getInstance(): PersistenceManager {
    if (!PersistenceManager.instance) {
      PersistenceManager.instance = new PersistenceManager();
    }
    return PersistenceManager.instance;
  }
  
  /**
   * Saves data to a persistent file
   * @param key The key to identify this data
   * @param data The data to save
   */
  public async saveData<T>(key: string, data: T): Promise<void> {
    if (!this.isEnabled) {
      console.log(`Persistence disabled, not saving data for key: ${key}`);
      return;
    }
    
    try {
      const filePath = path.join(this.dataDir, `${key}.json`);
      
      // Convert Maps and Sets to serializable format
      const serializedData = this.serialize(data);
      
      // Write the data to the file
      await fs.promises.writeFile(
        filePath,
        JSON.stringify(serializedData, null, 2),
        'utf8'
      );
      
      console.log(`Saved data for key: ${key}`);
    } catch (error) {
      console.error(`Error saving data for key ${key}:`, error);
    }
  }
  
  /**
   * Loads data from a persistent file
   * @param key The key to identify the data
   * @param defaultValue The default value to return if no data is found
   * @returns The loaded data or the default value
   */
  public async loadData<T>(key: string, defaultValue: T): Promise<T> {
    if (!this.isEnabled) {
      console.log(`Persistence disabled, returning default value for key: ${key}`);
      return defaultValue;
    }
    
    try {
      const filePath = path.join(this.dataDir, `${key}.json`);
      
      // Check if the file exists
      if (!fs.existsSync(filePath)) {
        console.log(`No data found for key: ${key}, returning default value`);
        return defaultValue;
      }
      
      // Read the file
      const fileData = await fs.promises.readFile(filePath, 'utf8');
      
      // Parse the JSON data
      const jsonData = JSON.parse(fileData);
      
      // Convert serialized format back to Maps and Sets
      const deserializedData = this.deserialize(jsonData);
      
      console.log(`Loaded data for key: ${key}`);
      return deserializedData as T;
    } catch (error) {
      console.error(`Error loading data for key ${key}:`, error);
      return defaultValue;
    }
  }
  
  /**
   * Serializes objects with Maps and Sets for JSON storage
   */
  private serialize(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    // Handle Map objects
    if (obj instanceof Map) {
      return {
        __type: 'Map',
        data: Array.from(obj.entries()).map(([key, value]) => ({
          key,
          value: this.serialize(value)
        }))
      };
    }
    
    // Handle Set objects
    if (obj instanceof Set) {
      return {
        __type: 'Set',
        data: Array.from(obj).map(item => this.serialize(item))
      };
    }
    
    // Handle Date objects
    if (obj instanceof Date) {
      return {
        __type: 'Date',
        data: obj.toISOString()
      };
    }
    
    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => this.serialize(item));
    }
    
    // Handle objects
    if (typeof obj === 'object') {
      const serialized: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        serialized[key] = this.serialize(value);
      }
      return serialized;
    }
    
    // Return primitive values as-is
    return obj;
  }
  
  /**
   * Deserializes objects with Maps and Sets from JSON storage
   */
  private deserialize(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    // Handle serialized Map objects
    if (obj.__type === 'Map' && Array.isArray(obj.data)) {
      const map = new Map();
      for (const item of obj.data) {
        map.set(item.key, this.deserialize(item.value));
      }
      return map;
    }
    
    // Handle serialized Set objects
    if (obj.__type === 'Set' && Array.isArray(obj.data)) {
      const set = new Set();
      for (const item of obj.data) {
        set.add(this.deserialize(item));
      }
      return set;
    }
    
    // Handle serialized Date objects
    if (obj.__type === 'Date' && typeof obj.data === 'string') {
      return new Date(obj.data);
    }
    
    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => this.deserialize(item));
    }
    
    // Handle objects
    if (typeof obj === 'object') {
      const deserialized: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        deserialized[key] = this.deserialize(value);
      }
      return deserialized;
    }
    
    // Return primitive values as-is
    return obj;
  }
  
  /**
   * Deletes a persistence file
   * @param key The key of the data to delete
   */
  public async deleteData(key: string): Promise<void> {
    if (!this.isEnabled) {
      return;
    }
    
    try {
      const filePath = path.join(this.dataDir, `${key}.json`);
      
      // Check if the file exists
      if (!fs.existsSync(filePath)) {
        return;
      }
      
      // Delete the file
      await fs.promises.unlink(filePath);
      console.log(`Deleted data for key: ${key}`);
    } catch (error) {
      console.error(`Error deleting data for key ${key}:`, error);
    }
  }
  
  /**
   * Alias for saveData to provide a more consistent naming convention
   * @param key The key to identify this data
   * @param data The data to save
   */
  public async setData<T>(key: string, data: T): Promise<void> {
    return this.saveData<T>(key, data);
  }
} 