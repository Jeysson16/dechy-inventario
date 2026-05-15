import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, Skeleton, chartProps } from "./DashboardEjecutivo";

const VentasModule = ({ data, loading, isDark }) => {
  if (!data) return null;
  const {
    topProductos = [],
    porCategoria = [],
    ganancias = [],
    sinVentas = [],
  } = data;
  const { textColor, gridColor, tooltipStyle } = chartProps(isDark);

  const totalIngresos = topProductos.reduce((a, p) => a + p.ingresos, 0);
  const totalUnidades = topProductos.reduce((a, p) => a + p.unidades, 0);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={tooltipStyle} className="rounded-xl px-3 py-2 text-xs">
        <p className="font-bold mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}:{" "}
            {p.name === "ingresos" || p.name?.includes("S/")
              ? `S/ ${(p.value || 0).toLocaleString()}`
              : (p.value || 0).toLocaleString()}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 rp-title">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">
            Reporte de Ventas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Productos, categorías y ganancias
          </p>
        </div>
        {!loading && (
          <div className="flex gap-3 rp-card-1">
            <div className="text-center px-4 py-2 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-lg font-black text-primary rp-kpi-val">
                S/ {totalIngresos.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500">Ingresos totales</p>
            </div>
            <div className="text-center px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40">
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 rp-kpi-val">
                {totalUnidades.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500">Unidades vendidas</p>
            </div>
          </div>
        )}
      </div>

      {/* Top productos + ganancias */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rp-card-2">
        <Card title="Productos más vendidos por ingresos" icon="trending_up">
          {loading ? (
            <Skeleton className="h-56" />
          ) : topProductos.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">
              Sin ventas en este período
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={topProductos.slice(0, 7)}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  type="number"
                  tick={{ fill: textColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `S/${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="nombre"
                  width={120}
                  tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="ingresos"
                  name="ingresos"
                  fill="var(--color-primary)"
                  radius={[0, 4, 4, 0]}
                  isAnimationActive
                  animationDuration={900}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        </div>

        <div className="rp-card-3">
        <Card title="Ganancias: esta semana vs anterior" icon="show_chart">
          {loading ? (
            <Skeleton className="h-56" />
          ) : ganancias.every((d) => d.hoy === 0 && d.anterior === 0) ? (
            <p className="text-sm text-slate-400 py-8 text-center">
              Sin datos de ventas recientes
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={ganancias}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="fecha"
                  tick={{ fill: textColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: textColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `S/${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: textColor }} />
                <Line
                  type="monotone"
                  dataKey="hoy"
                  name="Esta semana"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  isAnimationActive
                  animationDuration={900}
                />
                <Line
                  type="monotone"
                  dataKey="anterior"
                  name="Semana anterior"
                  stroke={isDark ? "#334155" : "#cbd5e1"}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive
                  animationDuration={900}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
        </div>
      </div>

      {/* Ventas por categoría + sin ventas */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rp-card-4">
        <Card title="Ventas por categoría" icon="category">
          {loading ? (
            <Skeleton className="h-52" />
          ) : porCategoria.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">Sin datos</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={porCategoria}
                    dataKey="ingresos"
                    nameKey="categoria"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    isAnimationActive
                    animationDuration={900}
                  >
                    {porCategoria.map((c, i) => (
                      <Cell key={i} fill={c.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => `S/ ${v.toLocaleString()}`}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {porCategoria.map((c, i) => (
                  <div
                    key={c.categoria}
                    className="flex items-center justify-between text-sm"
                    style={{ animation: `rpSlideRight 0.25s cubic-bezier(.22,1,.36,1) ${i * 0.06}s both` }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: c.fill }}
                      />
                      <span className="text-slate-600 dark:text-slate-400 text-xs truncate max-w-[100px]">
                        {c.categoria}
                      </span>
                    </div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                      S/ {c.ingresos.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
        </div>

        <div className="rp-card-4" style={{ animationDelay: "0.08s" }}>
        <Card
          title="Productos sin ventas en el período"
          icon="remove_shopping_cart"
          badge={
            !loading &&
            sinVentas.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-bold">
                {sinVentas.length} productos
              </span>
            )
          }
        >
          {loading ? (
            <Skeleton className="h-52" />
          ) : sinVentas.length === 0 ? (
            <div className="py-8 text-center">
              <span className="material-symbols-outlined text-4xl text-emerald-500">
                thumb_up
              </span>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Todos los productos tuvieron ventas
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {sinVentas.map((p, i) => (
                <div
                  key={p.nombre}
                  className="flex items-center justify-between rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800"
                  style={{ animation: `rpFadeUp 0.22s cubic-bezier(.22,1,.36,1) ${i * 0.04}s both` }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {p.nombre}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {p.categoria} · SKU: {p.sku}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {p.stock} ud.
                    </p>
                    <span
                      className={`text-[10px] font-semibold ${p.status === "Agotado" ? "text-red-500" : p.status === "Stock Bajo" ? "text-amber-500" : "text-slate-400"}`}
                    >
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        </div>
      </div>

      <style>{`
        @keyframes rpFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes rpSlideRight {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes rpScaleIn {
          from { opacity: 0; transform: scale(0.94); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes rpCountUp {
          from { opacity: 0; transform: translateY(8px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .rp-kpi-val { animation: rpCountUp 0.4s cubic-bezier(.22,1,.36,1) 0.12s both; }
        .rp-title   { animation: rpSlideRight 0.3s cubic-bezier(.22,1,.36,1) 0.04s both; }
        .rp-card-1  { animation: rpScaleIn 0.3s cubic-bezier(.22,1,.36,1) 0.10s both; }
        .rp-card-2  { animation: rpScaleIn 0.3s cubic-bezier(.22,1,.36,1) 0.15s both; }
        .rp-card-3  { animation: rpScaleIn 0.3s cubic-bezier(.22,1,.36,1) 0.20s both; }
        .rp-card-4  { animation: rpScaleIn 0.3s cubic-bezier(.22,1,.36,1) 0.25s both; }
      `}</style>
    </div>
  );
};

export default VentasModule;
