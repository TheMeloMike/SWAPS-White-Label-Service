/**
 * CanonicalAlgorithmValidator
 * 
 * Comprehensive validation framework to ensure the CanonicalCycleEngine
 * produces mathematically correct and logically sound trade cycles.
 * 
 * Validates:
 * - Cycle completeness (all edges valid)
 * - Logical consistency (no impossible trades)
 * - Canonical uniqueness (no duplicate logical trades)
 * - Mathematical correctness (graph theory compliance)
 */

import { CanonicalCycleEngine } from '../../services/trade/CanonicalCycleEngine';
import { UnifiedTradeDiscoveryEngine } from '../../services/trade/UnifiedTradeDiscoveryEngine';
import { TradeLoop, WalletState } from '../../types/trade';
import { LoggingService } from '../../utils/logging/LoggingService';

export interface ValidationResult {
  passed: boolean;
  testName: string;
  details: {
    totalTrades: number;
    validTrades: number;
    invalidTrades: number;
    duplicateLogicalTrades: number;
    impossibleTrades: number;
    incompleteLoops: number;
  };
  errors: string[];
  performance: {
    validationTimeMs: number;
    cyclesPerSecond: number;
  };
}

export interface ValidationSuite {
  results: ValidationResult[];
  overallPassed: boolean;
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    overallAccuracy: number;
    avgPerformance: number;
  };
}

export class CanonicalAlgorithmValidator {
  private logger = LoggingService.getInstance().createLogger('CanonicalValidator');
  private canonicalEngine = CanonicalCycleEngine.getInstance();
  private unifiedEngine = UnifiedTradeDiscoveryEngine.getInstance();

  /**
   * Run comprehensive validation suite
   */
  public async runValidationSuite(): Promise<ValidationSuite> {
    const results: ValidationResult[] = [];
    
    this.logger.info('Starting canonical algorithm validation suite');

    // Test 1: Basic cycle validity
    results.push(await this.validateBasicCycleStructure());
    
    // Test 2: Logical trade consistency  
    results.push(await this.validateLogicalConsistency());
    
    // Test 3: Canonical uniqueness
    results.push(await this.validateCanonicalUniqueness());
    
    // Test 4: Mathematical correctness
    results.push(await this.validateMathematicalCorrectness());
    
    // Test 5: Edge case handling
    results.push(await this.validateEdgeCases());
    
    // Test 6: Large scale validation
    results.push(await this.validateLargeScale());

    const summary = this.calculateSummary(results);
    
    return {
      results,
      overallPassed: summary.failedTests === 0,
      summary
    };
  }

  /**
   * Validate that all discovered cycles form complete, valid loops
   */
  private async validateBasicCycleStructure(): Promise<ValidationResult> {
    const testName = 'Basic Cycle Structure Validation';
    const startTime = performance.now();
    const errors: string[] = [];
    
    // Create test scenario
    const testData = this.createTestScenario('basic', 5, 3, 0.6);
    
    const config = {
      maxDepth: 10,
      timeoutMs: 10000,
      maxCyclesPerSCC: 100,
      enableBundleDetection: true,
      canonicalOnly: true
    };

    const result = await this.canonicalEngine.discoverCanonicalCycles(
      testData.wallets,
      testData.nftOwnership,
      testData.wantedNfts,
      config
    );

    let validTrades = 0;
    let invalidTrades = 0;
    let incompleteLoops = 0;

    for (const trade of result.cycles) {
      const validation = this.validateTradeLoopStructure(trade, testData);
      
      if (validation.isValid) {
        validTrades++;
      } else {
        invalidTrades++;
        errors.push(`Trade ${trade.id}: ${validation.errors.join(', ')}`);
        
        if (validation.errors.some(e => e.includes('incomplete'))) {
          incompleteLoops++;
        }
      }
    }

    const validationTime = performance.now() - startTime;

    return {
      passed: invalidTrades === 0,
      testName,
      details: {
        totalTrades: result.cycles.length,
        validTrades,
        invalidTrades,
        duplicateLogicalTrades: 0, // Checked in different test
        impossibleTrades: 0, // Checked in different test
        incompleteLoops
      },
      errors,
      performance: {
        validationTimeMs: validationTime,
        cyclesPerSecond: result.cycles.length / (validationTime / 1000)
      }
    };
  }

