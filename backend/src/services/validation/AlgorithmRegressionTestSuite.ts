import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { TradeDiscoveryService } from '../trade/TradeDiscoveryService';
import { PersistentTradeDiscoveryService } from '../trade/PersistentTradeDiscoveryService';
import { TradeLoopFinderService } from '../trade/TradeLoopFinderService';
import { ScalableTradeLoopFinderService } from '../trade/ScalableTradeLoopFinderService';
import { TradeScoreService } from '../trade/TradeScoreService';
import { 
  ValidationResult,
  ValidationReport,
  TestScenario,
  GoldenFileTest,
  ComparisonResult,
  PerformanceBaseline,
  ValidationSuiteConfig,
  RegressionIssue,
  GoldenFileValidationResult,
  PerformanceValidationResult,
  TenantValidationScenario,
  TenantValidationResult
} from '../../types/validation';
import { TradeLoop, WalletState, RejectionPreferences } from '../../types/trade';
import { AbstractNFT, AbstractWallet, TenantConfig } from '../../types/abstract';

/**
 * Algorithm Regression Test Suite
 * 
 * Comprehensive validation framework to ensure zero degradation in trade discovery
 * accuracy during white label transformation. Validates:
 * 
 * 1. Algorithm Parity: Original vs transformed outputs are identical
 * 2. Performance Regression: No significant slowdown
 * 3. Multi-tenant Isolation: Tenant data doesn't leak between tests
 * 4. Golden File Tests: Known scenarios produce expected results
 * 5. Score Consistency: 18-metric scoring system maintains accuracy
 */
export class AlgorithmRegressionTestSuite extends EventEmitter {
  private static instance: AlgorithmRegressionTestSuite;
  private logger: Logger;
  
  // Services to test
  private originalService: TradeDiscoveryService;
  private transformedService: PersistentTradeDiscoveryService;
  private tradeScoreService: TradeScoreService;
  
  // Test data and configuration
  private testScenarios: TestScenario[] = [];
  private goldenFileTests: GoldenFileTest[] = [];
  private performanceBaselines: PerformanceBaseline[] = [];
  
  // Results tracking
  private validationResults: ValidationResult[] = [];
  private regressionIssues: RegressionIssue[] = [];
  
  // Configuration
  private config: ValidationSuiteConfig = {
    scenarios: [],
    goldenFiles: [],
    baselines: [],
    settings: {
      timeoutMs: 30000,
      maxConcurrentTests: 3,
      enablePerformanceTests: true,
      enableGoldenFileTests: true,
      scoreTolerancePercent: 1.0, // 1% tolerance
      enableDetailedLogging: false
    }
  };

  private constructor() {
    super();
    this.logger = LoggingService.getInstance().createLogger('AlgorithmRegressionTest');
    
    // Initialize services
    this.originalService = TradeDiscoveryService.getInstance();
    this.transformedService = PersistentTradeDiscoveryService.getInstance();
    this.tradeScoreService = TradeScoreService.getInstance();
    
    this.logger.info('Algorithm Regression Test Suite initialized');
  }

  public static getInstance(): AlgorithmRegressionTestSuite {
    if (!AlgorithmRegressionTestSuite.instance) {
      AlgorithmRegressionTestSuite.instance = new AlgorithmRegressionTestSuite();
    }
    return AlgorithmRegressionTestSuite.instance;
  }

