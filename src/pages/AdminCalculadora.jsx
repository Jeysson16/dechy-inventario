import { useState } from "react";
import AppLayout from "../components/layout/AppLayout";
import CieloRasoCalculator from "../components/calculators/CieloRasoCalculator";
import PanelCalculator from "../components/calculators/PanelCalculator";

const TABS = [
  {
    id: "cieloraso",
    label: "Cielo Raso",
    icon: "grid_on",
    color: "text-violet-600",
    activeBg: "bg-violet-600",
  },
  {
    id: "pared",
    label: "Panel de Pared",
    icon: "view_column",
    color: "text-indigo-600",
    activeBg: "bg-indigo-600",
  },
  {
    id: "techo",
    label: "Panel de Techo",
    icon: "roofing",
    color: "text-teal-600",
    activeBg: "bg-teal-600",
  },
];

const AdminCalculadora = () => {
  const [activeTab, setActiveTab] = useState("cieloraso");

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="px-6 lg:px-10 pt-8 pb-0">
          <div className="max-w-screen-xl mx-auto">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-1">
              Calculadora de Materiales
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Calcula materiales, cortes, bocetos 2D y genera reportes en PDF / Excel / QR
            </p>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-black rounded-t-xl border-b-2 transition-all ${
                      isActive
                        ? `${tab.activeBg} text-white border-transparent shadow-sm`
                        : "bg-transparent text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 lg:px-10 py-6">
          <div className="max-w-screen-xl mx-auto">
            {activeTab === "cieloraso" && (
              <CieloRasoCalculator isModal={false} showQR={true} />
            )}
            {activeTab === "pared" && (
              <PanelCalculator calcType="wall" />
            )}
            {activeTab === "techo" && (
              <PanelCalculator calcType="ceiling" />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminCalculadora;

