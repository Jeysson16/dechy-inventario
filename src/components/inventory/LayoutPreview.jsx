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
  const { shelves, customAreaNames = {} } = layout;
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
                {Array.from({ length: shelf.rows }).map((_, rowIdx) => {
                  const key = `${shelfIdx}-${rowIdx}-${colCfg.side}`;
                  const name = customAreaNames[key] || `${shelfIdx + 1}${colCfg.side}${rowIdx + 1}`;
                  const isHighlighted = highlightedAreas.includes(key);
                  const isSelected = selectedAreas.includes(key);
                  const qty = quantities[key]; 
                  const maxQty = maxQuantities[key];

                  // Determine if this specific area is interactive (can be clicked)
                  // If maxQuantities is provided (Sales Mode), only areas with defined maxQty are interactive
                  const isInteractive = !readOnly && (
                    Object.keys(maxQuantities).length > 0 
                      ? maxQuantities[key] !== undefined 
                      : true
                  );

                  return (
                    <div 
                      key={`${colCfg.side}-${rowIdx}`} 
                      className="group relative transition-transform duration-150 hover:scale-105 active:scale-95"
                    >
                      <div 
                        onClick={() => isInteractive && onAreaClick(shelfIdx, rowIdx, colCfg.side)}
                        className={`
                          size-20 sm:size-24 rounded-2xl shadow-sm border-2 flex flex-col items-center transition-all duration-150 p-1.5 relative
                          ${isInteractive ? 'cursor-pointer' : 'cursor-default opacity-50 grayscale'}
                          ${isHighlighted ? 'ring-4 ring-rose-500/20 border-rose-500 bg-rose-50 dark:bg-rose-900/30' : ''}
                          ${isSelected 
                            ? 'bg-white dark:bg-slate-800 border-indigo-500 shadow-xl shadow-indigo-500/10 z-10' 
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-primary/5'
                          }
                        `}
                        title={isInteractive ? (isSelected ? `Ajustar cantidad en ${name}` : "Clic para seleccionar") : "Sin stock disponible"}
                      >
                        {/* Status Icon or Number Control */}
                        <div className="relative w-full h-full flex flex-col items-center justify-center p-0">
                          
                          {/* Controls - Visible ALWAYS when selected (No hover overlay) */}
                          {!readOnly && isSelected ? (
                            <div 
                              key="controls"
                              className="flex flex-col items-center justify-center w-full h-full animate-fadeIn relative"
                            >
                              {/* Nombre en la parte superior */}
                              <span className="text-[10px] font-black tracking-tight leading-none text-slate-400 dark:text-slate-500 absolute top-1">{name}</span>

                              {/* Controls Container */}
                              <div className="flex items-center justify-center w-full px-0.5 mt-1 relative z-20">
                                
                                {maxQty === undefined && (
                                   <button 
                                     type="button"
                                     onClick={(e) => { e.stopPropagation(); onQuantityChange(key, Math.max(0, (Number(qty) || 0) - 1)); }}
                                     onMouseDown={(e) => e.stopPropagation()}
                                     className="w-5 h-6 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-md flex items-center justify-center transition-colors active:scale-95 mr-0.5"
                                   >
                                     <span className="material-symbols-outlined text-[14px] font-bold">remove</span>
                                   </button>
                                 )}
                                
                                <div className="flex-1 flex flex-col items-center justify-center relative">
                                   <input 
                                     min="0"
                                     max={maxQty}
                                     title="Ingresa la cantidad manualmente"
                                     value={qty === undefined ? '' : qty}
                                     onClick={(e) => e.stopPropagation()}
                                     onMouseDown={(e) => e.stopPropagation()}
                                     onChange={(e) => onQuantityChange(key, e.target.value)}
                                     className={`
                                       bg-transparent border-none p-0 font-black text-center focus:ring-0 outline-none placeholder-indigo-200 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none select-text cursor-text
                                       ${maxQty !== undefined ? 'text-2xl w-full' : 'text-xl w-full'}
                                       ${maxQty !== undefined && (Number(qty) || 0) > maxQty ? 'text-rose-600' : 'text-indigo-600'}
                                     `}
                                     placeholder="0"
                                     autoFocus
                                   />
                                   {maxQty !== undefined && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <span className={`text-[9px] font-bold uppercase tracking-wide ${
                                        (Number(qty) || 0) > maxQty ? 'text-rose-500' : 'text-slate-400'
                                      }`}>
                                        Max: {maxQty}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {maxQty === undefined && (
                                   <button 
                                     type="button"
                                     onClick={(e) => { 
                                       e.stopPropagation(); 
                                       onQuantityChange(key, (Number(qty) || 0) + 1); 
                                     }}
                                     onMouseDown={(e) => e.stopPropagation()}
                                     className="w-5 h-6 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-md flex items-center justify-center transition-colors active:scale-95 ml-0.5"
                                   >
                                     <span className="material-symbols-outlined text-[14px] font-bold">add</span>
                                   </button>
                                 )}
                              </div>
                            </div>
                          ) : (
                            /* Static View - Visible when NOT selected */
                            <div 
                              key="static"
                              className={`flex flex-col items-center justify-center w-full h-full rounded-2xl transition-all duration-150`}
                            >
                              <div className={`mb-1 transition-all duration-150 ${isHighlighted ? 'text-rose-500 animate-pulse' : 'text-slate-300 dark:text-slate-600'}`}>
                                <span className="material-symbols-outlined text-3xl transition-all duration-150">
                                  {isHighlighted ? 'warning' : 'inventory_2'}
                                </span>
                              </div>
                              <div className="flex flex-col items-center gap-0.5">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-black uppercase tracking-wider transition-colors duration-150 text-slate-500 dark:text-slate-400">
                                    {name}
                                  </span>
                                  {!readOnly && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); onInfoClick(shelfIdx, rowIdx, colCfg.side); }}
                                      className="size-4 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors z-20"
                                      title="Ver detalle de productos"
                                    >
                                      <span className="material-symbols-outlined text-[10px] font-bold">info</span>
                                    </button>
                                  )}
                                </div>
                                {maxQty !== undefined ? (
                                   <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border transition-all duration-150 ${
                                     (Number(qty) || 0) > 0 
                                       ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                                       : 'bg-slate-50 text-slate-400 border-slate-100'
                                   }`}>
                                    {(Number(qty) || 0) > 0 ? `${qty} / ${maxQty}` : `${maxQty} disp.`}
                                   </span>
                                ) : (
                                  (Number(qty) || 0) > 0 && (
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md border transition-all duration-150 bg-indigo-50 text-indigo-600 border-indigo-100">
                                      {qty} <span className="text-[8px] font-medium opacity-80 uppercase ml-0.5">cajas</span>
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Highlighting Pulse effect */}
                        {isHighlighted && !isSelected && (
                          <div className="absolute inset-0 bg-rose-500/10 animate-pulse pointer-events-none"></div>
                        )}

                        {/* Quantity Badge (Only when NOT selected, to avoid clutter) */}
                        {!isSelected && (Number(qty) || 0) > 0 && (
                          <div className="absolute -top-2 -right-2 size-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm border-2 bg-indigo-100 text-indigo-700 border-white z-10">
                            {qty}
                          </div>
                        )}
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