  /**
   * Validate logical consistency of trades (participants actually want what they're getting)
   */
  private async validateLogicalConsistency(): Promise<ValidationResult> {
    const testName = 'Logical Consistency Validation';
    const startTime = performance.now();
    const errors: string[] = [];
    
    const testData = this.createTestScenario('complex', 7, 4, 0.5);
    
    const config = {
      maxDepth: 8,
      timeoutMs: 10000,
      maxCyclesPerSCC: 100,
      enableBundleDetection: true,
      canonicalOnly: true
    };

    const result = await this.canonicalEngine.discoverCanonicalCycles(
      testData.wallets,
      testData.nftOwnership,
      testData.wantedNfts,
      config
    );

    let validTrades = 0;
    let impossibleTrades = 0;

    for (const trade of result.cycles) {
      const consistency = this.validateTradeLogic(trade, testData);
      
      if (consistency.isLogical) {
        validTrades++;
      } else {
        impossibleTrades++;
        errors.push(`Trade ${trade.id}: ${consistency.errors.join(', ')}`);
      }
    }

    const validationTime = performance.now() - startTime;

    return {
      passed: impossibleTrades === 0,
      testName,
      details: {
        totalTrades: result.cycles.length,
        validTrades,
        invalidTrades: impossibleTrades,
        duplicateLogicalTrades: 0,
        impossibleTrades,
        incompleteLoops: 0
      },
      errors,
      performance: {
        validationTimeMs: validationTime,
        cyclesPerSecond: result.cycles.length / (validationTime / 1000)
      }
    };
  }

  /**
   * Validate that canonical engine produces unique logical trades
   */
  private async validateCanonicalUniqueness(): Promise<ValidationResult> {
    const testName = 'Canonical Uniqueness Validation';
    const startTime = performance.now();
    const errors: string[] = [];
    
    const testData = this.createTestScenario('duplicates', 6, 5, 0.7);
    
    const config = {
      maxDepth: 10,
      timeoutMs: 15000,
      maxCyclesPerSCC: 200,
      enableBundleDetection: true,
      canonicalOnly: true
    };

    const result = await this.canonicalEngine.discoverCanonicalCycles(
      testData.wallets,
      testData.nftOwnership,
      testData.wantedNfts,
      config
    );

    // Create logical signatures for each trade
    const logicalSignatures = new Set<string>();
    let duplicateLogicalTrades = 0;

    for (const trade of result.cycles) {
      const signature = this.createLogicalSignature(trade);
      
      if (logicalSignatures.has(signature)) {
        duplicateLogicalTrades++;
        errors.push(`Duplicate logical trade found: ${signature} (Trade ID: ${trade.id})`);
      } else {
        logicalSignatures.add(signature);
      }
    }

    const validationTime = performance.now() - startTime;

    return {
      passed: duplicateLogicalTrades === 0,
      testName,
      details: {
        totalTrades: result.cycles.length,
        validTrades: result.cycles.length - duplicateLogicalTrades,
        invalidTrades: duplicateLogicalTrades,
        duplicateLogicalTrades,
        impossibleTrades: 0,
        incompleteLoops: 0
      },
      errors,
      performance: {
        validationTimeMs: validationTime,
        cyclesPerSecond: result.cycles.length / (validationTime / 1000)
      }
    };
  }

  /**
   * Validate mathematical correctness (graph theory compliance)
   */
  private async validateMathematicalCorrectness(): Promise<ValidationResult> {
    const testName = 'Mathematical Correctness Validation';
    const startTime = performance.now();
    const errors: string[] = [];
    
    const testData = this.createTestScenario('mathematical', 8, 3, 0.4);
    
    const config = {
      maxDepth: 12,
      timeoutMs: 15000,
      maxCyclesPerSCC: 150,
      enableBundleDetection: true,
      canonicalOnly: true
    };

    const result = await this.canonicalEngine.discoverCanonicalCycles(
      testData.wallets,
      testData.nftOwnership,
      testData.wantedNfts,
      config
    );

    let validTrades = 0;
    let mathematicallyInvalid = 0;

    for (const trade of result.cycles) {
      const mathValidation = this.validateMathematicalProperties(trade, testData);
      
      if (mathValidation.isValid) {
        validTrades++;
      } else {
        mathematicallyInvalid++;
        errors.push(`Trade ${trade.id}: ${mathValidation.errors.join(', ')}`);
      }
    }

    const validationTime = performance.now() - startTime;

    return {
      passed: mathematicallyInvalid === 0,
      testName,
      details: {
        totalTrades: result.cycles.length,
        validTrades,
        invalidTrades: mathematicallyInvalid,
        duplicateLogicalTrades: 0,
        impossibleTrades: mathematicallyInvalid,
        incompleteLoops: 0
      },
      errors,
      performance: {
        validationTimeMs: validationTime,
        cyclesPerSecond: result.cycles.length / (validationTime / 1000)
      }
    };
  }

