import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminAuthService } from '@/services/adminAuth';

export interface AdminAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  admin: {
    username: string;
    isAdmin: boolean;
  } | null;
  error: string | null;
}

export const useAdminAuth = () => {
  const [authState, setAuthState] = useState<AdminAuthState>({
    isAuthenticated: false,
    isLoading: true,
    admin: null,
    error: null
  });
  
  const router = useRouter();
  const adminAuth = AdminAuthService.getInstance();

  useEffect(() => {
    const validateAuth = async () => {
      try {
        if (!adminAuth.isAuthenticated()) {
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            admin: null,
            error: 'Not authenticated'
          });
          return;
        }

        const validation = await adminAuth.validateToken();
        
        if (validation.success && validation.admin) {
          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            admin: validation.admin,
            error: null
          });
        } else {
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            admin: null,
            error: validation.message || 'Authentication failed'
          });
        }
      } catch (error) {
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          admin: null,
          error: 'Authentication validation failed'
        });
      }
    };

    validateAuth();
  }, [adminAuth]);

  const logout = async () => {
    try {
      await adminAuth.logout();
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        admin: null,
        error: null
      });
      router.push('/admin/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const redirectToLogin = () => {
    router.push('/admin/login');
  };

  return {
    ...authState,
    logout,
    redirectToLogin
  };
}; 