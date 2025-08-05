#!/usr/bin/env node

/**
 * 🔍 AUDIT OF TEST METHODOLOGY
 * 
 * Before declaring the system broken, let's make sure my tests are valid:
 * 1. Are my performance expectations realistic?
 * 2. Am I testing the right endpoints correctly?
 * 3. Are my concurrent tests causing artificial bottlenecks?
 * 4. Is the system being tested under fair conditions?
 * 5. Are there test methodology flaws?
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'https://swaps-93hu.onrender.com/api/v1';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'swaps_admin_prod_2025_secure_key_abc123';

console.log('🔍 AUDITING TEST METHODOLOGY');
console.log('============================');
console.log('🎯 GOAL: Verify my tests are fair and accurate');
console.log('⚠️  Check for test-induced issues vs. real problems');
console.log('');

class TestAuditor {
  constructor() {
    this.findings = [];
    this.tenant = null;
    this.apiKey = null;
  }

  log(category, finding, details = '') {
    this.findings.push({ category, finding, details, timestamp: new Date().toISOString() });
    console.log(`   📝 ${category}: ${finding}`);
    if (details) console.log(`      📋 ${details}`);
  }

  async setupTestTenant() {
    console.log('🏗️ Setting up clean test environment...');
    try {
      const response = await axios.post(`${BASE_URL}/admin/tenants`, {
        name: 'Test_Methodology_Audit',
        contactEmail: 'audit@methodology.test',
        settings: {
          algorithm: { maxDepth: 15, minEfficiency: 0.3, maxLoopsPerRequest: 50 },
          security: { maxNFTsPerWallet: 1000, maxWantsPerWallet: 100 }
        }
      }, {
        headers: { 'Authorization': `Bearer ${ADMIN_API_KEY}`, 'Content-Type': 'application/json' }
      });

      this.tenant = response.data.tenant;
      this.apiKey = this.tenant.apiKey || response.data.apiKey;
      
      console.log(`   ✅ Test tenant created: ${this.tenant.id}`);
      console.log('');
      
    } catch (error) {
      throw new Error(`Failed to setup test environment: ${error.response?.data?.error || error.message}`);
    }
  }

  async auditResponseTimeTest() {
    console.log('⏱️ AUDITING RESPONSE TIME METHODOLOGY');
    console.log('=====================================');

    // Test 1: Is my baseline response time test realistic?
    console.log('🧪 Testing individual response times (clean environment)...');
    
    const cleanTimes = [];
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      try {
        await axios.post(`${BASE_URL}/discovery/trades`, {
          walletId: `clean_test_${i}`
        }, {
          headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
        });
        const responseTime = Date.now() - start;
        cleanTimes.push(responseTime);
        console.log(`   🕐 Request ${i + 1}: ${responseTime}ms`);
      } catch (error) {
        console.log(`   ❌ Request ${i + 1}: Failed - ${error.response?.data?.error || error.message}`);
        cleanTimes.push(10000); // Mark as very slow
      }
    }

    const avgClean = cleanTimes.reduce((a, b) => a + b, 0) / cleanTimes.length;
    
    this.log('Response Times', `Clean environment average: ${avgClean.toFixed(0)}ms`, 
      avgClean > 4000 ? 'Confirms slow responses - not test artifact' : 'Response times acceptable when tested individually');

    // Test 2: Are my expectations realistic for this type of system?
    console.log('\n🎯 Analyzing performance expectations...');
    
    // For a sophisticated graph algorithm system, what's realistic?
    const expectations = {
      simple_query: 1000,      // Simple discovery: <1s
      moderate_data: 2000,     // With some data: <2s  
      large_batch: 5000,       // Large operations: <5s
      complex_computation: 10000 // Complex algorithms: <10s
    };

    this.log('Expectations', 'Simple query target: <1000ms', 
      avgClean <= expectations.simple_query ? 'REALISTIC - system meets expectation' : 'AGGRESSIVE - may be too strict for graph algorithms');

    this.log('Expectations', 'Current average vs. simple target', 
      `${avgClean.toFixed(0)}ms vs ${expectations.simple_query}ms target`);

    console.log('');
  }

  async auditConcurrentTest() {
    console.log('🔄 AUDITING CONCURRENT REQUEST METHODOLOGY');
    console.log('==========================================');

    // Test 1: Was my concurrent test design flawed?
    console.log('🧪 Testing concurrent methodology issues...');

    this.log('Concurrent Design', 'Original test: 10 simultaneous requests to discovery endpoint', 
      'May be testing worst-case scenario rather than typical usage');

    // Test 2: Is 10 concurrent requests realistic?
    console.log('\n📊 Analyzing concurrent load expectations...');
    
    this.log('Load Expectations', 'Target: 10 concurrent users', 
      'For a B2B API, 10 concurrent requests is reasonable for enterprise clients');

    // Test 3: Better concurrent test methodology
    console.log('\n🔬 Testing improved concurrent methodology...');
    
    // Stagger requests slightly (more realistic)
    const staggeredStart = Date.now();
    const staggeredPromises = [];
    
    for (let i = 0; i < 5; i++) {
      // Small stagger (100ms) - more realistic than perfect simultaneity
      setTimeout(() => {
        staggeredPromises.push(
          axios.post(`${BASE_URL}/discovery/trades`, {
            walletId: `staggered_${i}`
          }, {
            headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
          }).catch(err => ({ error: err.response?.status || 500, time: Date.now() - staggeredStart }))
        );
      }, i * 100);
    }

    // Wait for stagger to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const staggeredResults = await Promise.all(staggeredPromises);
    const staggeredTime = Date.now() - staggeredStart;
    const staggeredErrors = staggeredResults.filter(r => r.error).length;

    this.log('Staggered Test', `5 staggered requests: ${staggeredTime}ms total, ${staggeredErrors} errors`, 
      staggeredTime > 10000 ? 'Still slow - confirms system issue' : 'Better performance with realistic timing');

    console.log('');
  }

  async auditLargeDataTest() {
    console.log('📊 AUDITING LARGE DATA TEST METHODOLOGY');
    console.log('=======================================');

    // Test 1: Is 50 NFTs actually "large"?
    console.log('🧪 Analyzing data volume expectations...');
    
    this.log('Data Volume', 'Original test: 50 NFTs in single request', 
      'For NFT collections, 50 items is moderate, not large. Enterprise clients may have 1000+ NFTs');

    // Test 2: Test smaller, more realistic increments
    console.log('\n📈 Testing incremental data volumes...');
    
    const volumes = [1, 5, 10, 25];
    
    for (const volume of volumes) {
      const testNFTs = Array.from({ length: volume }, (_, i) => ({
        id: `incremental_nft_${volume}_${i}`,
        metadata: { name: `Test NFT ${i}`, symbol: 'TEST', description: 'Incremental test' },
        ownership: { ownerId: `incremental_wallet_${volume}`, blockchain: 'solana', contractAddress: 'test_contract', tokenId: `incremental_nft_${volume}_${i}` },
        valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'incremental_test' }
      }));

      const start = Date.now();
      try {
        await axios.post(`${BASE_URL}/inventory/submit`, {
          walletId: `incremental_wallet_${volume}`,
          nfts: testNFTs
        }, {
          headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
        });
        
        const time = Date.now() - start;
        console.log(`   📊 ${volume} NFTs: ${time}ms (${(time/volume).toFixed(0)}ms per NFT)`);
        
        this.log('Incremental Volume', `${volume} NFTs: ${time}ms`, 
          time > volume * 100 ? 'Performance degrades with volume' : 'Scales reasonably with data size');
          
      } catch (error) {
        console.log(`   ❌ ${volume} NFTs: Failed - ${error.response?.data?.error || error.message}`);
      }
    }

    console.log('');
  }

  async auditRateLimitTest() {
    console.log('⏱️ AUDITING RATE LIMIT TEST METHODOLOGY');
    console.log('=======================================');

    // Test 1: Was my rate limit test approach correct?
    console.log('🧪 Analyzing rate limit test design...');
    
    this.log('Rate Limit Design', 'Original test: 30 rapid requests', 
      'Design is reasonable - should trigger rate limiting if implemented');

    // Test 2: Check if rate limiting is actually configured
    console.log('\n🔍 Testing rate limit configuration...');
    
    // Check response headers for rate limit info
    try {
      const response = await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: 'rate_limit_check'
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });

      const rateLimitHeaders = Object.keys(response.headers).filter(h => 
        h.toLowerCase().includes('rate') || h.toLowerCase().includes('limit') || h.toLowerCase().includes('quota')
      );

      this.log('Rate Limit Headers', `Found headers: ${rateLimitHeaders.length}`, 
        rateLimitHeaders.length > 0 ? `Headers: ${rateLimitHeaders.join(', ')}` : 'No rate limit headers - may not be implemented');

    } catch (error) {
      this.log('Rate Limit Check', 'Failed to check headers', error.message);
    }

    // Test 3: More gradual rate limit test
    console.log('\n🔬 Testing gradual rate limiting...');
    
    let rateLimitDetected = false;
    for (let i = 0; i < 10; i++) {
      try {
        const response = await axios.post(`${BASE_URL}/discovery/trades`, {
          walletId: `gradual_rate_${i}`
        }, {
          headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
        });
        
        console.log(`   ✅ Request ${i + 1}: ${response.status}`);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        if (error.response?.status === 429) {
          rateLimitDetected = true;
          console.log(`   🛑 Request ${i + 1}: Rate limited (429)`);
          break;
        } else {
          console.log(`   ❌ Request ${i + 1}: Error ${error.response?.status || 'unknown'}`);
        }
      }
    }

    this.log('Gradual Rate Test', `Rate limiting: ${rateLimitDetected ? 'Detected' : 'Not detected'}`, 
      rateLimitDetected ? 'Rate limiting is working' : 'Confirms no rate limiting implemented');

    console.log('');
  }

  async auditTestEnvironment() {
    console.log('🌍 AUDITING TEST ENVIRONMENT');
    console.log('============================');

    // Test 1: Network latency to API
    console.log('🌐 Testing network conditions...');
    
    const networkTests = [];
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      try {
        await axios.get(`${BASE_URL.replace('/api/v1', '')}/health`);
        networkTests.push(Date.now() - start);
      } catch (error) {
        networkTests.push(1000); // Assume 1s for failed requests
      }
    }

    const avgNetwork = networkTests.reduce((a, b) => a + b, 0) / networkTests.length;
    
    this.log('Network Latency', `Average health check: ${avgNetwork.toFixed(0)}ms`, 
      avgNetwork > 500 ? 'High network latency may be affecting tests' : 'Network latency acceptable');

    // Test 2: API server responsiveness
    console.log('\n🖥️ Testing API server responsiveness...');
    
    try {
      const serverResponse = await axios.get(`${BASE_URL.replace('/api/v1', '')}/`);
      
      this.log('Server Health', `Root endpoint: ${serverResponse.status}`, 
        'API server is responding');
        
      console.log(`   📊 Server info: ${JSON.stringify(serverResponse.data).substring(0, 100)}...`);
      
    } catch (error) {
      this.log('Server Health', 'Root endpoint failed', 
        'API server may be experiencing issues');
    }

    console.log('');
  }

  generateTestAuditReport() {
    console.log('📊 TEST METHODOLOGY AUDIT REPORT');
    console.log('================================');
    console.log('');

    // Categorize findings
    const responseFindings = this.findings.filter(f => f.category.includes('Response') || f.category.includes('Expectations'));
    const concurrentFindings = this.findings.filter(f => f.category.includes('Concurrent') || f.category.includes('Staggered'));
    const dataFindings = this.findings.filter(f => f.category.includes('Data') || f.category.includes('Volume'));
    const rateLimitFindings = this.findings.filter(f => f.category.includes('Rate'));
    const environmentFindings = this.findings.filter(f => f.category.includes('Network') || f.category.includes('Server'));

    console.log('🎯 RESPONSE TIME METHODOLOGY:');
    responseFindings.forEach(f => {
      console.log(`   📝 ${f.finding}`);
      if (f.details) console.log(`      📋 ${f.details}`);
    });

    console.log('\n🔄 CONCURRENT REQUEST METHODOLOGY:');
    concurrentFindings.forEach(f => {
      console.log(`   📝 ${f.finding}`);
      if (f.details) console.log(`      📋 ${f.details}`);
    });

    console.log('\n📊 DATA VOLUME METHODOLOGY:');
    dataFindings.forEach(f => {
      console.log(`   📝 ${f.finding}`);
      if (f.details) console.log(`      📋 ${f.details}`);
    });

    console.log('\n⏱️ RATE LIMITING METHODOLOGY:');
    rateLimitFindings.forEach(f => {
      console.log(`   📝 ${f.finding}`);
      if (f.details) console.log(`      📋 ${f.details}`);
    });

    console.log('\n🌍 TEST ENVIRONMENT:');
    environmentFindings.forEach(f => {
      console.log(`   📝 ${f.finding}`);
      if (f.details) console.log(`      📋 ${f.details}`);
    });

    // Overall assessment
    console.log('\n🏆 METHODOLOGY ASSESSMENT:');
    console.log('=========================');

    const testFlaws = this.findings.filter(f => 
      f.details.includes('too strict') || 
      f.details.includes('test artifact') || 
      f.details.includes('affecting tests')
    ).length;

    const confirmedIssues = this.findings.filter(f => 
      f.details.includes('confirms') || 
      f.details.includes('system issue') ||
      f.details.includes('Still slow')
    ).length;

    if (testFlaws > confirmedIssues) {
      console.log('⚠️  TEST METHODOLOGY ISSUES DETECTED');
      console.log('🔧 My original tests may have been unfair or too aggressive');
      console.log('📋 System performance may be acceptable for its complexity');
    } else if (confirmedIssues > testFlaws) {
      console.log('✅ TEST METHODOLOGY VALIDATED');
      console.log('🚨 Original test results appear accurate');
      console.log('💀 System performance issues are real');
    } else {
      console.log('🤔 MIXED RESULTS');
      console.log('📊 Some test issues, some real performance problems');
      console.log('🔍 Need more targeted investigation');
    }

    console.log('\n🎯 RECOMMENDATIONS:');
    if (testFlaws > 0) {
      console.log('1. 🧪 Revise performance expectations for graph algorithm complexity');
      console.log('2. 📊 Use more realistic test scenarios (staggered requests, moderate data)');
      console.log('3. 🎯 Focus on user experience rather than absolute speed');
    }
    if (confirmedIssues > 0) {
      console.log('1. 🚨 Address confirmed performance bottlenecks');
      console.log('2. ⚡ Optimize critical paths identified in testing');
      console.log('3. 🔧 Implement missing features (rate limiting)');
    }

    return {
      testMethodologyFlaws: testFlaws,
      confirmedSystemIssues: confirmedIssues,
      needsInvestigation: testFlaws === confirmedIssues
    };
  }

  async runTestAudit() {
    try {
      await this.setupTestTenant();
      await this.auditResponseTimeTest();
      await this.auditConcurrentTest();
      await this.auditLargeDataTest();
      await this.auditRateLimitTest();
      await this.auditTestEnvironment();
      
      return this.generateTestAuditReport();
    } catch (error) {
      console.error('💥 Test audit failed:', error.message);
      return { testMethodologyFlaws: 0, confirmedSystemIssues: 1, needsInvestigation: false };
    }
  }
}

// Run the test methodology audit
const auditor = new TestAuditor();
auditor.runTestAudit().then(result => {
  console.log('\n🏁 TEST AUDIT COMPLETE');
  if (result.testMethodologyFlaws > result.confirmedSystemIssues) {
    console.log('🔧 CONCLUSION: Tests were too aggressive - system may be acceptable');
  } else if (result.confirmedSystemIssues > result.testMethodologyFlaws) {
    console.log('🚨 CONCLUSION: Tests were accurate - system has real issues');
  } else {
    console.log('🤔 CONCLUSION: Mixed results - need deeper investigation');
  }
});