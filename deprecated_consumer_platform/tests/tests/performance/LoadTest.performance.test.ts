import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';
import { performance } from 'perf_hooks';
import { PersistentTradeDiscoveryService } from '../../services/trade/PersistentTradeDiscoveryService';
import { TenantManagementService } from '../../services/tenant/TenantManagementService';
import { UniversalNFTIngestionService } from '../../services/ingestion/UniversalNFTIngestionService';
import { TenantConfig, AbstractNFT, AbstractWallet } from '../../types/abstract';

/**
 * Performance and Load Tests for SWAPS White Label System
 * 
 * Tests the system under various load scenarios to ensure it meets
 * performance requirements for white label partners.
 */
describe('SWAPS White Label Performance Tests', () => {
  let tradeService: PersistentTradeDiscoveryService;
  let tenantService: TenantManagementService;
  let ingestionService: UniversalNFTIngestionService;
  let testTenants: TenantConfig[] = [];

  // Performance benchmarks
  const PERFORMANCE_TARGETS = {
    singleTradeDiscovery: 500, // ms
    multiTenantTradeDiscovery: 1000, // ms
    nftIngestionPerItem: 50, // ms
    tenantIsolation: 100, // ms
    algorithmParity: 1000, // ms (vs original)
    concurrentRequests: 5000, // ms for 100 concurrent
    memoryLeakThreshold: 50 * 1024 * 1024, // 50MB
    cpuUsageThreshold: 80 // percent
  };

  beforeAll(async () => {
    tradeService = PersistentTradeDiscoveryService.getInstance();
    tenantService = TenantManagementService.getInstance();
    ingestionService = UniversalNFTIngestionService.getInstance();

    // Create test tenants for load testing
    for (let i = 0; i < 5; i++) {
      const tenant = await tenantService.createTenant({
        name: `Load Test Tenant ${i}`,
        contactEmail: `loadtest${i}@test.com`,
        industry: 'testing'
      });
      await tradeService.initializeTenant(tenant);
      testTenants.push(tenant);
    }
  });

  afterAll(async () => {
    // Cleanup test tenants
    for (const tenant of testTenants) {
      await tenantService.deleteTenant(tenant.id);
    }
  });

  describe('Single Tenant Performance', () => {
    let testTenant: TenantConfig;

    beforeAll(() => {
      testTenant = testTenants[0];
    });

    it('should handle single NFT addition within performance target', async () => {
      const testNFT: AbstractNFT = {
        id: 'perf-test-nft-1',
        metadata: {
          name: 'Performance Test NFT',
          description: 'NFT for performance testing',
          image: 'https://example.com/perf-nft.png'
        },
        ownership: {
          ownerId: 'perf-wallet-1',
          acquiredAt: new Date()
        },
        valuation: {
          estimatedValue: 2.0,
          currency: 'ETH',
          confidence: 0.9
        }
      };

      const startTime = performance.now();
      const result = await tradeService.onNFTAdded(testTenant.id, testNFT);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.singleTradeDiscovery);
      expect(result).toEqual(expect.any(Array));
    });

    it('should handle batch NFT additions efficiently', async () => {
      const batchSize = 50;
      const nfts: AbstractNFT[] = Array.from({ length: batchSize }, (_, i) => ({
        id: `batch-nft-${i}`,
        metadata: {
          name: `Batch NFT ${i}`,
          description: `Batch test NFT ${i}`
        },
        ownership: {
          ownerId: `batch-wallet-${i % 10}`, // 10 wallets, multiple NFTs each
          acquiredAt: new Date()
        },
        valuation: {
          estimatedValue: Math.random() * 5,
          currency: 'ETH',
          confidence: 0.8
        }
      }));

      const startTime = performance.now();
      
      const promises = nfts.map(nft => 
        tradeService.onNFTAdded(testTenant.id, nft)
      );
      
      await Promise.all(promises);
      const endTime = performance.now();

      const totalDuration = endTime - startTime;
      const avgDurationPerNFT = totalDuration / batchSize;

      expect(avgDurationPerNFT).toBeLessThan(PERFORMANCE_TARGETS.nftIngestionPerItem);
      expect(totalDuration).toBeLessThan(batchSize * PERFORMANCE_TARGETS.nftIngestionPerItem);
    });

    it('should handle want additions with minimal overhead', async () => {
      const wants = Array.from({ length: 100 }, (_, i) => ({
        walletId: `want-wallet-${i % 20}`,
        nftId: `wanted-nft-${i}`
      }));

      const startTime = performance.now();

      for (const want of wants) {
        await tradeService.onWantAdded(testTenant.id, want.walletId, want.nftId);
      }

      const endTime = performance.now();
      const avgTimePerWant = (endTime - startTime) / wants.length;

      expect(avgTimePerWant).toBeLessThan(20); // 20ms per want addition
    });
  });

  describe('Multi-Tenant Performance', () => {
    it('should maintain performance isolation between tenants', async () => {
      const operations = testTenants.map(async (tenant, index) => {
        const nft: AbstractNFT = {
          id: `isolation-nft-${index}`,
          metadata: {
            name: `Isolation Test NFT ${index}`,
            description: `Testing tenant isolation ${index}`
          },
          ownership: {
            ownerId: `isolation-wallet-${index}`,
            acquiredAt: new Date()
          }
        };

        const startTime = performance.now();
        await tradeService.onNFTAdded(tenant.id, nft);
        const endTime = performance.now();

        return endTime - startTime;
      });

      const durations = await Promise.all(operations);

      // All operations should complete within target
      durations.forEach(duration => {
        expect(duration).toBeLessThan(PERFORMANCE_TARGETS.tenantIsolation);
      });

      // Performance should be consistent across tenants
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const maxDeviation = Math.max(...durations.map(d => Math.abs(d - avgDuration)));
      
      expect(maxDeviation).toBeLessThan(avgDuration * 0.5); // Max 50% deviation
    });

    it('should handle concurrent operations across tenants', async () => {
      const concurrentOps = 100;
      const operations: Promise<any>[] = [];

      const startTime = performance.now();

      for (let i = 0; i < concurrentOps; i++) {
        const tenant = testTenants[i % testTenants.length];
        const nft: AbstractNFT = {
          id: `concurrent-nft-${i}`,
          metadata: {
            name: `Concurrent NFT ${i}`,
            description: `Concurrent test ${i}`
          },
          ownership: {
            ownerId: `concurrent-wallet-${i}`,
            acquiredAt: new Date()
          }
        };

        operations.push(tradeService.onNFTAdded(tenant.id, nft));
      }

      await Promise.all(operations);
      const endTime = performance.now();

      const totalDuration = endTime - startTime;
      expect(totalDuration).toBeLessThan(PERFORMANCE_TARGETS.concurrentRequests);
    });
  });

  describe('Algorithm Performance Validation', () => {
    it('should maintain algorithm performance after white label transformation', async () => {
      const tenant = testTenants[0];
      
      // Create a complex scenario with multiple NFTs and wants
      const complexNFTs: AbstractNFT[] = Array.from({ length: 20 }, (_, i) => ({
        id: `complex-nft-${i}`,
        metadata: {
          name: `Complex NFT ${i}`,
          description: `Complex scenario NFT ${i}`
        },
        ownership: {
          ownerId: `complex-wallet-${i}`,
          acquiredAt: new Date()
        },
        collection: {
          id: `collection-${i % 5}`, // 5 collections
          name: `Collection ${i % 5}`
        },
        valuation: {
          estimatedValue: 1 + (i % 10), // Varied values
          currency: 'ETH',
          confidence: 0.8
        }
      }));

      // Add NFTs to create a complex graph
      for (const nft of complexNFTs) {
        await tradeService.onNFTAdded(tenant.id, nft);
      }

      // Add circular wants to create trade opportunities
      for (let i = 0; i < complexNFTs.length; i++) {
        const walletId = `complex-wallet-${i}`;
        const wantedNftId = `complex-nft-${(i + 1) % complexNFTs.length}`;
        await tradeService.onWantAdded(tenant.id, walletId, wantedNftId);
      }

      // Measure discovery time for complex scenario
      const startTime = performance.now();
      
      // This should trigger significant trade discovery
      const finalNFT: AbstractNFT = {
        id: 'complex-trigger-nft',
        metadata: { name: 'Trigger NFT' },
        ownership: { ownerId: 'complex-wallet-0' }
      };
      
      await tradeService.onNFTAdded(tenant.id, finalNFT);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.algorithmParity);
    });

    it('should scale linearly with data size', async () => {
      const tenant = testTenants[1];
      const dataSizes = [10, 20, 50];
      const durations: number[] = [];

      for (const size of dataSizes) {
        const nfts: AbstractNFT[] = Array.from({ length: size }, (_, i) => ({
          id: `scale-nft-${size}-${i}`,
          metadata: {
            name: `Scale NFT ${i}`,
            description: `Scaling test NFT ${i}`
          },
          ownership: {
            ownerId: `scale-wallet-${size}-${i}`,
            acquiredAt: new Date()
          }
        }));

        const startTime = performance.now();
        
        for (const nft of nfts) {
          await tradeService.onNFTAdded(tenant.id, nft);
        }
        
        const endTime = performance.now();
        durations.push((endTime - startTime) / size); // Duration per NFT
      }

      // Performance should be roughly linear (allow some variance)
      const firstDuration = durations[0];
      const lastDuration = durations[durations.length - 1];
      
      expect(lastDuration).toBeLessThan(firstDuration * 2); // At most 2x slower per item
    });
  });

  describe('Memory Management', () => {
    it('should not have memory leaks during extended operation', async () => {
      const tenant = testTenants[2];
      const initialMemory = process.memoryUsage();

      // Perform many operations
      for (let batch = 0; batch < 10; batch++) {
        const nfts: AbstractNFT[] = Array.from({ length: 50 }, (_, i) => ({
          id: `memory-nft-${batch}-${i}`,
          metadata: {
            name: `Memory Test NFT ${batch}-${i}`,
            description: `Memory test ${batch}-${i}`
          },
          ownership: {
            ownerId: `memory-wallet-${batch}-${i}`,
            acquiredAt: new Date()
          }
        }));

        for (const nft of nfts) {
          await tradeService.onNFTAdded(tenant.id, nft);
        }

        // Force garbage collection periodically
        if (global.gc && batch % 3 === 0) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(memoryIncrease).toBeLessThan(PERFORMANCE_TARGETS.memoryLeakThreshold);
    });

    it('should cleanup tenant data on tenant deletion', async () => {
      // Create a temporary tenant with significant data
      const tempTenant = await tenantService.createTenant({
        name: 'Temp Cleanup Test Tenant',
        contactEmail: 'cleanup@test.com',
        industry: 'testing'
      });
      
      await tradeService.initializeTenant(tempTenant);

      // Add significant data
      const nfts: AbstractNFT[] = Array.from({ length: 100 }, (_, i) => ({
        id: `cleanup-nft-${i}`,
        metadata: {
          name: `Cleanup NFT ${i}`,
          description: `Cleanup test NFT ${i}`
        },
        ownership: {
          ownerId: `cleanup-wallet-${i}`,
          acquiredAt: new Date()
        }
      }));

      for (const nft of nfts) {
        await tradeService.onNFTAdded(tempTenant.id, nft);
      }

      const beforeCleanup = process.memoryUsage();

      // Delete tenant
      await tenantService.deleteTenant(tempTenant.id);

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const afterCleanup = process.memoryUsage();

      // Memory should not increase significantly after cleanup
      const memoryChange = afterCleanup.heapUsed - beforeCleanup.heapUsed;
      expect(Math.abs(memoryChange)).toBeLessThan(10 * 1024 * 1024); // 10MB tolerance
    });
  });

  describe('Delta Detection Performance', () => {
    it('should optimize subgraph detection for large graphs', async () => {
      const tenant = testTenants[3];

      // Create a large graph
      const largeGraphNFTs: AbstractNFT[] = Array.from({ length: 200 }, (_, i) => ({
        id: `large-graph-nft-${i}`,
        metadata: {
          name: `Large Graph NFT ${i}`,
          description: `Large graph test NFT ${i}`
        },
        ownership: {
          ownerId: `large-wallet-${i}`,
          acquiredAt: new Date()
        },
        collection: {
          id: `large-collection-${i % 20}`, // 20 collections
          name: `Large Collection ${i % 20}`
        }
      }));

      // Add all NFTs
      for (const nft of largeGraphNFTs) {
        await tradeService.onNFTAdded(tenant.id, nft);
      }

      // Now test delta detection performance
      const testNFT: AbstractNFT = {
        id: 'delta-test-nft',
        metadata: {
          name: 'Delta Test NFT',
          description: 'Testing delta detection'
        },
        ownership: {
          ownerId: 'delta-wallet',
          acquiredAt: new Date()
        }
      };

      const startTime = performance.now();
      await tradeService.onNFTAdded(tenant.id, testNFT);
      const endTime = performance.now();

      const deltaDetectionTime = endTime - startTime;
      
      // Should be fast even with large existing graph
      expect(deltaDetectionTime).toBeLessThan(200); // 200ms
    });

    it('should handle dense graph connections efficiently', async () => {
      const tenant = testTenants[4];
      const walletCount = 20;
      const nftCount = 50;

      // Create NFTs
      const nfts: AbstractNFT[] = Array.from({ length: nftCount }, (_, i) => ({
        id: `dense-nft-${i}`,
        metadata: {
          name: `Dense NFT ${i}`,
          description: `Dense graph NFT ${i}`
        },
        ownership: {
          ownerId: `dense-wallet-${i % walletCount}`,
          acquiredAt: new Date()
        }
      }));

      for (const nft of nfts) {
        await tradeService.onNFTAdded(tenant.id, nft);
      }

      // Create dense want connections (each wallet wants multiple NFTs)
      const startTime = performance.now();
      
      for (let walletIdx = 0; walletIdx < walletCount; walletIdx++) {
        for (let nftIdx = 0; nftIdx < 5; nftIdx++) {
          const targetNftIdx = (walletIdx * 2 + nftIdx) % nftCount;
          await tradeService.onWantAdded(
            tenant.id,
            `dense-wallet-${walletIdx}`,
            `dense-nft-${targetNftIdx}`
          );
        }
      }

      const endTime = performance.now();
      const denseGraphTime = endTime - startTime;

      // Should handle dense connections efficiently
      expect(denseGraphTime).toBeLessThan(1000); // 1 second for dense graph
    });
  });

  describe('Ingestion Performance', () => {
    it('should handle large NFT ingestion batches efficiently', async () => {
      // This test would be more complete with actual ingestion service integration
      const batchSize = 1000;
      const startTime = performance.now();

      // Simulate large batch processing
      const promises: Promise<any>[] = [];
      
      for (let i = 0; i < batchSize; i++) {
        const nft: AbstractNFT = {
          id: `ingestion-nft-${i}`,
          metadata: {
            name: `Ingestion NFT ${i}`,
            description: `Batch ingestion NFT ${i}`
          },
          ownership: {
            ownerId: `ingestion-wallet-${i % 100}`, // 100 wallets
            acquiredAt: new Date()
          }
        };

        promises.push(tradeService.onNFTAdded(testTenants[0].id, nft));
      }

      await Promise.all(promises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const timePerNFT = totalTime / batchSize;

      expect(timePerNFT).toBeLessThan(PERFORMANCE_TARGETS.nftIngestionPerItem);
    });
  });

  describe('Stress Testing', () => {
    it('should handle maximum concurrent tenant operations', async () => {
      const maxConcurrentOps = 200;
      const operations: Promise<any>[] = [];

      const startTime = performance.now();

      for (let i = 0; i < maxConcurrentOps; i++) {
        const tenant = testTenants[i % testTenants.length];
        const operation = Math.random() < 0.7 ? 'addNFT' : 'addWant';

        if (operation === 'addNFT') {
          const nft: AbstractNFT = {
            id: `stress-nft-${i}`,
            metadata: {
              name: `Stress NFT ${i}`,
              description: `Stress test NFT ${i}`
            },
            ownership: {
              ownerId: `stress-wallet-${i}`,
              acquiredAt: new Date()
            }
          };
          operations.push(tradeService.onNFTAdded(tenant.id, nft));
        } else {
          operations.push(
            tradeService.onWantAdded(tenant.id, `stress-wallet-${i}`, `stress-target-${i}`)
          );
        }
      }

      const results = await Promise.allSettled(operations);
      const endTime = performance.now();

      const successfulOps = results.filter(r => r.status === 'fulfilled').length;
      const totalTime = endTime - startTime;

      // Most operations should succeed
      expect(successfulOps).toBeGreaterThan(maxConcurrentOps * 0.8); // 80% success rate
      
      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(15000); // 15 seconds
    });
  });
}); 