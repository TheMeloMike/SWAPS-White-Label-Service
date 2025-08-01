import { Kafka, Producer, Consumer, EachMessagePayload, KafkaMessage } from 'kafkajs';
import { ScalableTradeLoopFinderService } from './ScalableTradeLoopFinderService';
import { TradeDiscoveryService } from './TradeDiscoveryService';
import { NFTService } from '../nft/NFTService';
import { NFTPricingService } from '../nft/NFTPricingService';
import { TradeLoop, WalletState } from '../../types/trade';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interface for Trade Discovery Message
 */
interface TradeDiscoveryMessage {
  walletAddress: string;
  desiredNft: string;
  forceRefresh: boolean;
  timestamp: number;
}

// Maximum retry attempts for message processing
const MAX_RETRIES = 3;
// Initial backoff delay in ms (will be multiplied by 2^retryCount)
const INITIAL_RETRY_DELAY = 500;
// Types of retryable errors (can be expanded)
const RETRYABLE_ERROR_TYPES = [
  'TimeoutError',
  'ServiceUnavailableError',
  'RateLimitError',
  'NetworkError',
  'ConnectionError'
];

/**
 * Service to integrate with Kafka for distributed processing and real-time updates
 * This enables horizontal scaling of the trade loop discovery process across multiple nodes
 */
export class KafkaIntegrationService {
  private static instance: KafkaIntegrationService;
  
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private tradeDiscoveryService: TradeDiscoveryService;
  private scalableTradeLoopFinder: ScalableTradeLoopFinderService;
  private nftService: NFTService;
  private nftPricingService: NFTPricingService;
  private isConnected: boolean = false;
  private useLocalFallback: boolean = false;
  private logger: Logger;
  
  // Topics
  private readonly WALLET_UPDATES_TOPIC = 'swaps-wallet-updates';
  private readonly NFT_UPDATES_TOPIC = 'swaps-nft-updates';
  private readonly TRADE_DISCOVERY_TOPIC = 'swaps-trade-discovery';
  private readonly BATCHED_TRADE_DISCOVERY_TOPIC = 'swaps-batched-trade-discovery';
  private readonly TRADE_RESULTS_TOPIC = 'swaps-trade-results';
  private readonly DEAD_LETTER_QUEUE_TOPIC: string; // DLQ for failed messages
  
  // Constants
  private readonly BATCH_SEND_TIMEOUT_MS = 5000; // 5 seconds timeout for batch sends
  private readonly MESSAGE_BATCH_SIZE = 100; // Max number of messages per batch
  
  // Error tracking
  private messageRetryMap: Map<string, number> = new Map();
  private inProcessingMessages: Set<string> = new Set();
  
  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('KafkaIntegration');
    
    // Get Kafka broker URLs from environment or use default
    const brokers = process.env.KAFKA_BROKERS 
      ? process.env.KAFKA_BROKERS.split(',') 
      : ['localhost:9092'];
    
    const clientId = process.env.KAFKA_CLIENT_ID || 'swaps-trade-service';
    
    this.logger.info('Initializing Kafka integration', {
      clientId,
      brokers,
      groupId: process.env.KAFKA_CONSUMER_GROUP || 'swaps-trade-group'
    });
    
