import { performance } from 'perf_hooks';
import { LoggingService } from '../../utils/logging/LoggingService';

/**
 * Service dedicated to finding cycles (elementary circuits) in a directed graph
 * This implements an optimized version of Johnson's Algorithm
 */
export class CycleFinderService {
  private static instance: CycleFinderService;
  private logger = LoggingService.getInstance().createLogger('CycleFinder');
  
  // Performance metrics and timeout handling
  private startTime: number = 0;
  private cyclesFound: number = 0;
  private edgesTraversed: number = 0;
  private timeoutMs: number;
  private maxDepth: number;
  private cycleLimit: number = 10000; // Maximum cycles to find before stopping
  
  // Flag to enable/disable specific test wallet logging
  private enableTestLogging: boolean;
  
  // Optimized pre-allocations for path tracking
  private globalVisitedNodeStarts = new Set<string>();
  
  private constructor() {
    this.timeoutMs = parseInt(process.env.TRADELOOP_GLOBAL_TIMEOUT_MS || '30000', 10);
    this.maxDepth = parseInt(process.env.TRADELOOP_MAX_DEPTH || '11', 10);
    this.enableTestLogging = process.env.CYCLE_FINDER_ENABLE_TEST_LOGGING === 'true';
    
    if (this.enableTestLogging) {
      this.logger.warn('Detailed test case logging enabled in CycleFinderService');
    }
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): CycleFinderService {
    if (!CycleFinderService.instance) {
      CycleFinderService.instance = new CycleFinderService();
    }
    return CycleFinderService.instance;
  }
  
  /**
   * Set configuration values
   */
  public configure(options: { timeoutMs?: number; maxDepth?: number; cycleLimit?: number }): void {
    if (options.timeoutMs) this.timeoutMs = options.timeoutMs;
    if (options.maxDepth) this.maxDepth = options.maxDepth;
    if (options.cycleLimit) this.cycleLimit = options.cycleLimit;
    // Allow dynamic configuration of test logging if needed in the future
    // if (options.enableTestLogging !== undefined) this.enableTestLogging = options.enableTestLogging;
  }
  
