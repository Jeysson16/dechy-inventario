import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { toast } from "react-hot-toast";
import AppLayout from "../components/layout/AppLayout";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { getSunatConfigStatus, previewSunatSale, sendSunatSale } from "../services/sunatApi";

const STATUS_LABELS = {
  not_sent: ["Pendiente", "bg-amber-100 text-amber-800"],
  processing: ["Procesando", "bg-sky-100 text-sky-800"],
  accepted: ["Aceptado", "bg-emerald-100 text-emerald-800"],
  accepted_with_observations: ["Aceptado con observaciones", "bg-emerald-100 text-emerald-800"],
  rejected: ["Rechazado", "bg-rose-100 text-rose-800"],
  send_error: ["Error de envío", "bg-rose-100 text-rose-800"],
};

const formatDate = (value) => {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString("es-PE") : "—";
};

export default function SunatSales() {
  const { currentBranch } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState(null);
  const [config, setConfig] = useState(null);
  const [xmlView, setXmlView] = useState(null);
  const [filter, setFilter] = useState("pending");

  useEffect(() => {
    getSunatConfigStatus().then(setConfig).catch((error) => toast.error(error.message));
  }, []);

  useEffect(() => {
    if (!currentBranch?.id) return undefined;
    const salesQuery = query(collection(db, "sales"), where("branchId", "==", currentBranch.id));
    return onSnapshot(salesQuery, (snapshot) => {
      const rows = [];
      snapshot.forEach((item) => {
        const sale = { id: item.id, ...item.data() };
        if (["factura", "boleta"].includes(sale.documentType)) rows.push(sale);
      });
      rows.sort((a, b) => {
        const aDate = a.date?.toMillis?.() || new Date(a.date || 0).getTime();
        const bDate = b.date?.toMillis?.() || new Date(b.date || 0).getTime();
        return bDate - aDate;
      });
      setSales(rows);
      setLoading(false);
    }, (error) => {
      console.error("Error loading fiscal sales:", error);
      toast.error("No se pudo cargar la bandeja SUNAT.");
      setLoading(false);
    });
  }, [currentBranch?.id]);

  const visibleSales = useMemo(() => sales.filter((sale) => {
    const status = sale.sunat?.status || "not_sent";
    if (filter === "pending") return ["not_sent", "send_error", "rejected"].includes(status);
    if (filter === "accepted") return ["accepted", "accepted_with_observations"].includes(status);
    return true;
  }), [filter, sales]);

  const preview = async (sale) => {
    setWorkingId(sale.id);
    try {
      const draft = await previewSunatSale(sale.id);
      setXmlView({ title: `${draft.documentId} — XML sin firma, no enviado`, xml: draft.xml, draft });
    } catch (error) {
      toast.error(error.message, { duration: 7000 });
    } finally {
      setWorkingId(null);
    }
  };

  const environment = config?.publicConfig?.environment === "production" ? "production" : "beta";
  const environmentLabel = environment === "production" ? "SUNAT Producción" : "SUNAT Beta";

  const sendSale = async (sale) => {
    if (!window.confirm(`Se firmará y enviará esta venta a ${environmentLabel}.\n\nVenta: ${sale.ticketNumber || sale.id}\n\n¿Continuar?`)) return;
    setWorkingId(sale.id);
    try {
      const result = await sendSunatSale(sale.id, { environment });
      setXmlView({
        title: `${result.documentId} — CDR ${result.responseCode}`,
        xml: result.signedXml,
        cdr: result.cdrXml,
        result,
      });
      if (result.accepted) toast.success(`${environmentLabel} aceptó ${result.documentId}.`);
      else toast.error(`${environmentLabel} rechazó ${result.documentId}: ${result.description}`, { duration: 9000 });
    } catch (error) {
      toast.error(error.message, { duration: 9000 });
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-full bg-slate-50 dark:bg-slate-950 p-6 lg:p-10 text-slate-900 dark:text-white">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-primary">Ventas / Emisión fiscal</p>
              <h1 className="text-3xl font-black">Bandeja SUNAT</h1>
              <p className="text-sm text-slate-500 mt-1">Aquí se ve exactamente qué venta se previsualiza, firma y envía. Caja no participa en este flujo.</p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              Ambiente: <strong>{environmentLabel}</strong><br />
              Producción: <strong>{config?.productionEnabled ? "habilitada en servidor" : "bloqueada"}</strong>
            </div>
          </div>

          <div className="mb-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <strong>{config?.publicConfig?.razonSocial || "Emisor no configurado"}</strong>
              <span className="text-slate-500 ml-2">RUC {config?.publicConfig?.ruc || "—"}</span>
              <span className="text-slate-500 ml-2">PFX: {config?.certificateConfigured ? "configurado" : "pendiente"}</span>
            </div>
            <div className="flex gap-2">
              {[{ id: "pending", label: "Pendientes" }, { id: "accepted", label: "Aceptadas" }, { id: "all", label: "Todas" }].map((item) => (
                <button key={item.id} onClick={() => setFilter(item.id)} className={`px-3 py-2 rounded-xl text-xs font-black ${filter === item.id ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800"}`}>{item.label}</button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <table className="w-full text-left min-w-[900px]">
              <thead className="bg-slate-100 dark:bg-slate-800 text-xs uppercase tracking-widest text-slate-500">
                <tr><th className="p-4">Venta</th><th className="p-4">Tipo</th><th className="p-4">Cliente</th><th className="p-4">Fecha</th><th className="p-4 text-right">Total</th><th className="p-4">SUNAT</th><th className="p-4 text-right">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr><td colSpan={7} className="p-10 text-center text-slate-500">Cargando ventas…</td></tr>
                ) : visibleSales.length === 0 ? (
                  <tr><td colSpan={7} className="p-10 text-center text-slate-500">No hay comprobantes en este estado.</td></tr>
                ) : visibleSales.map((sale) => {
                  const state = STATUS_LABELS[sale.sunat?.status || "not_sent"] || [sale.sunat?.status || "Pendiente", "bg-slate-100 text-slate-700"];
                  const canSend = !["accepted", "accepted_with_observations", "processing"].includes(sale.sunat?.status) && sale.status !== "cancelled";
                  return (
                    <tr key={sale.id}>
                      <td className="p-4"><strong>{sale.ticketNumber || sale.id}</strong><div className="text-xs text-slate-500">{sale.sunat?.documentId || "Sin correlativo reservado"}</div></td>
                      <td className="p-4 font-bold">{sale.documentType === "factura" ? "Factura 01" : "Boleta 03"}</td>
                      <td className="p-4">{sale.customerName || "Cliente general"}<div className="text-xs text-slate-500">{sale.documentRUC || sale.customerDNI || "Sin documento"}</div></td>
                      <td className="p-4 text-sm">{formatDate(sale.date || sale.paymentDate)}</td>
                      <td className="p-4 text-right font-black">S/ {Number(sale.totalValue || 0).toFixed(2)}</td>
                      <td className="p-4"><span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${state[1]}`}>{state[0]}</span>{sale.sunat?.description && <div className="text-xs text-slate-500 mt-1 max-w-xs">{sale.sunat.description}</div>}</td>
                      <td className="p-4"><div className="flex justify-end gap-2"><button disabled={workingId === sale.id} onClick={() => preview(sale)} className="px-3 py-2 rounded-xl border text-xs font-black disabled:opacity-50">Ver XML</button><button disabled={!canSend || workingId === sale.id || !config?.certificateConfigured || (environment === "production" && !config?.productionEnabled)} onClick={() => sendSale(sale)} className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-black disabled:opacity-40">Enviar a {environment === "production" ? "Producción" : "Beta"}</button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {xmlView && (
        <div className="fixed inset-0 z-[100] bg-black/60 p-4 flex items-center justify-center">
          <div className="w-full max-w-5xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl p-5 flex flex-col gap-4">
            <div className="flex justify-between gap-4"><div><h2 className="font-black text-lg">{xmlView.title}</h2>{xmlView.result && <p className="text-sm text-slate-500">{xmlView.result.description}</p>}</div><button onClick={() => setXmlView(null)} className="size-10 rounded-full bg-slate-100 dark:bg-slate-800"><span className="material-symbols-outlined">close</span></button></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 flex-1">
              <label className="text-xs font-black uppercase tracking-wider min-h-0">XML {xmlView.result ? "firmado y enviado" : "previsualizado"}<textarea readOnly value={xmlView.xml || ""} className="mt-2 w-full h-[55vh] resize-none rounded-xl bg-slate-950 text-emerald-300 p-4 font-mono text-xs" /></label>
              {xmlView.cdr && <label className="text-xs font-black uppercase tracking-wider min-h-0">CDR devuelto por SUNAT<textarea readOnly value={xmlView.cdr} className="mt-2 w-full h-[55vh] resize-none rounded-xl bg-slate-950 text-sky-300 p-4 font-mono text-xs" /></label>}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
