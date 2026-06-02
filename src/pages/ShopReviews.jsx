import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../config/firebase";
import AppLayout from "../components/layout/AppLayout";
import { Star, Trash2, Search, Filter, MessageCircle } from "lucide-react";
import toast from "react-hot-toast";

const COLLECTION = "shopReviews";

const formatDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const StarDisplay = ({ value = 0 }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        size={14}
        className={
          n <= Math.round(value)
            ? "text-amber-400 fill-amber-400"
            : "text-slate-300 fill-slate-200"
        }
      />
    ))}
    <span className="ml-1 text-xs font-semibold text-slate-700">
      {Number(value).toFixed(1)}
    </span>
  </div>
);

const STAR_FILTERS = [
  { label: "Todas", value: 0 },
  { label: "5 ★", value: 5 },
  { label: "4 ★", value: 4 },
  { label: "3 ★", value: 3 },
  { label: "2 ★", value: 2 },
  { label: "1 ★", value: 1 },
];

const ShopReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [starFilter, setStarFilter] = useState(0);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  /* ── Realtime listener ── */
  useEffect(() => {
    const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  /* ── Delete ── */
  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, COLLECTION, id));
      toast.success("Reseña eliminada");
    } catch {
      toast.error("No se pudo eliminar");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  /* ── Filtered list ── */
  const filtered = reviews.filter((r) => {
    const matchStar = starFilter === 0 || r.rating === starFilter;
    const term = search.toLowerCase();
    const matchSearch =
      !term ||
      (r.comment || "").toLowerCase().includes(term) ||
      (r.userName || "").toLowerCase().includes(term) ||
      (r.productId || "").toLowerCase().includes(term);
    return matchStar && matchSearch;
  });

  /* ── Stats ── */
  const avg =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length
      : 0;

  const starCounts = [5, 4, 3, 2, 1].map((s) => ({
    star: s,
    count: reviews.filter((r) => r.rating === s).length,
  }));

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-10 py-6 shrink-0">
          <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <MessageCircle size={20} className="text-amber-500" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Reseñas de la Tienda
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                  {reviews.length} reseña{reviews.length !== 1 ? "s" : ""}{" "}
                  recibida{reviews.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
          <div className="max-w-screen-xl mx-auto flex flex-col gap-6">
            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Average */}
              <div className="col-span-2 sm:col-span-3 lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4">
                <div className="text-5xl font-black text-amber-400 leading-none">
                  {avg.toFixed(1)}
                </div>
                <div>
                  <div className="flex items-center gap-0.5 mb-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        size={16}
                        className={
                          n <= Math.round(avg)
                            ? "text-amber-400 fill-amber-400"
                            : "text-slate-200 fill-slate-200"
                        }
                      />
                    ))}
                  </div>
                  <p className="text-sm text-slate-500">
                    {reviews.length} reseñas
                  </p>
                </div>
              </div>

              {/* Per-star bars */}
              {starCounts.map(({ star, count }) => (
                <div
                  key={star}
                  onClick={() => setStarFilter(starFilter === star ? 0 : star)}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border cursor-pointer transition-all p-4 flex flex-col justify-between ${
                    starFilter === star
                      ? "border-amber-400 ring-2 ring-amber-200"
                      : "border-slate-200 dark:border-slate-800 hover:border-amber-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1">
                      <Star
                        size={13}
                        className="text-amber-400 fill-amber-400"
                      />
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {star}
                      </span>
                    </div>
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      {count}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                    <div
                      className="bg-amber-400 h-1.5 rounded-full"
                      style={{
                        width:
                          reviews.length > 0
                            ? `${(count / reviews.length) * 100}%`
                            : "0%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por usuario, comentario o producto..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Filter size={14} className="text-slate-400" />
                {STAR_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStarFilter(f.value)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      starFilter === f.value
                        ? "bg-amber-400 text-white"
                        : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-300"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <MessageCircle size={40} className="text-slate-300 mb-3" />
                <p className="font-bold text-slate-700 dark:text-slate-300">
                  Sin reseñas
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {reviews.length === 0
                    ? "Aún no se han recibido reseñas"
                    : "Ninguna coincide con el filtro"}
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-5 py-3.5 font-black text-xs uppercase tracking-wider text-slate-500">
                          Usuario
                        </th>
                        <th className="px-5 py-3.5 font-black text-xs uppercase tracking-wider text-slate-500">
                          Producto
                        </th>
                        <th className="px-5 py-3.5 font-black text-xs uppercase tracking-wider text-slate-500">
                          Calificación
                        </th>
                        <th className="px-5 py-3.5 font-black text-xs uppercase tracking-wider text-slate-500">
                          Comentario
                        </th>
                        <th className="px-5 py-3.5 font-black text-xs uppercase tracking-wider text-slate-500">
                          Fecha
                        </th>
                        <th className="px-5 py-3.5 font-black text-xs uppercase tracking-wider text-slate-500 text-right">
                          Acción
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filtered.map((rev) => (
                        <tr
                          key={rev.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          {/* Usuario */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              {rev.userPhoto ? (
                                <img
                                  src={rev.userPhoto}
                                  alt=""
                                  className="size-8 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="size-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-600 font-black text-sm">
                                  {(rev.userName || "U")
                                    .charAt(0)
                                    .toUpperCase()}
                                </div>
                              )}
                              <span className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                {rev.userName || "Anónimo"}
                              </span>
                            </div>
                          </td>

                          {/* Producto */}
                          <td className="px-5 py-4">
                            <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-lg">
                              {rev.productId || "—"}
                            </span>
                          </td>

                          {/* Calificación */}
                          <td className="px-5 py-4">
                            <StarDisplay value={rev.rating} />
                          </td>

                          {/* Comentario */}
                          <td className="px-5 py-4 max-w-xs">
                            <p className="text-slate-800 dark:text-slate-200 leading-relaxed line-clamp-2">
                              {rev.comment || (
                                <span className="italic text-slate-400">
                                  Sin comentario
                                </span>
                              )}
                            </p>
                          </td>

                          {/* Fecha */}
                          <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">
                            {formatDate(rev.createdAt)}
                          </td>

                          {/* Acción */}
                          <td className="px-5 py-4 text-right">
                            {confirmId === rev.id ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setConfirmId(null)}
                                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={() => handleDelete(rev.id)}
                                  disabled={deletingId === rev.id}
                                  className="px-3 py-1.5 text-xs rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 disabled:opacity-60 transition-colors"
                                >
                                  {deletingId === rev.id ? "…" : "Confirmar"}
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmId(rev.id)}
                                className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                title="Eliminar reseña"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer count */}
                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500">
                    Mostrando {filtered.length} de {reviews.length} reseña
                    {reviews.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ShopReviews;