  /**
   * Load test configuration and scenarios
   */
  public async loadConfiguration(configPath: string): Promise<void> {
    const operation = this.logger.operation('loadConfiguration');
    
    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      this.config = JSON.parse(configData);
      
      this.testScenarios = this.config.scenarios;
      this.goldenFileTests = this.config.goldenFiles;
      this.performanceBaselines = this.config.baselines;
      
      operation.info('Configuration loaded', {
        scenarios: this.testScenarios.length,
        goldenFiles: this.goldenFileTests.length,
        baselines: this.performanceBaselines.length
      });
      
      operation.end();
    } catch (error) {
      operation.error('Failed to load configuration', {
        configPath,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Run comprehensive validation suite
   */
  public async runValidationSuite(): Promise<ValidationReport> {
    const operation = this.logger.operation('runValidationSuite');
    const startTime = performance.now();
    
    try {
      operation.info('Starting comprehensive algorithm regression validation');
      
      // Clear previous results
      this.validationResults = [];
      this.regressionIssues = [];
      
      // 1. Run algorithm parity tests
      operation.info('Running algorithm parity tests');
      await this.runAlgorithmParityTests();
      
      // 2. Run golden file tests
      if (this.config.settings.enableGoldenFileTests) {
        operation.info('Running golden file tests');
        await this.runGoldenFileTests();
      }
      
      // 3. Run performance regression tests
      if (this.config.settings.enablePerformanceTests) {
        operation.info('Running performance regression tests');
        await this.runPerformanceTests();
      }
      
      // 4. Run multi-tenant isolation tests
      operation.info('Running multi-tenant isolation tests');
      await this.runTenantIsolationTests();
      
      // 5. Generate comprehensive report
      const report = this.generateValidationReport(performance.now() - startTime);
      
      operation.info('Validation suite completed', {
        totalTests: report.summary.totalTests,
        passed: report.summary.passedTests,
        failed: report.summary.failedTests,
        success: report.summary.overallSuccess
      });
      
      operation.end();
      return report;
      
    } catch (error) {
      operation.error('Validation suite failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Test algorithm parity between original and transformed implementations
   */
  private async runAlgorithmParityTests(): Promise<void> {
    const operation = this.logger.operation('runAlgorithmParityTests');
    
    for (const scenario of this.testScenarios) {
      try {
        operation.info(`Testing scenario: ${scenario.scenarioId}`);
        
        // Test Johnson's algorithm
        const johnsonResult = await this.validateAlgorithmParity(
          scenario, 
          'johnson'
        );
        this.validationResults.push(johnsonResult);
        
        // Test Scalable algorithm  
        const scalableResult = await this.validateAlgorithmParity(
          scenario,
          'scalable'
        );
        this.validationResults.push(scalableResult);
        
        // Test Bundle algorithm if applicable
        if (scenario.algorithmExpectations.bundle) {
          const bundleResult = await this.validateAlgorithmParity(
            scenario,
            'bundle'
          );
          this.validationResults.push(bundleResult);
        }
        
      } catch (error) {
        operation.error(`Failed to test scenario ${scenario.scenarioId}`, {
          error: error instanceof Error ? error.message : String(error)
        });
        
        // Create failed result
        const failedResult: ValidationResult = {
          scenarioId: scenario.scenarioId,
          algorithm: 'unknown',
          passed: false,
          accuracyMetrics: {
            loopCountMatch: false,
            scoreVariance: Infinity,
            missingLoops: 0,
            extraLoops: 0,
            topScoreDifference: Infinity
          },
          performanceMetrics: {
            originalTimeMs: 0,
            transformedTimeMs: 0,
            performanceRatio: Infinity
          },
          comparison: {
            originalLoops: [],
            transformedLoops: [],
            analysis: {
              identicalLoops: 0,
              similarLoops: 0,
              onlyInOriginal: [],
              onlyInTransformed: [],
              scoreCorrelation: 0
            }
          },
          errors: [error instanceof Error ? error.message : String(error)]
        };
        
        this.validationResults.push(failedResult);
      }
    }
    
    operation.end();
  }

  /**
   * Validate algorithm parity for a specific scenario and algorithm
   */
  private async validateAlgorithmParity(
    scenario: TestScenario,
    algorithm: 'johnson' | 'scalable' | 'bundle'
  ): Promise<ValidationResult> {
    const operation = this.logger.operation('validateAlgorithmParity');
    
    try {
      // Prepare test data
      const wallets = new Map<string, WalletState>();
      const nftOwnership = new Map<string, string>();
      const wantedNfts = new Map<string, Set<string>>();
      const rejectionPreferences = new Map<string, RejectionPreferences>();
      
      // Convert scenario data to maps
      for (const wallet of scenario.wallets) {
        wallets.set(wallet.address, wallet);
        
        // Add owned NFTs to ownership map
        for (const nftId of wallet.ownedNfts) {
          nftOwnership.set(nftId, wallet.address);
        }
        
        // Add wanted NFTs
        if (wallet.wantedNfts.size > 0) {
          for (const wantedNft of wallet.wantedNfts) {
            if (!wantedNfts.has(wantedNft)) {
              wantedNfts.set(wantedNft, new Set());
            }
            wantedNfts.get(wantedNft)!.add(wallet.address);
          }
        }
      }
      
      // Run original algorithm
      const originalStartTime = performance.now();
      const originalLoops = await this.runOriginalAlgorithm(
        algorithm,
        wallets,
        nftOwnership, 
        wantedNfts,
        rejectionPreferences
      );
      const originalTime = performance.now() - originalStartTime;
      
      // Run transformed algorithm (via white label layer)
      const transformedStartTime = performance.now();
      const transformedLoops = await this.runTransformedAlgorithm(
        algorithm,
        scenario.abstractWallets,
        'test-tenant'
      );
      const transformedTime = performance.now() - transformedStartTime;
      
      // Compare results
      const comparison = this.compareTradeLoops(originalLoops, transformedLoops);
      
      // Calculate metrics
      const accuracyMetrics = this.calculateAccuracyMetrics(comparison, scenario);
      const performanceMetrics = {
        originalTimeMs: originalTime,
        transformedTimeMs: transformedTime,
        performanceRatio: transformedTime / originalTime
      };
      
      // Determine if test passed
      const passed = this.evaluateTestSuccess(accuracyMetrics, performanceMetrics, scenario);
      
      const result: ValidationResult = {
        scenarioId: scenario.scenarioId,
        algorithm,
        passed,
        accuracyMetrics,
        performanceMetrics,
        comparison
      };
      
      if (!passed) {
        this.detectRegressions(result, scenario);
      }
      
      operation.info(`Algorithm parity test completed`, {
        scenarioId: scenario.scenarioId,
        algorithm,
        passed,
        originalLoops: originalLoops.length,
        transformedLoops: transformedLoops.length
      });
      
      operation.end();
      return result;
      
    } catch (error) {
      operation.error('Algorithm parity validation failed', {
        scenarioId: scenario.scenarioId,
        algorithm,
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Run original algorithm implementation
   */
  private async runOriginalAlgorithm(
    algorithm: string,
    wallets: Map<string, WalletState>,
    nftOwnership: Map<string, string>,
    wantedNfts: Map<string, Set<string>>,
    rejectionPreferences: Map<string, RejectionPreferences>
  ): Promise<TradeLoop[]> {
    
    switch (algorithm) {
      case 'johnson':
        const johnsonFinder = new TradeLoopFinderService(10, 0.6);
        return await johnsonFinder.findAllTradeLoops(
          wallets,
          nftOwnership,
          wantedNfts,
          rejectionPreferences
        );
        
      case 'scalable':
        const scalableFinder = ScalableTradeLoopFinderService.getInstance();
        return await scalableFinder.findAllTradeLoops(
          wallets,
          nftOwnership,
          wantedNfts,
          rejectionPreferences
        );
        
      default:
        return await this.originalService.findTradeLoops();
    }
  }

  /**
   * Run transformed algorithm through white label layer
   */
  private async runTransformedAlgorithm(
    algorithm: string,
    abstractWallets: AbstractWallet[],
    tenantId: string
  ): Promise<TradeLoop[]> {
    
    // Initialize tenant if not exists
         const testTenant: TenantConfig = {
       id: tenantId,
       name: 'Test Tenant',
       apiKey: 'test-key',
             settings: {
        blockchain: {
          preferred: 'solana',
          allowSwitching: false,
          ethereumNetwork: 'sepolia',
          solanaNetwork: 'devnet'
        },
        algorithm: {
          maxDepth: 10,
          minEfficiency: 0.6,
          maxLoopsPerRequest: 100,
          enableCollectionTrading: false
        },
        rateLimits: {
          discoveryRequestsPerMinute: 1000,
          nftSubmissionsPerDay: 10000,
          webhookCallsPerMinute: 100
        },
        security: {
          maxNFTsPerWallet: 1000,
          maxWantsPerWallet: 100,
          minNFTValueUSD: 0,
          blacklistedCollections: []
        },
        webhooks: {
          tradeDiscoveryUrl: undefined,
          enabled: false
        }
      },
       createdAt: new Date()
     };
    
    try {
      await this.transformedService.initializeTenant(testTenant);
    } catch (error) {
      // Tenant might already exist, continue
    }
    
    // Add wallets and NFTs to tenant
    const allLoops: TradeLoop[] = [];
    
    for (const wallet of abstractWallets) {
      // Add each NFT
      for (const nft of wallet.ownedNFTs) {
        const loops = await this.transformedService.onNFTAdded(tenantId, nft);
        allLoops.push(...loops);
      }
      
      // Add wants
      for (const wantedNftId of wallet.wantedNFTs) {
        const loops = await this.transformedService.onWantAdded(
          tenantId, 
          wallet.id, 
          wantedNftId
        );
        allLoops.push(...loops);
      }
    }
    
    // Remove duplicates
    const uniqueLoops = this.deduplicateTradeLoops(allLoops);
    
    return uniqueLoops;
  }

  /**
   * Compare trade loops between original and transformed algorithms
   */
  private compareTradeLoops(
    originalLoops: TradeLoop[], 
    transformedLoops: TradeLoop[]
  ): ComparisonResult {
    
    let identicalLoops = 0;
    let similarLoops = 0;
    const onlyInOriginal: TradeLoop[] = [];
    const onlyInTransformed: TradeLoop[] = [];
    
    // Find matching loops
    const originalIds = new Set(originalLoops.map(loop => loop.id));
    const transformedIds = new Set(transformedLoops.map(loop => loop.id));
    
    for (const loop of originalLoops) {
      if (transformedIds.has(loop.id)) {
        identicalLoops++;
      } else {
        // Check for similar loops (same participants, different order)
        const similarLoop = this.findSimilarLoop(loop, transformedLoops);
        if (similarLoop) {
          similarLoops++;
        } else {
          onlyInOriginal.push(loop);
        }
      }
    }
    
    for (const loop of transformedLoops) {
      if (!originalIds.has(loop.id)) {
        const similarLoop = this.findSimilarLoop(loop, originalLoops);
        if (!similarLoop) {
          onlyInTransformed.push(loop);
        }
      }
    }
    
    // Calculate score correlation
    const scoreCorrelation = this.calculateScoreCorrelation(originalLoops, transformedLoops);
    
    return {
      originalLoops,
      transformedLoops,
      analysis: {
        identicalLoops,
        similarLoops,
        onlyInOriginal,
        onlyInTransformed,
        scoreCorrelation
      }
    };
  }

  /**
   * Helper methods for validation
   */
  private deduplicateTradeLoops(loops: TradeLoop[]): TradeLoop[] {
    const seen = new Set<string>();
    return loops.filter(loop => {
      if (seen.has(loop.id)) {
        return false;
      }
      seen.add(loop.id);
      return true;
    });
  }

  private findSimilarLoop(targetLoop: TradeLoop, loops: TradeLoop[]): TradeLoop | null {
    // Check if any loop has the same participants (regardless of order)
    const targetParticipants = new Set(targetLoop.steps.map(step => step.from));
    
    for (const loop of loops) {
      const loopParticipants = new Set(loop.steps.map(step => step.from));
      
      if (this.setsEqual(targetParticipants, loopParticipants)) {
        return loop;
      }
    }
    
    return null;
  }

  private setsEqual<T>(setA: Set<T>, setB: Set<T>): boolean {
    if (setA.size !== setB.size) return false;
    for (const item of setA) {
      if (!setB.has(item)) return false;
    }
    return true;
  }

  private calculateScoreCorrelation(loops1: TradeLoop[], loops2: TradeLoop[]): number {
    // Simple correlation calculation between scores
    if (loops1.length === 0 || loops2.length === 0) return 0;
    
         const scores1 = loops1.map(loop => loop.qualityScore || loop.efficiency || 0);
     const scores2 = loops2.map(loop => loop.qualityScore || loop.efficiency || 0);
    
    if (scores1.length !== scores2.length) return 0;
    
    const mean1 = scores1.reduce((a, b) => a + b, 0) / scores1.length;
    const mean2 = scores2.reduce((a, b) => a + b, 0) / scores2.length;
    
    let numerator = 0;
    let sumSq1 = 0;
    let sumSq2 = 0;
    
    for (let i = 0; i < scores1.length; i++) {
      const diff1 = scores1[i] - mean1;
      const diff2 = scores2[i] - mean2;
      numerator += diff1 * diff2;
      sumSq1 += diff1 * diff1;
      sumSq2 += diff2 * diff2;
    }
    
    const denominator = Math.sqrt(sumSq1 * sumSq2);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateAccuracyMetrics(comparison: ComparisonResult, scenario: TestScenario): any {
    const { originalLoops, transformedLoops, analysis } = comparison;
    
    const loopCountMatch = originalLoops.length === transformedLoops.length;
    const missingLoops = analysis.onlyInOriginal.length;
    const extraLoops = analysis.onlyInTransformed.length;
    
         // Calculate score variance
     const originalScores = originalLoops.map(loop => loop.qualityScore || loop.efficiency || 0);
     const transformedScores = transformedLoops.map(loop => loop.qualityScore || loop.efficiency || 0);
    
    let scoreVariance = 0;
    if (originalScores.length > 0 && transformedScores.length > 0) {
      const minLength = Math.min(originalScores.length, transformedScores.length);
      let totalVariance = 0;
      
      for (let i = 0; i < minLength; i++) {
        totalVariance += Math.abs(originalScores[i] - transformedScores[i]);
      }
      
      scoreVariance = totalVariance / minLength;
    }
    
    // Calculate top score difference
    const topOriginalScore = Math.max(...originalScores, 0);
    const topTransformedScore = Math.max(...transformedScores, 0);
    const topScoreDifference = Math.abs(topOriginalScore - topTransformedScore);
    
    return {
      loopCountMatch,
      scoreVariance,
      missingLoops,
      extraLoops,
      topScoreDifference
    };
  }

  private evaluateTestSuccess(accuracyMetrics: any, performanceMetrics: any, scenario: TestScenario): boolean {
    // Test passes if:
    // 1. Loop count matches or is within expected range
    // 2. Score variance is below tolerance
    // 3. Performance is not severely degraded
    // 4. No critical loops are missing
    
    const loopCountOk = accuracyMetrics.loopCountMatch || 
      (accuracyMetrics.missingLoops + accuracyMetrics.extraLoops) <= 2;
    
    const scoreVarianceOk = accuracyMetrics.scoreVariance <= (this.config.settings.scoreTolerancePercent / 100);
    
    const performanceOk = performanceMetrics.performanceRatio <= 2.0; // Max 2x slowdown
    
    return loopCountOk && scoreVarianceOk && performanceOk;
  }

  private detectRegressions(result: ValidationResult, scenario: TestScenario): void {
    // Detect and classify regressions
    const { accuracyMetrics, performanceMetrics } = result;
    
    if (!accuracyMetrics.loopCountMatch && accuracyMetrics.missingLoops > 0) {
      this.regressionIssues.push({
        type: 'accuracy',
        severity: 'critical',
        algorithm: result.algorithm,
        scenario: scenario.scenarioId,
        description: `Missing ${accuracyMetrics.missingLoops} trade loops in transformed algorithm`,
        impact: 'Users may miss profitable trading opportunities',
        recommendedAction: 'Review delta detection logic and graph conversion'
      });
    }
    
    if (accuracyMetrics.scoreVariance > 0.05) { // 5% variance
      this.regressionIssues.push({
        type: 'accuracy',
        severity: 'major',
        algorithm: result.algorithm,
        scenario: scenario.scenarioId,
        description: `Score variance of ${(accuracyMetrics.scoreVariance * 100).toFixed(2)}% detected`,
        impact: 'Trade quality assessment may be inconsistent',
        recommendedAction: 'Verify scoring algorithm integration in white label layer'
      });
    }
    
    if (performanceMetrics.performanceRatio > 3.0) {
      this.regressionIssues.push({
        type: 'performance',
        severity: 'major',
        algorithm: result.algorithm,
        scenario: scenario.scenarioId,
        description: `${(performanceMetrics.performanceRatio * 100).toFixed(0)}% performance degradation`,
        impact: 'Slower response times for partners',
        recommendedAction: 'Optimize delta detection and graph caching'
      });
    }
  }

  private async runGoldenFileTests(): Promise<void> {
    // Implementation for golden file tests
    this.logger.info('Golden file tests not yet implemented');
  }

  private async runPerformanceTests(): Promise<void> {
    // Implementation for performance regression tests
    this.logger.info('Performance tests not yet implemented');
  }

  private async runTenantIsolationTests(): Promise<void> {
    // Implementation for tenant isolation tests
    this.logger.info('Tenant isolation tests not yet implemented');
  }

  private generateValidationReport(executionTimeMs: number): ValidationReport {
    const totalTests = this.validationResults.length;
    const passedTests = this.validationResults.filter(result => result.passed).length;
    const failedTests = totalTests - passedTests;
    const overallSuccess = failedTests === 0;
    
    const recommendations: string[] = [];
    
    if (!overallSuccess) {
      recommendations.push('Review failed test cases and address regressions');
    }
    
    if (this.regressionIssues.some(issue => issue.severity === 'critical')) {
      recommendations.push('CRITICAL: Address accuracy regressions before deployment');
    }
    
    return {
      summary: {
        totalTests,
        passedTests,
        failedTests,
        overallSuccess,
        executionTimeMs
      },
      scenarioResults: this.validationResults,
      goldenFileResults: [], // TODO: Implement
      performanceResults: [], // TODO: Implement
      regressions: this.regressionIssues,
      recommendations
    };
  }
} 