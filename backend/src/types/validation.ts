/**
 * Algorithm Regression Validation Suite Types
 * 
 * Ensures zero degradation in trade discovery accuracy during white label transformation
 */

import { TradeLoop, WalletState, RejectionPreferences } from './trade';
import { AbstractNFT, AbstractWallet } from './abstract';

/**
 * Test scenario for validating algorithm behavior
 */
export interface TestScenario {
  scenarioId: string;
  description: string;
  complexity: 'simple' | 'moderate' | 'complex';
  
  // Input data
  wallets: WalletState[];
  abstractWallets: AbstractWallet[]; // For white label format
  expectedResults: {
    minLoops: number;
    maxLoops: number;
    topScoreThreshold: number;
    mustIncludeLoopIds?: string[];
  };
  
  // Algorithm-specific expectations
  algorithmExpectations: {
    johnson: AlgorithmExpectation;
    scalable: AlgorithmExpectation;
    bundle?: AlgorithmExpectation;
  };
}

export interface AlgorithmExpectation {
  expectedLoopCount: number;
  expectedTopScore: number;
  maxExecutionTimeMs: number;
  requiredParticipants?: number[];
  mustFindDirectTrades?: boolean;
}

/**
 * Validation result for comparing original vs transformed algorithms
 */
export interface ValidationResult {
  scenarioId: string;
  algorithm: string;
  passed: boolean;
  
  // Accuracy metrics
  accuracyMetrics: {
    loopCountMatch: boolean;
    scoreVariance: number;
    missingLoops: number;
    extraLoops: number;
    topScoreDifference: number;
  };
  
  // Performance metrics
  performanceMetrics: {
    originalTimeMs: number;
    transformedTimeMs: number;
    performanceRatio: number;
    memoryUsageDiff?: number;
  };
  
  // Detailed comparison
  comparison: ComparisonResult;
  
  errors?: string[];
  warnings?: string[];
}

export interface ComparisonResult {
  originalLoops: TradeLoop[];
  transformedLoops: TradeLoop[];
  
  // Detailed analysis
  analysis: {
    identicalLoops: number;
    similarLoops: number; // Same participants, different order
    onlyInOriginal: TradeLoop[];
    onlyInTransformed: TradeLoop[];
    scoreCorrelation: number;
  };
}

/**
 * Golden file test case with expected exact outputs
 */
export interface GoldenFileTest {
  name: string;
  description: string;
  filePath: string;
  
  // Input snapshot
  input: {
    wallets: WalletState[];
    nftOwnership: Map<string, string>;
    wantedNfts: Map<string, Set<string>>;
    rejectionPreferences: Map<string, RejectionPreferences>;
  };
  
  // Expected output snapshot
  expectedOutput: {
    tradeLoops: TradeLoop[];
    algorithmUsed: string;
    executionTimeMs: number;
    timestamp: string;
  };
  
  // Validation criteria
  criteria: {
    exactMatch: boolean; // Must match exactly
    allowedVariance: number; // Allowed score variance (e.g., 0.01)
    requiredLoops: string[]; // Loop IDs that must be present
    forbiddenLoops: string[]; // Loop IDs that must not be present
  };
}

/**
 * Performance baseline for regression testing
 */
export interface PerformanceBaseline {
  algorithm: string;
  scenario: string;
  
  baseline: {
    averageTimeMs: number;
    memoryUsageMB: number;
    loopsFound: number;
    averageScore: number;
    timestamp: string;
  };
  
  thresholds: {
    maxTimeMs: number;
    maxMemoryMB: number;
    minLoopsFound: number;
    minAverageScore: number;
  };
}

/**
 * Comprehensive validation suite configuration
 */
export interface ValidationSuiteConfig {
  // Test scenarios to run
  scenarios: TestScenario[];
  
  // Golden file tests
  goldenFiles: GoldenFileTest[];
  
  // Performance baselines
  baselines: PerformanceBaseline[];
  
  // Validation settings
  settings: {
    timeoutMs: number;
    maxConcurrentTests: number;
    enablePerformanceTests: boolean;
    enableGoldenFileTests: boolean;
    scoreTolerancePercent: number;
    enableDetailedLogging: boolean;
  };
}

/**
 * Overall validation report
 */
export interface ValidationReport {
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    overallSuccess: boolean;
    executionTimeMs: number;
  };
  
  // Detailed results
  scenarioResults: ValidationResult[];
  goldenFileResults: GoldenFileValidationResult[];
  performanceResults: PerformanceValidationResult[];
  
  // Critical issues
  regressions: RegressionIssue[];
  
  // Recommendations
  recommendations: string[];
}

export interface GoldenFileValidationResult {
  testName: string;
  passed: boolean;
  differences: {
    loopCountDifference: number;
    scoreDifferences: number[];
    missingLoops: string[];
    extraLoops: string[];
  };
  executionTimeMs: number;
}

export interface PerformanceValidationResult {
  algorithm: string;
  scenario: string;
  passed: boolean;
  
  metrics: {
    timeMs: number;
    memoryMB: number;
    loopsFound: number;
    averageScore: number;
  };
  
  comparison: {
    timeRatio: number; // transformed/baseline
    memoryRatio: number;
    accuracyRatio: number;
  };
}

export interface RegressionIssue {
  type: 'accuracy' | 'performance' | 'compatibility';
  severity: 'critical' | 'major' | 'minor';
  algorithm: string;
  scenario: string;
  description: string;
  impact: string;
  recommendedAction: string;
}

/**
 * Multi-tenant validation specific types
 */
export interface TenantValidationScenario {
  tenantId: string;
  scenario: TestScenario;
  isolationTest: boolean; // Verify tenant data isolation
}

export interface TenantValidationResult {
  tenantId: string;
  validationResult: ValidationResult;
  isolationPassed: boolean;
  dataLeakageDetected: boolean;
} 