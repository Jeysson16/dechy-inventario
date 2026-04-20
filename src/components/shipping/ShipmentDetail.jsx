import {
  Clock3,
  MapPinned,
  PackageSearch,
  ShieldCheck,
  TimerReset,
  Edit2,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { useState } from "react";

import {
  STATUS_META,
  formatDateLabel,
  formatLongDateLabel,
} from "../../utils/shipping";
import DocumentManager from "./DocumentManager";
import ProgressBar from "./ProgressBar";
import Timeline from "./Timeline";

const DetailItem = ({ icon, label, value }) => (
  <div className="rounded-3xl border border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
    <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
      {icon}
      {label}
    </div>
    <p className="text-sm font-bold text-slate-900 dark:text-white">{value}</p>
  </div>
);

const ShipmentDetail = ({
  shipment,
  pendingFiles,
  onPendingFilesChange,
  onUploadDocuments,
  uploadingDocuments,
  onEdit,
  onDelete,
  isEditing,
  onSaveEdit,
  savingEdit,
}) => {
  const [editForm, setEditForm] = useState({
    fecha_salida: shipment?.fecha_salida || "",
    dias_estimados: shipment?.dias_estimados || 45,
    origen: shipment?.origen || "",
    destino: shipment?.destino || "",
  });
  if (!shipment) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/50">
        <PackageSearch className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
        <p className="mt-4 text-sm font-bold text-slate-700 dark:text-slate-300">
          Selecciona un pedido para ver su detalle.
        </p>
      </div>
    );
  }

  const meta =
    STATUS_META[shipment.estadoCalculado] || STATUS_META["En tránsito"];

  const handleEditStart = () => {
    setEditForm({
      fecha_salida: shipment.fecha_salida,
      dias_estimados: shipment.dias_estimados,
      origen: shipment.origen,
      destino: shipment.destino,
    });
    onEdit?.();
  };

  const handleSaveEdit = () => {
    onSaveEdit?.(editForm);
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white/95 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="border-b border-slate-100 px-6 py-6 dark:border-slate-800">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">
                Detalle del pedido
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                {shipment.id_contenedor}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {editForm.origen} → {editForm.destino}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div
                className={`inline-flex rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.22em] ${meta.chip}`}
              >
                {shipment.estadoCalculado}
              </div>
              {isEditing ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={savingEdit}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-white disabled:opacity-50 hover:bg-emerald-600 transition-colors"
                  >
                    <Check className="h-4 w-4" />
                    Guardar
                  </button>
                  <button
                    onClick={() => onEdit?.()}
                    disabled={savingEdit}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-300 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-900 disabled:opacity-50 hover:bg-slate-400 transition-colors dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
                  >
                    <X className="h-4 w-4" />
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleEditStart}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-white hover:bg-blue-600 transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                    Editar
                  </button>
                  <button
                    onClick={onDelete}
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-white hover:bg-rose-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6">
          <ProgressBar
            progress={shipment.progresoCalculado}
            status={shipment.estadoCalculado}
          />

          {isEditing ? (
            <div className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/50">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Origen
                </label>
                <input
                  type="text"
                  value={editForm.origen}
                  onChange={(e) =>
                    setEditForm({ ...editForm, origen: e.target.value })
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Destino
                </label>
                <input
                  type="text"
                  value={editForm.destino}
                  onChange={(e) =>
                    setEditForm({ ...editForm, destino: e.target.value })
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Fecha de salida
                </label>
                <input
                  type="date"
                  value={
                    editForm.fecha_salida instanceof Date
                      ? editForm.fecha_salida.toISOString().split("T")[0]
                      : editForm.fecha_salida
                  }
                  onChange={(e) =>
                    setEditForm({ ...editForm, fecha_salida: e.target.value })
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Días estimados
                </label>
                <input
                  type="number"
                  min="1"
                  value={editForm.dias_estimados}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      dias_estimados: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <DetailItem
                icon={<MapPinned className="h-4 w-4" />}
                label="Origen / destino"
                value={`${shipment.origen} → ${shipment.destino}`}
              />
              <DetailItem
                icon={<Clock3 className="h-4 w-4" />}
                label="Fecha de salida"
                value={formatLongDateLabel(shipment.fecha_salida)}
              />
              <DetailItem
                icon={<TimerReset className="h-4 w-4" />}
                label="Días estimados"
                value={`${shipment.dias_estimados} días`}
              />
              <DetailItem
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Tiempo restante"
                value={
                  shipment.daysRemaining <= 0
                    ? "Arribo estimado alcanzado"
                    : `${shipment.daysRemaining} días restantes`
                }
              />
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-3">
            {!isEditing && (
              <>
                <div className="xl:col-span-2">
                  <Timeline status={shipment.estadoCalculado} />
                </div>
                <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">
                    Predicción de llegada
                  </p>
                  <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
                    {formatDateLabel(shipment.estimatedArrival)}
                  </p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Salida registrada el{" "}
                    {formatDateLabel(shipment.fecha_salida)}.
                  </p>
                  {shipment.isDelayed && (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
                      El tiempo estimado ya fue superado. Revisa el cronograma o
                      ajusta los días estimados.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {!isEditing && (
        <DocumentManager
          shipment={shipment}
          pendingFiles={pendingFiles}
          onPendingFilesChange={onPendingFilesChange}
          onUploadDocuments={onUploadDocuments}
          uploading={uploadingDocuments}
        />
      )}
    </div>
  );
};

export default ShipmentDetail;
