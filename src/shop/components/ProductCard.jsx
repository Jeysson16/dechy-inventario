import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import anime from "animejs";
import Button from "./Button";
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
    anime({
      targets: card.querySelector(".card-img"),
      scale: 1.07,
      duration: 460,
      easing: "easeOutQuart",
    });
    anime({
      targets: card.querySelector(".card-price"),
      translateX: [0, 4],
      duration: 340,
      easing: "easeOutQuad",
    });
    anime({
      targets: card,
      borderColor: "rgba(207,174,112,0.42)",
      duration: 300,
      easing: "easeOutQuad",
    });
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    anime({
      targets: card.querySelector(".card-img"),
      scale: 1,
      duration: 460,
      easing: "easeOutQuart",
    });
    anime({
      targets: card.querySelector(".card-price"),
      translateX: 0,
      duration: 340,
      easing: "easeOutQuad",
    });
    anime({
      targets: card,
      borderColor: "rgba(148,163,184,0.2)",
      duration: 300,
      easing: "easeOutQuad",
    });
  };

  return (
    <motion.article
      ref={cardRef}
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="shop-card group rounded-2xl p-3"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link
        to={`/tienda/producto/${product.id}`}
        className="block overflow-hidden rounded-xl relative"
      >
        <img
          src={toProductImage(product)}
          alt={product.name || "Producto"}
          loading="lazy"
          className="card-img aspect-[4/5] w-full object-cover"
          style={{ willChange: "transform" }}
        />
        {isOnSale && (
          <div className="absolute top-2 right-2 bg-rose-500 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg">
            -{discountPercent}%
          </div>
        )}
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <Badge tone={hasStock ? "success" : "warning"}>
          {hasStock ? `Stock: ${available}` : "Agotado"}
        </Badge>
        <span className="text-sm font-semibold text-slate-300">
          {product.category || "Sin categoria"}
        </span>
      </div>

      <h3 className="mt-2 line-clamp-1 text-base font-semibold text-slate-100">
        {product.name}
      </h3>
      {isOnSale ? (
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-sm text-slate-500 line-through">
            S/ {price.toFixed(2)}
          </span>
          <span className="card-price text-lg font-black text-rose-400">
            S/ {salePrice.toFixed(2)}
          </span>
        </div>
      ) : (
        <p className="card-price mt-1 text-lg font-black text-[#CFAE70]">
          S/ {price.toFixed(2)}
        </p>
      )}

      <Button
        className="mt-3 w-full gap-2"
        disabled={!hasStock}
        onClick={() => onAddToCart(product)}
      >
        <ShoppingCart size={16} />
        {hasStock ? "Agregar" : "Sin stock"}
      </Button>
    </motion.article>
  );
};

export default ProductCard;
