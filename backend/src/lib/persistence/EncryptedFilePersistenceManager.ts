import fs from 'fs/promises';
import path from 'path';
import { LoggingService } from '../../utils/logging/LoggingService';
import { EncryptionManager, SENSITIVE_FIELDS } from '../../utils/security/EncryptionManager';

/**
 * File persistence manager with automatic encryption for sensitive data
 * 
 * Extends the basic file persistence to automatically encrypt sensitive fields
 * before writing to disk and decrypt when reading.
 */
export class EncryptedFilePersistenceManager {
  private logger = LoggingService.getInstance().createLogger('EncryptedPersistence');
  private encryption = EncryptionManager.getInstance();
  private dataDir: string;

  constructor(dataDir: string = './data') {
    this.dataDir = dataDir;
    this.ensureDataDirectory();
  }

  /**
   * Ensure data directory exists
   */
  private async ensureDataDirectory(): Promise<void> {
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
      this.logger.info(`Created data directory: ${this.dataDir}`);
    }
  }

  /**
   * Save data with automatic encryption of sensitive fields
   */
  async saveSecure<T>(filename: string, data: T, sensitiveFields?: string[]): Promise<void> {
    try {
      const filePath = path.join(this.dataDir, filename);
      
      // Determine which fields to encrypt
      const fieldsToEncrypt = sensitiveFields || this.getSensitiveFields(filename);
      
      // Encrypt sensitive fields if encryption is enabled
      let processedData = data;
      if (this.encryption.isEncryptionEnabled() && fieldsToEncrypt.length > 0) {
        processedData = this.encryptSensitiveData(data, fieldsToEncrypt);
        this.logger.debug(`Encrypted ${fieldsToEncrypt.length} sensitive fields in ${filename}`);
      }

      // Add metadata
      const fileData = {
        metadata: {
          created: new Date().toISOString(),
          encrypted: this.encryption.isEncryptionEnabled(),
          encryptedFields: fieldsToEncrypt,
          version: '2.0'
        },
        data: processedData
      };

      await fs.writeFile(filePath, JSON.stringify(fileData, null, 2), 'utf8');
      this.logger.debug(`Saved encrypted data to ${filename}`);
    } catch (error) {
      this.logger.error(`Failed to save secure data to ${filename}`, { error });
      throw error;
    }
  }

  /**
   * Load data with automatic decryption of sensitive fields
   */
  async loadSecure<T>(filename: string): Promise<T | null> {
    try {
      const filePath = path.join(this.dataDir, filename);
      
      try {
        await fs.access(filePath);
      } catch {
        return null; // File doesn't exist
      }

      const fileContent = await fs.readFile(filePath, 'utf8');
      const fileData = JSON.parse(fileContent);

      // Handle legacy files without metadata
      if (!fileData.metadata) {
        this.logger.warn(`Legacy file format detected: ${filename}`);
        return fileData as T;
      }

      let data = fileData.data;

      // Decrypt if necessary
      if (fileData.metadata.encrypted && fileData.metadata.encryptedFields) {
        if (this.encryption.isEncryptionEnabled()) {
          data = this.decryptSensitiveData(data, fileData.metadata.encryptedFields);
          this.logger.debug(`Decrypted ${fileData.metadata.encryptedFields.length} fields in ${filename}`);
        } else {
          this.logger.warn(`File ${filename} is encrypted but encryption is disabled`);
          throw new Error('Cannot read encrypted file without encryption key');
        }
      }

      return data;
    } catch (error) {
      this.logger.error(`Failed to load secure data from ${filename}`, { error });
      throw error;
    }
  }

  /**
   * Save tenant data with automatic field encryption
   */
  async saveTenantData(tenantId: string, data: any): Promise<void> {
    const filename = `tenant_${tenantId}.json`;
    const sensitiveFields = ['apiKey', 'secretKey', 'webhookSecret', 'privateConfig'];
    await this.saveSecure(filename, data, sensitiveFields);
  }

  /**
   * Load tenant data with automatic field decryption
   */
  async loadTenantData(tenantId: string): Promise<any | null> {
    const filename = `tenant_${tenantId}.json`;
    return await this.loadSecure(filename);
  }

  /**
   * Save NFT data (potentially with private metadata)
   */
  async saveNFTData(data: any): Promise<void> {
    const sensitiveFields = ['privateMetadata', 'ownerNotes', 'internalComments'];
    await this.saveSecure('nftOwnership.json', data, sensitiveFields);
  }

  /**
   * Save trade data with encryption
   */
  async saveTradeData(data: any): Promise<void> {
    const sensitiveFields = ['privateNotes', 'internalData', 'participantEmails'];
    await this.saveSecure('trades.json', data, sensitiveFields);
  }

  /**
   * Backup and rotate encrypted files
   */
  async backupFile(filename: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${filename}.backup.${timestamp}`;
    
    try {
      const sourcePath = path.join(this.dataDir, filename);
      const backupPath = path.join(this.dataDir, 'backups', backupName);
      
      // Ensure backup directory exists
      await fs.mkdir(path.join(this.dataDir, 'backups'), { recursive: true });
      
      await fs.copyFile(sourcePath, backupPath);
      this.logger.info(`Created backup: ${backupName}`);
      return backupPath;
    } catch (error) {
      this.logger.error(`Failed to backup ${filename}`, { error });
      throw error;
    }
  }

  /**
   * Encrypt sensitive data in an object
   */
  private encryptSensitiveData(data: any, fieldsToEncrypt: string[]): any {
    if (Array.isArray(data)) {
      return data.map(item => this.encryptSensitiveData(item, fieldsToEncrypt));
    }

    if (typeof data === 'object' && data !== null) {
      return this.encryption.encryptFields(data, fieldsToEncrypt);
    }

    return data;
  }

  /**
   * Decrypt sensitive data in an object
   */
  private decryptSensitiveData(data: any, fieldsToDecrypt: string[]): any {
    if (Array.isArray(data)) {
      return data.map(item => this.decryptSensitiveData(item, fieldsToDecrypt));
    }

    if (typeof data === 'object' && data !== null) {
      return this.encryption.decryptFields(data, fieldsToDecrypt);
    }

    return data;
  }

  /**
   * Determine sensitive fields based on filename
   */
  private getSensitiveFields(filename: string): string[] {
    if (filename.includes('tenant')) {
      return SENSITIVE_FIELDS.API_KEYS;
    }
    if (filename.includes('user') || filename.includes('wallet')) {
      return SENSITIVE_FIELDS.USER_DATA;
    }
    if (filename.includes('trade')) {
      return SENSITIVE_FIELDS.TRADE_DATA;
    }
    if (filename.includes('payment') || filename.includes('billing')) {
      return SENSITIVE_FIELDS.FINANCIAL;
    }
    return [];
  }

  /**
   * Migrate existing plain text files to encrypted format
   */
  async migrateToEncrypted(filename: string, sensitiveFields: string[]): Promise<void> {
    try {
      this.logger.info(`Migrating ${filename} to encrypted format`);
      
      // Backup original
      await this.backupFile(filename);
      
      // Load as plain text
      const filePath = path.join(this.dataDir, filename);
      const content = JSON.parse(await fs.readFile(filePath, 'utf8'));
      
      // Save with encryption
      await this.saveSecure(filename, content, sensitiveFields);
      
      this.logger.info(`Migration completed for ${filename}`);
    } catch (error) {
      this.logger.error(`Migration failed for ${filename}`, { error });
      throw error;
    }
  }

  /**
   * Health check for encryption system
   */
  async performHealthCheck(): Promise<EncryptionHealthCheck> {
    const result: EncryptionHealthCheck = {
      encryptionEnabled: this.encryption.isEncryptionEnabled(),
      dataDirectoryExists: false,
      testEncryptionWorking: false,
      filesNeedingMigration: [],
      timestamp: new Date().toISOString()
    };

    try {
      // Check data directory
      await fs.access(this.dataDir);
      result.dataDirectoryExists = true;

      // Test encryption if enabled
      if (result.encryptionEnabled) {
        const testData = { test: 'encryption-test' };
        const encrypted = this.encryption.encrypt(testData);
        const decrypted = this.encryption.decrypt(encrypted);
        result.testEncryptionWorking = JSON.stringify(testData) === JSON.stringify(decrypted);
      }

      // Check for files that might need migration
      const files = await fs.readdir(this.dataDir);
      for (const file of files) {
        if (file.endsWith('.json') && !file.includes('backup')) {
          const content = await fs.readFile(path.join(this.dataDir, file), 'utf8');
          const data = JSON.parse(content);
          if (!data.metadata || !data.metadata.version) {
            result.filesNeedingMigration.push(file);
          }
        }
      }

    } catch (error) {
      this.logger.error('Encryption health check failed', { error });
    }

    return result;
  }
}

export interface EncryptionHealthCheck {
  encryptionEnabled: boolean;
  dataDirectoryExists: boolean;
  testEncryptionWorking: boolean;
  filesNeedingMigration: string[];
  timestamp: string;
}