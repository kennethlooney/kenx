/**
 * Kenx Frontend Client
 * 
 * A standalone frontend client that can connect to any Kenx API server.
 * Perfect for deploying to static hosting (Netlify, Vercel, GitHub Pages)
 * while your API runs on a separate server (VPS, AWS, etc.)
 */

export interface KenxClientConfig {
  apiBaseUrl: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  storage?: 'localStorage' | 'sessionStorage' | 'memory';
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
  expiresIn?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  user?: User;
  token?: string; // Add token to ApiResponse for auth endpoints
  message?: string;
  error?: string;
  requestId?: string;
  status?: string; // Add status for health check
}

export interface HealthCheckResponse {
  status: string;
  [key: string]: any;
}

export class KenxFrontendClient {
  private config: KenxClientConfig;
  private token: string | null = null;
  private refreshTimer?: NodeJS.Timeout;

  constructor(config: KenxClientConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      storage: 'localStorage',
      ...config
    };

    this.loadToken();
    this.setupTokenRefresh();
  }

  // ==== TOKEN MANAGEMENT ====

  private loadToken(): void {
    try {
      if (this.config.storage === 'localStorage' && typeof localStorage !== 'undefined') {
        this.token = localStorage.getItem('kenx_token');
      } else if (this.config.storage === 'sessionStorage' && typeof sessionStorage !== 'undefined') {
        this.token = sessionStorage.getItem('kenx_token');
      }
    } catch (error) {
      console.warn('Failed to load token from storage:', error);
    }
  }

  private saveToken(token: string): void {
    this.token = token;
    try {
      if (this.config.storage === 'localStorage' && typeof localStorage !== 'undefined') {
        localStorage.setItem('kenx_token', token);
      } else if (this.config.storage === 'sessionStorage' && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('kenx_token', token);
      }
    } catch (error) {
      console.warn('Failed to save token to storage:', error);
    }
  }

  private clearToken(): void {
    this.token = null;
    try {
      if (this.config.storage === 'localStorage' && typeof localStorage !== 'undefined') {
        localStorage.removeItem('kenx_token');
      } else if (this.config.storage === 'sessionStorage' && typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('kenx_token');
      }
    } catch (error) {
      console.warn('Failed to clear token from storage:', error);
    }

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
  }

  private setupTokenRefresh(): void {
    if (this.token) {
      // Refresh token every 6 days (before 7-day expiry)
      this.refreshTimer = setTimeout(() => {
        this.refreshToken().catch(console.error);
      }, 6 * 24 * 60 * 60 * 1000);
    }
  }

  // ==== HTTP CLIENT ====

  private async request<T = any>(
    endpoint: string, 
    options: RequestInit = {},
    retryCount = 0
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.apiBaseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };

    // Add authentication token
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Add API key if configured
    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let responseData: any;
      const contentType = response.headers.get('Content-Type') || '';
      
      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = { message: await response.text() };
      }

      if (!response.ok) {
        // Handle 401 Unauthorized - token might be expired
        if (response.status === 401 && this.token && retryCount === 0) {
          try {
            await this.refreshToken();
            return this.request(endpoint, options, retryCount + 1);
          } catch (refreshError) {
            this.clearToken();
            throw new Error(responseData.message || `HTTP ${response.status}`);
          }
        }

        throw new Error(responseData.message || responseData.error || `HTTP ${response.status}`);
      }

      return responseData;

    } catch (error: any) {
      // Retry on network errors
      if (retryCount < this.config.retryAttempts! && 
          (error.name === 'TypeError' || error.name === 'AbortError')) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.request(endpoint, options, retryCount + 1);
      }

      throw error;
    }
  }

  // ==== AUTHENTICATION ====
  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName?: string;
  }): Promise<AuthResponse> {
    try {
      const response = await this.request<any>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      });

      if (response.success && response.token) {
        this.saveToken(response.token);
        this.setupTokenRefresh();
      }

      return response as AuthResponse;
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Registration failed'
      };
    }
  }

  async login(credentials: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<AuthResponse> {
    try {
      const response = await this.request<any>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });

      if (response.success && response.token) {
        this.saveToken(response.token);
        this.setupTokenRefresh();
      }

      return response as AuthResponse;
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Login failed'
      };
    }
  }

  async logout(): Promise<{ success: boolean; message?: string }> {
    try {
      if (this.token) {
        await this.request('/api/auth/logout', { method: 'POST' });
      }
      
      this.clearToken();
      
      return { success: true, message: 'Logged out successfully' };
    } catch (error: any) {
      this.clearToken(); // Clear token even if API call fails
      return { success: true, message: 'Logged out successfully' };
    }
  }

  async refreshToken(): Promise<string> {
    if (!this.token) {
      throw new Error('No token to refresh');
    }

    try {
      const response = await this.request<{ token: string }>('/api/auth/refresh', {
        method: 'POST',
      });

      if (response.success && response.token) {
        this.saveToken(response.token);
        this.setupTokenRefresh();
        return response.token;
      }

      throw new Error('Token refresh failed');
    } catch (error) {
      this.clearToken();
      throw error;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.token) {
      return null;
    }

    try {
      const response = await this.request<{ user: User }>('/api/auth/me');
      return response.success ? response.user! : null;
    } catch (error) {
      return null;
    }
  }

  // ==== USER MANAGEMENT ====

  async getProfile(): Promise<User | null> {
    if (!this.token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await this.request<{ user: User }>('/api/users/profile');
      return response.success ? response.user! : null;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get profile');
    }
  }

  async updateProfile(updates: {
    firstName?: string;
    lastName?: string;
  }): Promise<User> {
    if (!this.token) {
      throw new Error('Authentication required');
    }

    try {
      const response = await this.request<{ user: User }>('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });

      if (response.success && response.user) {
        return response.user;
      }

      throw new Error(response.message || 'Failed to update profile');
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update profile');
    }
  }

  // ==== UTILITY METHODS ====

  isAuthenticated(): boolean {
    return !!this.token;
  }

  getToken(): string | null {
    return this.token;
  }

  getApiBaseUrl(): string {
    return this.config.apiBaseUrl;
  }

  // Custom API request method for extending functionality
  async apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, options);
  }
  // ==== HEALTH CHECK ====

  async healthCheck(): Promise<HealthCheckResponse> {
    try {
      const response = await this.request<HealthCheckResponse>('/health');
      return {
        status: response.status || 'unknown',
        ...response
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: error.message || 'Health check failed'
      };
    }
  }

  // ==== API INFO ====

  async getApiInfo(): Promise<any> {
    try {
      const response = await this.request('/api');
      return response;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get API info');
    }
  }
}

