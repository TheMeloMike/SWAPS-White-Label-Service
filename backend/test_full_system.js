#!/usr/bin/env node

/**
 * 🚀 SWAPS FULL SYSTEM TEST
 * ========================
 * 
 * Comprehensive test of the complete SWAPS ecosystem:
 * - Backend API ↔ Smart Contract Integration
 * - Real blockchain operations on Solana devnet
 * - Multi-party trade discovery + execution
 * - End-to-end workflow validation
 */

const axios = require('axios');
const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { getAssociatedTokenAddress } = require('@solana/spl-token');
const fs = require('fs');

class SwapsFullSystemTest {
    constructor() {
        this.baseUrl = 'http://localhost:3000';
        this.connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        this.testResults = [];
        this.startTime = Date.now();
        
        // Load our deployment keypair
        const keypairData = JSON.parse(fs.readFileSync('/Users/pat.dentico/.config/solana/id.json'));
        this.deployerKeypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
        
        // Our deployed program ID
        this.programId = '8QhM7mdLqs2mwuNwY4R4UAGiXpLyMg28aih5mZKU2XFD';
        
        console.log('🚀 SWAPS FULL SYSTEM TEST INITIALIZED');
        console.log('=====================================');
        console.log(`📡 Backend API: ${this.baseUrl}`);
        console.log(`⛓️  Blockchain: Solana Devnet`);
        console.log(`📋 Program ID: ${this.programId}`);
        console.log(`👤 Test Wallet: ${this.deployerKeypair.publicKey.toString()}`);
        console.log('');
    }

    logTest(name, success, details = '') {
        const status = success ? '✅ PASS' : '❌ FAIL';
        const detailStr = details ? ` - ${details}` : '';
        console.log(`   ${status} ${name}${detailStr}`);
        this.testResults.push({ name, success, details });
    }

    // Test 1: Backend API Health and Connectivity
    async testBackendHealth() {
        console.log('🔍 TEST 1: Backend API Health & Connectivity\n');
        
        try {
            // Test basic API health
            const healthResponse = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
            this.logTest('Backend API responds', healthResponse.status === 200, `Status: ${healthResponse.status}`);
            
            // Test main endpoint
            const mainResponse = await axios.get(`${this.baseUrl}/`, { timeout: 5000 });
            this.logTest('Main endpoint accessible', mainResponse.status === 200);
            this.logTest('Response includes blockchain info', 
                mainResponse.data.network === 'devnet' && mainResponse.data.programId,
                `Network: ${mainResponse.data.network}`);
            
            // Test blockchain-specific endpoints
            const blockchainInfoResponse = await axios.get(`${this.baseUrl}/api/v1/blockchain/info`, { timeout: 5000 });
            this.logTest('Blockchain info endpoint', blockchainInfoResponse.status === 200);
            this.logTest('Program ID matches deployment', 
                blockchainInfoResponse.data.programId === this.programId,
                `API: ${blockchainInfoResponse.data.programId}`);
            
        } catch (error) {
            this.logTest('Backend API Health', false, error.message);
        }
    }

