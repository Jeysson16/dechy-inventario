import { useState, useMemo } from "react";
import { Card, Skeleton } from "./DashboardEjecutivo";
import { toDate } from "../useReportsData";

const MODULES_FILTER = ["Todos", "entrada", "TRASLADO", "merma"];

const AuditoriaModule = ({ transactions, loading }) => {
  const [filterType, setFilterType] = useState("Todos");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return (transactions || []).filter((t) => {
      if (filterType !== "Todos" && t.type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (t.productName || "").toLowerCase().includes(q) ||
          (t.userName || "").toLowerCase().includes(q) ||
          (t.userEmail || "").toLowerCase().includes(q) ||
          (t.type || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [transactions, filterType, search]);

  const typeConfig = {
    entrada: {
      bg: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400",
      icon: "move_to_inbox",
    },
    TRASLADO: {
      bg: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400",
      icon: "swap_horiz",
    },
    merma: {
      bg: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400",
      icon: "delete_sweep",
    },
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">
            Auditoría
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Historial de movimientos de inventario
          </p>
        </div>
        {!loading && (
          <div className="text-center px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">
              {transactions?.length || 0}
            </p>
            <p className="text-[11px] text-slate-500">Registros totales</p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
            search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por producto, usuario o tipo..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {MODULES_FILTER.map((m) => (
            <button
              key={m}
              onClick={() => setFilterType(m)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                filterType === m
                  ? "bg-primary text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {m === "Todos"
                ? "Todos"
                : m === "entrada"
                  ? "Entradas"
                  : m === "TRASLADO"
                    ? "Traslados"
                    : "Mermas"}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline log */}
      <Card title={`${filtered.length} registros encontrados`} icon="history">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">
              search_off
            </span>
            <p className="text-sm text-slate-400 mt-2">
              No hay registros que coincidan
            </p>
          </div>
        ) : (
          <div className="relative pl-6">
            <div className="absolute left-2.5 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="space-y-3">
              {filtered.map((t) => {
                const cfg = typeConfig[t.type] || {
                  bg: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
                  icon: "swap_vert",
                };
                const d = toDate(t.date);
                return (
                  <div key={t.id} className="relative flex items-start gap-3">
                    {/* Dot */}
                    <div className="absolute -left-4 size-3 rounded-full border-2 border-white dark:border-slate-900 mt-2 bg-primary" />
                    {/* Card */}
                    <div className="flex-1 rounded-xl px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${cfg.bg}`}
                          >
                            <span className="material-symbols-outlined text-[12px]">
                              {cfg.icon}
                            </span>
                            {t.type === "entrada"
                              ? "Entrada"
                              : t.type === "TRASLADO"
                                ? "Traslado"
                                : t.type || "Movimiento"}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 flex-shrink-0">
                          {d
                            ? d.toLocaleDateString("es-PE", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1.5">
                        {t.productName || "Producto no identificado"}
                      </p>

                      <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">
                            deployed_code
                          </span>
                          {t.quantityBoxes || 0} cajas · {t.quantityUnits || 0}{" "}
                          unidades
                        </span>
                        {t.newStock !== undefined && (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <span className="material-symbols-outlined text-[12px]">
                              inventory_2
                            </span>
                            Stock → {t.newStock} cx
                          </span>
                        )}
                        {(t.originLocation || t.destinationLocation) && (
                          <span className="inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">
                              swap_horiz
                            </span>
                            {t.originLocation || "—"} →{" "}
                            {t.destinationLocation || "—"}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                        Por:{" "}
                        {t.userName || t.userEmail || "Usuario desconocido"}
                        {t.note && ` · "${t.note}"`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AuditoriaModule;
