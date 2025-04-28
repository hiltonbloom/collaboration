// src/context/NavigationContext.jsx
import React, { createContext, useState, useContext } from 'react';
import { useViewState } from './ViewStateContext';

const NavigationContext = createContext();

export const NavigationProvider = ({ children }) => {
  const [viewStack, setViewStack] = useState(['chat']); // Start with default view
  const [currentView, setCurrentView] = useState('chat');
  const { activeWorkflows } = useViewState();
  
  const navigateTo = (newView, options = {}) => {
    const { force = false } = options;
    
    // Skip if already on this view
    if (newView === currentView) return;
    
    // Check for active workflows
    if (!force) {
      const pendingWorkflows = Object.entries(activeWorkflows)
        .filter(([_, workflow]) => workflow.status === 'in_progress');
        
      if (pendingWorkflows.length > 0) {
        // Show confirmation dialog
        if (!window.confirm('You have unsaved changes. Are you sure you want to navigate away?')) {
          return; // Cancel navigation
        }
      }
    }
    
    // Continue with navigation
    setViewStack(prev => [...prev, newView]);
    setCurrentView(newView);
  };
  
  const goBack = (options = {}) => {
    const { force = false } = options;
    
    if (viewStack.length <= 1) return; // Can't go back from the first view
    
    // Check for active workflows
    if (!force) {
      const pendingWorkflows = Object.entries(activeWorkflows)
        .filter(([_, workflow]) => workflow.status === 'in_progress');
        
      if (pendingWorkflows.length > 0) {
        // Show confirmation dialog
        if (!window.confirm('You have unsaved changes. Are you sure you want to navigate away?')) {
          return; // Cancel navigation
        }
      }
    }
    
    // Create a copy of the stack without the last item
    const newStack = [...viewStack];
    newStack.pop(); // Remove current view
    const previousView = newStack[newStack.length - 1]; // Get previous view
    
    // Update stack and current view
    setViewStack(newStack);
    setCurrentView(previousView);
  };
  
  return (
    <NavigationContext.Provider value={{
      currentView,
      viewStack,
      navigateTo,
      goBack
    }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => useContext(NavigationContext);