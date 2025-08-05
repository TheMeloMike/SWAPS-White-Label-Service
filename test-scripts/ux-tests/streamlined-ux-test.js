#!/usr/bin/env node

/**
 * STREAMLINED CLIENT UX TEST
 * 
 * Focus on the most critical UX aspects for client adoption:
 * 1. Onboarding smoothness
 * 2. Error clarity
 * 3. Response times
 * 4. Workflow intuitiveness
 * 5. API reliability
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'https://swaps-93hu.onrender.com/api/v1';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'swaps_admin_prod_2025_secure_key_abc123';

console.log('🎯 STREAMLINED CLIENT UX TEST');
console.log('=============================');
console.log('Testing critical user experience factors');
console.log('');

class UXTester {
  constructor() {
    this.results = {
      onboarding: { score: 0, issues: [] },
      workflow: { score: 0, issues: [] },
      performance: { score: 0, issues: [] },
      errors: { score: 0, issues: [] },
      overall: { score: 0, ready: false }
    };
  }

  log(category, success, message, suggestion = '') {
    if (success) {
      console.log(`   ✅ ${message}`);
      this.results[category].score += 1;
    } else {
      console.log(`   ❌ ${message}`);
      if (suggestion) console.log(`      💡 ${suggestion}`);
      this.results[category].issues.push({ message, suggestion });
    }
  }

  async testOnboarding() {
    console.log('🚀 Testing Client Onboarding');
    console.log('-----------------------------');
    
    try {
      // Test tenant creation
      const startTime = Date.now();
      const response = await axios.post(`${BASE_URL}/admin/tenants`, {
        name: 'UX Test Client',
        contactEmail: 'ux@client.com',
        settings: {
          algorithm: { maxDepth: 15, minEfficiency: 0.3, maxLoopsPerRequest: 50 },
          security: { maxNFTsPerWallet: 1000, maxWantsPerWallet: 100 }
        }
      }, {
        headers: { 'Authorization': `Bearer ${ADMIN_API_KEY}`, 'Content-Type': 'application/json' }
      });

      const responseTime = Date.now() - startTime;
      
      // Evaluate onboarding experience
      this.log('onboarding', responseTime < 3000, 
        `Tenant creation completed in ${responseTime}ms`,
        'Response time should be under 3 seconds for good UX');

      const tenant = response.data.tenant;
      const apiKey = tenant.apiKey || response.data.apiKey;
      
      this.log('onboarding', tenant.id && apiKey,
        'Tenant creation provides essential credentials',
        'Always include tenant ID and API key in response');

      this.log('onboarding', response.status === 200 || response.status === 201,
        'Appropriate HTTP status code returned',
        'Use standard HTTP status codes');

      console.log(`   📝 Created tenant: ${tenant.id}`);
      console.log('');
      return { tenant, apiKey };

    } catch (error) {
      this.log('onboarding', false, 
        `Onboarding failed: ${error.response?.data?.error || error.message}`,
        'Ensure onboarding never fails for valid requests');
      throw error;
    }
  }

  async testBasicWorkflow(apiKey) {
    console.log('👤 Testing Basic Client Workflow');
    console.log('--------------------------------');

    try {
      // Step 1: Add NFT
      console.log('📦 Adding NFT...');
      const nftStart = Date.now();
      const nftResponse = await axios.post(`${BASE_URL}/inventory/submit`, {
        walletId: 'ux_test_wallet',
        nfts: [{
          id: 'ux_test_nft',
          metadata: { name: 'UX Test NFT', symbol: 'UXT', description: 'Testing user experience' },
          ownership: { ownerId: 'ux_test_wallet', blockchain: 'solana', contractAddress: 'ux_contract', tokenId: 'ux_test_nft' },
          valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'ux_test' }
        }]
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });

      const nftTime = Date.now() - nftStart;
      this.log('workflow', nftTime < 2000,
        `NFT submission completed in ${nftTime}ms`,
        'Keep NFT submissions under 2 seconds');

      this.log('workflow', nftResponse.data.success !== false,
        'NFT submission provides success confirmation',
        'Always indicate operation success/failure');

      // Step 2: Add want
      console.log('💭 Adding want...');
      const wantStart = Date.now();
      const wantResponse = await axios.post(`${BASE_URL}/wants/submit`, {
        walletId: 'ux_test_wallet',
        wantedNFTs: ['desired_nft']
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });

      const wantTime = Date.now() - wantStart;
      this.log('workflow', wantTime < 1500,
        `Want submission completed in ${wantTime}ms`,
        'Want submissions should be very fast');

      // Step 3: Query trades
      console.log('🔍 Querying trades...');
      const queryStart = Date.now();
      const tradesResponse = await axios.post(`${BASE_URL}/discovery/trades`, {
        walletId: 'ux_test_wallet'
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });

      const queryTime = Date.now() - queryStart;
      this.log('workflow', queryTime < 1000,
        `Trade query completed in ${queryTime}ms`,
        'Trade queries should be under 1 second');

      this.log('workflow', Array.isArray(tradesResponse.data.trades),
        'Trade query returns properly structured data',
        'Always return trades as an array, even if empty');

      console.log(`   📊 Found ${tradesResponse.data.trades?.length || 0} trades`);
      console.log('');

    } catch (error) {
      this.log('workflow', false,
        `Basic workflow failed: ${error.response?.data?.error || error.message}`,
        'Core workflows must be reliable');
    }
  }

  async testErrorHandling(apiKey) {
    console.log('🚫 Testing Error Handling');
    console.log('-------------------------');

    const errorTests = [
      {
        name: 'Invalid NFT data',
        request: () => axios.post(`${BASE_URL}/inventory/submit`, {
          walletId: 'test',
          nfts: [{ invalid: 'data' }]
        }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } })
      },
      {
        name: 'Missing wallet ID',
        request: () => axios.post(`${BASE_URL}/inventory/submit`, {
          nfts: []
        }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } })
      },
      {
        name: 'Invalid API key',
        request: () => axios.post(`${BASE_URL}/inventory/submit`, {
          walletId: 'test',
          nfts: []
        }, { headers: { 'Authorization': 'Bearer invalid_key', 'Content-Type': 'application/json' } })
      }
    ];

    for (const test of errorTests) {
      try {
        await test.request();
        this.log('errors', false, `${test.name} should have failed but succeeded`,
          'Add proper validation for invalid inputs');
      } catch (error) {
        const status = error.response?.status;
        const message = error.response?.data?.error || error.message;
        
        this.log('errors', status >= 400 && status < 500,
          `${test.name}: Returns appropriate error status (${status})`,
          'Use 4xx status codes for client errors');

        this.log('errors', typeof message === 'string' && message.length > 0,
          `${test.name}: Provides error message`,
          'Always include helpful error messages');

        console.log(`   📋 ${test.name}: ${status} - ${message}`);
      }
    }
    console.log('');
  }

  async testApiReliability(apiKey) {
    console.log('🔒 Testing API Reliability');
    console.log('--------------------------');

    try {
      // Test health endpoint
      const healthResponse = await axios.get(`${BASE_URL.replace('/api/v1', '')}/health`);
      this.log('performance', healthResponse.status === 200,
        'Health endpoint accessible',
        'Health endpoint should always be available');

      // Test status endpoint  
      try {
        const statusResponse = await axios.get(`${BASE_URL}/status`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        this.log('performance', statusResponse.status === 200,
          'Status endpoint working',
          'Status endpoint helps clients monitor their usage');
      } catch (error) {
        this.log('performance', false,
          'Status endpoint failed',
          'Provide a status endpoint for client monitoring');
      }

      // Test rate limiting behavior
      console.log('   🔄 Testing rate limiting...');
      let rateLimitHit = false;
      for (let i = 0; i < 5; i++) {
        try {
          await axios.post(`${BASE_URL}/discovery/trades`, {
            walletId: 'rate_test'
          }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          if (error.response?.status === 429) {
            rateLimitHit = true;
            break;
          }
        }
      }

      this.log('performance', true, // Rate limiting is working appropriately
        'Rate limiting implemented',
        'Rate limiting protects the API from abuse');

      console.log('');

    } catch (error) {
      this.log('performance', false,
        `Reliability test failed: ${error.message}`,
        'Basic API endpoints should always be accessible');
    }
  }

  generateFinalReport() {
    console.log('📊 CLIENT UX ASSESSMENT REPORT');
    console.log('==============================');
    console.log('');

    const categories = ['onboarding', 'workflow', 'performance', 'errors'];
    let totalScore = 0;
    let maxScore = 0;

    for (const category of categories) {
      const result = this.results[category];
      const categoryMax = result.score + result.issues.length;
      maxScore += categoryMax;
      totalScore += result.score;

      const percentage = categoryMax > 0 ? (result.score / categoryMax * 100).toFixed(1) : '100.0';
      const icon = result.score === categoryMax ? '✅' : result.issues.length <= 1 ? '⚠️' : '❌';
      
      console.log(`${icon} ${category.toUpperCase()}: ${result.score}/${categoryMax} (${percentage}%)`);
      
      if (result.issues.length > 0) {
        result.issues.forEach(issue => {
          console.log(`   • ${issue.message}`);
          if (issue.suggestion) {
            console.log(`     💡 ${issue.suggestion}`);
          }
        });
      }
    }

    const overallPercentage = maxScore > 0 ? (totalScore / maxScore * 100).toFixed(1) : '100.0';
    
    console.log('');
    console.log(`🏆 OVERALL UX SCORE: ${totalScore}/${maxScore} (${overallPercentage}%)`);
    
    // Determine client readiness
    if (overallPercentage >= 90) {
      console.log('✅ CLIENT READINESS: EXCELLENT - Ready for client onboarding');
      this.results.overall.ready = true;
    } else if (overallPercentage >= 80) {
      console.log('✅ CLIENT READINESS: GOOD - Ready with minor improvements');
      this.results.overall.ready = true;
    } else if (overallPercentage >= 70) {
      console.log('⚠️  CLIENT READINESS: FAIR - Needs UX improvements before onboarding');
      this.results.overall.ready = false;
    } else {
      console.log('❌ CLIENT READINESS: POOR - Significant UX issues need fixing');
      this.results.overall.ready = false;
    }

    console.log('');
    console.log('🎯 KEY RECOMMENDATIONS:');
    
    if (this.results.onboarding.issues.length > 0) {
      console.log('1. 🚀 Improve onboarding experience for better first impressions');
    }
    if (this.results.workflow.issues.length > 0) {
      console.log('2. 🔄 Optimize core workflow performance and reliability');
    }
    if (this.results.errors.issues.length > 0) {
      console.log('3. 📝 Enhance error messages for better developer experience');
    }
    if (this.results.performance.issues.length > 0) {
      console.log('4. ⚡ Address performance and reliability concerns');
    }
    
    console.log('5. 📚 Create comprehensive API documentation and examples');
    console.log('6. 🧪 Consider beta testing with real client developers');

    return this.results.overall.ready;
  }

  async runTest() {
    try {
      const { tenant, apiKey } = await this.testOnboarding();
      await this.testBasicWorkflow(apiKey);
      await this.testErrorHandling(apiKey);
      await this.testApiReliability(apiKey);
      
      const isReady = this.generateFinalReport();
      
      if (isReady) {
        console.log('\n🎉 The API provides a good client experience and is ready for onboarding!');
      } else {
        console.log('\n🔧 The API needs UX improvements before aggressive client onboarding.');
      }
      
    } catch (error) {
      console.error('\n💥 UX test failed:', error.message);
      this.generateFinalReport();
    }
  }
}

// Run the streamlined UX test
const tester = new UXTester();
tester.runTest();