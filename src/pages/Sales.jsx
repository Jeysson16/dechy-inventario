import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import DraggableContainer from "../components/common/DraggableContainer";
import LayoutPreview from "../components/inventory/LayoutPreview";
import AppLayout from "../components/layout/AppLayout";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import efectivoIcon from "../../img/iconos/efectivo.png";
import transferenciaIcon from "../../img/iconos/transferencia.png";
import yapeIcon from "../../img/iconos/yape.png";
import posIcon from "../../img/iconos/pos.png";

/* ─── Box/Unit calculation helper ─── */
const calcSale = (product, mode, qty) => {
  const upb = Number(product.unitsPerBox) || 1;
  const q = Number(qty) || 0;

  const wPrice = Number(product.wholesalePrice) || 0;
  const wThreshold = Number(product.wholesaleThreshold) || 0;
  const wUnit = product.wholesaleThresholdUnit || "cajas";

  let isWholesale = false;
  if (wPrice > 0 && wThreshold > 0) {
    const currentQtyInThresholdUnit =
      mode === wUnit ? q : mode === "cajas" ? q * upb : q / upb;
    if (currentQtyInThresholdUnit >= wThreshold) {
      isWholesale = true;
    }
  }

  const activeUnitPrice = isWholesale ? wPrice : Number(product.unitPrice) || 0;
  const activeBoxPrice = isWholesale
    ? wPrice * upb
    : Number(product.boxPrice) || 0;

  if (mode === "cajas") {
    return {
      boxesDeducted: q,
      totalUnits: q * upb,
      fullBoxes: q,
      remainderUnits: 0,
      subtotal: q * activeBoxPrice,
      isWholesale,
      activePrice: activeBoxPrice,
    };
  }

  // mode === 'unidades'
  const fullBoxes = Math.floor(q / upb);
  const remainderUnits = q % upb;
  const boxesDeducted = fullBoxes;
  const subtotal =
    fullBoxes * activeBoxPrice + remainderUnits * activeUnitPrice;

  return {
    boxesDeducted,
    totalUnits: q,
    fullBoxes,
    remainderUnits,
    subtotal,
    isWholesale,
    activePrice: activeUnitPrice,
  };
};

const PAYMENT_METHODS = [
  { key: "cash", label: "Efectivo", icon: efectivoIcon },
  { key: "transfer", label: "Transferencia", icon: transferenciaIcon },
  { key: "Seleccione método de pago", label: "Yape", icon: yapeIcon },
  { key: "pos", label: "POS", icon: posIcon },
];

