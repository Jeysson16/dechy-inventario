import { collection, doc, onSnapshot, orderBy, query, where, writeBatch } from 'firebase/firestore';
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

  const wPrice = Number(product.wholesalePrice) || 0;
  const wThreshold = Number(product.wholesaleThreshold) || 0;
  const wUnit = product.wholesaleThresholdUnit || 'cajas';

  let isWholesale = false;
  if (wPrice > 0 && wThreshold > 0) {
    const currentQtyInThresholdUnit = mode === wUnit ? q : (mode === 'cajas' ? q * upb : q / upb);
    if (currentQtyInThresholdUnit >= wThreshold) {
      isWholesale = true;
    }
  }

  const activeUnitPrice = isWholesale ? wPrice : (Number(product.unitPrice) || 0);
  const activeBoxPrice = isWholesale ? (wPrice * upb) : (Number(product.boxPrice) || 0);

  if (mode === 'cajas') {
    return {
      boxesDeducted: q,
      totalUnits: q * upb,
      fullBoxes: q,
      remainderUnits: 0,
      subtotal: q * activeBoxPrice,
      isWholesale,
      activePrice: activeBoxPrice
    };
  }

  // mode === 'unidades'
  const fullBoxes = Math.floor(q / upb);
  const remainderUnits = q % upb;
  const boxesDeducted = fullBoxes; 
  const subtotal =
    fullBoxes * activeBoxPrice +
    remainderUnits * activeUnitPrice;

  return { boxesDeducted, totalUnits: q, fullBoxes, remainderUnits, subtotal, isWholesale, activePrice: activeUnitPrice };
};

