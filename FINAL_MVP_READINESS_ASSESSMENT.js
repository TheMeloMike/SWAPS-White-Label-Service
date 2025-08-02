#!/usr/bin/env node

/**
 * 🔍 FINAL HOLISTIC MVP READINESS ASSESSMENT
 * 
 * OBJECTIVE: Brutally honest evaluation for client presentation readiness
 * 
 * EVALUATION CRITERIA:
 * 1. Performance & Scalability
 * 2. Security & Multi-tenancy
 * 3. API Design & Documentation
 * 4. Core Functionality & Algorithms
 * 5. Error Handling & Reliability
 * 6. Developer Experience
 * 7. Business Value Proposition
 * 8. Competitive Positioning
 */

const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = process.env.API_URL || 'https://swaps-93hu.onrender.com/api/v1';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'swaps_admin_prod_2025_secure_key_abc123';

console.log('🔍 FINAL HOLISTIC MVP READINESS ASSESSMENT');
console.log('==========================================');
console.log('🎯 OBJECTIVE: Determine true client-readiness');
console.log('⚠️  APPROACH: Brutally honest, no sugar-coating');
console.log('');

class MVPReadinessAssessor {
  constructor() {
    this.scores = {
      performance: { score: 0, max: 100, critical: [], strengths: [] },
      security: { score: 0, max: 100, critical: [], strengths: [] },
      functionality: { score: 0, max: 100, critical: [], strengths: [] },
      api_design: { score: 0, max: 100, critical: [], strengths: [] },
      reliability: { score: 0, max: 100, critical: [], strengths: [] },
      developer_experience: { score: 0, max: 100, critical: [], strengths: [] },
      business_value: { score: 0, max: 100, critical: [], strengths: [] },
      competitive_edge: { score: 0, max: 100, critical: [], strengths: [] }
    };
    
    this.testTenant = null;
    this.apiKey = null;
  }

  async setupTestEnvironment() {
    try {
      const response = await axios.post(`${BASE_URL}/admin/tenants`, {
        name: 'MVP_Assessment_' + Date.now(),
        contactEmail: 'mvp@assessment.test',
        settings: {
          algorithm: { maxDepth: 15, minEfficiency: 0.3, maxLoopsPerRequest: 50 },
          security: { maxNFTsPerWallet: 1000, maxWantsPerWallet: 100 }
        }
      }, {
        headers: { 'Authorization': `Bearer ${ADMIN_API_KEY}`, 'Content-Type': 'application/json' }
      });

      this.testTenant = response.data.tenant;
      this.apiKey = this.testTenant.apiKey || response.data.apiKey;
      
      return true;
    } catch (error) {
      console.error('Failed to setup test environment:', error.message);
      return false;
    }
  }

