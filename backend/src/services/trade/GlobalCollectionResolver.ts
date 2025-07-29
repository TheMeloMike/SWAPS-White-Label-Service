import { LoggingService, Logger } from '../../utils/logging/LoggingService';
import { TradeLoop, CollectionResolution, NFTMetadata } from '../../types/trade';
import { CollectionAbstractionService } from './CollectionAbstractionService';
import { NFTPricingService } from '../nft/NFTPricingService';
import { TradeScoreService } from './TradeScoreService';

export interface CollectionConstraint {
  walletAddress: string;
  collectionId: string;
  availableNFTs: string[];
  preferences?: {
    maxPrice?: number;
    minRarity?: number;
    preferredTraits?: string[];
  };
}

export interface GlobalResolutionContext {
  tradeLoop: TradeLoop;
  constraints: CollectionConstraint[];
  specificWants: Map<string, string>; // NFT -> wallet that wants it
  nftOwnership: Map<string, string>;
  nftMetadata: Map<string, NFTMetadata>;
}

export interface GlobalResolutionResult {
  resolutions: Map<string, CollectionResolution>;
  totalScore: number;
  fairnessScore: number;
  alternativeSolutions?: GlobalResolutionResult[];
}

/**
 * Global Collection Resolution Service
 * 
 * Optimizes NFT selection across all collection wants in a trade loop
 * to maximize overall trade quality and fairness.
 * 
 * Key features:
 * - Constraint satisfaction for multi-party trades
 * - Global optimization vs local greedy selection
 * - Fairness balancing across all participants
 * - Alternative solution generation
 */
export class GlobalCollectionResolver {
  private static instance: GlobalCollectionResolver;
  private logger: Logger;
  private collectionService: CollectionAbstractionService;
  private pricingService: NFTPricingService;
  private scoreService: TradeScoreService;
  
