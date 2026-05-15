import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { Card, Skeleton, chartProps } from "./DashboardEjecutivo";

const MovimientosModule = ({ data, loading, isDark }) => {
  if (!data) return null;
  const { entradas = [], salidas = [] } = data;
  const { textColor, gridColor, tooltipStyle } = chartProps(isDark);

  const totalEntradas = entradas.length;
  const totalSalidas = salidas.reduce((a, s) => a + s.ventas, 0);

  /* ── Build chart: last 7 days salidas ── */
  const salidasChart = salidas
    .slice(0, 7)
    .reverse()
    .map((s) => ({
      fecha: s.fecha,
      ventas: s.ventas,
      unidades: s.unidades,
      ingresos: s.ingresos,
    }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">
            Entradas y Salidas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Movimientos de stock en el período
          </p>
        </div>
        {!loading && (
          <div className="flex gap-3">
            <div className="text-center px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40">
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                {totalEntradas}
              </p>
              <p className="text-[11px] text-slate-500">Entradas de stock</p>
            </div>
            <div className="text-center px-4 py-2 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-xl font-black text-primary">{totalSalidas}</p>
              <p className="text-[11px] text-slate-500">Ventas (salidas)</p>
            </div>
          </div>
        )}
      </div>

      {/* Salidas por día chart */}
      <Card title="Salidas diarias (ventas)" icon="trending_down">
        {loading ? (
          <Skeleton className="h-56" />
        ) : salidasChart.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">
            Sin salidas en este período
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={salidasChart}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="fecha"
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
              <Line
                type="monotone"
                dataKey="ventas"
                name="Nro. ventas"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                dot={{ r: 4 }}
                isAnimationActive
                animationDuration={900}
              />
              <Line
                type="monotone"
                dataKey="unidades"
                name="Unidades salidas"
                stroke={isDark ? "#10b981" : "#059669"}
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive
                animationDuration={900}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Entradas */}
        <Card
          title="Entradas de stock recientes"
          icon="move_to_inbox"
          badge={
            !loading && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-semibold">
                {totalEntradas} registros
              </span>
            )
          }
        >
          {loading ? (
            <Skeleton className="h-64" />
          ) : entradas.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">
              Sin entradas registradas
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {entradas.map((e) => (
                <div
                  key={e.id}
                  className="rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {e.producto}
                      </p>
                      <p className="text-[11px] text-slate-400">{e.usuario}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {e.cajasUnidades}
                      </p>
                      {e.stockNuevo !== undefined && (
                        <p className="text-[10px] text-slate-400">
                          → {e.stockNuevo} cx total
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400">{e.fecha}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Salidas resumen */}
        <Card
          title="Resumen de salidas por día"
          icon="output"
          badge={
            !loading && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                {salidas.length} días
              </span>
            )
          }
        >
          {loading ? (
            <Skeleton className="h-64" />
          ) : salidas.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">
              Sin salidas en este período
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {salidas.map((s, i) => (
                <div
                  key={i}
                  className="rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-800 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {s.fecha}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {s.ventas} transacciones · {s.unidades} unidades
                    </p>
                  </div>
                  <p className="text-sm font-bold text-primary">
                    S/ {s.ingresos.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default MovimientosModule;
