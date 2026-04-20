import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import AppLayout from "../components/layout/AppLayout";
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import {
  notifySaleEvent,
  useRealtimeSalesNotifications,
} from "../hooks/useRealtimeSalesNotifications";
import efectivoIcon from "../../img/iconos/efectivo.png";
import transferenciaIcon from "../../img/iconos/transferencia.png";
import yapeIcon from "../../img/iconos/yape.png";
import posIcon from "../../img/iconos/pos.png";

const PAYMENT_METHODS = [
  {
    key: "cash",
    id: "Efectivo",
    label: "Efectivo",
    icon: efectivoIcon,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    key: "pos",
    id: "Tarjeta",
    label: "Tarjeta / POS",
    icon: posIcon,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    key: "transfer",
    id: "Transferencia",
    label: "Transferencia",
    icon: transferenciaIcon,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
  },
  {
    key: "yape",
    id: "Yape/Plin",
    label: "Yape / Plin",
    icon: yapeIcon,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
];

const notifyNewDelivery = async (ticketNumber) => {
  const message = `Nueva Venta Lista para Despacho Ticket N°${ticketNumber.replace(/^TKT-/, "")}`;

  await notifySaleEvent({
    title: "Nueva venta para despacho",
    message,
    showToast: true,
  });
};

const KPISection = ({ metrics }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
    {PAYMENT_METHODS.map((method) => (
      <div
        key={method.id}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all group overflow-hidden relative"
      >
        <div
          className={`absolute -right-4 -top-4 size-24 ${method.bg} rounded-full blur-2xl opacity-50 group-hover:scale-150 transition-transform duration-700`}
        ></div>
        <div className="relative flex items-center gap-4">
          <div
            className={`size-12 rounded-xl ${method.bg} flex items-center justify-center shrink-0 overflow-hidden p-2`}
          >
            <img
              src={method.icon}
              alt={method.label}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
              {method.label}
            </p>
            <p className="text-xl font-black text-slate-900 dark:text-white truncate">
              S/ {(metrics[method.id] || 0).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const ConfirmActionModal = ({
  isOpen,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  confirmVariant = "danger",
  isProcessing = false,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  const confirmClassName =
    confirmVariant === "danger"
      ? "bg-rose-600 hover:bg-rose-700 text-white"
      : "bg-slate-900 dark:bg-primary text-white hover:opacity-90 dark:hover:brightness-110";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[2rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-black text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
        <div className="px-6 py-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={`flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${confirmClassName}`}
          >
            {isProcessing ? (
              <span className="material-symbols-outlined animate-spin text-lg">
                progress_activity
              </span>
            ) : null}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const SaleDetailContent = ({
  sale,
  onApprove,
  onReject,
  onEdit,
  isProcessing,
  paymentMethod,
  setPaymentMethod,
  amountPaid,
  setAmountPaid,
  paymentReference,
  setPaymentReference,
}) => {
  const isCancelled = sale.status === "cancelled";

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Resumen de Productos
          </h4>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {sale.items?.length || 0} items
          </span>
        </div>
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {sale.items?.map((item, idx) => (
            <div
              key={idx}
              className="flex justify-between items-start gap-4 p-3 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                  {item.productName}
                </p>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                  {item.saleMode === "cajas"
                    ? item.quantitySoldBoxes
                    : item.quantitySoldUnits}{" "}
                  {item.saleMode}
                </p>
              </div>
              <span className="font-bold text-slate-900 dark:text-white shrink-0">
                S/ {Number(item.subtotal).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-[10px] font-black uppercase tracking-widest">
            <span>Cliente</span>
            <span className="text-slate-900 dark:text-white">
              {sale.customerName || "Cliente General"}
            </span>
          </div>
          {sale.customerDNI && (
            <div className="flex justify-between items-center text-slate-400 text-[10px] font-black uppercase tracking-widest">
              <span>DNI/RUC</span>
              <span className="text-slate-900 dark:text-white">
                {sale.customerDNI}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2">
            <span className="text-sm font-black text-slate-400 uppercase tracking-widest">
              Total a Cobrar
            </span>
            <span className="text-2xl font-black text-primary">
              S/ {Number(sale.totalValue).toFixed(2)}
            </span>
          </div>
        </div>

        <button
          onClick={onEdit}
          disabled={isCancelled}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-xs font-black uppercase tracking-widest text-slate-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">edit_note</span>
          Editar / Ajustar Cantidades
        </button>
      </div>

      <div className="lg:w-[400px] space-y-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-primary/10 transition-colors"></div>

          <div className="relative">
            <h4 className="text-xs font-black text-primary uppercase tracking-widest mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">
                payments
              </span>
              Registro de Pago
            </h4>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                  Método de Pago
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.id}
                      disabled={isCancelled}
                      onClick={() => setPaymentMethod(m.id)}
                      className={`px-4 py-6 rounded-[2rem] border-2 transition-all duration-500 flex flex-col items-center justify-center gap-4 relative overflow-hidden group/method
                          ${
                            paymentMethod === m.id
                              ? `${m.bg.replace("/10", "/20")} border-primary shadow-xl shadow-primary/10 -translate-y-1`
                              : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md"
                          }`}
                    >
                      <div
                        className={`size-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${paymentMethod === m.id ? "bg-white dark:bg-slate-800 shadow-sm scale-110" : "bg-slate-100 dark:bg-slate-800/50 group-hover/method:bg-white dark:group-hover/method:bg-slate-700"}`}
                      >
                        <img
                          src={m.icon}
                          alt={m.label}
                          className={`size-10 object-contain transition-all duration-500 ${paymentMethod === m.id ? "opacity-100 scale-100" : "opacity-40 grayscale group-hover/method:opacity-100 group-hover/method:grayscale-0 group-hover/method:scale-105"}`}
                        />
                      </div>
                      <div className="text-center">
                        <p
                          className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 transition-colors ${paymentMethod === m.id ? "text-primary" : "text-slate-400 group-hover/method:text-slate-600 dark:group-hover/method:text-slate-300"}`}
                        >
                          {m.label}
                        </p>
                        {paymentMethod === m.id && (
                          <span className="text-[9px] font-bold text-primary/60 uppercase tracking-tighter animate-in fade-in slide-in-from-bottom-1">
                            Seleccionado
                          </span>
                        )}
                      </div>

                      {paymentMethod === m.id && (
                        <div className="absolute top-3 right-3 animate-in zoom-in duration-300">
                          <div className="size-6 bg-primary text-white rounded-full flex items-center justify-center border-4 border-white dark:border-slate-900">
                            <span className="material-symbols-outlined text-[14px] font-black scale-90">
                              check
                            </span>
                          </div>
                        </div>
                      )}
                      <div
                        className={`absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-0 group-hover/method:opacity-100 transition-opacity pointer-events-none`}
                      ></div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                  Monto Pagado (S/)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">
                    S/
                  </span>
                  <input
                    type="number"
                    value={amountPaid}
                    disabled={isCancelled}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-lg font-black text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
                  />
                </div>
              </div>

              {(paymentMethod === "Transferencia" ||
                paymentMethod === "Yape/Plin") && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                    Referencia / Operación
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    disabled={isCancelled}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="Número de operación..."
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {isCancelled ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-black uppercase tracking-widest py-4 text-center">
            Venta anulada - solo lectura
          </div>
        ) : (
          <div className="flex gap-4">
            <button
              onClick={onReject}
              disabled={isProcessing}
              className="flex-1 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-900/10 font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">cancel</span>
              Anular
            </button>
            <button
              onClick={onApprove}
              disabled={isProcessing}
              className="flex-[2] py-4 rounded-2xl bg-slate-900 dark:bg-primary text-white font-black text-xs uppercase tracking-widest hover:opacity-90 dark:hover:opacity-100 dark:hover:brightness-110 transition-all shadow-xl shadow-slate-900/10 dark:shadow-primary/20 flex items-center justify-center gap-3 group"
            >
              {isProcessing ? (
                <span className="material-symbols-outlined animate-spin text-xl">
                  progress_activity
                </span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">
                    verified
                  </span>
                  Confirmar y Cobrar
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const Cashier = () => {
  const { currentBranch, currentUser, userProfile } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("list"); // 'grid' or 'list'
  const [dateFilter, setDateFilter] = useState("today");
  const [statusFilter, setStatusFilter] = useState("pending_payment");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // States for editing quantities
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItems, setEditingItems] = useState([]);
  const [editingSale, setEditingSale] = useState(null);

  // States for payment recording
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [dailyMetrics, setDailyMetrics] = useState({});
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [showCancelledHistory, setShowCancelledHistory] = useState(false);
  const [saleToCancel, setSaleToCancel] = useState(null);

  useRealtimeSalesNotifications({
    branchId: currentBranch?.id,
    enabled: !!currentBranch?.id,
    shouldNotify: (sale) => sale.status === "pending_payment",
    buildMessage: (sale) =>
      `Usuario realizó una venta con ID: ${sale.ticketNumber || sale.id}`,
  });

  useEffect(() => {
    if (!currentBranch) return;

    // Fetch ALL sales for today to calculate KPIs
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, "sales"),
      where("branchId", "==", currentBranch.id),
      where("status", "in", ["pending_delivery", "completed", "paid"]),
      where("paymentDate", ">=", today),
    );

    const unsub = onSnapshot(q, (snap) => {
      const metrics = {
        Efectivo: 0,
        Tarjeta: 0,
        Transferencia: 0,
        "Yape/Plin": 0,
      };
      snap.forEach((doc) => {
        const data = doc.data();
        const method = data.paymentMethod || "Efectivo";
        metrics[method] =
          (metrics[method] || 0) +
          (Number(data.amountPaid) || Number(data.totalValue) || 0);
      });
      setDailyMetrics(metrics);
    });

    return () => unsub();
  }, [currentBranch]);

  useEffect(() => {
    if (!currentBranch) return;

    const pendingQuery = query(
      collection(db, "sales"),
      where("branchId", "==", currentBranch.id),
      where("status", "==", "pending_payment"),
    );

    const unsubscribe = onSnapshot(pendingQuery, (snapshot) => {
      const count = snapshot.size;
      setPendingPaymentsCount(count);
    });

    return () => unsubscribe();
  }, [currentBranch]);

  const getDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);

    if (dateFilter === "week") {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { start: weekAgo, end: endDate };
    }

    if (dateFilter === "month") {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 29);
      return { start: monthAgo, end: endDate };
    }

    if (dateFilter === "custom" && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    return { start: today, end: endDate };
  };

  useEffect(() => {
    if (!currentBranch) return;
    setLoading(true);

    const { start, end } = getDateRange();
    const constraints = [
      collection(db, "sales"),
      where("branchId", "==", currentBranch.id),
      where("date", ">=", start),
      where("date", "<=", end),
    ];

    if (statusFilter !== "all") {
      constraints.push(where("status", "==", statusFilter));
    }

    constraints.push(orderBy("date", "desc"));
    const q = query(...constraints);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = [];
        snap.forEach((d) => data.push({ id: d.id, ...d.data() }));
        setSales(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching tickets:", error);
        toast.error("Error al cargar los tickets de venta.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, [currentBranch, dateFilter, statusFilter, customStartDate, customEndDate]);

  const handleApprove = async (sale) => {
    if (sale.status === "cancelled") {
      toast.error("La venta está anulada y no puede cobrarse.");
      return;
    }

    if (!amountPaid || Number(amountPaid) <= 0) {
      toast.error("Por favor ingrese un monto válido.");
      return;
    }

    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "sales", sale.id), {
        status: "pending_delivery",
        paymentDate: new Date(),
        paymentMethod,
        amountPaid: Number(amountPaid),
        paymentReference: paymentReference || "",
      });
      notifyNewDelivery(sale.ticketNumber);
      toast.success("Venta aprobada y pagada.");
      setExpandedSaleId(null);
      resetPaymentFields();
    } catch (error) {
      console.error("Error approving sale:", error);
      toast.error("Error al aprobar la venta.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetPaymentFields = () => {
    setPaymentMethod("Efectivo");
    setAmountPaid("");
    setPaymentReference("");
  };

  const handleReject = async (sale) => {
    if (sale.status === "cancelled") {
      toast.error("La venta ya está anulada.");
      return;
    }

    setSaleToCancel(sale);
  };

  const confirmReject = async () => {
    if (!saleToCancel) return;

    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "sales", saleToCancel.id), {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: {
          uid: currentUser?.uid,
          name:
            userProfile?.name ||
            currentUser?.displayName ||
            currentUser?.email ||
            "Desconocido",
          email: currentUser?.email || "",
        },
      });
      toast.success("Venta rechazada.");
      setExpandedSaleId(null);
      setSaleToCancel(null);
    } catch (error) {
      console.error("Error rejecting sale:", error);
      toast.error("Error al rechazar la venta.");
    } finally {
      setIsProcessing(false);
    }
  };

  const openEditModal = (sale) => {
    if (sale.status === "cancelled") {
      toast.error("No se puede editar una venta anulada.");
      return;
    }

    setEditingSale(sale);
    setEditingItems(JSON.parse(JSON.stringify(sale.items))); // Deep copy
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingSale) return;

    if (editingSale.status === "cancelled") {
      toast.error("No se puede editar una venta anulada.");
      return;
    }

    const totalValue = editingItems.reduce(
      (sum, item) => sum + item.subtotal,
      0,
    );
    try {
      await updateDoc(doc(db, "sales", editingSale.id), {
        items: editingItems,
        totalValue: totalValue,
      });
      toast.success("Venta actualizada.");
      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Error updating sale:", error);
      toast.error("Error al actualizar la venta.");
    }
  };

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const matchesSearch = s.ticketNumber
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());
      const allowStatus = showCancelledHistory || s.status !== "cancelled";
      return matchesSearch && allowStatus;
    });
  }, [sales, searchTerm, showCancelledHistory]);

  const toggleExpand = (sale) => {
    if (expandedSaleId === sale.id) {
      setExpandedSaleId(null);
      resetPaymentFields();
    } else {
      setExpandedSaleId(sale.id);
      setAmountPaid(sale.totalValue.toString());
      resetPaymentFields(); // Clear previous inputs but set amount to total
      setAmountPaid(sale.totalValue.toString());
    }
  };

  const updateItemQty = (index, field, value) => {
    const val = Number(value) || 0;
    const newItems = [...editingItems];
    const item = newItems[index];

    if (field === "quantitySoldBoxes") {
      item.quantitySoldBoxes = val;
    } else if (field === "quantitySoldUnits") {
      item.quantitySoldUnits = val;
    }

    // Recalculate subtotal (simplified common logic, ideally would use calcSale helper)
    const upb = Number(item.unitsPerBox) || 1;
    const boxes = item.quantitySoldBoxes;
    const units = item.quantitySoldUnits;

    // Check for wholesale pricing if applicable
    const wPrice = Number(item.wholesalePrice) || 0;
    const wThreshold = Number(item.wholesaleThreshold) || 0;
    const wUnit = item.wholesaleThresholdUnit || "cajas";

    let currentQty = item.saleMode === "cajas" ? boxes : units;
    let isWholesale = false;
    if (wPrice > 0 && wThreshold > 0) {
      const currentQtyInThresholdUnit =
        item.saleMode === wUnit
          ? currentQty
          : item.saleMode === "cajas"
            ? currentQty * upb
            : currentQty / upb;
      if (currentQtyInThresholdUnit >= wThreshold) isWholesale = true;
    }

    const activeUnitPrice = isWholesale ? wPrice : Number(item.unitPrice) || 0;
    const activeBoxPrice = isWholesale
      ? wPrice * upb
      : Number(item.boxPrice) || 0;

    if (item.saleMode === "cajas") {
      item.subtotal = boxes * activeBoxPrice;
    } else {
      const fullBoxes = Math.floor(units / upb);
      const remainder = units % upb;
      item.subtotal = fullBoxes * activeBoxPrice + remainder * activeUnitPrice;
      item.fullBoxes = fullBoxes;
      item.remainderUnits = remainder;
    }

    setEditingItems(newItems);
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-6 lg:p-10">
        <div className="max-w-screen-xl mx-auto w-full">
          <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Caja / Cobros
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Aprobación de tickets y recepción de pagos
              </p>
            </div>

            <div className="flex flex-col gap-4 w-full md:w-auto">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "today", label: "Hoy" },
                  { id: "week", label: "7 días" },
                  { id: "month", label: "30 días" },
                  { id: "custom", label: "Personalizado" },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setDateFilter(filter.id)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${dateFilter === filter.id ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              {dateFilter === "custom" && (
                <div className="flex flex-col sm:flex-row gap-3 mt-2">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full sm:w-auto px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full sm:w-auto px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Ventas pendientes de cobro
              </p>
              <p className="text-4xl font-black text-rose-600">
                {pendingPaymentsCount}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                Tickets con estado{" "}
                <span className="text-primary font-bold">PENDIENTE PAGO</span>
              </p>
            </div>
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Estado actual
              </p>
              <p className="text-xl font-black text-slate-900 dark:text-white">
                {statusFilter === "all"
                  ? "Todos"
                  : statusFilter === "pending_payment"
                    ? "Pendiente de pago"
                    : statusFilter === "pending_delivery"
                      ? "Pendiente de despacho"
                      : "Completado"}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                Rango:{" "}
                {dateFilter === "today"
                  ? "Hoy"
                  : dateFilter === "week"
                    ? "Últimos 7 días"
                    : dateFilter === "month"
                      ? "Últimos 30 días"
                      : "Personalizado"}
              </p>
            </div>
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Última actualización
              </p>
              <p className="text-xl font-black text-slate-900 dark:text-white">
                {new Date().toLocaleTimeString()}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                La información se actualiza en tiempo real.
              </p>
            </div>
          </div>

          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                { id: "pending_payment", label: "Pdte. Pago" },
                { id: "pending_delivery", label: "Pdte. Despacho" },
                { id: "completed", label: "Completado" },
                { id: "all", label: "Todos" },
              ].map((status) => (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => setStatusFilter(status.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${statusFilter === status.id ? "bg-white dark:bg-slate-900 text-primary shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                >
                  {status.label}
                </button>
              ))}
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-300">
              <input
                type="checkbox"
                checked={showCancelledHistory}
                onChange={(e) => setShowCancelledHistory(e.target.checked)}
                className="accent-primary"
              />
              Mostrar historial anuladas
            </label>
            <div className="relative group min-w-[400px]">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                search
              </span>
              <input
                type="text"
                placeholder="Buscar por Ticket..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
              />
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/50 dark:border-slate-700">
              <button
                onClick={() => setViewMode("grid")}
                className={`size-8 rounded-lg flex items-center justify-center transition-all ${viewMode === "grid" ? "bg-white dark:bg-slate-700 text-primary shadow-sm scale-105" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  grid_view
                </span>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`size-8 rounded-lg flex items-center justify-center transition-all ${viewMode === "list" ? "bg-white dark:bg-slate-700 text-primary shadow-sm scale-105" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  view_list
                </span>
              </button>
            </div>
          </div>

          <KPISection metrics={dailyMetrics} />

          {loading ? (
            <div className="flex justify-center py-20">
              <span className="material-symbols-outlined animate-spin text-4xl text-primary">
                progress_activity
              </span>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-10">
              <span className="material-symbols-outlined text-6xl mb-4 bg-slate-100 dark:bg-slate-800 p-4 rounded-full">
                receipt
              </span>
              <p className="font-bold text-lg text-slate-700 dark:text-slate-300">
                No hay tickets coincidentes
              </p>
              <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">
                Intente con otro número de ticket o espere nuevos registros
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 content-start">
              {filteredSales.map((sale) => (
                <div
                  key={sale.id}
                  className={`${expandedSaleId === sale.id ? "col-span-full" : ""} h-fit`}
                >
                  <div
                    className={`bg-white dark:bg-slate-900 rounded-[2.5rem] border transition-all group relative overflow-hidden h-full ${expandedSaleId === sale.id ? "border-primary ring-4 ring-primary/5 shadow-2xl p-10 mb-8" : "border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-primary/40 p-8 cursor-pointer"}`}
                    onClick={() =>
                      expandedSaleId !== sale.id && toggleExpand(sale)
                    }
                  >
                    {expandedSaleId === sale.id && (
                      <div className="absolute top-0 left-0 w-2 h-full bg-primary"></div>
                    )}

                    <div
                      className="flex justify-between items-start mb-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(sale);
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`size-16 rounded-[1.25rem] flex items-center justify-center transition-all ${expandedSaleId === sale.id ? "bg-primary text-white shadow-xl shadow-primary/30 scale-110" : "bg-primary/5 text-primary"}`}
                        >
                          <span className="material-symbols-outlined text-3xl">
                            {expandedSaleId === sale.id
                              ? "payments"
                              : "receipt_long"}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                            Ticket #
                          </p>
                          <p className="text-xl font-black text-slate-900 dark:text-white uppercase leading-none">
                            {sale.ticketNumber || "S/N"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-6">
                        <div>
                          <p
                            className={`text-[10px] font-black uppercase tracking-[0.2em] leading-none mb-2 ${expandedSaleId === sale.id ? "text-primary" : "text-slate-400"}`}
                          >
                            Total Ticket
                          </p>
                          <p
                            className={`font-black tracking-tight leading-none ${expandedSaleId === sale.id ? "text-5xl" : "text-2xl text-slate-900 dark:text-white"}`}
                          >
                            S/ {Number(sale.totalValue).toFixed(2)}
                          </p>
                        </div>
                        {expandedSaleId === sale.id && (
                          <button className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors">
                            <span className="material-symbols-outlined">
                              expand_less
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div
                      className={`grid gap-8 ${expandedSaleId === sale.id ? "grid-cols-1 md:grid-cols-4" : "grid-cols-1"}`}
                    >
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest opacity-60">
                          Número de Ticket
                        </p>
                        <p className="font-black text-slate-900 dark:text-white tracking-widest text-lg">
                          {sale.ticketNumber || "S/N"}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest opacity-60">
                          Cliente
                        </p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate pr-4">
                          {sale.customerName || "Cliente General"}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate pr-4">
                          {sale.customerDNI
                            ? `DNI/RUC: ${sale.customerDNI}`
                            : "DNI/RUC no disponible"}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest opacity-60">
                          Vendedor
                        </p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate pr-4">
                          {sale.sellerName || "Desconocido"}
                        </p>
                      </div>

                      <div className="flex items-center justify-end">
                        <div
                          className={`size-12 rounded-full flex items-center justify-center border-2 transition-all ${expandedSaleId === sale.id ? "bg-primary/10 border-primary text-primary rotate-180" : "border-slate-100 dark:border-slate-800 text-slate-300 group-hover:border-primary/20 group-hover:text-primary/50"}`}
                        >
                          <span className="material-symbols-outlined text-2xl">
                            expand_more
                          </span>
                        </div>
                      </div>
                    </div>

                    {expandedSaleId === sale.id && (
                      <div
                        className="mt-12 animate-in fade-in zoom-in-95 duration-500"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <SaleDetailContent
                          sale={sale}
                          onApprove={() => handleApprove(sale)}
                          onReject={() => handleReject(sale)}
                          onEdit={() => openEditModal(sale)}
                          isProcessing={isProcessing}
                          paymentMethod={paymentMethod}
                          setPaymentMethod={setPaymentMethod}
                          amountPaid={amountPaid}
                          setAmountPaid={setAmountPaid}
                          paymentReference={paymentReference}
                          setPaymentReference={setPaymentReference}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Ticket
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Vendedor
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Fecha
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                        Total
                      </th>
                      <th className="px-6 py-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((sale) => (
                      <React.Fragment key={sale.id}>
                        <tr
                          onClick={() =>
                            expandedSaleId !== sale.id && toggleExpand(sale)
                          }
                          className={`group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${expandedSaleId === sale.id ? "bg-primary/5 dark:bg-primary/10" : ""}`}
                        >
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-900 dark:text-white uppercase text-sm">
                              {sale.ticketNumber || "S/N"}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                              {sale.userName ||
                                sale.sellerName ||
                                "Desconocido"}
                            </p>
                            {sale.customerDNI && (
                              <p className="text-[10px] text-slate-400 mt-1 truncate">
                                DNI/RUC: {sale.customerDNI}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs text-slate-500 font-medium">
                              {sale.date?.toDate().toLocaleString()}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="font-black text-primary">
                              S/ {Number(sale.totalValue).toFixed(2)}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`material-symbols-outlined text-slate-300 transition-transform ${expandedSaleId === sale.id ? "rotate-180 text-primary" : ""}`}
                            >
                              expand_more
                            </span>
                          </td>
                        </tr>
                        {expandedSaleId === sale.id && (
                          <tr>
                            <td
                              colSpan="5"
                              className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/20 border-y border-slate-100 dark:border-slate-800"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="animate-in slide-in-from-top-2 duration-200">
                                <SaleDetailContent
                                  sale={sale}
                                  onApprove={() => handleApprove(sale)}
                                  onReject={() => handleReject(sale)}
                                  onEdit={() => openEditModal(sale)}
                                  isProcessing={isProcessing}
                                  paymentMethod={paymentMethod}
                                  setPaymentMethod={setPaymentMethod}
                                  amountPaid={amountPaid}
                                  setAmountPaid={setAmountPaid}
                                  paymentReference={paymentReference}
                                  setPaymentReference={setPaymentReference}
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Quantities Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">
                Ajustar Cantidades
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {editingItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800"
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                      {item.productName}
                    </p>
                    <p className="text-sm font-black text-primary">
                      S/ {item.subtotal.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {item.saleMode === "cajas" ? "Cajas" : "Unidades"}
                    </p>
                    <input
                      type="number"
                      disabled={editingSale?.status === "cancelled"}
                      value={
                        item.saleMode === "cajas"
                          ? item.quantitySoldBoxes
                          : item.quantitySoldUnits
                      }
                      onChange={(e) =>
                        updateItemQty(
                          idx,
                          item.saleMode === "cajas"
                            ? "quantitySoldBoxes"
                            : "quantitySoldUnits",
                          e.target.value,
                        )
                      }
                      className="w-24 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editingSale?.status === "cancelled"}
                className="flex-1 py-4 bg-slate-900 dark:bg-primary text-white font-black text-xs uppercase tracking-widest hover:opacity-90 dark:hover:opacity-100 dark:hover:brightness-110 transition-all shadow-lg rounded-xl"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmActionModal
        isOpen={!!saleToCancel}
        title="¿Desea anular esta venta pendiente?"
        description="Esta acción cambiará el estado a ANULADA y no se podrá continuar con el cobro."
        confirmText="Sí, anular"
        cancelText="No, volver"
        confirmVariant="danger"
        isProcessing={isProcessing}
        onConfirm={confirmReject}
        onClose={() => {
          if (!isProcessing) setSaleToCancel(null);
        }}
      />
    </AppLayout>
  );
};

export default Cashier;
