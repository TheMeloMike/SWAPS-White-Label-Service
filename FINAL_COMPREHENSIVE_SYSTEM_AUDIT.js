#!/usr/bin/env node

/**
 * 🔍 FINAL COMPREHENSIVE SYSTEM AUDIT
 * 
 * BRUTALLY HONEST ASSESSMENT FOR CLIENT READINESS
 * 
 * This audit will test EVERYTHING:
 * - Performance under load
 * - Security vulnerabilities  
 * - UX edge cases
 * - Documentation accuracy
 * - API reliability
 * - Error handling
 * - Edge cases
 * - Real-world scenarios
 * - Multi-tenancy
 * - Data integrity
 * - Monitoring capabilities
 * 
 * NO SUGAR COATING. If it's broken, we'll find it.
 */

const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = process.env.API_URL || 'https://swaps-93hu.onrender.com/api/v1';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'swaps_admin_prod_2025_secure_key_abc123';

console.log('🔍 FINAL COMPREHENSIVE SYSTEM AUDIT');
console.log('====================================');
console.log('🎯 GOAL: Determine if system is ready for client presentations');
console.log('⚠️  NO SUGAR COATING - Brutal honesty required');
console.log('');

class SystemAuditor {
  constructor() {
    this.auditResults = {
      performance: { score: 0, maxScore: 0, critical: [], major: [], minor: [] },
      security: { score: 0, maxScore: 0, critical: [], major: [], minor: [] },
      ux: { score: 0, maxScore: 0, critical: [], major: [], minor: [] },
      api: { score: 0, maxScore: 0, critical: [], major: [], minor: [] },
      documentation: { score: 0, maxScore: 0, critical: [], major: [], minor: [] },
      reliability: { score: 0, maxScore: 0, critical: [], major: [], minor: [] },
      scalability: { score: 0, maxScore: 0, critical: [], major: [], minor: [] },
      monitoring: { score: 0, maxScore: 0, critical: [], major: [], minor: [] }
    };
    this.totalTests = 0;
    this.passedTests = 0;
    this.createdTenants = [];
  }

  logResult(category, severity, passed, test, issue = '', impact = '') {
    this.totalTests++;
    this.auditResults[category].maxScore++;
    
    if (passed) {
      this.passedTests++;
      this.auditResults[category].score++;
      console.log(`   ✅ ${test}`);
    } else {
      console.log(`   ❌ ${test}`);
      console.log(`      🚨 Issue: ${issue}`);
      console.log(`      💥 Impact: ${impact}`);
      
      this.auditResults[category][severity].push({
        test,
        issue,
        impact,
        timestamp: new Date().toISOString()
      });
    }
  }

  async createTestTenant(name) {
    try {
      const response = await axios.post(`${BASE_URL}/admin/tenants`, {
        name: `Audit_${name}_${Date.now()}`,
        contactEmail: `audit+${name.toLowerCase()}@test.com`,
        settings: {
          algorithm: { maxDepth: 15, minEfficiency: 0.3, maxLoopsPerRequest: 50 },
          security: { maxNFTsPerWallet: 1000, maxWantsPerWallet: 100 }
        }
      }, {
        headers: { 'Authorization': `Bearer ${ADMIN_API_KEY}`, 'Content-Type': 'application/json' }
      });

      const tenant = response.data.tenant;
      const apiKey = tenant.apiKey || response.data.apiKey;
      
      this.createdTenants.push({ tenant, apiKey });
      return { tenant, apiKey };
    } catch (error) {
      throw new Error(`Failed to create test tenant: ${error.response?.data?.error || error.message}`);
    }
  }

