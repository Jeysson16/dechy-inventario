import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Search, ShoppingBag, UserCircle2, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import anime from "animejs";
import Input from "./Input";

const links = [
  { to: "/tienda", label: "Home" },
  { to: "/tienda/catalogo", label: "Catálogo" },
  { to: "/tienda/calculadora", label: "Calculadora" },
  { to: "/tienda/tracking", label: "Tracking" },
  { to: "/tienda/carrito", label: "Carrito" },
];

/* Underline draw/erase handlers for NavLinks */
const onNavEnter = (e) => {
  anime({
    targets: e.currentTarget.querySelector(".nav-underline"),
    width: ["0%", "100%"],
    duration: 280,
    easing: "easeOutQuad",
  });
};
const onNavLeave = (e) => {
  anime({
    targets: e.currentTarget.querySelector(".nav-underline"),
    width: "0%",
    duration: 200,
    easing: "easeInQuad",
  });
};

const Navbar = ({ cartCount = 0, products = [] }) => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");

  /* ── Logo entrance animation ── */
  useEffect(() => {
    anime({
      targets: ".nav-logo-word",
      opacity: [0, 1],
      translateY: [-7, 0],
      duration: 520,
      delay: anime.stagger(130),
      easing: "easeOutBack",
    });
  }, []);

  const suggestions = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return [];
    return products
      .filter((item) => (item?.name || "").toLowerCase().includes(value))
      .slice(0, 5);
  }, [products, search]);

  const submitSearch = (value) => {
    const query = (value || search).trim();
    if (!query) return;
    navigate(`/tienda/catalogo?q=${encodeURIComponent(query)}`);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-700/50 bg-[#0F172A]/90 backdrop-blur">
      <div className="shop-shell flex h-20 items-center gap-3">
        {/* Logo with entrance animation */}
        <Link
          to="/tienda"
          className="text-xl font-black tracking-tight text-slate-50"
        >
          <span
            className="nav-logo-word mr-1 inline-block"
            style={{ opacity: 0 }}
          >
            Dechy
          </span>
          <span
            className="nav-logo-word inline-block text-[#CFAE70]"
            style={{ opacity: 0 }}
          >
            Store
          </span>
        </Link>

        {/* Desktop nav with underline-draw hover */}
        <nav className="hidden items-center gap-2 lg:flex">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onMouseEnter={onNavEnter}
              onMouseLeave={onNavLeave}
              className={({ isActive }) =>
                `relative rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-slate-800 text-[#CFAE70]"
                    : "text-slate-300 hover:bg-slate-800/80"
                }`
              }
            >
              {item.label}
              <span
                className="nav-underline absolute bottom-1 left-3 h-px rounded-full bg-[#CFAE70]"
                style={{ width: "0%" }}
              />
            </NavLink>
          ))}
        </nav>

        <div className="relative ml-auto hidden w-full max-w-md lg:block">
          <Search
            className="pointer-events-none absolute left-3 top-2.5 text-slate-400"
            size={18}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitSearch()}
            placeholder="Buscar productos, marcas o categorías"
            className="pl-10"
          />
          {Boolean(suggestions.length) && (
            <div className="absolute mt-2 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => submitSearch(item.name || "")}
                  className="w-full border-b border-slate-700/70 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <Link
            to="/tienda/carrito"
            className="relative rounded-lg p-2 text-slate-200 hover:bg-slate-800"
          >
            <ShoppingBag size={20} />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 rounded-full bg-[#CFAE70] px-1.5 text-[10px] font-bold text-slate-900">
                {cartCount}
              </span>
            )}
          </Link>
          <Link
            to="/login"
            className="rounded-lg p-2 text-slate-200 hover:bg-slate-800"
          >
            <UserCircle2 size={21} />
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-slate-100 hover:bg-slate-800 lg:hidden"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-700/60 bg-[#0b1220] lg:hidden"
          >
            <div className="shop-shell space-y-3 py-4">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-2.5 text-slate-400"
                  size={18}
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitSearch()}
                  placeholder="Buscar..."
                  className="pl-10"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {links.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg bg-slate-800 px-3 py-2 text-center text-sm font-semibold text-slate-100"
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
