// src/App.js
import React from 'react';
import './App.css';
import AppSelectorCarousel from './components/AppSelectorCarousel/AppSelectorCarousel';
import TeamsHub from './components/TeamsHub/TeamsHub.jsx';
import ActiveDirectoryQuery from './components/ActiveDirectoryQuery/ActiveDirectoryQuery.jsx';
import LoginComponent, { AuthProvider, useAuth } from './components/LoginComponent/LoginComponent';
import { UserCircle, LogOut } from 'lucide-react';

// Authenticated App wrapper - only shows content when logged in
const AuthenticatedApp = () => {
  const { currentUser, signOut } = useAuth();

  // Enhanced demo components with icons
  const demoComponents = [
    { 
      name: 'Teams Hub', 
      component: <TeamsHub />,
      icon: '👥'
    },
    { 
      name: 'AD Viewer', 
      component: <ActiveDirectoryQuery />,
      icon: '🔍' 
    },
    // Add more demos here
  ];

  // If not authenticated, show login screen
  if (!currentUser) {
    return <LoginComponent />;
  }

  // Show the app with authenticated user info
  return (
    <div className="App">
      {/* Authenticated user bar */}
      <div className="auth-user-bar">
        <div className="auth-user-info">
          <div className="auth-user-avatar">
            <UserCircle size={20} />
          </div>
          <div className="auth-user-details">
            <div className="auth-user-name">{currentUser.username}</div>
            <div className="auth-user-domain">{currentUser.domain}</div>
          </div>
        </div>
        <button className="auth-logout-button" onClick={signOut}>
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
      
      {/* Main app content */}
      <AppSelectorCarousel components={demoComponents} />
    </div>
  );
};

// Main App component with Auth Provider
function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

export default App;