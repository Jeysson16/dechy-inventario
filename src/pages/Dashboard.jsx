import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';

const BRANCH_COLORS = [
  { bg: 'bg-primary/10', text: 'text-primary', bar: 'bg-primary' },
  { bg: 'bg-emerald-500/10', text: 'text-emerald-500', bar: 'bg-emerald-500' },
  { bg: 'bg-amber-500/10', text: 'text-amber-500', bar: 'bg-amber-500' },
  { bg: 'bg-violet-500/10', text: 'text-violet-500', bar: 'bg-violet-500' },
  { bg: 'bg-rose-500/10', text: 'text-rose-500', bar: 'bg-rose-500' },
];

const Dashboard = () => {
  const { currentBranch } = useAuth();
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [systemCategories, setSystemCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // All categories snapshot
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "categories"), (querySnapshot) => {
      setSystemCategories(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  // Current branch products for KPIs
  useEffect(() => {
    if (!currentBranch) return;

    const q = query(
      collection(db, "products"),
      where("branchId", "==", currentBranch.id)
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

  // All branches + all products for Rendimiento section
  useEffect(() => {
    const fetchBranchesAndProducts = async () => {
      try {
        const [branchesSnap, productsSnap] = await Promise.all([
          getDocs(collection(db, "branches")),
          getDocs(collection(db, "products"))
        ]);
        const branchesData = branchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const productsData = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setBranches(branchesData);
        setAllProducts(productsData);
      } catch (e) {
        console.error('Error fetching branch data:', e);
      }
    };
    fetchBranchesAndProducts();
  }, []);

  // Per-branch stats
  const branchStats = useMemo(() => {
    return branches.map((branch, idx) => {
      const branchProducts = allProducts.filter(p => p.branchId === branch.id);
      let totalStock = 0;
      let totalValue = 0;
      branchProducts.forEach(p => {
        const stock = Number(p.stock) || 0;
        const price = Number(p.price) || 0;
        totalStock += stock;
        totalValue += stock * price;
      });
      const color = BRANCH_COLORS[idx % BRANCH_COLORS.length];
      return { ...branch, totalStock, totalValue, productCount: branchProducts.length, color };
    });
  }, [branches, allProducts]);

  const metrics = useMemo(() => {
    let totalStock = 0;
    let totalValue = 0;
    const categories = new Set();
    let lowStockCount = 0;

    products.forEach(p => {
      const stock = Number(p.stock) || 0;
      const price = Number(p.price) || 0;
      
      totalStock += stock;
      totalValue += (stock * price);
      
      if (p.category) categories.add(p.category);
      if (stock > 0 && stock <= 10) lowStockCount++;
    });
    
    // Sort products by value/stock for "Top Products" widget
    const topProducts = [...products]
      .sort((a, b) => (Number(b.stock) * Number(b.price)) - (Number(a.stock) * Number(a.price)))
      .slice(0, 5);

    // Calculate category distribution for Donut Chart based on GLOBAL categories
    const totalCount = products.length || 1;
    
    // Create stats using systemCategories or fallback to product categories if system empty
    let catStats = [];
    if (systemCategories.length > 0) {
      catStats = systemCategories.map(cat => {
        const count = products.filter(p => p.category === cat.name).length;
        return { name: cat.name, count, percent: (count / totalCount) * 100 };
      });
    } else {
      catStats = Array.from(categories).map(cat => {
        const count = products.filter(p => p.category === cat).length;
        return { name: cat, count, percent: (count / totalCount) * 100 };
      });
    }
    
    catStats.sort((a, b) => b.count - a.count);

    return {
      totalStock,
      totalValue,
      activeCategories: systemCategories.length > 0 ? systemCategories.length : categories.size,
      lowStockCount,
      topProducts,
      categoryStats: catStats
    };
  }, [products, systemCategories]);
  return (
    <AppLayout>
      <div className="flex flex-col flex-1 px-6 lg:px-40 py-8 animate-fadeIn">
        {/* KPIs Superiores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-start">
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Stock Total</p>
              <span className="material-symbols-outlined text-primary bg-primary/10 rounded-lg p-1">package_2</span>
            </div>
            <p className="text-slate-900 dark:text-white tracking-tight text-2xl font-bold">
              {loading ? "..." : `${metrics.totalStock.toLocaleString()} unds`}
            </p>
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
              <span className="material-symbols-outlined text-xs">trending_up</span>
              <span>En tiempo real</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-start">
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total de Categorías</p>
              <span className="material-symbols-outlined text-primary bg-primary/10 rounded-lg p-1">category</span>
            </div>
            <p className="text-slate-900 dark:text-white tracking-tight text-2xl font-bold">
              {loading ? "..." : `${metrics.activeCategories} Cat.`}
            </p>
            <p className="text-slate-500 text-sm font-medium truncate">Configuradas globalmente</p>
          </div>
          
          <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-start">
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Alertas Stock Bajo</p>
              <span className="material-symbols-outlined text-amber-500 bg-amber-500/10 rounded-lg p-1">warning</span>
            </div>
            <p className="text-slate-900 dark:text-white tracking-tight text-2xl font-bold">
              {loading ? "..." : `${metrics.lowStockCount} Prods`}
            </p>
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-sm font-medium">
              <span className="material-symbols-outlined text-xs">notification_important</span>
              <span>Requiere reabastecimiento</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-start">
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Valor de Inventario</p>
              <span className="material-symbols-outlined text-primary bg-primary/10 rounded-lg p-1">account_balance_wallet</span>
            </div>
            <p className="text-slate-900 dark:text-white tracking-tight text-2xl font-bold">
              {loading ? "..." : `S/${metrics.totalValue.toLocaleString()}`}
            </p>
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
              <span className="material-symbols-outlined text-xs">info</span>
              <span>Valoración actual</span>
            </div>
          </div>
        </div>

        {/* Gráficos Principales */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Distribución por Categoría */}
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex justify-between items-center">
              <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">Categorías</h3>
              <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">Distribución</span>
            </div>
            <div className="flex flex-1 items-center justify-center py-4">
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-2xl text-slate-300">progress_activity</span>
              ) : metrics.categoryStats.length === 0 ? (
                <p className="text-slate-400 text-sm italic">Sin datos de categorías</p>
              ) : (
                <div className="flex flex-col md:flex-row items-center gap-8 w-full justify-center">
                  {/* Donut Chart SVG */}
                  <div className="relative w-40 h-40">
                    <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                      <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f3f3f3" strokeWidth="3" />
                      {(() => {
                        let offset = 0;
                        return metrics.categoryStats.map((cat, i) => {
                          const strokeDash = `${cat.percent} ${100 - cat.percent}`;
                          const currentOffset = offset;
                          offset += cat.percent;
                          const colors = ['#7553e1', '#8d65f7', '#a78eff', '#c4b5fd', '#ddd6fe'];
                          return (
                            <circle
                              key={i}
                              cx="18" cy="18" r="15.915"
                              fill="transparent"
                              stroke={colors[i % colors.length]}
                              strokeWidth="3.5"
                              strokeDasharray={strokeDash}
                              strokeDashoffset={-currentOffset}
                              className="transition-all duration-500 hover:strokeWidth-[4.5]"
                            />
                          );
                        });
                      })()}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none">{metrics.activeCategories}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Total</p>
                    </div>
                  </div>
                  {/* Legend */}
                  <div className="flex flex-col gap-2.5 max-h-[160px] overflow-y-auto px-2">
                    {metrics.categoryStats.slice(0, 5).map((cat, i) => {
                      const colors = ['#7553e1', '#8d65f7', '#a78eff', '#c4b5fd', '#ddd6fe'];
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                          <div className="flex flex-col min-w-[80px]">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate w-24">{cat.name}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{Math.round(cat.percent)}% ({cat.count})</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Evolución de Stock */}
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">Evolución de Stock</h3>
                <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">Top 5 Productos por Valor</p>
              </div>
              <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">Rendimiento</span>
            </div>
            <div className="flex flex-col flex-1 gap-4 pt-4">
              {loading ? (
                <div className="flex justify-center items-center h-full">
                  <span className="material-symbols-outlined animate-spin text-2xl text-slate-300">progress_activity</span>
                </div>
              ) : metrics.topProducts.length === 0 ? (
                <p className="text-center text-slate-400 italic text-sm py-10">No hay productos suficientes</p>
              ) : (
                <div className="space-y-4">
                  {metrics.topProducts.map((p, i) => {
                    const val = (Number(p.stock) || 0) * (Number(p.price) || 0);
                    const maxVal = (Number(metrics.topProducts[0].stock) || 0) * (Number(metrics.topProducts[0].price) || 0) || 1;
                    const percent = Math.round((val / maxVal) * 100);
                    return (
                      <div key={p.id} className="group">
                        <div className="flex justify-between items-end mb-1.5 px-1">
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate w-3/4">{p.name}</p>
                          <p className="text-xs font-extrabold text-slate-900 dark:text-white">S/{val.toLocaleString()}</p>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800/50 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full transition-all duration-700 shadow-sm"
                            style={{ width: `${percent}%`, transitionDelay: `${i * 100}ms` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1 px-1">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{p.sku || 'N/A'}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{p.stock} unidades</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rendimiento por Sucursal */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-slate-900 dark:text-white text-xl font-bold leading-tight tracking-tight">Rendimiento por Sucursal</h2>
            <button className="bg-primary hover:bg-primary/90 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">download</span> Exportar Reporte
            </button>
          </div>

          {branches.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <span className="material-symbols-outlined text-4xl mb-2 block">store</span>
              <p className="text-sm">No hay sucursales registradas aún.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {branchStats.map((branch) => {
                const maxStock = Math.max(...branchStats.map(b => b.totalStock), 1);
                const stockPercent = Math.round((branch.totalStock / maxStock) * 100);
                return (
                  <div key={branch.id} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`${branch.color.bg} p-2 rounded-lg`}>
                        <span className={`material-symbols-outlined ${branch.color.text}`}>location_on</span>
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="font-bold text-slate-900 dark:text-white truncate">{branch.name}</h4>
                        <p className="text-xs text-slate-500 truncate">{branch.location || 'Sin ubicación'}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-500">Stock relativo</span>
                          <span className="font-semibold">{stockPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className={`${branch.color.bar} h-full rounded-full transition-all`} style={{ width: `${stockPercent}%` }}></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                        <div>
                          <p className="text-xs text-slate-400">Productos</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{branch.productCount}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Valor Est.</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">S/{branch.totalValue.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
