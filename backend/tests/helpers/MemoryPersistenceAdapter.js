const { PersistenceAdapter } = require('../../src/lib/persistence/PersistenceManager');

/**
 * In-memory persistence adapter for testing
 * This adapter implements the PersistenceAdapter interface but stores data in memory
 */
class MemoryPersistenceAdapter {
  constructor() {
    this.storage = new Map();
  }
  
  /**
   * Save data to in-memory storage
   */
  async saveData(key, data) {
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
  async loadData(key, defaultValue) {
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
  async setData(key, data) {
    return this.saveData(key, data);
  }
  
  /**
   * Get data for a key (alias for loadData)
   */
  async getData(key, defaultValue) {
    return this.loadData(key, defaultValue);
  }
  
  /**
   * Delete data for a key
   */
  async deleteData(key) {
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
  async clearAll() {
    this.storage.clear();
    console.log('[Memory Storage] All data cleared');
  }
  
  /**
   * Custom JSON replacer to handle Maps and Sets
   */
  jsonReplacer(key, value) {
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
  jsonReviver(key, value) {
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

module.exports = { MemoryPersistenceAdapter }; 