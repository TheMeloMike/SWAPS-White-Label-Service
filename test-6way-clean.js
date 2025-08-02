#!/usr/bin/env node

/**
 * CLEAN 6-WAY LOOP TEST
 * 
 * Now that we know 5-way works perfectly, let's test 6-way with clean methodology
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'https://swaps-93hu.onrender.com/api/v1';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'swaps_admin_prod_2025_secure_key_abc123';

console.log('🔄 CLEAN 6-WAY LOOP TEST');
console.log('========================');

async function test6Way() {
  // Create tenant
  const tenantResponse = await axios.post(`${BASE_URL}/admin/tenants`, {
    name: 'Clean 6-Way Test',
    contactEmail: 'clean6way@test.com',
    settings: {
      algorithm: { maxDepth: 25, minEfficiency: 0.1, maxLoopsPerRequest: 100 },
      security: { maxNFTsPerWallet: 1000, maxWantsPerWallet: 100 }
    }
  }, {
    headers: { 'Authorization': `Bearer ${ADMIN_API_KEY}`, 'Content-Type': 'application/json' }
  });

  const tenant = tenantResponse.data.tenant;
  const apiKey = tenant.apiKey || tenantResponse.data.apiKey;
  
  console.log(`✅ Clean tenant: ${tenant.id}`);
  console.log('');

  const participants = [
    { wallet: 'clean6_alice', nft: 'clean6_alpha', wants: 'clean6_beta' },
    { wallet: 'clean6_bob', nft: 'clean6_beta', wants: 'clean6_gamma' },
    { wallet: 'clean6_charlie', nft: 'clean6_gamma', wants: 'clean6_delta' },
    { wallet: 'clean6_david', nft: 'clean6_delta', wants: 'clean6_epsilon' },
    { wallet: 'clean6_eve', nft: 'clean6_epsilon', wants: 'clean6_zeta' },
    { wallet: 'clean6_frank', nft: 'clean6_zeta', wants: 'clean6_alpha' }
  ];

  // Add NFTs
  console.log('📦 Adding NFTs...');
  for (const p of participants) {
    const nft = {
      id: p.nft,
      metadata: { name: `Clean ${p.nft}`, symbol: p.nft.toUpperCase(), description: `Clean 6-way ${p.nft}` },
      ownership: { ownerId: p.wallet, blockchain: 'solana', contractAddress: `clean6_${p.nft}`, tokenId: p.nft },
      valuation: { estimatedValue: 1.0, currency: 'SOL', lastUpdated: new Date().toISOString(), source: 'clean6_test' }
    };

    await axios.post(`${BASE_URL}/inventory/submit`, {
      walletId: p.wallet,
      nfts: [nft]
    }, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });
  }

  // Add wants
  console.log('💭 Adding wants to complete 6-way loop...');
  let totalLoops = 0;
  for (const p of participants) {
    const response = await axios.post(`${BASE_URL}/wants/submit`, {
      walletId: p.wallet,
      wantedNFTs: [p.wants]
    }, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });
    
    totalLoops += response.data.newLoopsDiscovered;
    console.log(`   ${p.wallet} wants ${p.wants} → ${response.data.newLoopsDiscovered} loops discovered`);
  }

  console.log(`\n📊 Total loops discovered: ${totalLoops}`);

  // Query results
  console.log('\n🔍 Querying 6-way participants:');
  let foundTrades = 0;
  for (const p of participants) {
    const response = await axios.post(`${BASE_URL}/discovery/trades`, {
      walletId: p.wallet
    }, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    });

    const trades = response.data.trades || [];
    foundTrades += trades.length;
    
    if (trades.length > 0) {
      const trade = trades[0];
      console.log(`   ✅ ${p.wallet}: ${trades.length} trades (${trade.steps ? trade.steps.length : 'N/A'} steps, Quality: ${trade.qualityScore || 'N/A'})`);
    } else {
      console.log(`   ❌ ${p.wallet}: No trades found`);
    }
  }

  console.log('\n🏆 6-WAY LOOP RESULT:');
  if (totalLoops > 0 && foundTrades > 0) {
    console.log('✅ SUCCESS: 6-way loop working perfectly!');
    console.log(`📈 ${totalLoops} loops discovered, ${foundTrades} trades accessible`);
  } else {
    console.log('❌ FAILED: 6-way loop not working');
    console.log(`📈 ${totalLoops} loops discovered, ${foundTrades} trades accessible`);
  }
}

test6Way().catch(console.error);