import { NFTMetadata } from '../types/nft';
import { Helius } from 'helius-sdk';
import { LoggingService, Logger } from '../utils/logging/LoggingService';
import { injectable, inject } from 'tsyringe';
import { ITradeDiscoveryService } from '../types/services';

interface WalletNode {
  address: string;
  ownedNfts: Set<string>;  // NFTs owned by this wallet
  wantedNfts: Set<string>; // NFTs this wallet wants
  rejectedNfts: Set<string>; // NFTs this wallet has rejected
  rejectedWallets: Set<string>; // Wallets this wallet has rejected
}

interface TradeRequest {
  walletAddress: string;
  hasNft: string;
  wantsNft: string;
  timestamp: Date;
}

interface DiscoveredTradeLoop {
  path: string[];
  nftPath: string[];
  efficiency: number;
  score?: number; // Optional comprehensive score
}

// Track NFT demand frequency
interface NFTDemandMetrics {
  mint: string;
  requestCount: number;
  lastRequested: Date;
  score?: number; // Comprehensive score for ranking
}

// Add NFT values for fairness calculations
interface NFTValueRecord {
  mint: string;
  estimatedValue: number;
}

export interface TradeLoop {
  id: string;
  steps: {
    from: string;
    to: string;
    nfts: Array<{
      address: string;
      name: string;
      symbol: string;
      image: string;
      collection: string;
      description: string;
    }>;
  }[];
  totalParticipants: number;
  efficiency: number;
  estimatedValue: number;
  score?: number; // Comprehensive score for ranking
}

@injectable()
export class TradeDiscoveryService implements ITradeDiscoveryService {
  private wallets: Map<string, WalletNode> = new Map();
  private helius: Helius;
  private tradePool: TradeRequest[] = [];
  private readonly MAX_DEPTH = 11;
  private readonly MIN_EFFICIENCY = 0.7;
  private nftDemandMetrics: Map<string, NFTDemandMetrics> = new Map();
  private nftValueRecords: Map<string, NFTValueRecord> = new Map();
  private logger: Logger;

  constructor(@inject("Helius") helius: Helius, @inject("ILoggingService") loggingService: LoggingService) {
    this.logger = loggingService.createLogger('TradeDiscoveryService');
    this.helius = helius;
    this.logger.info('TradeDiscoveryService initialized');
  }