  /**
   * Validate edge cases (empty graphs, single wallets, etc.)
   */
  private async validateEdgeCases(): Promise<ValidationResult> {
    const testName = 'Edge Cases Validation';
    const startTime = performance.now();
    const errors: string[] = [];
    
    let totalTests = 0;
    let passedTests = 0;

    // Test empty scenario
    const emptyResult = await this.testEmptyScenario();
    totalTests++;
    if (emptyResult.passed) passedTests++;
    else errors.push(...emptyResult.errors);

    // Test single wallet scenario
    const singleWalletResult = await this.testSingleWalletScenario();
    totalTests++;
    if (singleWalletResult.passed) passedTests++;
    else errors.push(...singleWalletResult.errors);

    // Test no possible trades scenario
    const noTradesResult = await this.testNoTradesScenario();
    totalTests++;
    if (noTradesResult.passed) passedTests++;
    else errors.push(...noTradesResult.errors);

    const validationTime = performance.now() - startTime;

    return {
      passed: errors.length === 0,
      testName,
      details: {
        totalTrades: totalTests,
        validTrades: passedTests,
        invalidTrades: totalTests - passedTests,
        duplicateLogicalTrades: 0,
        impossibleTrades: 0,
        incompleteLoops: 0
      },
      errors,
      performance: {
        validationTimeMs: validationTime,
        cyclesPerSecond: totalTests / (validationTime / 1000)
      }
    };
  }

  /**
   * Validate performance and correctness at scale
   */
  private async validateLargeScale(): Promise<ValidationResult> {
    const testName = 'Large Scale Validation';
    const startTime = performance.now();
    const errors: string[] = [];
    
    const testData = this.createTestScenario('large', 20, 4, 0.3);
    
    const config = {
      maxDepth: 15,
      timeoutMs: 30000,
      maxCyclesPerSCC: 500,
      enableBundleDetection: true,
      canonicalOnly: true
    };

    const result = await this.canonicalEngine.discoverCanonicalCycles(
      testData.wallets,
      testData.nftOwnership,
      testData.wantedNfts,
      config
    );

    // Validate that all found trades are valid
    let validTrades = 0;
    let invalidTrades = 0;

    for (const trade of result.cycles) {
      const isValid = this.quickValidateTrade(trade, testData);
      if (isValid) {
        validTrades++;
      } else {
        invalidTrades++;
        errors.push(`Invalid trade found at scale: ${trade.id}`);
      }
    }

    const validationTime = performance.now() - startTime;

    return {
      passed: invalidTrades === 0 && !result.metadata.timedOut,
      testName,
      details: {
        totalTrades: result.cycles.length,
        validTrades,
        invalidTrades,
        duplicateLogicalTrades: 0,
        impossibleTrades: invalidTrades,
        incompleteLoops: 0
      },
      errors,
      performance: {
        validationTimeMs: validationTime,
        cyclesPerSecond: result.cycles.length / (validationTime / 1000)
      }
    };
  }

