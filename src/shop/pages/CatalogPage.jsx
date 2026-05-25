import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Search,
  SlidersHorizontal,
  ArrowDownUp,
} from "lucide-react";
import ProductCard from "../components/ProductCard";
import SkeletonCard from "../components/SkeletonCard";

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: "popular", label: "Más vendidos" },
  { value: "price-asc", label: "Menor precio" },
  { value: "price-desc", label: "Mayor precio" },
  { value: "az", label: "Nombre A-Z" },
  { value: "za", label: "Nombre Z-A" },
];

const CatalogPage = ({
  products,
  categories,
  loading,
  normalize,
  onAddToCart,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sort, setSort] = useState("popular");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [catSearch, setCatSearch] = useState("");
  const [priceOpen, setPriceOpen] = useState(true);
  const [catOpen, setCatOpen] = useState(true);

  // Price range state
  const [sliderMin, setSliderMin] = useState(0);
  const [sliderMax, setSliderMax] = useState(0);
  const [appliedMin, setAppliedMin] = useState(0);
  const [appliedMax, setAppliedMax] = useState(0);
  const [priceInitialized, setPriceInitialized] = useState(false);

  const query = searchParams.get("q") || "";
  const selectedCats = searchParams.getAll("cat");

  // Compute global price range from products
  const [globalMin, globalMax] = useMemo(() => {
    if (!products.length) return [0, 10000];
    const prices = products
      .map((p) => Number(p?.unitPrice || p?.price || 0))
      .filter((v) => v > 0);
    if (!prices.length) return [0, 10000];
    return [Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices))];
  }, [products]);

  // Initialize sliders once products load
  useEffect(() => {
    if (products.length && !priceInitialized) {
      setSliderMin(globalMin);
      setSliderMax(globalMax);
      setAppliedMin(globalMin);
      setAppliedMax(globalMax);
      setPriceInitialized(true);
    }
  }, [products.length, globalMin, globalMax, priceInitialized]);

  // Filter categories by search input
  const filteredCats = useMemo(() => {
    if (!catSearch.trim()) return categories;
    const q = catSearch.trim().toLowerCase();
    return categories.filter((c) => c.toLowerCase().includes(q));
  }, [categories, catSearch]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    let result = products.filter((item) => {
      const byQuery =
        !q ||
        normalize(item.name).includes(q) ||
        normalize(item.description || "").includes(q) ||
        normalize(item.category).includes(q);

      const byCategory =
        !selectedCats.length || selectedCats.includes(item.category);

      const price = Number(item?.unitPrice || item?.price || 0);
      const byMin = !appliedMin || price >= appliedMin;
      const byMax = !appliedMax || price <= appliedMax;

      return byQuery && byCategory && byMin && byMax;
    });

    result = [...result].sort((a, b) => {
      const aP = Number(a.unitPrice || a.price || 0);
      const bP = Number(b.unitPrice || b.price || 0);
      if (sort === "price-asc") return aP - bP;
      if (sort === "price-desc") return bP - aP;
      if (sort === "az")
        return String(a.name || "").localeCompare(String(b.name || ""));
      if (sort === "za")
        return String(b.name || "").localeCompare(String(a.name || ""));
      return 0;
    });

    return result;
  }, [products, query, selectedCats, appliedMin, appliedMax, sort, normalize]);

  const paged = filtered.slice(0, visibleCount);

  const toggleCat = (cat) => {
    setVisibleCount(PAGE_SIZE);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("cat");
      const newCats = selectedCats.includes(cat)
        ? selectedCats.filter((c) => c !== cat)
        : [...selectedCats, cat];
      newCats.forEach((c) => next.append("cat", c));
      return next;
    });
  };

  const applyPrice = () => {
    setAppliedMin(sliderMin);
    setAppliedMax(sliderMax);
    setVisibleCount(PAGE_SIZE);
  };

  const pageTitle =
    selectedCats.length === 1
      ? selectedCats[0]
      : selectedCats.length > 1
        ? "Múltiples categorías"
        : query
          ? `Resultados: "${query}"`
          : "Catálogo de productos";

  const formatPrice = (v) =>
    `S/ ${Number(v).toLocaleString("es-PE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const pct = (v) =>
    `${((v - globalMin) / Math.max(globalMax - globalMin, 1)) * 100}%`;

  return (
    <div className="shop-page-enter">
      {/* Breadcrumb */}
      <nav className="shop-breadcrumb mb-3 mt-1">
        <Link to="/tienda">Inicio</Link>
        <span className="mx-1.5 text-slate-300">›</span>
        <span className="current">{pageTitle}</span>
      </nav>

      {/* H1 */}
      <h1 className="text-3xl font-black text-slate-900 mb-6 leading-tight">
        {pageTitle}
      </h1>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* ── Sidebar ── */}
        <aside className="lg:sticky lg:top-20 h-max border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
          {/* PRECIO */}
          <div className="catalog-filter-section">
            <button
              className="catalog-filter-header"
              onClick={() => setPriceOpen((v) => !v)}
            >
              <span className="text-xs font-black uppercase tracking-widest text-slate-800">
                PRECIO
              </span>
              {priceOpen ? (
                <ChevronUp size={15} className="text-slate-500" />
              ) : (
                <ChevronDown size={15} className="text-slate-500" />
              )}
            </button>

            {priceOpen && (
              <div className="catalog-filter-body">
                <div className="flex justify-between mb-3">
                  <span className="text-sm font-semibold text-slate-700">
                    {formatPrice(sliderMin)}
                  </span>
                  <span className="text-sm font-semibold text-slate-700">
                    {formatPrice(sliderMax || globalMax)}
                  </span>
                </div>

                {/* Dual range slider */}
                <div className="catalog-price-track">
                  <div
                    className="catalog-price-fill"
                    style={{
                      left: pct(sliderMin),
                      right: `${100 - parseFloat(pct(sliderMax || globalMax))}%`,
                    }}
                  />
                  <input
                    type="range"
                    min={globalMin}
                    max={globalMax}
                    value={sliderMin}
                    onChange={(e) =>
                      setSliderMin(
                        Math.min(Number(e.target.value), sliderMax - 1),
                      )
                    }
                    className="catalog-range-input"
                  />
                  <input
                    type="range"
                    min={globalMin}
                    max={globalMax}
                    value={sliderMax || globalMax}
                    onChange={(e) =>
                      setSliderMax(
                        Math.max(Number(e.target.value), sliderMin + 1),
                      )
                    }
                    className="catalog-range-input"
                  />
                </div>

                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-slate-500">
                    {filtered.length} producto{filtered.length !== 1 ? "s" : ""}
                  </span>
                  <button onClick={applyPrice} className="catalog-apply-btn">
                    APLICAR
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* TIPO DE PRODUCTO */}
          <div
            className="catalog-filter-section"
            style={{ borderBottom: "none" }}
          >
            <button
              className="catalog-filter-header"
              onClick={() => setCatOpen((v) => !v)}
            >
              <span className="text-xs font-black uppercase tracking-widest text-slate-800">
                TIPO DE PRODUCTO
              </span>
              {catOpen ? (
                <ChevronUp size={15} className="text-slate-500" />
              ) : (
                <ChevronDown size={15} className="text-slate-500" />
              )}
            </button>

            {catOpen && (
              <div className="catalog-filter-body">
                <div className="relative mb-3">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={catSearch}
                    onChange={(e) => setCatSearch(e.target.value)}
                    placeholder="Buscar (Cielo Raso, Panel..."
                    className="catalog-cat-search"
                  />
                </div>

                <ul className="catalog-cat-list">
                  {filteredCats.map((cat) => (
                    <li key={cat}>
                      <label className="catalog-cat-item">
                        <input
                          type="checkbox"
                          checked={selectedCats.includes(cat)}
                          onChange={() => toggleCat(cat)}
                          className="catalog-checkbox"
                        />
                        <span>{cat}</span>
                      </label>
                    </li>
                  ))}
                  {filteredCats.length === 0 && (
                    <li className="text-sm text-slate-400 py-2 px-1">
                      Sin resultados
                    </li>
                  )}
                </ul>

                {selectedCats.length > 0 && (
                  <button
                    onClick={() =>
                      setSearchParams((p) => {
                        const n = new URLSearchParams(p);
                        n.delete("cat");
                        return n;
                      })
                    }
                    className="text-xs text-[#CFAE70] font-semibold mt-2 hover:underline block"
                  >
                    Limpiar filtro ×
                  </button>
                )}

                {categories.length > 10 && !catSearch && (
                  <button className="text-xs text-[#CFAE70] font-semibold mt-1 hover:underline block">
                    Ver más +
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* ── Products area ── */}
        <section>
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <span className="text-sm text-slate-500">
              {filtered.length} producto{filtered.length !== 1 ? "s" : ""}
            </span>

            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600 font-medium whitespace-nowrap hidden sm:block">
                Ordenar por:
              </label>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                className="catalog-sort-select"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  const idx = SORT_OPTIONS.findIndex((o) => o.value === sort);
                  const next = SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length];
                  setSort(next.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                className="catalog-sort-arrow"
                title="Cambiar orden"
              >
                <ArrowDownUp size={14} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : paged.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <SlidersHorizontal size={40} className="text-slate-300 mb-4" />
              <p className="text-lg font-bold text-slate-700 mb-1">
                Sin productos
              </p>
              <p className="text-sm text-slate-400">
                Prueba ajustando los filtros
              </p>
            </div>
          ) : (
            <>
              <motion.div
                layout
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
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
                  <button
                    onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                    className="px-8 py-3 rounded-xl border-2 border-slate-800 text-slate-800 text-sm font-bold hover:bg-slate-800 hover:text-white transition-all"
                  >
                    Ver más productos ({filtered.length - visibleCount}{" "}
                    restantes)
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default CatalogPage;
