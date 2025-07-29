import { LoggingService } from '../../utils/logging/LoggingService';

/**
 * Utility for parallelizing function execution with concurrency control
 * 
 * @param fn Function that returns promises to be executed in parallel
 * @param options Configuration options for parallelization
 * @returns Promise that resolves to an array of results
 */
export async function parallelize<T>(
  fn: () => Promise<T>[],
  options: { maxConcurrency?: number } = {}
): Promise<T[]> {
  const logger = LoggingService.getInstance().createLogger('parallelize');
  const operation = logger.operation('execute');
  
  // Default to 4 concurrent operations if not specified
  const maxConcurrency = options.maxConcurrency || 4;
  
  try {
    // Execute the function to get promises
    const promises = fn();
    
    // If we don't need concurrency control, just use Promise.all
    if (promises.length <= maxConcurrency) {
      operation.info('Using Promise.all for small batch', { count: promises.length });
      const results = await Promise.all(promises);
      operation.end();
      return results;
    }
    
    // For larger batches, we need to control concurrency
    operation.info('Executing parallel operations with concurrency control', {
      totalOperations: promises.length,
      maxConcurrency,
      batches: Math.ceil(promises.length / maxConcurrency)
    });
    
    // Create batches based on concurrency limit
    const batches: Promise<T>[][] = [];
    for (let i = 0; i < promises.length; i += maxConcurrency) {
      batches.push(promises.slice(i, i + maxConcurrency));
    }
    
    // Process batches sequentially
    const results: T[] = [];
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      operation.info('Processing batch', { 
        batchNumber: i + 1, 
        batchSize: batch.length, 
        totalBatches: batches.length 
      });
      
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }
    
    operation.info('Parallel execution completed successfully', { 
      totalResults: results.length 
    });
    operation.end();
    return results;
  } catch (error) {
    operation.error('Error in parallel execution', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    operation.end();
    
    // Re-throw the error to allow proper handling upstream
    // This is better than returning an empty array which can cause type issues
    throw error;
  }
} 