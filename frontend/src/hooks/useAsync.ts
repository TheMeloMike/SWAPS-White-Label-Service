import { useState, useCallback, useEffect } from 'react';
import { logError, getUserFriendlyMessage, isUserRejection } from '@/utils/errors/errorHandler';
import { useToastMessage } from '@/utils/context/ToastContext';

interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  isSuccess: boolean;
}

interface UseAsyncOptions {
  immediate?: boolean;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  successMessage?: string;
  context?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

/**
 * A custom hook for handling asynchronous operations with loading, error, and success states.
 * Also integrates with the toast system for showing success/error messages.
 * 
 * @param asyncFunction The async function to execute
 * @param options Configuration options
 * @returns The async state and execute function
 */
function useAsync<T = any>(
  asyncFunction: (...args: any[]) => Promise<T>,
  options: UseAsyncOptions = {}
) {
  const {
    immediate = false,
    showSuccessToast = false,
    showErrorToast = true,
    successMessage = 'Operation completed successfully',
    context = 'async operation',
    onSuccess,
    onError,
  } = options;

  const toast = useToastMessage();

  // State for tracking loading, error, and data
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    isLoading: immediate,
    error: null,
    isSuccess: false,
  });

  // Function to execute the async operation
  const execute = useCallback(
    async (...args: any[]) => {
      setState({
        data: null,
        isLoading: true,
        error: null,
        isSuccess: false,
      });

      try {
        const data = await asyncFunction(...args);
        
        setState({
          data,
          isLoading: false,
          error: null,
          isSuccess: true,
        });
        
        // Show success toast if enabled
        if (showSuccessToast) {
          toast.success(successMessage);
        }
        
        // Call onSuccess callback if provided
        if (onSuccess) {
          onSuccess(data);
        }
        
        return data;
      } catch (error: any) {
        // Log the error
        logError(error, context);
        
        // Create an Error object if it's not already one
        const errorObj = error instanceof Error ? error : new Error(String(error));
        
        setState({
          data: null,
          isLoading: false,
          error: errorObj,
          isSuccess: false,
        });
        
        // Show error toast if enabled and not a user rejection
        if (showErrorToast && !isUserRejection(error)) {
          toast.error(getUserFriendlyMessage(error));
        }
        
        // Call onError callback if provided
        if (onError) {
          onError(errorObj);
        }
        
        throw errorObj;
      }
    },
    [asyncFunction, showSuccessToast, showErrorToast, successMessage, toast, context, onSuccess, onError]
  );

  // Execute the async function immediately if immediate is true
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  // Reset the state
  const reset = useCallback(() => {
    setState({
      data: null,
      isLoading: false,
      error: null,
      isSuccess: false,
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

export default useAsync; 