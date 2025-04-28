// services/api.ts

/**
 * API Types
 */

// Base API response interface
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
  }
  
  // Active Directory Query Types
  export interface ADQueryParams {
    filter: 'computers' | 'users' | 'groups';
    query: string;
    attributes: string[];
  }
  
  export interface ADQueryResult {
    results: any[];
    totalCount: number;
    availableAttributes: string[];
  }
  
  // Error handling
  class ApiError extends Error {
    public statusCode: number;
    
    constructor(message: string, statusCode: number = 500) {
      super(message);
      this.statusCode = statusCode;
      this.name = 'ApiError';
    }
  }
  
  /**
   * API Configuration
   */
  const API_CONFIG = {
    // Default to localhost:8000 (Python backend) but allow override
    baseUrl: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
    headers: {
      'Content-Type': 'application/json',
    },
    // Default timeout in milliseconds
    timeout: 30000,
  };
  
  /**
   * Helper Functions
   */
  
  // Generic fetch wrapper with timeout and error handling
  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout: number = API_CONFIG.timeout): Promise<Response> => {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.error || `API request failed with status ${response.status}`,
          response.status
        );
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new ApiError('Request timeout exceeded', 408);
      }
      throw error;
    }
  };
  
  /**
   * API Service Methods
   */
  export const apiService = {
    /**
     * Active Directory Query Endpoints
     */
    
    // Get available attributes for an AD object type
    getAdAttributes: async (objectType: string): Promise<string[]> => {
      try {
        const response = await fetchWithTimeout(
          `${API_CONFIG.baseUrl}/ad/attributes/${objectType}`,
          {
            method: 'GET',
            headers: API_CONFIG.headers,
          }
        );
        
        const data = await response.json();
        return data.attributes || [];
      } catch (error) {
        console.error('Error fetching AD attributes:', error);
        throw error;
      }
    },
    
    // Query Active Directory
    queryAD: async (params: ADQueryParams): Promise<ADQueryResult> => {
      try {
        const response = await fetchWithTimeout(
          `${API_CONFIG.baseUrl}/ad/query`,
          {
            method: 'POST',
            headers: API_CONFIG.headers,
            body: JSON.stringify(params),
          }
        );
        
        return await response.json();
      } catch (error) {
        console.error('Error querying Active Directory:', error);
        throw error;
      }
    },
    
    /**
     * Utility Methods
     */
    
    // Check API health/connection
    checkConnection: async (): Promise<boolean> => {
      try {
        const response = await fetchWithTimeout(
          `${API_CONFIG.baseUrl}/health`,
          {
            method: 'GET',
            headers: API_CONFIG.headers,
          },
          5000 // Short timeout for health check
        );
        
        const data = await response.json();
        return data.status === 'ok';
      } catch (error) {
        console.error('API connection check failed:', error);
        return false;
      }
    },
    
    // Helper to extract error messages
    formatErrorMessage: (error: any): string => {
      if (error instanceof ApiError) {
        return error.message;
      }
      
      if (error instanceof Error) {
        return error.message;
      }
      
      return 'An unknown error occurred';
    }
  };
  
  /**
   * Export default for convenience
   */
  export default apiService;