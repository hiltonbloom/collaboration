import { useState } from 'react';
import './ComponentDemoCarousel.css'; // Optional: for styling

function ComponentDemoCarousel({ components }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const total = components.length;

  const prev = () => setCurrentIndex((currentIndex - 1 + total) % total);
  const next = () => setCurrentIndex((currentIndex + 1) % total);

  if (total === 0) return <p>No components to display</p>;

  return (
    <div className="demo-carousel">
      <p className="demo-title">Component Demo: {components[currentIndex].name}</p>
      <div className="demo-content">{components[currentIndex].component}</div>
      <div className="demo-controls">
        <button onClick={prev}>&larr; Prev</button>
        <button onClick={next}>Next &rarr;</button>
      </div>
    </div>
  );
}

export default ComponentDemoCarousel;
