import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../config/firebase";

const PENDING_ALERT_HOURS = 24;
const toMillis = (value) => (value?.toDate ? value.toDate().getTime() : value ? new Date(value).getTime() : 0);

// Validated receipts (series/correlative reserved) are not sent automatically:
// SUNAT gives a short window to send them, so flag the ones waiting too long.
const SunatPendingAlert = ({ branchId, className = "" }) => {
  const [overdue, setOverdue] = useState({ count: 0, oldestHours: 0 });

  useEffect(() => {
    if (!branchId) return undefined;
    const pendingQuery = query(
      collection(db, "sales"),
      where("branchId", "==", branchId),
      where("sunat.status", "==", "validated"),
    );
    return onSnapshot(
      pendingQuery,
      (snap) => {
        const now = Date.now();
        const limit = now - PENDING_ALERT_HOURS * 60 * 60 * 1000;
        const times = snap.docs
          .map((d) => d.data())
          .filter((sale) => sale.status !== "cancelled")
          .map((sale) => toMillis(sale.paymentDate || sale.date))
          .filter((time) => time < limit);
        setOverdue({
          count: times.length,
          oldestHours: times.length ? Math.floor((now - Math.min(...times)) / 3600000) : 0,
        });
      },
      (error) => console.error("Error loading pending SUNAT receipts:", error),
    );
  }, [branchId]);

  if (overdue.count === 0) return null;
  const { count, oldestHours } = overdue;

  return (
    <div className={className}>
    <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4 flex flex-col sm:flex-row sm:items-center gap-3 text-amber-900 dark:text-amber-100">
      <span className="material-symbols-outlined text-amber-600">schedule_send</span>
      <p className="flex-1 text-sm">
        <b>{count}</b> comprobante{count !== 1 ? "s" : ""} validado{count !== 1 ? "s" : ""} lleva
        {count !== 1 ? "n" : ""} más de {PENDING_ALERT_HOURS} h sin enviarse a SUNAT (el más antiguo, {oldestHours} h).
        SUNAT da un plazo corto para enviarlos.
      </p>
      <Link
        to="/ventas/sunat"
        className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black whitespace-nowrap text-center"
      >
        Ir a la bandeja SUNAT
      </Link>
    </div>
    </div>
  );
};

export default SunatPendingAlert;
