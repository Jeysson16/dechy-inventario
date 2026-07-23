import { useNavigate } from "react-router-dom";
import HeroCarousel from "../components/HeroCarousel";
import FeaturedProductsSlider from "../components/FeaturedProductsSlider";
import SetsSlider from "../components/SetsSlider";
import HeroBanner from "../components/HeroBanner";
import SplitBanner from "../components/SplitBanner";
import ProductCard from "../components/ProductCard";
import { CheckCircle2, Headphones, ShieldCheck, Truck } from "lucide-react";

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
          <section className="shop-home-section mb-12">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="shop-accent-text text-xs font-black uppercase tracking-widest">
                  Explora por línea
                </p>
                <h2 className="text-xl font-black text-slate-900">
                  Categorías destacadas
                </h2>
              </div>
              <button
                onClick={() => navigate("/tienda/catalogo")}
                className="shop-accent-text text-sm font-bold hover:underline"
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
        <section className="shop-home-section-soft mb-12">
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
                className="shop-hover-accent hidden sm:flex items-center gap-1 text-sm font-bold text-slate-600 transition-colors"
              >
                Ver catálogo →
              </button>
            </div>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
              Icon: Truck,
              title: "Envío seguro",
              desc: "Entrega a todo el país",
            },
            {
              Icon: CheckCircle2,
              title: "Calidad garantizada",
              desc: "Productos certificados",
            },
            {
              Icon: ShieldCheck,
              title: "Compra protegida",
              desc: "Proceso transparente",
            },
            {
              Icon: Headphones,
              title: "Atención al cliente",
              desc: "Lun – Sáb 8am – 6pm",
            },
          ].map(({ Icon, ...item }) => (
            <div
              key={item.title}
              className="shop-trust-card"
            >
              <Icon size={22} className="shop-accent-text flex-shrink-0" />
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