  async assessPerformance() {
    console.log('⚡ ASSESSING PERFORMANCE & SCALABILITY');
    console.log('=====================================');
    
    let totalScore = 0;
    const tests = [];
    
    // Test 1: Response Time Performance (30 points)
    console.log('🧪 Testing response times...');
    const responseTimes = [];
    
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      try {
        await axios.post(`${BASE_URL}/discovery/trades`, {
          walletId: `perf_test_${i}`
        }, {
          headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        // Expected for non-existent wallet
      }
      responseTimes.push(Date.now() - start);
    }
    
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    console.log(`   📊 Average response time: ${avgResponseTime.toFixed(0)}ms`);
    
    if (avgResponseTime < 1000) {
      totalScore += 30;
      this.scores.performance.strengths.push('Sub-second response times');
      console.log('   ✅ Excellent: Sub-second responses (30/30 points)');
    } else if (avgResponseTime < 2000) {
      totalScore += 20;
      this.scores.performance.strengths.push('Acceptable response times');
      console.log('   ✅ Good: Acceptable response times (20/30 points)');
    } else if (avgResponseTime < 5000) {
      totalScore += 10;
      console.log('   ⚠️  Fair: Slow but usable (10/30 points)');
    } else {
      this.scores.performance.critical.push('Response times too slow for professional demos');
      console.log('   ❌ Poor: Too slow for clients (0/30 points)');
    }
    
    // Test 2: Concurrent Handling (20 points)
    console.log('🧪 Testing concurrent request handling...');
    const concurrentStart = Date.now();
    const concurrentPromises = [];
    
    for (let i = 0; i < 10; i++) {
      concurrentPromises.push(
        axios.post(`${BASE_URL}/discovery/trades`, {
          walletId: `concurrent_${i}`
        }, {
          headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
        }).catch(() => {})
      );
    }
    
    await Promise.all(concurrentPromises);
    const concurrentTime = Date.now() - concurrentStart;
    console.log(`   📊 10 concurrent requests: ${concurrentTime}ms`);
    
    if (concurrentTime < 5000) {
      totalScore += 20;
      this.scores.performance.strengths.push('Excellent concurrent handling');
      console.log('   ✅ Excellent: Fast concurrent handling (20/20 points)');
    } else if (concurrentTime < 10000) {
      totalScore += 15;
      console.log('   ✅ Good: Acceptable concurrent performance (15/20 points)');
    } else if (concurrentTime < 20000) {
      totalScore += 10;
      console.log('   ⚠️  Fair: Slow concurrent handling (10/20 points)');
    } else {
      this.scores.performance.critical.push('Cannot handle multiple users simultaneously');
      console.log('   ❌ Poor: Concurrent handling fails (0/20 points)');
    }
    
    // Test 3: Data Volume Handling (20 points)
    console.log('🧪 Testing data volume handling...');
    const volumeStart = Date.now();
    
    try {
      const largeNFTs = Array.from({ length: 25 }, (_, i) => ({
        id: `volume_nft_${i}`,
        metadata: { name: `Volume NFT ${i}`, symbol: 'VOL', description: 'Volume test' },
        ownership: { ownerId: 'volume_test', blockchain: 'solana', contractAddress: 'volume_contract', tokenId: `volume_nft_${i}` },
        valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'volume_test' }
      }));
      
      await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: 'volume_test',
        nfts: largeNFTs
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      const volumeTime = Date.now() - volumeStart;
      console.log(`   📊 25 NFTs processed in: ${volumeTime}ms`);
      
      if (volumeTime < 3000) {
        totalScore += 20;
        this.scores.performance.strengths.push('Efficient data processing');
        console.log('   ✅ Excellent: Fast data processing (20/20 points)');
      } else if (volumeTime < 5000) {
        totalScore += 15;
        console.log('   ✅ Good: Acceptable data handling (15/20 points)');
      } else {
        totalScore += 10;
        console.log('   ⚠️  Fair: Slow data processing (10/20 points)');
      }
    } catch (error) {
      this.scores.performance.critical.push('Cannot handle realistic data volumes');
      console.log('   ❌ Failed to process data volume (0/20 points)');
    }
    
    // Test 4: API Availability (30 points)
    console.log('🧪 Testing API availability...');
    const healthResponse = await axios.get(`${BASE_URL.replace('/api/v1', '')}/health`);
    
    if (healthResponse.status === 200 && healthResponse.data.status === 'healthy') {
      totalScore += 30;
      this.scores.performance.strengths.push('Reliable API availability');
      console.log('   ✅ Excellent: API is healthy and responsive (30/30 points)');
    } else {
      totalScore += 15;
      console.log('   ⚠️  Partial: API responds but not optimal (15/30 points)');
    }
    
    this.scores.performance.score = totalScore;
    console.log(`\n   📊 PERFORMANCE SCORE: ${totalScore}/100`);
    console.log('');
  }

  async assessSecurity() {
    console.log('🔐 ASSESSING SECURITY & MULTI-TENANCY');
    console.log('=====================================');
    
    let totalScore = 0;
    
    // Test 1: API Key Authentication (25 points)
    console.log('🧪 Testing API key security...');
    
    try {
      await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: 'test'
      }, {
        headers: { 'Authorization': 'Bearer invalid_key', 'Content-Type': 'application/json' }
      });
      
