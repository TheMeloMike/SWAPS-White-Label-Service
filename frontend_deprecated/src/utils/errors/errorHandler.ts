// Add type declarations for Sentry at the top of the file
declare global {
  interface Window {
    SENTRY_ENABLED?: boolean;
    Sentry?: {
      withScope: (callback: (scope: any) => void) => void;
      captureException: (error: any) => void;
    };
  }
}

/**
 * Error handling utility to standardize error messages and logging across the application.
 * This helps ensure consistent user feedback and proper error tracking.
 */

// Error categories for grouping similar errors
export enum ErrorCategory {
  NETWORK = 'network',
  WALLET = 'wallet',
  CONTRACT = 'contract',
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  UNEXPECTED = 'unexpected',
}

// Interface for structured error information
export interface ErrorInfo {
  message: string;          // User-friendly message
  category: ErrorCategory;  // Error category
  technical?: string;       // Technical details (not shown to user)
  action?: string;          // Suggested action for the user to take
  original?: unknown;       // Original error object
}

/**
 * Categorizes and formats error information from any error object
 */
export function categorizeError(error: unknown): ErrorInfo {
  // Default error info for unexpected errors
  let errorInfo: ErrorInfo = {
    message: 'Something unexpected happened',
    category: ErrorCategory.UNEXPECTED,
    technical: 'Unknown error occurred',
  };

  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    
    // Network errors
    if (
      errorMessage.includes('failed to fetch') ||
      errorMessage.includes('network') ||
      errorMessage.includes('cors') ||
      errorMessage.includes('timeout') ||
      error instanceof TypeError
    ) {
      errorInfo = {
        message: 'Connection issue detected',
        category: ErrorCategory.NETWORK,
        technical: error.message,
        action: 'Please check your internet connection and try again',
        original: error,
      };
    }
    // Wallet errors
    else if (
      errorMessage.includes('wallet') ||
      errorMessage.includes('rejected') ||
      errorMessage.includes('cancelled') ||
      errorMessage.includes('denied') ||
      errorMessage.includes('user rejected')
    ) {
      errorInfo = {
        message: 'Transaction was cancelled',
        category: ErrorCategory.WALLET,
        technical: error.message,
        action: "You can try again when you're ready",
        original: error,
      };
    }
    // Blockchain contract errors
    else if (
      errorMessage.includes('contract') ||
      errorMessage.includes('program') ||
      errorMessage.includes('instruction') ||
      errorMessage.includes('account') ||
      errorMessage.includes('blockhash') ||
      errorMessage.includes('transaction')
    ) {
      errorInfo = {
        message: 'Blockchain transaction issue',
        category: ErrorCategory.CONTRACT,
        technical: error.message,
        action: 'Please try again or contact support if the issue persists',
        original: error,
      };
      
      // More specific contract errors
      if (errorMessage.includes('insufficient funds')) {
        errorInfo.message = 'Insufficient funds for transaction';
        errorInfo.action = 'Please add more SOL to your wallet to cover the transaction fees';
      } else if (errorMessage.includes('simulation failed')) {
        errorInfo.message = 'Transaction simulation failed';
        errorInfo.action = 'There may be an issue with this operation. Please try again later';
      }
    }
    // Validation errors
    else if (
      errorMessage.includes('invalid') ||
      errorMessage.includes('required') ||
      errorMessage.includes('not found') ||
      errorMessage.includes('missing')
    ) {
      errorInfo = {
        message: 'Invalid input or request',
        category: ErrorCategory.VALIDATION,
        technical: error.message,
        action: 'Please check your input and try again',
        original: error,
      };
    }
    // Default for other Error instances
    else {
      errorInfo = {
        message: error.message,
        category: ErrorCategory.UNEXPECTED,
        technical: error.stack || error.message,
        original: error,
      };
    }
  }
  
  return errorInfo;
}

/**
 * Logs an error to the console and potentially to a monitoring service
 * 
 * @param error The error to log
 * @param context Additional context for the error (string or object)
 */
export function logError(error: unknown, context?: string | Record<string, any>): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  if (context) {
    if (typeof context === 'string') {
      console.error(`Error in ${context}:`, errorMessage);
    } else {
      console.error(`Error:`, errorMessage, 'Context:', context);
    }
  } else {
    console.error(`Error:`, errorMessage);
  }
  
  // TODO: Send error to monitoring service when available
}

/**
 * Gets a user-friendly error message
 */
export function getUserFriendlyMessage(error: unknown): string {
  const errorInfo = categorizeError(error);
  return errorInfo.action 
    ? `${errorInfo.message}. ${errorInfo.action}.` 
    : errorInfo.message;
}

/**
 * Checks if an error is a user rejection/cancellation
 */
export function isUserRejection(error: unknown): boolean {
  // Handle the custom UserRejectedError name
  if (error instanceof Error && error.name === 'UserRejectedError') {
    return true;
  }
  
  const errorInfo = categorizeError(error);
  return errorInfo.category === ErrorCategory.WALLET;
}

/**
 * Checks if an error is a network-related error
 */
export function isNetworkError(error: unknown): boolean {
  const errorInfo = categorizeError(error);
  return errorInfo.category === ErrorCategory.NETWORK;
} 