#!/usr/bin/env node

/**
 * CLIENT UX VALIDATION SUITE
 * 
 * This comprehensive test simulates real client usage patterns to ensure:
 * 1. Intuitive API workflow
 * 2. Clear error messages and guidance
 * 3. Reasonable response times
 * 4. Predictable behavior
 * 5. Helpful feedback and progress indicators
 * 6. Edge case handling
 * 7. Documentation accuracy
 * 8. Onboarding flow smoothness
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_URL || 'https://swaps-93hu.onrender.com/api/v1';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'swaps_admin_prod_2025_secure_key_abc123';

console.log('🧑‍💼 CLIENT UX VALIDATION SUITE');
console.log('==============================');
console.log('🎯 Goal: Ensure seamless client experience');
console.log('🎯 Testing real-world usage patterns');
console.log('');

class ClientUXValidator {
  constructor() {
    this.uxIssues = [];
    this.successfulFlows = [];
    this.performanceMetrics = [];
    this.errorExperiences = [];
  }

  logUXIssue(category, severity, description, suggestion) {
    this.uxIssues.push({
      category,
      severity, // 'critical', 'high', 'medium', 'low'
      description,
      suggestion,
      timestamp: new Date().toISOString()
    });
    
    const icon = severity === 'critical' ? '🚨' : severity === 'high' ? '⚠️' : severity === 'medium' ? '🔸' : '💡';
    console.log(`   ${icon} ${severity.toUpperCase()} UX Issue: ${description}`);
    console.log(`      💡 Suggestion: ${suggestion}`);
  }

  logSuccess(flow, description) {
    this.successfulFlows.push({ flow, description, timestamp: new Date().toISOString() });
    console.log(`   ✅ UX Success: ${description}`);
  }

  logPerformance(operation, responseTime, expected, userImpact) {
    this.performanceMetrics.push({
      operation,
      responseTime,
      expected,
      userImpact,
      acceptable: responseTime <= expected
    });
    
    const status = responseTime <= expected ? '✅' : '⚠️';
    console.log(`   ${status} Performance: ${operation} took ${responseTime}ms (expected: ≤${expected}ms)`);
    if (responseTime > expected) {
      console.log(`      👤 User Impact: ${userImpact}`);
    }
  }

  async testClientOnboarding() {
    console.log('🚀 Testing Client Onboarding Experience');
    console.log('========================================');
    console.log('Simulating: New client\'s first interaction with the API');
    console.log('');

    try {
      // Test 1: Can client easily create a tenant?
      console.log('📝 Step 1: Tenant Creation');
      const startTime = Date.now();
      
      const tenantResponse = await axios.post(`${BASE_URL}/admin/tenants`, {
        name: 'UX Test Client',
        contactEmail: 'ux@testclient.com',
        settings: {
          algorithm: { maxDepth: 15, minEfficiency: 0.3, maxLoopsPerRequest: 50 },
          security: { maxNFTsPerWallet: 1000, maxWantsPerWallet: 100 }
        }
      }, {
        headers: { 'Authorization': `Bearer ${ADMIN_API_KEY}`, 'Content-Type': 'application/json' }
      });

      const creationTime = Date.now() - startTime;
      this.logPerformance('Tenant Creation', creationTime, 3000, 'Slow onboarding, client might think system is broken');
      
      const tenant = tenantResponse.data.tenant;
      const apiKey = tenant.apiKey || tenantResponse.data.apiKey;
      
      // Validate response structure
      if (!tenant.id || !apiKey) {
        this.logUXIssue('onboarding', 'critical', 'Tenant creation response missing essential fields', 'Ensure response always includes tenant.id and apiKey');
      } else {
        this.logSuccess('onboarding', 'Tenant creation provides clear ID and API key');
      }

      console.log(`   ✅ Tenant created: ${tenant.id}`);
      console.log(`   🔑 API Key: ${apiKey.substring(0, 20)}...`);
      console.log('');

      return { tenant, apiKey };

    } catch (error) {
      this.logUXIssue('onboarding', 'critical', `Tenant creation failed: ${error.response?.data?.error || error.message}`, 'Provide clear error messages and troubleshooting steps');
      throw error;
    }
  }

  async testInvalidInputHandling(apiKey) {
    console.log('🚫 Testing Invalid Input Handling');
    console.log('==================================');
    console.log('Simulating: Common client mistakes and edge cases');
    console.log('');

    const testCases = [
      {
        name: 'Missing NFT metadata',
        test: () => axios.post(`${BASE_URL}/inventory/submit`, {
          walletId: 'test_wallet',
          nfts: [{ id: 'invalid_nft' }] // Missing required fields
        }, {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        }),
        expectedError: 'Invalid NFT data',
        userFriendly: 'Clear validation errors with field-specific guidance'
      },
      {
        name: 'Empty wallet ID',
        test: () => axios.post(`${BASE_URL}/inventory/submit`, {
          walletId: '',
          nfts: []
        }, {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        }),
        expectedError: 'Invalid request',
        userFriendly: 'Specific error about wallet ID requirement'
      },
      {
        name: 'Invalid API key',
        test: () => axios.post(`${BASE_URL}/inventory/submit`, {
          walletId: 'test_wallet',
          nfts: []
        }, {
          headers: { 'Authorization': `Bearer invalid_key`, 'Content-Type': 'application/json' }
        }),
        expectedError: 'Invalid API key',
        userFriendly: 'Clear authentication error with next steps'
      },
      {
        name: 'Malformed JSON',
        test: () => axios.post(`${BASE_URL}/inventory/submit`, '{ invalid json }', {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        }),
        expectedError: 'JSON parse error',
        userFriendly: 'JSON validation error with format examples'
      }
    ];

    for (const testCase of testCases) {
      try {
        console.log(`🧪 Testing: ${testCase.name}`);
        await testCase.test();
        this.logUXIssue('error_handling', 'high', `${testCase.name} should have failed but succeeded`, 'Add proper validation for this case');
      } catch (error) {
        const errorMessage = error.response?.data?.error || error.message;
        const statusCode = error.response?.status || 0;
        
        console.log(`   📋 Error Response: ${statusCode} - ${errorMessage}`);
        
        // Evaluate error quality
        if (errorMessage.toLowerCase().includes('invalid') || errorMessage.toLowerCase().includes('required')) {
          this.logSuccess('error_handling', `${testCase.name} provides clear error message`);
        } else {
          this.logUXIssue('error_handling', 'medium', `${testCase.name} error message could be clearer: "${errorMessage}"`, testCase.userFriendly);
        }
      }
    }
    console.log('');
  }

  async testTypicalClientWorkflow(apiKey) {
    console.log('👤 Testing Typical Client Workflow');
    console.log('==================================');
    console.log('Simulating: Real client building a trading app');
    console.log('');

    try {
      // Step 1: Client adds their first NFT
      console.log('📦 Step 1: Adding first NFT');
      const nftStartTime = Date.now();
      
      const nftResponse = await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: 'client_user_1',
        nfts: [{
          id: 'client_nft_1',
          metadata: {
            name: 'My First NFT',
            symbol: 'FIRST',
            description: 'Testing the trading system'
          },
          ownership: {
            ownerId: 'client_user_1',
            blockchain: 'solana',
            contractAddress: 'test_contract_1',
            tokenId: 'client_nft_1'
          },
          valuation: {
            estimatedValue: 1.5,
            currency: 'SOL',
            lastUpdated: new Date().toISOString(),
            source: 'client_app'
          }
        }]
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });

      const nftTime = Date.now() - nftStartTime;
      this.logPerformance('First NFT Submission', nftTime, 2000, 'Slow initial response might confuse new users');

      // Validate response helpfulness
      if (nftResponse.data.nftsProcessed && nftResponse.data.newLoopsDiscovered !== undefined) {
        this.logSuccess('workflow', 'NFT submission provides clear processing feedback');
      } else {
        this.logUXIssue('workflow', 'medium', 'NFT submission response lacks clear processing status', 'Include nftsProcessed and newLoopsDiscovered in response');
      }

      console.log(`   ✅ NFT added: ${nftResponse.data.nftsProcessed || 1} processed, ${nftResponse.data.newLoopsDiscovered || 0} loops discovered`);

      // Step 2: Client adds a want
      console.log('💭 Step 2: Adding a want');
      const wantStartTime = Date.now();
      
      const wantResponse = await axios.post(`${BASE_URL}/wants/submit`, {
        walletId: 'client_user_1',
        wantedNFTs: ['some_desired_nft']
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });

      const wantTime = Date.now() - wantStartTime;
      this.logPerformance('Want Submission', wantTime, 1500, 'Users expect quick want submissions');

      console.log(`   ✅ Want added: ${wantResponse.data.wantsProcessed || 1} processed, ${wantResponse.data.newLoopsDiscovered || 0} loops discovered`);

      // Step 3: Client checks for trades
      console.log('🔍 Step 3: Checking for available trades');
      const queryStartTime = Date.now();
      
      const tradesResponse = await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: 'client_user_1'
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });

      const queryTime = Date.now() - queryStartTime;
      this.logPerformance('Trade Discovery', queryTime, 1000, 'Slow trade queries hurt user experience');

      const trades = tradesResponse.data.trades || [];
      console.log(`   ✅ Trade query: ${trades.length} trades found`);

      // Evaluate response structure
      if (tradesResponse.data.success !== undefined && Array.isArray(tradesResponse.data.trades)) {
        this.logSuccess('workflow', 'Trade discovery provides clear structured response');
      } else {
        this.logUXIssue('workflow', 'low', 'Trade discovery response could be more structured', 'Include success field and ensure trades is always an array');
      }

      // Step 4: Client wants to understand their status
      console.log('📊 Step 4: Checking tenant status');
      const statusStartTime = Date.now();
      
      try {
        const statusResponse = await axios.get(`${BASE_URL}/status`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        const statusTime = Date.now() - statusStartTime;
        this.logPerformance('Status Check', statusTime, 500, 'Status checks should be very fast');

        if (statusResponse.data.statistics && statusResponse.data.tenant) {
          this.logSuccess('workflow', 'Status endpoint provides comprehensive tenant information');
        } else {
          this.logUXIssue('workflow', 'medium', 'Status endpoint missing key information', 'Include tenant details and usage statistics');
        }

        console.log(`   ✅ Status retrieved: ${statusResponse.data.statistics?.activeLoops || 0} active loops`);
      } catch (error) {
        this.logUXIssue('workflow', 'high', `Status endpoint failed: ${error.response?.data?.error || error.message}`, 'Status endpoint should always be available');
      }

    } catch (error) {
      this.logUXIssue('workflow', 'critical', `Typical workflow failed: ${error.response?.data?.error || error.message}`, 'Core workflows must be reliable');
      throw error;
    }
    console.log('');
  }

  async testEdgeCasesAndLimits(apiKey) {
    console.log('🎯 Testing Edge Cases and Limits');
    console.log('================================');
    console.log('Simulating: Boundary conditions and stress scenarios');
    console.log('');

    const edgeCases = [
      {
        name: 'Empty NFT array',
        description: 'Client submits empty inventory',
        test: async () => {
          const response = await axios.post(`${BASE_URL}/inventory/submit`, {
            walletId: 'edge_test_wallet',
            nfts: []
          }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
          });
          return response.data;
        }
      },
      {
        name: 'Very long NFT name',
        description: 'Client uses extremely long metadata',
        test: async () => {
          const longName = 'A'.repeat(1000);
          const response = await axios.post(`${BASE_URL}/inventory/submit`, {
            walletId: 'edge_test_wallet',
            nfts: [{
              id: 'long_name_nft',
              metadata: {
                name: longName,
                symbol: 'LONG',
                description: 'Testing long names'
              },
              ownership: {
                ownerId: 'edge_test_wallet',
                blockchain: 'solana',
                contractAddress: 'test_contract',
                tokenId: 'long_name_nft'
              },
              valuation: {
                estimatedValue: 1.0,
                currency: 'SOL',
                lastUpdated: new Date().toISOString(),
                source: 'edge_test'
              }
            }]
          }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
          });
          return response.data;
        }
      },
      {
        name: 'Non-existent wallet query',
        description: 'Client queries wallet that doesn\'t exist',
        test: async () => {
          const response = await axios.post(`${BASE_URL}/discovery/trades`, {
            walletId: 'non_existent_wallet_12345'
          }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
          });
          return response.data;
        }
      }
    ];

    for (const edgeCase of edgeCases) {
      try {
        console.log(`🧪 Testing: ${edgeCase.name}`);
        const startTime = Date.now();
        const result = await edgeCase.test();
        const responseTime = Date.now() - startTime;

        this.logPerformance(`Edge Case: ${edgeCase.name}`, responseTime, 2000, 'Edge cases should not cause delays');
        
        if (result.success !== false && (result.nftsProcessed !== undefined || result.trades !== undefined)) {
          this.logSuccess('edge_cases', `${edgeCase.name} handled gracefully`);
        } else {
          this.logUXIssue('edge_cases', 'low', `${edgeCase.name} response unclear`, 'Provide clearer responses for edge cases');
        }

        console.log(`   ✅ ${edgeCase.description}: Handled successfully`);
      } catch (error) {
        const errorMessage = error.response?.data?.error || error.message;
        if (error.response?.status >= 400 && error.response?.status < 500) {
          this.logSuccess('edge_cases', `${edgeCase.name} properly rejected with client error`);
        } else {
          this.logUXIssue('edge_cases', 'medium', `${edgeCase.name} caused server error: ${errorMessage}`, 'Handle edge cases gracefully without server errors');
        }
        console.log(`   ⚠️ ${edgeCase.description}: ${errorMessage}`);
      }
    }
    console.log('');
  }

  async testDocumentationAccuracy() {
    console.log('📚 Testing Documentation Accuracy');
    console.log('=================================');
    console.log('Simulating: Client following documented examples');
    console.log('');

    // Test documented endpoint structure
    const documentedTests = [
      {
        name: 'Health Check',
        endpoint: '/health',
        method: 'GET',
        expectedFields: ['status', 'timestamp'],
        description: 'Basic health endpoint should match docs'
      },
      {
        name: 'API Root',
        endpoint: '/',
        method: 'GET', 
        expectedFields: ['service', 'version', 'endpoints'],
        description: 'Root endpoint should provide API information'
      }
    ];

    for (const test of documentedTests) {
      try {
        console.log(`📖 Testing documented endpoint: ${test.endpoint}`);
        const response = await axios.get(`${BASE_URL.replace('/api/v1', '')}${test.endpoint}`);
        
        const missingFields = test.expectedFields.filter(field => !(field in response.data));
        
        if (missingFields.length === 0) {
          this.logSuccess('documentation', `${test.name} matches documented structure`);
        } else {
          this.logUXIssue('documentation', 'medium', `${test.name} missing documented fields: ${missingFields.join(', ')}`, 'Update documentation or API response');
        }

        console.log(`   ✅ ${test.description}: ${missingFields.length === 0 ? 'Matches docs' : 'Has differences'}`);
      } catch (error) {
        this.logUXIssue('documentation', 'high', `Documented endpoint ${test.endpoint} failed: ${error.message}`, 'Ensure documented endpoints work as described');
        console.log(`   ❌ ${test.description}: Failed`);
      }
    }
    console.log('');
  }

  generateUXReport() {
    console.log('📊 CLIENT UX VALIDATION REPORT');
    console.log('===============================');
    console.log('');

    // Categorize issues by severity
    const critical = this.uxIssues.filter(i => i.severity === 'critical');
    const high = this.uxIssues.filter(i => i.severity === 'high');
    const medium = this.uxIssues.filter(i => i.severity === 'medium');
    const low = this.uxIssues.filter(i => i.severity === 'low');

    console.log(`🚨 Critical Issues: ${critical.length}`);
    critical.forEach(issue => {
      console.log(`   • ${issue.description}`);
      console.log(`     💡 ${issue.suggestion}`);
    });

    console.log(`\n⚠️  High Priority Issues: ${high.length}`);
    high.forEach(issue => {
      console.log(`   • ${issue.description}`);
      console.log(`     💡 ${issue.suggestion}`);
    });

    console.log(`\n🔸 Medium Priority Issues: ${medium.length}`);
    medium.forEach(issue => {
      console.log(`   • ${issue.description}`);
    });

    console.log(`\n💡 Low Priority Issues: ${low.length}`);
    low.forEach(issue => {
      console.log(`   • ${issue.description}`);
    });

    // Performance analysis
    console.log(`\n⚡ Performance Analysis:`);
    const slowOperations = this.performanceMetrics.filter(m => !m.acceptable);
    console.log(`   📊 Slow operations: ${slowOperations.length}/${this.performanceMetrics.length}`);
    
    if (slowOperations.length > 0) {
      console.log(`   🐌 Needs optimization:`);
      slowOperations.forEach(op => {
        console.log(`      • ${op.operation}: ${op.responseTime}ms (expected ≤${op.expected}ms)`);
      });
    }

    // Success summary
    console.log(`\n✅ Successful UX Flows: ${this.successfulFlows.length}`);
    this.successfulFlows.forEach(flow => {
      console.log(`   • ${flow.description}`);
    });

    // Overall assessment
    const totalIssues = this.uxIssues.length;
    const totalSuccesses = this.successfulFlows.length;
    const uxScore = totalSuccesses / (totalSuccesses + totalIssues) * 100;

    console.log(`\n🏆 OVERALL UX SCORE: ${uxScore.toFixed(1)}%`);
    
    if (critical.length > 0) {
      console.log('🚨 CLIENT READINESS: NOT READY - Critical UX issues must be fixed');
    } else if (high.length > 2) {
      console.log('⚠️  CLIENT READINESS: NEEDS IMPROVEMENT - Address high priority UX issues');
    } else if (uxScore >= 80) {
      console.log('✅ CLIENT READINESS: READY - Good user experience');
    } else {
      console.log('🔧 CLIENT READINESS: PARTIAL - Some UX improvements recommended');
    }

    console.log('\n📋 RECOMMENDATIONS:');
    if (critical.length > 0) {
      console.log('1. Fix all critical UX issues before client onboarding');
    }
    if (high.length > 0) {
      console.log('2. Address high priority issues to improve client satisfaction');
    }
    if (slowOperations.length > 0) {
      console.log('3. Optimize slow operations for better responsiveness');
    }
    console.log('4. Consider user feedback sessions with real clients');
    console.log('5. Create comprehensive API guides and examples');
  }

  async runValidation() {
    console.log('🚀 Starting client UX validation...');
    console.log('');
    
    try {
      // Test complete client journey
      const { tenant, apiKey } = await this.testClientOnboarding();
      await this.testInvalidInputHandling(apiKey);
      await this.testTypicalClientWorkflow(apiKey);
      await this.testEdgeCasesAndLimits(apiKey);
      await this.testDocumentationAccuracy();
      
      // Generate comprehensive report
      this.generateUXReport();
      
    } catch (error) {
      console.error('💥 UX validation failed:', error.message);
      this.generateUXReport(); // Still show what we found
    }
  }
}

// Run the UX validation
const validator = new ClientUXValidator();
validator.runValidation();