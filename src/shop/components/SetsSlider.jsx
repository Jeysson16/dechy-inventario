import { useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowRight, ShoppingCart, Package2, Sparkles } from "lucide-react";
import anime from "animejs";

/* ── helpers ── */
const toImg = (set) =>
  set?.mainImageUrl ||
  set?.imageUrl ||
  (Array.isArray(set?.imageUrls) && set.imageUrls[0]?.url) ||
  null;

const computedSavings = (set) => {
  if (!set?.originalTotal || !set?.price) return 0;
  const orig = Number(set.originalTotal);
  const price = Number(set.price || set.unitPrice || 0);
  if (orig <= 0 || price >= orig) return 0;
  return Math.round(((orig - price) / orig) * 100);
};

/* ── SetCard ── */
const SetCard = ({ set, onAddToCart, index }) => {
  const cardRef = useRef(null);
  const price = Number(set.price || set.unitPrice || 0);
  const stock = Number(set.computedStock ?? 0);
  const hasStock = stock > 0;
  const savings = computedSavings(set);
  const summary = Array.isArray(set.componentsSummary)
    ? set.componentsSummary
    : [];
  const imgSrc = toImg(set);
  const productPath = `/tienda/producto/${set.slug || set.id}`;

  const onEnter = () => {
    const el = cardRef.current;
    if (!el) return;
    anime({ targets: el.querySelector(".sc-img"), scale: 1.07, duration: 480, easing: "easeOutQuart" });
    anime({ targets: el.querySelector(".sc-price"), translateX: [0, 4], duration: 280, easing: "easeOutQuad" });
    anime({ targets: el.querySelector(".sc-badge"), scale: [1, 1.08], duration: 240, easing: "easeOutBack" });
  };

  const onLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    anime({ targets: el.querySelector(".sc-img"), scale: 1, duration: 480, easing: "easeOutQuart" });
    anime({ targets: el.querySelector(".sc-price"), translateX: 0, duration: 280, easing: "easeOutQuad" });
    anime({ targets: el.querySelector(".sc-badge"), scale: 1, duration: 200, easing: "easeOutQuad" });
  };

  return (
    <motion.article
      ref={cardRef}
      initial={{ opacity: 0, y: 22, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.42, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className="group flex flex-col rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-xl transition-shadow duration-300 cursor-pointer"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {/* Image */}
      <Link to={productPath} className="block relative overflow-hidden aspect-[4/3]">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={set.name}
            loading="lazy"
            className="sc-img w-full h-full object-cover"
            style={{ willChange: "transform" }}
          />
        ) : (
          <div className="sc-img w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
            <Package2 size={36} className="text-slate-300" />
          </div>
        )}

        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* SET badge */}
        <div className="sc-badge absolute top-3 left-3 flex items-center gap-1 bg-[#CFAE70] text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md tracking-wide">
          <Sparkles size={9} />
          SET COMPLETO
        </div>

        {/* Savings badge */}
        {savings > 0 && (
          <div className="absolute top-3 right-3 bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow">
            -{savings}%
          </div>
        )}

        {/* Stock badge bottom */}
        <div className="absolute bottom-3 left-3">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            hasStock
              ? "bg-emerald-500/90 text-white"
              : "bg-slate-700/80 text-slate-200"
          }`}>
            {hasStock ? `${stock} disponibles` : "Agotado"}
          </span>
        </div>
      </Link>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Name */}
        <Link to={productPath}>
          <h3 className="line-clamp-2 text-sm font-black text-slate-900 leading-snug group-hover:text-[#CFAE70] transition-colors">
            {set.name}
          </h3>
        </Link>

        {/* Components pills */}
        {summary.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {summary.slice(0, 3).map((item, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.07 + i * 0.06 + 0.2 }}
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
              >
                <span className="size-1 rounded-full bg-[#CFAE70] flex-shrink-0" />
                {item.length > 18 ? item.slice(0, 18) + "…" : item}
              </motion.span>
            ))}
            {summary.length > 3 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">
                +{summary.length - 3} más
              </span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="mt-auto">
          <p className="sc-price text-xl font-black text-[#CFAE70]">
            S/ {price.toFixed(2)}
          </p>
          {savings > 0 && set.originalTotal > 0 && (
            <p className="text-[11px] text-slate-400 mt-0.5">
              <span className="line-through">
                S/ {Number(set.originalTotal).toFixed(2)}
              </span>
              <span className="text-emerald-600 font-bold ml-1.5">
                Ahorras S/ {(Number(set.originalTotal) - price).toFixed(2)}
              </span>
            </p>
          )}
        </div>

        {/* CTA */}
        <button
          disabled={!hasStock}
          onClick={() => onAddToCart?.(set)}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
            hasStock
              ? "bg-slate-900 text-white hover:bg-[#CFAE70] hover:text-slate-900 active:scale-95"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}
        >
          <ShoppingCart size={15} />
          {hasStock ? "Agregar set" : "Sin stock"}
        </button>
      </div>
    </motion.article>
  );
};

/* ── SetsSlider ── */
const SetsSlider = ({ sets = [], onAddToCart }) => {
  const sliderRef = useRef(null);
  const navigate = useNavigate();

  const scroll = (dir) => {
    if (!sliderRef.current) return;
    sliderRef.current.scrollBy({
      left: dir === "left" ? -sliderRef.current.clientWidth * 0.75 : sliderRef.current.clientWidth * 0.75,
      behavior: "smooth",
    });
  };

  if (sets.length === 0) return null;

  return (
    <section className="py-2">
      {/* ── Header ── */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-2 mb-2"
          >
            {/* Animated gold badge */}
            <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-[#CFAE70] bg-[#CFAE70]/10 border border-[#CFAE70]/30 px-3 py-1 rounded-full"
              style={{ animation: "setBadgePulse 2.4s ease-in-out infinite" }}
            >
              <Sparkles size={11} />
              Paquetes especiales
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="shop-section-title"
          >
            Sets &amp; Combos
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0.12 }}
            className="shop-section-sub"
          >
            Todo lo que necesitas en un solo paquete · Mayor valor, menor precio
          </motion.p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => scroll("left")}
            className="size-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:border-[#CFAE70] hover:text-[#CFAE70] transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => scroll("right")}
            className="size-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:border-[#CFAE70] hover:text-[#CFAE70] transition-colors"
          >
            <ChevronRight size={18} />
          </button>
          <Link
            to="/tienda/catalogo"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-[#CFAE70] transition-colors ml-2"
          >
            Ver todos <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {/* ── Slider ── */}
      <div
        ref={sliderRef}
        className="shop-products-slider flex gap-5 pb-3"
      >
        {sets.map((set, i) => (
          <div key={set.id} className="flex-shrink-0 w-[240px] sm:w-[260px]">
            <SetCard set={set} onAddToCart={onAddToCart} index={i} />
          </div>
        ))}

        {/* View all card */}
        <div className="flex-shrink-0 w-[180px] sm:w-[200px] flex items-center justify-center">
          <button
            onClick={() => navigate("/tienda/catalogo")}
            className="flex flex-col items-center justify-center gap-3 w-full h-full min-h-[300px] rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-[#CFAE70] hover:text-[#CFAE70] transition-all group"
          >
            <div className="size-12 rounded-full border-2 border-current flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowRight size={22} />
            </div>
            <span className="text-sm font-bold text-center px-4 leading-snug">
              Ver todos los sets
            </span>
          </button>
        </div>
      </div>

      {/* ── Decorative divider ── */}
      <div className="mt-6 flex items-center gap-3">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#CFAE70]/30 to-transparent" />
        <span className="text-[10px] font-bold text-[#CFAE70]/60 uppercase tracking-widest">
          combos disponibles
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#CFAE70]/30 to-transparent" />
      </div>

      <style>{`
        @keyframes setBadgePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(207,174,112,0); }
          50%       { box-shadow: 0 0 0 5px rgba(207,174,112,0.15); }
        }
      `}</style>
    </section>
  );
};

export default SetsSlider;
