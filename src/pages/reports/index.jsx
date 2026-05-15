import { useState } from "react";
import AppLayout from "../../components/layout/AppLayout";
import { useTheme } from "../../context/ThemeContext";
import useReportsData from "./useReportsData";
import DashboardEjecutivo from "./modules/DashboardEjecutivo";
import VentasModule from "./modules/VentasModule";
import InventarioModule from "./modules/InventarioModule";
import AlmacenesModule from "./modules/AlmacenesModule";
import MovimientosModule from "./modules/MovimientosModule";
import ClientesModule from "./modules/ClientesModule";
import AuditoriaModule from "./modules/AuditoriaModule";

const MODULES = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "dashboard",
    sub: "KPIs y alertas",
  },
  {
    id: "ventas",
    label: "Ventas",
    icon: "point_of_sale",
    sub: "Ingresos y categorías",
  },
  {
    id: "inventario",
    label: "Inventario",
    icon: "inventory_2",
    sub: "Stock mínimo y mermas",
  },
  {
    id: "movimientos",
    label: "Movimientos",
    icon: "swap_vert",
    sub: "Entradas y salidas",
  },
  {
    id: "almacenes",
    label: "Almacenes",
    icon: "warehouse",
    sub: "Sedes y transferencias",
  },
  {
    id: "clientes",
    label: "Clientes",
    icon: "groups",
    sub: "Clientes y vendedores",
  },
  {
    id: "auditoria",
    label: "Auditoría",
    icon: "manage_search",
    sub: "Historial de cambios",
  },
];

const DATE_RANGES = [
  { key: "today", label: "Hoy" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "year", label: "Año" },
];

const Reports = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [active, setActive] = useState("dashboard");
  const [dateRange, setDateRange] = useState("week");
  const { loading, error, derived, branches, rawTransactions } =
    useReportsData(dateRange);

  const moduleProps = { data: derived, loading, isDark };

  const content = {
    dashboard: <DashboardEjecutivo {...moduleProps} />,
    ventas: <VentasModule {...moduleProps} />,
    inventario: <InventarioModule {...moduleProps} />,
    movimientos: <MovimientosModule {...moduleProps} />,
    almacenes: <AlmacenesModule {...moduleProps} branches={branches} />,
    clientes: <ClientesModule {...moduleProps} />,
    auditoria: (
      <AuditoriaModule
        transactions={rawTransactions}
        loading={loading}
        isDark={isDark}
      />
    ),
  };

  return (
    <AppLayout>
      <div className="flex h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* ── Sidebar ── */}
        <aside className="w-56 flex-shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto">
          {/* Brand */}
          <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
            <div className="size-8 rounded-lg flex items-center justify-center bg-primary">
              <span className="material-symbols-outlined text-[18px] text-white">
                analytics
              </span>
            </div>
            <div>
              <p className="text-xs font-black tracking-widest uppercase text-primary">
                Reportes
              </p>
              <p className="text-[10px] text-slate-400">Sistema Jieda</p>
            </div>
          </div>

          {/* Período */}
          <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-800">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
              Período
            </p>
            <div className="grid grid-cols-2 gap-1">
              {DATE_RANGES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setDateRange(key)}
                  className={`text-[11px] font-semibold py-1.5 rounded-lg transition-all ${
                    dateRange === key
                      ? "bg-primary text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 py-2 space-y-0.5 px-2">
            {MODULES.map((m) => {
              const isAct = active === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setActive(m.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl transition-all text-left ${
                    isAct
                      ? "bg-primary text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[20px] flex-shrink-0 ${isAct ? "text-white" : ""}`}
                  >
                    {m.icon}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-semibold leading-tight truncate ${isAct ? "text-white" : ""}`}
                    >
                      {m.label}
                    </p>
                    <p
                      className={`text-[10px] leading-tight mt-0.5 truncate ${isAct ? "text-white/70" : "text-slate-400 dark:text-slate-500"}`}
                    >
                      {m.sub}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Loading indicator */}
          {loading && (
            <div className="px-4 pb-3 flex items-center gap-2">
              <div className="size-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-[10px] text-slate-400">
                Actualizando...
              </span>
            </div>
          )}
        </aside>

        {/* ── Content ── */}
        <main className="flex-1 overflow-y-auto">
          {error && (
            <div className="m-4 p-4 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              ⚠ Error al cargar datos: {error}
            </div>
          )}
          <div key={active} style={{ animation: "rpEnter 0.22s ease both" }}>
            {content[active]}
          </div>
        </main>
      </div>

      <style>{`
        @keyframes rpEnter {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
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
        .rp-section {
          animation: rpFadeUp 0.35s cubic-bezier(.22,1,.36,1) both;
        }
        .rp-card-0  { animation: rpScaleIn 0.3s cubic-bezier(.22,1,.36,1) 0.05s both; }
        .rp-card-1  { animation: rpScaleIn 0.3s cubic-bezier(.22,1,.36,1) 0.10s both; }
        .rp-card-2  { animation: rpScaleIn 0.3s cubic-bezier(.22,1,.36,1) 0.15s both; }
        .rp-card-3  { animation: rpScaleIn 0.3s cubic-bezier(.22,1,.36,1) 0.20s both; }
        .rp-card-4  { animation: rpScaleIn 0.3s cubic-bezier(.22,1,.36,1) 0.25s both; }
        .rp-title   { animation: rpSlideRight 0.3s cubic-bezier(.22,1,.36,1) 0.06s both; }
        .rp-kpi-val { animation: rpCountUp 0.4s cubic-bezier(.22,1,.36,1) 0.12s both; }
      `}</style>
    </AppLayout>
  );
};

export default Reports;
