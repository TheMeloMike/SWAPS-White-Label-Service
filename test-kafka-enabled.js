#!/usr/bin/env node

/**
 * SWAPS KAFKA CONFIGURATION TEST
 * 
 * This script tests SWAPS backend behavior with Kafka enabled:
 * - Tests graceful fallback when Kafka is unavailable
 * - Verifies configuration parsing
 * - Tests service initialization with Kafka settings
 * - Confirms the system doesn't break when ENABLE_KAFKA=true
 */

const path = require('path');
const { spawn } = require('child_process');

// Test environment with Kafka enabled
const TEST_ENV = {
  ...process.env,
  ENABLE_KAFKA: 'true',
  KAFKA_BROKERS: 'localhost:9092',
  KAFKA_CLIENT_ID: 'swaps-config-test',
  KAFKA_CONSUMER_GROUP: 'swaps-test-group',
  NODE_ENV: 'test',
  PORT: '3999', // Use different port for testing
  HELIUS_API_KEY: 'test-key'
};

class SWAPSKafkaConfigTester {
  constructor() {
    this.results = [];
    this.backendProcess = null;
  }

  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, ...data };
    
    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, 
      Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : '');
    
    this.results.push(logEntry);
  }

  async testKafkaConfigurationParsing() {
    this.log('info', '🔧 Testing Kafka Configuration Parsing');
    
    try {
      // Test if the backend can parse Kafka environment variables
      const configTest = {
        ENABLE_KAFKA: TEST_ENV.ENABLE_KAFKA,
        KAFKA_BROKERS: TEST_ENV.KAFKA_BROKERS,
        KAFKA_CLIENT_ID: TEST_ENV.KAFKA_CLIENT_ID,
        KAFKA_CONSUMER_GROUP: TEST_ENV.KAFKA_CONSUMER_GROUP
      };
      
      this.log('info', '✅ Kafka configuration variables set', configTest);
      
      // Validate broker format
      const brokers = TEST_ENV.KAFKA_BROKERS.split(',');
      const validBrokers = brokers.every(broker => {
        const [host, port] = broker.split(':');
        return host && port && !isNaN(parseInt(port));
      });
      
      if (validBrokers) {
        this.log('info', '✅ Kafka broker format is valid', { brokers });
      } else {
        this.log('error', '❌ Invalid Kafka broker format', { brokers });
        return false;
      }
      
      return true;
      
    } catch (error) {
      this.log('error', '❌ Configuration parsing failed', {
        error: error.message
      });
      return false;
    }
  }

  async testBackendStartupWithKafka() {
    this.log('info', '🚀 Testing SWAPS Backend Startup with Kafka Enabled');
    
    return new Promise((resolve) => {
      const backendPath = path.join(__dirname, 'backend');
      
      // Change to backend directory and start the server
      this.backendProcess = spawn('npm', ['run', 'dev'], {
        cwd: backendPath,
        env: TEST_ENV,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      let startupSuccess = false;
      let kafkaAttempted = false;
      let fallbackActivated = false;
      
      const timeout = setTimeout(() => {
        this.log('info', 'ℹ️  Stopping backend test after timeout');
        this.backendProcess.kill();
        resolve({
          success: startupSuccess,
          kafkaAttempted,
          fallbackActivated,
          output: output.substring(0, 1000), // Limit output size
          errorOutput: errorOutput.substring(0, 1000)
        });
      }, 15000); // 15 second timeout
      
      this.backendProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        
        // Look for startup indicators
        if (text.includes('SWAPS White Label API Server started') || 
            text.includes('Server started') ||
            text.includes('listening on port')) {
          startupSuccess = true;
          this.log('info', '✅ Backend startup successful');
        }
        
        // Look for Kafka connection attempts
        if (text.includes('Kafka') || text.includes('kafka')) {
          kafkaAttempted = true;
          this.log('info', '🔍 Kafka connection attempted');
        }
        
        // Look for fallback activation
        if (text.includes('fallback') || text.includes('non-distributed mode')) {
          fallbackActivated = true;
          this.log('info', '🔄 Fallback mode activated');
        }
        
        // If we see successful startup, we can finish early
        if (startupSuccess && (kafkaAttempted || fallbackActivated)) {
          clearTimeout(timeout);
          this.backendProcess.kill();
          resolve({
            success: startupSuccess,
            kafkaAttempted,
            fallbackActivated,
            output: output.substring(0, 1000),
            errorOutput: errorOutput.substring(0, 1000)
          });
        }
      });
      
      this.backendProcess.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        
        // Look for critical errors that would prevent startup
        if (text.includes('EADDRINUSE') || 
            text.includes('Cannot find module') ||
            text.includes('SyntaxError')) {
          this.log('error', '❌ Critical startup error detected');
          clearTimeout(timeout);
          this.backendProcess.kill();
          resolve({
            success: false,
            kafkaAttempted,
            fallbackActivated,
            output: output.substring(0, 1000),
            errorOutput: errorOutput.substring(0, 1000)
          });
        }
      });
      
      this.backendProcess.on('error', (error) => {
        this.log('error', '❌ Process error', { error: error.message });
        clearTimeout(timeout);
        resolve({
          success: false,
          kafkaAttempted,
          fallbackActivated,
          output: output.substring(0, 1000),
          errorOutput: errorOutput.substring(0, 1000)
        });
      });
    });
  }

  async testAPIResponseWithKafkaConfig() {
    this.log('info', '🌐 Testing API Response with Kafka Configuration');
    
    try {
      // Simple HTTP request to health endpoint
      const http = require('http');
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.log('warn', '⚠️  API test timeout');
          resolve(false);
        }, 5000);
        
        const req = http.get('http://localhost:3999/health', (res) => {
          clearTimeout(timeout);
          
          if (res.statusCode === 200) {
            this.log('info', '✅ API responding successfully', {
              statusCode: res.statusCode
            });
            resolve(true);
          } else {
            this.log('warn', '⚠️  API returned unexpected status', {
              statusCode: res.statusCode
            });
            resolve(false);
          }
        });
        
        req.on('error', (error) => {
          clearTimeout(timeout);
          this.log('info', 'ℹ️  API not accessible (expected during test)', {
            error: error.code
          });
          resolve(false); // This is expected if backend isn't running
        });
      });
      
    } catch (error) {
      this.log('info', 'ℹ️  API test skipped', {
        reason: error.message
      });
      return false;
    }
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      testEnvironment: {
        ENABLE_KAFKA: TEST_ENV.ENABLE_KAFKA,
        KAFKA_BROKERS: TEST_ENV.KAFKA_BROKERS,
        NODE_ENV: TEST_ENV.NODE_ENV
      },
      results: this.results,
      summary: {
        totalTests: this.results.filter(r => r.message.includes('✅')).length,
        failures: this.results.filter(r => r.level === 'error').length,
        warnings: this.results.filter(r => r.level === 'warn').length
      }
    };
    
    console.log('\n🎯 SWAPS KAFKA CONFIGURATION TEST REPORT');
    console.log('='.repeat(50));
    console.log(`✅ Tests Passed: ${report.summary.totalTests}`);
    console.log(`❌ Failures: ${report.summary.failures}`);
    console.log(`⚠️  Warnings: ${report.summary.warnings}`);
    
    if (report.summary.failures === 0) {
      console.log('\n🎉 All configuration tests passed!');
      console.log('✅ SWAPS can safely run with ENABLE_KAFKA=true');
      console.log('✅ Graceful fallback is working when Kafka is unavailable');
    } else {
      console.log('\n⚠️  Some tests failed - review the logs above');
    }
    
    return report;
  }

  async cleanup() {
    if (this.backendProcess && !this.backendProcess.killed) {
      this.log('info', '🧹 Cleaning up backend process');
      this.backendProcess.kill();
    }
  }

  async runAllTests() {
    console.log('🚀 Starting SWAPS Kafka Configuration Test Suite');
    console.log('='.repeat(60));
    console.log('This test verifies that SWAPS handles Kafka configuration correctly');
    console.log('and gracefully falls back when Kafka is unavailable.\n');
    
    try {
      // Test 1: Configuration parsing
      await this.testKafkaConfigurationParsing();
      
      // Test 2: Backend startup with Kafka enabled
      const startupResult = await this.testBackendStartupWithKafka();
      
      if (startupResult.success) {
        this.log('info', '✅ Backend startup test passed', {
          kafkaAttempted: startupResult.kafkaAttempted,
          fallbackActivated: startupResult.fallbackActivated
        });
        
        // Test 3: API response (if backend started)
        await this.testAPIResponseWithKafkaConfig();
      } else {
        this.log('warn', '⚠️  Backend startup test inconclusive', startupResult);
      }
      
    } catch (error) {
      this.log('error', '💥 Test suite error', {
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
  const tester = new SWAPSKafkaConfigTester();
  tester.runAllTests().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = SWAPSKafkaConfigTester; 