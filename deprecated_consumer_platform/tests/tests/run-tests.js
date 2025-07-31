#!/usr/bin/env node

/**
 * Simple test runner for our NFT service tests
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configure test patterns
const TEST_PATTERNS = [
  'nftValidation.test.ts',
  'NFTController.test.ts',
];

// Options for test execution
const TEST_OPTIONS = [
  '--no-cache',          // Don't use the Jest cache
  '--verbose',           // Display individual test results
  '--forceExit',         // Force Jest to exit after all tests complete
  '--detectOpenHandles', // Detect hanging handles (useful for async issues)
];

// Check if a specific test was requested via CLI args
const requestedTest = process.argv[2];
if (requestedTest) {
  // Run only the requested test
  console.log(`Running requested test: ${requestedTest}`);
  TEST_PATTERNS.length = 0;
  TEST_PATTERNS.push(requestedTest);
}

// Get the path to the tests directory
const testsDir = __dirname;

// Filter test patterns to only include files that exist
const existingTests = TEST_PATTERNS.filter(pattern => {
  const testPath = path.join(testsDir, pattern);
  return fs.existsSync(testPath);
});

if (existingTests.length === 0) {
  console.error('No matching test files found!');
  process.exit(1);
}

// Log which tests we're going to run
console.log('Running tests:');
existingTests.forEach(test => console.log(`- ${test}`));

try {
  // Build the Jest command
  const jestCommand = [
    'npx jest',
    ...existingTests.map(pattern => `"${pattern}"`),
    ...TEST_OPTIONS
  ].join(' ');
  
  // Execute the tests
  console.log(`\nExecuting: ${jestCommand}\n`);
  execSync(jestCommand, { 
    stdio: 'inherit',
    cwd: testsDir
  });
  
  console.log('\n✅ All tests completed successfully!\n');
} catch (error) {
  console.error('\n❌ Tests failed with error:', error.message);
  process.exit(1);
} 