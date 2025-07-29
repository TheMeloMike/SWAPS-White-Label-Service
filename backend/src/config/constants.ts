/**
 * Application-wide constants
 * 
 * Centralizes all magic strings and numbers for easier maintenance and clarity
 */

/**
 * NFT-related constants
 */
export const NFT = {
  /**
   * Cache time-to-live in milliseconds
   */
  CACHE: {
    METADATA_TTL_MS: 30 * 60 * 1000, // 30 minutes
    PRICE_TTL_MS: 15 * 60 * 1000,    // 15 minutes
    CLEANUP_INTERVAL_MS: 10 * 60 * 1000, // 10 minutes
  },
  
  /**
   * API limits for NFT batch operations
   */
  API: {
    DEFAULT_BATCH_SIZE: 20,
    MAX_BATCH_SIZE: 50,
    MAX_USER_OWNED_NFTS: 100,
    HELIUS_BATCH_LIMIT: 100,
    DEFAULT_CONCURRENCY: 5,
    HIGH_CONCURRENCY: 10,
  },
  
  /**
   * Placeholders and default values
   */
  PLACEHOLDERS: {
    NFT_NAME_PREFIX: 'NFT ',
    DEFAULT_SYMBOL: 'NFT',
    DESCRIPTION_UNAVAILABLE: 'NFT metadata unavailable',
    NOT_FOUND_MESSAGE: 'NFT not found',
    BATCH_ERROR_MESSAGE: 'NFT metadata batch fetch failed',
  }
};

/**
 * Trade-related constants
 */
export const TRADE = {
  /**
   * Status values for trades
   */
  STATUS: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  },
  
  /**
   * Default algorithm parameters
   */
  ALGORITHM: {
    DEFAULT_MAX_DEPTH: 7,
    DEFAULT_MIN_EFFICIENCY: 0.7,
    DEFAULT_GLOBAL_TIMEOUT_MS: 30000,
    MAX_SCC_CONCURRENCY: 4,
    MAX_CYCLES_DENSE_GRAPH: 500,
    DEFAULT_API_CONCURRENCY: 10,
  },
  
  /**
   * Timeouts and retry settings
   */
  TIMEOUTS: {
    DEFAULT_RETRY_COUNT: 3,
    EXPONENTIAL_BACKOFF_BASE_MS: 500,
  }
};

/**
 * HTTP-related constants
 */
export const HTTP = {
  STATUS: {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TIMEOUT: 408,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
  },
};

/**
 * Kafka-related constants
 */
export const KAFKA = {
  TOPICS: {
    WALLET_UPDATES: 'wallet-updates',
    NFT_UPDATES: 'nft-updates',
    TRADE_EVENTS: 'trade-events',
    DEAD_LETTER_QUEUE: 'dead-letter-queue',
  },
  
  CONSUMER_GROUPS: {
    WALLET_PROCESSOR: 'wallet-processor',
    NFT_PROCESSOR: 'nft-processor',
    TRADE_PROCESSOR: 'trade-processor',
  },
};

/**
 * Environment-specific constants
 */
export const ENVIRONMENT = {
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_TEST: process.env.NODE_ENV === 'test',
}; 