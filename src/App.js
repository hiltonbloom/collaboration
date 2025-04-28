import React from 'react';
import './App.css';
// Import the new AppSelectorCarousel instead of the old Carousel
import AppSelectorCarousel from './components/AppSelectorCarousel/AppSelectorCarousel';

// Import your demo components
import TeamsHub from './components/TeamsHub/TeamsHub.jsx';
import ActiveDirectoryQuery from './components/ActiveDirectoryQuery/ActiveDirectoryQuery.jsx';

function App() {
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

  return (
    <div className="App">
      <AppSelectorCarousel components={demoComponents} />
    </div>
  );
}

export default App;