/* ─── Sale Modal ─── */
const SaleModal = ({ product, onClose, branchLayout }) => {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState("cajas");
  const [qty, setQty] = useState("");
  const [distribution, setDistribution] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [zoom, setZoom] = useState(1);

  const relevantLocations = useMemo(() => {
    if (!branchLayout) return {};
    const locs = {};
    Object.entries(product.locations || {}).forEach(([key, qty]) => {
      if (key.startsWith(`${branchLayout.id}__`)) {
        locs[key.replace(`${branchLayout.id}__`, "")] = qty;
      } else if (
        !key.includes("__") &&
        (branchLayout.id === "main" || branchLayout.id === "default")
      ) {
        locs[key] = qty;
      }
    });
    return locs;
  }, [product.locations, branchLayout]);

  const upb = Number(product.unitsPerBox) || 1;
  const maxStock =
    mode === "cajas" ? product.currentStock : product.currentStock * upb;

  const calc = useMemo(() => {
    const q = Number(qty) || 0;
    if (q <= 0) return null;
    return calcSale(product, mode, q);
  }, [product, mode, qty]);

  const isStep1Valid = useMemo(() => {
    if (!calc) return false;
    if (calc.boxesDeducted > product.currentStock) return false;
    return true;
  }, [calc, product]);

  const isStep2Valid = useMemo(() => {
    if (!calc) return false;
    const requiredBoxes = calc.boxesDeducted;
    if (requiredBoxes === 0) return true;
    const distributedTotal = Object.values(distribution).reduce(
      (sum, v) => sum + (Number(v) || 0),
      0,
    );
    return distributedTotal === requiredBoxes;
  }, [calc, distribution]);

  useEffect(() => {
    if (step === 2 && calc && calc.boxesDeducted > 0) {
      const needed = calc.boxesDeducted;
      const newDist = {};
      let remaining = needed;
      const locs = relevantLocations || {};
      for (const [key, qtyInLoc] of Object.entries(locs)) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, qtyInLoc);
        newDist[key] = take;
        remaining -= take;
      }
      setDistribution(newDist);
    } else if (step === 2) {
      setDistribution({});
    }
  }, [step, calc, relevantLocations]);

  const handleMapQuantityChange = useCallback(
    (key, newValue) => {
      const numValue = Number(newValue) || 0;
      const maxQty = relevantLocations?.[key] || 0;
      const currentTotal = Object.values(distribution).reduce(
        (sum, v) => sum + (Number(v) || 0),
        0,
      );
      const oldValue = distribution[key] || 0;
      const newTotal = currentTotal - oldValue + numValue;

      if (numValue > maxQty) {
        toast.error(
          `La cantidad excede el stock en esta ubicación (${maxQty})`,
        );
      }
      if (newTotal > calc.boxesDeducted) {
        toast.error(
          `Has superado el total de cajas requeridas (${calc.boxesDeducted})`,
        );
      }

      setDistribution((prev) => ({
        ...prev,
        [key]: newValue === "" ? "" : numValue,
      }));
    },
    [distribution, relevantLocations, calc],
  );

  const handleAreaClick = useCallback(
    (shelfIdx, rowIdx, side, levelIdx = 0) => {
      const baseKey = `${shelfIdx}-${rowIdx}-${levelIdx}-${side}`;
      const legacyKey = `${shelfIdx}-${rowIdx}-${side}`;

      if (!relevantLocations) return;

      let key = baseKey;
      if (
        relevantLocations[baseKey] === undefined &&
        levelIdx === 0 &&
        relevantLocations[legacyKey] !== undefined
      ) {
        key = legacyKey;
      }

      if (relevantLocations[key] === undefined) return;
      setSelectedLocation((prev) => (prev === key ? null : key));
    },
    [relevantLocations],
  );

  const handleConfirm = async () => {
    if (!isStep2Valid) return;
    setSaving(true);
    try {
      const cartItem = {
        ...product,
        quantityBoxes: calc.boxesDeducted,
        quantityUnits: calc.totalUnits,
        remainderUnits: calc.remainderUnits,
        fullBoxes: calc.fullBoxes,
        subtotal: calc.subtotal,
        saleMode: mode,
        distribution: distribution,
      };
      toast.success(`${product.name} agregado al carrito.`);
      onClose(cartItem);
    } catch (err) {
      console.error(err);
      toast.error("Error al agregar al carrito.");
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustQty = (delta) => {
    const current = Number(qty) || 0;
    const next = Math.max(0, Math.min(maxStock, current + delta));
    setQty(next === 0 ? "" : next.toString());
  };

  const renderStepper = () => (
    <div className="flex items-center justify-center gap-4 mb-6">
      <div
        className={`flex items-center gap-2 ${step >= 1 ? "text-primary" : "text-slate-300"}`}
      >
        <div
          className={`size-8 rounded-full flex items-center justify-center text-sm font-black border-2 ${step >= 1 ? "border-primary bg-primary text-white" : "border-slate-300 bg-white"}`}
        >
          1
        </div>
        <span className="text-xs font-bold uppercase tracking-wider hidden sm:block">
          Cantidad
        </span>
      </div>
      <div className="w-12 h-0.5 bg-slate-100 dark:bg-slate-800"></div>
      <div
        className={`flex items-center gap-2 ${step >= 2 ? "text-primary" : "text-slate-300 dark:text-slate-700"}`}
      >
        <div
          className={`size-8 rounded-full flex items-center justify-center text-sm font-black border-2 ${step >= 2 ? "border-primary bg-primary text-white" : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"}`}
        >
          2
        </div>
        <span className="text-xs font-bold uppercase tracking-wider hidden sm:block">
          Ubicación
        </span>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh] transition-all duration-500 ease-out ${step === 1 ? "max-w-lg" : "max-w-5xl"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                className="size-10 rounded-lg object-cover border border-slate-200"
              />
            ) : (
              <div className="size-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                <span className="material-symbols-outlined text-[20px]">
                  inventory_2
                </span>
              </div>
            )}
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white leading-tight line-clamp-1">
                {product.name}
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                {product.sku}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
          {renderStepper()}
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 max-w-sm mx-auto">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                <button
                  onClick={() => {
                    setMode("cajas");
                    setQty("");
                  }}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${mode === "cajas" ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    inventory_2
                  </span>
                  Por Cajas
                </button>
                <button
                  onClick={() => {
                    setMode("unidades");
                    setQty("");
                  }}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${mode === "unidades" ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    view_module
                  </span>
                  Por Unidades
                </button>
              </div>
              <div className="flex flex-col items-center gap-4">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Ingrese Cantidad
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleAdjustQty(-1)}
                    className="size-12 rounded-2xl border-2 border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all text-slate-600 dark:text-slate-400"
                  >
                    <span className="material-symbols-outlined">remove</span>
                  </button>
                  <input
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder="0"
                    className="w-32 h-16 text-4xl font-black text-center bg-transparent border-b-2 border-slate-200 dark:border-slate-800 focus:border-primary outline-none text-slate-900 dark:text-white placeholder-slate-200 dark:placeholder-slate-800 transition-colors"
                    autoFocus
                  />
                  <button
                    onClick={() => handleAdjustQty(1)}
                    className="size-12 rounded-2xl border-2 border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all text-slate-600 dark:text-slate-400"
                  >
                    <span className="material-symbols-outlined">add</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  Disponible: {maxStock} {mode}
                </p>
              </div>
              {calc && (
                <div
                  className={`rounded-2xl p-4 border flex items-center justify-between transition-colors ${calc.isWholesale ? "bg-primary/10 border-primary/20" : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800"}`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Total Estimado
                      </p>
                      {calc.isWholesale && (
                        <span className="bg-primary text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">
                          Precio Mayor
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-2xl font-black ${calc.isWholesale ? "text-primary" : "text-slate-900 dark:text-white"}`}
                    >
                      S/ {calc.subtotal.toFixed(2)}
                    </p>
                    {calc.isWholesale && (
                      <p className="text-[10px] text-primary/70 font-bold italic">
                        Aplicado: S/ {calc.activePrice.toFixed(2)} /{" "}
                        {mode === "cajas" ? "caja" : "unid"}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Retiro Físico
                    </p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      {calc.fullBoxes} Cajas + {calc.remainderUnits} Unid.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          {step === 2 && (
            <div className="flex flex-col h-full min-h-[600px] animate-in slide-in-from-right-4 duration-300 relative">
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-6 py-2 rounded-2xl shadow-lg border border-primary/10 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                    Total Requerido
                  </p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    {calc.boxesDeducted}{" "}
                    <span className="text-xs font-bold text-slate-400">
                      cajas
                    </span>
                  </p>
                </div>
                <div className="w-px h-8 bg-slate-200 dark:bg-slate-800"></div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Asignado
                  </p>
                  <p
                    className={`text-xl font-black ${Object.values(distribution).reduce((a, b) => a + b, 0) === calc.boxesDeducted ? "text-emerald-500" : "text-amber-500"}`}
                  >
                    {Object.values(distribution).reduce((a, b) => a + b, 0)}{" "}
                    <span className="text-xs font-bold text-slate-300">
                      cajas
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex-1 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden relative group">
                {branchLayout ? (
                  <>
                    <DraggableContainer>
                      <div className="min-w-max p-10 origin-center transform-gpu transition-transform duration-300">
                        <LayoutPreview
                          layout={branchLayout}
                          highlightedAreas={Object.keys(
                            relevantLocations || {},
                          )}
                          selectedAreas={
                            selectedLocation ? [selectedLocation] : []
                          }
                          quantities={distribution}
                          maxQuantities={relevantLocations || {}}
                          onQuantityChange={handleMapQuantityChange}
                          onAreaClick={handleAreaClick}
                          readOnly={false}
                          zoom={zoom}
                          onZoomChange={setZoom}
                        />
                      </div>
                    </DraggableContainer>
                    <div className="absolute top-4 right-4 flex flex-col gap-2 z-30 pointer-events-auto">
                      <button
                        onClick={() => setZoom((z) => Math.min(z + 0.1, 2))}
                        className="size-10 bg-white rounded-xl shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <span className="material-symbols-outlined">add</span>
                      </button>
                      <button
                        onClick={() => setZoom((z) => Math.max(z - 0.1, 0.5))}
                        className="size-10 bg-white rounded-xl shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <span className="material-symbols-outlined">
                          remove
                        </span>
                      </button>
                      <button
                        onClick={() => setZoom(1)}
                        className="size-10 bg-white rounded-xl shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <span className="material-symbols-outlined">
                          center_focus_strong
                        </span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <span className="material-symbols-outlined text-slate-300 text-6xl mb-4">
                      sentiment_dissatisfied
                    </span>
                    <p className="text-base text-slate-600 font-bold">
                      Sin mapa disponible
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-95"
            >
              Atrás
            </button>
          )}
          {step === 1 ? (
            <button
              onClick={() => isStep1Valid && setStep(2)}
              disabled={!isStep1Valid}
              className="flex-1 py-3.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none active:scale-95 flex items-center justify-center gap-2"
            >
              Continuar{" "}
              <span className="material-symbols-outlined text-[18px]">
                arrow_forward
              </span>
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={!isStep2Valid || saving}
              className="flex-1 py-3.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none active:scale-95 flex items-center justify-center gap-2"
            >
              {saving ? (
                <span className="material-symbols-outlined animate-spin text-[20px]">
                  progress_activity
                </span>
              ) : (
                <span className="material-symbols-outlined text-[20px]">
                  check
                </span>
              )}
              {saving ? "Procesando..." : "Confirmar Venta"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Product Card ─── */
const ProductCard = ({ product, onSell }) => {
  const upb = Number(product.unitsPerBox) || 1;
  const stock = Number(product.currentStock) || 0;
  const isOut = stock === 0;
  const statusStyle = isOut
    ? "bg-red-100 text-red-700"
    : stock <= 10
      ? "bg-amber-100 text-amber-700"
      : "bg-emerald-100 text-emerald-700";

  return (
    <div
      className={`flex flex-col bg-white dark:bg-slate-900 rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${isOut ? "border-red-200 dark:border-red-900/50 opacity-70" : "border-slate-200 dark:border-slate-800"}`}
    >
      <div className="relative w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
        {product.imageUrl ? (
          <img src={product.imageUrl} className="w-full h-full object-cover" />
        ) : (
          <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-700">
            image
          </span>
        )}
        <span
          className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${statusStyle}`}
        >
          {isOut ? "Agotado" : stock <= 10 ? "Stock Bajo" : "Disponible"}
        </span>
      </div>
      <div className="flex flex-col flex-1 p-5 gap-3">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white leading-tight line-clamp-2">
            {product.name}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
            {product.sku} · {product.category}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs py-3 border-y border-slate-100 dark:border-slate-800">
          <div className="flex flex-col">
            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter">
              Precio Unit.
            </span>
            <span className="text-slate-800 dark:text-slate-200 font-bold">
              S/ {Number(product.unitPrice || product.price || 0).toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter">
              Precio Caja
            </span>
            <span className="text-slate-800 dark:text-slate-200 font-bold">
              S/ {Number(product.boxPrice || 0).toFixed(2)}
            </span>
          </div>
          {Number(product.wholesalePrice) > 0 && (
            <div className="flex flex-col col-span-2 mt-1 py-1 px-2 bg-primary/5 rounded border border-primary/10">
              <div className="flex justify-between items-center">
                <span className="text-primary font-black uppercase tracking-tighter text-[9px]">
                  Precio Mayor
                </span>
                <span className="text-primary font-black">
                  S/ {Number(product.wholesalePrice).toFixed(2)}
                </span>
              </div>
              <p className="text-[8px] text-slate-400 font-bold uppercase">
                Desde {product.wholesaleThreshold}{" "}
                {product.wholesaleThresholdUnit}
              </p>
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter">
              Und. / Caja
            </span>
            <span className="text-slate-800 dark:text-slate-200 font-bold">
              {upb} unds.
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter">
              Stock
            </span>
            <span
              className={`font-bold ${isOut ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-200"}`}
            >
              {stock} caja{stock !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-400 text-center">
          ≈ {stock * upb} unidades disponibles
        </p>
        <button
          disabled={isOut}
          onClick={() => onSell(product)}
          className="mt-auto w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-md shadow-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[18px]">
            point_of_sale
          </span>
          {isOut ? "Sin Stock" : "Vender"}
        </button>
      </div>
    </div>
  );
};

/* ─── POS View (New Sale) ─── */
const POSView = ({ onBack }) => {
  const { currentUser, currentBranch, userProfile } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [branchLayouts, setBranchLayouts] = useState([]);
  const [currentLayoutId, setCurrentLayoutId] = useState(null);
  const [cart, setCart] = useState([]);
  const [isCheckoutPanelOpen, setIsCheckoutPanelOpen] = useState(false);
  const [isProcessingSale, setIsProcessingSale] = useState(false);

  useEffect(() => {
    if (!currentBranch) return;
    const q = query(
      collection(db, "products"),
      where("branch", "==", currentBranch.id),
    );
    const productUnsub = onSnapshot(q, (snap) => {
      const data = [];
      snap.forEach((d) => data.push({ id: d.id, ...d.data() }));
      setProducts(data);
      setLoading(false);
    });
    const branchDocRef = doc(db, "branches", currentBranch.id);
    const branchUnsub = onSnapshot(branchDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        let loadedLayouts = [];
        if (data.layouts && Array.isArray(data.layouts)) {
          loadedLayouts = data.layouts;
        } else if (data.layout) {
          loadedLayouts = [{ id: "main", name: "Principal", ...data.layout }];
        }
        setBranchLayouts(loadedLayouts);
        if (loadedLayouts.length > 0 && !currentLayoutId) {
          setCurrentLayoutId(loadedLayouts[0].id);
        }
      }
    });
    return () => {
      productUnsub();
      branchUnsub();
    };
  }, [currentBranch]);

  const activeLayout =
    branchLayouts.find((l) => l.id === currentLayoutId) || branchLayouts[0];

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products],
  );

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = !filterCategory || p.category === filterCategory;
      return matchSearch && matchCat;
    });
  }, [products, searchTerm, filterCategory]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.subtotal, 0),
    [cart],
  );

  const handleSaleClose = useCallback((cartItem) => {
    if (cartItem && cartItem.id) {
      setCart((prev) => {
        const existingId = prev.findIndex((item) => item.id === cartItem.id);
        if (existingId >= 0) {
          const newCart = [...prev];
          const ex = newCart[existingId];
          newCart[existingId] = {
            ...ex,
            quantityBoxes: ex.quantityBoxes + cartItem.quantityBoxes,
            quantityUnits: ex.quantityUnits + cartItem.quantityUnits,
            remainderUnits: ex.remainderUnits + cartItem.remainderUnits,
            fullBoxes: ex.fullBoxes + cartItem.fullBoxes,
            subtotal: ex.subtotal + cartItem.subtotal,
          };
          return newCart;
        }
        return [...prev, cartItem];
      });
      setIsCheckoutPanelOpen(true);
    }
    setSelectedProduct(null);
  }, []);

  const handleRemoveFromCart = (index) =>
    setCart((prev) => prev.filter((_, i) => i !== index));

  const processCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessingSale(true);
    try {
      const batch = writeBatch(db);
      const saleDate = new Date();
      const saleRef = doc(collection(db, "sales"));
      batch.set(saleRef, {
        branchId: currentBranch?.id,
        userId: currentUser?.uid || null,
        user:
          userProfile?.name ||
          currentUser?.displayName ||
          currentUser?.email ||
          "Unknown",
        userName:
          userProfile?.name ||
          currentUser?.displayName ||
          currentUser?.email ||
          "Unknown",
        totalValue: cartTotal,
        date: saleDate,
        status: "pending_payment",
        deliveryLocation: null,
        paidAt: null,
        deliveredAt: null,
        items: cart.map((item) => ({
          productId: item.id,
          productName: item.name,
          productImage: item.imageUrl || null,
          productSku: item.sku,
          quantitySoldUnits: item.quantityUnits,
          quantitySoldBoxes: item.quantityBoxes,
          saleMode: item.saleMode,
          subtotal: item.subtotal,
        })),
      });

      await batch.commit();
      toast.success("¡Venta creada en estado pendiente!");
      setCart([]);
      setIsCheckoutPanelOpen(false);
      onBack(); // Return to history after creating sale
    } catch (error) {
      console.error("Error processing checkout:", error);
      toast.error("Ocurrió un error al procesar el pago.");
    } finally {
      setIsProcessingSale(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-1 relative overflow-hidden h-full">
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-10 py-4 sticky top-0 z-20">
            <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={onBack}
                  className="size-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 transition-colors"
                >
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div>
                  <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    Nueva Venta
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    Seleccione productos para agregar al carrito
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {branchLayouts.length > 1 && (
                  <select
                    value={currentLayoutId || ""}
                    onChange={(e) => setCurrentLayoutId(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {branchLayouts.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => setIsCheckoutPanelOpen(!isCheckoutPanelOpen)}
                  className={`flex items-center gap-3 border rounded-2xl px-5 py-3 transition-colors ${cart.length > 0 ? "bg-primary text-white border-primary/20 shadow-md shadow-primary/20 hover:bg-primary/90" : "bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                >
                  <div className="relative">
                    <span className="material-symbols-outlined shrink-0 text-xl">
                      shopping_cart
                    </span>
                    {cart.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 size-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {cart.length}
                      </span>
                    )}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                      Mi Carrito
                    </p>
                    <p className="font-black leading-none dark:text-white">
                      S/ {cartTotal.toFixed(2)}
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
          <div className="bg-slate-50/80 dark:bg-slate-950/80 border-b border-slate-100 dark:border-slate-900 px-6 lg:px-10 py-4 sticky top-[105px] z-10 backdrop-blur-md">
            <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                  search
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar producto o SKU..."
                  className="w-full pl-10 pr-4 h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-slate-900 dark:text-white"
                />
              </div>
              {categories.length > 0 && (
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 text-sm text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                >
                  <option value="">Todas las categorías</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div className="flex-1 px-6 lg:px-10 py-8">
            <div className="max-w-screen-xl mx-auto">
              {loading ? (
                <div className="flex justify-center py-20">
                  <span className="material-symbols-outlined animate-spin text-4xl text-primary">
                    progress_activity
                  </span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <span className="material-symbols-outlined text-5xl mb-3">
                    inventory_2
                  </span>
                  <p className="font-semibold">No se encontraron productos.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-widest mb-4">
                    {filtered.length} productos encontrados
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                    {filtered.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        onSell={setSelectedProduct}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <aside
          className={`h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out flex flex-col z-30 ${isCheckoutPanelOpen ? "w-full sm:w-[400px] opacity-100" : "w-0 opacity-0 pointer-events-none"} fixed right-0 top-0 sm:sticky sm:top-0 h-screen sm:h-auto`}
        >
          <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-xl">
                  shopping_cart_checkout
                </span>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Carrito de Ventas
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {cart.length} productos
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsCheckoutPanelOpen(false)}
              className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                <span className="material-symbols-outlined text-5xl">
                  shopping_basket
                </span>
                <p className="font-medium">Tu carrito está vacío</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div
                  key={idx}
                  className="flex flex-col gap-3 py-4 border-b border-slate-100 dark:border-slate-800 last:border-0 relative group"
                >
                  <button
                    onClick={() => handleRemoveFromCart(idx)}
                    className="absolute top-4 right-0 text-slate-300 dark:text-slate-600 hover:text-rose-500 transition-colors p-1"
                  >
                    <span className="material-symbols-outlined text-lg">
                      delete
                    </span>
                  </button>
                  <div className="pr-8">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 leading-tight">
                      {item.name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {item.sku}
                    </p>
                  </div>
                  <div className="flex justify-between items-end">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 py-1 px-2 rounded-lg inline-flex items-center gap-1 w-fit">
                      {item.saleMode === "cajas" ? (
                        <>
                          <span className="material-symbols-outlined text-[14px]">
                            inventory_2
                          </span>{" "}
                          {item.quantityBoxes} cjs
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[14px]">
                            view_module
                          </span>{" "}
                          {item.quantityUnits} und
                        </>
                      )}
                    </p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">
                      S/ {item.subtotal.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-4 shrink-0">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                Subtotal
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                S/ {cartTotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-900 dark:text-white font-bold uppercase tracking-wider">
                Total a Pagar
              </span>
              <span className="text-2xl font-black text-primary">
                S/ {cartTotal.toFixed(2)}
              </span>
            </div>
            <button
              onClick={processCheckout}
              disabled={cart.length === 0 || isProcessingSale}
              className="w-full mt-2 py-4 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:shadow-none flex justify-center items-center gap-2"
            >
              {isProcessingSale ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[20px]">
                    progress_activity
                  </span>{" "}
                  Procesando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">
                    payments
                  </span>{" "}
                  Procesar Venta
                </>
              )}
            </button>
          </div>
        </aside>
      </div>
      {selectedProduct && (
        <SaleModal
          product={selectedProduct}
          currentUser={currentUser}
          currentBranch={currentBranch}
          branchLayout={activeLayout}
          onClose={handleSaleClose}
        />
      )}
    </div>
  );
};

/* ─── Sale Detail Modal ─── */
const SaleDetailModal = ({
  sale,
  onClose,
  onMarkPaid,
  onDeliver,
  isUpdating,
  userRole,
  onOpenPaymentModal,
}) => {
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    sale?.paymentMethod || "",
  );

  if (!sale) return null;

  const statusLabel =
    sale.status === "pending_payment"
      ? { text: "Pendiente pago", className: "bg-amber-100 text-amber-700" }
      : sale.status === "pending_delivery"
        ? { text: "Pendiente entrega", className: "bg-sky-100 text-sky-700" }
        : { text: "Entregado", className: "bg-emerald-100 text-emerald-700" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">receipt_long</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white leading-tight">
                Detalle de Venta
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                {sale.date?.toDate().toLocaleString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex justify-between items-center mb-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                Vendido por
              </p>
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                {sale.userName || sale.user}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                Total Venta
              </p>
              <p className="text-2xl font-black text-primary">
                S/ {Number(sale.totalValue).toFixed(2)}
              </p>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-xs font-bold ${statusLabel.className}`}
            >
              {statusLabel.text}
            </div>
          </div>

          {sale.status === "pending_payment" &&
            (userRole === "admin" || userRole === "gerente") && (
              <div className="mb-6">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Método de pago seleccionado
                </p>
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                  {selectedPaymentMethod ? (
                    <>
                      <img
                        src={
                          PAYMENT_METHODS.find(
                            (m) => m.key === selectedPaymentMethod,
                          )?.icon
                        }
                        alt={
                          PAYMENT_METHODS.find(
                            (m) => m.key === selectedPaymentMethod,
                          )?.label
                        }
                        className="w-8 h-8"
                      />
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {
                          PAYMENT_METHODS.find(
                            (m) => m.key === selectedPaymentMethod,
                          )?.label
                        }
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">
                      Ninguno seleccionado
                    </span>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <button
                    onClick={() => onOpenPaymentModal(sale)}
                    disabled={isUpdating}
                    className="w-full py-3 rounded-xl bg-sky-500 text-white font-bold hover:bg-sky-600 transition-all disabled:opacity-50"
                  >
                    Seleccionar Pago
                  </button>
                  <button
                    onClick={() => onMarkPaid(sale, selectedPaymentMethod)}
                    disabled={isUpdating || !selectedPaymentMethod}
                    className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
                  >
                    {isUpdating ? "Procesando..." : "Marcar como Pagado"}
                  </button>
                </div>
              </div>
            )}

          {sale.status === "pending_delivery" && (
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Ubicación/Croquis (requerido para entregar)
                </label>
                <input
                  value={deliveryLocation}
                  onChange={(e) => setDeliveryLocation(e.target.value)}
                  placeholder="Ejm: Estante A3 / Pasillo 2"
                  className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                />
                <button
                  onClick={() => onDeliver(sale, deliveryLocation)}
                  disabled={isUpdating || !deliveryLocation.trim()}
                  className="mt-3 w-full py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
                >
                  {isUpdating ? "Procesando..." : "Entregar Productos"}
                </button>
              </div>
            </div>
          )}

          <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
            Productos Vendidos
          </h4>
          <div className="space-y-3">
            {sale.items?.map((item, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center p-3 border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {item.productImage ? (
                    <img
                      src={item.productImage}
                      alt={item.productName}
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined">image</span>
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      {item.productName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {item.saleMode === "cajas"
                        ? `${item.quantitySoldBoxes} cajas`
                        : `${item.quantitySoldUnits} unidades`}
                    </p>
                  </div>
                </div>
                <p className="font-bold text-slate-900 dark:text-white">
                  S/ {Number(item.subtotal).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-slate-900 dark:bg-slate-700 text-white font-bold text-sm hover:bg-slate-800 dark:hover:bg-slate-600 transition-all"
          >
            Cerrar Detalle
          </button>
        </div>
      </div>
    </div>
  );
};

const formatDateString = (date) => {
  const d = date?.toDate ? date.toDate() : date;
  if (!d) return "";
  return d.toLocaleDateString("es-PE");
};

const formatDateForFile = (date) => {
  const d = date?.toDate ? date.toDate() : date;
  if (!d) return "reporte";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
};

const ReportModal = ({ open, onClose, onGenerate, isGenerating }) => {
  if (!open) return null;
  const today = new Date();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white leading-tight">
              Generar reporte de venta diaria
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Se incluirán solo ventas con estado entregado del día{" "}
              {formatDateString(today)}.
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="flex-1 p-6">
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => onGenerate("pdf")}
              disabled={isGenerating}
              className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              {isGenerating ? "Generando PDF..." : "Descargar PDF"}
            </button>
            <button
              onClick={() => onGenerate("excel")}
              disabled={isGenerating}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              {isGenerating ? "Generando Excel..." : "Descargar Excel"}
            </button>
          </div>
        </div>
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-slate-900 dark:bg-slate-700 text-white font-bold text-sm hover:bg-slate-800 dark:hover:bg-slate-600 transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

const PaymentModal = ({ open, onClose, onSelectPayment, sale, isUpdating }) => {
  if (!open || !sale) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white leading-tight">
              Seleccionar Método de Pago
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Venta: {sale.id} - Total: S/ {Number(sale.totalValue).toFixed(2)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="flex-1 p-6">
          <div className="grid grid-cols-2 gap-4">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.key}
                onClick={() => onSelectPayment(method.key)}
                disabled={isUpdating}
                className="aspect-square rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all flex flex-col items-center justify-center gap-3 p-4 disabled:opacity-50"
              >
                <img
                  src={method.icon}
                  alt={method.label}
                  className="w-16 h-16"
                />
                <span className="font-bold text-slate-900 dark:text-white text-sm text-center">
                  {method.label}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-slate-900 dark:bg-slate-700 text-white font-bold text-sm hover:bg-slate-800 dark:hover:bg-slate-600 transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

const exportSalesToExcel = async (sales, reportDate, branchName) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Ventas");
  sheet.properties.defaultRowHeight = 18;

  sheet.mergeCells("A1:I1");
  sheet.getCell("A1").value = "REPORTE DE VENTAS DETALLADO";
  sheet.getCell("A1").font = { size: 14, bold: true };
  sheet.getCell("A1").alignment = { horizontal: "center" };

  sheet.mergeCells("A2:I2");
  sheet.getCell("A2").value =
    `Sucursal: ${branchName || "N/A"} - Fecha: ${formatDateString(reportDate)}`;
  sheet.getCell("A2").font = { size: 10, bold: false };
  sheet.getCell("A2").alignment = { horizontal: "center" };

  sheet.addRow([]);
  sheet.columns = [
    { header: "Fecha", key: "date", width: 14 },
    { header: "Venta", key: "saleId", width: 28 },
    { header: "Cliente", key: "cliente", width: 26 },
    { header: "Pago", key: "pago", width: 14 },
    { header: "Código", key: "codigo", width: 16 },
    { header: "Artículo", key: "articulo", width: 40 },
    { header: "Present.", key: "present", width: 10 },
    { header: "Cantidad", key: "cantidad", width: 10 },
    { header: "Precio", key: "precio", width: 14 },
    { header: "Importe", key: "importe", width: 14 },
  ];

  let overallTotal = 0;

  sales.forEach((sale) => {
    const saleDate = sale.date?.toDate ? sale.date.toDate() : sale.date;
    const paymentLabel =
      PAYMENT_METHODS.find((m) => m.key === sale.paymentMethod)?.label || "";
    const saleHeader = sheet.addRow({
      date: formatDateString(saleDate),
      saleId: sale.id,
      cliente: sale.userName || sale.user || "N/A",
      pago: paymentLabel,
    });
    saleHeader.font = { bold: true };
    saleHeader.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEEEEEE" },
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    let saleSubtotal = 0;
    (sale.items || []).forEach((item) => {
      const itemTotal = Number(item.subtotal) || 0;
      saleSubtotal += itemTotal;
      const price =
        item.saleMode === "cajas"
          ? (
              Number(item.subtotal) / (Number(item.quantitySoldBoxes) || 1)
            ).toFixed(2)
          : (
              Number(item.subtotal) / (Number(item.quantitySoldUnits) || 1)
            ).toFixed(2);

      const row = sheet.addRow({
        codigo: item.productSku || "",
        articulo: item.productName || "",
        present: item.saleMode === "cajas" ? "CJ" : "UND",
        cantidad:
          item.saleMode === "cajas"
            ? item.quantitySoldBoxes
            : item.quantitySoldUnits,
        precio: Number(price),
        importe: itemTotal,
      });
      row.getCell("precio").numFmt = "S/ #,##0.00";
      row.getCell("importe").numFmt = "S/ #,##0.00";
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    const subTotalRow = sheet.addRow({
      articulo: "SubTotal",
      importe: saleSubtotal,
    });
    subTotalRow.font = { bold: true };
    subTotalRow.getCell("importe").numFmt = "S/ #,##0.00";
    subTotalRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
    overallTotal += saleSubtotal;
    const separatorRow = sheet.addRow({});
    separatorRow.eachCell((cell) => {
      cell.border = {
        bottom: { style: "medium" },
      };
    });
  });

  const totalRow = sheet.addRow({ articulo: "TOTAL", importe: overallTotal });
  totalRow.font = { bold: true };
  totalRow.getCell("importe").numFmt = "S/ #,##0.00";
  totalRow.eachCell((cell) => {
    cell.border = {
      top: { style: "thick" },
      left: { style: "thin" },
      bottom: { style: "thick" },
      right: { style: "thin" },
    };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer]),
    `REPORTE_VENTAS_${formatDateForFile(reportDate)}.xlsx`,
  );
};

const exportSalesToPdf = async (sales, reportDate, branchName) => {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("REPORTE DE VENTAS DETALLADO", 14, 18);
  doc.setFontSize(10);
  doc.text(
    `Sucursal: ${branchName || "N/A"}    Fecha: ${formatDateString(reportDate)}`,
    14,
    26,
  );

  const headers = [
    "Fecha",
    "Venta",
    "Cliente",
    "Pago",
    "Código",
    "Artículo",
    "Present.",
    "Cantidad",
    "Precio",
    "Importe",
  ];

  const rows = [];
  let overallTotal = 0;

  sales.forEach((sale) => {
    const saleDate = sale.date?.toDate ? sale.date.toDate() : sale.date;
    const paymentLabel =
      PAYMENT_METHODS.find((m) => m.key === sale.paymentMethod)?.label || "";
    rows.push([
      formatDateString(saleDate),
      sale.id,
      sale.userName || sale.user || "N/A",
      paymentLabel,
      "",
      "",
      "",
      "",
      "",
      "",
    ]);

    let saleSubtotal = 0;
    (sale.items || []).forEach((item) => {
      const itemTotal = Number(item.subtotal) || 0;
      saleSubtotal += itemTotal;
      const unitPrice =
        item.saleMode === "cajas"
          ? Number(item.subtotal) / (Number(item.quantitySoldBoxes) || 1)
          : Number(item.subtotal) / (Number(item.quantitySoldUnits) || 1);

      rows.push([
        "",
        "",
        "",
        "",
        item.productSku || "",
        item.productName || "",
        item.saleMode === "cajas" ? "CJ" : "UND",
        item.saleMode === "cajas"
          ? item.quantitySoldBoxes
          : item.quantitySoldUnits,
        `S/ ${unitPrice.toFixed(2)}`,
        `S/ ${itemTotal.toFixed(2)}`,
      ]);
    });

    rows.push([
      "",
      "",
      "",
      "",
      "",
      "SubTotal",
      "",
      "",
      "",
      `S/ ${saleSubtotal.toFixed(2)}`,
    ]);
    rows.push(["", "", "", "", "", "", "", "", "", ""]);
    rows.push(["", "", "", "", "", "", "", "", "", ""]); // Extra space for line
    overallTotal += saleSubtotal;
  });

  rows.push([
    "",
    "",
    "",
    "",
    "",
    "TOTAL",
    "",
    "",
    "",
    `S/ ${overallTotal.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: 35,
    head: [headers],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [33, 37, 41], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    didParseCell: (data) => {
      const row = data.row.raw;
      const cell = data.cell;
      if (row[1] && !row[3]) {
        cell.styles.fillColor = [225, 225, 225];
        cell.styles.fontStyle = "bold";
      }
      if (row[4] === "SubTotal" || row[4] === "TOTAL") {
        cell.styles.fontStyle = "bold";
      }
      // Add bottom border for empty rows (separators)
      if (row.every((cell) => cell === "")) {
        cell.styles.lineWidth = { bottom: 0.5 };
        cell.styles.lineColor = [0, 0, 0];
      }
    },
  });

  doc.save(`REPORTE_VENTAS_${formatDateForFile(reportDate)}.pdf`);
};

/* ─── Sales List (History) ─── */
const SalesList = ({ onNewSale }) => {
  const { currentBranch, userRole, currentUser, userProfile } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState(null);
  const [isUpdatingSale, setIsUpdatingSale] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [saleToPay, setSaleToPay] = useState(null);

  const [dateFilter, setDateFilter] = useState("today"); // 'today', 'week', 'month', 'custom'
  const [paymentFilter, setPaymentFilter] = useState("all"); // 'all', 'cash', 'transfer', 'yape', 'pos'
  const [employeeFilter, setEmployeeFilter] = useState("all"); // 'all' or userId
  const [customStartDate, setCustomStartDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [customEndDate, setCustomEndDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  const getTodayRange = () => {
    const start = new Date();
    const end = new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const fetchDeliveredSalesForToday = async () => {
    if (!currentBranch) return [];
    const { start, end } = getTodayRange();
    const q = query(
      collection(db, "sales"),
      where("branchId", "==", currentBranch.id),
      where("date", ">=", start),
      where("date", "<=", end),
      orderBy("date", "desc"),
    );
    const snap = await getDocs(q);
    const allSales = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return allSales.filter((s) => {
      if (s.status !== "delivered") return false;
      if (s.deliveredAt && s.deliveredAt.toDate) {
        const deliveredDate = s.deliveredAt.toDate();
        return deliveredDate >= start && deliveredDate <= end;
      }
      return true;
    });
  };

  const handleGenerateReport = async (format) => {
    setIsGeneratingReport(true);
    try {
      const allSalesToExport = await fetchDeliveredSalesForToday();
      const isPrivileged = userRole === "admin" || userRole === "gerente";
      const currentUserId = currentUser?.uid;
      const currentUserEmail = currentUser?.email;
      const currentUserName = userProfile?.name;
      const salesToExport = isPrivileged
        ? allSalesToExport
        : allSalesToExport.filter((sale) => {
            if (sale.userId && currentUserId)
              return sale.userId === currentUserId;
            if (sale.user && currentUserEmail)
              return sale.user === currentUserEmail;
            if (sale.userName && currentUserName)
              return sale.userName === currentUserName;
            return false;
          });
      if (!salesToExport.length) {
        toast("No hay ventas entregadas para el día de hoy.");
        setReportModalOpen(false);
        return;
      }
      const reportDate = getTodayRange().start;
      if (format === "excel") {
        await exportSalesToExcel(
          salesToExport,
          reportDate,
          currentBranch?.name,
        );
      } else {
        await exportSalesToPdf(salesToExport, reportDate, currentBranch?.name);
      }
      toast.success("Reporte generado correctamente.");
      setReportModalOpen(false);
    } catch (err) {
      console.error("Error generando reporte:", err);
      toast.error("Error al generar el reporte.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleMarkPaid = async (sale, paymentMethod) => {
    if (!sale || sale.status !== "pending_payment") {
      toast.error(
        "Solo se puede marcar como pagado cuando está en estado pendiente de pago.",
      );
      return;
    }
    if (!paymentMethod) {
      toast.error("Seleccione un método de pago antes de continuar.");
      return;
    }
    setIsUpdatingSale(true);
    try {
      await updateDoc(doc(db, "sales", sale.id), {
        status: "pending_delivery",
        paidAt: new Date(),
        paymentMethod,
      });
      toast.success("Venta marcada como pagada.");
    } catch (err) {
      console.error("Error marcando venta como pagada:", err);
      toast.error("No se pudo actualizar el estado.");
    } finally {
      setIsUpdatingSale(false);
    }
  };

  const handleDeliverSale = async (sale, deliveryLocation) => {
    if (!sale || sale.status !== "pending_delivery") {
      toast.error(
        "Solo se pueden entregar ventas en estado pendiente de entrega.",
      );
      return;
    }
    if (!deliveryLocation || !deliveryLocation.trim()) {
      toast.error("Debe indicar una ubicación o croquis para entregar.");
      return;
    }

    setIsUpdatingSale(true);
    try {
      const batch = writeBatch(db);
      const saleRef = doc(db, "sales", sale.id);
      batch.update(saleRef, {
        status: "delivered",
        deliveryLocation,
        deliveredAt: new Date(),
      });

      for (const item of sale.items || []) {
        const productRef = doc(db, "products", item.productId);
        const productSnap = await getDoc(productRef);
        if (!productSnap.exists()) continue;

        const product = productSnap.data();
        const previousStock = Number(product.currentStock) || 0;
        const newStock = Math.max(
          0,
          previousStock - (Number(item.quantitySoldBoxes) || 0),
        );
        const newStatus =
          newStock > 20
            ? "Disponible"
            : newStock > 0
              ? "Stock Bajo"
              : "Agotado";

        batch.update(productRef, { currentStock: newStock, status: newStatus });

        const txRef = doc(collection(db, "transactions"));
        batch.set(txRef, {
          saleId: sale.id,
          productId: item.productId,
          productName: item.productName,
          productImage: item.productImage || null,
          type: "SALE",
          saleMode: item.saleMode,
          quantityBoxes: item.quantitySoldBoxes,
          quantityUnits: item.quantitySoldUnits,
          subtotal: item.subtotal,
          previousStock,
          newStock,
          userEmail: sale.user || "Unknown",
          userName: sale.userName || sale.user || "Unknown",
          branchId: sale.branchId,
          date: new Date(),
          deliveryLocation,
        });
      }

      await batch.commit();
      toast.success("Venta marcada como entregada y stock descontado.");
    } catch (err) {
      console.error("Error entregando venta:", err);
      toast.error("No se pudo entregar la venta. Intente nuevamente.");
    } finally {
      setIsUpdatingSale(false);
    }
  };

  const handleOpenPaymentModal = (sale) => {
    setSaleToPay(sale);
    setPaymentModalOpen(true);
  };

  const handleSelectPayment = async (paymentMethod) => {
    if (!saleToPay) return;
    await handleMarkPaid(saleToPay, paymentMethod);
    setPaymentModalOpen(false);
    setSaleToPay(null);
  };

  useEffect(() => {
    if (!currentBranch) return;
    setLoading(true);

    let start = new Date();
    let end = new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (dateFilter === "today") {
      // already set
    } else if (dateFilter === "week") {
      const day = start.getDay() || 7;
      start.setDate(start.getDate() - (day - 1));
    } else if (dateFilter === "month") {
      start.setDate(1);
    } else if (dateFilter === "custom") {
      const partsS = customStartDate.split("-");
      start = new Date(partsS[0], partsS[1] - 1, partsS[2], 0, 0, 0, 0);

      const partsE = customEndDate.split("-");
      end = new Date(partsE[0], partsE[1] - 1, partsE[2], 23, 59, 59, 999);
    }

    const q = query(
      collection(db, "sales"),
      where("branchId", "==", currentBranch.id),
      where("date", ">=", start),
      where("date", "<=", end),
      orderBy("date", "desc"),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = [];
        snap.forEach((d) => data.push({ id: d.id, ...d.data() }));

        // Filter for employees: only show their own ventas
        const isPrivileged = userRole === "admin" || userRole === "gerente";
        const currentUserId = currentUser?.uid;
        const currentUserEmail = currentUser?.email;
        const currentUserName = userProfile?.name;

        const filtered = (
          isPrivileged
            ? data
            : data.filter((sale) => {
                if (sale.userId && currentUserId)
                  return sale.userId === currentUserId;
                if (sale.user && currentUserEmail)
                  return sale.user === currentUserEmail;
                if (sale.userName && currentUserName)
                  return sale.userName === currentUserName;
                return false;
              })
        )
          .filter((sale) => {
            if (paymentFilter === "all") return true;
            return sale.paymentMethod === paymentFilter;
          })
          .filter((sale) => {
            if (employeeFilter === "all") return true;
            return (
              sale.userId === employeeFilter ||
              sale.user === employeeFilter ||
              sale.userName === employeeFilter
            );
          });

        setSales(filtered);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching sales:", error);
        if (error.code === "failed-precondition") {
          toast.error(
            "Es necesario crear un índice en Firestore para esta combinación de filtros.",
            { duration: 5000 },
          );
        } else {
          toast.error("Error al cargar ventas. Verifique los filtros.");
        }
        setLoading(false);
      },
    );
    return () => unsub();
  }, [
    currentBranch,
    dateFilter,
    customStartDate,
    customEndDate,
    currentUser,
    userProfile,
    userRole,
    paymentFilter,
    employeeFilter,
  ]);

  const kpis = useMemo(() => {
    let totalVal = 0;
    let totalItems = 0;
    const paymentTotals = {};
    PAYMENT_METHODS.forEach((method) => {
      paymentTotals[method.key] = 0;
    });
    sales.forEach((s) => {
      totalVal += Number(s.totalValue) || 0;
      s.items?.forEach((i) => {
        totalItems +=
          (Number(i.quantitySoldBoxes) || 0) +
          (Number(i.quantitySoldUnits) || 0);
      });
      const method = s.paymentMethod || "cash";
      if (paymentTotals[method] !== undefined) {
        paymentTotals[method] += Number(s.totalValue) || 0;
      }
    });
    return { totalVal, totalCount: sales.length, totalItems, paymentTotals };
  }, [sales]);

  const getPaymentMethodInfo = (key) =>
    PAYMENT_METHODS.find((m) => m.key === key);

  const employees = useMemo(() => {
    const unique = new Map();
    sales.forEach((sale) => {
      const key = sale.userId || sale.user || sale.userName;
      const name = sale.userName || sale.user || "Desconocido";
      if (!unique.has(key)) {
        unique.set(key, { id: key, name });
      }
    });
    return Array.from(unique.values());
  }, [sales]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-10 py-6">
        <div className="max-w-screen-xl mx-auto flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Reporte de Ventas
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Resumen y métricas clave
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(userRole === "admin" || userRole === "gerente") && (
                <button
                  onClick={() => setReportModalOpen(true)}
                  className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined">article</span>
                  Generar reporte de venta diaria
                </button>
              )}
              <button
                onClick={onNewSale}
                className="px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined">add</span>
                Nueva Venta
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "today", label: "Hoy" },
              { id: "week", label: "Esta Semana" },
              { id: "month", label: "Este Mes" },
              { id: "custom", label: "Personalizado" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dateFilter === f.id ? "bg-slate-900 dark:bg-slate-700 text-white shadow-md" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750"}`}
              >
                {f.label}
              </button>
            ))}

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="h-11 ml-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 text-sm text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            >
              <option value="all">Todos los pagos</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>

            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 text-sm text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            >
              <option value="all">Todos los empleados</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>

            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-5 border border-emerald-100 dark:border-emerald-900/30">
              <p className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
                Transacciones
              </p>
              <p className="text-3xl font-black text-emerald-900 dark:text-emerald-200">
                {kpis.totalCount}
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-5 border border-amber-100 dark:border-amber-900/30">
              <p className="text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
                Items Vendidos
              </p>
              <p className="text-3xl font-black text-amber-900 dark:text-amber-200">
                {kpis.totalItems}
              </p>
            </div>
          </div>

          {/* Payment Summary KPIs */}
          <div className="flex flex-wrap gap-4 mt-4">
            {PAYMENT_METHODS.map((method) => (
              <div
                key={method.key}
                className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-900/30 flex items-center gap-3"
              >
                <img src={method.icon} alt={method.label} className="w-8 h-8" />
                <div>
                  <p className="text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
                    {method.label}
                  </p>
                  <p className="text-xl font-black text-blue-900 dark:text-blue-200">
                    S/ {kpis.paymentTotals[method.key]?.toFixed(2) || "0.00"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="max-w-screen-xl mx-auto">
          {loading ? (
            <div className="flex justify-center py-20">
              <span className="material-symbols-outlined animate-spin text-4xl text-primary">
                progress_activity
              </span>
            </div>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-3xl border border-slate-200 shadow-sm p-10">
              <span className="material-symbols-outlined text-6xl mb-4 bg-slate-100 p-4 rounded-full">
                event_busy
              </span>
              <p className="font-bold text-lg text-slate-700">
                No hay ventas en este periodo
              </p>
              <p className="text-sm mt-1">
                Intenta cambiar el filtro de fechas
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">
                        Fecha
                      </th>
                      <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">
                        Vendedor
                      </th>
                      <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">
                        Estado
                      </th>
                      <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">
                        Pago
                      </th>
                      <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs text-center">
                        Items
                      </th>
                      <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs text-right">
                        Total
                      </th>
                      <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs text-center">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sales.map((sale) => (
                      <tr
                        key={sale.id}
                        className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                        onClick={() => setSelectedSale(sale)}
                      >
                        <td className="px-6 py-4 font-medium text-slate-700 whitespace-nowrap">
                          {sale.date?.toDate
                            ? sale.date.toDate().toLocaleDateString() +
                              " " +
                              sale.date.toDate().toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Fecha inválida"}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {sale.userName || sale.user}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${sale.status === "pending_payment" ? "bg-amber-100 text-amber-700" : sale.status === "pending_delivery" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}
                          >
                            {sale.status === "pending_payment"
                              ? "Pendiente pago"
                              : sale.status === "pending_delivery"
                                ? "Pendiente entrega"
                                : "Entregado"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {(() => {
                            const pm = getPaymentMethodInfo(sale.paymentMethod);
                            if (!pm)
                              return (
                                <span className="text-xs text-slate-400">
                                  -
                                </span>
                              );
                            return (
                              <div className="flex items-center justify-center gap-1">
                                <img
                                  src={pm.icon}
                                  alt={pm.label}
                                  className="w-5 h-5"
                                />
                                <span className="text-xs font-bold text-slate-600">
                                  {pm.label}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                            {sale.items?.length || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-900">
                          S/ {Number(sale.totalValue).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSale(sale);
                            }}
                            className="size-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-primary transition-all"
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              visibility
                            </span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
      <SaleDetailModal
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
        onMarkPaid={handleMarkPaid}
        onDeliver={handleDeliverSale}
        isUpdating={isUpdatingSale}
        userRole={userRole}
        onOpenPaymentModal={handleOpenPaymentModal}
      />
      {(userRole === "admin" || userRole === "gerente") && (
        <ReportModal
          open={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          onGenerate={handleGenerateReport}
          isGenerating={isGeneratingReport}
        />
      )}
      <PaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSelectPayment={handleSelectPayment}
        sale={saleToPay}
        isUpdating={isUpdatingSale}
      />
    </div>
  );
};

/* ─── Main Component ─── */
const Sales = () => {
  const [view, setView] = useState("list"); // 'list' | 'pos'

  return (
    <AppLayout>
      {view === "pos" ? (
        <POSView onBack={() => setView("list")} />
      ) : (
        <SalesList onNewSale={() => setView("pos")} />
      )}
    </AppLayout>
  );
};

export default Sales;
