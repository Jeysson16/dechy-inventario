import { Boxes, ChevronRight, PackageCheck } from "lucide-react";

import { STATUS_META, formatDateLabel } from "../../utils/shipping";
import ProgressBar from "./ProgressBar";

const ShipmentList = ({ shipments, selectedShipmentId, onSelectShipment }) => {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">
            Lista de pedidos
          </p>
          <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white">
            Pedidos registrados
          </h3>
        </div>
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Boxes className="h-5 w-5" />
        </div>
      </div>

      {shipments.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
            <PackageCheck className="h-8 w-8" />
          </div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Aún no hay pedidos registrados.
          </p>
          <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            Crea el primer pedido para empezar a simular el trayecto desde
            Changan hasta Trujillo.
          </p>
        </div>
      ) : (
        <div className="max-h-[540px] overflow-auto">
          {shipments.map((shipment) => {
            const selected = shipment.id === selectedShipmentId;
            const meta =
              STATUS_META[shipment.estadoCalculado] ||
              STATUS_META["En tránsito"];

            return (
              <button
                key={shipment.id}
                type="button"
                onClick={() => onSelectShipment(shipment)}
                className={`w-full border-b border-slate-100 px-6 py-5 text-left transition-all last:border-b-0 dark:border-slate-800 ${
                  selected
                    ? "bg-primary/10"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      {shipment.id_contenedor}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Salida: {formatDateLabel(shipment.fecha_salida)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${meta.chip}`}
                    >
                      {shipment.estadoCalculado}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
                <div className="mt-4">
                  <ProgressBar
                    progress={shipment.progresoCalculado}
                    status={shipment.estadoCalculado}
                    showLabel={false}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ShipmentList;
