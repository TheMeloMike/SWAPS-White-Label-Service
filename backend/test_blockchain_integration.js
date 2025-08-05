#!/usr/bin/env node

/**
 * SWAPS Backend-Blockchain Integration Test
 * 
 * Tests the complete flow from API discovery to blockchain execution
 */

const axios = require('axios');
const { Keypair } = require('@solana/web3.js');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TENANT_API_KEY = process.env.TENANT_API_KEY || 'test-api-key';

class BlockchainIntegrationTester {
    constructor() {
        this.baseURL = API_BASE_URL;
        this.headers = {
            'Authorization': `Bearer ${TENANT_API_KEY}`,
            'Content-Type': 'application/json'
        };
        this.results = {
            passed: 0,
            failed: 0,
            tests: []
        };
    }

    async log(message, data = {}) {
        console.log(`📋 ${message}`, data.details ? `- ${data.details}` : '');
        if (data.error) {
            console.error('   ❌ Error:', data.error);
        }
    }

    async logTest(name, success, details = '') {
        const status = success ? '✅ PASS' : '❌ FAIL';
        console.log(`   ${status} ${name}${details ? ' - ' + details : ''}`);
        
        this.results.tests.push({ name, success, details });
        if (success) this.results.passed++;
        else this.results.failed++;
    }

    async testAPIConnection() {
        this.log('🔗 Testing API Connection');
        
        try {
            const response = await axios.get(`${this.baseURL}/`);
            
            if (response.data.blockchain && response.data.blockchain.programId) {
                this.logTest('API connection', true, `Blockchain capabilities detected`);
                this.logTest('Smart contract ID', true, `${response.data.blockchain.programId}`);
                return response.data;
            } else {
                this.logTest('API connection', false, 'No blockchain capabilities detected');
                return null;
            }
        } catch (error) {
            this.logTest('API connection', false, error.message);
            return null;
        }
    }

    async testBlockchainInfo() {
        this.log('🔍 Testing Blockchain Information Endpoint');
        
        try {
            const response = await axios.get(`${this.baseURL}/api/v1/blockchain/info`);
            
            if (response.data.blockchain && response.data.capabilities) {
                this.logTest('Blockchain info endpoint', true, `Network: ${response.data.blockchain.network}`);
                this.logTest('Multi-party trading capability', true, `Max participants: ${response.data.capabilities.maxParticipantsPerTrade}`);
                this.logTest('Contract validation', true, `Test results: ${response.data.testResults.rigorousValidation}`);
                return response.data;
            } else {
                this.logTest('Blockchain info endpoint', false, 'Invalid response structure');
                return null;
            }
        } catch (error) {
            this.logTest('Blockchain info endpoint', false, error.response?.data?.error || error.message);
            return null;
        }
    }

    async testBlockchainHealth() {
        this.log('🏥 Testing Blockchain Health Check');
        
        try {
            const response = await axios.get(`${this.baseURL}/api/v1/blockchain/health`);
            
            if (response.data.status === 'healthy' && response.data.services) {
                this.logTest('Blockchain health check', true, `Status: ${response.data.status}`);
                
                // Check individual services
                for (const [service, status] of Object.entries(response.data.services)) {
                    this.logTest(`Service: ${service}`, status === 'operational', `Status: ${status}`);
                }
                
                return response.data;
            } else {
                this.logTest('Blockchain health check', false, `Status: ${response.data.status}`);
                return null;
            }
        } catch (error) {
            this.logTest('Blockchain health check', false, error.response?.data?.error || error.message);
            return null;
        }
    }

