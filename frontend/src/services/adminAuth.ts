import { BaseService } from './base.service';

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminLoginResponse {
  success: boolean;
  token?: string;
  expiresIn?: string;
  message: string;
}

export interface AdminValidationResponse {
  success: boolean;
  admin?: {
    username: string;
    isAdmin: boolean;
  };
  message: string;
}

export class AdminAuthService extends BaseService {
  private static instance: AdminAuthService;
  private token: string | null = null;
  private tokenKey = 'swaps_admin_token';

  private constructor() {
    super();
    // Load token from localStorage on initialization
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem(this.tokenKey);
    }
  }

  public static getInstance(): AdminAuthService {
    if (!AdminAuthService.instance) {
      AdminAuthService.instance = new AdminAuthService();
    }
    return AdminAuthService.instance;
  }

  /**
   * Admin login
   */
  public async login(credentials: AdminLoginRequest): Promise<AdminLoginResponse> {
    try {
      const response = await fetch(`${this.API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (data.success && data.token) {
        this.setToken(data.token);
      }

      return data;
    } catch (error) {
      console.error('Admin login error:', error);
      return {
        success: false,
        message: 'Login failed due to network error'
      };
    }
  }

  /**
   * Admin logout
   */
  public async logout(): Promise<void> {
    try {
      if (this.token) {
        await fetch(`${this.API_BASE}/api/admin/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearToken();
    }
  }

  /**
   * Validate admin token
   */
  public async validateToken(): Promise<AdminValidationResponse> {
    if (!this.token) {
      return {
        success: false,
        message: 'No admin token found'
      };
    }

    try {
      const response = await fetch(`${this.API_BASE}/api/admin/validate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!data.success) {
        this.clearToken();
      }

      return data;
    } catch (error) {
      console.error('Token validation error:', error);
      this.clearToken();
      return {
        success: false,
        message: 'Token validation failed'
      };
    }
  }

  /**
   * Get current admin token
   */
  public getToken(): string | null {
    return this.token;
  }

  /**
   * Check if admin is authenticated
   */
  public isAuthenticated(): boolean {
    return !!this.token;
  }

  /**
   * Get authorization header for API requests
   */
  public getAuthHeader(): { Authorization: string } | {} {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  /**
   * Set admin token
   */
  private setToken(token: string): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.tokenKey, token);
    }
  }

  /**
   * Clear admin token
   */
  private clearToken(): void {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.tokenKey);
    }
  }
} 