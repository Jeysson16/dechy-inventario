import { useState } from "react";
import { Card, Skeleton } from "./DashboardEjecutivo";

const BRANCH_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

/* ── Simple SVG node map ── */
const BranchMap = ({ branchList, selected, onSelect }) => {
  if (branchList.length === 0) return null;

  const positions = [
    { x: 110, y: 130 },
    { x: 290, y: 70 },
    { x: 290, y: 200 },
    { x: 460, y: 130 },
    { x: 175, y: 230 },
    { x: 390, y: 260 },
  ];
  const edges = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 3],
    [0, 4],
    [2, 5],
  ].filter(([a, b]) => a < branchList.length && b < branchList.length);

  return (
    <svg viewBox="0 0 560 280" className="w-full" style={{ maxHeight: 220 }}>
      {edges.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={positions[a].x}
          y1={positions[a].y}
          x2={positions[b].x}
          y2={positions[b].y}
          stroke="#e2e8f0"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          className="dark:stroke-slate-700"
        />
      ))}
      {branchList.map((br, i) => {
        const pos = positions[i] || { x: 280, y: 140 };
        const color = BRANCH_COLORS[i % BRANCH_COLORS.length];
        const isSelected = selected === br.id;
        return (
          <g
            key={br.id}
            onClick={() => onSelect(isSelected ? null : br.id)}
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={pos.x}
              cy={pos.y}
              r={34}
              fill={isSelected ? `${color}22` : "white"}
              stroke={color}
              strokeWidth={isSelected ? 2.5 : 1.5}
              className="dark:fill-slate-900"
              style={{
                filter: isSelected ? `drop-shadow(0 0 8px ${color}80)` : "none",
              }}
            />
            <text
              x={pos.x}
              y={pos.y - 6}
              textAnchor="middle"
              fontSize={9}
              fontWeight="800"
              fill={color}
            >
              {br.name
                ?.split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 3)
                .toUpperCase() || `A${i + 1}`}
            </text>
            <text
              x={pos.x}
              y={pos.y + 7}
              textAnchor="middle"
              fontSize={8}
              fill="#94a3b8"
            >
              {(br.name || "").slice(0, 10)}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const AlmacenesModule = ({ data, loading, branches, isDark }) => {
  const [selected, setSelected] = useState(null);
  const { transferencias = [] } = data || {};

  const selectedBranch = selected
    ? branches.find((b) => b.id === selected)
    : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">
            Reporte de Almacenes
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {branches.length} sede{branches.length !== 1 ? "s" : ""} registrada
            {branches.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Branch cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : branches.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">
            warehouse
          </span>
          <p className="text-sm text-slate-400 mt-2">
            Sin sucursales registradas
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {branches.map((br, i) => {
            const color = BRANCH_COLORS[i % BRANCH_COLORS.length];
            return (
              <div
                key={br.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border shadow-sm p-4 cursor-pointer transition-transform hover:-translate-y-1"
                style={{ borderColor: `${color}44` }}
                onClick={() => setSelected(selected === br.id ? null : br.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="size-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${color}18` }}
                  >
                    <span
                      className="material-symbols-outlined text-[20px]"
                      style={{ color }}
                    >
                      warehouse
                    </span>
                  </div>
                  {selected === br.id && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${color}18`, color }}
                    >
                      Seleccionado
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                  {br.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {br.address || br.city || "—"}
                </p>
                {br.primaryColor && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <div
                      className="size-2.5 rounded-full"
                      style={{ background: br.primaryColor }}
                    />
                    <span className="text-[10px] text-slate-400">
                      Color principal
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Mapa SVG */}
        <Card title="Mapa de sucursales" icon="map">
          {loading ? (
            <Skeleton className="h-48" />
          ) : (
            <>
              <BranchMap
                branchList={branches}
                selected={selected}
                onSelect={setSelected}
              />
              {selectedBranch && (
                <div className="mt-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm">
                  <p className="font-bold text-slate-900 dark:text-slate-100">
                    {selectedBranch.name}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {selectedBranch.address || "Sin dirección registrada"}
                  </p>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Transferencias */}
        <Card
          title="Transferencias entre sedes"
          icon="swap_horiz"
          badge={
            !loading && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                {transferencias.length} registros
              </span>
            )
          }
        >
          {loading ? (
            <Skeleton className="h-48" />
          ) : transferencias.length === 0 ? (
            <div className="py-8 text-center">
              <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">
                sync_alt
              </span>
              <p className="text-sm text-slate-400 mt-2">
                Sin transferencias registradas
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Los traslados se registran desde el módulo de Ingresos
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {transferencias.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-800"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate mr-2">
                      {t.producto}
                    </p>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">
                      {t.fecha}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {t.origen || "—"}
                    </span>
                    <span className="material-symbols-outlined text-[13px] text-slate-400">
                      arrow_forward
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {t.destino || "—"}
                    </span>
                    <span className="ml-auto text-xs text-slate-400">
                      ×{t.cantidad}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{t.usuario}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AlmacenesModule;
