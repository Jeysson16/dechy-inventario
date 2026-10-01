import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import AppLayout from "../components/layout/AppLayout";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { matchesAnyFuzzy } from "../utils/search";
import {
  buildSaleCancellationUpdate,
  fiscalDocumentCode,
  getSaleCancellationBlock,
} from "../utils/sunat";

const toDate = (value) => (value?.toDate ? value.toDate() : value ? new Date(value) : null);
const money = (n) => `S/ ${(Number(n) || 0).toFixed(2)}`;
const formatDateTime = (value) => {
  const date = toDate(value);
  return date
    ? date.toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
};

const DOC_LABELS = { factura: "Factura", boleta: "Boleta", note: "Nota de venta" };
const STATUS_LABELS = {
  pending_payment: ["Pendiente de pago", "bg-amber-100 text-amber-800"],
  pending_delivery: ["Por despachar", "bg-sky-100 text-sky-800"],
  cancelled: ["Anulada", "bg-rose-100 text-rose-700"],
};

const fiscalReference = (sale) => sale.sunat?.documentId || sale.fiscalDocumentId || "";

const CancelSaleModal = ({ sale, onClose, onConfirm, isSaving }) => {
  const [reason, setReason] = useState("");
  const [kind, setKind] = useState("cancelled");
  if (!sale) return null;
  const correlative = fiscalReference(sale);
  const isFiscal = Boolean(fiscalDocumentCode(sale.documentType));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="size-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined">block</span>
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Anular venta {sale.ticketNumber}</h3>
            <p className="text-sm text-slate-500">
              {DOC_LABELS[sale.documentType] || "Venta"} · {money(sale.totalValue)} · {sale.customerName || "Cliente general"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            ["cancelled", "Anular", "Error al registrar la venta"],
            ["rejected", "Rechazar", "El cliente no concretó la compra"],
          ].map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              className={`text-left p-3 rounded-2xl border transition-colors ${kind === value ? "border-rose-400 bg-rose-50 dark:bg-rose-900/20" : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
            >
              <p className="text-sm font-black text-slate-900 dark:text-white">{label}</p>
              <p className="text-[11px] text-slate-500">{hint}</p>
            </button>
          ))}
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Motivo (obligatorio)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Ej.: se registró el producto equivocado"
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-rose-200 text-slate-900 dark:text-white"
          />
        </div>

        {isFiscal && (
          <div className={`rounded-2xl p-3 text-xs leading-relaxed ${correlative ? "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800" : "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
            {correlative ? (
              <>
                El comprobante <b>{correlative}</b> no se enviará a SUNAT. Su correlativo queda reservado y marcado
                como <b>baja pendiente</b>: no se reutiliza y deberá informarse a SUNAT (comunicación de baja o resumen diario).
              </>
            ) : (
              <>Este comprobante todavía no tiene correlativo asignado: se anula solo internamente.</>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSaving || reason.trim().length < 5}
            onClick={() => onConfirm({ reason, kind })}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-black disabled:opacity-40"
          >
            {isSaving ? "Anulando..." : kind === "rejected" ? "Rechazar venta" : "Anular venta"}
          </button>
        </div>
      </div>
    </div>
  );
};

const SalesCancellations = () => {
  const { currentBranch, currentUser, userProfile } = useAuth();
  const [openSales, setOpenSales] = useState([]);
  const [cancelledSales, setCancelledSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("open"); // 'open' | 'history'
  const [searchTerm, setSearchTerm] = useState("");
  const [saleToCancel, setSaleToCancel] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!currentBranch?.id) return undefined;
    setLoading(true);
    const sortByDate = (list) => list.sort((a, b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0));
    const unsubOpen = onSnapshot(
      query(collection(db, "sales"), where("branchId", "==", currentBranch.id), where("status", "in", ["pending_payment", "pending_delivery"])),
      (snap) => {
        setOpenSales(sortByDate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
        setLoading(false);
      },
      (error) => {
        console.error("Error loading open sales:", error);
        setLoading(false);
      },
    );
    const unsubCancelled = onSnapshot(
      query(collection(db, "sales"), where("branchId", "==", currentBranch.id), where("status", "==", "cancelled")),
      (snap) => setCancelledSales(sortByDate(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
      (error) => console.error("Error loading cancelled sales:", error),
    );
    return () => {
      unsubOpen();
      unsubCancelled();
    };
  }, [currentBranch?.id]);

  const visibleSales = useMemo(() => {
    const list = tab === "open" ? openSales : cancelledSales;
    if (!searchTerm.trim()) return list;
    return list.filter((sale) =>
      matchesAnyFuzzy(searchTerm, [sale.ticketNumber, sale.customerName, sale.customerDNI, fiscalReference(sale)]),
    );
  }, [tab, openSales, cancelledSales, searchTerm]);

  const voidPendingCount = useMemo(
    () => cancelledSales.filter((s) => s.sunat?.voidStatus === "pending").length,
    [cancelledSales],
  );

  const requestCancel = (sale) => {
    const block = getSaleCancellationBlock(sale);
    if (block) {
      toast.error(block, { duration: 9000 });
      return;
    }
    setSaleToCancel(sale);
  };

  const confirmCancel = async ({ reason, kind }) => {
    if (!saleToCancel) return;
    setIsSaving(true);
    try {
      const update = buildSaleCancellationUpdate(saleToCancel, {
        reason,
        kind,
        user: {
          uid: currentUser?.uid,
          name: userProfile?.name || currentUser?.displayName || currentUser?.email,
          email: currentUser?.email,
        },
      });
      await updateDoc(doc(db, "sales", saleToCancel.id), update);
      toast.success(kind === "rejected" ? "Venta rechazada." : "Venta anulada.");
      setSaleToCancel(null);
    } catch (error) {
      console.error("Error cancelling sale:", error);
      toast.error(error.message || "No se pudo anular la venta.", { duration: 8000 });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-full bg-slate-50 dark:bg-slate-950 px-4 sm:px-6 lg:px-10 py-8">
        <div className="max-w-screen-xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Anular ventas</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
                Anula o rechaza ventas registradas con error antes de despacharlas. Una venta anulada no se envía a SUNAT
                y su correlativo nunca se reutiliza.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ticket, cliente o correlativo"
                className="w-full pl-10 pr-4 h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {voidPendingCount > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-200 flex gap-3">
              <span className="material-symbols-outlined">warning</span>
              <p>
                Hay <b>{voidPendingCount}</b> comprobante{voidPendingCount !== 1 ? "s" : ""} anulado{voidPendingCount !== 1 ? "s" : ""} con correlativo
                reservado y baja pendiente de informar a SUNAT.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            {[
              ["open", `Por despachar (${openSales.length})`],
              ["history", `Anuladas (${cancelledSales.length})`],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-colors ${tab === value ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-16">
                <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
              </div>
            ) : visibleSales.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <span className="material-symbols-outlined text-5xl">task_alt</span>
                <p className="mt-2 font-semibold">{tab === "open" ? "No hay ventas pendientes de despacho." : "No hay ventas anuladas."}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] uppercase tracking-widest text-slate-400">
                    <tr>
                      <th className="text-left px-5 py-3">Ticket</th>
                      <th className="text-left px-5 py-3">Fecha</th>
                      <th className="text-left px-5 py-3">Cliente</th>
                      <th className="text-left px-5 py-3">Comprobante</th>
                      <th className="text-right px-5 py-3">Total</th>
                      <th className="text-left px-5 py-3">{tab === "open" ? "Estado" : "Motivo"}</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleSales.map((sale) => {
                      const [statusLabel, statusClass] = STATUS_LABELS[sale.status] || [sale.status, "bg-slate-100 text-slate-600"];
                      const correlative = fiscalReference(sale);
                      return (
                        <tr key={sale.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="px-5 py-3 font-black text-slate-900 dark:text-white whitespace-nowrap">{sale.ticketNumber}</td>
                          <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(sale.date)}</td>
                          <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                            <p className="font-semibold">{sale.customerName || "Cliente general"}</p>
                            <p className="text-[11px] text-slate-400">{sale.sellerName}</p>
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <p className="font-semibold text-slate-700 dark:text-slate-300">{DOC_LABELS[sale.documentType] || "Venta"}</p>
                            {correlative && <p className="text-[11px] font-mono text-slate-500">{correlative}</p>}
                            {sale.sunat?.voidStatus === "pending" && (
                              <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">Baja pendiente</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">{money(sale.totalValue)}</td>
                          <td className="px-5 py-3">
                            {tab === "open" ? (
                              <span className={`px-2 py-1 rounded-lg text-[11px] font-bold ${statusClass}`}>{statusLabel}</span>
                            ) : (
                              <div className="text-xs text-slate-600 dark:text-slate-300 max-w-xs">
                                <p className="font-bold">{sale.cancellationKind === "rejected" ? "Rechazada" : "Anulada"}</p>
                                <p className="text-slate-500">{sale.cancellationReason || "Sin motivo registrado"}</p>
                                <p className="text-[11px] text-slate-400">
                                  {sale.cancelledBy?.name || "—"} · {formatDateTime(sale.cancelledAt)}
                                </p>
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {tab === "open" && (
                              <button
                                onClick={() => requestCancel(sale)}
                                className="px-4 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 text-xs font-black whitespace-nowrap"
                              >
                                Anular / Rechazar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <CancelSaleModal
        key={saleToCancel?.id || "none"}
        sale={saleToCancel}
        isSaving={isSaving}
        onClose={() => setSaleToCancel(null)}
        onConfirm={confirmCancel}
      />
    </AppLayout>
  );
};

export default SalesCancellations;
