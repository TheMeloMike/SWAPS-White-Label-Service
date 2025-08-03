import crypto from 'crypto';
import { LoggingService } from '../logging/LoggingService';

/**
 * Application-level encryption for sensitive data at rest
 * 
 * Provides AES-256-GCM encryption for sensitive data before storage.
 * Uses environment-based encryption keys with automatic key derivation.
 */
export class EncryptionManager {
  private static instance: EncryptionManager;
  private logger = LoggingService.getInstance().createLogger('EncryptionManager');
  
  // Encryption configuration
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly KEY_LENGTH = 32; // 256 bits
  private readonly IV_LENGTH = 16;  // 128 bits
  private readonly TAG_LENGTH = 16; // 128 bits
  private readonly SALT_LENGTH = 32; // 256 bits
  
  private encryptionKey: Buffer | null = null;
  private isInitialized = false;

  private constructor() {
    this.initializeEncryption();
  }

  public static getInstance(): EncryptionManager {
    if (!EncryptionManager.instance) {
      EncryptionManager.instance = new EncryptionManager();
    }
    return EncryptionManager.instance;
  }

  /**
   * Initialize encryption with environment-based key
   */
  private initializeEncryption(): void {
    try {
      const masterKey = process.env.ENCRYPTION_MASTER_KEY;
      
      if (!masterKey) {
        this.logger.warn('No ENCRYPTION_MASTER_KEY found. Encryption disabled.');
        return;
      }

      if (masterKey.length < 32) {
        throw new Error('ENCRYPTION_MASTER_KEY must be at least 32 characters');
      }

      // Derive a consistent encryption key from the master key
      this.encryptionKey = crypto.scryptSync(masterKey, 'swaps-salt-2025', this.KEY_LENGTH);
      this.isInitialized = true;
      
      this.logger.info('Encryption manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize encryption', { error });
      throw error;
    }
  }

  /**
   * Check if encryption is available
   */
  public isEncryptionEnabled(): boolean {
    return this.isInitialized && this.encryptionKey !== null;
  }

  /**
   * Encrypt sensitive data
   */
  public encrypt(data: any): EncryptedData {
    if (!this.isEncryptionEnabled()) {
      throw new Error('Encryption not initialized. Set ENCRYPTION_MASTER_KEY environment variable.');
    }

    try {
      const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      const cipher = crypto.createCipher(this.ALGORITHM, this.encryptionKey!);
      cipher.setAAD(Buffer.from('swaps-aad-2025')); // Additional authenticated data
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();

      return {
        algorithm: this.ALGORITHM,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        data: encrypted,
        timestamp: new Date().toISOString(),
        version: '1.0'
      };
    } catch (error) {
      this.logger.error('Encryption failed', { error });
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   */
  public decrypt(encryptedData: EncryptedData): any {
    if (!this.isEncryptionEnabled()) {
      throw new Error('Encryption not initialized. Set ENCRYPTION_MASTER_KEY environment variable.');
    }

    try {
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');
      
      const decipher = crypto.createDecipher(this.ALGORITHM, this.encryptionKey!);
      decipher.setAAD(Buffer.from('swaps-aad-2025'));
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Try to parse as JSON, fallback to string
      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted;
      }
    } catch (error) {
      this.logger.error('Decryption failed', { error });
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt specific fields in an object
   */
  public encryptFields(data: any, fieldsToEncrypt: string[]): any {
    if (!this.isEncryptionEnabled()) {
      this.logger.warn('Encryption not enabled, returning data unchanged');
      return data;
    }

    const result = { ...data };
    
    fieldsToEncrypt.forEach(field => {
      if (result[field] !== undefined) {
        result[field] = this.encrypt(result[field]);
      }
    });

    return result;
  }

  /**
   * Decrypt specific fields in an object
   */
  public decryptFields(data: any, fieldsToDecrypt: string[]): any {
    if (!this.isEncryptionEnabled()) {
      return data;
    }

    const result = { ...data };
    
    fieldsToDecrypt.forEach(field => {
      if (result[field] && this.isEncryptedData(result[field])) {
        try {
          result[field] = this.decrypt(result[field]);
        } catch (error) {
          this.logger.error(`Failed to decrypt field ${field}`, { error });
          // Keep encrypted data if decryption fails
        }
      }
    });

    return result;
  }

  /**
   * Check if data is encrypted format
   */
  private isEncryptedData(data: any): data is EncryptedData {
    return data && 
           typeof data === 'object' && 
           data.algorithm === this.ALGORITHM &&
           data.iv && 
           data.tag && 
           data.data &&
           data.version;
  }

  /**
   * Hash sensitive data (one-way)
   */
  public hash(data: string): string {
    const salt = crypto.randomBytes(16);
    const hash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha256');
    return salt.toString('hex') + ':' + hash.toString('hex');
  }

  /**
   * Verify hashed data
   */
  public verifyHash(data: string, hash: string): boolean {
    try {
      const [saltHex, hashHex] = hash.split(':');
      const salt = Buffer.from(saltHex, 'hex');
      const expectedHash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha256');
      return expectedHash.toString('hex') === hashHex;
    } catch {
      return false;
    }
  }

  /**
   * Generate a secure master key (for setup)
   */
  public static generateMasterKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  algorithm: string;
  iv: string;        // Initialization vector
  tag: string;       // Authentication tag
  data: string;      // Encrypted data
  timestamp: string; // When encrypted
  version: string;   // Encryption version
}

/**
 * Sensitive data fields that should be encrypted
 */
export const SENSITIVE_FIELDS = {
  API_KEYS: ['apiKey', 'secretKey', 'privateKey'],
  USER_DATA: ['email', 'personalInfo', 'walletPrivateKey'],
  FINANCIAL: ['paymentInfo', 'bankAccount', 'creditCard'],
  TRADE_DATA: ['privateNotes', 'internalComments']
};