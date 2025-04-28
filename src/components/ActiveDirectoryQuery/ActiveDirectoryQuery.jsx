import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import './ActiveDirectoryQuery.css';
import apiService from '../../services/api.ts';

const ActiveDirectoryQuery = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [detailView, setDetailView] = useState(null);
  const [availableAttributes, setAvailableAttributes] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [filter, setFilter] = useState("computers");
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  
  const itemsPerPage = 5;
  
  // Check API connection on component mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const isConnected = await apiService.checkConnection();
        setConnectionStatus(isConnected);
      } catch (error) {
        setConnectionStatus(false);
        setError("Cannot connect to the API server. Please check your backend setup.");
      }
    };
    
    checkConnection();
  }, []);
  
  // Fetch available attributes when filter type changes
  useEffect(() => {
    fetchAttributes(filter);
  }, [filter]);
  
  // Fetch attributes for the selected filter
  const fetchAttributes = async (objectType) => {
    try {
      setLoading(true);
      const attributes = await apiService.getAdAttributes(objectType);
      setAvailableAttributes(attributes);
      // Set default selected columns (first 5 or all if less than 5)
      setSelectedColumns(attributes.slice(0, Math.min(5, attributes.length)));
      setError(null);
    } catch (error) {
      setError(apiService.formatErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    // Initial query to load data when the component mounts and attributes are loaded
    if (availableAttributes.length > 0) {
      debugger;
      handleSearch();
    }
  }, [availableAttributes]);
  
  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiService.queryAD({
        filter: filter,
        query: searchQuery,
        attributes: availableAttributes,
      });
      
      // Process the results to match our component's expected format
      const processedResults = response.results.map((item, index) => ({
        id: `${filter}-${index}`,
        ...item,
        // Ensure consistent property naming
        name: item.Name || item.name,
        operatingSystem: item.OperatingSystem || item.operatingSystem,
        lastLogon: item.LastLogonDate || item.lastLogon,
        ipAddress: item.IPv4Address || item.ipAddress,
        ou: item.DistinguishedName || item.ou,
        isEnabled: item.Enabled !== undefined ? item.Enabled : item.isEnabled,
        managedBy: item.ManagedBy || item.managedBy,
        description: item.Description || item.description
      }));
      
      setResults(processedResults);
      setTotalResults(response.totalCount);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error querying Active Directory:", error);
      setError(apiService.formatErrorMessage(error));
      setResults([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };
  
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };
  
  const viewDetails = (item) => {
    setDetailView(item);
  };
  
  const closeDetails = () => {
    setDetailView(null);
  };
  
  const toggleColumnSelection = (column) => {
    if (selectedColumns.includes(column)) {
      setSelectedColumns(selectedColumns.filter(col => col !== column));
    } else {
      setSelectedColumns([...selectedColumns, column]);
    }
  };
  
  // Format a value from AD for display
  const formatValue = (key, value) => {
    if (value === null || value === undefined) return '-';
    
    // Handle date formatting
    if (key === 'LastLogonDate' || key === 'lastLogon' || key.toLowerCase().includes('date')) {
      try {
        return new Date(value).toLocaleString();
      } catch {
        return String(value);
      }
    }
    
    // Handle boolean values
    if (key === 'Enabled' || key === 'isEnabled' || typeof value === 'boolean') {
      return value === true ? 'Yes' : 'No';
    }
    
    return String(value);
  };
  
  // Get a property value, handling case insensitivity
  const getPropertyValue = (obj, key) => {
    // Try exact match first
    if (obj[key] !== undefined) return obj[key];
    
    // Try case-insensitive match
    const lowerKey = key.toLowerCase();
    const foundKey = Object.keys(obj).find(k => k.toLowerCase() === lowerKey);
    
    return foundKey ? obj[foundKey] : null;
  };
  
  // Calculate pagination
  const totalPages = Math.ceil(results.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, results.length);
  const currentPageData = results.slice(startIndex, endIndex);
  
  return (
    <div className="ad-query-container">
      <h1 className="ad-query-title">Active Directory Query Tool</h1>
      
      {/* Connection Status */}
      {connectionStatus === false && (
        <div className="connection-error">
          ⚠️ Not connected to the backend API. Please ensure the backend server is running.
        </div>
      )}
      
      {/* Query Builder Section */}
      <div className="query-builder-section">
        <h2 className="section-title">Query Builder</h2>
        
        <div className="query-form">
          <div className="form-group">
            <label className="form-label">
              Filter Type
            </label>
            <select 
              className="form-select"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              disabled={loading}
            >
              <option value="computers">Computers</option>
              <option value="users">Users</option>
              <option value="groups">Groups</option>
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">
              Search Query
            </label>
            <div className="search-input-container">
              <input
                type="text"
                placeholder="Enter search terms..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading || connectionStatus === false}
              />
              <button 
                className="search-button"
                onClick={handleSearch}
                disabled={loading || connectionStatus === false}
              >
                <Search size={20} />
              </button>
            </div>
          </div>
        </div>
        
        {availableAttributes.length > 0 && (
          <div className="column-selection">
            <label className="form-label">
              Columns to Display
            </label>
            <div className="checkbox-group">
              {availableAttributes.map(attr => (
                <label 
                  key={attr} 
                  className="checkbox-label"
                >
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={selectedColumns.includes(attr)}
                    onChange={() => toggleColumnSelection(attr)}
                    disabled={loading}
                  />
                  <span className="checkbox-text">{attr}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        
        <button
          className="search-button primary"
          onClick={handleSearch}
          disabled={loading || connectionStatus === false}
        >
          {loading ? 'Searching...' : 'Search Active Directory'}
        </button>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
      </div>
      
      {/* Results Section */}
      <div className="results-section">
        <h2 className="section-title">Results ({results.length} items)</h2>
        
        {results.length > 0 ? (
          <div className="table-container">
            <table className="results-table">
              <thead>
                <tr>
                  {selectedColumns.map(column => (
                    <th key={column} className="table-header">
                      {column}
                    </th>
                  ))}
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentPageData.map((item) => (
                  <tr key={item.id} className="table-row">
                    {selectedColumns.map(column => (
                      <td key={`${item.id}-${column}`} className="table-cell">
                        {formatValue(column, getPropertyValue(item, column))}
                      </td>
                    ))}
                    <td className="table-cell">
                      <button
                        className="view-details-button"
                        onClick={() => viewDetails(item)}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !loading && (
          <div className="no-results">
            No results found. Try adjusting your search query.
          </div>
        )}
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="pagination">
            <nav className="pagination-nav">
              <button
                className="pagination-button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                &laquo; Prev
              </button>
              
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  className={`pagination-button ${
                    currentPage === i + 1
                    ? 'active'
                    : ''
                  }`}
                  onClick={() => handlePageChange(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              
              <button
                className="pagination-button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next &raquo;
              </button>
            </nav>
          </div>
        )}
      </div>
      
      {/* Detail View Modal */}
      {detailView && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title">Details: {detailView.Name || detailView.name}</h3>
                <button 
                  className="close-button"
                  onClick={closeDetails}
                >
                  &times;
                </button>
              </div>
              
              <div className="property-grid">
                <h4 className="section-subtitle">All Properties</h4>
                <div className="properties-container">
                  {Object.entries(detailView).filter(([key]) => key !== 'id').map(([key, value]) => (
                    <div key={key} className="property-item">
                      <div className="property-label">{key}:</div>
                      <div className="property-value">
                        {formatValue(key, value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="json-section">
                <h4 className="section-subtitle">JSON Data</h4>
                <div className="json-container">
                  <pre className="json-content">
                    {JSON.stringify(detailView, null, 2)}
                  </pre>
                </div>
                <button 
                  className="copy-button"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(detailView, null, 2));
                    alert('JSON copied to clipboard!');
                  }}
                >
                  Copy JSON
                </button>
              </div>
              
              <div className="modal-footer">
                <button
                  className="close-modal-button"
                  onClick={closeDetails}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveDirectoryQuery;