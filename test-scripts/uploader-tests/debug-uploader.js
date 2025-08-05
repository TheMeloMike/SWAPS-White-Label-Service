const https = require('https');

const API_KEY = 'swaps_e7fd66973e3a00b73c539efdd93abefdd5281f762980957c5b80a3c7bc2411d5';

async function makeRequest(endpoint, data) {
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
        console.log(`Status: ${res.statusCode}, Body: ${body.substring(0, 100)}...`);
        resolve({ statusCode: res.statusCode, body });
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

async function test() {
  console.log('Testing 5 rapid requests...');
  
  for (let i = 1; i <= 5; i++) {
    try {
      console.log(`\nRequest ${i}:`);
      await makeRequest('/api/v1/inventory/submit', {
        walletId: `TEST_WALLET_${i}`,
        nfts: [{
          id: `TEST_NFT_${i}`,
          metadata: { name: `Test NFT ${i}`, estimatedValueUSD: 100 },
          ownership: { ownerId: `TEST_WALLET_${i}` },
          collection: { id: 'test', name: 'Test Collection' }
        }]
      });
    } catch (error) {
      console.error(`Request ${i} failed:`, error.message);
    }
  }
}

test();
