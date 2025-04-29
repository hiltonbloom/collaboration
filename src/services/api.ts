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

// Paginated results interface
export interface PaginatedResponse<T> {
  results: T[];
  total_count: number;
  current_page: number;
  total_pages: number;
  has_next_page: boolean;
  session_id: string;
  is_count_exact: boolean;
}

// Active Directory Query Types
export interface ADQueryParams {
  filter: 'computers' | 'users' | 'groups';
  query: string;
  attributes: string[];
  ou_paths?: string[];
  page_size?: number;
}

export interface ADQueryResult {
  results: any[];
  total_count: number;
  availableAttributes: string[];
}

export interface ADObject {
  [key: string]: any;
}

export interface AllResultsResponse {
  results: ADObject[];
  total_count: number;
  is_complete: boolean;
  is_count_exact: boolean;
  fetched_count: number;
}

export interface ExportParams {
  session_id: string;
  format: 'csv' | 'json';
  selected_only: boolean;
  selected_ids?: string[];
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
        errorData.error || errorData.detail || `API request failed with status ${response.status}`,
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
  
  // Initial query to Active Directory (returns first page)
  queryAD: async (params: ADQueryParams): Promise<PaginatedResponse<ADObject>> => {
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
  
  // Get a specific page of results
  getPage: async (sessionId: string, pageNumber: number): Promise<PaginatedResponse<ADObject>> => {
    try {
      const response = await fetchWithTimeout(
        `${API_CONFIG.baseUrl}/ad/query/page/${sessionId}?page_number=${pageNumber}`,
        {
          method: 'GET',
          headers: API_CONFIG.headers,
        }
      );
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching page:', error);
      throw error;
    }
  },
  
  // Get all results for a query
  getAllResults: async (sessionId: string, maxResults: number = 0): Promise<AllResultsResponse> => {
    try {
      const response = await fetchWithTimeout(
        `${API_CONFIG.baseUrl}/ad/query/all/${sessionId}?max_results=${maxResults}`,
        {
          method: 'GET',
          headers: API_CONFIG.headers,
        },
        // Longer timeout for potentially large result sets
        60000
      );
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching all results:', error);
      throw error;
    }
  },
  
  // Export results in specified format
  exportResults: async (params: ExportParams): Promise<string> => {
    try {
      let url = `${API_CONFIG.baseUrl}/ad/query/export/${params.session_id}?format=${params.format}`;
      
      if (params.selected_only && params.selected_ids && params.selected_ids.length > 0) {
        url += `&selected_only=true`;
        params.selected_ids.forEach(id => {
          url += `&selected_ids=${encodeURIComponent(id)}`;
        });
      }
      
      const response = await fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: API_CONFIG.headers,
        },
        // Longer timeout for exports
        60000
      );
      
      const data = await response.json();
      return data.download_url || '';
    } catch (error) {
      console.error('Error exporting results:', error);
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