  /**
   * Find all elementary cycles in a directed graph
   * Implements an optimized version of Johnson's algorithm
   * 
   * @param graph The graph represented as an adjacency list
   * @returns Array of cycles, where each cycle is an array of node IDs
   */
  public findElementaryCycles(graph: { [key: string]: { [key: string]: string[] } }): string[][] {
    this.startTime = performance.now();
    this.cyclesFound = 0;
    this.edgesTraversed = 0;
    
    const operation = this.logger.operation('findElementaryCycles');
    
    // Find all cycles in the graph
    const allCycles: string[][] = [];
    const nodes = Object.keys(graph);
    
    // Count edges once - avoid repeated calculations
    const edgesCount = Object.values(graph).reduce(
      (sum, outEdges) => sum + Object.keys(outEdges).length, 0
    );
    
    // Pre-compute graph density for optimization strategies
    const density = nodes.length > 0 ? edgesCount / (nodes.length * nodes.length) : 0;
    const isDenseGraph = density > 0.1; // Threshold for dense graph detection
    
    // Clear global tracker
    this.globalVisitedNodeStarts.clear();
    
    operation.info('Starting cycle detection', {
      nodes: nodes.length,
      edges: edgesCount,
      maxDepth: this.maxDepth,
      timeoutMs: this.timeoutMs,
      density: density.toFixed(4),
      isDenseGraph
    });
    
    // Process nodes in batches for large graphs to allow GC
    const BATCH_SIZE = 1000;
    let processedCount = 0;
    
    // For dense graphs, run on reduced node set
    const nodesToProcess = isDenseGraph 
      ? this.selectHighDegreeNodes(graph, nodes, Math.max(100, Math.ceil(nodes.length * 0.1)))
      : nodes;
    
    // Create batches
    for (let i = 0; i < nodesToProcess.length; i += BATCH_SIZE) {
      const batch = nodesToProcess.slice(i, Math.min(i + BATCH_SIZE, nodesToProcess.length));
      
      // Track progress for large graphs
      if (nodes.length > 5000 && i > 0) {
        const percentComplete = Math.floor((i / nodesToProcess.length) * 100);
        operation.info(`Processing node batch ${i}-${i + batch.length} of ${nodesToProcess.length} (${percentComplete}%)`);
      }
      
      // Process each node in the batch
      for (const startNode of batch) {
        // Skip if we've exceeded the time budget or cycle limit
        if (performance.now() - this.startTime > this.timeoutMs || 
            allCycles.length >= this.cycleLimit) {
          operation.warn('Cycle detection halted, returning partial results', {
            reason: allCycles.length >= this.cycleLimit ? 'cycle limit reached' : 'timeout',
            cyclesFound: this.cyclesFound,
            timeElapsed: Math.round(performance.now() - this.startTime),
            processedNodes: processedCount
          });
          break;
        }
        
        // Skip nodes we've already processed
        if (this.globalVisitedNodeStarts.has(startNode)) {
          continue;
        }
        this.globalVisitedNodeStarts.add(startNode);
        
        // Reuse these data structures for each DFS call to reduce allocations
        const visited = new Set<string>();
        const path: string[] = [startNode];
        
        // Check if the node has outgoing edges before starting DFS
        if (graph[startNode] && Object.keys(graph[startNode]).length > 0) {
          this.findCyclesDFS(startNode, startNode, graph, visited, path, allCycles);
        }
        
        processedCount++;
      }
      
      // Break early if we've hit limits
      if (performance.now() - this.startTime > this.timeoutMs || 
          allCycles.length >= this.cycleLimit) {
        break;
      }
    }
    
    // Filter out cycles that exceed the maximum depth - this should rarely trigger
    // since we now check depth during DFS, but keep as a safety measure
    const filteredCycles = allCycles.filter(cycle => cycle.length <= this.maxDepth);
    
    const endTime = performance.now();
    operation.info('Cycle detection completed', {
      duration: `${(endTime - this.startTime).toFixed(2)}ms`,
      totalCycles: allCycles.length,
      filteredCycles: filteredCycles.length,
      edgesTraversed: this.edgesTraversed,
      cyclesFound: this.cyclesFound,
      nodesProcessed: processedCount,
      totalNodes: nodes.length
    });
    
    operation.end();
    return filteredCycles;
  }
  
  /**
   * Select high-degree nodes (nodes with many connections) for processing
   * This is an optimization for dense graphs to focus on the most promising nodes
   */
  private selectHighDegreeNodes(
    graph: { [key: string]: { [key: string]: string[] } },
    nodes: string[],
    limit: number
  ): string[] {
    // Calculate node out-degrees (faster heuristic than full degree)
    const nodeOutDegrees: Array<{node: string, degree: number}> = [];
    
    for (const node of nodes) {
      const outDegree = graph[node] ? Object.keys(graph[node]).length : 0;
      nodeOutDegrees.push({node, degree: outDegree});
    }
    
    // Sort by out-degree (descending)
    nodeOutDegrees.sort((a, b) => b.degree - a.degree);
    
    // Return top 'limit' nodes
    return nodeOutDegrees.slice(0, limit).map(item => item.node);
  }
  
