import React, { useEffect, useState, useMemo, useRef } from 'react';
import { collection, getDocs, query, where, onSnapshot, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { BranchSelector } from './BranchSelector';
import { ProductCard } from './ProductCard';
import { SharedCartView } from './SharedCartView';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ShoppingBag, Moon, Sun, X, Package as PackageIcon, ChevronDown, Plus, Minus, Share2, Truck, MessageSquare, FileText, Mail, Phone, MapPin, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';

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
  const [modalQtyCajas, setModalQtyCajas] = useState<number>(0);
  const [modalQtyUnidades, setModalQtyUnidades] = useState<number>(0);
  const [featuredIndex, setFeaturedIndex] = useState<number>(0);
  const [slideIndex, setSlideIndex] = useState<number>(0);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(true);
  const [visibleCount, setVisibleCount] = useState<number>(4);
  const isClickScrollingRef = useRef(false);
  const categoriesScrollRef = useRef<HTMLDivElement>(null);
  const categoriesTrayRef = useRef<HTMLDivElement>(null);

  const scrollCategoriesTray = (direction: 'left' | 'right') => {
    if (categoriesTrayRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      categoriesTrayRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };
  const [showCatsInNav, setShowCatsInNav] = useState(false);
  const [cart, setCart] = useState<Record<string, { product: any; qty: number }>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [shareQr, setShareQr] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [logoReady, setLogoReady] = useState(false);
  const [clientData, setClientData] = useState({ name: '', dni: '', phone: '' });
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [sharedCart, setSharedCart] = useState<Record<string, { product: any; qty: number }> | null>(null);
  const heroRef = useRef<HTMLElement>(null);

  // Home vs Full Catalog View state tabs
  const [activeTab, setActiveTab] = useState<'inicio' | 'catalogo'>('inicio');
  const [onlyInStock, setOnlyInStock] = useState(true);
  const [sortBy, setSortBy] = useState<'default' | 'priceAsc' | 'priceDesc' | 'alpha'>('default');

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
  const updateCartQty = (id: string, qty: number, product?: any) => setCart(prev => {
    const c = { ...prev };
    if (qty <= 0) {
      delete c[id];
    } else {
      const existing = c[id];
      const p = product || (existing ? existing.product : null);
      if (p) {
        c[id] = { product: p, qty };
      }
    }
    return c;
  });
  const cartCount = Object.values(cart).reduce((s, v) => s + v.qty, 0);
  const cartTotal = Object.values(cart).reduce((s, v) => s + v.qty * v.product.price, 0);

  const generateShareLink = () => {
    const items = Object.values(cart).map(v => `${encodeURIComponent(v.product.name.trim())}:${v.qty}`);
    const cartString = items.join(',');
    let url = `${window.location.origin}${window.location.pathname}?cart=${cartString}&branch=${selectedBranch?.id || ''}`;
    if (clientData.name || clientData.dni) {
      url += `&clientName=${encodeURIComponent(clientData.name)}&clientDNI=${encodeURIComponent(clientData.dni)}&clientPhone=${encodeURIComponent(clientData.phone)}`;
    }
    setShareUrl(url);
    setShareQr(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`);
  };

  const shareViaWhatsApp = () => {
    const items = Object.values(cart).map(v => `${encodeURIComponent(v.product.name.trim())}:${v.qty}`);
    const cartString = items.join(',');
    let url = `${window.location.origin}${window.location.pathname}?cart=${cartString}&branch=${selectedBranch?.id || ''}`;
    if (clientData.name || clientData.dni) {
      url += `&clientName=${encodeURIComponent(clientData.name)}&clientDNI=${encodeURIComponent(clientData.dni)}&clientPhone=${encodeURIComponent(clientData.phone)}`;
    }
    
    let message = `*Nuevo pedido - Dechy Inventario*\n\n`;
    message += `Hola, me gustaría cotizar/solicitar los siguientes productos:\n\n`;
    
    Object.values(cart).forEach(({ product: p, qty }) => {
      const upb = p.unitsPerBox || 1;
      let qtyStr = '';
      if (p.unitsPerBox && p.unitsPerBox > 1) {
        const boxes = Math.floor(qty / upb);
        const units = qty % upb;
        const parts = [];
        if (boxes > 0) parts.push(`${boxes} ${boxes === 1 ? 'caja' : 'cajas'}`);
        if (units > 0) parts.push(`${units} ${units === 1 ? 'unidad' : 'unidades'}`);
        qtyStr = parts.join(' y ');
      } else {
        qtyStr = `${qty} ${qty === 1 ? 'unidad' : 'unidades'}`;
      }
      
      message += `• *${p.name}* - ${qtyStr} (S/ ${(p.price * qty).toFixed(2)})\n`;
    });
    
    message += `\n*Subtotal:* S/ ${cartTotal.toFixed(2)}\n\n`;
    message += `Puedes ver el detalle de mi selección aquí:\n${url}`;
    
    const getCleanWhatsAppNumber = (branch: any) => {
      let rawNum = branch?.configuracion?.redes_sociales?.whatsapp || 
                   branch?.configuracion?.contacto?.telefono || 
                   branch?.telefono;
      if (!rawNum) return '';
      if (rawNum.includes('wa.me/') || rawNum.includes('phone=')) {
        const match = rawNum.match(/(?:wa\.me\/|phone=)(\d+)/);
        if (match && match[1]) return match[1];
      }
      let digits = rawNum.replace(/\D/g, '');
      if (digits.length === 9) {
        digits = '51' + digits;
      }
      return digits;
    };

    const waNumber = getCleanWhatsAppNumber(selectedBranch);
    const waUrl = `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const saveClientData = async () => {
    if (!clientData.name && !clientData.dni) return;
    setIsSavingClient(true);
    try {
      const branchId = selectedBranch?.id || 'branch';
      const customerIdentifier = clientData.dni.trim() || clientData.name.trim().toLowerCase().replace(/\s+/g, '_');
      const docId = `${branchId}_${customerIdentifier}`;
      
      await setDoc(doc(db, "customers", docId), {
        branchId: selectedBranch?.id || null,
        customerName: clientData.name,
        customerDNI: clientData.dni,
        phone: clientData.phone,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      setIsClientFormOpen(false);
    } catch (e) {
      console.error("Error saving client:", e);
    } finally {
      setIsSavingClient(false);
    }
  };

  // Auto-load shared selections from URL on mount/products load
  useEffect(() => {
    if (products.length === 0) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const cartParam = params.get('cart');
      if (cartParam) {
        const loadedCart: Record<string, { product: any; qty: number }> = {};
        let items: { name: string; qty: number; id?: string; price?: number }[] = [];

        if (cartParam.includes(':') || cartParam.startsWith('[')) {
          // New human-readable format: "Name:Qty,Name:Qty"
          const parts = cartParam.split(',');
          parts.forEach(part => {
            const index = part.lastIndexOf(':');
            if (index !== -1) {
              const name = decodeURIComponent(part.substring(0, index)).trim();
              const qty = parseInt(part.substring(index + 1)) || 1;
              if (name) items.push({ name, qty });
            }
          });
        } else {
          // Fallback to old base64 format for backward compatibility
          try {
            const decoded = JSON.parse(decodeURIComponent(escape(atob(cartParam))));
            if (Array.isArray(decoded)) {
              items = decoded.map(item => ({
                id: item.id,
                name: item.n,
                qty: item.q,
                price: item.p
              }));
            }
          } catch (err) {
            console.error("Failed to parse base64 cart param:", err);
          }
        }

        // Match items with Firestore products or use virtual fallback
        items.forEach(item => {
          const matchingProduct = products.find(p => 
            (item.id && p.id === item.id) || 
            p.name?.toLowerCase().trim() === item.name.toLowerCase().trim()
          );

          if (matchingProduct) {
            loadedCart[matchingProduct.id] = {
              product: matchingProduct,
              qty: item.qty
            };
          } else {
            // Create a virtual placeholder product from name so the user can see it in the cart!
            const virtualProduct = {
              id: item.id || `virtual-${Math.random()}`,
              name: item.name,
              price: item.price || 0,
              currentStock: item.qty,
              minStock: 0,
              category: 'Compartido',
              brand: 'Importado',
              imageUrl: '',
              images: []
            };
            loadedCart[virtualProduct.id] = {
              product: virtualProduct,
              qty: item.qty
            };
          }
        });

        if (Object.keys(loadedCart).length > 0) {
          setSharedCart(loadedCart);
        }
      }
    } catch (e) {
      console.error("Failed to parse shared cart URL:", e);
    }
  }, [products]);

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

  useEffect(() => {
    setActiveModalImage(0);
    if (selectedProduct) {
      const existing = cart[selectedProduct.id];
      const totalQty = existing ? existing.qty : 0;
      const upb = selectedProduct.unitsPerBox;
      if (upb && upb > 1) {
        setModalQtyCajas(Math.floor(totalQty / upb));
        setModalQtyUnidades(totalQty % upb);
      } else {
        setModalQtyCajas(0);
        setModalQtyUnidades(totalQty);
      }
    } else {
      setModalQtyCajas(0);
      setModalQtyUnidades(0);
    }
  }, [selectedProduct, cart]);

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
        
        const params = new URLSearchParams(window.location.search);
        const branchParam = params.get('branch');
        const foundBranch = data.find(b => b.id === branchParam);
        
        if (foundBranch) {
          setSelectedBranch(foundBranch);
        } else if (data.length > 0) {
          setSelectedBranch(data[0]);
        } else {
          setLoading(false);
        }
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
    products.forEach(p => { 
      if (p.category) {
        if (onlyInStock && p.currentStock <= 0) return;
        cats.add(p.category); 
      } 
    });
    return Array.from(cats).sort();
  }, [products, onlyInStock]);

  const categoryCircles = useMemo(() => {
    return categories.map(cat => {
      const customImg = selectedBranch?.configuracion?.categoriaImagenes?.[cat] || selectedBranch?.configuracion?.categoriaImagenes?.[cat.toLowerCase()];
      const pWithImg = products.find(p => p.category === cat && p.images && p.images.length > 0 && (!onlyInStock || p.currentStock > 0));
      const img = customImg || pWithImg?.images?.[0] || products.find(p => p.category === cat && (!onlyInStock || p.currentStock > 0))?.imageUrl || '/img/hero_lifestyle_bg.png';
      return { name: cat, img };
    });
  }, [categories, products, selectedBranch, onlyInStock]);

  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Filter by Category
    if (selectedCategory !== 'Todos') {
      list = list.filter(p => p.category === selectedCategory);
    }

    // Filter by Stock switch
    if (onlyInStock) {
      list = list.filter(p => p.currentStock > 0);
    }

    // Filter by Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => 
        p.name?.toLowerCase().includes(q) || 
        p.sku?.toLowerCase().includes(q) || 
        p.brand?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortBy === 'priceAsc') {
      list.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortBy === 'priceDesc') {
      list.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (sortBy === 'alpha') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return list;
  }, [products, selectedCategory, onlyInStock, searchQuery, sortBy]);

  const productsByCategory = useMemo(() => {
    const g: Record<string, any[]> = {};
    categories.forEach(c => g[c] = []);
    products.forEach(p => { 
      if (p.category && g[p.category]) {
        if (onlyInStock && p.currentStock <= 0) return;
        g[p.category].push(p); 
      } 
    });
    return g;
  }, [products, categories, onlyInStock]);

  // ScrollSpy
  useEffect(() => {
    if (searchQuery || activeTab === 'inicio') return;
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
  }, [categories, products, searchQuery, activeTab]);

  // Top products carousel (only products in stock on Inicio tab)
  const topProducts = useMemo(() => {
    const inStock = products.filter(p => p.currentStock > 0);
    const withImg = inStock.filter(p => p.images && p.images.length > 0);
    return withImg.length >= 3 ? withImg.slice(0, 8) : inStock.slice(0, 8);
  }, [products]);

  // Dynamic Inspiration Images fallback sequence
  const inspirationImages = useMemo(() => {
    const customImgs = selectedBranch?.configuracion?.inspiracion?.imagenes || [];
    const list = [...customImgs];
    const prodsWithImg = products.filter(p => p.images && p.images.length > 0);
    for (let i = 0; i < 4; i++) {
      if (!list[i]) {
        list[i] = prodsWithImg[i]?.images?.[0] || prodsWithImg[i]?.imageUrl || '/img/hero_lifestyle_bg.png';
      }
    }
    return list;
  }, [products, selectedBranch]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) setVisibleCount(2);
      else if (window.innerWidth < 1024) setVisibleCount(3);
      else setVisibleCount(4);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const canSlide = topProducts.length > visibleCount;

  useEffect(() => {
    if (topProducts.length > 0) {
      setSlideIndex(canSlide ? topProducts.length : 0);
    }
  }, [topProducts, canSlide]);

  useEffect(() => {
    if (!canSlide) return;
    const iv = setInterval(() => {
      setIsTransitioning(true);
      setSlideIndex(prev => prev + 1);
    }, 6000);
    return () => clearInterval(iv);
  }, [canSlide]);

  const handleNextSlide = () => {
    setIsTransitioning(true);
    setSlideIndex(prev => prev + 1);
  };

  const handlePrevSlide = () => {
    setIsTransitioning(true);
    setSlideIndex(prev => prev - 1);
  };

  const handleTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target !== e.currentTarget) return;
    if (slideIndex >= topProducts.length * 2) {
      setIsTransitioning(false);
      setSlideIndex(slideIndex - topProducts.length);
    } else if (slideIndex < topProducts.length) {
      setIsTransitioning(false);
      setSlideIndex(slideIndex + topProducts.length);
    }
  };

  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;
      
      if (currentScrollY <= 80) {
        setShowHeader(true);
      } else {
        // Hysteresis: Only hide if scrolled down by > 15px, show if scrolled up by > 15px
        if (delta > 15) {
          setShowHeader(false);
        } else if (delta < -15) {
          setShowHeader(true);
        }
      }
      
      if (Math.abs(delta) > 5) {
        setLastScrollY(currentScrollY);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const scrollSmoothWithOffset = (id: string, offset = 180) => {
    const el = document.getElementById(id);
    if (el) {
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const [activeScrollCategory, setActiveScrollCategory] = useState<string | null>(null);

  // Scroll Spy for Catalog sections with nearest-section fallback
  useEffect(() => {
    if (activeTab !== 'catalogo' || selectedCategory !== 'Todos') {
      setActiveScrollCategory(null);
      return;
    }

    const handleScrollSpy = () => {
      const scrollPos = window.scrollY + 200; // Offset for sticky headers
      let currentCat: string | null = null;
      let closestSectionCat: string | null = null;
      let minDistance = Infinity;

      for (const cat of categories) {
        const el = document.getElementById(`section-${cat.replace(/\s+/g, '-')}`);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          
          if (scrollPos >= top && scrollPos < top + height) {
            currentCat = cat;
            break;
          }

          const distance = Math.abs(scrollPos - top);
          if (distance < minDistance) {
            minDistance = distance;
            closestSectionCat = cat;
          }
        }
      }

      const mainEl = document.getElementById('catalog-main');
      if (mainEl && window.scrollY + 120 < mainEl.offsetTop) {
        currentCat = 'Todos';
      }

      // If we are scrolling past the banner but in the middle of sections, use the closest section
      if (!currentCat && window.scrollY + 120 >= (mainEl?.offsetTop || 0)) {
        currentCat = closestSectionCat;
      }

      setActiveScrollCategory(currentCat || 'Todos');
    };

    window.addEventListener('scroll', handleScrollSpy, { passive: true });
    handleScrollSpy();
    return () => window.removeEventListener('scroll', handleScrollSpy);
  }, [activeTab, selectedCategory, categories]);

  useEffect(() => {
    if (categoriesScrollRef.current) {
      const activeEl = categoriesScrollRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [selectedCategory, activeScrollCategory]);

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
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-white font-sans selection:bg-slate-900 selection:text-white dark:selection:bg-white dark:selection:text-slate-950">

      {/* ── Top Promo Ticker ── */}
      <div 
        className="text-white text-[10px] sm:text-xs font-semibold py-2 px-4 flex items-center justify-between sm:justify-center gap-6 z-[60] relative tracking-wider uppercase"
        style={{ backgroundColor: primaryColor }}
      >
        <span className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-amber-250" /> Envíos a todo el país</span>
        <span className="hidden sm:flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 text-amber-250" /> Asesoría personalizada</span>
        <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-amber-250" /> Catálogo de muestras</span>
      </div>

      {/* ── Navbar matching Decor Haus layout ── */}
      <nav className={`sticky top-0 left-0 w-full z-50 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-xl border-b border-slate-200/50 dark:border-white/5 px-4 py-2.5 sm:px-6 transition-transform duration-300 ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          
          {/* Logo & Selector */}
          <div className="flex items-center gap-2">
            <BranchSelector branches={branches} selectedBranch={selectedBranch} onSelectBranch={setSelectedBranch} />
          </div>

          {/* Middle Nav Links */}
          <div className="hidden md:flex items-center gap-8 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-600 dark:text-slate-300">
            <button 
              onClick={() => { setActiveTab('inicio'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
              className={`transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[1.5px] after:transition-transform after:origin-left ${activeTab === 'inicio' ? 'text-slate-950 dark:text-white after:scale-x-100' : 'hover:text-slate-950 dark:hover:text-white after:scale-x-0 hover:after:scale-x-100'}`}
              style={{ 
                color: activeTab === 'inicio' ? primaryColor : '',
                borderColor: activeTab === 'inicio' ? primaryColor : ''
              }}
            >
              Inicio
            </button>
            <button 
              onClick={() => { setActiveTab('catalogo'); setTimeout(() => scrollSmoothWithOffset('catalog-main'), 100); }} 
              className={`transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[1.5px] after:transition-transform after:origin-left ${activeTab === 'catalogo' ? 'text-slate-950 dark:text-white after:scale-x-100' : 'hover:text-slate-950 dark:hover:text-white after:scale-x-0 hover:after:scale-x-100'}`}
              style={{ 
                color: activeTab === 'catalogo' ? primaryColor : '',
                borderColor: activeTab === 'catalogo' ? primaryColor : ''
              }}
            >
              Catálogo
            </button>
            <button 
              onClick={() => { setActiveTab('inicio'); setTimeout(() => scrollSmoothWithOffset('categories-section'), 100); }} 
              className="hover:text-slate-950 dark:hover:text-white transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[1.5px] after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:origin-left"
            >
              Categorías
            </button>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-3">
            {/* Elegant Input search box */}
            <div className="relative w-28 sm:w-44">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input 
                type="text" 
                value={searchQuery} 
                onChange={e => { setSearchQuery(e.target.value); if (e.target.value) setActiveTab('catalogo'); }} 
                placeholder="Buscar..." 
                className="w-full pl-8 pr-2.5 py-1.5 bg-slate-100 dark:bg-slate-800/80 border-none rounded-full text-[11px] font-medium outline-none focus:ring-1 focus:ring-slate-400/30 placeholder:text-slate-400 text-slate-950 dark:text-white"
              />
            </div>

            <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-white">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button onClick={() => setCartOpen(true)} className="relative p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors text-slate-500 hover:text-slate-900 dark:hover:text-white">
              <ShoppingBag className="w-4 h-4" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[8px] font-bold bg-slate-950 text-white dark:bg-white dark:text-slate-950 rounded-full flex items-center justify-center border border-white dark:border-slate-950">{cartCount}</span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Loading ── */}
      <AnimatePresence>
        {isAppLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-md">
            {branchLogo && logoReady ? (
              <motion.img animate={{ scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }} transition={{ repeat: Infinity, duration: 1.5 }} src={branchLogo} alt="" className="w-16 h-16 object-contain mb-4" />
            ) : (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-10 h-10 border-[3px] border-slate-200 rounded-full mb-4" style={{ borderTopColor: primaryColor }} />
            )}
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Cargando espacios...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {sharedCart ? (
        <SharedCartView 
          sharedCart={sharedCart}
          onClose={() => {
            const params = new URLSearchParams(window.location.search);
            params.delete('cart');
            const newSearch = params.toString();
            const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
            window.history.replaceState({}, document.title, newUrl);
            setSharedCart(null);
          }}
          onImport={() => {
            const params = new URLSearchParams(window.location.search);
            const cartParam = params.get('cart');
            const clientName = params.get('clientName') || '';
            const clientDNI = params.get('clientDNI') || '';
            const clientPhone = params.get('clientPhone') || '';
            
            if (cartParam) {
              const qs = new URLSearchParams();
              qs.set('importCart', cartParam);
              if (clientName) qs.set('clientName', clientName);
              if (clientDNI) qs.set('clientDNI', clientDNI);
              if (clientPhone) qs.set('clientPhone', clientPhone);
              
              window.location.href = `https://jieda.vercel.app/ventas/nueva?${qs.toString()}`;
            }
          }}
          primaryColor={primaryColor}
          selectedBranch={selectedBranch}
          theme={theme}
        />
      ) : activeTab === 'inicio' ? (
        <>
          {/* ══════════════════════════════════════
               SECTION 1 — Breathtaking Lifestyle Hero
               Playfair Serif font & Luxury styling
             ══════════════════════════════════════ */}
          <section ref={heroRef} className="relative h-[80vh] sm:h-[85vh] flex flex-col justify-center overflow-hidden">
            {/* Background Image with warm overlay */}
            <div className="absolute inset-0 z-0">
              <img 
                src={selectedBranch?.configuracion?.bannerHero || '/img/hero_lifestyle_bg.png'} 
                alt="Luxury contemporary living room panels and SPC floor" 
                className="w-full h-full object-cover object-center scale-[1.01] filter brightness-[0.7] dark:brightness-[0.5]" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-950/20 to-slate-950/50 dark:from-[#09090b] dark:via-black/30 dark:to-black/70" />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-12 w-full text-white">
              <div className="max-w-2xl space-y-6">
                <motion.span 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-[9px] sm:text-[10px] font-bold tracking-[0.3em] uppercase text-amber-200/90 block"
                >
                  Transforma tus espacios
                </motion.span>
                
                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.1 }}
                  className="text-4xl sm:text-5xl md:text-6xl font-serif tracking-tight leading-[1.15] font-normal text-white"
                >
                  Materiales que <br />
                  <span 
                    className="italic font-light bg-gradient-to-r from-amber-100 to-amber-250 bg-clip-text text-transparent"
                    style={{ 
                      backgroundImage: `linear-gradient(to right, ${primaryColor}, ${secondaryColor || primaryColor})`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}
                  >
                    inspiran diseño
                  </span>
                </motion.h1>

                <motion.p 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-xs sm:text-sm text-slate-200 max-w-lg font-light leading-relaxed"
                >
                  {selectedBranch?.configuracion?.descripcion || 'Wall Panels, SPC laminados, Placas UV de mármol y las mejores soluciones decorativas para crear ambientes exclusivos en tu hogar o negocio.'}
                </motion.p>

                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="pt-3 flex flex-wrap gap-3 items-center"
                >
                  <button 
                    onClick={() => { setActiveTab('catalogo'); setTimeout(() => document.getElementById('catalog-main')?.scrollIntoView({ behavior: 'smooth' }), 100); }}
                    className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-white rounded-full transition-all hover:scale-105 active:scale-95 shadow-xl"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Ver Catálogo
                  </button>
                  <button 
                    onClick={() => document.getElementById('categories-section')?.scrollIntoView({ behavior: 'smooth' })}
                    className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-white rounded-full bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md transition-all hover:scale-105 active:scale-95"
                  >
                    Explorar Categorías
                  </button>
                </motion.div>
              </div>
            </div>

            {/* Scroll indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={heroPhase >= 2 ? { opacity: 1 } : {}}
              transition={{ delay: 0.5 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-slate-400"
            >
              <span className="text-[8px] font-bold uppercase tracking-[0.25em]">Deslizar</span>
              <motion.div animate={{ y: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                <ChevronDown className="w-3.5 h-3.5" />
              </motion.div>
            </motion.div>
          </section>

          {/* ══════════════════════════════════════
               SECTION 2 — Circular Category Circles
             ══════════════════════════════════════ */}
          <section id="categories-section" className="py-16 px-6 bg-white dark:bg-[#0c0c0e]">
            <div className="max-w-6xl mx-auto text-center space-y-10">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 block">Especialidades</span>
                <h2 className="text-2xl sm:text-3xl font-serif text-slate-950 dark:text-white font-normal">Explora nuestras categorías</h2>
              </div>

              <div className="relative group/categories px-4">
                {/* Left Arrow Button */}
                <button 
                  onClick={() => scrollCategoriesTray('left')}
                  className="absolute left-0 top-[40%] -translate-y-1/2 z-20 p-2 rounded-full bg-white/90 hover:bg-white dark:bg-slate-900/90 dark:hover:bg-slate-800 text-slate-800 dark:text-white shadow-lg transition-all hover:scale-110 border border-slate-200/50 dark:border-white/5 cursor-pointer opacity-70 hover:opacity-100 hidden sm:flex items-center justify-center"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Right Arrow Button */}
                <button 
                  onClick={() => scrollCategoriesTray('right')}
                  className="absolute right-0 top-[40%] -translate-y-1/2 z-20 p-2 rounded-full bg-white/90 hover:bg-white dark:bg-slate-900/90 dark:hover:bg-slate-800 text-slate-800 dark:text-white shadow-lg transition-all hover:scale-110 border border-slate-200/50 dark:border-white/5 cursor-pointer opacity-70 hover:opacity-100 hidden sm:flex items-center justify-center"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Scrollable container */}
                <div 
                  ref={categoriesTrayRef}
                  className="overflow-x-auto hide-scrollbar py-4 px-2 w-full scroll-smooth"
                >
                  <div className="flex items-center gap-5 sm:gap-8 justify-start mx-auto w-max max-w-full">
                    {/* Circle for "Todos" */}
                    <button 
                      onClick={() => {
                        setSelectedCategory('Todos');
                        setActiveTab('catalogo');
                        setTimeout(() => {
                          document.getElementById('catalog-main')?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      }}
                      className="flex flex-col items-center gap-3 shrink-0 group text-center"
                    >
                      <div 
                        className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border p-1 transition-all duration-300 ${selectedCategory === 'Todos' ? 'scale-105 shadow-md' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300'}`}
                        style={selectedCategory === 'Todos' ? { borderColor: primaryColor } : {}}
                      >
                        <div className="w-full h-full rounded-full bg-slate-900 dark:bg-slate-800 flex items-center justify-center text-white" style={{ backgroundColor: selectedCategory === 'Todos' ? primaryColor : '' }}>
                          <ShoppingBag className="w-7 h-7" />
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Todos los productos</span>
                      <span className="text-[10px] text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Ver todos →</span>
                    </button>

                    {categoryCircles.map(cat => (
                      <button 
                        key={cat.name} 
                        onClick={() => {
                          setSelectedCategory(cat.name);
                          setActiveTab('catalogo');
                          setTimeout(() => {
                            const sec = document.getElementById(`section-${cat.name.replace(/\s+/g, '-')}`);
                            if (sec) {
                              sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            } else {
                              document.getElementById('catalog-main')?.scrollIntoView({ behavior: 'smooth' });
                            }
                          }, 100);
                        }}
                        className="flex flex-col items-center gap-3 shrink-0 group text-center"
                      >
                        <div 
                          className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border p-1 transition-all duration-300 ${selectedCategory === cat.name ? 'scale-105 shadow-md' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300'}`}
                          style={selectedCategory === cat.name ? { borderColor: primaryColor } : {}}
                        >
                          <img src={cat.img} alt={cat.name} className="w-full h-full rounded-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        </div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize">{cat.name}</span>
                        <span className="text-[10px] text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Ver productos →</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════
               SECTION 3 — Premium Trust Badges
             ══════════════════════════════════════ */}
          <section className="py-10 px-6 bg-slate-50 dark:bg-[#08080a] border-y border-slate-200/40 dark:border-slate-850">
            <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center md:text-left">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-3.5">
                <div className="p-2.5 rounded-full bg-slate-200/50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 shrink-0">
                  <Truck className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-950 dark:text-white uppercase tracking-wider">Envíos a todo el país</h4>
                  <p className="text-[10.5px] text-slate-400 mt-0.5 leading-relaxed font-light">Llegamos hasta tu proyecto o almacén.</p>
                </div>
              </div>
              <div className="flex flex-col md:flex-row items-center md:items-start gap-3.5">
                <div className="p-2.5 rounded-full bg-slate-200/50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 shrink-0">
                  <PackageIcon className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-950 dark:text-white uppercase tracking-wider">Productos de calidad</h4>
                  <p className="text-[10.5px] text-slate-400 mt-0.5 leading-relaxed font-light">Materiales certificados, resistentes y duraderos.</p>
                </div>
              </div>
              <div className="flex flex-col md:flex-row items-center md:items-start gap-3.5">
                <div className="p-2.5 rounded-full bg-slate-200/50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 shrink-0">
                  <MessageSquare className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-950 dark:text-white uppercase tracking-wider">Asesoría experta</h4>
                  <p className="text-[10.5px] text-slate-400 mt-0.5 leading-relaxed font-light">Te ayudamos a modular y modular tu stock ideal.</p>
                </div>
              </div>
              <div className="flex flex-col md:flex-row items-center md:items-start gap-3.5">
                <div className="p-2.5 rounded-full bg-slate-200/50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 shrink-0">
                  <FileText className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-950 dark:text-white uppercase tracking-wider">Catálogo de muestras</h4>
                  <p className="text-[10.5px] text-slate-400 mt-0.5 leading-relaxed font-light">Pide tus muestras físicas y elige con seguridad.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════
               SECTION 4 — Refined Destacados Carousel (Expanded)
             ══════════════════════════════════════ */}
          {topProducts.length > 0 && (
            <section className="py-16 px-6 bg-white dark:bg-[#0c0c0e]">
              <div className="max-w-6xl mx-auto space-y-12">
                <div className="flex items-end justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 block">Exclusivos</span>
                    <h3 className="text-2xl font-serif text-slate-950 dark:text-white font-normal">Productos destacados</h3>
                  </div>
                  <button 
                    onClick={() => { setActiveTab('catalogo'); setTimeout(() => document.getElementById('catalog-main')?.scrollIntoView({ behavior: 'smooth' }), 100); }}
                    className="text-xs font-bold hover:text-slate-950 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 group transition-colors"
                    style={{ color: primaryColor }}
                  >
                    Ver todos <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                </div>

                <div className="relative group/carousel px-4">
                  {/* Left Arrow Button */}
                  {canSlide && (
                    <button 
                      onClick={handlePrevSlide}
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/90 hover:bg-white dark:bg-slate-900/90 dark:hover:bg-slate-800 text-slate-800 dark:text-white shadow-lg transition-all hover:scale-110 opacity-70 hover:opacity-100 border border-slate-200/50 dark:border-white/5 cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}

                  {/* Right Arrow Button */}
                  {canSlide && (
                    <button 
                      onClick={handleNextSlide}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/90 hover:bg-white dark:bg-slate-900/90 dark:hover:bg-slate-800 text-slate-800 dark:text-white shadow-lg transition-all hover:scale-110 opacity-70 hover:opacity-100 border border-slate-200/50 dark:border-white/5 cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}

                  {/* Slider Track */}
                  <div className="overflow-hidden p-1">
                    <div 
                      className="flex" 
                      style={{ 
                        transform: canSlide ? `translateX(-${slideIndex * (100 / visibleCount)}%)` : 'none', 
                        justifyContent: canSlide ? 'flex-start' : 'center',
                        transition: isTransitioning && canSlide ? 'transform 500ms cubic-bezier(0.25, 1, 0.5, 1)' : 'none' 
                      }}
                      onTransitionEnd={handleTransitionEnd}
                    >
                      {(canSlide ? [...topProducts, ...topProducts, ...topProducts] : topProducts).map((p, idx) => (
                        <div key={`${p.id}-${idx}`} className="shrink-0 w-1/2 sm:w-1/3 lg:w-1/4 px-2">
                          <ProductCard product={p} index={idx} onClick={() => setSelectedProduct(p)} onAddToCart={addToCart} onUpdateCartQty={updateCartQty} cartQty={cart[p.id]?.qty || 0} primaryColor={primaryColor} />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Pagination Dots */}
                  {canSlide && (
                    <div className="flex justify-center gap-2 mt-8">
                      {topProducts.map((_, i) => {
                        const activeDotIndex = slideIndex % topProducts.length;
                        return (
                          <button 
                            key={i} 
                            onClick={() => {
                              setIsTransitioning(true);
                              setSlideIndex(topProducts.length + i);
                            }}
                            className="w-2 h-2 rounded-full transition-all duration-300 bg-slate-300 dark:bg-slate-700" 
                            style={{ 
                              backgroundColor: activeDotIndex === i ? primaryColor : undefined,
                              width: activeDotIndex === i ? '20px' : '8px'
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Expanded Sections: Premium Brand Banners for Key Categories */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-10 border-t border-slate-100 dark:border-slate-900/60">
                  {/* Section 1: Wall Panels */}
                  <div className="relative rounded-3xl overflow-hidden aspect-[16/9] md:aspect-auto md:h-[300px] group shadow-lg flex flex-col justify-end p-8 text-white">
                    <div className="absolute inset-0 z-0">
                      <img 
                        src={products.find(p => p.category?.toLowerCase().includes('panel') || p.name?.toLowerCase().includes('panel'))?.images?.[0] || products.find(p => p.category?.toLowerCase().includes('panel') || p.name?.toLowerCase().includes('panel'))?.imageUrl || '/img/hero_lifestyle_bg.png'} 
                        alt="Revestimientos Premium" 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10" />
                    </div>
                    <div className="relative z-10 space-y-3">
                      <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-amber-250">Tendencia</span>
                      <h4 className="text-xl sm:text-2xl font-serif font-normal">Muros 3D & Wall Panels</h4>
                      <p className="text-[11px] sm:text-xs text-slate-200/90 font-light leading-relaxed max-w-sm">
                        Revestimientos estriados y decorativos de alta densidad. Diseños contemporáneos con texturas sofisticadas que elevan el nivel de cualquier ambiente.
                      </p>
                      <button 
                        onClick={() => {
                          const panelCat = categories.find(c => c.toLowerCase().includes('panel'));
                          if (panelCat) setSelectedCategory(panelCat);
                          setActiveTab('catalogo');
                          setTimeout(() => scrollSmoothWithOffset('catalog-main'), 100);
                        }}
                        className="px-5 py-2.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-white transition-all hover:scale-105 active:scale-95 shadow-md flex items-center gap-1.5 w-fit"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Explorar Colección <span>→</span>
                      </button>
                    </div>
                  </div>

                  {/* Section 2: SPC Flooring */}
                  <div className="relative rounded-3xl overflow-hidden aspect-[16/9] md:aspect-auto md:h-[300px] group shadow-lg flex flex-col justify-end p-8 text-white">
                    <div className="absolute inset-0 z-0">
                      <img 
                        src={products.find(p => p.category?.toLowerCase().includes('piso') || p.name?.toLowerCase().includes('piso') || p.category?.toLowerCase().includes('suelo'))?.images?.[0] || products.find(p => p.category?.toLowerCase().includes('piso') || p.name?.toLowerCase().includes('piso') || p.category?.toLowerCase().includes('suelo'))?.imageUrl || '/img/hero_lifestyle_bg.png'} 
                        alt="Suelos SPC Premium" 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10" />
                    </div>
                    <div className="relative z-10 space-y-3">
                      <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-amber-250">Resistencia Extrema</span>
                      <h4 className="text-xl sm:text-2xl font-serif font-normal">Suelos SPC Termolaminados</h4>
                      <p className="text-[11px] sm:text-xs text-slate-200/90 font-light leading-relaxed max-w-sm">
                        Durabilidad total con texturas de madera natural. 100% resistentes al agua, acústicos y de altísima resistencia al tránsito.
                      </p>
                      <button 
                        onClick={() => {
                          const floorCat = categories.find(c => c.toLowerCase().includes('piso') || c.toLowerCase().includes('suelo') || c.toLowerCase().includes('spc'));
                          if (floorCat) setSelectedCategory(floorCat);
                          setActiveTab('catalogo');
                          setTimeout(() => scrollSmoothWithOffset('catalog-main'), 100);
                        }}
                        className="px-5 py-2.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-white transition-all hover:scale-105 active:scale-95 shadow-md flex items-center gap-1.5 w-fit"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Explorar Colección <span>→</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          {/* ══════════════════════════════════════
               SECTION 1 — Sleek Minimalist Catálogo Banner
             ══════════════════════════════════════ */}
          <div className="relative py-14 px-6 bg-slate-900 text-white overflow-hidden text-center">
            <div className="absolute inset-0 z-0">
              <img src={selectedBranch?.configuracion?.bannerHero || '/img/hero_lifestyle_bg.png'} className="w-full h-full object-cover opacity-20 filter blur-sm scale-105" />
            </div>
            <div className="relative z-10 max-w-2xl mx-auto space-y-2">
              <h1 className="text-3xl font-serif tracking-tight">Catálogo de Productos</h1>
              <p className="text-[10px] text-amber-250 uppercase tracking-[0.2em] font-bold" style={{ color: primaryColor }}>
                {selectedBranch ? selectedBranch.name : 'Decor Dechy Haus'}
              </p>
            </div>
          </div>

          {/* ══════════════════════════════════════
               SECTION 2 — Interactive Deep Filters & Grid
             ══════════════════════════════════════ */}
          <div 
            className="sticky z-40 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-xl border-b border-slate-200/50 dark:border-white/5 shadow-sm transition-[top] duration-300 ease-in-out py-3"
            style={{ top: showHeader ? '52px' : '0px', willChange: 'top' }}
          >
            <div className="max-w-6xl mx-auto px-6 space-y-3">
              {/* Horizontal Scrollable Categories Pills */}
              <div ref={categoriesScrollRef} className="flex gap-2 overflow-x-auto pb-1.5 hide-scrollbar scroll-smooth">
                <button 
                  id="tab-Todos"
                  data-active={(activeScrollCategory || selectedCategory) === 'Todos'}
                  onClick={() => {
                    setSelectedCategory('Todos');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }} 
                  className="px-4.5 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all shrink-0 uppercase tracking-wider"
                  style={(activeScrollCategory || selectedCategory) === 'Todos' ? { backgroundColor: primaryColor, color: '#fff' } : { backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}
                >
                  Todos
                </button>
                {categories.map(cat => {
                  const isCurrent = (activeScrollCategory || selectedCategory) === cat;
                  return (
                    <button 
                      key={cat} 
                      id={`tab-${cat.replace(/\s+/g, '-')}`}
                      data-active={isCurrent}
                      onClick={() => {
                        setSelectedCategory('Todos'); // Ensure all sections are rendered
                        setTimeout(() => {
                          scrollSmoothWithOffset(`section-${cat.replace(/\s+/g, '-')}`, 180);
                        }, 50);
                      }} 
                      className="px-4.5 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all shrink-0 uppercase tracking-wider capitalize"
                      style={isCurrent ? { backgroundColor: primaryColor, color: '#fff' } : { backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* Rich Filter Controls Row */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400 font-bold">Disponibilidad:</span>
                  <button 
                    onClick={() => setOnlyInStock(!onlyInStock)}
                    className="px-3 py-1 rounded-full text-[8px] sm:text-[9px] font-bold tracking-wider transition-all border uppercase"
                    style={onlyInStock ? { backgroundColor: primaryColor, borderColor: primaryColor, color: '#fff' } : { borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#cbd5e1' }}
                  >
                    {onlyInStock ? 'Solo con stock ✔' : 'Todos'}
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400 font-bold">Ordenar:</span>
                  <select 
                    value={sortBy} 
                    onChange={e => setSortBy(e.target.value as any)}
                    className="bg-slate-100 dark:bg-slate-800 text-[8px] sm:text-[9px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full outline-none focus:ring-1 focus:ring-slate-400/30 text-slate-900 dark:text-white"
                  >
                    <option value="default">Recomendados</option>
                    <option value="priceAsc">Menor Precio</option>
                    <option value="priceDesc">Mayor Precio</option>
                    <option value="alpha">Nombre (A-Z)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <main id="catalog-main" className="max-w-6xl mx-auto px-6 py-8 scroll-mt-[130px]">

            {/* Grid of products matching filters */}
            {selectedCategory === 'Todos' && !searchQuery && sortBy === 'default' ? (
              // Grouped by Category sections
              <div className="flex flex-col gap-16">
                {categories.map(cat => {
                  const catProds = productsByCategory[cat] || [];
                  if (catProds.length === 0) return null;
                  return (
                    <section key={cat} id={`section-${cat.replace(/\s+/g, '-')}`} className="space-y-6">
                      <div className="flex items-end justify-between border-b border-slate-150/40 dark:border-slate-800/40 pb-2">
                        <h2 className="text-xl font-serif text-slate-950 dark:text-white capitalize font-normal">{cat}</h2>
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded-full">{catProds.length} items</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {catProds.map((p, i) => (
                          <ProductCard key={p.id} product={p} index={i} onClick={() => setSelectedProduct(p)} onAddToCart={addToCart} onUpdateCartQty={updateCartQty} cartQty={cart[p.id]?.qty || 0} primaryColor={primaryColor} />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              // Flat grid of filtered products
              <div className="space-y-6">
                <div className="mb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {searchQuery ? `Resultados para "${searchQuery}"` : `Filtrados (${selectedCategory})`}
                  </h2>
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{filteredProducts.length}</span>
                </div>
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-20 bg-slate-100/50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <Search className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-700 animate-pulse" />
                    <p className="text-sm font-semibold text-slate-500">No se encontraron productos con los filtros seleccionados.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredProducts.map((p, i) => (
                      <ProductCard key={p.id} product={p} index={i} onClick={() => setSelectedProduct(p)} onAddToCart={addToCart} onUpdateCartQty={updateCartQty} cartQty={cart[p.id]?.qty || 0} primaryColor={primaryColor} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </main>
        </>
      )}

      {/* ── Product Detail Full View ── */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-slate-50 dark:bg-[#08080a] overflow-y-auto"
          >
            {/* Header / Navbar for Full View */}
            <div className="sticky top-0 z-50 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-6 py-4 flex items-center justify-between">
              <button onClick={() => setSelectedProduct(null)} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors group">
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">Volver al catálogo</span>
              </button>
              
              <div className="flex items-center gap-4">
                {cartCount > 0 && (
                  <button onClick={() => setCartOpen(true)} className="relative p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
                    <ShoppingBag className="w-5 h-5" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 text-[9px] font-bold bg-rose-500 text-white rounded-full flex items-center justify-center">{cartCount}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12">
              <div className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row relative">

              <div className="w-full md:w-1/2 bg-slate-50 dark:bg-slate-950 aspect-square md:aspect-auto flex flex-col items-center justify-center p-6 border-r border-slate-100 dark:border-slate-800">
                <div className="flex-1 flex items-center justify-center w-full">
                  {selectedProduct.imageUrl || selectedProduct.images?.length ? (
                    <img
                      key={`modal-img-${activeModalImage}`}
                      src={selectedProduct.images?.[activeModalImage] || selectedProduct.imageUrl}
                      alt={selectedProduct.name}
                      className="w-full h-full object-contain max-h-[300px]"
                    />
                  ) : (
                    <PackageIcon className="w-16 h-16 text-slate-300" />
                  )}
                </div>
                {selectedProduct.images && selectedProduct.images.length > 1 && (
                  <div className="flex gap-2 mt-4 overflow-x-auto hide-scrollbar w-full justify-center">
                    {selectedProduct.images.map((img: string, idx: number) => (
                      <button key={idx} onClick={() => setActiveModalImage(idx)}
                        className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${activeModalImage === idx ? 'border-slate-800 scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="w-full md:w-1/2 p-8 flex flex-col justify-center space-y-4">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{selectedProduct.category || 'Categoría'}</span>
                <h2 className="text-xl md:text-2xl font-serif text-slate-950 dark:text-white leading-tight font-normal">{selectedProduct.name}</h2>
                <p className="text-slate-400 uppercase tracking-widest text-[9px] font-bold">{selectedProduct.brand || 'Colección Dechy'}</p>
                <div className="flex items-end gap-1.5 pt-2">
                  <span className="text-xs text-slate-400 font-semibold mb-0.5">S/</span>
                  <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{selectedProduct.price?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-5 border border-slate-100 dark:border-slate-800 mt-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Disponibilidad</p>
                      <p className={`text-lg font-bold ${selectedProduct.currentStock > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {selectedProduct.currentStock > 0 ? `${selectedProduct.currentStock} Unidades en stock` : 'Agotado Temporalmente'}
                      </p>
                    </div>
                    <ShoppingBag className={`w-6 h-6 ${selectedProduct.currentStock > 0 ? 'text-emerald-500' : 'text-rose-450'}`} />
                  </div>

                  {selectedProduct.currentStock > 0 && (
                    <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/60 space-y-3">
                      <p className="text-[9px] text-slate-450 dark:text-slate-400 font-bold uppercase tracking-wider">Ajustar Cantidad</p>
                      
                      {selectedProduct.unitsPerBox && selectedProduct.unitsPerBox > 1 ? (
                        <div className="flex gap-4">
                          {/* Cajas */}
                          <div className="flex-1 space-y-1">
                            <label className="text-[10px] font-semibold text-slate-500 block">Cajas</label>
                            <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-900/40">
                              <button 
                                type="button"
                                onClick={() => setModalQtyCajas(prev => Math.max(0, prev - 1))}
                                className="px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input 
                                type="number" 
                                min="0"
                                value={modalQtyCajas}
                                onChange={e => setModalQtyCajas(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full text-center bg-transparent border-none text-xs font-bold outline-none focus:ring-0 text-slate-900 dark:text-white"
                              />
                              <button 
                                type="button"
                                onClick={() => setModalQtyCajas(prev => prev + 1)}
                                className="px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Unidades */}
                          <div className="flex-1 space-y-1">
                            <label className="text-[10px] font-semibold text-slate-500 block">Unidades sueltas</label>
                            <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-900/40">
                              <button 
                                type="button"
                                onClick={() => setModalQtyUnidades(prev => Math.max(0, prev - 1))}
                                className="px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input 
                                type="number" 
                                min="0"
                                value={modalQtyUnidades}
                                onChange={e => setModalQtyUnidades(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full text-center bg-transparent border-none text-xs font-bold outline-none focus:ring-0 text-slate-900 dark:text-white"
                              />
                              <button 
                                type="button"
                                onClick={() => setModalQtyUnidades(prev => prev + 1)}
                                className="px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-500 block">Unidades</label>
                          <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-900/40 max-w-[200px]">
                            <button 
                              type="button"
                              onClick={() => setModalQtyUnidades(prev => Math.max(0, prev - 1))}
                              className="px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input 
                              type="number" 
                              min="0"
                              value={modalQtyUnidades}
                              onChange={e => setModalQtyUnidades(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-full text-center bg-transparent border-none text-xs font-bold outline-none focus:ring-0 text-slate-900 dark:text-white"
                            />
                            <button 
                              type="button"
                              onClick={() => setModalQtyUnidades(prev => prev + 1)}
                              className="px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-855 text-slate-500 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Resumen del total calculado */}
                      {(() => {
                        const upb = selectedProduct.unitsPerBox || 1;
                        const calculatedTotalUnits = (selectedProduct.unitsPerBox && selectedProduct.unitsPerBox > 1)
                          ? (modalQtyCajas * upb + modalQtyUnidades)
                          : modalQtyUnidades;
                        const inCart = cart[selectedProduct.id] !== undefined;

                        return (
                          <div className="space-y-3 pt-2">
                            {calculatedTotalUnits > 0 && (
                              <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                                <span>Total a llevar:</span>
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {selectedProduct.unitsPerBox && selectedProduct.unitsPerBox > 1
                                    ? `${modalQtyCajas} cajas y ${modalQtyUnidades} un. (${calculatedTotalUnits} unidades)`
                                    : `${calculatedTotalUnits} unidades`
                                  }
                                </span>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                updateCartQty(selectedProduct.id, calculatedTotalUnits, selectedProduct);
                                setSelectedProduct(null);
                              }}
                              disabled={calculatedTotalUnits <= 0 && !inCart}
                              className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:scale-105 active:scale-95 shadow-md flex items-center justify-center gap-2"
                              style={{ backgroundColor: primaryColor }}
                            >
                              <ShoppingBag className="w-4 h-4" />
                              {inCart 
                                ? (calculatedTotalUnits === 0 ? "Quitar de mi Selección" : "Actualizar Selección") 
                                : "Agregar a mi Selección"
                              }
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Additional details section for the full page view */}
            <div className="mt-8 bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
              <h3 className="text-lg font-serif text-slate-900 dark:text-white mb-4">Información Adicional</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Código / SKU</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">{selectedProduct.id || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Categoría</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1 capitalize">{selectedProduct.category || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Marca</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1 capitalize">{selectedProduct.brand || 'Colección Dechy'}</p>
                </div>
                {selectedProduct.unitsPerBox && (
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Contenido / Caja</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">{selectedProduct.unitsPerBox} u/caja</p>
                  </div>
                )}
                {(selectedProduct.dimensions || selectedProduct.length) && (
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Medidas</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">
                      {selectedProduct.dimensions || `${selectedProduct.length}×${selectedProduct.width}${selectedProduct.height ? `×${selectedProduct.height}` : ""} cm`}
                    </p>
                  </div>
                )}
                {selectedProduct.description && (
                  <div className="col-span-full">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Descripción</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      {selectedProduct.description}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cart Drawer Panel ── */}
      <AnimatePresence>
        {cartOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm" onClick={() => setCartOpen(false)}>
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute right-0 top-0 h-full w-full max-w-sm bg-white dark:bg-slate-900 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-950 dark:text-white">Mi Selección ({cartCount})</h3>
                <button onClick={() => setCartOpen(false)} className="p-1 text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {Object.entries(cart).map(([id, { product: p, qty }]) => (
                  <div key={id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800/40">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0">
                      {(p.imageUrl || p.images?.[0]) ? <img src={p.images?.[0] || p.imageUrl} alt="" className="w-full h-full object-cover" /> : <PackageIcon className="w-6 h-6 m-auto text-slate-400 mt-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-950 dark:text-white truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-400 font-light truncate">{p.category || 'Materia'}</p>
                      {p.unitsPerBox && p.unitsPerBox > 1 ? (
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mb-1">
                          {Math.floor(qty / p.unitsPerBox)} cjs, {qty % p.unitsPerBox} un.
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400 font-light mb-1">
                          {qty} un.
                        </p>
                      )}
                      <p className="text-xs font-bold text-slate-900 dark:text-white">S/ {(p.price * qty).toFixed(2)}</p>
                    </div>
                    {p.unitsPerBox && p.unitsPerBox > 1 ? (
                      <div className="flex flex-col gap-1 items-end shrink-0">
                        {/* Cajas */}
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-slate-450 dark:text-slate-500 font-bold uppercase w-8 text-right">Cjs</span>
                          <button 
                            onClick={() => updateCartQty(id, qty - p.unitsPerBox, p)} 
                            className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-100 hover:text-rose-500 transition-colors"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <input 
                            type="number"
                            min="0"
                            value={Math.floor(qty / p.unitsPerBox)}
                            onChange={e => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              const remainder = qty % p.unitsPerBox;
                              updateCartQty(id, val * p.unitsPerBox + remainder, p);
                            }}
                            className="w-8 text-center bg-transparent border-none text-[11px] font-bold outline-none focus:ring-0 text-slate-900 dark:text-white p-0"
                          />
                          <button 
                            onClick={() => updateCartQty(id, qty + p.unitsPerBox, p)} 
                            className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-100 hover:text-emerald-500 transition-colors"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        {/* Unidades */}
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-slate-450 dark:text-slate-500 font-bold uppercase w-8 text-right">Uni</span>
                          <button 
                            onClick={() => updateCartQty(id, qty - 1, p)} 
                            className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-100 hover:text-rose-500 transition-colors"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <input 
                            type="number"
                            min="0"
                            value={qty % p.unitsPerBox}
                            onChange={e => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              const boxes = Math.floor(qty / p.unitsPerBox);
                              updateCartQty(id, boxes * p.unitsPerBox + val, p);
                            }}
                            className="w-8 text-center bg-transparent border-none text-[11px] font-bold outline-none focus:ring-0 text-slate-900 dark:text-white p-0"
                          />
                          <button 
                            onClick={() => updateCartQty(id, qty + 1, p)} 
                            className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-100 hover:text-emerald-500 transition-colors"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200/50 dark:border-white/5 shrink-0">
                        <button onClick={() => removeFromCart(id)} className="w-5 h-5 flex items-center justify-center rounded-full bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-350 hover:bg-rose-100 hover:text-rose-500 transition-colors"><Minus className="w-3 h-3" /></button>
                        <input 
                          type="number"
                          min="0"
                          value={qty}
                          onChange={e => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            updateCartQty(id, val, p);
                          }}
                          className="w-8 text-center bg-transparent border-none text-xs font-bold outline-none focus:ring-0 text-slate-900 dark:text-white p-0"
                        />
                        <button onClick={() => addToCart(p)} className="w-5 h-5 flex items-center justify-center rounded-full bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-350 hover:bg-emerald-100 hover:text-emerald-500 transition-colors"><Plus className="w-3 h-3" /></button>
                      </div>
                    )}
                  </div>
                ))}
                {cartCount === 0 && <p className="text-center text-xs text-slate-400 py-12 font-light">Aún no has seleccionado ningún producto.</p>}
              </div>
              {cartCount > 0 && (
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                  <button onClick={() => setIsClientFormOpen(!isClientFormOpen)} className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 w-full justify-between">
                    <span>👤 Mis Datos (Opcional)</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isClientFormOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {isClientFormOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="pt-3 pb-1 space-y-2">
                          <input type="text" placeholder="Nombre completo" value={clientData.name} onChange={e => setClientData({...clientData, name: e.target.value})} className="w-full text-xs px-3 py-2 border rounded bg-white dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-primary" />
                          <input type="text" placeholder="DNI / RUC" value={clientData.dni} onChange={e => setClientData({...clientData, dni: e.target.value})} className="w-full text-xs px-3 py-2 border rounded bg-white dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-primary" />
                          <input type="text" placeholder="Teléfono" value={clientData.phone} onChange={e => setClientData({...clientData, phone: e.target.value})} className="w-full text-xs px-3 py-2 border rounded bg-white dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-primary" />
                          <button onClick={saveClientData} disabled={isSavingClient || (!clientData.name && !clientData.dni)} className="w-full py-2 bg-slate-900 text-white rounded text-xs font-bold disabled:opacity-50 dark:bg-slate-700 transition-colors">
                            {isSavingClient ? 'Guardando...' : 'Guardar y Asociar'}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              {cartCount > 0 && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50 dark:bg-slate-950">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Subtotal</span>
                    <span className="text-base font-extrabold text-slate-950 dark:text-white">S/ {cartTotal.toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={shareViaWhatsApp} 
                    className="w-full py-2.5 rounded-full text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <MessageSquare className="w-4.5 h-4.5" /> Enviar a WhatsApp
                  </button>
                  <button 
                    onClick={generateShareLink} 
                    className="w-full py-2.5 rounded-full text-xs font-bold text-slate-950 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Share2 className="w-4.5 h-4.5" /> Compartir por QR / Enlace
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
              <h3 className="text-base font-bold text-slate-950 dark:text-white mb-1">Compartir Selección</h3>
              <p className="text-[10px] text-slate-400 mb-4 font-light">Envía esta lista a un asesor por QR o copiando el enlace.</p>
              <div className="bg-white rounded-xl p-3 inline-block mb-4 border border-slate-100">
                <img src={shareQr} alt="QR Code" className="w-48 h-48" />
              </div>
              <div className="space-y-2">
                <button 
                  onClick={() => { 
                    navigator.clipboard.writeText(shareUrl); 
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }} 
                  className={`w-full py-2 rounded-full text-xs font-bold transition-all duration-300 ${copied ? 'bg-emerald-600 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-200 dark:text-slate-950'}`}
                >
                  {copied ? '¡Enlace Copiado!' : 'Copiar enlace'}
                </button>
                <button onClick={() => setShareQr('')} className="w-full py-2 rounded-full text-xs font-bold text-slate-400 hover:text-slate-650 transition-colors">Cerrar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating Selection Shopping Bag Button ── */}
      {cartCount > 0 && (
        <button onClick={() => setCartOpen(true)} className="fixed bottom-6 right-6 z-[90] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 bg-slate-950 dark:bg-white dark:text-slate-950" style={{ boxShadow: `0 8px 24px -4px rgba(0,0,0,0.3)` }}>
          <ShoppingBag className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-5 h-5 text-[10px] font-bold bg-rose-500 text-white rounded-full flex items-center justify-center border-2 border-white dark:border-slate-950">{cartCount}</span>
        </button>
      )}

      {/* ── SECTION 6 — Footer (Olive/Charcoal Dark theme) ── */}
      <footer className="bg-[#1b1f18] text-slate-350 py-16 px-6 border-t border-slate-950 z-10 relative">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
          
          {/* Col 1: Newsletter */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Boletín Informativo</h4>
            <p className="text-xs text-slate-400 leading-relaxed font-light">Suscríbete para recibir ofertas exclusivas, catálogos de tendencias y nuevos lanzamientos.</p>
            <div className="flex items-center bg-white/5 rounded-full border border-white/10 p-1 w-full max-w-xs focus-within:border-white/30">
              <input type="email" placeholder="Tu correo electrónico" className="bg-transparent pl-3 pr-2 py-1.5 text-xs text-white outline-none flex-1 placeholder:text-slate-500" />
              <button className="bg-white text-slate-950 text-[10px] font-bold px-3 py-1.5 rounded-full hover:bg-slate-200 transition-colors">Enviar</button>
            </div>
          </div>

          {/* Col 2: Categories */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Categorías</h4>
            <div className="flex flex-col gap-2 text-xs font-light text-slate-400">
              {categories.map(c => (
                <button key={c} onClick={() => {
                  setSelectedCategory(c);
                  document.getElementById(`section-${c.replace(/\s+/g, '-')}`)?.scrollIntoView({ behavior: 'smooth' });
                }} className="hover:text-white transition-colors text-left capitalize">{c}</button>
              ))}
            </div>
          </div>

          {/* Col 3: Information */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Información</h4>
            <div className="flex flex-col gap-2 text-xs font-light text-slate-400">
              <span className="hover:text-white transition-colors cursor-pointer">Nosotros</span>
              <span className="hover:text-white transition-colors cursor-pointer">Envíos y devoluciones</span>
              <span className="hover:text-white transition-colors cursor-pointer">Términos y condiciones</span>
              <span className="hover:text-white transition-colors cursor-pointer">Preguntas frecuentes</span>
              <span className="hover:text-white transition-colors cursor-pointer">Contacto</span>
            </div>
          </div>

          {/* Col 4: Contact */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Contacto</h4>
            <div className="flex flex-col gap-2.5 text-xs font-light text-slate-400">
              <span className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-amber-250" /> {selectedBranch?.configuracion?.contacto?.telefono || selectedBranch?.telefono || '+51 999 123 456'}</span>
              <span className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-amber-250" /> {selectedBranch?.configuracion?.contacto?.correo || selectedBranch?.correo || 'hola@decordechy.pe'}</span>
              <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-amber-250" /> {selectedBranch?.configuracion?.contacto?.direccion || selectedBranch?.location || 'Lima, Perú'}</span>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto border-t border-white/5 mt-12 pt-6 text-center text-xs text-slate-500 font-light flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} {selectedBranch?.name || 'Decor Dechy Haus'}. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4 text-slate-500 text-sm">
            {selectedBranch?.configuracion?.redes_sociales?.instagram ? (
              <a href={selectedBranch.configuracion.redes_sociales.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Instagram</a>
            ) : (
              <span className="hover:text-white cursor-pointer">Instagram</span>
            )}
            {selectedBranch?.configuracion?.redes_sociales?.facebook ? (
              <a href={selectedBranch.configuracion.redes_sociales.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Facebook</a>
            ) : (
              <span className="hover:text-white cursor-pointer">Facebook</span>
            )}
            {selectedBranch?.configuracion?.redes_sociales?.whatsapp ? (
              <a href={selectedBranch.configuracion.redes_sociales.whatsapp} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">WhatsApp</a>
            ) : (
              <span className="hover:text-white cursor-pointer">TikTok</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
