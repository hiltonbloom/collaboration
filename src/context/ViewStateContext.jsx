// src/context/ViewStateContext.jsx
import React, { createContext, useState, useContext } from 'react';

const ViewStateContext = createContext();

export const ViewStateProvider = ({ children }) => {
  const [chatState, setChatState] = useState({});
  const [documentsState, setDocumentsState] = useState({});
  const [projectsState, setProjectsState] = useState({});
  const [pdfViewerState, setPdfViewerState] = useState({});
  
  // Workflow tracking
  const [activeWorkflows, setActiveWorkflows] = useState({});

  const registerWorkflow = (id, status, data) => {
    setActiveWorkflows(prev => ({
      ...prev,
      [id]: { status, data, timestamp: Date.now() }
    }));
  };

  const updateWorkflow = (id, status, data) => {
    setActiveWorkflows(prev => ({
      ...prev,
      [id]: { 
        ...prev[id],
        status, 
        data: { ...prev[id]?.data, ...data },
        lastUpdated: Date.now() 
      }
    }));
  };

  const completeWorkflow = (id) => {
    setActiveWorkflows(prev => {
      const newWorkflows = { ...prev };
      delete newWorkflows[id];
      return newWorkflows;
    });
  };
  
  return (
    <ViewStateContext.Provider value={{
      // State for each view
      chatState, setChatState,
      documentsState, setDocumentsState,
      projectsState, setProjectsState,
      pdfViewerState, setPdfViewerState,
      
      // Workflow management
      activeWorkflows,
      registerWorkflow,
      updateWorkflow,
      completeWorkflow
    }}>
      {children}
    </ViewStateContext.Provider>
  );
};

export const useViewState = () => useContext(ViewStateContext);