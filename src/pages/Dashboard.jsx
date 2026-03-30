import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import AppLayout from "../components/layout/AppLayout";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";

const BRANCH_COLORS = [
  { bg: "bg-primary/10", text: "text-primary", bar: "bg-primary" },
  { bg: "bg-emerald-500/10", text: "text-emerald-500", bar: "bg-emerald-500" },
  { bg: "bg-amber-500/10", text: "text-amber-500", bar: "bg-amber-500" },
  { bg: "bg-violet-500/10", text: "text-violet-500", bar: "bg-violet-500" },
  { bg: "bg-rose-500/10", text: "text-rose-500", bar: "bg-rose-500" },
];

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

const Dashboard = () => {
  const { currentBranch, userRole } = useAuth();
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Date Filter State
  const [dateFilter, setDateFilter] = useState("last30"); // 'last7', 'last30', 'custom'
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Current branch products for KPIs
  useEffect(() => {
    if (!currentBranch) return;

    const q = query(
      collection(db, "products"),
      where("branch", "==", currentBranch.id),
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

  // Current branch transactions
  useEffect(() => {
    if (!currentBranch) return;
    const q = query(
      collection(db, "transactions"),
      where("branchId", "==", currentBranch.id),
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const txs = [];
      querySnapshot.forEach((doc) => {
        txs.push({ id: doc.id, ...doc.data() });
      });
      txs.sort((a, b) => (b.date?.toDate() || 0) - (a.date?.toDate() || 0));
      setTransactions(txs);
    });
    return () => unsubscribe();
  }, [currentBranch]);

  // Current branch sales
  useEffect(() => {
    if (!currentBranch) return;
    const q = query(
      collection(db, "sales"),
      where("branchId", "==", currentBranch.id),
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const salesData = [];
      querySnapshot.forEach((doc) => {
        salesData.push({ id: doc.id, ...doc.data() });
      });
      salesData.sort(
        (a, b) => (b.date?.toDate() || 0) - (a.date?.toDate() || 0),
      );
      setSales(salesData);
    });
    return () => unsubscribe();
  }, [currentBranch]);

  // All branches + all products for Rendimiento section
  useEffect(() => {
    const fetchBranchesAndProducts = async () => {
      try {
        const [branchesSnap, productsSnap] = await Promise.all([
          getDocs(collection(db, "branches")),
          getDocs(collection(db, "products")),
        ]);
        const branchesData = branchesSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        const productsData = productsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setBranches(branchesData);
        setAllProducts(productsData);
      } catch (e) {
        console.error("Error fetching branch data:", e);
      }
    };
    fetchBranchesAndProducts();
  }, []);

  // Fetch employees for user name mapping
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "employees"), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEmployees(data);
    });
    return () => unsub();
  }, []);

  const branchStats = useMemo(() => {
    return branches.map((branch, idx) => {
      const branchProducts = allProducts.filter(
        (p) => (p.branchId || p.branch) === branch.id,
      );
      let totalStock = 0;
      let totalValue = 0;
      branchProducts.forEach((p) => {
        const stock = Number(p.stock || p.currentStock) || 0;
        const price = Number(p.price || p.unitPrice) || 0;
        totalStock += stock;
        totalValue += stock * price;
      });

      const themeColor = branch.primaryColor;
      const isDynamic = !!themeColor;

      const color = isDynamic
        ? {
            bgStyle: { backgroundColor: `${themeColor}1a` }, // ~10% opacity
            textStyle: { color: themeColor },
            barStyle: { backgroundColor: themeColor },
          }
        : BRANCH_COLORS[idx % BRANCH_COLORS.length];

      return {
        ...branch,
        totalStock,
        totalValue,
        productCount: branchProducts.length,
        color,
        isDynamic,
      };
    });
  }, [branches, allProducts]);

  // Map email to user name for transactions
  const userMap = useMemo(() => {
    const map = {};
    employees.forEach((emp) => {
      map[emp.email] = emp.name;
    });
    return map;
  }, [employees]);

  // Derived Dates for filtering
  const filterDates = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    if (dateFilter === "last7") {
      start.setDate(end.getDate() - 6);
    } else if (dateFilter === "last30") {
      start.setDate(end.getDate() - 29);
    } else if (dateFilter === "custom") {
      const parts = selectedDate.split("-");
      if (parts.length === 3) {
        start.setFullYear(
          parseInt(parts[0]),
          parseInt(parts[1]) - 1,
          parseInt(parts[2]),
        );
        start.setHours(0, 0, 0, 0);
        end.setFullYear(
          parseInt(parts[0]),
          parseInt(parts[1]) - 1,
          parseInt(parts[2]),
        );
        end.setHours(23, 59, 59, 999);
      }
    }
    return { start, end };
  }, [dateFilter, selectedDate]);

  // Filtered transactions based on date
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (!tx.date) return false;
      const txDate = tx.date.toDate();
      return txDate >= filterDates.start && txDate <= filterDates.end;
    });
  }, [transactions, filterDates]);

  // Filtered sales based on date
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (!s.date) return false;
      const sDate = s.date.toDate();
      return sDate >= filterDates.start && sDate <= filterDates.end;
    });
  }, [sales, filterDates]);

  const metrics = useMemo(() => {
    let totalStock = 0;
    let totalValue = 0;
    const categories = new Set();
    let lowStockCount = 0;

    products.forEach((p) => {
      const stock = Number(p.stock || p.currentStock) || 0;
      const price = Number(p.price || p.unitPrice) || 0;

      totalStock += stock;
      totalValue += stock * price;

      const cat = p.category || p.categoria;
      if (cat) categories.add(cat);
      if (stock > 0 && stock <= 10) lowStockCount++;
    });

    // Sort products by value/stock for "Top Products" widget
    const topProducts = [...products]
      .sort((a, b) => {
        const valA =
          (Number(a.stock || a.currentStock) || 0) *
          (Number(a.price || a.unitPrice) || 0);
        const valB =
          (Number(b.stock || b.currentStock) || 0) *
          (Number(b.price || b.unitPrice) || 0);
        return valB - valA;
      })
      .slice(0, 5);

    // Low stock products
    const lowStockProducts = [...products]
      .filter((p) => {
        const stock = Number(p.stock || p.currentStock) || 0;
        return stock > 0 && stock <= 10;
      })
      .sort(
        (a, b) =>
          (Number(a.stock || a.currentStock) || 0) -
          (Number(b.stock || b.currentStock) || 0),
      )
      .slice(0, 5);

    // Top sold products (combine transactions + sales data for real-time completeness)
    const productSales = {};

    filteredTransactions.forEach((tx) => {
      if (tx.type === "SALE") {
        const key = tx.productId || tx.productName;
        productSales[key] =
          (productSales[key] || 0) +
          (Number(tx.quantityBoxes) || Number(tx.quantity) || 0);
      }

      if (tx.type === "OUT" || tx.type === "salida") {
        const key = tx.productId || tx.productName;
        productSales[key] =
          (productSales[key] || 0) +
          (Number(tx.quantity) || Number(tx.quantityBoxes) || 0);
      }
    });

    filteredSales.forEach((sale) => {
      if (sale.status === "completed" || sale.status === "pending_delivery") {
        (sale.items || []).forEach((item) => {
          const key = item.productId || item.productName;
          const qty =
            item.quantitySoldBoxes ||
            item.quantitySoldUnits ||
            item.quantity ||
            0;
          productSales[key] = (productSales[key] || 0) + Number(qty);
        });
      }
    });

    const topSoldProducts = Object.entries(productSales)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([key, qty]) => {
        const product = products.find((p) => p.id === key || p.name === key);

        return product ? { ...product, soldQty: qty } : null;
      })
      .filter(Boolean);

    // Calculate category distribution for Donut Chart based on CURRENT branch products
    const totalCount = products.length || 1;

    // Use categories present in the current branch's products for coordination
    const branchCategories = Array.from(categories);
    const catStats = branchCategories.map((cat) => {
      const count = products.filter(
        (p) => (p.category || p.categoria) === cat,
      ).length;
      return { name: cat, count, percent: (count / totalCount) * 100 };
    });

    catStats.sort((a, b) => b.count - a.count);

    // Total sales value from filtered sales collection (only paid/delivered)
    const paidSales = filteredSales.filter(
      (s) => s.status === "completed" || s.status === "pending_delivery",
    );
    const totalSalesValue = paidSales.reduce(
      (acc, curr) => acc + (Number(curr.totalValue) || 0),
      0,
    );

    // Calculate inventory rotation metrics
    const productRotation = products.map((p) => {
      // Find sales for this product by ID or name
      const sold = productSales[p.id] || productSales[p.name] || 0;
      const stock = Number(p.stock || p.currentStock) || 0;
      const cost = Number(p.costPrice || p.costo || p.cost) || 0;
      const price = Number(p.price || p.unitPrice) || 0;
      const profit = (price - cost) * sold;
      return {
        ...p,
        soldQty: sold,
        currentStock: stock,
        cost: cost,
        unitPrice: price,
        profit,
        rotation: stock > 0 ? sold / stock : 0,
      };
    });

    const fastSelling = productRotation
      .filter((p) => p.soldQty > 10)
      .sort((a, b) => b.soldQty - a.soldQty)
      .slice(0, 5);
    const stagnant = productRotation
      .filter((p) => p.soldQty > 0 && p.soldQty <= 2)
      .sort((a, b) => a.soldQty - b.soldQty)
      .slice(0, 5);
    const noSales = productRotation
      .filter((p) => p.soldQty === 0 && p.currentStock > 0)
      .slice(0, 5);

    // Profitability by category
    const categoryProfit = {};
    productRotation.forEach((p) => {
      const cat = p.category || p.categoria || "Sin categoría";
      if (!categoryProfit[cat])
        categoryProfit[cat] = { profit: 0, sales: 0, products: 0 };
      categoryProfit[cat].profit += p.profit;
      categoryProfit[cat].sales += p.soldQty;
      categoryProfit[cat].products += 1;
    });

    const profitabilityByCategory = Object.entries(categoryProfit)
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.profit - a.profit);

    // Best business line (category with highest profit)
    const bestBusinessLine = profitabilityByCategory[0] || null;

    // Daily sales KPI
    const dailySales = {};
    filteredTransactions.forEach((tx) => {
      if (tx.type === "SALE" && tx.date) {
        const date = tx.date.toDate().toDateString();
        dailySales[date] = (dailySales[date] || 0) + (Number(tx.subtotal) || 0);
      }
    });

    const avgDailySales =
      Object.values(dailySales).reduce((a, b) => a + b, 0) /
      Math.max(Object.keys(dailySales).length, 1);

    // Global margin - Only from paid/delivered sales
    const totalRevenue = paidSales.reduce(
      (acc, curr) => acc + (Number(curr.totalValue) || 0),
      0,
    );

    // Global margin
    // (already calculated above from paidSales)
    // const totalRevenue = filteredTransactions.filter(tx => tx.type === 'SALE').reduce((acc, curr) => acc + (Number(curr.subtotal) || 0), 0);

    const totalCost = productRotation.reduce((acc, p) => {
      const cost = Number(p.costPrice || p.costo || p.cost) || 0;
      return acc + cost * p.soldQty;
    }, 0);
    const globalMargin =
      totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

    // Productos que causan pérdidas (costo > precio de venta)
    const lossProducts = productRotation
      .filter((p) => {
        const cost = Number(p.costPrice || p.costo || p.cost) || 0;
        const price = Number(p.price || p.unitPrice) || 0;
        return cost > 0 && price > 0 && cost > price && p.soldQty > 0;
      })
      .sort((a, b) => {
        const costA = Number(a.costPrice || a.costo || a.cost) || 0;
        const priceA = Number(a.price || a.unitPrice) || 0;
        const costB = Number(b.costPrice || b.costo || b.cost) || 0;
        const priceB = Number(b.price || b.unitPrice) || 0;
        return (costB - priceB) * b.soldQty - (costA - priceA) * a.soldQty;
      })
      .slice(0, 5);

    return {
      totalStock,
      totalValue,
      totalSalesValue,
      activeCategories: categories.size,
      lowStockCount,
      topProducts,
      categoryStats: catStats,
      lowStockProducts,
      topSoldProducts,
      fastSelling,
      stagnant,
      noSales,
      profitabilityByCategory,
      bestBusinessLine,
      avgDailySales,
      globalMargin,
      productRotation,
      lossProducts,
    };
  }, [products, filteredTransactions, filteredSales]);

  const chartData = useMemo(() => {
    const data = [];
    const diffTime = Math.abs(filterDates.end - filterDates.start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const daysToMap = Math.min(diffDays, 60); // Max 60 bars to avoid UI clutter

    for (let i = daysToMap - 1; i >= 0; i--) {
      const d = new Date(filterDates.end);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString("es-ES", {
        month: "short",
        day: "numeric",
      });

      const dayTxs = filteredTransactions.filter((tx) => {
        if (!tx.date) return false;
        const txDate = tx.date.toDate();
        return (
          txDate.getDate() === d.getDate() &&
          txDate.getMonth() === d.getMonth() &&
          txDate.getFullYear() === d.getFullYear()
        );
      });

      const inputs = dayTxs
        .filter((tx) => tx.type === "IN" || tx.type === "entrada")
        .reduce(
          (acc, curr) =>
            acc + (Number(curr.quantity) || Number(curr.quantityBoxes) || 0),
          0,
        );
      const outputs = dayTxs
        .filter(
          (tx) =>
            tx.type === "OUT" || tx.type === "SALE" || tx.type === "salida",
        )
        .reduce(
          (acc, curr) =>
            acc +
            (Number(curr.quantity) ||
              Number(curr.quantitySoldBoxes) ||
              Number(curr.quantityBoxes) ||
              0),
          0,
        );

      // Add sale quantities from filteredSales if they are not represented as transactions (mejora de real-time)
      const saleOutputs = filteredSales
        .filter((sale) => {
          if (!sale.date) return false;
          const sd = sale.date.toDate();
          return (
            sd.getDate() === d.getDate() &&
            sd.getMonth() === d.getMonth() &&
            sd.getFullYear() === d.getFullYear()
          );
        })
        .reduce((acc, sale) => {
          if (sale.status !== "completed" && sale.status !== "pending_delivery")
            return acc;
          const qty = (sale.items || []).reduce(
            (sum, item) =>
              sum +
              (Number(item.quantitySoldBoxes) ||
                Number(item.quantitySoldUnits) ||
                Number(item.quantity) ||
                0),
            0,
          );
          return acc + qty;
        }, 0);

      data.push({
        name: dateStr,
        Entradas: inputs,
        Salidas: outputs + saleOutputs,
      });
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
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Panel Principal
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Resumen general y métricas clave
              </p>
            </div>

            {/* Filtros de Fecha */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setDateFilter("last7")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateFilter === "last7" ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
              >
                7 días
              </button>
              <button
                onClick={() => setDateFilter("last30")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateFilter === "last30" ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
              >
                30 días
              </button>
              <button
                onClick={() => setDateFilter("custom")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateFilter === "custom" ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
              >
                Personalizado
              </button>
            </div>
          </div>

          {dateFilter === "custom" && (
            <div className="max-w-screen-xl mx-auto mt-4 flex items-center gap-2 justify-end">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Seleccionar fecha:
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
          <div className="max-w-screen-xl mx-auto flex flex-col gap-8">
            {/* Rendimiento de Sucursal Actual - Barra Ancha */}
            {currentBranch && (
              <div className="w-full">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-slate-900 dark:text-white text-2xl font-bold leading-tight tracking-tight">
                      🏪 Rendimiento de {currentBranch.name}
                    </h2>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Sucursal actual</p>
                      <p className="text-xs text-slate-400">
                        {currentBranch.location || "Sin ubicación"}
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const currentBranchStat = branchStats.find(
                      (b) => b.id === currentBranch.id,
                    );
                    if (!currentBranchStat) {
                      return (
                        <div className="text-center py-10 text-slate-400">
                          <span className="material-symbols-outlined text-4xl mb-2 block">
                            store
                          </span>
                          <p className="text-sm">
                            No se pudo cargar la información de la sucursal.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Información Principal */}
                        <div className="lg:col-span-2">
                          <div className="flex items-center gap-4 mb-6">
                            <div className="p-4 rounded-xl bg-primary/10">
                              <span className="material-symbols-outlined text-3xl text-primary">
                                location_on
                              </span>
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                {currentBranch.name}
                              </h3>
                              <p className="text-slate-500 dark:text-slate-400">
                                {currentBranch.location || "Sin ubicación"}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                              <p className="text-xs text-slate-400 uppercase tracking-wider">
                                Productos
                              </p>
                              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {currentBranchStat.productCount}
                              </p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                              <p className="text-xs text-slate-400 uppercase tracking-wider">
                                Valor Estimado
                              </p>
                              <p className="text-xl font-bold text-slate-900 dark:text-white">
                                S/
                                {currentBranchStat.totalValue.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Barra de Stock */}
                        <div className="lg:col-span-2">
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg h-full">
                            <div className="flex justify-between items-center mb-4">
                              <h4 className="font-bold text-slate-900 dark:text-white">
                                Stock Total
                              </h4>
                              <span className="text-2xl font-bold text-primary">
                                {currentBranchStat.totalStock} cajas
                              </span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">
                                  Capacidad de almacenamiento
                                </span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  100%
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 h-4 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all duration-500"
                                  style={{ width: "100%" }}
                                ></div>
                              </div>
                              <p className="text-xs text-slate-400 text-center">
                                Basado en productos registrados
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* KPIs Superiores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
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
              </div> */}

              {/* <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex justify-between items-start">
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Categorías Activas</p>
                  <span className="material-symbols-outlined text-primary bg-primary/10 rounded-lg p-1">category</span>
                </div>
                <p className="text-slate-900 dark:text-white tracking-tight text-2xl font-bold">
                  {loading ? "..." : `${metrics.activeCategories} Cat.`}
                </p>
                <p className="text-slate-500 text-sm font-medium truncate">En esta sucursal</p>
              </div> */}

              {/* <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
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
              </div> */}

              {/* <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
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
              </div> */}
            </div>

            {/* Actividad y Movimientos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Gráfico de Entradas/Salidas */}
              <div className="lg:col-span-2 flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">
                    Flujo de Inventario
                  </h3>
                  <span className="material-symbols-outlined text-slate-400">
                    bar_chart
                  </span>
                </div>
                <div className="h-64 w-full">
                  {filteredTransactions.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-slate-400 text-sm italic">
                      Sin movimientos en este periodo
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RechartsTooltip
                          cursor={{ fill: "#f1f5f9" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "none",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          }}
                        />
                        <Bar
                          dataKey="Entradas"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                          barSize={20}
                        />
                        <Bar
                          dataKey="Salidas"
                          fill="#f43f5e"
                          radius={[4, 4, 0, 0]}
                          barSize={20}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Últimos Movimientos */}
              <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">
                    Actividad Reciente
                  </h3>
                  <span className="material-symbols-outlined text-slate-400">
                    history
                  </span>
                </div>
                <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
                  {loading ? (
                    <div className="flex justify-center items-center h-full">
                      <span className="material-symbols-outlined animate-spin text-2xl text-slate-300">
                        progress_activity
                      </span>
                    </div>
                  ) : filteredTransactions.length === 0 ? (
                    <p className="text-center text-slate-400 italic text-sm py-10">
                      No hay actividad reciente
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {filteredTransactions.slice(0, 5).map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 last:border-0 last:pb-0"
                        >
                          <div
                            className={`p-2 rounded-lg flex-shrink-0 ${tx.type === "IN" || tx.type === "entrada" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}
                          >
                            <span className="material-symbols-outlined text-sm">
                              {tx.type === "IN" || tx.type === "entrada"
                                ? "call_received"
                                : "call_made"}
                            </span>
                          </div>
                          <div className="flex flex-col flex-1 overflow-hidden">
                            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                              {tx.productName}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {tx.userName || userMap[tx.user] || tx.user}
                              {tx.type === "SALE" && tx.saleId
                                ? ` - ID: ${tx.saleId.slice(0, 8)}...`
                                : ""}
                            </p>
                          </div>
                          <div className="flex flex-col items-end flex-shrink-0">
                            <span
                              className={`text-sm font-bold ${tx.type === "IN" || tx.type === "entrada" ? "text-emerald-500" : "text-rose-500"}`}
                            >
                              {tx.type === "IN" || tx.type === "entrada"
                                ? "+"
                                : "-"}
                              {tx.quantity || tx.quantityBoxes || 0}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {tx.date?.toDate().toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Gráficos Principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              {/* Distribución por Categoría */}
              <div className="lg:col-span-2 flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
                <div className="flex justify-between items-center">
                  <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">
                    Categorías
                  </h3>
                  <span className="text-slate-500 text-[11px] font-medium uppercase tracking-wider">
                    Distribución
                  </span>
                </div>
                <div className="flex flex-1 items-center justify-center py-4">
                  {loading ? (
                    <span className="material-symbols-outlined animate-spin text-2xl text-slate-300">
                      progress_activity
                    </span>
                  ) : metrics.categoryStats.length === 0 ? (
                    <p className="text-slate-400 text-sm italic">
                      Sin datos de categorías
                    </p>
                  ) : (
                    <div className="flex flex-col md:flex-row items-center gap-8 w-full justify-center">
                      {/* Donut Chart SVG */}
                      <div className="relative w-40 h-40">
                        <svg
                          viewBox="0 0 36 36"
                          className="w-full h-full transform -rotate-90"
                        >
                          <circle
                            cx="18"
                            cy="18"
                            r="15.915"
                            fill="transparent"
                            stroke="#f3f3f3"
                            strokeWidth="3"
                          />
                          {(() => {
                            let offset = 0;
                            return metrics.categoryStats.map((cat, i) => {
                              const strokeDash = `${cat.percent} ${100 - cat.percent}`;
                              const currentOffset = offset;
                              offset += cat.percent;
                              // Dynamic colors based on branch theme
                              const baseColor =
                                currentBranch?.primaryColor || "#7553e1";
                              const opacity = 1 - i * 0.15; // Decrease opacity for each slice

                              return (
                                <circle
                                  key={i}
                                  cx="18"
                                  cy="18"
                                  r="15.915"
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
                          <p className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none">
                            {metrics.activeCategories}
                          </p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                            Total
                          </p>
                        </div>
                      </div>
                      {/* Legend */}
                      <div className="flex flex-col gap-2.5 max-h-[160px] overflow-y-auto px-2">
                        {metrics.categoryStats.slice(0, 5).map((cat, i) => {
                          const baseColor =
                            currentBranch?.primaryColor || "#7553e1";
                          const opacity = 1 - i * 0.15;
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: baseColor, opacity }}
                              />
                              <div className="flex flex-col min-w-[80px]">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate w-24">
                                  {cat.name}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium">
                                  {Math.round(cat.percent)}% ({cat.count})
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* Distribución de Valor */}
              <div className="lg:col-span-1 flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
                <div className="flex justify-between items-center">
                  <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">
                    Distribución de Valor
                  </h3>
                  <p className="text-emerald-600 dark:text-emerald-400 text-xs md:text-sm font-medium">
                    Top 5 Productos
                  </p>
                </div>
                <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">
                  Inventario
                </span>
                <div className="flex flex-col flex-1 gap-4 pt-4">
                  {loading ? (
                    <div className="flex justify-center items-center h-full">
                      <span className="material-symbols-outlined animate-spin text-2xl text-slate-300">
                        progress_activity
                      </span>
                    </div>
                  ) : metrics.topProducts.length === 0 ? (
                    <p className="text-center text-slate-400 italic text-sm py-10">
                      No hay productos suficientes
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {metrics.topProducts.map((p, i) => {
                        const stock = Number(p.stock || p.currentStock) || 0;
                        const price = Number(p.price || p.unitPrice) || 0;
                        const val = stock * price;
                        const maxVal =
                          (Number(
                            metrics.topProducts[0].stock ||
                              metrics.topProducts[0].currentStock,
                          ) || 0) *
                            (Number(
                              metrics.topProducts[0].price ||
                                metrics.topProducts[0].unitPrice,
                            ) || 0) || 1;
                        const percent = Math.round((val / maxVal) * 100);
                        return (
                          <div key={p.id} className="group">
                            <div className="flex justify-between items-end mb-1.5 px-1">
                              <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate w-3/4">
                                {p.name}
                              </p>
                              <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                                S/{val.toLocaleString()}
                              </p>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800/50 h-2.5 rounded-full overflow-hidden">
                              <div
                                className="bg-primary h-full rounded-full transition-all duration-700 shadow-sm"
                                style={{
                                  width: `${percent}%`,
                                  transitionDelay: `${i * 100}ms`,
                                }}
                              />
                            </div>
                            <div className="flex justify-between mt-1 px-1">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">
                                {p.sku || "N/A"}
                              </p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">
                                {stock} unidades
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Productos Más Vendidos */}
              <div className="lg:col-span-1 flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm max-h-[520px]">
                <div className="flex justify-between items-center">
                  <h4 className="text-slate-900 dark:text-white text-base font-bold leading-tight">
                    Más Vendidos
                  </h4>
                  <p className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                    Top 5
                  </p>
                </div>
                <div className="flex flex-col flex-1 gap-3 pt-2 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
                  {loading ? (
                    <div className="flex justify-center items-center h-full">
                      <span className="material-symbols-outlined animate-spin text-xl text-slate-300">
                        progress_activity
                      </span>
                    </div>
                  ) : metrics.topSoldProducts.length === 0 ? (
                    <p className="text-center text-slate-400 italic text-xs py-6">
                      Sin ventas
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {metrics.topSoldProducts.map((p, i) => {
                        const sold = p.soldQty;
                        const maxSold = metrics.topSoldProducts[0].soldQty || 1;
                        const percent = Math.round((sold / maxSold) * 100);
                        return (
                          <div key={p.id} className="group">
                            <div className="flex justify-between items-end mb-1 px-1">
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate w-3/4">
                                {p.name}
                              </p>
                              <p className="text-[10px] font-extrabold text-slate-900 dark:text-white">
                                {sold}
                              </p>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800/50 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full rounded-full transition-all duration-700 shadow-sm"
                                style={{
                                  width: `${percent}%`,
                                  transitionDelay: `${i * 100}ms`,
                                }}
                              />
                            </div>
                            <div className="flex justify-between mt-0.5 px-1">
                              <p className="text-[9px] text-slate-400 font-bold uppercase">
                                {p.sku || "N/A"}
                              </p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase">
                                und
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Nueva Sección de Ventas Recientes - OCULTA */}
            {/*
            <div className="flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-slate-900 dark:text-white text-xl font-bold leading-tight tracking-tight">Ventas del Periodo</h2>
                  <p className="text-slate-500 text-sm">Gestiona y visualiza los detalles de tus tickets</p>
                </div>
                
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start">
                  <button
                    onClick={() => setSalesViewMode('cards')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${salesViewMode === 'cards' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <span className="material-symbols-outlined text-[20px]">grid_view</span>
                    Tarjetas
                  </button>
                  <button
                    onClick={() => setSalesViewMode('table')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${salesViewMode === 'table' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <span className="material-symbols-outlined text-[20px]">table_rows</span>
                    Tabla
                  </button>
                </div>
              </div>

              {filteredSales.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-3xl text-slate-300">receipt_long</span>
                  </div>
                  <h3 className="text-slate-900 dark:text-white font-bold text-lg">Sin ventas registradas</h3>
                  <p className="text-slate-500 max-w-xs mx-auto mt-2 text-sm">No se encontraron ventas para el rango de fechas seleccionado en esta sucursal.</p>
                </div>
              ) : salesViewMode === 'cards' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredSales.map(sale => (
                    <div key={sale.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">Ticket</span>
                          <span className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{sale.ticketNumber || sale.id.substring(0, 8)}</span>
                        </div>
                        <div className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                          sale.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                          sale.status === 'pending_delivery' ? 'bg-blue-100 text-blue-600' :
                          sale.status === 'pending_payment' ? 'bg-amber-100 text-amber-600' :
                          sale.status === 'cancelled' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {sale.paymentMethod && (
                            <img src={PAYMENT_METHODS.find(m => m.id === sale.paymentMethod)?.icon} className="size-3 object-contain opacity-70" alt="" />
                          )}
                          {sale.status === 'completed' ? 'Entregado' :
                           sale.status === 'pending_delivery' ? 'En Despacho' :
                           sale.status === 'pending_payment' ? 'En Caja' :
                           sale.status === 'cancelled' ? 'Cancelado' : sale.status}
                        </div>
                      </div>
                      
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                          <span className="material-symbols-outlined text-[18px]">person</span>
                          <div className="flex flex-col truncate">
                            <span className="text-xs font-bold leading-tight">{sale.customerName || 'Cliente General'}</span>
                            <span className="text-[10px] opacity-70 italic">{sale.sellerName || 'Vendedor'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                          <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                          <span className="text-xs font-medium">{sale.date?.toDate().toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
                          <span className="text-xl font-black text-slate-900 dark:text-white">S/{sale.totalValue?.toLocaleString()}</span>
                        </div>
                        <button 
                          onClick={() => {
                            setSalesViewMode('table');
                            setExpandedSaleId(sale.id);
                          }}
                          className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary transition-all group-hover:bg-primary/5"
                        >
                          <span className="material-symbols-outlined">visibility</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Ticket</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Fecha</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Cliente / Vendedor</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Total</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Estado</th>
                          <th className="px-6 py-4"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredSales.map(sale => (
                          <React.Fragment key={sale.id}>
                            <tr 
                              className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer ${expandedSaleId === sale.id ? 'bg-primary/5' : ''}`}
                              onClick={() => setExpandedSaleId(expandedSaleId === sale.id ? null : sale.id)}
                            >
                              <td className="px-6 py-4">
                                <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight">{sale.ticketNumber || sale.id.substring(0, 8)}</span>
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400">
                                {sale.date?.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{sale.customerName || 'Cliente General'}</span>
                                  <span className="text-[10px] text-slate-400 italic">{sale.userName || sale.sellerName}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <span className="text-sm font-black text-slate-900 dark:text-white">S/{sale.totalValue?.toLocaleString()}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                  sale.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                                  sale.status === 'pending_delivery' ? 'bg-blue-100 text-blue-600' :
                                  sale.status === 'pending_payment' ? 'bg-amber-100 text-amber-600' :
                                  sale.status === 'cancelled' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {sale.paymentMethod && (
                                    <img src={PAYMENT_METHODS.find(m => m.id === sale.paymentMethod)?.icon} className="size-2.5 object-contain opacity-70" alt="" />
                                  )}
                                  {sale.status === 'completed' ? 'Entregado' :
                                   sale.status === 'pending_delivery' ? 'En Despacho' :
                                   sale.status === 'pending_payment' ? 'En Caja' :
                                   sale.status === 'cancelled' ? 'Cancelado' : sale.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button className="text-slate-400 hover:text-primary transition-colors">
                                  <span className="material-symbols-outlined">
                                    {expandedSaleId === sale.id ? 'expand_less' : 'expand_more'}
                                  </span>
                                </button>
                              </td>
                            </tr>
                            {expandedSaleId === sale.id && (
                              <tr className="bg-slate-50/50 dark:bg-slate-900/50">
                                <td colSpan="6" className="px-6 py-4">
                                  <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Detalle de productos</h4>
                                      <span className="text-[10px] font-bold text-slate-500 tracking-widest">{sale.items?.length || 0} ITEMS</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {sale.items?.map((item, idx) => (
                                        <div key={idx} className="flex flex-col p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                                          <div className="flex justify-between items-start mb-2">
                                            <p className="text-xs font-bold text-slate-800 dark:text-white line-clamp-1">{item.name || item.productName}</p>
                                            {item.isWholesale && (
                                              <span className="bg-primary/10 text-primary text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">MAYORISTA</span>
                                            )}
                                          </div>
                                          <div className="flex justify-between items-center text-[10px]">
                                            <div className="flex gap-3 text-slate-500">
                                              <span>Cant: <strong className="text-slate-700 dark:text-slate-300">{item.quantitySoldBoxes > 0 ? `${item.quantitySoldBoxes} paq` : `${item.quantitySoldUnits} und`}</strong></span>
                                              <span>Precio: <strong className="text-slate-700 dark:text-slate-300">S/{item.pricePerBox || item.pricePerUnit}</strong></span>
                                            </div>
                                            <span className="font-extrabold text-slate-900 dark:text-white">S/{item.subtotal?.toLocaleString()}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    {sale.customerDNI && (
                                      <div className="mt-2 text-[10px] text-slate-500">
                                        <p>DNI/RUC del Cliente: <span className="font-bold">{sale.customerDNI}</span></p>
                                      </div>
                                    )}
                                  </div>
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
            */}
            {/* Reportes Avanzados */}
            {(userRole === "admin" || userRole === "gerente") && (
              <div className="flex flex-col gap-6 mb-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-slate-900 dark:text-white text-xl font-bold leading-tight tracking-tight">
                    📊 Reportes Avanzados
                  </h2>
                </div>

                {/* Rotación de Inventario */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <div className="flex justify-between items-center">
                      <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">
                        📉 Productos que se venden rápido
                      </h3>
                    </div>
                    <div className="flex flex-col gap-3">
                      {metrics.fastSelling.length === 0 ? (
                        <p className="text-slate-400 text-sm italic">
                          No hay productos con ventas altas
                        </p>
                      ) : (
                        metrics.fastSelling.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
                          >
                            <div>
                              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                {p.name}
                              </p>
                              <p className="text-xs text-slate-400">
                                {p.sku || "N/A"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-emerald-600">
                                {p.soldQty} vendidos
                              </p>
                              <p className="text-xs text-slate-400">
                                Stock: {p.currentStock}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <div className="flex justify-between items-center">
                      <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">
                        🟡 Productos estancados
                      </h3>
                    </div>
                    <div className="flex flex-col gap-3">
                      {metrics.stagnant.length === 0 ? (
                        <p className="text-slate-400 text-sm italic">
                          No hay productos estancados
                        </p>
                      ) : (
                        metrics.stagnant.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
                          >
                            <div>
                              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                {p.name}
                              </p>
                              <p className="text-xs text-slate-400">
                                {p.sku || "N/A"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-amber-600">
                                {p.soldQty} vendidos
                              </p>
                              <p className="text-xs text-slate-400">
                                Stock: {p.currentStock}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <div className="flex justify-between items-center">
                      <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">
                        ❌ Productos sin ventas
                      </h3>
                    </div>
                    <div className="flex flex-col gap-3">
                      {metrics.noSales.length === 0 ? (
                        <p className="text-slate-400 text-sm italic">
                          Todos los productos tienen ventas
                        </p>
                      ) : (
                        metrics.noSales.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
                          >
                            <div>
                              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                {p.name}
                              </p>
                              <p className="text-xs text-slate-400">
                                {p.sku || "N/A"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-rose-600">
                                0 vendidos
                              </p>
                              <p className="text-xs text-slate-400">
                                Stock: {p.currentStock}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <div className="flex justify-between items-center">
                      <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">
                        📈 Ventas por Día
                      </h3>
                    </div>
                    <div className="text-center py-4">
                      <p className="text-4xl font-black text-primary mb-2">
                        S/{metrics.avgDailySales.toLocaleString()}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">
                        Promedio diario en el periodo
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                    <div className="flex justify-between items-center">
                      <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">
                        📊 Margen Global
                      </h3>
                    </div>
                    <div className="text-center py-4">
                      <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400 mb-2">
                        {metrics.globalMargin.toFixed(1)}%
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">
                        Margen de ganancia total
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                  <div className="flex justify-between items-center">
                    <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">
                      💸 ¿Qué productos me están haciendo perder dinero?
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {metrics.productRotation
                      .filter((p) => p.profit < 0 && p.soldQty > 0)
                      .sort((a, b) => a.profit - b.profit)
                      .slice(0, 6)
                      .map((p, i) => (
                        <div
                          key={p.id}
                          className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-4 border border-rose-200 dark:border-rose-800"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-rose-900 dark:text-rose-200 text-sm truncate">
                              {p.name}
                            </h4>
                            <span className="text-xs text-rose-400">
                              #{i + 1}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-xs text-rose-500">
                                Pérdida
                              </span>
                              <span className="text-sm font-bold text-rose-600">
                                S/{Math.abs(p.profit).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs text-rose-500">
                                Vendidos
                              </span>
                              <span className="text-sm font-bold text-rose-700">
                                {p.soldQty} und
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs text-rose-500">
                                Costo vs Precio
                              </span>
                              <span className="text-xs text-rose-600">
                                S/{p.cost} vs S/{p.price}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    {metrics.productRotation.filter(
                      (p) => p.profit < 0 && p.soldQty > 0,
                    ).length === 0 && (
                      <div className="col-span-full text-center py-8 text-slate-400">
                        <span className="material-symbols-outlined text-4xl mb-2 block">
                          check_circle
                        </span>
                        <p className="text-sm">
                          ¡Excelente! Ningún producto está generando pérdidas
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Reporte de Ventas Diarias - Solo cuando es personalizado */}
            {dateFilter === "custom" && (
              <div className="max-w-screen-xl mx-auto mt-8">
                <div className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                  <div className="flex justify-between items-center">
                    <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight">
                      📊 Ventas del Día -{" "}
                      {new Date(selectedDate).toLocaleDateString("es-ES", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </h3>
                    <button
                      onClick={() => {
                        const salesData = filteredTransactions.filter(
                          (tx) => tx.type === "SALE",
                        );
                        if (salesData.length === 0) {
                          alert("No hay ventas para este día");
                          return;
                        }

                        // Crear CSV
                        const headers = [
                          "Código Venta",
                          "Fecha",
                          "Producto",
                          "Cantidad",
                          "Subtotal",
                          "Usuario",
                        ];
                        const csvContent = [
                          headers.join(","),
                          ...salesData.map((tx) =>
                            [
                              tx.saleCode || tx.saleId || "N/A",
                              tx.date?.toDate().toLocaleString("es-ES") ||
                                selectedDate,
                              tx.productName || tx.productId || "N/A",
                              tx.quantityBoxes || tx.quantity || 0,
                              tx.subtotal || 0,
                              userMap[tx.userId] ||
                                tx.userName ||
                                tx.userEmail ||
                                "N/A",
                            ].join(","),
                          ),
                        ].join("\n");

                        // Descargar CSV
                        const blob = new Blob([csvContent], {
                          type: "text/csv;charset=utf-8;",
                        });
                        const link = document.createElement("a");
                        const url = URL.createObjectURL(blob);
                        link.setAttribute("href", url);
                        link.setAttribute(
                          "download",
                          `ventas_${selectedDate}.csv`,
                        );
                        link.style.visibility = "hidden";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      Generar Reporte
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-800 dark:text-slate-300">
                        <tr>
                          <th className="px-6 py-3">Código Venta</th>
                          <th className="px-6 py-3">Fecha y Hora</th>
                          <th className="px-6 py-3">Producto</th>
                          <th className="px-6 py-3">Cantidad</th>
                          <th className="px-6 py-3">Subtotal</th>
                          <th className="px-6 py-3">Usuario</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions
                          .filter((tx) => tx.type === "SALE")
                          .map((tx, index) => (
                            <tr
                              key={index}
                              className="bg-white border-b dark:bg-slate-900 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              <td className="px-6 py-4 text-slate-900 dark:text-white font-bold">
                                #{tx.saleCode || tx.saleId || "N/A"}
                              </td>
                              <td className="px-6 py-4 text-slate-900 dark:text-white">
                                {tx.date?.toDate().toLocaleString("es-ES") ||
                                  selectedDate}
                              </td>
                              <td className="px-6 py-4 text-slate-900 dark:text-white">
                                {tx.productName || tx.productId || "N/A"}
                              </td>
                              <td className="px-6 py-4 text-slate-900 dark:text-white">
                                {tx.quantityBoxes || tx.quantity || 0} cajas
                              </td>
                              <td className="px-6 py-4 text-slate-900 dark:text-white">
                                S/{(tx.subtotal || 0).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-slate-900 dark:text-white">
                                {userMap[tx.userId] ||
                                  tx.userName ||
                                  tx.userEmail ||
                                  "N/A"}
                              </td>
                            </tr>
                          ))}
                        {filteredTransactions.filter((tx) => tx.type === "SALE")
                          .length === 0 && (
                          <tr>
                            <td
                              colSpan="6"
                              className="px-6 py-8 text-center text-slate-400"
                            >
                              No hay ventas registradas para este día
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