    this.kafka = new Kafka({
      clientId,
      brokers,
      retry: {
        initialRetryTime: 100,
        retries: 2 // Reduce retries for faster fallback
      }
    });
    
    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true
    });
    
    this.consumer = this.kafka.consumer({ 
      groupId: process.env.KAFKA_CONSUMER_GROUP || 'swaps-trade-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });
    
    // Initialize services
    this.tradeDiscoveryService = TradeDiscoveryService.getInstance();
    this.scalableTradeLoopFinder = ScalableTradeLoopFinderService.getInstance();
    this.nftService = NFTService.getInstance();
    this.nftPricingService = NFTPricingService.getInstance();
    
    // Configure DLQ topic from environment or use default
    this.DEAD_LETTER_QUEUE_TOPIC = process.env.KAFKA_DLQ_TOPIC || 'swaps-dlq';
  }
  
  public static getInstance(): KafkaIntegrationService {
    if (!KafkaIntegrationService.instance) {
      KafkaIntegrationService.instance = new KafkaIntegrationService();
    }
    return KafkaIntegrationService.instance;
  }
  
  /**
   * Connect to Kafka and set up consumers with timeout
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      this.logger.info('Already connected to Kafka');
      return;
    }
    
    try {
      const operation = this.logger.operation('connect');
      operation.info('Connecting to Kafka');
      
      // Add timeout wrapper for connection attempts
      const connectionTimeout = 5000; // 5 seconds
      
      await Promise.race([
        this.producer.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Producer connection timeout')), connectionTimeout)
        )
      ]);
      operation.info('Producer connected');
      
      await Promise.race([
        this.consumer.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Consumer connection timeout')), connectionTimeout)
        )
      ]);
      operation.info('Consumer connected');
      
      // Subscribe to topics
      const topics = [
        this.WALLET_UPDATES_TOPIC,
        this.NFT_UPDATES_TOPIC,
        this.TRADE_DISCOVERY_TOPIC,
        this.BATCHED_TRADE_DISCOVERY_TOPIC
      ];
      
      await this.consumer.subscribe({ topics });
      operation.info('Subscribed to topics', { topics });
      
      // Set up message handlers with improved error handling
      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          const { topic, message, partition } = payload;
          if (!message.value) return;
          
          const operation = this.logger.operation('handleMessage');
          
          // Generate a unique ID for this message if it doesn't have one
          const messageId = message.key?.toString() || uuidv4();
          
          operation.info('Received message', { 
            topic, 
            partition,
            messageId,
            size: message.value.length
          });
          
          // Check if message is already being processed (avoid duplicates)
          if (this.inProcessingMessages.has(messageId)) {
            operation.info('Message already being processed, skipping', { messageId });
            operation.end();
            return;
          }
          
          // Mark as in processing
          this.inProcessingMessages.add(messageId);
          
          try {
            // Process the message with retry capability
            await this.processMessageWithRetries(topic, message, messageId);
            
            operation.info('Successfully processed message', { topic, messageId });
          } catch (error) {
            // If we reach here, all retries have been exhausted
            operation.error('Failed to process message after all retries', {
              topic,
              messageId,
              error: error instanceof Error ? error.message : String(error)
            });
            
            // Send to DLQ
            await this.sendToDLQ(topic, message, error);
          } finally {
            // Clear processing state
            this.inProcessingMessages.delete(messageId);
            this.messageRetryMap.delete(messageId);
            operation.end();
          }
        }
      });
      
      this.isConnected = true;
      this.useLocalFallback = false;
      operation.info('Kafka connection and subscription setup complete');
      operation.end();
    } catch (error) {
      this.logger.error('Failed to connect to Kafka', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // If Kafka isn't available, we'll fall back to non-distributed mode
      this.isConnected = false;
      this.useLocalFallback = true;
      this.logger.warn('Falling back to non-distributed processing mode');
    }
  }
  
  /**
   * Disconnect from Kafka
   */
  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      this.logger.info('Not connected to Kafka, nothing to disconnect');
      return;
    }
    
    try {
      const operation = this.logger.operation('disconnect');
      operation.info('Disconnecting from Kafka');
      
      await this.consumer.disconnect();
      operation.info('Consumer disconnected');
      
      await this.producer.disconnect();
      operation.info('Producer disconnected');
      
      this.isConnected = false;
      
      operation.info('Fully disconnected from Kafka');
      operation.end();
    } catch (error) {
      this.logger.error('Error disconnecting from Kafka', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }
  
  /**
   * Check if Kafka is available for distributed processing
   */
  public isAvailable(): boolean {
    return this.isConnected && !this.useLocalFallback;
  }
  
  /**
   * Send a trade discovery request to be processed by any available node
   */
  public async requestTradeDiscovery(
    walletAddress: string,
    desiredNft: string,
    forceRefresh: boolean = false
  ): Promise<void> {
    const operation = this.logger.operation('requestTradeDiscovery');
    
    if (!this.isConnected) {
      operation.info('Kafka not connected, processing trade discovery locally', {
        wallet: walletAddress,
        nft: desiredNft
      });
      operation.end();
      return;
    }
    
    try {
      const message = {
        walletAddress,
        desiredNft,
        forceRefresh,
        timestamp: Date.now()
      };
      
      operation.info('Sending trade discovery request', {
        wallet: walletAddress,
        nft: desiredNft,
        forceRefresh
      });
      
      await this.producer.send({
        topic: this.TRADE_DISCOVERY_TOPIC,
        messages: [{
          key: walletAddress,
          value: JSON.stringify(message)
        }]
      });
      
      operation.info('Trade discovery request sent successfully');
      operation.end();
    } catch (error) {
      operation.error('Failed to send trade discovery request', {
        wallet: walletAddress,
        nft: desiredNft,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      operation.end();
      throw error;
    }
  }
  
  /**
   * Send batched trade discovery jobs to Kafka
   */
  public async sendBatchedTradeDiscoveryJobs(
    messages: TradeDiscoveryMessage[]
  ): Promise<void> {
    const operation = this.logger.operation('sendBatchedTradeDiscoveryJobs');
    
    if (!this.isConnected) {
      operation.info('Kafka not connected, cannot send batched jobs', {
        messageCount: messages.length
      });
      operation.end();
      return;
    }
    
    if (messages.length === 0) {
      operation.info('No messages to send');
      operation.end();
      return;
    }
    
    try {
      operation.info('Sending batched trade discovery jobs', {
        messageCount: messages.length
      });
      
      // Split into chunks to avoid message size limits
      const chunkedMessages = this.chunkArray(messages, this.MESSAGE_BATCH_SIZE);
      operation.info('Split into batch chunks', { chunkCount: chunkedMessages.length });
      
      // Send each chunk as a single Kafka message
      for (let i = 0; i < chunkedMessages.length; i++) {
        const chunk = chunkedMessages[i];
        const batchId = `batch-${Date.now()}-${i}`;
        
        await this.producer.send({
          topic: this.BATCHED_TRADE_DISCOVERY_TOPIC,
          messages: [{
            key: batchId,
            value: JSON.stringify(chunk)
          }]
        });
        
        operation.info('Sent batch chunk', {
          batchId,
          chunkIndex: i,
          messageCount: chunk.length
        });
      }
      
      operation.info('All batched trade discovery jobs sent successfully');
      operation.end();
    } catch (error) {
      operation.error('Failed to send batched trade discovery jobs', {
        messageCount: messages.length,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      operation.end();
      throw error;
    }
  }
  
  /**
   * Publish trade results to Kafka for real-time updates
   */
  public async publishTradeResults(
    walletAddress: string,
    tradeLoops: TradeLoop[]
  ): Promise<void> {
    const operation = this.logger.operation('publishTradeResults');
    
    if (!this.isConnected) {
      operation.info('Kafka not connected, skipping results publishing', {
        wallet: walletAddress,
        tradeCount: tradeLoops.length
      });
      operation.end();
      return;
    }
    
    try {
      operation.info('Publishing trade results', {
        wallet: walletAddress,
        tradeCount: tradeLoops.length
      });
      
      await this.producer.send({
        topic: this.TRADE_RESULTS_TOPIC,
        messages: [{
          key: walletAddress,
          value: JSON.stringify({
            walletAddress,
            tradeLoops,
            timestamp: Date.now()
          })
        }]
      });
      
      operation.info('Trade results published successfully');
      operation.end();
    } catch (error) {
      operation.error('Failed to publish trade results', {
        wallet: walletAddress,
        tradeCount: tradeLoops.length,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
    }
  }
  
  /**
   * Publish wallet update event to Kafka
   */
  public async publishWalletUpdate(
    walletAddress: string,
    updateType: 'add' | 'remove' | 'update'
  ): Promise<void> {
    const operation = this.logger.operation('publishWalletUpdate');
    
    if (!this.isConnected) {
      operation.info('Kafka not connected, skipping wallet update publishing', {
        wallet: walletAddress,
        updateType
      });
      operation.end();
      return;
    }
    
    try {
      operation.info('Publishing wallet update', {
        wallet: walletAddress,
        updateType
      });
      
      await this.producer.send({
        topic: this.WALLET_UPDATES_TOPIC,
        messages: [{
          key: walletAddress,
          value: JSON.stringify({
            walletAddress,
            updateType,
            timestamp: Date.now()
          })
        }]
      });
      
      operation.info('Wallet update published successfully');
      operation.end();
    } catch (error) {
      operation.error('Failed to publish wallet update', {
        wallet: walletAddress,
        updateType,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
    }
  }
  
  /**
   * Publish NFT update event to Kafka
   */
  public async publishNFTUpdate(
    nftAddress: string,
    ownerAddress: string,
    updateType: 'add' | 'remove' | 'transfer'
  ): Promise<void> {
    const operation = this.logger.operation('publishNFTUpdate');
    
    if (!this.isConnected) {
      operation.info('Kafka not connected, skipping NFT update publishing', {
        nft: nftAddress,
        owner: ownerAddress,
        updateType
      });
      operation.end();
      return;
    }
    
    try {
      operation.info('Publishing NFT update', {
        nft: nftAddress,
        owner: ownerAddress,
        updateType
      });
      
      await this.producer.send({
        topic: this.NFT_UPDATES_TOPIC,
        messages: [{
          key: nftAddress,
          value: JSON.stringify({
            nftAddress,
            ownerAddress,
            updateType,
            timestamp: Date.now()
          })
        }]
      });
      
      operation.info('NFT update published successfully');
      operation.end();
    } catch (error) {
      operation.error('Failed to publish NFT update', {
        nft: nftAddress,
        owner: ownerAddress,
        updateType,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
    }
  }
  
  /**
   * Handle wallet update events from Kafka
   */
  private async handleWalletUpdate(data: any): Promise<void> {
    const { walletAddress, updateType } = data;
    const operation = this.logger.operation('handleWalletUpdate');
    
    operation.info('Processing wallet update', {
      wallet: walletAddress,
      updateType
    });
    
    try {
      switch (updateType) {
        case 'add':
          operation.info('Wallet added', { wallet: walletAddress });
          this.scalableTradeLoopFinder.walletAdded(walletAddress);
          break;
        case 'remove':
          operation.info('Wallet removed', { wallet: walletAddress });
          this.scalableTradeLoopFinder.walletRemoved(walletAddress);
          break;
        case 'update':
          operation.info('Wallet updated', { wallet: walletAddress });
          this.scalableTradeLoopFinder.walletUpdated(walletAddress);
          break;
        default:
          operation.warn('Unknown wallet update type', { 
            wallet: walletAddress,
            updateType
          });
      }
      
      operation.info('Wallet update processed successfully');
    } catch (error) {
      operation.error('Error processing wallet update', {
        wallet: walletAddress,
        updateType,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      operation.end();
    }
  }
  
  /**
   * Handle NFT update events from Kafka
   */
  private async handleNFTUpdate(data: any): Promise<void> {
    const { nftAddress, ownerAddress, updateType } = data;
    const operation = this.logger.operation('handleNFTUpdate');
    
    operation.info('Processing NFT update', {
      nft: nftAddress,
      owner: ownerAddress,
      updateType
    });
    
    try {
      // This will eventually trigger wallet update events as well
      switch (updateType) {
        case 'add':
          operation.info('NFT added', { nft: nftAddress, owner: ownerAddress });
          if (ownerAddress) {
            this.scalableTradeLoopFinder.walletUpdated(ownerAddress);
          }
          break;
        case 'transfer':
          operation.info('NFT transferred', { nft: nftAddress, owner: ownerAddress });
          if (ownerAddress) {
            this.scalableTradeLoopFinder.walletUpdated(ownerAddress);
            
            // We should also have previous owner information, but in case we don't
            // we'll rely on the NFT service to find who previously owned it
            const previousOwner = data.previousOwner;
            if (previousOwner && previousOwner !== ownerAddress) {
              this.scalableTradeLoopFinder.walletUpdated(previousOwner);
            }
          }
          break;
        case 'remove':
          operation.info('NFT removed', { nft: nftAddress, owner: ownerAddress });
          if (ownerAddress) {
            this.scalableTradeLoopFinder.walletUpdated(ownerAddress);
          }
          break;
        default:
          operation.warn('Unknown NFT update type', { 
            nft: nftAddress,
            updateType
          });
      }
      
      operation.info('NFT update processed successfully');
    } catch (error) {
      operation.error('Error processing NFT update', {
        nft: nftAddress,
        owner: ownerAddress,
        updateType,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      operation.end();
    }
  }
  
  /**
   * Handle trade discovery requests from Kafka
   */
  private async handleTradeDiscoveryRequest(data: any): Promise<void> {
    const { walletAddress, desiredNft, forceRefresh } = data;
    const operation = this.logger.operation('handleTradeDiscoveryRequest');
    
    operation.info('Processing trade discovery request', {
      wallet: walletAddress,
      nft: desiredNft,
      forceRefresh: Boolean(forceRefresh)
    });
    
    try {
      const startTime = Date.now();
      
      // Process the trade discovery request
      await this.tradeDiscoveryService.addTradePreference(walletAddress, desiredNft);
      
      // Update wallet state
      if (forceRefresh) {
        await this.tradeDiscoveryService.forceRefreshWalletState(walletAddress);
      } else {
        await this.tradeDiscoveryService.updateWalletState(walletAddress);
      }
      
      // Log time taken to update wallet state
      const walletUpdateTime = Date.now() - startTime;
      operation.info('Wallet state updated', {
        wallet: walletAddress,
        timeMs: walletUpdateTime
      });
      
      // Get all the necessary data for trade discovery
      const wallets = this.tradeDiscoveryService.getWallets();
      const wantedNfts = this.tradeDiscoveryService.getWantedNfts();
      const rejectionPreferences = this.tradeDiscoveryService.getRejectionPreferences();
      
      // Get NFT ownership data and convert to Map
      // First check if direct access to the map is available
      let nftOwnership = new Map<string, string>();
      
      try {
        // Try to get the NFT ownership map directly if available
        const ownershipMap = (this.tradeDiscoveryService as any).getNFTOwnershipMap?.();
        
        if (ownershipMap && typeof ownershipMap === 'object') {
          // Convert the ownership record back to a Map for the trade finder
          for (const [nft, owner] of Object.entries(ownershipMap)) {
            nftOwnership.set(nft, owner as string);
          }
          
          operation.info('Retrieved NFT ownership map', {
            nftCount: nftOwnership.size
          });
        } else {
          // Fallback to iterating through wallets to build ownership map
          for (const [walletAddr, walletState] of wallets.entries()) {
            for (const nft of walletState.ownedNfts) {
              nftOwnership.set(nft, walletAddr);
            }
          }
          
          operation.info('Built NFT ownership map from wallets', {
            nftCount: nftOwnership.size
          });
        }
      } catch (error) {
        operation.warn('Error retrieving NFT ownership, building from wallets', {
          error: error instanceof Error ? error.message : String(error)
        });
        
        // Fallback to iterating through wallets
        for (const [walletAddr, walletState] of wallets.entries()) {
          for (const nft of walletState.ownedNfts) {
            nftOwnership.set(nft, walletAddr);
          }
        }
      }
      
      // Record timing for trade discovery
      const tradeDiscoveryStartTime = Date.now();
      
      // Use the wallet-specific trade finder to optimize for a specific wallet
      operation.info('Finding trade loops for wallet', {
        wallet: walletAddress,
        walletCount: wallets.size,
        nftCount: nftOwnership.size,
        wantedNftCount: wantedNfts.size
      });
      
      const trades = await this.scalableTradeLoopFinder.findTradeLoopsForWallet(
        walletAddress,
        wallets,
        nftOwnership,
        wantedNfts,
        rejectionPreferences
      );
      
      const tradeDiscoveryTime = Date.now() - tradeDiscoveryStartTime;
      operation.info('Trade loops found', {
        wallet: walletAddress,
        tradeCount: trades.length,
        timeMs: tradeDiscoveryTime
      });
      
      // Publish the results back to Kafka
      await this.publishTradeResults(walletAddress, trades);
      
      const totalTime = Date.now() - startTime;
      operation.info('Trade discovery request completed', {
        wallet: walletAddress,
        totalTimeMs: totalTime,
        walletUpdateTimeMs: walletUpdateTime,
        tradeDiscoveryTimeMs: tradeDiscoveryTime,
        tradesFound: trades.length
      });
    } catch (error) {
      operation.error('Error processing trade discovery request', {
        wallet: walletAddress,
        nft: desiredNft,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    } finally {
      operation.end();
    }
  }
  
  /**
   * Utility method to chunk an array into smaller pieces
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
  
  /**
   * Process a message with retries and exponential backoff
   */
  private async processMessageWithRetries(
    topic: string, 
    message: KafkaMessage, 
    messageId: string
  ): Promise<void> {
    // Get current retry count (default to 0)
    const retryCount = this.messageRetryMap.get(messageId) || 0;
    
    try {
      const data = JSON.parse(message.value!.toString());
      
      switch(topic) {
        case this.WALLET_UPDATES_TOPIC:
          await this.handleWalletUpdate(data);
          break;
        case this.NFT_UPDATES_TOPIC:
          await this.handleNFTUpdate(data);
          break;
        case this.TRADE_DISCOVERY_TOPIC:
          await this.handleTradeDiscoveryRequest(data);
          break;
        case this.BATCHED_TRADE_DISCOVERY_TOPIC:
          if (Array.isArray(data)) {
            this.logger.info('Processing batched trade discovery jobs', {
              count: data.length,
              messageId
            });
            for (const item of data) {
              await this.handleTradeDiscoveryRequest(item);
            }
          } else {
            this.logger.warn('Invalid batch format for BATCHED_TRADE_DISCOVERY_TOPIC', {
              dataType: typeof data,
              messageId
            });
          }
          break;
        default:
          this.logger.warn('Received message for unhandled topic', { topic, messageId });
      }
      
      // If we get here, processing was successful
      this.logger.info('Message processed successfully', { topic, messageId, retryCount });
      
    } catch (error) {
      // Determine if this error is retryable
      const isRetryable = this.isRetryableError(error);
      
      // If retry limit reached or non-retryable error, rethrow to trigger DLQ
      if (retryCount >= MAX_RETRIES || !isRetryable) {
        this.logger.error('Maximum retries reached or non-retryable error', { 
          topic,
          messageId,
          retryCount,
          isRetryable,
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
      
      // Log retry attempt
      this.logger.warn('Error processing message, will retry', {
        topic,
        messageId,
        retryCount: retryCount + 1,
        maxRetries: MAX_RETRIES,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Calculate backoff delay using exponential backoff
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      
      // Increment retry count
      this.messageRetryMap.set(messageId, retryCount + 1);
      
      // Wait for backoff period
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Retry recursively
      await this.processMessageWithRetries(topic, message, messageId);
    }
  }
  
  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Check if it's a known retryable error type
    if (error instanceof Error) {
      if (RETRYABLE_ERROR_TYPES.includes(error.constructor.name)) {
        return true;
      }
      
      // Check for network-like errors
      if (error.message.includes('network') || 
          error.message.includes('timeout') || 
          error.message.includes('connection') ||
          error.message.includes('throttle') ||
          error.message.includes('rate limit')) {
        return true;
      }
    }
    
    // If it's a 5xx server error
    if (error && error.status && error.status >= 500 && error.status < 600) {
      return true;
    }
    
    // Default to true for unknown errors
    return true;
  }
  
  /**
   * Send a failed message to the Dead-Letter Queue
   */
  private async sendToDLQ(topic: string, message: KafkaMessage, error: any): Promise<void> {
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      this.logger.info('Sending message to DLQ', { 
        sourceTopic: topic,
        dlqTopic: this.DEAD_LETTER_QUEUE_TOPIC
      });
      
      // Prepare DLQ message with metadata
      const dlqMessage = {
        originalMessage: message.value ? message.value.toString() : '',
        originalTopic: topic,
        error: errorMessage,
        errorStack,
        timestamp: new Date().toISOString()
      };
      
      // Send to DLQ
      await this.producer.send({
        topic: this.DEAD_LETTER_QUEUE_TOPIC,
        messages: [{
          key: message.key,
          value: JSON.stringify(dlqMessage)
        }]
      });
      
      this.logger.info('Message sent to DLQ successfully', { 
        sourceTopic: topic,
        dlqTopic: this.DEAD_LETTER_QUEUE_TOPIC
      });
    } catch (dlqError) {
      // If even the DLQ send fails, log it but don't throw (nothing more we can do)
      this.logger.error('Failed to send message to DLQ', {
        sourceTopic: topic,
        dlqTopic: this.DEAD_LETTER_QUEUE_TOPIC,
        error: dlqError instanceof Error ? dlqError.message : String(dlqError)
      });
    }
  }
} 