import React, { useState, useEffect } from 'react';
import { Search, Plus, X, Download, ArrowLeft, ArrowRight, RefreshCw, Save, Database, Check, CheckSquare, Square } from 'lucide-react';
import './ActiveDirectoryQuery.css';
import apiService from '../../services/api.ts';

const ActiveDirectoryQuery = () => {
  // Search parameters
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("computers");
  const [availableAttributes, setAvailableAttributes] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [ouPaths, setOuPaths] = useState([]);
  const [newOuPath, setNewOuPath] = useState("");
  const [showOuInput, setShowOuInput] = useState(false);
  const [pageSize, setPageSize] = useState(25); // Default page size
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [detailView, setDetailView] = useState(null);
  
  // Pagination and results
  const [results, setResults] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isCountExact, setIsCountExact] = useState(true);
  
  // Additional features
  const [selectedItems, setSelectedItems] = useState({});
  const [selectAll, setSelectAll] = useState(false);
  const [loadingAllResults, setLoadingAllResults] = useState(false);
  const [allResultsProgress, setAllResultsProgress] = useState(0);
  
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
  
  // Initial query to Active Directory
  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setInitialLoad(false);
    
    try {
      const response = await apiService.queryAD({
        filter: filter,
        query: searchQuery,
        attributes: availableAttributes,
        ou_paths: ouPaths.length > 0 ? ouPaths : undefined,
        page_size: pageSize
      });
      
      // Update results state
      setResults(response.results);
      setTotalResults(response.total_count);
      setCurrentPage(response.current_page);
      setTotalPages(response.total_pages);
      setHasNextPage(response.has_next_page);
      setSessionId(response.session_id);
      setIsCountExact(response.is_count_exact);
      
      // Reset selections
      setSelectedItems({});
      setSelectAll(false);
    } catch (error) {
      console.error("Error querying Active Directory:", error);
      setError(apiService.formatErrorMessage(error));
      setResults([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch a specific page
  const fetchPage = async (pageNumber) => {
    if (!sessionId) return;
    
    setLoading(true);
    try {
      const response = await apiService.getPage(sessionId, pageNumber);
      
      setResults(response.results);
      setCurrentPage(response.current_page);
      setTotalPages(response.total_pages);
      setHasNextPage(response.has_next_page);
      
      // Maintain selected items across pages
      const newSelectedItems = { ...selectedItems };
      if (selectAll) {
        // If selectAll is true, add all items on this page
        response.results.forEach(item => {
          const itemId = getItemId(item);
          newSelectedItems[itemId] = true;
        });
        setSelectedItems(newSelectedItems);
      }
      
      window.scrollTo(0, 0); // Scroll to top when changing pages
    } catch (error) {
      setError(apiService.formatErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch all results
  const fetchAllResults = async () => {
    if (!sessionId) return;
    
    setLoadingAllResults(true);
    setAllResultsProgress(0);
    
    try {
      const response = await apiService.getAllResults(sessionId);
      
      // Update with all results
      setResults(response.results);
      setTotalResults(response.total_count);
      setCurrentPage(1);
      setTotalPages(Math.ceil(response.results.length / pageSize));
      setHasNextPage(false);
      
      // Set progress to complete
      setAllResultsProgress(100);
      
      // Update selection state
      if (selectAll) {
        const newSelectedItems = {};
        response.results.forEach(item => {
          const itemId = getItemId(item);
          newSelectedItems[itemId] = true;
        });
        setSelectedItems(newSelectedItems);
      }
    } catch (error) {
      setError(apiService.formatErrorMessage(error));
    } finally {
      setLoadingAllResults(false);
    }
  };
  
  // Export results
  const handleExport = async (format = 'csv') => {
    if (!sessionId) return;
    
    try {
      setLoading(true);
      
      // Get selected item IDs if any are selected
      const hasSelections = Object.keys(selectedItems).length > 0;
      const selectedIds = hasSelections ? Object.keys(selectedItems).filter(id => selectedItems[id]) : [];
      
      const downloadUrl = await apiService.exportResults({
        session_id: sessionId,
        format: format,
        selected_only: hasSelections,
        selected_ids: selectedIds
      });
      
      // Trigger download (in a real implementation)
      // window.location.href = downloadUrl;
      
      // For now, just show a message
      alert(`Export successful! (This is a placeholder - actual file download would happen here)`);
    } catch (error) {
      setError(apiService.formatErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };
  
  // Handle key press events
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (showOuInput && newOuPath) {
        addOuPath();
      } else {
        handleSearch();
      }
    }
  };
  
  // Show details modal for an item
  const viewDetails = (item) => {
    setDetailView(item);
  };
  
  // Close details modal
  const closeDetails = () => {
    setDetailView(null);
  };
  
  // Toggle column selection
  const toggleColumnSelection = (column) => {
    if (selectedColumns.includes(column)) {
      setSelectedColumns(selectedColumns.filter(col => col !== column));
    } else {
      setSelectedColumns([...selectedColumns, column]);
    }
  };
  
  // Handle OU paths
  const addOuPath = () => {
    if (newOuPath.trim()) {
      setOuPaths([...ouPaths, newOuPath.trim()]);
      setNewOuPath("");
      setShowOuInput(false);
    }
  };
  
  const removeOuPath = (index) => {
    const updatedPaths = [...ouPaths];
    updatedPaths.splice(index, 1);
    setOuPaths(updatedPaths);
  };
  
  // Handle item selection
  const toggleItemSelection = (item) => {
    const itemId = getItemId(item);
    setSelectedItems({
      ...selectedItems,
      [itemId]: !selectedItems[itemId]
    });
    
    // Update selectAll state
    const newSelectedState = !selectedItems[itemId];
    const allSelected = results.every(result => 
      selectedItems[getItemId(result)] || (getItemId(result) === itemId && newSelectedState)
    );
    setSelectAll(allSelected);
  };
  
  // Toggle select all items
  const toggleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    
    const newSelectedItems = { ...selectedItems };
    results.forEach(item => {
      const itemId = getItemId(item);
      newSelectedItems[itemId] = newSelectAll;
    });
    setSelectedItems(newSelectedItems);
  };
  
  // Generate a unique ID for an item
  const getItemId = (item) => {
    const name = item.Name || item.name;
    const distinguishedName = item.DistinguishedName || item.distinguishedName;
    return distinguishedName || `${filter}-${name}-${Math.random().toString(36).substr(2, 9)}`;
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
  
  // Get count of selected items
  const getSelectedCount = () => {
    return Object.values(selectedItems).filter(Boolean).length;
  };
  
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
          
          <div className="form-group">
            <label className="form-label">
              Page Size
            </label>
            <select
              className="form-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              disabled={loading}
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>
        </div>
        
        {/* OU Paths Section */}
        <div className="ou-paths-section">
          <div className="ou-header">
            <label className="form-label">
              Organizational Units (Optional)
            </label>
            <button 
              className="add-ou-button"
              onClick={() => setShowOuInput(true)}
              disabled={loading || showOuInput}
            >
              <Plus size={16} />
              Add OU
            </button>
          </div>
          
          <div className="ou-paths-list">
            {ouPaths.map((path, index) => (
              <div key={index} className="ou-path-item">
                <span className="ou-path-text">{path}</span>
                <button 
                  className="remove-ou-button"
                  onClick={() => removeOuPath(index)}
                  disabled={loading}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            
            {showOuInput && (
              <div className="ou-input-container">
                <input
                  type="text"
                  className="ou-input"
                  placeholder="e.g. OU=Computers,DC=example,DC=com"
                  value={newOuPath}
                  onChange={(e) => setNewOuPath(e.target.value)}
                  onKeyPress={handleKeyPress}
                  autoFocus
                />
                <div className="ou-input-buttons">
                  <button 
                    className="add-button"
                    onClick={addOuPath}
                  >
                    Add
                  </button>
                  <button 
                    className="cancel-button"
                    onClick={() => {
                      setNewOuPath("");
                      setShowOuInput(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
            {ouPaths.length === 0 && !showOuInput && (
              <div className="no-ou-message">
                No OUs specified. Query will search the entire directory.
              </div>
            )}
          </div>
        </div>
        
        {/* Column Selection */}
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
        
        {/* Search Button */}
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
        <div className="results-header">
          <h2 className="section-title">
            Results 
            <span className="result-count">
              ({totalResults} {!isCountExact && '≈'} items)
            </span>
          </h2>
          
          {sessionId && results.length > 0 && (
            <div className="results-actions">
              <div className="selection-info">
                {getSelectedCount() > 0 && (
                  <span className="selected-count">
                    {getSelectedCount()} selected
                  </span>
                )}
              </div>
              
              <div className="action-buttons">
                {!loadingAllResults && totalResults > results.length && (
                  <button 
                    className="action-button"
                    onClick={fetchAllResults}
                    disabled={loading}
                    title="Load all results"
                  >
                    <Database size={16} />
                    <span>Load All</span>
                  </button>
                )}
                
                <button 
                  className="action-button"
                  onClick={() => handleExport('csv')}
                  disabled={loading || loadingAllResults}
                  title="Export as CSV"
                >
                  <Download size={16} />
                  <span>Export CSV</span>
                </button>
                
                <button 
                  className="action-button"
                  onClick={() => handleExport('json')}
                  disabled={loading || loadingAllResults}
                  title="Export as JSON"
                >
                  <Save size={16} />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Loading all results progress */}
        {loadingAllResults && (
          <div className="loading-progress">
            <div className="progress-text">
              Loading all results... ({allResultsProgress}%)
            </div>
            <div className="progress-bar-container">
              <div 
                className="progress-bar" 
                style={{ width: `${allResultsProgress}%` }}
              ></div>
            </div>
          </div>
        )}
        
        {/* Results Table */}
        {results.length > 0 ? (
          <div className="table-container">
            <table className="results-table">
              <thead>
                <tr>
                  <th className="table-header checkbox-column">
                    <div className="checkbox-wrapper">
                      <button 
                        className="select-all-button"
                        onClick={toggleSelectAll}
                        title={selectAll ? "Deselect all" : "Select all"}
                      >
                        {selectAll ? <CheckSquare size={18} /> : <Square size={18} />}
                      </button>
                    </div>
                  </th>
                  {selectedColumns.map(column => (
                    <th key={column} className="table-header">
                      {column}
                    </th>
                  ))}
                  <th className="table-header actions-column">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item) => {
                  const itemId = getItemId(item);
                  const isSelected = selectedItems[itemId] === true;
                  
                  return (
                    <tr key={itemId} className={`table-row ${isSelected ? 'selected' : ''}`}>
                      <td className="table-cell checkbox-column">
                        <div className="checkbox-wrapper">
                          <button 
                            className="select-item-button"
                            onClick={() => toggleItemSelection(item)}
                            title={isSelected ? "Deselect" : "Select"}
                          >
                            {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                        </div>
                      </td>
                      {selectedColumns.map(column => (
                        <td 
                          key={`${itemId}-${column}`} 
                          className="table-cell"
                          title={formatValue(column, getPropertyValue(item, column))}
                        >
                          {formatValue(column, getPropertyValue(item, column))}
                        </td>
                      ))}
                      <td className="table-cell actions-column">
                        <button
                          className="view-details-button"
                          onClick={() => viewDetails(item)}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : !loading && initialLoad ? (
          <div className="initial-message">
            <div className="initial-message-icon">🔍</div>
            <h3 className="initial-message-title">Welcome to Active Directory Query Tool</h3>
            <p className="initial-message-text">
              Enter a search term above to find objects in your Active Directory.
              <br />You can also specify one or more Organizational Units to narrow your search.
            </p>
            <button
              className="search-button primary"
              onClick={() => {
                setInitialLoad(false);
                handleSearch();
              }}
            >
              Show All {filter} (Limited to 50)
            </button>
          </div>
        ) : !loading && (
          <div className="no-results">
            No results found. Try adjusting your search query.
          </div>
        )}
        
        {/* Pagination Controls */}
        {!initialLoad && totalPages > 1 && (
          <div className="pagination">
            <div className="pagination-info">
              Showing page {currentPage} of {totalPages}
            </div>
            <nav className="pagination-nav">
              <button
                className="pagination-button"
                onClick={() => fetchPage(1)}
                disabled={loading || currentPage === 1}
                title="First page"
              >
                <span className="sr-only">First</span>
                «
              </button>
              
              <button
                className="pagination-button"
                onClick={() => fetchPage(currentPage - 1)}
                disabled={loading || currentPage === 1}
                title="Previous page"
              >
                <ArrowLeft size={16} />
                <span className="sr-only">Previous</span>
              </button>
              
              {/* Page number buttons - show a window around current page */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => 
                  page === 1 || 
                  page === totalPages || 
                  Math.abs(page - currentPage) <= 2
                )
                .map((page, index, array) => {
                  // Add ellipsis when there are gaps
                  const prevPage = array[index - 1];
                  const showEllipsisBefore = prevPage && page - prevPage > 1;
                  
                  return (
                    <React.Fragment key={page}>
                      {showEllipsisBefore && (
                        <span className="pagination-ellipsis">…</span>
                      )}
                      <button
                        className={`pagination-button ${
                          currentPage === page ? 'active' : ''
                        }`}
                        onClick={() => fetchPage(page)}
                        disabled={loading || currentPage === page}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  );
                })}
              
              <button
                className="pagination-button"
                onClick={() => fetchPage(currentPage + 1)}
                disabled={loading || !hasNextPage}
                title="Next page"
              >
                <ArrowRight size={16} />
                <span className="sr-only">Next</span>
              </button>
              
              <button
                className="pagination-button"
                onClick={() => fetchPage(totalPages)}
                disabled={loading || currentPage === totalPages}
                title="Last page"
              >
                <span className="sr-only">Last</span>
                »
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
                <h3 className="modal-title">
                  Details: {detailView.Name || detailView.name || 'Object'}
                </h3>
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
                  {Object.entries(detailView)
                    .filter(([key]) => key !== 'id')
                    .map(([key, value]) => (
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