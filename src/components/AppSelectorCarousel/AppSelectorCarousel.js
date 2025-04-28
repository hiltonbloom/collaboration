import { useState } from 'react';
import './AppSelectorCarousel.css';
import { ChevronLeft, ChevronRight, Grid } from 'lucide-react';

function AppSelectorCarousel({ components }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const total = components.length;

  const prev = () => setCurrentIndex((currentIndex - 1 + total) % total);
  const next = () => setCurrentIndex((currentIndex + 1) % total);

  if (total === 0) return <p>No applications to display</p>;

  return (
    <div className="app-selector-container">
      {/* Sidebar Navigation */}
      <div className="app-selector-sidebar">
        <div className="app-selector-logo">
          <span className="app-selector-logo-text">App Explorer</span>
        </div>
        
        <div className="app-selector-nav">
          {components.map((comp, index) => (
            <div 
              key={index} 
              className={`app-selector-nav-item ${index === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(index)}
            >
              <span className="app-selector-nav-icon">{comp.icon || '📱'}</span>
              <span className="app-selector-nav-text">{comp.name}</span>
            </div>
          ))}
        </div>
        
        <div className="app-selector-footer">
          <div className="app-selector-controls">
            <button onClick={prev} className="app-selector-control-button">
              <ChevronLeft size={20} />
            </button>
            <span className="app-selector-counter">{currentIndex + 1} / {total}</span>
            <button onClick={next} className="app-selector-control-button">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="app-selector-main">
        <div className="app-selector-header">
          <h2 className="app-selector-title">{components[currentIndex].name}</h2>
          <div className="app-selector-actions">
            <button className="app-selector-grid-button">
              <Grid size={18} />
            </button>
          </div>
        </div>
        
        <div className="app-selector-content">
          {components[currentIndex].component}
        </div>
      </div>
    </div>
  );
}

export default AppSelectorCarousel;