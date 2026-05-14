import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "../components/layout/AppLayout";
import { db } from "../config/firebase";
import { matchesAnyFuzzy } from "../utils/search";

const toDateValue = (timestamp) => {
  if (!timestamp) return null;
  if (timestamp?.toDate) return timestamp.toDate();
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (timestamp) => {
  const value = toDateValue(timestamp);
  if (!value) return "-";
  return value.toLocaleString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatMoney = (value) => `S/ ${Number(value || 0).toFixed(2)}`;

const ShopCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    const unsubCustomers = onSnapshot(
      collection(db, "shopCustomers"),
      (snapshot) => {
        const list = [];
        snapshot.forEach((customerDoc) => {
          list.push({ id: customerDoc.id, ...customerDoc.data() });
        });
        setCustomers(list);
      },
      () => {
        setCustomers([]);
      },
    );

    const unsubOrders = onSnapshot(
      collection(db, "shopOrders"),
      (snapshot) => {
        const list = [];
        snapshot.forEach((orderDoc) => {
          list.push({ id: orderDoc.id, ...orderDoc.data() });
        });
        setOrders(list);
      },
      () => {
        setOrders([]);
      },
    );

    return () => {
      unsubCustomers();
      unsubOrders();
    };
  }, []);

  const metricsByCustomer = useMemo(() => {
    const map = {};

    orders.forEach((order) => {
      if (!order.userId) return;
      if (!map[order.userId]) {
        map[order.userId] = {
          totalOrders: 0,
          totalAmount: 0,
          pendingOrders: 0,
          lastOrderDate: null,
          orders: [],
        };
      }

      const customerMetrics = map[order.userId];
      customerMetrics.totalOrders += 1;
      customerMetrics.totalAmount += Number(order.total || 0);
      customerMetrics.orders.push(order);

      if (order.status === "pendiente") {
        customerMetrics.pendingOrders += 1;
      }

      const orderDate = toDateValue(order.createdAt);
      if (
        orderDate &&
        (!customerMetrics.lastOrderDate ||
          orderDate > customerMetrics.lastOrderDate)
      ) {
        customerMetrics.lastOrderDate = orderDate;
      }
    });

    return map;
  }, [orders]);

  const consolidatedCustomers = useMemo(() => {
    return customers
      .map((customer) => {
        const metrics = metricsByCustomer[customer.id] || {
          totalOrders: 0,
          totalAmount: 0,
          pendingOrders: 0,
          lastOrderDate: null,
          orders: [],
        };

        const displayName =
          customer.displayName ||
          [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
          customer.email ||
          "Sin nombre";

        return {
          ...customer,
          displayName,
          ...metrics,
        };
      })
      .sort((a, b) => {
        if (!a.lastOrderDate && !b.lastOrderDate) return 0;
        if (!a.lastOrderDate) return 1;
        if (!b.lastOrderDate) return -1;
        return b.lastOrderDate - a.lastOrderDate;
      });
  }, [customers, metricsByCustomer]);

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim();
    if (!term) return consolidatedCustomers;

    return consolidatedCustomers.filter((customer) =>
      matchesAnyFuzzy(term, [
        customer.displayName,
        customer.email,
        customer.phone,
        customer.documentNumber,
      ]),
    );
  }, [consolidatedCustomers, searchTerm]);

  const selectedCustomerOrders = useMemo(() => {
    if (!selectedCustomer) return [];
    return [...(selectedCustomer.orders || [])].sort((a, b) => {
      const dateA = toDateValue(a.createdAt) || 0;
      const dateB = toDateValue(b.createdAt) || 0;
      return dateB - dateA;
    });
  }, [selectedCustomer]);

  const totals = useMemo(() => {
    const totalCustomers = consolidatedCustomers.length;
    const totalOrders = consolidatedCustomers.reduce(
      (acc, item) => acc + item.totalOrders,
      0,
    );
    const totalRevenue = consolidatedCustomers.reduce(
      (acc, item) => acc + item.totalAmount,
      0,
    );
    const pendingOrders = consolidatedCustomers.reduce(
      (acc, item) => acc + item.pendingOrders,
      0,
    );

    return {
      totalCustomers,
      totalOrders,
      totalRevenue,
      pendingOrders,
    };
  }, [consolidatedCustomers]);

  return (
    <AppLayout>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 lg:p-10">
        <div className="max-w-screen-xl mx-auto space-y-6">
          <header>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Usuarios Registrados Tienda
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Control de clientes web y su historial de compras.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                Usuarios
              </p>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                {totals.totalCustomers}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                Compras Totales
              </p>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                {totals.totalOrders}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                Facturación
              </p>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                {formatMoney(totals.totalRevenue)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                Pedidos Pendientes
              </p>
              <p className="text-3xl font-black text-amber-500 mt-2">
                {totals.pendingOrders}
              </p>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Lista de Usuarios
              </h2>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por nombre, correo, celular o documento"
                className="w-full md:w-96 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-900 dark:text-white"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[980px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Cliente
                    </th>
                    <th className="py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Contacto
                    </th>
                    <th className="py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Documento
                    </th>
                    <th className="py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Compras
                    </th>
                    <th className="py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Facturación
                    </th>
                    <th className="py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Última Compra
                    </th>
                    <th className="py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Pendientes
                    </th>
                    <th className="py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-10 text-center text-sm font-semibold text-slate-500"
                      >
                        No hay usuarios registrados con ese criterio.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="py-3 pr-4">
                          <p className="text-sm font-black text-slate-900 dark:text-white">
                            {customer.displayName}
                          </p>
                          <p className="text-xs font-semibold text-slate-400">
                            ID: {customer.id}
                          </p>
                        </td>
                        <td className="py-3 pr-4">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {customer.email || "Sin correo"}
                          </p>
                          <p className="text-xs font-semibold text-slate-400">
                            {customer.phone || "Sin celular"}
                          </p>
                        </td>
                        <td className="py-3 pr-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {(customer.documentType || "-") +
                            " " +
                            (customer.documentNumber || "")}
                        </td>
                        <td className="py-3 pr-4 text-sm font-black text-slate-900 dark:text-white">
                          {customer.totalOrders}
                        </td>
                        <td className="py-3 pr-4 text-sm font-black text-primary">
                          {formatMoney(customer.totalAmount)}
                        </td>
                        <td className="py-3 pr-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {formatDateTime(customer.lastOrderDate)}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-black ${
                              customer.pendingOrders > 0
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {customer.pendingOrders}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedCustomer(customer)}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-black hover:bg-slate-700"
                          >
                            Ver compras
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => setSelectedCustomer(null)}
          ></div>
          <div className="relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                Historial de Compras
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {selectedCustomer.displayName} •{" "}
                {selectedCustomer.email || "Sin correo"}
              </p>
            </div>

            <div className="p-5 overflow-y-auto max-h-[65vh]">
              {selectedCustomerOrders.length === 0 ? (
                <p className="text-sm font-semibold text-slate-500">
                  Este usuario aún no tiene compras registradas.
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedCustomerOrders.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 p-4"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <p className="text-sm font-black text-slate-900 dark:text-white">
                          Pedido: {order.id}
                        </p>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                          <span>{formatDateTime(order.createdAt)}</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                            {order.status || "pendiente"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <p>Total: {formatMoney(order.total)}</p>
                        <p>Entrega: {order.deliveryType || "-"}</p>
                        <p>Pago: {order.paymentMethod || "-"}</p>
                      </div>

                      <div className="mt-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3">
                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-400 mb-2">
                          Productos
                        </p>
                        <ul className="space-y-1">
                          {(order.items || []).map((item, idx) => (
                            <li
                              key={`${order.id}-${item.productId || idx}`}
                              className="text-sm font-semibold text-slate-700 dark:text-slate-200"
                            >
                              {item.name} • {item.quantity} und •{" "}
                              {formatMoney(item.unitPrice)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-black hover:bg-slate-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default ShopCustomers;
