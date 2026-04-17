import React, { useMemo } from "react";

const AdminDashboard = ({ sales, allUsers, dateFilter }) => {
  const validSales = useMemo(
    () => sales.filter((sale) => sale.status !== "cancelled"),
    [sales],
  );

  // Top vendedores
  const topSellers = useMemo(() => {
    const sellerTotals = {};
    const sellerCounts = {};
    const sellerLabels = {};

    validSales
      .filter((sale) =>
        ["pending_payment", "pending_delivery", "completed", "paid"].includes(
          sale.status,
        ),
      )
      .forEach((sale) => {
        const sellerId =
          sale.sellerId || sale.userId || sale.user?.uid || "unknown";
        const totalValue = Number(sale.totalValue || sale.total || 0);
        sellerTotals[sellerId] = (sellerTotals[sellerId] || 0) + totalValue;
        sellerCounts[sellerId] = (sellerCounts[sellerId] || 0) + 1;
        if (!sellerLabels[sellerId]) {
          sellerLabels[sellerId] =
            sale.userName || sale.sellerName || sale.customerName || sellerId;
        }
      });

    return Object.entries(sellerTotals)
      .map(([sellerId, total]) => {
        const seller = allUsers.find(
          (u) =>
            u.uid === sellerId ||
            u.email === sellerId ||
            u.name === sellerId ||
            u.displayName === sellerId,
        );
        const name =
          seller?.name ||
          seller?.displayName ||
          seller?.email ||
          sellerLabels[sellerId] ||
          "Desconocido";
        const avatar = seller?.avatarUrl || seller?.photoURL || null;
        return {
          sellerId,
          name,
          avatar,
          total,
          count: sellerCounts[sellerId] || 0,
        };
      })
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.total - a.total;
      })
      .slice(0, 5);
  }, [validSales, allUsers]);

  // Top productos
  const topProducts = useMemo(() => {
    const productTotals = {};
    validSales
      .filter((sale) =>
        ["pending_delivery", "completed", "paid"].includes(sale.status),
      )
      .forEach((sale) => {
        (sale.items || []).forEach((item) => {
          const key =
            item.productId || item.productName || item.name || "Desconocido";
          if (!productTotals[key]) {
            productTotals[key] = {
              name: item.productName || item.name || "Desconocido",
              quantity: 0,
              image: item.imageUrl || item.productImage || item.image || null,
            };
          }
          productTotals[key].quantity += Number(
            item.quantitySoldUnits || item.quantity || 0,
          );
        });
      });
    return Object.values(productTotals)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [validSales]);

  // Ganancia total
  const totalRevenue = validSales.reduce(
    (sum, sale) => sum + Number(sale.totalValue || sale.total || 0),
    0,
  );

  // % metas cumplidas (simular)
  const metasCumplidas = 75; // Ejemplo

  return (
    <div className="space-y-8">
      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-2xl p-6 border border-indigo-200 dark:border-indigo-800/30 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-3xl text-indigo-600">
              analytics
            </span>
            <div>
              <p className="text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
                Ganancia Total
              </p>
              <p className="text-sm text-indigo-800 dark:text-indigo-200">
                {dateFilter === "today"
                  ? "Hoy"
                  : dateFilter === "week"
                    ? "Últimos 7 días"
                    : dateFilter === "month"
                      ? "Últimos 30 días"
                      : "Período personalizado"}
              </p>
            </div>
          </div>
          <p className="text-3xl font-black text-indigo-900 dark:text-indigo-100">
            S/ {totalRevenue.toFixed(2)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20 rounded-2xl p-6 border border-teal-200 dark:border-teal-800/30 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-3xl text-teal-600">
              check_circle
            </span>
            <div>
              <p className="text-teal-600 dark:text-teal-400 text-xs font-bold uppercase tracking-wider">
                Metas Cumplidas
              </p>
              <p className="text-sm text-teal-800 dark:text-teal-200">Global</p>
            </div>
          </div>
          <p className="text-3xl font-black text-teal-900 dark:text-teal-100">
            {metasCumplidas}%
          </p>
        </div>

        <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20 rounded-2xl p-6 border border-cyan-200 dark:border-cyan-800/30 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-3xl text-cyan-600">
              shopping_cart
            </span>
            <div>
              <p className="text-cyan-600 dark:text-cyan-400 text-xs font-bold uppercase tracking-wider">
                Ventas Totales
              </p>
              <p className="text-sm text-cyan-800 dark:text-cyan-200">
                Este mes
              </p>
            </div>
          </div>
          <p className="text-3xl font-black text-cyan-900 dark:text-cyan-100">
            {validSales.length}
          </p>
        </div>
      </div>

      {/* Top Vendedores y Top Productos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-lg">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl text-slate-600">
              person
            </span>
            Top Vendedores
          </h3>
          <div className="space-y-3">
            {topSellers.map((seller, index) => (
              <div
                key={seller.sellerId}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center text-slate-500 dark:text-slate-300 text-sm font-bold">
                      {seller.avatar ? (
                        <img
                          src={seller.avatar}
                          alt={seller.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        seller.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center border-2 border-white dark:border-slate-900">
                      {index + 1}
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {seller.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {seller.count} venta{seller.count === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Total
                  </p>
                  <p className="font-bold text-primary">
                    S/ {seller.total.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-lg">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl text-slate-600">
              inventory
            </span>
            Top Productos
          </h3>
          <div className="space-y-3">
            {topProducts.map((product, index) => (
              <div
                key={product.name}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 text-sm font-bold">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">
                      {product.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {product.quantity} unidades
                    </p>
                  </div>
                </div>
                <span className="font-bold text-secondary">
                  {product.quantity} unds
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
