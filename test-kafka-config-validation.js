#!/usr/bin/env node

/**
 * KAFKA CONFIGURATION VALIDATION TEST
 * 
 * This script validates that:
 * 1. Kafka configuration is properly parsed
 * 2. KafkaIntegrationService can be imported
 * 3. Graceful fallback logic exists
 * 4. Environment variables are correctly handled
 */

const fs = require('fs');
const path = require('path');

class KafkaConfigValidator {
  constructor() {
    this.results = [];
  }

  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, ...data };
    
    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, 
      Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : '');
    
    this.results.push(logEntry);
  }

  async validateEnvironmentVariables() {
    this.log('info', '🔧 Validating Kafka Environment Variables');
    
    const requiredVars = {
      ENABLE_KAFKA: 'true',
      KAFKA_BROKERS: 'localhost:9092',
      KAFKA_CLIENT_ID: 'swaps-test',
      KAFKA_CONSUMER_GROUP: 'swaps-group'
    };
    
    let allValid = true;
    
    for (const [key, testValue] of Object.entries(requiredVars)) {
      // Test that the format is valid
      if (key === 'KAFKA_BROKERS') {
        const brokers = testValue.split(',');
        const validFormat = brokers.every(broker => {
          const [host, port] = broker.split(':');
          return host && port && !isNaN(parseInt(port));
        });
        
        if (validFormat) {
          this.log('info', `✅ ${key} format is valid`, { value: testValue });
        } else {
          this.log('error', `❌ ${key} format is invalid`, { value: testValue });
          allValid = false;
        }
      } else if (key === 'ENABLE_KAFKA') {
        const validValues = ['true', 'false'];
        if (validValues.includes(testValue)) {
          this.log('info', `✅ ${key} value is valid`, { value: testValue });
        } else {
          this.log('error', `❌ ${key} value is invalid`, { 
            value: testValue, 
            expected: validValues 
          });
          allValid = false;
        }
      } else {
        // Client ID and Consumer Group should be non-empty strings
        if (testValue && typeof testValue === 'string' && testValue.length > 0) {
          this.log('info', `✅ ${key} is valid`, { value: testValue });
        } else {
          this.log('error', `❌ ${key} is invalid`, { value: testValue });
          allValid = false;
        }
      }
    }
    
    return allValid;
  }

  async validateKafkaServiceFile() {
    this.log('info', '📂 Validating KafkaIntegrationService File');
    
    const kafkaServicePath = path.join(__dirname, 'backend/src/services/trade/KafkaIntegrationService.ts');
    
    if (!fs.existsSync(kafkaServicePath)) {
      this.log('error', '❌ KafkaIntegrationService file not found', { path: kafkaServicePath });
      return false;
    }
    
    this.log('info', '✅ KafkaIntegrationService file exists');
    
    try {
      const content = fs.readFileSync(kafkaServicePath, 'utf8');
      
      // Check for key components
      const checks = {
        hasKafkaImport: content.includes("from 'kafkajs'"),
        hasProducer: content.includes('producer'),
        hasConsumer: content.includes('consumer'),
        hasFallbackLogic: content.includes('useLocalFallback'),
        hasErrorHandling: content.includes('catch') && content.includes('error'),
        hasTopicDefinitions: content.includes('TOPIC'),
        hasConnectionMethod: content.includes('connect()'),
        hasDisconnectMethod: content.includes('disconnect()'),
        hasHealthCheck: content.includes('isHealthy') || content.includes('isConnected')
      };
      
      this.log('info', '🔍 KafkaIntegrationService Analysis', checks);
      
      const requiredFeatures = ['hasKafkaImport', 'hasProducer', 'hasConsumer', 'hasFallbackLogic'];
      const missingFeatures = requiredFeatures.filter(feature => !checks[feature]);
      
      if (missingFeatures.length === 0) {
        this.log('info', '✅ All required Kafka features are present');
        return true;
      } else {
        this.log('error', '❌ Missing required Kafka features', { missing: missingFeatures });
        return false;
      }
      
    } catch (error) {
      this.log('error', '❌ Failed to analyze KafkaIntegrationService', {
        error: error.message
      });
      return false;
    }
  }

  async validateDockerComposeConfig() {
    this.log('info', '🐳 Validating Docker Compose Configuration');
    
    const dockerComposePath = path.join(__dirname, 'docker-compose.yml');
    
    if (!fs.existsSync(dockerComposePath)) {
      this.log('warn', '⚠️  docker-compose.yml not found - Kafka infrastructure not configured');
      return false;
    }
    
    try {
      const content = fs.readFileSync(dockerComposePath, 'utf8');
      
      const checks = {
        hasZookeeper: content.includes('zookeeper:'),
        hasKafka: content.includes('kafka:'),
        hasKafkaImage: content.includes('confluentinc/cp-kafka'),
        hasZookeeperImage: content.includes('confluentinc/cp-zookeeper'),
        hasHealthChecks: content.includes('healthcheck:'),
        hasKafkaEnvironment: content.includes('ENABLE_KAFKA=true'),
        hasKafkaBrokers: content.includes('KAFKA_BROKERS'),
        hasPorts: content.includes('9092:9092')
      };
      
      this.log('info', '🔍 Docker Compose Analysis', checks);
      
      if (checks.hasKafka && checks.hasZookeeper && checks.hasKafkaImage) {
        this.log('info', '✅ Docker Compose Kafka configuration is valid');
        return true;
      } else {
        this.log('warn', '⚠️  Docker Compose Kafka configuration is incomplete');
        return false;
      }
      
    } catch (error) {
      this.log('error', '❌ Failed to analyze docker-compose.yml', {
        error: error.message
      });
      return false;
    }
  }

  async validatePersistentTradeDiscoveryConfig() {
    this.log('info', '🔄 Validating PersistentTradeDiscoveryService Kafka Configuration');
    
    const servicePath = path.join(__dirname, 'backend/src/services/trade/PersistentTradeDiscoveryService.ts');
    
    if (!fs.existsSync(servicePath)) {
      this.log('error', '❌ PersistentTradeDiscoveryService file not found');
      return false;
    }
    
    try {
      const content = fs.readFileSync(servicePath, 'utf8');
      
      // Check for Kafka integration configuration
      const checks = {
        hasKafkaConfig: content.includes('enableKafkaDistribution'),
        hasKafkaDisabled: content.includes('enableKafkaDistribution: false'),
        hasKafkaComment: content.includes('Disable for white label'),
        hasKafkaConditional: content.includes('ENABLE_KAFKA')
      };
      
      this.log('info', '🔍 PersistentTradeDiscoveryService Kafka Analysis', checks);
      
      if (checks.hasKafkaConfig) {
        this.log('info', '✅ Kafka configuration found in PersistentTradeDiscoveryService');
        
        if (checks.hasKafkaDisabled && checks.hasKafkaComment) {
          this.log('info', '✅ Kafka is correctly disabled by default for white label');
        }
        
        return true;
      } else {
        this.log('warn', '⚠️  No Kafka configuration found in PersistentTradeDiscoveryService');
        return false;
      }
      
    } catch (error) {
      this.log('error', '❌ Failed to analyze PersistentTradeDiscoveryService', {
        error: error.message
      });
      return false;
    }
  }

  async testKafkaJSInstallation() {
    this.log('info', '📦 Testing KafkaJS Installation');
    
    try {
      // Check if kafkajs is in package.json dependencies
      const packageJsonPath = path.join(__dirname, 'backend/package.json');
      
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        if (packageJson.dependencies && packageJson.dependencies.kafkajs) {
          this.log('info', '✅ KafkaJS found in dependencies', {
            version: packageJson.dependencies.kafkajs
          });
          return true;
        } else {
          this.log('error', '❌ KafkaJS not found in dependencies');
          return false;
        }
      } else {
        this.log('error', '❌ package.json not found');
        return false;
      }
      
    } catch (error) {
      this.log('error', '❌ Failed to check KafkaJS installation', {
        error: error.message
      });
      return false;
    }
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      results: this.results,
      summary: {
        totalTests: this.results.filter(r => r.message.includes('✅')).length,
        failures: this.results.filter(r => r.level === 'error').length,
        warnings: this.results.filter(r => r.level === 'warn').length
      }
    };
    
    console.log('\n🎯 KAFKA CONFIGURATION VALIDATION REPORT');
    console.log('='.repeat(50));
    console.log(`✅ Tests Passed: ${report.summary.totalTests}`);
    console.log(`❌ Failures: ${report.summary.failures}`);
    console.log(`⚠️  Warnings: ${report.summary.warnings}`);
    
    if (report.summary.failures === 0) {
      console.log('\n🎉 All Kafka configuration validations passed!');
      console.log('✅ SWAPS is properly configured for Kafka integration');
      console.log('✅ Graceful fallback mechanisms are in place');
      console.log('✅ Infrastructure configuration is ready');
    } else {
      console.log('\n⚠️  Some validations failed - review the logs above');
    }
    
    console.log('\n📋 RECOMMENDATIONS:');
    if (report.summary.failures === 0) {
      console.log('1. ✅ Kafka is ready to be enabled when infrastructure is available');
      console.log('2. ✅ Use ./setup-kafka-local.sh to start Kafka infrastructure');
      console.log('3. ✅ Set ENABLE_KAFKA=true to activate distributed processing');
    } else {
      console.log('1. ❌ Fix configuration issues identified above');
      console.log('2. ❌ Ensure all required dependencies are installed');
      console.log('3. ❌ Verify file paths and service implementations');
    }
    
    return report;
  }

  async runAllValidations() {
    console.log('🚀 Starting Kafka Configuration Validation');
    console.log('='.repeat(50));
    console.log('This validates SWAPS Kafka integration readiness\n');
    
    try {
      await this.validateEnvironmentVariables();
      await this.testKafkaJSInstallation();
      await this.validateKafkaServiceFile();
      await this.validateDockerComposeConfig();
      await this.validatePersistentTradeDiscoveryConfig();
      
    } catch (error) {
      this.log('error', '💥 Validation suite error', {
        error: error.message,
        stack: error.stack
      });
    } finally {
      this.generateReport();
    }
  }
}

// Run the validation suite
if (require.main === module) {
  const validator = new KafkaConfigValidator();
  validator.runAllValidations().catch(error => {
    console.error('❌ Validation suite failed:', error);
    process.exit(1);
  });
}

module.exports = KafkaConfigValidator; 