  /**
   * Depth-first search to find cycles starting from a node
   * Optimized implementation with early termination
   */
  private findCyclesDFS(
    startNode: string,
    currentNode: string,
    adjacencyList: { [key: string]: { [key: string]: string[] } },
    visited: Set<string>,
    path: string[],
    allCycles: string[][]
  ): void {
    // Early termination checks
    // 1. Check if we've exceeded the global time budget
    if (performance.now() - this.startTime > this.timeoutMs) {
      return;
    }
    
    // 2. Check if we've found too many cycles already
    if (allCycles.length >= this.cycleLimit) {
      return;
    }
    
    // 3. Check if path is too long already - avoid unnecessary recursion
    if (path.length >= this.maxDepth) {
      return;
    }
    
    // Mark current node as visited
    visited.add(currentNode);
    
    // Get neighbors of current node - cache lookup for efficiency
    const currentNodeEdges = adjacencyList[currentNode];
    if (!currentNodeEdges) {
      visited.delete(currentNode);
      return; // No outgoing edges, backtrack immediately
    }
    
    // Test case wallets detection - only do this if enabled
    let isTestCase = false;
    if (this.enableTestLogging) {
      isTestCase = this.isTestWalletCycle(startNode, currentNode, path);
    }
    
    // Iterate through neighbors - direct property access is faster
    for (const neighbor in currentNodeEdges) {
      this.edgesTraversed++;
      
      // Test case special logging - only do this if enabled
      if (this.enableTestLogging && isTestCase) {
        this.logTestCaseProgress(neighbor, currentNode, path, visited);
      }
      
      // Found a cycle
      if (neighbor === startNode) {
        // Log test case cycles - only do this if enabled
        if (this.enableTestLogging && isTestCase) {
          this.logger.info(`[TEST CASE] Found cycle: ${path.map(n => n.substring(0, 6)).join(' -> ')} -> ${startNode.substring(0, 6)}`);
        }
        
        // Only allocate a new array when we find a cycle
        allCycles.push([...path]);
        this.cyclesFound++;
        continue;
      }
      
      // Skip if neighbor is already visited
      if (visited.has(neighbor)) continue;
      
      // Continue DFS - modify path in place to reduce allocations
      path.push(neighbor);
      this.findCyclesDFS(startNode, neighbor, adjacencyList, visited, path, allCycles);
      path.pop(); // Backtrack
    }
    
    // Backtrack: remove current node from visited
    visited.delete(currentNode);
  }
  
  /**
   * Check if this path involves test wallets for special logging
   */
  private isTestWalletCycle(startNode: string, currentNode: string, path: string[]): boolean {
    // Test wallets to track (move to class property if used extensively)
    const testWallets = [
      '5pPCbuGso6NguFBWAqaKm7FW9msRoLQQoWu7kawGfFna', 
      'NHLeTzVE1BriRr3Uuebyq1aKEjRvWFMozy2BDAuLN2m',
      '52sLrTRsiVrVyxSL8r1rpbJmjtcbQER9QgeiykViUgC8'
    ];
    
    return testWallets.includes(startNode) || 
           testWallets.includes(currentNode) ||
           path.some(node => testWallets.includes(node));
  }
  
  /**
   * Handle test case logging separately to keep main algorithm clean
   */
  private logTestCaseProgress(
    neighbor: string, 
    currentNode: string, 
    path: string[], 
    visited: Set<string>
  ): void {
    const shortNeighbor = neighbor.substring(0, 6);
    this.logger.debug(`[TEST CASE] Checking neighbor ${shortNeighbor} from ${currentNode.substring(0, 6)}`);
    
    if (visited.has(neighbor)) {
      this.logger.debug(`[TEST CASE] Skipping neighbor ${neighbor.substring(0, 6)}, reason: already visited`);
    } else if (path.length >= this.maxDepth) {
      this.logger.debug(`[TEST CASE] Skipping neighbor ${neighbor.substring(0, 6)}, reason: max depth reached`);
    }
  }
  
  /**
   * Get performance metrics for the last cycle finding operation
   */
  public getPerformanceMetrics(): {
    cyclesFound: number;
    edgesTraversed: number;
    timeElapsed: number;
  } {
    const timeElapsed = performance.now() - this.startTime;
    return {
      cyclesFound: this.cyclesFound,
      edgesTraversed: this.edgesTraversed,
      timeElapsed
    };
  }
} 