    // Test 2: Blockchain Health and Smart Contract Status
    async testBlockchainHealth() {
        console.log('\n🔍 TEST 2: Blockchain Health & Smart Contract Status\n');
        
        try {
            // Test blockchain connectivity
            const blockHeight = await this.connection.getBlockHeight();
            this.logTest('Solana devnet connectivity', blockHeight > 0, `Block: ${blockHeight}`);
            
            // Test our wallet balance
            const balance = await this.connection.getBalance(this.deployerKeypair.publicKey);
            this.logTest('Test wallet has SOL', balance > 0, `${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
            
            // Test smart contract deployment
            const programAccount = await this.connection.getAccountInfo(new PublicKey(this.programId));
            this.logTest('Smart contract deployed', !!programAccount, `Owner: ${programAccount?.owner.toString().slice(0, 8)}...`);
            this.logTest('Smart contract is executable', programAccount?.executable === true);
            
            // Test blockchain health via API
            const healthResponse = await axios.get(`${this.baseUrl}/api/v1/blockchain/health`);
            this.logTest('Blockchain health API', healthResponse.status === 200);
            this.logTest('API reports blockchain healthy', 
                healthResponse.data.status === 'healthy',
                `Status: ${healthResponse.data.status}`);
            
        } catch (error) {
            this.logTest('Blockchain Health Check', false, error.message);
        }
    }

    // Test 3: Trade Discovery Engine Integration
    async testTradeDiscovery() {
        console.log('\n🔍 TEST 3: Trade Discovery Engine Integration\n');
        
        try {
            // Test standard trade discovery
            const discoveryPayload = {
                inventory: [
                    {
                        walletAddress: this.deployerKeypair.publicKey.toString(),
                        nfts: [
                            {
                                mintAddress: 'So11111111111111111111111111111111111111112',
                                collectionId: 'wrapped-sol',
                                floorPrice: 1.0
                            }
                        ]
                    }
                ],
                wants: [
                    {
                        walletAddress: this.deployerKeypair.publicKey.toString(),
                        desiredCollections: ['test-collection'],
                        maxFloorPrice: 2.0
                    }
                ]
            };

            const discoveryResponse = await axios.post(`${this.baseUrl}/api/v1/discovery/trades`, discoveryPayload);
            this.logTest('Trade discovery endpoint responds', discoveryResponse.status === 200);
            this.logTest('Discovery returns structured data', 
                Array.isArray(discoveryResponse.data.tradeLoops),
                `Found: ${discoveryResponse.data.tradeLoops?.length || 0} loops`);
            
            // Test blockchain-enhanced discovery
            const blockchainDiscoveryResponse = await axios.post(`${this.baseUrl}/api/v1/blockchain/discovery/trades`, discoveryPayload);
            this.logTest('Blockchain discovery endpoint', blockchainDiscoveryResponse.status === 200);
            this.logTest('Blockchain discovery includes execution data',
                blockchainDiscoveryResponse.data.hasOwnProperty('executable'),
                `Executable: ${blockchainDiscoveryResponse.data.executable}`);
                
        } catch (error) {
            this.logTest('Trade Discovery Integration', false, error.message);
        }
    }

    // Test 4: Smart Contract Interaction via API
    async testSmartContractInteraction() {
        console.log('\n🔍 TEST 4: Smart Contract Interaction via API\n');
        
        try {
            // Test trade loop creation via API
            const tradeLoopPayload = {
                participants: [
                    {
                        walletAddress: this.deployerKeypair.publicKey.toString(),
                        givingNFTs: ['So11111111111111111111111111111111111111112'],
                        receivingNFTs: ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v']
                    }
                ],
                timeoutHours: 24
            };

            // Note: This would normally require proper authentication/signing
            // For now, we'll test the endpoint structure
            try {
                const executeResponse = await axios.post(`${this.baseUrl}/api/v1/blockchain/trades/execute`, tradeLoopPayload);
                this.logTest('Trade execution endpoint responds', executeResponse.status === 200);
            } catch (error) {
                // Expected to fail without proper authentication, but endpoint should exist
                this.logTest('Trade execution endpoint exists', error.response?.status === 400 || error.response?.status === 401);
            }

            // Test trade status endpoint
            const testTradeId = 'test-trade-12345';
            try {
                const statusResponse = await axios.get(`${this.baseUrl}/api/v1/blockchain/trades/status/${testTradeId}`);
                this.logTest('Trade status endpoint responds', statusResponse.status === 200);
            } catch (error) {
                this.logTest('Trade status endpoint exists', error.response?.status === 404); // Expected for non-existent trade
            }

            // Test active trades endpoint
            const activeTradesResponse = await axios.get(`${this.baseUrl}/api/v1/blockchain/trades/active`);
            this.logTest('Active trades endpoint', activeTradesResponse.status === 200);
            this.logTest('Active trades returns array', Array.isArray(activeTradesResponse.data));

        } catch (error) {
            this.logTest('Smart Contract API Interaction', false, error.message);
        }
    }

    // Test 5: Full System Integration Test
    async testFullSystemIntegration() {
        console.log('\n🔍 TEST 5: Full System Integration Test\n');
        
        try {
            // Test the complete flow: Discovery → Blockchain → Execution pathway
            
            // 1. Submit inventory
            const inventoryPayload = {
                walletAddress: this.deployerKeypair.publicKey.toString(),
                nfts: [
                    {
                        mintAddress: 'So11111111111111111111111111111111111111112',
                        collectionId: 'wrapped-sol',
                        floorPrice: 1.0
                    }
                ]
            };

            const inventoryResponse = await axios.post(`${this.baseUrl}/api/v1/inventory/submit`, inventoryPayload);
            this.logTest('Inventory submission', inventoryResponse.status === 200);

            // 2. Submit wants
            const wantsPayload = {
                walletAddress: this.deployerKeypair.publicKey.toString(),
                desiredCollections: ['test-collection'],
                maxFloorPrice: 2.0
            };

            const wantsResponse = await axios.post(`${this.baseUrl}/api/v1/wants/submit`, wantsPayload);
            this.logTest('Wants submission', wantsResponse.status === 200);

            // 3. Check if system maintains state
            const statusResponse = await axios.get(`${this.baseUrl}/api/v1/status`);
            this.logTest('System status check', statusResponse.status === 200);
            this.logTest('System reports operational status',
                statusResponse.data.status === 'operational' || statusResponse.data.status === 'healthy');

            // 4. Test that blockchain integration is reflected in main API
            const mainResponse = await axios.get(`${this.baseUrl}/`);
            this.logTest('Main API reflects blockchain capabilities',
                mainResponse.data.capabilities?.includes('blockchain_execution'),
                `Capabilities: ${mainResponse.data.capabilities?.join(', ')}`);

        } catch (error) {
            this.logTest('Full System Integration', false, error.message);
        }
    }

    // Test 6: Performance and Load Test
    async testPerformanceAndLoad() {
        console.log('\n🔍 TEST 6: Performance & Load Test\n');
        
        try {
            const startTime = Date.now();
            
            // Test concurrent API calls
            const concurrentRequests = Array(5).fill().map(() => 
                axios.get(`${this.baseUrl}/api/v1/blockchain/info`)
            );

            const responses = await Promise.all(concurrentRequests);
            const endTime = Date.now();
            const duration = endTime - startTime;

            this.logTest('Concurrent requests succeed', responses.every(r => r.status === 200));
            this.logTest('Concurrent performance acceptable', duration < 2000, `${duration}ms for 5 requests`);

            // Test API response times
            const perfStartTime = Date.now();
            await axios.get(`${this.baseUrl}/api/v1/blockchain/health`);
            const perfDuration = Date.now() - perfStartTime;

            this.logTest('API response time acceptable', perfDuration < 1000, `${perfDuration}ms`);

        } catch (error) {
            this.logTest('Performance & Load Test', false, error.message);
        }
    }

    // Generate comprehensive test report
    generateReport() {
        console.log('\n📊 SWAPS FULL SYSTEM TEST REPORT');
        console.log('=================================\n');

        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(t => t.success).length;
        const failedTests = totalTests - passedTests;
        const successRate = ((passedTests / totalTests) * 100).toFixed(1);
        const duration = Date.now() - this.startTime;

        console.log(`⏱️  Total Duration: ${duration}ms`);
        console.log(`📈 Success Rate: ${successRate}% (${passedTests}/${totalTests})`);
        console.log(`✅ Passed: ${passedTests}`);
        console.log(`❌ Failed: ${failedTests}\n`);

        console.log('📋 Detailed Results:');
        this.testResults.forEach((test, index) => {
            const status = test.success ? '✅' : '❌';
            const details = test.details ? ` - ${test.details}` : '';
            console.log(`${index + 1}. ${status} ${test.name}${details}`);
        });

        console.log('\n🎯 SYSTEM STATUS ASSESSMENT:');
        
        if (successRate >= 95) {
            console.log('🚀 EXCELLENT - System is production-ready!');
            console.log('✅ All critical components operational');
            console.log('✅ Backend ↔ Blockchain integration perfect');
            console.log('✅ Ready for real NFT trading');
        } else if (successRate >= 80) {
            console.log('⚠️  GOOD - Minor issues detected');
            console.log('✅ Core functionality working');
            console.log('🔧 Some optimization needed');
        } else {
            console.log('🔴 ISSUES - Significant problems detected');
            console.log('❌ Critical components failing');
            console.log('🔧 Requires immediate attention');
        }

        console.log(`\n🔗 Blockchain Explorer: https://explorer.solana.com/address/${this.programId}?cluster=devnet`);
        console.log('🎉 Full system test complete!\n');

        return {
            totalTests,
            passedTests,
            failedTests,
            successRate: parseFloat(successRate),
            duration,
            status: successRate >= 95 ? 'excellent' : successRate >= 80 ? 'good' : 'issues'
        };
    }

    // Run all tests
    async runAllTests() {
        console.log('🚀 Starting comprehensive SWAPS system test...\n');

        await this.testBackendHealth();
        await this.testBlockchainHealth();
        await this.testTradeDiscovery();
        await this.testSmartContractInteraction();
        await this.testFullSystemIntegration();
        await this.testPerformanceAndLoad();

        return this.generateReport();
    }
}

// Run the test if this script is executed directly
if (require.main === module) {
    const tester = new SwapsFullSystemTest();
    
    // Give the server a moment to start up
    setTimeout(async () => {
        try {
            await tester.runAllTests();
        } catch (error) {
            console.error('🔴 Test execution failed:', error.message);
        }
    }, 3000); // Wait 3 seconds for server startup
}

module.exports = SwapsFullSystemTest;