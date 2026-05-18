import React, { useEffect, useState, useMemo, useRef } from 'react';
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { BranchSelector } from './BranchSelector';
import { ProductCard } from './ProductCard';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ShoppingBag, Moon, Sun, X, Package as PackageIcon, ChevronDown, Plus, Minus, Share2 } from 'lucide-react';

export const Catalog: React.FC = () => {
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<any | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [activeModalImage, setActiveModalImage] = useState<number>(0);
  const [featuredIndex, setFeaturedIndex] = useState<number>(0);
  const isClickScrollingRef = useRef(false);
  const [showCatsInNav, setShowCatsInNav] = useState(false);
  const [cart, setCart] = useState<Record<string, { product: any; qty: number }>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [shareQr, setShareQr] = useState('');
  const [logoReady, setLogoReady] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  const addToCart = (p: any) => setCart(prev => {
    const existing = prev[p.id];
    return { ...prev, [p.id]: { product: p, qty: existing ? existing.qty + 1 : 1 } };
  });
  const removeFromCart = (id: string) => setCart(prev => {
    const c = { ...prev };
    if (c[id] && c[id].qty > 1) c[id] = { ...c[id], qty: c[id].qty - 1 };
    else delete c[id];
    return c;
  });
  const cartCount = Object.values(cart).reduce((s, v) => s + v.qty, 0);
  const cartTotal = Object.values(cart).reduce((s, v) => s + v.qty * v.product.price, 0);

  const generateShareLink = () => {
    const items = Object.values(cart).map(v => ({ n: v.product.name, q: v.qty, p: v.product.price }));
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(items))));
    const url = `${window.location.origin}${window.location.pathname}?cart=${encoded}`;
    setShareQr(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`);
  };

  // Preload branch logo to avoid flash of raw alt text
  useEffect(() => {
    if (!selectedBranch) {
      setLogoReady(true);
      return;
    }
    const logoUrl = selectedBranch?.configuracion?.logo || selectedBranch?.logo;
    if (!logoUrl) {
      setLogoReady(true);
      return;
    }
    setLogoReady(false);
    const img = new Image();
    img.src = logoUrl;
    img.onload = () => setLogoReady(true);
    img.onerror = () => setLogoReady(true); // fall back to loader exit if error
  }, [selectedBranch]);

  const isAppLoading = loading || !logoReady;

  // Scroll-driven hero state
  const [heroPhase, setHeroPhase] = useState(0); // 0=logo, 1=text, 2=ready

  useEffect(() => {
    const t1 = setTimeout(() => setHeroPhase(1), 800);
    const t2 = setTimeout(() => setHeroPhase(2), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Show categories in nav once hero is scrolled out
  useEffect(() => {
    if (!heroRef.current) return;
    const obs = new IntersectionObserver(([e]) => setShowCatsInNav(!e.isIntersecting), { threshold: 0.1 });
    obs.observe(heroRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => { setActiveModalImage(0); }, [selectedProduct]);

  // Theme
  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(saved || (prefersDark ? 'dark' : 'light'));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Dynamic Title and Favicon
  useEffect(() => {
    if (!selectedBranch) return;
    document.title = selectedBranch.name ? `${selectedBranch.name} — Catálogo` : 'Catálogo | Dechy';
    const href = selectedBranch?.configuracion?.logo || '/img/logojieda.png';
    const links = document.querySelectorAll("link[rel~='icon']");
    if (links.length === 0) {
      const link = document.createElement('link');
      link.rel = 'icon'; link.href = href;
      document.head.appendChild(link);
    } else {
      links.forEach(l => { (l as HTMLLinkElement).href = href; });
    }
  }, [selectedBranch]);

  // Fetch branches
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const snap = await getDocs(collection(db, "branches"));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setBranches(data);
        if (data.length > 0) setSelectedBranch(data[0]);
        else setLoading(false);
      } catch { setLoading(false); }
    })();
  }, []);

  // Fetch products
  useEffect(() => {
    if (!selectedBranch) return;
    setLoading(true);
    const q = query(collection(db, "products"), where("branch", "==", selectedBranch.id));
    const unsub = onSnapshot(q, (snap) => {
      const prods: any[] = [];
      snap.forEach(doc => {
        const d = doc.data();
        prods.push({ id: doc.id, ...d, currentStock: Number(d.currentStock) || 0, minStock: Number(d.minStock) || 0, price: Number(d.unitPrice) || Number(d.price) || 0 });
      });
      setProducts(prods);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [selectedBranch]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => { if (p.category) cats.add(p.category); });
    return Array.from(cats).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(p => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q));
  }, [products, searchQuery]);

  const productsByCategory = useMemo(() => {
    if (searchQuery) return null;
    const g: Record<string, any[]> = {};
    categories.forEach(c => g[c] = []);
    products.forEach(p => { if (p.category && g[p.category]) g[p.category].push(p); });
    return g;
  }, [products, categories, searchQuery]);

  // ScrollSpy
  useEffect(() => {
    if (searchQuery) return;
    const obs = new IntersectionObserver((entries) => {
      if (isClickScrollingRef.current) return;
      entries.forEach(e => {
        if (e.isIntersecting) {
          const cat = e.target.getAttribute('data-category-section');
          if (cat) {
            setSelectedCategory(cat);
            document.getElementById(`tab-${cat.replace(/\s+/g, '-')}`)?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
          }
        }
      });
    }, { rootMargin: '-120px 0px -70% 0px' });
    setTimeout(() => {
      document.querySelectorAll('[data-category-section]').forEach(s => obs.observe(s));
    }, 500);
    return () => obs.disconnect();
  }, [categories, products, searchQuery]);

  // Top products carousel
  const topProducts = useMemo(() => {
    const withImg = products.filter(p => p.images && p.images.length > 0);
    return withImg.length >= 3 ? withImg.slice(0, 8) : products.slice(0, 8);
  }, [products]);

  useEffect(() => {
    if (topProducts.length <= 1) return;
    const iv = setInterval(() => setFeaturedIndex(prev => (prev + 1) % topProducts.length), 5000);
    return () => clearInterval(iv);
  }, [topProducts.length]);

  const featuredProduct = topProducts[featuredIndex] || topProducts[0] || products[0];
  const featuredImages = useMemo(() => {
    if (!featuredProduct) return [];
    const raw = featuredProduct.images?.length ? featuredProduct.images : (featuredProduct.imageUrl ? [featuredProduct.imageUrl] : []);
    return raw.map((i: any) => typeof i === 'string' ? i : i.url).filter(Boolean);
  }, [featuredProduct]);

  const primaryColor = selectedBranch?.configuracion?.colores?.primario || '#1e293b';
  const secondaryColor = selectedBranch?.configuracion?.colores?.secundario || '#334155';
  const branchLogo = selectedBranch?.configuracion?.logo;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-white font-sans">

      {/* ── Navbar with categories ── */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-xl border-b border-slate-200/50 dark:border-white/5 px-4 transition-all duration-300">
        <div className="h-11 flex items-center justify-between">
          <BranchSelector branches={branches} selectedBranch={selectedBranch} onSelectBranch={setSelectedBranch} />
          <div className="flex items-center gap-2">
            <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-white">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {cartCount > 0 && (
              <button onClick={() => setCartOpen(true)} className="relative p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors text-slate-500">
                <ShoppingBag className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[8px] font-bold bg-rose-500 text-white rounded-full flex items-center justify-center">{cartCount}</span>
              </button>
            )}
          </div>
        </div>
        {/* Category tabs slide in when hero is out of view */}
        <div className={`overflow-hidden transition-all duration-300 ${showCatsInNav ? 'max-h-10 opacity-100 pb-1.5' : 'max-h-0 opacity-0'}`}>
          <div className="flex items-center gap-2">
            <div className="flex-1 overflow-x-auto hide-scrollbar">
              <div className="flex items-center gap-1.5 min-w-max">
                {categories.map(cat => (
                  <button key={cat} id={`tab-${cat.replace(/\s+/g, '-')}`}
                    onClick={() => {
                      isClickScrollingRef.current = true;
                      setSelectedCategory(cat);
                      const sec = document.getElementById(`section-${cat.replace(/\s+/g, '-')}`);
                      if (sec) window.scrollTo({ top: sec.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
                      setTimeout(() => { isClickScrollingRef.current = false; }, 1200);
                    }}
                    className={`relative px-3 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all ${selectedCategory === cat ? 'text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    {selectedCategory === cat && <motion.div layoutId="nav-tab" className="absolute inset-0 rounded-md z-0" style={{ backgroundColor: primaryColor }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
                    <span className="relative z-10">{cat}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="relative shrink-0 w-40">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar..." className="w-full pl-7 pr-2 py-1 bg-slate-100 dark:bg-slate-800/80 border-none rounded-md text-[11px] font-medium outline-none focus:ring-1 focus:ring-blue-500/30 placeholder:text-slate-400" />
            </div>
          </div>
        </div>
      </nav>

      {/* ── Loading ── */}
      <AnimatePresence>
        {isAppLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-md">
            {branchLogo ? (
              <motion.img animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 1.5 }} src={branchLogo} alt="Logo" className="w-16 h-16 object-contain mb-4" />
            ) : (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-10 h-10 border-[3px] border-slate-200 rounded-full mb-4" style={{ borderTopColor: primaryColor }} />
            )}
            <p className="text-sm font-semibold text-slate-500">Cargando inventario...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════
           SECTION 1 — Full-screen Hero (100vh)
           Scroll-driven: logo → text → CTA
         ══════════════════════════════════════ */}
      <section ref={heroRef} className="relative h-screen flex flex-col items-center justify-center px-4">
        {/* Ambient bg */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[160px] opacity-15" style={{ backgroundColor: primaryColor }} />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-[120px] opacity-10" style={{ backgroundColor: secondaryColor }} />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto">
          {/* Logo — always visible, animates in */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6"
          >
            {branchLogo ? (
              <img src={branchLogo} alt={selectedBranch?.name} className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-2xl shadow-lg bg-white dark:bg-slate-900 p-2 border border-slate-100 dark:border-slate-800" />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
                <ShoppingBag className="w-10 h-10" />
              </div>
            )}
          </motion.div>

          {/* Text — fades in after logo */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={heroPhase >= 1 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.1]">
              {selectedBranch?.name || 'Dechy Store'}
            </h1>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
              {selectedBranch?.configuracion?.descripcion || 'Catálogo digital con inventario en tiempo real. Explora nuestros productos, precios y disponibilidad actualizada.'}
            </p>
          </motion.div>

          {/* CTA — fades in last */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={heroPhase >= 2 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="mt-8 flex flex-col sm:flex-row items-center gap-3"
          >
            <button
              onClick={() => document.getElementById('catalog-main')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all hover:opacity-90 active:scale-95 shadow-lg"
              style={{ backgroundColor: primaryColor, boxShadow: `0 8px 24px -4px ${primaryColor}40` }}
            >
              Ver Catálogo
            </button>
            {selectedBranch?.location && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {selectedBranch.location}
              </span>
            )}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={heroPhase >= 2 ? { opacity: 1 } : {}}
          transition={{ delay: 0.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-slate-400"
        >
          <span className="text-[10px] font-semibold uppercase tracking-widest">Explorar</span>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════
           SECTION 2 — Auto-sliding Carousel
         ══════════════════════════════════════ */}
      {topProducts.length > 0 && (
        <section className="py-8 px-4 bg-white dark:bg-[#0c0c0e] border-y border-slate-100 dark:border-slate-800/30">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Productos Destacados</h2>
            <div className="relative overflow-hidden rounded-xl">
              <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${featuredIndex * (100 / Math.min(topProducts.length, 4))}%)` }}>
                {topProducts.map((p) => {
                  const img = p.images?.length ? (typeof p.images[0] === 'string' ? p.images[0] : p.images[0].url) : p.imageUrl;
                  return (
                    <button key={p.id} onClick={() => setSelectedProduct(p)} className="shrink-0 w-1/2 sm:w-1/3 md:w-1/4 px-1.5 group">
                      <div className="rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 hover:shadow-md transition-shadow">
                        <div className="aspect-square overflow-hidden">
                          {img ? <img src={img} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><PackageIcon className="w-8 h-8" /></div>}
                        </div>
                        <div className="p-2.5">
                          <p className="text-[11px] font-semibold text-slate-800 dark:text-white line-clamp-1">{p.name}</p>
                          <p className="text-xs font-bold mt-0.5" style={{ color: primaryColor }}>S/ {p.price?.toFixed(2)}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {/* Dots */}
              <div className="flex justify-center gap-1.5 mt-3">
                {topProducts.map((_, i) => (
                  <button key={i} onClick={() => setFeaturedIndex(i)} className={`w-1.5 h-1.5 rounded-full transition-all ${i === featuredIndex ? 'w-4' : 'opacity-40'}`} style={{ backgroundColor: primaryColor }} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════
           SECTION 4 — Product Grid (AliExpress)
         ══════════════════════════════════════ */}
      <main id="catalog-main" className="max-w-6xl mx-auto px-4 py-8 scroll-mt-[90px]">
        {searchQuery ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Resultados para "{searchQuery}"</h2>
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{filteredProducts.length}</span>
            </div>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <Search className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-semibold text-slate-500">Sin resultados</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredProducts.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} onClick={() => setSelectedProduct(p)} onAddToCart={addToCart} cartQty={cart[p.id]?.qty || 0} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-12">
            {productsByCategory && categories.map(cat => {
              const catProds = productsByCategory[cat];
              if (!catProds || catProds.length === 0) return null;
              return (
                <section key={cat} id={`section-${cat.replace(/\s+/g, '-')}`} data-category-section={cat} className="scroll-mt-[110px]">
                  <div className="mb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/40 pb-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white capitalize">{cat}</h2>
                    <span className="text-[10px] font-semibold text-slate-400">{catProds.length} items</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {catProds.map((p, i) => (
                      <ProductCard key={p.id} product={p} index={i} onClick={() => setSelectedProduct(p)} onAddToCart={addToCart} cartQty={cart[p.id]?.qty || 0} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Product Modal ── */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row relative"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setSelectedProduct(null)} className="absolute top-3 right-3 z-50 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>

              <div className="w-full md:w-1/2 bg-slate-50 dark:bg-slate-950 aspect-square md:aspect-auto flex flex-col items-center justify-center p-6">
                <div className="flex-1 flex items-center justify-center w-full">
                  {selectedProduct.imageUrl || selectedProduct.images?.length ? (
                    <img
                      key={`modal-img-${activeModalImage}`}
                      src={selectedProduct.images?.[activeModalImage] || selectedProduct.imageUrl}
                      alt={selectedProduct.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <PackageIcon className="w-16 h-16 text-slate-300" />
                  )}
                </div>
                {selectedProduct.images && selectedProduct.images.length > 1 && (
                  <div className="flex gap-2 mt-4 overflow-x-auto hide-scrollbar w-full justify-center">
                    {selectedProduct.images.map((img: string, idx: number) => (
                      <button key={idx} onClick={() => setActiveModalImage(idx)}
                        className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${activeModalImage === idx ? 'border-blue-500 scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col justify-center">
                <span className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: primaryColor }}>{selectedProduct.category || 'Categoría'}</span>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight mb-1">{selectedProduct.name}</h2>
                <p className="text-slate-400 uppercase tracking-widest text-[10px] mb-6 font-bold">{selectedProduct.brand || 'Marca Genérica'}</p>
                <div className="flex items-end gap-1.5 mb-6">
                  <span className="text-sm text-slate-400 font-semibold">S/</span>
                  <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{selectedProduct.price?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 flex justify-between items-center border border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Stock</p>
                    <p className={`text-lg font-black ${selectedProduct.currentStock > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {selectedProduct.currentStock} Und
                    </p>
                  </div>
                  <ShoppingBag className={`w-6 h-6 ${selectedProduct.currentStock > 0 ? 'text-emerald-500' : 'text-rose-400'}`} />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cart Drawer ── */}
      <AnimatePresence>
        {cartOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm" onClick={() => setCartOpen(false)}>
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute right-0 top-0 h-full w-full max-w-sm bg-white dark:bg-slate-900 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Mi Selección ({cartCount})</h3>
                <button onClick={() => setCartOpen(false)} className="p-1 text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {Object.entries(cart).map(([id, { product: p, qty }]) => (
                  <div key={id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5">
                    <div className="w-12 h-12 rounded-md overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0">
                      {(p.imageUrl || p.images?.[0]) ? <img src={p.images?.[0] || p.imageUrl} alt="" className="w-full h-full object-cover" /> : <PackageIcon className="w-6 h-6 m-auto text-slate-400 mt-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-slate-800 dark:text-white truncate">{p.name}</p>
                      <p className="text-xs font-bold" style={{ color: primaryColor }}>S/ {(p.price * qty).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => removeFromCart(id)} className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-rose-100 hover:text-rose-500 transition-colors"><Minus className="w-3 h-3" /></button>
                      <span className="text-xs font-bold w-5 text-center">{qty}</span>
                      <button onClick={() => addToCart(p)} className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-100 hover:text-emerald-500 transition-colors"><Plus className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
                {cartCount === 0 && <p className="text-center text-sm text-slate-400 py-8">Sin productos seleccionados</p>}
              </div>
              {cartCount > 0 && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Total estimado</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white">S/ {cartTotal.toFixed(2)}</span>
                  </div>
                  <button onClick={() => { generateShareLink(); }} className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]" style={{ backgroundColor: primaryColor }}>
                    <Share2 className="w-4 h-4" /> Compartir selección
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Share QR Modal ── */}
      <AnimatePresence>
        {shareQr && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShareQr('')}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-xs w-full shadow-2xl text-center" onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Compartir Selección</h3>
              <p className="text-[11px] text-slate-400 mb-4">Escanea el QR o copia el enlace para compartir</p>
              <div className="bg-white rounded-xl p-3 inline-block mb-4">
                <img src={shareQr} alt="QR Code" className="w-48 h-48" />
              </div>
              <div className="space-y-2">
                <button onClick={() => { const url = new URL(shareQr).searchParams.get('data') || ''; navigator.clipboard.writeText(url); }} className="w-full py-2 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  Copiar enlace
                </button>
                <button onClick={() => setShareQr('')} className="w-full py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">Cerrar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating Cart Button ── */}
      {cartCount > 0 && (
        <button onClick={() => setCartOpen(true)} className="fixed bottom-6 right-6 z-[90] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95" style={{ backgroundColor: primaryColor, boxShadow: `0 8px 24px -4px ${primaryColor}60` }}>
          <ShoppingBag className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-5 h-5 text-[10px] font-bold bg-rose-500 text-white rounded-full flex items-center justify-center">{cartCount}</span>
        </button>
      )}

      {/* ── Footer ── */}
      <footer className="border-t border-slate-100 dark:border-slate-800/30 bg-white dark:bg-[#09090b] py-8 text-center">
        <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest">
          © {new Date().getFullYear()} DechyStore
        </p>
      </footer>
    </div>
  );
};
