import { collection, deleteDoc, doc, getDocs, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/common/DataTable';
import DraggableContainer from '../components/common/DraggableContainer';
import LayoutPreview from '../components/inventory/LayoutPreview';
import AppLayout from '../components/layout/AppLayout';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';

const InventoryList = () => {
  const { currentUser, currentBranch } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'

  // New states for DataTable and filtering
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [categories, setCategories] = useState(['Todos']);
  const [branches, setBranches] = useState([]); // For location rendering in DataTable

  // History Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState(null);
  const [productHistory, setProductHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [branchLayouts, setBranchLayouts] = useState([]);
  const [currentLayoutId, setCurrentLayoutId] = useState(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [selectedProductForLocation, setSelectedProductForLocation] = useState(null);
  const [tempLocations, setTempLocations] = useState({});
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [zoom, setZoom] = useState(1);
  
  // Computed active layout
  const activeLayout = useMemo(() => {
    if (!branchLayouts.length) return null;
    if (currentLayoutId) {
        return branchLayouts.find(l => l.id === currentLayoutId) || branchLayouts[0];
    }
    return branchLayouts[0];
  }, [branchLayouts, currentLayoutId]);

  const fetchProducts = async () => {
    if (!currentBranch) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "products"),
        where("branch", "==", currentBranch.id)
      );

      const querySnapshot = await getDocs(q);
      const productsData = [];
      const uniqueCategories = new Set(['Todos']);
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const currentStock = Number(data.currentStock) || 0;
        const unitsPerBox = Number(data.unitsPerBox) || 1;
        const totalUnits = currentStock * unitsPerBox;
        const minStock = Number(data.minStock) || 0;
        let status = 'Disponible';
        if (totalUnits < 150 && totalUnits > 0) {
          status = 'Stock Bajo';
        } else if (totalUnits === 0) {
          status = 'Agotado';
        }

        productsData.push({ 
          id: doc.id, 
          ...data,
          currentStock,
          minStock,
          status,
          stock: currentStock, // For DataTable
          image: data.imageUrl, // For DataTable
          price: Number(data.unitPrice) || Number(data.price) || 0, // For DataTable
          location: data.branch, // For DataTable
        });
        if (data.category) {
          uniqueCategories.add(data.category);
        }
      });
      setProducts(productsData);
      setCategories(Array.from(uniqueCategories));
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Error al cargar los productos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentBranch) return;

    fetchProducts();

    const q = query(
      collection(db, "products"),
      where("branch", "==", currentBranch.id)
    );

    const unsubscribeProducts = onSnapshot(q, (querySnapshot) => {
      const productsData = [];
      const uniqueCategories = new Set(['Todos']);
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const currentStock = Number(data.currentStock) || 0;
        const unitsPerBox = Number(data.unitsPerBox) || 1;
        const totalUnits = currentStock * unitsPerBox;
        const minStock = Number(data.minStock) || 0;
        let status = 'Disponible';
        if (totalUnits < 150 && totalUnits > 0) {
          status = 'Stock Bajo';
        } else if (totalUnits === 0) {
          status = 'Agotado';
        }

        productsData.push({ 
          id: doc.id, 
          ...data,
          currentStock,
          minStock,
          status,
          stock: currentStock, 
          image: data.imageUrl, 
          price: Number(data.unitPrice) || Number(data.price) || 0,
          location: data.branch,
        });
        if (data.category) {
          uniqueCategories.add(data.category);
        }
      });
      setProducts(productsData);
      setCategories(Array.from(uniqueCategories));
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
            // Legacy support
            loadedLayouts = [{
                id: 'main',
                name: 'Principal',
                ...data.layout
            }];
        }
        setBranchLayouts(loadedLayouts);
        if (loadedLayouts.length > 0 && !currentLayoutId) {
            setCurrentLayoutId(loadedLayouts[0].id);
        }
      }
    });

    const fetchBranches = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "branches"));
        const branchesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setBranches(branchesData);
      } catch (err) {
        console.error("Error fetching branches:", err);
      }
    };
    fetchBranches();

    return () => {
      unsubscribeProducts();
      unsubscribeLayout();
    };
  }, [currentBranch]);

  const metrics = useMemo(() => {
    let totalStock = 0;
    let totalValue = 0;
    let lowStockCount = 0;

    products.forEach(p => {
      const stock = Number(p.currentStock) || 0;
      const unitsPerBox = Number(p.unitsPerBox) || 1;
      const totalUnits = stock * unitsPerBox;
      const price = Number(p.price) || 0;
      totalStock += stock;
      totalValue += stock * price;
      if (totalUnits > 0 && totalUnits < 150) lowStockCount++;
    });

    return { totalStock, totalValue, lowStockCount, totalProducts: products.length };
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'Todos') return products;
    return products.filter(p => p.category === selectedCategory);
  }, [products, selectedCategory]);

  const handleDelete = async (id) => {
    if (window.confirm('¿Está seguro de eliminar este producto?')) {
      try {
        await deleteDoc(doc(db, "products", id));
        toast.success("Producto eliminado correctamente.");
      } catch (error) {
        console.error("Error deleting document: ", error);
        toast.error("Hubo un error al eliminar el producto.");
      }
    }
  };

  const getStatusStyle = (stock, minStock) => {
    if (stock === 0) return 'bg-red-500';
    if (stock <= minStock) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const openHistoryModal = async (product) => {
    setSelectedProductForHistory(product);
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const q = query(
        collection(db, "transactions"),
        where("productId", "==", product.id)
      );
      const querySnapshot = await getDocs(q);
      const txs = [];
      querySnapshot.forEach((doc) => txs.push({ id: doc.id, ...doc.data() }));
      txs.sort((a, b) => (b.date?.toDate() || 0) - (a.date?.toDate() || 0));
      setProductHistory(txs);
    } catch (error) {
      console.error("Error fetching history:", error);
      toast.error('Error al cargar el historial.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const openLocationModal = (product) => {
    setSelectedProductForLocation(product);
    setTempLocations(product.locations || {});
    // Auto-select first layout if not set
    if (!currentLayoutId && branchLayouts.length > 0) {
        setCurrentLayoutId(branchLayouts[0].id);
    }
    setLocationModalOpen(true);
  };

  const getActiveLayoutLocations = () => {
      if (!activeLayout) return {};
      const result = {};
      Object.entries(tempLocations).forEach(([key, qty]) => {
          if (key.startsWith(`${activeLayout.id}__`)) {
              result[key.replace(`${activeLayout.id}__`, '')] = qty;
          } else if (!key.includes('__') && activeLayout.id === (branchLayouts[0]?.id || 'main')) {
              // Backward compatibility for default layout
              result[key] = qty;
          }
      });
      return result;
  };

  const toggleLocation = (shelfIdx, rowIdx, col, levelIdx = 0) => {
    if (!activeLayout) return;
    const baseKey = `${shelfIdx}-${rowIdx}-${levelIdx}-${col}`;
    const legacyKey = `${shelfIdx}-${rowIdx}-${col}`;
    let key = `${activeLayout.id}__${baseKey}`;
    
    // If this is the default layout and we have legacy keys, use legacy key?
    // Let's check if we have a legacy key first.
    if (activeLayout.id === (branchLayouts[0]?.id || 'main')) {
        if (tempLocations[legacyKey] !== undefined && levelIdx === 0) {
            key = legacyKey;
        } else if (!Object.keys(tempLocations).some(k => k.startsWith(`${activeLayout.id}__`))) {
             // If we are starting fresh in default layout, maybe use legacy key to avoid migration?
             // No, let's start using prefix to be clean.
             // But wait, if I have `0-0-1` and I add `main__0-0-2`, it's inconsistent.
             // Let's stick to: if default layout, prefer legacy key format IF it exists, otherwise... 
             // Actually, let's just migrate on write.
             // If I touch a location in default layout, I save it as `main__...` and remove `...`.
        }
    }

    // SIMPLIFICATION:
    // If active layout is the first one, AND the key `baseKey` exists, update it.
    // Else use `activeLayout.id + '__' + baseKey`.
    if (activeLayout.id === branchLayouts[0]?.id && tempLocations[baseKey] !== undefined) {
        key = baseKey;
    }

    setTempLocations(prev => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = 1;
      }
      return next;
    });
  };

  const updateLocationQuantity = (baseKey, qty) => {
    if (!activeLayout) return;
    let key = `${activeLayout.id}__${baseKey}`;
    if (activeLayout.id === branchLayouts[0]?.id && tempLocations[baseKey] !== undefined) {
        key = baseKey;
    }
    
    setTempLocations(prev => ({
      ...prev,
      [key]: qty === '' ? '' : Math.max(0, Number(qty))
    }));
  };

  const saveLocations = async () => {
    if (!selectedProductForLocation) return;
    const totalAssigned = Object.values(tempLocations).reduce((a, b) => a + Number(b), 0);
    if (totalAssigned > selectedProductForLocation.currentStock) {
      toast.error(`No puedes asignar ${totalAssigned} cajas. El stock disponible es de ${selectedProductForLocation.currentStock}.`);
      return;
    }
    setIsSavingLocation(true);
    try {
      await updateDoc(doc(db, "products", selectedProductForLocation.id), {
        locations: tempLocations
      });
      toast.success('Ubicaciones actualizadas.');
      setLocationModalOpen(false);
    } catch (error) {
      console.error("Error updating locations:", error);
      toast.error('Error al guardar ubicaciones.');
    } finally {
      setIsSavingLocation(false);
    }
  };

  const renderKPIs = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 px-6 lg:px-10 mt-6">
      {/* Total Products */}
      <div 
        className="flex flex-col gap-3 rounded-[2rem] p-7 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 shadow-xl shadow-slate-200/40 dark:shadow-none hover:shadow-primary/5 transition-all group hover:-translate-y-1 hover:scale-[1.02]"
      >
        <div className="flex items-center justify-between">
          <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500">
            <span className="material-symbols-outlined text-3xl">inventory_2</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-primary transition-colors">Total Items</span>
        </div>
        <div>
          <p className="text-slate-900 dark:text-white text-4xl font-black tracking-tight">{loading ? "..." : metrics.totalProducts}</p>
          <div className="flex items-center gap-1.5 mt-2 overflow-hidden">
            <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-lg">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Actualizado</span>
          </div>
        </div>
      </div>

      {/* Stock Bajo */}
      <div 
        className="flex flex-col gap-3 rounded-[2rem] p-7 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 shadow-xl shadow-slate-200/40 dark:shadow-none hover:shadow-rose-500/5 transition-all group hover:-translate-y-1 hover:scale-[1.02]"
      >
        <div className="flex items-center justify-between">
          <div className="size-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-all duration-500">
            <span className="material-symbols-outlined text-3xl">warning</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-rose-500 transition-colors">Alertas Stock</span>
        </div>
        <div>
          <p className="text-slate-900 dark:text-white text-4xl font-black tracking-tight">{loading ? "..." : metrics.lowStockCount}</p>
          <div className="flex items-center gap-1.5 mt-2 overflow-hidden">
            <div className="flex items-center gap-1 text-rose-500 text-[10px] font-black uppercase tracking-widest bg-rose-500/10 px-2 py-1 rounded-lg">
              <span className="material-symbols-outlined text-[14px]">priority_high</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Stock Crítico</span>
          </div>
        </div>
      </div>

      {/* Valor Total */}
      <div 
        className="flex flex-col gap-3 rounded-[2rem] p-7 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 shadow-xl shadow-slate-200/40 dark:shadow-none hover:shadow-emerald-500/5 transition-all group hover:-translate-y-1 hover:scale-[1.02]"
      >
        <div className="flex items-center justify-between">
          <div className="size-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500">
            <span className="material-symbols-outlined text-3xl">payments</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-emerald-600 transition-colors">Valor Total</span>
        </div>
        <div>
          <p className="text-slate-900 dark:text-white text-3xl font-black tracking-tight leading-none h-[40px] flex items-end">{loading ? "..." : `S/${(metrics.totalValue / 1000).toFixed(1)}k`}</p>
          <div className="flex items-center gap-1.5 mt-2 overflow-hidden">
            <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-lg">
              <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Estimado Invent.</span>
          </div>
        </div>
      </div>

      {/* Total Cajas */}
      <div 
        className="flex flex-col gap-3 rounded-[2rem] p-7 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 shadow-xl shadow-slate-200/40 dark:shadow-none hover:shadow-indigo-500/5 transition-all group hover:-translate-y-1 hover:scale-[1.02]"
      >
        <div className="flex items-center justify-between">
          <div className="size-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-500">
            <span className="material-symbols-outlined text-3xl">category</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-600 transition-colors">Total Cajas</span>
        </div>
        <div>
          <p className="text-slate-900 dark:text-white text-4xl font-black tracking-tight">{loading ? "..." : metrics.totalStock}</p>
          <div className="flex items-center gap-1.5 mt-2 overflow-hidden">
            <div className="flex items-center gap-1 text-indigo-600 text-[10px] font-black uppercase tracking-widest bg-indigo-500/10 px-2 py-1 rounded-lg">
              <span className="material-symbols-outlined text-[14px]">inventory</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Stock en Almacén</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderGrid = (data = filteredProducts) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {data.map((p, index) => (
        <div 
          key={p.id} 
          className="group flex flex-col bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem] border border-slate-200/50 dark:border-slate-800/50 overflow-hidden shadow-lg shadow-slate-200/40 dark:shadow-none hover:shadow-2xl hover:shadow-primary/10 transition-all duration-700 hover:-translate-y-3 relative"
        >
          {/* Status Badge Over Image */}
          <div className="absolute top-4 left-4 z-10">
            <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest backdrop-blur-md shadow-lg ${
              p.status === 'Disponible' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
              p.status === 'Stock Bajo' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
              p.status === 'Agotado' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' :
              'bg-slate-500/10 text-slate-600 border border-slate-500/20'
            }`}>
              {p.status || 'N/A'}
            </span>
          </div>

          <div className="relative w-full aspect-[1.1/1] overflow-hidden bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            {p.imageUrl ? (
              <img 
                src={p.imageUrl} 
                alt={p.name}
                className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110" 
              />
            ) : (
              <div className="size-24 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300">
                <span className="material-symbols-outlined text-5xl">inventory_2</span>
              </div>
            )}
          </div>

          <div className="p-7 flex flex-col gap-4 flex-1">
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-slate-900 dark:text-white text-lg font-black leading-tight truncate">{p.name}</h3>
                <span className="text-primary text-[10px] font-black uppercase tracking-widest bg-primary/5 px-2 py-1 rounded-lg border border-primary/10">
                  {p.category || 'N/A'}
                </span>
              </div>
              <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest truncate">{p.brand || 'Marca Genérica'}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-100 dark:border-slate-800/50">
              <div className="flex flex-col gap-0.5">
                <span className="text-slate-400 text-[9px] font-black uppercase tracking-tighter">Precio Unit.</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">S/ {p.unitPrice?.toFixed(2) || p.price?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex flex-col gap-0.5 text-right">
                <span className="text-slate-400 text-[9px] font-black uppercase tracking-tighter text-right">Stock Actual</span>
                <span className="text-slate-900 dark:text-white font-black text-sm">{p.currentStock || 0} Cajas</span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-auto pt-2">
              <div className="flex -space-x-2">
                {p.locations && Object.keys(p.locations).length > 0 && activeLayout ? (
                  Object.keys(p.locations).slice(0, 3).map((loc, i) => {
                    const parts = loc.split('-');
                    let displayLabel = loc;
                    if (parts.length === 3) {
                      const [sIdx, rIdx, side] = parts;
                      displayLabel = `${Number(sIdx) + 1}${side}${Number(rIdx) + 1}`;
                    } else if (parts.length === 4) {
                      const [sIdx, rIdx, lIdx, side] = parts;
                      displayLabel = `${Number(sIdx) + 1}${side}${Number(rIdx) + 1}-N${Number(lIdx) + 1}`;
                    }
                    return (
                      <div 
                        key={loc} 
                        className="size-8 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-50 dark:border-slate-900 flex items-center justify-center shadow-sm relative group/loc"
                        title={activeLayout?.customAreaNames?.[loc] || displayLabel}
                      >
                        <span className="material-symbols-outlined text-primary text-sm">location_on</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="size-8 rounded-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-50 dark:border-slate-900 flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined text-slate-300 text-sm">location_off</span>
                  </div>
                )}
                {p.locations && Object.keys(p.locations).length > 3 && (
                  <div className="size-8 rounded-full bg-primary text-white border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-sm">
                    <span className="text-[9px] font-black">+{Object.keys(p.locations).length - 3}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button onClick={() => openLocationModal(p)} className="size-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-primary hover:bg-primary/5 transition-all" title="Gestionar Ubicación">
                  <span className="material-symbols-outlined text-[20px]">location_on</span>
                </button>
                <button onClick={() => openHistoryModal(p)} className="size-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all" title="Historial">
                  <span className="material-symbols-outlined text-[20px]">history</span>
                </button>
                <button onClick={() => navigate(`/editar-producto/${p.id}`)} className="size-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-all" title="Editar">
                  <span className="material-symbols-outlined text-[20px]">edit</span>
                </button>
                <button onClick={() => handleDelete(p.id)} className="size-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all" title="Eliminar">
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-10 py-6 shrink-0">
          <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Inventario General</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gestión y control de productos en stock</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-screen-xl mx-auto">
            {renderKPIs()}

            <div className="px-6 lg:px-10 pb-10">
              {loading ? (
                <div className="flex justify-center py-24">
                  <div className="relative">
                    <div className="size-16 rounded-full border-4 border-primary/20 absolute inset-0"></div>
                    <span className="material-symbols-outlined animate-spin text-5xl text-primary relative">progress_activity</span>
                  </div>
                </div>
              ) : (
                <DataTable 
                  data={filteredProducts}
                  loading={loading}
                  searchPlaceholder="Buscar por nombre, código o marca..."
                  headerContent={
                    <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 custom-scrollbar no-scrollbar">
                      {/* View Mode Toggle */}
                      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-800 flex-shrink-0">
                        <button
                          onClick={() => setViewMode('grid')}
                          className={`size-10 rounded-xl flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm scale-105' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                          <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        </button>
                        <button
                          onClick={() => setViewMode('list')}
                          className={`size-10 rounded-xl flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm scale-105' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                          <span className="material-symbols-outlined text-[20px]">view_list</span>
                        </button>
                      </div>

                      {/* Category Filter */}
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="h-12 px-5 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all dark:bg-slate-900 dark:border-slate-800 dark:text-white min-w-[140px] flex-shrink-0"
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat === 'Todos' ? 'Categorías' : cat}</option>
                        ))}
                      </select>

                      <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1 flex-shrink-0"></div>

                      {/* Action Buttons */}
                      <button
                        onClick={async () => {
                          const toastId = toast.loading('Cargando inventario...');
                          await fetchProducts();
                          toast.success('Inventario actualizado', { id: toastId });
                        }}
                        className="size-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-primary hover:border-primary transition-all group flex-shrink-0 flex items-center justify-center"
                        title="Recargar inventario"
                      >
                        <span className="material-symbols-outlined group-active:rotate-180 transition-transform text-[22px]">refresh</span>
                      </button>

                      <button
                        onClick={() => navigate('/nuevo-producto')}
                        className="flex items-center justify-center gap-2 h-12 px-6 bg-primary text-white text-[11px] font-black uppercase tracking-[0.1em] rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95 whitespace-nowrap flex-shrink-0"
                      >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        Nuevo
                      </button>
                    </div>
                  }
                  columns={[
                    {
                      key: 'image',
                      label: 'Imagen',
                      render: (val, item) => (
                        <div className="size-16 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0 dark:bg-slate-800 dark:border-slate-700 p-1">
                          {val ? (
                            <img src={val} alt={item.name} className="size-full object-contain" />
                          ) : (
                            <div className="size-full flex items-center justify-center text-slate-300">
                              <span className="material-symbols-outlined text-3xl">image</span>
                            </div>
                          )}
                        </div>
                      )
                    },
                    { 
                      key: 'name', 
                      label: 'Producto',
                      sortable: true,
                      render: (val, item) => (
                        <div className="flex flex-col gap-0.5 min-w-[150px]">
                          <span className="font-black text-slate-900 dark:text-white leading-tight">{val}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.brand || 'Genérico'} - {item.sku || 'SIN SKU'}</span>
                        </div>
                      )
                    },
                    {
                      key: 'category',
                      label: 'Categoría',
                      sortable: true,
                      render: (val) => (
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-lg dark:bg-slate-800 dark:text-slate-400">
                          {val}
                        </span>
                      )
                    },
                    {
                      key: 'dimensions',
                      label: 'Medidas',
                      render: (val, item) => (
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          {item.dimensions || 'N/A'}
                        </span>
                      )
                    },
                    {
                      key: 'price',
                      label: 'Precios (U/C)',
                      sortable: true,
                      render: (val, item) => (
                        <div className="flex flex-col gap-1 min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase">U:</span>
                            <span className="text-[11px] font-black text-slate-900 dark:text-white">S/ {(item.unitPrice || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase">C:</span>
                            <span className="text-[11px] font-black text-slate-900 dark:text-white">S/ {(item.boxPrice || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      )
                    },
                    {
                      key: 'currentStock',
                      label: 'Stock',
                      sortable: true,
                      render: (val) => (
                        <span className="text-sm font-black text-slate-900 dark:text-white">{val || 0}</span>
                      )
                    },
                    {
                      key: 'status',
                      label: 'Estado',
                      render: (val, item) => (
                        <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                          item.status === 'Disponible'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                          : item.status === 'Stock Bajo'
                          ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                          : 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800'
                        }`}>
                          {item.status || 'N/A'}
                        </div>
                      )
                    }
                  ]}
                  actions={[
                    {
                      label: 'Historial',
                      icon: 'history',
                      onClick: (item) => openHistoryModal(item)
                    },
                    {
                      label: 'Ubicaciones',
                      icon: 'place_item',
                      onClick: (item) => openLocationModal(item)
                    },
                    {
                      label: 'Editar',
                      icon: 'edit',
                      onClick: (item) => navigate(`/editar-producto/${item.id}`)
                    },
                    {
                      label: 'Eliminar',
                      icon: 'delete',
                      className: 'text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20',
                      onClick: (item) => handleDelete(item.id)
                    }
                  ]}
                >
                  {viewMode === 'grid' && ((data) => renderGrid(data))}
                </DataTable>
              )}
            </div>
          </div>
        </div>

        {historyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200 dark:border-slate-800 animate-fadeIn">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-30">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <span className="material-symbols-outlined">history</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Historial de Movimientos</h3>
                    <p className="text-[10px] text-slate-500 font-medium">{selectedProductForHistory?.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setHistoryModalOpen(false)}
                  className="size-9 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto p-6 custom-scrollbar flex-1">
                {historyLoading ? (
                  <div className="flex justify-center py-12">
                     <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                  </div>
                ) : productHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">history_toggle_off</span>
                    <p className="text-sm font-medium">No hay movimientos registrados.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                        <th className="py-4 px-2">Fecha / Hora</th>
                        <th className="py-4 px-2">Actividad</th>
                        <th className="py-4 px-2">Usuario</th>
                        <th className="py-4 px-2 text-right">Cambio</th>
                        <th className="py-4 px-2 text-right">Stock Final</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                      {productHistory.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                          <td className="py-3 px-2">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                {tx.date?.toDate ? tx.date.toDate().toLocaleDateString() : 'N/A'}
                              </span>
                              <span className="text-[10px] font-medium text-slate-400">
                                {tx.date?.toDate ? tx.date.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                             <div className="flex flex-col gap-0.5">
                               <div className="flex items-center gap-1.5">
                                 <div className={`size-1.5 rounded-full ${
                                   tx.type === 'SALE' ? 'bg-emerald-500' : 
                                   tx.type === 'entrada' ? 'bg-blue-500' : 
                                   tx.type === 'salida' ? 'bg-rose-500' : 
                                   'bg-slate-400'
                                 }`}></div>
                                 <span className={`text-[10px] font-black uppercase tracking-wider ${
                                   tx.type === 'SALE' ? 'text-emerald-600' : 
                                   tx.type === 'entrada' ? 'text-blue-600' : 
                                   tx.type === 'salida' ? 'text-rose-600' : 
                                   'text-slate-600'
                                 }`}>
                                   {tx.type === 'SALE' ? 'VENTA' : tx.type || 'MOVIMIENTO'}
                                 </span>
                               </div>
                               {tx.saleId && <span className="text-[9px] text-slate-400 font-mono pl-3">ID: {tx.saleId.slice(0,8)}...</span>}
                             </div>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                               <div className="size-6 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-[10px] font-black text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                                 {(tx.userEmail || tx.user || '?').charAt(0).toUpperCase()}
                               </div>
                               <div className="flex flex-col">
                                 <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate max-w-[120px]" title={tx.userEmail || tx.user}>
                                   {tx.userEmail || tx.user || 'Sistema'}
                                 </span>
                               </div>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right">
                             <div className="flex flex-col items-end gap-0.5">
                               {tx.quantityBoxes > 0 && (
                                 <span className={`text-xs font-black ${
                                   tx.type === 'SALE' || tx.type === 'salida' ? 'text-rose-500' : 'text-emerald-600'
                                 }`}>
                                   {tx.type === 'SALE' || tx.type === 'salida' ? '-' : '+'}{tx.quantityBoxes} <span className="text-[9px] opacity-70">Cajas</span>
                                 </span>
                               )}
                               {tx.quantityUnits > 0 && (
                                 <span className="text-[10px] font-bold text-slate-400">
                                   {tx.type === 'SALE' || tx.type === 'salida' ? '-' : '+'}{tx.quantityUnits} <span className="text-[9px] opacity-70">Und.</span>
                                 </span>
                               )}
                               {/* Fallback for old data or generic qty */}
                               {!tx.quantityBoxes && !tx.quantityUnits && tx.quantity && (
                                 <span className={`text-xs font-black ${
                                   tx.type === 'salida' ? 'text-rose-500' : 'text-emerald-600'
                                 }`}>
                                   {tx.type === 'salida' ? '-' : '+'}{tx.quantity}
                                 </span>
                               )}
                             </div>
                          </td>
                          <td className="py-3 px-2 text-right">
                            {tx.newStock !== undefined ? (
                              <span className="text-xs font-black text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                {tx.newStock}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              }
              </div>
              
              {/* Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end sticky bottom-0 z-30">
                 <button 
                   onClick={() => setHistoryModalOpen(false)}
                   className="px-6 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 shadow-sm hover:bg-slate-50 transition-colors"
                 >
                   Cerrar
                 </button>
              </div>
            </div>
          </div>
        )}

        {locationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-slate-800">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-30">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <span className="material-symbols-outlined">map</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Seleccionar Ubicación</h3>
                    <p className="text-[10px] text-slate-500 font-medium">{selectedProductForLocation?.name}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {branchLayouts.length > 1 && (
                      <select 
                          value={currentLayoutId || ''}
                          onChange={(e) => setCurrentLayoutId(e.target.value)}
                          className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-primary/50"
                      >
                          {branchLayouts.map(l => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                      </select>
                  )}
                  <div className={`px-4 py-2 rounded-xl flex items-center gap-2 border transition-all ${
                    Object.values(tempLocations).reduce((a, b) => a + Number(b), 0) > selectedProductForLocation?.currentStock 
                    ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-900/30 text-rose-600' 
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}>
                    <span className="material-symbols-outlined text-[18px]">inventory</span>
                    <span className="text-xs font-black">
                      {Object.values(tempLocations).reduce((a, b) => a + (Number(b) || 0), 0)} / {selectedProductForLocation?.currentStock} <span className="text-[10px] opacity-70">cajas</span>
                    </span>
                  </div>
                  <button 
                    onClick={() => setLocationModalOpen(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              </div>
              
              <div className="flex-1 relative bg-slate-50/10 dark:bg-slate-900/10 min-h-[500px] overflow-hidden">
                {activeLayout ? (
                  <>
                <DraggableContainer>
                  <div className="min-w-max p-10 origin-center">
                    <LayoutPreview 
                      layout={activeLayout}
                      selectedAreas={Object.keys(getActiveLayoutLocations())}
                      quantities={getActiveLayoutLocations()}
                      onAreaClick={toggleLocation}
                      onQuantityChange={updateLocationQuantity}
                      zoom={zoom}
                      onZoomChange={setZoom}
                    />
                  </div>
                </DraggableContainer>

                    {/* Zoom Controls */}
                    <div className="absolute top-4 right-4 flex flex-col gap-2 z-30 pointer-events-auto">
                      <button 
                        onClick={() => setZoom(z => Math.min(z + 0.1, 2))}
                        className="size-10 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        title="Acercar"
                      >
                        <span className="material-symbols-outlined">add</span>
                      </button>
                      <button 
                        onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))}
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
                        <span className="material-symbols-outlined">center_focus_strong</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                    <span className="material-symbols-outlined text-5xl mb-4">map</span>
                    <p className="font-medium text-sm">Debe configurar el croquis de la sucursal primero.</p>
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-3 sticky bottom-0 z-10">
                <button onClick={() => setLocationModalOpen(false)} className="px-5 h-11 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancelar</button>
                <button 
                  onClick={saveLocations}
                  disabled={isSavingLocation}
                  className="px-7 h-11 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingLocation ? <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> : <><span className="material-symbols-outlined text-[20px]">save</span>Guardar Cambios</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default InventoryList;
