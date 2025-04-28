import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import './ActiveDirectoryQuery.css'; // You'll need to create this CSS file

// This is a mock function that would be replaced with your actual AD query function
const queryActiveDirectory = async (query = "", filter = "computers") => {
  // In a real implementation, this would call your AD API
  console.log(`Querying AD for ${filter} with query: ${query}`);
  
  // Mock data for demonstration purposes
  const mockComputers = Array(25).fill().map((_, i) => ({
    id: `comp-${i+1}`,
    name: `COMPUTER-${i+100}`,
    operatingSystem: i % 3 === 0 ? 'Windows 10 Enterprise' : 
                    i % 3 === 1 ? 'Windows 11 Pro' : 'Windows Server 2019',
    lastLogon: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
    ipAddress: `192.168.1.${100 + i}`,
    ou: `OU=Computers,OU=${i % 5 === 0 ? 'IT' : 
         i % 5 === 1 ? 'Finance' : 
         i % 5 === 2 ? 'HR' : 
         i % 5 === 3 ? 'Marketing' : 'Sales'},DC=company,DC=local`,
    isEnabled: Math.random() > 0.2,
    managedBy: i % 6 === 0 ? 'John Doe' : 
               i % 6 === 1 ? 'Jane Smith' : 
               i % 6 === 2 ? 'Bob Johnson' : 
               i % 6 === 3 ? 'Alice Brown' : 
               i % 6 === 4 ? 'Charlie Wilson' : null,
    description: i % 2 === 0 ? `Workstation for ${i % 6 === 0 ? 'IT' : 
                              i % 6 === 1 ? 'Finance' : 
                              i % 6 === 2 ? 'HR' : 
                              i % 6 === 3 ? 'Marketing' : 
                              i % 6 === 4 ? 'Sales' : 'Admin'} department` : null
  }));
  
  return {
    results: mockComputers,
    totalCount: 25,
    availableAttributes: [
      'name', 'operatingSystem', 'lastLogon', 'ipAddress', 
      'ou', 'isEnabled', 'managedBy', 'description'
    ]
  };
};

const ActiveDirectoryQuery = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [detailView, setDetailView] = useState(null);
  const [availableAttributes, setAvailableAttributes] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([
    'name', 'operatingSystem', 'lastLogon', 'ou', 'isEnabled'
  ]);
  const [filter, setFilter] = useState("computers");
  
  const itemsPerPage = 5;
  
  useEffect(() => {
    // Initial query to load data when the component mounts
    handleSearch();
  }, []);
  
  const handleSearch = async () => {
    setLoading(true);
    try {
      const response = await queryActiveDirectory(searchQuery, filter);
      setResults(response.results);
      setTotalResults(response.totalCount);
      setAvailableAttributes(response.availableAttributes);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error querying Active Directory:", error);
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
  
  const viewDetails = (computer) => {
    setDetailView(computer);
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
  
  // Calculate pagination
  const totalPages = Math.ceil(results.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, results.length);
  const currentPageData = results.slice(startIndex, endIndex);
  
  return (
    <div className="ad-query-container">
      <h1 className="ad-query-title">Active Directory Query Tool</h1>
      
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
            >
              <option value="computers">Computers</option>
              <option value="users">Users</option>
              <option value="groups">Groups</option>
              <option value="ous">Organizational Units</option>
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
              />
              <button 
                className="search-button"
                onClick={handleSearch}
              >
                <Search size={20} />
              </button>
            </div>
          </div>
        </div>
        
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
                />
                <span className="checkbox-text">{attr}</span>
              </label>
            ))}
          </div>
        </div>
        
        <button
          className="search-button primary"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? 'Searching...' : 'Search Active Directory'}
        </button>
      </div>
      
      {/* Results Section */}
      <div className="results-section">
        <h2 className="section-title">Results ({results.length} items)</h2>
        
        <div className="table-container">
          <table className="results-table">
            <thead>
              <tr>
                {selectedColumns.map(column => (
                  <th key={column} className="table-header">
                    {column.charAt(0).toUpperCase() + column.slice(1)}
                  </th>
                ))}
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentPageData.map((computer) => (
                <tr key={computer.id} className="table-row">
                  {selectedColumns.map(column => (
                    <td key={`${computer.id}-${column}`} className="table-cell">
                      {column === 'lastLogon' 
                        ? new Date(computer[column]).toLocaleString() 
                        : column === 'isEnabled'
                          ? computer[column] ? 'Yes' : 'No'
                          : computer[column] || '-'}
                    </td>
                  ))}
                  <td className="table-cell">
                    <button
                      className="view-details-button"
                      onClick={() => viewDetails(computer)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
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
                <h3 className="modal-title">Computer Details: {detailView.name}</h3>
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
                  {Object.keys(detailView).map(key => (
                    <div key={key} className="property-item">
                      <div className="property-label">{key}:</div>
                      <div className="property-value">
                        {key === 'lastLogon' 
                          ? new Date(detailView[key]).toLocaleString() 
                          : key === 'isEnabled'
                            ? detailView[key] ? 'Yes' : 'No'
                            : String(detailView[key] || '-')}
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