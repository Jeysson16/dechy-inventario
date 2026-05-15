import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, Skeleton, chartProps } from "./DashboardEjecutivo";

const ClientesModule = ({ data, loading, isDark }) => {
  if (!data) return null;
  const { topClientes = [], metodoPago = [], topVendedores = [] } = data;
  const { textColor, gridColor, tooltipStyle } = chartProps(isDark);

  const maxMonto = Math.max(...topClientes.map((c) => c.monto), 1);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={tooltipStyle} className="rounded-xl px-3 py-2 text-xs">
        <p className="font-bold mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: S/ {(p.value || 0).toLocaleString()}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">
            Reporte de Clientes
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Top clientes, vendedores y métodos de pago
          </p>
        </div>
        {!loading && topClientes.length > 0 && (
          <div className="text-center px-4 py-2 rounded-xl bg-primary/10 border border-primary/20">
            <p className="text-xl font-black text-primary">
              S/ {topClientes.reduce((a, c) => a + c.monto, 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-500">
              Total facturado a clientes
            </p>
          </div>
        )}
      </div>

      {/* Top clientes */}
      <Card
        title="Top 10 clientes por volumen de compras"
        icon="workspace_premium"
      >
        {loading ? (
          <Skeleton className="h-72" />
        ) : topClientes.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">
            Sin clientes con historial de compras
          </p>
        ) : (
          <div className="space-y-3">
            {topClientes.map((c, i) => {
              const pct = Math.round((c.monto / maxMonto) * 100);
              return (
                <div key={c.nombre} className="flex items-center gap-3">
                  <div
                    className={`size-7 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0 ${i >= 3 ? "bg-slate-100 dark:bg-slate-800" : ""}`}
                    style={{
                      background: i < 3 ? `${c.color}22` : undefined,
                      color: i < 3 ? c.color : "#94a3b8",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div
                    className="size-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                    style={{ background: `${c.color}22`, color: c.color }}
                  >
                    {c.inicial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {c.nombre}
                    </p>
                    <div className="mt-1 h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: c.color,
                          transition: "width 0.8s ease",
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      S/ {c.monto.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {c.compras} compras
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Método de pago */}
        <Card title="Ventas por método de pago" icon="payments">
          {loading ? (
            <Skeleton className="h-52" />
          ) : metodoPago.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">
              Sin datos de pago
            </p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={150} height={150}>
                <PieChart>
                  <Pie
                    data={metodoPago}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    outerRadius={65}
                    isAnimationActive
                    animationDuration={900}
                  >
                    {metodoPago.map((m, i) => (
                      <Cell key={i} fill={m.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => `S/ ${v.toLocaleString()}`}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5">
                {metodoPago.map((m) => (
                  <div key={m.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ background: m.fill }}
                        />
                        <span className="text-slate-600 dark:text-slate-400 font-semibold">
                          {m.name}
                        </span>
                      </div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {m.count} ventas
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 pl-3.5">
                      S/ {m.value.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Vendedores */}
        <Card title="Rendimiento por vendedor" icon="badge">
          {loading ? (
            <Skeleton className="h-52" />
          ) : topVendedores.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">
              Sin datos de vendedores
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={topVendedores.slice(0, 6)}
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
                  width={90}
                  tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="total"
                  name="total"
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
    </div>
  );
};

export default ClientesModule;
