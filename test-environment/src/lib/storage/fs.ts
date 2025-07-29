import { TestEnvironmentData, StorageConfig } from './types';

export class StorageManager {
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  async saveEnvironmentData(data: TestEnvironmentData): Promise<void> {
    try {
      const fullPath = `${this.config.outputDir}/${this.config.filename}`;
      await fs.writeFile(
        fullPath,
        JSON.stringify(data, null, 2)
      );
    } catch (error) {
      console.error('Error saving environment data:', error);
      throw error;
    }
  }

  async loadEnvironmentData(): Promise<TestEnvironmentData | null> {
    try {
      const fullPath = `${this.config.outputDir}/${this.config.filename}`;
      const data = await fs.readFile(fullPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading environment data:', error);
      return null;
    }
  }
} 