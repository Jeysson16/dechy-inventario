import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, Truck } from "lucide-react";
import ProductCard from "../components/ProductCard";
import ShopHero from "../components/ShopHero";
import AnimatedSection from "../components/AnimatedSection";

const FEATURE_CARDS = [
  {
    icon: <Truck size={18} />,
    title: "Envío seguro",
    text: "Seguimiento de ruta desde origen hasta tu ciudad.",
  },
  {
    icon: <ShieldCheck size={18} />,
    title: "Compra protegida",
    text: "Proceso de pago claro y validación de stock en tiempo real.",
  },
];

const HomePage = ({ products, categories, onAddToCart }) => {
  const navigate = useNavigate();
  const featured = products.slice(0, 8);

  return (
    <div className="space-y-14 pb-10 pt-8">
      {/* ── Hero + feature cards ── */}
      <section className="grid gap-8 lg:grid-cols-[1.2fr_.8fr]">
        <ShopHero />

        <AnimatedSection className="grid gap-4 content-start" staggerMs={130}>
          {FEATURE_CARDS.map((item) => (
            <article
              key={item.title}
              data-animate
              className="shop-card rounded-2xl p-5"
            >
              <div className="mb-3 inline-flex rounded-lg bg-slate-800 p-2 text-[#CFAE70]">
                {item.icon}
              </div>
              <h3 className="text-lg font-bold text-slate-100">{item.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{item.text}</p>
            </article>
          ))}
        </AnimatedSection>
      </section>

      {/* ── Categories ── */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-100">Categorías</h2>
          <Link
            to="/tienda/catalogo"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#CFAE70]"
          >
            Ver todo <ArrowRight size={16} />
          </Link>
        </div>
        <AnimatedSection
          className="mt-4 flex gap-3 overflow-x-auto pb-2"
          staggerMs={50}
        >
          {categories.map((category) => (
            <button
              type="button"
              key={category}
              data-animate
              onClick={() =>
                navigate(`/tienda/catalogo?cat=${encodeURIComponent(category)}`)
              }
              className="category-pill shrink-0 rounded-full border border-slate-600 bg-slate-900/50 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-[#CFAE70] hover:text-[#CFAE70]"
            >
              {category}
            </button>
          ))}
        </AnimatedSection>
      </section>

      {/* ── Featured products ── */}
      <section>
        <AnimatedSection className="mb-5" staggerMs={0}>
          <div data-animate className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-100">
                Productos destacados
              </h2>
              <p className="text-sm text-slate-400">
                Los más pedidos por nuestros clientes.
              </p>
            </div>
          </div>
        </AnimatedSection>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
