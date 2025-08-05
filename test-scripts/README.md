# SWAPS Test Scripts Organization

This directory contains all test scripts for the SWAPS White Label API, organized by category for easy maintenance and execution.

## Directory Structure

### 📊 **algorithm-tests/** (20 files)
Core algorithm testing and verification scripts:
- Algorithm regression testing
- Multi-party trade loop verification (3-way, 4-way, 5-way, 6-way)
- Mathematical optimization validation
- Persistent graph functionality testing
- Legacy vs canonical algorithm comparison
- Trade scoring optimization tests

**Key Scripts:**
- `proper-persistent-graph-test.js` - Tests event-driven graph behavior
- `verify-multi-party-trade-loops.js` - Tests complex trade scenarios
- `test-6way-clean.js` - Isolated 6-way trade loop testing
- `mathematical-algorithm-optimizations.js` - Core math optimizations

### 🔍 **audit-tests/** (6 files)
System auditing and production readiness validation:
- MVP readiness assessment
- Production capability testing
- System audit recreation
- Memory optimization validation

**Key Scripts:**
- `ACCURATE_MVP_READINESS_TEST.js` - Comprehensive system readiness check
- `comprehensive-production-readiness-test.js` - Full production validation
- `audit-recreation-test.js` - Recreates audit conditions

### ⚡ **performance-tests/** (10 files)
Performance benchmarking and scalability testing:
- Load testing and concurrent request handling
- Performance bottleneck analysis
- Scaling characteristics measurement
- Speed optimization validation

**Key Scripts:**
- `performance-benchmark-test.js` - Core performance metrics
- `isolated-20-concurrent-test.js` - Concurrent request testing
- `scaling-analysis.js` - System scaling behavior analysis

### 🚀 **optimization-tests/** (6 files)
Algorithm and system optimization implementation:
- Mathematical optimization testing
- Enterprise algorithm orchestration
- Performance optimization implementation
- Testing framework improvements

**Key Scripts:**
- `PERFORMANCE_OPTIMIZATION_IMPLEMENTATION.js` - Main optimization suite
- `enterprise-algorithm-orchestrator.js` - Enterprise-level orchestration
- `comprehensive-mathematical-optimization-test.js` - Math optimization validation

### 📡 **kafka-tests/** (6 files)
Kafka integration and distributed processing tests:
- Kafka connection validation
- Configuration testing
- Fallback mechanism testing
- Live integration testing

**Key Scripts:**
- `kafka-integration-test.js` - Main Kafka integration testing
- `test-kafka-live-api.js` - Live API with Kafka testing

### 📤 **uploader-tests/** (5 files)
Data upload and large-scale data generation:
- Mass data upload testing
- Scale generation for testing
- Uploader functionality validation

**Key Scripts:**
- `massive-scale-generator.js` - Large dataset generation
- `live-250-wallet-test.js` - Large-scale wallet testing

### 👥 **ux-tests/** (5 files)
User experience and client-facing functionality:
- Client API validation
- UX flow testing
- Rate limiting validation
- Endpoint verification

**Key Scripts:**
- `client-ux-validation-suite.js` - Complete UX validation
- `streamlined-ux-test.js` - Streamlined user experience testing

## Usage Guidelines

### Running Individual Tests
```bash
cd test-scripts/[category]/
node [test-script-name].js
```

### Running Category Tests
```bash
# Run all algorithm tests
for script in test-scripts/algorithm-tests/*.js; do node "$script"; done

# Run all performance tests
for script in test-scripts/performance-tests/*.js; do node "$script"; done
```

### Test Dependencies
Most tests require:
- `ADMIN_API_KEY` environment variable set
- Live API endpoint (https://swaps-93hu.onrender.com)
- Node.js with required packages

### Test Categories by Purpose

**Development & Debugging:**
- `algorithm-tests/` - Core functionality verification
- `optimization-tests/` - Performance improvements

**Quality Assurance:**
- `audit-tests/` - System validation
- `performance-tests/` - Load and performance testing
- `ux-tests/` - Client experience validation

**Infrastructure:**
- `kafka-tests/` - Distributed processing
- `uploader-tests/` - Data management

## Historical Context

These test scripts were developed during the SWAPS optimization and enterprise readiness phase (July-August 2025) to validate:

1. **Algorithm Sophistication**: Moving from 33% to 100% algorithm utilization
2. **Performance Optimization**: Achieving <5ms security overhead
3. **Enterprise Readiness**: 100% security score and audit compliance
4. **Multi-party Trading**: Complex trade loop discovery and execution
5. **Production Stability**: Real-world load testing and validation

## Maintenance Notes

- Scripts are organized by functionality for easier maintenance
- Each category focuses on specific aspects of the system
- Test scripts include both unit-level and integration-level testing
- Many scripts can be run independently for targeted testing
- Some scripts require specific system states or data conditions

**Total Scripts Organized**: 58 files across 7 categories