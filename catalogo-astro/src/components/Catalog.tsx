import React, { useEffect, useState, useMemo, useRef } from 'react';
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { BranchSelector } from './BranchSelector';
import { CategoryFilter } from './CategoryFilter';
import { ProductCard } from './ProductCard';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { Search, ShoppingBag, ShieldCheck, ChevronRight, Moon, Sun, Sparkles, X, Package as PackageIcon } from 'lucide-react';
import Lenis from 'lenis';

const HeroShowcaseImage: React.FC<{ images: string[], productName: string, delay: number }> = ({ images, productName, delay }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        setIndex(prev => (prev + 1) % images.length);
      }, 3000);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [images.length, delay]);

  return (
    <AnimatePresence mode="wait">
      <motion.img
        key={index}
        src={images[index]}
        alt={productName}
        initial={{ opacity: 0, scale: 1.1 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
        className="absolute inset-0 w-full h-full object-cover"
      />
    </AnimatePresence>
  );
};

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

  // Reset modal image when product changes
  useEffect(() => {
    setActiveModalImage(0);
  }, [selectedProduct]);
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  // Theme Handling
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // Fetch branches directly
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        setLoading(true);
        const querySnapshot = await getDocs(collection(db, "branches"));
        const branchesData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setBranches(branchesData);
        if (branchesData.length > 0) {
          setSelectedBranch(branchesData[0]);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching branches:", err);
        setLoading(false);
      }
    };
    fetchBranches();
  }, []);

  // Fetch products by branch
  useEffect(() => {
    if (!selectedBranch) return;
    setLoading(true);

    const q = query(
      collection(db, "products"),
      where("branch", "==", selectedBranch.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods: any[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        prods.push({
          id: doc.id,
          ...data,
          currentStock: Number(data.currentStock) || 0,
          minStock: Number(data.minStock) || 0,
          price: Number(data.unitPrice) || Number(data.price) || 0,
        });
      });
      setProducts(prods);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching products:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedBranch]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    return products.filter(p => {
      return p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
             p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
             p.brand?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [products, searchQuery]);

  const productsByCategory = useMemo(() => {
    if (searchQuery) return null; // Flat list if searching
    const grouped: Record<string, any[]> = {};
    categories.forEach(c => grouped[c] = []);
    products.forEach(p => {
      if (p.category && grouped[p.category]) {
        grouped[p.category].push(p);
      }
    });
    return grouped;
  }, [products, categories, searchQuery]);

  // ScrollSpy for Category Tabs
  useEffect(() => {
    if (searchQuery) return;
    const observer = new IntersectionObserver((entries) => {
      if (isClickScrollingRef.current) return;
      // Find the most intersecting element or simply the first one that is intersecting
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const cat = entry.target.getAttribute('data-category-section');
          if (cat) {
            setSelectedCategory(cat);
            const el = document.getElementById(`tab-${cat.replace(/\s+/g, '-')}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
          }
        }
      });
    }, { rootMargin: '-150px 0px -70% 0px' });

    setTimeout(() => {
      const sections = document.querySelectorAll('[data-category-section]');
      sections.forEach(s => observer.observe(s));
    }, 500);

    return () => observer.disconnect();
  }, [categories, products, searchQuery]);

  // Find Top Products (Those with multiple images or just the first few)
  const topProducts = useMemo(() => {
    const withImages = products.filter(p => p.images && p.images.length > 1);
    return withImages.length >= 4 ? withImages.slice(0, 6) : products.slice(0, 6);
  }, [products]);

  // Interactive 3D Showcase Timer
  useEffect(() => {
    if (topProducts.length <= 1) return;
    const interval = setInterval(() => {
      setFeaturedIndex(prev => (prev + 1) % topProducts.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [topProducts.length]);

  const featuredProduct = topProducts[featuredIndex] || topProducts[0] || products[0];
  const featuredImages = useMemo(() => {
    if (!featuredProduct) return [];
    const raw = featuredProduct.images?.length ? featuredProduct.images : (featuredProduct.imageUrl ? [featuredProduct.imageUrl] : []);
    return raw.map((i: any) => typeof i === 'string' ? i : i.url).filter(Boolean);
  }, [featuredProduct]);

  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  // --- CATALOG SCREEN (Ecommerce & Landing Page style) ---
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans selection:bg-blue-500/30 overflow-x-clip">
      
      <nav className="fixed top-0 left-0 w-full z-50 bg-white/95 dark:bg-slate-950/95 text-slate-900 dark:text-white backdrop-blur-xl border-b border-slate-200 dark:border-white/10 px-6 py-4 flex items-center justify-between shadow-sm dark:shadow-lg transition-colors duration-300">
        <div className="flex items-center gap-6">
          <BranchSelector branches={branches} selectedBranch={selectedBranch} onSelectBranch={setSelectedBranch} />
        </div>
        
        <div className="flex items-center gap-6">
          <button 
            onClick={toggleTheme}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            title="Alternar Tema"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <div className="hidden sm:block">
            <button 
              onClick={() => document.getElementById('catalog-main')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 transition-colors rounded-full text-sm font-bold cursor-pointer"
            >
              Catálogo
            </button>
          </div>
        </div>
      </nav>

      {/* Loading Overlay (Marketing Vibe) */}
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/90 dark:bg-slate-950/90 backdrop-blur-md"
          >
            {selectedBranch?.configuracion?.logo ? (
              <motion.img 
                animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                src={selectedBranch.configuracion.logo} 
                alt="Loading Logo" 
                className="w-24 h-24 object-contain mb-6 drop-shadow-xl"
              />
            ) : (
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-16 h-16 border-4 border-slate-200 border-t-blue-500 rounded-full mb-6"
                style={{ borderTopColor: selectedBranch?.configuracion?.colores?.primario || '#3b82f6' }}
              />
            )}
            <motion.h2 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-black text-slate-800 dark:text-white tracking-tight"
            >
              Preparando Inventario
            </motion.h2>
            <motion.p
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-slate-500 dark:text-slate-400 mt-2 font-medium"
            >
              Conectando con {selectedBranch?.name || 'la sucursal'}...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D Interactive Hero Showcase (Ultra Premium E-commerce Vibe) */}
      <div className="pt-32 pb-20 px-6 relative overflow-hidden bg-slate-50 dark:bg-[#0A0A0B] text-slate-900 dark:text-white transition-colors duration-500 min-h-[90vh] flex flex-col justify-center">
        {/* Dynamic ambient background light based on featured product */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-to-b from-blue-600/10 dark:from-blue-600/20 to-transparent blur-[140px] rounded-full pointer-events-none transition-all duration-1000"></div>
        <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-gradient-to-tl from-purple-900/10 dark:from-purple-900/20 to-transparent blur-[140px] rounded-full pointer-events-none transition-all duration-1000"></div>
        
        <div className="max-w-7xl mx-auto w-full relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Side: Dynamic Context & Details */}
          <div className="lg:col-span-7 text-left space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold backdrop-blur-md shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
              Producto Destacado de {selectedBranch?.name || 'la Sucursal'}
            </motion.div>

            {featuredProduct ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={featuredProduct.id}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs uppercase font-black tracking-widest px-3 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        {featuredProduct.category || 'Catálogo'}
                      </span>
                      <span className="text-xs uppercase font-bold tracking-widest text-slate-400">
                        {featuredProduct.brand || 'Marca Genérica'}
                      </span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] text-slate-900 dark:text-white line-clamp-2">
                      {featuredProduct.name}
                    </h1>
                  </div>

                  <p className="text-lg text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed font-light line-clamp-3">
                    {featuredProduct.description || selectedBranch?.configuracion?.descripcion || 'Un producto de alto rendimiento con stock garantizado en nuestra sede. Optimiza tu flujo de trabajo y asegura tu inventario al mejor precio del mercado.'}
                  </p>

                  <div className="flex flex-wrap items-baseline gap-4 pt-2">
                    <span className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                      ${featuredProduct.price.toFixed(2)}
                    </span>
                    <span className="text-sm font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                      Stock: {featuredProduct.currentStock} disponibles
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                    <button 
                      onClick={() => {
                        setSelectedProduct(featuredProduct);
                        setIsModalOpen(true);
                      }}
                      className="w-full sm:w-auto px-8 py-4 text-white rounded-2xl font-bold transition-all shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-2 group"
                      style={{ 
                        backgroundColor: selectedBranch?.configuracion?.colores?.primario || '#3b82f6',
                        boxShadow: `0 10px 25px -5px ${selectedBranch?.configuracion?.colores?.primario || '#3b82f6'}50`
                      }}
                    >
                      <ShoppingBag className="w-5 h-5 group-hover:animate-bounce" />
                      Inspeccionar Producto
                    </button>
                    
                    <button 
                      onClick={() => document.getElementById('catalog-main')?.scrollIntoView({ behavior: 'smooth' })}
                      className="w-full sm:w-auto px-8 py-4 bg-slate-200/50 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl font-bold transition-all backdrop-blur-md"
                    >
                      Ver todo el catálogo
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="py-12">
                <h1 className="text-5xl font-black">Bienvenido a {selectedBranch?.name || 'Dechy Store'}</h1>
                <p className="mt-4 text-slate-500">Cargando catálogo destacado...</p>
              </div>
            )}

            {/* Redes Sociales Dinámicas */}
            {selectedBranch?.configuracion?.redes_sociales && Object.keys(selectedBranch.configuracion.redes_sociales).length > 0 && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                className="pt-6 flex items-center gap-4 border-t border-slate-200 dark:border-slate-800/60 mt-8"
              >
                <span className="text-sm font-bold text-slate-500">Síguenos en:</span>
                <div className="flex gap-2">
                  {Object.entries(selectedBranch.configuracion.redes_sociales).map(([network, url]) => (
                    <a 
                      key={network} 
                      href={url as string} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-bold capitalize transition-colors"
                    >
                      {network}
                    </a>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Side: 3D Interactive Stage & Thumbnails */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center gap-8 relative">
            {featuredProduct && featuredImages.length > 0 ? (
              <AnimatePresence mode="wait">
                <motion.div 
                  key={featuredProduct.id}
                  initial={{ opacity: 0, scale: 0.8, rotateY: 30 }}
                  animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                  exit={{ opacity: 0, scale: 0.8, rotateY: -30 }}
                  transition={{ duration: 0.6, type: "spring", bounce: 0.3 }}
                  className="relative w-72 h-96 sm:w-80 sm:h-[420px] rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/20 dark:border-white/10 group cursor-pointer"
                  style={{ transformPerspective: 1200 }}
                  onClick={() => {
                    setSelectedProduct(featuredProduct);
                    setIsModalOpen(true);
                  }}
                >
                  <HeroShowcaseImage images={featuredImages} productName={featuredProduct.name} delay={0} />
                  
                  {/* Subtle glass overlay on bottom */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none opacity-80 group-hover:opacity-95 transition-opacity duration-300"></div>
                  
                  <div className="absolute bottom-6 left-6 right-6 text-left text-white pointer-events-none space-y-1">
                    <div className="flex items-center gap-1 text-amber-400 text-[10px] font-black uppercase tracking-widest">
                      <Sparkles className="w-3 h-3" /> Vista 3D En Vivo
                    </div>
                    <h3 className="font-bold text-lg leading-tight line-clamp-2">{featuredProduct.name}</h3>
                    <p className="text-white/70 text-xs font-semibold">{featuredImages.length} imágenes disponibles</p>
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="w-80 h-[420px] rounded-[2.5rem] bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400">
                <PackageIcon className="w-16 h-16 animate-pulse" />
              </div>
            )}

            {/* Thumbnail navigation across top products */}
            {topProducts.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto max-w-full p-2 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800">
                {topProducts.map((p, idx) => {
                  const img = p.images?.length ? (typeof p.images[0] === 'string' ? p.images[0] : p.images[0].url) : p.imageUrl;
                  const isActive = idx === featuredIndex;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setFeaturedIndex(idx)}
                      className={`relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                        isActive 
                        ? 'border-blue-500 scale-110 shadow-lg' 
                        : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      {img ? (
                        <img src={img} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs">📦</div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Sticky Filter Bar (replaces the sidebar) */}
      <div className="sticky top-[72px] z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-2xl border-b border-slate-200 dark:border-slate-800/50 py-3 px-6 mt-0 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-4 justify-between">
          
          <div className="flex-1 overflow-x-auto hide-scrollbar w-full mask-edges px-2">
            <div className="flex items-center gap-2 min-w-max pb-2">
              {categories.map((cat, i) => (
                <button
                  key={cat}
                  id={`tab-${cat.replace(/\s+/g, '-')}`}
                  onClick={() => {
                    isClickScrollingRef.current = true;
                    setSelectedCategory(cat);
                    const el = document.getElementById(`tab-${cat.replace(/\s+/g, '-')}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
                    
                    if (!searchQuery) {
                      const section = document.getElementById(`section-${cat.replace(/\s+/g, '-')}`);
                      if (section) {
                        const y = section.getBoundingClientRect().top + window.scrollY - 140; // offset for sticky header
                        window.scrollTo({ top: y, behavior: 'smooth' });
                      }
                    }
                    setTimeout(() => { isClickScrollingRef.current = false; }, 1200);
                  }}
                  className={`relative px-5 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
                    selectedCategory === cat 
                    ? 'text-white' 
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {selectedCategory === cat && (
                    <motion.div
                      layoutId="active-tab-bg"
                      className="absolute inset-0 rounded-full z-0 shadow-md"
                      style={{ backgroundColor: selectedBranch?.configuracion?.colores?.primario || '#0f172a' }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{cat}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="w-full md:w-auto relative group shrink-0 min-w-[280px]">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar productos..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-full focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-medium placeholder:text-slate-500 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Ecommerce Main Area */}
      <main id="catalog-main" className="max-w-7xl mx-auto px-6 py-12 scroll-mt-[160px]">
        <div className="flex flex-col gap-10">
          <div className="flex-1">
            {searchQuery ? (
              // Search Results (Flat Grid)
              <>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-2xl font-black">
                    Resultados para "{searchQuery}"
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                    {filteredProducts.length} resultados
                  </p>
                </div>

                {filteredProducts.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-24 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800"
                  >
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                      <Search className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-black mb-2">No encontramos lo que buscas</h3>
                    <p className="text-slate-500">Intenta con otros términos o cambia de sucursal.</p>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    <AnimatePresence>
                      {filteredProducts.map((product, idx) => (
                        <ProductCard 
                          key={product.id} 
                          product={product} 
                          index={idx} 
                          onClick={() => setSelectedProduct(product)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </>
            ) : (
              // Grouped by Category with ScrollSpy
              <div className="flex flex-col gap-24">
                {productsByCategory && categories.map(cat => {
                  const catProducts = productsByCategory[cat];
                  if (!catProducts || catProducts.length === 0) return null;
                  
                  return (
                    <section 
                      key={cat} 
                      id={`section-${cat.replace(/\s+/g, '-')}`} 
                      data-category-section={cat} 
                      className="scroll-mt-[160px]"
                    >
                      <div className="mb-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white capitalize">
                          {cat}
                        </h2>
                        <span className="text-slate-500 text-sm font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                          {catProducts.length} items
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                        {catProducts.map((product, idx) => (
                          <ProductCard 
                            key={product.id} 
                            product={product} 
                            index={idx} 
                            onClick={() => setSelectedProduct(product)}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Product Expansion Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm"
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              layoutId={`product-${selectedProduct.id}`}
              className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2rem] overflow-hidden shadow-2xl flex flex-col md:flex-row relative cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 z-50 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-full md:w-1/2 bg-slate-50 dark:bg-slate-950 aspect-square md:aspect-auto flex flex-col items-center justify-center relative p-8">
                <div className="flex-1 flex items-center justify-center w-full relative">
                  {selectedProduct.imageUrl || selectedProduct.images?.length ? (
                    <motion.img 
                      key={`main-img-${activeModalImage}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      layoutId={`product-image-${selectedProduct.id}`}
                      src={selectedProduct.images?.[activeModalImage] || selectedProduct.imageUrl} 
                      alt={selectedProduct.name}
                      className="w-full h-full object-contain drop-shadow-2xl"
                    />
                  ) : (
                    <PackageIcon className="w-24 h-24 text-slate-300" />
                  )}
                </div>

                {/* Mini Image Gallery Thumbnail row */}
                {selectedProduct.images && selectedProduct.images.length > 1 && (
                  <div className="flex gap-3 mt-6 pb-2 overflow-x-auto hide-scrollbar w-full justify-center">
                    {selectedProduct.images.map((img: string, idx: number) => (
                      <button 
                        key={idx}
                        onClick={() => setActiveModalImage(idx)}
                        className={`relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                          activeModalImage === idx 
                          ? 'border-blue-500 scale-110 shadow-lg' 
                          : 'border-transparent hover:border-slate-300 dark:hover:border-slate-700 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={img} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
                <span className="text-blue-500 font-bold tracking-widest uppercase text-xs mb-4">
                  {selectedProduct.category || 'Categoría Genérica'}
                </span>
                <h2 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white leading-tight mb-2">
                  {selectedProduct.name}
                </h2>
                <p className="text-slate-500 uppercase tracking-widest text-sm mb-8 font-bold">
                  {selectedProduct.brand || 'Marca Genérica'}
                </p>
                
                <div className="flex items-end gap-2 mb-8">
                  <span className="text-xl text-slate-400 font-bold">S/</span>
                  <span className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
                    {selectedProduct.price?.toFixed(2) || '0.00'}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 flex justify-between items-center border border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">Stock Disponible</p>
                    <p className={`text-2xl font-black ${selectedProduct.currentStock > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {selectedProduct.currentStock} Unidades
                    </p>
                  </div>
                  <ShoppingBag className={`w-8 h-8 ${selectedProduct.currentStock > 0 ? 'text-emerald-500' : 'text-rose-500 opacity-50'}`} />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-12 text-center">
        <div className="flex items-center justify-center gap-2 mb-4 text-slate-400">
          <ShoppingBag className="w-6 h-6" />
        </div>
        <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-xs">
          © {new Date().getFullYear()} DechyStore. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
};
