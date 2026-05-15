import { useEffect, useState } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

/* ── Shared helpers ── */
export const Card = ({ title, icon, badge, children, className = "" }) => (
  <div
    className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm ${className}`}
  >
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {icon && (
          <span className="material-symbols-outlined text-[18px] text-primary">
            {icon}
          </span>
        )}
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {title}
        </h2>
      </div>
      {badge}
    </div>
    {children}
  </div>
);

export const Skeleton = ({ className = "" }) => (
  <div
    className={`animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700 ${className}`}
  />
);

export const chartProps = (isDark) => ({
  textColor: isDark ? "#64748b" : "#94a3b8",
  gridColor: isDark ? "#1e293b" : "#f1f5f9",
  tooltipStyle: {
    background: isDark ? "#0f172a" : "#fff",
    border: `1px solid ${isDark ? "#1e293b" : "#e2e8f0"}`,
    borderRadius: 10,
    fontSize: 12,
    color: isDark ? "#e2e8f0" : "#0f172a",
  },
});

/* ── Animated counter ── */
const useCounter = (target, duration = 1000) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) {
      setVal(0);
      return;
    }
    let cur = 0;
    const steps = 40;
    const inc = target / steps;
    const timer = setInterval(() => {
      cur = Math.min(cur + inc, target);
      setVal(Math.round(cur));
      if (cur >= target) clearInterval(timer);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target, duration]);
  return val;
};

const SparkKPI = ({
  label,
  value,
  prefix = "",
  suffix = "",
  data,
  color,
  trend,
}) => {
  const animated = useCounter(value);
  const sparkData = (data || []).map((v, i) => ({ i, v }));
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="text-2xl font-black mt-1 text-slate-900 dark:text-slate-100">
            {prefix}
            {animated.toLocaleString()}
            {suffix}
          </p>
        </div>
        {trend !== undefined && (
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${trend >= 0 ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400" : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"}`}
          >
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%
          </span>
        )}
      </div>
      {sparkData.length > 0 && (
        <div style={{ height: 44 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient
                  id={`sg${color?.replace("#", "")}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={2}
                fill={`url(#sg${color?.replace("#", "")})`}
                dot={false}
                isAnimationActive
                animationDuration={900}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

const AlertItem = ({ tipo, msg, modulo }) => {
  const cfg =
    {
      critico: {
        bg: "bg-red-50 dark:bg-red-950/40",
        border: "border-red-200 dark:border-red-800/60",
        color: "text-red-600 dark:text-red-400",
        icon: "error",
      },
      alerta: {
        bg: "bg-amber-50 dark:bg-amber-950/40",
        border: "border-amber-200 dark:border-amber-800/60",
        color: "text-amber-600 dark:text-amber-400",
        icon: "warning",
      },
      info: {
        bg: "bg-blue-50 dark:bg-blue-950/40",
        border: "border-blue-200 dark:border-blue-800/60",
        color: "text-blue-600 dark:text-blue-400",
        icon: "info",
      },
    }[tipo] || {};
  return (
    <div
      className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${cfg.bg} ${cfg.border}`}
    >
      <span
        className={`material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5 ${cfg.color}`}
      >
        {cfg.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">
          {msg}
        </p>
        <p className="text-[11px] mt-0.5 text-slate-400 dark:text-slate-500">
          {modulo}
        </p>
      </div>
    </div>
  );
};

const DashboardEjecutivo = ({ data, loading, isDark }) => {
  if (!data) return null;
  const { kpis = {}, sparkVentas = [], alertas = [] } = data;

  const kpiCards = [
    {
      label: "Ventas del período",
      value: kpis.ventasMes || 0,
      prefix: "S/ ",
      data: sparkVentas,
      color: "#6366f1",
      trend: undefined,
    },
    {
      label: "Total transacciones",
      value: kpis.totalVentas || 0,
      data: sparkVentas.map((v, i) => i),
      color: "#10b981",
    },
    {
      label: "Productos en sistema",
      value: kpis.totalProductos || 0,
      data: sparkVentas.map((_, i) => i * 2),
      color: "#f59e0b",
    },
    {
      label: "Clientes registrados",
      value: kpis.totalClientes || 0,
      data: sparkVentas.map((_, i) => i + 5),
      color: "#8b5cf6",
    },
  ];

  const miniStats = [
    {
      label: "Agotados",
      value: kpis.stockCritico || 0,
      icon: "inventory_2",
      badgeClass:
        "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400",
    },
    {
      label: "Stock bajo",
      value: kpis.enAlerta || 0,
      icon: "warning",
      badgeClass:
        "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
    },
    {
      label: "Clientes nuevos",
      value: kpis.clientesNuevos || 0,
      icon: "person_add",
      badgeClass:
        "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400",
    },
    {
      label: "Vendedores activos",
      value: data.topVendedores?.length || 0,
      icon: "badge",
      badgeClass:
        "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 rp-title">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">
            Dashboard Ejecutivo
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Resumen general del negocio
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <div className="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          )}
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Datos en tiempo real
          </span>
        </div>
      </div>

      {/* KPI sparklines */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((k, i) => (
            <div key={k.label} className={`rp-card-${i}`}>
              <SparkKPI {...k} />
            </div>
          ))}
        </div>
      )}

      {/* Mini stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 rp-section">
        {miniStats.map((s, i) => (
          <div
            key={s.label}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3 shadow-sm"
            style={{ animation: `rpScaleIn 0.3s cubic-bezier(.22,1,.36,1) ${0.08 + i * 0.06}s both` }}
          >
            <div
              className={`size-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.badgeClass}`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {s.icon}
              </span>
            </div>
            <div>
              {loading ? (
                <Skeleton className="h-6 w-12 mb-1" />
              ) : (
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 rp-kpi-val">
                  {s.value}
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {s.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Alertas */}
      <div className="rp-card-4">
      <Card
        title="Alertas del sistema"
        icon="notifications_active"
        badge={
          alertas.filter((a) => a.tipo === "critico").length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-bold">
              {alertas.filter((a) => a.tipo === "critico").length} críticas
            </span>
          )
        }
      >
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : alertas.length === 0 ? (
          <div className="py-8 text-center">
            <span className="material-symbols-outlined text-4xl text-emerald-500">
              check_circle
            </span>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Sin alertas activas
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {alertas.map((a, i) => (
              <div key={i} style={{ animation: `rpFadeUp 0.28s cubic-bezier(.22,1,.36,1) ${i * 0.07}s both` }}>
                <AlertItem {...a} />
              </div>
            ))}
          </div>
        )}
      </Card>
      </div>

      {/* Top vendedores mini */}
      {!loading && (data.topVendedores || []).length > 0 && (
        <div style={{ animation: "rpScaleIn 0.32s cubic-bezier(.22,1,.36,1) 0.18s both" }}>
        <Card title="Rendimiento por vendedor" icon="badge">
          <div className="space-y-2.5">
            {data.topVendedores.map((v, i) => (
              <div
                key={v.nombre}
                className="flex items-center gap-3"
                style={{ animation: `rpSlideRight 0.25s cubic-bezier(.22,1,.36,1) ${0.08 + i * 0.06}s both` }}
              >
                <div className="size-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {v.nombre}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {v.count} venta{v.count !== 1 ? "s" : ""}
                  </p>
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 flex-shrink-0">
                  S/ {v.total.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </Card>
        </div>
      )}

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
        .rp-section { animation: rpFadeUp 0.35s cubic-bezier(.22,1,.36,1) both; }
        .rp-card-0  { animation: rpScaleIn 0.3s cubic-bezier(.22,1,.36,1) 0.05s both; }
        .rp-card-1  { animation: rpScaleIn 0.3s cubic-bezier(.22,1,.36,1) 0.10s both; }
        .rp-card-2  { animation: rpScaleIn 0.3s cubic-bezier(.22,1,.36,1) 0.15s both; }
        .rp-card-3  { animation: rpScaleIn 0.3s cubic-bezier(.22,1,.36,1) 0.20s both; }
        .rp-card-4  { animation: rpScaleIn 0.3s cubic-bezier(.22,1,.36,1) 0.25s both; }
      `}</style>
    </div>
  );
};

export default DashboardEjecutivo;