  /**
   * Validate trade loop structure
   */
  private validateTradeLoopStructure(
    trade: TradeLoop,
    testData: any
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if loop is complete (last step leads back to first)
    if (trade.steps.length === 0) {
      errors.push('Trade has no steps');
      return { isValid: false, errors };
    }

    const firstWallet = trade.steps[0].from;
    const lastWallet = trade.steps[trade.steps.length - 1].to;
    
    if (firstWallet !== lastWallet) {
      errors.push(`Incomplete loop: starts at ${firstWallet}, ends at ${lastWallet}`);
    }

    // Check step continuity
    for (let i = 0; i < trade.steps.length; i++) {
      const currentStep = trade.steps[i];
      const nextStep = trade.steps[(i + 1) % trade.steps.length];
      
      if (currentStep.to !== nextStep.from) {
        errors.push(`Step discontinuity: step ${i} ends at ${currentStep.to}, step ${i+1} starts at ${nextStep.from}`);
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate trade logic (wants and ownership)
   */
  private validateTradeLogic(
    trade: TradeLoop,
    testData: any
  ): { isLogical: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const step of trade.steps) {
      // Check if 'from' wallet actually owns the NFTs being traded
      for (const nft of step.nfts) {
        const actualOwner = testData.nftOwnership.get(nft.address);
        if (actualOwner !== step.from) {
          errors.push(`${step.from} doesn't own ${nft.address} (owned by ${actualOwner})`);
        }
      }

      // Check if 'to' wallet actually wants the NFTs
      for (const nft of step.nfts) {
        const wanters = testData.wantedNfts.get(nft.address);
        if (!wanters || !wanters.has(step.to)) {
          errors.push(`${step.to} doesn't want ${nft.address}`);
        }
      }
    }

    return { isLogical: errors.length === 0, errors };
  }

  /**
   * Create logical signature for duplicate detection
   */
  private createLogicalSignature(trade: TradeLoop): string {
    const participants = trade.steps.map(step => step.from).sort();
    const nfts = trade.steps.flatMap(step => step.nfts.map(nft => nft.address)).sort();
    
    return `${participants.join(',')}|${nfts.join(',')}`;
  }

  /**
   * Validate mathematical properties of the trade
   */
  private validateMathematicalProperties(
    trade: TradeLoop,
    testData: any
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check cycle length constraints
    if (trade.steps.length < 2) {
      errors.push('Cycle must have at least 2 steps');
    }

    if (trade.steps.length > 20) {
      errors.push('Cycle too long (>20 steps)');
    }

    // Check for self-loops (wallet trading with itself)
    for (const step of trade.steps) {
      if (step.from === step.to) {
        errors.push(`Self-loop detected: ${step.from} trading with itself`);
      }
    }

    // Check for repeated participants within the same cycle
    const participants = trade.steps.map(step => step.from);
    const uniqueParticipants = new Set(participants);
    
    if (participants.length !== uniqueParticipants.size) {
      errors.push('Cycle has repeated participants');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Test empty scenario
   */
  private async testEmptyScenario(): Promise<{ passed: boolean; errors: string[] }> {
    const config = {
      maxDepth: 10,
      timeoutMs: 5000,
      maxCyclesPerSCC: 100,
      enableBundleDetection: true,
      canonicalOnly: true
    };

    const result = await this.canonicalEngine.discoverCanonicalCycles(
      new Map(),
      new Map(),
      new Map(),
      config
    );

    return {
      passed: result.cycles.length === 0,
      errors: result.cycles.length > 0 ? ['Empty scenario should return no cycles'] : []
    };
  }

  /**
   * Test single wallet scenario
   */
  private async testSingleWalletScenario(): Promise<{ passed: boolean; errors: string[] }> {
    const wallets = new Map([
      ['wallet1', {
        address: 'wallet1',
        ownedNfts: new Set(['nft1']),
        wantedNfts: new Set(['nft2']),
        lastUpdated: new Date()
      }]
    ]);

    const nftOwnership = new Map([['nft1', 'wallet1']]);
    const wantedNfts = new Map([['nft2', new Set(['wallet1'])]]);

    const config = {
      maxDepth: 10,
      timeoutMs: 5000,
      maxCyclesPerSCC: 100,
      enableBundleDetection: true,
      canonicalOnly: true
    };

    const result = await this.canonicalEngine.discoverCanonicalCycles(
      wallets,
      nftOwnership,
      wantedNfts,
      config
    );

    return {
      passed: result.cycles.length === 0,
      errors: result.cycles.length > 0 ? ['Single wallet should not form cycles'] : []
    };
  }

  /**
   * Test no possible trades scenario
   */
  private async testNoTradesScenario(): Promise<{ passed: boolean; errors: string[] }> {
    // Create scenario where no one wants what others have
    const wallets = new Map([
      ['wallet1', {
        address: 'wallet1',
        ownedNfts: new Set(['nft1']),
        wantedNfts: new Set(['nft3']),
        lastUpdated: new Date()
      }],
      ['wallet2', {
        address: 'wallet2',
        ownedNfts: new Set(['nft2']),
        wantedNfts: new Set(['nft4']),
        lastUpdated: new Date()
      }]
    ]);

    const nftOwnership = new Map([
      ['nft1', 'wallet1'],
      ['nft2', 'wallet2']
    ]);

    const wantedNfts = new Map([
      ['nft3', new Set(['wallet1'])],
      ['nft4', new Set(['wallet2'])]
    ]);

    const config = {
      maxDepth: 10,
      timeoutMs: 5000,
      maxCyclesPerSCC: 100,
      enableBundleDetection: true,
      canonicalOnly: true
    };

    const result = await this.canonicalEngine.discoverCanonicalCycles(
      wallets,
      nftOwnership,
      wantedNfts,
      config
    );

    return {
      passed: result.cycles.length === 0,
      errors: result.cycles.length > 0 ? ['No possible trades scenario should return no cycles'] : []
    };
  }

  /**
   * Quick validation for large scale testing
   */
  private quickValidateTrade(trade: TradeLoop, testData: any): boolean {
    // Quick checks for basic validity
    if (trade.steps.length < 2) return false;
    if (trade.steps[0].from !== trade.steps[trade.steps.length - 1].to) return false;
    
    return true;
  }

  /**
   * Create test scenario with controlled parameters
   */
  private createTestScenario(
    type: string,
    numWallets: number,
    nftsPerWallet: number,
    wantsDensity: number
  ) {
    const wallets = new Map<string, WalletState>();
    const nftOwnership = new Map<string, string>();
    const wantedNfts = new Map<string, Set<string>>();

    // Create wallets and NFTs
    for (let w = 0; w < numWallets; w++) {
      const walletId = `${type}_wallet_${w}`;
      const ownedNfts = new Set<string>();
      const wantedNftsSet = new Set<string>();

      for (let n = 0; n < nftsPerWallet; n++) {
        const nftId = `${type}_nft_${w}_${n}`;
        ownedNfts.add(nftId);
        nftOwnership.set(nftId, walletId);
      }

      wallets.set(walletId, {
        address: walletId,
        ownedNfts,
        wantedNfts: wantedNftsSet,
        lastUpdated: new Date()
      });
    }

    // Create wants based on density
    const allNFTs = Array.from(nftOwnership.keys());
    const allWallets = Array.from(wallets.keys());
    
    for (const nftId of allNFTs) {
      const wanters = new Set<string>();
      const numWanters = Math.floor(numWallets * wantsDensity);
      
      const shuffledWallets = allWallets.sort(() => Math.random() - 0.5);
      for (let i = 0; i < numWanters; i++) {
        const wanter = shuffledWallets[i];
        if (nftOwnership.get(nftId) !== wanter) {
          wanters.add(wanter);
          wallets.get(wanter)!.wantedNfts.add(nftId);
        }
      }
      
      if (wanters.size > 0) {
        wantedNfts.set(nftId, wanters);
      }
    }

    return { wallets, nftOwnership, wantedNfts };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(results: ValidationResult[]) {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    const overallAccuracy = totalTests > 0 ? passedTests / totalTests : 0;
    const avgPerformance = results.reduce((sum, r) => sum + r.performance.cyclesPerSecond, 0) / totalTests;

    return {
      totalTests,
      passedTests,
      failedTests,
      overallAccuracy,
      avgPerformance
    };
  }

  /**
   * Generate validation report
   */
  public generateValidationReport(suite: ValidationSuite): string {
    let report = '\n🧪 CANONICAL ALGORITHM VALIDATION REPORT\n';
    report += '=' .repeat(60) + '\n\n';

    report += `📊 OVERALL RESULTS:\n`;
    report += `   Tests Passed: ${suite.summary.passedTests}/${suite.summary.totalTests}\n`;
    report += `   Success Rate: ${(suite.summary.overallAccuracy * 100).toFixed(1)}%\n`;
    report += `   Overall Status: ${suite.overallPassed ? '✅ PASSED' : '❌ FAILED'}\n\n`;

    for (const result of suite.results) {
      report += `🔬 ${result.testName}:\n`;
      report += `-`.repeat(40) + '\n';
      report += `   Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
      report += `   Total Trades: ${result.details.totalTrades}\n`;
      report += `   Valid Trades: ${result.details.validTrades}\n`;
      report += `   Invalid Trades: ${result.details.invalidTrades}\n`;
      if (result.details.duplicateLogicalTrades > 0) {
        report += `   Duplicate Logical Trades: ${result.details.duplicateLogicalTrades}\n`;
      }
      if (result.details.impossibleTrades > 0) {
        report += `   Impossible Trades: ${result.details.impossibleTrades}\n`;
      }
      if (result.details.incompleteLoops > 0) {
        report += `   Incomplete Loops: ${result.details.incompleteLoops}\n`;
      }
      report += `   Performance: ${result.performance.cyclesPerSecond.toFixed(2)} cycles/sec\n`;
      
      if (result.errors.length > 0) {
        report += `   Errors:\n`;
        result.errors.forEach(error => {
          report += `     - ${error}\n`;
        });
      }
      report += '\n';
    }

    report += `🎯 VALIDATION SUMMARY:\n`;
    report += `   Algorithm Correctness: ${suite.overallPassed ? 'VALIDATED' : 'ISSUES FOUND'}\n`;
    report += `   Ready for Production: ${suite.overallPassed ? 'YES' : 'NO - FIX ISSUES FIRST'}\n`;

    return report;
  }
} 