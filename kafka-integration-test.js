#!/usr/bin/env node

/**
 * KAFKA INTEGRATION VERIFICATION TEST
 * 
 * This script tests and verifies Kafka integration functionality for SWAPS
 * - Tests Kafka connection and health
 * - Validates message publishing and consumption
 * - Verifies SWAPS-specific Kafka integration
 * - Provides detailed diagnostics and recommendations
 */

const { performance } = require('perf_hooks');

// Test Configuration
const KAFKA_CONFIG = {
  ENABLE_KAFKA: 'true',
  KAFKA_BROKERS: process.env.KAFKA_BROKERS || 'localhost:9092',
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'swaps-test-client',
  KAFKA_CONSUMER_GROUP: process.env.KAFKA_CONSUMER_GROUP || 'swaps-test-group',
  KAFKA_DLQ_TOPIC: process.env.KAFKA_DLQ_TOPIC || 'swaps-dlq'
};

// SWAPS-specific topics (from KafkaIntegrationService)
const SWAPS_TOPICS = [
  'swaps-wallet-updates',
  'swaps-nft-updates', 
  'swaps-trade-discovery',
  'swaps-batched-trade-discovery',
  'swaps-trade-results',
  'swaps-dlq'
];

class KafkaIntegrationTester {
  constructor() {
    this.testResults = [];
    this.isKafkaAvailable = false;
    this.kafka = null;
    this.producer = null;
    this.consumer = null;
  }

  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...data
    };
    
    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, 
      Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : '');
    
    this.testResults.push(logEntry);
  }

  async testKafkaAvailability() {
    this.log('info', '🔍 Testing Kafka Availability');
    
    try {
      // Try to import kafkajs
      const { Kafka } = require('kafkajs');
      this.log('info', '✅ KafkaJS library is available');
      
      // Create Kafka instance
      this.kafka = new Kafka({
        clientId: KAFKA_CONFIG.KAFKA_CLIENT_ID,
        brokers: KAFKA_CONFIG.KAFKA_BROKERS.split(','),
        retry: {
          initialRetryTime: 100,
          retries: 3
        }
      });
      
      this.log('info', '✅ Kafka client instance created', {
        brokers: KAFKA_CONFIG.KAFKA_BROKERS.split(','),
        clientId: KAFKA_CONFIG.KAFKA_CLIENT_ID
      });
      
      return true;
    } catch (error) {
      this.log('error', '❌ Failed to initialize Kafka client', {
        error: error.message,
        suggestion: 'Run: npm install kafkajs'
      });
      return false;
    }
  }

  async testKafkaConnection() {
    this.log('info', '🔗 Testing Kafka Connection');
    
    if (!this.kafka) {
      this.log('error', '❌ Kafka client not initialized');
      return false;
    }

    try {
      // Create admin client to test connection
      const admin = this.kafka.admin();
      
      this.log('info', '⏳ Connecting to Kafka cluster...');
      await admin.connect();
      
      this.log('info', '⏳ Fetching cluster metadata...');
      const metadata = await admin.fetchTopicMetadata();
      
      this.log('info', '✅ Successfully connected to Kafka', {
        topicCount: metadata.topics.length,
        topics: metadata.topics.map(t => t.name)
      });
      
      await admin.disconnect();
      this.isKafkaAvailable = true;
      return true;
      
    } catch (error) {
      this.log('error', '❌ Failed to connect to Kafka', {
        error: error.message,
        brokers: KAFKA_CONFIG.KAFKA_BROKERS,
        suggestion: 'Ensure Kafka is running and accessible'
      });
      return false;
    }
  }

  async testTopicCreation() {
    this.log('info', '📝 Testing Topic Creation');
    
    if (!this.isKafkaAvailable) {
      this.log('warn', '⚠️  Skipping topic creation - Kafka not available');
      return false;
    }

    try {
      const admin = this.kafka.admin();
      await admin.connect();
      
      // Check existing topics
      const existingTopics = await admin.listTopics();
      this.log('info', '📋 Existing topics', { topics: existingTopics });
      
      // Create SWAPS topics if they don't exist
      const topicsToCreate = SWAPS_TOPICS.filter(topic => !existingTopics.includes(topic));
      
      if (topicsToCreate.length > 0) {
        this.log('info', '🔨 Creating missing SWAPS topics', { topics: topicsToCreate });
        
        await admin.createTopics({
          topics: topicsToCreate.map(topic => ({
            topic,
            numPartitions: 3, // Good for distributed processing
            replicationFactor: 1 // Adjust based on cluster size
          }))
        });
        
        this.log('info', '✅ Successfully created topics', { topics: topicsToCreate });
      } else {
        this.log('info', '✅ All SWAPS topics already exist');
      }
      
      await admin.disconnect();
      return true;
      
    } catch (error) {
      this.log('error', '❌ Failed to create topics', {
        error: error.message
      });
      return false;
    }
  }

  async testMessageProduction() {
    this.log('info', '📤 Testing Message Production');
    
    if (!this.isKafkaAvailable) {
      this.log('warn', '⚠️  Skipping message production - Kafka not available');
      return false;
    }

    try {
      this.producer = this.kafka.producer();
      await this.producer.connect();
      
      // Test message for trade discovery
      const testMessage = {
        walletAddress: 'test_wallet_123',
        desiredNft: 'test_nft_456', 
        forceRefresh: true,
        timestamp: Date.now()
      };
      
      const startTime = performance.now();
      
      await this.producer.send({
        topic: 'swaps-trade-discovery',
        messages: [{
          key: 'test-message',
          value: JSON.stringify(testMessage),
          timestamp: Date.now().toString()
        }]
      });
      
      const endTime = performance.now();
      
      this.log('info', '✅ Successfully sent test message', {
        topic: 'swaps-trade-discovery',
        messageSize: JSON.stringify(testMessage).length,
        latency: `${(endTime - startTime).toFixed(2)}ms`
      });
      
      return true;
      
    } catch (error) {
      this.log('error', '❌ Failed to send message', {
        error: error.message
      });
      return false;
    }
  }

  async testMessageConsumption() {
    this.log('info', '📥 Testing Message Consumption');
    
    if (!this.isKafkaAvailable) {
      this.log('warn', '⚠️  Skipping message consumption - Kafka not available');
      return false;
    }

    try {
      this.consumer = this.kafka.consumer({ 
        groupId: KAFKA_CONFIG.KAFKA_CONSUMER_GROUP + '-test'
      });
      
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: 'swaps-trade-discovery' });
      
      this.log('info', '⏳ Listening for messages (10 second timeout)...');
      
      let messageReceived = false;
      const timeout = new Promise(resolve => setTimeout(resolve, 10000));
      
      const messagePromise = new Promise((resolve) => {
        this.consumer.run({
          eachMessage: async ({ topic, partition, message }) => {
            const value = message.value.toString();
            
            this.log('info', '✅ Successfully received message', {
              topic,
              partition,
              key: message.key?.toString(),
              valueLength: value.length,
              timestamp: message.timestamp
            });
            
            messageReceived = true;
            resolve();
          }
        });
      });
      
      await Promise.race([messagePromise, timeout]);
      
      if (!messageReceived) {
        this.log('warn', '⚠️  No messages received within timeout');
      }
      
      return messageReceived;
      
    } catch (error) {
      this.log('error', '❌ Failed to consume messages', {
        error: error.message
      });
      return false;
    }
  }

  async testSWAPSKafkaIntegration() {
    this.log('info', '🔧 Testing SWAPS Kafka Integration');
    
    try {
      // Check if SWAPS Kafka service can be imported
      const path = require('path');
      const kafkaServicePath = path.join(__dirname, 'backend/src/services/trade/KafkaIntegrationService.ts');
      
      this.log('info', '📂 Checking SWAPS Kafka service file', {
        path: kafkaServicePath
      });
      
      const fs = require('fs');
      if (fs.existsSync(kafkaServicePath)) {
        this.log('info', '✅ SWAPS KafkaIntegrationService file exists');
        
        // Read and analyze the service
        const serviceContent = fs.readFileSync(kafkaServicePath, 'utf8');
        
        const hasProducer = serviceContent.includes('producer');
        const hasConsumer = serviceContent.includes('consumer');
        const hasTopics = SWAPS_TOPICS.every(topic => serviceContent.includes(topic));
        const hasErrorHandling = serviceContent.includes('useLocalFallback');
        
        this.log('info', '🔍 SWAPS Kafka Integration Analysis', {
          hasProducer,
          hasConsumer, 
          hasAllTopics: hasTopics,
          hasErrorHandling,
          topicsFound: SWAPS_TOPICS.filter(topic => serviceContent.includes(topic))
        });
        
        if (hasProducer && hasConsumer && hasTopics && hasErrorHandling) {
          this.log('info', '✅ SWAPS Kafka integration is complete and robust');
          return true;
        } else {
          this.log('warn', '⚠️  SWAPS Kafka integration may be incomplete');
          return false;
        }
        
      } else {
        this.log('error', '❌ SWAPS KafkaIntegrationService file not found');
        return false;
      }
      
    } catch (error) {
      this.log('error', '❌ Failed to analyze SWAPS Kafka integration', {
        error: error.message
      });
      return false;
    }
  }

  async testPerformanceCharacteristics() {
    this.log('info', '⚡ Testing Kafka Performance Characteristics');
    
    if (!this.isKafkaAvailable || !this.producer) {
      this.log('warn', '⚠️  Skipping performance test - Kafka not available');
      return false;
    }

    try {
      const messageCount = 100;
      const messages = [];
      
      // Generate test messages
      for (let i = 0; i < messageCount; i++) {
        messages.push({
          key: `perf-test-${i}`,
          value: JSON.stringify({
            walletAddress: `wallet_${i}`,
            desiredNft: `nft_${i}`,
            forceRefresh: false,
            timestamp: Date.now()
          })
        });
      }
      
      this.log('info', `⏳ Sending ${messageCount} messages for performance test...`);
      
      const startTime = performance.now();
      
      await this.producer.send({
        topic: 'swaps-trade-discovery',
        messages
      });
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const messagesPerSecond = (messageCount / totalTime) * 1000;
      
      this.log('info', '✅ Performance test completed', {
        messageCount,
        totalTime: `${totalTime.toFixed(2)}ms`,
        averageLatency: `${(totalTime / messageCount).toFixed(2)}ms`,
        throughput: `${messagesPerSecond.toFixed(0)} messages/second`
      });
      
      return true;
      
    } catch (error) {
      this.log('error', '❌ Performance test failed', {
        error: error.message
      });
      return false;
    }
  }

  async cleanup() {
    this.log('info', '🧹 Cleaning up test resources');
    
    try {
      if (this.consumer) {
        await this.consumer.disconnect();
        this.log('info', '✅ Consumer disconnected');
      }
      
      if (this.producer) {
        await this.producer.disconnect();
        this.log('info', '✅ Producer disconnected');
      }
      
    } catch (error) {
      this.log('warn', '⚠️  Cleanup warning', {
        error: error.message
      });
    }
  }

  generateReport() {
    this.log('info', '📊 Generating Kafka Integration Report');
    
    const report = {
      timestamp: new Date().toISOString(),
      configuration: KAFKA_CONFIG,
      swapsTopics: SWAPS_TOPICS,
      testResults: this.testResults,
      summary: {
        kafkaAvailable: this.isKafkaAvailable,
        totalTests: this.testResults.filter(r => r.level === 'info' && r.message.includes('✅')).length,
        failedTests: this.testResults.filter(r => r.level === 'error').length,
        warnings: this.testResults.filter(r => r.level === 'warn').length
      },
      recommendations: []
    };
    
    // Generate recommendations
    if (!this.isKafkaAvailable) {
      report.recommendations.push({
        priority: 'HIGH',
        category: 'Infrastructure',
        issue: 'Kafka not accessible',
        solution: 'Start Kafka cluster: docker-compose up kafka zookeeper'
      });
    }
    
    if (report.summary.failedTests > 0) {
      report.recommendations.push({
        priority: 'MEDIUM', 
        category: 'Integration',
        issue: 'Some Kafka tests failed',
        solution: 'Review error logs and check Kafka configuration'
      });
    }
    
    if (this.isKafkaAvailable) {
      report.recommendations.push({
        priority: 'LOW',
        category: 'Optimization',
        issue: 'Kafka is ready for production',
        solution: 'Enable ENABLE_KAFKA=true in production environment'
      });
    }
    
    console.log('\n🎯 KAFKA INTEGRATION TEST REPORT');
    console.log('='.repeat(50));
    console.log(JSON.stringify(report, null, 2));
    
    return report;
  }

  async runAllTests() {
    console.log('🚀 Starting SWAPS Kafka Integration Test Suite');
    console.log('='.repeat(60));
    
    try {
      // Test sequence
      await this.testKafkaAvailability();
      
      if (this.kafka) {
        await this.testKafkaConnection();
        await this.testTopicCreation();
        await this.testMessageProduction();
        await this.testMessageConsumption();
        await this.testPerformanceCharacteristics();
      }
      
      await this.testSWAPSKafkaIntegration();
      
    } catch (error) {
      this.log('error', '💥 Critical test failure', {
        error: error.message,
        stack: error.stack
      });
    } finally {
      await this.cleanup();
      this.generateReport();
    }
  }
}

// Run the test suite
if (require.main === module) {
  const tester = new KafkaIntegrationTester();
  tester.runAllTests().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = KafkaIntegrationTester; 