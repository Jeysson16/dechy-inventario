import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import DraggableContainer from '../components/common/DraggableContainer';
import LayoutPreview from '../components/inventory/LayoutPreview';
import AppLayout from '../components/layout/AppLayout';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';

/* ─── Box/Unit calculation helper ─── */
const calcSale = (product, mode, qty) => {
// ... (keep same)
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
  const boxesDeducted = fullBoxes; // Only deduct full boxes from stock
  const subtotal =
    fullBoxes * (Number(product.boxPrice) || 0) +
    remainderUnits * (Number(product.unitPrice) || 0);

  return { boxesDeducted, totalUnits: q, fullBoxes, remainderUnits, subtotal };
};

/* ─── Sale Modal ─── */
const SaleModal = ({ product, onClose, branchLayout }) => {
  // ... (keep same state)
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState('cajas');
  const [qty, setQty] = useState('');
  const [distribution, setDistribution] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [zoom, setZoom] = useState(1);

  const relevantLocations = useMemo(() => {
    if (!branchLayout) return {};
    const locs = {};
    // Assume locations is object/json. If DB has it as JSONB, supabase returns object.
    const productLocs = typeof product.locations === 'string' ? JSON.parse(product.locations || '{}') : (product.locations || {});
    
    Object.entries(productLocs).forEach(([key, qty]) => {
        if (key.startsWith(`${branchLayout.id}__`)) {
            locs[key.replace(`${branchLayout.id}__`, '')] = qty;
        } else if (!key.includes('__') && (branchLayout.id === 'main' || branchLayout.id === 'default')) {
            locs[key] = qty;
        }
    });
    return locs;
  }, [product.locations, branchLayout]);

  const upb = Number(product.unitsPerBox) || 1;
  const maxStock = mode === 'cajas' ? product.currentStock : product.currentStock * upb;

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
    const distributedTotal = Object.values(distribution).reduce((sum, v) => sum + (Number(v) || 0), 0);
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

  const handleMapQuantityChange = useCallback((key, newValue) => {
    const numValue = Number(newValue) || 0;
    const maxQty = relevantLocations?.[key] || 0;
    const currentTotal = Object.values(distribution).reduce((sum, v) => sum + (Number(v) || 0), 0);
    const oldValue = distribution[key] || 0;
    const newTotal = currentTotal - oldValue + numValue;

    if (numValue > maxQty) {
      toast.error(`La cantidad excede el stock en esta ubicación (${maxQty})`);
    }
    if (newTotal > calc.boxesDeducted) {
      toast.error(`Has superado el total de cajas requeridas (${calc.boxesDeducted})`);
    }

    setDistribution(prev => ({ ...prev, [key]: newValue === '' ? '' : numValue }));
  }, [distribution, relevantLocations, calc]);

  const handleAreaClick = useCallback((shelfIdx, rowIdx, side) => {
    const key = `${shelfIdx}-${rowIdx}-${side}`;
    if (!relevantLocations || relevantLocations[key] === undefined) return;
    setSelectedLocation(prev => prev === key ? null : key);
  }, [relevantLocations]);

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

  // ... (keep renderStepper and return JSX)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className={`bg-white rounded-[2rem] shadow-2xl w-full overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] transition-all duration-500 ease-out ${step === 1 ? 'max-w-lg' : 'max-w-5xl'}`} onClick={(e) => e.stopPropagation()}>
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

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
          {renderStepper()}
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 max-w-sm mx-auto">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                <button onClick={() => { setMode('cajas'); setQty(''); }} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'cajas' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                  Por Cajas
                </button>
                <button onClick={() => { setMode('unidades'); setQty(''); }} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'unidades' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <span className="material-symbols-outlined text-[18px]">view_module</span>
                  Por Unidades
                </button>
              </div>
              <div className="flex flex-col items-center gap-4">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ingrese Cantidad</label>
                <div className="flex items-center gap-4">
                  <button onClick={() => handleAdjustQty(-1)} className="size-12 rounded-2xl border-2 border-slate-200 flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all text-slate-600"><span className="material-symbols-outlined">remove</span></button>
                  <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" className="w-32 h-16 text-4xl font-black text-center bg-transparent border-b-2 border-slate-200 focus:border-primary outline-none text-slate-900 placeholder-slate-200 transition-colors" autoFocus />
                  <button onClick={() => handleAdjustQty(1)} className="size-12 rounded-2xl border-2 border-slate-200 flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all text-slate-600"><span className="material-symbols-outlined">add</span></button>
                </div>
                <p className="text-xs text-slate-400 font-medium">Disponible: {maxStock} {mode}</p>
              </div>
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
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-white/90 backdrop-blur-md px-6 py-2 rounded-2xl shadow-lg border border-primary/10 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                 <div className="text-center">
                   <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Total Requerido</p>
                   <p className="text-xl font-black text-slate-900">{calc.boxesDeducted} <span className="text-xs font-bold text-slate-400">cajas</span></p>
                 </div>
                 <div className="w-px h-8 bg-slate-200"></div>
                 <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Asignado</p>
                    <p className={`text-xl font-black ${Object.values(distribution).reduce((a,b)=>a+b,0) === calc.boxesDeducted ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {Object.values(distribution).reduce((a,b)=>a+b,0)} <span className="text-xs font-bold text-slate-300">cajas</span>
                    </p>
                 </div>
              </div>
              <div className="flex-1 bg-slate-50/50 rounded-xl border border-slate-100 overflow-hidden relative group">
                 {branchLayout ? (
                   <>
                     <DraggableContainer>
                       <div className="min-w-max p-10 origin-center transform-gpu transition-transform duration-300">
                          <LayoutPreview 
                            layout={branchLayout} 
                            highlightedAreas={Object.keys(relevantLocations || {})} 
                            selectedAreas={selectedLocation ? [selectedLocation] : []}
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
                        <button onClick={() => setZoom(z => Math.min(z + 0.1, 2))} className="size-10 bg-white rounded-xl shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"><span className="material-symbols-outlined">add</span></button>
                        <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))} className="size-10 bg-white rounded-xl shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"><span className="material-symbols-outlined">remove</span></button>
                        <button onClick={() => setZoom(1)} className="size-10 bg-white rounded-xl shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"><span className="material-symbols-outlined">center_focus_strong</span></button>
                     </div>
                   </>
                 ) : (
                   <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                     <span className="material-symbols-outlined text-slate-300 text-6xl mb-4">sentiment_dissatisfied</span>
                     <p className="text-base text-slate-600 font-bold">Sin mapa disponible</p>
                   </div>
                 )}
              </div>
            </div>
          )}
        </div>
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
          {step === 2 && (
             <button onClick={() => setStep(1)} className="px-6 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-white transition-all active:scale-95">Atrás</button>
          )}
          {step === 1 ? (
            <button onClick={() => isStep1Valid && setStep(2)} disabled={!isStep1Valid} className="flex-1 py-3.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none active:scale-95 flex items-center justify-center gap-2">Continuar <span className="material-symbols-outlined text-[18px]">arrow_forward</span></button>
          ) : (
            <button onClick={handleConfirm} disabled={!isStep2Valid || saving} className="flex-1 py-3.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none active:scale-95 flex items-center justify-center gap-2">
              {saving ? <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span> : <span className="material-symbols-outlined text-[20px]">check</span>}
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
  // ... (keep same)
  const upb = Number(product.unitsPerBox) || 1;
  const stock = Number(product.currentStock) || 0;
  const isOut = stock === 0;
  const statusStyle = isOut ? 'bg-red-100 text-red-700' : stock <= 10 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';

  return (
    <div className={`flex flex-col bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${isOut ? 'border-red-200 opacity-70' : 'border-slate-200'}`}>
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
      <div className="flex flex-col flex-1 p-5 gap-3">
        <div>
          <h3 className="font-bold text-slate-900 leading-tight line-clamp-2">{product.name}</h3>
          <p className="text-xs text-slate-500 font-mono mt-1">{product.sku} · {product.category}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs py-3 border-y border-slate-100">
          <div className="flex flex-col"><span className="text-slate-400 font-bold uppercase tracking-tighter">Precio Unit.</span><span className="text-slate-800 font-bold">S/ {Number(product.unitPrice || product.price || 0).toFixed(2)}</span></div>
          <div className="flex flex-col"><span className="text-slate-400 font-bold uppercase tracking-tighter">Precio Caja</span><span className="text-slate-800 font-bold">S/ {Number(product.boxPrice || 0).toFixed(2)}</span></div>
          <div className="flex flex-col"><span className="text-slate-400 font-bold uppercase tracking-tighter">Und. / Caja</span><span className="text-slate-800 font-bold">{upb} unds.</span></div>
          <div className="flex flex-col"><span className="text-slate-400 font-bold uppercase tracking-tighter">Stock</span><span className={`font-bold ${isOut ? 'text-red-600' : 'text-slate-800'}`}>{stock} caja{stock !== 1 ? 's' : ''}</span></div>
        </div>
        <p className="text-xs text-slate-400 text-center">≈ {stock * upb} unidades disponibles</p>
        <button disabled={isOut} onClick={() => onSell(product)} className="mt-auto w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-md shadow-primary/10 disabled:opacity-40 disabled:cursor-not-allowed">
          <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
          {isOut ? 'Sin Stock' : 'Vender'}
        </button>
      </div>
    </div>
  );
};

/* ─── POS View (New Sale) ─── */
const POSView = ({ onBack }) => {
  const { currentUser, currentBranch } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [branchLayouts, setBranchLayouts] = useState([]);
  const [currentLayoutId, setCurrentLayoutId] = useState(null);
  const [cart, setCart] = useState([]);
  const [isCheckoutPanelOpen, setIsCheckoutPanelOpen] = useState(false);
  const [isProcessingSale, setIsProcessingSale] = useState(false);

  useEffect(() => {
    if (!currentBranch) return;
    
    // Fetch inventory
    const fetchInventory = async () => {
        setLoading(true);
        try {
             // Fetch full products to get details like unitsPerBox, boxPrice
             const { data: invData, error } = await supabase
                .from('inventory')
                .select(`
                    id,
                    stock_current,
                    stock_min,
                    location_code,
                    products (
                        id,
                        sku,
                        name,
                        unit_price,
                        box_price,
                        units_per_box,
                        image_url,
                        categories ( name )
                    )
                `)
                .eq('branch_id', currentBranch.id);
            
            if (error) throw error;

            if (invData) {
                const fullMapped = invData.map(item => ({
                    id: item.products.id,
                    inventoryId: item.id,
                    name: item.products.name,
                    sku: item.products.sku,
                    unitPrice: item.products.unit_price,
                    boxPrice: item.products.box_price,
                    unitsPerBox: item.products.units_per_box,
                    imageUrl: item.products.image_url,
                    category: item.products.categories?.name,
                    currentStock: item.stock_current,
                    locations: typeof item.location_code === 'string' ? JSON.parse(item.location_code || '{}') : {}
                }));
                setProducts(fullMapped);
            }
        } catch (error) {
            console.error("Error fetching inventory:", error);
            toast.error("Error al cargar inventario");
        } finally {
            setLoading(false);
        }
    };

    fetchInventory();

    const fetchLayouts = async () => {
         const { data } = await supabase.from('branches').select('settings').eq('id', currentBranch.id).single();
         if (data?.settings?.layouts) {
             setBranchLayouts(data.settings.layouts);
             if (!currentLayoutId && data.settings.layouts.length > 0) setCurrentLayoutId(data.settings.layouts[0].id);
         }
    };
    fetchLayouts();

  }, [currentBranch]);

  const activeLayout = branchLayouts.find(l => l.id === currentLayoutId) || branchLayouts[0];


  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = !filterCategory || p.category === filterCategory;
      return matchSearch && matchCat;
    });
  }, [products, searchTerm, filterCategory]);

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.subtotal, 0), [cart]);

  const handleSaleClose = useCallback((cartItem) => {
    if (cartItem && cartItem.id) {
      setCart((prev) => {
        const existingId = prev.findIndex(item => item.id === cartItem.id);
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

  const handleRemoveFromCart = (index) => setCart((prev) => prev.filter((_, i) => i !== index));

  const processCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessingSale(true);
    try {
      const items = cart.map(item => ({
        product_id: item.id,
        quantity: item.quantityBoxes, // Assuming we deduct boxes from stock
        price: item.subtotal / (item.quantityBoxes || 1) // Approx unit price per box
      }));
      
      const { error } = await supabase.rpc('process_sale', {
        p_branch_id: currentBranch.id,
        p_items: items,
        p_total: cartTotal
      });

      if (error) throw error;

      toast.success('¡Venta completada con éxito!');
      setCart([]);
      setIsCheckoutPanelOpen(false);
      onBack(); // Return to history after sale
    } catch (error) {
      console.error("Error processing checkout:", error);
      toast.error("Ocurrió un error al procesar el pago: " + error.message);
    } finally {
      setIsProcessingSale(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-1 relative overflow-hidden h-full">
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <div className="bg-white border-b border-slate-200 px-6 lg:px-10 py-4 sticky top-0 z-20">
            <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <button onClick={onBack} className="size-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">Nueva Venta</h1>
                  <p className="text-slate-500 text-xs">Seleccione productos para agregar al carrito</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                 {branchLayouts.length > 1 && (
                     <select 
                         value={currentLayoutId || ''}
                         onChange={(e) => setCurrentLayoutId(e.target.value)}
                         className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/50"
                     >
                         {branchLayouts.map(l => (
                             <option key={l.id} value={l.id}>{l.name}</option>
                         ))}
                     </select>
                 )}
                 <button onClick={() => setIsCheckoutPanelOpen(!isCheckoutPanelOpen)} className={`flex items-center gap-3 border rounded-2xl px-5 py-3 transition-colors ${cart.length > 0 ? 'bg-primary text-white border-primary/20 shadow-md shadow-primary/20 hover:bg-primary/90' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}>
                    <div className="relative">
                      <span className="material-symbols-outlined shrink-0 text-xl">shopping_cart</span>
                      {cart.length > 0 && <span className="absolute -top-1.5 -right-1.5 size-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{cart.length}</span>}
                    </div>
                    <div className="text-left hidden sm:block">
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Mi Carrito</p>
                      <p className="font-black leading-none">S/ {cartTotal.toFixed(2)}</p>
                    </div>
                 </button>
              </div>
            </div>
          </div>
          <div className="bg-slate-50/80 border-b border-slate-100 px-6 lg:px-10 py-4 sticky top-[105px] z-10 backdrop-blur-md">
            <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar producto o SKU..." className="w-full pl-10 pr-4 h-11 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none" />
              </div>
              {categories.length > 0 && (
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="h-11 bg-white border border-slate-200 rounded-xl px-4 text-sm text-slate-600 focus:ring-2 focus:ring-primary focus:border-transparent outline-none">
                  <option value="">Todas las categorías</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          </div>
          <div className="flex-1 px-6 lg:px-10 py-8">
            <div className="max-w-screen-xl mx-auto">
              {loading ? (
                <div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span></div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <span className="material-symbols-outlined text-5xl mb-3">inventory_2</span>
                  <p className="font-semibold">No se encontraron productos.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest mb-4">{filtered.length} productos encontrados</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                    {filtered.map((p) => <ProductCard key={p.id} product={p} onSell={setSelectedProduct} />)}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <aside className={`h-full bg-white border-l border-slate-200 transition-all duration-300 ease-in-out flex flex-col z-30 ${isCheckoutPanelOpen ? 'w-full sm:w-[400px] opacity-100' : 'w-0 opacity-0 pointer-events-none'} fixed right-0 top-0 sm:sticky sm:top-0 h-screen sm:h-auto`}>
          <div className="bg-slate-50 border-b border-slate-200 p-6 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary"><span className="material-symbols-outlined text-xl">shopping_cart_checkout</span></div>
              <div><h3 className="font-bold text-slate-900">Carrito de Ventas</h3><p className="text-xs text-slate-500">{cart.length} productos</p></div>
            </div>
            <button onClick={() => setIsCheckoutPanelOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-200 transition-colors"><span className="material-symbols-outlined text-xl">close</span></button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3"><span className="material-symbols-outlined text-5xl">shopping_basket</span><p className="font-medium">Tu carrito está vacío</p></div>
            ) : (
              cart.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-3 py-4 border-b border-slate-100 last:border-0 relative group">
                  <button onClick={() => handleRemoveFromCart(idx)} className="absolute top-4 right-0 text-slate-300 hover:text-rose-500 transition-colors p-1"><span className="material-symbols-outlined text-lg">delete</span></button>
                  <div className="pr-8"><h4 className="font-bold text-slate-800 leading-tight">{item.name}</h4><p className="text-xs text-slate-500">{item.sku}</p></div>
                  <div className="flex justify-between items-end">
                    <p className="text-xs font-semibold text-slate-600 bg-slate-100 py-1 px-2 rounded-lg inline-flex items-center gap-1 w-fit">
                      {item.saleMode === 'cajas' ? <><span className="material-symbols-outlined text-[14px]">inventory_2</span> {item.quantityBoxes} cjs</> : <><span className="material-symbols-outlined text-[14px]">view_module</span> {item.quantityUnits} und</>}
                    </p>
                    <p className="text-lg font-black text-slate-900">S/ {item.subtotal.toFixed(2)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="bg-white border-t border-slate-200 p-6 flex flex-col gap-4 shrink-0">
            <div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-medium">Subtotal</span><span className="font-bold text-slate-800">S/ {cartTotal.toFixed(2)}</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-900 font-bold uppercase tracking-wider">Total a Pagar</span><span className="text-2xl font-black text-primary">S/ {cartTotal.toFixed(2)}</span></div>
            <button onClick={processCheckout} disabled={cart.length === 0 || isProcessingSale} className="w-full mt-2 py-4 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none flex justify-center items-center gap-2">
              {isProcessingSale ? <><span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span> Procesando...</> : <><span className="material-symbols-outlined text-[20px]">payments</span> Procesar Venta</>}
            </button>
          </div>
        </aside>
      </div>
      {selectedProduct && <SaleModal product={selectedProduct} currentUser={currentUser} currentBranch={currentBranch} branchLayout={activeLayout} onClose={handleSaleClose} />}
    </div>
  );
};

/* ─── Sale Detail Modal ─── */
const SaleDetailModal = ({ sale, onClose }) => {
  if (!sale) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">receipt_long</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 leading-tight">Detalle de Venta</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{sale.date?.toDate().toLocaleString()}</p>
            </div>
          </div>
          <button onClick={onClose} className="size-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex justify-between items-center mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
             <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Vendido por</p>
                <p className="font-semibold text-slate-700">{sale.user}</p>
             </div>
             <div className="text-right">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Venta</p>
                <p className="text-2xl font-black text-primary">S/ {Number(sale.totalValue).toFixed(2)}</p>
             </div>
          </div>
          <h4 className="text-sm font-bold text-slate-900 mb-3">Productos Vendidos</h4>
          <div className="space-y-3">
            {sale.items?.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                <div>
                  <p className="font-bold text-slate-800">{item.productName}</p>
                  <p className="text-xs text-slate-500">
                    {item.saleMode === 'cajas' ? `${item.quantitySoldBoxes} cajas` : `${item.quantitySoldUnits} unidades`}
                  </p>
                </div>
                <p className="font-bold text-slate-900">S/ {Number(item.subtotal).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="p-6 border-t border-slate-100 bg-slate-50">
           <button onClick={onClose} className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-all">Cerrar Detalle</button>
        </div>
      </div>
    </div>
  );
};

/* ─── Sales List (History) ─── */
const SalesList = ({ onNewSale }) => {
  const { currentBranch } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState(null);
  
  // Date Filters
  const [dateFilter, setDateFilter] = useState('today'); // 'today', 'week', 'month', 'custom'
  const [customStartDate, setCustomStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!currentBranch) return;
    setLoading(true);
    
    let start = new Date();
    let end = new Date();
    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);

    if (dateFilter === 'today') {
       // already set
    } else if (dateFilter === 'week') {
       const day = start.getDay() || 7; 
       start.setDate(start.getDate() - (day - 1));
    } else if (dateFilter === 'month') {
       start.setDate(1);
    } else if (dateFilter === 'custom') {
        const partsS = customStartDate.split('-');
        start = new Date(partsS[0], partsS[1]-1, partsS[2], 0, 0, 0, 0);
        
        const partsE = customEndDate.split('-');
        end = new Date(partsE[0], partsE[1]-1, partsE[2], 23, 59, 59, 999);
    }

    // Fetch from 'sales' table with joined transactions or items
    const fetchSales = async () => {
        try {
            const { data, error } = await supabase
                .from('sales')
                .select(`
                    id,
                    total_amount,
                    created_at,
                    user_id,
                    transactions (
                        id,
                        product_id,
                        quantity,
                        amount,
                        products!transactions_product_id_fkey ( name )
                    ),
                    profiles!sales_user_id_fkey ( email, full_name )
                `)
                .eq('branch_id', currentBranch.id)
                .gte('created_at', start.toISOString())
                .lte('created_at', end.toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mappedSales = data.map(s => ({
                id: s.id,
                totalValue: s.total_amount,
                date: { toDate: () => new Date(s.created_at) },
                user: s.profiles?.full_name || s.profiles?.email || 'Desconocido',
                items: s.transactions.map(t => ({
                    productName: t.products?.name || 'Desconocido',
                    quantitySoldBoxes: t.quantity, // Assumption based on RPC logic
                    subtotal: t.amount,
                    saleMode: 'cajas' // Simplified for list view
                }))
            }));
            
            setSales(mappedSales);
        } catch (err) {
            console.error(err);
            toast.error("Error al cargar ventas.");
        } finally {
            setLoading(false);
        }
    };
    
    fetchSales();

  }, [currentBranch, dateFilter, customStartDate, customEndDate]);

  const kpis = useMemo(() => {
    let totalVal = 0;
    let totalItems = 0;
    sales.forEach(s => {
      totalVal += Number(s.totalValue) || 0;
      s.items?.forEach(i => {
         totalItems += (Number(i.quantitySoldBoxes) || 0) + (Number(i.quantitySoldUnits) || 0);
      });
    });
    return { totalVal, totalCount: sales.length, totalItems };
  }, [sales]);

  const handleGeneratePDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Reporte de Ventas', 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(100);
    const dateText = dateFilter === 'custom' 
      ? `Del ${customStartDate} al ${customEndDate}`
      : `Filtro: ${dateFilter === 'today' ? 'Hoy' : dateFilter === 'week' ? 'Esta Semana' : 'Este Mes'}`;
    doc.text(dateText, 14, 30);

    const tableColumn = ["Fecha", "Vendedor", "Items", "Total (S/)"];
    const tableRows = sales.map(sale => [
      sale.date.toDate().toLocaleDateString() + ' ' + sale.date.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      sale.user,
      sale.items.length,
      Number(sale.totalValue).toFixed(2)
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 185, 129] }, // Primary green
    });

    doc.save(`reporte_ventas_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-10 py-6">
        <div className="max-w-screen-xl mx-auto flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Reporte de Ventas</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Resumen y métricas clave</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleGeneratePDF} className="px-6 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2">
                <span className="material-symbols-outlined">picture_as_pdf</span>
                Exportar PDF
              </button>
              <button onClick={onNewSale} className="px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2">
                <span className="material-symbols-outlined">add</span>
                Nueva Venta
              </button>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'today', label: 'Hoy' },
              { id: 'week', label: 'Esta Semana' },
              { id: 'month', label: 'Este Mes' },
              { id: 'custom', label: 'Personalizado' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dateFilter === f.id ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                {f.label}
              </button>
            ))}
            
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2 ml-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="bg-white dark:bg-slate-700 border-none rounded-md text-sm p-1.5 focus:ring-0 dark:text-white" />
                <span className="text-slate-400 text-xs font-bold">A</span>
                <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="bg-white dark:bg-slate-700 border-none rounded-md text-sm p-1.5 focus:ring-0 dark:text-white" />
              </div>
            )}
          </div>
          
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-800/50">
               <p className="text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">Ventas Totales</p>
               <p className="text-3xl font-black text-indigo-900 dark:text-indigo-200">S/ {kpis.totalVal.toFixed(2)}</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-5 border border-emerald-100 dark:border-emerald-800/50">
               <p className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">Transacciones</p>
               <p className="text-3xl font-black text-emerald-900 dark:text-emerald-200">{kpis.totalCount}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-5 border border-amber-100 dark:border-amber-800/50">
               <p className="text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">Items Vendidos</p>
               <p className="text-3xl font-black text-amber-900 dark:text-amber-200">{kpis.totalItems}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="max-w-screen-xl mx-auto">
          {loading ? (
             <div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span></div>
          ) : sales.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-10">
                <span className="material-symbols-outlined text-6xl mb-4 bg-slate-100 dark:bg-slate-800 p-4 rounded-full">event_busy</span>
                <p className="font-bold text-lg text-slate-700 dark:text-slate-200">No hay ventas en este periodo</p>
                <p className="text-sm mt-1">Intenta cambiar el filtro de fechas</p>
             </div>
          ) : (
             <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      <tr>
                        <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Fecha</th>
                        <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs">Vendedor</th>
                        <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs text-center">Items</th>
                        <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs text-right">Total</th>
                        <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider text-xs text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {sales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => setSelectedSale(sale)}>
                          <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {sale.date?.toDate ? sale.date.toDate().toLocaleDateString() + ' ' + sale.date.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Fecha inválida'}
                          </td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{sale.user}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300">
                              {sale.items?.length || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white">S/ {Number(sale.totalValue).toFixed(2)}</td>
                          <td className="px-6 py-4 text-center">
                            <button onClick={(e) => { e.stopPropagation(); setSelectedSale(sale); }} className="size-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-primary transition-all">
                              <span className="material-symbols-outlined text-[20px]">visibility</span>
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
      <SaleDetailModal sale={selectedSale} onClose={() => setSelectedSale(null)} />
    </div>
  );
};

/* ─── Main Component ─── */
const Sales = () => {
  const [view, setView] = useState('list'); // 'list' | 'pos'

  return (
    <AppLayout>
      {view === 'pos' ? (
        <POSView onBack={() => setView('list')} />
      ) : (
        <SalesList onNewSale={() => setView('pos')} />
      )}
    </AppLayout>
  );
};

export default Sales;
