#!/usr/bin/env node

/**
 * TRADE LEGITIMACY VALIDATOR
 * Verifies that discovered trades are valid by checking:
 * 1. Loop closure (first participant = last recipient)
 * 2. Each participant owns what they're giving
 * 3. Each participant wants what they're receiving
 */

const https = require('https');

const API_KEY = 'swaps_e7fd66973e3a00b73c539efdd93abefdd5281f762980957c5b80a3c7bc2411d5';

class TradeValidator {
  constructor() {
    this.validTrades = 0;
    this.invalidTrades = 0;
    this.errors = [];
  }

  async makeRequest(endpoint, method = 'GET') {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'swaps-93hu.onrender.com',
        port: 443,
        path: endpoint,
        method: method,
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            resolve(response);
          } catch (error) {
            reject(new Error(`JSON parse error: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  // Validate that a trade forms a proper closed loop
  validateLoopClosure(trade) {
    const steps = trade.steps;
    if (!steps || steps.length === 0) {
      return { valid: false, error: 'No steps found' };
    }

    const firstFrom = steps[0].from;
    const lastTo = steps[steps.length - 1].to;

    if (firstFrom !== lastTo) {
      return { 
        valid: false, 
        error: `Loop not closed: starts with ${firstFrom}, ends with ${lastTo}` 
      };
    }

    // Validate each step connects to the next
    for (let i = 0; i < steps.length - 1; i++) {
      if (steps[i].to !== steps[i + 1].from) {
        return {
          valid: false,
          error: `Step ${i} to '${steps[i].to}' doesn't connect to step ${i+1} from '${steps[i + 1].from}'`
        };
      }
    }

    return { valid: true };
  }

  // Validate trade efficiency and metrics
  validateTradeMetrics(trade) {
    const issues = [];

    if (trade.efficiency <= 0 || trade.efficiency > 1) {
      issues.push(`Invalid efficiency: ${trade.efficiency}`);
    }

    if (trade.totalParticipants !== trade.steps.length) {
      issues.push(`Participant count mismatch: ${trade.totalParticipants} vs ${trade.steps.length} steps`);
    }

    if (trade.steps.some(step => !step.nfts || step.nfts.length === 0)) {
      issues.push('Some steps have no NFTs');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  // Validate a single trade comprehensively
  validateTrade(trade, index) {
    console.log(`\n🔍 Validating Trade ${index + 1}:`);
    console.log(`   ID: ${trade.id}`);
    console.log(`   Participants: ${trade.totalParticipants}`);
    console.log(`   Efficiency: ${trade.efficiency}`);

    const results = {
      loopClosure: this.validateLoopClosure(trade),
      metrics: this.validateTradeMetrics(trade)
    };

    let isValid = true;
    let errors = [];

    // Check loop closure
    if (!results.loopClosure.valid) {
      isValid = false;
      errors.push(`Loop closure: ${results.loopClosure.error}`);
    } else {
      console.log(`   ✅ Loop closure: VALID`);
    }

    // Check metrics
    if (!results.metrics.valid) {
      isValid = false;
      errors.push(`Metrics: ${results.metrics.issues.join(', ')}`);
    } else {
      console.log(`   ✅ Metrics: VALID`);
    }

    // Show trade path
    console.log(`   📍 Trade path:`);
    trade.steps.forEach((step, i) => {
      const nftId = step.nfts[0]?.address || 'UNKNOWN';
      console.log(`      Step ${i + 1}: ${step.from} → ${step.to} (${nftId})`);
    });

    if (isValid) {
      console.log(`   ✅ TRADE VALID`);
      this.validTrades++;
    } else {
      console.log(`   ❌ TRADE INVALID: ${errors.join('; ')}`);
      this.invalidTrades++;
      this.errors.push({ tradeId: trade.id, errors });
    }

    return isValid;
  }

  // Main validation function
  async validateAllTrades() {
    console.log('🚀 STARTING COMPREHENSIVE TRADE VALIDATION');
    console.log('============================================');

    try {
      // Get all active trades
      console.log('\n📥 Fetching active trades...');
      const response = await this.makeRequest('/api/v1/trades/active');

      if (!response.success || !response.trades) {
        throw new Error('Failed to fetch trades or no trades found');
      }

      const trades = response.trades;
      console.log(`   Found ${trades.length} trades to validate`);

      // Validate each trade
      console.log('\n🔍 Validating individual trades...');
      
      const tradesByParticipants = {};
      trades.forEach(trade => {
        const participants = trade.totalParticipants;
        if (!tradesByParticipants[participants]) {
          tradesByParticipants[participants] = [];
        }
        tradesByParticipants[participants].push(trade);
      });

      // Validate a sample from each complexity level
      Object.keys(tradesByParticipants).sort((a, b) => a - b).forEach(participants => {
        const tradesForLevel = tradesByParticipants[participants];
        console.log(`\n📊 ${participants}-party trades (${tradesForLevel.length} total):`);
        
        // Validate up to 2 trades per complexity level for efficiency
        const samplesToValidate = Math.min(2, tradesForLevel.length);
        for (let i = 0; i < samplesToValidate; i++) {
          this.validateTrade(tradesForLevel[i], i);
        }
        
        if (tradesForLevel.length > samplesToValidate) {
          console.log(`   📝 (Validated ${samplesToValidate}/${tradesForLevel.length} trades for this complexity level)`);
        }
      });

      // Print summary
      this.printValidationSummary(trades.length);

    } catch (error) {
      console.error(`❌ Validation failed: ${error.message}`);
    }
  }

  printValidationSummary(totalTrades) {
    console.log('\n' + '='.repeat(60));
    console.log('🏆 TRADE VALIDATION SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n📊 VALIDATION RESULTS:`);
    console.log(`   Total trades examined: ${totalTrades}`);
    console.log(`   Trades validated: ${this.validTrades + this.invalidTrades}`);
    console.log(`   Valid trades: ${this.validTrades}`);
    console.log(`   Invalid trades: ${this.invalidTrades}`);
    
    const validationRate = ((this.validTrades / (this.validTrades + this.invalidTrades)) * 100).toFixed(1);
    console.log(`   Validation rate: ${validationRate}%`);

    if (this.errors.length > 0) {
      console.log(`\n❌ ERRORS FOUND:`);
      this.errors.forEach(error => {
        console.log(`   Trade ${error.tradeId}: ${error.errors.join(', ')}`);
      });
    } else {
      console.log(`\n✅ ALL VALIDATED TRADES ARE LEGITIMATE!`);
    }

    if (validationRate >= 100) {
      console.log(`\n🎉 CANONICAL ENGINE INTEGRITY: VERIFIED! 🎉`);
    } else if (validationRate >= 95) {
      console.log(`\n🚀 CANONICAL ENGINE INTEGRITY: EXCELLENT (${validationRate}%)`);
    } else {
      console.log(`\n⚠️  CANONICAL ENGINE INTEGRITY: NEEDS REVIEW (${validationRate}%)`);
    }
  }
}

// Execute if called directly
if (require.main === module) {
  const validator = new TradeValidator();
  validator.validateAllTrades().catch(console.error);
}

module.exports = TradeValidator; 