  // Configuration
  private readonly MAX_ALTERNATIVES = 3;
  private readonly FAIRNESS_THRESHOLD = 0.1; // 10% max value variance
  
  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('GlobalCollectionResolver');
    this.collectionService = CollectionAbstractionService.getInstance();
    this.pricingService = NFTPricingService.getInstance();
    this.scoreService = TradeScoreService.getInstance();
  }

  public static getInstance(): GlobalCollectionResolver {
    if (!GlobalCollectionResolver.instance) {
      GlobalCollectionResolver.instance = new GlobalCollectionResolver();
    }
    return GlobalCollectionResolver.instance;
  }

  /**
   * Resolve all collection wants in a trade loop globally
   */
  public async resolveAllCollections(
    context: GlobalResolutionContext
  ): Promise<GlobalResolutionResult> {
    const operation = this.logger.operation('resolveAllCollections');
    
    try {
      operation.info('Starting global collection resolution', {
        tradeLoopId: context.tradeLoop.id,
        constraints: context.constraints.length,
        specificWants: context.specificWants.size
      });

      // Step 1: Build constraint graph
      const constraintGraph = await this.buildConstraintGraph(context);
      
      // Step 2: Find optimal assignment
      const optimalAssignment = await this.findOptimalAssignment(
        constraintGraph,
        context
      );
      
      // Step 3: Generate alternative solutions
      const alternatives = await this.generateAlternatives(
        constraintGraph,
        context,
        optimalAssignment
      );
      
      // Step 4: Score and rank solutions
      const scoredSolutions = await this.scoreAndRankSolutions(
        [optimalAssignment, ...alternatives],
        context
      );
      
      const bestSolution = scoredSolutions[0];
      
      operation.info('Global resolution completed', {
        totalScore: bestSolution.totalScore,
        fairnessScore: bestSolution.fairnessScore,
        alternatives: alternatives.length
      });
      
      operation.end();
      return {
        ...bestSolution,
        alternativeSolutions: scoredSolutions.slice(1)
      };
      
    } catch (error) {
      operation.error('Global collection resolution failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      operation.end();
      throw error;
    }
  }

  /**
   * Build a constraint satisfaction graph
   */
  private async buildConstraintGraph(
    context: GlobalResolutionContext
  ): Promise<ConstraintGraph> {
    const graph = new ConstraintGraph();
    
    // Add nodes for each collection constraint
    for (const constraint of context.constraints) {
      const node = new ConstraintNode(
        constraint.walletAddress,
        constraint.collectionId,
        constraint.availableNFTs
      );
      
      // Score each available NFT
      for (const nft of constraint.availableNFTs) {
        const score = await this.scoreNFTForConstraint(
          nft,
          constraint,
          context
        );
        node.addOption(nft, score);
      }
      
      graph.addNode(node);
    }
    
    // Add edges representing conflicts or synergies
    for (let i = 0; i < context.constraints.length; i++) {
      for (let j = i + 1; j < context.constraints.length; j++) {
        const constraint1 = context.constraints[i];
        const constraint2 = context.constraints[j];
        
        // Check for NFT conflicts (same NFT wanted by multiple)
        const conflicts = this.findConflicts(
          constraint1.availableNFTs,
          constraint2.availableNFTs
        );
        
        if (conflicts.length > 0) {
          graph.addEdge(
            constraint1.walletAddress,
            constraint2.walletAddress,
            { type: 'conflict', nfts: conflicts }
          );
        }
      }
    }
    
    return graph;
  }

  /**
   * Find optimal NFT assignment using constraint satisfaction
   */
  private async findOptimalAssignment(
    graph: ConstraintGraph,
    context: GlobalResolutionContext
  ): Promise<Assignment> {
    // Use backtracking with forward checking for constraint satisfaction
    const assignment = new Assignment();
    const unassigned = new Set(graph.getNodes().map(n => n.id));
    
    const result = await this.backtrackSearch(
      assignment,
      unassigned,
      graph,
      context
    );
    
    if (!result) {
      throw new Error('No valid assignment found for collection constraints');
    }
    
    return result;
  }

  /**
   * Backtracking search with constraint propagation
   */
  private async backtrackSearch(
    assignment: Assignment,
    unassigned: Set<string>,
    graph: ConstraintGraph,
    context: GlobalResolutionContext
  ): Promise<Assignment | null> {
    // Base case: all variables assigned
    if (unassigned.size === 0) {
      return assignment;
    }
    
    // Select next variable (MRV heuristic - most constrained first)
    const nextVar = this.selectUnassignedVariable(unassigned, graph, assignment);
    unassigned.delete(nextVar);
    
    const node = graph.getNode(nextVar);
    if (!node) return null;
    
    // Try each value in domain (ordered by score)
    const orderedValues = node.getOrderedOptions();
    
    for (const [nft, score] of orderedValues) {
      // Check if this assignment is consistent
      if (this.isConsistent(nft, nextVar, assignment, graph)) {
        // Make assignment
        assignment.assign(nextVar, nft, score);
        
        // Forward checking: propagate constraints
        const inference = this.forwardCheck(nextVar, nft, graph, assignment);
        
        if (inference.isValid) {
          // Recursive call
          const result = await this.backtrackSearch(
            assignment,
            new Set(unassigned),
            graph,
            context
          );
          
          if (result) {
            return result;
          }
        }
        
        // Backtrack
        assignment.unassign(nextVar);
      }
    }
    
    // No valid assignment found
    unassigned.add(nextVar);
    return null;
  }

  /**
   * Check if an NFT assignment is consistent with current assignments
   */
  private isConsistent(
    nft: string,
    wallet: string,
    assignment: Assignment,
    graph: ConstraintGraph
  ): boolean {
    // Check if NFT is already assigned to someone else
    for (const [assignedWallet, assignedNft] of assignment.getAssignments()) {
      if (assignedNft === nft && assignedWallet !== wallet) {
        return false;
      }
    }
    
    // Check other constraints (e.g., price limits, rarity requirements)
    const node = graph.getNode(wallet);
    if (node?.preferences) {
      // Additional constraint checking based on preferences
      // This would check against metadata, prices, etc.
    }
    
    return true;
  }

  /**
   * Forward checking for constraint propagation
   */
  private forwardCheck(
    wallet: string,
    nft: string,
    graph: ConstraintGraph,
    assignment: Assignment
  ): { isValid: boolean; removals: Map<string, Set<string>> } {
    const removals = new Map<string, Set<string>>();
    
    // Remove this NFT from other wallets' domains
    for (const node of graph.getNodes()) {
      if (node.id !== wallet && !assignment.has(node.id)) {
        if (node.hasOption(nft)) {
          if (!removals.has(node.id)) {
            removals.set(node.id, new Set());
          }
          removals.get(node.id)!.add(nft);
          
          // Check if domain becomes empty
          const remainingOptions = node.getOptions().filter(
            ([optionNft]) => optionNft !== nft
          );
          
          if (remainingOptions.length === 0) {
            return { isValid: false, removals };
          }
        }
      }
    }
    
    return { isValid: true, removals };
  }

  /**
   * Select next variable using MRV (Minimum Remaining Values) heuristic
   */
  private selectUnassignedVariable(
    unassigned: Set<string>,
    graph: ConstraintGraph,
    assignment: Assignment
  ): string {
    let minOptions = Infinity;
    let selectedVar = '';
    
    for (const varId of unassigned) {
      const node = graph.getNode(varId);
      if (!node) continue;
      
      // Count valid options
      const validOptions = node.getOptions().filter(
        ([nft]) => this.isConsistent(nft, varId, assignment, graph)
      ).length;
      
      if (validOptions < minOptions) {
        minOptions = validOptions;
        selectedVar = varId;
      }
    }
    
    return selectedVar;
  }

  /**
   * Generate alternative solutions
   */
  private async generateAlternatives(
    graph: ConstraintGraph,
    context: GlobalResolutionContext,
    optimalAssignment: Assignment
  ): Promise<Assignment[]> {
    const alternatives: Assignment[] = [];
    
    // Strategy 1: Try second-best options for each constraint
    for (const node of graph.getNodes()) {
      const currentNft = optimalAssignment.getAssignment(node.id);
      const options = node.getOrderedOptions();
      
      // Find second-best option
      const secondBest = options.find(([nft]) => nft !== currentNft);
      if (secondBest) {
        // Create alternative assignment with this change
        const altAssignment = optimalAssignment.clone();
        altAssignment.assign(node.id, secondBest[0], secondBest[1]);
        
        // Re-solve remaining constraints
        const completed = await this.completePartialAssignment(
          altAssignment,
          graph,
          context
        );
        
        if (completed && alternatives.length < this.MAX_ALTERNATIVES) {
          alternatives.push(completed);
        }
      }
    }
    
    return alternatives;
  }

  /**
   * Complete a partial assignment
   */
  private async completePartialAssignment(
    partial: Assignment,
    graph: ConstraintGraph,
    context: GlobalResolutionContext
  ): Promise<Assignment | null> {
    const unassigned = new Set(
      graph.getNodes()
        .map(n => n.id)
        .filter(id => !partial.has(id))
    );
    
    return this.backtrackSearch(
      partial.clone(),
      unassigned,
      graph,
      context
    );
  }

  /**
   * Score and rank solutions
   */
  private async scoreAndRankSolutions(
    solutions: Assignment[],
    context: GlobalResolutionContext
  ): Promise<GlobalResolutionResult[]> {
    const results: GlobalResolutionResult[] = [];
    
    for (const assignment of solutions) {
      const resolutions = new Map<string, CollectionResolution>();
      let totalScore = 0;
      const values: number[] = [];
      
      // Convert assignment to resolutions
      for (const [wallet, nft] of assignment.getAssignments()) {
        const constraint = context.constraints.find(c => c.walletAddress === wallet);
        if (!constraint) continue;
        
        const resolution: CollectionResolution = {
          collectionId: constraint.collectionId,
          collectionName: constraint.collectionId, // Would fetch actual name
          resolvedNFT: nft,
          alternativeNFTs: constraint.availableNFTs.filter(n => n !== nft).slice(0, 3),
          resolutionReason: 'value_match',
          confidence: assignment.getScore(wallet) || 0.8
        };
        
        resolutions.set(wallet, resolution);
        totalScore += assignment.getScore(wallet) || 0;
        
        // Get NFT value for fairness calculation
        const price = await this.pricingService.estimateNFTPrice(nft);
        values.push(price);
      }
      
      // Calculate fairness score
      const fairnessScore = this.calculateFairness(values);
      
      results.push({
        resolutions,
        totalScore,
        fairnessScore
      });
    }
    
    // Sort by combined score (weighted average)
    results.sort((a, b) => {
      const scoreA = a.totalScore * 0.7 + a.fairnessScore * 0.3;
      const scoreB = b.totalScore * 0.7 + b.fairnessScore * 0.3;
      return scoreB - scoreA;
    });
    
    return results;
  }

  /**
   * Calculate fairness score based on value distribution
   * Uses the same ±10% tolerance as TradeScoreService for consistency
   */
  private calculateFairness(values: number[]): number {
    if (values.length === 0) return 1;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 0;
    
    // Convert CV to a fairness score with ±10% tolerance (consistent with TradeScoreService)
    // CV = 0 means perfect fairness (score = 1.0)
    // CV = 0.10 (10%) means acceptable fairness (score = 0.9)
    // CV >= 0.25 (25%) means poor fairness (score approaches 0)
    if (cv <= 0.10) {
      // Allow up to 10% variance with minimal penalty
      return 1.0 - (cv * 1.0); // Linear penalty up to 10%
    } else {
      // More aggressive penalty for variance above 10%
      return Math.max(0, 0.9 - ((cv - 0.10) * 2.0));
    }
  }

  /**
   * Score an NFT for a specific constraint
   */
  private async scoreNFTForConstraint(
    nft: string,
    constraint: CollectionConstraint,
    context: GlobalResolutionContext
  ): Promise<number> {
    let score = 1.0;
    
    // Factor 1: Price alignment
    if (constraint.preferences?.maxPrice) {
      const price = await this.pricingService.estimateNFTPrice(nft);
      if (price > constraint.preferences.maxPrice) {
        score *= 0.5; // Penalty for exceeding price limit
      }
    }
    
    // Factor 2: Rarity (if available)
    const metadata = context.nftMetadata.get(nft);
    if (metadata && constraint.preferences?.minRarity) {
      // Implement rarity scoring
    }
    
    // Factor 3: Trade context (avoid conflicts)
    if (context.specificWants.has(nft)) {
      // This NFT is specifically wanted by someone else
      score *= 0.8;
    }
    
    return score;
  }

  /**
   * Find NFT conflicts between constraints
   */
  private findConflicts(nfts1: string[], nfts2: string[]): string[] {
    const set1 = new Set(nfts1);
    return nfts2.filter(nft => set1.has(nft));
  }
}