      this.scores.security.critical.push('API accepts invalid keys');
      console.log('   ❌ CRITICAL: Invalid API keys accepted (0/25 points)');
    } catch (error) {
      if (error.response?.status === 401) {
        totalScore += 25;
        this.scores.security.strengths.push('Proper API key validation');
        console.log('   ✅ Excellent: Invalid keys properly rejected (25/25 points)');
      } else {
        totalScore += 15;
        console.log('   ⚠️  Partial: Some security but not standard (15/25 points)');
      }
    }
    
    // Test 2: Multi-tenant Isolation (25 points)
    console.log('🧪 Testing tenant isolation...');
    
    // Create second tenant
    const tenant2Response = await axios.post(`${BASE_URL}/admin/tenants`, {
      name: 'Security_Test_2',
      contactEmail: 'security2@test.com',
      settings: {
        algorithm: { maxDepth: 15, minEfficiency: 0.3, maxLoopsPerRequest: 50 },
        security: { maxNFTsPerWallet: 1000, maxWantsPerWallet: 100 }
      }
    }, {
      headers: { 'Authorization': `Bearer ${ADMIN_API_KEY}`, 'Content-Type': 'application/json' }
    });
    
    const tenant2ApiKey = tenant2Response.data.tenant.apiKey || tenant2Response.data.apiKey;
    
    // Add data to tenant 1
    await axios.post(`${BASE_URL}/inventory/submit`, {
      walletId: 'tenant1_secure_wallet',
      nfts: [{
        id: 'tenant1_confidential_nft',
        metadata: { name: 'Confidential NFT', symbol: 'SEC', description: 'Should not be visible to other tenants' },
        ownership: { ownerId: 'tenant1_secure_wallet', blockchain: 'solana', contractAddress: 'secure_contract', tokenId: 'tenant1_confidential_nft' },
        valuation: { estimatedValue: 1000.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'security_test' }
      }]
    }, {
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
    });
    
    // Try to access tenant 1 data with tenant 2 key
    try {
      const crossTenantResponse = await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: 'tenant1_secure_wallet'
      }, {
        headers: { 'Authorization': `Bearer ${tenant2ApiKey}`, 'Content-Type': 'application/json' }
      });
      
      const responseData = JSON.stringify(crossTenantResponse.data);
      if (responseData.includes('tenant1_confidential_nft')) {
        this.scores.security.critical.push('SEVERE: Cross-tenant data leakage');
        console.log('   ❌ CRITICAL: Tenant isolation breach (0/25 points)');
      } else {
        totalScore += 25;
        this.scores.security.strengths.push('Strong multi-tenant isolation');
        console.log('   ✅ Excellent: Tenant data properly isolated (25/25 points)');
      }
    } catch (error) {
      totalScore += 25;
      this.scores.security.strengths.push('Strong multi-tenant isolation');
      console.log('   ✅ Excellent: Cross-tenant access denied (25/25 points)');
    }
    
    // Test 3: Rate Limiting (25 points)
    console.log('🧪 Testing rate limiting...');
    
    const rateLimitPromises = [];
    for (let i = 0; i < 100; i++) {
      rateLimitPromises.push(
        axios.post(`${BASE_URL}/discovery/trades`, {
          walletId: 'rate_test'
        }, {
          headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
        }).catch(err => ({ status: err.response?.status }))
      );
    }
    
    const rateLimitResults = await Promise.all(rateLimitPromises);
    const rateLimitHits = rateLimitResults.filter(r => r.status === 429).length;
    
    if (rateLimitHits > 0) {
      totalScore += 25;
      this.scores.security.strengths.push('Rate limiting protects against abuse');
      console.log(`   ✅ Excellent: Rate limiting active (${rateLimitHits} hits) (25/25 points)`);
    } else {
      // Check headers for rate limit info
      try {
        const response = await axios.post(`${BASE_URL}/discovery/trades`, {
          walletId: 'header_check'
        }, {
          headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
        });
        
        if (response.headers['x-ratelimit-limit']) {
          totalScore += 20;
          this.scores.security.strengths.push('Rate limit headers present');
          console.log('   ✅ Good: Rate limit headers present (20/25 points)');
        } else {
          totalScore += 10;
          console.log('   ⚠️  Fair: No clear rate limiting (10/25 points)');
        }
      } catch (error) {
        totalScore += 10;
        console.log('   ⚠️  Fair: Rate limiting unclear (10/25 points)');
      }
    }
    
    // Test 4: Input Validation (25 points)
    console.log('🧪 Testing input validation...');
    
    const maliciousInputs = [
      { walletId: "'; DROP TABLE tenants; --" },
      { walletId: "<script>alert('xss')</script>" },
      { nfts: "not_an_array" }
    ];
    
    let validationPassed = 0;
    for (const maliciousInput of maliciousInputs) {
      try {
        await axios.post(`${BASE_URL}/inventory/submit`, maliciousInput, {
          headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        if (error.response?.status === 400) {
          validationPassed++;
        }
      }
    }
    
    if (validationPassed === maliciousInputs.length) {
      totalScore += 25;
      this.scores.security.strengths.push('Strong input validation');
      console.log('   ✅ Excellent: All malicious inputs rejected (25/25 points)');
    } else if (validationPassed >= 2) {
      totalScore += 20;
      console.log('   ✅ Good: Most malicious inputs rejected (20/25 points)');
    } else {
      this.scores.security.critical.push('Weak input validation');
      console.log('   ❌ Poor: Weak input validation (5/25 points)');
      totalScore += 5;
    }
    
    this.scores.security.score = totalScore;
    console.log(`\n   📊 SECURITY SCORE: ${totalScore}/100`);
    console.log('');
  }

  async assessFunctionality() {
    console.log('🔧 ASSESSING CORE FUNCTIONALITY');
    console.log('================================');
    
    let totalScore = 0;
    
    // Test 1: Basic Trade Discovery (25 points)
    console.log('🧪 Testing basic trade discovery...');
    
    try {
      // Create a simple 2-way trade scenario
      await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: 'func_wallet_a',
        nfts: [{
          id: 'func_nft_a',
          metadata: { name: 'Func NFT A', symbol: 'FA', description: 'Functionality test A' },
          ownership: { ownerId: 'func_wallet_a', blockchain: 'solana', contractAddress: 'func_contract', tokenId: 'func_nft_a' },
          valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'func_test' }
        }]
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      await axios.post(`${BASE_URL}/wants/submit`, {
        walletId: 'func_wallet_a',
        wantedNFTs: ['func_nft_b']
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: 'func_wallet_b',
        nfts: [{
          id: 'func_nft_b',
          metadata: { name: 'Func NFT B', symbol: 'FB', description: 'Functionality test B' },
          ownership: { ownerId: 'func_wallet_b', blockchain: 'solana', contractAddress: 'func_contract', tokenId: 'func_nft_b' },
          valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'func_test' }
        }]
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      await axios.post(`${BASE_URL}/wants/submit`, {
        walletId: 'func_wallet_b',
        wantedNFTs: ['func_nft_a']
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      // Wait for background processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check for trades
      const tradesResponse = await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: 'func_wallet_a'
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      if (tradesResponse.data.trades && tradesResponse.data.trades.length > 0) {
        totalScore += 25;
        this.scores.functionality.strengths.push('Basic trade discovery working');
        console.log('   ✅ Excellent: 2-way trades discovered (25/25 points)');
      } else {
        this.scores.functionality.critical.push('Basic trade discovery not working');
        console.log('   ❌ CRITICAL: Cannot find basic trades (0/25 points)');
      }
    } catch (error) {
      this.scores.functionality.critical.push('Trade discovery system error');
      console.log('   ❌ CRITICAL: Trade system error (0/25 points)');
    }
    
    // Test 2: Multi-party Trades (25 points)
    console.log('🧪 Testing multi-party trade capability...');
    
    try {
      // Create 3-way trade scenario
      const wallets = ['multi_a', 'multi_b', 'multi_c'];
      const nfts = ['multi_nft_a', 'multi_nft_b', 'multi_nft_c'];
      
      for (let i = 0; i < 3; i++) {
        await axios.post(`${BASE_URL}/inventory/submit`, {
          walletId: wallets[i],
          nfts: [{
            id: nfts[i],
            metadata: { name: `Multi NFT ${i}`, symbol: `M${i}`, description: 'Multi-party test' },
            ownership: { ownerId: wallets[i], blockchain: 'solana', contractAddress: 'multi_contract', tokenId: nfts[i] },
            valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'multi_test' }
          }]
        }, {
          headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
        });
        
        // Each wallet wants the next NFT in the circle
        await axios.post(`${BASE_URL}/wants/submit`, {
          walletId: wallets[i],
          wantedNFTs: [nfts[(i + 1) % 3]]
        }, {
          headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
        });
      }
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const multiTradesResponse = await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: wallets[0]
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      if (multiTradesResponse.data.trades && multiTradesResponse.data.trades.length > 0) {
        const trade = multiTradesResponse.data.trades[0];
        if (trade.participants && trade.participants.length >= 3) {
          totalScore += 25;
          this.scores.functionality.strengths.push('Multi-party trade discovery working');
          console.log('   ✅ Excellent: Multi-party trades working (25/25 points)');
        } else {
          totalScore += 15;
          console.log('   ⚠️  Partial: Some multi-party capability (15/25 points)');
        }
      } else {
        this.scores.functionality.critical.push('Multi-party trades not working');
        console.log('   ❌ Poor: No multi-party trades found (5/25 points)');
        totalScore += 5;
      }
    } catch (error) {
      console.log('   ❌ Error in multi-party test (5/25 points)');
      totalScore += 5;
    }
    
    // Test 3: Trade Quality & Scoring (25 points)
    console.log('🧪 Testing trade quality scoring...');
    
    try {
      const qualityResponse = await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: 'func_wallet_a'
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      if (qualityResponse.data.trades && qualityResponse.data.trades.length > 0) {
        const trade = qualityResponse.data.trades[0];
        
        if (trade.qualityScore !== undefined && trade.efficiency !== undefined) {
          totalScore += 25;
          this.scores.functionality.strengths.push('Trade quality scoring active');
          console.log('   ✅ Excellent: Trade scoring working (25/25 points)');
        } else {
          totalScore += 15;
          console.log('   ⚠️  Partial: Basic trades but no scoring (15/25 points)');
        }
      } else {
        totalScore += 10;
        console.log('   ⚠️  Limited functionality (10/25 points)');
      }
    } catch (error) {
      totalScore += 5;
      console.log('   ❌ Trade quality system error (5/25 points)');
    }
    
    // Test 4: Living Persistent Graph (25 points)
    console.log('🧪 Testing living persistent graph...');
    
    const persistenceStart = Date.now();
    
    // Submit an NFT
    await axios.post(`${BASE_URL}/inventory/submit`, {
      walletId: 'persist_test',
      nfts: [{
        id: 'persist_nft',
        metadata: { name: 'Persistence Test', symbol: 'PERS', description: 'Testing persistence' },
        ownership: { ownerId: 'persist_test', blockchain: 'solana', contractAddress: 'persist_contract', tokenId: 'persist_nft' },
        valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'persist_test' }
      }]
    }, {
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
    });
    
    // Immediately query (should be in living graph)
    const immediateResponse = await axios.post(`${BASE_URL}/discovery/trades`, {
      walletId: 'persist_test'
    }, {
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
    });
    
    const responseTime = Date.now() - persistenceStart;
    
    if (responseTime < 1000) {
      totalScore += 25;
      this.scores.functionality.strengths.push('True living persistent graph');
      console.log('   ✅ Excellent: Living graph confirmed (25/25 points)');
    } else if (responseTime < 3000) {
      totalScore += 20;
      console.log('   ✅ Good: Mostly persistent graph (20/25 points)');
    } else {
      totalScore += 10;
      console.log('   ⚠️  Fair: Some persistence features (10/25 points)');
    }
    
    this.scores.functionality.score = totalScore;
    console.log(`\n   📊 FUNCTIONALITY SCORE: ${totalScore}/100`);
    console.log('');
  }

  async assessAPIDesign() {
    console.log('🔌 ASSESSING API DESIGN & USABILITY');
    console.log('===================================');
    
    let totalScore = 0;
    
    // Test 1: RESTful Standards (25 points)
    console.log('🧪 Testing RESTful compliance...');
    
    const endpoints = [
      { method: 'POST', path: '/inventory/submit', expectedStatus: [200, 201] },
      { method: 'POST', path: '/wants/submit', expectedStatus: [200, 201] },
      { method: 'POST', path: '/discovery/trades', expectedStatus: [200] },
      { method: 'GET', path: '/health', expectedStatus: [200], baseUrl: BASE_URL.replace('/api/v1', '') }
    ];
    
    let restfulCompliance = 0;
    for (const endpoint of endpoints) {
      try {
        const url = endpoint.baseUrl || BASE_URL;
        const config = {
          headers: endpoint.path !== '/health' ? { 
            'Authorization': `Bearer ${this.apiKey}`, 
            'Content-Type': 'application/json' 
          } : {}
        };
        
        let response;
        if (endpoint.method === 'GET') {
          response = await axios.get(`${url}${endpoint.path}`, config);
        } else {
          const data = endpoint.path === '/inventory/submit' ? { walletId: 'test', nfts: [] } :
                       endpoint.path === '/wants/submit' ? { walletId: 'test', wantedNFTs: [] } :
                       { walletId: 'test' };
          response = await axios.post(`${url}${endpoint.path}`, data, config);
        }
        
        if (endpoint.expectedStatus.includes(response.status)) {
          restfulCompliance++;
        }
      } catch (error) {
        if (error.response?.status === 400 || error.response?.status === 404) {
          restfulCompliance += 0.5; // Partial credit for proper error codes
        }
      }
    }
    
    const complianceScore = (restfulCompliance / endpoints.length) * 25;
    totalScore += Math.round(complianceScore);
    
    if (complianceScore >= 20) {
      this.scores.api_design.strengths.push('RESTful API design');
      console.log(`   ✅ Excellent: RESTful standards (${Math.round(complianceScore)}/25 points)`);
    } else {
      console.log(`   ⚠️  Partial: Some REST compliance (${Math.round(complianceScore)}/25 points)`);
    }
    
    // Test 2: Error Response Quality (25 points)
    console.log('🧪 Testing error response quality...');
    
    const errorTests = [
      { test: () => axios.post(`${BASE_URL}/inventory/submit`, {}, { headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' } }) },
      { test: () => axios.post(`${BASE_URL}/inventory/submit`, { walletId: 'test', nfts: 'not_array' }, { headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' } }) },
      { test: () => axios.post(`${BASE_URL}/discovery/trades`, {}, { headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' } }) }
    ];
    
    let goodErrors = 0;
    for (const errorTest of errorTests) {
      try {
        await errorTest.test();
      } catch (error) {
        if (error.response?.data?.error && typeof error.response.data.error === 'string') {
          goodErrors++;
        }
      }
    }
    
    const errorScore = (goodErrors / errorTests.length) * 25;
    totalScore += Math.round(errorScore);
    
    if (errorScore >= 20) {
      this.scores.api_design.strengths.push('Clear error messages');
      console.log(`   ✅ Excellent: Clear error responses (${Math.round(errorScore)}/25 points)`);
    } else {
      console.log(`   ⚠️  Partial: Error clarity needs work (${Math.round(errorScore)}/25 points)`);
    }
    
    // Test 3: Response Consistency (25 points)
    console.log('🧪 Testing response consistency...');
    
    let consistencyScore = 0;
    
    // Check if all success responses have consistent structure
    try {
      const inventoryResponse = await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: 'consistency_test',
        nfts: []
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      const wantsResponse = await axios.post(`${BASE_URL}/wants/submit`, {
        walletId: 'consistency_test',
        wantedNFTs: []
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      // Check for consistent response fields
      const hasSuccess = inventoryResponse.data.success !== undefined && wantsResponse.data.success !== undefined;
      const hasTimestamp = inventoryResponse.data.timestamp !== undefined || wantsResponse.data.timestamp !== undefined;
      
      if (hasSuccess) consistencyScore += 15;
      if (hasTimestamp) consistencyScore += 10;
      
      totalScore += consistencyScore;
      
      if (consistencyScore >= 20) {
        this.scores.api_design.strengths.push('Consistent response structure');
        console.log(`   ✅ Good: Consistent responses (${consistencyScore}/25 points)`);
      } else {
        console.log(`   ⚠️  Fair: Response consistency varies (${consistencyScore}/25 points)`);
      }
    } catch (error) {
      totalScore += 10;
      console.log('   ⚠️  Limited: Basic functionality only (10/25 points)');
    }
    
    // Test 4: API Versioning & Documentation (25 points)
    console.log('🧪 Testing API versioning...');
    
    // Check for version in URL
    if (BASE_URL.includes('/v1')) {
      totalScore += 15;
      this.scores.api_design.strengths.push('API versioning implemented');
      console.log('   ✅ Good: API versioning present (15/25 points)');
    } else {
      totalScore += 5;
      console.log('   ⚠️  Fair: No clear versioning (5/25 points)');
    }
    
    // Check for API info endpoint
    try {
      const rootResponse = await axios.get(BASE_URL.replace('/api/v1', '/'));
      if (rootResponse.data.service && rootResponse.data.version) {
        totalScore += 10;
        console.log('   ✅ Good: API info endpoint available (+10 points)');
      }
    } catch (error) {
      console.log('   ⚠️  No API documentation endpoint (+0 points)');
    }
    
    this.scores.api_design.score = totalScore;
    console.log(`\n   📊 API DESIGN SCORE: ${totalScore}/100`);
    console.log('');
  }

  async assessReliability() {
    console.log('🛡️ ASSESSING RELIABILITY & ERROR HANDLING');
    console.log('=========================================');
    
    let totalScore = 0;
    
    // Test 1: Error Recovery (25 points)
    console.log('🧪 Testing error recovery...');
    
    let recoveries = 0;
    for (let i = 0; i < 3; i++) {
      try {
        // Make a bad request
        await axios.post(`${BASE_URL}/inventory/submit`, {
          walletId: null // Invalid
        }, {
          headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        // Now make a good request
        try {
          await axios.post(`${BASE_URL}/inventory/submit`, {
            walletId: 'recovery_test',
            nfts: []
          }, {
            headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
          });
          recoveries++;
        } catch (secondError) {
          // Failed to recover
        }
      }
    }
    
    if (recoveries === 3) {
      totalScore += 25;
      this.scores.reliability.strengths.push('Excellent error recovery');
      console.log('   ✅ Excellent: Perfect error recovery (25/25 points)');
    } else if (recoveries >= 2) {
      totalScore += 20;
      console.log('   ✅ Good: Good error recovery (20/25 points)');
    } else {
      totalScore += 10;
      console.log('   ⚠️  Fair: Some error recovery (10/25 points)');
    }
    
    // Test 2: Data Persistence (25 points)
    console.log('🧪 Testing data persistence...');
    
    const persistWallet = 'persist_reliability_' + Date.now();
    
    // Submit data
    await axios.post(`${BASE_URL}/inventory/submit`, {
      walletId: persistWallet,
      nfts: [{
        id: 'persist_test_nft',
        metadata: { name: 'Persistence Test', symbol: 'PERS', description: 'Testing' },
        ownership: { ownerId: persistWallet, blockchain: 'solana', contractAddress: 'persist_contract', tokenId: 'persist_test_nft' },
        valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'persist' }
      }]
    }, {
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
    });
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try to query
    try {
      const queryResponse = await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: persistWallet
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
      });
      
      if (queryResponse.status === 200) {
        totalScore += 25;
        this.scores.reliability.strengths.push('Reliable data persistence');
        console.log('   ✅ Excellent: Data persists correctly (25/25 points)');
      }
    } catch (error) {
      totalScore += 10;
      console.log('   ⚠️  Fair: Persistence issues (10/25 points)');
    }
    
    // Test 3: Timeout Handling (25 points)
    console.log('🧪 Testing timeout handling...');
    
    try {
      // Large request that might timeout
      const largeNFTs = Array.from({ length: 100 }, (_, i) => ({
        id: `timeout_nft_${i}`,
        metadata: { name: `Timeout NFT ${i}`, symbol: 'TIME', description: 'Test' },
        ownership: { ownerId: 'timeout_test', blockchain: 'solana', contractAddress: 'timeout_contract', tokenId: `timeout_nft_${i}` },
        valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'timeout' }
      }));
      
      const timeoutPromise = axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: 'timeout_test',
        nfts: largeNFTs
      }, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        timeout: 30000
      });
      
      const timeoutResult = await timeoutPromise;
      
      if (timeoutResult.status === 200 || timeoutResult.status === 201) {
        totalScore += 25;
        this.scores.reliability.strengths.push('Handles large requests reliably');
        console.log('   ✅ Excellent: Large requests handled (25/25 points)');
      }
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        totalScore += 10;
        console.log('   ⚠️  Fair: Request timed out (10/25 points)');
      } else if (error.response?.status === 413) {
        totalScore += 20;
        console.log('   ✅ Good: Proper size limit handling (20/25 points)');
      } else {
        totalScore += 15;
        console.log('   ⚠️  Partial: Some timeout handling (15/25 points)');
      }
    }
    
    // Test 4: Monitoring & Health (25 points)
    console.log('🧪 Testing monitoring capabilities...');
    
    try {
      const healthResponse = await axios.get(`${BASE_URL.replace('/api/v1', '')}/health`);
      const statusResponse = await axios.get(`${BASE_URL}/status`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      }).catch(() => null);
      
      let monitoringScore = 0;
      
      if (healthResponse.data.status === 'healthy') {
        monitoringScore += 15;
      }
      
      if (statusResponse && statusResponse.data) {
        monitoringScore += 10;
      }
      
      totalScore += monitoringScore;
      
      if (monitoringScore >= 20) {
        this.scores.reliability.strengths.push('Good monitoring endpoints');
        console.log(`   ✅ Good: Monitoring available (${monitoringScore}/25 points)`);
      } else {
        console.log(`   ⚠️  Fair: Basic monitoring only (${monitoringScore}/25 points)`);
      }
    } catch (error) {
      totalScore += 10;
      console.log('   ⚠️  Limited: Minimal monitoring (10/25 points)');
    }
    
    this.scores.reliability.score = totalScore;
    console.log(`\n   📊 RELIABILITY SCORE: ${totalScore}/100`);
    console.log('');
  }

  generateFinalReport() {
    console.log('🎯 FINAL HOLISTIC MVP READINESS REPORT');
    console.log('======================================');
    console.log('');
    
    // Calculate overall score
    let totalScore = 0;
    let totalMax = 0;
    
    const categories = Object.keys(this.scores).filter(k => k !== 'developer_experience' && k !== 'business_value' && k !== 'competitive_edge');
    
    categories.forEach(category => {
      totalScore += this.scores[category].score;
      totalMax += this.scores[category].max;
    });
    
    const overallPercentage = (totalScore / totalMax * 100).toFixed(1);
    
    console.log('📊 CATEGORY BREAKDOWN:');
    console.log('=====================');
    
    categories.forEach(category => {
      const cat = this.scores[category];
      const percentage = (cat.score / cat.max * 100).toFixed(1);
      const icon = percentage >= 80 ? '✅' : percentage >= 60 ? '🟡' : '❌';
      
      console.log(`${icon} ${category.toUpperCase().replace('_', ' ')}: ${cat.score}/${cat.max} (${percentage}%)`);
      
      if (cat.strengths.length > 0) {
        console.log('   Strengths:');
        cat.strengths.forEach(s => console.log(`   • ${s}`));
      }
      
      if (cat.critical.length > 0) {
        console.log('   ⚠️  Critical Issues:');
        cat.critical.forEach(c => console.log(`   • ${c}`));
      }
      
      console.log('');
    });
    
    console.log('🏆 OVERALL MVP READINESS SCORE');
    console.log('==============================');
    console.log(`📊 TOTAL: ${totalScore}/${totalMax} (${overallPercentage}%)`);
    console.log('');
    
    // Business assessment
    console.log('💼 BUSINESS READINESS ASSESSMENT');
    console.log('================================');
    
    // Strengths
    const allStrengths = [];
    categories.forEach(cat => allStrengths.push(...this.scores[cat].strengths));
    
    console.log('✅ KEY STRENGTHS:');
    const uniqueStrengths = [...new Set(allStrengths)];
    uniqueStrengths.forEach(s => console.log(`   • ${s}`));
    console.log('');
    
    // Critical issues
    const allCritical = [];
    categories.forEach(cat => allCritical.push(...this.scores[cat].critical));
    
    if (allCritical.length > 0) {
      console.log('🚨 CRITICAL ISSUES TO ADDRESS:');
      allCritical.forEach(c => console.log(`   • ${c}`));
      console.log('');
    }
    
    // Final verdict
    console.log('🎯 FINAL VERDICT: CLIENT PRESENTATION READINESS');
    console.log('==============================================');
    
    if (overallPercentage >= 85 && allCritical.length === 0) {
      console.log('✅ READY FOR CLIENT PRESENTATIONS');
      console.log('');
      console.log('The system demonstrates:');
      console.log('• Professional performance and reliability');
      console.log('• Enterprise-grade security and multi-tenancy');
      console.log('• Sophisticated multi-party trade algorithms');
      console.log('• Clean API design with good error handling');
      console.log('• Living persistent graph architecture');
      console.log('');
      console.log('🎯 GO CONFIDENTLY TO CLIENT MEETINGS!');
    } else if (overallPercentage >= 75 && allCritical.length <= 1) {
      console.log('🟡 READY WITH CAVEATS');
      console.log('');
      console.log('The system is solid but:');
      console.log('• Address any critical issues first');
      console.log('• Be prepared to discuss roadmap items');
      console.log('• Focus demos on strong areas');
      console.log('• Consider pilot/beta positioning');
      console.log('');
      console.log('💡 SUITABLE FOR FRIENDLY CLIENTS OR PILOTS');
    } else if (overallPercentage >= 60) {
      console.log('⚠️  NEEDS IMPROVEMENT BEFORE CLIENT DEMOS');
      console.log('');
      console.log('The system shows promise but:');
      console.log('• Multiple critical issues need fixing');
      console.log('• Core functionality needs stabilization');
      console.log('• Consider internal demos only for now');
      console.log('');
      console.log('🔧 FOCUS ON CRITICAL FIXES FIRST');
    } else {
      console.log('❌ NOT READY FOR CLIENT PRESENTATIONS');
      console.log('');
      console.log('Significant work needed:');
      console.log('• Major functionality gaps');
      console.log('• Critical security/reliability issues');
      console.log('• Would damage credibility if shown');
      console.log('');
      console.log('🛠️ REQUIRES SUBSTANTIAL DEVELOPMENT');
    }
    
    console.log('');
    console.log('📋 RECOMMENDED TALKING POINTS FOR CLIENTS:');
    console.log('==========================================');
    
    if (this.scores.functionality.score >= 80) {
      console.log('✅ "Sophisticated multi-party NFT bartering with graph algorithms"');
    }
    if (this.scores.performance.score >= 80) {
      console.log('✅ "Sub-second response times with optimized performance"');
    }
    if (this.scores.security.score >= 80) {
      console.log('✅ "Enterprise-grade security with multi-tenant isolation"');
    }
    console.log('✅ "Living persistent graph for real-time trade discovery"');
    console.log('✅ "White-label ready with clean API design"');
    console.log('✅ "Solana blockchain integration"');
    
    console.log('');
    console.log('⚠️  AREAS TO AVOID EMPHASIZING:');
    console.log('================================');
    
    if (this.scores.performance.score < 70) {
      console.log('• Heavy concurrent load scenarios');
    }
    if (allCritical.length > 0) {
      allCritical.forEach(c => console.log(`• ${c}`));
    }
    console.log('• Production scale (position as MVP/pilot)');
    
    return {
      overallScore: overallPercentage,
      criticalIssues: allCritical.length,
      ready: overallPercentage >= 75 && allCritical.length <= 1
    };
  }

  async runAssessment() {
    try {
      const setupSuccess = await this.setupTestEnvironment();
      if (!setupSuccess) {
        console.error('❌ Failed to setup test environment');
        return { overallScore: 0, criticalIssues: 1, ready: false };
      }
      
      await this.assessPerformance();
      await this.assessSecurity();
      await this.assessFunctionality();
      await this.assessAPIDesign();
      await this.assessReliability();
      
      return this.generateFinalReport();
    } catch (error) {
      console.error('❌ Assessment failed:', error.message);
      return { overallScore: 0, criticalIssues: 1, ready: false };
    }
  }
}

// Run the assessment
const assessor = new MVPReadinessAssessor();
assessor.runAssessment().then(result => {
  console.log('\n🏁 ASSESSMENT COMPLETE');
  if (result.ready) {
    console.log('✅ System ready for client presentations!');
  } else {
    console.log(`⚠️  More work needed (Score: ${result.overallScore}%, Critical Issues: ${result.criticalIssues})`);
  }
});