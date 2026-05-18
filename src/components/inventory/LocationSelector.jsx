import React, { useState } from "react";

/**
 * LocationSelector — step-by-step modal: [Layout →] Shelf → Row+Side → Level
 * When `allLayouts` is provided, adds a layout-picker step first (cross-croquis).
 */
export const LocationSelector = ({
  isOpen,
  layout,           // active layout (used when allLayouts not provided)
  allLayouts = [],  // all available layouts for cross-croquis movement
  onSelect,
  onClose,
  excludeLocation = null,
}) => {
  const crossMode = allLayouts.length > 1;
  const [step, setStep] = useState(crossMode ? "layout" : "shelf");
  const [chosenLayout, setChosenLayout] = useState(null);
  const [selectedShelf, setSelectedShelf] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedSide, setSelectedSide] = useState("A");
  const [selectedLevel, setSelectedLevel] = useState(null);

  if (!isOpen) return null;

  const activeLayout = chosenLayout || layout;
  if (!activeLayout) return null;

  const { customAreaLevels = {} } = activeLayout;

  const reset = () => {
    setStep(crossMode ? "layout" : "shelf");
    setChosenLayout(null);
    setSelectedShelf(null);
    setSelectedRow(null);
    setSelectedSide("A");
    setSelectedLevel(null);
    onClose();
  };

  const goBack = () => {
    if (step === "shelf") { if (crossMode) { setStep("layout"); setChosenLayout(null); } else reset(); }
    else if (step === "row") { setStep("shelf"); setSelectedShelf(null); }
    else if (step === "level") { setStep("row"); setSelectedLevel(null); }
    else reset();
  };

  const confirm = () => {
    if (selectedShelf === null || selectedRow === null || selectedLevel === null) return;
    const lay = activeLayout;
    const baseKey = `${selectedShelf}-${selectedRow}-${selectedLevel}-${selectedSide}`;
    const key = `${lay.id}__${baseKey}`;
    if (key !== excludeLocation) { onSelect(key, lay.id, lay.name); reset(); }
  };

  const currentShelf = selectedShelf !== null ? activeLayout.shelves[selectedShelf] : null;
  const areaKey = selectedShelf !== null && selectedRow !== null ? `${selectedShelf}-${selectedRow}-${selectedSide}` : null;
  const levelsCount = areaKey ? (customAreaLevels[areaKey] || currentShelf?.levelsPerFila || 1) : 0;

  const stepLabels = crossMode
    ? ["Almacén", "Estante", "Fila", "Nivel"]
    : ["Estante", "Fila", "Nivel"];
  const stepKeys = crossMode ? ["layout", "shelf", "row", "level"] : ["shelf", "row", "level"];
  const stepIdx = stepKeys.indexOf(step);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={reset}>
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">location_on</span>
              Seleccionar destino
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Paso {stepIdx + 1} de {stepLabels.length}: <strong>{stepLabels[stepIdx]}</strong>
            </p>
          </div>
          <button onClick={reset} className="size-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 transition-colors">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Progress dots */}
        <div className="px-6 pt-3 pb-1 flex gap-2">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className={`h-1.5 w-full rounded-full transition-all ${i <= stepIdx ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`} />
              <span className={`text-[9px] font-bold uppercase tracking-wider ${i <= stepIdx ? 'text-primary' : 'text-slate-400'}`}>{label}</span>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar space-y-2">
          {step === "layout" && (
            <div className="grid grid-cols-1 gap-2">
              {allLayouts.map((lay) => (
                <button key={lay.id} onClick={() => { setChosenLayout(lay); setStep("shelf"); }}
                  className="p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-primary hover:bg-primary/5 transition-all text-left group flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-2xl text-slate-400 group-hover:text-primary transition-colors">warehouse</span>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white group-hover:text-primary">{lay.name}</p>
                    <p className="text-xs text-slate-500">{lay.shelves?.length || 0} estantes</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-300 group-hover:text-primary ml-auto">arrow_forward_ios</span>
                </button>
              ))}
            </div>
          )}

          {step === "shelf" && (
            <div className="grid grid-cols-2 gap-2">
              {activeLayout.shelves.map((shelf, idx) => (
                <button key={idx} onClick={() => { setSelectedShelf(idx); setStep("row"); }}
                  className="p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-primary hover:bg-primary/5 transition-all text-left group flex flex-col gap-1"
                >
                  <span className="material-symbols-outlined text-2xl text-slate-400 group-hover:text-primary transition-colors">shelves</span>
                  <p className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-primary">{shelf.name}</p>
                  <p className="text-[11px] text-slate-400">{shelf.rows} filas · {shelf.type === "double" ? "doble" : "simple"}</p>
                </button>
              ))}
            </div>
          )}

          {step === "row" && currentShelf && (
            <div className="space-y-1.5">
              {Array.from({ length: currentShelf.rows }).map((_, i) => {
                const rowIdx = currentShelf.rows - 1 - i;
                const sides = currentShelf.type === "double" ? ["A", "B"] : ["A"];
                return sides.map((side) => {
                  const aKey = `${selectedShelf}-${rowIdx}-${side}`;
                  const levels = customAreaLevels[aKey] || currentShelf.levelsPerFila || 1;
                  const code = `${selectedShelf + 1}${side}${rowIdx + 1}`;
                  return (
                    <button key={`${rowIdx}-${side}`}
                      onClick={() => { setSelectedRow(rowIdx); setSelectedSide(side); setStep("level"); }}
                      className="w-full p-3.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-primary hover:bg-primary/5 transition-all text-left group flex items-center gap-3"
                    >
                      <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-sm text-slate-700 dark:text-slate-300 group-hover:bg-primary group-hover:text-white transition-all">
                        {code}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-primary">Sección {code}</p>
                        <p className="text-[11px] text-slate-400">{levels} nivel{levels > 1 ? "es" : ""} · Lado {side}</p>
                      </div>
                      <span className="material-symbols-outlined text-slate-300 group-hover:text-primary">arrow_forward_ios</span>
                    </button>
                  );
                });
              })}
            </div>
          )}

          {step === "level" && currentShelf && (
            <div className="space-y-1.5">
              {Array.from({ length: levelsCount }).map((_, levelIdx) => {
                const code = levelsCount > 1
                  ? `${selectedShelf + 1}${selectedSide}${selectedRow + 1}-N${levelIdx + 1}`
                  : `${selectedShelf + 1}${selectedSide}${selectedRow + 1}`;
                const baseKey = `${selectedShelf}-${selectedRow}-${levelIdx}-${selectedSide}`;
                const fullKey = `${activeLayout.id}__${baseKey}`;
                const isExcluded = fullKey === excludeLocation;
                return (
                  <button key={levelIdx} disabled={isExcluded}
                    onClick={() => setSelectedLevel(levelIdx)}
                    className={`w-full p-3.5 rounded-xl border-2 transition-all text-left flex items-center gap-3
                      ${selectedLevel === levelIdx
                        ? 'border-primary bg-primary/10'
                        : isExcluded
                          ? 'border-slate-100 dark:border-slate-800 opacity-40 cursor-not-allowed'
                          : 'border-slate-200 dark:border-slate-700 hover:border-primary hover:bg-primary/5'
                      }`}
                  >
                    <div className={`size-10 rounded-xl flex items-center justify-center font-black text-sm transition-all
                      ${selectedLevel === levelIdx ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                      N{levelIdx + 1}
                    </div>
                    <div className="flex-1">
                      <p className={`font-bold text-sm ${selectedLevel === levelIdx ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>{code}</p>
                      <p className="text-[11px] text-slate-400">Nivel {levelIdx + 1}{isExcluded ? " (ubicación actual)" : ""}</p>
                    </div>
                    {selectedLevel === levelIdx && (
                      <span className="material-symbols-outlined text-primary">check_circle</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex justify-between gap-3">
          <button onClick={goBack}
            className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm"
          >
            {step === (crossMode ? "layout" : "shelf") ? "Cancelar" : "← Atrás"}
          </button>
          {step === "level" && (
            <button onClick={confirm} disabled={selectedLevel === null}
              className="px-6 py-2.5 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50 text-sm"
            >
              <span className="material-symbols-outlined text-[18px]">check</span>
              Confirmar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationSelector;