/**
 * Helper classes for constraint satisfaction
 */
class ConstraintGraph {
  private nodes = new Map<string, ConstraintNode>();
  private edges = new Map<string, Map<string, any>>();
  
  addNode(node: ConstraintNode): void {
    this.nodes.set(node.id, node);
    this.edges.set(node.id, new Map());
  }
  
  getNode(id: string): ConstraintNode | undefined {
    return this.nodes.get(id);
  }
  
  getNodes(): ConstraintNode[] {
    return Array.from(this.nodes.values());
  }
  
  addEdge(from: string, to: string, data: any): void {
    this.edges.get(from)?.set(to, data);
    this.edges.get(to)?.set(from, data);
  }
}

class ConstraintNode {
  private options = new Map<string, number>();
  public preferences?: any;
  
  constructor(
    public id: string,
    public collectionId: string,
    public availableNFTs: string[]
  ) {}
  
  addOption(nft: string, score: number): void {
    this.options.set(nft, score);
  }
  
  getOptions(): Array<[string, number]> {
    return Array.from(this.options.entries());
  }
  
  getOrderedOptions(): Array<[string, number]> {
    return this.getOptions().sort((a, b) => b[1] - a[1]);
  }
  
  hasOption(nft: string): boolean {
    return this.options.has(nft);
  }
}

class Assignment {
  private assignments = new Map<string, { nft: string; score: number }>();
  
  assign(wallet: string, nft: string, score: number): void {
    this.assignments.set(wallet, { nft, score });
  }
  
  unassign(wallet: string): void {
    this.assignments.delete(wallet);
  }
  
  has(wallet: string): boolean {
    return this.assignments.has(wallet);
  }
  
  getAssignment(wallet: string): string | undefined {
    return this.assignments.get(wallet)?.nft;
  }
  
  getScore(wallet: string): number | undefined {
    return this.assignments.get(wallet)?.score;
  }
  
  getAssignments(): Array<[string, string]> {
    return Array.from(this.assignments.entries()).map(
      ([wallet, data]) => [wallet, data.nft]
    );
  }
  
  clone(): Assignment {
    const cloned = new Assignment();
    for (const [wallet, data] of this.assignments) {
      cloned.assign(wallet, data.nft, data.score);
    }
    return cloned;
  }
} 