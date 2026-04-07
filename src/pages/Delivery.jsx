import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  orderBy,
  getDoc,
  runTransaction,
  writeBatch,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import React, { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "react-hot-toast";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import AppLayout from "../components/layout/AppLayout";
import LayoutPreview from "../components/inventory/LayoutPreview";

const PAYMENT_METHODS = [
  {
    id: "Efectivo",
    label: "Efectivo",
    icon: "/img/iconos/efectivo.png",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    id: "Tarjeta",
    label: "Tarjeta / POS",
    icon: "/img/iconos/pos.png",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    id: "Transferencia",
    label: "Transferencia",
    icon: "/img/iconos/transferencia.png",
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
  },
  {
    id: "Yape/Plin",
    label: "Yape / Plin",
    icon: "/img/iconos/yape.png",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
];

const formatBoxUnitAmount = (units, upb) => {
  const boxes = Math.floor(units / upb);
  const remainder = units % upb;
  if (boxes > 0 && remainder > 0) return `${boxes} cjs + ${remainder} und`;
  if (boxes > 0) return `${boxes} cjs`;
  return `${remainder} und`;
};

const getSuggestedPicking = (item, product) => {
  if (!product || !product.locations) return {};
  const upb = Number(product.unitsPerBox || 1);
  const requiredUnits =
    item.saleMode === "cajas"
      ? Number(item.quantitySoldBoxes || 0) * upb
      : Number(item.quantitySoldUnits || 0);

  const availableLocations = Object.entries(product.locations)
    .map(([key, stock]) => ({ key, stock: Number(stock || 0) }))
    .filter((loc) => loc.stock > 0)
    .sort((a, b) => a.stock - b.stock);

  let remaining = requiredUnits;
  const suggestion = {};

  for (const loc of availableLocations) {
    if (remaining <= 0) break;
    const take = Math.min(loc.stock, remaining);
    if (take > 0) {
      suggestion[loc.key] = take;
      remaining -= take;
    }
  }

  return suggestion;
};

/* --- Item Picking Component --- */
const ItemPickingSelector = ({
  item,
  itemIndex,
  productData,
  pickingData,
  onUpdatePicking,
  branchLayouts,
}) => {
  const upb = Number(productData?.unitsPerBox || 1);
  const totalRequiredUnits =
    item.saleMode === "cajas"
      ? Number(item.quantitySoldBoxes || 0) * upb
      : Number(item.quantitySoldUnits || 0);
  const totalRequiredLabel = formatBoxUnitAmount(totalRequiredUnits, upb);
  const suggestedPicking = useMemo(
    () => getSuggestedPicking(item, productData),
    [item, productData],
  );

  useEffect(() => {
    const hasExisting = Object.keys(pickingData[itemIndex] || {}).length > 0;
    if (hasExisting) return;
    if (Object.keys(suggestedPicking).length > 0) {
      onUpdatePicking(itemIndex, suggestedPicking);
    }
  }, [itemIndex, pickingData, onUpdatePicking, suggestedPicking]);

  const locationsByLayout = useMemo(() => {
    if (!productData?.locations) return {};

    const layoutNames = (branchLayouts || []).reduce((acc, l) => {
      if (l?.id) acc[l.id] = l.name || l.id;
      return acc;
    }, {});

    const locations = Object.entries(productData.locations)
      .filter(([_, stock]) => stock > 0)
      .map(([key, stock]) => {
        const parts = key.split("__");
        const layoutId = parts.length > 1 ? parts[0] : "main";
        const locationName = parts.length > 1 ? parts.slice(1).join("__") : key;
        return {
          key,
          stock,
          layoutId,
          layoutName:
            layoutNames[layoutId] ||
            (layoutId === "main" ? "Principal" : layoutId),
          name: locationName,
        };
      });

    return locations.reduce((acc, loc) => {
      if (!acc[loc.layoutId])
        acc[loc.layoutId] = { layoutName: loc.layoutName, items: [] };
      acc[loc.layoutId].items.push(loc);
      return acc;
    }, {});
  }, [productData, branchLayouts]);

  const totalRequired = totalRequiredUnits;
  const currentPicked = Object.values(pickingData[itemIndex] || {}).reduce(
    (a, b) => a + b,
    0,
  );
  const isComplete = currentPicked === totalRequired;

  const handleQtyChange = (locKey, val, maxStock) => {
    const newPicking = { ...(pickingData[itemIndex] || {}) };
    const otherPicked = currentPicked - (newPicking[locKey] || 0);
    const remainingNeeded = totalRequired - otherPicked;

    let finalVal = Math.max(0, parseInt(val) || 0);
    finalVal = Math.min(finalVal, maxStock);
    finalVal = Math.min(finalVal, remainingNeeded);

    if (finalVal === 0) {
      delete newPicking[locKey];
    } else {
      newPicking[locKey] = finalVal;
    }
    onUpdatePicking(itemIndex, newPicking);
  };

  const formatLocationName = (locationName) => {
    if (!locationName) return "Ubicación desconocida";

    const fullMatch = locationName.match(/^(\d+)-(\d+)-(\d+)-([A-Za-z])$/);
    if (fullMatch) {
      const shelf = Number(fullMatch[1]) + 1;
      const row = Number(fullMatch[2]) + 1;
      const level = Number(fullMatch[3]) + 1;
      const col = fullMatch[4].toUpperCase();
      return `Estante ${shelf} - ${shelf}${col}${row}(N${level})`;
    }

    const shortMatch = locationName.match(/^(\d+)-(\d+)-([A-Za-z])$/);
    if (shortMatch) {
      const shelf = Number(shortMatch[1]) + 1;
      const row = Number(shortMatch[2]) + 1;
      const col = shortMatch[3].toUpperCase();
      return `Estante ${shelf} - ${shelf}${col}${row}`;
    }

    return locationName;
  };

  const hasLocations = Object.keys(locationsByLayout).length > 0;
  const suggestedLayoutName = hasLocations
    ? locationsByLayout[Object.keys(locationsByLayout)[0]]?.layoutName
    : "No definida";

  return (
    <div className="space-y-4">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
        (Ubicaciones detectadas por piso / croquis)
      </div>
      <div className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/70 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
        Ubicación sugerida: {suggestedLayoutName}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Seleccionar Ubicaciones
        </p>
        <div
          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${isComplete ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}
        >
          <span className="material-symbols-outlined text-sm">
            {isComplete ? "check" : "pending"}
          </span>
          {currentPicked} / {totalRequired} und{" "}
          {totalRequiredLabel ? `(${totalRequiredLabel})` : ""}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {!hasLocations ? (
          <p className="text-[10px] text-rose-500 font-bold uppercase py-2">
            Sin stock disponible en ubicaciones
          </p>
        ) : (
          Object.entries(locationsByLayout).map(([layoutId, group]) => (
            <div
              key={layoutId}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3"
            >
              <div className="pb-2 border-b border-slate-100 dark:border-slate-800 mb-2 text-[10px] font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Piso/Croquis: {group.layoutName}
              </div>
              <div className="space-y-2">
                {group.items.map((loc) => {
                  const picked = pickingData[itemIndex]?.[loc.key] || 0;
                  return (
                    <div
                      key={loc.key}
                      className={`flex flex-col gap-3 p-3 rounded-2xl border transition-all ${picked > 0 ? "bg-primary/5 border-primary/30" : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800"}`}
                    >
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase truncate">
                          {formatLocationName(loc.name)}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">
                          Disponible: {formatBoxUnitAmount(loc.stock, upb)} (
                          {loc.stock} und)
                        </p>
                        {suggestedPicking[loc.key] > 0 && (
                          <p className="text-[9px] text-slate-500 uppercase tracking-wide">
                            Sugerido:{" "}
                            {formatBoxUnitAmount(
                              suggestedPicking[loc.key],
                              upb,
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-1">
                        <button
                          onClick={() =>
                            handleQtyChange(loc.key, picked - 1, loc.stock)
                          }
                          className="size-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-primary transition-colors flex items-center justify-center"
                        >
                          <span className="material-symbols-outlined text-lg">
                            remove
                          </span>
                        </button>
                        <input
                          type="number"
                          value={picked || ""}
                          onChange={(e) =>
                            handleQtyChange(loc.key, e.target.value, loc.stock)
                          }
                          placeholder="0"
                          min="0"
                          max={loc.stock}
                          className="w-12 text-center text-xs font-black bg-transparent outline-none text-slate-900 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          onClick={() =>
                            handleQtyChange(loc.key, picked + 1, loc.stock)
                          }
                          className="size-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-primary transition-colors flex items-center justify-center"
                        >
                          <span className="material-symbols-outlined text-lg">
                            add
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

/* --- Helper: Draggable Container --- */
const DraggableContainer = ({ children }) => {
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const onMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setStartY(e.pageY - containerRef.current.offsetTop);
    setScrollLeft(containerRef.current.scrollLeft);
    setScrollTop(containerRef.current.scrollTop);
  };

  const onMouseUp = () => setIsDragging(false);
  const onMouseLeave = () => setIsDragging(false);

  const onMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const y = e.pageY - containerRef.current.offsetTop;
    const walkX = (x - startX) * 2;
    const walkY = (y - startY) * 2;
    containerRef.current.scrollLeft = scrollLeft - walkX;
    containerRef.current.scrollTop = scrollTop - walkY;
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
      className={`w-full h-full overflow-auto cursor-${isDragging ? "grabbing" : "grab"} selection-none select-none scrollbar-hide`}
      style={{ scrollBehavior: "auto" }}
    >
      <div className="min-w-fit min-h-fit p-20">{children}</div>
    </div>
  );
};

/* --- Delivery Detail Content --- */
const DeliveryDetailContent = ({
  sale,
  onRequestComplete,
  setViewingLayoutItem,
  isUpdating,
  productsData,
  pickingData,
  onUpdatePicking,
  branchLayouts,
}) => {
  const isAllPicked = useMemo(() => {
    return sale.items?.every((item, idx) => {
      const product = productsData[item.productId];
      const upb = Number(product?.unitsPerBox || 1);
      const required =
        item.saleMode === "cajas"
          ? Number(item.quantitySoldBoxes || 0) * upb
          : Number(item.quantitySoldUnits || 0);
      const picked = Object.values(pickingData[idx] || {}).reduce(
        (a, b) => a + b,
        0,
      );
      return picked === required;
    });
  }, [sale, pickingData, productsData]);

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Guía de Recolección y Picking
          </h4>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {sale.items?.length || 0} items
          </span>
        </div>
        <div className="grid grid-cols-1 gap-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {sale.items?.map((item, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 space-y-6 relative overflow-hidden group/item"
            >
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="font-black text-slate-900 dark:text-white uppercase text-lg leading-tight mb-1">
                        {item.productName}
                      </p>
                      <p className="text-[10px] font-black text-primary tracking-widest">
                        #{item.sku || item.productId?.substring(0, 8)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingLayoutItem(item);
                      }}
                      className="shrink-0 flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-all shadow-lg shadow-slate-900/10"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        map
                      </span>
                      Ver Mapa
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-6">
                    <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-widest">
                      {item.saleMode === "cajas"
                        ? `Pedido: ${item.quantitySoldBoxes} CAJAS (${Number(productsData[item.productId]?.unitsPerBox || 1) * Number(item.quantitySoldBoxes || 0)} UNIDADES)`
                        : `Pedido: ${item.quantitySoldUnits} UNIDADES`}
                    </span>
                  </div>

                  <ItemPickingSelector
                    item={item}
                    itemIndex={idx}
                    productData={productsData[item.productId]}
                    pickingData={pickingData}
                    onUpdatePicking={onUpdatePicking}
                    branchLayouts={branchLayouts}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:w-[350px] space-y-6">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-8 relative overflow-hidden group/card">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>

          <div className="relative space-y-6">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">
                  local_shipping
                </span>
              </div>
              <div>
                <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest">
                  Resumen de Despacho
                </h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  Completa el picking para continuar
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-60">
                  Vendedor
                </p>
                <p className="font-black text-slate-900 dark:text-white text-sm">
                  {sale.userName || sale.sellerName || "Desconocido"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-60">
                  Estado de Picking
                </p>
                <p
                  className={`font-black uppercase text-xs ${isAllPicked ? "text-emerald-600" : "text-amber-600"}`}
                >
                  {isAllPicked
                    ? "Picking Completado"
                    : "Pendiente de Selección"}
                </p>
              </div>
            </div>

            <button
              onClick={() => onRequestComplete(pickingData)}
              disabled={isUpdating || !isAllPicked}
              className={`w-full py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 group/btn ${isAllPicked ? "bg-emerald-600 text-white hover:brightness-110 hover:shadow-2xl hover:shadow-emerald-500/40" : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"}`}
            >
              {isUpdating ? (
                <span className="material-symbols-outlined animate-spin text-xl">
                  progress_activity
                </span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl group-hover/btn:scale-110 transition-transform">
                    task_alt
                  </span>
                  Confirmar y Salir
                </>
              )}
            </button>
          </div>
        </div>

        <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">info</span>
            Nota Crítica
          </p>
          <p className="text-[11px] text-primary/80 font-bold leading-relaxed uppercase tracking-widest">
            Al confirmar, se descontará automáticamente el stock de las
            ubicaciones seleccionadas. Esta acción no se puede deshacer.
          </p>
        </div>
      </div>
    </div>
  );
};

/* --- Delivery View --- */
const Delivery = () => {
  const { currentBranch } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [branchLayouts, setBranchLayouts] = useState([]);
  const [selectedLayoutForMap, setSelectedLayoutForMap] = useState(null);
  const [viewingLayoutItem, setViewingLayoutItem] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [productsData, setProductsData] = useState({});
  const [pickingData, setPickingData] = useState({}); // { itemIndex: { locKey: qty } }
  const [confirmDeliveryOpen, setConfirmDeliveryOpen] = useState(false);
  const [pendingPickingData, setPendingPickingData] = useState(null);

  // Fetch product data for expanded sale
  useEffect(() => {
    if (!expandedSaleId) {
      setProductsData({});
      setPickingData({});
      return;
    }

    const sale = sales.find((s) => s.id === expandedSaleId);
    if (!sale?.items) return;

    const fetchProductsOfSale = async () => {
      const data = {};
      const productIds = [...new Set(sale.items.map((item) => item.productId))];

      for (const pid of productIds) {
        try {
          const pDoc = await getDoc(doc(db, "products", pid));
          if (pDoc.exists()) {
            data[pid] = { id: pDoc.id, ...pDoc.data() };
          }
        } catch (error) {
          console.error(`Error fetching product ${pid}:`, error);
        }
      }
      setProductsData(data);
    };

    fetchProductsOfSale();
  }, [expandedSaleId, sales]);

  const onUpdatePicking = (itemIndex, picking) => {
    setPickingData((prev) => ({
      ...prev,
      [itemIndex]: picking,
    }));
  };

  // Fetch branch layouts for croquis
  useEffect(() => {
    if (!currentBranch) return;
    const branchDocRef = doc(db, "branches", currentBranch.id);
    const unsub = onSnapshot(branchDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        let loadedLayouts = [];
        if (data.layouts && Array.isArray(data.layouts)) {
          loadedLayouts = data.layouts;
        } else if (data.layout) {
          loadedLayouts = [{ id: "main", name: "Principal", ...data.layout }];
        }
        setBranchLayouts(loadedLayouts);
      }
    });
    return () => unsub();
  }, [currentBranch]);

  // Auto-select layout when opening item map (muestre segundo piso, primer piso, etc.)
  useEffect(() => {
    if (!viewingLayoutItem || branchLayouts.length === 0) return;

    const matchedLayout = branchLayouts.find((l) =>
      Object.keys(viewingLayoutItem.locations || {}).some((k) =>
        k.startsWith(`${l.id}__`),
      ),
    );

    setSelectedLayoutForMap(matchedLayout?.id || branchLayouts[0]?.id || null);
  }, [viewingLayoutItem, branchLayouts]);

  // Fetch pending delivery sales
  useEffect(() => {
    if (!currentBranch) return;
    setLoading(true);

    const q = query(
      collection(db, "sales"),
      where("branchId", "==", currentBranch.id),
      where("status", "==", "pending_delivery"),
      orderBy("date", "desc"),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = [];
        snap.forEach((d) => data.push({ id: d.id, ...d.data() }));
        setSales(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching delivery queue:", error);
        toast.error("Error al cargar cola de despacho.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, [currentBranch]);

  const handleCompleteDelivery = async (finalPickingData) => {
    setIsUpdating(true);
    try {
      const sale = sales.find((s) => s.id === expandedSaleId);
      if (!sale) throw new Error("Venta no encontrada");

      // Transactional stock update
      await runTransaction(db, async (transaction) => {
        // 1. Read all product docs first (Firestore requiere reads previas a writes)
        const productRefs = sale.items.map((item) =>
          doc(db, "products", item.productId),
        );
        const productSnaps = await Promise.all(
          productRefs.map((ref) => transaction.get(ref)),
        );

        productSnaps.forEach((productSnap, idx) => {
          if (!productSnap.exists()) {
            const item = sale.items[idx];
            throw new Error(`Producto ${item.productName} no existe`);
          }
        });

        // 2. Apply writes (updates y movements)
        for (const [idx, item] of sale.items.entries()) {
          const productRef = productRefs[idx];
          const productSnap = productSnaps[idx];
          const currentPData = productSnap.data();
          const itemPicking = finalPickingData[idx] || {};

          const newLocations = { ...(currentPData.locations || {}) };
          const upb = Number(currentPData.unitsPerBox) || 1;
          let totalDeductionUnits = 0;

          Object.entries(itemPicking).forEach(([locKey, qty]) => {
            newLocations[locKey] = (newLocations[locKey] || 0) - qty;
            if (newLocations[locKey] < 0)
              throw new Error(
                `Stock insuficiente en ${locKey} para ${item.productName}`,
              );
            totalDeductionUnits += qty;
          });

          const totalUnitsRemaining = Object.values(newLocations).reduce(
            (sum, value) => sum + Number(value || 0),
            0,
          );
          const newStock = Math.floor(totalUnitsRemaining / upb);
          const newRemainderUnits = totalUnitsRemaining % upb;

          transaction.update(productRef, {
            locations: newLocations,
            currentStock: newStock,
            remainderUnits: newRemainderUnits,
            updatedAt: serverTimestamp(),
          });

          const movementRef = doc(collection(db, "movements"));
          transaction.set(movementRef, {
            productId: item.productId,
            productName: item.productName,
            type: "salida",
            quantityBoxes: Math.floor(totalDeductionUnits / upb),
            quantityUnits: totalDeductionUnits,
            reason: `Venta #${sale.ticketNumber}`,
            branchId: currentBranch.id,
            date: serverTimestamp(),
            userName: sale.userName || "Sistema",
            pickingDetails: itemPicking,
          });
        }

        // 3. Update sale status
        transaction.update(doc(db, "sales", sale.id), {
          status: "completed",
          deliveredAt: serverTimestamp(),
          pickingDetails: finalPickingData,
        });
      });

      toast.success("Venta despachada y stock actualizado correctamente.");
      setExpandedSaleId(null);
    } catch (error) {
      console.error("Error completing delivery:", error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const requestDeliveryConfirmation = (finalPickingData) => {
    setPendingPickingData(finalPickingData);
    setConfirmDeliveryOpen(true);
  };

  const cancelDeliveryConfirmation = () => {
    setConfirmDeliveryOpen(false);
    setPendingPickingData(null);
  };

  const confirmDelivery = async () => {
    setConfirmDeliveryOpen(false);
    if (!pendingPickingData) return;
    await handleCompleteDelivery(pendingPickingData);
    setPendingPickingData(null);
  };

  const filteredSales = useMemo(() => {
    return sales.filter((s) =>
      s.ticketNumber?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [sales, searchTerm]);

  const toggleExpand = (sale) => {
    setExpandedSaleId(expandedSaleId === sale.id ? null : sale.id);
  };

  if (viewingLayoutItem) {
    const activeLayout =
      branchLayouts.find((l) => l.id === selectedLayoutForMap) ||
      branchLayouts.find((l) =>
        Object.keys(viewingLayoutItem.locations || {}).some((k) =>
          k.startsWith(`${l.id}__`),
        ),
      ) ||
      branchLayouts[0];

    const quantities = {};
    if (activeLayout) {
      Object.entries(viewingLayoutItem.locations || {}).forEach(
        ([key, qty]) => {
          if (key.startsWith(`${activeLayout.id}__`)) {
            quantities[key.replace(`${activeLayout.id}__`, "")] = qty;
          } else if (
            !key.includes("__") &&
            (activeLayout.id === "main" || activeLayout.id === "default")
          ) {
            quantities[key] = qty;
          }
        },
      );
    }

    return (
      <AppLayout>
        <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 animate-in fade-in duration-300">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setViewingLayoutItem(null)}
                className="size-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div>
                <h3 className="font-bold text-white leading-tight">
                  Ubicación: {viewingLayoutItem.productName}
                </h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  MAPA DE ANAQUELES - {activeLayout?.name || "VISTA GENERAL"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex-1 relative overflow-hidden bg-slate-100 dark:bg-slate-950">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap gap-2">
              {branchLayouts.map((layout) => (
                <button
                  key={layout.id}
                  onClick={() => setSelectedLayoutForMap(layout.id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition ${selectedLayoutForMap === layout.id ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                >
                  {layout.name || layout.id}
                </button>
              ))}
            </div>
            {activeLayout ? (
              <DraggableContainer>
                <LayoutPreview
                  layout={activeLayout}
                  quantities={quantities}
                  readOnly={true}
                />
              </DraggableContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-4">
                <span className="material-symbols-outlined text-6xl">map</span>
                <p className="font-bold uppercase tracking-widest text-xs">
                  Croquis no configurado para esta sucursal
                </p>
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-screen-xl mx-auto w-full">
          <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                  Almacén
                </span>
                <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px]">
                    local_shipping
                  </span>
                  {sales.length} Pendientes
                </span>
              </div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
                Cola de Despacho
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 font-medium">
                Gestión de entregas y ubicación de productos
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative group flex-1 md:w-64">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Buscar por Ticket..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                />
              </div>

              <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`size-10 rounded-xl flex items-center justify-center transition-all ${viewMode === "grid" ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-400 hover:text-slate-600"}`}
                >
                  <span className="material-symbols-outlined">grid_view</span>
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`size-10 rounded-xl flex items-center justify-center transition-all ${viewMode === "list" ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
                >
                  <span className="material-symbols-outlined">view_list</span>
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <span className="material-symbols-outlined animate-spin text-4xl text-primary">
                progress_activity
              </span>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 shadow-sm p-10 text-center">
              <span className="material-symbols-outlined text-6xl mb-4 bg-slate-100 dark:bg-slate-800 p-6 rounded-full text-slate-300">
                local_shipping
              </span>
              <p className="font-bold text-lg text-slate-700 dark:text-slate-300">
                No hay tickets coincidentes
              </p>
              <p className="text-sm mt-1">
                Intente con otro número o verifique el estado del almacén
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 content-start">
              {filteredSales.map((sale) => (
                <div
                  key={sale.id}
                  className={`${expandedSaleId === sale.id ? "col-span-full" : ""} h-fit`}
                >
                  <div
                    className={`bg-white dark:bg-slate-900 rounded-[2.5rem] border transition-all group relative overflow-hidden h-full ${expandedSaleId === sale.id ? "border-primary ring-4 ring-primary/5 shadow-2xl p-10 mb-8" : "border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-primary/40 p-8 cursor-pointer"}`}
                    onClick={() =>
                      expandedSaleId !== sale.id && toggleExpand(sale)
                    }
                  >
                    {expandedSaleId === sale.id && (
                      <div className="absolute top-0 left-0 w-2 h-full bg-primary"></div>
                    )}

                    <div
                      className="flex justify-between items-start mb-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(sale);
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`size-16 rounded-[1.25rem] flex items-center justify-center transition-all ${expandedSaleId === sale.id ? "bg-primary text-white shadow-xl shadow-primary/30 scale-110" : "bg-primary/5 text-primary"}`}
                        >
                          {expandedSaleId === sale.id ? (
                            <span className="material-symbols-outlined text-3xl">
                              package_2
                            </span>
                          ) : sale.paymentMethod ? (
                            <img
                              src={
                                PAYMENT_METHODS.find(
                                  (m) => m.id === sale.paymentMethod,
                                )?.icon
                              }
                              className="size-10 object-contain"
                              alt=""
                            />
                          ) : (
                            <span className="material-symbols-outlined text-3xl">
                              inventory_2
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                            Ticket #
                          </p>
                          <p className="text-xl font-black text-slate-900 dark:text-white uppercase leading-none">
                            {sale.ticketNumber || "S/N"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <p
                            className={`text-[10px] font-black uppercase tracking-[0.2em] leading-none mb-1 ${expandedSaleId === sale.id ? "text-primary" : "text-slate-400"}`}
                          >
                            Items
                          </p>
                          <p
                            className={`font-black tracking-tight leading-none ${expandedSaleId === sale.id ? "text-4xl" : "text-2xl text-slate-900 dark:text-white"}`}
                          >
                            {sale.items?.length || 0}
                          </p>
                        </div>
                        {expandedSaleId === sale.id && (
                          <button className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors">
                            <span className="material-symbols-outlined">
                              expand_less
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div
                      className={`grid gap-8 ${expandedSaleId === sale.id ? "grid-cols-1 md:grid-cols-4" : "grid-cols-1"}`}
                    >
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest opacity-60">
                          Responsable
                        </p>
                        <p className="font-black text-slate-800 dark:text-slate-200 tracking-tight text-lg truncate pr-4">
                          {sale.userName || sale.sellerName || "Desconocido"}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest opacity-60">
                          Cliente
                        </p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate pr-4">
                          {sale.customerName || "Cliente General"}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest opacity-60">
                          Contenido
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                            {sale.items?.length || 0} Productos
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        <div
                          className={`size-12 rounded-full flex items-center justify-center border-2 transition-all ${expandedSaleId === sale.id ? "bg-primary/10 border-primary text-primary rotate-180" : "border-slate-100 dark:border-slate-800 text-slate-300 group-hover:border-primary/20 group-hover:text-primary/50"}`}
                        >
                          <span className="material-symbols-outlined text-2xl">
                            expand_more
                          </span>
                        </div>
                      </div>
                    </div>

                    {expandedSaleId === sale.id && (
                      <div
                        className="mt-12 animate-in fade-in zoom-in-95 duration-500"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DeliveryDetailContent
                          sale={sale}
                          onRequestComplete={requestDeliveryConfirmation}
                          setViewingLayoutItem={setViewingLayoutItem}
                          isUpdating={isUpdating}
                          productsData={productsData}
                          pickingData={pickingData}
                          onUpdatePicking={onUpdatePicking}
                          branchLayouts={branchLayouts}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in duration-300">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Ticket
                      </th>
                      <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Vendedor
                      </th>
                      <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Items
                      </th>
                      <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((sale) => (
                      <React.Fragment key={sale.id}>
                        <tr
                          onClick={() =>
                            expandedSaleId !== sale.id && toggleExpand(sale)
                          }
                          className={`group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all ${expandedSaleId === sale.id ? "bg-primary/5 dark:bg-primary/10 shadow-inner" : ""}`}
                        >
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              {sale.paymentMethod && (
                                <img
                                  src={
                                    PAYMENT_METHODS.find(
                                      (m) => m.id === sale.paymentMethod,
                                    )?.icon
                                  }
                                  className="size-6 object-contain opacity-60"
                                  alt=""
                                />
                              )}
                              <p className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                #{sale.ticketNumber || "S/N"}
                              </p>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                              {sale.userName ||
                                sale.sellerName ||
                                "Desconocido"}
                            </p>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-xs font-black bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full w-fit">
                              {sale.items?.length} PRODUCTOS
                            </p>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <div className="flex items-center justify-end gap-3 transition-transform group-hover:scale-105">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-primary">
                                Ver Detalles
                              </span>
                              <span
                                className={`material-symbols-outlined text-slate-300 transition-transform ${expandedSaleId === sale.id ? "rotate-180 text-primary" : ""}`}
                              >
                                expand_more
                              </span>
                            </div>
                          </td>
                        </tr>
                        {expandedSaleId === sale.id && (
                          <tr>
                            <td
                              colSpan="4"
                              className="px-8 py-6 bg-slate-50/50 dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-800"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DeliveryDetailContent
                                sale={sale}
                                onRequestComplete={requestDeliveryConfirmation}
                                setViewingLayoutItem={setViewingLayoutItem}
                                isUpdating={isUpdating}
                                productsData={productsData}
                                pickingData={pickingData}
                                onUpdatePicking={onUpdatePicking}
                                branchLayouts={branchLayouts}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Detail section is now inline expandable */}

        {confirmDeliveryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
            <div className="flex flex-col items-center w-full max-w-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-center p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl">
              <div className="size-14 mb-4 text-primary">
                <span className="material-symbols-outlined text-6xl">
                  inventory_2
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-2">Confirmar entrega</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Al aceptar, se descontará el stock de las ubicaciones
                seleccionadas y se marcará este pedido como entregado.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
                <button
                  type="button"
                  onClick={cancelDeliveryConfirmation}
                  className="w-full sm:w-auto font-medium px-8 py-3 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDelivery}
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white font-medium px-8 py-3 rounded-xl transition active:scale-95"
                >
                  Confirmar entrega
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Delivery;
