import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, Skeleton, chartProps } from "./DashboardEjecutivo";

/* ── Stock row with photo ── */
const StockRow = ({
  nombre,
  categoria,
  stockActual,
  stockMinimo,
  estado,
  sku,
  imageUrl,
  index,
}) => {
  const pct = Math.min(
    100,
    stockMinimo > 0 ? Math.round((stockActual / stockMinimo) * 100) : 100,
  );
  const cfg =
    {
      ok: {
        bar: "bg-emerald-500",
        badge:
          "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400",
        label: "OK",
        dot: "bg-emerald-500",
      },
      alerta: {
        bar: "bg-amber-500",
        badge:
          "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
        label: "Alerta",
        dot: "bg-amber-500",
      },
      critico: {
        bar: "bg-red-500",
        badge: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400",
        label: "Crítico",
        dot: "bg-red-500",
      },
    }[estado] || {};

  return (
    <div
      className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0 group"
      style={{
        animation: `rowIn 0.25s ease both`,
        animationDelay: `${index * 35}ms`,
      }}
    >
      {/* Rank */}
      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-5 text-right flex-shrink-0">
        {index + 1}
      </span>

      {/* Photo */}
      <div className="size-10 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={nombre}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.parentElement.classList.add(
                "flex",
                "items-center",
                "justify-center",
              );
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px] text-slate-400">
              inventory_2
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <div className={`size-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
            {nombre}
          </p>
        </div>
        <p className="text-[11px] text-slate-400 truncate">
          {categoria} · {sku}
        </p>
      </div>

      {/* Bar */}
      <div className="w-20 hidden sm:block flex-shrink-0">
        <div className="h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
          <div
            className={`h-full rounded-full ${cfg.bar}`}
            style={{
              width: `${pct}%`,
              transition: `width 0.7s ease ${index * 35}ms`,
            }}
          />
        </div>
        <p className="text-[10px] text-slate-400 mt-0.5 text-right">
          {pct}% del mín.
        </p>
      </div>

      {/* Stock numbers */}
      <div className="text-right w-16 flex-shrink-0">
        <p className="text-base font-black text-slate-900 dark:text-slate-100 tabular-nums">
          {stockActual}
        </p>
        <p className="text-[10px] text-slate-400">mín {stockMinimo}</p>
      </div>

      {/* Badge */}
      <span
        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 w-14 text-center ${cfg.badge}`}
      >
        {cfg.label}
      </span>
    </div>
  );
};