/* ─── Sale Modal ─── */
const SaleModal = ({ product, onClose, branchLayout }) => {
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('cajas');
  const [qty, setQty] = useState('');
  const [distribution, setDistribution] = useState({});

  const relevantLocations = useMemo(() => {
    if (!branchLayout) return {};
    const locs = {};
    Object.entries(product.locations || {}).forEach(([key, qty]) => {
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





  const handleConfirm = async () => {
    if (!isStep1Valid) return;
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
        isWholesale: calc.isWholesale,
        activePrice: calc.activePrice
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



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh] transition-all duration-500 ease-out" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
             {product.imageUrl ? (
              <img src={product.imageUrl} className="size-10 rounded-lg object-cover border border-slate-200" />
            ) : (
              <div className="size-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                <span className="material-symbols-outlined text-[20px]">inventory_2</span>
              </div>
            )}
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white leading-tight line-clamp-1">{product.name}</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{product.sku}</p>
            </div>
          </div>
          <button onClick={onClose} className="size-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 max-w-sm mx-auto">
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
              <button onClick={() => { setMode('cajas'); setQty(''); }} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'cajas' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                Por Cajas
              </button>
              <button onClick={() => { setMode('unidades'); setQty(''); }} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'unidades' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                <span className="material-symbols-outlined text-[18px]">view_module</span>
                Por Unidades
              </button>
            </div>
            <div className="flex flex-col items-center gap-4">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ingrese Cantidad</label>
              <div className="flex items-center gap-4">
                <button onClick={() => handleAdjustQty(-1)} className="size-12 rounded-2xl border-2 border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all text-slate-600 dark:text-slate-400"><span className="material-symbols-outlined">remove</span></button>
                <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" className="w-32 h-16 text-4xl font-black text-center bg-transparent border-b-2 border-slate-200 dark:border-slate-800 focus:border-primary outline-none text-slate-900 dark:text-white placeholder-slate-200 dark:placeholder-slate-800 transition-colors" autoFocus />
                <button onClick={() => handleAdjustQty(1)} className="size-12 rounded-2xl border-2 border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all text-slate-600 dark:text-slate-400"><span className="material-symbols-outlined">add</span></button>
              </div>
              <p className="text-xs text-slate-400 font-medium">Disponible: {maxStock} {mode}</p>
            </div>
            {calc && (
              <div className={`rounded-2xl p-4 border flex items-center justify-between transition-colors ${calc.isWholesale ? 'bg-primary/10 border-primary/20' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'}`}>
                <div>
                  <div className="flex items-center gap-2">
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Estimado</p>
                     {calc.isWholesale && (
                       <span className="bg-primary text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Precio Mayor</span>
                     )}
                  </div>
                  <p className={`text-2xl font-black ${calc.isWholesale ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>S/ {calc.subtotal.toFixed(2)}</p>
                  {calc.isWholesale && (
                    <p className="text-[10px] text-primary/70 font-bold italic">Aplicado: S/ {calc.activePrice.toFixed(2)} / {mode === 'cajas' ? 'caja' : 'unid'}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Retiro Físico</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{calc.fullBoxes} Cajas + {calc.remainderUnits} Unid.</p>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
          <button onClick={handleConfirm} disabled={!isStep1Valid || saving} className="flex-1 py-3.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none active:scale-95 flex items-center justify-center gap-2">
            {saving ? <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span> : <span className="material-symbols-outlined text-[20px]">check</span>}
            {saving ? 'Procesando...' : 'Agregar al Carrito'}
          </button>
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
  const statusStyle = isOut ? 'bg-red-100 text-red-700' : stock <= 10 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';

  return (
    <div className={`flex flex-col bg-white dark:bg-slate-900 rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${isOut ? 'border-red-200 dark:border-red-900/50 opacity-70' : 'border-slate-200 dark:border-slate-800'}`}>
      <div className="relative w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
        {product.imageUrl ? (
          <img src={product.imageUrl} className="w-full h-full object-cover" />
        ) : (
          <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-700">image</span>
        )}
        <span className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${statusStyle}`}>
          {isOut ? 'Agotado' : stock <= 10 ? 'Stock Bajo' : 'Disponible'}
        </span>
      </div>
      <div className="flex flex-col flex-1 p-5 gap-3">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white leading-tight line-clamp-2">{product.name}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">{product.sku} · {product.category}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs py-3 border-y border-slate-100 dark:border-slate-800">
          <div className="flex flex-col"><span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter">Precio Unit.</span><span className="text-slate-800 dark:text-slate-200 font-bold">S/ {Number(product.unitPrice || product.price || 0).toFixed(2)}</span></div>
          <div className="flex flex-col"><span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter">Precio Caja</span><span className="text-slate-800 dark:text-slate-200 font-bold">S/ {Number(product.boxPrice || 0).toFixed(2)}</span></div>
          {Number(product.wholesalePrice) > 0 && (
            <div className="flex flex-col col-span-2 mt-1 py-1 px-2 bg-primary/5 rounded border border-primary/10">
              <div className="flex justify-between items-center">
                <span className="text-primary font-black uppercase tracking-tighter text-[9px]">Precio Mayor</span>
                <span className="text-primary font-black">S/ {Number(product.wholesalePrice).toFixed(2)}</span>
              </div>
              <p className="text-[8px] text-slate-400 font-bold uppercase">Desde {product.wholesaleThreshold} {product.wholesaleThresholdUnit}</p>
            </div>
          )}
          <div className="flex flex-col"><span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter">Und. / Caja</span><span className="text-slate-800 dark:text-slate-200 font-bold">{upb} unds.</span></div>
          <div className="flex flex-col"><span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter">Stock</span><span className={`font-bold ${isOut ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>{stock} caja{stock !== 1 ? 's' : ''}</span></div>
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
  const { currentUser, currentBranch, userProfile } = useAuth();
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
    const q = query(collection(db, 'products'), where('branch', '==', currentBranch.id));
    const productUnsub = onSnapshot(q, (snap) => {
      const data = [];
      snap.forEach((d) => data.push({ id: d.id, ...d.data() }));
      setProducts(data);
      setLoading(false);
    });
    const branchDocRef = doc(db, 'branches', currentBranch.id);
    const branchUnsub = onSnapshot(branchDocRef, (snap) => {
      if (snap.exists()) {
          const data = snap.data();
          let loadedLayouts = [];
          if (data.layouts && Array.isArray(data.layouts)) {
              loadedLayouts = data.layouts;
          } else if (data.layout) {
              loadedLayouts = [{ id: 'main', name: 'Principal', ...data.layout }];
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
      const saleDate = new Date();
      const saleRef = doc(collection(db, 'sales'));
      const saleData = {
        branchId: currentBranch?.id,
        sellerId: currentUser?.uid,
        sellerName: userProfile?.name || currentUser?.displayName || currentUser?.email || 'Unknown',
        totalValue: cartTotal,
        date: saleDate,
        status: 'pending_payment',
        ticketNumber: `TKT-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
        items: cart.map(item => ({
          productId: item.id,
          productName: item.name,
          sku: item.sku,
          quantitySoldUnits: item.quantityUnits,
          quantitySoldBoxes: item.quantityBoxes,
          remainderUnits: item.remainderUnits,
          fullBoxes: item.fullBoxes,
          saleMode: item.saleMode,
          subtotal: item.subtotal,
          unitPrice: item.unitPrice,
          boxPrice: item.boxPrice,
          wholesalePrice: item.wholesalePrice,
          unitsPerBox: item.unitsPerBox,
          isWholesale: item.isWholesale || false,
          activePrice: item.activePrice || 0,
          locations: item.locations || {}
        }))
      };

      await writeBatch(db).set(saleRef, saleData).commit();
      
      toast.success('Ticket generado. Por favor, proceda a caja para el pago.');
      setCart([]);
      setIsCheckoutPanelOpen(false);
      onBack(); 
    } catch (error) {
      console.error("Error processing checkout:", error);
      toast.error("Ocurrió un error al generar el ticket.");
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
                <button onClick={onBack} className="size-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 transition-colors">
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div>
                  <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Nueva Venta</h1>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">Seleccione productos para agregar al carrito</p>
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
                 <button onClick={() => setIsCheckoutPanelOpen(!isCheckoutPanelOpen)} className={`flex items-center gap-3 border rounded-2xl px-5 py-3 transition-colors ${cart.length > 0 ? 'bg-primary text-white border-primary/20 shadow-md shadow-primary/20 hover:bg-primary/90' : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <div className="relative">
                      <span className="material-symbols-outlined shrink-0 text-xl">shopping_cart</span>
                      {cart.length > 0 && <span className="absolute -top-1.5 -right-1.5 size-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{cart.length}</span>}
                    </div>
                    <div className="text-left hidden sm:block">
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Mi Carrito</p>
                      <p className="font-black leading-none dark:text-white">S/ {cartTotal.toFixed(2)}</p>
                    </div>
                 </button>
              </div>
            </div>
          </div>
          <div className="bg-slate-50/80 dark:bg-slate-950/80 border-b border-slate-100 dark:border-slate-900 px-6 lg:px-10 py-4 sticky top-[105px] z-10 backdrop-blur-md">
            <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar producto o SKU..." className="w-full pl-10 pr-4 h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-slate-900 dark:text-white" />
              </div>
              {categories.length > 0 && (
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 text-sm text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none">
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
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-widest mb-4">{filtered.length} productos encontrados</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                    {filtered.map((p) => <ProductCard key={p.id} product={p} onSell={setSelectedProduct} />)}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <aside className={`h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out flex flex-col z-30 ${isCheckoutPanelOpen ? 'w-full sm:w-[400px] opacity-100' : 'w-0 opacity-0 pointer-events-none'} fixed right-0 top-0 sm:sticky sm:top-0 h-screen sm:h-auto`}>
          <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary"><span className="material-symbols-outlined text-xl">shopping_cart_checkout</span></div>
              <div><h3 className="font-bold text-slate-900 dark:text-white">Carrito de Ventas</h3><p className="text-xs text-slate-500 dark:text-slate-400">{cart.length} productos</p></div>
            </div>
            <button onClick={() => setIsCheckoutPanelOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><span className="material-symbols-outlined text-xl">close</span></button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3"><span className="material-symbols-outlined text-5xl">shopping_basket</span><p className="font-medium">Tu carrito está vacío</p></div>
            ) : (
              cart.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-3 py-4 border-b border-slate-100 dark:border-slate-800 last:border-0 relative group">
                  <button onClick={() => handleRemoveFromCart(idx)} className="absolute top-4 right-0 text-slate-300 dark:text-slate-600 hover:text-rose-500 transition-colors p-1"><span className="material-symbols-outlined text-lg">delete</span></button>
                  <div className="pr-8"><h4 className="font-bold text-slate-800 dark:text-slate-200 leading-tight">{item.name}</h4><p className="text-xs text-slate-500 dark:text-slate-400">{item.sku}</p></div>
                  <div className="flex justify-between items-end">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 py-1 px-2 rounded-lg inline-flex items-center gap-1 w-fit">
                      {item.saleMode === 'cajas' ? <><span className="material-symbols-outlined text-[14px]">inventory_2</span> {item.quantityBoxes} cjs</> : <><span className="material-symbols-outlined text-[14px]">view_module</span> {item.quantityUnits} und</>}
                    </p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">S/ {item.subtotal.toFixed(2)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-4 shrink-0">
            <div className="flex justify-between items-center text-sm"><span className="text-slate-500 dark:text-slate-400 font-medium">Subtotal</span><span className="font-bold text-slate-800 dark:text-slate-200">S/ {cartTotal.toFixed(2)}</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-900 dark:text-white font-bold uppercase tracking-wider">Total a Pagar</span><span className="text-2xl font-black text-primary">S/ {cartTotal.toFixed(2)}</span></div>
            <button onClick={processCheckout} disabled={cart.length === 0 || isProcessingSale} className="w-full mt-2 py-4 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:shadow-none flex justify-center items-center gap-2">
              {isProcessingSale ? <><span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span> Procesando...</> : <><span className="material-symbols-outlined text-[20px]">payments</span> Procesar Venta</>}
            </button>
          </div>
        </aside>
      </div>
      {selectedProduct && <SaleModal product={selectedProduct} currentUser={currentUser} currentBranch={currentBranch} branchLayout={activeLayout} onClose={handleSaleClose} />}
    </div>
  );
};

/* ─── Sale Detail Content ─── */
const SaleDetailContent = ({ sale, handleDeliver, setViewingLayoutItem, isUpdating }) => (
  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-8 shadow-inner animate-in slide-in-from-top-4 duration-300">
    <div className="flex flex-col md:flex-row justify-between items-start gap-8">
      <div className="flex-1 space-y-6">
        <div>
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Productos Vendidos</h4>
          <div className="grid grid-cols-1 gap-3">
            {sale.items?.map((item, idx) => {
              const normalTotal = item.saleMode === 'cajas' ? ((Number(item.quantitySoldBoxes) || 0) * (Number(item.boxPrice) || 0)) : ((Number(item.quantitySoldUnits) || 0) * (Number(item.unitPrice) || 0));
              const discount = normalTotal > (Number(item.subtotal) || 0) + 0.01 ? normalTotal - Number(item.subtotal) : 0;
              return (
                <div key={idx} onClick={() => setViewingLayoutItem(item)} className="group cursor-pointer flex justify-between items-center p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-primary/40 hover:shadow-lg transition-all duration-300">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                       <p className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-primary transition-colors text-sm uppercase">{item.productName}</p>
                       <span className="material-symbols-outlined text-[16px] text-slate-300 group-hover:text-primary">location_on</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                       <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded uppercase tracking-wider">
                         {item.saleMode === 'cajas' ? `${item.quantitySoldBoxes} CAJAS` : `${item.quantitySoldUnits} UNID.`}
                       </p>
                       {item.isWholesale && <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded uppercase tracking-wider">Precio Mayor</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900 dark:text-white">S/ {Number(item.subtotal).toFixed(2)}</p>
                    {discount > 0.01 && <p className="text-[9px] text-emerald-500 font-bold mt-0.5">Ahorro: S/ {discount.toFixed(2)}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="w-full md:w-80 space-y-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vendedor</p>
            <p className="font-bold text-slate-800 dark:text-slate-200">{sale.userName || sale.sellerName || 'Desconocido'}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha y Hora</p>
            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm italic opacity-70">{sale.date?.toDate().toLocaleString()}</p>
          </div>
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total del Ticket</p>
            <p className="text-3xl font-black text-primary italic">S/ {Number(sale.totalValue).toFixed(2)}</p>
          </div>
        </div>

        {sale.status === 'pending_delivery' && (
           <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-indigo-600/20">
             <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2 text-center">Acción Pendiente</p>
             <button 
               onClick={handleDeliver}
               disabled={isUpdating}
               className="w-full py-4 rounded-2xl bg-white text-indigo-700 font-black text-xs uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
             >
               {isUpdating ? (
                 <span className="material-symbols-outlined animate-spin">progress_activity</span>
               ) : (
                 <>
                   <span className="material-symbols-outlined">check_circle</span>
                   Confirmar Entrega
                 </>
               )}
             </button>
           </div>
        )}
      </div>
    </div>
  </div>
);

/* ─── Sales List (History) ─── */
const SalesList = ({ onNewSale }) => {
  const { currentBranch } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [branchLayouts, setBranchLayouts] = useState([]);
  
  // Date Filters
  const [dateFilter, setDateFilter] = useState('today'); // 'today', 'week', 'month', 'custom'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending_payment', 'pending_delivery', 'completed'
  const [customStartDate, setCustomStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [viewingLayoutItem, setViewingLayoutItem] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!currentBranch) return;
    const branchDocRef = doc(db, 'branches', currentBranch.id);
    const branchUnsub = onSnapshot(branchDocRef, (snap) => {
      if (snap.exists()) {
          const data = snap.data();
          let loadedLayouts = [];
          if (data.layouts && Array.isArray(data.layouts)) {
              loadedLayouts = data.layouts;
          } else if (data.layout) {
              loadedLayouts = [{ id: 'main', name: 'Principal', ...data.layout }];
          }
          setBranchLayouts(loadedLayouts);
      }
    });
    return () => branchUnsub();
  }, [currentBranch]);

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

    const queryConstraints = [
      where('branchId', '==', currentBranch.id)
    ];

    // Only apply date filter if status filter is 'all' or specifically requested
    if (statusFilter === 'all' || dateFilter !== 'today') {
       queryConstraints.push(where('date', '>=', start));
       queryConstraints.push(where('date', '<=', end));
    }

    if (statusFilter !== 'all') {
      queryConstraints.push(where('status', '==', statusFilter));
    }

    const q = query(
      collection(db, 'sales'),
      ...queryConstraints,
      orderBy('date', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setSales(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching sales:", error);
      if (error.code === 'failed-precondition') {
        toast.error("Es necesario crear un índice en Firestore para esta combinación de filtros.", { duration: 5000 });
      } else {
        toast.error("Error al cargar ventas.");
      }
      setLoading(false);
    });
    return () => unsub();
  }, [currentBranch, dateFilter, statusFilter, customStartDate, customEndDate]);

  const filteredSales = useMemo(() => {
    return sales.filter(s => 
      s.ticketNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sales, searchTerm]);

  const kpis = useMemo(() => {
    let totalVal = 0;
    let totalItems = 0;
    filteredSales.forEach(s => {
      totalVal += Number(s.totalValue) || 0;
      s.items?.forEach(i => {
         totalItems += (Number(i.quantitySoldBoxes) || 0) + (Number(i.quantitySoldUnits) || 0);
      });
    });
    return { totalVal, totalCount: filteredSales.length, totalItems };
  }, [filteredSales]);

  const handleDeliver = async (sale) => {
    if (!window.confirm('¿Confirmar que esta venta ha sido entregada?')) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'sales', sale.id), {
        status: 'completed',
        deliveredAt: new Date()
      });
      toast.success('Venta marcada como entregada.');
      setExpandedSaleId(null);
    } catch (error) {
       console.error("Error delivering sale:", error);
       toast.error("Error al marcar como entregada.");
    } finally {
       setIsUpdating(false);
    }
  };

  const toggleExpand = (sale) => {
    setExpandedSaleId(expandedSaleId === sale.id ? null : sale.id);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-10 py-6">
        <div className="max-w-screen-xl mx-auto flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">Reporte de Ventas</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">Resumen general y métricas de transacciones</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative group min-w-[240px]">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
                <input 
                  type="text" 
                  placeholder="Buscar Ticket..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
                />
              </div>

              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl shadow-inner">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`size-10 rounded-xl flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <span className="material-symbols-outlined">grid_view</span>
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`size-10 rounded-xl flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <span className="material-symbols-outlined">view_list</span>
                </button>
              </div>

              <button onClick={onNewSale} className="px-6 py-3.5 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest active:scale-95">
                <span className="material-symbols-outlined">add_circle</span>
                Nueva Venta
              </button>
            </div>
          </div>
          
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
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dateFilter === f.id ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750'}`}
              >
                {f.label}
              </button>
            ))}
            
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2 ml-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="bg-white dark:bg-slate-900 border-none rounded-md text-sm p-1.5 focus:ring-0 text-slate-900 dark:text-white" />
                <span className="text-slate-400 dark:text-slate-500 text-xs font-bold">A</span>
                <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="bg-white dark:bg-slate-900 border-none rounded-md text-sm p-1.5 focus:ring-0 text-slate-900 dark:text-white" />
              </div>
            )}
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl w-fit">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'pending_payment', label: 'Pdte. Pago' },
              { id: 'pending_delivery', label: 'Por Entregar' },
              { id: 'completed', label: 'Entregadas' },
              { id: 'cancelled', label: 'Canceladas' },
            ].map(s => (
              <button
                key={s.id}
                onClick={() => setStatusFilter(s.id)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${statusFilter === s.id ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-900/30">
               <p className="text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">Ventas Totales</p>
               <p className="text-3xl font-black text-indigo-900 dark:text-indigo-200">S/ {kpis.totalVal.toFixed(2)}</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-5 border border-emerald-100 dark:border-emerald-900/30">
               <p className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">Transacciones</p>
               <p className="text-3xl font-black text-emerald-900 dark:text-emerald-200">{kpis.totalCount}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-5 border border-amber-100 dark:border-amber-900/30">
               <p className="text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">Items Vendidos</p>
               <p className="text-3xl font-black text-amber-900 dark:text-amber-200">{kpis.totalItems}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="max-w-screen-xl mx-auto">
          {loading ? (
             <div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span></div>
          ) : filteredSales.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 shadow-sm p-10 text-center">
                <span className="material-symbols-outlined text-6xl mb-4 bg-slate-100 dark:bg-slate-800 p-6 rounded-full text-slate-300">receipt_long</span>
                <p className="font-bold text-lg text-slate-700 dark:text-slate-300">No se encontraron ventas</p>
                <p className="text-sm mt-1">Pruebe ajustando los filtros o el término de búsqueda</p>
             </div>
          ) : viewMode === 'grid' ? (
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-500">
               {filteredSales.map((sale) => (
                 <div key={sale.id} className="flex flex-col gap-3">
                   <div 
                    onClick={() => toggleExpand(sale)}
                    className={`bg-white dark:bg-slate-900 rounded-3xl border transition-all duration-300 p-6 cursor-pointer group flex flex-col h-full ${expandedSaleId === sale.id ? 'border-primary shadow-xl ring-2 ring-primary/5 translate-y-[-4px]' : 'border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1'}`}
                   >
                     <div className="flex justify-between items-start mb-6">
                        <div className={`size-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${expandedSaleId === sale.id ? 'bg-primary text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:bg-primary group-hover:text-white'}`}>
                          <span className="material-symbols-outlined text-3xl">{expandedSaleId === sale.id ? 'expand_less' : 'receipt'}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Ticket</p>
                          <p className="text-2xl font-black text-slate-900 dark:text-white leading-none uppercase">#{sale.ticketNumber || 'S/N'}</p>
                        </div>
                     </div>
                     <div className="flex-1 space-y-4">
                        <div className="flex justify-between items-end pb-4 border-b border-slate-100 dark:border-slate-800">
                           <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Total Venta</p>
                              <p className="text-2xl font-black text-slate-900 dark:text-white italic">S/ {Number(sale.totalValue).toFixed(2)}</p>
                           </div>
                           <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                             sale.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                             sale.status === 'pending_delivery' ? 'bg-blue-100 text-blue-700' :
                             sale.status === 'pending_payment' ? 'bg-amber-100 text-amber-700' :
                             sale.status === 'cancelled' ? 'bg-rose-100 text-rose-700' :
                             'bg-slate-100 text-slate-700'
                           }`}>
                             {sale.status === 'completed' ? 'Entregado' :
                              sale.status === 'pending_delivery' ? 'En Despacho' :
                              sale.status === 'pending_payment' ? 'En Caja' :
                              sale.status === 'cancelled' ? 'Cancelado' :
                              'Pendiente'}
                           </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                           <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-[16px]">person</span>
                              <span className="truncate max-w-[120px]">{sale.userName || sale.sellerName || 'N/A'}</span>
                           </div>
                           <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                              <span>{sale.date?.toDate().toLocaleDateString()}</span>
                           </div>
                        </div>
                     </div>
                   </div>
                   {expandedSaleId === sale.id && (
                     <SaleDetailContent 
                       sale={sale} 
                       handleDeliver={() => handleDeliver(sale)}
                       setViewingLayoutItem={setViewingLayoutItem}
                       isUpdating={isUpdating}
                     />
                   )}
                 </div>
               ))}
             </div>
          ) : (
             <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                <div className="overflow-x-auto text-sm">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendedor</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredSales.map((sale) => (
                        <React.Fragment key={sale.id}>
                          <tr 
                            onClick={() => toggleExpand(sale)}
                            className={`group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all ${expandedSaleId === sale.id ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
                          >
                            <td className="px-8 py-6">
                              <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight">#{sale.ticketNumber || 'S/N'}</p>
                            </td>
                            <td className="px-8 py-6 whitespace-nowrap">
                              <p className="font-bold text-slate-600 dark:text-slate-400">{sale.date?.toDate().toLocaleDateString()}</p>
                            </td>
                            <td className="px-8 py-6">
                              <p className="font-bold text-slate-700 dark:text-slate-300">{sale.userName || sale.sellerName || 'N/A'}</p>
                            </td>
                            <td className="px-8 py-6">
                               <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                 sale.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                 sale.status === 'pending_delivery' ? 'bg-blue-100 text-blue-700' :
                                 'bg-slate-100 text-slate-700'
                               }`}>
                                 {sale.status === 'completed' ? 'Entregado' : 'Pendiente'}
                               </span>
                            </td>
                            <td className="px-8 py-6 text-right font-black text-slate-900 dark:text-white">S/ {Number(sale.totalValue).toFixed(2)}</td>
                            <td className="px-8 py-6 text-right">
                               <div className="flex items-center justify-end gap-3 transition-transform group-hover:scale-105">
                                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-primary">Ver Detalles</span>
                                 <span className={`material-symbols-outlined text-slate-300 transition-transform ${expandedSaleId === sale.id ? 'rotate-180 text-primary' : ''}`}>expand_more</span>
                               </div>
                            </td>
                          </tr>
                          {expandedSaleId === sale.id && (
                            <tr>
                              <td colSpan="6" className="px-8 py-6 bg-slate-50/30 dark:bg-slate-900/50 border-y border-slate-100 dark:border-slate-800">
                                <SaleDetailContent 
                                  sale={sale} 
                                  handleDeliver={() => handleDeliver(sale)}
                                  setViewingLayoutItem={setViewingLayoutItem}
                                  isUpdating={isUpdating}
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
      </div>

      {/* Global Location Viewer (Map) */}
      {viewingLayoutItem && (() => {
         const activeLayout = branchLayouts.find(l => 
            Object.keys(viewingLayoutItem.locations || {}).some(k => k.startsWith(`${l.id}__`))
         ) || branchLayouts[0];
         
         const quantities = {};
         if (activeLayout) {
             Object.entries(viewingLayoutItem.locations || {}).forEach(([key, qty]) => {
                 if (key.startsWith(`${activeLayout.id}__`)) {
                     quantities[key.replace(`${activeLayout.id}__`, '')] = qty;
                 } else if (!key.includes('__') && (activeLayout.id === 'main' || activeLayout.id === 'default')) {
                     quantities[key] = qty;
                 }
             });
         }

         return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300" onClick={() => setViewingLayoutItem(null)}>
               <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col h-[85vh] transition-all transform animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
                 <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-4">
                      <div className="size-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                        <span className="material-symbols-outlined text-2xl">location_on</span>
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 dark:text-white text-xl leading-tight uppercase tracking-tight">{viewingLayoutItem.productName}</h3>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Mapa de Existencias · {activeLayout?.name || 'VISTA GENERAL'}</p>
                      </div>
                    </div>
                    <button onClick={() => setViewingLayoutItem(null)} className="size-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors">
                      <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                 </div>
                 <div className="flex-1 bg-slate-100/50 dark:bg-slate-950/50 relative overflow-hidden flex items-center justify-center">
                    {activeLayout ? (
                        <div className="w-full h-full flex items-center justify-center p-10 cursor-grab active:cursor-grabbing">
                          <DraggableContainer>
                            <LayoutPreview layout={activeLayout} quantities={quantities} readOnly={true} />
                          </DraggableContainer>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 gap-4">
                          <span className="material-symbols-outlined text-6xl opacity-20">map</span>
                          <p className="font-bold tracking-widest uppercase text-xs">Croquis no disponible</p>
                        </div>
                    )}
                 </div>
               </div>
            </div>
         );
      })()}
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
