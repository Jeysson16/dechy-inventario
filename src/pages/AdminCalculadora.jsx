import AppLayout from "../components/layout/AppLayout";
import CieloRasoCalculator from "../components/calculators/CieloRasoCalculator";

const AdminCalculadora = () => (
  <AppLayout>
    <div className="flex-1 overflow-y-auto p-6 lg:p-10 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-screen-lg mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Calculadora de Materiales
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Calcula la cantidad de materiales para instalación de cielo raso
          </p>
        </div>
        <CieloRasoCalculator isModal={false} />
      </div>
    </div>
  </AppLayout>
);

export default AdminCalculadora;
