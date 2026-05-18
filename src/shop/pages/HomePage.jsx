import { useNavigate } from "react-router-dom";
import HeroCarousel from "../components/HeroCarousel";
import FeaturedProductsSlider from "../components/FeaturedProductsSlider";
import SetsSlider from "../components/SetsSlider";
import HeroBanner from "../components/HeroBanner";
import SplitBanner from "../components/SplitBanner";
import ProductCard from "../components/ProductCard";

const HomePage = ({ products = [], categories = [], onAddToCart }) => {
  const navigate = useNavigate();

  const sets = products.filter((p) => p.tipo_producto === "set");
  const simpleProducts = products.filter((p) => p.tipo_producto !== "set");
  const popularProducts = simpleProducts.slice(0, 8);

  return (
    <div className="pb-10">
      {/* ── Hero carousel — full-width ── */}
      <div className="shop-full-bleed mb-10">
        <HeroCarousel />
      </div>

      <div className="shop-shell">
        {/* ── Categories strip ── */}
        {categories.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-black text-slate-900">
                Explorar categorías
              </h2>
              <button
                onClick={() => navigate("/tienda/catalogo")}
                className="text-sm font-bold text-[#CFAE70] hover:underline"
              >
                Ver todo →
              </button>
            </div>
            <div
              className="flex gap-2 overflow-x-auto pb-2"
              style={{ scrollbarWidth: "none" }}
            >
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() =>
                    navigate(`/tienda/catalogo?cat=${encodeURIComponent(cat)}`)
                  }
                  className="category-pill flex-shrink-0"
                >
                  {cat}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Featured products slider (on-sale) ── */}
        <section className="mb-12">
          <FeaturedProductsSlider
            products={simpleProducts}
            onAddToCart={onAddToCart}
          />
        </section>

        {/* ── Sets & Bundles slider ── */}
        {sets.length > 0 && (
          <section className="mb-12">
            <SetsSlider sets={sets} onAddToCart={onAddToCart} />
          </section>
        )}

        {/* ── Hero banner ── */}
        <section className="mb-12">
          <HeroBanner />
        </section>

        {/* ── Popular products grid ── */}
        {popularProducts.length > 0 && (
          <section className="mb-12">
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="shop-section-title">Productos populares</h2>
                <p className="shop-section-sub">
                  Los más pedidos por nuestros clientes
                </p>
              </div>
              <button
                onClick={() => navigate("/tienda/catalogo")}
                className="hidden sm:flex items-center gap-1 text-sm font-bold text-slate-600 hover:text-[#CFAE70] transition-colors"
              >
                Ver catálogo →
              </button>
            </div>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {popularProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={onAddToCart}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Split promo banner ── */}
        <section className="mb-12">
          <SplitBanner />
        </section>

        {/* ── Trust badges ── */}
        <section className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              emoji: "🚚",
              title: "Envío seguro",
              desc: "Entrega a todo el país",
            },
            {
              emoji: "✅",
              title: "Calidad garantizada",
              desc: "Productos certificados",
            },
            {
              emoji: "🛡️",
              title: "Compra protegida",
              desc: "Proceso transparente",
            },
            {
              emoji: "💬",
              title: "Atención al cliente",
              desc: "Lun – Sáb 8am – 6pm",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100"
            >
              <span className="text-2xl flex-shrink-0">{item.emoji}</span>
              <div>
                <p className="text-xs font-bold text-slate-800">{item.title}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};

export default HomePage;
