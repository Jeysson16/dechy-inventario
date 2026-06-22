import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import AppLayout from "../components/layout/AppLayout";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";

const STATUS_CFG = {
  disponible: {
    label: "Disponible",
    bg: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  vendido: {
    label: "Vendido",
    bg: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  descartado: {
    label: "Descartado",
    bg: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
    dot: "bg-slate-400",
  },
};

export default function DamagedStock() {
  const { currentUser, currentBranch, userProfile, userRole } = useAuth();

  const [lots, setLots] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editLot, setEditLot] = useState(null); // lot being edited (price)
  const [editPrice, setEditPrice] = useState("");
  const [filterStatus, setFilterStatus] = useState("disponible");
  const [search, setSearch] = useState("");

  // Form state
  const [form, setForm] = useState({
    productSearch: "",
    selectedProduct: null,
    quantityBoxes: "",
    quantityUnits: "",
    salePrice: "",
    condition: "",
    subtractFromStock: false,
  });
  const [saving, setSaving] = useState(false);

  // Load damaged lots
  useEffect(() => {
    if (!currentBranch) return;
    const q = query(
      collection(db, "damaged_stock"),
      where("branchId", "==", currentBranch.id),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setLots(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [currentBranch]);

  // Load products for selector
  useEffect(() => {
    if (!currentBranch) return;
    const q = query(
      collection(db, "products"),
      where("branch", "==", currentBranch.id),
    );
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [currentBranch]);

  const filteredProducts = useMemo(() => {
    if (!form.productSearch.trim()) return products.slice(0, 20);
    const q = form.productSearch.toLowerCase();
    return products
      .filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.sku || "").toLowerCase().includes(q),
      )
      .slice(0, 15);
  }, [products, form.productSearch]);

  const filteredLots = useMemo(() => {
    return lots.filter((l) => {
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (l.productName || "").toLowerCase().includes(q) ||
          (l.condition || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [lots, filterStatus, search]);

  const resetForm = () => {
    setForm({
      productSearch: "",
      selectedProduct: null,
      quantityBoxes: "",
      quantityUnits: "",
      salePrice: "",
      condition: "",
      subtractFromStock: false,
    });
  };

  const handleSave = async () => {
    if (!form.selectedProduct) {
      toast.error("Selecciona un producto");
      return;
    }
    if (!form.salePrice || Number(form.salePrice) <= 0) {
      toast.error("Ingresa un precio de venta válido");
      return;
    }
    const qBoxes = Number(form.quantityBoxes) || 0;
    const qUnits = Number(form.quantityUnits) || 0;
    if (qBoxes === 0 && qUnits === 0) {
      toast.error("Ingresa al menos una cantidad");
      return;
    }

    setSaving(true);
    try {
      const product = form.selectedProduct;
      const unitsPerBox = Number(product.unitsPerBox) || 1;
      const totalUnits = qBoxes * unitsPerBox + qUnits;
      const originalPrice =
        Number(product.unitPrice) || Number(product.price) || 0;

      // Register damaged lot
      await addDoc(collection(db, "damaged_stock"), {
        productId: product.id,
        productName: product.name,
        productSku: product.sku || "",
        productImageUrl: product.imageUrl || product.mainImageUrl || "",
        originalPrice,
        salePrice: Number(form.salePrice),
        quantityBoxes: qBoxes,
        quantityUnits: totalUnits,
        unitsPerBox,
        condition: form.condition.trim(),
        branchId: currentBranch.id,
        createdAt: new Date(),
        createdBy: currentUser.email,
        createdByName:
          userProfile?.name || currentUser.displayName || currentUser.email,
        status: "disponible",
      });

      // Log to transactions for audit
      await addDoc(collection(db, "transactions"), {
        productId: product.id,
        productName: product.name,
        type: "DAÑADO",
        quantityBoxes: qBoxes,
        quantityUnits: totalUnits,
        userEmail: currentUser.email,
        userName:
          userProfile?.name || currentUser.displayName || currentUser.email,
        date: new Date(),
        branchId: currentBranch.id,
        note: form.condition.trim() || "Registro de producto dañado",
        salePrice: Number(form.salePrice),
      });

      // Optionally subtract from main stock
      if (form.subtractFromStock && totalUnits > 0) {
        const currentStock = Number(product.currentStock) || 0;
        const boxesDeduct = Math.floor(totalUnits / unitsPerBox);
        const newStock = Math.max(0, currentStock - boxesDeduct);
        await updateDoc(doc(db, "products", product.id), {
          currentStock: newStock,
        });
        await addDoc(collection(db, "transactions"), {
          productId: product.id,
          productName: product.name,
          type: "salida",
          quantityBoxes: boxesDeduct,
          quantityUnits: totalUnits,
          userEmail: currentUser.email,
          userName:
            userProfile?.name || currentUser.displayName || currentUser.email,
          date: new Date(),
          newStock,
          branchId: currentBranch.id,
          note: "Separación a stock dañado",
        });
      }

      toast.success("Lote dañado registrado");
      resetForm();
      setShowForm(false);
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar el lote");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (lot, newStatus) => {
    try {
      await updateDoc(doc(db, "damaged_stock", lot.id), { status: newStatus });
      toast.success(
        newStatus === "vendido"
          ? "Marcado como vendido"
          : "Marcado como descartado",
      );
    } catch (err) {
      toast.error("Error al actualizar estado");
    }
  };

  const handleSaveEditPrice = async () => {
    if (!editLot) return;
    const price = Number(editPrice);
    if (!price || price <= 0) {
      toast.error("Precio inválido");
      return;
    }
    try {
      await updateDoc(doc(db, "damaged_stock", editLot.id), {
        salePrice: price,
      });
      toast.success("Precio actualizado");
      setEditLot(null);
    } catch (err) {
      toast.error("Error al actualizar precio");
    }
  };

  const statsCounts = useMemo(() => {
    const disponible = lots.filter((l) => l.status === "disponible").length;
    const vendido = lots.filter((l) => l.status === "vendido").length;
    const descartado = lots.filter((l) => l.status === "descartado").length;
    return { disponible, vendido, descartado };
  }, [lots]);

  return (
    <AppLayout>
      <div className="flex flex-col min-h-full bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="px-6 lg:px-10 pt-8 pb-4 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <span className="size-10 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                <span className="material-symbols-outlined text-[22px]">
                  warning
                </span>
              </span>
              Stock Dañado
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium">
              Lotes con precio especial — el producto original no se modifica
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 h-11 px-6 bg-orange-600 text-white text-sm font-black uppercase tracking-wider rounded-2xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-500/20 active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Registrar Dañado
          </button>
        </div>

        {/* KPIs */}
        <div className="px-6 lg:px-10 grid grid-cols-3 gap-4 mb-6">
          {[
            {
              label: "Disponibles",
              count: statsCounts.disponible,
              color: "text-amber-600",
              bg: "bg-amber-50 dark:bg-amber-900/20",
              icon: "inventory_2",
            },
            {
              label: "Vendidos",
              count: statsCounts.vendido,
              color: "text-emerald-600",
              bg: "bg-emerald-50 dark:bg-emerald-900/20",
              icon: "sell",
            },
            {
              label: "Descartados",
              count: statsCounts.descartado,
              color: "text-slate-500",
              bg: "bg-slate-100 dark:bg-slate-800",
              icon: "delete_sweep",
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className={`${kpi.bg} rounded-2xl p-4 border border-white/50 dark:border-slate-700/50`}
            >
              <span
                className={`material-symbols-outlined text-[22px] ${kpi.color} mb-1`}
              >
                {kpi.icon}
              </span>
              <p className={`text-2xl font-black ${kpi.color}`}>{kpi.count}</p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {kpi.label}
              </p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="px-6 lg:px-10 flex flex-wrap items-center gap-3 mb-5">
          <div className="relative flex-1 min-w-[220px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
              search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por producto o descripción..."
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
            />
          </div>
          <div className="flex gap-1.5">
            {[
              { key: "disponible", label: "Disponibles" },
              { key: "vendido", label: "Vendidos" },
              { key: "descartado", label: "Descartados" },
              { key: "all", label: "Todos" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`text-xs font-bold px-3 py-2 rounded-xl transition-all ${
                  filterStatus === key
                    ? "bg-orange-600 text-white shadow-sm"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-orange-300 hover:text-orange-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Lots List */}
        <div className="px-6 lg:px-10 pb-10 flex-1">
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse"
                />
              ))}
            </div>
          ) : filteredLots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <span className="material-symbols-outlined text-5xl mb-3 opacity-40">
                warning
              </span>
              <p className="font-semibold text-sm">No hay lotes registrados</p>
              <p className="text-xs mt-1 opacity-70">
                Registra productos dañados con su precio especial
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLots.map((lot) => {
                const cfg = STATUS_CFG[lot.status] || STATUS_CFG.disponible;
                const discount =
                  lot.originalPrice > 0
                    ? Math.round(
                        ((lot.originalPrice - lot.salePrice) /
                          lot.originalPrice) *
                          100,
                      )
                    : 0;
                const createdDate = lot.createdAt?.toDate?.()
                  ? lot.createdAt.toDate().toLocaleDateString("es-PE", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "—";

                return (
                  <div
                    key={lot.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  >
                    <div className="flex items-center gap-4 p-4">
                      {/* Image */}
                      <div className="size-14 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {lot.productImageUrl ? (
                          <img
                            src={lot.productImageUrl}
                            alt={lot.productName}
                            className="size-full object-contain p-1"
                          />
                        ) : (
                          <span className="material-symbols-outlined text-2xl text-slate-300 dark:text-slate-600">
                            image
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-black text-slate-900 dark:text-white truncate">
                            {lot.productName}
                          </span>
                          {lot.productSku && (
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {lot.productSku}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${cfg.bg}`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${cfg.dot}`}
                            />
                            {cfg.label}
                          </span>
                        </div>
                        {lot.condition && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {lot.condition}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Registrado: {createdDate} · Por:{" "}
                          {lot.createdByName || lot.createdBy}
                        </p>
                      </div>

                      {/* Qty & Prices */}
                      <div className="flex items-center gap-4 flex-shrink-0 flex-wrap justify-end">
                        <div className="text-center">
                          <p className="text-lg font-black text-slate-900 dark:text-white leading-none">
                            {lot.quantityBoxes > 0
                              ? `${lot.quantityBoxes} cx`
                              : `${lot.quantityUnits} und`}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Cantidad
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs line-through text-slate-400">
                            S/.{" "}
                            {Number(lot.originalPrice).toLocaleString("es-PE", {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                          {editLot?.id === lot.id ? (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-sm font-bold text-slate-500">
                                S/.
                              </span>
                              <input
                                type="number"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                autoFocus
                                className="w-20 text-center text-sm font-black text-orange-600 border border-orange-300 dark:border-orange-700 rounded-lg px-2 py-0.5 bg-orange-50 dark:bg-orange-900/20 outline-none focus:ring-2 focus:ring-orange-400/30"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveEditPrice();
                                  if (e.key === "Escape") setEditLot(null);
                                }}
                              />
                              <button
                                onClick={handleSaveEditPrice}
                                className="size-6 rounded-lg bg-orange-600 text-white flex items-center justify-center hover:bg-orange-700 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[14px]">
                                  check
                                </span>
                              </button>
                              <button
                                onClick={() => setEditLot(null)}
                                className="size-6 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-400 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[14px]">
                                  close
                                </span>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditLot(lot);
                                setEditPrice(String(lot.salePrice));
                              }}
                              className="flex items-center gap-1 group"
                              title="Editar precio"
                            >
                              <span className="text-base font-black text-orange-600 dark:text-orange-400 leading-none">
                                S/.{" "}
                                {Number(lot.salePrice).toLocaleString("es-PE", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                              <span className="material-symbols-outlined text-[14px] text-slate-400 group-hover:text-orange-500 transition-colors">
                                edit
                              </span>
                            </button>
                          )}
                          {discount > 0 && (
                            <span className="text-[10px] font-black text-rose-500">
                              -{discount}%
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        {lot.status === "disponible" && (
                          <div className="flex flex-col gap-1.5">
                            <button
                              onClick={() => handleStatusChange(lot, "vendido")}
                              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                sell
                              </span>
                              Vendido
                            </button>
                            <button
                              onClick={() =>
                                handleStatusChange(lot, "descartado")
                              }
                              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-500 text-xs font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                delete_sweep
                              </span>
                              Descartar
                            </button>
                          </div>
                        )}
                        {lot.status !== "disponible" && (
                          <button
                            onClick={() =>
                              handleStatusChange(lot, "disponible")
                            }
                            className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-500 text-xs font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            Reactivar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                  <span className="material-symbols-outlined text-[18px]">
                    warning
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Registrar Lote Dañado
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    El producto original no será modificado*
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-400"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-6 space-y-5">
              {/* Product Selector */}
              <div>
                <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                  Producto *
                </label>
                {form.selectedProduct ? (
                  <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-2xl">
                    <div className="size-10 rounded-xl bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800/50 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {form.selectedProduct.imageUrl ||
                      form.selectedProduct.mainImageUrl ? (
                        <img
                          src={
                            form.selectedProduct.imageUrl ||
                            form.selectedProduct.mainImageUrl
                          }
                          alt={form.selectedProduct.name}
                          className="size-full object-contain p-0.5"
                        />
                      ) : (
                        <span className="material-symbols-outlined text-[18px] text-slate-300">
                          image
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-slate-900 dark:text-white truncate">
                        {form.selectedProduct.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        SKU: {form.selectedProduct.sku || "—"} · Stock:{" "}
                        {form.selectedProduct.currentStock || 0} cx · Precio:
                        S/.{" "}
                        {Number(
                          form.selectedProduct.unitPrice ||
                            form.selectedProduct.price ||
                            0,
                        ).toLocaleString("es-PE", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          selectedProduct: null,
                          productSearch: "",
                          salePrice: "",
                        }))
                      }
                      className="p-1.5 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/40 text-orange-400 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        close
                      </span>
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400">
                        search
                      </span>
                      <input
                        value={form.productSearch}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            productSearch: e.target.value,
                          }))
                        }
                        placeholder="Buscar producto por nombre o SKU..."
                        className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                      />
                    </div>
                    {form.productSearch && (
                      <div className="mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
                        {filteredProducts.length === 0 ? (
                          <p className="text-sm text-slate-400 p-3 text-center">
                            Sin resultados
                          </p>
                        ) : (
                          filteredProducts.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                const originalPrice =
                                  Number(p.unitPrice) || Number(p.price) || 0;
                                setForm((f) => ({
                                  ...f,
                                  selectedProduct: p,
                                  productSearch: "",
                                  salePrice: originalPrice
                                    ? String(
                                        Math.round(originalPrice * 0.5 * 100) /
                                          100,
                                      )
                                    : "",
                                }));
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors text-left"
                            >
                              <div className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                {p.imageUrl || p.mainImageUrl ? (
                                  <img
                                    src={p.imageUrl || p.mainImageUrl}
                                    alt={p.name}
                                    className="size-full object-contain"
                                  />
                                ) : (
                                  <span className="material-symbols-outlined text-[14px] text-slate-300">
                                    image
                                  </span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                                  {p.name}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {p.sku || "Sin SKU"} · S/.{" "}
                                  {Number(
                                    p.unitPrice || p.price || 0,
                                  ).toLocaleString("es-PE", {
                                    minimumFractionDigits: 2,
                                  })}
                                </p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Qty */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                    Cajas
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.quantityBoxes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, quantityBoxes: e.target.value }))
                    }
                    placeholder="0"
                    className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                    Unidades extra
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.quantityUnits}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, quantityUnits: e.target.value }))
                    }
                    placeholder="0"
                    className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                  />
                </div>
              </div>

              {/* Sale Price */}
              <div>
                <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                  Precio de venta especial (S/.) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-500">
                    S/.
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.salePrice}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, salePrice: e.target.value }))
                    }
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-2.5 text-sm font-black text-orange-600 dark:text-orange-400 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                  />
                </div>
                {form.selectedProduct &&
                  form.salePrice &&
                  Number(form.selectedProduct.unitPrice || 0) > 0 && (
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-semibold">
                      Descuento:{" "}
                      {Math.round(
                        ((Number(
                          form.selectedProduct.unitPrice ||
                            form.selectedProduct.price,
                        ) -
                          Number(form.salePrice)) /
                          Number(
                            form.selectedProduct.unitPrice ||
                              form.selectedProduct.price,
                          )) *
                          100,
                      )}
                      % del precio original
                    </p>
                  )}
              </div>

              {/* Condition / Notes */}
              <div>
                <label className="block text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                  Descripción del daño
                </label>
                <textarea
                  value={form.condition}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, condition: e.target.value }))
                  }
                  placeholder="Ej: Caja golpeada, producto intacto. Rayón superficial en la superficie..."
                  rows={3}
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 resize-none"
                />
              </div>

              {/* Subtract from main stock toggle */}
              <label className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer hover:border-orange-300 transition-colors">
                <div
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      subtractFromStock: !f.subtractFromStock,
                    }))
                  }
                  className={`relative w-10 h-5.5 h-[22px] rounded-full transition-colors flex-shrink-0 ${
                    form.subtractFromStock
                      ? "bg-orange-500"
                      : "bg-slate-300 dark:bg-slate-600"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 size-[18px] rounded-full bg-white shadow transition-transform ${
                      form.subtractFromStock
                        ? "translate-x-[22px]"
                        : "translate-x-0.5"
                    }`}
                  />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Descontar del stock principal
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Reduce el inventario del producto original al guardar
                  </p>
                </div>
              </label>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="px-5 h-10 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-7 h-10 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-black flex items-center gap-2 transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <span className="material-symbols-outlined animate-spin text-sm">
                    progress_activity
                  </span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">
                      save
                    </span>
                    Guardar Lote
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
