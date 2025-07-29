import { performance } from 'perf_hooks';
import { LoggingService } from '../../utils/logging/LoggingService';

/**
 * Service dedicated to finding Strongly Connected Components (SCCs) in a directed graph
 * This implements an optimized version of Tarjan's Algorithm for finding SCCs efficiently
 */
export class SCCFinderService {
  private static instance: SCCFinderService;
  private logger = LoggingService.getInstance().createLogger('SCCFinder');
  
  // Performance tracking
  private startTime: number = 0;
  private nodesProcessed: number = 0;
  private timeoutMs: number;
  
  // Configuration settings - will be initialized in constructor
  private BATCH_SIZE: number;
  private PROGRESS_LOG_THRESHOLD: number;
  private ENABLE_PRUNING: boolean;

  private constructor() {
    // Initialize configuration from environment variables or defaults
    this.timeoutMs = parseInt(process.env.SCC_TIMEOUT_MS || '30000', 10);
    this.BATCH_SIZE = parseInt(process.env.SCC_BATCH_SIZE || '1000', 10);
    this.PROGRESS_LOG_THRESHOLD = parseInt(process.env.SCC_PROGRESS_THRESHOLD || '10000', 10);
    this.ENABLE_PRUNING = process.env.SCC_ENABLE_PRUNING !== 'false'; // Default true
    
    // Validate parsed values (optional but recommended)
    if (isNaN(this.timeoutMs) || this.timeoutMs <= 0) this.timeoutMs = 30000;
    if (isNaN(this.BATCH_SIZE) || this.BATCH_SIZE <= 0) this.BATCH_SIZE = 1000;
    if (isNaN(this.PROGRESS_LOG_THRESHOLD) || this.PROGRESS_LOG_THRESHOLD <= 0) this.PROGRESS_LOG_THRESHOLD = 10000;
    
    this.logger.info('SCCFinderService initialized with configuration:', {
      timeoutMs: this.timeoutMs,
      batchSize: this.BATCH_SIZE,
      progressThreshold: this.PROGRESS_LOG_THRESHOLD,
      pruningEnabled: this.ENABLE_PRUNING,
    });
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): SCCFinderService {
    if (!SCCFinderService.instance) {
      SCCFinderService.instance = new SCCFinderService();
    }
    return SCCFinderService.instance;
  }
  
  /**
   * Set configuration values dynamically (overrides initial values)
   */
  public configure(options: { timeoutMs?: number; enablePruning?: boolean }): void {
    if (options.timeoutMs !== undefined) {
      this.timeoutMs = options.timeoutMs;
      this.logger.info(`Configuration updated: timeoutMs set to ${this.timeoutMs}`);
    }
    if (options.enablePruning !== undefined) {
      this.ENABLE_PRUNING = options.enablePruning;
      this.logger.info(`Configuration updated: enablePruning set to ${this.ENABLE_PRUNING}`);
    }
  }

  /**
   * Prunes nodes that cannot participate in cycles from the graph
   * This significantly reduces the graph size for SCC computation
   * 
   * @param graph The graph represented as an adjacency list
   * @returns Object containing pruned graph and the list of valid nodes
   */
  private pruneGraph(graph: { [key: string]: { [key: string]: string[] } }): {
    prunedGraph: { [key: string]: { [key: string]: string[] } };
    validNodes: string[];
  } {
    const operation = this.logger.operation('pruneGraph');
    const startTime = performance.now();
    
    // Pass 1: Identify nodes with any incoming or outgoing edges
    const nodesWithOutgoing = new Set<string>();
    const nodesWithIncoming = new Set<string>();
    for (const node in graph) {
      const successors = graph[node];
      if (successors && Object.keys(successors).length > 0) {
        nodesWithOutgoing.add(node);
        for (const successor in successors) {
          nodesWithIncoming.add(successor);
        }
      }
    }
    
    // Pass 2: Build pruned graph and valid node list simultaneously
    const prunedGraph: { [key: string]: { [key: string]: string[] } } = {};
    const validNodes: string[] = [];
    
    for (const node in graph) {
      // Check if the node itself can be part of a cycle
      if (nodesWithOutgoing.has(node) && nodesWithIncoming.has(node)) {
        const originalSuccessors = graph[node];
        const validSuccessors: { [key: string]: string[] } = {};
        let hasValidSuccessor = false;

        // Check edges only to successors that can also be part of a cycle
        for (const successor in originalSuccessors) {
          if (nodesWithOutgoing.has(successor) && nodesWithIncoming.has(successor)) {
            validSuccessors[successor] = originalSuccessors[successor];
            hasValidSuccessor = true;
          }
        }

        // Only add node to pruned graph if it has valid successors
        if (hasValidSuccessor) {
          prunedGraph[node] = validSuccessors;
          validNodes.push(node); // Add to the list for the return value
        }
      }
    }
    
    const duration = performance.now() - startTime;
    const originalNodeCount = Object.keys(graph).length;
    const prunedNodeCount = Object.keys(prunedGraph).length; // Count keys in the final pruned graph
    
    operation.info('Graph pruning completed', {
      originalNodes: originalNodeCount,
      prunedNodes: prunedNodeCount,
      reduction: originalNodeCount > 0 ? `${Math.round((originalNodeCount - prunedNodeCount) / originalNodeCount * 100)}%` : '0%',
      durationMs: duration.toFixed(2)
    });
    
    operation.end();
    return { prunedGraph, validNodes };
  }

