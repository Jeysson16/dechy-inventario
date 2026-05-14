import React, { useState } from "react";

/**
 * LocationSelector Component
 * Provides a step-by-step modal for selecting location (Shelf > Row > Level)
 */
export const LocationSelector = ({
  isOpen,
  layout,
  onSelect,
  onClose,
  excludeLocation = null,
}) => {
  const [step, setStep] = useState("shelf"); // 'shelf' | 'row' | 'level'
  const [selectedShelf, setSelectedShelf] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);

  if (!isOpen || !layout) return null;

  const handleShelfSelect = (shelfIdx) => {
    setSelectedShelf(shelfIdx);
    setSelectedRow(null);
    setSelectedLevel(null);
    setStep("row");
  };

  const handleRowSelect = (rowIdx) => {
    setSelectedRow(rowIdx);
    setSelectedLevel(null);
    setStep("level");
  };

  const handleLevelSelect = (levelIdx) => {
    setSelectedLevel(levelIdx);
    const shelf = layout.shelves[selectedShelf];
    const baseKey = `${selectedShelf}-${rowIdx}-${levelIdx}-${shelf.type === "double" ? "A" : "A"}`;
    const key = `${layout.id}__${baseKey}`;

    if (key !== excludeLocation) {
      onSelect(key);
      resetSelection();
    }
  };

  const handleConfirm = () => {
    if (
      selectedShelf !== null &&
      selectedRow !== null &&
      selectedLevel !== null
    ) {
      const shelf = layout.shelves[selectedShelf];
      const sides = shelf.type === "double" ? ["A", "B"] : ["A"];
      const side = sides[0];
      const baseKey = `${selectedShelf}-${selectedRow}-${selectedLevel}-${side}`;
      const key = `${layout.id}__${baseKey}`;

      if (key !== excludeLocation) {
        onSelect(key);
        resetSelection();
      }
    }
  };

  const resetSelection = () => {
    setStep("shelf");
    setSelectedShelf(null);
    setSelectedRow(null);
    setSelectedLevel(null);
    onClose();
  };

  const currentShelf =
    selectedShelf !== null ? layout.shelves[selectedShelf] : null;
  const { customAreaLevels = {} } = layout;
  const areaKey =
    selectedShelf !== null && selectedRow !== null
      ? `${selectedShelf}-${selectedRow}-A`
      : null;
  const levelsCount = areaKey
    ? customAreaLevels[areaKey] || currentShelf.levelsPerFila || 1
    : 0;

  // Generar nombre compacto de ubicación (ej: 1A3, 2B5)
  const getLocationName = (shelfIdx, side, rowIdx, levelIdx) => {
    const shelfNum = shelfIdx + 1;
    const rowNum = rowIdx + 1;
    const levelNum = levelIdx + 1;
    return levelsCount > 1
      ? `${shelfNum}${side}${rowNum}-${levelNum}`
      : `${shelfNum}${side}${rowNum}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
      onClick={resetSelection}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">
              location_on
            </span>
            Seleccionar Ubicación
          </h3>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
            {step === "shelf"
              ? "Paso 1: Estante"
              : step === "row"
                ? `Paso 2: Fila (${currentShelf?.name})`
                : `Paso 3: Nivel - ${currentShelf?.name}`}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex gap-2">
          {["shelf", "row", "level"].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all ${
                step === s ||
                (step === "row" && s !== "shelf") ||
                (step === "level" && s !== "shelf")
                  ? step === s
                    ? "bg-primary"
                    : "bg-slate-300 dark:bg-slate-600"
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          {step === "shelf" ? (
            /* Shelf Selection */
            <div className="grid grid-cols-2 gap-3">
              {layout.shelves.map((shelf, idx) => (
                <button
                  key={idx}
                  onClick={() => handleShelfSelect(idx)}
                  className="p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all text-left group"
                >
                  <span className="material-symbols-outlined text-3xl text-slate-400 group-hover:text-primary transition-colors mb-2">
                    shelves
                  </span>
                  <p className="font-bold text-slate-900 dark:text-white group-hover:text-primary">
                    {shelf.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {shelf.rows} filas ×{" "}
                    {shelf.type === "double" ? "2 lados" : "1 lado"}
                  </p>
                </button>
              ))}
            </div>
          ) : step === "row" ? (
            /* Row Selection */
            <div className="space-y-2">
              {Array.from({ length: currentShelf.rows }).map((_, rowIdx) => {
                const sides =
                  currentShelf.type === "double" ? ["A", "B"] : ["A"];
                return sides.map((side) => (
                  <button
                    key={`${rowIdx}-${side}`}
                    onClick={() => handleRowSelect(rowIdx)}
                    className="w-full p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white group-hover:text-primary">
                          {getLocationName(selectedShelf, side, rowIdx, 0)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {currentShelf.type === "double" ? "Doble" : "Simple"}{" "}
                          (
                          {customAreaLevels[
                            `${selectedShelf}-${rowIdx}-${side}`
                          ] ||
                            currentShelf.levelsPerFila ||
                            1}{" "}
                          nivel
                          {(customAreaLevels[
                            `${selectedShelf}-${rowIdx}-${side}`
                          ] ||
                            currentShelf.levelsPerFila ||
                            1) > 1
                            ? "es"
                            : ""}
                          )
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">
                        arrow_forward_ios
                      </span>
                    </div>
                  </button>
                ));
              })}
            </div>
          ) : (
            /* Level Selection */
            <div className="space-y-2">
              {Array.from({ length: levelsCount }).map((_, levelIdx) => {
                const sides =
                  currentShelf.type === "double" ? ["A", "B"] : ["A"];
                return sides.map((side) => (
                  <button
                    key={`${levelIdx}-${side}`}
                    onClick={() => handleLevelSelect(levelIdx)}
                    className="w-full p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white group-hover:text-primary">
                          {getLocationName(
                            selectedShelf,
                            side,
                            selectedRow,
                            levelIdx,
                          )}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Lado {side}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">
                        arrow_forward_ios
                      </span>
                    </div>
                  </button>
                ));
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between gap-3">
          <button
            onClick={() => {
              if (step === "row") {
                setStep("shelf");
                setSelectedShelf(null);
              } else if (step === "level") {
                setStep("row");
                setSelectedLevel(null);
              } else {
                resetSelection();
              }
            }}
            className="px-5 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {step === "shelf" ? "Cancelar" : "Atrás"}
          </button>

          {step === "level" && (
            <button
              onClick={handleConfirm}
              className="px-8 py-3 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined">check</span>
              Confirmar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationSelector;