  /**
   * Gets all NFTs owned by a wallet using Helius
   */
  public async getWalletNFTs(walletAddress: string): Promise<string[]> {
    try {
      this.logger.info('Fetching NFTs for wallet', { walletAddress });
      const response = await this.helius.rpc.getAssetsByOwner({
        ownerAddress: walletAddress,
        page: 1,
        limit: 1000,
        displayOptions: {
          showCollectionMetadata: true,
        },
      });

      if (!response?.items) {
        this.logger.info('No NFTs found for wallet', { walletAddress });
        return [];
      }

      const nftAddresses = response.items.map((asset: any) => asset.id);
      this.logger.info('Found NFTs', { walletAddress, count: nftAddresses.length, nftAddresses });
      return nftAddresses;
    } catch (error) {
      this.logger.error('Error fetching wallet NFTs', { walletAddress, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Updates wallet state with real NFT data
   */
  public async updateWalletState(
    walletAddress: string,
    forceRefresh?: boolean
  ): Promise<any> {
    try {
      const ownedNfts = await this.getWalletNFTs(walletAddress);
      
      // Update or create wallet state
      const existingWallet = this.wallets.get(walletAddress);
      if (existingWallet) {
        // Update owned NFTs
        ownedNfts.forEach(nft => existingWallet.ownedNfts.add(nft));
        // If not a force refresh, we keep existing wanted NFTs
        if (!forceRefresh && existingWallet.wantedNfts.size > 0) {
          this.logger.info('Keeping existing wanted NFTs', {
            walletAddress,
            wantedCount: existingWallet.wantedNfts.size
          });
        } else {
          // Clear wanted NFTs if force refresh
          if (forceRefresh) {
            existingWallet.wantedNfts.clear();
          }
        }
      } else {
        // Create new wallet state with rejection sets
        this.wallets.set(walletAddress, {
          address: walletAddress,
          ownedNfts: new Set(ownedNfts),
          wantedNfts: new Set(),
          rejectedNfts: new Set(),
          rejectedWallets: new Set()
        });
      }

      this.logger.info('Updated wallet state', {
        address: walletAddress,
        ownedCount: ownedNfts.length,
        wantedCount: existingWallet ? existingWallet.wantedNfts.size : 0
      });

      return this.wallets.get(walletAddress);
    } catch (error) {
      this.logger.error('Error updating wallet state', { walletAddress, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Find trade loops involving a specific wallet
   */
  public async findTradesForWallet(walletAddress: string, options?: any): Promise<any[]> {
    this.logger.info('Finding trades for wallet', { walletAddress });
    const trades = await this.findTradeLoops();
    return trades.filter(trade => 
      trade.steps.some(step => step.from === walletAddress || step.to === walletAddress)
    );
  }
  
  /**
   * Find all possible trade loops in the system
   */
  public async findAllTrades(options?: any): Promise<any[]> {
    this.logger.info('Finding all trades');
    return this.findTradeLoops();
  }
  
  /**
   * Add a trade preference (wallet wants NFT)
   */
  public async addTradePreference(walletAddress: string, wantedNFT: string): Promise<void> {
    this.logger.info('Adding trade preference', { walletAddress, wantedNFT });
    // First ensure the wallet exists
    if (!this.wallets.has(walletAddress)) {
      await this.updateWalletState(walletAddress, false);
      await this.addWantedNFTs(walletAddress, [wantedNFT]);
    } else {
      // Just add the wanted NFT to existing wallet
      await this.addWantedNFTs(walletAddress, [wantedNFT]);
    }
  }
  
  /**
   * Reject a trade
   */
  public async rejectTrade(walletAddress: string, nftOrWalletToReject: string, isNft: boolean): Promise<void> {
    this.logger.info('Rejecting trade', { walletAddress, nftOrWalletToReject, isNft });
    if (isNft) {
      this.addRejection(walletAddress, nftOrWalletToReject);
    } else {
      this.addRejection(walletAddress, undefined, nftOrWalletToReject);
    }
  }

  /**
   * Adds or updates a trade request
   */
  public addTradeRequest(walletAddress: string, hasNft: string, wantsNft: string): void {
    this.logger.info('Adding trade request', { walletAddress, hasNft, wantsNft });

    // Update NFT demand metrics
    this.updateNftDemandMetrics(wantsNft);

    // Check if this exact trade request already exists
    const existingRequest = this.tradePool.find(
      req => req.walletAddress === walletAddress && 
             req.hasNft === hasNft && 
             req.wantsNft === wantsNft
    );

    if (!existingRequest) {
      // Add to trade pool
      this.tradePool.push({
        walletAddress,
        hasNft,
        wantsNft,
        timestamp: new Date()
      });

      // Update or create wallet state
      const existingWallet = this.wallets.get(walletAddress);
      if (existingWallet) {
        // Only add if not already present
        if (!existingWallet.ownedNfts.has(hasNft)) {
          existingWallet.ownedNfts.add(hasNft);
        }
        if (!existingWallet.wantedNfts.has(wantsNft)) {
          existingWallet.wantedNfts.add(wantsNft);
        }
      } else {
        // Create new wallet state with rejection sets
        this.wallets.set(walletAddress, {
          address: walletAddress,
          ownedNfts: new Set([hasNft]),
          wantedNfts: new Set([wantsNft]),
          rejectedNfts: new Set(),
          rejectedWallets: new Set()
        });
      }

      this.logger.debug('Current trade pool size', { size: this.tradePool.length });
      const wallet = this.wallets.get(walletAddress);
      this.logger.debug('Wallet state after update', {
          walletAddress,
          ownedNfts: wallet ? Array.from(wallet.ownedNfts) : [],
          wantedNfts: wallet ? Array.from(wallet.wantedNfts) : []
      });

    } else {
      this.logger.info('Trade request already exists, skipping', { walletAddress, hasNft, wantsNft });
    }
  }

  private findTradeLoopsDFS(
    currentWallet: string,
    visited: Set<string>,
    currentPath: string[],
    nftPath: string[],
    loops: DiscoveredTradeLoop[],
    startWallet: string,
    depth: number = 0
  ): void {
    if (depth >= this.MAX_DEPTH) {
      this.logger.debug(`Max depth reached for path`, { maxDepth: this.MAX_DEPTH, path: currentPath });
      return;
    }
    
    visited.add(currentWallet);
    currentPath.push(currentWallet);

    const currentNode = this.wallets.get(currentWallet);
    if (!currentNode) {
      this.logger.warn(`No node found for wallet during DFS`, { walletAddress: currentWallet, path: currentPath });
      visited.delete(currentWallet);
      currentPath.pop();
      return;
    }

    this.logger.debug(`Exploring wallet at depth`, { currentWallet, depth, path: currentPath, nftPath });
    this.logger.debug('Current node state', {
        ownedNfts: Array.from(currentNode.ownedNfts),
        wantedNfts: Array.from(currentNode.wantedNfts)
    });

    // For each NFT the current wallet owns
    for (const ownedNft of currentNode.ownedNfts) {
      this.logger.debug(`Checking owned NFT`, { ownedNft });
      
      // Find wallets that want this NFT
      for (const [nextWallet, nextNode] of this.wallets.entries()) {
        // Allow revisiting start wallet to complete the loop
        if (visited.has(nextWallet) && nextWallet !== startWallet) {
          // this.logger.debug(`Skipping visited wallet`, { nextWallet }); // Too verbose
          continue;
        }

        // Skip if current wallet has rejected the next wallet
        if (currentNode.rejectedWallets.has(nextWallet)) {
          this.logger.debug(`Skipping rejected wallet (sender rejection)`, { sender: currentWallet, rejected: nextWallet });
          continue;
        }

        // Skip if next wallet has rejected the current wallet
        if (nextNode.rejectedWallets.has(currentWallet)) {
          this.logger.debug(`Skipping rejected wallet (receiver rejection)`, { receiver: nextWallet, rejected: currentWallet });
          continue;
        }

        // Skip if next wallet has rejected this NFT
        if (nextNode.rejectedNfts.has(ownedNft)) {
          this.logger.debug(`Skipping rejected NFT`, { receiver: nextWallet, rejectedNft: ownedNft });
          continue;
        }

        if (nextNode.wantedNfts.has(ownedNft)) {
          this.logger.debug(`Found potential next step`, { from: currentWallet, to: nextWallet, viaNft: ownedNft });

          // If we found a path back to start and it's valid
          if (nextWallet === startWallet && currentPath.length >= 2) {
            this.logger.debug(`Found potential loop back to start wallet`, { startWallet });
            // Check if the start wallet wants the NFT we're offering
            const startNode = this.wallets.get(startWallet);
            // Assumption: The last NFT in the path is the one offered back to the start
            const nftOfferedToStart = nftPath.length > 0 ? nftPath[nftPath.length - 1] : null;
            // Correction: The NFT offered TO the start wallet is the one the *previous* wallet (currentWallet) owns.
            const finalOwnedNft = ownedNft; // The NFT currentWallet is offering

            // Let's rethink: If nextWallet IS startWallet, the path completes.
            // The NFT completing the loop is `ownedNft` (from currentWallet to startWallet).
            // We need to ensure the *FIRST* NFT in nftPath is wanted by currentWallet.

            // Let's simplify the check: Does the `startWallet` actually *want* the `ownedNft` offered by `currentWallet`?
            // This seems redundant with the initial `nextNode.wantedNfts.has(ownedNft)` check when nextNode IS startNode.
            // The primary check is whether the loop is valid based on rejections and efficiency.

            const efficiency = this.calculateEfficiency(currentPath);
            this.logger.debug(`Calculated loop efficiency`, { efficiency, path: currentPath });

            // Check for rejections in the entire path
            // We need the NFT path to check rejections correctly.
            // When completing the loop, the final NFT is ownedNft.
            const completeNftPath = [...nftPath, ownedNft];
            const hasRejection = this.hasRejections(currentPath, completeNftPath);

            if (!hasRejection && efficiency >= this.MIN_EFFICIENCY) {
              const loop: DiscoveredTradeLoop = {
                // Add startWallet again to close the path visually/logically
                path: [...currentPath, startWallet],
                nftPath: completeNftPath,
                efficiency,
                score: 0 // Will be calculated next
              };

              // Calculate comprehensive score
              loop.score = this.calculateLoopScore(loop);

              loops.push(loop);
              this.logger.info(`Found valid trade loop`, { loopId: loop.path.join('->'), efficiency: loop.efficiency, score: loop.score, path: loop.path, nftPath: loop.nftPath });
            } else if (hasRejection) {
              this.logger.debug(`Loop contains rejections, skipping`, { path: currentPath, nftPath: completeNftPath });
            } else {
              this.logger.debug(`Loop efficiency below minimum threshold`, { efficiency, minEfficiency: this.MIN_EFFICIENCY, path: currentPath });
            }
            // Removed redundant startNode check as it's covered by the general logic
          }
          
          // Continue searching for other potential loops
          if (nextWallet !== startWallet) {
            this.logger.debug(`Continuing search to next wallet`, { nextWallet });
            nftPath.push(ownedNft);
            this.findTradeLoopsDFS(nextWallet, visited, currentPath, nftPath, loops, startWallet, depth + 1);
            nftPath.pop();
          }
        } // else { this.logger.debug(`Wallet ${nextWallet} does not want NFT ${ownedNft}`); } // Too verbose
      }
    }

    visited.delete(currentWallet);
    currentPath.pop();
    // this.logger.debug(`Backtracking from wallet`, { currentWallet }); // Can be verbose
  }

  /**
   * Find potential trade loops
   */
  public async findTradeLoops(): Promise<TradeLoop[]> {
    const operation = this.logger.operation('findTradeLoops');
    operation.info('Finding trade loops', { poolSize: this.tradePool.length, walletCount: this.wallets.size });

    // Log detailed wallet states (consider DEBUG level)
    // operation.info('Detailed Wallet States:', { wallets: Object.fromEntries(this.wallets) }); // Can be very large

    if (this.tradePool.length < 2) {
      operation.info('Not enough trade requests to form a loop. Need at least 2 requests.');
      operation.end();
      return [];
    }

    // Check if any trade requests can form a loop
    let hasMatchingTrades = false;
    // Optimized check: Build a map of wanted NFTs to wallets wanting them
    const wantedMap = new Map<string, Set<string>>();
    this.wallets.forEach((node, address) => {
        node.wantedNfts.forEach(nft => {
            if (!wantedMap.has(nft)) wantedMap.set(nft, new Set());
            wantedMap.get(nft)?.add(address);
        });
    });

    for (const [address, node] of this.wallets.entries()) {
        for (const ownedNft of node.ownedNfts) {
            if (wantedMap.has(ownedNft)) {
                const potentialMatches = wantedMap.get(ownedNft);
                if (potentialMatches && potentialMatches.size > 0) {
                    // Check if any wanter is not the owner itself
                    const otherWanterExists = Array.from(potentialMatches).some(wanter => wanter !== address);
                    if (otherWanterExists) {
                        hasMatchingTrades = true;
                        operation.info('Found potential matching trades', { owner: address, ownedNft });
                        break;
                    }
                }
            }
        }
        if (hasMatchingTrades) break;
    }

    if (!hasMatchingTrades) {
      operation.info('No matching trades found that could form a loop.');
      operation.end();
      return [];
    }

    const visited = new Set<string>();
    const currentPath: string[] = [];
    const nftPath: string[] = [];
    const loops: DiscoveredTradeLoop[] = [];

    // Start DFS from each wallet that has trade requests
    const uniqueWallets = new Set<string>();
    this.wallets.forEach((node, address) => {
        // Start DFS only if the wallet has both owned and wanted NFTs involved in potential trades
        if (node.ownedNfts.size > 0 && node.wantedNfts.size > 0) {
             uniqueWallets.add(address);
        }
    });

    operation.info('Starting DFS from candidate wallets', { wallets: Array.from(uniqueWallets) });

    for (const walletAddress of uniqueWallets) {
      operation.info(`Starting DFS from root wallet`, { walletAddress });
      this.findTradeLoopsDFS(
        walletAddress,
        new Set<string>(), // Use a new visited set for each root DFS
        [], // Use a new path for each root DFS
        [], // Use a new nftPath for each root DFS
        loops,
        walletAddress
      );
    }

    if (loops.length === 0) {
      operation.info('No valid trade loops found that meet efficiency criteria.');
      operation.end();
      return [];
    }

    operation.info(`Found trade loops`, { count: loops.length });
    // operation.debug('Raw trade loops found', { loops }); // Can be large

    // Sort loops by score first, then efficiency as a tiebreaker
    const formattedLoops = loops
      .sort((a, b) => {
        // Sort by score if available, otherwise fall back to efficiency
        if (a.score !== undefined && b.score !== undefined) {
          return b.score - a.score;
        }
        return b.efficiency - a.efficiency;
      })
      .map((loop, index) => {
        // Pass the complete path including the closing node to convertPathToSteps
        const steps = this.convertPathToSteps(loop.path, loop.nftPath);
        operation.info(`Converting loop to steps`, { loopIndex: index, stepsCount: steps.length });
        return {
          id: `trade-${Date.now()}-${index}`,
          steps,
          totalParticipants: loop.path.length,
          efficiency: loop.efficiency,
          estimatedValue: this.calculateEstimatedValue(),
          score: loop.score
        };
      });

    operation.info('Formatted trade loops prepared', { count: formattedLoops.length });
    // operation.info('Formatted trade loops:', { formattedLoops }); // Can be large
    operation.end();
    return formattedLoops;
  }

  private calculateEfficiency(walletPath: string[]): number {
    // Simple efficiency calculation based on path length
    const maxLength = this.MAX_DEPTH;
    return 1 - (walletPath.length - 2) / maxLength;
  }

  private calculateEstimatedValue(): number {
    // Calculate based on NFT value records
    const baseValue = 0.05; // Base value in SOL
    // Return a more realistic value based on average floor prices
    return this.nftValueRecords.size > 0
      ? Array.from(this.nftValueRecords.values()).reduce((sum, record) => sum + record.estimatedValue, 0) / 
        this.nftValueRecords.size
      : baseValue;
  }

  private convertPathToSteps(walletPath: string[], nftPath: string[]): TradeLoop['steps'] {
    const steps: TradeLoop['steps'] = [];
    // Iterate up to walletPath.length - 1 because the last element closes the loop
    for (let i = 0; i < walletPath.length - 1; i++) {
      const fromWallet = walletPath[i];
      const toWallet = walletPath[i + 1];
      // Ensure nftPath has an element for this step
      if (i >= nftPath.length) {
          this.logger.error('NFT path length mismatch during step conversion', { stepIndex: i, walletPath, nftPath });
          // Handle error appropriately, maybe skip this step or throw
          continue;
      }
      const nft = nftPath[i];

      this.logger.debug(`Creating step`, { index: i, fromWallet, toWallet, nft });

      steps.push({
        from: fromWallet,
        to: toWallet,
        nfts: [{
          address: nft,
          name: `NFT ${i + 1}`,
          symbol: 'NFT',
          image: 'https://picsum.photos/200',
          collection: 'Sample Collection',
          description: 'Sample NFT for trade loop'
        }]
      });
    }
    return steps;
  }

  // Add method to check pool state
  public getPoolState(): { 
    size: number; 
    requests: TradeRequest[]; 
    wallets: Map<string, WalletNode>;
  } {
    // Avoid logging potentially sensitive/large wallet data by default
    this.logger.info('Getting pool state', { poolSize: this.tradePool.length, walletCount: this.wallets.size });
    return {
      size: this.tradePool.length,
      requests: this.tradePool,
      wallets: this.wallets
    };
  }

  // Add method to clear pool (only for testing)
  public clearPool(): void {
    this.logger.warn('Clearing trade pool and wallet state (intended for testing)');
    this.tradePool = [];
    this.wallets.clear();
    this.nftDemandMetrics.clear();
    this.nftValueRecords.clear();
  }

  private updateNftDemandMetrics(nft: string): void {
    const existing = this.nftDemandMetrics.get(nft);
    if (existing) {
      existing.requestCount += 1;
      existing.lastRequested = new Date();
    } else {
      this.nftDemandMetrics.set(nft, {
        mint: nft,
        requestCount: 1,
        lastRequested: new Date()
      });
    }
  }

  /**
   * Record a rejection of an NFT or wallet by a user
   * @param walletAddress The wallet rejecting the NFT or other wallet
   * @param nftAddress Optional NFT address being rejected
   * @param rejectedWallet Optional wallet address being rejected
   */
  public addRejection(walletAddress: string, nftAddress?: string, rejectedWallet?: string): void {
    const operation = this.logger.operation('addRejection');
    operation.info('Adding rejection', { walletAddress, rejectedNft: nftAddress, rejectedWallet });

    const wallet = this.wallets.get(walletAddress);
    if (wallet) {
      if (nftAddress) {
        wallet.rejectedNfts.add(nftAddress);
        operation.info(`Added NFT to rejection list`, { walletAddress, rejectedNft: nftAddress });
      }
      if (rejectedWallet) {
        wallet.rejectedWallets.add(rejectedWallet);
        operation.info(`Added wallet to rejection list`, { walletAddress, rejectedWallet });
      }
    } else {
      operation.warn(`No wallet state found, creating new one with rejection`, { walletAddress });
      // Create new wallet with rejection
      this.wallets.set(walletAddress, {
        address: walletAddress,
        ownedNfts: new Set(),
        wantedNfts: new Set(),
        rejectedNfts: new Set(nftAddress ? [nftAddress] : []),
        rejectedWallets: new Set(rejectedWallet ? [rejectedWallet] : [])
      });
    }
    operation.end();
  }

  /**
   * Estimate NFT value based on demand metrics and existing data
   * In a production system, this would use real market data
   */
  private estimateNftValue(nft: string): number {
    const existingRecord = this.nftValueRecords.get(nft);
    if (existingRecord) {
      return existingRecord.estimatedValue;
    }

    const demandMetric = this.nftDemandMetrics.get(nft);
    // Base value between 1 and 10 SOL
    const baseValue = 1 + Math.random() * 9;
    
    // Adjust based on demand, if available
    const demandMultiplier = demandMetric 
      ? Math.min(2, 1 + (demandMetric.requestCount / 10))
      : 1;
    
    const estimatedValue = baseValue * demandMultiplier;
    
    // Store for future reference
    this.nftValueRecords.set(nft, {
      mint: nft,
      estimatedValue
    });
    
    return estimatedValue;
  }

  /**
   * Check if a path contains any rejected NFTs or wallets
   */
  private hasRejections(path: string[], nftPath: string[]): boolean {
    // Check each step in the path for rejections
    // Iterate up to path.length - 1 because the last element closes the loop
    for (let i = 0; i < path.length - 1; i++) {
      const fromWallet = path[i];
      const toWallet = path[i + 1];
       // Ensure nftPath has an element for this step
      if (i >= nftPath.length) {
          this.logger.error('NFT path length mismatch during rejection check', { stepIndex: i, path, nftPath });
          return true; // Treat mismatch as a potential issue / rejection
      }
      const nft = nftPath[i];

      const fromWalletNode = this.wallets.get(fromWallet);
      const toWalletNode = this.wallets.get(toWallet);

      if (fromWalletNode) {
        // Check if this wallet has rejected the recipient
        if (fromWalletNode.rejectedWallets.has(toWallet)) {
          this.logger.debug(`Rejection found: Sender rejected receiver`, { fromWallet, toWallet });
          return true;
        }
      }

      if (toWalletNode) {
        // Check if recipient has rejected this NFT
        if (toWalletNode.rejectedNfts.has(nft)) {
          this.logger.debug(`Rejection found: Receiver rejected NFT`, { toWallet, nft });
          return true;
        }

        // Check if recipient has rejected the sender
        if (toWalletNode.rejectedWallets.has(fromWallet)) {
          this.logger.debug(`Rejection found: Receiver rejected sender`, { toWallet, fromWallet });
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Calculate fairness score based on value distribution
   * Uses the same ±10% tolerance as TradeScoreService for consistency
   */
  private calculateFairness(loop: DiscoveredTradeLoop): number {
    if (loop.path.length <= 2) return 1; // Direct trade is always fair
    
    const values: number[] = [];
    
    // Calculate values each participant receives
    for (let i = 0; i < loop.nftPath.length; i++) {
      const nft = loop.nftPath[i];
      values.push(this.estimateNftValue(nft));
    }
    
    // Calculate coefficient of variation (standard deviation / mean)
    // Lower variation means more fair distribution
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
   * Calculate demand score based on NFT popularity
   */
  private calculateDemandScore(nftPath: string[]): number {
    let totalDemand = 0;
    
    for (const nft of nftPath) {
      const metric = this.nftDemandMetrics.get(nft);
      const demand = metric ? metric.requestCount : 0;
      totalDemand += demand;
    }
    
    // Normalize by the number of NFTs and max possible demand
    const avgDemand = totalDemand / nftPath.length;
    const maxPossibleDemand = 10; // Arbitrary max for normalization
    
    return Math.min(1, avgDemand / maxPossibleDemand);
  }

  /**
   * Calculate value efficiency (minimizing value differentials)
   */
  private calculateValueEfficiency(loop: DiscoveredTradeLoop): number {
    if (loop.path.length <= 2) return 1; // Direct trade is always efficient
    
    let totalDiff = 0;
    let prevValue = 0;
    
    // Calculate value differentials between consecutive steps
    for (let i = 0; i < loop.nftPath.length; i++) {
      const nft = loop.nftPath[i];
      const value = this.estimateNftValue(nft);
      
      if (i > 0) {
        totalDiff += Math.abs(value - prevValue);
      }
      
      prevValue = value;
    }
    
    // Last step back to first
    if (loop.nftPath.length > 0) {
      const firstValue = this.estimateNftValue(loop.nftPath[0]);
      totalDiff += Math.abs(firstValue - prevValue);
    }
    
    // Average differential as percentage of total value
    const totalValue = loop.nftPath.reduce((sum, nft) => sum + this.estimateNftValue(nft), 0);
    const avgDiff = totalDiff / loop.path.length;
    
    // Lower differential ratio is better
    const diffRatio = totalValue > 0 ? avgDiff / (totalValue / loop.path.length) : 0;
    
    return Math.max(0, 1 - diffRatio);
  }

  /**
   * Calculate a comprehensive trade loop score
   */
  private calculateLoopScore(loop: DiscoveredTradeLoop): number {
    // Length score (shorter is better)
    const lengthScore = this.calculateEfficiency(loop.path);
    
    // Fairness score
    const fairnessScore = this.calculateFairness(loop);
    
    // Demand score
    const demandScore = this.calculateDemandScore(loop.nftPath);
    
    // Value efficiency score
    const valueScore = this.calculateValueEfficiency(loop);
    
    // Weighted combination (weights can be adjusted)
    const score = (lengthScore * 0.3) + (fairnessScore * 0.3) + 
                 (demandScore * 0.2) + (valueScore * 0.2);

    this.logger.debug(`Scoring loop`, {
        path: loop.path,
        lengthScore: lengthScore.toFixed(2),
        fairnessScore: fairnessScore.toFixed(2),
        demandScore: demandScore.toFixed(2),
        valueScore: valueScore.toFixed(2),
        finalScore: score.toFixed(2)
    });

    return score;
  }

  /**
   * Prepare a trade loop for smart contract consumption
   * Returns a compact representation suitable for on-chain storage
   */
  public prepareLoopForContract(tradeLoop: TradeLoop): {
    participants: string[];
    nfts: string[];
    serialized: string;
  } {
    const participants: string[] = [];
    const nfts: string[] = [];
    
    // Extract participants and NFTs from the trade loop
    for (const step of tradeLoop.steps) {
      participants.push(step.from);
      // Add the first NFT from each step
      if (step.nfts && step.nfts.length > 0) {
        nfts.push(step.nfts[0].address);
      } else {
        throw new Error(`Step is missing NFT data`);
      }
    }
    
    // Add the last recipient to close the loop
    if (tradeLoop.steps.length > 0) {
      const lastStep = tradeLoop.steps[tradeLoop.steps.length - 1];
      participants.push(lastStep.to);
    }

    // Basic serialization for demonstration
    // In a real implementation, this would use a more efficient encoding
    const serialized = JSON.stringify({
      id: tradeLoop.id,
      participants,
      nfts,
      expiry: Math.floor(Date.now() / 1000) + 86400 // 24 hours from now
    });
    
    console.log('Serialized trade loop data size:', Buffer.from(serialized).length, 'bytes');
    
    // Solana's account size limits would need to be checked here
    const MAX_ACCOUNT_SIZE = 10 * 1024; // 10 KB example limit
    if (Buffer.from(serialized).length > MAX_ACCOUNT_SIZE) {
      console.warn('Warning: Serialized trade loop exceeds recommended account size limit');
    }
    
    return {
      participants,
      nfts,
      serialized
    };
  }

  /**
   * Get current system state metrics
   */
  public getSystemState(): { wallets: number; nfts: number; wanted: number } {
    return {
      wallets: this.wallets.size,
      nfts: this.getNFTCount(),
      wanted: this.getWantedNFTCount()
    };
  }

  /**
   * Get count of NFTs in the system
   */
  private getNFTCount(): number {
    // Count unique NFTs owned by all wallets
    const uniqueNfts = new Set<string>();
    for (const wallet of this.wallets.values()) {
      for (const nft of wallet.ownedNfts) {
        uniqueNfts.add(nft);
      }
    }
    return uniqueNfts.size;
  }

  /**
   * Get count of wanted NFTs in the system
   */
  private getWantedNFTCount(): number {
    // Count unique wanted NFTs across all wallets
    const uniqueWantedNfts = new Set<string>();
    for (const wallet of this.wallets.values()) {
      for (const nft of wallet.wantedNfts) {
        uniqueWantedNfts.add(nft);
      }
    }
    return uniqueWantedNfts.size;
  }

  /**
   * Clear all system state
   */
  public clearState(): void {
    this.logger.info('Clearing trade discovery state');
    this.wallets.clear();
    this.tradePool = [];
    this.nftDemandMetrics.clear();
    this.nftValueRecords.clear();
    this.logger.info('Trade discovery state cleared');
  }

  /**
   * Get all trade keys in the system
   */
  public async getAllTradeKeys(): Promise<string[]> {
    this.logger.info('Getting all trade keys');
    // Return an empty array for now - in a real system this would access persistence
    return [];
  }

  /**
   * Get a stored trade loop by ID
   */
  public async getStoredTradeLoop(tradeId: string): Promise<any | null> {
    this.logger.info('Getting stored trade loop', { tradeId });
    // Return null for now - in a real system this would access persistence
    return null;
  }

  /**
   * Get trades for a specific wallet
   */
  public async getTradesForWallet(walletAddress: string): Promise<any[]> {
    this.logger.info('Getting trades for wallet', { walletAddress });
    return this.findTradesForWallet(walletAddress);
  }

  /**
   * Add wanted NFTs to a wallet
   */
  public async addWantedNFTs(walletAddress: string, wantedNfts: string[]): Promise<void> {
    // Update or create wallet state
    const existingWallet = this.wallets.get(walletAddress);
    if (existingWallet) {
      // Update wanted NFTs
      wantedNfts.forEach(nft => {
        existingWallet.wantedNfts.add(nft);
        this.updateNftDemandMetrics(nft);
      });
    } else {
      // Create new wallet state with rejection sets
      this.wallets.set(walletAddress, {
        address: walletAddress,
        ownedNfts: new Set(),
        wantedNfts: new Set(wantedNfts),
        rejectedNfts: new Set(),
        rejectedWallets: new Set()
      });
      
      // Update demand metrics for wanted NFTs
      wantedNfts.forEach(nft => this.updateNftDemandMetrics(nft));
    }

    this.logger.info('Added wanted NFTs', {
      address: walletAddress,
      wantedCount: wantedNfts.length
    });
  }

  /**
   * Get detailed system state
   */
  public getDetailedSystemState(): any {
    const basicState = this.getSystemState();
    
    return {
      ...basicState,
      nftDemandMetrics: Array.from(this.nftDemandMetrics.values()),
      nftValueRecords: Array.from(this.nftValueRecords.values()),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Perform a deep scan of a wallet's NFTs
   */
  public async deepScanWalletNFTs(walletAddress: string): Promise<string[]> {
    this.logger.info('Deep scanning wallet NFTs', { walletAddress });
    return this.getWalletNFTs(walletAddress);
  }

  /**
   * Store a trade loop
   */
  public async storeTradeLoop(tradeId: string, steps: any[], metadata?: any): Promise<void> {
    this.logger.info('Storing trade loop', { 
      tradeId, 
      steps: steps.length,
      hasMetadata: !!metadata
    });
    // Implement persistence in a real system
  }

  /**
   * Get NFT ownership map
   */
  public getNFTOwnershipMap(): Record<string, string> {
    this.logger.info('Getting NFT ownership map');
    const result: Record<string, string> = {};
    
    // Map all NFTs to their owners
    for (const [walletAddress, wallet] of this.wallets.entries()) {
      for (const nft of wallet.ownedNfts) {
        result[nft] = walletAddress;
      }
    }
    
    return result;
  }

  /**
   * Get wallets map
   */
  public getWallets(): Map<string, any> {
    return this.wallets;
  }

  /**
   * Register manually owned NFTs
   */
  public registerManualNFTs(walletAddress: string, nftAddresses: string[]): void {
    this.logger.info('Registering manual NFTs', { walletAddress, count: nftAddresses.length });
    
    // Get or create wallet
    const wallet = this.wallets.get(walletAddress) || {
      address: walletAddress,
      ownedNfts: new Set<string>(),
      wantedNfts: new Set<string>(),
      rejectedNfts: new Set<string>(),
      rejectedWallets: new Set<string>()
    };
    
    // Add NFTs to the wallet
    for (const nft of nftAddresses) {
      wallet.ownedNfts.add(nft);
    }
    
    // Save wallet
    this.wallets.set(walletAddress, wallet);
  }

  /**
   * Get rejection preferences for a wallet
   */
  public getRejections(walletAddress: string): any {
    const wallet = this.wallets.get(walletAddress);
    if (!wallet) return null;
    
    return {
      nfts: wallet.rejectedNfts,
      wallets: wallet.rejectedWallets
    };
  }

  /**
   * Store rejection preferences for a wallet
   */
  public storeRejections(walletAddress: string, rejections: any): void {
    let wallet = this.wallets.get(walletAddress);
    
    if (!wallet) {
      wallet = {
        address: walletAddress,
        ownedNfts: new Set<string>(),
        wantedNfts: new Set<string>(),
        rejectedNfts: new Set<string>(),
        rejectedWallets: new Set<string>()
      };
      this.wallets.set(walletAddress, wallet);
    }
    
    if (rejections.nfts) {
      rejections.nfts.forEach((nft: string) => wallet!.rejectedNfts.add(nft));
    }
    
    if (rejections.wallets) {
      rejections.wallets.forEach((rejectedWallet: string) => wallet!.rejectedWallets.add(rejectedWallet));
    }
    
    this.logger.info('Stored rejection preferences', { walletAddress });
  }

  /**
   * Record a completed trade step
   */
  public async recordTradeStepCompletion(tradeId: string, stepIndex: number, completionData: any): Promise<void> {
    this.logger.info('Recording trade step completion', { tradeId, stepIndex });
    // In a real implementation, this would store the completion data for the trade step
  }

  /**
   * Check if a wallet exists in the system
   */
  public walletExists(walletAddress: string): boolean {
    return this.wallets.has(walletAddress);
  }

  /**
   * Add a collection-level want preference
   */
  public async addCollectionWant(walletAddress: string, collectionId: string): Promise<void> {
    this.logger.info('Adding collection want', { walletAddress, collectionId });
    // For this simplified implementation, we'll just log it
    // In a full implementation, this would integrate with collection services
  }

  /**
   * Get wanted NFTs map
   */
  public getWantedNfts(): Map<string, Set<string>> {
    const wantedNfts = new Map<string, Set<string>>();
    
    // Build a map from NFT address to set of wallets that want it
    for (const [walletAddress, wallet] of this.wallets.entries()) {
      for (const nft of wallet.wantedNfts) {
        if (!wantedNfts.has(nft)) {
          wantedNfts.set(nft, new Set<string>());
        }
        wantedNfts.get(nft)!.add(walletAddress);
      }
    }
    
    return wantedNfts;
  }

  /**
   * Get the collection abstraction service instance
   */
  public getCollectionAbstractionService(): any {
    this.logger.info('Getting collection abstraction service');
    // Return null for this simplified implementation
    // In a full implementation, this would return a proper service instance
    return null;
  }
} 