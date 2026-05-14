import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import ProductCard from "../components/ProductCard";
import SkeletonCard from "../components/SkeletonCard";
import Input from "../components/Input";
import Button from "../components/Button";

const PAGE_SIZE = 12;

const CatalogPage = ({
  products,
  categories,
  loading,
  normalize,
  onAddToCart,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("name-asc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const query = searchParams.get("q") || "";
  const cat = searchParams.get("cat") || "";

  const filtered = useMemo(() => {
    const q = normalize(query);
    const selectedCategory = normalize(cat);

    let result = products.filter((item) => {
      const byQuery =
        !q ||
        normalize(item.name).includes(q) ||
        normalize(item.description).includes(q) ||
        normalize(item.category).includes(q);

      const byCategory =
        !selectedCategory || normalize(item.category) === selectedCategory;

      const price = Number(item?.price || 0);
      const byMin = !minPrice || price >= Number(minPrice);
      const byMax = !maxPrice || price <= Number(maxPrice);

      return byQuery && byCategory && byMin && byMax;
    });

    result = [...result].sort((a, b) => {
      if (sort === "price-asc")
        return Number(a.price || 0) - Number(b.price || 0);
      if (sort === "price-desc")
        return Number(b.price || 0) - Number(a.price || 0);
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    return result;
  }, [products, query, cat, minPrice, maxPrice, sort, normalize]);

  const paged = filtered.slice(0, visibleCount);

  return (
    <div className="grid gap-6 py-8 lg:grid-cols-[280px_1fr]">
      <aside className="shop-card h-max rounded-2xl p-4">
        <h2 className="text-lg font-black text-slate-100">Filtros</h2>

        <div className="mt-4 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Busqueda
          </label>
          <Input
            placeholder="Buscar..."
            value={query}
            onChange={(e) => {
              setVisibleCount(PAGE_SIZE);
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                if (e.target.value) next.set("q", e.target.value);
                else next.delete("q");
                return next;
              });
            }}
          />
        </div>

        <div className="mt-4 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Categoria
          </label>
          <select
            value={cat}
            onChange={(e) => {
              setVisibleCount(PAGE_SIZE);
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                if (e.target.value) next.set("cat", e.target.value);
                else next.delete("cat");
                return next;
              });
            }}
            className="w-full rounded-xl border border-slate-600 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Input
            type="number"
            min="0"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
          <Input
            type="number"
            min="0"
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </div>

        <div className="mt-4 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Ordenar
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="w-full rounded-xl border border-slate-600 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
          >
            <option value="name-asc">Nombre A-Z</option>
            <option value="price-asc">Precio menor</option>
            <option value="price-desc">Precio mayor</option>
          </select>
        </div>
      </aside>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-black text-slate-100">Catalogo</h1>
          <span className="text-sm text-slate-400">
            {filtered.length} resultados
          </span>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </div>
        ) : (
          <>
            <motion.div
              layout
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            >
              {paged.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={onAddToCart}
                />
              ))}
            </motion.div>

            {visibleCount < filtered.length && (
              <div className="mt-8 text-center">
                <Button
                  variant="ghost"
                  onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                >
                  Ver mas productos
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default CatalogPage;
