import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  MOCK_ORDENES,
  MOCK_PROVEEDORES,
  MOCK_COSTOS_PRECIOS,
} from "../mockData";

const Card = ({ title, icon, children, className = "" }) => (
  <div
    className={`rounded-2xl p-5 ${className}`}
    style={{ background: "#0d1117", border: "1px solid #1e2a3a" }}
  >
    <div className="flex items-center gap-2 mb-4">
      <span
        className="material-symbols-outlined text-[18px]"
        style={{ color: "#00d4ff" }}
      >
        {icon}
      </span>
      <h2 className="text-sm font-bold" style={{ color: "#e2e8f0" }}>
        {title}
      </h2>
    </div>
    {children}
  </div>
);

const EstadoBadge = ({ estado }) => {
  const map = {
    recibido: { bg: "#00ff9d18", color: "#00ff9d" },
    "en-transito": { bg: "#00d4ff18", color: "#00d4ff" },
    pendiente: { bg: "#f59e0b18", color: "#f59e0b" },
    cancelado: { bg: "#ef444418", color: "#ef4444" },
  };
  const s = map[estado] || map.pendiente;
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
      style={{ background: s.bg, color: s.color }}
    >
      {estado.replace("-", " ")}
    </span>
  );
};

const StarRating = ({ rating }) => {
  const full = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          className="material-symbols-outlined text-[12px]"
          style={{ color: s <= full ? "#f59e0b" : "#1e2a3a" }}
        >
          star
        </span>
      ))}
      <span className="text-[11px] ml-1 font-bold" style={{ color: "#94a3b8" }}>
        {rating}
      </span>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs"
      style={{
        background: "#0d1117",
        border: "1px solid #1e2a3a",
        color: "#e2e8f0",
      }}
    >
      <p className="font-bold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: S/ {p.value}
        </p>
      ))}
    </div>
  );
};

const ComprasModule = () => {
  const totalOrdenes = MOCK_ORDENES.reduce((a, o) => a + o.monto, 0);
  const recibidas = MOCK_ORDENES.filter((o) => o.estado === "recibido").length;

  return (
    <div className="p-6 space-y-6" style={{ color: "#e2e8f0" }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: "#e2e8f0" }}>
            Reporte de Compras
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#475569" }}>
            Órdenes de compra y proveedores
          </p>
        </div>
        <div className="flex gap-3">
          <div
            className="text-center px-4 py-2 rounded-xl"
            style={{ background: "#00d4ff18", border: "1px solid #00d4ff33" }}
          >
            <p className="text-xl font-black" style={{ color: "#00d4ff" }}>
              S/ {totalOrdenes.toLocaleString()}
            </p>
            <p className="text-[11px]" style={{ color: "#475569" }}>
              Total compras
            </p>
          </div>
          <div
            className="text-center px-4 py-2 rounded-xl"
            style={{ background: "#00ff9d18", border: "1px solid #00ff9d33" }}
          >
            <p className="text-xl font-black" style={{ color: "#00ff9d" }}>
              {recibidas}/{MOCK_ORDENES.length}
            </p>
            <p className="text-[11px]" style={{ color: "#475569" }}>
              Recibidas
            </p>
          </div>
        </div>
      </div>

      {/* Órdenes de compra */}
      <Card title="Órdenes de compra recientes" icon="receipt_long">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid #1e2a3a" }}>
                {["ID", "Proveedor", "Ítems", "Monto", "Fecha", "Estado"].map(
                  (h) => (
                    <th
                      key={h}
                      className="py-2 px-3 text-left text-xs font-semibold"
                      style={{ color: "#475569" }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {MOCK_ORDENES.map((o) => (
                <tr
                  key={o.id}
                  className="transition-colors"
                  style={{ borderBottom: "1px solid #1e2a3a18" }}
                >
                  <td
                    className="py-2.5 px-3 font-mono text-xs"
                    style={{ color: "#00d4ff" }}
                  >
                    {o.id}
                  </td>
                  <td className="py-2.5 px-3" style={{ color: "#cbd5e1" }}>
                    {o.proveedor}
                  </td>
                  <td
                    className="py-2.5 px-3 text-center"
                    style={{ color: "#94a3b8" }}
                  >
                    {o.items}
                  </td>
                  <td
                    className="py-2.5 px-3 font-bold"
                    style={{ color: "#e2e8f0" }}
                  >
                    S/ {o.monto.toLocaleString()}
                  </td>
                  <td
                    className="py-2.5 px-3 text-xs"
                    style={{ color: "#475569" }}
                  >
                    {o.fecha}
                  </td>
                  <td className="py-2.5 px-3">
                    <EstadoBadge estado={o.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Ranking proveedores + costos */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Proveedores */}
        <Card title="Ranking de proveedores" icon="workspace_premium">
          <div className="space-y-3">
            {MOCK_PROVEEDORES.map((p, i) => (
              <div key={p.nombre} className="flex items-center gap-3">
                <div
                  className="size-7 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0"
                  style={{
                    background: i === 0 ? "#f59e0b33" : "#1e2a3a",
                    color: i === 0 ? "#f59e0b" : "#475569",
                  }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: "#e2e8f0" }}
                  >
                    {p.nombre}
                  </p>
                  <StarRating rating={p.rating} />
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold" style={{ color: "#00d4ff" }}>
                    S/ {(p.volumen / 1000).toFixed(1)}k
                  </p>
                  <p className="text-[10px]" style={{ color: "#475569" }}>
                    {p.tiempoEntrega}d · {p.ordenes} OC
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Costos vs precios */}
        <Card title="Costo vs Precio de venta" icon="price_change">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={MOCK_COSTOS_PRECIOS}
              layout="vertical"
              margin={{ left: 8, right: 16 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis
                type="number"
                tick={{ fill: "#475569", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="producto"
                width={120}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
              <Bar
                dataKey="costo"
                name="Costo"
                fill="#ef444466"
                radius={[0, 2, 2, 0]}
                isAnimationActive
                animationDuration={900}
              />
              <Bar
                dataKey="precio"
                name="Precio"
                fill="#00ff9d"
                radius={[0, 4, 4, 0]}
                isAnimationActive
                animationDuration={900}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
};

export default ComprasModule;
