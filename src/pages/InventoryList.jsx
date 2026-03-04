import { collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';

const InventoryList = () => {
  const { currentBranch } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!currentBranch) return;

    const q = query(
      collection(db, "products"),
      where("branch", "==", currentBranch.id) // Ensure this matches AddProduct.jsx (there we save "branch" not "branchId")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const productsData = [];
      querySnapshot.forEach((doc) => {
        productsData.push({ id: doc.id, ...doc.data() });
      });
      setProducts(productsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentBranch]);

  // Adjust branch field based on AddProduct.jsx: `branch: formData.branch` 
  // Wait, in AddProduct it uses `branch: formData.branch` which stores 'central', 'norte', etc.

  const metrics = useMemo(() => {
    let totalStock = 0;
    let totalValue = 0;
    let lowStockCount = 0;

    products.forEach(p => {
      const stock = Number(p.currentStock) || 0;
      const price = Number(p.price) || 0;
      totalStock += stock;
      totalValue += stock * price;
      if (stock > 0 && stock <= 10) lowStockCount++;
    });

    return { totalStock, totalValue, lowStockCount, totalProducts: products.length };
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const handleDelete = async (id) => {
    if (window.confirm('¿Está seguro de eliminar este producto?')) {
      try {
        await deleteDoc(doc(db, "products", id));
      } catch (error) {
        console.error("Error deleting document: ", error);
        alert("Hubo un error al eliminar el producto.");
      }
    }
  };

  const updateStock = async (id, currentStock, change) => {
    const newStock = Number(currentStock) + change;
    if (newStock < 0) return;
    try {
      let status = newStock > 20 ? 'Disponible' : (newStock > 0 ? 'Stock Bajo' : 'Agotado');
      await updateDoc(doc(db, "products", id), { 
        currentStock: newStock,
        status: status
      });
    } catch (error) {
      console.error("Error updating stock: ", error);
    }
  };

  const renderKPIs = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Productos</p>
          <span className="material-symbols-outlined text-primary text-lg">inventory_2</span>
        </div>
        <p className="text-slate-900 dark:text-white text-3xl font-bold">{loading ? "..." : metrics.totalProducts}</p>
        <div className="flex items-center gap-1 text-emerald-600 text-sm font-semibold">
          <span className="material-symbols-outlined text-sm">trending_up</span>
          <span>Actualizado</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Stock Bajo</p>
          <span className="material-symbols-outlined text-red-500 text-lg">warning</span>
        </div>
        <p className="text-slate-900 dark:text-white text-3xl font-bold">{loading ? "..." : metrics.lowStockCount}</p>
        <div className="flex items-center gap-1 text-red-500 text-sm font-semibold">
          <span className="material-symbols-outlined text-sm">priority_high</span>
          <span>Requiere atención</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Valor Total</p>
          <span className="material-symbols-outlined text-primary text-lg">payments</span>
        </div>
        <p className="text-slate-900 dark:text-white text-3xl font-bold">{loading ? "..." : `S/${metrics.totalValue.toLocaleString()}`}</p>
        <div className="flex items-center gap-1 text-emerald-600 text-sm font-semibold">
          <span className="material-symbols-outlined text-sm">arrow_upward</span>
          <span>En tiempo real</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Unidades</p>
          <span className="material-symbols-outlined text-primary text-lg">category</span>
        </div>
        <p className="text-slate-900 dark:text-white text-3xl font-bold">{loading ? "..." : metrics.totalStock}</p>
        <div className="flex items-center gap-1 text-slate-500 text-sm font-semibold">
          <span className="material-symbols-outlined text-sm">inventory</span>
          <span>En almacén</span>
        </div>
      </div>
    </div>
  );

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Disponible': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
      case 'Stock Bajo': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
      case 'Agotado': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const renderGrid = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {filteredProducts.map(p => (
        <div key={p.id} className="group flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all">
          <div className="relative w-full aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            {p.imageUrl ? (
              <div 
                className="w-full h-full bg-center bg-no-repeat bg-cover transition-transform duration-500 group-hover:scale-110" 
                style={{ backgroundImage: `url(${p.imageUrl})` }}
              />
            ) : (
              <span className="material-symbols-outlined text-4xl text-slate-300">image</span>
            )}
            <span className={`absolute top-3 right-3 text-[11px] font-bold px-2 py-1 rounded uppercase tracking-wider ${getStatusStyle(p.status)}`}>
              {p.status || 'N/A'}
            </span>
          </div>
          <div className="p-5 flex flex-col gap-3 flex-1">
            <div>
              <h3 className="text-slate-900 dark:text-white text-lg font-bold truncate">{p.name}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-1">Modelo: <span className="font-mono">{p.sku || 'N/A'}</span> • <span className="text-primary">{p.category || 'N/A'}</span></p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] py-2 border-y border-slate-100 dark:border-slate-800 flex-1">
              <div className="flex flex-col"><span className="text-slate-400 font-bold uppercase tracking-tighter">Medidas</span><span className="text-slate-700 dark:text-slate-300 font-semibold">{p.dimensions || 'N/A'}</span></div>
              <div className="flex flex-col"><span className="text-slate-400 font-bold uppercase tracking-tighter">Uds. por Caja</span><span className="text-slate-700 dark:text-slate-300 font-semibold">{p.unitsPerBox || 'N/A'} uds</span></div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="flex flex-col">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Stock</span>
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{p.currentStock || 0} <span className="text-sm font-normal text-slate-500 uppercase">uds</span></span>
              </div>
              <div className="flex gap-1 items-center">
                 <button onClick={() => handleDelete(p.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 transition-colors mr-1" title="Eliminar">
                   <span className="material-symbols-outlined text-[18px]">delete</span>
                 </button>
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                  <button onClick={() => updateStock(p.id, p.currentStock, -1)} className="size-7 flex items-center justify-center rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-primary transition-colors shadow-sm"><span className="material-symbols-outlined text-[16px]">remove</span></button>
                  <button onClick={() => updateStock(p.id, p.currentStock, 1)} className="size-7 flex items-center justify-center rounded-md bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm"><span className="material-symbols-outlined text-[16px]">add</span></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderList = () => (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Imagen</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Producto</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Categoría</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Medidas</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Stock</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estado</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredProducts.map(p => {
               const stockPercent = Math.min((Number(p.currentStock) / 100) * 100, 100);
               return (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="h-12 w-12 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-700 bg-slate-100 flex items-center justify-center">
                      {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-slate-400">image</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{p.name}</span>
                      <span className="text-xs text-slate-500 font-mono mt-1">{p.sku || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4"><span className="text-sm text-slate-600 dark:text-slate-400">{p.category}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-slate-600 dark:text-slate-400">{p.dimensions || 'N/A'}</span></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-3">
                      <button onClick={() => updateStock(p.id, p.currentStock, -1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-all"><span className="material-symbols-outlined text-[18px]">remove</span></button>
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{p.currentStock || 0}</span>
                        <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
                          <div className={`h-full ${p.currentStock > 20 ? 'bg-primary' : (p.currentStock > 0 ? 'bg-amber-500' : 'bg-red-500')}`} style={{ width: `${stockPercent}%` }}></div>
                        </div>
                      </div>
                      <button onClick={() => updateStock(p.id, p.currentStock, 1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-all"><span className="material-symbols-outlined text-[18px]">add</span></button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex min-w-24 px-2 py-1 items-center justify-center rounded-md text-[11px] font-bold ${getStatusStyle(p.status)}`}>
                      {p.status || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors" title="Eliminar"><span className="material-symbols-outlined text-[20px]">delete</span></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filteredProducts.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2 block">inventory_2</span>
            <p>No se encontraron productos.</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div className="flex flex-1 justify-center py-8 px-6 lg:px-40 animate-fadeIn">
        <div className="flex flex-col w-full">
          {renderKPIs()}

          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <h2 className="text-slate-900 dark:text-white text-2xl font-bold tracking-tight">Catálogo de Productos</h2>
              
              {/* Toggle List/Grid */}
              <div className="flex h-11 w-full sm:w-auto min-w-[200px] items-center justify-center rounded-lg bg-slate-200/50 dark:bg-slate-800/50 p-1">
                <button 
                  onClick={() => setViewMode('list')}
                  className={`flex h-full grow items-center justify-center rounded-md px-4 text-sm font-semibold transition-all ${viewMode === 'list' ? 'bg-white dark:bg-primary shadow-sm text-primary dark:text-white font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-primary'}`}
                >
                  <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">list_alt</span> Lista</span>
                </button>
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`flex h-full grow items-center justify-center rounded-md px-4 text-sm font-semibold transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-primary shadow-sm text-primary dark:text-white font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-primary'}`}
                >
                  <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">grid_view</span> Cuadrícula</span>
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
              {/* Search */}
              <div className="relative flex-1 sm:w-64 max-w-sm">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                <input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none focus:outline-none" 
                  placeholder="Buscar productos..." 
                />
              </div>

              {/* Add Product Button */}
              <button 
                onClick={() => navigate('/nuevo-producto')}
                className="bg-primary hover:bg-primary/90 text-white h-11 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                <span className="hidden sm:inline">Nuevo Producto</span>
              </button>
            </div>
          </div>

          {loading ? (
             <div className="flex justify-center py-20">
               <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
             </div>
          ) : (
            viewMode === 'grid' ? renderGrid() : renderList()
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default InventoryList;