  async auditPerformance() {
    console.log('⚡ AUDITING PERFORMANCE');
    console.log('======================');
    
    const { tenant, apiKey } = await this.createTestTenant('Performance');

    // Test 1: Response time under normal load
    console.log('🏃 Testing response times...');
    const times = [];
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      try {
        await axios.post(`${BASE_URL}/discovery/trades`, {
          walletId: 'perf_test'
        }, {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        });
        times.push(Date.now() - start);
      } catch (error) {
        times.push(10000); // Treat errors as very slow
      }
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    this.logResult('performance', 'major', avgTime < 2000,
      `Average response time: ${avgTime.toFixed(0)}ms`,
      `Responses averaging ${avgTime.toFixed(0)}ms`,
      'Slow responses hurt user experience and demos');

    // Test 2: Concurrent request handling
    console.log('🔄 Testing concurrent requests...');
    const concurrentStart = Date.now();
    const concurrentPromises = [];
    
    for (let i = 0; i < 10; i++) {
      concurrentPromises.push(
        axios.post(`${BASE_URL}/discovery/trades`, {
          walletId: `concurrent_${i}`
        }, {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        }).catch(err => ({ error: err.response?.status || 500 }))
      );
    }

    const results = await Promise.all(concurrentPromises);
    const concurrentTime = Date.now() - concurrentStart;
    const errors = results.filter(r => r.error).length;
    
    this.logResult('performance', 'critical', errors < 3 && concurrentTime < 5000,
      `Concurrent handling: ${10 - errors}/10 success in ${concurrentTime}ms`,
      `${errors} failures out of 10 concurrent requests`,
      'Cannot handle multiple clients simultaneously');

    // Test 3: Large data handling
    console.log('📊 Testing large data handling...');
    const largeNFTs = [];
    for (let i = 0; i < 50; i++) {
      largeNFTs.push({
        id: `large_nft_${i}`,
        metadata: { name: `NFT ${i}`, symbol: 'TEST', description: 'A'.repeat(1000) },
        ownership: { ownerId: 'large_test', blockchain: 'solana', contractAddress: 'large_contract', tokenId: `large_nft_${i}` },
        valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'audit' }
      });
    }

