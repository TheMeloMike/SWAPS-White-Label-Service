/**
 * Central types file for the application
 * All shared types should be defined or re-exported from here
 */

// Re-export types from specific domains
export * from './nft';
export { 
  type TradeRequest,
  type TradeStep,
  type TradeLoop, 
  type PotentialTrade,
  type TradeResponse
} from './trade';
export * from './wallet';

// General application types

/**
 * Generic API response interface
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
} 