// ==== REACT HOOKS (if using React) ====

export interface UseKenxClientOptions {
  apiBaseUrl: string;
  apiKey?: string;
  autoLogin?: boolean;
}

// React Hook for Kenx Client
export function useKenxClient(options: UseKenxClientOptions) {
  // This would typically use React hooks
  // For now, returning a simple client instance
  const client = new KenxFrontendClient(options);
  
  return {
    client,
    isAuthenticated: client.isAuthenticated(),
    login: client.login.bind(client),
    logout: client.logout.bind(client),
    register: client.register.bind(client),
    getCurrentUser: client.getCurrentUser.bind(client),
    getProfile: client.getProfile.bind(client),
    updateProfile: client.updateProfile.bind(client)
  };
}

// ==== VUE COMPOSABLE ====

export function useKenxApi(options: UseKenxClientOptions) {
  const client = new KenxFrontendClient(options);
  
  return {
    client,
    isAuthenticated: () => client.isAuthenticated(),
    login: client.login.bind(client),
    logout: client.logout.bind(client),
    register: client.register.bind(client),
    getCurrentUser: client.getCurrentUser.bind(client),
    getProfile: client.getProfile.bind(client),
    updateProfile: client.updateProfile.bind(client)
  };
}

// ==== VANILLA JS HELPER ====

export function createKenxClient(apiBaseUrl: string, options: Partial<KenxClientConfig> = {}) {
  return new KenxFrontendClient({
    apiBaseUrl,
    ...options
  });
}

export default KenxFrontendClient;
