import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import AppLayout from '../components/layout/AppLayout';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';

const BRANCH_COLORS = [
  { bg: 'bg-primary/10', text: 'text-primary', bar: 'bg-primary' },
  { bg: 'bg-emerald-500/10', text: 'text-emerald-500', bar: 'bg-emerald-500' },
  { bg: 'bg-amber-500/10', text: 'text-amber-500', bar: 'bg-amber-500' },
  { bg: 'bg-violet-500/10', text: 'text-violet-500', bar: 'bg-violet-500' },
  { bg: 'bg-rose-500/10', text: 'text-rose-500', bar: 'bg-rose-500' },
];

const Dashboard = () => {
  const { currentBranch, userProfile } = useAuth();
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [systemCategories, setSystemCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Date Filter State
  const [dateFilter, setDateFilter] = useState('last7'); // 'last7', 'last30', 'custom'
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Fetch Data from Supabase
  useEffect(() => {
    if (!currentBranch || !userProfile?.company_id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Categories
        const { data: categoriesData } = await supabase
          .from('categories')
          .select('*')
          .eq('company_id', userProfile.company_id);
        setSystemCategories(categoriesData || []);

        // 2. Fetch Current Branch Inventory (Products)
        // Join inventory with products to get details
        const { data: inventoryData } = await supabase
          .from('inventory')
          .select(`
            stock_current,
            products!inventory_product_id_fkey (
              id,
              name,
              sku,
              unit_price,
              image_url,
              category_id,
              categories!products_category_id_fkey (name)
            )
          `)
          .eq('branch_id', currentBranch.id);
        
        const mappedProducts = (inventoryData || []).map(item => ({
          id: item.products.id,
          name: item.products.name,
          sku: item.products.sku,
          price: item.products.unit_price,
          stock: item.stock_current,
          category: item.products.categories?.name,
          image: item.products.image_url
        }));
        setProducts(mappedProducts);

        // 3. Fetch Transactions for Current Branch
        const { data: txData } = await supabase
          .from('transactions')
          .select(`
            id,
            type,
            quantity,
            amount,
            created_at,
            product_id,
            products!transactions_product_id_fkey (name),
            profiles!transactions_user_id_fkey (full_name)
          `)
          .eq('branch_id', currentBranch.id)
          .order('created_at', { ascending: false });

        const mappedTxs = (txData || []).map(tx => ({
            id: tx.id,
            type: tx.type === 'ENTRY' ? 'IN' : (tx.type === 'SALE' ? 'SALE' : 'OUT'),
            quantity: tx.quantity,
            subtotal: tx.amount,
            date: new Date(tx.created_at), // Keep as Date object for sorting/filtering
            productName: tx.products?.name || 'Producto eliminado',
            user: tx.profiles?.full_name || 'Usuario'
        }));
        setTransactions(mappedTxs);

        // 4. Fetch All Branches & Global Stats (for "Rendimiento por Sucursal")
        const { data: branchesData } = await supabase
          .from('branches')
          .select('*')
          .eq('company_id', userProfile.company_id);
        setBranches(branchesData || []);

        // Fetch ALL inventory for ALL branches to calculate totals
        // Note: This might be heavy for large datasets. Consider an RPC for summary stats.
        const { data: allInvData } = await supabase
          .from('inventory')
          .select(`
            branch_id,
            stock_current,
            products!product_id (unit_price)
          `)
          .in('branch_id', (branchesData || []).map(b => b.id)); // Use branchesData from above

        const mappedAllProducts = (allInvData || []).map(item => ({
            branchId: item.branch_id,
            stock: item.stock_current,
            price: item.products?.unit_price || 0
        }));
        setAllProducts(mappedAllProducts);

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Optional: Realtime subscriptions could be added here
    
  }, [currentBranch, userProfile?.company_id]);

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
      
      const themeColor = branch.primary_color; // Correct column name from Supabase
      const isDynamic = !!themeColor;
      
      const color = isDynamic ? {
        bgStyle: { backgroundColor: `${themeColor}1a` }, // ~10% opacity
        textStyle: { color: themeColor },
        barStyle: { backgroundColor: themeColor }
      } : BRANCH_COLORS[idx % BRANCH_COLORS.length];

      return { ...branch, totalStock, totalValue, productCount: branchProducts.length, color, isDynamic };
    });
  }, [branches, allProducts]);

  // Derived Dates for filtering
  const filterDates = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    if (dateFilter === 'last7') {
      start.setDate(end.getDate() - 6);
    } else if (dateFilter === 'last30') {
      start.setDate(end.getDate() - 29);
    } else if (dateFilter === 'custom') {
      const partsStart = customStartDate.split('-');
      if (partsStart.length === 3) {
        start.setFullYear(parseInt(partsStart[0]), parseInt(partsStart[1]) - 1, parseInt(partsStart[2]));
      }
      const partsEnd = customEndDate.split('-');
      if (partsEnd.length === 3) {
        end.setFullYear(parseInt(partsEnd[0]), parseInt(partsEnd[1]) - 1, parseInt(partsEnd[2]));
        end.setHours(23, 59, 59, 999);
      }
    }
    return { start, end };
  }, [dateFilter, customStartDate, customEndDate]);

  // Filtered transactions based on date
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (!tx.date) return false;
      return tx.date >= filterDates.start && tx.date <= filterDates.end;
    });
  }, [transactions, filterDates]);

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
      
      const cat = p.category;
      if (cat) categories.add(cat);
      if (stock > 0 && stock <= 10) lowStockCount++;
    });
    
    // Sort products by value/stock for "Top Products" widget
    const topProducts = [...products]
      .sort((a, b) => {
        const valA = (Number(a.stock) || 0) * (Number(a.price) || 0);
        const valB = (Number(b.stock) || 0) * (Number(b.price) || 0);
        return valB - valA;
      })
      .slice(0, 5);

    // Calculate category distribution for Donut Chart based on CURRENT branch products
    const totalCount = products.length || 1;
    
    // Use categories present in the current branch's products for coordination
    const branchCategories = Array.from(categories);
    const catStats = branchCategories.map(cat => {
      const count = products.filter(p => p.category === cat).length;
      return { name: cat, count, percent: (count / totalCount) * 100 };
    });
    
    catStats.sort((a, b) => b.count - a.count);

    // Total sales value from filtered transactions
    const totalSalesValue = filteredTransactions
      .filter(tx => tx.type === 'SALE')
      .reduce((acc, curr) => acc + (Number(curr.subtotal) || 0), 0);

    return {
      totalStock,
      totalValue,
      totalSalesValue,
      activeCategories: categories.size,
      lowStockCount,
      topProducts,
      categoryStats: catStats
    };
  }, [products, filteredTransactions]);

  const chartData = useMemo(() => {
    const data = [];
    const diffTime = Math.abs(filterDates.end - filterDates.start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const daysToMap = Math.min(diffDays, 60); // Max 60 bars to avoid UI clutter

    for (let i = daysToMap - 1; i >= 0; i--) {
      const d = new Date(filterDates.end);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
      
      const dayTxs = filteredTransactions.filter(tx => {
        if (!tx.date) return false;
        return tx.date.getDate() === d.getDate() && tx.date.getMonth() === d.getMonth() && tx.date.getFullYear() === d.getFullYear();
      });

      const inputs = dayTxs.filter(tx => tx.type === 'IN').reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
      const outputs = dayTxs.filter(tx => tx.type === 'OUT' || tx.type === 'SALE').reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

      data.push({ name: dateStr, Entradas: inputs, Salidas: outputs });
    }
    return data;
  }, [filteredTransactions, filterDates]);

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-10 py-6 shrink-0">
          <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Panel Principal</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Resumen general y métricas clave</p>
            </div>
            
            {/* Filtros de Fecha */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setDateFilter('last7')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateFilter === 'last7' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                7 días
              </button>
              <button
                onClick={() => setDateFilter('last30')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateFilter === 'last30' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                30 días
              </button>
              <button
                onClick={() => setDateFilter('custom')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateFilter === 'custom' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                Personalizado
              </button>
            </div>
          </div>
          
          {dateFilter === 'custom' && (
            <div className="max-w-screen-xl mx-auto mt-4 flex items-center gap-2 justify-end">
              <input 
                type="date" 
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
              <span className="text-slate-500">a</span>
              <input 
                type="date" 
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
          <div className="max-w-screen-xl mx-auto flex flex-col gap-8">
            
            {/* KPIs Superiores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Categorías Activas</p>
                  <span className="material-symbols-outlined text-primary bg-primary/10 rounded-lg p-1">category</span>
                </div>
                <p className="text-slate-900 dark:text-white tracking-tight text-2xl font-bold">
                  {loading ? "..." : `${metrics.activeCategories} Cat.`}
                </p>
                <p className="text-slate-500 text-sm font-medium truncate">En esta sucursal</p>
              </div>
              
              <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex justify-between items-start">
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Ventas del Periodo</p>
                  <span className="material-symbols-outlined text-emerald-500 bg-emerald-500/10 rounded-lg p-1">payments</span>
                </div>
                <p className="text-slate-900 dark:text-white tracking-tight text-2xl font-bold">
                  {loading ? "..." : `S/${metrics.totalSalesValue.toLocaleString()}`}
                </p>
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                  <span className="material-symbols-outlined text-xs">trending_up</span>
                  <span>Ingresos brutos</span>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                              // Dynamic colors based on branch theme
                              const baseColor = currentBranch?.primaryColor || '#7553e1';
                              const opacity = 1 - (i * 0.15); // Decrease opacity for each slice
                              
                              return (
                                <circle
                                  key={i}
                                  cx="18" cy="18" r="15.915"
                                  fill="transparent"
                                  stroke={baseColor}
                                  strokeOpacity={opacity}
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
                          const baseColor = currentBranch?.primaryColor || '#7553e1';
                          const opacity = 1 - (i * 0.15);
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: baseColor, opacity }} />
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
                    <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">Distribución de Valor</h3>
                    <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">Top 5 Productos</p>
                  </div>
                  <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">Inventario</span>
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
                        const stock = Number(p.stock || p.currentStock) || 0;
                        const price = Number(p.price || p.unitPrice) || 0;
                        const val = stock * price;
                        const maxVal = (Number(metrics.topProducts[0].stock || metrics.topProducts[0].currentStock) || 0) * (Number(metrics.topProducts[0].price || metrics.topProducts[0].unitPrice) || 0) || 1;
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
                              <p className="text-[10px] text-slate-400 font-bold uppercase">{stock} unidades</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actividad y Movimientos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Gráfico de Entradas/Salidas */}
              <div className="lg:col-span-2 flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">Flujo de Inventario</h3>
                  <span className="material-symbols-outlined text-slate-400">bar_chart</span>
                </div>
                <div className="h-64 w-full">
                  {filteredTransactions.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-slate-400 text-sm italic">Sin movimientos en este periodo</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <RechartsTooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="Salidas" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Últimos Movimientos */}
              <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">Actividad Reciente</h3>
                  <span className="material-symbols-outlined text-slate-400">history</span>
                </div>
                <div className="flex flex-col gap-4 overflow-y-auto max-h-64 pr-2">
                  {filteredTransactions.length === 0 ? (
                    <p className="text-slate-400 text-sm italic py-4 text-center">No hay registros</p>
                  ) : (
                    filteredTransactions.slice(0, 5).map(tx => (
                      <div key={tx.id} className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 last:border-0 last:pb-0">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${tx.type === 'IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                          <span className="material-symbols-outlined text-sm">{tx.type === 'IN' ? 'call_received' : 'call_made'}</span>
                        </div>
                        <div className="flex flex-col flex-1 overflow-hidden">
                          <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{tx.productName}</p>
                          <p className="text-xs text-slate-500 truncate">{tx.user}</p>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className={`text-sm font-bold ${tx.type === 'IN' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {tx.type === 'IN' ? '+' : '-'}{tx.quantity}
                          </span>
                          <span className="text-[10px] text-slate-400">{tx.date?.toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Rendimiento por Sucursal */}
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h2 className="text-slate-900 dark:text-white text-xl font-bold leading-tight tracking-tight">Rendimiento por Sucursal</h2>
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
                          <div 
                            className={`p-2 rounded-lg ${branch.isDynamic ? '' : branch.color.bg}`}
                            style={branch.isDynamic ? branch.color.bgStyle : {}}
                          >
                            <span 
                              className={`material-symbols-outlined ${branch.isDynamic ? '' : branch.color.text}`}
                              style={branch.isDynamic ? branch.color.textStyle : {}}
                            >location_on</span>
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
                              <div 
                                className={`h-full rounded-full transition-all ${branch.isDynamic ? '' : branch.color.bar}`} 
                                style={{ width: `${stockPercent}%`, ...(branch.isDynamic ? branch.color.barStyle : {}) }}
                              ></div>
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
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
