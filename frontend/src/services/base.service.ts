import { logError, isNetworkError } from '@/utils/errors/errorHandler';

/**
 * Base service class with common API functionality
 */
export class BaseService {
  protected API_BASE: string;
  
  constructor() {
    // First check for environment variable
    const envApiUrl = process.env.NEXT_PUBLIC_API_URL;
    
    // If not set, check if we have a port defined and build the URL
    const apiPort = process.env.NEXT_PUBLIC_API_PORT || '3001';
    
    // Determine if we're running in production or development
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (envApiUrl) {
      // Use explicit API URL if provided
      this.API_BASE = envApiUrl;
    } else if (isProduction) {
      // In production, default to same host but with API subdomain
      this.API_BASE = window.location.origin.replace(/^https?:\/\//, 'https://api.');
    } else {
      // In development, use localhost with port
      this.API_BASE = `http://localhost:${apiPort}`;
    }
    
    console.log(`API base URL configured as: ${this.API_BASE}`);
  }
  
  /**
   * Helper to retry API calls in case of network failures
   * @param apiCallFn The API call function to retry
   * @param maxRetries Maximum number of retry attempts
   * @param retryDelay Initial delay in milliseconds before retrying (will increase exponentially)
   * @returns Result of the API call
   */
  protected async withRetry<T>(
    apiCallFn: () => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await apiCallFn();
      } catch (error) {
        lastError = error;
        
        // Use our isNetworkError utility to determine if we should retry
        const shouldRetry = isNetworkError(error) && attempt < maxRetries - 1;
        
        if (!shouldRetry) {
          // Log the error with context before rethrowing
          logError(error, `API call (attempt ${attempt + 1}/${maxRetries})`);
          throw error;
        }
        
        // Log the retry attempt
        console.warn(`API call failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${retryDelay}ms...`);
        
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2; // Exponential backoff
      }
    }
    
    // Should never reach here but TypeScript requires a return
    throw lastError;
  }
  
  /**
   * Performs a GET request to the API with automatic retries for network errors
   * @param endpoint API endpoint to call
   * @param options Optional request options including headers
   * @returns The API response, parsed as JSON
   */
  protected async apiGet<T>(endpoint: string, options?: { headers?: Record<string, string> }): Promise<T> {
    return this.withRetry(async () => {
      try {
        const response = await fetch(`${this.API_BASE}${endpoint}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
          },
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        return await response.json() as T;
      } catch (error) {
        // Just rethrow the error - withRetry will handle logging and retries
        throw error;
      }
    });
  }
  
  /**
   * Performs a POST request to the API with automatic retries for network errors
   * @param endpoint API endpoint to call
   * @param data Data to send in the request body
   * @param options Optional request options including headers
   * @returns The API response, parsed as JSON
   */
  protected async apiPost<T>(endpoint: string, data: any, options?: { headers?: Record<string, string> }): Promise<T> {
    return this.withRetry(async () => {
      try {
        const response = await fetch(`${this.API_BASE}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
          },
          body: JSON.stringify(data),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        return await response.json() as T;
      } catch (error) {
        // Just rethrow the error - withRetry will handle logging and retries
        throw error;
      }
    });
  }

  /**
   * Performs a DELETE request to the API with automatic retries for network errors
   * @param endpoint API endpoint to call
   * @returns The API response, parsed as JSON
   */
  protected async apiDelete<T>(endpoint: string): Promise<T> {
    return this.withRetry(async () => {
      try {
        const response = await fetch(`${this.API_BASE}${endpoint}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        return await response.json() as T;
      } catch (error) {
        // Just rethrow the error - withRetry will handle logging and retries
        throw error;
      }
    });
  }

  /**
   * Safely check if an API endpoint exists without logging errors
   * This is useful for checking if an endpoint is implemented yet
   * @param endpoint The API endpoint to check
   * @returns True if the endpoint exists and returns a status other than 404
   */
  protected async checkApiEndpointExists(endpoint: string): Promise<boolean> {
    try {
      // Use fetch directly to avoid the error logging in the apiGet method
      const response = await fetch(`${this.API_BASE}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      // If it returns anything other than 404, consider the endpoint as "existing"
      // Even if it's an error, at least the route exists
      return response.status !== 404;
    } catch (error) {
      // Network errors mean the API itself doesn't exist
      return false;
    }
  }
} 