  /**
   * Find strongly connected components using an optimized Tarjan's algorithm
   * This implementation uses batch processing and early termination for large graphs
   * 
   * @param graph The graph represented as an adjacency list
   * @param nodes Optional array of nodes to use instead of Object.keys(graph)
   * @returns Object containing SCCs array and metadata about processing
   */
  public findStronglyConnectedComponents(
    graph: { [key: string]: { [key: string]: string[] } },
    nodes?: string[]
  ): { sccs: string[][]; metadata: { processedNodes: string[]; timedOut: boolean; timeElapsed: number } } {
    // Start performance tracking
    this.startTime = performance.now();
    this.nodesProcessed = 0;
    
    const operation = this.logger.operation('findStronglyConnectedComponents');
    
    // Track processed nodes for resumption capability
    const processedNodes: string[] = [];
    let timedOut = false;
    
    // Apply graph pruning to reduce size if enabled
    let workingGraph = graph;
    let nodeList = nodes;
    
    if (this.ENABLE_PRUNING && !nodes) {
      const { prunedGraph, validNodes } = this.pruneGraph(graph);
      workingGraph = prunedGraph;
      nodeList = validNodes;
      
      // If pruning removed all nodes, return empty result early
      if (validNodes.length === 0) {
        operation.info('No nodes capable of forming cycles after pruning', {
          originalNodes: Object.keys(graph).length
        });
        operation.end();
        return { 
          sccs: [], 
          metadata: { 
            processedNodes: [], 
            timedOut: false, 
            timeElapsed: performance.now() - this.startTime 
          } 
        };
      }
    } else {
      nodeList = nodeList || Object.keys(graph);
    }
    
    const sccs: string[][] = [];
    
    // Log the starting details
    operation.info('Starting SCC detection', {
      nodes: nodeList.length,
      edges: this.countEdges(workingGraph),
      timeoutMs: this.timeoutMs,
      pruningEnabled: this.ENABLE_PRUNING
    });
    
    // Data structures for Tarjan's algorithm - pre-allocated once
    let index = 0;
    const nodeIndices = new Map<string, number>();
    const nodeLowLinks = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    
    // Optimized strongConnect implementation with early termination
    const strongConnect = (node: string) => {
      // Check for timeout
      if (performance.now() - this.startTime > this.timeoutMs) {
        timedOut = true;
        return false; // Signal early termination
      }
      
      // Set the depth index for node
      nodeIndices.set(node, index);
      nodeLowLinks.set(node, index);
      index++;
      stack.push(node);
      onStack.add(node);
      this.nodesProcessed++;
      processedNodes.push(node); // Track this node as processed
      
      // Process successors
      const successors = workingGraph[node];
      if (successors) {
        for (const successor in successors) {
          if (!nodeIndices.has(successor)) {
            // Successor has not yet been visited; recurse on it
            const continueProcessing = strongConnect(successor);
            if (!continueProcessing) return false; // Propagate termination signal
            
            // Update low link
            const nodeLowLink = nodeLowLinks.get(node)!;
            const successorLowLink = nodeLowLinks.get(successor)!;
            if (successorLowLink < nodeLowLink) {
              nodeLowLinks.set(node, successorLowLink);
            }
          } else if (onStack.has(successor)) {
            // Successor is in stack and hence in the current SCC
            const nodeLowLink = nodeLowLinks.get(node)!;
            const successorIndex = nodeIndices.get(successor)!;
            if (successorIndex < nodeLowLink) {
              nodeLowLinks.set(node, successorIndex);
            }
          }
        }
      }
      
      // If node is a root node, pop the stack and generate an SCC
      if (nodeLowLinks.get(node) === nodeIndices.get(node)) {
        const scc: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          scc.push(w);
        } while (w !== node);
        
        // Store the SCC
        sccs.push(scc);
      }
      
      return true; // Continue processing
    };
    
    // Process in batches to avoid call stack overflow and allow GC
    const isLargeGraph = nodeList.length > this.PROGRESS_LOG_THRESHOLD;
    const nodesToProcess = [...nodeList]; // Create a copy to modify
    
