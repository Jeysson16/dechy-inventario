import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Search,
  ShoppingBag,
  UserCircle2,
  Menu,
  X,
  ChevronDown,
  LogOut,
  User,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import MegaMenu from "./MegaMenu";
import { useShopAuth } from "../context/ShopAuthContext";

const Navbar = ({
  cartCount = 0,
  products = [],
  categories = [],
  onCartOpen,
}) => {
  const navigate = useNavigate();
  const { user, isLoggedIn, signOutShop, setAuthModal } = useShopAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const megaRef = useRef(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (megaRef.current && !megaRef.current.contains(e.target))
        setMegaOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target))
        setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const suggestions = useMemo(() => {
    const v = search.trim().toLowerCase();
    if (!v) return [];
    return products
      .filter((p) => (p?.name || "").toLowerCase().includes(v))
      .slice(0, 5);
  }, [products, search]);

  const submitSearch = (val) => {
    const q = (val || search).trim();
    if (!q) return;
    navigate(`/tienda/catalogo?q=${encodeURIComponent(q)}`);
    setSearch("");
    setMobileOpen(false);
  };

  return (
    <header className="shop-navbar">
      <div className="shop-shell">
        {/* ── Main bar ── */}
        <div className="flex h-16 items-center">
          {/* Logo */}
          <Link
            to="/tienda"
            className="flex-shrink-0 mr-6"
            onClick={() => setMegaOpen(false)}
          >
            <img
              src="/img/Jiedahoriz.jpg"
              alt="Jieda"
              className="h-9 w-auto max-w-[148px] object-contain"
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            <NavLink
              to="/tienda"
              end
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  isActive
                    ? "text-emerald-700 bg-emerald-50"
                    : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              Inicio
            </NavLink>

            {/* Productos with mega menu */}
            <div ref={megaRef} className="relative">
              <button
                onClick={() => setMegaOpen((v) => !v)}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  megaOpen
                    ? "text-emerald-700 bg-emerald-50"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                Productos
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${megaOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>

            <NavLink
              to="/tienda/calculadora"
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  isActive
                    ? "text-emerald-700 bg-emerald-50"
                    : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              Calculadora
            </NavLink>
          </nav>

          {/* Search (desktop) — flex-1 fills remaining space */}
          <div className="relative hidden lg:block flex-1 max-w-xs mx-4">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              size={16}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitSearch()}
              placeholder="Buscar productos..."
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-300/50 focus:border-emerald-500 transition"
            />
            {Boolean(suggestions.length) && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50">
                {suggestions.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => submitSearch(item.name)}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-none"
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right actions (desktop) */}
          <div className="hidden lg:flex items-center gap-1 ml-auto">
            {/* Cart */}
            <button
              onClick={onCartOpen}
              className="relative size-9 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Carrito"
            >
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center px-1">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Auth */}
            {isLoggedIn ? (
              <div ref={userMenuRef} className="relative">
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt=""
                      className="size-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="size-7 rounded-full bg-[#CFAE70] flex items-center justify-center">
                      <User size={14} className="text-white" />
                    </div>
                  )}
                  <span className="text-sm font-semibold text-slate-700 max-w-[90px] truncate">
                    {user?.displayName?.split(" ")[0] || "Mi cuenta"}
                  </span>
                  <ChevronDown size={12} className="text-slate-400" />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl py-1 w-48 z-50"
                    >
                      <div className="px-3 py-2.5 border-b border-slate-100">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {user?.displayName}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {user?.email}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          signOutShop();
                          setUserMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <LogOut size={14} className="text-slate-400" />
                        Cerrar sesión
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                onClick={() => setAuthModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-slate-700 border border-slate-200 hover:border-[#CFAE70] hover:text-[#CFAE70] transition-colors"
              >
                <UserCircle2 size={16} />
                Iniciar sesión
              </button>
            )}
          </div>

          {/* Mobile: cart + hamburger */}
          <div className="flex items-center gap-2 ml-auto lg:hidden">
            <button
              onClick={onCartOpen}
              className="relative size-9 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100"
              aria-label="Carrito"
            >
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center px-1">
                  {cartCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="size-9 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* ── Mobile menu ── */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-slate-100 lg:hidden"
            >
              <div className="py-4 space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    size={16}
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitSearch()}
                    placeholder="Buscar productos..."
                    className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-300/50 focus:border-[#CFAE70]"
                  />
                </div>

                {/* Links */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { to: "/tienda", label: "Inicio" },
                    { to: "/tienda/catalogo", label: "Productos" },
                    { to: "/tienda/calculadora", label: "Calculadora" },
                  ].map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className="rounded-xl bg-slate-100 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>

                {/* Auth mobile */}
                {isLoggedIn ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2">
                      {user?.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt=""
                          className="size-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="size-8 rounded-full bg-[#CFAE70] flex items-center justify-center">
                          <User size={14} className="text-white" />
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {user?.displayName?.split(" ")[0]}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[160px]">
                          {user?.email}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        signOutShop();
                        setMobileOpen(false);
                      }}
                      className="text-xs font-semibold text-rose-500 hover:underline"
                    >
                      Salir
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setAuthModal(true);
                      setMobileOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:border-[#CFAE70] hover:text-[#CFAE70] transition-colors"
                  >
                    <UserCircle2 size={16} />
                    Iniciar sesión con Google
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Mega menu (below header border) ── */}
      <AnimatePresence>
        {megaOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <MegaMenu
              categories={categories}
              onClose={() => setMegaOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
