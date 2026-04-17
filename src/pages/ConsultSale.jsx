import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";

const formatDateLong = (date) => {
  const parsedDate = date?.toDate?.() || new Date(date || "");
  if (Number.isNaN(parsedDate.getTime())) return "Fecha inválida";
  return parsedDate.toLocaleString("es-PE", {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const ConsultSale = () => {
  const { ticketNumber } = useParams();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ticketNumber) return;

    const fetchSale = async () => {
      setLoading(true);
      setError(null);

      try {
        const salesQuery = query(
          collection(db, "sales"),
          where("ticketNumber", "==", ticketNumber),
        );
        const salesSnapshot = await getDocs(salesQuery);

        if (!salesSnapshot.empty) {
          const saleDoc = salesSnapshot.docs[0];
          setSale({ id: saleDoc.id, ...saleDoc.data() });
          setLoading(false);
          return;
        }

        const fallbackDoc = await getDoc(doc(db, "sales", ticketNumber));
        if (fallbackDoc.exists()) {
          setSale({ id: fallbackDoc.id, ...fallbackDoc.data() });
          setLoading(false);
          return;
        }

        setError("No se encontró la venta solicitada.");
      } catch (err) {
        console.error("Error fetching sale:", err);
        setError("Ocurrió un error al cargar la venta.");
      } finally {
        setLoading(false);
      }
    };

    fetchSale();
  }, [ticketNumber]);

  const renderStatus = (status) => {
    const statusMap = {
      pending_payment: {
        label: "PAGO PENDIENTE",
        className: "bg-rose-500 text-white",
      },
      pending_delivery: {
        label: "PENDIENTE DE ENTREGA",
        className: "bg-amber-500 text-white",
      },
      completed: { label: "COMPLETADO", className: "bg-emerald-500 text-white" },
    };
    const statusInfo = statusMap[status] || {
      label: status?.toUpperCase() || "ESTADO DESCONOCIDO",
      className: "bg-slate-500 text-white",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${statusInfo.className}`}
      >
        {statusInfo.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-10 lg:px-8">
        <div className="mb-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500 font-black">
                Consulta de Venta
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight">
                {ticketNumber}
              </h1>
            </div>
            {sale && renderStatus(sale.status)}
          </div>

          {loading ? (
            <div className="mt-12 flex items-center justify-center">
              <span className="material-symbols-outlined animate-spin text-4xl text-primary">
                progress_activity
              </span>
            </div>
          ) : error ? (
            <div className="mt-12 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30">
              <p className="font-bold">{error}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Verifica que el código de venta sea correcto o contacta al administrador.
              </p>
            </div>
          ) : sale ? (
            <div className="mt-8 space-y-8">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-6">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 font-bold">
                    Cliente
                  </p>
                  <p className="mt-3 font-black text-slate-900 dark:text-white">
                    {sale.customerName || "Cliente General"}
                  </p>
                  {sale.customerDNI && (
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      RUC / DNI: {sale.customerDNI}
                    </p>
                  )}
                </div>
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-6">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 font-bold">
                    Vendedor
                  </p>
                  <p className="mt-3 font-black text-slate-900 dark:text-white">
                    {sale.userName || sale.sellerName || "Desconocido"}
                  </p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Fecha: {formatDateLong(sale.date)}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 uppercase tracking-[0.16em] text-[10px]">
                      <tr>
                        <th className="px-5 py-4">Código</th>
                        <th className="px-5 py-4">Artículo</th>
                        <th className="px-5 py-4">Unidad</th>
                        <th className="px-5 py-4">Cant.</th>
                        <th className="px-5 py-4">Precio/u</th>
                        <th className="px-5 py-4">Importe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {(sale.items || []).map((item, index) => {
                        const unitPrice = Number(item.overridePrice || item.activePrice || 0);
                        return (
                          <tr key={index} className="bg-white dark:bg-slate-900">
                            <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">
                              {item.sku || "-"}
                            </td>
                            <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                              {item.productName || "-"}
                            </td>
                            <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                              {item.saleMode === "cajas" ? "CJ" : "UND"}
                            </td>
                            <td className="px-5 py-4 text-slate-900 dark:text-white font-black">
                              {item.saleMode === "cajas" ? item.quantitySoldBoxes : item.quantitySoldUnits}
                            </td>
                            <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                              S/ {unitPrice.toFixed(2)}
                            </td>
                            <td className="px-5 py-4 text-slate-900 dark:text-white font-black">
                              S/ {Number(item.subtotal || 0).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total a pagar</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white">
                    S/ {Number(sale.totalValue || 0).toFixed(2)}
                  </p>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  <p>Forma de pago: {sale.paymentMethod || "No registrada"}</p>
                  {sale.note && <p>Nota: {sale.note}</p>}
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900 transition-all"
            >
              <span className="material-symbols-outlined">arrow_back</span>
              Volver al inicio
            </Link>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Código de venta válido: {ticketNumber}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsultSale;
