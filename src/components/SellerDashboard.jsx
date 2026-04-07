import React, { useMemo } from "react";
import { useAuth } from "../context/AuthContext";

const SellerDashboard = ({ sales, dailyGoal }) => {
  const { currentUser } = useAuth();

  // Calcular ventas del día
  const todaySales = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return sales.filter((sale) => sale.date === today);
  }, [sales]);

  const totalToday = todaySales.reduce((sum, sale) => sum + sale.total, 0);
  const progress = dailyGoal > 0 ? (totalToday / dailyGoal) * 100 : 0;

  // Calcular ranking del vendedor
  const sellerRankings = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const sellerTotals = {};
    sales.forEach((sale) => {
      if (sale.date === today) {
        const sellerId = sale.sellerId;
        sellerTotals[sellerId] = (sellerTotals[sellerId] || 0) + sale.total;
      }
    });
    const sorted = Object.entries(sellerTotals).sort((a, b) => b[1] - a[1]);
    return sorted.findIndex(([id]) => id === currentUser.uid) + 1 || 1;
  }, [sales, currentUser.uid]);

  const ranking = sellerRankings;

  // Simular bono
  const bonusThreshold = 500;
  const remainingForBonus = Math.max(0, bonusThreshold - totalToday);

  // Producto sugerido (el más vendido hoy)
  const productCounts = {};
  todaySales.forEach((sale) => {
    sale.items.forEach((item) => {
      productCounts[item.name] =
        (productCounts[item.name] || 0) + item.quantity;
    });
  });
  const topProduct = Object.keys(productCounts).reduce(
    (a, b) => (productCounts[a] > productCounts[b] ? a : b),
    "Ninguno",
  );

  const getProgressColor = (progress) => {
    if (progress < 50) return "bg-red-500";
    if (progress < 80) return "bg-yellow-500";
    if (progress < 100) return "bg-green-500";
    return "bg-blue-500";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Meta Personal */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800/30 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <span className="material-symbols-outlined text-3xl text-blue-600">
            target
          </span>
          <div>
            <p className="text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
              Meta Personal
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200">Hoy</p>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-2xl font-black text-blue-900 dark:text-blue-100">
            {progress.toFixed(1)}%
          </p>
          <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${getProgressColor(progress)}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            ></div>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            S/ {totalToday.toFixed(2)} / S/ {dailyGoal.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Ventas del Día */}
      <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-2xl p-6 border border-green-200 dark:border-green-800/30 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <span className="material-symbols-outlined text-3xl text-green-600">
            attach_money
          </span>
          <div>
            <p className="text-green-600 dark:text-green-400 text-xs font-bold uppercase tracking-wider">
              Ventas del Día
            </p>
            <p className="text-sm text-green-800 dark:text-green-200">
              Total vendido
            </p>
          </div>
        </div>
        <p className="text-3xl font-black text-green-900 dark:text-green-100">
          S/ {totalToday.toFixed(2)}
        </p>
      </div>

      {/* Producto del Día */}
      <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-2xl p-6 border border-purple-200 dark:border-purple-800/30 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <span className="material-symbols-outlined text-3xl text-purple-600">
            local_offer
          </span>
          <div>
            <p className="text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider">
              Producto del Día
            </p>
            <p className="text-sm text-purple-800 dark:text-purple-200">
              Más vendido
            </p>
          </div>
        </div>
        <p className="text-lg font-bold text-purple-900 dark:text-purple-100 truncate">
          {topProduct}
        </p>
      </div>

      {/* Ranking del Vendedor */}
      <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-2xl p-6 border border-orange-200 dark:border-orange-800/30 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <span className="material-symbols-outlined text-3xl text-orange-600">
            leaderboard
          </span>
          <div>
            <p className="text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider">
              Tu Ranking
            </p>
            <p className="text-sm text-orange-800 dark:text-orange-200">
              Posición hoy
            </p>
          </div>
        </div>
        <p className="text-3xl font-black text-orange-900 dark:text-orange-100">
          #{ranking}
        </p>
        <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
          ¡Sigue así! 🎉
        </p>
      </div>

      {/* Bono / Incentivo */}
      <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 rounded-2xl p-6 border border-pink-200 dark:border-pink-800/30 shadow-lg md:col-span-2 lg:col-span-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="material-symbols-outlined text-3xl text-pink-600">
            celebration
          </span>
          <div>
            <p className="text-pink-600 dark:text-pink-400 text-xs font-bold uppercase tracking-wider">
              Bono Especial
            </p>
            <p className="text-sm text-pink-800 dark:text-pink-200">
              ¡Alcanza S/ 500 y gana un bono!
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-2xl font-black text-pink-900 dark:text-pink-100">
            Te faltan S/ {remainingForBonus.toFixed(2)}
          </p>
          <div className="text-right">
            <p className="text-sm text-pink-700 dark:text-pink-300">
              Progreso: {((totalToday / bonusThreshold) * 100).toFixed(1)}%
            </p>
            <div className="w-32 bg-pink-200 dark:bg-pink-800 rounded-full h-2 mt-1">
              <div
                className="bg-pink-500 h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min((totalToday / bonusThreshold) * 100, 100)}%`,
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerDashboard;
