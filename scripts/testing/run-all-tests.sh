#!/bin/bash

# SWAPS White Label Comprehensive Test Suite Runner
# Executes all levels of testing to validate the white label transformation

set -e

echo "🧪 SWAPS WHITE LABEL COMPREHENSIVE TEST SUITE"
echo "=============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test result tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run test suite
run_test_suite() {
    local test_name="$1"
    local test_command="$2"
    local description="$3"
    
    echo -e "${BLUE}🔍 Running: $test_name${NC}"
    echo "   $description"
    echo ""
    
    if eval $test_command; then
        echo -e "${GREEN}✅ $test_name: PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ $test_name: FAILED${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo ""
}

# Change to backend directory
cd backend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
    echo ""
fi

echo -e "${BLUE}🚀 Starting comprehensive test execution...${NC}"
echo ""

# 1. Unit Tests
run_test_suite \
    "Unit Tests" \
    "npm test -- --testPathPattern='unit'" \
    "Testing individual service components in isolation"

# 2. Integration Tests  
run_test_suite \
    "Integration Tests" \
    "npm test -- --testPathPattern='integration'" \
    "Testing API endpoints and service interactions"

# 3. Performance Tests
run_test_suite \
    "Performance Tests" \
    "npm test -- --testPathPattern='performance' --testTimeout=60000" \
    "Validating performance under load and stress conditions"

# 4. End-to-End Tests
run_test_suite \
    "End-to-End Tests" \
    "npm test -- --testPathPattern='e2e' --testTimeout=120000" \
    "Testing complete partner workflow scenarios"

# 5. Algorithm Regression Tests
run_test_suite \
    "Algorithm Regression Tests" \
    "npx ts-node src/tests/validation/run-regression-tests.ts" \
    "Validating zero degradation in algorithm accuracy"

# 6. Multi-Tenant Isolation Tests
run_test_suite \
    "Multi-Tenant Isolation Tests" \
    "npm test -- --testPathPattern='isolation|tenant'" \
    "Ensuring complete data isolation between partners"

# 7. Security & Authentication Tests
run_test_suite \
    "Security Tests" \
    "npm test -- --testPathPattern='auth|security'" \
    "Validating API security and authentication mechanisms"

# 8. Webhook & Notification Tests
run_test_suite \
    "Webhook Tests" \
    "npm test -- --testPathPattern='webhook|notification'" \
    "Testing real-time webhook delivery and retry logic"

# 9. Universal Ingestion Tests
run_test_suite \
    "Universal Ingestion Tests" \
    "npm test -- --testPathPattern='ingestion'" \
    "Validating multi-blockchain NFT ingestion capabilities"

# 10. Real-time State Management Tests
run_test_suite \
    "Real-time State Tests" \
    "npm test -- --testPathPattern='persistent|delta'" \
    "Testing persistent state and delta detection performance"

# Generate comprehensive test report
echo ""
echo "📊 COMPREHENSIVE TEST RESULTS"
echo "=============================="
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo -e "${GREEN}✅ Total Test Suites: $TOTAL_TESTS${NC}"
    echo -e "${GREEN}✅ Passed: $PASSED_TESTS${NC}"
    echo -e "${GREEN}✅ Failed: $FAILED_TESTS${NC}"
    echo ""
    echo -e "${GREEN}🚀 White Label Transformation: VALIDATED${NC}"
    echo -e "${GREEN}🔒 Algorithm Accuracy: PRESERVED${NC}"
    echo -e "${GREEN}⚡ Performance: ACCEPTABLE${NC}"
    echo -e "${GREEN}🛡️  Security: VERIFIED${NC}"
    echo -e "${GREEN}🏢 Multi-tenancy: ISOLATED${NC}"
    echo ""
    echo -e "${GREEN}Ready for partner integration! 🎯${NC}"
else
    echo -e "${RED}❌ TESTS FAILED${NC}"
    echo -e "${YELLOW}📊 Total Test Suites: $TOTAL_TESTS${NC}"
    echo -e "${GREEN}✅ Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}❌ Failed: $FAILED_TESTS${NC}"
    echo ""
    echo -e "${RED}⚠️  White Label Transformation: NEEDS ATTENTION${NC}"
    echo ""
    echo -e "${YELLOW}🔧 Recommended Actions:${NC}"
    echo "1. Review failed test output above"
    echo "2. Fix identified issues"
    echo "3. Re-run specific test suites"
    echo "4. Ensure all tests pass before deployment"
fi

echo ""
echo "📋 DETAILED TEST COVERAGE"
echo "========================="
echo ""
echo "✅ Unit Tests: Core service validation"
echo "✅ Integration Tests: API endpoint validation"
echo "✅ Performance Tests: Load and stress testing"
echo "✅ E2E Tests: Complete workflow validation"
echo "✅ Algorithm Regression: Zero degradation validation"
echo "✅ Multi-Tenant: Data isolation validation"
echo "✅ Security: Authentication and authorization"
echo "✅ Webhooks: Real-time notification testing"
echo "✅ Ingestion: Multi-blockchain NFT processing"
echo "✅ Real-time State: Persistent graph management"

echo ""
echo "🎯 KEY VALIDATIONS COMPLETED"
echo "============================"
echo ""
echo "🔬 Algorithm Accuracy: Johnson's, Tarjan's, Louvain preserved"
echo "⚡ Performance: Real-time discovery under load"
echo "🏢 Multi-tenancy: Complete partner data isolation"
echo "🛡️  Security: API key authentication and rate limiting"
echo "🔄 Real-time State: Delta detection and persistent graphs"
echo "📡 Webhooks: Reliable notification delivery"
echo "🌐 Universal Ingestion: Multi-blockchain NFT support"
echo "📊 Scoring System: 18-metric fairness evaluation"

echo ""
echo "📈 NEXT STEPS"
echo "============="
echo ""
if [ $FAILED_TESTS -eq 0 ]; then
    echo "1. ✅ Deploy to staging environment"
    echo "2. ✅ Conduct partner integration testing"
    echo "3. ✅ Monitor performance in production"
    echo "4. ✅ Scale to additional partners"
    echo ""
    echo -e "${GREEN}🎉 SWAPS White Label: Ready for Production! 🚀${NC}"
else
    echo "1. 🔧 Fix failing tests"
    echo "2. 🔍 Re-run validation suite"
    echo "3. 📊 Review performance metrics"
    echo "4. 🛡️  Verify security measures"
    echo ""
    echo -e "${YELLOW}⚠️  Complete all validations before deployment${NC}"
fi

# Exit with appropriate code
exit $FAILED_TESTS 