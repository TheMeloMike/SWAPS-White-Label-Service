#!/usr/bin/env ts-node

import * as path from 'path';
import { performance } from 'perf_hooks';
import { AlgorithmRegressionTestSuite } from '../../services/validation/AlgorithmRegressionTestSuite';
import { LoggingService } from '../../utils/logging/LoggingService';
import { ValidationReport } from '../../types/validation';

/**
 * Algorithm Regression Test Runner
 * 
 * Validates that the white label transformation maintains 100% algorithm accuracy
 * compared to the original SWAPS implementation.
 */
async function runRegressionTests(): Promise<void> {
  console.log('🧪 SWAPS Algorithm Regression Test Suite');
  console.log('=========================================');
  console.log('Validating white label transformation accuracy...\n');
  
  const logger = LoggingService.getInstance().createLogger('RegressionTestRunner');
  const testSuite = AlgorithmRegressionTestSuite.getInstance();
  
  try {
    // Load test configuration
    const configPath = path.join(__dirname, 'test-scenarios.json');
    console.log('📋 Loading test scenarios...');
    await testSuite.loadConfiguration(configPath);
    console.log('✅ Test scenarios loaded successfully\n');
    
    // Run comprehensive validation
    console.log('🚀 Starting algorithm regression validation...');
    const startTime = performance.now();
    
    const report: ValidationReport = await testSuite.runValidationSuite();
    
    const totalTime = performance.now() - startTime;
    
    // Display results
    console.log('\n📊 VALIDATION RESULTS');
    console.log('=====================');
    
    displaySummary(report);
    displayScenarioResults(report);
    displayRegressions(report);
    displayRecommendations(report);
    
    console.log(`\n⏱️  Total execution time: ${totalTime.toFixed(2)}ms`);
    
    // Exit with appropriate code
    if (report.summary.overallSuccess) {
      console.log('\n🎉 ALL TESTS PASSED - White label transformation maintains algorithm accuracy!');
      process.exit(0);
    } else {
      console.log('\n❌ TESTS FAILED - Regressions detected in white label transformation!');
      process.exit(1);
    }
    
  } catch (error) {
    logger.error('Regression test suite failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    console.error('\n💥 Test suite execution failed:');
    console.error(error);
    process.exit(1);
  }
}

function displaySummary(report: ValidationReport): void {
  const { summary } = report;
  
  console.log(`Total Tests: ${summary.totalTests}`);
  console.log(`Passed: ${summary.passedTests} ✅`);
  console.log(`Failed: ${summary.failedTests} ${summary.failedTests > 0 ? '❌' : ''}`);
  console.log(`Success Rate: ${((summary.passedTests / summary.totalTests) * 100).toFixed(1)}%`);
  console.log(`Overall Status: ${summary.overallSuccess ? '✅ PASS' : '❌ FAIL'}`);
}

function displayScenarioResults(report: ValidationReport): void {
  console.log('\n📝 SCENARIO RESULTS');
  console.log('==================');
  
  for (const result of report.scenarioResults) {
    const status = result.passed ? '✅' : '❌';
    const performanceRatio = result.performanceMetrics.performanceRatio.toFixed(2);
    const scoreVariance = (result.accuracyMetrics.scoreVariance * 100).toFixed(2);
    
    console.log(`\n${status} ${result.scenarioId} (${result.algorithm})`);
    console.log(`   Accuracy: Loop count match: ${result.accuracyMetrics.loopCountMatch ? '✅' : '❌'}`);
    console.log(`   Performance: ${performanceRatio}x slowdown`);
    console.log(`   Score variance: ${scoreVariance}%`);
    
    if (result.accuracyMetrics.missingLoops > 0) {
      console.log(`   ⚠️  Missing ${result.accuracyMetrics.missingLoops} loops`);
    }
    
    if (result.accuracyMetrics.extraLoops > 0) {
      console.log(`   ⚠️  Found ${result.accuracyMetrics.extraLoops} extra loops`);
    }
    
    if (result.errors && result.errors.length > 0) {
      console.log(`   ❌ Errors: ${result.errors.join(', ')}`);
    }
  }
}

function displayRegressions(report: ValidationReport): void {
  if (report.regressions.length === 0) {
    console.log('\n✅ No regressions detected!');
    return;
  }
  
  console.log('\n🚨 REGRESSIONS DETECTED');
  console.log('======================');
  
  const criticalIssues = report.regressions.filter(r => r.severity === 'critical');
  const majorIssues = report.regressions.filter(r => r.severity === 'major');
  const minorIssues = report.regressions.filter(r => r.severity === 'minor');
  
  if (criticalIssues.length > 0) {
    console.log(`\n🔴 CRITICAL ISSUES (${criticalIssues.length}):`);
    for (const issue of criticalIssues) {
      console.log(`   • ${issue.description}`);
      console.log(`     Impact: ${issue.impact}`);
      console.log(`     Action: ${issue.recommendedAction}`);
    }
  }
  
  if (majorIssues.length > 0) {
    console.log(`\n🟡 MAJOR ISSUES (${majorIssues.length}):`);
    for (const issue of majorIssues) {
      console.log(`   • ${issue.description}`);
      console.log(`     Impact: ${issue.impact}`);
    }
  }
  
  if (minorIssues.length > 0) {
    console.log(`\n🟢 MINOR ISSUES (${minorIssues.length}):`);
    for (const issue of minorIssues) {
      console.log(`   • ${issue.description}`);
    }
  }
}

function displayRecommendations(report: ValidationReport): void {
  if (report.recommendations.length === 0) {
    return;
  }
  
  console.log('\n💡 RECOMMENDATIONS');
  console.log('==================');
  
  for (const recommendation of report.recommendations) {
    console.log(`• ${recommendation}`);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the tests
if (require.main === module) {
  runRegressionTests().catch(error => {
    console.error('Failed to run regression tests:', error);
    process.exit(1);
  });
} 