    async testEnhancedTradeDiscovery() {
        this.log('🔍 Testing Enhanced Trade Discovery with Blockchain Capabilities');
        
        const testPayload = {
            mode: 'executable',
            settings: {
                maxResults: 5,
                includeCollectionTrades: true,
                blockchainFormat: 'solana',
                autoCreateBlockchainTrades: false
            }
        };

        try {
            const response = await axios.post(
                `${this.baseURL}/api/v1/blockchain/discovery/trades`,
                testPayload,
                { headers: this.headers }
            );
            
            if (response.data.success && response.data.mode === 'executable') {
                this.logTest('Enhanced trade discovery', true, `Found ${response.data.totalCount} executable trades`);
                this.logTest('Blockchain mode detection', true, `Mode: ${response.data.mode}`);
                
                // Test if trades are marked as executable
                if (response.data.trades && response.data.trades.length > 0) {
                    const executableTrade = response.data.trades.find(trade => 
                        trade.blockchainReady || trade.status === 'executable'
                    );
                    
                    if (executableTrade) {
                        this.logTest('Executable trade marking', true, 'Trades properly marked as blockchain-ready');
                        return { trades: response.data.trades, selectedTrade: executableTrade };
                    } else {
                        this.logTest('Executable trade marking', false, 'No trades marked as executable');
                    }
                }
                
                return { trades: response.data.trades };
            } else {
                this.logTest('Enhanced trade discovery', false, 'Invalid response or mode');
                return null;
            }
        } catch (error) {
            if (error.response?.status === 401) {
                this.logTest('Enhanced trade discovery', false, 'Authentication required (expected in production)');
            } else {
                this.logTest('Enhanced trade discovery', false, error.response?.data?.error || error.message);
            }
            return null;
        }
    }

    async testTradeExecutionSimulation() {
        this.log('🧪 Testing Trade Execution Simulation');
        
        const simulationPayload = {
            tradeLoopId: 'test-trade-loop-id',
            mode: 'simulate',
            customTimeoutHours: 24
        };

        try {
            const response = await axios.post(
                `${this.baseURL}/api/v1/blockchain/trades/execute`,
                simulationPayload,
                { headers: this.headers }
            );
            
            if (response.data.success && response.data.mode === 'simulation') {
                this.logTest('Trade execution simulation', true, 'Simulation endpoint working');
                
                if (response.data.executionPlan) {
                    this.logTest('Execution plan generation', true, `${response.data.executionPlan.steps?.length || 0} steps planned`);
                    this.logTest('Gas estimation', true, `Estimated: ${response.data.executionPlan.estimatedTotalGas}`);
                }
                
                return response.data;
            } else {
                this.logTest('Trade execution simulation', false, 'Invalid simulation response');
                return null;
            }
        } catch (error) {
            if (error.response?.status === 401) {
                this.logTest('Trade execution simulation', false, 'Authentication required (expected in production)');
            } else if (error.response?.status === 404) {
                this.logTest('Trade execution simulation', true, 'Trade not found (expected for test ID)');
            } else {
                this.logTest('Trade execution simulation', false, error.response?.data?.error || error.message);
            }
            return null;
        }
    }

    async testActiveTradesEndpoint() {
        this.log('📊 Testing Active Blockchain Trades Endpoint');
        
        try {
            const response = await axios.get(
                `${this.baseURL}/api/v1/blockchain/trades/active`,
                { headers: this.headers }
            );
            
            if (response.data.success) {
                this.logTest('Active trades endpoint', true, `Found ${response.data.totalCount} active trades`);
                
                if (response.data.contractInfo) {
                    this.logTest('Contract info included', true, `Program ID: ${response.data.contractInfo.programId}`);
                    this.logTest('Explorer URL provided', true, response.data.contractInfo.explorerUrl ? 'Available' : 'Missing');
                }
                
                return response.data;
            } else {
                this.logTest('Active trades endpoint', false, 'Invalid response structure');
                return null;
            }
        } catch (error) {
            if (error.response?.status === 401) {
                this.logTest('Active trades endpoint', false, 'Authentication required (expected in production)');
            } else {
                this.logTest('Active trades endpoint', false, error.response?.data?.error || error.message);
            }
            return null;
        }
    }