    // Process large graphs in batches
    if (isLargeGraph) {
      let batchesProcessed = 0;
      
      while (nodesToProcess.length > 0 && !timedOut) {
        // Check for timeout
        if (performance.now() - this.startTime > this.timeoutMs) {
          timedOut = true;
          operation.warn('SCC detection timed out', {
            processedNodes: this.nodesProcessed,
            totalNodes: nodeList.length,
            timeElapsed: Math.round(performance.now() - this.startTime),
            sccsFound: sccs.length
          });
          break;
        }
        
        const batch = nodesToProcess.splice(0, this.BATCH_SIZE);
        let batchNodesProcessed = 0;
        
        // Process each node in the batch
        for (const node of batch) {
          if (!nodeIndices.has(node)) {
            const continueProcessing = strongConnect(node);
            if (!continueProcessing) {
              // Early termination due to timeout
              timedOut = true;
              operation.warn('SCC detection timed out during processing', {
                processedNodes: this.nodesProcessed,
                totalNodes: nodeList.length,
                timeElapsed: Math.round(performance.now() - this.startTime)
              });
              break;
            }
          }
          batchNodesProcessed++;
        }
        
        // Log progress periodically
        batchesProcessed++;
        if (batchesProcessed % 10 === 0) {
          const percentComplete = Math.floor((this.nodesProcessed / nodeList.length) * 100);
          operation.info(`Processing SCC batch ${batchesProcessed}`, {
            nodesProcessed: this.nodesProcessed,
            totalNodes: nodeList.length,
            progress: `${percentComplete}%`,
            sccsFound: sccs.length
          });
        }
        
        // Break early if timeout occurred
        if (batchNodesProcessed < batch.length) {
          break;
        }
      }
    } else {
      // For smaller graphs, process all nodes at once
      for (const node of nodeList) {
        if (!nodeIndices.has(node)) {
          const continueProcessing = strongConnect(node);
          if (!continueProcessing) {
            timedOut = true;
            break; // Early termination
          }
        }
      }
    }
    
    // Filter SCCs that can form cycles (more than one node or self-loops)
    const potentialCyclicSccs = sccs.filter(scc => 
      scc.length > 1 || (scc.length === 1 && workingGraph[scc[0]] && workingGraph[scc[0]][scc[0]])
    );
    
    const duration = performance.now() - this.startTime;
    
    // Calculate SCC stats for logging
    const stats = this.calculateSCCStats(potentialCyclicSccs);
    
    operation.info('SCC detection completed', {
      totalSCCs: sccs.length,
      cyclicSCCs: potentialCyclicSccs.length,
      largestSCC: stats.maxSCCSize,
      averageSCCSize: stats.avgSCCSize.toFixed(2),
      sizeDistribution: stats.sizeDistribution,
      durationMs: duration.toFixed(2),
      nodesProcessed: this.nodesProcessed,
      timedOut
    });
    
    operation.end();
    
    return { 
      sccs: potentialCyclicSccs,
      metadata: {
        processedNodes,
        timedOut,
        timeElapsed: duration
      }
    };
  }
  
  /**
   * Count the total number of edges in the graph
   */
  private countEdges(graph: { [key: string]: { [key: string]: string[] } }): number {
    let edgeCount = 0;
    for (const node in graph) {
      edgeCount += Object.keys(graph[node] || {}).length;
    }
    return edgeCount;
  }
  
  /**
   * Calculate statistics about the SCCs
   */
  public calculateSCCStats(sccs: string[][]): { 
    totalSCCs: number;
    avgSCCSize: number;
    maxSCCSize: number;
    totalNodes: number;
    sizeDistribution: Record<string, number>;
  } {
    if (sccs.length === 0) {
      return {
        totalSCCs: 0,
        avgSCCSize: 0,
        maxSCCSize: 0,
        totalNodes: 0,
        sizeDistribution: {}
      };
    }
    
    // Calculate basic statistics in one pass
    let totalNodes = 0;
    let maxSize = 0;
    const sizeDistribution: Record<string, number> = {};
    
    for (const scc of sccs) {
      const size = scc.length;
      totalNodes += size;
      
      if (size > maxSize) maxSize = size;
      
      // Group by size ranges: 1-5, 6-20, 21-50, 51-100, 101+
      const key = size <= 5 ? '1-5' :
                 size <= 20 ? '6-20' :
                 size <= 50 ? '21-50' :
                 size <= 100 ? '51-100' : '101+';
      
      sizeDistribution[key] = (sizeDistribution[key] || 0) + 1;
    }
    
    return {
      totalSCCs: sccs.length,
      avgSCCSize: totalNodes / sccs.length,
      maxSCCSize: maxSize,
      totalNodes,
      sizeDistribution
    };
  }
  
  /**
   * Get performance metrics for the last SCC finding operation
   */
  public getPerformanceMetrics(): {
    nodesProcessed: number;
    timeElapsed: number;
  } {
    return {
      nodesProcessed: this.nodesProcessed,
      timeElapsed: performance.now() - this.startTime
    };
  }
} 