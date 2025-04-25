import React, { useState, useEffect } from 'react';
import { Check, X, Search, RefreshCw } from 'lucide-react';

const DocumentSelector = ({ 
  project, 
  onAddDocuments, 
  onCancel,
  currentUser // For future user-based filtering
}) => {
  const [allDocuments, setAllDocuments] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Get all documents and mark which ones are already in the project
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        
        // Get all documents
        const response = await fetch('http://localhost:5000/enhanced_documents');
        const documents = await response.json();

        // Get current project documents
        const projectResponse = await fetch(`http://localhost:5000/api/projects/${project.id}/documents`);
        const projectDocs = await projectResponse.json();
        
        // Mark documents that are already in the project
        const projectDocIds = new Set(projectDocs.map(d => d.id));
        const markedDocs = documents.map(doc => ({
          ...doc,
          inProject: projectDocIds.has(doc.id)
        }));
        console.log('Marked documents:', markedDocs);
        setAllDocuments(markedDocs);
        
        // Pre-select documents that are already in the project
        setSelectedDocs(markedDocs.filter(d => d.inProject).map(d => d.id));
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching documents:', error);
        setLoading(false);
      }
    };
    
    fetchDocuments();
  }, [project.id]);
  
  // Filter documents based on search term
  const filteredDocuments = searchTerm 
    ? allDocuments.filter(doc => 
        doc.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc?.title || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    : allDocuments;
    
  // Toggle document selection
  const toggleDocument = (docId) => {
    if (selectedDocs.includes(docId)) {
      setSelectedDocs(selectedDocs.filter(id => id !== docId));
    } else {
      setSelectedDocs([...selectedDocs, docId]);
    }
  };
  
  // Handle save button click
  const handleSave = () => {
    const docsToAdd = selectedDocs.filter(
      id => !allDocuments.find(d => d.id === id && d.inProject)
    );
    
    const docsToRemove = allDocuments
      .filter(d => d.inProject && !selectedDocs.includes(d.id))
      .map(d => d.id);
      
    onAddDocuments(docsToAdd, docsToRemove);
  };
  
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium text-gray-800 mb-4">Select Documents</h3>
      
      {/* Search bar */}
      <div className="relative mb-4">
        <input
          type="text"
          placeholder="Search documents..."
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
        {searchTerm && (
          <button
            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
            onClick={() => setSearchTerm('')}
          >
            <X size={18} />
          </button>
        )}
      </div>
      
      {/* Document list */}
      {loading ? (
        <div className="flex items-center justify-center p-6">
          <RefreshCw size={24} className="text-purple-600 animate-spin" />
          <span className="ml-2 text-gray-600">Loading documents...</span>
        </div>
      ) : (
        <>
          <div className="mb-2 flex justify-between items-center">
            <span className="text-sm text-gray-600">
              {filteredDocuments.length} documents found
            </span>
            <div className="flex gap-2">
              <button
                className="text-sm text-purple-600"
                onClick={() => setSelectedDocs(allDocuments.map(d => d.id))}
              >
                Select All
              </button>
              <button
                className="text-sm text-purple-600"
                onClick={() => setSelectedDocs([])}
              >
                Deselect All
              </button>
            </div>
          </div>
          
          <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
            {filteredDocuments.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No documents found
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {filteredDocuments.map(doc => (
                  <li key={doc.id} className="p-3 hover:bg-gray-50">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-purple-600 rounded"
                        checked={selectedDocs.includes(doc.id)}
                        onChange={() => toggleDocument(doc.id)}
                      />
                      <div className="ml-3 flex-1">
                        <div className="font-medium text-gray-800">{doc.filename}</div>
                        <div className="text-sm text-gray-500">
                          {doc?.title || doc.filename}
                          {doc.inProject && (
                            <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                              In Project
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <div className="mt-4 flex justify-end space-x-3">
            <button
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              onClick={handleSave}
            >
              Save Changes
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default DocumentSelector;