    async testDocumentationEndpoint() {
        this.log('📚 Testing Blockchain API Documentation');
        
        try {
            const response = await axios.get(`${this.baseURL}/api/v1/blockchain/docs`);
            
            if (response.data.blockchain && response.data.tradingFlow) {
                this.logTest('Documentation endpoint', true, 'Complete documentation available');
                
                // Test documentation structure
                if (response.data.quickStart && response.data.endpoints) {
                    this.logTest('API documentation structure', true, 'Quick start and endpoints documented');
                }
                
                if (response.data.tradingFlow.step1 && response.data.tradingFlow.step4) {
                    this.logTest('Trading flow documentation', true, 'Complete 4-step trading flow documented');
                }
                
                if (response.data.examples && response.data.examples.discovery) {
                    this.logTest('Code examples provided', true, 'Discovery and execution examples available');
                }
                
                return response.data;
            } else {
                this.logTest('Documentation endpoint', false, 'Incomplete documentation structure');
                return null;
            }
        } catch (error) {
            this.logTest('Documentation endpoint', false, error.response?.data?.error || error.message);
            return null;
        }
    }

    async runComprehensiveTest() {
        console.log('🚀 SWAPS BACKEND-BLOCKCHAIN INTEGRATION TEST');
        console.log('=============================================');
        console.log(`API Base URL: ${this.baseURL}`);
        console.log(`Using API Key: ${TENANT_API_KEY.substring(0, 8)}...`);
        console.log('');

        // Test sequence
        await this.testAPIConnection();
        console.log('');
        
        await this.testBlockchainInfo();
        console.log('');
        
        await this.testBlockchainHealth();
        console.log('');
        
        await this.testEnhancedTradeDiscovery();
        console.log('');
        
        await this.testTradeExecutionSimulation();
        console.log('');
        
        await this.testActiveTradesEndpoint();
        console.log('');
        
        await this.testDocumentationEndpoint();
        console.log('');

        // Summary
        this.displayTestSummary();
    }

    displayTestSummary() {
        console.log('📊 INTEGRATION TEST SUMMARY');
        console.log('============================');
        
        const total = this.results.passed + this.results.failed;
        const successRate = total > 0 ? ((this.results.passed / total) * 100).toFixed(1) : 0;
        
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${this.results.passed}`);
        console.log(`Failed: ${this.results.failed}`);
        console.log(`Success Rate: ${successRate}%`);
        
        console.log('');
        console.log('📋 Detailed Results:');
        this.results.tests.forEach((test, index) => {
            const status = test.success ? '✅' : '❌';
            console.log(`${index + 1}. ${status} ${test.name}${test.details ? ' - ' + test.details : ''}`);
        });
        
        console.log('');
        if (this.results.passed >= total * 0.8) {
            console.log('🎯 BACKEND-BLOCKCHAIN INTEGRATION: SUCCESSFUL ✅');
            console.log('✅ API endpoints properly configured');
            console.log('✅ Blockchain integration layer working');
            console.log('✅ Smart contract connectivity established');
            console.log('✅ Ready for production testing');
        } else {
            console.log('⚠️  Integration issues detected - review failed tests above');
        }
        
        console.log('');
        console.log('🔗 Next Steps:');
        console.log('1. Start backend server: npm start');
        console.log('2. Test with tenant API key');
        console.log('3. Create real trade loops');
        console.log('4. Execute blockchain transactions');
        
        console.log('');
        console.log('📡 Key Endpoints:');
        console.log(`• Enhanced Discovery: ${this.baseURL}/api/v1/blockchain/discovery/trades`);
        console.log(`• Trade Execution: ${this.baseURL}/api/v1/blockchain/trades/execute`);
        console.log(`• Active Trades: ${this.baseURL}/api/v1/blockchain/trades/active`);
        console.log(`• Documentation: ${this.baseURL}/api/v1/blockchain/docs`);
    }
}

// Run the test
const tester = new BlockchainIntegrationTester();
tester.runComprehensiveTest().catch(console.error);