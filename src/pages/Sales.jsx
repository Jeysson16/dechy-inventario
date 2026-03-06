import { collection, doc, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import DraggableContainer from '../components/common/DraggableContainer';
import LayoutPreview from '../components/inventory/LayoutPreview';
import AppLayout from '../components/layout/AppLayout';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';

/* ─── Box/Unit calculation helper ─── */
const calcSale = (product, mode, qty) => {
  const upb = Number(product.unitsPerBox) || 1;
  const q = Number(qty) || 0;

  if (mode === 'cajas') {
    return {
      boxesDeducted: q,
      totalUnits: q * upb,
      fullBoxes: q,
      remainderUnits: 0,
      subtotal: q * (Number(product.boxPrice) || 0),
    };
  }

  // mode === 'unidades'
  const fullBoxes = Math.floor(q / upb);
  const remainderUnits = q % upb;
  // We only deduct full boxes from stock; partial box is opened but stays in stock as is
  const boxesDeducted = fullBoxes;
  const subtotal =
    fullBoxes * (Number(product.boxPrice) || 0) +
    remainderUnits * (Number(product.unitPrice) || 0);

  return { boxesDeducted, totalUnits: q, fullBoxes, remainderUnits, subtotal };
};

/* ─── Sale Modal ─── */
const SaleModal = ({ product, onClose, branchLayout }) => {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState('cajas'); // 'cajas' | 'unidades'
  const [qty, setQty] = useState('');
  const [distribution, setDistribution] = useState({}); // { [locationKey]: number }
  const [saving, setSaving] = useState(false);

  // Constants
  const upb = Number(product.unitsPerBox) || 1;
  const maxStock = mode === 'cajas' 
    ? product.currentStock 
    : product.currentStock * upb;

  // Calculate totals based on inputs
  const calc = useMemo(() => {
    const q = Number(qty) || 0;
    if (q <= 0) return null;
    return calcSale(product, mode, q);
  }, [product, mode, qty]);

  // Step 1 Validation
  const isStep1Valid = useMemo(() => {
    if (!calc) return false;
    if (calc.boxesDeducted > product.currentStock) return false; // Stock check
    return true;
  }, [calc, product]);

  // Step 2 Validation
  const isStep2Valid = useMemo(() => {
    if (!calc) return false;
    // Total distributed must match the requested quantity
    // Note: The requested quantity is in 'mode' units (boxes or units)
    // The distribution should likely be in the same unit or tracked carefully.
    // product.locations is usually in BOXES (based on standard inventory logic, but let's verify).
    // Looking at LayoutPreview usage: "x{lQty} cjs". So locations store Boxes.
    
    // If mode is 'unidades', it's harder to distribute specific units from boxes if the system tracks boxes.
    // However, the helper `calcSale` converts units to "boxesDeducted".
    // "We only deduct full boxes from stock; partial box is opened but stays in stock as is" -> comment in calcSale.
    
    // So, if mode is 'unidades', we might be deducting partials?
    // The logic in calcSale says: 
    // const boxesDeducted = fullBoxes;
    // It seems the system tracks FULL BOXES. 
    // If I sell units, I might strictly be reducing the "opened box" or just not tracking location of loose units?
    // The user's prompt: "si es cajas u unidades... seleccionarias de donde van saliendo".
    
    // Simplification:
    // If Mode = Cajas: Distribute boxes.
    // If Mode = Unidades: 
    //   If result is X boxes + Y units. 
    //   We distribute X boxes. 
    //   The Y units come from "somewhere" (maybe an opened box or ignored for location tracking for now).
    //   Let's focus on distributing the FULL BOXES (calc.boxesDeducted).
    
    const requiredBoxes = calc.boxesDeducted;
    if (requiredBoxes === 0) return true; // No boxes to move, just loose units?
    
    const distributedTotal = Object.values(distribution).reduce((sum, v) => sum + (Number(v) || 0), 0);
    return distributedTotal === requiredBoxes;
  }, [calc, distribution]);

  const [selectedLocation, setSelectedLocation] = useState(null); // Track which location is active for editing

  // Auto-distribute when entering Step 2
  useEffect(() => {
    if (step === 2 && calc && calc.boxesDeducted > 0) {
      // Try to auto-fill distribution
      const needed = calc.boxesDeducted;
      const newDist = {};
      let remaining = needed;
      
      const locs = product.locations || {};
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
  }, [step, calc, product.locations]);

  // Handle quantity change from the map
  const handleMapQuantityChange = useCallback((key, newValue) => {
    // If we're setting a new value, check limits
    const numValue = Number(newValue) || 0;
    const maxQty = product.locations?.[key] || 0;
    const currentTotal = Object.values(distribution).reduce((sum, v) => sum + (Number(v) || 0), 0);
    const oldValue = distribution[key] || 0;
    
    // Calculate new potential total if we apply this change
    const newTotal = currentTotal - oldValue + numValue;
    
    // Validation 1: Exceeds location capacity
    if (numValue > maxQty) {
      toast.error(`La cantidad excede el stock en esta ubicación (${maxQty})`);
      // We can clamp it or just allow it but show error - user asked for toast and visual cue.
      // Let's clamp for data integrity but show toast.
      // Actually user said "me dejas poner mas... y mandar un toast asi como ponerle la cuadricula... en rojo"
      // So we should ALLOW it in state but mark it as invalid visually.
    }

    // Validation 2: Exceeds total required boxes
    if (newTotal > calc.boxesDeducted) {
       toast.error(`Has superado el total de cajas requeridas (${calc.boxesDeducted})`);
    }

    setDistribution(prev => ({
      ...prev,
      [key]: newValue === '' ? '' : numValue
    }));
  }, [distribution, product.locations, calc]);

  // Handle map area click
  const handleAreaClick = useCallback((shelfIdx, rowIdx, side) => {
    const key = `${shelfIdx}-${rowIdx}-${side}`;
    
    // STRICT CHECK: Only allow interaction if the location is in the product's location list (has stock)
    if (!product.locations || product.locations[key] === undefined) {
      return; 
    }

    setSelectedLocation(prev => prev === key ? null : key);
  }, [product.locations]);


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
        // Add distribution info if needed by backend later
        distribution: distribution 
      };

      toast.success(`${product.name} agregado al carrito.`);
      onClose(cartItem);
    } catch (err) {
      console.error(err);
      toast.error('Error al agregar al carrito.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustQty = (delta) => {
    const current = Number(qty) || 0;
    const next = Math.max(0, Math.min(maxStock, current + delta));
    setQty(next === 0 ? '' : next.toString());
  };

  // Stepper UI
  const renderStepper = () => (
    <div className="flex items-center justify-center gap-4 mb-6">
      <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-slate-300'}`}>
        <div className={`size-8 rounded-full flex items-center justify-center text-sm font-black border-2 ${step >= 1 ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white'}`}>1</div>
        <span className="text-xs font-bold uppercase tracking-wider hidden sm:block">Cantidad</span>
      </div>
      <div className="w-12 h-0.5 bg-slate-100"></div>
      <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-slate-300'}`}>
        <div className={`size-8 rounded-full flex items-center justify-center text-sm font-black border-2 ${step >= 2 ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white'}`}>2</div>
        <span className="text-xs font-bold uppercase tracking-wider hidden sm:block">Ubicación</span>
      </div>
    </div>
  );

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className={`bg-white rounded-[2rem] shadow-2xl w-full overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] transition-all duration-500 ease-out ${step === 1 ? 'max-w-lg' : 'max-w-5xl'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
             {product.imageUrl ? (
              <img src={product.imageUrl} className="size-10 rounded-lg object-cover border border-slate-200" />
            ) : (
              <div className="size-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                <span className="material-symbols-outlined text-[20px]">inventory_2</span>
              </div>
            )}
            <div>
              <h3 className="font-bold text-slate-900 leading-tight line-clamp-1">{product.name}</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{product.sku}</p>
            </div>
          </div>
          <button onClick={onClose} className="size-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
          {renderStepper()}

          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 max-w-sm mx-auto">
              {/* Mode Selection */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                <button
                  onClick={() => { setMode('cajas'); setQty(''); }}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                    mode === 'cajas' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                  Por Cajas
                </button>
                <button
                  onClick={() => { setMode('unidades'); setQty(''); }}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                    mode === 'unidades' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">view_module</span>
                  Por Unidades
                </button>
              </div>

              {/* Quantity Input */}
              <div className="flex flex-col items-center gap-4">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ingrese Cantidad</label>
                <div className="flex items-center gap-4">
                  <button onClick={() => handleAdjustQty(-1)} className="size-12 rounded-2xl border-2 border-slate-200 flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all text-slate-600">
                    <span className="material-symbols-outlined">remove</span>
                  </button>
                  <input
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder="0"
                    className="w-32 h-16 text-4xl font-black text-center bg-transparent border-b-2 border-slate-200 focus:border-primary outline-none text-slate-900 placeholder-slate-200 transition-colors"
                    autoFocus
                  />
                  <button onClick={() => handleAdjustQty(1)} className="size-12 rounded-2xl border-2 border-slate-200 flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all text-slate-600">
                    <span className="material-symbols-outlined">add</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  Disponible: {maxStock} {mode}
                </p>
              </div>

              {/* Summary Card */}
              {calc && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Estimado</p>
                    <p className="text-2xl font-black text-primary">S/ {calc.subtotal.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Retiro Físico</p>
                    <p className="text-sm font-bold text-slate-700">{calc.fullBoxes} Cajas + {calc.remainderUnits} Unid.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col h-full min-h-[600px] animate-in slide-in-from-right-4 duration-300 relative">
              {/* Top Summary Bar */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-white/90 backdrop-blur-md px-6 py-2 rounded-2xl shadow-lg border border-primary/10 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                 <div className="text-center">
                   <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Total Requerido</p>
                   <p className="text-xl font-black text-slate-900">{calc.boxesDeducted} <span className="text-xs font-bold text-slate-400">cajas</span></p>
                 </div>
                 <div className="w-px h-8 bg-slate-200"></div>
                 <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Asignado</p>
                    <p className={`text-xl font-black ${
                      Object.values(distribution).reduce((a,b)=>a+b,0) === calc.boxesDeducted 
                        ? 'text-emerald-500' 
                        : 'text-amber-500'
                    }`}>
                      {Object.values(distribution).reduce((a,b)=>a+b,0)} <span className="text-xs font-bold text-slate-300">cajas</span>
                    </p>
                 </div>
              </div>

              {/* Full Map Area */}
              <div className="flex-1 bg-slate-50/50 rounded-3xl border border-slate-100 overflow-hidden relative group">
                 {branchLayout ? (
                   <DraggableContainer>
                     <div className="min-w-max p-16 origin-center transform-gpu transition-transform duration-300">
                        <LayoutPreview 
                          layout={branchLayout} 
                          highlightedAreas={Object.keys(product.locations || {})} 
                          selectedAreas={selectedLocation ? [selectedLocation] : []}
                          quantities={distribution}
                          maxQuantities={product.locations || {}}
                          onQuantityChange={handleMapQuantityChange}
                          onAreaClick={handleAreaClick}
                          readOnly={false} 
                        />
                     </div>
                   </DraggableContainer>
                 ) : (
                   <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                     <span className="material-symbols-outlined text-slate-300 text-6xl mb-4">sentiment_dissatisfied</span>
                     <p className="text-base text-slate-600 font-bold">Sin mapa disponible</p>
                     <p className="text-xs text-slate-400 mt-1">No hay ubicaciones registradas para este producto en el croquis.</p>
                   </div>
                 )}

                 {/* Instructions Overlay (fades out on interaction) */}
                 {!selectedLocation && (
                   <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-medium shadow-lg pointer-events-none animate-bounce opacity-80">
                     👆 Haz clic en una ubicación para asignar cantidad
                   </div>
                 )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
          {step === 2 && (
             <button
              onClick={() => setStep(1)}
              className="px-6 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-white transition-all active:scale-95"
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
              Continuar <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={!isStep2Valid || saving}
              className="flex-1 py-3.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none active:scale-95 flex items-center justify-center gap-2"
            >
              {saving ? (
                <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[20px]">check</span>
              )}
              {saving ? 'Procesando...' : 'Confirmar Venta'}
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
    ? 'bg-red-100 text-red-700'
    : stock <= 10
    ? 'bg-amber-100 text-amber-700'
    : 'bg-emerald-100 text-emerald-700';

  return (
    <div className={`flex flex-col bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${isOut ? 'border-red-200 opacity-70' : 'border-slate-200'}`}>
      {/* Image */}
      <div className="relative w-full aspect-[4/3] bg-slate-100 flex items-center justify-center overflow-hidden">
        {product.imageUrl ? (
          <img src={product.imageUrl} className="w-full h-full object-cover" />
        ) : (
          <span className="material-symbols-outlined text-5xl text-slate-300">image</span>
        )}
        <span className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${statusStyle}`}>
          {isOut ? 'Agotado' : stock <= 10 ? 'Stock Bajo' : 'Disponible'}
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 p-5 gap-3">
        <div>
          <h3 className="font-bold text-slate-900 leading-tight line-clamp-2">{product.name}</h3>
          <p className="text-xs text-slate-500 font-mono mt-1">{product.sku} · {product.category}</p>
        </div>

        {/* Prices */}
        <div className="grid grid-cols-2 gap-2 text-xs py-3 border-y border-slate-100">
          <div className="flex flex-col">
            <span className="text-slate-400 font-bold uppercase tracking-tighter">Precio Unit.</span>
            <span className="text-slate-800 font-bold">S/ {Number(product.unitPrice || product.price || 0).toFixed(2)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400 font-bold uppercase tracking-tighter">Precio Caja</span>
            <span className="text-slate-800 font-bold">S/ {Number(product.boxPrice || 0).toFixed(2)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400 font-bold uppercase tracking-tighter">Und. / Caja</span>
            <span className="text-slate-800 font-bold">{upb} unds.</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400 font-bold uppercase tracking-tighter">Stock</span>
            <span className={`font-bold ${isOut ? 'text-red-600' : 'text-slate-800'}`}>{stock} caja{stock !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Unit stock display */}
        <p className="text-xs text-slate-400 text-center">
          ≈ {stock * upb} unidades disponibles
        </p>

        {/* Sell button */}
        <button
          disabled={isOut}
          onClick={() => onSell(product)}
          className="mt-auto w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-md shadow-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
          {isOut ? 'Sin Stock' : 'Vender'}
        </button>
      </div>
    </div>
  );
};

/* ─── Main Sales Page ─── */
const Sales = () => {
  const { currentUser, currentBranch } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [branchLayout, setBranchLayout] = useState(null);
  
  // Cart state
  const [cart, setCart] = useState([]);
  const [isCheckoutPanelOpen, setIsCheckoutPanelOpen] = useState(false);
  const [isProcessingSale, setIsProcessingSale] = useState(false);

  useEffect(() => {
    if (!currentBranch) return;
    const q = query(
      collection(db, 'products'),
      where('branch', '==', currentBranch.id)
    );
    const productUnsub = onSnapshot(q, (snap) => {
      const data = [];
      snap.forEach((d) => data.push({ id: d.id, ...d.data() }));
      setProducts(data);
      setLoading(false);
    });

    // Fetch branch layout
    const branchDocRef = doc(db, 'branches', currentBranch.id);
    const branchUnsub = onSnapshot(branchDocRef, (snap) => {
      if (snap.exists() && snap.data().layout) {
        setBranchLayout(snap.data().layout);
      }
    });

    return () => {
      productUnsub();
      branchUnsub();
    };
  }, [currentBranch]);

  const categories = useMemo(() => {
    const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
    return cats.sort();
  }, [products]);

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
    [cart]
  );

  const handleSaleClose = useCallback((cartItem) => {
    if (cartItem && cartItem.id) {
      setCart((prev) => {
        // If product already in cart, update it
        const existingId = prev.findIndex(item => item.id === cartItem.id);
        if (existingId >= 0) {
          const newCart = [...prev];
          const ex = newCart[existingId];
          // Sum quantities and subtotals (assuming same mode for simplicity, else overwrite)
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

  const handleOpenSale = useCallback((product) => {
    setSelectedProduct(product);
  }, []);

  const handleRemoveFromCart = (index) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const processCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessingSale(true);
    try {
      const batch = writeBatch(db);
      const saleDate = new Date();
      
      // 1. Create grouping Sale Ticket
      const saleRef = doc(collection(db, 'sales'));
      batch.set(saleRef, {
        branchId: currentBranch?.id,
        user: currentUser?.email || 'Unknown',
        totalValue: cartTotal,
        date: saleDate,
        items: cart.map(item => ({
          productId: item.id,
          productName: item.name,
          quantitySoldUnits: item.quantityUnits,
          quantitySoldBoxes: item.quantityBoxes,
          saleMode: item.saleMode,
          subtotal: item.subtotal
        }))
      });

      // 2. Adjust products stock and generate individual transactions so existing logic/reports still work
      for (const item of cart) {
        const productRef = doc(db, 'products', item.id);
        const previousStock = Number(item.currentStock);
        const newStock = previousStock - item.quantityBoxes;
        const newStatus = newStock > 20 ? 'Disponible' : newStock > 0 ? 'Stock Bajo' : 'Agotado';

        batch.update(productRef, {
          currentStock: newStock,
          status: newStatus,
        });

        const txRef = doc(collection(db, 'transactions'));
        batch.set(txRef, {
          saleId: saleRef.id,
          productId: item.id,
          productName: item.name,
          type: 'SALE',
          saleMode: item.saleMode,
          quantityBoxes: item.quantityBoxes,
          quantityUnits: item.quantityUnits,
          remainderUnits: item.remainderUnits,
          fullBoxes: item.fullBoxes,
          subtotal: item.subtotal,
          previousStock,
          newStock,
          user: currentUser?.email || 'Unknown',
          branchId: currentBranch?.id,
          date: saleDate,
        });
      }

      await batch.commit();
      toast.success('¡Venta completada con éxito!');
      setCart([]);
      setIsCheckoutPanelOpen(false);
    } catch (error) {
      console.error("Error processing checkout:", error);
      toast.error("Ocurrió un error al procesar el pago.");
    } finally {
      setIsProcessingSale(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-1 relative overflow-hidden h-[calc(100vh-64px-57px)]">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Page Header */}
          <div className="bg-white border-b border-slate-200 px-6 lg:px-10 py-6 sticky top-0 z-20">
            <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="size-9 bg-primary/10 rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary">point_of_sale</span>
                  </div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">Punto de Venta</h1>
                </div>
                <p className="text-slate-500 text-sm">Registra ventas por cajas o unidades con descuento automático de stock.</p>
              </div>

              {/* Cart Button Summary */}
              <button 
                onClick={() => setIsCheckoutPanelOpen(!isCheckoutPanelOpen)}
                className={`flex items-center gap-3 border rounded-2xl px-5 py-3 transition-colors ${cart.length > 0 ? 'bg-primary text-white border-primary/20 shadow-md shadow-primary/20 hover:bg-primary/90' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="relative">
                  <span className="material-symbols-outlined shrink-0 text-xl">shopping_cart</span>
                  {cart.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 size-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {cart.length}
                    </span>
                  )}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Mi Carrito</p>
                  <p className="font-black leading-none">S/ {cartTotal.toFixed(2)}</p>
                </div>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-slate-50/80 border-b border-slate-100 px-6 lg:px-10 py-4 sticky top-[105px] z-10 backdrop-blur-md">
            <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar producto o SKU..."
                  className="w-full pl-10 pr-4 h-11 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              {/* Category filter */}
              {categories.length > 0 && (
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="h-11 bg-white border border-slate-200 rounded-xl px-4 text-sm text-slate-600 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                >
                  <option value="">Todas las categorías</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 px-6 lg:px-10 py-8">
            <div className="max-w-screen-xl mx-auto">
              {loading ? (
                <div className="flex justify-center py-20">
                  <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <span className="material-symbols-outlined text-5xl mb-3">inventory_2</span>
                  <p className="font-semibold">No se encontraron productos.</p>
                  <p className="text-sm mt-1">Intenta con otra búsqueda o categoría.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest mb-4">
                    {filtered.length} producto{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
                    {filtered.map((p) => (
                      <ProductCard key={p.id} product={p} onSell={handleOpenSale} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Cart Sidebar */}
        <aside 
          className={`h-full bg-white border-l border-slate-200 transition-all duration-300 ease-in-out flex flex-col z-30
            ${isCheckoutPanelOpen ? 'w-full sm:w-[400px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}
            fixed right-0 top-0 sm:sticky sm:top-0 h-screen sm:h-auto
          `}
        >
          {/* Header */}
          <div className="bg-slate-50 border-b border-slate-200 p-6 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-xl">shopping_cart_checkout</span>
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Carrito de Ventas</h3>
                <p className="text-xs text-slate-500">{cart.length} producto{cart.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <button onClick={() => setIsCheckoutPanelOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-200 transition-colors">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                <span className="material-symbols-outlined text-5xl">shopping_basket</span>
                <p className="font-medium">Tu carrito está vacío</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-3 py-4 border-b border-slate-100 last:border-0 relative group">
                  <button 
                    onClick={() => handleRemoveFromCart(idx)} 
                    className="absolute top-4 right-0 text-slate-300 hover:text-rose-500 transition-colors p-1"
                    title="Eliminar del carrito"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                  
                  <div className="pr-8">
                    <h4 className="font-bold text-slate-800 leading-tight">{item.name}</h4>
                    <p className="text-xs text-slate-500">{item.sku}</p>
                  </div>
                  
                  <div className="flex justify-between items-end">
                    <p className="text-xs font-semibold text-slate-600 bg-slate-100 py-1 px-2 rounded-lg inline-flex items-center gap-1 w-fit">
                      {item.saleMode === 'cajas' ? (
                        <><span className="material-symbols-outlined text-[14px]">inventory_2</span> {item.quantityBoxes} caja{item.quantityBoxes !== 1 ? 's' : ''}</>
                      ) : (
                        <><span className="material-symbols-outlined text-[14px]">view_module</span> {item.quantityUnits} unidad{item.quantityUnits !== 1 ? 'es' : ''}</>
                      )}
                    </p>
                    <p className="text-lg font-black text-slate-900">S/ {item.subtotal.toFixed(2)}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer / Checkout */}
          <div className="bg-white border-t border-slate-200 p-6 flex flex-col gap-4 shrink-0">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium">Subtotal</span>
              <span className="font-bold text-slate-800">S/ {cartTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Descuentos</span>
              <span className="font-bold text-slate-400">S/ 0.00</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-900 font-bold uppercase tracking-wider">Total a Pagar</span>
              <span className="text-2xl font-black text-primary">S/ {cartTotal.toFixed(2)}</span>
            </div>
            <button 
              onClick={processCheckout}
              disabled={cart.length === 0 || isProcessingSale}
              className="w-full mt-2 py-4 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none flex justify-center items-center gap-2"
            >
              {isProcessingSale ? (
                <><span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span> Procesando pago...</>
              ) : (
                <><span className="material-symbols-outlined text-[20px]">payments</span> Procesar Venta</>
              )}
            </button>
          </div>
        </aside>
      </div>

      {/* Sale Modal */}
      {selectedProduct && (
        <SaleModal
          product={selectedProduct}
          currentUser={currentUser}
          currentBranch={currentBranch}
          branchLayout={branchLayout}
          onClose={handleSaleClose}
        />
      )}
    </AppLayout>
  );
};

export default Sales;
