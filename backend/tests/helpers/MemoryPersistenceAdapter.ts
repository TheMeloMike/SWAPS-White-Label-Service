import { PersistenceAdapter } from '../../src/lib/persistence/PersistenceManager';

/**
 * In-memory persistence adapter for testing
 * This adapter implements the PersistenceAdapter interface but stores data in memory
 */
export class MemoryPersistenceAdapter implements PersistenceAdapter {
  private storage: Map<string, string> = new Map();
  
  /**
   * Save data to in-memory storage
   */
  public async saveData<T>(key: string, data: T): Promise<void> {
    try {
      const serializedData = JSON.stringify(data, this.jsonReplacer);
      this.storage.set(key, serializedData);
      console.log(`[Memory Storage] Data saved for key: ${key}`);
    } catch (error) {
      console.error(`[Memory Storage] Error saving data for key ${key}:`, error);
      throw error;
    }
  }
  
  /**
   * Load data from in-memory storage
   */
  public async loadData<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const serializedData = this.storage.get(key);
      
      if (!serializedData) {
        console.log(`[Memory Storage] No data found for key: ${key}, returning default value`);
        return defaultValue;
      }
      
      return JSON.parse(serializedData, this.jsonReviver);
    } catch (error) {
      console.error(`[Memory Storage] Error loading data for key ${key}:`, error);
      return defaultValue;
    }
  }
  
  /**
   * Set data for a key (alias for saveData)
   */
  public async setData(key: string, data: any): Promise<void> {
    return this.saveData(key, data);
  }
  
  /**
   * Get data for a key (alias for loadData)
   */
  public async getData<T>(key: string, defaultValue: T): Promise<T> {
    return this.loadData(key, defaultValue);
  }
  
  /**
   * Delete data for a key
   */
  public async deleteData(key: string): Promise<void> {
    try {
      if (this.storage.has(key)) {
        this.storage.delete(key);
        console.log(`[Memory Storage] Deleted data for key: ${key}`);
      } else {
        console.log(`[Memory Storage] No data found for key: ${key}`);
      }
    } catch (error) {
      console.error(`[Memory Storage] Error deleting data for key ${key}:`, error);
      throw error;
    }
  }
  
  /**
   * Clear all data in the storage
   */
  public async clearAll(): Promise<void> {
    this.storage.clear();
    console.log('[Memory Storage] All data cleared');
  }
  
  /**
   * Custom JSON replacer to handle Maps and Sets
   */
  private jsonReplacer(key: string, value: any): any {
    if (value instanceof Map) {
      return {
        dataType: 'Map',
        value: Array.from(value.entries())
      };
    } else if (value instanceof Set) {
      return {
        dataType: 'Set',
        value: Array.from(value.values())
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
   * Custom JSON reviver to reconstruct Maps and Sets
   */
  private jsonReviver(key: string, value: any): any {
    if (typeof value === 'object' && value !== null) {
      if (value.dataType === 'Map') {
        return new Map(value.value);
      } else if (value.dataType === 'Set') {
        return new Set(value.value);
      } else if (value.dataType === 'Date') {
        return new Date(value.value);
      }
    }
    return value;
  }
} 