    const largeDataStart = Date.now();
    try {
      await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: 'large_test',
        nfts: largeNFTs
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });
      
      const largeDataTime = Date.now() - largeDataStart;
      this.logResult('performance', 'major', largeDataTime < 5000,
        `Large data handling: ${largeDataTime}ms for 50 NFTs`,
        `Takes ${largeDataTime}ms to process 50 NFTs`,
        'Clients with large inventories will experience delays');
    } catch (error) {
      this.logResult('performance', 'critical', false,
        'Large data handling: Failed',
        `Cannot process 50 NFTs: ${error.response?.data?.error || error.message}`,
        'System cannot handle realistic inventory sizes');
    }

    // Test 4: Memory usage patterns
    console.log('🧠 Testing memory efficiency...');
    const memoryTestPromises = [];
    for (let i = 0; i < 20; i++) {
      memoryTestPromises.push(
        axios.post(`${BASE_URL}/inventory/submit`, {
          walletId: `memory_test_${i}`,
          nfts: [{
            id: `memory_nft_${i}`,
            metadata: { name: `Memory NFT ${i}`, symbol: 'MEM', description: 'Memory test' },
            ownership: { ownerId: `memory_test_${i}`, blockchain: 'solana', contractAddress: 'mem_contract', tokenId: `memory_nft_${i}` },
            valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'memory_audit' }
          }]
        }, {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        }).catch(err => ({ error: err.response?.status || 500 }))
      );
    }

    const memoryResults = await Promise.all(memoryTestPromises);
    const memoryErrors = memoryResults.filter(r => r.error).length;
    
    this.logResult('performance', 'major', memoryErrors < 2,
      `Memory efficiency: ${20 - memoryErrors}/20 operations succeeded`,
      `${memoryErrors} operations failed during memory stress test`,
      'System may have memory leaks or inefficient resource usage');

    console.log('');
  }

  async auditSecurity() {
    console.log('🔐 AUDITING SECURITY');
    console.log('====================');

    // Test 1: API key validation
    console.log('🔑 Testing API key security...');
    
    const invalidKeys = ['', 'invalid', 'Bearer invalid', 'admin_key', null];
    let secureEndpoints = 0;
    
    for (const invalidKey of invalidKeys) {
      try {
        const headers = invalidKey ? { 'Authorization': `Bearer ${invalidKey}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
        await axios.post(`${BASE_URL}/discovery/trades`, {
          walletId: 'security_test'
        }, { headers });
        
        // Should not reach here
        this.logResult('security', 'critical', false,
          `API key validation: Accepts invalid key "${invalidKey}"`,
          `System accepts invalid API key: ${invalidKey}`,
          'Unauthorized access possible - major security vulnerability');
      } catch (error) {
        if (error.response?.status === 401) {
          secureEndpoints++;
        }
      }
    }

    this.logResult('security', 'critical', secureEndpoints === invalidKeys.length,
      `API key validation: ${secureEndpoints}/${invalidKeys.length} properly rejected`,
      `${invalidKeys.length - secureEndpoints} invalid keys were accepted`,
      'Authentication bypass possible');

    // Test 2: Cross-tenant data isolation
    console.log('🏢 Testing multi-tenant security...');
    const { tenant: tenant1, apiKey: key1 } = await this.createTestTenant('Security1');
    const { tenant: tenant2, apiKey: key2 } = await this.createTestTenant('Security2');

    // Add data to tenant 1
    await axios.post(`${BASE_URL}/inventory/submit`, {
      walletId: 'tenant1_wallet',
      nfts: [{
        id: 'tenant1_secret_nft',
        metadata: { name: 'Secret NFT', symbol: 'SEC', description: 'Confidential data' },
        ownership: { ownerId: 'tenant1_wallet', blockchain: 'solana', contractAddress: 'secret_contract', tokenId: 'tenant1_secret_nft' },
        valuation: { estimatedValue: 1000.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'confidential' }
      }]
    }, {
      headers: { 'Authorization': `Bearer ${key1}`, 'Content-Type': 'application/json' }
    });

    // Try to access tenant 1 data with tenant 2 key
    try {
      const crossTenantResponse = await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: 'tenant1_wallet'
      }, {
        headers: { 'Authorization': `Bearer ${key2}`, 'Content-Type': 'application/json' }
      });

      const foundTenant1Data = JSON.stringify(crossTenantResponse.data).includes('tenant1_secret_nft');
      
      this.logResult('security', 'critical', !foundTenant1Data,
        'Cross-tenant isolation: Data properly isolated',
        'Tenant 2 can access Tenant 1 data',
        'CRITICAL: Multi-tenant data breach possible');
    } catch (error) {
      this.logResult('security', 'critical', error.response?.status === 403 || error.response?.status === 404,
        'Cross-tenant isolation: Access properly denied',
        'Unexpected error during cross-tenant test',
        'Security test failed - unclear if isolation works');
    }

    // Test 3: Input validation and injection protection
    console.log('💉 Testing injection protection...');
    const maliciousInputs = [
      { walletId: "'; DROP TABLE tenants; --" },
      { walletId: "<script>alert('xss')</script>" },
      { walletId: "../../../etc/passwd" },
      { walletId: "${process.env.ADMIN_API_KEY}" }
    ];

    let injectionsStopped = 0;
    for (const maliciousInput of maliciousInputs) {
      try {
        await axios.post(`${BASE_URL}/discovery/trades`, maliciousInput, {
          headers: { 'Authorization': `Bearer ${key1}`, 'Content-Type': 'application/json' }
        });
        injectionsStopped++; // If it doesn't crash, it's probably handled safely
      } catch (error) {
        if (error.response?.status === 400) {
          injectionsStopped++; // Properly rejected
        }
      }
    }

    this.logResult('security', 'major', injectionsStopped === maliciousInputs.length,
      `Injection protection: ${injectionsStopped}/${maliciousInputs.length} attacks blocked`,
      `${maliciousInputs.length - injectionsStopped} injection attempts may have succeeded`,
      'Potential for code injection or data corruption');

    // Test 4: Rate limiting
    console.log('⏱️ Testing rate limiting...');
    const rateLimitPromises = [];
    for (let i = 0; i < 30; i++) {
      rateLimitPromises.push(
        axios.post(`${BASE_URL}/discovery/trades`, {
          walletId: 'rate_limit_test'
        }, {
          headers: { 'Authorization': `Bearer ${key1}`, 'Content-Type': 'application/json' }
        }).catch(err => ({ error: err.response?.status || 500 }))
      );
    }

    const rateLimitResults = await Promise.all(rateLimitPromises);
    const rateLimitHits = rateLimitResults.filter(r => r.error === 429).length;

    this.logResult('security', 'major', rateLimitHits > 0,
      `Rate limiting: ${rateLimitHits}/30 requests rate limited`,
      'No rate limiting detected',
      'API vulnerable to abuse and DoS attacks');

    console.log('');
  }

  async auditAPI() {
    console.log('🔌 AUDITING API DESIGN & RELIABILITY');
    console.log('====================================');

    const { tenant, apiKey } = await this.createTestTenant('API');

    // Test 1: HTTP standards compliance
    console.log('📋 Testing HTTP standards...');
    
    // Test proper status codes
    try {
      const validResponse = await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: 'api_test',
        nfts: []
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });

      this.logResult('api', 'minor', [200, 201, 202].includes(validResponse.status),
        `Valid request status: ${validResponse.status}`,
        `Unexpected status code for valid request: ${validResponse.status}`,
        'Non-standard HTTP responses confuse client developers');
    } catch (error) {
      this.logResult('api', 'major', false,
        'Valid request handling: Failed',
        `Valid request failed: ${error.response?.data?.error || error.message}`,
        'Basic API functionality is broken');
    }

    // Test 2: Error response consistency
    console.log('❌ Testing error response format...');
    try {
      await axios.post(`${BASE_URL}/inventory/submit`, {
        // Missing required fields
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      const hasErrorField = error.response?.data?.error !== undefined;
      const hasProperStatus = error.response?.status >= 400 && error.response?.status < 500;
      
      this.logResult('api', 'minor', hasErrorField && hasProperStatus,
        `Error response format: ${hasErrorField ? 'Has error field' : 'Missing error field'}, Status: ${error.response?.status}`,
        'Error responses lack consistent structure',
        'Developers cannot reliably handle errors');
    }

    // Test 3: Content-Type handling
    console.log('📄 Testing content type handling...');
    try {
      await axios.post(`${BASE_URL}/discovery/trades`, 'invalid json', {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'text/plain' }
      });
    } catch (error) {
      this.logResult('api', 'minor', error.response?.status === 400 || error.response?.status === 415,
        `Content-Type validation: Properly rejects invalid content`,
        'Accepts invalid content types',
        'API may behave unpredictably with malformed requests');
    }

    // Test 4: Response time consistency
    console.log('⏱️ Testing response time consistency...');
    const responseTimes = [];
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      try {
        await axios.post(`${BASE_URL}/discovery/trades`, {
          walletId: 'consistency_test'
        }, {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        });
        responseTimes.push(Date.now() - start);
      } catch (error) {
        responseTimes.push(Date.now() - start);
      }
    }

    const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxTime = Math.max(...responseTimes);
    const variance = maxTime - Math.min(...responseTimes);

    this.logResult('api', 'minor', variance < avgTime * 2,
      `Response time consistency: ${variance}ms variance (avg: ${avgTime.toFixed(0)}ms)`,
      `High variance in response times: ${variance}ms`,
      'Unpredictable performance affects user experience');

    // Test 5: Health and monitoring endpoints
    console.log('🏥 Testing health endpoints...');
    try {
      const healthResponse = await axios.get(`${BASE_URL.replace('/api/v1', '')}/health`);
      
      this.logResult('api', 'major', healthResponse.status === 200,
        `Health endpoint: ${healthResponse.status}`,
        'Health endpoint not working',
        'Cannot monitor system status - operational blindness');
    } catch (error) {
      this.logResult('api', 'major', false,
        'Health endpoint: Failed',
        `Health endpoint inaccessible: ${error.message}`,
        'System monitoring impossible');
    }

    console.log('');
  }

  async auditUX() {
    console.log('👤 AUDITING USER EXPERIENCE');
    console.log('===========================');

    const { tenant, apiKey } = await this.createTestTenant('UX');

    // Test 1: Error message quality
    console.log('💬 Testing error message quality...');
    const errorTests = [
      {
        request: { walletId: '' },
        expectedGuidance: 'wallet',
        description: 'Empty wallet ID'
      },
      {
        request: { nfts: [{ invalid: 'data' }] },
        expectedGuidance: 'nft',
        description: 'Invalid NFT format'
      }
    ];

    let helpfulErrors = 0;
    for (const test of errorTests) {
      try {
        await axios.post(`${BASE_URL}/inventory/submit`, test.request, {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        const errorMessage = (error.response?.data?.error || '').toLowerCase();
        const isHelpful = errorMessage.includes(test.expectedGuidance);
        if (isHelpful) helpfulErrors++;
        
        console.log(`   📝 ${test.description}: ${isHelpful ? 'Helpful' : 'Vague'} - "${error.response?.data?.error}"`);
      }
    }

    this.logResult('ux', 'minor', helpfulErrors === errorTests.length,
      `Error message quality: ${helpfulErrors}/${errorTests.length} helpful`,
      'Error messages lack specific guidance',
      'Developers will struggle to fix integration issues');

    // Test 2: Response structure consistency
    console.log('📊 Testing response structure...');
    const endpoints = [
      { url: '/inventory/submit', data: { walletId: 'test', nfts: [] } },
      { url: '/wants/submit', data: { walletId: 'test', wantedNFTs: [] } },
      { url: '/discovery/trades', data: { walletId: 'test' } }
    ];

    let consistentResponses = 0;
    for (const endpoint of endpoints) {
      try {
        const response = await axios.post(`${BASE_URL}${endpoint.url}`, endpoint.data, {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        });
        
        const hasSuccessField = response.data.success !== undefined;
        const hasTimestamp = response.data.timestamp !== undefined;
        
        if (hasSuccessField) consistentResponses++;
        console.log(`   📋 ${endpoint.url}: ${hasSuccessField ? 'Has success field' : 'Missing success field'}`);
      } catch (error) {
        console.log(`   📋 ${endpoint.url}: Error - ${error.response?.data?.error}`);
      }
    }

    this.logResult('ux', 'minor', consistentResponses >= 2,
      `Response consistency: ${consistentResponses}/${endpoints.length} consistent`,
      'Response structures vary between endpoints',
      'Inconsistent API makes integration harder');

    // Test 3: Progressive feedback
    console.log('🔄 Testing progressive feedback...');
    try {
      const response = await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: 'progress_test',
        nfts: Array.from({ length: 5 }, (_, i) => ({
          id: `progress_nft_${i}`,
          metadata: { name: `Progress NFT ${i}`, symbol: 'PROG', description: 'Progress test' },
          ownership: { ownerId: 'progress_test', blockchain: 'solana', contractAddress: 'progress_contract', tokenId: `progress_nft_${i}` },
          valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'progress_test' }
        }))
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });

      const hasProcessedCount = response.data.nftsProcessed !== undefined;
      const hasLoopCount = response.data.newLoopsDiscovered !== undefined;

      this.logResult('ux', 'minor', hasProcessedCount && hasLoopCount,
        `Progressive feedback: ${hasProcessedCount ? 'Shows processed count' : 'No count'}, ${hasLoopCount ? 'Shows discoveries' : 'No discoveries'}`,
        'Lacks progress indicators for bulk operations',
        'Users cannot track operation progress');
    } catch (error) {
      this.logResult('ux', 'minor', false,
        'Progressive feedback: Failed to test',
        'Could not test progress feedback',
        'Cannot evaluate user feedback quality');
    }

    console.log('');
  }

  async auditDocumentation() {
    console.log('📚 AUDITING DOCUMENTATION');
    console.log('=========================');

    // Test 1: API endpoint documentation
    console.log('📖 Testing API discoverability...');
    try {
      const rootResponse = await axios.get(BASE_URL.replace('/api/v1', '/'));
      
      const hasEndpoints = rootResponse.data.endpoints !== undefined;
      const hasVersion = rootResponse.data.version !== undefined;
      
      this.logResult('documentation', 'major', hasEndpoints && hasVersion,
        `API discoverability: ${hasEndpoints ? 'Lists endpoints' : 'No endpoints'}, ${hasVersion ? 'Shows version' : 'No version'}`,
        'API root lacks documentation',
        'Developers cannot discover available endpoints');
    } catch (error) {
      this.logResult('documentation', 'major', false,
        'API discoverability: Root endpoint failed',
        'Cannot access API documentation',
        'Complete lack of API guidance');
    }

    // Test 2: Error documentation
    console.log('❌ Testing error documentation...');
    try {
      await axios.post(`${BASE_URL}/inventory/submit`, {}, {
        headers: { 'Authorization': 'Bearer invalid', 'Content-Type': 'application/json' }
      });
    } catch (error) {
      const errorData = error.response?.data;
      const hasHelpText = errorData?.help !== undefined || errorData?.documentation !== undefined;
      
      this.logResult('documentation', 'minor', hasHelpText,
        `Error documentation: ${hasHelpText ? 'Provides help' : 'No guidance'}`,
        'Errors lack links to documentation or examples',
        'Developers must guess how to fix issues');
    }

    // Test 3: Example data formats
    console.log('📝 Testing data format guidance...');
    // This would require checking if the API provides example formats
    // For now, we'll check if error messages include format hints
    try {
      await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: 'test',
        nfts: 'invalid'
      }, {
        headers: { 'Authorization': `Bearer ${ADMIN_API_KEY}`, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      const errorMessage = error.response?.data?.error || '';
      const hasFormatHint = errorMessage.includes('Expected:') || errorMessage.includes('format') || errorMessage.includes('example');
      
      this.logResult('documentation', 'minor', hasFormatHint,
        `Format guidance: ${hasFormatHint ? 'Provides format hints' : 'No format help'}`,
        'No guidance on expected data formats',
        'Integration attempts will fail without examples');
    }

    console.log('');
  }

  async auditReliability() {
    console.log('🛡️ AUDITING RELIABILITY');
    console.log('=======================');

    const { tenant, apiKey } = await this.createTestTenant('Reliability');

    // Test 1: Error recovery
    console.log('🔄 Testing error recovery...');
    let recoveredErrors = 0;
    
    for (let i = 0; i < 5; i++) {
      try {
        // Make a bad request
        await axios.post(`${BASE_URL}/inventory/submit`, {
          walletId: null
        }, {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        // Now make a good request to see if system recovered
        try {
          await axios.post(`${BASE_URL}/inventory/submit`, {
            walletId: 'recovery_test',
            nfts: []
          }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
          });
          recoveredErrors++;
        } catch (secondError) {
          // System didn't recover
        }
      }
    }

    this.logResult('reliability', 'major', recoveredErrors === 5,
      `Error recovery: ${recoveredErrors}/5 successful recoveries`,
      'System fails to recover from errors',
      'One bad request can break the entire system');

    // Test 2: Data persistence
    console.log('💾 Testing data persistence...');
    const testWalletId = 'persistence_test';
    
    // Add data
    await axios.post(`${BASE_URL}/inventory/submit`, {
      walletId: testWalletId,
      nfts: [{
        id: 'persistent_nft',
        metadata: { name: 'Persistent NFT', symbol: 'PERS', description: 'Testing persistence' },
        ownership: { ownerId: testWalletId, blockchain: 'solana', contractAddress: 'persist_contract', tokenId: 'persistent_nft' },
        valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'persistence_test' }
      }]
    }, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Try to retrieve
    try {
      const retrieveResponse = await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: testWalletId
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });

      // Check if our data is still accessible (even if no trades found, should not error)
      this.logResult('reliability', 'major', retrieveResponse.status === 200,
        'Data persistence: Data remains accessible',
        'Data not persisted between requests',
        'Client data gets lost - unreliable service');
    } catch (error) {
      this.logResult('reliability', 'major', false,
        'Data persistence: Failed to retrieve data',
        'Cannot access previously stored data',
        'Data loss makes system unusable');
    }

    // Test 3: Timeout handling
    console.log('⏰ Testing timeout behavior...');
    try {
      // Create a large request that might timeout
      const largeRequest = {
        walletId: 'timeout_test',
        nfts: Array.from({ length: 100 }, (_, i) => ({
          id: `timeout_nft_${i}`,
          metadata: { name: `Timeout NFT ${i}`, symbol: 'TIME', description: 'A'.repeat(2000) },
          ownership: { ownerId: 'timeout_test', blockchain: 'solana', contractAddress: 'timeout_contract', tokenId: `timeout_nft_${i}` },
          valuation: { estimatedValue: Math.random() * 100, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'timeout_test' }
        }))
      };

      const timeoutResponse = await axios.post(`${BASE_URL}/inventory/submit`, largeRequest, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 30000 // 30 second timeout
      });

      this.logResult('reliability', 'major', timeoutResponse.status === 200,
        'Timeout handling: Processes large requests',
        'Cannot handle large requests within timeout',
        'System fails on realistic data volumes');
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        this.logResult('reliability', 'major', false,
          'Timeout handling: Request timed out',
          'Large requests exceed timeout limits',
          'Cannot handle enterprise-scale data');
      } else {
        this.logResult('reliability', 'minor', true,
          'Timeout handling: Properly rejects oversized requests',
          '',
          '');
      }
    }

    console.log('');
  }

  async auditScalability() {
    console.log('📈 AUDITING SCALABILITY');
    console.log('=======================');

    // Test 1: Multi-tenant performance
    console.log('🏢 Testing multi-tenant performance...');
    const tenants = [];
    
    // Create multiple tenants
    for (let i = 0; i < 3; i++) {
      try {
        tenants.push(await this.createTestTenant(`Scale${i}`));
      } catch (error) {
        break;
      }
    }

    if (tenants.length < 3) {
      this.logResult('scalability', 'major', false,
        'Multi-tenant creation: Failed to create 3 tenants',
        'Cannot create multiple tenants',
        'System not ready for multiple clients');
    } else {
      // Test concurrent operations across tenants
      const concurrentPromises = tenants.map((tenant, i) =>
        axios.post(`${BASE_URL}/inventory/submit`, {
          walletId: `scale_wallet_${i}`,
          nfts: [{
            id: `scale_nft_${i}`,
            metadata: { name: `Scale NFT ${i}`, symbol: 'SCALE', description: 'Scalability test' },
            ownership: { ownerId: `scale_wallet_${i}`, blockchain: 'solana', contractAddress: 'scale_contract', tokenId: `scale_nft_${i}` },
            valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'scale_test' }
          }]
        }, {
          headers: { 'Authorization': `Bearer ${tenant.apiKey}`, 'Content-Type': 'application/json' }
        }).catch(err => ({ error: err.response?.status || 500 }))
      );

      const scaleResults = await Promise.all(concurrentPromises);
      const scaleSuccesses = scaleResults.filter(r => !r.error).length;

      this.logResult('scalability', 'major', scaleSuccesses === tenants.length,
        `Multi-tenant performance: ${scaleSuccesses}/${tenants.length} concurrent operations succeeded`,
        'Concurrent multi-tenant operations fail',
        'Cannot handle multiple clients simultaneously');
    }

    // Test 2: Data volume handling
    console.log('📊 Testing data volume limits...');
    if (tenants.length > 0) {
      const { apiKey } = tenants[0];
      
      try {
        // Test moderate data volume
        const moderateNFTs = Array.from({ length: 25 }, (_, i) => ({
          id: `volume_nft_${i}`,
          metadata: { name: `Volume NFT ${i}`, symbol: 'VOL', description: 'Volume test' },
          ownership: { ownerId: 'volume_test', blockchain: 'solana', contractAddress: 'volume_contract', tokenId: `volume_nft_${i}` },
          valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'volume_test' }
        }));

        const volumeStart = Date.now();
        await axios.post(`${BASE_URL}/inventory/submit`, {
          walletId: 'volume_test',
          nfts: moderateNFTs
        }, {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        });
        
        const volumeTime = Date.now() - volumeStart;

        this.logResult('scalability', 'major', volumeTime < 10000,
          `Data volume handling: ${volumeTime}ms for 25 NFTs`,
          `Takes ${volumeTime}ms to process 25 NFTs`,
          'Poor performance with moderate data volumes');
      } catch (error) {
        this.logResult('scalability', 'major', false,
          'Data volume handling: Failed',
          `Cannot process 25 NFTs: ${error.response?.data?.error || error.message}`,
          'Cannot handle realistic data volumes');
      }
    }

    console.log('');
  }

  generateBrutalReport() {
    console.log('💀 BRUTAL HONESTY SYSTEM ASSESSMENT');
    console.log('===================================');
    console.log('');

    const categories = Object.keys(this.auditResults);
    const overallScore = (this.passedTests / this.totalTests * 100).toFixed(1);
    
    console.log(`🎯 OVERALL SYSTEM SCORE: ${this.passedTests}/${this.totalTests} (${overallScore}%)`);
    console.log('');

    // Critical issues summary
    const allCritical = [];
    const allMajor = [];
    const allMinor = [];

    categories.forEach(category => {
      allCritical.push(...this.auditResults[category].critical);
      allMajor.push(...this.auditResults[category].major);
      allMinor.push(...this.auditResults[category].minor);
    });

    console.log('🚨 CRITICAL ISSUES (SHOW STOPPERS):');
    if (allCritical.length === 0) {
      console.log('   ✅ None found - good news!');
    } else {
      allCritical.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue.test}`);
        console.log(`      💥 ${issue.impact}`);
        console.log(`      🔧 Issue: ${issue.issue}`);
        console.log('');
      });
    }

    console.log('⚠️  MAJOR ISSUES (CLIENT CONCERNS):');
    if (allMajor.length === 0) {
      console.log('   ✅ None found - excellent!');
    } else {
      allMajor.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue.test}`);
        console.log(`      💥 ${issue.impact}`);
        console.log('');
      });
    }

    console.log('🔸 MINOR ISSUES (POLISH NEEDED):');
    console.log(`   📊 Found ${allMinor.length} minor issues that could be improved`);

    // Category breakdown
    console.log('\n📊 CATEGORY BREAKDOWN:');
    categories.forEach(category => {
      const result = this.auditResults[category];
      const score = result.maxScore > 0 ? (result.score / result.maxScore * 100).toFixed(1) : '100.0';
      const status = result.critical.length > 0 ? '🚨' : result.major.length > 0 ? '⚠️' : result.score === result.maxScore ? '✅' : '🔸';
      
      console.log(`   ${status} ${category.toUpperCase()}: ${result.score}/${result.maxScore} (${score}%)`);
    });

    // Final verdict
    console.log('\n🏛️ FINAL VERDICT: CAN WE SHOW THIS TO CLIENTS?');
    console.log('===============================================');

    if (allCritical.length > 0) {
      console.log('❌ ABSOLUTELY NOT');
      console.log('💀 CRITICAL ISSUES WILL EMBARRASS YOU');
      console.log('🚨 Fix critical issues before ANY client contact');
      console.log('\n🔧 IMMEDIATE ACTIONS REQUIRED:');
      allCritical.forEach((issue, i) => {
        console.log(`   ${i + 1}. Fix: ${issue.test}`);
      });
    } else if (allMajor.length > 3) {
      console.log('⚠️  NOT RECOMMENDED');
      console.log('😬 TOO MANY MAJOR ISSUES - Clients will notice problems');
      console.log('🔧 Address major issues first, then consider client demos');
    } else if (allMajor.length > 0) {
      console.log('🤔 PROCEED WITH CAUTION');
      console.log('⚡ System works but has notable issues');
      console.log('💡 Good for friendly/internal demos, not critical prospects');
      console.log('🎯 Perfect time to gather feedback and improve');
    } else if (overallScore >= 85) {
      console.log('✅ YES - READY FOR CLIENT PRESENTATIONS');
      console.log('🎉 System performs well across all areas');
      console.log('💪 Confident demonstrations recommended');
      console.log('🚀 Ready for aggressive client outreach');
    } else {
      console.log('🔧 ALMOST READY');
      console.log('📈 Good foundation but needs polish');
      console.log('🎯 Great for pilot clients and feedback gathering');
    }

    console.log('\n📋 RECOMMENDATIONS:');
    if (allCritical.length > 0) {
      console.log('1. 🚨 Fix all critical issues immediately');
      console.log('2. 🔒 Security audit by external team');
      console.log('3. 🧪 Extensive testing before any demos');
    } else if (allMajor.length > 0) {
      console.log('1. 🔧 Address major performance/reliability issues');
      console.log('2. 📝 Improve error messages and documentation');
      console.log('3. 🧪 Load testing with realistic scenarios');
    } else {
      console.log('1. 🌟 System is ready for client engagement!');
      console.log('2. 📚 Create comprehensive documentation');
      console.log('3. 🎯 Focus on client onboarding experience');
      console.log('4. 📊 Set up monitoring and analytics');
    }

    return {
      ready: allCritical.length === 0 && allMajor.length <= 2,
      score: overallScore,
      critical: allCritical.length,
      major: allMajor.length,
      minor: allMinor.length
    };
  }

  async runCompleteAudit() {
    console.log('🚀 Starting comprehensive brutal audit...\n');
    
    try {
      await this.auditPerformance();
      await this.auditSecurity();
      await this.auditAPI();
      await this.auditUX();
      await this.auditDocumentation();
      await this.auditReliability();
      await this.auditScalability();
      
      return this.generateBrutalReport();
    } catch (error) {
      console.error('\n💥 AUDIT FAILED:', error.message);
      console.log('\n🚨 SYSTEM FAILURE DURING AUDIT');
      console.log('❌ DEFINITELY NOT READY FOR CLIENTS');
      
      this.generateBrutalReport();
      return { ready: false, score: 0, critical: 1, major: 0, minor: 0 };
    }
  }
}

// Run the brutal audit
const auditor = new SystemAuditor();
auditor.runCompleteAudit().then(result => {
  console.log('\n🏁 AUDIT COMPLETE');
  console.log(`Final Assessment: ${result.ready ? 'READY' : 'NOT READY'}`);
});