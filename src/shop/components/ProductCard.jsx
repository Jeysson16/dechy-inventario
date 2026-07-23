import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, ShoppingCart, Sparkles } from "lucide-react";
import anime from "animejs";
import { toProductImage } from "../utils/stock";

const getGalleryImage = (product, index) => {
  if (!Array.isArray(product?.imageUrls) || product.imageUrls.length <= index) {
    return "";
  }

  const item = product.imageUrls[index];
  if (typeof item === "string") return item;
  return item?.url || "";
};

const ProductCard = ({ product, onAddToCart }) => {
  const cardRef = useRef(null);
  const price = Number(product?.unitPrice || product?.price || 0);
  const isOnSale = product?.isOnSale && product?.salePrice > 0;
  const salePrice = Number(product?.salePrice || 0);
  const discountPercent = product?.discountPercent || 0;
  const primaryImage = toProductImage(product);
  const hoverImage = getGalleryImage(product, 1);

  const handleMouseEnter = () => {
    const card = cardRef.current;
    if (!card) return;
    anime({ targets: card.querySelector(".card-img-main"), scale: 1.08, rotate: -0.6, duration: 520, easing: "easeOutQuart" });
    anime({ targets: card.querySelector(".card-hover-img"), opacity: hoverImage ? 1 : 0, scale: [1.04, 1], duration: 520, easing: "easeOutQuart" });
    anime({ targets: card.querySelector(".card-price"), translateX: [0, 4], duration: 300, easing: "easeOutQuad" });
    anime({ targets: card.querySelector(".catalog-card-shine"), translateX: ["-130%", "130%"], duration: 700, easing: "easeOutQuad" });
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    anime({ targets: card.querySelector(".card-img-main"), scale: 1, rotate: 0, duration: 520, easing: "easeOutQuart" });
    anime({ targets: card.querySelector(".card-hover-img"), opacity: 0, duration: 260, easing: "easeOutQuad" });
    anime({ targets: card.querySelector(".card-price"), translateX: 0, duration: 300, easing: "easeOutQuad" });
  };

  const productPath = `/tienda/producto/${product.slug || product.id}`;

  return (
    <motion.article
      ref={cardRef}
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="shop-product-card group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link to={productPath} className="catalog-product-media block overflow-hidden relative">
        <img
          src={primaryImage}
          alt={product.name || "Producto"}
          loading="lazy"
          className="card-img-main aspect-[4/5] w-full object-cover"
          style={{ willChange: "transform" }}
        />
        {hoverImage && (
          <img
            src={hoverImage}
            alt=""
            loading="lazy"
            className="card-hover-img absolute inset-0 h-full w-full object-cover opacity-0"
          />
        )}
        <div className="catalog-card-shine" />
        <div className="catalog-media-overlay">
          <span className="catalog-quick-view">
            <Eye size={14} /> Ver detalle
          </span>
        </div>
        {isOnSale && (
          <div className="shop-sale-badge">-{discountPercent}%</div>
        )}
      </Link>

      <div className="p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-slate-400 truncate max-w-[100px]">
            {product.category || "General"}
          </span>
        </div>

        <h3 className="line-clamp-2 text-sm font-bold text-slate-900 leading-snug mb-1">
          {product.name}
        </h3>

        {isOnSale ? (
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-slate-400 line-through">S/ {price.toFixed(2)}</span>
            <span className="card-price text-base font-black text-rose-500">
              S/ {salePrice.toFixed(2)}
            </span>
          </div>
        ) : (
          <p className="card-price shop-accent-text text-base font-black">
            S/ {price.toFixed(2)}
          </p>
        )}

        <button
          onClick={() => onAddToCart?.(product)}
          className="catalog-add-btn mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all"
        >
          <ShoppingCart size={15} />
          Agregar
        </button>
      </div>
    </motion.article>
  );
};

export default ProductCard;
