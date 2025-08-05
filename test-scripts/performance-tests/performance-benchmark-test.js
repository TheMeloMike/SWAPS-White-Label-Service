#!/usr/bin/env node

/**
 * Comprehensive Performance Benchmark Test
 * Tests all critical API endpoints to identify bottlenecks
 */

const https = require('https');
const fs = require('fs');

const API_BASE = 'https://swaps-93hu.onrender.com';
const TEST_RUNS = 5;
const CONCURRENT_REQUESTS = 3;

class PerformanceBenchmark {
  constructor() {
    this.results = [];
    this.apiKey = null;
  }

  async log(message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`, data);
  }

  async makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          const endTime = Date.now();
          const responseTime = endTime - startTime;
          
          try {
            const parsedData = responseData ? JSON.parse(responseData) : {};
            resolve({
              statusCode: res.statusCode,
              responseTime,
              data: parsedData,
              headers: res.headers,
              size: Buffer.byteLength(responseData, 'utf8')
            });
          } catch (error) {
            resolve({
              statusCode: res.statusCode,
              responseTime,
              data: responseData,
              headers: res.headers,
              size: Buffer.byteLength(responseData, 'utf8'),
              parseError: error.message
            });
          }
        });
      });

      req.on('error', (error) => {
        reject({
          error: error.message,
          responseTime: Date.now() - startTime
        });
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  async setupTestTenant() {
    try {
      // Create a test tenant
      const createResponse = await this.makeRequest({
        hostname: 'swaps-93hu.onrender.com',
        path: '/api/v1/admin/tenants',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer your_admin_key_here'
        }
      }, {
        name: 'Performance Test Tenant',
        allowedOrigins: ['*'],
        maxNftsPerRequest: 100
      });

      if (createResponse.data?.tenant?.apiKey) {
        this.apiKey = createResponse.data.tenant.apiKey;
        await this.log('✅ Test tenant created', { apiKey: this.apiKey.substring(0, 8) + '...' });
        return true;
      } else {
        // Try to use existing API key if creation fails
        this.apiKey = 'sk_test_4mAqWBkx8E7rJfL9vCpTzY2sH6nGd1Xu3bVeRjP5';
        await this.log('⚠️  Using fallback API key for testing');
        return true;
      }
    } catch (error) {
      await this.log('❌ Failed to setup test tenant', { error: error.message });
      return false;
    }
  }

  async benchmarkEndpoint(name, method, path, data = null, headers = {}) {
    const allHeaders = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      ...headers
    };

    const times = [];
    const sizes = [];
    const statusCodes = [];
    
    await this.log(`\n🧪 Testing ${name} (${TEST_RUNS} runs, ${CONCURRENT_REQUESTS} concurrent)`);

    for (let run = 0; run < TEST_RUNS; run++) {
      const concurrentPromises = [];
      
      for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
        const promise = this.makeRequest({
          hostname: 'swaps-93hu.onrender.com',
          path,
          method,
          headers: allHeaders
        }, data);
        
        concurrentPromises.push(promise);
      }

      try {
        const results = await Promise.all(concurrentPromises);
        
        results.forEach(result => {
          times.push(result.responseTime);
          sizes.push(result.size);
          statusCodes.push(result.statusCode);
        });

        await this.log(`  Run ${run + 1}: ${results.map(r => `${r.responseTime}ms (${r.statusCode})`).join(', ')}`);
      } catch (error) {
        await this.log(`  Run ${run + 1}: ERROR - ${error.message}`);
      }

      // Small delay between runs
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const successfulRequests = statusCodes.filter(code => code >= 200 && code < 400).length;
    const successRate = (successfulRequests / statusCodes.length) * 100;
    
    const stats = {
      name,
      method,
      path,
      totalRequests: times.length,
      successfulRequests,
      successRate: Math.round(successRate * 100) / 100,
      timing: {
        min: Math.min(...times),
        max: Math.max(...times),
        avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
        median: this.calculateMedian(times)
      },
      throughput: {
        requestsPerSecond: Math.round((times.length / (times.reduce((a, b) => a + b, 0) / 1000)) * 100) / 100,
        avgDataPerSecond: Math.round((sizes.reduce((a, b) => a + b, 0) / times.length / 1024) * 100) / 100 // KB/s
      },
      statusCodes: this.countOccurrences(statusCodes)
    };

    this.results.push(stats);
    
    await this.log(`  📊 ${name} Results:`, {
      avgResponseTime: `${stats.timing.avg}ms`,
      successRate: `${stats.successRate}%`,
      throughput: `${stats.throughput.requestsPerSecond} req/s`
    });

    return stats;
  }

  calculateMedian(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  countOccurrences(array) {
    return array.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {});
  }

  generateTestNFTs(count = 10) {
    const collections = ['CryptoPunks', 'BAYC', 'Azuki', 'CloneX', 'Pudgy Penguins'];
    return Array.from({ length: count }, (_, i) => ({
      id: `test_nft_${i}_${Date.now()}`,
      collectionId: collections[i % collections.length],
      metadata: {
        name: `Test NFT #${i}`,
        description: 'Performance test NFT',
        image: 'https://example.com/nft.jpg',
        attributes: [
          { trait_type: 'Color', value: 'Blue' },
          { trait_type: 'Rarity', value: 'Common' }
        ]
      },
      pricing: {
        floorPrice: Math.random() * 10,
        lastSalePrice: Math.random() * 15,
        estimatedValue: Math.random() * 12
      },
      ownership: {
        ownerId: `test_wallet_${i % 5}`,
        acquiredAt: new Date().toISOString()
      }
    }));
  }

  async runFullBenchmark() {
    await this.log('🚀 Starting SWAPS API Performance Benchmark');
    
    if (!(await this.setupTestTenant())) {
      await this.log('❌ Failed to setup test environment');
      return;
    }

    // Test all critical endpoints
    const benchmarks = [
      // Health and monitoring endpoints
      {
        name: 'Health Check',
        method: 'GET',
        path: '/health',
        headers: {}
      },
      {
        name: 'Monitoring Health',
        method: 'GET',
        path: '/monitoring/health',
        headers: {}
      },
      {
        name: 'API Version Info',
        method: 'GET',
        path: '/monitoring/version',
        headers: {}
      },
      
      // Core API endpoints
      {
        name: 'Submit Small Inventory (10 NFTs)',
        method: 'POST',
        path: '/api/v1/inventory/submit',
        data: { nfts: this.generateTestNFTs(10) }
      },
      {
        name: 'Submit Medium Inventory (50 NFTs)',
        method: 'POST',
        path: '/api/v1/inventory/submit',
        data: { nfts: this.generateTestNFTs(50) }
      },
      {
        name: 'Submit Large Inventory (100 NFTs)',
        method: 'POST',
        path: '/api/v1/inventory/submit',
        data: { nfts: this.generateTestNFTs(100) }
      },
      {
        name: 'Submit Wants',
        method: 'POST',
        path: '/api/v1/wants/submit',
        data: {
          wants: [
            { nftId: 'punk_1234', priority: 'high' },
            { nftId: 'bayc_5678', priority: 'medium' },
            { nftId: 'azuki_9012', priority: 'low' }
          ]
        }
      },
      {
        name: 'Discover Trades',
        method: 'POST',
        path: '/api/v1/discovery/trades',
        data: {
          walletId: 'test_wallet_0',
          options: {
            maxDepth: 6,
            includePartialMatches: true,
            maxResults: 10
          }
        }
      },
      {
        name: 'Get Active Trades',
        method: 'GET',
        path: '/api/v1/trades/active?limit=20'
      }
    ];

    // Run all benchmarks
    for (const benchmark of benchmarks) {
      try {
        await this.benchmarkEndpoint(
          benchmark.name,
          benchmark.method,
          benchmark.path,
          benchmark.data,
          benchmark.headers || {}
        );
      } catch (error) {
        await this.log(`❌ Benchmark failed for ${benchmark.name}`, { error: error.message });
      }
      
      // Small delay between different endpoints
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    await this.generateReport();
  }

  async generateReport() {
    await this.log('\n' + '='.repeat(80));
    await this.log('📊 PERFORMANCE BENCHMARK REPORT');
    await this.log('='.repeat(80));

    const summary = {
      totalEndpoints: this.results.length,
      overallSuccessRate: Math.round(
        (this.results.reduce((sum, r) => sum + r.successRate, 0) / this.results.length) * 100
      ) / 100,
      avgResponseTime: Math.round(
        this.results.reduce((sum, r) => sum + r.timing.avg, 0) / this.results.length
      ),
      fastestEndpoint: this.results.reduce((min, r) => r.timing.avg < min.timing.avg ? r : min),
      slowestEndpoint: this.results.reduce((max, r) => r.timing.avg > max.timing.avg ? r : max),
      bestThroughput: this.results.reduce((max, r) => 
        r.throughput.requestsPerSecond > max.throughput.requestsPerSecond ? r : max
      )
    };

    await this.log('\n📈 SUMMARY STATISTICS');
    await this.log('─'.repeat(50));
    await this.log(`Total Endpoints Tested: ${summary.totalEndpoints}`);
    await this.log(`Overall Success Rate: ${summary.overallSuccessRate}%`);
    await this.log(`Average Response Time: ${summary.avgResponseTime}ms`);
    await this.log(`Fastest Endpoint: ${summary.fastestEndpoint.name} (${summary.fastestEndpoint.timing.avg}ms)`);
    await this.log(`Slowest Endpoint: ${summary.slowestEndpoint.name} (${summary.slowestEndpoint.timing.avg}ms)`);
    await this.log(`Best Throughput: ${summary.bestThroughput.name} (${summary.bestThroughput.throughput.requestsPerSecond} req/s)`);

    await this.log('\n📋 DETAILED RESULTS');
    await this.log('─'.repeat(50));
    
    this.results.forEach(result => {
      const grade = this.gradePerformance(result);
      await this.log(`\n${grade.emoji} ${result.name} - Grade: ${grade.letter}`);
      await this.log(`   Response Time: ${result.timing.min}ms - ${result.timing.max}ms (avg: ${result.timing.avg}ms)`);
      await this.log(`   Success Rate: ${result.successRate}%`);
      await this.log(`   Throughput: ${result.throughput.requestsPerSecond} req/s`);
      if (result.successRate < 100) {
        await this.log(`   Status Codes: ${JSON.stringify(result.statusCodes)}`);
      }
    });

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary,
      results: this.results,
      environment: {
        endpoint: API_BASE,
        testRuns: TEST_RUNS,
        concurrentRequests: CONCURRENT_REQUESTS
      }
    };

    fs.writeFileSync('performance-benchmark-report.json', JSON.stringify(report, null, 2));
    await this.log('\n💾 Detailed report saved to: performance-benchmark-report.json');

    await this.log('\n' + '='.repeat(80));
    await this.log(`🎯 OVERALL GRADE: ${this.gradeOverallPerformance(summary).letter} ${this.gradeOverallPerformance(summary).emoji}`);
    await this.log('='.repeat(80));
  }

  gradePerformance(result) {
    const { timing, successRate } = result;
    
    // Base score from response time
    let score = 100;
    if (timing.avg > 5000) score -= 40;
    else if (timing.avg > 2000) score -= 30;
    else if (timing.avg > 1000) score -= 20;
    else if (timing.avg > 500) score -= 10;
    else if (timing.avg > 200) score -= 5;

    // Deduct for poor success rate
    if (successRate < 100) score -= (100 - successRate);

    // Letter grade
    const letter = score >= 95 ? 'A+' :
                  score >= 90 ? 'A' :
                  score >= 85 ? 'B+' :
                  score >= 80 ? 'B' :
                  score >= 75 ? 'C+' :
                  score >= 70 ? 'C' :
                  score >= 60 ? 'D' : 'F';

    const emoji = score >= 90 ? '🚀' :
                 score >= 80 ? '✅' :
                 score >= 70 ? '⚠️' :
                 score >= 60 ? '🐌' : '❌';

    return { score, letter, emoji };
  }

  gradeOverallPerformance(summary) {
    const avgTime = summary.avgResponseTime;
    const successRate = summary.overallSuccessRate;
    
    let score = 100;
    if (avgTime > 3000) score -= 30;
    else if (avgTime > 1500) score -= 20;
    else if (avgTime > 800) score -= 10;
    else if (avgTime > 400) score -= 5;

    if (successRate < 100) score -= (100 - successRate) * 2;

    const letter = score >= 95 ? 'A+' :
                  score >= 90 ? 'A' :
                  score >= 85 ? 'B+' :
                  score >= 80 ? 'B' :
                  score >= 75 ? 'C+' :
                  score >= 70 ? 'C' :
                  score >= 60 ? 'D' : 'F';

    const emoji = score >= 95 ? '🏆' :
                 score >= 90 ? '🚀' :
                 score >= 80 ? '✅' :
                 score >= 70 ? '⚠️' :
                 score >= 60 ? '🐌' : '❌';

    return { score, letter, emoji };
  }
}

// Run the benchmark
const benchmark = new PerformanceBenchmark();
benchmark.runFullBenchmark().catch(error => {
  console.error('❌ Benchmark failed:', error);
  process.exit(1);
});