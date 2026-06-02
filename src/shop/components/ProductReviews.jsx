/**
 * ProductReviews — Calificaciones y comentarios por producto.
 * Usa MUI Rating + Firestore (colección shopReviews).
 * Cualquier usuario puede ver las reseñas; se requiere login para escribir.
 */
import { useEffect, useState } from "react";
import Rating from "@mui/material/Rating";
import Box from "@mui/material/Box";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useShopAuth } from "../context/ShopAuthContext";
import { MessageCircle, Star } from "lucide-react";

const COLLECTION = "shopReviews";

const formatDate = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const ProductReviews = ({ productId }) => {
  const { user, isLoggedIn, setAuthModal } = useShopAuth();
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  /* ── Load reviews ── */
  useEffect(() => {
    if (!productId) return;
    setLoadingReviews(true);
    const q = query(
      collection(db, COLLECTION),
      where("productId", "==", productId),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingReviews(false);
      },
      () => setLoadingReviews(false),
    );
    return unsub;
  }, [productId]);

  /* ── Check if current user already reviewed ── */
  const alreadyReviewed =
    isLoggedIn && reviews.some((r) => r.userId === user?.uid);

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
      : 0;

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoggedIn) {
      setAuthModal(true);
      return;
    }
    if (!comment.trim()) {
      setError("Escribe un comentario.");
      return;
    }
    if (alreadyReviewed) {
      setError("Ya enviaste una reseña para este producto.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await addDoc(collection(db, COLLECTION), {
        productId,
        userId: user.uid,
        userName: user.displayName || user.email?.split("@")[0] || "Usuario",
        userPhoto: user.photoURL || null,
        rating,
        comment: comment.trim(),
        createdAt: serverTimestamp(),
      });
      setComment("");
      setRating(5);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } catch {
      setError("Error al enviar. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-14 border-t border-slate-200 pt-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <MessageCircle size={20} className="text-[#CFAE70]" />
            Reseñas de clientes
          </h2>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <Rating value={avgRating} precision={0.5} readOnly size="small" />
              <span className="text-sm text-slate-900 font-medium">
                {avgRating.toFixed(1)} · {reviews.length} reseña
                {reviews.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Review list */}
      {loadingReviews ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="shop-skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-slate-700 mb-6">
          Aún no hay reseñas. ¡Sé el primero en opinar!
        </p>
      ) : (
        <ul className="space-y-4 mb-8">
          {reviews.map((rev) => (
            <li
              key={rev.id}
              className="flex gap-3 p-4 rounded-xl bg-white border border-slate-200"
            >
              {/* Avatar */}
              {rev.userPhoto ? (
                <img
                  src={rev.userPhoto}
                  alt=""
                  className="size-9 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="size-9 rounded-full bg-[#CFAE70]/20 flex items-center justify-center flex-shrink-0 text-[#CFAE70] font-black text-sm">
                  {(rev.userName || "U").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-900">
                    {rev.userName}
                  </span>
                  <span className="text-xs text-slate-800">
                    {formatDate(rev.createdAt)}
                  </span>
                </div>
                <Rating
                  value={rev.rating}
                  readOnly
                  size="small"
                  sx={{ my: 0.5 }}
                />
                <p className="text-sm text-slate-900 leading-relaxed">
                  {rev.comment}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Write review form */}
      {!alreadyReviewed && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-base font-black text-slate-900 mb-4">
            {isLoggedIn ? "Escribe tu reseña" : "Inicia sesión para opinar"}
          </h3>

          {!isLoggedIn ? (
            <button
              onClick={() => setAuthModal(true)}
              className="btn-accent text-sm px-5 py-2.5"
            >
              Iniciar sesión
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-800 uppercase tracking-wide mb-1">
                  Calificación
                </p>
                <Box>
                  <Rating
                    name="product-rating"
                    value={rating}
                    onChange={(_, v) => setRating(v ?? 1)}
                    size="large"
                    sx={{ color: "#CFAE70" }}
                  />
                </Box>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 uppercase tracking-wide mb-1">
                  Comentario
                </p>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="¿Qué te pareció este producto?"
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#CFAE70]/40 focus:border-[#CFAE70] transition"
                />
              </div>
              {error && (
                <p className="text-xs text-red-500 font-medium">{error}</p>
              )}
              {submitted && (
                <p className="text-xs text-emerald-600 font-bold">
                  ¡Reseña enviada! Gracias por tu opinión.
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="btn-accent text-sm px-6 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Enviando…" : "Enviar reseña"}
              </button>
            </form>
          )}
        </div>
      )}

      {alreadyReviewed && (
        <p className="text-xs text-slate-700 italic">
          Ya enviaste una reseña para este producto. ¡Gracias!
        </p>
      )}
    </section>
  );
};

export default ProductReviews;
