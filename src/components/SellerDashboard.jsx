import React, { useMemo } from "react";
import { useAuth } from "../context/AuthContext";

const TEAM_BONUS_LEVELS = [
  { level: 1, target: 100000, bonusPerPerson: 100 },
  { level: 2, target: 200000, bonusPerPerson: 200 },
  { level: 3, target: 300000, bonusPerPerson: 400 },
  { level: 4, target: 400000, bonusPerPerson: 600 },
  { level: 5, target: 500000, bonusPerPerson: 800 },
  { level: 6, target: 600000, bonusPerPerson: 1200 },
];

const SellerDashboard = ({
  sales,
  teamSales = [],
  dailyGoal,
  dateFilter,
  rankingOnly = false,
}) => {
  const { currentUser } = useAuth();
  const bonusSalesSource = teamSales.length > 0 ? teamSales : sales;

  const validSales = useMemo(
    () => sales.filter((sale) => sale.status !== "cancelled"),
    [sales],
  );

  const sellerSales = useMemo(
    () => validSales.filter((sale) => sale.sellerId === currentUser?.uid),
    [validSales, currentUser?.uid],
  );

  const totalPeriod = sellerSales.reduce(
    (sum, sale) => sum + Number(sale.totalValue || 0),
    0,
  );
  const totalTransactions = sellerSales.length;
  const progress = dailyGoal > 0 ? (totalPeriod / dailyGoal) * 100 : 0;

  const rankingSource = useMemo(
    () => (teamSales.length > 0 ? teamSales : validSales),
    [teamSales, validSales],
  );

  const ranking = useMemo(() => {
    const sellerTotals = {};
    rankingSource
      .filter((sale) => sale.status !== "cancelled")
      .forEach((sale) => {
        const sellerId = sale.sellerId || "unknown";
        sellerTotals[sellerId] =
          (sellerTotals[sellerId] || 0) + Number(sale.totalValue || 0);
      });

    const sorted = Object.entries(sellerTotals).sort((a, b) => b[1] - a[1]);
    const position = sorted.findIndex(([id]) => id === currentUser?.uid);
    return position >= 0 ? position + 1 : 1;
  }, [rankingSource, currentUser?.uid]);

  const resolveDate = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === "function") return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const teamMonthlyTotal = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      0,
      0,
      0,
      0,
    );
    const nextMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1,
      0,
      0,
      0,
      0,
    );

    return bonusSalesSource.reduce((sum, sale) => {
      if (sale.status === "cancelled") return sum;
      const saleDate = resolveDate(sale.date);
      if (!saleDate) return sum;
      if (saleDate < monthStart || saleDate >= nextMonthStart) return sum;
      return sum + Number(sale.totalValue || 0);
    }, 0);
  }, [bonusSalesSource]);

  const currentBonusLevel = useMemo(() => {
    return TEAM_BONUS_LEVELS.reduce(
      (acc, level) => (teamMonthlyTotal >= level.target ? level : acc),
      null,
    );
  }, [teamMonthlyTotal]);

  const nextBonusLevel = useMemo(() => {
    return (
      TEAM_BONUS_LEVELS.find((level) => teamMonthlyTotal < level.target) || null
    );
  }, [teamMonthlyTotal]);

  const remainingForNextLevel = Math.max(
    0,
    (nextBonusLevel?.target ||
      TEAM_BONUS_LEVELS[TEAM_BONUS_LEVELS.length - 1].target) -
      teamMonthlyTotal,
  );

  const teamBonusProgress =
    TEAM_BONUS_LEVELS.length > 0
      ? Math.min(
          (teamMonthlyTotal /
            TEAM_BONUS_LEVELS[TEAM_BONUS_LEVELS.length - 1].target) *
            100,
          100,
        )
      : 0;

  const productCounts = {};
  sellerSales.forEach((sale) => {
    (sale.items || []).forEach((item) => {
      const name = item.productName || item.name || "Sin nombre";
      const quantity =
        Number(item.quantitySoldUnits || 0) +
        Number(item.quantitySoldBoxes || 0);
      productCounts[name] = (productCounts[name] || 0) + quantity;
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

  if (rankingOnly) {
    return (
      <div className="grid grid-cols-1 gap-6">
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
                Posicion actual
              </p>
            </div>
          </div>
          <p className="text-4xl font-black text-orange-900 dark:text-orange-100">
            #{ranking}
          </p>
        </div>
      </div>
    );
  }

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
            S/ {totalPeriod.toFixed(2)} / S/ {dailyGoal.toFixed(2)}
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
              Ventas ({dateFilter || "hoy"})
            </p>
            <p className="text-sm text-green-800 dark:text-green-200">
              Total vendido
            </p>
          </div>
        </div>
        <p className="text-3xl font-black text-green-900 dark:text-green-100">
          S/ {totalPeriod.toFixed(2)}
        </p>
        <p className="text-xs text-green-700 dark:text-green-300 mt-2">
          {totalTransactions} transaccion{totalTransactions === 1 ? "" : "es"}
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
              Posición actual
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
              Bono por equipo mensual (reinicia cada inicio de mes)
            </p>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-sm text-pink-700 dark:text-pink-300 font-bold uppercase tracking-wider">
              Ventas acumuladas del equipo (mes actual)
            </p>
            <p className="text-2xl font-black text-pink-900 dark:text-pink-100">
              S/ {teamMonthlyTotal.toFixed(2)}
            </p>
            <p className="text-sm text-pink-700 dark:text-pink-300 mt-1">
              Nivel actual: {currentBonusLevel ? currentBonusLevel.level : 0} ·
              Bono por persona: S/{" "}
              {(currentBonusLevel?.bonusPerPerson || 0).toFixed(2)}
            </p>
            <p className="text-sm text-pink-700 dark:text-pink-300 mt-1">
              {nextBonusLevel
                ? `Faltan S/ ${remainingForNextLevel.toFixed(2)} para Nivel ${nextBonusLevel.level} (S/ ${nextBonusLevel.target.toLocaleString("es-PE")})`
                : "Nivel máximo alcanzado este mes."}
            </p>
          </div>
          <div className="min-w-[220px]">
            <p className="text-sm text-pink-700 dark:text-pink-300 text-right">
              Progreso niveles: {teamBonusProgress.toFixed(1)}%
            </p>
            <div className="w-full bg-pink-200 dark:bg-pink-800 rounded-full h-2 mt-1">
              <div
                className="bg-pink-500 h-2 rounded-full transition-all"
                style={{ width: `${teamBonusProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerDashboard;
