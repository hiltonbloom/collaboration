# App Selector Extension Guide

This guide explains how to extend and customize the App Selector component in your React application.

## Where to Find the Files

The main files for the App Selector are located in:

```
src/
  └── components/
      └── AppSelector/
          ├── AppSelectorCarousel.js  // Main component logic
          └── AppSelectorCarousel.css // Styling
```

## Adding New Applications to the Selector

To add new applications to the selector, update the `demoComponents` array in `src/App.js`:

```javascript
// In App.js
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
  // Add your new component here:
  { 
    name: 'Your New App', 
    component: <YourNewComponent />,
    icon: '🚀' // Choose an appropriate emoji or use a Lucide icon
  },
];
```

## Customizing the Appearance

### Changing Colors and Theme

To modify the color scheme, edit the CSS variables in `AppSelectorCarousel.css`:

```css
/* At the top of AppSelectorCarousel.css, add: */
:root {
  --sidebar-bg: #282c34;
  --sidebar-highlight: #61dafb;
  --sidebar-text: white;
  --header-bg: white;
  --content-bg: #f5f5f7;
}

/* Then reference these variables throughout the CSS file */
.app-selector-sidebar {
  background-color: var(--sidebar-bg);
  color: var(--sidebar-text);
}
```

### Adjusting Layout and Sizes

To change the sidebar width:

```css
/* In AppSelectorCarousel.css */
.app-selector-sidebar {
  width: 280px; /* Default is 250px */
}
```

To modify the header height:

```css
.app-selector-header {
  padding: 20px 25px; /* Increase or decrease padding */
}
```

## Adding Features

### Adding a Search Feature

To add a search feature to filter applications, modify `AppSelectorCarousel.js`:

```javascript
// Add to the imports
import { Search } from 'lucide-react';

// Add a search state
const [searchTerm, setSearchTerm] = useState('');

// Add a search input in the sidebar
<div className="app-selector-search">
  <div className="search-input-wrapper">
    <Search size={16} />
    <input 
      type="text" 
      placeholder="Search apps..." 
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
    />
  </div>
</div>

// Filter components based on search
const filteredComponents = components.filter(comp => 
  comp.name.toLowerCase().includes(searchTerm.toLowerCase())
);

// Use filteredComponents instead of components when mapping
```

### Adding Keyboard Navigation

To add keyboard navigation:

```javascript
// Add to AppSelectorCarousel.js
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight') {
      next();
    } else if (e.key === 'ArrowLeft') {
      prev();
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [next, prev]);
```

### Adding a Grid View

To implement a grid view toggle:

1. Add a state for the view mode:

```javascript
const [viewMode, setViewMode] = useState('single'); // 'single' or 'grid'
```

2. Add a toggle button in the header:

```javascript
<button 
  className="app-selector-grid-button"
  onClick={() => setViewMode(viewMode === 'single' ? 'grid' : 'single')}
>
  {viewMode === 'single' ? <Grid size={18} /> : <Maximize size={18} />}
</button>
```

3. Modify the content area to show either a single component or a grid:

```javascript
<div className={`app-selector-content ${viewMode === 'grid' ? 'grid-view' : ''}`}>
  {viewMode === 'single' ? (
    components[currentIndex].component
  ) : (
    <div className="app-selector-grid">
      {components.map((comp, index) => (
        <div 
          key={index} 
          className="app-selector-grid-item"
          onClick={() => {
            setCurrentIndex(index);
            setViewMode('single');
          }}
        >
          <div className="grid-item-icon">{comp.icon}</div>
          <div className="grid-item-name">{comp.name}</div>
        </div>
      ))}
    </div>
  )}
</div>
```

4. Add CSS for the grid view:

```css
.app-selector-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
  padding: 20px;
}

.app-selector-grid-item {
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.app-selector-grid-item:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.grid-item-icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.grid-item-name {
  font-weight: 500;
}
```

## Advanced Customization

### Custom Transitions

To add custom transitions between applications:

```css
/* In AppSelectorCarousel.css */
@keyframes slideInFromRight {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.app-selector-content > * {
  animation: slideInFromRight 0.3s ease-out;
}
```

### Adding App Badges or Notifications

To add notification badges to apps in the sidebar:

```javascript
// Update your demoComponents array in App.js:
const demoComponents = [
  { 
    name: 'Teams Hub', 
    component: <TeamsHub />,
    icon: '👥',
    notifications: 3  // Number of notifications
  },
  // ...
];

// In AppSelectorCarousel.js, update the nav item rendering:
<div className="app-selector-nav-item">
  <span className="app-selector-nav-icon">
    {comp.icon}
    {comp.notifications > 0 && (
      <span className="notification-badge">{comp.notifications}</span>
    )}
  </span>
  <span className="app-selector-nav-text">{comp.name}</span>
</div>
```

```css
/* Add this to AppSelectorCarousel.css */
.app-selector-nav-icon {
  position: relative;
}

.notification-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background-color: #f44336;
  color: white;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

## Troubleshooting

If you encounter issues with the app selector:

1. Check that all dependencies are installed (specifically Lucide React)
2. Verify that the component paths in your imports are correct
3. Check for any CSS conflicts with your existing styles
4. Inspect the console for any JavaScript errors

For additional help or feature requests, please contact the development team.