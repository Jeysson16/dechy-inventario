/**
 * FeaturedProductsSlider — horizontal scrollable slider of on-sale products.
 * Shows products with isOnSale = true. Falls back to first 8 products.
 */
import { useRef } from "react";
import { ChevronLeft, ChevronRight, Tag, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import ProductCard from "./ProductCard";

const FeaturedProductsSlider = ({ products = [], onAddToCart }) => {
  const sliderRef = useRef(null);
  const navigate = useNavigate();

  /* Prefer on-sale products; fall back to first 10 */
  const featured = products.filter((p) => p.isOnSale && p.salePrice > 0);
  const display = featured.length >= 4 ? featured : products.slice(0, 10);

  const scroll = (dir) => {
    if (!sliderRef.current) return;
    const amount = sliderRef.current.clientWidth * 0.75;
    sliderRef.current.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (display.length === 0) return null;

  return (
    <section className="py-2">
      {/* Header */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-rose-500 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
              <Tag size={11} /> Ofertas activas
            </span>
          </div>
          <h2 className="shop-section-title">Productos Destacados</h2>
          <p className="shop-section-sub">
            {featured.length > 0
              ? "Productos con descuentos y ofertas exclusivas"
              : "Los más pedidos por nuestros clientes"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Scroll arrows */}
          <button
            onClick={() => scroll("left")}
            className="size-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => scroll("right")}
            className="size-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
          <Link
            to="/tienda/catalogo"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 hover:text-[#CFAE70] transition-colors ml-2"
          >
            Ver todo <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {/* Slider */}
      <div ref={sliderRef} className="shop-products-slider flex gap-4 pb-2">
        {display.map((product) => (
          <div
            key={product.id}
            className="flex-shrink-0 w-[220px] sm:w-[240px]"
          >
            <ProductCard product={product} onAddToCart={onAddToCart} />
          </div>
        ))}
        {/* View all card */}
        <div className="flex-shrink-0 w-[180px] sm:w-[200px] flex items-center justify-center">
          <button
            onClick={() => navigate("/tienda/catalogo")}
            className="flex flex-col items-center justify-center gap-3 w-full h-full min-h-[260px] rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-[#CFAE70] hover:text-[#CFAE70] transition-colors group"
          >
            <ArrowRight
              size={28}
              className="group-hover:scale-110 transition-transform"
            />
            <span className="text-sm font-bold text-center px-4">
              Ver todos los productos
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedProductsSlider;
