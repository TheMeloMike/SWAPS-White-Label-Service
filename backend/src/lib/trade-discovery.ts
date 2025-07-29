import { Helius } from 'helius-sdk';
import { PersistenceManager } from './persistence';

interface WalletState {
  address: string;
  ownedNfts: Set<string>;
  wantedNfts: Set<string>;
  lastUpdated: Date;
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
    completed?: boolean;
    completedAt?: Date;
    transactionSignature?: string;
  }[];
  totalParticipants: number;
  efficiency: number;
  estimatedValue: number;
  score?: number; // Optional score for ranking
  status?: string;
  progress?: number;
  createdAt?: Date;
  expiresAt?: Date;
  completedAt?: Date;
  overallStatus?: string;
}

interface RejectionPreferences {
  nfts: Set<string>;
  wallets: Set<string>;
}

export class TradeDiscoveryService {
  private static instance: TradeDiscoveryService;
  private wallets: Map<string, WalletState> = new Map();
  private nftOwnership: Map<string, string> = new Map(); // nftAddress -> walletAddress
  private wantedNfts: Map<string, Set<string>> = new Map(); // nftAddress -> Set<walletAddress>
  private rejectedTrades: Map<string, Set<string>> = new Map(); // walletAddress -> Set<rejectedNftAddress>
  private rejectionPreferences: Map<string, RejectionPreferences> = new Map(); // walletAddress -> RejectionPreferences
  private helius: Helius;
  private readonly MAX_DEPTH = 11;
  private readonly MIN_EFFICIENCY = 0.7;
  private readonly WALLET_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  private manualNftRegistry: Map<string, string[]> = new Map();

  /**
   * Track trade progression by recording completed steps
   */
  private completedSteps: Map<string, {
    from: string;
    to: string;
    nfts: string[];
    transactionSignature: string;
    timestamp: Date;
  }> = new Map();

  private persistenceManager: PersistenceManager;

