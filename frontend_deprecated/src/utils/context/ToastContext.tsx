import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import styled from 'styled-components';
import Toast, { ToastType } from '@/components/common/Toast';

// Unique ID for toasts
let toastId = 0;

// Interface for a single toast item
interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// Interface for the toast context
interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  hideToast: (id: string) => void;
}

// Default context value
const defaultToastContext: ToastContextType = {
  showToast: () => {},
  hideToast: () => {},
};

// Create the context
const ToastContext = createContext<ToastContextType>(defaultToastContext);

// Container for toast notifications positioned at the top of the screen
const ToastContainer = styled.div`
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  pointer-events: none; // Allow clicking through the container
  
  > * {
    pointer-events: auto; // Re-enable pointer events for children
  }
`;

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  
  // Show a new toast notification
  const showToast = useCallback((
    message: string, 
    type: ToastType = 'info', 
    duration = 5000
  ) => {
    const id = `toast-${toastId++}`;
    setToasts(prevToasts => [...prevToasts, { id, type, message, duration }]);
    return id;
  }, []);
  
  // Hide a specific toast notification
  const hideToast = useCallback((id: string) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  }, []);
  
  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <ToastContainer>
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            id={toast.id}
            type={toast.type}
            message={toast.message}
            duration={toast.duration}
            onDismiss={hideToast}
          />
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  );
};

// Custom hook to use the toast context
export const useToast = () => useContext(ToastContext);

// Convenience methods for different toast types
export const useToastMessage = () => {
  const { showToast } = useToast();
  
  return {
    success: (message: string, duration?: number) => 
      showToast(message, 'success', duration),
    
    error: (message: string, duration?: number) => 
      showToast(message, 'error', duration),
    
    warning: (message: string, duration?: number) => 
      showToast(message, 'warning', duration),
    
    info: (message: string, duration?: number) => 
      showToast(message, 'info', duration),
  };
};

export default ToastContext; 