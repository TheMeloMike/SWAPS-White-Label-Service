/**
 * Abstract interfaces for white label integration
 * These provide blockchain-agnostic data models that partners can map their assets to
 */

/**
 * Platform-agnostic NFT interface
 * Partners map their assets (physical collectibles, digital art, etc.) to this format
 */
export interface AbstractNFT {
  id: string;                    // Platform-agnostic unique identifier
  metadata: {
    name: string;
    description?: string;
    image?: string;
    attributes?: Record<string, any>;
  };
  ownership: {
    ownerId: string;           // Abstract wallet/user ID
    acquiredAt?: Date;
  };
  valuation?: {
    estimatedValue?: number;
    currency?: string;         // 'USD', 'SOL', 'ETH', etc.
    confidence?: number;       // 0-1 confidence score
  };
  collection?: {
    id: string;
    name: string;
    family?: string;
  };
  platformData?: Record<string, any>;  // Platform-specific data (blockchain address, etc.)
}

/**
 * Platform-agnostic wallet/user interface
 * Represents a user who owns NFTs and has trading preferences
 */
export interface AbstractWallet {
  id: string;                    // Platform-agnostic wallet/user ID
  ownedNFTs: AbstractNFT[];
  wantedNFTs: string[];          // NFT IDs this wallet wants (specific)
  wantedCollections?: string[];  // Collection IDs this wallet wants (any NFT from)
  metadata?: {
    displayName?: string;
    platformUserId?: string;
    email?: string;
  };
  preferences?: {
    maxTradeParticipants?: number;
    minValueThreshold?: number;
    rejectedNFTs?: string[];
    rejectedWallets?: string[];
  };
}

/**
 * Tenant configuration for white label partners
 */
export interface TenantConfig {
  id: string;
  name: string;
  apiKey: string;  // DEPRECATED: Keep for backward compatibility during migration
  hashedApiKey?: {
    hash: string;
    salt: string;
  };
  settings: {
    algorithm: {
      maxDepth: number;                    // Max participants in trade loops
      minEfficiency: number;               // Minimum efficiency threshold
      maxLoopsPerRequest: number;          // Rate limiting
      enableCollectionTrading: boolean;    // Allow collection-level wants
      enableCanonicalDiscovery?: boolean;  // Use canonical cycle engine (optional, defaults to global setting)
    };
    rateLimits: {
      discoveryRequestsPerMinute: number;
      nftSubmissionsPerDay: number;
      webhookCallsPerMinute: number;
    };
    webhooks: {
      tradeDiscoveryUrl?: string;          // URL to notify of new loops
      enabled: boolean;
    };
    security: {
      maxNFTsPerWallet: number;
      maxWantsPerWallet: number;
      minNFTValueUSD?: number;
      blacklistedCollections?: string[];
    };
  };
  metadata?: {
    industry?: string;          // 'gaming', 'collectibles', 'art', etc.
    blockchain?: string;        // 'ethereum', 'solana', 'polygon', etc.
    contactEmail?: string;
  };
  createdAt: Date;
  lastActive?: Date;
}

/**
 * Tenant's isolated trade graph state
 */
export interface TenantTradeGraph {
  tenantId: string;
  
  // Current state snapshot
  nfts: Map<string, AbstractNFT>;
  wallets: Map<string, AbstractWallet>;  
  wants: Map<string, Set<string>>;       // nftId -> Set<walletId>
  collectionWants: Map<string, Set<string>>; // collectionId -> Set<walletId>
  
  // Cached trade loops for instant retrieval
  activeLoops: Map<string, TradeLoop>;
  
  // Change detection
  lastUpdated: Date;
  changeLog: GraphChange[];
}

/**
 * Represents a change in the trade graph for delta detection
 */
export interface GraphChange {
  type: 'nft_added' | 'nft_removed' | 'want_added' | 'want_removed' | 'wallet_updated';
  timestamp: Date;
  entityId: string;              // NFT ID, wallet ID, etc.
  details?: Record<string, any>;
}

/**
 * Trade execution modes for partners
 */
export type ExecutionMode = 'informational' | 'executable';

/**
 * Blockchain format for execution instructions
 */
export type BlockchainFormat = 'ethereum' | 'solana' | 'polygon' | 'custom';

/**
 * Partner API request for trade discovery
 */
export interface TradeDiscoveryRequest {
  wallets?: AbstractWallet[];     // Submit inventory update
  walletId?: string;              // Get trades for specific wallet
  mode?: ExecutionMode;           // Response format
  settings?: {
    maxResults?: number;
    includeCollectionTrades?: boolean;
    blockchainFormat?: BlockchainFormat;
  };
}

/**
 * Partner API response for trade discovery
 */
export interface TradeDiscoveryResponse {
  success: boolean;
  trades: TradeLoop[];
  mode: ExecutionMode;
  metadata: {
    totalActiveLoops: number;
    requestProcessingTime: number;
    tenantId: string;
  };
  executionInstructions?: ComposableInstructions;
}

/**
 * Composable execution instructions for blockchain-agnostic trading
 */
export interface ComposableInstructions {
  // Base instruction set (blockchain-agnostic)
  baseInstructions: ExecutionStep[];
  
  // Composable blockchain-specific adapters
  blockchainInstructions: {
    ethereum?: EthereumInstructions;
    solana?: SolanaInstructions;
    polygon?: PolygonInstructions;
    custom?: CustomInstructions;
  };
  
  // Execution metadata
  execution: {
    totalSteps: number;
    estimatedGas: Record<string, number>; // Per blockchain
    requiredApprovals: string[];
    safetyChecks: SafetyCheck[];
    atomicityGuarantee: boolean;
  };
}

/**
 * Single execution step in a trade loop
 */
export interface ExecutionStep {
  stepIndex: number;
  from: string;                    // Wallet ID
  to: string;                      // Wallet ID
  nftIds: string[];
  instructionType: 'transfer' | 'approval' | 'swap' | 'batch_transfer';
  dependencies: number[];          // Which steps must complete first
  rollbackInstructions?: ExecutionStep[]; // For failed transactions
}

/**
 * Safety checks for trade execution
 */
export interface SafetyCheck {
  type: 'ownership_verification' | 'approval_check' | 'balance_check' | 'custom';
  description: string;
  required: boolean;
}

// Blockchain-specific instruction interfaces
export interface EthereumInstructions {
  transactions: EthereumTransaction[];
  gasEstimate: number;
  contracts: string[];
}

export interface SolanaInstructions {
  instructions: SolanaInstruction[];
  computeUnits: number;
  programIds: string[];
}

export interface PolygonInstructions {
  transactions: PolygonTransaction[];
  gasEstimate: number;
  contracts: string[];
}

export interface CustomInstructions {
  format: string;
  instructions: any[];
  metadata: Record<string, any>;
}

// Placeholder interfaces for blockchain-specific types
export interface EthereumTransaction {
  to: string;
  data: string;
  value: string;
  gasLimit: number;
}

export interface SolanaInstruction {
  programId: string;
  keys: any[];
  data: Buffer;
}

export interface PolygonTransaction {
  to: string;
  data: string;
  value: string;
  gasLimit: number;
}

// Import existing TradeLoop interface
import { TradeLoop } from './trade'; 