  private constructor() {
    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
      throw new Error('HELIUS_API_KEY environment variable is required');
    }
    this.helius = new Helius(apiKey);
    this.persistenceManager = PersistenceManager.getInstance();
    this.loadStateFromPersistence();
  }

  public static getInstance(): TradeDiscoveryService {
    if (!TradeDiscoveryService.instance) {
      TradeDiscoveryService.instance = new TradeDiscoveryService();
    }
    return TradeDiscoveryService.instance;
  }

  /**
   * Gets all NFTs owned by a wallet using Helius - robust implementation
   * Handles pagination, retries, and proper error handling
   */
  async getWalletNFTs(walletAddress: string): Promise<string[]> {
    try {
      console.log('Fetching all NFTs for wallet:', walletAddress);
      const allNfts: Set<string> = new Set();
      
      // Method 1: getAssetsByOwner
      await this.fetchNFTsViaAssetsByOwner(walletAddress, allNfts);
      
      // Method 2: getTokenAccounts (always use this as a fallback to ensure we get all NFTs)
      await this.fetchNFTsViaTokenAccounts(walletAddress, allNfts);
      
      const uniqueNfts = Array.from(allNfts);
      console.log(`Found total of ${uniqueNfts.length} NFTs for wallet ${walletAddress}`);
      
      // If no NFTs found, check our manual registry
      if (uniqueNfts.length === 0 && this.manualNftRegistry.has(walletAddress)) {
        const registeredNfts = this.manualNftRegistry.get(walletAddress) || [];
        console.log(`Using ${registeredNfts.length} manually registered NFTs for wallet ${walletAddress}`);
        return registeredNfts;
      }
      
      return uniqueNfts;
    } catch (error) {
      console.error('Error in getWalletNFTs:', error);
      
      // If API call fails completely, check our manual registry as fallback
      if (this.manualNftRegistry.has(walletAddress)) {
        const registeredNfts = this.manualNftRegistry.get(walletAddress) || [];
        console.log(`Using ${registeredNfts.length} manually registered NFTs for wallet ${walletAddress} (after API error)`);
        return registeredNfts;
      }
      
      throw error;
    }
  }

  /**
   * Fetches NFTs using getAssetsByOwner method
   */
  private async fetchNFTsViaAssetsByOwner(walletAddress: string, allNfts: Set<string>): Promise<void> {
    let page = 1;
    let hasMore = true;
    let totalRetries = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 500; // ms
    
    // Use direct fetch for more control over the request
    const apiKey = process.env.HELIUS_API_KEY;
    const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
    
    while (hasMore && totalRetries < MAX_RETRIES) {
      try {
        console.log(`Fetching page ${page} of NFTs for wallet ${walletAddress}`);
        
        // Use direct fetch for more control
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: `getAssetsByOwner-${Date.now()}`,
            method: 'getAssetsByOwner',
            params: {
              ownerAddress: walletAddress,
              page,
              limit: 1000,
              displayOptions: {
                showFungible: false, // Focus on NFTs only
                showNativeBalance: false, // Focus on NFTs only
              }
            },
          }),
        });
        
        // Handle response
        if (!response.ok) {
          console.error(`API request failed with status ${response.status}`);
          throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
          console.error('API returned error:', data.error);
          throw new Error(`API error: ${data.error.message || JSON.stringify(data.error)}`);
        }
        
        // Extract NFTs from response
        const result = data.result;
        if (!result || !result.items || !Array.isArray(result.items)) {
          console.log(`No valid items in response for page ${page}`);
          hasMore = false;
          continue;
        }
        
        const pageNfts = result.items.map((asset: any) => asset.id);
        console.log(`Found ${pageNfts.length} NFTs on page ${page}`);
        
        // Add to our collection
        pageNfts.forEach((nft: string) => allNfts.add(nft));
        
        // Check if we need to fetch more pages
        if (pageNfts.length < 1000) {
          // We received fewer items than the limit, so we've reached the end
          hasMore = false;
        } else {
          // Move to next page, add delay to avoid rate limiting
          page++;
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Reset retry counter on success
        totalRetries = 0;
        
      } catch (error) {
        console.error(`Error fetching page ${page} of NFTs:`, error);
        totalRetries++;
        
        if (totalRetries >= MAX_RETRIES) {
          console.error(`Max retries (${MAX_RETRIES}) reached, giving up.`);
          break;
        }
        
        // Wait before retrying
        console.log(`Retry attempt ${totalRetries}/${MAX_RETRIES} after delay...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * totalRetries));
      }
    }
  }

  /**
   * Fetches NFTs using getTokenAccountsByOwner method
   */
  private async fetchNFTsViaTokenAccounts(walletAddress: string, allNfts: Set<string>): Promise<void> {
    console.log(`Fetching NFTs via token accounts for wallet ${walletAddress}`);
    let totalRetries = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 500; // ms
    
    const apiKey = process.env.HELIUS_API_KEY;
    const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
    
    while (totalRetries < MAX_RETRIES) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: `getTokenAccounts-${Date.now()}`,
            method: 'getTokenAccountsByOwner',
            params: [
              walletAddress,
              {
                programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
              },
              {
                encoding: "jsonParsed"
              }
            ]
          }),
        });
        
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
          throw new Error(`API error: ${data.error.message || JSON.stringify(data.error)}`);
        }
        
        // Extract NFTs from token accounts
        const accounts = data.result?.value || [];
        
        const tokenMints = accounts
          .filter((account: any) => {
            const tokenAmount = account.account?.data?.parsed?.info?.tokenAmount;
            // Filtering for NFTs: decimals = 0 and amount = 1
            return tokenAmount && tokenAmount.decimals === 0 && tokenAmount.amount === "1";
          })
          .map((account: any) => account.account?.data?.parsed?.info?.mint)
          .filter(Boolean);
        
        console.log(`Found ${tokenMints.length} NFT mints via token accounts`);
        
        // Add token mints to our collection
        tokenMints.forEach((mint: string) => allNfts.add(mint));
        
        // Successfully fetched, exit loop
        break;
        
      } catch (error) {
        console.error(`Error fetching token accounts:`, error);
        totalRetries++;
        
        if (totalRetries >= MAX_RETRIES) {
          console.error(`Max retries (${MAX_RETRIES}) reached, giving up on token accounts.`);
          break;
        }
        
        // Wait before retrying
        console.log(`Retry attempt ${totalRetries}/${MAX_RETRIES} after delay...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * totalRetries));
      }
    }
  }

  /**
   * Checks if wallet state is stale and needs refreshing
   */
  private isWalletStateStale(walletAddress: string): boolean {
    const wallet = this.wallets.get(walletAddress);
    if (!wallet) return true;
    
    const now = new Date();
    const timeDiff = now.getTime() - wallet.lastUpdated.getTime();
    return timeDiff > this.WALLET_CACHE_TTL;
  }

  /**
   * Forces a refresh of wallet state regardless of cache
   */
  public async forceRefreshWalletState(walletAddress: string): Promise<WalletState> {
    if (this.wallets.has(walletAddress)) {
      this.wallets.delete(walletAddress);
    }
    return this.updateWalletState(walletAddress);
  }

  /**
   * Updates wallet state with real NFT data and maintains the NFT ownership index
   * Correctly handles multiple NFTs per wallet
   */
  async updateWalletState(walletAddress: string, forceRefresh = false): Promise<WalletState> {
    try {
      // Check if we have cached data that's still fresh
      if (!forceRefresh && this.wallets.has(walletAddress) && !this.isWalletStateStale(walletAddress)) {
        console.log(`Using cached wallet state for ${walletAddress}`);
        return this.wallets.get(walletAddress)!;
      }
      
      console.log(`Refreshing wallet state for ${walletAddress}`);
      
      // Fetch all NFTs owned by this wallet
      const ownedNfts = await this.getWalletNFTs(walletAddress);
      
      if (ownedNfts.length === 0) {
        console.warn(`No NFTs found for wallet ${walletAddress}. This might be an API or connection issue.`);
      }
      
      // Get existing wanted NFTs if the wallet exists
      const existingWallet = this.wallets.get(walletAddress);
      const wantedNfts = existingWallet ? existingWallet.wantedNfts : new Set<string>();
      
      // Remove old NFT ownerships for this wallet
      if (existingWallet) {
        for (const nft of existingWallet.ownedNfts) {
          if (this.nftOwnership.get(nft) === walletAddress) {
            this.nftOwnership.delete(nft);
          }
        }
      }
      
      // Create new wallet state with all found NFTs
      const walletState: WalletState = {
        address: walletAddress,
        ownedNfts: new Set(ownedNfts),
        wantedNfts,
        lastUpdated: new Date()
      };
      
      this.wallets.set(walletAddress, walletState);
      
      // Create detailed ownership mappings for each NFT
      for (const nft of ownedNfts) {
        // Keep track of who owns each NFT for fast lookups
        this.nftOwnership.set(nft, walletAddress);
      }
      
      // Log the updated state
      console.log(`Updated wallet state for ${walletAddress}:`);
      console.log(`- Found ${ownedNfts.length} owned NFTs`);
      console.log(`- Tracking ${wantedNfts.size} wanted NFTs`);
      
      if (ownedNfts.length > 0) {
        console.log(`- NFT examples: ${ownedNfts.slice(0, 3).join(', ')}${ownedNfts.length > 3 ? '...' : ''}`);
      }
      
      // Save state to persistence
      await this.saveStateToPersistence();
      
      return walletState;
    } catch (error) {
      console.error('Error updating wallet state:', error);
      throw error;
    }
  }

  /**
   * Adds or updates a trade preference and updates wanted NFT index
   */
  public async addTradePreference(walletAddress: string, desiredNft: string): Promise<void> {
    console.log(`Adding trade preference for wallet ${walletAddress}, wants NFT ${desiredNft}`);
    
    // Get or create wallet state
    const wallet = this.wallets.get(walletAddress) || {
      address: walletAddress,
      ownedNfts: new Set<string>(),
      wantedNfts: new Set<string>(),
      lastUpdated: new Date()
    };
    
    // Add the desired NFT to the wallet's wanted NFTs
    wallet.wantedNfts.add(desiredNft);
    
    // Update the wallet state
    this.wallets.set(walletAddress, wallet);
    
    // Update wanted NFTs map
    const wanters = this.wantedNfts.get(desiredNft) || new Set<string>();
    wanters.add(walletAddress);
    this.wantedNfts.set(desiredNft, wanters);
    
    console.log(`Added trade preference for wallet ${walletAddress}, now wants ${wallet.wantedNfts.size} NFTs`);
    
    // Save state to persistence
    await this.saveStateToPersistence();
  }

  /**
   * Rejects a trade by recording that the user doesn't want a specific NFT
   */
  public async rejectTrade(walletAddress: string, rejectedNftAddress: string): Promise<void> {
    console.log('\n=== Rejecting Trade ===');
    console.log('From wallet:', walletAddress);
    console.log('Rejecting NFT:', rejectedNftAddress);

    // Initialize rejected trades set for this wallet if it doesn't exist
    if (!this.rejectedTrades.has(walletAddress)) {
      this.rejectedTrades.set(walletAddress, new Set<string>());
    }
    
    // Add to rejected NFTs for this wallet
    this.rejectedTrades.get(walletAddress)!.add(rejectedNftAddress);
    
    // If this was in the user's wanted NFTs, remove it
    const walletState = this.wallets.get(walletAddress);
    if (walletState && walletState.wantedNfts.has(rejectedNftAddress)) {
      // Remove from wallet's wanted NFTs
      walletState.wantedNfts.delete(rejectedNftAddress);
      
      // Remove from global wanted NFTs index
      const wanters = this.wantedNfts.get(rejectedNftAddress);
      if (wanters) {
        wanters.delete(walletAddress);
        if (wanters.size === 0) {
          this.wantedNfts.delete(rejectedNftAddress);
        }
      }
      
      console.log(`Removed ${rejectedNftAddress} from ${walletAddress}'s wanted NFTs.`);
    }
    
    console.log(`Added ${rejectedNftAddress} to ${walletAddress}'s rejected trades.`);
    console.log(`Wallet now has ${this.rejectedTrades.get(walletAddress)!.size} rejected NFTs.`);
  }

  /**
   * Checks if a wallet has rejected a specific NFT
   */
  private hasRejectedNft(walletAddress: string, nftAddress: string): boolean {
    const rejectedNfts = this.rejectedTrades.get(walletAddress);
    return rejectedNfts ? rejectedNfts.has(nftAddress) : false;
  }

  /**
   * Finds all wallets interested in the given NFT (optimized lookup)
   */
  private getWalletsThatWant(nftAddress: string): string[] {
    const wanters = this.wantedNfts.get(nftAddress);
    if (!wanters || wanters.size === 0) return [];
    
    // Filter out wallets that have rejected this NFT
    return [...wanters].filter(wallet => !this.hasRejectedNft(wallet, nftAddress));
  }

  /**
   * Finds the owner wallet of a given NFT (optimized lookup)
   */
  private getOwnerOfNft(nftAddress: string): string | null {
    return this.nftOwnership.get(nftAddress) || null;
  }

  /**
   * Optimized search for direct matches between wallets
   */
  private findDirectMatches(): TradeLoop[] {
    console.log('Searching for direct matches between wallets...');
    const directMatches: TradeLoop[] = [];
    
    // Check each wallet's owned NFTs
    for (const [wallet1Address, wallet1] of this.wallets.entries()) {
      // For each NFT the wallet owns
      for (const ownedNft of wallet1.ownedNfts) {
        // Find wallets that want this NFT
        const wanters = this.getWalletsThatWant(ownedNft);
        
        for (const wallet2Address of wanters) {
          // Don't match with self
          if (wallet1Address === wallet2Address) continue;
          
          // Get the second wallet's data
          const wallet2 = this.wallets.get(wallet2Address);
          if (!wallet2) continue;
          
          // Check if wallet1 wants any NFT that wallet2 owns
          for (const wallet2OwnedNft of wallet2.ownedNfts) {
            if (wallet1.wantedNfts.has(wallet2OwnedNft)) {
              console.log(`Direct match found between ${wallet1Address} and ${wallet2Address}`);
              console.log(`${wallet1Address} has ${ownedNft} and wants ${wallet2OwnedNft}`);
              console.log(`${wallet2Address} has ${wallet2OwnedNft} and wants ${ownedNft}`);
              
              // Create a trade loop with just these two wallets
              const tradeId = `direct-${Date.now()}-${directMatches.length}`;
              directMatches.push({
                id: tradeId,
                steps: [
                  {
                    from: wallet1Address,
                    to: wallet2Address,
                    nfts: [{
                      address: ownedNft,
                      name: `NFT ${ownedNft.slice(0, 8)}...`,
                      symbol: 'NFT',
                      image: '',
                      collection: '',
                      description: 'NFT for trade'
                    }]
                  },
                  {
                    from: wallet2Address,
                    to: wallet1Address,
                    nfts: [{
                      address: wallet2OwnedNft,
                      name: `NFT ${wallet2OwnedNft.slice(0, 8)}...`,
                      symbol: 'NFT',
                      image: '',
                      collection: '',
                      description: 'NFT for trade'
                    }]
                  }
                ],
                totalParticipants: 2,
                efficiency: 1.0, // Direct trades are 100% efficient
                estimatedValue: this.calculateEstimatedValue()
              });
              
              // No need to check other NFTs for this pair
              break;
            }
          }
        }
      }
    }
    
    return directMatches;
  }

  /**
   * Optimized search for circular trades with 3+ participants using an efficient graph traversal
   */
  private findCircularTrades(): TradeLoop[] {
    console.log('Searching for circular trades with 3+ participants...');
    const circularTrades: TradeLoop[] = [];
    const foundCycles: Set<string> = new Set(); // Track unique cycles
    
    // Build a directed graph for faster traversal
    // from wallet -> (to wallet -> nft being traded)
    const graph = new Map<string, Map<string, string>>();
    
    // For each wallet
    for (const [walletAddress, wallet] of this.wallets.entries()) {
      graph.set(walletAddress, new Map());
      
      // For each NFT the wallet owns
      console.log(`\nExamining wallet ${walletAddress} with ${wallet.ownedNfts.size} NFTs`);
      for (const ownedNft of wallet.ownedNfts) {
        // Find all wallets that want this NFT
        const wanters = this.getWalletsThatWant(ownedNft);
        console.log(`NFT ${ownedNft} is wanted by ${wanters.length} wallets`);
        
        for (const wanterAddress of wanters) {
          if (walletAddress === wanterAddress) continue;
          
          console.log(`Adding edge: ${walletAddress} -> ${wanterAddress} (NFT: ${ownedNft})`);
          // Add edge: walletAddress -> wanterAddress (walletAddress can give wanterAddress what it wants)
          graph.get(walletAddress)!.set(wanterAddress, ownedNft);
        }
      }
    }
    
    // Debug: Print the graph
    console.log('\nDIRECTED GRAPH FOR TRADE PATHS:');
    for (const [from, edges] of graph.entries()) {
      if (edges.size === 0) {
        console.log(`${from} -> (no outgoing edges)`);
        continue;
      }
      for (const [to, nft] of edges.entries()) {
        console.log(`${from} -> ${to} (NFT: ${nft})`);
      }
    }
    
    // DFS with cycle detection to find all possible trade loops
    const traverse = (
      current: string,
      start: string, 
      path: string[], 
      nftPath: string[],
      visited: Set<string>,
      depth: number = 0
    ) => {
      // Check depth limit
      if (depth >= this.MAX_DEPTH) {
        console.log(`Hit max depth (${this.MAX_DEPTH}) for path: ${path.join(' -> ')}`);
        return;
      }
      
      visited.add(current);
      path.push(current);
      console.log(`\nCurrently at ${current}, path so far: ${path.join(' -> ')}`);
      
      const neighbors = graph.get(current);
      if (!neighbors || neighbors.size === 0) {
        console.log(`No neighbors for ${current}, backtracking`);
        visited.delete(current);
        path.pop();
        return;
      }
      
      // Check all neighbors
      for (const [neighbor, nft] of neighbors.entries()) {
        console.log(`Checking neighbor ${neighbor} from ${current}`);
        
        // If we found a cycle back to start
        if (neighbor === start && path.length >= 3) {
          console.log(`Found potential cycle: ${path.join(' -> ')} -> ${start}`);
          // Create canonical representation
          const cycle = [...path, start];
          const canonicalCycle = this.getCanonicalCycle(cycle);
          
          // Skip if duplicate
          if (foundCycles.has(canonicalCycle)) {
            console.log(`Already found this cycle, skipping`);
            continue;
          }
          
          console.log(`VALID TRADE LOOP FOUND: ${cycle.join(' -> ')}`);
          foundCycles.add(canonicalCycle);
          
          // Create trade steps
          const steps = [];
          for (let i = 0; i < path.length - 1; i++) {
            const from = path[i];
            const to = path[i + 1];
            const nftAddress = graph.get(from)!.get(to)!;
            
            steps.push({
              from,
              to,
              nfts: [{
                address: nftAddress,
                name: `NFT ${nftAddress.slice(0, 8)}...`,
                symbol: 'NFT',
                image: '',
                collection: '',
                description: 'NFT in trade loop'
              }]
            });
          }
          
          // Add final step back to start
          steps.push({
            from: path[path.length - 1],
            to: start,
            nfts: [{
              address: nft,
              name: `NFT ${nft.slice(0, 8)}...`,
              symbol: 'NFT',
              image: '',
              collection: '',
              description: 'NFT in trade loop'
            }]
          });
          
          // Add to trade loops
          circularTrades.push({
            id: `cycle-${Date.now()}-${circularTrades.length}`,
            steps,
            totalParticipants: path.length,
            efficiency: 1.0,
            estimatedValue: this.calculateEstimatedValue()
          });
          
          continue;
        }
        
        // Continue traversing if not visited
        if (!visited.has(neighbor)) {
          console.log(`Visiting neighbor ${neighbor} from ${current}`);
          nftPath.push(nft);
          traverse(neighbor, start, path, nftPath, new Set(visited), depth + 1);
          nftPath.pop();
        } else {
          console.log(`Already visited ${neighbor}, skipping`);
        }
      }
      
      visited.delete(current);
      path.pop();
      console.log(`Backtracking from ${current}`);
    };
    
    // Start from each wallet
    for (const walletAddress of this.wallets.keys()) {
      console.log(`\n=== Starting DFS from wallet: ${walletAddress} ===`);
      traverse(walletAddress, walletAddress, [], [], new Set());
    }
    
    if (circularTrades.length > 0) {
      console.log(`Found ${circularTrades.length} valid circular trades with 3+ participants`);
    } else {
      console.log('No valid circular trades found');
    }
    
    return circularTrades;
  }

  private calculateEfficiency(path: string[]): number {
    // Simple efficiency calculation based on path length
    const maxLength = this.MAX_DEPTH;
    return 1 - (path.length - 2) / maxLength;
  }

  /**
   * Calculate estimated value of a trade loop
   */
  private calculateEstimatedValue(): number {
    // Initialize NFT pricing service
    const NFTPricingService = require('../services/nft-pricing.service').NFTPricingService;
    const pricingService = NFTPricingService.getInstance();
    
    // For real implementation, fetch actual prices from market APIs
    // This would typically use the NFT mints to get actual prices
    try {
      // A real implementation would use the NFT mints to get actual prices
      // For now, we're using a conservative estimate based on recent market data
      return pricingService.getAveragePriceEstimate();
    } catch (error) {
      console.error('Error calculating trade value:', error);
      // Fallback to conservative estimate if price service fails
      return 1.0; // 1 SOL as conservative estimate
    }
  }

  private getCanonicalCycle(cycle: string[]): string {
    // If cycle is too short, just return it
    if (cycle.length <= 2) return cycle.join(',');
    
    // Find the lexicographically smallest wallet address in the cycle
    let minIndex = 0;
    let minWallet = cycle[0];
    for (let i = 1; i < cycle.length - 1; i++) {
      if (cycle[i] < minWallet) {
        minWallet = cycle[i];
        minIndex = i;
      }
    }
    
    // Create a normalized cycle that always starts with the smallest wallet
    // Exclude the last element since it's the same as the first element (to complete the cycle)
    const normalizedCycle = [];
    for (let i = 0; i < cycle.length - 1; i++) {
      normalizedCycle.push(cycle[(minIndex + i) % (cycle.length - 1)]);
    }
    // Add the smallest wallet at the end to complete the cycle
    normalizedCycle.push(minWallet);
    
    return normalizedCycle.join(',');
  }

  /**
   * Find potential trade loops
   */
  public findTradeLoops(): TradeLoop[] {
    console.log('\n=== Finding Trade Loops ===');
    console.log('Number of wallets:', this.wallets.size);
    console.log('Number of tracked NFTs:', this.nftOwnership.size);
    console.log('Number of wanted NFTs:', this.wantedNfts.size);
    
    // First try to find direct matches (faster)
    const directMatches = this.findDirectMatches();
    console.log(`Found ${directMatches.length} direct trades`);
    
    // Also try to find circular trades
    const circularTrades = this.findCircularTrades();
    console.log(`Found ${circularTrades.length} circular trades`);
    
    // Combine all trade loops
    let allTrades = [...directMatches, ...circularTrades];
    
    if (allTrades.length === 0) {
      console.log('No valid trade loops found');
      return [];
    }
    
    // Calculate scores for all trades
    allTrades = allTrades.map(trade => {
      // Add score to trade for better ranking
      return {
        ...trade,
        score: this.calculateTradeScore(trade)
      };
    });
    
    // Sort by score (if available) and then by efficiency
    allTrades.sort((a, b) => {
      // Sort by score if available
      if (a.score !== undefined && b.score !== undefined) {
        return b.score - a.score;
      }
      // Fall back to efficiency
      return b.efficiency - a.efficiency;
    });
    
    console.log(`\nFound ${allTrades.length} trade loops.`);
    
    return allTrades;
  }
  
  /**
   * Gets a stored trade loop by ID
   * 
   * @param tradeId Unique identifier for the trade loop
   * @returns The trade loop data or null if not found
   */
  public async getStoredTradeLoop(tradeId: string): Promise<TradeLoop | null> {
    try {
      console.log(`Retrieving trade loop with ID: ${tradeId}`);
      
      // Load from persistence with type assertion
      const tradeData = await this.persistenceManager.loadData(`tradeLoop:${tradeId}`, null) as any;
      
      if (!tradeData) {
        console.log(`No data found for trade loop with ID: ${tradeId}`);
        return null;
      }
      
      console.log(`Successfully retrieved trade loop with ID: ${tradeId}`);
      
      // Ensure the data has the right format
      if (!tradeData.steps || !Array.isArray(tradeData.steps)) {
        console.error(`Invalid trade data format for ID: ${tradeId}`);
        return null;
      }
      
      // Format as TradeLoop type
      const tradeLoop: TradeLoop = {
        id: tradeId,
        steps: tradeData.steps,
        totalParticipants: this.getUniqueParticipants(tradeData.steps).length,
        efficiency: tradeData.efficiency || 1.0,
        estimatedValue: tradeData.estimatedValue || this.calculateEstimatedValue(),
        status: tradeData.status || 'pending',
        createdAt: tradeData.createdAt ? new Date(tradeData.createdAt) : new Date(),
        expiresAt: tradeData.expiresAt ? new Date(tradeData.expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
      
      // Calculate progress
      const completedSteps = tradeData.steps.filter((step: any) => step.completed).length;
      tradeLoop.progress = Math.round((completedSteps / tradeData.steps.length) * 100);
      
      // Calculate overall status
      const expiryDate = tradeLoop.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000);
      const isExpired = new Date() > expiryDate;
      if (isExpired) {
        tradeLoop.overallStatus = 'expired';
      } else if (tradeLoop.status === 'completed') {
        tradeLoop.overallStatus = 'completed';
      } else if (tradeLoop.progress > 0) {
        tradeLoop.overallStatus = 'in_progress';
      } else {
        tradeLoop.overallStatus = 'pending';
      }
      
      return tradeLoop;
    } catch (error) {
      console.error(`Error retrieving trade loop with ID: ${tradeId}:`, error);
      return null;
    }
  }
  
  /**
   * Get unique participants from trade steps
   */
  private getUniqueParticipants(steps: any[]): string[] {
    const participants = new Set<string>();
    
    for (const step of steps) {
      if (step.from) participants.add(step.from);
      if (step.to) participants.add(step.to);
    }
    
    return Array.from(participants);
  }

  /**
   * Helper to get trade steps from a stored trade
   * @param tradeId Unique identifier for the trade
   * @returns Array of trade steps or null if not found
   */
  private async getTradeSteps(tradeId: string): Promise<TradeLoop['steps'] | null> {
    // Load the trade from persistence
    const persistenceKey = `tradeLoop:${tradeId}`;
    
    try {
      // Use the persistence manager to load the stored trade with proper default
      const defaultValue = { steps: [] };
      const storedTrade = await this.persistenceManager.loadData(persistenceKey, defaultValue);
      
      if (!storedTrade || !storedTrade.steps || storedTrade.steps.length === 0) {
        console.log(`No valid trade data found for ID: ${tradeId}`);
        return null;
      }
      
      return storedTrade.steps;
    } catch (error) {
      console.error(`Error retrieving trade steps for ${tradeId}:`, error);
      return null;
    }
  }

  // Add method to check system state
  public getSystemState(): { wallets: number; nfts: number; wanted: number } {
    return {
      wallets: this.wallets.size,
      nfts: this.nftOwnership.size,
      wanted: this.wantedNfts.size
    };
  }

  // Add method to clear state
  public clearState(): void {
    console.log('Clearing trade discovery state');
    
    this.wallets.clear();
    this.nftOwnership.clear();
    this.wantedNfts.clear();
    this.completedSteps.clear();
    this.manualNftRegistry.clear();
    
    // Delete persistence files
    this.persistenceManager.deleteData('wallets');
    this.persistenceManager.deleteData('nftOwnership');
    this.persistenceManager.deleteData('wantedNfts');
    this.persistenceManager.deleteData('completedSteps');
    this.persistenceManager.deleteData('manualNftRegistry');
    
    console.log('Trade discovery state cleared');
  }

  // Add method to get detailed system state
  public getDetailedSystemState(): { wallets: Array<{ address: string, ownedNfts: string[], wantedNfts: string[] }> } {
    const walletDetails = [];
    
    for (const [address, wallet] of this.wallets.entries()) {
      walletDetails.push({
        address,
        ownedNfts: Array.from(wallet.ownedNfts),
        wantedNfts: Array.from(wallet.wantedNfts)
      });
    }
    
    return {
      wallets: walletDetails
    };
  }

  /**
   * Manually register NFTs for a wallet when API doesn't find them
   * This is useful for testing or when the API has issues
   */
  public registerManualNFTs(walletAddress: string, nftAddresses: string[]): void {
    console.log(`Manually registering ${nftAddresses.length} NFTs for wallet ${walletAddress}`);
    
    // Update the manual registry
    this.manualNftRegistry.set(walletAddress, nftAddresses);
    
    // Save state to persistence
    this.saveStateToPersistence();
  }

  /**
   * Performs a deep scan of wallet NFTs using multiple methods
   * This is a more thorough but slower approach for problematic wallets
   */
  async deepScanWalletNFTs(walletAddress: string): Promise<string[]> {
    console.log(`\n=== Starting DEEP SCAN for wallet: ${walletAddress} ===`);
    const allNfts: Set<string> = new Set();
    const apiKey = process.env.HELIUS_API_KEY;
    
    // Try multiple RPC methods
    const methods = [
      'getAssetsByOwner',
      'getTokenAccounts'
    ];
    
    // Try different page sizes
    const pageSizes = [1000, 100, 50];
    
    for (const method of methods) {
      console.log(`\nTrying method: ${method}`);
      
      for (const pageSize of pageSizes) {
        console.log(`- With page size: ${pageSize}`);
        let page = 1;
        let hasMore = true;
        let totalRetries = 0;
        const MAX_RETRIES = 5;
        const RETRY_DELAY = 1000; // ms
        
        while (hasMore && totalRetries < MAX_RETRIES) {
          try {
            console.log(`- Fetching page ${page} with size ${pageSize}`);
            
            // Deep scan method 1: getAssetsByOwner
            if (method === 'getAssetsByOwner') {
              const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: `deepScan-${Date.now()}`,
                  method: 'getAssetsByOwner',
                  params: {
                    ownerAddress: walletAddress,
                    page,
                    limit: pageSize,
                    displayOptions: {
                      showFungible: false,
                      showNativeBalance: false,
                    }
                  },
                }),
              });
              
              if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
              }
              
              const data = await response.json();
              
              if (data.error) {
                throw new Error(`API error: ${data.error.message || JSON.stringify(data.error)}`);
              }
              
              // Extract NFTs from response
              const result = data.result;
              if (!result || !result.items || !Array.isArray(result.items)) {
                console.log(`No valid items in response for page ${page}`);
                hasMore = false;
                continue;
              }
              
              const pageNfts = result.items.map((asset: any) => asset.id);
              console.log(`Found ${pageNfts.length} NFTs on page ${page}`);
              
              // Add to our collection
              pageNfts.forEach((nft: string) => allNfts.add(nft));
              
              // Check if we need to fetch more pages
              if (pageNfts.length < pageSize) {
                hasMore = false;
              } else {
                page++;
                await new Promise(resolve => setTimeout(resolve, 500)); // Add delay between requests
              }
            } 
            // Deep scan method 2: getTokenAccounts 
            else if (method === 'getTokenAccounts') {
              const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: `deepScan-${Date.now()}`,
                  method: 'getTokenAccountsByOwner',
                  params: [
                    walletAddress,
                    {
                      programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
                    },
                    {
                      encoding: "jsonParsed"
                    }
                  ]
                }),
              });
              
              if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
              }
              
              const data = await response.json();
              
              if (data.error) {
                throw new Error(`API error: ${data.error.message || JSON.stringify(data.error)}`);
              }
              
              // Extract NFTs from token accounts
              const accounts = data.result?.value || [];
              
              const tokenMints = accounts
                .filter((account: any) => {
                  const tokenAmount = account.account?.data?.parsed?.info?.tokenAmount;
                  // Filtering for NFTs: decimals = 0 and amount = 1
                  return tokenAmount && tokenAmount.decimals === 0 && tokenAmount.amount === "1";
                })
                .map((account: any) => account.account?.data?.parsed?.info?.mint)
                .filter(Boolean);
              
              console.log(`Found ${tokenMints.length} NFT mints via token accounts`);
              
              // Add token mints to our collection
              tokenMints.forEach((mint: string) => allNfts.add(mint));
              
              // This method typically returns all results in one call
              hasMore = false;
            }
            
            // Reset retry counter on success
            totalRetries = 0;
            
          } catch (error) {
            console.error(`Error in deep scan (method: ${method}, page: ${page}):`, error);
            totalRetries++;
            
            if (totalRetries >= MAX_RETRIES) {
              console.error(`Max retries (${MAX_RETRIES}) reached, moving to next approach.`);
              break;
            }
            
            // Exponential backoff
            const delay = RETRY_DELAY * Math.pow(2, totalRetries - 1);
            console.log(`Retry attempt ${totalRetries}/${MAX_RETRIES} after ${delay}ms delay...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    }
    
    // Check if we found anything
    if (allNfts.size === 0) {
      console.log('No NFTs found via deep scan. Falling back to manual registration if available.');
      // Try manual registry as last resort
      if (this.manualNftRegistry.has(walletAddress)) {
        const registeredNfts = this.manualNftRegistry.get(walletAddress) || [];
        console.log(`Using ${registeredNfts.length} manually registered NFTs for wallet ${walletAddress}`);
        registeredNfts.forEach(nft => allNfts.add(nft));
      }
    }
    
    const uniqueNfts = Array.from(allNfts);
    console.log(`Deep scan completed. Found ${uniqueNfts.length} unique NFTs for wallet ${walletAddress}`);
    return uniqueNfts;
  }

  /**
   * Updates wallet state using a deep scan approach
   */
  async updateWalletStateDeepScan(walletAddress: string): Promise<WalletState> {
    console.log(`\n=== Performing Deep Scan Update for wallet: ${walletAddress} ===`);
    
    // Always force refresh for deep scan
    if (this.wallets.has(walletAddress)) {
      console.log(`Removing existing cached wallet state for ${walletAddress}`);
      this.wallets.delete(walletAddress);
    }
    
    // Get existing wanted NFTs if the wallet exists
    const existingWallet = this.wallets.get(walletAddress);
    const wantedNfts = existingWallet ? existingWallet.wantedNfts : new Set<string>();
    
    // Perform deep scan to get all NFTs
    const ownedNfts = await this.deepScanWalletNFTs(walletAddress);
    
    // Create new wallet state with all found NFTs
    const walletState: WalletState = {
      address: walletAddress,
      ownedNfts: new Set(ownedNfts),
      wantedNfts,
      lastUpdated: new Date()
    };
    
    this.wallets.set(walletAddress, walletState);
    
    // Create detailed ownership mappings for each NFT
    for (const nft of ownedNfts) {
      // Keep track of who owns each NFT for fast lookups
      this.nftOwnership.set(nft, walletAddress);
    }
    
    // Log the updated state
    console.log(`Updated wallet state for ${walletAddress} using deep scan:`);
    console.log(`- Found ${ownedNfts.length} owned NFTs`);
    console.log(`- Tracking ${wantedNfts.size} wanted NFTs`);
    
    if (ownedNfts.length > 0) {
      console.log(`- NFT examples: ${ownedNfts.slice(0, 3).join(', ')}${ownedNfts.length > 3 ? '...' : ''}`);
    }
    
    // Save state to persistence
    await this.saveStateToPersistence();
    
    return walletState;
  }

  /**
   * Gets the owner of a specific NFT (optimized lookup)
   * This is a public version of the private method for external use
   */
  public getOwnerOfNFT(nftAddress: string): string | null {
    return this.nftOwnership.get(nftAddress) || null;
  }

  /**
   * Gets a copy of the current NFT ownership map for external use
   */
  public getNFTOwnershipMap(): Record<string, string> {
    const ownershipMap: Record<string, string> = {};
    this.nftOwnership.forEach((owner, nftAddress) => {
      ownershipMap[nftAddress] = owner;
    });
    return ownershipMap;
  }

  /**
   * Gets all wallet addresses currently tracked in the system
   */
  public getAllWallets(): string[] {
    return Array.from(this.wallets.keys());
  }

  /**
   * Records a completed trade step
   * @param from The sender wallet address
   * @param to The recipient wallet address
   * @param nfts Array of NFT addresses that were transferred
   * @param transactionSignature The Solana transaction signature
   */
  public recordCompletedStep(
    from: string,
    to: string,
    nfts: string[],
    transactionSignature: string
  ): void {
    const stepId = `${from}-${to}`;
    console.log(`Recording completed step: ${stepId}`);
    
    // Record the completed step
    this.completedSteps.set(stepId, {
      from,
      to,
      nfts,
      transactionSignature,
      timestamp: new Date()
    });
    
    console.log(`Step recorded: ${stepId} with transaction ${transactionSignature}`);
    
    // Update our internal tracking of NFT ownership
    for (const nftAddress of nfts) {
      console.log(`Updating ownership of NFT ${nftAddress} from ${from} to ${to}`);
      
      // Update the from wallet's owned NFTs
      const fromWallet = this.wallets.get(from);
      if (fromWallet) {
        fromWallet.ownedNfts.delete(nftAddress);
        console.log(`Removed NFT ${nftAddress} from wallet ${from}`);
      }
      
      // Update the to wallet's owned NFTs
      const toWallet = this.wallets.get(to);
      if (toWallet) {
        toWallet.ownedNfts.add(nftAddress);
        console.log(`Added NFT ${nftAddress} to wallet ${to}`);
      } else {
        // Create new wallet state for recipient if it doesn't exist
        this.wallets.set(to, {
          address: to,
          ownedNfts: new Set([nftAddress]),
          wantedNfts: new Set(),
          lastUpdated: new Date()
        });
        console.log(`Created new wallet state for ${to} with NFT ${nftAddress}`);
      }
      
      // Update the nftOwnership mapping
      this.nftOwnership.set(nftAddress, to);
    }
    
    console.log(`Ownership updated for ${nfts.length} NFTs`);
    
    // Save state to persistence
    this.saveStateToPersistence();
  }

  /**
   * Gets all completed trade steps
   */
  public getCompletedSteps(): Array<{
    stepId: string;
    from: string;
    to: string;
    nfts: string[];
    transactionSignature: string;
    timestamp: Date;
  }> {
    return Array.from(this.completedSteps.entries()).map(([stepId, step]) => ({
      stepId,
      ...step
    }));
  }

  /**
   * Loads the system state from persistent storage
   */
  private async loadStateFromPersistence(): Promise<void> {
    try {
      console.log('Loading trade state from persistence...');
      
      // Load wallets
      const persistedWallets = await this.persistenceManager.loadData<Map<string, WalletState>>(
        'wallets',
        new Map()
      );
      
      if (persistedWallets.size > 0) {
        this.wallets = persistedWallets;
        console.log(`Loaded ${this.wallets.size} wallets from persistence`);
      }
      
      // Load NFT ownership
      const persistedNftOwnership = await this.persistenceManager.loadData<Map<string, string>>(
        'nftOwnership',
        new Map()
      );
      
      if (persistedNftOwnership.size > 0) {
        this.nftOwnership = persistedNftOwnership;
        console.log(`Loaded ${this.nftOwnership.size} NFT ownership records from persistence`);
      }
      
      // Load wanted NFTs
      const persistedWantedNfts = await this.persistenceManager.loadData<Map<string, Set<string>>>(
        'wantedNfts',
        new Map()
      );
      
      if (persistedWantedNfts.size > 0) {
        this.wantedNfts = persistedWantedNfts;
        console.log(`Loaded ${this.wantedNfts.size} wanted NFT records from persistence`);
      }
      
      // Load completed steps
      const persistedCompletedSteps = await this.persistenceManager.loadData<Map<string, {
        from: string;
        to: string;
        nfts: string[];
        transactionSignature: string;
        timestamp: Date;
      }>>(
        'completedSteps',
        new Map()
      );
      
      if (persistedCompletedSteps.size > 0) {
        this.completedSteps = persistedCompletedSteps;
        console.log(`Loaded ${this.completedSteps.size} completed trade steps from persistence`);
      }
      
      // Load manual NFT registry
      const persistedManualRegistry = await this.persistenceManager.loadData<Map<string, string[]>>(
        'manualNftRegistry',
        new Map()
      );
      
      if (persistedManualRegistry.size > 0) {
        this.manualNftRegistry = persistedManualRegistry;
        console.log(`Loaded ${this.manualNftRegistry.size} manual NFT registry entries from persistence`);
      }
      
      console.log('Trade state loaded from persistence');
    } catch (error) {
      console.error('Error loading trade state from persistence:', error);
      console.log('Starting with empty trade state');
    }
  }
  
  /**
   * Saves the current system state to persistent storage
   */
  private async saveStateToPersistence(): Promise<void> {
    try {
      console.log('Saving trade state to persistence...');
      
      // Save wallets
      await this.persistenceManager.saveData('wallets', this.wallets);
      
      // Save NFT ownership
      await this.persistenceManager.saveData('nftOwnership', this.nftOwnership);
      
      // Save wanted NFTs
      await this.persistenceManager.saveData('wantedNfts', this.wantedNfts);
      
      // Save completed steps
      await this.persistenceManager.saveData('completedSteps', this.completedSteps);
      
      // Save manual NFT registry
      await this.persistenceManager.saveData('manualNftRegistry', this.manualNftRegistry);
      
      console.log('Trade state saved to persistence');
    } catch (error) {
      console.error('Error saving trade state to persistence:', error);
    }
  }

  /**
   * Stores a trade loop for on-chain tracking
   * 
   * @param tradeId Unique identifier for the trade loop
   * @param steps Array of trade steps
   */
  async storeTradeLoop(tradeId: string, steps: any[]): Promise<void> {
    try {
      console.log(`Storing trade loop ${tradeId} with ${steps.length} steps`);
      
      // In a real implementation, this would store the trade loop in a database
      // for tracking against on-chain transactions
      
      // Store in persistence for demo purposes
      await this.persistenceManager.setData(`tradeLoop:${tradeId}`, {
        tradeId,
        steps,
        createdAt: Date.now(),
        status: 'created'
      });
      
      console.log(`Successfully stored trade loop ${tradeId}`);
    } catch (error) {
      console.error(`Error storing trade loop ${tradeId}:`, error);
      throw error;
    }
  }

  /**
   * Checks if a wallet exists in our system
   */
  public walletExists(walletAddress: string): boolean {
    return this.wallets.has(walletAddress);
  }

  /**
   * Get all trades involving a specific wallet
   * @param walletAddress The wallet address to get trades for
   * @returns Array of trades where this wallet is participating
   */
  public async getTradesForWallet(walletAddress: string): Promise<TradeLoop[]> {
    console.log(`Getting trades for wallet: ${walletAddress}`);
    
    try {
      // Load all stored trade data - in a production system this would use a database query
      const allTradeKeys = await this.getAllTradeKeys();
      const trades: TradeLoop[] = [];
      
      for (const tradeKey of allTradeKeys) {
        // Extract trade ID from the key format 'tradeLoop:tradeId'
        const tradeId = tradeKey.substring('tradeLoop:'.length);
        
        try {
          // Use any type for the loaded data to avoid TypeScript errors
          const tradeData: any = await this.persistenceManager.loadData(tradeKey, { steps: [] });
          
          if (!tradeData || !tradeData.steps || tradeData.steps.length === 0) {
            console.log(`No valid data for trade ${tradeId}`);
            continue;
          }
          
          // Use explicit typing for the trade data
          const tradeLoop: any = tradeData;
          
          // Check if this wallet is involved in the trade
          const isWalletInvolved = tradeLoop.steps.some((step: any) => {
            return step.from === walletAddress || step.to === walletAddress;
          });
          
          if (isWalletInvolved) {
            // Add status information if not present
            if (!tradeLoop.status) {
              tradeLoop.status = 'pending';
            }
            
            // Add progress information if not present
            if (!tradeLoop.progress) {
              const completedSteps = tradeLoop.steps.filter((step: any) => step.completed).length;
              tradeLoop.progress = Math.round((completedSteps / tradeLoop.steps.length) * 100);
            }
            
            // Calculate expiration if not present
            if (!tradeLoop.expiresAt) {
              // Default to 24 hours from creation
              const createdAt = tradeLoop.createdAt || new Date();
              tradeLoop.expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
            }
            
            // Set the ID if not present
            if (!tradeLoop.id) {
              tradeLoop.id = tradeId;
            }
            
            // Calculate overall status
            const expiryDate = tradeLoop.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000);
            const isExpired = new Date() > expiryDate;
            if (isExpired) {
              tradeLoop.overallStatus = 'expired';
            } else if (tradeLoop.status === 'completed') {
              tradeLoop.overallStatus = 'completed';
            } else if (tradeLoop.progress > 0) {
              tradeLoop.overallStatus = 'in_progress';
            } else {
              tradeLoop.overallStatus = 'pending';
            }
            
            // Add to the results
            trades.push(tradeLoop as TradeLoop);
          }
        } catch (error) {
          console.error(`Error retrieving trade data for ${tradeId}:`, error);
          continue;
        }
      }
      
      // Sort trades by creation date (most recent first)
      trades.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
      
      console.log(`Found ${trades.length} trades for wallet ${walletAddress}`);
      return trades;
    } catch (error) {
      console.error(`Error retrieving trades for wallet ${walletAddress}:`, error);
      return [];
    }
  }
  
  /**
   * Helper method to get all trade keys from persistence
   */
  private async getAllTradeKeys(): Promise<string[]> {
    // In a real implementation, this would query a database
    // For now, we'll simulate by checking for all keys with the tradeLoop prefix
    
    try {
      // Get directory contents of the data folder
      const dataDir = process.env.DATA_DIR || './data';
      const fs = require('fs').promises;
      
      // Check if the directory exists
      try {
        await fs.access(dataDir);
      } catch (error) {
        console.log(`Data directory ${dataDir} does not exist`);
        return [];
      }
      
      // List all files
      const files = await fs.readdir(dataDir);
      
      // Filter for trade loop files (tradeLoop:*.json)
      const tradeKeys = files
        .filter((file: string) => file.startsWith('tradeLoop:') && file.endsWith('.json'))
        .map((file: string) => file.substring(0, file.length - 5)); // Remove .json extension
      
      console.log(`Found ${tradeKeys.length} trade loop keys`);
      return tradeKeys;
    } catch (error) {
      console.error('Error getting trade keys:', error);
      return [];
    }
  }

  /**
   * Gets all rejection preferences for a wallet
   */
  public getRejections(walletAddress: string): RejectionPreferences | undefined {
    return this.rejectionPreferences.get(walletAddress);
  }

  /**
   * Stores rejection preferences for a wallet
   */
  public storeRejections(walletAddress: string, rejections: RejectionPreferences): void {
    console.log(`\n=== Storing Rejection Preferences ===`);
    console.log(`Wallet: ${walletAddress}`);
    console.log(`Rejected NFTs: ${Array.from(rejections.nfts).join(', ') || 'none'}`);
    console.log(`Rejected wallets: ${Array.from(rejections.wallets).join(', ') || 'none'}`);
    
    this.rejectionPreferences.set(walletAddress, rejections);
    
    // Also update the traditional rejectedTrades map for backward compatibility
    const nftRejections = this.rejectedTrades.get(walletAddress) || new Set<string>();
    for (const nft of rejections.nfts) {
      nftRejections.add(nft);
    }
    this.rejectedTrades.set(walletAddress, nftRejections);
  }

  /**
   * Check if a trade contains any rejected NFTs or wallets
   */
  private hasRejectedItems(trade: TradeLoop, walletAddress: string): boolean {
    const rejections = this.rejectionPreferences.get(walletAddress);
    if (!rejections) return false;
    
    // Check for rejected wallets
    for (const step of trade.steps) {
      // If this wallet is sending to a rejected recipient
      if (step.from === walletAddress && rejections.wallets.has(step.to)) {
        console.log(`Trade ${trade.id} contains rejected wallet ${step.to}`);
        return true;
      }
      
      // If this wallet is receiving from a rejected sender
      if (step.to === walletAddress && rejections.wallets.has(step.from)) {
        console.log(`Trade ${trade.id} contains rejected wallet ${step.from}`);
        return true;
      }
      
      // Check for rejected NFTs
      for (const nft of step.nfts) {
        if (rejections.nfts.has(nft.address)) {
          console.log(`Trade ${trade.id} contains rejected NFT ${nft.address}`);
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Calculate a comprehensive score for a trade loop
   */
  private calculateTradeScore(trade: TradeLoop): number {
    // Base efficiency score from existing calculations
    const efficiencyScore = trade.efficiency;
    
    // Fairness score - how evenly distributed the value is
    let fairnessScore = 1.0;
    // This would use estimatedValue from each NFT in a real implementation
    
    // Demand score - how wanted are the NFTs in this trade
    let demandScore = 0.8;
    // This would calculate based on how many wallets want each NFT
    
    // Length score - shorter trades are better
    const lengthScore = Math.max(0.5, 1.0 - (trade.steps.length / 10));
    
    // Calculate weighted score
    const weightedScore = (
      efficiencyScore * 0.3 +
      fairnessScore * 0.3 +
      demandScore * 0.2 +
      lengthScore * 0.2
    );
    
    console.log(`\nScoring trade ${trade.id}:`);
    console.log(`Efficiency: ${efficiencyScore.toFixed(2)}`);
    console.log(`Fairness: ${fairnessScore.toFixed(2)}`);
    console.log(`Demand: ${demandScore.toFixed(2)}`);
    console.log(`Length: ${lengthScore.toFixed(2)}`);
    console.log(`Final score: ${weightedScore.toFixed(2)}`);
    
    return weightedScore;
  }

  /**
   * Prepare a trade loop for smart contract consumption
   */
  public async prepareTradeLoopForContract(tradeId: string): Promise<{
    participants: string[];
    nfts: string[];
    serialized: string;
  }> {
    // Find the trade in our database
    console.log(`\n=== Preparing Trade Loop ${tradeId} for Smart Contract ===`);
    
    // Load the trade data from persistent storage
    const steps = await this.getTradeSteps(tradeId);
    
    if (!steps || steps.length === 0) {
      console.error(`Trade ${tradeId} not found`);
      throw new Error(`Trade ${tradeId} not found`);
    }
    
    // Extract participants and NFTs
    const participants: string[] = [];
    const nfts: string[] = [];
    
    for (const step of steps) {
      participants.push(step.from);
      
      // Get first NFT from each step
      if (step.nfts && step.nfts.length > 0) {
        nfts.push(step.nfts[0].address);
      } else {
        nfts.push(''); // Fallback for incomplete data
      }
    }
    
    // Add last recipient if there are steps
    if (steps.length > 0) {
      participants.push(steps[steps.length - 1].to);
    }
    
    // Create serialized representation for on-chain storage
    const serialized = JSON.stringify({
      id: tradeId,
      participants,
      nfts,
      created: Date.now(),
      expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours from now
    });
    
    console.log(`Trade data serialized: ${serialized.length} bytes`);
    
    // Check if serialized data fits within Solana account size limits
    const MAX_ACCOUNT_SIZE = 10 * 1024; // 10KB example limit
    if (Buffer.from(serialized).length > MAX_ACCOUNT_SIZE) {
      console.warn('Warning: Serialized trade data exceeds recommended account size limit');
    }
    
    return {
      participants,
      nfts,
      serialized
    };
  }

  /**
   * Records a completed trade step with verification details
   * 
   * @param tradeId Unique identifier for the trade
   * @param stepIndex Index of the completed step
   * @param completionData Data about the completion including transaction signature
   */
  public async recordTradeStepCompletion(
    tradeId: string,
    stepIndex: number,
    completionData: any
  ): Promise<void> {
    console.log(`Recording completion of step ${stepIndex} for trade ${tradeId}`);
    
    try {
      // Store in our database/persistence layer
      const persistenceKey = `tradeCompletion:${tradeId}:${stepIndex}`;
      await this.persistenceManager.setData(persistenceKey, {
        ...completionData,
        recordedAt: new Date()
      });
      
      // Also update the trade loop status if it exists
      const tradeLoopKey = `tradeLoop:${tradeId}`;
      const tradeLoop = await this.persistenceManager.loadData(tradeLoopKey, { 
        steps: [], 
        status: 'pending',
        progress: 0
      });
      
      if (tradeLoop && tradeLoop.steps && tradeLoop.steps.length > stepIndex) {
        // Use explicit type casting for the steps array
        const steps = tradeLoop.steps as any[];
        
        // Mark this step as completed
        if (!steps[stepIndex]) steps[stepIndex] = {};
        steps[stepIndex].completed = true;
        steps[stepIndex].completedAt = new Date();
        steps[stepIndex].transactionSignature = completionData.transactionSignature;
        
        // Calculate overall progress
        const totalSteps = steps.length;
        const completedSteps = steps.filter((step: any) => step.completed).length;
        
        // Update the trade loop object using type assertion
        const typedTradeLoop = tradeLoop as any;
        typedTradeLoop.progress = Math.round((completedSteps / totalSteps) * 100);
        
        // Update status if all steps are completed
        if (completedSteps === totalSteps) {
          typedTradeLoop.status = 'completed';
          typedTradeLoop.completedAt = new Date();
        } else {
          typedTradeLoop.status = 'in_progress';
        }
        
        // Save the updated trade loop
        await this.persistenceManager.setData(tradeLoopKey, typedTradeLoop);
      }
      
      console.log(`Successfully recorded completion of step ${stepIndex} for trade ${tradeId}`);
    } catch (error) {
      console.error(`Error recording trade step completion:`, error);
      throw new Error(`Failed to record trade step completion: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
} 