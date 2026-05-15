import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import anime from "animejs";
import Badge from "./Badge";
import { calculateAvailableUnits, toProductImage } from "../utils/stock";

const ProductCard = ({ product, onAddToCart }) => {
  const cardRef = useRef(null);
  const available = calculateAvailableUnits(product);
  const hasStock = available > 0;
  const price = Number(product?.unitPrice || product?.price || 0);
  const isOnSale = product?.isOnSale && product?.salePrice > 0;
  const salePrice = Number(product?.salePrice || 0);
  const discountPercent = product?.discountPercent || 0;

  const handleMouseEnter = () => {
    const card = cardRef.current;
    if (!card) return;
    anime({ targets: card.querySelector(".card-img"), scale: 1.06, duration: 440, easing: "easeOutQuart" });
    anime({ targets: card.querySelector(".card-price"), translateX: [0, 3], duration: 300, easing: "easeOutQuad" });
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    anime({ targets: card.querySelector(".card-img"), scale: 1, duration: 440, easing: "easeOutQuart" });
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
      <Link to={productPath} className="block overflow-hidden relative">
        <img
          src={toProductImage(product)}
          alt={product.name || "Producto"}
          loading="lazy"
          className="card-img aspect-[4/5] w-full object-cover"
          style={{ willChange: "transform" }}
        />
        {isOnSale && (
          <div className="shop-sale-badge">-{discountPercent}%</div>
        )}
      </Link>

      <div className="p-3">
        <div className="flex items-center justify-between mb-1.5">
          <Badge tone={hasStock ? "success" : "warning"}>
            {hasStock ? `Stock: ${available}` : "Agotado"}
          </Badge>
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
          <p className="card-price text-base font-black text-[#CFAE70]">
            S/ {price.toFixed(2)}
          </p>
        )}

        <button
          disabled={!hasStock}
          onClick={() => onAddToCart?.(product)}
          className={`mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${
            hasStock
              ? "bg-slate-900 text-white hover:bg-[#CFAE70] hover:text-slate-900"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}
        >
          <ShoppingCart size={15} />
          {hasStock ? "Agregar" : "Sin stock"}
        </button>
      </div>
    </motion.article>
  );
};

export default ProductCard;
