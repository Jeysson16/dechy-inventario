import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import DraggableContainer from "../components/common/DraggableContainer";
import LayoutPreview from "../components/inventory/LayoutPreview";
import LocationSelector from "../components/inventory/LocationSelector";
import AppLayout from "../components/layout/AppLayout";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { matchesAnyFuzzy } from "../utils/search";

/* �”€�”€�”€ Entry View (Map & Forms) �”€�”€�”€ */
const EntryView = ({ onBack }) => {
  const { currentUser, currentBranch, userProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [branchLayouts, setBranchLayouts] = useState([]);
  const [currentLayoutId, setCurrentLayoutId] = useState(null);

  // Selection / Entry Modal State
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("entry");
  const [transferDestination, setTransferDestination] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Layer 2 �€” SectionDrawer
  const [sectionOpen, setSectionOpen] = useState(false);
  const [sectionInfo, setSectionInfo] = useState(null); // { shelfIdx, rowIdx, side, label }
  const [expandedLevels, setExpandedLevels] = useState(new Set());
  const [clearingLevel, setClearingLevel] = useState(null); // levelKey for inline confirm

  // Layer 3 �€” TransferDrawer
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferProductInfo, setTransferProductInfo] = useState(null); // { product, sourceKey, sourceLabel }

  // Fetch Products & Layout
  useEffect(() => {
    if (!currentBranch) return;

    const q = query(
      collection(db, "products"),
      where("branch", "==", currentBranch.id),
    );
    const unsubscribeProducts = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProducts(data);
      setLoading(false);
    });

    const branchDocRef = doc(db, "branches", currentBranch.id);
    const unsubscribeLayout = onSnapshot(branchDocRef, (snap) => {
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
      unsubscribeProducts();
      unsubscribeLayout();
    };
  }, [currentBranch]);

  const activeLayout =
    branchLayouts.find((l) => l.id === currentLayoutId) || branchLayouts[0];

  // Compute occupied locations for visualization
  const locationMap = {};
  if (activeLayout) {
    products.forEach((p) => {
      if (p.locations) {
        Object.entries(p.locations).forEach(([key, qty]) => {
          if (key.startsWith(`${activeLayout.id}__`)) {
            const shortKey = key.replace(`${activeLayout.id}__`, "");
            locationMap[shortKey] = (locationMap[shortKey] || 0) + Number(qty);
          } else if (
            !key.includes("__") &&
            activeLayout.id === (branchLayouts[0]?.id || "main")
          ) {
            locationMap[key] = (locationMap[key] || 0) + Number(qty);
          }
        });
      }
    });
  }

  const handleAreaClick = (shelfIdx, rowIdx, side) => {
    if (!activeLayout) return;
    const areaKey = `${shelfIdx}-${rowIdx}-${side}`;
    const label = (activeLayout.customAreaNames || {})[areaKey] || `${shelfIdx + 1}${side}${rowIdx + 1}`;
    setSectionInfo({ shelfIdx, rowIdx, side, label });
    setSectionOpen(true);
    setExpandedLevels(new Set());
    setClearingLevel(null);
  };

  /* Build the full location key for a given slot level */
  const buildLevelKey = (shelfIdx, rowIdx, levelIdx, side) => {
    const baseKey = `${shelfIdx}-${rowIdx}-${levelIdx}-${side}`;
    const legacyKey = `${shelfIdx}-${rowIdx}-${side}`;
    if (activeLayout.id === (branchLayouts[0]?.id || "main") && levelIdx === 0) {
      const hasLegacy = products.some((p) => p.locations && (p.locations[legacyKey] || 0) > 0);
      if (hasLegacy) return legacyKey;
    }
    return `${activeLayout.id}__${baseKey}`;
  };

  /* Inline clear a level �€” no modal, 8s undo toast */
  const handleClearLevelInline = async (levelKey) => {
    const legacyKey = levelKey.includes("__") ? levelKey.split("__")[1] : levelKey;
    const affected = products.filter(
      (p) => p.locations && ((p.locations[levelKey] || 0) > 0 || (p.locations[legacyKey] || 0) > 0),
    );
    if (affected.length === 0) { setClearingLevel(null); return; }

    const savedState = affected.map((p) => ({ id: p.id, locations: { ...p.locations } }));
    const batch = writeBatch(db);
    for (const p of affected) {
      const newLocs = { ...p.locations };
      delete newLocs[levelKey];
      if (levelKey !== legacyKey) delete newLocs[legacyKey];
      batch.update(doc(db, "products", p.id), { locations: newLocs, updatedAt: new Date() });
    }
    await batch.commit();
    setClearingLevel(null);

    toast(
      (tst) => (
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-800">Nivel limpiado</span>
          <button
            onClick={async () => {
              toast.dismiss(tst.id);
              const b2 = writeBatch(db);
              for (const s of savedState) {
                b2.update(doc(db, "products", s.id), { locations: s.locations, updatedAt: new Date() });
              }
              await b2.commit();
              toast.success("Cambios revertidos");
            }}
            className="px-3 py-1 bg-primary text-white text-xs font-black rounded-lg hover:bg-primary/80"
          >
            Deshacer
          </button>
        </div>
      ),
      { duration: 8000 },
    );
  };

  const productsInLocation = products.filter(
    (p) => p.locations && p.locations[selectedLocation] > 0,
  );

  const formatLocationLabel = (rawKey) => {
    if (!rawKey || !activeLayout) return rawKey || "�€”";
    const shortKey = rawKey.includes("__") ? rawKey.split("__")[1] : rawKey;
    const parts = shortKey.split("-");
    if (parts.length < 3) return shortKey;
    const [s, r, ...rest] = parts;
    const side = rest[rest.length - 1];
    const levelPart = rest.length > 1 ? `Nivel ${Number(rest[0]) + 1} - ` : "";
    const shelf = activeLayout.shelves?.[Number(s)];
    const shelfName = shelf?.name || `Estante ${Number(s) + 1}`;
    return `${shelfName} · Fila ${Number(r) + 1} · ${levelPart}Lado ${side}`;
  };

  const handleConfirmTransfer = async () => {
    if (
      !selectedProduct ||
      !quantity ||
      Number(quantity) <= 0 ||
      !transferDestination
    )
      return;

    setIsProcessing(true);
    try {
      const qty = Number(quantity);
      const unitsPerBox = Number(selectedProduct.unitsPerBox) || 1;
      const qtyUnits = qty * unitsPerBox;
      const currentLocStock =
        Number(selectedProduct.locations[selectedLocation]) || 0;

      if (qtyUnits > currentLocStock) {
        toast.error("La cantidad excede el stock disponible en esta ubicación");
        setIsProcessing(false);
        return;
      }

      const productRef = doc(db, "products", selectedProduct.id);
      const newLocations = { ...selectedProduct.locations };

      newLocations[selectedLocation] = currentLocStock - qtyUnits;
      if (newLocations[selectedLocation] <= 0) {
        delete newLocations[selectedLocation];
      }

      newLocations[transferDestination] =
        (Number(newLocations[transferDestination]) || 0) + qtyUnits;

      await updateDoc(productRef, {
        locations: newLocations,
        updatedAt: new Date(),
      });

      await addDoc(collection(db, "transactions"), {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type: "TRASLADO",
        quantityBoxes: qty,
        quantityUnits: qtyUnits,
        userEmail: currentUser.email,
        userName:
          userProfile?.name || currentUser?.displayName || currentUser.email,
        branchId: currentBranch.id,
        date: new Date(),
        originLocation: selectedLocation,
        destinationLocation: transferDestination,
        note: "Traslado interno de stock",
      });

      toast.success(`Trasladadas ${qty} cajas exitosamente`);
      setIsModalOpen(false);
      onBack();
    } catch (error) {
      console.error("Error moving stock:", error);
      toast.error("Error al trasladar stock.");
    } finally {
      setIsProcessing(false);
    }
  };

  /* Move from TransferDrawer (cross-croquis) */
  const handleConfirmMove = async () => {
    if (!transferProductInfo || !transferDestination || !quantity || Number(quantity) <= 0) return;
    const { product, sourceKey } = transferProductInfo;
    const qty = Number(quantity);
    const unitsPerBox = Number(product.unitsPerBox) || 1;
    const qtyUnits = qty * unitsPerBox;
    const currentLocStock = Number(product.locations?.[sourceKey]) || 0;

    if (qtyUnits > currentLocStock) {
      toast.error("La cantidad excede el stock disponible en esta ubicación");
      return;
    }

    setIsProcessing(true);
    try {
      const savedLocs = { ...product.locations };
      const newLocations = { ...product.locations };
      newLocations[sourceKey] = currentLocStock - qtyUnits;
      if (newLocations[sourceKey] <= 0) delete newLocations[sourceKey];
      newLocations[transferDestination] = (Number(newLocations[transferDestination]) || 0) + qtyUnits;

      await updateDoc(doc(db, "products", product.id), { locations: newLocations, updatedAt: new Date() });
      await addDoc(collection(db, "transactions"), {
        productId: product.id,
        productName: product.name,
        type: "TRASLADO",
        quantityBoxes: qty,
        quantityUnits: qtyUnits,
        userEmail: currentUser.email,
        userName: userProfile?.name || currentUser?.displayName || currentUser.email,
        branchId: currentBranch.id,
        date: new Date(),
        originLocation: sourceKey,
        destinationLocation: transferDestination,
        note: "Traslado de stock",
      });

      setTransferOpen(false);
      setTransferProductInfo(null);
      setTransferDestination("");
      setQuantity("");

      const savedState = { id: product.id, locations: savedLocs };
      toast(
        (tst) => (
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-800">Producto movido</span>
            <button
              onClick={async () => {
                toast.dismiss(tst.id);
                await updateDoc(doc(db, "products", savedState.id), { locations: savedState.locations, updatedAt: new Date() });
                toast.success("Movimiento revertido");
              }}
              className="px-3 py-1 bg-primary text-white text-xs font-black rounded-lg hover:bg-primary/80"
            >
              Deshacer
            </button>
          </div>
        ),
        { duration: 5000 },
      );
    } catch (error) {
      console.error("Error al mover:", error);
      toast.error("Error al mover el producto.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getProductImage = (p) =>
    p?.mainImageUrl || p?.imageUrl || p?.imageUrls?.[0]?.url || null;

  const filteredProducts = products.filter((p) =>
    matchesAnyFuzzy(searchTerm, [p.name, p.sku]),
  );

  const handleConfirmEntry = async () => {
    if (!selectedProduct || !quantity || Number(quantity) <= 0) return;

    setIsProcessing(true);
    try {
      const qty = Number(quantity);
      const unitsPerBox = Number(selectedProduct.unitsPerBox) || 1;
      const qtyUnits = qty * unitsPerBox;
      const currentStock = Number(selectedProduct.currentStock) || 0;
      const newStock = currentStock + qty;

      const productRef = doc(db, "products", selectedProduct.id);
      const newLocations = { ...(selectedProduct.locations || {}) };
      newLocations[selectedLocation] =
        (Number(newLocations[selectedLocation]) || 0) + qtyUnits;

      await updateDoc(productRef, {
        currentStock: newStock,
        locations: newLocations,
        status:
          newStock > 20
            ? "Disponible"
            : newStock > 0
              ? "Stock Bajo"
              : "Agotado",
        updatedAt: new Date(),
      });

      await addDoc(collection(db, "transactions"), {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type: "entrada",
        quantityBoxes: qty,
        quantityUnits: qtyUnits,
        userEmail: currentUser.email,
        userName:
          userProfile?.name || currentUser?.displayName || currentUser.email,
        branchId: currentBranch.id,
        date: new Date(),
        newStock: newStock,
        location: selectedLocation,
        note: "Ingreso manual por mapa",
      });

      toast.success(`Ingresadas ${qty} cajas a ${selectedProduct.name}`);
      setIsModalOpen(false);
      onBack();
    } catch (error) {
      console.error("Error processing entry:", error);
      toast.error("Error al procesar el ingreso.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-800 px-6 py-4 shrink-0 flex flex-col md:flex-row md:justify-between md:items-center gap-4 z-20">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button
            onClick={onBack}
            className="size-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-primary hidden md:block">
                move_to_inbox
              </span>
              Recepción de Mercadería
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 hidden md:block">
              Seleccione una ubicación en el mapa para ingresar stock.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {branchLayouts.length > 1 && (
            <select
              value={currentLayoutId || ""}
              onChange={(e) => setCurrentLayoutId(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-primary/50"
            >
              {branchLayouts.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => navigate("/nuevo-producto")}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary dark:bg-slate-800 text-white dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors w-full md:w-auto"
          >
            <span className="material-symbols-outlined text-[20px]">
              add_box
            </span>
            <span>Producto Nuevo</span>
          </button>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 bg-slate-50/50 dark:bg-slate-950/50 relative overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">
              progress_activity
            </span>
          </div>
        ) : activeLayout ? (
          <>
            <DraggableContainer>
              <div className="min-w-max p-10 origin-center">
                <LayoutPreview
                  layout={activeLayout}
                  quantities={locationMap}
                  onAreaClick={handleAreaClick}
                  onClearSlot={() => {}}
                  products={products}
                  selectedAreas={
                    sectionInfo
                      ? [`${sectionInfo.shelfIdx}-${sectionInfo.rowIdx}-${sectionInfo.side}`]
                      : []
                  }
                  zoom={zoom}
                  onZoomChange={setZoom}
                  dimmed={sectionOpen || transferOpen}
                />
              </div>
            </DraggableContainer>

            {/* Zoom Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-30 pointer-events-auto">
              <button
                onClick={() => setZoom((z) => Math.min(z + 0.1, 2))}
                className="size-10 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                title="Acercar"
              >
                <span className="material-symbols-outlined">add</span>
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(z - 0.1, 0.5))}
                className="size-10 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                title="Alejar"
              >
                <span className="material-symbols-outlined">remove</span>
              </button>
              <button
                onClick={() => setZoom(1)}
                className="size-10 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                title="Restablecer"
              >
                <span className="material-symbols-outlined">
                  center_focus_strong
                </span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <span className="material-symbols-outlined text-6xl mb-4">map</span>
            <p className="font-bold">No hay croquis configurado</p>
            <button
              onClick={() =>
                navigate(`/sucursales/${currentBranch.id}/croquis`)
              }
              className="mt-4 text-primary font-bold hover:underline"
            >
              Configurar ahora
            </button>
          </div>
        )}

        {/* Helper Badge */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2 pointer-events-none">
          <span className="material-symbols-outlined text-primary animate-bounce">
            touch_app
          </span>
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            Toque una ubicación para recibir stock
          </span>
        </div>
      </div>

      {/* �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•�
          LAYER 2 �€” SectionDrawer
          Right panel on md+, bottom sheet on mobile
      �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•� */}
      {sectionOpen && sectionInfo && activeLayout && (() => {
        const { shelfIdx, rowIdx, side, label } = sectionInfo;
        const areaKey = `${shelfIdx}-${rowIdx}-${side}`;
        const levelsCount = (activeLayout.customAreaLevels || {})[areaKey] || activeLayout.shelves[shelfIdx]?.levelsPerFila || 1;
        return (
          <>
            {/* Click-outside overlay */}
            <div
              className="fixed inset-0 z-40 md:bg-transparent bg-slate-900/10"
              onClick={() => { setSectionOpen(false); setSectionInfo(null); }}
            />

            {/* Panel */}
            <div className="fixed z-50
              bottom-0 left-0 right-0 max-h-[65vh]
              md:bottom-auto md:top-0 md:right-0 md:left-auto md:h-full md:w-96 md:max-h-none
              bg-white dark:bg-slate-900
              rounded-t-3xl md:rounded-none md:rounded-l-3xl
              shadow-2xl border border-slate-200 dark:border-slate-800
              flex flex-col animate-slideLeft"
            >
              {/* Drag handle (mobile) */}
              <div className="flex justify-center pt-3 pb-0 md:hidden shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>

              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-[18px]">shelves</span>
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">Sección {label}</h3>
                    <p className="text-[11px] text-slate-500">{activeLayout.name} · {levelsCount} nivel{levelsCount !== 1 ? 'es' : ''}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setSectionOpen(false); setSectionInfo(null); }}
                  className="size-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Levels list */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
                {Array.from({ length: levelsCount }).map((_, levelIdx) => {
                  const levelKey = buildLevelKey(shelfIdx, rowIdx, levelIdx, side);
                  const prodsHere = products.filter((p) => p.locations && (p.locations[levelKey] || 0) > 0);
                  const totalQty = prodsHere.reduce((s, p) => s + Number(p.locations[levelKey] || 0), 0);
                  const isExpanded = expandedLevels.has(levelIdx);
                  const isClearing = clearingLevel === levelKey;

                  return (
                    <div key={levelIdx} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
                      {/* Level row */}
                      <div className="flex items-center gap-3 p-3">
                        <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-black text-sm text-slate-700 dark:text-slate-300 shrink-0">
                          N{levelIdx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{label} · Nivel {levelIdx + 1}</p>
                          <p className="text-[11px] text-slate-500">
                            {prodsHere.length > 0 ? `${prodsHere.length} prod · ${totalQty} uds` : 'Vacío'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Add stock */}
                          <button
                            onClick={() => {
                              setSelectedLocation(levelKey);
                              setActiveTab("entry");
                              setSelectedProduct(null);
                              setQuantity("");
                              setSearchTerm("");
                              setIsModalOpen(true);
                            }}
                            title="Agregar stock"
                            className="size-8 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all flex items-center justify-center"
                          >
                            <span className="material-symbols-outlined text-[16px]">add</span>
                          </button>
                          {/* Expand products */}
                          {prodsHere.length > 0 && (
                            <button
                              onClick={() => setExpandedLevels((prev) => {
                                const next = new Set(prev);
                                if (next.has(levelIdx)) next.delete(levelIdx); else next.add(levelIdx);
                                return next;
                              })}
                              title={isExpanded ? "Ocultar" : "Ver productos"}
                              className="size-8 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-all flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                {isExpanded ? 'expand_less' : 'inventory_2'}
                              </span>
                            </button>
                          )}
                          {/* Clear level */}
                          {prodsHere.length > 0 && (
                            <button
                              onClick={() => setClearingLevel(isClearing ? null : levelKey)}
                              title="Limpiar nivel"
                              className={`size-8 rounded-xl transition-all flex items-center justify-center ${
                                isClearing
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-500'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline clear confirmation */}
                      {isClearing && (
                        <div className="px-3 pb-3">
                          <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-3 flex items-center justify-between gap-3">
                            <p className="text-xs font-bold text-rose-700 dark:text-rose-300">¿Vaciar este nivel?</p>
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => setClearingLevel(null)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 transition-colors"
                              >
                                No
                              </button>
                              <button
                                onClick={() => handleClearLevelInline(levelKey)}
                                className="px-3 py-1.5 rounded-lg text-xs font-black text-white bg-rose-500 hover:bg-rose-600 transition-colors"
                              >
                                Vaciar
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Expanded products */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700/50">
                          {prodsHere.map((p) => {
                            const img = getProductImage(p);
                            const qty = Number(p.locations[levelKey] || 0);
                            return (
                              <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                                <div className="size-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0 flex items-center justify-center">
                                  {img
                                    ? <img src={img} alt={p.name} className="size-full object-cover" />
                                    : <span className="material-symbols-outlined text-slate-400 text-lg">inventory_2</span>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-xs text-slate-900 dark:text-white truncate">{p.name}</p>
                                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{qty} uds</p>
                                </div>
                                <button
                                  onClick={() => {
                                    setTransferProductInfo({ product: p, sourceKey: levelKey, sourceLabel: `${label} · N${levelIdx + 1}` });
                                    setTransferDestination("");
                                    setQuantity("");
                                    setTransferOpen(true);
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 text-primary rounded-xl text-[11px] font-black hover:bg-primary hover:text-white transition-all shrink-0"
                                >
                                  <span className="material-symbols-outlined text-[13px]">swap_horiz</span>
                                  Mover
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        );
      })()}

      {/* �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•�
          LAYER 3 �€” TransferDrawer (bottom ~40vh)
      �•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•��•� */}
      {transferOpen && transferProductInfo && (() => {
        const { product, sourceKey, sourceLabel } = transferProductInfo;
        const img = getProductImage(product);
        const maxQty = Math.floor((Number(product.locations?.[sourceKey]) || 0) / (Number(product.unitsPerBox) || 1));
        return (
          <>
            <div
              className="fixed inset-0 z-[55] bg-slate-900/20 backdrop-blur-[2px]"
              onClick={() => setTransferOpen(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 z-[60] bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col" style={{ maxHeight: '42vh' }}>
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>

              {/* Header */}
              <div className="px-5 pb-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0 flex items-center justify-center">
                    {img
                      ? <img src={img} alt={product.name} className="size-full object-cover" />
                      : <span className="material-symbols-outlined text-slate-400 text-xl">inventory_2</span>}
                  </div>
                  <div>
                    <p className="font-black text-sm text-slate-900 dark:text-white truncate max-w-[220px]">{product.name}</p>
                    <p className="text-[11px] text-slate-500">Mover desde <span className="font-bold text-primary">{sourceLabel}</span></p>
                  </div>
                </div>
                <button
                  onClick={() => setTransferOpen(false)}
                  className="size-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Form row */}
              <div className="flex-1 overflow-y-auto px-5 pb-5 custom-scrollbar">
                <div className="flex gap-4 items-end">
                  {/* Quantity */}
                  <div className="shrink-0">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Cajas</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQuantity((q) => Math.max(0, (Number(q) || 0) - 1).toString())}
                        className="size-9 rounded-xl border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center hover:border-primary hover:text-primary transition-all text-slate-600 dark:text-slate-400"
                      >
                        <span className="material-symbols-outlined text-[16px]">remove</span>
                      </button>
                      <input
                        type="number" min="0" max={maxQty} value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-16 h-9 text-center text-lg font-black bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:ring-0 outline-none"
                        placeholder="0" autoFocus
                      />
                      <button
                        onClick={() => setQuantity((q) => Math.min(maxQty, (Number(q) || 0) + 1).toString())}
                        className="size-9 rounded-xl border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center hover:border-primary hover:text-primary transition-all text-slate-600 dark:text-slate-400"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 text-center">Máx {maxQty}</p>
                  </div>

                  {/* Destination */}
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Destino</label>
                    <button
                      onClick={() => setIsLocationSelectorOpen(true)}
                      className="w-full h-9 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-left hover:border-primary transition-all flex items-center justify-between"
                    >
                      <span className={transferDestination ? "text-slate-900 dark:text-white truncate" : "text-slate-400"}>
                        {transferDestination ? formatLocationLabel(transferDestination) : "Seleccionar ubicación..."}
                      </span>
                      <span className="material-symbols-outlined text-slate-400 text-[16px] shrink-0">location_on</span>
                    </button>
                  </div>

                  {/* Confirm */}
                  <div className="shrink-0">
                    <button
                      onClick={handleConfirmMove}
                      disabled={!transferDestination || !quantity || Number(quantity) <= 0 || isProcessing}
                      className="h-9 px-4 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-1.5 text-xs disabled:opacity-50"
                    >
                      {isProcessing
                        ? <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                        : <span className="material-symbols-outlined text-[16px]">swap_horiz</span>}
                      Confirmar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* Entry Modal (compact overlay �€” triggered from SectionDrawer) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] animate-scaleUp">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">
                    {activeTab === "entry" ? "input" : "swap_horiz"}
                  </span>
                  {activeTab === "entry" ? "Ingresar Stock" : "Trasladar Stock"}
                </h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Ubicación: {formatLocationLabel(selectedLocation)}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="size-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-800">
              <button
                onClick={() => { setActiveTab("entry"); setSelectedProduct(null); setQuantity(""); }}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${
                  activeTab === "entry"
                    ? "border-primary text-primary"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                Ingreso Nuevo
              </button>
              <button
                onClick={() => { setActiveTab("transfer"); setSelectedProduct(null); setQuantity(""); }}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${
                  activeTab === "transfer"
                    ? "border-primary text-primary"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                Mover a Otra Área
              </button>
            </div>

            {/* Content */}
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
              {activeTab === "entry" ? (
                !selectedProduct ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        search
                      </span>
                      <input
                        autoFocus
                        type="text"
                        placeholder="Buscar producto por nombre o SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {filteredProducts.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                          <p>No se encontraron productos.</p>
                          <button
                            onClick={() => navigate("/nuevo-producto")}
                            className="text-primary font-bold text-sm hover:underline mt-2"
                          >
                            Registrar nuevo
                          </button>
                        </div>
                      ) : (
                        filteredProducts.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setSelectedProduct(p)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all text-left group"
                          >
                            <div className="size-12 rounded-lg bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 flex items-center justify-center p-1">
                              {p.imageUrl ? (
                                <img src={p.imageUrl} className="size-full object-contain" />
                              ) : (
                                <span className="material-symbols-outlined text-slate-300">image</span>
                              )}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{p.name}</h4>
                              <p className="text-xs text-slate-500">{p.sku}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-bold text-slate-400 uppercase">Stock</span>
                              <p className="font-black text-slate-800 dark:text-slate-200">{p.currentStock}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <div className="size-16 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center p-1 border border-slate-200 dark:border-slate-600">
                        {selectedProduct.imageUrl ? (
                          <img src={selectedProduct.imageUrl} className="size-full object-contain" />
                        ) : (
                          <span className="material-symbols-outlined text-slate-300 text-3xl">image</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900 dark:text-white text-lg">{selectedProduct.name}</h4>
                        <p className="text-sm text-slate-500">{selectedProduct.sku}</p>
                      </div>
                      <button onClick={() => setSelectedProduct(null)} className="text-primary text-sm font-bold hover:underline">
                        Cambiar
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                        Cantidad a Ingresar (Cajas)
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setQuantity((q) => Math.max(0, (Number(q) || 0) - 1).toString())}
                          className="size-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <span className="material-symbols-outlined">remove</span>
                        </button>
                        <input
                          autoFocus type="number" value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          className="flex-1 h-12 text-center text-2xl font-black bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:ring-0 outline-none"
                          placeholder="0"
                        />
                        <button
                          onClick={() => setQuantity((q) => ((Number(q) || 0) + 1).toString())}
                          className="size-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <span className="material-symbols-outlined">add</span>
                        </button>
                      </div>
                    </div>
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex items-center gap-3">
                      <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">inventory</span>
                      <div>
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Nuevo Stock Total</p>
                        <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                          {(Number(selectedProduct.currentStock) || 0) + (Number(quantity) || 0)} Cajas
                        </p>
                      </div>
                    </div>
                  </div>
                )
              ) : productsInLocation.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                  <span className="material-symbols-outlined text-4xl mb-2">block</span>
                  <p className="font-medium">No hay productos en esta ubicación para mover.</p>
                </div>
              ) : !selectedProduct ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500 font-bold uppercase tracking-wider">Productos en esta ubicación</p>
                  {productsInLocation.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedProduct(p); setQuantity(""); setTransferDestination(""); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all text-left group"
                    >
                      <div className="size-12 rounded-lg bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 flex items-center justify-center p-1">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} className="size-full object-contain" />
                        ) : (
                          <span className="material-symbols-outlined text-slate-300">image</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{p.name}</h4>
                        <p className="text-xs text-slate-500">{p.sku}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-400 uppercase">Aquí</span>
                        <p className="font-black text-slate-800 dark:text-slate-200">{p.locations[selectedLocation]}</p>
                      </div>
                      <span className="material-symbols-outlined text-slate-300 group-hover:text-primary">arrow_forward_ios</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <div className="size-16 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center p-1 border border-slate-200 dark:border-slate-600">
                      {selectedProduct.imageUrl ? (
                        <img src={selectedProduct.imageUrl} className="size-full object-contain" />
                      ) : (
                        <span className="material-symbols-outlined text-slate-300 text-3xl">image</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 dark:text-white text-lg">{selectedProduct.name}</h4>
                      <p className="text-sm text-slate-500">
                        Disponible aquí:{" "}
                        <span className="font-black text-slate-800 dark:text-white">{selectedProduct.locations[selectedLocation]}</span> unidades
                      </p>
                    </div>
                    <button onClick={() => setSelectedProduct(null)} className="text-primary text-sm font-bold hover:underline">
                      Cambiar
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Cantidad a Mover</label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setQuantity((q) => Math.max(0, (Number(q) || 0) - 1).toString())}
                        className="size-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <span className="material-symbols-outlined">remove</span>
                      </button>
                      <input
                        autoFocus type="number" min="0"
                        max={Math.floor((selectedProduct.locations[selectedLocation] || 0) / (Number(selectedProduct.unitsPerBox) || 1))}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="flex-1 h-12 text-center text-2xl font-black bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:ring-0 outline-none"
                        placeholder="0"
                      />
                      <button
                        onClick={() => setQuantity((q) => Math.min(Math.floor((selectedProduct.locations[selectedLocation] || 0) / (Number(selectedProduct.unitsPerBox) || 1)), (Number(q) || 0) + 1).toString())}
                        className="size-12 rounded-xl border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <span className="material-symbols-outlined">add</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Ubicación de Destino</label>
                    <button
                      onClick={() => setIsLocationSelectorOpen(true)}
                      className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-left hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-between group"
                    >
                      <span className={transferDestination ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"}>
                        {transferDestination ? formatLocationLabel(transferDestination) : "Seleccionar ubicación..."}
                      </span>
                      <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">location_on</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              {activeTab === "entry"
                ? selectedProduct && (
                    <button
                      onClick={handleConfirmEntry}
                      disabled={!quantity || Number(quantity) <= 0 || isProcessing}
                      className="px-8 py-3 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:shadow-none"
                    >
                      {isProcessing
                        ? <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        : <span className="material-symbols-outlined">check</span>}
                      Confirmar Ingreso
                    </button>
                  )
                : selectedProduct && (
                    <button
                      onClick={handleConfirmTransfer}
                      disabled={!quantity || Number(quantity) <= 0 || !transferDestination || isProcessing}
                      className="px-8 py-3 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:shadow-none"
                    >
                      {isProcessing
                        ? <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        : <span className="material-symbols-outlined">swap_horiz</span>}
                      Confirmar Traslado
                    </button>
                  )}
            </div>
          </div>
        </div>
      )}

      {/* Location Selector Modal */}
      <LocationSelector
        isOpen={isLocationSelectorOpen}
        layout={activeLayout}
        allLayouts={branchLayouts}
        onSelect={(location) => {
          setTransferDestination(location);
          setIsLocationSelectorOpen(false);
        }}
        onClose={() => setIsLocationSelectorOpen(false)}
        excludeLocation={transferOpen ? transferProductInfo?.sourceKey : selectedLocation}
      />
    </div>
  );
};

/* ─── Entry List (History) ─── */
const EntryList = ({ onNewEntry }) => {
  const { currentBranch } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (!currentBranch) return;
    // Query transactions where type is 'entrada' or 'TRASLADO'
    const q = query(
      collection(db, "transactions"),
      where("branchId", "==", currentBranch.id),
      where("type", "in", ["entrada", "TRASLADO"]),
      orderBy("date", "desc"),
      limit(50),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = [];
        snap.forEach((d) => data.push({ id: d.id, ...d.data() }));
        setTransactions(data);
        setPage(1);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching transactions:", error);
        if (error.code === "failed-precondition") {
          toast.error(
            "Falta un índice en la base de datos para esta combinación de filtros.",
            { duration: 5000 },
          );
        } else {
          toast.error("Error al cargar historial de movimientos.");
        }
        setLoading(false);
      },
    );
    return () => unsub();
  }, [currentBranch]);

  // Fetch employees for user name mapping
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "employees"), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEmployees(data);
    });
    return () => unsub();
  }, []);

  // Map email to user name for transactions
  const userMap = useMemo(() => {
    const map = {};
    employees.forEach((emp) => {
      map[emp.email] = emp.name;
    });
    return map;
  }, [employees]);

  const totalPages = Math.max(1, Math.ceil(transactions.length / itemsPerPage));

  const handleExportPDF = async () => {
    if (transactions.length === 0) return;
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const now = new Date().toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("Historial de Movimientos de Stock", 40, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generado: ${now}`, 40, 56);

    autoTable(doc, {
      startY: 70,
      headStyles: { fillColor: [207, 174, 112], textColor: [15, 23, 42], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 5 },
      head: [["Fecha", "Tipo", "Producto", "Usuario", "Cajas", "Unidades", "Origen", "Destino"]],
      body: transactions.map((tx) => [
        tx.date?.toDate
          ? tx.date.toDate().toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })
          : "�€”",
        tx.type === "TRASLADO" ? "Traslado" : "Ingreso",
        tx.productName || "�€”",
        userMap[tx.userEmail] || tx.userName || tx.userEmail || "�€”",
        tx.quantityBoxes ?? "�€”",
        tx.quantityUnits ?? "�€”",
        tx.originLocation || tx.location || "�€”",
        tx.destinationLocation || "�€”",
      ]),
    });

    doc.save(`movimientos-${new Date().toISOString().split("T")[0]}.pdf`);
  };
  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return transactions.slice(start, start + itemsPerPage);
  }, [transactions, page]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-10 py-6">
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Movimientos de Stock
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 hidden md:block">
              Historial de ingresos y traslados recientes
            </p>
          </div>
          <div className="flex gap-3">
            {transactions.length > 0 && (
              <button
                onClick={handleExportPDF}
                className="px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex gap-2 items-center"
              >
                <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                Exportar PDF
              </button>
            )}
            <button
              onClick={onNewEntry}
              className="px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex gap-2  justify-center items-center"
            >
              <span className="material-symbols-outlined">add</span>
              Nuevo Ingreso
            </button>
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
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-10">
              <span className="material-symbols-outlined text-6xl mb-4 bg-slate-100 dark:bg-slate-800 p-4 rounded-full">
                history_edu
              </span>
              <p className="font-bold text-lg text-slate-700 dark:text-slate-200">
                No hay movimientos registrados
              </p>
              <p className="text-sm mt-1 mb-6">
                Comienza registrando un ingreso de mercadería
              </p>
              <button
                onClick={onNewEntry}
                className="px-6 py-2.5 bg-slate-900 dark:bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-slate-600 transition-all text-sm"
              >
                Crear Ingreso
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">
                        Fecha
                      </th>
                      <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">
                        Tipo
                      </th>
                      <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">
                        Producto
                      </th>
                      <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">
                        Usuario
                      </th>
                      <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs text-right">
                        Cantidad
                      </th>
                      <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">
                        Ubicación
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {tx.date?.toDate
                            ? tx.date.toDate().toLocaleDateString() +
                              " " +
                              tx.date.toDate().toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Fecha inválida"}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider ${
                              tx.type === "entrada"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-800 dark:text-slate-200 font-bold">
                          {tx.productName}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs">
                          {tx.userName ||
                            userMap[tx.userEmail] ||
                            tx.userEmail ||
                            "Desconocido"}
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white">
                          {tx.quantityBoxes}{" "}
                          <span className="text-[10px] text-slate-400 font-bold uppercase">
                            Cajas
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {tx.location ? (
                            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                              {tx.location}
                            </span>
                          ) : tx.originLocation ? (
                            <div className="flex items-center gap-1">
                              <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">
                                {tx.originLocation}
                              </span>
                              <span className="material-symbols-outlined text-[12px]">
                                arrow_forward
                              </span>
                              <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">
                                {tx.destinationLocation}
                              </span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-xs text-slate-500">
                  Mostrando{" "}
                  {Math.min((page - 1) * itemsPerPage + 1, transactions.length)}{" "}
                  - {Math.min(page * itemsPerPage, transactions.length)} de{" "}
                  {transactions.length} movimientos
                </p>
                <div className="flex items-center flex-wrap gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold disabled:opacity-50"
                  >
                    Primero
                  </button>
                  <button
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page === 1}
                    className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`px-2 py-1 rounded-lg border text-xs font-bold ${page === pageNum ? "bg-primary text-white border-primary" : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}
                      >
                        {pageNum}
                      </button>
                    ),
                  )}
                  <button
                    onClick={() =>
                      setPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={page === totalPages}
                    className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold disabled:opacity-50"
                  >
                    �šltimo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* �”€�”€�”€ Main Component �”€�”€�”€ */
const StockEntry = () => {
  const [view, setView] = useState("list"); // 'list' | 'new'

  return (
    <AppLayout>
      {view === "new" ? (
        <EntryView onBack={() => setView("list")} />
      ) : (
        <EntryList onNewEntry={() => setView("new")} />
      )}
    </AppLayout>
  );
};

export default StockEntry;
