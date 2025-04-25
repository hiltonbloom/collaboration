import logo from './logo.svg';
import './App.css';
import ComponentDemoCarousel from './ComponentDemoCarousel.js';

// Import your demo components
import ContactsManager from './demo/ContactsManager';
import ProjectManagement from './demo/ProjectManagement.js';

function App() {
  const demoComponents = [
    { name: 'Contacts Manager (preview)', component: <ContactsManager /> },
    //{ name: 'Project Manager (preview)', component: <ProjectManagement /> },
    // Add more demos here
  ];

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <ComponentDemoCarousel components={demoComponents} />
      </header>
    </div>
  );
}

export default App;
