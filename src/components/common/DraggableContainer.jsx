import { useRef } from 'react';

const DraggableContainer = ({ children, className = "" }) => {
  // Use a ref for mutable values to avoid re-renders during drag
  const dragInfo = useRef({ isDown: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  // Helper to check if dragging should be enabled (only for large screens)
  const isDragEnabled = () => window.innerWidth >= 1024; // lg breakpoint

  const onMouseDown = (e) => {
    if (!isDragEnabled()) return;
    
    // Only enable dragging if clicking directly on the container or non-interactive elements
    dragInfo.current.isDown = true;
    dragInfo.current.startX = e.pageX - e.currentTarget.offsetLeft;
    dragInfo.current.startY = e.pageY - e.currentTarget.offsetTop;
    dragInfo.current.scrollLeft = e.currentTarget.scrollLeft;
    dragInfo.current.scrollTop = e.currentTarget.scrollTop;
  };

  const onMouseLeave = (e) => {
    dragInfo.current.isDown = false;
  };

  const onMouseUp = (e) => {
    dragInfo.current.isDown = false;
  };

  const onMouseMove = (e) => {
    if (!dragInfo.current.isDown || !isDragEnabled()) return;
    e.preventDefault();
    const x = e.pageX - e.currentTarget.offsetLeft;
    const y = e.pageY - e.currentTarget.offsetTop;
    const walkX = (x - dragInfo.current.startX) * 1.5; // Scroll-fast multiplier
    const walkY = (y - dragInfo.current.startY) * 1.5;
    e.currentTarget.scrollLeft = dragInfo.current.scrollLeft - walkX;
    e.currentTarget.scrollTop = dragInfo.current.scrollTop - walkY;
  };

  return (
    <div 
      className={`absolute inset-0 overflow-auto custom-scrollbar cursor-default lg:cursor-grab lg:active:cursor-grabbing select-none ${className}`}
      onMouseDown={onMouseDown}
      onMouseLeave={onMouseLeave}
      onMouseUp={onMouseUp}
      onMouseMove={onMouseMove}
    >
      <div className="min-w-max min-h-max p-4 lg:p-16">
        {children}
      </div>
    </div>
  );
};

export default DraggableContainer;
