import { promises as fs } from 'fs';
import path from 'path';
import { IPersistenceManager } from '../../types/services';
import { injectable, inject } from 'tsyringe';
import { ILoggingService } from '../../types/services';

/**
 * Persistence manager that uses the filesystem for storage
 * Implements async file operations for better performance
 */
@injectable()
export class FilePersistenceManager implements IPersistenceManager {
  private dataDir: string;
  private logger: any;

  /**
   * Constructor with dependency injection
   */
  constructor(
    @inject("ILoggingService") loggingService: ILoggingService
  ) {
    this.logger = loggingService.createLogger('FilePersistenceManager');
    
    // Set data directory - can be configured via env var
    this.dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    
    // Ensure the data directory exists
    this.ensureDataDir();
  }

  /**
   * Ensure the data directory exists
   * @private
   */
  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create data directory', {
        dir: this.dataDir,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get the file path for a key
   * @param key The storage key
   * @returns The full file path
   */
  private getFilePath(key: string): string {
    // Sanitize the key to make it a valid filename
    const sanitizedKey = key.replace(/[^\w.-]/g, '_');
    return path.join(this.dataDir, `${sanitizedKey}.json`);
  }

  /**
   * Save data to the filesystem
   * @param key The storage key
   * @param data The data to save
   */
  public async saveData<T>(key: string, data: T): Promise<void> {
    const operation = this.logger.operation('saveData');
    
    try {
      const filePath = this.getFilePath(key);
      operation.info('Saving data to file', { key, filePath });
      
      await this.ensureDataDir();
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
      
      operation.info('Data saved successfully', { key });
      operation.end();
    } catch (error) {
      operation.error('Failed to save data', {
        key,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Load data from the filesystem
   * @param key The storage key
   * @returns The loaded data or null if not found
   */
  public async loadData<T>(key: string): Promise<T | null> {
    const operation = this.logger.operation('loadData');
    
    try {
      const filePath = this.getFilePath(key);
      operation.info('Loading data from file', { key, filePath });
      
      const data = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(data) as T;
      
      operation.info('Data loaded successfully', { key });
      operation.end();
      return parsed;
    } catch (error) {
      // File not found or other error
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        operation.info('Data not found', { key });
        operation.end();
        return null;
      }
      
      operation.error('Failed to load data', {
        key,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      operation.end();
      return null;
    }
  }

  /**
   * Check if data exists
   * @param key The storage key
   * @returns True if the data exists
   */
  public async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete data from the filesystem
   * @param key The storage key
   */
  public async deleteData(key: string): Promise<void> {
    const operation = this.logger.operation('deleteData');
    
    try {
      const filePath = this.getFilePath(key);
      operation.info('Deleting data file', { key, filePath });
      
      await fs.unlink(filePath);
      
      operation.info('Data deleted successfully', { key });
      operation.end();
    } catch (error) {
      // If file doesn't exist, consider deletion successful
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        operation.info('Data not found for deletion', { key });
        operation.end();
        return;
      }
      
      operation.error('Failed to delete data', {
        key,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      operation.end();
      throw error;
    }
  }
} 