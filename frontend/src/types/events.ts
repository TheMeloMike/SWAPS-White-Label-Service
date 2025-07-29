import { NFTMetadata } from './nft';

/**
 * Custom event name for pending searches
 */
export const PENDING_SEARCH_EVENT = 'swaps:pendingSearch';

/**
 * Interface for pending search event data
 */
export interface PendingSearchEvent {
  id: string;
  searchedNFT: NFTMetadata;
  initiatedAt: Date;
} 