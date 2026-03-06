import { useRef } from 'react';

const DraggableContainer = ({ children, className = "" }) => {
  // Use a ref for mutable values to avoid re-renders during drag
  const dragInfo = useRef({ isDown: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  const onMouseDown = (e) => {
    // Only enable dragging if clicking directly on the container or non-interactive elements
    // (This is a backup check, usually stopPropagation on children handles this)
    dragInfo.current.isDown = true;
    dragInfo.current.startX = e.pageX - e.currentTarget.offsetLeft;
    dragInfo.current.startY = e.pageY - e.currentTarget.offsetTop;
    dragInfo.current.scrollLeft = e.currentTarget.scrollLeft;
    dragInfo.current.scrollTop = e.currentTarget.scrollTop;
    e.currentTarget.style.cursor = 'grabbing';
  };

  const onMouseLeave = (e) => {
    dragInfo.current.isDown = false;
    e.currentTarget.style.cursor = 'grab';
  };

  const onMouseUp = (e) => {
    dragInfo.current.isDown = false;
    e.currentTarget.style.cursor = 'grab';
  };

  const onMouseMove = (e) => {
    if (!dragInfo.current.isDown) return;
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
      className={`absolute inset-0 overflow-auto custom-scrollbar cursor-grab active:cursor-grabbing select-none ${className}`}
      onMouseDown={onMouseDown}
      onMouseLeave={onMouseLeave}
      onMouseUp={onMouseUp}
      onMouseMove={onMouseMove}
    >
      <div className="min-w-max min-h-max p-16">
        {children}
      </div>
    </div>
  );
};

export default DraggableContainer;
