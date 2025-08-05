const https = require('https');

const API_KEY = 'swaps_e7fd66973e3a00b73c539efdd93abefdd5281f762980957c5b80a3c7bc2411d5';

class TestUploader {
  constructor() {
    this.metrics = { totalRequests: 0, successfulRequests: 0, failedRequests: 0 };
  }

  async makeRequest(endpoint, data) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(data);
      
      const options = {
        hostname: 'swaps-93hu.onrender.com',
        port: 443,
        path: endpoint,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            resolve({ statusCode: res.statusCode, data: response });
          } catch (error) {
            console.error('JSON parse error:', error.message, 'Body:', body);
            reject(new Error(`JSON parse error: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('Request error:', error.message);
        reject(error);
      });
      
      req.write(postData);
      req.end();
    });
  }

  async testSmallUpload() {
    console.log('🧪 Testing small scale upload...');
    
    // Test 3 wallets
    for (let i = 1; i <= 3; i++) {
      console.log(`\nUploading wallet ${i}:`);
      
      try {
        const response = await this.makeRequest('/api/v1/inventory/submit', {
          walletId: `SMALL_TEST_WALLET_${i}`,
          nfts: [{
            id: `SMALL_TEST_NFT_${i}`,
            metadata: {
              name: `Small Test NFT ${i}`,
              description: `Test NFT ${i}`,
              estimatedValueUSD: 100 + i * 50
            },
            ownership: {
              ownerId: `SMALL_TEST_WALLET_${i}`
            },
            collection: {
              id: 'smalltest',
              name: 'Small Test Collection'
            }
          }]
        });
        
        this.metrics.totalRequests++;
        console.log(`✅ Status: ${response.statusCode}`);
        console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
        
        if (response.statusCode === 200) {
          this.metrics.successfulRequests++;
        } else {
          this.metrics.failedRequests++;
          console.log(`❌ Unexpected status code: ${response.statusCode}`);
        }
        
      } catch (error) {
        this.metrics.totalRequests++;
        this.metrics.failedRequests++;
        console.error(`❌ Error: ${error.message}`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n📊 Results:`);
    console.log(`   Total: ${this.metrics.totalRequests}`);
    console.log(`   Success: ${this.metrics.successfulRequests}`);
    console.log(`   Failed: ${this.metrics.failedRequests}`);
  }
}

const uploader = new TestUploader();
uploader.testSmallUpload();
