import { useState } from 'react';

const LayoutPreview = ({ 
  layout, 
  onAreaClick = () => {}, 
  highlightedAreas = [], 
  selectedAreas = [],
  quantities = {},
  maxQuantities = {},
  onQuantityChange = () => {},
  onInfoClick = () => {},
  readOnly = false,
  className = "",
  zoom: externalZoom,
  onZoomChange
}) => {
  const { shelves, customAreaNames = {}, customAreaLevels = {} } = layout;
  const [internalZoom, setInternalZoom] = useState(1);

  const currentZoom = externalZoom !== undefined ? externalZoom : internalZoom;
  const handleZoomChange = (newZoom) => {
    if (onZoomChange) {
      onZoomChange(newZoom);
    } else {
      setInternalZoom(newZoom);
    }
  };

  if (!layout || !layout.shelves) return null;

  return (
    <div className={`relative ${className}`}>
      {/* Zoom Controls - Only visible if no external zoom control is provided */}
      {externalZoom === undefined && (
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-30">
          <button 
            onClick={() => handleZoomChange(Math.min(currentZoom + 0.1, 2))}
            className="size-10 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            title="Acercar"
          >
            <span className="material-symbols-outlined">add</span>
          </button>
          <button 
            onClick={() => handleZoomChange(Math.max(currentZoom - 0.1, 0.5))}
            className="size-10 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            title="Alejar"
          >
            <span className="material-symbols-outlined">remove</span>
          </button>
          <button 
            onClick={() => handleZoomChange(1)}
            className="size-10 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            title="Restablecer"
          >
            <span className="material-symbols-outlined">center_focus_strong</span>
          </button>
        </div>
      )}

      <div 
        className="flex justify-center gap-8 lg:gap-16 w-max mx-auto p-16 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-[3rem] border border-slate-200/50 dark:border-slate-800/50 shadow-2xl shadow-slate-200/40 dark:shadow-none min-w-full relative transition-transform duration-300 origin-top-left"
        style={{
          transform: `scale(${currentZoom})`,
          transformOrigin: 'center top',
          backgroundImage: 'radial-gradient(circle, rgba(94, 114, 228, 0.1) 1.5px, transparent 1.5px)',
          backgroundSize: '40px 40px'
        }}
      >
      {shelves.map((shelf, shelfIdx) => (
        <div 
          key={shelf.id || shelfIdx} 
          className="flex flex-col gap-5 shrink-0 animate-fadeIn"
          style={{ animationDelay: `${shelfIdx * 0.1}s` }}
        >
          <div className="flex items-center justify-center gap-2 mb-2 px-4 py-2 bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
            <span className="material-symbols-outlined text-sm text-primary">shelves</span>
            <span className="font-black text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              {shelf.name}
            </span>
          </div>
          <div className="flex gap-6 p-6 bg-slate-100/30 dark:bg-slate-800/20 backdrop-blur-sm rounded-[2rem] border border-slate-200/30 dark:border-slate-800/30 shadow-inner">
            
            {[
              { type: 'double', side: 'A', visible: shelf.type === 'double' },
              { type: 'any', side: shelf.type === 'double' ? 'B' : 'A', visible: true }
            ].map((colCfg, colIdx) => colCfg.visible && (
              <div key={colIdx} className="flex flex-col gap-5">
                {/* Levels labels on top of column if needed? No, let's put them on the side */}
                {Array.from({ length: shelf.rows }).map((_, i) => {
                  // Reverse row index so Fila 1 is at the bottom
                  const rowIdx = shelf.rows - 1 - i;
                  // Get custom levels for this specific area if defined
                  const areaKey = `${shelfIdx}-${rowIdx}-${colCfg.side}`;
                  const levelsPerFila = customAreaLevels[areaKey] || shelf.levelsPerFila || 1;
                  const filaLabel = customAreaNames[areaKey] || `${shelfIdx + 1}${colCfg.side}${rowIdx + 1}`;

                  return (
                    <div 
                      key={`${colCfg.side}-${rowIdx}`} 
                      className="group relative flex items-center gap-3"
                    >
                      {/* Fila Label (Lado Izquierdo) */}
                      {colIdx === 0 && (
                        <div className="absolute -left-14 flex flex-col items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity">
                          <span className="text-[10px] font-black text-slate-400 rotate-[-90deg] whitespace-nowrap uppercase tracking-tighter">FILA</span>
                          <span className="text-xl font-black text-slate-300 dark:text-slate-700">{rowIdx + 1}</span>
                        </div>
                      )}

                      {/* Fila Container */}
                        <div className={`
                          flex flex-col rounded-2xl border-2 overflow-hidden shadow-sm transition-all duration-200
                          bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700
                          w-24 sm:w-28
                        `}>
                        {/* Area Name (Single label for the whole Fila) */}
                        <div 
                          className="bg-slate-50 dark:bg-slate-900/50 py-1.5 border-b border-slate-100 dark:border-slate-800 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                          onClick={(e) => { e.stopPropagation(); !readOnly && onAreaClick(shelfIdx, rowIdx, colCfg.side); }}
                        >
                          <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tighter truncate px-1 block">{filaLabel}</span>
                        </div>

                        {/* Internal Levels Grid (Stacked vertically) */}
                        <div className="flex-1 flex flex-col gap-px bg-slate-100 dark:bg-slate-700">
                          {Array.from({ length: levelsPerFila }).map((_, j) => {
                            // Level 1 at bottom
                            const levelIdx = levelsPerFila - 1 - j;
                            const key = `${shelfIdx}-${rowIdx}-${levelIdx}-${colCfg.side}`;
                            const legacyKey = `${shelfIdx}-${rowIdx}-${colCfg.side}`;
                            
                            const isHighlighted = highlightedAreas.includes(key) || (levelIdx === 0 && highlightedAreas.includes(legacyKey));
                            const isSelected = selectedAreas.includes(key) || (levelIdx === 0 && selectedAreas.includes(legacyKey));
                            const qty = quantities[key] !== undefined ? quantities[key] : (levelIdx === 0 ? quantities[legacyKey] : undefined);
                            const maxQty = maxQuantities[key] !== undefined ? maxQuantities[key] : (levelIdx === 0 ? maxQuantities[legacyKey] : undefined);

                            const isInteractive = !readOnly && (
                              Object.keys(maxQuantities).length > 0 
                                ? (maxQuantities[key] !== undefined || (levelIdx === 0 && maxQuantities[legacyKey] !== undefined)) 
                                : true
                            );

                            return (
                              <div 
                                key={key}
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (isInteractive) {
                                    // If in config mode (no maxQuantities/quantities logic likely), it should open rename
                                    // but we follow current onAreaClick signature
                                    onAreaClick(shelfIdx, rowIdx, colCfg.side, levelIdx);
                                  }
                                }}
                                className={`
                                  flex flex-col items-center justify-center transition-all duration-150 relative min-h-[45px] py-1
                                  bg-white dark:bg-slate-800
                                  ${isInteractive ? 'cursor-pointer hover:bg-primary/5' : 'cursor-default opacity-50'}
                                  ${isHighlighted ? 'bg-rose-500/10' : ''}
                                  ${isSelected ? 'bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/30' : ''}
                                `}
                              >
                                {/* Selected Indicator / Small Controls */}
                                {isSelected ? (
                                  <div className="flex items-center gap-1 scale-75 origin-center">
                                    {maxQty === undefined && (
                                      <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onQuantityChange(key, Math.max(0, (Number(qty) || 0) - 1)); }}
                                        className="size-5 bg-indigo-500 text-white rounded flex items-center justify-center"
                                      >
                                        <span className="material-symbols-outlined text-[12px]">remove</span>
                                      </button>
                                    )}
                                    <input 
                                      value={qty === undefined ? '' : qty}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => onQuantityChange(key, e.target.value)}
                                      className="w-8 text-xs font-black text-blue text-center bg-transparent border-none p-0 focus:ring-0 text-indigo-600"
                                      autoFocus
                                    />
                                    {maxQty === undefined && (
                                      <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onQuantityChange(key, (Number(qty) || 0) + 1); }}
                                        className="size-5 bg-indigo-500 text-white rounded flex items-center justify-center"
                                      >
                                        <span className="material-symbols-outlined text-[12px]">add</span>
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <>
                                    <span className="text-[8px] font-bold text-slate-400">N{levelIdx + 1}</span>
                                    {(Number(qty) || 0) > 0 && (
                                      <span className="text-[10px] font-black text-indigo-600 leading-none">{qty}</span>
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
  );
};
export default LayoutPreview;
