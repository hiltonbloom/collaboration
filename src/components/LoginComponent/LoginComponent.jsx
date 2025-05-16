// src/components/LoginComponent/LoginComponent.jsx
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

// Auth Provider component to wrap the application
export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(null);

    // Check for existing session on component mount
    useEffect(() => {
        const checkSession = async () => {
            try {
                // Check if we have a stored session
                const storedSession = localStorage.getItem('adauth_session');

                if (storedSession) {
                    const sessionData = JSON.parse(storedSession);
                    setIsAuthenticated(true);
                    setUser(sessionData.user);
                }
            } catch (error) {
                console.error('Session verification error:', error);
            } finally {
                setLoading(false);
            }
        };

        checkSession();
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            // Refresh every 30 minutes
            const refreshInterval = setInterval(() => {
                refreshSession();
            }, 30 * 60 * 1000);
            
            return () => clearInterval(refreshInterval);
        }
    }, [isAuthenticated]);

    const login = async (username, password, domain) => {
        try {
            const response = await fetch('http://localhost:2222/api/auth/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    password,
                    domain,
                })
            });
    
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Login failed');
            }
    
            const data = await response.json();
    
            if (!data.success) {
                throw new Error(data.message || 'Authentication failed');
            }
    
            // Store the token and user info
            localStorage.setItem('adauth_session', JSON.stringify({
                user: data.user_info,
                token: data.token
            }));
    
            // Update state
            setIsAuthenticated(true);
            setUser(data.user_info);
            setToken(data.token);
    
            return { success: true };
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                message: error.message || 'Authentication failed.'
            };
        }
    };

    const logout = async () => {
        try {
            // Call logout endpoint
            await fetch('http://localhost:2222/api/auth/logout', {
                method: 'POST',
                headers: getAuthHeader()
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear local session data
            localStorage.removeItem('adauth_session');
            setIsAuthenticated(false);
            setUser(null);
            setToken(null);
        }
    };

    // Get auth header for API requests
    const getAuthHeader = () => {
        const storedSession = localStorage.getItem('adauth_session');
        if (!storedSession) return {};
        
        const parsedSession = JSON.parse(storedSession);
        return {
            'Authorization': `Bearer ${parsedSession.token || ""}`
        };
    };

    // Test LDAP connection
    const testConnection = async (username, password, domain) => {
        try {
            // Encrypt password for transmission
            const iv = CryptoJS.lib.WordArray.random(12);
            const encrypted = CryptoJS.AES.encrypt(password, ENCRYPTION_KEY, {
                iv: iv,
                mode: CryptoJS.mode.GCM
            });

            // Combine IV and ciphertext
            const ivCiphertext = iv.concat(encrypted.ciphertext);
            const encryptedCredential = CryptoJS.enc.Base64.stringify(ivCiphertext);

            // Call the test-connection endpoint
            const response = await fetch('/api/auth/test-connection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    domain,
                    encrypted_credential: encryptedCredential
                })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Connection test error:', error);
            return {
                connected: false,
                message: error.message || 'Connection test failed'
            };
        }
    };

    // Configure LDAP server
    const configureLdapServer = async (serverName) => {
        try {
            const response = await fetch('/api/config/ldap-server', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    server_name: serverName
                })
            });

            return await response.json();
        } catch (error) {
            console.error('LDAP server configuration error:', error);
            return {
                success: false,
                message: error.message || 'Failed to configure LDAP server'
            };
        }
    };

    const refreshSession = async () => {
        try {
            const response = await fetch('http://localhost:2222/api/auth/refresh', {
                method: 'POST',
                headers: {
                    ...getAuthHeader(),
                    'Content-Type': 'application/json'
                }
            });
    
            if (!response.ok) {
                // Token is invalid, log the user out
                logout();
                return false;
            }
    
            return true;
        } catch (error) {
            console.error('Session refresh error:', error);
            return false;
        }
    };

    // Provide auth context to children
    return (
        <AuthContext.Provider value={{
            isAuthenticated,
            user,
            loading,
            login,
            logout,
            testConnection,
            configureLdapServer,
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
    const [domain, setDomain] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showServerConfig, setShowServerConfig] = useState(false);
    const [serverName, setServerName] = useState('');

    const { login, testConnection, configureLdapServer } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!username || !password || !domain) {
            setError('Username, password, and domain are required');
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            const result = await login(username, password, domain);

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

    const handleTestConnection = async () => {
        if (!username || !password || !domain) {
            setError('Username, password, and domain are required');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const result = await testConnection(username, password, domain);
            if (result.connected) {
                alert('Connection successful!');
            } else {
                setError(`Connection failed: ${result.message}`);
            }
        } catch (error) {
            setError(`Connection test failed: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfigureServer = async () => {
        if (!serverName) {
            setError('Server name is required');
            return;
        }

        setIsLoading(true);

        try {
            const result = await configureLdapServer(serverName);
            if (result.success) {
                alert(`LDAP server configured: ${result.current_config.ldap_url}`);
                setDomain(result.current_config.ldap_server);
                setShowServerConfig(false);
            } else {
                setError('Failed to configure LDAP server');
            }
        } catch (error) {
            setError(`Failed to configure LDAP server: ${error.message}`);
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
                                    placeholder="username"
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

                        <div className="mb-6">
                            <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="domain">
                                Domain
                            </label>
                            <div className="relative flex">
                                <input
                                    id="domain"
                                    type="text"
                                    className="block w-full pr-3 py-2 border border-gray-300 rounded-l-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                                    placeholder="e.g., ad.example.com"
                                    value={domain}
                                    onChange={(e) => setDomain(e.target.value)}
                                    disabled={isLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowServerConfig(!showServerConfig)}
                                    className="px-4 py-2 border border-gray-300 border-l-0 rounded-r-md bg-gray-50 text-gray-700 hover:bg-gray-100"
                                >
                                    Configure
                                </button>
                            </div>
                        </div>

                        {showServerConfig && (
                            <div className="mb-6 p-4 bg-gray-50 rounded-md border border-gray-200">
                                <h3 className="text-sm font-medium text-gray-700 mb-2">Configure LDAP Server</h3>
                                <div className="mb-3">
                                    <input
                                        type="text"
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                                        placeholder="e.g., GG-GGG.ad.domain.com"
                                        value={serverName}
                                        onChange={(e) => setServerName(e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        type="button"
                                        onClick={handleConfigureServer}
                                        disabled={isLoading}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"
                                    >
                                        Save
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowServerConfig(false)}
                                        className="flex-1 px-3 py-2 border border-transparent rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex space-x-3">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="flex-1 flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
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

                            <button
                                type="button"
                                onClick={handleTestConnection}
                                disabled={isLoading}
                                className="px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"
                            >
                                Test Connection
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default LoginComponent;