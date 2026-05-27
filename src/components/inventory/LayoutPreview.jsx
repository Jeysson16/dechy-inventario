import { useState } from "react";

/* ── Slot Card ── */
const SlotCard = ({
  label,
  totalQty,
  isHighlighted,
  isSelected,
  isFocused,
  onClick,
}) => {
  const hasStock = totalQty > 0;
  return (
    <div className="relative group">
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => e.key === "Enter" && onClick?.()}
        className={`
          w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center
          transition-all duration-150 font-black text-[11px] select-none cursor-pointer
          ${
            isFocused
              ? "border-primary bg-primary/15 text-primary shadow-md shadow-primary/25 ring-2 ring-primary/40"
              : isSelected
                ? "border-primary/60 bg-primary/5 text-primary shadow-sm"
                : isHighlighted
                  ? "border-rose-400 bg-rose-50 dark:bg-rose-900/20 text-rose-600"
                  : hasStock
                    ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 hover:border-emerald-400 hover:shadow-sm"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          }
        `}
      >
        <span className="leading-none tracking-tight">{label}</span>
        {hasStock ? (
          <span
            className={`text-[9px] font-bold leading-none mt-0.5 ${
              isFocused || isSelected
                ? "text-primary"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {totalQty}
          </span>
        ) : (
          <span className="text-[8px] leading-none opacity-40 mt-0.5">
            vacío
          </span>
        )}
      </div>
      {!isFocused && (
        <div
          className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 pointer-events-none z-50
          bg-slate-900 dark:bg-slate-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-lg
          whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        >
          {label}
          {hasStock ? ` · ${totalQty} uds` : " · Vacío"}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900 dark:border-t-slate-700" />
        </div>
      )}
    </div>
  );
};
/* ── LayoutPreview ── */
const LayoutPreview = ({
  layout,
  onAreaClick = () => {},
  onClearSlot,
  onQuantityChange,
  highlightedAreas = [],
  selectedAreas = [],
  focusedAreas = [],
  quantities = {},
  readOnly = false,
  className = "",
  zoom: externalZoom,
  onZoomChange,
  products = [],
  dimmed = false,
}) => {
  const { shelves, customAreaNames = {}, customAreaLevels = {} } = layout;
  const [internalZoom, setInternalZoom] = useState(1);

  const currentZoom = externalZoom !== undefined ? externalZoom : internalZoom;
  const handleZoomChange = (v) => {
    if (onZoomChange) onZoomChange(v);
    else setInternalZoom(v);
  };

  if (!layout || !shelves) return null;

  /* Total qty at a slot (sum across all levels) */
  const slotTotal = (shelfIdx, rowIdx, side) => {
    const areaKey = `${shelfIdx}-${rowIdx}-${side}`;
    const levels =
      customAreaLevels[areaKey] || shelves[shelfIdx]?.levelsPerFila || 1;
    let total = 0;
    for (let l = 0; l < levels; l++) {
      const k = `${shelfIdx}-${rowIdx}-${l}-${side}`;
      total += Number(
        quantities[k] || quantities[`${shelfIdx}-${rowIdx}-${side}`] || 0,
      );
    }
    // Also accumulate from actual products (more accurate)
    if (products.length > 0) {
      total = 0;
      products.forEach((p) => {
        if (!p.locations) return;
        Object.entries(p.locations).forEach(([key, qty]) => {
          const short = key.includes("__") ? key.split("__")[1] : key;
          const regex = new RegExp(`^${shelfIdx}-${rowIdx}-\\d+-${side}$`);
          const legacyMatch = short === `${shelfIdx}-${rowIdx}-${side}`;
          if (regex.test(short) || legacyMatch) total += Number(qty) || 0;
        });
      });
    }
    return total;
  };

  return (
    <div className={`relative ${className}`}>
      {/* Dimmed overlay when a panel is open */}
      {dimmed && (
        <div className="absolute inset-0 bg-slate-900/10 dark:bg-slate-900/25 pointer-events-none z-20 rounded-lg transition-opacity" />
      )}
      {/* Zoom Controls */}
      {externalZoom === undefined && (
        <div className="absolute top-4 right-4 flex flex-col gap-1.5 z-30">
          {[
            {
              icon: "add",
              action: () => handleZoomChange(Math.min(currentZoom + 0.15, 2.5)),
            },
            {
              icon: "remove",
              action: () => handleZoomChange(Math.max(currentZoom - 0.15, 0.4)),
            },
            { icon: "center_focus_strong", action: () => handleZoomChange(1) },
          ].map(({ icon, action }) => (
            <button
              key={icon}
              onClick={action}
              className="size-9 bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-primary hover:border-primary/30 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">
                {icon}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Canvas */}
      <div
        className="w-max mx-auto py-8 px-6 origin-top transition-transform duration-300"
        style={{ transform: `scale(${currentZoom})` }}
      >
        <div className="flex gap-5 items-start flex-wrap">
          {shelves.map((shelf, shelfIdx) => {
            const isDouble = shelf.type === "double";
            const sides = isDouble ? ["A", "B"] : ["A"];

            return (
              <div
                key={shelf.id || shelfIdx}
                className="flex flex-col items-center gap-2 shrink-0"
              >
                {/* Shelf label */}
                <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 dark:bg-primary/20 rounded-full border border-primary/25 w-full justify-center">
                  <span className="material-symbols-outlined text-[13px] text-primary">
                    shelves
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary whitespace-nowrap">
                    {shelf.name || `Estante ${shelfIdx + 1}`}
                  </span>
                </div>

                {/* Shelf body */}
                <div className="flex gap-1.5 p-3 bg-slate-100/60 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700">
                  {sides.map((side) => (
                    <div key={side} className="flex flex-col gap-2.5">
                      {/* Slots — top = highest row, bottom = row 1 */}
                      {Array.from({ length: shelf.rows }).map((_, i) => {
                        const rowIdx = shelf.rows - 1 - i;
                        const areaKey = `${shelfIdx}-${rowIdx}-${side}`;
                        const label =
                          customAreaNames[areaKey] ||
                          `${shelfIdx + 1}${side}${rowIdx + 1}`;
                        const total = slotTotal(shelfIdx, rowIdx, side);
                        const isHighlighted = highlightedAreas.some(
                          (k) =>
                            k.startsWith(`${shelfIdx}-${rowIdx}-`) &&
                            k.endsWith(`-${side}`),
                        );
                        const isSelected = selectedAreas.some(
                          (k) =>
                            k.startsWith(`${shelfIdx}-${rowIdx}-`) &&
                            k.endsWith(`-${side}`),
                        );
                        // qty for this slot at level 0 (used by stepper)
                        const slotQtyKey = `${shelfIdx}-${rowIdx}-0-${side}`;
                        const slotQty = Number(
                          quantities[slotQtyKey] ?? quantities[areaKey] ?? 0,
                        );

                        return (
                          <SlotCard
                            key={areaKey}
                            label={label}
                            totalQty={total}
                            isHighlighted={isHighlighted}
                            isSelected={isSelected}
                            isFocused={focusedAreas.some(
                              (k) =>
                                k.startsWith(`${shelfIdx}-${rowIdx}-`) &&
                                k.endsWith(`-${side}`),
                            )}
                            onClick={() =>
                              !readOnly && onAreaClick(shelfIdx, rowIdx, side)
                            }
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Row numbers — hidden */}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LayoutPreview;
