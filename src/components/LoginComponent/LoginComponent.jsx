// src/components/Auth/LoginComponent.jsx
import React, { useState, useEffect, createContext, useContext } from 'react';
import { X, LogIn, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';
import CryptoJS from 'crypto-js';

// Create an Auth Context for storing authentication state
export const AuthContext = createContext();

// Custom hook for easily accessing the auth context
export const useAuth = () => useContext(AuthContext);

// Secret key for local encryption (in a real app, use a more secure approach)
const ENCRYPTION_KEY = 'AD_QUERY_TOOL_SECRET_KEY';

// Helper for encrypting sensitive data
const encryptData = (data) => {
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
};

// Helper for decrypting data
const decryptData = (encryptedData) => {
  const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// Auth Provider component to wrap the application
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on component mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Check if we have a stored session
        const storedSession = localStorage.getItem('adauth_session');
        
        if (storedSession) {
          const sessionData = JSON.parse(storedSession);
          const token = sessionData.token;
          
          // Verify session validity with the backend
          const response = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            setIsAuthenticated(true);
            setUser(userData.user);
          } else {
            // Session invalid, clear storage
            localStorage.removeItem('adauth_session');
          }
        }
      } catch (error) {
        console.error('Session verification error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    checkSession();
  }, []);

  // Login function
  const login = async (username, password) => {
    try {
      // Encrypt password client-side before transmission
      const encryptedPassword = encryptData(password);
      
      // Send login request to backend
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          password: encryptedPassword,
          encrypted: true
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }
      
      const data = await response.json();
      
      // Store the session data securely
      localStorage.setItem('adauth_session', JSON.stringify({
        token: data.token,
        expiry: data.expiry
      }));
      
      // Update state
      setIsAuthenticated(true);
      setUser(data.user);
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        message: error.message || 'Authentication failed. Please check your credentials and try again.'
      };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      // Call logout endpoint if needed
      const storedSession = localStorage.getItem('adauth_session');
      if (storedSession) {
        const sessionData = JSON.parse(storedSession);
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.token}`
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local session data
      localStorage.removeItem('adauth_session');
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  // Get auth header for API requests
  const getAuthHeader = () => {
    const storedSession = localStorage.getItem('adauth_session');
    if (!storedSession) return {};
    
    const sessionData = JSON.parse(storedSession);
    return {
      'Authorization': `Bearer ${sessionData.token}`
    };
  };

  // Provide auth context to children
  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      user, 
      loading,
      login, 
      logout,
      getAuthHeader
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// The main login component
const LoginComponent = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      setError('Username and password are required');
      return;
    }
    
    setError('');
    setIsLoading(true);
    
    try {
      const result = await login(username, password);
      
      if (result.success) {
        setShowSuccess(true);
        // Reset form
        setUsername('');
        setPassword('');
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-blue-500 py-6 px-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Active Directory Login</h2>
            <Lock className="text-white" size={24} />
          </div>
          <p className="text-white text-opacity-80 mt-1">
            Sign in with your network credentials
          </p>
        </div>
        
        {showSuccess ? (
          <div className="p-8">
            <div className="flex flex-col items-center justify-center py-4">
              <CheckCircle className="text-green-500 mb-2" size={48} />
              <h3 className="text-xl font-medium text-gray-800">Login Successful</h3>
              <p className="text-gray-600 text-center mt-2">
                You are now authenticated and can access the Active Directory Query Tool.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-8">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4 flex items-center">
                <AlertCircle className="mr-2 text-red-500" size={20} />
                <span>{error}</span>
                <button 
                  type="button"
                  className="absolute top-3 right-3 text-red-500"
                  onClick={() => setError('')}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="username">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="text-gray-400" size={18} />
                </div>
                <input
                  id="username"
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  placeholder="domain\username or username@domain.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="text-gray-400" size={18} />
                </div>
                <input
                  id="password"
                  type="password"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Your network password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <button
              type="submit"
              className={`w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
                isLoading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="mr-2" size={18} />
                  Sign in
                </>
              )}
            </button>
            
            <div className="mt-4 text-center text-sm text-gray-600">
              <p>This authentication is secured using encryption.</p>
              <p className="mt-1">Contact your IT administrator if you need assistance.</p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginComponent;