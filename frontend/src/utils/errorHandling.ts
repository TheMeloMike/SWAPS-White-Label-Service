/**
 * Error handling utilities for consistent error handling across the application
 */

/**
 * Formats an error into a user-friendly message
 * @param error The error to format
 * @returns A user-friendly error message
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (typeof error === 'object' && error !== null) {
    // Try to extract message from error object
    if ('message' in error && typeof (error as any).message === 'string') {
      return (error as any).message;
    }
    
    try {
      return JSON.stringify(error);
    } catch (e) {
      return 'Unknown error occurred';
    }
  }
  
  return 'Unknown error occurred';
}

/**
 * Logs an error to the console with a custom message
 * @param error The error to log
 * @param context An optional context message
 */
export function logError(error: unknown, context?: string): void {
  const message = context ? `Error in ${context}: ` : 'Error: ';
  
  if (error instanceof Error) {
    console.error(message, error.message, '\n', error.stack);
  } else {
    console.error(message, error);
  }
}

/**
 * Check if a Solana transaction error is due to user rejection
 * @param error The error to check
 * @returns True if the error is due to user rejection
 */
export function isUserRejectedError(error: unknown): boolean {
  const errorMessage = formatError(error).toLowerCase();
  
  return (
    errorMessage.includes('user rejected') ||
    errorMessage.includes('cancelled by user') ||
    errorMessage.includes('rejected by user') ||
    errorMessage.includes('transaction was not confirmed')
  );
}

/**
 * Check if a Solana transaction error is due to insufficient funds
 * @param error The error to check
 * @returns True if the error is due to insufficient funds
 */
export function isInsufficientFundsError(error: unknown): boolean {
  const errorMessage = formatError(error).toLowerCase();
  
  return (
    errorMessage.includes('insufficient funds') ||
    errorMessage.includes('insufficient lamports') ||
    errorMessage.includes('insufficient sol')
  );
}

/**
 * Get a user-friendly error message based on common Solana errors
 * @param error The error to get a message for
 * @returns A user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  const errorMessage = formatError(error).toLowerCase();
  
  if (isUserRejectedError(error)) {
    return 'Transaction was cancelled';
  }
  
  if (isInsufficientFundsError(error)) {
    return 'Insufficient funds to complete the transaction';
  }
  
  if (errorMessage.includes('blockhash not found')) {
    return 'Transaction expired, please try again';
  }
  
  // Return the original error if no friendly message is found
  return formatError(error);
} 