const InventarioModule = ({ data, loading, isDark }) => {
  const [catFilter, setCatFilter] = useState("Todas");
  const { stockData = [], mermas = [] } = data || {};
  const { textColor, gridColor, tooltipStyle } = chartProps(isDark);

  /* ── Categories from real data ── */
  const categories = useMemo(() => {
    const set = new Set(stockData.map((p) => p.categoria));
    return ["Todas", ...Array.from(set).sort()];
  }, [stockData]);

  /* ── Filtered + sorted (ya vienen ordenados asc de menor a mayor) ── */
  const filtered = useMemo(() => {
    if (catFilter === "Todas") return stockData;
    return stockData.filter((p) => p.categoria === catFilter);
  }, [stockData, catFilter]);

  const criticos = filtered.filter((s) => s.estado === "critico").length;
  const alertas = filtered.filter((s) => s.estado === "alerta").length;
  const ok = filtered.filter((s) => s.estado === "ok").length;

  /* ── Chart data (top 10 filtered) ── */
  const stockChartData = filtered.slice(0, 10).map((p) => ({
    nombre: p.nombre.length > 14 ? p.nombre.slice(0, 14) + "…" : p.nombre,
    actual: p.stockActual,
    minimo: p.stockMinimo,
  }));

  return (
    <div className="p-6 space-y-5">
      <style>{`
        @keyframes rowIn {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">
            Reporte de Inventario
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Stock de menor a mayor · {filtered.length} producto
            {filtered.length !== 1 ? "s" : ""}
            {catFilter !== "Todas" ? ` en "${catFilter}"` : ""}
          </p>
        </div>
        {!loading && (
          <div className="flex gap-2 flex-wrap">
            {[
              {
                label: "Críticos",
                value: criticos,
                cls: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/40",
              },
              {
                label: "En alerta",
                value: alertas,
                cls: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40",
              },
              {
                label: "OK",
                value: ok,
                cls: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40",
              },
            ].map((s) => (
              <div
                key={s.label}
                className={`text-center px-3 py-1.5 rounded-xl border ${s.cls}`}
              >
                <p className="text-lg font-black">{s.value}</p>
                <p className="text-[11px]">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Category filter pills ── */}
      {!loading && categories.length > 1 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 px-1">
            Filtrar por categoría
          </p>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => {
              const isActive = catFilter === cat;
              const count =
                cat === "Todas"
                  ? stockData.length
                  : stockData.filter((p) => p.categoria === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setCatFilter(cat)}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                    isActive
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary"
                  }`}
                >
                  {cat}
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-500"}`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Stock list ── */}
      <Card
        title="Nivel de stock (menor → mayor)"
        icon="inventory_2"
        badge={
          !loading &&
          criticos > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-bold">
              {criticos} agotados
            </span>
          )
        }
      >
        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <Skeleton className="size-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2 w-1/2" />
                </div>
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">
              search_off
            </span>
            <p className="text-sm text-slate-400 mt-2">
              Sin productos en esta categoría
            </p>
          </div>
        ) : (
          <div className="max-h-[520px] overflow-y-auto pr-1 -mr-1">
            {/* Column headers */}
            <div className="flex items-center gap-3 pb-2 mb-1 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <span className="w-5" />
              <span className="w-10 flex-shrink-0" />
              <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Producto
              </span>
              <span className="w-20 hidden sm:block text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-right">
                Progreso
              </span>
              <span className="w-16 text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-right">
                Stock
              </span>
              <span className="w-14 text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-center">
                Estado
              </span>
            </div>

            {filtered.map((s, i) => (
              <StockRow key={s.nombre + s.sku} {...s} index={i} />
            ))}
          </div>
        )}
      </Card>

      {/* ── Chart actual vs mínimo ── */}
      {!loading && stockChartData.length > 0 && (
        <Card
          title={`Stock actual vs mínimo${catFilter !== "Todas" ? ` — ${catFilter}` : ""}`}
          icon="bar_chart"
        >
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={stockChartData} margin={{ left: 0, right: 12 }}>
              <defs>
                <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-primary)"
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-primary)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="nombre"
                tick={{ fill: textColor, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: textColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: textColor }} />
              <Area
                type="monotone"
                dataKey="actual"
                name="Stock actual"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fill="url(#gradActual)"
                isAnimationActive
                animationDuration={900}
              />
              <Area
                type="monotone"
                dataKey="minimo"
                name="Mínimo requerido"
                stroke={isDark ? "#f87171" : "#ef4444"}
                strokeWidth={1.5}
                strokeDasharray="5 3"
                fill="none"
                isAnimationActive
                animationDuration={900}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ── Mermas ── */}
      <Card
        title="Pérdidas y mermas registradas"
        icon="delete_sweep"
        badge={
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
            {mermas.length} registros
          </span>
        }
      >
        {loading ? (
          <Skeleton className="h-24" />
        ) : mermas.length === 0 ? (
          <div className="py-6 text-center">
            <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">
              check_circle
            </span>
            <p className="text-sm text-slate-400 mt-2">
              Sin mermas registradas
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Se muestran transacciones con tipo "merma" registradas en Ingresos
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {mermas.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {m.productName || "–"}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {m.userEmail || "–"}
                  </p>
                </div>
                <div className="text-right ml-auto">
                  <p className="text-sm font-bold text-red-600 dark:text-red-400">
                    {m.quantityBoxes || 0}cx / {m.quantityUnits || 0}u
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {m.date?.toDate
                      ? m.date.toDate().toLocaleDateString("es-PE")
                      : "–"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default InventarioModule;
