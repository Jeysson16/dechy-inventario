import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { toast } from "react-hot-toast";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Clipboard,
  Code2,
  FileCheck2,
  FileText,
  Loader2,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import AppLayout from "../components/layout/AppLayout";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { getSunatConfigStatus, previewSunatSale, refreshSunatSaleStatus, sendSunatSale } from "../services/sunatApi";

const STATUS_LABELS = {
  not_sent: ["Pendiente", "bg-amber-100 text-amber-800"],
  validated: ["Validado", "bg-sky-100 text-sky-800"],
  processing: ["Procesando", "bg-sky-100 text-sky-800"],
  accepted: ["Aceptado", "bg-emerald-100 text-emerald-800"],
  accepted_with_observations: ["Aceptado con observaciones", "bg-emerald-100 text-emerald-800"],
  rejected: ["Rechazado", "bg-rose-100 text-rose-800"],
  send_error: ["Error de envío", "bg-rose-100 text-rose-800"],
};

const PERIOD_OPTIONS = [
  { id: "today", label: "Hoy" },
  { id: "7days", label: "Últimos 7 días" },
  { id: "30days", label: "Últimos 30 días" },
  { id: "custom", label: "Personalizado" },
  { id: "all", label: "Todo el historial" },
];

const getSaleDate = (sale) => {
  const value = sale?.date || sale?.paymentDate;
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const formatDate = (value) => {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString("es-PE") : "—";
};

const formatXml = (xml = "") => {
  const normalized = String(xml).replace(/>\s*</g, "><").replace(/(>)(<)(\/*)/g, "$1\n$2$3");
  let indent = 0;
  return normalized
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (/^<\//.test(trimmed)) indent = Math.max(indent - 1, 0);
      const formatted = `${"  ".repeat(indent)}${trimmed}`;
      if (/^<[^!?/][^>]*[^/]>\s*$/.test(trimmed) && !trimmed.includes("</")) indent += 1;
      return formatted;
    })
    .join("\n");
};

const canSendSale = (sale) =>
  !["accepted", "accepted_with_observations", "processing"].includes(sale.sunat?.status) &&
  sale.status !== "cancelled";

const getFiscalDocumentReference = (sale) =>
  sale?.sunat?.documentId || "Sin correlativo fiscal reservado";

const getSunatSendErrorMessage = (error) => {
  const message = error?.message || "SUNAT rechazó el comprobante.";
  if (/No tiene el perfil para enviar comprobantes electronicos|soap-env:Client\.0111/i.test(message)) {
    return "SUNAT rechazó el envío: el Usuario SOL configurado no tiene permiso para emitir comprobantes electrónicos. Un administrador debe asignarle ese perfil en SUNAT SOL antes de reintentar.";
  }
  return message;
};

export default function SunatSales() {
  const { currentBranch } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingIds, setWorkingIds] = useState([]);
  const [config, setConfig] = useState(null);
  const [xmlView, setXmlView] = useState(null);
  const [xmlTab, setXmlTab] = useState("xml");
  const [filter, setFilter] = useState("pending");
  const [period, setPeriod] = useState("7days");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmSend, setConfirmSend] = useState(null);
  const [sendProgress, setSendProgress] = useState(null);

  useEffect(() => {
    getSunatConfigStatus().then(setConfig).catch((error) => toast.error(error.message));
  }, []);

  useEffect(() => {
    if (!currentBranch?.id) return undefined;
    const salesQuery = query(collection(db, "sales"), where("branchId", "==", currentBranch.id));
    return onSnapshot(
      salesQuery,
      (snapshot) => {
        const rows = [];
        snapshot.forEach((item) => {
          const sale = { id: item.id, ...item.data() };
          // A cancelled internal sale must never remain in the fiscal inbox,
          // regardless of the selected SUNAT or period filter.
          if (["factura", "boleta"].includes(sale.documentType) && sale.status !== "cancelled") {
            rows.push(sale);
          }
        });
        rows.sort((a, b) => (getSaleDate(b)?.getTime() || 0) - (getSaleDate(a)?.getTime() || 0));
        setSales(rows);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading fiscal sales:", error);
        toast.error("No se pudo cargar la bandeja SUNAT.");
        setLoading(false);
      },
    );
  }, [currentBranch?.id]);

  useEffect(() => {
    const processingInvoices = sales.filter((sale) =>
      sale.documentType === "factura" && sale.sunat?.status === "processing",
    );
    if (!processingInvoices.length) return undefined;

    let cancelled = false;
    const getDate = (value) => (value?.toDate ? value.toDate() : value ? new Date(value) : null);
    const nextCheckAt = Math.min(...processingInvoices.map((sale) => {
      const lastCheck = getDate(sale.sunat?.lastStatusCheckAt || sale.sunat?.sunatProcessingAt);
      return (lastCheck?.getTime() || 0) + (15 * 60 * 1000);
    }));
    const delay = Math.max(0, nextCheckAt - Date.now());

    const refreshStatuses = async () => {
      for (const sale of processingInvoices) {
        if (cancelled) return;
        try {
          const result = await refreshSunatSaleStatus(sale.id);
          if (result.completed) {
            toast.success(`${result.documentId}: SUNAT respondió ${result.accepted ? "Aceptado" : "Rechazado"}.`, { duration: 7000 });
          }
        } catch (error) {
          console.error("Error checking SUNAT status:", error);
        }
      }
    };

    const timer = window.setTimeout(refreshStatuses, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sales]);

  useEffect(() => {
    if (!xmlView) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setXmlView(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [xmlView]);

  const visibleSales = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start = null;
    let end = null;

    if (period === "today") start = startOfToday;
    if (period === "7days") start = new Date(startOfToday.getTime() - 6 * 86400000);
    if (period === "30days") start = new Date(startOfToday.getTime() - 29 * 86400000);
    if (period === "custom" && customStart) start = new Date(`${customStart}T00:00:00`);
    if (period === "custom" && customEnd) end = new Date(`${customEnd}T23:59:59.999`);

    return sales.filter((sale) => {
      const status = sale.sunat?.status || "not_sent";
      const matchesStatus =
        filter === "pending"
          ? ["not_sent", "validated", "processing", "send_error", "rejected", "validation_error"].includes(status)
          : filter === "accepted"
            ? ["accepted", "accepted_with_observations"].includes(status)
            : true;
      const saleDate = getSaleDate(sale);
      const matchesPeriod = (!start || (saleDate && saleDate >= start)) && (!end || (saleDate && saleDate <= end));
      return matchesStatus && matchesPeriod;
    });
  }, [customEnd, customStart, filter, period, sales]);

  const sendableVisibleSales = useMemo(() => visibleSales.filter(canSendSale), [visibleSales]);
  const selectedSales = useMemo(
    () => sendableVisibleSales.filter((sale) => selectedIds.includes(sale.id)),
    [selectedIds, sendableVisibleSales],
  );

  useEffect(() => {
    const availableIds = new Set(sendableVisibleSales.map((sale) => sale.id));
    setSelectedIds((current) => current.filter((id) => availableIds.has(id)));
  }, [sendableVisibleSales]);

  const environment = "production";
  const environmentLabel = "SUNAT Producción";
  const sendingEnabled = config?.certificateConfigured && config?.productionEnabled;

  const preview = async (sale) => {
    setWorkingIds((ids) => [...ids, sale.id]);
    try {
      const draft = await previewSunatSale(sale.id);
      const previewedSale = {
        ...sale,
        sunat: {
          ...(sale.sunat || {}),
          status: "validated",
          documentId: draft.documentId,
          validatedByBackend: true,
        },
      };
      await updateDoc(doc(db, "sales", sale.id), {
        "sunat.status": "validated",
        "sunat.documentId": draft.documentId,
        "sunat.validatedByBackend": true,
      });
      setXmlTab("xml");
      setXmlView({
        title: `${draft.documentId} — XML sin firma, no enviado`,
        xml: draft.xml,
        draft,
        sale: previewedSale,
      });
    } catch (error) {
      toast.error(error.message, { duration: 7000 });
    } finally {
      setWorkingIds((ids) => ids.filter((id) => id !== sale.id));
    }
  };

  const requestSend = async (items, mode) => {
    if (!sendingEnabled || items.length === 0) return;
    setWorkingIds((ids) => [...new Set([...ids, ...items.map((sale) => sale.id)])]);
    try {
      const preparedSales = [];
      for (const sale of items) {
        if (sale.sunat?.documentId) {
          preparedSales.push(sale);
          continue;
        }
        const draft = await previewSunatSale(sale.id);
        const preparedSale = {
          ...sale,
          sunat: {
            ...(sale.sunat || {}),
            status: "validated",
            documentId: draft.documentId,
            validatedByBackend: true,
          },
        };
        await updateDoc(doc(db, "sales", sale.id), {
          "sunat.status": "validated",
          "sunat.documentId": draft.documentId,
          "sunat.validatedByBackend": true,
        });
        preparedSales.push(preparedSale);
      }
      setConfirmSend({ sales: preparedSales, mode });
    } catch (error) {
      toast.error(`No se pudo reservar el correlativo fiscal: ${error.message}`, { duration: 8000 });
    } finally {
      setWorkingIds((ids) => ids.filter((id) => !items.some((sale) => sale.id === id)));
    }
  };

  const executeSend = async () => {
    if (!confirmSend?.sales.length) return;
    const items = confirmSend.sales;
    setSendProgress({ current: 0, total: items.length });
    setWorkingIds(items.map((sale) => sale.id));

    const successes = [];
    const processing = [];
    const failures = [];
    for (let index = 0; index < items.length; index += 1) {
      const sale = items[index];
      setSendProgress({
        current: index + 1,
        total: items.length,
        documentId: getFiscalDocumentReference(sale),
      });
      try {
        const result = await sendSunatSale(sale.id, { environment });
        if (result.accepted) successes.push({ sale, result });
        else if (result.processing) {
          processing.push({ sale, result });
          // The response already confirms that SUNAT has this document. Update
          // the row immediately instead of waiting for the Firestore listener.
          setSales((currentSales) => currentSales.map((currentSale) => (
            currentSale.id === sale.id
              ? {
                ...currentSale,
                sunat: {
                  ...(currentSale.sunat || {}),
                  documentId: result.documentId,
                  status: "processing",
                  sentToSunat: true,
                  description: result.description,
                },
              }
              : currentSale
          )));
        }
        else failures.push({ sale, message: result.description || "SUNAT rechazó el comprobante." });
      } catch (error) {
        failures.push({ sale, message: getSunatSendErrorMessage(error) });
      }
    }

    setWorkingIds([]);
    setSendProgress(null);
    setConfirmSend(null);
    setSelectedIds([]);

    if (items.length === 1 && successes.length === 1) {
      const { sale, result } = successes[0];
      setXmlTab(result.cdrXml ? "cdr" : "xml");
      setXmlView({
        title: `${result.documentId} — CDR ${result.responseCode}`,
        xml: result.signedXml,
        cdr: result.cdrXml,
        result,
        sale,
      });
      toast.success(`${environmentLabel} aceptó ${result.documentId}.`);
      return;
    }

    if (successes.length) toast.success(`${successes.length} comprobante${successes.length === 1 ? "" : "s"} enviado${successes.length === 1 ? "" : "s"} correctamente.`);
    if (processing.length) {
      const firstProcessing = processing[0];
      toast.success(
        `SUNAT está procesando ${firstProcessing.result.documentId}. No lo reenvíe; vuelva a revisar en 15 minutos.`,
        { duration: 9000 },
      );
    }
    if (failures.length) {
      const firstFailure = failures[0];
      toast.error(
        `${failures.length} envío${failures.length === 1 ? "" : "s"} no se completaron. ${getFiscalDocumentReference(firstFailure.sale)}: ${firstFailure.message}`,
        { duration: 10000 },
      );
    }
  };

  const toggleSelection = (saleId) => {
    setSelectedIds((ids) => (ids.includes(saleId) ? ids.filter((id) => id !== saleId) : [...ids, saleId]));
  };

  const toggleAllVisible = () => {
    const allIds = sendableVisibleSales.map((sale) => sale.id);
    const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : allIds);
  };

  const copyXml = async () => {
    const value = xmlTab === "cdr" ? xmlView?.cdr : xmlView?.xml;
    try {
      await navigator.clipboard.writeText(value || "");
      toast.success("XML copiado.");
    } catch {
      toast.error("No se pudo copiar el XML.");
    }
  };

  const periodLabel = PERIOD_OPTIONS.find((item) => item.id === period)?.label || "Periodo";
  const allVisibleSelected =
    sendableVisibleSales.length > 0 && sendableVisibleSales.every((sale) => selectedIds.includes(sale.id));

  return (
    <AppLayout>
      <div className="min-h-full bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-white lg:p-10">
        <div className="mx-auto max-w-screen-xl">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-primary">Ventas / Emisión fiscal</p>
              <h1 className="text-3xl font-black">Bandeja SUNAT</h1>
              <p className="mt-1 text-sm text-slate-500">
                Revisa, selecciona y envía tus comprobantes fiscales desde un solo lugar.
              </p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              Ambiente: <strong>{environmentLabel}</strong>
              <br />
              Producción: <strong>{config?.productionEnabled ? "habilitada en servidor" : "bloqueada"}</strong>
            </div>
          </div>

          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="text-sm">
                <strong>{config?.publicConfig?.razonSocial || "Emisor no configurado"}</strong>
                <span className="ml-2 text-slate-500">RUC {config?.publicConfig?.ruc || "—"}</span>
                <span className="ml-2 text-slate-500">PFX: {config?.certificateConfigured ? "configurado" : "pendiente"}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={period}
                    onChange={(event) => setPeriod(event.target.value)}
                    className="appearance-none rounded-xl border-slate-200 bg-slate-50 py-2 pl-9 pr-9 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                    aria-label="Periodo de ventas"
                  >
                    {PERIOD_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                </div>
                {[
                  { id: "pending", label: "Pendientes" },
                  { id: "accepted", label: "Aceptadas" },
                  { id: "all", label: "Todas" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setFilter(item.id)}
                    className={`rounded-xl px-3 py-2 text-xs font-black ${filter === item.id ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            {period === "custom" && (
              <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-500">
                  Desde
                  <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="mt-1 block rounded-xl border-slate-200 bg-slate-50 text-sm dark:border-slate-700 dark:bg-slate-800" />
                </label>
                <label className="text-xs font-bold text-slate-500">
                  Hasta
                  <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="mt-1 block rounded-xl border-slate-200 bg-slate-50 text-sm dark:border-slate-700 dark:bg-slate-800" />
                </label>
                <span className="pb-2 text-xs text-slate-400">Puedes usar una sola fecha o un rango completo.</span>
              </div>
            )}
          </div>

          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileCheck2 className="size-4" /></span>
              <div>
                <strong>{visibleSales.length} comprobante{visibleSales.length === 1 ? "" : "s"}</strong>
                <span className="ml-2 text-slate-500">en {periodLabel.toLowerCase()}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={!selectedSales.length || !sendingEnabled}
                onClick={() => requestSend(selectedSales, "selected")}
                className="inline-flex items-center gap-2 rounded-xl border border-primary px-4 py-2 text-xs font-black text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="size-4" />
                Enviar seleccionados {selectedSales.length > 0 && `(${selectedSales.length})`}
              </button>
              <button
                disabled={!sendableVisibleSales.length || !sendingEnabled}
                onClick={() => requestSend(sendableVisibleSales, "all")}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-black text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="size-4" />
                Enviar todos ({sendableVisibleSales.length})
              </button>
            </div>
          </div>

          {!sendingEnabled && config && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              El envío a producción está deshabilitado: {config.certificateConfigured ? "falta activar SUNAT_PRODUCTION_ENABLED=true en el backend." : "falta configurar el certificado PFX."}
            </div>
          )}

          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full min-w-[980px] text-left">
              <thead className="bg-slate-100 text-xs uppercase tracking-widest text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="w-12 p-4">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      disabled={!sendableVisibleSales.length}
                      aria-label="Seleccionar todos los comprobantes visibles"
                      className="rounded border-slate-300 text-primary focus:ring-primary"
                    />
                  </th>
                  <th className="p-4">Venta</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4 text-right">Total</th>
                  <th className="p-4">SUNAT</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr><td colSpan={8} className="p-10 text-center text-slate-500">Cargando ventas…</td></tr>
                ) : visibleSales.length === 0 ? (
                  <tr><td colSpan={8} className="p-10 text-center text-slate-500">No hay comprobantes para este estado y periodo.</td></tr>
                ) : visibleSales.map((sale) => {
                  const state = STATUS_LABELS[sale.sunat?.status || "not_sent"] || [sale.sunat?.status || "Pendiente", "bg-slate-100 text-slate-700"];
                  const canSend = canSendSale(sale);
                  const isWorking = workingIds.includes(sale.id);
                  return (
                    <tr key={sale.id} className={selectedIds.includes(sale.id) ? "bg-primary/[0.03]" : ""}>
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(sale.id)}
                          onChange={() => toggleSelection(sale.id)}
                          disabled={!canSend || isWorking}
                          aria-label={`Seleccionar ${sale.ticketNumber || sale.id}`}
                          className="rounded border-slate-300 text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="p-4"><strong>{sale.ticketNumber || sale.id}</strong><div className="text-xs text-slate-500">{getFiscalDocumentReference(sale)}</div></td>
                      <td className="p-4 font-bold">{sale.documentType === "factura" ? "Factura 01" : "Boleta 03"}</td>
                      <td className="p-4">{sale.customerName || "Cliente general"}<div className="text-xs text-slate-500">{sale.documentRUC || sale.customerDNI || "Sin documento"}</div></td>
                      <td className="p-4 text-sm">{formatDate(sale.date || sale.paymentDate)}</td>
                      <td className="p-4 text-right font-black">S/ {Number(sale.totalValue || sale.total || 0).toFixed(2)}</td>
                      <td className="p-4"><span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${state[1]}`}>{state[0]}</span>{sale.sunat?.description && <div className="mt-1 max-w-xs text-xs text-slate-500">{sale.sunat.description}</div>}</td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <button disabled={isWorking} onClick={() => preview(sale)} className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-50"><Code2 className="size-4" />Ver XML</button>
                          <button disabled={!canSend || isWorking || !sendingEnabled} onClick={() => requestSend([sale], "single")} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-black text-white disabled:opacity-40">
                            {isWorking ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                            Enviar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {confirmSend && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" onMouseDown={() => !sendProgress && setConfirmSend(null)}>
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start gap-4 border-b border-slate-100 p-6 dark:border-slate-800">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="size-6" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Confirmar envío a SUNAT</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-200">Los comprobantes se firmarán digitalmente antes de enviarse.</p>
              </div>
              <button disabled={Boolean(sendProgress)} onClick={() => setConfirmSend(null)} className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-200"><X className="size-5" /></button>
            </div>
            <div className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4 text-slate-900 dark:bg-slate-800/70 dark:text-white">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-200">Destino</p>
                  <p className="mt-1 font-black">{environmentLabel}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 text-slate-900 dark:bg-slate-800/70 dark:text-white">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-200">Comprobantes</p>
                  <p className="mt-1 font-black">{confirmSend.sales.length}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 text-slate-900 dark:bg-slate-800/70 dark:text-white">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-200">Alcance</p>
                  <p className="mt-1 font-black">
                    {confirmSend.mode === "single" ? "Individual" : confirmSend.mode === "selected" ? "Selección" : periodLabel}
                  </p>
                </div>
              </div>
              <div className="max-h-44 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                {confirmSend.sales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-0 dark:border-slate-800">
                    <div className="min-w-0"><p className="truncate text-sm font-black text-slate-900 dark:text-white">{getFiscalDocumentReference(sale)}</p><p className="truncate text-xs text-slate-500 dark:text-slate-200">{sale.documentType === "factura" ? "Factura" : "Boleta"} · Ticket interno {sale.ticketNumber || sale.id}</p></div>
                    <strong className="shrink-0 text-sm text-slate-900 dark:text-white">S/ {Number(sale.totalValue || sale.total || 0).toFixed(2)}</strong>
                  </div>
                ))}
              </div>
              {sendProgress && (
                <div>
                  <div className="mb-2 flex justify-between text-xs font-bold text-slate-500 dark:text-slate-200"><span>Enviando {sendProgress.documentId || ""}</span><span>{sendProgress.current}/{sendProgress.total}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }} /></div>
                </div>
              )}
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-200">Verifica el destino y los comprobantes. Se enviará el correlativo fiscal mostrado; el ticket es solo una referencia interna.</p>
            </div>
            <div className="flex gap-3 border-t border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/40">
              <button disabled={Boolean(sendProgress)} onClick={() => setConfirmSend(null)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-900 disabled:opacity-40 dark:border-slate-700 dark:text-white">Cancelar</button>
              <button disabled={Boolean(sendProgress)} onClick={executeSend} className="flex flex-[1.4] items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black text-white disabled:opacity-70">
                {sendProgress ? <><Loader2 className="size-4 animate-spin" />Enviando…</> : <><Send className="size-4" />Firmar y enviar {confirmSend.sales.length > 1 ? confirmSend.sales.length : ""}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {xmlView && createPortal(
        <div
          className="flex items-center justify-center bg-slate-950/65 p-2 backdrop-blur-sm sm:p-4"
          style={{ position: "fixed", inset: 0, zIndex: 9999, overflow: "hidden" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="xml-preview-title"
          onMouseDown={() => setXmlView(null)}
        >
          <div
            className="flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl"
            style={{ width: "calc(100vw - 16px)", height: "calc(100vh - 16px)", maxWidth: 1152, maxHeight: 820, minHeight: 0 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><FileText className="size-5 shrink-0 text-primary" /><h2 id="xml-preview-title" className="truncate text-lg font-black">{xmlView.title}</h2></div>
                <p className="mt-1 text-xs text-slate-500">{xmlView.result ? xmlView.result.description : "Previsualización segura: aún no está firmado ni enviado."}</p>
              </div>
              <button aria-label="Cerrar previsualización XML" onClick={() => setXmlView(null)} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"><X className="size-5" /></button>
            </div>
            <div className="grid min-h-0 flex-1 overflow-hidden grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="hidden min-h-0 overflow-y-auto border-r border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/40 lg:block">
                <p className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">Resumen del comprobante</p>
                <div className="space-y-3">
                  {[
                    ["Venta", xmlView.sale?.ticketNumber || xmlView.sale?.id || "—"],
                    ["Comprobante", xmlView.draft?.documentId || xmlView.result?.documentId || xmlView.sale?.sunat?.documentId || "—"],
                    ["Tipo", xmlView.sale?.documentType === "factura" ? "Factura electrónica 01" : "Boleta electrónica 03"],
                    ["Fecha", formatDate(xmlView.sale?.date || xmlView.sale?.paymentDate)],
                    ["Cliente", xmlView.sale?.customerName || "Cliente general"],
                    ["Documento", xmlView.sale?.documentRUC || xmlView.sale?.customerDNI || "Sin documento"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                      <p className="mt-1 break-words text-sm font-bold">{value}</p>
                    </div>
                  ))}
                  <div className="rounded-2xl bg-primary p-4 text-white">
                    <p className="text-xs font-bold uppercase tracking-wider text-white/70">Total</p>
                    <p className="mt-1 text-2xl font-black">S/ {Number(xmlView.sale?.totalValue || xmlView.sale?.total || 0).toFixed(2)}</p>
                  </div>
                  <div className={`flex items-start gap-2 rounded-xl p-3 text-xs ${xmlView.result ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"}`}>
                    {xmlView.result ? <Check className="mt-0.5 size-4 shrink-0" /> : <ShieldCheck className="mt-0.5 size-4 shrink-0" />}
                    <span>{xmlView.result ? "Documento firmado y procesado por SUNAT." : "Esta vista no firma ni envía el documento."}</span>
                  </div>
                </div>
              </aside>
              <section className="flex min-h-0 min-w-0 overflow-hidden flex-col bg-slate-950" style={{ minHeight: 0, minWidth: 0 }}>
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
                  <div className="flex gap-1 rounded-xl bg-slate-900 p-1">
                    <button onClick={() => setXmlTab("xml")} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${xmlTab === "xml" ? "bg-slate-700 text-white" : "text-slate-400"}`}>{xmlView.result ? "XML firmado" : "XML previsualizado"}</button>
                    {xmlView.cdr && <button onClick={() => setXmlTab("cdr")} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${xmlTab === "cdr" ? "bg-sky-600 text-white" : "text-slate-400"}`}>CDR de SUNAT</button>}
                  </div>
                  <button onClick={copyXml} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800"><Clipboard className="size-3.5" />Copiar</button>
                </div>
                <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain" style={{ minHeight: 0, minWidth: 0 }}>
                  <pre className="m-0 block min-w-max p-4 font-mono text-xs leading-6 text-emerald-300 sm:p-5"><code>{formatXml(xmlTab === "cdr" ? xmlView.cdr : xmlView.xml)}</code></pre>
                </div>
              </section>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </AppLayout>
  );
}
