import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  File,
  Plus,
  Trash2,
  Edit,
  Download,
  Share2,
  MessageSquare,
  Search,
  MoreHorizontal,
  ChevronDown,
  X,
  Upload,
  Info
} from 'lucide-react';
import DocumentSelector from './DocumentSelector.jsx';
import { useNavigation } from '../context/NavigationContext.jsx';
import { useViewState } from '../context/ViewStateContext.jsx';

const ProjectManagement = ({ projects = [] }) => {
  // Get navigation hooks
  const { navigateTo } = useNavigation();
  
  // Get state from ViewStateContext
  const { 
    projectsState, 
    setProjectsState,
    registerWorkflow,
    updateWorkflow,
    completeWorkflow
  } = useViewState();
  
  // Initialize state from context or props
  const [projectList, setProjectList] = useState(
    projectsState?.projectList || projects || []
  );
  const [activeProject, setActiveProject] = useState(projectsState?.activeProject || null);
  const [searchTerm, setSearchTerm] = useState(projectsState?.searchTerm || '');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showFileUploadModal, setShowFileUploadModal] = useState(false);
  const [filterOption, setFilterOption] = useState(projectsState?.filterOption || 'all');
  const [currentPage, setCurrentPage] = useState(projectsState?.currentPage || 1);
  const [itemsPerPage, setItemsPerPage] = useState(projectsState?.itemsPerPage || 10);
  const [showDocumentSelector, setShowDocumentSelector] = useState(false);
  
  // Save state to context whenever important state changes
  useEffect(() => {
    setProjectsState({
      projectList,
      activeProject,
      searchTerm,
      filterOption,
      currentPage,
      itemsPerPage
    });
  }, [projectList, activeProject, searchTerm, filterOption, currentPage, itemsPerPage]);

  // Set the first project as active by default if none is selected
  useEffect(() => {
    if (projectList.length > 0 && !activeProject) {
      setActiveProject(projectList[0]);
    }
  }, [projectList, activeProject]);

  const createNewProject = () => {
    if (!newProjectName.trim()) return;
    
    // Register workflow to track this action
    registerWorkflow('create_project', 'in_progress', { 
      name: newProjectName,
      timestamp: Date.now() 
    });

    const newProject = {
      id: Math.max(0, ...projectList.map(p => p.id)) + 1,
      name: newProjectName,
      files: [],
      chats: [],
      lastModified: new Date().toISOString()
    };

    setProjectList([...projectList, newProject]);
    setActiveProject(newProject);
    setNewProjectName('');
    setShowCreateModal(false);
    
    // Mark workflow as complete
    completeWorkflow('create_project');
  };

  const deleteProject = (projectId) => {
    // Register workflow
    registerWorkflow('delete_project', 'in_progress', { 
      projectId,
      timestamp: Date.now() 
    });
    
    setProjectList(projectList.filter(p => p.id !== projectId));

    // If we deleted the active project, set another one as active
    if (activeProject && activeProject.id === projectId) {
      const remainingProjects = projectList.filter(p => p.id !== projectId);
      setActiveProject(remainingProjects.length > 0 ? remainingProjects[0] : null);
    }
    
    // Mark workflow as complete
    completeWorkflow('delete_project');
  };

  const handleAddDocumentsToProject = async (docsToAdd, docsToRemove) => {
    try {
      // Register workflow
      registerWorkflow('update_project_docs', 'in_progress', { 
        projectId: activeProject.id,
        docsToAdd: docsToAdd.length,
        docsToRemove: docsToRemove.length,
        timestamp: Date.now()
      });
      
      // Add documents
      if (docsToAdd.length > 0) {
        await fetch(`/api/projects/${activeProject.id}/documents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ documentIds: docsToAdd })
        });
      }
      
      // Remove documents
      for (const docId of docsToRemove) {
        await fetch(`/api/projects/${activeProject.id}/documents/${docId}`, {
          method: 'DELETE'
        });
      }
      
      // Refresh project documents
      // This would update the activeProject state with the new document list
      const updatedProject = { ...activeProject };
      // Fetch updated documents list...
      setActiveProject(updatedProject);
      
      // Close selector
      setShowDocumentSelector(false);
      
      // Mark workflow as complete
      completeWorkflow('update_project_docs');
    } catch (error) {
      console.error('Error updating project documents:', error);
      alert('Error updating project documents. Please try again.');
      
      // Update workflow status to error
      updateWorkflow('update_project_docs', 'error', { 
        errorMessage: error.message
      });
    }
  };

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'pdf':
        return <File className="text-red-500" />;
      case 'image':
        return <File className="text-blue-500" />;
      case 'spreadsheet':
        return <File className="text-green-500" />;
      case 'archive':
        return <File className="text-orange-500" />;
      default:
        return <File className="text-gray-500" />;
    }
  };

  const filteredProjects = searchTerm
    ? projectList.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.files.some(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      p.chats.some(c => c.title?.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    : projectList;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Handle file opening in PDF viewer using navigation
  const handleOpenFile = (file) => {
    if (file.type === 'pdf') {
      // Store the current PDF in view state
      setProjectsState({
        ...projectsState,
        currentPdf: file.name
      });
      
      // Navigate to PDF viewer
      navigateTo('pdf_viewer');
    } else {
      // For non-PDF files, open in a new tab
      window.open(`/view/${file.name}`, '_blank');
    }
  };

  // Handle delete file
  const handleDeleteFile = async (filename) => {
    if (window.confirm(`Are you sure you want to delete ${filename}?`)) {
      try {
        // Register workflow
        registerWorkflow('delete_file', 'in_progress', {
          filename,
          timestamp: Date.now()
        });
        
        const response = await fetch(`/enhanced_document/delete/${filename}`, {
          method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
          // Update the project files list
          if (activeProject) {
            const updatedFiles = activeProject.files.filter(f => f.name !== filename);
            const updatedProject = { ...activeProject, files: updatedFiles };
            setActiveProject(updatedProject);

            // Also update in project list
            const updatedProjects = projectList.map(p =>
              p.id === activeProject.id ? updatedProject : p
            );
            setProjectList(updatedProjects);
            
            // Mark workflow as complete
            completeWorkflow('delete_file');
          }
        } else {
          alert(`Error: ${data.message}`);
          
          // Update workflow status to error
          updateWorkflow('delete_file', 'error', {
            errorMessage: data.message
          });
        }
      } catch (error) {
        console.error('Error deleting file:', error);
        alert('Error deleting file. Please try again.');
        
        // Update workflow status to error
        updateWorkflow('delete_file', 'error', {
          errorMessage: error.message
        });
      }
    }
  };

  // View diagnostics info using navigation
  const showFileDiagnostics = (file) => {
    // Store file in view state for the diagnostics view
    setProjectsState({
      ...projectsState,
      diagnosticsFile: file
    });
    
    // Navigate to diagnostics view
    navigateTo('diagnostics');
  };

  // Handle file upload
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    // Register workflow
    registerWorkflow('upload_files', 'in_progress', {
      count: files.length,
      timestamp: Date.now()
    });

    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('document_file', file);
    });

    try {
      const response = await fetch('http://localhost:5000/upload_with_options', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Successfully uploaded ${files.length} file(s).`);

        // Refresh the project to show new files
        // In a real app, we'd update the files list based on the response
        // For now, just simulate a delay and assume files were added
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        
        // Mark workflow as complete
        completeWorkflow('upload_files');
      } else {
        alert(`Error uploading files: ${data.error || 'Unknown error'}`);
        
        // Update workflow status to error
        updateWorkflow('upload_files', 'error', {
          errorMessage: data.error || 'Unknown error'
        });
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Error uploading files. Please try again.');
      
      // Update workflow status to error
      updateWorkflow('upload_files', 'error', {
        errorMessage: error.message
      });
    }

    setShowFileUploadModal(false);
  };

  // Pagination for files
  const paginatedFiles = activeProject?.files
    ? activeProject.files.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    )
    : [];

  const totalPages = activeProject?.files
    ? Math.ceil(activeProject.files.length / itemsPerPage)
    : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Project List Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-800">Projects</h1>
        </div>

        <div className="p-4">
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Search projects..."
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

          <button
            className="w-full py-2 px-4 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition flex items-center justify-center mb-4"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={18} className="mr-2" />
            New Project
          </button>

          <div className="space-y-1">
            {filteredProjects.map(project => (
              <button
                key={project.id}
                className={`w-full text-left px-3 py-2 rounded-md flex items-center ${activeProject && activeProject.id === project.id
                    ? 'bg-purple-50 text-purple-900'
                    : 'text-gray-700 hover:bg-gray-100'
                  }`}
                onClick={() => setActiveProject(project)}
              >
                <Folder
                  size={18}
                  className={`mr-2 ${activeProject && activeProject.id === project.id
                      ? 'text-purple-600'
                      : 'text-gray-500'
                    }`}
                />
                <div className="overflow-hidden overflow-ellipsis whitespace-nowrap">
                  {project.name}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Project Header */}
        {activeProject ? (
          <>
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">
                  {activeProject.name}
                </h2>
                <div className="flex space-x-2">
                  <button
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
                    title="Edit project"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
                    title="Share project"
                  >
                    <Share2 size={18} />
                  </button>
                  <button
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-md"
                    title="Delete project"
                    onClick={() => deleteProject(activeProject.id)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="mt-2 text-sm text-gray-500">
                Last modified {formatDate(activeProject.lastModified)}
              </div>
            </div>

            {/* Project Content */}
            <div className="flex-1 overflow-auto p-6">
              {/* Filter controls */}
              <div className="mb-4 flex items-center space-x-3">
                <div className="font-medium text-gray-700">Filter:</div>
                <button
                  className={`px-3 py-1 rounded-full text-sm ${filterOption === 'all'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  onClick={() => setFilterOption('all')}
                >
                  All
                </button>
                <button
                  className={`px-3 py-1 rounded-full text-sm ${filterOption === 'files'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  onClick={() => setFilterOption('files')}
                >
                  Files
                </button>
                <button
                  className={`px-3 py-1 rounded-full text-sm ${filterOption === 'chats'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  onClick={() => setFilterOption('chats')}
                >
                  Chats
                </button>
              </div>

              {/* Files Section */}
              {(filterOption === 'all' || filterOption === 'files') && (
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-800">Files</h3>
                    <button
                      className="text-sm text-purple-600 hover:text-purple-800 flex items-center"
                      onClick={() => setShowFileUploadModal(true)}
                    >
                      <Plus size={16} className="mr-1" />
                      Add File
                    </button>
                    <button
                      className="text-sm text-purple-600 hover:text-purple-800 flex items-center"
                      onClick={() => setShowDocumentSelector(true)}
                    >
                      <Plus size={16} className="mr-1" />
                      Add Existing Documents
                    </button>
                  </div>

                  {activeProject.files.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                      <div className="mx-auto w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
                        <File className="text-purple-600" size={24} />
                      </div>
                      <h4 className="text-gray-800 font-medium mb-2">No files yet</h4>
                      <p className="text-gray-600 mb-4">Upload files to this project to get started</p>
                      <button
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition"
                        onClick={() => setShowFileUploadModal(true)}
                      >
                        Upload a File
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {paginatedFiles.map(file => (
                          <div key={file.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start">
                                {getFileIcon(file.type)}
                                <div className="ml-3">
                                  <div className="font-medium text-gray-800">{file.name}</div>
                                  <div className="text-sm text-gray-500">{file.size} • {formatDate(file.date)}</div>
                                </div>
                              </div>
                              <div className="relative">
                                <button className="text-gray-400 hover:text-gray-600">
                                  <MoreHorizontal size={16} />
                                </button>
                              </div>
                            </div>
                            <div className="mt-4 flex space-x-2">
                              {file.type === 'pdf' ? (
                                <button
                                  className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                                  onClick={() => handleOpenFile(file)}
                                >
                                  View PDF
                                </button>
                              ) : (
                                <button
                                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                  onClick={() => handleOpenFile(file)}
                                >
                                  Open
                                </button>
                              )}
                              <button
                                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                onClick={() => window.open(`/view/${file.name}?download=true`, '_blank')}
                              >
                                Download
                              </button>
                              <button
                                className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                                onClick={() => showFileDiagnostics(file)}
                              >
                                <Info size={12} className="inline mr-1" />
                                Info
                              </button>
                              <button
                                className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                                onClick={() => handleDeleteFile(file.name)}
                              >
                                <Trash2 size={12} className="inline mr-1" />
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Pagination controls */}
                      {totalPages > 1 && (
                        <div className="flex justify-between items-center mt-4">
                          <div className="text-sm text-gray-500">
                            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, activeProject.files.length)} of {activeProject.files.length} files
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                              disabled={currentPage === 1}
                              className={`px-2 py-1 rounded-md ${currentPage === 1
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                              Previous
                            </button>

                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`px-3 py-1 rounded-md ${currentPage === pageNum
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                              >
                                {pageNum}
                              </button>
                            ))}

                            <button
                              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                              disabled={currentPage === totalPages}
                              className={`px-2 py-1 rounded-md ${currentPage === totalPages
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Documents Selector */}
                  {showDocumentSelector && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                      <div className="bg-white rounded-lg w-full max-w-xl">
                        <DocumentSelector 
                          project={activeProject}
                          onAddDocuments={handleAddDocumentsToProject}
                          onCancel={() => setShowDocumentSelector(false)}
                          currentUser={null} // Will be used later for filtering
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Chats Section */}
              {(filterOption === 'all' || filterOption === 'chats') && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-800">Conversations</h3>
                    <button 
                      className="text-sm text-purple-600 hover:text-purple-800 flex items-center"
                      onClick={() => {
                        // Navigate to chat with project context
                        setProjectsState({
                          ...projectsState,
                          activeChat: {
                            projectId: activeProject.id,
                            projectName: activeProject.name
                          }
                        });
                        navigateTo('chat');
                      }}
                    >
                      <Plus size={16} className="mr-1" />
                      New Chat
                    </button>
                  </div>

                  {activeProject.chats.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                      <div className="mx-auto w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
                        <MessageSquare className="text-purple-600" size={24} />
                      </div>
                      <h4 className="text-gray-800 font-medium mb-2">No conversations yet</h4>
                      <p className="text-gray-600 mb-4">Start a new chat about this project</p>
                      <button 
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition"
                        onClick={() => {
                          // Navigate to chat with project context
                          setProjectsState({
                            ...projectsState,
                            activeChat: {
                              projectId: activeProject.id,
                              projectName: activeProject.name
                            }
                          });
                          navigateTo('chat');
                        }}
                      >
                        Start a Conversation
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeProject.chats.map(chat => (
                        <div
                          key={chat.id}
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                          onClick={() => {
                            // Navigate to chat with this specific chat
                            setProjectsState({
                              ...projectsState,
                              activeChat: {
                                id: chat.id,
                                projectId: activeProject.id,
                                projectName: activeProject.name,
                                title: chat.title
                              }
                            });
                            navigateTo('chat');
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <MessageSquare size={18} className="text-purple-600 mr-3" />
                              <div>
                                <div className="font-medium text-gray-800">{chat.title}</div>
                                <div className="text-sm text-gray-500">{formatDate(chat.date)}</div>
                              </div>
                            </div>
                            <button className="text-gray-400 hover:text-gray-600">
                              <MoreHorizontal size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <Folder className="text-purple-600" size={30} />
              </div>
              <h3 className="text-xl font-medium text-gray-800 mb-2">No project selected</h3>
              <p className="text-gray-600 mb-4 max-w-md">
                Select a project from the sidebar or create a new one to get started.
              </p>
              <button
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition"
                onClick={() => setShowCreateModal(true)}
              >
                Create New Project
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-800">Create New Project</h3>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Name
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter project name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button
                className={`px-4 py-2 rounded-md ${newProjectName.trim()
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-purple-300 text-white cursor-not-allowed'
                  }`}
                onClick={createNewProject}
                disabled={!newProjectName.trim()}
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Upload Modal */}
      {showFileUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-800">Upload File</h3>
            </div>
            <div className="p-4">
              <FileUploader onUpload={handleFileUpload} />
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition"
                onClick={() => setShowFileUploadModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// File uploader component
const FileUploader = ({ onUpload }) => {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState([]);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setFiles(prev => [...prev, ...newFiles]);
      e.dataTransfer.clearData();
    }
  };

  const handleChange = (e) => {
    e.preventDefault();

    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleClick = () => {
    inputRef.current.click();
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (files.length > 0) {
      onUpload(files);
      setFiles([]);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div>
      <div
        className={`border-2 border-dashed ${dragActive ? 'border-purple-400 bg-purple-50' : 'border-gray-300'} rounded-lg p-6 text-center`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="mx-auto w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
          <Upload className="text-purple-600" size={24} />
        </div>
        <p className="text-gray-800 mb-2">Drag and drop files here</p>
        <p className="text-gray-500 text-sm mb-4">or</p>
        <button
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition"
          onClick={handleClick}
        >
          Browse Files
        </button>
        <input
          type="file"
          ref={inputRef}
          className="hidden"
          multiple
          onChange={handleChange}
        />
      </div>

      {files.length > 0 && (
        <div className="mt-4">
          <h4 className="font-medium text-gray-700 mb-2">Selected Files</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {files.map((file, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                <div className="flex items-center">
                  <File size={16} className="mr-2 text-gray-500" />
                  <div>
                    <div className="text-sm font-medium text-gray-700 truncate max-w-[200px]">{file.name}</div>
                    <div className="text-xs text-gray-500">{formatFileSize(file.size)}</div>
                  </div>
                </div>
                <button
                  className="text-gray-400 hover:text-red-500"
                  onClick={() => removeFile(index)}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="w-full mt-4 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition"
            onClick={handleSubmit}
          >
            Upload {files.length} File{files.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProjectManagement;