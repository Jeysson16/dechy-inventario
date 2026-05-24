import { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";

const PALETTE = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#ec4899",
  "#84cc16",
  "#14b8a6",
];

export const toDate = (v) => {
  if (!v) return null;
  if (v?.toDate) return v.toDate();
  if (v instanceof Date) return v;
  return new Date(v);
};

const getStart = (range) => {
  const n = new Date();
  if (range === "today")
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  if (range === "week") return new Date(n.getTime() - 7 * 86400000);
  if (range === "year") return new Date(n.getFullYear(), 0, 1);
  return new Date(n.getFullYear(), n.getMonth(), 1);
};

const useReportsData = (dateRange = "month") => {
  const { currentBranch } = useAuth();
  const branchId = currentBranch?.id;

  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [transactions, setTrans] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const start = Timestamp.fromDate(getStart(dateRange));
    const unsubs = [];

    const safe = (setter, key) => (snap) => {
      setter(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      if (key === "sales") setLoading(false);
    };
    const onErr = (e) => {
      setError(e.message);
      setLoading(false);
    };

    unsubs.push(
      onSnapshot(
        query(
          collection(db, "sales"),
          where("branchId", "==", branchId),
          where("date", ">=", start),
          orderBy("date", "desc"),
        ),
        safe(setSales, "sales"),
        onErr,
      ),
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, "products"), where("branch", "==", branchId)),
        safe(setProducts),
      ),
    );
    unsubs.push(
      onSnapshot(
        query(
          collection(db, "transactions"),
          where("branchId", "==", branchId),
          orderBy("date", "desc"),
          limit(400),
        ),
        safe(setTrans),
      ),
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, "customers"), where("branchId", "==", branchId)),
        safe(setCustomers),
      ),
    );
    unsubs.push(onSnapshot(collection(db, "branches"), safe(setBranches)));

    return () => unsubs.forEach((u) => u());
  }, [branchId, dateRange]);

  const derived = useMemo(() => {
    /* ── Top productos vendidos ── */
    const prodMap = {};
    sales.forEach((sale) => {
      (sale.items || []).forEach((item) => {
        const k = item.productId || item.productName;
        if (!prodMap[k]) {
          prodMap[k] = {
            nombre: item.productName || "–",
            categoria: item.category || "Sin categoría",
            unidades: 0,
            ingresos: 0,
          };
        }
        prodMap[k].unidades +=
          (item.quantitySoldUnits || 0) +
          (item.quantitySoldBoxes || 0) * (item.unitsPerBox || 1);
        prodMap[k].ingresos += item.subtotal || 0;
      });
    });
    const topProductos = Object.values(prodMap).sort(
      (a, b) => b.ingresos - a.ingresos,
    );

    /* ── Por categoría ── */
    const catMap = {};
    topProductos.forEach((p) => {
      if (!catMap[p.categoria])
        catMap[p.categoria] = {
          categoria: p.categoria,
          ingresos: 0,
          unidades: 0,
        };
      catMap[p.categoria].ingresos += p.ingresos;
      catMap[p.categoria].unidades += p.unidades;
    });
    const porCategoria = Object.values(catMap)
      .sort((a, b) => b.ingresos - a.ingresos)
      .map((c, i) => ({ ...c, fill: PALETTE[i % PALETTE.length] }));

    /* ── Ganancias por día: últimos 7 vs 7 previos ── */
    const dayBuckets = {},
      prevBuckets = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dayBuckets[d.toDateString()] = {
        fecha: d.toLocaleDateString("es-PE", { weekday: "short" }),
        hoy: 0,
      };
    }
    for (let i = 13; i >= 7; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      prevBuckets[d.toDateString()] = 0;
    }
    sales.forEach((s) => {
      const d = toDate(s.date);
      if (!d) return;
      const ds = d.toDateString();
      if (dayBuckets[ds] !== undefined) dayBuckets[ds].hoy += s.totalValue || 0;
      if (prevBuckets[ds] !== undefined) prevBuckets[ds] += s.totalValue || 0;
    });
    const dayKeys = Object.keys(dayBuckets);
    const prevKeys = Object.keys(prevBuckets);
    const ganancias = dayKeys.map((k, i) => ({
      ...dayBuckets[k],
      anterior: prevBuckets[prevKeys[i]] || 0,
    }));

    /* ── Productos sin ventas en el período ── */
    const soldIds = new Set(
      sales.flatMap((s) =>
        (s.items || []).map((i) => i.productId).filter(Boolean),
      ),
    );
    const sinVentas = products
      .filter((p) => !soldIds.has(p.id))
      .map((p) => ({
        nombre: p.name,
        categoria: p.category || "–",
        stock: p.currentStock || 0,
        sku: p.sku || "–",
        status: p.status || "Disponible",
      }));

    /* ── Stock semáforo ── */
    const stockData = [...products]
      .map((p) => {
        const minStock = p.minStock || p.stockMinimo || 10;
        const cur = Number(p.currentStock) || 0;
        const estado =
          cur === 0 || p.status === "Agotado"
            ? "critico"
            : p.status === "Stock Bajo" || cur < minStock
              ? "alerta"
              : "ok";
        const rawCat = p.category;
        const categoria = String(
          (typeof rawCat === "object" && rawCat !== null
            ? rawCat.name || rawCat.label || rawCat.id || "Sin categoría"
            : rawCat) || "Sin categoría",
        ).trim();
        const rawSub = p.subcategory;
        const subcategoria = String(
          (typeof rawSub === "object" && rawSub !== null
            ? rawSub.name || rawSub.label || rawSub.id || ""
            : rawSub) || "",
        ).trim();
        return {
          id: p.id,
          nombre: p.name || "–",
          categoria,
          subcategoria,
          stockActual: cur,
          stockMinimo: minStock,
          estado,
          sku: p.sku || "–",
          imageUrl: p.imageUrl || null,
        };
      })
      .sort((a, b) => a.stockActual - b.stockActual);

    /* ── Transferencias ── */
    const transferencias = transactions
      .filter((t) => t.type === "TRASLADO")
      .map((t) => ({
        id: t.id,
        producto: t.productName || "–",
        origen: t.originLocation || t.fromBranch || "–",
        destino: t.destinationLocation || t.toBranch || "–",
        cantidad: (t.quantityBoxes || 0) + (t.quantityUnits || 0),
        fecha: toDate(t.date)?.toLocaleDateString("es-PE") || "–",
        usuario: t.userName || t.userEmail || "–",
      }));

    /* ── Entradas ── */
    const entradas = transactions
      .filter((t) => t.type === "entrada")
      .map((t) => ({
        id: t.id,
        producto: t.productName || "–",
        cajasUnidades: `${t.quantityBoxes || 0}cx / ${t.quantityUnits || 0}u`,
        fecha: toDate(t.date)?.toLocaleDateString("es-PE") || "–",
        usuario: t.userName || t.userEmail || "–",
        stockNuevo: t.newStock,
      }));

    /* ── Salidas por día (ventas) ── */
    const salidasMap = {};
    sales.forEach((s) => {
      const d = toDate(s.date);
      if (!d) return;
      const ds = d.toDateString();
      if (!salidasMap[ds])
        salidasMap[ds] = {
          fecha: d.toLocaleDateString("es-PE"),
          unidades: 0,
          ingresos: 0,
          ventas: 0,
        };
      (s.items || []).forEach((item) => {
        salidasMap[ds].unidades +=
          (item.quantitySoldUnits || 0) +
          (item.quantitySoldBoxes || 0) * (item.unitsPerBox || 1);
        salidasMap[ds].ingresos += item.subtotal || 0;
      });
      salidasMap[ds].ventas++;
    });
    const salidas = Object.values(salidasMap).sort(
      (a, b) => new Date(b.fecha) - new Date(a.fecha),
    );

    /* ── Top clientes ── */
    const topClientes = [...customers]
      .sort((a, b) => (b.totalSalesAmount || 0) - (a.totalSalesAmount || 0))
      .slice(0, 10)
      .map((c, i) => ({
        nombre: c.customerName || "Sin nombre",
        compras: c.totalSalesCount || 0,
        monto: c.totalSalesAmount || 0,
        inicial: (c.customerName || "?")[0].toUpperCase(),
        color: PALETTE[i % PALETTE.length],
      }));

    /* ── Método de pago ── */
    const metodoPagoMap = {};
    sales.forEach((s) => {
      const m = s.paymentMethod || "Otro";
      if (!metodoPagoMap[m]) metodoPagoMap[m] = { name: m, value: 0, count: 0 };
      metodoPagoMap[m].value += s.totalValue || 0;
      metodoPagoMap[m].count++;
    });
    const metodoPago = Object.values(metodoPagoMap)
      .sort((a, b) => b.value - a.value)
      .map((m, i) => ({ ...m, fill: PALETTE[i % PALETTE.length] }));

    /* ── Por vendedor ── */
    const vendedorMap = {};
    sales.forEach((s) => {
      const k = s.sellerName || "Desconocido";
      if (!vendedorMap[k]) vendedorMap[k] = { nombre: k, total: 0, count: 0 };
      vendedorMap[k].total += s.totalValue || 0;
      vendedorMap[k].count++;
    });
    const topVendedores = Object.values(vendedorMap).sort(
      (a, b) => b.total - a.total,
    );

    /* ── Mermas ── */
    const mermas = transactions.filter((t) =>
      ["merma", "pérdida", "daño", "loss"].includes(
        (t.type || "").toLowerCase(),
      ),
    );

    /* ── KPIs ── */
    const ventasMes = sales.reduce((a, s) => a + (s.totalValue || 0), 0);
    const stockCritico = products.filter(
      (p) => (p.currentStock || 0) === 0 || p.status === "Agotado",
    ).length;
    const enAlerta = products.filter((p) => p.status === "Stock Bajo").length;
    const startMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    const clientesNuevos = customers.filter((c) => {
      const d = toDate(c.createdAt);
      return d && d >= startMonth;
    }).length;

    /* ── Alertas ── */
    const alertas = [
      ...products
        .filter((p) => (p.currentStock || 0) === 0 || p.status === "Agotado")
        .slice(0, 4)
        .map((p) => ({
          tipo: "critico",
          msg: `${p.name}: agotado (0 unid.)`,
          modulo: "Inventario",
        })),
      ...products
        .filter((p) => p.status === "Stock Bajo" && (p.currentStock || 0) > 0)
        .slice(0, 4)
        .map((p) => ({
          tipo: "alerta",
          msg: `${p.name}: stock bajo (${p.currentStock} unid.)`,
          modulo: "Inventario",
        })),
    ];

    /* ── Sparklines (7 días) ── */
    const sparkVentas = ganancias.map((d) => d.hoy);

    return {
      topProductos,
      porCategoria,
      sinVentas,
      ganancias,
      stockData,
      transferencias,
      entradas,
      salidas,
      topClientes,
      metodoPago,
      topVendedores,
      mermas,
      sparkVentas,
      alertas,
      kpis: {
        ventasMes,
        stockCritico,
        enAlerta,
        totalVentas: sales.length,
        clientesNuevos,
        totalProductos: products.length,
        totalClientes: customers.length,
      },
    };
  }, [sales, products, transactions, customers]);

  return { loading, error, derived, branches, rawTransactions: transactions };
};

export default useReportsData;
